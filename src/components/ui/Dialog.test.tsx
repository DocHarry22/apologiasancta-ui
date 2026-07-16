// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      {open ? (
        <Dialog titleId="test-dialog-title" onClose={() => setOpen(false)}>
          <h2 id="test-dialog-title">Accessible dialog</h2>
          <button type="button" onClick={() => setOpen(false)}>Close dialog</button>
          <button type="button">Second action</button>
        </Dialog>
      ) : null}
    </>
  );
}

describe("Dialog", () => {
  afterEach(() => { document.body.style.overflow = ""; });

  it("traps focus, closes with Escape, and restores the trigger", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Accessible dialog" });
    const close = screen.getByRole("button", { name: "Close dialog" });
    const second = screen.getByRole("button", { name: "Second action" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(close).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    second.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
});
