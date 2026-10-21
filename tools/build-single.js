#!/usr/bin/env node
/* Crea dist/domuslab.html: tutto il gioco in un solo file (CSS e JS inclusi).
 * Si apre con un doppio clic, senza server. Uso: node tools/build-single.js */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, () => '<style>\n' + fs.readFileSync(path.join(root, 'css/style.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => '<script>\n' + fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script>/g, '<\\/script>') + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'domuslab.html'), html);
console.log('Creato dist/domuslab.html (' + Math.round(html.length / 1024) + ' KB)');
