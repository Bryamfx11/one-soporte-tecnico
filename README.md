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

---

## ✨ Funcionalidades

- **Autenticación**: login con JWT, roles (admin/técnico), rutas protegidas y registro exclusivo de administradores; verificación de contraseña con tiempos constantes (evita enumerar qué correos están registrados)
- **Seguridad**: secreto JWT aleatorio por arranque cuando no viene del entorno (en desarrollo) y obligatorio en producción, rate limiting por ruta, cabeceras de seguridad (CSP, etc.), CORS restringido por orígenes permitidos y contraseñas cifradas con bcrypt
- **Dashboard en tiempo real**: KPIs de rendimiento, gráficas de tendencia, desempeño por técnico con indicador visual de último refresco (actualizado por SSE, sin polling)
- **Gestión de Incidencias (PQR)**: CRUD completo, búsqueda, filtros por estado/tipo/barrio y **rango de fechas**, flujo de ciclo de vida; número de ticket con reintento ante colisiones y casos cerrados (resuelta/escalada) que no se reabren por API
- **Filtros compartibles**: los filtros y la página de Incidencias viven en la URL, por lo que se pueden compartir, marcar como favoritos y conservar al recargar
- **Aviso de cambios sin guardar**: los formularios (nueva incidencia y wizard de diagnóstico) advierten antes de cerrar o recargar la pestaña
- **Pendientes a la vista**: badge en el menú con el número de casos sin cerrar (nuevas + en diagnóstico), actualizado en tiempo real por SSE
- **Auditoría por incidencia**: tabla `actividad` con cada movimiento (creación, edición, diagnóstico, cierre y eliminación) con usuario, acción y detalle
- **Gestión de usuarios (admin)**: listado y activación/desactivación de cuentas; las cuentas desactivadas no pueden ingresar ni mantener sesión
- **Diagnóstico guiado**: Checklist interactivo paso a paso por tipo de falla (FTTH/GPON), con:
  - Medición de campo (nivel óptico dBm, velocidad Mbps, pérdida de paquetes)
  - Referencia esperada por cada paso
  - Registro de causa raíz (Diagrama de Ishikawa)
- **Base de conocimiento**: Protocolos de diagnóstico consultables para capacitar nuevo personal
- **Indicadores de Operación**: Métricas del servicio alineadas a las metas de resolución, tiempos de atención, carga por técnico y tendencia
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

> La primera vez se crea `server/one.db` automáticamente con datos de ejemplo
> (5 tipos de falla FTTH, 24 incidencias, checklists de diagnóstico, categorías Ishikawa).

---

## 🧪 Pruebas

```bash
npm test              # Ejecuta pruebas de API y cliente
npm run test:server   # API + validaciones (node:test + supertest)
npm run test:client   # Componentes y utilidades (Vitest + Testing Library)
npm run lint          # ESLint (server y cliente)
```

CI (GitHub Actions) ejecuta `npm run lint` + `npm test` + `npm run build` en cada push/PR a `master`.

---

## 🏭 Producción

La API se empaqueta y despliega con **PM2** (archivo `ecosystem.config.cjs`).

```bash
npm run build                                    # construye el cliente en client/dist
pm2 start ecosystem.config.cjs                   # inicia la API en producción (script server/index.js)
```

Configure previamente las variables de entorno descritas arriba
(`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y opcionalmente `ALLOWED_ORIGINS`).

Límites por omisión de la API: **300 peticiones/min** en `/api` y **10 peticiones/min** en `/api/auth`.
Con `NODE_ENV=production` la API registra cada petición (`método ruta status duración`) en la salida estándar.

Antes de actualizar la versión desplegada, respalda la base de datos:

```bash
npm run backup   # snapshot VACUUM INTO en server/backups/ (14 copias por defecto)
```

---

## 📁 Estructura del Proyecto

```
one-soporte-tecnico/
├── server/                              # API Express
│   ├── index.js                         # Arranque del servidor
│   ├── app.js                           # Configuración de la app Express
│   ├── db.js                            # Esquema de base de datos (SQLite)
│   ├── auth.js                          # JWT y middleware de autenticación
│   ├── security.js                      # Rate limiting, cabeceras de seguridad y CORS
│   ├── validate.js                      # Validación de peticiones
│   ├── seed.js                          # Datos de ejemplo (checklists FTTH, causas)
│   ├── routes/
│   │   ├── auth.js                      # Login, registro y perfil
│   │   ├── incidents.js                 # CRUD incidencias + diagnóstico guiado + auditoría
│   │   ├── checklists.js                # Base de conocimiento y causas raíz
│   │   ├── metrics.js                   # Indicadores del dashboard
│   │   ├── tecnicos.js
│   │   └── usuarios.js                  # Listado y activación de cuentas (admin)
│   └── test/                            # Pruebas de API y validación
└── client/                              # React (Vite)
    └── src/
        ├── pages/
        │   ├── Login.jsx                # Inicio de sesión
        │   ├── Dashboard.jsx            # KPIs y gráficas
        │   ├── Incidencias.jsx          # Lista de incidencias con filtros
        │   ├── IncidenciaDetail.jsx     # Detalle + wizard de diagnóstico guiado
        │   ├── NuevaIncidencia.jsx      # Formulario de creación
        │   ├── Conocimiento.jsx         # Base de conocimiento
        │   ├── Indicadores.jsx          # Métricas del servicio
        │   ├── Ajustes.jsx              # Tema y metas de servicio
        │   ├── Usuarios.jsx             # Gestión de cuentas (solo admin)
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