# Nava Android

Current stable Android release: **12.1.29** (`versionCode 45`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.

## Follower notifications

`.github/workflows/nava-notifications.yml` runs every 5 minutes. Each run performs five scan/retry passes roughly one minute apart.

`notification-backend/scan.mjs`:
- merges Blogger all-post, `Bölüm`, and `Cilt` feeds from both Blogspot and the custom domain;
- resolves the parent series;
- reads `seriesFollowers/{seriesId}/users`;
- writes the site's Firestore notification documents;
- sends FCM only to Android token documents belonging to those follower UIDs;
- sends both the existing data payload and an Android system-notification fallback on the `nava_follower_releases` channel;
- stores per-post state so failed/unresolved posts retry instead of disappearing.

`notification-backend/retry-push.mjs` retries recent completed releases for newly registered device tokens and deduplicates by token-document id while using the same system-notification fallback.

Android 12.1.29 preserves the updater, signing, reader, read-state, icon and profile behavior, refreshes FCM registration to 12.1.29, and re-prompts the Android 13+ notification permission once for this release when it is still denied.
