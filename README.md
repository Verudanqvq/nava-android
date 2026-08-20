# Nava Android

Current stable Android release: **12.1.39** (`versionCode 55`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.39 release APK SHA-256: `290289dc9bb54f74f2fdcd7b1305d62a62d90dacef9772595aa9fcd6a0ed0a1f`.

## Follower notifications

Follower-release scanning runs from the Netlify `nava-notifications` production project as a scheduled function with `* * * * *` (once per minute). The old GitHub notification cron/shard workflows were removed; GitHub Actions keeps only the permanent Firestore rules deployment workflow.

The scanner merges Blogger all-post, `Bölüm`, and `Cilt` feeds, resolves the parent series, writes site notifications, then sends high-priority data-only FCM to Android follower tokens. Firestore delivery leases prevent duplicate sends.

Notification copy is explicit by release type:
- volume: `Yeni cilt geldi`;
- chapter: `Yeni bölüm geldi`.

Android 12.1.39 preserves the direct-native FCM renderer and Nava application notification icon, refreshes device registration as `appVersion: 12.1.39`, and keeps the high-importance `nava_follower_releases_v4` channel. The Android notification center now adds **Tümünü temizle** for deleting the signed-in user's notification documents in Firestore batches.

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

Android 12.1.38 introduced the clearer **İndirme Merkezi** and **Tüm ciltleri indir**. Android 12.1.39 keeps those actions but restores normal series-page volume-card navigation so tapping a `Cilt N` card opens the volume instead of being swallowed by an app route handler.

## UI and Blogger loader

Android 12.1.39 adds a final Android-only Nava blue/gray palette override for account, notification, auth, comment, profile/admin and rating accents, removing the remaining purple/AI-like emphasis without changing content semantics.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment, notification delivery, Netlify scheduler, and loader fixes remain preserved.
