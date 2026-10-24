'use strict';
global.window={};
require('../../presets/assisted-links.js');
function regression(factory){
  let game,links,modal=null,events=[],warnings=[];
  const mk=(rank,suit,id)=>({id,rank,suit,symbol:'♠',color:'black'});
  const codes=['001','004','005','029','030','035','040','042','043','044','058','059','060'];
  const cards=Object.fromEntries(codes.map(n=>['catalog_v3_'+n,{id:'catalog_v3_'+n,name:n}]));
  function reset(n=3){
    const decks=Array.from({length:n},(_,i)=>({id:'P'+(i+1),name:'Jugador '+(i+1),playerNumber:i+1}));
    game={mode:'ASSISTED',decks,round:1,activeIndex:0,pokerDrawPile:[mk('A','S','dk1'),mk('8','H','dk2'),mk('9','D','dk3'),mk('K','S','dk4'),mk('6','C','dk5')],
      states:Object.fromEntries(decks.map(p=>[p.id,{hand:[],handOwners:[],drawPile:[],drawOwners:[],pokerHand:[],activeHyper:[],chips:5,turnsTaken:0,currentPhase:'MAIN',powerHandLimit:4,pokerLimit:7}]))};
    modal=null;events=[];warnings=[];
  }
  const manual={
    take:(pid,i)=>{links.onPowerTake(pid,i);const s=game.states[pid],item={cardId:s.hand.splice(i,1)[0],ownerId:s.handOwners.splice(i,1)[0]||pid};s.activeHyper=s.activeHyper.filter(x=>x!==i).map(x=>x>i?x-1:x);return item},
    giveBack:(cid,owner)=>{game.states[owner].drawPile.push(cid);game.states[owner].drawOwners.push(owner)}
  };
  const ctx={sim:()=>game,card:id=>cards[id],log:(...args)=>events.push(args),toast:x=>warnings.push(x),render:()=>{},setModal:x=>modal=x,
    esc:String,pushUndo:()=>{},random:()=>0,shuffle:x=>x,manual:()=>manual,recalc:()=>{},
    drawPoker:(pid,st)=>{const c=game.pokerDrawPile.shift();if(c)st.pokerHand.push(c);return c},
    drawPower:(pid,n)=>{game.states[pid].hand.push('DRAWN-POWER');return n},
    discardPower:(pid,n)=>{game.states[pid].hand.pop();return n},afterSelection:()=>{}};
  reset();links=factory(ctx);
  let results=[];const check=(condition,msg)=>{if(!condition)throw Error(msg)};
  function test(label,fn){try{reset();fn();results.push({label,pass:true})}catch(e){results.push({label,pass:false,error:String(e)})}}
  function prepare(code,poker,extra=['dummy']){const s=game.states.P1;s.hand=['catalog_v3_'+code,...extra];s.handOwners=s.hand.map(()=>'P1');s.pokerHand=poker;return s}
  function activation(code,poker,targets=[],extra=['dummy']){
    const s=prepare(code,poker,extra);links.open(0);
    for(const id of targets)links.option(id);
    return s;
  }
  test('001 Reglas antiguas, once-per-turn and Poker swap',()=>{
    const s=activation('001',[mk('2','S','a'),mk('9','H','b')],[''],['dummy']);
    check(s.activeHyper.length===1,'not activated');
    links.ability(s.activeHyper[0]);links.option(s.pokerHand[0].id);
    check(s.pokerHand.length===1,'swap altered hand count');
    links.ability(s.activeHyper[0]);check(warnings.length===1,'no cooldown');
  });
  test('029 Simbionte changes rank and expires',()=>{
    const s=activation('029',[mk('2','S','a'),mk('9','H','b')],['a']);
    check(s.assistedBindings.length===1,'no binding');
    check(links.score('P1','Par',s.pokerHand,[])===1,'not wild rank');
    const c=s.pokerHand.shift();links.onPokerOut('P1',[c]);
    check(!s.assistedBindings.length&&s.drawPile.includes('catalog_v3_029'),'not returned to deck');
  });
  test('030 Color converts two suits but not ranks',()=>{
    const s=activation('030',[mk('2','S','a'),mk('9','H','b'),mk('5','D','cost'),mk('K','D','d'),mk('J','D','e'),mk('Q','D','f')],['a','b']);
    check(s.assistedBindings.length===1&&s.assistedBindings[0].targets.length===2,'binding missing');
    check(links.score('P1','Color',s.pokerHand,[])===5,'not color wildcard');
    check(links.score('P1','Par',s.pokerHand.slice(0,2),[])===0,'incorrect rank wildcard');
  });
  test('035 Joker adds wildcard; returns Power on spending',()=>{
    const s=activation('035',[mk('2','S','a'),mk('3','H','b'),mk('4','D','c')],[],[]);
    check(s.pokerHand.length===1&&s.pokerHand[0].virtualPower?.type==='JOKER','Joker proxy missing');
    check(links.score('P1','Par',[s.pokerHand[0],mk('A','S','x')],[])===1,'Joker not wildcard');
    const proxy=s.pokerHand.pop();links.onPokerOut('P1',[proxy]);
    check(!s.activeHyper.length&&s.drawPile.includes('catalog_v3_035'),'Joker not returned');
    check(!game.pokerDrawPile.some(x=>x.virtualPower),'Virtual card polluted deck');
  });
  test('040 Sabueso creates Ace not wildcard and returns original owner',()=>{
    links.sabueso({cardId:'catalog_v3_040',playerId:'P1',ownerId:'P2'});links.option('H');
    const c=game.states.P1.pokerHand.pop();
    check(c.rank==='A'&&c.suit==='H','not Ace');
    check(links.score('P1','Par',[c,mk('2','D','x')],[])===0,'Ace was treated as Joker');
    links.onPokerOut('P1',[c]);check(game.states.P2.drawPile.includes('catalog_v3_040'),'original owner not restored');
  });
  test('042 Yellow triggers extra Power next Draw',()=>{
    const s=activation('042',[mk('6','S','a')],['a'],[]);
    links.onCharge('P1',[s.pokerHand[0]]);
    s.turnsTaken=1;links.phase('DRAW_END','P1');
    check(s.hand.includes('DRAWN-POWER'),'Yellow did not grant card');
  });
  test('043 Blue triggers extra two Poker at End',()=>{
    const s=activation('043',[mk('6','S','a')],['a'],[]);
    links.onCharge('P1',[s.pokerHand[0]]);const before=s.pokerHand.length;links.phase('END','P1');
    check(s.pokerHand.length===before+2,'Blue gave wrong cards');
  });
  test('044 Green adds exactly two chips',()=>{
    const s=activation('044',[mk('6','S','a')],['a'],[]);links.onCharge('P1',[s.pokerHand[0]]);
    check(s.chips===7,'Green chips wrong');
  });
  test('058 Red selects other player, delayed Power discard',()=>{
    const s=activation('058',[mk('6','S','a')],['a'],[]);links.onCharge('P1',[s.pokerHand[0]]);
    check(modal?.type==='linked-picker','no choice');links.option('P3');
    check(game.linkedEvents[0].pid==='P3','wrong recipient');game.states.P3.hand.push('dummy');
    links.phase('DRAW_END','P3');check(!game.states.P3.hand.length,'red not executed');
  });
  test('059 Orange discards target Poker next Main',()=>{
    const s=activation('059',[mk('6','S','a')],['a'],[]);links.onCharge('P1',[s.pokerHand[0]]);
    links.option('P2');game.states.P2.pokerHand=[mk('J','C','enemy')];links.phase('MAIN_START','P2');
    check(!game.states.P2.pokerHand.length,'Orange did not discard');
  });
  test('060 Purple reduces one chip next Main',()=>{
    const s=activation('060',[mk('6','S','a')],['a'],[]);links.onCharge('P1',[s.pokerHand[0]]);
    links.option('P2');links.phase('MAIN_START','P2');
    check(game.states.P2.chips===4,'Purple no effect');
  });
  test('All 13 originally missing types declared',()=>{
    for(const code of codes)check(links.supported.has(code),'Missing registry '+code);
  });
  return results;
}
const outcomes=regression(global.window.POKER_BLITZ_ASSISTED_LINKS);
const failures=outcomes.filter(x=>!x.pass);
if(failures.length){console.error(failures);process.exit(1)}
console.log('All linked effects regression scenarios passed: '+outcomes.length);

