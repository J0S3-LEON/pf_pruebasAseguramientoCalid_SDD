/**
 * TaskDecomposerService — Descomposición adaptativa de tareas por fatiga.
 *
 * Responsabilidades:
 *  - shouldDecompose: retorna true si fatigueScore >= 4.
 *  - decompose: invoca el servicio LLM externo vía HTTP usando AI_SERVICE_API_KEY,
 *    parsea la respuesta esperando entre 2 y 7 MicroObjectives con
 *    estimated_minutes <= 25, persiste los MicroObjectives vía PrismaService
 *    y los retorna.
 *  - Fallback: si el LLM falla, lanza BadGatewayException (HTTP 502).
 *
 * Variables de entorno requeridas:
 *  - AI_SERVICE_URL:     URL base del servicio LLM (ej: https://api.openai.com/v1)
 *  - AI_SERVICE_API_KEY: Clave de autenticación para el servicio LLM.
 *
 * Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import {
  Injectable,
  Logger,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ─── Tipos de dominio ─────────────────────────────────────────────────────────

/** Representación mínima de una Task necesaria para descomponer. */
export interface Task {
  id: string;
  name: string;
  description?: string | null;
}

/** MicroObjective tal como lo devuelve decompose() después de persistirlo. */
export interface MicroObjective {
  id: string;
  taskId: string;
  sessionId: string;
  content: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  isAuditOnly: boolean;
  createdAt: Date;
}

/** Forma esperada de cada ítem en la respuesta del LLM. */
interface LlmMicroObjective {
  content: string;
  estimated_minutes: number;
}

