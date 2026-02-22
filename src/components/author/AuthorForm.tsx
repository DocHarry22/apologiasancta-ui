"use client";

import { useMemo } from "react";
import type { Question, QuestionChoiceId } from "@/types/content";

interface Props {
  formData: Partial<Question>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Question>>>;
  nextQuestionId: string;
  onDownload: () => void;
  onCopy: () => void;
  onAddToQueue: () => void;
  onReset: () => void;
}

interface ValidationError {
  field: string;
  message: string;
}

const MAX_REF_LENGTH = 140;

export default function AuthorForm({
  formData,
  setFormData,
  nextQuestionId,
  onDownload,
  onCopy,
  onAddToQueue,
  onReset,
}: Props) {
  const errors = useMemo<ValidationError[]>(() => {
    const errs: ValidationError[] = [];

    if (!formData.question?.trim()) {
      errs.push({ field: "question", message: "Question text is required" });
    }

    const choices = formData.choices || { A: "", B: "", C: "", D: "" };
    if (!choices.A?.trim()) errs.push({ field: "choiceA", message: "Choice A is required" });
    if (!choices.B?.trim()) errs.push({ field: "choiceB", message: "Choice B is required" });
    if (!choices.C?.trim()) errs.push({ field: "choiceC", message: "Choice C is required" });
    if (!choices.D?.trim()) errs.push({ field: "choiceD", message: "Choice D is required" });

    const correctId = formData.correctId || "A";
    if (!["A", "B", "C", "D"].includes(correctId)) {
      errs.push({ field: "correctId", message: "Correct answer must be A, B, C, or D" });
    }

    if (!formData.teaching?.title?.trim()) {
      errs.push({ field: "teachingTitle", message: "Teaching title is required" });
    }

    if (!formData.teaching?.body?.trim()) {
      errs.push({ field: "teachingBody", message: "Teaching body is required" });
    }

    const refs = formData.teaching?.refs || [];
    if (refs.length < 2) {
      errs.push({ field: "teachingRefs", message: "At least 2 references are required" });
    }

    // Check for long refs
    refs.forEach((ref, i) => {
      if (ref.length > MAX_REF_LENGTH) {
        errs.push({ field: `ref${i}`, message: `Reference ${i + 1} is too long (${ref.length}/${MAX_REF_LENGTH} chars)` });
      }
    });

    return errs;
  }, [formData]);

  const hasError = (field: string) => errors.some((e) => e.field === field);
  const getError = (field: string) => errors.find((e) => e.field === field)?.message;

  const isValid = errors.length === 0;

  const updateChoice = (key: QuestionChoiceId, value: string) => {
    setFormData((prev) => ({
      ...prev,
      choices: {
        ...prev.choices,
        A: prev.choices?.A || "",
        B: prev.choices?.B || "",
        C: prev.choices?.C || "",
        D: prev.choices?.D || "",
        [key]: value,
      },
    }));
  };

  const updateTeaching = (key: keyof Question["teaching"], value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      teaching: {
        title: prev.teaching?.title || "",
        body: prev.teaching?.body || "",
        refs: prev.teaching?.refs || [],
        [key]: value,
      },
    }));
  };

  const handleRefsChange = (value: string) => {
    // Support both newlines and commas as separators
    const refs = value
      .split(/[\n,]/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    updateTeaching("refs", refs);
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    setFormData((prev) => ({ ...prev, tags }));
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
      hasError(field)
        ? "border-(--wrong) focus:border-(--wrong)"
        : "border-(--border) focus:border-(--accent)"
    } bg-background`;

  const labelClass = "text-xs font-medium text-(--muted)";

  return (
    <section className="rounded-xl border border-(--border) bg-(--card) p-4 space-y-4">
      <h2 className="text-sm font-semibold">Question Details</h2>

      {/* ID + Difficulty */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass}>Question ID</label>
          <input
            type="text"
            value={formData.id || nextQuestionId}
            onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value }))}
            className={inputClass("id")}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Difficulty (1-5)</label>
          <select
            value={formData.difficulty || 3}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, difficulty: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 }))
            }
            className={inputClass("difficulty")}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} - {["Beginner", "Easy", "Medium", "Hard", "Expert"][d - 1]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Question Text */}
      <div className="space-y-1">
        <label className={labelClass}>Question Text</label>
        <textarea
          value={formData.question || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, question: e.target.value }))}
          rows={3}
          className={inputClass("question")}
          placeholder="Enter the quiz question..."
        />
        {hasError("question") && <p className="text-xs text-(--wrong)">{getError("question")}</p>}
      </div>

      {/* Choices */}
      <div className="space-y-2">
        <label className={labelClass}>Answer Choices</label>
        <div className="grid gap-2">
          {(["A", "B", "C", "D"] as QuestionChoiceId[]).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="radio"
                  name="correctId"
                  checked={formData.correctId === key}
                  onChange={() => setFormData((prev) => ({ ...prev, correctId: key }))}
                  className="accent-(--accent)"
                />
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${
                    formData.correctId === key
                      ? "bg-(--correct) text-white"
                      : "bg-(--border)"
                  }`}
                >
                  {key}
                </span>
              </div>
              <input
                type="text"
                value={formData.choices?.[key] || ""}
                onChange={(e) => updateChoice(key, e.target.value)}
                className={inputClass(`choice${key}`)}
                placeholder={`Choice ${key}...`}
              />
            </div>
          ))}
        </div>
        {["A", "B", "C", "D"].map((k) =>
          hasError(`choice${k}`) ? (
            <p key={k} className="text-xs text-(--wrong)">
              {getError(`choice${k}`)}
            </p>
          ) : null
        )}
      </div>

      {/* Teaching */}
      <div className="space-y-3">
        <label className={labelClass}>Teaching Moment</label>

        <div className="space-y-1">
          <input
            type="text"
            value={formData.teaching?.title || ""}
            onChange={(e) => updateTeaching("title", e.target.value)}
            className={inputClass("teachingTitle")}
            placeholder="Teaching title..."
          />
          {hasError("teachingTitle") && (
            <p className="text-xs text-(--wrong)">{getError("teachingTitle")}</p>
          )}
        </div>

        <div className="space-y-1">
          <textarea
            value={formData.teaching?.body || ""}
            onChange={(e) => updateTeaching("body", e.target.value)}
            rows={3}
            className={inputClass("teachingBody")}
            placeholder="Teaching explanation..."
          />
          {hasError("teachingBody") && (
            <p className="text-xs text-(--wrong)">{getError("teachingBody")}</p>
          )}
        </div>

        <div className="space-y-1">
          <textarea
            value={formData.teaching?.refs?.join("\n") || ""}
            onChange={(e) => handleRefsChange(e.target.value)}
            rows={3}
            className={inputClass("teachingRefs")}
            placeholder="References (one per line or comma-separated)&#10;e.g., John 1:1, CCC 465, Nicaea I"
          />
          <p className="text-xs text-(--muted)">
            {formData.teaching?.refs?.length || 0} ref(s) • Min 2 required
          </p>
          {hasError("teachingRefs") && (
            <p className="text-xs text-(--wrong)">{getError("teachingRefs")}</p>
          )}
          {errors
            .filter((e) => e.field.startsWith("ref"))
            .map((e) => (
              <p key={e.field} className="text-xs text-(--wrong)">
                {e.message}
              </p>
            ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <label className={labelClass}>Tags (comma-separated)</label>
        <input
          type="text"
          value={formData.tags?.join(", ") || ""}
          onChange={(e) => handleTagsChange(e.target.value)}
          className={inputClass("tags")}
          placeholder="councils, heresies, trinity..."
        />
      </div>

      {/* Validation Summary */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-(--wrong) bg-(--wrong-bg) p-3">
          <p className="text-xs font-medium text-(--wrong)">
            {errors.length} validation error(s) — fix before exporting
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-(--border)">
        <button
          onClick={onDownload}
          disabled={!isValid}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-(--accent) text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          Download JSON
        </button>
        <button
          onClick={onCopy}
          disabled={!isValid}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-(--accent) text-(--accent) disabled:opacity-50 disabled:cursor-not-allowed hover:bg-(--accent) hover:text-white"
        >
          Copy JSON
        </button>
        <button
          onClick={onAddToQueue}
          disabled={!isValid}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-(--border) text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:border-(--accent)"
        >
          Add to Queue
        </button>
        <button
          onClick={onReset}
          className="rounded-lg px-4 py-2 text-sm font-medium text-(--muted) hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
