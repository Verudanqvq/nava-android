import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  clean, normalize, docId, canonicalUrl, parseEntry, isGenericLabel,
  stripVolumeSuffix, seriesRecord, resolveSeries, releaseId, hrefsFromHtml
} from "./core.mjs";

const PROJECT_ID = "nava-01";
const FIRST_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const FEEDS = [
  "https://verudanava.blogspot.com/feeds/posts/summary?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary?alt=json&max-results=150&orderby=published"
];

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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "NavaGitHubNotifications/1.0" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchEntries() {
  let lastError = null;
  for (const url of FEEDS) {
    try {
      const json = await fetchJson(url);
      return Array.isArray(json?.feed?.entry) ? json.feed.entry : [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Blogger feed alınamadı.");
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "NavaGitHubNotifications/1.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return "";
  return response.text();
}

function addAlias(aliasMap, seriesId, value) {
  const v = normalize(stripVolumeSuffix(value) || value);
  if (!v || v.length < 2 || isGenericLabel(v)) return;
  if (!aliasMap.has(seriesId)) aliasMap.set(seriesId, new Set());
  aliasMap.get(seriesId).add(v);
}

async function loadPersistedAliases(aliasMap) {
  const snap = await db.collection("releaseAutomationSeries").limit(300).get();
  snap.docs.forEach((doc) => {
    for (const value of (doc.data()?.aliases || [])) addAlias(aliasMap, doc.id, value);
  });
}

async function learnFromManualReleases(aliasMap, feedByUrl) {
  const releases = await db.collection("chapterReleases").limit(300).get();
  releases.docs.forEach((doc) => {
    const data = doc.data() || {};
    const sid = docId(data.seriesId);
    const entry = feedByUrl.get(canonicalUrl(data.url));
    if (!sid || !entry) return;
    for (const value of entry.candidates || []) addAlias(aliasMap, sid, value);
  });
}

async function learnFromSeriesPages(aliasMap, seriesDocs, feedByUrl) {
  // Fetch in small groups so Blogger is not hammered.
  for (let i = 0; i < seriesDocs.length; i += 5) {
    const chunk = seriesDocs.slice(i, i + 5);
    await Promise.all(chunk.map(async (doc) => {
      const data = doc.data() || {};
      const seriesUrl = canonicalUrl(data.url);
      if (!seriesUrl) return;
      try {
        const html = await fetchHtml(seriesUrl);
        for (const href of hrefsFromHtml(html, seriesUrl)) {
          const entry = feedByUrl.get(href);
          if (!entry) continue;
          if (entry.kind !== "volume" && entry.kind !== "chapter") continue;
          for (const value of entry.candidates || []) addAlias(aliasMap, doc.id, value);
        }
      } catch {}
    }));
  }
}

async function saveAliases(aliasMap) {
  const jobs = [];
  for (const [seriesId, set] of aliasMap.entries()) {
    const aliases = [...set].filter(Boolean).slice(0, 60);
    if (!aliases.length) continue;
    jobs.push(db.collection("releaseAutomationSeries").doc(seriesId).set({
      seriesId, aliases, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }));
  }
  await Promise.all(jobs);
}

async function buildCatalog(parsedEntries) {
  const followersSnap = await db.collection("seriesFollowers").limit(300).get();
  const feedByUrl = new Map(parsedEntries.filter((x) => x.url).map((x) => [x.url, x]));
  const aliasMap = new Map();

  await loadPersistedAliases(aliasMap);
  await learnFromManualReleases(aliasMap, feedByUrl);
  await learnFromSeriesPages(aliasMap, followersSnap.docs, feedByUrl);
  await saveAliases(aliasMap);

  return followersSnap.docs.map((doc) =>
    seriesRecord(doc.id, doc.data() || {}, [...(aliasMap.get(doc.id) || [])])
  );
}

function notificationPayload(uid, release, series, rid) {
  return {
    notificationId: "chapter_" + rid,
    recipientUid: uid,
    type: "chapter",
    actorUid: "github-action",
    postId: series.id,
    commentId: "",
    targetId: rid,
    title: release.title,
    url: release.url,
    body: series.title,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function tokensForUsers(uids) {
  const docs = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    if (!chunk.length) continue;
    const snap = await db.collection("devicePushTokens").where("uid", "in", chunk).get();
    snap.docs.forEach((doc) => docs.push(doc));
  }
  return docs;
}

async function sendPush(uids, release, series, notificationId) {
  const tokenDocs = await tokensForUsers(uids);
  if (!tokenDocs.length) return { success: 0, failed: 0, cleaned: 0 };

  let success = 0, failed = 0, cleaned = 0;
  const deadRefs = [];

  for (let i = 0; i < tokenDocs.length; i += 500) {
    const chunk = tokenDocs.slice(i, i + 500);
    const tokens = chunk.map((doc) => clean(doc.data()?.token, 4096)).filter(Boolean);
    if (!tokens.length) continue;

    const result = await messaging.sendEachForMulticast({
      tokens,
      data: {
        kind: release.kind,
        seriesTitle: series.title,
        releaseTitle: release.title,
        url: release.url,
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
      if (response.success) return;
      const code = response.error?.code || "";
      if (code === "messaging/registration-token-not-registered"
          || code === "messaging/invalid-registration-token") {
        deadRefs.push(chunk[index].ref);
      }
    });
  }

  for (let i = 0; i < deadRefs.length; i += 400) {
    const batch = db.batch();
    deadRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
    cleaned += Math.min(400, deadRefs.length - i);
  }

  return { success, failed, cleaned };
}

async function deliver(release, series) {
  const rid = releaseId(series.id, release.url);
  const releaseRef = db.collection("chapterReleases").doc(rid);

  const shouldSend = await db.runTransaction(async (tx) => {
    const snap = await tx.get(releaseRef);
    const existing = snap.exists ? (snap.data() || {}) : {};
    if (existing.status === "completed") return false;

    const now = Timestamp.now();
    tx.set(releaseRef, {
      releaseId: rid,
      seriesId: series.id,
      seriesTitle: series.title,
      seriesUrl: series.url || "https://www.verudanava.com/",
      title: release.title,
      url: release.url,
      createdBy: "github-action",
      attemptId: `github_${release.postId}_${Date.now().toString(36)}`,
      status: "sending",
      errorMessage: "",
      followerCount: 0,
      sentCount: 0,
      createdAt: existing.createdAt || now,
      updatedAt: now
    }, { merge: true });
    return true;
  });

  if (!shouldSend) return { skipped: true, rid };

  const followerSnap = await db.collection("seriesFollowers")
    .doc(series.id).collection("users").get();
  const uids = followerSnap.docs.map((doc) => doc.id).filter(Boolean);

  let sent = 0;
  for (let i = 0; i < uids.length; i += 400) {
    const chunk = uids.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((uid) => {
      batch.set(
        db.collection("users").doc(uid).collection("notifications").doc("chapter_" + rid),
        notificationPayload(uid, release, series, rid),
        { merge: true }
      );
    });
    await batch.commit();
    sent += chunk.length;
  }

  let pushResult = { success: 0, failed: 0, cleaned: 0 };
  try {
    pushResult = await sendPush(uids, release, series, "chapter_" + rid);
  } catch (error) {
    console.error("FCM push failed; site notification is already written:", error);
  }

  await releaseRef.set({
    followerCount: uids.length,
    sentCount: sent,
    status: "completed",
    errorMessage: "",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(JSON.stringify({
    release: release.title,
    series: series.title,
    followers: uids.length,
    siteNotifications: sent,
    push: pushResult
  }));

  return { skipped: false, rid, sent, pushResult };
}

async function scan() {
  const stateRef = db.collection("releaseAutomation").doc("bloggerScannerGithub");
  const stateSnap = await stateRef.get();
  const rawEntries = await fetchEntries();
  const parsed = rawEntries.map(parseEntry).filter((x) => x.postId);
  const oldSeen = new Set(
    stateSnap.exists && Array.isArray(stateSnap.data()?.seenPostIds)
      ? stateSnap.data().seenPostIds : []
  );

  const firstRun = !stateSnap.exists;
  const now = Date.now();

  // On first install, baseline old history but still catch the user's recent test posts.
  const oldBaseline = firstRun
    ? parsed.filter((x) => !x.publishedMs || now - x.publishedMs > FIRST_LOOKBACK_MS)
            .map((x) => x.postId)
    : [];

  const candidates = (firstRun
    ? parsed.filter((x) => x.publishedMs && now - x.publishedMs <= FIRST_LOOKBACK_MS)
    : parsed.filter((x) => !oldSeen.has(x.postId))
  ).reverse();

  if (!candidates.length) {
    const keep = [];
    [...parsed.map((x) => x.postId), ...oldSeen].forEach((id) => {
      if (id && !keep.includes(id)) keep.push(id);
    });
    await stateRef.set({
      updatedAt: FieldValue.serverTimestamp(),
      seenPostIds: keep.slice(0, 300),
      lastResult: { firstRun, candidates: 0, delivered: 0, unmatched: 0 }
    }, { merge: true });
    console.log("No new release.");
    return;
  }

  const catalog = await buildCatalog(parsed);
  const deliveredIds = [];
  const irrelevantIds = [];
  let delivered = 0, unmatched = 0;

  for (const release of candidates) {
    if (!release.kind || !release.url) {
      irrelevantIds.push(release.postId);
      continue;
    }

    const series = resolveSeries(release, catalog);
    if (!series) {
      unmatched += 1;
      await db.collection("releaseAutomationUnmatched").doc(docId(release.postId)).set({
        postId: release.postId,
        title: release.title,
        url: release.url,
        labels: release.labels,
        candidates: release.candidates,
        kind: release.kind,
        reason: "parent-series-not-resolved-safely",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      // Do NOT mark recent unmatched releases as seen; retry next run.
      continue;
    }

    try {
      await deliver(release, series);
      deliveredIds.push(release.postId);
      delivered += 1;
    } catch (error) {
      console.error("Release delivery failed; will retry next run:", release.title, error);
    }
  }

  const keep = [];
  [...oldBaseline, ...deliveredIds, ...irrelevantIds, ...oldSeen].forEach((id) => {
    if (id && !keep.includes(id)) keep.push(id);
  });

  await stateRef.set({
    updatedAt: FieldValue.serverTimestamp(),
    seenPostIds: keep.slice(0, 300),
    lastResult: {
      firstRun,
      candidates: candidates.length,
      delivered,
      unmatched
    }
  }, { merge: true });

  console.log(`Done. candidates=${candidates.length} delivered=${delivered} unmatched=${unmatched}`);
}

await scan();
