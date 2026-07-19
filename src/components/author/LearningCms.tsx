"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const entityTabs = ["programmes", "subjects", "groups", "lessons", "sections", "objectives", "questions", "question-options", "question-contexts", "sources", "content-sources", "prerequisites"] as const;
const operationalTabs = ["review", "calendar", "audit", "import-export"] as const;
type Entity = (typeof entityTabs)[number];
type Tab = Entity | (typeof operationalTabs)[number];

type CmsRecord = {
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  shortDescription?: string;
  description?: string;
  publicationStatus?: string;
  status?: string;
  reviewStatus?: string;
  governanceStage?: string;
  visibility?: string;
  displayOrder?: number;
  scheduledFor?: string;
  createdAt?: string;
  updatedAt?: string;
  brokenReferences?: number;
  licenceWarnings?: number;
  version?: number;
  [key: string]: unknown;
};

type GovernedEntity = "lessons" | "sections" | "questions" | "sources";

type GovernanceFinding = {
  code: string;
  severity: "info" | "warning" | "error";
  reviewStage: string;
  message: string;
};

type GovernanceValidation = {
  entity: GovernedEntity;
  entityKind: string;
  id: string;
  version: number;
  status: string;
  governanceStage: string;
  findings: GovernanceFinding[];
  reviews: Array<{
    stage: string;
    decision: string;
    reviewerRole: string;
    specialism: string | null;
    comment: string | null;
  }>;
  summary: {
    errors: number;
    warnings: number;
    publishable: boolean;
    machinePassIsSufficient: false;
  };
};

const governedEntityAliases: Record<string, GovernedEntity> = {
  lessons: "lessons",
  lesson: "lessons",
  sections: "sections",
  lesson_section: "sections",
  questions: "questions",
  question: "questions",
  sources: "sources",
  source: "sources",
};

function governedEntityFor(tab: Tab, record: CmsRecord): GovernedEntity | null {
  const value = String(record.entity || record.entityKind || tab);
  return governedEntityAliases[value] ?? null;
}

type FormState = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  publicationStatus: string;
  visibility: string;
  displayOrder: string;
  parentId: string;
  structuredContent: string;
};

const emptyForm: FormState = { id: "", title: "", slug: "", shortDescription: "", publicationStatus: "draft", visibility: "public", displayOrder: "0", parentId: "", structuredContent: "{}" };

const commonEntities = new Set<Entity>(["programmes", "subjects", "groups", "lessons", "sections", "sources"]);
const extraFields: Partial<Record<Entity, readonly string[]>> = {
  programmes: ["coverAssetPath", "estimatedMinutes", "level", "apologiaGraphRelationship", "searchMetadata", "localisation"],
  subjects: ["coverAssetPath", "estimatedMinutes", "level", "apologiaGraphRelationship", "searchMetadata", "localisation"],
  groups: ["coverAssetPath", "estimatedMinutes", "level", "apologiaGraphRelationship", "searchMetadata", "localisation", "masteryThresholdPercent", "masteryPolicy", "isInitiallyUnlocked", "isOptionalExpertChallenge"],
  lessons: ["coverAssetPath", "estimatedMinutes", "level", "apologiaGraphRelationship", "searchMetadata", "localisation"],
  sections: ["parentSectionId", "blockKind", "content", "attributionMode"],
  objectives: ["code", "description", "masteryWeight"],
  questions: ["stableKey", "groupId", "lessonId", "objectiveId", "difficulty", "difficultyMode", "trickCategory", "equivalenceKey", "qualityFlags", "questionType", "prompt", "correctAnswerExplanation", "privateNotes", "misconceptionIds", "denominationScope", "rightsMetadata", "answerPolicy", "retirementStatus", "quarantineReason"],
  "question-options": ["position", "label", "content", "isCorrect", "explanation", "misconceptionId"],
  "question-contexts": ["context", "programmeId", "subjectId", "groupId", "lessonId", "enabled", "weight", "settings", "validFrom", "validUntil"],
  sources: ["sourceKind", "author", "publisher", "publicationYear", "url", "citation", "rightsMetadata", "authorityCategory", "copyrightStatus", "permissionStatus", "licenceIdentifier", "attributionText", "quoteLimitWords", "translationMetadata", "prohibitedUseFlags", "permissionExpiresAt", "rightsReviewDueAt", "approvedDomainId"],
  "content-sources": ["entityKind", "sourceId", "relationshipType", "citationLocator", "quotedText", "rightsMetadata", "displayOrder"],
  prerequisites: ["kind", "prerequisiteId", "requirement", "minimumScorePercent"],
};

