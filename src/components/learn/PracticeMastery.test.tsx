// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MasteryExperience, PublishedPractice } from "./LearningPlatform";

const question = { questionId: "question-1", prompt: "Who is Jesus?", options: [{ optionId: "true-god", content: "True God and true man" }, { optionId: "teacher", content: "Only a teacher" }] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.restoreAllMocks());

it("checks practice answers on the server, locks the choice, and starts a fresh score", async () => {
  const user = userEvent.setup();
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (url === "/api/v1/learning/practice?limit=8") return json({ data: [question] });
    if (url === "/api/v1/learning/practice/check") {
      expect(JSON.parse(String(init?.body))).toEqual({ questionId: "question-1", optionId: "true-god" });
      return json({ data: { correct: true, explanation: "One person, two natures.", references: ["CCC 464"] } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<PublishedPractice />);
  expect(screen.getByText(/Practice scores do not grant official mastery/)).toBeVisible();
  await user.click(await screen.findByRole("button", { name: /True God and true man/ }));
  expect(await screen.findByText("One person, two natures.")).toBeVisible();
  expect(screen.getByRole("button", { name: /Only a teacher/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "See result" }));
  expect(screen.getByText("1 of 1")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Practice again" }));
  expect(screen.getByText("0 correct so far")).toBeVisible();
  expect(screen.getByRole("button", { name: /True God and true man/ })).toBeEnabled();
  expect(request.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("allows another choice after a failed practice check without awarding a point", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => url === "/api/v1/learning/practice?limit=8" ? json({ data: [question] }) : json({ error: "Connection lost. Try again." }, 503));
  render(<PublishedPractice />);
  await user.click(await screen.findByRole("button", { name: /True God and true man/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost. Try again.");
  expect(screen.getByRole("button", { name: /Only a teacher/ })).toBeEnabled();
  expect(screen.getByText("0 correct so far")).toBeVisible();
  expect(screen.queryByRole("button", { name: "See result" })).not.toBeInTheDocument();
});

it("submits every mastery answer with CSRF and shows only the confirmed server result", async () => {
  const user = userEvent.setup();
  const multiple = { questionId: "question-2", questionType: "multiple_choice", prompt: "Select both natures", options: [{ optionId: "divine", content: "Divine" }, { optionId: "human", content: "Human" }] };
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (url === "/api/v1/learning/groups/the-creed") return json({ data: { id: "group-1", title: "The Creed" } });
    if (url === "/api/auth/csrf") return json({ csrfToken: "csrf-test" });
    if (url === "/api/v1/learning/mastery/attempts") return json({ data: { attemptId: "attempt-1", questions: [question, multiple] } });
    if (url === "/api/v1/learning/mastery/attempts/attempt-1/submit") {
      expect(init?.headers).toMatchObject({ "x-csrf-token": "csrf-test" });
      expect(JSON.parse(String(init?.body))).toMatchObject({ answers: [{ questionId: "question-1", selectedOptionIds: ["true-god"] }, { questionId: "question-2", selectedOptionIds: ["divine", "human"] }] });
      return json({ data: { mastered: false, scorePercent: 62 } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<MasteryExperience groupSlug="the-creed" />);
  await user.click(await screen.findByRole("button", { name: "Start mastery attempt" }));
  const submit = await screen.findByRole("button", { name: "Submit for official scoring" });
  expect(submit).toBeDisabled();
  await user.click(screen.getByRole("radio", { name: "True God and true man" }));
  expect(submit).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "Divine" }));
  await user.click(screen.getByRole("checkbox", { name: "Human" }));
  expect(screen.getByText("2 of 2 questions answered")).toBeVisible();
  await user.click(submit);
  expect(await screen.findByRole("heading", { name: "Keep learning" })).toBeVisible();
  expect(screen.getByText("62%")).toBeVisible();
  expect(screen.getByText(/No new group was unlocked/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Start another attempt" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Start mastery attempt" })).toBeEnabled());
  expect(request.mock.calls.filter(([url]) => String(url).endsWith("/submit"))).toHaveLength(1);
});
