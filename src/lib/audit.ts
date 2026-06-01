export type AdminAuditEventType =
  | "auth"
  | "admin_proxy"
  | "content_workflow"
  | "room"
  | "live_control"
  | "topic_sequence"
  | "security";

export interface AdminAuditEvent {
  id: string;
  type: AdminAuditEventType;
  action: string;
  route?: string;
  status: "success" | "failure" | "blocked";
  userId?: string;
  role?: string;
  createdAt: string;
  summary: string;
}
