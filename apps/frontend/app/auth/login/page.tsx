'use client';

/**
 * Página de inicio de sesión.
 *
 * Validaciones:
 *  - email: formato válido
 *  - password: requerida
 *
 * Manejo de errores:
 *  - HTTP 401 → mensaje genérico sin revelar si el email o la contraseña son incorrectos
 *
 * Tras el login exitoso:
 *  1. Guarda el JWT en localStorage (para peticiones fetch del lado cliente).
 *  2. Persiste el JWT en una cookie HttpOnly vía /api/auth/set-cookie (para SSR/middleware).
 *  3. Redirige al dashboard.
 *
 * Requisitos: 1.3, 1.4
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiFetch, setToken } from '@/lib/api';

// ─── Esquema de validación ──────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Tipos de respuesta de la API ────────────────────────────────────────────

interface AuthResponse {
  access_token: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    setIsLoading(true);

    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: values.email,
          password: values.password,
        },
      });

      // Guardar JWT en localStorage (cliente) y en cookie HttpOnly (servidor)
      setToken(data.access_token);
      await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.access_token }),
      });

      router.push('/dashboard');
    } catch (error: unknown) {
      // HTTP 401 → credenciales incorrectas.
      // Se muestra un mensaje genérico para no revelar si el email existe o no.
      if (error instanceof Error) {
        setServerError(
          'Correo electrónico o contraseña incorrectos. Inténtalo de nuevo.',
        );
      } else {
        setServerError('Ocurrió un error inesperado. Inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Iniciar sesión</CardTitle>
        <CardDescription className="text-center">
          Accede a tu cuenta MindFlow
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contraseña */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error genérico del servidor (HTTP 401 u otros errores) */}
            {serverError && (
              <p
                role="alert"
                className="text-sm font-medium text-destructive text-center"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link
            href="/auth/register"
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            Regístrate
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
