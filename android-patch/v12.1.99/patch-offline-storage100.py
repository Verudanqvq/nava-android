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
needle='''        if (strCanonicalNava == null) {
            throw new Exception("Geçersiz Nava bağlantısı.");
        }
        long configuredLimit = prefs(context).getLong("storageLimitBytes", 2147483648L);
        if (configuredLimit > 0 && folderSize(root(context)) >= configuredLimit) {
            throw new Exception("İndirme sınırına ulaşıldı. Ayarlardan GB sınırını artırabilirsin.");
        }
'''
addition=needle+'''        if (pageFile(context, strCanonicalNava).isFile() && itemFor(loadIndex(context), strCanonicalNava) != null) {
            emit(event("skipped", strCanonicalNava, str2, "Zaten indirilmiş."));
            return;
        }
'''
if s.count(needle)!=1: raise ValueError('smart download patch point count='+str(s.count(needle)))
s=s.replace(needle,addition,1)
cleanup='''    private static String chapterLanguage(String url) {
        try {
            String path = java.net.URI.create(url).getPath().toLowerCase(java.util.Locale.ROOT);
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("/(tr|en|ja|jp|es|fr|de|ko|zh)(?:/|$)").matcher(path);
            return m.find() ? m.group(1) : "";
        } catch (Throwable ignored) { return ""; }
    }

    private static int chapterNumber(String value) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:bölüm|bolum|chapter|ch[.]?|episode|ep[.]?)[ ]*#?([0-9]+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(value == null ? "" : value);
        int result = -1; while (m.find()) { try { result = Integer.parseInt(m.group(1)); } catch (Throwable ignored) {} } return result;
    }

    private static void cleanupReadChapters(Context context, String currentUrl) {
        try {
            JSONObject index = loadIndex(context); JSONArray items = index.optJSONArray("items"); if (items == null) return;
            JSONObject current = itemFor(index, currentUrl); if (current == null) return;
            String series = current.optString("seriesTitle", ""); String language = chapterLanguage(currentUrl);
            int currentNo = chapterNumber(current.optString("title", "") + " " + currentUrl);
            if (!prefs(context).getBoolean("smartDownloads", true) || series.isEmpty() || language.isEmpty() || !"chapter".equalsIgnoreCase(current.optString("kind", "chapter"))) return;
            int keep = Math.max(2, Math.min(3, prefs(context).getInt("smartKeep", 2)));
            if (currentNo < keep + 2) return;
            java.util.ArrayList<String> remove = new java.util.ArrayList<>();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                String url = item.optString("url", "");
                if (url.equals(currentUrl) || !series.equals(item.optString("seriesTitle", "")) || !"chapter".equalsIgnoreCase(item.optString("kind", "chapter")) || !language.equals(chapterLanguage(url))) continue;
                int no = chapterNumber(item.optString("title", "") + " " + url);
                if (no >= 0 && no < currentNo - keep - 1) remove.add(url);
            }
            for (String url : remove) deleteOne(context, url);
        } catch (Throwable ignored) {}
    }

'''
anchor='''        @JavascriptInterface
        public boolean getSmartDownloads() { return OfflineRuntime.prefs(this.context).getBoolean("smartDownloads", true); }

        @JavascriptInterface
        public void setSmartDownloads(boolean enabled) { OfflineRuntime.prefs(this.context).edit().putBoolean("smartDownloads", enabled).apply(); }

        @JavascriptInterface
        public int getSmartKeep() { return OfflineRuntime.prefs(this.context).getInt("smartKeep", 2); }

        @JavascriptInterface
        public void setSmartKeep(int count) { OfflineRuntime.prefs(this.context).edit().putInt("smartKeep", Math.max(2, Math.min(3, count))).apply(); }

        @JavascriptInterface
        public void setStorageLimitBytes(long bytes) { OfflineRuntime.prefs(this.context).edit().putLong("storageLimitBytes", Math.max(536870912L, Math.min(214748364800L, bytes))).apply(); }

        @JavascriptInterface
        public void open(String str) {'''
if s.count(anchor)!=1: raise ValueError('open bridge anchor count='+str(s.count(anchor)))
s=s.replace(anchor,cleanup+anchor,1)
s=s.replace('''                String unused = OfflineRuntime.forcedUrl = strCanonicalNava;''','''                cleanupReadChapters(this.context, strCanonicalNava);
                String unused = OfflineRuntime.forcedUrl = strCanonicalNava;''',1)
if 'cleanupReadChapters' not in s or 'chapterLanguage' not in s or 'public boolean getSmartDownloads()' not in s or 'storageLimitBytes' not in s: raise ValueError('smart settings and storage cap patch markers missing')
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_STORAGE_100_OK storage capacity, Wi-Fi setting and language-safe chapter cleanup installed')
