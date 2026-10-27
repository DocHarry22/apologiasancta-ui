"use client";

import { useState } from "react";
import KnowledgeSelector from "./KnowledgeSelector";
import styles from "./ResearchUI.module.css";

export default function CompareClaimsForm({ left, right, leftTitle, rightTitle, lens }: { left: string; right: string; leftTitle?: string; rightTitle?: string; lens: string }) {
  const [leftId, setLeftId] = useState(left);
  const [rightId, setRightId] = useState(right);
  return <form method="get" className={styles.compareForm} aria-label="Canonical comparison form">
    <KnowledgeSelector label="First claim" name="left" initialId={left} initialTitle={leftTitle} excludeId={rightId} onSelect={setLeftId} />
    <KnowledgeSelector label="Second claim" name="right" initialId={right} initialTitle={rightTitle} excludeId={leftId} onSelect={setRightId} />
    <label className="text-sm font-semibold">Perspective<input name="lens" defaultValue={lens} placeholder="catholic" className="form-control mt-2 w-full" /></label>
    <button type="submit" className="btn-primary lg:mt-7" disabled={!leftId || !rightId || leftId === rightId}>Compare</button>
  </form>;
}
