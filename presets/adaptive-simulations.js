/* Poker Blitz · adaptive simulation strategies. All changes are committed only after a completed run.
   The standard engine remains authoritative for game rules, statistics and seeds. */
window.POKER_BLITZ_ADAPTIVE=(function(){
 'use strict';
 const MODES=['BALANCE','DECKS','AI','NEW_DECK'];
 const unique=players=>[...new Map(players.map(p=>[p.id,p])).values()];
 const copy=d=>JSON.parse(JSON.stringify(d));
 const equal=(a,b)=>JSON.stringify(a||[])===JSON.stringify(b||[]);
 function makeSession({mode='BALANCE',players=[],count=1,seed=1,frozenDeckIds=[],frozenAiIds=[],newDeckStyle='equilibrado',lab,trainer,engine,catalog,type,getCard,cancel,onEvent}={}){
   if(!MODES.includes(mode))throw Error('Modo de simulación no reconocido.');
   if(!Array.isArray(players)||!players.length)throw Error('Faltan participantes.');
   const log=[],origin=new Map(unique(players).map(p=>[p.id,{cardIds:[...(p.cardIds||[])],hyperCardIds:[...(p.hyperCardIds||[])]}]));
   const changedDecks=new Set(),trainedAi=new Set();
   const frozenDecks=new Set(frozenDeckIds),frozenAis=new Set(frozenAiIds);
   const epoch=Math.max(10,Math.ceil(count/4));
   let newDeck=null,champion=-Infinity,iteration=0;
   const event=message=>{log.push(message);onEvent?.(message);};
   const check=()=>{if(cancel?.cancelled)throw Object.assign(new Error('Simulación cancelada.'),{cancelled:true});};
   const ctx=(n)=>({engine,cancel,games:2,seed:(seed+Math.imul(n,137699))>>>0,maxRounds:40,pokerDeckCount:players.length>=8?2:1});
   const opponents=p=>players.filter(x=>x.participantId!==p.participantId).slice(0,9).map(copy);
   const options=n=>({seed:(seed+Math.imul(n+1,2654435761))>>>0,iterations:2,games:2,style:newDeckStyle,aggression:3,ease:'media'});
   async function buildNew(n=0){
     check();const rivals=players.slice(1).map(copy);
     if(!rivals.length)throw Error('La creación requiere al menos un deck rival.');
     const result=await lab.create(catalog,rivals,type,options(n),ctx(n));
     check();
     if(!result.best||!lab.legal(result.best,type))throw Error('No se consiguió generar un deck legal.');
     const trial=result.metrics?.score??-Infinity;
     // Compare candidate to incumbent on the same independent evaluation seeds.
     const baseline=n>0?await lab.evaluate({...newDeck,participantId:'LAB-CANDIDATE'},rivals,ctx(500+n)):null;
     const candidate=n>0?await lab.evaluate({...newDeck,...result.best,participantId:'LAB-CANDIDATE'},rivals,ctx(500+n)):null;
     const accepted=n===0||(candidate?.score??-Infinity)>(baseline?.score??-Infinity)+0.00001;
     if(accepted){
       newDeck.cardIds=[...result.best.cardIds];newDeck.hyperCardIds=[...result.best.hyperCardIds];
       champion=trial;changedDecks.add(newDeck.id);
     }
     (newDeck.versionHistory??=[]).push(...result.history.map((v,i)=>({...v,simulationMode:'NEW_DECK',stage:n,createdAt:new Date().toISOString(),accepted:accepted&&!!v.accepted})));
     event('Nuevo Deck · etapa '+(n+1)+': '+(accepted?'composición adoptada':'sin mejora verificada')+
       ' · '+newDeck.cardIds.length+' Power / '+newDeck.hyperCardIds.length+' Hyper · '+result.history.length+' propuestas');
   }
   async function evolveDecks(n){
     const members=unique(players);
     for(let i=0;i<members.length;i++){
       check();const p=members[i];
       if(frozenDecks.has(p.id)){if(n===1)event('Deck congelado: '+p.name);continue;}
       const rivals=opponents(p);if(!rivals.length)continue;
       const before=copy({cardIds:p.cardIds,hyperCardIds:p.hyperCardIds}),initial=origin.get(p.id)||before;
       const outcome=await lab.improve(p,rivals,catalog,type,{seed:(seed+n*1013+i)>>>0,iterations:2,games:2},
         {...ctx(n*100+i),original:initial});
       check();
       const changed=!equal(before.cardIds,outcome.best.cardIds)||!equal(before.hyperCardIds,outcome.best.hyperCardIds);
       if(changed){
         for(const x of players.filter(x=>x.id===p.id)){x.cardIds=[...outcome.best.cardIds];x.hyperCardIds=[...outcome.best.hyperCardIds];}
         changedDecks.add(p.id);
       }
       for(const x of players.filter(x=>x.id===p.id)){
         x.versionHistory??=[];
         x.versionHistory.push(...outcome.trials.map(v=>({...v,mode:'improve',simulationMode:'DECKS',createdAt:new Date().toISOString()})));
         x.versionHistory=x.versionHistory.slice(-180);
         x.optimizationOrigin??=copy(initial);
       }
       event('Deck '+p.name+' · etapa '+n+': '+(changed?'mejorado':'sin mejora')+
         ' · similitud '+(outcome.similarity*100).toFixed(1)+'% · '+outcome.trials.length+' variantes.');
     }
   }
   async function trainAis(n){
     const members=unique(players);
     for(let i=0;i<members.length;i++){
       check();const p=members[i];
       if(frozenAis.has(p.id)){if(n===0)event('IA congelada: '+p.name);continue;}
       const snapshot=copy(p),rivals=players.filter(x=>x.id!==p.id).slice(0,9).map(copy);
       const result=await trainer.train({deck:snapshot,decks:rivals,iterations:1,
         engine,getCard,seed:(seed+Math.imul(n+1,97531)+i)>>>0,cancel});
       check();
       if(result.fingerprint!==trainer.fingerprint(p))throw Error('El deck cambió durante el entrenamiento de '+p.name);
       for(const x of players.filter(x=>x.id===p.id)){
         x.aiTrainingHistory??=[];
         if(x.aiTraining)x.aiTrainingHistory.push(x.aiTraining);
         x.aiTraining=result;x.aiTrainingHistory=x.aiTrainingHistory.slice(-8);
       }
       trainedAi.add(p.id);
       event('IA '+p.name+' · etapa '+(n+1)+': '+(result.accepted?'política mejorada y validada':'política anterior conservada')+
         ' · '+result.iterations+' iteración; '+result.validation.games+' partidas de validación.');
     }
   }
   return {
     mode,players,log,changedDecks,trainedAi,get newDeck(){return newDeck},
     async prepare(){
       check();
       if(mode==='NEW_DECK'){
         newDeck={id:'new-sim-'+seed+'-'+players.length,name:'Nuevo Deck · '+new Date().toLocaleDateString(),
           description:'Construido desde cero en simulación; estilo '+newDeckStyle,
           cardIds:[],hyperCardIds:[],characterImage:null,characterScale:1,characterFocusX:50,characterFocusY:50,
           versionHistory:[]};
         // El proyecto está vacío hasta la primera generación válida.
         players[0]={...newDeck,participantId:players[0].participantId,difficulty:'expert'};
         newDeck=players[0];
         event('Nuevo Deck: iniciado en blanco (0 Power y 0 Hyper).');
         await buildNew(0);
       }else if(mode==='AI')await trainAis(0);
     },
     async afterGame(completed){
       check();
       if(mode==='DECKS'&&completed<count&&completed%epoch===0)await evolveDecks(++iteration);
       if(mode==='AI'&&count>=50&&completed===Math.floor(count/2))await trainAis(++iteration);
       if(mode==='NEW_DECK'&&completed<count&&completed%epoch===0)await buildNew(++iteration);
     }
   };
 }
 return {makeSession,MODES};
})();