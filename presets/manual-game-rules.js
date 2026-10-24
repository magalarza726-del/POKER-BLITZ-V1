/* Poker Blitz V1: manual rule validation, counter response windows and reaction game. */
window.POKER_BLITZ_MANUAL_RULES = function createManualRules(ctx){
  const get=()=>ctx.sim(),getMod=()=>ctx.modal(),setMod=v=>ctx.setModal(v);
  const own=(id)=>{const s=get()?.states?.[id];if(!s)return;
    if(!Array.isArray(s.handOwners)||s.handOwners.length!==s.hand.length)s.handOwners=s.hand.map(()=>id);
    if(!Array.isArray(s.drawOwners)||s.drawOwners.length!==s.drawPile.length)s.drawOwners=s.drawPile.map(()=>id);
  };
  const take=(id,index)=>{const s=get()?.states?.[id];if(!s||!Number.isInteger(index)||index<0||index>=s.hand.length)return null;own(id);
    const cardId=s.hand.splice(index,1)[0],ownerId=s.handOwners.splice(index,1)[0]||id;
    s.activeHyper=(s.activeHyper||[]).filter(i=>i!==index).map(i=>i>index?i-1:i);
    return {cardId,ownerId,playerId:id};
  };
  const giveBack=(cardId,ownerId)=>{const sim=get(),id=sim.states[ownerId]?ownerId:sim.decks[0].id,s=sim.states[id];own(id);
    const combined=s.drawPile.map((cid,i)=>({cid,owner:s.drawOwners[i]||id}));combined.push({cid:cardId,owner:id});
    const shuffled=ctx.shuffle(combined);s.drawPile=shuffled.map(x=>x.cid);s.drawOwners=shuffled.map(x=>x.owner);
  };
  const canAct=()=>!!get()&&!get().finished&&get().activeIndex===(get().turnIndex??0);
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
  function charge(type){
    if(!canAct())return ctx.toast('Acción permitida solo en el turno actual.');
    const sim=get(),{d,s}=ctx.current();if(s.currentPhase!=='CHARGE')return ctx.toast('Solo puedes cobrar durante Charge Phase.');
    const indices=[...new Set(sim.chargeSelection||[])].sort((a,b)=>a-b),cards=indices.map(i=>s.pokerHand[i]);
    const hyper=(s.activeHyper||[]).map(i=>s.hand[i]),points=scoreCombo(type,cards,hyper);
    if(!points)return ctx.toast('La selección no constituye una combinación válida o incumple una restricción activa.');
    ctx.pushUndo(d.id,'Cobro '+type);for(const i of [...indices].reverse())s.pokerHand.splice(i,1);
    sim.pokerDrawPile=ctx.shuffle([...sim.pokerDrawPile,...cards]);s.chips=(s.chips||0)+points;s.chargeReplacement=(s.chargeReplacement||0)+cards.length;
    ctx.log(d.id,'Cobro validado',type+' +'+points+' fichas con '+cards.map(c=>c.rank+' de '+c.suit).join(', ')+'. Reposición End Phase: '+cards.length+'.');
    sim.result=type+': +'+points+' fichas. Total '+s.chips;sim.chargeSelection=[];ctx.render();
  }
  function changePhase(to){
    if(!canAct())return ctx.toast('Primero vuelve al jugador del turno.');
    const sim=get(),{d,s}=ctx.current(),from=s.currentPhase;
    if(to===from)return;
    if(!(from==='MAIN'&&to==='CHARGE'||from==='CHARGE'&&to==='END'))return ctx.toast('Secuencia obligatoria: Main → Charge → End → Finalizar turno.');
    ctx.pushUndo(d.id,'Fase '+to);s.currentPhase=to;sim.chargeSelection=[];
    if(to==='END'){
      const qty=s.chargeReplacement||0;s.chargeReplacement=0;let drawn=0;
      for(let i=0;i<qty&&sim.pokerDrawPile.length;i++){if(ctx.drawPoker(d.id,s,'Reposición de Charge'))drawn++}
      ctx.log(d.id,'Inicio End Phase','Se repusieron '+drawn+'/'+qty+' Poker Cards por combinaciones cobradas. Resuelve efectos de End Phase y ajusta la mano.');
    }
    ctx.log(d.id,'Cambiar fase',ctx.phaseLabel(from)+' → '+ctx.phaseLabel(to)+'.');
    sim.result=ctx.phaseLabel(to);ctx.render();
  }
  function finishTurn(){
    if(!canAct())return;
    const sim=get(),{d,s}=ctx.current();
    if(s.currentPhase!=='END')return ctx.toast('Todavía no estás en End Phase.');
    if(s.pokerHand.length>s.pokerLimit)return ctx.toast('Descarta '+(s.pokerHand.length-s.pokerLimit)+' Poker Cards antes de continuar.');
    s.turnsTaken=(s.turnsTaken||0)+1;ctx.log(d.id,'Fin de turno','Turno '+s.turnsTaken+' completado. Fichas: '+s.chips+'.');
    sim.chargeSelection=[];
    if(sim.turnIndex===sim.decks.length-1){
      const goal=sim.goal||30,players=sim.decks;if(players.some(p=>sim.states[p.id].chips>=goal)){
        const best=Math.max(...players.map(p=>sim.states[p.id].chips)),winners=players.filter(p=>sim.states[p.id].chips===best);
        sim.finished=true;sim.result='Fin de ronda. '+(winners.length===1?'Ganó J'+winners[0].playerNumber:'Empate: '+winners.map(p=>'J'+p.playerNumber).join(', '));
        for(const p of players)ctx.log(p.id,'Resultado',sim.result);ctx.render();return;
      }
      sim.round=(sim.round||1)+1;
    }
    sim.turnIndex=(sim.turnIndex+1)%sim.decks.length;sim.activeIndex=sim.turnIndex;
    const p=sim.decks[sim.turnIndex],next=sim.states[p.id];
    if((next.turnsTaken||0)>0)ctx.drawPhase(p,next);
    else{next.currentPhase='MAIN';ctx.log(p.id,'Primer turno','Se omite la Draw Phase del primer turno.')}
    sim.result='Ronda '+sim.round+' · Turno de J'+p.playerNumber;ctx.render();
  }
  function useCard(playerId,index){
    if(!canAct())return;
    const sim=get(),s=sim.states[playerId],card=ctx.card(s.hand[index]),type=ctx.type(card);
    if(!card||type==='HYPER')return;
    if(type==='SUPER'&&s.currentPhase!=='MAIN')return ctx.toast('La SuperCard debe jugarse en Main Phase.');
    if(type==='COUNTER'&&s.currentPhase!=='END')return ctx.toast('Responde con CounterCards desde la ventana de respuesta, o durante tu End Phase.');
    // An atomic undo snapshot avoids corrupting other players' hands.
    sim.undoStacks=Object.fromEntries(sim.decks.map(p=>[p.id,[]]));
    const states=Object.fromEntries(sim.decks.map(p=>[p.id,structuredClone(sim.states[p.id])]));
    const lens=Object.fromEntries(sim.decks.map(p=>[p.id,(sim.histories[p.id]||[]).length]));
    const poker=structuredClone(sim.pokerDrawPile),item=take(playerId,index);
    sim.undoStacks[playerId].push({label:'Cadena',tradeStates:states,tradeHistoryLengths:lens,tradePokerDrawPile:poker,result:sim.result});
    sim.chain={stack:[item],chooser:(sim.turnIndex+1)%sim.decks.length,passes:0};
    ctx.log(playerId,'Activación anunciada','Carta en espera de posibles CounterCards.',card);
    if(sim.decks.length===1)resolveChain();else{setMod({type:'counter-window'});ctx.render();}
  }
  function counterPlay(i){
    const sim=get(),chain=sim?.chain;if(!chain)return;
    const p=sim.decks[chain.chooser],c=ctx.card(sim.states[p.id].hand[i]);
    if(ctx.type(c)!=='COUNTER')return;
    chain.stack.push(take(p.id,i));chain.passes=0;chain.chooser=(chain.chooser+1)%sim.decks.length;
    ctx.log(p.id,'CounterCard anunciada','Añadida a la cadena de respuestas.',c);ctx.render();
  }
  function counterPass(){
    const sim=get(),chain=sim?.chain;if(!chain)return;
    chain.passes++;chain.chooser=(chain.chooser+1)%sim.decks.length;
    if(chain.passes>=sim.decks.length-1)resolveChain();else ctx.render();
  }
  function resolveChain(){
    const sim=get(),chain=sim?.chain;if(!chain)return;
    const denied=new Set();
    for(let i=chain.stack.length-1;i>=0;i--){
      const item=chain.stack[i],c=ctx.card(item.cardId);
      if(!denied.has(i)&&item.cardId==='catalog_v3_033'&&i>0)denied.add(i-1);
      if(denied.has(i))ctx.log(item.playerId,'Efecto negado',c?.name+' fue cancelada por la cadena.',c);
      else ctx.log(item.playerId,'Efecto autorizado','Aplica manualmente '+(c?.name||'la carta')+' con las herramientas de prueba.',c);
      giveBack(item.cardId,item.ownerId);
    }
    const special=chain.stack[0],reference=special.cardId==='catalog_v3_024'&&!denied.has(0);
    sim.chain=null;setMod(null);sim.result='Cadena resuelta. Ejecuta manualmente los efectos permitidos.';
    if(reference)startReference(special.playerId);else ctx.render();
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
    if(s.pokerHand.length){const [c]=s.pokerHand.splice(i,1);sim.pokerDrawPile=ctx.shuffle([...sim.pokerDrawPile,c]);ctx.log(r.last,'Penalización de reacción','Descartó '+c.rank+' de '+c.suit+'.')}
    ctx.log(r.actorId,'Entendí la referencia','Primero: J'+sim.decks.find(p=>p.id===r.first).playerNumber+'. Último: J'+sim.decks.find(p=>p.id===r.last).playerNumber+'.');
    sim.reference=null;setMod(null);sim.result='Concurso de reacción resuelto.';ctx.render();
  }
  function modalMarkup(){
    const sim=get(),modal=getMod();if(!sim||!modal)return'';
    if(modal.type==='counter-window'&&sim.chain){
      const p=sim.decks[sim.chain.chooser],s=sim.states[p.id];
      const options=s.hand.map((id,i)=>({c:ctx.card(id),i})).filter(x=>ctx.type(x.c)==='COUNTER');
      const cards=options.map(x=>'<button class="btn" data-action="counter-play" data-index="'+x.i+'">'+ctx.esc(x.c.name)+'</button>').join('');
      return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>Ventana de CounterCards</h2></div><div class="modal-content"><p>Respuesta de <b>J'+p.playerNumber+' · '+ctx.esc(p.name)+'</b>. Cadena: '+sim.chain.stack.map(x=>ctx.esc(ctx.card(x.cardId)?.name||'Carta')).join(' → ')+'</p><p>Las respuestas se resuelven de la última a la primera. Los efectos autorizados seguirán aplicándose manualmente.</p><div style="display:flex;gap:10px;flex-wrap:wrap">'+cards+'</div><button class="btn primary" data-action="counter-pass">Pasar / No responder</button></div></div></div>';
    }
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
  return {own,take,giveBack,canAct,charge,changePhase,finishTurn,useCard,counterPlay,counterPass,pressReference,discardReference,modalMarkup};
};
