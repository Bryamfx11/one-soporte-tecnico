import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIncidentCreate, validateIncidentUpdate, validateDiagnostico,
  validateFinalizar, validateIdParam
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

test('validateIncidentUpdate: rechaza campos no permitidos', () => {
  assert.ok(validateIncidentUpdate({ hack: 'x' }).length > 0);
});

test('validateIncidentUpdate: acepta campos permitidos', () => {
  assert.equal(validateIncidentUpdate({ estado: 'resuelta', prioridad: 'baja' }).length, 0);
});

test('validateIncidentUpdate: rechaza estado inválido', () => {
  assert.ok(validateIncidentUpdate({ estado: 'inventado' }).length > 0);
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
  assert.ok(validateFinalizar({ estado: 'nueva' }).length > 0);
});

test('validateFinalizar: acepta escalada', () => {
  assert.equal(validateFinalizar({ estado: 'escalada' }).length, 0);
});

test('validateIdParam: valida enteros positivos', () => {
  assert.equal(validateIdParam('5').length, 0);
  assert.ok(validateIdParam('abc').length > 0);
  assert.ok(validateIdParam('0').length > 0);
  assert.ok(validateIdParam('1.5').length > 0);
});