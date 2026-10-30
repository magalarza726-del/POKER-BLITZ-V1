'use strict';
// node android/tools/check_cover_carousel_hq.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'app-v1.22.1.html'),'utf8');
const css=fs.readFileSync(path.join(root,'presets/main-menu.css'),'utf8');
const entry=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes("const APP_VERSION = '1.22.1'"));
assert(entry.includes('app-v1.22.1.html?v=single-cover-hq-v16-20261029'));
assert(html.includes('main-menu.css?v=single-cover-hq-v2-20261029'));
assert(html.includes('const slides=[...POKER_COVERS,POKER_COVERS[0]];'));
assert(!html.includes('POKER_COVERS.slice(0,3)'));
assert(html.includes('$'+'{o.src}?v=hq-original-20261029'));
assert(/\.pb-cover-track\s*\{[^}]*width:500%/.test(css));
assert(/\.pb-cover-frame\s*\{[^}]*flex:0 0 20%/.test(css));
assert(/\.pb-cover-frame img\s*\{[^}]*object-fit:contain/.test(css));
assert(css.includes('pb-slide-cycle 44s'));
for(const p of ['-20%','-40%','-60%','-80%'])assert(css.includes('translateX('+p+')'));
assert(css.includes('22.72727%') && css.includes('97.72727%'));
assert(!css.includes('width:700%'));
const dimensions={cian:[598,845],dorado:[597,845],magenta:[627,845],equipo:[1024,1536]};
for(const [name,expected] of Object.entries(dimensions)){
  const file=fs.readFileSync(path.join(root,'assets/cover-blitz-'+name+'.webp'));
  assert.equal(file.toString('ascii',0,4),'RIFF');
  assert.equal(file.toString('ascii',8,12),'WEBP');
  assert.equal(file.toString('ascii',12,16),'VP8 ');
  const width=file.readUInt16LE(26)&0x3fff;
  const height=file.readUInt16LE(28)&0x3fff;
  assert.deepEqual([width,height],expected,name+' no usa la resolución original');
}
console.log('PASS: una portada por vez, 10 s de permanencia, transición de 1 s y originales WebP');
