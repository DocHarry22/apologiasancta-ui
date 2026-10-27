import { AppShell } from "@/components/shell/AppShell";
import GraphExperience from "@/components/research/GraphExperience";
import { graphNavigationParams } from "@/lib/graphEmbed";

export const metadata = { title: "3D Graph", description: "Explore the live Apologia Graph website, its connected claims, and their sources inside the app." };

export default async function GraphPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") params.set(key, value);
  return <AppShell footer={false}><GraphExperience navigation={graphNavigationParams(params).toString()} /></AppShell>;
}
