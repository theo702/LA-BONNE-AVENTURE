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
  var lb, lbImg, lbCap, lbCount, list = [], idx = 0;
  var swipe = { active: false, x0: 0, y0: 0, dx: 0, dy: 0, t0: 0, locked: '', lastTap: 0 };

  function build() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.innerHTML = '<button class="lb-x" aria-label="Fermer">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Précédent">&#8249;</button>' +
      '<button class="lb-nav lb-next" aria-label="Suivant">&#8250;</button>' +
      '<img alt="" draggable="false"><div class="lb-cap"></div><div class="lb-count" aria-live="polite"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img');
    lbCap = lb.querySelector('.lb-cap');
    lbCount = lb.querySelector('.lb-count');
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    // Ancien Safari iOS : bloque le pinch/double-tap zoom natif sur la visionneuse
    lb.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    lb.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    bindSwipe(lb);
  }

  function bindSwipe(el) {
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
  }

  function onTouchStart(e) {
    if (!lb.classList.contains('open') || !e.touches || e.touches.length !== 1) return;
    if (e.target.closest && e.target.closest('button')) return;
    var now = Date.now();
    // Empêche le zoom navigateur au double-tap
    if (now - swipe.lastTap < 320) {
      e.preventDefault();
      swipe.lastTap = 0;
      swipe.active = false;
      return;
    }
    swipe.lastTap = now;
    var t = e.touches[0];
    swipe.active = true;
    swipe.x0 = t.clientX;
    swipe.y0 = t.clientY;
    swipe.dx = 0;
    swipe.dy = 0;
    swipe.t0 = now;
    swipe.locked = '';
    lbImg.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!swipe.active) return;
    var t = e.touches[0];
    swipe.dx = t.clientX - swipe.x0;
    swipe.dy = t.clientY - swipe.y0;
    if (!swipe.locked) {
      if (Math.abs(swipe.dx) > 8 || Math.abs(swipe.dy) > 8) {
        swipe.locked = Math.abs(swipe.dx) > Math.abs(swipe.dy) ? 'x' : 'y';
      }
    }
    if (swipe.locked === 'x') {
      e.preventDefault();
      var w = window.innerWidth || 1;
      var resist = swipe.dx * (1 - Math.min(0.55, Math.abs(swipe.dx) / w));
      lbImg.style.transform = 'translateX(' + resist + 'px)';
      lbImg.style.opacity = String(Math.max(0.45, 1 - Math.abs(swipe.dx) / (w * 1.2)));
    }
  }

  function onTouchEnd(e) {
    if (!swipe.active) return;
    var dx = swipe.dx;
    var dy = swipe.dy;
    var dt = Math.max(1, Date.now() - swipe.t0);
    var vx = Math.abs(dx) / dt;
    var horizontal = swipe.locked === 'x' || (swipe.locked === '' && Math.abs(dx) > Math.abs(dy));
    var moved = Math.abs(dx) > 10 || Math.abs(dy) > 10;
    swipe.active = false;
    swipe.locked = '';
    lbImg.style.transition = 'transform .28s ease, opacity .28s ease';
    lbImg.style.transform = '';
    lbImg.style.opacity = '';

    // Tap simple / double : ne laisse pas le navigateur zoomer
    if (!moved && e.cancelable) e.preventDefault();

    if (!horizontal || list.length < 2 || !moved) return;
    var threshold = Math.min(72, (window.innerWidth || 320) * 0.18);
    if (dx <= -threshold || (dx < -28 && vx > 0.45)) step(1);
    else if (dx >= threshold || (dx > 28 && vx > 0.45)) step(-1);
  }

  function onTouchCancel() {
    if (!swipe.active) return;
    swipe.active = false;
    swipe.locked = '';
    lbImg.style.transition = 'transform .22s ease, opacity .22s ease';
    lbImg.style.transform = '';
    lbImg.style.opacity = '';
  }

  function show() {
    var a = list[idx];
    if (!a) return;
    lbImg.style.transition = '';
    lbImg.style.transform = '';
    lbImg.style.opacity = '';
    lbImg.src = a.getAttribute('href');
    lbCap.textContent = a.getAttribute('data-lb') || '';
    if (lbCount) lbCount.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    lb.querySelector('.lb-prev').style.visibility = list.length > 1 ? 'visible' : 'hidden';
    lb.querySelector('.lb-next').style.visibility = list.length > 1 ? 'visible' : 'hidden';
  }

  function step(d) { idx = (idx + d + list.length) % list.length; show(); }

  function close() {
    lb.classList.remove('open');
    document.documentElement.style.overflow = '';
    if (lbImg) {
      lbImg.style.transition = '';
      lbImg.style.transform = '';
      lbImg.style.opacity = '';
    }
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
