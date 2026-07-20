/**
 * TaskController — Controlador HTTP del Task Module.
 *
 * Expone:
 *  - POST   /api/v1/tasks                                        → crear Task
 *  - GET    /api/v1/tasks                                        → listar Tasks del Student
 *  - PATCH  /api/v1/tasks/:taskId                                → actualizar Task
 *  - DELETE /api/v1/tasks/:taskId                                → eliminación lógica
 *  - GET    /api/v1/tasks/:taskId/micro-objectives               → listar MicroObjectives
 *  - PATCH  /api/v1/tasks/:taskId/micro-objectives/:moId         → actualizar MicroObjective
 *
 * El JwtAuthGuard global protege todos los endpoints.
 * El Student autenticado se extrae de request.user (StudentPayload).
 *
 * Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MicroObjective, Task } from '@prisma/client';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { StudentPayload } from '../auth/interfaces/student-payload.interface';

/** Extend express Request to carry the JWT payload injected by JwtAuthGuard */
type AuthRequest = Request & { user: StudentPayload };

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * POST /api/v1/tasks
   *
   * Crea una nueva Task para el Student autenticado.
   * Retorna 201 con la Task creada (con UUID).
   * Retorna 422 si name está vacío o deadline es inválido.
   *
   * Requisito 2.1, 2.2
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthRequest,
    @Body() dto: CreateTaskDto,
  ): Promise<Task> {
    return this.taskService.create(req.user.studentId, dto);
  }

  /**
   * GET /api/v1/tasks
   *
   * Retorna las Tasks del Student autenticado (is_deleted = false),
   * ordenadas por deadline ASC.
   *
   * Requisito 2.3
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: AuthRequest): Promise<Task[]> {
    return this.taskService.findAll(req.user.studentId);
  }

  /**
   * PATCH /api/v1/tasks/:taskId
   *
   * Actualiza una Task si el Student autenticado es el propietario.
   * Retorna 403 si la Task pertenece a otro Student.
   * Retorna 404 si la Task no existe.
   *
   * Requisito 2.4, 2.5
   */
  @Patch(':taskId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.taskService.update(req.user.studentId, taskId, dto);
  }

  /**
   * DELETE /api/v1/tasks/:taskId
   *
   * Eliminación lógica de la Task: is_deleted = true.
   * Marca is_audit_only = true en los MicroObjectives asociados.
   * Retorna 204 sin cuerpo.
   * Retorna 403 si la Task pertenece a otro Student.
   * Retorna 404 si la Task no existe.
   *
   * Requisito 2.5, 2.6
   */
  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.taskService.softDelete(req.user.studentId, taskId);
  }

  /**
   * GET /api/v1/tasks/:taskId/micro-objectives
   *
   * Retorna los MicroObjectives activos de una Task.
   * Verifica propiedad del Student.
   * Retorna 403 si la Task pertenece a otro Student.
   * Retorna 404 si la Task no existe.
   *
   * Requisito 2.6
   */
  @Get(':taskId/micro-objectives')
  @HttpCode(HttpStatus.OK)
  async findMicroObjectives(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
  ): Promise<MicroObjective[]> {
    return this.taskService.findMicroObjectivesByTask(
      req.user.studentId,
      taskId,
    );
  }

  /**
   * PATCH /api/v1/tasks/:taskId/micro-objectives/:moId
   *
   * Actualiza un MicroObjective verificando propiedad de la Task padre.
   * Retorna 403 si la Task pertenece a otro Student.
   * Retorna 404 si la Task o el MicroObjective no existen.
   *
   * Requisito 2.6
   */
  @Patch(':taskId/micro-objectives/:moId')
  @HttpCode(HttpStatus.OK)
  async updateMicroObjective(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
    @Param('moId') moId: string,
    @Body()
    body: Partial<
      Pick<MicroObjective, 'content' | 'estimatedMinutes' | 'isCompleted'>
    >,
  ): Promise<MicroObjective> {
    return this.taskService.updateMicroObjective(
      req.user.studentId,
      taskId,
      moId,
      body,
    );
  }
}
