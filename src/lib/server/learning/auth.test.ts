import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthorSession: vi.fn(),
  requireCsrf: vi.fn(),
  learningQuery: vi.fn(),
}));

vi.mock("@/lib/server/apiAuth", () => ({
  requireAuthorSession: mocks.requireAuthorSession,
  requireCsrf: mocks.requireCsrf,
}));
vi.mock("./database", () => ({ learningQuery: mocks.learningQuery }));

import { requireLearnerContext, requireStaffContext } from "./auth";

const request = () => new NextRequest("http://localhost/api/v1/admin/learning/programmes");

describe("learning authorization boundaries", () => {
  beforeEach(() => {
    mocks.requireAuthorSession.mockReset();
    mocks.requireCsrf.mockReset();
    mocks.learningQuery.mockReset();
    mocks.requireCsrf.mockResolvedValue(null);
  });

  it("returns the learning error envelope when no session exists", async () => {
    mocks.requireAuthorSession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "old shape" }, { status: 401 }),
    });
    const result = await requireStaffContext(request(), "learning:view");
    expect(result.ok).toBe(false);
    if (!result.ok) await expect(result.response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("does not let a public learner account cross the staff boundary", async () => {
    mocks.requireAuthorSession.mockResolvedValue({
      ok: true,
      user: {
        id: "external-public-subject",
        displayName: "Learner",
        role: "member",
        accountType: "public",
        source: "database",
      },
    });
    const result = await requireStaffContext(request(), "learning:view");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("requires CSRF on staff mutations", async () => {
    mocks.requireAuthorSession.mockResolvedValue({
      ok: true,
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "Editor",
        role: "editor",
        accountType: "staff",
        source: "database",
      },
    });
    mocks.requireCsrf.mockResolvedValue(NextResponse.json({ error: "failed" }, { status: 403 }));
    const result = await requireStaffContext(request(), "learning:manage", { mutation: true });
    expect(result.ok).toBe(false);
    if (!result.ok) await expect(result.response.json()).resolves.toMatchObject({
      error: { code: "csrf_failed" },
    });
  });

  it("maps custom session subjects to UUID learner profiles", async () => {
    mocks.requireAuthorSession.mockResolvedValue({
      ok: true,
      user: {
        id: "custom-provider-user-id",
        displayName: "Free Learner",
        role: "member",
        accountType: "public",
        source: "database",
      },
    });
    mocks.learningQuery.mockResolvedValue({ rows: [{
      id: "22222222-2222-4222-8222-222222222222",
      identity_provider: "apologia_session",
      external_subject: "custom-provider-user-id",
      display_name: "Free Learner",
      locale: "en",
      timezone: "UTC",
      settings: {},
      created_at: "2026-07-17T10:00:00.000Z",
      updated_at: "2026-07-17T10:00:00.000Z",
      last_seen_at: "2026-07-17T10:00:00.000Z",
    }] });

    const result = await requireLearnerContext(request());
    expect(result.ok).toBe(true);
    expect(String(mocks.learningQuery.mock.calls[0][0])).toContain("apologia_session");
    expect(String(mocks.learningQuery.mock.calls[0][0])).toContain("WHERE external_subject IS NOT NULL");
    expect(mocks.learningQuery.mock.calls[0][1]).toEqual(["custom-provider-user-id", "Free Learner"]);
  });
});
