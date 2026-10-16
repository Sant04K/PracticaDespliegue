# Registro de prompts importantes

## 2026-10-16 — Registro de prompts en modo lectura

- **Prompt (resumido):** Pedí que, por cada prompt importante, se rellene un archivo `prompt.md` con tres campos: prompt resumido, qué hizo el agente y qué corrigió yo.
- **Qué hizo el agente:** Se ejecutó en modo lectura (plan mode). Exploró el workspace (estructura de `tienda-libros`, historial de git, `docs/arquitectura.md`, `opencode.json`), formuló preguntas de clarificación (formato del registro, criterio de "prompt importante", si reconstruir historial) y presentó un plan: crear un único `prompt.md` acumulativo en la raíz, registrar solo tareas grandes de código, empezar de cero, y avisar de que `edit: deny` en `opencode.json` bloquearía las ediciones.
- **Qué corregí yo:** Respondí las preguntas definiendo el formato (un solo archivo `prompt.md` acumulativo, registrar solo tareas de código grandes, sin historial previo) y ordené pasar a modo edición para crear el archivo con esta primera entrada.

## 2026-10-16 — Inventario de componentes (docker-compose)

- **Prompt (resumido):** Pedí un inventario de los servicios en tabla (imagen/construcción, puertos externo/interno, volúmenes, dependencias y función) y qué servicio es accesible desde el exterior.
- **Qué hizo el agente:** En modo lectura analizó `docker-compose.yml`, `nginx/default.conf`, los Dockerfiles y el código de `api/src/server.js` y `worker/worker.js`; entregó la tabla de los 5 servicios (proxy, api, worker, db, cache) y explicó que solo `proxy` publica puerto (`8080:80`), siendo la API accesible solo vía `/api/` del proxy.
- **Qué corregí yo:** — (sin correcciones)

## 2026-10-16 — Diagramas Mermaid (GET /libros y POST /pedidos)

- **Prompt (resumido):** Pedí al agente dos diagramas Mermaid: el de GET /api/libros (incluyendo la caché) y el de POST /api/pedidos (incluyendo la cola de facturas y el worker).
- **Qué hizo el agente:** Exploró el código real (`api/src/server.js`, `worker/worker.js`, `nginx/default.conf`, `db/init.sql`, `docker-compose.yml`) y devolvió dos `sequenceDiagram` con referencias a líneas, señalando que la cola es una lista Redis cruda (LPUSH/BRPOP), que el worker solo imprime un log y que no hay invalidación de caché (solo TTL 60 s).
- **Qué corregí yo:** Pedí corregirlo y repetirlo: unificar el hop de nginx en todas las ramas, eliminar entidades HTML (`&lt;`) que rompían el render y añadir notas sobre la FK `libro_id` y el cliente Redis compartido entre caché y cola.

## 2026-10-16 — Creación de docs/diagramas.md

- **Prompt (resumido):** "creamos los diagramas."
- **Qué hizo el agente:** Creó `tienda-libros/docs/diagramas.md` con los dos diagramas y notas de implementación, y los validó parseándolos con mermaid v11 en `/tmp/opencode/mmd` (2 bloques: OK).
- **Qué corregí yo:** — (sin correcciones)

## 2026-10-16 — Modelo de arquitectura y teoría de la unidad

- **Prompt (resumido):** Pregunté al agente qué modelo de arquitectura sigue la aplicación y por qué, exigiendo el contraste con la teoría de la unidad y con los ficheros, con evidencias concretas (número de despliegues independientes, quién habla con la base de datos, cómo se comunican los servicios).
- **Qué hizo el agente:** Informe con evidencia file:line: n-tier (presentación/aplicación/datos) + cola asíncrona desplegado en 5 unidades de despliegue, de las que 2 son stateful (db, cache); solo `api` tiene `DATABASE_URL` (el worker no); comunicación web→nginx→api por HTTP con strip de `/api/`, api→db por TCP y api→worker por LPUSH/BRPOP; 1 sola unidad de negocio ⇒ clasificación "monolito ligero con worker asíncrono, no microservicios". Detectó además que `docs/arquitectura.md` es aspiracional (React/Vue, GraphQL, auth, carrito: no existen).
- **Qué corregí yo:** — (sin correcciones)

## 2026-10-16 — Ficha de puesta en producción

- **Prompt (resumido):** Pedí redactar la ficha para poner la aplicación en producción (hardware/instancia, software y versiones, red con dominio/DNS/puertos/cortafuegos, seguridad y secretos, entornos, datos y copias de seguridad, monitorización y registros, fases del despliegue y plan de vuelta atrás), exigiendo distinguir con claridad lo que la app ya trae de lo que hay que añadir.
- **Qué hizo el agente:** Exploró el 100 % del repo (16 ficheros) y creó `tienda-libros/docs/ficha-produccion.md` con 9 secciones y marcado ✅ (ya trae) / ❌ (falta). Hallazgos clave registrados: sin try/catch, sin tests, sin CI/CD, sin HTTPS, sin lockfiles, `JWT_SECRET`/`jsonwebtoken` sin usar, `POST /api/pedidos` anónimo, sin backups, healthcheck solo en db, y todo el código sin commitear. Añadió resumen de prioridades (bloqueantes / importantes / puede esperar) y un rollback con RTO 15 min / RPO 24 h.
- **Qué corregí yo:** — (sin correcciones)
