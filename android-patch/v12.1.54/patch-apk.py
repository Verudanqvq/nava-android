from pathlib import Path

base = Path('android-patch/v12.1.53/patch-apk.py').read_text(encoding='utf-8')
base = base.replace("OLD_VERSION='12.1.47';NEW_VERSION='12.1.53';NEW_CODE=69", "OLD_VERSION='12.1.47';NEW_VERSION='12.1.54';NEW_CODE=70")
base = base.replace("FIX='/* Nava Android 12.1.53 — series label derived from volume label links. */'", "FIX='/* Nava Android 12.1.54 — global Cilt/Bölüm feed join discovery. */'")
base = base.replace("b'NavaAndroidApp/12.1.52',b'NavaAndroidApp/12.1.53'):", "b'NavaAndroidApp/12.1.52',b'NavaAndroidApp/12.1.53',b'NavaAndroidApp/12.1.54'):")
base = base.replace("for token in ('navaSeriesLabelFixV12153','scanVolumeLinks','labelFromHref','feedForLabel','ensurePicker'):\n            if token not in fj: raise ValueError('12.1.53 discovery token missing '+token)", "for token in ('navaFeedJoinFixV12154','globalFeed','seriesIdentityFromVolumeFeed','volumesForSeries','ensurePicker'):\n            if token not in fj: raise ValueError('12.1.54 discovery token missing '+token)")
base = base.replace("if 'navaSeriesLabelFixV12152' in fj: raise ValueError('12.1.52 discovery must not be bundled')", "if 'navaSeriesLabelFixV12152' in fj or 'navaSeriesLabelFixV12153' in fj: raise ValueError('older discovery patch must not be bundled')")
base = base.replace("b'NavaAndroidApp/12.1.53' in fd", "b'NavaAndroidApp/12.1.54' in fd")
base = base.replace("PATCH_OK versionName=12.1.53 versionCode=69 base=12.1.47 nativeUA=12.1.47 discovery=series-label-from-cilt-link", "PATCH_OK versionName=12.1.54 versionCode=70 base=12.1.47 nativeUA=12.1.47 discovery=global-feed-join")
if "NEW_VERSION='12.1.54';NEW_CODE=70" not in base or 'navaFeedJoinFixV12154' not in base:
    raise SystemExit('failed to parameterize 12.1.53 patcher for 12.1.54')
exec(compile(base, 'android-patch/v12.1.54/generated-patcher.py', 'exec'), globals(), globals())
