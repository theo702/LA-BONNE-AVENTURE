// Lecture / génération de calendriers iCal (RFC 5545, minimal — dates uniquement).

// Déplie les lignes repliées (RFC 5545 : une ligne de continuation commence par espace/tab).
function unfold(text) {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

// 'YYYYMMDD' (ou datetime) -> 'YYYY-MM-DD'
function toDate(val) {
  const digits = (val || '').replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// Analyse un flux iCal -> [{ from, to, uid, summary }]  (to = jour de départ, exclu)
export function parseICal(text) {
  const lines = unfold(text || '');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
    } else if (line === 'END:VEVENT') {
      if (cur && cur.from && cur.to) events.push(cur);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const name = line.slice(0, idx).split(';')[0].toUpperCase();
      const val = line.slice(idx + 1);
      if (name === 'DTSTART') cur.from = toDate(val);
      else if (name === 'DTEND') cur.to = toDate(val);
      else if (name === 'UID') cur.uid = val;
      else if (name === 'SUMMARY') cur.summary = val;
    }
  }
  return events;
}

function escapeText(s) {
  return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Génère un flux iCal à partir de [{ from, to, uid, summary }]
export function generateICal(events, opts = {}) {
  const now = stamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La Bonne Aventure//Moteur de reservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calName || 'La Bonne Aventure')}`,
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid || crypto.randomUUID()}@labonneaventure`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${e.from.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${e.to.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${escapeText(e.summary || 'Réservé')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Déduit un nom de source (« airbnb », « booking », « abritel »…) depuis une URL iCal,
// pour pouvoir exclure une plateforme précise à l'export (évite les boucles d'écho).
export function sourceFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    return (parts.length >= 2 ? parts[parts.length - 2] : parts[0] || 'externe').toLowerCase();
  } catch (e) { return 'externe'; }
}

// Normalise un nom de source en identifiant utilisable dans ?exclude= (minuscules, sans espaces).
export function slugLabel(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Analyse une entrée texte : « url » (nom auto depuis le domaine) ou « nom=url » (nom explicite).
function parseSourceEntry(entry) {
  const m = entry.match(/^([a-zA-Z0-9_-]+)\s*=\s*(https?:\/\/.+)$/);
  if (m) return { label: m[1].toLowerCase(), url: m[2].trim() };
  return { label: sourceFromUrl(entry), url: entry };
}

// Découpe un texte multi-sources (virgules / retours ligne) en [{ label, url }].
export function parseSources(raw) {
  return (raw || '').split(/[\n,]+/).map((u) => u.trim()).filter(Boolean).map(parseSourceEntry);
}

// Récupère les plages occupées depuis les calendriers externes (Airbnb, Booking…).
// Sources = secret `AIRBNB_ICAL_URL` (entrées « url » ou « nom=url ») + table D1 `ical_sources`
// (gérée depuis l'admin). Chaque plage est étiquetée par sa source (`source`).
// Cache KV de 30 min, sauf bypassCache=true (re-synchro live avant paiement).
export async function fetchExternalRanges(env, { bypassCache = false } = {}) {
  const sources = parseSources(env.AIRBNB_ICAL_URL || '');
  try {
    const { results } = await env.DB.prepare(`SELECT label, url FROM ical_sources`).all();
    for (const r of (results || [])) {
      if (r.url) sources.push({ label: slugLabel(r.label) || sourceFromUrl(r.url), url: r.url });
    }
  } catch (e) { /* table absente : ignorer */ }
  if (!sources.length) return [];

  const CACHE_KEY = 'external_ranges';
  if (!bypassCache && env.CACHE) {
    const cached = await env.CACHE.get(CACHE_KEY, 'json');
    if (cached && Array.isArray(cached.ranges)) return cached.ranges;
  }

  let ranges = [];
  try {
    const results = await Promise.all(
      sources.map(async ({ label, url }) => {
        const res = await fetch(url, { cf: { cacheTtl: 0 } });
        if (!res.ok) return [];
        const text = await res.text();
        return parseICal(text).map((e) => ({ from: e.from, to: e.to, source: label }));
      })
    );
    ranges = results.flat();
  } catch (err) {
    // En cas d'échec réseau, on retombe sur le dernier cache connu si disponible.
    if (env.CACHE) {
      const cached = await env.CACHE.get(CACHE_KEY, 'json');
      if (cached && Array.isArray(cached.ranges)) return cached.ranges;
    }
    return [];
  }

  if (env.CACHE) {
    await env.CACHE.put(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), ranges }), {
      expirationTtl: 1800,
    });
  }
  return ranges;
}
