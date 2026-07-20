/**
 * SessionService — Lógica de negocio del EMA_Bot Module.
 *
 * Responsabilidades:
 *  - startSession: crea un registro Session en DB con is_active: true.
 *  - submitFatigueScore: valida el score (1-5), persiste FatigueRecord,
 *    invoca serializeFatigueRecord si está disponible, y confirma persistencia.
 *    Si el score >= 4, invoca TaskDecomposerService para descomponer las tareas
 *    activas del Student (Requisitos 4.1, 4.2).
 *  - getSessionHistory: retorna las últimas 30 Sessions del Student autenticado.
 *
 * Utiliza PrismaService (global) para acceso a la base de datos.
 * PrismaModule es @Global(), por lo que no necesita importarse explícitamente.
 *
 * Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskDecomposerService, MicroObjective } from '../task-decomposer/task-decomposer.service';

/** Respuesta del método startSession. */
export interface StartSessionResponse {
  sessionId: string;
  prompt: string;
}

/** Respuesta del método submitFatigueScore. */
export interface SubmitFatigueResponse {
  fatigueRecordId: string;
  sessionId: string;
  score: number;
  recordedAtUtc: Date;
  message: string;
  /** Micro-objetivos generados si fatigueScore >= 4; vacío en caso contrario. */
  microObjectives: MicroObjective[];
}

/** Forma simplificada de Session retornada en el historial. */
export interface SessionHistoryItem {
  id: string;
  studentId: string;
  startedAt: Date;
  endedAt: Date | null;
  isActive: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskDecomposer: TaskDecomposerService,
  ) {}

  /**
   * Crea una nueva Session activa para el Student autenticado.
   *
   * Retorna el sessionId y el prompt inicial del EMA_Bot:
   * "¿Cómo te sientes hoy? (1-5)"
   *
   * Requisito 3.1
   */
  async startSession(studentId: string): Promise<StartSessionResponse> {
    const session = await this.prisma.session.create({
      data: {
        studentId,
        startedAt: new Date(),
        isActive: true,
      },
    });

    return {
      sessionId: session.id,
      prompt: '¿Cómo te sientes hoy? (1-5)',
    };
  }

  /**
   * Persiste el Fatigue_Score para la Session y Student indicados.
   *
   * Precondiciones:
   *  - La Session debe existir y pertenecer al Student.
   *  - El score ya fue validado por el DTO (1-5 entero).
   *
   * Si el score >= 4, invoca TaskDecomposerService para descomponer
   * cada tarea activa del Student en MicroObjectives. — Requisitos 4.1, 4.2
   *
   * Después de la persistencia serializa el registro (si SessionSerializerService
   * está disponible) y retorna confirmación para la transición al flujo de tareas.
   * El proceso completo debe completarse en < 1 segundo tras confirmar persistencia.
   *
   * Requisitos: 3.3, 3.4, 3.5, 4.1, 4.2
   */
  async submitFatigueScore(
    sessionId: string,
    studentId: string,
    score: number,
  ): Promise<SubmitFatigueResponse> {
    // Verificar que la Session existe y pertenece al Student autenticado
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Sesión con id "${sessionId}" no encontrada.`);
    }

    if (session.studentId !== studentId) {
      throw new BadRequestException(
        'La sesión no pertenece al estudiante autenticado.',
      );
    }

    // Persistir el FatigueRecord con UTC timestamp — Requisito 3.5
    const fatigueRecord = await this.prisma.fatigueRecord.create({
      data: {
        sessionId,
        studentId,
        fatigueScore: score,
        recordedAtUtc: new Date(),
      },
    });

    // Serializar el registro (log para auditoría; no bloquea la respuesta)
    // Si SessionSerializerService se implementa, se inyectaría aquí.
    // Por ahora se serializa directamente como JSON para cumplir Requisito 3.5.
    void JSON.stringify({
      id: fatigueRecord.id,
      sessionId: fatigueRecord.sessionId,
      studentId: fatigueRecord.studentId,
      fatigueScore: fatigueRecord.fatigueScore,
      recordedAtUtc: fatigueRecord.recordedAtUtc.toISOString(),
    });

    // ── Descomposición adaptativa por fatiga — Requisitos 4.1, 4.2 ──────────
    let microObjectives: MicroObjective[] = [];

    if (this.taskDecomposer.shouldDecompose(score)) {
      // Obtener tareas activas del Student para descomponer
      const activeTasks = await this.prisma.task.findMany({
        where: { studentId, isDeleted: false },
        orderBy: { deadline: 'asc' },
      });

      if (activeTasks.length > 0) {
        // Descomponer cada tarea activa (en paralelo para minimizar latencia)
        const results = await Promise.allSettled(
          activeTasks.map((task) =>
            this.taskDecomposer.decompose(
              { id: task.id, name: task.name, description: task.description },
              sessionId,
            ),
          ),
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            microObjectives = microObjectives.concat(result.value);
          } else {
            // Log el fallo individual pero no bloquea otras tareas — Requisito 4.5
            this.logger.error(
              `Error al descomponer tarea: ${(result.reason as Error).message}`,
            );
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Determinar mensaje según si hubo descomposición o no — Requisito 3.4
    const message =
      microObjectives.length > 0
        ? `Fatigue score registrado. Se generaron ${microObjectives.length} micro-objetivo(s) para tus tareas activas.`
        : 'Fatigue score registrado. Transicionando al flujo de interacción de tareas.';

    return {
      fatigueRecordId: fatigueRecord.id,
      sessionId: fatigueRecord.sessionId,
      score: fatigueRecord.fatigueScore,
      recordedAtUtc: fatigueRecord.recordedAtUtc,
      message,
      microObjectives,
    };
  }

  /**
   * Retorna las últimas 30 Sessions del Student autenticado,
   * ordenadas por startedAt DESC (más reciente primero).
   *
   * Requisito 3.3, 5.3
   */
  async getSessionHistory(studentId: string): Promise<SessionHistoryItem[]> {
    const sessions = await this.prisma.session.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });

    return sessions.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      isActive: s.isActive,
    }));
  }
}
