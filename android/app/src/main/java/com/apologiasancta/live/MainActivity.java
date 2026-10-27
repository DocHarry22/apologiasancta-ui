package com.apologiasancta.live;

import android.os.Bundle;
import android.view.View;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new GraphWebViewClient(getBridge()));
        // Android 15+ enforces edge-to-edge for our target SDK. Reserve the
        // system bars natively so every route is safe, even on WebViews that
        // do not expose CSS safe-area-inset values.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View content = findViewById(android.R.id.content);
        content.setBackgroundColor(ContextCompat.getColor(this, R.color.systemBarBackground));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), content);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        int left = content.getPaddingLeft();
        int top = content.getPaddingTop();
        int right = content.getPaddingRight();
        int bottom = content.getPaddingBottom();
        int safeTypes = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();

        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets safe = windowInsets.getInsets(safeTypes);
            view.setPadding(left + safe.left, top + safe.top, right + safe.right, bottom + safe.bottom);

            // The container has handled these insets. Zero them for the
            // WebView to avoid double spacing, while preserving IME insets
            // and dispatch so the keyboard can still resize its viewport.
            return new WindowInsetsCompat.Builder(windowInsets)
                .setInsets(safeTypes, Insets.NONE)
                .build();
        });
        ViewCompat.requestApplyInsets(content);
    }
}
