// POST /api/account/logout — efface le cookie de session voyageur.
import { clearGuestCookie } from '../../_lib/guestAuth.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'Set-Cookie': clearGuestCookie() },
  });
}
