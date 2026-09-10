import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper = name.upper()
    leaf = upper.rsplit('/', 1)[-1]
    return upper.startswith('META-INF/') and (leaf == 'MANIFEST.MF' or leaf.endswith(('.SF', '.RSA', '.DSA', '.EC')))

if len(sys.argv) != 5:
    raise SystemExit('usage: patch-apk.py SRC MANIFEST CSS OUT')

source, manifest_file, stylesheet_file, output = map(Path, sys.argv[1:])
manifest = manifest_file.read_bytes()
stylesheet = stylesheet_file.read_text(encoding='utf-8')
if b'12.1.75' not in manifest and '12.1.75'.encode('utf-16le') not in manifest:
    raise ValueError('manifest 75 marker missing')
if '--nava-bg:#f5f7fb' not in stylesheet:
    raise ValueError('light UI source marker missing')

with zipfile.ZipFile(source) as input_apk:
    required = {'AndroidManifest.xml', 'classes.dex', 'classes2.dex', 'assets/nava_app_v11.js', 'assets/nava_app_v11.css', 'assets/offline.html', 'resources.arsc'}
    if not required.issubset(set(input_apk.namelist())):
        raise ValueError('base entries missing')
    preserved = {name: input_apk.read(name) for name in ('classes.dex', 'classes2.dex', 'assets/nava_app_v11.js', 'assets/offline.html', 'resources.arsc')}
    base_stylesheet = input_apk.read('assets/nava_app_v11.css').decode('utf-8')
    with zipfile.ZipFile(output, 'w') as output_apk:
        for info in input_apk.infolist():
            if old_signature(info.filename):
                continue
            contents = input_apk.read(info.filename)
            if info.filename == 'AndroidManifest.xml':
                contents = manifest
            elif info.filename == 'assets/nava_app_v11.css':
                contents = (base_stylesheet.rstrip() + '\n' + stylesheet.rstrip() + '\n').encode('utf-8')
            output_apk.writestr(info, contents)
with zipfile.ZipFile(output) as output_apk:
    for name, contents in preserved.items():
        if output_apk.read(name) != contents:
            raise ValueError('preserved entry changed ' + name)
    final_stylesheet = output_apk.read('assets/nava_app_v11.css').decode('utf-8')
    if not final_stylesheet.startswith(base_stylesheet.rstrip()):
        raise ValueError('base stylesheet changed')
    for token in ('#f5f7fb', '#nava-app-topbar', '#nava-app-bottom', 'nava-nav-profile-image-v12174'):
        if token not in final_stylesheet:
            raise ValueError('light UI token missing ' + token)
print('PATCH_75_OK base=12.1.74 shell=light profile-avatar=preserved versionCode=91')
