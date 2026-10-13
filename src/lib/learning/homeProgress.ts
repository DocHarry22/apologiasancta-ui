export function applyAccountUnlocks<T extends { id: string; previewState?: string }>(
  preview: T[],
  unlocks: Array<{ groupId?: string }> | undefined,
): T[] {
  const unlockedIds = new Set((unlocks ?? []).map(unlock => unlock.groupId).filter(Boolean));
  return preview.map(item => unlockedIds.has(item.id)
    && ["locked", "visible_locked"].includes(item.previewState ?? "")
    ? { ...item, previewState: "unlocked" }
    : item);
}
