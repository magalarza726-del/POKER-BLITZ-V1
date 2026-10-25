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

 // Four updated cards: precise prices, player-chosen cards and AI legality.
 const cardsByNumber=n=>catalog['catalog_v3_'+n];
 assert(cardsByNumber('009').description.includes('cada 10 fichas'));
 assert(cardsByNumber('013').description.includes('viendo la mano completa'));
 assert(!cardsByNumber('063').description.includes('8 fichas'));
 assert(cardsByNumber('007').description.includes('Hyper Card de tu preferencia'));
 function makeFourCardHarness(){
   const mkCard=(id,rank,suit='S')=>({id,rank,suit,symbol:{S:'♠',H:'♥',D:'♦',C:'♣'}[suit]});
   const makeState=id=>({hand:[],handOwners:[],drawPile:[],drawOwners:[],activeHyper:[],pokerHand:[mkCard(id+'1','2'),mkCard(id+'2','3')],chips:0,currentPhase:'MAIN',turnsTaken:1,powerHandLimit:4,pokerLimit:7});
   const game={mode:'ASSISTED',round:1,activeIndex:0,decks:[{id:'A',playerNumber:1,name:'A'},{id:'B',playerNumber:2,name:'B'}],states:{A:makeState('A'),B:makeState('B')},pokerDrawPile:Array.from({length:12},(_,i)=>mkCard('draw'+i,'9'))};
   let modal=null;const logs=[];
   const manual={
     own(){},
     take(pid,i){const state=game.states[pid];if(i<0||i>=state.hand.length)return null;
       const cardId=state.hand.splice(i,1)[0],ownerId=state.handOwners.splice(i,1)[0]||pid;
       state.activeHyper=state.activeHyper.filter(v=>v!==i).map(v=>v>i?v-1:v);
       return {cardId,ownerId,playerId:pid};},
     giveBack(id,owner){const state=game.states[owner];state.drawPile.push(id);state.drawOwners.push(owner);}
   };
   const fx=window.POKER_BLITZ_ASSISTED_EFFECTS({sim:()=>game,card:id=>catalog[id],type,random:n=>0,shuffle:x=>x,log:(pid,action,detail)=>logs.push({pid,action,detail}),toast:()=>{},
     render:()=>{},setModal:m=>{modal=m},modal:()=>modal,esc:x=>String(x),drawPoker:(pid,state)=>{const c=game.pokerDrawPile.shift();if(c)state.pokerHand.push(c);return c;},
     pushUndo:()=>{},manual:()=>manual,links:()=>null});
   return {game,fx,logs,mkCard};
 }
 const effectStart=(h,id,target)=>{h.fx.enqueue({cardId:'catalog_v3_'+id,playerId:'A'});h.fx.finishChain();if(target)h.fx.choose(target);};
 {
   const h=makeFourCardHarness();h.game.states.B.chips=25;h.game.states.B.hand=['catalog_v3_053'];h.game.states.B.handOwners=['B'];
   effectStart(h,'009','B');
   assert(h.fx.choiceOptions().some(x=>x.value==='chips'));
   h.fx.chooseOption('chips');
   assert.equal(h.game.states.A.chips,2,'Maestro gets 1 per 10, not per 5');assert.equal(h.game.states.B.chips,23);
 }
 {
   const h=makeFourCardHarness();h.game.states.B.chips=6;h.game.states.B.hand=['catalog_v3_053'];h.game.states.B.handOwners=['B'];
   effectStart(h,'009','B');h.fx.chooseOption('power');
   assert.equal(h.game.states.A.pokerHand.length,3,'Borrowed SuperCard must activate');
   assert.deepEqual(h.game.states.B.drawPile,['catalog_v3_053'],'Borrowed Power Card must return to owner');
 }
 {
   const h=makeFourCardHarness();h.game.states.A.hand=['catalog_v3_053'];h.game.states.A.handOwners=['A'];
   h.game.states.A.drawPile=['catalog_v3_049','catalog_v3_062','catalog_v3_053'];h.game.states.A.drawOwners=['A','A','A'];
   assert(h.fx.canPlay('catalog_v3_007','A'),'Search is legal with a HyperCard in deck');
   effectStart(h,'007');
   assert(h.fx.choiceOptions().length===2,'Only HyperCards must be selectable');
   const target=h.fx.choiceOptions().find(o=>o.label==='VÍNCULO NOBLE');
   assert(target);h.fx.chooseOption(target.value);
   assert(h.game.states.A.hand.includes('catalog_v3_062'),'Search must retrieve the selected HyperCard');
   assert.equal(h.game.states.A.pokerHand.length,0,'Anzuelo discards exactly 2 Poker Cards');
   assert(!h.game.states.A.drawPile.includes('catalog_v3_062'),'Chosen HyperCard must leave the deck');
 }
 {
   const h=makeFourCardHarness();
   h.game.states.B.pokerHand=[h.mkCard('B-K','K','H'),h.mkCard('B-Q','Q','D')];
   effectStart(h,'013','B');
   assert(h.fx.modalMarkup().includes('K ♥'),'The entire rival hand must be visible');
   h.fx.chooseOption('own:A1');h.fx.chooseOption('rival:B-Q');h.fx.chooseOption('finish');
   assert.equal(h.game.states.A.pokerHand[0].id,'B-Q','Selected rival card must be received');
   assert.equal(h.game.states.B.pokerHand[1].id,'A1','Selected own card must be delivered');
 }
 {
   const h=makeFourCardHarness();h.game.states.A.chips=18;
   effectStart(h,'063');
   assert.equal(h.game.states.A.pokerHand.length,2,'Reino Amable must draw 2 even above 8 chips, after paying 2');
 }
 {
   const h=makeFourCardHarness();h.game.states.A.hand=['catalog_v3_062'];h.game.states.A.handOwners=['A'];h.game.states.A.activeHyper=[0];h.game.states.A.chips=30;
   effectStart(h,'063');
   assert.equal(h.game.states.A.pokerHand.length,4,'Vínculo Noble waives the 2 Poker Card payment');
 }

 {
   const h=makeFourCardHarness();h.game.states.B.chips=6;h.game.states.B.hand=['catalog_v3_033'];h.game.states.B.handOwners=['B'];
   effectStart(h,'009','B');h.fx.chooseOption('power');
   assert.deepEqual(h.game.states.B.drawPile,['catalog_v3_033'],'Inapplicable stolen CounterCard must return to owner Deck');
   assert.equal(h.game.states.A.pokerHand.length,2,'Inapplicable CounterCard must not produce effects');
 }
 {
   const h=makeFourCardHarness();h.game.states.B.chips=6;h.game.states.B.hand=['catalog_v3_049'];h.game.states.B.handOwners=['B'];
   h.game.states.A.hand=['catalog_v3_053','catalog_v3_053','catalog_v3_053'];h.game.states.A.handOwners=['A','A','A'];
   effectStart(h,'009','B');h.fx.chooseOption('power');
   assert(h.game.states.A.activeHyper.some(i=>h.game.states.A.hand[i]==='catalog_v3_049'),'Borrowed HyperCard should activate if costs allow');
   assert.equal(h.game.states.A.handOwners[h.game.states.A.activeHyper[0]],'B','Borrowed active HyperCard must retain owner identity');
 }
 {
   const h=makeFourCardHarness();h.game.states.B.chips=7;h.game.states.B.hand=[];h.game.states.B.pokerHand=[h.mkCard('BJ','J'),h.mkCard('BK','K')];
   assert(h.fx.canPlay('catalog_v3_009','A'),'Maestro must work with 5-9 chips when the 2-Poker option is available');
   effectStart(h,'009','B');assert(!h.fx.choiceOptions().some(o=>o.value==='chips'),'Zero-chip option should not be offered');
   h.fx.chooseOption('poker');
   assert.equal(h.game.states.A.pokerHand.length,4,'Maestro steals exactly two eligible Poker Cards');
 }

 console.log('Updated Maestro, Intercambio Forzado, Reino Amable and Anzuelo behaviors PASSED.');


 // Mobile PDF exports must offer a direct Blob link and the native share sheet.
 const mobileStart=src.indexOf('  // Android browsers require a fresh user gesture');
 const mobileEnd=src.indexOf('  // jsPDF core Helvetica',mobileStart);
 assert(mobileStart>0&&mobileEnd>mobileStart,'Android PDF export functions missing');
 let exportedPanel=null,nativeShares=0;const mobileListeners={};
 const mobileDocument={
   getElementById:()=>null,
   createElement:()=>({style:{},setAttribute:()=>{},remove:()=>{},querySelector:sel=>({hidden:false,addEventListener:(event,callback)=>{mobileListeners[sel+':'+event]=callback;}})}),
   body:{appendChild:el=>{exportedPanel=el;}}
 };
 const mobileUrl={createObjectURL:()=> 'blob:poker-blitz-mobile',revokeObjectURL:()=>{}};
 const mobileNavigator={share:()=>{nativeShares++;return Promise.resolve()},canShare:()=>true};
 const MobileFile=class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type;}};
 const mobileFunctions=new Function('document','URL','navigator','File','esc','toast','console','activePdfUrl',src.slice(mobileStart,mobileEnd)+';return {savePdfDocument,presentPdfExport};')(mobileDocument,mobileUrl,mobileNavigator,MobileFile,x=>x,()=>{},console,null);
 const mobilePdf={output:format=>{assert.equal(format,'blob');return {size:1024*1024,type:'application/pdf'};},save:()=>{throw Error('jsPDF.save must not be called on Android');}};
 assert(await mobileFunctions.savePdfDocument(mobilePdf,'POKER_BLITZ_200.pdf'),'Mobile export panel should be presented');
 assert(exportedPanel.innerHTML.includes('download="POKER_BLITZ_200.pdf"'),'Visible native download link required');
 assert(exportedPanel.innerHTML.includes('href="blob:poker-blitz-mobile"'),'PDF Blob URL required');
 mobileListeners['#pb-pdf-share:click']();
 assert.equal(nativeShares,1,'Native Android file share must be triggered by user gesture');
 assert(src.includes("new Pdf({unit:'mm',format:'a4',compress:true})"),'Simulation PDF must enable compression');
 assert(src.includes("new JsPDF({unit:'mm',format:'a4',compress:true})"),'Manual / Assisted PDFs must enable compression');
 assert(src.includes("compress:true}),pageW="),'Deck PDFs must enable compression');
 assert(src.includes("auto-summary-download"),'Large batches need a lightweight PDF');
 console.log('Android PDF download/share, compressed streams and compact report regression PASSED.');

 // Validate bindInputs on the Home screen (no Simulation nodes), and on Setup (two AIs).
 const start=src.indexOf('  function bindInputs(){');
 const end=src.indexOf('  function updateCharacterDraftPreview(){',start);
 assert(start>=0&&end>start,'Input binding code not found');
 const makeBinder=new Function('$','$$','autoSetup','testSetup','characterDraft',src.slice(start,end)+';return bindInputs;');
 assert.doesNotThrow(()=>makeBinder(()=>null,()=>[],{deckIds:[],aiLevels:[],gamesCount:1},{deckIds:[],seedInput:''},null)(),'Home startup must not crash');
 const listeners={};
 const aiInputs=['expert','beginner'].map((value,i)=>({dataset:{autoAi:String(i)},value,addEventListener:(name,fn)=>{listeners[i+':'+name]=fn;}}));
 const countInput={value:'200',addEventListener:(name,fn)=>{listeners['games:'+name]=fn;}};
 const autoSeedInput={value:'987654321',addEventListener:(name,fn)=>{listeners['auto-seed:'+name]=fn;}};
 const manualSeedInput={value:'123456789',addEventListener:(name,fn)=>{listeners['test-seed:'+name]=fn;}};
 const uiSetup={deckIds:[],aiLevels:[],gamesCount:1};
 const manualSetup={deckIds:[],seedInput:''};
 const findOne=selector=>selector==='#auto-games-count'?countInput:selector==='#auto-seed-input'?autoSeedInput:selector==='#test-seed-input'?manualSeedInput:null;
 const findAll=selector=>selector==='[data-auto-ai]'?aiInputs:[];
 assert.doesNotThrow(()=>makeBinder(findOne,findAll,uiSetup,manualSetup,null)(),'AI setup must not crash');
 listeners['0:change']();listeners['1:change']();
 assert.deepEqual(uiSetup.aiLevels,['expert','beginner'],'Per-player AI choices not bound');
 listeners['games:change']();
 assert.equal(uiSetup.gamesCount,200,'Batch count 200 must be accepted');
 countInput.value='250';listeners['games:change']();
 assert.equal(uiSetup.gamesCount,200,'Batch count must clamp to 200');
 listeners['auto-seed:input']();listeners['test-seed:input']();
 assert.equal(uiSetup.seedInput,'987654321','Auto seed field must bind');
 assert.equal(manualSetup.seedInput,'123456789','Manual and Assisted seed field must bind');
 // Exercise the actual seed parser and randomization utilities without a browser.
 const helperStart=src.indexOf('  function seedEditorHTML('),helperEnd=src.indexOf('  function renderAutoSetup(',helperStart);
 assert(helperStart>0&&helperEnd>helperStart,'Missing seed editor functions');
 const seeds=new Function(src.slice(helperStart,helperEnd)+';return {parseSeed,makeSeededRandom};')();
 assert.equal(seeds.parseSeed('0'),0);
 assert.equal(seeds.parseSeed('4294967295'),4294967295);
 assert.equal(seeds.parseSeed(''),null);
 assert.throws(()=>seeds.parseSeed('-1'));
 assert.throws(()=>seeds.parseSeed('4294967296'));
 assert.throws(()=>seeds.parseSeed('1.5'));
 const shuffleStart=src.indexOf('  function shuffle(arr){'),shuffleEnd=src.indexOf('  function buildPokerDeck(',shuffleStart);
 assert(shuffleStart>0&&shuffleEnd>shuffleStart,'Missing seed-aware shuffle');
 const buildShuffle=new Function('state','sim',src.slice(shuffleStart,shuffleEnd)+';return shuffle;');
 const original=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
 const shuffleWith=(seed,mode)=>buildShuffle({randomizationSettings:{mode}},{seededRng:seeds.makeSeededRandom(seed)})(original);
 for(const mode of ['FAST','SECURE','THOROUGH'])assert.deepEqual(shuffleWith(512340,mode),shuffleWith(512340,mode),'Fixed seed must reproduce '+mode+' manual/assisted deck');
 assert.notDeepEqual(shuffleWith(512340,'FAST'),shuffleWith(512341,'FAST'),'Different initial seeds should change the deck');
 console.log('Startup, 200-game UI, Manual/Assisted seeded shuffles and seed input regression PASSED.');

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

 const seatPlayers=decks6.map((p,i)=>({...p,participantId:'P'+(i+1)}));
 const seatDistribution=Object.fromEntries(seatPlayers.map(p=>[p.participantId,Array(6).fill(0)]));
 let first=null;
 for(let k=0;k<200;k++){
   const rotation=k%6;
   const seated=seatPlayers.map((_,seat)=>seatPlayers[(seat+rotation)%6]);
   const seed=(246810+Math.imul(k,0x9e3779b9))>>>0;
   const r=await engine.play({players:seated,seed,battleMode:'RUSH',pokerDeckCount:2,maxRounds:2});
   if(!first)first=r;
   assert.equal(r.players.length,6,'All six players must finish');
   assert(!r.incidents.some(x=>x.includes('Integridad')),'No inventory loss after seat rotation: '+r.incidents.join('; '));
   for(const player of r.players)seatDistribution[player.participantId][player.seat-1]++;
 }
 for(const places of Object.values(seatDistribution)){
   assert.equal(places.reduce((a,b)=>a+b,0),200,'Each participant must play all 200 games');
   assert(places.every(n=>n>=33&&n<=34),'Each seat must be occupied 33 or 34 times, found '+places);
 }
 const firstAgain=await engine.play({players:seatPlayers,seed:246810,battleMode:'RUSH',pokerDeckCount:2,maxRounds:2});
 assert.deepEqual(firstAgain.players.map(p=>[p.participantId,p.seat,p.chips,p.events.length]),first.players.map(p=>[p.participantId,p.seat,p.chips,p.events.length]),'Initial seed must reproduce the same game with the same seats');
 console.log('200 rotated matches, stable player identity and balanced 6-seat distribution PASSED.');

 console.log('50-game batch, 6-player setup, 64-card registry, and conservation regressions PASSED.');
 console.log('Simulation AI regression PASSED: 1–3 players, beginner/intermediate/expert, seeded results, Rush, cancellation, events.');
 console.log(JSON.stringify({rounds:a.rounds,events:a.eventsCount,scores:a.players.map(p=>p.chips),incidents:a.incidents.slice(0,5)}));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