function editableExtras(entity: Entity, record: CmsRecord): Record<string, unknown> {
  return Object.fromEntries((extraFields[entity] ?? []).flatMap((field) => (
    Object.prototype.hasOwnProperty.call(record, field) ? [[field, record[field]]] : []
  )));
}

function parentField(entity: Entity): string | null {
  if (entity === "subjects") return "programmeId";
  if (entity === "groups") return "subjectId";
  if (["lessons", "sections", "objectives"].includes(entity)) return entity === "lessons" ? "groupId" : "lessonId";
  if (entity === "questions") return "subjectId";
  if (["question-options", "question-contexts"].includes(entity)) return "questionId";
  if (entity === "content-sources") return "entityId";
  if (entity === "prerequisites") return "dependentId";
  return null;
}

async function csrfHeaders() {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Your staff session is unavailable. Sign in again.");
  const body = await response.json() as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("Security token unavailable.");
  return { "content-type": "application/json", "x-csrf-token": body.csrfToken };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body?.error && typeof body.error.message === "string" ? body.error.message : `Request failed (${response.status})`);
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

function displayName(record: CmsRecord) { return record.title || record.name || String(record.stableKey || record.code || record.label || record.slug || record.id); }

function StatusPill({ value }: { value?: string }) {
  return <span className="rounded-full border border-(--border) px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-(--text-muted)">{value || "draft"}</span>;
}

