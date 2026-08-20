import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const PROJECT_ID = "nava-01";
const LOOKBACK_MS = 6 * 60 * 60 * 1000;

function clean(value, max=500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw.trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT GitHub secret eksik.");
  const data = JSON.parse(raw);
  if (data.project_id !== PROJECT_ID || !data.client_email || !data.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nava-01 servis hesabı değil.");
  }
  return data;
}

initializeApp({ credential: cert(loadServiceAccount()), projectId: PROJECT_ID });
const db = getFirestore();
const messaging = getMessaging();

function millis(value) {
  try {
    if (value && typeof value.toMillis === "function") return value.toMillis();
  } catch {}
  return 0;
}

function releaseKind(data) {
  const text = `${clean(data?.title, 500)} ${clean(data?.url, 1000)}`.toLocaleLowerCase("tr-TR");
  return /\b(cilt|volume|vol)\b/.test(text) ? "volume" : "chapter";
}

async function followerUids(seriesId) {
  const snap = await db.collection("seriesFollowers").doc(seriesId).collection("users").get();
  return snap.docs.map((doc) => doc.id).filter(Boolean);
}

async function tokenDocsForUsers(uids) {
  const docs = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    if (!chunk.length) continue;
    const snap = await db.collection("devicePushTokens").where("uid", "in", chunk).get();
    snap.docs.forEach((doc) => docs.push(doc));
  }
  return docs;
}

async function sendOutstanding(releaseDoc) {
  const data = releaseDoc.data() || {};
  const seriesId = clean(data.seriesId, 220);
  const url = clean(data.url, 2000);
  if (!seriesId || !url || data.status !== "completed") return { skipped: "invalid-release" };

  const uids = await followerUids(seriesId);
  if (!uids.length) return { skipped: "no-followers" };

  const allTokenDocs = await tokenDocsForUsers(uids);
  const delivered = new Set(Array.isArray(data.pushDeliveredTokenDocs) ? data.pushDeliveredTokenDocs : []);
  const pendingDocs = allTokenDocs.filter((doc) => !delivered.has(doc.id) && clean(doc.data()?.token, 4096));

  if (!pendingDocs.length) {
    return {
      skipped: allTokenDocs.length ? "all-current-tokens-delivered" : "no-device-tokens",
      followers: uids.length,
      tokens: allTokenDocs.length
    };
  }

  const kind = releaseKind(data);
  const seriesTitle = clean(data.seriesTitle, 240) || "Takip ettiğin eser";
  const releaseTitle = clean(data.title, 500) || (kind === "volume" ? "Yeni cilt yayımlandı" : "Yeni bölüm yayımlandı");
  const notificationId = "chapter_" + releaseDoc.id;

  let success = 0;
  let failed = 0;
  const newlyDelivered = [];
  const deadRefs = [];

  for (let i = 0; i < pendingDocs.length; i += 500) {
    const chunk = pendingDocs.slice(i, i + 500);
    const tokens = chunk.map((doc) => clean(doc.data()?.token, 4096));
    const systemTitle = (kind === "volume" ? "Yeni cilt • " : "Yeni bölüm • ") + seriesTitle;
    const result = await messaging.sendEachForMulticast({
      tokens,
      data: {
        kind,
        seriesTitle,
        releaseTitle,
        url,
        notificationId
      },
      android: {
        priority: "high",
        ttl: 24 * 60 * 60 * 1000
      }
    });

    success += result.successCount;
    failed += result.failureCount;
    result.responses.forEach((response, index) => {
      const doc = chunk[index];
      if (response.success) {
        newlyDelivered.push(doc.id);
        return;
      }
      const code = response.error?.code || "";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        deadRefs.push(doc.ref);
      }
    });
  }

  for (let i = 0; i < deadRefs.length; i += 400) {
    const batch = db.batch();
    deadRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  const merged = [...new Set([...delivered, ...newlyDelivered])].slice(-500);
  await releaseDoc.ref.set({
    pushDeliveredTokenDocs: merged,
    pushLastAttemptAt: FieldValue.serverTimestamp(),
    pushLastSuccessCount: success,
    pushLastFailureCount: failed,
    pushLastTokenCount: allTokenDocs.length,
    pushPendingTokenCount: Math.max(0, pendingDocs.length - newlyDelivered.length),
    ...(newlyDelivered.length ? { pushLastDeliveredAt: FieldValue.serverTimestamp() } : {})
  }, { merge: true });

  return {
    followers: uids.length,
    tokens: allTokenDocs.length,
    attempted: pendingDocs.length,
    success,
    failed,
    newlyDelivered: newlyDelivered.length
  };
}

const snap = await db.collection("chapterReleases").limit(300).get();
const now = Date.now();
const recent = snap.docs
  .filter((doc) => {
    const data = doc.data() || {};
    const when = millis(data.completedAt) || millis(data.updatedAt) || millis(data.createdAt);
    return data.status === "completed" && when > 0 && now - when <= LOOKBACK_MS;
  })
  .sort((a, b) => {
    const ad = a.data() || {}, bd = b.data() || {};
    return (millis(bd.completedAt) || millis(bd.updatedAt) || 0) - (millis(ad.completedAt) || millis(ad.updatedAt) || 0);
  });

let releases = 0, sent = 0, pendingNoToken = 0, failures = 0;
for (const doc of recent) {
  try {
    const result = await sendOutstanding(doc);
    releases += 1;
    sent += Number(result?.newlyDelivered || 0);
    if (result?.skipped === "no-device-tokens") pendingNoToken += 1;
    console.log("NAVA_PUSH_RETRY_RELEASE " + JSON.stringify({ releaseId: doc.id, title: doc.data()?.title || "", ...result }));
  } catch (error) {
    failures += 1;
    console.error("NAVA_PUSH_RETRY_FAILED " + JSON.stringify({ releaseId: doc.id, error: String(error?.stack || error) }));
  }
}

console.log("NAVA_PUSH_RETRY_RESULT " + JSON.stringify({ releases, sent, pendingNoToken, failures }));
if (failures) process.exitCode = 1;
