'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(index.includes('app-v1.21.2.html'),'La página principal debe cargar la nueva versión');
const html=fs.readFileSync(path.join(root,'app-v1.21.2.html'),'utf8');
const css=fs.readFileSync(path.join(root,'presets/blitz-redesign.css'),'utf8');
const palette=[
 ['verde','Verde'],['negro','Negro'],['rojo','Rojo'],['azul','Azul'],['morado','Morado']
];
const begin=html.indexOf('const TEST_BACKGROUND_OPTIONS=');
const end=html.indexOf('function renderTestBackgroundChoices()',begin);
assert(begin>=0&&end>begin,'Faltan las opciones de fondo');
const options=new Function(html.slice(begin,end)+'return {TEST_BACKGROUND_OPTIONS,normalizedTestBackground};')();
assert.equal(options.TEST_BACKGROUND_OPTIONS.length,5);
assert.equal(options.normalizedTestBackground(undefined),'verde');
assert.equal(options.normalizedTestBackground(''), 'verde');
assert.equal(options.normalizedTestBackground('invalid'),'verde');
for(const [id,label] of palette){
  assert.equal(options.normalizedTestBackground(id),id);
  assert(options.TEST_BACKGROUND_OPTIONS.some(o=>o.id===id&&o.label===label));
  const rel='assets/table-texture-'+id+'.webp';
  assert(html.includes(rel),'La vista previa debe usar '+rel);
  assert(css.includes('../'+rel),'El fondo del tablero debe usar '+rel);
  assert(css.includes('data-table-background="'+id+'"'),'Falta selector CSS para '+id);
  const binary=fs.readFileSync(path.join(root,rel));
  assert(binary.subarray(0,4).toString()==='RIFF'&&binary.subarray(8,12).toString()==='WEBP','Formato WebP inválido: '+rel);
}
assert(html.includes("testBackground:'verde'"),'Valor predeterminado incorrecto');
assert(html.includes('testBackground:normalizedTestBackground(saved.testBackground)'),'La configuración previa no se normaliza');
assert(html.includes('testBackground:normalizedTestBackground(x.testBackground)'),'La configuración JSON no se normaliza');
assert(html.includes('data-action="set-test-background"'),'Falta el control interactivo');
assert(html.includes("state.testBackground=key")&&html.includes("saveState();"),'No se almacena la preferencia');
assert(/data-table-background=.*normalizedTestBackground\(state.testBackground\)/.test(html),'El tablero no sigue el ajuste');
assert(html.includes('renderTestBackgroundChoices()'),'La configuración no muestra las texturas');
assert(html.includes('blitz-redesign.css?v=custom-test-textures-v9-20261029'),'El CSS debe actualizar la caché');
console.log('PASS: cinco fondos WebP, vista previa, fondo verde predeterminado, persistencia, respaldo JSON y rutas nuevas');
