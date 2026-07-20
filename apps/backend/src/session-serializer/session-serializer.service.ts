/**
 * SessionSerializerService — Serialización y deserialización estricta de
 * objetos Session y FatigueRecord hacia/desde JSON.
 *
 * Garantías:
 *  - Round-trip sin pérdida de tipo: deserialize(serialize(x)) ≡ x.
 *  - Idempotencia: serialize(deserialize(serialize(x))) ≡ serialize(x).
 *  - Preservación del tipo entero para fatigue_score (nunca string ni float).
 *  - Timestamps UTC en formato ISO 8601 se conservan como strings.
 *  - Rechazo estricto: cualquier payload con campos faltantes, tipos
 *    incorrectos o valores fuera de dominio lanza un error descriptivo
 *    sin construir objetos parciales.
 *
 * Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { Session, FatigueRecord } from '@mindflow/shared';

// ─── Helpers de validación de UUID ──────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// ─── Helpers de validación de timestamps UTC (ISO 8601) ─────────────────────

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Must parse as a valid date and end with 'Z' or explicit UTC offset
  const d = new Date(value);
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
}

// ─── Helper: Integer check ───────────────────────────────────────────────────

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

// ─── Validadores de dominio ──────────────────────────────────────────────────

/**
 * Valida y construye un objeto Session a partir de datos ya parseados del JSON.
 * Lanza BadRequestException con mensaje descriptivo si la validación falla.
 * NO construye objetos parciales: o todo es válido, o lanza.
 */
function validateSession(raw: unknown): Session {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException(
      'Session inválida: se esperaba un objeto JSON, se recibió ' +
        (raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw),
    );
  }

  const obj = raw as Record<string, unknown>;

  // ── id ──
  if (!('id' in obj)) {
    throw new BadRequestException("Session inválida: campo requerido 'id' faltante.");
  }
  if (!isUuid(obj['id'])) {
    throw new BadRequestException(
      `Session inválida: 'id' debe ser un UUID v4 válido, se recibió ${JSON.stringify(obj['id'])}.`,
    );
  }

  // ── studentId ──
  if (!('studentId' in obj)) {
    throw new BadRequestException("Session inválida: campo requerido 'studentId' faltante.");
  }
  if (!isUuid(obj['studentId'])) {
    throw new BadRequestException(
      `Session inválida: 'studentId' debe ser un UUID v4 válido, se recibió ${JSON.stringify(obj['studentId'])}.`,
    );
  }

  // ── startedAt ──
  if (!('startedAt' in obj)) {
    throw new BadRequestException("Session inválida: campo requerido 'startedAt' faltante.");
  }
  if (!isUtcTimestamp(obj['startedAt'])) {
    throw new BadRequestException(
      `Session inválida: 'startedAt' debe ser un timestamp UTC en formato ISO 8601 (ej. 2025-01-01T00:00:00Z), ` +
        `se recibió ${JSON.stringify(obj['startedAt'])}.`,
    );
  }

  // ── endedAt ──
  if (!('endedAt' in obj)) {
    throw new BadRequestException("Session inválida: campo requerido 'endedAt' faltante.");
  }
  const endedAt = obj['endedAt'];
  if (endedAt !== null && !isUtcTimestamp(endedAt)) {
    throw new BadRequestException(
      `Session inválida: 'endedAt' debe ser un timestamp UTC ISO 8601 o null, ` +
        `se recibió ${JSON.stringify(endedAt)}.`,
    );
  }

  // ── isActive ──
  if (!('isActive' in obj)) {
    throw new BadRequestException("Session inválida: campo requerido 'isActive' faltante.");
  }
  if (typeof obj['isActive'] !== 'boolean') {
    throw new BadRequestException(
      `Session inválida: 'isActive' debe ser boolean, ` +
        `se recibió ${typeof obj['isActive']} (${JSON.stringify(obj['isActive'])}).`,
    );
  }

  // ── Construir objeto solo si TODA la validación pasa ──
  return {
    id: obj['id'] as string,
    studentId: obj['studentId'] as string,
    startedAt: obj['startedAt'] as string,
    endedAt: endedAt as string | null,
    isActive: obj['isActive'] as boolean,
  };
}

/**
 * Valida y construye un objeto FatigueRecord a partir de datos ya parseados.
 * Lanza BadRequestException con mensaje descriptivo si la validación falla.
 */
