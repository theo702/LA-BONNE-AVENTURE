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
      if (b.dataset.tab === 't-cal') loadCalendar(); // rafraîchir à l'ouverture
    });
  });

  // ---------- Init / chargement ----------
  function initApp() { loadBookings(); loadSettings(); loadPromos(); loadBlocks(); loadExtras(); loadExtraPromos(); loadCalendar(); loadPrestations(); loadSync(); }

  var KIND_FR = { none: '—', late_checkout: 'Départ tardif', early_checkin: 'Arrivée anticipée' };
  var EXTRA_PROMO_KIND_FR = { percent: 'Réduction %', pack_flex: 'Pack 2 pour 1' };

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
        `<td><span class="adm-badge ${r.status}">${statusFr(r.status)}</span></td>` +
        `<td>${r.stripe_payment_method ? `<button class="adm-caution" data-id="${r.id}" title="Débiter la caution">Caution</button> ` : ''}<button class="adm-del" data-id="${r.id}" title="Supprimer">✕</button></td>`;
      tb.appendChild(tr);
      tr.querySelector('.adm-del').addEventListener('click', async () => {
        if (!confirm('Supprimer définitivement cette réservation ?')) return;
        await api('bookings?id=' + encodeURIComponent(r.id), { method: 'DELETE' });
        loadBookings();
      });
      const cautionBtn = tr.querySelector('.adm-caution');
      if (cautionBtn) cautionBtn.addEventListener('click', () => chargeCaution(r));
    });
  }

  async function chargeCaution(r) {
    const raw = prompt(
      `Débiter la caution de « ${r.guest_name} » (empreinte bancaire).\n` +
      `Montant à prélever en euros (uniquement en cas de dégât) :`, '');
    if (raw == null) return;
    const eurAmt = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(eurAmt) || eurAmt <= 0) { alert('Montant invalide.'); return; }
    if (!confirm(`Confirmer le débit de ${eurAmt.toFixed(2)} € sur la carte de ${r.guest_name} ?`)) return;
    const { status, j } = await api('charge-caution', {
      method: 'POST',
      body: JSON.stringify({ bookingId: r.id, amount_cents: Math.round(eurAmt * 100) }),
    });
    if (status === 200 && j && j.ok) {
      alert(`✓ Caution débitée : ${(j.amount_cents / 100).toFixed(2)} €.`);
    } else {
      alert('Échec : ' + ((j && j.message) || 'erreur inconnue.'));
    }
  }

  async function loadSettings() {
    const { j } = await api('settings');
    const s = j && j.settings; if (!s) return;
    const f = $('#ratesForm');
    const eur = (c) => ((c || 0) / 100).toFixed(0);
    f.nightly.value = eur(s.nightly_cents);
    f.week_total.value = eur(s.week_total_cents != null ? s.week_total_cents : 30000);
    f.cure_total.value = eur(s.cure_total_cents != null ? s.cure_total_cents : 75000);
    f.caution.value = eur(s.caution_cents || 0);
    f.min_nights.value = s.min_nights;
    f.max_guests.value = s.max_guests;
    f.weekly_min_nights.value = s.weekly_min_nights;
    f.monthly_min_nights.value = s.monthly_min_nights;
    f.lastmin_pct.value = s.lastmin_pct;
    f.lastmin_days.value = s.lastmin_days;
    f.taxe_enabled.checked = !!s.taxe_enabled;
    f.taxe_rate_pct.value = s.taxe_rate_pct;
    f.taxe_cap_cents.value = (s.taxe_cap_cents / 100).toFixed(2);
    f.taxe_additional_pct.value = s.taxe_additional_pct;
    if (f.cleaning_emails) f.cleaning_emails.value = s.cleaning_emails || '';
    if (f.loyalty_enabled) {
      f.loyalty_enabled.checked = s.loyalty_enabled == null ? true : !!s.loyalty_enabled;
      f.loyalty_points_per_night.value = s.loyalty_points_per_night || 1;
      f.loyalty_points_per_reward.value = s.loyalty_points_per_reward || 10;
      f.loyalty_reward_pct.value = s.loyalty_reward_pct != null ? s.loyalty_reward_pct : 10;
    }
  }

  async function saveRates(msgSel) {
    const f = $('#ratesForm');
    const body = {
      nightly_cents: cents(f.nightly.value),
      week_total_cents: cents(f.week_total.value),
      cure_total_cents: cents(f.cure_total.value),
      caution_cents: cents(f.caution.value),
      cleaning_cents: 0, // ménage inclus
      min_nights: +f.min_nights.value, max_guests: +f.max_guests.value,
      weekly_min_nights: +f.weekly_min_nights.value,
      monthly_min_nights: +f.monthly_min_nights.value,
      lastmin_pct: +f.lastmin_pct.value, lastmin_days: +f.lastmin_days.value,
      taxe_enabled: f.taxe_enabled.checked, taxe_rate_pct: +f.taxe_rate_pct.value,
      taxe_cap_cents: cents(f.taxe_cap_cents.value), taxe_additional_pct: +f.taxe_additional_pct.value,
      cleaning_emails: f.cleaning_emails ? f.cleaning_emails.value : '',
      loyalty_enabled: f.loyalty_enabled ? f.loyalty_enabled.checked : true,
      loyalty_points_per_night: f.loyalty_points_per_night ? +f.loyalty_points_per_night.value : 1,
      loyalty_points_per_reward: f.loyalty_points_per_reward ? +f.loyalty_points_per_reward.value : 10,
      loyalty_reward_pct: f.loyalty_reward_pct ? +f.loyalty_reward_pct.value : 10,
    };
    const { status } = await api('settings', { method: 'PUT', body: JSON.stringify(body) });
    msg(msgSel || '#ratesMsg', status === 200 ? 'Enregistré ✓' : 'Erreur', status !== 200);
    loadCalendar(); // le prix de base / l'activation peut avoir changé
    return status;
  }

  $('#ratesForm').addEventListener('submit', (e) => { e.preventDefault(); saveRates('#ratesMsg'); });

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

  // ---------- Prestations ménage ----------
  const presta = { rows: [], rate: 0, month: 'all' };
  const monthKey = (d) => (d || '').slice(0, 7);            // 'YYYY-MM'
  const monthLabelFr = (k) => {
    if (k === 'all') return 'Tous les mois';
    const [y, m] = k.split('-');
    return ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][+m - 1] + ' ' + y;
  };

  async function loadPrestations() {
    const { j } = await api('prestations');
    presta.rows = (j && j.bookings) || [];
    presta.rate = (j && j.rate) || 0;
    const rateField = $('#prestaRateForm').cleaning_pay;
    if (rateField && document.activeElement !== rateField) rateField.value = presta.rate ? (presta.rate / 100).toFixed(0) : '';
    // Liste des mois disponibles (par date de départ = jour du ménage).
    const months = Array.from(new Set(presta.rows.map((r) => monthKey(r.checkout)))).sort().reverse();
    const sel = $('#prestaMonth');
    if (!months.includes(presta.month)) presta.month = 'all';
    sel.innerHTML = ['all', ...months].map((k) => `<option value="${k}"${k === presta.month ? ' selected' : ''}>${monthLabelFr(k)}</option>`).join('');
    renderPrestations();
  }

  function renderPrestations() {
    const tb = $('#prestaTable tbody'); tb.innerHTML = '';
    const rows = presta.rows.filter((r) => presta.month === 'all' || monthKey(r.checkout) === presta.month);
    $('#prestaEmpty').hidden = rows.length > 0;
    let due = 0, paid = 0;
    rows.forEach((r) => {
      if (r.paid) paid += r.amountCents; else due += r.amountCents;
      const tr = document.createElement('tr');
      if (r.paid) tr.classList.add('presta-paid');
      tr.innerHTML =
        `<td><b>${r.checkout}</b></td><td>${r.checkin}</td><td>${r.nights}</td>` +
        `<td>${esc(r.guest)}</td>` +
        `<td><input class="presta-amount" type="number" step="1" min="0" value="${Math.round(r.amountCents / 100)}" data-id="${r.id}"${r.custom ? ' title="Montant personnalisé"' : ''}></td>` +
        `<td><button class="presta-toggle ${r.paid ? 'on' : ''}" data-id="${r.id}">${r.paid ? '✓ Payé' : 'À payer'}</button></td>`;
      tb.appendChild(tr);
    });
    $('#prestaCount').textContent = rows.length;
    $('#prestaDue').textContent = euro(due);
    $('#prestaPaid').textContent = euro(paid);

    tb.querySelectorAll('.presta-toggle').forEach((btn) => btn.addEventListener('click', async () => {
      const row = presta.rows.find((x) => x.id === btn.dataset.id);
      await api('prestations', { method: 'POST', body: JSON.stringify({ bookingId: btn.dataset.id, action: row && row.paid ? 'unpaid' : 'paid' }) });
      loadPrestations();
    }));
    tb.querySelectorAll('.presta-amount').forEach((inp) => inp.addEventListener('change', async () => {
      await api('prestations', { method: 'POST', body: JSON.stringify({ bookingId: inp.dataset.id, action: 'amount', amount_cents: cents(inp.value) }) });
      loadPrestations();
    }));
  }

  $('#prestaMonth').addEventListener('change', (e) => { presta.month = e.target.value; renderPrestations(); });
  $('#prestaRateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { status } = await api('prestations', { method: 'PUT', body: JSON.stringify({ cleaning_pay_cents: cents(e.target.cleaning_pay.value) }) });
    msg('#prestaRateMsg', status === 200 ? 'Tarif enregistré ✓' : 'Erreur', status !== 200);
    loadPrestations();
  });

  // ---------- Synchronisation des calendriers ----------
  function syncLinkRow(title, url) {
    return '<div class="sync-link"><div class="sync-link-t">' + esc(title) + '</div>' +
      '<div class="sync-link-b"><input readonly value="' + esc(url) + '"><button type="button" class="adm-btn sync-copy" data-copy="' + esc(url) + '">Copier</button></div></div>';
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(ta);
  }
  function copyText(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(() => { btn.textContent = old; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }

  async function loadSync() {
    const { j } = await api('sync');
    const sources = (j && j.sources) || [];
    const envLabels = (j && j.envLabels) || [];
    const tb = $('#syncTable tbody'); tb.innerHTML = '';
    $('#syncEmpty').hidden = sources.length > 0;
    sources.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(s.label)}</b></td><td class="sync-url">${esc(s.url)}</td>` +
        `<td><button class="adm-del" data-id="${s.id}" title="Supprimer">✕</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.adm-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Retirer ce calendrier importé ?')) return;
      await api('sync?id=' + b.dataset.id, { method: 'DELETE' }); loadSync();
    }));
    const envNote = $('#syncEnv');
    if (envLabels.length) { envNote.hidden = false; envNote.innerHTML = 'Déjà branché côté serveur : <b>' + envLabels.map(esc).join(', ') + '</b>.'; }
    else envNote.hidden = true;

    const base = location.origin + '/calendar.ics';
    const labels = [];
    [...envLabels, ...sources.map((s) => s.label)].forEach((l) => { if (l && labels.indexOf(l) < 0) labels.push(l); });
    const box = $('#syncExport');
    if (labels.length) {
      let h = '';
      labels.forEach((l) => { h += syncLinkRow('À coller dans « ' + l + ' »', base + '?exclude=' + encodeURIComponent(l)); });
      box.innerHTML = h;
      box.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', () => copyText(btn.dataset.copy, btn)));
    } else {
      box.innerHTML = '<p class="adm-hint">Ajoutez d\'abord une plateforme ci-dessus : son lien à coller apparaîtra ici automatiquement.</p>';
    }
  }

  $('#syncForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const { status, j } = await api('sync', { method: 'POST', body: JSON.stringify({ label: f.label.value, url: f.url.value }) });
    if (status === 200) { f.reset(); msg('#syncMsg', 'Ajouté ✓'); loadSync(); }
    else msg('#syncMsg', (j && j.message) || 'Erreur', true);
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

  // ---------- Extras ----------
  async function loadExtras() {
    const { j } = await api('extras');
    const tb = $('#extraTable tbody'); tb.innerHTML = '';
    const rows = (j && j.extras) || [];
    $('#extraEmpty').hidden = rows.length > 0;
    rows.forEach((x) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(x.title)}</b></td><td>${euro(x.price_cents)}</td>` +
        `<td>${KIND_FR[x.kind] || '—'}</td>` +
        `<td>${x.active ? '✓' : '—'}</td>` +
        `<td style="white-space:nowrap"><button class="adm-ghost adm-edit" data-id="${x.id}" style="padding:5px 10px">Modifier</button> <button class="adm-del" data-id="${x.id}">✕</button></td>`;
      tb.appendChild(tr);
      tr.querySelector('.adm-edit').addEventListener('click', () => fillExtraForm(x));
      tr.querySelector('.adm-del').addEventListener('click', async () => { await api('extras?id=' + x.id, { method: 'DELETE' }); loadExtras(); });
    });

    const ob = $('#orderTable tbody'); ob.innerHTML = '';
    const orders = (j && j.orders) || [];
    $('#orderEmpty').hidden = orders.length > 0;
    orders.forEach((o) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${(o.created_at || '').slice(0, 10)}</td><td>${esc(o.title || '')}</td>` +
        `<td>${o.service_date || '—'}</td><td>${esc(o.guest_name || '')}<br>${esc(o.email || '')}</td>` +
        `<td>${euro(o.amount_cents)}</td><td><span class="adm-badge ${o.status === 'confirmed' ? 'confirmed' : 'pending'}">${o.status === 'confirmed' ? 'Payé' : 'En attente'}</span></td>`;
      ob.appendChild(tr);
    });
  }

  function fillExtraForm(x) {
    const f = $('#extraForm');
    f.id.value = x.id; f.title.value = x.title; f.price.value = (x.price_cents / 100).toFixed(2);
    f.kind.value = x.kind || 'none'; f.position.value = x.position || 0;
    f.description.value = x.description || ''; f.condition.value = x.condition || ''; f.active.checked = !!x.active;
    $('#extraSubmit').textContent = 'Enregistrer les modifications';
    $('#extraCancel').hidden = false;
    document.querySelector('.adm-tabs button[data-tab="t-extra"]').scrollIntoView({ block: 'nearest' });
  }
  function resetExtraForm() {
    const f = $('#extraForm'); f.reset(); f.id.value = '';
    $('#extraSubmit').textContent = "Ajouter l'extra"; $('#extraCancel').hidden = true;
  }
  $('#extraCancel').addEventListener('click', resetExtraForm);

  $('#extraForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      title: f.title.value, description: f.description.value, condition: f.condition.value,
      price_cents: cents(f.price.value), kind: f.kind.value,
      position: +f.position.value || 0, active: f.active.checked,
    };
    const id = f.id.value;
    const res = id
      ? await api('extras?id=' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('extras', { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 200) { resetExtraForm(); msg('#extraMsg', 'Enregistré ✓'); loadExtras(); }
    else msg('#extraMsg', (res.j && res.j.message) || 'Erreur', true);
  });

  // ---------- Offres extras (popups / packs / %) ----------
  function syncExtraPromoFields() {
    const kind = ($('#extraPromoKind') || {}).value || 'pack_flex';
    const isPack = kind === 'pack_flex';
    const pw = $('#extraPromoPercentWrap');
    const pk = $('#extraPromoPackWrap');
    const tw = $('#extraPromoTargetWrap');
    if (pw) pw.style.display = isPack ? 'none' : '';
    if (pk) pk.style.display = isPack ? '' : 'none';
    if (tw) tw.style.display = isPack ? 'none' : '';
  }
  const kindSel = $('#extraPromoKind');
  if (kindSel) kindSel.addEventListener('change', syncExtraPromoFields);
  syncExtraPromoFields();

  async function loadExtraPromos() {
    const { j } = await api('extra-promotions');
    const tb = $('#extraPromoTable tbody'); if (!tb) return;
    tb.innerHTML = '';
    const rows = (j && j.promotions) || [];
    $('#extraPromoEmpty').hidden = rows.length > 0;
    rows.forEach((p) => {
      const detail = p.kind === 'pack_flex'
        ? ('Pack à ' + euro(p.pack_price_cents))
        : ('−' + Math.round(p.percent || 0) + '% · ' + (KIND_FR[p.target] || 'Tous'));
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(p.title)}</b></td>` +
        `<td>${EXTRA_PROMO_KIND_FR[p.kind] || p.kind}</td>` +
        `<td>${esc(detail)}</td>` +
        `<td>${esc(p.valid_from)} → ${esc(p.valid_to)}</td>` +
        `<td>${p.show_popup ? '✓' : '—'}</td>` +
        `<td>${p.active ? '✓' : '—'}</td>` +
        `<td style="white-space:nowrap"><button class="adm-ghost adm-edit" data-id="${p.id}" style="padding:5px 10px">Modifier</button> <button class="adm-del" data-id="${p.id}">✕</button></td>`;
      tb.appendChild(tr);
      tr.querySelector('.adm-edit').addEventListener('click', () => fillExtraPromoForm(p));
      tr.querySelector('.adm-del').addEventListener('click', async () => {
        await api('extra-promotions?id=' + p.id, { method: 'DELETE' });
        loadExtraPromos();
      });
    });
  }

  function fillExtraPromoForm(p) {
    const f = $('#extraPromoForm');
    f.id.value = p.id;
    f.title.value = p.title || '';
    f.kind.value = p.kind || 'pack_flex';
    f.percent.value = p.percent || 0;
    f.pack_price.value = ((p.pack_price_cents || 1500) / 100).toFixed(2);
    f.target.value = p.target || 'all';
    f.valid_from.value = p.valid_from || '';
    f.valid_to.value = p.valid_to || '';
    f.message.value = p.message || '';
    f.cta_label.value = p.cta_label || "Profiter de l'offre";
    f.show_popup.checked = !!p.show_popup;
    f.active.checked = !!p.active;
    $('#extraPromoSubmit').textContent = 'Enregistrer les modifications';
    $('#extraPromoCancel').hidden = false;
    syncExtraPromoFields();
    document.querySelector('.adm-tabs button[data-tab="t-extra-promo"]').click();
  }
  function resetExtraPromoForm() {
    const f = $('#extraPromoForm');
    f.reset(); f.id.value = '';
    f.cta_label.value = "Profiter de l'offre";
    f.pack_price.value = '15';
    f.show_popup.checked = true;
    f.active.checked = true;
    $('#extraPromoSubmit').textContent = "Créer l’offre";
    $('#extraPromoCancel').hidden = true;
    syncExtraPromoFields();
  }
  $('#extraPromoCancel').addEventListener('click', resetExtraPromoForm);

  $('#extraPromoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      title: f.title.value,
      message: f.message.value,
      cta_label: f.cta_label.value,
      kind: f.kind.value,
      percent: +f.percent.value || 0,
      target: f.target.value,
      pack_price_cents: cents(f.pack_price.value),
      valid_from: f.valid_from.value,
      valid_to: f.valid_to.value,
      show_popup: f.show_popup.checked,
      active: f.active.checked,
    };
    const id = f.id.value;
    const res = id
      ? await api('extra-promotions?id=' + id, { method: 'PUT', body: JSON.stringify(body) })
      : await api('extra-promotions', { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 200) { resetExtraPromoForm(); msg('#extraPromoMsg', 'Enregistré ✓'); loadExtraPromos(); }
    else msg('#extraPromoMsg', (res.j && res.j.message) || 'Erreur', true);
  });

  // ---------- Calendrier interactif ----------
  var CAL_MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var CAL_DOW = ['L','M','M','J','V','S','D'];
  var cal = { data: null, view: null, selected: null, loading: false };

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  const parseD = (s) => { const p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };
  const today = () => new Date().toISOString().slice(0, 10);

  // Ensemble des nuits couvertes par une liste de plages [from, to) (to exclusif).
  function nightsSet(ranges) {
    const set = new Set();
    (ranges || []).forEach((r) => {
      if (!r.from || !r.to) return;
      let d = parseD(r.from); const end = parseD(r.to); let g = 0;
      while (d < end && g < 1200) { set.add(ymd(d)); d = new Date(d.getTime() + 86400000); g++; }
    });
    return set;
  }

  async function loadCalendar() {
    const host = $('#admCal'); if (!host) return;
    const { j } = await api('calendar');
    if (!j || !j.ok) { host.innerHTML = '<div class="adm-cal-loading">Calendrier momentanément indisponible.</div>'; return; }
    cal.data = j;
    cal.booked = nightsSet(j.bookings);
    cal.external = nightsSet(j.external);
    cal.blocked = nightsSet(j.blocks);
    cal.bookByNight = {};
    (j.bookings || []).forEach((b) => { let d = parseD(b.from); const e = parseD(b.to); let g = 0; while (d < e && g < 1200) { cal.bookByNight[ymd(d)] = b; d = new Date(d.getTime() + 86400000); g++; } });
    if (!cal.view) { const n = new Date(); cal.view = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); }
    renderCal();
  }

  function stateOf(ds) {
    if (cal.booked.has(ds)) return 'book';
    if (cal.external.has(ds)) return 'ext';
    if (cal.blocked.has(ds)) return 'block';
    return 'free';
  }

  function renderCal() {
    const host = $('#admCal'); if (!host || !cal.data) return;
    const y = cal.view.getUTCFullYear(), m = cal.view.getUTCMonth();
    const cur = today().slice(0, 7);
    const atMin = (y + '-' + pad2(m + 1)) <= cur;

    let h = '<div class="adm-cal-top">' +
      '<button class="adm-cal-nav" data-cnav="-1"' + (atMin ? ' disabled' : '') + '>‹</button>' +
      '<div class="adm-cal-title">' + CAL_MONTHS[m] + ' ' + y + '</div>' +
      '<button class="adm-cal-nav" data-cnav="1">›</button></div>';
    h += '<div class="adm-cal-dow">' + CAL_DOW.map((d) => '<span>' + d + '</span>').join('') + '</div>';
    h += '<div class="adm-cal-grid">';
    const first = new Date(Date.UTC(y, m, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    for (let i = 0; i < lead; i++) h += '<div class="adm-cell empty"></div>';
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let day = 1; day <= days; day++) {
      const ds = y + '-' + pad2(m + 1) + '-' + pad2(day);
      const past = ds < today();
      const st = stateOf(ds);
      let cls = 'adm-cell s-' + st;
      if (past) cls += ' past';
      if (ds === cal.selected) cls += ' sel';
      h += '<button class="' + cls + '" data-cday="' + ds + '"' + (past ? ' disabled' : '') + '><span class="adm-cell-d">' + day + '</span></button>';
    }
    h += '</div>';
    h += '<div id="admCalEditor" class="adm-cal-editor" hidden></div>';
    host.innerHTML = h;

    host.querySelectorAll('[data-cnav]').forEach((b) => b.addEventListener('click', () => {
      cal.view = new Date(Date.UTC(y, m + (+b.dataset.cnav), 1)); cal.selected = null; renderCal();
    }));
    host.querySelectorAll('[data-cday]').forEach((b) => b.addEventListener('click', () => selectDay(b.dataset.cday)));
    if (cal.selected) renderEditor();
  }

  function selectDay(ds) { cal.selected = (cal.selected === ds ? null : ds); renderCal(); }

  function renderEditor() {
    const ed = $('#admCalEditor'); if (!ed) return;
    const ds = cal.selected; if (!ds) { ed.hidden = true; return; }
    ed.hidden = false;
    const st = stateOf(ds);
    const dObj = parseD(ds);
    const human = dObj.getUTCDate() + ' ' + CAL_MONTHS[dObj.getUTCMonth()] + ' ' + dObj.getUTCFullYear();

    let h = '<div class="adm-ed-head"><b>' + human + '</b> <span class="adm-badge ' + (st === 'book' ? 'confirmed' : st === 'ext' ? 'pending' : st === 'block' ? 'cancelled' : '') + '">' + { book: 'Réservé (direct)', ext: 'Airbnb', block: 'Bloqué', free: 'Libre' }[st] + '</span>'
      + '<button class="adm-ed-x" title="Fermer">✕</button></div>';

    if (st === 'book') {
      const b = cal.bookByNight[ds];
      h += '<p class="adm-hint">Réservation directe' + (b && b.guest ? ' — <b>' + esc(b.guest) + '</b>' : '') + (b && b.status === 'pending' ? ' (paiement en attente)' : '') + '. Gérez-la depuis l\'onglet Réservations.</p>';
    } else if (st === 'ext') {
      h += '<p class="adm-hint">Date importée depuis Airbnb (synchro iCal). Non modifiable ici — elle se libère automatiquement quand Airbnb la libère.</p>';
    } else {
      // Libre ou bloqué → actions
      h += '<div class="adm-ed-row">';
      if (st === 'block') h += '<button class="adm-btn" data-act="unblock">Libérer cette date</button>';
      else h += '<button class="adm-ghost" data-act="block">Bloquer cette date</button>';
      h += '</div>';
    }
    ed.innerHTML = h;

    ed.querySelector('.adm-ed-x').addEventListener('click', () => { cal.selected = null; renderCal(); });
    ed.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => calAction(btn.dataset.act, ds)));
  }

  async function calAction(action, ds) {
    await api('calendar', { method: 'POST', body: JSON.stringify({ action, date: ds }) });
    await loadCalendar(); // recharge l'état (garde la date sélectionnée)
  }

  // ---------- utils ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function statusFr(s) { return { confirmed: 'Confirmée', pending: 'En attente', cancelled: 'Annulée' }[s] || s; }
  function msg(sel, text, isErr) { const el = $(sel); el.textContent = text; el.classList.toggle('err', !!isErr); setTimeout(() => { el.textContent = ''; }, 3500); }

  tryAuto();
})();
