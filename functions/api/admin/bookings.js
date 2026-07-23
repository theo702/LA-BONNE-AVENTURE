// GET /api/admin/bookings — liste ; DELETE ?id= — supprime une réservation.
import { listBookings, deleteBookingById } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ ok: true, bookings: await listBookings(env) });
}

export async function onRequestDelete({ env, request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteBookingById(env, id);
  return Response.json({ ok: true });
}
