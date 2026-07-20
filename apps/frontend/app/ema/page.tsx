'use client';

/**
 * Página del Chatbot EMA (Evaluación Ecológica Momentánea).
 *
 * Flujo:
 *  1. Al montar: POST /api/v1/sessions → obtiene sessionId.
 *  2. Bot pregunta "¿Cómo te sientes hoy? (1-5)".
 *  3. El estudiante ingresa un número; Zod valida entero en [1,5] localmente.
 *     - Input inválido → error inline, no se llama al backend.
 *  4. Input válido → POST /api/v1/sessions/:sessionId/fatigue { score }.
 *     - Mientras espera → Skeleton.
 *     - 400 → bot re-prompts.
 *     - score ≥ 4 y micro-objetivos presentes → muestra Cards por micro-objetivo.
 *     - score ≤ 3 o 502 → muestra la tarea original en el chat.
 *
 * Restricciones: sin librerías de animación; solo Tailwind.
 *
 * Requisitos: 3.1, 3.2, 3.4, 4.1, 4.2, 4.5
 */

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Zod schema — only integers in [1, 5]
// ---------------------------------------------------------------------------
const fatigueScoreSchema = z
  .string()
  .trim()
  .refine((val) => /^\d+$/.test(val) && !val.includes('.'), {
    message: 'Ingresa un número entero entre 1 y 5.',
  })
  .transform((val) => parseInt(val, 10))
  .refine((n) => n >= 1 && n <= 5, {
    message: 'El valor debe estar entre 1 y 5.',
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type MessageRole = 'bot' | 'user';

interface MicroObjective {
  id: string;
  content: string;
  estimatedMinutes: number;
}

interface FatigueResponse {
  score: number;
  microObjectives?: MicroObjective[];
  task?: {
    id: string;
    name: string;
    description?: string;
    deadline: string;
  };
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Plain text content (for user messages and simple bot messages). */
  text?: string;
  /** Micro-objectives card list (bot only, high-fatigue path). */
  microObjectives?: MicroObjective[];
  /** Original task card (bot only, low-fatigue / fallback path). */
  task?: FatigueResponse['task'];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EmaPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [chatFinished, setChatFinished] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // 1. Start session on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      try {
        const data = await apiFetch<{ id: string }>('/sessions', {
          method: 'POST',
        });

        if (cancelled) return;

        setSessionId(data.id);
        setMessages([
          {
            id: uid(),
            role: 'bot',
            text: '¡Hola! Soy EMA, tu asistente de bienestar cognitivo. ¿Cómo te sientes hoy? Ingresa un número del 1 (muy descansado/a) al 5 (muy fatigado/a).',
          },
        ]);
      } catch {
        if (!cancelled) {
          setSessionError(
            'No se pudo iniciar la sesión. Por favor recarga la página.',
          );
        }
      }
    }

    startSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Auto-scroll to latest message
  // -------------------------------------------------------------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // -------------------------------------------------------------------------
  // 2. Handle user submission
  // -------------------------------------------------------------------------
  async function handleSend() {
    if (!sessionId || isLoading || chatFinished) return;

    const raw = inputValue.trim();

    // Client-side Zod validation
    const parsed = fatigueScoreSchema.safeParse(raw);
    if (!parsed.success) {
      setInputError(
        parsed.error.errors[0]?.message ?? 'Valor inválido, ingresa un número entre 1 y 5.',
      );
      return;
    }

    setInputError(null);
    const score = parsed.data;

    // Append user message
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', text: raw },
    ]);
    setInputValue('');
    setIsLoading(true);

    try {
      const data = await apiFetch<FatigueResponse>(
        `/sessions/${sessionId}/fatigue`,
        {
          method: 'POST',
          body: { score },
        },
      );

      // score ≥ 4 with micro-objectives → show cards
      if (score >= 4 && data.microObjectives && data.microObjectives.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'bot',
            text: 'Entiendo que estás algo fatigado/a. Aquí tienes tus micro-objetivos para avanzar paso a paso:',
          },
          {
            id: uid(),
            role: 'bot',
            microObjectives: data.microObjectives,
          },
        ]);
        setChatFinished(true);
      } else if (data.task) {
        // score ≤ 3 or no micro-objectives → show original task
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'bot',
            text: '¡Estás en buena forma! Aquí está tu tarea:',
          },
          {
            id: uid(),
            role: 'bot',
            task: data.task,
          },
        ]);
        setChatFinished(true);
      } else {
        // No task available — inform user
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'bot',
            text: `Puntuación registrada: ${score}. No tienes tareas activas por ahora.`,
          },
        ]);
        setChatFinished(true);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido';

      // HTTP 400 → re-prompt with inline bot message
      if (message.includes('400') || message.toLowerCase().includes('invalid') || message.toLowerCase().includes('inválido')) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'bot',
            text: 'Valor inválido, por favor ingresa un número entre 1 y 5.',
          },
        ]);
      } else {
        // 502 or other error → show original task fallback
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'bot',
            text: 'Hubo un problema al procesar tu respuesta. Mostrando tu tarea original como alternativa.',
          },
        ]);
        setChatFinished(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (sessionError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-destructive">{sessionError}</p>
      </div>
    );
  }

  if (!sessionId && !sessionError) {
    // Session initializing skeleton
    return (
      <div className="space-y-3 py-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Sesión EMA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El chatbot evaluará tu estado cognitivo para adaptar tus tareas.
        </p>
      </div>

      {/* Chat window */}
      <div className="flex flex-col rounded-lg border bg-background">
        {/* Messages area */}
        <ScrollArea className="h-[480px] px-4 py-4">
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading skeleton while waiting for backend response */}
            {isLoading && (
              <div className="flex max-w-[75%] flex-col gap-2 self-start">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            )}

            {/* Auto-scroll anchor */}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </ScrollArea>

        {/* Divider */}
        <div className="border-t" />

        {/* Input area */}
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <div className="flex gap-2">
            <Input
              id="ema-score-input"
              type="text"
              inputMode="numeric"
              pattern="[1-5]"
              placeholder="Ingresa tu puntuación (1-5)"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading || chatFinished || !sessionId}
              aria-label="Puntuación de fatiga"
              aria-describedby={inputError ? 'ema-score-error' : undefined}
              aria-invalid={!!inputError}
              className={inputError ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || chatFinished || !sessionId || inputValue.trim() === ''}
              aria-label="Enviar puntuación"
            >
              Enviar
            </Button>
          </div>

          {/* Inline validation error — NOT sent to backend */}
          {inputError && (
            <p
              id="ema-score-error"
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {inputError}
            </p>
          )}

          {chatFinished && (
            <p className="text-xs text-muted-foreground">
              Sesión completada. Puedes cerrar esta ventana o ir al dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble sub-component
// ---------------------------------------------------------------------------
function MessageBubble({ message }: { message: ChatMessage }) {
  const isBot = message.role === 'bot';

  // Micro-objectives cards (high-fatigue path)
  if (message.microObjectives && message.microObjectives.length > 0) {
    return (
      <div className="flex max-w-[90%] flex-col gap-2 self-start">
        {message.microObjectives.map((mo) => (
          <Card key={mo.id} className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{mo.content}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-xs text-muted-foreground">
                ⏱ Estimado: {mo.estimatedMinutes} min
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Original task card (low-fatigue / fallback path)
  if (message.task) {
    const { task } = message;
    return (
      <div className="flex max-w-[90%] self-start">
        <Card className="w-full border-border">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">{task.name}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-1">
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              📅 Fecha límite:{' '}
              {new Date(task.deadline).toLocaleDateString('es', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular text message
  return (
    <div
      className={[
        'max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
        isBot
          ? 'self-start rounded-tl-none bg-muted text-foreground'
          : 'self-end rounded-tr-none bg-primary text-primary-foreground',
      ].join(' ')}
    >
      {message.text}
    </div>
  );
}
