/* Persistent Poker/Power card bindings and 13 previously unsupported effects */
window.POKER_BLITZ_ASSISTED_LINKS=function linkedEngine(ctx){
  const game=()=>ctx.sim(),state=id=>game().states[id], code=id=>String(id||'').slice(-3);
  const artifacts=new Set(['042','043','044','058','059','060']);
  const supported=new Set(['001','029','030','035','040',...artifacts]);
  let pending=null,offenseQueue=[];
  const bonds=id=>state(id).assistedBindings??=([]);
  const log=(pid,id,msg)=>ctx.log(pid,'Efecto vinculado',msg,ctx.card('catalog_v3_'+id)||null);
  const serial=()=>game().assistedSerial=(game().assistedSerial||0)+1;
  const virtual=c=>!!c?.virtualPower;
  const refs=(pid,c)=>bonds(pid).filter(b=>b.targets?.includes(c.id)||b.virtualId===c.id);
  const protectedCard=(pid,c)=>refs(pid,c).some(b=>['029','030','035','040','042','043','044'].includes(b.type));
  function prices(t){return { '001':[0,0],'029':[0,0],'030':[0,0],'035':[0,3]}[t]||[0,0]}
  function eligible(pid,index){
    const s=state(pid);if(!s||s.currentPhase!=='MAIN'||s.activeHyper.includes(index)||s.activeHyper.length>=3)return false;
    const t=code(s.hand[index]);if(!supported.has(t)||['004','005','040'].includes(t))return false;
    // Oficial §6: el encantamiento debe activarse antes de usar la primera SuperCard.
    if(['029','030','035','042','043','044'].includes(t)&&(s.assistedPlayedSupers||[]).length)return false;
    const count=bonds(pid).filter(b=>b.type===t).length;
    if(count>=1)return false;
    const [pow,pok]=prices(t),free=s.hand.filter((_,i)=>i!==index&&!s.activeHyper.includes(i)).length;
    if(free<pow||s.pokerHand.filter(c=>!protectedCard(pid,c)).length<pok)return false;
    // El Simbionte y Cambio de Color permiten activar con coste 0 y 0 objetivos.
   if(t==='035'&&s.pokerHand.length<4)return false;
    if(artifacts.has(t)&&!s.pokerHand.some(c=>!virtual(c)))return false;
    return true;
  }
  function open(index){
    const pid=game().decks[game().activeIndex].id,s=state(pid),t=code(s.hand[index]);
    if(!eligible(pid,index)){ctx.toast('No se cumplen costes, límite de HyperCards o requisitos del vínculo.');return}
    if(t==='029'||t==='030'){
      const power=s.hand.filter((_,i)=>i!==index&&!s.activeHyper.includes(i)).length;
      const poker=s.pokerHand.filter(c=>!virtual(c)&&!protectedCard(pid,c)).length;
      pending={kind:'hyper-quantity',pid,index,type:t,needed:0,selected:[],maxCost:Math.min(2,power,poker)};
      ctx.setModal({type:'linked-picker'});ctx.render();return;
    }
    const needed=t==='001'?0:1;
    if(!needed)return activate(pid,index,[]);
    pending={kind:'hyper',pid,index,type:t,needed,selected:[]};ctx.setModal({type:'linked-picker'});ctx.render();
  }
  function recyclePoker(pid,removed){
    for(const c of removed){
      if(!virtual(c)){if(c.originalRank!==undefined){c.rank=c.originalRank;delete c.originalRank;}game().pokerDrawPile.push(c);}
      else if(c.virtualPower.type==='SABUESO'){ctx.manual().giveBack(c.virtualPower.cardId,c.virtualPower.owner);log(pid,'040','Sabueso de Ases salió de Poker Hand y regresó al Power Deck.')}
      else{
        const b=bonds(pid).find(b=>b.token===c.virtualPower.token);
        if(b)detach(pid,b,'Comodín utilizado o descartado.',true);
      }
    }
    game().pokerDrawPile=ctx.shuffle(game().pokerDrawPile);
  }
  function detach(pid,b,why,returnCard){
    const s=state(pid);s.assistedBindings=bonds(pid).filter(x=>x.token!==b.token);
    if(b.virtualId){for(const player of game().decks){const hand=state(player.id).pokerHand,i=hand.findIndex(c=>c.id===b.virtualId);if(i>=0)hand.splice(i,1);}}
    if(returnCard&&s.activeHyper.includes(b.index)&&s.hand[b.index]===b.cardId){
      const x=ctx.manual().take(pid,b.index);if(x)ctx.manual().giveBack(x.cardId,x.ownerId);
    }
    ctx.recalc(pid);log(pid,b.type,why);
  }
  function onPowerTake(pid,index){
    if(!game()||game().mode!=='ASSISTED')return;
    for(const b of [...bonds(pid)]){
      if(b.index===index)detach(pid,b,'HyperCard retirada: vínculo desactivado.',false);
      else if(b.index>index)b.index--;
    }
  }
  function cleanup(){
    if(!game()||game().mode!=='ASSISTED')return;
    for(const player of game().decks){
      const s=state(player.id);
      for(const b of [...bonds(player.id)]){
        const ids=new Set(s.pokerHand.map(c=>c.id));
        if(b.targets.length&&!b.targets.every(x=>ids.has(x)))detach(player.id,b,'Poker Card vinculada abandonó la mano; HyperCard devuelta.',true);
        else if(b.virtualId&&!ids.has(b.virtualId))detach(player.id,b,'Comodín abandonó la mano; HyperCard devuelta.',true);
      }
    }
  }
  function onPokerOut(pid,removed){recyclePoker(pid,removed);cleanup()}
  function activate(pid,index,selected,powerCost=null,paymentSlots=null){
    if(!eligible(pid,index))return;
    const s=state(pid),t=code(s.hand[index]),id=s.hand[index], [defaultPower,hc]=prices(t);
    const variable=['029','030'].includes(t);
    const pc=variable?Number(powerCost):defaultPower;
    if(variable&&(
      !Number.isInteger(pc)||pc<0||pc>2||selected.length!==pc||
      !Array.isArray(paymentSlots)||paymentSlots.length!==pc||new Set(selected).size!==pc
    )){ctx.toast('El coste debe ser de 0 a 2 Power Cards, encantando la misma cantidad de Poker Cards diferentes.');return;}
    if(hc>s.pokerHand.filter(c=>!selected.includes(c.id)&&!protectedCard(pid,c)).length){ctx.toast('Debes conservar las Poker Cards vinculadas para pagar el coste.');return}
    if(pc>s.hand.filter((_,j)=>j!==index&&!s.activeHyper.includes(j)).length){ctx.toast('No hay Power Cards suficientes para pagar el coste elegido.');return;}
    if(paymentSlots&&(
      paymentSlots.length!==pc||new Set(paymentSlots).size!==pc||
      paymentSlots.some(j=>!Number.isInteger(j)||j<0||j>=s.hand.length||j===index||s.activeHyper.includes(j))
    )){ctx.toast('Las Power Cards elegidas como coste no están disponibles.');return;}
    if(selected.some(id=>!s.pokerHand.some(c=>c.id===id&&!virtual(c)&&!protectedCard(pid,c)))){ctx.toast('Los objetivos del encantamiento ya no están disponibles.');return;}
    ctx.pushUndo(pid,'Activar vínculo '+t);
    for(let i=0;i<hc;i++){
      const choices=s.pokerHand.map((c,n)=>({c,n})).filter(x=>!selected.includes(x.c.id)&&!protectedCard(pid,x.c));
      const picked=ctx.choosePokerPayment?[...choices].sort((a,b)=>ctx.choosePokerPayment(pid,a.c)-ctx.choosePokerPayment(pid,b.c))[0]:choices[0];
      const x=s.pokerHand.splice(picked.n,1)[0];recyclePoker(pid,[x]);
    }
    for(let i=0;i<pc;i++){
      const eligible=s.hand.map((cid,j)=>({cid,j})).filter(x=>x.j!==index&&!s.activeHyper.includes(x.j));
      const choice=paymentSlots?eligible.find(x=>x.j===[...paymentSlots].sort((a,b)=>b-a)[i]):(ctx.choosePowerPayment?[...eligible].sort((a,b)=>ctx.choosePowerPayment(pid,a.cid)-ctx.choosePowerPayment(pid,b.cid))[0]:eligible[0]);
      if(!choice){ctx.toast('No hay Power Card disponible para pagar el vínculo.');return;}
      const j=choice.j,x=ctx.manual().take(pid,j);
      ctx.manual().giveBack(x.cardId,x.ownerId);if(j<index)index--;
    }
    s.activeHyper.push(index);
    const b={token:serial(),pid,type:t,cardId:id,index,targets:[...selected],turn:-1};
    bonds(pid).push(b);
    // Joker enchants an existing Poker Card; no virtual Poker Card created.
    ctx.recalc(pid);log(pid,t,'HyperCard activada con vínculo '+(selected.join(', ')||'autónomo')+'. Costes reales descontados.');
    if(t==='001'){ability(index);return;}
    ctx.render();
  }
  function wildRank(pid,c){return c?.virtualPower?.type==='JOKER'||refs(pid,c).some(b=>['029','035'].includes(b.type))}
  function wildSuit(pid,c){return c?.virtualPower?.type==='JOKER'||refs(pid,c).some(b=>['030','035'].includes(b.type))}
  function score(pid,kind,cards,actives){
    const point={Par:1,'Trío':3,Escalera:5,Color:5,'Póker':7}[kind],required={Par:2,'Trío':3,Escalera:5,Color:5,'Póker':4}[kind];
    if(!point||cards.length!==required||cards.some(x=>!x))return 0;
    const wr=cards.map(c=>wildRank(pid,c)),ws=cards.map(c=>wildSuit(pid,c));
    // Two cards linked to the SAME effect cannot declare an equal adopted value or suit.
    const sameBindingCount=t=>bonds(pid).some(b=>b.type===t&&b.targets.filter(id=>cards.some(c=>c.id===id)).length>1);
    if(['Par','Trío','Póker'].includes(kind)&&sameBindingCount('029'))return 0;
    if(kind==='Color'&&sameBindingCount('030'))return 0;
    if(actives.includes('catalog_v3_046')&&!cards.some((c,i)=>wr[i]||c.rank==='A'))return 0;
    if(actives.includes('catalog_v3_062')&&!cards.some((c,i)=>wr[i]||['J','Q','K'].includes(c.rank)))return 0;
    let valid=false;
    if(['Par','Trío','Póker'].includes(kind)){
      valid=['A','2','3','4','5','6','7','8','9','10','J','Q','K'].some(rank=>cards.every((c,i)=>wr[i]||c.rank===rank));
    }else if(kind==='Color'){
      valid=['S','H','D','C'].some(suit=>cards.every((c,i)=>ws[i]||c.suit===suit));
    }else{
      for(let low=1;low<=10&&!valid;low++){
        const seq=Array.from({length:5},(_,i)=>low+i===1||low+i===14?'A':String(low+i));
        function canAssign(i,used){if(i===5)return true;for(let j=0;j<5;j++)if(!(used&(1<<j))&&(wr[i]||cards[i].rank===seq[j])&&canAssign(i+1,used|(1<<j)))return true;return false}
        valid=canAssign(0,0);
      }
    }
    return valid?point:0;
  }
  function schedule(e){game().linkedEvents??=[];game().linkedEvents.push(e)}
  function onCharge(pid,spent){
    const st=state(pid),hit=new Set(spent.map(c=>c.id));
    for(const b of [...bonds(pid)]){
      if(!b.targets.some(id=>hit.has(id)))continue;
      if(b.type==='042')schedule({pid,step:'MAIN_START',due:st.turnsTaken+2,type:'POKER_STEAL',owner:pid,card:b.type});
      if(b.type==='043')schedule({pid,step:'END',due:st.turnsTaken+1,type:'CHIP_PLUS',amount:2,owner:pid,card:b.type});
      if(b.type==='044')schedule({pid,step:'DRAW_END',due:st.turnsTaken+2,type:'DRAW_POWER',owner:pid,card:b.type});
    }
  }
  function startOffense(){
    const effect=offenseQueue.shift();if(!effect)return;
    pending={kind:'offense',pid:effect.owner,effect,selected:[]};ctx.setModal({type:'linked-picker'});ctx.render();
  }
  function phase(step,pid){
    if(!game()||game().mode!=='ASSISTED')return;
    const s=state(pid),turn=(s.turnsTaken||0)+1,ev=game().linkedEvents||[];
    for(const e of [...ev]){
      if(e.pid!==pid||e.step!==step||e.due!==turn)continue;
      if(e.type==='DRAW_POWER')ctx.drawPower(pid,1,true);
       else if(e.type==='CHIP_PLUS')s.chips=(s.chips||0)+Math.max(0,Number(e.amount)||1);
       else if(e.type==='POKER_STEAL'){
         pending={kind:'offense',pid,effect:{type:'POKER_STEAL',owner:pid,card:e.card},selected:[]};
         ctx.setModal({type:'linked-picker'});ctx.render();
       }
      else if(e.type==='DRAW_POKER'){for(let i=0;i<2&&s.pokerHand.length<s.pokerLimit;i++)ctx.drawPoker(pid,s,'Artilugio Azul')}
      else if(e.type==='POWER_DISCARD')ctx.discardPower(pid,1);
      else if(e.type==='POKER_DISCARD'){
        const c=s.pokerHand.find(c=>!protectedCard(pid,c));if(c){s.pokerHand.splice(s.pokerHand.indexOf(c),1);recyclePoker(pid,[c])}
      }else if(e.type==='CHIP_MINUS')s.chips=Math.max(0,s.chips-1);
      ev.splice(ev.indexOf(e),1);log(pid,e.card,'Efecto diferido '+e.type+' aplicado en '+step+'.');
    }
    if(step==='END')for(const b of [...bonds(pid)])if(b.type==='040'){
       for(const c of s.pokerHand.filter(x=>b.targets.includes(x.id)))if(c.originalRank!==undefined){c.rank=c.originalRank;delete c.originalRank;}
       detach(pid,b,'Sabueso de Ases: encanto finalizado.',false);
     }
    cleanup();
  }
  function ability(index){
    const pid=game().decks[game().activeIndex].id,s=state(pid),b=bonds(pid).find(x=>x.index===index&&x.type==='001');
    if(!b||s.currentPhase!=='MAIN')return;
    if(b.turn===s.turnsTaken){ctx.toast('Reglas Antiguas: intercambio ya utilizado este turno.');return}
    if(!s.pokerHand.length||!game().pokerDrawPile.length){ctx.toast('No hay Poker Cards suficientes para intercambiar.');return}
    pending={kind:'ability',pid,index,selected:[]};ctx.setModal({type:'linked-picker'});ctx.render();
  }
  function sabueso(item){
    pending={kind:'sabueso',item,pid:item.playerId,needed:2,selected:[]};ctx.setModal({type:'linked-picker'});ctx.render();
  }
  function option(id){
    if(!pending)return;
    const p=pending,s=state(p.pid);
    if(p.kind==='offense'){
      const rival=game().decks.find(x=>x.id===id&&x.id!==p.pid);if(!rival)return;
      if(p.effect.type==='POKER_STEAL'){
       const enemy=state(id),allowed=enemy.pokerHand.filter(c=>!protectedCard(id,c));
       if(allowed.length){
         const pick=allowed[ctx.random(allowed.length)],j=enemy.pokerHand.indexOf(pick);
         enemy.pokerHand.splice(j,1);s.pokerHand.push(pick);
         log(p.pid,p.effect.card,'Sincronía del Fuego: robó una Poker Card a J'+rival.playerNumber+'.');
       }else log(p.pid,p.effect.card,'El rival no tiene Poker Cards intercambiables.');
       cleanup();
     }else{
     schedule({...p.effect,pid:id,due:state(id).turnsTaken+1});
      log(p.pid,p.effect.card,'Rival J'+rival.playerNumber+' elegido para '+p.effect.type+'.');
      }
     pending=null;ctx.setModal(null);if(offenseQueue.length)startOffense();else ctx.render();return;
    }
    if(p.kind==='hyper-quantity'){
      const match=String(id).match(/^quantity:([012])$/);
      if(!match)return;
      const quantity=Number(match[1]);
      if(quantity>p.maxCost)return;
      if(quantity===0){pending=null;ctx.setModal(null);activate(p.pid,p.index,[],0,[]);return;}
      p.kind='hyper-power';p.needed=quantity;p.powerCost=quantity;p.selected=[];p.selectedPower=[];
      ctx.render();return;
    }
    if(p.kind==='hyper-power'){
      const match=String(id).match(/^power:(\d+)$/);
      if(!match)return;
      const index=Number(match[1]);
      if(index===p.index||s.activeHyper.includes(index)||!s.hand[index]||p.selectedPower.includes(index))return;
      p.selectedPower.push(index);
      if(p.selectedPower.length>=p.needed){p.kind='hyper';p.selected=[];}
      ctx.render();return;
    }
    if(p.kind==='sabueso'){
      const chosen=s.pokerHand.find(c=>c.id===id&&!virtual(c)&&!protectedCard(p.pid,c)&&!p.selected.includes(c.id));
      if(!chosen)return;
      p.selected.push(chosen.id);
      if(p.selected.length<2){ctx.render();return;}
      const targets=p.selected.map(cid=>s.pokerHand.find(c=>c.id===cid&&!virtual(c)&&!protectedCard(p.pid,c)));
      if(targets.some(c=>!c)){p.selected=[];ctx.toast('La selección cambió: elige dos Poker Cards de nuevo.');ctx.render();return;}
      for(const c of targets){
        c.originalRank??=c.rank;
        c.rank='A'; // El palo y el símbolo original no se modifican.
        bonds(p.pid).push({token:serial(),pid:p.pid,type:'040',cardId:p.item.cardId,index:-1,targets:[c.id],turn:s.turnsTaken});
      }
      ctx.manual().giveBack(p.item.cardId,p.item.ownerId);
      log(p.pid,'040','Sabueso de Ases: encantó 2 Poker Cards como As, conservando sus respectivos palos.');
      pending=null;ctx.setModal(null);ctx.afterSelection?.();ctx.render();return;
    }
   const chosen=s.pokerHand.find(c=>c.id===id&&!virtual(c));if(!chosen&&!(p.kind==='ability'&&id==='__ALL__'))return;
    if(p.kind==='ability'){
     const b=bonds(p.pid).find(b=>b.index===p.index&&b.type==='001');if(b)b.turn=s.turnsTaken;
     const cards=id==='__ALL__'?[...s.pokerHand]:[chosen],n=cards.length;
     for(const c of cards){const j=s.pokerHand.indexOf(c);if(j>=0)s.pokerHand.splice(j,1);}
     recyclePoker(p.pid,cards);
     for(let i=0;i<n;i++)ctx.drawPoker(p.pid,s,'Reglas Antiguas: intercambiar');
     log(p.pid,'001','Intercambió '+n+' Poker Card(s) con el mazo.');
     pending=null;ctx.setModal(null);ctx.render();return;
   }
   if(!p.selected.includes(id))p.selected.push(id);
    else p.selected=p.selected.filter(x=>x!==id);
    if(p.selected.length===p.needed){
      pending=null;ctx.setModal(null);activate(p.pid,p.index,p.selected,p.powerCost,p.selectedPower);return;
    }
    ctx.render();
  }
  function modalMarkup(){
    if(!pending)return'';
    const p=pending,name=p.type==='029'?'El Simbionte':'Cambio de Color';
    if(p.kind==='hyper-quantity'){
      const options=Array.from({length:p.maxCost+1},(_,i)=>i);
      return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+name+' · Coste</h2></div>'+
        '<div class="modal-content"><p>Descarta hasta 2 Power Cards. Por cada una podrás encantar una Poker Card. '+
        (p.type==='029'?'Las encantadas no podrán adoptar el mismo valor.':'Las encantadas no podrán adoptar el mismo símbolo.')+'</p>'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap">'+options.map(i=>'<button class="btn primary" data-action="linked-option" data-id="quantity:'+i+'">'+i+' Power Cards → '+i+' Poker Cards</button>').join('')+
        '</div></div></div></div>';
    }
    if(p.kind==='hyper-power'){
      const options=state(p.pid).hand.map((cid,i)=>({id:'power:'+i,name:ctx.card(cid)?.name||cid,index:i}))
        .filter(x=>x.index!==p.index&&!state(p.pid).activeHyper.includes(x.index)&&!p.selectedPower.includes(x.index));
      return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+name+' · Descartar Power Cards</h2></div>'+
        '<div class="modal-content"><p>Selecciona '+(p.needed-p.selectedPower.length)+' Power Card(s) para descartar.</p><div style="display:flex;flex-wrap:wrap;gap:10px">'+
        options.map(x=>'<button class="btn primary" data-action="linked-option" data-id="'+x.id+'">'+ctx.esc(x.name)+'</button>').join('')+
        '</div></div></div></div>';
    }
    const options=
      (p.kind==='offense'?game().decks.filter(x=>x.id!==p.pid).map(x=>({id:x.id,name:'Jugador '+x.playerNumber+' · '+x.name})):
       state(p.pid).pokerHand.filter(x=>!virtual(x)&&!protectedCard(p.pid,x)&&!(p.kind==='sabueso'&&p.selected.includes(x.id))).map(x=>({id:x.id,name:x.rank+' de '+x.suit})).concat(p.kind==='ability'?[{id:'__ALL__',name:'Intercambiar toda mi mano'}]:[]));
    return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+
      (p.kind==='sabueso'?'Sabueso de Ases · Encantar 2 Poker Cards':p.kind==='ability'?'Reglas Antiguas · Intercambiar':p.kind==='offense'?'Artilugio · Elegir rival':p.type==='029'||p.type==='030'?name+' · Encantar Poker Cards':'Vincular Poker Cards')+
      '</h2></div><div class="modal-content"><p>Selecciona '+Math.max(1,(p.needed||1)-(p.selected?.length||0))+' opción(es).</p><div style="display:flex;flex-wrap:wrap;gap:10px">'+options.map(x=>
      '<button class="btn '+(p.selected.includes(x.id)?'primary':'')+'" data-action="linked-option" data-id="'+ctx.esc(x.id)+'">'+ctx.esc(x.name)+'</button>').join('')+'</div></div></div></div>';
  }
  function cardLabel(pid,c){
    const x=refs(pid,c),tags=x.map(b=>ctx.card('catalog_v3_'+b.type)?.name||b.type);
    if(virtual(c))tags.unshift(c.virtualPower.type==='SABUESO'?'As de Sabueso':'Joker comodín');
    return tags.length?'<span class="small" style="background:#fff0b8;padding:2px;border-radius:3px;font-size:10px">'+ctx.esc(tags.join(' · '))+'</span>':'';
  }
  function choiceState(){return pending?{kind:pending.kind,pid:pending.pid,type:pending.type,needed:pending.needed,maxCost:pending.maxCost,powerCost:pending.powerCost,selectedPower:[...(pending.selectedPower||[])],selected:[...(pending.selected||[])]}:null;}
  return {choiceState,supported,artifacts,eligible,open,ability,sabueso,option,modalMarkup,cardLabel,
    score,onCharge,onPokerOut,cleanup,onPowerTake,protectedCard,virtual,phase};
};
