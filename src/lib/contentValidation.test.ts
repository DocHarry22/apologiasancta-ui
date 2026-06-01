import { describe, expect, it } from "vitest";
import { validateContentTree } from "./contentTreeValidation";

describe("topic content schema", () => {
  it("validates indexed topics, manifests, questions, IDs, and schema fields", async () => {
    const result = await validateContentTree();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
