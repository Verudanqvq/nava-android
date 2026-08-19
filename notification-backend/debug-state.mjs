import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "nava-01";
const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
if (!raw.trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
const sa = JSON.parse(raw);
initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
const db = getFirestore();

function ms(v){ try { return v && typeof v.toMillis === 'function' ? v.toMillis() : 0; } catch { return 0; } }
function iso(v){ const n=ms(v); return n?new Date(n).toISOString():""; }
function safe(v,n=180){ return String(v==null?"":v).slice(0,n); }

const engineSnap = await db.collection('releaseAutomation').doc('bloggerScannerGithubV5').get();
const engine = engineSnap.exists ? engineSnap.data()||{} : {};

const tokenSnap = await db.collection('devicePushTokens').limit(300).get();
const tokenVersions = {};
const tokenPlatforms = {};
let validTokenDocs=0;
let newestTokenAt=0;
const tokenUidSet=new Set();
for(const doc of tokenSnap.docs){
  const d=doc.data()||{};
  if(safe(d.token,4096)) validTokenDocs++;
  const ver=safe(d.appVersion,40)||'(none)'; tokenVersions[ver]=(tokenVersions[ver]||0)+1;
  const p=safe(d.platform,40)||'(none)'; tokenPlatforms[p]=(tokenPlatforms[p]||0)+1;
  if(d.uid) tokenUidSet.add(String(d.uid));
  newestTokenAt=Math.max(newestTokenAt,ms(d.updatedAt),ms(d.createdAt));
}

const postSnap = await db.collection('releaseAutomationPostsV5').limit(300).get();
const posts=postSnap.docs.map(doc=>({id:doc.id,...(doc.data()||{})})).sort((a,b)=>Math.max(ms(b.updatedAt),ms(b.baselineAt))-Math.max(ms(a.updatedAt),ms(a.baselineAt))).slice(0,20).map(p=>({
  id:p.id,title:safe(p.title,140),kind:safe(p.kind,30),status:safe(p.status,30),reason:safe(p.reason,120),updatedAt:iso(p.updatedAt),url:safe(p.url,220)
}));

const relSnap = await db.collection('chapterReleases').limit(300).get();
const releases=relSnap.docs.map(doc=>({id:doc.id,...(doc.data()||{})})).sort((a,b)=>Math.max(ms(b.completedAt),ms(b.updatedAt),ms(b.createdAt))-Math.max(ms(a.completedAt),ms(a.updatedAt),ms(a.createdAt))).slice(0,15).map(r=>({
  id:r.id,title:safe(r.title,140),seriesId:safe(r.seriesId,160),seriesTitle:safe(r.seriesTitle,140),status:safe(r.status,30),followers:Number(r.followerCount||0),siteSent:Number(r.sentCount||0),pushSuccess:Number(r.pushLastSuccessCount??-1),pushFailure:Number(r.pushLastFailureCount??-1),pushTokenCount:Number(r.pushLastTokenCount??-1),pushPending:Number(r.pushPendingTokenCount??-1),completedAt:iso(r.completedAt),updatedAt:iso(r.updatedAt),url:safe(r.url,220)
}));

const followerRoots = await db.collection('seriesFollowers').limit(300).get();
const followerSummary=[];
for(const doc of followerRoots.docs.slice(0,80)){
  const users=await doc.ref.collection('users').get();
  if(users.size) followerSummary.push({seriesId:doc.id,title:safe((doc.data()||{}).title,140),followers:users.size});
}
followerSummary.sort((a,b)=>b.followers-a.followers);

const out={
  checkedAt:new Date().toISOString(),
  engine:{exists:engineSnap.exists,initialized:engine.initialized===true,version:engine.version||null,updatedAt:iso(engine.updatedAt),lastResult:engine.lastResult||null,baselineCount:engine.baselineCount||0},
  tokens:{docs:tokenSnap.size,validTokenDocs,uniqueUids:tokenUidSet.size,versions:tokenVersions,platforms:tokenPlatforms,newestAt:newestTokenAt?new Date(newestTokenAt).toISOString():""},
  followers:followerSummary.slice(0,30),
  recentPosts:posts,
  recentReleases:releases
};
console.log(JSON.stringify(out,null,2));
