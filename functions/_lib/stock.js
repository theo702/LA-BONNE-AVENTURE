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
}

const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const cleanText = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function listStock(env) {
  await ensureStockSchema(env);
  const r = await env.DB.prepare(`SELECT id, name, unit, qty, threshold, position FROM stock_items ORDER BY position, name COLLATE NOCASE`).all();
  return (r.results || []).map((x) => ({ ...x, low: x.qty <= x.threshold }));
}

export async function listMoves(env, limit = 30) {
  await ensureStockSchema(env);
  const r = await env.DB.prepare(`SELECT id, item_id, item_name, delta, qty_after, who, created_at FROM stock_moves ORDER BY id DESC LIMIT ?`).bind(limit).all();
  return r.results || [];
}

export async function getItem(env, id) {
  await ensureStockSchema(env);
  return env.DB.prepare(`SELECT id, name, unit, qty, threshold FROM stock_items WHERE id = ?`).bind(id).first();
}

export async function createItem(env, b) {
  await ensureStockSchema(env);
  const name = cleanText(b.name, 60);
  if (!name) return { error: 'Nom du produit requis.' };
  const unit = cleanText(b.unit, 60);
  const qty = clampInt(b.qty, 0, 9999);
  const threshold = clampInt(b.threshold, 0, 999);
  const pos = await env.DB.prepare(`SELECT COALESCE(MAX(position), 0) + 1 AS p FROM stock_items`).first();
  const r = await env.DB.prepare(`INSERT INTO stock_items (name, unit, qty, threshold, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(name, unit, qty, threshold, (pos && pos.p) || 0, new Date().toISOString()).run();
  return { id: r.meta && r.meta.last_row_id };
}

export async function updateItem(env, id, b) {
  const it = await getItem(env, id);
  if (!it) return { error: 'Produit introuvable.' };
  const name = b.name != null ? cleanText(b.name, 60) : it.name;
  if (!name) return { error: 'Nom du produit requis.' };
  const unit = b.unit != null ? cleanText(b.unit, 60) : it.unit;
  const threshold = b.threshold != null ? clampInt(b.threshold, 0, 999) : it.threshold;
  await env.DB.prepare(`UPDATE stock_items SET name = ?, unit = ?, threshold = ? WHERE id = ?`).bind(name, unit, threshold, id).run();
  if (b.qty != null && b.qty !== '') {
    const q = clampInt(b.qty, 0, 9999);
    if (q !== it.qty) await applyDelta(env, id, q - it.qty, 'hote');
  }
  return { ok: true };
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
