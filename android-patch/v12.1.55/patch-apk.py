from pathlib import Path

base = Path('android-patch/v12.1.53/patch-apk.py').read_text(encoding='utf-8')
base = base.replace("OLD_VERSION='12.1.47';NEW_VERSION='12.1.53';NEW_CODE=69", "OLD_VERSION='12.1.47';NEW_VERSION='12.1.55';NEW_CODE=71")
base = base.replace("FIX='/* Nava Android 12.1.53 — series label derived from volume label links. */'", "FIX='/* Nava Android 12.1.55 — persistent delegated series-download interceptor + live feed join. */'")
base = base.replace("b'NavaAndroidApp/12.1.52',b'NavaAndroidApp/12.1.53'):", "b'NavaAndroidApp/12.1.52',b'NavaAndroidApp/12.1.53',b'NavaAndroidApp/12.1.54',b'NavaAndroidApp/12.1.55'):")
base = base.replace("for token in ('navaSeriesLabelFixV12153','scanVolumeLinks','labelFromHref','feedForLabel','ensurePicker'):\n            if token not in fj: raise ValueError('12.1.53 discovery token missing '+token)", "for token in ('navaPersistentDownloadV12155','intercept','currentSeriesEntry','resolveIdentity','openPicker'):\n            if token not in fj: raise ValueError('12.1.55 discovery token missing '+token)")
base = base.replace("if 'navaSeriesLabelFixV12152' in fj: raise ValueError('12.1.52 discovery must not be bundled')", "if 'navaSeriesLabelFixV12152' in fj or 'navaSeriesLabelFixV12153' in fj or 'navaFeedJoinFixV12154' in fj: raise ValueError('older discovery patch must not be bundled')")
base = base.replace("b'NavaAndroidApp/12.1.53' in fd", "b'NavaAndroidApp/12.1.55' in fd")
base = base.replace("PATCH_OK versionName=12.1.53 versionCode=69 base=12.1.47 nativeUA=12.1.47 discovery=series-label-from-cilt-link", "PATCH_OK versionName=12.1.55 versionCode=71 base=12.1.47 nativeUA=12.1.47 discovery=persistent-feed-interceptor")
if "NEW_VERSION='12.1.55';NEW_CODE=71" not in base or 'navaPersistentDownloadV12155' not in base:
    raise SystemExit('failed to parameterize 12.1.53 patcher for 12.1.55')
exec(compile(base, 'android-patch/v12.1.55/generated-patcher.py', 'exec'), globals(), globals())
