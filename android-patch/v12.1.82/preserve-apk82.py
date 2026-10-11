import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper=name.upper(); leaf=upper.rsplit('/',1)[-1]
    return upper.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

if len(sys.argv)!=4: raise SystemExit('usage: preserve-apk82.py SRC MANIFEST OUT')
source,manifest_file,output=map(Path,sys.argv[1:])
manifest=manifest_file.read_bytes()
if b'12.1.82' not in manifest and '12.1.82'.encode('utf-16le') not in manifest:
    raise ValueError('manifest 12.1.82 marker missing')
with zipfile.ZipFile(source) as zin:
    original={i.filename:zin.read(i.filename) for i in zin.infolist() if not old_signature(i.filename)}
    required={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
    if not required.issubset(original): raise ValueError('required original APK entries missing')
    with zipfile.ZipFile(output,'w') as zout:
        for info in zin.infolist():
            if old_signature(info.filename): continue
            zout.writestr(info,manifest if info.filename=='AndroidManifest.xml' else original[info.filename])
with zipfile.ZipFile(output) as zout:
    for name,contents in original.items():
        if zout.read(name)!=(manifest if name=='AndroidManifest.xml' else contents):
            raise ValueError('APK entry changed unexpectedly: '+name)
print('PRESERVE_82_OK original UI/assets/resources/native code unchanged; versionCode=98')
