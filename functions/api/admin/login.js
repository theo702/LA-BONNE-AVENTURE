// POST /api/admin/login — vérifie le mot de passe et pose le cookie de session.
// Anti force brute : 5 erreurs en 15 min par adresse IP, 40 erreurs par heure au total.
import { checkPassword, createSessionCookie } from '../../_lib/auth.js';
import { clientIp, isLimited, hit, reset, tooMany } from '../../_lib/ratelimit.js';

export async function onRequestPost({ env, request }) {
  const ip = clientIp(request);
  const kIp = 'login:ip:' + ip, kAll = 'login:all';
  if (await isLimited(env, [[kIp, 5], [kAll, 40]])) {
    return tooMany('Trop d’essais. Réessayez dans 15 minutes.');
  }
  const body = await request.json().catch(() => ({}));
  if (!(await checkPassword(env, body.password))) {
    await hit(env, [[kIp, 15 * 60], [kAll, 60 * 60]]);
    return new Response(JSON.stringify({ ok: false, message: 'Mot de passe incorrect.' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  await reset(env, kIp);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': await createSessionCookie(env) },
  });
}
