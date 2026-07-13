// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFeaturedTopics, TopicsScroll } from "./TopicsScroll";

const fallbackTopics = [
  { id: "genesis", title: "Genesis", questionCount: 90 },
  { id: "christology", title: "Christology", questionCount: 13 },
  { id: "atonement", title: "Atonement", questionCount: 1 },
];

describe("TopicsScroll", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("links directly to topic detail routes and uses accurate question wording", () => {
    render(<TopicsScroll topics={fallbackTopics} />);

    expect(screen.getByRole("link", { name: "Genesis, 90 questions" })).toHaveAttribute(
      "href",
      "/library/genesis",
    );
    expect(screen.getByRole("link", { name: "Atonement, 1 question" })).toHaveAttribute(
      "href",
      "/library/atonement",
    );
    expect(screen.queryByText(/articles/i)).not.toBeInTheDocument();
  });

  it("uses live counts and ranking while retaining curated titles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      topics: [
        { id: "christology", title: "christology", questionCount: 23 },
        { id: "genesis", title: "Genesis", questionCount: 91 },
        { id: "new_topic", title: "New Topic", questionCount: 40 },
      ],
    }), { status: 200 }));

    render(<TopicsScroll topics={fallbackTopics} engineUrl="https://engine.test" />);

    await waitFor(() => expect(screen.getByText("23 questions")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Christology, 23 questions" })).toHaveAttribute(
      "href",
      "/library/christology",
    );
    expect(screen.getByRole("link", { name: "New Topic, 40 questions" })).toHaveAttribute(
      "href",
      "/library/new_topic",
    );

    const names = screen.getAllByRole("link").map((link) => link.textContent);
    expect(names[0]).toMatch(/Genesis91 questions/);
    expect(names[1]).toMatch(/New Topic40 questions/);
  });

  it("keeps the bundled fallback when the live response is unavailable or malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ topics: null }), {
      status: 200,
    }));

    render(<TopicsScroll topics={fallbackTopics} engineUrl="https://engine.test" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());
    expect(screen.getByRole("link", { name: "Christology, 13 questions" })).toBeInTheDocument();
  });
});

describe("getFeaturedTopics", () => {
  it("sorts deterministically and caps the native carousel", () => {
    const topics = Array.from({ length: 8 }, (_, index) => ({
      id: `topic_${index}`,
      title: `Topic ${index}`,
      questionCount: index,
    }));

    expect(getFeaturedTopics(topics)).toHaveLength(6);
    expect(getFeaturedTopics(topics)[0]?.id).toBe("topic_7");
  });
});
