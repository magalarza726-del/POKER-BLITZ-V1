/* Poker Blitz: assisted effects with real state changes and explicit supported-card registry. */
window.POKER_BLITZ_ASSISTED_EFFECTS = function createAssistedEffects(ctx){
  const sim=()=>ctx.sim(), card=id=>ctx.card(id), links=()=>ctx.links?.(), draw=(pid,n=1)=>{const st=sim().states[pid];let moved=0;for(let i=0;i<n;i++){if(!sim().pokerDrawPile.length)break;const c=ctx.drawPoker(pid,st,'Efecto asistido: robar Poker Card');if(c)moved++}return moved};
  const pile=(pid)=>sim().states[pid], opponents=pid=>sim().decks.filter(p=>p.id!==pid&&(!sim().eligiblePlayers||sim().eligiblePlayers.includes(p.id)));
  const random=n=>n<=1?0:ctx.random(n), popPoker=(pid,n=1,attacker=null)=>{const st=pile(pid),out=[];for(let i=0;i<n&&st.pokerHand.length;i++){const permitted=st.pokerHand.map((c,j)=>({c,j})).filter(x=>!links()?.protectedCard(pid,x.c));if(!permitted.length)break;const choice=(attacker==null||attacker===pid)&&ctx.choosePokerPayment?[...permitted].sort((a,b)=>ctx.choosePokerPayment(pid,a.c)-ctx.choosePokerPayment(pid,b.c))[0]:permitted[random(permitted.length)];out.push(st.pokerHand.splice(choice.j,1)[0]);}if(links())links().onPokerOut(pid,out);else sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...out]);return out};
  const pushPower=(pid,n=1,ignoreLimit=false)=>{const s=pile(pid);ctx.manual().own(pid);let count=0;for(let k=0;k<n&&s.drawPile.length;k++){if(!ignoreLimit&&s.hand.length-s.activeHyper.length>=s.powerHandLimit)break;const index=random(s.drawPile.length),cid=s.drawPile.splice(index,1)[0],owner=s.drawOwners.splice(index,1)[0]||pid;s.hand.push(cid);s.handOwners.push(owner);count++}return count};
  const popPower=(pid,n=1)=>{const s=pile(pid),moved=[];for(let k=0;k<n;k++){const allowed=s.hand.map((c,i)=>({c,i})).filter(x=>!s.activeHyper.includes(x.i));if(!allowed.length)break;const pick=ctx.choosePowerPayment?[...allowed].sort((a,b)=>ctx.choosePowerPayment(pid,a.c)-ctx.choosePowerPayment(pid,b.c))[0]:allowed[random(allowed.length)],it=ctx.manual().take(pid,pick.i);ctx.manual().giveBack(it.cardId,it.ownerId);moved.push(it.cardId)}return moved};
  const movePoker=(from,to,n=1)=>{const st=pile(from),dst=pile(to),out=[];for(let k=0;k<n&&st.pokerHand.length;k++){const allowed=st.pokerHand.map((c,i)=>({c,i})).filter(x=>!links()?.protectedCard(from,x.c));if(!allowed.length)break;const x=st.pokerHand.splice(allowed[random(allowed.length)].i,1)[0];dst.pokerHand.push(x);out.push(x)}links()?.cleanup();return out};
  const swapPoker=(a,b,n=1,onPair=null)=>{let x=pile(a),y=pile(b),count=0;for(let k=0;k<n&&x.pokerHand.length&&y.pokerHand.length;k++){const allowedX=x.pokerHand.map((c,i)=>i).filter(i=>!links()?.protectedCard(a,x.pokerHand[i]));const allowedY=y.pokerHand.map((c,i)=>i).filter(i=>!links()?.protectedCard(b,y.pokerHand[i]));if(!allowedX.length||!allowedY.length)break;let i=allowedX[random(allowedX.length)],j=allowedY[random(allowedY.length)];if(onPair)onPair(x.pokerHand[i],y.pokerHand[j]);[x.pokerHand[i],y.pokerHand[j]]=[y.pokerHand[j],x.pokerHand[i]];count++}links()?.cleanup();return count};
  const addChips=(pid,n,bonusAllowed=true)=>{const st=pile(pid),before=st.chips||0;
     const reward=bonusAllowed&&n>0&&st.currentPhase==='MAIN'&&st.activeHyper.some(i=>st.hand[i]==='catalog_v3_049')?1:0;
     st.chips=Math.max(0,before+n+reward);
     if(reward)log(pid,'049','Gran Inversor: +1 ficha adicional por efecto de Power Card en Main Phase.');
     return st.chips-before;};
  const log=(pid,id,description)=>ctx.log(pid,'Efecto asistido',description,card(id)||card('catalog_v3_'+id)||null);
  const ids=(s)=>new Set(s);
  const usable=ids(['004','006','007','009','010','011','012','013','014','015','016','017','018','019','020','021','022','023','026','031','032','033','034','036','037','039','040','041','045','047','052','053','054','055','056','057','061','063']);
  const hypers=ids(['001','003','025','029','030','035','042','043','044','046','049','062']);
  let queue=[],pending=null,pendingShield=null,deferred=[],rollingEffect=null;
  function supported(id){const match=String(id||'').match(/catalog_v3_(\d{3})/);const code=match?.[1];return !!code&&(usable.has(code)||hypers.has(code));}
  function copyCandidates(pid){const s=pile(pid);if(!s)return [];return (s.assistedPlayedSupers||[]).filter(x=>x.turn===s.turnsTaken&&x.round===sim().round&&x.cardId!=='catalog_v3_017'&&supported(x.cardId)&&canPlay(x.cardId,pid)).map(x=>x.cardId);}
  function canPlay(id,pid){if(!supported(id))return false;const s=pile(pid);if(!s)return false;const num=String(id).slice(-3),freePoker=s.pokerHand.filter(c=>!links()?.protectedCard(pid,c)).length;const freePower=s.hand.filter(x=>x===id).length?Math.max(0,s.hand.length-s.activeHyper.length-1):s.hand.length-s.activeHyper.length;
    const costPoker={ '007':1 }; const costPower={'007':1,'032':1};
    if((costPoker[num]||0)>freePoker)return false;
    if((costPower[num]||0)>freePower)return false;
    // Sobrecarga de mejoras no busca HyperCards en el Power Deck.
    if(num==='031'&&(s.chips||0)<1)return false;
    // Manipulador se valida en el momento de tirar el dado; en Prueba Asistida puede preparar la próxima tirada.
    if(['006','009','010','012','013','026','038','048','052','055','056','064'].includes(num)&&!opponents(pid).length)return false;
    if(num==='008'&&!s.activeHyper.length)return false;
    if(num==='009'&&!opponents(pid).some(p=>pile(p.id).chips>=5))return false;
    if(num==='010'&&(!s.pokerHand.length||!opponents(pid).some(p=>pile(p.id).pokerHand.length)))return false;
    if(num==='012'&&(!s.pokerHand.length&&!s.hand.length||!opponents(pid).some(p=>pile(p.id).pokerHand.length||pile(p.id).hand.length)))return false;
    if(num==='013'&&(!s.pokerHand.some(c=>!links()?.protectedCard(pid,c))||!opponents(pid).some(p=>pile(p.id).pokerHand.some(c=>!links()?.protectedCard(p.id,c)))))return false;
    if(num==='023'&&!active(pid,'062')&&freePoker<3)return false;
     if(num==='023'&&!s.pokerHand.some(c=>!links()?.protectedCard(pid,c)))return false;
    if(num==='026'&&(!opponents(pid).length||!s.pokerHand.some(c=>!links()?.protectedCard(pid,c))))return false;
    if(num==='055'&&!opponents(pid).some(p=>pile(p.id).chips>=5&&(pile(p.id).chips>=10||pile(p.id).hand.some((_,i)=>!pile(p.id).activeHyper.includes(i)))))return false;
    if(num==='056'&&!opponents(pid).some(p=>pile(p.id).pokerHand.filter(c=>!links()?.protectedCard(p.id,c)).length>=3))return false;
    if(num==='047'&&!active(pid,'046')&&freePoker<4)return false;
    if(num==='047'&&!opponents(pid).some(p=>pile(p.id).pokerHand.filter(c=>!links()?.protectedCard(p.id,c)).length>=2))return false;
    if(num==='051'&&!sim().decks.some(p=>pile(p.id).activeHyper.length))return false;
    // Agujero Negro también puede reaccionar a un efecto de dados todavía sin resolver.
    if(num==='055'&&(s.pokerHand.filter(c=>!links()?.protectedCard(pid,c)).length<2||!opponents(pid).some(p=>pile(p.id).chips>=1)))return false;
    if((num==='057'||num==='063')&&!active(pid,'062')&&freePoker<2)return false;
    if(num==='017'&&!copyCandidates(pid).length)return false;

    if(num==='040'&&freePoker<(!active(pid,'046')?5:2))return false;
    if(num==='005'&&new Set(s.activeHyper.map(i=>String(s.hand[i]).slice(-3)).filter(x=>links()?.artifacts.has(x))).size<3)return false;
    if(num==='004'&&!sim().chain?.stack?.[0])return false;
     if(['010','033','034'].includes(num)&&ctx.type?.(card(sim().chain?.stack?.[0]?.cardId))!=='SUPER')return false;
     if(num==='052'&&ctx.type?.(card(sim().pendingHyperActivationCardId||sim().chain?.stack?.[0]?.cardId))!=='HYPER')return false;
    if(num==='041'&&s.pokerHand.length<2)return false;

    if(num==='045'&&!active(pid,'046')&&(freePoker<1||freePower<1))return false;
    if(num==='061'&&!active(pid,'062')&&freePoker<5)return false;
    const description=String(card(id)?.description||'');let cap=Infinity,period='TURN';
    let m=description.match(/hasta\s+(\d+)\s+veces\s+por\s+turno/i);
    if(m)cap=Number(m[1]);else if(/una\s+vez\s+por\s+turno/i.test(description))cap=1;
    m=description.match(/m[aá]ximo\s+(\d+)\s+activaci[oó]n(?:es)?\s+por\s+jugador\s+por\s+ronda/i);
    if(m){cap=Number(m[1]);period='ROUND'}
    const counter=period==='ROUND'?String(sim().round):String(s.turnsTaken||0),key=period+':'+counter+':'+id;
    return (s.assistedUses?.[key]||0)<cap;
  }
  function markUsed(id,pid){const s=pile(pid);const desc=String(card(id)?.description||'');const type=/por\s+jugador\s+por\s+ronda/i.test(desc)?'ROUND':'TURN',ref=type==='ROUND'?String(sim().round):String(s.turnsTaken||0),key=type+':'+ref+':'+id;s.assistedUses??={};s.assistedUses[key]=(s.assistedUses[key]||0)+1;}
  function target(pid,title,callback,eligible=null){
    const options=title==='El gran tifón'?sim().decks.filter(p=>!sim().eligiblePlayers||sim().eligiblePlayers.includes(p.id)):opponents(pid);
    const players=eligible?options.filter(p=>eligible(p.id,pile(p.id))):options;
    if(!players.length){log(pid,'','Este efecto necesita otro jugador. No hay objetivo válido.');return true}
    pending={kind:'target',players,title,callback,sourcePid:pid};
    ctx.setModal({type:'assisted-target'});ctx.render();return false;
  }
  function openChoice(p){pending=p;ctx.setModal({type:'assisted-choice'});ctx.render();return false;}
  function finishChoice(){
    pending=null;ctx.setModal(null);links()?.cleanup();drain();
  }
  const pokerValue=c=>({A:14,K:13,Q:12,J:11})[c?.rank]||Number(c?.rank)||0;
  function choiceOptions(){
    if(!pending||pending.kind==='target')return [];
    const p=pending,actor=pile(p.pid);
    if(p.kind==='hyper-search')return actor.drawPile.map((id,i)=>({value:'hyper:'+i,label:card(id)?.name||id,score:ctx.cardScore?.(p.pid,id)||1}))
      .filter(x=>ctx.type?.(card(actor.drawPile[Number(x.value.slice(6))]))==='HYPER');
    if(p.kind==='secuaz'){
      const victim=pile(p.enemy),options=[];
      const chips=Math.floor(Math.max(0,victim.chips||0)/10);
      if(chips>=1)options.push({value:'chips',label:'Robarle '+chips+' ficha(s), una por cada 10',score:chips*1.8});
      if(victim.hand.some((_,i)=>!victim.activeHyper.includes(i)))options.push({value:'power',label:'Activar una de sus Power Cards al azar como propia',score:1.6});
      return options;
    }
    if(p.kind==='maestro'){
      const victim=pile(p.enemy),slots=victim.hand.filter((_,i)=>!victim.activeHyper.includes(i));
      const options=[];
      if(victim.chips>=5)options.push({value:'chips',label:'Robarle 1 ficha',score:1.8});
      // Ya no existe opción de robar dos Poker Cards.
      if(slots.length)options.push({value:'power',label:'Activar una Power Card aleatoria del rival; devolverla si no es aplicable',score:1.6});
      return options;
    }
    if(p.kind==='color')return ['S','H','D','C'].map(suit=>({value:'suit:'+suit,label:({S:'Picas',H:'Corazones',D:'Diamantes',C:'Tréboles'})[suit],score:0}));
    if(p.kind==='peek')return p.cards.map((c,i)=>({value:'peek:'+i,label:c.rank+' de '+c.suit,score:p.phase==='take'?pokerValue(c):0}));
    if(p.kind==='spy'){
      const target=p.phase==='attack'?p.enemy:p.owner,st=pile(target);
      return st.pokerHand.filter(c=>!links()?.protectedCard(target,c)).map(c=>({value:'poker:'+c.id,label:'Poker Card: '+c.rank+' de '+c.suit,score:pokerValue(c)}))
        .concat(st.hand.map((cid,i)=>({cid,i})).filter(x=>!st.activeHyper.includes(x.i)).map(x=>({value:'power:'+x.i,label:'Power Card: '+(card(x.cid)?.name||x.cid),score:ctx.cardScore?.(target,x.cid)||3})));
    }
    if(p.kind==='forced-swap'){
      const src=p.phase==='own'?p.pid:p.enemy,hand=pile(src).pokerHand,used=p.phase==='own'?p.usedOwn:p.usedEnemy;
      const options=hand.map(c=>({value:p.phase+':'+c.id,label:c.rank+' '+(c.symbol||c.suit)+(links()?.protectedCard(src,c)?' (protegida)':''),score:p.phase==='own'?15-pokerValue(c):pokerValue(c),disabled:!!links()?.protectedCard(src,c)||used.includes(c.id)}));
      const remainingEnemy=pile(p.enemy).pokerHand.some(c=>!links()?.protectedCard(p.enemy,c)&&!p.usedEnemy.includes(c.id));
      if(p.phase==='own'&&!remainingEnemy){for(const option of options)option.disabled=true;}
      if(p.phase==='own'&&p.done>0)options.push({value:'finish',label:'Terminar intercambio ('+p.done+' de 2 pares)',score:remainingEnemy?-10:100});
      return options;
    }
    return [];
  }
  function choiceMarkup(){
    const p=pending,options=choiceOptions(),who=sim().decks.find(x=>x.id===p.enemy);
    const title=({
      spy:'Espía vs Espía: '+(p.phase==='attack'?'elige carta rival':'el rival elige una carta tuya'),
      peek:'Ojo del Más Allá: '+(p.phase==='take'?'elige carta para robar':'elige la siguiente carta que irá arriba del mazo'),
      color:'Mi Color Favorito: declara un símbolo',
      maestro:'Maestro de Fichas: elige un efecto',
      'forced-swap':'Intercambio Forzado: selección de cartas',
      'hyper-search':'Búsqueda de HyperCard'
    })[p.kind]||'Elegir efecto';
    const hint=p.kind==='spy'?'Puedes elegir entre las Poker Cards y las Power Cards de esa mano completa.':
      p.kind==='peek'?'Toma una Poker Card y ordena las restantes encima del mazo.':
      p.kind==='color'?'Declara un palo antes de robar.':
      p.kind==='forced-swap'?'Selecciona hasta dos pares de Poker Cards.':
      'Elige una de las opciones legales disponibles.';
    let preview='';
    if(p.kind==='forced-swap'){
      const enemy=pile(p.enemy);preview='<p class="small muted">Mano completa de J'+(who?.playerNumber||'?')+': '+
        (enemy.pokerHand.length?enemy.pokerHand.map(c=>ctx.esc(c.rank+' '+(c.symbol||c.suit))+(links()?.protectedCard(p.enemy,c)?' (protegida)':'')).join(' · '):'sin Poker Cards')+'</p>';
    }
    return '<div class="modal-backdrop"><div class="modal" style="max-width:720px;max-height:92vh;overflow-y:auto"><div class="modal-head"><h2>'+ctx.esc(title)+'</h2></div><div class="modal-content"><p>'+ctx.esc(hint)+'</p>'+preview+
      '<div style="display:flex;flex-wrap:wrap;gap:8px">'+options.map(o=>'<button type="button" class="btn '+(o.value==='finish'?'soft':'primary')+'" data-action="assist-option" data-value="'+ctx.esc(o.value)+'" data-ai-score="'+Number(o.score||0)+'" '+(o.disabled?'disabled':'')+'>'+ctx.esc(o.label)+'</button>').join('')+'</div></div></div></div>';
  }
  function openHyperSearch(pid){
    if(!pile(pid).drawPile.some(cid=>ctx.type?.(card(cid))==='HYPER')){log(pid,'007','No quedó ninguna HyperCard elegible en el Deck.');return true}
    return openChoice({kind:'hyper-search',pid});
  }
  function openMaestroChoice(pid,enemy){return openChoice({kind:'maestro',pid,enemy});}
  function openSecuazChoice(pid,enemy){return openChoice({kind:'secuaz',pid,enemy});}
  function openForcedSwap(pid,enemy){const valid=id=>pile(id).pokerHand.some(c=>!links()?.protectedCard(id,c));if(!valid(pid)||!valid(enemy)){log(pid,'013','Intercambio Forzado omitido: uno de los jugadores se quedó sin Poker Cards intercambiables antes de resolver el efecto.');return true;}return openChoice({kind:'forced-swap',pid,enemy,phase:'own',done:0,usedOwn:[],usedEnemy:[],ownId:null});}
  function resolveBorrowedPower(pid,enemy,origin='009'){
    const actor=pile(pid),victim=pile(enemy),slots=victim.hand.map((cid,i)=>({cid,i})).filter(x=>!victim.activeHyper.includes(x.i));
    if(!slots.length){log(pid,origin,'El rival no tenía Power Cards disponibles.');return}
    const picked=slots[random(slots.length)],taken=ctx.manual().take(enemy,picked.i);
    if(!taken){log(pid,origin,'No pudo extraerse la Power Card rival.');return}
    const type=ctx.type?.(card(taken.cardId)),num=taken.cardId.slice(-3);
    const returnToOwner=()=>ctx.manual().giveBack(taken.cardId,taken.ownerId);
    if(type==='SUPER'&&num!=='040'&&supported(taken.cardId)&&canPlay(taken.cardId,pid)){
      markUsed(taken.cardId,pid);returnToOwner();queue.unshift({cardId:taken.cardId,playerId:pid,copied:true});
      log(pid,origin,'Activó como propia la SuperCard '+(card(taken.cardId)?.name||taken.cardId)+' de J'+sim().decks.find(p=>p.id===enemy).playerNumber+'. La carta vuelve al Deck propietario.');return;
    }
    if(type==='HYPER'&&actor.currentPhase==='MAIN'&&actor.activeHyper.length<3){
      const count=actor.activeHyper.filter(i=>actor.hand[i]===taken.cardId).length;
      const maxCopies=num==='027'?2:1;
      if(count<maxCopies){
        const i=actor.hand.length;actor.hand.push(taken.cardId);actor.handOwners.push(taken.ownerId);
        const linked=!!links()?.supported.has(num);
        const costs=({'001':[1,1],'002':[1,2],'025':[0,2],'027':[1,1],'028':[0,2],'049':[1,2],'050':[1,1]})[num]||[0,0];
        const eligible=linked?links().eligible(pid,i):
          actor.hand.filter((_,j)=>j!==i&&!actor.activeHyper.includes(j)).length>=costs[0]&&actor.pokerHand.length>=costs[1];
        if(eligible){
          const previous=sim().activeIndex;sim().activeIndex=sim().decks.findIndex(x=>x.id===pid);
          try{if(linked)links().open(i);else activate(i);}
          finally{sim().activeIndex=previous;}
          log(pid,origin,'Intentó activar como propia HyperCard '+(card(taken.cardId)?.name||taken.cardId)+' de J'+sim().decks.find(p=>p.id===enemy).playerNumber+'. Se conserva su dueño original.');
          return;
        }
        actor.hand.pop();actor.handOwners.pop();
      }
    }
    returnToOwner();
    log(pid,origin,'Power Card aleatoria '+(card(taken.cardId)?.name||taken.cardId)+' no aplicable. Devuelta al Deck de J'+sim().decks.find(p=>p.id===enemy).playerNumber+'.');
  }
  function chooseOption(value){
    if(!pending||pending.kind==='target')return;
    const p=pending,options=choiceOptions(),choice=options.find(o=>o.value===value&&!o.disabled);
    if(!choice)return;
    if(p.kind==='hyper-search'){
      const s=pile(p.pid),index=Number(value.slice(6)),id=s.drawPile[index];
      if(!Number.isInteger(index)||!id||ctx.type?.(card(id))!=='HYPER')return;
      if(s.hand.length-s.activeHyper.length>=s.powerHandLimit){log(p.pid,'007','No se pudo tomar HyperCard: Power Hand llena.');finishChoice();return;}
      const owner=s.drawOwners[index]||p.pid;
      s.drawPile.splice(index,1);s.drawOwners.splice(index,1);
      s.hand.push(id);s.handOwners.push(owner);
      log(p.pid,'007','Buscó y eligió HyperCard '+(card(id)?.name||id)+' de su Deck. Coste completo registrado.');
      finishChoice();return;
    }
    if(p.kind==='maestro'||p.kind==='secuaz'){
      const victim=pile(p.enemy),secuaz=p.kind==='secuaz',origin=secuaz?'055':'009';
      pending=null;ctx.setModal(null);
      if(value==='chips'){
        const taken=Math.min(victim.chips||0,secuaz?Math.floor((victim.chips||0)/10):1);
        addChips(p.enemy,-taken,false);addChips(p.pid,taken,false);
        log(p.pid,origin,(secuaz?'Secuaz de Fichas':'Maestro de Fichas')+': robó '+taken+' ficha(s) de J'+sim().decks.find(q=>q.id===p.enemy).playerNumber+'.');
      }
      else if(value==='power')resolveBorrowedPower(p.pid,p.enemy,origin);
      links()?.cleanup();drain();return;
    }
    if(p.kind==='color'){
      const suit=value.slice(5),n=draw(p.pid,1),c=n?pile(p.pid).pokerHand.at(-1):null;
      if(c&&c.suit===suit){draw(p.pid,1);log(p.pid,'022','Acertó el símbolo '+suit+' y robó una Poker Card adicional.');}
      else if(c){pile(p.pid).pokerHand.pop();sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,c]);popPoker(p.pid,1);log(p.pid,'022','Falló símbolo '+suit+', devolvió la carta y descartó otra Poker Card.');}
      finishChoice();return;
    }
    if(p.kind==='peek'){
      const i=Number(value.slice(5)),c=p.cards.splice(i,1)[0];if(!c)return;
      if(p.phase==='take'){
        pile(p.pid).pokerHand.push(c);p.phase='order';p.ordered=[];log(p.pid,'016','Ojo del Más Allá: eligió '+c.rank+' de '+c.suit+'.');
        if(!p.cards.length){finishChoice();return;}ctx.render();return;
      }
      p.ordered.push(c);
      if(p.cards.length){ctx.render();return;}
      sim().pokerDrawPile.unshift(...p.ordered);log(p.pid,'016','Devolvió '+p.ordered.length+' Poker Cards en el orden elegido.');
      finishChoice();return;
    }
    if(p.kind==='spy'){
      const victim=p.phase==='attack'?p.enemy:p.owner,st=pile(victim);
      if(value.startsWith('poker:')){
        const i=st.pokerHand.findIndex(c=>c.id===value.slice(6));
        if(i>=0){const c=st.pokerHand.splice(i,1)[0];links()?.onPokerOut(victim,[c]);log(p.owner,'012','Espía vs Espía: descartó '+c.rank+'/'+c.suit+' de '+victim+'.');}
      }else{
        const i=Number(value.slice(6)),it=ctx.manual().take(victim,i);
        if(it){ctx.manual().giveBack(it.cardId,it.ownerId);log(p.owner,'012','Espía vs Espía: descartó '+(card(it.cardId)?.name||it.cardId)+' de '+victim+'.');}
      }
      if(p.phase==='attack'){
        p.phase='retaliation';p.pid=p.enemy;p.enemy=p.owner;
        if(choiceOptions().length){ctx.render();return;}
      }
      finishChoice();return;
    }
    if(p.kind==='forced-swap'){
      if(value==='finish'){log(p.pid,'013','Intercambio Forzado terminó con '+p.done+' pares de Poker Cards seleccionadas.');finishChoice();return;}
      const id=value.slice(value.indexOf(':')+1);
      if(p.phase==='own'){p.ownId=id;p.phase='rival';ctx.render();return;}
      const own=pile(p.pid),rival=pile(p.enemy),i=own.pokerHand.findIndex(c=>c.id===p.ownId),j=rival.pokerHand.findIndex(c=>c.id===id);
      if(i<0||j<0||links()?.protectedCard(p.pid,own.pokerHand[i])||links()?.protectedCard(p.enemy,rival.pokerHand[j]))return;
      const gave=own.pokerHand[i],got=rival.pokerHand[j];
      [own.pokerHand[i],rival.pokerHand[j]]=[got,gave];p.done++;p.usedOwn.push(gave.id,got.id);p.usedEnemy.push(got.id,gave.id);p.ownId=null;p.phase='own';
      log(p.pid,'013','Intercambio Forzado: entregó '+gave.rank+'/'+gave.suit+' y eligió '+got.rank+'/'+got.suit+' viendo toda la mano de J'+sim().decks.find(q=>q.id===p.enemy).playerNumber+'. Par '+p.done+'/2.');
      if(p.done>=2||!choiceOptions().some(o=>o.value.startsWith('own:')&&!o.disabled)){finishChoice();return;}
      links()?.cleanup();ctx.render();
    }
  }
  function modalMarkup(){
    if(!pending)return '';
    if(pending.kind!=='target')return choiceMarkup();
    return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+ctx.esc(pending.title)+'</h2></div><div class="modal-content"><p>Elige el objetivo del efecto. El programa actualizará las cartas y fichas automáticamente.</p><div style="display:flex;gap:10px;flex-wrap:wrap">'+pending.players.map(p=>'<button class="btn primary" data-action="assist-target" data-player="'+p.id+'">J'+p.playerNumber+' · '+ctx.esc(p.name)+'</button>').join('')+'</div></div></div></div>';
  }
  function choose(id){
    if(!pending||pending.kind!=='target'||!pending.players.some(p=>p.id===id))return;
    const origin=pending.sourcePid,st=pile(id),shieldIndex=st.hand.findIndex((cid,i)=>cid==='catalog_v3_004'&&!st.activeHyper.includes(i));
    if(!sim().autoMode&&!pending.shieldOffered&&id!==origin&&shieldIndex>=0){
      pending.shieldOffered=true;
      pendingShield={id,sourcePid:origin};
      ctx.setModal({type:'shield-counter',defenderId:id,sourcePid:origin});
      ctx.render();return;
    }
    const f=pending.callback,sourcePid=pending.sourcePid;pending=null;ctx.setModal(null);
    // Escudo de Cartas triggers when a CounterCard is played, not on target selection.
    if(active(id,'050')){
      const st=pile(id);st.assistedDefenses??={};const stamp=String(sim().round);
      if(!st.assistedDefenses[stamp]){st.assistedDefenses[stamp]=true;log(id,'050','Casco anti-efectos: negó la primera selección recibida en esta ronda.');drain();return;}
    }
    // Reglamento oficial: Escudo Resplandeciente se juega SOLO cuando el defensor
    // ha sido seleccionado para un efecto. En simulación, el objetivo ya se conoce.
    if(sim().autoMode&&sourcePid&&sourcePid!==id&&sim().chain?.stack?.[0]){
      const st=pile(id),i=st.hand.findIndex((cid,j)=>cid==='catalog_v3_004'&&!st.activeHyper.includes(j));
      if(i>=0&&canPlay('catalog_v3_004',id)){
        const shield=ctx.manual().take(id,i);
        if(shield){
          ctx.manual().giveBack(shield.cardId,shield.ownerId);
          log(id,'004','Escudo Resplandeciente jugado como respuesta a la selección real del jugador.');
          const attacker=pile(sourcePid);
          if(attacker&&!attacker.shieldCardsTriggered&&active(sourcePid,'025')){
            attacker.shieldCardsTriggered=true;draw(sourcePid,1);
            log(sourcePid,'025','Escudo de Cartas: +1 Poker Card por CounterCard rival.');
          }
          const remaining=sim().decks.filter(p=>p.id!==sourcePid&&p.id!==id&&
            (!sim().eligiblePlayers||sim().eligiblePlayers.includes(p.id)));
          if(remaining.length){
            remaining.sort((a,b)=>pile(b.id).chips-pile(a.id).chips);
            log(id,'004','Redirigió el efecto a J'+remaining[0].playerNumber+'.');
            f(remaining[0].id);links()?.cleanup();drain();return;
          }
          const n=movePoker(sourcePid,id,1).length;
          log(id,'004','Sin otro objetivo elegible, robó '+n+' Poker Card al atacante.');
          links()?.cleanup();drain();return;
        }
      }
    }
    const redirect=sim().redirectNextTarget;sim().redirectNextTarget=null;
    if(redirect&&redirect.defender===id&&redirect.attacker===sourcePid){
      const others=sim().decks.filter(p=>p.id!==redirect.attacker&&p.id!==redirect.defender);
      if(others.length){
        log(id,'004','Escudo Resplandeciente: elige un nuevo objetivo distinto del atacante y del defensor.');
        target(redirect.defender,'Escudo Resplandeciente · Elegir nuevo objetivo',chosen=>{
          const who=sim().decks.find(p=>p.id===chosen);
          log(id,'004','Efecto redirigido a J'+(who?.playerNumber||'?')+'.');f(chosen);links()?.cleanup();drain();
        },targetId=>targetId!==redirect.attacker&&targetId!==redirect.defender);
        return;
      }
      const stolen=movePoker(sourcePid,id,1);
      log(id,'004','Sin objetivo alternativo: robó '+stolen.length+' Poker Card del atacante.');
    }else f(id);
    links()?.cleanup();drain();
  }
  function shieldRespond(use){
    const choice=pendingShield;pendingShield=null;
    if(!choice||!pending||pending.kind!=='target')return;
    if(use){
      const st=pile(choice.id),i=st.hand.findIndex((cid,j)=>cid==='catalog_v3_004'&&!st.activeHyper.includes(j));
      if(i>=0){
        const played=ctx.manual().take(choice.id,i);
        if(played){
          ctx.manual().giveBack(played.cardId,played.ownerId);
          markUsed(played.cardId,choice.id);
          log(choice.id,'004','Escudo Resplandeciente: defensa activada al ser seleccionado.');
          sim().redirectNextTarget={defender:choice.id,attacker:choice.sourcePid};
          if(active(choice.sourcePid,'025')&&!pile(choice.sourcePid).shieldCardsTriggered){
            pile(choice.sourcePid).shieldCardsTriggered=true;draw(choice.sourcePid,1);
            log(choice.sourcePid,'025','Escudo de Cartas: robó una Poker Card por CounterCard rival.');
          }
        }
      }
    }
    choose(choice.id);
  }
  function enqueue(item){queue.push(item);const c=card(item.cardId),st=pile(item.playerId);if(c&&ctx.type?.(c)==='SUPER'&&c.id!=='catalog_v3_017'&&!item.copied){st.assistedLastSuper=c.id;st.assistedLastSuperTurn=st.turnsTaken;st.assistedPlayedSupers??=[];st.assistedPlayedSupers.push({cardId:c.id,turn:st.turnsTaken,round:sim().round});}}
  function finishChain(){drain()}
  function afterSelection(){drain()}
  function afterReaction(){drain()}
  function drain(){
    if(pending)return;
    while(queue.length||deferred.length){
      if(!queue.length&&deferred.length)queue.push(...deferred.splice(0));
      const item=queue.shift(),result=apply(item);
      if(result===false)return;
      links()?.cleanup();
    }
    if(!ctx.modal())ctx.render();
  }
  function beginTurn(pid){const st=pile(pid);if(!st)return;st.assistedPlayedSupers=[];st.assistedLastSuper=null;st.assistedLastSuperTurn=null;st.pendingDieCounter=null;st.pendingDieShift=0;st.destinyDieUsed=false;}
  function active(pid,id){return pile(pid).activeHyper.some(i=>pile(pid).hand[i]==='catalog_v3_'+id);}
  function dieShift(value,source,benefit){
    const preferEven=['018','020'].includes(source),preferOdd=['008','019'].includes(source);
    const wantEven=benefit?preferEven:preferOdd,wantOdd=benefit?preferOdd:preferEven;
    if(wantEven)return value%2===0?0:(value<6?1:-1);
    if(wantOdd)return value%2?0:-1;
    if(['014','015'].includes(source))return benefit?(value<6?1:0):(value>1?-1:0);
    if(source==='036')return benefit?(value===2?-1:value===5?1:0):(value===1?1:value===6?-1:0);
    return 0;
  }
  function die(pid){const st=pile(pid),base=1+random(6);let final=base;
    // Agujero Negro solo bloquea HyperCards: nunca altera resultados de dados.
    st.pendingDieCounter=null;
    if(st.pendingDieShift){final=Math.max(1,Math.min(6,final+st.pendingDieShift));st.pendingDieShift=0;}
    if(active(pid,'003')&&!st.destinyDieUsed){
       const delta=dieShift(final,rollingEffect,true),adjust=delta||((final<6)?1:-1),before=final;
       final=Math.max(1,Math.min(6,final+adjust));
       st.destinyDieUsed=true;log(pid,'003','Manipulador del Destino ajustó la primera tirada de '+before+' a '+final+'.');
     }
     st.dieBase=base;st.dieModifier=final-base;log(pid,'','Dado físico simulado: '+base+(final!==base?' → '+final:'')+'.');return final;
  }
  function apply(item){
    const id=String(item.cardId||'').replace('catalog_v3_',''),pid=item.playerId;
    const s=pile(pid);rollingEffect=id;
    const doTarget=(title,fn,eligible=null)=>{const forced=item.triggerPlayerId;if(forced&&['006','010','048','052','064'].includes(id)){if(!pile(forced)||!(eligible?eligible(forced,pile(forced)):true)){log(pid,id,'Counter sin objetivo elegible: efecto no aplicado.');return true;}fn(forced,pile(forced));return true;}return target(pid,title,(enemy)=>{const st=pile(enemy);fn(enemy,st);},eligible);};
    switch(id){
      case '004':{
         const source=item.copyOrigin;
         if(source?.playerId&&source.playerId!==pid){
           sim().redirectNextTarget={defender:pid,attacker:source.playerId};
           log(pid,id,'Escudo Resplandeciente: redirección disponible cuando se seleccione al defensor.');
         }else log(pid,id,'No existe un efecto dirigido para redirigir.');
         break;
       }
       case '040':{
        // Copied Sabueso works as a temporary enchantment; it must not duplicate a physical Power Card.
        if(!active(pid,'046')){const cost=popPoker(pid,3);log(pid,id,'Pagó '+cost.length+'/3 Poker Cards por Sabueso de Ases.');}
        links()?.sabueso(item);return false;
      }
      case '003':{log(pid,id,'Manipulador del Destino solo se activa desde HyperZone.');break}
      case '005':{const artifacts=s.activeHyper.filter(i=>['042','043','044','058','059','060'].includes(String(s.hand[i]).slice(-3)));const different=[...new Set(artifacts.map(i=>String(s.hand[i]).slice(-3)))];if(different.length>=3){addChips(pid,5);const taken=ctx.manual().take(pid,artifacts[0]);ctx.manual().giveBack(taken.cardId,taken.ownerId);recalc(pid);log(pid,id,'Tres artilugios diferentes: +5 fichas, devolvió un artilugio.')}else log(pid,id,'Se requieren tres artilugios distintos activos para cobrar.');break}
      case '007':{const a=popPoker(pid,1),b=popPower(pid,1);if(a.length!==1||b.length!==1){log(pid,id,'No se pudo pagar 1 Poker Card y 1 Power Card.');break;}s.hyperActivationLimit=(s.hyperActivationLimit||1)+1;log(pid,id,'Sobrecarga de mejoras: permite activar una HyperCard adicional este turno.');break;}
      case '011':for(const player of sim().decks){pushPower(player.id,1);draw(player.id,1)}log(pid,id,'Todos los jugadores robaron hasta 1 Power Card y 1 Poker Card.');break;
      case '053':log(pid,id,'Robó '+draw(pid,1)+' Poker Card.');break;
      case '032':{const x=popPower(pid,1).length;if(!x){log(pid,id,'Coste no pagado: requiere descartar 1 Power Card.');break;}log(pid,id,'Descartó 1 Power Card y robó '+draw(pid,2)+' Poker Cards.');break}
      case '031':if(s.chips<1){log(pid,id,'No hay fichas para pagar el coste.');break}addChips(pid,-1);log(pid,id,'Pagó 1 ficha, robó '+draw(pid,1)+' Poker Card y '+pushPower(pid,1)+' Power Card.');break;
      case '054':{const available=s.drawPile.map((cid,i)=>i);if(!available.length||s.hand.length-s.activeHyper.length>=s.powerHandLimit){log(pid,id,'No había otra Power Card distinta disponible o se alcanzó el límite de mano.');break;}const k=available[random(available.length)],cid=s.drawPile.splice(k,1)[0],owner=s.drawOwners.splice(k,1)[0]||pid;s.hand.push(cid);s.handOwners.push(owner);log(pid,id,'Ciclo Rápido: obtuvo otra Power Card distinta ('+(card(cid)?.name||cid)+').');break}
      case '057':{const spent=active(pid,'062')?0:popPoker(pid,2).length;log(pid,id,'Pagó '+spent+' Poker Cards y robó '+pushPower(pid,1)+' Power Card y '+draw(pid,1)+' Poker Card.');break}
      case '063':{const spent=active(pid,'062')?0:popPoker(pid,2).length;log(pid,id,'Reino Amable: pagó '+spent+' Poker Cards ('+(active(pid,'062')?'Vínculo Noble activo':'coste normal')+') y robó '+draw(pid,3)+' Poker Cards.');break}
      case '036':{const r=die(pid);log(pid,id,'Dado '+r+'. Robó '+([1,6].includes(r)?draw(pid,2):0)+' Poker Cards.');break}
      case '016':{
         const cards=sim().pokerDrawPile.splice(0,Math.min(4,sim().pokerDrawPile.length));
         if(cards.length)return openChoice({kind:'peek',pid,cards,phase:'take'});
         log(pid,id,'Ojo del Más Allá: Poker Deck vacío.');break;
       }
       case '017':{const candidates=copyCandidates(pid),last=ctx.chooseCopiedSuper?.(pid,candidates)||candidates.at(-1);if(last){markUsed(last,pid);log(pid,id,'Copió SuperCard legal de este turno: '+(card(last)?.name||last)+'.');queue.unshift({cardId:last,playerId:pid,copied:true});}else log(pid,id,'No había SuperCard de este turno con activaciones y costes disponibles.');break}
      case '018':{const r=die(pid);if(r%2===0){log(pid,id,'Dado par: robó '+draw(pid,2)+' Poker Cards.')}else{for(const p of opponents(pid))draw(p.id,1);log(pid,id,'Dado impar: todos los rivales robaron una Poker Card.')}break}
      case '019':{const r=die(pid);if(r%2===0){let a=popPoker(pid,2);log(pid,id,'Dado par: descartó '+a.length+' Poker Cards.');}else{for(const p of opponents(pid))popPoker(p.id,1,pid);log(pid,id,'Dado impar: los rivales descartaron una Poker Card.')}break}
      case '014':{const r=die(pid);if(r<=2)log(pid,id,'Dado '+r+': descartó '+popPoker(pid,r===1?2:1).length+' Poker Cards.');else if(r===3){let out=popPoker(pid,1);log(pid,id,'Dado 3: intercambió '+out.length+' Poker Card con el mazo; robó '+draw(pid,out.length)+'.');}else{log(pid,id,'Dado '+r+': robó '+draw(pid,r===4?1:r===5?2:3)+' Poker Cards.')}break}
      case '015':{const r=die(pid),n=popPoker(pid,r).length;log(pid,id,'Dado '+r+': intercambió '+n+' Poker Cards aleatorias; robó '+draw(pid,n)+'.');break}
      case '020':{const r=die(pid);if(r%2===0){sim().decks.forEach(p=>draw(p.id,1));log(pid,id,'Dado par: todos robaron una Poker Card.')}else{const list=sim().decks,transfers=list.map(p=>{const st=pile(p.id),out=[];for(let k=0;k<2;k++){const allowed=st.pokerHand.map((c,i)=>i).filter(i=>!links()?.protectedCard(p.id,st.pokerHand[i]));if(!allowed.length)break;out.push(st.pokerHand.splice(allowed[random(allowed.length)],1)[0]);}return out;});transfers.forEach((out,i)=>{for(const c of out)pile(list[(i-1+list.length)%list.length].id).pokerHand.push(c);});links()?.cleanup();log(pid,id,'Dado impar: transferencia simultánea de hasta 2 Poker Cards por jugador hacia la derecha.')}break}
      case '021':{const list=sim().decks,transfers=list.map(p=>{const st=pile(p.id),allowed=st.pokerHand.map((c,i)=>i).filter(i=>!links()?.protectedCard(p.id,st.pokerHand[i]));return allowed.length?st.pokerHand.splice(allowed[random(allowed.length)],1)[0]:null});list.forEach((p,i)=>{const chosen=transfers[i];if(chosen)pile(list[(i-1+list.length)%list.length].id).pokerHand.push(chosen)});links()?.cleanup();log(pid,id,'Transferencia circular simultánea de hasta 1 Poker Card elegible por jugador.');break}
      case '022':return openChoice({kind:'color',pid});
       case '023':{if(!active(pid,'062')&&s.pokerHand.length<3){log(pid,id,'Coste de dos Poker Cards impagable.');break;}const discard=active(pid,'062')?[]:popPoker(pid,2);const target=s.pokerHand.find(c=>/^([2-9]|10)$/.test(c.rank));if(target){const ranks=['J','Q','K'],counts=ranks.map(r=>s.pokerHand.filter(c=>c!==target&&c.rank===r).length),best=ranks[counts.indexOf(Math.max(...counts))];target.numberCharmOriginal??=target.rank;target.rank=best;log(pid,id,'Convirtió '+target.originalRank+' en '+best+' del mismo símbolo, pagando '+discard.length+' Poker Card.')}else log(pid,id,'No había Poker Card numérica válida.');break}
      case '024':break; // Physical reaction window is provided by the shared rules engine.
      case '026':return doTarget('Compartir es ganar',enemy=>{const stolen=movePoker(pid,enemy,1).length,drawn=draw(pid,3);log(pid,id,'J'+sim().decks.find(p=>p.id===enemy).playerNumber+' robó '+stolen+' Poker Card al azar de tu mano; tú robaste '+drawn+' del mazo.');});
      case '008':{const r=die(pid);if(r%2===0){const i=s.activeHyper.at(-1);if(i!==undefined){const removed=ctx.manual().take(pid,i);ctx.manual().giveBack(removed.cardId,removed.ownerId);log(pid,id,'Dado par: devolvió una HyperCard propia.')}else log(pid,id,'No había HyperCard propia para devolver.')}else return doTarget('Destello relámpago',enemy=>{const st=pile(enemy);let n=0;for(let k=0;k<2&&st.activeHyper.length;k++){const i=st.activeHyper.at(-1),removed=ctx.manual().take(enemy,i);ctx.manual().giveBack(removed.cardId,removed.ownerId);n++}log(pid,id,'Dado impar: devolvió '+n+' HyperCards del rival.')});break}
      case '009':return doTarget('Maestro de fichas',enemy=>openMaestroChoice(pid,enemy),enemy=>pile(enemy).chips>=5);
      case '010':return doTarget('Operación táctica',enemy=>{const n=swapPoker(pid,enemy,Math.min(3,s.pokerHand.length,pile(enemy).pokerHand.length));log(pid,id,'Intercambió '+n+' Poker Cards al azar con el jugador seleccionado.');},enemy=>pile(enemy).pokerHand.length>0);
      case '012':return doTarget('Espía vs Espía',enemy=>openChoice({kind:'spy',pid,enemy,owner:pid,phase:'attack'}));
      case '013':return doTarget('Intercambio forzado',enemy=>openForcedSwap(pid,enemy),enemy=>pile(enemy).pokerHand.some(c=>!links()?.protectedCard(enemy,c)));
      case '055':return doTarget('Secuaz de fichas',enemy=>openSecuazChoice(pid,enemy),enemy=>pile(enemy).chips>=5&&(pile(enemy).chips>=10||pile(enemy).hand.some((_,i)=>!pile(enemy).activeHyper.includes(i))));
      case '056':return doTarget('Falso limitador',enemy=>{const st=pile(enemy),discarded=popPoker(enemy,3,pid).length;if(discarded===3)st.nextDrawBonus=(st.nextDrawBonus||0)+1;log(pid,id,'Rival descartó '+discarded+'/3 Poker Cards y '+(discarded===3?'recibirá 1 Power Card adicional en su próxima Draw Phase.':'no completó el descarte requerido.'));},enemy=>pile(enemy).pokerHand.filter(c=>!links()?.protectedCard(enemy,c)).length>=3);
      case '047':{const paid=active(pid,'046')?0:popPoker(pid,4).length;const received=draw(pid,5);log(pid,id,'Coste pagado: '+paid+' Poker Cards (0 si tenía Maldición activa); robó '+received+'.');return doTarget('El hueso',enemy=>{let hasAce=false;const count=swapPoker(pid,enemy,2,own=>{if(own.rank==='A')hasAce=true;});const discarded=hasAce?popPoker(enemy,2,pid).length:0;log(pid,id,'Intercambió '+count+' Poker Cards; '+(hasAce?'entregó un As y obligó a descartar '+discarded+' Poker Cards.':'sin As entregado.'));},enemy=>pile(enemy).pokerHand.filter(c=>!links()?.protectedCard(enemy,c)).length>=2)}
      case '051':return doTarget('El gran tifón',enemy=>{const st=pile(enemy);if(!st.activeHyper.length){log(pid,id,'El rival no tiene HyperCards activas.');return}const i=st.activeHyper.at(-1),item=ctx.manual().take(enemy,i);ctx.manual().giveBack(item.cardId,item.ownerId);recalc(enemy);log(pid,id,'Devolvió una HyperCard rival a su propietario.')},enemy=>pile(enemy).activeHyper.length>0);
      case '038':return doTarget('Espía principiante',enemy=>{const target=pile(enemy),available=target.pokerHand.filter(c=>!links()?.protectedCard(enemy,c)),seen=[];for(let i=0;i<2&&available.length;i++)seen.push(available.splice(random(available.length),1)[0]);const yours=s.pokerHand.map((c,i)=>i).filter(i=>!links()?.protectedCard(pid,s.pokerHand[i]));if(seen.length&&yours.length){const chosen=seen[random(seen.length)],a=target.pokerHand.findIndex(c=>c.id===chosen.id),b=yours[random(yours.length)];if(a>=0){[target.pokerHand[a],s.pokerHand[b]]=[s.pokerHand[b],target.pokerHand[a]];links()?.cleanup();log(pid,id,'Observó '+seen.length+' Poker Cards rivales y eligió intercambiar '+chosen.rank+'/'+chosen.suit+' entre las observadas.');return;}}log(pid,id,'No se completó intercambio de Poker Cards observadas.');});
      case '006':return doTarget('Tiro por la culata',enemy=>log(pid,id,'J'+sim().decks.find(p=>p.id===enemy).playerNumber+' descartó '+popPoker(enemy,1,pid).length+' Poker Card.'));
      case '034':log(pid,id,'Robó '+draw(pid,1)+' Poker Card como respuesta al uso de Power Card.');break;
      case '048':return doTarget('Me llaman Robin Hood',enemy=>{const n=Math.min(1,pile(enemy).chips||0);addChips(enemy,-n);addChips(pid,n);log(pid,id,'Robó '+n+' ficha a J'+sim().decks.find(p=>p.id===enemy).playerNumber+'.')},enemy=>pile(enemy).chips>=1);
      case '052':{log(pid,id,'Agujero Negro bloquea una activación de HyperCard y no modifica dados.');break}
       case '064':{const r=die(pid);return doTarget('¿Tú también juegas dados?',enemy=>log(pid,id,r%2===0?'Rival robó '+draw(enemy,1)+' Poker Card.' :'Rival descartó '+popPoker(enemy,2,pid).length+' Poker Cards.'))}
      case '037':{const others=opponents(pid);for(const p of others){draw(p.id,2);sim().assistedPending??=[];sim().assistedPending.push({round:sim().round,type:'GHOST',actor:pid,target:p.id});}log(pid,id,'Cada rival robó hasta dos Poker Cards; descartará dos después de completar su End Phase.');break}
      case '039':{log(pid,id,'Robó '+draw(pid,3)+' Poker Cards.');sim().assistedPending??=[];sim().assistedPending.push({round:sim().round,type:'END_DISCARD',actor:pid,n:2});break}
      case '041':{const values={J:11,Q:12,K:13,A:14};let match=null;for(let i=0;i<s.pokerHand.length;i++){for(let j=i+1;j<s.pokerHand.length;j++){const a=s.pokerHand[i],b=s.pokerHand[j];if(a.rank!==b.rank&&(values[a.rank]||Number(a.rank))+(values[b.rank]||Number(b.rank))===21){match=[j,i];break}}if(match)break}if(match){const cards=match.map(i=>s.pokerHand.splice(i,1)[0]);if(links())links().onPokerOut(pid,cards);else sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...cards]);addChips(pid,2);s.chargeReplacement=(s.chargeReplacement||0)+2;log(pid,id,'Neo Blackjack: cobró 2 fichas; devolvió dos Poker Cards y programó reposición.')}else log(pid,id,'No se encontró par de valores diferentes que sumen 21.');break}
      case '045':
      case '061':{if(id==='045'&&!active(pid,'046')){popPoker(pid,1);popPower(pid,1);log(pid,id,'Pagó un Poker Card y una Power Card al no tener Maldición activa.');}if(id==='061'&&!active(pid,'062')){popPoker(pid,5);log(pid,id,'Pagó cinco Poker Cards al no tener Vínculo noble activo.');}const wanted=id==='045'?['A']:['J','Q','K'],indexes=s.pokerHand.map((c,i)=>wanted.includes(c.rank)?i:-1).filter(i=>i>=0),cards=indexes.map(i=>s.pokerHand[i]);for(let j=indexes.length-1;j>=0;j--)s.pokerHand.splice(indexes[j],1);if(links())links().onPokerOut(pid,cards);else sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...cards]);addChips(pid,cards.length*(id==='045'?3:1));s.chargeReplacement=(s.chargeReplacement||0)+cards.length;if(id==='045'&&cards.length){sim().assistedPending??=[];sim().assistedPending.push({round:sim().round,type:'END_DRAW',actor:pid,n:cards.length});}log(pid,id,'Cobró '+cards.length*(id==='045'?3:1)+' fichas con '+cards.length+' cartas '+wanted.join('/')+'.');break}
      default:log(pid,id,'El efecto requiere un módulo adicional; no se ha aplicado ningún cambio.');
    }
    return true;
  }
  function recalc(pid){
    const st=pile(pid),count=id=>st.activeHyper.filter(i=>st.hand[i]==='catalog_v3_'+id).length;
    st.powerHandLimit=4;
    st.pokerLimit=7;
    st.powerDrawBonus=0;
  }
  function activate(index){
    const simState=sim(),player=simState.decks[simState.activeIndex],pid=player.id,s=pile(pid),id=s.hand[index],key=String(id||'').replace('catalog_v3_','');
    if(links()?.supported.has(key)&&key!=='040'){links().open(index);return;}
    if(!hypers.has(key)){ctx.toast('Este efecto Hyper todavía no dispone de resolución asistida; no se consumió la carta.');return}
    if(s.currentPhase!=='MAIN'||s.activeHyper.length>=3||s.activeHyper.includes(index)||(s.usedHyperThisTurn||[]).includes(id))return;
    const allowedCopies={};const copies=s.activeHyper.filter(i=>s.hand[i]===id).length;
    if(copies>=(allowedCopies[key]||1)){ctx.toast('Se alcanzó el máximo de copias activas de esa HyperCard.');return;}
    const requirements={'003':[0,1],'049':[0,1]};
    const [power,poker]=requirements[key]||[0,0];
    const powerReady=s.hand.filter((c,i)=>i!==index&&!s.activeHyper.includes(i)).length;
    if(powerReady<power||s.pokerHand.filter(c=>!links()?.protectedCard(pid,c)).length<poker){ctx.toast('No hay suficientes cartas para pagar el coste de esta HyperCard.');return}
    ctx.pushUndo(pid,'HyperCard asistida');
    const entry=ctx.manual().take(pid,index);
    const removed=popPower(pid,power),discarded=popPoker(pid,poker);
    s.hand.push(entry.cardId);s.handOwners.push(entry.ownerId);s.activeHyper.push(s.hand.length-1);
    recalc(pid);
    if(!(s.usedHyperThisTurn??=[]).includes(id))s.usedHyperThisTurn.push(id);
    log(pid,id,'HyperCard activada realmente. Coste: '+removed.length+' Power Cards y '+discarded.length+' Poker Cards. Se actualizan efectos persistentes.');
    if(key==='003')s.destinyDieUsed=false;
    if(['046','062'].includes(key)){
      simState.assistedPending??=[];
      simState.assistedPending.push({type:'HYPER_END_CHIP',actor:pid,round:simState.round,turn:s.turnsTaken,cardId:key,n:1});
      log(pid,id,'Bonificación de +1 ficha programada para la End Phase de esta activación.');
    }
    ctx.render();
  }
  function phase(phase,pid){
    const all=sim().assistedPending||[];
    if(phase==='END_COMPLETE'){
      const ghosts=all.filter(e=>e.type==='GHOST'&&e.target===pid);
      for(const e of ghosts){
        const discarded=popPoker(pid,2,e.actor).length;
        log(e.actor,'037','Carta Fantasma: J'+sim().decks.find(p=>p.id===pid).playerNumber+' descartó '+discarded+' Poker Cards después de completar su End Phase.');
        all.splice(all.indexOf(e),1);
      }
      return;
    }
    links()?.phase(phase,pid);
    if(phase!=='END')return;
    const bonuses=all.filter(e=>e.type==='HYPER_END_CHIP'&&e.actor===pid&&e.turn===pile(pid).turnsTaken);
    for(const e of bonuses){
      const gained=addChips(pid,e.n||1,false);
      log(pid,e.cardId,'Bonificación de End Phase: +'+gained+' ficha(s) por HyperCard activada.');
      all.splice(all.indexOf(e),1);
    }
    for(const c of pile(pid).pokerHand){
      if(c.numberCharmOriginal!==undefined){c.rank=c.numberCharmOriginal;delete c.numberCharmOriginal;}
    }
    const draws=all.filter(e=>e.actor===pid&&e.type==='END_DRAW'&&e.round===sim().round);
    for(const e of draws){const drawn=draw(pid,e.n);log(pid,'045','Artimaña del As: robó '+drawn+' de '+e.n+' Poker Cards pendientes en End Phase.');all.splice(all.indexOf(e),1);}
    const hits=all.filter(e=>e.actor===pid&&e.type==='END_DISCARD'&&e.round===sim().round);
    for(const h of hits){
      log(pid,'039','End Phase: descartó '+popPoker(pid,h.n).length+' Poker Cards.');
      all.splice(all.indexOf(h),1);
    }
  }
  function round(){
    const all=sim().assistedPending||[];
    for(const e of [...all]){
      if(e.type==='GHOST')continue; // GHOST resolves per target after their own End Phase, not at round boundary.
      // Gran Inversor is a per-gain Main Phase bonus, not a round-end payment.
    }
  }
  function choiceState(){if(!pending)return null;return {kind:pending.kind,pid:pending.pid,enemy:pending.enemy,phase:pending.phase,ownId:pending.ownId,done:pending.done,usedOwn:[...(pending.usedOwn||[])],usedEnemy:[...(pending.usedEnemy||[])]};}
  function cancelChoice(){if(!pending)return;const p=pending;log(p.pid||sim().decks[0]?.id,'','La elección del efecto se canceló por falta de opciones legales: '+p.kind+'.');if(p.kind==='peek')sim().pokerDrawPile.unshift(...(p.ordered||[]),...p.cards);pending=null;ctx.setModal(null);drain();}
  return {supported,canPlay,markUsed,usable,hypers,enqueue,finishChain,afterSelection,afterReaction,modalMarkup,choose,shieldRespond,chooseOption,choiceOptions,choiceState,cancelChoice,activate,phase,round,recalc,beginTurn};
};
