// GET /api/admin/stripe-status — vérifie la clé Stripe + présence du webhook secret.
import { stripeAccountStatus } from '../../_lib/stripe.js';

export async function onRequestGet({ env }) {
  const status = await stripeAccountStatus(env);
  return Response.json(status, { status: status.ok ? 200 : 502 });
}
