import fs from 'node:fs';
import assert from 'node:assert/strict';
await import('../android-patch/v12.1.68/library-core-v12168.js');
await import('../android-patch/v12.1.68/language-core-v12168.js');
const lib=globalThis.NavaLibraryCoreV12168,lang=globalThis.NavaLanguageCoreV12168;
const cilt=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),bolum=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),all=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
const volumes=cilt?.feed?.entry||[],chapters=bolum?.feed?.entry||[],posts=all?.feed?.entry||[];
assert(volumes.length&&chapters.length&&posts.length,'live feeds must not be empty');
const rel=lib.buildRelations(volumes,chapters),vurl=lib.canon('https://www.verudanava.com/2026/07/tensura-cilt-11.html'),vr=rel.byUrl[vurl];
assert(vr,'live Cilt 11 relation missing');assert.equal(vr.volumeNo,'11');assert(/tensei shitara slime datta ken/i.test(lib.clean(vr.series)),'Cilt 11 must resolve to Tensura work');
const idx=lang.buildIndex(posts),records=Object.values(idx.byUrl),explicitTR=records.filter(r=>r.explicitLang==='TR');
assert(records.length>0,'language index empty');
assert(explicitTR.length>0,'no live chapter with explicit TR label found; user-added TR tag is not visible in Blogger feed yet');
for(const r of explicitTR){const v=lang.variantsForUrl(idx,r.url);assert(v.languages.includes('TR'),'explicit TR record must include TR');assert.equal(v.show,true,'explicit TR record must show selector')}
console.log('PASS live relation:',lib.clean(vr.series),'> Cilt 11');
console.log('PASS live explicit TR:',explicitTR.length,'chapter(s) expose TR and selector show=true');
