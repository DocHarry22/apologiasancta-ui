import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Question Bank | Apologia Sancta" };

export default async function BankPage() {
  return renderAdminDashboard("bank", "/author/bank");
}
