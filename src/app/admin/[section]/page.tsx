import { notFound } from "next/navigation";
import { renderAdminDashboard, type DashboardTab } from "../dashboardPage";

const sectionTabs: Record<string, DashboardTab> = {
  live: "live",
  rooms: "rooms",
  bank: "bank",
  authoring: "authoring",
  review: "review",
  topics: "topics",
  audit: "audit",
  settings: "settings",
};

export const metadata = {
  title: "Admin Dashboard | Apologia Sancta",
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const tab = sectionTabs[section];
  if (!tab) notFound();

  return renderAdminDashboard(tab, `/admin/${section}`);
}
