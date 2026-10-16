# Ficha de puesta en producción — Tienda de Libros

| Campo | Valor |
|---|---|
| Aplicación | Tienda de Libros (e-commerce de libros) |
| Código | `tienda-libros/` (API Express + worker + nginx + PostgreSQL + Redis) |
| Versión actual | api v1.2.0 / worker v1.0.0 |
| Documento generado | 16/10/2026 |
| Fuente de verdad de la arquitectura real | `docs/diagramas.md` (**no** usar `docs/arquitectura.md`, es una plantilla aspiracional) |

Leyenda: ✅ = ya trae la aplicación · ❌ = hay que añadirlo para producción

---

## 1. Hardware o instancia

| Elemento | Estado | Detalle |
|---|---|---|
| Despliegue por Docker Compose (5 servicios) | ✅ | `docker-compose.yml`: proxy, api, worker, db, cache |
| Reinicio automático de servicios | ✅ | `restart: unless-stopped` en los 5 servicios |
| Especificación mínima de servidor | ❌ | No documentada. Recomendación: 1 VM/instancia con **2 vCPU / 4 GB RAM / 40 GB SSD** (PostgreSQL 16 + Redis + Node + nginx en la misma máquina) |
| Usuario no-root en contenedores | ❌ | Los Dockerfiles corren como root (alpine sin `USER`) |
| Fijado de digest de imágenes | ❌ | Se usan tags flotantes (`nginx:1.27-alpine`, `postgres:16-alpine`, `redis:7-alpine`, `node:20-alpine`) |
| IaC (Terraform/Ansible) | ❌ | No existe; el servidor se aprovisionaría a mano |
| Proveedor sugerido | ❌ | Cualquier VPS (DigitalOcean, Hetzner, AWS EC2/Lightsail) con Docker + Compose v2 instalados |

## 2. Software y versiones

| Componente | Estado | Versión |
|---|---|---|
| Node.js (imagen base) | ✅ | `node:20-alpine` (solo implícita; falta `engines` en package.json) |
| Express | ✅ | `^4.19.2` (API) |
| pg (cliente PostgreSQL) | ✅ | `^8.11.5` |
| redis (cliente) | ✅ | `^4.6.13` (api y worker) |
| jsonwebtoken | ⚠️ | `^9.0.2` instalado pero **nunca usado** en el código |
| nginx | ✅ | `1.27-alpine` (reverse proxy + estáticos) |
| PostgreSQL | ✅ | `16-alpine` |
| Redis | ✅ | `7-alpine` (cola `cola:facturas` + caché libros) |
| `package-lock.json` | ❌ | **No existe** en api ni worker → builds no reproducibles |
| `npm ci` en build | ❌ | Los Dockerfiles usan `npm install --omit=dev` |
| `.dockerignore` | ❌ | No existe |
| Herramienta de migraciones de BD | ❌ | Solo `db/init.sql` (se ejecuta 1 vez, en el primer arranque); no hay Flyway/Knex/node-pg-migrate |
| Tests / linter / formateador | ❌ | Cero tests, sin script `test`, sin ESLint/Prettier |
| CI/CD | ❌ | Sin `.github/`, `.gitlab-ci.yml` ni similar |
| README / LICENSE | ❌ | No existe ninguno en el repo |

## 3. Red (dominio, DNS, puertos, cortafuegos)

