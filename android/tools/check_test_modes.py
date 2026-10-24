#!/usr/bin/env python3
"""Smoke-test Manual Simple and Assisted mode from the real Android-built HTML."""
import functools
from html import unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import subprocess
import threading

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'android/app/build/generated/offlineWeb'
BROWSER = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
assert BROWSER and (WEB/'index.html').is_file()

page = WEB/'test-modes-regression.html'
page.write_text(r'''<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe id="appframe" src="/index.html" style="width:100%;height:90vh"></iframe>
<pre id="result">PENDING</pre>
<script>
(function(){
  const report={ok:false,stage:'boot',error:null,checks:[]};
  const finish=()=>document.getElementById('result').textContent=JSON.stringify(report);
  const wait=async(check,ms=8000)=>{
    const start=Date.now();
    while(Date.now()-start<ms){if(check())return;await new Promise(r=>setTimeout(r,35))}
    throw Error('Timeout: '+report.stage);
  };
  function assert(ok,message){if(!ok)throw Error(message);report.checks.push(message)}
  const run=async()=>{
    const doc=document.getElementById('appframe').contentDocument;
    await wait(()=>doc.querySelector('.home-card'));
    const action=(name)=>{
      const el=doc.querySelector('[data-action="'+name+'"]');
      if(!el||el.disabled)throw Error('Missing '+name+' at '+report.stage);
      el.click();
    };
    report.stage='Manual mode choice';action('manual-test');
    assert(!!doc.querySelector('[data-action="manual-full"]'),'Full choice exists');
    assert(!!doc.querySelector('[data-action="manual-simple"]'),'Simple choice exists');
    report.stage='Manual Simple setup';action('manual-simple');
    assert(!doc.querySelector('.test-poker-options'),'Physical Poker selection hidden');
    report.stage='Manual Simple match';action('start-sim');
    assert(!!doc.querySelector('.sim-shell'),'Simple match starts');
    assert(!doc.querySelector('[data-action="open-trade"]'),'No global Poker transfer button in Simple');
    assert(!doc.querySelector('.poker-card'),'No digital Poker Cards in Simple');
    assert(!doc.querySelector('[data-action="draw-poker-random"]'),'No Poker draw button in Simple');
    const charge=doc.querySelector('[data-action="set-phase"][data-phase="CHARGE"]');
    if(!charge||charge.disabled)throw Error('Charge phase unavailable');
    charge.click();
    const par=doc.querySelector('[data-action="add-chips"][data-reason="Par"]');
    assert(!!par,'Physical Poker manual pair scoring restored');
    par.click();
    assert((doc.querySelector('.chip-total')?.textContent||'').includes('1'),'Manual pair button gives 1 chip');
    report.stage='Return home';
    action('exit-sim');action('exit-without-report');
    await wait(()=>!doc.querySelector('.sim-shell')&&doc.querySelector('[data-action="assisted-test"]'));
    report.stage='Assisted setup';action('assisted-test');
    assert(!!doc.querySelector('.test-poker-options'),'Assisted uses digital Poker setup');
    action('start-sim');
    assert(!!doc.querySelector('.sim-shell'),'Assisted match starts');
    assert((doc.querySelector('.sim-top h1')?.textContent||'').includes('Prueba Asistida'),'Assisted heading present');
    assert((doc.querySelector('.hint')?.textContent||'').includes('efecto real'),'Assisted effect guidance present');
    report.stage='done';report.ok=true;finish();
  };
  document.getElementById('appframe').addEventListener('load',()=>setTimeout(()=>{
    run().catch(e=>{report.error=String(e.stack||e);finish()});
  },120));
  setTimeout(()=>{if(!report.ok&&!report.error){report.error='Timeout '+report.stage;finish()}},20000);
})();
</script></body></html>''',encoding='utf-8')
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(WEB)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    url=f'http://127.0.0.1:{server.server_address[1]}/{page.name}'
    p=subprocess.run([BROWSER,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
                      '--window-size=1280,750','--virtual-time-budget=24000','--dump-dom',url],
                     capture_output=True,text=True,timeout=65)
    match=re.search(r'<pre id="result">([\s\S]*?)</pre>',p.stdout)
    if not match:raise SystemExit('No browser result: '+p.stderr[-1500:])
    result=json.loads(unescape(match.group(1)))
    if not result.get('ok'):raise SystemExit('Mode smoke test failed: '+str(result.get('error')))
    print('Manual Simple/Assisted smoke-test PASSED:',len(result['checks']),'checks')
finally:
    server.shutdown()
    page.unlink(missing_ok=True)
