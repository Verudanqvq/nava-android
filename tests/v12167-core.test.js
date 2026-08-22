import assert from 'node:assert/strict';
import '../android-patch/v12.1.67/library-core-v12167.js';
import '../android-patch/v12.1.67/language-core-v12167.js';
const lib=globalThis.NavaLibraryCoreV12167;
const lang=globalThis.NavaLanguageCoreV12167;
function entry(title,url,labels){return{title:{$t:title},link:[{rel:'alternate',href:url}],category:(labels||[]).map(term=>({term}))}}
const SERIES='Tensei Shitara Slime Datta Ken (Light Novel)';
const VURL='https://www.verudanava.com/2026/07/tensura-cilt-11.html';
const TR1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1.html';
const EN1='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-1-en.html';
const TR2='https://www.verudanava.com/2026/07/tensura-cilt-11-bolum-2.html';
const volumes=[entry('Tensura Cilt 11',VURL,['Cilt',SERIES,'Tensura Cilt 11'])];
const chapters=[
 entry('Tensura Cilt 11 Bölüm 1',TR1,['Bölüm','Tensura Cilt 11']),
 entry('Tensura Cilt 11 Bölüm 1',EN1,['Bölüm','Tensura Cilt 11','EN']),
 entry('Tensura Cilt 11 Bölüm 2',TR2,['Bölüm','Tensura Cilt 11'])
];
const rel=lib.buildRelations(volumes,chapters);
assert.deepStrictEqual(rel.byUrl[lib.canon(VURL)],{series:SERIES,volumeNo:'11',kind:'volume'});
assert.deepStrictEqual(rel.byUrl[lib.canon(TR1)],{series:SERIES,volumeNo:'11',kind:'chapter'});
assert.strictEqual(rel.byAlias[lib.norm('Tensura')],SERIES);
const downloads=[
 {url:VURL,title:'Cilt 11',seriesTitle:'Tensura Cilt 11',kind:'volume'},
 {url:TR1,title:'Bölüm 1',seriesTitle:'Cilt 11',kind:'chapter'},
 {url:TR1+'?m=1',title:'Bölüm 1',seriesTitle:'Tensura Cilt 11',kind:'chapter'},
 {url:TR2,title:'Bölüm 2',seriesTitle:'Tensura Cilt 11',kind:'chapter'}
];
const groups=lib.groupDownloads(downloads,rel);
assert.strictEqual(groups.length,1,'exactly one work root must exist');
assert.strictEqual(groups[0].name,SERIES,'volume must belong to canonical work');
assert(!/cilt\s*11/i.test(groups[0].name),'work root must never be Cilt 11');
assert.strictEqual(groups[0].volumes.size,1,'exactly one volume must exist');
const v=groups[0].volumes.get('11');
assert(v,'Cilt 11 must exist');
assert.strictEqual(v.name,'Cilt 11');
assert(v.page&&v.page.isVolume,'volume page must be the Cilt row action, not a nested child');
assert.strictEqual(v.chapters.length,2,'query duplicate must collapse and only chapters remain below volume');
assert(v.chapters.every(x=>x.kind==='chapter'),'only chapters can be nested under Cilt 11');
const fresh=lib.groupDownloads([
 {url:VURL,title:'Cilt 11',seriesTitle:SERIES,kind:'volume'},
 {url:TR1,title:'Bölüm 1',seriesTitle:SERIES,kind:'chapter',volumeNo:'11',chapterNo:'1'}
],{byUrl:{},byAlias:{}});
assert.strictEqual(fresh.length,1);
assert.strictEqual(fresh[0].name,SERIES,'new metadata must work without network relation cache');
const brokenNoRelation=lib.groupDownloads([{url:TR1,title:'Bölüm 1',seriesTitle:'Cilt 11',kind:'chapter'}],{byUrl:{},byAlias:{}});
assert.strictEqual(brokenNoRelation[0].name,'Diğer','broken legacy content must not invent a Cilt work root before relations exist');
const lidx=lang.buildIndex(chapters);
const variants1=lang.variantsForUrl(lidx,TR1);
assert.deepStrictEqual(variants1.languages,['TR','EN'],'unlabelled/default Turkish plus EN must show TR and EN');
assert.strictEqual(variants1.show,true);
assert.strictEqual(variants1.targets.TR,lang.canon(TR1));
assert.strictEqual(variants1.targets.EN,lang.canon(EN1));
const variants2=lang.variantsForUrl(lidx,TR2);
assert.deepStrictEqual(variants2.languages,['TR'],'single Turkish-only chapter must have only TR');
assert.strictEqual(variants2.show,false,'selector must hide when chapter has only one language');
assert(!variants1.languages.includes('JP'),'languages from other chapters must not leak into current chapter');
console.log('PASS hierarchy: 1 work > 1 Cilt 11 > 2 chapters');
console.log('PASS language: unlabeled TR + EN => TR/EN; TR-only => selector hidden');
