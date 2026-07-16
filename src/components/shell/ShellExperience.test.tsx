// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GraphPromoBanner } from "./GraphPromoBanner";
import { AppHeader } from "./AppHeader";
import { MobileBottomNavigation } from "./MobileBottomNavigation";

const navigation = vi.hoisted(() => ({ pathname: "/learn" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/lib/publicEnv", () => ({ getResearchGraphUrl: () => "https://graph.example.test" }));

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
}

describe("unified application shell", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-theme-preference"); installMatchMedia(false); });

  it("uses system theme for a first visit and persists an explicit toggle", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    const toggle = await screen.findByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(toggle);
    await waitFor(() => expect(localStorage.getItem("apologia-sancta-theme")).toBe("light"));
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("marks the active route in desktop and mobile navigation", () => {
    render(<ThemeProvider><AppHeader /><MobileBottomNavigation /></ThemeProvider>);
    expect(screen.getAllByRole("link", { name: "Learn" }).every((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("dismisses the external Graph promotion for the persistence window", async () => {
    const user = userEvent.setup();
    render(<GraphPromoBanner />);
    const link = await screen.findByRole("link", { name: /open graph/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(screen.getByRole("button", { name: /dismiss apologia graph/i }));
    expect(screen.queryByLabelText("Apologia Graph announcement")).not.toBeInTheDocument();
    expect(Number(localStorage.getItem("apologia-graph-promo-dismissed-at"))).toBeGreaterThan(0);
  });
});
