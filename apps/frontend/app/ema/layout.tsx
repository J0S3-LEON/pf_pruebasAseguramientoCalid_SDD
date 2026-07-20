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

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { removeToken } from '@/lib/api';

export default function EmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    removeToken();

    try {
      await fetch('/api/auth/logout', { method: 'DELETE' });
    } catch {
      // Proceed with redirect even if cookie deletion fails
    }

    router.push('/auth/login');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="text-base font-semibold tracking-tight">MindFlow — EMA</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-sm"
          >
            Cerrar sesión
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
