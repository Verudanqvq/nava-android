# Nava Android

Current stable Android release: **12.1.35** (`versionCode 51`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.35 release APK SHA-256: `df35ac16e1af8d52f1235cb60fb6770853a2cdf304fff6339a74255d554f55c5`.

## Follower notifications

Two short GitHub Actions sweeps provide redundancy:
- `.github/workflows/nava-notifications.yml`: primary sweep every five minutes.
- `.github/workflows/nava-notifications-backup.yml`: backup sweep offset by two minutes.

The two workflows now use separate non-cancelling concurrency groups. They no longer cancel each other. Firestore delivery leases prevent simultaneous scanners from sending the same release twice. The scanner merges Blogger all-post, `Bölüm`, and `Cilt` feeds from Blogspot and the custom domain, resolves the parent series, writes site notifications, then sends FCM to Android follower tokens.

Android 12.1.35 fixes the client side of follower notifications:
- the stale 12.1.31 push-registration block is replaced by a 12.1.35 block;
- the device token is refreshed in Firestore with `appVersion: 12.1.35` when the app is opened/resumed;
- the high-importance `nava_follower_releases_v2` channel is created natively during app startup instead of waiting for `FirebaseMessagingService` to receive a message;
- background system-notification FCM messages therefore have their target channel ready before display;
- scan delivery records successful token document IDs so `retry-push.mjs` does not immediately duplicate a successful first send.

## Firestore rules

- Firestore rules are stored in `firestore.rules`.
- The permanent rules workflow runs emulator allow/deny tests first and deploys only tested rules through Firebase Admin Security Rules.
- Backend-only automation state is denied to client SDKs; Firebase Admin continues to bypass client rules as intended.

## Offline downloads

Android 12.1.31 introduced true native offline downloads and current releases preserve the app-private storage/interceptor engine:
- chapter download;
- volume batch download;
- Downloads screen;
- offline open after app restart;
- delete/redownload;
- Wi-Fi-only mode;
- saved HTML/static resources served by the native WebView interceptor.

## UI and Blogger loader

Android 12.1.34 introduced page-specific Home / series / reader layouts and the Nava-style download action sheet. Android 12.1.35 preserves those changes.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment, and notification v2 channel are preserved.
