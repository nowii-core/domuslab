#!/usr/bin/env node
/* DomusLab — generatore dei 90 livelli.
 *
 * Ogni livello nasce da un PROGRAMMA DI RIFERIMENTO: la mappa viene costruita
 * attorno al percorso che quel programma compie, poi il motore (engine.js) lo
 * esegue davvero sulla mappa finale. Se non vince, il livello viene scartato.
 * Quindi ogni livello è risolvibile per costruzione, e "par" è il numero di
 * cubi del programma di riferimento.
 *
 * Uso: node tools/generate-levels.js   (riscrive js/levels.js)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

/* ---------- utilità ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const chance = (r, p) => r() < p;

const F = () => ({ t: 'F' }), L = () => ({ t: 'L' }), R = () => ({ t: 'R' }), A = () => ({ t: 'A' });
const CALL = () => ({ t: 'CALL' });
const REP = (n, body) => ({ t: 'REP', n, body });
const WHILE = (c, body, _n) => ({ t: 'WHILE', c, body, _n });
const IF = (c, body, els) => ({ t: 'IF', c, body, else: els || [] });
const MAKERS = { F, L, R, A };
const seq = (s) => s.split('').map((ch) => MAKERS[ch]());

function clean(n) {
  const o = { t: n.t };
  if (n.n !== undefined) o.n = n.n;
  if (n.c !== undefined) o.c = n.c;
  if (n.body) o.body = n.body.map(clean);
  if (n.t === 'IF') o.else = (n.else || []).map(clean);
  return o;
}
const cleanProg = (p) => ({ main: p.main.map(clean), f1: (p.f1 || []).map(clean) });
const netRot = (list) => ((list.filter((n) => n.t === 'R').length - list.filter((n) => n.t === 'L').length) % 4 + 4) % 4;

/* ---------- configurazione dei mondi ---------- */
const WORLDS = [
  { name: 'Ingresso',    allowed: ['F', 'L', 'R'] },
  { name: 'Salotto',     allowed: ['F', 'L', 'R', 'A'] },
  { name: 'Cucina',      allowed: ['F', 'L', 'R', 'A', 'REP'] },
  { name: 'Giardino',    allowed: ['F', 'L', 'R', 'A', 'REP'] },
  { name: 'Garage',      allowed: ['F', 'L', 'R', 'A', 'REP', 'CALL'] },
  { name: 'Soffitta',    allowed: ['F', 'L', 'R', 'A', 'REP', 'CALL', 'WHILE'] },
  { name: 'Laboratorio', allowed: ['F', 'L', 'R', 'A', 'REP', 'CALL', 'WHILE', 'IF'] },
  { name: 'Serra',       allowed: ['F', 'L', 'R', 'A', 'REP', 'CALL', 'WHILE', 'IF'] },
  { name: 'Torre',       allowed: ['F', 'L', 'R', 'A', 'REP', 'CALL', 'WHILE', 'IF'] }
];
function slackFor(world, idx) {
  if (world >= 10) return world <= 14 ? 1 : 0;
  if (world <= 2) return 3;
  if (world === 3) return 2;
  if (world <= 7) return 1;
  if (world === 8) return 1;
  return idx >= 5 ? 0 : 1;
}

/* ---------- griglie ---------- */
const mkGrid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const toLevel = (grid, start) => ({ rows: grid.map((r) => r.join('')), start: start.slice() });
function wins(grid, start, prog) {
  return E.simulate(toLevel(grid, start), prog).status === 'win';
}
function trim(grid, start) {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  grid.forEach((row, y) => row.forEach((c, x) => { if (c !== '.') { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }));
  const g = [];
  for (let y = minY; y <= maxY; y++) g.push(grid[y].slice(minX, maxX + 1));
  return { grid: g, start: [start[0] - minX, start[1] - minY, start[2]] };
}
function pad(grid, start, n) {
  const w = grid[0].length + 2 * n, h = grid.length + 2 * n, g = mkGrid(w, h);
  grid.forEach((row, y) => row.forEach((c, x) => { g[y + n][x + n] = c; }));
  return { grid: g, start: [start[0] + n, start[1] + n, start[2]] };
}
function rotate(grid, start) { // 90° orari
  const h = grid.length, w = grid[0].length, g = mkGrid(h, w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[x][h - 1 - y] = grid[y][x];
  return { grid: g, start: [h - 1 - start[1], start[0], (start[2] + 1) % 4] };
}
function addDecoys(grid, start, prog, r, nFloor, nWall) {
  const P = pad(grid, start, 1); grid = P.grid; start = P.start;
  const want = nFloor + nWall; let added = 0, tries = 0;
  const near = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy] || [])[x + dx] && grid[y + dy][x + dx] !== '.');
  while (added < want && tries++ < 120) {
    const x = ri(r, 0, grid[0].length - 1), y = ri(r, 0, grid.length - 1);
    if (grid[y][x] !== '.' || !near(x, y)) continue;
    grid[y][x] = added < nFloor ? 'o' : '#';
    if (wins(grid, start, prog)) added++; else grid[y][x] = '.';
  }
  return trim(grid, start);
}

