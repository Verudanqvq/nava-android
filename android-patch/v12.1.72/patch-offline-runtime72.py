from pathlib import Path
import sys

if len(sys.argv)!=3:
    raise SystemExit('usage: patch-offline-runtime72.py INPUT.java OUTPUT.java')
s=Path(sys.argv[1]).read_text(encoding='utf-8')

def once(a,b,label):
    global s
    if s.count(a)!=1:
        raise ValueError(label+' patch point count='+str(s.count(a)))
    s=s.replace(a,b,1)

once('''        final Context ctx = context == null ? app : context.getApplicationContext();\n        EXEC.execute(new Runnable() {''','''        final Context ctx = context == null ? app : context.getApplicationContext();\n        if (ctx != null) {\n            app = ctx;\n            mergeQueue72(ctx, str);\n        }\n        EXEC.execute(new Runnable() {''','submit queue seed')

once('''    public static void emit(final JSONObject jSONObject) {\n        final WebView webView = web.get();''','''    public static void emit(final JSONObject jSONObject) {\n        try { queueEvent72(app, jSONObject); } catch (Throwable ignored) {}\n        final WebView webView = web.get();''','emit ledger hook')

needle='''    private static void downloadOne71(Context context, String rawUrl, String title, String seriesTitle, String kind) throws Exception {\n'''
helpers=r'''    private static final String QUEUE72 = "downloadQueue72";

    private static String clean72(String value, int max) {
        String x = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        return x.length() > max ? x.substring(0, max) : x;
    }

    private static String number72(String text, String kind) {
        String rx = kind.equals("volume") ? "(?i)(?:cilt|volume|vol\\.?)\\s*([0-9]+(?:\\.[0-9]+)?)" : "(?i)(?:bölüm|bolum|chapter|ch\\.?|episode|ep\\.?)\\s*([0-9]+(?:\\.[0-9]+)?)";
        try {
            Matcher m = Pattern.compile(rx).matcher(clean72(text, 900));
            return m.find() ? clean72(m.group(1), 40) : "";
        } catch (Throwable th) { return ""; }
    }

    private static String seriesName72(JSONObject item) {
        String explicit = clean72(item.optString("seriesName"), 300);
        if (!explicit.isEmpty()) return explicit;
        String st = clean72(item.optString("seriesTitle"), 300);
        String base = st.replaceFirst("(?i)\\s+(?:cilt|volume|vol\\.?)\\s*[0-9]+(?:\\.[0-9]+)?(?:\\s.*)?$", "").trim();
        if (!base.isEmpty()) return base;
        String title = clean72(item.optString("title"), 300);
        base = title.replaceFirst("(?i)\\s+(?:cilt|volume|vol\\.?|bölüm|bolum|chapter|ch\\.?|episode|ep\\.?)\\s*[0-9]+(?:\\.[0-9]+)?(?:\\s.*)?$", "").trim();
        return base.isEmpty() ? "Diğer" : base;
    }

    private static String volumeNo72(JSONObject item) {
        String v = clean72(item.optString("volumeNo"), 40);
        if (!v.isEmpty()) return v;
        return number72(item.optString("seriesTitle") + " " + item.optString("title"), "volume");
    }

    private static String chapterNo72(JSONObject item) {
        String v = clean72(item.optString("chapterNo"), 40);
        if (!v.isEmpty()) return v;
        return number72(item.optString("title"), "chapter");
    }

    private static String lang72(JSONObject item) {
        String l = clean72(item.optString("lang"), 10).toUpperCase(Locale.ROOT);
        if (l.equals("TR") || l.equals("EN") || l.equals("JP") || l.equals("KR") || l.equals("CN")) return l;
        try {
            Matcher m = Pattern.compile("(?i)(?:•|\\[|\\()\\s*(TR|EN|JP|KR|CN)(?:\\]|\\))?\\s*$").matcher(item.optString("title"));
            return m.find() ? m.group(1).toUpperCase(Locale.ROOT) : "";
        } catch (Throwable th) { return ""; }
    }

    private static String groupKey72(JSONObject item) {
        String series = seriesName72(item).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        String volume = volumeNo72(item);
        return series + "|v:" + (volume.isEmpty() ? "?" : volume);
    }

    private static JSONObject queueRoot72(Context context) {
        try {
            String raw = prefs(context).getString(QUEUE72, "{\"version\":1,\"items\":[]}");
            JSONObject root = new JSONObject(raw == null ? "{}" : raw);
            if (root.optJSONArray("items") == null) root.put("items", new JSONArray());
            root.put("version", 1);
            return root;
        } catch (Throwable th) {
            try { JSONObject root = new JSONObject(); root.put("version",1); root.put("items",new JSONArray()); return root; }
            catch (Throwable ignored) { return new JSONObject(); }
        }
    }

    private static void saveQueue72(Context context, JSONObject root) {
        if (context == null || root == null) return;
        try { prefs(context).edit().putString(QUEUE72, root.toString()).apply(); } catch (Throwable ignored) {}
    }

    private static JSONObject queueItem72(JSONObject src, String canon) {
        JSONObject q = new JSONObject();
        try {
            q.put("url", canon);
            q.put("title", clean72(src.optString("title"), 300));
            q.put("seriesTitle", clean72(src.optString("seriesTitle"), 300));
            q.put("seriesName", seriesName72(src));
            q.put("volumeNo", volumeNo72(src));
            q.put("chapterNo", chapterNo72(src));
            q.put("lang", lang72(src));
            q.put("kind", clean72(src.optString("kind", "chapter"), 40));
            q.put("groupKey", groupKey72(src));
            q.put("status", "waiting");
            q.put("done", 0);
            q.put("total", 0);
            q.put("message", "");
            q.put("updatedAt", System.currentTimeMillis());
        } catch (Throwable ignored) {}
        return q;
    }

    private static void mergeQueue72(Context context, String rawBatch) {
        if (context == null) return;
        synchronized (LOCK) {
            try {
                JSONObject root = queueRoot72(context);
                JSONArray old = root.optJSONArray("items");
                JSONArray incoming = new JSONArray(rawBatch == null ? "[]" : rawBatch);
                HashSet<String> fresh = new HashSet<String>();
                JSONArray add = new JSONArray();
                for (int i=0;i<incoming.length();i++) {
                    JSONObject src = incoming.optJSONObject(i); if (src == null) continue;
                    String canon = canonicalNava(src.optString("url")); if (canon == null || canon.isEmpty()) continue;
                    fresh.add(canon); add.put(queueItem72(src, canon));
                }
                JSONArray out = new JSONArray();
                if (old != null) for (int i=0;i<old.length();i++) {
                    JSONObject x = old.optJSONObject(i); if (x == null) continue;
                    if (!fresh.contains(x.optString("url"))) out.put(x);
                }
                for (int i=0;i<add.length();i++) out.put(add.optJSONObject(i));
                while (out.length() > 1200) {
                    JSONArray trim = new JSONArray();
                    for (int i=1;i<out.length();i++) trim.put(out.optJSONObject(i));
                    out = trim;
                }
                root.put("items", out); root.put("updatedAt", System.currentTimeMillis()); saveQueue72(context, root);
            } catch (Throwable ignored) {}
        }
    }

    private static void queueEvent72(Context context, JSONObject ev) {
        if (context == null || ev == null) return;
        synchronized (LOCK) {
            try {
                JSONObject root = queueRoot72(context);
                JSONArray arr = root.optJSONArray("items"); if (arr == null) return;
                String type = ev.optString("type");
                if (type.equals("batch-complete")) {
                    JSONArray keep = new JSONArray();
                    for (int i=0;i<arr.length();i++) {
                        JSONObject x=arr.optJSONObject(i); if (x==null) continue;
                        String st=x.optString("status");
                        if (!st.equals("done") && !st.equals("cancelled")) keep.put(x);
                    }
                    root.put("items",keep); root.put("updatedAt",System.currentTimeMillis()); saveQueue72(context,root); return;
                }
                String canon = canonicalNava(ev.optString("url")); if (canon == null || canon.isEmpty()) return;
                for (int i=0;i<arr.length();i++) {
                    JSONObject x=arr.optJSONObject(i); if (x==null || !canon.equals(x.optString("url"))) continue;
                    if (type.equals("start") || type.equals("progress")) x.put("status","active");
                    else if (type.equals("retry")) x.put("status","retry");
                    else if (type.equals("complete")) x.put("status","done");
                    else if (type.equals("error")) x.put("status","error");
                    else if (type.equals("cancelled") || type.equals("cancel-requested")) x.put("status","cancelled");
                    if (ev.has("done")) x.put("done",ev.optLong("done",0));
                    if (ev.has("total")) x.put("total",ev.optLong("total",0));
                    if (!ev.optString("message").isEmpty()) x.put("message",clean72(ev.optString("message"),300));
                    if (!ev.optString("title").isEmpty()) x.put("title",clean72(ev.optString("title"),300));
                    x.put("updatedAt",System.currentTimeMillis());
                    break;
                }
                root.put("updatedAt",System.currentTimeMillis()); saveQueue72(context,root);
            } catch (Throwable ignored) {}
        }
    }

    private static String publicQueue72(Context context) {
        try { return queueRoot72(context).toString(); } catch (Throwable th) { return "{\"version\":1,\"items\":[]}"; }
    }

    private static void applyMetadata72(Context context, String canon, JSONObject src) {
        if (context == null || canon == null || src == null) return;
        synchronized (LOCK) {
            try {
                JSONObject root = loadIndex(context); JSONObject hit = itemFor(root, canon); if (hit == null) return;
                hit.put("seriesName",seriesName72(src)); hit.put("volumeNo",volumeNo72(src)); hit.put("chapterNo",chapterNo72(src));
                hit.put("lang",lang72(src)); hit.put("groupKey",groupKey72(src)); saveIndex(context,root);
            } catch (Throwable ignored) {}
        }
    }

'''+needle
once(needle,helpers,'72 helpers')

