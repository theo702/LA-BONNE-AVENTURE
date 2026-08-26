// GET /api/guide-hours — horaires d'arrivée/départ pour le livret (personnalisés si extras payés).
import { getGuestEmail } from '../_lib/guestAuth.js';

const DEFAULT = {
  arrival: '16:00',
  departure: '10:00',
  early: false,
  late: false,
};

export async function onRequestGet({ env, request }) {
  const out = { ...DEFAULT };
  let email = null;
  try { email = await getGuestEmail(env, request); } catch (e) { email = null; }

  // Fallback : ?email= uniquement si le client envoie aussi un session_id d'extra payé (anti-énumération).
  const u = new URL(request.url);
  const qEmail = (u.searchParams.get('email') || '').trim().toLowerCase();
  const sid = (u.searchParams.get('session_id') || '').trim();
  if (!email && qEmail && sid && env.DB) {
    try {
      const row = await env.DB.prepare(
        `SELECT email FROM extra_orders
          WHERE stripe_session_id = ?1 AND lower(email) = ?2 AND status = 'confirmed'
          LIMIT 1`
      ).bind(sid, qEmail).first();
      if (row) email = qEmail;
    } catch (e) { /* ignore */ }
  }

  if (email && env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT kind, service_date FROM extra_orders
          WHERE lower(email) = ?1 AND status = 'confirmed'
            AND kind IN ('early_checkin','late_checkout')
          ORDER BY created_at DESC LIMIT 20`
      ).bind(email.toLowerCase()).all();
      (results || []).forEach((r) => {
        if (r.kind === 'early_checkin') out.early = true;
        if (r.kind === 'late_checkout') out.late = true;
      });
    } catch (e) { /* ignore */ }
  }

  if (out.early) out.arrival = '12:00';
  if (out.late) out.departure = '14:00';
  return Response.json(out, { headers: { 'cache-control': 'no-store' } });
}
