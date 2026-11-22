// Stock des consommables (PQ, café, sacs poubelle…).
// L'hôte gère la liste et les quantités ; la femme de ménage déclare ce qu'elle utilise
// via un lien personnel (/menage?k=…). Un mail part quand un produit passe sous son seuil.
import { sendStockAlert } from './notify.js';

const KEY_TOKEN = 'stock:menage-token';

export async function ensureStockSchema(env) {
  if (!env || !env.DB) return;
  const run = async (sql) => { try { await env.DB.prepare(sql).run(); } catch (e) { /* déjà présent */ } };
  await run(`CREATE TABLE IF NOT EXISTS stock_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS stock_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL DEFAULT '',
    delta INTEGER NOT NULL,
    qty_after INTEGER NOT NULL,
    who TEXT NOT NULL DEFAULT 'hote',
    created_at TEXT NOT NULL)`);
  // Nombre d'unités dans un paquet (ex. 6 rouleaux). Le stock se compte en paquets.
  await run(`ALTER TABLE stock_items ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1`);
}

// « paquet de 6 » / « à l'unité » — affiché partout (admin, page ménage, mail).
export function packLabel(n) {
  const k = Math.round(Number(n) || 1);
  return k > 1 ? 'paquet de ' + k : 'à l’unité';
}

const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const cleanText = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function listStock(env) {
  await ensureStockSchema(env);
  // last_added : dernière fois que l'hôte a ajouté du stock (sert aux « récents »).
  const r = await env.DB.prepare(`SELECT i.id, i.name, i.unit, i.qty, i.threshold, i.position, i.pack_size, i.created_at,
      COALESCE((SELECT MAX(m.created_at) FROM stock_moves m WHERE m.item_id = i.id AND m.who = 'hote' AND m.delta > 0), i.created_at) AS last_added
    FROM stock_items i ORDER BY i.position, i.name COLLATE NOCASE`).all();
  return (r.results || []).map((x) => ({ ...x, pack_size: x.pack_size || 1, low: x.qty <= x.threshold }));
}

export async function listMoves(env, limit = 30) {
  await ensureStockSchema(env);
  const r = await env.DB.prepare(`SELECT id, item_id, item_name, delta, qty_after, who, created_at FROM stock_moves ORDER BY id DESC LIMIT ?`).bind(limit).all();
  return r.results || [];
}

export async function getItem(env, id) {
  await ensureStockSchema(env);
  return env.DB.prepare(`SELECT id, name, unit, qty, threshold, pack_size FROM stock_items WHERE id = ?`).bind(id).first();
}