/* ---------- traccia a griglia aperta (famiglie "percorso") ---------- */
function trace(prog, d0) {
  let x = 0, y = 0, d = d0, steps = 0, fCount = 0;
  const visit = new Map(), acts = [], fpos = [{ x: 0, y: 0 }];
  const key = (a, b) => a + ',' + b;
  visit.set(key(0, 0), 1);
  function run(list) {
    for (const n of list) {
      if (++steps > 500) throw new Error('troppo lungo');
      switch (n.t) {
        case 'F': { const dd = E.DIRS[d]; x += dd[0]; y += dd[1]; fCount++; fpos.push({ x, y }); visit.set(key(x, y), (visit.get(key(x, y)) || 0) + 1); break; }
        case 'L': d = (d + 3) % 4; break;
        case 'R': d = (d + 1) % 4; break;
        case 'A': acts.push({ x, y, f: fpos.length - 1 }); break;
        case 'REP': for (let k = 0; k < n.n; k++) run(n.body); break;
        case 'WHILE': for (let k = 0; k < n._n; k++) run(n.body); break;
        case 'CALL': run(prog.f1); break;
        default: throw new Error('nodo non supportato: ' + n.t);
      }
    }
  }
  run(prog.main);
  return { visit, acts, end: { x, y, d }, fCount, fpos };
}

function buildFromPath(prog, spec, r) {
  let tr;
  try { tr = trace(prog, spec.d0); } catch (e) { return null; }
  const tiles = tr.visit.size;
  if (tiles < spec.minTiles) return null;
  if (tr.fCount - (tiles - 1) > Math.floor(tr.fCount * (spec.maxRevisit === undefined ? 0.15 : spec.maxRevisit))) return null;
  if (tr.end.x === 0 && tr.end.y === 0) return null;
  const lampKeys = new Set();
  for (const a of tr.acts) { const k = a.x + ',' + a.y; if (lampKeys.has(k)) return null; lampKeys.add(k); }
  if (lampKeys.has(tr.end.x + ',' + tr.end.y)) return null;

  let tilesList = [...tr.visit.keys()].map((k) => k.split(',').map(Number));
  let lamps = tr.acts.map((a) => ({ x: a.x, y: a.y }));
  let end = { x: tr.end.x, y: tr.end.y };
  let portal = null;
  if (spec.portal) { // il percorso viene diviso in due isole collegate da una coppia di portali
    const n = tr.fpos.length - 1;
    if (n < 9) return null;
    const k = ri(r, 3, n - 3);
    const p1 = tr.fpos.slice(0, k + 1), p2 = tr.fpos.slice(k);
    const ext = (a) => ({ x0: Math.min(...a.map((p) => p.x)), x1: Math.max(...a.map((p) => p.x)), y0: Math.min(...a.map((p) => p.y)), y1: Math.max(...a.map((p) => p.y)) });
    const e1 = ext(p1), e2 = ext(p2);
    let dx, dy;
    if (chance(r, 0.5)) { dx = e1.x1 - e2.x0 + 2 + ri(r, 0, 1); dy = ri(r, -2, 2); } else { dy = e1.y1 - e2.y0 + 2 + ri(r, 0, 1); dx = ri(r, -2, 2); }
    const X = tr.fpos[k], Y = { x: X.x + dx, y: X.y + dy };
    const m = new Map();
    p1.forEach((p) => m.set(p.x + ',' + p.y, [p.x, p.y]));
    p2.forEach((p) => m.set((p.x + dx) + ',' + (p.y + dy), [p.x + dx, p.y + dy]));
    tilesList = [...m.values()];
    lamps = tr.acts.map((a) => (a.f >= k ? { x: a.x + dx, y: a.y + dy } : { x: a.x, y: a.y }));
    end = { x: tr.end.x + dx, y: tr.end.y + dy };
    if (lamps.some((l) => (l.x === X.x && l.y === X.y) || (l.x === Y.x && l.y === Y.y))) return null;
    if ((end.x === X.x && end.y === X.y) || (end.x === Y.x && end.y === Y.y)) return null;
    portal = { X, Y };
  }
  const xs = tilesList.map((p) => p[0]), ys = tilesList.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  if (w > spec.maxDim || h > spec.maxDim) return null;
  let grid = mkGrid(w, h);
  tilesList.forEach(([px, py]) => { grid[py - minY][px - minX] = 'o'; });
  lamps.forEach((a) => { grid[a.y - minY][a.x - minX] = 'L'; });
  grid[end.y - minY][end.x - minX] = 'G';
  if (portal) { grid[portal.X.y - minY][portal.X.x - minX] = '1'; grid[portal.Y.y - minY][portal.Y.x - minX] = '1'; }
  let start = [-minX, -minY, spec.d0];
  if (!wins(grid, start, prog)) return null;
  const dec = addDecoys(grid, start, prog, r, spec.decoyF || 0, spec.decoyW || 0);
  if (dec.grid[0].length > spec.maxDim + 1 || dec.grid.length > spec.maxDim + 1) return null;
  return { grid: dec.grid, start: dec.start, prog };
}

