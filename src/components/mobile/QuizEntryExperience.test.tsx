// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomSelectionModal } from "./RoomSelectionModal";
import { CountdownRing } from "./CountdownRing";
import { TeachingMomentCard } from "./TeachingMomentCard";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const rooms = [{ roomId: "parish", name: "Parish quiz", playerCount: 4, isActive: true }, { roomId: "closed", name: "Evening study", playerCount: 0, isActive: false }];

describe("quiz entry and feedback", () => {
  it("searches rooms and only allows an open room to be joined", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ rooms })));
    const select = vi.fn();
    const user = userEvent.setup();
    render(<RoomSelectionModal engineUrl="https://engine.test" onSelected={select} />);
    const heading = await screen.findByRole("heading", { name: "Parish quiz" });
    const openCard = heading.closest("div[class]")!;
    expect(screen.getByRole("button", { name: "Room is closed" })).toBeDisabled();
    await user.type(screen.getByRole("searchbox", { name: "Search rooms" }), "parish");
    expect(screen.queryByRole("heading", { name: "Evening study" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join room" }));
    expect(select).toHaveBeenCalledWith(rooms[0]);
    expect(openCard).toBeInTheDocument();
  });

  it("retries an unavailable room list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ rooms })));
    render(<RoomSelectionModal engineUrl="https://engine.test" onSelected={vi.fn()} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Parish quiz" })).toBeInTheDocument();
  });

  it("shows the correct phase in the compact timer and keeps teaching references available", async () => {
    const view = render(<CountdownRing endsAtMs={Date.now() + 30000} durationSeconds={30} phase="LOCKED" />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("Locked");
    view.rerender(<CountdownRing endsAtMs={Date.now() + 30000} durationSeconds={30} phase="REVEAL" />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("Reveal");
    view.unmount();
    render(<TeachingMomentCard defaultOpen={false} explanation="The council clarified the Church’s profession of faith." references={[{ label: "Catechism", value: "CCC 465" }]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Teaching Moment/ }));
    expect(screen.getByText("CCC 465", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("The council clarified the Church’s profession of faith.")).toBeInTheDocument();
    expect(within(document.body).getByRole("button", { name: /Hide/ })).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByText(/CCC 465/)).toBeInTheDocument());
  });
});
