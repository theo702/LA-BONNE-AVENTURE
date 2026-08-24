// GET /api/reviews — avis Google (5★) avec cache KV.
// Variables nécessaires :
// - GOOGLE_PLACES_API_KEY
// - GOOGLE_PLACE_ID
//
// En l'absence de config, l'endpoint renvoie simplement une liste vide.

function cacheHeaders() {
  return { 'cache-control': 'no-store' };
}

function asText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function sanitizeReview(r) {
  return {
    author: asText(r.author_name) || 'Voyageur',
    text: asText(r.text),
    rating: Number(r.rating) || 0,
    relative_time: asText(r.relative_time_description),
    time: Number(r.time) || 0,
  };
}

async function fetchGoogleReviews(env) {
  const key = env.GOOGLE_PLACES_API_KEY;
  const placeId = env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return { ok: true, reviews: [], rating: null, total: null, source: 'missing-config' };

  const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  u.searchParams.set('place_id', placeId);
  u.searchParams.set('fields', 'rating,user_ratings_total,reviews');
  u.searchParams.set('language', 'fr');
  u.searchParams.set('reviews_sort', 'newest');
  u.searchParams.set('key', key);

  const res = await fetch(u.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`google_http_${res.status}`);
  const j = await res.json();
  const result = j && j.result ? j.result : {};
  const reviews = Array.isArray(result.reviews) ? result.reviews : [];

  const mapped = reviews
    .map(sanitizeReview)
    .filter((r) => r.text && r.rating >= 5)
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .slice(0, 8);

  return {
    ok: true,
    reviews: mapped,
    rating: Number(result.rating) || null,
    total: Number(result.user_ratings_total) || null,
    source: 'google',
    fetched_at: new Date().toISOString(),
  };
}

export async function onRequestGet({ env }) {
  const cacheKey = 'google-reviews:v1';
  try {
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey, 'json');
      if (cached && cached.ok) {
        return Response.json(cached, { headers: cacheHeaders() });
      }
    }

    const payload = await fetchGoogleReviews(env);
    if (env.CACHE && payload && payload.ok) {
      await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 * 60 * 6 });
    }
    return Response.json(payload, { headers: cacheHeaders() });
  } catch (e) {
    return Response.json(
      { ok: true, reviews: [], rating: null, total: null, source: 'error' },
      { headers: cacheHeaders() }
    );
  }
}
