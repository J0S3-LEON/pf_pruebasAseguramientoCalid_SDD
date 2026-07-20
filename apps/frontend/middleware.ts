/**
 * Middleware de Next.js para proteger rutas autenticadas.
 *
 * Rutas protegidas:
 *  - /dashboard  — Panel principal del estudiante (Requisito 5.1)
 *  - /ema        — Flujo del chatbot EMA (Requisito 3.1)
 *
 * Si el usuario no tiene un JWT válido en las cookies (cookie "token"),
 * se redirige a /auth/login.
 *
 * Requisitos: 1.5, 5.1, 9.3
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Prefijos de rutas que requieren autenticación JWT. */
const PROTECTED_PATHS = ['/dashboard', '/ema'];

/** Cookie donde se almacena el JWT (alternativa a localStorage para SSR). */
const JWT_COOKIE_NAME = 'mindflow_token';

/**
 * Verifica si la ruta actual está protegida.
 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Middleware de autenticación basado en JWT cookie.
 *
 * Next.js Middleware no puede acceder a localStorage (corre en el Edge Runtime),
 * por lo que se usa la cookie `mindflow_token` como mecanismo de autenticación
 * en rutas del servidor. El cliente también persiste el token en localStorage
 * para peticiones fetch del lado cliente (ver lib/api.ts).
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Leer el JWT desde la cookie
  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;

  if (!token) {
    // Sin token: redirigir a /auth/login conservando la URL de destino
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token presente: permitir el acceso
  // Nota: la verificación criptográfica del JWT se realiza en el servidor (API_Gateway).
  // El middleware sólo verifica la presencia del token para evitar redirects innecesarios.
  return NextResponse.next();
}

/** Configuración del matcher para ejecutar el middleware sólo en rutas relevantes. */
export const config = {
  matcher: [
    /*
     * Excluir:
     *  - Archivos estáticos de Next.js (_next/static, _next/image, favicon.ico)
     *  - Rutas públicas de autenticación (/auth/*)
     *  - API routes (/api/*)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/|api/).*)',
  ],
};
