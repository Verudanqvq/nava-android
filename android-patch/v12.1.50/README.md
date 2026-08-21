# Nava Android 12.1.50 hotfix

12.1.50 is rebuilt directly from the known-good signed **12.1.47** APK.

## White-screen fix strategy

12.1.48 and 12.1.49 both changed the native WebView user-agent marker away from `NavaAndroidApp/12.1.47`, and both were reported to remain on a white screen at startup. 12.1.50 deliberately keeps the exact 12.1.47 `classes.dex` and native UA while only bumping AndroidManifest `versionName`/`versionCode`.

## Features retained from 12.1.49

- Top download icon = downloaded library + queue only.
- `Eseri indir` after `Özeti Oku`, with volume selection.
- Offline library hierarchy and real delete actions.
- Real Firestore notification deletion and `Tümünü temizle`.
- Per-work TR / EN / JP / KR / CN logical chapter variants in reader settings.

## Release gate

The release workflow installs the signed APK in an Android emulator, launches it, captures the screen and rejects a near-solid-white app viewport before publishing `v12.1.50` as GitHub Latest.
