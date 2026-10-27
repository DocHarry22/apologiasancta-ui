"use client";

import { ReactNode } from "react";
import styles from "./QuizScreen.module.css";

interface LayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export function Layout({ leftContent, rightContent }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <main id="main-content" className={styles.playColumn}>
        {leftContent}
      </main>

      <aside className={styles.sidebar}>
        {rightContent}
      </aside>
    </div>
  );
}
