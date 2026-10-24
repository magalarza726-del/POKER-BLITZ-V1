'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
require('../../presets/assisted-effects.js');
const factory=window.POKER_BLITZ_ASSISTED_EFFECTS;
assert.equal(typeof factory,'function');
const cards={
 'catalog_v3_053':{id:'catalog_v3_053',name:'Plano y simple',accentColor:'#18E0E5',description:'Roba una Poker Card del mazo. Hasta 2 veces por turno.'},
 'catalog_v3_011':{id:'catalog_v3_011',name:'Reabastecimiento total',accentColor:'#18E0E5',description:'Todos roban una Power Card y una Poker Card.'},
 'catalog_v3_009':{id:'catalog_v3_009',name:'Maestro de fichas',accentColor:'#18E0E5'},
 'catalog_v3_027':{id:'catalog_v3_027',name:'Despertar del máximo poder',accentColor:'#FFC31A'},
 'catalog_v3_033':{id:'catalog_v3_033',name:'He dicho que no',accentColor:'#FF0A68'}
};
const poker=(rank,id)=>({rank,suit:'S',id});
const people=[{id:'p1',playerNumber:1,name:'Uno'},{id:'p2',playerNumber:2,name:'Dos'}];
const state=id=>({hand:[],handOwners:[],drawPile:['catalog_v3_053'],drawOwners:[id],pokerHand:[],activeHyper:[],chips:5,currentPhase:'MAIN',pokerLimit:7,powerHandLimit:4,turnsTaken:0});
const game={decks:people,states:{p1:state('p1'),p2:state('p2')},pokerDrawPile:[poker('A','p1'),poker('2','p2'),poker('K','p3'),poker('Q','p4'),poker('7','p5'),poker('8','p6')],round:1,activeIndex:0};
let modal=null;const events=[],toasts=[];
const manual={
 own:()=>{},
 take:(id,index)=>{const s=game.states[id];return {cardId:s.hand.splice(index,1)[0],ownerId:s.handOwners.splice(index,1)[0]||id}},
 giveBack:(id,owner)=>{game.states[owner].drawPile.push(id);game.states[owner].drawOwners.push(owner)}
};
const engine=factory({
 sim:()=>game,card:id=>cards[id],type:card=>card.accentColor==='#FFC31A'?'HYPER':card.accentColor==='#FF0A68'?'COUNTER':'SUPER',
 random:()=>0,shuffle:x=>x,manual:()=>manual,log:(...ev)=>events.push(ev),toast:x=>toasts.push(x),render:()=>{},
 drawPoker:(id,st)=>{const card=game.pokerDrawPile.shift();if(card)st.pokerHand.push(card);return card},
 pushUndo:()=>{},modal:()=>modal,setModal:x=>{modal=x},esc:String
});
assert(engine.supported('catalog_v3_053'),'Simple draw must be supported');
assert(!engine.supported('nonexistent'),'Unknown cards must not be silently handled');
engine.enqueue({cardId:'catalog_v3_053',playerId:'p1'});
engine.finishChain();
assert.equal(game.states.p1.pokerHand.length,1,'Poker draw must change actual hand');
engine.enqueue({cardId:'catalog_v3_011',playerId:'p1'});
engine.finishChain();
assert.equal(game.states.p2.pokerHand.length,1,'Global draw must affect opponent');
assert.equal(game.states.p2.hand.length,1,'Global draw must affect Power Hand');
game.states.p2.chips=10;
engine.enqueue({cardId:'catalog_v3_009',playerId:'p1'});
engine.finishChain();
assert.equal(modal.type,'assisted-target','Effect must offer target selection');
engine.choose('p2');
assert.equal(game.states.p1.chips,7,'Two chips actually transferred');
assert.equal(game.states.p2.chips,8,'Opponent lost chips');
game.states.p1.hand=['catalog_v3_027','catalog_v3_053'];game.states.p1.handOwners=['p1','p1'];
game.states.p1.pokerHand=[poker('3','extra1'),poker('4','extra2')];
engine.activate(0);
assert.equal(game.states.p1.activeHyper.length,1,'HyperCard physically activated');
assert.equal(game.states.p1.powerHandLimit,5,'HyperCard changed power hand limit');
assert.equal(game.states.p1.pokerHand.length,1,'HyperCard Poker cost paid');
assert.equal(events.some(x=>x[1]==='Efecto asistido'),true,'Effect resolution recorded');
assert.equal(toasts.length,0,'Unexpected errors: '+toasts.join('; '));
const html=fs.readFileSync(path.join(__dirname,'../../app-v1.19.7.html'),'utf8');
for(const key of ['manual-test','manual-full','manual-simple','assisted-test','manualChoice','MANUAL_SIMPLE','ASSISTED','assisted-target']){
 assert(html.includes(key),'Missing mode UI hook: '+key)
}
assert(html.includes('presets/assisted-effects.js'),'Assisted module must load in web and offline');
console.log('Assisted effects and mode split OK: real draws, target, chips, Hyper costs, separate menu.');
