from pathlib import Path
import sys

if len(sys.argv)!=3:
    raise SystemExit('usage: patch-offline-runtime71.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
needle='''    private static void runBatch63(Context context, String str) {\n'''
helper='''    private static void downloadOne71(Context context, String rawUrl, String title, String seriesTitle, String kind) throws Exception {\n        Throwable last = null;\n        for (int attempt = 1; attempt <= 3; attempt++) {\n            try {\n                downloadOne(context, rawUrl, title, seriesTitle, kind);\n                return;\n            } catch (Throwable th) {\n                last = th;\n                if (isCancelled(rawUrl)) break;\n                String msg = th.getMessage() == null ? "" : th.getMessage();\n                if (msg.contains("Yalnız Wi") || msg.contains("Geçersiz Nava")) break;\n                if (attempt < 3) {\n                    try {\n                        JSONObject retry = event("retry", canonicalNava(rawUrl), title, "Geçici bağlantı hatası, yeniden deneniyor (" + attempt + "/3)");\n                        retry.put("attempt", attempt);\n                        emit(retry);\n                    } catch (Throwable ignored) {}\n                    try { Thread.sleep(attempt == 1 ? 1200L : 2600L); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }\n                }\n            }\n        }\n        if (last instanceof Exception) throw (Exception) last;\n        throw new Exception(last == null ? "İndirme başarısız." : String.valueOf(last.getMessage()));\n    }\n\n'''+needle
if s.count(needle)!=1: raise ValueError('71 helper insertion point count='+str(s.count(needle)))
s=s.replace(needle,helper,1)
old='downloadOne(context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));'
new='downloadOne71(context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));'
if s.count(old)!=1: raise ValueError('71 batch call point count='+str(s.count(old)))
s=s.replace(old,new,1)
for token in ('NavaDownloadService70.enqueue','submitBatch63','downloadOne71','event("retry"','MAX_RESOURCES = 220'):
    if token not in s: raise ValueError('71 token missing '+token)
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_71_SOURCE_PATCH_OK retries=3 service70=preserved')
