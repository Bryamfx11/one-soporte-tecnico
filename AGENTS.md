# AGENTS.md

Soporte técnico platform (ONETec) — React 19 + Vite in `client/`, Express 4 in `server/`, SQLite via built-in `node:sqlite`. Two independent ESM packages orchestrated by root `package.json` (no workspaces, no TypeScript).

## Commands (run from repo root)

- Install: `npm run install:all` (handles esbuild's postinstall script on npm 11+; use this instead of per-package `npm install`)
- Dev: `npm run dev` (concurrently). API → http://localhost:4000, client → http://localhost:5173 (proxies `/api` to 4000). `npm run dev:server` / `dev:client` run each alone
- Tests: `npm test` (runs server then client). Server: `node --test --test-force-exit test/*.test.js` under `server/`. Client: `vitest run` under `client/`
- **There is no lint or typecheck** — tests are the only verification step
- Single file: `cd server && node --test test/validate.test.js` · `cd client && npx vitest run src/test/utils.test.js`
- Build (prod, client only): `npm run build` → `client/dist`

## Requirements

- Node >= 22.5 required (`node:sqlite`). DB access is **synchronous** (`DatabaseSync`) — no async/await in DB code
- Runs on Windows; commands in `package.json` use `cd X && npm run Y` chaining, so prefer `npm run <script>` over subshells

## Server

- Entrypoints: `server/app.js` is the Express app (what tests import); `server/index.js` does `listen()` + graceful shutdown
- Dev server runs `node --watch index.js`. Without `JWT_SECRET` a **random secret is generated per boot**, so every restart invalidates existing tokens
- `server/db.js` opens `server/one.db` (override with `DB_PATH`), creates the schema, and seeds (`seed.js`, WAL mode) **only for tables that are empty**. Dev seed creates `admin@one.com/admin123` (admin) and `bryam@one.com/tecnico123` (técnico); in production it only creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `JWT_SECRET` is **required in production** (`server/auth.js` throws)
- Rate limits: 300 req/min on `/api`, 10 req/min on `/api/auth` (a live login loop will hit 429)
- API tests in `server/test/api.test.js` delete `test/test.db*`, then set `process.env.DB_PATH` and `process.env.JWT_SECRET` **before** a top-level `await import('../app.js')`. Follow this pattern for new API tests — a static import triggers seeding against the real `one.db`

## Client

- Vitest config lives in the `test` block of `vite.config.js` (jsdom, globals, setup file `src/test/setup.js`)
- Session/HTTP client lives in `src/api.js`; token is `localStorage["one_soporte_token"]`. Component tests mock `../api.js`
- UI text, test names, and comments are in **Spanish**; git commit messages are in **English** conventional style (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)

## Production

- `npm run build` then `pm2 start ecosystem.config.cjs` (runs `server/index.js`; serves the built client statically from `client/dist` when present). Set `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` first