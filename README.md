# Nava Android

Current stable Android release: **12.1.38** (`versionCode 54`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.38 release APK SHA-256: `b285d24743673965f2f84467b6191420102eefb2e14883266084ad500b8ee265`.

## Follower notifications

Follower-release scanning now runs from the Netlify `nava-notifications` production project as a scheduled function with `* * * * *` (once per minute). The old GitHub notification cron/shard workflows were removed; GitHub Actions now keeps only the permanent Firestore rules deployment workflow.

The scanner merges Blogger all-post, `Bölüm`, and `Cilt` feeds, resolves the parent series, writes site notifications, then sends high-priority data-only FCM to Android follower tokens. Firestore delivery leases prevent duplicate sends.

Notification copy is explicit by release type:
- volume: `Yeni cilt geldi`;
- chapter: `Yeni bölüm geldi`.

Android 12.1.38 preserves the direct-native FCM renderer introduced in 12.1.37 and refreshes device registration as `appVersion: 12.1.38`. The renderer uses the Nava application icon resource for the Android notification symbol and keeps the high-importance `nava_follower_releases_v4` channel.

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

Android 12.1.38 upgrades the download action sheet into a clearer **İndirme Merkezi**. Reader pages can download the current chapter, volume pages can download the volume page plus its chapters, and series pages include **Tüm ciltleri indir**. The all-volume action scans the series' volume links, reads each volume page for chapter links, skips already-downloaded URLs, and sends the resulting items to the existing native `downloadBatch` queue.

## UI and Blogger loader

Android 12.1.34 introduced page-specific Home / series / reader layouts; 12.1.38 preserves those fixes and updates only the download-center layer where needed.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment, notification delivery, and loader fixes remain preserved.
