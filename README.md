# Control Finanzas PWA

Aplicación de finanzas personales hecha con Angular 21, offline-first (Service Worker + IndexedDB), con backend propio (Fastify + PostgreSQL) desplegado en un servidor con Docker.

## Funcionalidades

- Registro de ingresos y gastos.
- Gestión de categorías.
- Presupuestos mensuales por categoría.
- Reporte visual de tendencia de 6 meses.
- Exportación CSV.
- Cuentas de usuario con foto de perfil.
- PWA instalable y usable offline: las operaciones hechas sin conexión se encolan y se sincronizan al reconectar.

## Arquitectura

```
Internet ──HTTPS──▶ Tailscale Funnel ──▶ 127.0.0.1:8090
                                          │
                              ┌───────────▼───────────┐
                              │ web (Caddy)           │  PWA estática + /avatars
                              │   /api/* ──▶ api:3000 │
                              └───────────┬───────────┘
                              ┌───────────▼───────────┐
                              │ api (Node 24/Fastify) │  auth JWT, datos, avatares
                              └───────────┬───────────┘
                              ┌───────────▼───────────┐
                              │ db (PostgreSQL 16)    │
                              └───────────────────────┘
```

- `src/`: PWA Angular. Llama a la API en la misma origin (`/api`).
- `server/`: API. Las migraciones de `server/migrations/` se aplican solas al arrancar.
- `deploy/`: `docker-compose.yml`, imagen web (Caddy), script de despliegue y de backup.

### API

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/register` | Crear cuenta → `{ token, user }` |
| POST | `/api/auth/login` | Iniciar sesión → `{ token, user }` |
| GET | `/api/auth/me` | Renovar token y datos del usuario |
| POST | `/api/auth/avatar` | Subir foto de perfil (multipart, máx. 2 MB) |
| GET | `/api/finance/snapshot` | Categorías, transacciones y presupuestos |
| POST | `/api/finance/transactions` | Crear transacción (idempotente) |
| DELETE | `/api/finance/transactions/:id` | Borrar transacción |
| POST | `/api/finance/categories` | Crear categoría (idempotente) |
| PUT | `/api/finance/budgets` | Crear o actualizar presupuesto del mes |

## Desarrollo local

Requiere Docker. `ng serve` redirige `/api` y `/avatars` al stack local (`proxy.conf.json`).

```bash
npm install
cp deploy/.env.example deploy/.env   # y completar los secretos
npm run build && docker compose -f deploy/docker-compose.yml up -d --build
npm start
```

## Despliegue

Servidor: `suenos-dev` (Ubuntu + Docker), código en `~/deploy/finance-pwa`. Desde la raíz del repo, en Git Bash:

```bash
./deploy/deploy.sh
```

Compila la PWA, sube el código por SSH (llave `~/.ssh/id_ed25519_suenos`), reconstruye las imágenes y espera a que el stack esté sano. La primera vez genera `deploy/.env` en el servidor con secretos aleatorios.

Variables de `deploy/.env` (ver `deploy/.env.example`):

- `POSTGRES_PASSWORD`, `JWT_SECRET`: secretos, nunca en el repo.
- `ALLOW_SIGNUP`: `false` para cerrar el registro de cuentas nuevas.
- `WEB_PORT`: puerto local de la web (8090 por defecto).

La app se publica con [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) (una sola vez en el servidor):

```bash
sudo tailscale funnel --bg 8090
```

## Backups

`deploy/backup.sh` guarda un `pg_dump` y las fotos de perfil en `~/backups/finance` (retiene 14 días). Para correrlo cada día a las 3 a. m., en el servidor:

```bash
(crontab -l 2>/dev/null; echo '0 3 * * * ~/deploy/finance-pwa/deploy/backup.sh >> ~/backups/finance/backup.log 2>&1') | crontab -
```
