import sys,zipfile
from pathlib import Path
def old_signature(name):
    upper=name.upper(); leaf=upper.rsplit('/',1)[-1]
    return upper.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
if len(sys.argv)!=6: raise SystemExit('usage: patch-apk.py SRC MANIFEST CSS PROFILE_JS OUT')
source,manifest_file,stylesheet_file,profile_js_file,output=map(Path,sys.argv[1:]); manifest=manifest_file.read_bytes(); stylesheet=stylesheet_file.read_text(); profile_js=profile_js_file.read_text()
if b'12.1.78' not in manifest and '12.1.78'.encode('utf-16le') not in manifest: raise ValueError('manifest 78 marker missing')
if '#nava-app-bottom' not in stylesheet: raise ValueError('bottom navigation stylesheet validation failed')
if 'nava-nav-profile-image-v12174' not in profile_js or 'currentProfileImage' not in profile_js: raise ValueError('profile image patch missing')
with zipfile.ZipFile(source) as input_apk:
    required={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
    if not required.issubset(set(input_apk.namelist())): raise ValueError('base entries missing')
    preserved={n:input_apk.read(n) for n in ('classes.dex','classes2.dex','assets/offline.html','resources.arsc')}; base_css=input_apk.read('assets/nava_app_v11.css').decode(); base_js=input_apk.read('assets/nava_app_v11.js').decode()
    with zipfile.ZipFile(output,'w') as out:
        for info in input_apk.infolist():
            if old_signature(info.filename): continue
            contents=input_apk.read(info.filename)
            if info.filename=='AndroidManifest.xml': contents=manifest
            elif info.filename=='assets/nava_app_v11.css': contents=(base_css.rstrip()+'\n'+stylesheet.rstrip()+'\n').encode()
            elif info.filename=='assets/nava_app_v11.js': contents=(base_js.rstrip()+'\n'+profile_js.rstrip()+'\n').encode()
            out.writestr(info,contents)
with zipfile.ZipFile(output) as out:
    for n,c in preserved.items():
        if out.read(n)!=c: raise ValueError('preserved entry changed '+n)
    final_css=out.read('assets/nava_app_v11.css').decode(); final_js=out.read('assets/nava_app_v11.js').decode()
    if not final_css.startswith(base_css.rstrip()) or '#f5f7fb' not in final_css: raise ValueError('light theme patch missing')
    if not final_js.startswith(base_js.rstrip()) or 'currentProfileImage' not in final_js: raise ValueError('profile image patch missing from final APK')
print('PATCH_78_OK bottom-navigation=ok light-theme=ok profile-image=ok versionCode=94')
