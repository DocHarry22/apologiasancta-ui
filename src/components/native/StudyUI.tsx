"use client";

import { AppIcon, type AppIconName } from "./AppIcon";
import styles from "./StudyUI.module.css";

export function StudySearch({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className={styles.search}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <AppIcon name="search" width={19} height={19} />
    <input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    {value ? <button type="button" onClick={() => { onChange(""); document.getElementById(id)?.focus(); }} aria-label={`Clear ${label.toLowerCase()}`}><span aria-hidden="true">×</span></button> : null}
  </div>;
}

export function StudyArtwork({ icon = "book", tone = 0 }: { icon?: AppIconName; tone?: number }) {
  return <span className={styles.artwork} data-tone={tone % 3}><AppIcon name={icon} width={29} height={29} /></span>;
}