/* ---------- famiglie "arena" (mappa prima, poi esecuzione) ---------- */
function completeArena(grid, start, prog, r, opts) {
  opts = opts || {};
  let g = grid.map((row) => row.slice());
  let res = E.simulate(toLevel(g, start), prog, { free: true });
  if (res.status !== 'ok') return null;
  const gx = res.final.x, gy = res.final.y;
  if (gx === start[0] && gy === start[1]) return null;
  if (g[gy][gx] === 'L') { g[gy][gx] = 'o'; res = E.simulate(toLevel(g, start), prog, { free: true }); if (res.status !== 'ok' || res.final.x !== gx || res.final.y !== gy) return null; }
  const P = E.prepare(toLevel(g, start));
  const lit = res.final.lit;
  P.lamps.forEach((l, i) => { if (!lit[i]) g[l.y][l.x] = 'o'; });
  if (opts.minLamps && lit.filter(Boolean).length < opts.minLamps) return null;
  g[gy][gx] = 'G';
  if (!wins(g, start, prog)) return null;
  return { grid: g, start, prog };
}

function ringGrid(w, h, nLamps, r) {
  const g = mkGrid(w, h);
  const border = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { g[y][x] = 'o'; border.push([x, y]); }
  for (let i = 0; i < nLamps; i++) { const [x, y] = pick(r, border); if (!(x === 0 && y === 0)) g[y][x] = 'L'; }
  return g;
}
function spiralGrid(S, lampP, r) {
  const n = S - 1, segs = [n, n, n];
  for (let len = n - 2; len > 0; len -= 2) segs.push(len, len);
  const g = mkGrid(S, S);
  let x = 0, y = 0, d = 1; g[0][0] = 'o';
  segs.forEach((len) => { for (let i = 0; i < len; i++) { x += E.DIRS[d][0]; y += E.DIRS[d][1]; g[y][x] = (r() < lampP) ? 'L' : 'o'; } d = (d + 1) % 4; });
  g[0][0] = 'o';
  return { g, segs };
}
const WALKER = () => [IF('lamp', [A()]), IF('free', [F()], [R()])];

function arenaRing(r, w, h, lamps, orient) {
  const g = ringGrid(w, h, lamps, r);
  const perim = 2 * (w + h) - 4, lap = perim + 4;
  const N = ri(r, Math.floor(lap * 0.55), Math.floor(lap * 1.25));
  const prog = { main: [REP(N, WALKER())] };
  return finishArena(g, [0, 0, 1], prog, r, orient, 1);
}
function arenaSpiralIf(r, S, lampP, orient) {
  const { g, segs } = spiralGrid(S, lampP, r);
  const total = segs.reduce((a, b) => a + b, 0) + segs.length;
  const N = ri(r, Math.floor(total * 0.6), Math.floor(total * 0.98));
  const prog = { main: [REP(N, WALKER())] };
  return finishArena(g, [0, 0, 1], prog, r, orient, 1);
}
function arenaSpiralWhile(r, S, lampP, orient) {
  const { g, segs } = spiralGrid(S, lampP, r);
  const k = ri(r, Math.max(3, segs.length - 3), segs.length - 1);
  const prog = { main: [REP(k, [WHILE('free', [F(), A()], 0), R()])] };
  return finishArena(g, [0, 0, 1], prog, r, orient, 1);
}
function arenaSerpentine(r, k, m, lampP, finalRow, ifLamp) {
  const rows = 2 * m + 1, w = k + 1;
  const g = mkGrid(w, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) g[y][x] = (!(x === 0 && y === 0) && r() < lampP) ? 'L' : 'o';
  const row = () => (ifLamp ? WHILE('free', [IF('lamp', [A()]), F()], 0) : WHILE('free', [F(), A()], 0));
  const main = [REP(m, [row(), R(), F(), R(), row(), L(), F(), L()])];
  if (finalRow) main.push(row());
  return finishArena(g, [0, 0, 1], { main }, r, 0, 1);
}
function finishArena(g, start, prog, r, orient, minLamps) {
  let grid = g, st = start;
  for (let i = 0; i < (orient || 0); i++) { const q = rotate(grid, st); grid = q.grid; st = q.start; }
  return completeArena(grid, st, prog, r, { minLamps });
}

/* ---------- famiglie "percorso": programmi ---------- */
const BODIES_PLAIN = [
  () => [F(), R()], () => [F(), F(), R()], () => [F(), R(), F(), L()], () => [F(), L(), F(), R()],
  () => [F(), F(), L()], () => [F(), F(), F(), R()], () => [F(), F(), R(), F(), L()],
  () => [F(), F(), L(), F(), R()], () => [F(), R(), F(), F(), L(), F()]
];
const BODIES_LAMP = [
  () => [F(), A()], () => [F(), F(), A()], () => [F(), A(), F(), R()], () => [F(), R(), F(), A(), L()],
  () => [F(), F(), R(), A()], () => [F(), A(), R(), F(), L()], () => [F(), F(), A(), R(), F(), A(), L()]
];
function poolBody(r, lampy, t) {
  const pool = lampy ? BODIES_LAMP : BODIES_PLAIN;
  const hi = Math.min(pool.length, 3 + Math.round(t * (pool.length - 3)) + 1);
  return pick(r, pool.slice(0, hi))();
}
function repCount(r, body, t) { return netRot(body) === 0 ? ri(r, 2, 3 + Math.round(t * 3)) : ri(r, 2, 3); }

