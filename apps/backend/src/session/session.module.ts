/**
 * SessionModule — Módulo NestJS del EMA_Bot.
 *
 * Registra:
 *  - SessionController: endpoints POST /sessions, POST /sessions/:id/fatigue, GET /sessions.
 *  - SessionService: lógica de startSession, submitFatigueScore y getSessionHistory.
 *
 * PrismaModule es @Global(), por lo que PrismaService está disponible en el
 * contenedor DI sin necesidad de importarlo explícitamente aquí.
 *
 * Importa TaskDecomposerModule para que SessionService pueda inyectar
 * TaskDecomposerService y descomponer tareas cuando fatigue >= 4.
 *
 * Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2
 */
import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { TaskDecomposerModule } from '../task-decomposer/task-decomposer.module';

@Module({
  imports: [TaskDecomposerModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
