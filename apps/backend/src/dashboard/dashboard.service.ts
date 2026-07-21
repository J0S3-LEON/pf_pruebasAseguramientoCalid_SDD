import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(studentId: string) {
    const [tasks, fatigueHistory] = await Promise.all([
      this.prisma.task.findMany({
        where: { studentId, isDeleted: false },
        orderBy: { deadline: 'asc' },
        include: {
          microObjectives: {
            where: { isAuditOnly: false },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.fatigueRecord.findMany({
        where: { studentId },
        orderBy: { recordedAtUtc: 'desc' },
        take: 30,
      }),
    ]);

    return {
      tasks,
      microObjectives: tasks.flatMap((task) => task.microObjectives),
      fatigueHistory,
    };
  }
}