function progW3(r, t) {
  const lampy = t >= 0.2 && chance(r, 0.55);
  const body = poolBody(r, lampy, t);
  return { main: [...seq(pick(r, ['', 'F', 'FF', 'FR', 'FL'])), REP(repCount(r, body, t), body), ...seq(pick(r, ['', 'F', 'FF', 'FFF']))] };
}
function progW4(r, t) {
  const mode = t < 0.4 ? pick(r, ['two', 'big']) : pick(r, ['two', 'nest', 'nest', 'big']);
  const lampy = chance(r, 0.6);
  if (mode === 'two') {
    const b1 = poolBody(r, lampy, t), b2 = poolBody(r, lampy && chance(r, 0.5), t);
    return { main: [REP(repCount(r, b1, t), b1), ...seq(pick(r, ['R', 'L', 'FR', 'FL', 'RF'])), REP(repCount(r, b2, t), b2), ...seq(pick(r, ['', 'F']))] };
  }
  if (mode === 'big') {
    const body = [...poolBody(r, lampy, t), ...poolBody(r, false, t * 0.3)].slice(0, 6);
    return { main: [...seq(pick(r, ['', 'F', 'FR'])), REP(repCount(r, body, 0), body), ...seq(pick(r, ['', 'F', 'FF']))] };
  }
  const k = ri(r, 2, 4);
  const seg = () => REP(ri(r, 2, 4), lampy ? [F(), A()] : [F()]);
  const outer = chance(r, 0.5)
    ? { body: [REP(k, lampy ? [F(), A()] : [F()]), R()], n: ri(r, 2, 3) }
    : { body: [REP(k, lampy ? [F(), A()] : [F()]), pick(r, [R, L])(), seg(), pick(r, [R, L])()], n: ri(r, 2, 3) };
  return { main: [REP(outer.n, outer.body), ...seq(pick(r, ['', 'F', 'FF']))] };
}
function progW5(r, t) {
  const f1 = seq(pick(r, ['FF', 'FFF', 'FA', 'FFA', 'FAF', 'FFR', 'FRF', 'FFRF', 'FAFA', 'FFAF']));
  const mode = t < 0.5 ? 'chain' : pick(r, ['chain', 'rep', 'rep']);
  const stairs = chance(r, 0.6);
  if (mode === 'chain') {
    const k = ri(r, 3, 4 + Math.round(t * 3));
    const main = [];
    for (let i = 0; i < k; i++) {
      main.push(CALL());
      if (i < k - 1) main.push(...seq(stairs ? (i % 2 ? 'L' : 'R') : pick(r, ['R', 'L', 'RF', 'LF'])));
    }
    return { main, f1 };
  }
  const n = ri(r, 2, 4);
  const inner = stairs ? [CALL(), R(), CALL(), L()] : [CALL(), pick(r, [R, L])()];
  const rep = REP(netRot(inner) === 0 ? n : Math.min(n, 3), inner);
  return { main: [...seq(pick(r, ['', 'F'])), rep, CALL()], f1 };
}
function progW6(r, t) {
  const lampy = chance(r, 0.5);
  const body = () => (lampy ? [F(), A()] : [F()]);
  const k = () => ri(r, 2, 4 + Math.round(t * 3));
  const mode = t < 0.45 ? 'chain' : pick(r, ['chain', 'sq']);
  if (mode === 'chain') {
    const segs = ri(r, 2, 3 + Math.round(t * 2));
    const main = [];
    for (let i = 0; i < segs; i++) {
      main.push(WHILE('free', body(), k()));
      if (i < segs - 1) main.push(i % 2 ? L() : R());
    }
    return { main };
  }
  const kk = ri(r, 2, 5), n = ri(r, 2, 3);
  return { main: [REP(n, [WHILE('free', body(), kk), R()]), ...seq(pick(r, ['', 'F']))] };
}

/* ---------- livelli manuali per i mondi 1 e 2 ---------- */
const W1 = ['FFF', 'FFFFF', 'FFRFF', 'FRFLF', 'FFRFFLFF', 'FFLFFRFF', 'FRFFLFFRF', 'FFFRFFFLFF', 'FRFLFRFLFRF', 'FFFRFFLFFRFFF'];
const W2 = ['FFAFF', 'FAFAF', 'FFAFRFAF', 'FAFRFFAFLF', 'FFAFFRFAFF', 'FAFAFRFAFAFLF', 'FRFAFLFAFRFAFF', 'FFAFRFFAFLFFAFF', 'FAFRFAFLFAFRFAFF', 'FFAFFRFAFFLFFAFRFAF'];

