import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Audit Log | Apologia Sancta" };

export default async function AuditPage() {
  return renderAdminDashboard("audit", "/author/audit");
}
