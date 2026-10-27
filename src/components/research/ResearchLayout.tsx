import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav, type ResearchMode } from "./ResearchModeNav";
import study from "@/components/native/StudyUI.module.css";
import styles from "./ResearchUI.module.css";

export function ResearchFrame({ children }: { children: ReactNode }) {
  return <AppShell><div className={`${study.screen} ${styles.screen}`}>{children}</div></AppShell>;
}

export function ResearchLayout({ current, eyebrow = "Explore the faith", title, accent, description, search, children }: { current: ResearchMode; eyebrow?: string; title: string; accent?: string; description?: string; search?: ReactNode; children: ReactNode }) {
  return <ResearchFrame><header className={study.intro}><p className={study.eyebrow}>{eyebrow}</p><h1 className={study.title}>{title}{accent ? <><br /><em>{accent}</em></> : null}</h1>{description ? <p className={study.introDescription}>{description}</p> : null}</header>{search}<ResearchModeNav current={current} />{children}</ResearchFrame>;
}
