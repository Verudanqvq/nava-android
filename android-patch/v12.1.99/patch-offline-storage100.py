from pathlib import Path
import sys
if len(sys.argv)!=3: raise SystemExit('usage: patch-offline-storage100.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
needle='''            jSONObjectLoadIndex.put("storageBytes", folderSize(root(context)));
            jSONObjectLoadIndex.put("wifiOnly", prefs(context).getBoolean("wifiOnly", true));'''
replacement='''            File storageRoot = root(context);
            jSONObjectLoadIndex.put("storageBytes", folderSize(storageRoot));
            jSONObjectLoadIndex.put("storageAvailableBytes", Math.max(0L, storageRoot.getUsableSpace()));
            jSONObjectLoadIndex.put("storageTotalBytes", Math.max(0L, storageRoot.getTotalSpace()));
            jSONObjectLoadIndex.put("wifiOnly", prefs(context).getBoolean("wifiOnly", true));'''
if s.count(needle)!=1: raise ValueError('storage index patch-point count='+str(s.count(needle)))
s=s.replace(needle,replacement,1)
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_STORAGE_100_OK usable and total filesystem bytes exposed')
