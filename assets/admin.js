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
  function initApp() { loadBookings(); loadSettings(); loadPromos(); loadSeasons(); loadBlocks(); loadExtras(); loadCalendar(); }

  var KIND_FR = { none: '—', late_checkout: 'Départ tardif', early_checkin: 'Arrivée anticipée' };

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
        `<td><button class="adm-del" data-id="${r.id}" title="Supprimer">✕</button></td>`;
      tb.appendChild(tr);
      tr.querySelector('.adm-del').addEventListener('click', async () => {
        if (!confirm('Supprimer définitivement cette réservation ?')) return;
        await api('bookings?id=' + encodeURIComponent(r.id), { method: 'DELETE' });
        loadBookings();
      });
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
    if (f.cleaning_emails) f.cleaning_emails.value = s.cleaning_emails || '';
    if (f.dynamic_pricing_enabled) f.dynamic_pricing_enabled.checked = !!s.dynamic_pricing_enabled;
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
      cleaning_emails: f.cleaning_emails ? f.cleaning_emails.value : '',
      dynamic_pricing_enabled: f.dynamic_pricing_enabled ? f.dynamic_pricing_enabled.checked : true,
    };
    const { status } = await api('settings', { method: 'PUT', body: JSON.stringify(body) });
    msg('#ratesMsg', status === 200 ? 'Enregistré ✓' : 'Erreur', status !== 200);
    loadCalendar(); // le prix de base / l'activation peut avoir changé
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

  // Normalise une date en 'YYYY-MM-DD' depuis 'JJ/MM/AAAA', 'JJ-MM-AAAA' ou déjà ISO.
  function normDate(raw) {
    const s = (raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // Parse une ligne « date_from  date_to  prix  [min_nuits]  [libellé] ».
  // Renvoie { item } ou { error }.
  function parseSeasonLine(line, no) {
    const parts = line.trim().split(/[\s,;\t]+/).filter(Boolean);
    if (parts.length < 3) return { error: `Ligne ${no} : il faut au moins date début, date fin et prix.` };
    const from = normDate(parts[0]);
    const to = normDate(parts[1]);
    if (!from || !to) return { error: `Ligne ${no} : dates non reconnues.` };
    const price = parseFloat((parts[2] || '').replace('€', '').replace(',', '.'));
    if (!(price > 0)) return { error: `Ligne ${no} : prix invalide.` };
    let idx = 3, min_nights = null;
    if (parts[idx] && /^\d+$/.test(parts[idx])) { min_nights = +parts[idx]; idx++; }
    const label = parts.slice(idx).join(' ') || null;
    return { item: { label, date_from: from, date_to: to, nightly_cents: Math.round(price * 100), min_nights } };
  }

  $('#seasonBulkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const lines = (f.bulk.value || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { msg('#seasonBulkMsg', 'Rien à importer.', true); return; }
    const items = [], errors = [];
    lines.forEach((l, i) => {
      const r = parseSeasonLine(l, i + 1);
      if (r.error) errors.push(r.error); else items.push(r.item);
    });
    if (!items.length) { msg('#seasonBulkMsg', errors[0] || 'Aucune ligne valide.', true); return; }
    const { status, j } = await api('seasons', {
      method: 'PUT', body: JSON.stringify({ items, replace: f.replace.checked }),
    });
    if (status === 200) {
      const extra = (j.skipped || errors.length) ? ` — ${(j.skipped || 0) + errors.length} ignorée(s)` : '';
      msg('#seasonBulkMsg', `${j.imported} période(s) importée(s) ✓${extra}`);
      f.bulk.value = ''; f.replace.checked = false; loadSeasons();
    } else msg('#seasonBulkMsg', (j && j.message) || 'Erreur', true);
  });

  // Import par fichier (.txt/.csv) → même parseur, même endpoint batch.
  $('#seasonFileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#seasonFile');
    const file = input && input.files && input.files[0];
    if (!file) { msg('#seasonFileMsg', 'Choisissez un fichier.', true); return; }
    let text = '';
    try { text = await file.text(); } catch (err) { msg('#seasonFileMsg', 'Lecture du fichier impossible.', true); return; }
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { msg('#seasonFileMsg', 'Fichier vide.', true); return; }
    const items = [], errors = [];
    lines.forEach((l, i) => {
      const r = parseSeasonLine(l, i + 1);
      if (r.error) errors.push(r.error); else items.push(r.item);
    });
    if (!items.length) { msg('#seasonFileMsg', errors[0] || 'Aucune ligne valide.', true); return; }
    msg('#seasonFileMsg', 'Chargement…');
    const { status, j } = await api('seasons', {
      method: 'PUT', body: JSON.stringify({ items, replace: $('#seasonFileReplace').checked }),
    });
    if (status === 200) {
      const extra = (j.skipped || errors.length) ? ` — ${(j.skipped || 0) + errors.length} ignoré(s)` : '';
      msg('#seasonFileMsg', `${j.imported} tarif(s) chargé(s) ✓${extra}`);
      input.value = ''; loadSeasons();
    } else msg('#seasonFileMsg', (j && j.message) || 'Erreur', true);
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

  // Prix d'une date (réplique nightlyForDate : période la plus spécifique sinon base).
  function priceForDate(ds) {
    const d = cal.data; if (!d) return 0;
    if (d.dynamicEnabled) {
      let best = null;
      for (const s of d.seasons || []) {
        if (ds >= s.date_from && ds <= s.date_to) {
          const span = (Date.parse(s.date_to) - Date.parse(s.date_from));
          if (!best || span < best.span) best = { cents: s.nightly_cents, span };
        }
      }
      if (best) return best.cents;
    }
    return d.baseCents;
  }
  // Un override d'une seule journée existe-t-il pour cette date ?
  function isCustomDate(ds) { return (cal.data.seasons || []).some((s) => s.date_from === ds && s.date_to === ds); }

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
      const custom = cal.data.dynamicEnabled && isCustomDate(ds);
      let cls = 'adm-cell s-' + st;
      if (past) cls += ' past';
      if (custom) cls += ' custom';
      if (ds === cal.selected) cls += ' sel';
      const price = priceForDate(ds);
      const priceHtml = past ? '' : '<span class="adm-cell-p">' + Math.round(price / 100) + '€</span>';
      h += '<button class="' + cls + '" data-cday="' + ds + '"' + (past ? ' disabled' : '') + '><span class="adm-cell-d">' + day + '</span>' + priceHtml + '</button>';
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
    const price = priceForDate(ds);
    const custom = cal.data.dynamicEnabled && isCustomDate(ds);
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
      if (cal.data.dynamicEnabled) {
        h += '<div class="adm-ed-row adm-ed-price"><label>Prix ce jour (€)<input id="admEdPrice" type="number" step="1" min="1" value="' + Math.round(price / 100) + '"></label>'
          + '<button class="adm-btn" data-act="setPrice">Appliquer</button>'
          + (custom ? '<button class="adm-ghost" data-act="clearPrice">Réinitialiser</button>' : '') + '</div>';
        h += '<p class="adm-hint">' + (custom ? 'Prix personnalisé pour ce jour.' : 'Actuellement : ' + Math.round(price / 100) + ' € (tarif de période ou de base).') + '</p>';
      } else {
        h += '<p class="adm-hint">Tarification dynamique désactivée : ce jour est vendu au prix de base (' + Math.round(price / 100) + ' €). Activez-la dans l\'onglet Tarifs pour fixer un prix par date.</p>';
      }
    }
    ed.innerHTML = h;

    ed.querySelector('.adm-ed-x').addEventListener('click', () => { cal.selected = null; renderCal(); });
    ed.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => calAction(btn.dataset.act, ds)));
  }

  async function calAction(action, ds) {
    const body = { action, date: ds };
    if (action === 'setPrice') {
      const inp = $('#admEdPrice'); const v = parseFloat(inp && inp.value);
      if (!(v > 0)) return;
      body.price_cents = Math.round(v * 100);
    }
    await api('calendar', { method: 'POST', body: JSON.stringify(body) });
    await loadCalendar(); // recharge l'état (garde la date sélectionnée)
  }

  // ---------- utils ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function statusFr(s) { return { confirmed: 'Confirmée', pending: 'En attente', cancelled: 'Annulée' }[s] || s; }
  function msg(sel, text, isErr) { const el = $(sel); el.textContent = text; el.classList.toggle('err', !!isErr); setTimeout(() => { el.textContent = ''; }, 3500); }

  tryAuto();
})();
