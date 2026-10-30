'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'app-v1.22.5.html'),'utf8');
const css=fs.readFileSync(path.join(root,'presets/main-menu.css'),'utf8');
const entry=fs.readFileSync(path.join(root,'index.html'),'utf8');
const image=fs.readFileSync(path.join(root,'assets/cover-blitz-single.webp'));
assert(html.includes("const APP_VERSION = '1.22.5'"));
assert(entry.includes('app-v1.22.5.html?v=static-cover-v20-20261030'));
assert(html.includes('main-menu.css?v=single-static-cover-v6-20261030'));
assert(html.includes('class="pb-static-cover"'));
assert(html.includes('assets/cover-blitz-single.webp?v=official-cover-20261030'));
assert(!html.includes('POKER_COVERS')&&!html.includes('pb-cover-track')&&!html.includes('pb-cover-frame'));
assert(!css.includes('pb-slide-cycle')&&!css.includes('pb-cover-track')&&!css.includes('pb-cover-frame'));
assert(css.includes('.pb-static-cover')&&css.includes('object-fit:contain'));
assert(image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP');
assert.equal(image.toString('ascii',12,16),'VP8 ');
assert.equal(image.readUInt16LE(26)&0x3fff,1024);
assert.equal(image.readUInt16LE(28)&0x3fff,1536);
for(const action of ['play-direct','deck-hub','extras','developer'])
 assert(html.includes('data-action="'+action+'"'),'El menú perdió '+action);
for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))
 if(match[1].trim())new Function(match[1]);
console.log('PASS: portada única 1024x1536, sin carrusel ni animación, acceso publicado y menú intacto');
