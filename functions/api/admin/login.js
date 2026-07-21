// POST /api/admin/login — vérifie le mot de passe et pose le cookie de session.
import { checkPassword, createSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  if (!(await checkPassword(env, body.password))) {
    return new Response(JSON.stringify({ ok: false, message: 'Mot de passe incorrect.' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': await createSessionCookie(env) },
  });
}
