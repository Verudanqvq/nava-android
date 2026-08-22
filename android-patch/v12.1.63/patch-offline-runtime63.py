from pathlib import Path
import re, sys

if len(sys.argv) != 3:
    raise SystemExit('usage: patch-offline-runtime63.py INPUT.java OUTPUT.java')
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')

def once(a,b,label):
    global s
    if a not in s:
        raise ValueError('missing 63 patch point: '+label)
    s=s.replace(a,b,1)

once('private static final int MAX_RESOURCES = 700;','private static final int MAX_RESOURCES = 220;','resource cap')
once('httpURLConnection.setConnectTimeout(15000);','httpURLConnection.setConnectTimeout(8000);','connect timeout')
once('httpURLConnection.setReadTimeout(35000);','httpURLConnection.setReadTimeout(20000);','read timeout')
once('''                    return uri.buildUpon().scheme("https").authority("www.verudanava.com").fragment(null).build().toString();''','''                    return uri.buildUpon().scheme("https").authority("www.verudanava.com").clearQuery().fragment(null).build().toString();''','canonical query removal')

# Skip trackers/fonts/remote embeds that are not required for offline reading.
needle='''    private static void checkCancelled(String str) throws Exception {\n        if (isCancelled(str)) {\n            throw new Exception("İndirme iptal edildi.");\n        }\n    }\n'''
insert=needle+'''\n    private static boolean skipResource63(String str) {\n        if (str == null) return true;\n        String x = str.toLowerCase(Locale.ROOT);\n        return x.contains("googlesyndication.com") || x.contains("doubleclick.net") ||\n               x.contains("google-analytics.com") || x.contains("googletagmanager.com") ||\n               x.contains("fonts.gstatic.com") || x.contains("fonts.googleapis.com") ||\n               x.contains("instagram.com") || x.contains("facebook.com") ||\n               x.contains("youtube.com") || x.contains("youtu.be");\n    }\n'''
once(needle,insert,'resource skip helper')
once('''                int i3 = i + 1;\n                File fileResourceFile = resourceFile(context, str5);''','''                int i3 = i + 1;\n                if (skipResource63(str5)) {\n                    i = i3;\n                    continue;\n                }\n                File fileResourceFile = resourceFile(context, str5);''','resource skip use')

# Shared batch runner used by the foreground service. It also skips URLs already fully downloaded.
marker='''    public static final class Bridge {\n'''
runner='''    public static void submitBatch63(final Context context, final String str, final Runnable done) {\n        final Context ctx = context == null ? app : context.getApplicationContext();\n        EXEC.execute(new Runnable() {\n            @Override public void run() {\n                try {\n                    runBatch63(ctx, str);\n                } finally {\n                    activeConnection = null;\n                    activeDownloadUrl = "";\n                    if (done != null) {\n                        try { done.run(); } catch (Throwable ignored) {}\n                    }\n                }\n            }\n        });\n    }\n\n    private static void runBatch63(Context context, String str) {\n        if (context == null) return;\n        try {\n            JSONArray arr = new JSONArray(str == null ? "[]" : str);\n            JSONObject started = event("batch-start", "", "", "");\n            started.put("total", arr.length());\n            emit(started);\n            int ok = 0, failed = 0, cancelled = 0;\n            for (int i = 0; i < arr.length(); i++) {\n                JSONObject item = arr.optJSONObject(i);\n                if (item == null) continue;\n                String rawUrl = item.optString("url");\n                String title = item.optString("title");\n                String canon = canonicalNava(rawUrl);\n                if (isCancelled(rawUrl)) {\n                    cancelled++;\n                    emit(event("cancelled", canon, title, "İndirme iptal edildi."));\n                    continue;\n                }\n                try {\n                    if (canon != null) {\n                        JSONObject existing = itemFor(loadIndex(context), canon);\n                        if (existing != null && pageFile(context, canon).isFile()) {\n                            ok++;\n                            emit(event("complete", canon, title, "Zaten indirildi."));\n                            continue;\n                        }\n                    }\n                    activeDownloadUrl = canon == null ? "" : canon;\n                    downloadOne(context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));\n                    ok++;\n                } catch (Throwable th) {\n                    if (isCancelled(rawUrl)) {\n                        cancelled++;\n                        emit(event("cancelled", canon, title, "İndirme iptal edildi."));\n                    } else {\n                        failed++;\n                        emit(event("error", canon, title, safe(th.getMessage(), 300, "İndirme başarısız.")));\n                    }\n                } finally {\n                    activeConnection = null;\n                    activeDownloadUrl = "";\n                }\n            }\n            JSONObject done = event("batch-complete", "", "", "");\n            done.put("ok", ok);\n            done.put("failed", failed);\n            done.put("cancelled", cancelled);\n            emit(done);\n        } catch (Throwable th) {\n            emit(event("error", "", "", "Toplu indirme verisi okunamadı."));\n        }\n    }\n\n'''+marker
once(marker,runner,'batch runner insertion')

