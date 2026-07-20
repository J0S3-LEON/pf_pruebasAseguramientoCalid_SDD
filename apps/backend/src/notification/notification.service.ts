/**
 * NotificationService — Lógica del Notification_Service.
 *
 * Responsabilidades:
 *  - dispatchReminders(): cron job cada hora que busca Tasks con deadline
 *    dentro de las próximas 24 horas y con MicroObjectives pendientes,
 *    respetando: supresión durante Session activa, límite de 3 notificaciones
 *    por Student por ventana de 24 horas, y lógica de reintentos (≤ 3 intentos).
 *  - suppressDuringSession(): verifica si el Student tiene Session activa.
 *  - getDispatchCount(): cuenta notificaciones en una ventana temporal.
 *
 * Cada evento de notificación se persiste via PrismaService en < 3 segundos.
 *
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Número máximo de intentos de entrega antes de marcar como failed. */
const MAX_ATTEMPTS = 3;

/** Límite de notificaciones despachadas por Student en 24 horas. */
const MAX_NOTIFICATIONS_PER_DAY = 3;

/** Ventana de tiempo para el cálculo del límite de frecuencia (horas). */
const FREQUENCY_WINDOW_HOURS = 24;

/** Ventana para detectar Tasks con deadline próximo (horas). */
const DEADLINE_WINDOW_HOURS = 24;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job que se ejecuta cada hora.
   * Busca Tasks con deadline dentro de las próximas 24 horas que tengan
   * MicroObjectives pendientes y despacha notificaciones si corresponde.
   *
   * Flujo por Student+Task:
   *   1. Si el Student tiene Session activa → persistir como 'suppressed', saltar.
   *   2. Si el Student ya recibió ≥ MAX_NOTIFICATIONS_PER_DAY notif. 'sent' en
   *      las últimas 24 h → saltar sin persistir (límite de frecuencia).
   *   3. Buscar log existente en estado 'pending' o 'failed' (< MAX_ATTEMPTS) para
   *      el mismo Student+Task o crear uno nuevo con status 'pending'.
   *   4. Intentar "despachar" (actualmente registra el evento; se puede extender
   *      a push/email). Si tiene éxito → marcar 'sent'. Si falla → incrementar
   *      attempt_count; al llegar a MAX_ATTEMPTS marcar 'failed'.
   *
   * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  @Cron(CronExpression.EVERY_HOUR)
  async dispatchReminders(): Promise<void> {
    this.logger.log('Iniciando cron job de notificaciones...');

    const now = new Date();
    const deadlineLimit = new Date(
      now.getTime() + DEADLINE_WINDOW_HOURS * 60 * 60 * 1000,
    );

    // Buscar Tasks elegibles: no eliminadas, deadline dentro de las próximas 24 h,
    // con al menos un MicroObjective pendiente (is_completed = false).
    const eligibleTasks = await this.prisma.task.findMany({
      where: {
        isDeleted: false,
        deadline: {
          gte: now,
          lte: deadlineLimit,
        },
        microObjectives: {
          some: {
            isCompleted: false,
            isAuditOnly: false,
          },
        },
      },
      include: {
        student: true,
      },
    });

    this.logger.log(`Tasks elegibles encontradas: ${eligibleTasks.length}`);

    for (const task of eligibleTasks) {
      try {
        await this.processTaskNotification(task.studentId, task.id, now);
      } catch (err) {
        this.logger.error(
          `Error procesando notificación para task ${task.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log('Cron job de notificaciones completado.');
  }

  /**
   * Procesa la lógica de notificación para un par (studentId, taskId).
   * Toda la lógica de supresión, límite de frecuencia y reintento está aquí.
   *
   * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async processTaskNotification(
    studentId: string,
    taskId: string,
    now: Date,
  ): Promise<void> {
    // ── Requisito 6.4: Suprimir si hay Session activa ────────────────────────
    const suppressed = await this.suppressDuringSession(studentId);
    if (suppressed) {
      await this.persistNotificationLog({
        studentId,
        taskId,
        status: 'suppressed',
        attemptCount: 0,
        dispatchedAtUtc: now,
      });
      this.logger.debug(
        `Notificación suprimida para student ${studentId} (session activa).`,
      );
      return;
    }

    // ── Requisito 6.5: Límite de frecuencia (≤ 3 notif. en 24 h) ────────────
    const dispatchCount = await this.getDispatchCount(
      studentId,
      FREQUENCY_WINDOW_HOURS,
    );
    if (dispatchCount >= MAX_NOTIFICATIONS_PER_DAY) {
      this.logger.debug(
        `Límite de frecuencia alcanzado para student ${studentId} (${dispatchCount}/${MAX_NOTIFICATIONS_PER_DAY}).`,
      );
      return;
    }

    // ── Buscar log existente pendiente/reintentable para este par ───────────
    const windowStart = new Date(
      now.getTime() - FREQUENCY_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const existingLog = await this.prisma.notificationLog.findFirst({
      where: {
        studentId,
        taskId,
        status: { in: ['pending', 'failed'] },
        attemptCount: { lt: MAX_ATTEMPTS },
        dispatchedAtUtc: { gte: windowStart },
      },
      orderBy: { dispatchedAtUtc: 'asc' },
    });

    // ── Requisito 6.3: Si ya hubo 3 intentos fallidos, no reintentamos ───────
    if (existingLog && existingLog.attemptCount >= MAX_ATTEMPTS) {
      this.logger.debug(
        `Máximo de intentos alcanzado para task ${taskId}, student ${studentId}.`,
      );
      return;
    }

    const currentAttempt = existingLog
      ? existingLog.attemptCount + 1
      : 1;

    // ── Intentar despachar la notificación ───────────────────────────────────
    let deliverySuccess = false;
    try {
      deliverySuccess = await this.deliver(studentId, taskId);
    } catch {
      deliverySuccess = false;
    }

    if (deliverySuccess) {
      // ── Éxito: persistir o actualizar como 'sent' — Requisito 6.2 ─────────
      if (existingLog) {
        await this.prisma.notificationLog.update({
          where: { id: existingLog.id },
          data: {
            status: 'sent',
            attemptCount: currentAttempt,
            dispatchedAtUtc: now,
          },
        });
      } else {
        await this.persistNotificationLog({
          studentId,
          taskId,
          status: 'sent',
          attemptCount: currentAttempt,
          dispatchedAtUtc: now,
        });
      }
      this.logger.log(
        `Notificación enviada para task ${taskId}, student ${studentId} (intento ${currentAttempt}).`,
      );
    } else {
      // ── Fallo: incrementar intento ───────────────────────────────────────
      const newStatus = currentAttempt >= MAX_ATTEMPTS ? 'failed' : 'pending';

      if (existingLog) {
        await this.prisma.notificationLog.update({
          where: { id: existingLog.id },
          data: {
            status: newStatus,
            attemptCount: currentAttempt,
          },
        });
      } else {
        await this.persistNotificationLog({
          studentId,
          taskId,
          status: newStatus,
          attemptCount: currentAttempt,
          dispatchedAtUtc: now,
        });
      }

      if (newStatus === 'failed') {
        // ── Requisito 6.3: Marcar failed y cesar reintentos ──────────────
        this.logger.warn(
          `Notificación marcada como failed tras ${currentAttempt} intentos para task ${taskId}, student ${studentId}.`,
        );
      } else {
        this.logger.debug(
          `Intento ${currentAttempt}/${MAX_ATTEMPTS} fallido para task ${taskId}, student ${studentId}.`,
        );
      }
    }
  }

  /**
   * Verifica si el Student tiene una Session con is_active = true.
   * Retorna true si debe suprimirse la notificación.
   *
   * Requisito 6.4
   */
  async suppressDuringSession(studentId: string): Promise<boolean> {
    const activeSession = await this.prisma.session.findFirst({
      where: {
        studentId,
        isActive: true,
      },
    });
    return activeSession !== null;
  }

  /**
   * Cuenta las notificaciones con status 'sent' del Student en las últimas
   * `windowHours` horas.
   *
   * Requisito 6.5
   */
  async getDispatchCount(
    studentId: string,
    windowHours: number,
  ): Promise<number> {
    const windowStart = new Date(
      Date.now() - windowHours * 60 * 60 * 1000,
    );
    return this.prisma.notificationLog.count({
      where: {
        studentId,
        status: 'sent',
        dispatchedAtUtc: { gte: windowStart },
      },
    });
  }

  /**
   * Persiste un registro de notificación en la base de datos via PrismaService.
   * Toda la escritura debe completarse en < 3 segundos — Requisito 6.2.
   */
  private async persistNotificationLog(data: {
    studentId: string;
    taskId: string;
    status: string;
    attemptCount: number;
    dispatchedAtUtc: Date;
  }): Promise<void> {
    await this.prisma.notificationLog.create({ data });
  }

  /**
   * Simula el despacho real de la notificación.
   * En producción, aquí se invocaría un servicio de push/email/WebSocket.
   * Retorna true en éxito, false en fallo.
   *
   * Actualmente registra el evento (log) y retorna true como despacho exitoso.
   */
  private async deliver(studentId: string, taskId: string): Promise<boolean> {
    // Placeholder: en producción, aquí va la lógica real de envío (push, email, WS).
    this.logger.debug(
      `[deliver] Notificación despachada → student: ${studentId}, task: ${taskId}`,
    );
    return true;
  }
}
