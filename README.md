# Nava Android

Current stable Android release: **12.1.46** (`versionCode 62`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.46 release APK SHA-256: `50dd1fd6f92b666a1cd9d58efb5ccd02a748547128b4f28a2f420da05b63d764`.

## Follower notifications

Automatic follower-release scanning is currently **paused**. The GitHub workflow remains available with `workflow_dispatch` only so the scanner can be run manually when needed. There is no active scheduled GitHub cron in this repository for follower notifications.

The scanner code is preserved for later use. Notification copy remains explicit by release type: `Yeni cilt geldi` and `Yeni bölüm geldi`.

Android 12.1.46 preserves the direct-native FCM renderer, Nava application notification icon, device registration, and the high-importance `nava_follower_releases_v4` channel. The mobile notification center keeps individual deletion and **Tümünü sil**, backed by the signed-in user's Firestore notification documents.

## Firestore rules

- Firestore rules are stored in `firestore.rules`.
- The permanent rules workflow runs emulator allow/deny tests first and deploys only tested rules through Firebase Admin Security Rules.
- Backend-only automation state is denied to client SDKs; Firebase Admin continues to bypass client rules as intended.

## Offline downloads

The native app-private offline storage/interceptor engine is preserved: chapter download, volume batch download, offline open after restart, delete/redownload, Wi-Fi-only mode, and locally served HTML/static resources.

Android **12.1.46** is rebuilt from the known-good **12.1.41 APK base**, not from the broken 12.1.42–12.1.45 UI chain:
- the download system does **not** insert, reorder, or replace anything inside the existing top bar;
- legacy top-bar download buttons are continuously removed if an older runtime tries to recreate them;
- legacy download menus and page-flow download blocks are removed/hidden;
- download access is one small fixed Nava download button at the lower-right edge of the app;
- tapping the fixed button opens a matching compact bottom sheet;
- the sheet shows only the page-relevant action: **Bölümü indir**, **Cildi indir**, or **Eseri indir**, plus **İndirilenler**;
- the old oversized **Bu cildi tamamen indir / Tüm ciltleri indir** page UI is not present;
- downloaded content remains organized as collapsed **Eser → Cilt → Bölüm**;
- **Eseri sil**, **Cildi sil**, and single-item **Sil** remain available through compact menus;
- Wi-Fi-only control remains inside downloads settings instead of being repeated around the app;
- Cilt-card navigation is preserved;
- the UI uses Nava blue/gray rather than purple accents.

The hierarchy is content-type neutral and can be reused for Light Novel, Web Novel, Manga, Manhwa and similar content when they follow the same work → volume/container → chapter structure.

## UI and Blogger loader

Current Android releases keep the Nava blue/gray palette override and avoid the old purple/AI-like emphasis.

The Android WebView blocks requests containing `/blogger-live/` at the native interceptor, so the old Blogger live loader cannot inject or flash inside the Android app.

The updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment and loader fixes remain preserved.
