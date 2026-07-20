/**
 * API Route: DELETE /api/auth/logout
 *
 * Elimina la cookie HttpOnly del JWT y redirige al usuario a /auth/login.
 *
 * El cliente también debe limpiar el token de localStorage (ver lib/api.ts → removeToken).
 *
 * Requisitos: 1.4
 */

import { NextResponse } from 'next/server';

/** Nombre de la cookie JWT — debe coincidir con middleware.ts y set-cookie/route.ts */
const JWT_COOKIE_NAME = 'mindflow_token';

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  );

  // Eliminar la cookie sobreescribiéndola con maxAge=0
  response.cookies.set(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
