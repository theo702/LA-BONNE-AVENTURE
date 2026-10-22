// GET/POST/PUT/DELETE /api/admin/event-rates — prix spéciaux sur des dates (ex. Musilac).
import { loadEventRates } from '../../_lib/pricing.js';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
function parse(b) {
  const label = (b.label || '').toString().trim();
  const nightly_cents = Math.round(Number(b.nightly_cents) || 0);
  if (!label) return { error: 'Nom requis.' };
  if (!isDate(b.date_from) || !isDate(b.date_to) || b.date_to <= b.date_from) return { error: 'Période invalide (1re nuit → départ).' };
  if (nightly_cents <= 0) return { error: 'Prix invalide.' };
  return { r: { label, date_from: b.date_from, date_to: b.date_to, nightly_cents, min_nights: Math.max(0, Math.round(Number(b.min_nights) || 0)) } };
}

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, rates: await loadEventRates(env) });
}
export async function onRequestPost({ env, request }) {
  await loadEventRates(env);
  const p = parse(await request.json().catch(() => ({})));
  if (p.error) return Response.json({ ok: false, message: p.error }, { status: 400 });
  const r = p.r;
  await env.DB.prepare(`INSERT INTO event_rates (label, date_from, date_to, nightly_cents, min_nights, created_at) VALUES (?1,?2,?3,?4,?5,?6)`)
    .bind(r.label, r.date_from, r.date_to, r.nightly_cents, r.min_nights, new Date().toISOString()).run();
  return Response.json({ ok: true });
}
export async function onRequestPut({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  const p = parse(await request.json().catch(() => ({})));
  if (!id || p.error) return Response.json({ ok: false, message: p.error || 'id manquant.' }, { status: 400 });
  const r = p.r;
  await env.DB.prepare(`UPDATE event_rates SET label=?1, date_from=?2, date_to=?3, nightly_cents=?4, min_nights=?5 WHERE id=?6`)
    .bind(r.label, r.date_from, r.date_to, r.nightly_cents, r.min_nights, id).run();
  return Response.json({ ok: true });
}
export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await env.DB.prepare(`DELETE FROM event_rates WHERE id = ?1`).bind(id).run();
  return Response.json({ ok: true });
}
