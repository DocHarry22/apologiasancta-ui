// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentLesson from "./AgentLesson";
import { fixture, sources } from "@/lib/agent/testFixtures";
const entry = {id:"pack",topic:"Faith",created_at:"2026-10-14",pack:fixture(),sources,review:{passed:true,issues:[],model:"fixture",reviewedAt:"2026-10-14"}};
afterEach(cleanup);
describe("lesson, practice quiz and evidence drawer", () => {
  it("shows explanation and evidence after a practice answer", () => {
    render(<AgentLesson entry={entry} />); fireEvent.click(screen.getAllByRole("radio")[0]); expect(screen.getByText("Correct.")).toBeTruthy();
    expect(screen.getAllByText("Study faith.").length).toBeGreaterThan(1);
  });
  it("opens a labelled evidence dialog with an original source link", () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function(this:HTMLDialogElement){this.setAttribute("open", "");});
    HTMLDialogElement.prototype.close = vi.fn(function(this:HTMLDialogElement){this.removeAttribute("open");});
    render(<AgentLesson entry={entry} />); fireEvent.click(screen.getAllByRole("button",{name:"View evidence"})[0]);
    expect(screen.getByRole("dialog",{name:"Evidence drawer"})).toBeTruthy(); expect(screen.getByRole("link",{name:/Read the original/}).getAttribute("href")).toBe(sources[0].url);
    fireEvent.click(screen.getByRole("button",{name:"Close evidence drawer"})); expect(screen.queryByRole("dialog")).toBeNull();
  });
});
