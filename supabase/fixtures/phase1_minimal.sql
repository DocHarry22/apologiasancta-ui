-- Minimal, neutral and idempotent Phase 1 verification content.
-- Load explicitly in a local/non-production database after the foundation
-- migration. This is structural test data, not curriculum content.

begin;

insert into content.programmes (
  id, slug, title, short_description, display_order, status, visibility,
  estimated_minutes, level, review_status, version, published_at,
  reviewed_at, search_metadata, localisation
) values
(
  '10000000-0000-4000-8000-000000000001',
  'phase-1-verification',
  'Phase 1 Verification Programme',
  'Neutral records used only to verify the learning platform workflows.',
  9900,
  'published',
  'public',
  5,
  'verification',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z',
  '{"keywords":["fixture","verification"]}',
  '{"default_locale":"en"}'
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  short_description = excluded.short_description,
  display_order = excluded.display_order,
  status = excluded.status,
  visibility = excluded.visibility,
  estimated_minutes = excluded.estimated_minutes,
  level = excluded.level,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at,
  search_metadata = excluded.search_metadata,
  localisation = excluded.localisation;

insert into content.subjects (
  id, programme_id, slug, title, short_description, display_order, status,
  visibility, estimated_minutes, level, review_status, version, published_at,
  reviewed_at
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'workflow-verification',
  'Workflow Verification',
  'A neutral subject for testing published hierarchy and learner state.',
  0,
  'published',
  'public',
  5,
  'verification',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  programme_id = excluded.programme_id,
  slug = excluded.slug,
  title = excluded.title,
  short_description = excluded.short_description,
  display_order = excluded.display_order,
  status = excluded.status,
  visibility = excluded.visibility,
  estimated_minutes = excluded.estimated_minutes,
  level = excluded.level,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.learning_groups (
  id, subject_id, slug, title, short_description, display_order, status,
  visibility, estimated_minutes, level, mastery_threshold_percent,
  mastery_policy, is_initially_unlocked, is_optional_expert_challenge,
  review_status, version, published_at, reviewed_at
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'first-step',
    'First Verification Step',
    'Initially unlocked group with one neutral mastery item.',
    0,
    'published',
    'public',
    3,
    'verification',
    100,
    '{"attempt_ttl_minutes":120,"default_question_limit":1}',
    true,
    false,
    'approved',
    1,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'second-step',
    'Second Verification Step',
    'Unlocks only after the first verification group is mastered.',
    1,
    'published',
    'public',
    2,
    'verification',
    100,
    '{"attempt_ttl_minutes":120,"default_question_limit":1}',
    false,
    false,
    'approved',
    1,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  )
on conflict (id) do update set
  subject_id = excluded.subject_id,
  slug = excluded.slug,
  title = excluded.title,
  short_description = excluded.short_description,
  display_order = excluded.display_order,
  status = excluded.status,
  visibility = excluded.visibility,
  estimated_minutes = excluded.estimated_minutes,
  level = excluded.level,
  mastery_threshold_percent = excluded.mastery_threshold_percent,
  mastery_policy = excluded.mastery_policy,
  is_initially_unlocked = excluded.is_initially_unlocked,
  is_optional_expert_challenge = excluded.is_optional_expert_challenge,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.group_prerequisites (
  group_id, prerequisite_group_id, requirement, minimum_score_percent
) values (
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  'mastery',
  100
)
on conflict (group_id, prerequisite_group_id) do update set
  requirement = excluded.requirement,
  minimum_score_percent = excluded.minimum_score_percent;

insert into content.lessons (
  id, group_id, slug, title, short_description, display_order, status,
  visibility, estimated_minutes, level, review_status, version, published_at,
  reviewed_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'verification-lesson',
  'Verification Lesson',
  'A short neutral lesson used to verify structured block rendering.',
  0,
  'published',
  'public',
  2,
  'verification',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  group_id = excluded.group_id,
  slug = excluded.slug,
  title = excluded.title,
  short_description = excluded.short_description,
  display_order = excluded.display_order,
  status = excluded.status,
  visibility = excluded.visibility,
  estimated_minutes = excluded.estimated_minutes,
  level = excluded.level,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.lesson_sections (
  id, lesson_id, slug, title, block_kind, content, display_order, status,
  visibility, review_status, version, published_at, reviewed_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'verification-block',
  'Verification Block',
  'rich_text',
  '{"type":"rich_text","nodes":[{"type":"paragraph","text":"This neutral fixture verifies structured content rendering."}]}',
  0,
  'published',
  'public',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  slug = excluded.slug,
  title = excluded.title,
  block_kind = excluded.block_kind,
  content = excluded.content,
  display_order = excluded.display_order,
  status = excluded.status,
  visibility = excluded.visibility,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.learning_objectives (
  id, lesson_id, code, description, display_order, mastery_weight, status,
  review_status, version, published_at, reviewed_at
) values (
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'VERIFY-1',
  'Confirm that a server-authoritative mastery result controls unlocking.',
  0,
  1,
  'published',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  code = excluded.code,
  description = excluded.description,
  display_order = excluded.display_order,
  mastery_weight = excluded.mastery_weight,
  status = excluded.status,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.sources (
  id, slug, title, source_kind, citation, rights_metadata, status, visibility,
  review_status, version, published_at, reviewed_at
) values (
  '70000000-0000-4000-8000-000000000001',
  'phase-1-fixture-specification',
  'Phase 1 Fixture Specification',
  'internal_specification',
  'Repository-local Phase 1 schema verification fixture.',
  '{"licence":"project-internal","quotation_status":"not_applicable"}',
  'published',
  'public',
  'approved',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  source_kind = excluded.source_kind,
  citation = excluded.citation,
  rights_metadata = excluded.rights_metadata,
  status = excluded.status,
  visibility = excluded.visibility,
  review_status = excluded.review_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.questions (
  id, stable_key, subject_id, group_id, lesson_id, objective_id, difficulty,
  question_type, prompt, correct_answer_explanation, rights_metadata,
  answer_policy, status, review_status, retirement_status, version,
  published_at, reviewed_at
) values
(
  '80000000-0000-4000-8000-000000000001',
  'phase1_fixture_0001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  1,
  'single_choice',
  '{"type":"text","text":"Which answer option is labelled A?"}',
  '{"type":"text","text":"The option carrying the label A is the expected answer in this neutral fixture."}',
  '{"licence":"project-internal","content_status":"synthetic_fixture"}',
  '{"scoring":"exact_option_set"}',
  'published',
  'approved',
  'active',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
),
(
  '80000000-0000-4000-8000-000000000002',
  'phase1_fixture_practice_0001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  1,
  'single_choice',
  '{"type":"text","text":"Which neutral practice option is labelled A?"}',
  '{"type":"text","text":"The practice option carrying the label A is expected."}',
  '{"licence":"project-internal","content_status":"synthetic_fixture"}',
  '{"scoring":"exact_option_set"}',
  'published',
  'approved',
  'active',
  1,
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do update set
  stable_key = excluded.stable_key,
  subject_id = excluded.subject_id,
  group_id = excluded.group_id,
  lesson_id = excluded.lesson_id,
  objective_id = excluded.objective_id,
  difficulty = excluded.difficulty,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  correct_answer_explanation = excluded.correct_answer_explanation,
  rights_metadata = excluded.rights_metadata,
  answer_policy = excluded.answer_policy,
  status = excluded.status,
  review_status = excluded.review_status,
  retirement_status = excluded.retirement_status,
  version = excluded.version,
  published_at = excluded.published_at,
  reviewed_at = excluded.reviewed_at;

insert into content.question_options (
  id, question_id, position, label, content, is_correct, explanation
) values
  (
    '90000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    0,
    'A',
    '{"type":"text","text":"Option A"}',
    true,
    '{"type":"text","text":"This option is labelled A."}'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    1,
    'B',
    '{"type":"text","text":"Option B"}',
    false,
    '{"type":"text","text":"This option is labelled B, not A."}'
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    '80000000-0000-4000-8000-000000000001',
    2,
    'C',
    '{"type":"text","text":"Option C"}',
    false,
    '{"type":"text","text":"This option is labelled C, not A."}'
  ),
  (
    '90000000-0000-4000-8000-000000000004',
    '80000000-0000-4000-8000-000000000001',
    3,
    'D',
    '{"type":"text","text":"Option D"}',
    false,
    '{"type":"text","text":"This option is labelled D, not A."}'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002',
    0,
    'A',
    '{"type":"text","text":"Practice option A"}',
    true,
    '{"type":"text","text":"This practice option is labelled A."}'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    1,
    'B',
    '{"type":"text","text":"Practice option B"}',
    false,
    '{"type":"text","text":"This practice option is labelled B, not A."}'
  )
on conflict (id) do update set
  question_id = excluded.question_id,
  position = excluded.position,
  label = excluded.label,
  content = excluded.content,
  enabled = true,
  is_correct = excluded.is_correct,
  explanation = excluded.explanation;

insert into content.question_contexts (
  id, question_id, context, subject_id, group_id, lesson_id, enabled, weight,
  settings
) values
  (
    'a0000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    'mastery_assessment',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    true,
    1,
    '{"fixture":true}'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000001',
    'live_quiz',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    true,
    1,
    '{"fixture":true}'
  ),
  (
    'a0000000-0000-4000-8000-000000000005',
    '80000000-0000-4000-8000-000000000002',
    'group_practice',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    true,
    1,
    '{"fixture":true}'
  )
on conflict (id) do update set
  question_id = excluded.question_id,
  context = excluded.context,
  subject_id = excluded.subject_id,
  group_id = excluded.group_id,
  lesson_id = excluded.lesson_id,
  enabled = excluded.enabled,
  weight = excluded.weight,
  settings = excluded.settings;

insert into content.content_sources (
  id, entity_kind, entity_id, source_id, relationship_type, citation_locator,
  rights_metadata, display_order
) values (
  'b0000000-0000-4000-8000-000000000001',
  'question',
  '80000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'documents',
  'phase1 fixture',
  '{"quotation_status":"not_applicable"}',
  0
)
on conflict (id) do update set
  entity_kind = excluded.entity_kind,
  entity_id = excluded.entity_id,
  source_id = excluded.source_id,
  relationship_type = excluded.relationship_type,
  citation_locator = excluded.citation_locator,
  rights_metadata = excluded.rights_metadata,
  display_order = excluded.display_order;

commit;
