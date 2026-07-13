// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnswerList } from "./AnswerList";
import { CongratsOverlay } from "./CongratsOverlay";
import { MobileLeaderboardDrawer } from "./MobileLeaderboardDrawer";
import { QuestionCard } from "./QuestionCard";
import type { Choice, CongratsEvent, Leaderboard } from "@/types/quiz";

const choices: Choice[] = [
  { id: "A", label: "A", text: "First answer" },
  { id: "B", label: "B", text: "Second answer" },
  { id: "C", label: "C", text: "Third answer" },
  { id: "D", label: "D", text: "Fourth answer" },
];

const leaderboard: Leaderboard = {
  topScorers: [{ rank: 1, name: "Ada", score: 100 }],
  topStreaks: [{ rank: 1, name: "Ada", streak: 4 }],
};

describe("mobile gameplay reliability", () => {
  it("renders question and answer buttons", () => {
    render(
      <>
        <QuestionCard text="What is the answer?" />
        <AnswerList options={choices} phase="OPEN" />
      </>
    );

    expect(screen.getByText("What is the answer?")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("locks selected answer when phase is LOCKED", async () => {
    const onSelect = vi.fn();
    render(<AnswerList options={choices} selectedId="B" phase="LOCKED" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("radio", { name: /second answer/i }));

    expect(screen.getByRole("radio", { name: /second answer/i })).toHaveAttribute("aria-checked", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows correct answer in reveal state", () => {
    render(<AnswerList options={choices} selectedId="B" correctId="A" phase="REVEAL" />);

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /first answer/i })).toBeDisabled();
  });

  it("renders topic complete congrats overlay", () => {
    const event: CongratsEvent = {
      type: "congrats",
      topicId: "christology",
      topicTitle: "Christology",
      summary: {
        leaders: [{ rank: 1, name: "Ada", score: 100, streak: 4 }],
        topStreaks: [{ rank: 1, name: "Ada", score: 100, streak: 4 }],
        stats: { averageCorrectPct: 80, totalParticipants: 3, maxScore: 100, questionCount: 5 },
      },
      displayDurationMs: 5000,
      endsAtMs: Date.now() + 5000,
      nextTopicId: "trinity",
      nextTopicTitle: "Trinity",
      isSeriesComplete: false,
    };

    render(<CongratsOverlay event={event} prefersReducedMotion />);

    expect(screen.getByRole("dialog", { name: /topic complete celebration/i })).toBeInTheDocument();
    expect(screen.getByText("Christology")).toBeInTheDocument();
    expect(screen.getByText("Trinity")).toBeInTheDocument();
  });

  it("leaderboard drawer opens and closes through parent state", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open leaderboard</button>
          <MobileLeaderboardDrawer
            open={open}
            scorers={leaderboard.topScorers}
            streakers={leaderboard.topStreaks}
            selectedMode="room-all-time"
            onModeChange={vi.fn()}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);

    await user.click(screen.getByText("Open leaderboard"));
    const dialog = screen.getByRole("dialog", { name: /leaderboard/i });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /close leaderboard/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /leaderboard/i })).not.toBeInTheDocument();
    });
  });
});
