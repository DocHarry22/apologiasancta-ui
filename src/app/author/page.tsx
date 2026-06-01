import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = {
  title: "Author Dashboard | Apologia Sancta",
};

export default async function AuthorPage() {
  return renderAdminDashboard("overview", "/author");
}
