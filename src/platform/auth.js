const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = 'sha256';

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('hex');
  return `${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [iterations, salt, expectedHash] = String(passwordHash || '').split(':');
  if (!iterations || !salt || !expectedHash) return false;

  const hash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('hex');

  return timingSafeEqual(hash, expectedHash);
}

function signToken(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function createToken(user, secret) {
  const now = Date.now();
  return signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_MS
  }, secret);
}

function verifyToken(token, secret) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    authProvider: user.authProvider || 'password',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null
  };
}

module.exports = {
  createToken,
  hashPassword,
  publicUser,
  verifyPassword,
  verifyToken
};
