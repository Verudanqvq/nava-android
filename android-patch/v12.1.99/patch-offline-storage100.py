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
bridge='''        @JavascriptInterface
        public boolean getSmartDownloads() {
            return OfflineRuntime.prefs(this.context).getBoolean("smartDownloads", true);
        }

        @JavascriptInterface
        public void setSmartDownloads(boolean enabled) {
            OfflineRuntime.prefs(this.context).edit().putBoolean("smartDownloads", enabled).apply();
            OfflineRuntime.emit(OfflineRuntime.event("settings", "", "", ""));
        }

        @JavascriptInterface
        public String getDefaultLanguage() {
            return OfflineRuntime.prefs(this.context).getString("defaultLanguage", "tr");
        }

        @JavascriptInterface
        public void setDefaultLanguage(String language) {
            String value = "en".equals(language) || "ja".equals(language) ? language : "tr";
            OfflineRuntime.prefs(this.context).edit().putString("defaultLanguage", value).apply();
            OfflineRuntime.emit(OfflineRuntime.event("settings", "", "", ""));
        }

'''
anchor='''        @JavascriptInterface
        public void download(final String str, final String str2, final String str3, final String str4) {'''
if s.count(anchor)!=1: raise ValueError('settings bridge insertion point count='+str(s.count(anchor)))
s=s.replace(anchor,bridge+anchor,1)
old='''                                try {
                                    OfflineRuntime.downloadOne(Bridge.this.context, jSONObjectOptJSONObject.optString("url"), jSONObjectOptJSONObject.optString("title"), jSONObjectOptJSONObject.optString("seriesTitle"), jSONObjectOptJSONObject.optString("kind", "chapter"));
                                    i++;'''
new='''                                try {
                                    String batchUrl = jSONObjectOptJSONObject.optString("url");
                                    String canonicalBatchUrl = OfflineRuntime.canonicalNava(batchUrl);
                                    if (OfflineRuntime.prefs(Bridge.this.context).getBoolean("smartDownloads", true) && canonicalBatchUrl != null && OfflineRuntime.pageFile(Bridge.this.context, canonicalBatchUrl).isFile() && OfflineRuntime.itemFor(OfflineRuntime.loadIndex(Bridge.this.context), canonicalBatchUrl) != null) { i++; continue; }
                                    OfflineRuntime.downloadOne(Bridge.this.context, batchUrl, jSONObjectOptJSONObject.optString("title"), jSONObjectOptJSONObject.optString("seriesTitle"), jSONObjectOptJSONObject.optString("kind", "chapter"));
                                    i++;'''
if s.count(old)!=1: raise ValueError('batch patch point count='+str(s.count(old)))
s=s.replace(old,new,1)
s=s.replace("print('OFFLINE_STORAGE_100_OK usable and total filesystem bytes exposed')", "print('OFFLINE_STORAGE_100_OK storage capacity, persisted preferences and smart batch skip installed')")
if 'getSmartDownloads' not in s or 'canonicalBatchUrl' not in s: raise ValueError('settings patch markers missing')
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_STORAGE_100_OK usable and total filesystem bytes exposed')
