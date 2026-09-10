import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper = name.upper()
    leaf = upper.rsplit('/', 1)[-1]
    return upper.startswith('META-INF/') and (leaf == 'MANIFEST.MF' or leaf.endswith(('.SF', '.RSA', '.DSA', '.EC')))

if len(sys.argv) != 6:
    raise SystemExit('usage: patch-apk.py SRC MANIFEST CSS PROFILE_JS OUT')

source, manifest_file, stylesheet_file, profile_js_file, output = map(Path, sys.argv[1:])
manifest = manifest_file.read_bytes()
stylesheet = stylesheet_file.read_text(encoding='utf-8')
profile_js = profile_js_file.read_text(encoding='utf-8')
if b'12.1.77' not in manifest and '12.1.77'.encode('utf-16le') not in manifest:
    raise ValueError('manifest 77 marker missing')
if '#nava-app-bottom' not in stylesheet:
    raise ValueError('bottom navigation stylesheet validation failed')
if 'nava-nav-profile-image-v12174' not in profile_js or 'currentProfileImage' not in profile_js:
    raise ValueError('profile image patch missing')

with zipfile.ZipFile(source) as input_apk:
    required = {'AndroidManifest.xml', 'classes.dex', 'classes2.dex', 'assets/nava_app_v11.js', 'assets/nava_app_v11.css', 'assets/offline.html', 'resources.arsc'}
    if not required.issubset(set(input_apk.namelist())):
        raise ValueError('base entries missing')
    preserved = {name: input_apk.read(name) for name in ('classes.dex', 'classes2.dex', 'assets/offline.html', 'resources.arsc')}
    base_stylesheet = input_apk.read('assets/nava_app_v11.css').decode('utf-8')
    base_js = input_apk.read('assets/nava_app_v11.js').decode('utf-8')
    with zipfile.ZipFile(output, 'w') as output_apk:
        for info in input_apk.infolist():
            if old_signature(info.filename):
                continue
            contents = input_apk.read(info.filename)
            if info.filename == 'AndroidManifest.xml':
                contents = manifest
            elif info.filename == 'assets/nava_app_v11.css':
                contents = (base_stylesheet.rstrip() + '\n' + stylesheet.rstrip() + '\n').encode('utf-8')
            elif info.filename == 'assets/nava_app_v11.js':
                contents = (base_js.rstrip() + '\n' + profile_js.rstrip() + '\n').encode('utf-8')
            output_apk.writestr(info, contents)
with zipfile.ZipFile(output) as output_apk:
    for name, contents in preserved.items():
        if output_apk.read(name) != contents:
            raise ValueError('preserved entry changed ' + name)
    final_stylesheet = output_apk.read('assets/nava_app_v11.css').decode('utf-8')
    final_js = output_apk.read('assets/nava_app_v11.js').decode('utf-8')
    if not final_stylesheet.startswith(base_stylesheet.rstrip()) or '#17202d' not in final_stylesheet:
        raise ValueError('bottom navigation patch missing')
    if not final_js.startswith(base_js.rstrip()) or 'currentProfileImage' not in final_js:
        raise ValueError('profile image patch missing from final APK')
print('PATCH_77_OK bottom-navigation=ok dark-theme=ok profile-image=ok versionCode=93')
