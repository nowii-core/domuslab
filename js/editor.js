/* DomusLab — editor di livelli con codici di condivisione (DL1:…) */
(function () {
  'use strict';
  var A = window.DomusApp, E = A.E, $ = function (id) { return document.getElementById(id); };
  var SAVE = A.SAVE;
  var MAXW = 14, MAXH = 14;
  var TILE_RE = /^[.o#LGC1-9rbyRBY]+$/;
  var ALLOWED_ALL = ['F', 'L', 'R', 'A', 'REP', 'WHILE', 'IF', 'CALL'];
  var OPT_BLOCKS = [['A', 'Accendi'], ['REP', 'Ripeti'], ['WHILE', 'Finché'], ['IF', 'Se'], ['CALL', 'F1']];
  var TRAPS = [{ p: 3, on: 1, ph: 0 }, { p: 3, on: 1, ph: 1 }, { p: 3, on: 1, ph: 2 }, { p: 2, on: 1, ph: 0 }, { p: 2, on: 1, ph: 1 }, { p: 4, on: 2, ph: 0 }, { p: 4, on: 2, ph: 2 }];
  var TOOLS = [
    ['floor', '⬜', 'Pavimento'], ['void', '⬛', 'Vuoto (si cade)'], ['wall', '🧱', 'Muro'], ['start', '🤖', 'Partenza (tocca ancora per girare)'],
    ['goal', '🏁', 'Centralina (traguardo)'], ['lamp', '💡', 'Lampada'], ['coin', '🪙', 'Moneta'],
    ['key-r', '🔴', 'Chiave rossa'], ['key-b', '🔵', 'Chiave blu'], ['key-y', '🟡', 'Chiave gialla'],
    ['door-R', '🟥', 'Porta rossa'], ['door-B', '🟦', 'Porta blu'], ['door-Y', '🟨', 'Porta gialla'],
    ['portal', '🌀', 'Portali (due click = una coppia)'], ['trap', '⚡', 'Trappola (tocca per cambiare ritmo)'],
    ['mover', '👾', 'Sentinella (due caselle vicine)'], ['erase', '🧽', 'Gomma']
  ];
  var ARROWS = ['▲', '▶', '▼', '◀'];

  var ED = null, tool = 'floor', pendingPortal = null, pendingMover = null, moverPh = 0, painting = false, previewStage = null, sched = 0;

  function blank(w, h) {
    var cells = [];
    for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push('o'); cells.push(r); }
    cells[h - 1][w - 1] = 'G';
    return { name: '', w: w, h: h, cells: cells, start: [0, 0, 2], hazards: [], movers: [], limit: 12, allowed: ['F', 'L', 'R'], world: 1, solution: null, par: 0, sig: '' };
  }
  function ch(x, y) { return ED.cells[y][x]; }
  function passableFloor(x, y) { return x >= 0 && y >= 0 && x < ED.w && y < ED.h && ch(x, y) === 'o'; }
  function rowsOf() { return ED.cells.map(function (r) { return r.join(''); }); }
  function buildLevel(withSol) {
    var lv = {
      id: 0, world: ED.world, name: ED.name || 'Il mio livello', rows: rowsOf(), start: ED.start.slice(),
      allowed: ALLOWED_ALL.filter(function (t) { return ED.allowed.indexOf(t) >= 0 || t === 'F' || t === 'L' || t === 'R'; }),
      limit: ED.limit, par: ED.limit,
      hazards: ED.hazards.map(function (h) { return { x: h.x, y: h.y, p: h.p, on: h.on, ph: h.ph }; }),
      movers: ED.movers.map(function (m) { return { a: m.a.slice(), b: m.b.slice(), ph: m.ph }; }),
      solution: { main: [], f1: [] }
    };
    if (!lv.hazards.length) delete lv.hazards; if (!lv.movers.length) delete lv.movers;
    if (withSol && ED.solution) { lv.solution = ED.solution; lv.par = ED.par; }
    return lv;
  }
  function signature() { return JSON.stringify([rowsOf(), ED.start, ED.hazards, ED.movers, ED.limit, ED.allowed.slice().sort(), ED.world]); }

  /* ---------- verifica ---------- */
  function problems() {
    var P = E.prepare(buildLevel()), out = [];
    if (!P.goal) out.push('Manca la centralina 🏁.');
    var s = ED.start, c = ch(s[0], s[1]);
    if (c === '.' || c === '#') out.push('La partenza 🤖 deve stare su una casella libera.');
    var cnt = {};
    ED.cells.forEach(function (r) { r.forEach(function (v) { if (v >= '1' && v <= '9') cnt[v] = (cnt[v] || 0) + 1; }); });
    for (var k in cnt) if (cnt[k] !== 2) out.push('Il portale ' + k + ' ha bisogno di una coppia.');
    if (pendingMover) out.push('Completa la sentinella: scegli la seconda casella.');
    return out;
  }
  function refreshStatus() {
    var p = problems(), st = $('ed-status'), sig = signature();
    var ver = ED.solution && ED.sig === sig;
    if (p.length) { st.className = 'ed-status bad'; st.innerHTML = p.join('<br>'); }
    else if (ver) { st.className = 'ed-status good'; st.innerHTML = '✅ Livello risolto con ' + ED.par + ' cubi. Puoi condividerlo!'; }
    else { st.className = 'ed-status'; st.innerHTML = 'Ora premi <b>Prova e risolvi</b>: devi vincerlo tu per poterlo condividere.'; }
    $('ed-test').disabled = p.length > 0;
    $('ed-share').disabled = !ver;
  }

  /* ---------- griglia ---------- */
  function hazardAt(x, y) { for (var i = 0; i < ED.hazards.length; i++) if (ED.hazards[i].x === x && ED.hazards[i].y === y) return i; return -1; }
  function moverAt(x, y) { for (var i = 0; i < ED.movers.length; i++) { var m = ED.movers[i]; if ((m.a[0] === x && m.a[1] === y) || (m.b[0] === x && m.b[1] === y)) return i; } return -1; }
  var GLYPH = { '#': '🧱', L: '💡', G: '🏁', C: '🪙', r: '🔴', b: '🔵', y: '🟡', R: '🟥', B: '🟦', Y: '🟨' };

  function renderGrid() {
    var g = $('ed-grid'); g.innerHTML = '';
    g.style.gridTemplateColumns = 'repeat(' + ED.w + ',var(--cs))';
    for (var y = 0; y < ED.h; y++) for (var x = 0; x < ED.w; x++) {
      var c = ch(x, y), el = document.createElement('div'), t = '';
      el.className = 'ed-cell' + (c === '.' ? ' void' : '') + (c === '#' ? ' wall' : '');
      el.dataset.x = x; el.dataset.y = y;
      if (GLYPH[c]) t = GLYPH[c]; else if (c >= '1' && c <= '9') t = '🌀<sub>' + c + '</sub>';
      var hi = hazardAt(x, y);
      if (hi >= 0) { var h = ED.hazards[hi]; t += '<span class="ed-tag trap">⚡' + h.on + '/' + h.p + (h.ph ? '+' + h.ph : '') + '</span>'; }
      var mi = moverAt(x, y);
      if (mi >= 0) { var m = ED.movers[mi]; t += '<span class="ed-tag mv">' + (m.a[0] === x && m.a[1] === y ? '👾' : '◌') + '</span>'; }
      if (pendingMover && pendingMover.x === x && pendingMover.y === y) el.classList.add('pend');
      if (ED.start[0] === x && ED.start[1] === y) t += '<span class="ed-tag st">🤖' + ARROWS[ED.start[2]] + '</span>';
      el.innerHTML = t;
      g.appendChild(el);
    }
    var cs = Math.max(26, Math.min(44, Math.floor(Math.min(520, (window.innerWidth - 60)) / ED.w)));
    g.style.setProperty('--cs', cs + 'px');
    $('ed-w').value = ED.w; $('ed-h').value = ED.h;
    refreshStatus();
    schedulePreview();
  }
  function schedulePreview() {
    if (sched) return;
    sched = requestAnimationFrame(function () {
      sched = 0;
      if (!previewStage) return;
      try { previewStage.setLevel(buildLevel(), ED.world); previewStage.setSkin(window.DomusGame.stage.skin); previewStage.resize(); } catch (e) {}
    });
  }

  /* ---------- modifica ---------- */
  function clearObjs(x, y) {
    var hi = hazardAt(x, y); if (hi >= 0) ED.hazards.splice(hi, 1);
    var mi = moverAt(x, y); if (mi >= 0) ED.movers.splice(mi, 1);
    if (pendingMover && pendingMover.x === x && pendingMover.y === y) pendingMover = null;
  }
  function removePortalPair(d) {
    for (var y = 0; y < ED.h; y++) for (var x = 0; x < ED.w; x++) if (ch(x, y) === d) ED.cells[y][x] = 'o';
    if (pendingPortal === d) pendingPortal = null;
  }
  function setTile(x, y, v) {
    var old = ch(x, y);
    if (old >= '1' && old <= '9' && v !== old) { removePortalPair(old); }
    if (old === 'G' && v !== 'G') { /* ok */ }
    ED.cells[y][x] = v;
    if (v === '.' || v === '#') { clearObjs(x, y); if (ED.start[0] === x && ED.start[1] === y) { /* la partenza resta ma segnalata */ } }
    else if (v !== 'o') clearObjs(x, y);
  }
  function apply(x, y, first) {
    var c = ch(x, y);
    switch (tool) {
      case 'floor': if (c !== 'o') setTile(x, y, 'o'); break;
      case 'void': if (c !== '.') setTile(x, y, '.'); break;
      case 'wall': if (c !== '#') setTile(x, y, '#'); break;
      case 'erase': if (c !== '.') setTile(x, y, '.'); break;
      default: if (!first) return;
    }
    if (!first) return;
    var s;
    switch (tool) {
      case 'start':
        if (c === '.' || c === '#') break;
        if (ED.start[0] === x && ED.start[1] === y) ED.start[2] = (ED.start[2] + 1) % 4; else ED.start = [x, y, ED.start[2]];
        break;
      case 'goal':
        for (var yy = 0; yy < ED.h; yy++) for (var xx = 0; xx < ED.w; xx++) if (ch(xx, yy) === 'G') ED.cells[yy][xx] = 'o';
        setTile(x, y, 'G'); break;
      case 'lamp': setTile(x, y, c === 'L' ? 'o' : 'L'); break;
      case 'coin': setTile(x, y, c === 'C' ? 'o' : 'C'); break;
      case 'key-r': case 'key-b': case 'key-y': s = tool.charAt(4); setTile(x, y, c === s ? 'o' : s); break;
      case 'door-R': case 'door-B': case 'door-Y': s = tool.charAt(5); setTile(x, y, c === s ? 'o' : s); break;
      case 'portal':
        if (c >= '1' && c <= '9') { removePortalPair(c); break; }
        if (c === '.' || c === '#') break;
        if (pendingPortal) { setTile(x, y, pendingPortal); pendingPortal = null; }
        else {
          var used = {}; ED.cells.forEach(function (r) { r.forEach(function (v) { if (v >= '1' && v <= '9') used[v] = 1; }); });
          var d = null; for (var n = 1; n <= 9; n++) if (!used[n]) { d = String(n); break; }
          if (!d) { A.toast('Massimo 9 coppie di portali.', 'bad'); break; }
          setTile(x, y, d); pendingPortal = d;
        }
        break;
      case 'trap':
        if (c !== 'o') { A.toast('Le trappole stanno su un pavimento libero.', 'bad'); break; }
        var hi = hazardAt(x, y);
        if (hi < 0) { if (moverAt(x, y) < 0) ED.hazards.push({ x: x, y: y, p: TRAPS[0].p, on: TRAPS[0].on, ph: TRAPS[0].ph }); }
        else {
          var h = ED.hazards[hi], idx = -1;
          for (var i = 0; i < TRAPS.length; i++) if (TRAPS[i].p === h.p && TRAPS[i].on === h.on && TRAPS[i].ph === h.ph) idx = i;
          if (idx + 1 >= TRAPS.length) ED.hazards.splice(hi, 1); else { h.p = TRAPS[idx + 1].p; h.on = TRAPS[idx + 1].on; h.ph = TRAPS[idx + 1].ph; }
        }
        break;
      case 'mover':
        var mi = moverAt(x, y);
        if (mi >= 0) { ED.movers.splice(mi, 1); break; }
        if (c !== 'o' || hazardAt(x, y) >= 0) { A.toast('Le sentinelle stanno su pavimento libero.', 'bad'); break; }
        if (!pendingMover) { pendingMover = { x: x, y: y }; A.toast('Ora tocca la casella vicina dove la sentinella tornerà indietro.', '', 2800); }
        else {
          var dist = Math.abs(pendingMover.x - x) + Math.abs(pendingMover.y - y);
          if (dist !== 1) { A.toast('La seconda casella deve essere accanto alla prima.', 'bad'); break; }
          ED.movers.push({ a: [pendingMover.x, pendingMover.y], b: [x, y], ph: moverPh }); moverPh = 1 - moverPh; pendingMover = null;
        }
        break;
    }
  }
  var lastCell = null;
  function cellFrom(e) { var el = document.elementFromPoint(e.clientX, e.clientY); el = el && el.closest && el.closest('.ed-cell'); return el; }
  $('ed-grid').addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.ed-cell'); if (!el) return;
    painting = true; lastCell = el; e.preventDefault();
    try { $('ed-grid').setPointerCapture(e.pointerId); } catch (x) {}
    apply(+el.dataset.x, +el.dataset.y, true); renderGrid();
  });
  $('ed-grid').addEventListener('pointermove', function (e) {
    if (!painting) return;
    var el = cellFrom(e); if (!el || el === lastCell) return; lastCell = el;
    apply(+el.dataset.x, +el.dataset.y, false); renderGrid();
  });
  window.addEventListener('pointerup', function () { painting = false; lastCell = null; });

  /* ---------- UI: strumenti e opzioni ---------- */
  function buildTools() {
    var t = $('ed-tools'); t.innerHTML = '';
    TOOLS.forEach(function (d) {
      var b = document.createElement('button'); b.className = 'ed-tool' + (d[0] === tool ? ' on' : ''); b.title = d[2]; b.textContent = d[1]; b.dataset.tool = d[0];
      b.addEventListener('click', function () { tool = d[0]; pendingPortal = pendingPortal && tool === 'portal' ? pendingPortal : null; if (tool !== 'mover') pendingMover = null; buildTools(); renderGrid(); A.toast(d[2], '', 1400); });
      t.appendChild(b);
    });
  }
  function buildOpts() {
    var al = $('ed-allowed'); al.innerHTML = '<span class="muted">Cubi disponibili:</span> <span class="al-fix">Avanti · Gira sx · Gira dx</span>';
    OPT_BLOCKS.forEach(function (o) {
      var l = document.createElement('label'); l.className = 'al-opt';
      l.innerHTML = '<input type="checkbox" ' + (ED.allowed.indexOf(o[0]) >= 0 ? 'checked' : '') + '> ' + o[1];
      l.querySelector('input').addEventListener('change', function (e) {
        var i = ED.allowed.indexOf(o[0]);
        if (e.target.checked && i < 0) ED.allowed.push(o[0]); else if (!e.target.checked && i >= 0) ED.allowed.splice(i, 1);
        refreshStatus();
      });
      al.appendChild(l);
    });
    var sel = $('ed-theme'); sel.innerHTML = '';
    for (var w = 1; w <= 21; w++) { var th = A.theme(w), o = document.createElement('option'); o.value = w; o.textContent = th.icon + ' ' + th.title; sel.appendChild(o); }
    sel.value = ED.world; $('ed-name').value = ED.name; $('ed-limit').value = ED.limit;
  }
  $('ed-theme').addEventListener('change', function (e) { ED.world = +e.target.value; renderGrid(); });
  $('ed-name').addEventListener('input', function (e) { ED.name = e.target.value; });
  $('ed-limit').addEventListener('change', function (e) { ED.limit = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 12)); e.target.value = ED.limit; refreshStatus(); });
  function resize() {
    var w = Math.max(3, Math.min(MAXW, parseInt($('ed-w').value, 10) || ED.w)), h = Math.max(3, Math.min(MAXH, parseInt($('ed-h').value, 10) || ED.h));
    var cells = [];
    for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push(y < ED.h && x < ED.w ? ED.cells[y][x] : '.'); cells.push(r); }
    ED.cells = cells; ED.w = w; ED.h = h;
    ED.hazards = ED.hazards.filter(function (q) { return q.x < w && q.y < h; });
    ED.movers = ED.movers.filter(function (q) { return q.a[0] < w && q.a[1] < h && q.b[0] < w && q.b[1] < h; });
    if (ED.start[0] >= w || ED.start[1] >= h) ED.start = [0, 0, ED.start[2]];
    pendingMover = null; pendingPortal = null;
    renderGrid();
  }
  $('ed-w').addEventListener('change', resize); $('ed-h').addEventListener('change', resize);

  function openEditor() {
    if (!ED) ED = blank(8, 8);
    buildTools(); buildOpts(); A.openOv('ov-editor'); renderGrid();
    if (!previewStage) { previewStage = new window.DomusStage($('ed-canvas')); }
    previewStage.paused = false;
    requestAnimationFrame(function () { previewStage.resize(); schedulePreview(); });
  }
  function closeEditor() { A.closeOv('ov-editor'); if (previewStage) previewStage.paused = true; }
  document.querySelectorAll('[data-close="ov-editor"]').forEach(function (b) {
    b.addEventListener('click', function () { if (previewStage) previewStage.paused = true; var st = window.DomusGame.state; if (st.ctx.mode === 'test') A.openTitle(); });
  });
  $('title-editor').addEventListener('click', function () { A.ensureAudio(); A.closeOv('ov-title'); openEditor(); });

  $('ed-new').addEventListener('click', function () {
    A.confirmDlg('Nuovo livello?', 'Il livello che stai modificando verrà cancellato (se non l\'hai salvato).', 'Nuovo', function () { ED = blank(8, 8); pendingMover = pendingPortal = null; buildOpts(); renderGrid(); });
  });

  /* ---------- prova ---------- */
  $('ed-test').addEventListener('click', function () {
    var p = problems(); if (p.length) { A.toast(p[0], 'bad'); return; }
    var lv = buildLevel(false), sig = signature();
    closeEditor();
    A.loadCustom(lv, {
      mode: 'test',
      onWin: function (r) {
        var firstTime = !(ED.solution && ED.sig === sig);
        ED.solution = r.solution; ED.par = r.blocks; ED.sig = sig;
        if (firstTime) { SAVE.stats.built++; A.save(); A.checkAch(); }
      },
      onBack: function () { openEditor(); }
    });
    A.toast('Risolvi il tuo livello: poi potrai condividerlo.', '', 3200);
  });

  /* ---------- codici ---------- */
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function exportCode() {
    var lv = buildLevel(true);
    var o = { v: 1, n: lv.name, t: lv.world, r: lv.rows, s: lv.start, a: lv.allowed, l: lv.limit, h: lv.hazards || [], m: lv.movers || [], p: strip(lv.solution) };
    return 'DL1:' + b64e(JSON.stringify(o));
  }
  function strip(sol) { return { main: A.strip(sol.main || []), f1: A.strip(sol.f1 || []) }; }
  function fail(msg) { throw new Error(msg); }
  function int(v, a, b, what) { if (typeof v !== 'number' || v % 1 !== 0 || v < a || v > b) fail('Codice non valido (' + what + ').'); return v; }
  function checkNodes(list, allowed, depth, counter) {
    if (!Array.isArray(list) || depth > 8) fail('Soluzione non valida.');
    list.forEach(function (n) {
      if (!n || allowed.indexOf(n.t) < 0) fail('La soluzione usa un cubo non consentito.');
      if (++counter.n > 300) fail('Soluzione troppo grande.');
      var o = { t: n.t };
      if (n.t === 'REP') { int(n.n, 1, 99, 'ripetizioni'); }
      if (n.t === 'WHILE' && ['free', 'blocked'].indexOf(n.c) < 0) fail('Condizione non valida.');
      if (n.t === 'IF' && ['free', 'blocked', 'lamp'].indexOf(n.c) < 0) fail('Condizione non valida.');
      if (n.body) checkNodes(n.body, allowed, depth + 1, counter);
      if (n.else) checkNodes(n.else, allowed, depth + 1, counter);
    });
  }
  function decode(code) {
    code = (code || '').trim();
    if (code.indexOf('DL1:') !== 0) fail('Il codice deve iniziare con DL1:');
    var o;
    try { o = JSON.parse(b64d(code.slice(4))); } catch (e) { fail('Codice danneggiato: copialo di nuovo per intero.'); }
    if (!o || o.v !== 1 || !Array.isArray(o.r)) fail('Codice non riconosciuto.');
    if (o.r.length < 3 || o.r.length > 16) fail('Dimensioni non valide.');
    o.r.forEach(function (r) { if (typeof r !== 'string' || r.length < 3 || r.length > 16 || !TILE_RE.test(r)) fail('La mappa contiene caratteri non validi.'); });
    var h = o.r.length, w = Math.max.apply(null, o.r.map(function (r) { return r.length; }));
    if (!Array.isArray(o.s) || o.s.length !== 3) fail('Partenza non valida.');
    int(o.s[0], 0, w - 1, 'partenza'); int(o.s[1], 0, h - 1, 'partenza'); int(o.s[2], 0, 3, 'direzione');
    var allowed = ALLOWED_ALL.filter(function (t) { return ['F', 'L', 'R'].indexOf(t) >= 0 || (Array.isArray(o.a) && o.a.indexOf(t) >= 0); });
    int(o.l, 1, 99, 'limite');
    var haz = (Array.isArray(o.h) ? o.h : []).slice(0, 60).map(function (q) { return { x: int(q.x, 0, w - 1, 'trappola'), y: int(q.y, 0, h - 1, 'trappola'), p: int(q.p, 2, 8, 'trappola'), on: int(q.on, 1, 7, 'trappola'), ph: int(q.ph, 0, 7, 'trappola') }; });
    var mov = (Array.isArray(o.m) ? o.m : []).slice(0, 30).map(function (q) {
      if (!q || !Array.isArray(q.a) || !Array.isArray(q.b)) fail('Sentinella non valida.');
      return { a: [int(q.a[0], 0, w - 1, 'sentinella'), int(q.a[1], 0, h - 1, 'sentinella')], b: [int(q.b[0], 0, w - 1, 'sentinella'), int(q.b[1], 0, h - 1, 'sentinella')], ph: int(q.ph, 0, 1, 'sentinella') };
    });
    var sol = o.p || {}; var cnt = { n: 0 };
    checkNodes(sol.main || [], allowed, 0, cnt); checkNodes(sol.f1 || [], allowed, 0, cnt);
    var lv = { id: 0, world: int(o.t || 1, 1, 100, 'ambiente'), name: String(o.n || 'Livello condiviso').slice(0, 28), rows: o.r, start: o.s, allowed: allowed, limit: o.l, par: 0, solution: { main: sol.main || [], f1: sol.f1 || [] } };
    if (haz.length) lv.hazards = haz; if (mov.length) lv.movers = mov;
    lv.par = E.blockCount(lv.solution);
    if (lv.par > lv.limit) fail('Il livello non è valido: la soluzione supera il limite di cubi.');
    var P = E.prepare(lv);
    if (!P.goal) fail('Il livello non ha la centralina.');
    var sim = E.simulate(lv, lv.solution);
    if (sim.status !== 'win') fail('Questo livello non è risolvibile: il codice è stato modificato.');
    return lv;
  }
  function toEditorState(lv) {
    var cells = [], h = lv.rows.length, w = Math.max.apply(null, lv.rows.map(function (r) { return r.length; }));
    for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push(lv.rows[y][x] || '.'); cells.push(r); }
    var s = { name: lv.name, w: w, h: h, cells: cells, start: lv.start.slice(), hazards: (lv.hazards || []).map(function (q) { return { x: q.x, y: q.y, p: q.p, on: q.on, ph: q.ph }; }),
      movers: (lv.movers || []).map(function (q) { return { a: q.a.slice(), b: q.b.slice(), ph: q.ph }; }), limit: lv.limit, allowed: lv.allowed.filter(function (t) { return ['F', 'L', 'R'].indexOf(t) < 0; }),
      world: lv.world > 21 ? ((lv.world - 1) % 21) + 1 : lv.world, solution: lv.solution, par: lv.par, sig: '' };
    return s;
  }

  function openCodeDialog(code, help) {
    $('import-text').value = code || ''; $('import-help').innerHTML = help;
    A.openOv('ov-import');
  }
  $('ed-share').addEventListener('click', function () {
    var code = exportCode();
    try { navigator.clipboard.writeText(code); A.toast('Codice copiato!', 'good'); } catch (e) {}
    openCodeDialog(code, 'Questo è il codice del tuo livello: mandalo a un amico (è già stato copiato).');
    $('import-text').select();
  });
  $('ed-import').addEventListener('click', function () { openCodeDialog('', 'Incolla un codice <b>DL1:…</b> ricevuto da un amico.'); });
  function withCode(cb) {
    try { var lv = decode($('import-text').value); cb(lv); } catch (e) { A.toast(e.message, 'bad', 4000); }
  }
  $('import-edit').addEventListener('click', function () {
    withCode(function (lv) {
      ED = toEditorState(lv); ED.sig = signature(); pendingMover = pendingPortal = null;
      A.closeOv('ov-import'); A.closeOv('ov-title'); openEditor();
    });
  });
  $('import-play').addEventListener('click', function () {
    withCode(function (lv) { A.closeOv('ov-import'); A.closeOv('ov-editor'); if (previewStage) previewStage.paused = true; A.startPlayCustom(lv); });
  });

  /* ---------- salva / i miei livelli ---------- */
  function persistable() { return { name: ED.name, w: ED.w, h: ED.h, rows: rowsOf(), start: ED.start, hazards: ED.hazards, movers: ED.movers, limit: ED.limit, allowed: ED.allowed, world: ED.world, solution: ED.solution, par: ED.par }; }
  $('ed-save').addEventListener('click', function () {
    var name = (ED.name || 'Il mio livello').slice(0, 28);
    var list = SAVE.custom, item = { id: Date.now(), name: name, data: persistable(), ts: Date.now() };
    var ex = list.filter(function (c) { return c.name === name; })[0];
    if (ex) { ex.data = item.data; ex.ts = item.ts; } else list.unshift(item);
    if (list.length > 30) list.length = 30;
    A.save(); A.toast('Livello salvato: "' + name + '".', 'good');
  });
  $('ed-load').addEventListener('click', openMine);
  function openMine() {
    var b = $('mine-body'); b.innerHTML = '';
    if (!SAVE.custom.length) b.innerHTML = '<p class="muted">Non hai ancora salvato livelli. Costruiscine uno e premi Salva.</p>';
    SAVE.custom.forEach(function (c, i) {
      var row = document.createElement('div'); row.className = 'mine-row';
      var ver = c.data.solution ? '✅' : '🔧';
      row.innerHTML = '<span class="mn-n">' + ver + ' ' + c.name.replace(/</g, '&lt;') + '</span><span class="mn-b"><button class="btn sm" data-a="edit">Modifica</button><button class="btn sm" data-a="del">Elimina</button></span>';
      row.querySelector('[data-a=edit]').addEventListener('click', function () {
        var d = c.data; ED = { name: d.name, w: d.w, h: d.h, cells: d.rows.map(function (r) { return r.split(''); }), start: d.start.slice(), hazards: d.hazards.slice(), movers: d.movers.slice(), limit: d.limit, allowed: d.allowed.slice(), world: d.world, solution: d.solution, par: d.par, sig: '' };
        ED.sig = d.solution ? signature() : '';
        pendingMover = pendingPortal = null; A.closeOv('ov-mine'); buildOpts(); renderGrid();
      });
      row.querySelector('[data-a=del]').addEventListener('click', function () { SAVE.custom.splice(i, 1); A.save(); openMine(); });
      b.appendChild(row);
    });
    A.openOv('ov-mine');
  }

  window.DomusEditor = { decode: decode, exportCode: function () { return exportCode(); }, state: function () { return ED; } };
})();
