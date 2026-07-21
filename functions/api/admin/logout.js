// POST /api/admin/logout — efface le cookie de session.
import { clearSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'set-cookie': clearSessionCookie() },
  });
}
