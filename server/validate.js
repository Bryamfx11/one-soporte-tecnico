const ESTADOS_VALIDOS = ['nueva', 'en_diagnostico', 'resuelta', 'escalada'];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];

export const ESTADOS_TRANSICION = {
  nueva: ['en_diagnostico'],
  en_diagnostico: ['nueva'],
  resuelta: [],
  escalada: []
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

export function validateTecnicoUpdate(body) {
  const errors = [];
  const allowed = ['nombre', 'rol'];

  if (!allowed.some((k) => body[k] !== undefined)) {
    errors.push('No hay campos para actualizar');
  }

  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }

  if (body.nombre !== undefined && body.nombre !== null) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
      errors.push('nombre debe tener al menos 2 caracteres');
    } else if (body.nombre.length > 200) {
      errors.push('nombre no puede exceder 200 caracteres');
    }
  }
  if (body.rol !== undefined && body.rol !== null && body.rol !== '') {
    if (typeof body.rol !== 'string') {
      errors.push('rol debe ser texto');
    } else if (body.rol.length > 100) {
      errors.push('rol no puede exceder 100 caracteres');
    }
  }

  return errors;
}

export function validateTecnicoCreate(body) {
  const errors = [];

  if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
    errors.push('nombre es obligatorio (mínimo 2 caracteres)');
  } else if (body.nombre.trim().length > 200) {
    errors.push('nombre no puede exceder 200 caracteres');
  }
  if (body.rol !== undefined && body.rol !== null && body.rol !== '') {
    if (typeof body.rol !== 'string') {
      errors.push('rol debe ser texto');
    } else if (body.rol.length > 100) {
      errors.push('rol no puede exceder 100 caracteres');
    }
  }

  return errors;
}

export function validateTipoFallaCreate(body) {
  const errors = [];

  if (typeof body.nombre !== 'string' || body.nombre.trim().length < 1) {
    errors.push('nombre es obligatorio');
  } else if (body.nombre.trim().length > 100) {
    errors.push('nombre no puede exceder 100 caracteres');
  }
  if (typeof body.descripcion !== 'string' || body.descripcion.trim().length < 1) {
    errors.push('descripcion es obligatorio');
  } else if (body.descripcion.trim().length > 300) {
    errors.push('descripcion no puede exceder 300 caracteres');
  }
  campoTextoOpcional(errors, body, 'icono', 30, 'icono debe ser texto');

  return errors;
}

export function validateTipoFallaUpdate(body) {
  const errors = [];

  for (const key of Object.keys(body)) {
    if (!['nombre', 'descripcion', 'icono'].includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }
  campoTextoOpcionalMin(errors, body, 'nombre', 1, 100, 'nombre no puede estar vacío');
  campoTextoOpcionalMin(errors, body, 'descripcion', 1, 300, 'descripcion no puede estar vacía');
  campoTextoOpcional(errors, body, 'icono', 30, 'icono debe ser texto');

  return errors;
}

const TIPOS_RESPUESTA = ['si_no', 'si_no_valor'];

export function validateConsultaCreate(body) {
  const errors = [];

  if (!body.tipo_falla_id || !Number.isInteger(Number(body.tipo_falla_id)) || Number(body.tipo_falla_id) < 1) {
    errors.push('tipo_falla_id es obligatorio y debe ser un número entero positivo');
  }
  if (body.orden !== undefined && body.orden !== null && body.orden !== '') {
    const o = Number(body.orden);
    if (!Number.isInteger(o) || o < 0) {
      errors.push('orden debe ser un entero mayor o igual a 0');
    }
  }
  for (const c of ['titulo', 'pregunta', 'instruccion']) {
    if (typeof body[c] !== 'string' || body[c].trim().length < 1) {
      errors.push(`${c} es obligatorio`);
    } else if (body[c].trim().length > 500) {
      errors.push(`${c} no puede exceder 500 caracteres`);
    }
  }
  if (body.tipo_respuesta !== undefined && body.tipo_respuesta !== null && body.tipo_respuesta !== '') {
    if (!TIPOS_RESPUESTA.includes(body.tipo_respuesta)) {
      errors.push(`tipo_respuesta debe ser una de: ${TIPOS_RESPUESTA.join(', ')}`);
    }
  }
  campoTextoOpcional(errors, body, 'unidad', 30, 'unidad debe ser texto');
  campoTextoOpcional(errors, body, 'etiqueta_valor', 100, 'etiqueta_valor debe ser texto');
  campoTextoOpcional(errors, body, 'referencia', 300, 'referencia debe ser texto');

  return errors;
}

export function validateConsultaUpdate(body) {
  const errors = [];

  for (const key of Object.keys(body)) {
    if (!['titulo', 'pregunta', 'instruccion', 'tipo_respuesta', 'unidad', 'etiqueta_valor', 'referencia', 'orden'].includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }
  if (body.orden !== undefined && body.orden !== null && body.orden !== '') {
    const o = Number(body.orden);
    if (!Number.isInteger(o) || o < 0) {
      errors.push('orden debe ser un entero mayor o igual a 0');
    }
  }
  for (const c of ['titulo', 'pregunta', 'instruccion']) {
    if (body[c] !== undefined && body[c] !== null) {
      if (typeof body[c] !== 'string' || body[c].trim().length < 1) {
        errors.push(`${c} no puede estar vacío`);
      } else if (body[c].trim().length > 500) {
        errors.push(`${c} no puede exceder 500 caracteres`);
      }
    }
  }
  if (body.tipo_respuesta !== undefined && body.tipo_respuesta !== null && body.tipo_respuesta !== '') {
    if (!TIPOS_RESPUESTA.includes(body.tipo_respuesta)) {
      errors.push(`tipo_respuesta debe ser una de: ${TIPOS_RESPUESTA.join(', ')}`);
    }
  }
  campoTextoOpcional(errors, body, 'unidad', 30, 'unidad debe ser texto');
  campoTextoOpcional(errors, body, 'etiqueta_valor', 100, 'etiqueta_valor debe ser texto');
  campoTextoOpcional(errors, body, 'referencia', 300, 'referencia debe ser texto');

  return errors;
}

export function validateCausaRaizCreate(body) {
  const errors = [];

  if (typeof body.categoria !== 'string' || body.categoria.trim().length < 1) {
    errors.push('categoria es obligatorio');
  } else if (body.categoria.trim().length > 200) {
    errors.push('categoria no puede exceder 200 caracteres');
  }
  if (typeof body.descripcion !== 'string' || body.descripcion.trim().length < 1) {
    errors.push('descripcion es obligatorio');
  } else if (body.descripcion.trim().length > 500) {
    errors.push('descripcion no puede exceder 500 caracteres');
  }

  return errors;
}

export function validateCausaRaizUpdate(body) {
  const errors = [];

  for (const key of Object.keys(body)) {
    if (!['categoria', 'descripcion'].includes(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }
  campoTextoOpcionalMin(errors, body, 'categoria', 1, 200, 'categoria no puede estar vacía');
  campoTextoOpcionalMin(errors, body, 'descripcion', 1, 500, 'descripcion no puede estar vacía');

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