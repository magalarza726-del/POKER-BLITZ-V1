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
  const rng=randomFactory(config.seed),players=config.players.map((p,i)=>({...p,id:'AUTO-'+(i+1),sourceDeckId:p.id,playerNumber:i+1,
   difficulty:p.difficulty||'intermediate',style:Object.entries(styleKeys).sort((a,b)=>{
    const n=lst=>p.cardIds.filter(x=>lst.includes(code(x))).length;return n(b[1])-n(a[1]);
   })[0][0]}));
  const rush=config.battleMode==='RUSH',initialPoker=rush?7:5,initialPower=rush?4:3,target=rush?15:30;
  const rngShuffle=a=>rng.shuffle(a),random=n=>rng.int(n);
  const game={mode:'ASSISTED',autoMode:true,decks:players,states:{},histories:{},pokerDrawPile:sourceDeck(config.pokerDeckCount||1,rng),round:1,
   turnIndex:0,activeIndex:0,goal:target,assistedPending:[],linkedEvents:[],finished:false};
  const startedAt=Date.now(),incidents=[],counts={};
  const issue=x=>{if(incidents.length<40)incidents.push(String(x))};
  function log(pid,action,detail='',card=null){
   if(!game.histories[pid])game.histories[pid]=[];
   const st=game.states[pid];game.histories[pid].push({at:Date.now(),round:game.round,action,detail,cardName:card?.name||'',cardDescription:card?.description||'',state:st?{chips:st.chips,poker:st.pokerHand.length,power:st.hand.length-st.activeHyper.length,hyper:st.activeHyper.length}:null});
   if(action==='Efecto asistido'||action==='Efecto vinculado')counts[card?.id||'other']=(counts[card?.id||'other']||0)+1;
  }
  for(const p of players){
   const list=rng.shuffle(p.cardIds),hand=list.splice(0,Math.min(initialPower,list.length)),
    pokerHand=game.pokerDrawPile.splice(0,Math.min(initialPoker,game.pokerDrawPile.length));
   game.states[p.id]={initialCards:p.cardIds.length,hand,handOwners:hand.map(()=>p.id),drawPile:list,drawOwners:list.map(()=>p.id),
    pokerHand,activeHyper:[],chips:0,chargeReplacement:0,turnsTaken:0,currentPhase:'MAIN',powerHandLimit:4,pokerLimit:7,dieBase:null,dieModifier:0};
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
    links:()=>links,chooseCopiedSuper:(pid,ids)=>[...ids].sort((a,b)=>scoreCard(pid,b)-scoreCard(pid,a))[0]};
  fx=window.POKER_BLITZ_ASSISTED_EFFECTS(effectCtx);
  links=window.POKER_BLITZ_ASSISTED_LINKS({...effectCtx,recalc:pid=>fx.recalc(pid),drawPower,discardPower,afterSelection:()=>fx.afterSelection()});
  function autoModal(){
   for(let i=0;modal&&i<28;i++){
    if(modal.type==='assisted-target'){
     const ids=[...fx.modalMarkup().matchAll(/data-action="assist-target" data-player="([^"]+)"/g)].map(x=>x[1]);
     if(!ids.length){issue('Sin rivales válidos en selección asistida.');modal=null;break}
     const p=my(),score=id=>get(id).chips*2+get(id).pokerHand.length+random(5);
     const selection=p.difficulty==='beginner'?ids[random(ids.length)]:ids.sort((a,b)=>score(b)-score(a))[0];
     fx.choose(selection);
    }else if(modal.type==='linked-picker'){
     const opts=[...links.modalMarkup().matchAll(/data-action="linked-option" data-id="([^"]+)"/g)].map(x=>x[1]);
     if(!opts.length){issue('Vínculo sin opciones elegibles.');modal=null;break}
     const isPlayer=opts.every(x=>game.states[x]);
     if(isPlayer)opts.sort((a,b)=>get(b).chips-get(a).chips);
     links.option(isPlayer&&my().difficulty!=='beginner'?opts[0]:opts[random(opts.length)]);
    }else{issue('Ventana no reconocida: '+modal.type);modal=null}
   }
   if(modal){issue('Límite de decisiones automáticas de efecto alcanzado.');modal=null}
  }
  function scoreCard(pid,card){
   const p=players.find(x=>x.id===pid),s=get(pid),c=code(card);
   let val=({'053':3,'011':2.4,'009':3.2,'029':4.3,'030':4,'035':4.7,'005':4.3,'042':4.3,'043':4.1,'044':4.5,'049':3.7,'040':3.4,'045':3.5,'061':3.3,'033':3.6})[c]||2;
   if(styleKeys[p.style].includes(c))val+=1.5;
   if(['040','045','046'].includes(c)&&s.pokerHand.some(x=>x.rank==='A'))val+=1;
   if(['061','062'].includes(c)&&s.pokerHand.some(x=>['J','Q','K'].includes(x.rank)))val+=1;
   if(c==='049'&&game.round<8)val+=1;
   if(p.difficulty==='expert'){val+=Math.min(1.8,s.pokerHand.length*0.15);
    if(c==='009'&&game.decks.some(x=>x.id!==pid&&get(x.id).chips>=10))val+=1.5}
   return val;
  }
  function legalHyper(pid,i){
   const s=get(pid),id=s.hand[i],c=code(id);
   if(!id||s.activeHyper.includes(i)||s.activeHyper.length>=3)return false;
   if(links.supported.has(c))return links.eligible(pid,i);
   const copies=s.activeHyper.filter(j=>s.hand[j]===id).length;
   if(copies>=(({'027':2})[c]||1))return false;
   const required=({'002':[1,2],'025':[0,2],'027':[1,1],'028':[0,2],'049':[1,2],'050':[1,1]})[c]||[0,0];
   return s.pokerHand.length>=required[1]&&s.hand.filter((_,j)=>j!==i&&!s.activeHyper.includes(j)).length>=required[0];
  }
  function selectAction(p){
   const s=get(p.id),available=[];
   for(let i=0;i<s.hand.length;i++){
    if(s.activeHyper.includes(i))continue;
    const id=s.hand[i],kind=cardType(getCard(id)),c=code(id);
    if(c==='003')continue; // Manipulador se juega legalmente como reacción al dado, no después.
    if(p.difficulty==='expert'){
      if(c==='045'&&s.pokerHand.filter(x=>x.rank==='A').length<(s.activeHyper.some(j=>code(s.hand[j])==='046')?1:2))continue;
      if(c==='061'&&s.pokerHand.filter(x=>['J','Q','K'].includes(x.rank)).length<(s.activeHyper.some(j=>code(s.hand[j])==='062')?1:3))continue;
    }
    if(kind==='HYPER'&&fx.supported(id)&&legalHyper(p.id,i))available.push({i,id,kind});
    else if(kind==='SUPER'&&fx.supported(id)&&fx.canPlay(id,p.id))available.push({i,id,kind});
   }
   if(!available.length)return null;
   if(p.difficulty==='beginner')return rng.next()<0.6?available[random(available.length)]:null;
   if(p.difficulty==='intermediate'&&rng.next()<0.19)return null;
   available.sort((a,b)=>scoreCard(p.id,b.id)-scoreCard(p.id,a.id));
   if(p.difficulty==='intermediate'&&available.length>1&&rng.next()<0.23)return available[1];
   return available[0];
  }
  function chooseCounter(pid,trigger,originalId){
   const p=players.find(x=>x.id===pid),s=get(pid),odds={beginner:0.15,intermediate:0.4,expert:0.72};
   if(rng.next()>(odds[p.difficulty]||0.4))return null;
   const list=s.hand.map((id,i)=>({id,i})).filter(x=>{if(s.activeHyper.includes(x.i)||cardType(getCard(x.id))!=='COUNTER'||!fx.canPlay(x.id,pid))return false;
    const c=code(x.id),victim=get(trigger);if(c==='004'&&cardType(getCard(originalId))!=='SUPER')return false;
    if(c==='048'&&victim.chips<1)return false;
    if(c==='052'&&!victim.activeHyper.length&&!['008','014','015','018','019','020','036'].includes(code(originalId)))return false;
    if(c==='064'&&cardType(getCard(originalId))!=='SUPER')return false;
    if(c==='006'&&victim.pokerHand.length===0)return false;
    return true;});
   const points={'033':8,'004':7,'052':5,'006':3,'064':3,'034':2,'048':2};
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
   log(pid,'Entendí la referencia','Reacción virtual: más rápido J'+times[0].p.playerNumber+', último J'+times[times.length-1].p.playerNumber+'.');
  }
  function playCard(p,i){
   const s=get(p.id),id=s.hand[i];if(!fx.canPlay(id,p.id))return false;
   const base=manual.take(p.id,i);if(!base)return false;fx.markUsed(id,p.id);
   const stack=[base];game.chain={stack};const other=players.filter(x=>x.id!==p.id);
   for(let j=0;j<other.length;j++){
    const op=other[j],counter=chooseCounter(op.id,p.id,id);
    if(counter){const item=manual.take(op.id,counter.i);fx.markUsed(item.cardId,op.id);stack.push(item);log(op.id,'CounterCard',getCard(item.cardId)?.name||item.cardId,getCard(item.cardId))}
   }
   const denied=new Set(),resolve=[];
   for(let j=stack.length-1;j>=0;j--){
    const item=stack[j],kind=code(item.cardId);
    if(denied.has(j)){log(item.playerId,'Efecto negado',getCard(item.cardId)?.name||item.cardId);continue}
    if(kind==='033'){if(j>0)denied.add(j-1);continue}
    if(kind==='024'){react(p.id);continue}
    resolve.push({...item,copyOrigin:base,originAllowed:!denied.has(0),triggerPlayerId:j>0?base.playerId:null,triggerCardId:j>0?base.cardId:null});
   }
   for(const item of stack)if(code(item.cardId)!=='040'||denied.has(stack.indexOf(item)))manual.giveBack(item.cardId,item.ownerId);
   for(const x of resolve)fx.enqueue(x);
   fx.finishChain();autoModal();game.chain=null;log(p.id,'Usar Power Card',getCard(id)?.name||id,getCard(id));return true;
  }
  function comboList(pid){
   const s=get(pid),hand=s.pokerHand,active=s.activeHyper.map(i=>s.hand[i]),results=[],max=Math.min(14,hand.length);
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
   const s=get(p.id);
   for(let n=0;n<8;n++){
    const groups=comboList(p.id);if(!groups.length)break;
    let pick;
    if(p.difficulty==='beginner'){if(rng.next()>0.67)break;pick=groups[random(groups.length)]}
    else{groups.sort((a,b)=>b.points-a.points);pick=p.difficulty==='intermediate'&&rng.next()<0.18?groups[Math.min(1,groups.length-1)]:groups[0]}
    const spent=pick.inds.map(i=>s.pokerHand[i]);
    links.onCharge(p.id,spent);
    for(const i of [...pick.inds].sort((a,b)=>b-a))s.pokerHand.splice(i,1);
    links.onPokerOut(p.id,spent);s.chips+=pick.points;s.chargeReplacement+=spent.length;
    log(p.id,'Cobro automático',pick.name+' +'+pick.points+' fichas con '+spent.map(x=>x.rank+'/'+x.suit).join(', '));
   }
  }
  function audit(){
   const physical=[...game.pokerDrawPile,...players.flatMap(p=>get(p.id).pokerHand)].filter(c=>!c.virtualPower);
   const unique=new Set(physical.map(c=>c.id));const expectedPhysical=52*(config.pokerDeckCount||1);
   if(physical.length!==expectedPhysical||unique.size!==expectedPhysical)issue('Integridad Poker: '+physical.length+' cartas físicas, '+unique.size+' identificadores únicos; se esperan '+expectedPhysical+'.');
   for(const p of players){
    const expected={};for(const id of p.cardIds)expected[id]=(expected[id]||0)+1;
    const actual={};
    for(const other of players){
     const st=get(other.id);
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
    if(s.turnsTaken>0){drawPower(p.id,3+(s.powerDrawBonus||0));links.phase('DRAW_END',p.id)}
    s.currentPhase='MAIN';fx.beginTurn(p.id);links.phase('MAIN_START',p.id);
    for(let j=0;j<8;j++){
     const choice=selectAction(p);if(!choice)break;
     if(choice.kind==='HYPER'){
      const before=s.activeHyper.filter(ix=>s.hand[ix]===choice.id).length;fx.activate(choice.i);autoModal();
      if(s.activeHyper.filter(ix=>s.hand[ix]===choice.id).length<=before){issue('HyperCard sin activación: '+choice.id);break}
      log(p.id,'HyperCard activada',getCard(choice.id)?.name||choice.id);
     }else if(!playCard(p,choice.i))break;
    }
    s.currentPhase='CHARGE';charge(p);
    s.currentPhase='END';fx.phase('END',p.id);links.phase('END',p.id);
    const cards=s.chargeReplacement||0;s.chargeReplacement=0;
    for(let k=0;k<cards;k++)drawPoker(p.id,s,'Reposición de cobro');
    const out=[];while(s.pokerHand.length>s.pokerLimit)out.push(s.pokerHand.splice(random(s.pokerHand.length),1)[0]);
    if(out.length)links.onPokerOut(p.id,out);
    while(s.hand.length-s.activeHyper.length>s.powerHandLimit)discardPower(p.id,1);
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
   players:ranking.map(p=>({id:p.id,name:p.name,deckId:p.sourceDeckId,difficulty:p.difficulty,style:p.style,chips:get(p.id).chips,
    events:game.histories[p.id],pokerHand:get(p.id).pokerHand.length,powerHand:get(p.id).hand.length-get(p.id).activeHyper.length,
    activeHyper:get(p.id).activeHyper.length,deckLeft:get(p.id).drawPile.length}))
  };
  onProgress?.({round:rounds,maxRounds,events:totals,finished:true});
  return result;
 }
 return {play};
};
