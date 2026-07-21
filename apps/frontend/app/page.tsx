import Link from 'next/link';
import { auth } from '@/auth';

export default async function Home() {
  const session = await auth();
  const isAuthenticated = Boolean(session);

  const protectedHref = (destination: string) =>
    isAuthenticated
      ? destination
      : `/auth/login?callbackUrl=${encodeURIComponent(destination)}`;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="text-lg font-bold tracking-tight">MindFlow</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href={isAuthenticated ? '/dashboard' : '/auth/login'}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isAuthenticated ? 'Ir al dashboard' : 'Iniciar sesión'}
            </Link>
            <Link
              href={isAuthenticated ? '/ema' : '/auth/register'}
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {isAuthenticated ? 'Iniciar EMA' : 'Crear cuenta'}
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Sistema activo — Backend conectado
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Reduce tu fatiga cognitiva con{' '}
            <span className="text-primary">MindFlow</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Un chatbot EMA que evalúa tu estado mental y descompone tus tareas
            académicas en micro-objetivos de 25 minutos o menos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={isAuthenticated ? '/dashboard' : '/auth/register'}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors text-base"
            >
              {isAuthenticated ? 'Continuar' : 'Comenzar gratis'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href={protectedHref('/ema')}
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-semibold px-8 py-3 rounded-lg hover:bg-muted transition-colors text-base"
            >
              {isAuthenticated ? 'Evaluar mi fatiga' : 'Ya tengo cuenta'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Link href={protectedHref('/ema')} className="group block rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Chatbot EMA</h3>
            <p className="text-sm text-muted-foreground">
              Evalúa tu nivel de fatiga con una simple pregunta del 1 al 5.
            </p>
            <div className="mt-3 text-xs font-medium text-primary">Ir al EMA →</div>
          </Link>

          {/* Card 2 */}
          <Link href={protectedHref('/dashboard')} className="group block rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Visualiza tus tareas, micro-objetivos y el historial de fatiga.
            </p>
            <div className="mt-3 text-xs font-medium text-primary">Ver dashboard →</div>
          </Link>

          {/* Card 3 */}
          <Link href={protectedHref('/dashboard#micro-objectives')} className="group block rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Micro-objetivos</h3>
            <p className="text-sm text-muted-foreground">
              IA descompone tus tareas complejas en pasos de ≤ 25 minutos.
            </p>
            <div className="mt-3 text-xs font-medium text-primary">Ver micro-objetivos →</div>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        MindFlow © 2025 — Pruebas y Aseguramiento de Calidad
      </footer>
    </main>
  );
}
