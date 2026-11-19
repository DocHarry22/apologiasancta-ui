// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRetryButton } from "./ResearchRetryButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("ResearchRetryButton", () => {
  beforeEach(() => refresh.mockReset());

  it("refreshes the current server-rendered research route", async () => {
    render(<ResearchRetryButton />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("supports contextual accessible labels", () => {
    render(<ResearchRetryButton label="Retry topics" />);

    expect(screen.getByRole("button", { name: "Retry topics" })).toBeEnabled();
  });
});
