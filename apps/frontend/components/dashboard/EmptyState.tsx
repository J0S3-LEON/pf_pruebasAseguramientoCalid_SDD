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
import Link from 'next/link';
import { BrainCircuit, Sparkles } from 'lucide-react';

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
    <Card className="flex flex-col items-center justify-center border-dashed bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-transparent px-8 py-16 text-center">
      <CardHeader className="pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <BrainCircuit className="h-8 w-8 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {onAction ? (
          <Button onClick={onAction} className="mt-2">
            <Sparkles className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        ) : (
          <Button asChild className="mt-2">
            <Link href="/ema">
              <Sparkles className="mr-2 h-4 w-4" />
              {actionLabel}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
