"use client";

import { useMemo } from "react";
import {
  editorialSourceKinds,
  type EditorialSourceKind,
  type EditorialSourceReference,
  type Question,
  type QuestionChoiceId,
} from "@/types/content";

interface Props {
  formData: Partial<Question>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Question>>>;
  nextQuestionId: string;
  onDownload: () => void;
  onCopy: () => void;
  onReset: () => void;
}

interface ValidationError {
  field: string;
  message: string;
}

const sourceKindLabels: Record<EditorialSourceKind, string> = {
  scripture: "Scripture",
  catechism: "Catechism",
  church_document: "Church document",
  council: "Council",
  church_father: "Church Father",
  canon_law: "Canon law",
  scholarship: "Scholarship",
};

export default function AuthorForm({
  formData,
  setFormData,
  nextQuestionId,
  onDownload,
  onCopy,
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

    const sources = formData.sourceReferences || [];
    if (sources.length === 0) errs.push({ field: "sourceReferences", message: "At least one structured primary source is required" });
    sources.forEach((source, index) => {
      if (!source.citation.trim()) errs.push({ field: `sourceCitation${index}`, message: `Source ${index + 1} requires a citation` });
      if (source.url && !/^https:\/\//i.test(source.url)) errs.push({ field: `sourceUrl${index}`, message: `Source ${index + 1} URL must use HTTPS` });
    });
    if (sources.length > 0 && sources.every((source) => source.kind === "scholarship")) {
      errs.push({ field: "sourceReferences", message: "Add a primary Catholic source in addition to scholarship" });
    }

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

  const updateSources = (sources: EditorialSourceReference[]) => {
    setFormData((prev) => ({
      ...prev,
      sourceReferences: sources,
      teaching: {
        title: prev.teaching?.title || "",
        body: prev.teaching?.body || "",
        refs: sources.map((source) => source.citation.trim()).filter(Boolean),
      },
    }));
  };

  const updateSource = (index: number, patch: Partial<EditorialSourceReference>) => {
    const sources = [...(formData.sourceReferences || [])];
    sources[index] = { ...sources[index], ...patch };
    updateSources(sources);
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
          <label htmlFor="author-question-id" className={labelClass}>Question ID</label>
          <input
            id="author-question-id"
            type="text"
            value={formData.id || nextQuestionId}
            onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value }))}
            className={inputClass("id")}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="author-question-difficulty" className={labelClass}>Difficulty (1-5)</label>
          <select
            id="author-question-difficulty"
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
        <label htmlFor="author-question-text" className={labelClass}>Question Text</label>
        <textarea
          id="author-question-text"
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
        <span className={labelClass}>Answer Choices</span>
        <div className="grid gap-2">
          {(["A", "B", "C", "D"] as QuestionChoiceId[]).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <input
                  aria-label={`Mark choice ${key} as correct`}
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
                aria-label={`Choice ${key}`}
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
        <span className={labelClass}>Teaching Moment</span>

        <div className="space-y-1">
          <input
            aria-label="Teaching title"
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
            aria-label="Teaching explanation"
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

        <div className="space-y-3" aria-labelledby="structured-sources-label">
          <div className="flex items-center justify-between gap-3">
            <span id="structured-sources-label" className={labelClass}>Structured sources</span>
            <button
              type="button"
              onClick={() => updateSources([...(formData.sourceReferences || []), { kind: "scripture", citation: "" }])}
              className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-xs hover:border-(--accent)"
            >
              Add source
            </button>
          </div>
          {(formData.sourceReferences || []).map((source, index) => (
            <fieldset key={index} className="space-y-2 rounded-lg border border-(--border) p-3">
              <legend className="px-1 text-xs font-semibold">Source {index + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-(--muted)">
                  Type
                  <select
                    aria-label={`Source ${index + 1} type`}
                    value={source.kind}
                    onChange={(event) => updateSource(index, { kind: event.target.value as EditorialSourceKind })}
                    className={inputClass(`sourceKind${index}`)}
                  >
                    {editorialSourceKinds.map((kind) => <option key={kind} value={kind}>{sourceKindLabels[kind]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-(--muted)">
                  Citation
                  <input
                    aria-label={`Source ${index + 1} citation`}
                    value={source.citation}
                    onChange={(event) => updateSource(index, { citation: event.target.value })}
                    className={inputClass(`sourceCitation${index}`)}
                    placeholder="e.g., Catechism of the Catholic Church 465"
                  />
                </label>
                <label className="space-y-1 text-xs text-(--muted)">
                  Locator (optional)
                  <input
                    aria-label={`Source ${index + 1} locator`}
                    value={source.locator || ""}
                    onChange={(event) => updateSource(index, { locator: event.target.value })}
                    className={inputClass(`sourceLocator${index}`)}
                    placeholder="Paragraph, chapter, section, or verse"
                  />
                </label>
                <label className="space-y-1 text-xs text-(--muted)">
                  HTTPS source URL (optional)
                  <input
                    aria-label={`Source ${index + 1} URL`}
                    type="url"
                    value={source.url || ""}
                    onChange={(event) => updateSource(index, { url: event.target.value })}
                    className={inputClass(`sourceUrl${index}`)}
                    placeholder="https://..."
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => updateSources((formData.sourceReferences || []).filter((_, sourceIndex) => sourceIndex !== index))}
                className="min-h-11 rounded-lg px-3 py-2 text-xs text-(--wrong) hover:bg-(--wrong-bg)"
              >
                Remove source
              </button>
            </fieldset>
          ))}
          {hasError("sourceReferences") && <p className="text-xs text-(--wrong)">{getError("sourceReferences")}</p>}
          {errors.filter((error) => error.field.startsWith("sourceCitation") || error.field.startsWith("sourceUrl")).map((error) => (
            <p key={error.field} className="text-xs text-(--wrong)">{error.message}</p>
          ))}
          <p className="text-xs leading-5 text-(--muted)">
            Every submitted doctrinal question needs a checked primary source. Scholarship may supplement, but cannot replace, Scripture or an authoritative Church source.
          </p>
        </div>

        <div className="space-y-1">
          <textarea
            aria-label="Teaching references"
            value={formData.teaching?.refs?.join("\n") || ""}
            readOnly
            rows={3}
            className={inputClass("teachingRefs")}
            placeholder="Citations are derived from the structured sources above."
          />
          <p className="text-xs text-(--muted)">
            {formData.teaching?.refs?.length || 0} reference(s) • commas inside citations are preserved
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
        <label htmlFor="author-question-tags" className={labelClass}>Tags (comma-separated)</label>
        <input
          id="author-question-tags"
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
          onClick={onReset}
          className="rounded-lg px-4 py-2 text-sm font-medium text-(--muted) hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
