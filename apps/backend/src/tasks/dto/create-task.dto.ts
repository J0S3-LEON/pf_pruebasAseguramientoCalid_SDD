/**
 * CreateTaskDto — Datos requeridos para crear una Task académica.
 *
 * Validaciones:
 *  - name: string no vacío, máximo 255 caracteres.
 *  - description: string opcional.
 *  - deadline: string ISO 8601 válido (se convierte a Date en el servicio).
 *
 * Requisitos: 2.1, 2.2
 */
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  /**
   * Nombre de la Task. No puede estar vacío.
   * Requisito 2.1, 2.2
   */
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la tarea no puede estar vacío.' })
  @MaxLength(255, { message: 'El nombre no puede superar 255 caracteres.' })
  name!: string;

  /**
   * Descripción opcional de la Task.
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Fecha límite en formato ISO 8601 (e.g. "2025-06-30T23:59:59.000Z").
   * Requisito 2.1, 2.2
   */
  @IsDateString({}, { message: 'El deadline debe ser una fecha ISO 8601 válida.' })
  @IsNotEmpty({ message: 'El deadline es requerido.' })
  deadline!: string;
}
