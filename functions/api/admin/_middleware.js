// Protège toutes les routes /api/admin/* (sauf login) par cookie signé.
import { isAuthed } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/api/admin/login')) return next();
  if (await isAuthed(env, request)) return next();
  return new Response(JSON.stringify({ ok: false, error: 'auth', message: 'Non authentifié.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}
