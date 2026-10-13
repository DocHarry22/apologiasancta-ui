import { describe, expect, it } from "vitest";
import { applyAccountUnlocks } from "./homeProgress";

describe("home account progression", () => {
  const preview = [
    { id: "first", previewState: "unlocked" },
    { id: "second", previewState: "visible_locked" },
    { id: "future", previewState: "coming_soon" },
    { id: "hidden", previewState: "hidden" },
  ];
  it("shows the prerequisite group unlocked when the server has recorded the learner unlock", () => {
    expect(applyAccountUnlocks(preview, [{ groupId: "second" }])[1].previewState).toBe("unlocked");
    expect(preview[1].previewState).toBe("visible_locked");
  });
  it("does not invent unlocks for guests or unavailable account progress", () => {
    expect(applyAccountUnlocks(preview, undefined)).toEqual(preview);
  });
  it("preserves hidden and coming-soon publication restrictions", () => {
    expect(applyAccountUnlocks(preview, [{ groupId: "future" }, { groupId: "hidden" }])).toEqual(preview);
  });
});
