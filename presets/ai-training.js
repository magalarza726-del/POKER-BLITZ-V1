/* POKER BLITZ: fixed-deck AI training (solo / opponents / self play).
 * Learns bounded decision weights, never edits Power/Hyper Deck lists.
 * All game effects are resolved by the official simulation engine.
 */
window.POKER_BLITZ_TRAINING=(function(){
 'use strict';
 const LIMIT=200,ROUTES=['ace-chain','royal-chain','color-chain','straight-chain','poker-control'];
 const CHAIN=[
  ['046','040','047','016','045'],['062','023','063','057','061'],
  ['029','016','053','032','039'],['030','016','053','032','039'],
  ['003','014','015','018','020'],['049','041','045','009'],
  ['043','053','016'],['001','013','016'],['025','013','053']
 ];
 const code=id=>String(id||'').slice(-3);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const fingerprint=deck=>{
  const tally={};for(const id of deck.cardIds||[])tally[id]=(tally[id]||0)+1;
  return JSON.stringify({power:Object.entries(tally).sort((a,b)=>a[0].localeCompare(b[0])),hyper:[...(deck.hyperCardIds||[])].sort()});
 };
 const empty=()=>({version:1,cards:{},routes:{},links:{},threshold:0,horizon:0});
 const normalize=policy=>{
  const p=empty();if(!policy||typeof policy!=='object')return p;
  p.links={};
  for(const [key,val] of Object.entries(policy.links||{}))if(/^\d{3}>\d{3}$/.test(key)&&Number.isFinite(Number(val)))p.links[key]=clamp(Number(val),-4,4);
  for(const [key,x] of Object.entries(policy.cards||{}))if(/^\d{3}$/.test(key)&&Number.isFinite(Number(x)))p.cards[key]=clamp(Number(x),-6,6);
  for(const key of ROUTES)if(Number.isFinite(Number(policy.routes?.[key])))p.routes[key]=clamp(Number(policy.routes[key]),-4,4);
  p.threshold=clamp(Number(policy.threshold)||0,-1.5,1.5);
  p.horizon=clamp(Number(policy.horizon)||0,-.6,.6);
  return p;
 };
 function random(seed){let s=(Number(seed)>>>0)||0x9e3779b9;return ()=>{
  s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;
 }}
 const choose=(list,r)=>list[Math.floor(r()*list.length)];
 const shuffle=(arr,r)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 function mutate(parent,deck,r){
  const p=normalize(parent),codes=[...new Set((deck.cardIds||[]).map(code))];
  const k=Math.floor(r()*6),step=(r()<.5?-1:1)*(.5+r()*.9);
  if(k<2&&codes.length){const c=choose(codes,r);p.cards[c]=clamp((p.cards[c]||0)+step,-6,6);}
  else if(k===2){const c=choose(ROUTES,r);p.routes[c]=clamp((p.routes[c]||0)+step,-4,4);}
  else if(k===3)p.threshold=clamp(p.threshold+step*.25,-1.5,1.5);
  else if(k===4)p.horizon=clamp(p.horizon+step*.12,-.6,.6);
  else{
   const all=[...new Set([...(deck.cardIds||[]),...(deck.hyperCardIds||[])].map(code))];
   const chains=CHAIN.flatMap(seq=>seq.slice(1).map((n,i)=>[seq[i],n]))
    .filter(([a,b])=>all.includes(a)&&all.includes(b));
   if(chains.length){const [a,b]=choose(chains,r),key=a+'>'+b;
    p.links[key]=clamp((p.links[key]||0)+step,-4,4);}
  }
  // Occasionally coordinate two synergistic cards rather than only one.
  if(r()<.22&&codes.length){const next=choose(codes,r);p.cards[next]=clamp((p.cards[next]||0)+step*.45,-6,6);}
  return p;
 }
 function soloHand(deck,size,index,iteration,r){
  const pool=deck.cardIds||[];
  // Samples from the WHOLE fixed deck; no cards added and no copy-count violations.
  let hand=[];
  const pkg=CHAIN[(index+iteration)%CHAIN.length];
  const copy=[...pool];
  if(iteration%2===0){
   for(const id of pkg){const at=copy.findIndex(x=>code(x)===id);if(at!==-1&&hand.length<size){hand.push(copy.splice(at,1)[0]);}}
  }
  hand=[...hand,...shuffle(copy,r).slice(0,size-hand.length)];
  return shuffle(hand,r);
 }
 function opponentPool(deck,decks){
  return (decks||[]).filter(d=>d&&d.id!==deck.id&&Array.isArray(d.cardIds)&&d.cardIds.length>=20+2*(d.hyperCardIds||[]).length);
 }
 function evaluate(result,target){
  const standings=result.players||[],idx=standings.findIndex(x=>x.participantId===target);
  if(idx<0)throw Error('Entrenamiento: participante no encontrado en la simulación.');
  const me=standings[idx],rivals=standings.filter(x=>x.participantId!==target),n=standings.length;
  const top=(result.winnerIds||[]).includes(me.id);
  const avg=rivals.length?rivals.reduce((a,b)=>a+b.chips,0)/rivals.length:0;
  const chipDiff=(me.chips-avg)/Math.max(10,avg,me.chips);
  const placement=n>1?1-idx/(n-1):1;
  return {value:(n===1?me.chips/30+.02*result.eventsCount:top ? .72 : 0)+(n===1?0:placement*.20+chipDiff*.08),
   chips:me.chips,win:!!top,position:idx+1,margin:me.chips-avg,incidents:result.incidents?.length||0,
   eventCount:result.eventsCount||0,
   actions:(me.events||[]).filter(e=>e.action==='Usar Power Card'||e.action==='HyperCard activada').map(e=>e.detail),
   plans:(me.events||[]).filter(e=>e.action==='Plan IA').map(e=>e.detail)};
 }
 function average(rows){if(!rows.length)return {score:0,wins:0,margin:0,chips:0,incidents:0};
  return {score:rows.reduce((s,r)=>s+r.value,0)/rows.length,
   wins:rows.reduce((s,r)=>s+(r.win?1:0),0),margin:rows.reduce((s,r)=>s+r.margin,0)/rows.length,
   chips:rows.reduce((s,r)=>s+r.chips,0)/rows.length,incidents:rows.reduce((s,r)=>s+r.incidents,0)};
 }
 function seating(decks,target,policy,seed,opponentsPolicy=null){
  const n=decks.length+1,k=seed%n;
  const members=[{...target,participantId:'LEARNER',aiPolicy:policy},
   ...decks.map((d,j)=>({...d,participantId:'RIVAL-'+j,...(opponentsPolicy?{aiPolicy:opponentsPolicy}:d.aiPolicy?{aiPolicy:d.aiPolicy}:{})}))];
  return [...members.slice(k),...members.slice(0,k)];
 }
 const trial=async(engine,players,seed,options={})=>{
  const result=await engine.play({players,seed:seed>>>0,battleMode:'BLITZ',pokerDeckCount:players.length>7?2:1,
   maxRounds:options.maxRounds||40,summaryOnly:!!options.summaryOnly,
   trainingScenario:options.trainingScenario||null,cancel:options.cancel});
  if(result.cancelled||options.cancel?.cancelled)throw Object.assign(new Error('Entrenamiento cancelado.'),{cancelled:true});
  return result;
 };
 async function train({deck,decks=[],iterations=12,engine,seed=312347917,cancel,progress}={}){
  if(!deck||!Array.isArray(deck.cardIds)||!Array.isArray(deck.hyperCardIds))throw Error('Selecciona un deck completo.');
  if(typeof engine?.play!=='function')throw Error('No hay motor de simulación disponible.');
  const total=clamp(Math.trunc(Number(iterations)||12),1,LIMIT),sig=fingerprint(deck),
   pool=opponentPool(deck,decks),r=random(seed),policyStart=deck.aiTraining?.fingerprint===sig?normalize(deck.aiTraining.policy):empty();
  let current=policyStart,accepts=0,comparisons=0;
  const records={I:{trials:0,improvements:0,score:0,hands:{2:0,3:0,4:0,5:0,6:0,7:0}},
   II:{trials:0,improvements:0,score:0,wins:0},III:{trials:0,improvements:0,score:0,wins:0}};
  const failures=[],discovered=new Map();
  const report=(phase,step,message)=>progress?.({phase,step,total,percent:Math.round(100*((['I','II','III'].indexOf(phase)*total+step)/(total*3))),message,accepts,records});
  const interrupted=()=>{if(cancel?.cancelled)throw Object.assign(new Error('Entrenamiento cancelado.'),{cancelled:true});};
  const runSolo=async(pol,hand,seed,orderCodes=null)=>{
   const players=[{...deck,participantId:'LEARNER',aiPolicy:pol}];
   const x=await trial(engine,players,seed,{maxRounds:1,summaryOnly:false,
    trainingScenario:{handSize:hand.length,handIds:hand,orderCodes},cancel});
   return evaluate(x,'LEARNER');
  };
  const runAgainst=async(pol,others,seed,mirror=false)=>{
   const seats=seating(others,deck,pol,seed,mirror?current:null);
   const x=await trial(engine,seats,seed,{summaryOnly:true,maxRounds:25,cancel});
   const y=evaluate(x,'LEARNER');
   if(x.incidents?.length)failures.push(...x.incidents.slice(0,3));
   return y;
  };
  // Type I: all six distinct Power Hand sizes (2..7), one-turn no-opponent
  // sandbox. The HyperZone is the actual fixed deck's HyperZone.
  for(let i=0;i<total;i++){
   interrupted();const candidate=mutate(current,deck,r),base=[],newTrial=[];
   for(let handSize=2;handSize<=7;handSize++){
    const sample=soloHand(deck,handSize,handSize,i,r),simSeed=(seed+i*71197+handSize*17041)>>>0;
    const b=await runSolo(current,sample,simSeed);
    const present=new Set([...sample,...(deck.hyperCardIds||[])].map(code));
    const chain=CHAIN[(handSize+i)%CHAIN.length].filter(id=>present.has(id));
    const randomOrder=shuffle(sample.map(code),r);
    const scripted=await runSolo(current,sample,simSeed,chain.length>=2?chain:randomOrder);
    // Distill experimentally stronger sequences into persistent *relative*
    // action-order weights. Re-check without a forced script.
    if(scripted.value>b.value+0.0001){
     const sequence=chain.length>=2?chain:randomOrder;
     for(let j=1;j<sequence.length;j++){
      const key=sequence[j-1]+'>'+sequence[j];
      candidate.links[key]=clamp((candidate.links[key]||0)+.65,-4,4);
     }
    }
    const c=await runSolo(candidate,sample,simSeed);
    base.push(b);newTrial.push(c);records.I.hands[handSize]++;records.I.trials+=3;
    for(const a of scripted.actions){discovered.set(a,(discovered.get(a)||0)+1);}
    for(const a of c.actions){discovered.set(a,(discovered.get(a)||0)+1);}
   }
   const before=average(base),after=average(newTrial);comparisons++;
   if(after.score>before.score+0.00001&&after.incidents<=before.incidents){
    current=candidate;accepts++;records.I.improvements++;
   }
   records.I.score+=(after.score-before.score)/total;
   report('I',i+1,'Exploración de manos 2–7 · iteración '+(i+1)+'/'+total);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Type II: diversify opponents automatically from the deck library.
  // Each candidate is compared under identical deck opponents / seeds.
  if(pool.length){
   for(let i=0;i<total;i++){
    interrupted();const candidate=mutate(current,deck,r);
    const others=shuffle(pool,r).slice(0,Math.min(4,pool.length));
    // Repeats allowed only when the user's library has fewer than four rivals.
    while(others.length<4)others.push(pool[others.length%pool.length]);
    const simSeed=(seed+0x4910c173+i*2654435761)>>>0;
    const before=await runAgainst(current,others,simSeed,false),after=await runAgainst(candidate,others,simSeed,false);
    const reward=after.value-before.value;records.II.score+=reward/total;records.II.trials+=2;
    if(after.value>before.value+0.00001&&after.incidents<=before.incidents){
     current=candidate;accepts++;records.II.improvements++;
    }
    records.II.wins+=after.win?1:0;comparisons++;
    report('II',i+1,'Rivales reales · iteración '+(i+1)+'/'+total);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }else report('II',total,'Sin otros decks legales: fase contra rivales omitida.');
  // Type III: challenger vs four copies of its latest champion, same deck.
  for(let i=0;i<total;i++){
   interrupted();
   const candidate=mutate(current,deck,r),rivals=Array.from({length:4},()=>deck);
   const simSeed=(seed+0x9e3779b9+i*123457)>>>0;
   const before=await runAgainst(current,rivals,simSeed,true);
   const after=await runAgainst(candidate,rivals,simSeed,true);
   records.III.score+=(after.value-before.value)/total;records.III.trials+=2;records.III.wins+=after.win?1:0;
   if(after.value>before.value+0.00001&&after.incidents<=before.incidents){
    current=candidate;accepts++;records.III.improvements++;
   }
   comparisons++;
   report('III',i+1,'Autocompetencia · iteración '+(i+1)+'/'+total);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Independent holdout: unseen seeds, actual legal rivals or a one-deck
  // self-play baseline. Nine distinct opponents when available = 10-player
  // competitive testing rather than treating a 5-player rate as 10-player.
  const validated=[],control=[];
  const n=Math.min(80,Math.max(20,total*2)),vs=shuffle(pool,r);
  for(let i=0;i<n;i++){
   interrupted();
   const count=vs.length>=9?9:4,others=vs.length
    ?Array.from({length:count},(_,j)=>vs[(i*3+j)%vs.length])
    :Array.from({length:4},()=>deck);
   const common=(seed+0xbadc0de+i*74639)>>>0,mirror=!vs.length;
   validated.push(await runAgainst(current,others,common,mirror));
   control.push(await runAgainst(policyStart,others,common,mirror));
   if(i%3===0){report('III',total,'Validación independiente '+(i+1)+'/'+n);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const champion=average(validated),baseline=average(control);
  const recommend=accepts>0&&validated.length>0&&
    champion.score>baseline.score+0.00001&&champion.incidents<=baseline.incidents;
  const savedPolicy=recommend?current:policyStart;
  const interval=(()=>{
   const n=validated.length,w=champion.wins,z=1.96,den=1+z*z/n,p=w/n;
   const center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
   return [Math.max(0,center-half),Math.min(1,center+half)];
  })();
  const topActions=[...discovered].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([card,uses])=>({card,uses}));
  const finished={version:1,at:new Date().toISOString(),fingerprint:sig,iterations:total,
   policy:savedPolicy,seed:seed>>>0,accepted:recommend,
   training:{records,comparisons,accepts,topActions},
   validation:{games:validated.length,wins:champion.wins,winRate:validated.length?champion.wins/validated.length:null,
    baselineWins:baseline.wins,baselineWinRate:control.length?baseline.wins/control.length:null,
    participants:pool.length>=9?10:5,interval95:interval,
    meanChipMargin:champion.margin,baselineChipMargin:baseline.margin,incidents:champion.incidents,
    verifiedOnNewSeeds:true},
   warnings:[...new Set(failures)].slice(0,8)};
  progress?.({phase:'DONE',step:total,total,percent:100,message:recommend?'Política validada y lista para guardar.':'No se demostró mejora en semillas nuevas: se conserva la política anterior.',accepts,records});
  return finished;
 }
 return {fingerprint,normalize,train,limit:LIMIT};
})();
