# Nava Android

Current stable Android release: **12.1.49** (`versionCode 65`).

## Distribution

- GitHub Latest asset name is always `Nava.apk`.
- Website Android button resolves to `/releases/latest/download/Nava.apk`.
- The Android updater reads GitHub's `releases/latest` API, finds the exact `Nava.apk` asset, disables HTTP caching, and uses Android's package installer.
- Stable signing certificate SHA-256: `AC:DE:7C:F2:16:85:24:48:A8:A8:27:7F:E4:BF:11:EA:C1:83:39:4E:6B:34:A8:62:B1:24:E6:93:D5:1D:09:FE`.
- Android 12.1.49 release APK SHA-256: `00abe3d37e1f7d25853362fa45e6d46f4cf3e3ca6ddfb7349c95b8f781926f8c`.

## Android 12.1.49

12.1.49 is built directly from the signed **12.1.47 APK**. It does not use 12.1.48 as its base.

- The existing top-bar download icon keeps its location and is only an **İndirilenler / İndirme sırası** entry point.
- **Eseri indir** is placed after **Özeti Oku** on work pages.
- Work download opens a volume picker; selected volumes are prepared and sent to the native batch queue.
- Offline library remains **Eser → Cilt → Bölüm** with **Eseri sil / Cildi sil / Sil**.
- Android in-app notifications support individual delete and **Tümünü temizle**, backed by Firestore documents.
- Blogger labels `TR / EN / JP / KR / CN` are alternate language variants of the same logical chapter.
- Language choice is stored per work and is embedded in the existing reader settings panel alongside the normal Yazı/Manga reading controls.
- When the current logical chapter has the chosen language variant, changing language navigates to that variant URL.
- The selected language is also respected when preparing offline downloads.

## Publishing language variants

Publish separate Blogger URLs when needed, keep the same logical volume/chapter identity, and apply the corresponding language label. Android groups matching volume + chapter numbers and selects the URL for the reader's chosen work language.

## Follower notifications

Automatic follower-release scanning remains paused. Existing direct-native FCM rendering, application notification icon and device registration remain preserved from the 12.1.47 base.

## Firestore rules

- Firestore rules remain stored in `firestore.rules`.
- Backend-only automation state remains unavailable to client SDKs.

## Blogger loader

The Android WebView continues to block requests containing `/blogger-live/`, so the old Blogger live loader cannot inject or flash inside the app.