/* ---------- assemblaggio ---------- */
function makeCandidate(id, attempt) {
  if (id > 90) return makeCandidateBig(id, attempt);
  const world = Math.floor((id - 1) / 10) + 1, idx = (id - 1) % 10, t = idx / 9;
  const r = mulberry32(id * 7919 + attempt * 104729 + 13);
  const dimBase = [6, 7, 8, 9, 9, 10, 10, 10, 11][world - 1];
  const d0 = pick(r, [1, 2]);
  const pathSpec = (prog, extra) => buildFromPath(prog, Object.assign({
    d0, maxDim: dimBase, minTiles: 4, decoyF: 0, decoyW: 0
  }, extra), r);

  if (world === 1) return pathSpec({ main: seq(W1[idx]) }, { maxDim: 9, maxRevisit: 0.34, decoyF: idx >= 3 ? ri(r, 0, 2) : 0, decoyW: idx >= 5 ? ri(r, 0, 2) : 0 });
  if (world === 2) return pathSpec({ main: seq(W2[idx]) }, { maxDim: 10, maxRevisit: 0.34, decoyF: ri(r, 1, 3), decoyW: ri(r, 0, 2) });
  const dec = { decoyF: ri(r, 1, 3 + Math.round(t * 4)), decoyW: ri(r, 0, 3) };
  if (world === 3) return pathSpec(progW3(r, t), Object.assign({ minTiles: 9 + Math.round(t * 6) }, dec));
  if (world === 4) return pathSpec(progW4(r, t), Object.assign({ minTiles: 12 + Math.round(t * 8) }, dec));
  if (world === 5) return pathSpec(progW5(r, t), Object.assign({ minTiles: 11 + Math.round(t * 9) }, dec));
  if (world === 6) {
    if (idx <= 5) return pathSpec(progW6(r, t), Object.assign({ minTiles: 9 + Math.round(t * 8), maxRevisit: 0.1 }, dec));
    if (idx <= 8) return arenaSerpentine(r, ri(r, 3, 5 + (idx - 6)), ri(r, 2, 3), 0.28, chance(r, 0.5), false);
    return arenaSpiralWhile(r, 7, 0.3, ri(r, 0, 3));
  }
  if (world === 7) {
    if (idx <= 4) return arenaRing(r, ri(r, 3, 4 + (idx >> 1)), ri(r, 3, 4 + (idx >> 1)), ri(r, 2, 4), ri(r, 0, 3));
    if (idx <= 6) return arenaSpiralIf(r, 5, 0.3, ri(r, 0, 3));
    if (idx <= 8) return arenaSerpentine(r, ri(r, 4, 6), ri(r, 2, 3), 0.3, chance(r, 0.5), true);
    return arenaSpiralIf(r, 7, 0.3, ri(r, 0, 3));
  }
  // mondi 8 e 9: combinazioni, mappe più grandi, limiti stretti
  const big = world === 9;
  const pick8 = idx % 5;
  if (pick8 === 0) return pathSpec(progMix(r, t, big), Object.assign({ minTiles: 14 + (big ? 4 : 0), maxDim: dimBase }, dec));
  if (pick8 === 1) return arenaRing(r, ri(r, 5, big ? 8 : 7), ri(r, 4, big ? 7 : 6), ri(r, 4, 7), ri(r, 0, 3));
  if (pick8 === 2) return arenaSerpentine(r, ri(r, 5, big ? 8 : 6), ri(r, 2, big ? 4 : 3), 0.3, chance(r, 0.5), chance(r, 0.5));
  if (pick8 === 3) return pathSpec(progMix(r, t, big), Object.assign({ minTiles: 16 + (big ? 4 : 0), maxDim: dimBase }, dec));
  return big ? arenaSpiralIf(r, 9, 0.28, ri(r, 0, 3)) : arenaSpiralIf(r, 7, 0.3, ri(r, 0, 3));
}
function progMix(r, t, big) {
  const lampy = chance(r, 0.6);
  const f1 = seq(pick(r, ['FF', 'FA', 'FFA', 'FAF', 'FFR', 'FRF', 'FFRF']));
  const choice = pick(r, ['nestcall', 'repcall', 'whilecall', 'nest2']);
  const stair = () => [CALL(), R(), CALL(), L()];
  if (choice === 'nestcall') return { main: [REP(ri(r, 2, 3), [REP(ri(r, 2, 3), [CALL()]), pick(r, [R, L])(), ...(big ? seq('F') : [])]), CALL()], f1 };
  if (choice === 'repcall') return { main: [REP(ri(r, 3, big ? 5 : 4), stair()), ...seq(pick(r, ['', 'F']))], f1 };
  if (choice === 'whilecall') return { main: [WHILE('free', [CALL()], ri(r, 2, 4)), R(), WHILE('free', [CALL()], ri(r, 2, 4)), L(), WHILE('free', lampy ? [F(), A()] : [F()], ri(r, 2, 5))], f1 };
  const inner = () => REP(ri(r, 2, 4), lampy ? [F(), A()] : [F()]);
  return { main: [REP(ri(r, 2, 3), [inner(), R(), inner(), L()]), ...seq(pick(r, ['', 'F']))], f1: [] };
}

