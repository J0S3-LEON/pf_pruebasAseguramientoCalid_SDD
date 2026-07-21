'use client';

/**
 * Layout de la página EMA (Chatbot de Evaluación Ecológica Momentánea).
 *
 * Reutiliza la misma estructura visual del dashboard layout:
 * header fijo con nombre de la app y botón de logout, más el área
 * de contenido principal centrada.
 *
 * Requisitos: 3.1, 3.2, 3.4
 */

import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function EmaLayout({ children }: { children: React.ReactNode }) {
  async function handleLogout() {
    await signOut({ callbackUrl: '/auth/login' });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Ir a la página principal"
            className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-base font-semibold tracking-tight">MindFlow — EMA</span>
          </Link>

          <Button variant="outline" size="sm" onClick={handleLogout} className="text-sm">
            Cerrar sesión
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
