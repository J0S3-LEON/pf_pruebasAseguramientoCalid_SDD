/**
 * TaskDecomposerModule — Módulo NestJS del Task_Decomposer.
 *
 * Registra TaskDecomposerService y lo exporta para que SessionModule pueda
 * inyectarlo al manejar un Fatigue_Score >= 4.
 *
 * PrismaModule es @Global(), por lo que PrismaService está disponible en el
 * contenedor DI sin necesidad de importarlo explícitamente aquí.
 *
 * Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { Module } from '@nestjs/common';
import { TaskDecomposerService } from './task-decomposer.service';

@Module({
  providers: [TaskDecomposerService],
  exports: [TaskDecomposerService],
})
export class TaskDecomposerModule {}
