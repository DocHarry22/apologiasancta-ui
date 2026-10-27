"use client";

import { NativeHeader } from "@/components/native/NativeHeader";
import { AppIcon } from "@/components/native/AppIcon";
import type { ConnectionStatus } from "@/types/quiz";
import { getConnectionLabel } from "@/lib/mobileUx";
import styles from "./QuizScreen.module.css";

interface TopBarProps {
  topic?: string;
  roomName?: string;
  questionNumber?: number;
  totalQuestions?: number;
  connectionStatus?: ConnectionStatus;
  onOpenAdmin?: () => void;
  onSwitchRoom?: () => void;
}

export function TopBar({ topic, roomName, questionNumber, totalQuestions, connectionStatus = "connected", onOpenAdmin, onSwitchRoom }: TopBarProps) {
  return <>
    <NativeHeader />
    <header className={styles.roomBar}>
      <p className={styles.eyebrow}>Learn. Play. Grow together.</p>
      <div className={styles.roomHeading}><h1>{roomName || "The live quiz."}</h1><span className={styles.connection} data-state={connectionStatus}>{getConnectionLabel(connectionStatus)}</span></div>
      <div className={styles.roomMeta}>
        {topic ? <span>{topic}</span> : null}
        {questionNumber && totalQuestions ? <span>Question {questionNumber} of {totalQuestions}</span> : null}
        {onSwitchRoom ? <button type="button" onClick={onSwitchRoom}>Change room <AppIcon name="chevron" width={13} height={13} /></button> : null}
        {onOpenAdmin ? <button type="button" onClick={onOpenAdmin} aria-label="Open admin panel">Admin</button> : null}
      </div>
    </header>
  </>;
}