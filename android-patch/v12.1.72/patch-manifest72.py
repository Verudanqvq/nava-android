from pathlib import Path
import sys, xml.etree.ElementTree as ET
if len(sys.argv)!=2: raise SystemExit('usage: patch-manifest72.py AndroidManifest.xml')
p=Path(sys.argv[1]); ET.register_namespace('android','http://schemas.android.com/apk/res/android'); A='{http://schemas.android.com/apk/res/android}'
tree=ET.parse(p); root=tree.getroot(); root.set(A+'versionName','12.1.72'); root.set(A+'versionCode','88')
app=root.find('application')
if app is None: raise ValueError('application missing')
svc=[x for x in app.findall('service') if x.get(A+'name')=='com.verudanava.nava.NavaDownloadService70']
if len(svc)!=1: raise ValueError('foreground service missing or duplicated')
tree.write(p,encoding='utf-8',xml_declaration=True)
compat=p.parent/'res'/'values'/'nava_compat_attrs72.xml'; compat.parent.mkdir(parents=True,exist_ok=True)
compat.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<attr name="state_liftable" format="boolean" />\n<attr name="state_lifted" format="boolean" />\n<attr name="state_dragged" format="boolean" />\n<attr name="state_with_icon" format="boolean" />\n</resources>\n',encoding='utf-8')
print('MANIFEST_72_OK versionCode=88 service70=preserved')