require('../../presets/assisted-effects.js');
function testCopyAndTrio(factory){
  const check=(x,m)=>{if(!x)throw Error(m)};
  const cards=Object.fromEntries(['004','005','042','043','044','053'].map(n=>['catalog_v3_'+n,{id:'catalog_v3_'+n,name:n,accentColor:n==='004'?'#FF0A68':['042','043','044'].includes(n)?'#FFC31A':'#18E0E5'}]));
  const player=id=>({hand:[],handOwners:[],drawPile:[],drawOwners:[],pokerHand:[],activeHyper:[],chips:0,pokerLimit:7,powerHandLimit:4,currentPhase:'MAIN',turnsTaken:0});
  const game={mode:'ASSISTED',decks:[{id:'A',playerNumber:1,name:'A'},{id:'B',playerNumber:2,name:'B'}],states:{A:player('A'),B:player('B')},pokerDrawPile:[{id:'p1',rank:'A',suit:'S'},{id:'p2',rank:'K',suit:'H'},{id:'p3',rank:'Q',suit:'C'}],round:1,activeIndex:0};
  const logs=[];let modal=null;
  const manual={own:()=>{},take:(pid,index)=>{const s=game.states[pid],item={cardId:s.hand.splice(index,1)[0],ownerId:s.handOwners.splice(index,1)[0]||pid};s.activeHyper=s.activeHyper.filter(i=>i!==index).map(i=>i>index?i-1:i);return item},giveBack:(id,owner)=>{game.states[owner].drawPile.push(id)}};
  const fx=factory({sim:()=>game,card:id=>cards[id],shuffle:x=>x,log:(...x)=>logs.push(x),toast:x=>{throw Error(x)},render:()=>{},
    drawPoker:(pid,s)=>{const c=game.pokerDrawPile.shift();if(c)s.pokerHand.push(c);return c},manual:()=>manual,random:()=>0,type:c=>c?.accentColor==='#FF0A68'?'COUNTER':'SUPER',
    links:()=>({cleanup:()=>{},artifacts:new Set(['042','043','044'])}),setModal:v=>modal=v,modal:()=>modal,esc:String,pushUndo:()=>{}});
  fx.enqueue({cardId:'catalog_v3_004',playerId:'B',copyOrigin:{cardId:'catalog_v3_053',playerId:'A'},originAllowed:true});
  fx.enqueue({cardId:'catalog_v3_053',playerId:'A'});
  fx.finishChain();
  check(game.states.A.pokerHand.length===1,'Original Super not resolved');
  check(game.states.B.pokerHand.length===1,'Counter did not copy same effect after original');
  game.states.A.hand=['catalog_v3_042','catalog_v3_043','catalog_v3_044'];
  game.states.A.handOwners=['A','A','A'];game.states.A.activeHyper=[0,1,2];
  fx.enqueue({cardId:'catalog_v3_005',playerId:'A'});fx.finishChain();
  check(game.states.A.chips===5,'Legendary did not add 5');
  check(game.states.A.activeHyper.length===2,'Legendary did not return an artifact');
  check(game.states.A.drawPile.includes('catalog_v3_042'),'Artifact return missing');
  return 'Counter 004 copies after original; Legendary 005 pays and returns an artifact';
}
console.log(testCopyAndTrio(global.window.POKER_BLITZ_ASSISTED_EFFECTS));
