/* DomusLab — motore logico puro (funziona nel browser e in Node).
 *
 * Mappa: array di stringhe. Caratteri:
 *   '.' vuoto (si cade)      'o' pavimento      '#' muro (si sbatte)
 *   'L' lampada              'G' centralina (traguardo)      'C' moneta
 *   '1'..'9' portali (ogni cifra compare due volte: entri in uno ed esci dall'altro)
 *   'r' 'b' 'y' chiavi (rossa, blu, gialla)   'R' 'B' 'Y' porte dello stesso colore
 * Oggetti a tempo (il tempo è il numero di azioni F/L/R/A eseguite):
 *   level.hazards = [{x,y,p,on,ph}]  trappola: attiva quando ((t+ph) % p) < on
 *   level.movers  = [{a:[x,y], b:[x,y], ph}]  sentinella: sta in a quando (t+ph) è pari, altrimenti in b
 * Direzioni: 0 = nord, 1 = est, 2 = sud, 3 = ovest.
 * Programma: { main: [nodo], f1: [nodo] }
 * Nodi: {t:'F'|'L'|'R'|'A'|'CALL'} | {t:'REP', n, body} |
 *       {t:'WHILE', c, body} | {t:'IF', c, body, else}
 * Condizioni: 'free' (davanti libero), 'blocked' (davanti ostacolo), 'lamp' (sono su una lampada spenta)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DomusEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var MAX_ACTIONS = 5000;
  var MAX_DEPTH = 12;
  var KEY_CH = { r: 0, b: 1, y: 2 };
  var DOOR_CH = { R: 0, B: 1, Y: 2 };

  function hazActive(h, t) { return ((t + h.ph) % h.p) < h.on; }
  function moverPos(m, t) { return ((t + m.ph) % 2 === 0) ? m.a : m.b; }

  function prepare(level) {
    if (level._p) return level._p;
    var h = level.rows.length, w = 0, i;
    for (i = 0; i < h; i++) w = Math.max(w, level.rows[i].length);
    var lamps = [], coins = [], keys = [], doors = [], goal = null;
    var lampAt = {}, coinAt = {}, keyAt = {}, portalTo = {}, ports = {};
    var cells = level.rows.map(function (r, y) {
      var row = [];
      for (var x = 0; x < w; x++) {
        var ch = r[x] || '.', k = x + ',' + y;
        row.push(ch);
        if (ch === 'L') { lampAt[k] = lamps.length; lamps.push({ x: x, y: y }); }
        else if (ch === 'G') goal = { x: x, y: y };
        else if (ch === 'C') { coinAt[k] = coins.length; coins.push({ x: x, y: y }); }
        else if (KEY_CH[ch] !== undefined) { keyAt[k] = KEY_CH[ch]; keys.push({ x: x, y: y, color: KEY_CH[ch] }); }
        else if (DOOR_CH[ch] !== undefined) doors.push({ x: x, y: y, color: DOOR_CH[ch] });
        else if (ch >= '1' && ch <= '9') { (ports[ch] = ports[ch] || []).push({ x: x, y: y }); }
      }
      return row;
    });
    var portals = [];
    Object.keys(ports).forEach(function (id) {
      var p = ports[id];
      if (p.length === 2) {
        portalTo[p[0].x + ',' + p[0].y] = p[1]; portalTo[p[1].x + ',' + p[1].y] = p[0];
        portals.push({ id: id, a: p[0], b: p[1] });
      }
    });
    var P = {
      w: w, h: h, cells: cells, lamps: lamps, goal: goal, lampAt: lampAt,
      coins: coins, coinAt: coinAt, keys: keys, keyAt: keyAt, doors: doors, portals: portals, portalTo: portalTo,
      hazards: level.hazards || [], movers: level.movers || []
    };
    Object.defineProperty(level, '_p', { value: P, enumerable: false, writable: true, configurable: true });
    return P;
  }

  function Stop(reason) { this.reason = reason; }

  /* Esegue un programma e restituisce la lista completa degli eventi.
   * opts.free = true: non valuta la vittoria (usato dal generatore). */
  function simulate(level, program, opts) {
    opts = opts || {};
    var P = prepare(level);
    var st = {
      x: level.start[0], y: level.start[1], d: level.start[2],
      lit: P.lamps.map(function () { return false; }),
      coin: P.coins.map(function () { return false; }),
      keys: [false, false, false]
    };
    var events = [], actions = 0, time = 0, status = null, reason = null;

    function cellAt(x, y) { return (x < 0 || y < 0 || x >= P.w || y >= P.h) ? '.' : P.cells[y][x]; }
    function passable(c) {
      if (c === '.' || c === '#') return false;
      var dr = DOOR_CH[c];
      if (dr !== undefined) return st.keys[dr];
      return true;
    }
    function isFree() {
      var dd = DIRS[st.d];
      return passable(cellAt(st.x + dd[0], st.y + dd[1]));
    }
    function cond(c) {
      if (c === 'free') return isFree();
      if (c === 'blocked') return !isFree();
      if (c === 'lamp') { var i = P.lampAt[st.x + ',' + st.y]; return i !== undefined && !st.lit[i]; }
      return false;
    }
    function tick() { if (++actions > MAX_ACTIONS) throw new Stop('loop'); }
    // Vittoria immediata: Domo è sulla centralina e tutte le luci sono accese.
    function checkWin() {
      if (opts.free || !P.goal) return;
      if (st.x === P.goal.x && st.y === P.goal.y && st.lit.every(Boolean)) throw new Stop('__win');
    }
    // Dopo ogni azione passa il tempo: trappole e sentinelle possono colpire.
    function afterAction(ev) {
      time++; ev.t = time;
      var i;
      for (i = 0; i < P.hazards.length; i++) {
        var hz = P.hazards[i];
        if (hz.x === st.x && hz.y === st.y && hazActive(hz, time)) {
          events.push({ id: ev.id, op: 'zap', kind: 'trap', x: st.x, y: st.y, t: time });
          throw new Stop('trap');
        }
      }
      for (i = 0; i < P.movers.length; i++) {
        var mp = moverPos(P.movers[i], time);
        if (mp[0] === st.x && mp[1] === st.y) {
          events.push({ id: ev.id, op: 'zap', kind: 'crush', x: st.x, y: st.y, t: time });
          throw new Stop('crush');
        }
      }
      checkWin();
    }
    function runList(list, depth) { for (var i = 0; i < list.length; i++) runNode(list[i], depth); }

    function runNode(n, depth) {
      tick();
      var dd, nx, ny, c, i, k, ev;
      switch (n.t) {
        case 'F':
          dd = DIRS[st.d]; nx = st.x + dd[0]; ny = st.y + dd[1]; c = cellAt(nx, ny);
          if (c === '.') { events.push({ id: n.id, op: 'fall', x: nx, y: ny, d: st.d }); throw new Stop('fall'); }
          if (c === '#') { events.push({ id: n.id, op: 'bump', x: st.x, y: st.y, d: st.d }); throw new Stop('bump'); }
          if (DOOR_CH[c] !== undefined && !st.keys[DOOR_CH[c]]) {
            events.push({ id: n.id, op: 'bump', x: st.x, y: st.y, d: st.d, door: DOOR_CH[c] }); throw new Stop('locked');
          }
          st.x = nx; st.y = ny;
          ev = { id: n.id, op: 'F', x: nx, y: ny, d: st.d };
          var to = P.portalTo[nx + ',' + ny];
          if (to) { st.x = to.x; st.y = to.y; ev.tp = { x: to.x, y: to.y }; }
          var pk = st.x + ',' + st.y;
          i = P.coinAt[pk];
          if (i !== undefined && !st.coin[i]) { st.coin[i] = true; ev.coin = i; }
          i = P.keyAt[pk];
          if (i !== undefined && !st.keys[i]) { st.keys[i] = true; ev.key = i; }
          events.push(ev); afterAction(ev);
          break;
        case 'L':
          st.d = (st.d + 3) % 4; ev = { id: n.id, op: 'L', x: st.x, y: st.y, d: st.d }; events.push(ev); afterAction(ev); break;
        case 'R':
          st.d = (st.d + 1) % 4; ev = { id: n.id, op: 'R', x: st.x, y: st.y, d: st.d }; events.push(ev); afterAction(ev); break;
        case 'A':
          i = P.lampAt[st.x + ',' + st.y]; k = -1;
          if (i !== undefined && !st.lit[i]) { st.lit[i] = true; k = i; }
          ev = { id: n.id, op: 'A', x: st.x, y: st.y, d: st.d, lamp: k }; events.push(ev); afterAction(ev);
          break;
        case 'REP':
          for (k = 0; k < n.n; k++) { events.push({ id: n.id, op: 'iter', k: k }); runList(n.body, depth); }
          break;
        case 'WHILE':
          for (;;) {
            var v = cond(n.c);
            events.push({ id: n.id, op: 'check', v: v });
            if (!v) break;
            runList(n.body, depth);
            tick();
          }
          break;
        case 'IF':
          var t = cond(n.c);
          events.push({ id: n.id, op: 'check', v: t });
          runList(t ? n.body : (n.else || []), depth);
          break;
        case 'CALL':
          if (depth >= MAX_DEPTH) throw new Stop('loop');
          events.push({ id: n.id, op: 'iter' });
          runList(program.f1 || [], depth + 1);
          break;
      }
    }

    try { runList(program.main || [], 0); }
    catch (e) {
      if (e instanceof Stop) { if (e.reason === '__win') status = 'win'; else { status = 'fail'; reason = e.reason; } }
      else throw e;
    }

    var allLit = st.lit.every(Boolean);
    if (!status) {
      if (opts.free) status = 'ok';
      else if (!(program.main && program.main.length)) { status = 'fail'; reason = 'empty'; }
      else {
        var atGoal = !P.goal || (st.x === P.goal.x && st.y === P.goal.y);
        if (atGoal && allLit) status = 'win';
        else {
          status = 'fail';
          reason = atGoal ? 'nolamps' : (allLit ? 'nogoal' : 'both');
        }
      }
    }
    var acts = 0;
    for (var j = 0; j < events.length; j++) { var o = events[j].op; if (o === 'F' || o === 'L' || o === 'R' || o === 'A') acts++; }
    var coinsGot = 0;
    for (j = 0; j < st.coin.length; j++) if (st.coin[j]) coinsGot++;
    return {
      status: status, reason: reason, events: events, actions: acts, time: time,
      coins: coinsGot, coinTotal: P.coins.length,
      final: { x: st.x, y: st.y, d: st.d, lit: st.lit.slice(), keys: st.keys.slice() }
    };
  }

  /* Numero di cubi usati (ogni nodo = 1 cubo, contenitori inclusi). */
  function countList(list) {
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      n++;
      if (list[i].body) n += countList(list[i].body);
      if (list[i].else) n += countList(list[i].else);
    }
    return n;
  }
  function blockCount(program) { return countList(program.main || []) + countList(program.f1 || []); }

  return {
    DIRS: DIRS, prepare: prepare, simulate: simulate, blockCount: blockCount, MAX_ACTIONS: MAX_ACTIONS,
    hazActive: hazActive, moverPos: moverPos, KEY_CH: KEY_CH, DOOR_CH: DOOR_CH
  };
});
