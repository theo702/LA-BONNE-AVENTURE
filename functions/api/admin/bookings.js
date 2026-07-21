// GET /api/admin/bookings — liste des réservations.
import { listBookings } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, bookings: await listBookings(env) });
}