/* ---------- livelli 91-1000: mondi di maestria, sempre più grandi e stretti ---------- */
function progCompose(r, t) {
  const useF1 = chance(r, 0.55);
  const f1 = useF1 ? seq(pick(r, ['FF', 'FA', 'FFA', 'FAF', 'FFR', 'FRF', 'FFRF', 'FAFA', 'FFAF'])) : [];
  const lampy = chance(r, 0.6);
  const body = () => (lampy ? [F(), A()] : [F()]);
  const comps = [
    () => REP(ri(r, 2, 4), poolBody(r, lampy, 0.7)),
    () => REP(ri(r, 2, 5), body()),
    () => REP(ri(r, 2, 3), [REP(ri(r, 2, 4), body()), pick(r, [R, L])()]),
    () => WHILE('free', body(), ri(r, 2, 6)),
    () => REP(ri(r, 2, 3), [WHILE('free', body(), ri(r, 2, 4)), pick(r, [R, L])()])
  ];
  if (useF1) { comps.push(() => CALL(), () => CALL(), () => REP(ri(r, 2, 4), [CALL(), pick(r, [R, L])()])); }
  const n = ri(r, 2 + Math.floor(t * 2), 3 + Math.floor(t * 4));
  const main = [];
  for (let i = 0; i < n; i++) {
    main.push(pick(r, comps)());
    if (i < n - 1) main.push(...seq(pick(r, ['R', 'L', 'FR', 'FL', 'RF', 'LF'])));
  }
  return { main, f1 };
}
const BIG_FAMILIES = ['compose', 'compose', 'compose', 'compose', 'ring', 'spiralIf', 'spiralWhile', 'serp', 'mix', 'mix'];
function makeCandidateBig(id, attempt) {
  const t = (id - 91) / 909;
  const r = mulberry32(id * 7919 + attempt * 104729 + 977);
  const plan = getPlan(id);
  const fam = plan.portal ? 'compose' : BIG_FAMILIES[(Math.floor(mulberry32(id * 31 + 5)() * BIG_FAMILIES.length) + Math.floor(attempt / 250)) % BIG_FAMILIES.length];
  const maxDim = Math.min(14, 11 + Math.round(t * 3)) + (plan.portal ? 3 : 0);
  const d0 = pick(r, [1, 2]);
  const dec = { decoyF: ri(r, 2, 4 + Math.round(t * 6)), decoyW: ri(r, 0, 5) };
  const pathSpec = (prog, extra) => buildFromPath(prog, Object.assign({ d0, maxDim, minTiles: 14, decoyF: 0, decoyW: 0, portal: plan.portal }, extra), r);
  const o = ri(r, 0, 3);
  switch (fam) {
    case 'compose': return pathSpec(progCompose(r, t), Object.assign({ minTiles: 16 + Math.round(t * 16), maxRevisit: 0.12 }, dec));
    case 'mix': return pathSpec(progMix(r, t, true), Object.assign({ minTiles: 18 + Math.round(t * 8) }, dec));
    case 'ring': return arenaRing(r, ri(r, 5, 6 + Math.round(t * 6)), ri(r, 4, 5 + Math.round(t * 5)), ri(r, 4, 6 + Math.round(t * 8)), o);
    case 'spiralIf': return arenaSpiralIf(r, pick(r, t < 0.4 ? [7, 9] : [9, 11]), 0.28, o);
    case 'spiralWhile': return arenaSpiralWhile(r, pick(r, t < 0.4 ? [9, 11] : [11, 13, 15]), 0.3, o);
    default: return arenaSerpentine(r, ri(r, 5, 7 + Math.round(t * 5)), ri(r, 2, 3 + Math.round(t * 3)), 0.3, chance(r, 0.5), chance(r, 0.5));
  }
}
function maxRep(list) {
  let m = 0;
  list.forEach((n) => { if (n.n) m = Math.max(m, n.n); if (n.body) m = Math.max(m, maxRep(n.body)); if (n.else) m = Math.max(m, maxRep(n.else)); });
  return m;
}

