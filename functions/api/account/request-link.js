// POST /api/account/request-link — envoie un lien de connexion à usage unique (magic link).
// Réponse volontairement identique que l'email soit connu ou non (pas d'énumération d'emails) :
// le lien n'est réellement envoyé que si au moins une réservation existe pour cet email.
import { listBookingsByEmail, createMagicLink, ensurePricingSchema } from '../../_lib/db.js';
import { sendMagicLink } from '../../_lib/notify.js';
import { clientIp, isLimited, hit, tooMany } from '../../_lib/ratelimit.js';

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
const GENERIC = "Si cet email est associé à une réservation, un lien de connexion vient de vous être envoyé.";

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const email = (b.email || '').toString().trim().toLowerCase();
  if (!isEmail(email)) return Response.json({ ok: false, message: 'Email invalide.' }, { status: 400 });

  // Anti-spam : 5 demandes par heure et par IP, 3 par heure pour un même email.
  const rules = [['link:ip:' + clientIp(request), 5], ['link:mail:' + email, 3]];
  if (await isLimited(env, rules)) return tooMany('Trop de demandes. Réessayez dans un moment.');
  await hit(env, rules.map(([k]) => [k, 60 * 60]));

  await ensurePricingSchema(env); // crée les tables magic_links/... sur une base ancienne
  const bookings = await listBookingsByEmail(env, email).catch(() => []);
  if (bookings.length > 0) {
    const token = await createMagicLink(env, email, 15);
    const origin = env.SITE_URL || new URL(request.url).origin;
    const url = `${origin}/api/account/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLink(env, email, url);
  }
  return Response.json({ ok: true, message: GENERIC });
}
