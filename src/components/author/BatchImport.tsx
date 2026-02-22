"use client";

import { useState, useCallback } from "react";
import { contentActions } from "@/lib/engineAdmin";
import type { Question } from "@/types/content";

interface Props {
  engineUrl: string;
  adminToken: string;
}

interface ImportError {
  index: number;
  errors: string[];
}

export default function BatchImport({ engineUrl, adminToken }: Props) {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: string;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [commitToGitHub, setCommitToGitHub] = useState(false);

  const parseQuestions = useCallback((): Question[] | null => {
    try {
      const parsed = JSON.parse(jsonInput);
      // Support both single question and array
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        return [parsed];
      }
      return null;
    } catch {
      return null;
    }
  }, [jsonInput]);

  const handleImport = async () => {
    setLoading(true);
    setResult(null);
    setValidationErrors([]);

    try {
      const questions = parseQuestions();
      if (!questions) {
        setResult({
          type: "error",
          message: "Invalid JSON",
          details: "Please enter valid JSON (single question object or array of questions)",
        });
        return;
      }

      if (questions.length === 0) {
        setResult({
          type: "error",
          message: "No questions",
          details: "The JSON array is empty",
        });
        return;
      }

      const response = await contentActions.import(
        engineUrl,
        adminToken,
        questions,
        { commitToGitHub }
      );

      if (response.success && response.data) {
        setResult({
          type: "success",
          message: `Imported ${response.data.added} new, ${response.data.updated} updated`,
          details: commitToGitHub && response.data.committed
            ? "Changes committed to GitHub"
            : undefined,
        });
        setJsonInput("");
      } else {
        // Check for validation errors in the error response
        const errorData = response as unknown as {
          error?: string;
          errors?: ImportError[];
        };
        
        if (errorData.errors && Array.isArray(errorData.errors)) {
          setValidationErrors(errorData.errors);
        }
        
        setResult({
          type: "error",
          message: response.error || "Import failed",
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setJsonInput(text);
        setResult(null);
        setValidationErrors([]);
      }
    };
    reader.readAsText(file);
  };

  const previewQuestions = parseQuestions();
  const previewCount = previewQuestions?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-lg border border-(--border) bg-background p-4 text-sm">
        <p className="font-medium mb-2">Import questions to the engine&apos;s content bank:</p>
        <ul className="list-disc list-inside text-(--muted) space-y-1">
          <li>Paste JSON array of questions or upload a .json file</li>
          <li>Questions are loaded into the engine&apos;s memory</li>
          <li>Optionally commit to GitHub for persistence</li>
          <li>After import, use &quot;Set Quiz Pool&quot; to activate questions</li>
        </ul>
      </div>

      {/* JSON Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-(--muted)">
            Questions JSON ({previewCount} {previewCount === 1 ? "question" : "questions"})
          </label>
          <label className="cursor-pointer text-xs text-(--accent) hover:underline">
            Upload file
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value);
            setResult(null);
            setValidationErrors([]);
          }}
          placeholder='[{"id": "chr_0001", "topicId": "christology", "question": "...", ...}]'
          className="w-full h-64 rounded-lg border border-(--border) bg-background px-3 py-2 font-mono text-xs focus:border-(--accent) focus:outline-none resize-y"
        />
      </div>

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
      </div>

      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={loading || !jsonInput.trim()}
        className="w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Importing..." : `Import ${previewCount} Question${previewCount !== 1 ? "s" : ""}`}
      </button>

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-(--wrong)/30 bg-(--wrong)/10 text-(--wrong)"
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.details && <p className="text-xs mt-1 opacity-80">{result.details}</p>}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-3">
          <p className="text-sm font-medium text-(--wrong) mb-2">Validation errors:</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {validationErrors.map(({ index, errors }) => (
              <li key={index} className="text-xs text-(--wrong)">
                <span className="font-mono">Question {index + 1}:</span>{" "}
                {errors.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {previewQuestions && previewQuestions.length > 0 && (
        <div className="rounded-lg border border-(--border) bg-background p-3 space-y-2">
          <p className="text-xs font-medium text-(--muted)">Preview:</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {previewQuestions.slice(0, 10).map((q, i) => (
              <li key={i} className="text-xs flex gap-2">
                <span className="font-mono text-(--accent)">{q.id || `[${i}]`}</span>
                <span className="truncate text-(--text-secondary)">{q.question}</span>
              </li>
            ))}
            {previewQuestions.length > 10 && (
              <li className="text-xs text-(--muted)">...and {previewQuestions.length - 10} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
