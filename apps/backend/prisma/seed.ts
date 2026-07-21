import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env'), override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está definida.');

// Al ejecutar el seed desde Windows se conecta al puerto publicado por Docker.
const databaseUrl = new URL(connectionString);
if (databaseUrl.hostname === 'db') databaseUrl.hostname = 'localhost';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl.toString() }),
});

const STUDENT_ID = '10000000-0000-4000-8000-000000000001';
const SESSION_IDS = Array.from(
  { length: 8 },
  (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const TASK_IDS = [
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
];

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  const passwordHash = await bcrypt.hash('MindFlow123!', 12);

  await prisma.student.upsert({
    where: { email: 'demo@mindflow.test' },
    update: { passwordHash },
    create: {
      id: STUDENT_ID,
      email: 'demo@mindflow.test',
      passwordHash,
    },
  });

  const student = await prisma.student.findUniqueOrThrow({
    where: { email: 'demo@mindflow.test' },
  });

  await prisma.notificationLog.deleteMany({ where: { studentId: student.id } });
  await prisma.microObjective.deleteMany({
    where: { task: { studentId: student.id } },
  });
  await prisma.fatigueRecord.deleteMany({ where: { studentId: student.id } });
  await prisma.session.deleteMany({ where: { studentId: student.id } });
  await prisma.task.deleteMany({ where: { studentId: student.id } });

  const sessions = [];
  const fatigueScores = [2, 3, 4, 3, 5, 4, 2, 3];
  for (let index = 0; index < SESSION_IDS.length; index += 1) {
    const startedAt = daysFromNow(-(14 - index * 2));
    const session = await prisma.session.create({
      data: {
        id: SESSION_IDS[index],
        studentId: student.id,
        startedAt,
        endedAt: new Date(startedAt.getTime() + 12 * 60 * 1000),
        isActive: false,
      },
    });
    sessions.push(session);

    await prisma.fatigueRecord.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        fatigueScore: fatigueScores[index],
        recordedAtUtc: new Date(startedAt.getTime() + 5 * 60 * 1000),
      },
    });
  }

  const taskData = [
    {
      id: TASK_IDS[0],
      name: 'Preparar examen de Calidad de Software',
      description: 'Repasar pruebas unitarias, integración y propiedades.',
      deadline: daysFromNow(2),
    },
    {
      id: TASK_IDS[1],
      name: 'Entregar informe del proyecto final',
      description: 'Completar resultados, conclusiones y referencias.',
      deadline: daysFromNow(5),
    },
    {
      id: TASK_IDS[2],
      name: 'Revisar presentación de MindFlow',
      description: 'Ensayar la demostración y comprobar el flujo EMA.',
      deadline: daysFromNow(8),
    },
  ];

  for (const task of taskData) {
    await prisma.task.create({ data: { ...task, studentId: student.id } });
  }

  const microObjectives = [
    [TASK_IDS[0], 'Repasar conceptos de pruebas unitarias', 20, true],
    [TASK_IDS[0], 'Resolver cinco ejercicios de pruebas de propiedad', 25, false],
    [TASK_IDS[0], 'Preparar resumen de integración y E2E', 20, false],
    [TASK_IDS[1], 'Redactar la sección de resultados', 25, false],
    [TASK_IDS[1], 'Revisar conclusiones y ortografía', 15, false],
    [TASK_IDS[2], 'Ensayar el flujo de inicio de sesión', 15, true],
    [TASK_IDS[2], 'Grabar una demostración de respaldo', 20, false],
  ] as const;

  for (let index = 0; index < microObjectives.length; index += 1) {
    const [taskId, content, estimatedMinutes, isCompleted] =
      microObjectives[index];
    await prisma.microObjective.create({
      data: {
        taskId,
        sessionId: sessions[5].id,
        content,
        estimatedMinutes,
        isCompleted,
      },
    });
  }

  for (let index = 0; index < TASK_IDS.length; index += 1) {
    await prisma.notificationLog.create({
      data: {
        studentId: student.id,
        taskId: TASK_IDS[index],
        status: index === 0 ? 'sent' : 'pending',
        attemptCount: index === 0 ? 1 : 0,
        dispatchedAtUtc: daysFromNow(index + 1),
      },
    });
  }

  console.log('Seed completado.');
  console.log('Usuario: demo@mindflow.test');
  console.log('Contraseña: MindFlow123!');
  console.log('Datos: 3 tareas, 7 micro-objetivos y 8 registros de fatiga.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
