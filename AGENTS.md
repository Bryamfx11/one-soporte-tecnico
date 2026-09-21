# AGENTS.md

Soporte técnico platform (ONETec) — React 19 + Vite in `client/`, Express 4 in `server/`, SQLite via built-in `node:sqlite`. Two independent ESM packages orchestrated by root `package.json` (no workspaces, no TypeScript).

## Commands (run from repo root)

- Install: `npm run install:all` (handles esbuild's postinstall script on npm 11+; use this instead of per-package `npm install`)
- Dev: `npm run dev` (concurrently). API → http://localhost:4000, client → http://localhost:5173 (proxies `/api` to 4000). `npm run dev:server` / `dev:client` run each alone
- Tests: `npm test` (runs server then client). Server: `node --test --test-force-exit test/*.test.js` under `server/`. Client: `vitest run` under `client/`
- E2E: `npm run test:e2e` (Playwright, chromium). Builds the client and boots the real server on port 4173 with an **isolated DB** (`e2e/.tmp/e2e.db`, deleted before each run) via `scripts/e2e-server.cjs`. Seed dev: `admin@one.com/admin123`, `bryam@one.com/tecnico123`; the fresh seed yields 24 incidencias and 6 pendientes (tests assert these concrete numbers). Tests live in `e2e/*.spec.js` (Spanish names) and are serial (`workers: 1`)
- Lint: `npm run lint` (ESLint 9 flat config per package; `eslint.config.js` in `server/` and `client/`). **There is no typecheck** — gate is `lint` + `test` + `build`
- Single file: `cd server && node --test test/validate.test.js` · `cd client && npx vitest run src/test/utils.test.js`
- Backup de la BD: `npm run backup` (snapshot `VACUUM INTO` en `server/backups/`, conserva `BACKUP_KEEP` copias; sobreescribible con `BACKUP_DIR`). La lógica vive en `server/backup.js` (`crearBackup`/`podarBackups`, exportados para tests) y `server/index.js` programa un backup diario a las `AUTO_BACKUP_HOUR` (03:00) cuando `NODE_ENV=production` o `AUTO_BACKUP=1`. `GET /api/health` reporta `backups: { ultimo, cantidad, guardados }`
- Build (prod, client only): `npm run build` → `client/dist`

## Requirements

- Node >= 22.5 required (`node:sqlite`). DB access is **synchronous** (`DatabaseSync`) — no async/await in DB code
- Runs on Windows; commands in `package.json` use `cd X && npm run Y` chaining, so prefer `npm run <script>` over subshells

## Server

- Entrypoints: `server/app.js` is the Express app (what tests import); `server/index.js` does `listen()` + graceful shutdown. It loads `server/.env` via `dotenv` (import at top of `app.js`); copy `server/.env.example` to persist `JWT_SECRET` in dev
- `app.js` sets `trust proxy` from `TRUST_PROXY` (default `loopback`) — set it to the real proxy IP/Host when behind nginx/caddy so the rate limiter sees client IPs
- `/api/sse/events` (SSE, `requireAuth`) pushes `{"type":"update"}` whenever incidents/técnicos change; client subscribes via `useLiveData(reload, { onChange })` in `client/src/sse.js` (Dashboard + Indicadores + `Layout`, no polling). `onChange` fires after each `update` (used to show "Actualizado HH:MM")
- `GET /api/incidents` accepts optional `desde`/`hasta` (`YYYY-MM-DD`); `hasta` is **inclusive** (`creada_en < hasta + 1 day`). Invalid format → 400 (helpers `parseFechaLocal`/`idValido` in `server/routes/incidents.js`)
- Dev server runs `node --watch index.js`. Without `JWT_SECRET` a **random secret is generated per boot**, so every restart invalidates existing tokens
- `server/db.js` opens `server/one.db` (override with `DB_PATH`), creates the schema, and seeds (`seed.js`, WAL mode) **only for tables that are empty**. Dev seed creates `admin@one.com/admin123` (admin) and `bryam@one.com/tecnico123` (técnico); in production it only creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. On startup a migration adds `activo INTEGER NOT NULL DEFAULT 1` to `usuarios` when missing (table `actividad` for audit trail is always created via `CREATE TABLE IF NOT EXISTS`)
- `JWT_SECRET` is **required in production** (`server/auth.js` throws)
- Rate limits: 300 req/min on `/api`, 10 req/min on `/api/auth` (a live login loop will hit 429). `/api/usuarios` lives outside the auth limiter (under general `/api` 300 cap). `/api/portal` has its own 15 req/min per IP
- `server/auth.js` `requireAuth` selects `activo` from `usuarios`; returns 401 when `activo === 0` (login also rejects deactivated users). `GET/PATCH /api/usuarios` require admin
- `POST /api/auth/change-password` (auth requerido) verifica `password_actual` contra el hash y actualiza a `password_nueva` (mín. 6 caracteres, distinta de la actual). `GET /api/health` ahora toca la BD: devuelve `ok`, `db: 'ok'`, `incidencias`, `uptime` y `timestamp` (503 si la BD falla)
- Notificaciones por correo (nodemailer): la config vivió en la tabla `config` (claves `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `smtp_from_name`, `notif_habilitada`) y se gestiona vía `/api/notifications` (solo admin: `GET/PUT /config`, `POST /test`, `GET /historial`). `server/notify.js` envía (fire-and-forget, nunca lanza) y registra cada intento en `notificaciones` (`enviado`/`error`/`omitido`) cuando el cliente dejó `incidencias.email`: al crear un reporte público (con clave de seguimiento), al cambiar `estado` (PATCH o diagnóstico) y al finalizar. `transporte.sendMail` es reemplazable en tests
- Adjuntos (fotos de la visita): `POST /api/incidents/:id/adjuntos` sube por JSON `{ nombre, tipo, base64 }` (solo `image/jpeg|png|webp`, máx. 5 MB; `express.json` tiene límite 8 mb), guarda el archivo en `server/uploads/<id>/` (mover con `UPLOADS_DIR`, carpeta gitignored) con nombre UUID y el metadato en la tabla `adjuntos` (FK `ON DELETE CASCADE`). `GET /:id/adjuntos` lista (sin ruta), `GET /:id/adjuntos/:adjuntoId` sirve el archivo (requireAuth; el cliente lo baja con `fetch` + token y `URL.createObjectURL`), `DELETE /:id/adjuntos/:adjuntoId` borra fila + archivo. Al eliminar una incidencia se limpia su carpeta. `GET /api/incidents/:id` ya incluye la lista (`adjuntos`). El portal público no expone adjuntos
- Los catálogos se mantienen por admin vía API: `POST/PATCH/DELETE /api/checklists/tipos`, `/api/checklists/tipos/:id/consultas`, `/api/checklists/consultas/:id`, `/api/checklists/causas-raiz` y `POST/DELETE /api/tecnicos`. El `DELETE` responde 409 si hay incidencias (`tipos_falla`, `causas_raiz`, `tecnicos`) o respuestas de diagnóstico (`consultas`) que los referencien; las consultas de un tipo se borran en cascada
- Portal público del cliente (`/api/portal`, sin auth): `GET /tipos` (catálogo), `POST /reportes` crea una incidencia (`estado` `nueva`, `prioridad` `media`, sin técnico) y devuelve `numero_ticket` + `clave_seguimiento` de 6 dígitos (columna `clave_seguimiento` en `incidencias`). Honeypot `empresa`: si viene con valor se responde 201 sin crear. `GET /incidencias/:ticket?clave=` devuelve solo estado/tipo/prioridad/técnico/fechas/solución (nunca datos de contacto); 404 si el ticket o la clave no coinciden. La página pública es `/reportar` (client)
- With `NODE_ENV=production` every request is logged as `METHOD URL STATUS DURATION`
- `GET /api/metrics/comparativo?mes=YYYY-MM` (sin mes usa el actual, hora de Bogotá UTC-5) compara el mes contra el anterior: `actual`/`anterior` (`nuevas`, `resueltas`, `pendientes` = abiertas del mes aún sin cerrar, `tiempo_promedio_ms`), `por_tipo` (nuevas por tipo de falla), `por_tecnico` y `causas`; formato inválido → 400. La página `/comparativo` (client) lo muestra con selector de mes
- `server/routes/metrics.js` agrega por zona local de Bogotá: inicios de mes = `Date.UTC(año, mes, 1) - CO_OFFSET_MS`
- API tests in `server/test/api.test.js` delete `test/test.db*`, then set `process.env.DB_PATH` and `process.env.JWT_SECRET` **before** a top-level `await import('../app.js')`. Follow this pattern for new API tests — a static import triggers seeding against the real `one.db`

## Client

- Vitest config lives in the `test` block of `vite.config.js` (jsdom, globals, setup file `src/test/setup.js`)
- Session/HTTP client lives in `src/api.js`; token is `localStorage["one_soporte_token"]`. Component tests mock `../api.js`
- Pages use `React.lazy` + `<Suspense>` for code-splitting (`client/src/App.jsx` keeps `Layout`, `RequireAuth`, `ToastProvider` eager). The smoke test in `ajustes.test.jsx` must use `await screen.findByRole(...)` for the heading to appear
- UI text, test names, and comments are in **Spanish**; git commit messages are in **English** conventional style (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- App uses `<BrowserRouter>` (not a data router), so `useBlocker` is unavailable — unsaved-changes protection is `useDirtyGuard` (`client/src/hooks/useDirtyGuard.js`, `beforeunload` only; does not intercept in-app SPA navigation)
- `Incidencias.jsx` keeps `estado`/`tipo`/`desde`/`hasta`/`page` in the URL via `useSearchParams` (shareable/back-forward); `q` is debounced (350ms) and synced to the URL
- `Layout.jsx` fetches `/metrics/dashboard` and shows a pending badge (`nueva + en_diagnostico`) on the Incidencias nav item; the logo (topbar + sidebar) links to `/`; CSV exports show a success toast and charts render empty states when there is no data

## Production

- `npm run build` then `pm2 start ecosystem.config.cjs` (runs `server/index.js`; serves the built client statically from `client/dist` when present). Set `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` first
- Schedule `npm run backup` before upgrades (respaldo SQLite vía `VACUUM INTO`)
- CI: GitHub Actions (`npm run lint` + `npm test` + `npm run build`) corre en push/PR a `master`