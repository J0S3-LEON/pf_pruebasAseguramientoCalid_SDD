# Implementation Plan: MindFlow

## Overview

Este plan desglosa el diseño técnico de MindFlow en tareas de codificación incrementales que construyen
el sistema de forma progresiva: primero la infraestructura, luego la base de datos, después los módulos
del backend (NestJS/TypeScript), seguido del frontend (Next.js 14), y finalmente las pruebas unitarias,
de integración y basadas en propiedades (PBT con fast-check).

Stack: Next.js 14 + TypeScript (frontend), NestJS + TypeScript (backend), PostgreSQL 15, Docker + docker-compose.

---

## Tasks

- [x] 1. Configurar estructura del monorepo e infraestructura base
  - Inicializar el monorepo con workspaces de npm (o Turborepo): carpetas `apps/frontend`, `apps/backend`, `packages/shared`.
  - Crear `packages/shared` con interfaces TypeScript compartidas: `Session`, `Task`, `FatigueRecord`, `MicroObjective`, `StudentPayload`.
  - Configurar ESLint, Prettier y `tsconfig.json` base compartidos en la raíz del monorepo.
  - Configurar Jest en la raíz con soporte para proyectos múltiples.
  - Instalar `fast-check` como dependencia de desarrollo en el workspace de backend.
  - _Requisitos: 8.1, 9.1, 9.2_

- [x] 2. Configurar Docker y docker-compose
  - Crear `Dockerfile` multi-stage para el backend NestJS: etapa `builder` (compilación TypeScript) y etapa `runner` (producción).
  - Crear `docker-compose.yml` con servicios `backend` (NestJS) y `db` (PostgreSQL 15).
  - Configurar un volumen nombrado `mindflow_pgdata` para persistencia del contenedor PostgreSQL.
  - Definir variables de entorno en `docker-compose.yml` usando `${VAR_NAME}` sin valores hardcodeados para `JWT_SECRET`, `DATABASE_URL`, `AI_SERVICE_API_KEY`.
  - Crear un archivo `.env.example` con las variables requeridas documentadas.
  - Agregar `.env` a `.gitignore`.
  - Implementar lógica de health-check en el servicio `backend` para reintentar conexión a PostgreSQL hasta 5 veces con intervalo de 5 segundos.
  - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 2.1 Prueba de smoke de configuración Docker
    - Verificar que `docker-compose.yml` define servicios `backend` y `db`.
    - Verificar que el backend no contiene valores hardcodeados de `JWT_SECRET`, `AI_SERVICE_API_KEY` o `DATABASE_URL`.
    - Verificar que el volumen `mindflow_pgdata` está declarado en `docker-compose.yml`.
    - _Requisitos: 8.1, 8.3, 8.4_


- [x] 3. Crear el esquema de base de datos PostgreSQL
  - Inicializar Prisma en `apps/backend`: `prisma init` con `provider = "postgresql"`.
  - Definir el esquema Prisma en `schema.prisma` con los modelos: `Student`, `Session`, `FatigueRecord`, `Task`, `MicroObjective`, `NotificationLog`.
  - Implementar todos los campos, tipos, valores por defecto y restricciones según el modelo de datos del diseño (UUIDs, timestamps UTC, `is_deleted`, `is_active`, `is_completed`, `is_audit_only`).
  - Agregar `CHECK` constraints en Prisma/migraciones: `fatigue_score` en [1,5] y `estimated_minutes` en (0,25].
  - Definir foreign keys: `Session → Student`, `FatigueRecord → Session + Student`, `Task → Student`, `MicroObjective → Task + Session`, `NotificationLog → Student + Task`.
  - Generar y aplicar la primera migración: `prisma migrate dev --name init`.
  - Configurar el `PrismaService` en NestJS con connection pool `min: 2, max: 10`.
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_


