// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthResponse, PersistenceStatus } from "@/lib/engineAdmin";
import EngineHealthPanel, {
  getEngineHealthStatus,
  getPersistenceEvidenceState,
} from "./EngineHealthPanel";

const healthCheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/engineAdmin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engineAdmin")>();
  return { ...actual, checkHealth: healthCheck };
});

const persistence = (overrides: Partial<PersistenceStatus> = {}): PersistenceStatus => ({
  configured: true,
  path: "postgresql:runtime_state_snapshots",
  savePending: false,
  lastSavedAt: null,
  lastRestoredAt: null,
  lastRestoreSucceeded: false,
  ...overrides,
});

const health = (persistenceStatus: PersistenceStatus): HealthResponse => ({
  ok: true,
  time: "2026-11-19T02:00:00.000Z",
  uptime: 120,
  clients: 0,
  rooms: { total: 1, active: 1 },
  persistence: persistenceStatus,
});

describe("Engine persistence health presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not treat configuration alone as persistence evidence", () => {
    expect(getPersistenceEvidenceState(persistence())).toBe("unverified");
    expect(getPersistenceEvidenceState(persistence({ savePending: true }))).toBe("unverified");
    expect(getPersistenceEvidenceState(persistence({ lastRestoredAt: Date.now() }))).toBe("unverified");
    expect(getEngineHealthStatus(true, "unverified")).toBe("degraded");
  });

  it("accepts a successful save or restore as durability evidence", () => {
    expect(getPersistenceEvidenceState(persistence({ lastSavedAt: Date.now() }))).toBe("verified");
    expect(getPersistenceEvidenceState(persistence({ lastRestoreSucceeded: true }))).toBe("verified");
    expect(getEngineHealthStatus(true, "verified")).toBe("healthy");
    expect(getEngineHealthStatus(false, "verified")).toBe("unhealthy");
  });

  it("renders a restart-risk warning for the live configured-but-unverified state", async () => {
    healthCheck.mockResolvedValue({ success: true, data: health(persistence()) });

    render(<EngineHealthPanel engineUrl="https://engine.example.test" />);

    expect(await screen.findByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Configured, unverified")).toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();
    expect(screen.getByText("Persistence Target")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Runtime state may not survive a restart");
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("renders healthy persistence only after a successful save is reported", async () => {
    healthCheck.mockResolvedValue({
      success: true,
      data: health(persistence({ lastSavedAt: Date.now() })),
    });

    render(<EngineHealthPanel engineUrl="https://engine.example.test" />);

    expect(await screen.findByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
