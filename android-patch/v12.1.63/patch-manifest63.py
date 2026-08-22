from pathlib import Path
import re,sys
if len(sys.argv) not in (2,3): raise SystemExit('usage: patch-manifest63.py AndroidManifest.xml [apktool.yml]')
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')
def once(a,b,label):
    global s
    if a not in s: raise ValueError('missing manifest patch point: '+label)
    s=s.replace(a,b,1)
# Apktool can omit versionCode/versionName from decoded AndroidManifest.xml and keep them in apktool.yml.
if 'android:versionCode="78"' in s: s=s.replace('android:versionCode="78"','android:versionCode="79"',1)
if 'android:versionName="12.1.62"' in s: s=s.replace('android:versionName="12.1.62"','android:versionName="12.1.63"',1)
if 'android.permission.FOREGROUND_SERVICE"' not in s:
    once('<application ','<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>\n    <application ','foreground permissions')
if 'com.verudanava.nava.NavaDownloadService63' not in s:
    once('</application>','    <service android:name="com.verudanava.nava.NavaDownloadService63" android:exported="false" android:foregroundServiceType="dataSync"/>\n    </application>','download service')
for token in ('FOREGROUND_SERVICE_DATA_SYNC','NavaDownloadService63','foregroundServiceType="dataSync"'):
    if token not in s: raise ValueError('manifest token missing '+token)
p.write_text(s,encoding='utf-8')
yp=Path(sys.argv[2]) if len(sys.argv)==3 else p.parent/'apktool.yml'
if yp.exists():
    y=yp.read_text(encoding='utf-8')
    y,n1=re.subn(r'(?m)^(\s*versionCode:\s*)["\']?78["\']?\s*$',r'\g<1>79',y,count=1)
    y,n2=re.subn(r'(?m)^(\s*versionName:\s*)["\']?12\.1\.62["\']?\s*$',r'\g<1>12.1.63',y,count=1)
    if n1!=1 or n2!=1: raise ValueError('apktool.yml versionInfo patch failed')
    yp.write_text(y,encoding='utf-8')
else:
    raise ValueError('apktool.yml missing beside decoded manifest')
print('MANIFEST_63_PATCH_OK')
