// Authentification admin — cookie signé (HMAC-SHA256), sans dépendance.

const COOKIE = 'lba_admin';

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

export async function createSessionCookie(env, ttlSeconds = 60 * 60 * 12) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 })));
  const sig = await hmacHex(secretOf(env), payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

export async function isAuthed(env, request) {
  const token = readCookie(request);
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(secretOf(env), payload);
  if (!timingEqual(expected, sig)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof data.exp === 'number' && Date.now() < data.exp;
  } catch (e) { return false; }
}

export async function checkPassword(env, password) {
  const expected = env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  return timingEqual(String(password || ''), expected);
}
