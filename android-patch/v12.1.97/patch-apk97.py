import sys,zipfile
from pathlib import Path
def old_signature(name):
 u=name.upper();leaf=u.rsplit('/',1)[-1]
 return u.startswith('META-INF/') and (leaf=='MANIFEST.MF' or leaf.endswith(('.SF','.RSA','.DSA','.EC')))
if len(sys.argv)!=6:raise SystemExit('usage: patch-apk93.py SRC MANIFEST JS CSS OUT')
source,manifest_file,js_file,css_file,output=map(Path,sys.argv[1:])
manifest=manifest_file.read_bytes();script=js_file.read_text(encoding='utf-8');stylesheet=css_file.read_text(encoding='utf-8')
offline=Path('android-patch/v12.1.97/offline.html').read_bytes()
if b'12.1.97' not in manifest and '12.1.97'.encode('utf-16le') not in manifest:raise ValueError('manifest version marker missing')
if '__navaShellV12197' not in script:raise ValueError('shell marker missing')
if b'NAVA_OFFLINE_HIERARCHY_V12197' not in offline:raise ValueError('offline hierarchy marker missing')
with zipfile.ZipFile(source) as zin,zipfile.ZipFile(output,'w') as zout:
 required={'AndroidManifest.xml','classes.dex','classes2.dex','assets/nava_app_v11.js','assets/nava_app_v11.css','assets/offline.html','resources.arsc'}
 if not required.issubset(set(zin.namelist())):raise ValueError('base APK entries missing')
 original={n:zin.read(n) for n in ('classes.dex','classes2.dex','resources.arsc')}
 base_js=zin.read('assets/nava_app_v11.js').decode();base_css=zin.read('assets/nava_app_v11.css').decode()
 auto="if(ratings&&!ratings.dataset.navaAutoOpen){ratings.dataset.navaAutoOpen='1';setTimeout(function(){try{ratings.click()}catch(_){}},0)}"
 if base_js.count(auto)!=1:raise ValueError('expected one profile auto-tab switch to remove')
 base_js=base_js.replace(auto,"/* v12.1.97: preserve the current profile tab on entry */")
 for info in zin.infolist():
  if old_signature(info.filename):continue
  data=zin.read(info.filename)
  if info.filename=='AndroidManifest.xml':data=manifest
  elif info.filename=='assets/nava_app_v11.js':data=(base_js.rstrip()+'\n'+script.rstrip()+'\n').encode()
  elif info.filename=='assets/nava_app_v11.css':data=(base_css.rstrip()+'\n'+stylesheet.rstrip()+'\n').encode()
  elif info.filename=='assets/offline.html':data=offline
  zout.writestr(info,data)
with zipfile.ZipFile(output) as result:
 for n,data in original.items():
  if result.read(n)!=data:raise ValueError('native/resource entry changed: '+n)
 if '__navaShellV12197' not in result.read('assets/nava_app_v11.js').decode():raise ValueError('shell JS missing')
 if b'NAVA_OFFLINE_HIERARCHY_V12197' not in result.read('assets/offline.html'):raise ValueError('offline html missing')
 if b'nava-crystal-mark-v12190' in result.read('assets/nava_app_v11.js'):raise ValueError('brand override remains')
print('PATCH_93_OK actual offline screen replaced; native code/resources preserved')
