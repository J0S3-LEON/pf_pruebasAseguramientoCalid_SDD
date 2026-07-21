/**
 * AuthService — Servicio de autenticación para el Auth_Service de MindFlow.
 *
 * Responsabilidades:
 *  - register: validar unicidad de email, hashear contraseña con bcrypt (12 rondas),
 *    persistir nuevo Student en PostgreSQL via PrismaService.
 *  - login: verificar credenciales contra DB, retornar JWT firmado HS256 (24h).
 *  - validateToken: decodificar y verificar JWT, retornar StudentPayload.
 *
 * Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StudentPayload } from './interfaces/student-payload.interface';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra un nuevo Student.
   *
   * - Verifica que no exista un Student con el mismo email (HTTP 409 si hay duplicado).
   * - Hashea la contraseña con bcrypt (12 rondas).
   * - Persiste el Student en PostgreSQL.
   *
   * Requisitos: 1.1, 1.2
   */
  async register(
    email: string,
    password: string,
  ): Promise<{ message: string }> {
    email = email.trim().toLowerCase();

    // Check for duplicate email — Requisito 1.2
    const existing = await this.prisma.student.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con ese correo electrónico.',
      );
    }

    // Hash password with 12 bcrypt rounds — Requisito 1.1
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Persist new student — Requisito 1.1
    await this.prisma.student.create({
      data: {
        email,
        passwordHash,
      },
    });

    return {
      message:
        'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
    };
  }

  /**
   * Autentica un Student y retorna un JWT firmado.
   *
   * - Si el email no existe o la contraseña no coincide → HTTP 401 genérico
   *   (no revela cuál campo es incorrecto) — Requisito 1.4.
   * - El JWT usa HS256 con expiración de 24h — Requisito 1.3.
   *
   * Requisitos: 1.3, 1.4
   */
  async login(email: string, password: string): Promise<{ token: string }> {
    email = email.trim().toLowerCase();

    const genericError = new UnauthorizedException(
      'Credenciales inválidas.',
    );

    // Find student by email
    const student = await this.prisma.student.findUnique({
      where: { email },
    });

    if (!student) {
      throw genericError;
    }

    // Verify password
    const passwordMatches = await bcrypt.compare(password, student.passwordHash);

    if (!passwordMatches) {
      throw genericError;
    }

    // Build JWT payload — Requisito 1.3
    const payload: Omit<StudentPayload, 'iat' | 'exp'> = {
      studentId: student.id,
      email: student.email,
    };

    const secret = this.configService.get<string>('JWT_SECRET');

    const token = this.jwtService.sign(payload, {
      secret,
      expiresIn: '24h',
    });

    return { token };
  }

  /**
   * Decodifica y verifica un JWT, retornando el StudentPayload.
   *
   * Lanza UnauthorizedException si el token es inválido o expirado.
   *
   * Requisitos: 1.5, 1.6
   */
  async validateToken(token: string): Promise<StudentPayload> {
    const secret = this.configService.get<string>('JWT_SECRET');

    try {
      const payload = this.jwtService.verify<StudentPayload>(token, { secret });
      return payload;
    } catch {
      throw new UnauthorizedException(
        'Token de autenticación inválido o expirado.',
      );
    }
  }
}
