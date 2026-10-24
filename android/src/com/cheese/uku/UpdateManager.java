package com.cheese.uku;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Pattern;

public class UpdateManager {
    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 15_000;
    private static final long STALL_TIMEOUT_MS = 15_000L;
    private static final int MAX_REDIRECTS = 5;
    private static final Pattern VERSION_PATTERN = Pattern.compile("^[0-9.]+$");

    private static UpdateManager instance;

    private final Context appContext;
    private String phase = "idle";
    private double progress = 0.0;
    private String version = null;
    private String error = null;

    private long currentTaskId = 0L;
    private Thread downloadThread = null;
    private volatile HttpURLConnection activeConnection = null;

    private UpdateManager(Context context) {
        this.appContext = context.getApplicationContext();
    }

    public static synchronized UpdateManager getInstance(Context context) {
        if (instance == null) {
            instance = new UpdateManager(context);
        }
        return instance;
    }

    public static File getUpdateDir(Context context) {
        File dir = context.getExternalFilesDir("updates");
        if (dir == null) {
            dir = new File(context.getCacheDir(), "updates");
        }
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    public static String getApkFileName(String version) {
        return "Uku-Furigana-v" + version + ".apk";
    }

    public synchronized String getUpdateState() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("phase", phase);
            obj.put("progress", progress);
            if (version != null && !version.isEmpty()) {
                obj.put("version", version);
            }
            if (error != null && !error.isEmpty()) {
                obj.put("error", error);
            }
            return obj.toString();
        } catch (Exception e) {
            return "{\"phase\":\"error\",\"progress\":0,\"error\":\"state-serialize-error\"}";
        }
    }

    public synchronized String startUpdateDownload(String argsJson) {
        try {
            if (argsJson == null || argsJson.trim().isEmpty()) {
                return "{\"success\":false,\"error\":\"empty-args\"}";
            }
            JSONObject args = new JSONObject(argsJson);
            final String targetVersion = args.optString("version", "").trim();
            final String primaryUrl = args.optString("url", "").trim();
            final String mirrorUrl = args.optString("mirrorUrl", "").trim();
            final String expectedSha256 = args.optString("sha256", "").trim().toLowerCase(Locale.US);
            final long expectedSize = args.optLong("size", 0L);
            final boolean wifiOnly = args.optBoolean("wifiOnly", false);

            if (targetVersion.isEmpty() || !VERSION_PATTERN.matcher(targetVersion).matches()) {
                setStateLocked("error", 0.0, targetVersion, "invalid-version");
                return "{\"success\":false,\"error\":\"invalid-version\"}";
            }
            if (!isAllowedUrl(primaryUrl)) {
                setStateLocked("error", 0.0, targetVersion, "invalid-url");
                return "{\"success\":false,\"error\":\"invalid-url\"}";
            }
            if (!mirrorUrl.isEmpty() && !isAllowedUrl(mirrorUrl)) {
                setStateLocked("error", 0.0, targetVersion, "invalid-mirror-url");
                return "{\"success\":false,\"error\":\"invalid-mirror-url\"}";
            }
            if (!expectedSha256.matches("^[0-9a-f]{64}$")) {
                setStateLocked("error", 0.0, targetVersion, "invalid-sha256");
                return "{\"success\":false,\"error\":\"invalid-sha256\"}";
            }

            File updateDir = getUpdateDir(appContext);
            String apkName = getApkFileName(targetVersion);
            File finalFile = new File(updateDir, apkName);
            File partFile = new File(updateDir, apkName + ".part");

            // Idempotent check for the same version
            if (targetVersion.equals(this.version)) {
                if ("ready".equals(this.phase) && finalFile.isFile()) {
                    return "{\"success\":true}";
                }
                if ("downloading".equals(this.phase) && downloadThread != null && downloadThread.isAlive()) {
                    return "{\"success\":true}";
                }
            }

            // Stop any previous active download before starting a new one
            stopActiveDownloadLocked();

            // Clean up residual files from other versions
            cleanupOtherVersions(updateDir, apkName, partFile.getName());

            // Check metered network when wifiOnly is requested
            if (wifiOnly && isNetworkMetered()) {
                setStateLocked("error", 0.0, targetVersion, "metered-network");
                MainActivity.appendNativeLog(appContext, "updater error version=" + targetVersion + " reason=metered-network");
                return "{\"success\":true}";
            }

            final long taskId = ++currentTaskId;
            double initialProgress = 0.0;
            if (partFile.isFile() && expectedSize > 0) {
                initialProgress = Math.min(0.99, (double) partFile.length() / (double) expectedSize);
            }
            setStateLocked("downloading", initialProgress, targetVersion, null);

            downloadThread = new Thread(() -> runDownloadTask(
                    taskId,
                    targetVersion,
                    primaryUrl,
                    mirrorUrl.isEmpty() ? null : mirrorUrl,
                    expectedSha256,
                    expectedSize,
                    finalFile,
                    partFile
            ), "UkuUpdateDownloader-" + taskId);
            downloadThread.setDaemon(true);
            downloadThread.start();

            return "{\"success\":true}";
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "start-failed";
            return "{\"success\":false,\"error\":\"" + msg + "\"}";
        }
    }

    public synchronized String cancelUpdateDownload() {
        String cancelledVersion = this.version;
        stopActiveDownloadLocked();
        File updateDir = getUpdateDir(appContext);
        File[] files = updateDir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.getName().endsWith(".part")) {
                    f.delete();
                }
            }
        }
        setStateLocked("idle", 0.0, null, null);
        if (cancelledVersion != null) {
            MainActivity.appendNativeLog(appContext, "updater cancel version=" + cancelledVersion);
        }
        return "{\"success\":true}";
    }

    public synchronized String installUpdate(Context activityContext) {
        try {
            if (!"ready".equals(this.phase) || this.version == null || this.version.isEmpty()) {
                return "{\"success\":false,\"error\":\"not-ready\"}";
            }
            File apkFile = new File(getUpdateDir(appContext), getApkFileName(this.version));
            if (!apkFile.isFile()) {
                setStateLocked("error", 0.0, this.version, "file-missing");
                return "{\"success\":false,\"error\":\"file-missing\"}";
            }

            Context starter = activityContext != null ? activityContext : appContext;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !appContext.getPackageManager().canRequestPackageInstalls()) {
                Intent permIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + appContext.getPackageName())
                );
                if (!(starter instanceof android.app.Activity)) {
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                }
                starter.startActivity(permIntent);
                MainActivity.appendNativeLog(appContext,
                        "updater install version=" + this.version + " result=need-install-permission");
                return "{\"success\":false,\"error\":\"need-install-permission\"}";
            }

            Uri contentUri = UpdateApkProvider.buildUriForFile(apkFile.getName());
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(contentUri, UpdateApkProvider.APK_MIME);
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            starter.startActivity(installIntent);
            MainActivity.appendNativeLog(appContext, "updater install version=" + this.version + " result=started");
            return "{\"success\":true}";
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "install-failed";
            MainActivity.appendNativeLog(appContext, "updater install version=" + this.version + " result=error:" + msg);
            return "{\"success\":false,\"error\":\"" + msg + "\"}";
        }
    }

    private void runDownloadTask(
            long taskId,
            String targetVersion,
            String primaryUrl,
            String mirrorUrl,
            String expectedSha256,
            long expectedSize,
            File finalFile,
            File partFile
    ) {
        MainActivity.appendNativeLog(appContext, "updater start version=" + targetVersion + " url=" + primaryUrl);

        // If final file already exists from an earlier session, verify it first
        if (finalFile.isFile()) {
            if (verifySha256(finalFile, expectedSha256) && verifyPackageArchive(finalFile)) {
                updateReadyIfCurrent(taskId, targetVersion, expectedSha256);
                return;
            }
            finalFile.delete();
        }

        boolean downloaded = false;
        String lastError = "download-failed";

        try {
            downloadFromSource(taskId, targetVersion, primaryUrl, expectedSize, partFile);
            downloaded = true;
        } catch (Exception primaryEx) {
            if (isCancelled(taskId)) {
                return;
            }
            lastError = primaryEx.getMessage() != null ? primaryEx.getMessage() : "primary-failed";
            if (mirrorUrl != null && !mirrorUrl.isEmpty()) {
                MainActivity.appendNativeLog(appContext,
                        "updater switch-mirror version=" + targetVersion + " reason=" + sanitizeLogToken(lastError));
                try {
                    downloadFromSource(taskId, targetVersion, mirrorUrl, expectedSize, partFile);
                    downloaded = true;
                } catch (Exception mirrorEx) {
                    if (isCancelled(taskId)) {
                        return;
                    }
                    lastError = mirrorEx.getMessage() != null ? mirrorEx.getMessage() : "mirror-failed";
                }
            }
        }

        if (isCancelled(taskId)) {
            return;
        }

        if (!downloaded || !partFile.isFile()) {
            updateErrorIfCurrent(taskId, targetVersion, "network-error");
            MainActivity.appendNativeLog(appContext,
                    "updater error version=" + targetVersion + " reason=" + sanitizeLogToken(lastError));
            return;
        }

        // 1. Verify SHA-256
        if (!verifySha256(partFile, expectedSha256)) {
            partFile.delete();
            finalFile.delete();
            updateErrorIfCurrent(taskId, targetVersion, "checksum-mismatch");
            MainActivity.appendNativeLog(appContext,
                    "updater verify-fail version=" + targetVersion + " reason=checksum-mismatch");
            return;
        }

        // 2. Move .part to final APK filename and verify package archive info
        if (finalFile.exists()) {
            finalFile.delete();
        }
        if (!partFile.renameTo(finalFile)) {
            updateErrorIfCurrent(taskId, targetVersion, "rename-failed");
            MainActivity.appendNativeLog(appContext,
                    "updater error version=" + targetVersion + " reason=rename-failed");
            return;
        }

        if (!verifyPackageArchive(finalFile)) {
            finalFile.delete();
            partFile.delete();
            updateErrorIfCurrent(taskId, targetVersion, "invalid-package");
            MainActivity.appendNativeLog(appContext,
                    "updater verify-fail version=" + targetVersion + " reason=invalid-package");
            return;
        }

        updateReadyIfCurrent(taskId, targetVersion, expectedSha256);
    }

    private void downloadFromSource(
            long taskId,
            String targetVersion,
            String sourceUrl,
            long expectedSize,
            File partFile
    ) throws IOException {
        if (!isAllowedUrl(sourceUrl)) {
            throw new IOException("Only HTTPS URLs are allowed");
        }

        long existingBytes = partFile.isFile() ? partFile.length() : 0L;
        URL currentUrl = new URL(sourceUrl);
        HttpURLConnection conn = null;

        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                if (isCancelled(taskId)) {
                    throw new IOException("Cancelled");
                }
                if (!isAllowedUrl(currentUrl.toString())) {
                    throw new IOException("Non-HTTPS protocol rejected");
                }

                conn = (HttpURLConnection) currentUrl.openConnection();
                activeConnection = conn;
                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(READ_TIMEOUT_MS);
                conn.setRequestProperty("Accept-Encoding", "identity");
                if (existingBytes > 0) {
                    conn.setRequestProperty("Range", "bytes=" + existingBytes + "-");
                }

                int status = conn.getResponseCode();
                if (status == HttpURLConnection.HTTP_MOVED_PERM
                        || status == HttpURLConnection.HTTP_MOVED_TEMP
                        || status == HttpURLConnection.HTTP_SEE_OTHER
                        || status == 307
                        || status == 308) {
                    if (hop == MAX_REDIRECTS) {
                        throw new IOException("Too many redirects");
                    }
                    String location = conn.getHeaderField("Location");
                    conn.disconnect();
                    activeConnection = null;
                    if (location == null || location.trim().isEmpty()) {
                        throw new IOException("Redirect missing Location header");
                    }
                    URL nextUrl = new URL(currentUrl, location.trim());
                    if (!isAllowedUrl(nextUrl.toString())) {
                        throw new IOException("Redirect to non-HTTPS URL rejected");
                    }
                    currentUrl = nextUrl;
                    continue;
                }

                boolean append;
                long downloadedBytes;
                if (status == HttpURLConnection.HTTP_PARTIAL && existingBytes > 0) {
                    append = true;
                    downloadedBytes = existingBytes;
                } else if (status == HttpURLConnection.HTTP_OK) {
                    append = false;
                    downloadedBytes = 0L;
                } else {
                    throw new IOException("HTTP " + status);
                }

                long totalBytes = expectedSize;
                if (totalBytes <= 0) {
                    long contentLength = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                            ? conn.getContentLengthLong()
                            : conn.getContentLength();
                    if (contentLength > 0) {
                        totalBytes = append ? (existingBytes + contentLength) : contentLength;
                    }
                }

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(partFile, append)) {
                    byte[] buffer = new byte[16 * 1024];
                    long lastProgressAt = System.currentTimeMillis();
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        if (isCancelled(taskId)) {
                            throw new IOException("Cancelled");
                        }
                        long now = System.currentTimeMillis();
                        if (read == 0) {
                            if (now - lastProgressAt > STALL_TIMEOUT_MS) {
                                throw new IOException("Stalled for 15s");
                            }
                            continue;
                        }
                        out.write(buffer, 0, read);
                        downloadedBytes += read;
                        lastProgressAt = now;

                        if (totalBytes > 0) {
                            double prog = Math.min(0.99, (double) downloadedBytes / (double) totalBytes);
                            updateProgressIfCurrent(taskId, targetVersion, prog);
                        }
                    }
                    out.flush();
                }
                return;
            }
        } finally {
            activeConnection = null;
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    public static boolean verifySha256(File file, String expectedSha256) {
        if (file == null || !file.isFile() || expectedSha256 == null) {
            return false;
        }
        try (InputStream in = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[16 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) {
                digest.update(buffer, 0, n);
            }
            byte[] hash = digest.digest();
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format(Locale.US, "%02x", b & 0xff));
            }
            return expectedSha256.trim().toLowerCase(Locale.US).equals(hex.toString());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean verifyPackageArchive(File apkFile) {
        try {
            PackageManager pm = appContext.getPackageManager();
            PackageInfo archiveInfo = pm.getPackageArchiveInfo(apkFile.getAbsolutePath(), 0);
            if (archiveInfo == null || !"com.cheese.uku".equals(archiveInfo.packageName)) {
                return false;
            }
            PackageInfo currentInfo = pm.getPackageInfo(appContext.getPackageName(), 0);
            long archiveVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? archiveInfo.getLongVersionCode()
                    : archiveInfo.versionCode;
            long currentVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? currentInfo.getLongVersionCode()
                    : currentInfo.versionCode;
            return archiveVersionCode > currentVersionCode;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isNetworkMetered() {
        try {
            ConnectivityManager cm = (ConnectivityManager) appContext.getSystemService(Context.CONNECTIVITY_SERVICE);
            return cm != null && cm.isActiveNetworkMetered();
        } catch (Exception e) {
            return false;
        }
    }

    /** https only; a debuggable build (emulator test setup) may also fetch from the emulator's host loopback. */
    private boolean isAllowedUrl(String url) {
        if (isHttpsUrl(url)) {
            return true;
        }
        boolean debuggable = (appContext.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        return debuggable && url != null && url.toLowerCase(Locale.US).startsWith("http://10.0.2.2:");
    }

    private static boolean isHttpsUrl(String url) {
        if (url == null || !url.toLowerCase(Locale.US).startsWith("https://")) {
            return false;
        }
        try {
            URL parsed = new URL(url);
            return "https".equalsIgnoreCase(parsed.getProtocol())
                    && parsed.getHost() != null
                    && !parsed.getHost().isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    /** Deletes downloaded APKs this build already is (or is newer than) and leftover partial files. */
    public static void cleanupInstalled(Context context) {
        try {
            String installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
            File[] files = getUpdateDir(context).listFiles();
            if (installed == null || files == null) return;
            for (File file : files) {
                String name = file.getName();
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("^Uku-Furigana-v([0-9.]+)\\.apk(\\.part)?$").matcher(name);
                if (m.matches() && (m.group(2) != null || compareVersionNames(m.group(1), installed) <= 0)) {
                    file.delete();
                }
            }
        } catch (Exception ignored) {
            // leftover files are only wasted space
        }
    }

    private static int compareVersionNames(String a, String b) {
        String[] x = a.split("\\.");
        String[] y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length && x[i].matches("\\d+") ? Integer.parseInt(x[i]) : 0;
            int q = i < y.length && y[i].matches("\\d+") ? Integer.parseInt(y[i]) : 0;
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }

    private static void cleanupOtherVersions(File dir, String keepFinalName, String keepPartName) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            String name = file.getName();
            if (!name.equals(keepFinalName) && !name.equals(keepPartName)) {
                file.delete();
            }
        }
    }

    private static String sanitizeLogToken(String text) {
        if (text == null) return "unknown";
        return text.replace('\r', ' ').replace('\n', ' ').trim();
    }

    private synchronized boolean isCancelled(long taskId) {
        return taskId != currentTaskId || Thread.currentThread().isInterrupted();
    }

    private synchronized void updateProgressIfCurrent(long taskId, String targetVersion, double newProgress) {
        if (taskId == currentTaskId && "downloading".equals(this.phase)) {
            this.version = targetVersion;
            this.progress = newProgress;
        }
    }

    private synchronized void updateReadyIfCurrent(long taskId, String targetVersion, String sha256) {
        if (taskId == currentTaskId) {
            setStateLocked("ready", 1.0, targetVersion, null);
            MainActivity.appendNativeLog(appContext,
                    "updater verify-ok version=" + targetVersion + " sha256=" + sha256);
        }
    }

    private synchronized void updateErrorIfCurrent(long taskId, String targetVersion, String errCode) {
        if (taskId == currentTaskId) {
            setStateLocked("error", 0.0, targetVersion, errCode);
        }
    }

    private void stopActiveDownloadLocked() {
        currentTaskId++;
        if (downloadThread != null) {
            downloadThread.interrupt();
            downloadThread = null;
        }
        HttpURLConnection conn = activeConnection;
        if (conn != null) {
            try {
                conn.disconnect();
            } catch (Exception ignored) {
            }
            activeConnection = null;
        }
    }

    private void setStateLocked(String phase, double progress, String version, String error) {
        this.phase = phase;
        this.progress = progress;
        this.version = version;
        this.error = error;
    }
}
