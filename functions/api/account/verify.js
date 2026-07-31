// GET /api/account/verify?token=... — consomme le lien magique (usage unique), pose le
// cookie de session voyageur, puis redirige vers l'espace voyageur.
import { consumeMagicLink, ensurePricingSchema } from '../../_lib/db.js';
import { createGuestCookie } from '../../_lib/guestAuth.js';

export async function onRequestGet({ env, request }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const origin = new URL(request.url).origin;
  await ensurePricingSchema(env);
  const email = await consumeMagicLink(env, token).catch(() => null);
  if (!email) {
    return Response.redirect(`${origin}/mon-compte.html?erreur=lien_expire`, 302);
  }
  const cookie = await createGuestCookie(env, email);
  return new Response(null, {
    status: 302,
    headers: { 'Set-Cookie': cookie, Location: `${origin}/mon-compte.html` },
  });
}
