'use strict';
// Run: node android/tools/check_main_layout.js
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const css=fs.readFileSync(path.join(root,'presets/main-menu.css'),'utf8');
const html=fs.readFileSync(path.join(root,'app-v1.22.4.html'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
function rule(selector){
  const start=css.indexOf(selector+' {');
  if(start<0)throw new Error('Regla no encontrada: '+selector);
  const end=css.indexOf('}',start);
  return css.slice(start,end);
}
const home=rule('.pb-new-home');
const poster=rule('.pb-cover-window');
const frame=rule('.pb-cover-frame');
const image=rule('.pb-cover-frame img');
const menu=rule('.pb-menu-inner');
const button=rule('.pb-home-actions button');
assert(home.includes('.82fr')&&home.includes('1.18fr'),'Menú derecho debe ser más ancho');
assert(poster.includes('min(100%,460px)'),'Portada debe ser estrecha');
assert(image.includes('object-fit:contain'),'Debe verse la imagen entera');
assert(image.includes('object-position:center center'),'Debe centrarse sin cortar');
assert(menu.includes('720px'),'Panel del menú debe crecer');
const coverPane=rule('.pb-cover-pane');
assert(coverPane.includes('height:100dvh')&&coverPane.includes('gap:0'),'La portada debe usar la altura sin huecos de encabezados');
assert(poster.includes('height:100%')&&poster.includes('max-height:100%'),'La ventana debe aprovechar el alto disponible');
assert(!css.includes('.pb-home-heading')&&!css.includes('.pb-carousel-caption'),'No deben quedar estilos de textos exteriores');
const leftStart=html.indexOf('<section class="pb-cover-pane"');
const rightStart=html.indexOf('<section class="pb-menu-pane"',leftStart);
assert(leftStart>=0&&rightStart>leftStart,'El menú y la portada deben coexistir');
const leftMarkup=html.slice(leftStart,rightStart);
assert(!leftMarkup.includes('pb-home-heading'),'Eliminar título exterior superior');
assert(!leftMarkup.includes('pb-carousel-caption'),'Eliminar leyenda exterior inferior');
assert(leftMarkup.includes('pb-cover-track'),'Conservar el carrusel');

assert(button.includes('11.6dvh')&&button.includes('22px'),'Botones más grandes');
assert(css.includes('@media(max-width:1050px)'), 'El diseño debe pasar a una columna en pantallas estrechas');
assert(css.includes('grid-template-columns:1fr;overflow:visible'),'No provocar desplazamiento horizontal en móvil');
assert(css.includes('pb-slide-cycle 44s'),'Conservar carrusel de 10 s + 1 s de transición');
assert(css.includes('flex:0 0 20%'),'Una sola portada visible por vez');
assert(html.includes("const APP_VERSION = '1.22.4'"));
assert(html.includes('main-menu.css?v=clean-tall-poster-v5-20261029'));
assert(index.includes('app-v1.22.4.html?v=clean-tall-cover-v19-20261029'));
console.log('PASS: portada alta y completa, sin textos exteriores, menú intacto, móvil y carrusel de 10 s');
