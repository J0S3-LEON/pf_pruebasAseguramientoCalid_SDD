/**
 * Layout centrado para las páginas de autenticación.
 *
 * Requisitos: 1.1, 1.2
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MindFlow — Autenticación',
  description: 'Accede a tu cuenta MindFlow o crea una nueva.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
