/* DomusLab — ambientazioni dei mondi. Ogni mondo ha il suo luogo, colori, muri, decorazioni e particelle. */
(function (root) {
  'use strict';
  /* wall: crate | ice | rock | hedge | neon | brick | cloud | crystal
     ambient: dust | snow | embers | bubbles | leaves | stars | sand | rain | sparks | petals
     deco: none | grass | cracks | dots | waves | grid | stones | checker */
  var T = {
    ingresso:  { name: 'Ingresso',   icon: '', hue: 218, sat: 38, wall: 'crate',   ambient: 'dust',    deco: 'grid',    accent: '#5b8cff' },
    salotto:   { name: 'Salotto',    icon: '', hue: 272, sat: 36, wall: 'crate',   ambient: 'petals',  deco: 'dots',    accent: '#b57bff' },
    cucina:    { name: 'Cucina',     icon: '', hue: 24,  sat: 46, wall: 'brick',   ambient: 'sparks',  deco: 'checker', accent: '#ff9f43' },
    giardino:  { name: 'Giardino',   icon: '', hue: 142, sat: 38, wall: 'hedge',   ambient: 'leaves',  deco: 'grass',   accent: '#4cd964' },
    garage:    { name: 'Garage',     icon: '', hue: 352, sat: 30, wall: 'crate',   ambient: 'sparks',  deco: 'cracks',  accent: '#ff5d7a' },
    soffitta:  { name: 'Soffitta',   icon: '', hue: 190, sat: 30, wall: 'brick',   ambient: 'dust',    deco: 'stones',  accent: '#4fd8e8' },
    laboratorio:{ name: 'Laboratorio', icon: '', hue: 312, sat: 38, wall: 'neon',  ambient: 'bubbles', deco: 'grid',    accent: '#ff6fd0' },
    serra:     { name: 'Serra',      icon: '', hue: 166, sat: 36, wall: 'hedge',   ambient: 'petals',  deco: 'grass',   accent: '#3ee6b0' },
    torre:     { name: 'Torre',      icon: '', hue: 44,  sat: 38, wall: 'brick',   ambient: 'stars',   deco: 'stones',  accent: '#ffc83d' },
    foresta:   { name: 'Foresta',    icon: '', hue: 128, sat: 34, wall: 'hedge',   ambient: 'leaves',  deco: 'grass',   accent: '#6adf6a' },
    deserto:   { name: 'Deserto',    icon: '', hue: 36,  sat: 52, wall: 'rock',    ambient: 'sand',    deco: 'cracks',  accent: '#ffb347' },
    ghiacciaio:{ name: 'Ghiacciaio', icon: '', hue: 196, sat: 42, wall: 'ice',     ambient: 'snow',    deco: 'cracks',  accent: '#8fe3ff' },
    vulcano:   { name: 'Vulcano',    icon: '', hue: 8,   sat: 44, wall: 'rock',    ambient: 'embers',  deco: 'cracks',  accent: '#ff6a3d' },
    oceano:    { name: 'Oceano',     icon: '', hue: 206, sat: 48, wall: 'crystal', ambient: 'bubbles', deco: 'waves',   accent: '#35b6ff' },
    spazio:    { name: 'Spazio',     icon: '', hue: 256, sat: 34, wall: 'neon',    ambient: 'stars',   deco: 'grid',    accent: '#9d8bff' },
    neon:      { name: 'Città Neon', icon: '', hue: 300, sat: 40, wall: 'neon',    ambient: 'rain',    deco: 'grid',    accent: '#ff3df0' },
    castello:  { name: 'Castello',   icon: '', hue: 222, sat: 14, wall: 'brick',   ambient: 'dust',    deco: 'stones',  accent: '#a9b7ff' },
    giungla:   { name: 'Giungla',    icon: '', hue: 98,  sat: 44, wall: 'hedge',   ambient: 'leaves',  deco: 'grass',   accent: '#b6ff3d' },
    miniera:   { name: 'Miniera',    icon: '', hue: 28,  sat: 22, wall: 'rock',    ambient: 'sparks',  deco: 'stones',  accent: '#ffc15a' },
    nuvole:    { name: 'Nuvole',     icon: '', hue: 204, sat: 36, wall: 'cloud',   ambient: 'petals',  deco: 'dots',    accent: '#bfe6ff' },
    cristalli: { name: 'Grotta di Cristalli', icon: '', hue: 282, sat: 46, wall: 'crystal', ambient: 'sparks', deco: 'dots', accent: '#e07bff' }
  };
  var HOME = ['ingresso', 'salotto', 'cucina', 'giardino', 'garage', 'soffitta', 'laboratorio', 'serra', 'torre'];
  var EXTRA = ['foresta', 'deserto', 'ghiacciaio', 'vulcano', 'oceano', 'spazio', 'neon', 'castello', 'giungla', 'miniera', 'nuvole', 'cristalli'];
  var ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX'];

  /* world: 1..100  ->  tema con nome, tonalità e varianti */
  function forWorld(w) {
    var key, round = 0;
    if (w <= 9) key = HOME[w - 1];
    else { var k = w - 10; key = EXTRA[k % EXTRA.length]; round = Math.floor(k / EXTRA.length); }
    var base = T[key];
    var o = {}; for (var p in base) o[p] = base[p];
    o.key = key; o.world = w;
    o.hue = (base.hue + round * 17) % 360;
    o.title = base.name + ROMAN[Math.min(round, ROMAN.length - 1)];
    o.name = o.title;
    // le ripetizioni cambiano anche i dettagli, così nessun mondo è uguale al precedente
    if (round > 0) o.sat = Math.max(14, base.sat + (round % 2 ? 6 : -6));
    o.seed = w * 7919;
    return o;
  }

  root.DomusThemes = { forWorld: forWorld, all: T };
})(typeof self !== 'undefined' ? self : this);
