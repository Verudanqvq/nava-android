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
  const data = snap.exists ? (snap.data() || {}) : {};
  let release = null;
  if (data.releaseId) {
    const releaseSnap = await db.collection("chapterReleases").doc(data.releaseId).get();
    if (releaseSnap.exists) {
      const rd = releaseSnap.data() || {};
      release = {
        status: rd.status || "",
        seriesId: rd.seriesId || "",
        seriesTitle: rd.seriesTitle || "",
        followerCount: rd.followerCount ?? null,
        sentCount: rd.sentCount ?? null,
        title: rd.title || "",
        url: rd.url || ""
      };
    }
  }
  let followerUsers = null;
  if (data.seriesId) {
    const fs = await db.collection("seriesFollowers").doc(data.seriesId).collection("users").get();
    followerUsers = fs.size;

    if (data.releaseId && post === parsed[0]) {
      for (const follower of fs.docs) {
        const uid = follower.id;
        const notifId = "chapter_" + data.releaseId;
        const notifSnap = await db.collection("users").doc(uid).collection("notifications").doc(notifId).get();
        const tokenSnap = await db.collection("devicePushTokens").where("uid", "==", uid).get();
        console.log("DIAG_RECIPIENT", JSON.stringify({
          uidTail: uid.slice(-8),
          notificationExists: notifSnap.exists,
          notificationType: notifSnap.exists ? (notifSnap.data()?.type || "") : "",
          notificationTitle: notifSnap.exists ? (notifSnap.data()?.title || "") : "",
          notificationRead: notifSnap.exists ? !!notifSnap.data()?.read : null,
          tokenCount: tokenSnap.size,
          tokenApps: tokenSnap.docs.map(d => ({
            appVersion: d.data()?.appVersion || "",
            platform: d.data()?.platform || "",
            hasToken: !!d.data()?.token
          }))
        }));
      }
    }
  }
  console.log("DIAG_POST", JSON.stringify({
    postId: post.postId,
    title: post.title,
    published: post.publishedMs ? new Date(post.publishedMs).toISOString() : "",
    kind: post.kind,
    labels: post.labels,
    state: snap.exists ? (data.status || "") : "MISSING",
    stateSeriesId: data.seriesId || "",
    stateSeriesTitle: data.seriesTitle || "",
    releaseId: data.releaseId || "",
    followerUsers,
    release,
    url: post.url
  }));
}

const series = await db.collection("seriesFollowers").limit(300).get();
for (const doc of series.docs) {
  const users = await doc.ref.collection("users").get();
  const d = doc.data() || {};
  if (users.size > 0) {
    console.log("DIAG_SERIES_FOLLOWERS", JSON.stringify({
      seriesId: doc.id,
      title: d.title || "",
      url: d.url || "",
      followers: users.size
    }));
  }
}
