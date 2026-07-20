/**
 * Unit tests for AuthService (example-based).
 *
 * Test 1: register lanza HTTP 409 con email duplicado (mock Prisma).
 *   Validates: Requirement 1.2
 *
 * Test 2: login lanza HTTP 401 con contraseña incorrecta sin revelar cuál campo es inválido.
 *   Validates: Requirement 1.4
 *
 * Test 3: register retorna mensaje de confirmación en < 3 segundos bajo carga normal (mock).
 *   Validates: Requirement 1.4 (respuesta rápida con mock)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Helpers reutilizados del property spec ───────────────────────────────────

interface StoredStudent {
  id: string;
  email: string;
  passwordHash: string;
}

function createInMemoryPrisma(): {
  prisma: Partial<PrismaService>;
  store: Map<string, StoredStudent>;
} {
  const store = new Map<string, StoredStudent>();
  let uuidCounter = 0;

  const prisma: Partial<PrismaService> = {
    student: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          for (const s of store.values()) {
            if (s.email === where.email) return s;
          }
          return null;
        }
        if (where.id) {
          return store.get(where.id) ?? null;
        }
        return null;
      }),
      create: jest.fn(
        async ({ data }: { data: { email: string; passwordHash: string } }) => {
          for (const s of store.values()) {
            if (s.email === data.email) {
              const err = Object.assign(new Error('Unique constraint failed'), {
                code: 'P2002',
              });
              throw err;
            }
          }
          const id = `student-${++uuidCounter}`;
          const student: StoredStudent = {
            id,
            email: data.email,
            passwordHash: data.passwordHash,
          };
          store.set(id, student);
          return student;
        },
      ),
    } as unknown as PrismaService['student'],
  };

  return { prisma, store };
}

const TEST_JWT_SECRET = 'test-secret-for-unit-tests-min32chars!!';

async function buildAuthService(
  prisma: Partial<PrismaService>,
): Promise<AuthService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '24h', algorithm: 'HS256' },
      }),
    ],
    providers: [
      AuthService,
      {
        provide: PrismaService,
        useValue: prisma,
      },
      {
        provide: ConfigService,
        useValue: {
          get: (_key: string) => TEST_JWT_SECRET,
        },
      },
    ],
  }).compile();

  return moduleRef.get<AuthService>(AuthService);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService — Unit tests (example-based)', () => {
  /**
   * Test 1: register lanza HTTP 409 con email duplicado.
   * Validates: Requirement 1.2
   */
  it('T1 — register: lanza ConflictException (HTTP 409) cuando el email ya está registrado', async () => {
    const { prisma } = createInMemoryPrisma();
    const authService = await buildAuthService(prisma);

    const email = 'duplicate@example.com';
    const password = 'SecurePass123';

    // Primer registro — debe tener éxito
    await authService.register(email, password);

    // Segundo registro con el mismo email — debe lanzar 409
    await expect(authService.register(email, password)).rejects.toBeInstanceOf(
      ConflictException,
    );

    // El status HTTP del error debe ser 409
    await expect(authService.register(email, password))
      .rejects
      .toMatchObject({ status: 409 });
  });

  /**
   * Test 2: login lanza HTTP 401 con contraseña incorrecta sin revelar cuál campo es inválido.
   * Validates: Requirement 1.4
   */
  it('T2 — login: lanza UnauthorizedException (HTTP 401) con mensaje genérico ante contraseña incorrecta', async () => {
    const { prisma } = createInMemoryPrisma();
    const authService = await buildAuthService(prisma);

    const email = 'user@example.com';
    const correctPassword = 'CorrectPassword!9';
    const wrongPassword = 'WrongPassword!9';

    // Registrar usuario
    await authService.register(email, correctPassword);

    // Intentar login con contraseña incorrecta
    let thrownError: unknown;
    try {
      await authService.login(email, wrongPassword);
    } catch (err) {
      thrownError = err;
    }

    // Debe ser UnauthorizedException
    expect(thrownError).toBeInstanceOf(UnauthorizedException);

    const error = thrownError as UnauthorizedException;

    // El status HTTP debe ser 401
    expect(error.getStatus()).toBe(401);

    // El mensaje NO debe revelar si fue el email o la contraseña el campo inválido
    const message = error.message.toLowerCase();
    expect(message).not.toMatch(/email.*incorr|contraseña.*incorr|password.*wrong|email.*wrong/i);
    expect(message).not.toContain('email incorrecto');
    expect(message).not.toContain('contraseña incorrecta');
    expect(message).not.toContain('wrong password');
    expect(message).not.toContain('wrong email');
  });

  /**
   * Test 3: register retorna mensaje de confirmación en < 3 segundos bajo carga normal (mock).
   * Validates: Requirement 1.1 (registro exitoso con respuesta oportuna)
   */
  it('T3 — register: retorna mensaje de confirmación en menos de 3 segundos (mock Prisma)', async () => {
    const { prisma } = createInMemoryPrisma();
    const authService = await buildAuthService(prisma);

    const email = 'timing@example.com';
    const password = 'TimingTest123';

    const start = Date.now();
    const result = await authService.register(email, password);
    const elapsed = Date.now() - start;

    // Debe retornar un mensaje de confirmación
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);

    // Debe completarse en menos de 3 000 ms bajo carga normal con mock
    expect(elapsed).toBeLessThan(3000);
  });
});