| Elemento | Estado | Detalle |
|---|---|---|
| Proxy inverso nginx con strip de prefijo `/api/` | ✅ | `nginx/default.conf`: `proxy_pass http://api:3000/` |
| Fallback SPA / serve de estáticos | ✅ | `try_files $uri $uri/ /index.html` |
| Aislamiento de red interna | ✅ | Solo el proxy publica puerto; api/worker/db/cache inaccesibles desde fuera |
| Puerto externo publicado | ✅ | `8080:80` (HTTP) |
| Dominio | ❌ | `server_name _;` acepta cualquier Host. Hay que comprar/registrar dominio (p. ej. `tiendalibros.example.com`) y apuntar el A/AAAA record al IP del servidor |
| HTTPS / TLS | ❌ | nginx solo escucha el 80. Añadir puerto `443`, redirect 80→443 y certificado (recomendado: **Certbot** o **Caddy**/Traefik con Let's Encrypt) |
| Cabeceras de seguridad HTTP | ❌ | Falta `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, CSP (no se usa helmet) |
| Rate limiting | ❌ | `POST /api/pedidos` es anónimo e ilimitado (ampliación de DoS). Añadir `limit_req` en nginx o `express-rate-limit` |
| CORS | ❌ | Sin configuración (hoy mismo-origin vía nginx, pero conviene definirlo explícitamente) |
| Cortafuegos del servidor | ❌ | Abrir **solo** 22 (SSH, ideally restringido a IP fija), 80 y 443. Bloquear 5432, 6379, 3000 y 8080 (tráfico solo local/Docker) |
| SSH | ❌ | Deshabilitar login con password, usar solo clave; considerar Crowdsec/fail2ban |

## 4. Seguridad y secretos

| Elemento | Estado | Detalle |
|---|---|---|
| Secretos fuera de git | ✅ | `.env` está en `.gitignore`; existe `.env.example` como plantilla |
| SQL parametrizado | ✅ | Todas las consultas usan `$1, $2` (`api/src/server.js`) |
| Gestor de secretos | ❌ | Solo `.env` plano. Añadir permisos `chmod 600 .env`; a medio plazo migrar a Docker secrets / SOPS / Vault |
| Contraseña de PostgreSQL embebida en la URL | ❌ | `DATABASE_URL: postgres://tienda:${POSTGRES_PASSWORD}@...` queda visible en `docker inspect` / `docker compose config`. Separar en variables (`PGPASSWORD` o secrets de Compose) |
| `JWT_SECRET` | ⚠️ | Se inyecta en la API pero **no se lee** en el código; `jsonwebtoken` no se usa |
| Autenticación/Autorización | ❌ | No existe: `POST /api/pedidos` es anónimo. Implementar login + JWT (ya está la dependencia) y proteger la creación de pedidos |
| Validación de entrada | ❌ | Solo se comprueba presencia de campos: `unidades` puede ser negativo/decimal/cadena; `libroId` no se valida contra la BD (FK → request colgada). Añadir `zod`/`joi` |
| Manejo de errores | ❌ | **Cero `try/catch`**: un fallo de Redis/PG deja la petición colgada (verificado y documentado en `docs/diagramas.md:35,78`) |
| Límite de tamaño de body | ❌ | `express.json()` sin límite → vector de DoS |
| XSS en frontend | ⚠️ | `web/index.html` inserta título/autor con `innerHTML` sin escapar |
| Actualizaciones de seguridad | ❌ | Proceso para renovar imágenes base y dependencias (Dependabot/Renovate o revisión manual mensual) |

## 5. Entornos

| Elemento | Estado | Detalle |
|---|---|---|
| `NODE_ENV: production` | ✅ | Definido en compose (aunque el código hoy no lo usa) |
| Separación de entornos | ❌ | Solo existe un compose local. Añadir: `docker-compose.prod.yml` (o overrides), `.env.production` con valores reales y un entorno **staging** antes de prod |
| Pipeline de despliegue | ❌ | Sin CI/CD. Mínimo recomendado: GitHub Actions que ejecute lint+test, build de imágenes y despliegue por SSH/`docker compose pull` |
| Variables de entorno por entorno | ⚌ parcial | Variables actuales: `POSTGRES_PASSWORD`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`, `POSTGRES_DB`, `POSTGRES_USER`. Documentar cuáles cambian entre staging y prod |
| Versionado del código | ❌ | **Todo el código está sin commitear** (solo `.gitignore` está en git). Paso 0: `git add -A && commit`, crear remoto y tag de release antes de desplegar |

## 6. Datos y copias de seguridad

| Elemento | Estado | Detalle |
|---|---|---|
| Persistencia de PostgreSQL | ✅ | Volumen nombrado `datos-db:/var/lib/postgresql/data` |
| Persistencia de Redis | ✅ | `--save 60 1` + volumen `datos-cache:/data` |
| Esquema y seed inicial | ✅ | `db/init.sql`: tablas `libros` y `pedidos` + 3 libros de ejemplo |
| Backup automático de BD | ❌ | **No existe**. Añadir cron diario: `pg_dump -U tienda tienda | gzip > tienda-$(date).sql.gz` + subida a S3/B2/offsite + retención 7/30 días |
| Backup de Redis | ❌ | No crítico (cola y caché recreables), pero documentarlo como pérdida aceptable |
| Restauración probada | ❌ | Sin runbook de restore; probar el restore en staging antes de producción |
| Cola de facturas duradera | ❌ | Lista Redis cruda sin ACK ni reintentos: si el worker muere con la tarea en proceso, **se pierde**. A considerar: migrar a tabla PostgreSQL o a BullMQ con reintentos |
| Migraciones evolutivas | ❌ | Cambios en `init.sql` no se aplican a BDs ya existentes → implementar migraciones versionadas antes del primer esquema real |

## 7. Monitorización y registros

| Elemento | Estado | Detalle |
|---|---|---|
| Endpoint de salud de la API | ✅ básico | `GET /api/salud` → `{"estado":"ok"}` (no comprueba PG ni Redis) |
| Healthcheck de PostgreSQL | ✅ | `pg_isready` en compose (10s, 5 reintentos) + `depends_on: service_healthy` |
| Rotación de logs | ✅ | `json-file max-size 10m, max-file 3` en api y worker |
| Logs estructurados | ❌ | Solo `console.log/error` crudos. Añadir pino/winston con niveles y request-id |
| Healthcheck de api, worker y proxy | ❌ | El worker **no tiene healthcheck**: si su bucle `brPop` muere, muere en silencio. Añadir healthchecks en los 3 |
| Métricas | ❌ | Sin Prometheus/Grafana. Mínimo: exporter de node + PostgreSQL exporter + alertas |
| Alertas | ❌ | Sin canales de alerta (email/Telegram/PagerDuty). Definir alertas de: 5xx, latencia, disco, RAM, worker caído |
| Log centralizado | ❌ | Logs locales con rotación. A considerar: Loki/Vector o shipping a un SaaS |
| APM / tracing | ❌ | No existe; opcional (OpenTelemetry) según criticidad |

## 8. Fases del despliegue

| Fase | Acción | Contenido |
|---|---|---|
| **0. Preparación de repo** | Commit y remoto | `git add -A`, commit del código (¡hoy todo está sin versionar!), crear remoto, corregir email del autor, tag `v1.2.0` |
| **1. Endurecimiento mínimo** | Código | try/catch en rutas, validación de entrada, límite de body, `npm ci`, generar `package-lock.json`, healthchecks de compose para api/worker/proxy, `USER` no-root en Dockerfiles |
| **2. Seguridad de red** | Infra | Dominio + DNS (A record), TLS con Certbot/Caddy, redirect 80→443, cortafuegos (solo 22/80/443), cabeceras de seguridad, rate limit en nginx |
| **3. Secretos y BD** | Config | `.env` real con `POSTGRES_PASSWORD` fuerte y `JWT_SECRET` aleatoria (32+ bytes), `chmod 600`, fuera de git y del servidor de build |
| **4. Copias de seguridad** | Datos | Cron de `pg_dump` diario + destino offsite + **restauración de prueba** en staging + runbook escrito |
| **5. Staging** | Entorno | Levantar el stack completo en una instancia staging con dominio aparte, ejecutar smoke tests (`GET /api/libros`, `POST /api/pedidos`, `GET /api/salud`) |
| **6. Producción** | Despliegue | Subir imágenes/tag fijados, `docker compose up -d --build`, verificar salud de los 5 servicios y smoke test manual |
| **7. Post-despliegue** | Operación | Ver logs (`docker compose logs -f`), confirmar métricas/alertas activas, documentar README operativo, abrir 8080 solo si hace falta (ideal: despublicar y servir solo por 443) |

## 9. Plan de vuelta atrás (rollback)

| Escenario | Acción |
|---|---|
| **Fallo visible tras el despliegue (compose up falla o smoke test roto)** | 1) `git checkout <tag-anterior>` (p. ej. `v1.2.0`); 2) `docker compose -f docker-compose.yml up -d --build`; 3) verificar `GET /api/salud` y `GET /api/libros`; 4) si el fallo es de esquema SQL, aplicar el dump anterior (ver abajo) |
| **Fallo por migración/esquema de BD incompatible** | 1) Parar api y worker: `docker compose stop api worker`; 2) restaurar el dump pre-despliegue: `gunzip -c backup-pre-despliegue.sql.gz | docker compose exec -T db psql -U tienda -d tienda`; 3) redeploy del tag anterior; 4) levantar api/worker |
| **Imagen rota o no arranca** | `docker compose pull` del tag anterior (si se publican tags inmutables) o reconstruir desde el commit anterior; no usar `latest` como única etiqueta |
| **Datos corruptos por pedidos mal validados** | Restaurar dump reciente y auditar `pedidos` desde el timestamp del despliegue; requeue manual de facturas pendientes (la cola Redis se puede drenar: `BRPOP cola:facturas`) |
| **Reglas del plan** | • Todo despliegue en prod va precedido de un **dump de BD** (paso obligatorio, no opcional).<br>• Mantener los últimos 3 dumps + el dump "pre-despliegue" hasta confirmar estabilidad 24 h.<br>• El rollback se ejecuta sin tocar datos: solo cambiar tag de imagen + restaurar si el esquema cambió.<br>• Tiempo objetivo de recuperación (RTO): **15 minutos**; pérdida máxima de datos (RPO): **24 h** (copia diaria) — mejorar a RPO 1 h si el negocio lo exige.<br>• Tras cada rollback, abrir incidencia y documentar la causa antes de reintentar. |

---

## Resumen de prioridades

**Bloqueantes para salir a producción:** commit del código en git · manejo de errores (0 `try/catch` hoy) · validación de entrada · HTTPS+dominio · autenticación en `POST /api/pedidos` · backup de BD probado · secretos bien gestionados · lockfiles y `npm ci`.

**Mejoras importantes (primeros días):** healthchecks de api/worker/proxy · logs estructurados · métricas y alertas · staging + CI/CD · usuario no-root · rate limiting.

**Puede esperar:** IaC · log centralizado · APM · migración de la cola a BullMQ · multi-instancia/escala horizontal.