export default function LearningCms() {
  const [tab, setTab] = useState<Tab>("programmes");
  const [transferEntity, setTransferEntity] = useState<Entity>("programmes");
  const [records, setRecords] = useState<CmsRecord[]>([]);
  const [selected, setSelected] = useState<CmsRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [governance, setGovernance] = useState<GovernanceValidation | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const isEntity = entityTabs.includes(tab as Entity);
  const endpoint = isEntity ? `/api/v1/admin/learning/${tab}` : tab === "review" ? "/api/v1/admin/learning/workflow" : tab === "audit" ? "/api/v1/admin/learning/audit" : tab === "calendar" ? "/api/v1/admin/learning/calendar" : "";

  const loadGovernance = useCallback(async (record: CmsRecord, currentTab: Tab) => {
    const entity = governedEntityFor(currentTab, record);
    if (!entity) {
      setGovernance(null);
      return;
    }
    setValidationLoading(true);
    try {
      setGovernance(await request<GovernanceValidation>(
        `/api/v1/admin/learning/workflow/${encodeURIComponent(record.id)}/validation?entity=${entity}&forPublication=true`,
      ));
    } catch (cause) {
      setGovernance(null);
      setError(cause instanceof Error ? cause.message : "Governance validation is unavailable.");
    } finally {
      setValidationLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!endpoint) { setRecords([]); return; }
    setLoading(true); setError("");
    try { const loaded = await request<CmsRecord[]>(`${endpoint}?limit=100&offset=0`); setRecords(loaded.map((record) => ({ ...record, publicationStatus: record.status ?? record.publicationStatus }))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Learning CMS data is unavailable."); }
    finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const visible = useMemo(() => records.filter((record) => {
    const haystack = `${displayName(record)} ${record.slug || ""}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!statusFilter || record.status === statusFilter || record.publicationStatus === statusFilter || record.reviewStatus === statusFilter);
  }).sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)), [records, search, statusFilter]);

  const choose = (record: CmsRecord) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const normalizedRecord = { ...record, publicationStatus: record.status ?? record.publicationStatus };
    setSelected(normalizedRecord);
    const entity = tab as Entity;
    const parent = parentField(entity);
    setForm({ id: record.id, title: String(record.title || record.name || ""), slug: String(record.slug || ""), shortDescription: String(record.shortDescription || record.description || ""), publicationStatus: String(record.status || record.publicationStatus || "draft"), visibility: String(record.visibility || "public"), displayOrder: String(record.displayOrder || 0), parentId: String(parent ? record[parent] || "" : ""), structuredContent: JSON.stringify(editableExtras(entity, record), null, 2) });
    setDirty(false); setMessage(""); setError("");
    void loadGovernance(normalizedRecord, tab);
  };

  const newRecord = () => { if (dirty && !window.confirm("Discard unsaved changes?")) return; setSelected(null); setGovernance(null); setForm(emptyForm); setDirty(false); setMessage(""); };
  const updateForm = (key: keyof FormState, value: string) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isEntity) return;
    setSaving(true); setError(""); setMessage("");
    try {
      let additionalFields: unknown = {};
      try { additionalFields = JSON.parse(form.structuredContent || "{}"); } catch { throw new Error("Additional fields must be valid JSON."); }
      if (!additionalFields || typeof additionalFields !== "object" || Array.isArray(additionalFields)) throw new Error("Additional fields must be a JSON object.");
      const headers = await csrfHeaders();
      const body: Record<string, unknown> = { ...(additionalFields as Record<string, unknown>) };
      if (commonEntities.has(tab as Entity)) {
        Object.assign(body, { title: form.title.trim(), slug: form.slug.trim(), visibility: form.visibility });
        if (tab !== "sources") body.displayOrder = Number(form.displayOrder || 0);
        if (tab !== "sources" && tab !== "sections") body.shortDescription = form.shortDescription.trim();
      }
      const parent = parentField(tab as Entity);
      if (parent) body[parent] = form.parentId || null;
      const url = selected ? `${endpoint}/${encodeURIComponent(selected.id)}` : endpoint;
      const saved = await request<CmsRecord>(url, { method: selected ? "PATCH" : "POST", headers, body: JSON.stringify(body) });
      const normalizedSaved = { ...saved, publicationStatus: saved.status ?? saved.publicationStatus };
      setSelected(normalizedSaved); setDirty(false); setMessage(selected ? "Changes saved." : "Draft created."); await load();
      void loadGovernance(normalizedSaved, tab);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Record could not be saved."); }
    finally { setSaving(false); }
  };

  const materialAction = async (record: CmsRecord, action: "archive" | "restore" | "duplicate") => {
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} “${displayName(record)}”?`)) return;
    setSaving(true); setError("");
    try { const headers = await csrfHeaders(); await request(`${endpoint}/${encodeURIComponent(record.id)}/${action}`, { method: "POST", headers, body: "{}" }); setMessage(`${action[0].toUpperCase()}${action.slice(1)} completed.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `${action} failed.`); }
    finally { setSaving(false); }
  };

  const workflowAction = async (record: CmsRecord, action: string) => {
    const material = ["publish", "archive", "restore"].includes(action);
    if (material && !window.confirm(`${action[0].toUpperCase()}${action.slice(1)} “${displayName(record)}”?`)) return;
    const comment = ["request-changes"].includes(action) ? window.prompt("Explain the requested changes:") : undefined;
    if (action === "request-changes" && !comment?.trim()) return;
    const scheduledFor = action === "schedule" ? window.prompt("Schedule publication (ISO date/time):", new Date(Date.now() + 86_400_000).toISOString()) : undefined;
    if (action === "schedule" && !scheduledFor?.trim()) return;
    setSaving(true); setError("");
    try { const headers = await csrfHeaders(); const entity = String(record.entity || record.entityKind || tab); const updated = await request<CmsRecord>(`/api/v1/admin/learning/workflow/${encodeURIComponent(record.id)}/${action}`, { method: "POST", headers, body: JSON.stringify({ comment, scheduledFor, entity }) }); const normalizedUpdated = { ...updated, publicationStatus: updated.status ?? updated.publicationStatus }; setSelected(normalizedUpdated); setMessage(`Workflow action “${action}” completed.`); await load(); void loadGovernance(normalizedUpdated, tab); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Workflow action failed."); }
    finally { setSaving(false); }
  };

  const reorder = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !isEntity) return;
    const next = [...visible]; const from = next.findIndex((record) => record.id === draggedId); const to = next.findIndex((record) => record.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setRecords(next.map((record, index) => ({ ...record, displayOrder: index })));
    setDraggedId(null);
    try { const headers = await csrfHeaders(); await request(`${endpoint}/reorder`, { method: "POST", headers, body: JSON.stringify({ items: next.map((record, index) => ({ id: record.id, displayOrder: index })) }) }); setMessage("Order saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Order could not be saved."); await load(); }
  };

  const exportJson = async () => {
    setSaving(true); setError("");
    try {
      const payload = await request<unknown>(`/api/v1/admin/learning/${transferEntity}/export`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `apologia-${transferEntity}-export.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setSaving(false); }
  };

  const importJson = async (file: File) => {
    if (!window.confirm(`Import validated ${transferEntity} records from ${file.name}?`)) return;
    setSaving(true); setError("");
    try {
      const parsed = JSON.parse(await file.text()); const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items)) throw new Error("Import must contain a JSON array or an items array.");
      const headers = await csrfHeaders(); await request(`/api/v1/admin/learning/${transferEntity}/import`, { method: "POST", headers, body: JSON.stringify({ items, dryRun: false }) }); setMessage(`${items.length} record(s) submitted to the idempotent importer.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setSaving(false); if (importRef.current) importRef.current.value = ""; }
  };

  const editingEntity = isEntity ? tab as Entity : null;
  const supportsCommonFields = Boolean(editingEntity && commonEntities.has(editingEntity));
  const hasParentField = Boolean(editingEntity && parentField(editingEntity));

  return <main className="min-h-screen bg-(--background) p-4 text-(--text) sm:p-6 xl:p-8" id="main-content">
    <header className="flex flex-col gap-4 border-b border-(--border) pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Platform CMS</p><h1 className="editorial-heading mt-2 text-3xl font-semibold sm:text-4xl">Learning content management</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-(--text-muted)">Create, review, schedule, publish, version, and archive the canonical curriculum without exposing drafts to learners or the live engine.</p></div><div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/learn" target="_blank">Preview public catalogue</Link>{isEntity ? <button className="btn-primary" type="button" onClick={newRecord}>New {tab.replace(/s$/, "")}</button> : null}</div></header>
    <nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Learning CMS sections">{[...entityTabs, ...operationalTabs].map((item) => <button key={item} type="button" className={`min-h-10 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold ${tab === item ? "border-(--gold) bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-(--gold-hover)" : "border-(--border) text-(--text-muted)"}`} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) { setTab(item); setSelected(null); setGovernance(null); setForm(emptyForm); setDirty(false); setMessage(""); setError(""); } }}>{item.replace("import-export", "Import / export").replace(/-/g, " ")}</button>)}</nav>
    {message ? <div className="mt-4 rounded-lg border border-(--success) p-3 text-sm text-(--success)" role="status">{message}</div> : null}{error ? <div className="mt-4 rounded-lg border border-(--danger) p-3 text-sm text-(--danger)" role="alert">{error}</div> : null}

    {tab === "import-export" ? <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="surface-card p-6"><h2 className="editorial-heading text-2xl font-semibold">Portable, reviewable data</h2><p className="mt-3 text-sm leading-6 text-(--text-muted)">Export a canonical entity for review or import a validated, idempotent batch. Production content remains in PostgreSQL—not in this file.</p><div className="mt-5 flex flex-wrap gap-3"><select className="form-control max-w-52" value={transferEntity} onChange={(event) => setTransferEntity(event.target.value as Entity)}>{entityTabs.map((entity) => <option key={entity}>{entity}</option>)}</select><button className="btn-secondary" type="button" disabled={saving} onClick={() => void exportJson()}>{saving ? "Working…" : "Export JSON"}</button><label className="btn-primary cursor-pointer">Import JSON<input ref={importRef} className="sr-only" type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); }} /></label></div></div><div className="surface-card p-6"><h2 className="editorial-heading text-2xl font-semibold">Migration safeguards</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-(--text-muted)"><li>• Stable identifiers are preserved when valid.</li><li>• Records are validated before commit.</li><li>• Published records are archived/versioned, never silently deleted.</li><li>• Original source files remain until an import report is verified.</li></ul></div></section> : null}

    {tab !== "import-export" ? <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(28rem,1.25fr)]"><section className="surface-card min-w-0 p-4"><div className="flex flex-col gap-2 sm:flex-row"><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab.replace(/-/g, " ")}`} aria-label={`Search ${tab}`} /><select className="form-control sm:max-w-48" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter publication status"><option value="">All states</option>{["draft", "in_review", "changes_requested", "approved", "scheduled", "published", "archived"].map((status) => <option key={status}>{status}</option>)}</select></div>{loading ? <p className="p-6 text-sm text-(--text-muted)">Loading…</p> : visible.length ? <ul className="mt-4 space-y-2">{visible.map((record) => <li key={record.id} draggable={isEntity} onDragStart={() => setDraggedId(record.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void reorder(record.id)}><button type="button" onClick={() => choose(record)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === record.id ? "border-(--gold) bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]" : "border-(--border) hover:border-(--gold)"}`}><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate">{displayName(record)}</strong><span className="mt-1 block truncate text-xs text-(--text-muted)">{record.slug || record.id} · v{record.version || 1}</span></span><StatusPill value={String(record.publicationStatus || record.reviewStatus || "draft")} /></span>{record.brokenReferences || record.licenceWarnings ? <span className="mt-2 block text-xs text-(--warning)">{record.brokenReferences ? `${record.brokenReferences} broken reference warning(s)` : ""}{record.brokenReferences && record.licenceWarnings ? " · " : ""}{record.licenceWarnings ? `${record.licenceWarnings} licence warning(s)` : ""}</span> : null}</button></li>)}</ul> : <div className="mt-4 rounded-lg border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">No records match this view.</div>}</section>
      <section className="surface-card min-w-0 p-5">
        {editingEntity ? <form onSubmit={(event) => void save(event)}>
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">{selected ? "Edit record" : "New draft"}</p><h2 className="editorial-heading mt-1 text-2xl font-semibold">{selected ? displayName(selected) : `Create ${tab.replace(/s$/, "")}`}</h2></div>{dirty ? <StatusPill value="Unsaved" /> : null}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {supportsCommonFields ? <><label className="text-sm font-semibold">Title<input className="form-control mt-1" required value={form.title} onChange={(event) => updateForm("title", event.target.value)} /></label><label className="text-sm font-semibold">Slug<input className="form-control mt-1" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => updateForm("slug", event.target.value.toLowerCase())} /></label>{editingEntity !== "sources" ? <label className="text-sm font-semibold sm:col-span-2">Short description<textarea className="form-control mt-1 min-h-24" value={form.shortDescription} onChange={(event) => updateForm("shortDescription", event.target.value)} /></label> : null}<label className="text-sm font-semibold">Visibility<select className="form-control mt-1" value={form.visibility} onChange={(event) => updateForm("visibility", event.target.value)}>{["public", "authenticated", "locked", "hidden", "coming_soon"].map((visibility) => <option key={visibility}>{visibility}</option>)}</select></label>{editingEntity !== "sources" ? <label className="text-sm font-semibold">Display order<input className="form-control mt-1" type="number" value={form.displayOrder} onChange={(event) => updateForm("displayOrder", event.target.value)} /></label> : null}</> : null}
            <label className="text-sm font-semibold">Publication state<input className="form-control mt-1" value={form.publicationStatus} readOnly aria-describedby="workflow-state-help" /></label>
            {hasParentField ? <label className="text-sm font-semibold">Parent UUID<input className="form-control mt-1" required value={form.parentId} onChange={(event) => updateForm("parentId", event.target.value)} /></label> : null}
            <label className="text-sm font-semibold sm:col-span-2">Additional fields JSON<textarea className="form-control mt-1 min-h-52 font-mono text-xs" value={form.structuredContent} onChange={(event) => updateForm("structuredContent", event.target.value)} spellCheck={false} /><span id="workflow-state-help" className="mt-1 block text-xs font-normal text-(--text-muted)">Use entity-specific validated fields. Publication state changes only through workflow actions.</span></label>
          </div>
          {selected && governedEntityFor(tab, selected) ? <aside className="mt-5 rounded-lg border border-(--border) p-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="eyebrow">Phase 2 governance</p><h3 className="mt-1 font-semibold">Publication validation · {governance?.governanceStage?.replace(/_/g, " ") || selected.governanceStage?.replace(/_/g, " ") || "draft"}</h3></div>
              <button className="btn-secondary" type="button" disabled={validationLoading} onClick={() => void loadGovernance(selected, tab)}>{validationLoading ? "Validating…" : "Run validation"}</button>
            </div>
            {governance ? <>
              <p className={`mt-3 text-sm font-semibold ${governance.summary.errors ? "text-(--danger)" : governance.summary.warnings ? "text-(--warning)" : "text-(--success)"}`}>
                {governance.summary.errors} blocking error(s) · {governance.summary.warnings} warning(s) · human review remains required
              </p>
              {governance.findings.length ? <ul className="mt-3 space-y-2">{governance.findings.map((finding) => <li className="rounded-md border border-(--border) p-3 text-sm" key={`${finding.code}:${finding.reviewStage}`}><strong className={finding.severity === "error" ? "text-(--danger)" : "text-(--warning)"}>{finding.code}</strong><span className="ml-2 text-xs uppercase text-(--text-muted)">{finding.reviewStage.replace(/_/g, " ")}</span><p className="mt-1 text-(--text-muted)">{finding.message}</p></li>)}</ul> : <p className="mt-3 text-sm text-(--success)">No machine-detectable publication blockers. Required qualified reviews still govern approval.</p>}
              {governance.reviews.length ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Current-version review trail ({governance.reviews.length})</summary><ul className="mt-2 space-y-1 text-sm text-(--text-muted)">{governance.reviews.map((review, index) => <li key={`${review.stage}:${index}`}>{review.stage.replace(/_/g, " ")} · {review.decision.replace(/_/g, " ")} · {review.reviewerRole}{review.specialism ? ` (${review.specialism})` : ""}</li>)}</ul></details> : null}
            </> : <p className="mt-3 text-sm text-(--text-muted)">{validationLoading ? "Checking the central policy layer…" : "Run validation to inspect publication blockers."}</p>}
          </aside> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
            {selected && !["prerequisites", "question-options", "question-contexts", "content-sources"].includes(editingEntity) ? <>
              {["draft", "changes_requested"].includes(selected.publicationStatus || "draft") ? <button className="btn-secondary" type="button" disabled={saving} onClick={() => void workflowAction(selected, "submit")}>Submit for review</button> : null}
              {selected.publicationStatus === "approved" ? <><button className="btn-primary" type="button" disabled={saving} onClick={() => void workflowAction(selected, "publish")}>Publish now</button><button className="btn-secondary" type="button" disabled={saving} onClick={() => void workflowAction(selected, "schedule")}>Schedule</button></> : null}
              {["published", "archived"].includes(selected.publicationStatus || "") ? <button className="btn-secondary" type="button" disabled={saving} onClick={() => void workflowAction(selected, "new-version")}>Create new version</button> : null}
              <button className="btn-secondary" type="button" disabled={saving} onClick={() => void materialAction(selected, "duplicate")}>Duplicate</button>
              <button className="btn-quiet" type="button" disabled={saving} onClick={() => void materialAction(selected, selected.publicationStatus === "archived" ? "restore" : "archive")}>{selected.publicationStatus === "archived" ? "Restore" : "Archive"}</button>
              {selected.slug ? <Link className="btn-quiet" target="_blank" href={editingEntity === "lessons" ? `/learn/${selected.slug}` : "/learn"}>Preview</Link> : null}
            </> : null}
          </div>
        </form> : <div><p className="eyebrow">{tab}</p><h2 className="editorial-heading mt-2 text-2xl font-semibold">{selected ? displayName(selected) : tab === "review" ? "Review queue" : tab === "calendar" ? "Publication calendar" : "Content audit history"}</h2>{selected ? <><dl className="mt-5 grid gap-3 text-sm"><div><dt className="text-(--text-muted)">State</dt><dd className="mt-1 font-bold">{String(selected.publicationStatus || selected.reviewStatus || "draft")}</dd></div><div><dt className="text-(--text-muted)">Last updated</dt><dd className="mt-1">{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "Unknown"}</dd></div></dl>{tab === "review" ? <><div className="mt-4 rounded-lg border border-(--border) p-3 text-sm"><strong>Governance stage:</strong> {String(governance?.governanceStage || selected.governanceStage || "not governed").replace(/_/g, " ")}{governance ? <span className={`ml-2 ${governance.summary.errors ? "text-(--danger)" : "text-(--success)"}`}>{governance.summary.errors} blocker(s)</span> : null}</div><div className="mt-6 flex flex-wrap gap-2">{selected.publicationStatus === "in_review" ? <><button className="btn-secondary" onClick={() => void workflowAction(selected, "request-changes")}>Request changes</button><button className="btn-secondary" onClick={() => void workflowAction(selected, "approve")}>Approve current stage</button></> : null}{selected.publicationStatus === "approved" || selected.publicationStatus === "scheduled" ? <button className="btn-primary" onClick={() => void workflowAction(selected, "publish")}>Publish</button> : null}<button className="btn-quiet" onClick={() => void workflowAction(selected, "archive")}>Archive</button></div></> : null}</> : <p className="mt-4 text-sm text-(--text-muted)">Select an item to inspect its details and history.</p>}</div>}
      </section></div> : null}
  </main>;
}
