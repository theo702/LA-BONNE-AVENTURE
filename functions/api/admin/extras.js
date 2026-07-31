// GET/POST/PUT/DELETE /api/admin/extras — gestion des extras + commandes.
import { listExtras, createExtra, updateExtra, deleteExtra, listExtraOrders } from '../../_lib/db.js';

function parse(b) {
  const kindRaw = (b.kind || 'none').toString().trim();
  const kind = ['none', 'late_checkout', 'early_checkin'].includes(kindRaw) ? kindRaw : 'none';
  return {
    title: (b.title || '').toString().trim(),
    description: (b.description || '').toString().trim(),
    condition: (b.condition || '').toString().trim(),
    price_cents: Math.max(0, Math.round(Number(b.price_cents) || 0)),
    kind,
    active: b.active ? 1 : 0,
    position: Math.max(0, Math.round(Number(b.position) || 0)),
  };
}

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, extras: await listExtras(env, false), orders: await listExtraOrders(env) });
}

export async function onRequestPost({ env, request }) {
  const e = parse(await request.json().catch(() => ({})));
  if (!e.title) return Response.json({ ok: false, message: 'Titre requis.' }, { status: 400 });
  if (e.price_cents <= 0) return Response.json({ ok: false, message: 'Prix invalide.' }, { status: 400 });
  await createExtra(env, e);
  return Response.json({ ok: true });
}

export async function onRequestPut({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  const e = parse(await request.json().catch(() => ({})));
  if (!e.title) return Response.json({ ok: false, message: 'Titre requis.' }, { status: 400 });
  await updateExtra(env, id, e);
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteExtra(env, id);
  return Response.json({ ok: true });
}
