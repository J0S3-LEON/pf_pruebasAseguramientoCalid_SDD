/**
 * SessionSerializerModule — Módulo NestJS que provee el SessionSerializerService.
 *
 * Exporta SessionSerializerService para que otros módulos del sistema
 * (EMA_Bot, DB_Writer, etc.) puedan inyectarlo directamente.
 *
 * Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { Module } from '@nestjs/common';
import { SessionSerializerService } from './session-serializer.service';

@Module({
  providers: [SessionSerializerService],
  exports: [SessionSerializerService],
})
export class SessionSerializerModule {}
