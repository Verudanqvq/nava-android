import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper = name.upper()
    leaf = upper.rsplit('/', 1)[-1]
    return upper.startswith('META-INF/') and (leaf == 'MANIFEST.MF' or leaf.endswith(('.SF', '.RSA', '.DSA', '.EC')))

if len(sys.argv) != 4:
    raise SystemExit('usage: preserve-apk.py SRC MANIFEST OUT')

source, manifest_file, output = map(Path, sys.argv[1:])
manifest = manifest_file.read_bytes()
if b'12.1.80' not in manifest and '12.1.80'.encode('utf-16le') not in manifest:
    raise ValueError('manifest 12.1.80 marker missing')

with zipfile.ZipFile(source) as input_apk:
    original = {info.filename: input_apk.read(info.filename) for info in input_apk.infolist() if not old_signature(info.filename)}
    if not {'AndroidManifest.xml', 'classes.dex', 'assets/nava_app_v11.js', 'assets/nava_app_v11.css'}.issubset(original):
        raise ValueError('required original APK entries missing')
    with zipfile.ZipFile(output, 'w') as output_apk:
        for info in input_apk.infolist():
            if old_signature(info.filename):
                continue
            contents = manifest if info.filename == 'AndroidManifest.xml' else original[info.filename]
            output_apk.writestr(info, contents)

with zipfile.ZipFile(output) as output_apk:
    for name, contents in original.items():
        expected = manifest if name == 'AndroidManifest.xml' else contents
        if output_apk.read(name) != expected:
            raise ValueError('APK entry changed unexpectedly: ' + name)
print('PRESERVE_80_OK: original app assets/resources/native code preserved; manifest versionCode=96')
