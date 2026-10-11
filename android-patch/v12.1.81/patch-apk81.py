import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper=name.upper()
    leaf=upper.rsplit('/',1)[-1]
    return upper.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

if len(sys.argv)!=6:
    raise SystemExit('usage: patch-apk81.py SRC MANIFEST JS CSS OUT')
source,manifest_file,js_file,css_file,output=map(Path,sys.argv[1:])
manifest=manifest_file.read_bytes()
script=js_file.read_text(encoding='utf-8')
stylesheet=css_file.read_text(encoding='utf-8')
if b'12.1.81' not in manifest and '12.1.81'.encode('utf-16le') not in manifest:
    raise ValueError('manifest 12.1.81 marker missing')
if '__navaShellV12181' not in script or 'nava-nav-profile-image-v12181' not in stylesheet:
    raise ValueError('UI shell markers missing')
with zipfile.ZipFile(source) as zin:
    required={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
    if not required.issubset(set(zin.namelist())): raise ValueError('base APK entries missing')
    preserved={n:zin.read(n) for n in ('classes.dex','classes2.dex','assets/offline.html','resources.arsc')}
    base_js=zin.read('assets/nava_app_v11.js').decode('utf-8')
    base_css=zin.read('assets/nava_app_v11.css').decode('utf-8')
    with zipfile.ZipFile(output,'w') as zout:
        for info in zin.infolist():
            if old_signature(info.filename): continue
            data=zin.read(info.filename)
            if info.filename=='AndroidManifest.xml': data=manifest
            elif info.filename=='assets/nava_app_v11.js': data=(base_js.rstrip()+'\n'+script.rstrip()+'\n').encode()
            elif info.filename=='assets/nava_app_v11.css': data=(base_css.rstrip()+'\n'+stylesheet.rstrip()+'\n').encode()
            zout.writestr(info,data)
with zipfile.ZipFile(output) as zout:
    for n,v in preserved.items():
        if zout.read(n)!=v: raise ValueError('native/resource entry changed: '+n)
    final_js=zout.read('assets/nava_app_v11.js').decode()
    final_css=zout.read('assets/nava_app_v11.css').decode()
    if not final_js.startswith(base_js.rstrip()) or not final_css.startswith(base_css.rstrip()):
        raise ValueError('base app JS/CSS unexpectedly replaced')
    for token in ('__navaShellV12181','nava-nav-profile-image-v12181','nava-tap-feedback-v12181','overflow-wrap:anywhere'):
        if token not in final_js and token not in final_css: raise ValueError('required token missing: '+token)
print('PATCH_81_OK base=v12.1.73 original JS/CSS layered; native code and resources preserved')
