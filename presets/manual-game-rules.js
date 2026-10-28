/* Poker Blitz V1: manual rule validation, counter response windows and reaction game. */
window.POKER_BLITZ_MANUAL_RULES = function createManualRules(ctx){
  const get=()=>ctx.sim(),getMod=()=>ctx.modal(),setMod=v=>ctx.setModal(v);
  const own=(id)=>{const s=get()?.states?.[id];if(!s)return;
    if(!Array.isArray(s.handOwners)||s.handOwners.length!==s.hand.length)s.handOwners=s.hand.map(()=>id);
    if(!Array.isArray(s.drawOwners)||s.drawOwners.length!==s.drawPile.length)s.drawOwners=s.drawPile.map(()=>id);
  };
  const take=(id,index)=>{const s=get()?.states?.[id];if(!s||!Number.isInteger(index)||index<0||index>=s.hand.length)return null;own(id);
    if(get()?.mode==='ASSISTED')ctx.assistedLinkPowerTaken?.(id,index);
    const cardId=s.hand.splice(index,1)[0],ownerId=s.handOwners.splice(index,1)[0]||id;
    s.activeHyper=(s.activeHyper||[]).filter(i=>i!==index).map(i=>i>index?i-1:i);
    if(get()?.mode==='ASSISTED')ctx.assistedPowerRemoved?.(id);
    return {cardId,ownerId,playerId:id};
  };
  const giveBack=(cardId,ownerId)=>{const sim=get(),id=sim.states[ownerId]?ownerId:sim.decks[0].id,s=sim.states[id];own(id);
    if(ctx.type?.(ctx.card?.(cardId))==='HYPER'&&Array.isArray(s.hyperReserve)){
      if(!s.hyperReserve.includes(cardId))s.hyperReserve.push(cardId);
      return;
    }
    const combined=s.drawPile.map((cid,i)=>({cid,owner:s.drawOwners[i]||id}));combined.push({cid:cardId,owner:id});
    const shuffled=ctx.shuffle(combined);s.drawPile=shuffled.map(x=>x.cid);s.drawOwners=shuffled.map(x=>x.owner);
  };
  const canAct=()=>!!get()&&!get().finished&&!get().chain&&!get().pendingHyper&&!get().pendingShield&&get().activeIndex===(get().turnIndex??0);
  function scoreCombo(type,cards,hyper){
    const score={Par:1,'Trío':3,Escalera:5,Color:5,'Póker':7}[type]||0,needed={Par:2,'Trío':3,Escalera:5,Color:5,'Póker':4}[type];
    if(!score||cards.length!==needed||cards.some(c=>!c))return 0;
    const ranks=cards.map(c=>c.rank),suits=cards.map(c=>c.suit),sameRank=ranks.every(x=>x===ranks[0]),sameSuit=suits.every(x=>x===suits[0]);
    const numbers=ranks.map(r=>({A:14,J:11,Q:12,K:13})[r]||Number(r)).sort((a,b)=>a-b);
    const straight=numbers.length===5&&new Set(numbers).size===5&&(numbers[4]-numbers[0]===4||numbers.join(',')==='2,3,4,5,14');
    if(!(type==='Par'||type==='Trío'||type==='Póker'?sameRank:type==='Color'?sameSuit:straight))return 0;
    if(hyper.includes('catalog_v3_046')&&!ranks.includes('A'))return 0;
    if(hyper.includes('catalog_v3_062')&&!ranks.some(r=>['J','Q','K'].includes(r)))return 0;
    return score;
  }
  // La selección, no un botón por tipo, determina la combinación cobrable.
  function detectCharge(){
    const game=get();if(!game||!canAct())return null;
    const {d,s}=ctx.current();
    const indices=[...new Set(game.chargeSelection||[])].sort((a,b)=>a-b);
    const cards=indices.map(i=>s.pokerHand[i]);
    if(cards.length<2||cards.length>5||cards.some(c=>!c))return null;
    const hyper=(s.activeHyper||[]).map(i=>s.hand[i]);
    for(const type of ['Par','Trío','Póker','Escalera','Color']){
      const points=game.mode==='ASSISTED'&&ctx.assistedScore?ctx.assistedScore(d.id,type,cards,hyper):scoreCombo(type,cards,hyper);
      if(points>0)return {type,points,indices,cards};
    }
    return null;
  }
  function charge(type){
    if(!canAct())return ctx.toast('Acción permitida solo en el turno actual.');
    const sim=get(),{d,s}=ctx.current();if(s.currentPhase!=='MAIN')return ctx.toast('Solo puedes cobrar durante tu turno.');
    if(type==='AUTO'){const match=detectCharge();if(!match)return ctx.toast('Selecciona una combinación válida para cobrar.');type=match.type;}
    const indices=[...new Set(sim.chargeSelection||[])].sort((a,b)=>a-b),cards=indices.map(i=>s.pokerHand[i]);
    const hyper=(s.activeHyper||[]).map(i=>s.hand[i]),points=sim.mode==='ASSISTED'&&ctx.assistedScore?ctx.assistedScore(d.id,type,cards,hyper):scoreCombo(type,cards,hyper);
    if(!points)return ctx.toast('La selección no constituye una combinación válida o incumple una restricción activa.');
    ctx.pushUndo(d.id,'Cobro '+type);if(sim.mode==='ASSISTED')ctx.assistedChargeBonus?.(d.id,cards,type,points);
    for(const i of [...indices].reverse())s.pokerHand.splice(i,1);
    if(Array.isArray(s.manualEnchantedIds))s.manualEnchantedIds=s.manualEnchantedIds.filter(id=>!cards.some(card=>card.id===id));
    if(sim.mode==='ASSISTED')ctx.assistedPokerOut?.(d.id,cards);
    else sim.pokerDrawPile=ctx.shuffle([...sim.pokerDrawPile,...cards]);
    s.chips=(s.chips||0)+points;s.chargeReplacement=(s.chargeReplacement||0)+cards.length;
    ctx.log(d.id,'Cobro validado',type+' +'+points+' fichas con '+cards.map(c=>c.rank+' de '+c.suit).join(', ')+'. Sin reposición inmediata: '+cards.length+'.');
    sim.result=type+': +'+points+' fichas. Total '+s.chips;sim.chargeSelection=[];ctx.render();
  }
  function changePhase(to){
    if(to!=='MAIN')return ctx.toast('El turno es una única Main Phase. Cobra y juega cartas libremente.');
  }
  function finishTurn(){
    if(!canAct())return;
    const sim=get(),{d,s}=ctx.current();
    if(sim.chain||sim.pendingHyper||sim.pendingShield)return ctx.toast('Resuelve la respuesta pendiente antes de terminar el turno.');
    if(s.currentPhase!=='MAIN')return ctx.toast('Solo puedes finalizar tu turno.');
    ctx.pushUndo(d.id,'Cierre del turno');
    const missing=sim.mode==='MANUAL_SIMPLE'?0:Math.max(0,7-s.pokerHand.length);let replenished=0;
    for(let k=0;k<missing&&sim.pokerDrawPile.length;k++)if(ctx.drawPoker(d.id,s,'Reposición al final del turno'))replenished++;
    ctx.log(d.id,'Reposición final','Robó '+replenished+' Poker Cards para completar 7, incluidas las encantadas.');
    if(sim.mode==='ASSISTED'){ctx.assistedPhase?.('END',d.id);ctx.assistedPhase?.('END_COMPLETE',d.id);}
     // HyperCards activas vuelven a su HyperZone, boca abajo, al final de End Phase.
     for(const i of [...(s.activeHyper||[])].sort((a,b)=>b-a)){
       const it=take(d.id,i);if(it)giveBack(it.cardId,it.ownerId);
     }
     s.hyperActivationsThisTurn=0;s.usedHyperThisTurn=[];s.hyperDeniedThisTurn=[];s.manualEnchantedIds=[];s.shieldCardsTriggered=false;s.destinyDieUsed=false;s.usedSuperThisTurn=false;
    s.turnsTaken=(s.turnsTaken||0)+1;ctx.log(d.id,'Fin de turno','Turno '+s.turnsTaken+' completado. Fichas: '+s.chips+'.');
    sim.chargeSelection=[];
    const active=()=>sim.decks.filter(p=>!sim.tieContenders||sim.tieContenders.includes(p.id));
    if(active().at(-1)?.id===d.id){
      if(sim.mode==='ASSISTED')ctx.assistedRound?.();
      const goal=sim.goal||30,participants=active(),qualified=participants.filter(p=>sim.states[p.id].chips>=goal);
      if(sim.tieContenders)sim.tieRounds=(sim.tieRounds||0)+1;
      if(qualified.length){
        const top=Math.max(...qualified.map(p=>sim.states[p.id].chips));
        const leaders=qualified.filter(p=>sim.states[p.id].chips===top);
        if(leaders.length===1){
          sim.finished=true;sim.winnerIds=[leaders[0].id];
          sim.result='Fin de ronda. Ganó J'+leaders[0].playerNumber;
          for(const p of sim.decks)ctx.log(p.id,'Resultado',sim.result);ctx.render();return;
        }
        if(!sim.tieContenders){
          sim.tieContenders=leaders.map(p=>p.id);sim.tieRounds=0;
          ctx.log(d.id,'Desempate','Solo los jugadores '+leaders.map(p=>'J'+p.playerNumber).join(', ')+
            ' continúan hasta tres rondas adicionales.');
        }
      }
      if(sim.tieContenders&&(sim.tieRounds||0)>=3){
        sim.finished=true;sim.winnerIds=[...sim.tieContenders];
        sim.result='Empate total tras tres rondas adicionales entre '+active().map(p=>'J'+p.playerNumber).join(', ');
        for(const p of sim.decks)ctx.log(p.id,'Resultado',sim.result);ctx.render();return;
      }
      sim.round=(sim.round||1)+1;
    }
    const eligible=active(),current=eligible.findIndex(p=>p.id===d.id);
    const following=eligible[(current+1+eligible.length)%eligible.length];
    sim.turnIndex=sim.decks.findIndex(p=>p.id===following.id);sim.activeIndex=sim.turnIndex;
    sim.undoStacks[following.id]=[]; // Cada turno tiene un historial de deshacer independiente, sin límite interno.
    const p=sim.decks[sim.turnIndex],next=sim.states[p.id];
    if((next.turnsTaken||0)>0)ctx.drawPhase(p,next);
    else{next.currentPhase='MAIN';ctx.log(p.id,'Primer turno','La mano inicial ya contiene 4 Power Cards.');}
    if(sim.mode==='ASSISTED')ctx.assistedPhase?.('MAIN_START',p.id);
    sim.result='Ronda '+sim.round+' · Turno de J'+p.playerNumber;ctx.render();
  }
  function useCard(playerId,index){
    if(!canAct())return;
    const sim=get(),s=sim.states[playerId],card=ctx.card(s.hand[index]),type=ctx.type(card);
    if(!card||type==='HYPER')return;
    if(type==='SUPER'&&s.currentPhase!=='MAIN')return ctx.toast('La SuperCard debe jugarse en Main Phase.');
    if(type==='COUNTER')return ctx.toast('Las CounterCards se juegan desde el personaje que responde durante el turno rival.');
    
    if(sim.mode==='MANUAL_SIMPLE'){
      ctx.pushUndo(playerId,'Power Card física: uso manual');const item=take(playerId,index);
      if(!item)return;giveBack(item.cardId,item.ownerId);s.usedSuperThisTurn=true;
      ctx.log(playerId,'Usar '+ctx.type(card),'Uso manual sin ventana de CounterCards. Aplica el efecto sobre las cartas físicas si corresponde.',card);
      sim.result='Power Card usada: '+card.name;ctx.render();return;
    }
    if(sim.mode==='ASSISTED'&&ctx.canAssist&&!ctx.canAssist(s.hand[index]))return ctx.toast('Este efecto todavía no está implementado en Prueba Asistida. La carta permanece en mano.');
    if(sim.mode==='ASSISTED'&&ctx.canPlayAssisted&&!ctx.canPlayAssisted(s.hand[index],playerId))return ctx.toast('No se cumplen los costes o el límite de usos de esta carta.');
    // An atomic undo snapshot avoids corrupting other players' hands.
    ctx.pushUndo(playerId,'SuperCard anunciada',true);
    const item=take(playerId,index);
    if(!item)return;s.usedSuperThisTurn=true;
    if(sim.mode==='ASSISTED')ctx.assistedCardUsed?.(item.cardId,playerId);
    sim.chain={stack:[item],chooser:(sim.turnIndex+1)%sim.decks.length,passes:0};
    ctx.log(playerId,'Activación anunciada','La SuperCard espera respuestas desde las manos de los rivales.',card);
    if(sim.decks.length===1||ctx.hasCounterResponders&&!ctx.hasCounterResponders())resolveChain();
    else{sim.result='SuperCard anunciada: '+card.name+' · Los rivales pueden responder con sus CounterCards.';ctx.render();}
  }
  function counterPlay(index,playerId){
    const sim=get(),chain=sim?.chain;if(!chain||chain.stack.length>1)return false;
    const respondingId=playerId||sim.decks[chain.chooser]?.id;
    const p=sim.decks.find(p=>p.id===respondingId);
    if(!p||p.id===sim.decks[sim.turnIndex]?.id)return false;
    const c=ctx.card(sim.states[p.id].hand[index]);
    if(ctx.type(c)!=='COUNTER'||ctx.canCounter&&!ctx.canCounter(p.id,c.id))return false;
    if(sim.mode==='ASSISTED'&&((ctx.canAssist&&!ctx.canAssist(c?.id))||(ctx.canPlayAssisted&&!ctx.canPlayAssisted(c?.id,p.id))))return false;
    if(sim.mode==='ASSISTED')ctx.assistedCardUsed?.(c.id,p.id);
    ctx.pushUndo(sim.decks[sim.turnIndex].id,'CounterCard de J'+p.playerNumber);
    const item=take(p.id,index);if(!item)return false;
    chain.stack.push(item);
    ctx.log(p.id,'CounterCard anunciada','J'+p.playerNumber+' respondió a la SuperCard con '+c.name+'. Solo se permite una respuesta.',c);
    if(sim.mode==='ASSISTED')ctx.assistedCounterPlayed?.(chain.stack[0].playerId,p.id,c?.id);
    resolveChain();return true;
  }
  function counterPass(){
    if(!get()?.chain)return;
    ctx.log(get().decks[get().turnIndex].id,'Sin CounterCards','La SuperCard se resuelve sin respuesta de los rivales.');
    resolveChain();
  }
  function resolveChain(){
    const sim=get(),chain=sim?.chain;if(!chain)return;
    const denied=new Set();
    for(let i=chain.stack.length-1;i>=0;i--){
      const item=chain.stack[i],c=ctx.card(item.cardId);
      if(!denied.has(i)&&item.cardId==='catalog_v3_033'&&i>0)denied.add(i-1);
      if(denied.has(i))ctx.log(item.playerId,'Efecto negado',c?.name+' fue cancelada por la cadena.',c);
      else if(sim.mode==='ASSISTED'){
        ctx.log(item.playerId,'Efecto autorizado','Resolución asistida: '+(c?.name||'carta')+'.',c);
        if(item.cardId!=='catalog_v3_024'&&item.cardId!=='catalog_v3_033')ctx.assistedResolved?.({...item,copyOrigin:chain.stack[0],originAllowed:!denied.has(0)});
      }else ctx.log(item.playerId,'Efecto autorizado','Aplica manualmente '+(c?.name||'la carta')+' con las herramientas de prueba.',c);
      if(!(sim.mode==='ASSISTED'&&item.cardId==='catalog_v3_040'&&!denied.has(i)))giveBack(item.cardId,item.ownerId);
    }
    const special=chain.stack[0],reference=special.cardId==='catalog_v3_024'&&!denied.has(0);
    sim.chain=null;sim.activeIndex=sim.turnIndex;setMod(null);sim.result=sim.mode==='ASSISTED'?'Cadena resuelta; aplicando efectos.':'Cadena resuelta. Ejecuta manualmente los efectos permitidos.';
    if(reference)startReference(special.playerId);
    else if(sim.mode==='ASSISTED')ctx.assistedChainComplete?.();
    else ctx.render();
  }
  function startReference(actorId){
    const sim=get(),participants=sim.decks.filter(p=>p.id!==actorId).map(p=>p.id);
    if(!participants.length){ctx.log(actorId,'Entendí la referencia','Sin participantes para el concurso.');ctx.render();return;}
    if(!sim.pokerDrawPile.length){ctx.log(actorId,'Entendí la referencia','No hay Poker Cards para revelar.');ctx.render();return;}
    sim.reference={actorId,participants,order:[],revealed:sim.pokerDrawPile.pop(),step:'react'};
    setMod({type:'reference-reaction'});ctx.render();
  }
  function pressReference(playerId){
    const sim=get(),r=sim?.reference;if(!r||r.step!=='react'||!r.participants.includes(playerId)||r.order.includes(playerId))return;
    r.order.push(playerId);ctx.log(playerId,'Entendí la referencia','Reacción: posición '+r.order.length+' de '+r.participants.length+'.');
    if(r.order.length===r.participants.length){
      r.first=r.order[0];r.last=r.order.at(-1);
      sim.states[r.first].pokerHand.push(r.revealed);
      ctx.log(r.first,'Premio de reacción','Obtuvo '+r.revealed.rank+' de '+r.revealed.suit+'.');
      r.step='discard';
    }
    ctx.render();
  }
  function discardReference(i){
    const sim=get(),r=sim?.reference;if(!r||r.step!=='discard')return;
    const s=sim.states[r.last];if(s.pokerHand.length&&(!Number.isInteger(i)||i<0||i>=s.pokerHand.length))return ctx.toast('Selecciona una Poker Card.');
    if(s.pokerHand.length){const [c]=s.pokerHand.splice(i,1);if(sim.mode==='ASSISTED')ctx.assistedPokerOut?.(r.last,[c]);else sim.pokerDrawPile=ctx.shuffle([...sim.pokerDrawPile,c]);ctx.log(r.last,'Penalización de reacción','Descartó '+c.rank+' de '+c.suit+'.')}
    ctx.log(r.actorId,'Entendí la referencia','Primero: J'+sim.decks.find(p=>p.id===r.first).playerNumber+'. Último: J'+sim.decks.find(p=>p.id===r.last).playerNumber+'.');
    sim.reference=null;setMod(null);sim.result='Concurso de reacción resuelto.';if(sim.mode==='ASSISTED')ctx.assistedChainComplete?.();else ctx.render();
  }
  function modalMarkup(){
    const sim=get(),modal=getMod();if(!sim||!modal)return'';
    if(modal.type==='reference-reaction'&&sim.reference){
      const r=sim.reference;
      if(r.step==='react'){
        const buttons=r.participants.map(id=>{const p=sim.decks.find(x=>x.id===id),hit=r.order.includes(id);return '<button class="btn '+(hit?'':'primary')+'" data-action="reference-press" data-player="'+id+'" '+(hit?'disabled':'')+'>J'+p.playerNumber+' · '+ctx.esc(p.name)+(hit?' ✓':' · REACCIONAR')+'</button>'}).join('');
        return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>¡Entendí la referencia!</h2></div><div class="modal-content"><p>Una Poker Card revelada: <strong>'+r.revealed.rank+' de '+r.revealed.suit+'</strong>.</p><p>Pulsa el botón de cada rival cuando reaccione. El primero roba la carta revelada y el último debe descartar una Poker Card.</p><div style="display:flex;gap:10px;flex-wrap:wrap">'+buttons+'</div><p>Reacciones: '+r.order.length+'/'+r.participants.length+'</p></div></div></div>';
      }
      const loser=sim.decks.find(x=>x.id===r.last),st=sim.states[r.last],buttons=st.pokerHand.map((c,i)=>'<button class="btn" data-action="reference-discard" data-index="'+i+'">Descartar '+c.rank+' de '+c.suit+'</button>').join('');
      return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>Penalización de reacción</h2></div><div class="modal-content"><p>J'+loser.playerNumber+' ('+ctx.esc(loser.name)+') fue el último en reaccionar. Selecciona la Poker Card que descartará.</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+(buttons||'<button class="btn" data-action="reference-discard" data-index="-1">Sin cartas para descartar</button>')+'</div></div></div></div>';
    }
    return'';
  }
  return {own,take,giveBack,canAct,detectCharge,charge,changePhase,finishTurn,useCard,counterPlay,counterPass,pressReference,discardReference,modalMarkup};
};
