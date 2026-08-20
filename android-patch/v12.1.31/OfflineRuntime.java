package com.verudanava.nava;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class OfflineRuntime {
    private static final Object LOCK = new Object();
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();
    private static final String DIR = "nava_offline_v1";
    private static final String PREF = "nava_offline_prefs_v1";
    private static final String INDEX = "items.json";
    private static final String CHANNEL = "nava_follower_releases_v2";
    private static final long MAX_HTML = 16L * 1024L * 1024L;
    private static final long MAX_RESOURCE = 40L * 1024L * 1024L;
    private static final long MAX_PAGE_RESOURCES = 280L * 1024L * 1024L;
    private static final int MAX_RESOURCES = 700;

    private static final Pattern SCRIPT = Pattern.compile("(?is)<script\\b[^>]*>.*?</script\\s*>");
    private static final Pattern IFRAME = Pattern.compile("(?is)<iframe\\b[^>]*>.*?</iframe\\s*>");
    private static final Pattern SRC = Pattern.compile("(?is)(?:src|data-src|data-original|data-lazy-src)\\s*=\\s*[\"']([^\"'#]+)[\"']");
    private static final Pattern SRCSET = Pattern.compile("(?is)srcset\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern LINK = Pattern.compile("(?is)<link\\b[^>]*(?:rel\\s*=\\s*[\"'][^\"']*(?:stylesheet|icon)[^\"']*[\"'][^>]*href\\s*=\\s*[\"']([^\"']+)[\"']|href\\s*=\\s*[\"']([^\"']+)[\"'][^>]*rel\\s*=\\s*[\"'][^\"']*(?:stylesheet|icon)[^\"']*[\"'])[^>]*>");
    private static final Pattern CSS_URL = Pattern.compile("(?is)url\\(\\s*['\"]?([^'\")]+)['\"]?\\s*\\)");

    private static volatile Context app;
    private static volatile WeakReference<WebView> web = new WeakReference<>(null);
    private static volatile String forcedUrl = "";
    private static volatile String activeOfflineUrl = "";

    private OfflineRuntime() {}

    public static void attach(Context context, WebView webView) {
        if (context == null || webView == null) return;
        app = context.getApplicationContext();
        web = new WeakReference<>(webView);
        try { webView.addJavascriptInterface(new Bridge(app), "NavaOffline"); } catch (Throwable ignored) {}
        ensureNotificationChannel(app);
    }

    private static void ensureNotificationChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Takip edilen eserler", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Takip ettiğin eserlerde yeni cilt ve bölüm bildirimleri");
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        } catch (Throwable ignored) {}
    }

    public static WebResourceResponse intercept(Context context, WebResourceRequest request) {
        if (context == null || request == null || request.getUrl() == null) return null;
        try {
            String raw = stripFragment(request.getUrl().toString());
            String nava = canonicalNava(raw);
            if (request.isForMainFrame() && nava != null) {
                boolean forced = nava.equals(forcedUrl);
                boolean offline = !hasNetwork(context);
                File page = pageFile(context, nava);
                if ((forced || offline) && page.isFile()) {
                    forcedUrl = "";
                    activeOfflineUrl = nava;
                    return fileResponse(page, "text/html", "utf-8");
                }
                if (!forced) activeOfflineUrl = "";
                return null;
            }
            if (!activeOfflineUrl.isEmpty()) {
                File f = resourceFile(context, raw);
                if (f.isFile()) {
                    String mime = readSmall(resourceMimeFile(context, raw), "application/octet-stream");
                    return fileResponse(f, mime, isTextMime(mime) ? "utf-8" : null);
                }
            }
        } catch (Throwable ignored) {}
        return null;
    }

    private static WebResourceResponse fileResponse(File file, String mime, String encoding) {
        try { return new WebResourceResponse(mime, encoding, new FileInputStream(file)); }
        catch (Throwable ignored) { return null; }
    }

    private static boolean hasNetwork(Context context) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities c = cm.getNetworkCapabilities(n);
            return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Throwable ignored) { return false; }
    }

    private static boolean onWifi(Context context) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities c = cm.getNetworkCapabilities(n);
            return c != null && (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
        } catch (Throwable ignored) { return false; }
    }

    private static File root(Context c) { File f = new File(c.getFilesDir(), DIR); if (!f.exists()) f.mkdirs(); return f; }
    private static File pages(Context c) { File f = new File(root(c), "pages"); if (!f.exists()) f.mkdirs(); return f; }
    private static File resources(Context c) { File f = new File(root(c), "resources"); if (!f.exists()) f.mkdirs(); return f; }
    private static File index(Context c) { return new File(root(c), INDEX); }
    private static File pageFile(Context c, String url) { return new File(pages(c), sha(url) + ".html"); }
    private static File resourceFile(Context c, String url) { return new File(resources(c), sha(stripFragment(url)) + ".bin"); }
    private static File resourceMimeFile(Context c, String url) { return new File(resources(c), sha(stripFragment(url)) + ".mime"); }

    private static String sha(String value) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (byte x : d) b.append(String.format(Locale.ROOT, "%02x", x & 0xff));
            return b.toString();
        } catch (Throwable e) { return Integer.toHexString(String.valueOf(value).hashCode()); }
    }

    private static String stripFragment(String value) {
        if (value == null) return "";
        int i = value.indexOf('#');
        return i >= 0 ? value.substring(0, i) : value;
    }

    private static String canonicalNava(String value) {
        try {
            Uri u = Uri.parse(value);
            String scheme = u.getScheme();
            String host = u.getHost();
            if (scheme == null || host == null) return null;
            String h = host.toLowerCase(Locale.ROOT);
            if (!(h.equals("verudanava.com") || h.equals("www.verudanava.com") || h.equals("verudanava.blogspot.com"))) return null;
            if (!(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) return null;
            return u.buildUpon().scheme("https").authority("www.verudanava.com").fragment(null).build().toString();
        } catch (Throwable e) { return null; }
    }

    private static JSONObject loadIndex(Context c) {
        synchronized (LOCK) {
            try {
                File f = index(c);
                if (!f.isFile()) return freshIndex();
                JSONObject o = new JSONObject(readAllText(f, 6L * 1024L * 1024L));
                if (!o.has("items")) o.put("items", new JSONArray());
                return o;
            } catch (Throwable ignored) { return freshIndex(); }
        }
    }

    private static JSONObject freshIndex() {
        JSONObject o = new JSONObject();
        try { o.put("version", 1); o.put("items", new JSONArray()); } catch (Throwable ignored) {}
        return o;
    }

    private static void saveIndex(Context c, JSONObject o) throws Exception {
        synchronized (LOCK) {
            File f = index(c), tmp = new File(root(c), INDEX + ".tmp");
            writeBytes(tmp, o.toString().getBytes(StandardCharsets.UTF_8));
            if (f.exists() && !f.delete()) throw new Exception("Eski offline indeks silinemedi.");
            if (!tmp.renameTo(f)) throw new Exception("Offline indeks kaydedilemedi.");
        }
    }

    private static JSONObject itemFor(JSONObject idx, String url) {
        try {
            JSONArray a = idx.optJSONArray("items");
            if (a == null) return null;
            for (int i = 0; i < a.length(); i++) {
                JSONObject x = a.optJSONObject(i);
                if (x != null && url.equals(x.optString("url"))) return x;
            }
        } catch (Throwable ignored) {}
        return null;
    }

    private static JSONObject publicIndex(Context c) {
        JSONObject idx = loadIndex(c);
        try {
            idx.put("storageBytes", folderSize(root(c)));
            idx.put("wifiOnly", prefs(c).getBoolean("wifiOnly", true));
        } catch (Throwable ignored) {}
        return idx;
    }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    private static void downloadOne(Context c, String value, String title, String series, String kind) throws Exception {
        String url = canonicalNava(value);
        if (url == null) throw new Exception("Geçersiz Nava bağlantısı.");
        if (prefs(c).getBoolean("wifiOnly", true) && !onWifi(c)) throw new Exception("Yalnız Wi‑Fi indirmesi açık.");
        emit(event("start", url, title, ""));
        Fetch page = fetch(url, MAX_HTML);
        String html = decodeHtml(page.bytes, page.contentType);
        LinkedHashSet<String> queue = collectResources(url, html);
        LinkedHashSet<String> saved = new LinkedHashSet<>();
        long resourceBytes = 0;
        int processed = 0;
        List<String> pending = new ArrayList<>(queue);
        for (int cursor = 0; cursor < pending.size() && processed < MAX_RESOURCES; cursor++) {
            String resUrl = pending.get(cursor);
            if (resUrl == null || resUrl.isEmpty() || saved.contains(resUrl)) continue;
            processed++;
            File rf = resourceFile(c, resUrl), mf = resourceMimeFile(c, resUrl);
            if (rf.isFile() && mf.isFile()) {
                saved.add(resUrl); resourceBytes += rf.length(); continue;
            }
            try {
                Fetch r = fetch(resUrl, MAX_RESOURCE);
                if (!allowedResource(r.contentType, resUrl)) continue;
                if (resourceBytes + r.bytes.length > MAX_PAGE_RESOURCES) break;
                writeBytes(rf, r.bytes);
                writeBytes(mf, normalizeMime(r.contentType).getBytes(StandardCharsets.UTF_8));
                saved.add(resUrl); resourceBytes += r.bytes.length;
                if (normalizeMime(r.contentType).equals("text/css")) {
                    String css = new String(r.bytes, StandardCharsets.UTF_8);
                    for (String nested : collectCssResources(resUrl, css)) if (!queue.contains(nested)) { queue.add(nested); pending.add(nested); }
                }
            } catch (Throwable ignored) {}
            if ((processed % 12) == 0) emit(progressEvent(url, title, processed, Math.max(processed, pending.size())));
        }

        String cleaned = prepareOfflineHtml(url, html);
        File pf = pageFile(c, url);
        writeBytes(pf, cleaned.getBytes(StandardCharsets.UTF_8));
        JSONObject idx = loadIndex(c);
        JSONArray old = idx.optJSONArray("items"), next = new JSONArray();
        JSONObject item = new JSONObject();
        item.put("url", url);
        item.put("title", safe(title, 300, pageTitle(html)));
        item.put("seriesTitle", safe(series, 300, "Nava"));
        item.put("kind", safe(kind, 40, "chapter"));
        item.put("downloadedAt", System.currentTimeMillis());
        item.put("bytes", pf.length() + resourceBytes);
        JSONArray rr = new JSONArray(); for (String s : saved) rr.put(s); item.put("resources", rr);
        next.put(item);
        if (old != null) for (int i = 0; i < old.length(); i++) {
            JSONObject x = old.optJSONObject(i);
            if (x != null && !url.equals(x.optString("url"))) next.put(x);
        }
        idx.put("items", next);
        saveIndex(c, idx);
        pruneResources(c, idx);
        emit(event("complete", url, item.optString("title"), ""));
    }

    private static void deleteOne(Context c, String value) throws Exception {
        String url = canonicalNava(value);
        if (url == null) return;
        JSONObject idx = loadIndex(c);
        JSONArray old = idx.optJSONArray("items"), next = new JSONArray();
        if (old != null) for (int i = 0; i < old.length(); i++) {
            JSONObject x = old.optJSONObject(i);
            if (x != null && !url.equals(x.optString("url"))) next.put(x);
        }
        idx.put("items", next);
        File p = pageFile(c, url); if (p.exists()) p.delete();
        saveIndex(c, idx); pruneResources(c, idx);
        if (url.equals(activeOfflineUrl)) activeOfflineUrl = "";
        emit(event("deleted", url, "", ""));
    }

    private static void pruneResources(Context c, JSONObject idx) {
        try {
            Set<String> keep = new HashSet<>();
            JSONArray items = idx.optJSONArray("items");
            if (items != null) for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                JSONArray a = item.optJSONArray("resources"); if (a == null) continue;
                for (int j = 0; j < a.length(); j++) { String u = a.optString(j, ""); if (!u.isEmpty()) keep.add(sha(stripFragment(u))); }
            }
            File[] files = resources(c).listFiles(); if (files == null) return;
            for (File f : files) {
                String n = f.getName(); int dot = n.indexOf('.'); String key = dot > 0 ? n.substring(0, dot) : n;
                if (!keep.contains(key)) f.delete();
            }
        } catch (Throwable ignored) {}
    }

    private static String prepareOfflineHtml(String base, String html) {
        String out = SCRIPT.matcher(html).replaceAll("");
        out = IFRAME.matcher(out).replaceAll("");
        String inject = "<base href=\"" + escapeHtml(base) + "\"><meta name=\"nava-offline\" content=\"1\"><script>window.__NAVA_OFFLINE_PAGE__=true;</script><style>.adsbygoogle,ins.adsbygoogle,iframe{display:none!important}</style>";
        Matcher head = Pattern.compile("(?i)<head[^>]*>").matcher(out);
        if (head.find()) out = out.substring(0, head.end()) + inject + out.substring(head.end()); else out = inject + out;
        return out;
    }

    private static LinkedHashSet<String> collectResources(String base, String html) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        Matcher m = SRC.matcher(html); while (m.find()) addResolved(out, base, m.group(1));
        m = SRCSET.matcher(html); while (m.find()) for (String part : m.group(1).split(",")) { String[] p = part.trim().split("\\s+"); if (p.length > 0) addResolved(out, base, p[0]); }
        m = LINK.matcher(html); while (m.find()) addResolved(out, base, m.group(1) != null ? m.group(1) : m.group(2));
        m = CSS_URL.matcher(html); while (m.find()) addResolved(out, base, m.group(1));
        return out;
    }

    private static LinkedHashSet<String> collectCssResources(String base, String css) {
        LinkedHashSet<String> out = new LinkedHashSet<>(); Matcher m = CSS_URL.matcher(css); while (m.find()) addResolved(out, base, m.group(1)); return out;
    }

    private static void addResolved(Set<String> out, String base, String raw) {
        try {
            if (raw == null) return; raw = raw.trim();
            if (raw.isEmpty() || raw.startsWith("data:") || raw.startsWith("javascript:") || raw.startsWith("blob:")) return;
            URL u = new URL(new URL(base), raw); String s = stripFragment(u.toString());
            if (s.startsWith("https://") || s.startsWith("http://")) out.add(s);
        } catch (Throwable ignored) {}
    }

    private static boolean allowedResource(String ct, String url) {
        String m = normalizeMime(ct);
        if (m.startsWith("image/") || m.equals("text/css") || m.startsWith("font/") || m.contains("font-woff") || m.contains("font-ttf")) return true;
        String l = url.toLowerCase(Locale.ROOT);
        return l.matches(".*\\.(?:png|jpe?g|gif|webp|svg|avif|css|woff2?|ttf|otf)(?:\\?.*)?$");
    }

    private static String normalizeMime(String ct) {
        if (ct == null || ct.trim().isEmpty()) return "application/octet-stream";
        int i = ct.indexOf(';'); return (i >= 0 ? ct.substring(0, i) : ct).trim().toLowerCase(Locale.ROOT);
    }
    private static boolean isTextMime(String m) { return m != null && (m.startsWith("text/") || m.contains("json") || m.contains("xml") || m.contains("javascript")); }

    private static final class Fetch {
        final byte[] bytes; final String contentType;
        Fetch(byte[] b, String c) { bytes = b; contentType = c == null ? "application/octet-stream" : c; }
    }

    private static Fetch fetch(String value, long max) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(value).openConnection();
        con.setConnectTimeout(15000); con.setReadTimeout(35000); con.setInstanceFollowRedirects(true);
        con.setRequestProperty("User-Agent", "NavaAndroidApp/12.1.31 Offline");
        con.setRequestProperty("Accept", "text/html,application/xhtml+xml,image/avif,image/webp,image/*,text/css,*/*;q=0.8");
        con.setRequestProperty("Accept-Language", "tr-TR,tr;q=0.9,en;q=0.7");
        int code = con.getResponseCode();
        if (code < 200 || code >= 300) { con.disconnect(); throw new Exception("HTTP " + code); }
        InputStream in = con.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; long total = 0; int n;
        while ((n = in.read(buf)) != -1) { total += n; if (total > max) { in.close(); con.disconnect(); throw new Exception("Dosya çok büyük."); } out.write(buf, 0, n); }
        in.close(); String ct = con.getContentType(); con.disconnect(); return new Fetch(out.toByteArray(), ct);
    }

    private static String decodeHtml(byte[] data, String ct) {
        try {
            if (ct != null) {
                Matcher m = Pattern.compile("(?i)charset\\s*=\\s*([A-Za-z0-9._-]+)").matcher(ct);
                if (m.find()) return new String(data, java.nio.charset.Charset.forName(m.group(1)));
            }
        } catch (Throwable ignored) {}
        return new String(data, StandardCharsets.UTF_8);
    }

    private static String pageTitle(String html) {
        try { Matcher m = Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html); if (m.find()) return m.group(1).replaceAll("<[^>]+>", "").replace("&amp;", "&").trim(); } catch (Throwable ignored) {}
        return "Nava";
    }

    private static String safe(String v, int max, String fallback) { String s = v == null ? "" : v.trim(); if (s.isEmpty()) s = fallback; return s.length() > max ? s.substring(0, max) : s; }
    private static String escapeHtml(String s) { return s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;"); }

    private static JSONObject event(String type, String url, String title, String message) {
        JSONObject o = new JSONObject(); try { o.put("type", type); o.put("url", url == null ? "" : url); o.put("title", title == null ? "" : title); o.put("message", message == null ? "" : message); } catch (Throwable ignored) {} return o;
    }
    private static JSONObject progressEvent(String url, String title, int done, int total) {
        JSONObject o = event("progress", url, title, ""); try { o.put("done", done); o.put("total", total); } catch (Throwable ignored) {} return o;
    }

    private static void emit(final JSONObject event) {
        final WebView v = web.get(); if (v == null) return;
        v.post(new Runnable() { @Override public void run() { try { v.evaluateJavascript("window.navaOfflineNativeEvent&&window.navaOfflineNativeEvent(" + event.toString() + ");", null); } catch (Throwable ignored) {} } });
    }

    private static void writeBytes(File f, byte[] data) throws Exception {
        File p = f.getParentFile(); if (p != null && !p.exists()) p.mkdirs();
        FileOutputStream out = new FileOutputStream(f); out.write(data); out.flush(); out.close();
    }
    private static String readAllText(File f, long max) throws Exception { return new String(readBytes(f, max), StandardCharsets.UTF_8); }
    private static byte[] readBytes(File f, long max) throws Exception {
        FileInputStream in = new FileInputStream(f); ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] b = new byte[8192]; long t = 0; int n;
        while ((n = in.read(b)) != -1) { t += n; if (t > max) throw new Exception("Dosya çok büyük."); out.write(b, 0, n); } in.close(); return out.toByteArray();
    }
    private static String readSmall(File f, String fallback) { try { if (!f.isFile()) return fallback; return readAllText(f, 4096).trim(); } catch (Throwable ignored) { return fallback; } }
    private static long folderSize(File f) { if (f == null || !f.exists()) return 0; if (f.isFile()) return f.length(); long s = 0; File[] a = f.listFiles(); if (a != null) for (File x : a) s += folderSize(x); return s; }

    public static final class Bridge {
        private final Context context;
        Bridge(Context c) { context = c.getApplicationContext(); }

        @JavascriptInterface public String listDownloads() { return publicIndex(context).toString(); }
        @JavascriptInterface public boolean isDownloaded(String value) { String u = canonicalNava(value); return u != null && pageFile(context, u).isFile() && itemFor(loadIndex(context), u) != null; }
        @JavascriptInterface public boolean getWifiOnly() { return prefs(context).getBoolean("wifiOnly", true); }
        @JavascriptInterface public void setWifiOnly(boolean on) { prefs(context).edit().putBoolean("wifiOnly", on).apply(); emit(event("settings", "", "", "")); }

        @JavascriptInterface public void download(final String url, final String title, final String series, final String kind) {
            EXEC.execute(new Runnable() { @Override public void run() { try { downloadOne(context, url, title, series, kind); } catch (Throwable e) { emit(event("error", canonicalNava(url), title, safe(e.getMessage(), 300, "İndirme başarısız."))); } } });
        }

        @JavascriptInterface public void downloadBatch(final String json) {
            EXEC.execute(new Runnable() { @Override public void run() {
                int ok = 0, fail = 0;
                try {
                    JSONArray a = new JSONArray(json == null ? "[]" : json); JSONObject start = event("batch-start", "", "", ""); start.put("total", a.length()); emit(start);
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject x = a.optJSONObject(i); if (x == null) continue;
                        try { downloadOne(context, x.optString("url"), x.optString("title"), x.optString("seriesTitle"), x.optString("kind", "chapter")); ok++; }
                        catch (Throwable e) { fail++; emit(event("error", canonicalNava(x.optString("url")), x.optString("title"), safe(e.getMessage(), 300, "İndirme başarısız."))); }
                    }
                    JSONObject done = event("batch-complete", "", "", ""); done.put("ok", ok); done.put("failed", fail); emit(done);
                } catch (Throwable e) { emit(event("error", "", "", "Toplu indirme verisi okunamadı.")); }
            } });
        }

        @JavascriptInterface public void delete(final String url) { EXEC.execute(new Runnable() { @Override public void run() { try { deleteOne(context, url); } catch (Throwable e) { emit(event("error", canonicalNava(url), "", "Silinemedi.")); } } }); }

        @JavascriptInterface public void open(final String value) {
            final String url = canonicalNava(value); if (url == null || !pageFile(context, url).isFile()) return;
            forcedUrl = url; activeOfflineUrl = url; final WebView v = web.get(); if (v == null) return;
            v.post(new Runnable() { @Override public void run() { try { v.loadUrl(url); } catch (Throwable ignored) {} } });
        }
    }
}
