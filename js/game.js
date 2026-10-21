/* DomusLab — interfaccia e logica di gioco */
(function () {
  'use strict';
  var E = window.DomusEngine, LEVELS = window.DOMUS_LEVELS, TH = window.DomusThemes, SK = window.DomusSkins, D = window.DomusData;
  var $ = function (id) { return document.getElementById(id); };
  var TOTAL = LEVELS.length, WORLDS_N = Math.ceil(TOTAL / 10);

  /* Costi degli aiuti (in stelle). Cambiali qui se vuoi. */
  var COST_AID = 1, COST_SKIP = 2, START_BONUS = 3;

  var BLOCKS = {
    F: { label: 'Avanti', icon: 'up' }, L: { label: 'Gira sx', icon: 'left' }, R: { label: 'Gira dx', icon: 'right' },
    A: { label: 'Accendi', icon: 'bulb' }, REP: { label: 'Ripeti', icon: 'rep', cont: true },
    WHILE: { label: 'Finché', icon: 'while', cont: true }, IF: { label: 'Se', icon: 'if', cont: true },
    CALL: { label: 'F1', icon: null }
  };
  var COND_SHORT = { free: 'libero', blocked: 'ostacolo', lamp: 'lampada' };
  var COND_SETS = { WHILE: ['free', 'blocked'], IF: ['free', 'blocked', 'lamp'] };
  var SPEEDS = [1, 2, 4, 8, 16];
  var MESSAGES = {
    fall: 'Domo è caduto nel vuoto! Controlla i passi.',
    bump: 'Domo ha urtato un ostacolo.',
    locked: 'La porta è chiusa: serve la chiave dello stesso colore.',
    trap: 'Domo è finito su una trappola attiva! Guarda i pallini: rosso = attiva.',
    crush: 'Una sentinella ha schiacciato Domo! Controlla il contorno tratteggiato.',
    loop: 'Il programma non finisce mai: c\'è un ciclo infinito.',
    nogoal: 'Domo non è arrivato alla centralina.',
    nolamps: 'Domo è alla centralina, ma ci sono ancora luci spente.',
    both: 'Mancano delle luci e Domo non è alla centralina.',
    empty: 'Trascina qualche cubo nel programma, poi premi Play.'
  };

  /* ---------- mondi ---------- */
  function worldOf(id) { return Math.ceil(id / 10); }
  function theme(w) { return TH.forWorld(w); }
  function worldFeatures(w) {
    var set = {}, a = (w - 1) * 10;
    for (var i = a; i < a + 10 && i < TOTAL; i++) (LEVELS[i].feat || []).forEach(function (f) { set[f] = 1; });
    if (set.coins === undefined && LEVELS[a] && LEVELS[a].coins) set.coins = 1;
    return Object.keys(set);
  }

  /* ---------- salvataggio ---------- */
  var KEY = 'domuslab.v2', DKEY = 'domuslab.drafts';
  var FREE_SKINS = SK.list.filter(function (s) { return s.price === 0; }).map(function (s) { return s.id; });
  var SAVE = {
    stars: {}, skip: {}, spent: 0, bonus: START_BONUS, coins: 0, cbest: {}, times: {}, scores: {},
    sound: true, music: false, fog: false, unlockAll: false, current: 1, tips: {},
    skin: 'domo', owned: FREE_SKINS.slice(), customEmoji: '🙂', customImg: null,
    speed: {}, daily: { last: '', streak: 0, best: 0, done: {} },
    stats: { coins: 0, portalWins: 0, doorWins: 0, trapWins: 0, moverWins: 0, dark: 0, speedruns: 0, dailies: 0, built: 0, bought: 0, aids: 0, skips: 0 },
    ach: {}, custom: []
  };
  (function load() {
    try {
      var raw = localStorage.getItem(KEY), s = raw && JSON.parse(raw);
      if (!s) { // migra dal vecchio salvataggio
        var o = JSON.parse(localStorage.getItem('domuslab.v1'));
        if (o && o.stars) s = { stars: o.stars, sound: o.sound, unlockAll: o.unlockAll, current: o.current, tips: o.tips };
      }
      if (s) {
        for (var k in s) { if (k === 'stats' || k === 'daily') SAVE[k] = Object.assign(SAVE[k], s[k]); else SAVE[k] = s[k]; }
      }
    } catch (e) {}
    FREE_SKINS.forEach(function (id) { if (SAVE.owned.indexOf(id) < 0) SAVE.owned.push(id); });
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch (e) {} }
  function totalStars() { var t = 0; for (var k in SAVE.stars) t += SAVE.stars[k]; return t; }
  function balance() { return totalStars() + SAVE.bonus - SAVE.spent; }
  function isDone(id) { return (SAVE.stars[id] || 0) > 0 || !!SAVE.skip[id]; }
  function unlocked(i) { return i === 0 || SAVE.unlockAll || isDone(LEVELS[i].id) || isDone(LEVELS[i - 1].id); }
  function clearedCount() { var n = 0; for (var i = 0; i < TOTAL; i++) if (isDone(LEVELS[i].id)) n++; return n; }

  var drafts = {};
  try { drafts = JSON.parse(localStorage.getItem(DKEY)) || {}; } catch (e) {}
  var draftT = null;
  function saveDrafts() {
    var keys = Object.keys(drafts);
    while (keys.length > 40) { delete drafts[keys.shift()]; }
    try { localStorage.setItem(DKEY, JSON.stringify(drafts)); } catch (e) {}
  }
  function draftSoon() { clearTimeout(draftT); draftT = setTimeout(saveDrafts, 400); }

  /* ---------- audio ---------- */
  var AC = null;
  function ensureAudio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    syncMusic();
  }
  function tone(f, d, type, vol, delay, slide) {
    if (!SAVE.sound || !AC) return;
    var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.03);
  }
  var SFX = {
    step: function () { tone(440, 0.09, 'triangle', 0.06, 0, 520); },
    turn: function () { tone(620, 0.08, 'triangle', 0.05); },
    lamp: function () { tone(880, 0.15, 'sine', 0.09); tone(1320, 0.25, 'sine', 0.07, 0.08); },
    nope: function () { tone(200, 0.12, 'square', 0.03); },
    fall: function () { tone(500, 0.5, 'sawtooth', 0.05, 0, 60); },
    bump: function () { tone(120, 0.18, 'square', 0.07); },
    fail: function () { tone(300, 0.25, 'sawtooth', 0.05, 0.05, 150); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.08, i * 0.11); }); },
    click: function () { tone(700, 0.04, 'sine', 0.04); },
    coin: function () { tone(988, 0.07, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0.07); },
    key: function () { tone(660, 0.08, 'triangle', 0.07); tone(880, 0.08, 'triangle', 0.07, 0.08); tone(1175, 0.2, 'triangle', 0.07, 0.16); },
    portal: function () { tone(300, 0.35, 'sine', 0.08, 0, 1200); tone(1200, 0.25, 'sine', 0.05, 0.2, 400); },
    zap: function () { tone(900, 0.3, 'sawtooth', 0.07, 0, 90); tone(120, 0.25, 'square', 0.06, 0.05); },
    ach: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.22, 'sine', 0.07, i * 0.09); }); },
    buy: function () { tone(523, 0.1, 'triangle', 0.07); tone(784, 0.25, 'triangle', 0.07, 0.1); }
  };
  /* musica d'ambiente generativa (nessun file audio) */
  var musicT = null, musicStep = 0, musicNote = 2;
  var PENTA = [0, 2, 4, 7, 9];
  function syncMusic() {
    var want = SAVE.music && SAVE.sound && AC;
    if (want && !musicT) {
      musicT = setInterval(function () {
        if (document.hidden) return;
        var th = G.level ? theme(G.level.world || 1) : theme(1), base = 110 * Math.pow(2, ((th.hue / 30) | 0) / 12);
        musicNote = Math.max(0, Math.min(9, musicNote + (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() * 2 | 0))));
        var n = PENTA[musicNote % 5] + 12 * ((musicNote / 5) | 0);
        tone(base * 2 * Math.pow(2, n / 12), 1.4, 'sine', 0.022);
        if (musicStep++ % 4 === 0) tone(base * Math.pow(2, PENTA[(musicStep / 4 | 0) % 5] / 12), 2.2, 'triangle', 0.03);
      }, 520);
    } else if (!want && musicT) { clearInterval(musicT); musicT = null; }
  }

  /* ---------- personaggi ---------- */
  var customCv = null;
  function buildCustom(cb) {
    if (SAVE.customImg) {
      var img = new Image();
      img.onload = function () { customCv = SK.spriteFromImage(img); if (cb) cb(); };
      img.onerror = function () { SAVE.customImg = null; customCv = SK.spriteFromEmoji(SAVE.customEmoji); if (cb) cb(); };
      img.src = SAVE.customImg;
    } else { customCv = SK.spriteFromEmoji(SAVE.customEmoji); if (cb) cb(); }
  }
  function skinById(id) {
    if (id === 'custom') return { id: 'custom', name: 'Tuo', sprite: customCv || SK.spriteFromEmoji(SAVE.customEmoji) };
    return SK.list.filter(function (s) { return s.id === id; })[0] || SK.list[0];
  }
  function applySkin() { stage.setSkin(skinById(SAVE.skin)); }

  /* ---------- stato ---------- */
  var stage = new window.DomusStage($('stage'));
  stage.sfx = function (n) { if (SFX[n]) SFX[n](); };
  var G = {
    idx: -1, level: null, ctx: { mode: 'story' }, prog: { main: [], f1: [] }, active: null, state: 'idle', mode: 'auto', token: 0,
    speed: 0, aid: 0, stepRes: null, drag: null, lastDrag: 0, undo: [], elapsed: 0, timing: false, usedPortal: false
  };
  var uid = 0;
  var slotMeta = new Map(), meta = new Map();

  function mk(t) {
    var n = { id: 'n' + (++uid), t: t };
    if (t === 'REP') { n.n = 3; n.body = []; }
    else if (t === 'WHILE') { n.c = 'free'; n.body = []; }
    else if (t === 'IF') { n.c = 'free'; n.body = []; n.else = []; }
    return n;
  }
  function withIds(list) {
    return list.map(function (s) {
      var n = { id: 'n' + (++uid), t: s.t };
      if (s.n !== undefined) n.n = s.n;
      if (s.c !== undefined) n.c = s.c;
      if (s.body) n.body = withIds(s.body);
      if (s.t === 'IF') n.else = withIds(s.else || []);
      return n;
    });
  }
  function strip(list) {
    return list.map(function (s) {
      var n = { t: s.t };
      if (s.n !== undefined) n.n = s.n;
      if (s.c !== undefined) n.c = s.c;
      if (s.body) n.body = strip(s.body);
      if (s.t === 'IF') n.else = strip(s.else || []);
      return n;
    });
  }
  function countNode(n) { return E.blockCount({ main: [n], f1: [] }); }
  function used() { return E.blockCount(G.prog); }
  function hasCall(n) { return n.t === 'CALL' || (n.body || []).some(hasCall) || (n.else || []).some(hasCall); }
  function inList(root, target) {
    if (root === target) return true;
    for (var i = 0; i < root.length; i++) {
      var n = root[i];
      if ((n.body && inList(n.body, target)) || (n.else && inList(n.else, target))) return true;
    }
    return false;
  }
  function canDrop(node, list) { return !(hasCall(node) && inList(G.prog.f1, list)); }
  function removeFrom(list, node) { var i = list.indexOf(node); if (i >= 0) list.splice(i, 1); return i; }
  function progJSON() { return JSON.stringify(G.prog); }

  /* ---------- annulla ---------- */
  function snap() { G.undo.push(progJSON()); if (G.undo.length > 80) G.undo.shift(); updateControls(); }
  function undo() {
    if (G.state !== 'idle') return;
    var cur = progJSON(), s;
    while (G.undo.length) { s = G.undo.pop(); if (s !== cur) { G.prog = JSON.parse(s); G.active = G.prog.main; renderAll(); SFX.click(); updateControls(); return; } }
    updateControls();
  }

  /* ---------- toast / HUD ---------- */
  var toastT = null;
  function toast(msg, kind, ms) {
    var el = $('toast'); el.textContent = msg; el.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  }
  function fmt(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60), t = Math.floor((ms % 1000) / 100);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) + (ms < 60000 ? '.' + t : '');
  }
  function updateHud() {
    var L = G.level, u = used();
    $('hud-blocks').textContent = u + '/' + L.limit;
    $('chip-blocks').classList.toggle('full', u >= L.limit);
    $('hud-par').textContent = '3★ ≤ ' + L.par;
    $('chip-par').style.display = G.ctx.mode === 'story' || G.ctx.mode === 'daily' ? '' : 'none';
    updateLamps();
  }
  function updateLamps() {
    var P = E.prepare(G.level), n = P.lamps.length;
    $('chip-lamps').style.display = n ? '' : 'none';
    var lit = stage.litCount();
    $('hud-lamps').textContent = lit + '/' + n;
    $('chip-lamps').classList.toggle('done', n > 0 && lit === n);
    var cn = P.coins.length;
    $('chip-coins').style.display = cn ? '' : 'none';
    $('hud-coins').textContent = stage.coinCount() + '/' + cn;
  }
  function updateTotal() {
    $('total-stars').textContent = balance();
    $('total-coins').textContent = SAVE.coins;
  }
  function updateControls() {
    var st = G.state, m = G.ctx.mode;
    var play = $('btn-play');
    play.querySelector('svg use').setAttribute('href', st === 'running' ? '#i-pause' : '#i-play');
    play.querySelector('span').textContent = st === 'running' ? 'Pausa' : (st === 'paused' ? 'Continua' : 'Play');
    $('btn-clear').disabled = st !== 'idle';
    $('btn-undo').disabled = st !== 'idle' || !G.undo.length;
    $('btn-hint').disabled = st !== 'idle' || !(m === 'story' || m === 'daily');
    $('editor').classList.toggle('locked', st !== 'idle');
    $('btn-speed').textContent = SPEEDS[G.speed] + '×';
    $('btn-fog').classList.toggle('on', SAVE.fog);
  }

  /* ---------- cronometro ---------- */
  var tLast = performance.now();
  setInterval(function () {
    var now = performance.now(), dt = now - tLast; tLast = now;
    var blocked = document.hidden || document.querySelector('.ov.show');
    if (G.timing && !blocked) {
      G.elapsed += dt;
      if (G.ctx.mode === 'speed') G.ctx.ms += dt;
    }
    var shown = G.ctx.mode === 'speed' ? G.ctx.ms : G.elapsed;
    $('hud-time').textContent = fmt(shown);
  }, 100);
  function startTimer() { G.timing = true; }
  function stopTimer() { G.timing = false; }

  /* ---------- caricamento livello ---------- */
  function badge() {
    var b = $('mode-badge'), c = G.ctx;
    var txt = '';
    if (c.mode === 'daily') txt = '📅 Sfida del giorno';
    else if (c.mode === 'speed') txt = '⏱️ Speedrun · livello ' + (c.k + 1) + '/10';
    else if (c.mode === 'test') txt = '🛠️ Prova del tuo livello';
    else if (c.mode === 'custom') txt = '🎮 Livello creato';
    b.textContent = txt; b.style.display = txt ? '' : 'none';
  }

  function setupLevel(L, ctx) {
    cancelRun();
    G.ctx = ctx; G.level = L; G.idx = ctx.idx !== undefined ? ctx.idx : -1; G.aid = 0; G.undo = []; G.elapsed = 0; G.timing = false;
    var w = L.world || 1, th = theme(w);
    G.prog = { main: [], f1: [] };
    var key = ctx.mode === 'story' || ctx.mode === 'daily' ? 'L' + L.id : null;
    if (key && drafts[key]) { try { G.prog = { main: withIds(drafts[key].main || []), f1: withIds(drafts[key].f1 || []) }; } catch (e) { G.prog = { main: [], f1: [] }; } }
    G.active = G.prog.main;
    var id = ctx.mode === 'custom' || ctx.mode === 'test' ? (L.name || 'Livello creato') : 'Livello ' + L.id + ' <span>/ ' + TOTAL + '</span>';
    $('lvl-world').textContent = ctx.mode === 'custom' || ctx.mode === 'test' ? th.icon + ' ' + th.name : th.icon + ' Mondo ' + w + ' · ' + th.title;
    $('lvl-num').innerHTML = id;
    stage.setLevel(L, w);
    stage.setFog(SAVE.fog);
    applySkin();
    stage.resize();
    buildPalette();
    $('lane-f1-wrap').classList.toggle('on', L.allowed.indexOf('CALL') >= 0);
    renderAll(true);
    badge(); updateControls();
    var first = ctx.mode === 'story' && (L.id - 1) % 10 === 0;
    if (first && !SAVE.tips[w]) { showTip(w); SAVE.tips[w] = true; save(); }
    else $('tipcard').classList.remove('show');
  }
  function loadLevel(i, ctx) {
    i = Math.max(0, Math.min(TOTAL - 1, i));
    ctx = ctx || { mode: 'story' }; ctx.idx = i;
    setupLevel(LEVELS[i], ctx);
  }
  function loadCustom(level, ctx) { setupLevel(level, ctx || { mode: 'custom' }); }

  function showTip(w) {
    var th = theme(w), t = D.TIPS[w];
    $('tip-title').textContent = th.icon + ' Mondo ' + w + ' · ' + th.title;
    var feats = worldFeatures(w).filter(function (f) { return f !== 'coins' || w === 10; });
    $('tip-text').textContent = t || ('Benvenuto in ' + th.title + '! Stesse regole, percorsi più difficili' + (feats.length ? ' e tante novità: ' + feats.map(function (f) { return D.FEAT_LABEL[f][1]; }).join(', ') : '') + '.');
    $('tipcard').classList.add('show');
  }

  function buildPalette() {
    var p = $('palette'); p.innerHTML = '';
    G.level.allowed.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'pal b-' + t; b.dataset.t = t; b.title = BLOCKS[t].label;
      b.innerHTML = cubeHTML(t) + '<span class="lbl">' + BLOCKS[t].label + '</span>';
      p.appendChild(b);
    });
  }
  function cubeHTML(t) {
    var d = BLOCKS[t];
    return '<span class="cube">' + (d.icon ? '<svg class="ic"><use href="#i-' + d.icon + '"/></svg>' : 'F1') + '</span>';
  }

  /* ---------- editor: rendering ---------- */
  function renderAll(silent) {
    slotMeta.clear(); meta.clear();
    fill($('lane-main'), G.prog.main);
    fill($('lane-f1'), G.prog.f1);
    markActive();
    updateHud();
    if (!silent && (G.ctx.mode === 'story' || G.ctx.mode === 'daily')) {
      var key = 'L' + G.level.id;
      if (G.prog.main.length || G.prog.f1.length) { delete drafts[key]; drafts[key] = strip(G.prog.main).length ? { main: strip(G.prog.main), f1: strip(G.prog.f1) } : { main: [], f1: strip(G.prog.f1) }; }
      else delete drafts[key];
      draftSoon();
    }
  }
  function fill(slotEl, list) {
    slotEl.innerHTML = '';
    slotMeta.set(slotEl, list);
    for (var i = 0; i < list.length; i++) slotEl.appendChild(nodeEl(list[i], list));
  }
  function mkSlot(list) { var s = document.createElement('div'); s.className = 'slot'; fill(s, list); return s; }
  function nodeEl(n, list) {
    var el = document.createElement('div'); el.dataset.id = n.id;
    if (!BLOCKS[n.t].cont) {
      el.className = 'blk prim b-' + n.t;
      el.innerHTML = cubeHTML(n.t) + '<button class="x" title="Rimuovi">×</button>';
      meta.set(el, { node: n, list: list });
      return el;
    }
    el.className = 'blk cont b-' + n.t;
    var hd = document.createElement('div'); hd.className = 'hd';
    var ctl = '';
    if (n.t === 'REP') ctl = '<div class="ctl"><button class="mn" title="Meno">−</button><input class="num" type="number" inputmode="numeric" min="2" max="99" value="' + n.n + '" title="Quante volte"><button class="pl" title="Più">+</button></div>';
    else ctl = '<button class="chip-c" title="Cambia condizione">' + COND_SHORT[n.c] + '</button>';
    hd.innerHTML = cubeHTML(n.t) + ctl;
    var body = document.createElement('div'); body.className = 'body';
    body.appendChild(mkSlot(n.body));
    if (n.t === 'IF') {
      var lab = document.createElement('div'); lab.className = 'else-l'; lab.textContent = 'altrimenti';
      body.appendChild(lab); body.appendChild(mkSlot(n.else));
    }
    var x = document.createElement('button'); x.className = 'x'; x.title = 'Rimuovi'; x.textContent = '×';
    el.appendChild(hd); el.appendChild(body); el.appendChild(x);
    meta.set(el, { node: n, list: list }); meta.set(hd, { node: n, list: list });
    return el;
  }
  function markActive() {
    document.querySelectorAll('.slot.active').forEach(function (s) { s.classList.remove('active'); });
    var found = false;
    slotMeta.forEach(function (list, el) { if (list === G.active && !found) { el.classList.add('active'); found = true; } });
    if (!found) { G.active = G.prog.main; $('lane-main').classList.add('active'); }
  }
  function flashLimit() {
    var c = $('chip-blocks'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    toast('Hai raggiunto il limite di cubi. Usa cicli e funzioni!', 'bad');
  }
  function touchStart() { if (!G.timing && G.state === 'idle') startTimer(); }

  function addToActive(t) {
    if (G.state !== 'idle') return;
    var n = mk(t);
    if (!canDrop(n, G.active)) { toast('La funzione F1 non può richiamare se stessa.', 'bad'); return; }
    if (used() + 1 > G.level.limit) { flashLimit(); return; }
    snap(); touchStart();
    G.active.push(n);
    if (BLOCKS[t].cont) G.active = n.body;
    SFX.click(); renderAll();
  }

  /* ---------- editor: eventi click ---------- */
  $('lanes').addEventListener('click', function (e) {
    if (G.state !== 'idle' || Date.now() - G.lastDrag < 120) return;
    var t = e.target, blk = t.closest('.blk'), m;
    if (t.closest('.x')) {
      m = meta.get(blk); if (!m) return;
      snap(); removeFrom(m.list, m.node); SFX.click(); renderAll(); return;
    }
    if (t.closest('.mn, .pl')) {
      m = meta.get(blk); if (!m) return;
      snap(); m.node.n = Math.max(2, Math.min(99, m.node.n + (t.closest('.pl') ? 1 : -1))); SFX.click(); renderAll(); return;
    }
    if (t.closest('.chip-c')) {
      m = meta.get(blk); if (!m) return;
      snap(); var set = COND_SETS[m.node.t], i = set.indexOf(m.node.c); m.node.c = set[(i + 1) % set.length]; SFX.click(); renderAll(); return;
    }
    var slot = t.closest('.slot');
    if (slot && slotMeta.has(slot)) { G.active = slotMeta.get(slot); markActive(); return; }
    var hd = t.closest('.hd');
    if (hd && meta.has(hd)) { G.active = meta.get(hd).node.body; markActive(); }
  });
  $('lanes').addEventListener('change', function (e) {
    var inp = e.target.closest('.num'); if (!inp || G.state !== 'idle') return;
    var m = meta.get(inp.closest('.blk')); if (!m) return;
    snap(); m.node.n = Math.max(2, Math.min(99, parseInt(inp.value, 10) || 2)); renderAll();
  });
  $('palette').addEventListener('click', function (e) {
    var b = e.target.closest('.pal'); if (!b || Date.now() - G.lastDrag < 120) return;
    ensureAudio(); addToActive(b.dataset.t);
  });

  /* ---------- editor: trascinamento ---------- */
  var ghost = $('ghost'), prep = null;
  document.addEventListener('pointerdown', function (e) {
    if (G.state !== 'idle' || e.button > 0) return;
    if (e.target.closest('.x, .ctl, .chip-c')) return;
    var pal = e.target.closest('.pal'), el = e.target.closest('.blk.prim, .hd');
    if (pal) prep = { src: 'pal', t: pal.dataset.t, x: e.clientX, y: e.clientY, el: pal };
    else if (el && $('lanes').contains(el) && meta.has(el)) {
      var m = meta.get(el);
      prep = { src: 'blk', node: m.node, list: m.list, x: e.clientX, y: e.clientY, el: el.classList.contains('hd') ? el.parentElement : el };
    } else return;
    ensureAudio();
  });
  window.addEventListener('pointermove', function (e) {
    if (!prep) return;
    if (!G.drag) {
      if (Math.hypot(e.clientX - prep.x, e.clientY - prep.y) < 7) return;
      startDrag();
    }
    if (G.drag) moveDrag(e);
  });
  window.addEventListener('pointerup', function (e) { if (G.drag) endDrag(e); prep = null; });
  window.addEventListener('pointercancel', function (e) { if (G.drag) endDrag(e, true); prep = null; });

  function startDrag() {
    snap(); touchStart();
    var d = { node: null, isNew: prep.src === 'pal', list: null, index: -1, target: null, over: null, marker: null };
    if (prep.src === 'pal') {
      d.node = mk(prep.t);
      ghost.innerHTML = ''; ghost.appendChild(prep.el.querySelector('.cube').cloneNode(true));
    } else {
      d.node = prep.node; d.list = prep.list;
      ghost.innerHTML = ''; var c = prep.el.cloneNode(true); c.classList.remove('run'); ghost.appendChild(c);
      d.index = removeFrom(prep.list, prep.node);
      renderAll();
    }
    ghost.style.display = 'block';
    document.body.classList.add('is-dragging');
    G.drag = d;
  }
  function clearMarker() {
    var d = G.drag; if (!d) return;
    if (d.marker) { d.marker.remove(); d.marker = null; }
    if (d.over) { d.over.classList.remove('over'); d.over = null; }
    d.target = null;
  }
  function moveDrag(e) {
    var d = G.drag;
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    clearMarker();
    var els = document.elementsFromPoint(e.clientX, e.clientY), slot = null, lanes = $('lanes'), i;
    for (i = 0; i < els.length; i++) { if (els[i].classList && els[i].classList.contains('slot') && lanes.contains(els[i])) { slot = els[i]; break; } }
    if (!slot) {
      for (i = 0; i < els.length; i++) {
        var lane = els[i].classList && els[i].classList.contains('lane') ? els[i] : null;
        if (lane) { slot = lane.querySelector('.lane-slot'); break; }
      }
    }
    if (!slot || !slotMeta.has(slot)) return;
    var list = slotMeta.get(slot);
    if (!canDrop(d.node, list)) return;
    var kids = Array.prototype.filter.call(slot.children, function (c) { return c.classList.contains('blk'); });
    var idx = kids.length, sr = slot.getBoundingClientRect();
    for (i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      if (e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2)) { idx = i; break; }
    }
    var mkr = document.createElement('div'); mkr.className = 'drop-mark'; mkr.style.position = 'absolute';
    var left, top, h;
    if (kids.length === 0) { left = 12; top = 12; h = 54; }
    else if (idx < kids.length) { var rr = kids[idx].getBoundingClientRect(); left = rr.left - sr.left - 8; top = rr.top - sr.top; h = rr.height; }
    else { var lr = kids[kids.length - 1].getBoundingClientRect(); left = lr.right - sr.left + 3; top = lr.top - sr.top; h = lr.height; }
    mkr.style.left = left + 'px'; mkr.style.top = top + 'px'; mkr.style.height = h + 'px';
    slot.appendChild(mkr); slot.classList.add('over');
    d.marker = mkr; d.over = slot; d.target = { list: list, idx: idx };
  }
  function endDrag(e, cancelled) {
    var d = G.drag; G.drag = null; G.lastDrag = Date.now();
    var tgt = d.target;
    if (d.marker) d.marker.remove();
    if (d.over) d.over.classList.remove('over');
    ghost.style.display = 'none'; document.body.classList.remove('is-dragging');
    if (cancelled) tgt = null;
    if (tgt) {
      if (used() + countNode(d.node) > G.level.limit) {
        flashLimit();
        if (!d.isNew) d.list.splice(Math.min(d.index, d.list.length), 0, d.node);
      } else {
        tgt.list.splice(tgt.idx, 0, d.node);
        G.active = BLOCKS[d.node.t].cont ? d.node.body : tgt.list;
        SFX.click();
      }
    } else if (!d.isNew) {
      if (cancelled) d.list.splice(Math.min(d.index, d.list.length), 0, d.node);
      else SFX.nope();
    }
    renderAll();
  }

  /* ---------- esecuzione ---------- */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function highlight(id) {
    document.querySelectorAll('.run').forEach(function (n) { n.classList.remove('run'); });
    if (!id) return;
    var el = document.querySelector('[data-id="' + id + '"]'); if (!el) return;
    var t = el.classList.contains('cont') ? el.querySelector(':scope > .hd') : el;
    if (t) t.classList.add('run');
  }
  function baseDur(op) { return op === 'F' ? 330 : (op === 'A' ? 300 : (op === 'L' || op === 'R') ? 210 : 330); }
  function waitStep() { return new Promise(function (r) { G.stepRes = r; }); }
  function releaseStep() { var r = G.stepRes; G.stepRes = null; if (r) r(); }

  async function start(mode) {
    var prog = G.prog, L = G.level;
    var sim = E.simulate(L, prog);
    if (sim.reason === 'empty') { toast(MESSAGES.empty, 'bad'); return; }
    stage.reset(); updateLamps(); startTimer();
    G.state = 'running'; G.mode = mode; var token = ++G.token;
    $('tipcard').classList.remove('show');
    updateControls();
    for (var i = 0; i < sim.events.length; i++) {
      if (token !== G.token) return;
      var ev = sim.events[i], sp = SPEEDS[G.speed];
      highlight(ev.id);
      if (ev.op === 'iter' || ev.op === 'check') { await sleep((ev.op === 'check' ? 130 : 60) / sp); continue; }
      if (G.mode === 'step') {
        G.state = 'paused'; updateControls();
        await waitStep();
        if (token !== G.token) return;
        G.state = 'running'; updateControls();
      }
      await stage.apply(ev, baseDur(ev.op) / sp);
      if (token !== G.token) return;
      updateLamps();
    }
    if (token !== G.token) return;
    highlight(null);
    finish(sim, token);
  }

  function featOf(L) {
    var P = E.prepare(L);
    return { portal: P.portals.length > 0, door: P.doors.length > 0, trap: P.hazards.length > 0, mover: P.movers.length > 0 };
  }
  function checkAch() {
    D.ACH.forEach(function (a) {
      if (!SAVE.ach[a.id] && a.test(SAVE)) {
        SAVE.ach[a.id] = Date.now();
        showAch(a);
      }
    });
  }
  var achQ = [], achBusy = false;
  function showAch(a) { achQ.push(a); if (!achBusy) nextAch(); }
  function nextAch() {
    var a = achQ.shift(); if (!a) { achBusy = false; return; }
    achBusy = true;
    var el = $('ach-toast');
    el.innerHTML = '<span class="ai">' + a.icon + '</span><span><b>Obiettivo sbloccato!</b><br>' + a.name + ' — ' + a.desc + '</span>';
    el.classList.add('show'); SFX.ach();
    setTimeout(function () { el.classList.remove('show'); setTimeout(nextAch, 400); }, 3200);
  }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
  function yesterdayKey() { var d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }

  function finish(sim, token) {
    var mode = G.ctx.mode, L = G.level;
    if (sim.status === 'win') {
      G.state = 'done'; stopTimer(); updateControls();
      stage.win(); SFX.win();
      var u = used(), rewards = [], info = { u: u, coins: sim.coins, coinTotal: sim.coinTotal, ms: G.elapsed, mode: mode };
      var f = featOf(L);
      if (mode === 'story' || mode === 'daily') {
        var stars = u <= L.par ? 3 : (u <= L.par + 2 ? 2 : 1);
        if (G.aid > 0) stars = Math.min(stars, 2);
        info.stars = stars;
        var prevStars = SAVE.stars[L.id] || 0, first = !isDone(L.id);
        if (stars > prevStars) { SAVE.stars[L.id] = stars; if (prevStars > 0 || !first) rewards.push('+' + (stars - prevStars) + '★'); else rewards.push('+' + stars + '★'); }
        delete SAVE.skip[L.id]; if (!(L.id in SAVE.stars)) SAVE.stars[L.id] = stars;
        var cb = SAVE.cbest[L.id] || 0, newCoins = Math.max(0, sim.coins - cb);
        if (newCoins) { SAVE.cbest[L.id] = sim.coins; SAVE.stats.coins += newCoins; SAVE.coins += newCoins * 5; rewards.push('+' + newCoins * 5 + ' monete'); }
        if (first) { SAVE.coins += 10; rewards.push('+10 monete (primo successo)'); }
        var sec = G.elapsed / 1000;
        info.score = stars * 1000 + sim.coins * 200 + Math.max(0, Math.round(300 - sec)) * 2;
        if (!SAVE.scores[L.id] || info.score > SAVE.scores[L.id]) { if (SAVE.scores[L.id]) info.newBest = true; SAVE.scores[L.id] = info.score; }
        if (!SAVE.times[L.id] || G.elapsed < SAVE.times[L.id]) { if (SAVE.times[L.id]) info.newTime = true; SAVE.times[L.id] = Math.round(G.elapsed); }
        if (mode === 'story') SAVE.current = Math.max(SAVE.current, Math.min(TOTAL, L.id + 1));
        if (f.portal) SAVE.stats.portalWins++; if (f.door) SAVE.stats.doorWins++; if (f.trap) SAVE.stats.trapWins++; if (f.mover) SAVE.stats.moverWins++;
        if (SAVE.fog) SAVE.stats.dark++;
        if (mode === 'daily') {
          var dk = todayKey();
          if (!SAVE.daily.done[dk]) {
            SAVE.daily.done[dk] = 1;
            SAVE.daily.streak = SAVE.daily.last === yesterdayKey() ? SAVE.daily.streak + 1 : 1;
            SAVE.daily.best = Math.max(SAVE.daily.best, SAVE.daily.streak); SAVE.daily.last = dk;
            SAVE.bonus += 3; SAVE.coins += 25; SAVE.stats.dailies++;
            rewards.push('Sfida del giorno: +3★ e +25 monete · serie ' + SAVE.daily.streak + ' 🔥');
          }
        }
        delete drafts['L' + L.id]; saveDrafts();
      } else if (mode === 'test') {
        info.stars = u <= L.par ? 3 : 2;
        if (G.ctx.onWin) G.ctx.onWin({ solution: { main: strip(G.prog.main), f1: strip(G.prog.f1) }, blocks: u });
      } else if (mode === 'speed') {
        info.speed = true;
      }
      info.rewards = rewards;
      save(); updateTotal(); checkAch();
      if (mode === 'speed') { speedWin(info, token); return; }
      setTimeout(function () { if (token === G.token) showWin(info); }, 1100);
    } else {
      toast(MESSAGES[sim.reason] || 'Riprova!', 'bad', 3600); SFX.fail();
      setTimeout(function () { if (token === G.token) resetRun(); }, 2000);
    }
  }
  function cancelRun() { G.token++; releaseStep(); G.state = 'idle'; G.stepRes = null; highlight(null); }
  function resetRun() {
    cancelRun(); stage.reset(); updateLamps(); updateControls();
    $('ov-win').classList.remove('show');
  }

  $('btn-play').addEventListener('click', function () {
    ensureAudio();
    if (G.state === 'idle' || G.state === 'done') { if (G.state === 'done') resetRun(); start('auto'); }
    else if (G.state === 'running') { G.mode = 'step'; }
    else if (G.state === 'paused') { G.mode = 'auto'; releaseStep(); }
    updateControls();
  });
  $('btn-step').addEventListener('click', function () {
    ensureAudio();
    if (G.state === 'idle' || G.state === 'done') { if (G.state === 'done') resetRun(); start('step'); }
    else if (G.state === 'running') G.mode = 'step';
    else if (G.state === 'paused') releaseStep();
  });
  $('btn-reset').addEventListener('click', resetRun);
  $('btn-undo').addEventListener('click', undo);
  $('btn-speed').addEventListener('click', function () { G.speed = (G.speed + 1) % SPEEDS.length; updateControls(); });
  $('btn-clear').addEventListener('click', function () {
    if (!G.prog.main.length && !G.prog.f1.length) return;
    snap(); G.prog = { main: [], f1: [] }; G.active = G.prog.main; renderAll();
  });
  $('btn-fog').addEventListener('click', function () {
    SAVE.fog = !SAVE.fog; save(); stage.setFog(SAVE.fog); updateControls();
    toast(SAVE.fog ? 'Modalità Buio attiva: vedi solo vicino a Domo.' : 'Modalità Buio spenta.');
  });

  /* ---------- aiuto (lampadina) ---------- */
  function trimList(list, frac) {
    if (!list.length) return [];
    var keep = Math.max(1, Math.ceil(list.length * frac));
    return list.slice(0, keep).map(function (n) {
      var c = { t: n.t }; if (n.n !== undefined) c.n = n.n; if (n.c !== undefined) c.c = n.c;
      if (n.body) c.body = trimList(n.body, frac);
      if (n.t === 'IF') c.else = trimList(n.else || [], frac);
      return c;
    });
  }
  $('btn-hint').addEventListener('click', function () {
    var bal = balance();
    $('hint-balance').innerHTML = 'Hai <b>' + bal + '★</b>. Ogni aiuto costa stelle.';
    $('hint-aid-d').textContent = G.aid === 0 ? 'Ti inserisco l\'inizio del programma giusto. Il resto lo completi tu.' : 'Ti inserisco tutta la soluzione.';
    $('hint-aid-c').textContent = '−' + COST_AID + '★';
    $('hint-skip-c').textContent = '−' + COST_SKIP + '★';
    $('hint-aid').disabled = bal < COST_AID || G.aid >= 2;
    $('hint-skip').disabled = bal < COST_SKIP;
    $('ov-hint').classList.add('show');
  });
  $('hint-aid').addEventListener('click', function () {
    if (balance() < COST_AID) return;
    closeOv('ov-hint');
    SAVE.spent += COST_AID; SAVE.stats.aids++;
    snap();
    var sol = G.level.solution, frac = G.aid === 0 ? 0.5 : 1;
    G.aid++;
    G.prog = { main: withIds(frac < 1 ? trimList(sol.main, frac) : sol.main), f1: withIds(frac < 1 ? trimList(sol.f1 || [], frac) : (sol.f1 || [])) };
    G.active = G.prog.main; renderAll(); save(); updateTotal(); SFX.lamp();
    toast(frac < 1 ? 'Ecco l\'inizio! Completa il programma e premi Play. (max 2★ in questo livello)' : 'Soluzione inserita. Premi Play! (max 2★ in questo livello)', 'good', 4200);
  });
  $('hint-skip').addEventListener('click', function () {
    if (balance() < COST_SKIP) return;
    closeOv('ov-hint');
    var L = G.level;
    SAVE.spent += COST_SKIP; SAVE.stats.skips++;
    if (!(SAVE.stars[L.id] > 0)) SAVE.skip[L.id] = true;
    if (G.ctx.mode === 'story') SAVE.current = Math.max(SAVE.current, Math.min(TOTAL, L.id + 1));
    save(); updateTotal(); checkAch();
    toast('Livello saltato. Puoi tornarci quando vuoi dalla mappa.', 'good', 3000);
    if (G.ctx.mode === 'story' && G.idx + 1 < TOTAL) loadLevel(G.idx + 1);
    else if (G.ctx.mode === 'daily') openTitle();
  });

  /* ---------- vittoria ---------- */
  var winAction = null;
  function showWin(info) {
    var L = G.level, mode = info.mode, last = mode === 'story' && L.id === TOTAL;
    var title = last ? 'Hai completato DomusLab!' : (info.stars === 3 ? 'Perfetto!' : 'Livello completato!');
    var msg = 'Cubi usati: <b>' + info.u + '</b>' + (L.par ? ' (par ' + L.par + ')' : '');
    msg += ' · Tempo: <b>' + fmt(info.ms) + '</b>' + (info.newTime ? ' 🏅 record!' : '');
    if (info.coinTotal) msg += '<br>Monete: <b>' + info.coins + '/' + info.coinTotal + '</b>' + (info.coins === info.coinTotal ? ' ✨' : '');
    if (info.score) msg += '<br>Punteggio: <b>' + info.score + '</b>' + (info.newBest ? ' 🏅 nuovo record!' : '');
    if (info.stars && info.stars < 3 && L.par) msg += '<br>Con ' + L.par + ' cubi o meno ottieni 3 stelle.';
    if (G.aid) msg += '<br>Hai usato un aiuto: massimo 2 stelle.';
    if (info.rewards && info.rewards.length) msg += '<br><span class="reward">' + info.rewards.join(' · ') + '</span>';
    if (mode === 'test') { title = 'Livello risolto!'; msg = 'Hai risolto il tuo livello con <b>' + info.u + '</b> cubi. Ora puoi condividerlo.'; }
    $('win-title').textContent = title;
    $('win-stats').innerHTML = msg;
    $('win-stars').style.display = info.stars ? '' : 'none';
    var nextLabel = 'Prossimo';
    if (mode === 'test') nextLabel = 'Torna all\'editor';
    else if (mode === 'daily' || mode === 'custom') nextLabel = 'Menu';
    else if (last) nextLabel = 'Fine';
    $('win-next-label').textContent = nextLabel;
    winAction = function () {
      $('ov-win').classList.remove('show');
      if (mode === 'test') { if (G.ctx.onBack) G.ctx.onBack(); }
      else if (mode === 'daily' || mode === 'custom') openTitle();
      else if (G.idx + 1 < TOTAL) loadLevel(G.idx + 1); else openTitle();
    };
    var ss = $('win-stars').querySelectorAll('.ic');
    ss.forEach(function (s) { s.classList.remove('on'); });
    $('ov-win').classList.add('show');
    ss.forEach(function (s, i) { if (i < (info.stars || 0)) setTimeout(function () { s.classList.add('on'); SFX.lamp(); }, 250 + i * 280); });
  }
  $('win-next').addEventListener('click', function () { if (winAction) winAction(); });
  $('win-retry').addEventListener('click', function () { $('ov-win').classList.remove('show'); resetRun(); });
  $('win-map').addEventListener('click', function () { $('ov-win').classList.remove('show'); if (G.ctx.mode === 'test' && G.ctx.onBack) G.ctx.onBack(); else openMap(); });

  /* ---------- sfida del giorno ---------- */
  function dailyIndex() {
    var s = todayKey(), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 20 + ((h >>> 0) % 900);
  }
  function startDaily() {
    ensureAudio(); closeOv('ov-title');
    loadLevel(dailyIndex(), { mode: 'daily' });
  }

  /* ---------- speedrun ---------- */
  function maxWorld() { return SAVE.unlockAll ? WORLDS_N : Math.max(1, Math.min(WORLDS_N, Math.ceil(SAVE.current / 10))); }
  function openSpeed() {
    var inp = $('speed-world'); inp.max = maxWorld(); inp.value = Math.min(+inp.value || 1, maxWorld());
    showSpeedTop(); $('ov-speed').classList.add('show');
  }
  function showSpeedTop() {
    var w = Math.max(1, Math.min(maxWorld(), +$('speed-world').value || 1)), t = SAVE.speed[w] || [];
    $('speed-top').innerHTML = t.length ? 'Migliori tempi · ' + t.map(function (x, i) { return (i + 1) + '. <b>' + fmt(x) + '</b>'; }).join(' &nbsp; ') : 'Nessun record in questo mondo: sii il primo!';
  }
  $('speed-world').addEventListener('input', showSpeedTop);
  $('speed-go').addEventListener('click', function () {
    var w = Math.max(1, Math.min(maxWorld(), +$('speed-world').value || 1));
    closeOv('ov-speed'); closeOv('ov-title'); ensureAudio();
    var ctx = { mode: 'speed', w: w, k: 0, ms: 0 };
    loadLevel((w - 1) * 10, ctx); startTimer();
    toast('Via! Il cronometro corre: 10 livelli di fila.', 'good', 2400);
  });
  function speedWin(info, token) {
    var c = G.ctx;
    if (c.k < 9) {
      toast('Livello ' + (c.k + 1) + '/10 fatto! ' + fmt(c.ms), 'good', 1100);
      setTimeout(function () {
        if (token !== G.token) return;
        var nc = { mode: 'speed', w: c.w, k: c.k + 1, ms: c.ms };
        loadLevel((c.w - 1) * 10 + nc.k, nc); startTimer();
      }, 1200);
      return;
    }
    var list = (SAVE.speed[c.w] = SAVE.speed[c.w] || []), ms = Math.round(c.ms), rank;
    list.push(ms); list.sort(function (a, b) { return a - b; }); rank = list.indexOf(ms) + 1; if (list.length > 5) list.length = 5;
    SAVE.stats.speedruns++; SAVE.coins += 30; save(); updateTotal(); checkAch();
    setTimeout(function () {
      if (token !== G.token) return;
      info.stars = 0; info.score = 0; info.rewards = ['Speedrun completata: +30 monete'];
      showWin(info);
      $('win-title').textContent = rank <= 5 && list[0] === ms ? 'Nuovo record di Speedrun!' : 'Speedrun completata!';
      $('win-stats').innerHTML = 'Mondo ' + c.w + ' · tempo totale <b>' + fmt(ms) + '</b>' + (rank <= 5 ? '<br>Sei al <b>' + rank + '°</b> posto nella tua classifica.' : '') + '<br><span class="reward">+30 monete</span>';
      $('win-next-label').textContent = 'Menu';
      winAction = function () { $('ov-win').classList.remove('show'); G.ctx = { mode: 'story' }; openTitle(); };
    }, 800);
  }

  /* ---------- mappa livelli ---------- */
  var mapWorld = 1;
  function worldProgress(w) {
    var done = 0, st = 0, a = (w - 1) * 10;
    for (var k = 0; k < 10; k++) { var L = LEVELS[a + k]; if (isDone(L.id)) done++; st += SAVE.stars[L.id] || 0; }
    return { done: done, stars: st };
  }
  function openMap(w) {
    if (w === undefined) w = G.level && G.ctx.mode === 'story' ? worldOf(G.level.id) : worldOf(Math.min(TOTAL, SAVE.current));
    mapWorld = Math.max(1, Math.min(WORLDS_N, w));
    renderMap(); $('ov-map').classList.add('show');
    var cur = $('map-body').querySelector('.wchip.cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function renderMap() {
    var body = $('map-body'); body.innerHTML = '';
    var th = theme(mapWorld), pr = worldProgress(mapWorld);
    var head = document.createElement('div'); head.className = 'map-head';
    head.style.setProperty('--wc', 'hsl(' + th.hue + ',80%,62%)');
    var feats = worldFeatures(mapWorld).map(function (f) { return D.FEAT_LABEL[f][0] + ' ' + D.FEAT_LABEL[f][1]; }).join(' · ');
    head.innerHTML = '<button class="icon-btn" id="mp-prev" title="Mondo precedente">‹</button>' +
      '<div class="mh-t"><div class="mh-i">' + th.icon + '</div><div><b>Mondo ' + mapWorld + ' · ' + th.title + '</b><span>' + pr.stars + ' / 30 ★ · ' + pr.done + '/10 livelli' + (feats ? '<br>' + feats : '') + '</span></div></div>' +
      '<button class="icon-btn" id="mp-next" title="Mondo successivo">›</button>';
    body.appendChild(head);
    var grid = document.createElement('div'); grid.className = 'world-grid';
    grid.style.setProperty('--wc', 'hsl(' + th.hue + ',80%,62%)');
    for (var j = 0; j < 10; j++) {
      var i = (mapWorld - 1) * 10 + j, L = LEVELS[i], ok = unlocked(i), s = SAVE.stars[L.id] || 0, sk = SAVE.skip[L.id] && !s;
      var b = document.createElement('button');
      b.className = 'node' + (s ? ' done' : '') + (sk ? ' skipped' : '') + (ok ? '' : ' locked') + (i === G.idx && G.ctx.mode === 'story' ? ' current' : '');
      var ic = (L.feat || []).map(function (f) { return D.FEAT_LABEL[f] ? D.FEAT_LABEL[f][0] : ''; }).join('');
      b.innerHTML = ok ? '<span>' + L.id + '</span><span class="st">' + (sk ? '<em>salt.</em>' : [1, 2, 3].map(function (n) { return '<svg class="ic' + (n <= s ? ' on' : '') + '"><use href="#i-star"/></svg>'; }).join('')) + '</span><span class="ft">' + ic + '</span>'
        : '<svg class="ic lk"><use href="#i-lock"/></svg>';
      b.disabled = !ok;
      (function (idx) { b.addEventListener('click', function () { closeOv('ov-map'); closeOv('ov-title'); loadLevel(idx); }); })(i);
      grid.appendChild(b);
    }
    body.appendChild(grid);
    var wl = document.createElement('div'); wl.className = 'wlist';
    wl.innerHTML = '<div class="wl-h">Tutti i mondi</div>';
    var wg = document.createElement('div'); wg.className = 'wgrid';
    for (var w = 1; w <= WORLDS_N; w++) {
      var tw = theme(w), p = worldProgress(w), a = (w - 1) * 10, open = unlocked(a) || unlocked(a + 9) || SAVE.unlockAll;
      var c = document.createElement('button');
      c.className = 'wchip' + (w === mapWorld ? ' cur' : '') + (p.done === 10 ? ' full' : '') + (open ? '' : ' locked');
      c.style.setProperty('--wc', 'hsl(' + tw.hue + ',75%,58%)');
      c.style.setProperty('--pr', (p.done * 10) + '%');
      c.title = 'Mondo ' + w + ' · ' + tw.title; c.textContent = w;
      (function (ww) { c.addEventListener('click', function () { mapWorld = ww; renderMap(); }); })(w);
      wg.appendChild(c);
    }
    wl.appendChild(wg); body.appendChild(wl);
    $('mp-prev').onclick = function () { mapWorld = Math.max(1, mapWorld - 1); renderMap(); };
    $('mp-next').onclick = function () { mapWorld = Math.min(WORLDS_N, mapWorld + 1); renderMap(); };
  }
  function jumpTo() {
    var n = parseInt($('map-jump').value, 10);
    if (!n || n < 1 || n > TOTAL) { toast('Scrivi un livello da 1 a ' + TOTAL, 'bad'); return; }
    if (!unlocked(n - 1)) { mapWorld = worldOf(n); renderMap(); toast('Il livello ' + n + ' è ancora bloccato.', 'bad'); return; }
    closeOv('ov-map'); closeOv('ov-title'); loadLevel(n - 1);
  }
  $('map-go').addEventListener('click', jumpTo);
  $('map-jump').addEventListener('keydown', function (e) { if (e.key === 'Enter') jumpTo(); });

  /* ---------- record e obiettivi ---------- */
  function openRecords() {
    var ts = totalStars(), rk = D.rankFor(ts), body = $('records-body'), html = '';
    html += '<div class="rank-box"><div class="rank-t">' + rk.name + '</div><div class="muted">' + ts + '★ guadagnate · ' + clearedCount() + '/' + TOTAL + ' livelli' + (rk.next ? ' · prossimo rango "' + rk.next.name + '" a ' + rk.next.at + '★' : '') + '</div></div>';
    var ids = Object.keys(SAVE.scores).map(Number).sort(function (a, b) { return SAVE.scores[b] - SAVE.scores[a]; }).slice(0, 10);
    html += '<h3>🏆 Migliori punteggi</h3>';
    html += ids.length ? '<table class="rec"><tr><th>#</th><th>Livello</th><th>Punti</th><th>Miglior tempo</th></tr>' + ids.map(function (id, i) {
      return '<tr><td>' + (i + 1) + '</td><td>Livello ' + id + '</td><td><b>' + SAVE.scores[id] + '</b></td><td>' + (SAVE.times[id] ? fmt(SAVE.times[id]) : '–') + '</td></tr>';
    }).join('') + '</table>' : '<p class="muted">Completa dei livelli per entrare in classifica.</p>';
    var sw = Object.keys(SAVE.speed);
    html += '<h3>⏱️ Speedrun</h3>';
    html += sw.length ? '<table class="rec"><tr><th>Mondo</th><th>Migliori 5 tempi</th></tr>' + sw.map(function (w) { return '<tr><td>' + w + ' · ' + theme(+w).title + '</td><td>' + SAVE.speed[w].map(function (x) { return fmt(x); }).join(' · ') + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">Nessuna speedrun ancora: provala dal menu!</p>';
    html += '<h3>📅 Sfida del giorno</h3><p class="muted">Serie attuale: <b>' + SAVE.daily.streak + '</b> · migliore: <b>' + SAVE.daily.best + '</b></p>';
    var got = D.ACH.filter(function (a) { return SAVE.ach[a.id]; }).length;
    html += '<h3>🎖️ Obiettivi <small class="muted">' + got + '/' + D.ACH.length + '</small></h3><div class="ach-grid">' + D.ACH.map(function (a) {
      return '<div class="ach' + (SAVE.ach[a.id] ? ' on' : '') + '"><span class="ai">' + a.icon + '</span><span><b>' + a.name + '</b><br><small>' + a.desc + '</small></span></div>';
    }).join('') + '</div>';
    body.innerHTML = html; $('ov-records').classList.add('show');
  }

  /* ---------- personaggi: schermata ---------- */
  function openSkins() {
    renderSkins(); $('ov-skins').classList.add('show');
    requestAnimationFrame(paintSkinPreviews);
  }
  function renderSkins() {
    $('skins-coins').textContent = SAVE.coins;
    var grid = $('skin-grid'); grid.innerHTML = '';
    var all = SK.list.concat([{ id: 'custom', name: 'Il tuo', price: 0 }]);
    all.forEach(function (s) {
      var owned = s.id === 'custom' || SAVE.owned.indexOf(s.id) >= 0, sel = SAVE.skin === s.id;
      var card = document.createElement('button');
      card.className = 'skin' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
      card.innerHTML = '<canvas data-skin="' + s.id + '"></canvas><b>' + s.name + '</b><span>' + (sel ? 'In uso' : owned ? 'Scegli' : '<svg class="ic"><use href="#i-coin"/></svg> ' + s.price) + '</span>';
      card.addEventListener('click', function () {
        if (owned) { SAVE.skin = s.id; save(); applySkin(); renderSkins(); requestAnimationFrame(paintSkinPreviews); SFX.click(); return; }
        if (SAVE.coins < s.price) { toast('Ti servono ' + s.price + ' monete: raccoglile nei livelli!', 'bad'); return; }
        confirmDlg('Comprare ' + s.name + '?', 'Costa ' + s.price + ' monete.', 'Compra', function () {
          SAVE.coins -= s.price; SAVE.owned.push(s.id); SAVE.skin = s.id; SAVE.stats.bought++;
          save(); applySkin(); updateTotal(); checkAch(); renderSkins(); requestAnimationFrame(paintSkinPreviews); SFX.buy();
        });
      });
      grid.appendChild(card);
    });
    $('custom-emoji').value = SAVE.customEmoji;
  }
  function paintSkinPreviews() {
    document.querySelectorAll('#skin-grid canvas').forEach(function (cv) { window.DomusStage.renderPreview(cv, skinById(cv.dataset.skin)); });
  }
  $('custom-emoji-use').addEventListener('click', function () {
    var v = $('custom-emoji').value.trim(); if (!v) return;
    SAVE.customEmoji = v; SAVE.customImg = null; SAVE.skin = 'custom'; save();
    buildCustom(function () { applySkin(); renderSkins(); requestAnimationFrame(paintSkinPreviews); });
  });
  $('custom-img-clear').addEventListener('click', function () {
    SAVE.customImg = null; save(); buildCustom(function () { applySkin(); renderSkins(); requestAnimationFrame(paintSkinPreviews); });
  });
  $('custom-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var cv = SK.spriteFromImage(img); SAVE.customImg = cv.toDataURL('image/png'); SAVE.skin = 'custom'; save();
        customCv = cv; applySkin(); renderSkins(); requestAnimationFrame(paintSkinPreviews);
        toast('Il tuo personaggio è pronto!', 'good');
      };
      img.onerror = function () { toast('Immagine non valida.', 'bad'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f); e.target.value = '';
  });

  /* ---------- overlay ---------- */
  function openOv(id) { $(id).classList.add('show'); }
  function closeOv(id) { $(id).classList.remove('show'); }
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeOv(b.dataset.close); }); });
  var confirmCb = null;
  function confirmDlg(title, text, yes, cb) {
    $('confirm-title').textContent = title; $('confirm-text').textContent = text;
    $('confirm-yes').textContent = yes || 'Conferma'; confirmCb = cb; $('ov-confirm').classList.add('show');
  }
  $('confirm-no').addEventListener('click', function () { closeOv('ov-confirm'); confirmCb = null; });
  $('confirm-yes').addEventListener('click', function () { closeOv('ov-confirm'); var cb = confirmCb; confirmCb = null; if (cb) cb(); });

  function openTitle() {
    cancelRun(); stopTimer();
    if (G.ctx.mode === 'speed' || G.ctx.mode === 'custom' || G.ctx.mode === 'test') { G.ctx = { mode: 'story' }; var i = Math.max(0, Math.min(TOTAL - 1, SAVE.current - 1)); loadLevel(i); }
    $('title-play-label').textContent = SAVE.current > 1 ? 'Continua · Livello ' + Math.min(TOTAL, SAVE.current) : 'Gioca';
    $('title-daily-label').textContent = SAVE.daily.done[todayKey()] ? 'Sfida del giorno ✓' : 'Sfida del giorno';
    var rk = D.rankFor(totalStars());
    $('title-sub').textContent = '1000 livelli in 100 mondi · rango: ' + rk.name;
    $('ov-title').classList.add('show');
  }
  $('title-play').addEventListener('click', function () {
    ensureAudio(); closeOv('ov-title');
    var i = Math.max(0, Math.min(TOTAL - 1, SAVE.current - 1));
    if (G.ctx.mode !== 'story' || G.idx !== i) loadLevel(i);
  });
  $('title-levels').addEventListener('click', function () { ensureAudio(); openMap(); });
  $('title-daily').addEventListener('click', startDaily);
  $('title-speed').addEventListener('click', function () { ensureAudio(); openSpeed(); });
  $('title-skins').addEventListener('click', function () { ensureAudio(); openSkins(); });
  $('title-records').addEventListener('click', function () { ensureAudio(); openRecords(); });
  $('title-settings').addEventListener('click', function () { ensureAudio(); openSettings(); });
  $('btn-home').addEventListener('click', openTitle);
  $('btn-map').addEventListener('click', function () { openMap(); });
  $('btn-skins').addEventListener('click', openSkins);
  $('btn-tip').addEventListener('click', function () { showTip(G.level.world || 1); });
  $('tip-ok').addEventListener('click', function () { $('tipcard').classList.remove('show'); });

  function openSettings() {
    $('set-sound').checked = SAVE.sound; $('set-music').checked = SAVE.music; $('set-fog').checked = SAVE.fog; $('set-unlock').checked = SAVE.unlockAll;
    $('ov-settings').classList.add('show');
  }
  $('btn-settings').addEventListener('click', openSettings);
  $('set-sound').addEventListener('change', function (e) { SAVE.sound = e.target.checked; save(); ensureAudio(); syncMusic(); });
  $('set-music').addEventListener('change', function (e) { SAVE.music = e.target.checked; save(); ensureAudio(); syncMusic(); });
  $('set-fog').addEventListener('change', function (e) { SAVE.fog = e.target.checked; save(); stage.setFog(SAVE.fog); updateControls(); });
  $('set-unlock').addEventListener('change', function (e) { SAVE.unlockAll = e.target.checked; save(); });
  $('set-skins').addEventListener('click', function () { closeOv('ov-settings'); openSkins(); });
  $('set-reset').addEventListener('click', function () {
    confirmDlg('Azzerare i progressi?', 'Perderai stelle, monete, record e personaggi e tornerai al livello 1.', 'Azzera', function () {
      var keep = { sound: SAVE.sound, music: SAVE.music, custom: SAVE.custom };
      try { localStorage.removeItem(KEY); localStorage.removeItem(DKEY); } catch (e) {}
      drafts = {};
      SAVE.stars = {}; SAVE.skip = {}; SAVE.spent = 0; SAVE.bonus = START_BONUS; SAVE.coins = 0; SAVE.cbest = {}; SAVE.times = {}; SAVE.scores = {};
      SAVE.current = 1; SAVE.tips = {}; SAVE.skin = 'domo'; SAVE.owned = FREE_SKINS.slice(); SAVE.speed = {}; SAVE.ach = {};
      SAVE.daily = { last: '', streak: 0, best: 0, done: {} };
      SAVE.stats = { coins: 0, portalWins: 0, doorWins: 0, trapWins: 0, moverWins: 0, dark: 0, speedruns: 0, dailies: 0, built: 0, bought: 0, aids: 0, skips: 0 };
      SAVE.sound = keep.sound; SAVE.music = keep.music; SAVE.custom = keep.custom;
      save(); updateTotal(); closeOv('ov-settings'); G.ctx = { mode: 'story' }; loadLevel(0);
    });
  });

  document.addEventListener('keydown', function (e) {
    var tg = e.target;
    if (tg && (tg.tagName === 'TEXTAREA' || (tg.tagName === 'INPUT' && tg.type !== 'checkbox'))) { if (e.key === 'Enter' && tg.type === 'number' && tg.closest('.lanes')) tg.blur(); return; }
    var open = document.querySelector('.ov.show');
    if (open) { if (e.key === 'Escape' && open.id !== 'ov-title') open.classList.remove('show'); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
    if (e.key === 'Enter') { e.preventDefault(); $('btn-play').click(); }
    else if (e.key === 'Escape') resetRun();
    else if (e.key === 's' || e.key === 'S') $('btn-step').click();
  });

  /* ---------- avvio ---------- */
  if ('ResizeObserver' in window) new ResizeObserver(function () { stage.resize(); }).observe($('stage-wrap'));
  window.addEventListener('resize', function () { stage.resize(); });
  buildCustom(function () {
    updateTotal(); updateControls();
    loadLevel(Math.max(0, Math.min(TOTAL - 1, SAVE.current - 1)));
    openTitle(); syncMusicOnFirstTouch();
  });
  function syncMusicOnFirstTouch() {
    if (!SAVE.music) return;
    var h = function () { ensureAudio(); window.removeEventListener('pointerdown', h); };
    window.addEventListener('pointerdown', h);
  }

  window.DomusApp = {
    E: E, LEVELS: LEVELS, SAVE: SAVE, save: save, toast: toast, openOv: openOv, closeOv: closeOv, confirmDlg: confirmDlg, ensureAudio: ensureAudio,
    SFX: SFX, loadCustom: loadCustom, strip: strip, withIds: withIds, theme: theme, openTitle: openTitle, checkAch: checkAch, updateTotal: updateTotal,
    startPlayCustom: function (lv) { closeOv('ov-title'); loadCustom(lv, { mode: 'custom' }); startTimer(); }, WORLDS_N: WORLDS_N
  };
  window.DomusGame = {
    loadLevel: loadLevel, state: G, stage: stage, save: SAVE, balance: balance,
    loadSolution: function () { G.prog = { main: withIds(G.level.solution.main), f1: withIds(G.level.solution.f1 || []) }; G.active = G.prog.main; renderAll(); },
    dailyIndex: dailyIndex
  };
})();
