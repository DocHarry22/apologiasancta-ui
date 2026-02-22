"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { TopicWithCount } from "@/lib/content";
import { useTheme } from "@/lib/theme";
import { adminActions } from "@/lib/engineAdmin";
import AuthorForm from "./AuthorForm";
import JsonPreview from "./JsonPreview";
import BatchImport from "./BatchImport";
import EngineControl from "./EngineControl";
import type { Question, QuestionChoiceId } from "@/types/content";

interface Props {
  topics: TopicWithCount[];
}

interface QueuedQuestion {
  id: string;
  question: string;
  json: Question;
}

type TabId = "create" | "import" | "engine";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "https://apologiasancta-engine.onrender.com";

function getInitialAdminToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return localStorage.getItem("adminToken") || "";
  } catch {
    return "";
  }
}

function getDefaultPrefix(topicId: string): string {
  if (topicId === "christology") return "chr";
  const letters = topicId.replace(/[^a-z]/gi, "").toLowerCase();
  return letters.slice(0, 3) || "que";
}

function getNextQuestionId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}_(\\d+)$`, "i");
  let maxNum = 0;

  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const next = maxNum + 1;
  return `${prefix}_${next.toString().padStart(4, "0")}`;
}

export default function AuthorDashboardClient({ topics }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("create");
  const [adminToken, setAdminToken] = useState<string>(() => getInitialAdminToken());
  const [tokenValidation, setTokenValidation] = useState<"unknown" | "validating" | "valid" | "invalid">("unknown");
  const [tokenValidationError, setTokenValidationError] = useState("");
  const [validatedToken, setValidatedToken] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || "");
  const [customPrefix, setCustomPrefix] = useState<string>("");
  const [queue, setQueue] = useState<QueuedQuestion[]>([]);

  const validateAdminToken = useCallback(async (tokenValue: string) => {
    const token = tokenValue.trim();
    if (!token) {
      setTokenValidation("unknown");
      setTokenValidationError("");
      setValidatedToken("");
      return;
    }

    setTokenValidation("validating");
    setTokenValidationError("");

    const response = await adminActions.status(ENGINE_URL, token);
    if (response.success) {
      setTokenValidation("valid");
      setValidatedToken(token);
      setTokenValidationError("");
      return;
    }

    setTokenValidation("invalid");
    setValidatedToken("");
    setTokenValidationError(response.error || "Invalid admin token");
  }, []);

  useEffect(() => {
    if (activeTab !== "import" && activeTab !== "engine") {
      return;
    }

    const token = adminToken.trim();
    if (!token) {
      setTokenValidation("unknown");
      setTokenValidationError("");
      setValidatedToken("");
      return;
    }

    if (token === validatedToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void validateAdminToken(token);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, adminToken, validatedToken, validateAdminToken]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);
  const effectivePrefix = customPrefix || (selectedTopic ? getDefaultPrefix(selectedTopic.id) : "que");
  
  // Combine existing + queued IDs to compute next ID
  const allExistingIds = [
    ...(selectedTopic?.existingIds || []),
    ...queue.filter((q) => q.json.topicId === selectedTopicId).map((q) => q.id),
  ];
  const nextQuestionId = getNextQuestionId(allExistingIds, effectivePrefix);

  const [formData, setFormData] = useState<Partial<Question>>({
    id: nextQuestionId,
    topicId: selectedTopicId,
    difficulty: 3,
    question: "",
    choices: { A: "", B: "", C: "", D: "" },
    correctId: "A",
    teaching: { title: "", body: "", refs: [] },
    tags: [],
  });

  // Update form when topic changes
  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    const topic = topics.find((t) => t.id === topicId);
    const prefix = customPrefix || (topic ? getDefaultPrefix(topic.id) : "que");
    const queuedIdsForTopic = queue.filter((q) => q.json.topicId === topicId).map((q) => q.id);
    const existingIds = [...(topic?.existingIds || []), ...queuedIdsForTopic];
    const newId = getNextQuestionId(existingIds, prefix);
    
    setFormData((prev) => ({
      ...prev,
      id: newId,
      topicId: topicId,
    }));
  };

  // Update ID when prefix changes
  const handlePrefixChange = (newPrefix: string) => {
    setCustomPrefix(newPrefix);
    const prefix = newPrefix || (selectedTopic ? getDefaultPrefix(selectedTopic.id) : "que");
    const queuedIdsForTopic = queue.filter((q) => q.json.topicId === selectedTopicId).map((q) => q.id);
    const existingIds = [...(selectedTopic?.existingIds || []), ...queuedIdsForTopic];
    const newId = getNextQuestionId(existingIds, prefix);
    
    setFormData((prev) => ({
      ...prev,
      id: newId,
    }));
  };

  const buildQuestionJson = (): Question => {
    return {
      id: formData.id || nextQuestionId,
      topicId: selectedTopicId,
      difficulty: (formData.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
      question: formData.question || "",
      choices: formData.choices || { A: "", B: "", C: "", D: "" },
      correctId: (formData.correctId || "A") as QuestionChoiceId,
      teaching: {
        title: formData.teaching?.title || "",
        body: formData.teaching?.body || "",
        refs: formData.teaching?.refs || [],
      },
      tags: formData.tags || [],
    };
  };

  const downloadJson = (question: Question) => {
    const jsonStr = JSON.stringify(question, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${question.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyJson = async (question: Question) => {
    const jsonStr = JSON.stringify(question, null, 2);
    await navigator.clipboard.writeText(jsonStr);
  };

  const addToQueue = () => {
    const question = buildQuestionJson();
    setQueue((prev) => [...prev, { id: question.id, question: question.question, json: question }]);
    
    // Reset form with next ID
    const queuedIds = queue.map((q) => q.id);
    const newExistingIds = [...(selectedTopic?.existingIds || []), ...queuedIds, question.id];
    const newId = getNextQuestionId(newExistingIds, effectivePrefix);
    
    setFormData({
      id: newId,
      topicId: selectedTopicId,
      difficulty: 3,
      question: "",
      choices: { A: "", B: "", C: "", D: "" },
      correctId: "A",
      teaching: { title: "", body: "", refs: [] },
      tags: [],
    });
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const resetForm = () => {
    setFormData({
      id: nextQuestionId,
      topicId: selectedTopicId,
      difficulty: 3,
      question: "",
      choices: { A: "", B: "", C: "", D: "" },
      correctId: "A",
      teaching: { title: "", body: "", refs: [] },
      tags: [],
    });
  };

  const questionJson = buildQuestionJson();

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-(--border) p-2 text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
              aria-label="Home"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-(--muted)">Author Dashboard</p>
              <h1 className="text-2xl font-semibold">
                {activeTab === "create" && "Create Quiz Questions"}
                {activeTab === "import" && "Batch Import"}
                {activeTab === "engine" && "Engine Control"}
              </h1>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-(--border) p-2 text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-(--border)">
          {([
            { id: "create", label: "Create" },
            { id: "import", label: "Import" },
            { id: "engine", label: "Engine" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-(--accent) text-(--accent)"
                  : "border-transparent text-(--muted) hover:text-(--text-primary)"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Admin Token (for import/engine tabs) */}
        {(activeTab === "import" || activeTab === "engine") && (
          <div className="rounded-xl border border-(--border) bg-(--card) p-4">
            <label className="text-xs font-medium text-(--muted) block mb-1">Admin Token</label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => {
                const nextToken = e.target.value;
                setAdminToken(nextToken);
                setValidatedToken("");
                setTokenValidation(nextToken.trim() ? "unknown" : "unknown");
                setTokenValidationError("");
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem("adminToken", nextToken);
                  } catch {
                    // Ignore storage errors (private mode / blocked storage)
                  }
                }
              }}
              placeholder="Enter admin token"
              className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-(--muted)">
                {tokenValidation === "validating" && "Validating admin token..."}
                {tokenValidation === "valid" && "Admin token validated"}
                {tokenValidation === "invalid" && (tokenValidationError || "Admin token invalid")}
                {tokenValidation === "unknown" && "Enter a valid admin token to unlock controls"}
              </p>
              <button
                onClick={() => void validateAdminToken(adminToken)}
                type="button"
                disabled={!adminToken.trim() || tokenValidation === "validating"}
                className="rounded-lg border border-(--border) px-3 py-1 text-xs text-(--muted) hover:border-(--accent) hover:text-(--accent) disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate
              </button>
            </div>
          </div>
        )}

        {/* Create Tab Content */}
        {activeTab === "create" && (
          <>
        {/* Topic Selector */}
        <section className="rounded-xl border border-(--border) bg-(--card) p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-(--muted)">Topic</label>
              <select
                value={selectedTopicId}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--accent) focus:outline-none"
              >
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-(--muted)">ID Prefix</label>
              <input
                type="text"
                value={customPrefix}
                onChange={(e) => handlePrefixChange(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
                placeholder={getDefaultPrefix(selectedTopicId)}
                className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm placeholder:text-(--muted) focus:border-(--accent) focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-(--muted)">Existing Questions</label>
              <div className="rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                {selectedTopic?.questionCount || 0}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-(--muted)">Next ID</label>
              <div className="rounded-lg border border-(--accent) bg-background px-3 py-2 text-sm font-mono text-(--accent)">
                {nextQuestionId}
              </div>
            </div>
          </div>

          {selectedTopic && (
            <div className="text-xs text-(--muted) space-y-1">
              <p>{selectedTopic.description}</p>
              <p>Tags: {selectedTopic.tags.join(", ")}</p>
            </div>
          )}
        </section>

        {/* Main Content: Form + Preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AuthorForm
            formData={formData}
            setFormData={setFormData}
            nextQuestionId={nextQuestionId}
            onDownload={() => downloadJson(questionJson)}
            onCopy={() => copyJson(questionJson)}
            onAddToQueue={addToQueue}
            onReset={resetForm}
          />

          <div className="space-y-4">
            <JsonPreview question={questionJson} />

            {/* Queue */}
            {queue.length > 0 && (
              <section className="rounded-xl border border-(--border) bg-(--card) p-4 space-y-3">
                <h3 className="text-sm font-semibold">Queue ({queue.length})</h3>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {queue.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-(--border) bg-background px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-(--accent)">{item.id}</span>
                        <p className="truncate text-xs text-(--text-secondary)">{item.question}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => downloadJson(item.json)}
                          className="rounded px-2 py-1 text-xs bg-(--accent) text-white hover:opacity-80"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="rounded px-2 py-1 text-xs bg-(--wrong) text-white hover:opacity-80"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* File Path Info */}
            <div className="rounded-xl border border-dashed border-(--border) bg-background p-4">
              <p className="text-xs text-(--muted)">Place downloaded file here:</p>
              <code className="mt-1 block text-xs font-mono text-(--accent) break-all">
                content/topics/{selectedTopicId}/questions/{formData.id || nextQuestionId}.json
              </code>
            </div>
          </div>
        </div>
          </>
        )}

        {/* Import Tab Content */}
        {activeTab === "import" && (
          <div className="rounded-xl border border-(--border) bg-(--card) p-4">
            {tokenValidation === "valid" && adminToken.trim() === validatedToken ? (
              <BatchImport
                engineUrl={ENGINE_URL}
                adminToken={adminToken}
                topics={topics.map((t) => ({ id: t.id, title: t.title }))}
              />
            ) : (
              <p className="text-sm text-(--muted)">Validate the admin token above to unlock Batch Import.</p>
            )}
          </div>
        )}

        {/* Engine Tab Content */}
        {activeTab === "engine" && (
          <div className="rounded-xl border border-(--border) bg-(--card) p-4">
            {tokenValidation === "valid" && adminToken.trim() === validatedToken ? (
              <EngineControl engineUrl={ENGINE_URL} adminToken={adminToken} />
            ) : (
              <p className="text-sm text-(--muted)">Validate the admin token above to unlock Engine controls.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
