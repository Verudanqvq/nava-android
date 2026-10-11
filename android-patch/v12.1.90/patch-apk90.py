import sys, zipfile
from pathlib import Path

def old_signature(name):
    upper=name.upper(); leaf=upper.rsplit('/',1)[-1]
    return upper.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))

if len(sys.argv)!=6: raise SystemExit('usage: patch-apk90.py SRC MANIFEST JS CSS OUT')
source,manifest_file,js_file,css_file,output=map(Path,sys.argv[1:])
manifest=manifest_file.read_bytes(); script=js_file.read_text(encoding='utf-8'); stylesheet=css_file.read_text(encoding='utf-8')
if b'12.1.90' not in manifest and '12.1.90'.encode('utf-16le') not in manifest: raise ValueError('manifest version marker missing')
if '__navaShellV12190' not in script: raise ValueError('shell marker missing')
with zipfile.ZipFile(source) as zin, zipfile.ZipFile(output,'w') as zout:
    required={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
    if not required.issubset(set(zin.namelist())): raise ValueError('base APK entries missing')
    original={name:zin.read(name) for name in ('classes.dex','classes2.dex','assets/offline.html','resources.arsc')}
    base_js=zin.read('assets/nava_app_v11.js').decode(); base_css=zin.read('assets/nava_app_v11.css').decode()
    auto_tab = "if(ratings&&!ratings.dataset.navaAutoOpen){ratings.dataset.navaAutoOpen='1';setTimeout(function(){try{ratings.click()}catch(_){}},0)}"
    if base_js.count(auto_tab) != 1: raise ValueError('expected one profile auto-tab switch to remove')
    base_js = base_js.replace(auto_tab, "/* v12.1.90: preserve the current profile tab on entry */")
    for info in zin.infolist():
        if old_signature(info.filename): continue
        data=zin.read(info.filename)
        if info.filename=='AndroidManifest.xml': data=manifest
        elif info.filename=='assets/nava_app_v11.js': data=(base_js.rstrip()+'\n'+script.rstrip()+'\n').encode()
        elif info.filename=='assets/nava_app_v11.css': data=(base_css.rstrip()+'\n'+stylesheet.rstrip()+'\n').encode()
        zout.writestr(info,data)
with zipfile.ZipFile(output) as result:
    for name,data in original.items():
        if result.read(name)!=data: raise ValueError('native/resource entry changed: '+name)
    if '__navaShellV12190' not in result.read('assets/nava_app_v11.js').decode(): raise ValueError('shell JS missing')
print('PATCH_90_OK native code, offline downloads and resources preserved')
