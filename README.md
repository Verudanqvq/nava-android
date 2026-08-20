# Nava Android

Current stable Android release: **12.1.34** (`versionCode 50`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.34 release APK SHA-256: `d379b67ca145542b344b4e06f0dcf8142a1e97425528a143e175807296b764f1`.

## Follower notifications

Two short GitHub Actions sweeps provide redundancy without keeping long-running jobs queued:
- `.github/workflows/nava-notifications.yml`: primary sweep at `2-57/5 * * * *`.
- `.github/workflows/nava-notifications-backup.yml`: backup sweep at `4-59/5 * * * *`.

Both share one concurrency group and scan the current Blogger feed in a single pass. `notification-backend/scan.mjs` merges Blogger all-post, `Bölüm`, and `Cilt` feeds from both Blogspot and the custom domain, resolves the parent series, writes site notification documents, and sends FCM only to Android tokens for follower UIDs. `retry-push.mjs` retries recent completed releases for newly registered device tokens.

Android 12.1.34 and the backend use the high-importance notification channel `nava_follower_releases_v2`.

## Firestore rules

- Firestore rules are stored in `firestore.rules`.
- The permanent rules workflow runs emulator allow/deny tests first and deploys only tested rules through Firebase Admin Security Rules.
- Backend-only automation state is denied to client SDKs; Firebase Admin continues to bypass client rules as intended.

## Offline downloads

Android 12.1.31 introduced true native offline downloads and 12.1.34 preserves the app-private storage/interceptor engine. Android 12.1.34 improves the interaction layer:
- the top download control opens a Nava-style action sheet instead of performing an unclear one-tap action;
- reader pages offer the current chapter download;
- volume pages offer batch chapter download;
- series pages guide the user to select a volume rather than accidentally downloading an entire long series;
- Downloads and Wi-Fi-only settings are available from the same sheet;
- existing downloaded items still open without a network connection after app restart.

## 12.1.34 page-specific UI

- Home, series-detail, and reader pages use separate layout rules rather than one global spacing override.
- Reader header is a true four-column layout: Back / title / Download / Text settings, preventing the Text button from wrapping over the chapter body.
- Reader content spacing and bottom toolbar clearance are isolated from the normal app shell.
- Bottom navigation uses a smaller Nava-blue active icon treatment instead of a large rounded active tile.
- Series detail uses a more compact cover/content grid and Nava blue-grey library/follow styling; the purple Completed status is replaced by a blue-grey state inside Android.
- Remaining purple auth/profile control accents are overridden with the Nava blue-grey visual language.

## Blogger live-loader shutdown inside Android

Android 12.1.34 blocks every WebView request whose URL contains `/blogger-live/` at the native `WebViewClient.shouldInterceptRequest` layer. The old pinned Blogger loader therefore cannot load, flash its `Nava Loader v2` badge, fetch its manifest, or inject live assets inside the Android app. CSS/JS badge removal remains as a secondary defense.

The existing updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, notification v2, and Firestore rules deployment are preserved.
