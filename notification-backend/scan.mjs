import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  clean, normalize, docId, canonicalUrl, parseEntry, isGenericLabel,
  stripVolumeSuffix, seriesRecord, resolveSeries, releaseId, hrefsFromHtml,
  mergeEntriesByPostId, decidePostAction
} from "./core.mjs";

const PROJECT_ID = "nava-01";
const DELIVERY_LEASE_MS = 3 * 60 * 1000;
const FEED_BASES = [
  "https://verudanava.blogspot.com/feeds/posts/summary?alt=json&max-results=150&orderby=published",
  "https://verudanava.blogspot.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=150&orderby=published",
  "https://verudanava.blogspot.com/feeds/posts/summary/-/Cilt?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary/-/B%C3%B6l%C3%BCm?alt=json&max-results=150&orderby=published",
  "https://www.verudanava.com/feeds/posts/summary/-/Cilt?alt=json&max-results=150&orderby=published"
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

async function fetchEntries() {
  const groups = [];
  const errors = [];
  const stamp = Date.now();

  for (const base of FEED_BASES) {
    const url = base + (base.includes("?") ? "&" : "?") + "_nava=" + stamp;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "NavaGitHubNotifications/5.1",
          "Cache-Control": "no-cache, no-store, max-age=0",
          "Pragma": "no-cache"
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      groups.push(Array.isArray(json?.feed?.entry) ? json.feed.entry : []);
    } catch (error) {
      errors.push({ url: base, error: String(error?.message || error) });
    }
  }

  const merged = mergeEntriesByPostId(groups);
  if (!merged.length) {
    throw new Error("Blogger feed boş/alınamadı: " + JSON.stringify(errors));
  }
  if (errors.length) console.warn("FEED_PARTIAL_ERRORS " + JSON.stringify(errors));
  console.log("FEED_MERGED " + JSON.stringify({
    sourcesOk: groups.length,
    sourceErrors: errors.length,
    entries: merged.length
  }));
  return merged;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "NavaGitHubNotifications/5.1" },
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
  if (!tokenDocs.length) {
    return { success: 0, failed: 0, cleaned: 0, attempted: 0, deliveredTokenDocs: [] };
  }

  let success = 0, failed = 0, cleaned = 0, attempted = 0;
  const deadRefs = [];
  const deliveredTokenDocs = [];

  for (let i = 0; i < tokenDocs.length; i += 500) {
    const chunk = tokenDocs.slice(i, i + 500)
      .filter((doc) => clean(doc.data()?.token, 4096));
    const tokens = chunk.map((doc) => clean(doc.data()?.token, 4096));
    if (!tokens.length) continue;
    attempted += tokens.length;

    const systemTitle = (release.kind === "volume" ? "Yeni cilt • " : "Yeni bölüm • ") + (series.title || "Takip ettiğin eser");
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: systemTitle,
        body: release.title || (release.kind === "volume" ? "Yeni cilt yayımlandı" : "Yeni bölüm yayımlandı")
      },
      data: {
        kind: release.kind,
        seriesTitle: series.title,
        releaseTitle: release.title,
        url: release.url,
        notificationId
      },
      android: {
        priority: "high",
        ttl: 24 * 60 * 60 * 1000,
        notification: {
          channelId: "nava_follower_releases_v3",
          tag: notificationId
        }
      }
    });

    success += result.successCount;
    failed += result.failureCount;

    result.responses.forEach((response, index) => {
      const tokenDoc = chunk[index];
      if (response.success) {
        deliveredTokenDocs.push(tokenDoc.id);
        return;
      }
      const code = response.error?.code || "";
      if (code === "messaging/registration-token-not-registered"
          || code === "messaging/invalid-registration-token") {
        deadRefs.push(tokenDoc.ref);
      }
    });
  }

  for (let i = 0; i < deadRefs.length; i += 400) {
    const batch = db.batch();
    deadRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
    cleaned += Math.min(400, deadRefs.length - i);
  }

  return {
    success,
    failed,
    cleaned,
    attempted,
    deliveredTokenDocs: [...new Set(deliveredTokenDocs)].slice(-500)
  };
}

