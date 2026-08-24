/* La Bonne Aventure — page extras : liste dynamique + paiement Stripe (vanilla JS) */
(function () {
  'use strict';
  var MOUNT = document.getElementById('extras-list');
  if (!MOUNT) return;

  var CUR = 'eur';
  var LIVE_PROMOS = [];
  function euros(c, cur) { try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'eur' }).format((c || 0) / 100); } catch (e) { return ((c || 0) / 100).toFixed(2) + ' €'; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  var FROND = '<div class="frond"><svg viewBox="0 0 120 200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M60 198 C60 150 58 95 64 8"/><path d="M61 165 C40 158 28 150 20 132"/><path d="M62 150 C84 144 96 136 104 118"/><path d="M60 132 C40 126 30 118 24 100"/><path d="M62 116 C82 110 92 102 98 86"/></svg></div>';
  function bag() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6h15l-1.5 8.5H7.7L6 3H3M8 20a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"/></svg>'; }
  function card() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>'; }
  function lock() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>'; }
  function check() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>'; }

  fetch('/api/extras')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      CUR = d.currency || 'eur';
      LIVE_PROMOS = d.promotions || [];
      render(d.extras || []);
      maybeShowPromoPopup(LIVE_PROMOS);
      var p = new URLSearchParams(location.search);
      if (p.get('extra') === 'confirmee' && p.get('session_id')) {
        fetch('/api/extras-confirm?session_id=' + encodeURIComponent(p.get('session_id')))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) thankYou(j); });
      }
    })
    .catch(function () { MOUNT.innerHTML = '<div class="book-fallback">Les extras sont momentanément indisponibles.</div>'; });

  function isFeatured(x) {
    return x && (x.kind === 'flex_pack' || x.kind === 'both');
  }
  function isCure(x) {
    return x && x.kind === 'weekly';
  }
  function priceUnit(x) {
    return isCure(x) ? '/ sem.' : '/ séjour';
  }

  function featuredFirst(items) {
    function rank(x) {
      if (isFeatured(x)) return 2;
      if (isCure(x)) return 1;
      return 0;
    }
    return (items || []).slice().sort(function (a, b) { return rank(b) - rank(a); });
  }

  var SECTIONS = [
    {
      id: 'flex',
      title: 'Flexibilité des horaires',
      lead: 'Arrivez plus tôt ou partez plus tard, sans stress.',
      match: function (x) {
        return x.kind === 'flex_pack' || x.kind === 'both' || x.kind === 'late_checkout' || x.kind === 'early_checkin';
      }
    },
    {
      id: 'stay',
      title: 'Long séjour & cure',
      lead: 'Confort hebdomadaire pour les cures et séjours prolongés.',
      match: function (x) { return x.kind === 'weekly'; }
    },
    {
      id: 'other',
      title: 'Autres services',
      lead: 'Options à la carte pendant votre séjour.',
      match: function () { return true; }
    }
  ];

  function groupBySection(items) {
    var used = {};
    return SECTIONS.map(function (sec) {
      var list = featuredFirst((items || []).filter(function (x) {
        if (used[x.id]) return false;
        if (!sec.match(x)) return false;
        used[x.id] = true;
        return true;
      }));
      return { sec: sec, items: list };
    }).filter(function (g) { return g.items.length; });
  }

  function packCompareCents(items, x) {
    if (x.price_cents_original && x.price_cents_original > x.price_cents) return x.price_cents_original;
    if (x.kind !== 'both') return 0;
    var late = 0, early = 0;
    (items || []).forEach(function (it) {
      if (it.kind === 'late_checkout') late = it.price_cents_original || it.price_cents || 0;
      if (it.kind === 'early_checkin') early = it.price_cents_original || it.price_cents || 0;
    });
    var sum = late + early;
    return sum > x.price_cents ? sum : 0;
  }

  function priceHtml(x, compareCents) {
    if (compareCents && compareCents > x.price_cents) {
      var save = compareCents - x.price_cents;
      return '<div class="shop-price"><s class="shop-price-was">' + euros(compareCents, CUR) + '</s> '
        + euros(x.price_cents, CUR) + ' <small>' + priceUnit(x) + '</small>'
        + '<span class="shop-save">Économisez ' + euros(save, CUR) + '</span></div>';
    }
    return '<div class="shop-price">' + euros(x.price_cents, CUR) + ' <small>' + priceUnit(x) + '</small></div>';
  }

  function badgeHtml(x, compareCents) {
    if (isFeatured(x)) {
      if (compareCents && compareCents > x.price_cents) {
        return '<span class="shop-badge">Meilleure offre · −' + euros(compareCents - x.price_cents, CUR) + '</span>';
      }
      return '<span class="shop-badge">Meilleure offre</span>';
    }
    if (isCure(x)) return '<span class="shop-badge shop-badge-cure">Idéal cure</span>';
    if (x.promo && x.promo.kind === 'percent') return '<span class="shop-badge">−' + Math.round(x.promo.percent) + ' %</span>';
    return '';
  }

  function cardNode(x, items, i) {
    var featured = isFeatured(x);
    var compare = packCompareCents(items, x);
    var node = el('<div class="shop-item reveal in' + (featured ? ' shop-item-pack' : (isCure(x) ? ' shop-item-cure' : '')) + '" style="--i:' + (i + 1) + '">' + FROND +
      badgeHtml(x, compare) +
      (featured ? '<p class="shop-pack-kicker">Les deux pour le prix d\u2019un</p>' : '') +
      '<div class="shop-top"><div class="shop-ic">' + bag() + '</div><div>' +
      '<h3>' + esc(x.title) + '</h3>' +
      '<p class="desc">' + esc(x.description || '') + '</p>' +
      (x.condition ? '<p class="cond">' + esc(x.condition) + '</p>' : '') +
      '</div></div>' +
      '<div class="shop-foot">' + priceHtml(x, compare) +
      '<button class="shop-buy" type="button">' + bag() + (featured ? 'Profiter de l\u2019offre' : 'Réserver') + '</button></div></div>');
    node.querySelector('.shop-buy').addEventListener('click', function () { openBuy(x); });
    return node;
  }

  function render(items) {
    if (!items.length) { MOUNT.innerHTML = '<div class="book-fallback">Aucun extra disponible pour le moment.</div>'; return; }
    MOUNT.innerHTML = '';
    var idx = 0;
    groupBySection(items).forEach(function (g) {
      var section = el(
        '<section class="shop-section reveal in" style="--i:' + (++idx) + '" data-section="' + esc(g.sec.id) + '">' +
          '<header class="shop-section-head">' +
            '<h3 class="shop-section-title">' + esc(g.sec.title) + '</h3>' +
            (g.sec.lead ? '<p class="shop-section-lead">' + esc(g.sec.lead) + '</p>' : '') +
          '</header>' +
          '<div class="grid2 shop-section-grid"></div>' +
        '</section>'
      );
      var grid = section.querySelector('.shop-section-grid');
      g.items.forEach(function (x, i) { grid.appendChild(cardNode(x, items, i)); });
      MOUNT.appendChild(section);
    });
  }

  function maybeShowPromoPopup(promos) {
    if (!promos || !promos.length) return;
    var promo = promos[0];
    var key = 'lba_promo_seen_' + promo.id;
    try { if (sessionStorage.getItem(key)) return; } catch (e) {}
    var hint = promo.kind === 'pack_flex'
      ? 'Les deux pour le prix d’un · ' + euros(promo.pack_price_cents, CUR)
      : (promo.percent ? ('−' + Math.round(promo.percent) + ' %') : '');
    var node = el('<div class="bw-modal lba-promo-modal"><div class="bw-modal-card lba-promo-card">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<div class="lba-promo-kicker">Offre limitée</div>' +
      '<h3>' + esc(promo.title) + '</h3>' +
      (hint ? '<p class="bw-modal-sub">' + esc(hint) + '</p>' : '') +
      (promo.message ? '<p class="bw-modal-msg">' + esc(promo.message) + '</p>' : '') +
      '<button class="bw-modal-close" type="button">' + esc(promo.cta_label || "Profiter de l'offre") + '</button>' +
      '<button class="lba-promo-dismiss" type="button">Plus tard</button>' +
      '</div></div>');
    document.body.appendChild(node);
    function dismiss(mark) {
      if (mark) { try { sessionStorage.setItem(key, '1'); } catch (e) {} }
      try { node.remove(); } catch (e) {}
    }
    node.querySelector('.bw-modal-x').addEventListener('click', function () { dismiss(true); });
    node.querySelector('.lba-promo-dismiss').addEventListener('click', function () { dismiss(true); });
    node.querySelector('.bw-modal-close').addEventListener('click', function () {
      dismiss(true);
      var pack = document.querySelector('.shop-item-pack .shop-buy');
      if (pack) pack.click();
      else {
        var first = document.querySelector('.shop-buy');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    node.addEventListener('click', function (e) { if (e.target === node) dismiss(true); });
  }

  function openBuy(x) {
    var isPack = x.kind === 'flex_pack';
    var isBoth = x.kind === 'both';
    var isWeekly = x.kind === 'weekly';
    var dated = (x.kind === 'late_checkout' || x.kind === 'early_checkin' || isWeekly);
    var dateLabel = x.kind === 'late_checkout' ? 'Date de votre départ' : (x.kind === 'early_checkin' ? 'Date de votre arrivée' : (isWeekly ? 'Semaine à partir du' : ''));
    var priceLine = euros(x.price_cents, CUR);
    if (x.price_cents_original && x.price_cents_original > x.price_cents) {
      priceLine = '<s style="opacity:.55;font-weight:400">' + euros(x.price_cents_original, CUR) + '</s> ' + euros(x.price_cents, CUR);
    }
    var datesHtml = '';
    if (isPack) {
      datesHtml =
        '<div class="bw-field"><label>Date d’arrivée (arrivée anticipée offerte)</label><input id="exEarly" type="date"></div>' +
        '<div class="bw-field"><label>Date de départ (départ tardif)</label><input id="exLate" type="date"></div>' +
        '<div class="bw-promo-err" id="exAvail"></div>';
    } else if (isBoth) {
      datesHtml =
        '<div class="bw-field"><label>Date de votre départ (départ tardif)</label><input id="exLate" type="date"></div>' +
        '<div class="bw-field"><label>Date de votre arrivée (arrivée anticipée)</label><input id="exEarly" type="date"></div>' +
        '<div class="bw-promo-err" id="exAvail"></div>';
    } else if (dated) {
      datesHtml = '<div class="bw-field"><label>' + dateLabel + '</label><input id="exDate" type="date"></div><div class="bw-promo-err" id="exAvail"></div>';
    }
    var node = el('<div class="bw-modal"><div class="bw-modal-card" style="text-align:left">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<h3 style="text-align:center">' + esc(x.title) + '</h3>' +
      '<p class="bw-modal-sub" style="text-align:center">' + priceLine + '</p>' +
      '<div class="bw-form">' +
      datesHtml +
      '<div class="bw-field"><label>Nom complet</label><input id="exName" type="text" placeholder="Camille Dupont"></div>' +
      '<div class="bw-field"><label>Email</label><input id="exEmail" type="email" placeholder="vous@email.com"></div>' +
      '<button class="bw-pay" id="exPay">' + card() + 'Payer ' + euros(x.price_cents, CUR) + '</button>' +
      '<div class="bw-err" id="exErr"></div>' +
      '<div class="bw-secure">' + lock() + 'Paiement sécurisé par Stripe</div>' +
      '</div></div></div>');
    document.body.appendChild(node);
    function close() { try { node.remove(); } catch (e) {} }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.addEventListener('click', function (e) { if (e.target === node) close(); });

    var payBtn = node.querySelector('#exPay');
    var availMsg = node.querySelector('#exAvail');

    function checkOne(kind, date, done) {
      if (!date) { done(false, ''); return; }
      fetch('/api/extras-availability?kind=' + encodeURIComponent(kind) + '&date=' + date)
        .then(function (r) { return r.json(); })
        .then(function (j) { done(!!(j && j.available), (j && j.message) || 'Indisponible ce jour-là.'); })
        .catch(function () { done(true, ''); });
    }

    if (isPack) {
      payBtn.disabled = true;
      var earlyInp = node.querySelector('#exEarly');
      var lateInp = node.querySelector('#exLate');
      // Pour la vérif dispo, on réutilise les extras catalogue late/early (ids 1 et 2 seed).
      function refreshPack() {
        var e = earlyInp.value, l = lateInp.value;
        if (!e || !l) { if (availMsg) availMsg.textContent = ''; payBtn.disabled = true; return; }
        if (availMsg) { availMsg.style.color = 'var(--ink-soft)'; availMsg.textContent = 'Vérification…'; }
        var okE = false, okL = false, left = 2, msg = '';
        function finish() {
          left--;
          if (left > 0) return;
          if (okE && okL) { if (availMsg) availMsg.textContent = ''; payBtn.disabled = false; }
          else { if (availMsg) { availMsg.style.color = '#B3261E'; availMsg.textContent = msg || 'Indisponible.'; } payBtn.disabled = true; }
        }
        checkOne('early_checkin', e, function (ok, m) { okE = ok; if (!ok) msg = m; finish(); });
        checkOne('late_checkout', l, function (ok, m) { okL = ok; if (!ok) msg = m; finish(); });
      }
      earlyInp.addEventListener('change', refreshPack);
      lateInp.addEventListener('change', refreshPack);
    } else if (isBoth) {
      payBtn.disabled = true;
      var earlyInp2 = node.querySelector('#exEarly');
      var lateInp2 = node.querySelector('#exLate');
      function refreshBoth() {
        var e = earlyInp2.value, l = lateInp2.value;
        if (!e || !l) { if (availMsg) availMsg.textContent = ''; payBtn.disabled = true; return; }
        if (availMsg) { availMsg.style.color = 'var(--ink-soft)'; availMsg.textContent = 'Vérification…'; }
        fetch('/api/extras-availability?kind=both&date_late=' + encodeURIComponent(l) + '&date_early=' + encodeURIComponent(e))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.available) { if (availMsg) availMsg.textContent = ''; payBtn.disabled = false; }
            else { if (availMsg) { availMsg.style.color = '#B3261E'; availMsg.textContent = (j && j.message) || 'Indisponible.'; } payBtn.disabled = true; }
          })
          .catch(function () { if (availMsg) availMsg.textContent = ''; payBtn.disabled = false; });
      }
      earlyInp2.addEventListener('change', refreshBoth);
      lateInp2.addEventListener('change', refreshBoth);
    } else if (dated) {
      payBtn.disabled = true;
      var dateInp = node.querySelector('#exDate');
      dateInp.addEventListener('change', function () {
        var d = dateInp.value;
        if (!d) { availMsg.textContent = ''; payBtn.disabled = true; return; }
        availMsg.style.color = 'var(--ink-soft)'; availMsg.textContent = 'Vérification…';
        fetch('/api/extras-availability?extra_id=' + x.id + '&date=' + d)
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.available) { availMsg.textContent = ''; payBtn.disabled = false; }
            else { availMsg.style.color = '#B3261E'; availMsg.textContent = (j && j.message) || 'Indisponible ce jour-là.'; payBtn.disabled = true; }
          })
          .catch(function () { availMsg.textContent = ''; payBtn.disabled = false; });
      });
    }

    payBtn.addEventListener('click', function () {
      var err = node.querySelector('#exErr'); err.textContent = '';
      var name = (node.querySelector('#exName') || {}).value || '';
      var email = (node.querySelector('#exEmail') || {}).value || '';
      if (!name.trim()) { err.textContent = 'Merci d’indiquer votre nom.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { err.textContent = 'Email invalide.'; return; }

      var payload = { name: name.trim(), email: email.trim() };
      if (isPack) {
        var early = ((node.querySelector('#exEarly') || {}).value || '');
        var late = ((node.querySelector('#exLate') || {}).value || '');
        if (!early || !late) { err.textContent = 'Indiquez les deux dates.'; return; }
        payload.kind = 'flex_pack';
        payload.promo_id = x.promo_id || (x.promo && x.promo.id);
        payload.early_date = early;
        payload.late_date = late;
        payload.extra_id = x.id;
      } else if (isBoth) {
        var late = ((node.querySelector('#exLate') || {}).value || '');
        var early = ((node.querySelector('#exEarly') || {}).value || '');
        if (!late || !early) { err.textContent = 'Indiquez les deux dates.'; return; }
        payload.kind = 'both';
        payload.extra_id = x.id;
        payload.late_date = late;
        payload.early_date = early;
      } else {
        var date = dated ? ((node.querySelector('#exDate') || {}).value || '') : '';
        if (dated && !date) { err.textContent = 'Indiquez la date.'; return; }
        payload.extra_id = x.id;
        payload.date = date;
        if (x.promo && x.promo.id) payload.promo_id = x.promo.id;
      }

      payBtn.disabled = true; payBtn.innerHTML = card() + 'Redirection…';
      fetch('/api/extras-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && j.url) { window.location.href = j.url; return; }
          payBtn.disabled = false; payBtn.innerHTML = card() + 'Payer ' + euros(x.price_cents, CUR);
          err.textContent = (j && j.message) || 'Une erreur est survenue. Réessayez.';
        })
        .catch(function () { payBtn.disabled = false; payBtn.innerHTML = card() + 'Payer ' + euros(x.price_cents, CUR); err.textContent = 'Connexion impossible.'; });
    });
  }

  function thankYou(j) {
    var node = el('<div class="bw-modal"><div class="bw-modal-card">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<div class="bw-modal-check">' + check() + '</div>' +
      '<h3>Merci&nbsp;!</h3><p class="bw-modal-sub">Votre extra est confirmé 🌴</p>' +
      '<div class="bw-modal-recap"><div><span>' + esc(j.title || 'Extra') + '</span><b>' + euros(j.amount_cents, j.currency) + '</b></div></div>' +
      '<p class="bw-modal-msg">Un email de confirmation vous a été envoyé. Théo revient vers vous pour les détails. À très vite&nbsp;!</p>' +
      '<button class="bw-modal-close">Parfait, merci&nbsp;!</button></div></div>');
    document.body.appendChild(node);
    function close() { try { node.remove(); } catch (e) {} try { history.replaceState({}, '', location.pathname); } catch (e) {} }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.querySelector('.bw-modal-close').addEventListener('click', close);
    node.addEventListener('click', function (e) { if (e.target === node) close(); });
  }
})();