/* ---------- decorazioni: monete, porte e chiavi, trappole, sentinelle ---------- */
function getPlan(id) {
  const world = Math.ceil(id / 10), t = id > 90 ? (id - 91) / 909 : 0;
  const r = mulberry32(id * 6007 + 3);
  const plan = { coins: 0, portal: false, door: false, traps: 0, movers: 0, must: false };
  if (id >= 12) plan.coins = chance(r, world === 10 ? 0.95 : 0.3 + 0.3 * Math.min(1, t * 2)) ? ri(r, 1, 3) : 0;
  if (world === 11) { plan.portal = true; plan.must = true; }
  if (world === 12) { plan.door = true; plan.must = true; }
  if (world === 13) { plan.traps = ri(r, 1, 2); plan.must = true; }
  if (world === 14) { plan.movers = ri(r, 1, 2); plan.must = true; }
  if (world >= 15) {
    plan.portal = chance(r, 0.2);
    plan.door = chance(r, 0.22 + 0.12 * t);
    plan.traps = chance(r, 0.28 + 0.2 * t) ? ri(r, 1, 2 + (t > 0.5 ? 1 : 0)) : 0;
    plan.movers = chance(r, 0.2 + 0.2 * t) ? ri(r, 1, 2) : 0;
  }
  return plan;
}
function analyze(lv, prog) {
  const res = E.simulate(lv, prog);
  const key = (x, y) => x + ',' + y;
  const occ = new Map(), order = [];
  const startOcc = { arr: 0, ticks: [] };
  occ.set(key(lv.start[0], lv.start[1]), [startOcc]);
  let cur = startOcc;
  for (const ev of res.events) {
    if (ev.op === 'F') {
      const pos = ev.tp || ev, k = key(pos.x, pos.y), o = { arr: ev.t, ticks: [ev.t] };
      if (!occ.has(k)) { occ.set(k, []); order.push(k); }
      occ.get(k).push(o); cur = o;
    } else if (ev.op === 'L' || ev.op === 'R' || ev.op === 'A') cur.ticks.push(ev.t);
  }
  return { res, occ, order };
}
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function decorate(lv, prog, plan, r) {
  const grid = lv.rows.map((s) => s.split(''));
  const start = lv.start;
  const hazards = [], movers = [], feats = new Set();
  const mkLv = () => ({ rows: grid.map((g) => g.join('')), start, hazards, movers });
  const ok = () => E.simulate(mkLv(), prog).status === 'win';
  const taken = new Set();
  const cands = () => {
    const a = analyze(mkLv(), prog);
    const list = a.order.filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return a.occ.get(k).length === 1 && grid[y][x] === 'o' && !taken.has(k);
    });
    return { a, list };
  };
  const at = (k) => k.split(',').map(Number);

  if (plan.door) {
    const { list } = cands();
    if (list.length >= 6) {
      const i = ri(r, 0, list.length - 4), j = ri(r, i + 3, list.length - 1), color = ri(r, 0, 2);
      const [kx, ky] = at(list[i]), [dx, dy] = at(list[j]);
      grid[ky][kx] = 'rby'[color]; grid[dy][dx] = 'RBY'[color];
      if (ok()) { feats.add('door'); taken.add(list[i]); taken.add(list[j]); } else { grid[ky][kx] = 'o'; grid[dy][dx] = 'o'; }
    }
  }
  for (let n = 0; n < plan.traps; n++) {
    const { a, list } = cands();
    let done = false;
    for (const k of shuffle(r, list).slice(0, 14)) {
      const T = a.occ.get(k)[0].ticks, arr = a.occ.get(k)[0].arr, [x, y] = at(k);
      for (const p of shuffle(r, [2, 3, 3, 4])) {
        const on = (p === 4 && chance(r, 0.5)) ? 2 : 1;
        for (const ph of shuffle(r, [...Array(p).keys()])) {
          const h = { x, y, p, on, ph };
          if (T.some((t) => E.hazActive(h, t))) continue;
          let near = false;
          for (let t = arr - 3; t <= arr + 3; t++) if (t > 0 && !T.includes(t) && E.hazActive(h, t)) near = true;
          if (!near) continue;
          hazards.push(h);
          if (ok()) { done = true; taken.add(k); feats.add('trap'); } else hazards.pop();
          if (done) break;
        }
        if (done) break;
      }
      if (done) break;
    }
  }
  for (let n = 0; n < plan.movers; n++) {
    const { a, list } = cands();
    let done = false;
    for (const k of shuffle(r, list).slice(0, 14)) {
      const T = a.occ.get(k)[0].ticks;
      if (T.length !== 1) continue;
      const [x, y] = at(k);
      for (const [ddx, ddy] of shuffle(r, E.DIRS)) {
        const qx = x + ddx, qy = y + ddy;
        if (qy < 0 || qx < 0 || qy >= grid.length || qx >= grid[0].length) continue;
        const qk = qx + ',' + qy;
        if (a.occ.has(qk) || taken.has(qk) || (grid[qy][qx] !== '.' && grid[qy][qx] !== 'o')) continue;
        const was = grid[qy][qx];
        grid[qy][qx] = 'o';
        movers.push({ a: [x, y], b: [qx, qy], ph: (T[0] + 1) % 2 });
        if (ok()) { done = true; taken.add(k); taken.add(qk); feats.add('mover'); } else { movers.pop(); grid[qy][qx] = was; }
        if (done) break;
      }
      if (done) break;
    }
  }
  if (plan.coins) {
    const { list } = cands();
    for (const k of shuffle(r, list).slice(0, plan.coins)) { const [x, y] = at(k); grid[y][x] = 'C'; }
    if (!ok()) return null;
    // tieni solo le monete che il programma di riferimento raccoglie davvero
    const res = E.simulate(mkLv(), prog);
    const P = E.prepare(mkLv());
    P.coins.forEach((c, i) => { if (!res.final || !res.events.some((e) => e.coin === i)) grid[c.y][c.x] = 'o'; });
    if (grid.some((row) => row.includes('C'))) feats.add('coins');
  }
  if (!ok()) return null;
  return { rows: grid.map((g) => g.join('')), hazards, movers, feats };
}

