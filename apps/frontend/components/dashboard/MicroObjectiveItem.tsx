'use client';

/**
 * Ítem de micro-objetivo con checkbox para marcar como completado.
 *
 * - Usa Shadcn Checkbox.
 * - Realiza optimistic update: actualiza el estado local inmediatamente
 *   y luego envía PATCH /api/v1/tasks/:taskId/micro-objectives/:moId.
 * - Si la petición falla, revierte el estado local.
 *
 * Requisitos: 5.2
 */

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { apiFetch } from '@/lib/api';
import { SlotTextWrapper } from '@/components/wrappers';
import { Clock3 } from 'lucide-react';
import { sileo } from 'sileo';

export interface MicroObjective {
  id: string;
  taskId: string;
  content: string;
  estimatedMinutes: number;
  isCompleted: boolean;
}

interface MicroObjectiveItemProps {
  microObjective: MicroObjective;
  /** Callback opcional para notificar al padre del cambio de estado */
  onToggle?: (id: string, isCompleted: boolean) => void;
}

interface PatchMicroObjectiveResponse {
  id: string;
  isCompleted: boolean;
}

export function MicroObjectiveItem({ microObjective, onToggle }: MicroObjectiveItemProps) {
  const [isCompleted, setIsCompleted] = useState(microObjective.isCompleted);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle(checked: boolean) {
    // Optimistic update
    setIsCompleted(checked);
    setIsLoading(true);

    try {
      await apiFetch<PatchMicroObjectiveResponse>(
        `/tasks/${microObjective.taskId}/micro-objectives/${microObjective.id}`,
        {
          method: 'PATCH',
          body: { isCompleted: checked },
        },
      );
      onToggle?.(microObjective.id, checked);
      sileo.success({
        title: checked ? 'Micro-objetivo completado' : 'Micro-objetivo reabierto',
        description: checked
          ? 'Tu progreso se guardó correctamente.'
          : 'El paso volvió a tu lista de pendientes.',
      });
    } catch {
      // Revert on failure
      setIsCompleted(!checked);
      sileo.error({
        title: 'No se pudo guardar el cambio',
        description: 'Revisa la conexión e inténtalo nuevamente.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70">
      <Checkbox
        id={`mo-${microObjective.id}`}
        checked={isCompleted}
        onCheckedChange={(checked) => handleToggle(checked as boolean)}
        disabled={isLoading}
        aria-label={`Marcar como completado: ${microObjective.content}`}
        className="mt-0.5 shrink-0"
      />
      <label
        htmlFor={`mo-${microObjective.id}`}
        className={[
          'text-sm leading-relaxed cursor-pointer select-none',
          'transition-opacity duration-150',
          isCompleted ? 'line-through text-muted-foreground opacity-60' : 'text-foreground',
          isLoading ? 'opacity-50' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <SlotTextWrapper text={microObjective.content} />
        {microObjective.estimatedMinutes > 0 && (
          <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
            <Clock3 className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {microObjective.estimatedMinutes} min
          </span>
        )}
      </label>
    </div>
  );
}