once('''                        if (existing != null && pageFile(context, canon).isFile()) {\n                            ok++;''','''                        if (existing != null && pageFile(context, canon).isFile()) {\n                            applyMetadata72(context, canon, item);\n                            ok++;''','existing metadata')
once('''                    downloadOne71(context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));\n                    ok++;''','''                    downloadOne71(context, rawUrl, title, item.optString("seriesTitle"), item.optString("kind", "chapter"));\n                    applyMetadata72(context, canon, item);\n                    ok++;''','new metadata')

bridge='''        @JavascriptInterface\n        public String getDownloadQueue72() {\n            return OfflineRuntime.publicQueue72(this.context);\n        }\n\n        @JavascriptInterface\n        public void delete'''
once('''        @JavascriptInterface\n        public void delete''',bridge,'queue bridge')

for token in ('QUEUE72','mergeQueue72(ctx, str)','queueEvent72(app, jSONObject)','getDownloadQueue72','applyMetadata72(context, canon, item)','groupKey72','downloadOne71','NavaDownloadService70.enqueue'):
    if token not in s: raise ValueError('72 runtime token missing '+token)
Path(sys.argv[2]).write_text(s,encoding='utf-8')
print('OFFLINE_RUNTIME_72_SOURCE_PATCH_OK queue=native metadata=explicit progress=authoritative')
