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

export const metadata: Metadata = {
  title: 'MindFlow — Dashboard',
  description: 'Gestiona tus tareas activas y monitorea tu fatiga cognitiva.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualiza tus tareas, micro-objetivos y el historial de fatiga cognitiva.
        </p>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1 — Tareas activas */}
        <section aria-labelledby="tasks-heading">
          <h2
            id="tasks-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Tareas activas
          </h2>
          <TaskList />
        </section>

        {/* Column 2 — Micro-objetivos pendientes */}
        <section aria-labelledby="mo-heading">
          <h2
            id="mo-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Micro-objetivos
          </h2>
          <MicroObjectivesPanel />
        </section>

        {/* Column 3 — Historial de fatiga */}
        <section aria-labelledby="fatigue-heading">
          <h2
            id="fatigue-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Historial de fatiga
          </h2>
          <FatigueHistoryChart />
        </section>
      </div>
    </div>
  );
}