function validateFatigueRecord(raw: unknown): FatigueRecord {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException(
      'FatigueRecord inválido: se esperaba un objeto JSON, se recibió ' +
        (raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw),
    );
  }

  const obj = raw as Record<string, unknown>;

  // ── id ──
  if (!('id' in obj)) {
    throw new BadRequestException("FatigueRecord inválido: campo requerido 'id' faltante.");
  }
  if (!isUuid(obj['id'])) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'id' debe ser un UUID v4 válido, se recibió ${JSON.stringify(obj['id'])}.`,
    );
  }

  // ── sessionId ──
  if (!('sessionId' in obj)) {
    throw new BadRequestException("FatigueRecord inválido: campo requerido 'sessionId' faltante.");
  }
  if (!isUuid(obj['sessionId'])) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'sessionId' debe ser un UUID v4 válido, se recibió ${JSON.stringify(obj['sessionId'])}.`,
    );
  }

  // ── studentId ──
  if (!('studentId' in obj)) {
    throw new BadRequestException("FatigueRecord inválido: campo requerido 'studentId' faltante.");
  }
  if (!isUuid(obj['studentId'])) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'studentId' debe ser un UUID v4 válido, se recibió ${JSON.stringify(obj['studentId'])}.`,
    );
  }

  // ── fatigueScore ──
  if (!('fatigueScore' in obj)) {
    throw new BadRequestException(
      "FatigueRecord inválido: campo requerido 'fatigueScore' faltante.",
    );
  }
  if (!isInteger(obj['fatigueScore'])) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'fatigueScore' debe ser un número entero, ` +
        `se recibió ${typeof obj['fatigueScore']} (${JSON.stringify(obj['fatigueScore'])}).`,
    );
  }
  const score = obj['fatigueScore'] as number;
  if (score < 1 || score > 5) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'fatigueScore' debe estar en el rango [1, 5], se recibió ${score}.`,
    );
  }

  // ── recordedAtUtc ──
  if (!('recordedAtUtc' in obj)) {
    throw new BadRequestException(
      "FatigueRecord inválido: campo requerido 'recordedAtUtc' faltante.",
    );
  }
  if (!isUtcTimestamp(obj['recordedAtUtc'])) {
    throw new BadRequestException(
      `FatigueRecord inválido: 'recordedAtUtc' debe ser un timestamp UTC en formato ISO 8601, ` +
        `se recibió ${JSON.stringify(obj['recordedAtUtc'])}.`,
    );
  }

  // ── Construir objeto solo si TODA la validación pasa ──
  return {
    id: obj['id'] as string,
    sessionId: obj['sessionId'] as string,
    studentId: obj['studentId'] as string,
    fatigueScore: score,
    recordedAtUtc: obj['recordedAtUtc'] as string,
  };
}

// ─── Servicio ────────────────────────────────────────────────────────────────

@Injectable()
export class SessionSerializerService {
  /**
   * Serializa un objeto Session a JSON string.
   *
   * Los campos se serializan en orden determinístico para garantizar idempotencia.
   * fatigue_score no se serializa aquí (pertenece a FatigueRecord).
   * Los timestamps UTC se preservan como strings ISO 8601.
   *
   * Requisitos: 10.1, 10.3, 10.5
   */
  serialize(session: Session): string {
    // Construir objeto en orden determinístico
    const ordered: Session = {
      id: session.id,
      studentId: session.studentId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      isActive: session.isActive,
    };
    return JSON.stringify(ordered);
  }

  /**
   * Deserializa un JSON string a un objeto Session con validación estricta.
   *
   * Lanza BadRequestException si:
   *  - El string no es JSON válido.
   *  - Faltan campos requeridos.
   *  - Algún campo tiene tipo incorrecto.
   *  - Algún valor está fuera del dominio válido.
   *
   * NO construye objetos parciales: o retorna un Session completo y válido,
   * o lanza el error.
   *
   * Requisitos: 10.1, 10.4, 10.5
   */
  deserialize(json: string): Session {
    let raw: unknown;

    try {
      raw = JSON.parse(json);
    } catch {
      throw new BadRequestException(
        `Session inválida: el string proporcionado no es JSON válido.`,
      );
    }

    return validateSession(raw);
  }

  /**
   * Serializa un objeto FatigueRecord a JSON string.
   *
   * Preserva el tipo entero de fatigueScore: JSON.stringify de un número
   * entero produce siempre un literal numérico (ej. 4), nunca "4" ni 4.0.
   *
   * Requisitos: 10.2, 10.5
   */
  serializeFatigueRecord(record: FatigueRecord): string {
    // Construir objeto en orden determinístico
    const ordered: FatigueRecord = {
      id: record.id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      fatigueScore: record.fatigueScore,
      recordedAtUtc: record.recordedAtUtc,
    };
    return JSON.stringify(ordered);
  }

  /**
   * Deserializa un JSON string a un objeto FatigueRecord con validación estricta.
   *
   * Garantías adicionales sobre fatigueScore:
   *  - Debe ser un entero (Number.isInteger = true).
   *  - Debe estar en el rango [1, 5].
   *  - JSON.parse nunca convierte "4" → 4 implícitamente aquí; si el JSON
   *    contiene `"fatigueScore": "4"` (string), la validación lo rechaza.
   *
   * Requisitos: 10.2, 10.4, 10.5
   */
  deserializeFatigueRecord(json: string): FatigueRecord {
    let raw: unknown;

    try {
      raw = JSON.parse(json);
    } catch {
      throw new BadRequestException(
        `FatigueRecord inválido: el string proporcionado no es JSON válido.`,
      );
    }

    return validateFatigueRecord(raw);
  }
}
