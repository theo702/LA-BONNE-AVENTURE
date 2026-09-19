// Helpers Stripe — clé nettoyée + erreurs lisibles (évite les 502 Cloudflare muets).

export function stripeSecret(env) {
  let key = String(env.STRIPE_SECRET_KEY || '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export function stripeKeyMode(key) {
  if (!key) return 'missing';
  if (key.startsWith('sk_live')) return 'live';
  if (key.startsWith('sk_test')) return 'test';
  return 'unknown';
}

/**
 * Appel API Stripe. Renvoie toujours un objet { ok, ... } — jamais d’exception.
 */
export async function stripeRequest(env, path, { method = 'GET', body } = {}) {
  const key = stripeSecret(env);
  if (!key) {
    return { ok: false, error: 'config', message: 'Paiement non configuré (STRIPE_SECRET_KEY manquant).' };
  }
  try {
    const headers = { Authorization: `Bearer ${key}` };
    let payload;
    if (body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      payload = body.toString();
    } else if (body != null) {
      payload = body;
    }
    const res = await fetch('https://api.stripe.com' + path, {
      method,
      headers,
      body: payload,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { /* ignore */ }
    if (!res.ok) {
      const msg = (data && data.error && data.error.message)
        || (`Stripe HTTP ${res.status}`);
      return { ok: false, error: 'stripe', message: msg, status: res.status };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: 'network',
      message: 'Impossible de joindre Stripe : ' + (e && e.message ? e.message : String(e)),
    };
  }
}

/** Diagnostic pour l’admin : compte, mode live/test, webhook présent. */
export async function stripeAccountStatus(env) {
  const key = stripeSecret(env);
  const webhook = !!String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  const key_mode = stripeKeyMode(key);
  if (!key) {
    return {
      ok: false,
      configured: false,
      key_mode,
      webhook,
      message: 'STRIPE_SECRET_KEY manquant dans Cloudflare Pages → Variables and Secrets.',
    };
  }
  const r = await stripeRequest(env, '/v1/account');
  if (!r.ok) {
    return {
      ok: false,
      configured: true,
      key_mode,
      webhook,
      message: r.message || 'Clé Stripe refusée.',
    };
  }
  const a = r.data || {};
  const name = (a.business_profile && a.business_profile.name)
    || (a.settings && a.settings.dashboard && a.settings.dashboard.display_name)
    || a.email
    || a.id;
  return {
    ok: true,
    configured: true,
    key_mode,
    webhook,
    charges_enabled: !!a.charges_enabled,
    payouts_enabled: !!a.payouts_enabled,
    business_name: name,
    account_id: a.id,
    message: key_mode === 'live'
      ? 'Stripe Production OK — les paiements réels arrivent sur ce compte.'
      : key_mode === 'test'
        ? 'Clé en mode Test (sk_test_) — les vrais paiements n’apparaîtront pas. Mets sk_live_… dans Cloudflare.'
        : 'Clé Stripe reconnue.',
  };
}
