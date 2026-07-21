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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { MicroObjectiveItem, type MicroObjective } from './MicroObjectiveItem';
import { DrawerWrapper } from '@/components/wrappers';
import { AlertCircle, CalendarDays, ChevronRight, ListTodo } from 'lucide-react';

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

function getDeadlineBadgeVariant(iso: string): 'destructive' | 'default' | 'secondary' {
  const now = new Date();
  const deadline = new Date(iso);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) {
    return 'destructive';
  }
  if (hoursLeft <= 24) {
    return 'default';
  }
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
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="pt-6">
          <p className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            No se pudieron cargar las tareas. Intenta recargar la página.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!tasks || tasks.length === 0) {
    return (
      <Card className="border-dashed bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardContent className="pt-6 pb-6 text-center">
          <ListTodo className="mx-auto mb-3 h-8 w-8 text-violet-500" />
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
        const pendingMOs = task.microObjectives?.filter((mo) => !mo.isCompleted) ?? [];
        const badgeVariant = getDeadlineBadgeVariant(task.deadline);

        return (
          <Card
            key={task.id}
            className="overflow-hidden border-primary/10 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg"
          >
            <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold leading-snug">{task.name}</CardTitle>
                <Badge variant={badgeVariant} className="shrink-0 gap-1 text-xs">
                  <CalendarDays className="h-3 w-3" />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="group/btn h-8 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    Ver detalles{' '}
                    <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
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
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Fecha límite:{' '}
                    {formatDeadline(task.deadline)}
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
