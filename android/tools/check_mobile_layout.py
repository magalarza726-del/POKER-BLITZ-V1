#!/usr/bin/env python3
"""Browser smoke test on the *generated Android HTML*, not the online site.

Exercises the actual gameplay UI at typical landscape phone sizes and verifies
that navigation, phases, player tools and hands do not overlap horizontally.
"""
from html import unescape
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import functools
import json
import re
import shutil
import subprocess
import threading

ROOT=Path(__file__).resolve().parents[2]
WEB=ROOT/'android/app/build/generated/offlineWeb'
BROWSER=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not BROWSER:
    raise SystemExit('Chrome/Chromium is necessary for the Android viewport smoke test')
if not (WEB/'index.html').is_file():
    raise SystemExit('Run assembleDebug before this test')
# AGP merges src/main/assets and generated/offlineWeb when producing the APK.
# Mirror that merge for the local HTTP smoke test.
for asset in ('pokerblitz-android.js', 'pokerblitz-android-layout.css', 'pokerblitz-android-zoom.js', 'pokerblitz-android-navigation.js'):
    shutil.copy2(ROOT / 'android/app/src/main/assets' / asset, WEB / asset)
SMOKE=WEB/'android-viewport-test.html'
SMOKE.write_text(r'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0}
#result{display:none}</style></head>
<body><iframe id="game" src="/index.html"></iframe><pre id="result">PENDING</pre>
<script>
(function(){
const report={ok:false,error:null,viewports:[innerWidth,innerHeight],hands:[],rects:{}};
function rect(el){
 if(!el)return null;
 const r=el.getBoundingClientRect();
 return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),
 height:+r.height.toFixed(1),left:r.left,right:r.right,top:r.top,bottom:r.bottom};
}
function contains(outer,inner,tolerance=3){
 return inner&&outer&&inner.left>=outer.left-tolerance&&inner.right<=outer.right+tolerance
 &&inner.top>=outer.top-tolerance&&inner.bottom<=outer.bottom+tolerance;
}
async function check(){
 const doc=document.getElementById('game').contentDocument;
 function verifyZoom(selector,label){
  const tile=doc.querySelector(selector);
  if(!tile)throw Error('Missing zoom tile '+label+' ('+selector+'); APP='+doc.getElementById('app')?.innerHTML.slice(0,1200));
  tile.click();
  const overlay=doc.querySelector('.pb-inspector');
  if(!overlay||!doc.defaultView.PokerBlitzCardInspector?.isOpen)
    throw Error('Zoom overlay not opened for '+label);
  if(!overlay.querySelector('.pb-inspector-card'))
    throw Error('Missing enlarged card artwork for '+label);
  if(!overlay.querySelector('.pb-inspector-description')?.textContent.trim())
    throw Error('Missing readable details for '+label);
  const plus=overlay.querySelector('[data-pb-zoom="in"]');
  plus.click();
  if(doc.defaultView.PokerBlitzCardInspector.scale<=1)
    throw Error('Zoom + failed for '+label);
  overlay.querySelector('[data-pb-zoom="close"]').click();
  if(doc.querySelector('.pb-inspector')||doc.defaultView.PokerBlitzCardInspector.isOpen)
    throw Error('Zoom overlay did not close for '+label);
  report.hands.push({zoom:label,verified:true});
 }
 // The catalog and home gallery can be enlarged before entering the simulator.
 verifyZoom('.home-card .card-preview','home');
 const next=(action)=>{const b=doc.querySelector('[data-action="'+action+'"]');
  if(!b)throw Error('Action missing: '+action);if(b.disabled)throw Error('Action disabled: '+action);b.click();};
 next('all-cards');
 verifyZoom('.card-cell .card-preview','catalog');
 const editButton=doc.querySelector('.card-cell [data-action="edit-card"]');
 if(!editButton)throw Error('Catalog edit control missing');
 editButton.click();
 verifyZoom('.preview-panel .card-preview','editor');
 next('back');
 next('all-decks');
 const deckRow=doc.querySelector('.deck-row[data-action="open-deck"]');
 if(!deckRow)throw Error('No default deck for zoom verification');
 deckRow.click();
 verifyZoom('.deck-card-item .card-preview','deck editor');
 next('add-card-modal');
 verifyZoom('.add-list .card-preview','deck add modal');
 next('close-modal');
 next('back');
 next('simulator');
 next('start-sim');
 let shell=doc.querySelector('.sim-shell');
 if(!shell)throw Error('Simulator not visible');
 const get=(sel)=>{const e=doc.querySelector(sel);if(!e)throw Error('Missing '+sel);return rect(e)};
 const names=['.sim-top','.phase-strip','.sim-tools','.sim-content','.sim-bottom'];
 const frames=names.map(sel=>[sel,get(sel)]);
 const viewport=rect(doc.documentElement);
 frames.forEach(([sel,r])=>{
  report.rects[sel]={x:r.x,y:r.y,width:r.width,height:r.height};
  if(r.width<100||r.x< -3||r.right>innerWidth+3)throw Error('Horizontal overflow: '+sel);
 });
 for(let i=0;i<frames.length-1;i++){
  if(frames[i][1].bottom > frames[i+1][1].top+3){
   throw Error('Vertical collision: '+frames[i][0]+' / '+frames[i+1][0]);
  }
 }
 let tools=get('.game-tools');
 ['.limit-panel','.die-widget','.chip-block'].forEach(sel=>{
  const x=get(sel);
  if(!contains(tools,x,5))throw Error('Tools outside container: '+sel);
 });
 const limit=get('.limit-panel'),die=get('.die-widget'),chips=get('.chip-block');
 if(limit.right>die.left+2||die.right>chips.left+2)throw Error('Tools overlap horizontally');
 if(get('.sim-content').height<155)throw Error('Card region too short');

 // Manual Actions: Poker by default, independent concealment, swap,
 // steal to another player and discard into trash.
 next('open-trade');
 const dialog=()=>doc.querySelector('.trade-modal');
 if(!dialog())throw Error('Global actions modal missing');
 if(!dialog().querySelector('[data-action="trade-kind"][data-kind="POKER"].active'))
   throw Error('Poker Hands not the default view');
 if(dialog().querySelectorAll('.trade-panel').length!==2)throw Error('Expected two hands');
 const tiles=(side)=>[...doc.querySelectorAll('.trade-list[data-trade-list="'+side+'"] .trade-tile')];
 const count=side=>tiles(side).length;
 const identity=tile=>tile?.querySelector('.poker-corner')?.textContent.trim()||'';
 const getTile=(side,i)=>doc.querySelector('.trade-list[data-trade-list="'+side+'"] .trade-tile[data-index="'+i+'"]');
 const clickTab=(name,value)=>doc.querySelector('[data-action="'+name+'"][data-'+(name==='trade-visibility'?'visibility':name==='trade-operation'?'operation':'kind')+'="'+value+'"]').click();
 if(count('from')!==5||count('to')!==5)throw Error('Poker hands incomplete');
 const originalA=identity(getTile('from',0));
 const otherB=tiles('to').find(t=>identity(t)!==originalA);
 if(!otherB)throw Error('Need distinct Poker Cards');
 const otherIndex=Number(otherB.dataset.index),originalB=identity(otherB);
 // Hide only A. B must remain face-up.
 const hideA=dialog().querySelector('[data-action="trade-visibility"][data-side="from"][data-visibility="HIDDEN"]');
 hideA.click();
 if(dialog().querySelectorAll('.trade-list[data-trade-list="from"] .trade-back').length!==5)
   throw Error('Player A concealment missing');
 if(dialog().querySelector('.trade-list[data-trade-list="from"] .poker-card,.trade-list[data-trade-list="from"] .card-preview'))
   throw Error('Player A revealed while concealed');
 if(!dialog().querySelector('.trade-list[data-trade-list="to"] .poker-card'))
   throw Error('Player B visibility incorrectly tied to A');
 const hideB=dialog().querySelector('[data-action="trade-visibility"][data-side="to"][data-visibility="HIDDEN"]');
 hideB.click();
 if(dialog().querySelectorAll('.trade-list[data-trade-list="to"] .trade-back').length!==5)
   throw Error('Player B concealment missing');
 dialog().querySelector('[data-action="trade-visibility"][data-side="from"][data-visibility="VISIBLE"]').click();
 if(!dialog().querySelector('.trade-list[data-trade-list="from"] .poker-card')||
    dialog().querySelector('.trade-list[data-trade-list="to"] .poker-card'))
   throw Error('Independent visibility state not respected');
 dialog().querySelector('[data-action="trade-visibility"][data-side="to"][data-visibility="VISIBLE"]').click();
 // Default SWAP: tap a Poker Card in each player and verify both.
 if(!dialog().querySelector('[data-action="trade-operation"][data-operation="SWAP"].active'))
   throw Error('Intercambiar not default action');
 getTile('from',0).click();
 getTile('to',otherIndex).click();
 if(identity(getTile('from',0))!==originalB||identity(getTile('to',otherIndex))!==originalA)
   throw Error('Swap failed to update both hands');
 next('close-modal');next('undo-action');
 next('open-trade');
 if(identity(getTile('from',0))!==originalA||identity(getTile('to',otherIndex))!==originalB)
   throw Error('Swap undo did not restore both hands');
 // STEAL: drag from A onto B's receiving drop zone, no replacement.
 dialog().querySelector('[data-action="trade-operation"][data-operation="STEAL"]').click();
 const origin=identity(getTile('from',0)),recv=dialog().querySelector('.trade-panel[data-trade-panel="to"] .trade-receive');
 if(!recv)throw Error('Missing receiving drop zone for steal');
 function pointerDrop(source,target,pointerId){
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  const x=a.left+a.width/2,y=a.top+a.height/2,X=b.left+b.width/2,Y=b.top+b.height/2;
  source.dispatchEvent(new doc.defaultView.PointerEvent('pointerdown',
   {bubbles:true,pointerId,pointerType:'touch',clientX:x,clientY:y}));
  doc.dispatchEvent(new doc.defaultView.PointerEvent('pointermove',
   {bubbles:true,pointerId,pointerType:'touch',clientX:X,clientY:Y,cancelable:true}));
  doc.dispatchEvent(new doc.defaultView.PointerEvent('pointerup',
   {bubbles:true,pointerId,pointerType:'touch',clientX:X,clientY:Y,cancelable:true}));
 }
 pointerDrop(getTile('from',0),recv,45);
 if(count('from')!==4||count('to')!==6||identity(getTile('to',5))!==origin)
   throw Error('Drag-to-steal did not transfer card');
 await new Promise(r=>setTimeout(r,210));
 next('close-modal');next('undo-action');
 next('open-trade');
 if(count('from')!==5||count('to')!==5||identity(getTile('from',0))!==origin)
   throw Error('Steal undo failed');
 // DISCARD: drop the card into the trash icon. Poker Card must disappear
 // from hand, then be restored with one undo.
 dialog().querySelector('[data-action="trade-operation"][data-operation="DISCARD"]').click();
 const trash=dialog().querySelector('.trade-trash');
 if(!trash)throw Error('Trash drop zone missing');
 pointerDrop(getTile('from',0),trash,46);
 if(count('from')!==4||count('to')!==5)
   throw Error('Drag-to-trash did not discard from source hand');
 await new Promise(r=>setTimeout(r,210));
 next('close-modal');next('undo-action');
 next('open-trade');
 if(count('from')!==5||identity(getTile('from',0))!==origin)
   throw Error('Discard undo failed');
 // Tapping (without dragging) also works on a phone.
 dialog().querySelector('[data-action="trade-operation"][data-operation="STEAL"]').click();
 getTile('from',0).click();
 dialog().querySelector('.trade-panel[data-trade-panel="to"] .trade-receive').click();
 if(count('from')!==4||count('to')!==6)throw Error('Tap-to-steal failed');
 next('close-modal');next('undo-action');
 next('open-trade');
 // POWER Hands still available; active HyperCards must remain protected.
 dialog().querySelector('[data-action="trade-kind"][data-kind="POWER"]').click();
 if(count('from')<1||count('to')<1)throw Error('Power hands missing');
 next('close-modal');
 report.hands.push({actions:'visible/hidden per player; poker/power; swap, steal, discard, drag, tap and undo',verified:true});

 verifyZoom('.sim-hand .card-preview','power hand');
 // Existing action buttons must not be stolen by the inspection overlay.
 const discard=doc.querySelector('.sim-hand .hand-actions button[data-action="discard-card"]');
 if(!discard||discard.disabled)throw Error('Discard action unavailable');
 next('draw-view');
 verifyZoom('.draw-deck-modal .card-preview','deck selection');
 next('close-modal');
 for(let i=0;i<3;i++){
  const title=doc.querySelector('.sim-hand-title')?.textContent;
  if(title==='Poker Hand')verifyZoom('.sim-hand .poker-card','poker hand');
  if(!title)throw Error('Hand title missing');
  const cards=doc.querySelectorAll('.sim-hand .hand-card,.sim-hand .poker-card');
  const empty=doc.querySelector('.sim-hand .empty,.sim-hand .poker-empty');
  if(!cards.length&&!empty)throw Error('No hand cards or empty state: '+title);
  report.hands.push({title,cards:cards.length,empty:!!empty});
  next('cycle-hand');
 }
 if(new Set(report.hands.filter(x=>x.title).map(x=>x.title)).size!==3)throw Error('Hands not cycling through 3 zones');
 // Render is synchronous, but the navigation dock is inserted by a
 // MutationObserver on the next microtask after the simulator enters the DOM.
 await Promise.resolve();
 // Navigation remains accessible when the entire page is scrolled down.
 const nav=doc.querySelector('#pb-game-nav');
 if(!nav)throw Error('Global simulator navigation missing');
 const bounds=rect(nav);
 if(bounds.top>3||bounds.bottom>55)throw Error('Navigation not fixed to viewport top');
 doc.documentElement.scrollTop=220;
 doc.body.scrollTop=220;
 doc.querySelector('.sim-shell').scrollTop=220;
 const topButton=nav.querySelector('[data-pb-nav="top"]');
 if(!topButton)throw Error('Up button missing');
 topButton.click();
 if(doc.documentElement.scrollTop>2||doc.body.scrollTop>2||doc.querySelector('.sim-shell').scrollTop>2)
    throw Error('Up button did not restore top');
 if(!doc.defaultView.PokerBlitzAndroidNavigation?.active)throw Error('Navigator inactive in simulator');
 if(doc.defaultView.getComputedStyle(doc.querySelector('.sim-tools')).display!=='grid')
  throw Error('Responsive Android CSS was not applied');
 // Native Android Back must use the same safe exit confirmation.
 if(!doc.defaultView.PokerBlitzAndroidNavigation.back())
    throw Error('Android back was not handled in simulator');
 if(!doc.querySelector('.exit-modal'))throw Error('Android back did not open exit confirmation');
 doc.querySelector('.exit-modal [data-action="close-modal"]').click();
 if(!doc.querySelector('.sim-shell'))throw Error('Cancelled exit lost simulator');
 nav.querySelector('[data-pb-nav="exit"]').click();
 if(!doc.querySelector('.exit-modal'))throw Error('Visible return button did not open confirmation');
 doc.querySelector('.exit-modal [data-action="exit-without-report"]').click();
 if(!doc.querySelector('.home-main'))throw Error('Return button did not navigate home');
 // The observer removes the fixed dock in the next microtask after rendering.
 await Promise.resolve();
 if(doc.querySelector('#pb-game-nav'))throw Error('Simulator dock remained on home screen');
 report.ok=true;
}
async function finish(){
 try{await check();}catch(e){report.error=String(e.stack||e);}
 document.getElementById('result').textContent=JSON.stringify(report);
}
const iframe=document.getElementById('game');
iframe.addEventListener('load',()=>setTimeout(finish,100));
setTimeout(()=>{
 if(document.getElementById('result').textContent==='PENDING'){
   report.error='Timed out loading the simulator';
   document.getElementById('result').textContent=JSON.stringify(report);
 }
},4500);
})();
</script></body></html>''', encoding='utf-8')

handler=functools.partial(SimpleHTTPRequestHandler,directory=str(WEB))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
server_thread=threading.Thread(target=server.serve_forever,daemon=True)
server_thread.start()
try:
    for width,height in ((1200,540),(1560,700),(900,480)):
        address=f'http://127.0.0.1:{server.server_address[1]}/android-viewport-test.html'
        args=[BROWSER,'--headless=new','--no-sandbox','--disable-gpu',
              '--disable-dev-shm-usage','--hide-scrollbars',
              f'--window-size={width},{height}',
              '--virtual-time-budget=6000','--dump-dom',address]
        result=subprocess.run(args,capture_output=True,text=True,timeout=60)
        match=re.search(r'<pre id="result">([\s\S]*?)</pre>',result.stdout)
        if not match:
            raise SystemExit(f'Chrome did not return JSON at {width}x{height}: '
                             +result.stderr[-1500:])
        data=json.loads(unescape(match.group(1)))
        print(f'{width}x{height}: {json.dumps(data,ensure_ascii=False)}')
        if not data.get('ok'):
            raise SystemExit(f'Android game layout test failed at {width}x{height}: {data.get("error")}')
finally:
    server.shutdown()
    SMOKE.unlink(missing_ok=True)
