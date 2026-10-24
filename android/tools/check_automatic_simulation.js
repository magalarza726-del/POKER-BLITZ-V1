'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
require('../../presets/assisted-effects.js');
require('../../presets/assisted-links.js');
require('../../presets/simulation-engine.js');
const src=fs.readFileSync(path.join(__dirname,'../../app-v1.19.8.html'),'utf8');
const found=[...src.matchAll(/"id":\s*"(catalog_v3_\d+)",\s*"name":\s*("(?:\\.|[^"\\])*"),\s*"description":\s*("(?:\\.|[^"\\])*"),\s*"accentColor":\s*"(#[A-Fa-f0-9]{6})"/g)];
const catalog=Object.fromEntries(found.map(m=>[m[1],{id:m[1],name:JSON.parse(m[2]),description:JSON.parse(m[3]),accentColor:m[4]}]));
assert.equal(found.length,64,'Need all official card effects');
const factory=window.POKER_BLITZ_AUTOMATION;
const type=c=>!c?'OTHER':c.accentColor==='#FFC31A'?'HYPER':c.accentColor==='#FF0A68'?'COUNTER':'SUPER';
const mk=(name,difficulty,ids)=>({id:name,name,description:'Deck de prueba',difficulty,cardIds:ids.map(i=>'catalog_v3_'+i)});
const decks=[
 mk('Cartas y fichas','beginner',['053','053','011','009','031','032','054','033','029','035','042','044','024','040','005','013','045','061','057','063']),
 mk('Defensa y artilugios','intermediate',['004','006','033','034','042','043','044','058','059','060','005','049','050','055','053','053','011','016','010','020']),
 mk('Comodines','expert',['001','029','030','035','040','041','045','046','047','049','050','053','053','011','031','037','039','048','051','064']),
 mk('Control','expert',['003','004','006','008','009','013','014','015','017','018','019','020','021','022','023','024','026','033','038','052'])
];
async function run(){
 const engine=factory({getCard:id=>catalog[id],cardType:type,version:'1.19.8'});
 // Validate bindInputs on the Home screen (no Simulation nodes), and on Setup (two AIs).
 const start=src.indexOf('  function bindInputs(){');
 const end=src.indexOf('  function updateCharacterDraftPreview(){',start);
 assert(start>=0&&end>start,'Input binding code not found');
 const makeBinder=new Function('$','$$','autoSetup','characterDraft',src.slice(start,end)+';return bindInputs;');
 assert.doesNotThrow(()=>makeBinder(()=>null,()=>[],{deckIds:[],aiLevels:[],gamesCount:1},null)(),'Home startup must not crash');
 const listeners={};
 const aiInputs=['expert','beginner'].map((value,i)=>({dataset:{autoAi:String(i)},value,addEventListener:(name,fn)=>{listeners[i+':'+name]=fn;}}));
 const countInput={value:'50',addEventListener:(name,fn)=>{listeners['games:'+name]=fn;}};
 const uiSetup={deckIds:[],aiLevels:[],gamesCount:1};
 const findOne=selector=>selector==='#auto-games-count'?countInput:null;
 const findAll=selector=>selector==='[data-auto-ai]'?aiInputs:[];
 assert.doesNotThrow(()=>makeBinder(findOne,findAll,uiSetup,null)(),'AI setup must not crash');
 listeners['0:change']();listeners['1:change']();
 assert.deepEqual(uiSetup.aiLevels,['expert','beginner'],'Per-player AI choices not bound');
 listeners['games:change']();
 assert.equal(uiSetup.gamesCount,50,'Batch count 50 must be accepted');
 countInput.value='80';listeners['games:change']();
 assert.equal(uiSetup.gamesCount,50,'Batch count must clamp to 50');
 console.log('Startup and Simulation UI binding regression PASSED.');

 assert(src.includes('data-action="auto-simulation"'),'Missing home Simulation button');
 assert(src.includes('data-auto-ai'),'Missing per-player reasoning selection');
 assert(src.includes('downloadAutoPdf'),'Missing PDF download function');
 assert(src.includes('autoRunning'),'Missing simulation progress screen');
 const a=await engine.play({players:decks.slice(0,3),seed:347198,battleMode:'BLITZ',pokerDeckCount:2,maxRounds:2});
 assert.equal(a.players.length,3);
 assert.equal(a.battleMode,'BLITZ');
 assert.equal(a.goal,30);
 assert.equal(a.seed,347198);
 assert(a.eventsCount>4,'Game did not advance');
 assert(a.players.every(p=>p.events.some(e=>e.action==='Fin del turno')),'Not all players acted');
 assert.deepEqual(new Set(a.players.map(p=>p.difficulty)),new Set(['beginner','intermediate','expert']));
 const b=await engine.play({players:decks.slice(0,3),seed:347198,battleMode:'BLITZ',pokerDeckCount:2,maxRounds:2});
 assert.deepEqual(a.players.map(p=>[p.name,p.chips,p.events.length]),b.players.map(p=>[p.name,p.chips,p.events.length]),'Seeded simulation must reproduce identical scores and event counts');
 const rush=await engine.play({players:[decks[3]],seed:101,battleMode:'RUSH',pokerDeckCount:1,maxRounds:1});
 assert.equal(rush.goal,15);
 assert.equal(rush.players.length,1);
 assert(rush.players[0].events.length>0);
 const cancelled=await engine.play({players:decks.slice(0,2),seed:55,battleMode:'BLITZ',maxRounds:2,cancel:{cancelled:true}});
 assert.equal(cancelled.cancelled,true,'Cancellation must interrupt run');

 const registry=window.POKER_BLITZ_ASSISTED_EFFECTS({sim:()=>({}),card:id=>catalog[id],links:()=>null});
 assert.equal(Object.keys(catalog).length,64);
 assert(Object.keys(catalog).every(id=>registry.supported(id)),'Every one of the 64 official cards must have an assisted effect registration');
 const decks6=Array.from({length:6},(_,i)=>({...decks[i%decks.length],id:'TEST-'+i,name:'Jugador '+(i+1),difficulty:['beginner','intermediate','expert'][i%3]}));
 const six=await engine.play({players:decks6,seed:183640,battleMode:'BLITZ',pokerDeckCount:2,maxRounds:5});
 assert.equal(six.players.length,6,'Six-player simulation must complete');
 assert(!six.incidents.some(e=>e.includes('Integridad')),'Six-player inventory must remain conserved: '+six.incidents.join('; '));
 for(const p of six.players)assert(p.events.every(e=>!e.state||e.state.hyper<=3),'Never permit more than 3 active HyperCards');
 const batch=[];
 for(let i=0;i<50;i++){
   const seed=(59123+Math.imul(i,0x9e3779b9))>>>0;
   const r=await engine.play({players:decks.slice(0,3),seed,battleMode:'RUSH',pokerDeckCount:2,maxRounds:5});
   assert.equal(r.seed,seed);assert.equal(r.players.length,3);
   assert(!r.incidents.some(e=>e.includes('Integridad')),'Inventory error in batch game '+(i+1)+': '+r.incidents.join('; '));
   batch.push(r);
 }
 assert.equal(batch.length,50,'Batch must execute up to 50 individual games');
 assert.equal(new Set(batch.map(x=>x.seed)).size,50,'Batch must use 50 distinct deterministic seeds');
 const one=await engine.play({players:decks.slice(0,3),seed:batch[0].seed,battleMode:'RUSH',pokerDeckCount:2,maxRounds:5});
 assert.deepEqual(one.players.map(p=>[p.chips,p.events.length]),batch[0].players.map(p=>[p.chips,p.events.length]),'Replay of the first batch seed should reproduce results');
 console.log('50-game batch, 6-player setup, 64-card registry, and conservation regressions PASSED.');
 console.log('Simulation AI regression PASSED: 1–3 players, beginner/intermediate/expert, seeded results, Rush, cancellation, events.');
 console.log(JSON.stringify({rounds:a.rounds,events:a.eventsCount,scores:a.players.map(p=>p.chips),incidents:a.incidents.slice(0,5)}));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
