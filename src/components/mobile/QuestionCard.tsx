"use client";
import { AppIcon } from "@/components/native/AppIcon";
import styles from "./QuizScreen.module.css";

interface QuestionCardProps {
  text: string;
}

export function QuestionCard({ text }: QuestionCardProps) {
  return (
    <section className={styles.question} aria-label="Current question"><AppIcon name="spark" width={36} height={36} /><p className={styles.eyebrow}>A question to consider</p><h2>{text}</h2></section>
  );
}
