import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Settings | Apologia Sancta" };

export default async function SettingsPage() {
  return renderAdminDashboard("settings", "/author/settings");
}