function finalize(id, cand) {
  const world = Math.floor((id - 1) / 10) + 1, idx = (id - 1) % 10;
  const prog = cand.prog;
  const par = E.blockCount(prog);
  const limit = par + slackFor(world, idx);
  if (maxRep(prog.main) > 99 || maxRep(prog.f1 || []) > 99) return null;
  const level = toLevel(cand.grid, cand.start);
  const res = E.simulate(level, prog);
  if (res.status !== 'win') return null;
  if (world >= 3 && res.actions <= limit) return null; // senza cicli basterebbe un cubo per azione
  if (res.actions > 900) return null;
  const P = E.prepare(level);
  if (P.w > 16 || P.h > 16) return null;
  const plan = getPlan(id);
  if (plan.must && plan.portal && !level.rows.some((row) => /[1-9]/.test(row))) return null;
  const dec = decorate(level, prog, plan, mulberry32(id * 4421 + 17));
  if (!dec) return null;
  if (plan.must) {
    if (plan.door && !dec.feats.has('door')) return null;
    if (plan.traps && !dec.feats.has('trap')) return null;
    if (plan.movers && !dec.feats.has('mover')) return null;
  }
  const rows = dec.rows;
  const rec = {
    id, world, rows, start: level.start, allowed: WORLDS[Math.min(world, 9) - 1].allowed,
    limit, par, steps: res.actions, lamps: P.lamps.length, solution: cleanProg(prog)
  };
  const coins = rows.join('').split('C').length - 1;
  if (coins) rec.coins = coins;
  if (dec.hazards.length) rec.hazards = dec.hazards;
  if (dec.movers.length) rec.movers = dec.movers;
  const feat = [];
  if (coins) feat.push('coins');
  if (rows.some((row) => /[1-9]/.test(row))) feat.push('portal');
  if (dec.feats.has('door')) feat.push('door');
  if (dec.hazards.length) feat.push('trap');
  if (dec.movers.length) feat.push('mover');
  if (feat.length) rec.feat = feat;
  return rec;
}

const TOTAL_LEVELS = 1000;
function main() {
  const out = [], seen = new Set();
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    let rec = null;
    for (let attempt = 0; attempt < 6000 && !rec; attempt++) {
      let cand = null;
      try { cand = makeCandidate(id, attempt); } catch (e) { cand = null; }
      if (!cand) continue;
      const r = finalize(id, cand);
      if (!r) continue;
      const sig = JSON.stringify([r.rows, r.solution]);
      if (seen.has(sig)) continue;
      seen.add(sig); rec = r; rec.attempt = attempt;
    }
    if (!rec) { console.error('Impossibile generare il livello ' + id); process.exit(1); }
    out.push(rec);
  }
  const data = out.map((l) => { const c = Object.assign({}, l); delete c.attempt; return c; });
  const js = '/* GENERATO da tools/generate-levels.js — non modificare a mano. */\n' +
    'var DOMUS_LEVELS = ' + JSON.stringify(data) + ';\n' +
    "if (typeof module === 'object' && module.exports) module.exports = DOMUS_LEVELS;\n";
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'levels.js'), js);
  console.log('Livelli generati: ' + out.length);
  console.log('id    mondo par lim passi lampade mappa  tentativi');
  out.forEach((l) => { if (l.id <= 90 ? l.id % 10 === 0 : l.id % 50 === 0 || l.id === 91 || l.id === 1000) console.log(String(l.id).padStart(4), String(l.world).padStart(5), String(l.par).padStart(4), String(l.limit).padStart(3), String(l.steps).padStart(5), String(l.lamps).padStart(7), ' ' + l.rows[0].length + 'x' + l.rows.length, ' ' + l.attempt); });
  const avg = (a, b) => { const xs = out.filter((l) => l.id >= a && l.id <= b); return (xs.reduce((s, l) => s + l.par, 0) / xs.length).toFixed(1) + ' par, ' + (xs.reduce((s, l) => s + l.steps, 0) / xs.length).toFixed(0) + ' passi'; };
  const cnt = (f) => out.filter((l) => (l.feat || []).includes(f)).length;
  console.log('livelli con monete: ' + cnt('coins') + ', portali: ' + cnt('portal') + ', porte: ' + cnt('door') + ', trappole: ' + cnt('trap') + ', sentinelle: ' + cnt('mover'));
  [[91, 200], [201, 400], [401, 600], [601, 800], [801, 1000]].forEach(([a, b]) => console.log('media livelli ' + a + '-' + b + ': ' + avg(a, b)));
}
main();
