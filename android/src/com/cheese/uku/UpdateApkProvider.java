package com.cheese.uku;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

public class UpdateApkProvider extends ContentProvider {
    public static final String AUTHORITY = "com.cheese.uku.updates";
    public static final String APK_MIME = "application/vnd.android.package-archive";
    private static final Pattern APK_FILENAME_PATTERN = Pattern.compile("^Uku-Furigana-v[0-9.]+\\.apk$");
    private static final String[] DEFAULT_PROJECTION = {
            OpenableColumns.DISPLAY_NAME,
            OpenableColumns.SIZE
    };

    public static Uri buildUriForFile(String fileName) {
        return new Uri.Builder()
                .scheme("content")
                .authority(AUTHORITY)
                .appendPath("apk")
                .appendPath(fileName)
                .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode != null && !"r".equals(mode)) {
            throw new SecurityException("UpdateApkProvider is read-only");
        }
        File target = resolveVerifiedApkFile(uri);
        return ParcelFileDescriptor.open(target, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(
            Uri uri,
            String[] projection,
            String selection,
            String[] selectionArgs,
            String sortOrder
    ) {
        File target;
        try {
            target = resolveVerifiedApkFile(uri);
        } catch (FileNotFoundException e) {
            return null;
        }

        String[] columns = (projection != null) ? projection : DEFAULT_PROJECTION;
        String[] cols = new String[columns.length];
        Object[] values = new Object[columns.length];
        int count = 0;

        for (String col : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(col)) {
                cols[count] = OpenableColumns.DISPLAY_NAME;
                values[count++] = target.getName();
            } else if (OpenableColumns.SIZE.equals(col)) {
                cols[count] = OpenableColumns.SIZE;
                values[count++] = target.length();
            }
        }

        MatrixCursor cursor = new MatrixCursor(Arrays.copyOf(cols, count), 1);
        cursor.addRow(Arrays.copyOf(values, count));
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return APK_MIME;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("UpdateApkProvider does not support insert");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("UpdateApkProvider does not support update");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("UpdateApkProvider does not support delete");
    }

    private File resolveVerifiedApkFile(Uri uri) throws FileNotFoundException {
        Context context = getContext();
        if (context == null || uri == null || !AUTHORITY.equals(uri.getAuthority())) {
            throw new FileNotFoundException("Invalid URI authority");
        }

        List<String> segments = uri.getPathSegments();
        if (segments == null || segments.size() != 2 || !"apk".equals(segments.get(0))) {
            throw new FileNotFoundException("Invalid URI path");
        }

        String fileName = segments.get(1);
        if (fileName == null || !APK_FILENAME_PATTERN.matcher(fileName).matches()) {
            throw new FileNotFoundException("Rejected APK file name");
        }

        File updateDir = UpdateManager.getUpdateDir(context);
        File candidate = new File(updateDir, fileName);
        try {
            String dirCanonical = updateDir.getCanonicalPath();
            String fileCanonical = candidate.getCanonicalPath();
            String requiredPrefix = dirCanonical.endsWith(File.separator)
                    ? dirCanonical
                    : dirCanonical + File.separator;
            if (!fileCanonical.startsWith(requiredPrefix)) {
                throw new FileNotFoundException("Path traversal detected");
            }
        } catch (IOException e) {
            throw new FileNotFoundException("Failed to resolve canonical path");
        }

        if (!candidate.isFile()) {
            throw new FileNotFoundException("APK file not found");
        }
        return candidate;
    }
}
