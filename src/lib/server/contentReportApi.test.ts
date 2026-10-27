import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), csrf: vi.fn(), rate: vi.fn(), submit: vi.fn(), list: vi.fn(), review: vi.fn() }));
vi.mock("./apiAuth", () => ({ requireAuthorSession: mocks.auth, requireCsrf: mocks.csrf, safeJson: (body: unknown, status = 200) => NextResponse.json(body, { status }) }));
vi.mock("@/lib/auth/rateLimit", () => ({ checkContentReportRateLimit: mocks.rate }));
vi.mock("./storage/contentReportStore", () => ({ submitContentReport: mocks.submit, listContentReports: mocks.list, reviewContentReport: mocks.review, ReportInputError: class extends Error {}, ReportConflictError: class extends Error {} }));
import { listReportsRoute, reviewReportRoute, submitReportRoute } from "./contentReportApi";

function request(method = "POST", body = "{}") { return new NextRequest("http://localhost/api/content-reports", { method, ...(method === "GET" ? {} : { body }) }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, user: { id: "reader", role: "member" } });
  mocks.csrf.mockResolvedValue(null); mocks.rate.mockReturnValue({ allowed: true });
  mocks.submit.mockResolvedValue({ id: "report:1", target: { revisionId: "revision:1" } });
  mocks.list.mockResolvedValue([]);
});
describe("content report API access", () => {
  it("requires authentication and CSRF before accepting feedback", async () => {
    mocks.auth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await submitReportRoute(request())).status).toBe(401);
    mocks.csrf.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await submitReportRoute(request())).status).toBe(403);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("lets learners submit while keeping the editorial queue private", async () => {
    const response = await submitReportRoute(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: "report:1", revisionId: "revision:1" });
    expect((await listReportsRoute(request("GET"))).status).toBe(403);
    expect((await reviewReportRoute(request("PATCH"), "report:1")).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled();
  });
  it("rate limits submission and rejects malformed bodies", async () => {
    mocks.rate.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 100 });
    expect((await submitReportRoute(request())).status).toBe(429);
    expect((await submitReportRoute(request("POST", "invalid"))).status).toBe(400);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("allows reviewers to inspect and triage, with CSRF and not-found handling", async () => {
    mocks.auth.mockResolvedValue({ ok: true, user: { id: "editor", role: "reviewer" } });
    expect((await listReportsRoute(request("GET"))).status).toBe(200);
    mocks.review.mockResolvedValueOnce(null);
    expect((await reviewReportRoute(request("PATCH"), "missing")).status).toBe(404);
    mocks.csrf.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await reviewReportRoute(request("PATCH"), "report:1")).status).toBe(403);
    expect(mocks.review).toHaveBeenCalledTimes(1);
  });
});
