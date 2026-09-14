# ONE Soporte Técnico — Plan de Mejora

Plataforma web de soporte técnico para **ONE Telecomunicaciones S.A.S.** desarrollada como
propuesta del **Informe Final de Plan de Mejora Nivel 3** (Bryam Stevens Villalba Culma,
Ingeniería de Software). Implementa los tres objetivos específicos del plan:

1. **Diagnosticar** las causas de los tiempos de respuesta prolongados.
2. **Analizar** los procesos actuales de atención y mantenimiento de red.
3. **Proponer** un protocolo estandarizado de diagnóstico y atención de fallas.

## Funcionalidades

- **Dashboard**: KPIs en tiempo real (tiempo promedio de respuesta, tasa de resolución,
  incidencias por estado) con gráficas de tendencia.
- **Incidencias (PQR)**: registro, búsqueda, filtros y gestión completa del ciclo de vida
  (nueva → en diagnóstico → resuelta/escalada).
- **Diagnóstico guiado**: checklist paso a paso por tipo de falla (FTTH/GPON), con recolección
  de medidas en campo (nivel óptico, velocidad, pérdida de paquetes) y referencia esperada.
- **Cierre de caso**: registro de causa raíz (alineado con el Diagrama de Ishikawa del informe)
  y solución aplicada; casos escalados quedan marcados para seguimiento.
- **Base de conocimiento**: protocolos estandarizados de diagnóstico consultables y
  reutilizables para capacitar nuevo personal técnico.
- **Indicadores**: métricas alineadas a cada objetivo específico (causas recurrentes, cuellos
  de botella por tipo de falla, carga por técnico).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + Recharts + React Router |
| Backend | Node.js ≥ 22.5 + Express (usa `node:sqlite`, **sin dependencias nativas**) |
| Base de datos | SQLite (archivo local `server/one.db`, se crea con datos de ejemplo) |

## Requisitos

- Node.js >= 22.5 (recomendado: Node 24)

## Puesta en marcha

```bash
# 1. Instalar dependencias de server y client
npm run install:all

# 2. Levantar API + cliente en modo desarrollo (dos procesos en paralelo)
npm run dev
```

- API: http://localhost:4000
- Cliente: http://localhost:5173 (proxy `/api` hacia la API)

> **Nota sobre `allow-scripts` (npm ≥ 11):** si tu `~/.npmrc` global define el
> campo `allow-scripts`, npm lo exporta como variable de entorno a los `npm install`
> anidados y los bloquea con `EALLOWSCRIPTS`. El script `install:all` ya lo neutraliza
> (`set npm_config_allow_scripts=`). Si prefieres eliminar esa restricción de tu máquina,
> cambia en `~/.npmrc` el valor `allow-scripts` a `*`.

La primera vez que se ejecuta la API se crea `server/one.db` y se popular con datos de
ejemplo (tipos de falla, checklist, técnicos, causas raíz e incidencias). Para reiniciar la
base de datos desde cero, elimine el archivo `server/one.db` y reinicie la API.

## Estructura

```
plan-mejora-one/
├── server/                 # API Express
│   ├── index.js            # Arranque y montaje de rutas
│   ├── db.js               # Esquema de base de datos (SQLite)
│   ├── seed.js             # Datos de ejemplo (checklists FTTH, incidencias, causas)
│   └── routes/
│       ├── incidents.js    # CRUD incidencias + diagnóstico + finalización
│       ├── checklists.js   # Base de conocimiento y causas raíz
│       ├── metrics.js      # Indicadores del dashboard
│       └── tecnicos.js
└── client/                 # React (Vite)
    └── src/
        ├── pages/          # Dashboard, Incidencias, Diagnóstico, Conocimiento, Indicadores
        ├── components/     # Layout y componentes de UI
        └── api.js          # Cliente HTTP
```

## Producción

```bash
npm run build           # construye el cliente en client/dist
npm start --prefix server   # sirve API + cliente estático en http://localhost:4000
```

## Nota académica

Este proyecto corresponde a la propuesta del numeral 3 y los objetivos del informe
"Optimización del Proceso de Soporte Técnico en ONE Telecomunicaciones S.A.S.". Los
checklists de diagnóstico replican las verificaciones típicas de una red FTTH/GPON
(estado de ONT, nivel óptico, NAP/splitter, acometida, plataforma OLT), y las causas raíz
recogen las categorías del Diagrama de Ishikawa del documento (método, medición,
materiales/equipos, entorno).