import { renderAdminDashboard } from "./dashboardPage";

export const metadata = {
  title: "Admin Dashboard | Apologia Sancta",
};

export default async function AdminPage() {
  return renderAdminDashboard("overview", "/admin");
}
