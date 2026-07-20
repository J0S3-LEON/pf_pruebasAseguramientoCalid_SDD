'use client';

/**
 * Componente de estado vacío para el Dashboard.
 *
 * Se muestra cuando el Student no tiene sesiones EMA registradas.
 * Invita al usuario a iniciar su primera sesión.
 *
 * Requisitos: 5.4
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Sin sesiones registradas',
  description = 'Todavía no tienes sesiones EMA. ¡Inicia tu primera sesión para comenzar a gestionar tu fatiga cognitiva!',
  actionLabel = 'Iniciar primera sesión EMA',
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 px-8 text-center border-dashed">
      <CardHeader className="pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {/* Brain/cognitive icon using SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        </div>
        <CardTitle className="text-xl text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {onAction && (
          <Button onClick={onAction} className="mt-2">
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
