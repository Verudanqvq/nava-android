# Nava Android

Current stable Android release: **12.1.36** (`versionCode 52`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.36 release APK SHA-256: `0e507cc5d1c85dbbb9ba02b3cdc2dce15af0b910e3eac7c83fe58ef4d087761b`.

## Follower notifications

Two short GitHub Actions sweeps provide redundancy:
- `.github/workflows/nava-notifications.yml`: primary sweep every five minutes.
- `.github/workflows/nava-notifications-backup.yml`: backup sweep offset by two minutes.

The workflows use separate non-cancelling concurrency groups, while Firestore delivery leases stop duplicate sends. The scanner merges Blogger all-post, `Bölüm`, and `Cilt` feeds, resolves the parent series, writes site notifications, then sends high-priority FCM to Android follower tokens.

Android 12.1.36 adds notification self-repair:
- push registration refreshes the device as `appVersion: 12.1.36` / protocol v4;
- the backend and app use a fresh high-importance `nava_follower_releases_v3` channel;
- the Android notification permission preference key is refreshed for this repair release;
- the v3 channel is created natively during app startup;
- startup checks `NotificationManager.areNotificationsEnabled()`;
- if Nava notifications are globally disabled, Android opens Nava's app-notification settings directly so the OS-level block can be enabled;
- server-side successful token IDs remain deduplicated for retry handling.

Direct diagnosis on 12.1.35 proved the registered token was current and Firebase accepted all three probe types (data-only, system v2, and fallback), isolating the remaining failure to Android notification display/permission state rather than Blogger, Firestore, token registration, or FCM acceptance.

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

Android 12.1.34 introduced page-specific Home / series / reader layouts and the Nava-style download action sheet. Android 12.1.36 preserves those changes.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment, and notification repair remain preserved.
