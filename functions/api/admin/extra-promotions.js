// GET/POST/PUT/DELETE /api/admin/extra-promotions — offres extras (popup, %, packs).
import {
  listExtraPromotions, createExtraPromotion, updateExtraPromotion, deleteExtraPromotion,
} from '../../_lib/db.js';

function parse(b) {
  const kind = (b.kind === 'pack_flex') ? 'pack_flex' : 'percent';
  const target = ['all', 'late_checkout', 'early_checkin', 'none'].includes(b.target) ? b.target : 'all';
  return {
    title: (b.title || '').toString().trim(),
    message: (b.message || '').toString().trim(),
    cta_label: (b.cta_label || "Profiter de l'offre").toString().trim(),
    kind,
    percent: Math.max(0, Math.min(100, Number(b.percent) || 0)),
    target,
    pack_price_cents: Math.max(0, Math.round(Number(b.pack_price_cents) || 1500)),
    valid_from: (b.valid_from || '').toString().trim(),
    valid_to: (b.valid_to || '').toString().trim(),
    show_popup: b.show_popup ? 1 : 0,
    active: b.active ? 1 : 0,
  };
}

function validDates(p) {
  return /^\d{4}-\d{2}-\d{2}$/.test(p.valid_from)
    && /^\d{4}-\d{2}-\d{2}$/.test(p.valid_to)
    && p.valid_to >= p.valid_from;
}

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, promotions: await listExtraPromotions(env) });
}

export async function onRequestPost({ env, request }) {
  const p = parse(await request.json().catch(() => ({})));
  if (!p.title) return Response.json({ ok: false, message: 'Titre requis.' }, { status: 400 });
  if (!validDates(p)) return Response.json({ ok: false, message: 'Dates invalides.' }, { status: 400 });
  if (p.kind === 'percent' && p.percent <= 0) {
    return Response.json({ ok: false, message: 'Indiquez un pourcentage > 0.' }, { status: 400 });
  }
  await createExtraPromotion(env, p);
  return Response.json({ ok: true });
}

export async function onRequestPut({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  const p = parse(await request.json().catch(() => ({})));
  if (!p.title) return Response.json({ ok: false, message: 'Titre requis.' }, { status: 400 });
  if (!validDates(p)) return Response.json({ ok: false, message: 'Dates invalides.' }, { status: 400 });
  await updateExtraPromotion(env, id, p);
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteExtraPromotion(env, id);
  return Response.json({ ok: true });
}
