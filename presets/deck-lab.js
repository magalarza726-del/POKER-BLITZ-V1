/* Poker Blitz Deck Lab: legal mutation/generation + paired seeded match evaluations. Offline, no external services. */
window.POKER_BLITZ_DECK_LAB = (function(){
'use strict';
const TYPES=['SUPER','COUNTER','HYPER'];
function code(id){return String(id||'').slice(-3)}
function counts(ids){const out={};for(const id of ids||[])out[id]=(out[id]||0)+1;return out}
function legal(deck,type){
 const power=deck.cardIds||[],hyper=deck.hyperCardIds||[],h=hyper.length,n=power.length,c=counts(power);
 return h<=3&&new Set(hyper).size===h&&n>=20+2*h&&n<=30+2*h&&Object.values(c).every(x=>x<=3)
 &&power.every(id=>TYPES.includes(type(id))&&type(id)!=='HYPER')
 &&hyper.every(id=>type(id)==='HYPER');
}
function similarity(a,b){
 const c=counts([...(a.cardIds||[]),...(a.hyperCardIds||[])]),d=counts([...(b.cardIds||[]),...(b.hyperCardIds||[])]);
 let intersection=0;for(const id of Object.keys(c))intersection+=Math.min(c[id],d[id]||0);
 return intersection/Math.max(1,(a.cardIds||[]).length+(a.hyperCardIds||[]).length,(b.cardIds||[]).length+(b.hyperCardIds||[]).length);
}
function rng(seed){
 let s=(Number(seed)||1)>>>0;return function(){s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296};
}
function select(list,random){return list[Math.floor(random()*list.length)]}
function traits(card){
 const text=((card?.name||'')+' '+(card?.description||'')).toLowerCase(),codeId=code(card?.id);
 const chip=/ficha|cobr|gan[aá]|maestro de fichas/.test(text);
 const strike=/rob[aá]le|rival|descart[aá]|intercambi|bloque|contrarrest|selecciona a un jugador/.test(text);
 const defense=/bloque|prote|escudo|contra|respuesta|evita|impide/.test(text);
 const combo=/as(es)?\b|poker|combinaci|escalera|color|j|q|k|comod|encanta/.test(text);
 const search=/rob[aá] |busca|mir[aá]|revela|elige|cambia|intercambia/.test(text);
 const dice=/dado|tirada|par|impar/.test(text);
 const complexity=(/hasta|siempre|mientras|al finalizar|siguiente|cada vez|por cada|opci[oó]n|si /.test(text)?1:0)+(text.length>190?1:0)+(dice?1:0);
 return {chip:+chip,strike:+strike,defense:+defense,combo:+combo,search:+search,dice:+dice,complexity,code:codeId};
}
function preference(card,style,aggression,ease){
 const t=traits(card);let score=1.4;
 const goals={
 equilibrado:{chip:1,strike:1,defense:1,combo:1,search:1,dice:0},
 agresivo:{chip:1,strike:3,defense:-1,combo:0,search:1,dice:0},
 defensivo:{chip:1,strike:-1,defense:4,combo:1,search:1,dice:0},
 combinaciones:{chip:1,strike:0,defense:0,combo:4,search:2,dice:0},
 economia:{chip:4,strike:1,defense:0,combo:1,search:0,dice:0},
 control:{chip:0,strike:3,defense:2,combo:0,search:2,dice:0},
 azar:{chip:0,strike:0,defense:0,combo:1,search:0,dice:5}
 };
 const weights=goals[style]||goals.equilibrado;
 for(const k of ['chip','strike','defense','combo','search','dice'])score+=weights[k]*t[k];
 score+=(aggression-3)*t.strike*0.85-(aggression-3)*t.defense*.48;
 const easePenalty=ease==='facil'?2.4:ease==='media'?1.1:0.15;
 score-=t.complexity*easePenalty;
 if(card?.type==='COUNTER'&&style==='defensivo')score+=1;
 return Math.max(.1,score);
}
function sampleWeighted(items,weight,random){
 const all=items.map(item=>({item,w:Math.max(.01,weight(item))})),sum=all.reduce((n,x)=>n+x.w,0);
 let target=random()*sum;for(const o of all){target-=o.w;if(target<=0)return o.item}return all.at(-1)?.item;
}
function prepareCatalog(cards,type){
 const valid=(cards||[]).filter(c=>c?.id&&TYPES.includes(type(c.id)));
 const list=valid.map(c=>({...c,type:type(c.id)}));
 return {power:list.filter(c=>c.type!=='HYPER'),hyper:list.filter(c=>c.type==='HYPER')};
}
function generate(catalog,options,random,type){
 const pool=prepareCatalog(catalog,type),ease=options.ease||'media',h=ease==='facil'?(random()<.4?0:1):ease==='media'?2:3;
 const hyper=[],power=[],style=options.style||'equilibrado',aggression=Number(options.aggression)||3;
 while(hyper.length<h){
  const options=pool.hyper.filter(c=>!hyper.includes(c.id));
  if(!options.length)break;
  hyper.push(sampleWeighted(options,c=>preference(c,style,aggression,ease),random).id);
 }
 const target=24+2*hyper.length+(random()<.5?0:2),used={};
 while(power.length<target){
  const valid=pool.power.filter(c=>(used[c.id]||0)<3);
  if(!valid.length)break;
  const pick=sampleWeighted(valid,c=>preference(c,style,aggression,ease),random);
  power.push(pick.id);used[pick.id]=(used[pick.id]||0)+1;
 }
 return {cardIds:power,hyperCardIds:hyper};
}
function mutate(parent,original,catalog,type,random){
 const pool=prepareCatalog(catalog,type),candidate={cardIds:[...parent.cardIds],hyperCardIds:[...parent.hyperCardIds]};
 const mutation=Math.floor(random()*5);
 if(mutation===0||mutation===1){
  const from=Math.floor(random()*candidate.cardIds.length),options=pool.power.filter(c=>candidate.cardIds.filter(x=>x===c.id).length<3&&c.id!==candidate.cardIds[from]);
  if(options.length)candidate.cardIds[from]=select(options,random).id;
 }else if(mutation===2){
  if(random()<.5&&candidate.cardIds.length>20+2*candidate.hyperCardIds.length){
   candidate.cardIds.splice(Math.floor(random()*candidate.cardIds.length),1);
  }else if(candidate.cardIds.length<30+2*candidate.hyperCardIds.length){
   const options=pool.power.filter(c=>candidate.cardIds.filter(x=>x===c.id).length<3);
   if(options.length)candidate.cardIds.push(select(options,random).id);
  }
 }else if(mutation===3){
  const pos=Math.floor(random()*Math.max(1,candidate.hyperCardIds.length)),options=pool.hyper.filter(c=>!candidate.hyperCardIds.includes(c.id));
  if(candidate.hyperCardIds.length&&options.length)candidate.hyperCardIds[pos]=select(options,random).id;
  else if(!candidate.hyperCardIds.length&&options.length){
   candidate.hyperCardIds.push(select(options,random).id);
   while(candidate.cardIds.length<20+2*candidate.hyperCardIds.length){
    const extras=pool.power.filter(c=>candidate.cardIds.filter(id=>id===c.id).length<3);if(!extras.length)break;candidate.cardIds.push(select(extras,random).id)
   }
  }
 }else{
  if(candidate.hyperCardIds.length<3&&random()<.5){
   const options=pool.hyper.filter(c=>!candidate.hyperCardIds.includes(c.id));
   if(options.length){candidate.hyperCardIds.push(select(options,random).id);
    while(candidate.cardIds.length<20+2*candidate.hyperCardIds.length){
     const extras=pool.power.filter(c=>candidate.cardIds.filter(id=>id===c.id).length<3);if(!extras.length)break;candidate.cardIds.push(select(extras,random).id)}
   }
  }else if(candidate.hyperCardIds.length){
   candidate.hyperCardIds.splice(Math.floor(random()*candidate.hyperCardIds.length),1);
   while(candidate.cardIds.length>30+2*candidate.hyperCardIds.length)candidate.cardIds.splice(Math.floor(random()*candidate.cardIds.length),1);
  }
 }
 if(!legal(candidate,type)||similarity(original,candidate)<.7)return null;
 if(candidate.cardIds.join()===parent.cardIds.join()&&candidate.hyperCardIds.join()===parent.hyperCardIds.join())return null;
 return candidate;
}
async function evaluate(deck,opponents,ctx){
 const engine=ctx.engine,playerCount=opponents.length+1,n=Math.max(2,Math.min(40,ctx.games||4));
 let wins=0,losses=0,ties=0,difference=0,incidents=0;
 for(let game=0;game<n;game++){
  if(ctx.cancel?.cancelled)break;
  const initial=[{...deck,id:'LAB-CANDIDATE',participantId:'LAB-CANDIDATE',name:deck.name||'Candidato',difficulty:'expert'},...opponents.map((d,i)=>({...d,participantId:'RIVAL-'+i,difficulty:'expert'}))];
  const rotation=game%initial.length,seated=initial.map((_,i)=>initial[(i+rotation)%initial.length]);
  const seed=((ctx.seed||1)+Math.imul(game,0x9e3779b9))>>>0;
  const result=await engine.play({players:seated,seed,battleMode:ctx.battleMode||'BLITZ',pokerDeckCount:playerCount>=8?2:(ctx.pokerDeckCount||1),maxRounds:ctx.maxRounds||40,summaryOnly:true,cancel:ctx.cancel});
  const me=result.players.find(p=>p.participantId==='LAB-CANDIDATE'),other=result.players.filter(p=>p.participantId!=='LAB-CANDIDATE');
  const top=Math.max(...other.map(p=>p.chips));difference+=me.chips-top;
  if(result.winnerIds.includes(me.id)){if(result.winnerIds.length===1)wins++;else ties++}else losses++;
  incidents+=result.incidents.length;
  ctx.onMatch?.(game+1,n,{wins,losses,ties});
 }
 const played=wins+losses+ties;
 return {played,wins,losses,ties,winRate:played?wins/played:0,lossRate:played?losses/played:0,
  chipMargin:played?difference/played:0,incidents,
  score:played?(2*wins-losses+0.35*ties)/played+Math.max(-1,Math.min(1,difference/played/35))*.2:-Infinity};
}
async function improve(base,opponents,catalog,type,options,ctx){
 if(!legal(base,type))throw Error('El deck original debe ser legal antes de mejorar; no se rellenarán cartas eliminadas.');
 const random=rng(options.seed||1),iterations=Math.max(1,Math.min(80,options.iterations||12)),trials=[];
 const engine=ctx.engine,batch={...ctx,engine,seed:options.seed||1,games:options.games||4};
 const baseline=await evaluate(base,opponents,batch);let best={cardIds:[...base.cardIds],hyperCardIds:[...base.hyperCardIds]},bestMetrics=baseline;
 ctx.onProgress?.({iteration:0,total:iterations,baseline,best:baseline,similarity:1});
 for(let i=0;i<iterations;i++){
  if(ctx.cancel?.cancelled)break;
  let next=null;
  for(let attempt=0;attempt<45&&!next;attempt++)next=mutate(best,base,catalog,type,random);
  if(!next)continue;
  const metrics=await evaluate({...base,...next},opponents,batch),ratio=similarity(base,next);
  const accepted=metrics.score>bestMetrics.score+1e-8&&metrics.incidents===0;
  trials.push({version:i+1,cardIds:[...next.cardIds],hyperCardIds:[...next.hyperCardIds],similarity:ratio,metrics,accepted,seed:batch.seed,opponents:opponents.map(d=>d.id)});
  if(accepted){best=next;bestMetrics=metrics;}
  ctx.onProgress?.({iteration:i+1,total:iterations,latest:metrics,best:bestMetrics,similarity:ratio,accepted});
  await Promise.resolve();
 }
 return {baseMetrics:baseline,bestMetrics,best,similarity:similarity(base,best),trials,completed:trials.length};
}
async function create(catalog,opponents,type,options,ctx){
 const random=rng(options.seed||1),rounds=Math.max(1,Math.min(80,options.iterations||12)),batch={...ctx,seed:options.seed||1,games:options.games||4};
 let best=null,metrics=null,history=[];
 for(let i=0;i<rounds;i++){
  if(ctx.cancel?.cancelled)break;
  const candidate=generate(catalog,options,random,type);
  if(!legal(candidate,type))throw Error('No se pudo producir un deck válido con el catálogo disponible.');
  const trial=await evaluate({...candidate,name:'Deck generado'},opponents,batch);
  const preferenceScore=candidate.cardIds.reduce((n,id)=>n+preference(catalog.find(c=>c.id===id),options.style,Number(options.aggression),options.ease),0)/candidate.cardIds.length;
  const objective=trial.score+Math.min(2,preferenceScore/12);
  const accepted=!metrics||objective>metrics.objective;
  history.push({version:i+1,cardIds:[...candidate.cardIds],hyperCardIds:[...candidate.hyperCardIds],metrics:trial,objective,accepted,style:options.style,aggression:options.aggression,ease:options.ease});
  if(accepted){best=candidate;metrics={...trial,objective,preferenceScore};}
  ctx.onProgress?.({iteration:i+1,total:rounds,latest:trial,best:metrics});
  await Promise.resolve();
 }
 return {best,metrics,history};
}
return {legal,similarity,traits,preference,generate,mutate,evaluate,improve,create};
})();
