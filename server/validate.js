const ESTADOS_VALIDOS = ['nueva', 'en_diagnostico', 'resuelta', 'escalada'];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];

export function validateIncidentCreate(body) {
  const errors = [];

  if (!body.cliente || typeof body.cliente !== 'string' || body.cliente.trim().length < 2) {
    errors.push('cliente es obligatorio (mínimo 2 caracteres)');
  }
  if (body.cliente && body.cliente.length > 200) {
    errors.push('cliente no puede exceder 200 caracteres');
  }
  if (!body.tipo_falla_id || !Number.isInteger(Number(body.tipo_falla_id)) || Number(body.tipo_falla_id) < 1) {
    errors.push('tipo_falla_id es obligatorio y debe ser un número entero positivo');
  }
  if (body.prioridad && !PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    errors.push(`prioridad debe ser una de: ${PRIORIDADES_VALIDAS.join(', ')}`);
  }
  if (body.telefono && typeof body.telefono === 'string' && body.telefono.length > 20) {
    errors.push('telefono no puede exceder 20 caracteres');
  }
  if (body.direccion && typeof body.direccion === 'string' && body.direccion.length > 300) {
    errors.push('direccion no puede exceder 300 caracteres');
  }
  if (body.barrio && typeof body.barrio === 'string' && body.barrio.length > 100) {
    errors.push('barrio no puede exceder 100 caracteres');
  }
  if (body.sintomas && typeof body.sintomas === 'string' && body.sintomas.length > 1000) {
    errors.push('sintomas no puede exceder 1000 caracteres');
  }
  if (body.descripcion && typeof body.descripcion === 'string' && body.descripcion.length > 2000) {
    errors.push('descripcion no puede exceder 2000 caracteres');
  }
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

  if (body.cliente !== undefined) {
    if (typeof body.cliente !== 'string' || body.cliente.trim().length < 2) {
      errors.push('cliente debe tener al menos 2 caracteres');
    }
    if (body.cliente.length > 200) {
      errors.push('cliente no puede exceder 200 caracteres');
    }
  }
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
