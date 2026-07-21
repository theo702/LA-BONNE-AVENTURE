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

// Récupère les plages occupées depuis le(s) calendrier(s) externe(s) (Airbnb, +Booking…).
// AIRBNB_ICAL_URL peut contenir plusieurs URLs séparées par des virgules / retours ligne.
// Cache KV de 30 min, sauf bypassCache=true (re-synchro live avant paiement).
export async function fetchExternalRanges(env, { bypassCache = false } = {}) {
  const rawUrls = env.AIRBNB_ICAL_URL || '';
  const urls = rawUrls.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return [];

  const CACHE_KEY = 'external_ranges';
  if (!bypassCache && env.CACHE) {
    const cached = await env.CACHE.get(CACHE_KEY, 'json');
    if (cached && Array.isArray(cached.ranges)) return cached.ranges;
  }

  let ranges = [];
  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url, { cf: { cacheTtl: 0 } });
        if (!res.ok) return [];
        const text = await res.text();
        return parseICal(text).map((e) => ({ from: e.from, to: e.to, source: 'airbnb' }));
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