- [x] 4. Implementar el núcleo del backend NestJS (API_Gateway y módulo raíz)
  - Crear la aplicación NestJS en `apps/backend/src` con `AppModule`.
  - Configurar `@nestjs/config` para leer variables de entorno en tiempo de ejecución.
  - Registrar el prefijo global `/api/v1/` con `app.setGlobalPrefix('api/v1')`.
  - Implementar `GlobalExceptionFilter` que transforma todas las excepciones al envelope `{ data, error, status }`.
  - Registrar `GlobalExceptionFilter` como filtro global con `app.useGlobalFilters(...)`.
  - Implementar `ResponseInterceptor` para envolver todas las respuestas exitosas en el mismo envelope.
  - Configurar `helmet` y CORS restringido al origen definido en `FRONTEND_URL`.
  - Configurar `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
  - _Requisitos: 9.3, 9.4, 9.5_

  - [x] 4.1 Prueba de propiedad — Estructura de respuesta API (Propiedad 22)
    - **Propiedad 22: Invariante de Estructura de Respuesta del API**
    - Generar con fast-check combinaciones aleatorias de métodos HTTP, rutas válidas e inválidas y payloads.
    - Verificar que toda respuesta del `API_Gateway` contiene los campos `data`, `error` y `status`, independientemente del código HTTP (200, 201, 400, 401, 403, 404, 409, 422, 502).
    - **Valida: Requisitos 9.4, 9.5**

  - [x] 4.2 Prueba de propiedad — Versionado de rutas (Propiedad 23)
    - **Propiedad 23: Versionado de Rutas bajo /api/v1/**
    - Verificar que todos los endpoints registrados en el router comienzan con el prefijo `/api/v1/`.
    - **Valida: Requisito 9.3**


- [x] 5. Implementar Auth_Service (registro, login, JWT)
  - Crear `AuthModule` en NestJS con `AuthService`, `AuthController`, y los DTOs `RegisterDto` / `LoginDto`.
  - Implementar `register`: validar email único y contraseña ≥ 8 caracteres, hashear con bcrypt (12 rondas), persistir via `PrismaService`, retornar mensaje de confirmación en < 3 segundos.
  - Implementar `login`: verificar credenciales, retornar JWT firmado con HS256 y `expiresIn: '24h'` si son válidas, HTTP 401 genérico si no lo son.
  - Configurar `@nestjs/jwt` con `JwtModule.registerAsync` leyendo `JWT_SECRET` desde variables de entorno.
  - Implementar `JwtAuthGuard` global con excepciones explícitas para `POST /api/v1/auth/register` y `POST /api/v1/auth/login`.
  - Implementar `validateToken` en `AuthService` para decodificar y verificar JWT.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 5.1 Prueba de propiedad — Round-Trip de Registro y Login (Propiedad 1)
    - **Propiedad 1: Round-Trip de Registro y Login**
    - Generar con fast-check pares aleatorios de (email válido, contraseña ≥ 8 chars).
    - Verificar que `register → login → validateToken` retorna un JWT cuyo payload identifica al mismo Student sin pérdida de datos.
    - **Valida: Requisitos 1.1, 1.3**

  - [x] 5.2 Prueba de propiedad — Unicidad de cuenta (Propiedad 2)
    - **Propiedad 2: Unicidad de Cuenta por Correo**
    - Generar con fast-check secuencias de N ≥ 2 intentos de registro con el mismo email.
    - Verificar que exactamente una cuenta es creada y los intentos subsecuentes retornan HTTP 409.
    - **Valida: Requisito 1.2**

  - [x] 5.3 Prueba de propiedad — JWT expiración 24h (Propiedad 3)
    - **Propiedad 3: JWT con Expiración de 24 Horas**
    - Generar con fast-check credenciales válidas aleatorias y verificar que el JWT tiene `exp == iat + 86400`.
    - **Valida: Requisito 1.3**

  - [x]* 5.4 Prueba de propiedad — Rechazo de credenciales inválidas (Propiedad 4)
    - **Propiedad 4: Rechazo de Credenciales Inválidas**
    - Generar con fast-check combinaciones donde al menos un campo (email o contraseña) no corresponde a una cuenta válida.
    - Verificar HTTP 401 y que el mensaje de error no diferencia cuál campo es incorrecto.
    - **Valida: Requisito 1.4**

  - [x]* 5.5 Prueba de propiedad — Acceso con JWT válido vs. expirado (Propiedad 5)
    - **Propiedad 5: Acceso con JWT Válido vs. Rechazado con JWT Expirado**
    - Verificar que JWT con `exp > now` concede acceso (HTTP 200) y JWT con `exp <= now` retorna HTTP 401.
    - **Valida: Requisitos 1.5, 1.6**


- [x] 6. Implementar Task Module (CRUD con aislamiento por Student)
  - Crear `TaskModule` con `TaskService`, `TaskController` y DTOs `CreateTaskDto` / `UpdateTaskDto`.
  - Implementar `create`: validar que `name` no esté vacío y `deadline` sea fecha ISO válida, persistir via `PrismaService`, retornar Task creada con UUID en < 3 segundos.
  - Implementar `findAll`: retornar solo Tasks del Student autenticado con `is_deleted = false`, ordenadas por `deadline ASC`.
  - Implementar `update`: verificar que `student_id` del JWT coincide con el propietario de la Task, retornar HTTP 403 si no coincide.
  - Implementar `softDelete`: establecer `is_deleted = true` sin eliminar `MicroObjective` asociados; marcar `is_audit_only = true` en los `MicroObjective` de la Task eliminada.
  - Implementar endpoint `GET /api/v1/tasks/:taskId/micro-objectives` y `PATCH /api/v1/tasks/:taskId/micro-objectives/:moId`.
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x]* 6.1 Prueba de propiedad — Aislamiento de Tasks por Student (Propiedad 6)
    - **Propiedad 6: Aislamiento de Tasks por Student (API)**
    - Generar con fast-check pares de Students distintos con N tareas cada uno.
    - Verificar que los conjuntos de Tasks retornados son disjuntos para cualquier N y combinación.
    - **Valida: Requisitos 2.3, 2.5**

  - [x]* 6.2 Prueba de propiedad — Ordenamiento ascendente de Tasks (Propiedad 7)
    - **Propiedad 7: Ordenamiento Ascendente de Tasks por Fecha Límite**
    - Generar con fast-check listas de Tasks con deadlines aleatorios en cualquier orden de inserción.
    - Verificar que la lista retornada siempre está ordenada `deadline ASC` (non-decreasing).
    - **Valida: Requisito 2.3**

  - [x]* 6.3 Prueba de propiedad — Idempotencia de eliminación lógica (Propiedad 8)
    - **Propiedad 8: Idempotencia de Eliminación Lógica**
    - Aplicar `softDelete` N ≥ 2 veces sobre la misma Task y verificar que el estado resultante es siempre `is_deleted = true` sin errores y sin modificar otros campos o `MicroObjective` asociados.
    - **Valida: Requisito 2.6**


- [x] 7. Implementar Session_Serializer
  - Crear `SessionSerializerService` en NestJS con los métodos: `serialize(session: Session): string`, `deserialize(json: string): Session`, `serializeFatigueRecord(record: FatigueRecord): string`, `deserializeFatigueRecord(json: string): FatigueRecord`.
  - Implementar validación estricta de tipos al deserializar: rechazar payloads con campos faltantes, tipos incorrectos o valores fuera de dominio sin construir objetos parciales.
  - Garantizar preservación de tipo entero para `fatigue_score` (nunca `"4"` ni `4.0`) y de timestamps UTC (ISO 8601).
  - Usar las interfaces compartidas de `packages/shared` para los tipos `Session` y `FatigueRecord`.
  - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x]* 7.1 Prueba de propiedad — Round-Trip de Session (Propiedad 24)
    - **Propiedad 24: Round-Trip de Serialización de Session**
    - Generar con fast-check objetos `Session` aleatorios con valores dentro del dominio válido.
    - Verificar que `deserialize(serialize(session)) == session` para cualquier combinación de campos.
    - **Valida: Requisitos 10.1, 10.5**

  - [x]* 7.2 Prueba de propiedad — Idempotencia de serialización (Propiedad 25)
    - **Propiedad 25: Idempotencia de Serialización de Session**
    - Verificar que `serialize(deserialize(serialize(session))) == serialize(session)` para cualquier Session válida.
    - **Valida: Requisito 10.3**

  - [x]* 7.3 Prueba de propiedad — Preservación de tipo entero del Fatigue_Score (Propiedad 26)
    - **Propiedad 26: Preservación de Tipo Entero del Fatigue_Score en Serialización**
    - Generar con fast-check valores de `fatigue_score` en [1, 5].
    - Verificar que el JSON resultante contiene un `number` entero (sin comillas, sin punto decimal).
    - **Valida: Requisito 10.2**

  - [x]* 7.4 Prueba de propiedad — Rechazo de payloads inválidos (Propiedad 27)
    - **Propiedad 27: Rechazo de Payloads JSON Inválidos por Session_Serializer**
    - Generar con fast-check entradas JSON con campos faltantes, tipos incorrectos o valores fuera de rango.
    - Verificar que el `Session_Serializer` retorna error descriptivo sin construir objetos `Session` parciales.
    - **Valida: Requisito 10.4**


- [x] 8. Implementar EMA_Bot Module (sesiones y Fatigue_Score)
  - Crear `SessionModule` con `SessionService`, `SessionController` y `FatigueSubmitDto`.
  - Implementar `startSession`: crear registro `Session` en DB con `is_active: true`, retornar `sessionId` y el prompt inicial "¿Cómo te sientes hoy? (1-5)".
  - Implementar `submitFatigueScore`: validar que `score` sea entero en [1, 5] con `ValidationPipe` (rechazo de strings, decimales, null, booleanos y valores fuera de rango); retornar HTTP 400 con re-prompt si inválido.
  - Al recibir un score válido: invocar `SessionSerializerService.serializeFatigueRecord`, persistir via `DB_Writer`, confirmar persistencia y transicionar al flujo de interacción de tareas en < 1 segundo.
  - Implementar `getSessionHistory`: retornar las últimas 30 Sessions del Student autenticado.
  - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 8.1 Prueba de propiedad — Invariante de rango del Fatigue_Score (Propiedad 9)
    - **Propiedad 9: Invariante de Rango del Fatigue_Score**
    - Generar con fast-check valores aleatorios de todo tipo (enteros fuera de rango, decimales, strings, null, booleanos).
    - Verificar que solo valores enteros en [1, 5] son aceptados y persistidos; todos los demás son rechazados antes de llegar a la base de datos.
    - **Valida: Requisito 3.2**

  - [x]* 8.2 Prueba de propiedad — Rechazo exhaustivo de score inválido (Propiedad 11)
    - **Propiedad 11: Rechazo Exhaustivo de Fatigue_Score Fuera de Rango**
    - Generar con fast-check el universo completo de inputs inválidos: números fuera de [1,5], decimales, cadenas, null, undefined, booleanos, objetos.
    - Verificar que el `EMA_Bot` rechaza sin excepción y sin registrar ningún valor.
    - **Valida: Requisito 3.2**

  - [x]* 8.3 Prueba de propiedad — Integridad referencial del Fatigue_Score (Propiedad 10)
    - **Propiedad 10: Integridad Referencial de Metadatos de Fatigue_Score**
    - Generar con fast-check combinaciones aleatorias de (student_id, session_id, score) válidas.
    - Verificar que cada registro persistido tiene un Student y Session válidos, y contiene `recorded_at_utc` en UTC.
    - **Valida: Requisitos 3.5, 7.4**


- [x] 9. Implementar Task_Decomposer (descomposición adaptativa por fatiga)
  - Crear `TaskDecomposerService` con el método `shouldDecompose(fatigueScore: number): boolean` (true si score >= 4).
  - Implementar `decompose(task: Task, sessionId: string): Promise<MicroObjective[]>`: construir prompt para LLM externo con la descripción de la Task, invocar el servicio de IA via HTTP (`AI_SERVICE_API_KEY`), parsear la respuesta para extraer entre 2 y 7 micro-objetivos con `estimated_minutes <= 25`.
  - Implementar lógica de fallback: si la llamada al LLM falla, retornar HTTP 502 y presentar la Task en su forma original via `EMA_Bot`.
  - Integrar `TaskDecomposerService` en `SessionService`: invocar `decompose` cuando `submitFatigueScore` reciba score >= 4.
  - Persistir los `MicroObjective` generados via `DB_Writer` en < 3 segundos.
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]* 9.1 Prueba de propiedad — Umbral de descomposición por fatiga (Propiedad 12)
    - **Propiedad 12: Umbral de Descomposición por Fatiga**
    - Generar con fast-check pares aleatorios (Task, fatigueScore) con mock del LLM.
    - Verificar: si `fatigueScore >= 4` → `MicroObjective[]` no vacío; si `fatigueScore <= 3` → exactamente 0 `MicroObjective`.
    - **Valida: Requisitos 4.1, 4.2**

  - [x]* 9.2 Prueba de propiedad — Cardinalidad y duración de Micro_Objectives (Propiedad 13)
    - **Propiedad 13: Invariantes de Cardinalidad y Duración de Micro_Objectives**
    - Generar con fast-check Tasks de longitud y complejidad variables, con mock del LLM configurado para devolver listas de distintos tamaños.
    - Verificar que el número de `MicroObjective` es siempre entero en [2, 7] y que `estimated_minutes` de cada uno es entero positivo ≤ 25.
    - **Valida: Requisito 4.3**


- [x] 10. Implementar DB_Writer (capa de persistencia con Prisma)
  - Crear `DBWriterService` que encapsula todas las operaciones de escritura: `writeSession`, `writeFatigueRecord`, `writeTask`, `writeMicroObjectives`, `writeNotificationLog`.
  - Usar exclusivamente métodos del cliente Prisma (sin consultas SQL dinámicas por concatenación) para garantizar queries parametrizadas.
  - Implementar lógica de reintento: si una operación falla por `PrismaClientKnownRequestError`, reintentar exactamente una vez después de 500ms antes de propagar el error.
  - Verificar que el `PrismaService` esté configurado con connection pool `min: 2, max: 10`.
  - Implementar `readDashboardData(studentId: string)`: retornar Tasks activas ordenadas por deadline ASC, MicroObjectives pendientes agrupados por Task, y últimas 30 FatigueRecords del Student.
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 10.1 Prueba de propiedad — Seguridad contra SQL injection (Propiedad 19)
    - **Propiedad 19: Seguridad Contra Inyección SQL**
    - Generar con fast-check cadenas arbitrarias que contengan metacaracteres SQL: `'`, `--`, `;`, `DROP TABLE`, `UNION SELECT`.
    - Verificar que el `DB_Writer` persiste el valor literalmente como texto sin errores ni efectos secundarios.
    - **Valida: Requisito 7.2**

  - [x]* 10.2 Prueba de propiedad — Idempotencia de reintento de escritura (Propiedad 20)
    - **Propiedad 20: Idempotencia de Reintento de Escritura**
    - Simular con fast-check fallos en el primer intento seguidos de éxito en el reintento para cada tipo de entidad.
    - Verificar que exactamente un registro es creado en la base de datos (sin duplicados).
    - **Valida: Requisito 7.3**

  - [x]* 10.3 Prueba de propiedad — Integridad referencial (Propiedad 10 — lado DB)
    - Verificar que no es posible persistir un `MicroObjective` o `FatigueRecord` sin un Task o Session padre válido (violación de FK rechazada por Prisma/PostgreSQL).
    - **Valida: Requisitos 7.4, 3.5**


