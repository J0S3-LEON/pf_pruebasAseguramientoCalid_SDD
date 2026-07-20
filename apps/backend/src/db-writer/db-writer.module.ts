/**
 * DBWriterModule — módulo que provee DBWriterService a la aplicación.
 *
 * Exporta DBWriterService para que otros módulos puedan inyectarlo
 * sin necesidad de importar este módulo directamente.
 *
 * Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5
 */
import { Module } from '@nestjs/common';
import { DBWriterService } from './db-writer.service';

@Module({
  providers: [DBWriterService],
  exports: [DBWriterService],
})
export class DBWriterModule {}
