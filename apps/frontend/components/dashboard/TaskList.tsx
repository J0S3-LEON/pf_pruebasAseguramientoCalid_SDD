'use client';

/**
 * Lista de tareas activas del estudiante.
 *
 * - Fetch via SWR desde GET /api/v1/tasks.
 * - Muestra Shadcn Card + Badge por tarea.
 * - Las tareas llegan ordenadas por deadline ASC desde el backend (Requisito 2.3).
 * - Cada tarea expande sus Micro_Objectives usando MicroObjectiveItem.
 *
 * Requisitos: 5.1, 5.2
 */

import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
  MicroObjectiveItem,
  type MicroObjective,
} from './MicroObjectiveItem';
import { DrawerWrapper } from '@/components/wrappers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  name: string;
  description?: string;
  deadline: string; // ISO 8601
  isDeleted: boolean;
  microObjectives?: MicroObjective[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeadlineBadgeVariant(
  iso: string,
): 'destructive' | 'default' | 'secondary' {
  const now = new Date();
  const deadline = new Date(iso);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) return 'destructive';
  if (hoursLeft <= 24) return 'default';
  return 'secondary';
}

// ─── SWR fetcher ─────────────────────────────────────────────────────────────

async function fetchTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TaskList() {
  const { data: tasks, error, isLoading } = useSWR<Task[]>('/api/v1/tasks', fetchTasks);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((n) => (
          <Card key={n}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
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
            No se pudieron cargar las tareas. Intenta recargar la página.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!tasks || tasks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground">
            No tienes tareas activas. ¡Crea tu primera tarea!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Tasks list — sorted by deadline ASC (backend guarantees this per Req 2.3)
  return (
    <div className="flex flex-col gap-4">
      {tasks.map((task) => {
        const pendingMOs =
          task.microObjectives?.filter((mo) => !mo.isCompleted) ?? [];
        const badgeVariant = getDeadlineBadgeVariant(task.deadline);

        return (
          <Card key={task.id} className="transition-shadow duration-150 hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold leading-snug">
                  {task.name}
                </CardTitle>
                <Badge variant={badgeVariant} className="shrink-0 text-xs">
                  {formatDeadline(task.deadline)}
                </Badge>
              </div>
              {task.description && (
                <CardDescription className="text-xs line-clamp-2 mt-1">
                  {task.description}
                </CardDescription>
              )}
            </CardHeader>

            {pendingMOs.length > 0 && (
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Micro-objetivos pendientes ({pendingMOs.length})
                </p>
                <div className="divide-y divide-border">
                  {pendingMOs.map((mo) => (
                    <MicroObjectiveItem key={mo.id} microObjective={mo} />
                  ))}
                </div>
              </CardContent>
            )}

            {/* DrawerWrapper: "Ver detalles" shows full task description + all micro-objectives */}
            <CardContent className="pt-0 pb-3">
              <DrawerWrapper
                trigger={
                  <Button variant="ghost" size="sm" className="text-xs px-0 h-auto text-muted-foreground hover:text-foreground">
                    Ver detalles
                  </Button>
                }
                title={task.name}
              >
                <div className="space-y-3 text-sm">
                  {task.description ? (
                    <p className="text-muted-foreground">{task.description}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Sin descripción.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    📅 Fecha límite: {formatDeadline(task.deadline)}
                  </p>
                  {task.microObjectives && task.microObjectives.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Todos los micro-objetivos ({task.microObjectives.length})
                      </p>
                      <div className="divide-y divide-border">
                        {task.microObjectives.map((mo) => (
                          <MicroObjectiveItem key={mo.id} microObjective={mo} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DrawerWrapper>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
