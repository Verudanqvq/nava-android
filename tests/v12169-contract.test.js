'use strict';
const assert=require('assert');

function zeroSafe(v,fallback){
  const text=String(v==null?'':v).trim();
  return text!=='' && isFinite(Number(v)) ? Number(v) : fallback;
}
const got=['0.5','1','2','3','4','0'].sort((a,b)=>zeroSafe(a,999999)-zeroSafe(b,999999));
assert.deepStrictEqual(got,['0','0.5','1','2','3','4']);
assert.strictEqual(zeroSafe('0',999999),0);
assert.strictEqual(zeroSafe('',999999),999999);

function keepAll(items){
  const out=[],seen=Object.create(null);
  for(const x of items){
    const u=String(x&&x.url||'').trim();
    if(!u||seen[u])continue;
    seen[u]=1;out.push(x);
  }
  return out;
}
const batch=keepAll([
  {url:'chapter-0-tr',lang:'TR'},
  {url:'chapter-0-en',lang:'EN'},
  {url:'chapter-0-tr',lang:'TR'}
]);
assert.deepStrictEqual(batch.map(x=>x.lang),['TR','EN']);
console.log('V12169_CONTRACT_OK order=0,0.5,1,2,3,4 languages=TR+EN');
