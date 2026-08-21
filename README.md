# Nava Android

Current stable Android release: **12.1.47** (`versionCode 63`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.47 release APK SHA-256: `8b4650833446f30eafa6e0fc1ed28dc19564eeee304421b02c7ce05f5433964c`.

## Follower notifications

Automatic follower-release scanning is currently **paused**. The GitHub notification workflow is manual (`workflow_dispatch`) only. The scanner code remains available for later use. Notification copy remains `Yeni cilt geldi` / `Yeni bölüm geldi`.

Android 12.1.47 preserves the direct-native FCM renderer, Nava application notification icon, device registration and the `nava_follower_releases_v4` channel. Individual notification deletion and **Tümünü sil** remain backed by the signed-in user's Firestore notification documents.

## Firestore rules

- Firestore rules are stored in `firestore.rules`.
- The permanent rules workflow runs emulator allow/deny tests before deployment.
- Backend-only automation state remains unavailable to client SDKs.

## Android 12.1.47 UI repair

12.1.47 is rebuilt from the known-good **12.1.41 APK base**, rather than stacking the broken 12.1.42–12.1.46 download UI chain.

- The normal app top bar is explicitly normalized for height, spacing, safe-area and button alignment.
- The reader top bar is normalized separately and keeps Back / title / Download / Reading settings without overlap.
- Download access now lives in the actual app top bar. A floating download launcher is used only as a fallback when no app toolbar exists.
- Tapping Download opens a small command popover, not a giant page block or persistent bottom sheet.
- The popover shows only the page-relevant action: **Bölümü indir**, **Cildi indir**, or **Eseri indir**, plus **İndirilenler**.
- Legacy in-page **Bu cildi tamamen indir / Tüm ciltleri indir** controls and older download hubs are removed from app flow.
- **İndirilenler** is a full-screen, flat file-browser style view organized as collapsed **Eser → Cilt → Bölüm**.
- Destructive actions stay behind three-dot menus: **Eseri sil**, **Cildi sil**, single **Sil**.
- Wi-Fi-only remains inside downloads settings.
- A visible language filter is available on Ana and Keşfet: **Tümü / TR / EN / JP / KR / CN**. Language is read from the existing Blogger work labels.
- Cilt-card navigation and the native offline storage/interceptor engine are preserved.
- UI accents remain Nava blue/gray, not purple.

The hierarchy and language metadata are content-type neutral and can be used by Light Novel, Web Novel, Manga, Manhwa and Manhua content following the same work → container/volume → chapter model.

## Offline engine

The app-private native offline engine remains unchanged: chapter download, volume batch download, offline open after restart, delete/redownload, Wi-Fi-only mode and locally served HTML/static resources.

## Blogger loader

The Android WebView continues to block requests containing `/blogger-live/`, so the old Blogger live loader cannot inject or flash inside the app.

Updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment and loader fixes remain preserved.
