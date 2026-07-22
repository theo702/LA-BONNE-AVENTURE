/* La Bonne Aventure — administration (vanilla JS) */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const euro = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'eur' }).format((c || 0) / 100);
  const cents = (v) => Math.round((parseFloat(v) || 0) * 100);

  async function api(path, opts = {}) {
    const res = await fetch('/api/admin/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    let j = null; try { j = await res.json(); } catch (e) {}
    return { status: res.status, j: j || {} };
  }

  // ---------- Auth ----------
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; initApp(); }
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }

  async function tryAuto() {
    const { status } = await api('settings');
    if (status === 200) showApp(); else showLogin();
  }

  $('#loginBtn').addEventListener('click', doLogin);
  $('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    $('#loginErr').textContent = '';
    const { status, j } = await api('login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) });
    if (status === 200) { $('#pw').value = ''; showApp(); }
    else $('#loginErr').textContent = (j && j.message) || 'Connexion impossible.';
  }
  $('#logoutBtn').addEventListener('click', async () => { await api('logout', { method: 'POST' }); showLogin(); });

  // ---------- Tabs ----------
  document.querySelectorAll('.adm-tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.adm-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('.adm-panel').forEach((p) => p.classList.toggle('on', p.id === b.dataset.tab));
    });
  });

  // ---------- Init / chargement ----------
  function initApp() { loadBookings(); loadSettings(); loadPromos(); loadSeasons(); loadBlocks(); }

  // dates : le stockage utilise date_to exclusif ; l'UI manipule des nuits incluses.
  const addDay = (s, n) => { const d = new Date(Date.parse(s)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nightsOf = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

  async function loadBookings() {
    const { j } = await api('bookings');
    const tb = $('#bookTable tbody'); tb.innerHTML = '';
    const rows = (j && j.bookings) || [];
    $('#bookEmpty').hidden = rows.length > 0;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${r.checkin}</td><td>${r.checkout}</td><td>${r.nights}</td>` +
        `<td>${esc(r.guest_name)}</td>` +
        `<td>${esc(r.email)}${r.phone ? '<br>' + esc(r.phone) : ''}</td>` +
        `<td>${r.guests}</td><td>${euro(r.amount_total_cents)}</td>` +
        `<td>${euro(r.taxe_cents)}</td><td>${r.promo_code ? esc(r.promo_code) : '—'}</td>` +
        `<td><span class="adm-badge ${r.status}">${statusFr(r.status)}</span></td>`;
      tb.appendChild(tr);
    });
  }

  async function loadSettings() {
    const { j } = await api('settings');
    const s = j && j.settings; if (!s) return;
    const f = $('#ratesForm');
    f.nightly.value = (s.nightly_cents / 100).toFixed(2);
    f.cleaning.value = (s.cleaning_cents / 100).toFixed(2);
    f.min_nights.value = s.min_nights;
    f.max_guests.value = s.max_guests;
    f.weekly_pct.value = s.weekly_pct;
    f.weekly_min_nights.value = s.weekly_min_nights;
    f.monthly_pct.value = s.monthly_pct;
    f.monthly_min_nights.value = s.monthly_min_nights;
    f.lastmin_pct.value = s.lastmin_pct;
    f.lastmin_days.value = s.lastmin_days;
    f.taxe_enabled.checked = !!s.taxe_enabled;
    f.taxe_rate_pct.value = s.taxe_rate_pct;
    f.taxe_cap_cents.value = (s.taxe_cap_cents / 100).toFixed(2);
    f.taxe_additional_pct.value = s.taxe_additional_pct;
  }

  $('#ratesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      nightly_cents: cents(f.nightly.value), cleaning_cents: cents(f.cleaning.value),
      min_nights: +f.min_nights.value, max_guests: +f.max_guests.value,
      weekly_pct: +f.weekly_pct.value, weekly_min_nights: +f.weekly_min_nights.value,
      monthly_pct: +f.monthly_pct.value, monthly_min_nights: +f.monthly_min_nights.value,
      lastmin_pct: +f.lastmin_pct.value, lastmin_days: +f.lastmin_days.value,
      taxe_enabled: f.taxe_enabled.checked, taxe_rate_pct: +f.taxe_rate_pct.value,
      taxe_cap_cents: cents(f.taxe_cap_cents.value), taxe_additional_pct: +f.taxe_additional_pct.value,
    };
    const { status } = await api('settings', { method: 'PUT', body: JSON.stringify(body) });
    msg('#ratesMsg', status === 200 ? 'Enregistré ✓' : 'Erreur', status !== 200);
  });

  async function loadPromos() {
    const { j } = await api('promos');
    const tb = $('#promoTable tbody'); tb.innerHTML = '';
    const rows = (j && j.promos) || [];
    $('#promoEmpty').hidden = rows.length > 0;
    rows.forEach((p) => {
      const red = p.kind === 'percent' ? `−${p.value} %` : `−${euro(p.value)}`;
      const val = [p.valid_from || '…', p.valid_to || '…'].join(' → ');
      const uses = p.max_uses > 0 ? `${p.used_count}/${p.max_uses}` : `${p.used_count}/∞`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(p.code)}</b>${p.active ? '' : ' <span class="adm-badge cancelled">off</span>'}</td>` +
        `<td>${red}</td><td>${p.min_nights || '—'}</td><td>${val}</td><td>${uses}</td>` +
        `<td><button class="adm-del" data-id="${p.id}" title="Supprimer">✕</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.adm-del').forEach((b) => b.addEventListener('click', async () => {
      await api('promos?id=' + b.dataset.id, { method: 'DELETE' }); loadPromos();
    }));
  }

  $('#promoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const kind = f.kind.value;
    const value = kind === 'fixed' ? cents(f.value.value) : Math.round(parseFloat(f.value.value) || 0);
    const body = {
      code: f.code.value, kind, value,
      min_nights: +f.min_nights.value || 0,
      valid_from: f.valid_from.value || null, valid_to: f.valid_to.value || null,
      max_uses: +f.max_uses.value || 0,
    };
    const { status, j } = await api('promos', { method: 'POST', body: JSON.stringify(body) });
    if (status === 200) { f.reset(); msg('#promoMsg', 'Ajouté ✓'); loadPromos(); }
    else msg('#promoMsg', (j && j.message) || 'Erreur', true);
  });

  async function loadSeasons() {
    const { j } = await api('seasons');
    const tb = $('#seasonTable tbody'); tb.innerHTML = '';
    const rows = (j && j.seasons) || [];
    $('#seasonEmpty').hidden = rows.length > 0;
    rows.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(s.label)}</td><td>${s.date_from}</td><td>${s.date_to}</td>` +
        `<td>${euro(s.nightly_cents)}</td><td>${s.min_nights || '—'}</td>` +
        `<td><button class="adm-del" data-id="${s.id}" title="Supprimer">✕</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.adm-del').forEach((b) => b.addEventListener('click', async () => {
      await api('seasons?id=' + b.dataset.id, { method: 'DELETE' }); loadSeasons();
    }));
  }

  $('#seasonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      label: f.label.value, date_from: f.date_from.value, date_to: f.date_to.value,
      nightly_cents: cents(f.nightly.value), min_nights: f.min_nights.value ? +f.min_nights.value : null,
    };
    const { status, j } = await api('seasons', { method: 'POST', body: JSON.stringify(body) });
    if (status === 200) { f.reset(); msg('#seasonMsg', 'Ajouté ✓'); loadSeasons(); }
    else msg('#seasonMsg', (j && j.message) || 'Erreur', true);
  });

  async function loadBlocks() {
    const { j } = await api('blocks');
    const tb = $('#blockTable tbody'); tb.innerHTML = '';
    const rows = (j && j.blocks) || [];
    $('#blockEmpty').hidden = rows.length > 0;
    rows.forEach((b) => {
      const lastNight = addDay(b.date_to, -1);      // date_to est exclusif
      const nights = nightsOf(b.date_from, b.date_to);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${b.date_from}</td><td>${lastNight}</td><td>${nights}</td>` +
        `<td>${b.label ? esc(b.label) : '—'}</td>` +
        `<td><button class="adm-del" data-id="${b.id}" title="Débloquer">✕</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.adm-del').forEach((btn) => btn.addEventListener('click', async () => {
      await api('blocks?id=' + btn.dataset.id, { method: 'DELETE' }); loadBlocks();
    }));
  }

  $('#blockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.date_from.value || !f.date_to.value) return;
    if (f.date_to.value < f.date_from.value) { msg('#blockMsg', 'La fin doit être après le début.', true); return; }
    const body = { date_from: f.date_from.value, date_to: addDay(f.date_to.value, 1), label: f.label.value };
    const { status, j } = await api('blocks', { method: 'POST', body: JSON.stringify(body) });
    if (status === 200) { f.reset(); msg('#blockMsg', 'Dates bloquées ✓'); loadBlocks(); }
    else msg('#blockMsg', (j && j.message) || 'Erreur', true);
  });

  // ---------- utils ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function statusFr(s) { return { confirmed: 'Confirmée', pending: 'En attente', cancelled: 'Annulée' }[s] || s; }
  function msg(sel, text, isErr) { const el = $(sel); el.textContent = text; el.classList.toggle('err', !!isErr); setTimeout(() => { el.textContent = ''; }, 3500); }

  tryAuto();
})();
