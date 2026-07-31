// Programme fidélité — 1 point par nuit confirmée (réglable), une récompense (code promo %,
// usage unique) tous les N points. Réutilise entièrement le moteur de codes promo existant :
// aucune nouvelle mécanique de réduction à construire.
import {
  getSettings, confirmedNightsByEmail, listLoyaltyRewards, createLoyaltyReward, createPromo,
} from './db.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return 'FIDELE-' + s;
}

// Calcule le statut fidélité d'un email, et génère les récompenses nouvellement débloquées
// (idempotent : ne recrée jamais un code déjà attribué pour un palier donné).
export async function getLoyaltyStatus(env, email) {
  const s = await getSettings(env);
  const enabled = s ? !!s.loyalty_enabled : true;
  if (!enabled) return { enabled: false };

  const pointsPerNight = Math.max(1, (s && s.loyalty_points_per_night) || 1);
  const pointsPerReward = Math.max(1, (s && s.loyalty_points_per_reward) || 10);
  const rewardPct = Math.round(Math.min(100, Math.max(0, (s && s.loyalty_reward_pct) || 0)));

  const nights = await confirmedNightsByEmail(env, email);
  const points = nights * pointsPerNight;
  const earnedTiers = Math.floor(points / pointsPerReward);

  const existing = await listLoyaltyRewards(env, email);
  const existingTiers = new Set(existing.map((r) => r.tier));

  for (let tier = 1; tier <= earnedTiers; tier++) {
    if (existingTiers.has(tier)) continue;
    let code = null;
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = randomCode();
      try {
        await createPromo(env, { code: candidate, kind: 'percent', value: rewardPct, min_nights: 0, max_uses: 1 });
        code = candidate;
      } catch (e) { /* code déjà pris (collision improbable) : réessayer */ }
    }
    if (code) await createLoyaltyReward(env, email, tier, code);
  }

  const rewards = await listLoyaltyRewards(env, email);
  const rem = points % pointsPerReward;
  const nextRewardIn = rem === 0 ? pointsPerReward : pointsPerReward - rem;

  return {
    enabled: true,
    nights, points, pointsPerNight, pointsPerReward, rewardPct, nextRewardIn,
    rewards: rewards.map((r) => ({ tier: r.tier, code: r.promo_code })),
  };
}
