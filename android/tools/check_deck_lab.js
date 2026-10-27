'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
const root=path.resolve(__dirname,'../..');
for(const name of ['assisted-effects.js','assisted-links.js','simulation-engine.js','deck-lab.js'])
 require(path.join(root,'presets',name));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const active=index.match(/app-v\d+\.\d+\.\d+\.html/);
assert(active,'No versioned entrypoint');
const html=fs.readFileSync(path.join(root,active[0]),'utf8');
const cards=JSON.parse(html.match(/window.STARTER_CARDS = (\[[\s\S]*?\n\]);/)[1]);
const decks=JSON.parse(fs.readFileSync(path.join(root,'presets/default-decks.js'),'utf8').match(/POKER_BLITZ_DEFAULT_DECKS=(\[[\s\S]+?\]);/)[1]);
const lookup=Object.fromEntries(cards.map(x=>[x.id,x]));
const type=id=>lookup[id]?.accentColor==='#FFC31A'?'HYPER':lookup[id]?.accentColor==='#FF0A68'?'COUNTER':'SUPER';
const ctype=c=>type(c?.id);
const lab=window.POKER_BLITZ_DECK_LAB;
const valid=decks.filter(d=>lab.legal(d,type));
assert.equal(cards.length,50);
assert(valid.length>=2,'Need legal default decks to test optimization');
assert(!html.includes('data-auto-ai'),'Separate AI dropdowns must be removed');
assert(html.includes('max="1000"'),'1000 game UI missing');
assert(html.includes('Array.from({length:10}'),'Ten-player selector missing');
for(const label of ['Nuevo Deck','Ver Decks','Creación de Decks','Mejora de Decks','Prueba Manual','Prueba Asistida','Simulación'])
 assert(html.includes(label),'Missing menu item '+label);
for(const key of ['deck-version-restore','runDeckLaboratory','versionHistory','20+2*(d.hyperCardIds||[]).length','30+2*(d.hyperCardIds||[]).length'])
 assert(html.includes(key),'Missing lab/history/limits feature '+key);
const random=(()=>{let n=487;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}})();
const original=valid[0];
let mutated=0;
for(let i=0;i<400;i++){
 const cand=lab.mutate(original,original,cards,type,random);
 if(!cand)continue;mutated++;
 assert(lab.legal(cand,type),'Mutant was illegal');
 assert(lab.similarity(original,cand)>=0.7,'Mutant lost essence');
}
assert(mutated>100,'Mutations should produce a meaningful search space');
for(const ease of ['facil','media','avanzada']){
 const newDeck=lab.generate(cards,{style:'combinaciones',aggression:4,ease},random,type);
 assert(lab.legal(newDeck,type),'Generated illegal deck for '+ease);
}
const engine=window.POKER_BLITZ_AUTOMATION({getCard:id=>lookup[id],cardType:ctype,version:'1.21.0'});
(async()=>{
 const players=Array.from({length:10},(_,i)=>({...valid[i%valid.length],difficulty:'beginner',participantId:'T'+i}));
 const ten=await engine.play({players,seed:57,pokerDeckCount:2,summaryOnly:true,maxRounds:6});
 assert.equal(ten.players.length,10);
 assert(ten.players.every(p=>p.difficulty==='expert'),'Every IA must be the same');
 assert(ten.players.every(p=>p.events.length===0),'Summary mode should avoid growing event history');
 assert(ten.eventsCount>0);
 assert.deepEqual(ten.incidents,[]);
 await assert.rejects(engine.play({players,pokerDeckCount:1,maxRounds:1}),/Se requieren 2 barajas/);
 const trial=await lab.improve(original,valid.slice(1,3),cards,type,{seed:97,iterations:3,games:2},{engine,seed:97,games:2,maxRounds:8,pokerDeckCount:2});
 assert(lab.legal(trial.best,type));
 assert(trial.similarity>=.7);
 assert(trial.trials.every(x=>x.similarity>=.7&&lab.legal(x,type)));
 const creation=await lab.create(cards,valid.slice(1,3),type,{seed:99,iterations:3,games:2,style:'economia',aggression:2,ease:'media'},{engine,seed:99,games:2,maxRounds:8,pokerDeckCount:2});
 assert(lab.legal(creation.best,type));
 assert(creation.history.length>=1);
 console.log('PASS Deck Lab: ten players, single expert IA, 1000-game UI, 70% similarity, legal generations, 3-round experiments.');
})().catch(e=>{console.error(e);process.exitCode=1});
