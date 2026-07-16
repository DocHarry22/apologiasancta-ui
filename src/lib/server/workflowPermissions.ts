import { hasPermission, type Role } from "../auth/roles";
import type { WorkflowItem } from "./storage/types";

export function canCreateWorkflow(role: Role): boolean {
  return hasPermission(role, "content:draft:create") || role === "admin" || role === "super_admin";
}

export function canViewWorkflowItem(role: Role, userId: string, item: WorkflowItem): boolean {
  if (role === "admin" || role === "super_admin" || hasPermission(role, "content:review")) return true;
  return item.authorId === userId && hasPermission(role, "content:view");
}

export function canEditWorkflowItem(role: Role, userId: string, item: WorkflowItem): boolean {
  if (role === "admin" || role === "super_admin") return true;
  return item.authorId === userId && hasPermission(role, "content:draft:edit_own") && ["draft", "changes_requested"].includes(item.status);
}

export function canSubmitWorkflowItem(role: Role, userId: string, item: WorkflowItem): boolean {
  if (role === "admin" || role === "super_admin") return ["draft", "changes_requested"].includes(item.status);
  return item.authorId === userId && hasPermission(role, "content:submit_review") && ["draft", "changes_requested"].includes(item.status);
}

export function canReviewWorkflowItem(role: Role, userId: string, item: WorkflowItem): boolean {
  if (item.authorId === userId) return false;
  const currentRevision = item.revisions.find((revision) => (
    revision.id === item.currentRevisionId && revision.contentHash === item.contentHash
  ));
  if (currentRevision?.createdBy === userId) return false;
  if (role === "admin" || role === "super_admin") return true;
  return hasPermission(role, "content:review");
}

export function canPublishWorkflowItem(role: Role): boolean {
  return role === "super_admin" || hasPermission(role, "content:publish");
}
