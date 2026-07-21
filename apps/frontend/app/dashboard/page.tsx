/**
 * Página principal del Dashboard.
 *
 * Layout de 3 columnas con Tailwind:
 *  - Columna 1 (span 1): Lista de tareas activas (TaskList)
 *  - Columna 2 (span 1): Micro-objetivos pendientes agrupados por tarea
 *  - Columna 3 (span 1): Historial de fatiga (FatigueHistoryChart)
 *
 * En pantallas pequeñas se colapsa a una sola columna.
 *
 * Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type { Metadata } from 'next';
import { TaskList } from '@/components/dashboard/TaskList';
import { FatigueHistoryChart } from '@/components/dashboard/FatigueHistoryChart';
import { MicroObjectivesPanel } from '@/components/dashboard/MicroObjectivesPanel';
import { DashboardSummary } from '@/components/dashboard/DashboardSummary';
import { Activity, CheckCircle2, ListTodo } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MindFlow — Dashboard',
  description: 'Gestiona tus tareas activas y monitorea tu fatiga cognitiva.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 p-6 text-white shadow-xl shadow-violet-500/15 sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-100">
            Tu espacio cognitivo
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hola, sigue avanzando a tu ritmo
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-indigo-100 sm:text-base">
            Visualiza tus tareas, micro-objetivos y el historial de fatiga cognitiva.
          </p>
        </div>
      </div>

      <DashboardSummary />

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Column 1 — Tareas activas */}
        <section aria-labelledby="tasks-heading" className="lg:col-span-7">
          <h2 id="tasks-heading" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <ListTodo className="h-4 w-4" />
            </span>
            Tareas activas
          </h2>
          <TaskList />
        </section>

        {/* Column 2 — Micro-objetivos pendientes */}
        <section
          id="micro-objectives"
          aria-labelledby="mo-heading"
          className="scroll-mt-20 lg:col-span-5"
        >
          <h2 id="mo-heading" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            Micro-objetivos
          </h2>
          <MicroObjectivesPanel />
        </section>

        {/* Column 3 — Historial de fatiga */}
        <section aria-labelledby="fatigue-heading" className="lg:col-span-12">
          <h2 id="fatigue-heading" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <Activity className="h-4 w-4" />
            </span>
            Historial de fatiga
          </h2>
          <FatigueHistoryChart />
        </section>
      </div>
    </div>
  );
}
