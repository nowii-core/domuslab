/* DomusLab — personaggi. I primi sono gratis, gli altri si comprano con le monete. */
(function (root) {
  'use strict';
  var SKINS = [
    { id: 'domo', name: 'Domo', price: 0, top: '#f6f8ff', L: '#c9d4f1', R: '#9eaedb', visor: '#0e1830', eye: '#6effe6', deco: 'antenna', accent: '#4d7bff' },
    { id: 'micio', name: 'Micio', price: 0, top: '#ffc78a', L: '#f0a05a', R: '#cf7d36', visor: '#4a2209', eye: '#ffe27a', deco: 'ears', accent: '#ff8a3c' },
    { id: 'panda', name: 'Panda', price: 0, top: '#ffffff', L: '#e6e9f1', R: '#c3c8d6', visor: '#15171f', eye: '#ffffff', deco: 'ears-dark', accent: '#555b78' },
    { id: 'alieno', name: 'Alieno', price: 0, top: '#bdf7a6', L: '#80d96b', R: '#56ad47', visor: '#251042', eye: '#ff7be5', deco: 'dual', accent: '#8a4dff' },
    { id: 'diavoletto', name: 'Diavoletto', price: 0, top: '#ff8a8a', L: '#e65454', R: '#bb3434', visor: '#25090c', eye: '#ffd84d', deco: 'horns', accent: '#ffcf33' },
    { id: 'zucca', name: 'Zucca', price: 0, top: '#ffb347', L: '#f08a1c', R: '#c76a0c', visor: '#2e1704', eye: '#fff07a', deco: 'stem', accent: '#7acb3c' },
    { id: 'ghiaccio', name: 'Ghiaccio', price: 80, top: '#e2f8ff', L: '#aee6f7', R: '#7fc7e0', visor: '#0b2a3d', eye: '#9ff6ff', deco: 'antenna', accent: '#37c8ff' },
    { id: 'ninja', name: 'Ninja', price: 120, top: '#4a4f66', L: '#2f3347', R: '#1f2232', visor: '#07080d', eye: '#ff3d5a', deco: 'band', accent: '#ff3d5a' },
    { id: 're', name: 'Re', price: 150, top: '#ffe38a', L: '#f2c14a', R: '#c99a22', visor: '#2b1d03', eye: '#ffffff', deco: 'crown', accent: '#ffcf33' },
    { id: 'unicorno', name: 'Unicorno', price: 200, top: '#ffe0f4', L: '#f7b8e0', R: '#d98ec2', visor: '#3a1347', eye: '#a8f0ff', deco: 'horn1', accent: '#ff6fd0' },
    { id: 'cyber', name: 'Cyber', price: 250, top: '#2c3a33', L: '#1a2420', R: '#0f1613', visor: '#02060a', eye: '#39ff88', deco: 'dual', accent: '#39ff88' },
    { id: 'oro', name: 'Cubo d\'oro', price: 400, top: '#fff2b0', L: '#ffd34d', R: '#d7a21a', visor: '#2b1d03', eye: '#fff7d6', deco: 'antenna', accent: '#ffb800' }
  ];

  /* Crea lo sprite del personaggio personalizzato (emoji o immagine) come canvas 160x160. */
  function spriteFromEmoji(text) {
    var c = document.createElement('canvas'); c.width = c.height = 160;
    var x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var t = String(text || '🙂').trim().slice(0, 4) || '🙂';
    x.font = (t.length > 2 ? 70 : 118) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.fillText(t, 80, 88);
    return c;
  }
  function spriteFromImage(img) {
    var c = document.createElement('canvas'); c.width = c.height = 160;
    var x = c.getContext('2d');
    var s = Math.min(160 / img.width, 160 / img.height);
    var w = img.width * s, h = img.height * s;
    x.drawImage(img, (160 - w) / 2, (160 - h) / 2, w, h);
    return c;
  }

  root.DomusSkins = { list: SKINS, spriteFromEmoji: spriteFromEmoji, spriteFromImage: spriteFromImage };
})(typeof self !== 'undefined' ? self : this);
