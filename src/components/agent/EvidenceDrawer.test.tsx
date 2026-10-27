// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvidenceDrawer from "./EvidenceDrawer";

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [name, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
it("keeps evidence open through Strict Mode cleanup and retains source context", async () => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } },
  });
  const onClose = vi.fn();
  render(<StrictMode><EvidenceDrawer claim={{ id: "claim-1", text: "A source-backed claim.", classification: "interpretation", evidence: [{ sourceId: "source-1", locator: "Section 1", quote: "The original passage." }] }} sources={[{ id: "source-1", title: "Original source", kind: "external", url: "https://www.vatican.va/", retrievedAt: "2026-10-26T08:00:00Z", sha256: "a".repeat(64) }]} onClose={onClose} /></StrictMode>);
  expect(screen.getByRole("dialog", { name: "Evidence drawer" })).toHaveAttribute("open");
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText(/This material has not been reviewed by a human/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Read the original source/ })).toHaveAttribute("rel", "noopener noreferrer");
  await userEvent.click(screen.getByRole("button", { name: "Close evidence drawer" }));
  expect(onClose).toHaveBeenCalledOnce();
  onClose.mockClear();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(onClose).toHaveBeenCalledOnce();
});
