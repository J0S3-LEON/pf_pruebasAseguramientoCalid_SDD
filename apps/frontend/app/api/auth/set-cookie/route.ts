/**
 * API Route: POST /api/auth/set-cookie
 *
 * Recibe un JWT en el body JSON y lo persiste como cookie HttpOnly.
 * Esto permite que el middleware de Next.js (que corre en el Edge Runtime
 * y no puede acceder a localStorage) pueda verificar la autenticación.
 *
 * Body esperado: { token: string }
 *
 * Seguridad:
 *  - HttpOnly: la cookie no es accesible desde JavaScript del cliente.
 *  - SameSite=Lax: protege contra CSRF en la mayoría de escenarios.
 *  - Secure: activo sólo en producción (HTTPS).
 *  - Path=/: disponible en todas las rutas.
 *
 * Requisitos: 1.3, 1.4
 */

import { NextRequest, NextResponse } from 'next/server';

/** Nombre de la cookie JWT — debe coincidir con el middleware.ts */
const JWT_COOKIE_NAME = 'mindflow_token';

/** Duración de la cookie: 7 días en segundos */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let token: string | undefined;

  try {
    const body = await request.json();
    token = typeof body?.token === 'string' ? body.token : undefined;
  } catch {
    return NextResponse.json(
      { error: 'Body JSON inválido' },
      { status: 400 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: 'El campo "token" es requerido' },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
