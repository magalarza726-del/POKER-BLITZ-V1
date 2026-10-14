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
for asset in ('pokerblitz-android.js', 'pokerblitz-android-layout.css'):
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
function check(){
 const doc=document.getElementById('game').contentDocument;
 const next=(action)=>{const b=doc.querySelector('[data-action="'+action+'"]');
  if(!b)throw Error('Action missing: '+action);if(b.disabled)throw Error('Action disabled: '+action);b.click();};
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
 for(let i=0;i<3;i++){
  const title=doc.querySelector('.sim-hand-title')?.textContent;
  if(!title)throw Error('Hand title missing');
  const cards=doc.querySelectorAll('.sim-hand .hand-card,.sim-hand .poker-card');
  const empty=doc.querySelector('.sim-hand .empty,.sim-hand .poker-empty');
  if(!cards.length&&!empty)throw Error('No hand cards or empty state: '+title);
  report.hands.push({title,cards:cards.length,empty:!!empty});
  next('cycle-hand');
 }
 if(new Set(report.hands.map(x=>x.title)).size!==3)throw Error('Hands not cycling through 3 zones');
 if(getComputedStyle(doc.querySelector('.sim-tools')).display!=='grid')
  throw Error('Responsive Android CSS was not applied');
 report.ok=true;
}
function finish(){
 try{check();}catch(e){report.error=String(e.stack||e);}
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
