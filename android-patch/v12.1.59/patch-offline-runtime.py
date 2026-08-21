from pathlib import Path
import re, sys

if len(sys.argv)!=3:
    raise SystemExit('usage: patch-offline-runtime.py INPUT.java OUTPUT.java')
src=Path(sys.argv[1]).read_text(encoding='utf-8')


def once(s,a,b,label):
    if a not in s:
        raise ValueError('missing source patch point: '+label)
    return s.replace(a,b,1)

src=once(src,
'''    private static volatile String activeOfflineUrl = "";\n''',
'''    private static volatile String activeOfflineUrl = "";\n    private static final Set<String> CANCELLED = java.util.Collections.synchronizedSet(new java.util.HashSet<String>());\n    private static volatile HttpURLConnection activeConnection = null;\n    private static volatile String activeDownloadUrl = "";\n''','cancel fields')

src=once(src,
'''    private OfflineRuntime() {\n    }\n''',
'''    private OfflineRuntime() {\n    }\n\n    private static boolean isCancelled(String str) {\n        String c = canonicalNava(str);\n        return c != null && CANCELLED.contains(c);\n    }\n\n    private static void resetCancelled(String str) {\n        String c = canonicalNava(str);\n        if (c != null) {\n            CANCELLED.remove(c);\n        }\n    }\n\n    private static void cancelUrl(String str) {\n        String c = canonicalNava(str);\n        if (c == null) {\n            return;\n        }\n        CANCELLED.add(c);\n        HttpURLConnection connection = activeConnection;\n        if (c.equals(activeDownloadUrl) && connection != null) {\n            try {\n                connection.disconnect();\n            } catch (Throwable th) {\n            }\n        }\n    }\n\n    private static void checkCancelled(String str) throws Exception {\n        if (isCancelled(str)) {\n            throw new Exception("İndirme iptal edildi.");\n        }\n    }\n''','cancel helpers')

src=once(src,
'''        if (prefs(context).getBoolean("wifiOnly", true) && !onWifi(context)) {\n            throw new Exception("Yalnız Wi‑Fi indirmesi açık.");\n        }\n        emit(event("start", strCanonicalNava, str2, ""));\n''',
'''        if (prefs(context).getBoolean("wifiOnly", true) && !onWifi(context)) {\n            throw new Exception("Yalnız Wi‑Fi indirmesi açık.");\n        }\n        checkCancelled(strCanonicalNava);\n        emit(event("start", strCanonicalNava, str2, ""));\n''','download start cancel check')

src=once(src,
'''        for (int i2 = 0; i2 < arrayList.size() && i < MAX_RESOURCES; i2++) {\n            String str5 = (String) arrayList.get(i2);\n''',
'''        for (int i2 = 0; i2 < arrayList.size() && i < MAX_RESOURCES; i2++) {\n            checkCancelled(strCanonicalNava);\n            String str5 = (String) arrayList.get(i2);\n''','resource loop cancel check')

src=once(src,
'''        j = length;\n        String strPrepareOfflineHtml = prepareOfflineHtml(strCanonicalNava, strDecodeHtml);\n''',
'''        j = length;\n        checkCancelled(strCanonicalNava);\n        String strPrepareOfflineHtml = prepareOfflineHtml(strCanonicalNava, strDecodeHtml);\n''','final write cancel check')

src=once(src,
'''    private static Fetch fetch(String str, long j) throws Exception {\n        HttpURLConnection httpURLConnection = (HttpURLConnection) new URL(str).openConnection();\n''',
'''    private static Fetch fetch(String str, long j) throws Exception {\n        String parentDownload = activeDownloadUrl;\n        if (parentDownload != null && !parentDownload.isEmpty()) {\n            checkCancelled(parentDownload);\n        }\n        HttpURLConnection httpURLConnection = (HttpURLConnection) new URL(str).openConnection();\n        if (parentDownload != null && !parentDownload.isEmpty()) {\n            activeConnection = httpURLConnection;\n        }\n''','fetch connection registration')

src=once(src,
'''        while (true) {\n            int i = inputStream.read(bArr);\n''',
'''        while (true) {\n            if (parentDownload != null && !parentDownload.isEmpty()) {\n                checkCancelled(parentDownload);\n            }\n            int i = inputStream.read(bArr);\n''','fetch read cancel check')

src=once(src,
'''                String contentType = httpURLConnection.getContentType();\n                httpURLConnection.disconnect();\n                return new Fetch(byteArrayOutputStream.toByteArray(), contentType);\n''',
'''                String contentType = httpURLConnection.getContentType();\n                httpURLConnection.disconnect();\n                if (activeConnection == httpURLConnection) {\n                    activeConnection = null;\n                }\n                return new Fetch(byteArrayOutputStream.toByteArray(), contentType);\n''','fetch connection clear')