- [x] 11. Implementar Notification_Service (recordatorios con cron job)
  - Crear `NotificationModule` con `NotificationService` y `NotificationController`.
  - Implementar cron job (usando `@nestjs/schedule`) que se ejecuta cada hora: buscar Tasks con `deadline` dentro de las próximas 24 horas y con `MicroObjective` pendientes.
  - Implementar `suppressDuringSession`: verificar si el Student tiene una Session con `is_active = true`; si es así, no despachar ninguna notificación.
  - Implementar límite de frecuencia: verificar que el Student no ha recibido más de 2 notificaciones en las últimas 24 horas antes de despachar una nueva.
  - Implementar lógica de reintento: hasta 3 intentos de entrega; marcar como `failed` tras el tercer fallo y cesar reintentos.
  - Persistir cada evento de notificación (dispatched, failed, suppressed) via `DB_Writer.writeNotificationLog` en < 3 segundos.
  - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 11.1 Prueba de propiedad — Límite de frecuencia de notificaciones (Propiedad 16)
    - **Propiedad 16: Límite de Frecuencia de Notificaciones**
    - Generar con fast-check secuencias de N Tasks con deadlines próximas en una ventana de 24 horas.
    - Verificar que el total de notificaciones despachadas con estado `sent` es siempre ≤ 3 para cualquier Student.
    - **Valida: Requisito 6.5**

  - [x]* 11.2 Prueba de propiedad — Supresión durante Session activa (Propiedad 17)
    - **Propiedad 17: Supresión de Notificaciones Durante Session Activa**
    - Generar con fast-check escenarios con Session activa y N Tasks elegibles para notificación.
    - Verificar que el número de notificaciones despachadas es exactamente 0 mientras `is_active = true`.
    - **Valida: Requisito 6.4**

  - [x] 11.3 Prueba de propiedad — Registro exhaustivo de notificaciones (Propiedad 18)
    - **Propiedad 18: Registro Exhaustivo de Notificaciones**
    - Verificar que para toda notificación procesada (enviada, fallida o suprimida) existe exactamente un registro en `notification_logs` con `dispatched_at_utc` y `delivery_status` válidos.
    - **Valida: Requisito 6.2**


