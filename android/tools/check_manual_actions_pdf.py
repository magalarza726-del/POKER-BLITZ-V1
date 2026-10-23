#!/usr/bin/env python3
"""Create ACTIVE and ARCHIVED PDFs using Poker Blitz Android's real UI, then
extract the PDF text and check that all three manual actions are present."""
import base64
import functools
from html import unescape
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
import subprocess
import threading
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
WEB=ROOT/'android/app/build/generated/offlineWeb'
BROWSER=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
assert BROWSER and (WEB/'index.html').is_file()
for asset in ('pokerblitz-android.js','pokerblitz-android-layout.css',
              'pokerblitz-android-zoom.js','pokerblitz-android-navigation.js'):
    shutil.copy2(ROOT/'android/app/src/main/assets'/asset,WEB/asset)
page=WEB/'pdf-actions-regression.html'
page.write_text(r'''<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe src="/index.html" id="appframe" style="width:100%;height:90vh"></iframe>
<pre id="result">PENDING</pre>
<script>
(function(){
  const report={ok:false,pdfs:[],stage:'boot',error:null};
  const finish=()=>document.getElementById('result').textContent=JSON.stringify(report);
  const wait=async(check,limit=4000)=>{
    const start=Date.now();
    while(Date.now()-start<limit){
      if(check())return;
      await new Promise(r=>setTimeout(r,30));
    }
    throw Error('Timeout: '+report.stage);
  };
  const run=async()=>{
    const frame=document.getElementById('appframe'),w=frame.contentWindow,d=frame.contentDocument;
    await wait(()=>d.querySelector('.home-card'));
    report.stage='set up native PDF bridge';
    if(!w.PokerBlitzAndroid?.saveBlob)throw Error('Android bridge missing');
    w.AndroidBridge={saveFile(name,type,base64){
      if(type!=='application/pdf'||!base64.startsWith('JVBER'))throw Error('Not a PDF');
      report.pdfs.push({name,base64});
    }};
    Object.defineProperty(w,'showSaveFilePicker',{value:undefined,configurable:true});
    await new Promise((resolve,reject)=>{
      const s=d.createElement('script');s.src='/vendor/jspdf.umd.min.js';
      s.onload=resolve;s.onerror=()=>reject(Error('jsPDF failed to load'));d.head.appendChild(s);
    });
    if(!w.jspdf?.jsPDF)throw Error('Missing jsPDF');

    function click(selector){
      const b=d.querySelector(selector);
      if(!b||b.disabled)throw Error('Missing enabled '+selector+' at '+report.stage);
      b.click();
    }
    const action=(name)=>click('[data-action="'+name+'"]');
    const card=(side)=>'[data-trade-list="'+side+'"] .trade-tile[data-index="0"]';

    report.stage='play';
    action('simulator');action('start-sim');action('open-trade');
    if(!d.querySelector('.trade-modal'))throw Error('Actions modal missing');
    if(!d.querySelector('[data-kind="POKER"].active'))throw Error('Poker not default');

    report.stage='swap';
    click(card('from'));click(card('to'));

    report.stage='steal (hidden)';
    click('[data-operation="STEAL"]');
    click('[data-visibility="HIDDEN"][data-side="from"]');
    if(d.querySelector('[data-trade-list="from"] .poker-card'))throw Error('Hidden source revealed');
    click(card('from'));click('[data-trade-panel="to"] .trade-receive');

    report.stage='discard (visible)';
    click('[data-operation="DISCARD"]');
    click(card('to'));action('trade-trash');
    action('close-modal');

    report.stage='active report';
    action('exit-sim');action('exit-with-report');
    await wait(()=>report.pdfs.length===1);
    await wait(()=>!d.querySelector('.sim-shell')&&d.querySelector('[data-action="test-history"]'));
    report.stage='archived report';
    action('test-history');action('history-pdf');
    await wait(()=>report.pdfs.length===2);
    report.stage='finished';report.ok=true;finish();
  };
  document.getElementById('appframe').addEventListener('load',()=>setTimeout(()=>{
    run().catch(e=>{report.error=String(e.stack||e);finish();});
  },100));
  setTimeout(()=>{
    if(!report.ok&&!report.error){report.error='Timed out at '+report.stage;finish();}
  },10500);
})();
</script></body></html>''',encoding='utf-8')

server=ThreadingHTTPServer(('127.0.0.1',0),
    functools.partial(SimpleHTTPRequestHandler,directory=str(WEB)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    url=f'http://127.0.0.1:{server.server_address[1]}/{page.name}'
    p=subprocess.run([BROWSER,'--headless=new','--no-sandbox','--disable-gpu',
        '--disable-dev-shm-usage','--window-size=1200,750',
        '--virtual-time-budget=13000','--dump-dom',url],
        capture_output=True,text=True,timeout=60)
    match=re.search(r'<pre id="result">([\s\S]*?)</pre>',p.stdout)
    if not match:
        raise SystemExit('No browser result: '+p.stderr[-1300:])
    result=json.loads(unescape(match.group(1)))
    if not result.get('ok'):
        raise SystemExit('PDF failure: '+str(result.get('error')))
    if len(result['pdfs'])!=2:
        raise SystemExit('Expected active and archived PDFs')
    for i,item in enumerate(result['pdfs']):
        raw=base64.b64decode(item['base64'],validate=True)
        if not raw.startswith(b'%PDF-') or len(raw)<1700:
            raise SystemExit('PDF invalid or incomplete')
        pdf=PdfReader(BytesIO(raw))
        text=re.sub(r'\s+',' ',' '.join(page.extract_text() or '' for page in pdf.pages))
        for label,amount in (('Intercambio manual',2),('Robo manual',2),
                             ('Descarte manual',1),('Acciones manuales:',2)):
            if text.count(label)<amount:
                raise SystemExit(f'Missing {label} in {item["name"]}. Text: {text[:2700]}')
        for label in ('Robos: 1','Intercambios: 1','Descartes: 1',
                      'carta oculta','Poker Card','J1','J2'):
            if label not in text:
                raise SystemExit(f'Missing {label} in {item["name"]}. Text: {text[:2700]}')
        print(f'PDF {i+1} verified: {item["name"]} | pages={len(pdf.pages)} | bytes={len(raw)}')
finally:
    server.shutdown()
    page.unlink(missing_ok=True)
