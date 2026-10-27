import GraphAccountConnection from "@/components/research/GraphAccountConnection";
import { AppShell } from "@/components/shell/AppShell";

export const metadata = {
  title: "Connect Graph | Apologia Sancta",
  robots: { index: false, follow: false },
};

export default function GraphConnectPage() { return <AppShell><GraphAccountConnection /></AppShell>; }