- [x] 12. Punto de control — Verificar integración completa del backend
  - Asegurar que todos los módulos del backend (Auth, Task, Session/EMA, TaskDecomposer, SessionSerializer, Notification, DBWriter) están correctamente registrados en `AppModule`.
  - Verificar que el prefijo global `/api/v1/` está activo y todos los endpoints responden con el envelope `{ data, error, status }`.
  - Ejecutar todas las pruebas unitarias y de propiedad del backend. Asegurarse de que pasan. Consultar al usuario si surge algún problema.

---
<!-- ═══════════════════════════════════════════════════════════════════════
     FRONTEND — FASE A (CORE)
     Construir el ciclo de vida completo usando únicamente React,
     Shadcn/ui y Tailwind CSS. SIN librerías de animación de Fase B.
     Criterio de salida: flujo completo funciona en Docker y tests pasan.
     ═══════════════════════════════════════════════════════════════════════ -->

- [x] 13. [Fase A] Configurar el proyecto frontend (Next.js 14 + Shadcn/ui)
  - Inicializar Next.js 14 en `apps/frontend` con TypeScript y App Router: `npx create-next-app@14 . --typescript --app --tailwind --eslint --no-src-dir`.
  - Instalar y configurar Shadcn/ui: `npx shadcn-ui@latest init` — escoger tema neutral, CSS variables activadas, directorio `components/ui/`.
  - Agregar los componentes Shadcn necesarios para Fase A: `button`, `input`, `card`, `checkbox`, `badge`, `dialog`, `tabs`, `skeleton`, `form`, `label`, `separator`.
  - Instalar SWR (`swr`) para fetching con revalidación y React Hook Form + Zod (`react-hook-form`, `zod`, `@hookform/resolvers`) para validación de formularios.
  - Instalar `recharts` para el gráfico de historial de fatiga.
  - Crear el archivo `lib/api.ts` con la función base `apiFetch` que agrega el JWT del almacenamiento a las cabeceras `Authorization: Bearer <token>`.
  - Crear `middleware.ts` en la raíz de `apps/frontend` para proteger todas las rutas bajo `/dashboard` y `/ema`: verificar presencia del JWT, redirigir a `/auth/login` si no existe.
  - _Requisitos: 5.1, 5.3, 1.5, 9.3_

