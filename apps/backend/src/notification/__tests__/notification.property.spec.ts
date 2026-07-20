/**
 * Property-based tests for the Notification_Service.
 *
 * Property 18: Registro Exhaustivo de Notificaciones
 *   FOR ALL notifications processed (sent, failed or suppressed),
 *   exactly one record SHALL exist in notification_logs with
 *   dispatched_at_utc and a valid delivery_status.
 *
 * **Validates: Requisito 6.2**
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from '../notification.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Valid delivery statuses as per schema ────────────────────────────────────
const VALID_STATUSES = ['pending', 'sent', 'failed', 'suppressed'] as const;
type DeliveryStatus = (typeof VALID_STATUSES)[number];

// ─── In-memory store types ────────────────────────────────────────────────────

interface StoredLog {
  id: string;
  studentId: string;
  taskId: string;
  status: string;
  attemptCount: number;
  dispatchedAtUtc: Date;
  updatedAt: Date;
}

// ─── In-memory Prisma mock factory ────────────────────────────────────────────

function createInMemoryPrisma(options: {
  hasActiveSession: boolean;
  sentCountInWindow: number;
  deliverSucceeds: boolean;
}): {
  prisma: Partial<PrismaService>;
  logs: StoredLog[];
} {
  const logs: StoredLog[] = [];
  let idCounter = 0;

  const prisma: Partial<PrismaService> = {
    // session.findFirst — drives suppression logic
    session: {
      findFirst: jest.fn(async () =>
        options.hasActiveSession ? { id: 'session-1', isActive: true } : null,
      ),
    } as unknown as PrismaService['session'],

    // notificationLog — create, update, count, findFirst
    notificationLog: {
      create: jest.fn(async ({ data }: { data: Omit<StoredLog, 'id' | 'updatedAt'> }) => {
        const entry: StoredLog = {
          id: `log-${++idCounter}`,
          ...data,
          updatedAt: new Date(),
        };
        logs.push(entry);
        return entry;
      }),

      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<StoredLog>;
        }) => {
          const idx = logs.findIndex((l) => l.id === where.id);
          if (idx !== -1) {
            logs[idx] = { ...logs[idx], ...data, updatedAt: new Date() };
            return logs[idx];
          }
          throw new Error(`Log not found: ${where.id}`);
        },
      ),

      count: jest.fn(async () => options.sentCountInWindow),

      findFirst: jest.fn(async () => null), // No pending/failed log → always new
    } as unknown as PrismaService['notificationLog'],
  };

  return { prisma, logs };
}

// ─── Build NotificationService ────────────────────────────────────────────────

async function buildNotificationService(
  prisma: Partial<PrismaService>,
  deliverSucceeds: boolean,
): Promise<{ service: NotificationService; moduleRef: TestingModule }> {
  const moduleRef = await Test.createTestingModule({
    imports: [ScheduleModule.forRoot()],
    providers: [
      NotificationService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  const service = moduleRef.get<NotificationService>(NotificationService);

  // Override the private `deliver` method to control success/failure
  jest
    .spyOn(service as unknown as { deliver: () => Promise<boolean> }, 'deliver')
    .mockResolvedValue(deliverSucceeds);

  return { service, moduleRef };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-empty UUID-like string identifier. */
