package com.apologiasancta.live;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        // Draw behind the status bar and navigation bar (edge-to-edge)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