- [x] 14. [Fase A] Implementar el frontend — Autenticación (registro y login)
  - Crear páginas `app/auth/register/page.tsx` y `app/auth/login/page.tsx` con formularios controlados via React Hook Form + Zod.
  - Implementar formulario de registro con validación cliente: email válido y contraseña ≥ 8 caracteres antes de enviar. Manejar HTTP 409 mostrando mensaje de email duplicado junto al campo. Usar componentes Shadcn `Form`, `Input`, `Button`, `Card`.
  - Implementar formulario de login: manejar HTTP 401 con mensaje genérico sin revelar cuál campo es incorrecto. Almacenar JWT en cookie HttpOnly via API Route de Next.js (`/api/auth/set-cookie`). Usar componentes Shadcn.
  - Implementar función de logout: API Route `DELETE /api/auth/logout` que limpia la cookie y redirige a `/auth/login`.
  - Crear página `app/auth/layout.tsx` con layout centrado (solo para rutas de auth).
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [x] 15. [Fase A] Implementar el frontend — Dashboard (Next.js 14 + Shadcn/ui)
  - Crear la página `app/dashboard/page.tsx` con layout de tres secciones usando grid de Tailwind: columna izquierda (TaskList), columna central (MicroObjectives pendientes) y sección inferior (FatigueHistoryChart).
  - Implementar componente `TaskList` (`components/dashboard/TaskList.tsx`): fetch con SWR a `GET /api/v1/tasks`. Mostrar cada Task en un `Card` de Shadcn, ordenadas por deadline ASC, con `Badge` de estado. Sin librerías de animación — transiciones con clases Tailwind `transition-all duration-200`.
  - Implementar componente `MicroObjectiveItem` (`components/dashboard/MicroObjectiveItem.tsx`): usar `Checkbox` de Shadcn. Al marcar como completado, `PATCH /api/v1/tasks/:taskId/micro-objectives/:moId` con optimistic update de SWR. La UI debe reflejar el cambio en < 2 segundos.
  - Implementar componente `FatigueHistoryChart` (`components/dashboard/FatigueHistoryChart.tsx`): fetch con SWR a `GET /api/v1/dashboard`. Renderizar los `fatigue_score` de las últimas 30 sesiones como `LineChart` de recharts, ordenado por `recorded_at_utc ASC`. Usar colores de Tailwind para las líneas.
  - Implementar estado vacío usando componente `EmptyState` con `Card` de Shadcn cuando el Student no tiene Sessions registradas.
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 15.1 Prueba de propiedad — Aislamiento de datos en Dashboard (Propiedad 14)
    - **Propiedad 14: Aislamiento de Datos en el Dashboard**
    - Generar con fast-check pares de Students distintos con datos propios.
    - Verificar que los datos mostrados en cada Dashboard son completamente disjuntos (sin filtración entre cuentas).
    - **Valida: Requisitos 5.1, 5.5**

  - [x]* 15.2 Prueba de propiedad — Consistencia acumulativa de actualizaciones (Propiedad 15)
    - **Propiedad 15: Consistencia Acumulativa de Actualizaciones en Dashboard**
    - Generar con fast-check secuencias de N marcas de `MicroObjective` como completado.
    - Verificar que el Dashboard refleja exactamente N cambios acumulados sin duplicados ni pérdidas.
    - **Valida: Requisito 5.2**

