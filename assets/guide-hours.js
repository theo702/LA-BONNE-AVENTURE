/* Horaires du livret : 16h / 10h par défaut, 12h / 14h si extras flex payés. */
(function () {
  'use strict';
  var KEY = 'lba_flex_hours';
  var arriveEl = document.getElementById('guide-arrive-time');
  var departEl = document.getElementById('guide-depart-time');
  var arriveHint = document.getElementById('guide-arrive-hint');
  var departHint = document.getElementById('guide-depart-hint');
  var noteEl = document.getElementById('guide-hours-note');
  var box = document.getElementById('guide-hours');
  if (!arriveEl || !departEl) return;

  function apply(h) {
    if (!h) return;
    var early = !!h.early;
    var late = !!h.late;
    arriveEl.textContent = early ? '12:00' : '16:00';
    departEl.textContent = late ? '14:00' : '10:00';
    if (arriveHint) arriveHint.textContent = early ? 'dès (option)' : 'à partir de';
    if (departHint) departHint.textContent = late ? 'jusqu’à (option)' : 'avant';
    if (box) {
      box.classList.toggle('hours-early', early);
      box.classList.toggle('hours-late', late);
    }
    if (noteEl) {
      var bits = [];
      if (early) bits.push('arrivée anticipée dès 12h');
      if (late) bits.push('départ tardif jusqu’à 14h');
      if (bits.length) {
        noteEl.hidden = false;
        noteEl.textContent = 'Horaires adaptés : ' + bits.join(' · ') + '.';
      } else {
        noteEl.hidden = true;
        noteEl.textContent = '';
      }
    }
  }

  function fromStorage() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  apply(fromStorage());

  fetch('/api/guide-hours', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j) return;
      if (j.early || j.late) {
        try { localStorage.setItem(KEY, JSON.stringify({ early: !!j.early, late: !!j.late })); } catch (e) {}
      }
      // Fusionne API + localStorage (le plus permissif gagne).
      var s = fromStorage() || {};
      apply({ early: !!(j.early || s.early), late: !!(j.late || s.late) });
    })
    .catch(function () {});
})();
