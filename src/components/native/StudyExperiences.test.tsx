// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseLesson, LearningCatalogue, LearningHierarchyPage } from "@/components/learn/LearningPlatform";
import { EngineTopicsList, type LibraryResource } from "@/components/library/EngineTopicsList";
import { EngineTopicDetails, type EngineTopicResponse } from "@/components/library/EngineTopicDetails";
import { LIBRARY_BOOKMARKS_KEY } from "@/lib/libraryBookmarks";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => null }));
vi.mock("@/components/content/ReportIssue", () => ({ ReportIssue: () => <button type="button">Report a correction</button> }));
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const programme = { id: "programme", slug: "foundations", title: "Foundations of the Faith", shortDescription: "Understand the Creed and Scripture.", visibility: "public" };
const programmes = [programme, { ...programme, id: "locked", slug: "locked", title: "Advanced theology", visibility: "locked" }, { ...programme, id: "soon", title: "Church history", visibility: "coming_soon" }, { ...programme, id: "hidden", title: "Unpublished", visibility: "hidden" }];
const resources: LibraryResource[] = [
  { id: "creed", title: "The Creed", description: "Explore what Catholics believe.", href: "/library/creed", format: "Question collection", category: "Doctrine", era: "General", tags: ["faith"], difficulty: 1, questionCount: 8, sourceCount: 4, durationMinutes: 6 },
  { id: "acts", title: "Acts of the Apostles", description: "Follow the early disciples.", href: "/library/acts", format: "Question collection", category: "Scripture", era: "Biblical", tags: ["bible"], difficulty: 3, questionCount: 12, sourceCount: 5, durationMinutes: 9 },
];
const topic: EngineTopicResponse = { id: "creed", title: "The Creed", questionCount: 2, questions: [
  { id: "q1", text: "What is the Creed?", themeTitle: "The Creed", difficulty: 1, choices: [{ id: "a", label: "A", text: "A profession of faith" }, { id: "b", label: "B", text: "A calendar" }] },
  { id: "q2", text: "How did the councils shape the Creed?", themeTitle: "The Creed", difficulty: 3, choices: [{ id: "a", label: "A", text: "An example choice" }] },
] };

beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(programmes))); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Learn browsing and reading", () => {
  it("combines search and availability without linking locked or unpublished content", async () => {
    const user = userEvent.setup();
    render(<LearningCatalogue />);
    expect(await screen.findByRole("link", { name: /Foundations of the Faith/ })).toHaveAttribute("href", "/learn/programmes/foundations");
    expect(screen.queryByRole("link", { name: /Advanced theology/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Unpublished")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Available", exact: true }));
    expect(screen.queryByText("Advanced theology")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search programmes" }), "not-found");
    expect(screen.getByText("A different path, perhaps?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("button", { name: "Coming soon", exact: true }));
    expect(screen.getByRole("heading", { name: "Church history" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: programme.title })).not.toBeInTheDocument();
  });

  it("retries a failed learning request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ error: "Unavailable" }, 503)).mockResolvedValueOnce(json([programme])));
    render(<LearningCatalogue />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load your lessons.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Foundations of the Faith/ })).toBeInTheDocument();
  });

  it("uses confirmed unlocks while leaving other groups locked", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/unlocks") ? json([{ groupId: "unlocked" }]) : json({ ...programme, groups: [
      { id: "unlocked", slug: "the-creed", title: "Understanding the Creed", visibility: "locked" },
      { id: "locked", slug: "advanced", title: "Advanced theology", visibility: "locked" },
    ] })));
    render(<LearningHierarchyPage kind="subject" slug="doctrine" />);
    expect(await screen.findByRole("link", { name: /Understanding the Creed/ })).toHaveAttribute("href", "/learn/groups/the-creed");
    expect(screen.queryByRole("link", { name: /Advanced theology/ })).not.toBeInTheDocument();
  });

  it("keeps lesson navigation, sources and server-confirmed completion working", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/csrf") return new Response(JSON.stringify({ csrfToken: "test-csrf" }));
      if (url.includes("/bookmarks")) return json([]);
      if (init?.method === "PUT") return json({});
      return json({ id: "lesson-1", slug: "the-creed", title: "Understanding the Creed", description: "Begin with the profession of faith.", sections: [{ id: "section", title: "The profession of faith", blocks: [{ type: "paragraph", text: "The Creed expresses our shared faith." }] }], sources: [{ title: "Catechism", url: "https://www.vatican.va/", kind: "Catechism" }], nextLesson: { slug: "scripture", title: "Sacred Scripture" } });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<DatabaseLesson slug="the-creed" />);
    expect(await screen.findByRole("heading", { name: "Understanding the Creed", level: 1 })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("In this lesson"));
    expect(screen.getByRole("link", { name: /The profession of faith/ })).toHaveAttribute("href", "#lesson-section-1");
    expect(screen.getByRole("link", { name: "Sacred Scripture" })).toHaveAttribute("href", "/learn/scripture");
    expect(screen.getByRole("link", { name: /Catechism Catechism/ })).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.setup().click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByRole("button", { name: "Completed" })).toBeDisabled();
    const call = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(call?.[0]).toBe("/api/v1/learning/lessons/lesson-1/progress");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ state: "completed", readingProgressPercent: 100, resumeLocator: null });
    expect(call?.[1]?.headers).toMatchObject({ "x-csrf-token": "test-csrf" });
  });
});

