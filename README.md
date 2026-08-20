# Nava Android

Current stable Android release: **12.1.32** (`versionCode 48`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.32 release APK SHA-256: `a9ea0408237bf185ae98d386c3ccf247639c80b4d75bd9f4494d0faa87aab8ad`.

## Follower notifications

Two short GitHub Actions sweeps provide redundancy without keeping long-running jobs queued:
- `.github/workflows/nava-notifications.yml`: primary sweep at `2-57/5 * * * *`.
- `.github/workflows/nava-notifications-backup.yml`: backup sweep at `4-59/5 * * * *`.

Both share one concurrency group and scan the current Blogger feed in a single pass. `notification-backend/scan.mjs` merges Blogger all-post, `Bölüm`, and `Cilt` feeds from both Blogspot and the custom domain, resolves the parent series, writes site notification documents, and sends FCM only to Android tokens for follower UIDs. `retry-push.mjs` retries recent completed releases for newly registered device tokens.

Android 12.1.32 and the backend use the high-importance notification channel `nava_follower_releases_v2`, while preserving the notification data payload, system-notification fallback, token deduplication, and per-post release state.

## Offline downloads

Android 12.1.31 introduced true native offline downloads instead of relying on WebView cache, and 12.1.32 preserves that system:
- download the current chapter/page;
- download a detected volume's chapters as a batch;
- browse downloaded items in the Android Downloads sheet;
- open saved content after the app is closed/reopened and without network access;
- delete or redownload saved items;
- optionally restrict downloads to Wi-Fi;
- store HTML and required static resources in app-private storage without requesting external-storage permission;
- serve saved Nava pages/resources through the native `WebViewClient.shouldInterceptRequest` interceptor;
- use the bundled offline fallback page as a Downloads entry point when the network is unavailable.

## 12.1.32 visual/layout polish

- compact Nava-blue top bar with smaller, aligned controls;
- reduced duplicate bottom spacing and dead page tail;
- restored a single normal page scroll surface outside overlays;
- simplified safe-area spacing around the bottom navigation;
- removed purple / AI-like styling from Android auth, profile, forms, modals, admin, comments and offline downloads;
- aligned buttons, focus states, cards and form fields with the site's blue-grey Nava visual language.

The existing updater, stable signing identity, profile suite, read-state, reader navigation, offline downloads, and notification v2 behavior are preserved.
