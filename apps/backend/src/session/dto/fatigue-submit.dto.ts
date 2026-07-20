/**
 * FatigueSubmitDto — DTO para la submisión del Fatigue_Score.
 *
 * Valida que `score` sea un entero en el rango [1, 5].
 * Rechaza strings, decimales, null, booleanos y valores fuera de rango
 * mediante class-validator con el ValidationPipe global (errorHttpStatusCode: 422).
 *
 * El endpoint retorna HTTP 400 con re-prompt cuando la validación falla
 * (manejo en el controlador por si se requiere 400 en vez del 422 global).
 *
 * Requisitos: 3.2, 3.3
 */
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FatigueSubmitDto {
  /**
   * Puntuación de fatiga autoreportada por el estudiante.
   * Debe ser un entero en el rango [1, 5].
   * Strings, decimales, null y booleanos son rechazados.
   */
  @Type(() => Number)
  @IsInt({ message: 'El score debe ser un número entero.' })
  @Min(1, { message: 'El score mínimo es 1.' })
  @Max(5, { message: 'El score máximo es 5.' })
  score!: number;
}
