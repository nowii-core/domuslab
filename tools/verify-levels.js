#!/usr/bin/env node
/* Verifica che tutti i livelli siano coerenti e risolvibili (meccaniche incluse).
 * Uso: node tools/verify-levels.js   (esce con codice 1 se qualcosa non va) */
'use strict';
const E = require('../js/engine.js');
const LEVELS = require('../js/levels.js');
let errors = 0;
const fail = (id, msg) => { errors++; if (errors < 40) console.error('Livello ' + id + ': ' + msg); };
const allowedOf = (list, set) => list.forEach((n) => {
  if (!set.has(n.t)) throw new Error('blocco non consentito ' + n.t);
  if (n.body) allowedOf(n.body, set);
  if (n.else) allowedOf(n.else, set);
});
if (LEVELS.length !== 1000) fail('-', 'attesi 1000 livelli, trovati ' + LEVELS.length);
const stats = { coins: 0, portal: 0, door: 0, trap: 0, mover: 0 };
LEVELS.forEach((l, i) => {
  if (l.id !== i + 1) fail(l.id, 'id non sequenziale');
  if (l.world !== Math.ceil(l.id / 10)) fail(l.id, 'mondo errato');
  const P = E.prepare(l);
  if (!P.goal) fail(l.id, 'manca la centralina');
  const sol = E.simulate(l, l.solution);
  if (sol.status !== 'win') fail(l.id, 'la soluzione di riferimento non vince (' + sol.reason + ')');
  if (E.blockCount(l.solution) !== l.par) fail(l.id, 'par non coincide con la soluzione');
  if (l.limit < l.par) fail(l.id, 'limite inferiore al par');
  try { const set = new Set(l.allowed); allowedOf(l.solution.main, set); allowedOf(l.solution.f1 || [], set); } catch (e) { fail(l.id, e.message); }
  if (E.simulate(l, { main: [], f1: [] }).status === 'win') fail(l.id, 'si vince con il programma vuoto');
  const cell = P.cells[l.start[1]] && P.cells[l.start[1]][l.start[0]];
  if (!cell || cell === '.' || cell === '#') fail(l.id, 'partenza non valida');
  P.portals.forEach(() => {});
  const digits = {}; P.cells.forEach((r) => r.forEach((c) => { if (c >= '1' && c <= '9') digits[c] = (digits[c] || 0) + 1; }));
  Object.keys(digits).forEach((d) => { if (digits[d] !== 2) fail(l.id, 'portale ' + d + ' senza coppia'); });
  (l.hazards || []).forEach((h) => { if (!(h.p >= 2 && h.on >= 1 && h.on < h.p)) fail(l.id, 'trappola non valida'); const c = P.cells[h.y][h.x]; if (c !== 'o') fail(l.id, 'trappola su casella non libera'); });
  (l.movers || []).forEach((m) => { if (Math.abs(m.a[0] - m.b[0]) + Math.abs(m.a[1] - m.b[1]) !== 1) fail(l.id, 'sentinella non valida'); });
  if (l.coins !== undefined && l.coins !== P.coins.length) fail(l.id, 'numero monete errato');
  if (P.coins.length) stats.coins++; if (P.portals.length) stats.portal++; if (P.doors.length) stats.door++; if (P.hazards.length) stats.trap++; if (P.movers.length) stats.mover++;
});
console.log(errors ? errors + ' errori' : 'OK: 1000 livelli verificati, tutte le soluzioni vincono.', JSON.stringify(stats));
process.exit(errors ? 1 : 0);
