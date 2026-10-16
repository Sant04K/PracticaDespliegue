# Diagramas de Flujo

Diagramas generados a partir del código real (`api/src/server.js`, `worker/worker.js`,
`nginx/default.conf`, `db/init.sql`, `docker-compose.yml`).

## GET /api/libros (caché Redis)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente (web)
    participant N as nginx :8080
    participant A as Express API (server.js)
    participant R as Redis (cache)
    participant D as PostgreSQL

    Note over A: Arranque: cache.connect() solo loguea fallo (l.10)

    C->>N: GET /api/libros
    N->>A: GET /libros (nginx quita el prefijo /api/, default.conf:13)
    A->>R: GET libros (l.15)
    alt HIT (clave "libros" con valor)
        R-->>A: JSON en caché
        A-->>N: 200 JSON.parse(caché) (l.16)
    else MISS (nil)
        R-->>A: nil
        A->>D: SELECT id, titulo, autor, precio FROM libros ORDER BY id (l.17)
        D-->>A: rows
        A->>R: SET libros json EX 60 (TTL 60 s) (l.18)
        A-->>N: 200 rows (l.19)
    end
    N-->>C: 200 libros[]

    Note over A,R: Sin invalidación: solo expira a los 60 s.<br/>Ninguna escritura borra la clave.
    Note over A: Sin try/catch: si Redis o PG fallan,<br/>Express 4 no captura el error y la petición queda colgada.
```

## POST /api/pedidos (cola de facturas + worker)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant N as nginx :8080
    participant A as Express API (server.js:22-31)
    participant D as PostgreSQL
    participant R as Redis (lista cola:facturas)
    participant W as Worker (worker.js)

    Note over W: Arranque: connect() + "Worker de facturas en marcha" (l.6-7)

    C->>N: POST /api/pedidos { libroId, unidades }
    N->>A: POST /pedidos

    rect rgb(240,240,255)
    Note over A,D: Parte síncrona (antes de responder)
    alt Faltan campos (l.24)
        A-->>N: 400 { error: Faltan datos }
        N-->>C: 400
    else Válido
        A->>D: INSERT INTO pedidos (libro_id, unidades) VALUES ($1,$2) RETURNING id (l.25-28)
        D-->>A: { id }
        A->>R: LPUSH cola:facturas id (l.29)
        R-->>A: OK
        A-->>N: 201 { pedido: id } (l.30)
        N-->>C: 201 { pedido: id }
    end
    end

    rect rgb(255,245,235)
    Note over R,W: Parte asíncrona (después de responder)
    W->>R: BRPOP cola:facturas 0 — bloqueante (l.9)
    R-->>W: tarea con element = id
    W->>W: console.log "Generando la factura del pedido id" (l.10)
    Note over W: Fin real del flujo: solo imprime un log.<br/>No hay tabla facturas, ni reintento, ni ACK,<br/>ni manejo de errores (sin try/catch en el while).
    end

    Note over A: Si el libro_id no existe (FK a libros),<br/>el INSERT falla sin catch: respuesta colgada.<br/>Si falla el LPUSH, queda un pedido huérfano sin cola.
    Note over C: No existe endpoint para consultar<br/>el estado de la factura.
```

## Notas de implementación

- La cola no usa Bull/RabbitMQ: es una lista Redis cruda (`LPUSH` en `server.js:29`, `BRPOP` en `worker.js:9`).
- El worker solo tiene `REDIS_URL` (`docker-compose.yml:36`), no acceso a la base de datos.
- Redis persiste con `--save 60 1` y volumen (`docker-compose.yml:65-67`): claves de caché y entradas de cola sobreviven a un reinicio.
- Las rutas Express son `/libros` y `/pedidos`; el prefijo `/api/` lo elimina nginx.

---

*Última actualización: 16/10/2026*