- [x] 16. [Fase A] Implementar el frontend — Chatbot EMA (interfaz de chat)
  - Crear la página `app/ema/page.tsx` con componente de chat usando únicamente Shadcn/ui y Tailwind: historial de mensajes en un `ScrollArea`, input en la parte inferior con `Input` + `Button` de Shadcn.
  - Al iniciar, enviar `POST /api/v1/sessions` y mostrar el prompt inicial "¿Cómo te sientes hoy? (1-5)" como burbuja de mensaje del bot (estilo Tailwind, sin animación de Fase B).
  - Implementar input con validación cliente: aceptar solo enteros en [1, 5] usando Zod. Si el valor está fuera de rango, mostrar un inline error con el componente `FormMessage` de Shadcn y no enviar al backend.
  - Al recibir un valor válido, enviar `POST /api/v1/sessions/:sessionId/fatigue { score }`. Manejar respuestas: HTTP 400 → re-prompt; score ≥ 4 con `MicroObjective[]` → listar micro-objetivos en el chat con `Card` de Shadcn; score ≤ 3 o HTTP 502 → mostrar Task original en el chat.
  - Implementar `Skeleton` de Shadcn como indicador de carga mientras se espera la respuesta del backend.
  - _Requisitos: 3.1, 3.2, 3.4, 4.1, 4.2, 4.5_

  - [x]* 16.1 Prueba de ejemplo — Primer mensaje del EMA_Bot
    - Verificar que al iniciar sesión EMA, el primer mensaje del chatbot es "¿Cómo te sientes hoy? (1-5)" o equivalente.
    - **Valida: Requisito 3.1**

  - [x]* 16.2 Prueba de ejemplo — Manejo de fallo del LLM en frontend
    - Mockear un fallo del servicio de IA (HTTP 502) y verificar que el frontend muestra la Task en forma original con mensaje descriptivo.
    - **Valida: Requisito 4.5**

