// Espace voyageur — connexion par lien magique, réservations + fidélité (vanilla JS).
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var euro = function (c) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'eur' }).format((c || 0) / 100); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function api(path, opts) {
    return fetch('/api/account/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, j: j }; }); });
  }

  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(ta);
  }
  function copyText(text, btn) {
    var done = function () { var old = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(function () { btn.textContent = old; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }

  function showLogin() {
    $('#acctLogin').hidden = false;
    $('#acctApp').hidden = true;
  }

  function renderLoyalty(loyalty) {
    var card = $('#acctLoyaltyCard');
    if (!loyalty || !loyalty.enabled) { card.hidden = true; return; }
    card.hidden = false;
    $('#acctPoints').textContent = loyalty.points;
    var pct = loyalty.pointsPerReward ? Math.min(100, Math.round(((loyalty.points % loyalty.pointsPerReward) / loyalty.pointsPerReward) * 100)) : 0;
    if (loyalty.points > 0 && loyalty.points % loyalty.pointsPerReward === 0) pct = 100;
    $('#acctProgressBar').style.width = pct + '%';
    $('#acctNextReward').textContent = loyalty.nextRewardIn > 0
      ? 'Encore ' + loyalty.nextRewardIn + ' point' + (loyalty.nextRewardIn > 1 ? 's' : '') + ' pour votre prochaine récompense (−' + loyalty.rewardPct + ' % sur un séjour).'
      : 'Récompense débloquée !';
    var box = $('#acctRewards'); box.innerHTML = '';
    (loyalty.rewards || []).forEach(function (r) {
      var el = document.createElement('div'); el.className = 'acct-reward';
      el.innerHTML = '<code>' + esc(r.code) + '</code><span>−' + loyalty.rewardPct + ' % · usage unique</span><button type="button">Copier</button>';
      el.querySelector('button').addEventListener('click', function () { copyText(r.code, el.querySelector('button')); });
      box.appendChild(el);
    });
  }

  function renderBookings(bookings) {
    var box = $('#acctBookings'); box.innerHTML = '';
    $('#acctEmpty').hidden = (bookings || []).length > 0;
    (bookings || []).forEach(function (b) {
      var el = document.createElement('div'); el.className = 'acct-booking';
      var badgeCls = b.status === 'confirmed' ? 'confirmed' : 'pending';
      var badgeLabel = b.status === 'confirmed' ? 'Confirmée' : 'En attente';
      el.innerHTML =
        '<div><div class="acct-booking-dates">' + fmtDate(b.checkin) + ' → ' + fmtDate(b.checkout) + '</div>' +
        '<div class="acct-booking-meta">' + b.nights + ' nuit' + (b.nights > 1 ? 's' : '') + ' · ' + b.guests + ' voyageur' + (b.guests > 1 ? 's' : '') + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<span class="acct-badge ' + badgeCls + '">' + badgeLabel + '</span>' +
        '<span class="acct-booking-amount">' + euro(b.amount_total_cents) + '</span></div>';
      box.appendChild(el);
    });
  }

  function renderApp(data) {
    $('#acctEmailLabel').textContent = data.email;
    renderLoyalty(data.loyalty);
    renderBookings(data.bookings);
    $('#acctLogin').hidden = true;
    $('#acctApp').hidden = false;
  }

  function init() {
    var params = new URLSearchParams(location.search);
    if (params.get('erreur') === 'lien_expire') {
      var err = $('#acctError'); err.hidden = false;
      err.textContent = 'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.';
    }
    api('me').then(function (r) {
      if (r.status === 200 && r.j && r.j.ok) renderApp(r.j);
      else showLogin();
    });
  }

  $('#acctLoginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#acctLoginBtn'); var msg = $('#acctLoginMsg');
    btn.disabled = true; btn.textContent = 'Envoi…';
    api('request-link', { method: 'POST', body: JSON.stringify({ email: $('#acctEmail').value }) }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Recevoir mon lien de connexion';
      msg.hidden = false; msg.classList.toggle('err', !(r.j && r.j.ok));
      msg.textContent = (r.j && r.j.message) || 'Une erreur est survenue. Réessayez.';
    });
  });

  $('#acctLogout').addEventListener('click', function () {
    api('logout', { method: 'POST' }).then(function () { showLogin(); });
  });

  init();
})();
