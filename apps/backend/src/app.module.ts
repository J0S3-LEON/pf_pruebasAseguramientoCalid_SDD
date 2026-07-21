/**
 * Módulo raíz de la aplicación NestJS MindFlow.
 * Registra los módulos de cada dominio y la configuración de variables de entorno.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SessionSerializerModule } from './session-serializer/session-serializer.module';
import { TaskModule } from './tasks/task.module';
import { SessionModule } from './session/session.module';
import { DBWriterModule } from './db-writer/db-writer.module';
import { NotificationModule } from './notification/notification.module';
import { TaskDecomposerModule } from './task-decomposer/task-decomposer.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env — Requisito 8.4
    ConfigModule.forRoot({
      isGlobal: true,
      // Permite ejecutar desde apps/backend y también usar un .env local.
      // Las variables ya presentes en el entorno (Docker/CI) tienen prioridad.
      envFilePath: ['.env', '../../.env'],
    }),
    // Activa el scheduler de cron jobs — Requisito 6.1
    ScheduleModule.forRoot(),
    // Módulo global de base de datos — Requisito 7.5
    PrismaModule,
    // Auth_Service — Requisitos 1.1–1.6
    AuthModule,
    // Session_Serializer — Requisitos 10.1–10.5
    SessionSerializerModule,
    // Task Module — Requisitos 2.1–2.6
    TaskModule,
    // EMA_Bot / Session Module — Requisitos 3.1–3.5
    SessionModule,
    // DB_Writer — Capa de persistencia — Requisitos 7.1–7.5
    DBWriterModule,
    // Notification_Service — cron job de recordatorios — Requisitos 6.1–6.5
    NotificationModule,
    // Task_Decomposer — Descomposición adaptativa — Requisitos 4.1–4.6
    TaskDecomposerModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [
    // Registro global del JWT guard — Requisito 1.5, 1.6
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