describe("Library discovery and saved items", () => {
  it("combines category, text and advanced filters and resets them", async () => {
    const user = userEvent.setup();
    render(<EngineTopicsList resources={resources} questionTotal={20} sourceTotal={9} />);
    await user.type(screen.getByRole("searchbox", { name: "Search the library" }), "bible");
    expect(screen.getByRole("heading", { name: "Acts of the Apostles" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The Creed" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Doctrine", exact: true }));
    expect(screen.getByText("No resources match.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    await user.click(screen.getByText("Refine your search"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "3");
    expect(screen.getByRole("heading", { name: "Acts of the Apostles" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The Creed" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 active/)).toBeInTheDocument();
  });

  it("saves on this device and immediately updates the Saved collection", async () => {
    const user = userEvent.setup();
    render(<EngineTopicsList resources={resources} questionTotal={20} sourceTotal={9} />);
    await user.click(screen.getByRole("button", { name: "Save The Creed" }));
    expect(JSON.parse(localStorage.getItem(LIBRARY_BOOKMARKS_KEY)!)).toEqual(["creed"]);
    await user.click(screen.getByRole("button", { name: /Saved 1/ }));
    expect(screen.getByRole("heading", { name: "The Creed" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Acts of the Apostles" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove The Creed" }));
    expect(screen.getByText("Keep a little inspiration close.")).toBeInTheDocument();
  });

  it("keeps browsing usable when device storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    render(<EngineTopicsList resources={resources} questionTotal={20} sourceTotal={9} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save The Creed" }));
    expect(screen.getByRole("button", { name: "Remove The Creed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("returns to a valid page after removing the last saved items on page two", async () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ ...resources[0], id: "item-" + index, title: "Collection " + index, href: "/library/item-" + index }));
    localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(items.map((item) => item.id)));
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    const user = userEvent.setup();
    render(<EngineTopicsList resources={items} questionTotal={96} sourceTotal={4} />);
    await user.click(screen.getByRole("button", { name: /Saved 12/ }));
    await user.click(screen.getByRole("button", { name: "Next", exact: true }));
    await user.click(screen.getByRole("button", { name: "Remove Collection 10" }));
    await user.click(screen.getByRole("button", { name: "Remove Collection 11" }));
    expect(screen.getByRole("heading", { name: "Collection 0", exact: true })).toBeInTheDocument();
    expect(screen.queryByText("No resources match.")).not.toBeInTheDocument();
  });

  it("shows bundled questions immediately and expands choices without revealing answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const user = userEvent.setup();
    render(<EngineTopicDetails topicId="creed" fallbackTopic={topic} />);
    expect(screen.getByRole("heading", { name: "The Creed", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("A profession of faith")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /What is the Creed/ }));
    expect(screen.getByText("A profession of faith")).toBeInTheDocument();
    expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open practice" })).toHaveAttribute("href", "/practice");
    await user.click(screen.getByText("Refine this collection"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "3");
    expect(screen.queryByRole("button", { name: /What is the Creed/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /How did the councils/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Bundled collection")).toBeInTheDocument());
  });
});
