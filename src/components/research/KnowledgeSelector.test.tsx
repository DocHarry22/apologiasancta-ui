// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import KnowledgeSelector from "./KnowledgeSelector";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const records = [{ id: "claim:incarnation", title: "The Incarnation", kind: "claim" }, { id: "claim:trinity", title: "The Trinity", kind: "claim" }];

it("allows an optional claim to be empty but requires a published selection after typing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: records }) }));
  render(<KnowledgeSelector label="Optional claim" name="nodeId" required={false} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  expect(input.checkValidity()).toBe(true);
  fireEvent.change(input, { target: { value: "Incarnation" } });
  expect(input.checkValidity()).toBe(false);
  await screen.findAllByRole("option");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.checkValidity()).toBe(true);
  fireEvent.change(input, { target: { value: "" } });
  expect(input.checkValidity()).toBe(true);
});

it("selects a title by keyboard while submitting its canonical ID, and clears the ID when edited", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: records }) }));
  const { container } = render(<KnowledgeSelector label="First claim" name="left" excludeId="claim:trinity" />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Incarnation" } });
  await screen.findByRole("option");
  expect(screen.queryByText("The Trinity")).toBeNull();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(document.getElementById(input.getAttribute("aria-activedescendant") || "")).toHaveTextContent("The Incarnation");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("The Incarnation");
  expect(container.querySelector('input[name="left"]')).toHaveValue("claim:incarnation");
  fireEvent.change(input, { target: { value: "Other claim" } });
  expect(container.querySelector('input[name="left"]')).toHaveValue("");
  expect((input as HTMLInputElement).validity.valid).toBe(false);
});

it("browses arguments without an ID and allows retry after an outage", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => ({ arguments: [{ id: "argument:historical", title: "Historical evidence" }] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<KnowledgeSelector label="Argument" name="argumentId" kind="argument" />);
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("button", { name: "Retry search" }));
  await screen.findByRole("option");
  expect(fetcher.mock.calls[1][0]).toContain("/api/knowledge/arguments?");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(screen.getByRole("combobox")).toHaveValue("Historical evidence");
});

it("ignores stale searches and closes the list with Escape", async () => {
  let resolveOld!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue({ ok: true, json: async () => ({ results: [records[1]] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<KnowledgeSelector label="Claim" name="left" />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Incarnation" } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "Trinity" } });
  await screen.findByText("The Trinity");
  await act(async () => resolveOld({ ok: true, json: async () => ({ results: [records[0]] }) }));
  expect(screen.queryByText("The Incarnation")).toBeNull();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
});
