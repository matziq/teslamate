package com.matziq.teslamatemobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.HttpAuthHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;

public class MainActivity extends Activity {
    private static final String HOST = "teslamate1111.westus.cloudapp.azure.com";
    private static final String START = "https://" + HOST + "/mobile/";
    private WebView web;

    private boolean trusted(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && ("/mobile".equals(uri.getPath()) || (uri.getPath() != null && uri.getPath().startsWith("/mobile/")));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(9, 17, 26));
        getWindow().setNavigationBarColor(Color.rgb(9, 17, 26));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(9, 17, 26));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri)) return false;
                if (request.isForMainFrame() && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                }
                return true;
            }

            @Override public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {
                if (!HOST.equalsIgnoreCase(host)) { handler.cancel(); return; }
                LinearLayout fields = new LinearLayout(MainActivity.this);
                fields.setOrientation(LinearLayout.VERTICAL);
                fields.setPadding(48, 8, 48, 0);
                EditText username = new EditText(MainActivity.this);
                username.setHint("Username");
                EditText password = new EditText(MainActivity.this);
                password.setHint("Password");
                password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
                fields.addView(username);
                fields.addView(password);
                new AlertDialog.Builder(MainActivity.this).setTitle("TeslaMate sign in")
                    .setMessage("Credentials are sent only to " + HOST + " over HTTPS.")
                    .setView(fields).setPositiveButton("Sign in", (dialog, which) -> handler.proceed(username.getText().toString(), password.getText().toString()))
                    .setNegativeButton("Cancel", (dialog, which) -> handler.cancel())
                    .setOnCancelListener(dialog -> handler.cancel()).show();
            }
        });
        setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl(START);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
