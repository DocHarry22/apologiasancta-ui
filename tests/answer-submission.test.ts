import assert from "node:assert/strict";
import test from "node:test";
import { getAnswerRejectionNotice, isAnswerWindowLocallyOpen } from "../src/lib/answerSubmission.ts";

test("local answer guard requires an open phase and an unexpired deadline", () => {
  assert.equal(isAnswerWindowLocallyOpen({ phase: "OPEN", endsAtMs: 2000, nowMs: 1999 }), true);
  assert.equal(isAnswerWindowLocallyOpen({ phase: "OPEN", endsAtMs: 2000, nowMs: 2000 }), false);
  assert.equal(isAnswerWindowLocallyOpen({ phase: "OPEN", endsAtMs: 0, nowMs: 0 }), false);
  assert.equal(isAnswerWindowLocallyOpen({ phase: "LOCKED", endsAtMs: 2000, nowMs: 1000 }), false);
});

test("answer rejection reasons produce actionable player feedback", () => {
  assert.match(getAnswerRejectionNotice("already_answered"), /already submitted/i);
  assert.match(getAnswerRejectionNotice("too_late"), /too late/i);
  assert.match(getAnswerRejectionNotice("locked"), /locked/i);
  assert.match(getAnswerRejectionNotice("game_paused"), /paused/i);
  assert.match(getAnswerRejectionNotice("not_started"), /not started/i);
  assert.match(getAnswerRejectionNotice("not_registered"), /join/i);
});
