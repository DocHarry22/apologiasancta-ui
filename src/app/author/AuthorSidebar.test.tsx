// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthorSidebar from "./AuthorSidebar";
import type { CurrentUser } from "@/lib/server/currentUser";

const state = vi.hoisted(() => ({ path: "/admin/learning/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/components/native/NativeHeader", () => ({ NativeHeader: () => <header>Apologia Sancta</header> }));
const user = { displayName: "Ada Staff", role: "super_admin", accountType: "staff" } as CurrentUser;

it("provides a collapsible staff menu with the active route and closes after selection", async () => {
  state.path = "/admin/learning/";
  render(<AuthorSidebar user={user} />);
  await userEvent.click(screen.getByText("Staff workspace", { selector: "summary span" }));
  const nav = screen.getByRole("navigation", { name: "Mobile staff navigation" });
  expect(within(nav).getByRole("link", { name: "Learning CMS" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  await userEvent.click(within(nav).getByRole("link", { name: "Learning CMS" }));
  expect(nav.closest("details")).not.toHaveAttribute("open");
});

it("preserves the author route family and excludes admin-only agent navigation", () => {
  state.path = "/author/review";
  render(<AuthorSidebar user={user} />);
  const nav = screen.getByRole("navigation", { name: "Staff navigation" });
  expect(within(nav).getByRole("link", { name: "Review" })).toHaveAttribute("href", "/author/review");
  expect(within(nav).queryByRole("link", { name: "Research Agent" })).not.toBeInTheDocument();
});

it("leaves the login screen to its own authentication shell", () => {
  state.path = "/admin/login";
  const { container } = render(<AuthorSidebar user={user} />);
  expect(container).toBeEmptyDOMElement();
});
