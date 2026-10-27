import type { ReactNode } from "react";
import study from "./StudyUI.module.css";
import styles from "./ScreenSurface.module.css";

export function ScreenSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${study.screen} ${styles.content} ${className}`}>{children}</div>;
}

export function ScreenIntro({ eyebrow, title, accent, description }: { eyebrow: string; title: string; accent?: string; description?: string }) {
  return <header className={study.intro}><p className={study.eyebrow}>{eyebrow}</p><h1 className={study.title}>{title}{accent ? <><br /><em>{accent}</em></> : null}</h1>{description ? <p className={study.introDescription}>{description}</p> : null}</header>;
}