const idArb = fc.uuid();

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('NotificationService — Property 18: Registro Exhaustivo de Notificaciones', () => {
  /**
   * Validates: Requisito 6.2
   *
   * For every processed notification (sent, failed, or suppressed),
   * exactly ONE record must exist in notification_logs with:
   *   - dispatched_at_utc set to a Date instance
   *   - delivery_status (status field) that is one of the valid values
   */

  it('P18 — suppressed: exactly one log record with valid status and dispatched_at_utc', async () => {
    await fc.assert(
      fc.asyncProperty(idArb, idArb, async (studentId, taskId) => {
        const { prisma, logs } = createInMemoryPrisma({
          hasActiveSession: true, // triggers suppression
          sentCountInWindow: 0,
          deliverSucceeds: true,
        });

        const { service, moduleRef } = await buildNotificationService(prisma, true);

        const now = new Date();
        await service.processTaskNotification(studentId, taskId, now);

        // Exactly one record created
        const studentTaskLogs = logs.filter(
          (l) => l.studentId === studentId && l.taskId === taskId,
        );
        expect(studentTaskLogs).toHaveLength(1);

        const [log] = studentTaskLogs;

        // dispatched_at_utc must be a valid Date
        expect(log.dispatchedAtUtc).toBeInstanceOf(Date);
        expect(isNaN(log.dispatchedAtUtc.getTime())).toBe(false);

        // status must be a valid delivery status
        expect(VALID_STATUSES).toContain(log.status as DeliveryStatus);
        expect(log.status).toBe('suppressed');

        await moduleRef.close();
      }),
      { numRuns: 5 },
    );
  });

  it('P18 — sent: exactly one log record with valid status and dispatched_at_utc', async () => {
    await fc.assert(
      fc.asyncProperty(idArb, idArb, async (studentId, taskId) => {
        const { prisma, logs } = createInMemoryPrisma({
          hasActiveSession: false,
          sentCountInWindow: 0, // under the daily limit
          deliverSucceeds: true, // delivery succeeds → 'sent'
        });

        const { service, moduleRef } = await buildNotificationService(prisma, true);

        const now = new Date();
        await service.processTaskNotification(studentId, taskId, now);

        const studentTaskLogs = logs.filter(
          (l) => l.studentId === studentId && l.taskId === taskId,
        );
        expect(studentTaskLogs).toHaveLength(1);

        const [log] = studentTaskLogs;

        expect(log.dispatchedAtUtc).toBeInstanceOf(Date);
        expect(isNaN(log.dispatchedAtUtc.getTime())).toBe(false);

        expect(VALID_STATUSES).toContain(log.status as DeliveryStatus);
        expect(log.status).toBe('sent');

        await moduleRef.close();
      }),
      { numRuns: 5 },
    );
  });

  it('P18 — failed: exactly one log record with valid status and dispatched_at_utc', async () => {
    await fc.assert(
      fc.asyncProperty(idArb, idArb, async (studentId, taskId) => {
        const { prisma, logs } = createInMemoryPrisma({
          hasActiveSession: false,
          sentCountInWindow: 0,
          deliverSucceeds: false, // delivery fails → 'pending' or 'failed'
        });

        const { service, moduleRef } = await buildNotificationService(prisma, false);

        const now = new Date();
        await service.processTaskNotification(studentId, taskId, now);

        const studentTaskLogs = logs.filter(
          (l) => l.studentId === studentId && l.taskId === taskId,
        );
        expect(studentTaskLogs).toHaveLength(1);

        const [log] = studentTaskLogs;

        expect(log.dispatchedAtUtc).toBeInstanceOf(Date);
        expect(isNaN(log.dispatchedAtUtc.getTime())).toBe(false);

        expect(VALID_STATUSES).toContain(log.status as DeliveryStatus);
        // First attempt failure → 'pending' (attempt 1 of 3); only after MAX_ATTEMPTS → 'failed'
        expect(['pending', 'failed']).toContain(log.status);

        await moduleRef.close();
      }),
      { numRuns: 5 },
    );
  });

  it('P18 — FOR ALL combinations of session/delivery state: exactly one log exists per processed notification', async () => {
    /**
     * Exhaustive property: for any combination of (hasActiveSession, deliverSucceeds),
     * as long as the notification is NOT dropped by the frequency limit,
     * exactly one log record is created.
     */
    await fc.assert(
      fc.asyncProperty(
        idArb,
        idArb,
        fc.boolean(), // hasActiveSession
        fc.boolean(), // deliverSucceeds
        async (studentId, taskId, hasActiveSession, deliverSucceeds) => {
          const { prisma, logs } = createInMemoryPrisma({
            hasActiveSession,
            sentCountInWindow: 0, // always under limit so log is always written
            deliverSucceeds,
          });

          const { service, moduleRef } = await buildNotificationService(
            prisma,
            deliverSucceeds,
          );

          const now = new Date();
          await service.processTaskNotification(studentId, taskId, now);

          const studentTaskLogs = logs.filter(
            (l) => l.studentId === studentId && l.taskId === taskId,
          );

          // Exactly ONE record must have been created
          expect(studentTaskLogs).toHaveLength(1);

          const [log] = studentTaskLogs;

          // dispatched_at_utc must be a real date
          expect(log.dispatchedAtUtc).toBeInstanceOf(Date);
          expect(isNaN(log.dispatchedAtUtc.getTime())).toBe(false);

          // status must be a valid delivery status
          expect(VALID_STATUSES).toContain(log.status as DeliveryStatus);

          await moduleRef.close();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('P18 — frequency-limited: no log record created when daily limit is reached', async () => {
    /**
     * When sentCountInWindow >= MAX_NOTIFICATIONS_PER_DAY (3),
     * the service returns early without writing any log.
     * This is NOT a processed notification — it is silently skipped.
     * So exactly ZERO records must exist.
     */
    await fc.assert(
      fc.asyncProperty(
        idArb,
        idArb,
        fc.integer({ min: 3, max: 10 }),
        async (studentId, taskId, sentCount) => {
          const { prisma, logs } = createInMemoryPrisma({
            hasActiveSession: false,
            sentCountInWindow: sentCount, // at or above limit
            deliverSucceeds: true,
          });

          const { service, moduleRef } = await buildNotificationService(prisma, true);

          const now = new Date();
          await service.processTaskNotification(studentId, taskId, now);

          const studentTaskLogs = logs.filter(
            (l) => l.studentId === studentId && l.taskId === taskId,
          );

          // No record should be created (silent skip, not a processed notification)
          expect(studentTaskLogs).toHaveLength(0);

          await moduleRef.close();
        },
      ),
      { numRuns: 5 },
    );
  });
});
