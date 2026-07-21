'use client';

/**
 * Página de registro de nuevos estudiantes.
 *
 * Validaciones:
 *  - email: formato válido
 *  - password: mínimo 8 caracteres
 *
 * Manejo de errores:
 *  - HTTP 409 → muestra mensaje de correo duplicado
 *
 * Requisitos: 1.1, 1.2
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

const registerSchema = z
  .object({
    email: z.string().email('Introduce un correo electrónico válido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// ─── Tipos de respuesta de la API ────────────────────────────────────────────

interface RegisterResponse {
  message: string;
}

interface LoginResponse {
  token: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    setIsLoading(true);

    try {
      // 1. Registrar la cuenta
      await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: {
          email: values.email,
          password: values.password,
        },
      });

      // 2. Hacer login automático con las mismas credenciales
      const loginData = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: values.email,
          password: values.password,
        },
      });

      // 3. Guardar JWT en localStorage y en cookie HttpOnly
      setToken(loginData.token);
      await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: loginData.token }),
      });

      router.push('/dashboard');
    } catch (error: unknown) {
      if (error instanceof Error) {
        // HTTP 409 → email ya registrado → error justo debajo del campo email
        if (
          error.message.toLowerCase().includes('409') ||
          error.message.toLowerCase().includes('ya existe') ||
          error.message.toLowerCase().includes('already') ||
          error.message.toLowerCase().includes('duplicado') ||
          error.message.toLowerCase().includes('conflict') ||
          error.message.toLowerCase().includes('cuenta registrada')
        ) {
          form.setError('email', {
            type: 'server',
            message:
              'Este correo electrónico ya está registrado. ¿Quieres iniciar sesión?',
          });
        } else {
          setServerError(
            error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.',
          );
        }
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
        <CardTitle className="text-2xl text-center">Crear cuenta</CardTitle>
        <CardDescription className="text-center">
          Regístrate para comenzar a usar MindFlow
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
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirmar contraseña */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Repite tu contraseña"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error del servidor */}
            {serverError && (
              <p
                role="alert"
                className="text-sm font-medium text-destructive text-center"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/auth/login"
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
