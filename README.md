# Nava Android

Current stable Android release: **12.1.48** (`versionCode 64`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.48 release APK SHA-256: `de2856d32c1b46c0fd2e1b76c94f925a398c9e6cd9121699106d4a6ad51176b8`.

## Follower notifications

Automatic follower-release scanning is currently **paused**. The GitHub notification workflow is manual (`workflow_dispatch`) only. The scanner code remains available for later use. Notification copy remains `Yeni cilt geldi` / `Yeni bölüm geldi`.

Android 12.1.48 preserves the direct-native FCM renderer, Nava application notification icon, device registration and the `nava_follower_releases_v4` channel. The in-app notification center now exposes **Tümünü temizle** on Android and maps both bulk deletion and each notification's `×` action directly to the signed-in user's Firestore notification documents.

## Firestore rules

- Firestore rules are stored in `firestore.rules`.
- The permanent rules workflow runs emulator allow/deny tests before deployment.
- Backend-only automation state remains unavailable to client SDKs.

## Android 12.1.48 UI repair

12.1.48 is built directly from the signed **12.1.47 APK**, preserving the 12.1.47 offline browser and language filter while removing the UI regressions reported after that release.

- Download code no longer inserts controls into the normal app top bar or reader top bar.
- The reader top bar returns to its natural three-column layout: Back / title / reading control.
- Download access is a separate compact fixed button on reader, volume and series pages, so it cannot stretch or wrap the top bar.
- Tapping Download opens a fixed bottom command panel; it never participates in page flow.
- The panel shows the page-relevant action: **Bölümü indir**, **Cildi indir**, or **Eseri indir**, plus **İndirilenler**.
- Legacy download hubs, top-bar download buttons and theme-generated in-page download blocks are removed/hidden in the Android app.
- Cilt-card navigation is explicitly preserved.
- **İndirilenler** remains the 12.1.47 collapsed **Eser → Cilt → Bölüm** browser.
- Destructive actions remain behind three-dot menus: **Eseri sil**, **Cildi sil**, single **Sil**.
- Wi-Fi-only remains inside downloads settings.
- The Ana/Keşfet language filter remains **Tümü / TR / EN / JP / KR / CN**.
- UI accents remain Nava blue/gray.

The hierarchy and language metadata are content-type neutral and can be used by Light Novel, Web Novel, Manga, Manhwa and Manhua content following the same work → container/volume → chapter model.

## Offline engine

The app-private native offline engine remains unchanged: chapter download, volume batch download, offline open after restart, delete/redownload, Wi-Fi-only mode and locally served HTML/static resources.

## Blogger loader

The Android WebView continues to block requests containing `/blogger-live/`, so the old Blogger live loader cannot inject or flash inside the app.

Updater, stable signing identity, profile suite, read-state, reader navigation, offline storage, Firestore deployment and loader fixes remain preserved.
