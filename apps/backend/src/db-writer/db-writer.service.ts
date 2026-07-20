/**
 * DBWriterService — Capa de persistencia centralizada para MindFlow.
 *
 * Encapsula todas las operaciones de escritura y lectura sobre la base de datos,
 * usando exclusivamente métodos tipados del cliente Prisma (sin SQL dinámico por
 * concatenación) para garantizar queries parametrizadas — Requisito 7.2.
 *
 * Lógica de reintento: cualquier operación que falle con PrismaClientKnownRequestError
 * se reintenta exactamente una vez después de 500 ms antes de propagar el error —
 * Requisito 7.3.
 *
 * Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ─── DTOs de entrada ──────────────────────────────────────────────────────────

/** Datos necesarios para crear o actualizar una Session. — Requisito 7.2 */
export interface WriteSessionInput {
  studentId: string;
  startedAt: Date;
  endedAt?: Date | null;
  isActive: boolean;
}

/** Datos necesarios para registrar un FatigueRecord. — Requisito 7.3 */
export interface WriteFatigueRecordInput {
  sessionId: string;
  studentId: string;
  fatigueScore: number;
  recordedAtUtc?: Date;
}

/** Datos necesarios para crear una Task. — Requisito 7.4 */
export interface WriteTaskInput {
  studentId: string;
  name: string;
  description?: string | null;
  deadline: Date;
}

/** Datos necesarios para crear un MicroObjective. — Requisito 7.4 */
export interface WriteMicroObjectiveInput {
  taskId: string;
  sessionId: string;
  content: string;
  estimatedMinutes: number;
  isAuditOnly?: boolean;
}

/** Datos necesarios para registrar una notificación. — Requisito 7.5 */
export interface WriteNotificationLogInput {
  studentId: string;
  taskId: string;
  status: string;
  attemptCount?: number;
  dispatchedAtUtc: Date;
}

// ─── DTOs de salida del dashboard ────────────────────────────────────────────

/** Tarea activa con sus MicroObjectivos pendientes. — Requisito 7.4 */
export interface DashboardTask {
  id: string;
  studentId: string;
  name: string;
  description: string | null;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
  pendingMicroObjectives: DashboardMicroObjective[];
}

/** MicroObjectivo pendiente del dashboard. — Requisito 7.4 */
export interface DashboardMicroObjective {
  id: string;
  taskId: string;
  sessionId: string;
  content: string;
  estimatedMinutes: number;
  isAuditOnly: boolean;
  createdAt: Date;
}

/** Registro de fatiga simplificado para el dashboard. — Requisito 7.3 */
export interface DashboardFatigueRecord {
  id: string;
  sessionId: string;
  fatigueScore: number;
  recordedAtUtc: Date;
}

