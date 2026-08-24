package com.apologiasancta.live;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String EXPECTED_PACKAGE = "com.apologiasancta.live";

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            PackageInfo info = packageManager.getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;

            String installerPackage = null;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    installerPackage = packageManager
                        .getInstallSourceInfo(getContext().getPackageName())
                        .getInstallingPackageName();
                } else {
                    installerPackage = packageManager.getInstallerPackageName(getContext().getPackageName());
                }
            } catch (Exception ignored) {
                // Installer identity is advisory only; update checks still work without it.
            }

            JSObject result = new JSObject();
            result.put("packageName", getContext().getPackageName());
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("installerPackage", installerPackage);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read installed Android version", error);
        }
    }

    @PluginMethod
    public void openUpdate(PluginCall call) {
        String packageName = call.getString("packageName");
        String apkUrl = call.getString("apkUrl");
        String releaseUrl = call.getString("releaseUrl");

        if (!EXPECTED_PACKAGE.equals(packageName) || !EXPECTED_PACKAGE.equals(getContext().getPackageName())) {
            call.reject("Android update package identity mismatch");
            return;
        }
        if (!isSafeHttpsUrl(apkUrl) || !isSafeHttpsUrl(releaseUrl)) {
            call.reject("Android update URL must use an approved HTTPS GitHub host");
            return;
        }

        try {
            PackageManager packageManager = getContext().getPackageManager();
            String installerPackage = null;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    installerPackage = packageManager
                        .getInstallSourceInfo(getContext().getPackageName())
                        .getInstallingPackageName();
                } else {
                    installerPackage = packageManager.getInstallerPackageName(getContext().getPackageName());
                }
            } catch (Exception ignored) {
                // Sideloaded installs commonly have no installer package.
            }

            Intent intent;
            String destination;
            if ("com.android.vending".equals(installerPackage)) {
                destination = "play-store";
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + EXPECTED_PACKAGE));
                intent.setPackage("com.android.vending");
                if (intent.resolveActivity(packageManager) == null) {
                    intent = new Intent(Intent.ACTION_VIEW, Uri.parse(releaseUrl));
                    destination = "release-page";
                }
            } else {
                // For direct APK distribution, hand the signed APK to the user's trusted browser.
                // The browser/package installer owns the download/install permission. Android itself
                // enforces matching package identity, signing key and a higher versionCode before
                // replacing the currently installed application, preventing duplicate installs.
                destination = "apk";
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

    private boolean isSafeHttpsUrl(String value) {
        if (value == null || value.trim().isEmpty()) return false;
        try {
            Uri uri = Uri.parse(value);
            if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase();
            return host.equals("github.com")
                || host.equals("api.github.com")
                || host.endsWith(".githubusercontent.com");
        } catch (Exception ignored) {
            return false;
        }
    }
}
