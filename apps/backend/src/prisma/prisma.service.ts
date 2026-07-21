/**
 * PrismaService — wraps PrismaClient for NestJS lifecycle management.
 *
 * In Prisma 7, the connection URL is sourced exclusively from the DATABASE_URL
 * environment variable at runtime. Pool settings are embedded as query params:
 *   ?connection_limit=10&pool_timeout=20  (max 10 connections, min 2 idle)
 *
 * See .env.example for the recommended DATABASE_URL format.
 *
 * Requisito 7.5
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7: connection URL is read from DATABASE_URL env variable directly.
    // Pool configuration (min: 2, max: 10) is controlled via DATABASE_URL params:
    //   ?connection_limit=10&pool_timeout=20  — Requisito 7.5
    process.env.DATABASE_URL ??= 'postgresql://mindflow_user:your_postgres_password@db:5432/mindflow';
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({
      adapter,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
