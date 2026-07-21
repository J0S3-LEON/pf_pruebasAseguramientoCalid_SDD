'use client';

/**
 * Layout del Dashboard.
 *
 * Incluye un header con el nombre de la aplicación y un botón de logout.
 * El logout invalida la sesión de Auth.js y redirige al login.
 *
 * Requisitos: 5.1, 5.5
 */

import { Button } from '@/components/ui/button';
import { ThemeToggleWrapper } from '@/components/wrappers';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogOut, Sparkles } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  async function handleLogout() {
    await signOut({ callbackUrl: '/auth/login' });
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-background/80 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Ir a la página principal"
            className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20 transition-transform group-hover:scale-105">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight">MindFlow</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggleWrapper />
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-sm">
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}
