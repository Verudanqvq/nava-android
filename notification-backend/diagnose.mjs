import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseEntry, mergeEntriesByPostId, docId } from "./core.mjs";

const PROJECT_ID = "nava-01";
const FEEDS = [
  "https://verudanava.blogspot.com/feeds/posts/summary?alt=json&max-results=150&orderby=published",
  "https://verudanava.blogspot.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=150&orderby=published",
  "https://verudanava.blogspot.com/feeds/posts/summary/-/Cilt?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary/-/Cilt?alt=json&max-results=150&orderby=published"
];

const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
if (!raw.trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
const service = JSON.parse(raw);
initializeApp({ credential: cert(service), projectId: PROJECT_ID });
const db = getFirestore();

const groups = [];
for (const base of FEEDS) {
  const url = base + "&_diag=" + Date.now();
  try {
    const r = await fetch(url, { headers: { "Cache-Control":"no-cache", "Pragma":"no-cache" } });
    const j = await r.json();
    groups.push(Array.isArray(j?.feed?.entry) ? j.feed.entry : []);
  } catch (e) {
    console.log("DIAG_FEED_ERROR", base, String(e?.message || e));
  }
}

const parsed = mergeEntriesByPostId(groups).map(parseEntry).filter(x => x.postId)
  .sort((a,b) => (b.publishedMs||0) - (a.publishedMs||0));

console.log("DIAG_COUNT", parsed.length);
for (const post of parsed) {
  const ref = db.collection("releaseAutomationPostsV5").doc(docId(post.postId));
  const snap = await ref.get();
  const state = snap.exists ? (snap.data()?.status || "") : "MISSING";
  console.log("DIAG_POST", JSON.stringify({
    postId: post.postId,
    title: post.title,
    published: post.publishedMs ? new Date(post.publishedMs).toISOString() : "",
    kind: post.kind,
    labels: post.labels,
    state,
    url: post.url
  }));
}