single_re=re.compile(r'''        @JavascriptInterface\n        public void download\(final String str, final String str2, final String str3, final String str4\) \{.*?\n        \}\n\n        @JavascriptInterface\n        public void downloadBatch''',re.S)
single_new='''        @JavascriptInterface\n        public void download(final String str, final String str2, final String str3, final String str4) {\n            OfflineRuntime.resetCancelled(str);\n            OfflineRuntime.EXEC.execute(new Runnable() {\n                @Override\n                public void run() {\n                    String canon = OfflineRuntime.canonicalNava(str);\n                    try {\n                        OfflineRuntime.activeDownloadUrl = canon == null ? "" : canon;\n                        OfflineRuntime.downloadOne(Bridge.this.context, str, str2, str3, str4);\n                    } catch (Throwable th) {\n                        if (OfflineRuntime.isCancelled(str)) {\n                            OfflineRuntime.emit(OfflineRuntime.event("cancelled", canon, str2, "İndirme iptal edildi."));\n                        } else {\n                            OfflineRuntime.emit(OfflineRuntime.event("error", canon, str2, OfflineRuntime.safe(th.getMessage(), 300, "İndirme başarısız.")));\n                        }\n                    } finally {\n                        OfflineRuntime.activeConnection = null;\n                        OfflineRuntime.activeDownloadUrl = "";\n                    }\n                }\n            });\n        }\n\n        @JavascriptInterface\n        public void downloadBatch'''
src,n=single_re.subn(single_new,src,count=1)
if n!=1: raise ValueError('download method replacement failed')

batch_re=re.compile(r'''        @JavascriptInterface\n        public void downloadBatch\(final String str\) \{.*?\n        \}\n\n        @JavascriptInterface\n        public void delete''',re.S)
batch_new='''        @JavascriptInterface\n        public void downloadBatch(final String str) {\n            try {\n                JSONArray prepare = new JSONArray(str == null ? "[]" : str);\n                for (int i = 0; i < prepare.length(); i++) {\n                    JSONObject item = prepare.optJSONObject(i);\n                    if (item != null) {\n                        OfflineRuntime.resetCancelled(item.optString("url"));\n                    }\n                }\n            } catch (Throwable th) {\n            }\n            OfflineRuntime.EXEC.execute(new Runnable() {\n                @Override\n                public void run() {\n                    try {\n                        JSONArray jSONArray = new JSONArray(str == null ? "[]" : str);\n                        JSONObject jSONObjectEvent = OfflineRuntime.event("batch-start", "", "", "");\n                        jSONObjectEvent.put("total", jSONArray.length());\n                        OfflineRuntime.emit(jSONObjectEvent);\n                        int ok = 0;\n                        int failed = 0;\n                        int cancelled = 0;\n                        for (int i = 0; i < jSONArray.length(); i++) {\n                            JSONObject item = jSONArray.optJSONObject(i);\n                            if (item == null) {\n                                continue;\n                            }\n                            String rawUrl = item.optString("url");\n                            String title = item.optString("title");\n                            String canon = OfflineRuntime.canonicalNava(rawUrl);\n                            if (OfflineRuntime.isCancelled(rawUrl)) {\n                                cancelled++;\n                                OfflineRuntime.emit(OfflineRuntime.event("cancelled", canon, title, "İndirme iptal edildi."));\n                                continue;\n                            }\n                            try {\n                                OfflineRuntime.activeDownloadUrl = canon == null ? "" : canon;\n                                OfflineRuntime.downloadOne(Bridge.this.context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));\n                                ok++;\n                            } catch (Throwable th) {\n                                if (OfflineRuntime.isCancelled(rawUrl)) {\n                                    cancelled++;\n                                    OfflineRuntime.emit(OfflineRuntime.event("cancelled", canon, title, "İndirme iptal edildi."));\n                                } else {\n                                    failed++;\n                                    OfflineRuntime.emit(OfflineRuntime.event("error", canon, title, OfflineRuntime.safe(th.getMessage(), 300, "İndirme başarısız.")));\n                                }\n                            } finally {\n                                OfflineRuntime.activeConnection = null;\n                                OfflineRuntime.activeDownloadUrl = "";\n                            }\n                        }\n                        JSONObject done = OfflineRuntime.event("batch-complete", "", "", "");\n                        done.put("ok", ok);\n                        done.put("failed", failed);\n                        done.put("cancelled", cancelled);\n                        OfflineRuntime.emit(done);\n                    } catch (Throwable th) {\n                        OfflineRuntime.emit(OfflineRuntime.event("error", "", "", "Toplu indirme verisi okunamadı."));\n                    } finally {\n                        OfflineRuntime.activeConnection = null;\n                        OfflineRuntime.activeDownloadUrl = "";\n                    }\n                }\n            });\n        }\n\n        @JavascriptInterface\n        public void cancel(String str) {\n            String canon = OfflineRuntime.canonicalNava(str);\n            OfflineRuntime.cancelUrl(str);\n            OfflineRuntime.emit(OfflineRuntime.event("cancel-requested", canon, "", ""));\n        }\n\n        @JavascriptInterface\n        public void delete'''
src,n=batch_re.subn(batch_new,src,count=1)
if n!=1: raise ValueError('downloadBatch method replacement failed')

for token in ('CANCELLED','activeConnection','public void cancel(String str)','"cancelled"','checkCancelled(parentDownload)'):
    if token not in src: raise ValueError('patched source token missing '+token)

Path(sys.argv[2]).write_text(src,encoding='utf-8')
print('OFFLINE_RUNTIME_59_SOURCE_PATCH_OK')
