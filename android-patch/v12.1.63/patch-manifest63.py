from pathlib import Path
import re,sys
if len(sys.argv) not in (2,3): raise SystemExit('usage: patch-manifest63.py AndroidManifest.xml [apktool.yml]')
status=Path('/tmp/status63.txt')
def mark(x):
    try:
        with status.open('a',encoding='utf-8') as f:f.write(x+'\n')
    except Exception:pass
mark('manifest_patch_started=1')
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')
def once(a,b,label):
    global s
    if a not in s: raise ValueError('missing manifest patch point: '+label)
    s=s.replace(a,b,1)
# Apktool may keep versionInfo only in apktool.yml. If attrs exist in XML, normalize them too.
s=re.sub(r'android:versionCode="[^"]+"','android:versionCode="79"',s,count=1)
s=re.sub(r'android:versionName="[^"]+"','android:versionName="12.1.63"',s,count=1)
if 'android.permission.FOREGROUND_SERVICE"' not in s:
    once('<application ','<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>\n    <application ','foreground permissions')
if 'com.verudanava.nava.NavaDownloadService63' not in s:
    once('</application>','    <service android:name="com.verudanava.nava.NavaDownloadService63" android:exported="false" android:foregroundServiceType="dataSync"/>\n    </application>','download service')
for token in ('FOREGROUND_SERVICE_DATA_SYNC','NavaDownloadService63','foregroundServiceType="dataSync"'):
    if token not in s: raise ValueError('manifest token missing '+token)
p.write_text(s,encoding='utf-8')
mark('manifest_xml_patch=ok')
yp=Path(sys.argv[2]) if len(sys.argv)==3 else p.parent/'apktool.yml'
if not yp.exists(): raise ValueError('apktool.yml missing beside decoded manifest')
y=yp.read_text(encoding='utf-8')
# Exact base APK is already SHA-gated, so patch whatever versionInfo representation apktool emitted.
y,n1=re.subn(r'(?m)^(\s*versionCode:\s*).+$',r'\g<1>79',y,count=1)
y,n2=re.subn(r'(?m)^(\s*versionName:\s*).+$',r'\g<1>12.1.63',y,count=1)
if n1!=1 or n2!=1:
    mark('apktool_version_patch=failed')
    raise ValueError('apktool.yml versionInfo patch failed; code_matches=%d name_matches=%d'%(n1,n2))
yp.write_text(y,encoding='utf-8')
mark('apktool_version_patch=ok')
mark('manifest_patch=ok')
print('MANIFEST_63_PATCH_OK')
