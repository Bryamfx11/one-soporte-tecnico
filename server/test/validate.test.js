import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIncidentCreate, validateIncidentUpdate, validateDiagnostico,
  validateFinalizar, validateIdParam, validateTecnicoUpdate, ESTADOS_TRANSICION
} from '../validate.js';

test('validateIncidentCreate: valida caso correcto', () => {
  const errors = validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1 });
  assert.equal(errors.length, 0);
});

test('validateIncidentCreate: rechaza sin cliente', () => {
  assert.ok(validateIncidentCreate({ tipo_falla_id: 1 }).length > 0);
});

test('validateIncidentCreate: rechaza cliente muy corto', () => {
  assert.ok(validateIncidentCreate({ cliente: 'A', tipo_falla_id: 1 }).length > 0);
});

test('validateIncidentCreate: rechaza tipo_falla_id inválido', () => {
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 0 }).length > 0);
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 'abc' }).length > 0);
});

test('validateIncidentCreate: rechaza prioridad inválida', () => {
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, prioridad: 'urgente' }).length > 0);
});

test('validateIncidentCreate: acepta prioridad válida', () => {
  assert.equal(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, prioridad: 'alta' }).length, 0);
});

test('validateIncidentCreate: rechaza campos opcionales no-string', () => {
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, telefono: 3001234567 }).length > 0);
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, direccion: 123 }).length > 0);
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, barrio: ['Centro'] }).length > 0);
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, sintomas: { x: 1 } }).length > 0);
  assert.ok(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, descripcion: 42 }).length > 0);
});

test('validateIncidentCreate: acepta campos opcionales string', () => {
  assert.equal(validateIncidentCreate({ cliente: 'Ana', tipo_falla_id: 1, telefono: '3001234567', barrio: 'Centro' }).length, 0);
});

test('validateIncidentUpdate: rechaza campos no permitidos', () => {
  assert.ok(validateIncidentUpdate({ hack: 'x' }).length > 0);
});

test('validateIncidentUpdate: acepta campos permitidos', () => {
  assert.equal(validateIncidentUpdate({ estado: 'resuelta', prioridad: 'baja' }).length, 0);
});

test('validateIncidentUpdate: rechaza estado inválido', () => {
  assert.ok(validateIncidentUpdate({ estado: 'inventado' }).length > 0);
});

test('validateIncidentUpdate: rechaza campos opcionales no-string', () => {
  assert.ok(validateIncidentUpdate({ telefono: 300123 }).length > 0);
  assert.ok(validateIncidentUpdate({ direccion: null }).length === 0);
});

test('ESTADOS_TRANSICION: no permite saltar a resuelta/escalada directo', () => {
  assert.deepEqual(ESTADOS_TRANSICION.nueva, ['en_diagnostico']);
  assert.ok(!ESTADOS_TRANSICION.nueva.includes('resuelta'));
  assert.ok(!ESTADOS_TRANSICION.nueva.includes('escalada'));
});

test('validateDiagnostico: rechaza lista vacía', () => {
  assert.ok(validateDiagnostico({ respuestas: [] }).length > 0);
});

test('validateDiagnostico: rechaza no-array', () => {
  assert.ok(validateDiagnostico({ respuestas: 'x' }).length > 0);
});

test('validateDiagnostico: acepta respuestas válidas', () => {
  assert.equal(validateDiagnostico({ respuestas: [{ consulta_id: 1, respuesta: 'si', cumple: 1 }] }).length, 0);
});

test('validateFinalizar: rechaza estado inválido', () => {
  assert.ok(validateFinalizar({ estado: 'nueva', causa_raiz_id: 1 }).length > 0);
});

test('validateFinalizar: requiere causa raíz', () => {
  assert.ok(validateFinalizar({ estado: 'resuelta' }).length > 0);
  assert.ok(validateFinalizar({ estado: 'escalada' }).length > 0);
});

test('validateFinalizar: acepta escalada con causa raíz', () => {
  assert.equal(validateFinalizar({ estado: 'escalada', causa_raiz_id: 1 }).length, 0);
});

test('validateFinalizar: acepta resuelta con causa raíz', () => {
  assert.equal(validateFinalizar({ estado: 'resuelta', causa_raiz_id: 1, solucion_aplicada: 'Reinicio' }).length, 0);
});

test('validateIdParam: valida enteros positivos', () => {
  assert.equal(validateIdParam('5').length, 0);
  assert.ok(validateIdParam('abc').length > 0);
  assert.ok(validateIdParam('0').length > 0);
  assert.ok(validateIdParam('1.5').length > 0);
});

test('validateTecnicoUpdate: acepta actualización válida', () => {
  assert.equal(validateTecnicoUpdate({ nombre: 'Ana Rodríguez' }).length, 0);
  assert.equal(validateTecnicoUpdate({ rol: 'Jefe de Redes' }).length, 0);
  assert.equal(validateTecnicoUpdate({ nombre: 'Ana', rol: 'Técnico' }).length, 0);
});

test('validateTecnicoUpdate: rechaza cuerpo vacío', () => {
  assert.ok(validateTecnicoUpdate({}).length > 0);
});

test('validateTecnicoUpdate: rechaza nombre corto', () => {
  assert.ok(validateTecnicoUpdate({ nombre: 'A' }).length > 0);
});

test('validateTecnicoUpdate: rechaza campos no permitidos', () => {
  assert.ok(validateTecnicoUpdate({ email: 'x@y.com' }).length > 0);
});

test('validateTecnicoUpdate: rechaza nombre no texto', () => {
  assert.ok(validateTecnicoUpdate({ nombre: 123 }).length > 0);
});