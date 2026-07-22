/* Apparition au défilement — révèle les éléments .reveal quand ils entrent à l'écran. */
(function () {
  'use strict';
  function all() { return Array.prototype.slice.call(document.querySelectorAll('.reveal')); }
  function showAll() { all().forEach(function (e) { e.classList.add('in'); }); }

  if (!('IntersectionObserver' in window)) { showAll(); return; }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

  function scan() { all().forEach(function (e) { if (!e.classList.contains('in')) io.observe(e); }); }

  function init() {
    scan();
    // Guide : re-scanner quand on change d'onglet (les sections cachées deviennent visibles)
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.closest && t.closest('.nav button')) setTimeout(scan, 90);
    });
    // Filet de sécurité : tout révéler après 3 s quoi qu'il arrive
    setTimeout(showAll, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
