package com.verudanava.nava;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/** Nava Android 12.1.61 — native startup overlay without resource-table changes. */
public final class StartupOverlay61 {
    private static final String TAG = "nava-startup-v12161";

    private StartupOverlay61() {}

    private static int dp(Activity a, int value) {
        return Math.max(1, Math.round(value * a.getResources().getDisplayMetrics().density));
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) view;
            for (int i = 0; i < g.getChildCount(); i++) {
                WebView w = findWebView(g.getChildAt(i));
                if (w != null) return w;
            }
        }
        return null;
    }

    public static void install(Activity activity) {
        if (activity == null || activity.isFinishing()) return;
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        final ViewGroup root = (ViewGroup) content;
        if (root.findViewWithTag(TAG) != null) return;

        WebView web = findWebView(root);
        if (web != null) web.setVisibility(View.INVISIBLE);

        FrameLayout overlay = new FrameLayout(activity);
        overlay.setTag(TAG);
        overlay.setBackgroundColor(Color.parseColor("#C6DAFC"));
        overlay.setClickable(true);
        overlay.setFocusable(true);

        LinearLayout box = new LinearLayout(activity);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        box.setPadding(dp(activity, 24), dp(activity, 8), dp(activity, 24), dp(activity, 44));

        ImageView logo = new ImageView(activity);
        int icon = activity.getApplicationInfo().icon;
        if (icon != 0) logo.setImageResource(icon);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(activity, 88), dp(activity, 88));
        box.addView(logo, iconLp);

        TextView title = new TextView(activity);
        title.setText("Nava");
        title.setTextColor(Color.parseColor("#20334F"));
        title.setTextSize(22f);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = dp(activity, 14);
        box.addView(title, titleLp);

        TextView loading = new TextView(activity);
        loading.setText("Yükleniyor…");
        loading.setTextColor(Color.parseColor("#5C7394"));
        loading.setTextSize(12f);
        loading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams loadingLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        loadingLp.topMargin = dp(activity, 5);
        box.addView(loading, loadingLp);

        ProgressBar spinner = new ProgressBar(activity);
        spinner.setIndeterminate(true);
        LinearLayout.LayoutParams spinLp = new LinearLayout.LayoutParams(dp(activity, 28), dp(activity, 28));
        spinLp.topMargin = dp(activity, 16);
        box.addView(spinner, spinLp);

        FrameLayout.LayoutParams boxLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        overlay.addView(box, boxLp);
        root.addView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    public static void hide(Activity activity) {
        if (activity == null) return;
        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) return;
        ViewGroup root = (ViewGroup) content;
        WebView web = findWebView(root);
        if (web != null) web.setVisibility(View.VISIBLE);
        View overlay = root.findViewWithTag(TAG);
        if (overlay != null) root.removeView(overlay);
    }
}
