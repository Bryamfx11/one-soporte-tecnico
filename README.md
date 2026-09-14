<div align="center">

# 🔧 ONE Soporte Técnico

### Plataforma de Gestión de Soporte Técnico — Plan de Mejora Nivel 3

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.5-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green)
![Status](https://img.shields.io/badge/Estado-Activo-brightgreen)

*Optimización del Proceso de Soporte Técnico en ONE Telecomunicaciones S.A.S.*

[📄 Informe del Plan de Mejora](docs/Informe_Plan_de_Mejora_N3.pdf) ·
[🚀 Ver en GitHub](https://github.com/Bryamfx11/one-soporte-tecnico) ·
[📊 Dashboard (demo local)](http://localhost:5173)

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

- **Dashboard en tiempo real**: KPIs de rendimiento, gráficas de tendencia, desempeño por técnico
- **Gestión de Incidencias (PQR)**: CRUD completo, búsqueda, filtros por estado/tipo/barrio, flujo de ciclo de vida
- **Diagnóstico guiado**: Checklist interactivo paso a paso por tipo de falla (FTTH/GPON), con:
  - Medición de campo (nivel óptico dBm, velocidad Mbps, pérdida de paquetes)
  - Referencia esperada por cada paso
  - Registro de causa raíz (Diagrama de Ishikawa)
- **Base de conocimiento**: Protocolos de diagnóstico consultables para capacitar nuevo personal
- **Indicadores del Plan de Mejora**: Métricas alineadas a cada objetivo específico

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 6 + Recharts + React Router 7 |
| Backend | Node.js ≥ 22.5 + Express 4 |
| Base de datos | SQLite 3 (`node:sqlite` built-in, sin dependencias nativas) |
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

> La primera vez se crea `server/one.db` automáticamente con datos de ejemplo
> (5 tipos de falla FTTH, 24 incidencias, checklists de diagnóstico, categorías Ishikawa).

---

## 🏭 Producción

```bash
npm run build              # construye el cliente en client/dist
cd server && node index.js  # sirve API + cliente estático en http://localhost:4000
```

---

## 📁 Estructura del Proyecto

```
one-soporte-tecnico/
├── docs/
│   └── Informe_Plan_de_Mejora_N3.pdf   # Informe final del proyecto
├── server/                              # API Express
│   ├── index.js                         # Arranque y montaje de rutas
│   ├── db.js                            # Esquema de base de datos (SQLite)
│   ├── seed.js                          # Datos de ejemplo (checklists FTTH, causas)
│   └── routes/
│       ├── incidents.js                 # CRUD incidencias + diagnóstico guiado
│       ├── checklists.js                # Base de conocimiento y causas raíz
│       ├── metrics.js                   # Indicadores del dashboard
│       └── tecnicos.js
└── client/                              # React (Vite)
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx            # KPIs y gráficas
        │   ├── Incidencias.jsx          # Lista de incidencias con filtros
        │   ├── IncidenciaDetail.jsx     # Detalle + wizard de diagnóstico guiado
        │   ├── NuevaIncidencia.jsx      # Formulario de creación
        │   ├── Conocimiento.jsx         # Base de conocimiento
        │   └── Indicadores.jsx          # Métricas del plan de mejora
        ├── components/
        │   ├── Layout.jsx               # Sidebar y navegación
        │   └── ui.jsx                   # Componentes reutilizables
        └── api.js                       # Cliente HTTP
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
*ONE Telecomunicaciones S.A.S. — Tunja, Boyacá / Bogotá D.C.*

</div>