- [x] 17. Punto de control — Verificar integración frontend-backend (Fase A completa)
  - Verificar que el flujo completo funciona en entorno Docker: registro → login → Dashboard → inicio de sesión EMA → submit de Fatigue_Score → visualización de micro-objetivos o Task original.
  - Confirmar que NINGUNA dependencia de Fase B está instalada en este punto.
  - Ejecutar todas las pruebas unitarias, de propiedad y de integración disponibles. Asegurarse de que pasan. Consultar al usuario si surge algún problema.

---
<!-- ═══════════════════════════════════════════════════════════════════════
     FRONTEND — FASE B (MAGIA UI)
     Solo se ejecuta DESPUÉS de que Fase A esté completamente funcional
     y todos sus tests pasen. Inyección de librerías de animación vía
     Wrapper Pattern. NO se modifica lógica de negocio ni fetching.
     ═══════════════════════════════════════════════════════════════════════ -->

- [x] 18. [Fase B] Instalar dependencias de animación y crear Wrappers
  - Instalar dependencias de Fase B en `apps/frontend`: `slot-text`, `hiraki`, `reicon`, y el paquete de `theme-toggle` de rdsx.dev.
  - Crear el directorio `apps/frontend/src/components/wrappers/`.
  - Crear `SlotTextWrapper.tsx`: encapsula `slot-text`. Usa `dynamic(() => import('slot-text'), { ssr: false })`. Fallback: `<span>{text}</span>`. Props: `text: string`, `className?: string`.
  - Crear `ThemeToggleWrapper.tsx`: encapsula el toggle de rdsx.dev para transición fluida a modo oscuro. Fallback: botón Shadcn estándar con icono de luna/sol usando `reicon`.
  - Crear `IconWrapper.tsx`: encapsula `reicon`. Expone props `name: string`, `size?: number`, `className?: string`. Fallback: `<span aria-hidden>?</span>`.
  - Crear `DrawerWrapper.tsx`: encapsula `hiraki`. Props: `trigger: ReactNode`, `children: ReactNode`, `title?: string`. Fallback: `Dialog` de Shadcn.
  - Crear `apps/frontend/src/components/wrappers/index.ts` re-exportando todos los Wrappers.
  - Verificar que todos los Wrappers compilan sin errores y que el fallback se activa cuando la librería no carga.
  - _Diseño: Sección 13.2, 13.3_

- [x] 19. [Fase B] Inyectar Wrappers en componentes existentes de Fase A
  - **SlotTextWrapper**: en `EmaChat`, reemplazar `<span>{fatigueScore}</span>` por `<SlotTextWrapper text={String(fatigueScore)} />` al mostrar el score recibido. En `MicroObjectiveItem`, animar el texto del contenido al generarse.
  - **ThemeToggleWrapper**: agregar al header del Dashboard (`app/dashboard/layout.tsx` o `components/layout/Header.tsx`). El modo oscuro debe activarse vía CSS variables de Shadcn (`dark:` clases de Tailwind).
  - **IconWrapper (reicon)**: reemplazar todos los iconos `lucide-react` del código de Fase A por `<IconWrapper name="..." />`. Actualizar imports en todos los archivos afectados.
  - **DrawerWrapper (hiraki)**: en el Dashboard, reemplazar el panel de detalle de Task (actualmente `Dialog` de Shadcn) por `<DrawerWrapper>`. En móvil, convertir el historial de fatiga en un Drawer.
  - Ejecutar todas las pruebas de Fase A para verificar que no se rompió nada con la inyección.
  - _Diseño: Sección 13.2, 13.4_

- [x] 20. Punto de control — Verificar integración frontend-backend (Fase A + Fase B)
  - Verificar que el flujo completo funciona en entorno Docker con las animaciones de Fase B activas.
  - Confirmar que el fallback estático de cada Wrapper funciona desactivando las librerías de Fase B.
  - Ejecutar todas las pruebas unitarias, de propiedad y de integración disponibles. Asegurarse de que pasan. Consultar al usuario si surge algún problema.
  - Verificar que el flujo completo funciona en entorno Docker: registro → login → Dashboard → inicio de sesión EMA → submit de Fatigue_Score → visualización de micro-objetivos o Task original.
  - Ejecutar todas las pruebas unitarias, de propiedad y de integración disponibles. Asegurarse de que pasan. Consultar al usuario si surge algún problema.


