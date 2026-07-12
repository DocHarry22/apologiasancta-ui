"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PublishedQuestionRecord, TopicWithCount } from "@/lib/content";
import type { CurrentUser } from "@/lib/server/currentUser";
import type { Question, QuestionChoiceId } from "@/types/content";
import type { AdminRoomStatus, AdminStatus, ContentStatusResponse, TopicSequenceConfig } from "@/lib/engineAdmin";
import { useTheme } from "@/lib/theme";
import { roleLabels, hasAnyPermission, hasPermission, type Permission } from "@/lib/auth/roles";
import { adminProxy, contentProxy, quizProxy, roomProxy, topicProxy } from "@/lib/adminProxyClient";
import { getEngineUrl } from "@/lib/publicEnv";
import { validateQuestion, hasBlockingValidationIssues, type ValidationIssue } from "@/lib/contentValidation";
import { validateTopic } from "@/lib/topicOperations";
import { buildTopicSequenceConfig, validateTopicSequenceConfig } from "@/lib/topicSequence";
import { dangerousActions, isDangerConfirmationValid, requiresTypedConfirmation, type DangerousActionDefinition } from "@/lib/dangerousActions";
import type { DraftQuestion, ReviewStatus } from "@/lib/contentWorkflow";
import type { AuditEvent } from "@/lib/server/storage/types";
import AuthorForm from "./AuthorForm";
import JsonPreview from "./JsonPreview";
import BatchImport from "./BatchImport";
import EngineHealthPanel from "./EngineHealthPanel";

interface Props {
  topics: TopicWithCount[];
  publishedQuestions: PublishedQuestionRecord[];
  currentUser: CurrentUser;
  initialTab?: TabId;
}

type TabId = "overview" | "live" | "rooms" | "bank" | "authoring" | "review" | "topics" | "audit" | "settings";
type Message = { type: "success" | "error" | "info"; text: string };
type PendingAction = { definition: DangerousActionDefinition; run: () => Promise<void> };
type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: keyof typeof roleLabels;
  accountType: "staff" | "public";
  phone?: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};
type InviteStaffRole = "admin" | "author" | "reviewer" | "host";
type InviteSettingsState = {
  inviteCode: string;
  staffRole: InviteStaffRole;
  source: "store" | "env" | "default";
  updatedAt: string;
};

const ENGINE_URL = getEngineUrl();

const sections: Array<{ id: TabId; label: string; title: string; permissions: Permission[] }> = [
  { id: "overview", label: "Overview", title: "Operations Overview", permissions: ["overview:view"] },
  { id: "live", label: "Live Control", title: "Live Host Controls", permissions: ["live:control"] },
  { id: "rooms", label: "Rooms", title: "Room Operations", permissions: ["rooms:manage"] },
  { id: "bank", label: "Question Bank", title: "Question Bank", permissions: ["content:view"] },
  { id: "authoring", label: "Authoring", title: "Author Workflow", permissions: ["content:draft:create", "content:import"] },
  { id: "review", label: "Review", title: "Review Queue", permissions: ["content:review"] },
  { id: "topics", label: "Topics", title: "Topics and Sequence", permissions: ["topics:manage", "topic_sequence:manage"] },
  { id: "audit", label: "Audit", title: "Audit Visibility", permissions: ["audit:view"] },
  { id: "settings", label: "Settings", title: "Dashboard Settings", permissions: ["settings:view"] },
];

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

  return `${prefix}_${(maxNum + 1).toString().padStart(4, "0")}`;
}

function formatTimestamp(timestamp: number | string | null | undefined): string {
  if (!timestamp) return "Not available";
  return new Date(timestamp).toLocaleString();
}

function statusClass(status: ReviewStatus | "published" | "active" | "closed") {
  if (status === "published" || status === "approved" || status === "active") return "bg-green-500/15 text-green-400";
  if (status === "submitted") return "bg-sky-500/15 text-sky-400";
  if (status === "changes_requested") return "bg-yellow-500/15 text-yellow-300";
  if (status === "rejected" || status === "closed") return "bg-red-500/15 text-red-400";
  return "bg-(--ticker-bg) text-(--muted)";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-(--muted)">{children}</label>;
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function MessageBanner({ message }: { message: Message | null }) {
  if (!message) return null;

  const tone =
    message.type === "success"
      ? "border-green-500/30 bg-green-500/10 text-green-400"
      : message.type === "info"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
        : "border-(--wrong)/30 bg-(--wrong)/10 text-(--wrong)";

  return <div className={`rounded-lg border p-3 text-sm ${tone}`}>{message.text}</div>;
}

function workflowQuestion(item: DraftQuestion): Question {
  return {
    id: item.questionId || item.id,
    topicId: item.topicId,
    difficulty: item.difficulty,
    question: item.question,
    choices: item.choices,
    correctId: item.correctId,
    teaching: item.teaching,
    tags: item.tags,
  };
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)as_csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function refreshCsrfToken(): Promise<void> {
  try {
    await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin" });
  } catch {
    // best-effort refresh only
  }
}

async function dashboardApi<T>(path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: unknown; retried?: boolean } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (method !== "GET") {
    const csrf = getCsrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && typeof window !== "undefined") {
    const basePath = window.location.pathname.startsWith("/admin") ? "/admin" : "/author";
    const nextPath = window.location.pathname || "/";
    window.location.href = `${basePath}/login?reason=session_expired&next=${encodeURIComponent(nextPath)}`;
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (response.status === 403 && method !== "GET" && !options.retried) {
    await refreshCsrfToken();
    return dashboardApi<T>(path, { ...options, retried: true });
  }

  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    return { ok: false, status: response.status, error: data.error || `HTTP ${response.status}` };
  }
  return { ok: true, data: data as T };
}

function DangerousConfirmModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction | null;
  onCancel: () => void;
  onConfirm: (typedValue: string) => void;
}) {
  const [typedValue, setTypedValue] = useState("");
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setTypedValue("");
    if (pending) {
      window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    }
  }, [pending]);

  if (!pending) return null;

  const { definition } = pending;
  const requiresText = requiresTypedConfirmation(definition);
  const canConfirm = isDangerConfirmationValid(definition, typedValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dangerous-action-title"
        className="w-full max-w-lg rounded-lg border border-(--wrong)/40 bg-background p-5 shadow-xl"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-(--wrong)">Confirmation required</p>
            <h2 id="dangerous-action-title" className="mt-1 text-lg font-semibold">{definition.label}</h2>
            <p className="mt-2 text-sm text-(--text-secondary)">{definition.summary}</p>
          </div>

          <div className="rounded-lg border border-(--border) bg-(--card) p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">Consequences</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-(--text-secondary)">
              {definition.consequences.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          {requiresText && (
            <div className="space-y-1">
              <FieldLabel>Type {definition.confirmationText} to confirm</FieldLabel>
              <input
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm focus:border-(--wrong) focus:outline-none"
              />
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-(--border) px-4 py-2 text-sm hover:border-(--accent) hover:text-(--accent)"
            >
              Cancel
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => onConfirm(typedValue)}
              disabled={!canConfirm}
              className="rounded-lg bg-(--wrong) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthorDashboardClient({ topics, publishedQuestions, currentUser, initialTab }: Props) {
  const { theme, toggleTheme } = useTheme();
  const visibleSections = sections.filter((section) => hasAnyPermission(currentUser.role, section.permissions));
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? visibleSections[0]?.id ?? "overview");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || "");
  const [customPrefix, setCustomPrefix] = useState("");
  const [workflowItems, setWorkflowItems] = useState<DraftQuestion[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowUnavailable, setWorkflowUnavailable] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(publishedQuestions[0]?.question.id || "");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [doctrinalFlag, setDoctrinalFlag] = useState(false);
  const [referenceFlag, setReferenceFlag] = useState(false);
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [contentStatus, setContentStatus] = useState<ContentStatusResponse | null>(null);
  const [rooms, setRooms] = useState<AdminRoomStatus[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [selectedPoolTopics, setSelectedPoolTopics] = useState<string[]>([]);
  const [shufflePool, setShufflePool] = useState(true);
  const [sequenceConfig, setSequenceConfig] = useState<TopicSequenceConfig>(() => buildTopicSequenceConfig({ topicSequence: topics.map((topic) => topic.id) }));
  const [topicToAdd, setTopicToAdd] = useState(topics[0]?.id || "");
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [countdownTopicId, setCountdownTopicId] = useState(topics[0]?.id || "");
  const [bankSearch, setBankSearch] = useState("");
  const [bankTopicFilter, setBankTopicFilter] = useState("all");
  const [bankDifficultyFilter, setBankDifficultyFilter] = useState("all");
  const [bankStatusFilter, setBankStatusFilter] = useState("all");
  const [bankTagFilter, setBankTagFilter] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [pendingDanger, setPendingDanger] = useState<PendingAction | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [inviteSettings, setInviteSettings] = useState<InviteSettingsState | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [inviteRoleInput, setInviteRoleInput] = useState<InviteStaffRole>("host");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [revokeSessionsLoading, setRevokeSessionsLoading] = useState(false);

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const existingIds = useMemo(() => publishedQuestions.map((record) => record.question.id), [publishedQuestions]);
  const topicIds = useMemo(() => topics.map((topic) => topic.id), [topics]);
  const effectivePrefix = customPrefix || (selectedTopic ? getDefaultPrefix(selectedTopic.id) : "que");
  const queuedIds = workflowItems.filter((item) => item.topicId === selectedTopicId).map((item) => item.id);
  const nextQuestionId = getNextQuestionId([...(selectedTopic?.existingIds || []), ...queuedIds], effectivePrefix);

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

  const fetchOperationalStatus = useCallback(async () => {
    setLoadingStatus(true);
    const canViewContent = hasPermission(currentUser.role, "content:view");
    const canManageRooms = hasPermission(currentUser.role, "rooms:manage");
    const canManageSequence = hasPermission(currentUser.role, "topic_sequence:manage");
    const [contentRes, adminRes, roomsRes, sequenceRes] = await Promise.all([
      canViewContent ? contentProxy.status() : Promise.resolve(null),
      adminProxy.status(selectedRoomId),
      canManageRooms ? roomProxy.list() : Promise.resolve(null),
      canManageSequence ? topicProxy.getSequence(selectedRoomId) : Promise.resolve(null),
    ]);

    if (contentRes?.success && contentRes.data) {
      setContentStatus(contentRes.data);
    } else if (contentRes && !contentRes.success) {
      setMessage({ type: "error", text: contentRes.error || "Unable to load content status." });
    }

    if (adminRes.success && adminRes.data) {
      setAdminStatus(adminRes.data);
    } else if (!adminRes.success) {
      setAdminStatus(null);
      setMessage({ type: "error", text: adminRes.error || "Unable to load engine status." });
    }

    if (roomsRes?.success && roomsRes.data) {
      setRooms(roomsRes.data.rooms);
      if (!selectedRoomId) {
        const firstActiveRoom = roomsRes.data.rooms.find((room) => room.roomId !== "global" && room.isActive);
        setSelectedRoomId(firstActiveRoom?.roomId ?? null);
      }
    } else if (roomsRes && !roomsRes.success) {
      setMessage({ type: "error", text: roomsRes.error || "Unable to load rooms." });
    }

    if (sequenceRes?.success && sequenceRes.data) {
      setSequenceConfig(buildTopicSequenceConfig(sequenceRes.data.config));
    }

    setLoadingStatus(false);
  }, [currentUser.role, selectedRoomId]);

  const fetchWorkflowItems = useCallback(async () => {
    setWorkflowLoading(true);
    const response = await dashboardApi<{ ok: true; items: DraftQuestion[] }>("/api/workflow/items");
    if (response.ok) {
      setWorkflowItems(response.data.items);
      setWorkflowUnavailable(false);
    } else {
      setWorkflowUnavailable(true);
      setMessage({ type: response.status === 401 || response.status === 403 ? "error" : "info", text: response.error || "Workflow persistence is unavailable." });
    }
    setWorkflowLoading(false);
  }, []);

  const fetchAuditEvents = useCallback(async () => {
    if (!hasPermission(currentUser.role, "audit:view")) return;
    setAuditLoading(true);
    const params = new URLSearchParams();
    if (auditTypeFilter !== "all") params.set("eventType", auditTypeFilter);
    if (auditSearch.trim()) params.set("search", auditSearch.trim());
    const response = await dashboardApi<{ ok: true; events: AuditEvent[] }>(`/api/audit/events${params.size ? `?${params}` : ""}`);
    if (response.ok) {
      setAuditEvents(response.data.events);
      setAuditUnavailable(false);
    } else {
      setAuditEvents([]);
      setAuditUnavailable(true);
      setMessage({ type: response.status === 401 || response.status === 403 ? "error" : "info", text: response.error || "Audit persistence is unavailable." });
    }
    setAuditLoading(false);
  }, [auditSearch, auditTypeFilter, currentUser.role]);

  useEffect(() => {
    void fetchOperationalStatus();
    const interval = window.setInterval(() => void fetchOperationalStatus(), 15000);
    return () => window.clearInterval(interval);
  }, [fetchOperationalStatus]);

  useEffect(() => {
    void fetchWorkflowItems();
  }, [fetchWorkflowItems]);

  useEffect(() => {
    if (activeTab === "audit") void fetchAuditEvents();
  }, [activeTab, fetchAuditEvents]);

  const selectedSection = sections.find((section) => section.id === activeTab);
  const selectedPublishedRecord = publishedQuestions.find((record) => record.question.id === selectedQuestionId) || publishedQuestions[0];
  const selectedWorkflowItem = workflowItems.find((item) => item.id === selectedWorkflowId);
  const currentRoom = rooms.find((room) => room.roomId === selectedRoomId) || rooms.find((room) => room.roomId === "global") || null;
  const canAuthor = hasPermission(currentUser.role, "content:draft:create");
  const canReview = hasPermission(currentUser.role, "content:review");
  const canManageDanger = hasPermission(currentUser.role, "dangerous:execute");
  const canManageUsers = hasPermission(currentUser.role, "users:manage");

  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setUsersLoading(true);
    const response = await dashboardApi<{ ok: true; users: ManagedUser[] }>("/api/auth/users");
    if (response.ok) {
      setManagedUsers(response.data.users);
    } else {
      setMessage({ type: "error", text: response.error || "Unable to load user accounts." });
    }
    setUsersLoading(false);
  }, [canManageUsers]);

  const updateManagedUser = useCallback(async (payload: { userId: string; role?: ManagedUser["role"]; status?: ManagedUser["status"] }) => {
    if (!canManageUsers) return;
    setUpdatingUserId(payload.userId);
    const response = await dashboardApi<{ ok: true; user: ManagedUser }>("/api/auth/users", {
      method: "PATCH",
      body: payload,
    });
    if (response.ok) {
      setManagedUsers((users) => users.map((user) => user.id === response.data.user.id ? response.data.user : user));
      setMessage({ type: "success", text: "User updated." });
    } else {
      setMessage({ type: "error", text: response.error || "Unable to update user." });
    }
    setUpdatingUserId(null);
  }, [canManageUsers]);

  const fetchInviteSettings = useCallback(async () => {
    if (!canManageUsers) return;
    setInviteLoading(true);
    const response = await dashboardApi<{ ok: true; settings: InviteSettingsState }>("/api/auth/invite-settings");
    if (response.ok) {
      setInviteSettings(response.data.settings);
      setInviteCodeInput(response.data.settings.inviteCode);
      setInviteRoleInput(response.data.settings.staffRole);
    } else {
      setMessage({ type: "error", text: response.error || "Unable to load invite settings." });
    }
    setInviteLoading(false);
  }, [canManageUsers]);

  const saveInviteSettings = useCallback(async (rotate: boolean) => {
    if (!canManageUsers) return;
    setInviteLoading(true);
    const response = await dashboardApi<{ ok: true; settings: InviteSettingsState }>("/api/auth/invite-settings", {
      method: "PATCH",
      body: {
        rotate,
        inviteCode: inviteCodeInput,
        staffRole: inviteRoleInput,
      },
    });
    if (response.ok) {
      setInviteSettings(response.data.settings);
      setInviteCodeInput(response.data.settings.inviteCode);
      setInviteRoleInput(response.data.settings.staffRole);
      setMessage({ type: "success", text: rotate ? "Invite code rotated." : "Invite settings saved." });
    } else {
      setMessage({ type: "error", text: response.error || "Unable to update invite settings." });
    }
    setInviteLoading(false);
  }, [canManageUsers, inviteCodeInput, inviteRoleInput]);

  const changePassword = useCallback(async () => {
    setPasswordLoading(true);
    const response = await dashboardApi<{ ok: true }>("/api/auth/password", {
      method: "PATCH",
      body: {
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
        confirmPassword: confirmPasswordInput,
      },
    });

    if (response.ok) {
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setMessage({ type: "success", text: "Password updated." });
    } else {
      setMessage({ type: "error", text: response.error || "Unable to update password." });
    }
    setPasswordLoading(false);
  }, [confirmPasswordInput, currentPasswordInput, newPasswordInput]);

  const revokeOtherSessions = useCallback(async () => {
    setRevokeSessionsLoading(true);
    const response = await dashboardApi<{ ok: true }>("/api/auth/sessions/revoke", {
      method: "POST",
      body: {},
    });

    if (response.ok) {
      setMessage({ type: "success", text: "Other sessions were signed out." });
    } else {
      setMessage({ type: "error", text: response.error || "Unable to revoke other sessions." });
    }
    setRevokeSessionsLoading(false);
  }, []);

  useEffect(() => {
    if (!canManageUsers || activeTab !== "settings") return;
    void fetchUsers();
    void fetchInviteSettings();
  }, [activeTab, canManageUsers, fetchInviteSettings, fetchUsers]);

  const buildQuestionJson = (): Question => ({
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
  });

  const questionJson = buildQuestionJson();
  const draftValidationIssues = validateQuestion(questionJson, { topicIds, existingIds });
  const sequenceIssues = validateTopicSequenceConfig(sequenceConfig, topicIds);

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

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    const topic = topics.find((item) => item.id === topicId);
    const prefix = customPrefix || (topic ? getDefaultPrefix(topic.id) : "que");
    const newId = getNextQuestionId([...(topic?.existingIds || []), ...workflowItems.filter((item) => item.topicId === topicId).map((item) => item.id)], prefix);

    setFormData((prev) => ({ ...prev, id: newId, topicId }));
  };

  const handlePrefixChange = (newPrefix: string) => {
    setCustomPrefix(newPrefix);
    const prefix = newPrefix || (selectedTopic ? getDefaultPrefix(selectedTopic.id) : "que");
    setFormData((prev) => ({ ...prev, id: getNextQuestionId([...(selectedTopic?.existingIds || []), ...queuedIds], prefix) }));
  };

  const createDraftFromForm = async (status: ReviewStatus = "draft") => {
    if (!canAuthor) return;
    const question = buildQuestionJson();
    const validation = validateQuestion(question, { topicIds, existingIds }).map((issue) => issue.message);
    if (status === "submitted" && hasBlockingValidationIssues(validateQuestion(question, { topicIds, existingIds }))) {
      setMessage({ type: "error", text: "Fix blocking validation issues before submitting." });
      return;
    }
    setLoading(true);
    const response = await dashboardApi<{ ok: true; item: DraftQuestion }>("/api/workflow/items", {
      method: "POST",
      body: { question, status, validationIssues: validation },
    });
    setLoading(false);
    if (response.ok) {
      setWorkflowItems((items) => [response.data.item, ...items.filter((item) => item.id !== response.data.item.id)]);
      setSelectedWorkflowId(response.data.item.id);
      setMessage({ type: "success", text: status === "submitted" ? "Draft submitted for review." : "Draft saved to workflow storage." });
      resetForm();
      if (activeTab === "audit") void fetchAuditEvents();
    } else {
      setMessage({ type: "error", text: response.error || "Unable to save draft." });
    }
  };

  const submitWorkflowItem = async (item: DraftQuestion) => {
    if (!hasPermission(currentUser.role, "content:submit_review")) return;
    const issues = validateQuestion(item, { topicIds, existingIds });
    if (hasBlockingValidationIssues(issues)) {
      setWorkflowItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, validationIssues: issues.map((issue) => issue.message) } : candidate));
      setMessage({ type: "error", text: "Fix blocking validation issues before submitting." });
      return;
    }

    setLoading(true);
    const response = await dashboardApi<{ ok: true; item: DraftQuestion }>(`/api/workflow/items/${encodeURIComponent(item.id)}/submit`, { method: "POST" });
    setLoading(false);
    if (response.ok) {
      setWorkflowItems((items) => items.map((candidate) => candidate.id === item.id ? response.data.item : candidate));
      setMessage({ type: "success", text: "Question submitted for review." });
      if (activeTab === "audit") void fetchAuditEvents();
    } else {
      setMessage({ type: "error", text: response.error || "Unable to submit workflow item." });
    }
  };

  const reviewWorkflowItem = async (item: DraftQuestion, status: "approved" | "rejected" | "changes_requested") => {
    if (!canReview) return;
    const action = status === "changes_requested" ? "request-changes" : status === "approved" ? "approve" : "reject";
    setLoading(true);
    const response = await dashboardApi<{ ok: true; item: DraftQuestion }>(`/api/workflow/items/${encodeURIComponent(item.id)}/${action}`, {
      method: "POST",
      body: { comment: reviewComment, doctrinalFlag, referenceFlag },
    });
    setLoading(false);
    if (response.ok) {
      setWorkflowItems((items) => items.map((candidate) => candidate.id === item.id ? response.data.item : candidate));
      setReviewComment("");
      setDoctrinalFlag(false);
      setReferenceFlag(false);
      setMessage({ type: "success", text: `Review marked ${status.replace("_", " ")}.` });
      if (activeTab === "audit") void fetchAuditEvents();
    } else {
      setMessage({ type: "error", text: response.error || "Review transition failed." });
    }
  };

  const publishWorkflowItem = async (item: DraftQuestion) => {
    setLoading(true);
    const response = await dashboardApi<{ ok: true; item: DraftQuestion; publishTarget?: string }>(`/api/workflow/items/${encodeURIComponent(item.id)}/publish`, { method: "POST" });
    setLoading(false);
    if (response.ok) {
      setWorkflowItems((items) => items.map((candidate) => candidate.id === item.id ? response.data.item : candidate));
      setMessage({ type: "info", text: response.data.publishTarget === "workflow_store" ? "Published to workflow store only; public content was not modified." : "Workflow item published." });
      if (activeTab === "audit") void fetchAuditEvents();
    } else {
      setMessage({ type: "error", text: response.error || "Unable to publish workflow item." });
    }
  };

  const archiveWorkflowItem = async (item: DraftQuestion) => {
    setLoading(true);
    const response = await dashboardApi<{ ok: true; item: DraftQuestion }>(`/api/workflow/items/${encodeURIComponent(item.id)}/archive`, { method: "POST" });
    setLoading(false);
    if (response.ok) {
      setWorkflowItems((items) => items.map((candidate) => candidate.id === item.id ? response.data.item : candidate));
      setMessage({ type: "success", text: "Workflow item archived." });
      if (activeTab === "audit") void fetchAuditEvents();
    } else {
      setMessage({ type: "error", text: response.error || "Unable to archive workflow item." });
    }
  };

  const duplicateQuestion = (question: Question) => {
    const duplicateId = getNextQuestionId([...(selectedTopic?.existingIds || []), ...workflowItems.map((item) => item.id)], getDefaultPrefix(question.topicId));
    setSelectedTopicId(question.topicId);
    setFormData({
      ...question,
      id: duplicateId,
      question: `${question.question} (copy)`,
    });
    setActiveTab("authoring");
  };

  const runWithDangerConfirm = (definition: DangerousActionDefinition, run: () => Promise<void>) => {
    if (!canManageDanger) {
      setMessage({ type: "error", text: "Your role cannot perform dangerous actions." });
      return;
    }
    setPendingDanger({ definition, run });
  };

  const confirmDangerousAction = async (typedValue: string) => {
    const pending = pendingDanger;
    if (!pending || !isDangerConfirmationValid(pending.definition, typedValue)) return;
    setPendingDanger(null);
    setLoading(true);
    await pending.run();
    setLoading(false);
  };

  const handleLogout = () => {
    setLoggingOut(true);
    const basePath = window.location.pathname.startsWith("/admin") ? "/admin" : "/author";
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/auth/logout?next=${encodeURIComponent(`${basePath}/login`)}`;
    document.body.appendChild(form);
    form.submit();
  };

  const engineAction = async (action: "start" | "resume" | "pause" | "next" | "reset") => {
    setLoading(true);
    setMessage(null);
    const result = await adminProxy[action](selectedRoomId);
    if (result.success) {
      setMessage({ type: "success", text: action === "next" ? "Advanced to next question." : `Engine ${action} request completed.` });
      await fetchOperationalStatus();
    } else {
      setMessage({ type: "error", text: result.error || `Failed to ${action} engine.` });
    }
    setLoading(false);
  };

  const createRoom = async () => {
    const name = newRoomName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Room name is required." });
      return;
    }
    setLoading(true);
    const result = await roomProxy.create(name, newRoomId.trim() || undefined);
    if (result.success && result.data) {
      setMessage({ type: "success", text: `Created room ${result.data.room.name}.` });
      setNewRoomName("");
      setNewRoomId("");
      setSelectedRoomId(result.data.room.roomId);
      await fetchOperationalStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to create room." });
    }
    setLoading(false);
  };

  const closeRoom = async (room: AdminRoomStatus) => {
    runWithDangerConfirm(dangerousActions.closeRoom(room.name), async () => {
      const result = await roomProxy.close(room.roomId);
      if (result.success) {
        setMessage({ type: "success", text: `Closed room ${room.name}.` });
        await fetchOperationalStatus();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to close room." });
      }
    });
  };

  const copyRoomUrl = async (roomId: string) => {
    const url = `${window.location.origin}/mobile?room=${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ type: "success", text: "Room URL copied." });
    } catch {
      setMessage({ type: "info", text: url });
    }
  };

  const setPool = async () => {
    setLoading(true);
    const result = await quizProxy.setPool(selectedPoolTopics, shufflePool);
    if (result.success && result.data) {
      setMessage({ type: "success", text: `Pool set with ${result.data.poolSize} question(s).` });
      await fetchOperationalStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to set quiz pool." });
    }
    setLoading(false);
  };

  const saveSequence = async () => {
    if (sequenceIssues.length > 0) {
      setMessage({ type: "error", text: sequenceIssues[0].message });
      return;
    }

    runWithDangerConfirm(dangerousActions.saveSequence(), async () => {
      const result = await topicProxy.setSequence(sequenceConfig, selectedRoomId);
      if (result.success) {
        setMessage({ type: "success", text: "Topic sequence saved through the admin proxy." });
        await fetchOperationalStatus();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save topic sequence." });
      }
    });
  };

  const mutateSequence = (nextSequence: string[]) => {
    setSequenceConfig((config) => ({ ...config, topicSequence: nextSequence }));
  };

  const filteredQuestionRows = useMemo(() => {
    const workflowRows = workflowItems.map((item) => ({
      id: item.questionId || item.id,
      workflowId: item.id,
      topicId: item.topicId,
      topicTitle: topics.find((topic) => topic.id === item.topicId)?.title || item.topicId,
      difficulty: item.difficulty,
      status: item.status,
      tags: item.tags,
      updatedAt: item.updatedAt,
      question: workflowQuestion(item),
      validationIssues: validateQuestion(workflowQuestion(item), { topicIds, existingIds }),
    }));

    const publishedRows = publishedQuestions.map((record) => ({
      id: record.question.id,
      workflowId: undefined,
      topicId: record.question.topicId,
      topicTitle: record.topicTitle,
      difficulty: record.question.difficulty,
      status: record.status,
      tags: record.question.tags,
      updatedAt: record.updatedAt,
      question: record.question,
      validationIssues: validateQuestion(record.question, { topicIds }),
    }));

    return [...workflowRows, ...publishedRows].filter((row) => {
      const search = bankSearch.trim().toLowerCase();
      const textMatch = !search || `${row.id} ${row.question.question} ${row.tags.join(" ")}`.toLowerCase().includes(search);
      const topicMatch = bankTopicFilter === "all" || row.topicId === bankTopicFilter;
      const difficultyMatch = bankDifficultyFilter === "all" || String(row.difficulty) === bankDifficultyFilter;
      const statusMatch = bankStatusFilter === "all" || row.status === bankStatusFilter;
      const tagMatch = !bankTagFilter.trim() || row.tags.some((tag) => tag.toLowerCase().includes(bankTagFilter.trim().toLowerCase()));
      return textMatch && topicMatch && difficultyMatch && statusMatch && tagMatch;
    });
  }, [bankDifficultyFilter, bankSearch, bankStatusFilter, bankTagFilter, bankTopicFilter, existingIds, publishedQuestions, topicIds, topics, workflowItems]);

  const submittedItems = workflowItems.filter((item) => item.status === "submitted");
  const ownDrafts = workflowItems.filter((item) => item.authorId === currentUser.id);
  const filteredAuditEvents = auditEvents;

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-[0.16em] text-(--muted)">{selectedSection?.label || "Dashboard"}</p>
            <h1 className="text-xl font-semibold">{selectedSection?.title || "Dashboard"}</h1>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg border border-(--border) px-3 py-2 text-sm text-(--muted) hover:border-(--accent) hover:text-(--accent)"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>

        <MessageBanner message={message} />

        {activeTab === "overview" && (
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {ENGINE_URL ? <EngineHealthPanel engineUrl={ENGINE_URL} /> : (
                <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 p-4 text-sm text-(--wrong)">Engine URL is not configured.</div>
              )}
              <div className="rounded-lg border border-(--border) bg-(--card) p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Runtime Snapshot</h2>
                    <p className="text-xs text-(--muted)">Status is refreshed every 15 seconds.</p>
                  </div>
                  <button type="button" onClick={() => void fetchOperationalStatus()} className="rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">
                    Refresh
                  </button>
                </div>
                {loadingStatus ? (
                  <p className="mt-4 text-sm text-(--muted)">Loading runtime status...</p>
                ) : adminStatus ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Engine" value={adminStatus.running ? "Running" : "Stopped"} />
                    <Metric label="Phase" value={adminStatus.phase || "unknown"} />
                    <Metric label="Question" value={`${adminStatus.questionIndex + 1}/${adminStatus.totalQuestions}`} />
                    <Metric label="Connected" value={String(adminStatus.connectedClients)} />
                    <Metric label="Current Topic" value={countdownTopicId || "Not selected"} />
                    <Metric label="Rooms" value={`${rooms.filter((room) => room.isActive).length}/${rooms.length} active`} />
                    <Metric label="Content Bank" value={contentStatus ? `${contentStatus.bankSize} questions` : "Unavailable"} />
                    <Metric label="Persistence" value={adminStatus.persistence?.configured ? "Configured" : "Not configured"} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-(--wrong)">Engine status is unavailable. Check the engine service and proxy configuration.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Panel title="Quick Links" description="Role-aware shortcuts for common operations.">
                <div className="grid gap-2">
                  {visibleSections.filter((section) => section.id !== "overview").map((section) => (
                    <button key={section.id} type="button" onClick={() => setActiveTab(section.id)} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-left text-sm hover:border-(--accent) hover:text-(--accent)">
                      {section.label}
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Workflow Summary" description="Transitional workflow state for this dashboard session.">
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Drafts" value={String(workflowItems.filter((item) => item.status === "draft").length)} />
                  <Metric label="Submitted" value={String(submittedItems.length)} />
                  <Metric label="Changes" value={String(workflowItems.filter((item) => item.status === "changes_requested").length)} />
                  <Metric label="Approved" value={String(workflowItems.filter((item) => item.status === "approved").length)} />
                </div>
              </Panel>
            </div>
          </section>
        )}

        {activeTab === "live" && (
          <Panel title="Live Host Controls" description="Room-scoped controls use the server-side admin proxy.">
            <RoomSelector rooms={rooms} selectedRoomId={selectedRoomId} onChange={setSelectedRoomId} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Room" value={currentRoom?.name || "Global"} />
              <Metric label="Phase" value={adminStatus?.phase || "Unavailable"} />
              <Metric label="Question" value={adminStatus ? `${adminStatus.questionIndex + 1}/${adminStatus.totalQuestions}` : "Unavailable"} />
              <Metric label="Time Remaining" value={adminStatus ? `${Math.max(0, Math.ceil((adminStatus.timeRemainingMs || 0) / 1000))}s` : "Unavailable"} />
              <Metric label="Players" value={String(currentRoom?.gameplayPlayerCount ?? adminStatus?.playerCount ?? 0)} />
            </div>
            <div className="rounded-lg border border-(--border) bg-background p-3 text-sm text-(--muted)">
              Leaderboard top scorers and streaks are not exposed by the current admin status endpoint. Add a read-only engine endpoint before showing live player rankings here.
            </div>
            <div className="flex flex-wrap gap-2">
              {(["start", "resume", "pause", "next"] as const).map((action) => (
                <button key={action} type="button" onClick={() => void engineAction(action)} disabled={loading} className="min-h-11 rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {action[0].toUpperCase() + action.slice(1)}
                </button>
              ))}
              <button type="button" onClick={() => void engineAction("pause")} disabled={loading} className="min-h-11 rounded-lg border border-yellow-500 px-4 py-2 text-sm text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50">
                Emergency Pause
              </button>
              <button type="button" onClick={() => runWithDangerConfirm(dangerousActions.resetRoom(currentRoom?.name || "selected room"), () => engineAction("reset"))} disabled={loading} className="min-h-11 rounded-lg border border-(--wrong) px-4 py-2 text-sm text-(--wrong) hover:bg-(--wrong)/10 disabled:opacity-50">
                Reset
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(160px,1fr)_120px_auto_auto_auto]">
              <select value={countdownTopicId} onChange={(event) => setCountdownTopicId(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
              </select>
              <input type="number" min={1} max={120} value={countdownSeconds} onChange={(event) => setCountdownSeconds(Math.max(1, Math.min(120, Number(event.target.value) || 10)))} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" aria-label="Countdown seconds" />
              <button type="button" onClick={() => void topicProxy.countdownTopic(countdownSeconds, countdownTopicId, selectedRoomId).then(() => fetchOperationalStatus())} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">
                Countdown
              </button>
              <button type="button" onClick={() => runWithDangerConfirm(dangerousActions.skipTopic(), async () => { const result = await topicProxy.skipTopic(selectedRoomId); setMessage(result.success ? { type: "success", text: "Topic skipped." } : { type: "error", text: result.error || "Failed to skip topic." }); await fetchOperationalStatus(); })} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--wrong) hover:text-(--wrong)">
                Skip
              </button>
              <button type="button" onClick={() => runWithDangerConfirm(dangerousActions.replayTopic(), async () => { const result = await topicProxy.replayTopic(selectedRoomId); setMessage(result.success ? { type: "success", text: "Topic replayed." } : { type: "error", text: result.error || "Failed to replay topic." }); await fetchOperationalStatus(); })} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--wrong) hover:text-(--wrong)">
                Replay
              </button>
            </div>
          </Panel>
        )}

        {activeTab === "rooms" && (
          <Panel title="Room Operations" description="Create, select, copy, and close live rooms.">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_auto]">
              <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="New room name" className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
              <input value={newRoomId} onChange={(event) => setNewRoomId(event.target.value.replace(/[^a-z0-9-]/g, "").toLowerCase())} placeholder="Optional room-id" className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
              <button type="button" onClick={() => void createRoom()} disabled={loading || !newRoomName.trim()} className="min-h-11 rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Create Room</button>
            </div>
            <ResponsiveTable headers={["Room", "Status", "Players", "Live", "Play", "Actions"]}>
              {rooms.map((room) => (
                <div key={room.roomId} className="grid gap-2 border-b border-(--border) px-3 py-3 text-sm last:border-0 md:grid-cols-[minmax(0,1.2fr)_100px_80px_80px_80px_220px]">
                  <div className="min-w-0"><p className="truncate font-medium">{room.name}</p><p className="truncate text-xs text-(--muted)">{room.roomId}</p></div>
                  <StatusBadge label={room.isActive ? "Active" : "Closed"} tone={statusClass(room.isActive ? "active" : "closed")} />
                  <span className="font-mono">{room.playerCount}</span>
                  <span className="font-mono">{room.connectedClients}</span>
                  <span className="font-mono">{room.gameplayPlayerCount}</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedRoomId(room.roomId)} className="rounded-lg border border-(--border) px-2 py-1 text-xs hover:border-(--accent)">Select</button>
                    <button type="button" onClick={() => void copyRoomUrl(room.roomId)} className="rounded-lg border border-(--border) px-2 py-1 text-xs hover:border-(--accent)">Copy URL</button>
                    {room.roomId !== "global" && room.isActive && (
                      <button type="button" onClick={() => void closeRoom(room)} className="rounded-lg border border-(--wrong) px-2 py-1 text-xs text-(--wrong) hover:bg-(--wrong)/10">Close</button>
                    )}
                  </div>
                </div>
              ))}
              {rooms.length === 0 && <EmptyState text="No rooms returned by the engine." />}
            </ResponsiveTable>
          </Panel>
        )}

        {activeTab === "bank" && (
          <Panel title="Question Bank" description="Search published content and persisted workflow items.">
            <div className="grid gap-3 md:grid-cols-5">
              <input value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="Search text, ID, tags" className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm md:col-span-2" />
              <select value={bankTopicFilter} onChange={(event) => setBankTopicFilter(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                <option value="all">All topics</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
              </select>
              <select value={bankDifficultyFilter} onChange={(event) => setBankDifficultyFilter(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                <option value="all">All difficulty</option>
                {[1, 2, 3, 4, 5].map((difficulty) => <option key={difficulty} value={difficulty}>Difficulty {difficulty}</option>)}
              </select>
              <select value={bankStatusFilter} onChange={(event) => setBankStatusFilter(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                <option value="all">All statuses</option>
                {["published", "draft", "submitted", "changes_requested", "approved", "rejected"].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input value={bankTagFilter} onChange={(event) => setBankTagFilter(event.target.value)} placeholder="Tag filter" className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <ResponsiveTable headers={["ID", "Topic", "Difficulty", "Status", "Tags", "Validation"]}>
                {filteredQuestionRows.slice(0, 80).map((row) => (
                  <button key={`${row.status}-${row.id}`} type="button" onClick={() => setSelectedQuestionId(row.id)} className="grid w-full gap-2 border-b border-(--border) px-3 py-3 text-left text-sm last:border-0 hover:bg-(--ticker-bg) md:grid-cols-[110px_minmax(0,1fr)_80px_120px_minmax(0,1fr)_110px]">
                    <span className="font-mono text-(--accent)">{row.id}</span>
                    <span className="truncate">{row.topicTitle}</span>
                    <span>{row.difficulty}</span>
                    <StatusBadge label={row.status} tone={statusClass(row.status)} />
                    <span className="truncate text-xs text-(--muted)">{row.tags.join(", ") || "No tags"}</span>
                    <span className={row.validationIssues.length ? "text-yellow-300" : "text-green-400"}>{row.validationIssues.length ? `${row.validationIssues.length} issue(s)` : "Valid"}</span>
                  </button>
                ))}
                {filteredQuestionRows.length === 0 && <EmptyState text="No questions match the current filters." />}
              </ResponsiveTable>
              <QuestionDetail
                question={(filteredQuestionRows.find((row) => row.id === selectedQuestionId)?.question || selectedPublishedRecord?.question) as Question | undefined}
                issues={(filteredQuestionRows.find((row) => row.id === selectedQuestionId)?.validationIssues || [])}
                canDuplicate={canAuthor}
                onDuplicate={duplicateQuestion}
              />
            </div>
          </Panel>
        )}

        {activeTab === "authoring" && (
          <div className="space-y-4">
            {hasPermission(currentUser.role, "content:import") && (
              <Panel title="Batch Import" description="Imports still go through the server-side admin proxy and CSRF checks.">
                <BatchImport topics={topics.map((topic) => ({ id: topic.id, title: topic.title }))} />
              </Panel>
            )}
            {canAuthor && (
              <Panel title="Create Draft Question" description="Draft workflow items are saved by authenticated server routes.">
                <section className="rounded-lg border border-(--border) bg-background p-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <FieldLabel>Topic</FieldLabel>
                      <select value={selectedTopicId} onChange={(event) => handleTopicChange(event.target.value)} className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>ID Prefix</FieldLabel>
                      <input value={customPrefix} onChange={(event) => handlePrefixChange(event.target.value.toLowerCase().replace(/[^a-z]/g, ""))} placeholder={getDefaultPrefix(selectedTopicId)} className="w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
                    </div>
                    <Metric label="Existing Questions" value={String(selectedTopic?.questionCount || 0)} />
                    <Metric label="Next ID" value={nextQuestionId} />
                  </div>
                </section>
                <div className="grid gap-6 lg:grid-cols-2">
                  <AuthorForm
                    formData={formData}
                    setFormData={setFormData}
                    nextQuestionId={nextQuestionId}
                    onDownload={() => downloadJson(questionJson)}
                    onCopy={() => void copyJson(questionJson)}
                    onAddToQueue={() => void createDraftFromForm("draft")}
                    onReset={resetForm}
                  />
                  <div className="space-y-4">
                    <JsonPreview question={questionJson} />
                    <ValidationPanel issues={draftValidationIssues} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void createDraftFromForm("draft")} className="min-h-11 rounded-lg border border-(--border) px-4 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Save Draft</button>
                      <button type="button" onClick={() => void createDraftFromForm("submitted")} disabled={hasBlockingValidationIssues(draftValidationIssues)} className="min-h-11 rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Submit for Review</button>
                    </div>
                  </div>
                </div>
              </Panel>
            )}
            <Panel title="My Drafts and Submissions" description="Review comments and status from persisted workflow storage.">
              {workflowLoading && <EmptyState text="Loading persisted workflow items..." />}
              {workflowUnavailable && <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">Workflow persistence is unavailable. Draft actions will not be shown as saved until the server route recovers.</div>}
              {ownDrafts.map((item) => (
                <WorkflowCard key={item.id} item={item} onSelect={() => setSelectedWorkflowId(item.id)} onSubmit={() => void submitWorkflowItem(item)} onArchive={() => void archiveWorkflowItem(item)} canSubmit={hasPermission(currentUser.role, "content:submit_review")} canArchive={true} />
              ))}
              {!workflowLoading && ownDrafts.length === 0 && <EmptyState text="No persisted draft workflow items are visible for your user." />}
            </Panel>
          </div>
        )}

        {activeTab === "review" && (
          <Panel title="Review Queue" description="Approve, reject, or request changes on submitted questions.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
              <div className="space-y-3">
                {workflowLoading && <EmptyState text="Loading persisted review queue..." />}
                {submittedItems.map((item) => (
                  <WorkflowCard key={item.id} item={item} onSelect={() => setSelectedWorkflowId(item.id)} canSubmit={false} />
                ))}
                {!workflowLoading && submittedItems.length === 0 && <EmptyState text="No submitted questions are waiting for review." />}
              </div>
              <div className="space-y-4 rounded-lg border border-(--border) bg-background p-4">
                {selectedWorkflowItem ? (
                  <>
                    <QuestionDetail question={workflowQuestion(selectedWorkflowItem)} issues={validateQuestion(workflowQuestion(selectedWorkflowItem), { topicIds, existingIds })} canDuplicate={false} />
                    <div className="space-y-2">
                      <FieldLabel>Reviewer comment</FieldLabel>
                      <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} className="min-h-28 w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
                      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={doctrinalFlag} onChange={(event) => setDoctrinalFlag(event.target.checked)} /> Flag doctrinal issue</label>
                      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={referenceFlag} onChange={(event) => setReferenceFlag(event.target.checked)} /> Flag reference issue</label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void reviewWorkflowItem(selectedWorkflowItem, "approved")} className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">Approve</button>
                      <button type="button" onClick={() => void reviewWorkflowItem(selectedWorkflowItem, "changes_requested")} className="min-h-11 rounded-lg border border-yellow-500 px-4 py-2 text-sm text-yellow-300">Request Changes</button>
                      <button type="button" onClick={() => void reviewWorkflowItem(selectedWorkflowItem, "rejected")} className="min-h-11 rounded-lg border border-(--wrong) px-4 py-2 text-sm text-(--wrong)">Reject</button>
                      {selectedWorkflowItem.status === "approved" && (
                        <button type="button" onClick={() => void publishWorkflowItem(selectedWorkflowItem)} className="min-h-11 rounded-lg border border-green-500 px-4 py-2 text-sm text-green-300">Publish</button>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState text="Select a submitted question to review." />
                )}
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "topics" && (
          <Panel title="Topic Management" description="Validate topic metadata and edit the live topic sequence through the admin proxy.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="space-y-3">
                {topics.map((topic) => {
                  const issues = validateTopic(topic);
                  return (
                    <div key={topic.id} className="rounded-lg border border-(--border) bg-background p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div><h3 className="font-medium">{topic.title}</h3><p className="text-xs text-(--muted)">{topic.id}</p></div>
                        <StatusBadge label={issues.length ? `${issues.length} issue(s)` : "Valid"} tone={issues.length ? "bg-yellow-500/15 text-yellow-300" : "bg-green-500/15 text-green-400"} />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Metric label="Questions" value={String(topic.questionCount)} />
                        <Metric label="Difficulty" value={topic.difficultyRange ? `${topic.difficultyRange[0]}-${topic.difficultyRange[1]}` : "Not declared"} />
                        <Metric label="Tags" value={topic.tags.join(", ") || "None"} />
                      </div>
                      <p className="mt-3 text-xs text-(--muted)">Question IDs: {topic.existingIds.slice(0, 12).join(", ")}{topic.existingIds.length > 12 ? "..." : ""}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-4 rounded-lg border border-(--border) bg-background p-4">
                <h3 className="text-sm font-semibold">Sequence Editor</h3>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select value={topicToAdd} onChange={(event) => setTopicToAdd(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                    {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                  </select>
                  <button type="button" onClick={() => mutateSequence([...sequenceConfig.topicSequence, topicToAdd])} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent)">Add</button>
                </div>
                <div className="space-y-2">
                  {sequenceConfig.topicSequence.map((topicId, index) => (
                    <div key={`${topicId}-${index}`} className="flex items-center gap-2 rounded-lg border border-(--border) px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{topics.find((topic) => topic.id === topicId)?.title || topicId}</span>
                      <button type="button" onClick={() => mutateSequence(moveItem(sequenceConfig.topicSequence, index, index - 1))} disabled={index === 0} className="rounded border border-(--border) px-2 py-1 text-xs disabled:opacity-40">Up</button>
                      <button type="button" onClick={() => mutateSequence(moveItem(sequenceConfig.topicSequence, index, index + 1))} disabled={index === sequenceConfig.topicSequence.length - 1} className="rounded border border-(--border) px-2 py-1 text-xs disabled:opacity-40">Down</button>
                      <button type="button" onClick={() => mutateSequence(sequenceConfig.topicSequence.filter((_, itemIndex) => itemIndex !== index))} className="rounded border border-(--wrong) px-2 py-1 text-xs text-(--wrong)">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={sequenceConfig.autoAdvance} onChange={(event) => setSequenceConfig((config) => ({ ...config, autoAdvance: event.target.checked }))} /> Auto advance</label>
                  <NumberInput label="Countdown seconds" value={sequenceConfig.countdownSeconds} onChange={(value) => setSequenceConfig((config) => ({ ...config, countdownSeconds: value }))} />
                  <NumberInput label="Congrats ms" value={sequenceConfig.congratsDisplayTimeMs} onChange={(value) => setSequenceConfig((config) => ({ ...config, congratsDisplayTimeMs: value }))} />
                  <LoopSelect label="Topic loop" value={String(sequenceConfig.topicLoopMode)} onChange={(value) => setSequenceConfig((config) => ({ ...config, topicLoopMode: value }))} />
                  <LoopSelect label="Series loop" value={String(sequenceConfig.seriesLoopMode)} onChange={(value) => setSequenceConfig((config) => ({ ...config, seriesLoopMode: value }))} />
                </div>
                {sequenceIssues.length > 0 && <ValidationPanel issues={sequenceIssues.map((issue) => ({ field: issue.field, message: issue.message, severity: "error" }))} />}
                <button type="button" onClick={() => void saveSequence()} disabled={loading || sequenceIssues.length > 0} className="min-h-11 w-full rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save Sequence</button>
                <button type="button" onClick={() => void setPool()} disabled={loading || !contentStatus || contentStatus.bankSize === 0} className="min-h-11 w-full rounded-lg border border-(--border) px-4 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Set Quiz Pool From Selection</button>
                <div className="space-y-2">
                  <FieldLabel>Pool topics</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => (
                      <button key={topic.id} type="button" onClick={() => setSelectedPoolTopics((items) => items.includes(topic.id) ? items.filter((id) => id !== topic.id) : [...items, topic.id])} className={`rounded-lg border px-2 py-1 text-xs ${selectedPoolTopics.includes(topic.id) ? "border-(--accent) text-(--accent)" : "border-(--border)"}`}>{topic.id}</button>
                    ))}
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={shufflePool} onChange={(event) => setShufflePool(event.target.checked)} /> Shuffle pool</label>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "audit" && (
          <Panel title="Audit Visibility" description="Persisted server-side workflow, admin, and security audit events.">
            {auditUnavailable && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                Audit persistence is unavailable or your role cannot view these events.
              </div>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <FieldLabel>Persisted audit events</FieldLabel>
                <select value={auditTypeFilter} onChange={(event) => setAuditTypeFilter(event.target.value)} className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
                  <option value="all">All types</option>
                  {Array.from(new Set(auditEvents.map((event) => event.eventType))).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search actor, action, resource" className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
                <button type="button" onClick={() => void fetchAuditEvents()} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent)">Refresh</button>
              </div>
              {auditLoading && <EmptyState text="Loading persisted audit events..." />}
              {filteredAuditEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-(--border) bg-background p-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{event.action}</span>
                    <span className="text-xs text-(--muted)">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-xs text-(--muted)">{event.eventType} by {event.actorName} ({event.actorRole}) on {event.resourceType}{event.resourceId ? ` ${event.resourceId}` : ""} | {event.status} | {event.severity}</p>
                </div>
              ))}
              {!auditLoading && filteredAuditEvents.length === 0 && <EmptyState text="No persisted audit events match the current filter." />}
            </div>
          </Panel>
        )}

        {activeTab === "settings" && (
          <Panel title="Settings" description="Environment status and dashboard references.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Role Source" value={currentUser.source} />
              <Metric label="Engine URL" value={ENGINE_URL ? "Configured" : "Missing"} />
              <Metric label="GitHub Content" value={contentStatus?.gitHubConfigured ? "Configured" : "Unavailable"} />
              <Metric label="Persistence" value={adminStatus?.persistence?.configured ? "Configured" : "Not configured"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/library" className="min-h-11 rounded-lg border border-(--border) px-4 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Library</Link>
              <Link href="/mobile" className="min-h-11 rounded-lg border border-(--border) px-4 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Mobile</Link>
              <button type="button" onClick={() => void handleLogout()} className="min-h-11 rounded-lg border border-(--wrong) px-4 py-2 text-sm text-(--wrong)">Log out</button>
            </div>

            <div className="space-y-3 rounded-lg border border-(--border) bg-background p-4">
              <div>
                <h3 className="text-sm font-semibold">Security</h3>
                <p className="text-xs text-(--muted)">Change the password for your current account.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(event) => setCurrentPasswordInput(event.target.value)}
                  placeholder="Current password"
                  className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(event) => setNewPasswordInput(event.target.value)}
                  placeholder="New password"
                  className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(event) => setConfirmPasswordInput(event.target.value)}
                  placeholder="Confirm new password"
                  className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void changePassword()}
                  disabled={passwordLoading || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput}
                  className="min-h-11 rounded-lg bg-(--accent) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Update password
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void revokeOtherSessions()}
                  disabled={revokeSessionsLoading}
                  className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) disabled:opacity-50"
                >
                  Sign out other sessions
                </button>
              </div>
            </div>

            {canManageUsers && (
              <div className="space-y-3 rounded-lg border border-(--border) bg-background p-4">
                <div className="space-y-3 rounded-lg border border-(--border) bg-(--card) p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Staff Invite Settings</h3>
                      <p className="text-xs text-(--muted)">Manage the invite code used for elevated signup access.</p>
                    </div>
                    <button type="button" onClick={() => void fetchInviteSettings()} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent)">Refresh</button>
                  </div>

                  {inviteSettings && (
                    <p className="text-xs text-(--muted)">Source: {inviteSettings.source} | Updated: {formatTimestamp(inviteSettings.updatedAt)}</p>
                  )}

                  <div className="grid gap-2 md:grid-cols-[1fr_180px_auto_auto]">
                    <input
                      value={inviteCodeInput}
                      onChange={(event) => setInviteCodeInput(event.target.value)}
                      placeholder="Staff invite code"
                      className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                    />
                    <select
                      value={inviteRoleInput}
                      onChange={(event) => setInviteRoleInput(event.target.value as InviteStaffRole)}
                      className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                    >
                      <option value="host">Host</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="author">Author</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void saveInviteSettings(false)}
                      disabled={inviteLoading || !inviteCodeInput.trim()}
                      className="min-h-11 rounded-lg bg-(--accent) px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveInviteSettings(true)}
                      disabled={inviteLoading}
                      className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) disabled:opacity-50"
                    >
                      Rotate
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Users</h3>
                    <p className="text-xs text-(--muted)">Manage account roles and activation state.</p>
                  </div>
                  <button type="button" onClick={() => void fetchUsers()} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent)">Refresh</button>
                </div>

                {usersLoading && <EmptyState text="Loading users..." />}

                {!usersLoading && managedUsers.length > 0 && (
                  <div className="space-y-2">
                    {managedUsers.map((user) => (
                      <div key={user.id} className="rounded-lg border border-(--border) p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-medium">{user.displayName} <span className="text-xs text-(--muted)">({user.email})</span></p>
                            <p className="text-xs text-(--muted)">Account: {user.accountType} | Last login: {formatTimestamp(user.lastLoginAt)}{user.id === currentUser.id ? " | Current session" : ""}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={user.role}
                              onChange={(event) => void updateManagedUser({ userId: user.id, role: event.target.value as ManagedUser["role"] })}
                              disabled={updatingUserId === user.id || user.id === currentUser.id}
                              className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                            >
                              {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                            </select>
                            <select
                              value={user.status}
                              onChange={(event) => void updateManagedUser({ userId: user.id, status: event.target.value as ManagedUser["status"] })}
                              disabled={updatingUserId === user.id || user.id === currentUser.id}
                              className="min-h-11 rounded-lg border border-(--border) bg-background px-3 py-2 text-sm"
                            >
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!usersLoading && managedUsers.length === 0 && <EmptyState text="No user accounts found." />}
              </div>
            )}
          </Panel>
        )}
      </div>

      <DangerousConfirmModal
        pending={pendingDanger}
        onCancel={() => setPendingDanger(null)}
        onConfirm={(typedValue) => void confirmDangerousAction(typedValue)}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-(--border) bg-background px-3 py-2">
      <p className="text-xs text-(--muted)">{label}</p>
      <p className="mt-1 wrap-break-word text-sm font-medium">{value}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-(--border) bg-(--card) p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-(--muted)">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-(--border) p-4 text-sm text-(--muted)">{text}</div>;
}

function ResponsiveTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-(--border)">
      <div className="hidden border-b border-(--border) bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--muted) md:grid md:grid-cols-[inherit]">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div>{children}</div>
    </div>
  );
}

function QuestionDetail({
  question,
  issues,
  canDuplicate,
  onDuplicate,
}: {
  question?: Question;
  issues: ValidationIssue[];
  canDuplicate: boolean;
  onDuplicate?: (question: Question) => void;
}) {
  if (!question) return <EmptyState text="Select a question to view details." />;

  return (
    <div className="space-y-3 rounded-lg border border-(--border) bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-(--accent)">{question.id}</p>
          <h3 className="mt-1 font-semibold">{question.question}</h3>
        </div>
        {canDuplicate && onDuplicate && (
          <button type="button" onClick={() => onDuplicate(question)} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Duplicate</button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["A", "B", "C", "D"] as const).map((choiceId) => (
          <div key={choiceId} className={`rounded-lg border px-3 py-2 text-sm ${question.correctId === choiceId ? "border-green-500/40 bg-green-500/10" : "border-(--border)"}`}>
            <span className="font-mono text-xs text-(--muted)">{choiceId}</span> {question.choices[choiceId]}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-(--border) p-3">
        <p className="text-sm font-medium">{question.teaching.title || "Teaching"}</p>
        <p className="mt-1 text-sm text-(--text-secondary)">{question.teaching.body || "No teaching body."}</p>
        <p className="mt-2 text-xs text-(--muted)">Refs: {question.teaching.refs.join(", ") || "None"}</p>
      </div>
      <p className="text-xs text-(--muted)">Topic: {question.topicId} | Difficulty: {question.difficulty} | Tags: {question.tags.join(", ") || "None"}</p>
      <ValidationPanel issues={issues} />
    </div>
  );
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">Validation passed.</div>;
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
      <p className="text-sm font-medium text-yellow-200">Validation issues</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-yellow-100">
        {issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
      </ul>
    </div>
  );
}

function WorkflowCard({
  item,
  onSelect,
  onSubmit,
  onArchive,
  canSubmit,
  canArchive = false,
}: {
  item: DraftQuestion;
  onSelect: () => void;
  onSubmit?: () => void;
  onArchive?: () => void;
  canSubmit: boolean;
  canArchive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-(--border) bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-(--accent)">{item.questionId || item.id}</p>
          <p className="font-medium">{item.question || "Untitled question"}</p>
          <p className="mt-1 text-xs text-(--muted)">Updated {formatTimestamp(item.updatedAt)} | v{item.version}</p>
        </div>
        <StatusBadge label={item.status} tone={statusClass(item.status)} />
      </div>
      {item.reviewComments.length > 0 && (
        <div className="mt-3 rounded-lg border border-(--border) p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">Review comments</p>
          {item.reviewComments.map((comment) => (
            <p key={comment.id} className="mt-2 text-(--text-secondary)">{comment.body}</p>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onSelect} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--accent) hover:text-(--accent)">Open</button>
        {canSubmit && ["draft", "changes_requested"].includes(item.status) && (
          <button type="button" onClick={onSubmit} className="min-h-11 rounded-lg bg-(--accent) px-3 py-2 text-sm font-medium text-white">Submit</button>
        )}
        {canArchive && item.status !== "archived" && (
          <button type="button" onClick={onArchive} className="min-h-11 rounded-lg border border-(--border) px-3 py-2 text-sm hover:border-(--wrong) hover:text-(--wrong)">Archive</button>
        )}
      </div>
    </div>
  );
}

function RoomSelector({
  rooms,
  selectedRoomId,
  onChange,
}: {
  rooms: AdminRoomStatus[];
  selectedRoomId: string | null;
  onChange: (roomId: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel>Selected room</FieldLabel>
      <select value={selectedRoomId || ""} onChange={(event) => onChange(event.target.value || null)} className="min-h-11 w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
        <option value="">Global engine</option>
        {rooms.map((room) => <option key={room.roomId} value={room.roomId}>{room.name} ({room.roomId})</option>)}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="min-h-11 w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm" />
    </div>
  );
}

function LoopSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: "off" | "once" | "infinite") => void }) {
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={(event) => onChange(event.target.value as "off" | "once" | "infinite")} className="min-h-11 w-full rounded-lg border border-(--border) bg-background px-3 py-2 text-sm">
        <option value="off">Off</option>
        <option value="once">Once</option>
        <option value="infinite">Infinite</option>
      </select>
    </div>
  );
}

function moveItem(items: string[], from: number, to: number): string[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function downloadJson(question: Question) {
  const blob = new Blob([JSON.stringify(question, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${question.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyJson(question: Question) {
  await navigator.clipboard.writeText(JSON.stringify(question, null, 2));
}