/** Forma esperada de la respuesta completa del LLM. */
interface LlmResponse {
  micro_objectives: LlmMicroObjective[];
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class TaskDecomposerService {
  private readonly logger = new Logger(TaskDecomposerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Interfaz pública ─────────────────────────────────────────────────────

  /**
   * Determina si una tarea debe descomponerse según el score de fatiga.
   *
   * Retorna true cuando fatigueScore >= 4, false en caso contrario.
   * Requisito 4.1, 4.2
   */
  shouldDecompose(fatigueScore: number): boolean {
    return fatigueScore >= 4;
  }

  /**
   * Descompone la tarea indicada en MicroObjectives llamando al servicio LLM
   * externo, valida la respuesta (2–7 ítems, estimated_minutes <= 25),
   * persiste los MicroObjectives vía PrismaService y los retorna.
   *
   * Lanza BadGatewayException (HTTP 502) si el LLM falla o la respuesta
   * no cumple los invariantes de cardinalidad/duración.
   *
   * Requisitos: 4.3, 4.4, 4.5
   */
  async decompose(task: Task, sessionId: string): Promise<MicroObjective[]> {
    // 1. Llamar al servicio LLM externo
    const rawObjectives = await this.callLlm(task);

    // 2. Validar invariantes (cardinalidad 2-7, duración <= 25)
    this.validateObjectives(rawObjectives);

    // 3. Persistir en base de datos vía PrismaService — Requisito 4.4
    const created = await this.persistObjectives(rawObjectives, task.id, sessionId);

    return created;
  }

  // ─── Métodos privados ──────────────────────────────────────────────────────

  /**
   * Invoca el servicio LLM externo y devuelve los micro-objetivos crudos.
   * Lanza BadGatewayException si la petición HTTP falla o la respuesta
   * no tiene el formato esperado. — Requisito 4.5
   */
  private async callLlm(task: Task): Promise<LlmMicroObjective[]> {
    const aiUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? 'https://api.openai.com/v1';
    const apiKey = this.config.get<string>('AI_SERVICE_API_KEY')?.trim();
    const isPlaceholderKey =
      !apiKey || /^(your_|change_me|replace)/i.test(apiKey);

    if (!aiUrl || isPlaceholderKey) {
      this.logger.error(
        'AI_SERVICE_URL o AI_SERVICE_API_KEY no están configurados con valores válidos.',
      );
      throw new BadGatewayException(
        'El servicio de IA no está configurado correctamente.',
      );
    }

    const prompt = this.buildPrompt(task);

    let responseJson: LlmResponse;

    try {
      // Usar el fetch nativo de Node.js 18+ (disponible en NestJS con Node >= 18)
      const response = await fetch(`${aiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an academic task decomposer. Respond ONLY with valid JSON matching the schema: {"micro_objectives": [{"content": string, "estimated_minutes": number}]}. Generate between 2 and 7 micro-objectives, each with estimated_minutes <= 25.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const requestId = response.headers.get('x-request-id');
        this.logger.error(
          `LLM respondió con HTTP ${response.status}${requestId ? ` (request_id=${requestId})` : ''}.`,
        );
        throw new BadGatewayException(
          `El servicio de IA respondió con error HTTP ${response.status}.`,
        );
      }

      // Parsear la respuesta de la API del LLM (formato OpenAI-compatible)
      const apiResponse = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = apiResponse?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('La respuesta del LLM no contiene contenido.');
      }

      responseJson = JSON.parse(content) as LlmResponse;
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error(
        `Error al invocar el servicio LLM: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        'El servicio de IA no está disponible. Intente de nuevo más tarde.',
      );
    }

    // Verificar estructura básica de la respuesta
    if (
      !responseJson ||
      !Array.isArray(responseJson.micro_objectives) ||
      responseJson.micro_objectives.length === 0
    ) {
      this.logger.error(
        'La respuesta del LLM no contiene micro_objectives válidos.',
      );
      throw new BadGatewayException(
        'El servicio de IA devolvió una respuesta con formato inválido.',
      );
    }

    return responseJson.micro_objectives;
  }

  /**
   * Valida que los micro-objetivos cumplen los invariantes del dominio:
   *  - Cardinalidad: entre 2 y 7 ítems — Requisito 4.3
   *  - Duración: estimated_minutes <= 25 y > 0 — Requisito 4.3
   *
   * Lanza BadGatewayException si alguna restricción no se cumple.
   */
  private validateObjectives(objectives: LlmMicroObjective[]): void {
    if (objectives.length < 2 || objectives.length > 7) {
      this.logger.error(
        `Cardinalidad inválida: el LLM generó ${objectives.length} micro-objetivos (esperado: 2-7).`,
      );
      throw new BadGatewayException(
        `El servicio de IA generó ${objectives.length} micro-objetivos, pero se esperaban entre 2 y 7.`,
      );
    }

    for (const obj of objectives) {
      if (
        typeof obj.estimated_minutes !== 'number' ||
        obj.estimated_minutes <= 0 ||
        obj.estimated_minutes > 25
      ) {
        this.logger.error(
          `Duración inválida en micro-objetivo: estimated_minutes=${obj.estimated_minutes}`,
        );
        throw new BadGatewayException(
          'El servicio de IA generó un micro-objetivo con duración fuera del rango permitido (1-25 minutos).',
        );
      }

      if (typeof obj.content !== 'string' || obj.content.trim().length === 0) {
        this.logger.error('Micro-objetivo con contenido vacío o inválido.');
        throw new BadGatewayException(
          'El servicio de IA generó un micro-objetivo sin contenido.',
        );
      }
    }
  }

  /**
   * Persiste los MicroObjectives en la base de datos usando PrismaService
   * con createMany para inserción en lote. — Requisito 4.4
   *
   * Retorna los registros creados con todos los campos.
   */
  private async persistObjectives(
    objectives: LlmMicroObjective[],
    taskId: string,
    sessionId: string,
  ): Promise<MicroObjective[]> {
    const data: Prisma.MicroObjectiveCreateManyInput[] = objectives.map(
      (obj) => ({
        taskId,
        sessionId,
        content: obj.content.trim(),
        estimatedMinutes: obj.estimated_minutes,
        isCompleted: false,
        isAuditOnly: false,
      }),
    );

    await this.prisma.microObjective.createMany({ data });

    // Recuperar los registros recién creados para devolver IDs y timestamps
    const created = await this.prisma.microObjective.findMany({
      where: { taskId, sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return created.map((mo) => ({
      id: mo.id,
      taskId: mo.taskId,
      sessionId: mo.sessionId,
      content: mo.content,
      estimatedMinutes: mo.estimatedMinutes,
      isCompleted: mo.isCompleted,
      isAuditOnly: mo.isAuditOnly,
      createdAt: mo.createdAt,
    }));
  }

  /**
   * Construye el prompt que se envía al LLM con el contexto de la tarea.
   */
  private buildPrompt(task: Task): string {
    const description = task.description?.trim()
      ? `\nDescription: ${task.description.trim()}`
      : '';

    return (
      `Decompose the following academic task into 2-7 micro-objectives.\n` +
      `Each micro-objective must be actionable, specific, and completable in 25 minutes or less.\n\n` +
      `Task name: ${task.name}${description}\n\n` +
      `Return ONLY a JSON object with this exact structure:\n` +
      `{"micro_objectives": [{"content": "...", "estimated_minutes": <integer 1-25>}]}`
    );
  }
}
