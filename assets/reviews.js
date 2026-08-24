/* Carrousel d'avis — 3 visibles sur desktop, 1 sur mobile, défilement auto. */
(function () {
  'use strict';

  var root = document.querySelector('[data-reviews]');
  if (!root) return;

  var track = root.querySelector('.reviews-track');
  var viewport = root.querySelector('.reviews-viewport');
  var dotsWrap = root.querySelector('.reviews-dots');
  var btnPrev = root.querySelector('.reviews-prev');
  var btnNext = root.querySelector('.reviews-next');
  if (!track || !viewport) return;

  var originals = Array.prototype.slice.call(track.querySelectorAll('.review'));
  var n = originals.length;
  if (n === 0) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia('(min-width: 760px)');
  var perView = 1;
  var index = 0;
  var INTERVAL = 4500;
  var timer = null;

  function visibleCount() {
    return mq.matches ? Math.min(3, n) : 1;
  }

  function maxIndex() {
    return Math.max(0, n - perView);
  }

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    var pages = maxIndex() + 1;
    if (pages <= 1) {
      dotsWrap.hidden = true;
      return;
    }
    dotsWrap.hidden = false;
    for (var i = 0; i < pages; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reviews-dot' + (i === index ? ' is-on' : '');
      b.setAttribute('aria-label', 'Avis ' + (i + 1) + ' sur ' + pages);
      b.setAttribute('aria-current', i === index ? 'true' : 'false');
      (function (page) {
        b.addEventListener('click', function () {
          go(page);
          restart();
        });
      })(i);
      dotsWrap.appendChild(b);
    }
  }

  function syncDots() {
    if (!dotsWrap) return;
    var dots = dotsWrap.querySelectorAll('.reviews-dot');
    for (var i = 0; i < dots.length; i++) {
      var on = i === index;
      dots[i].classList.toggle('is-on', on);
      dots[i].setAttribute('aria-current', on ? 'true' : 'false');
    }
  }

  function layout() {
    perView = visibleCount();
    var gap = mq.matches ? 28 : 0;
    var vw = viewport.clientWidth;
    var cardW = perView === 1 ? vw : (vw - gap * (perView - 1)) / perView;
    var slides = track.querySelectorAll('.review');
    for (var i = 0; i < slides.length; i++) {
      slides[i].style.flex = '0 0 ' + cardW + 'px';
      slides[i].style.width = cardW + 'px';
      slides[i].style.marginRight = (i < slides.length - 1 ? gap : 0) + 'px';
    }
    if (index > maxIndex()) index = maxIndex();
    buildDots();
    apply(false);
  }

  function apply(animate) {
    var gap = mq.matches ? 28 : 0;
    var vw = viewport.clientWidth;
    var cardW = perView === 1 ? vw : (vw - gap * (perView - 1)) / perView;
    var offset = index * (cardW + gap);
    track.style.transition = animate && !reduce ? 'transform .7s cubic-bezier(.22,.7,.2,1)' : 'none';
    track.style.transform = 'translate3d(' + (-offset) + 'px,0,0)';
    syncDots();
  }

  function go(i) {
    index = Math.max(0, Math.min(maxIndex(), i));
    apply(true);
  }

  function next() {
    if (maxIndex() === 0) return;
    go(index >= maxIndex() ? 0 : index + 1);
  }

  function prev() {
    if (maxIndex() === 0) return;
    go(index <= 0 ? maxIndex() : index - 1);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function start() {
    stop();
    if (reduce || maxIndex() === 0) return;
    timer = setInterval(next, INTERVAL);
  }

  function restart() {
    stop();
    start();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function currentSignatures() {
    var set = new Set();
    Array.prototype.slice.call(track.querySelectorAll('.review blockquote')).forEach(function (bq) {
      set.add(norm(bq.textContent));
    });
    return set;
  }

  function appendGoogleReviews(rows) {
    var existing = currentSignatures();
    var added = 0;
    (rows || []).forEach(function (r) {
      if (!r || !r.text || Number(r.rating || 0) < 5) return;
      var sig = norm(r.text);
      if (!sig || existing.has(sig)) return;
      existing.add(sig);

      var fig = document.createElement('figure');
      fig.className = 'review';
      fig.innerHTML =
        '<span class="quote-mark" aria-hidden="true">“</span>' +
        '<div class="rev-stars" aria-label="5 étoiles sur 5">★★★★★</div>' +
        '<blockquote>' + esc(r.text) + '</blockquote>' +
        '<figcaption><b>' + esc(r.author || 'Voyageur') + '</b><span>' + esc(r.relative_time || '') + '</span></figcaption>';
      track.appendChild(fig);
      added += 1;
    });
    return added;
  }

  function hydrateGoogleReviews() {
    return fetch('/api/reviews', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.reviews) || !j.reviews.length) return;
        var added = appendGoogleReviews(j.reviews);
        if (added > 0) {
          n = track.querySelectorAll('.review').length;
          layout();
          restart();
        }
      })
      .catch(function () { /* non bloquant */ });
  }

  if (btnNext) btnNext.addEventListener('click', function () { next(); restart(); });
  if (btnPrev) btnPrev.addEventListener('click', function () { prev(); restart(); });

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', function (e) {
    if (!root.contains(e.relatedTarget)) start();
  });

  // Swipe tactile
  var sx = 0, sy = 0, dragging = false;
  viewport.addEventListener('touchstart', function (e) {
    if (!e.touches[0]) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dragging = true;
    stop();
  }, { passive: true });
  viewport.addEventListener('touchend', function (e) {
    if (!dragging) return;
    dragging = false;
    var t = e.changedTouches[0];
    if (!t) { start(); return; }
    var dx = t.clientX - sx;
    var dy = t.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
    start();
  }, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
  if (mq.addEventListener) mq.addEventListener('change', layout);
  else if (mq.addListener) mq.addListener(layout);

  // Quand le bloc devient visible, relancer le layout (après reveal)
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { layout(); start(); }
        else stop();
      });
    }, { threshold: 0.25 });
    io.observe(root);
  }

  layout();
  start();
  hydrateGoogleReviews();
})();