/** Resultado completo del dashboard de un estudiante. */
export interface DashboardData {
  activeTasks: DashboardTask[];
  last30FatigueRecords: DashboardFatigueRecord[];
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class DBWriterService {
  private readonly logger = new Logger(DBWriterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Métodos privados de utilidad ──────────────────────────────────────────

  /**
   * Ejecuta `operation` y, si falla con PrismaClientKnownRequestError,
   * espera 500 ms y la reintenta exactamente una vez antes de propagar.
   *
   * Requisito 7.3
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.warn(
          `PrismaClientKnownRequestError [${(err as Prisma.PrismaClientKnownRequestError).code}] — reintentando en 500 ms`,
        );
        await this.delay(500);
        return await operation();
      }
      throw err;
    }
  }

  /** Espera `ms` milisegundos (promesa). */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Operaciones de escritura ──────────────────────────────────────────────

  /**
   * Persiste una nueva Session en la base de datos.
   *
   * Usa Prisma `create` con objeto `data` completamente tipado (sin SQL dinámico).
   * Requisitos 7.1, 7.2
   */
  async writeSession(
    input: WriteSessionInput,
  ): Promise<Prisma.SessionGetPayload<NonNullable<unknown>>> {
    const data: Prisma.SessionCreateInput = {
      student: { connect: { id: input.studentId } },
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      isActive: input.isActive,
    };

    return this.withRetry(() => this.prisma.session.create({ data }));
  }

  /**
   * Persiste un registro de fatiga asociado a una Session y un Student.
   *
   * Requisitos 7.1, 7.3
   */
  async writeFatigueRecord(
    input: WriteFatigueRecordInput,
  ): Promise<Prisma.FatigueRecordGetPayload<NonNullable<unknown>>> {
    const data: Prisma.FatigueRecordCreateInput = {
      session: { connect: { id: input.sessionId } },
      student: { connect: { id: input.studentId } },
      fatigueScore: input.fatigueScore,
      recordedAtUtc: input.recordedAtUtc ?? new Date(),
    };

    return this.withRetry(() => this.prisma.fatigueRecord.create({ data }));
  }

  /**
   * Crea una nueva Task para el Student indicado.
   *
   * Requisitos 7.1, 7.4
   */
  async writeTask(
    input: WriteTaskInput,
  ): Promise<Prisma.TaskGetPayload<NonNullable<unknown>>> {
    const data: Prisma.TaskCreateInput = {
      student: { connect: { id: input.studentId } },
      name: input.name,
      description: input.description ?? null,
      deadline: input.deadline,
    };

    return this.withRetry(() => this.prisma.task.create({ data }));
  }

  /**
   * Crea múltiples MicroObjectives asociados a una Task y una Session.
   * Utiliza `createMany` para insertar en lote con una sola query parametrizada.
   *
   * Requisitos 7.1, 7.4
   */
  async writeMicroObjectives(
    items: WriteMicroObjectiveInput[],
  ): Promise<Prisma.BatchPayload> {
    const data: Prisma.MicroObjectiveCreateManyInput[] = items.map((item) => ({
      taskId: item.taskId,
      sessionId: item.sessionId,
      content: item.content,
      estimatedMinutes: item.estimatedMinutes,
      isAuditOnly: item.isAuditOnly ?? false,
    }));

    return this.withRetry(() =>
      this.prisma.microObjective.createMany({ data }),
    );
  }

  /**
   * Registra una entrada en el log de notificaciones.
   *
   * Requisitos 7.1, 7.5
   */
  async writeNotificationLog(
    input: WriteNotificationLogInput,
  ): Promise<Prisma.NotificationLogGetPayload<NonNullable<unknown>>> {
    const data: Prisma.NotificationLogCreateInput = {
      student: { connect: { id: input.studentId } },
      task: { connect: { id: input.taskId } },
      status: input.status,
      attemptCount: input.attemptCount ?? 0,
      dispatchedAtUtc: input.dispatchedAtUtc,
    };

    return this.withRetry(() =>
      this.prisma.notificationLog.create({ data }),
    );
  }

  // ─── Consulta del dashboard ────────────────────────────────────────────────

  /**
   * Retorna los datos del dashboard para el Student indicado:
   *   - Tasks activas (is_deleted = false) ordenadas por deadline ASC,
   *     cada una con sus MicroObjectives pendientes (is_completed = false).
   *   - Últimas 30 FatigueRecords del Student ordenadas por recordedAtUtc DESC.
   *
   * Todas las consultas usan métodos Prisma tipados (sin SQL dinámico).
   * Requisitos 7.1, 7.3, 7.4
   */
  async readDashboardData(studentId: string): Promise<DashboardData> {
    // Consultas en paralelo para minimizar latencia
    const [rawTasks, rawFatigueRecords] = await Promise.all([
      this.withRetry(() =>
        this.prisma.task.findMany({
          where: {
            studentId,
            isDeleted: false,
          },
          orderBy: { deadline: 'asc' },
          include: {
            microObjectives: {
              where: { isCompleted: false },
              orderBy: { createdAt: 'asc' },
            },
          },
        }),
      ),
      this.withRetry(() =>
        this.prisma.fatigueRecord.findMany({
          where: { studentId },
          orderBy: { recordedAtUtc: 'desc' },
          take: 30,
        }),
      ),
    ]);

    // Mapear Tasks con MicroObjectivos agrupados
    const activeTasks: DashboardTask[] = rawTasks.map((task) => ({
      id: task.id,
      studentId: task.studentId,
      name: task.name,
      description: task.description,
      deadline: task.deadline,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      pendingMicroObjectives: task.microObjectives.map((mo) => ({
        id: mo.id,
        taskId: mo.taskId,
        sessionId: mo.sessionId,
        content: mo.content,
        estimatedMinutes: mo.estimatedMinutes,
        isAuditOnly: mo.isAuditOnly,
        createdAt: mo.createdAt,
      })),
    }));

    // Mapear FatigueRecords
    const last30FatigueRecords: DashboardFatigueRecord[] =
      rawFatigueRecords.map((fr) => ({
        id: fr.id,
        sessionId: fr.sessionId,
        fatigueScore: fr.fatigueScore,
        recordedAtUtc: fr.recordedAtUtc,
      }));

    return { activeTasks, last30FatigueRecords };
  }
}
