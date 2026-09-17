const ESTADOS_VALIDOS = ['nueva', 'en_diagnostico', 'resuelta', 'escalada'];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];

export const ESTADOS_TRANSICION = {
  nueva: ['en_diagnostico'],
  en_diagnostico: ['nueva'],
  resuelta: ['nueva', 'en_diagnostico'],
  escalada: ['nueva', 'en_diagnostico']
};

function campoTextoObligatorio(errors, body, campo, min, max, msg) {
  if (body[campo] === undefined || typeof body[campo] !== 'string' || body[campo].trim().length < min) {
    errors.push(msg);
  } else if (body[campo].length > max) {
    errors.push(`${campo} no puede exceder ${max} caracteres`);
  }
}

function campoTextoOpcional(errors, body, campo, max, msg) {
  if (body[campo] === undefined || body[campo] === null) return;
  if (typeof body[campo] !== 'string') {
    errors.push(msg ?? `${campo} debe ser texto`);
  } else if (body[campo].length > max) {
    errors.push(`${campo} no puede exceder ${max} caracteres`);
  }
}

function campoTextoOpcionalMin(errors, body, campo, min, max, msg) {
  if (body[campo] === undefined || body[campo] === null) return;
  if (typeof body[campo] !== 'string' || body[campo].trim().length < min) {
    errors.push(msg);
  } else if (body[campo].length > max) {
    errors.push(`${campo} no puede exceder ${max} caracteres`);
  }
}

export function validateIncidentCreate(body) {
  const errors = [];

  campoTextoObligatorio(errors, body, 'cliente', 2, 200, 'cliente es obligatorio (mínimo 2 caracteres)');
  if (!body.tipo_falla_id || !Number.isInteger(Number(body.tipo_falla_id)) || Number(body.tipo_falla_id) < 1) {
    errors.push('tipo_falla_id es obligatorio y debe ser un número entero positivo');
  }
  if (body.prioridad && !PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    errors.push(`prioridad debe ser una de: ${PRIORIDADES_VALIDAS.join(', ')}`);
  }
  campoTextoOpcional(errors, body, 'telefono', 20);
  campoTextoOpcional(errors, body, 'direccion', 300);
  campoTextoOpcional(errors, body, 'barrio', 100);
  campoTextoOpcional(errors, body, 'sintomas', 1000);
  campoTextoOpcional(errors, body, 'descripcion', 2000);
  if (body.tecnico_id !== undefined && body.tecnico_id !== null && body.tecnico_id !== '') {
    const tid = Number(body.tecnico_id);
    if (!Number.isInteger(tid) || tid < 1) {
      errors.push('tecnico_id debe ser un número entero positivo');
    }
  }

  return errors;
}

export function validateIncidentUpdate(body) {
  const errors = [];
  const allowed = ['cliente', 'telefono', 'direccion', 'barrio', 'tipo_falla_id', 'prioridad', 'estado', 'tecnico_id', 'sintomas', 'descripcion'];

  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }

  campoTextoOpcionalMin(errors, body, 'cliente', 2, 200, 'cliente debe tener al menos 2 caracteres');
  campoTextoOpcional(errors, body, 'telefono', 20);
  campoTextoOpcional(errors, body, 'direccion', 300);
  campoTextoOpcional(errors, body, 'barrio', 100);
  campoTextoOpcional(errors, body, 'sintomas', 1000);
  campoTextoOpcional(errors, body, 'descripcion', 2000);
  if (body.estado !== undefined && !ESTADOS_VALIDOS.includes(body.estado)) {
    errors.push(`estado debe ser una de: ${ESTADOS_VALIDOS.join(', ')}`);
  }
  if (body.prioridad !== undefined && !PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    errors.push(`prioridad debe ser una de: ${PRIORIDADES_VALIDAS.join(', ')}`);
  }
  if (body.tipo_falla_id !== undefined) {
    const tid = Number(body.tipo_falla_id);
    if (!Number.isInteger(tid) || tid < 1) {
      errors.push('tipo_falla_id debe ser un número entero positivo');
    }
  }
  if (body.tecnico_id !== undefined && body.tecnico_id !== null) {
    const tid = Number(body.tecnico_id);
    if (!Number.isInteger(tid) || tid < 1) {
      errors.push('tecnico_id debe ser un número entero positivo');
    }
  }

  return errors;
}

export function validateDiagnostico(body) {
  const errors = [];

  if (!body.respuestas || !Array.isArray(body.respuestas)) {
    errors.push('respuestas debe ser una lista');
    return errors;
  }

  if (body.respuestas.length === 0) {
    errors.push('respuestas no puede estar vacía');
  }

  for (let i = 0; i < body.respuestas.length; i++) {
    const r = body.respuestas[i];
    if (!r.consulta_id || !Number.isInteger(Number(r.consulta_id))) {
      errors.push(`respuestas[${i}].consulta_id es obligatorio y debe ser entero`);
    }
    if (r.respuesta !== undefined && typeof r.respuesta !== 'string') {
      errors.push(`respuestas[${i}].respuesta debe ser texto`);
    }
    if (r.cumple !== undefined && r.cumple !== null && r.cumple !== 0 && r.cumple !== 1 && r.cumple !== true && r.cumple !== false) {
      errors.push(`respuestas[${i}].cumple debe ser 0, 1, true, false o null`);
    }
  }

  return errors;
}

export function validateFinalizar(body) {
  const errors = [];

  if (body.estado && !['resuelta', 'escalada'].includes(body.estado)) {
    errors.push('estado debe ser "resuelta" o "escalada"');
  }
  if (body.causa_raiz_id !== undefined && body.causa_raiz_id !== null) {
    const cid = Number(body.causa_raiz_id);
    if (!Number.isInteger(cid) || cid < 1) {
      errors.push('causa_raiz_id debe ser un número entero positivo');
    }
  }
  if (body.solucion_aplicada !== undefined && typeof body.solucion_aplicada !== 'string') {
    errors.push('solucion_aplicada debe ser texto');
  }
  if (body.solucion_aplicada && body.solucion_aplicada.length > 2000) {
    errors.push('solucion_aplicada no puede exceder 2000 caracteres');
  }
  // Para cerrar como resuelta siempre se requiere causa raíz identificada
  if (body.causa_raiz_id === undefined || body.causa_raiz_id === null || body.causa_raiz_id === '') {
    errors.push('causa_raiz_id es obligatorio para finalizar el caso');
  }

  return errors;
}

export function validateIdParam(id) {
  const num = Number(id);
  if (!id || !Number.isInteger(num) || num < 1) {
    return ['ID inválido'];
  }
  return [];
}

export function validationMiddleware(validateFn) {
  return (req, res, next) => {
    const errors = validateFn(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Error de validación', details: errors });
    }
    next();
  };
}