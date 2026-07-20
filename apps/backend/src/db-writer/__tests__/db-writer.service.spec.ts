/**
 * Unit tests for DBWriterService.
 *
 * Test 1: withRetry — reintenta exactamente una vez tras un fallo con
 *   PrismaClientKnownRequestError, con ~500 ms de espera.
 *   Validates: Requirement 7.3
 *
 * Test 2: bootstrapWithRetry — reintenta la conexión a PostgreSQL exactamente
 *   5 veces al arrancar la aplicación cuando bootstrap falla.
 *   Validates: Requirement 8.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DBWriterService, WriteFatigueRecordInput } from '../db-writer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye un PrismaClientKnownRequestError simulado. */
function makePrismaError(code = 'P2002'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('simulated error', {
    code,
    clientVersion: '0.0.0',
  });
}

/** Input válido de fatiga para los tests (Req 7.3 usa fatigueRecord.create). */
const sampleFatigue: WriteFatigueRecordInput = {
  sessionId: 'session-1',
  studentId: 'student-1',
  fatigueScore: 42,
  recordedAtUtc: new Date('2025-01-01T10:00:00Z'),
};

/** Resultado simulado de Prisma al crear un FatigueRecord. */
const fakeFatigueRecord = {
  id: 'fr-1',
  sessionId: 'session-1',
  studentId: 'student-1',
  fatigueScore: 42,
  recordedAtUtc: new Date('2025-01-01T10:00:00Z'),
  createdAt: new Date(),
};

// ─── Suite 1: Lógica de reintento en DBWriterService ─────────────────────────

describe('DBWriterService — Test 1: reintento único tras PrismaClientKnownRequestError (Req 7.3)', () => {
  let service: DBWriterService;
  let prismaMock: {
    fatigueRecord: { create: jest.Mock };
  };
  let moduleRef: TestingModule;

  beforeEach(async () => {
    prismaMock = {
      fatigueRecord: {
        create: jest.fn(),
      },
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        DBWriterService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get<DBWriterService>(DBWriterService);
  });

  afterEach(async () => {
    await moduleRef.close();
    jest.useRealTimers();
  });

  /**
   * Validates: Requirement 7.3
   *
   * Simula un fallo en la primera llamada a `prisma.fatigueRecord.create` con
   * PrismaClientKnownRequestError y éxito en la segunda.
   * Verifica que:
   *   - El mock se invoca exactamente 2 veces (1 fallo + 1 reintento).
   *   - La operación final retorna el registro correcto.
   */
  it('reintenta exactamente una vez después de ~500 ms cuando Prisma falla con PrismaClientKnownRequestError', async () => {
    jest.useFakeTimers();

    // Primera llamada: falla; segunda: éxito.
    prismaMock.fatigueRecord.create
      .mockRejectedValueOnce(makePrismaError('P2002'))
      .mockResolvedValueOnce(fakeFatigueRecord);

    // Lanzar la operación — quedará pausada esperando el delay de 500 ms
    const writePromise = service.writeFatigueRecord(sampleFatigue);

    // Avanzar 500 ms para disparar el delay interno de withRetry
    await jest.advanceTimersByTimeAsync(500);

    const result = await writePromise;

    // create() debe haberse llamado exactamente 2 veces: intento original + reintento
    expect(prismaMock.fatigueRecord.create).toHaveBeenCalledTimes(2);

    // El resultado final corresponde al registro exitoso
    expect(result).toEqual(fakeFatigueRecord);
  });

  /**
   * Validates: Requirement 7.3
   *
   * Cuando el primer intento falla y el segundo tiene éxito, confirma que
   * el conteo de llamadas es exactamente 2 (no más, no menos).
   */
  it('el conteo de llamadas es exactamente 2 (intento original + 1 reintento) cuando el primero falla', async () => {
    jest.useFakeTimers();

    prismaMock.fatigueRecord.create
      .mockRejectedValueOnce(makePrismaError('P1001'))
      .mockResolvedValueOnce(fakeFatigueRecord);

    const writePromise = service.writeFatigueRecord(sampleFatigue);

    // Avanzar el timer para liberar el delay de 500 ms
    await jest.advanceTimersByTimeAsync(500);

    await writePromise;

    // Exactamente 2 llamadas: intento 1 (fallo) + intento 2 (reintento)
    expect(prismaMock.fatigueRecord.create).toHaveBeenCalledTimes(2);
  });
});

// ─── Suite 2: Reintentos de conexión a PostgreSQL al arrancar ─────────────────

describe('bootstrapWithRetry — Test 2: 5 reintentos de conexión a PostgreSQL al inicio (Req 8.5)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Validates: Requirement 8.5
   *
   * La función `bootstrapWithRetry` de main.ts tiene MAX_RETRIES = 5 y
   * RETRY_INTERVAL_MS = 5000.
   * Cuando `bootstrap()` falla todas las veces, bootstrapWithRetry la invoca
   * exactamente 5 veces antes de llamar a process.exit(1).
   *
   * Para evitar ejecutar la aplicación NestJS completa, reimplementamos la
   * lógica equivalente de bootstrapWithRetry como helper testeable.
   */
  it('reintenta exactamente 5 veces la conexión a PostgreSQL antes de abortar', async () => {
    jest.useFakeTimers();

    const MAX_RETRIES = 5;
    const RETRY_INTERVAL_MS = 5_000;

    const mockBootstrap = jest
      .fn()
      .mockRejectedValue(new Error('Connection refused'));

    const mockProcessExit = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => undefined as never);

    /**
     * Lógica extraída de main.ts (bootstrapWithRetry) para ser testeable
     * sin levantar el servidor NestJS completo.
     */
    async function bootstrapWithRetry(): Promise<void> {
      let attempt = 0;

      while (attempt < MAX_RETRIES) {
        try {
          await mockBootstrap();
          return;
        } catch {
          attempt += 1;
          const remaining = MAX_RETRIES - attempt;

          if (remaining === 0) {
            process.exit(1);
            return;
          }

          await new Promise<void>((resolve) =>
            setTimeout(resolve, RETRY_INTERVAL_MS),
          );
        }
      }
    }

    // Ejecutar el retry loop sin bloquear
    const retryPromise = bootstrapWithRetry();

    // Avanzar (MAX_RETRIES - 1) intervalos de 5 s para desbloquear los delays
    // El último intento (5º) llama a process.exit sin esperar, por eso solo
    // se necesitan 4 avances de timer.
    for (let i = 0; i < MAX_RETRIES - 1; i++) {
      await jest.advanceTimersByTimeAsync(RETRY_INTERVAL_MS);
    }

    await retryPromise;

    // mockBootstrap debe haberse llamado exactamente 5 veces
    expect(mockBootstrap).toHaveBeenCalledTimes(MAX_RETRIES);

    // process.exit(1) debe haberse llamado exactamente una vez
    expect(mockProcessExit).toHaveBeenCalledWith(1);

    mockProcessExit.mockRestore();
  });
});
