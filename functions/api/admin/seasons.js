// GET/POST/PUT/DELETE /api/admin/seasons — gestion des tarifs saisonniers.
import { listSeasons, createSeason, deleteSeason, deleteAllSeasons } from '../../_lib/db.js';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

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

// Import en masse : { items: [{label,date_from,date_to,nightly_cents,min_nights}], replace: bool }.
export async function onRequestPut({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return Response.json({ ok: false, message: 'Aucune ligne à importer.' }, { status: 400 });

  const clean = [];
  const errors = [];
  items.forEach((it, i) => {
    const line = i + 1;
    if (!isDate(it.date_from) || !isDate(it.date_to)) { errors.push(`Ligne ${line} : dates invalides.`); return; }
    if (it.date_to < it.date_from) { errors.push(`Ligne ${line} : fin avant début.`); return; }
    const nightly = Math.max(0, Math.round(Number(it.nightly_cents) || 0));
    if (nightly <= 0) { errors.push(`Ligne ${line} : tarif invalide.`); return; }
    clean.push({
      label: (it.label || '').toString().trim() || 'Saison',
      date_from: it.date_from, date_to: it.date_to, nightly_cents: nightly,
      min_nights: it.min_nights ? Math.max(1, Math.round(Number(it.min_nights))) : null,
    });
  });
  if (!clean.length) return Response.json({ ok: false, message: errors.join(' ') || 'Rien de valide.' }, { status: 400 });

  if (b.replace) await deleteAllSeasons(env);
  for (const s of clean) await createSeason(env, s);
  return Response.json({ ok: true, imported: clean.length, skipped: errors.length, errors });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteSeason(env, id);
  return Response.json({ ok: true });
}
