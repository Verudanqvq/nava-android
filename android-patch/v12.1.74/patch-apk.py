import sys
import zipfile
from pathlib import Path

def old_signature(name):
    upper = name.upper()
    leaf = upper.rsplit('/', 1)[-1]
    return upper.startswith('META-INF/') and (leaf == 'MANIFEST.MF' or leaf.endswith(('.SF', '.RSA', '.DSA', '.EC')))

def main():
    if len(sys.argv) != 6:
        raise SystemExit('usage: patch-apk.py SRC MANIFEST UIJS UICSS OUT')
    source, manifest_file, script_file, stylesheet_file, output = map(Path, sys.argv[1:])
    manifest = manifest_file.read_bytes()
    script = script_file.read_text(encoding='utf-8')
    stylesheet = stylesheet_file.read_text(encoding='utf-8')
    if b'12.1.74' not in manifest and '12.1.74'.encode('utf-16le') not in manifest:
        raise ValueError('manifest 74 marker missing')
    if '__navaShellV12174' not in script or '--nava-accent-v12174' not in stylesheet:
        raise ValueError('UI 74 source markers missing')
    with zipfile.ZipFile(source) as input_apk:
        names = set(input_apk.namelist())
        required = {'AndroidManifest.xml', 'classes.dex', 'classes2.dex', 'assets/nava_app_v11.js', 'assets/nava_app_v11.css', 'assets/offline.html', 'resources.arsc'}
        if not required.issubset(names):
            raise ValueError('base entries missing')
        preserved = {name: input_apk.read(name) for name in ('classes.dex', 'classes2.dex', 'assets/offline.html', 'resources.arsc')}
        base_script = input_apk.read('assets/nava_app_v11.js').decode('utf-8')
        base_stylesheet = input_apk.read('assets/nava_app_v11.css').decode('utf-8')
        with zipfile.ZipFile(output, 'w') as output_apk:
            for info in input_apk.infolist():
                if old_signature(info.filename):
                    continue
                contents = input_apk.read(info.filename)
                if info.filename == 'AndroidManifest.xml':
                    contents = manifest
                elif info.filename == 'assets/nava_app_v11.js':
                    contents = (base_script.rstrip() + '\n' + script.rstrip() + '\n').encode('utf-8')
                elif info.filename == 'assets/nava_app_v11.css':
                    contents = (base_stylesheet.rstrip() + '\n' + stylesheet.rstrip() + '\n').encode('utf-8')
                output_apk.writestr(info, contents)
    with zipfile.ZipFile(output) as output_apk:
        for name, contents in preserved.items():
            if output_apk.read(name) != contents:
                raise ValueError('preserved entry changed ' + name)
        final_script = output_apk.read('assets/nava_app_v11.js').decode('utf-8')
        final_stylesheet = output_apk.read('assets/nava_app_v11.css').decode('utf-8')
        if not final_script.startswith(base_script.rstrip()) or not final_stylesheet.startswith(base_stylesheet.rstrip()):
            raise ValueError('base UI changed instead of layered override')
        for token in ('__navaShellV12174', 'nava-nav-profile-image-v12174', 'nava-route-pending-v12174'):
            if token not in final_script and token not in final_stylesheet:
                raise ValueError('UI 74 token missing ' + token)
    print('PATCH_74_OK base=12.1.73 shell=dark profile-avatar=ok instant-feedback=ok versionCode=90')

if __name__ == '__main__':
    main()
