'use client';

import useSWR from 'swr';
import { BrainCircuit, CheckCircle2, ListTodo, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardData {
  tasks: Array<{ id: string }>;
  microObjectives: Array<{ id: string; isCompleted: boolean }>;
  fatigueHistory: Array<{ fatigueScore: number }>;
}

const cards = [
  { key: 'tasks', label: 'Tareas activas', icon: ListTodo, tone: 'violet' },
  { key: 'pending', label: 'Pasos pendientes', icon: CheckCircle2, tone: 'emerald' },
  { key: 'average', label: 'Fatiga promedio', icon: BrainCircuit, tone: 'cyan' },
] as const;

export function DashboardSummary() {
  const { data, isLoading } = useSWR<DashboardData>('/api/v1/dashboard', () =>
    apiFetch<DashboardData>('/dashboard'),
  );

  const average = data?.fatigueHistory.length
    ? (
        data.fatigueHistory.reduce((sum, item) => sum + item.fatigueScore, 0) /
        data.fatigueHistory.length
      ).toFixed(1)
    : '—';

  const values = {
    tasks: data?.tasks.length ?? 0,
    pending: data?.microObjectives.filter((item) => !item.isCompleted).length ?? 0,
    average: average === '—' ? average : `${average}/5`,
  };

  const tones = {
    violet: 'from-violet-500/15 to-indigo-500/5 text-violet-700 dark:text-violet-300',
    emerald: 'from-emerald-500/15 to-teal-500/5 text-emerald-700 dark:text-emerald-300',
    cyan: 'from-cyan-500/15 to-sky-500/5 text-cyan-700 dark:text-cyan-300',
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ key, label, icon: Icon, tone }) => (
        <div
          key={key}
          className="group rounded-2xl border bg-card/85 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div
              className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-5 h-8 w-20" />
          ) : (
            <p className="mt-5 text-3xl font-bold tracking-tight">{values[key]}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
