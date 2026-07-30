// GET/POST/DELETE /api/admin/sync — synchronisation des calendriers (channel manager).
// Gère les sources iCal à IMPORTER (calendriers des autres plateformes) ; les liens à
// EXPORTER sont construits côté admin à partir de l'origine du site + des noms de sources.
import { ensurePricingSchema, listIcalSources, createIcalSource, deleteIcalSource } from '../../_lib/db.js';
import { parseSources, sourceFromUrl, slugLabel } from '../../_lib/ical.js';

export async function onRequestGet({ env }) {
  await ensurePricingSchema(env);
  const rows = await listIcalSources(env);
  // Sources éventuellement déjà branchées via le secret serveur (lecture seule ici).
  const envLabels = parseSources(env.AIRBNB_ICAL_URL || '').map((s) => s.label);
  return Response.json({
    ok: true,
    sources: rows.map((r) => ({ id: r.id, label: r.label, url: r.url })),
    envLabels,
  });
}

export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  const b = await request.json().catch(() => ({}));
  const url = (b.url || '').toString().trim();
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ ok: false, message: "Lien iCal invalide (doit commencer par http)." }, { status: 400 });
  }
  const label = slugLabel(b.label || '') || sourceFromUrl(url);
  await createIcalSource(env, { label, url });
  try { if (env.CACHE) await env.CACHE.delete('external_ranges'); } catch (e) { /* pas bloquant */ }
  return Response.json({ ok: true, label });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteIcalSource(env, id);
  try { if (env.CACHE) await env.CACHE.delete('external_ranges'); } catch (e) { /* pas bloquant */ }
  return Response.json({ ok: true });
}
