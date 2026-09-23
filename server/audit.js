import { db } from './db.js';

// Registro de auditoría. `incidenciaId` es null para eventos de sistema (cuentas, config).
// Nunca se escribe información sensible (contraseñas, tokens) en `detalle`.
export function registrarActividad({ incidenciaId = null, usuario, accion, detalle = '' }) {
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)')
    .run(
      incidenciaId ?? null,
      String(usuario ?? '').slice(0, 200),
      String(accion ?? '').slice(0, 50),
      String(detalle ?? '').slice(0, 500),
      Date.now()
    );
}