- [ ] 21. Escribir pruebas unitarias de ejemplo por módulo
  - [x] 21.1 Pruebas unitarias de Auth_Service
    - Verificar que `register` lanza HTTP 409 con email duplicado (mock de Prisma).
    - Verificar que `login` lanza HTTP 401 con contraseña incorrecta sin revelar cuál campo es inválido.
    - Verificar que `register` retorna confirmación en < 3 segundos bajo carga normal (mock).
    - _Requisitos: 1.1, 1.2, 1.4_

  - [x] 21.2 Pruebas unitarias de TaskService
    - Verificar HTTP 422 al crear Task con `name` vacío o `deadline` inválido.
    - Verificar HTTP 403 al intentar actualizar o eliminar una Task de otro Student.
    - Verificar que `softDelete` preserva los `MicroObjective` asociados con `is_audit_only = true`.
    - _Requisitos: 2.2, 2.5, 2.6_

  - [x] 17.3 Pruebas unitarias de SessionService / EMA_Bot
    - Verificar que el primer mensaje de inicio de sesión contiene el prompt de Fatigue_Score.
    - Verificar que el EMA_Bot re-prompts sin registrar si el score es inválido (mock de DB_Writer).
    - Verificar que la transición al flujo de tareas ocurre en < 1 segundo tras confirmación de persistencia (mock).
    - _Requisitos: 3.1, 3.2, 3.4_

  - [x] 17.4 Pruebas unitarias de TaskDecomposerService
    - Verificar HTTP 502 y fallback a Task original cuando el mock del LLM falla.
    - Verificar que `shouldDecompose(3)` retorna false y `shouldDecompose(4)` retorna true.
    - _Requisitos: 4.2, 4.5_

  - [x] 17.5 Pruebas unitarias de NotificationService
    - Verificar que la notificación se marca como `failed` después de exactamente 3 intentos fallidos (mock).
    - Verificar que `suppressDuringSession` retorna true cuando el Student tiene `is_active = true`.
    - _Requisitos: 6.3, 6.4_

  - [x] 17.6 Pruebas unitarias de DB_Writer
    - Verificar que el reintento ocurre exactamente una vez después de 500ms al simular un fallo de conexión (mock de Prisma).
    - Verificar que el backend reintenta la conexión a PostgreSQL exactamente 5 veces con intervalo de 5 segundos al iniciar (mock de bootstrap).
    - _Requisitos: 7.3, 8.5_


- [x] 18. Pruebas de integración del sistema
  - [x] 18.1 Prueba de integración — Arranque con docker-compose
    - Verificar que `docker-compose up` inicia todos los servicios y el API responde en < 60 segundos.
    - _Requisito: 8.2_

  - [x] 18.2 Prueba de integración — Persistencia tras reinicio PostgreSQL
    - Persistir registros, reiniciar el contenedor PostgreSQL, verificar que los datos son accesibles sin pérdida.
    - _Requisito: 8.3_

  - [x]* 18.3 Prueba de propiedad — Persistencia tras N reinicios (Propiedad 21)
    - **Propiedad 21: Persistencia de Datos Entre Reinicios del Contenedor PostgreSQL**
    - Generar con fast-check secuencias de N ≥ 1 reinicios del contenedor PostgreSQL.
    - Verificar que los datos persistidos en `mindflow_pgdata` son completamente accesibles y correctos tras cada reinicio.
    - **Valida: Requisito 8.3**

  - [x] 18.4 Prueba de integración — Latencia del DB_Writer
    - Medir latencia promedio de 10 escrituras consecutivas al DB_Writer y verificar que está dentro del rango 2-3 segundos bajo carga normal.
    - _Requisitos: 3.3, 7.1_

  - [x] 18.5 Prueba de integración — Pool de conexiones Prisma
    - Verificar que el pool de conexiones de Prisma opera con `min: 2, max: 10` conexiones activas.
    - _Requisito: 7.5_

- [x] 19. Punto de control final — Todos los tests pasan
  - Ejecutar la suite completa de pruebas: unitarias, de propiedad (PBT) y de integración.
  - Verificar que todas las 27 propiedades de corrección tienen al menos una prueba PBT con `numRuns: 100`.
  - Asegurarse de que todos los tests pasan. Consultar al usuario si surge algún problema.


---

## Notes

- Las sub-tareas marcadas con `*` son opcionales y pueden omitirse para una entrega MVP más rápida; se recomienda incluirlas para validar las 27 propiedades de corrección del diseño.
- Cada tarea referencia los requisitos específicos del documento `requirements.md` para trazabilidad completa.
- Los puntos de control (tareas 12, 16, 19) son momentos para revisar el estado del proyecto con el usuario antes de continuar.
- Las pruebas PBT con fast-check deben ejecutarse con `numRuns: 100` como mínimo según la estrategia de pruebas del diseño.
- Las propiedades 1–27 están definidas exhaustivamente en la sección 8 del documento `design.md`.
- El `Session_Serializer` debe usarse siempre que se serialice/deserialice un objeto `Session` o `FatigueRecord` hacia/desde JSON, especialmente antes de las escrituras al `DB_Writer`.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "6.1", "6.2", "6.3", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2", "10.1", "10.2", "10.3", "11.1", "11.2", "11.3"] },
    { "id": 5, "tasks": ["13.1", "13.2", "14.1", "14.2"] },
    { "id": 6, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 7, "tasks": ["18.3"] },
    { "id": 8, "tasks": ["18.4", "18.5"] }
  ]
}
```
