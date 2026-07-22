// GET/POST/DELETE /api/admin/blocks — blocages manuels de dates.
import { listBlocks, createBlock, deleteBlock } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, blocks: await listBlocks(env) });
}

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const valid = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!valid(b.date_from) || !valid(b.date_to)) return Response.json({ ok: false, message: 'Dates invalides.' }, { status: 400 });
  if (b.date_to <= b.date_from) return Response.json({ ok: false, message: 'La fin doit être après le début.' }, { status: 400 });
  await createBlock(env, { date_from: b.date_from, date_to: b.date_to, label: (b.label || '').toString().trim() || null });
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteBlock(env, id);
  return Response.json({ ok: true });
}
