// GET|POST /api/cron/pending-reminders
// Job hebdo : 1) expire les pending à J-1  2) envoie un rappel aux autres.
// Sécurisé par l’en-tête Authorization: Bearer <CRON_SECRET>
// (secret Cloudflare : wrangler pages secret put CRON_SECRET)
import { ensurePricingSchema, expireStalePending, listPendingForReminder, markReminderSent } from '../../_lib/db.js';
import { sendPendingReminder } from '../../_lib/notify.js';

function authorized(env, request) {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const hdr = request.headers.get('authorization') || '';
  const q = new URL(request.url).searchParams.get('secret') || '';
  return hdr === `Bearer ${secret}` || q === secret;
}

async function run(env) {
  await ensurePricingSchema(env);
  const expired = await expireStalePending(env);
  const pending = await listPendingForReminder(env);
  let sent = 0;
  const errors = [];
  for (const b of pending) {
    try {
      const ok = await sendPendingReminder(env, b);
      if (ok) {
        await markReminderSent(env, b.id);
        sent += 1;
      }
    } catch (e) {
      errors.push({ id: b.id, message: String(e && e.message || e) });
    }
  }
  return { ok: true, expired, reminded: sent, candidates: pending.length, errors };
}

export async function onRequestGet(ctx) {
  return onRequestPost(ctx);
}

export async function onRequestPost({ env, request }) {
  if (!authorized(env, request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await run(env);
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
