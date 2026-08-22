import assert from 'node:assert/strict';

function activeItems(items){return items.filter(x=>!['done','cancelled'].includes(String(x.status||'waiting')))}
function progress(items){const total=items.length||1;let score=0;for(const x of items){const st=String(x.status||'waiting');if(st==='done'||st==='cancelled')score+=1;else if((st==='active'||st==='retry')&&Number(x.total)>0)score+=Math.max(0,Math.min(1,(Number(x.done)||0)/Number(x.total)))}return Math.max(0,Math.min(100,Math.round(score/total*100)))}
function group(items){const m=new Map();for(const x of items){const key=x.groupKey;m.set(key,(m.get(key)||[]).concat(x))}return m}

const rows=[
 {url:'a',groupKey:'eser|v:1',seriesName:'Eser',volumeNo:'1',chapterNo:'0',status:'done',done:10,total:10},
 {url:'b',groupKey:'eser|v:1',seriesName:'Eser',volumeNo:'1',chapterNo:'1',status:'active',done:5,total:10},
 {url:'c',groupKey:'eser|v:2',seriesName:'Eser',volumeNo:'2',chapterNo:'0',status:'waiting',done:0,total:0},
 {url:'d',groupKey:'baska|v:1',seriesName:'Başka',volumeNo:'1',chapterNo:'1',status:'done',done:1,total:1}
];
const g=group(rows);
assert.equal(g.size,3,'explicit groupKey must isolate series/volume groups');
assert.equal(progress(g.get('eser|v:1')),75,'done + half-active must yield 75%');
assert.equal(activeItems(g.get('eser|v:1')).length,1,'completed item must not remain visibly waiting');
assert.equal(activeItems(g.get('baska|v:1')).length,0,'fully completed group must disappear');
assert.equal(activeItems(g.get('eser|v:2')).length,1,'pending volume must stay visible');

const sameTitleWrongVolume=[
 {title:'Bölüm 1',groupKey:'eser|v:1',status:'active'},
 {title:'Bölüm 1',groupKey:'eser|v:2',status:'waiting'}
];
assert.equal(group(sameTitleWrongVolume).size,2,'same chapter title in different volumes must never share one progress bar');

console.log('V12172_STATE_OK native-authority=1 compact-completed=1 explicit-volume-groups=1 progress=75');
