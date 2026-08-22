import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const libCoreSrc=fs.readFileSync('android-patch/v12.1.68/library-core-v12168.js','utf8');
const libUiSrc=fs.readFileSync('android-patch/v12.1.68/downloaded-library-v12168.js','utf8');
const langCoreSrc=fs.readFileSync('android-patch/v12.1.68/language-core-v12168.js','utf8');
const langUiSrc=fs.readFileSync('android-patch/v12.1.68/language-v12168.js','utf8');
const SERIES='Tensei Shitara Slime Datta Ken (Light Novel)';
const VURL='https://www.verudanava.com/2026/07/tensura-cilt-11.html';
const TR1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1.html';
const EN1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1-en.html';
function entry(title,url,labels){return{title:{$t:title},link:[{rel:'alternate',href:url}],category:(labels||[]).map(term=>({term}))}}
function makeDom(url,body=''){return new JSDOM('<!doctype html><html><head></head><body>'+body+'</body></html>',{url,runScripts:'outside-only',pretendToBeVisual:true})}
{
 const dom=makeDom('https://www.verudanava.com/');const w=dom.window;w.__NAVA_ANDROID_APP__=true;Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.requestAnimationFrame=cb=>cb();
 const downloads=[{url:VURL,title:'Cilt 11',seriesTitle:{title:{$t:'Tensura Cilt 11'}},kind:'volume'},{url:TR1,title:'Bölüm 1',seriesTitle:'Tensura',kind:'chapter'}];
 w.NavaOffline={listDownloads:()=>JSON.stringify({items:downloads,storageBytes:10}),open:()=>true,delete:()=>true};w.eval(libCoreSrc);
 const rel=w.NavaLibraryCoreV12168.buildRelations([entry('Tensura Cilt 11',VURL,['Cilt',SERIES,'Tensura Cilt 11'])],[entry('Tensura Cilt 11 Bölüm 1',TR1,['Bölüm','Tensura Cilt 11'])]);
 rel.byUrl[w.NavaLibraryCoreV12168.canon(VURL)]={series:{title:{$t:SERIES}},volumeNo:'11',kind:'volume'};rel.byAlias[w.NavaLibraryCoreV12168.norm('Tensura')]={series:SERIES};
 w.localStorage.setItem('nava_series_relations_v12167',JSON.stringify(rel));w.eval(libUiSrc);await w.navaOpenDownloads();
 const root=w.document.querySelector('#nava-offline-browser-v12163 .is-series strong');assert(root);assert.strictEqual(root.textContent,SERIES);assert(!/object object/i.test(w.document.body.textContent));
 console.log('PASS DOM offline title: object cache renders canonical text');dom.window.close();
}
async function languageDom({url=TR1,feedEntries=[],tag=''}){const tagHtml=tag?'<a rel="tag">'+tag+'</a>':'';const dom=makeDom(url,'<main><h1>Tensura Cilt 11 Bölüm 1</h1>'+tagHtml+'<div id="nava-reader-settings-v2"></div></main>');const w=dom.window;w.__NAVA_ANDROID_APP__=true;w.document.body.className='nava-app-reader';w.requestAnimationFrame=cb=>cb();w.fetch=async()=>({ok:true,json:async()=>({feed:{entry:feedEntries}})});w.eval(langCoreSrc);w.eval(langUiSrc);await new Promise(r=>setTimeout(r,40));return dom}
{
 const dom=await languageDom({tag:'TR',feedEntries:[]});const row=dom.window.document.getElementById('nava-reader-language-v12168');assert(row,'explicit TR tag on current page must show selector even before feed sees it');assert.deepStrictEqual([...row.querySelectorAll('button')].map(x=>x.textContent),['TR']);console.log('PASS DOM language: explicit current-page TR tag shows TR');dom.window.close();
}
{
 const dom=await languageDom({feedEntries:[entry('Tensura Cilt 11 Bölüm 1',TR1,['Bölüm','Tensura Cilt 11'])]});assert.strictEqual(dom.window.document.getElementById('nava-reader-language-v12168'),null,'implicit TR-only chapter must stay hidden');console.log('PASS DOM language: implicit TR-only stays hidden');dom.window.close();
}
{
 const dom=await languageDom({feedEntries:[entry('Tensura Cilt 11 Bölüm 1',TR1,['Bölüm','Tensura Cilt 11','TR']),entry('Tensura Cilt 11 Bölüm 1',EN1,['Bölüm','Tensura Cilt 11','EN'])]});const row=dom.window.document.getElementById('nava-reader-language-v12168');assert(row);assert.deepStrictEqual([...row.querySelectorAll('button')].map(x=>x.textContent),['TR','EN']);const style=dom.window.document.getElementById('nava-reader-language-style-v12168').textContent;assert(style.includes('overflow-x:auto'));assert(style.includes('touch-action:pan-x'));console.log('PASS DOM language: TR/EN + horizontal scroll');dom.window.close();
}
