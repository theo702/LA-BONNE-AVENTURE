/* La Bonne Aventure — galeries : masquage gracieux des photos manquantes + lightbox */
(function () {
  'use strict';

  // 1) Retire les vignettes dont l'image ne charge pas ; masque une galerie (et sa
  //    section) devenue vide. Ainsi rien de « cassé » ne s'affiche tant que les photos
  //    ne sont pas déposées — et tout s'allume dès qu'elles le sont.
  Array.prototype.forEach.call(document.querySelectorAll('.gallery'), function (g) {
    var section = g.closest('[data-gallery-section]');
    function prune() {
      if (!g.querySelector('.g-item')) {
        g.style.display = 'none';
        if (section) section.style.display = 'none';
      }
    }
    Array.prototype.forEach.call(g.querySelectorAll('.g-item'), function (it) {
      var img = it.querySelector('img');
      if (!img) { it.remove(); return; }
      var fail = function () { it.remove(); prune(); };
      if (img.complete && img.naturalWidth === 0) fail();
      else img.addEventListener('error', fail);
    });
    prune();
  });

  // 2) Lightbox (visionneuse plein écran) construite à la volée sur les vignettes valides.
  var lb, lbImg, lbCap, list = [], idx = 0;

  function build() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.innerHTML = '<button class="lb-x" aria-label="Fermer">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Précédent">&#8249;</button>' +
      '<button class="lb-nav lb-next" aria-label="Suivant">&#8250;</button>' +
      '<img alt=""><div class="lb-cap"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img');
    lbCap = lb.querySelector('.lb-cap');
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  function show() {
    var a = list[idx];
    if (!a) return;
    lbImg.src = a.getAttribute('href');
    lbCap.textContent = a.getAttribute('data-lb') || '';
    lb.querySelector('.lb-prev').style.visibility = list.length > 1 ? 'visible' : 'hidden';
    lb.querySelector('.lb-next').style.visibility = list.length > 1 ? 'visible' : 'hidden';
  }

  function step(d) { idx = (idx + d + list.length) % list.length; show(); }

  function close() {
    lb.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  function openAt(items, start) {
    if (!items || !items.length) return;
    if (!lb) build();
    list = items;
    idx = Math.max(0, Math.min(start || 0, list.length - 1));
    show();
    lb.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }

  function itemsIn(gallery) {
    return Array.prototype.slice.call(gallery.querySelectorAll('.g-item'));
  }

  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest && e.target.closest('[data-gallery-open]');
    if (openBtn) {
      e.preventDefault();
      var gAll = openBtn.closest('.gallery') || document.querySelector('.gallery');
      if (!gAll) return;
      openAt(itemsIn(gAll), 0);
      return;
    }

    var a = e.target.closest && e.target.closest('.g-item');
    if (!a || !a.getAttribute('href')) return;
    e.preventDefault();
    var g = a.closest('.gallery') || document;
    var items = itemsIn(g);
    var i = items.indexOf(a);
    openAt(items, i < 0 ? 0 : i);
  });
})();
