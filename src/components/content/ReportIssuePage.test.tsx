// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ReportIssuePage from "./ReportIssuePage";
import { PENDING_REPORT_KEY } from "./ReportIssue";

afterEach(() => { cleanup(); sessionStorage.clear(); window.history.replaceState(null, "", "/"); });

it("opens the original Graph claim and removes the handoff fragment", async () => {
  const pending = { target: { app: "graph", contentType: "claim", contentId: "claim:old", title: "Original graph claim", revisionId: "node_rev:old", snapshot: { proposition: "Original graph claim" } }, sourceUrl: "https://graph.example/graph?focus=claim%3Aold" };
  window.history.replaceState(null, "", `/report-issue#${new URLSearchParams({ report: JSON.stringify(pending) })}`);
  render(<ReportIssuePage />);
  expect(await screen.findByText("Original graph claim")).toBeInTheDocument();
  expect(window.location.hash).toBe("");
  expect(JSON.parse(sessionStorage.getItem(PENDING_REPORT_KEY)!)).toEqual(pending);
  expect(screen.getByText(/Revision: node_rev:old/)).toBeInTheDocument();
});

it("restores entered report details and reason after sign-in", async () => {
  sessionStorage.setItem(PENDING_REPORT_KEY, JSON.stringify({ target: { app: "learn", contentType: "lesson", contentId: "lesson:1", title: "A lesson", snapshot: { title: "A lesson", version: 2 } }, sourceUrl: "/learn/a-lesson", reason: "unfair_representation", details: "Please recheck the quoted context." }));
  render(<ReportIssuePage />);
  expect(await screen.findByLabelText("Reason")).toHaveValue("unfair_representation");
  expect(screen.getByLabelText(/Details/)).toHaveValue("Please recheck the quoted context.");
});

it("offers a useful empty state for malformed handoffs", async () => {
  window.history.replaceState(null, "", "/report-issue#report=invalid-json");
  render(<ReportIssuePage />);
  expect(await screen.findByText(/Open “Report an issue” on the question/)).toBeInTheDocument();
});
