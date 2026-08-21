import android.content.DialogInterface;
import android.widget.Toast;
import com.verudanava.nava.MainActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/* Nava Android 12.1.60 — direct HTTPS updater click listener. */
public final class e00 implements DialogInterface.OnClickListener {
    private static final long MAX_APK_BYTES = 536870912L;
    private final h00 manager;
    private final g00 release;

    public e00(h00 manager, g00 release) {
        this.manager = manager;
        this.release = release;
    }

    @Override
    public void onClick(DialogInterface dialog, int which) {
        final MainActivity activity = manager.a;
        try {
            manager.a();
            manager.j = false;
            manager.k = false;
            Toast.makeText(activity, "Nava güncellemesi indiriliyor.", Toast.LENGTH_SHORT).show();
            manager.b.execute(new Runnable() {
                @Override
                public void run() {
                    download(activity);
                }
            });
        } catch (Throwable error) {
            showFailure(activity, error);
        }
    }

    private void download(final MainActivity activity) {
        File target = manager.f();
        HttpURLConnection connection = null;
        InputStream input = null;
        FileOutputStream output = null;
        try {
            URL url = new URL(release.c);
            if (!"https".equalsIgnoreCase(url.getProtocol()) || !"github.com".equalsIgnoreCase(url.getHost())) {
                throw new IOException("Güncelleme bağlantısı güvenilir değil.");
            }
            File parent = target.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.isDirectory()) {
                throw new IOException("Güncelleme klasörü oluşturulamadı.");
            }
            if (target.exists() && !target.delete()) {
                throw new IOException("Eski güncelleme dosyası silinemedi.");
            }

            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(60000);
            connection.setInstanceFollowRedirects(true);
            connection.setUseCaches(false);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", "Nava-Android/12.1.60");
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream,*/*;q=0.8");
            connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
            connection.setRequestProperty("Pragma", "no-cache");

            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IOException("HTTP " + code);
            }
            long expected = connection.getContentLengthLong();
            if (expected > MAX_APK_BYTES) {
                throw new IOException("Güncelleme dosyası çok büyük.");
            }

            input = connection.getInputStream();
            output = new FileOutputStream(target, false);
            byte[] buffer = new byte[65536];
            long total = 0L;
            while (true) {
                int read = input.read(buffer);
                if (read < 0) {
                    break;
                }
                if (read == 0) {
                    continue;
                }
                total += read;
                if (total > MAX_APK_BYTES) {
                    throw new IOException("Güncelleme dosyası çok büyük.");
                }
                output.write(buffer, 0, read);
            }
            output.flush();
            if (total <= 0L || !target.isFile() || target.length() <= 0L) {
                throw new IOException("Güncelleme dosyası boş geldi.");
            }
            if (expected > 0L && total != expected) {
                throw new IOException("Güncelleme eksik indirildi.");
            }

            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, "Güncelleme indirildi, doğrulanıyor…", Toast.LENGTH_SHORT).show();
                }
            });
            manager.g(target, release.d == null ? "" : release.d);
        } catch (Throwable error) {
            try {
                if (target.exists()) {
                    target.delete();
                }
            } catch (Throwable ignored) {
            }
            showFailure(activity, error);
        } finally {
            try {
                if (output != null) {
                    output.close();
                }
            } catch (Throwable ignored) {
            }
            try {
                if (input != null) {
                    input.close();
                }
            } catch (Throwable ignored) {
            }
            try {
                if (connection != null) {
                    connection.disconnect();
                }
            } catch (Throwable ignored) {
            }
        }
    }

    private static void showFailure(final MainActivity activity, final Throwable error) {
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String message = error == null ? "" : error.getMessage();
                    if (message == null || message.trim().isEmpty()) {
                        message = "Bilinmeyen hata";
                    }
                    Toast.makeText(activity, "Güncelleme indirilemedi: " + message, Toast.LENGTH_LONG).show();
                }
            });
        } catch (Throwable ignored) {
        }
    }
}
