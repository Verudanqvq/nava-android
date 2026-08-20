# Nava Android

Current stable Android release: **12.1.43** (`versionCode 59`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.43 release APK SHA-256: `04f735bb9bf1bb3653651337402b26cd7e21eaab23ec173227d5b7418774bb58`.

## Follower notifications

Automatic follower-release scanning is currently **paused**. The GitHub workflow remains available with `workflow_dispatch` only so the scanner can be run manually when needed. There is no active scheduled GitHub cron in this repository for follower notifications.

The scanner code is still preserved: it merges Blogger all-post, `Bölüm`, and `Cilt` feeds, resolves the parent series, writes site notifications, then sends high-priority data-only FCM to Android follower tokens. Firestore delivery leases prevent duplicate sends.

Notification copy remains explicit by release type:
- volume: `Yeni cilt geldi`;
- chapter: `Yeni bölüm geldi`.

Android 12.1.43 preserves the direct-native FCM renderer, Nava application notification icon, device registration, and the high-importance `nava_follower_releases_v4` channel. The mobile notification center keeps individual deletion and **Tümünü sil** so the signed-in user's Firestore notification documents are actually removed.

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
- Wi-Fi-only mode in the Download Center;
- saved HTML/static resources served by the native WebView interceptor.

Android 12.1.41 reorganized downloaded content into a collapsed **Eser → Cilt → Bölüm** hierarchy and removed generic `Nava` placeholders where meaningful metadata can be recovered.

Android 12.1.42 added bulk deletion at both hierarchy levels:
- **Eseri sil** removes every downloaded item under that work;
- **Cildi sil** removes every downloaded item under that volume;
- individual **Sil** remains available for single entries.

Android 12.1.43 is a stability hotfix for the app chrome and download entry points:
- legacy download buttons injected into the top bar are hidden so the original top bar layout is preserved;
- the old large download panel that could render at the bottom of volume pages is forcibly suppressed;
- download access is now a small fixed Nava button that opens a compact sheet;
- the compact sheet shows **Bölümü indir**, **Cildi indir**, or **Eseri indir** according to the current page, plus **İndirilenler** everywhere;
- the 12.1.42 offline hierarchy, bulk deletion and native storage engine remain unchanged.

The same hierarchy is content-type neutral and is intended to support Light Novel, Web Novel, Manga, Manhwa and similar content as long as they use the same work → volume/container → chapter structure.

## UI and Blogger loader

Current Android releases keep the Nava blue/gray palette override for account, notification, auth, comment, profile/admin and rating accents, avoiding the old purple/AI-like emphasis.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment and loader fixes remain preserved.
