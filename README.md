# Nava Android

Current stable Android release: **12.1.31** (`versionCode 47`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.31 release APK SHA-256: `de67deca07cf3892e3e186365e04d6f4eb20fca0ff13cda1f0c0ab9f405fd8bb`.

## Follower notifications

Two short GitHub Actions sweeps provide redundancy without keeping long-running jobs queued:
- `.github/workflows/nava-notifications.yml`: primary sweep at `2-57/5 * * * *`.
- `.github/workflows/nava-notifications-backup.yml`: backup sweep at `4-59/5 * * * *`.

Both share one concurrency group and scan the current Blogger feed in a single pass. `notification-backend/scan.mjs` merges Blogger all-post, `Bölüm`, and `Cilt` feeds from both Blogspot and the custom domain, resolves the parent series, writes site notification documents, and sends FCM only to Android tokens for follower UIDs. `retry-push.mjs` retries recent completed releases for newly registered device tokens.

Android 12.1.31 and the backend use the fresh high-importance notification channel `nava_follower_releases_v2`, while preserving the notification data payload, system-notification fallback, token deduplication, and per-post release state.

## Offline downloads

Android 12.1.31 includes true native offline downloads instead of relying on WebView cache:
- download the current chapter/page;
- download a detected volume's chapters as a batch;
- browse downloaded items in the Android Downloads sheet;
- open saved content after the app is closed/reopened and without network access;
- delete or redownload saved items;
- optionally restrict downloads to Wi-Fi;
- store HTML and required static resources in app-private storage without requesting external-storage permission;
- serve saved Nava pages/resources through the native `WebViewClient.shouldInterceptRequest` interceptor;
- use the bundled offline fallback page as a Downloads entry point when the network is unavailable.

The existing updater, stable signing identity, profile suite, read-state, reader navigation, and 12.1.30 UI/reader polish are preserved.
