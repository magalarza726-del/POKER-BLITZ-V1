'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const entry=index.match(/app-v(\d+\.\d+\.\d+)\.html/);
assert(entry,'index.html must reference a versioned game page');
const html=fs.readFileSync(path.join(root,entry[0]),'utf8');
const cards=[...html.matchAll(/"id":\\s*"(catalog_v3_\\d{3})",\\s*"name":\\s*"([^"]+)"/g)];
const ids=cards.map(m=>m[1]);
assert.equal(cards.length,50,'The catalog must contain exactly 50 official cards');
assert.equal(new Set(ids).size,50,'Duplicate official card id');
assert(html.includes('class="pb-original-card-art"'),'Original individual card image element missing');
assert(html.includes('assets/cards/\\${card.id}.webp'),'Card image source must be derived from its official ID');
assert(!html.includes('class="pb-art-sheet"'),'The old sprite-sheet renderer must be disabled');
const fingerprints=new Set();
for(const id of ids){
 const file=path.join(root,'assets','cards',id+'.webp');
 const data=fs.readFileSync(file);
 assert(data.length>10000,'Missing or empty original art for '+id);
 assert.equal(data.toString('ascii',0,4),'RIFF','Invalid WebP header for '+id);
 assert.equal(data.toString('ascii',8,12),'WEBP','Invalid WebP image for '+id);
 fingerprints.add(require('node:crypto').createHash('sha256').update(data).digest('hex'));
}
assert.equal(fingerprints.size,50,'Each original card must have its own distinct illustration');
const decksSource=fs.readFileSync(path.join(root,'presets','default-decks.js'),'utf8');
const decks=JSON.parse(decksSource.match(/POKER_BLITZ_DEFAULT_DECKS=(\[[\s\S]*?\]);/)[1]);
assert.equal(decks.length,10,'Expected exactly ten official character decks');
const portraitNames=['sibaris','midas','vortice','fortuna','astra','nemesis','arkan','aceron','regulus','maverick'];
for(let i=0;i<portraitNames.length;i++){
 const portrait=path.join(root,'assets','poker_character_'+portraitNames[i]+'.webp');
 const data=fs.readFileSync(portrait);assert(data.length>10000,'Missing portrait '+portraitNames[i]);
 assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
 assert(html.includes('poker_character_'),'The interface must use the portrait assets');
}
assert(ids.includes('catalog_v3_055')&&ids.includes('catalog_v3_009'),'Secuaz and Maestro must be separate cards');
console.log('Pixel-art asset regression passed: 50 distinct original individual card images and 10 character portraits.');
