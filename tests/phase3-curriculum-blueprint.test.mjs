import assert from "node:assert/strict";
import test from "node:test";
import { buildManifest } from "../scripts/generate-phase3-curriculum.mjs";
import { validateFromDisk, validateManifest } from "../scripts/validate-phase3-curriculum.mjs";

test("Phase 3 blueprint has complete hierarchy and passes schema and graph validation", () => {
  const manifest = buildManifest();
  const result = validateManifest(manifest);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(manifest.programmes.length, 8);
  assert.equal(manifest.subjects.length, 118);
  assert.equal(manifest.subjects.filter((subject) => subject.stableId.startsWith("subj.bible.")).length, 73);
  assert.equal(manifest.groups.length, 590);
  assert.equal(manifest.lessons.length, 815);
  assert.equal(result.summary.cycleDetected, false);
  assert.equal(result.summary.firstUnlockedGroupId, "grp.catholic-foundations.foundations");
});

test("every major curriculum entity remains draft and unpublished", () => {
  const manifest = buildManifest();
  for (const entity of [...manifest.programmes, ...manifest.subjects, ...manifest.groups]) {
    assert.equal(entity.editorialStatus, "draft");
    assert.equal(entity.publicationStatus, "unpublished");
    assert.equal(entity.approvalRequired, true);
  }
  for (const lesson of manifest.lessons) {
    assert.equal(lesson.productionStatus, "planned");
    assert.equal(lesson.contentBodyIncluded, false);
    assert.equal(lesson.publicationStatus, "unpublished");
  }
});

test("Bible-book tracks are independent after the Scripture and Canon gateway", () => {
  const manifest = buildManifest();
  const bibleSubjects = manifest.subjects.filter((subject) => subject.stableId.startsWith("subj.bible."));
  for (const subject of bibleSubjects) {
    const groups = manifest.groups.filter((group) => group.subjectId === subject.stableId).sort((a, b) => a.order - b.order);
    assert.equal(groups.length, 5);
    assert.deepEqual(groups[0].prerequisites.map((item) => item.stableId), ["grp.scripture-canon.distinctions"]);
    for (const group of groups.slice(1)) {
      assert.equal(group.prerequisites.length, 1);
      assert.match(group.prerequisites[0].stableId, new RegExp("^grp\\." + subject.stableId.slice(5).replaceAll(".", "\\.") + "\\."));
    }
  }
});

test("generated draft import package exactly matches the manifest", async () => {
  const result = await validateFromDisk();
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});
