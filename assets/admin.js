/* La Bonne Aventure — administration (vanilla JS) */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const euro = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'eur' }).format((c || 0) / 100);
  const cents = (v) => Math.round((parseFloat(v) || 0) * 100);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  function isoToDmy(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
    const p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function dmyToIso(raw) {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) return '';
    const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }
  function bindDmyInput(inp) {
    if (!inp || inp.dataset.dmyBound) return;
    inp.dataset.dmyBound = '1';
    inp.addEventListener('input', () => {
      const digits = inp.value.replace(/\D/g, '').slice(0, 8);
      let out = digits;
      if (digits.length > 4) out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
      else if (digits.length > 2) out = digits.slice(0, 2) + '/' + digits.slice(2);
      if (inp.value !== out) inp.value = out;
    });
    inp.addEventListener('blur', () => {
      const iso = dmyToIso(inp.value);
      if (iso) { inp.value = isoToDmy(iso); inp.setCustomValidity(''); }
      else if (inp.value.trim()) inp.setCustomValidity('Date invalide (jj/mm/aaaa)');
      else inp.setCustomValidity('');
    });
  }
  function bindAllDmyInputs(root) {
    (root || document).querySelectorAll('input[placeholder="jj/mm/aaaa"]').forEach(bindDmyInput);
  }

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

  // ---------- Onglets (barre du bas sur iPhone, barre latérale sur PC) ----------
  var TAB_TITLES = {
    't-home': null, 't-book': 'Séjours', 't-cal': 'Calendrier', 't-stock': 'Stock', 't-rates': 'Tarifs',
    't-promo': 'Promos & événements', 't-extra': 'Extras', 't-sync': 'Synchro', 't-more': 'Plus',
  };
  var SECONDARY_TABS = { 't-rates': 1, 't-promo': 1, 't-extra': 1, 't-sync': 1 };
  var JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function frShort(iso) { const d = new Date(iso + 'T00:00:00Z'); return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()]; }

  function setTopTitle(id) {
    const t = $('#topTitle'), k = $('#topKicker');
    const now = new Date();
    k.textContent = 'Espace hôte · ' + JOURS[now.getDay()] + ' ' + now.getDate() + ' ' + MOIS[now.getMonth()];
    if (id === 't-home') t.innerHTML = (now.getHours() >= 18 || now.getHours() < 5 ? 'Bonsoir' : 'Bonjour') + ' <em>Théo</em>';
    else t.textContent = TAB_TITLES[id] || '';
    document.body.dataset.curTab = id;
  }

  function goTab(id, open) {
    if (!document.getElementById(id)) id = 't-home';
    document.querySelectorAll('.adm-tabs [data-tab]').forEach((x) => {
      x.classList.toggle('on', x.dataset.tab === id || (x.dataset.tab === 't-more' && !!SECONDARY_TABS[id]));
    });
    document.querySelectorAll('.adm-panel').forEach((p) => p.classList.toggle('on', p.id === id));
    setTopTitle(id);
    renderTopExtra(id);
    try { history.replaceState(null, '', '#' + id.slice(2)); } catch (e) {}
    window.scrollTo(0, 0);
    if (id === 't-cal') loadCalendar(); // rafraîchir à l'ouverture
    if (id === 't-stock' || id === 't-home') loadStock();
    if (open === 'addbook') {
      const d = $('#addBookDetails');
      if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab], a[data-tab]');
    if (b && !b.closest('#login')) { e.preventDefault(); goTab(b.dataset.tab, b.dataset.open); return; }
    const out = e.target.closest('[data-action="logout"]');
    if (out) { e.preventDefault(); $('#logoutBtn').click(); }
  });

  // Tableaux → cartes sur mobile : chaque cellule reçoit le titre de sa colonne.
  function labelTable(t) {
    const heads = Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || ''); });
    });
  }
  document.querySelectorAll('table.adm-table').forEach((t) => {
    labelTable(t);
    const tb = t.querySelector('tbody');
    if (tb && window.MutationObserver) new MutationObserver(() => labelTable(t)).observe(tb, { childList: true });
  });

  // ---------- Init / chargement ----------
  function initApp() {
    bindAllDmyInputs();
    const h = (location.hash || '').replace('#', '');
    goTab(h ? 't-' + h : 't-home');
    if (h && h !== 'stock' && h !== 'home') loadStock();
    loadBookings(); loadSettings(); loadStripeStatus(); loadPromos(); loadEvents(); loadExtras(); loadCalendar(); loadSync();
  }


  // ---------- Stock ----------
  var stock = { items: [], moves: [], token: null, email: null, editing: null, loaded: false };
  var STOCK_SUGG = [
    ['Papier toilette', 'paquet de 6 rouleaux'], ['Essuie-tout', 'rouleau'], ['Sacs poubelle', 'rouleau'],
    ['Café', 'boîte de capsules'], ['Thé', 'boîte'], ['Savon mains', 'recharge'], ['Gel douche', 'recharge'],
    ['Liquide vaisselle', 'flacon'], ['Éponges', 'paquet'], ['Pastilles lave-vaisselle', 'boîte'], ['Produit ménager', 'flacon'],
  ];

  async function loadStock() {
    const { status, j } = await api('stock');
    if (status !== 200 || !j || !j.ok) { const l = $('#stockList'); if (l && !stock.loaded) l.innerHTML = '<div class="up-empty">Stock momentanément indisponible.</div>'; return; }
    setStock(j);
  }
  function setStock(j) {
    stock.items = j.items || []; stock.moves = j.moves || []; stock.token = j.menage_token || null; stock.email = j.alert_email || null; stock.loaded = true;
    renderStock(); renderHomeLow();
  }
  async function stockPost(body) {
    const { status, j } = await api('stock', { method: 'POST', body: JSON.stringify(body) });
    if (status === 200 && j && j.ok) { setStock(j); return true; }
    alert((j && j.message) || 'Erreur, réessayez.');
    return false;
  }
  const unitTxt = (x) => (x.unit ? esc(x.unit) : 'unité');

  function renderHomeLow() {
    const box = $('#homeLow'), list = $('#homeLowList'); if (!box || !list) return;
    const low = stock.items.filter((x) => x.low);
    box.hidden = !low.length;
    list.innerHTML = low.map((x) => '<div class="low-row"><span><b>' + esc(x.name) + '</b><em>' +
      (x.qty === 0 ? 'plus rien' : 'reste ' + x.qty + ' · ' + unitTxt(x)) + '</em></span><i class="' + (x.qty === 0 ? 'urg' : '') + '">' + (x.qty === 0 ? 'urgent' : 'bientôt') + '</i></div>').join('');
  }

  function renderStock() {
    const list = $('#stockList'); if (!list) return;
    if (!stock.items.length) {
      list.innerHTML = '<div class="up-empty">Aucun produit pour l’instant. Ajoutez votre premier produit juste en dessous.</div>';
      const d = $('#stockAdd'); if (d) d.open = true;
    } else {
      list.innerHTML = stock.items.map((x) => {
        if (stock.editing === x.id) {
          return '<form class="st-item st-edit" data-id="' + x.id + '">' +
            '<label>Produit<input name="name" value="' + esc(x.name) + '" maxlength="60" required></label>' +
            '<label>Unité<input name="unit" value="' + esc(x.unit) + '" maxlength="60"></label>' +
            '<div class="st-edit-row"><label>En stock<input name="qty" type="number" min="0" inputmode="numeric" value="' + x.qty + '"></label>' +
            '<label>Alerte à<input name="threshold" type="number" min="0" inputmode="numeric" value="' + x.threshold + '"></label></div>' +
            '<div class="st-edit-acts"><button type="submit" class="adm-btn">Enregistrer</button>' +
            '<button type="button" class="adm-ghost" data-st="cancel">Annuler</button>' +
            '<button type="button" class="st-del" data-st="del" data-id="' + x.id + '">Supprimer</button></div></form>';
        }
        return '<div class="st-item' + (x.low ? ' low' : '') + (x.qty === 0 ? ' empty' : '') + '">' +
          '<button type="button" class="st-main" data-st="edit" data-id="' + x.id + '"><b>' + esc(x.name) + '</b>' +
          '<span>' + unitTxt(x) + ' · alerte à ' + x.threshold + '</span>' +
          (x.low ? '<i>' + (x.qty === 0 ? 'à racheter vite' : 'à racheter') + '</i>' : '') + '</button>' +
          '<div class="st-qty"><button type="button" data-st="minus" data-id="' + x.id + '" aria-label="Retirer 1">−</button>' +
          '<b>' + x.qty + '</b>' +
          '<button type="button" data-st="plus" data-id="' + x.id + '" aria-label="Ajouter 1">+</button></div></div>';
      }).join('');
    }
    const sg = $('#stockSugg');
    if (sg) {
      const have = new Set(stock.items.map((x) => x.name.toLowerCase()));
      sg.innerHTML = STOCK_SUGG.filter((x) => !have.has(x[0].toLowerCase()))
        .map((x) => '<button type="button" data-sugg="' + esc(x[0]) + '" data-unit="' + esc(x[1]) + '">' + esc(x[0]) + '</button>').join('');
    }
    const acc = $('#stockAccess');
    if (acc) {
      const mail = stock.email ? 'Les alertes partent à <b>' + esc(stock.email) + '</b>.' : '<b>Attention :</b> aucune adresse mail d’alerte n’est configurée.';
      if (stock.token) {
        const link = location.origin + '/menage?k=' + stock.token;
        const sms = 'sms:&body=' + encodeURIComponent('Bonjour ! Voici le lien pour le stock du studio. Ouvrez-le dans Safari, puis Partager > Sur l’écran d’accueil : ' + link);
        acc.innerHTML = '<p>Envoyez-lui ce lien. Elle peut seulement dire ce qu’elle utilise : elle ne voit ni vos réservations ni vos prix.</p>' +
          '<input class="st-link" readonly value="' + esc(link) + '">' +
          '<div class="st-acc-acts"><button type="button" class="adm-btn" data-st="copy">Copier le lien</button>' +
          '<a class="adm-btn adm-btn-ghost" href="' + esc(sms) + '">Par SMS</a></div>' +
          '<div class="st-acc-more"><button type="button" class="adm-link-btn" data-st="rotate">Changer le lien</button>' +
          '<button type="button" class="adm-link-btn st-danger" data-st="revoke">Couper l’accès</button></div>' +
          '<p class="adm-hint">' + mail + '</p>';
      } else {
        acc.innerHTML = '<p>Créez un lien personnel pour votre femme de ménage. Elle l’ajoute sur son écran d’accueil et touche un produit à chaque fois qu’elle en utilise un.</p>' +
          '<button type="button" class="adm-btn" data-st="rotate">Créer son lien d’accès</button>' +
          '<p class="adm-hint">' + mail + '</p>';
      }
    }
    const mv = $('#stockMoves');
    if (mv) {
      mv.innerHTML = stock.moves.length ? stock.moves.map((m) => {
        const d = new Date(m.created_at);
        const when = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + 'h' + pad2(d.getMinutes());
        return '<div class="st-move"><span class="st-when">' + when + '</span><span class="st-what"><b>' + (m.delta > 0 ? '+' : '−') + Math.abs(m.delta) + '</b> ' + esc(m.item_name) +
          '<em>' + (m.who === 'menage' ? 'Ménage' : 'Vous') + ' · reste ' + m.qty_after + '</em></span></div>';
      }).join('') : '<div class="up-empty">Rien pour l’instant.</div>';
    }
  }

  document.addEventListener('click', async (e) => {
    const sg = e.target.closest('[data-sugg]');
    if (sg) { const f = $('#stockForm'); f.elements['name'].value = sg.dataset.sugg; f.elements['unit'].value = sg.dataset.unit; f.elements['qty'].focus(); return; }
    const b = e.target.closest('[data-st]'); if (!b || !b.closest('#t-stock')) return;
    const id = Number(b.dataset.id) || 0, act = b.dataset.st;
    if (act === 'edit') { stock.editing = id; renderStock(); return; }
    if (act === 'cancel') { stock.editing = null; renderStock(); return; }
    if (act === 'minus' || act === 'plus') { b.disabled = true; await stockPost({ action: 'adjust', id, delta: act === 'plus' ? 1 : -1 }); return; }
    if (act === 'del') {
      const it = stock.items.find((x) => x.id === id);
      if (!confirm('Supprimer « ' + (it ? it.name : 'ce produit') + ' » du stock ?')) return;
      stock.editing = null; await stockPost({ action: 'delete', id }); return;
    }
    if (act === 'copy') {
      const inp = $('.st-link'); copyText(inp.value, b); return;
    }
    if (act === 'rotate') {
      if (stock.token && !confirm('Créer un nouveau lien ? L’ancien ne marchera plus : il faudra lui renvoyer le nouveau.')) return;
      await stockPost({ action: 'token' }); return;
    }
    if (act === 'revoke') {
      if (!confirm('Couper l’accès de votre femme de ménage ? Son lien ne marchera plus.')) return;
      await stockPost({ action: 'revoke' }); return;
    }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (f.id === 'stockForm') {
      e.preventDefault();
      const ok = await stockPost({ action: 'create', name: f.elements['name'].value, unit: f.elements['unit'].value, qty: f.elements['qty'].value, threshold: f.elements['threshold'].value });
      if (ok) { f.reset(); f.elements['qty'].value = 0; f.elements['threshold'].value = 1; msg('#stockMsg', 'Ajouté ✓'); }
      return;
    }
    if (f.classList && f.classList.contains('st-edit')) {
      e.preventDefault();
      const id = Number(f.dataset.id);
      stock.editing = null;
      await stockPost({ action: 'update', id, name: f.elements['name'].value, unit: f.elements['unit'].value, qty: f.elements['qty'].value, threshold: f.elements['threshold'].value });
    }
  });

  // ---------- Accueil : prochaine arrivée, chiffres du mois, 7 jours ----------
  function stays() {
    if (!cal.data) return [];
    const list = [];
    (cal.data.bookings || []).forEach((b) => { if (b.from && b.to && b.status !== 'cancelled') list.push({ from: b.from, to: b.to, who: b.guest || 'Voyageur', src: 'site' }); });
    (cal.data.external || []).forEach((r) => { if (r.from && r.to) list.push({ from: r.from, to: r.to, who: 'Réservation Airbnb', src: 'airbnb' }); });
    return list.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

  function renderTopExtra(id) {
    const box = $('#topExtra'); if (!box) return;
    if (id !== 't-home') { box.innerHTML = ''; return; }
    if (!cal.data) { box.innerHTML = '<span class="tx-lab">Chargement…</span>'; return; }
    const t = today();
    const all = stays();
    const cur = all.find((s) => s.from <= t && s.to > t);
    const next = all.find((s) => s.from > t);
    let h = '';
    if (cur) {
      h += '<span class="tx-lab">En ce moment · départ ' + (daysBetween(t, cur.to) === 0 ? "aujourd'hui" : frShort(cur.to)) + '</span>' +
        '<strong class="tx-big">' + esc(cur.who) + '</strong>' +
        '<span class="tx-sub">' + daysBetween(cur.from, cur.to) + ' nuit' + (daysBetween(cur.from, cur.to) > 1 ? 's' : '') + ' · ' + (cur.src === 'site' ? 'site direct' : 'Airbnb') + ' · ménage le ' + frShort(cur.to) + '</span>';
    }
    if (next) {
      const d = daysBetween(t, next.from);
      const quand = d === 1 ? 'demain' : 'dans ' + d + ' jours';
      const n = daysBetween(next.from, next.to);
      h += (cur ? '<div class="tx-sep"></div>' : '') +
        '<span class="tx-lab">Prochaine arrivée · ' + quand + '</span>' +
        '<strong class="tx-big">' + frShort(next.from) + ' → ' + frShort(next.to) + '</strong>' +
        '<span class="tx-sub">' + n + ' nuit' + (n > 1 ? 's' : '') + ' · ' + (next.src === 'site' ? esc(next.who) + ' · site direct' : 'Airbnb') + '</span>';
    }
    if (!cur && !next) h = '<span class="tx-lab">Prochaine arrivée</span><strong class="tx-big">Aucune réservation à venir</strong>';
    box.innerHTML = h;
  }

  function renderHome() {
    if (!cal.data) return;
    const t = today();
    const now = new Date(t + 'T00:00:00Z');
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let occ = 0;
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + pad2(m + 1) + '-' + pad2(d);
      if (cal.booked.has(ds) || cal.external.has(ds)) occ++;
    }
    const kN = $('#kNights'); if (kN) kN.textContent = occ;
    const kNs = $('#kNightsSub'); if (kNs) kNs.textContent = 'sur ' + days + ' en ' + CAL_MONTHS[m];
    const kO = $('#kOcc'); if (kO) kO.textContent = Math.round((occ / days) * 100) + ' %';
    const kOs = $('#kOccSub'); if (kOs) kOs.textContent = CAL_MONTHS[m] + ' ' + y;
    const kS = $('#kSite');
    if (kS) {
      const key = y + '-' + pad2(m + 1);
      const bm = _lastRevenue && _lastRevenue.by_month && _lastRevenue.by_month[key];
      kS.textContent = Math.round((bm ? bm.total_cents || 0 : 0) / 100).toLocaleString('fr-FR') + ' €';
    }
    const w = $('#homeWeek');
    if (w) {
      let h = '';
      for (let i = 0; i < 7; i++) {
        const ds = ymd(new Date(now.getTime() + i * 86400000));
        const d = new Date(ds + 'T00:00:00Z');
        h += '<div class="h-day s-' + stateOf(ds) + (i === 0 ? ' today' : '') + '"><span>' + JOURS[d.getUTCDay()].slice(0, 3) + '</span><b>' + d.getUTCDate() + '</b></div>';
      }
      w.innerHTML = h;
    }
    renderUpcoming();
    if (document.body.dataset.curTab === 't-home') renderTopExtra('t-home');
  }

  function renderUpcoming() {
    const box = $('#upcomingList'); if (!box) return;
    const t = today();
    const list = stays().filter((s) => s.to > t).slice(0, 12);
    if (!list.length) { box.innerHTML = '<div class="up-empty">Aucun séjour à venir pour le moment.</div>'; return; }
    box.innerHTML = list.map((s) => {
      const d = new Date(s.from + 'T00:00:00Z');
      const n = daysBetween(s.from, s.to);
      const now = s.from <= t;
      return '<div class="up-item ' + s.src + '">' +
        '<span class="up-date"><em>' + MOIS[d.getUTCMonth()] + '</em><b>' + d.getUTCDate() + '</b></span>' +
        '<span class="up-body"><b>' + esc(s.who) + '</b>' +
        '<span>' + n + ' nuit' + (n > 1 ? 's' : '') + ' · départ ' + frShort(s.to) + (now ? ' · <strong>en cours</strong>' : '') + '</span>' +
        '<i>' + (s.src === 'site' ? 'Site direct' : 'Airbnb') + '</i></span></div>';
    }).join('');
  }

  var KIND_FR = { none: '—', late_checkout: 'Départ tardif', early_checkin: 'Arrivée anticipée', both: 'Départ tardif + Arrivée anticipée', weekly: 'Pack hebdo (cure)' };
  var EXTRA_PROMO_KIND_FR = { percent: 'Réduction %', pack_flex: 'Pack 2 pour 1' };

  // dates : le stockage utilise date_to exclusif ; l'UI manipule des nuits incluses.
  const addDay = (s, n) => { const d = new Date(Date.parse(s)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nightsOf = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

  var _lastBookings = [];
  var _lastRevenue = null;

  async function loadBookings() {
    const { j } = await api('bookings');
    const tb = $('#bookTable tbody'); tb.innerHTML = '';
    const rows = (j && j.bookings) || [];
    _lastBookings = rows;
    _lastRevenue = j && j.revenue;
    $('#bookEmpty').hidden = rows.length > 0;
    renderRevenue(_lastRevenue);
    if (cal.data) renderHome();
    const pdfBtn = $('#revPdfBtn');
    if (pdfBtn) pdfBtn.hidden = !(_lastRevenue && _lastRevenue.year_stats);
    rows.forEach((r) => {
      const pay = paymentLabel(r);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${isoToDmy(r.checkin) || r.checkin}</td><td>${isoToDmy(r.checkout) || r.checkout}</td><td>${r.nights}</td>` +
        `<td>${esc(r.guest_name)}${r.notes ? '<div class="adm-note">' + esc(r.notes) + '</div>' : ''}</td>` +
        `<td>${esc(r.email || '—')}${r.phone ? '<br>' + esc(r.phone) : ''}</td>` +
        `<td>${r.guests}${r.dog ? " + 🐕" : ""}</td><td>${euro(r.amount_total_cents)}</td>` +
        `<td><span class="adm-badge ${pay.cls}">${pay.label}</span></td>` +
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

  function paymentLabel(r) {
    const src = r.payment_source || (r.stripe_session_id || r.stripe_payment_method ? 'stripe' : 'virement');
    if (src === 'virement') return { label: 'Virement', cls: 'pending' };
    return { label: 'Stripe', cls: 'confirmed' };
  }

  function paymentSourceOf(r) {
    return r.payment_source || (r.stripe_session_id || r.stripe_payment_method ? 'stripe' : 'virement');
  }

  function renderRevenue(rev) {
    const box = $('#bookRevenue');
    const months = $('#revMonths');
    const split = $('#revSplit');
    if (!rev || !rev.year_stats) {
      if (box) box.hidden = true;
      if (months) months.hidden = true;
      if (split) split.hidden = true;
      return;
    }
    const y = rev.year_stats;
    const a = rev.all;
    box.hidden = false;
    if (split) split.hidden = false;
    $('#revYearLabel').textContent = rev.year;
    $('#revYearTotal').textContent = euro(y.total_cents);
    $('#revYearCount').textContent =
      (y.bookings_count || 0) + ' séjour' + ((y.bookings_count || 0) > 1 ? 's' : '') +
      ' · ' + (y.extras_count || 0) + ' extra' + ((y.extras_count || 0) > 1 ? 's' : '');
    $('#revBookings').textContent = euro(y.bookings_cents || 0);
    $('#revBookingsCount').textContent =
      (y.bookings_count || 0) + ' · ' + (y.nights || 0) + ' nuit' + ((y.nights || 0) > 1 ? 's' : '');
    $('#revExtras').textContent = euro(y.extras_cents || 0);
    $('#revExtrasCount').textContent = (y.extras_count || 0) + ' commande' + ((y.extras_count || 0) > 1 ? 's' : '');
    $('#revAllTotal').textContent = euro(a.total_cents);
    $('#revAllCount').textContent =
      (a.bookings_count || 0) + ' séjour' + ((a.bookings_count || 0) > 1 ? 's' : '') +
      ' · ' + (a.extras_count || 0) + ' extra' + ((a.extras_count || 0) > 1 ? 's' : '');
    $('#revStripe').textContent = euro(y.stripe_cents);
    $('#revVirement').textContent = euro(y.virement_cents);

    const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
    const parts = [];
    Object.keys(rev.by_month || {}).sort().forEach((key) => {
      const m = rev.by_month[key];
      if (!m.count) return;
      const mi = parseInt(key.slice(5), 10) - 1;
      parts.push('<div class="adm-rev-month"><b>' + MONTHS_FR[mi] + '</b><span>' + euro(m.total_cents) + '</span><em>' + m.count + '</em></div>');
    });
    if (parts.length) {
      months.hidden = false;
      months.innerHTML = '<div class="adm-rev-months-lab">Détail ' + rev.year + ' (séjours + extras)</div>' + parts.join('');
    } else {
      months.hidden = true;
      months.innerHTML = '';
    }
  }

  function exportRevenuePdf() {
    try {
      const rev = _lastRevenue;
      if (!rev || !rev.year_stats || !rev.all) { alert('Aucune donnée à exporter.'); return; }
      const y = rev.year_stats;
      const a = rev.all;
      const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      const confirmed = (_lastBookings || []).filter((r) => r && r.status === 'confirmed')
        .slice()
        .sort((x, z) => String(x.checkin || '').localeCompare(String(z.checkin || '')));
      const yearRows = confirmed.filter((r) => String(r.checkin || '').startsWith(String(rev.year)));
      // CA : uniquement extras confirmés payés (jamais pending / cancelled / offerts).
      const extrasAll = ((rev.extras || []).filter((e) => e && e.status === 'confirmed' && (e.amount_cents || 0) > 0)).slice();
      const extrasYear = extrasAll.filter((e) => {
        const d = (e.service_date && String(e.service_date).slice(0, 10)) || String(e.created_at || '').slice(0, 10);
        return d.startsWith(String(rev.year));
      });
      const monthRows = Object.keys(rev.by_month || {}).sort().map((key) => {
        const m = rev.by_month[key];
        if (!m || !m.count) return '';
        const mi = parseInt(key.slice(5), 10) - 1;
        if (mi < 0 || mi > 11) return '';
        return '<tr><td>' + MONTHS_FR[mi] + '</td><td class="num">' + euro(m.bookings_cents || 0) + '</td><td class="num">' + euro(m.extras_cents || 0) + '</td><td class="num">' + euro(m.total_cents || 0) + '</td></tr>';
      }).join('');

      function bookRows(list) {
        return list.map((r) => {
          const pay = paymentSourceOf(r) === 'virement' ? 'Virement' : 'Stripe';
          return '<tr>' +
            '<td>' + esc(isoToDmy(r.checkin) || r.checkin) + '</td>' +
            '<td>' + esc(isoToDmy(r.checkout) || r.checkout) + '</td>' +
            '<td class="num">' + (r.nights || 0) + '</td>' +
            '<td>' + esc(r.guest_name) + (r.notes ? '<div class="note">' + esc(r.notes) + '</div>' : '') + '</td>' +
            '<td>' + pay + '</td>' +
            '<td class="num">' + euro(r.amount_total_cents) + '</td>' +
            '</tr>';
        }).join('');
      }
      function extraRows(list) {
        return list.map((e) => {
          const d = (e.service_date && String(e.service_date).slice(0, 10)) || String(e.created_at || '').slice(0, 10);
          return '<tr>' +
            '<td>' + esc(isoToDmy(d) || d) + '</td>' +
            '<td>' + esc(e.title || 'Extra') + '</td>' +
            '<td>' + esc(e.guest_name || '—') + '</td>' +
            '<td>Stripe</td>' +
            '<td class="num">' + euro(e.amount_cents) + '</td>' +
            '</tr>';
        }).join('');
      }

      const generated = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
      const showHistory = confirmed.length !== yearRows.length || extrasAll.length !== extrasYear.length;
      const historyBlock = showHistory
        ? ('<h2>Historique complet (toutes années)</h2>' +
          '<h2 style="font-size:13px;margin-top:12px">Séjours</h2>' +
          '<table><thead><tr><th>Arrivée</th><th>Départ</th><th class="num">Nuits</th><th>Voyageur</th><th>Paiement</th><th class="num">Montant</th></tr></thead>' +
          '<tbody>' + bookRows(confirmed) + '</tbody></table>' +
          '<h2 style="font-size:13px;margin-top:12px">Extras</h2>' +
          '<table><thead><tr><th>Date</th><th>Extra</th><th>Client</th><th>Paiement</th><th class="num">Montant</th></tr></thead>' +
          '<tbody>' + (extraRows(extrasAll) || '<tr><td colspan="5">Aucun extra.</td></tr>') + '</tbody></table>')
        : '';

      const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
        '<title>CA direct ' + esc(String(rev.year)) + ' — La Bonne Aventure</title>' +
        '<style>' +
        '@page{margin:16mm}' +
        '*{box-sizing:border-box}' +
        'body{font-family:Georgia,\'Times New Roman\',serif;color:#1f2838;margin:0;padding:24px;background:#fff}' +
        'h1{font-size:22px;margin:0 0 4px;color:#0f2a4a}' +
        'h2{font-size:15px;margin:22px 0 10px;color:#0f2a4a;border-bottom:1px solid #E6E1D4;padding-bottom:6px}' +
        '.sub{font-family:system-ui,sans-serif;font-size:12px;color:#5f6675;margin:0 0 18px}' +
        '.kicker{font-family:system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#a9760f;margin:0 0 6px}' +
        '.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 8px}' +
        '.card{border:1px solid #E6E1D4;border-radius:10px;padding:12px 14px}' +
        '.card .lab{font-family:system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5f6675}' +
        '.card .val{font-size:20px;margin-top:4px;color:#0f2a4a}' +
        '.card .hint{font-family:system-ui,sans-serif;font-size:11px;color:#5f6675;margin-top:2px}' +
        'table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12px}' +
        'th,td{padding:7px 8px;border-bottom:1px solid #EDE6D6;text-align:left;vertical-align:top}' +
        'th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5f6675;font-weight:600}' +
        'td.num,th.num{text-align:right;white-space:nowrap}' +
        '.note{font-size:10.5px;color:#5f6675;margin-top:2px}' +
        '.foot{margin-top:24px;font-family:system-ui,sans-serif;font-size:11px;color:#5f6675;line-height:1.45}' +
        '.noprint{margin:0 0 16px}' +
        '.noprint button{font-family:system-ui,sans-serif;font-size:13px;font-weight:600;padding:10px 16px;border-radius:999px;border:0;background:#0f2a4a;color:#fff;cursor:pointer}' +
        '@media print{.noprint{display:none!important} body{padding:0}}' +
        '</style></head><body>' +
        '<div class="noprint"><button type="button" onclick="window.print()">Enregistrer en PDF / Imprimer</button></div>' +
        '<p class="kicker">La Bonne Aventure · Aix-les-Bains</p>' +
        '<h1>Chiffre d\'affaires direct ' + esc(String(rev.year)) + '</h1>' +
        '<p class="sub">Séjours (Stripe + virement) + extras payés · hors Airbnb · Généré le ' + esc(generated) + '</p>' +
        '<div class="cards">' +
        '<div class="card"><div class="lab">CA ' + esc(String(rev.year)) + '</div><div class="val">' + euro(y.total_cents) + '</div><div class="hint">' + (y.bookings_count || 0) + ' séjour' + ((y.bookings_count || 0) > 1 ? 's' : '') + ' · ' + (y.extras_count || 0) + ' extra' + ((y.extras_count || 0) > 1 ? 's' : '') + '</div></div>' +
        '<div class="card"><div class="lab">Séjours</div><div class="val">' + euro(y.bookings_cents || 0) + '</div><div class="hint">' + (y.nights || 0) + ' nuit' + ((y.nights || 0) > 1 ? 's' : '') + '</div></div>' +
        '<div class="card"><div class="lab">Extras</div><div class="val">' + euro(y.extras_cents || 0) + '</div><div class="hint">' + (y.extras_count || 0) + ' commande' + ((y.extras_count || 0) > 1 ? 's' : '') + '</div></div>' +
        '<div class="card"><div class="lab">Total depuis le début</div><div class="val">' + euro(a.total_cents) + '</div><div class="hint">' + (a.bookings_count || 0) + ' séjour' + ((a.bookings_count || 0) > 1 ? 's' : '') + ' · ' + (a.extras_count || 0) + ' extra' + ((a.extras_count || 0) > 1 ? 's' : '') + '</div></div>' +
        '<div class="card"><div class="lab">Dont Stripe</div><div class="val">' + euro(y.stripe_cents || 0) + '</div></div>' +
        '<div class="card"><div class="lab">Dont virement</div><div class="val">' + euro(y.virement_cents || 0) + '</div></div>' +
        '</div>' +
        '<h2>Détail mensuel ' + esc(String(rev.year)) + '</h2>' +
        '<table><thead><tr><th>Mois</th><th class="num">Séjours</th><th class="num">Extras</th><th class="num">Total</th></tr></thead>' +
        '<tbody>' + (monthRows || '<tr><td colspan="4">Aucun revenu cette année.</td></tr>') + '</tbody></table>' +
        '<h2>Séjours confirmés ' + esc(String(rev.year)) + '</h2>' +
        '<table><thead><tr><th>Arrivée</th><th>Départ</th><th class="num">Nuits</th><th>Voyageur</th><th>Paiement</th><th class="num">Montant</th></tr></thead>' +
        '<tbody>' + (bookRows(yearRows) || '<tr><td colspan="6">Aucun séjour.</td></tr>') + '</tbody></table>' +
        '<h2>Extras confirmés ' + esc(String(rev.year)) + '</h2>' +
        '<table><thead><tr><th>Date</th><th>Extra</th><th>Client</th><th>Paiement</th><th class="num">Montant</th></tr></thead>' +
        '<tbody>' + (extraRows(extrasYear) || '<tr><td colspan="5">Aucun extra.</td></tr>') + '</tbody></table>' +
        historyBlock +
        '<p class="foot">Document généré depuis l\'espace hôte La Bonne Aventure.<br>' +
        'Canal « direct » = séjours (site Stripe + virements) + extras payés en ligne. Les séjours Airbnb ne sont pas inclus. Les extras annulés ou en attente sont exclus.</p>' +
        '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250);});<\/script>' +
        '</body></html>';

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) {
        URL.revokeObjectURL(url);
        alert('Autorisez les pop-ups pour exporter le PDF.');
        return;
      }
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (err) {
      console.error('exportRevenuePdf', err);
      alert('Export PDF impossible. Rechargez la page et réessayez.');
    }
  }

  const revPdfBtn = $('#revPdfBtn');
  if (revPdfBtn) revPdfBtn.addEventListener('click', exportRevenuePdf);

  const directForm = $('#directBookForm');
  if (directForm) {
    directForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = $('#directBookMsg');
      msg.textContent = '';
      const checkin = dmyToIso(f.checkin.value);
      const checkout = dmyToIso(f.checkout.value);
      if (!checkin || !checkout) {
        msg.textContent = 'Dates invalides (jj/mm/aaaa).';
        return;
      }
      const payload = {
        checkin,
        checkout,
        guest_name: f.guest_name.value.trim(),
        email: f.email.value.trim(),
        amount_eur: Number(f.amount_eur.value),
        guests: Number(f.guests.value) || 1,
        notes: f.notes.value.trim(),
        payment_source: 'virement',
      };
      const { status, j } = await api('bookings', { method: 'POST', body: JSON.stringify(payload) });
      if (status === 200 && j && j.ok) {
        msg.textContent = '✓ Réservation enregistrée.';
        f.reset();
        f.guests.value = '1';
        loadBookings();
        loadCalendar();
      } else {
        msg.textContent = (j && j.message) || 'Erreur.';
      }
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

  async function loadStripeStatus() {
    const el = $('#stripeStatusMsg');
    if (!el) return;
    try {
      const { status, j } = await api('stripe-status');
      if (!j) { el.textContent = 'Impossible de vérifier Stripe.'; return; }
      const mode = j.key_mode === 'live' ? 'Production' : (j.key_mode === 'test' ? 'Test' : j.key_mode || '?');
      const wh = j.webhook ? 'webhook OK' : 'webhook manquant';
      if (j.ok) {
        el.textContent = `✓ ${j.message} Compte : ${j.business_name || j.account_id || '—'} · mode ${mode} · ${wh}.`;
        el.style.color = j.key_mode === 'live' ? '#1a7a3a' : '#9a6b00';
      } else {
        el.textContent = `✗ ${j.message || 'Stripe KO'} · mode ${mode} · ${wh}.`;
        el.style.color = '#B3261E';
      }
    } catch (e) {
      el.textContent = 'Impossible de vérifier Stripe.';
      el.style.color = '#B3261E';
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
      const val = [isoToDmy(p.valid_from) || p.valid_from || '…', isoToDmy(p.valid_to) || p.valid_to || '…'].join(' → ');
      const uses = p.max_uses > 0 ? `${p.used_count}/${p.max_uses}` : `${p.used_count}/∞`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(p.code)}</b>${p.active ? '' : ' <span class="adm-badge cancelled">off</span>'}</td>` +
        `<td>${red}</td><td>${p.min_nights || '—'}</td><td>${val}</td><td>${uses}</td>` +
        `<td style="white-space:nowrap"><button class="adm-ghost adm-edit" style="padding:5px 10px">Modifier</button> <button class="adm-del" data-id="${p.id}" title="Supprimer">✕</button></td>`;
      tr.querySelector('.adm-edit').addEventListener('click', () => fillPromoForm(p));
      tb.appendChild(tr);
    });
    tb.querySelectorAll('.adm-del').forEach((b) => b.addEventListener('click', async () => {
      await api('promos?id=' + b.dataset.id, { method: 'DELETE' }); loadPromos();
    }));
  }

  // ---------- Tarifs événements ----------
  let eventEditId = null;
  async function loadEvents() {
    const { j } = await api('event-rates');
    const tb = $('#eventTable tbody'); if (!tb) return; tb.innerHTML = '';
    const rows = (j && j.rates) || [];
    $('#eventEmpty').hidden = rows.length > 0;
    rows.forEach((r) => {
      const last = new Date(Date.parse(r.date_to) - 86400000).toISOString().slice(0, 10);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(r.label)}</b></td><td>${isoToDmy(r.date_from)} → ${isoToDmy(last)} <span style="color:#8a8f99">(départ ${isoToDmy(r.date_to)})</span></td>` +
        `<td>${euro(r.nightly_cents)}</td><td>${r.min_nights || '—'}</td>` +
        `<td style="white-space:nowrap"><button class="adm-ghost adm-edit" style="padding:5px 10px">Modifier</button> <button class="adm-del" title="Supprimer">✕</button></td>`;
      tr.querySelector('.adm-edit').addEventListener('click', () => {
        const f = $('#eventForm'); eventEditId = r.id;
        f.label.value = r.label; f.valid_from.value = isoToDmy(r.date_from); f.valid_to.value = isoToDmy(r.date_to);
        f.price.value = r.nightly_cents / 100; f.min_nights.value = r.min_nights || 0;
        f.querySelector('button[type="submit"]').textContent = 'Enregistrer';
        f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      tr.querySelector('.adm-del').addEventListener('click', async () => { await api('event-rates?id=' + r.id, { method: 'DELETE' }); loadEvents(); });
      tb.appendChild(tr);
    });
  }
  if ($('#eventForm')) {
    $('#eventForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = { label: f.label.value, date_from: dmyToIso(f.valid_from.value), date_to: dmyToIso(f.valid_to.value),
        nightly_cents: cents(f.price.value), min_nights: +f.min_nights.value || 0 };
      const { status, j } = eventEditId
        ? await api('event-rates?id=' + eventEditId, { method: 'PUT', body: JSON.stringify(body) })
        : await api('event-rates', { method: 'POST', body: JSON.stringify(body) });
      if (status === 200) { f.reset(); msg('#eventMsg', eventEditId ? 'Modifié ✓' : 'Ajouté ✓'); eventEditId = null; f.querySelector('button[type="submit"]').textContent = 'Ajouter'; loadEvents(); }
      else msg('#eventMsg', (j && j.message) || 'Erreur', true);
    });
  }

  // Modifier un code : remplit le formulaire, le bouton devient « Enregistrer ».
  let promoEditId = null;
  function fillPromoForm(p) {
    const f = $('#promoForm');
    promoEditId = p.id;
    f.code.value = p.code;
    f.kind.value = p.kind;
    f.value.value = p.kind === 'fixed' ? (p.value / 100).toString() : p.value;
    f.min_nights.value = p.min_nights || 0;
    f.valid_from.value = isoToDmy(p.valid_from) || '';
    f.valid_to.value = isoToDmy(p.valid_to) || '';
    f.max_uses.value = p.max_uses || 0;
    f.querySelector('button[type="submit"]').textContent = 'Enregistrer';
    let c = $('#promoCancel');
    if (!c) {
      c = document.createElement('button'); c.type = 'button'; c.id = 'promoCancel'; c.className = 'adm-ghost'; c.textContent = 'Annuler';
      c.addEventListener('click', resetPromoForm);
      f.querySelector('button[type="submit"]').after(c);
    }
    msg('#promoMsg', 'Modification de ' + p.code);
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function resetPromoForm() {
    const f = $('#promoForm'); f.reset(); promoEditId = null;
    f.querySelector('button[type="submit"]').textContent = 'Ajouter';
    const c = $('#promoCancel'); if (c) c.remove();
  }

  $('#promoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const kind = f.kind.value;
    const value = kind === 'fixed' ? cents(f.value.value) : Math.round(parseFloat(f.value.value) || 0);
    const vf = f.valid_from.value.trim() ? dmyToIso(f.valid_from.value) : null;
    const vt = f.valid_to.value.trim() ? dmyToIso(f.valid_to.value) : null;
    if ((f.valid_from.value.trim() && !vf) || (f.valid_to.value.trim() && !vt)) {
      msg('#promoMsg', 'Dates invalides (jj/mm/aaaa)', true);
      return;
    }
    const body = {
      code: f.code.value, kind, value,
      min_nights: +f.min_nights.value || 0,
      valid_from: vf, valid_to: vt,
      max_uses: +f.max_uses.value || 0,
    };
    const editing = promoEditId;
    const { status, j } = editing
      ? await api('promos?id=' + editing, { method: 'PUT', body: JSON.stringify(body) })
      : await api('promos', { method: 'POST', body: JSON.stringify(body) });
    if (status === 200) { resetPromoForm(); msg('#promoMsg', editing ? 'Modifié ✓' : 'Ajouté ✓'); loadPromos(); }
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
        `<td><b>${isoToDmy(r.checkout) || r.checkout}</b></td><td>${isoToDmy(r.checkin) || r.checkin}</td><td>${r.nights}</td>` +
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

  const prestaMonth = $('#prestaMonth');
  if (prestaMonth) prestaMonth.addEventListener('change', (e) => { presta.month = e.target.value; renderPrestations(); });
  const prestaRateForm = $('#prestaRateForm');
  if (prestaRateForm) prestaRateForm.addEventListener('submit', async (e) => {
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

    allOrders = (j && j.orders) || [];
    renderOrders();
  }

  // Commandes d'extras : filtre par statut, tri par statut puis date ; les commandes en attente
  // de paiement dont le jour concerné est passé ne s'affichent plus.
  let allOrders = [];
  const ORDER_RANK = { requested: 0, approved: 1, pending: 2, confirmed: 3, cancelled: 4 };
  function renderOrders() {
    const ob = $('#orderTable tbody'); ob.innerHTML = '';
    const today = new Date().toISOString().slice(0, 10);
    const filter = ($('#orderFilter') && $('#orderFilter').value) || 'all';
    const orders = allOrders
      .filter((o) => !((o.status === 'pending' || o.status === 'approved') && o.service_date && o.service_date < today))
      .filter((o) => filter === 'all' || o.status === filter)
      .sort((x, y) => ((ORDER_RANK[x.status] ?? 9) - (ORDER_RANK[y.status] ?? 9)) || String(y.created_at).localeCompare(String(x.created_at)));
    $('#orderEmpty').hidden = orders.length > 0;
    orders.forEach((o) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${isoToDmy(o.created_at) || '—'}</td><td>${esc(o.title || '')}</td>` +
        `<td>${isoToDmy(o.service_date) || o.service_date || '—'}</td><td>${esc(o.guest_name || '')}<br>${esc(o.email || '')}</td>` +
        `<td>${euro(o.amount_cents)}</td><td><span class="adm-badge ${orderBadgeCls(o.status)}">${orderStatusFr(o.status)}</span></td>`;
      ob.appendChild(tr);
    });
  }
  if ($('#orderFilter')) $('#orderFilter').addEventListener('change', renderOrders);

  function fillExtraForm(x) {
    const f = $('#extraForm');
    f.id.value = x.id; f.title.value = x.title; f.price.value = (x.price_cents / 100).toFixed(2);
    f.kind.value = ['none','late_checkout','early_checkin','both','weekly'].includes(x.kind) ? x.kind : 'none'; f.position.value = x.position || 0;
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
  if (kindSel) {
    kindSel.addEventListener('change', syncExtraPromoFields);
    syncExtraPromoFields();
  }

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
        `<td>${esc(isoToDmy(p.valid_from) || p.valid_from)} → ${esc(isoToDmy(p.valid_to) || p.valid_to)}</td>` +
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
    f.valid_from.value = isoToDmy(p.valid_from) || p.valid_from || '';
    f.valid_to.value = isoToDmy(p.valid_to) || p.valid_to || '';
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
  const extraPromoCancel = $('#extraPromoCancel');
  if (extraPromoCancel) extraPromoCancel.addEventListener('click', resetExtraPromoForm);

  const extraPromoForm = $('#extraPromoForm');
  if (extraPromoForm) extraPromoForm.addEventListener('submit', async (e) => {
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
      valid_from: dmyToIso(f.valid_from.value) || f.valid_from.value,
      valid_to: dmyToIso(f.valid_to.value) || f.valid_to.value,
      show_popup: f.show_popup.checked,
      active: f.active.checked,
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.valid_from) || !/^\d{4}-\d{2}-\d{2}$/.test(body.valid_to)) {
      msg('#extraPromoMsg', 'Dates invalides (jj/mm/aaaa)', true);
      return;
    }
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
  var cal = { data: null, view: null, rangeStart: null, rangeEnd: null, loading: false };

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

  function rangeBounds() {
    if (!cal.rangeStart) return null;
    const a = cal.rangeStart;
    const b = cal.rangeEnd || cal.rangeStart;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }

  function nightsInRange(from, to) {
    return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  }

  function eachNight(from, to, fn) {
    let d = parseD(from); const end = parseD(to); let g = 0;
    while (d <= end && g < 1200) { fn(ymd(d)); d = new Date(d.getTime() + 86400000); g++; }
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
    renderHome();
  }

  function stateOf(ds) {
    if (cal.booked.has(ds)) return 'book';
    if (cal.external.has(ds)) return 'ext';
    if (cal.blocked.has(ds)) return 'block';
    return 'free';
  }

  function clearCalSelection() {
    cal.rangeStart = null;
    cal.rangeEnd = null;
  }

  function renderCal() {
    const host = $('#admCal'); if (!host || !cal.data) return;
    const y = cal.view.getUTCFullYear(), m = cal.view.getUTCMonth();
    const cur = today().slice(0, 7);
    const atMin = (y + '-' + pad2(m + 1)) <= cur;
    const bounds = rangeBounds();

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
      if (bounds && ds >= bounds.from && ds <= bounds.to) {
        cls += ' in-range';
        if (ds === bounds.from) cls += ' sel-start';
        if (ds === bounds.to) cls += ' sel-end';
        if (bounds.from === bounds.to) cls += ' sel';
      }
      h += '<button class="' + cls + '" data-cday="' + ds + '"' + (past ? ' disabled' : '') + '><span class="adm-cell-d">' + day + '</span></button>';
    }
    h += '</div>';
    h += '<p class="adm-cal-hint">Astuce : 1<sup>re</sup> clic = début, 2<sup>e</sup> clic = fin de la plage.</p>';
    h += '<div id="admCalEditor" class="adm-cal-editor" hidden></div>';
    host.innerHTML = h;

    host.querySelectorAll('[data-cnav]').forEach((b) => b.addEventListener('click', () => {
      cal.view = new Date(Date.UTC(y, m + (+b.dataset.cnav), 1));
      renderCal();
    }));
    host.querySelectorAll('[data-cday]').forEach((b) => b.addEventListener('click', () => selectDay(b.dataset.cday)));
    if (cal.rangeStart) renderEditor();
  }

  function selectDay(ds) {
    if (!cal.rangeStart || cal.rangeEnd) {
      // Nouveau début (ou reprise après une plage complète)
      cal.rangeStart = ds;
      cal.rangeEnd = null;
    } else if (cal.rangeStart === ds) {
      // Re-clic sur le début → annuler
      clearCalSelection();
    } else {
      cal.rangeEnd = ds;
    }
    renderCal();
  }

  function fmtHuman(ds) {
    const d = parseD(ds);
    return d.getUTCDate() + ' ' + CAL_MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function renderEditor() {
    const ed = $('#admCalEditor'); if (!ed) return;
    const bounds = rangeBounds();
    if (!bounds) { ed.hidden = true; return; }
    ed.hidden = false;
    const multi = bounds.from !== bounds.to;
    const n = nightsInRange(bounds.from, bounds.to);

    let free = 0, blocked = 0, busy = 0;
    eachNight(bounds.from, bounds.to, (ds) => {
      const st = stateOf(ds);
      if (st === 'free') free++;
      else if (st === 'block') blocked++;
      else busy++;
    });

    const title = multi
      ? (fmtHuman(bounds.from) + ' → ' + fmtHuman(bounds.to))
      : fmtHuman(bounds.from);
    const badge = multi
      ? (n + ' nuit' + (n > 1 ? 's' : ''))
      : ({ book: 'Réservé (direct)', ext: 'Airbnb', block: 'Bloqué', free: 'Libre' }[stateOf(bounds.from)]);

    let h = '<div class="adm-ed-head"><b>' + title + '</b> <span class="adm-badge pending">' + badge + '</span>'
      + '<button class="adm-ed-x" title="Fermer">✕</button></div>';

    if (!multi) {
      const st = stateOf(bounds.from);
      if (st === 'book') {
        const b = cal.bookByNight[bounds.from];
        h += '<p class="adm-hint">Réservation directe' + (b && b.guest ? ' — <b>' + esc(b.guest) + '</b>' : '') + (b && b.status === 'pending' ? ' (paiement en attente)' : '') + '. Gérez-la depuis l\'onglet Réservations.</p>';
      } else if (st === 'ext') {
        h += '<p class="adm-hint">Date importée depuis Airbnb (synchro iCal). Non modifiable ici — elle se libère automatiquement quand Airbnb la libère.</p>';
      } else {
        h += '<div class="adm-ed-row">';
        if (st === 'block') h += '<button class="adm-btn" data-act="unblock">Libérer cette date</button>';
        else h += '<button class="adm-ghost" data-act="block">Bloquer cette date</button>';
        h += '</div>';
      }
    } else {
      const bits = [];
      if (free) bits.push(free + ' libre' + (free > 1 ? 's' : ''));
      if (blocked) bits.push(blocked + ' déjà bloquée' + (blocked > 1 ? 's' : ''));
      if (busy) bits.push(busy + ' réservée' + (busy > 1 ? 's' : '') + ' (inchangée' + (busy > 1 ? 's' : '') + ')');
      h += '<p class="adm-hint">' + bits.join(' · ') + '.</p>';
      h += '<div class="adm-ed-row">';
      if (free) h += '<button class="adm-ghost" data-act="block">Bloquer ' + free + ' nuit' + (free > 1 ? 's' : '') + '</button>';
      if (blocked) h += '<button class="adm-btn" data-act="unblock">Libérer ' + blocked + ' nuit' + (blocked > 1 ? 's' : '') + '</button>';
      if (!free && !blocked) h += '<p class="adm-hint">Aucune nuit libre ou bloquée manuellement dans cette plage.</p>';
      h += '</div>';
    }
    ed.innerHTML = h;

    ed.querySelector('.adm-ed-x').addEventListener('click', () => { clearCalSelection(); renderCal(); });
    ed.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => calAction(btn.dataset.act, bounds)));
  }

  async function calAction(action, bounds) {
    // Pour un blocage de plage : une seule plage DB (même si des nuits réservées sont
    // incluses — stateOf priorise résa/Airbnb). Pour libérer : uniquement les nuits
    // actuellement bloquées manuellement.
    let from = bounds.from;
    let to = bounds.to;
    if (action === 'unblock' && from !== to) {
      // Trouver min/max des nuits bloquées dans la sélection
      let first = null, last = null;
      eachNight(from, to, (ds) => {
        if (stateOf(ds) === 'block') {
          if (!first) first = ds;
          last = ds;
        }
      });
      if (!first) return;
      from = first; to = last;
    }
    const { status, j } = await api('calendar', {
      method: 'POST',
      body: JSON.stringify({ action, date_from: from, date_to: to }),
    });
    if (status !== 200 || !(j && j.ok)) {
      alert((j && j.message) || 'Action impossible.');
      return;
    }
    clearCalSelection();
    await loadCalendar();
  }

  // ---------- utils ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function statusFr(s) { return { confirmed: 'Confirmée', pending: 'En attente', cancelled: 'Annulée', requested: 'À valider', approved: 'Validé' }[s] || s; }
  function orderStatusFr(s) {
    return {
      confirmed: 'Payé',
      pending: 'En attente paiement',
      cancelled: 'Annulé',
      requested: 'À valider',
      approved: 'Validé — paiement',
    }[s] || s;
  }
  function orderBadgeCls(s) {
    if (s === 'confirmed') return 'confirmed';
    if (s === 'cancelled') return 'cancelled';
    if (s === 'requested') return 'pending';
    return 'pending';
  }
  function msg(sel, text, isErr) { const el = $(sel); el.textContent = text; el.classList.toggle('err', !!isErr); setTimeout(() => { el.textContent = ''; }, 3500); }

  tryAuto();
})();

