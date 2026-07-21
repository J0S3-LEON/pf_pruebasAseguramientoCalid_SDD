/**
 * Módulo de acceso a la API del backend MindFlow.
 *
 * Estrategia de URL:
 *  - En el NAVEGADOR: usa ruta relativa '/api/v1' para que el proxy de
 *    next.config.js (rewrites) reenvíe la petición al backend NestJS.
 *    Esto evita problemas de CORS ya que la petición va al mismo origen.
 *  - En el SERVIDOR (SSR): usa la URL absoluta del backend directamente
 *    porque el proxy de Next.js no aplica en el servidor.
 *
 * Requisitos: 1.5, 5.1, 9.3
 */

// En el browser usamos ruta relativa (el proxy de Next.js maneja el reenvío).
// En el servidor (SSR/RSC) usamos la URL absoluta del backend.
const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api/v1'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1');

/** Clave bajo la cual se almacena el JWT en localStorage. */
const JWT_STORAGE_KEY = 'mindflow_token';

/**
 * Recupera el JWT almacenado en localStorage.
 * Devuelve null si no existe o si se ejecuta en el servidor (SSR).
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JWT_STORAGE_KEY);
}

/**
 * Almacena el JWT en localStorage.
 */
export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(JWT_STORAGE_KEY, token);
  }
}

/**
 * Elimina el JWT de localStorage (logout).
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(JWT_STORAGE_KEY);
  }
}

/** Opciones adicionales para apiFetch. */
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Body de la petición (se serializa automáticamente a JSON). */
  body?: unknown;
}

/**
 * Función base para realizar peticiones HTTP al backend MindFlow.
 *
 * Agrega automáticamente:
 *  - Content-Type: application/json
 *  - Authorization: Bearer <JWT>  (si existe un token en localStorage)
 *
 * @param path - Ruta relativa al API base, p.ej. "/auth/login"
 * @param options - Opciones de fetch extendidas
 * @returns Promesa con el dato tipado T extraído del campo `data` del envelope
 * @throws Error con el mensaje del servidor cuando status >= 400
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...restOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string> | undefined),
  };

  // Adjuntar JWT si está disponible — Requisito 1.5
  const token = getToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...restOptions,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // El backend usa el envelope { data, error, status } — Requisito 9.4
  const envelope = await response.json().catch(() => ({
    data: null,
    error: `Error HTTP ${response.status}`,
    status: response.status,
  }));

  if (!response.ok) {
    const errorMessage =
      typeof envelope.error === 'string'
        ? envelope.error
        : `Error HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return envelope.data as T;
}
