<div align="center">

# 🔧 ONETec

### Plataforma de Soporte Técnico

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.5-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green)
![Status](https://img.shields.io/badge/Estado-Activo-brightgreen)

*Optimización del Proceso de Soporte Técnico en ONE Telecomunicaciones S.A.S.*

[📄 Informe del Plan de Mejora](docs/Informe_Plan_de_Mejora_N3.pdf) ·
[🚀 Ver en GitHub](https://github.com/Bryamfx11/one-soporte-tecnico) ·
[📊 App (desplegada)](http://localhost:4000)

</div>

---

## 📋 Descripción del Proyecto

Plataforma web de soporte técnico para **ONE Telecomunicaciones S.A.S.** desarrollada como
propuesta del **Informe Final de Plan de Mejora Nivel 3** (Bryam Stevens Villalba Culma,
Ingeniería de Software — Semestre 7, Promoción 15B).

El proyecto implementa los tres objetivos específicos del plan:

| # | Objetivo | Funcionalidad en la plataforma |
|---|---|---|
| 1 | **Diagnosticar** las causas de los tiempos de respuesta prolongados | Dashboard con KPIs, gráficas de tendencia y top causas raíz recurrentes |
| 2 | **Analizar** los procesos actuales de atención y mantenimiento de red | Tiempo promedio por tipo de falla, carga por técnico, cuellos de botella |
| 3 | **Proponer** un protocolo estandarizado de diagnóstico y atención de fallas | Checklist guiado paso a paso por tipo de falla FTTH/GPON con registro de causa raíz |

---

## ✨ Funcionalidades

- **Autenticación**: login con JWT, roles (admin/técnico), rutas protegidas y registro exclusivo de administradores; verificación de contraseña con tiempos constantes (evita enumerar qué correos están registrados)
- **Seguridad**: secreto JWT aleatorio por arranque cuando no viene del entorno (en desarrollo) y obligatorio en producción, rate limiting por ruta, cabeceras de seguridad (CSP, etc.), CORS restringido por orígenes permitidos y contraseñas cifradas con bcrypt
- **Dashboard en tiempo real**: KPIs de rendimiento, gráficas de tendencia, desempeño por técnico
- **Gestión de Incidencias (PQR)**: CRUD completo, búsqueda, filtros por estado/tipo/barrio, flujo de ciclo de vida; número de ticket con reintento ante colisiones y casos cerrados (resuelta/escalada) que no se reabren por API
- **Diagnóstico guiado**: Checklist interactivo paso a paso por tipo de falla (FTTH/GPON), con:
  - Medición de campo (nivel óptico dBm, velocidad Mbps, pérdida de paquetes)
  - Referencia esperada por cada paso
  - Registro de causa raíz (Diagrama de Ishikawa)
- **Base de conocimiento**: Protocolos de diagnóstico consultables para capacitar nuevo personal
- **Indicadores del Plan de Mejora**: Métricas alineadas a cada objetivo específico
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

> La primera vez se crea `server/one.db` automáticamente con datos de ejemplo
> (5 tipos de falla FTTH, 24 incidencias, checklists de diagnóstico, categorías Ishikawa).

---

## 🧪 Pruebas

```bash
npm test              # Ejecuta pruebas de API y cliente
npm run test:server   # API + validaciones (node:test + supertest)
npm run test:client   # Componentes y utilidades (Vitest + Testing Library)
```

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

---

## 📁 Estructura del Proyecto

```
one-soporte-tecnico/
├── docs/
│   └── Informe_Plan_de_Mejora_N3.pdf   # Informe final del proyecto
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
│   │   ├── incidents.js                 # CRUD incidencias + diagnóstico guiado
│   │   ├── checklists.js                # Base de conocimiento y causas raíz
│   │   ├── metrics.js                   # Indicadores del dashboard
│   │   └── tecnicos.js
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
        │   ├── Indicadores.jsx          # Métricas del plan de mejora
        │   ├── Ajustes.jsx              # Tema y criterios del plan de mejora
        │   └── NotFound.jsx             # Error 404
        ├── components/
        │   ├── Layout.jsx               # Sidebar, topbar móvil y navegación
        │   ├── RequireAuth.jsx          # Guard de rutas protegidas
        │   ├── Toast.jsx                # Notificaciones (contexto)
        │   └── ui.jsx                   # Componentes reutilizables
        ├── hooks/
        │   ├── useFocusTrap.js          # Trampa de foco para modales
        │   └── useTheme.js              # Tema claro/oscuro persistente
        ├── test/                        # Pruebas de componentes
        └── api.js                       # Cliente HTTP, sesión y hook useApi
```

---

## 📄 Documento Académica

El informe del Plan de Mejora Nivel 3 se encuentra en la carpeta
[`docs/`](docs/Informe_Plan_de_Mejora_N3.pdf) y detalla:

- **Contextualización** de ONE Telecomunicaciones S.A.S.
- **Planteamiento del problema** (ausencia de protocolo estandarizado)
- **Marco teórico** (ITIL, ciclo PHVA, redes FTTH/GPON)
- **Diagnóstico externo e interno** (PESTEL + análisis funcional)
- **Metodología** del plan de mejora
- **Factibilidad** (financiera, técnica, operativa)
- **Resultados y conclusiones**

---

## 👨‍💻 Autor

**Bryam Stevens Villalba Culma**
Ingeniería de Software — Semestre 7, Promoción 15B
Universidad: [Uniempresarial](https://www.uniempresarial.edu.co)

Tutor empresarial: **Yudy Garcia** — Administradora General, ONE Telecomunicaciones S.A.S.
Profesor acompañante: **Adán Beltran Gómez**

---

## 📜 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

<div align="center">

*Desarrollado como parte del Informe Final de Plan de Mejora Nivel 3*
*ONE Telecomunicaciones S.A.S. — Bogotá D.C.*

</div>
