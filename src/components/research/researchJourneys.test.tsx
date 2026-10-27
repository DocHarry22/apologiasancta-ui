import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixtures from "@/lib/knowledge/researchResponses.fixture.json";
import TimelinePage from "@/app/research/timeline/page";
import ComparePage from "@/app/research/compare/page";
import DebatePage from "@/app/research/debate/[argumentId]/page";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/content/ReportIssue", () => ({ ReportIssue: () => null }));
vi.mock("@/components/research/ResearchDiscovery", () => ({ default: () => null }));
vi.mock("@/components/research/CompareClaimsForm", () => ({ default: () => null }));
vi.mock("@/components/research/SaveKnowledgeJourneyButton", () => ({ default: (props: unknown) => { save(props); return <button>Save journey</button>; } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/lib/publicEnv", () => ({ getResearchGraphUrl: () => "https://graph.test" }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); save.mockClear(); });

describe.each([
  "https://engine.test",
  "https://project.supabase.co/functions/v1/knowledge-v2",
])("populated research journeys through %s", (base) => {
  function configure(payload: unknown) {
    vi.stubEnv("KNOWLEDGE_ENGINE_URL", base);
    vi.stubEnv("NEXT_PUBLIC_RESEARCH_GRAPH_URL", "https://graph.test");
    const fetchMock = vi.fn(async () => Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  it("renders dated events and retains canonical nodes for saving", async () => {
    const request = configure(fixtures.timeline);
    const html = renderToStaticMarkup(await TimelinePage({ searchParams: Promise.resolve({ domain: "history", from: "300", to: "350" }) }));
    expect(html).toContain("Council of Nicaea");
    expect(html).toContain("325-06-19");
    expect(html).toContain("1 provenance refs");
    expect(html).not.toContain("No dated published events");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ rootNodeId: "node:event", nodeIds: ["node:event"] }));
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.pathname).toBe(new URL(base).pathname.replace(/\/$/, "") + (base.includes("supabase") ? "/timeline" : "/knowledge/timeline"));
    expect(url.searchParams.get("domain")).toBe("history");
  });
  it("renders direct edges, shared context, assessments and the saved path", async () => {
    configure(fixtures.compare);
    const html = renderToStaticMarkup(await ComparePage({ searchParams: Promise.resolve({ left: "node:left", right: "node:right", lens: "catholic" }) }));
    for (const text of ["The first claim", "The second claim", "supports", "Shared definition", "affirmed", "defines", "interprets"]) expect(html).toContain(text);
    expect(html).not.toContain("No direct published edge");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ rootNodeId: "node:left", nodeIds: ["node:left", "node:right"] }));
  });
  it("renders the debate argument, authored objection and published response", async () => {
    configure(fixtures.debate);
    const html = renderToStaticMarkup(await DebatePage({ params: Promise.resolve({ argumentId: "argument:case" }) }));
    for (const text of ["A structured case", "deductive", "An authored objection", "A published response", "responds_to"]) expect(html).toContain(text);
    expect(html).not.toContain("Hidden response");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ rootNodeId: "node:left", nodeIds: expect.arrayContaining(["node:left", "node:objection", "node:response"]) }));
  });
  it("reports incompatible HTTP 200 responses instead of treating them as empty results", async () => {
    configure({ items: [] });
    const timeline = renderToStaticMarkup(await TimelinePage({ searchParams: Promise.resolve({ domain: "history" }) }));
    expect(timeline).toContain("Timeline unavailable");
    expect(timeline).toContain("incompatible research response");
    configure({ left: fixtures.compare.left, right: fixtures.compare.right, relationships: [] });
    const compare = renderToStaticMarkup(await ComparePage({ searchParams: Promise.resolve({ left: "node:left", right: "node:right" }) }));
    expect(compare).toContain("Comparison unavailable");
    configure({ id: "argument:case", title: "Old flat argument" });
    const debate = renderToStaticMarkup(await DebatePage({ params: Promise.resolve({ argumentId: "argument:case" }) }));
    expect(debate).toContain("Debate unavailable");
    expect(debate).toContain("incompatible research response");
    expect(save).not.toHaveBeenCalled();
  });
});
