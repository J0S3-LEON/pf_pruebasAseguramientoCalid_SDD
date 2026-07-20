'use client';

/**
 * Gráfico de historial de fatiga (últimas 30 sesiones).
 *
 * - Fetch via SWR desde GET /api/v1/dashboard.
 * - Muestra un recharts LineChart con el Fatigue_Score en el tiempo.
 * - Ordena los valores cronológicamente (Requisito 5.3).
 * - Si no hay sesiones, delega al componente EmptyState.
 *
 * Requisitos: 5.3, 5.4
 */

import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { EmptyState } from './EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FatigueRecord {
  id: string;
  fatigueScore: number;
  recordedAtUtc: string; // ISO 8601
}

interface DashboardResponse {
  tasks: unknown[];
  microObjectives: unknown[];
  fatigueHistory: FatigueRecord[];
}

interface ChartDataPoint {
  date: string;
  score: number;
}

// ─── SWR fetcher ─────────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/dashboard');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatChartDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

function toChartData(records: FatigueRecord[]): ChartDataPoint[] {
  // Sort chronologically ASC — Req 5.3 (History Ordering Invariant)
  return [...records]
    .sort(
      (a, b) =>
        new Date(a.recordedAtUtc).getTime() -
        new Date(b.recordedAtUtc).getTime(),
    )
    .map((r) => ({
      date: formatChartDate(r.recordedAtUtc),
      score: r.fatigueScore,
    }));
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayload {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        Fatiga:{' '}
        <span className="font-semibold text-foreground">{payload[0]?.value}</span>
        /5
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FatigueHistoryChart() {
  const {
    data: dashboard,
    error,
    isLoading,
  } = useSWR<DashboardResponse>('/api/v1/dashboard', fetchDashboard);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-2/3 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive text-center">
            No se pudo cargar el historial de fatiga.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fatigueHistory = dashboard?.fatigueHistory ?? [];

  // Empty state — Req 5.4
  if (fatigueHistory.length === 0) {
    return (
      <EmptyState
        title="Sin historial de fatiga"
        description="Inicia tu primera sesión EMA para comenzar a registrar tu nivel de fatiga cognitiva a lo largo del tiempo."
        actionLabel="Iniciar sesión EMA"
      />
    );
  }

  const chartData = toChartData(fatigueHistory);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de fatiga</CardTitle>
        <CardDescription className="text-xs">
          Últimas {fatigueHistory.length} sesiones EMA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 5 }}
              name="Fatiga"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
