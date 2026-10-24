/* Poker Blitz: assisted effects with real state changes and explicit supported-card registry. */
window.POKER_BLITZ_ASSISTED_EFFECTS = function createAssistedEffects(ctx){
  const sim=()=>ctx.sim(), card=id=>ctx.card(id), links=()=>ctx.links?.(), draw=(pid,n=1)=>{const st=sim().states[pid];let moved=0;for(let i=0;i<n;i++){if(!sim().pokerDrawPile.length)break;const c=ctx.drawPoker(pid,st,'Efecto asistido: robar Poker Card');if(c)moved++}return moved};
  const pile=(pid)=>sim().states[pid], opponents=pid=>sim().decks.filter(p=>p.id!==pid);
  const random=n=>n<=1?0:ctx.random(n), popPoker=(pid,n=1)=>{const st=pile(pid),out=[];for(let i=0;i<n&&st.pokerHand.length;i++)out.push(st.pokerHand.splice(random(st.pokerHand.length),1)[0]);if(links())links().onPokerOut(pid,out);else sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...out]);return out};
  const pushPower=(pid,n=1,ignoreLimit=false)=>{const s=pile(pid);ctx.manual().own(pid);let count=0;for(let k=0;k<n&&s.drawPile.length;k++){if(!ignoreLimit&&s.hand.length-s.activeHyper.length>=s.powerHandLimit)break;const index=random(s.drawPile.length),cid=s.drawPile.splice(index,1)[0],owner=s.drawOwners.splice(index,1)[0]||pid;s.hand.push(cid);s.handOwners.push(owner);count++}return count};
  const popPower=(pid,n=1)=>{const s=pile(pid),moved=[];for(let k=0;k<n;k++){const allowed=s.hand.map((c,i)=>({c,i})).filter(x=>!s.activeHyper.includes(x.i));if(!allowed.length)break;const pick=allowed[random(allowed.length)],it=ctx.manual().take(pid,pick.i);ctx.manual().giveBack(it.cardId,it.ownerId);moved.push(it.cardId)}return moved};
  const movePoker=(from,to,n=1)=>{const st=pile(from),dst=pile(to),out=[];for(let k=0;k<n&&st.pokerHand.length;k++){const x=st.pokerHand.splice(random(st.pokerHand.length),1)[0];dst.pokerHand.push(x);out.push(x)}links()?.cleanup();return out};
  const swapPoker=(a,b,n=1)=>{let x=pile(a),y=pile(b),count=0;for(let k=0;k<n&&x.pokerHand.length&&y.pokerHand.length;k++){let i=random(x.pokerHand.length),j=random(y.pokerHand.length);[x.pokerHand[i],y.pokerHand[j]]=[y.pokerHand[j],x.pokerHand[i]];count++}links()?.cleanup();return count};
  const addChips=(pid,n)=>{const st=pile(pid),before=st.chips||0;st.chips=Math.max(0,before+n);return st.chips-before};
  const log=(pid,id,description)=>ctx.log(pid,'Efecto asistido',description,card(id)||card('catalog_v3_'+id)||null);
  const ids=(s)=>new Set(s);
  const usable=ids(['003','004','005','006','007','008','009','010','011','012','013','014','015','016','017','018','019','020','021','022','023','024','026','031','032','033','034','036','037','038','039','040','041','045','047','048','051','052','053','054','055','056','057','061','063','064']);
  const hypers=ids(['001','002','025','027','028','029','030','035','042','043','044','046','049','050','058','059','060','062']);
  let queue=[],pending=null,deferred=[];
  function supported(id){const match=String(id||'').match(/catalog_v3_(\d{3})/);const code=match?.[1];return !!code&&(usable.has(code)||hypers.has(code));}
  function canPlay(id,pid){if(!supported(id))return false;const s=pile(pid);if(!s)return false;const num=String(id).slice(-3);const freePower=s.hand.filter(x=>x===id).length?Math.max(0,s.hand.length-s.activeHyper.length-1):s.hand.length-s.activeHyper.length;
    const costPoker={ '007':2 }; const costPower={'007':1,'032':1};
    if((costPoker[num]||0)>s.pokerHand.length)return false;
    if((costPower[num]||0)>freePower)return false;
    if(num==='031'&&(s.chips||0)<1)return false;
    if(num==='003'&&!s.dieBase)return false;
    if(['006','009','010','012','013','026','038','048','052','055','056','064'].includes(num)&&!opponents(pid).length)return false;
    if(num==='008'&&!s.activeHyper.length)return false;
    if(num==='009'&&!opponents(pid).some(p=>pile(p.id).chips>=5))return false;
    if(num==='010'&&!opponents(pid).some(p=>pile(p.id).pokerHand.length>=7))return false;
    if(num==='012'&&(!s.pokerHand.length||!opponents(pid).some(p=>pile(p.id).pokerHand.length)))return false;
    if(num==='013'&&(!s.pokerHand.length||!opponents(pid).some(p=>pile(p.id).pokerHand.length)))return false;
    if(num==='023'&&(s.pokerHand.length<2||!s.pokerHand.some(c=>/^([2-9]|10)$/.test(c.rank))))return false;
    if(num==='026'&&(sim().pokerDrawPile.length<2||!opponents(pid).length))return false;
    if(num==='047'&&!active(pid,'046')&&s.pokerHand.length<5)return false;
    if(num==='051'&&!sim().decks.some(p=>pile(p.id).activeHyper.length))return false;
    if(num==='055'&&(s.pokerHand.length<2||!opponents(pid).some(p=>pile(p.id).chips>=1)))return false;
    if((num==='057'||num==='063')&&!active(pid,'062')&&s.pokerHand.length<2)return false;
    if(num==='017'&&(!s.assistedLastSuper||s.assistedLastSuper==='catalog_v3_017'))return false;
    if(num==='040'&&!active(pid,'046')&&s.pokerHand.length<1)return false;
    if(num==='005'&&new Set(s.activeHyper.map(i=>String(s.hand[i]).slice(-3)).filter(x=>links()?.artifacts.has(x))).size<3)return false;
    if(num==='004'){const source=sim().chain?.stack?.[0];if(!source||ctx.type?.(card(source.cardId))!=='SUPER'||source.cardId==='catalog_v3_040')return false;}
    if(num==='041'&&s.pokerHand.length<2)return false;
    if(num==='045'&&!active(pid,'046')&&(s.pokerHand.length<1||freePower<1))return false;
    if(num==='061'&&!active(pid,'062')&&s.pokerHand.length<5)return false;
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
    const options=title==='El gran tifón'?[...sim().decks]:opponents(pid);
    const players=eligible?options.filter(p=>eligible(p.id,pile(p.id))):options;
    if(!players.length){log(pid,'','Este efecto necesita otro jugador. No hay objetivo válido.');return true}
    pending={players,title,callback};
    ctx.setModal({type:'assisted-target'});ctx.render();return false;
  }
  function modalMarkup(){
    if(!pending)return '';
    return '<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+ctx.esc(pending.title)+'</h2></div><div class="modal-content"><p>Elige el objetivo del efecto. El programa actualizará las cartas y fichas automáticamente.</p><div style="display:flex;gap:10px;flex-wrap:wrap">'+pending.players.map(p=>'<button class="btn primary" data-action="assist-target" data-player="'+p.id+'">J'+p.playerNumber+' · '+ctx.esc(p.name)+'</button>').join('')+'</div></div></div></div>';
  }
  function choose(id){
    if(!pending||!pending.players.some(p=>p.id===id))return;
    const f=pending.callback;pending=null;ctx.setModal(null);
    if(active(id,'025')){draw(id,1);log(id,'025','Escudo de cartas: robó una Poker Card al ser seleccionado.')}
    if(active(id,'050')){
      const st=pile(id);st.assistedDefenses??={};const stamp=String(sim().round);
      if(!st.assistedDefenses[stamp]){st.assistedDefenses[stamp]=true;log(id,'050','Casco anti-efectos: negó la primera selección recibida en esta ronda.');drain();return;}
    }
    f(id);links()?.cleanup();drain();
  }
  function enqueue(item){queue.push(item);const c=card(item.cardId),st=pile(item.playerId);if(c&&ctx.type?.(c)==='SUPER'&&c.id!=='catalog_v3_017')st.assistedLastSuper=c.id}
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
  function active(pid,id){return pile(pid).activeHyper.some(i=>pile(pid).hand[i]==='catalog_v3_'+id);}
  function die(pid){const n=1+random(6);pile(pid).dieBase=n;pile(pid).dieModifier=0;log(pid,'','Dado físico simulado: '+n+'.');return n;}
  function apply(item){
    const id=String(item.cardId||'').replace('catalog_v3_',''),pid=item.playerId;
    const s=pile(pid);
    const doTarget=(title,fn,eligible=null)=>target(pid,title,(enemy)=>{const st=pile(enemy);fn(enemy,st);},eligible);
    switch(id){
      case '004':{
        const origin=item.copyOrigin;
        if(origin&&item.originAllowed&&ctx.type?.(card(origin.cardId))==='SUPER'){
          deferred.push({cardId:origin.cardId,playerId:pid,copied:true,copyDepth:1});
          log(pid,id,'Escudo Resplandeciente copia '+(card(origin.cardId)?.name||origin.cardId)+' después de resolver la SuperCard.');
        }else log(pid,id,'No había SuperCard válida para copiar.');
        break;
      }
      case '040':{
        if(!active(pid,'046')){const cost=popPoker(pid,1);log(pid,id,'Pagó '+cost.length+' Poker Card por Sabueso de Ases.');}
        links()?.sabueso(item);return false;
      }
      case '003':{if(s.dieBase){s.dieModifier=(s.dieModifier||0)+1;log(pid,id,'Manipuló en +1 el último dado lanzado.')}else log(pid,id,'No se había lanzado ningún dado que modificar.');break}
      case '005':{const artifacts=s.activeHyper.filter(i=>['042','043','044','058','059','060'].includes(String(s.hand[i]).slice(-3)));const different=[...new Set(artifacts.map(i=>String(s.hand[i]).slice(-3)))];if(different.length>=3){addChips(pid,5);const taken=ctx.manual().take(pid,artifacts[0]);ctx.manual().giveBack(taken.cardId,taken.ownerId);recalc(pid);log(pid,id,'Tres artilugios diferentes: +5 fichas, devolvió un artilugio.')}else log(pid,id,'Se requieren tres artilugios distintos activos para cobrar.');break}
      case '007':{if(s.pokerHand.length<2||s.hand.length-s.activeHyper.length<1){log(pid,id,'Coste de búsqueda insuficiente.');break}popPoker(pid,2);popPower(pid,1);const n=pushPower(pid,1);log(pid,id,'Pagó costes y buscó una Power Card del deck ('+n+' obtenida).');break}
      case '011':for(const player of sim().decks){pushPower(player.id,1);draw(player.id,1)}log(pid,id,'Todos los jugadores robaron hasta 1 Power Card y 1 Poker Card.');break;
      case '053':log(pid,id,'Robó '+draw(pid,1)+' Poker Card.');break;
      case '032':{const x=popPower(pid,1).length;if(!x){log(pid,id,'Coste no pagado: requiere descartar 1 Power Card.');break;}log(pid,id,'Descartó 1 Power Card y robó '+draw(pid,2)+' Poker Cards.');break}
      case '031':if(s.chips<1){log(pid,id,'No hay fichas para pagar el coste.');break}addChips(pid,-1);log(pid,id,'Pagó 1 ficha, robó '+draw(pid,1)+' Poker Card y '+pushPower(pid,1)+' Power Card.');break;
      case '054':log(pid,id,'Recicló esta SuperCard y robó '+pushPower(pid,1)+' Power Card.');break;
      case '057':{const spent=active(pid,'062')?0:popPoker(pid,2).length;log(pid,id,'Pagó '+spent+' Poker Cards y robó '+pushPower(pid,1)+' Power Card.');break}
      case '063':{const spent=active(pid,'062')?0:popPoker(pid,2).length;log(pid,id,'Pagó '+spent+' Poker Cards. '+(s.chips<=8?'Robó '+draw(pid,2)+' Poker Cards por tener 8 fichas o menos.':'No robó: más de 8 fichas.'));break}
      case '036':{const r=die(pid);log(pid,id,'Dado '+r+'. Robó '+([1,6].includes(r)?draw(pid,2):0)+' Poker Cards.');break}
      case '016':{const peek=sim().pokerDrawPile.splice(0,Math.min(3,sim().pokerDrawPile.length));if(peek.length){const order={A:14,K:13,Q:12,J:11};peek.sort((a,b)=>(order[b.rank]||Number(b.rank))-(order[a.rank]||Number(a.rank)));s.pokerHand.push(peek.shift());sim().pokerDrawPile.unshift(...peek);const d=popPoker(pid,1).length;log(pid,id,'Miró las 3 superiores, eligió una, devolvió el resto arriba y descartó '+d+' Poker Card.')}else log(pid,id,'El mazo de Poker estaba vacío.');break}
      case '017':{const last=s.assistedLastSuper;if(last&&last!=='catalog_v3_017'&&supported(last)){log(pid,id,'Copió la última SuperCard de este turno: '+(card(last)?.name||last)+'.');queue.unshift({cardId:last,playerId:pid});}else log(pid,id,'No había SuperCard válida que copiar.');break}
      case '018':{const r=die(pid);if(r%2===0){log(pid,id,'Dado par: robó '+draw(pid,2)+' Poker Cards.')}else{for(const p of opponents(pid))draw(p.id,1);log(pid,id,'Dado impar: todos los rivales robaron una Poker Card.')}break}
      case '019':{const r=die(pid);if(r%2===0){let a=popPoker(pid,2);log(pid,id,'Dado par: descartó '+a.length+' Poker Cards.');}else{for(const p of opponents(pid))popPoker(p.id,1);log(pid,id,'Dado impar: los rivales descartaron una Poker Card.')}break}
      case '014':{const r=die(pid);if(r<=2)log(pid,id,'Dado '+r+': descartó '+popPoker(pid,r===1?2:1).length+' Poker Cards.');else if(r===3){let out=popPoker(pid,1);log(pid,id,'Dado 3: intercambió '+out.length+' Poker Card con el mazo; robó '+draw(pid,out.length)+'.');}else{log(pid,id,'Dado '+r+': robó '+draw(pid,r===4?1:r===5?2:3)+' Poker Cards.')}break}
      case '015':{const r=die(pid),n=popPoker(pid,r).length;log(pid,id,'Dado '+r+': intercambió '+n+' Poker Cards aleatorias; robó '+draw(pid,n)+'.');break}
      case '020':{const r=die(pid);if(r%2===0){sim().decks.forEach(p=>draw(p.id,1));log(pid,id,'Dado par: todos robaron una Poker Card.')}else{for(let i=0;i<sim().decks.length;i++){const a=sim().decks[i],b=sim().decks[(i+1)%sim().decks.length];if(a.id!==b.id)swapPoker(a.id,b.id,2)}log(pid,id,'Dado impar: se resolvieron intercambios circulares.')}break}
      case '021':{const list=sim().decks,transfers=list.map(p=>pile(p.id).pokerHand.length?pile(p.id).pokerHand.splice(random(pile(p.id).pokerHand.length),1)[0]:null);list.forEach((p,i)=>{const card=transfers[i];if(card)pile(list[(i+1)%list.length].id).pokerHand.push(card)});log(pid,id,'Intercambio circular real de una Poker Card por participante.');break}
      case '022':{const suit=['S','H','D','C'][random(4)],len=sim().pokerDrawPile.length,n=draw(pid,1),c=n?s.pokerHand.at(-1):null;if(c&&c.suit===suit){draw(pid,1);log(pid,id,'Declaró '+suit+', acertó y obtuvo una Poker Card adicional.')}else if(c){const gone=s.pokerHand.pop();sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,gone]);popPoker(pid,1);log(pid,id,'Declaró '+suit+', falló; devolvió la carta y descartó otra Poker Card.')}else log(pid,id,'Mazo vacío.');break}
      case '023':{if(s.pokerHand.length<2){log(pid,id,'No hay cartas suficientes para pagar coste y transformar otra.');break}const discard=popPoker(pid,1);const target=s.pokerHand.find(c=>/^([2-9]|10)$/.test(c.rank));if(target){target.originalRank??=target.rank;target.rank='J';log(pid,id,'Convirtió '+target.originalRank+' en J del mismo símbolo, pagando '+discard.length+' Poker Card.')}else log(pid,id,'No había Poker Card numérica válida.');break}
      case '024':break; // Physical reaction window is provided by the shared rules engine.
      case '026':log(pid,id,'Robó '+draw(pid,2)+' Poker Cards. Comparte una con un rival seleccionado.');return doTarget('Compartir es ganar',enemy=>{movePoker(pid,enemy,1);log(pid,id,'Entregó una Poker Card a J'+sim().decks.find(p=>p.id===enemy).playerNumber+'.')});
      case '008':{const r=die(pid);if(r%2===0){const i=s.activeHyper.at(-1);if(i!==undefined){const removed=ctx.manual().take(pid,i);ctx.manual().giveBack(removed.cardId,removed.ownerId);log(pid,id,'Dado par: devolvió una HyperCard propia.')}else log(pid,id,'No había HyperCard propia para devolver.')}else return doTarget('Destello relámpago',enemy=>{const st=pile(enemy);let n=0;for(let k=0;k<2&&st.activeHyper.length;k++){const i=st.activeHyper.at(-1),removed=ctx.manual().take(enemy,i);ctx.manual().giveBack(removed.cardId,removed.ownerId);n++}log(pid,id,'Dado impar: devolvió '+n+' HyperCards del rival.')});break}
      case '009':return doTarget('Maestro de fichas', (enemy,other)=>{const n=other.chips>=5?Math.floor(other.chips/5):0;if(n){addChips(enemy,-n);addChips(pid,n)}log(pid,id,'Robó '+n+' fichas a J'+sim().decks.find(p=>p.id===enemy).playerNumber+'.')},enemy=>pile(enemy).chips>=5);
      case '010':return doTarget('Operación táctica',(enemy,other)=>{const n=other.pokerHand.length>=7?movePoker(enemy,pid,1).length:0;log(pid,id,'Robó '+n+' Poker Cards al rival con mínimo 7.')},enemy=>pile(enemy).pokerHand.length>=7);
      case '012':return doTarget('Espía vs Espía',enemy=>{let a=popPoker(enemy,1).length,b=popPoker(pid,1).length;log(pid,id,'Descartó '+a+' Poker Card rival y '+b+' propia.')});
      case '013':return doTarget('Intercambio forzado',enemy=>{const n=swapPoker(pid,enemy,2);log(pid,id,'Intercambió '+n+' Poker Cards con el rival.')});
      case '055':return doTarget('Secuaz de las fichas',enemy=>{const n=Math.min(1,pile(enemy).chips||0);if(n&&s.pokerHand.length>=2){addChips(enemy,-n);addChips(pid,n);movePoker(pid,enemy,2);}log(pid,id,n?'Robó una ficha y pagó dos Poker Cards.':'No había condiciones para pagar el coste.')},enemy=>pile(enemy).chips>=1);
      case '056':return doTarget('Falso limitador',enemy=>{const st=pile(enemy);const n=Math.max(0,st.pokerHand.length-5),discarded=popPoker(enemy,n).length,drawn=pushPower(enemy,Math.floor(discarded/3),true);log(pid,id,'Rival descartó '+discarded+' Poker Cards y obtuvo '+drawn+' Power Cards.')});
      case '047':{const paid=active(pid,'046')?0:popPoker(pid,5).length;draw(pid,5);log(pid,id,'Coste pagado: '+paid+' Poker Cards (0 si tenía Maldición activa).');return doTarget('El hueso',enemy=>{const count=swapPoker(pid,enemy,2);const hasAce=s.pokerHand.some(c=>c.rank==='A');if(hasAce)popPoker(enemy,2);log(pid,id,'Intercambió '+count+' Poker Cards con el rival; efecto de As '+(hasAce?'activado':'no activado')+'.')})}
      case '051':return doTarget('El gran tifón',enemy=>{const st=pile(enemy);if(!st.activeHyper.length){log(pid,id,'El rival no tiene HyperCards activas.');return}const i=st.activeHyper.at(-1),item=ctx.manual().take(enemy,i);ctx.manual().giveBack(item.cardId,item.ownerId);recalc(enemy);log(pid,id,'Devolvió una HyperCard rival a su propietario.')},enemy=>pile(enemy).activeHyper.length>0);
      case '038':return doTarget('Espía principiante',enemy=>{log(pid,id,'Observó 2 Poker Cards rivales al azar e intercambió '+swapPoker(pid,enemy,1)+' Poker Card.')});
      case '006':return doTarget('Tiro por la culata',enemy=>log(pid,id,'Rival descartó '+popPoker(enemy,1).length+' Poker Card.'));
      case '034':log(pid,id,'Robó '+draw(pid,1)+' Poker Card como respuesta al uso de Power Card.');break;
      case '048':return doTarget('Me llaman Robin Hood',enemy=>{const n=Math.min(1,pile(enemy).chips||0);addChips(enemy,-n);addChips(pid,n);log(pid,id,'Robó '+n+' ficha al rival.')},enemy=>pile(enemy).chips>=1);
      case '052':return doTarget('Agujero negro',enemy=>{const st=pile(enemy);if(st.activeHyper.length){let i=st.activeHyper.at(-1),it=ctx.manual().take(enemy,i);ctx.manual().giveBack(it.cardId,it.ownerId);recalc(enemy);log(pid,id,'Destruyó una HyperCard rival.')}else if(st.dieBase){st.dieModifier=(st.dieModifier||0)+1;log(pid,id,'Modificó un dado rival en +1.')}else log(pid,id,'No hay HyperCard ni dado al que afectar.')});
      case '064':{const r=die(pid);return doTarget('¿Tú también juegas dados?',enemy=>log(pid,id,r%2===0?'Rival robó '+draw(enemy,1)+' Poker Card.':'Rival descartó '+popPoker(enemy,2).length+' Poker Cards.'))}
      case '037':{const others=opponents(pid);for(const p of others)draw(p.id,2);sim().assistedPending??=[];sim().assistedPending.push({round:sim().round+1,type:'GHOST',actor:pid});log(pid,id,'Cada rival robó dos Poker Cards. Penalización programada para próxima ronda.');break}
      case '039':{log(pid,id,'Robó '+draw(pid,3)+' Poker Cards.');sim().assistedPending??=[];sim().assistedPending.push({round:sim().round,type:'END_DISCARD',actor:pid,n:5});break}
      case '041':{const values={J:11,Q:12,K:13,A:11};let match=null;for(let i=0;i<s.pokerHand.length;i++){for(let j=i+1;j<s.pokerHand.length;j++){const a=s.pokerHand[i],b=s.pokerHand[j];if(a.rank!==b.rank&&(values[a.rank]||Number(a.rank))+(values[b.rank]||Number(b.rank))===21){match=[j,i];break}}if(match)break}if(match){const cards=match.map(i=>s.pokerHand.splice(i,1)[0]);sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...cards]);addChips(pid,1);s.chargeReplacement=(s.chargeReplacement||0)+2;log(pid,id,'Blackjack: cobró 1 ficha; devolvió dos Poker Cards y programó reposición.')}else log(pid,id,'No se encontró par de valores diferentes que sumen 21.');break}
      case '045':
      case '061':{if(id==='045'&&!active(pid,'046')){popPoker(pid,1);popPower(pid,1);log(pid,id,'Pagó un Poker Card y una Power Card al no tener Maldición activa.');}if(id==='061'&&!active(pid,'062')){popPoker(pid,5);log(pid,id,'Pagó cinco Poker Cards al no tener Vínculo noble activo.');}const wanted=id==='045'?['A']:['J','Q','K'],indexes=s.pokerHand.map((c,i)=>wanted.includes(c.rank)?i:-1).filter(i=>i>=0),cards=indexes.map(i=>s.pokerHand[i]);for(let j=indexes.length-1;j>=0;j--)s.pokerHand.splice(indexes[j],1);sim().pokerDrawPile=ctx.shuffle([...sim().pokerDrawPile,...cards]);addChips(pid,cards.length*2);s.chargeReplacement=(s.chargeReplacement||0)+cards.length;log(pid,id,'Cobró '+cards.length*2+' fichas con '+cards.length+' cartas '+wanted.join('/')+'.');break}
      default:log(pid,id,'El efecto requiere un módulo adicional; no se ha aplicado ningún cambio.');
    }
    return true;
  }
  function recalc(pid){
    const st=pile(pid),count=id=>st.activeHyper.filter(i=>st.hand[i]==='catalog_v3_'+id).length;
    st.powerHandLimit=4+count('027');
    st.pokerLimit=7+count('028')+3*count('046')-3*count('062');
    st.powerDrawBonus=count('002');
  }
  function activate(index){
    const simState=sim(),player=simState.decks[simState.activeIndex],pid=player.id,s=pile(pid),id=s.hand[index],key=String(id||'').replace('catalog_v3_','');
    if(links()?.supported.has(key)&&key!=='004'&&key!=='005'&&key!=='040'){links().open(index);return;}
    if(!hypers.has(key)){ctx.toast('Este efecto Hyper todavía no dispone de resolución asistida; no se consumió la carta.');return}
    if(s.currentPhase!=='MAIN'||s.activeHyper.length>=3||s.activeHyper.includes(index))return;
    const allowedCopies={'027':2};const copies=s.activeHyper.filter(i=>s.hand[i]===id).length;
    if(copies>=(allowedCopies[key]||1)){ctx.toast('Se alcanzó el máximo de copias activas de esa HyperCard.');return;}
    const requirements={ '001':[1,1], '002':[1,2], '025':[0,2], '027':[1,1],'028':[0,2],'049':[1,2],'050':[1,1]};
    const [power,poker]=requirements[key]||[0,0];
    const powerReady=s.hand.filter((c,i)=>i!==index&&!s.activeHyper.includes(i)).length;
    if(powerReady<power||s.pokerHand.length<poker){ctx.toast('No hay suficientes cartas para pagar el coste de esta HyperCard.');return}
    ctx.pushUndo(pid,'HyperCard asistida');
    const entry=ctx.manual().take(pid,index);
    const removed=popPower(pid,power),discarded=popPoker(pid,poker);
    s.hand.push(entry.cardId);s.handOwners.push(entry.ownerId);s.activeHyper.push(s.hand.length-1);
    recalc(pid);
    log(pid,id,'HyperCard activada realmente. Coste: '+removed.length+' Power Cards y '+discarded.length+' Poker Cards. Se actualizan efectos persistentes.');
    if(key==='049'){simState.assistedPending??=[];simState.assistedPending.push({type:'INVEST',actor:pid,round:simState.round,remaining:2})}
    ctx.render();
  }
  function phase(phase,pid){
    links()?.phase(phase,pid);
    if(phase!=='END')return;
    const all=sim().assistedPending||[];
    const hits=all.filter(e=>e.actor===pid&&e.type==='END_DISCARD'&&e.round===sim().round);
    for(const h of hits){log(pid,'039','End Phase: descartó '+popPoker(pid,h.n).length+' Poker Cards.');all.splice(all.indexOf(h),1)}
  }
  function round(){
    const all=sim().assistedPending||[];
    for(const e of [...all]){
      if(e.type==='GHOST'&&sim().round>=e.round){for(const p of sim().decks)popPoker(p.id,3);log(e.actor,'037','Ronda posterior: se descartaron hasta 3 Poker Cards por jugador.');all.splice(all.indexOf(e),1)}
      if(e.type==='INVEST'){if(!active(e.actor,'049')){all.splice(all.indexOf(e),1);log(e.actor,'049','Gran inversor salió de la mesa: cesan los cobros pendientes.');continue}addChips(e.actor,2);e.remaining--;log(e.actor,'049','Gran inversor: +2 fichas por cierre de ronda.');if(e.remaining<=0){all.splice(all.indexOf(e),1);const st=pile(e.actor),ix=st.activeHyper.find(i=>st.hand[i]==='catalog_v3_049');if(ix!==undefined){const it=ctx.manual().take(e.actor,ix);ctx.manual().giveBack(it.cardId,it.ownerId);recalc(e.actor)}}}
    }
  }
  return {supported,canPlay,markUsed,usable,hypers,enqueue,finishChain,afterSelection,afterReaction,modalMarkup,choose,activate,phase,round,recalc};
};
