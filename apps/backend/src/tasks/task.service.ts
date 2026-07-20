/**
 * TaskService — Lógica de negocio del Task Module.
 *
 * Implementa:
 *  - create: crea una nueva Task para el Student autenticado.
 *  - findAll: retorna Tasks no eliminadas del Student ordenadas por deadline ASC.
 *  - update: actualiza una Task verificando la propiedad del Student.
 *  - softDelete: eliminación lógica + marca is_audit_only en MicroObjectives.
 *  - findMicroObjectivesByTask: retorna MicroObjectives activos de una Task.
 *  - updateMicroObjective: actualiza un MicroObjective verificando propiedad.
 *
 * Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Task, MicroObjective } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva Task para el Student indicado.
   * Valida que el name no esté vacío y que el deadline sea fecha ISO válida
   * (la validación viene del DTO / ValidationPipe).
   *
   * Requisito 2.1
   */
  async create(studentId: string, dto: CreateTaskDto): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        studentId,
        name: dto.name,
        description: dto.description ?? null,
        deadline: new Date(dto.deadline),
      },
    });
    return task;
  }

  /**
   * Retorna todas las Tasks no eliminadas del Student autenticado,
   * ordenadas por deadline ASC.
   *
   * Requisito 2.3
   */
  async findAll(studentId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        studentId,
        isDeleted: false,
      },
      orderBy: {
        deadline: 'asc',
      },
    });
  }

  /**
   * Actualiza una Task si el Student es el propietario.
   * Lanza ForbiddenException (HTTP 403) si la Task pertenece a otro Student.
   * Lanza NotFoundException (HTTP 404) si la Task no existe.
   *
   * Requisito 2.4, 2.5
   */
  async update(
    studentId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findTaskOrThrow(taskId);
    this.assertOwnership(task, studentId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.deadline !== undefined && { deadline: new Date(dto.deadline) }),
      },
    });
    return updated;
  }

  /**
   * Eliminación lógica de una Task:
   *  - Establece is_deleted = true en la Task.
   *  - Marca is_audit_only = true en todos los MicroObjectives asociados.
   *
   * Lanza ForbiddenException (HTTP 403) si la Task pertenece a otro Student.
   * Lanza NotFoundException (HTTP 404) si la Task no existe.
   *
   * Requisito 2.5, 2.6
   */
  async softDelete(studentId: string, taskId: string): Promise<void> {
    const task = await this.findTaskOrThrow(taskId);
    this.assertOwnership(task, studentId);

    // Atomic transaction: mark Task as deleted + audit MicroObjectives
    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: taskId },
        data: { isDeleted: true },
      }),
      this.prisma.microObjective.updateMany({
        where: { taskId },
        data: { isAuditOnly: true },
      }),
    ]);
  }

  /**
   * Retorna los MicroObjectives activos (no audit-only) de una Task.
   * Verifica que el Student sea propietario de la Task.
   *
   * GET /api/v1/tasks/:taskId/micro-objectives
   * Requisito 2.6
   */
  async findMicroObjectivesByTask(
    studentId: string,
    taskId: string,
  ): Promise<MicroObjective[]> {
    const task = await this.findTaskOrThrow(taskId);
    this.assertOwnership(task, studentId);

    return this.prisma.microObjective.findMany({
      where: {
        taskId,
        isAuditOnly: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Actualiza un MicroObjective verificando que el Student sea propietario
   * de la Task padre.
   *
   * PATCH /api/v1/tasks/:taskId/micro-objectives/:moId
   * Requisito 2.6
   */
  async updateMicroObjective(
    studentId: string,
    taskId: string,
    moId: string,
    data: Partial<Pick<MicroObjective, 'content' | 'estimatedMinutes' | 'isCompleted'>>,
  ): Promise<MicroObjective> {
    const task = await this.findTaskOrThrow(taskId);
    this.assertOwnership(task, studentId);

    const mo = await this.prisma.microObjective.findUnique({
      where: { id: moId },
    });

    if (!mo || mo.taskId !== taskId) {
      throw new NotFoundException(
        `MicroObjective con id "${moId}" no encontrado en la Task "${taskId}".`,
      );
    }

    return this.prisma.microObjective.update({
      where: { id: moId },
      data,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async findTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(
        `Task con id "${taskId}" no encontrada.`,
      );
    }

    return task;
  }

  private assertOwnership(task: Task, studentId: string): void {
    if (task.studentId !== studentId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta tarea.',
      );
    }
  }
}
