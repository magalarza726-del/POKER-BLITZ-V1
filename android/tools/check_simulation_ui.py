#!/usr/bin/env python3
"""Browser smoke-test: simulation entry, per-player deck/AI, Rush and Poker decks."""
import functools, html, json, re, shutil, subprocess, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'android/app/build/generated/offlineWeb'
browser=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
assert browser and (root/'index.html').exists()
page=root/'check-autosim-ui.html'
page.write_text(r'''<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe id="game" src="/index.html" style="width:1200px;height:700px"></iframe><pre id="out">WAIT</pre>
<script>
let started=false;
const status={ok:false,stage:"loading",checks:[]};
const done=()=>document.getElementById("out").textContent=JSON.stringify(status);
const assert=(x,label)=>{if(!x)throw Error(label);status.checks.push(label)};
const pause=()=>new Promise(r=>setTimeout(r,40));
async function wait(test){for(let i=0;i<140;i++){if(test())return;await pause()}throw Error("Timeout "+status.stage)}
async function test(){
 const doc=game.contentDocument;status.stage="home";
 await wait(()=>doc.querySelector('[data-action="auto-simulation"]'));
 doc.querySelector('[data-action="auto-simulation"]').click();
 status.stage="setup";
 await wait(()=>doc.querySelector('[data-auto-ai]'));
 assert(doc.querySelectorAll('[data-auto-ai]').length===2,"independent AI choices");
 assert(doc.querySelectorAll('[data-auto-deck]').length===2,"independent decks");
 doc.querySelector('[data-action="auto-players"][data-value="3"]').click();
 assert(doc.querySelectorAll('[data-auto-ai]').length===3,"three players possible");
 let ai=doc.querySelector('[data-auto-ai="1"]');ai.value="expert";ai.dispatchEvent(new Event("change",{bubbles:true}));
 doc.querySelector('[data-action="auto-battle"][data-value="RUSH"]').click();
 ai=doc.querySelector('[data-auto-ai="1"]');
 assert(ai.value==="expert","AI choice persists on rerender");
 assert(doc.querySelector('[data-action="auto-battle"][data-value="RUSH"]').classList.contains("active"),"Rush selectable");
 doc.querySelector('[data-action="auto-poker-decks"][data-value="2"]').click();
 assert(doc.querySelector('[data-action="auto-poker-decks"][data-value="2"]').classList.contains("active"),"2 poker decks selectable");
 assert(!!doc.querySelector('[data-action="auto-run"]')&&!doc.querySelector('[data-action="auto-run"]').disabled,"Start button enabled");
 assert(doc.querySelector('[data-action="auto-run"]').textContent.includes("PDF"),"PDF output explained");
 status.ok=true;status.stage="done";done();
}
document.getElementById("game").addEventListener("load",()=>{
 if(started)return;started=true;test().catch(e=>{status.error=String(e.stack||e);done()});
});
setTimeout(()=>{if(!status.ok&&!status.error){status.error="Timeout "+status.stage;done()}},12000);
</script></body></html>''',encoding='utf-8')
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 url=f'http://127.0.0.1:{server.server_address[1]}/{page.name}'
 p=subprocess.run([browser,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1300,760','--virtual-time-budget=16000','--dump-dom',url],capture_output=True,text=True,timeout=65)
 found=re.search(r'<pre id="out">([\s\S]*?)</pre>',p.stdout)
 if not found:raise SystemExit("Browser result unavailable: "+p.stderr[-1600:])
 result=json.loads(html.unescape(found.group(1)))
 if not result.get('ok'):raise SystemExit("Simulation UI failed: "+str(result.get('error')))
 print("Automatic Simulation UI passed:",len(result['checks']),"checks")
finally:
 server.shutdown()
 page.unlink(missing_ok=True)