# Route single downloads through the same foreground-service batch path.
single_re=re.compile(r'''        @JavascriptInterface\n        public void download\(final String str, final String str2, final String str3, final String str4\) \{.*?\n        \}\n\n        @JavascriptInterface\n        public void downloadBatch''',re.S)
single_new='''        @JavascriptInterface\n        public void download(final String str, final String str2, final String str3, final String str4) {\n            try {\n                OfflineRuntime.resetCancelled(str);\n                JSONObject item = new JSONObject();\n                item.put("url", str);\n                item.put("title", str2);\n                item.put("seriesTitle", str3);\n                item.put("kind", str4);\n                JSONArray arr = new JSONArray();\n                arr.put(item);\n                try {\n                    NavaDownloadService63.start(this.context, arr.toString());\n                } catch (Throwable th) {\n                    OfflineRuntime.submitBatch63(this.context, arr.toString(), null);\n                }\n            } catch (Throwable th) {\n                OfflineRuntime.emit(OfflineRuntime.event("error", OfflineRuntime.canonicalNava(str), str2, "İndirme başlatılamadı."));\n            }\n        }\n\n        @JavascriptInterface\n        public void downloadBatch'''
s,n=single_re.subn(single_new,s,count=1)
if n!=1: raise ValueError('63 single download replacement failed')

batch_re=re.compile(r'''        @JavascriptInterface\n        public void downloadBatch\(final String str\) \{.*?\n        \}\n\n        @JavascriptInterface\n        public void cancel''',re.S)
batch_new='''        @JavascriptInterface\n        public void downloadBatch(final String str) {\n            try {\n                JSONArray prepare = new JSONArray(str == null ? "[]" : str);\n                for (int i = 0; i < prepare.length(); i++) {\n                    JSONObject item = prepare.optJSONObject(i);\n                    if (item != null) OfflineRuntime.resetCancelled(item.optString("url"));\n                }\n                try {\n                    NavaDownloadService63.start(this.context, str);\n                } catch (Throwable th) {\n                    OfflineRuntime.submitBatch63(this.context, str, null);\n                }\n            } catch (Throwable th) {\n                OfflineRuntime.emit(OfflineRuntime.event("error", "", "", "Toplu indirme başlatılamadı."));\n            }\n        }\n\n        @JavascriptInterface\n        public void cancel'''
s,n=batch_re.subn(batch_new,s,count=1)
if n!=1: raise ValueError('63 batch replacement failed')

# Shared relation cache lets both https app pages and file:///android_asset/offline.html resolve legacy aliases.
needle='''        @JavascriptInterface\n        public void delete'''
relations='''        @JavascriptInterface\n        public void setSeriesRelations(String str) {\n            try {\n                String value = str == null ? "{}" : str;\n                if (value.length() > 1000000) return;\n                OfflineRuntime.prefs(this.context).edit().putString("seriesRelations63", value).apply();\n            } catch (Throwable ignored) {}\n        }\n\n        @JavascriptInterface\n        public String getSeriesRelations() {\n            try {\n                return OfflineRuntime.prefs(this.context).getString("seriesRelations63", "{}");\n            } catch (Throwable th) {\n                return "{}";\n            }\n        }\n\n'''+needle
once(needle,relations,'relation bridge')

for token in ('submitBatch63','NavaDownloadService63.start','seriesRelations63','MAX_RESOURCES = 220','clearQuery()','skipResource63'):
    if token not in s: raise ValueError('63 runtime token missing '+token)
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_63_SOURCE_PATCH_OK')
