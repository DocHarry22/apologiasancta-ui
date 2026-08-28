package com.apologiasancta.live;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String EXPECTED_PACKAGE = "com.apologiasancta.live";
    private static final String PLAY_INSTALLER = "com.android.vending";
    private static final String PLAY_WEB_URL = "https://play.google.com/store/apps/details?id=" + EXPECTED_PACKAGE;
    private static final String ASSET_API_PREFIX = "https://api.github.com/repos/DocHarry22/apologiasancta-ui/releases/assets/";
    private static final long MAX_APK_BYTES = 80L * 1024L * 1024L;
    private static final long VALIDATION_TTL_MS = 10L * 60L * 1000L;

    private String validatedAssetApiUrl;
    private String validatedSha256;
    private int validatedVersionCode = -1;
    private long validatedUntilMs = 0L;

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            PackageInfo info = packageManager.getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;

            JSObject result = new JSObject();
            result.put("packageName", getContext().getPackageName());
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("installerPackage", installerPackage(packageManager));
            result.put("nativeUpdaterAvailable", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read installed Android version", error);
        }
    }

    @PluginMethod
    public void validateUpdate(PluginCall call) {
        String packageName = call.getString("packageName");
        String assetApiUrl = call.getString("apkAssetApiUrl");
        String sha256 = call.getString("sha256");
        int versionCode = call.getData().optInt("versionCode", -1);

        if (!EXPECTED_PACKAGE.equals(packageName) || !EXPECTED_PACKAGE.equals(getContext().getPackageName())) {
            call.reject("Android update package identity mismatch");
            return;
        }
        if (!isSafeAssetApiUrl(assetApiUrl) || !isSha256(sha256) || versionCode < 1) {
            call.reject("Android update validation metadata is invalid");
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            if (PLAY_INSTALLER.equals(installerPackage(packageManager))) {
                clearValidatedCandidate();
                JSObject result = new JSObject();
                result.put("valid", true);
                result.put("destination", "play-store");
                call.resolve(result);
                return;
            }

            validateArchive(packageManager, assetApiUrl, sha256.toLowerCase(Locale.ROOT), versionCode);
            validatedAssetApiUrl = assetApiUrl;
            validatedSha256 = sha256.toLowerCase(Locale.ROOT);
            validatedVersionCode = versionCode;
            validatedUntilMs = System.currentTimeMillis() + VALIDATION_TTL_MS;

            JSObject result = new JSObject();
            result.put("valid", true);
            result.put("destination", "apk");
            call.resolve(result);
        } catch (Exception error) {
            clearValidatedCandidate();
            call.reject("Android update APK failed package/signature validation", error);
        }
    }

    @PluginMethod
    public void openUpdate(PluginCall call) {
        String packageName = call.getString("packageName");
        String apkUrl = call.getString("apkUrl");
        String releaseUrl = call.getString("releaseUrl");
        String assetApiUrl = call.getString("apkAssetApiUrl");
        String sha256 = call.getString("sha256");
        int versionCode = call.getData().optInt("versionCode", -1);

        if (!EXPECTED_PACKAGE.equals(packageName) || !EXPECTED_PACKAGE.equals(getContext().getPackageName())) {
            call.reject("Android update package identity mismatch");
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            Intent intent;
            String destination;
            if (PLAY_INSTALLER.equals(installerPackage(packageManager))) {
                destination = "play-store";
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + EXPECTED_PACKAGE));
                intent.setPackage(PLAY_INSTALLER);
                if (intent.resolveActivity(packageManager) == null) {
                    intent = new Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_WEB_URL));
                    destination = "play-store-web";
                }
            } else {
                if (!isSafeReleaseUrl(releaseUrl) || !isSafeAssetApiUrl(assetApiUrl) || !isSha256(sha256)) {
                    call.reject("Android update URL validation failed");
                    return;
                }
                if (!isSafeProxyUrl(apkUrl, assetApiUrl, sha256)) {
                    call.reject("Android update download must use the trusted app update proxy");
                    return;
                }
                if (
                    validatedAssetApiUrl == null ||
                    !validatedAssetApiUrl.equals(assetApiUrl) ||
                    validatedSha256 == null ||
                    !validatedSha256.equalsIgnoreCase(sha256) ||
                    validatedVersionCode != versionCode ||
                    System.currentTimeMillis() > validatedUntilMs
                ) {
                    call.reject("Android update must be validated before installation");
                    return;
                }
                destination = "verified-apk";
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("destination", destination);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to open Android update", error);
        }
    }

    private void validateArchive(PackageManager packageManager, String assetApiUrl, String expectedSha256, int expectedVersionCode) throws Exception {
        File candidate = File.createTempFile("apologia-update-", ".apk", getContext().getCacheDir());
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            HttpURLConnection connection = (HttpURLConnection) new URL(assetApiUrl).openConnection();
            try {
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(45000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "Apologia-Sancta-Android-Updater");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("GitHub release asset download failed");
                long contentLength = connection.getContentLengthLong();
                if (contentLength > MAX_APK_BYTES) throw new IllegalStateException("Android update APK exceeds size limit");

                long total = 0L;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(candidate)) {
                    byte[] buffer = new byte[32 * 1024];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_APK_BYTES) throw new IllegalStateException("Android update APK exceeds size limit");
                        digest.update(buffer, 0, read);
                        output.write(buffer, 0, read);
                    }
                }
                if (total < 1L) throw new IllegalStateException("Android update APK is empty");
            } finally {
                connection.disconnect();
            }

            String actualSha256 = hex(digest.digest());
            if (!actualSha256.equalsIgnoreCase(expectedSha256)) {
                throw new IllegalStateException("Android update APK digest mismatch");
            }

            int signingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
            PackageInfo installed = packageManager.getPackageInfo(EXPECTED_PACKAGE, signingFlags);
            PackageInfo archive = packageManager.getPackageArchiveInfo(candidate.getAbsolutePath(), signingFlags);
            if (archive == null || !EXPECTED_PACKAGE.equals(archive.packageName)) {
                throw new IllegalStateException("Android update APK package mismatch");
            }
            long installedVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? installed.getLongVersionCode()
                : installed.versionCode;
            long archiveVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? archive.getLongVersionCode()
                : archive.versionCode;
            if (archiveVersion != expectedVersionCode || archiveVersion <= installedVersion) {
                throw new IllegalStateException("Android update APK versionCode is not a newer expected version");
            }
            Set<String> installedSigners = signerDigests(installed);
            Set<String> archiveSigners = signerDigests(archive);
            boolean compatibleSigner = false;
            for (String signer : installedSigners) {
                if (archiveSigners.contains(signer)) {
                    compatibleSigner = true;
                    break;
                }
            }
            if (!compatibleSigner) {
                throw new IllegalStateException("Android update APK signing certificate does not match the installed app");
            }
        } finally {
            //noinspection ResultOfMethodCallIgnored
            candidate.delete();
        }
    }

    private Set<String> signerDigests(PackageInfo info) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
            signatures = info.signingInfo.hasMultipleSigners()
                ? info.signingInfo.getApkContentsSigners()
                : info.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = info.signatures;
        }
        Set<String> digests = new HashSet<>();
        if (signatures == null) return digests;
        for (Signature signature : signatures) {
            digests.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        }
        return digests;
    }

    private String installerPackage(PackageManager packageManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return packageManager.getInstallSourceInfo(EXPECTED_PACKAGE).getInstallingPackageName();
            }
            return packageManager.getInstallerPackageName(EXPECTED_PACKAGE);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isSafeAssetApiUrl(String value) {
        if (value == null || !value.startsWith(ASSET_API_PREFIX)) return false;
        String id = value.substring(ASSET_API_PREFIX.length());
        return id.matches("[1-9][0-9]{0,19}");
    }

    private boolean isSafeReleaseUrl(String value) {
        if (value == null) return false;
        try {
            Uri uri = Uri.parse(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"github.com".equalsIgnoreCase(uri.getHost())) return false;
            String path = uri.getPath();
            return path != null && path.matches("/DocHarry22/apologiasancta-ui/releases/tag/android-v[0-9A-Za-z._-]+");
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isSafeProxyUrl(String value, String assetApiUrl, String sha256) {
        if (value == null || bridge.getServerUrl() == null) return false;
        try {
            Uri candidate = Uri.parse(value);
            Uri server = Uri.parse(bridge.getServerUrl());
            if (!"https".equalsIgnoreCase(candidate.getScheme())) return false;
            if (!safeEquals(candidate.getScheme(), server.getScheme()) || !safeEquals(candidate.getHost(), server.getHost())) return false;
            int candidatePort = candidate.getPort() == -1 ? defaultPort(candidate.getScheme()) : candidate.getPort();
            int serverPort = server.getPort() == -1 ? defaultPort(server.getScheme()) : server.getPort();
            if (candidatePort != serverPort || !"/api/android/update/apk".equals(candidate.getPath())) return false;
            String assetId = assetApiUrl.substring(ASSET_API_PREFIX.length());
            return assetId.equals(candidate.getQueryParameter("assetId"))
                && sha256.equalsIgnoreCase(candidate.getQueryParameter("sha256"));
        } catch (Exception ignored) {
            return false;
        }
    }

    private int defaultPort(String scheme) {
        return "https".equalsIgnoreCase(scheme) ? 443 : 80;
    }

    private boolean safeEquals(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private boolean isSha256(String value) {
        return value != null && value.matches("(?i)[a-f0-9]{64}");
    }

    private String hex(byte[] value) {
        StringBuilder output = new StringBuilder(value.length * 2);
        for (byte item : value) output.append(String.format(Locale.ROOT, "%02x", item));
        return output.toString();
    }

    private void clearValidatedCandidate() {
        validatedAssetApiUrl = null;
        validatedSha256 = null;
        validatedVersionCode = -1;
        validatedUntilMs = 0L;
    }
}
