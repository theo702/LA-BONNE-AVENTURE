// Authentification voyageur — cookie signé (HMAC-SHA256), même technique que l'admin
// (functions/_lib/auth.js) mais un cookie distinct et un payload dédié (email + scope),
// pour qu'un cookie voyageur ne puisse jamais servir de session admin (et inversement).
// Réutilise ADMIN_SECRET comme clé HMAC (secret déjà en place, aucun nouveau secret requis) :
// c'est sans risque car la vérification reste entièrement côté serveur.

const COOKIE = 'lba_guest';

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function timingEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function secretOf(env) {
  return env.ADMIN_SECRET || env.ADMIN_PASSWORD || 'change-me';
}

export async function createGuestCookie(env, email, ttlSeconds = 60 * 60 * 24 * 30) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    scope: 'guest', email: email.toLowerCase(), exp: Date.now() + ttlSeconds * 1000,
  })));
  const sig = await hmacHex(secretOf(env), payload);
  return `${COOKIE}=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
}

export function clearGuestCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

// Renvoie l'email du voyageur authentifié, ou null.
export async function getGuestEmail(env, request) {
  const token = readCookie(request);
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(secretOf(env), payload);
  if (!timingEqual(expected, sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (data.scope !== 'guest' || typeof data.email !== 'string') return null;
    if (typeof data.exp !== 'number' || Date.now() >= data.exp) return null;
    return data.email;
  } catch (e) { return null; }
}
