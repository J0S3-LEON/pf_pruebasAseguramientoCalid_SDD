/**
 * Unit tests for TaskDecomposerService.
 *
 * Test 1: shouldDecompose threshold
 *   - fatigueScore 1, 2, 3  → false
 *   - fatigueScore 4, 5     → true
 *   Validates: Requirement 4.2
 *
 * Test 2: decompose() throws BadGatewayException when global fetch fails
 *   - Mock global fetch to throw a network error
 *   - Verify BadGatewayException (HTTP 502) is raised
 *   Validates: Requirement 4.5
 */

import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TaskDecomposerService } from '../task-decomposer.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal PrismaService stub — decompose tests that reach persistence are
 *  not the focus here, so we only need a no-op stub. */
const prismaMock: Partial<PrismaService> = {
  microObjective: {
    createMany: jest.fn(),
    findMany: jest.fn(),
  } as unknown as PrismaService['microObjective'],
};

/** ConfigService stub that provides dummy AI env vars so callLlm proceeds past
 *  the env-check guard and actually calls fetch. */
const configMock: Partial<ConfigService> = {
  get: jest.fn((key: string) => {
    if (key === 'AI_SERVICE_URL') return 'https://fake-llm.test';
    if (key === 'AI_SERVICE_API_KEY') return 'test-api-key';
    return undefined;
  }),
};

async function buildService(): Promise<TaskDecomposerService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      TaskDecomposerService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  return moduleRef.get<TaskDecomposerService>(TaskDecomposerService);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('TaskDecomposerService — shouldDecompose', () => {
  let service: TaskDecomposerService;

  beforeAll(async () => {
    service = await buildService();
  });

  /**
   * Validates: Requirement 4.2
   * shouldDecompose must return false when fatigueScore < 4.
   */
  it('returns false for fatigueScore 1', () => {
    expect(service.shouldDecompose(1)).toBe(false);
  });

  it('returns false for fatigueScore 2', () => {
    expect(service.shouldDecompose(2)).toBe(false);
  });

  it('returns false for fatigueScore 3', () => {
    expect(service.shouldDecompose(3)).toBe(false);
  });

  /**
   * Validates: Requirement 4.2
   * shouldDecompose must return true when fatigueScore >= 4.
   */
  it('returns true for fatigueScore 4', () => {
    expect(service.shouldDecompose(4)).toBe(true);
  });

  it('returns true for fatigueScore 5', () => {
    expect(service.shouldDecompose(5)).toBe(true);
  });
});

describe('TaskDecomposerService — decompose() LLM failure → BadGatewayException', () => {
  let service: TaskDecomposerService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    service = await buildService();
  });

  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  /**
   * Validates: Requirement 4.5
   * When the LLM HTTP call throws a network error, decompose() must propagate
   * a BadGatewayException (HTTP 502) — not the raw network error.
   */
  it('throws BadGatewayException when fetch rejects with a network error', async () => {
    // Arrange — make fetch throw a simulated network failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure')) as typeof fetch;

    const task = { id: 'task-1', name: 'Estudiar álgebra lineal', description: null };

    // Act & Assert
    await expect(service.decompose(task, 'session-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  /**
   * Validates: Requirement 4.5
   * When fetch resolves but the LLM returns a non-OK HTTP status (e.g. 500),
   * decompose() must throw BadGatewayException.
   */
  it('throws BadGatewayException when LLM returns HTTP 500', async () => {
    // Arrange — simulate a 500 response from the LLM
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }) as unknown as typeof fetch;

    const task = { id: 'task-2', name: 'Redactar ensayo', description: 'Un ensayo de 3 páginas' };

    // Act & Assert
    await expect(service.decompose(task, 'session-2')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  /**
   * Validates: Requirement 4.5
   * When fetch resolves with HTTP 200 but the payload contains no
   * micro_objectives, decompose() must throw BadGatewayException.
   */
  it('throws BadGatewayException when LLM returns an empty micro_objectives array', async () => {
    const llmPayload = JSON.stringify({ micro_objectives: [] });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: llmPayload } }],
      }),
    }) as unknown as typeof fetch;

    const task = { id: 'task-3', name: 'Resolver ejercicios', description: null };

    await expect(service.decompose(task, 'session-3')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
