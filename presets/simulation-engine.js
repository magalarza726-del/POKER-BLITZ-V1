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
  if(!Array.isArray(config?.players)||config.players.length<1||config.players.length>10)throw Error('La simulación requiere entre 1 y 10 jugadores.');
  if(![1,2].includes(Number(config.pokerDeckCount||1)))throw Error('Selecciona una o dos barajas de Poker.');
  if(config.players.length*7>Number(config.pokerDeckCount||1)*52)
    throw Error('Se requieren 2 barajas de Poker para repartir 7 cartas a '+config.players.length+' jugadores.');
  const wrong=config.players.find(p=>{
    if(!Array.isArray(p.cardIds)||!Array.isArray(p.hyperCardIds||[]))return true;
    const h=(p.hyperCardIds||[]).length,n=p.cardIds.length,counts={};
    for(const id of p.cardIds)counts[id]=(counts[id]||0)+1;
    return h>3||new Set(p.hyperCardIds||[]).size!==h||n<20||n>35||
      Object.values(counts).some(x=>x>3)||p.cardIds.some(id=>cardType(getCard(id))!=='SUPER'&&cardType(getCard(id))!=='COUNTER')||
      (p.hyperCardIds||[]).some(id=>cardType(getCard(id))!=='HYPER');
   });
   if(wrong)throw Error('Power Deck no cumple el reglamento oficial (20 a 35; H≤3; máximo 3 copias): '+(wrong.name||'sin nombre')+'. Las cartas faltantes no se sustituyen automáticamente.');
  const rng=randomFactory(config.seed),players=config.players.map((p,i)=>({...p,id:'AUTO-'+(i+1),participantId:p.participantId||'P'+(i+1),seat:i+1,sourceDeckId:p.id,playerNumber:i+1,
   difficulty:'expert',style:Object.entries(styleKeys).sort((a,b)=>{
    const n=lst=>p.cardIds.filter(x=>lst.includes(code(x))).length;return n(b[1])-n(a[1]);
   })[0][0]}));
  // Only Type I single-player training may use 2–7 Power Cards in one turn.
  // Official matches remain fixed at 4.
  const soloTraining=!!config.trainingScenario&&players.length===1;
  const forcedHand=soloTraining&&Array.isArray(config.trainingScenario.handIds)?config.trainingScenario.handIds:null;
  const initialPower=soloTraining?Math.min(7,Math.max(2,forcedHand?.length||Number(config.trainingScenario.handSize)||4)):4;
  const rush=config.battleMode==='RUSH',initialPoker=7,target=rush?15:30;
  const rngShuffle=a=>rng.shuffle(a),random=n=>rng.int(n);
  const game={mode:'ASSISTED',autoMode:true,decks:players,states:{},histories:{},pokerDrawPile:sourceDeck(config.pokerDeckCount||1,rng),round:1,
   turnIndex:0,activeIndex:0,goal:target,assistedPending:[],linkedEvents:[],finished:false};
  const startedAt=Date.now(),incidents=[],counts={};let eventCount=0;
  const issue=x=>{if(incidents.length<40)incidents.push(String(x))};
  function log(pid,action,detail='',card=null){
   if(!game.histories[pid])game.histories[pid]=[];
   eventCount++;
   const st=game.states[pid];
   if(!config.summaryOnly)game.histories[pid].push({at:Date.now(),round:game.round,action,detail,cardName:card?.name||'',cardDescription:card?.description||'',state:st?{chips:st.chips,poker:st.pokerHand.length,power:st.hand.length-st.activeHyper.length,hyper:st.activeHyper.length}:null});
   if(['Efecto asistido','Efecto vinculado','Entendí la referencia'].includes(action)){const id=card?.id;if(id)counts[id]=(counts[id]||0)+1;}
  }
  for(const p of players){
   const list=rng.shuffle(p.cardIds);
   let hand;
   if(soloTraining&&forcedHand){
     hand=[];
     for(const cid of forcedHand.slice(0,7)){
       const j=list.indexOf(cid);
       if(j<0)throw Error('La mano de entrenamiento contiene una carta ausente del deck fijo.');
       hand.push(list.splice(j,1)[0]);
     }
   }else hand=list.splice(0,Math.min(initialPower,list.length));
   const pokerHand=game.pokerDrawPile.splice(0,Math.min(initialPoker,game.pokerDrawPile.length));
   game.states[p.id]={initialCards:p.cardIds.length,hand,handOwners:hand.map(()=>p.id),drawPile:list,drawOwners:list.map(()=>p.id),
    pokerHand,activeHyper:[],hyperReserve:rush?[]:[...new Set((p.hyperCardIds||[]).filter(id=>cardType(getCard(id))==='HYPER'))].slice(0,3),hyperActivationsThisTurn:0,usedHyperThisTurn:[],chips:0,chargeReplacement:0,turnsTaken:0,currentPhase:'MAIN',powerHandLimit:Infinity,pokerLimit:7,dieBase:null,dieModifier:0};
   log(p.id,'Reparto inicial',`${initialPower} Power Cards, ${pokerHand.length} Poker Cards. IA ${difficulty[p.difficulty]||difficulty.intermediate}.`);
  }
  const get=pid=>game.states[pid],my=()=>game.decks[game.turnIndex];
  const drawPoker=(pid,st=get(pid),reason='Robar Poker Card')=>{
   if(!game.pokerDrawPile.length){issue('Mazo Poker agotado.');return null}
   const card=game.pokerDrawPile.shift();st.pokerHand.push(card);
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
   // Match deck content, including evolution-generated versions, before character identity.
   const hyper=new Set((p.hyperCardIds||[]).map(code)),deck=p.cardIds||[];
   const has=ids=>deck.filter(x=>ids.includes(code(x))).length;
   if(hyper.has('046')&&has(['040','045','047'])>=2)return 'aces';
   if(hyper.has('062')&&has(['023','057','061','063'])>=2)return 'faces';
   if((hyper.has('029')||hyper.has('030'))&&has(['016','029','030','032','053'])>=2)return 'relics';
   return p.style==='hyper'?'relics':p.style==='aces'?'aces':p.style==='faces'?'faces':p.style==='poker'?'swaps':p.style||'balanced';
  }
  function ranksOf(cards){
   const counts={},suits={S:0,H:0,D:0,C:0};
   for(const c of cards){counts[c.rank]=(counts[c.rank]||0)+1;if(c.suit in suits)suits[c.suit]++;}
   return {counts,suits};
  }
  function planFor(p){
   const s=get(p.id),base=role(p),r=ranksOf(s.pokerHand);
   const aces=r.counts.A||0,faces=(r.counts.J||0)+(r.counts.Q||0)+(r.counts.K||0);
   const available=id=>s.hand.some((c,i)=>code(c)===id&&!s.activeHyper.includes(i));
   const active=id=>s.activeHyper.some(i=>code(s.hand[i])===id);
   const accessible=id=>available(id)||active(id)||(s.hyperReserve||[]).some(c=>code(c)===id);
   const inDeck=id=>s.drawPile.some(c=>code(c)===id);
   const suitCount=Math.max(0,...Object.values(r.suits));
   const numbers=new Set(s.pokerHand.map(c=>({A:14,K:13,Q:12,J:11})[c.rank]||Number(c.rank)));
   if(numbers.has(14))numbers.add(1);
   let straightHits=0;
   for(let low=1;low<=10;low++){let hits=0;for(let i=0;i<5;i++)if(numbers.has(low+i))hits++;straightHits=Math.max(straightHits,hits)}
   const routes=[
    {goal:'ace-chain',role:'aces',score:(accessible('046')?3:0)+(available('040')?4:inDeck('040')?1:0)+(available('047')?2.5:0)+(available('016')?1.8:0)+(available('045')?3:0)+Math.min(3,aces)*1.6+(base==='aces'?1:0)},
    {goal:'royal-chain',role:'faces',score:(accessible('062')?3:0)+(available('063')?3:inDeck('063')?1:0)+(available('023')?2:0)+(available('061')?4:0)+Math.min(4,faces)*1.4+(base==='faces'?1:0)},
    {goal:'color-chain',role:'relics',score:(accessible('030')?3:0)+(accessible('043')?1:0)+(suitCount>=3?3:0)+Math.max(0,suitCount-2)*1.45+(base==='relics'?1:0)},
    {goal:'straight-chain',role:'relics',score:(accessible('029')?3:0)+(straightHits>=3?3:0)+Math.max(0,straightHits-2)*1.6+(base==='relics'?.7:0)},
    {goal:'poker-control',role:base,score:3.5+(available('013')?2:0)+(available('010')?1:0)+(available('053')?1:0)+(base==='swaps'?2:0)}
   ].map(r=>({...r,score:r.score+Math.max(-4,Math.min(4,Number(p.aiPolicy?.routes?.[r.goal]||0)))}))
    .sort((a,b)=>b.score-a.score);
   const best=routes[0];
   const sequence=best.goal==='ace-chain'?['046','040','047','016','045']:
    best.goal==='royal-chain'?['062','023','063','057','061']:
    best.goal==='color-chain'?['030','043','016','053']:
    best.goal==='straight-chain'?['029','016','053']:['013','010','053'];
   return {role:best.role,baseRole:base,goal:best.goal,sequence,alternatives:routes.slice(1).map(x=>x.goal),
    aces,faces,suit:r.suits,suitCount,straightHits,hyperCount:s.activeHyper.length,
    hasColor:active('030'),wantsColor:best.goal==='color-chain'&&accessible('030')&&!active('030'),
    pokerSize:s.pokerHand.length,available,active,accessible,inDeck};
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
   if(linked?.kind==='hyper-quantity'){
    const max=Number(linked.maxCost||0),hand=get(p.id).pokerHand,bySuit=ranksOf(hand).suits;
    const strongest=Math.max(0,...Object.values(bySuit)),rankGroups=ranksOf(hand).ranks;
    // Two suit enchantments may not copy the same suit. A single wildcard is better for a single flush.
    const requested=linked.type==='030'
      ?(strongest>=3?1:hand.length>=8&&max===2?2:hand.length>=4?1:0)
      :(hand.length>=5&&max===2&&plan.role!=='aces'&&plan.role!=='faces'?2:hand.length>=2?1:0);
    return 'quantity:'+Math.min(max,requested);
   }
   if(linked?.kind==='hyper-power'){
    return [...candidates].sort((a,b)=>{
      const ix=v=>Number(v.slice(6));
      return scoreCard(p.id,get(p.id).hand[ix(a)])-scoreCard(p.id,get(p.id).hand[ix(b)]);
    })[0];
   }
   if(linked?.kind==='sabueso'){
    // Prefer two distinct non-Aces that maximize the resulting strategic hand.
    const enchanted=cards.map(c=>selected.has(c.id)?{...c,rank:'A'}:c);
    const before=handPotential(pid,enchanted,plan);
    return [...candidates].map(id=>{
      const result=handPotential(pid,enchanted.map(c=>c.id===id?{...c,rank:'A'}:c),plan);
      const original=cards.find(c=>c.id===id);
      return {id,gain:result-before+(original?.rank==='A'?-100:0)};
    }).sort((a,b)=>b.gain-a.gain)[0].id;
   }
   if(linked?.kind==='hyper'&&['029','030'].includes(linked.type)){
    const bySuit=Object.entries(ranks.suits).sort((a,b)=>b[1]-a[1]),desiredSuit=bySuit[0]?.[0];
    const values=ranks.ranks||{},scoreChoice=id=>{
      const c=cards.find(c=>c.id===id);
      if(!c)return -999;
      if(linked.type==='030')return (c.suit!==desiredSuit?6:-3)+
        (ranks.suits[c.suit]||0)*-.2+
        (selected.size&&bySuit[1]?.[0]===c.suit?0.4:0);
      return (values[c.rank]===1?4:-4)+(c.rank==='A'&&plan.role==='aces'?-4:0)+
        (['J','Q','K'].includes(c.rank)&&plan.role==='faces'?-3:0);
    };
    return [...candidates].sort((a,b)=>scoreChoice(b)-scoreChoice(a))[0];
   }
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
  function blackjackPair(hand){
    const rank=c=>({J:11,Q:12,K:13,A:14})[c.rank]||Number(c.rank);
    return hand.some((a,i)=>hand.some((b,j)=>j>i&&a.rank!==b.rank&&rank(a)+rank(b)===21));
  }
  function mainPayoutAvailable(pid){
    const st=get(pid),hand=st.pokerHand;
    return st.hand.some((other,i)=>!st.activeHyper.includes(i)&&fx.canPlay(other,pid)&&
      (code(other)==='041'&&blackjackPair(hand)||
       code(other)==='045'&&hand.some(c=>c.rank==='A')||
       code(other)==='061'&&hand.some(c=>['J','Q','K'].includes(c.rank))));
  }
  function scoreCard(pid,id){
   const p=players.find(x=>x.id===pid),s=get(pid),c=code(id),plan=planFor(p),hand=s.pokerHand;
   const active=c=>s.activeHyper.some(i=>code(s.hand[i])===c);
   let val=({'003':3.6,'014':4.8,'015':4.5,'018':4.4,'019':4.5,'020':4.4,'036':4.6,'053':3.5,'011':3.2,'009':3.1,'029':3.4,'030':3.6,'035':3.2,'005':4.2,'042':3.1,'043':3.2,'044':3.5,'049':3.6,'040':3.2,'045':1.6,'061':1.6,'033':4,'007':3.1,'013':2.8,'063':2.8,'032':3.3,'016':3.5,'031':2.7})[c]||2;
   if(styleKeys[p.style].includes(c))val+=.35;
   if(s.pokerHand.length>=s.pokerLimit&&['011','016','031','032','053','063','039','018'].includes(c))val-=1;
   if(s.pokerHand.length<=3&&['011','016','032','053','063','039'].includes(c))val+=.8;
   if(c==='049'){
     // Gran Inversor solo bonifica fichas GENERADAS por Power Cards durante Main Phase.
     // Robar fichas a un rival no es una ganancia bonificable.
     const opportunities=mainPayoutAvailable(pid);
     val+=opportunities?5:-12;
   }
   if(c==='041')val+=blackjackPair(hand)?6:-5;
   if(c==='045')val+=(plan.aces>=2?Math.min(7,plan.aces*1.75):plan.aces===1?-.5:-6);
   if(c==='061')val+=(plan.faces>=4?6:plan.faces>=2?2:-6);
   if(c==='003'){
     const usableDice=s.hand.some((other,i)=>!s.activeHyper.includes(i)&&
       ['014','015','018','019','020','036'].includes(code(other))&&fx.canPlay(other,pid));
     val+=usableDice?5:-7;
   }
   if(plan.role==='dice'&&['014','015','018','019','020','036'].includes(c))val+=1.15;
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
   const learned=Number(p.aiPolicy?.cards?.[c]||0);
   let sequenceBonus=0;
   for(const [pair,boost] of Object.entries(p.aiPolicy?.links||{})){
     const [before,after]=pair.split('>');
     if(after!==c||!/^\d{3}$/.test(before))continue;
     const weight=Math.max(-4,Math.min(4,Number(boost)||0));
     const played=(s.assistedPlayedSupers||[]).some(x=>code(x.cardId)===before);
     const enabled=s.activeHyper.some(i=>code(s.hand[i])===before);
     const waiting=s.hand.some((v,i)=>!s.activeHyper.includes(i)&&code(v)===before)||
      (s.hyperReserve||[]).some(v=>code(v)===before);
     if(played||enabled)sequenceBonus+=weight;
     else if(waiting)sequenceBonus-=weight*.7;
   }
   return val+strategyBonus(pid,id,plan)+sequenceBonus+
    Math.max(-6,Math.min(6,Number.isFinite(learned)?learned:0));
  }
  function strategyBonus(pid,cardId,plan){
   const s=get(pid),c=code(cardId),h=s.pokerHand,ready=plan.available,active=plan.active;
   const playable=id=>ready(id)&&fx.canPlay('catalog_v3_'+id,pid);
   const setupA=playable('040')||playable('047')||(playable('016')&&plan.aces<4);
   const setupR=playable('023')||playable('063')||(playable('016')&&plan.faces<4);
   let bonus=0;
   if(plan.goal==='ace-chain'){
     if(c==='046')bonus+=ready('040')||ready('047')||ready('045')?9:plan.aces?3:0;
     if(c==='040')bonus+=active('046')?10:ready('045')?6:2;
     if(c==='047')bonus+=active('046')?(ready('016')?10:7):plan.aces>=3?-2:3;
     if(c==='016')bonus+=ready('045')&&plan.aces<4?6:plan.aces<2?3:0;
     if(c==='045')bonus+=plan.aces>=2?(setupA?-12:14):-12;
     if(['053','032','039'].includes(c))bonus+=plan.aces<3?2:0;
   }else if(plan.goal==='royal-chain'){
     if(c==='062')bonus+=ready('063')||ready('057')||ready('061')?9:plan.faces>=2?3:0;
     if(c==='023')bonus+=active('062')?7:plan.faces<4?3:0;
     if(c==='063')bonus+=active('062')?8:plan.faces<3?3:0;
     if(c==='057')bonus+=active('062')?6:0;
     if(c==='016')bonus+=plan.faces<4&&ready('061')?6:0;
     if(c==='061')bonus+=plan.faces>=3?(setupR?-10:13):-11;
   }else if(plan.goal==='color-chain'){
     if(c==='030')bonus+=plan.suitCount>=4?8:plan.suitCount===3?5:-5;
     if(c==='043')bonus+=h.length>=3?4:-4;
     if(['016','053'].includes(c))bonus+=plan.suitCount>=3?3:1;
     if(c==='029')bonus+=plan.straightHits>=4?3:-2;
   }else if(plan.goal==='straight-chain'){
     if(c==='029')bonus+=plan.straightHits>=4?9:plan.straightHits===3?5:-5;
     if(['016','053'].includes(c))bonus+=plan.straightHits>=3?4:0;
     if(c==='030')bonus+=plan.suitCount>=4?3:-3;
   }
   // Preserve payoff cards for the current route; do not force unused HyperCards.
   if(c==='045'&&plan.goal!=='ace-chain')bonus+=plan.aces>=2?3:-5;
   if(c==='061'&&plan.goal!=='royal-chain')bonus+=plan.faces>=3?3:-5;
   if(['046','062','029','030'].includes(c)&&active(c))bonus-=20;
   return bonus;
  }
  function legalHyper(pid,i){
   const s=get(pid),id=s.hand[i],c=code(id);
   if(!id||s.activeHyper.includes(i)||s.activeHyper.length>=3||(s.usedHyperThisTurn||[]).includes(id))return false;
   if(links.supported.has(c))return links.eligible(pid,i);
   const copies=s.activeHyper.filter(j=>s.hand[j]===id).length;
   if(copies>=1)return false;
   const required=({'003':[0,1],'049':[0,1]})[c]||[0,0];
   return s.pokerHand.length>=required[1]&&s.hand.filter((_,j)=>j!==i&&!s.activeHyper.includes(j)).length>=required[0];
  }
  function hyperMakesSense(pid,id,index,plan){
   const c=code(id),s=get(pid),ready=plan.available;
   const spare=s.hand.filter((_,i)=>i!==index&&!s.activeHyper.includes(i)).length;
   const canSearch=['016','053','032','039','063'].some(ready);
   if(c==='046')return ['040','045','047'].some(ready);
   if(c==='062')return ['023','057','061','063'].some(ready);
   if(c==='030')return spare>=1&&(plan.suitCount>=4||(plan.suitCount===3&&canSearch));
   if(c==='029')return spare>=1&&(plan.straightHits>=4||(plan.straightHits===3&&(spare>=2||canSearch)));
   if(c==='043')return s.pokerHand.length>=3&&
     (Object.values(ranksOf(s.pokerHand).counts).some(n=>n>=2)||plan.suitCount>=4);
   if(c==='003')return s.hand.some((x,i)=>i!==index&&!s.activeHyper.includes(i)&&
     ['014','015','018','019','020','036'].includes(code(x)));
   if(c==='049')return mainPayoutAvailable(pid);
   return true;
  }
  function selectAction(p){
   const s=get(p.id),available=[],plan=planFor(p);
   const ready=id=>s.hand.some((x,i)=>!s.activeHyper.includes(i)&&code(x)===id&&fx.canPlay(x,p.id));
   for(let i=0;i<s.hand.length;i++){
    if(s.activeHyper.includes(i))continue;
    const id=s.hand[i],kind=cardType(getCard(id)),c=code(id);
    if(c==='003'&&kind!=='HYPER')continue; // Manipulador belongs to HyperZone.
    if(kind==='HYPER'&&!hyperMakesSense(p.id,id,i,plan))continue;
    if(c==='007'&&(s.pokerHand.length<5||!(s.hyperReserve||[]).length))continue;
    if(c==='035'&&s.pokerHand.length<6)continue;
    // Avoid activating a HyperCard simply because it is available; require real payoff.
    if(c==='046'&&plan.aces<2&&!['040','045','047'].some(plan.available)&&!['040','045','047'].some(plan.inDeck))continue;
    if(c==='062'&&plan.faces<2&&!['023','057','061','063'].some(plan.available)&&!['023','057','061','063'].some(plan.inDeck))continue;
    if(plan.role==='faces'&&c==='061'&&!s.activeHyper.some(j=>code(s.hand[j])==='062')&&s.pokerHand.length<8)continue;
    if(c==='040'&&plan.goal==='ace-chain'&&plan.aces>=4)continue;
    if(c==='045'&&plan.aces<2)continue;
    if(c==='045'&&plan.goal==='ace-chain'&&(ready('040')||ready('047')||ready('016')&&plan.aces<4))continue;
    if(c==='061'&&plan.faces<3)continue;
    if(c==='061'&&plan.goal==='royal-chain'&&(ready('023')||ready('063')||ready('016')&&plan.faces<4))continue;
    if(c==='062'&&plan.faces<2&&plan.goal!=='royal-chain')continue;
    if(kind==='HYPER'&&fx.supported(id)&&legalHyper(p.id,i))available.push({i,id,kind,score:scoreCard(p.id,id)});
    else if(kind==='SUPER'&&fx.supported(id)&&fx.canPlay(id,p.id))available.push({i,id,kind,score:scoreCard(p.id,id)});
   }
   if(!rush&&s.currentPhase==='MAIN'&&s.activeHyper.length<3){
      for(let ri=0;ri<(s.hyperReserve||[]).length;ri++){
       const id=s.hyperReserve[ri];if(!fx.supported(id))continue;const i=s.hand.length;s.hand.push(id);s.handOwners.push(p.id);
       const allowed=legalHyper(p.id,i);s.hand.pop();s.handOwners.pop();
       if(allowed&&!s.hyperDeniedThisTurn?.includes(id)){
         const n=code(id),diceAvailable=s.hand.some((other,j)=>!s.activeHyper.includes(j)&&
           ['014','015','018','019','020','036'].includes(code(other))&&fx.canPlay(other,p.id));
         const payoutAvailable=mainPayoutAvailable(p.id);
         if((n!=='003'||diceAvailable)&&(n!=='049'||payoutAvailable)&&hyperMakesSense(p.id,id,i,plan))
           available.push({i:ri,id,kind:'HYPER_RESERVE',score:scoreCard(p.id,id)+0.7});
       }
      }
    }
    if(!available.length)return null;
    // Type I can probe different action orders while still obeying real
    // effect eligibility. Orders never override canPlay, phases or costs.
    const practice=soloTraining&&Array.isArray(config.trainingScenario?.orderCodes)
     ?config.trainingScenario.orderCodes:[];
    if(practice.length)for(const action of available){
      const place=practice.indexOf(code(action.id));
      if(place>=0)action.score+=Math.min(20,(practice.length-place)*3);
    }
   available.sort((a,b)=>b.score-a.score);
   const baseThreshold=(planFor(p).role==='swaps'?{beginner:2.1,intermediate:2.4,expert:2.75}: {beginner:2.45,intermediate:3,expert:3.6})[p.difficulty]||3;
   const threshold=baseThreshold+Math.max(-1.5,Math.min(1.5,Number(p.aiPolicy?.threshold)||0));
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
   const p=players.find(x=>x.id===pid),s=get(pid),odds={beginner:0.18,intermediate:0.65,expert:1};
   if(rng.next()>(odds[p.difficulty]||0.65))return null;
   const list=s.hand.map((id,i)=>({id,i})).filter(x=>{if(s.activeHyper.includes(x.i)||cardType(getCard(x.id))!=='COUNTER'||!fx.canPlay(x.id,pid))return false;
    const c=code(x.id),victim=get(trigger),kind=cardType(getCard(originalId));
     if(kind==='HYPER'&&!['052','006'].includes(c))return false;
     if(kind==='SUPER'&&c==='052')return false;
     // Escudo Resplandeciente reacciona SOLO después de que el efecto seleccione realmente al defensor.
     if(c==='004')return false;
    if(c==='048'&&victim.chips<1)return false;
    if(c==='052'&&kind!=='HYPER')return false;
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
     const horizon=Math.max(.1,Math.min(1.4,(p.difficulty==='expert'?.72:p.difficulty==='intermediate'?.43:.18)
      +Number(p.aiPolicy?.horizon||0)));
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
   // Los efectos pueden superar 7 PKC y 4 PWC: no existe descarte obligatorio al finalizar.
   // Las cartas extra se conservan; la reposición solamente completa la cantidad mínima.
   if(s.turnsTaken>0&&s.drawPile.length&&s.hand.length-s.activeHyper.length>=4){
    const slots=s.hand.map((id,i)=>({id,i})).filter(x=>!s.activeHyper.includes(x.i));
    slots.sort((a,b)=>scoreCard(p.id,a.id)-scoreCard(p.id,b.id));
    if(slots.length&&scoreCard(p.id,slots[0].id)<(p.difficulty==='expert'?2.5:p.difficulty==='intermediate'?2.1:1.45)){
     const it=manual.take(p.id,slots[0].i);
     if(it){manual.giveBack(it.cardId,it.ownerId);log(p.id,'Descarte táctico voluntario','Descartó voluntariamente una Power Card poco útil; conservó el resto del plan '+plan.goal+'.');}
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
  const maxRounds=Math.min(80,Math.max(1,config.maxRounds||40));
  let rounds=0,outcome='Límite de rondas',tieContenders=null,tieRounds=0,finalWinners=[];
  for(let round=1;round<=maxRounds||(tieContenders&&tieRounds<3);round++){
   rounds=round;game.round=round;game.eligiblePlayers=tieContenders?tieContenders.slice():null;
   for(let i=0;i<players.length;i++){
    if(tieContenders&&!tieContenders.includes(players[i].id))continue;
    if(config.cancel?.cancelled){outcome='Cancelada';break}
    game.turnIndex=game.activeIndex=i;
    const p=players[i],s=get(p.id);s.currentPhase='MAIN';if(s.turnsTaken>0){
       drawPower(p.id,Math.max(0,4-(s.hand.length-s.activeHyper.length)));
       if(s.nextDrawBonus){drawPower(p.id,s.nextDrawBonus,true);s.nextDrawBonus=0;}
       links.phase('DRAW_END',p.id);
     }
    fx.beginTurn(p.id);links.phase('MAIN_START',p.id);autoModal();
    const currentPlan=planFor(p);s.aiPlan=currentPlan.goal;
    const planned=currentPlan.sequence.filter(x=>currentPlan.available(x)||currentPlan.accessible(x));
    log(p.id,'Plan IA',currentPlan.goal+' | secuencia: '+(planned.join(' → ')||'cobro flexible')+' | alternativas: '+currentPlan.alternatives.slice(0,2).join(', ')+' | Ases '+currentPlan.aces+', figuras '+currentPlan.faces+', palo mayor '+currentPlan.suitCount+'.');
    for(let j=0;j<64;j++){
     const choice=selectAction(p);if(!choice)break;
     if(choice.kind==='HYPER'||choice.kind==='HYPER_RESERVE'){
       game.pendingHyperActivationCardId=choice.id;
       const reactors=players.filter(x=>x.id!==p.id).map(x=>({player:x,choice:chooseCounter(x.id,p.id,choice.id)})).filter(x=>x.choice);
       delete game.pendingHyperActivationCardId;
       if(reactors.length){
         const {player:counterPlayer,choice:counter}=reactors[0];
         const response=manual.take(counterPlayer.id,counter.i);
         if(response){
           manual.giveBack(response.cardId,response.ownerId);
           log(counterPlayer.id,'CounterCard',getCard(response.cardId)?.name||response.cardId,getCard(response.cardId));
           if(s.activeHyper.some(i=>s.hand[i]==='catalog_v3_025')&&!s.shieldCardsTriggered){
             drawPoker(p.id,s,'Escudo de Cartas: primera CounterCard rival');s.shieldCardsTriggered=true;
           }
           if(code(response.cardId)==='052'){
             log(p.id,'HyperCard bloqueada','Agujero Negro anuló '+getCard(choice.id)?.name+'. Activación no consumida.');
             s.hyperDeniedThisTurn??=[];s.hyperDeniedThisTurn.push(choice.id);continue;
           }
           fx.enqueue({cardId:response.cardId,playerId:counterPlayer.id,triggerPlayerId:p.id,triggerCardId:choice.id});
           fx.finishChain();autoModal();
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
       s.hyperActivationsThisTurn=(s.hyperActivationsThisTurn||0)+1;(s.usedHyperThisTurn??=[]).push(choice.id);
      log(p.id,'HyperCard activada',getCard(choice.id)?.name||choice.id);
     }else if(!playCard(p,choice.i))break;
      if(s.pokerHand.length>=5)charge(p);
     }
     charge(p);s.currentPhase='MAIN';
    const qty=Math.max(0,7-s.pokerHand.length);s.chargeReplacement=0;
    for(let k=0;k<qty;k++)drawPoker(p.id,s,'Reposición al cerrar turno');
    fx.phase('END',p.id);
    endPhaseDiscard(p);
    fx.phase('END_COMPLETE',p.id);
    for(const i of [...s.activeHyper].sort((a,b)=>b-a)){const it=manual.take(p.id,i);if(it)manual.giveBack(it.cardId,it.ownerId);}
    s.hyperActivationsThisTurn=0;s.usedHyperThisTurn=[];s.hyperDeniedThisTurn=[];s.shieldCardsTriggered=false;
    s.turnsTaken++;log(p.id,'Fin del turno','Ronda '+round+', fichas '+s.chips+'.');
   }
   if(config.cancel?.cancelled)break;
   fx.round();links.cleanup();
   const contenders=tieContenders?players.filter(p=>tieContenders.includes(p.id)):players;
   const qualified=contenders.filter(p=>get(p.id).chips>=target);
   if(tieContenders)tieRounds++;
   if(qualified.length){
     const top=Math.max(...qualified.map(p=>get(p.id).chips));
     const leaders=qualified.filter(p=>get(p.id).chips===top);
     if(leaders.length===1){
       finalWinners=[leaders[0].id];game.finished=true;
       outcome=tieContenders?'Victoria en desempate':'Victoria al finalizar ronda';break;
     }
     if(!tieContenders){
       tieContenders=leaders.map(p=>p.id);
       for(const p of players)log(p.id,'Desempate','Solo los '+leaders.length+' jugadores empatados continúan hasta 3 rondas adicionales.');
     }
   }
   if(tieContenders&&tieRounds>=3){
     const top=Math.max(...tieContenders.map(id=>get(id).chips));
     finalWinners=tieContenders.filter(id=>get(id).chips===top);
     game.finished=true;outcome='Empate total tras 3 rondas adicionales';break;
   }
   onProgress?.({round,maxRounds,events:eventCount});
   if(round%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  audit();
  const ranking=[...players].sort((a,b)=>get(b.id).chips-get(a.id).chips),top=get(ranking[0].id).chips;
  const totals=eventCount,endedAt=Date.now();
  const result={seed:config.seed,version:context.version||'1.19.8',mode:soloTraining?'AI_SOLO_TRAIN':'AUTO_SIM',battleMode:rush?'RUSH':'BLITZ',goal:target,
   rounds,startedAt,endedAt,durationMs:endedAt-startedAt,pokerDeckCount:config.pokerDeckCount||1,finished:game.finished,
   outcome,cancelled:!!config.cancel?.cancelled,winnerIds:finalWinners.length?finalWinners:ranking.filter(p=>get(p.id).chips===top).map(x=>x.id),
   incidents,effectCounts:counts,eventsCount:totals,
   players:ranking.map(p=>({id:p.id,participantId:p.participantId,seat:p.seat,name:p.name,deckId:p.sourceDeckId,difficulty:p.difficulty,style:p.style,chips:get(p.id).chips,
    events:config.summaryOnly?[]:game.histories[p.id],pokerHand:get(p.id).pokerHand.length,powerHand:get(p.id).hand.length-get(p.id).activeHyper.length,
    activeHyper:get(p.id).activeHyper.length,deckLeft:get(p.id).drawPile.length}))
  };
  onProgress?.({round:rounds,maxRounds,events:totals,finished:true});
  return result;
 }
 return {play};
};
