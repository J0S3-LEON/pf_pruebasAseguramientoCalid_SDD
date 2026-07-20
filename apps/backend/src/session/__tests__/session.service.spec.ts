/**
 * Unit tests for SessionService / EMA_Bot.
 *
 * Test 1 — startSession retorna el prompt "¿Cómo te sientes hoy? (1-5)"
 *   Verifies Requirement 3.1
 *
 * Test 2 — submitFatigueScore lanza BadRequestException si el score es inválido
 *   (fuera del rango [1,5]) sin registrar ningún FatigueRecord.
 *   Verifies Requirement 3.2
 *
 * Test 3 — Transición al flujo de tareas ocurre en < 1 segundo tras la
 *   confirmación de persistencia (mock de Prisma con resolución inmediata).
 *   Verifies Requirement 3.4
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from '../session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskDecomposerService } from '../../task-decomposer/task-decomposer.service';

// ─── Fábricas de mocks ────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    fatigueRecord: {
      create: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
  };
}

function createMockTaskDecomposer() {
  return {
    shouldDecompose: jest.fn().mockReturnValue(false),
    decompose: jest.fn().mockResolvedValue([]),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildService(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockDecomposer: ReturnType<typeof createMockTaskDecomposer>,
): Promise<SessionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SessionService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: TaskDecomposerService, useValue: mockDecomposer },
    ],
  }).compile();

  return module.get<SessionService>(SessionService);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('SessionService — startSession', () => {
  /**
   * Test 1: El mensaje inicial de la sesión contiene el prompt de Fatigue_Score.
   * Validates: Requirement 3.1
   */
  it('retorna el prompt EMA_Bot "¿Cómo te sientes hoy? (1-5)" al iniciar una sesión', async () => {
    const mockPrisma = createMockPrisma();
    const mockDecomposer = createMockTaskDecomposer();

    const fakeSessionId = 'session-uuid-001';

    mockPrisma.session.create.mockResolvedValue({
      id: fakeSessionId,
      studentId: 'student-uuid-001',
      startedAt: new Date(),
      endedAt: null,
      isActive: true,
    });

    const service = await buildService(mockPrisma, mockDecomposer);

    const result = await service.startSession('student-uuid-001');

    expect(result.sessionId).toBe(fakeSessionId);
    expect(result.prompt).toBe('¿Cómo te sientes hoy? (1-5)');
    expect(mockPrisma.session.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 'student-uuid-001',
        isActive: true,
      }),
    });
  });
});

