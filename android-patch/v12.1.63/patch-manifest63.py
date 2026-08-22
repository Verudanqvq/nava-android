from pathlib import Path
import sys
if len(sys.argv)!=2: raise SystemExit('usage: patch-manifest63.py AndroidManifest.xml')
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')
def once(a,b,label):
    global s
    if a not in s: raise ValueError('missing manifest patch point: '+label)
    s=s.replace(a,b,1)
once('android:versionCode="78"','android:versionCode="79"','versionCode')
once('android:versionName="12.1.62"','android:versionName="12.1.63"','versionName')
if 'android.permission.FOREGROUND_SERVICE"' not in s:
    once('<application ','<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>\n    <application ','foreground permissions')
if 'com.verudanava.nava.NavaDownloadService63' not in s:
    once('</application>','    <service android:name="com.verudanava.nava.NavaDownloadService63" android:exported="false" android:foregroundServiceType="dataSync"/>\n    </application>','download service')
for token in ('12.1.63','versionCode="79"','FOREGROUND_SERVICE_DATA_SYNC','NavaDownloadService63','foregroundServiceType="dataSync"'):
    if token not in s: raise ValueError('manifest token missing '+token)
p.write_text(s,encoding='utf-8')
print('MANIFEST_63_PATCH_OK')
