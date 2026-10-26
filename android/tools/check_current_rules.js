'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
const root=path.resolve(__dirname,'../..');
for(const file of ['assisted-effects.js','assisted-links.js','manual-game-rules.js','simulation-engine.js'])require(path.join(root,'presets',file));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const entry=index.match(/app-v\d+\.\d+\.\d+\.html/);
assert(entry,'Missing versioned current entrypoint');
const html=fs.readFileSync(path.join(root,entry[0]),'utf8');
const match=html.match(/window.STARTER_CARDS = (\[[\s\S]*?\n\]);/);
assert(match,'Official 50-card catalog missing');
const cards=JSON.parse(match[1]),lookup=Object.fromEntries(cards.map(c=>[c.id,c]));
const type=c=>c?.accentColor==='#FFC31A'?'HYPER':c?.accentColor==='#FF0A68'?'COUNTER':'SUPER';
const id=n=>'catalog_v3_'+n;
const power=cards.filter(c=>type(c)!=='HYPER'),hyper=cards.filter(c=>type(c)==='HYPER');
assert.equal(cards.length,50,'Exactly 50 official cards required');
assert.equal(power.filter(c=>type(c)==='SUPER').length,32);
assert.equal(power.filter(c=>type(c)==='COUNTER').length,6);
assert.equal(hyper.length,12);
assert.equal(new Set(cards.map(c=>c.id)).size,50);
const defaultDecks=JSON.parse(fs.readFileSync(path.join(root,'presets/default-decks.js'),'utf8').match(/POKER_BLITZ_DEFAULT_DECKS=(\[[\s\S]*?\]);/)[1]);
assert.equal(defaultDecks.length,10);
for(const d of defaultDecks){
  assert((d.hyperCardIds||[]).length<=3);
  assert.equal(new Set(d.hyperCardIds).size,d.hyperCardIds.length);
  assert(d.cardIds.every(x=>type(lookup[x])!=='HYPER'&&lookup[x]));
  assert(d.hyperCardIds.every(x=>type(lookup[x])==='HYPER'));
  const counts={};for(const x of d.cardIds)counts[x]=(counts[x]||0)+1;
  assert(Object.values(counts).every(n=>n<=3),'Too many copies in '+d.name);
}
// These are deliberately incomplete after obsolete cards were removed; never substitute them.
assert(defaultDecks.some(d=>d.cardIds.length<20+2*d.hyperCardIds.length));
assert(html.includes('function deckIsLegal(d)'),'Legal-deck validation missing');
const C=(rank,suit,id)=>({id,rank,suit,symbol:({S:'♠',H:'♥',D:'♦',C:'♣'})[suit]});
const players=[{id:'p1',name:'Uno',playerNumber:1},{id:'p2',name:'Dos',playerNumber:2}];
function harness(){
  const state=id=>({hand:[],handOwners:[],drawPile:[id==='p1'?idCard('053'):idCard('054')],drawOwners:[id],pokerHand:[],activeHyper:[],hyperReserve:[],chips:0,turnsTaken:0,currentPhase:'MAIN',powerHandLimit:3,pokerLimit:7});
  const idCard=n=>id(n);
  const game={mode:'ASSISTED',decks:players,states:{p1:state('p1'),p2:state('p2')},pokerDrawPile:Array.from({length:50},(_,i)=>C(String(i%9+2),['S','H','D','C'][i%4],'draw'+i)),round:1,activeIndex:0,assistedPending:[]};
  let modal=null;const logs=[];
  const manual={
    own(pid){const s=game.states[pid];s.handOwners=s.handOwners.length===s.hand.length?s.handOwners:s.hand.map(()=>pid);},
    take(pid,j){const s=game.states[pid];if(j<0||j>=s.hand.length)return null;const v={cardId:s.hand.splice(j,1)[0],ownerId:s.handOwners.splice(j,1)[0]||pid};s.activeHyper=s.activeHyper.filter(x=>x!==j).map(x=>x>j?x-1:x);return v;},
    giveBack(cid,pid){const s=game.states[pid];if(type(lookup[cid])==='HYPER'){s.hyperReserve.push(cid);}else{s.drawPile.push(cid);s.drawOwners.push(pid);}}
  };
  let linked,fx;
  const ctx={sim:()=>game,card:x=>lookup[x],type,random:n=>0,shuffle:a=>a,log:(...a)=>logs.push(a),toast:msg=>{throw Error(String(msg))},render:()=>{},pushUndo:()=>{},esc:String,
    manual:()=>manual,drawPoker:(pid,s)=>{const c=game.pokerDrawPile.shift();if(c)s.pokerHand.push(c);return c;},modal:()=>modal,setModal:x=>{modal=x},links:()=>linked,
    drawPower:(pid,n,ignore)=>{for(let i=0;i<n;i++)game.states[pid].hand.push('DRAW-POWER');return n;},discardPower:()=>0,afterSelection:()=>fx.afterSelection(),recalc:()=>{}};
  fx=window.POKER_BLITZ_ASSISTED_EFFECTS(ctx);linked=window.POKER_BLITZ_ASSISTED_LINKS(ctx);
  return {game,fx,linked,logs,manual,get modal(){return modal}};
}
const any=h=>h.game.states.p1,other=h=>h.game.states.p2;
function cast(h,n){h.fx.enqueue({cardId:id(n),playerId:'p1'});h.fx.finishChain();}
function target(h,n){cast(h,n);assert.equal(h.modal?.type,'assisted-target');h.fx.choose('p2');}
{
 const h=harness();for(const card of cards)assert(h.fx.supported(card.id),'Missing official effect '+card.name);
 assert(!h.fx.supported('catalog_v3_024'),'Removed card must not be supported');
 cast(h,'053');assert.equal(any(h).pokerHand.length,1);
 cast(h,'011');assert.equal(other(h).pokerHand.length,1);
}
{
 const h=harness();other(h).chips=10;target(h,'009');assert.equal(h.modal?.type,'assisted-choice');h.fx.chooseOption('chips');
 assert.equal(any(h).chips,1);assert.equal(other(h).chips,9,'Maestro must steal ONE chip');
}
{
 const h=harness();other(h).chips=6;any(h).pokerHand=[C('3','S','s1'),C('4','H','s2'),C('5','D','s3')];
 target(h,'055');assert.equal(any(h).chips,1);assert.equal(other(h).chips,5);
 assert.equal(any(h).pokerHand.length,1);assert.equal(other(h).pokerHand.length,2);
}
{
 const h=harness();other(h).pokerHand=Array.from({length:9},(_,i)=>C('9','S','ex'+i));
 target(h,'056');assert.equal(other(h).pokerHand.length,5);assert.equal(other(h).nextDrawBonus,1);
 assert.equal(other(h).hand.length,0,'Falso Limitador must not grant immediate Power Card');
}
{
 const h=harness();any(h).pokerHand=[C('A','S','a'),C('7','H','seven')];
 cast(h,'041');assert.equal(any(h).chips,2);assert.equal(any(h).pokerHand.length,0);
}
{
 const h=harness();any(h).pokerHand=Array.from({length:7},(_,i)=>C('8','H','g'+i));
 cast(h,'039');assert.equal(any(h).pokerHand.length,10);
 h.fx.phase('END','p1');assert.equal(any(h).pokerHand.length,5);
}
{
 const h=harness();other(h).pokerHand=[C('2','S','p')];cast(h,'037');
 assert.equal(other(h).pokerHand.length,3);h.fx.phase('END','p2');assert.equal(other(h).pokerHand.length,1);
}
{
 const h=harness(),s=any(h);s.hand=[id('035')];s.handOwners=['p1'];s.pokerHand=[C('2','S','a'),C('4','H','b'),C('8','D','c'),C('Q','C','d')];
 assert(h.linked.eligible('p1',0));h.linked.open(0);assert.equal(h.modal?.type,'linked-picker');h.linked.option('a');
 assert.equal(s.pokerHand.length,1,'Joker discards 3 and enchants a physical card');
 assert(!s.pokerHand.some(c=>c.virtualPower?.type==='JOKER'));
 assert.equal(s.assistedBindings[0].targets.length,1);
}
{
 const h=harness(),s=any(h);s.hand=[id('030'),id('053')];s.handOwners=['p1','p1'];
 s.pokerHand=[C('2','C','a'),C('3','H','b'),C('4','H','c'),C('5','H','d'),C('6','H','e')];
 assert(h.linked.eligible('p1',0));h.linked.open(0);h.linked.option('a');
 assert.equal(s.assistedBindings[0].targets.length,1,'Cambio de Color enchants exactly one Poker Card');
 assert.equal(h.linked.score('p1','Color',s.pokerHand,[]),5);
}
{
 const h=harness(),a=any(h),b=other(h);
 a.pokerHand=[C('3','H','spya')];b.pokerHand=[C('K','D','spyb')];
 a.hand=[id('053')];a.handOwners=['p1'];b.hand=[id('054')];b.handOwners=['p2'];
 target(h,'012');assert.equal(h.modal?.type,'assisted-choice');
 assert(h.fx.choiceOptions().some(x=>x.value==='power:0'),'Espía must see rival Power Cards');
 h.fx.chooseOption('poker:spyb');assert.equal(b.pokerHand.length,0);
 assert(h.fx.choiceOptions().some(x=>x.value==='poker:spya'),'Victim must choose a card in actor full hand');
 h.fx.chooseOption('poker:spya');assert.equal(a.pokerHand.length,0);
}
{
 const h=harness(),before=h.game.pokerDrawPile.length;
 cast(h,'016');assert.equal(h.modal?.type,'assisted-choice');
 assert.equal(h.fx.choiceOptions().length,3,'Ojo del Más Allá must inspect exactly three cards');
 h.fx.chooseOption('peek:2');assert.equal(any(h).pokerHand[0].id,'draw2');
 h.fx.chooseOption('peek:1');assert.equal(h.game.pokerDrawPile[0].id,'draw1');
 assert.equal(h.game.pokerDrawPile.length+any(h).pokerHand.length,before,'Peek must conserve Poker Cards');
}
{
 const h=harness();cast(h,'022');assert.equal(h.modal?.type,'assisted-choice');
 assert.equal(h.fx.choiceOptions().length,4,'Must let player declare one of four symbols');
 h.fx.chooseOption('suit:S');assert.equal(any(h).pokerHand.length,2,'Matching suit must reward an extra Poker Card');
}
{
 const h=harness(),s=any(h);s.hand=[id('043')];s.handOwners=['p1'];
 s.pokerHand=[C('A','D','earth')];h.linked.open(0);h.linked.option('earth');
 h.linked.onCharge('p1',[s.pokerHand[0]]);h.linked.phase('END','p1');
 assert.equal(s.chips,1,'Sincronía de la Tierra must grant one chip at End Phase');
}
{
 const h=harness(),s=any(h);s.hand=[id('044')];s.handOwners=['p1'];
 s.pokerHand=[C('7','S','ray')];h.linked.open(0);h.linked.option('ray');
 h.linked.onCharge('p1',[s.pokerHand[0]]);
 s.turnsTaken=1;h.linked.phase('DRAW_END','p1');
 assert(s.hand.includes('DRAW-POWER'),'Sincronía del Rayo grants extra Power Card next Draw Phase');
}
{
 const h=harness(),s=any(h),o=other(h);s.hand=[id('042')];s.handOwners=['p1'];
 s.pokerHand=[C('8','C','fire')];o.pokerHand=[C('K','H','target')];
 h.linked.open(0);h.linked.option('fire');h.linked.onCharge('p1',[s.pokerHand[0]]);
 s.turnsTaken=1;h.linked.phase('MAIN_START','p1');assert.equal(h.modal?.type,'linked-picker');
 h.linked.option('p2');assert(s.pokerHand.some(c=>c.id==='target'),'Fuego steals a Poker Card during next Main Phase');
}
async function simulations(){
  const eng=window.POKER_BLITZ_AUTOMATION({getCard:x=>lookup[x],cardType:type,version:'1.20.4'});
  let total=0,count=0,coverage=new Set();
  for(const n of [2,4])for(const diff of ['beginner','intermediate','expert'])for(const seed of [101,102,103,104,105]){
    const picked=Array.from({length:n},(_,i)=>({id:'D'+i,name:['Astra','Vórtice','Midas','Regulus'][i],difficulty:diff,
      cardIds:Array.from({length:36},(_,j)=>power[(j+i*11)%power.length].id),
      hyperCardIds:Array.from({length:3},(_,j)=>hyper[(i*3+j)%hyper.length].id)}));
    const out=await eng.play({players:picked,seed,pokerDeckCount:2,maxRounds:10,battleMode:'BLITZ'});
    assert.deepEqual(out.incidents,[],'Game integrity incident: '+JSON.stringify(out.incidents));
    assert(out.eventsCount>30,'Simulation event log unexpectedly empty');
    assert.equal(out.players.length,n);count++;total+=out.eventsCount;
    for(const k of Object.keys(out.effectCounts))coverage.add(k);
  }
  assert(coverage.size>=30,'Effect coverage too small: '+coverage.size);
  // Validación oficial estricta: un deck incompleto jamás recibe cartas sustitutas.
  const bad=defaultDecks.find(d=>d.cardIds.length<20+2*d.hyperCardIds.length);
  let rejected=false;
  try{await eng.play({players:[{...bad,difficulty:'expert'}],seed:9,pokerDeckCount:1,maxRounds:1,battleMode:'BLITZ'});}
  catch(err){rejected=/Power Deck no cumple el reglamento oficial/.test(String(err));}
  assert(rejected,'Simulator must refuse an incomplete official Power Deck');

  // Cartas y decisiones donde los lotes de 200 partidas mostraron errores.
  const focus=[
    {name:'Fortuna',hyper:['003','001'],base:['014','015','018','019','020','036','053','011','016','032']},
    {name:'Némesis',hyper:[],base:['052','006','033','034','004','010','011','053','031','039']},
    {name:'Midas',hyper:['049'],base:['041','009','055','053','011','026','039','016','032','034']}
  ].map((d,i)=>({id:'TARGET'+i,name:d.name,difficulty:'expert',
    cardIds:d.base.flatMap(c=>[id(c),id(c),id(c)]),hyperCardIds:d.hyper.map(id)}));
  const stats={dice:0,blocked:0,counters:0,bonuses:0,investors:0,shields:0};
  for(let seed=101;seed<=125;seed++){
    const out=await eng.play({players:focus,seed,pokerDeckCount:2,maxRounds:14,battleMode:'BLITZ'});
    assert.deepEqual(out.incidents,[],'Targeted official rules simulation incident');
    for(const p of out.players)for(const ev of p.events){
      const detail=ev.detail||'';
      if(detail.includes('Manipulador del Destino ajustó'))stats.dice++;
      if(ev.action==='HyperCard bloqueada')stats.blocked++;
      if(ev.action==='CounterCard')stats.counters++;
      if(detail.includes('Gran Inversor: +1 ficha'))stats.bonuses++;
      if(ev.action==='HyperCard activada'&&detail.includes('GRAN INVERSOR'))stats.investors++;
      if(detail.includes('Escudo Resplandeciente jugado como respuesta'))stats.shields++;
    }
  }
  assert(stats.dice>30,'Fortuna expert never leverages destiny die');
  assert(stats.blocked>0,'Agujero Negro must block actual HyperCards');
  assert(stats.counters>20,'Expert counter play not occurring');
  assert(stats.bonuses>0,'Gran Inversor must actually receive bonuses when profitable');
  assert(stats.shields>0,'Escudo Resplandeciente must react to real targeting');
  console.log('Expert AI targeted checks passed: '+JSON.stringify(stats));

  console.log('PASS updated rules: 50 cards, deck caps, directed effects, 30 seeded games, '+total+' events and '+coverage.size+' activated effects.');
}
simulations().catch(e=>{console.error(e);process.exitCode=1;});
