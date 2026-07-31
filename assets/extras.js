/* La Bonne Aventure — page extras : liste dynamique + paiement Stripe (vanilla JS) */
(function () {
  'use strict';
  var MOUNT = document.getElementById('extras-list');
  if (!MOUNT) return;

  var CUR = 'eur';
  function euros(c, cur) { try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'eur' }).format((c || 0) / 100); } catch (e) { return ((c || 0) / 100).toFixed(2) + ' €'; } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  var FROND = '<div class="frond"><svg viewBox="0 0 120 200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M60 198 C60 150 58 95 64 8"/><path d="M61 165 C40 158 28 150 20 132"/><path d="M62 150 C84 144 96 136 104 118"/><path d="M60 132 C40 126 30 118 24 100"/><path d="M62 116 C82 110 92 102 98 86"/></svg></div>';
  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }
  function bag() { return svg('<path d="M6 6h15l-1.5 8.5H7.7L6 3H3"/><circle cx="8" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>'); }
  function card() { return svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'); }
  function lock() { return svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'); }
  function check() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'; }
  function icClock() { return svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'); }
  function icKey() { return svg('<circle cx="8" cy="15" r="3"/><path d="M10.5 13.5L19 5"/><path d="M16 5h3v3"/>'); }
  function icCup() { return svg('<path d="M5 8h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"/><path d="M16 10h2a2.5 2.5 0 010 5h-2"/><path d="M8 4v2M11 3v3M14 4v2"/>'); }
  function icProjector() { return svg('<rect x="3" y="6" width="18" height="11" rx="2"/><path d="M8 20h8M12 17v3"/><circle cx="12" cy="11.5" r="2.5"/>'); }
  function icSparkle() { return svg('<path d="M12 3l1.2 5.2L18 9.5l-4.8 1.3L12 16l-1.2-5.2L6 9.5l4.8-1.3L12 3z"/><path d="M19 14l.6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14z"/>'); }
  function icCar() { return svg('<path d="M4 14l1.5-4.5A2 2 0 017.4 8h9.2a2 2 0 011.9 1.5L20 14"/><path d="M3 14h18v3a1 1 0 01-1 1h-1"/><path d="M5 18H4a1 1 0 01-1-1v-3"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'); }
  function icBed() { return svg('<path d="M3 18V9a2 2 0 012-2h7v7"/><path d="M12 14h8a1 1 0 011 1v3"/><path d="M3 18h18"/><path d="M5 18v2M19 18v2"/>'); }
  function icBike() { return svg('<circle cx="6.5" cy="16.5" r="3.5"/><circle cx="17.5" cy="16.5" r="3.5"/><path d="M6.5 16.5l3.5-8h3l4.5 8"/><path d="M10 8.5h3.5"/>'); }
  function icGift() { return svg('<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M12 10v10M4 14h16"/><path d="M12 10c-2.5 0-4-1.7-4-3.2S9.2 4 12 7c2.8-3 4-1.3 4-.2S14.5 10 12 10z"/>'); }

  /** Icône liée au type / au nom de l’extra */
  function iconFor(x) {
    var kind = (x && x.kind) || 'none';
    if (kind === 'late_checkout') return icClock();
    if (kind === 'early_checkin') return icKey();
    var t = String((x && x.title) || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/depart|tardif|checkout|late/.test(t)) return icClock();
    if (/arrive|anticipe|check.?in|early|cle/.test(t)) return icKey();
    if (/petit.?dej|breakfast|brunch|cafe|kit/.test(t)) return icCup();
    if (/video|projecteur|projector|film|ecran/.test(t)) return icProjector();
    if (/parking|garage|voiture|place/.test(t)) return icCar();
    if (/lit|bebe|berceau|baby|drap/.test(t)) return icBed();
    if (/velo|bike|trottinette/.test(t)) return icBike();
    if (/cadeau|champagne|panier|welcome|bienvenue/.test(t)) return icGift();
    if (/menage|linge|serviette|produit/.test(t)) return icSparkle();
    return bag();
  }

  fetch('/api/extras')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      CUR = d.currency || 'eur';
      render(d.extras || []);
      var p = new URLSearchParams(location.search);
      if (p.get('extra') === 'confirmee' && p.get('session_id')) {
        fetch('/api/extras-confirm?session_id=' + encodeURIComponent(p.get('session_id')))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) thankYou(j); });
      }
    })
    .catch(function () { MOUNT.innerHTML = '<div class="book-fallback">Les extras sont momentanément indisponibles.</div>'; });

  function render(items) {
    if (!items.length) { MOUNT.innerHTML = '<div class="book-fallback">Aucun extra disponible pour le moment.</div>'; return; }
    MOUNT.innerHTML = '';
    items.forEach(function (x, i) {
      var node = el('<div class="shop-item reveal in" style="--i:' + (i + 1) + '">' + FROND +
        '<div class="shop-top"><div class="shop-ic" aria-hidden="true">' + iconFor(x) + '</div><div>' +
        '<h3>' + esc(x.title) + '</h3>' +
        '<p class="desc">' + esc(x.description || '') + '</p>' +
        (x.condition ? '<p class="cond">' + esc(x.condition) + '</p>' : '') +
        '</div></div>' +
        '<div class="shop-foot"><div class="shop-price">' + euros(x.price_cents, CUR) + ' <small>/ séjour</small></div>' +
        '<button class="shop-buy" type="button">' + bag() + 'Réserver</button></div></div>');
      node.querySelector('.shop-buy').addEventListener('click', function () { openBuy(x); });
      MOUNT.appendChild(node);
    });
  }

  function openBuy(x) {
    var dated = (x.kind === 'late_checkout' || x.kind === 'early_checkin');
    var dateLabel = x.kind === 'late_checkout' ? 'Date de votre départ' : (x.kind === 'early_checkin' ? 'Date de votre arrivée' : '');
    var node = el('<div class="bw-modal"><div class="bw-modal-card" style="text-align:left">' +
      '<button class="bw-modal-x" aria-label="Fermer">&times;</button>' +
      '<div class="shop-ic" aria-hidden="true" style="margin:0 auto 12px">' + iconFor(x) + '</div>' +
      '<h3 style="text-align:center">' + esc(x.title) + '</h3>' +
      '<p class="bw-modal-sub" style="text-align:center">' + euros(x.price_cents, CUR) + '</p>' +
      '<div class="bw-form">' +
      (dated ? '<div class="bw-field"><label>' + dateLabel + '</label><input id="exDate" type="date"></div><div class="bw-promo-err" id="exAvail"></div>' : '') +
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
    if (dated) {
      payBtn.disabled = true;
      var dateInp = node.querySelector('#exDate');
      var availMsg = node.querySelector('#exAvail');
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
      var date = dated ? ((node.querySelector('#exDate') || {}).value || '') : '';
      if (dated && !date) { err.textContent = 'Indiquez la date.'; return; }
      if (!name.trim()) { err.textContent = 'Merci d’indiquer votre nom.'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { err.textContent = 'Email invalide.'; return; }
      payBtn.disabled = true; payBtn.innerHTML = card() + 'Redirection…';
      fetch('/api/extras-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_id: x.id, name: name.trim(), email: email.trim(), date: date }) })
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
