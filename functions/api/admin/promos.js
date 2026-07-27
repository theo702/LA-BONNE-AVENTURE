// GET/POST/DELETE /api/admin/promos — gestion des codes promo.
import { listPromos, createPromo, deletePromo } from '../../_lib/db.js';

// Code promo « offre cure » pré-chargé une seule fois : cure de 3 semaines à 650 € (−100 €
// sur les 750 €), usage unique, valable jusqu'à fin octobre. Marqueur KV → si l'hôte le
// supprime, il ne réapparaît pas. Modifiable/supprimable ensuite depuis l'admin.
async function seedCurePromo(env) {
  try {
    if (!env.CACHE) return;
    if (await env.CACHE.get('seed:cure-oct')) return;
    await createPromo(env, {
      code: 'CURE-OCT', kind: 'fixed', value: 10000,   // −100,00 €
      min_nights: 20, valid_from: null, valid_to: '2026-10-31', max_uses: 1, // cure = 20 nuits (21 jours)
    }).catch(() => {}); // ignore si le code existe déjà
    await env.CACHE.put('seed:cure-oct', '1');
  } catch (e) { /* non bloquant */ }
}

export async function onRequestGet({ env }) {
  await seedCurePromo(env);
  return Response.json({ ok: true, promos: await listPromos(env) });
}

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const code = (b.code || '').toString().trim().toUpperCase();
  if (!code) return Response.json({ ok: false, message: 'Code requis.' }, { status: 400 });
  const kind = b.kind === 'fixed' ? 'fixed' : 'percent';
  const value = Math.max(0, Math.round(Number(b.value) || 0));
  if (value <= 0) return Response.json({ ok: false, message: 'Valeur invalide.' }, { status: 400 });
  if (kind === 'percent' && value > 100) return Response.json({ ok: false, message: 'Pourcentage max 100.' }, { status: 400 });
  try {
    await createPromo(env, {
      code, kind, value,
      min_nights: Math.max(0, Math.round(Number(b.min_nights) || 0)),
      valid_from: b.valid_from || null,
      valid_to: b.valid_to || null,
      max_uses: Math.max(0, Math.round(Number(b.max_uses) || 0)),
    });
  } catch (e) {
    return Response.json({ ok: false, message: 'Ce code existe déjà.' }, { status: 409 });
  }
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, request }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deletePromo(env, id);
  return Response.json({ ok: true });
}
