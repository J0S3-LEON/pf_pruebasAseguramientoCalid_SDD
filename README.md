# MindFlow

Monorepo de MindFlow con frontend Next.js 14, API NestJS, Prisma 7 y PostgreSQL.

## Arquitectura

- `apps/frontend`: interfaz Next.js y autenticación con Auth.js.
- `apps/backend`: API REST NestJS bajo `/api/v1`.
- `packages/shared`: tipos y código compartido.
- PostgreSQL: base de datos; en producción debe ser un servicio administrado.

## Requisitos locales

- Node.js 20 o superior.
- npm 9 o superior.
- Docker con Docker Compose, si se desea ejecutar la plataforma completa.

## Variables de entorno

Copia `.env.example` a `.env` en la raíz. Nunca publiques el archivo `.env`.

Backend:

- `DATABASE_URL`: conexión PostgreSQL completa. En nube agrega SSL según el proveedor.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `FRONTEND_URL`: origen permitido por CORS; acepta varios orígenes separados por coma.
- `PORT`: puerto asignado por la plataforma, con valor local `3001`.
- `AI_SERVICE_API_KEY`: clave del proveedor de IA, si el servicio la requiere.

Frontend:

- `NEXT_PUBLIC_API_URL`: URL pública del backend, incluido `/api/v1`.
- `NEXT_PUBLIC_APP_URL`: URL pública del frontend.
- `AUTH_SECRET`: secreto aleatorio independiente para Auth.js.
- `AUTH_DEBUG`: debe permanecer en `false` en producción.

Las variables `NEXT_PUBLIC_*` se incorporan al bundle durante el build; configúralas antes de construir la imagen o desplegar en Vercel.

## Desarrollo local sin Docker

Desde la raíz del repositorio:

```bash
npm ci
npm run build --workspace @mindflow/shared
npm run prisma:generate --workspace @mindflow/backend
npm run dev --workspace @mindflow/backend
```

En otra terminal:

```bash
npm run dev --workspace @mindflow/frontend
```

## Desarrollo local con Docker

El archivo `docker-compose.yml` es únicamente para desarrollo local y levanta PostgreSQL 18 Alpine, backend y frontend:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose exec backend npm run prisma:migrate:deploy --workspace @mindflow/backend
docker compose logs -f backend frontend
```

Servicios locales:

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- PostgreSQL: `localhost:5432`

## Verificación antes del despliegue

```bash
npm ci
npm run prisma:generate --workspace @mindflow/backend
npm run build --workspace @mindflow/shared
npm run build --workspace @mindflow/backend
npm run build --workspace @mindflow/frontend
npm test --workspace @mindflow/backend -- --runInBand
docker build -f apps/backend/Dockerfile -t mindflow-backend .
docker build -f apps/frontend/Dockerfile -t mindflow-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_APP_URL=https://example.com .
```

## Despliegue recomendado

Una opción simple es Vercel para el frontend, Render o Railway para el backend y Neon, Supabase o PostgreSQL administrado del mismo proveedor para la base de datos. Los tres componentes se despliegan por separado; `docker-compose.yml` no se usa en producción.

### Base de datos

1. Crea PostgreSQL administrado y copia su URL de conexión en `DATABASE_URL`.
2. Exige TLS/SSL según la documentación del proveedor.
3. Ejecuta una sola vez por versión, antes de iniciar las nuevas réplicas:

```bash
npm ci
npm run prisma:generate --workspace @mindflow/backend
npm run prisma:migrate:deploy --workspace @mindflow/backend
```

No uses `prisma migrate dev` en producción.

### Backend

Configura como directorio raíz el repositorio completo porque el backend usa el workspace `@mindflow/shared`.

- Build sin Docker: `npm ci && npm run build --workspace @mindflow/shared && npm run prisma:generate --workspace @mindflow/backend && npm run build --workspace @mindflow/backend`
- Release/predeploy: `npm run prisma:migrate:deploy --workspace @mindflow/backend`
- Start: `npm run start:prod --workspace @mindflow/backend`
- Dockerfile: `apps/backend/Dockerfile`, con contexto en la raíz.

Variables: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT` y, si aplica, `AI_SERVICE_API_KEY`.

### Frontend

En Vercel selecciona Next.js y deja la raíz del proyecto en el repositorio para conservar los workspaces. Configura `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET` y `AUTH_DEBUG=false`. El comando de build es:

```bash
npm run build --workspace @mindflow/shared && npm run build --workspace @mindflow/frontend
```

## Estado de preparación

Listo:

- Puerto dinámico y escucha en todas las interfaces del contenedor.
- CORS restringido al frontend configurado.
- Respuestas 500 sin filtrar detalles internos.
- Migraciones Prisma versionadas y scripts separados para `generate` y `migrate deploy`.
- Dockerfiles multietapa; frontend con salida standalone.
- `.env` ignorados por Git y ejemplos sin secretos reales.

Pendiente antes de publicar:

- Elegir proveedores y dominios definitivos.
- Rotar cualquier secreto que haya sido compartido fuera de un gestor seguro.
- Configurar SSL de PostgreSQL, backups, alertas y política de recuperación.
- Ejecutar migraciones contra una base de staging y realizar una prueba funcional.
- Configurar health checks y observabilidad en la plataforma elegida.

## Checklist final

- [ ] `.env` no está versionado y los secretos se almacenan en el proveedor.
- [ ] `JWT_SECRET` y `AUTH_SECRET` son distintos, aleatorios y tienen al menos 32 caracteres.
- [ ] `FRONTEND_URL` contiene únicamente los dominios autorizados.
- [ ] `NEXT_PUBLIC_API_URL` usa HTTPS y termina en `/api/v1`.
- [ ] `AUTH_DEBUG=false` y `NODE_ENV=production`.
- [ ] `prisma migrate deploy` finaliza antes de arrancar la nueva versión.
- [ ] Los builds de backend y frontend pasan desde una instalación limpia.
- [ ] Backups, health checks, logs y alertas están activos.