/* ---------- Sélecteur de période (codes promo) : calendrier, 1er clic = début, 2e clic = fin ---------- */
(function () {
  'use strict';
  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);
  const toDmy = (s) => (s ? s.split('-').reverse().join('/') : '');
  const fromDmy = (s) => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]) : ''; };

  function attach(form) {
    const a = form.valid_from, b = form.valid_to;
    if (!a || !b || form.dataset.rpBound) return;
    form.dataset.rpBound = '1';
    const pop = document.createElement('div');
    pop.className = 'rp-pop'; pop.hidden = true;
    document.body.appendChild(pop);
    let start = '', end = '', hover = '', view = new Date();

    function render() {
      const months = [0, 1].map((k) => new Date(view.getFullYear(), view.getMonth() + k, 1));
      let h = '<div class="rp-head"><button type="button" class="rp-nav" data-n="-1">‹</button><span>' +
        (start && !end ? 'Choisissez la date de départ' : 'Choisissez la 1<sup>re</sup> nuit') +
        '</span><button type="button" class="rp-nav" data-n="1">›</button></div><div class="rp-months">';
      months.forEach((m) => {
        const y = m.getFullYear(), mo = m.getMonth(), first = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
        h += '<div class="rp-month"><div class="rp-title">' + MONTHS[mo] + ' ' + y + '</div><div class="rp-dow"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="rp-grid">';
        for (let i = 0; i < first; i++) h += '<span></span>';
        for (let d = 1; d <= days; d++) {
          const s = iso(y, mo, d), e2 = end || (start && hover > start ? hover : '');
          let c = 'rp-day';
          if (s === start) c += ' rp-start';
          if (e2 && s === e2) c += ' rp-end';
          if (start && e2 && s > start && s < e2) c += ' rp-in';
          h += '<button type="button" class="' + c + '" data-d="' + s + '">' + d + '</button>';
        }
        h += '</div></div>';
      });
      h += '</div><div class="rp-foot"><span class="rp-sum">' + (start ? toDmy(start) + ' → ' + (end ? toDmy(end) : '…') : '') +
        '</span><button type="button" class="rp-clear">Effacer</button><button type="button" class="rp-ok">OK</button></div>';
      pop.innerHTML = h;
    }
    function place() {
      const r = a.getBoundingClientRect();
      pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
      pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + 'px';
    }
    function open() {
      start = fromDmy(a.value); end = fromDmy(b.value); hover = '';
      const base = start ? new Date(start + 'T00:00:00') : new Date();
      view = new Date(base.getFullYear(), base.getMonth(), 1);
      render(); pop.hidden = false; place();
    }
    function close() { pop.hidden = true; }
    function commit() { a.value = toDmy(start); b.value = toDmy(end); close(); }

    [a, b].forEach((inp) => { inp.readOnly = true; inp.style.cursor = 'pointer'; inp.addEventListener('click', open); inp.addEventListener('focus', open); });
    pop.addEventListener('mouseover', (e) => { const d = e.target.dataset && e.target.dataset.d; if (d && start && !end && d !== hover) { hover = d; render(); } });
    pop.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.n) { view = new Date(view.getFullYear(), view.getMonth() + Number(t.dataset.n), 1); render(); return; }
      if (t.classList.contains('rp-clear')) { start = end = ''; a.value = b.value = ''; render(); return; }
      if (t.classList.contains('rp-ok')) { commit(); return; }
      const d = t.dataset.d; if (!d) return;
      if (!start || end || d < start) { start = d; end = ''; render(); }
      else if (d === start) { end = d; commit(); }
      else { end = d; commit(); }
    });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== a && e.target !== b) close(); });
    window.addEventListener('resize', () => { if (!pop.hidden) place(); });
  }
  function init() { ['promoForm', 'eventForm'].forEach((id) => { const f = document.getElementById(id); if (f) attach(f); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
