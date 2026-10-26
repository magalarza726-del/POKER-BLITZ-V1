'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const entry=index.match(/app-v(\d+\.\d+\.\d+)\.html/);
assert(entry,'index.html must reference a versioned game page');
const html=fs.readFileSync(path.join(root,entry[0]),'utf8');
const mappingText=html.match(/const NEW_OFFICIAL_ART=(\{[^;]+\});/);
assert(mappingText,'Missing pixel-art map in the HTML');
const map=JSON.parse(mappingText[1]);
const cards=[...html.matchAll(/"id":\s*"(catalog_v3_\d{3})",\s*"name":\s*"([^"]+)"/g)];
const ids=cards.map(m=>m[1]);
assert.equal(cards.length,50,'The catalog must contain exactly 50 official cards');
assert.equal(new Set(ids).size,50,'Duplicated official card id');
assert.equal(Object.keys(map).length,50,'Every official card requires one illustration');
for(const id of ids){
 const pos=map[id];assert(Array.isArray(pos)&&pos.length===3,'Missing art mapping for '+id);
 const [sheet,col,row]=pos;
 assert(sheet>=1&&sheet<=7&&col>=0&&col<=3&&row>=0&&row<=1,'Invalid sprite index for '+id);
}
for(let sheet=1;sheet<=7;sheet++){
 const fp=path.join(root,'assets','poker_cards_sheet_'+sheet+'.webp');
 const data=fs.readFileSync(fp);assert(data.length>10000,'Missing/empty card art sheet '+sheet);
 assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
}
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
assert.equal(map.catalog_v3_055.join(','),'1,2,1','Secuaz requires sheet 1 chip-art');
assert.equal(map.catalog_v3_009.join(','),'3,3,1','Maestro requires sheet 3 chip-art');
assert(ids.includes('catalog_v3_055')&&ids.includes('catalog_v3_009'),'Both chip-cards must remain separate');
console.log('Pixel-art asset regression passed: 50 cards, 7 card sheets, 10 character portraits.');
