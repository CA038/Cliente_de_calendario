import crypto from 'crypto';

const SCRYPT_PREFIX = 'scrypt:';
const DEFAULT_JWT_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Genera un hash seguro con salt aleatorio usando scrypt.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${SCRYPT_PREFIX}${salt}:${derived}`;
}

/**
 * Verifica una contraseña contra un hash scrypt (o texto plano legado durante transición).
 */
export function verifyPassword(password, storedPassword) {
  if (storedPassword === undefined || storedPassword === null) return false;
  const plain = String(password);
  const stored = String(storedPassword);

  if (stored.startsWith(SCRYPT_PREFIX)) {
    const parts = stored.slice(SCRYPT_PREFIX.length).split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    const derived = crypto.scryptSync(plain, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  }

  // Compatibilidad con usuarios legados en Google Sheets aún sin hash
  const a = Buffer.from(plain, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Firma un JWT estándar HS256.
 */
export function signJwt(payload, secret, expiresInSeconds = DEFAULT_JWT_TTL_SECONDS) {
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest();

  return `${data}.${base64UrlEncode(signature)}`;
}

/**
 * Verifica y decodifica un JWT HS256. Retorna el payload o null si es inválido/expirado.
 */
export function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedBody}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(data).digest()
  );

  const a = Buffer.from(encodedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedBody));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
