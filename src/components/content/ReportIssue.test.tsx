// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportIssue } from "./ReportIssue";
const target = { app: "quiz" as const, contentType: "question" as const, contentId: "q:old", title: "Original question", revisionId: "rev:old", snapshot: { prompt: "Original question", options: ["A", "B"] } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("reporting from displayed content", () => {
  it("freezes the original question even when a live round advances before submission", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "token" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "report:1", revisionId: "rev:old" }) });
    vi.stubGlobal("fetch", fetcher);
    const view = render(<ReportIssue {...target} />);
    await user.click(screen.getByRole("button", { name: /Report an issue with Original/ }));
    view.rerender(<ReportIssue {...target} contentId="q:new" title="Next question" revisionId="rev:new" snapshot={{ prompt: "Next question" }} />);
    await user.selectOptions(screen.getByLabelText("Reason"), "broken_citation");
    await user.type(screen.getByLabelText(/Details/), "The citation is unavailable.");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await screen.findByText("Report received");
    const submitted = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(submitted.target).toMatchObject({ contentId: "q:old", revisionId: "rev:old", snapshot: { prompt: "Original question" } });
    expect(submitted.reason).toBe("broken_citation");
    expect(fetcher.mock.calls[1][1].headers["x-csrf-token"]).toBe("token");
  });
  it("keeps failed reports editable and never shows success before persistence", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "token" }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Reports unavailable" }) }));
    render(<ReportIssue {...target} />);
    await user.click(screen.getByRole("button", { name: /Report an issue/ }));
    await user.type(screen.getByLabelText(/Details/), "Keep these details.");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reports unavailable");
    expect(screen.getByLabelText(/Details/)).toHaveValue("Keep these details.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled());
    expect(screen.queryByText("Report received")).not.toBeInTheDocument();
  });
});
