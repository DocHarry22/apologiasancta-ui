package com.apologiasancta.live;

import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public final class GraphWebViewClient extends BridgeWebViewClient {
    private final GraphNavigationPolicy graph;

    public GraphWebViewClient(Bridge bridge) {
        super(bridge);
        graph = new GraphNavigationPolicy(bridge.getConfig().getPluginConfiguration("GraphEmbed").getString("origin", ""));
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (graph.allows(request.getUrl().toString(), request.isForMainFrame())) return false;
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Deprecated
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        // API 23 does not identify subframes in this callback. The exact Graph
        // origin may load, but it is never added to Capacitor's plugin origins.
        if (graph.allows(url, false)) return false;
        return super.shouldOverrideUrlLoading(view, url);
    }
}
