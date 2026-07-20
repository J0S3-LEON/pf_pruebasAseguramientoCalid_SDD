/**
 * NotificationModule — Módulo del Notification_Service.
 *
 * Registra NotificationService para que NestJS pueda inyectarlo y activar
 * el cron job definido con @Cron(CronExpression.EVERY_HOUR).
 * Requiere que ScheduleModule.forRoot() esté registrado en AppModule.
 *
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5
 */
import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    // PrismaModule provee PrismaService requerido por NotificationService
    PrismaModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
