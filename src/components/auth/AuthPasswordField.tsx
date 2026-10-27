"use client";

import styles from "./AuthExperience.module.css";

export function AuthPasswordField({ id, label, value, onChange, autoComplete, visible, onToggle, describedBy, disabled = false }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  visible: boolean;
  onToggle: () => void;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.password}>
        <input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-describedby={describedBy} minLength={autoComplete === "new-password" ? 8 : undefined} maxLength={256} required disabled={disabled} className={styles.input} />
        <button type="button" className={styles.visibility} onClick={onToggle} aria-controls={id} aria-pressed={visible} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} disabled={disabled}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible ? <path d="m3 3 18 18" /> : null}</svg>
        </button>
      </div>
    </div>
  );
}
