from pathlib import Path
import sys,xml.etree.ElementTree as ET
p=Path(sys.argv[1]); ET.register_namespace('android','http://schemas.android.com/apk/res/android'); A='{http://schemas.android.com/apk/res/android}'
tree=ET.parse(p); root=tree.getroot(); root.set(A+'versionName','12.1.73'); root.set(A+'versionCode','89'); print('MANIFEST_73_OK versionCode=89')
tree.write(p,encoding='utf-8',xml_declaration=True)
