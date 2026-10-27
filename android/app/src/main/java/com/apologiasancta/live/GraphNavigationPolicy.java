package com.apologiasancta.live;

import java.net.URI;

/** Keeps the Graph frame inside the WebView without granting it native plugin access. */
public final class GraphNavigationPolicy {
    private final URI origin;

    public GraphNavigationPolicy(String configuredOrigin) {
        URI parsed = null;
        try {
            URI candidate = URI.create(configuredOrigin);
            String host = candidate.getHost();
            boolean localHttp = "http".equals(candidate.getScheme()) &&
                ("localhost".equals(host) || "127.0.0.1".equals(host) || "10.0.2.2".equals(host) || "[::1]".equals(host));
            if (host != null && candidate.getRawUserInfo() == null &&
                ("https".equals(candidate.getScheme()) || localHttp) &&
                (candidate.getPath().isEmpty() || "/".equals(candidate.getPath())) &&
                candidate.getRawQuery() == null && candidate.getRawFragment() == null) {
                parsed = candidate;
            }
        } catch (IllegalArgumentException | NullPointerException ignored) {
            // Missing or invalid origins do not enable extra navigation.
        }
        origin = parsed;
    }

    public boolean allows(String requestedUrl, boolean mainFrame) {
        if (mainFrame || origin == null || requestedUrl == null) return false;
        try {
            URI target = URI.create(requestedUrl);
            return target.getRawUserInfo() == null && origin.getScheme().equalsIgnoreCase(target.getScheme()) &&
                origin.getHost().equalsIgnoreCase(target.getHost()) && port(origin) == port(target);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static int port(URI uri) {
        return uri.getPort() >= 0 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }
}