async function deliver(release, series) {
  const rid = releaseId(series.id, release.url);
  const releaseRef = db.collection("chapterReleases").doc(rid);
  const attemptId = `github_${release.postId}_${Date.now().toString(36)}`;

  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(releaseRef);
    const existing = snap.exists ? (snap.data() || {}) : {};
    if (existing.status === "completed") return "completed";

    const now = Timestamp.now();
    const leaseUntilMs = existing.leaseUntil && typeof existing.leaseUntil.toMillis === "function"
      ? existing.leaseUntil.toMillis() : 0;
    if (existing.status === "sending" && leaseUntilMs > now.toMillis()) {
      return "lease-active";
    }

    tx.set(releaseRef, {
      releaseId: rid,
      seriesId: series.id,
      seriesTitle: series.title,
      seriesUrl: series.url || "https://www.verudanava.com/",
      title: release.title,
      url: release.url,
      createdBy: "github-action",
      attemptId,
      status: "sending",
      leaseUntil: Timestamp.fromMillis(now.toMillis() + DELIVERY_LEASE_MS),
      errorMessage: "",
      followerCount: 0,
      sentCount: 0,
      createdAt: existing.createdAt || now,
      updatedAt: now
    }, { merge: true });
    return "claimed";
  });

  if (claim !== "claimed") {
    console.log("NAVA_DELIVERY_CLAIM " + JSON.stringify({ rid, claim, release: release.title }));
    return { skipped: true, reason: claim, rid };
  }

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

  let pushResult = { success: 0, failed: 0, cleaned: 0, attempted: 0, deliveredTokenDocs: [] };
  try {
    pushResult = await sendPush(uids, release, series, "chapter_" + rid);
  } catch (error) {
    console.error("FCM push failed; site notification is already written:", error);
  }

  const delivered = Array.isArray(pushResult.deliveredTokenDocs)
    ? pushResult.deliveredTokenDocs : [];

  await releaseRef.set({
    followerCount: uids.length,
    sentCount: sent,
    status: "completed",
    errorMessage: "",
    pushDeliveredTokenDocs: delivered,
    pushLastAttemptAt: FieldValue.serverTimestamp(),
    pushLastSuccessCount: Number(pushResult.success || 0),
    pushLastFailureCount: Number(pushResult.failed || 0),
    pushLastTokenCount: Number(pushResult.attempted || 0),
    pushPendingTokenCount: Math.max(0, Number(pushResult.attempted || 0) - delivered.length),
    ...(delivered.length ? { pushLastDeliveredAt: FieldValue.serverTimestamp() } : {}),
    leaseUntil: FieldValue.delete(),
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(JSON.stringify({
    release: release.title,
    series: series.title,
    followers: uids.length,
    siteNotifications: sent,
    push: {
      success: pushResult.success,
      failed: pushResult.failed,
      cleaned: pushResult.cleaned,
      attempted: pushResult.attempted,
      deliveredTokenDocs: delivered.length
    }
  }));

  return { skipped: false, rid, sent, pushResult };
}

const ENGINE_DOC = "bloggerScannerGithubV5";
const POST_STATE_COLLECTION = "releaseAutomationPostsV5";

async function currentEngineState() {
  const ref = db.collection("releaseAutomation").doc(ENGINE_DOC);
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? (snap.data() || {}) : {} };
}

