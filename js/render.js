/* DomusLab — rendering isometrico su canvas 2D. */
(function (root) {
  'use strict';
  var E = root.DomusEngine;
  var TAU = Math.PI * 2;
  var TW = 100, TH = 50, SLAB = 15, CUBE = 46;
  var WORLD_HUES = [218, 272, 24, 142, 352, 190, 312, 166, 44];
  var KEY_HUES = [2, 212, 48];

  function hsl(h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function Stage(canvas, opts) {
    opts = opts || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = !!opts.preview;
    this.level = null; this.P = null;
    this.hue = 218;
    this.tweens = []; this.parts = []; this.confetti = [];
    this.epoch = 0;
    this.shake = 0; this.flash = 0; this.time = 0;
    this.last = performance.now();
    this.robot = { x: 0, y: 0, ang: 0, hop: 0, fall: 0, pulse: 0, d: 0, scale: 1 };
    this.skin = root.DomusSkins ? root.DomusSkins.list[0] : null;
    this.fog = false; this.discovered = {};
    this.lampLit = []; this.lampAnim = []; this.lampPop = [];
    this.coinGot = []; this.keyGot = []; this.keysHeld = [false, false, false];
    this.tick = 0; this.tickVis = 0; this.hazAnim = [];
    this.goalAnim = 0;
    this.sfx = function () {};
    this.cssW = 0; this.cssH = 0; this.S = 1; this.ox = 0; this.oy = 0; this.dpr = 1;
    this.theme = root.DomusThemes.forWorld(1);
    this.motes = [];
    this.initAmbient();
    if (!this.preview) {
      var self = this;
      this.paused = false;
      this.loop = function (now) { if (!self.paused) self.frame(now); else self.last = now; requestAnimationFrame(self.loop); };
      requestAnimationFrame(this.loop);
    }
  }

  Stage.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = Math.max(120, r.width); this.cssH = Math.max(120, r.height);
    this.cv.width = Math.round(this.cssW * dpr); this.cv.height = Math.round(this.cssH * dpr);
    this.dpr = dpr; this.fogCv = null;
    this.layout();
  };

  Stage.prototype.layout = function () {
    if (!this.P) return;
    var w = this.P.w, h = this.P.h;
    var minX = -h * TW / 2, maxX = w * TW / 2;
    var minY = -(CUBE + 78), maxY = (w + h) * TH / 2 + SLAB + 10;
    var bw = maxX - minX, bh = maxY - minY;
    this.S = clamp(Math.min((this.cssW - 36) / bw, (this.cssH - 28) / bh), 0.2, 1.7);
    this.ox = this.cssW / 2 - (minX + bw / 2) * this.S;
    this.oy = this.cssH / 2 - (minY + bh / 2) * this.S;
  };

  Stage.prototype.setSkin = function (skin) { this.skin = skin; };
  Stage.prototype.setFog = function (on) { this.fog = !!on; if (on) this.discoverAround(this.robot.x, this.robot.y, 2); };

  Stage.prototype.setLevel = function (level, world) {
    this.cancelAll();
    this.level = level;
    this.P = E.prepare(level);
    this.theme = root.DomusThemes.forWorld(world || 1);
    this.hue = this.theme.hue;
    this.initAmbient();
    this.parts = []; this.confetti = [];
    this.discovered = {};
    this.reset();
    var s = level.start;
    this.discoverAround(s[0], s[1], 2);
    if (this.P.goal) this.discoverAround(this.P.goal.x, this.P.goal.y, 1);
    this.layout();
  };

  Stage.prototype.reset = function () {
    this.cancelAll();
    var s = this.level.start, P = this.P;
    this.robot = { x: s[0], y: s[1], ang: s[2] * Math.PI / 2, hop: 0, fall: 0, pulse: 0, d: s[2], scale: 1 };
    var i;
    this.lampLit = []; this.lampAnim = []; this.lampPop = [];
    for (i = 0; i < P.lamps.length; i++) { this.lampLit.push(false); this.lampAnim.push(0); this.lampPop.push(-1); }
    this.coinGot = P.coins.map(function () { return false; });
    this.keyGot = P.keys.map(function () { return false; });
    this.keysHeld = [false, false, false];
    this.tick = 0; this.tickVis = 0;
    this.hazAnim = P.hazards.map(function (h) { return E.hazActive(h, 0) ? 1 : 0; });
    this.goalAnim = 0; this.shake = 0; this.flash = 0; this.confetti = [];
  };

  Stage.prototype.litCount = function () { var c = 0; for (var i = 0; i < this.lampLit.length; i++) if (this.lampLit[i]) c++; return c; };
  Stage.prototype.coinCount = function () { var c = 0; for (var i = 0; i < this.coinGot.length; i++) if (this.coinGot[i]) c++; return c; };

  Stage.prototype.discoverAround = function (x, y, r) {
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r + 1) this.discovered[(x + dx) + ',' + (y + dy)] = 1;
  };

  /* ---------- animazioni ---------- */
  Stage.prototype.tween = function (dur, fn) {
    var self = this;
    return new Promise(function (res) { self.tweens.push({ t0: performance.now(), dur: Math.max(1, dur), fn: fn, res: res }); });
  };
  Stage.prototype.cancelAll = function () {
    this.epoch++;
    var t = this.tweens; this.tweens = [];
    for (var i = 0; i < t.length; i++) t[i].res();
  };
  Stage.prototype.updateTweens = function (now) {
    var list = this.tweens.slice();
    for (var i = 0; i < list.length; i++) {
      var tw = list[i], k = (now - tw.t0) / tw.dur;
      if (k >= 1) { tw.fn(1); var ix = this.tweens.indexOf(tw); if (ix >= 0) this.tweens.splice(ix, 1); tw.res(); }
      else tw.fn(Math.max(0, k));
    }
  };

  Stage.prototype.advanceTick = function (t, dur) {
    var self = this, from = this.tickVis;
    this.tick = t;
    this.tween(dur, function (k) { self.tickVis = lerp(from, t, k); });
  };

  Stage.prototype.apply = function (ev, dur) {
    var self = this, rb = this.robot, ep = this.epoch;
    var alive = function () { return ep === self.epoch; };
    if (ev.t !== undefined && (ev.op === 'F' || ev.op === 'L' || ev.op === 'R' || ev.op === 'A')) this.advanceTick(ev.t, dur);
    switch (ev.op) {
      case 'F':
        var fx = rb.x, fy = rb.y, d1 = ev.tp ? dur * 0.7 : dur;
        this.sfx('step');
        return this.tween(d1, function (k) {
          var e = ease(k);
          rb.x = lerp(fx, ev.x, e); rb.y = lerp(fy, ev.y, e);
          rb.hop = Math.sin(Math.PI * k) * 14;
          if (k === 1) { rb.hop = 0; rb.x = ev.x; rb.y = ev.y; if (!ev.tp) self.dust(ev.x, ev.y, 5); }
        }).then(function () {
          if (!alive()) return;
          if (ev.tp) {
            self.sfx('portal'); self.burst(ev.x, ev.y, 'rgba(190,140,255,', 22);
            return self.tween(dur * 0.3, function (k) { rb.scale = 1 - k; }).then(function () {
              if (!alive()) return;
              rb.x = ev.tp.x; rb.y = ev.tp.y; self.burst(ev.tp.x, ev.tp.y, 'rgba(120,220,255,', 22);
              return self.tween(dur * 0.3, function (k) { rb.scale = k; });
            });
          }
        }).then(function () {
          if (!alive()) return;
          self.discoverAround(Math.round(rb.x), Math.round(rb.y), 2);
          if (ev.coin !== undefined) { self.coinGot[ev.coin] = true; self.burst(rb.x, rb.y, 'rgba(255,214,102,', 20); self.sfx('coin'); }
          if (ev.key !== undefined) {
            self.keysHeld[ev.key] = true;
            for (var i = 0; i < self.P.keys.length; i++) if (self.P.keys[i].x === Math.round(rb.x) && self.P.keys[i].y === Math.round(rb.y)) self.keyGot[i] = true;
            self.burst(rb.x, rb.y, 'rgba(255,255,255,', 18); self.sfx('key');
          }
        });
      case 'L': case 'R':
        var a0 = rb.ang, da = (ev.op === 'R' ? 1 : -1) * Math.PI / 2;
        this.sfx('turn');
        return this.tween(dur, function (k) {
          rb.ang = a0 + da * ease(k); rb.hop = Math.sin(Math.PI * k) * 5;
          if (k === 1) { rb.hop = 0; rb.d = ev.d; }
        });
      case 'A':
        var done = false;
        return this.tween(dur, function (k) {
          rb.pulse = Math.sin(Math.PI * k);
          if (!done && k > 0.35) {
            done = true;
            if (ev.lamp >= 0) {
              self.lampLit[ev.lamp] = true; self.lampPop[ev.lamp] = performance.now();
              var l = self.P.lamps[ev.lamp]; self.sparks(l.x, l.y);
              self.sfx('lamp');
            } else { self.dust(rb.x, rb.y, 3, true); self.sfx('nope'); }
          }
          if (k === 1) rb.pulse = 0;
        });
      case 'fall':
        var sx = rb.x, sy = rb.y;
        this.sfx('fall');
        return this.tween(dur * 2.2, function (k) {
          var m = Math.min(1, k / 0.35);
          rb.x = lerp(sx, ev.x, ease(m) * 0.9); rb.y = lerp(sy, ev.y, ease(m) * 0.9);
          rb.fall = k < 0.3 ? 0 : Math.pow((k - 0.3) / 0.7, 2);
        });
      case 'bump':
        var bx = rb.x, by = rb.y, dd = E.DIRS[ev.d];
        this.sfx('bump');
        return this.tween(dur * 1.4, function (k) {
          var m = k < 0.4 ? ease(k / 0.4) : 1 - ease((k - 0.4) / 0.6);
          rb.x = bx + dd[0] * 0.3 * m; rb.y = by + dd[1] * 0.3 * m;
          if (k > 0.35 && k < 0.45) { self.shake = 1; self.flash = 1; }
          if (k === 1) { rb.x = bx; rb.y = by; }
        });
      case 'zap':
        this.sfx('zap'); this.shake = 1; this.flash = 1;
        this.burst(ev.x, ev.y, 'rgba(255,80,100,', 30);
        return this.tween(dur * 1.6, function (k) { rb.fall = 0; rb.scale = 1 - 0.5 * ease(k); rb.pulse = 1 - k; });
    }
    return Promise.resolve();
  };

  Stage.prototype.win = function () {
    var cols = ['#ffd166', '#06d6a0', '#4da3ff', '#ff6fae', '#b57bff', '#ffffff'];
    for (var i = 0; i < 170; i++) {
      this.confetti.push({
        x: this.cssW * (0.15 + Math.random() * 0.7), y: -20 - Math.random() * this.cssH * 0.5,
        vx: (Math.random() - 0.5) * 140, vy: 120 + Math.random() * 240, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, c: cols[i % cols.length]
      });
    }
  };

  Stage.prototype.dust = function (gx, gy, n, grey) {
    var p = this.proj(gx + 0.5, gy + 0.5, 4);
    for (var i = 0; i < n; i++) this.parts.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 30, life: 0.5, max: 0.5, s: 3 + Math.random() * 3, c: grey ? 'rgba(160,170,200,' : 'rgba(255,255,255,', g: 40 });
  };
  Stage.prototype.burst = function (gx, gy, col, n) {
    var p = this.proj(gx + 0.5, gy + 0.5, 26);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = 40 + Math.random() * 140;
      this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.7, max: 0.7, s: 2 + Math.random() * 3, c: col, g: 110 });
    }
  };
  Stage.prototype.sparks = function (gx, gy) { this.burst(gx, gy, 'rgba(255,214,102,', 26); };

  /* ---------- proiezione e primitive ---------- */
  Stage.prototype.proj = function (gx, gy, gz) { return [(gx - gy) * TW / 2, (gx + gy) * TH / 2 - (gz || 0)]; };
  Stage.prototype.poly = function (pts, fill, stroke, lw) {
    var c = this.ctx; c.beginPath();
    for (var i = 0; i < pts.length; i++) { var p = this.proj(pts[i][0], pts[i][1], pts[i][2]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  };
  Stage.prototype.box = function (gx, gy, w, d, z0, h, cT, cL, cR, edge) {
    var x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2, z1 = z0 + h;
    this.poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], cL);
    this.poly([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], cR);
    this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cT, edge, 1);
  };
  Stage.prototype.glow = function (px, py, r, col) {
    var c = this.ctx, g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill(); c.restore();
  };

  /* ---------- frame ---------- */
  Stage.prototype.frame = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    this.updateTweens(now);
    var i, p;
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = this.confetti.length - 1; i >= 0; i--) {
      p = this.confetti[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.r += p.vr * dt;
      if (p.y > this.cssH + 30) this.confetti.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 4); this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.level) {
      for (i = 0; i < this.lampAnim.length; i++) this.lampAnim[i] = lerp(this.lampAnim[i], this.lampLit[i] ? 1 : 0, Math.min(1, dt * 7));
      var allLit = this.lampLit.length === 0 || this.litCount() === this.lampLit.length;
      this.goalAnim = lerp(this.goalAnim, allLit ? 1 : 0, Math.min(1, dt * 5));
      for (i = 0; i < this.hazAnim.length; i++) {
        var h = this.P.hazards[i], t0 = Math.floor(this.tickVis), fr = this.tickVis - t0;
        var a0 = E.hazActive(h, t0) ? 1 : 0, a1 = E.hazActive(h, t0 + 1) ? 1 : 0;
        this.hazAnim[i] = lerp(a0, a1, ease(clamp(fr, 0, 1)));
      }
    }
    this.draw();
  };

  /* silhouette del paesaggio dietro la scena (montagne, città, onde...) */
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  Stage.prototype.drawHorizon = function (c, W, H) {
    var th = this.theme, hue = th.hue, r = rnd(th.seed), y0 = H * 0.78, i, x, k = th.key;
    var col = hsl(hue, th.sat, 9, 0.9), col2 = hsl(hue, th.sat, 12, 0.8);
    function ridge(base, amp, steps, color, sharp) {
      c.fillStyle = color; c.beginPath(); c.moveTo(0, H);
      var rr = rnd(th.seed + base | 0);
      for (var j = 0; j <= steps; j++) { var xx = W * j / steps, yy = base - rr() * amp * (sharp ? 1 : 0.6) - (sharp && j % 2 ? amp * 0.4 : 0); c.lineTo(xx, yy); }
      c.lineTo(W, H); c.closePath(); c.fill();
    }
    if (k === 'deserto' || k === 'vulcano' || k === 'miniera' || k === 'ghiacciaio' || k === 'castello' || k === 'torre') {
      ridge(y0, H * 0.22, 9, col2, true); ridge(y0 + H * 0.08, H * 0.16, 12, col, true);
      if (k === 'vulcano') { var g = c.createRadialGradient(W * 0.5, y0, 5, W * 0.5, y0, W * 0.4); g.addColorStop(0, 'rgba(255,90,40,0.28)'); g.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = g; c.fillRect(0, y0 - W * 0.4, W, W * 0.6); }
      if (k === 'deserto') { c.fillStyle = 'rgba(255,200,120,0.22)'; c.beginPath(); c.arc(W * 0.78, H * 0.2, Math.min(W, H) * 0.08, 0, TAU); c.fill(); }
    } else if (k === 'foresta' || k === 'giungla' || k === 'giardino' || k === 'serra') {
      for (i = 0; i < 18; i++) { x = W * i / 17; var h = H * (0.12 + r() * 0.2), w = 16 + r() * 18; c.fillStyle = i % 2 ? col : col2; c.beginPath(); c.moveTo(x - w, H); c.lineTo(x, y0 + H * 0.1 - h); c.lineTo(x + w, H); c.closePath(); c.fill(); }
    } else if (k === 'neon' || k === 'laboratorio' || k === 'spazio') {
      for (i = 0; i < 16; i++) {
        var bw = W / 16, bh = H * (0.1 + r() * 0.3); x = i * bw;
        c.fillStyle = col2; c.fillRect(x + 2, y0 + H * 0.12 - bh, bw - 4, bh + H);
        c.fillStyle = hsla2(hue + 30, 0.55 * r()); for (var wy = 0; wy < bh - 12; wy += 12) if (r() > 0.55) c.fillRect(x + 8, y0 + H * 0.12 - bh + 8 + wy, bw - 20, 4);
      }
    } else if (k === 'oceano') {
      for (i = 0; i < 3; i++) { c.strokeStyle = hsl(hue, 70, 40, 0.25 - i * 0.06); c.lineWidth = 2; c.beginPath(); for (x = 0; x <= W; x += 8) { var yy = y0 + i * 22 + Math.sin(x * 0.02 + this.time * (1 + i * 0.4) + i) * 7; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); } c.stroke(); }
    } else if (k === 'nuvole') {
      for (i = 0; i < 6; i++) { var cx = ((r() * W + this.time * 6 * (0.4 + r())) % (W + 200)) - 100, cy = H * (0.12 + r() * 0.55); c.fillStyle = 'rgba(255,255,255,0.08)'; for (var b = 0; b < 4; b++) { c.beginPath(); c.arc(cx + b * 28, cy - (b % 2) * 10, 24 + (b % 3) * 6, 0, TAU); c.fill(); } }
    } else if (k === 'cristalli') {
      for (i = 0; i < 12; i++) { x = W * i / 11 + (r() - 0.5) * 30; var hh = H * (0.1 + r() * 0.25); c.fillStyle = hsl(hue + r() * 40, 60, 22, 0.55); c.beginPath(); c.moveTo(x - 14, H); c.lineTo(x, y0 + H * 0.12 - hh); c.lineTo(x + 14, H); c.closePath(); c.fill(); }
    } else {
      // interni: finestre/quadri sullo sfondo
      for (i = 0; i < 4; i++) { var wx = W * (0.1 + i * 0.25) + r() * 20, wy2 = H * (0.06 + r() * 0.12), ww = 60 + r() * 40, wh = 50 + r() * 40; c.strokeStyle = hsl(hue, 40, 30, 0.35); c.lineWidth = 2; c.strokeRect(wx, wy2, ww, wh); c.beginPath(); c.moveTo(wx + ww / 2, wy2); c.lineTo(wx + ww / 2, wy2 + wh); c.moveTo(wx, wy2 + wh / 2); c.lineTo(wx + ww, wy2 + wh / 2); c.stroke(); c.fillStyle = hsl(hue, 60, 45, 0.06); c.fillRect(wx, wy2, ww, wh); }
    }
  };
  function hsla2(h, a) { return 'hsla(' + (h % 360) + ',90%,65%,' + a + ')'; }

  Stage.prototype.drawBackground = function () {
    var c = this.ctx, W = this.cssW, H = this.cssH, hue = this.hue;
    var g = c.createLinearGradient(0, 0, 0, H);
    var bright = { ghiacciaio: 10, nuvole: 12, deserto: 6 }[this.theme.key] || 0;
    var sat = this.theme.sat + 12;
    g.addColorStop(0, hsl(hue, sat, 13 + bright)); g.addColorStop(1, hsl(hue + 20, sat + 10, 6 + bright * 0.6));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var rg = c.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * 0.7);
    rg.addColorStop(0, hsl(hue, 70, 45, 0.22)); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    // orizzonte decorativo del luogo
    this.drawHorizon(c, W, H);
    this.drawAmbient(c, W, H);
  };

  /* ---------- particelle d'ambiente: ogni mondo ha le sue ---------- */
  var AMB = {
    //          n    vx      vy     size      alpha
    dust:    { n: 16, vx: 0,     vy: -0.010, s: [18, 64], a: 0.06 },
    snow:    { n: 70, vx: -0.01, vy: 0.06,   s: [1.5, 4], a: 0.85 },
    embers:  { n: 40, vx: 0.01,  vy: -0.07,  s: [1.5, 3.5], a: 0.9 },
    bubbles: { n: 28, vx: 0,     vy: -0.05,  s: [3, 11], a: 0.5 },
    leaves:  { n: 22, vx: 0.03,  vy: 0.035,  s: [4, 8], a: 0.75 },
    stars:   { n: 70, vx: 0,     vy: 0,      s: [0.8, 2.4], a: 0.9 },
    sand:    { n: 60, vx: 0.14,  vy: 0.01,   s: [1, 2.4], a: 0.5 },
    rain:    { n: 60, vx: -0.03, vy: 0.55,   s: [10, 22], a: 0.45 },
    sparks:  { n: 26, vx: 0,     vy: -0.05,  s: [1.5, 3], a: 0.85 },
    petals:  { n: 24, vx: 0.02,  vy: 0.03,   s: [3, 6], a: 0.7 }
  };
  Stage.prototype.initAmbient = function () {
    var cfg = AMB[(this.theme && this.theme.ambient) || 'dust'], i;
    this.motes = [];
    for (i = 0; i < cfg.n; i++) {
      this.motes.push({
        x: Math.random(), y: Math.random(), ph: Math.random() * TAU,
        s: cfg.s[0] + Math.random() * (cfg.s[1] - cfg.s[0]),
        v: 0.6 + Math.random() * 0.8
      });
    }
  };
  Stage.prototype.drawAmbient = function (c, W, H) {
    var th = this.theme, kind = th.ambient, cfg = AMB[kind], hue = th.hue, t = this.time, i, m;
    for (i = 0; i < this.motes.length; i++) {
      m = this.motes[i];
      m.x += (cfg.vx * m.v + (kind === 'leaves' || kind === 'petals' ? Math.sin(t * 1.2 + m.ph) * 0.012 : 0)) * 0.016;
      m.y += cfg.vy * m.v * 0.016;
      if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
      if (m.y > 1.05) { m.y = -0.05; m.x = Math.random(); }
      if (m.x > 1.05) m.x = -0.05; if (m.x < -0.05) m.x = 1.05;
      var x = m.x * W, y = m.y * H, s = m.s;
      switch (kind) {
        case 'dust':
          c.strokeStyle = 'rgba(255,255,255,' + cfg.a + ')'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x, y - s / 2); c.lineTo(x + s, y); c.lineTo(x, y + s / 2); c.lineTo(x - s, y); c.closePath(); c.stroke(); break;
        case 'snow':
          c.fillStyle = 'rgba(255,255,255,' + cfg.a * (0.5 + 0.5 * m.v / 1.4) + ')'; c.beginPath(); c.arc(x + Math.sin(t + m.ph) * 6, y, s, 0, TAU); c.fill(); break;
        case 'embers':
          var fl = 0.5 + 0.5 * Math.sin(t * 6 + m.ph);
          c.fillStyle = 'hsla(' + (14 + fl * 30) + ',100%,' + (55 + fl * 20) + '%,' + cfg.a * fl + ')';
          c.beginPath(); c.arc(x + Math.sin(t * 2 + m.ph) * 8, y, s, 0, TAU); c.fill(); break;
        case 'bubbles':
          c.strokeStyle = 'rgba(200,240,255,' + cfg.a + ')'; c.lineWidth = 1.3; c.beginPath(); c.arc(x + Math.sin(t * 1.5 + m.ph) * 7, y, s, 0, TAU); c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(x - s * 0.3 + Math.sin(t * 1.5 + m.ph) * 7, y - s * 0.3, s * 0.25, 0, TAU); c.fill(); break;
        case 'leaves':
          c.save(); c.translate(x, y); c.rotate(t * 1.4 * m.v + m.ph); c.fillStyle = 'hsla(' + (hue + (m.ph * 20 | 0) % 40 - 10) + ',60%,50%,' + cfg.a + ')';
          c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); c.fill(); c.restore(); break;
        case 'stars':
          var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * m.v + m.ph));
          c.fillStyle = 'rgba(255,255,255,' + cfg.a * tw + ')'; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
          if (s > 1.9) { c.strokeStyle = 'rgba(255,255,255,' + 0.5 * tw + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - s * 3, y); c.lineTo(x + s * 3, y); c.moveTo(x, y - s * 3); c.lineTo(x, y + s * 3); c.stroke(); }
          break;
        case 'sand':
          c.fillStyle = 'rgba(255,220,150,' + cfg.a * (0.4 + 0.6 * m.v / 1.4) + ')'; c.fillRect(x, y, s * 1.6, s * 0.7); break;
        case 'rain':
          c.strokeStyle = 'hsla(' + (hue + 20) + ',100%,75%,' + cfg.a * (0.4 + 0.6 * m.v / 1.4) + ')'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - s * 0.1, y + s); c.stroke(); break;
        case 'sparks':
          var tw2 = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 * m.v + m.ph));
          c.fillStyle = 'hsla(' + (hue + 10) + ',100%,72%,' + cfg.a * tw2 + ')'; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); break;
        case 'petals':
          c.save(); c.translate(x, y); c.rotate(t * m.v + m.ph); c.fillStyle = 'hsla(' + (hue + 40) + ',80%,78%,' + cfg.a + ')';
          c.beginPath(); c.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); c.fill(); c.restore(); break;
      }
    }
  };

  Stage.prototype.draw = function () {
    var c = this.ctx, W = this.cssW, H = this.cssH;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground();
    if (!this.level) return;
    var sh = this.shake * (Math.random() - 0.5) * 10;
    c.save();
    c.translate(this.ox + sh, this.oy);
    c.scale(this.S, this.S);
    this.drawWorld();
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i], a = clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.c + a + ')'; c.beginPath(); c.arc(p.x, p.y, p.s * a + 0.5, 0, TAU); c.fill();
    }
    c.restore();
    if (this.fog) this.drawFog();
    if (this.flash > 0) { c.fillStyle = 'rgba(255,60,80,' + this.flash * 0.18 + ')'; c.fillRect(0, 0, W, H); }
    for (i = 0; i < this.confetti.length; i++) {
      var q = this.confetti[i];
      c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.c; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore();
    }
  };

  /* Modalità Buio: si vede solo attorno a Domo, alle luci accese e ai posti già esplorati. */
  Stage.prototype.drawFog = function () {
    var W = this.cssW, H = this.cssH, S = this.S;
    if (!this.fogCv) { this.fogCv = document.createElement('canvas'); this.fogCv.width = Math.round(W * this.dpr); this.fogCv.height = Math.round(H * this.dpr); }
    var f = this.fogCv.getContext('2d');
    f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = 'rgba(3,5,14,0.965)'; f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    var self = this;
    function hole(gx, gy, gz, rad, alpha) {
      var p = self.proj(gx, gy, gz), x = self.ox + p[0] * S, y = self.oy + p[1] * S, r = rad * S;
      var g = f.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + alpha + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + alpha * 0.8 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, TAU); f.fill();
    }
    var k;
    for (k in this.discovered) {
      var q = k.split(','), gx = +q[0], gy = +q[1];
      if (gx < 0 || gy < 0 || gx >= this.P.w || gy >= this.P.h || this.P.cells[gy][gx] === '.') continue;
      hole(gx + 0.5, gy + 0.5, 0, 72, 0.32);
    }
    for (var i = 0; i < this.P.lamps.length; i++) if (this.lampAnim[i] > 0.05) hole(this.P.lamps[i].x + 0.5, this.P.lamps[i].y + 0.5, 10, 200 * this.lampAnim[i], 0.95);
    if (this.P.goal) hole(this.P.goal.x + 0.5, this.P.goal.y + 0.5, 30, 130, 0.7);
    hole(this.robot.x + 0.5, this.robot.y + 0.5, 12, 215, 1);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.fogCv, 0, 0);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Stage.prototype.drawWorld = function () {
    var P = this.P, x, y, i;
    for (var d = 0; d <= P.w + P.h - 2; d++) {
      for (x = 0; x < P.w; x++) {
        y = d - x; if (y < 0 || y >= P.h) continue;
        var ch = P.cells[y][x];
        if (ch === '.') continue;
        this.drawSlab(x, y, ch);
      }
    }
    var items = [], self = this;
    function add(k, fn) { items.push({ k: k, f: fn }); }
    for (y = 0; y < P.h; y++) for (x = 0; x < P.w; x++) {
      if (P.cells[y][x] === '#') add(x + y + 1, this.drawWall.bind(this, x, y));
      if (P.cells[y][x] === 'G') add(x + y + 1, this.drawGoal.bind(this, x, y));
    }
    for (i = 0; i < P.lamps.length; i++) add(P.lamps[i].x + P.lamps[i].y + 1, this.drawLamp.bind(this, i));
    for (i = 0; i < P.coins.length; i++) if (!this.coinGot[i]) add(P.coins[i].x + P.coins[i].y + 1, this.drawCoin.bind(this, i));
    for (i = 0; i < P.keys.length; i++) if (!this.keyGot[i]) add(P.keys[i].x + P.keys[i].y + 1, this.drawKey.bind(this, i));
    for (i = 0; i < P.doors.length; i++) add(P.doors[i].x + P.doors[i].y + 1, this.drawDoor.bind(this, i));
    for (i = 0; i < P.portals.length; i++) {
      add(P.portals[i].a.x + P.portals[i].a.y + 1, this.drawPortal.bind(this, P.portals[i].a, i));
      add(P.portals[i].b.x + P.portals[i].b.y + 1, this.drawPortal.bind(this, P.portals[i].b, i));
    }
    for (i = 0; i < P.hazards.length; i++) add(P.hazards[i].x + P.hazards[i].y + 1, this.drawTrap.bind(this, i));
    for (i = 0; i < P.movers.length; i++) {
      var mp = this.moverVis(P.movers[i]);
      add(mp[0] + mp[1] + 1.01, this.drawMover.bind(this, i));
    }
    add(this.robot.x + this.robot.y + 1.02, function () { self.drawRobot(); });
    items.sort(function (a, b) { return a.k - b.k; });
    for (i = 0; i < items.length; i++) items[i].f();
  };

  Stage.prototype.drawSlab = function (x, y, ch) {
    var c = this.ctx, th = this.theme, h = this.hue, sat = th.sat, odd = (x + y) % 2;
    var cx = x + 0.5, cy = y + 0.5, k = th.key;
    var lt = { ghiacciaio: 62, nuvole: 66, deserto: 56 }[k] || 48;
    var top = hsl(h, sat, lt + (odd ? 3 : -1));
    var L = hsl(h, sat + 4, lt - 18), R = hsl(h, sat + 6, lt - 26);
    if (th.deco === 'checker' && odd) top = hsl(h + 8, sat + 8, lt - 12);
    if (ch === '#') top = hsl(h, sat - 8, lt - 8);
    this.box(cx, cy, 1, 1, -SLAB, SLAB, top, L, R, hsl(h, 60, 80, 0.35));
    var p0 = this.proj(x, y, 0), p1 = this.proj(x + 1, y + 1, 0);
    var gr = c.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    this.poly([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], gr);
    if (ch !== '#') this.slabDeco(x, y, th);
    if (ch === 'G') {
      var a = 0.35 + 0.65 * this.goalAnim;
      this.poly([[x + 0.1, y + 0.1, 0], [x + 0.9, y + 0.1, 0], [x + 0.9, y + 0.9, 0], [x + 0.1, y + 0.9, 0]], hsl(150, 80, 55, 0.18 + 0.25 * a), hsl(150, 90, 70, 0.4 + 0.5 * a), 2);
    }
    if (this.level.start[0] === x && this.level.start[1] === y) {
      this.poly([[x + 0.18, y + 0.18, 0], [x + 0.82, y + 0.18, 0], [x + 0.82, y + 0.82, 0], [x + 0.18, y + 0.82, 0]], null, 'rgba(255,255,255,0.28)', 1.5);
    }
  };

  /* dettagli sul pavimento in base al luogo (deterministici per casella) */
  Stage.prototype.slabDeco = function (x, y, th) {
    var c = this.ctx, r = rnd(th.seed + x * 131 + y * 977), d = th.deco, i, p;
    if (d === 'grass') {
      c.strokeStyle = 'hsla(' + (th.hue + 8) + ',60%,70%,0.55)'; c.lineWidth = 1.6; c.lineCap = 'round';
      for (i = 0; i < 4; i++) { p = this.proj(x + 0.15 + r() * 0.7, y + 0.15 + r() * 0.7, 0); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 2, p[1] - 6); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 3, p[1] - 5); c.stroke(); }
    } else if (d === 'cracks') {
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1.3;
      if (r() > 0.45) { p = this.proj(x + 0.2 + r() * 0.3, y + 0.2 + r() * 0.3, 0); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 9, p[1] + 4); c.lineTo(p[0] + 15, p[1] - 1); c.moveTo(p[0] + 9, p[1] + 4); c.lineTo(p[0] + 12, p[1] + 10); c.stroke(); }
    } else if (d === 'dots') {
      c.fillStyle = 'rgba(255,255,255,0.18)';
      for (i = 0; i < 3; i++) { p = this.proj(x + 0.2 + r() * 0.6, y + 0.2 + r() * 0.6, 0); c.beginPath(); c.ellipse(p[0], p[1], 2.4, 1.2, 0, 0, TAU); c.fill(); }
    } else if (d === 'waves') {
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.4;
      p = this.proj(x + 0.5, y + 0.5, 0); var ph = this.time * 1.6 + x + y;
      c.beginPath(); c.moveTo(p[0] - 14, p[1] + Math.sin(ph) * 1.5); c.quadraticCurveTo(p[0] - 7, p[1] - 5, p[0], p[1] + Math.sin(ph) * 1.5); c.quadraticCurveTo(p[0] + 7, p[1] + 5, p[0] + 14, p[1] + Math.sin(ph) * 1.5); c.stroke();
    } else if (d === 'grid') {
      c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 1;
      var q = this.proj(x + 0.5, y + 0.5, 0);
      this.poly([[x + 0.08, y + 0.08, 0], [x + 0.92, y + 0.08, 0], [x + 0.92, y + 0.92, 0], [x + 0.08, y + 0.92, 0]], null, 'rgba(255,255,255,0.11)', 1);
      if (th.key === 'neon' || th.key === 'spazio' || th.key === 'laboratorio') { c.fillStyle = hsl(th.hue + 20, 90, 70, 0.5); c.beginPath(); c.arc(q[0], q[1], 1.6, 0, TAU); c.fill(); }
    } else if (d === 'stones') {
      c.fillStyle = 'rgba(0,0,0,0.16)';
      for (i = 0; i < 3; i++) { p = this.proj(x + 0.15 + r() * 0.7, y + 0.15 + r() * 0.7, 0); c.beginPath(); c.ellipse(p[0], p[1], 3 + r() * 4, 1.6 + r() * 2, 0, 0, TAU); c.fill(); }
    }
  };

  /* muri: lo stile cambia con l'ambientazione */
  Stage.prototype.drawWall = function (x, y) {
    var c = this.ctx, th = this.theme, h = this.hue, s = th.sat + 8, cx = x + 0.5, cy = y + 0.5, k = th.wall, r = rnd(th.seed + x * 31 + y * 17), i, p;
    var H = CUBE, E = 'rgba(255,255,255,0.3)';
    if (k === 'ice') {
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(196, 70, 86, 0.95), hsl(200, 60, 66, 0.95), hsl(205, 60, 52, 0.95), 'rgba(255,255,255,0.8)');
      this.poly([[cx - 0.3, cy + 0.471, H * 0.8], [cx - 0.1, cy + 0.471, H * 0.8], [cx - 0.3, cy + 0.471, H * 0.2]], 'rgba(255,255,255,0.35)');
    } else if (k === 'rock') {
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(h, s - 14, 44), hsl(h, s - 10, 30), hsl(h, s - 8, 22), 'rgba(255,255,255,0.18)');
      this.box(cx - 0.18, cy + 0.15, 0.4, 0.4, H, 9, hsl(h, s - 14, 50), hsl(h, s - 10, 34), hsl(h, s - 8, 26));
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.3;
      p = this.proj(cx + 0.1, cy + 0.471, H * 0.7); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 8, p[1] + 12); c.lineTo(p[0] - 2, p[1] + 22); c.stroke();
    } else if (k === 'hedge') {
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(h + 6, s + 8, 44), hsl(h, s + 8, 30), hsl(h - 4, s + 8, 22), 'rgba(160,255,160,0.25)');
      for (i = 0; i < 9; i++) { p = this.proj(cx - 0.4 + r() * 0.8, cy + 0.471, H * (0.15 + r() * 0.75)); c.fillStyle = 'hsla(' + (h + 10) + ',70%,' + (50 + r() * 18) + '%,0.55)'; c.beginPath(); c.arc(p[0] + (r() - 0.5) * 6, p[1], 3.5 + r() * 3, 0, TAU); c.fill(); }
      if (r() > 0.6) { p = this.proj(cx, cy, H + 1); c.fillStyle = hsl(340 + r() * 40, 90, 70); c.beginPath(); c.arc(p[0], p[1], 3.5, 0, TAU); c.fill(); }
    } else if (k === 'neon') {
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(h, 30, 20), hsl(h, 34, 13), hsl(h, 36, 9), th.accent);
      var a = 0.55 + 0.35 * Math.sin(this.time * 2 + x + y);
      this.poly([[cx - 0.3, cy + 0.471, H * 0.8], [cx + 0.3, cy + 0.471, H * 0.8], [cx + 0.3, cy + 0.471, H * 0.8 - 2], [cx - 0.3, cy + 0.471, H * 0.8 - 2]], hexA(th.accent, a));
      this.poly([[cx - 0.3, cy + 0.471, H * 0.35], [cx + 0.3, cy + 0.471, H * 0.35], [cx + 0.3, cy + 0.471, H * 0.35 - 2], [cx - 0.3, cy + 0.471, H * 0.35 - 2]], hexA(th.accent, a * 0.7));
      p = this.proj(cx, cy, H); this.glow(p[0], p[1], 36, hexA(th.accent, 0.18));
    } else if (k === 'brick') {
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(h, s - 6, 46), hsl(h, s - 4, 34), hsl(h, s - 2, 25), 'rgba(255,255,255,0.22)');
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.2;
      for (i = 1; i < 5; i++) { var z = H * i / 5, a1 = this.proj(cx - 0.47, cy + 0.471, z), b1 = this.proj(cx + 0.47, cy + 0.471, z); c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.stroke();
        var off = (i % 2) ? 0.15 : -0.15; var m1 = this.proj(cx + off, cy + 0.471, z), m2 = this.proj(cx + off, cy + 0.471, z - H / 5); c.beginPath(); c.moveTo(m1[0], m1[1]); c.lineTo(m2[0], m2[1]); c.stroke(); }
    } else if (k === 'cloud') {
      this.box(cx, cy, 0.9, 0.9, 0, H * 0.8, 'rgba(255,255,255,0.95)', 'rgba(220,235,255,0.95)', 'rgba(190,210,245,0.95)', 'rgba(255,255,255,0.8)');
      p = this.proj(cx, cy, H * 0.8); c.fillStyle = 'rgba(255,255,255,0.97)';
      [[-14, 2, 15], [0, -6, 19], [15, 2, 14]].forEach(function (o) { c.beginPath(); c.arc(p[0] + o[0], p[1] + o[1], o[2], 0, TAU); c.fill(); });
    } else if (k === 'crystal') {
      this.box(cx, cy, 0.7, 0.7, 0, H * 0.7, hsl(h, 70, 68), hsl(h, 65, 48), hsl(h, 70, 36), 'rgba(255,255,255,0.6)');
      var b0 = this.proj(cx, cy, H * 0.7), tp = this.proj(cx, cy, H * 1.35);
      c.fillStyle = hsl(h, 75, 76, 0.95); c.beginPath(); c.moveTo(b0[0] - 20, b0[1] + 2); c.lineTo(tp[0], tp[1]); c.lineTo(b0[0] + 20, b0[1] + 2); c.lineTo(b0[0], b0[1] + 10); c.closePath(); c.fill();
      c.fillStyle = hsl(h, 70, 52, 0.9); c.beginPath(); c.moveTo(b0[0], b0[1] + 10); c.lineTo(tp[0], tp[1]); c.lineTo(b0[0] + 20, b0[1] + 2); c.closePath(); c.fill();
      this.glow(tp[0], tp[1] + 10, 30, hsl(h, 90, 65, 0.25 + 0.1 * Math.sin(this.time * 3 + x)));
    } else {
      var hh = h + 30;
      this.box(cx, cy, 0.94, 0.94, 0, H, hsl(hh, 45, 62), hsl(hh, 45, 42), hsl(hh, 50, 32), E);
      this.poly([[x + 0.2, y + 0.97, H * 0.7], [x + 0.8, y + 0.97, H * 0.7], [x + 0.8, y + 0.97, H * 0.35], [x + 0.2, y + 0.97, H * 0.35]], hsl(hh, 70, 75, 0.25));
    }
  };

  Stage.prototype.drawGoal = function (x, y) {
    var c = this.ctx, t = this.time, a = this.goalAnim, cx = x + 0.5, cy = y + 0.5;
    var bob = Math.sin(t * 2.2) * 4;
    this.box(cx, cy, 0.34, 0.34, 0, 12, hsl(150, 30, 75), hsl(150, 35, 45), hsl(150, 40, 33));
    var b = this.proj(cx, cy, 12), tp = this.proj(cx, cy, 130);
    var gr = c.createLinearGradient(0, b[1], 0, tp[1]);
    gr.addColorStop(0, hsl(150, 90, 65, 0.05 + 0.4 * a)); gr.addColorStop(1, hsl(150, 90, 65, 0));
    c.fillStyle = gr; c.beginPath(); c.moveTo(b[0] - 20, b[1]); c.lineTo(b[0] + 20, b[1]); c.lineTo(tp[0] + 8, tp[1]); c.lineTo(tp[0] - 8, tp[1]); c.closePath(); c.fill();
    var z = 50 + bob, p = this.proj(cx, cy, z), s = 15;
    var col = a > 0.5 ? 150 : 215;
    c.fillStyle = hsl(col, 80, 70, 0.55 + 0.45 * a); c.beginPath(); c.moveTo(p[0], p[1] - s * 1.5); c.lineTo(p[0] + s, p[1]); c.lineTo(p[0], p[1] + s * 1.5); c.lineTo(p[0] - s, p[1]); c.closePath(); c.fill();
    c.fillStyle = hsl(col, 80, 45, 0.7); c.beginPath(); c.moveTo(p[0], p[1] - s * 1.5); c.lineTo(p[0] + s, p[1]); c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p[0], p[1] - s * 1.5); c.lineTo(p[0] + s, p[1]); c.lineTo(p[0], p[1] + s * 1.5); c.lineTo(p[0] - s, p[1]); c.closePath(); c.stroke();
    if (a > 0.05) this.glow(p[0], p[1], 70 + Math.sin(t * 3) * 6, 'rgba(80,255,180,' + 0.35 * a + ')');
  };

  Stage.prototype.drawLamp = function (i) {
    var c = this.ctx, l = this.P.lamps[i], cx = l.x + 0.5, cy = l.y + 0.5, a = this.lampAnim[i];
    var pop = this.lampPop[i] > 0 ? clamp((performance.now() - this.lampPop[i]) / 450, 0, 1) : 1;
    var sc = 1 + 0.35 * Math.sin(Math.PI * pop) * (a > 0.5 ? 1 : 0);
    if (a > 0.02) {
      var fp = this.proj(cx, cy, 0);
      c.save(); c.translate(fp[0], fp[1]); c.scale(1, 0.5);
      var g = c.createRadialGradient(0, 0, 0, 0, 0, 70);
      g.addColorStop(0, 'rgba(255,214,120,' + 0.55 * a + ')'); g.addColorStop(1, 'rgba(255,200,80,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fill(); c.restore();
    }
    this.box(cx, cy, 0.34, 0.34, 0, 7, '#5a6485', '#3d4663', '#2e3550');
    this.box(cx, cy, 0.08, 0.08, 7, 20, '#8993b3', '#5f6a8c', '#4a5473');
    var p = this.proj(cx, cy, 36), r = 10 * sc;
    var gr = c.createRadialGradient(p[0] - 3, p[1] - 3, 1, p[0], p[1], r);
    if (a > 0.5) { gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.5, '#ffd45e'); gr.addColorStop(1, '#ff9d2e'); }
    else { gr.addColorStop(0, '#cfd6ee'); gr.addColorStop(1, '#6c7799'); }
    c.fillStyle = gr; c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.stroke();
    if (a > 0.02) this.glow(p[0], p[1], 64 * a * sc, 'rgba(255,200,90,' + 0.5 * a + ')');
    else {
      var pu = 0.5 + 0.5 * Math.sin(this.time * 3 + i);
      c.strokeStyle = 'rgba(255,214,102,' + (0.25 + 0.35 * pu) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(p[0], p[1], r + 4 + pu * 3, 0, TAU); c.stroke();
    }
  };

  Stage.prototype.drawCoin = function (i) {
    var c = this.ctx, co = this.P.coins[i], t = this.time;
    var bob = Math.sin(t * 3 + i) * 3, p = this.proj(co.x + 0.5, co.y + 0.5, 24 + bob);
    var sp = this.proj(co.x + 0.5, co.y + 0.5, 0);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sp[0], sp[1], 11, 5, 0, 0, TAU); c.fill();
    var w = Math.abs(Math.cos(t * 2.4 + i)) * 11 + 2.5;
    var g = c.createLinearGradient(p[0] - w, p[1], p[0] + w, p[1]);
    g.addColorStop(0, '#ffe58a'); g.addColorStop(0.5, '#ffc83d'); g.addColorStop(1, '#d9961a');
    c.fillStyle = g; c.beginPath(); c.ellipse(p[0], p[1], w, 11.5, 0, 0, TAU); c.fill();
    c.strokeStyle = '#a56a0c'; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p[0], p[1], Math.max(1, w - 4), 7.5, 0, 0, TAU); c.stroke();
    this.glow(p[0], p[1], 30, 'rgba(255,200,70,0.28)');
  };

  Stage.prototype.drawKey = function (i) {
    var c = this.ctx, k = this.P.keys[i], t = this.time, hue = KEY_HUES[k.color];
    var bob = Math.sin(t * 2.6 + i) * 3, p = this.proj(k.x + 0.5, k.y + 0.5, 26 + bob);
    var sp = this.proj(k.x + 0.5, k.y + 0.5, 0);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(sp[0], sp[1], 11, 5, 0, 0, TAU); c.fill();
    c.save(); c.translate(p[0], p[1]); c.rotate(-0.7 + Math.sin(t * 2 + i) * 0.12);
    c.strokeStyle = hsl(hue, 90, 62); c.fillStyle = hsl(hue, 90, 62); c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.arc(-9, 0, 6, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(-3, 0); c.lineTo(15, 0); c.stroke();
    c.beginPath(); c.moveTo(11, 0); c.lineTo(11, 7); c.moveTo(15, 0); c.lineTo(15, 6); c.stroke();
    c.restore();
    this.glow(p[0], p[1], 28, hsl(hue, 90, 60, 0.3));
  };

  Stage.prototype.drawDoor = function (i) {
    var c = this.ctx, d = this.P.doors[i], hue = KEY_HUES[d.color], open = this.keysHeld[d.color];
    var cx = d.x + 0.5, cy = d.y + 0.5;
    if (!open) {
      this.box(cx, cy, 0.92, 0.92, 0, CUBE, hsl(hue, 70, 62), hsl(hue, 65, 44), hsl(hue, 70, 33), 'rgba(255,255,255,0.35)');
      var kp = this.proj(cx, cy + 0.46, CUBE * 0.55);
      c.fillStyle = 'rgba(10,12,30,0.85)'; c.beginPath(); c.arc(kp[0], kp[1] - 3, 5, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(kp[0] - 2.5, kp[1]); c.lineTo(kp[0] + 2.5, kp[1]); c.lineTo(kp[0] + 4, kp[1] + 10); c.lineTo(kp[0] - 4, kp[1] + 10); c.closePath(); c.fill();
    } else {
      c.save(); c.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 4);
      this.box(cx, cy, 0.92, 0.92, 0, 7, hsl(hue, 75, 70), hsl(hue, 65, 50), hsl(hue, 70, 38));
      c.restore();
      var gp = this.proj(cx, cy, 6); this.glow(gp[0], gp[1], 34, hsl(hue, 90, 60, 0.28));
    }
  };

  Stage.prototype.drawPortal = function (tile, idx) {
    var c = this.ctx, t = this.time, hue = 275 + idx * 55;
    var p = this.proj(tile.x + 0.5, tile.y + 0.5, 2);
    var g = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], 36);
    g.addColorStop(0, 'rgba(8,4,24,0.95)'); g.addColorStop(0.7, hsl(hue, 80, 35, 0.8)); g.addColorStop(1, hsl(hue, 90, 60, 0.1));
    c.fillStyle = g; c.beginPath(); c.ellipse(p[0], p[1], 36, 18, 0, 0, TAU); c.fill();
    for (var r = 0; r < 3; r++) {
      var rr = 1 - r * 0.27, a0 = t * (2.4 - r * 0.6) * (r % 2 ? -1 : 1);
      c.strokeStyle = hsl(hue + r * 25, 95, 70, 0.9 - r * 0.18); c.lineWidth = 3 - r * 0.6; c.lineCap = 'round';
      c.beginPath(); c.ellipse(p[0], p[1], 36 * rr, 18 * rr, 0, a0, a0 + 4.2); c.stroke();
    }
    for (var s = 0; s < 4; s++) {
      var ph = (t * 0.8 + s * 0.25) % 1, sx = p[0] + Math.sin(s * 2.1 + t) * 14, sy = p[1] - ph * 38;
      c.fillStyle = hsl(hue + 30, 95, 80, (1 - ph) * 0.8); c.beginPath(); c.arc(sx, sy, 2.2, 0, TAU); c.fill();
    }
    this.glow(p[0], p[1] - 6, 52, hsl(hue, 90, 60, 0.28));
  };

  Stage.prototype.drawTrap = function (i) {
    var c = this.ctx, h = this.P.hazards[i], a = this.hazAnim[i], cx = h.x + 0.5, cy = h.y + 0.5;
    this.box(cx, cy, 0.84, 0.84, 0, 3, '#2a2230', '#1c1722', '#15101a', 'rgba(255,90,110,0.6)');
    var n = 3, sp = 0.2;
    for (var ix = 0; ix < n; ix++) for (var iy = 0; iy < n; iy++) {
      var gx = cx + (ix - 1) * sp, gy = cy + (iy - 1) * sp, hh = 3 + a * 18;
      this.box(gx, gy, 0.07, 0.07, 3, hh, a > 0.5 ? '#ffd0d6' : '#8a8294', a > 0.5 ? '#ff5a73' : '#5d556b', a > 0.5 ? '#c93550' : '#473f55');
    }
    if (a > 0.3) { var gp = this.proj(cx, cy, 14); this.glow(gp[0], gp[1], 40, 'rgba(255,60,90,' + 0.35 * a + ')'); }
    // previsione: i prossimi p istanti (rosso = attiva)
    var t0 = Math.floor(this.tickVis + 0.0001);
    for (var k = 0; k < h.p; k++) {
      var on = E.hazActive(h, t0 + 1 + k);
      var dp = this.proj(cx + (k - (h.p - 1) / 2) * 0.17, cy + 0.44, 3);
      c.fillStyle = on ? '#ff4d6a' : 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(dp[0], dp[1], k === 0 ? 4.4 : 3.2, 0, TAU); c.fill();
      if (k === 0) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); }
    }
  };

  Stage.prototype.moverVis = function (m) {
    var t0 = Math.floor(this.tickVis + 0.0001), fr = clamp(this.tickVis - t0, 0, 1);
    var p0 = E.moverPos(m, t0), p1 = E.moverPos(m, t0 + 1), e = ease(fr);
    return [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)];
  };
  Stage.prototype.drawMover = function (i) {
    var c = this.ctx, m = this.P.movers[i], mp = this.moverVis(m);
    var t0 = Math.floor(this.tickVis + 0.0001), nx = E.moverPos(m, t0 + 1), cur = E.moverPos(m, t0);
    // sagoma tratteggiata della prossima posizione
    if (nx[0] !== cur[0] || nx[1] !== cur[1] || this.tickVis - t0 < 0.01) {
      var q = this.proj(nx[0] + 0.5, nx[1] + 0.5, 0);
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,90,110,0.8)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(q[0], q[1] - TH * 0.4); c.lineTo(q[0] + TW * 0.4, q[1]); c.lineTo(q[0], q[1] + TH * 0.4); c.lineTo(q[0] - TW * 0.4, q[1]); c.closePath(); c.stroke(); c.restore();
    }
    var cx = mp[0] + 0.5, cy = mp[1] + 0.5, sp = this.proj(cx, cy, 0);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(sp[0], sp[1], 24, 11, 0, 0, TAU); c.fill();
    var bob = Math.sin(this.time * 6 + i) * 1.5;
    this.box(cx, cy, 0.7, 0.7, 4 + bob, 32, '#ff7a8a', '#d9364f', '#a8223a', 'rgba(255,255,255,0.4)');
    this.poly([[cx - 0.35, cy + 0.351, 26 + bob], [cx + 0.35, cy + 0.351, 26 + bob], [cx + 0.35, cy + 0.351, 20 + bob], [cx - 0.35, cy + 0.351, 20 + bob]], 'rgba(255,225,120,0.9)');
    var ep = this.proj(cx, cy + 0.351, 22);
    c.fillStyle = '#2a0d14'; c.beginPath(); c.arc(ep[0] - 5, ep[1] + 4, 2.4, 0, TAU); c.arc(ep[0] + 7, ep[1] + 4, 2.4, 0, TAU); c.fill();
    var gp = this.proj(cx, cy, 24); this.glow(gp[0], gp[1], 44, 'rgba(255,60,90,0.22)');
  };

  /* ---------- personaggio ---------- */
  Stage.prototype.drawRobot = function () { this.drawCharacter(this.skin, this.robot); };

  Stage.prototype.drawCharacter = function (skin, rb) {
    var c = this.ctx, t = this.time;
    var gx = rb.x + 0.5, gy = rb.y + 0.5;
    var idle = Math.sin(t * 2.4) * 1.2;
    var hop = rb.hop + idle + rb.pulse * 6;
    var fall = rb.fall, alpha = (1 - clamp(fall * 1.1, 0, 1)) * clamp(rb.scale + 0.0, 0, 1);
    var sp = this.proj(gx, gy, 0), sc = Math.max(0.01, rb.scale);
    if (fall < 0.3) {
      c.save(); c.translate(sp[0], sp[1]); c.scale(1, 0.5);
      c.fillStyle = 'rgba(0,0,0,' + (0.32 - rb.hop * 0.01) * sc + ')'; c.beginPath(); c.arc(0, 0, (25 - rb.hop * 0.5) * sc, 0, TAU); c.fill(); c.restore();
    }
    c.save(); c.globalAlpha = alpha;
    if (skin && skin.sprite) { this.drawSprite(skin, rb, sp, hop, fall, sc); c.restore(); return; }
    skin = skin || root.DomusSkins.list[0];
    if (sc !== 1) { c.translate(sp[0], sp[1]); c.scale(sc, sc); c.translate(-sp[0], -sp[1]); }
    var z0 = 5 + hop - fall * 170, H = 34, W = 0.56;
    this.box(gx, gy, W, W, z0, H, skin.top, skin.L, skin.R, 'rgba(255,255,255,0.8)');
    var x1 = gx + W / 2, y1 = gy + W / 2, y0 = gy - W / 2, x0 = gx - W / 2, z1 = z0 + H;
    if (skin.deco === 'band') this.box(gx, gy, W + 0.03, W + 0.03, z0 + H - 11, 6, '#ff3d5a', '#d91f40', '#a8142f');
    var vz0 = z0 + H * 0.3, vz1 = z0 + H * 0.78;
    var a1 = Math.max(0, Math.cos(rb.ang - Math.PI / 2)), a2 = Math.max(0, Math.cos(rb.ang - Math.PI));
    if (a1 > 0.02) {
      this.poly([[x1, y0 + 0.07, vz1], [x1, y1 - 0.07, vz1], [x1, y1 - 0.07, vz0], [x1, y0 + 0.07, vz0]], hexA(skin.visor, 0.93 * a1));
      this.eyes(x1, gy - 0.12, x1, gy + 0.12, (vz0 + vz1) / 2, a1, skin.eye);
    }
    if (a2 > 0.02) {
      this.poly([[x0 + 0.07, y1, vz1], [x1 - 0.07, y1, vz1], [x1 - 0.07, y1, vz0], [x0 + 0.07, y1, vz0]], hexA(skin.visor, 0.93 * a2));
      this.eyes(gx - 0.12, y1, gx + 0.12, y1, (vz0 + vz1) / 2, a2, skin.eye);
    }
    // decorazioni sul tetto
    var dk = skin.deco, tipTop = skin.top;
    if (dk === 'ears' || dk === 'ears-dark') {
      var ec = dk === 'ears' ? [skin.top, skin.L, skin.R] : ['#2b2e40', '#1c1e2c', '#12131c'];
      this.box(gx - 0.17, gy + 0.17, 0.15, 0.15, z1, 12, ec[0], ec[1], ec[2]);
      this.box(gx + 0.17, gy - 0.17, 0.15, 0.15, z1, 12, ec[0], ec[1], ec[2]);
    } else if (dk === 'horns') {
      this.box(gx - 0.17, gy + 0.17, 0.09, 0.09, z1, 15, '#fff0a0', '#ffcf33', '#d99a10');
      this.box(gx + 0.17, gy - 0.17, 0.09, 0.09, z1, 15, '#fff0a0', '#ffcf33', '#d99a10');
    } else if (dk === 'stem') {
      this.box(gx, gy, 0.1, 0.1, z1, 11, '#bff08a', '#7acb3c', '#559a24');
    } else if (dk === 'crown') {
      this.box(gx, gy, 0.5, 0.5, z1, 5, '#ffe9a0', '#ffc83d', '#d99a10');
      [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0, 0]].forEach(function (o, i) {
        this.box(gx + o[0], gy + o[1], 0.09, 0.09, z1 + 5, i === 4 ? 12 : 8, '#fff2b8', '#ffc83d', '#d99a10');
      }, this);
    } else if (dk === 'horn1') {
      this.box(gx, gy, 0.1, 0.1, z1, 8, '#ffffff', '#ffd6f5', '#e8a0d6');
      this.box(gx, gy, 0.06, 0.06, z1 + 8, 8, '#fff7a0', '#ffd34d', '#e0a010');
    }
    // freccia sul tetto
    var f = [Math.sin(rb.ang), -Math.cos(rb.ang)], r = [Math.cos(rb.ang), Math.sin(rb.ang)];
    function pt(fa, ra) { return [gx + f[0] * fa + r[0] * ra, gy + f[1] * fa + r[1] * ra, z1 + 0.5]; }
    this.poly([pt(0.2, 0), pt(-0.08, 0.15), pt(0.0, 0), pt(-0.08, -0.15)], skin.accent, null);
    if (dk === 'antenna' || dk === 'dual') {
      var offs = dk === 'dual' ? [[-0.15, 0.15], [0.15, -0.15]] : [[0, 0]];
      offs.forEach(function (o, i) {
        var ap = this.proj(gx + o[0], gy + o[1], z1), at = this.proj(gx + o[0], gy + o[1], z1 + 12 + (dk === 'dual' ? 4 : 0));
        c.strokeStyle = '#8894bb'; c.lineWidth = 2; c.beginPath(); c.moveTo(ap[0], ap[1]); c.lineTo(at[0], at[1]); c.stroke();
        var bl = 0.5 + 0.5 * Math.sin(t * 5 + i * 2);
        c.fillStyle = hexA(skin.accent, 0.6 + 0.4 * bl); c.beginPath(); c.arc(at[0], at[1], 3.4, 0, TAU); c.fill();
        this.glow(at[0], at[1], 16, hexA(skin.accent, 0.35 * bl));
      }, this);
    }
    c.restore();
  };

  Stage.prototype.drawSprite = function (skin, rb, sp, hop, fall, sc) {
    var c = this.ctx, size = 76 * sc, y = sp[1] - hop - 4 + fall * 160;
    // freccia di direzione sul pavimento
    var gx = rb.x + 0.5, gy = rb.y + 0.5, f = [Math.sin(rb.ang), -Math.cos(rb.ang)], r = [Math.cos(rb.ang), Math.sin(rb.ang)];
    function pt(fa, ra) { return [gx + f[0] * fa + r[0] * ra, gy + f[1] * fa + r[1] * ra, 0.5]; }
    this.poly([pt(0.42, 0), pt(0.2, 0.16), pt(0.27, 0), pt(0.2, -0.16)], 'rgba(255,255,255,0.85)', null);
    var squash = 1 + Math.sin(this.time * 2.4) * 0.012;
    c.drawImage(skin.sprite, sp[0] - size / 2, y - size * 0.92, size * squash, size);
  };

  Stage.prototype.eyes = function (xa, ya, xb, yb, z, a, color) {
    var c = this.ctx, p = this.proj(xa, ya, z), q = this.proj(xb, yb, z);
    c.fillStyle = hexA(color, a);
    c.beginPath(); c.arc(p[0], p[1], 3.4, 0, TAU); c.fill();
    c.beginPath(); c.arc(q[0], q[1], 3.4, 0, TAU); c.fill();
    this.glow(p[0], p[1], 11, hexA(color, 0.25 * a));
    this.glow(q[0], q[1], 11, hexA(color, 0.25 * a));
  };

  /* Anteprima di un personaggio su un piccolo canvas (impostazioni / negozio). */
  Stage.renderPreview = function (canvas, skin) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 72, h = canvas.clientHeight || 72;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var s = canvas._stage || (canvas._stage = new Stage(canvas, { preview: true }));
    var c = s.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    s.time = 1.2;
    c.save(); c.translate(w / 2, h * 0.72); var k = Math.min(w, h) / 120; c.scale(k, k);
    s.drawCharacter(skin, { x: -0.5, y: -0.5, ang: Math.PI * 0.75, hop: 0, fall: 0, pulse: 0, scale: 1 });
    c.restore();
  };

  root.DomusStage = Stage;
})(typeof self !== 'undefined' ? self : this);
