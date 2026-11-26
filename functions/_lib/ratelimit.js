// Limite d'essais (anti force brute) — compteurs dans KV, qui s'effacent tout seuls.
// KV est « à peu près » cohérent : suffisant pour freiner un robot, pas besoin d'exactitude.
const P = 'rl:';

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'inconnu';
}
async function count(env, key) {
  if (!env.CACHE) return 0;
  try { return Number(await env.CACHE.get(P + key)) || 0; } catch (e) { return 0; }
}
// true si la limite est atteinte pour au moins une des règles [clé, max].
export async function isLimited(env, rules) {
  for (const [key, max] of rules) if ((await count(env, key)) >= max) return true;
  return false;
}
// Compte un essai pour chaque règle [clé, fenêtre en secondes].
export async function hit(env, rules) {
  if (!env.CACHE) return;
  for (const [key, windowSec] of rules) {
    try {
      const n = (await count(env, key)) + 1;
      await env.CACHE.put(P + key, String(n), { expirationTtl: Math.max(60, windowSec) });
    } catch (e) { /* KV indisponible : on ne bloque pas */ }
  }
}
export async function reset(env, key) {
  if (env.CACHE) { try { await env.CACHE.delete(P + key); } catch (e) {} }
}
export function tooMany(message) {
  return Response.json({ ok: false, error: 'rate', message }, { status: 429, headers: { 'retry-after': '900' } });
}
