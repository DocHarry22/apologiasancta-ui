import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Live Control | Apologia Sancta" };

export default async function LiveControlPage() {
  return renderAdminDashboard("live", "/author/live");
}