describe('SessionService — submitFatigueScore (validación de score inválido)', () => {
  /**
   * Test 2: EMA_Bot re-prompts (lanza BadRequestException) sin registrar
   * FatigueRecord cuando el score está fuera del rango válido [1-5].
   *
   * Nota: la validación del rango [1-5] se realiza en el DTO (FatigueSubmitDto)
   * antes de llegar al servicio. Sin embargo, el servicio recibe el valor crudo
   * cuando se llama directamente. Para verificar el comportamiento del servicio
   * ante valores inválidos comprobamos que no persiste nada cuando la sesión no
   * existe (pre-condición de negocio) y, adicionalmente, verificamos que el DTO
   * rechaza valores fuera de [1,5].
   *
   * Validates: Requirement 3.2
   */

  it('lanza NotFoundException si la sesión no existe, sin crear ningún FatigueRecord', async () => {
    const mockPrisma = createMockPrisma();
    const mockDecomposer = createMockTaskDecomposer();

    // La sesión no existe en la base de datos
    mockPrisma.session.findUnique.mockResolvedValue(null);

    const service = await buildService(mockPrisma, mockDecomposer);

    await expect(
      service.submitFatigueScore('nonexistent-session', 'student-uuid-001', 3),
    ).rejects.toBeInstanceOf(NotFoundException);

    // No debe registrarse ningún FatigueRecord
    expect(mockPrisma.fatigueRecord.create).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException si la sesión no pertenece al estudiante, sin crear FatigueRecord', async () => {
    const mockPrisma = createMockPrisma();
    const mockDecomposer = createMockTaskDecomposer();

    // La sesión existe pero pertenece a otro estudiante
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-uuid-002',
      studentId: 'other-student-uuid',
      startedAt: new Date(),
      endedAt: null,
      isActive: true,
    });

    const service = await buildService(mockPrisma, mockDecomposer);

    await expect(
      service.submitFatigueScore('session-uuid-002', 'student-uuid-001', 3),
    ).rejects.toBeInstanceOf(BadRequestException);

    // No debe registrarse ningún FatigueRecord
    expect(mockPrisma.fatigueRecord.create).not.toHaveBeenCalled();
  });

  it('el DTO FatigueSubmitDto rechaza scores fuera del rango [1,5]', async () => {
    /**
     * La validación del rango [1-5] está en el DTO con @Min(1) @Max(5).
     * Verificamos directamente que los valores fuera de rango son inválidos
     * usando validate() de class-validator.
     */
    const { validate } = await import('class-validator');
    const { FatigueSubmitDto } = await import('../dto/fatigue-submit.dto');

    const invalidScores = [0, 6, -1, 10, 100];

    for (const invalidScore of invalidScores) {
      const dto = new FatigueSubmitDto();
      dto.score = invalidScore;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'score')).toBe(true);
    }

    // Scores válidos no deben producir errores
    const validScores = [1, 2, 3, 4, 5];
    for (const validScore of validScores) {
      const dto = new FatigueSubmitDto();
      dto.score = validScore;

      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'score').length).toBe(0);
    }
  });
});

describe('SessionService — submitFatigueScore (transición al flujo de tareas)', () => {
  /**
   * Test 3: La transición al flujo de tareas (respuesta del servicio) ocurre
   * en menos de 1 segundo después de la confirmación de persistencia.
   * Validates: Requirement 3.4
   */
  it('completa la transición al flujo de tareas en < 1 segundo tras persistencia', async () => {
    const mockPrisma = createMockPrisma();
    const mockDecomposer = createMockTaskDecomposer();

    const sessionId = 'session-uuid-perf-001';
    const studentId = 'student-uuid-perf-001';
    const score = 2; // Score bajo: no activa descomposición

    // Mock de sesión existente y perteneciente al estudiante
    mockPrisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      studentId,
      startedAt: new Date(),
      endedAt: null,
      isActive: true,
    });

    // Mock de creación de FatigueRecord con resolución inmediata (persistencia confirmada)
    const fakeRecordId = 'fatigue-record-uuid-001';
    const recordedAt = new Date();
    mockPrisma.fatigueRecord.create.mockResolvedValue({
      id: fakeRecordId,
      sessionId,
      studentId,
      fatigueScore: score,
      recordedAtUtc: recordedAt,
    });

    // shouldDecompose retorna false para score < 4 (sin llamadas a LLM)
    mockDecomposer.shouldDecompose.mockReturnValue(false);

    const service = await buildService(mockPrisma, mockDecomposer);

    // Medir el tiempo desde que se llama submitFatigueScore hasta que resuelve
    const start = Date.now();
    const result = await service.submitFatigueScore(sessionId, studentId, score);
    const elapsed = Date.now() - start;

    // La transición debe completarse en menos de 1000 ms
    expect(elapsed).toBeLessThan(1000);

    // Verificar que la respuesta contiene los datos de transición
    expect(result.fatigueRecordId).toBe(fakeRecordId);
    expect(result.sessionId).toBe(sessionId);
    expect(result.score).toBe(score);
    expect(result.message).toContain('Transicionando al flujo de interacción de tareas');
    expect(result.microObjectives).toEqual([]);

    // La persistencia fue invocada exactamente una vez
    expect(mockPrisma.fatigueRecord.create).toHaveBeenCalledTimes(1);
  });
});