export async function createItem(env, b) {
  await ensureStockSchema(env);
  const name = cleanText(b.name, 60);
  if (!name) return { error: 'Nom du produit requis.' };
  const dup = await env.DB.prepare(`SELECT id FROM stock_items WHERE name = ? COLLATE NOCASE`).bind(name).first();
  if (dup) return { error: '« ' + name + ' » existe déjà : touchez-le dans les récents pour en rajouter.' };
  const pack = clampInt(b.pack_size || 1, 1, 500);
  const unit = packLabel(pack);
  const qty = clampInt(b.qty, 0, 9999);
  const threshold = clampInt(b.threshold, 0, 999);
  const pos = await env.DB.prepare(`SELECT COALESCE(MAX(position), 0) + 1 AS p FROM stock_items`).first();
  const r = await env.DB.prepare(`INSERT INTO stock_items (name, unit, qty, threshold, position, created_at, pack_size) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(name, unit, 0, threshold, (pos && pos.p) || 0, new Date().toISOString(), pack).run();
  const id = r.meta && r.meta.last_row_id;
  if (id && qty > 0) await applyDelta(env, id, qty, 'hote', { noAlert: true });
  return { id };
}

export async function updateItem(env, id, b) {
  const it = await getItem(env, id);
  if (!it) return { error: 'Produit introuvable.' };
  const name = b.name != null ? cleanText(b.name, 60) : it.name;
  if (!name) return { error: 'Nom du produit requis.' };
  const pack = b.pack_size != null && b.pack_size !== '' ? clampInt(b.pack_size, 1, 500) : (it.pack_size || 1);
  const unit = b.pack_size != null && b.pack_size !== '' ? packLabel(pack) : (b.unit != null ? cleanText(b.unit, 60) : it.unit);
  const threshold = b.threshold != null && b.threshold !== '' ? clampInt(b.threshold, 0, 999) : it.threshold;
  await env.DB.prepare(`UPDATE stock_items SET name = ?, unit = ?, threshold = ?, pack_size = ? WHERE id = ?`).bind(name, unit, threshold, pack, id).run();
  if (b.qty != null && b.qty !== '') {
    const q = clampInt(b.qty, 0, 9999);
    if (q !== it.qty) await applyDelta(env, id, q - it.qty, 'hote');
  }
  return { ok: true };
}

// Réassort après les courses : +N paquets (et taille du paquet si elle a changé).
export async function restockItem(env, id, b) {
  const it = await getItem(env, id);
  if (!it) return { error: 'Produit introuvable.' };
  const packs = clampInt(b.packs, 1, 999);
  if (b.pack_size != null && b.pack_size !== '') {
    const pack = clampInt(b.pack_size, 1, 500);
    if (pack !== (it.pack_size || 1)) {
      await env.DB.prepare(`UPDATE stock_items SET pack_size = ?, unit = ? WHERE id = ?`).bind(pack, packLabel(pack), id).run();
    }
  }
  if (b.threshold != null && b.threshold !== '') {
    await env.DB.prepare(`UPDATE stock_items SET threshold = ? WHERE id = ?`).bind(clampInt(b.threshold, 0, 999), id).run();
  }
  return applyDelta(env, id, packs, 'hote');
}

export async function deleteItem(env, id) {
  await ensureStockSchema(env);
  await env.DB.prepare(`DELETE FROM stock_items WHERE id = ?`).bind(id).run();
  return { ok: true };
}

// Ajoute (+) ou retire (−) des unités, garde une trace, et prévient l'hôte si le produit
// vient de passer sous son seuil d'alerte (une seule fois, au moment où il le franchit).
export async function applyDelta(env, id, delta, who, opts = {}) {
  const it = await getItem(env, id);
  if (!it) return { error: 'Produit introuvable.' };
  const d = Math.round(Number(delta) || 0);
  if (!d) return { item: it };
  const after = Math.max(0, it.qty + d);
  const real = after - it.qty;
  if (!real) return { item: it };
  const out = await env.DB.batch([
    env.DB.prepare(`UPDATE stock_items SET qty = ? WHERE id = ?`).bind(after, id),
    env.DB.prepare(`INSERT INTO stock_moves (item_id, item_name, delta, qty_after, who, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, it.name + (it.unit ? ' (' + it.unit + ')' : ''), real, after, who === 'menage' ? 'menage' : 'hote', new Date().toISOString()),
  ]);
  const crossed = it.qty > it.threshold && after <= it.threshold;
  if (crossed && !opts.noAlert) {
    const job = sendStockAlert(env, { ...it, qty: after }, who).catch(() => {});
    if (opts.waitUntil) opts.waitUntil(job); else await job;
  }
  const moveId = out && out[1] && out[1].meta ? out[1].meta.last_row_id : null;
  return { item: { ...it, qty: after }, crossed, moveId };
}

// Annuler un geste de la femme de ménage (mauvais bouton) : 15 minutes max.
export async function undoMenageMove(env, moveId) {
  await ensureStockSchema(env);
  const m = await env.DB.prepare(`SELECT id, item_id, delta, who, created_at FROM stock_moves WHERE id = ?`).bind(moveId).first();
  if (!m || m.who !== 'menage') return { error: 'Action introuvable.' };
  if (Date.now() - Date.parse(m.created_at) > 15 * 60 * 1000) return { error: 'Trop tard pour annuler.' };
  const it = await getItem(env, m.item_id);
  if (it) await env.DB.prepare(`UPDATE stock_items SET qty = ? WHERE id = ?`).bind(Math.max(0, it.qty - m.delta), it.id).run();
  await env.DB.prepare(`DELETE FROM stock_moves WHERE id = ?`).bind(m.id).run();
  return { ok: true };
}

// ---------- Lien d'accès de la femme de ménage ----------
function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function getMenageToken(env) {
  if (!env.CACHE) return null;
  return (await env.CACHE.get(KEY_TOKEN)) || null;
}
export async function rotateMenageToken(env) {
  if (!env.CACHE) return null;
  const t = randomToken();
  await env.CACHE.put(KEY_TOKEN, t);
  return t;
}
export async function revokeMenageToken(env) {
  if (env.CACHE) await env.CACHE.delete(KEY_TOKEN);
}
export async function checkMenageToken(env, given) {
  const t = await getMenageToken(env);
  if (!t || !given || typeof given !== 'string' || given.length !== t.length) return false;
  let d = 0;
  for (let i = 0; i < t.length; i++) d |= t.charCodeAt(i) ^ given.charCodeAt(i);
  return d === 0;
}
