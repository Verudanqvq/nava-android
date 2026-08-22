package com.verudanava.nava;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public final class NavaDownloadService63 extends Service {
    private static final String CHANNEL = "nava_downloads_v63";
    private static final int NOTIFICATION_ID = 6301;
    private int jobs = 0;
    private PowerManager.WakeLock wakeLock;

    public static void start(Context context, String batchJson) {
        if (context == null) return;
        Intent intent = new Intent(context, NavaDownloadService63.class);
        intent.setAction("com.verudanava.nava.DOWNLOAD_BATCH_63");
        intent.putExtra("batch", batchJson == null ? "[]" : batchJson);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
        else context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nava:OfflineDownload63");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Throwable ignored) {
        }
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Nava indirmeleri", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Çevrimdışı cilt ve bölüm indirmeleri");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        } catch (Throwable ignored) {
        }
    }

    private Notification notification() {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_sys_download)
         .setContentTitle("Nava")
         .setContentText("İndirme arka planda devam ediyor")
         .setOngoing(true)
         .setOnlyAlertOnce(true)
         .setCategory(Notification.CATEGORY_PROGRESS);
        return b.build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, final int startId) {
        String batch = intent == null ? null : intent.getStringExtra("batch");
        if (batch == null || batch.trim().isEmpty()) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        try {
            startForeground(NOTIFICATION_ID, notification());
        } catch (Throwable ignored) {
        }
        synchronized (this) {
            jobs++;
            try {
                if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire(6L * 60L * 60L * 1000L);
            } catch (Throwable ignored) {
            }
        }
        final String payload = batch;
        OfflineRuntime.submitBatch63(getApplicationContext(), payload, new Runnable() {
            @Override public void run() {
                finishJob(startId);
            }
        });
        return START_REDELIVER_INTENT;
    }

    private void finishJob(int startId) {
        boolean last;
        synchronized (this) {
            jobs = Math.max(0, jobs - 1);
            last = jobs == 0;
            if (last) {
                try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Throwable ignored) {}
            }
        }
        if (last) {
            try { stopForeground(true); } catch (Throwable ignored) {}
            stopSelf(startId);
        }
    }

    @Override
    public void onDestroy() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Throwable ignored) {}
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
