export interface ReleaseNotification {
  id: string;
  commitSha: string;
  repository: "apologia-graph" | "apologiasancta-engine" | "apologiasancta-ui";
  category: string;
  title: string;
  summary: string;
  changes: string[];
  fixes: string[];
  features: string[];
  tests: string[];
  deploymentStatus: "pending" | "deployed" | "failed";
  links: Record<string, string>;
  createdAt: string;
  read: boolean;
  email: { status: "sent" | "skipped" | "failed"; recipient?: string };
}

export interface ReleasePage {
  items: ReleaseNotification[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}
