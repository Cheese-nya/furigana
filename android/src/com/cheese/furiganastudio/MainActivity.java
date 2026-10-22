package com.cheese.furiganastudio;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final String VIRTUAL_HOST = "localhost";
    private static final String START_URL = "https://localhost/index.html";
    private static final String PIXIV_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    public class AndroidNativeBridge {
        @JavascriptInterface
        public String saveFile(String filename, String base64Data) {
            if (filename == null || filename.trim().isEmpty()) {
                filename = "furigana_export.txt";
            }
            final String safeName = filename.replaceAll("[\\\\/:*?\"<>|]", "_");
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String mimeType = guessMimeType(safeName);
                String savedLocation;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/FuriganaStudio");

                    ContentResolver resolver = getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        throw new IOException("Unable to create MediaStore Downloads entry");
                    }
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out == null) {
                            throw new IOException("Unable to open output stream");
                        }
                        out.write(bytes);
                        out.flush();
                    }
                    savedLocation = "Download/FuriganaStudio/" + safeName;
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "FuriganaStudio");
                    if (!dir.exists()) {
                        dir.mkdirs();
                    }
                    File outFile = new File(dir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    savedLocation = outFile.getAbsolutePath();
                }

                final String toastMsg = "已保存至: " + savedLocation;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, toastMsg, Toast.LENGTH_SHORT).show());
                return "{\"success\":true,\"path\":\"" + savedLocation.replace("\"", "\\\"") + "\"}";
            } catch (Exception e) {
                String err = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Save failed";
                return "{\"success\":false,\"error\":\"" + err + "\"}";
            }
        }

        @JavascriptInterface
        public void syncTheme(String bgHex, boolean isDark) {
            final String safeHex = (bgHex != null && bgHex.matches("^#[0-9a-fA-F]{6}$"))
                    ? bgHex
                    : (isDark ? "#000000" : "#F2F2F7");
            runOnUiThread(() -> applySystemBarAndWebViewTheme(safeHex, isDark));
        }
    }

    private boolean isSystemDark() {
        return (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    }

    private void pushSystemTheme() {
        if (webView != null) {
            webView.evaluateJavascript("window.__furiganaSystemDark=" + (isSystemDark() ? "true" : "false") + ";window.dispatchEvent(new Event('furigana-system-theme'));", null);
        }
    }

    private void applySystemBarAndWebViewTheme(String bgHex, boolean isDark) {
        int color;
        try {
            color = Color.parseColor(bgHex);
        } catch (IllegalArgumentException e) {
            color = Color.parseColor(isDark ? "#000000" : "#F2F2F7");
        }
        Window window = getWindow();
        if (window != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.view.View decorView = window.getDecorView();
                int flags = decorView.getSystemUiVisibility();
                if (!isDark) {
                    flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                } else {
                    flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!isDark) {
                        flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    } else {
                        flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                }
                decorView.setSystemUiVisibility(flags);
            }
        }
        if (webView != null) {
            webView.setBackgroundColor(color);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            window.requestFeature(Window.FEATURE_NO_TITLE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            }
        }

        webView = new WebView(this);
        webView.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        applySystemBarAndWebViewTheme(isSystemDark() ? "#000000" : "#F2F2F7", isSystemDark());
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new AndroidNativeBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                pushSystemTheme();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushSystemTheme();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) {
                    return super.shouldInterceptRequest(view, request);
                }

                String host = uri.getHost();
                String path = uri.getPath();
                if (host != null && host.equalsIgnoreCase(VIRTUAL_HOST)) {
                    if ("/api/pixiv-ajax".equals(path)) {
                        return handlePixivAjaxProxy(uri.getQueryParameter("id"));
                    }
                    if ("/api/pixiv-image".equals(path)) {
                        return handlePixivImageProxy(uri.getQueryParameter("url"));
                    }
                    return serveLocalAsset(path);
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String host = uri.getHost();
                if (host != null && host.equalsIgnoreCase(VIRTUAL_HOST)) {
                    return false;
                }
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                        return true;
                    } catch (ActivityNotFoundException ignored) {
                        return false;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && fileChooserParams != null) {
                    intent = fileChooserParams.createIntent();
                } else {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (ActivityNotFoundException e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // 朗读（TTS）已移除，应用无麦克风 / 摄像头用途：一律拒绝网页发起的权限请求。
                request.deny();
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private WebResourceResponse serveLocalAsset(String rawPath) {
        String cleanPath = (rawPath == null || rawPath.isEmpty() || "/".equals(rawPath))
                ? "index.html"
                : rawPath.replaceFirst("^/+", "");

        AssetManager assets = getAssets();
        InputStream stream = null;
        String resolvedPath = cleanPath;

        try {
            if (cleanPath.endsWith(".dat.gz")) {
                try {
                    stream = assets.open("www/" + cleanPath + ".bin");
                } catch (IOException ignored) {
                    stream = assets.open("www/" + cleanPath);
                }
            } else {
                try {
                    stream = assets.open("www/" + cleanPath);
                } catch (IOException e) {
                    if (!cleanPath.contains(".")) {
                        try {
                            resolvedPath = cleanPath + ".html";
                            stream = assets.open("www/" + resolvedPath);
                        } catch (IOException e2) {
                            resolvedPath = cleanPath + "/index.html";
                            stream = assets.open("www/" + resolvedPath);
                        }
                    } else {
                        throw e;
                    }
                }
            }

            String mimeType = guessMimeType(resolvedPath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-cache");

            WebResourceResponse response = new WebResourceResponse(mimeType, "UTF-8", stream);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                response.setResponseHeaders(headers);
            }
            return response;
        } catch (IOException e) {
            return createJsonResponse(404, "Not Found", "{\"error\":\"Asset not found\"}");
        }
    }

    private WebResourceResponse handlePixivAjaxProxy(String id) {
        if (id == null || !id.matches("^\\d{4,15}$")) {
            return createJsonResponse(400, "Bad Request", "{\"error\":true,\"message\":\"Invalid Pixiv ID\"}");
        }
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://www.pixiv.net/ajax/novel/" + id);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("User-Agent", PIXIV_UA);
            conn.setRequestProperty("Referer", "https://www.pixiv.net/");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Accept-Language", "ja,zh-CN;q=0.9,en;q=0.8");

            int status = conn.getResponseCode();
            InputStream in = (status >= 200 && status < 400) ? conn.getInputStream() : conn.getErrorStream();
            byte[] bytes = readAllBytes(in);
            String body = new String(bytes, StandardCharsets.UTF_8);
            return createJsonResponse(status >= 200 && status < 300 ? 200 : status, "OK", body);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Network error";
            return createJsonResponse(502, "Bad Gateway", "{\"error\":true,\"message\":\"" + msg + "\"}");
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private WebResourceResponse handlePixivImageProxy(String imageUrl) {
        if (imageUrl == null || !imageUrl.startsWith("https://")) {
            return createJsonResponse(400, "Bad Request", "{\"error\":\"Invalid image URL\"}");
        }
        HttpURLConnection conn = null;
        try {
            URL url = new URL(imageUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("User-Agent", PIXIV_UA);
            conn.setRequestProperty("Referer", "https://www.pixiv.net/");

            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                String contentType = conn.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) {
                    contentType = "image/jpeg";
                }
                byte[] bytes = readAllBytes(conn.getInputStream());
                String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                String json = "{\"dataUrl\":\"data:" + contentType + ";base64," + b64 + "\"}";
                return createJsonResponse(200, "OK", json);
            }
            return createJsonResponse(status, "Error", "{\"error\":\"Image fetch failed\"}");
        } catch (Exception e) {
            return createJsonResponse(502, "Bad Gateway", "{\"error\":\"Image proxy exception\"}");
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private WebResourceResponse createJsonResponse(int statusCode, String reason, String jsonBody) {
        ByteArrayInputStream stream = new ByteArrayInputStream(jsonBody.getBytes(StandardCharsets.UTF_8));
        WebResourceResponse response = new WebResourceResponse("application/json", "UTF-8", stream);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");
            response.setStatusCodeAndReasonPhrase(statusCode, reason != null && !reason.isEmpty() ? reason : "OK");
            response.setResponseHeaders(headers);
        }
        return response;
    }

    private static byte[] readAllBytes(InputStream in) throws IOException {
        if (in == null) return new byte[0];
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = in.read(chunk)) != -1) {
            buffer.write(chunk, 0, n);
        }
        return buffer.toByteArray();
    }

    private static String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".srt")) return "application/x-subrip";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".dat.gz") || lower.endsWith(".bin") || lower.endsWith(".gz")) {
            return "application/octet-stream";
        }
        String ext = MimeTypeMap.getFileExtensionFromUrl(lower);
        if (ext != null) {
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            if (mime != null) return mime;
        }
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                }
                if (results == null && data.getDataString() != null) {
                    results = new Uri[]{Uri.parse(data.getDataString())};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        pushSystemTheme();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }
}
