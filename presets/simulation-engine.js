/* Offline autonomous Poker Blitz game engine: seeded card/effect simulation, adaptive player AI and audit trail. */
window.POKER_BLITZ_AUTOMATION=function buildPokerBlitzAuto(context){
 const getCard=context.getCard,cardType=context.cardType;
 const code=id=>String(id||'').slice(-3);
 function randomFactory(seed){
  let s=(Number(seed)>>>0)||123456789;
  const next=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296};
  return {next,int:n=>n>1?Math.floor(next()*n):0,shuffle:a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}};
 }
 function sourceDeck(copies,rng){
  const list=[],suits=[['S','♠','black'],['H','♥','red'],['D','♦','red'],['C','♣','black']];
  for(let c=1;c<=copies;c++)for(let [suit,symbol,color] of suits)for(let rank of ['A','2','3','4','5','6','7','8','9','10','J','Q','K'])
   list.push({id:'AUTO-'+c+'-'+suit+'-'+rank,rank,suit,symbol,color,copy:c});
  return rng.shuffle(list);
 }
 const styleKeys={chips:['009','031','048','055','049','044'],poker:['007','010','011','013','016','021','026','032','053','054','056'],
  artifacts:['005','042','043','044','058','059','060'],aces:['040','045','046','047'],faces:['057','061','062','063'],
  hyper:['001','002','025','027','028','029','030','035','046','049','050','062'],
  dice:['003','014','015','018','019','020','036'],counter:['004','006','033','034','052','064']};
 const difficulty={beginner:'Principiante',intermediate:'Intermedio',expert:'Experto'};
 const types=['Par','Trío','Póker','Escalera','Color'];
 async function play(config,onProgress){
  if(!Array.isArray(config?.players)||config.players.length<1||config.players.length>6)throw Error('La simulación requiere entre 1 y 6 jugadores.');
  if(![1,2].includes(Number(config.pokerDeckCount||1)))throw Error('Selecciona una o dos barajas de Poker.');
  if(config.players.some(p=>!Array.isArray(p.cardIds)||!p.cardIds.length))throw Error('Cada jugador debe tener un Power Deck no vacío.');
  const rng=randomFactory(config.seed),players=config.players.map((p,i)=>({...p,id:'AUTO-'+(i+1),participantId:p.participantId||'P'+(i+1),seat:i+1,sourceDeckId:p.id,playerNumber:i+1,
   difficulty:p.difficulty||'intermediate',style:Object.entries(styleKeys).sort((a,b)=>{
    const n=lst=>p.cardIds.filter(x=>lst.includes(code(x))).length;return n(b[1])-n(a[1]);
   })[0][0]}));
  const rush=config.battleMode==='RUSH',initialPoker=7,initialPower=3,target=rush?15:30;
  const rngShuffle=a=>rng.shuffle(a),random=n=>rng.int(n);
  const game={mode:'ASSISTED',autoMode:true,decks:players,states:{},histories:{},pokerDrawPile:sourceDeck(config.pokerDeckCount||1,rng),round:1,
   turnIndex:0,activeIndex:0,goal:target,assistedPending:[],linkedEvents:[],finished:false};
  const startedAt=Date.now(),incidents=[],counts={};
  const issue=x=>{if(incidents.length<40)incidents.push(String(x))};
  function log(pid,action,detail='',card=null){
   if(!game.histories[pid])game.histories[pid]=[];
   const st=game.states[pid];game.histories[pid].push({at:Date.now(),round:game.round,action,detail,cardName:card?.name||'',cardDescription:card?.description||'',state:st?{chips:st.chips,poker:st.pokerHand.length,power:st.hand.length-st.activeHyper.length,hyper:st.activeHyper.length}:null});
   if(['Efecto asistido','Efecto vinculado','Entendí la referencia'].includes(action)){const id=card?.id;if(id)counts[id]=(counts[id]||0)+1;}
  }
  for(const p of players){
   const list=rng.shuffle(p.cardIds),hand=list.splice(0,Math.min(initialPower,list.length)),
    pokerHand=game.pokerDrawPile.splice(0,Math.min(initialPoker,game.pokerDrawPile.length));
   game.states[p.id]={initialCards:p.cardIds.length,hand,handOwners:hand.map(()=>p.id),drawPile:list,drawOwners:list.map(()=>p.id),
    pokerHand,activeHyper:[],hyperReserve:rush?[]:[...new Set((p.hyperCardIds||[]).filter(id=>cardType(getCard(id))==='HYPER'))].slice(0,3),hyperActivationsThisTurn:0,hyperActivationLimit:1,chips:0,chargeReplacement:0,turnsTaken:0,currentPhase:'MAIN',powerHandLimit:3,pokerLimit:7,dieBase:null,dieModifier:0};
   log(p.id,'Reparto inicial',`${initialPower} Power Cards, ${pokerHand.length} Poker Cards. IA ${difficulty[p.difficulty]||difficulty.intermediate}.`);
  }
  const get=pid=>game.states[pid],my=()=>game.decks[game.turnIndex];
  const drawPoker=(pid,st=get(pid),reason='Robar Poker Card')=>{
   if(!game.pokerDrawPile.length){issue('Mazo Poker agotado.');return null}
   const card=game.pokerDrawPile.splice(random(game.pokerDrawPile.length),1)[0];st.pokerHand.push(card);
   log(pid,reason,card.rank+' de '+card.suit);return card;
  };
  let fx,links,modal=null;
  const manual={
   own(pid){const s=get(pid);if(s.handOwners.length!==s.hand.length)s.handOwners=s.hand.map(()=>pid);if(s.drawOwners.length!==s.drawPile.length)s.drawOwners=s.drawPile.map(()=>pid)},
   take(pid,i){
    const s=get(pid);if(!Number.isInteger(i)||i<0||i>=s.hand.length)return null;
    links?.onPowerTake(pid,i);
    const item={cardId:s.hand.splice(i,1)[0],ownerId:s.handOwners.splice(i,1)[0]||pid,playerId:pid};
    s.activeHyper=s.activeHyper.filter(x=>x!==i).map(x=>x>i?x-1:x);fx?.recalc(pid);return item;
   },
   giveBack(cid,pid){
    const p=game.states[pid]?pid:players[0].id,s=get(p);
    if(cardType(getCard(cid))==='HYPER'&&Array.isArray(s.hyperReserve)){if(!s.hyperReserve.includes(cid))s.hyperReserve.push(cid);return;}
     const pair=s.drawPile.map((id,i)=>({id,own:s.drawOwners[i]}));pair.push({id:cid,own:p});
    const a=rng.shuffle(pair);s.drawPile=a.map(x=>x.id);s.drawOwners=a.map(x=>x.own);
   }
  };
  function drawPower(pid,n=1,ignore=false){
   const s=get(pid);let done=0;
   for(let i=0;i<n&&s.drawPile.length;i++){
    if(!ignore&&s.hand.length-s.activeHyper.length>=s.powerHandLimit)break;
    const j=random(s.drawPile.length),id=s.drawPile.splice(j,1)[0],own=s.drawOwners.splice(j,1)[0]||pid;
    s.hand.push(id);s.handOwners.push(own);done++;
    log(pid,'Robar Power Card',getCard(id)?.name||id,getCard(id));
   }
   return done;
  }
  function discardPower(pid,n=1){
   const s=get(pid);let done=0;
   for(let i=0;i<n;i++){
    const slots=s.hand.map((_,j)=>j).filter(j=>!s.activeHyper.includes(j));
    if(!slots.length)break;const item=manual.take(pid,slots[random(slots.length)]);
    if(item){manual.giveBack(item.cardId,item.ownerId);done++;log(pid,'Descartar Power Card',getCard(item.cardId)?.name||item.cardId)}
   }
   return done;
  }
  const effectCtx={sim:()=>game,card:getCard,type:cardType,random,shuffle:rngShuffle,log,toast:issue,render:()=>{},
    drawPoker,manual:()=>manual,pushUndo:()=>{},setModal:m=>{modal=m},modal:()=>modal,esc:s=>String(s||'').replace(/[<>&"]/g,''),
    links:()=>links,cardScore:(pid,id)=>scoreCard(pid,id),pokerCardValue,planFor,choosePowerPayment:(pid,id)=>scoreCard(pid,id),choosePokerPayment:(pid,c)=>pokerCardValue(pid,c),chooseCopiedSuper:(pid,ids)=>[...ids].sort((a,b)=>scoreCard(pid,b)-scoreCard(pid,a))[0]};
  fx=window.POKER_BLITZ_ASSISTED_EFFECTS(effectCtx);
  links=window.POKER_BLITZ_ASSISTED_LINKS({...effectCtx,recalc:pid=>fx.recalc(pid),drawPower,discardPower,afterSelection:()=>fx.afterSelection()});

  // Persistent, reproducible, per-deck objectives. This is an in-engine planning
  // policy, not online training and not hidden information about opponents.
  function role(p){
   const name=String(p.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   if(/astra|bruja|reliquia/.test(name))return 'relics';
   if(/vortice|torbellino/.test(name))return 'swaps';
   if(/aceron|maldito.*as/.test(name))return 'aces';
   if(/regulus|caballero real/.test(name))return 'faces';
   return p.style==='hyper'?'relics':p.style==='aces'?'aces':p.style==='faces'?'faces':p.style==='poker'?'swaps':p.style;
  }
  function ranksOf(cards){
   const counts={},suits={S:0,H:0,D:0,C:0};
   for(const c of cards){counts[c.rank]=(counts[c.rank]||0)+1;if(c.suit in suits)suits[c.suit]++;}
   return {counts,suits};
  }
  function planFor(p){
   const s=get(p.id),roleName=role(p),r=ranksOf(s.pokerHand);
   const aces=r.counts.A||0,faces=(r.counts.J||0)+(r.counts.Q||0)+(r.counts.K||0);
   const available=id=>s.hand.some((c,i)=>code(c)===id&&!s.activeHyper.includes(i))||s.hyperReserve?.some(c=>code(c)===id);
   let goal='balanced';
   if(roleName==='relics')goal=!s.activeHyper.some(i=>code(s.hand[i])==='030')&&available('030')?'install-color':'link-and-convert';
   if(roleName==='swaps')goal='prepare-targeted-swap';
   if(roleName==='aces')goal=aces>=2&&available('045')?'cash-aces':aces===0?'find-aces':'hold-and-build-aces';
   if(roleName==='faces')goal=faces>=2&&available('061')?'cash-royals':faces<2?'find-royals':'hold-and-build-royals';
   if(roleName==='artifacts')goal='assemble-artifacts';
   if(roleName==='chips')goal='economic-pressure';
   const ranked=Object.entries(r.suits).sort((a,b)=>b[1]-a[1]),suitCount=ranked[0]?.[1]||0;
   const active=id=>s.activeHyper.some(i=>code(s.hand[i])===id);
   return {role:roleName,goal,aces,faces,hyperCount:s.activeHyper.length,suit:r.suits,suitCount,
    hasColor:active('030'),wantsColor:roleName==='relics'&&!active('030')&&available('030'),pokerSize:s.pokerHand.length};
  }
  function handPotential(pid,hand,plan=planFor(players.find(p=>p.id===pid))){
   const r=ranksOf(hand),n=hand.length,counts=Object.values(r.counts),suits=Object.values(r.suits).sort((a,b)=>b-a);
   let value=n*.19;
   for(const count of counts){if(count>=2)value+=1.6;if(count>=3)value+=2.2;if(count>=4)value+=3;}
   value+=Math.max(0,(suits[0]||0)-2)*1.05+Math.max(0,(suits[1]||0)-2)*.25;
   const unique=new Set(hand.flatMap(c=>c.rank==='A'?[1,14]:[Number(({J:11,Q:12,K:13})[c.rank]||c.rank)]));
   let windowMax=0;
   for(let low=1;low<=10;low++){let hits=0;for(let k=0;k<5;k++)if(unique.has(low+k))hits++;windowMax=Math.max(windowMax,hits);}
   value+=Math.max(0,windowMax-2)*.9;
   if(plan.role==='aces')value+=(r.counts.A||0)*(plan.goal==='cash-aces'?2.7:2.05);
   if(plan.role==='faces')value+=((r.counts.J||0)+(r.counts.Q||0)+(r.counts.K||0))*(plan.goal==='cash-royals'?2.5:1.95);
   if(plan.role==='relics'){const major=suits[0]||0;value+=major*.65+(major>=4?3:major>=3?1.5:0);
    if(plan.wantsColor||plan.hasColor)value+=Math.max(0,major-2)*1.15;}
   return value;
  }
  function pokerCardValue(pid,c,hand=get(pid).pokerHand){
   const plan=planFor(players.find(p=>p.id===pid)),before=handPotential(pid,hand,plan);
   const i=hand.findIndex(x=>x.id===c.id);
   if(i<0)return 0;
   return before-handPotential(pid,hand.filter((_,j)=>j!==i),plan);
  }
  function chooseDiscardPoker(pid){
   const s=get(pid),plan=planFor(players.find(p=>p.id===pid));
   const pool=s.pokerHand.map((c,i)=>({i,c})).filter(x=>!links.protectedCard?.(pid,x.c));
   if(!pool.length)return -1;
   pool.sort((a,b)=>(handPotential(pid,s.pokerHand.filter((_,i)=>i!==a.i),plan))-(handPotential(pid,s.pokerHand.filter((_,i)=>i!==b.i),plan)));
   return pool[pool.length-1].i;
  }
  function pairGain(pid,enemy,ownId,rivalId,ownHand=get(pid).pokerHand,rivalHand=get(enemy).pokerHand){
   const a=ownHand.findIndex(c=>c.id===ownId),b=rivalHand.findIndex(c=>c.id===rivalId);
   if(a<0||b<0)return -100;
   const plan=planFor(players.find(p=>p.id===pid)),rivalPlan=planFor(players.find(p=>p.id===enemy));
   const exchangedOwn=[...ownHand],exchangedRival=[...rivalHand];
   [exchangedOwn[a],exchangedRival[b]]=[exchangedRival[b],exchangedOwn[a]];
   return handPotential(pid,exchangedOwn,plan)-handPotential(pid,ownHand,plan)+
     .42*(handPotential(enemy,rivalHand,rivalPlan)-handPotential(enemy,exchangedRival,rivalPlan));
  }
  let plannedSwap=null;
  function chooseSwapOption(p,options){
   const state=fx.choiceState?.();if(!state||state.kind!=='forced-swap')return null;
   const actor=state.pid,enemy=state.enemy;
   if(state.phase==='rival'){
    const planned=options.find(o=>o.value==='rival:'+plannedSwap?.rivalId);
    if(planned){plannedSwap=null;return planned;}
    plannedSwap=null;
    return [...options].sort((a,b)=>pairGain(actor,enemy,state.ownId,b.value.slice(6))-pairGain(actor,enemy,state.ownId,a.value.slice(6)))[0];
   }
   const original=get(actor).pokerHand,opponent=get(enemy).pokerHand,usedOwn=new Set(state.usedOwn),usedEnemy=new Set(state.usedEnemy);
   const own=original.filter(c=>!usedOwn.has(c.id)&&!links.protectedCard?.(actor,c));
   const rival=opponent.filter(c=>!usedEnemy.has(c.id)&&!links.protectedCard?.(enemy,c));
   if(!own.length||!rival.length)return options.find(o=>o.value==='finish')||options[0];
   const scored=[];
   for(const a of own)for(const b of rival){
    const gain=pairGain(actor,enemy,a.id,b.id);
    let ahead=0;
    if(p.difficulty==='expert'&&state.done===0&&own.length>1&&rival.length>1){
     const ownAfter=original.map(c=>c.id===a.id?b:c),rivalAfter=opponent.map(c=>c.id===b.id?a:c);
     for(const c of ownAfter)for(const d of rivalAfter){
      if([a.id,b.id].includes(c.id)||[a.id,b.id].includes(d.id))continue;
      ahead=Math.max(ahead,pairGain(actor,enemy,c.id,d.id,ownAfter,rivalAfter)*.72);
     }
    }
    scored.push({ownId:a.id,rivalId:b.id,value:gain+ahead});
   }
   scored.sort((a,b)=>b.value-a.value);
   const best=p.difficulty==='beginner'?scored[random(Math.min(4,scored.length))]:scored[0];
   if(state.done>0&&best.value<(p.difficulty==='expert'?.15:-.7))return options.find(o=>o.value==='finish')||options[0];
   plannedSwap=best;return options.find(o=>o.value==='own:'+best.ownId)||options[0];
  }
  function chooseLinkedOption(p,opts){
   const linked=links.choiceState?.(),selected=new Set(linked?.selected||[]),candidates=opts.filter(id=>!selected.has(id));
   if(!candidates.length)return null;
   if(p.difficulty==='beginner')return candidates[random(candidates.length)];
   const pid=p.id,s=get(pid),cards=s.pokerHand,ranks=ranksOf(cards),plan=planFor(p);
   if(linked?.kind==='sabueso')return [...candidates].sort((a,b)=>(ranks.suits[b]||0)-(ranks.suits[a]||0))[0];
   const pick=candidates.map(id=>{
    const c=cards.find(c=>c.id===id);if(!c)return {id,score:0};
    const score=pokerCardValue(pid,c)+
      (plan.role==='relics'?(Object.entries(ranks.suits).sort((a,b)=>b[1]-a[1])[0]?.[0]!==c.suit?3.4:-1.5):0)+
      (plan.role==='aces'&&c.rank==='A'?1.2:0)+(plan.role==='faces'&&['J','Q','K'].includes(c.rank)?1.1:0);
    return {id,score};
   }).sort((a,b)=>b.score-a.score);
   return (p.difficulty==='expert'?pick[0]:pick[Math.min(pick.length-1,random(2))]).id;
  }
  function autoModal(){
   for(let i=0;modal&&i<28;i++){
    if(modal.type==='assisted-target'){
     const ids=[...fx.modalMarkup().matchAll(/data-action="assist-target" data-player="([^"]+)"/g)].map(x=>x[1]);
     if(!ids.length){issue('Sin rivales válidos en selección asistida.');modal=null;break}
     const p=my(),objective=planFor(p),score=id=>{
      const st=get(id),eligible=st.pokerHand.filter(c=>!links.protectedCard?.(id,c)).length;
      if(objective.role==='swaps')return st.chips*2.1+eligible*.65+st.pokerHand.length*.75;
      if(objective.role==='chips')return st.chips*2.2+st.pokerHand.length*.15;
      if(objective.role==='aces'||objective.role==='faces')return st.pokerHand.length*1.7+st.chips*.22;
      return st.chips*1.5+st.pokerHand.length*.4;
     };
     const selection=p.difficulty==='beginner'?ids[random(ids.length)]:ids.sort((a,b)=>score(b)-score(a))[0];
     fx.choose(selection);
    }else if(modal.type==='assisted-choice'){
     const options=fx.choiceOptions().filter(o=>!o.disabled);
     if(!options.length){fx.cancelChoice();if(modal)issue('Decisión asistida no finalizada tras cancelación segura.');break}
     const p=my(),chosen=chooseSwapOption(p,options)||(p.difficulty==='beginner'?options[random(options.length)]:[...options].sort((a,b)=>Number(b.score||0)-Number(a.score||0))[0]);
     fx.chooseOption(chosen.value);
    }else if(modal.type==='linked-picker'){
     const opts=[...links.modalMarkup().matchAll(/data-action="linked-option" data-id="([^"]+)"/g)].map(x=>x[1]);
     if(!opts.length){issue('Vínculo sin opciones elegibles.');modal=null;break}
     const isPlayer=opts.every(x=>game.states[x]);
     if(isPlayer)opts.sort((a,b)=>get(b).chips-get(a).chips);
     const selected=links.choiceState?.(),actor=players.find(p=>p.id===selected?.pid)||my();
     const chosen=isPlayer?(actor.difficulty!=='beginner'?opts[0]:opts[random(opts.length)]):chooseLinkedOption(actor,opts);
     if(!chosen){issue('No hay nuevos objetivos seleccionables para HyperCard vinculada.');modal=null;break}
     links.option(chosen);
    }else{issue('Ventana no reconocida: '+modal.type);modal=null}
   }
   if(modal){issue('Límite de decisiones automáticas de efecto alcanzado.');modal=null}
  }
  function scoreCard(pid,id){
   const p=players.find(x=>x.id===pid),s=get(pid),c=code(id),plan=planFor(p),hand=s.pokerHand;
   const active=c=>s.activeHyper.some(i=>code(s.hand[i])===c);
   let val=({'053':3.5,'011':3.2,'009':3.1,'029':3.4,'030':3.6,'035':3.2,'005':4.2,'042':3.1,'043':3.2,'044':3.5,'049':3.6,'040':3.2,'045':1.6,'061':1.6,'033':4,'007':3.1,'013':2.8,'063':2.8,'032':3.3,'016':3.5,'031':2.7})[c]||2;
   if(styleKeys[p.style].includes(c))val+=.35;
   if(s.pokerHand.length>=s.pokerLimit&&['011','016','031','032','053','063','039','018'].includes(c))val-=1;
   if(s.pokerHand.length<=3&&['011','016','032','053','063','039'].includes(c))val+=.8;
   if(c==='049'&&game.round<9)val+=1.1;
   if(c==='009'){const rivals=players.filter(x=>x.id!==pid),chips=Math.max(0,...rivals.map(x=>get(x.id).chips));val+=chips>=10?2.6:chips>=5?1.1:-3;}
   if(c==='013'||c==='010'||c==='038'){
    const candidates=players.filter(x=>x.id!==pid);
    let best=-100;
    for(const rival of candidates){
     const their=get(rival.id).pokerHand;
     for(const ours of hand.filter(c=>!links.protectedCard?.(pid,c)))for(const theirs of their.filter(c=>!links.protectedCard?.(rival.id,c)))
      best=Math.max(best,pairGain(pid,rival.id,ours.id,theirs.id));
    }
    val+=best>0?Math.min(3,best*.85):best===-100?-4:-2;
   }
   if(c==='020'||c==='021')val+=plan.role==='swaps'&&handPotential(pid,hand,plan)<9?1.2:-2;
   if(c==='030')val+=plan.role==='relics'&&!active('030')?(plan.suitCount>=3?6.5:plan.pokerSize>=5?3.8:1):active('030')?-6:.7;
   if(c==='029')val+=plan.role==='relics'?2:1;
   if(c==='035')val+=plan.role==='relics'&&hand.length>=4?1.3:0;
   if(c==='007'){
    const search=(s.hyperReserve||[]).map(code);
    const favored=plan.role==='relics'?['030','029','035','027']:plan.role==='aces'?['046']:plan.role==='faces'?['062']:['030','046','062'];
    val+=search.some(x=>favored.includes(x))?3.9:search.length?1:-5;
    if(s.pokerHand.length<=4)val-=1.2;
    if(plan.role==='relics'&&search.includes('030')&&!active('030'))val+=4.1;
    if(plan.role==='aces'&&plan.aces>=2||plan.role==='faces'&&plan.faces>=3)val-=2.3;
   }
   if(plan.role==='relics'){
    if(['053','011','016','032','039','031'].includes(c))val+=hand.length<6?2.4:.3;
    if(c==='030'&&hand.length<5)val-=4;
    if(c==='007'&&hand.length<5)val-=4;
    if(c==='035'&&hand.length<6)val-=3.2;
    if(c==='029'&&hand.length<4)val-=2;
    if(c==='030'&&plan.suitCount>=4)val+=3.4;
   }
   if(plan.role==='aces'){
    if(['053','011','016','032','039','026','031','047'].includes(c))val+=plan.aces===0?2.1:1.2;
    if(c==='046')val+=plan.aces||s.hand.some(x=>code(x)==='040')?3.7:-.7;
    if(c==='040')val+=plan.aces<2?3.2:plan.aces>=4?-4:1;
    if(c==='045')val+=plan.aces>=3?plan.aces*3.1:plan.aces===2?4.6:plan.aces===1&&active('046')?1:-9;
    if(c==='041')val+=hand.length>=4?1.4:0;
   }
   if(plan.role==='faces'){
    if(['053','011','016','032','039','026','063','031'].includes(c))val+=plan.faces<3?2.3:1;
    if(c==='062')val+=plan.faces>=3?4.5:plan.faces===2&&s.drawPile.length>5?2.2:plan.faces===1?-.8:-4.5;
    if(c==='061')val+=plan.faces>=4?plan.faces*2.8:plan.faces===3?7:plan.faces===2&&active('062')?3.5:-9;
    if(c==='023')val+=plan.faces>=1?2:3;
    if(c==='057'&&active('062'))val+=2;
    if(c==='063'&&active('062'))val+=1.5;
   }
   if(plan.role==='artifacts'&&['042','043','044','058','059','060','005'].includes(c))val+=2;
   if(plan.role==='swaps'&&['013','010','038','012','026','016'].includes(c))val+=2;
   if(plan.role==='swaps'&&c==='013'&&hand.length>=3)val+=1.8;
   if(plan.role==='swaps'&&c==='013'&&handPotential(pid,hand,plan)>20)val-=.7;
   if(c==='053'&&plan.role==='aces'&&plan.aces<=1)val+=1.25;
   if(c==='053'&&plan.role==='faces'&&plan.faces<=2)val+=1.25;
   if(c==='016'&&['aces','faces','relics'].includes(plan.role))val+=1.15;
   // Keep scarce combo enablers and avoid clearing the entire Power Hand.
   if(s.hand.length-s.activeHyper.length<=2&&['007','029','030','045','061','013'].includes(c))val+=.4;
   return val;
  }
  function legalHyper(pid,i){
   const s=get(pid),id=s.hand[i],c=code(id);
   if(!id||s.activeHyper.includes(i)||s.activeHyper.length>=3)return false;
   if(links.supported.has(c))return links.eligible(pid,i);
   const copies=s.activeHyper.filter(j=>s.hand[j]===id).length;
   if(copies>=1)return false;
   const required=({'003':[0,1],'049':[0,1]})[c]||[0,0];
   return s.pokerHand.length>=required[1]&&s.hand.filter((_,j)=>j!==i&&!s.activeHyper.includes(j)).length>=required[0];
  }
  function selectAction(p){
   const s=get(p.id),available=[];
   for(let i=0;i<s.hand.length;i++){
    if(s.activeHyper.includes(i))continue;
    const id=s.hand[i],kind=cardType(getCard(id)),c=code(id),plan=planFor(p);
    if(c==='003')continue; // Manipulador belongs to HyperZone.
    if(plan.role==='relics'&&((c==='030'&&(s.pokerHand.length<5||plan.suitCount<3))||(c==='007'&&s.pokerHand.length<5)||(c==='029'&&s.pokerHand.length<4)||(c==='035'&&s.pokerHand.length<6)))continue;
    if(plan.role==='faces'&&c==='061'&&!s.activeHyper.some(j=>code(s.hand[j])==='062')&&s.pokerHand.length<8)continue;
    if(c==='040'&&plan.role==='aces'&&plan.aces>=4)continue;
    if(c==='045'&&plan.aces<2&&!(plan.aces>=1&&s.activeHyper.some(j=>code(s.hand[j])==='046')))continue;
    if(c==='061'&&plan.faces<3&&!(plan.faces>=2&&s.activeHyper.some(j=>code(s.hand[j])==='062')))continue;
    if(c==='062'&&plan.faces<2&&s.hand.some(x=>code(x)==='061'))continue;
    if(kind==='HYPER'&&fx.supported(id)&&legalHyper(p.id,i))available.push({i,id,kind,score:scoreCard(p.id,id)});
    else if(kind==='SUPER'&&fx.supported(id)&&fx.canPlay(id,p.id))available.push({i,id,kind,score:scoreCard(p.id,id)});
   }
   if(!rush&&s.currentPhase==='MAIN'&&(s.hyperActivationsThisTurn||0)<(s.hyperActivationLimit||1)&&s.activeHyper.length<3){
      for(let ri=0;ri<(s.hyperReserve||[]).length;ri++){
       const id=s.hyperReserve[ri];if(!fx.supported(id))continue;const i=s.hand.length;s.hand.push(id);s.handOwners.push(p.id);
       const allowed=legalHyper(p.id,i);s.hand.pop();s.handOwners.pop();
       if(allowed&&!s.hyperDeniedThisTurn?.includes(id))available.push({i:ri,id,kind:'HYPER_RESERVE',score:scoreCard(p.id,id)+0.7});
      }
    }
    if(!available.length)return null;
   available.sort((a,b)=>b.score-a.score);
   const threshold=(planFor(p).role==='swaps'?{beginner:2.1,intermediate:2.4,expert:2.75}: {beginner:2.45,intermediate:3,expert:3.6})[p.difficulty]||3;
   // Passing is always available: carrying a valuable combo tool into the
   // next turn often outperforms firing a weak Power Card right now.
   if(available[0].score<threshold)return null;
   if(p.difficulty==='beginner'){
    if(rng.next()<.29)return null;
    const plausible=available.filter(x=>x.score>=threshold);
    return plausible[random(Math.min(4,plausible.length))];
   }
   if(p.difficulty==='intermediate'){
    if(rng.next()<.14)return null;
    return available[Math.min(available.length-1,rng.next()<.17?1:0)];
   }
   if(p.difficulty==='expert'&&available[0].score<threshold+.45&&rng.next()<.20)return null;
   return available[0];
  }
  function chooseCounter(pid,trigger,originalId){
   const p=players.find(x=>x.id===pid),s=get(pid),odds={beginner:0.15,intermediate:0.4,expert:0.72};
   if(rng.next()>(odds[p.difficulty]||0.4))return null;
   const list=s.hand.map((id,i)=>({id,i})).filter(x=>{if(s.activeHyper.includes(x.i)||cardType(getCard(x.id))!=='COUNTER'||!fx.canPlay(x.id,pid))return false;
    const c=code(x.id),victim=get(trigger);if(c==='004'&&cardType(getCard(originalId))!=='SUPER')return false;
    if(c==='048'&&victim.chips<1)return false;
    if(c==='052'&&cardType(getCard(originalId))!=='HYPER')return false;
    if(c==='010'&&cardType(getCard(originalId))!=='SUPER')return false;
    if(c==='006'&&victim.pokerHand.length===0)return false;
    return true;});
   const points={'033':8,'004':5,'052':9,'006':3,'010':4,'034':2};
   list.sort((a,b)=>(points[code(b.id)]||0)-(points[code(a.id)]||0));
   return p.difficulty==='beginner'?list[random(list.length)]:list[0]||null;
  }
  function react(pid){
   const opp=players.filter(x=>x.id!==pid);if(!opp.length||!game.pokerDrawPile.length)return;
   const c=game.pokerDrawPile.splice(random(game.pokerDrawPile.length),1)[0];
   const times=opp.map(p=>({p,time:rng.next()*150+({'beginner':100,'intermediate':40,'expert':12}[p.difficulty]||40)})).sort((a,b)=>a.time-b.time);
   get(times[0].p.id).pokerHand.push(c);
   const loser=times[times.length-1].p.id,s=get(loser);
   if(s.pokerHand.length){const card=s.pokerHand.splice(random(s.pokerHand.length),1)[0];links.onPokerOut(loser,[card])}
   log(pid,'Entendí la referencia','Reacción virtual: más rápido J'+times[0].p.playerNumber+', último J'+times[times.length-1].p.playerNumber+'.',getCard('catalog_v3_024'));
  }
  function playCard(p,i){
   const s=get(p.id),id=s.hand[i];if(!fx.canPlay(id,p.id))return false;
   const base=manual.take(p.id,i);if(!base)return false;fx.markUsed(id,p.id);
   const stack=[base];game.chain={stack};
   const other=players.filter(x=>x.id!==p.id);
   const reactions=other.map(op=>({op,counter:chooseCounter(op.id,p.id,id)})).filter(x=>x.counter);
   if(reactions.length){
     const chosen=reactions[0],item=manual.take(chosen.op.id,chosen.counter.i);
     fx.markUsed(item.cardId,chosen.op.id);stack.push(item);
     log(chosen.op.id,'CounterCard',getCard(item.cardId)?.name||item.cardId,getCard(item.cardId));
     if(s.activeHyper.some(i=>s.hand[i]==='catalog_v3_025')&&!s.shieldCardsTriggered){
       drawPoker(p.id,s,'Escudo de Cartas: reaccionó a CounterCard rival');s.shieldCardsTriggered=true;
     }
   }
   const denied=new Set(),resolve=[];
   for(let j=stack.length-1;j>=0;j--){
    const item=stack[j],kind=code(item.cardId);
    if(denied.has(j)){log(item.playerId,'Efecto negado',getCard(item.cardId)?.name||item.cardId);continue}
    if(kind==='033'){if(j>0){denied.add(j-1);log(item.playerId,'Efecto asistido','He Dicho Que No: negó la Power Card anterior de la cadena.',getCard(item.cardId));}continue}
    if(kind==='024'){react(p.id);continue}
    resolve.push({...item,copyOrigin:base,originAllowed:!denied.has(0),triggerPlayerId:j>0?base.playerId:null,triggerCardId:j>0?base.cardId:null});
   }
   for(const item of stack)if(code(item.cardId)!=='040'||denied.has(stack.indexOf(item)))manual.giveBack(item.cardId,item.ownerId);
   for(const x of resolve)fx.enqueue(x);
   fx.finishChain();autoModal();game.chain=null;log(p.id,'Usar Power Card',getCard(id)?.name||id,getCard(id));return true;
  }
  function comboList(pid,handOverride=null){
   const s=get(pid),hand=handOverride||s.pokerHand,active=s.activeHyper.map(i=>s.hand[i]),results=[],max=Math.min(14,hand.length);
   for(let count=2;count<=5&&count<=max;count++){
    let checked=0;
    function visit(start,inds){
     if(checked>4500)return;
     if(inds.length===count){checked++;const cards=inds.map(i=>hand[i]);
      for(const name of count===2?['Par']:count===3?['Trío']:count===4?['Póker']:['Escalera','Color']){
       const points=links.score(pid,name,cards,active);if(points)results.push({name,inds:[...inds],points});
      }return;
     }
     for(let i=start;i<=max-(count-inds.length);i++)visit(i+1,[...inds,i]);
    }
    visit(0,[]);
   }
   return results;
  }
  function charge(p){
   const s=get(p.id),plan=planFor(p);
   const has=(id)=>s.hand.some(c=>code(c)===id)||s.drawPile.some(c=>code(c)===id);
   for(let n=0;n<8;n++){
    const groups=comboList(p.id);if(!groups.length)break;
    const initial=handPotential(p.id,s.pokerHand,plan);
    const forecast=(pick)=>{
     const used=new Set(pick.inds),remaining=s.pokerHand.filter((_,i)=>!used.has(i));
     const follow=comboList(p.id,remaining).reduce((best,x)=>Math.max(best,x.points),0);
     const nextPotential=handPotential(p.id,remaining,plan);
     const acesSpent=pick.inds.filter(i=>s.pokerHand[i].rank==='A').length;
     const facesSpent=pick.inds.filter(i=>['J','Q','K'].includes(s.pokerHand[i].rank)).length;
     const savingAce=plan.role==='aces'&&has('045'),savingRoyal=plan.role==='faces'&&has('061');
     let reserve=0;
     if(savingAce)reserve+=acesSpent*(plan.aces>=2?1.45:2.45);
     if(savingRoyal)reserve+=facesSpent*(plan.faces>=2?1.2:2.15);
     if(plan.role==='relics'){
       const peak=Object.entries(ranksOf(s.pokerHand).suits).sort((a,b)=>b[1]-a[1])[0];
       const targetSuit=peak?.[0];
       const ownCount=peak?.[1]||0;
       if(ownCount>=3&&pick.name!=='Color')reserve+=pick.inds.filter(i=>s.pokerHand[i].suit===targetSuit).length*(s.activeHyper.some(j=>code(s.hand[j])==='030')?2.7:1.25);
     }
     const horizon=p.difficulty==='expert'?.72:p.difficulty==='intermediate'?.43:.18;
     return pick.points+horizon*follow+Math.max(-5,Math.min(5,(nextPotential-initial)*.18))-reserve;
    };
    let pick;
    if(p.difficulty==='beginner'){if(rng.next()>.7)break;pick=groups[random(groups.length)]}
    else{
     groups.sort((a,b)=>forecast(b)-forecast(a));
     pick=p.difficulty==='intermediate'&&groups.length>1&&rng.next()<.12?groups[1]:groups[0];
     const projected=forecast(pick);
     if(p.difficulty==='expert'&&projected<.6)break;
     if(p.difficulty==='intermediate'&&projected<.15&&rng.next()<.7)break;
    }
    const spent=pick.inds.map(i=>s.pokerHand[i]);
    links.onCharge(p.id,spent);
    for(const i of [...pick.inds].sort((a,b)=>b-a))s.pokerHand.splice(i,1);
    links.onPokerOut(p.id,spent);s.chips+=pick.points;s.chargeReplacement+=spent.length;
    log(p.id,'Cobro automático',pick.name+' +'+pick.points+' fichas con '+spent.map(x=>x.rank+'/'+x.suit).join(', '));
   }
  }
  function endPhaseDiscard(p){
   const s=get(p.id),plan=planFor(p);
   const out=[];
   while(s.pokerHand.length>s.pokerLimit){
    const index=chooseDiscardPoker(p.id);
    if(index<0){issue('No hay Poker Cards descartables pese a superar el límite.');break}
    out.push(s.pokerHand.splice(index,1)[0]);
   }
   if(out.length){
    links.onPokerOut(p.id,out);
    log(p.id,'Descarte estratégico End Phase','Descartó '+out.length+' Poker Cards con menor valor proyectado; plan: '+plan.goal+'.');
   }
   while(s.hand.length-s.activeHyper.length>s.powerHandLimit){
    const slots=s.hand.map((id,i)=>({id,i})).filter(x=>!s.activeHyper.includes(x.i));
    if(!slots.length)break;
    slots.sort((a,b)=>scoreCard(p.id,a.id)-scoreCard(p.id,b.id));
    const it=manual.take(p.id,slots[0].i);
    if(!it)break;
    manual.giveBack(it.cardId,it.ownerId);
    log(p.id,'Descarte estratégico End Phase','Power Card menos útil '+(getCard(it.cardId)?.name||it.cardId)+'. Plan: '+plan.goal+'.');
   }
   // Optional discard is legal for the digital Power Hand, and it frees one
   // future draw slot while preserving cards that serve a longer-term plan.
   if(s.turnsTaken>0&&s.drawPile.length&&s.hand.length-s.activeHyper.length>=s.powerHandLimit){
    const slots=s.hand.map((id,i)=>({id,i})).filter(x=>!s.activeHyper.includes(x.i));
    slots.sort((a,b)=>scoreCard(p.id,a.id)-scoreCard(p.id,b.id));
    if(slots.length&&scoreCard(p.id,slots[0].id)<(p.difficulty==='expert'?2.5:p.difficulty==='intermediate'?2.1:1.45)){
     const it=manual.take(p.id,slots[0].i);
     if(it){manual.giveBack(it.cardId,it.ownerId);log(p.id,'Descarte táctico End Phase','Liberó 1 espacio para futuros robos; conservó el resto del plan '+plan.goal+'.');}
    }
   }
  }
  function audit(){
   const physical=[...game.pokerDrawPile,...players.flatMap(p=>get(p.id).pokerHand)].filter(c=>!c.virtualPower);
   const unique=new Set(physical.map(c=>c.id));const expectedPhysical=52*(config.pokerDeckCount||1);
   if(physical.length!==expectedPhysical||unique.size!==expectedPhysical)issue('Integridad Poker: '+physical.length+' cartas físicas, '+unique.size+' identificadores únicos; se esperan '+expectedPhysical+'.');
   for(const p of players){
    const expected={};for(const id of [...p.cardIds,...(rush?[]:(p.hyperCardIds||[]))])expected[id]=(expected[id]||0)+1;
    const actual={};
    for(const other of players){
     const st=get(other.id);
     if(other.id===p.id)for(const id of st.hyperReserve||[])actual[id]=(actual[id]||0)+1;
     st.hand.forEach((id,i)=>{if(st.handOwners[i]===p.id)actual[id]=(actual[id]||0)+1});
     st.drawPile.forEach((id,i)=>{if(st.drawOwners[i]===p.id)actual[id]=(actual[id]||0)+1});
     st.pokerHand.filter(c=>c.virtualPower?.type==='SABUESO'&&c.virtualPower.owner===p.id).forEach(c=>{const id=c.virtualPower.cardId;actual[id]=(actual[id]||0)+1});
    }
    const lost=Object.keys(expected).filter(id=>expected[id]!==actual[id]);
    if(lost.length)issue('Integridad de Power Deck J'+p.playerNumber+': diferencias '+lost.slice(0,4).join(', '));
   }
  }
  const maxRounds=Math.min(80,Math.max(1,config.maxRounds||40));let rounds=0,outcome='Límite de rondas',ties=0;
  for(let round=1;round<=maxRounds;round++){
   rounds=round;game.round=round;
   for(let i=0;i<players.length;i++){
    if(config.cancel?.cancelled){outcome='Cancelada';break}
    game.turnIndex=game.activeIndex=i;
    const p=players[i],s=get(p.id);s.currentPhase='DRAW';
    if(s.turnsTaken>0){
       drawPower(p.id,Math.max(0,s.powerHandLimit-(s.hand.length-s.activeHyper.length)));
       if(s.nextDrawBonus){drawPower(p.id,s.nextDrawBonus,true);s.nextDrawBonus=0;}
       links.phase('DRAW_END',p.id);
     }
    s.currentPhase='MAIN';fx.beginTurn(p.id);links.phase('MAIN_START',p.id);autoModal();
    const currentPlan=planFor(p);s.aiPlan=currentPlan.goal;log(p.id,'Plan IA',currentPlan.role+': '+currentPlan.goal+' (ases '+currentPlan.aces+', figuras '+currentPlan.faces+').');
    for(let j=0;j<8;j++){
     const choice=selectAction(p);if(!choice)break;
     if(choice.kind==='HYPER'||choice.kind==='HYPER_RESERVE'){
       const opponent=players.find(x=>x.id!==p.id&&chooseCounter(x.id,p.id,choice.id)?.id==='catalog_v3_052');
       if(opponent){
         const ci=get(opponent.id).hand.findIndex((x,i)=>x==='catalog_v3_052'&&!get(opponent.id).activeHyper.includes(i));
         if(ci>=0){
           const blocked=manual.take(opponent.id,ci);manual.giveBack(blocked.cardId,blocked.ownerId);
           log(opponent.id,'CounterCard','Agujero Negro: anuló '+getCard(choice.id)?.name+'. Puede activarse otra HyperCard distinta.',getCard('catalog_v3_052'));
           log(p.id,'HyperCard bloqueada','No se consumió la activación: '+getCard(choice.id)?.name);
           s.hyperDeniedThisTurn??=[];s.hyperDeniedThisTurn.push(choice.id);
           continue;
         }
       }
       if(choice.kind==='HYPER_RESERVE'){
         const id=s.hyperReserve.splice(choice.i,1)[0];
         if(!id)break;choice.i=s.hand.length;s.hand.push(id);s.handOwners.push(p.id);
       }
      const historyBefore=(game.histories[p.id]||[]).length;
      fx.activate(choice.i);autoModal();
      const activationLogged=(game.histories[p.id]||[]).slice(historyBefore).some(ev=>
        ev.cardName===(getCard(choice.id)?.name||'')&&/HyperCard activada (realmente|con vínculo)/i.test(ev.detail));
      if(!activationLogged){
         if(choice.kind==='HYPER_RESERVE'&&!s.activeHyper.includes(choice.i)&&s.hand[choice.i]===choice.id){s.hand.splice(choice.i,1);s.handOwners.splice(choice.i,1);s.hyperReserve.push(choice.id);}
         break;
       }
       s.hyperActivationsThisTurn=(s.hyperActivationsThisTurn||0)+1;
      log(p.id,'HyperCard activada',getCard(choice.id)?.name||choice.id);
     }else if(!playCard(p,choice.i))break;
    }
    s.currentPhase='CHARGE';charge(p);
    s.currentPhase='END';
    const qty=Math.max(0,7-s.pokerHand.length);s.chargeReplacement=0;
    for(let k=0;k<qty;k++)drawPoker(p.id,s,'Reposición aleatoria End Phase');
    fx.phase('END',p.id);links.phase('END',p.id);
    endPhaseDiscard(p);
    for(const i of [...s.activeHyper].sort((a,b)=>b-a)){const it=manual.take(p.id,i);if(it)manual.giveBack(it.cardId,it.ownerId);}
    s.hyperActivationsThisTurn=0;s.hyperActivationLimit=1;s.hyperDeniedThisTurn=[];s.shieldCardsTriggered=false;
    s.turnsTaken++;log(p.id,'Fin del turno','Ronda '+round+', fichas '+s.chips+'.');
   }
   if(config.cancel?.cancelled)break;
   fx.round();links.cleanup();
   const top=Math.max(...players.map(p=>get(p.id).chips)),leaders=players.filter(p=>get(p.id).chips===top);
   if(top>=target){if(leaders.length===1){game.finished=true;outcome='Victoria al finalizar ronda';break}
    ties++;if(ties>=3){game.finished=true;outcome='Empate tras rondas adicionales';break}}
   onProgress?.({round,maxRounds,events:Object.values(game.histories).reduce((n,x)=>n+x.length,0)});
   if(round%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  audit();
  const ranking=[...players].sort((a,b)=>get(b.id).chips-get(a.id).chips),top=get(ranking[0].id).chips;
  const totals=Object.values(game.histories).reduce((n,x)=>n+x.length,0),endedAt=Date.now();
  const result={seed:config.seed,version:context.version||'1.19.8',mode:'AUTO_SIM',battleMode:rush?'RUSH':'BLITZ',goal:target,
   rounds,startedAt,endedAt,durationMs:endedAt-startedAt,pokerDeckCount:config.pokerDeckCount||1,finished:game.finished,
   outcome,cancelled:!!config.cancel?.cancelled,winnerIds:ranking.filter(p=>get(p.id).chips===top).map(x=>x.id),
   incidents,effectCounts:counts,eventsCount:totals,
   players:ranking.map(p=>({id:p.id,participantId:p.participantId,seat:p.seat,name:p.name,deckId:p.sourceDeckId,difficulty:p.difficulty,style:p.style,chips:get(p.id).chips,
    events:game.histories[p.id],pokerHand:get(p.id).pokerHand.length,powerHand:get(p.id).hand.length-get(p.id).activeHyper.length,
    activeHyper:get(p.id).activeHyper.length,deckLeft:get(p.id).drawPile.length}))
  };
  onProgress?.({round:rounds,maxRounds,events:totals,finished:true});
  return result;
 }
 return {play};
};
