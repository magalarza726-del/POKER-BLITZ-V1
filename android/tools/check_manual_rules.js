'use strict';
function regression(){
  const assert=require('node:assert/strict');
  global.window={};
  require('../../presets/manual-game-rules.js');
  const factory=global.window.POKER_BLITZ_MANUAL_RULES;
  const makePoker=(rank,suit,id)=>({rank,suit,id});
  const cards={
    super:{id:'super',name:'SuperCard',accentColor:'#18E0E5'},
    catalog_v3_024:{id:'catalog_v3_024',name:'ENTENDÍ LA REFERENCIA',accentColor:'#18E0E5'},
    catalog_v3_033:{id:'catalog_v3_033',name:'HE DICHO QUE NO',accentColor:'#FF0A68'},
    catalog_v3_064:{id:'catalog_v3_064',name:'COUNTER DADOS',accentColor:'#FF0A68'}
  };
  const player=(id,hand,poker)=>({hand:[...hand],handOwners:hand.map(()=>id),drawPile:[],drawOwners:[],activeHyper:[],chips:0,pokerHand:[...poker],pokerLimit:7,powerHandLimit:4,turnsTaken:0,chargeReplacement:0,currentPhase:'MAIN'});
  const sim={decks:[{id:'P1',name:'Uno',playerNumber:1},{id:'P2',name:'Dos',playerNumber:2}],states:{
    P1:player('P1',['super','catalog_v3_024'],[makePoker('7','S','p1'),makePoker('7','D','p2'),makePoker('K','C','p3')]),
    P2:player('P2',['catalog_v3_033'],[makePoker('Q','S','p4')])
  },pokerDrawPile:[makePoker('A','H','p5'),makePoker('K','S','p6'),makePoker('9','H','p7')],turnIndex:0,activeIndex:0,round:1,goal:30,chargeSelection:[],undoStacks:{P1:[],P2:[]},histories:{P1:[],P2:[]}};
  let modal=null;const events=[];
  const ctx={sim:()=>sim,modal:()=>modal,setModal:x=>{modal=x},card:id=>cards[id],type:c=>c?.accentColor==='#FF0A68'?'COUNTER':'SUPER',
    shuffle:a=>a,log:(id,action,detail)=>events.push({id,action,detail}),toast:s=>{throw Error('Unexpected toast: '+s)},render:()=>{},
    drawPoker:(id,st)=>{const card=sim.pokerDrawPile.pop();if(card)st.pokerHand.push(card);return card},
    pushUndo:()=>{},drawPhase:(d,st)=>{st.currentPhase='MAIN'},phaseLabel:s=>s,
    current:()=>({d:sim.decks[sim.activeIndex],s:sim.states[sim.decks[sim.activeIndex].id]}),esc:String};
  const rules=factory(ctx);
  rules.changePhase('CHARGE');
  sim.chargeSelection=[0,1];rules.charge('Par');
  assert.equal(sim.states.P1.chips,1);
  assert.equal(sim.states.P1.pokerHand.length,1);
  assert.equal(sim.states.P1.chargeReplacement,2);
  rules.changePhase('END');
  assert.equal(sim.states.P1.pokerHand.length,3);
  rules.finishTurn();assert.equal(sim.turnIndex,1);
  // Return to actor in a test harness, without altering the committed gameplay.
  sim.turnIndex=0;sim.activeIndex=0;sim.states.P1.currentPhase='MAIN';
  rules.useCard('P1',0);
  assert.equal(modal.type,'counter-window');
  rules.counterPlay(0);rules.counterPass();
  assert.equal(sim.states.P1.drawPile.includes('super'),true);
  assert.equal(sim.states.P2.drawPile.includes('catalog_v3_033'),true);
  assert.equal(events.some(e=>e.action==='Efecto negado'),true);
  rules.useCard('P1',0);rules.counterPass();
  assert.equal(modal.type,'reference-reaction');
  rules.pressReference('P2');
  assert.equal(sim.reference.step,'discard');
  rules.discardReference(0);
  assert.equal(sim.reference,null);
  assert.equal(events.some(e=>e.action==='Premio de reacción'),true);
  assert.equal(events.some(e=>e.action==='Penalización de reacción'),true);
  // Traded Power Card must return to original owner's deck, not its last controller.
  sim.states.P2.hand.push('super');sim.states.P2.handOwners.push('P1');
  const moved=rules.take('P2',sim.states.P2.hand.length-1);
  assert.equal(moved.ownerId,'P1');
  rules.giveBack(moved.cardId,moved.ownerId);
  assert.equal(sim.states.P1.drawPile.filter(x=>x==='super').length,2);
  console.log('Manual rule regression OK: charge, phases, counter chains, physical reaction, original ownership.');
}
regression();
