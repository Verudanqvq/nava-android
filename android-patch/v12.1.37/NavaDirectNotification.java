package com.verudanava.nava;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.Map;

public final class NavaDirectNotification {
    public static final String CHANNEL = "nava_follower_releases_v4";
    private static final String PREF = "nava_notification_direct_v12137";
    private static final String SELF_TEST_KEY = "self_test_posted";

    private NavaDirectNotification() {}

    public static void ensure(Context context) {
        if (context == null) return;
        Context c = context.getApplicationContext();
        createChannel(c);
        try {
            SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            if (!p.getBoolean(SELF_TEST_KEY, false) && canNotify(c)) {
                post(c, "Nava bildirimleri hazır", "Bildirim sistemi etkin.", "https://www.verudanava.com/", "nava_self_test_12137");
                p.edit().putBoolean(SELF_TEST_KEY, true).putLong("last_local_test_at", System.currentTimeMillis()).apply();
            }
        } catch (Throwable ignored) {}
    }

    public static void handle(Context context, Object remoteMessage) {
        if (context == null) return;
        Context c = context.getApplicationContext();
        createChannel(c);
        String kind = "chapter";
        String series = "Takip ettiğin eser";
        String release = "Yeni bölüm yayımlandı";
        String url = "https://www.verudanava.com/";
        String notificationId = "nava_remote_" + System.currentTimeMillis();
        try {
            Map<?,?> data = readData(remoteMessage);
            if (data != null) {
                kind = value(data.get("kind"), kind);
                series = value(data.get("seriesTitle"), series);
                release = value(data.get("releaseTitle"), release);
                url = value(data.get("url"), url);
                notificationId = value(data.get("notificationId"), notificationId);
            }
            if ((release == null || release.trim().isEmpty()) && remoteMessage != null) {
                Object n = invoke(remoteMessage, "getNotification");
                if (n != null) {
                    release = value(invoke(n, "getBody"), release);
                    series = value(invoke(n, "getTitle"), series);
                }
            }
        } catch (Throwable ignored) {}

        String prefix = "volume".equalsIgnoreCase(kind) ? "Yeni cilt • " : "Yeni bölüm • ";
        String title = prefix + series;
        try {
            SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            p.edit()
                .putLong("last_fcm_received_at", System.currentTimeMillis())
                .putString("last_fcm_id", notificationId)
                .putString("last_fcm_title", title)
                .apply();
        } catch (Throwable ignored) {}
        if (canNotify(c)) post(c, title, release, url, notificationId);
    }

    private static Map<?,?> readData(Object remoteMessage) {
        try {
            Object value = invoke(remoteMessage, "getData");
            if (value instanceof Map) return (Map<?,?>) value;
        } catch (Throwable ignored) {}
        return Collections.emptyMap();
    }

    private static Object invoke(Object target, String method) {
        try {
            Method m = target.getClass().getMethod(method);
            m.setAccessible(true);
            return m.invoke(target);
        } catch (Throwable ignored) { return null; }
    }

    private static String value(Object v, String fallback) {
        String s = v == null ? "" : String.valueOf(v).trim();
        return s.isEmpty() ? fallback : s;
    }

    private static boolean canNotify(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && (Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled());
        } catch (Throwable ignored) { return false; }
    }

    private static void createChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Takip edilen eserler", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Takip ettiğin eserlerde yeni cilt ve bölüm bildirimleri");
            ch.enableVibration(true);
            ch.setShowBadge(true);
            nm.createNotificationChannel(ch);
        } catch (Throwable ignored) {}
    }

    private static void post(Context c, String title, String body, String url, String id) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Intent intent;
            try {
                Class<?> main = Class.forName("com.verudanava.nava.MainActivity");
                intent = new Intent(c, main);
                intent.setAction(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(url));
            } catch (Throwable e) {
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.setPackage(c.getPackageName());
            }
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getActivity(c, Math.abs(id.hashCode()), intent, flags);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
            b.setSmallIcon(android.R.drawable.stat_notify_more)
             .setContentTitle(title)
             .setContentText(body)
             .setStyle(new Notification.BigTextStyle().bigText(body))
             .setContentIntent(pi)
             .setAutoCancel(true)
             .setDefaults(Notification.DEFAULT_ALL)
             .setCategory(Notification.CATEGORY_SOCIAL);
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
            nm.notify(id.hashCode(), b.build());
            try { c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putLong("last_notify_posted_at", System.currentTimeMillis()).apply(); } catch (Throwable ignored) {}
        } catch (Throwable ignored) {}
    }
}
