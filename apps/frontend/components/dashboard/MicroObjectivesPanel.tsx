'use client';

/**
 * Panel de micro-objetivos pendientes agrupados por tarea.
 *
 * - Fetch via SWR desde GET /api/v1/tasks (reutiliza la misma clave SWR que TaskList).
 * - Filtra únicamente los Micro_Objectives con isCompleted = false.
 * - Agrupa los micro-objetivos por su tarea padre.
 * - Usa MicroObjectiveItem para cada ítem (con optimistic update y PATCH).
 *
 * Requisitos: 5.1, 5.2
 */

import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import {
  MicroObjectiveItem,
  type MicroObjective,
} from './MicroObjectiveItem';
import type { Task } from './TaskList';

// ─── SWR fetcher (same key as TaskList to share cache) ────────────────────────

async function fetchTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MicroObjectivesPanel() {
  const { data: tasks, error, isLoading } = useSWR<Task[]>('/api/v1/tasks', fetchTasks);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2].map((n) => (
          <Card key={n}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive text-center">
            No se pudieron cargar los micro-objetivos.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Collect tasks that have pending micro-objectives
  const tasksWithPendingMOs = (tasks ?? [])
    .map((task) => ({
      ...task,
      pendingMOs: (task.microObjectives ?? []).filter((mo) => !mo.isCompleted),
    }))
    .filter((task) => task.pendingMOs.length > 0);

  // Empty state — no pending micro-objectives
  if (tasksWithPendingMOs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay micro-objetivos pendientes. ¡Buen trabajo!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tasksWithPendingMOs.map((task) => (
        <Card key={task.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold line-clamp-1">
              {task.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {task.pendingMOs.map((mo: MicroObjective) => (
                <MicroObjectiveItem key={mo.id} microObjective={mo} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
