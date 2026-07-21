// GET/POST/DELETE /api/admin/seasons — gestion des tarifs saisonniers.
import { listSeasons, createSeason, deleteSeason } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, seasons: await listSeasons(env) });
}

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const label = (b.label || '').toString().trim() || 'Saison';
  const valid = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!valid(b.date_from) || !valid(b.date_to)) return Response.json({ ok: false, message: 'Dates invalides.' }, { status: 400 });
  if (b.date_to < b.date_from) return Response.json({ ok: false, message: 'Fin avant début.' }, { status: 400 });
  const nightly = Math.max(0, Math.round(Number(b.nightly_cents) || 0));
  if (nightly <= 0) return Response.json({ ok: false, message: 'Tarif invalide.' }, { status: 400 });
  await createSeason(env, {
    label, date_from: b.date_from, date_to: b.date_to, nightly_cents: nightly,
    min_nights: b.min_nights ? Math.max(1, Math.round(Number(b.min_nights))) : null,
  });
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteSeason(env, id);
  return Response.json({ ok: true });
}
