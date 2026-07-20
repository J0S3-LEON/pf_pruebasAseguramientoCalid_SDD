'use client';

/**
 * Layout del Dashboard.
 *
 * Incluye un header con el nombre de la aplicación y un botón de logout.
 * El logout elimina el JWT de localStorage y la cookie HttpOnly,
 * luego redirige a la página de login.
 *
 * Requisitos: 5.1, 5.5
 */

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { removeToken } from '@/lib/api';
import { ThemeToggleWrapper } from '@/components/wrappers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    // Remove JWT from localStorage
    removeToken();

    // Clear HttpOnly cookie via dedicated logout route
    try {
      await fetch('/api/auth/logout', {
        method: 'DELETE',
      });
    } catch {
      // Proceed with redirect even if cookie deletion fails
    }

    router.push('/auth/login');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            {/* App logo/name */}
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
            <span className="text-base font-semibold tracking-tight">MindFlow</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggleWrapper />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-sm"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
