import { renderAdminDashboard } from "@/app/admin/dashboardPage";

export const metadata = { title: "Rooms | Apologia Sancta" };

export default async function RoomsPage() {
  return renderAdminDashboard("rooms", "/author/rooms");
}
