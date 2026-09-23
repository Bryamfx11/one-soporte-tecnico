// TOTP (RFC 6238) con HMAC-SHA1, 6 dígitos y periodo de 30 s, implementado con node:crypto.
import crypto from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODO_S = 30;
const DIGITS = 6;

export function generarSecreto(bytes = 20) {
  return toBase32(crypto.randomBytes(bytes));
}

export function otpauthUrl(secret, email) {
  const etiqueta = encodeURIComponent(`ONETec:${email}`);
  return `otpauth://totp/${etiqueta}?secret=${secret}&issuer=ONETec&algorithm=SHA1&digits=${DIGITS}&period=${PERIODO_S}`;
}

export function generarCodigo(secret, tiempo = Date.now()) {
  const contador = Math.floor(tiempo / 1000 / PERIODO_S);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', decodificarBase32(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

// Acepta el código con ±ventana pasos (por desincronización de reloj).
export function verificarCodigo(secret, code, tiempo = Date.now(), ventana = 1) {
  const ingresado = String(code ?? '').replace(/\D/g, '');
  if (ingresado.length !== DIGITS) return false;
  for (let paso = -ventana; paso <= ventana; paso++) {
    if (generarCodigo(secret, tiempo + paso * PERIODO_S * 1000) === ingresado) return true;
  }
  return false;
}

function toBase32(data) {
  let bits = 0;
  let valor = 0;
  let out = '';
  for (const byte of data) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(valor << (5 - bits)) & 31];
  return out;
}

function decodificarBase32(texto) {
  const limpio = String(texto).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const ch of limpio) {
    valor = (valor << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function esSecretoValido(secret) {
  return typeof secret === 'string' && /^[A-Z2-7]{16,32}$/i.test(secret);
}