/**
 * UpdateTaskDto — Datos opcionales para actualizar una Task académica.
 *
 * Todos los campos son opcionales: se aplica partial update.
 * Las mismas reglas de validación que CreateTaskDto cuando se proveen.
 *
 * Requisitos: 2.4
 */
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTaskDto {
  /**
   * Nuevo nombre de la Task (opcional). No puede estar vacío si se provee.
   * Requisito 2.4
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la tarea no puede estar vacío.' })
  @MaxLength(255, { message: 'El nombre no puede superar 255 caracteres.' })
  name?: string;

  /**
   * Nueva descripción (opcional).
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Nueva fecha límite en formato ISO 8601 (opcional).
   * Requisito 2.4
   */
  @IsOptional()
  @IsDateString({}, { message: 'El deadline debe ser una fecha ISO 8601 válida.' })
  deadline?: string;
}
