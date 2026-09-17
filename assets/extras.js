/* La Bonne Aventure — page extras : liste dynamique + paiement Stripe (vanilla JS) */
(function () {
  'use strict';
  var MOUNT = document.getElementById('extras-list');
  if (!MOUNT) return;

  // Page à partager hors livret → rester sur extras-offre après Stripe (pas de Retour vers le guide).
  var RETURN_PATH = /extras-offre/.test(location.pathname || '') ? '/extras-offre' : '/extras';

  var CUR = 'eur';
  var LIVE_PROMOS = [];
  function euros(c, cur) { try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'eur' }).format((c || 0) / 100); } catch (e) { return ((c || 0) / 100).toFixed(2) + ' €'; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  /** Langue du site (i18n) — en français on force jj/mm/aaaa (le type=date suit sinon le téléphone). */
  function siteLang() {
    try {
      if (window.LBA_I18N && LBA_I18N.lang) return String(LBA_I18N.lang).slice(0, 2);
    } catch (e) {}
    return (document.documentElement.lang || 'fr').slice(0, 2);
  }
  function useDmyDates() {
    return siteLang() !== 'en';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoToDmy(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function dmyToIso(raw) {
    var s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // déjà ISO
    var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) return '';
    var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }
  function dateFieldHtml(id, labelHtml) {
    if (useDmyDates()) {
      return '<div class="bw-field"><label>' + labelHtml + '</label>' +
        '<input id="' + id + '" class="bw-date-dmy" type="text" inputmode="numeric" placeholder="jj/mm/aaaa" autocomplete="off" maxlength="10"></div>';
    }
    return '<div class="bw-field"><label>' + labelHtml + '</label><input id="' + id + '" type="date"></div>';
  }
  function bindDmyInput(inp, onChange) {
    if (!inp || inp.type === 'date') {
      if (inp && onChange) inp.addEventListener('change', onChange);
      return;
    }
    inp.addEventListener('input', function () {
      var digits = inp.value.replace(/\D/g, '').slice(0, 8);
      var out = digits;
      if (digits.length > 4) out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
      else if (digits.length > 2) out = digits.slice(0, 2) + '/' + digits.slice(2);
      if (inp.value !== out) inp.value = out;
      if (onChange && digits.length === 8) onChange();
    });
    inp.addEventListener('change', function () { if (onChange) onChange(); });
    inp.addEventListener('blur', function () {
      var iso = dmyToIso(inp.value);
      if (iso) {
        inp.value = isoToDmy(iso);
        inp.classList.remove('bw-date-invalid');
      } else if (inp.value.trim()) {
        inp.classList.add('bw-date-invalid');
      } else {
        inp.classList.remove('bw-date-invalid');
      }
      if (onChange) onChange();
    });
  }
  function readDateInput(inp) {
    if (!inp) return '';
    if (inp.type === 'date') return inp.value || '';
    return dmyToIso(inp.value);
  }
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
    var inner = '';
    if (isFeatured(x)) {
      if (compareCents && compareCents > x.price_cents) {
        inner = '<span class="shop-badge">Meilleure offre · −' + euros(compareCents - x.price_cents, CUR) + '</span>';
      } else {
        inner = '<span class="shop-badge">Meilleure offre</span>';
      }
    } else if (isCure(x)) {
      inner = '<span class="shop-badge shop-badge-cure">Idéal cure</span>';
    } else if (x.promo && x.promo.kind === 'percent') {
      inner = '<span class="shop-badge">−' + Math.round(x.promo.percent) + ' %</span>';
    }
    return inner ? '<div class="shop-badges">' + inner + '</div>' : '';
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
    var dated = (x.kind === 'late_checkout' || x.kind === 'early_checkin');
    // Arrivée anticipée / départ tardif : validation hôte + ménage avant paiement.
    var needsApproval = isPack || isBoth || dated;
    var dateLabel = x.kind === 'late_checkout' ? 'Date de votre départ' : (x.kind === 'early_checkin' ? 'Date de votre arrivée' : '');
    var priceLine = euros(x.price_cents, CUR);
    if (x.price_cents_original && x.price_cents_original > x.price_cents) {
      priceLine = '<s style="opacity:.55;font-weight:400">' + euros(x.price_cents_original, CUR) + '</s> ' + euros(x.price_cents, CUR);
    }
    if (isWeekly) priceLine = euros(x.price_cents, CUR) + ' <small>/ sem.</small>';
    var datesHtml = '';
    if (isPack) {
      datesHtml =
        dateFieldHtml('exEarly', 'Date d’arrivée (arrivée anticipée offerte)') +
        dateFieldHtml('exLate', 'Date de départ (départ tardif)') +
        '<div class="bw-promo-err" id="exAvail"></div>';
    } else if (isBoth) {
      datesHtml =
        dateFieldHtml('exLate', 'Date de votre départ (départ tardif)') +
        dateFieldHtml('exEarly', 'Date de votre arrivée (arrivée anticipée)') +
        '<div class="bw-promo-err" id="exAvail"></div>';
    } else if (isWeekly) {
      datesHtml =
        dateFieldHtml('exArrive', 'Date d’arrivée') +
        dateFieldHtml('exDepart', 'Date de départ') +
        '<p class="bw-modal-msg" style="margin:0 0 8px;font-size:12.5px">1 ménage + linge par <b>samedi</b> de votre séjour (1 à 4 semaines).</p>' +
        '<div class="bw-promo-err" id="exAvail"></div>';
    } else if (dated) {
      datesHtml = dateFieldHtml('exDate', dateLabel) + '<div class="bw-promo-err" id="exAvail"></div>';
    }
    var ctaLabel = needsApproval
      ? ('Demander · ' + euros(x.price_cents, CUR))
      : (card() + 'Payer ' + euros(x.price_cents, CUR));
    var secureLine = needsApproval
      ? 'Sous réserve de validation (ménage). Vous paierez après acceptation.'
      : (lock() + 'Paiement sécurisé par Stripe');
    var node = el('<div class="bw-modal"><div class="bw-modal-card" style="text-align:left">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<h3 style="text-align:center">' + esc(x.title) + '</h3>' +
      '<p class="bw-modal-sub" style="text-align:center" id="exPriceLine">' + priceLine + '</p>' +
      (needsApproval ? '<p class="bw-modal-msg" style="margin:0 0 12px;font-size:13px;text-align:center">Nous validons d’abord avec le ménage, puis vous recevez un lien de paiement par email.</p>' : '') +
      '<div class="bw-form">' +
      datesHtml +
      '<div class="bw-field"><label>Nom complet</label><input id="exName" type="text" placeholder="Camille Dupont"></div>' +
      '<div class="bw-field"><label>Email</label><input id="exEmail" type="email" placeholder="vous@email.com"></div>' +
      '<button class="bw-pay" id="exPay">' + ctaLabel + '</button>' +
      '<div class="bw-err" id="exErr"></div>' +
      '<div class="bw-secure">' + secureLine + '</div>' +
      '</div></div></div>');
    document.body.appendChild(node);
    function close() { try { node.remove(); } catch (e) {} }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.addEventListener('click', function (e) { if (e.target === node) close(); });

    var payBtn = node.querySelector('#exPay');
    var availMsg = node.querySelector('#exAvail');
    var priceEl = node.querySelector('#exPriceLine');
    var weeklyQuote = null;

    function setPayLabel(cents) {
      if (needsApproval) payBtn.textContent = 'Demander · ' + euros(cents, CUR);
      else payBtn.innerHTML = card() + 'Payer ' + euros(cents, CUR);
    }

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
      function refreshPack() {
        var e = readDateInput(earlyInp), l = readDateInput(lateInp);
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
      bindDmyInput(earlyInp, refreshPack);
      bindDmyInput(lateInp, refreshPack);
    } else if (isBoth) {
      payBtn.disabled = true;
      var earlyInp2 = node.querySelector('#exEarly');
      var lateInp2 = node.querySelector('#exLate');
      function refreshBoth() {
        var e = readDateInput(earlyInp2), l = readDateInput(lateInp2);
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
      bindDmyInput(earlyInp2, refreshBoth);
      bindDmyInput(lateInp2, refreshBoth);
    } else if (isWeekly) {
      payBtn.disabled = true;
      var arriveInp = node.querySelector('#exArrive');
      var departInp = node.querySelector('#exDepart');
      function refreshWeekly() {
        weeklyQuote = null;
        var a = readDateInput(arriveInp), d = readDateInput(departInp);
        if (!a || !d) {
          if (availMsg) availMsg.textContent = '';
          if (priceEl) priceEl.innerHTML = euros(x.price_cents, CUR) + ' <small>/ sem.</small>';
          setPayLabel(x.price_cents);
          payBtn.disabled = true;
          return;
        }
        if (availMsg) { availMsg.style.color = 'var(--ink-soft)'; availMsg.textContent = 'Calcul…'; }
        fetch('/api/extras-availability?kind=weekly&extra_id=' + encodeURIComponent(x.id)
          + '&arrival_date=' + encodeURIComponent(a)
          + '&departure_date=' + encodeURIComponent(d))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.available && j.weeks > 0 && j.amount_cents > 0) {
              weeklyQuote = j;
              if (priceEl) {
                priceEl.innerHTML = euros(j.amount_cents, CUR)
                  + ' <small>(' + j.weeks + ' × ' + euros(j.unit_cents || x.price_cents, CUR) + ')</small>';
              }
              if (availMsg) {
                availMsg.style.color = 'var(--green,#6f8f6e)';
                availMsg.textContent = j.message || (j.weeks + ' semaine' + (j.weeks > 1 ? 's' : ''));
              }
              setPayLabel(j.amount_cents);
              payBtn.disabled = false;
            } else {
              if (priceEl) priceEl.innerHTML = euros(x.price_cents, CUR) + ' <small>/ sem.</small>';
              if (availMsg) {
                availMsg.style.color = '#B3261E';
                availMsg.textContent = (j && j.message) || 'Dates invalides.';
              }
              setPayLabel(x.price_cents);
              payBtn.disabled = true;
            }
          })
          .catch(function () {
            if (availMsg) { availMsg.style.color = '#B3261E'; availMsg.textContent = 'Connexion impossible.'; }
            payBtn.disabled = true;
          });
      }
      bindDmyInput(arriveInp, refreshWeekly);
      bindDmyInput(departInp, refreshWeekly);
    } else if (dated) {
      payBtn.disabled = true;
      var dateInp = node.querySelector('#exDate');
      function refreshDated() {
        var d = readDateInput(dateInp);
        if (!d) { availMsg.textContent = ''; payBtn.disabled = true; return; }
        availMsg.style.color = 'var(--ink-soft)'; availMsg.textContent = 'Vérification…';
        fetch('/api/extras-availability?extra_id=' + x.id + '&date=' + d)
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.available) { availMsg.textContent = ''; payBtn.disabled = false; }
            else { availMsg.style.color = '#B3261E'; availMsg.textContent = (j && j.message) || 'Indisponible ce jour-là.'; payBtn.disabled = true; }
          })
          .catch(function () { availMsg.textContent = ''; payBtn.disabled = false; });
      }
      bindDmyInput(dateInp, refreshDated);
    }

    payBtn.addEventListener('click', function () {
      var err = node.querySelector('#exErr'); err.textContent = '';
      var name = (node.querySelector('#exName') || {}).value || '';
      var email = (node.querySelector('#exEmail') || {}).value || '';
      if (!name.trim()) { err.textContent = 'Merci d’indiquer votre nom.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { err.textContent = 'Email invalide.'; return; }

      var payload = { name: name.trim(), email: email.trim(), return_path: RETURN_PATH };
      if (isPack) {
        var early = readDateInput(node.querySelector('#exEarly'));
        var late = readDateInput(node.querySelector('#exLate'));
        if (!early || !late) { err.textContent = 'Indiquez les deux dates (jj/mm/aaaa).'; return; }
        payload.kind = 'flex_pack';
        payload.promo_id = x.promo_id || (x.promo && x.promo.id);
        payload.early_date = early;
        payload.late_date = late;
        payload.extra_id = x.id;
      } else if (isBoth) {
        var lateB = readDateInput(node.querySelector('#exLate'));
        var earlyB = readDateInput(node.querySelector('#exEarly'));
        if (!lateB || !earlyB) { err.textContent = 'Indiquez les deux dates (jj/mm/aaaa).'; return; }
        payload.kind = 'both';
        payload.extra_id = x.id;
        payload.late_date = lateB;
        payload.early_date = earlyB;
      } else if (isWeekly) {
        var arrival = readDateInput(node.querySelector('#exArrive'));
        var departure = readDateInput(node.querySelector('#exDepart'));
        if (!arrival || !departure) { err.textContent = 'Indiquez vos dates d’arrivée et de départ (jj/mm/aaaa).'; return; }
        if (!weeklyQuote || !weeklyQuote.weeks) { err.textContent = 'Vérifiez vos dates.'; return; }
        payload.kind = 'weekly';
        payload.extra_id = x.id;
        payload.arrival_date = arrival;
        payload.departure_date = departure;
      } else {
        var date = dated ? readDateInput(node.querySelector('#exDate')) : '';
        if (dated && !date) { err.textContent = 'Indiquez la date (jj/mm/aaaa).'; return; }
        payload.extra_id = x.id;
        payload.date = date;
        if (x.promo && x.promo.id) payload.promo_id = x.promo.id;
      }

      var payCents = (isWeekly && weeklyQuote && weeklyQuote.amount_cents) ? weeklyQuote.amount_cents : x.price_cents;
      payBtn.disabled = true;
      payBtn.textContent = needsApproval ? 'Envoi…' : '';
      if (!needsApproval) payBtn.innerHTML = card() + 'Redirection…';
      else payBtn.textContent = 'Envoi de la demande…';
      var endpoint = needsApproval ? '/api/extras-request' : '/api/extras-checkout';
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && j.url) { window.location.href = j.url; return; }
          if (j && j.ok && j.requested) {
            close();
            requestThanks();
            return;
          }
          payBtn.disabled = false; setPayLabel(payCents);
          err.textContent = (j && j.message) || 'Une erreur est survenue. Réessayez.';
        })
        .catch(function () { payBtn.disabled = false; setPayLabel(payCents); err.textContent = 'Connexion impossible.'; });
    });
  }

  function requestThanks() {
    var node = el('<div class="bw-modal"><div class="bw-modal-card">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<div class="bw-modal-check">' + check() + '</div>' +
      '<h3>Demande envoyée</h3>' +
      '<p class="bw-modal-msg">Nous validons avec le ménage. Vous recevrez un <b>email avec le lien de paiement</b> dès acceptation.</p>' +
      '<button class="bw-modal-close">Compris</button>' +
      '</div></div>');
    document.body.appendChild(node);
    function close() { try { node.remove(); } catch (e) {} }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.querySelector('.bw-modal-close').addEventListener('click', close);
    node.addEventListener('click', function (e) { if (e.target === node) close(); });
  }

  function thankYou(j) {
    if (j && (j.early || j.late)) {
      try {
        var prev = {};
        try { prev = JSON.parse(localStorage.getItem('lba_flex_hours') || '{}') || {}; } catch (e) {}
        localStorage.setItem('lba_flex_hours', JSON.stringify({
          early: !!(prev.early || j.early),
          late: !!(prev.late || j.late),
          email: j.email || prev.email || '',
        }));
      } catch (e) {}
    }
    var hoursLine = '';
    if (j && (j.early || j.late)) {
      var bits = [];
      if (j.early) bits.push('arrivée dès <b>12h</b>');
      if (j.late) bits.push('départ jusqu’à <b>14h</b>');
      hoursLine = '<p class="bw-modal-msg">Horaires mis à jour dans votre livret : ' + bits.join(' · ') + '.</p>';
    }
    var node = el('<div class="bw-modal"><div class="bw-modal-card">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<div class="bw-modal-check">' + check() + '</div>' +
      '<h3>Merci&nbsp;!</h3><p class="bw-modal-sub">Votre extra est confirmé 🌴</p>' +
      '<div class="bw-modal-recap"><div><span>' + esc(j.title || 'Extra') + '</span><b>' + euros(j.amount_cents, j.currency) + '</b></div></div>' +
      hoursLine +
      '<p class="bw-modal-msg">Un email de confirmation vous a été envoyé. Théo revient vers vous pour les détails. À très vite&nbsp;!</p>' +
      '<button class="bw-modal-close">Parfait, merci&nbsp;!</button></div></div>');
    document.body.appendChild(node);
    function close() { try { node.remove(); } catch (e) {} try { history.replaceState({}, '', location.pathname); } catch (e) {} }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.querySelector('.bw-modal-close').addEventListener('click', close);
    node.addEventListener('click', function (e) { if (e.target === node) close(); });
  }
})();
