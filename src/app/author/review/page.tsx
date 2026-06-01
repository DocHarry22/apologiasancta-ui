import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Review Queue | Apologia Sancta" };

export default async function ReviewPage() {
  return renderAdminDashboard("review", "/author/review");
}
