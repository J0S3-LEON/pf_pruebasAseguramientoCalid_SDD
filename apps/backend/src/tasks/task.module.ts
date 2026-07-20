/**
 * TaskModule — Módulo NestJS para la gestión de Tasks académicas.
 *
 * Registra:
 *  - TaskController: endpoints CRUD de Tasks y MicroObjectives.
 *  - TaskService: lógica de negocio con aislamiento por Student.
 *
 * PrismaModule es global, por lo que PrismaService se inyecta automáticamente.
 *
 * Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
