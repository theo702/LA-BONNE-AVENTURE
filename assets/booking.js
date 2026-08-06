/* La Bonne Aventure — widget de réservation directe (vanilla JS, sans dépendance) */
(function () {
  'use strict';

  var MOUNT = document.getElementById('booking-widget');
  if (!MOUNT) return;

  var API = (MOUNT.getAttribute('data-api') || '').replace(/\/$/, ''); // même origine par défaut
  function T(key, vars){
    try{ if(window.LBA_I18N && window.LBA_I18N.t) return window.LBA_I18N.t(key, vars); }catch(e){}
    return key;
  }
  function months(){
    var raw = T('bw.months');
    if(raw && raw.indexOf(',')>0) return raw.split(',');
    return ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  }
  function dow(){
    var raw = T('bw.dow');
    if(raw && raw.indexOf(',')>0) return raw.split(',');
    return ['L','M','M','J','V','S','D'];
  }
  var MONTHS = months();
  var DOW = dow();

  // ---- utilitaires de dates (UTC, chaînes 'YYYY-MM-DD') ----
  function pad(n){ return (n<10?'0':'')+n; }
  function ymd(d){ return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()); }
  function parse(s){ var p=s.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); }
  function addDays(d,n){ var x=new Date(d.getTime()); x.setUTCDate(x.getUTCDate()+n); return x; }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function nights(a,b){ return Math.round((parse(b)-parse(a))/86400000); }
  function fmtLong(s){ var d=parse(s); return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()].slice(0,4)+'.'; }
  function euros(cents,cur){ try{ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:(cur||'eur')}).format((cents||0)/100);}catch(e){ return ((cents||0)/100).toFixed(2)+' €'; } }

  // ---- état ----
  var state = {
    cfg: null,
    blockedNights: new Set(),   // 'YYYY-MM-DD' de chaque nuit occupée
    view: null,                 // Date (1er du mois affiché)
    checkin: null,
    checkout: null,
    quote: null,
    promo: '',
    promoError: '',
    form: { name: '', email: '', phone: '' },
    submitting: false,
  };

  function buildBlockedSet(ranges){
    var set = new Set();
    (ranges||[]).forEach(function(r){
      if(!r.from || !r.to) return;
      var d = parse(r.from), end = parse(r.to), guard=0;
      while(d < end && guard < 800){ set.add(ymd(d)); d = addDays(d,1); guard++; }
    });
    return set;
  }

  // Une nuit est-elle réservable ? (ni passée, ni occupée)
  function isFreeNight(s){ return s >= todayStr() && !state.blockedNights.has(s); }


  // Toutes les nuits de [a,b) sont-elles libres ?
  function rangeFree(a,b){
    var d = parse(a), end = parse(b), guard=0;
    while(d < end && guard < 800){ if(state.blockedNights.has(ymd(d))) return false; d=addDays(d,1); guard++; }
    return true;
  }

  // ---- rendu ----
  function el(html){ var t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

  function skeleton(msg){
    MOUNT.innerHTML = '<div class="bw"><div class="bw-skeleton"><div class="bw-spin"></div>'+(msg||'Chargement du calendrier…')+'</div></div>';
  }

  function banner(){
    var q = new URLSearchParams(location.search).get('reservation');
    if(q==='confirmee') return '<div class="bw-banner ok">'+icon('check')+'Merci ! Votre réservation est confirmée — un email vient de vous être envoyé.</div>';
    if(q==='annulee') return '<div class="bw-banner warn">'+icon('info')+'Paiement annulé — vos dates n’ont pas été réservées. Vous pouvez réessayer.</div>';
    return '';
  }

  function icon(name){
    var p = {
      prev:'<path d="M15 18l-6-6 6-6"/>', next:'<path d="M9 6l6 6-6 6"/>',
      check:'<path d="M20 6L9 17l-5-5"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
      lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
      arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(p[name]||'')+'</svg>';
  }

  function render(){
    MONTHS = months(); DOW = dow();
    var wrap = document.createElement('div');
    wrap.className = 'bw';
    wrap.innerHTML = banner();

    // calendrier
    var v = state.view;
    var y = v.getUTCFullYear(), m = v.getUTCMonth();
    var firstStr = todayStr().slice(0,8)+'01';
    var atMinMonth = (y+'-'+pad(m+1)) <= firstStr.slice(0,7);

    var head = el('<div class="bw-cal-head"><div class="bw-cal-title">'+MONTHS[m]+' '+y+'</div>'+
      '<div class="bw-nav"><button data-nav="-1" '+(atMinMonth?'disabled':'')+' aria-label="'+T('bw.prevMonth')+'">'+icon('prev')+'</button>'+
      '<button data-nav="1" aria-label="'+T('bw.nextMonth')+'">'+icon('next')+'</button></div></div>');
    wrap.appendChild(head);

    var dow = '<div class="bw-dow">'; DOW.forEach(function(d){ dow+='<span>'+d+'</span>'; }); dow+='</div>';
    wrap.appendChild(el(dow));

    var grid = document.createElement('div'); grid.className='bw-grid';
    var first = new Date(Date.UTC(y,m,1));
    var lead = (first.getUTCDay()+6)%7; // lundi = 0
    for(var i=0;i<lead;i++){ grid.appendChild(el('<div class="bw-cell empty"></div>')); }
    var daysInMonth = new Date(Date.UTC(y,m+1,0)).getUTCDate();
    for(var day=1; day<=daysInMonth; day++){
      var ds = y+'-'+pad(m+1)+'-'+pad(day);
      grid.appendChild(dayCell(ds, day));
    }
    wrap.appendChild(grid);

    wrap.appendChild(el('<div class="bw-legend">'+
      '<span><i class="free"></i>'+T('bw.free')+'</span><span><i class="sel"></i>'+T('bw.sel')+'</span><span><i class="busy"></i>'+T('bw.busy')+'</span></div>'));

    // récapitulatif + formulaire
    wrap.appendChild(summaryNode());

    MOUNT.innerHTML = '';
    MOUNT.appendChild(wrap);
    bind();
  }

  function dayCell(ds, day){
    var past = ds < todayStr();
    var blockedNight = state.blockedNights.has(ds);
    var choosingArrival = (!state.checkin || state.checkout); // phase 1 si rien / si séjour déjà complet
    var cls = 'bw-cell';
    var selectable = false;

    if(past){
      cls += ' past';
    } else if(choosingArrival){
      // phase 1 : choisir l'arrivée → toute nuit libre
      selectable = !blockedNight;
    } else {
      // phase 2 : arrivée posée, on choisit le départ (ou on recommence)
      if(ds === state.checkin) selectable = true;                          // recliquer
      else if(ds > state.checkin && rangeFree(state.checkin, ds)) selectable = true; // départ valide
      else if(ds < state.checkin && !blockedNight) selectable = true;      // nouvelle arrivée plus tôt
    }

    if(blockedNight) cls += ' blocked';
    if(selectable && !blockedNight) cls += ' selectable';

    // surlignage de la sélection
    if(state.checkin && state.checkout){
      if(ds === state.checkin || ds === state.checkout){ cls += ' end-start ' + (ds === state.checkin ? 'start' : 'end'); }
      else if(ds > state.checkin && ds < state.checkout){ cls += ' in-range'; }
    } else if(state.checkin && ds === state.checkin){
      cls += ' end-start single';
    }

    return el('<button class="'+cls+'" data-day="'+ds+'"><span class="bw-daynum">'+day+'</span></button>');
  }

  function summaryNode(){
    var s = document.createElement('div');
    var ci = state.checkin, co = state.checkout;
    var q = state.quote;
    var box = '<div class="bw-summary"><div class="bw-dates">'+
      '<div class="bw-date-box"><div class="lab">'+T('bw.arrival')+'</div><div class="val'+(ci?'':' empty')+'">'+(ci?fmtLong(ci):'—')+'</div></div>'+
      '<div class="bw-arrow">'+icon('arrow')+'</div>'+
      '<div class="bw-date-box"><div class="lab">'+T('bw.departure')+'</div><div class="val'+(co?'':' empty')+'">'+(co?fmtLong(co):'—')+'</div></div></div>';

    if(q && q.ok && q.lines){
      q.lines.forEach(function(l){
        var neg = l.cents < 0;
        box += '<div class="bw-line'+(neg?' discount':'')+'"><span>'+l.label+'</span><b>'+(neg?'−':'')+euros(Math.abs(l.cents),q.currency)+'</b></div>';
      });
      box += '<div class="bw-total"><span class="t">'+T('bw.total')+'</span><span class="v">'+euros(q.totalCents,q.currency)+'</span></div>';
      if(q.cautionCents && q.cautionCents > 0){
        box += '<div class="bw-caution">'+icon('lock')+'<span>'+T('bw.caution',{amount:euros(q.cautionCents,q.currency)})+'</span></div>';
      }
    } else {
      var hint = 'Sélectionnez vos dates (min. '+(state.cfg?state.cfg.minNights:2)+' nuits).';
      if(q && !q.ok) hint = q.message || hint;
      box += '<div class="bw-line" style="justify-content:center;color:var(--ink-soft)">'+hint+'</div>';
    }

    // code promo + formulaire (visibles quand un devis valide existe)
    if(q && q.ok){
      box += '<div class="bw-promo"><input id="bwPromo" type="text" placeholder="'+T('bw.promo')+'" value="'+(state.promo||'')+'"><button type="button" id="bwPromoBtn">'+T('bw.apply')+'</button></div>';
      if(state.promoError) box += '<div class="bw-promo-err">'+state.promoError+'</div>';

      var f = state.form || {};
      var maxG = state.cfg ? state.cfg.maxGuests : 2;
      var opts=''; for(var g=1; g<=maxG; g++){ opts += '<option value="'+g+'"'+(g===q.guests?' selected':'')+'>'+g+'</option>'; }
      box += '<div class="bw-form">'+
        '<div class="bw-field"><label>'+T('bw.name')+'</label><input id="bwName" type="text" value="'+esc(f.name)+'" placeholder="Camille Dupont" autocomplete="name"></div>'+
        '<div class="bw-row2">'+
          '<div class="bw-field"><label>'+T('bw.email')+'</label><input id="bwEmail" type="email" value="'+esc(f.email)+'" placeholder="vous@email.com" autocomplete="email"></div>'+
          '<div class="bw-field"><label>'+T('bw.phone')+'</label><input id="bwPhone" type="tel" value="'+esc(f.phone)+'" placeholder="06 12 34 56 78" autocomplete="tel"></div>'+
        '</div>'+
        '<div class="bw-field"><label>'+T('bw.guests')+'</label><select id="bwGuests">'+opts+'</select></div>'+
        '<button class="bw-pay" id="bwPay"'+(state.submitting?' disabled':'')+'>'+icon('card')+(state.submitting?T('bw.redirect'):(T('bw.pay')+' '+euros(q.totalCents,q.currency)))+'</button>'+
        '<div class="bw-err" id="bwErr"></div>'+
        '<div class="bw-secure">'+icon('lock')+T('bw.secure')+'</div>'+
      '</div>';
    }

    box += '</div>';
    s.appendChild(el(box));
    return s.firstChild;
  }

  function esc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // ---- interactions ----
  function bind(){
    MOUNT.querySelectorAll('[data-nav]').forEach(function(b){
      b.addEventListener('click', function(){ shiftMonth(parseInt(b.getAttribute('data-nav'),10)); });
    });
    MOUNT.querySelectorAll('.bw-cell.selectable').forEach(function(c){
      c.addEventListener('click', function(){ pickDay(c.getAttribute('data-day')); });
    });
    var guests = document.getElementById('bwGuests');
    if(guests) guests.addEventListener('change', function(){ refreshQuote(); });
    var pay = document.getElementById('bwPay');
    if(pay) pay.addEventListener('click', pay_);

    var promoBtn = document.getElementById('bwPromoBtn');
    if(promoBtn) promoBtn.addEventListener('click', function(){
      var inp = document.getElementById('bwPromo');
      state.promo = (inp ? inp.value : '').trim();
      state.promoError = '';
      refreshQuote();
    });
    // conserver la saisie du formulaire entre deux rendus
    [['bwName','name'],['bwEmail','email'],['bwPhone','phone']].forEach(function(p){
      var e = document.getElementById(p[0]);
      if(e) e.addEventListener('input', function(){ state.form[p[1]] = e.value; });
    });
    var promoInp = document.getElementById('bwPromo');
    if(promoInp) promoInp.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); if(promoBtn) promoBtn.click(); } });
  }

  function shiftMonth(delta){
    var v = state.view;
    state.view = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth()+delta, 1));
    render();
  }

  function pickDay(ds){
    if(!state.checkin || state.checkout){
      // (re)commencer : arrivée
      state.checkin = ds; state.checkout = null; state.quote = null;
      render();
    } else {
      if(ds <= state.checkin){ state.checkin = ds; state.checkout = null; state.quote=null; render(); return; }
      if(!rangeFree(state.checkin, ds)){ return; }
      state.checkout = ds;
      refreshQuote();
    }
  }

  function refreshQuote(){
    if(!state.checkin || !state.checkout){ render(); return; }
    var guestsSel = document.getElementById('bwGuests');
    var guests = guestsSel ? parseInt(guestsSel.value,10) : ((state.quote && state.quote.guests) || 1);
    var cfg = state.cfg;

    // estimation locale immédiate (tarif par durée, sans remises ni taxe — corrigée par le serveur)
    var n = nights(state.checkin, state.checkout);
    if(n < cfg.minNights){
      state.quote = { ok:false, message:'Séjour minimum de '+cfg.minNights+' nuits.' };
    } else {
      var rate = cfg.nightlyCents, tag = null;
      if(cfg.monthlyMinNights && n >= cfg.monthlyMinNights && cfg.cureTotalCents){ rate = cfg.cureTotalCents/cfg.monthlyMinNights; tag = 'tarif cure'; }
      else if(cfg.weeklyMinNights && n >= cfg.weeklyMinNights && cfg.weekTotalCents){ rate = cfg.weekTotalCents/cfg.weeklyMinNights; tag = 'tarif semaine'; }
      var lodging = Math.round(n*rate);
      var label = tag ? (n+' nuits · '+tag) : (Math.round(rate/100)+' € × '+n+' nuits');
      state.quote = { ok:true, guests:guests, currency:cfg.currency, totalCents:lodging,
        lines:[ {label:label, cents:lodging} ] };
    }
    render();

    // devis serveur : remises, taxe de séjour, code promo, disponibilité
    fetch(API+'/api/quote', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ checkin:state.checkin, checkout:state.checkout, guests:guests, promo:state.promo||'' }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok){ state.promoError=''; state.quote=j; render(); }
        else if(j && j.error==='promo'){ state.promoError=j.message||'Code promo invalide.'; state.promo=''; render(); refreshQuote(); }
        else if(j){ state.quote=j; render(); }
      }).catch(function(){ /* on garde l'estimation locale */ });
  }

  function pay_(){
    var name = (document.getElementById('bwName')||{}).value || '';
    var email = (document.getElementById('bwEmail')||{}).value || '';
    var phone = (document.getElementById('bwPhone')||{}).value || '';
    var guests = parseInt((document.getElementById('bwGuests')||{}).value,10) || 1;
    var err = document.getElementById('bwErr');
    err.textContent = '';

    if(!name.trim()){ err.textContent=T('bw.err.name'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){ err.textContent='Email invalide.'; return; }

    state.form = { name:name.trim(), email:email.trim(), phone:phone.trim() };
    state.submitting = true; render();

    fetch(API+'/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ checkin:state.checkin, checkout:state.checkout, guests:guests,
        name:name.trim(), email:email.trim(), phone:phone.trim(), promo:state.promo||'' }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j && j.ok && j.url){ window.location.href = j.url; return; }
        state.submitting = false; render();
        var e2 = document.getElementById('bwErr');
        if(e2) e2.textContent = (j && j.message) || 'Une erreur est survenue. Réessayez.';
      })
      .catch(function(){
        state.submitting = false; render();
        var e2 = document.getElementById('bwErr'); if(e2) e2.textContent='Connexion impossible. Réessayez.';
      });
  }

  function loadAvailability(){
    return fetch(API+'/api/availability')
      .then(function(r){ return r.json(); })
      .then(function(cfg){
        state.cfg = cfg;
        state.blockedNights = buildBlockedSet(cfg.blocked);
        state.view = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
        render();
        // Si on revient d'un paiement confirmé, amener l'utilisateur au bandeau vert.
        if(new URLSearchParams(location.search).get('reservation')==='confirmee'){
          try{ MOUNT.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
        }
      })
      .catch(function(){
        MOUNT.innerHTML = '<div class="bw"><div class="bw-skeleton">Le calendrier est momentanément indisponible.<br><small>Réessayez dans un instant, ou écrivez-nous sur WhatsApp.</small></div></div>';
      });
  }

  function showThankYou(b){
    var first = (b.guest_name || '').trim().split(' ')[0] || '';
    var html = '<div class="bw-modal" id="bwModal"><div class="bw-modal-card">'
      + '<button class="bw-modal-x" aria-label="Fermer">&times;</button>'
      + '<div class="bw-modal-check">'+icon('check')+'</div>'
      + '<h3>Merci'+(first ? ', '+esc(first) : '')+'&nbsp;!</h3>'
      + '<p class="bw-modal-sub">Votre réservation est confirmée 🌴</p>'
      + '<div class="bw-modal-recap">'
      +   '<div><span>Arrivée</span><b>'+fmtLong(b.checkin)+'</b></div>'
      +   '<div><span>Départ</span><b>'+fmtLong(b.checkout)+'</b></div>'
      +   '<div><span>Nuits</span><b>'+b.nights+'</b></div>'
      +   '<div><span>Total réglé</span><b>'+euros(b.amount_total_cents, b.currency)+'</b></div>'
      + '</div>'
      + '<p class="bw-modal-msg">Un email de confirmation vient de vous être envoyé'+(b.email ? ' à <b>'+esc(b.email)+'</b>' : '')+'. Je vous transmets le code de la boîte à clés la veille de votre arrivée. À très vite&nbsp;!</p>'
      + '<button class="bw-modal-close">Parfait, merci&nbsp;!</button>'
      + '</div></div>';
    var node = el(html);
    document.body.appendChild(node);
    function close(){
      try{ node.remove(); }catch(e){}
      try{ history.replaceState({}, '', location.pathname); }catch(e){}
    }
    node.querySelector('.bw-modal-x').addEventListener('click', close);
    node.querySelector('.bw-modal-close').addEventListener('click', close);
    node.addEventListener('click', function(e){ if(e.target === node) close(); });
  }

  // ---- démarrage ----
  function start(){
    skeleton();
    // Retour de paiement : on confirme la réservation (filet si le webhook n'a pas marché)
    // et on affiche un écran de remerciement.
    var sid = new URLSearchParams(location.search).get('session_id');
    if(sid){
      fetch(API+'/api/confirm?session_id='+encodeURIComponent(sid))
        .then(function(r){ return r.json(); })
        .catch(function(){ return null; })
        .then(function(j){
          loadAvailability();
          if(j && j.ok && j.booking){ showThankYou(j.booking); }
        });
    } else {
      loadAvailability();
    }
  }

  start();

  document.addEventListener('lba:lang', function () {
    try { render(); } catch (e) {}
  });
})();
