import { AppShell } from "@/components/shell/AppShell";
import ReportIssuePage from "@/components/content/ReportIssuePage";

export const metadata = { title: "Report a content issue | Apologia Sancta" };

export default function Page() {
  return <AppShell><ReportIssuePage /></AppShell>;
}
