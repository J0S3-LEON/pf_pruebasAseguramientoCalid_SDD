/**
 * SessionController — Controlador HTTP del EMA_Bot Module.
 *
 * Expone:
 *  - POST /api/v1/sessions          → startSession (JWT requerido)
 *  - POST /api/v1/sessions/:sessionId/fatigue → submitFatigueScore (JWT requerido)
 *  - GET  /api/v1/sessions          → getSessionHistory (JWT requerido)
 *
 * El JWT global guard protege todos los endpoints (no se usa @Public()).
 * El StudentPayload se extrae de request.user, inyectado por JwtAuthGuard.
 *
 * Validación de FatigueSubmitDto:
 *  - El ValidationPipe global rechaza scores fuera de [1, 5], strings,
 *    decimales, null y booleanos con HTTP 422.
 *  - Si la validación del DTO falla, el GlobalExceptionFilter retorna
 *    un envelope { data: null, error: string, status: 400/422 }.
 *
 * Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService, StartSessionResponse, SubmitFatigueResponse, SessionHistoryItem } from './session.service';
import { FatigueSubmitDto } from './dto';
import { StudentPayload } from '../auth/interfaces/student-payload.interface';

/** Extensión tipada del Request con el payload JWT adjunto. */
type AuthenticatedRequest = Request & { user: StudentPayload };

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * POST /api/v1/sessions
   *
   * Inicia una nueva Session EMA para el Student autenticado.
   * Crea registro en DB con is_active: true.
   * Retorna 201 con { sessionId, prompt }.
   *
   * Requisito 3.1
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @Req() req: AuthenticatedRequest,
  ): Promise<StartSessionResponse> {
    const { studentId } = req.user;
    return this.sessionService.startSession(studentId);
  }

  /**
   * POST /api/v1/sessions/:sessionId/fatigue
   *
   * Recibe el Fatigue_Score del Student para la Session indicada.
   *
   * Validación:
   *  - Score debe ser entero en [1, 5].
   *  - Strings, decimales, null y booleanos son rechazados por el DTO
   *    con HTTP 422 (ValidationPipe global).
   *
   * En caso de score válido:
   *  - Persiste FatigueRecord via PrismaService.
   *  - Confirma persistencia y señala transición al flujo de tareas.
   *  - Responde en < 1 segundo tras confirmar persistencia.
   *
   * Retorna 201 con { fatigueRecordId, sessionId, score, recordedAtUtc, message }.
   *
   * Requisitos: 3.2, 3.3, 3.4, 3.5
   */
  @Post(':sessionId/fatigue')
  @HttpCode(HttpStatus.CREATED)
  async submitFatigueScore(
    @Param('sessionId') sessionId: string,
    @Body() dto: FatigueSubmitDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubmitFatigueResponse> {
    const { studentId } = req.user;
    return this.sessionService.submitFatigueScore(sessionId, studentId, dto.score);
  }

  /**
   * GET /api/v1/sessions
   *
   * Retorna las últimas 30 Sessions del Student autenticado,
   * ordenadas por startedAt DESC (más reciente primero).
   *
   * Retorna 200 con arreglo de SessionHistoryItem.
   *
   * Requisito 3.3, 5.3
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getSessionHistory(
    @Req() req: AuthenticatedRequest,
  ): Promise<SessionHistoryItem[]> {
    const { studentId } = req.user;
    return this.sessionService.getSessionHistory(studentId);
  }
}
