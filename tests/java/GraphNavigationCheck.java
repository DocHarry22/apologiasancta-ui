import com.apologiasancta.live.GraphNavigationPolicy;

public final class GraphNavigationCheck {
    private static void expect(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
    }

    public static void main(String[] args) {
        GraphNavigationPolicy policy = new GraphNavigationPolicy("https://graph.example");
        expect(policy.allows("https://graph.example/graph?view=3d", false), "Graph iframe loads");
        expect(policy.allows("https://graph.example/graph/creed", false), "Graph record links stay embedded");
        expect(policy.allows("https://graph.example:443/advanced", false), "Equivalent default ports match");
        expect(!policy.allows("https://graph.example/graph", true), "Top-level links keep Capacitor's normal handling");
        expect(!policy.allows("https://source.example/passage", false), "External source links retain normal handling");
        expect(!policy.allows("https://graph.example.attacker.test/graph", false), "Host suffix is not an origin match");
        expect(!policy.allows("https://graph.example:8443/graph", false), "Different ports are different origins");
        expect(!policy.allows("http://graph.example/graph", false), "HTTPS cannot downgrade");
        expect(!policy.allows("https://user@graph.example/graph", false), "URL credentials are rejected");
        expect(!policy.allows("javascript:alert(1)", false), "Non-web schemes are rejected");
        expect(!new GraphNavigationPolicy("http://graph.example").allows("http://graph.example/graph", false), "Non-local HTTP is rejected");
        expect(!new GraphNavigationPolicy("https://graph.example/path").allows("https://graph.example/graph", false), "Config must be an origin");
        expect(!new GraphNavigationPolicy("").allows("https://graph.example/graph", false), "Missing config fails closed");
        expect(new GraphNavigationPolicy("http://127.0.0.1:4000").allows("http://127.0.0.1:4000/graph", false), "Local development origin works");
        expect(!new GraphNavigationPolicy(null).allows(null, false), "Null input fails closed");
        System.out.println("15 native Graph navigation checks passed.");
    }
}
