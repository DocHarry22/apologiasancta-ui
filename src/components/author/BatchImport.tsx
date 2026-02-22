"use client";

import { useState, useCallback, useMemo } from "react";
import { contentActions, type ContentImportError } from "@/lib/engineAdmin";
import {
  parseInput,
  validateBatch,
  normalizeQuestions,
  EXAMPLE_JSON,
  type ParseResult,
  type BatchValidation,
} from "@/lib/batchImportUtils";
import type { Question } from "@/types/content";

interface Props {
  engineUrl: string;
  adminToken: string;
  topics?: Array<{ id: string; title: string }>;
}

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; added: number; updated: number; committed: boolean; message?: string }
  | { status: "error"; code?: number; message: string; details?: string };

export default function BatchImport({ engineUrl, adminToken, topics = [] }: Props) {
  // Input state
  const [jsonInput, setJsonInput] = useState("");
  const [commitToGitHub, setCommitToGitHub] = useState(false);
  const [fallbackTopicId, setFallbackTopicId] = useState<string>("");

  // UI state
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [serverErrors, setServerErrors] = useState<Array<{ index: number; errors: string[] }>>([]);

  // --------------------------------------------------------------------------
  // Parsing & Validation (memoized)
  // --------------------------------------------------------------------------

  const parseResult: ParseResult = useMemo(() => {
    if (!jsonInput.trim()) {
      return { ok: false, error: "Enter JSON to import" };
    }
    return parseInput(jsonInput);
  }, [jsonInput]);

  const validation: BatchValidation | null = useMemo(() => {
    if (!parseResult.ok) return null;
    // Use topicId from JSON wrapper if present, else fallback dropdown
    const effectiveTopicId = parseResult.topicId || fallbackTopicId || undefined;
    return validateBatch(parseResult.questions, effectiveTopicId);
  }, [parseResult, fallbackTopicId]);

  // Derived state
  const questionCount = parseResult.ok ? parseResult.questions.length : 0;
  const validCount = validation?.valid.length ?? 0;
  const invalidCount = validation?.invalid.length ?? 0;
  const hasParseError = !parseResult.ok && jsonInput.trim().length > 0;
  const hasValidationErrors = invalidCount > 0;
  const canImport = parseResult.ok && validCount > 0 && invalidCount === 0 && !!engineUrl;

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setJsonInput(text);
        setImportState({ status: "idle" });
        setServerErrors([]);
      }
    };
    reader.readAsText(file);
  };

  const handleNormalize = useCallback(() => {
    if (!parseResult.ok) return;
    const normalized = normalizeQuestions(parseResult.questions);
    
    // Reconstruct JSON in same format
    let output: string;
    if (parseResult.topicId) {
      output = JSON.stringify({ topicId: parseResult.topicId, questions: normalized }, null, 2);
    } else {
      output = JSON.stringify(normalized, null, 2);
    }
    
    setJsonInput(output);
  }, [parseResult]);

  const handleImport = async () => {
    if (!canImport || !validation) return;

    setImportState({ status: "loading" });
    setServerErrors([]);

    try {
      const response = await contentActions.import(
        engineUrl,
        adminToken,
        validation.valid,
        { commitToGitHub, commitMessage: `Batch import ${validCount} questions` }
      );

      if (response.success && response.data) {
        setImportState({
          status: "success",
          added: response.data.added,
          updated: response.data.updated,
          committed: response.data.committed,
          message: commitToGitHub && response.data.committed 
            ? "Changes committed to GitHub" 
            : undefined,
        });
        setJsonInput("");
      } else {
        // Check for validation errors in response
        const errorResp = response as unknown as ContentImportError;
        if (errorResp.errors) {
          setServerErrors(errorResp.errors);
        }

        // Determine error code from message
        let code: number | undefined;
        const errMsg = response.error || "Import failed";
        if (errMsg.includes("401") || errMsg.includes("403") || errMsg.toLowerCase().includes("unauthorized")) {
          code = 401;
        } else if (errMsg.includes("400") || errMsg.includes("validation")) {
          code = 400;
        } else if (errMsg.includes("500")) {
          code = 500;
        }

        setImportState({
          status: "error",
          code,
          message: errMsg,
          details: code === 401 ? "Check your admin token" : undefined,
        });
      }
    } catch (err) {
      setImportState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  // --------------------------------------------------------------------------
  // Preview question selector
  // --------------------------------------------------------------------------

  const previewQuestion: Question | null = useMemo(() => {
    if (!parseResult.ok || parseResult.questions.length === 0) return null;
    const q = parseResult.questions[selectedPreviewIndex] as Question;
    return q || null;
  }, [parseResult, selectedPreviewIndex]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-lg border border-(--border) bg-background p-4 text-sm">
        <p className="font-medium mb-2">Import questions to the engine&apos;s content bank:</p>
        <ul className="list-disc list-inside text-(--muted) space-y-1">
          <li>Paste JSON array <code className="text-xs font-mono">[{"{...}"}, ...]</code> or wrapped <code className="text-xs font-mono">{`{"questions":[...]}`}</code></li>
          <li>Questions are validated before import</li>
          <li>Check &quot;Commit to GitHub&quot; to persist changes</li>
        </ul>
      </div>

      {/* Fallback Topic Selector */}
      {topics.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-(--muted)">
            Fallback Topic ID <span className="text-(--muted)">(applied to questions without topicId)</span>
          </label>
          <select
            value={fallbackTopicId}
            onChange={(e) => setFallbackTopicId(e.target.value)}
            className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
          >
            <option value="">— None (topicId required in JSON) —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title} ({t.id})</option>
            ))}
          </select>
        </div>
      )}

      {/* JSON Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-(--muted)">
            Questions JSON
            {parseResult.ok && (
              <span className="ml-2 text-(--accent)">
                ({questionCount} parsed{validCount !== questionCount && `, ${validCount} valid`})
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNormalize}
              disabled={!parseResult.ok}
              className="text-xs text-(--accent) hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Normalize
            </button>
            <label className="cursor-pointer text-xs text-(--accent) hover:underline">
              Upload .json
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value);
            setImportState({ status: "idle" });
            setServerErrors([]);
          }}
          placeholder={EXAMPLE_JSON}
          className={`w-full h-64 rounded-lg border bg-background px-3 py-2 font-mono text-xs focus:outline-none resize-y ${
            hasParseError
              ? "border-(--wrong) focus:border-(--wrong)"
              : "border-(--border) focus:border-(--accent)"
          }`}
        />
      </div>

      {/* Parse Error */}
      {hasParseError && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-3 text-sm">
          <p className="font-medium text-(--wrong)">Parse Error</p>
          <p className="text-xs text-(--wrong)/80 mt-1">{parseResult.error}</p>
          <details className="mt-2">
            <summary className="text-xs text-(--muted) cursor-pointer">Expected format</summary>
            <pre className="mt-1 text-xs text-(--text-secondary) overflow-x-auto">{EXAMPLE_JSON}</pre>
          </details>
        </div>
      )}

      {/* Validation Errors */}
      {hasValidationErrors && validation && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-3">
          <p className="text-sm font-medium text-(--wrong) mb-2">
            Validation Errors ({invalidCount} question{invalidCount !== 1 ? "s" : ""})
          </p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {validation.invalid.map(({ index, id, errors }) => (
              <li key={index} className="text-xs border-b border-(--wrong)/20 pb-2 last:border-0 last:pb-0">
                <span className="font-mono text-(--wrong)">
                  {id ? `[${index}] ${id}` : `[${index}]`}:
                </span>
                <ul className="ml-4 mt-1 text-(--wrong)/80 list-disc list-inside">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Server Validation Errors */}
      {serverErrors.length > 0 && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-3">
          <p className="text-sm font-medium text-(--wrong) mb-2">Server Validation Errors</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {serverErrors.map(({ index, errors }) => (
              <li key={index} className="text-xs text-(--wrong)">
                <span className="font-mono">Question {index + 1}:</span> {errors.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {parseResult.ok && questionCount > 0 && (
        <div className="rounded-lg border border-(--border) bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-(--muted)">
              Preview ({questionCount} question{questionCount !== 1 ? "s" : ""})
            </p>
            {questionCount > 1 && (
              <select
                value={selectedPreviewIndex}
                onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                className="text-xs rounded border border-(--border) bg-background px-2 py-1"
              >
                {parseResult.questions.map((q, i) => {
                  const obj = q as Record<string, unknown>;
                  const label = obj.id || `Question ${i + 1}`;
                  return (
                    <option key={i} value={i}>{String(label)}</option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Question list (compact) */}
          <ul className="space-y-1 max-h-32 overflow-y-auto border-t border-(--border) pt-2">
            {parseResult.questions.slice(0, 10).map((q, i) => {
              const obj = q as Record<string, unknown>;
              const isInvalid = validation?.invalid.some((inv) => inv.index === i);
              return (
                <li
                  key={i}
                  onClick={() => setSelectedPreviewIndex(i)}
                  className={`text-xs flex gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-(--card) ${
                    selectedPreviewIndex === i ? "bg-(--card)" : ""
                  }`}
                >
                  <span className={`font-mono ${isInvalid ? "text-(--wrong)" : "text-(--accent)"}`}>
                    {obj.id ? String(obj.id) : `[${i}]`}
                  </span>
                  <span className="truncate text-(--text-secondary)">
                    {obj.question ? String(obj.question) : "(no question text)"}
                  </span>
                  {isInvalid && <span className="text-(--wrong)">✗</span>}
                </li>
              );
            })}
            {questionCount > 10 && (
              <li className="text-xs text-(--muted)">...and {questionCount - 10} more</li>
            )}
          </ul>

          {/* Selected question preview (full JSON) */}
          {previewQuestion && (
            <pre className="mt-2 rounded border border-(--border) bg-(--card) p-2 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
              {JSON.stringify(previewQuestion, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commitToGitHub}
            onChange={(e) => setCommitToGitHub(e.target.checked)}
            className="rounded border-(--border)"
          />
          <span>Commit to GitHub</span>
        </label>
        {!engineUrl && (
          <span className="text-xs text-(--wrong)">⚠ Engine URL not configured</span>
        )}
      </div>

      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={!canImport || importState.status === "loading"}
        className="w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        title={
          !parseResult.ok
            ? "Fix JSON parse errors first"
            : invalidCount > 0
            ? `Fix ${invalidCount} validation error(s) first`
            : validCount === 0
            ? "No valid questions to import"
            : !engineUrl
            ? "Engine URL not configured"
            : undefined
        }
      >
        {importState.status === "loading"
          ? "Importing..."
          : `Import ${validCount} Question${validCount !== 1 ? "s" : ""}`}
      </button>

      {/* Import Result */}
      {importState.status === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
          <p className="font-medium text-green-400">
            ✓ Imported {importState.added} new, {importState.updated} updated
          </p>
          {importState.message && (
            <p className="text-xs mt-1 text-green-400/80">{importState.message}</p>
          )}
        </div>
      )}

      {importState.status === "error" && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-3 text-sm">
          <p className="font-medium text-(--wrong)">
            {importState.code === 401 && "✗ Unauthorized"}
            {importState.code === 400 && "✗ Validation Failed"}
            {importState.code === 500 && "✗ Server Error"}
            {!importState.code && "✗ Import Failed"}
          </p>
          <p className="text-xs mt-1 text-(--wrong)/80">{importState.message}</p>
          {importState.details && (
            <p className="text-xs mt-1 text-(--muted)">{importState.details}</p>
          )}
        </div>
      )}
    </div>
  );
}
