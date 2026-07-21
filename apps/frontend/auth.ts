import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginEnvelope = {
  data?: { token?: string };
};

function getStudentId(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { studentId?: string };

    return decoded.studentId;
  } catch {
    return undefined;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Activar temporalmente con AUTH_DEBUG=true cuando se necesiten trazas.
  debug: process.env.AUTH_DEBUG === 'true',
  trustHost: true,
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
          cache: 'no-store',
        });

        if (!response.ok) return null;

        const envelope = (await response.json()) as LoginEnvelope;
        const accessToken = envelope.data?.token;
        if (!accessToken) return null;

        return {
          id: getStudentId(accessToken) ?? parsed.data.email,
          email: parsed.data.email,
          accessToken,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth);
    },
    jwt({ token, user }) {
      if (user) token.accessToken = user.accessToken;
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
