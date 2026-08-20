import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID='nava-01';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw.trim()) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
const sa=JSON.parse(raw);
if(!getApps().length) initializeApp({credential:cert(sa),projectId:PROJECT_ID});
const db=getFirestore();
const phase=process.argv[2]||'state';
const clean=(v,n=400)=>String(v??'').trim().slice(0,n);
const ms=(v)=>{try{return v?.toMillis?.()||0}catch{return 0}};
const iso=(v)=>{const n=ms(v);return n?new Date(n).toISOString():''};
const labels=(e)=>(e?.category||[]).map(x=>clean(x?.term,100)).filter(Boolean);
const pid=(e)=>{const s=clean(e?.id?.$t,500);const m=s.match(/post-(\d+)/i);return m?m[1]:s};
const url=(e)=>clean((e?.link||[]).find(x=>x?.rel==='alternate')?.href||'',1200);

const feeds=[
 'https://verudanava.blogspot.com/feeds/posts/summary?alt=json&max-results=50&orderby=published',
 'https://verudanava.blogspot.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=50&orderby=published',
 'https://verudanava.blogspot.com/feeds/posts/summary/-/Cilt?alt=json&max-results=50&orderby=published',
 'https://www.verudanava.com/feeds/posts/summary?alt=json&max-results=50&orderby=published',
 'https://www.verudanava.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=50&orderby=published',
 'https://www.verudanava.com/feeds/posts/summary/-/Cilt?alt=json&max-results=50&orderby=published'
];
const map=new Map(),feedErrors=[];
for(const base of feeds){
 try{
  const r=await fetch(base+'&_diag='+Date.now(),{headers:{'User-Agent':'NavaPipelineDiagnose/1','Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const j=await r.json();
  for(const e of (j?.feed?.entry||[])){const id=pid(e);if(id&&!map.has(id))map.set(id,e)}
 }catch(e){feedErrors.push(String(e?.message||e))}
}
const feed=[...map.values()].filter(e=>{
 const t=clean(e?.title?.$t,500),ls=labels(e);
 return ls.some(x=>/^(Cilt|Bölüm|Bolum)$/i.test(x))||/\b(cilt|bölüm|bolum|chapter|volume)\b/i.test(t);
}).sort((a,b)=>Date.parse(b?.published?.$t||0)-Date.parse(a?.published?.$t||0)).slice(0,8);

const engineSnap=await db.collection('releaseAutomation').doc('bloggerScannerGithubV5').get();
const engine=engineSnap.exists?engineSnap.data():{};
const statesSnap=await db.collection('releaseAutomationPostsV5').limit(300).get();
const states=new Map(statesSnap.docs.map(d=>[d.id,d.data()||{}]));
const relSnap=await db.collection('chapterReleases').limit(300).get();
const releases=relSnap.docs.map(d=>({id:d.id,...(d.data()||{})})).sort((a,b)=>(ms(b.completedAt)||ms(b.updatedAt)||0)-(ms(a.completedAt)||ms(a.updatedAt)||0)).slice(0,10);
const tokenSnap=await db.collection('devicePushTokens').get();
const tokenInfo=tokenSnap.docs.map(d=>({appVersion:clean(d.data()?.appVersion,40),platform:clean(d.data()?.platform,30),updatedAt:iso(d.data()?.updatedAt)}));
const tokenUids=[...new Set(tokenSnap.docs.map(d=>clean(d.data()?.uid,200)).filter(Boolean))];
const site=[];
for(const uid of tokenUids){
 const ns=await db.collection('users').doc(uid).collection('notifications').limit(150).get();
 const latest=ns.docs.map(d=>({id:d.id,...(d.data()||{})})).sort((a,b)=>(ms(b.createdAt)||ms(b.updatedAt)||0)-(ms(a.createdAt)||ms(a.updatedAt)||0)).slice(0,8);
 site.push({count:ns.size,latest:latest.map(x=>({id:x.id,type:clean(x.type,40),title:clean(x.title,180),body:clean(x.body,180),createdAt:iso(x.createdAt)}))});
}

console.log('=== '+phase+' '+new Date().toISOString()+' ===');
console.log('feedErrors='+JSON.stringify(feedErrors));
console.log('engine='+JSON.stringify({exists:engineSnap.exists,initialized:engine.initialized,version:engine.version,updatedAt:iso(engine.updatedAt),lastResult:engine.lastResult||null}));
console.log('tokens='+JSON.stringify(tokenInfo));
console.log('siteNotifications='+JSON.stringify(site));
console.log('chapterReleases='+JSON.stringify(releases.map(r=>({id:r.id,title:clean(r.title,200),seriesTitle:clean(r.seriesTitle,200),status:r.status,updatedAt:iso(r.updatedAt),completedAt:iso(r.completedAt),followerCount:r.followerCount,sentCount:r.sentCount,pushLastSuccessCount:r.pushLastSuccessCount,pushLastFailureCount:r.pushLastFailureCount,pushPendingTokenCount:r.pushPendingTokenCount}))));
console.log('feed='+JSON.stringify(feed.map(e=>{const id=pid(e),s=states.get(id)||{};return{postId:id,title:clean(e?.title?.$t,220),published:clean(e?.published?.$t,80),labels:labels(e),url:url(e),state:{exists:states.has(id),status:clean(s.status,50),updatedAt:iso(s.updatedAt),retryReason:clean(s.retryReason,120),seriesTitle:clean(s.seriesTitle,200),releaseId:clean(s.releaseId,220)}}})));