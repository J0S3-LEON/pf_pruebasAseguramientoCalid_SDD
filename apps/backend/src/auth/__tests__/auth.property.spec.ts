/**
 * Property-based tests for the Auth_Service.
 *
 * Property 1: Round-Trip de Registro y Login
 *   FOR ALL (email, password≥8), register → login → validateToken
 *   retorna el mismo Student sin pérdida de identidad.
 *   Validates: Requirements 1.1, 1.3
 *
 * Property 2: Unicidad de Cuenta por Correo
 *   FOR ALL N≥2 registros con el mismo email, exactamente 1 cuenta se crea
 *   y los intentos subsecuentes retornan HTTP 409.
 *   Validates: Requirement 1.2
 *
 * Property 3: JWT con Expiración de 24 Horas
 *   FOR ALL credenciales válidas, el JWT tiene exp == iat + 86400.
 *   Validates: Requirement 1.3
 *
 * Property 4: Rechazo de Credenciales Inválidas
 *   FOR ALL (email, password) donde al menos un campo no corresponde
 *   a una cuenta válida, retorna HTTP 401 sin revelar cuál campo es incorrecto.
 *   Validates: Requirement 1.4
 *
 * Property 5: Acceso con JWT Válido vs. Rechazado con JWT Expirado
 *   JWT con exp > now concede acceso; JWT con exp <= now retorna HTTP 401.
 *   Validates: Requirements 1.5, 1.6
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── In-memory student store ──────────────────────────────────────────────────
// Simulates a minimal PrismaService without a real DB connection.
// Reset between tests to guarantee isolation.

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
          // Check uniqueness (mirrors DB UNIQUE constraint)
          for (const s of store.values()) {
            if (s.email === data.email) {
              // Simulate Prisma unique constraint error
              const err = Object.assign(new Error('Unique constraint failed'), {
                code: 'P2002',
              });
              throw err;
            }
          }
          const id = `student-${++uuidCounter}`;
          const student: StoredStudent = { id, email: data.email, passwordHash: data.passwordHash };
          store.set(id, student);
          return student;
        },
      ),
    } as unknown as PrismaService['student'],
  };

  return { prisma, store };
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-secret-for-properties-min32chars!!';

async function buildAuthService(prisma: Partial<PrismaService>): Promise<{
  authService: AuthService;
  jwtService: JwtService;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
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

  return {
    authService: moduleRef.get<AuthService>(AuthService),
    jwtService: moduleRef.get<JwtService>(JwtService),
    moduleRef,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid email address.
 * Uses safe character sets to avoid fast-check generating malformed emails.
 */
const validEmailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 3,
    maxLength: 10,
  }),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 3,
    maxLength: 8,
  }),
  fc.constantFrom('com', 'edu', 'org', 'net'),
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/**
 * Generates a password with at least 8 characters.
 */
const validPasswordArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split('')),
  { minLength: 8, maxLength: 30 },
);

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Auth_Service — Property 1: Round-Trip de Registro y Login', () => {
  /**
   * Validates: Requirements 1.1, 1.3
   */

  it('P1 — FOR ALL valid (email, password≥8): register → login → validateToken preserves identity', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        async (email, password) => {
          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          // 1. Register
          const registerResult = await authService.register(email, password);
          expect(typeof registerResult.message).toBe('string');
          expect(registerResult.message.length).toBeGreaterThan(0);

          // 2. Login
          const loginResult = await authService.login(email, password);
          expect(typeof loginResult.token).toBe('string');
          expect(loginResult.token.length).toBeGreaterThan(0);

          // 3. ValidateToken — payload must identify the same student
          const payload = await authService.validateToken(loginResult.token);

          expect(payload.email).toBe(email);
          expect(typeof payload.studentId).toBe('string');
          expect(payload.studentId.length).toBeGreaterThan(0);
          expect(typeof payload.iat).toBe('number');
          expect(typeof payload.exp).toBe('number');
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe('Auth_Service — Property 2: Unicidad de Cuenta por Correo', () => {
  /**
   * Validates: Requirement 1.2
   */

  it('P2 — FOR ALL N≥2 register attempts with same email: exactly 1 account created, rest return HTTP 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        fc.integer({ min: 2, max: 5 }),
        async (email, password, n) => {
          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          // First registration should succeed
          await authService.register(email, password);

          // Subsequent registrations (N-1 more) should all throw ConflictException
          let conflictCount = 0;
          for (let i = 1; i < n; i++) {
            try {
              await authService.register(email, password);
              throw new Error('Expected ConflictException but register succeeded');
            } catch (err) {
              if (err instanceof ConflictException) {
                conflictCount++;
              } else {
                throw err;
              }
            }
          }

          // All N-1 additional attempts must have been rejected with 409
          expect(conflictCount).toBe(n - 1);

          // Exactly one account in the store
          let emailCount = 0;
          for (const s of store.values()) {
            if (s.email === email) emailCount++;
          }
          expect(emailCount).toBe(1);
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe('Auth_Service — Property 3: JWT con Expiración de 24 Horas', () => {
  /**
   * Validates: Requirement 1.3
   */

  it('P3 — FOR ALL valid credentials: JWT exp == iat + 86400 (exactly 24h)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        async (email, password) => {
          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          await authService.register(email, password);
          const { token } = await authService.login(email, password);
          const payload = await authService.validateToken(token);

          // exp must be exactly iat + 86400 seconds
          expect(payload.exp - payload.iat).toBe(86400);
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe('Auth_Service — Property 4: Rechazo de Credenciales Inválidas', () => {
  /**
   * Validates: Requirement 1.4
   */

  it('P4 — wrong email: returns HTTP 401 with generic message that does not reveal which field is wrong', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        validEmailArb,
        async (registeredEmail, password, wrongEmail) => {
          // Ensure wrongEmail is different from registeredEmail
          fc.pre(wrongEmail !== registeredEmail);

          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          await authService.register(registeredEmail, password);

          try {
            await authService.login(wrongEmail, password);
            throw new Error('Expected UnauthorizedException but login succeeded');
          } catch (err) {
            expect(err).toBeInstanceOf(UnauthorizedException);
            const message = (err as UnauthorizedException).message;
            // Message must NOT mention 'email' or 'password' specifically
            expect(message.toLowerCase()).not.toMatch(/email.*incorr|contraseña.*incorr|password.*wrong|email.*wrong/i);
          }
        },
      ),
      { numRuns: 5 },
    );
  });

  it('P4 — wrong password: returns HTTP 401 with generic message that does not reveal which field is wrong', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        validPasswordArb,
        async (email, correctPassword, wrongPassword) => {
          // Ensure passwords are different
          fc.pre(wrongPassword !== correctPassword);

          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          await authService.register(email, correctPassword);

          try {
            await authService.login(email, wrongPassword);
            throw new Error('Expected UnauthorizedException but login succeeded');
          } catch (err) {
            expect(err).toBeInstanceOf(UnauthorizedException);
            const message = (err as UnauthorizedException).message;
            // Message must NOT differentiate which field is wrong
            expect(message.toLowerCase()).not.toMatch(/email.*incorr|contraseña.*incorr|password.*wrong|email.*wrong/i);
          }
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe('Auth_Service — Property 5: Acceso con JWT Válido vs. Rechazado con JWT Expirado', () => {
  /**
   * Validates: Requirements 1.5, 1.6
   */

  it('P5 — valid JWT (exp > now): validateToken succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        async (email, password) => {
          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService } = await buildAuthService(prisma);

          await authService.register(email, password);
          const { token } = await authService.login(email, password);

          // Token was just issued — exp > now, must be valid
          const payload = await authService.validateToken(token);
          expect(payload.email).toBe(email);
          expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        },
      ),
      { numRuns: 5 },
    );
  });

  it('P5 — expired JWT (exp <= now): validateToken throws HTTP 401', async () => {
    /**
     * We sign a token that expires immediately (expiresIn: '0s') to simulate expiry.
     */
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService, jwtService } = await buildAuthService(prisma);

    // Register a student
    await authService.register('expired@test.com', 'password123');

    // Manually sign a token with 0-second expiry to simulate an expired token
    const expiredToken = jwtService.sign(
      { studentId: 'some-id', email: 'expired@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '0s' },
    );

    // Wait a tick to ensure the token is expired
    await new Promise((resolve) => setTimeout(resolve, 10));

    await expect(authService.validateToken(expiredToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('P5 — property: FOR ALL expired tokens, validateToken always throws 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        async (email, password) => {
          const { prisma, store } = createInMemoryPrisma();
          store.clear();

          const { authService, jwtService } = await buildAuthService(prisma);

          await authService.register(email, password);

          // Sign a token with 0-second expiry
          const expiredToken = jwtService.sign(
            { studentId: 'fake-id', email },
            { secret: TEST_JWT_SECRET, expiresIn: '0s' },
          );

          // Small delay to ensure expiry
          await new Promise((resolve) => setTimeout(resolve, 10));

          let threw = false;
          try {
            await authService.validateToken(expiredToken);
          } catch (err) {
            expect(err).toBeInstanceOf(UnauthorizedException);
            threw = true;
          }
          expect(threw).toBe(true);
        },
      ),
      { numRuns: 5 },
    );
  });
});

describe('Auth_Service — Unit tests (smoke)', () => {
  it('register returns confirmation message', async () => {
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService } = await buildAuthService(prisma);

    const result = await authService.register('user@example.com', 'securepassword');
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
  });

  it('register stores hashed password (not plaintext)', async () => {
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService } = await buildAuthService(prisma);

    await authService.register('hash@test.com', 'mypassword123');

    const stored = [...store.values()].find((s) => s.email === 'hash@test.com');
    expect(stored).toBeDefined();
    expect(stored!.passwordHash).not.toBe('mypassword123');
    // Must be a valid bcrypt hash
    const valid = await bcrypt.compare('mypassword123', stored!.passwordHash);
    expect(valid).toBe(true);
  });

  it('login returns a token string', async () => {
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService } = await buildAuthService(prisma);

    await authService.register('login@test.com', 'password123');
    const result = await authService.login('login@test.com', 'password123');
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
  });

  it('login throws 409 for duplicate email on register', async () => {
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService } = await buildAuthService(prisma);

    await authService.register('dup@test.com', 'password123');
    await expect(authService.register('dup@test.com', 'password123')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login throws 401 for non-existent email', async () => {
    const { prisma, store } = createInMemoryPrisma();
    store.clear();

    const { authService } = await buildAuthService(prisma);

    await expect(
      authService.login('nobody@test.com', 'password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
