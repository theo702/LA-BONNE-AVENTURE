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
  function bag() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6h15l-1.5 8.5H7.7L6 3H3M8 20a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2z"/></svg>'; }
  function card() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>'; }
  function lock() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>'; }
  function check() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>'; }

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
        '<div class="shop-top"><div class="shop-ic">' + bag() + '</div><div>' +
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
