import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const libCoreSrc=fs.readFileSync('android-patch/v12.1.67/library-core-v12167.js','utf8');
const libUiSrc=fs.readFileSync('android-patch/v12.1.67/downloaded-library-v12167.js','utf8');
const langCoreSrc=fs.readFileSync('android-patch/v12.1.67/language-core-v12167.js','utf8');
const langUiSrc=fs.readFileSync('android-patch/v12.1.67/language-v12167.js','utf8');
const SERIES='Tensei Shitara Slime Datta Ken (Light Novel)';
const VURL='https://www.verudanava.com/2026/07/tensura-cilt-11.html';
const TR1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1.html';
const EN1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1-en.html';
const TR2='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-2.html';
const JP2='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-2-jp.html';
function entry(title,url,labels){return{title:{$t:title},link:[{rel:'alternate',href:url}],category:(labels||[]).map(term=>({term}))}}
const volumes=[entry('Tensura Cilt 11',VURL,['Cilt',SERIES,'Tensura Cilt 11'])];
const chapters=[
 entry('Tensura Cilt 11 Bölüm 1',TR1,['Bölüm','Tensura Cilt 11']),
 entry('Tensura Cilt 11 Bölüm 1',EN1,['Bölüm','Tensura Cilt 11','EN']),
 entry('Tensura Cilt 11 Bölüm 2',TR2,['Bölüm','Tensura Cilt 11']),
 entry('Tensura Cilt 11 Bölüm 2',JP2,['Bölüm','Tensura Cilt 11','JP'])
];
function makeDom(url,body=''){return new JSDOM('<!doctype html><html><head></head><body>'+body+'</body></html>',{url,runScripts:'outside-only',pretendToBeVisual:true})}
{
 const dom=makeDom('https://www.verudanava.com/','<section id="nava-offline-browser-v12149"></section><section id="nava-offline-browser-v12162"></section>');
 const w=dom.window;w.__NAVA_ANDROID_APP__=true;Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.requestAnimationFrame=cb=>cb();
 const downloads=[
  {url:VURL,title:'Cilt 11',seriesTitle:'Tensura Cilt 11',kind:'volume'},
  {url:TR1,title:'Bölüm 1',seriesTitle:'Cilt 11',kind:'chapter'},
  {url:TR1+'?m=1',title:'Bölüm 1',seriesTitle:'Tensura Cilt 11',kind:'chapter'},
  {url:TR2,title:'Bölüm 2',seriesTitle:'Tensura Cilt 11',kind:'chapter'}
 ];
 w.NavaOffline={listDownloads:()=>JSON.stringify({items:downloads,storageBytes:1234}),open:()=>true,delete:()=>true};
 w.eval(libCoreSrc);const rel=w.NavaLibraryCoreV12167.buildRelations(volumes,chapters);w.localStorage.setItem('nava_series_relations_v12167',JSON.stringify(rel));w.eval(libUiSrc);await w.navaOpenDownloads();
 assert.strictEqual(w.document.querySelectorAll('#nava-offline-browser-v12163').length,1,'exactly one active library shell');
 assert.strictEqual(w.document.getElementById('nava-offline-browser-v12149'),null,'49 shell must be removed');
 assert.strictEqual(w.document.getElementById('nava-offline-browser-v12162'),null,'62 shell must be removed');
 const series=w.document.querySelectorAll('#nava-offline-browser-v12163 .nava-offline62-series');
 assert.strictEqual(series.length,1,'DOM must render one work only');
 assert.strictEqual(series[0].querySelector('.is-series strong').textContent,SERIES);
 const vols=series[0].querySelectorAll('.nava-offline62-volume');assert.strictEqual(vols.length,1,'DOM must render one Cilt only');
 assert.strictEqual(vols[0].querySelector('.is-volume strong').textContent,'Cilt 11');
 assert.strictEqual(vols[0].querySelectorAll('.nava-offline62-chapter').length,2,'DOM must render only two unique chapter rows');
 assert(![...series].some(x=>/^cilt\s*11$/i.test(x.querySelector('.is-series strong').textContent)),'Cilt 11 must never be a work root');
 console.log('PASS DOM hierarchy: exactly one Eser > Cilt 11 > 2 unique Bölüm rows');
 dom.window.close();
}
async function languageDom(currentUrl,feedEntries){
 const dom=makeDom(currentUrl,'<main><h1>Tensura Cilt 11 Bölüm 1</h1><div id="nava-reader-settings-v2"></div></main>');const w=dom.window;w.__NAVA_ANDROID_APP__=true;w.document.body.className='nava-app-reader';w.requestAnimationFrame=cb=>cb();
 w.fetch=async()=>({ok:true,json:async()=>({feed:{entry:feedEntries}})});w.eval(langCoreSrc);w.eval(langUiSrc);await new Promise(r=>setTimeout(r,30));return dom;
}
{
 const dom=await languageDom(TR1,chapters);const w=dom.window,row=w.document.getElementById('nava-reader-language-v12167');assert(row,'multi-language chapter must show selector');
 const buttons=[...row.querySelectorAll('button')].map(x=>x.textContent);assert.deepStrictEqual(buttons,['TR','EN'],'current Bölüm 1 must show only TR + EN and must include default/unlabelled TR');
 assert(!buttons.includes('JP'),'JP from Bölüm 2 must not leak into Bölüm 1');
 const style=w.document.getElementById('nava-reader-language-style-v12167').textContent;assert(style.includes('overflow-x:auto'));assert(style.includes('touch-action:pan-x'));
 console.log('PASS DOM language: current chapter shows TR/EN only + horizontal pan CSS');dom.window.close();
}
{
 const dom=await languageDom(TR2,[chapters[2]]);assert.strictEqual(dom.window.document.getElementById('nava-reader-language-v12167'),null,'TR-only chapter must hide language selector');console.log('PASS DOM language: TR-only chapter hides selector');dom.window.close();
}
