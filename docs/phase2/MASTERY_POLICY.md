# Mastery policy

## Official standard

The default official mastery threshold is 100%. The value is stored centrally and snapshotted into each attempt. A qualified curriculum decision may configure a different threshold for a specific group only through reviewed policy; lowering a threshold is never a commercial entitlement.

## Attempt integrity

- Scoring, question selection, submission finalisation and unlocks are server-side.
- Retakes are unlimited.
- A retake prefers unseen equivalent questions from the same objective/group and then least-recently-seen equivalents; repetition is allowed only when the validated pool is insufficient.
- Official attempts expose no hints, answer keys or distractor explanations before submission.
- Explanations appear after completion.
- Speed does not affect learning-mastery score. Administrative attempt expiry prevents abandoned sessions; it is not a speed bonus or penalty.
- Paid status cannot bypass the threshold.
- Live competition alone cannot create an official group unlock.
- Offline activity can queue reading/practice progress but cannot create an official mastery unlock.
- Completed content and existing unlocks are not relocked merely because a question or lesson is later edited.
- Ambiguous, invalid or materially disputed questions are quarantined from future selection while versioned past attempt evidence remains.
- Optional retention reviews may award recognition but do not relock content.

## Corrective learning

After submission the server returns explanations and misconception codes for the attempt snapshot. Failed objectives map to corrective lesson sections. A recommendation is educational guidance, not a penalty or lock extension.

## Version and exposure records

An attempt snapshots prompt, options, correct-answer scoring and explanations. The question version used remains auditable. Exposure history records objective/equivalence key and last delivery so retakes can prefer genuinely equivalent alternatives without leaking selection logic to the client.

## Unlock invariants

Unlock rows are append-only under normal operation. An exceptional data-repair deletion requires a separately audited maintenance context; ordinary editorial actions, analytics and content version changes cannot delete them.

## Retention recognition

Retention review results are stored separately from official mastery. Recognition may include badges or review streaks, but failure never changes an existing unlock or completed-state record.
