'use strict';
// Regresión de los diálogos por párrafos y del dado de la mesa (sin navegador).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const match=index.match(/app-v\d+\.\d+\.\d+\.html/);
assert(match,'No se encontró la entrada actual de la app');
const html=fs.readFileSync(path.join(root,match[0]),'utf8');
const css=fs.readFileSync(path.join(root,'presets/blitz-redesign.css'),'utf8');
const start=html.indexOf('// El texto original de las notas nunca');
const end=html.indexOf('function renderHome(){',start);
assert(start>=0&&end>start,'Funciones de diálogo no disponibles');
assert(html.includes('data-action="next-blitz-note"'),'Falta el botón de avance');
assert(html.includes('s.dieRolling?'+"'is-rolling'"),'Falta estado de giro');
assert(css.includes('@keyframes blitz-die-roll'),'Falta animación del dado');
assert(css.includes('prefers-reduced-motion'),'Falta accesibilidad de movimiento');

const raw='¿Eso es todo? Qué decepción...\n\nMira bien mi mano. Siete cartas.\n\nPara cualquiera, esto sería mala suerte.\n\nPara mí... todavía no.\n\nActivo Plano y Simple. Robo una Poker Card.';
const sim={decks:[{id:'p1'},{id:'p2'}],activeIndex:0,states:{p1:{notes:raw},p2:{notes:'Otro jugador'}}};
const note={value:'',readOnly:false,scrollTop:0,scrollHeight:500,focus(){this.focused=true}};
const stepButton={hidden:true,textContent:''};
const select=selector=>selector==='#blitz-note'?note:selector==='.blitz-dialogue-step'?stepButton:null;
let counter=0;const queue=new Map();
const enqueue=fn=>{const id=++counter;queue.set(id,fn);return id};
const cryptoStub={getRandomValues(buffer){buffer[0]=10;return buffer}};
const factory=new Function('$','sim','screen','setTimeout','clearTimeout','randomInt','crypto',
  'let dialoguePlayback=null;'+html.slice(start,end)+
  'return {startDialoguePlayback,advanceDialoguePlayback,stopDialoguePlayback,syncDialoguePlaybackView,splitDialogueParagraphs,fairDieFace,get state(){return dialoguePlayback}};');
const v=factory(select,sim,'simulator',enqueue,id=>queue.delete(id),()=>0,cryptoStub);
v.startDialoguePlayback();
assert.equal(v.state.paragraphs.length,5);
assert.equal(note.value,'');
assert.equal(note.readOnly,true);
for(let k=0;k<500&&v.state.typing;k++){
  const item=queue.entries().next().value;
  assert(item,'Se detuvo la escritura prematuramente');
  queue.delete(item[0]);item[1]();
}
assert(note.value.startsWith('¿Eso es todo?'));
assert(!note.value.includes('Siete cartas'));
v.advanceDialoguePlayback();
assert.equal(note.value,'','El párrafo anterior debe desaparecer');
v.advanceDialoguePlayback();
assert(note.value.includes('Siete cartas'),'Enter durante la escritura debe completar el párrafo');
for(let i=1;i<4;i++){v.advanceDialoguePlayback();v.advanceDialoguePlayback();}
assert.equal(v.state.index,4);
assert(note.value.includes('Activo Plano y Simple'));
v.advanceDialoguePlayback();
assert.equal(v.state,null);
assert.equal(note.value,raw);
assert.equal(note.readOnly,false);
assert.equal(stepButton.hidden,true);
assert.equal(sim.states.p1.notes,raw,'No se debe modificar el texto original');
assert.deepEqual(v.splitDialogueParagraphs('A.\r\n\r\nB.\r\nC.'),['A.','B.','C.']);
v.startDialoguePlayback();
sim.activeIndex=1;
v.syncDialoguePlaybackView();
assert.equal(v.state,null,'Cambiar de jugador debe detener la reproducción');
assert.equal(v.fairDieFace(),5,'RNG criptográfico: 10 módulo 6 + 1 = 5');
sim.diceSeeded=true;
assert.equal(v.fairDieFace(),1,'La semilla debe usar el generador reproducible');
console.log('PASS: diálogo (5 párrafos, Enter, restauración, cambio de jugador), dado y animación CSS');
