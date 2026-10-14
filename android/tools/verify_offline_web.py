#!/usr/bin/env python3
"""Check Android-bundled offline HTML, including intact executable JS."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / 'android/app/build/generated/offlineWeb'
html = (GENERATED / 'index.html').read_text(encoding='utf-8')

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.current = None
    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.current = [] if 'src' not in dict(attrs) else None
    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self.current is not None:
            self.scripts.append(''.join(self.current))
            self.current = None

scripts = Scripts()
scripts.feed(html)
if len(scripts.scripts) < 3:
    raise SystemExit(f'JS incomplete: {len(scripts.scripts)} inline scripts')
for expected in ('window.STARTER_CARDS', 'function downloadJSON', 'window.APP_LOGO'):
    if not any(expected in s for s in scripts.scripts):
        raise SystemExit(f'Missing JS: {expected}')
for path in ('poker_blitz_logo.webp', 'presets/default-decks.js',
             'assets/starter_cards_atlas.webp',
             'vendor/jspdf.umd.min.js', 'vendor/html2canvas.min.js'):
    if not (GENERATED / path).is_file():
        raise SystemExit(f'Missing offline resource: {path}')
if 'href="pokerblitz-android-layout.css"' not in html:
    raise SystemExit('Missing Android responsive game stylesheet link')
css_file = ROOT / 'android/app/src/main/assets/pokerblitz-android-layout.css'
css = css_file.read_text(encoding='utf-8')
if not all(key in css for key in ('.sim-tools', '.sim-content', '.sim-bottom', '.chip-actions', '.sim-hand')):
    raise SystemExit('Mobile gameplay styles are incomplete')
if 'src="pokerblitz-android-zoom.js"' not in html:
    raise SystemExit('Missing universal card inspector script')
zoom_js = ROOT / 'android/app/src/main/assets/pokerblitz-android-zoom.js'
if not zoom_js.is_file():
    raise SystemExit('Missing inspector JavaScript source')
with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8') as tmp:
    tmp.write(zoom_js.read_text(encoding='utf-8'))
    tmp.flush()
    check = subprocess.run(['node','--check',tmp.name],capture_output=True,text=True)
    if check.returncode:
        raise SystemExit('Inspector JavaScript invalid: '+check.stderr)
if 'src="poker_blitz_logo.webp"' not in html:
    raise SystemExit('The branded startup splash is missing')
for idx, script in enumerate(scripts.scripts):
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8') as tmp:
        tmp.write(script)
        tmp.flush()
        proc = subprocess.run(['node', '--check', tmp.name],
                              capture_output=True, text=True)
        if proc.returncode:
            raise SystemExit(f'Malformed inline script {idx}: {proc.stderr}')
entry = re.search(r'app-v[0-9]+[.][0-9]+[.][0-9]+[.]html',
                  (ROOT/'index.html').read_text()).group(0)
if not (GENERATED / entry).is_file():
    raise SystemExit('Missing HTML version alias')
print(f'Offline Android HTML OK ({len(scripts.scripts)} scripts).')
