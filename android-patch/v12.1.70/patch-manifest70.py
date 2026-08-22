from pathlib import Path
import sys, xml.etree.ElementTree as ET

if len(sys.argv)!=2:
    raise SystemExit('usage: patch-manifest70.py AndroidManifest.xml')
p=Path(sys.argv[1])
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
A='{http://schemas.android.com/apk/res/android}'
tree=ET.parse(p); root=tree.getroot()
root.set(A+'versionName','12.1.70')
root.set(A+'versionCode','86')
existing={x.get(A+'name') for x in root.findall('uses-permission')}
for name in ('android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_DATA_SYNC'):
    if name not in existing:
        e=ET.Element('uses-permission'); e.set(A+'name',name); root.insert(0,e)
app=root.find('application')
if app is None: raise ValueError('application missing')
service_name='com.verudanava.nava.NavaDownloadService70'
services=[x for x in app.findall('service') if x.get(A+'name')==service_name]
if len(services)>1: raise ValueError('duplicate 70 service')
if services:
    svc=services[0]
else:
    svc=ET.SubElement(app,'service'); svc.set(A+'name',service_name)
svc.set(A+'exported','false')
svc.set(A+'stopWithTask','false')
svc.set(A+'foregroundServiceType','dataSync')
tree.write(p,encoding='utf-8',xml_declaration=True)
print('MANIFEST_70_OK service=foreground-dataSync stopWithTask=false versionCode=86')
