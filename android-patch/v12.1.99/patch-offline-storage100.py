from pathlib import Path
import sys
if len(sys.argv)!=3: raise SystemExit('usage: patch-offline-storage100.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
needle_refresh = '''                if (fileResourceFile.isFile() && fileResourceMimeFile.isFile()) {'''
replacement_refresh = '''                if (false && fileResourceFile.isFile() && fileResourceMimeFile.isFile()) {'''
if s.count(needle_refresh) != 1: raise ValueError('resource refresh patch-point count=' + str(s.count(needle_refresh)))
s = s.replace(needle_refresh, replacement_refresh, 1)

needle_scripts = '''    private static boolean allowedResource(String str, String str2) {
        String strNormalizeMime = normalizeMime(str);
        if (strNormalizeMime.startsWith("image/") || strNormalizeMime.equals("text/css") || strNormalizeMime.startsWith("font/") || strNormalizeMime.contains("font-woff") || strNormalizeMime.contains("font-ttf")) {
            return true;
        }
        return str2.toLowerCase(Locale.ROOT).matches(".*\\\\.(?:png|jpe?g|gif|webp|svg|avif|css|woff2?|ttf|otf)(?:\\\\?.*)?$");
    }'''
replacement_scripts = '''    private static boolean allowedResource(String str, String str2) {
        String strNormalizeMime = normalizeMime(str);
        String url = str2 == null ? "" : str2.toLowerCase(Locale.ROOT);
        if (strNormalizeMime.startsWith("image/") || strNormalizeMime.equals("text/css") || strNormalizeMime.startsWith("font/") || strNormalizeMime.contains("font-woff") || strNormalizeMime.contains("font-ttf") || strNormalizeMime.contains("javascript") || strNormalizeMime.equals("application/ecmascript")) {
            return true;
        }
        return url.matches(".*\\\\.(?:js|mjs|cjs|png|jpe?g|gif|webp|svg|avif|css|woff2?|ttf|otf)(?:\\\\?.*)?$");
    }'''
if s.count(needle_scripts) != 1: raise ValueError('script-resource patch-point count=' + str(s.count(needle_scripts)))
s = s.replace(needle_scripts, replacement_scripts, 1)

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
'''
addition=needle+'''        File storageRoot = root(context);
        long usedBefore = folderSize(storageRoot);
        long physicallyAvailable = Math.max(0L, storageRoot.getUsableSpace() - 268435456L);
        long configuredLimit = prefs(context).getLong("storageLimitBytes", 2147483648L);
        long effectiveLimit = Math.min(configuredLimit, usedBefore + physicallyAvailable);
        if (configuredLimit <= 0 || usedBefore >= effectiveLimit) {
            throw new Exception("İndirme sınırına veya cihazdaki boş alana ulaşıldı.");
        }
'''
if s.count(needle)!=1: raise ValueError('smart download patch point count='+str(s.count(needle)))
s=s.replace(needle,addition,1)

# Enforce both the user-configured limit and real device free space during every download.
page_anchor = '''        String strDecodeHtml = decodeHtml(fetch2.bytes, fetch2.contentType);
        LinkedHashSet<String> linkedHashSetCollectResources = collectResources(strCanonicalNava, strDecodeHtml);'''
page_replacement = '''        String strDecodeHtml = decodeHtml(fetch2.bytes, fetch2.contentType);
        if (usedBefore + fetch2.bytes.length > effectiveLimit) throw new Exception("Bu sayfa için cihazda yeterli boş alan yok.");
        LinkedHashSet<String> linkedHashSetCollectResources = collectResources(strCanonicalNava, strDecodeHtml);'''
if s.count(page_anchor) != 1: raise ValueError('page space guard anchor count='+str(s.count(page_anchor)))
s=s.replace(page_anchor,page_replacement,1)
resource_anchor = '''                        if (j + storedBytes.length > MAX_PAGE_RESOURCES) {
                            break;
                        }
                        writeBytes(fileResourceFile, storedBytes);'''
resource_replacement = '''                        if (j + storedBytes.length > MAX_PAGE_RESOURCES) break;
                        if (usedBefore + fetch2.bytes.length + j + storedBytes.length > effectiveLimit) throw new Exception("İndirme sınırına veya cihazdaki boş alana ulaşıldı.");
                        writeBytes(fileResourceFile, storedBytes);'''
if s.count(resource_anchor) != 1: raise ValueError('resource space guard anchor count='+str(s.count(resource_anchor)))
s=s.replace(resource_anchor,resource_replacement,1)
page_write_anchor = '''        String strPrepareOfflineHtml = prepareOfflineHtml(strCanonicalNava, strDecodeHtml);
        File filePageFile = pageFile(context, strCanonicalNava);
        writeBytes(filePageFile, strPrepareOfflineHtml.getBytes(StandardCharsets.UTF_8));'''
page_write_replacement = '''        String strPrepareOfflineHtml = prepareOfflineHtml(strCanonicalNava, strDecodeHtml);
        File filePageFile = pageFile(context, strCanonicalNava);
        byte[] pageBytes = strPrepareOfflineHtml.getBytes(StandardCharsets.UTF_8);
        if (usedBefore + length + pageBytes.length > effectiveLimit) throw new Exception("İndirme sınırına veya cihazdaki boş alana ulaşıldı.");
        writeBytes(filePageFile, pageBytes);'''
if s.count(page_write_anchor) != 1: raise ValueError('page write space guard anchor count='+str(s.count(page_write_anchor)))
s=s.replace(page_write_anchor,page_write_replacement,1)
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
bridge_methods='''        @JavascriptInterface
        public boolean getSmartDownloads() { return OfflineRuntime.prefs(this.context).getBoolean("smartDownloads", true); }

        @JavascriptInterface
        public void setSmartDownloads(boolean enabled) { OfflineRuntime.prefs(this.context).edit().putBoolean("smartDownloads", enabled).apply(); }

        @JavascriptInterface
        public int getSmartKeep() { return OfflineRuntime.prefs(this.context).getInt("smartKeep", 2); }

        @JavascriptInterface
        public void setSmartKeep(int count) { OfflineRuntime.prefs(this.context).edit().putInt("smartKeep", Math.max(2, Math.min(3, count))).apply(); }

        @JavascriptInterface
        public long getStorageLimitBytes() { return OfflineRuntime.prefs(this.context).getLong("storageLimitBytes", 2147483648L); }

        @JavascriptInterface
        public void setStorageLimitBytes(long bytes) { OfflineRuntime.prefs(this.context).edit().putLong("storageLimitBytes", Math.max(536870912L, Math.min(214748364800L, bytes))).apply(); }

'''
bridge_methods=bridge_methods.replace('''        public void setStorageLimitBytes(long bytes) { OfflineRuntime.prefs(this.context).edit().putLong("storageLimitBytes", Math.max(536870912L, Math.min(214748364800L, bytes))).apply(); }''','''        public void setStorageLimitBytes(long bytes) {
            File storageRoot = OfflineRuntime.root(this.context);
            long usable = Math.max(0L, storageRoot.getUsableSpace() - 268435456L);
            long maximum = Math.max(104857600L, OfflineRuntime.folderSize(storageRoot) + usable);
            OfflineRuntime.prefs(this.context).edit().putLong("storageLimitBytes", Math.max(104857600L, Math.min(Math.min(214748364800L, maximum), bytes))).apply();
        }''')
anchor='''        @JavascriptInterface
        public void open(String str) {'''
if s.count(anchor)!=1: raise ValueError('open bridge anchor count='+str(s.count(anchor)))
s=s.replace(anchor,cleanup+bridge_methods+anchor,1)
s=s.replace('''                String unused = OfflineRuntime.forcedUrl = strCanonicalNava;''','''                String unused = OfflineRuntime.forcedUrl = strCanonicalNava;''',1)
if 'cleanupReadChapters' not in s or 'chapterLanguage' not in s or 'public boolean getSmartDownloads()' not in s or 'storageLimitBytes' not in s or 'physicallyAvailable' not in s or 'pageBytes' not in s: raise ValueError('smart settings and storage cap patch markers missing')
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_STORAGE_100_OK storage capacity, Wi-Fi setting and language-safe chapter cleanup installed')
