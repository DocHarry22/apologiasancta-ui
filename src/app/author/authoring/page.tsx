import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Authoring | Apologia Sancta" };

export default async function AuthoringPage() {
  return renderAdminDashboard("authoring", "/author/authoring");
}
