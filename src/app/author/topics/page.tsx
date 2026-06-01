import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Topics | Apologia Sancta" };

export default async function TopicsPage() {
  return renderAdminDashboard("topics", "/author/topics");
}
