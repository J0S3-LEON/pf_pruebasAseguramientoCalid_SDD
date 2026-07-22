# Matriz de trazabilidad de MindFlow

Esta matriz conecta la fuente de verdad SDD con el diseño, la implementación y
la evidencia automatizada. Los criterios se expresan con el identificador
canónico `REQ-<grupo>.<criterio>`.

| Requerimiento | Diseño | Implementación principal | Pruebas relacionadas | Áreas de impacto |
| --- | --- | --- | --- | --- |
| REQ-1.1–REQ-1.6 | `design.md` §4.1, Properties 1–5 | `apps/backend/src/auth/`; `apps/frontend/app/auth/`; `apps/frontend/auth.ts`; `apps/frontend/middleware.ts` | `apps/backend/src/auth/__tests__/auth.service.spec.ts`; `apps/backend/src/auth/__tests__/auth.property.spec.ts` | Arquitectura, Backend, Frontend, API, Pruebas, Documentación |
| REQ-2.1–REQ-2.6 | `design.md` §4.2, Properties 6–8 | `apps/backend/src/tasks/`; `apps/frontend/components/dashboard/TaskList.tsx` | `apps/backend/src/tasks/__tests__/task.service.spec.ts` | Base de datos, Backend, Frontend, API, Pruebas |
| REQ-3.1–REQ-3.5 | `design.md` §4.3, Properties 9–11, §7 | `apps/backend/src/session/`; `apps/frontend/app/ema/`; `apps/backend/prisma/schema.prisma` | `apps/backend/src/session/__tests__/session.service.spec.ts`; `apps/backend/src/__tests__/integration/db-writer.latency.spec.ts` | Arquitectura, Base de datos, Backend, Frontend, API, Pruebas |
| REQ-4.1–REQ-4.6 | `design.md` §4.4, Properties 12–13, §7 | `apps/backend/src/task-decomposer/`; `apps/backend/src/session/session.service.ts`; `apps/frontend/app/ema/page.tsx` | `apps/backend/src/task-decomposer/__tests__/task-decomposer.service.spec.ts` | Arquitectura, Base de datos, Backend, Frontend, API, Pruebas |
| REQ-5.1–REQ-5.5 | `design.md` Properties 14–15, §6.5, §13 | `apps/backend/src/dashboard/`; `apps/frontend/app/dashboard/`; `apps/frontend/components/dashboard/` | Pruebas de frontend pendientes; pruebas de servicios backend relacionadas | Backend, Frontend, API, Pruebas |
| REQ-6.1–REQ-6.5 | `design.md` §4.6, Properties 16–18, §6.6 | `apps/backend/src/notification/` | `apps/backend/src/notification/__tests__/notification.service.spec.ts`; `apps/backend/src/notification/__tests__/notification.property.spec.ts` | Base de datos, Backend, API, Pruebas |
| REQ-7.1–REQ-7.5 | `design.md` §4.7, Properties 19–20, §5 | `apps/backend/src/db-writer/`; `apps/backend/src/prisma/`; `apps/backend/prisma/` | `apps/backend/src/db-writer/__tests__/db-writer.service.spec.ts`; `apps/backend/src/__tests__/prisma-schema.smoke.spec.ts`; `apps/backend/src/__tests__/integration/db-writer.latency.spec.ts` | Arquitectura, Base de datos, Backend, Pruebas, Documentación |
| REQ-8.1–REQ-8.5 | `design.md` Property 21 | `compose.yml`; `apps/backend/Dockerfile`; `apps/frontend/Dockerfile`; `apps/backend/src/main.ts` | `apps/backend/src/__tests__/docker-config.smoke.spec.ts` | Arquitectura, Backend, Pruebas, Documentación |
| REQ-9.1–REQ-9.5 | `design.md` §2, Properties 22–23, §6, §9 | `apps/backend/src/main.ts`; `apps/backend/src/common/`; controllers under `apps/backend/src/` | `apps/backend/src/__tests__/api-gateway.property.spec.ts`; `apps/backend/src/__tests__/route-versioning.property.spec.ts` | Arquitectura, Backend, API, Pruebas, Documentación |
| REQ-10.1–REQ-10.5 | `design.md` §4.5, Properties 24–27 | `apps/backend/src/session-serializer/` | Tests específicos de Session Serializer pendientes; referencias en pruebas de Session | Backend, API, Pruebas |

## Reglas de mantenimiento

1. Todo criterio nuevo debe agregarse a esta matriz antes de considerar completa
   su implementación.
2. Si una fila indica pruebas pendientes, el reporte de impacto debe conservar
   esa observación como riesgo.
3. Los cambios de base de datos deben relacionarse con una migración nueva; no
   se reescriben migraciones ya aplicadas.
4. Las rutas son relativas a la raíz del repositorio.
5. La matriz registra relaciones iniciales y debe refinarse cuando se creen
   pruebas o se muevan componentes.
