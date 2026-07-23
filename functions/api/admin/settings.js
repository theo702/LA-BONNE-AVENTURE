// GET/PUT /api/admin/settings — lecture et mise à jour des tarifs / réductions / taxe.
import { getSettings, updateSettings } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, settings: await getSettings(env) });
}

export async function onRequestPut({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const cur = await getSettings(env);
  const s = {
    nightly_cents: Math.max(0, Math.round(num(b.nightly_cents, cur.nightly_cents))),
    cleaning_cents: Math.max(0, Math.round(num(b.cleaning_cents, cur.cleaning_cents))),
    min_nights: Math.max(1, Math.round(num(b.min_nights, cur.min_nights))),
    max_guests: Math.max(1, Math.round(num(b.max_guests, cur.max_guests))),
    weekly_pct: Math.min(100, Math.max(0, num(b.weekly_pct, cur.weekly_pct))),
    weekly_min_nights: Math.max(1, Math.round(num(b.weekly_min_nights, cur.weekly_min_nights))),
    monthly_pct: Math.min(100, Math.max(0, num(b.monthly_pct, cur.monthly_pct))),
    monthly_min_nights: Math.max(1, Math.round(num(b.monthly_min_nights, cur.monthly_min_nights))),
    lastmin_days: Math.max(0, Math.round(num(b.lastmin_days, cur.lastmin_days))),
    lastmin_pct: Math.min(100, Math.max(0, num(b.lastmin_pct, cur.lastmin_pct))),
    taxe_enabled: b.taxe_enabled ? 1 : 0,
    taxe_rate_pct: Math.max(0, num(b.taxe_rate_pct, cur.taxe_rate_pct)),
    taxe_cap_cents: Math.max(0, Math.round(num(b.taxe_cap_cents, cur.taxe_cap_cents))),
    taxe_additional_pct: Math.max(0, num(b.taxe_additional_pct, cur.taxe_additional_pct)),
    cleaning_emails: (b.cleaning_emails == null ? (cur.cleaning_emails || '') : String(b.cleaning_emails)).trim(),
  };
  await updateSettings(env, s);
  return Response.json({ ok: true, settings: { ...cur, ...s } });
}
