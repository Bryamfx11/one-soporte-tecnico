<div align="center">

# 🔧 ONETec

### Plataforma de Soporte Técnico

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.5-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green)

*Gestión de soporte técnico y red para ONE Telecomunicaciones S.A.S.*

[🚀 Ver en GitHub](https://github.com/Bryamfx11/one-soporte-tecnico)

</div>

---

## 📋 Descripción del Proyecto

Plataforma web corporativa para el **Área de Soporte Técnico y Redes** de **ONE Telecomunicaciones S.A.S.**.
Centraliza la gestión de incidentes (PQR), el diagnóstico estandarizado de fallas, la base de conocimiento
y los indicadores de desempeño del servicio, con acceso por roles (administrador / técnico).

| Área | Lo que cubre la plataforma |
|---|---|
| **Gestión de incidentes** | Registro, seguimiento, diagnóstico guiado y cierre de casos, con auditoría completa |
| **Diagnóstico estandarizado** | Checklist paso a paso por tipo de falla FTTH/GPON con causa raíz (Ishikawa) |
| **Base de conocimiento** | Protocolos de diagnóstico y atención consultables para capacitar al equipo |
| **Indicadores de operación** | Métricas del servicio: resolución, tiempos de atención, carga por técnico y tendencias |
| **Portal del cliente** | Reporte público de fallas y seguimiento por ticket + clave, sin exponer datos de contacto |

---

## ✨ Funcionalidades

- **Autenticación**: login con JWT, roles (admin/técnico), rutas protegidas y registro exclusivo de administradores; verificación de contraseña con tiempos constantes (evita enumerar qué correos están registrados)
- **Seguridad**: secreto JWT aleatorio por arranque cuando no viene del entorno (en desarrollo) y obligatorio en producción, tokens HS256 con issuer verificado, rate limiting por ruta, cabeceras de seguridad (CSP, COOP, CORP, Permissions-Policy, etc.), CORS restringido por orígenes permitidos, contraseñas cifradas con bcrypt, validación estricta de entradas en toda la API, manejador central de errores que nunca filtra detalles internos (JSON malformado → 400, cuerpo gigante → 413), `Cache-Control: no-store` en todas las respuestas JSON, logs de producción que redactan la clave de seguimiento del portal y sanificación de remitentes de correo para evitar inyección de cabeceras
- **Dashboard en tiempo real**: KPIs de rendimiento, gráficas de tendencia, desempeño por técnico con indicador visual de último refresco (actualizado por SSE, sin polling)
- **Gestión de Incidencias (PQR)**: CRUD completo, búsqueda, filtros por estado/tipo/barrio y **rango de fechas**, flujo de ciclo de vida; número de ticket con reintento ante colisiones y casos cerrados (resuelta/escalada) que no se reabren por API
- **Filtros compartibles**: los filtros y la página de Incidencias viven en la URL, por lo que se pueden compartir, marcar como favoritos y conservar al recargar
- **Aviso de cambios sin guardar**: los formularios (nueva incidencia y wizard de diagnóstico) advierten antes de cerrar o recargar la pestaña
- **Pendientes a la vista**: badge en el menú con el número de casos sin cerrar (nuevas + en diagnóstico), actualizado en tiempo real por SSE
- **Auditoría por incidencia**: tabla `actividad` con cada movimiento (creación, edición, diagnóstico, cierre y eliminación) con usuario, acción y detalle
- **Auditoría global (admin)**: página **Auditoría** con el historial completo de incidencias, cuentas (creación/edición/activación/desactivación) y configuración de notificaciones; nunca registra contraseñas ni datos sensibles
- **Gestión de usuarios (admin)**: creación de cuentas con rol (Administrador/Técnico), edición de nombre/email/rol/reinicio de contraseña y activación/desactivación; protecciones contra auto-desactivación, auto-cambio de rol y desactivación del último admin activo; las cuentas desactivadas no pueden ingresar ni mantener sesión
- **Diagnóstico guiado**: Checklist interactivo paso a paso por tipo de falla (FTTH/GPON), con:
  - Medición de campo (nivel óptico dBm, velocidad Mbps, pérdida de paquetes)
  - Referencia esperada por cada paso
  - Registro de causa raíz (Diagrama de Ishikawa)
- **Base de conocimiento**: Protocolos de diagnóstico consultables para capacitar nuevo personal
- **Catálogos por admin**: tipos de falla con sus consultas, causas raíz y técnicos se administran desde la aplicación (CRUD completo con protección de borrado)
- **Portal público del cliente** (`/reportar`, sin autenticación): reporta una falla y recibe `numero_ticket` + clave de seguimiento de 6 dígitos; el seguimiento devuelve solo estado/tipo/prioridad/técnico/fechas/solución (nunca datos de contacto) y cuenta con honeypot anti-spam
- **Notificaciones por correo**: SMTP configurable desde Ajustes (solo admin) con correo de prueba e historial de envíos; el cliente recibe avisos al registrar un reporte, al cambiar el estado del caso y al finalizarse
- **Adjuntos de fotos**: fotografías de la visita (1 equipo ONT por caso) subidas y servidas con autenticación, con miniaturas en el detalle y limpieza automática al eliminar el caso
- **Indicadores de Operación**: Métricas del servicio alineadas a las metas de resolución, tiempos de atención, carga por técnico y tendencia
- **Comparativo mensual**: reporte mes vs mes (nuevas, resueltas, pendientes, tiempo promedio, por tipo de falla y por técnico) con selector de mes y variaciones porcentuales
- **Backups automáticos**: snapshot diario `VACUUM INTO` (hora configurable, retención `BACKUP_KEEP`) activo en producción, con **copia espejo opcional en un directorio externo** (`BACKUP_EXTERNO_DIR`) y estado del último respaldo visible en `/api/health`
- **Restauración verificada**: `npm run restore -- <backup>` valida la integridad del snapshot antes de aplicarlo y guarda automáticamente un `pre-restore-*` del estado actual
- **Recuperación de acceso (admin)**: `npm run reset-password -- <email> <contraseña>` restablece la contraseña desde el servidor con registro en auditoría; `/api/health` reporta `admins_activos` para detectar el caso de un único administrador
- **Alertas operativas**: ante un **fallo o atraso del backup automático** se envía un correo al `alerta_email` configurado (o, si no, a los correos de admins activos) usando el mismo SMTP de las notificaciones
- **Exportación con confirmación**: al descargar reportes CSV (Dashboard e Indicadores) se muestra una notificación de éxito
- **Estados vacíos**: las gráficas muestran un mensaje claro cuando aún no hay datos, en lugar de un lienzo en blanco
- **Responsive**: menú lateral colapsable en dispositivos móviles

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 6 + Recharts + React Router 7 |
| Backend | Node.js ≥ 22.5 + Express 4 |
| Base de datos | SQLite 3 (`node:sqlite` built-in, sin dependencias nativas) |
| Autenticación | JWT (`jsonwebtoken`) + `bcryptjs` |
| Testing | `node:test` + `supertest` (API) · Vitest + Testing Library (cliente) |
| Despliegue | Node.js SPA + API estática |

---

## 🚀 Puesta en Marcha

**Requisitos:** [Node.js](https://nodejs.org/) >= 22.5 (recomendado: Node 24)

```bash
# 1. Clonar el repositorio
git clone https://github.com/Bryamfx11/one-soporte-tecnico.git
cd one-soporte-tecnico

# 2. Instalar dependencias
npm install
npm run install:all

# 3. Levantar API + cliente
npm run dev
```

- **API:** http://localhost:4000
- **Cliente:** http://localhost:5173 (proxy `/api` hacia la API)
- **Portal público:** http://localhost:5173/reportar (sin autenticación)

### 🔐 Credenciales de demostración (entorno de desarrollo)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@one.com` | `admin123` |
| Técnico | `bryam@one.com` | `tecnico123` |

> Estas credenciales se crean automáticamente en **desarrollo** al iniciar la API
> (el seed no se ejecuta sobre datos ya existentes).

> En **producción** el seed solo crea el administrador, y las credenciales se definen
> mediante variables de entorno:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Obligatoria en producción; la API no arranca si falta. Si no se define en desarrollo, se genera un secreto aleatorio por arranque (los tokens existentes quedan inválidos y se muestra un aviso) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del administrador que crea el seed |
| `ALLOWED_ORIGINS` | Orígenes de CORS permitidos (separados por coma) |
| `TRUST_PROXY` | IP/host del proxy inverso (nginx/caddy). Por defecto `loopback`; ajústalo si la API está detrás de un proxy para que el rate limiting vea IPs reales |
| `BACKUP_DIR` / `BACKUP_KEEP` | Carpeta y número de copias de respaldo (por defecto `server/backups/` y 14) |
| `BACKUP_EXTERNO_DIR` | Carpeta externa (USB/NAS/red) donde se replica cada snapshot; la poda aplica el mismo `BACKUP_KEEP`. Vacío = sin copia espejo |
| `AUTO_BACKUP_HOUR` | Hora (24h) del respaldo automático diario (por defecto 03:00) |

> Comandos operativos (ver `Producción`): `npm run backup`, `npm run restore -- <archivo.db>`,
> `npm run reset-password -- <email> <contraseña>`.

> La primera vez se crea `server/one.db` automáticamente con datos de ejemplo
> (5 tipos de falla FTTH, 24 incidencias, checklists de diagnóstico, categorías Ishikawa).

---

## 🧪 Pruebas

```bash
npm test              # Ejecuta pruebas de API y cliente
npm run test:server   # API + validaciones (node:test + supertest)
npm run test:client   # Componentes y utilidades (Vitest + Testing Library)
npm run test:e2e      # End-to-end con Playwright (Chromium, BD aislada en e2e/.tmp)
npm run lint          # ESLint (server y cliente)
```

CI (GitHub Actions) ejecuta `npm run lint` + `npm test` + `npm run build` en cada push/PR a `master`.

---

## 🏭 Producción

La API se empaqueta y despliega con **PM2** (archivo `ecosystem.config.cjs`), que además
sirve el cliente compilado desde `client/dist` cuando existe.

Configure previamente las variables de entorno descritas arriba
(`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y opcionalmente `ALLOWED_ORIGINS`).

### Despliegue en un comando

```bash
npm run deploy   # git pull --ff-only → backup → install:all → lint+tests → build → pm2 reload onetec
```

Ejecuta **lint + tests + build** antes de recargar PM2 sin cortes (cero downtime), y crea un
respaldo de la base de datos antes de tocar nada. `npm run deploy -- --no-check` saltea lint+tests.
Correr con el repositorio limpio.

### Despliegue manual

```bash
npm run build                                    # construye el cliente en client/dist
pm2 start ecosystem.config.cjs                   # inicia la API en producción (script server/index.js)
```

Límites por omisión de la API: **300 peticiones/min** en `/api`, **10 peticiones/min** en `/api/auth`
y **15 peticiones/min** en `/api/portal`. Con `NODE_ENV=production` la API registra cada petición
(`método ruta status duración`) en la salida estándar.

### Backups

- **Manual**: `npm run backup` → snapshot `VACUUM INTO` en `server/backups/` (14 copias por defecto, `BACKUP_KEEP`). Si `BACKUP_EXTERNO_DIR` está definido, cada snapshot se replica y **poda** también en esa carpeta externa (mismo `BACKUP_KEEP`).
- **Automáticos**: con `NODE_ENV=production` (o `AUTO_BACKUP=1`) se programa un respaldo diario a las `AUTO_BACKUP_HOUR` (03:00), también en `server/backups/`.
- **Restauración**: `npm run restore -- <copia.db> [destino.db]` verifica `PRAGMA integrity_check`, crea un snapshot `pre-restore-*` del estado actual en `server/backups/` y aplica la copia. Ideal probarla antes de una actualización mayor.
- **Alertas**: si el backup automático **falla** o el último respaldo tiene **más de 26 h**, se envía un correo al `alerta_email` configurado en Ajustes → Notificaciones (o a los correos de admins activos si no está definido).
- **Monitoreo**: `GET /api/health` reporta estado de la BD, del último respaldo (`backups: { ultimo, cantidad, guardados }`) y `admins_activos`, ideal para un uptime-checker externo.
- **Rotación de logs pm2**: recomendada `pm2 install pm2-logrotate` (compress, 5 MB, 10 archivos retenidos) para evitar que los logs de producción crezcan sin límite.

### Recuperación de acceso

Si se pierde la contraseña de un administrador (o muere el único admin activo):

```bash
npm run reset-password -- admin@one.com   "NuevaClaveSegura"
```

Restablece el hash en `usuarios`, deja el evento en auditoría y no requiere conocer la clave actual
(solo acceso CLI al servidor). Para evitar el caso de "único admin", crear una segunda cuenta admin
desde **Usuarios** y vigilar `admins_activos` en `/api/health`.

### HTTPS con Caddy (recomendado)

El repositorio incluye un `Caddyfile` listo para producción: TLS automático (Let's Encrypt),
redirección HTTP→HTTPS y reverse proxy a `127.0.0.1:4000`. El bloque usa `flush_interval -1`
para que el SSE del tablero (`/api/sse/events`) transmita en tiempo real sin buffering.

```bash
# 1. Apuntar el registro A del dominio al IP del servidor y abrir 80/443
# 2. Reemplazar <dominio> en el Caddyfile por el dominio real
# 3. npm run deploy (o el flujo manual de arriba)
# 4. caddy run
```

Con Caddy/nginx en la misma máquina, `TRUST_PROXY=loopback` alcanza para que el rate limiting
vea las IPs reales; si el proxy vive en otro host, configúralo con su IP/Host.

---

## 📁 Estructura del Proyecto

```
one-soporte-tecnico/
├── scripts/
│   └── deploy.cjs                          # Despliegue en un comando (npm run deploy)
├── Caddyfile                               # Reverse proxy + TLS automático (SSE friendly)
├── server/                              # API Express
│   ├── index.js                         # Arranque del servidor (+ programación de backups)
│   ├── app.js                           # Configuración de la app Express
│   ├── db.js                            # Esquema de base de datos (SQLite)
│   ├── auth.js                          # JWT y middleware de autenticación
│   ├── security.js                      # Rate limiting, cabeceras de seguridad y CORS
│   ├── validate.js                      # Validación de peticiones
│   ├── migrations.js                     # Migraciones versionadas de esquema (v1..v4)
│   ├── seed.js                           # Datos de ejemplo (checklists FTTH, causas)
│   ├── backup.js                         # Respaldos VACUUM INTO (crear/podar + copia externa)
│   ├── monitor.js                        # Backup automático diario + estado + alertas (AUTO_BACKUP_HOUR)
│   ├── notify.js                         # Envío de correos (fire-and-forget, historial)
│   ├── audit.js                          # Registro de auditoría global (incidencias + sistema)
│   ├── restore.js                        # Restauración verificada (npm run restore)
│   ├── reset-password.js                 # Recuperación de acceso admin (npm run reset-password)
│   ├── routes/
│   │   ├── auth.js                      # Login, registro y perfil
│   │   ├── incidents.js                 # CRUD incidencias + diagnóstico guiado + auditoría + adjuntos
│   │   ├── checklists.js                # Base de conocimiento y causas raíz
│   │   ├── metrics.js                   # Indicadores + comparativo mensual
│   │   ├── portal.js                    # Portal público (/reportar, ticket + clave)
│   │   ├── notifications.js             # Config SMTP, prueba e historial (admin)
│   │   ├── auditoria.js                 # Historial de auditoría global (admin)
│   │   ├── tecnicos.js
│   │   └── usuarios.js                  # Alta, edición, listado y activación de cuentas (admin)
│   └── test/                            # Pruebas de API, validación, backups, migraciones, restore y correos
└── client/                              # React (Vite)
    └── src/
        ├── pages/
        │   ├── Login.jsx                # Inicio de sesión
        │   ├── Dashboard.jsx            # KPIs y gráficas
        │   ├── Incidencias.jsx          # Lista de incidencias con filtros
        │   ├── IncidenciaDetail.jsx     # Detalle + wizard de diagnóstico + adjuntos
        │   ├── NuevaIncidencia.jsx      # Formulario de creación
        │   ├── Conocimiento.jsx         # Base de conocimiento (admin CRUD)
        │   ├── Tecnicos.jsx             # Gestión de técnicos (admin)
        │   ├── Indicadores.jsx          # Métricas del servicio
        │   ├── Comparativo.jsx          # Reporte mensual mes vs mes
        │   ├── Reportar.jsx             # Portal público del cliente
        │   ├── Ajustes.jsx              # Tema, metas de servicio y correos SMTP
        │   ├── Usuarios.jsx             # Gestión de cuentas (solo admin)
        │   ├── Auditoria.jsx            # Historial global de auditoría (solo admin)
        │   └── NotFound.jsx             # Error 404
        ├── components/
        │   ├── Layout.jsx               # Sidebar, topbar móvil y navegación
        │   ├── RequireAuth.jsx          # Guard de rutas protegidas
        │   ├── Toast.jsx                # Notificaciones (contexto)
        │   └── ui.jsx                   # Componentes reutilizables
        ├── hooks/
        │   ├── useDirtyGuard.js         # Aviso de cambios sin guardar (beforeunload)
        │   ├── useFocusTrap.js          # Trampa de foco para modales
        │   └── useTheme.js              # Tema claro/oscuro persistente
        ├── test/                        # Pruebas de componentes
        ├── api.js                       # Cliente HTTP, sesión y hook useApi
        └── sse.js                       # Hook de datos en tiempo real (Server-Sent Events)
```

---

## 📜 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

<div align="center">

*ONE Telecomunicaciones S.A.S. — Bogotá D.C.*

</div>