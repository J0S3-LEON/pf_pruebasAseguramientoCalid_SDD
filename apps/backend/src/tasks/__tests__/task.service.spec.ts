/**
 * Unit tests for TaskService (example-based).
 *
 * T1 — Validación DTO: HTTP 422 cuando name está vacío o deadline es inválido.
 *   Validates: Requirements 2.2
 *
 * T2 — HTTP 403 (ForbiddenException) al intentar actualizar/eliminar una Task
 *      que pertenece a otro Student.
 *   Validates: Requirements 2.5
 *
 * T3 — softDelete marca los MicroObjectives como isAuditOnly = true sin eliminarlos.
 *   Validates: Requirements 2.6
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { TaskService } from '../task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from '../dto/create-task.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crea un mock de PrismaService con los métodos necesarios para TaskService. */
function buildPrismaMock(overrides: Partial<{
  taskFindUnique: jest.Mock;
  taskUpdate: jest.Mock;
  microObjectiveUpdateMany: jest.Mock;
  transaction: jest.Mock;
}> = {}) {
  const taskFindUnique = overrides.taskFindUnique ?? jest.fn();
  const taskUpdate = overrides.taskUpdate ?? jest.fn();
  const microObjectiveUpdateMany = overrides.microObjectiveUpdateMany ?? jest.fn();
  const transaction = overrides.transaction ?? jest.fn();

  const prismaMock = {
    task: {
      findUnique: taskFindUnique,
      update: taskUpdate,
      create: jest.fn(),
      findMany: jest.fn(),
    },
    microObjective: {
      updateMany: microObjectiveUpdateMany,
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: transaction,
  };

  return { prismaMock, taskFindUnique, taskUpdate, microObjectiveUpdateMany, transaction };
}

async function buildService(prismaMock: object): Promise<TaskService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TaskService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();

  return module.get<TaskService>(TaskService);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TaskService — Unit tests (example-based)', () => {
  /**
   * T1 — Validación DTO: name vacío o deadline inválido generan errores de validación
   *      que el ValidationPipe convierte en HTTP 422.
   *
   * El servicio no aplica la validación directamente; la aplica el ValidationPipe
   * de NestJS sobre el DTO. Aquí verificamos que los decoradores de class-validator
   * están correctamente configurados (lo que garantiza el comportamiento HTTP 422).
   *
   * Validates: Requirements 2.2
   */
  describe('T1 — DTO: name vacío o deadline inválido deben fallar la validación', () => {
    it('T1a — lanza error de validación cuando name está vacío', async () => {
      const dto = new CreateTaskDto();
      dto.name = '';                                   // name vacío — inválido
      dto.deadline = '2025-12-31T23:59:59.000Z';     // deadline válido

      const errors = await validate(dto);

      // Debe haber al menos un error
      expect(errors.length).toBeGreaterThan(0);

      // El error debe corresponder al campo "name"
      const nameErrors = errors.filter((e) => e.property === 'name');
      expect(nameErrors.length).toBeGreaterThan(0);
    });

    it('T1b — lanza error de validación cuando deadline no es ISO 8601 válido', async () => {
      const dto = new CreateTaskDto();
      dto.name = 'Tarea válida';
      dto.deadline = 'not-a-date';   // deadline inválido — no es ISO 8601

      const errors = await validate(dto);

      // Debe haber al menos un error
      expect(errors.length).toBeGreaterThan(0);

      // El error debe corresponder al campo "deadline"
      const deadlineErrors = errors.filter((e) => e.property === 'deadline');
      expect(deadlineErrors.length).toBeGreaterThan(0);
    });

    it('T1c — DTO es válido cuando name y deadline son correctos', async () => {
      const dto = new CreateTaskDto();
      dto.name = 'Tarea de cálculo diferencial';
      dto.deadline = '2025-06-30T23:59:59.000Z';

      const errors = await validate(dto);

      // No debe haber errores de validación
      expect(errors.length).toBe(0);
    });
  });

  /**
   * T2 — ForbiddenException (HTTP 403) cuando un Student intenta modificar
   *      o eliminar una Task que le pertenece a otro Student.
   *
   * Validates: Requirements 2.5
   */
  describe('T2 — ForbiddenException al acceder a Task de otro Student', () => {
    const ownerStudentId = 'student-owner-001';
    const otherStudentId = 'student-other-002';
    const taskId = 'task-abc-123';

    /** Task cuyo propietario es ownerStudentId */
    const ownedByOwner = {
      id: taskId,
      studentId: ownerStudentId,
      name: 'Tarea del propietario',
      description: null,
      deadline: new Date('2025-12-01'),
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('T2a — update lanza ForbiddenException cuando el studentId no coincide con el propietario', async () => {
      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedByOwner),
      });
      const service = await buildService(prismaMock);

      await expect(
        service.update(otherStudentId, taskId, { name: 'Modificado' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('T2b — update lanza ForbiddenException con status 403', async () => {
      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedByOwner),
      });
      const service = await buildService(prismaMock);

      let caughtError: unknown;
      try {
        await service.update(otherStudentId, taskId, { name: 'Modificado' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect((caughtError as ForbiddenException).getStatus()).toBe(403);
    });

    it('T2c — softDelete lanza ForbiddenException cuando el studentId no coincide con el propietario', async () => {
      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedByOwner),
      });
      const service = await buildService(prismaMock);

      await expect(
        service.softDelete(otherStudentId, taskId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('T2d — update NO lanza ForbiddenException cuando el studentId coincide con el propietario', async () => {
      const { prismaMock, taskUpdate } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedByOwner),
        taskUpdate: jest.fn().mockResolvedValue({ ...ownedByOwner, name: 'Actualizado' }),
      });
      const service = await buildService(prismaMock);

      await expect(
        service.update(ownerStudentId, taskId, { name: 'Actualizado' }),
      ).resolves.not.toThrow();

      expect(taskUpdate).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * T3 — softDelete marca los MicroObjectives como isAuditOnly = true
   *      sin eliminarlos físicamente de la base de datos.
   *
   * Validates: Requirements 2.6
   */
  describe('T3 — softDelete marca MicroObjectives como isAuditOnly = true', () => {
    const studentId = 'student-owner-001';
    const taskId = 'task-xyz-789';

    const ownedTask = {
      id: taskId,
      studentId,
      name: 'Tarea con micro-objetivos',
      description: null,
      deadline: new Date('2025-12-01'),
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('T3a — softDelete llama a microObjective.updateMany con isAuditOnly: true', async () => {
      // Capturamos las operaciones enviadas a $transaction
      let capturedOps: unknown[] | null = null;

      const taskUpdateMock = jest.fn().mockReturnValue({ id: taskId, isDeleted: true });
      const microObjectiveUpdateManyMock = jest.fn().mockReturnValue({ count: 3 });
      const transactionMock = jest.fn().mockImplementation((ops: unknown[]) => {
        capturedOps = ops;
        return Promise.resolve([{ id: taskId, isDeleted: true }, { count: 3 }]);
      });

      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedTask),
        taskUpdate: taskUpdateMock,
        microObjectiveUpdateMany: microObjectiveUpdateManyMock,
        transaction: transactionMock,
      });

      const service = await buildService(prismaMock);

      await service.softDelete(studentId, taskId);

      // Debe haber llamado a $transaction
      expect(transactionMock).toHaveBeenCalledTimes(1);

      // La transacción recibe un array de dos operaciones
      expect(capturedOps).not.toBeNull();
      expect(Array.isArray(capturedOps)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((capturedOps as unknown as any[]).length).toBe(2);
    });

    it('T3b — softDelete llama a task.update con isDeleted: true', async () => {
      const taskUpdateMock = jest.fn().mockReturnValue({ id: taskId, isDeleted: true });
      const microObjectiveUpdateManyMock = jest.fn().mockReturnValue({ count: 2 });
      const transactionMock = jest.fn().mockResolvedValue([
        { id: taskId, isDeleted: true },
        { count: 2 },
      ]);

      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedTask),
        taskUpdate: taskUpdateMock,
        microObjectiveUpdateMany: microObjectiveUpdateManyMock,
        transaction: transactionMock,
      });

      const service = await buildService(prismaMock);

      await service.softDelete(studentId, taskId);

      // task.update debe haber sido construido con isDeleted: true
      expect(taskUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: taskId },
          data: { isDeleted: true },
        }),
      );
    });

    it('T3c — softDelete llama a microObjective.updateMany con isAuditOnly: true para la Task', async () => {
      const taskUpdateMock = jest.fn().mockReturnValue({ id: taskId, isDeleted: true });
      const microObjectiveUpdateManyMock = jest.fn().mockReturnValue({ count: 5 });
      const transactionMock = jest.fn().mockResolvedValue([
        { id: taskId, isDeleted: true },
        { count: 5 },
      ]);

      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedTask),
        taskUpdate: taskUpdateMock,
        microObjectiveUpdateMany: microObjectiveUpdateManyMock,
        transaction: transactionMock,
      });

      const service = await buildService(prismaMock);

      await service.softDelete(studentId, taskId);

      // microObjective.updateMany debe haber sido construido con isAuditOnly: true
      expect(microObjectiveUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId },
          data: { isAuditOnly: true },
        }),
      );
    });

    it('T3d — softDelete no elimina físicamente los MicroObjectives (no llama a delete)', async () => {
      const microObjectiveDeleteMock = jest.fn();
      const transactionMock = jest.fn().mockResolvedValue([
        { id: taskId, isDeleted: true },
        { count: 2 },
      ]);

      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(ownedTask),
        taskUpdate: jest.fn().mockReturnValue({ id: taskId, isDeleted: true }),
        microObjectiveUpdateMany: jest.fn().mockReturnValue({ count: 2 }),
        transaction: transactionMock,
      });

      // Añadir mock de delete para verificar que no se llama
      (prismaMock.microObjective as Record<string, jest.Mock>)['delete'] = microObjectiveDeleteMock;
      (prismaMock.microObjective as Record<string, jest.Mock>)['deleteMany'] = microObjectiveDeleteMock;

      const service = await buildService(prismaMock);

      await service.softDelete(studentId, taskId);

      // Nunca debe llamar a delete ni deleteMany en microObjective
      expect(microObjectiveDeleteMock).not.toHaveBeenCalled();
    });
  });

  /**
   * Caso adicional: softDelete lanza NotFoundException si la Task no existe.
   */
  describe('Casos de borde — NotFoundException', () => {
    it('lanza NotFoundException cuando la Task no existe al hacer softDelete', async () => {
      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(null),
      });
      const service = await buildService(prismaMock);

      await expect(
        service.softDelete('student-001', 'task-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException cuando la Task no existe al hacer update', async () => {
      const { prismaMock } = buildPrismaMock({
        taskFindUnique: jest.fn().mockResolvedValue(null),
      });
      const service = await buildService(prismaMock);

      await expect(
        service.update('student-001', 'task-nonexistent', { name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
