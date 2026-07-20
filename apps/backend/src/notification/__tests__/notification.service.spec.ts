/**
 * Unit tests for NotificationService.
 *
 * Test 1 (Req 6.3): After exactly 3 delivery failures the notification log
 *   must have status 'failed'.
 *
 * Test 2 (Req 6.4): suppressDuringSession returns true when the student
 *   has an active session (is_active = true).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from '../notification.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface LogRecord {
  id: string;
  studentId: string;
  taskId: string;
  status: string;
  attemptCount: number;
  dispatchedAtUtc: Date;
  updatedAt: Date;
}

/** Builds a minimal in-memory PrismaService mock. */
function buildPrismaMock(options: {
  hasActiveSession: boolean;
  existingLog?: Partial<LogRecord> | null;
}): { prisma: Partial<PrismaService>; logs: LogRecord[] } {
  const logs: LogRecord[] = [];
  let idCounter = 0;

  // Seed with an existing log if provided
  if (options.existingLog) {
    logs.push({
      id: options.existingLog.id ?? 'log-seed-1',
      studentId: options.existingLog.studentId ?? 'student-1',
      taskId: options.existingLog.taskId ?? 'task-1',
      status: options.existingLog.status ?? 'pending',
      attemptCount: options.existingLog.attemptCount ?? 0,
      dispatchedAtUtc: options.existingLog.dispatchedAtUtc ?? new Date(),
      updatedAt: new Date(),
    });
  }

  const prisma: Partial<PrismaService> = {
    session: {
      findFirst: jest.fn(async () =>
        options.hasActiveSession ? { id: 'session-1', isActive: true } : null,
      ),
    } as unknown as PrismaService['session'],

    notificationLog: {
      create: jest.fn(async ({ data }: { data: Omit<LogRecord, 'id' | 'updatedAt'> }) => {
        const entry: LogRecord = {
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
          data: Partial<LogRecord>;
        }) => {
          const idx = logs.findIndex((l) => l.id === where.id);
          if (idx !== -1) {
            logs[idx] = { ...logs[idx], ...data, updatedAt: new Date() };
            return logs[idx];
          }
          throw new Error(`Log not found: ${where.id}`);
        },
      ),

      count: jest.fn(async () => 0), // always under the daily limit

      findFirst: jest.fn(async () => {
        // Return the first seeded log (pending/failed with attemptCount < 3)
        const candidate = logs.find(
          (l) =>
            ['pending', 'failed'].includes(l.status) && l.attemptCount < 3,
        );
        return candidate ?? null;
      }),
    } as unknown as PrismaService['notificationLog'],
  };

  return { prisma, logs };
}

/** Instantiates the NotificationService with the given prisma mock. */
async function buildService(
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

  jest
    .spyOn(service as unknown as { deliver: () => Promise<boolean> }, 'deliver')
    .mockResolvedValue(deliverSucceeds);

  return { service, moduleRef };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationService — Unit tests', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Test 1: Req 6.3 ────────────────────────────────────────────────────────
  describe('Req 6.3 — Failed status after 3 delivery attempts', () => {
    it('marks the notification log as "failed" after exactly 3 failed delivery attempts', async () => {
      const studentId = 'student-unit-1';
      const taskId = 'task-unit-1';
      const now = new Date();

      // Start with a fresh mock (no existing log, delivery always fails)
      const { prisma, logs } = buildPrismaMock({ hasActiveSession: false });
      const { service, moduleRef } = await buildService(prisma, false);

      // Attempt 1 — expect status 'pending' (1 < 3)
      await service.processTaskNotification(studentId, taskId, now);
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('pending');
      expect(logs[0].attemptCount).toBe(1);

      // Attempt 2 — reuses the existing 'pending' log; still < 3 attempts
      await service.processTaskNotification(studentId, taskId, now);
      expect(logs).toHaveLength(1); // same record updated
      expect(logs[0].status).toBe('pending');
      expect(logs[0].attemptCount).toBe(2);

      // Attempt 3 — reaches MAX_ATTEMPTS → status must be 'failed'
      await service.processTaskNotification(studentId, taskId, now);
      expect(logs).toHaveLength(1); // still same record
      expect(logs[0].status).toBe('failed');
      expect(logs[0].attemptCount).toBe(3);

      await moduleRef.close();
    });
  });

  // ── Test 2: Req 6.4 ────────────────────────────────────────────────────────
  describe('Req 6.4 — suppressDuringSession', () => {
    it('returns true when the student has an active session (is_active = true)', async () => {
      const studentId = 'student-unit-2';

      // Mock returns an active session
      const { prisma } = buildPrismaMock({
        hasActiveSession: true,
      });

      const moduleRef = await Test.createTestingModule({
        imports: [ScheduleModule.forRoot()],
        providers: [
          NotificationService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const service = moduleRef.get<NotificationService>(NotificationService);

      const result = await service.suppressDuringSession(studentId);

      expect(result).toBe(true);

      // Verify Prisma was called with the correct filter
      expect(
        (prisma.session!.findFirst as jest.Mock).mock.calls[0][0],
      ).toMatchObject({
        where: { studentId, isActive: true },
      });

      await moduleRef.close();
    });

    it('returns false when the student has no active session', async () => {
      const studentId = 'student-unit-3';

      const { prisma } = buildPrismaMock({ hasActiveSession: false });

      const moduleRef = await Test.createTestingModule({
        imports: [ScheduleModule.forRoot()],
        providers: [
          NotificationService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const service = moduleRef.get<NotificationService>(NotificationService);

      const result = await service.suppressDuringSession(studentId);

      expect(result).toBe(false);

      await moduleRef.close();
    });
  });
});