async function baselineCurrentFeed(parsed, engineRef) {
  let written = 0;
  for (let i = 0; i < parsed.length; i += 350) {
    const batch = db.batch();
    for (const post of parsed.slice(i, i + 350)) {
      if (!post.postId) continue;
      const ref = db.collection(POST_STATE_COLLECTION).doc(docId(post.postId));
      batch.set(ref, {
        postId: post.postId,
        title: post.title || "",
        url: post.url || "",
        kind: post.kind || "",
        status: "baseline",
        baselineAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      written += 1;
    }
    await batch.commit();
  }

  await engineRef.set({
    version: 5,
    initialized: true,
    initializedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    baselineCount: written,
    lastResult: { baseline: true, feedCount: parsed.length, delivered: 0, retry: 0, failed: 0 }
  }, { merge: true });

  console.log("NAVA_BASELINE_V5 " + JSON.stringify({
    feedCount: parsed.length,
    baselineCount: written
  }));
}

async function postState(postIdValue) {
  const ref = db.collection(POST_STATE_COLLECTION).doc(docId(postIdValue));
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? (snap.data() || {}) : {} };
}

async function markPost(ref, post, status, extra={}) {
  await ref.set({
    postId: post.postId,
    title: post.title || "",
    url: post.url || "",
    kind: post.kind || "",
    status,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra
  }, { merge: true });
}

async function scan() {
  const rawEntries = await fetchEntries();
  const parsed = rawEntries.map(parseEntry).filter((x) => x.postId);

  const engine = await currentEngineState();
  if (!engine.snap.exists || engine.data.initialized !== true) {
    await baselineCurrentFeed(parsed, engine.ref);
    return;
  }

  const catalog = await buildCatalog(parsed);
  let delivered = 0;
  let retry = 0;
  let failed = 0;
  let ignored = 0;
  let completedSkipped = 0;
  const details = [];

  const ordered = parsed.slice().sort((a,b) => (b.publishedMs || 0) - (a.publishedMs || 0));

  for (const post of ordered) {
    const state = await postState(post.postId);
    const status = state.data.status || "";

    if (status === "baseline" || status === "completed" || status === "ignored") {
      continue;
    }

    if (!post.kind || !post.url) {
      ignored += 1;
      await markPost(state.ref, post, "ignored", { reason: "not-cilt-or-bolum" });
      continue;
    }

    const series = resolveSeries(post, catalog);
    let releaseDone = false;
    let rid = "";

    if (series) {
      rid = releaseId(series.id, post.url);
      const releaseSnap = await db.collection("chapterReleases").doc(rid).get();
      releaseDone = releaseSnap.exists && releaseSnap.data()?.status === "completed";
    }

    const action = decidePostAction({
      initialized: true,
      postState: status,
      releaseCompleted: releaseDone,
      isRelease: true,
      seriesResolved: !!series
    });

    if (action === "complete") {
      completedSkipped += 1;
      await markPost(state.ref, post, "completed", {
        releaseId: rid || state.data.releaseId || "",
        completedReason: releaseDone ? "chapterRelease-already-completed" : "post-state-completed"
      });
      continue;
    }

    if (action === "retry") {
      retry += 1;
      await markPost(state.ref, post, "retry", {
        retryReason: "parent-series-not-resolved",
        labels: post.labels || [],
        candidates: post.candidates || []
      });
      details.push({ postId: post.postId, title: post.title, status: "retry", labels: post.labels });
      console.log("NAVA_RETRY_UNMATCHED " + JSON.stringify({
        postId: post.postId,
        title: post.title,
        labels: post.labels,
        candidates: post.candidates
      }));
      continue;
    }

    try {
      const result = await deliver(post, series);
      if (result?.skipped && result.reason === "lease-active") {
        retry += 1;
        await markPost(state.ref, post, "retry", {
          retryReason: "delivery-lease-active",
          releaseId: rid,
          seriesId: series.id,
          seriesTitle: series.title
        });
        details.push({ postId: post.postId, title: post.title, status: "lease-active", series: series.title });
        continue;
      }

      if (result?.skipped) completedSkipped += 1;
      else delivered += 1;

      await markPost(state.ref, post, "completed", {
        releaseId: rid,
        seriesId: series.id,
        seriesTitle: series.title,
        completedAt: FieldValue.serverTimestamp()
      });
      details.push({
        postId: post.postId,
        title: post.title,
        status: result?.skipped ? "already-completed" : "delivered",
        series: series.title
      });
    } catch (error) {
      failed += 1;
      await markPost(state.ref, post, "retry", {
        retryReason: "delivery-failed",
        lastError: clean(String(error?.stack || error), 1500)
      });
      details.push({ postId: post.postId, title: post.title, status: "failed-retry" });
      console.error("NAVA_RETRY_FAILED " + JSON.stringify({
        postId: post.postId,
        title: post.title,
        error: String(error?.message || error)
      }));
    }
  }

  const result = {
    baseline: false,
    feedCount: parsed.length,
    delivered,
    retry,
    failed,
    ignored,
    completedSkipped
  };

  await engine.ref.set({
    version: 5,
    initialized: true,
    updatedAt: FieldValue.serverTimestamp(),
    lastResult: result
  }, { merge: true });

  console.log("NAVA_SCAN_RESULT_V5 " + JSON.stringify(result));
  if (details.length) {
    console.log("NAVA_SCAN_DETAILS_V5 " + JSON.stringify(details.slice(0, 50)));
  }
}

await scan();
