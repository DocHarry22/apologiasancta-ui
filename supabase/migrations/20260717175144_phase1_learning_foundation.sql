-- Apologia Sancta Phase 1 learning/content foundation.
-- This migration is intentionally data-free. Minimal, neutral fixtures live in
-- supabase/fixtures/phase1_minimal.sql and are never loaded implicitly.

begin;

create schema if not exists content;
create schema if not exists private;
create schema if not exists game;

revoke all on schema content from public;
revoke all on schema private from public;
revoke all on schema game from public;

create type content.publication_status as enum (
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived'
);

create type content.review_status as enum (
  'unreviewed',
  'pending',
  'changes_requested',
  'approved'
);

create type content.content_visibility as enum (
  'public',
  'authenticated',
  'hidden',
  'locked',
  'coming_soon'
);

create type content.prerequisite_requirement as enum (
  'completion',
  'mastery',
  'unlock'
);

create type content.block_kind as enum (
  'rich_text',
  'heading',
  'scripture_reference',
  'catechism_reference',
  'quotation',
  'table',
  'image',
  'audio',
  'video',
  'expandable_explanation',
  'comparison',
  'objection_response',
  'footnotes',
  'related_content',
  'resource'
);

create type content.entity_kind as enum (
  'programme',
  'subject',
  'learning_group',
  'lesson',
  'lesson_section',
  'learning_objective',
  'question',
  'source'
);

create type content.question_kind as enum (
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_answer'
);

create type content.question_context_kind as enum (
  'lesson_practice',
  'group_practice',
  'mastery_assessment',
  'expert_challenge',
  'live_quiz',
  'daily_challenge',
  'review_quiz'
);

create type content.question_retirement_status as enum (
  'active',
  'retired',
  'quarantined'
);

create type public.lesson_progress_state as enum (
  'not_started',
  'in_progress',
  'completed'
);

create type public.mastery_attempt_status as enum (
  'in_progress',
  'submitted',
  'expired',
  'cancelled'
);

create table content.programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  short_description text not null default '',
  cover_asset_path text,
  display_order integer not null default 0 check (display_order >= 0),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  level text,
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  apologia_graph_relationship jsonb not null default '{}'::jsonb check (jsonb_typeof(apologia_graph_relationship) = 'object'),
  search_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(search_metadata) = 'object'),
  localisation jsonb not null default '{}'::jsonb check (jsonb_typeof(localisation) = 'object'),
  constraint programmes_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (display_order)
);

create table content.programme_prerequisites (
  programme_id uuid not null references content.programmes(id) on delete restrict,
  prerequisite_programme_id uuid not null references content.programmes(id) on delete restrict,
  requirement content.prerequisite_requirement not null default 'mastery',
  minimum_score_percent numeric(5,2) check (minimum_score_percent between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (programme_id, prerequisite_programme_id),
  check (programme_id <> prerequisite_programme_id)
);

create table content.subjects (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references content.programmes(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  short_description text not null default '',
  cover_asset_path text,
  display_order integer not null default 0 check (display_order >= 0),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  level text,
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  apologia_graph_relationship jsonb not null default '{}'::jsonb check (jsonb_typeof(apologia_graph_relationship) = 'object'),
  search_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(search_metadata) = 'object'),
  localisation jsonb not null default '{}'::jsonb check (jsonb_typeof(localisation) = 'object'),
  constraint subjects_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (programme_id, slug),
  unique (programme_id, display_order)
);

create table content.subject_prerequisites (
  subject_id uuid not null references content.subjects(id) on delete restrict,
  prerequisite_subject_id uuid not null references content.subjects(id) on delete restrict,
  requirement content.prerequisite_requirement not null default 'mastery',
  minimum_score_percent numeric(5,2) check (minimum_score_percent between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (subject_id, prerequisite_subject_id),
  check (subject_id <> prerequisite_subject_id)
);

create table content.learning_groups (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references content.subjects(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  short_description text not null default '',
  cover_asset_path text,
  display_order integer not null default 0 check (display_order >= 0),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  level text,
  mastery_threshold_percent numeric(5,2) not null default 100 check (mastery_threshold_percent between 0 and 100),
  mastery_policy jsonb not null default '{"attempt_ttl_minutes":120,"default_question_limit":10}'::jsonb check (jsonb_typeof(mastery_policy) = 'object'),
  is_initially_unlocked boolean not null default false,
  is_optional_expert_challenge boolean not null default false,
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  apologia_graph_relationship jsonb not null default '{}'::jsonb check (jsonb_typeof(apologia_graph_relationship) = 'object'),
  search_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(search_metadata) = 'object'),
  localisation jsonb not null default '{}'::jsonb check (jsonb_typeof(localisation) = 'object'),
  constraint learning_groups_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (subject_id, slug),
  unique (subject_id, display_order)
);

create table content.group_prerequisites (
  group_id uuid not null references content.learning_groups(id) on delete restrict,
  prerequisite_group_id uuid not null references content.learning_groups(id) on delete restrict,
  requirement content.prerequisite_requirement not null default 'mastery',
  minimum_score_percent numeric(5,2) check (minimum_score_percent between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (group_id, prerequisite_group_id),
  check (group_id <> prerequisite_group_id)
);

create table content.lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references content.learning_groups(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  short_description text not null default '',
  cover_asset_path text,
  display_order integer not null default 0 check (display_order >= 0),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  level text,
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  apologia_graph_relationship jsonb not null default '{}'::jsonb check (jsonb_typeof(apologia_graph_relationship) = 'object'),
  search_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(search_metadata) = 'object'),
  localisation jsonb not null default '{}'::jsonb check (jsonb_typeof(localisation) = 'object'),
  constraint lessons_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (group_id, slug),
  unique (group_id, display_order)
);

create table content.lesson_prerequisites (
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  prerequisite_lesson_id uuid not null references content.lessons(id) on delete restrict,
  requirement content.prerequisite_requirement not null default 'completion',
  minimum_score_percent numeric(5,2) check (minimum_score_percent between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (lesson_id, prerequisite_lesson_id),
  check (lesson_id <> prerequisite_lesson_id)
);

create table content.lesson_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  parent_section_id uuid references content.lesson_sections(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text,
  block_kind content.block_kind not null,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  display_order integer not null default 0 check (display_order >= 0),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  constraint lesson_sections_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (lesson_id, slug)
);

create unique index lesson_sections_sibling_order_uidx
  on content.lesson_sections (lesson_id, coalesce(parent_section_id, '00000000-0000-0000-0000-000000000000'::uuid), display_order);

create table content.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  code text not null check (btrim(code) <> ''),
  description text not null check (btrim(description) <> ''),
  display_order integer not null default 0 check (display_order >= 0),
  mastery_weight numeric(8,4) not null default 1 check (mastery_weight > 0),
  status content.publication_status not null default 'draft',
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  constraint learning_objectives_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  unique (lesson_id, code),
  unique (lesson_id, display_order)
);

create table content.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  source_kind text not null check (btrim(source_kind) <> ''),
  author text,
  publisher text,
  publication_year integer check (publication_year is null or publication_year between 1 and 9999),
  url text,
  citation text,
  rights_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(rights_metadata) = 'object'),
  status content.publication_status not null default 'draft',
  visibility content.content_visibility not null default 'public',
  review_status content.review_status not null default 'unreviewed',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  constraint sources_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  )
);

create table content.questions (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[A-Za-z0-9_-]+$'),
  subject_id uuid not null references content.subjects(id) on delete restrict,
  group_id uuid references content.learning_groups(id) on delete restrict,
  lesson_id uuid references content.lessons(id) on delete restrict,
  objective_id uuid references content.learning_objectives(id) on delete restrict,
  difficulty smallint not null check (difficulty between 1 and 5),
  question_type content.question_kind not null default 'single_choice',
  prompt jsonb not null check (jsonb_typeof(prompt) = 'object'),
  correct_answer_explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(correct_answer_explanation) = 'object'),
  private_notes text,
  misconception_ids text[] not null default '{}'::text[],
  denomination_scope jsonb not null default '{}'::jsonb check (jsonb_typeof(denomination_scope) = 'object'),
  rights_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(rights_metadata) = 'object'),
  answer_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_policy) = 'object'),
  status content.publication_status not null default 'draft',
  review_status content.review_status not null default 'unreviewed',
  retirement_status content.question_retirement_status not null default 'active',
  quarantine_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_for timestamptz,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  constraint questions_publication_dates check (
    (status <> 'published' or published_at is not null)
    and (status <> 'scheduled' or scheduled_for is not null)
    and (status <> 'archived' or archived_at is not null)
  ),
  constraint questions_quarantine_reason check (retirement_status <> 'quarantined' or quarantine_reason is not null)
);

create table content.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references content.questions(id) on delete restrict,
  position integer not null check (position >= 0),
  label text not null check (btrim(label) <> ''),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  enabled boolean not null default true,
  is_correct boolean not null default false,
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  misconception_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position),
  unique (question_id, label)
);

create table content.question_contexts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references content.questions(id) on delete restrict,
  context content.question_context_kind not null,
  programme_id uuid references content.programmes(id) on delete restrict,
  subject_id uuid references content.subjects(id) on delete restrict,
  group_id uuid references content.learning_groups(id) on delete restrict,
  lesson_id uuid references content.lessons(id) on delete restrict,
  enabled boolean not null default true,
  weight numeric(8,4) not null default 1 check (weight > 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create unique index question_contexts_scope_uidx on content.question_contexts (
  question_id,
  context,
  coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(lesson_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table content.content_sources (
  id uuid primary key default gen_random_uuid(),
  entity_kind content.entity_kind not null,
  entity_id uuid not null,
  source_id uuid not null references content.sources(id) on delete restrict,
  relationship_type text not null default 'supports' check (btrim(relationship_type) <> ''),
  citation_locator text,
  quoted_text text,
  rights_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(rights_metadata) = 'object'),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (entity_kind, entity_id, source_id, relationship_type, display_order)
);

create table content.content_relationships (
  id uuid primary key default gen_random_uuid(),
  from_kind content.entity_kind not null,
  from_id uuid not null,
  to_kind content.entity_kind not null,
  to_id uuid not null,
  relationship_type text not null check (btrim(relationship_type) <> ''),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  check (from_kind <> to_kind or from_id <> to_id),
  unique (from_kind, from_id, to_kind, to_id, relationship_type)
);

create table content.content_versions (
  id uuid primary key default gen_random_uuid(),
  entity_kind content.entity_kind not null,
  entity_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_summary text,
  status content.publication_status not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (entity_kind, entity_id, version)
);

create table content.audit_log (
  id bigint generated by default as identity primary key,
  actor_id uuid,
  action text not null check (btrim(action) <> ''),
  entity_kind text not null check (btrim(entity_kind) <> ''),
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  request_id text,
  occurred_at timestamptz not null default clock_timestamp()
);

create table public.learner_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  identity_provider text not null default 'supabase' check (btrim(identity_provider) <> ''),
  external_subject text,
  display_name text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  check (external_subject is null or btrim(external_subject) <> '')
);

create unique index learner_profiles_external_identity_uidx
  on public.learner_profiles (identity_provider, external_subject)
  where external_subject is not null;

create table public.lesson_progress (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  state public.lesson_progress_state not null default 'not_started',
  reading_progress_percent numeric(5,2) not null default 0 check (reading_progress_percent between 0 and 100),
  resume_locator jsonb not null default '{}'::jsonb check (jsonb_typeof(resume_locator) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  completed_lesson_version integer check (completed_lesson_version is null or completed_lesson_version > 0),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, lesson_id),
  check (state <> 'completed' or completed_at is not null)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  section_id uuid references content.lesson_sections(id) on delete restrict,
  label text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bookmarks_target_uidx on public.bookmarks (
  learner_id,
  lesson_id,
  coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.mastery_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete restrict,
  group_id uuid not null references content.learning_groups(id) on delete restrict,
  status public.mastery_attempt_status not null default 'in_progress',
  start_idempotency_key text not null check (length(start_idempotency_key) between 1 and 128),
  submit_idempotency_key text check (submit_idempotency_key is null or length(submit_idempotency_key) between 1 and 128),
  submission_fingerprint text,
  question_count integer not null default 0 check (question_count >= 0),
  pass_threshold_percent numeric(5,2) not null check (pass_threshold_percent between 0 and 100),
  score_percent numeric(5,2) check (score_percent between 0 and 100),
  correct_count integer check (correct_count is null or correct_count >= 0),
  mastered boolean,
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, start_idempotency_key),
  check (
    (status = 'submitted' and submitted_at is not null and score_percent is not null and mastered is not null and result_payload is not null)
    or status <> 'submitted'
  )
);

create unique index mastery_attempts_submit_idempotency_uidx
  on public.mastery_attempts (learner_id, submit_idempotency_key)
  where submit_idempotency_key is not null;

create index mastery_attempts_learner_group_idx
  on public.mastery_attempts (learner_id, group_id, started_at desc);

create table public.mastery_attempt_questions (
  attempt_id uuid not null references public.mastery_attempts(id) on delete restrict,
  question_id uuid not null references content.questions(id) on delete restrict,
  position integer not null check (position >= 0),
  question_version integer not null check (question_version > 0),
  prompt_snapshot jsonb not null check (jsonb_typeof(prompt_snapshot) = 'object'),
  option_snapshot jsonb not null check (jsonb_typeof(option_snapshot) = 'array'),
  scoring_snapshot jsonb not null check (jsonb_typeof(scoring_snapshot) = 'object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

create table public.mastery_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mastery_attempts(id) on delete restrict,
  learner_id uuid not null references public.learner_profiles(id) on delete restrict,
  question_id uuid not null references content.questions(id) on delete restrict,
  selected_option_ids uuid[] not null default '{}'::uuid[],
  is_correct boolean not null,
  awarded_points numeric(8,4) not null default 0 check (awarded_points >= 0),
  answered_at timestamptz not null default clock_timestamp(),
  unique (attempt_id, question_id)
);

create table public.unlocks (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  group_id uuid not null references content.learning_groups(id) on delete restrict,
  unlocked_by_attempt_id uuid references public.mastery_attempts(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  rule_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(rule_snapshot) = 'object'),
  unlocked_at timestamptz not null default clock_timestamp(),
  primary key (learner_id, group_id)
);

create table public.group_progress (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  group_id uuid not null references content.learning_groups(id) on delete restrict,
  completed_lessons integer not null default 0 check (completed_lessons >= 0),
  total_lessons integer not null default 0 check (total_lessons >= 0),
  best_score_percent numeric(5,2) not null default 0 check (best_score_percent between 0 and 100),
  mastered boolean not null default false,
  mastered_attempt_id uuid references public.mastery_attempts(id) on delete restrict,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (learner_id, group_id),
  check (not mastered or mastered_attempt_id is not null)
);

create table public.review_schedule (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  question_id uuid not null references content.questions(id) on delete restrict,
  due_at timestamptz not null default now(),
  interval_days integer not null default 1 check (interval_days >= 0),
  ease_factor numeric(5,2) not null default 2.50 check (ease_factor between 1.30 and 5.00),
  repetition_count integer not null default 0 check (repetition_count >= 0),
  last_result boolean,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (learner_id, question_id)
);

create index review_schedule_due_idx
  on public.review_schedule (learner_id, due_at);

create table public.question_metrics (
  question_id uuid primary key references content.questions(id) on delete restrict,
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  correct_count bigint not null default 0 check (correct_count >= 0),
  incorrect_count bigint not null default 0 check (incorrect_count >= 0),
  average_score numeric(5,2) not null default 0 check (average_score between 0 and 100),
  last_attempted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (attempt_count = correct_count + incorrect_count)
);

create table game.rooms (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  status text not null default 'open' check (status in ('open', 'locked', 'paused', 'closed', 'archived')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  runtime_state jsonb not null default '{}'::jsonb check (jsonb_typeof(runtime_state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table game.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game.rooms(id) on delete restrict,
  learner_id uuid references public.learner_profiles(id) on delete set null,
  external_participant_key text not null,
  display_name text not null check (btrim(display_name) <> ''),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (room_id, external_participant_key)
);

create table game.sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game.rooms(id) on delete restrict,
  external_session_key text,
  status text not null default 'open' check (status in ('open', 'locked', 'reveal', 'complete', 'cancelled')),
  configuration_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration_snapshot) = 'object'),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, external_session_key)
);

create table game.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game.sessions(id) on delete restrict,
  question_id uuid not null references content.questions(id) on delete restrict,
  question_version integer not null check (question_version > 0),
  position integer not null check (position >= 0),
  state text not null default 'open' check (state in ('open', 'locked', 'revealed', 'complete')),
  opened_at timestamptz,
  locked_at timestamptz,
  revealed_at timestamptz,
  payload_snapshot jsonb not null check (jsonb_typeof(payload_snapshot) = 'object'),
  scoring_snapshot jsonb not null check (jsonb_typeof(scoring_snapshot) = 'object'),
  unique (session_id, position),
  unique (session_id, question_id)
);

create table game.player_answers (
  id uuid primary key default gen_random_uuid(),
  session_question_id uuid not null references game.session_questions(id) on delete restrict,
  participant_id uuid not null references game.room_participants(id) on delete restrict,
  selected_option_ids uuid[] not null default '{}'::uuid[],
  is_correct boolean,
  awarded_points integer not null default 0,
  idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  submitted_at timestamptz not null default clock_timestamp(),
  unique (session_question_id, participant_id),
  unique (participant_id, idempotency_key)
);

create table game.leaderboard_entries (
  room_id uuid not null references game.rooms(id) on delete restrict,
  participant_id uuid not null references game.room_participants(id) on delete restrict,
  period text not null default 'all_time' check (period in ('session', 'daily', 'weekly', 'all_time')),
  period_key text not null default 'all',
  score bigint not null default 0,
  correct_answers integer not null default 0 check (correct_answers >= 0),
  answer_count integer not null default 0 check (answer_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (room_id, participant_id, period, period_key),
  check (correct_answers <= answer_count)
);

create index lessons_group_idx on content.lessons (group_id, display_order);
create index lesson_sections_lesson_idx on content.lesson_sections (lesson_id, display_order);
create index learning_objectives_lesson_idx on content.learning_objectives (lesson_id, display_order);
create index questions_subject_group_idx on content.questions (subject_id, group_id, status, retirement_status);
create index questions_lesson_idx on content.questions (lesson_id) where lesson_id is not null;
create index question_contexts_lookup_idx on content.question_contexts (context, group_id, enabled, valid_from, valid_until);
create index content_sources_entity_idx on content.content_sources (entity_kind, entity_id, display_order);
create index content_relationships_from_idx on content.content_relationships (from_kind, from_id, display_order);
create index content_relationships_to_idx on content.content_relationships (to_kind, to_id);
create index audit_log_entity_idx on content.audit_log (entity_kind, entity_id, occurred_at desc);
create index audit_log_actor_idx on content.audit_log (actor_id, occurred_at desc);
create index game_sessions_room_idx on game.sessions (room_id, started_at desc);
create index game_leaderboard_rank_idx on game.leaderboard_entries (room_id, period, period_key, score desc);

alter table public.mastery_attempts
  add constraint mastery_attempts_id_learner_unique unique (id, learner_id);

alter table public.mastery_answers
  add constraint mastery_answers_attempt_question_fk
    foreign key (attempt_id, question_id)
    references public.mastery_attempt_questions (attempt_id, question_id)
    on delete restrict,
  add constraint mastery_answers_attempt_learner_fk
    foreign key (attempt_id, learner_id)
    references public.mastery_attempts (id, learner_id)
    on delete restrict;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.current_actor_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := nullif(pg_catalog.current_setting('app.actor_id', true), '');
  if v_actor is not null then
    return v_actor::uuid;
  end if;
  return auth.uid();
exception
  when invalid_text_representation then
    return auth.uid();
end;
$$;

create or replace function private.request_role()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claims text;
begin
  if nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '') is not null then
    return pg_catalog.current_setting('request.jwt.claim.role', true);
  end if;
  v_claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
  if v_claims is not null then
    return v_claims::jsonb ->> 'role';
  end if;
  return null;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.assert_learner_access(p_learner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_learner_id is null then
    raise exception using errcode = '22023', message = 'learner_id is required';
  end if;

  if not exists (
    select 1
    from public.learner_profiles lp
    where lp.id = p_learner_id
      and (
        (auth.uid() is not null and lp.auth_user_id = auth.uid())
        or private.request_role() = 'service_role'
        or session_user = 'postgres'
      )
  ) then
    raise exception using errcode = '42501', message = 'learner access denied';
  end if;
end;
$$;

create or replace function private.content_entity_exists(
  p_kind content.entity_kind,
  p_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'programme' then exists (select 1 from content.programmes t where t.id = p_id)
    when 'subject' then exists (select 1 from content.subjects t where t.id = p_id)
    when 'learning_group' then exists (select 1 from content.learning_groups t where t.id = p_id)
    when 'lesson' then exists (select 1 from content.lessons t where t.id = p_id)
    when 'lesson_section' then exists (select 1 from content.lesson_sections t where t.id = p_id)
    when 'learning_objective' then exists (select 1 from content.learning_objectives t where t.id = p_id)
    when 'question' then exists (select 1 from content.questions t where t.id = p_id)
    when 'source' then exists (select 1 from content.sources t where t.id = p_id)
    else false
  end;
$$;

create or replace function private.assert_content_entity_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'content_sources' then
    if not private.content_entity_exists(new.entity_kind, new.entity_id) then
      raise exception using errcode = '23503', message = 'content source target does not exist';
    end if;
  elsif tg_table_name = 'content_relationships' then
    if not private.content_entity_exists(new.from_kind, new.from_id) then
      raise exception using errcode = '23503', message = 'content relationship source does not exist';
    end if;
    if not private.content_entity_exists(new.to_kind, new.to_id) then
      raise exception using errcode = '23503', message = 'content relationship target does not exist';
    end if;
  elsif tg_table_name = 'content_versions' then
    if not private.content_entity_exists(new.entity_kind, new.entity_id) then
      raise exception using errcode = '23503', message = 'content version target does not exist';
    end if;
  end if;
  return new;
end;
$$;

create trigger content_sources_reference_check
before insert or update on content.content_sources
for each row execute function private.assert_content_entity_reference();

create trigger content_relationships_reference_check
before insert or update on content.content_relationships
for each row execute function private.assert_content_entity_reference();

create trigger content_versions_reference_check
before insert or update on content.content_versions
for each row execute function private.assert_content_entity_reference();

create or replace function private.validate_section_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_section_id is not null and not exists (
    select 1
    from content.lesson_sections parent
    where parent.id = new.parent_section_id
      and parent.lesson_id = new.lesson_id
  ) then
    raise exception using errcode = '23514', message = 'section parent must belong to the same lesson';
  end if;
  if new.parent_section_id = new.id then
    raise exception using errcode = '23514', message = 'section cannot be its own parent';
  end if;
  return new;
end;
$$;

create trigger lesson_sections_parent_check
before insert or update on content.lesson_sections
for each row execute function private.validate_section_parent();

create or replace function private.validate_question_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_group_subject uuid;
  v_lesson_group uuid;
  v_objective_lesson uuid;
begin
  if new.group_id is not null then
    select g.subject_id into v_group_subject
    from content.learning_groups g
    where g.id = new.group_id;
    if v_group_subject is distinct from new.subject_id then
      raise exception using errcode = '23514', message = 'question group must belong to question subject';
    end if;
  end if;

  if new.lesson_id is not null then
    select l.group_id into v_lesson_group
    from content.lessons l
    where l.id = new.lesson_id;
    if new.group_id is null or v_lesson_group is distinct from new.group_id then
      raise exception using errcode = '23514', message = 'question lesson requires its owning question group';
    end if;
  end if;

  if new.objective_id is not null then
    select o.lesson_id into v_objective_lesson
    from content.learning_objectives o
    where o.id = new.objective_id;
    if new.lesson_id is null or v_objective_lesson is distinct from new.lesson_id then
      raise exception using errcode = '23514', message = 'question objective requires its owning question lesson';
    end if;
  end if;
  return new;
end;
$$;

create trigger questions_hierarchy_check
before insert or update on content.questions
for each row execute function private.validate_question_hierarchy();

create or replace function private.validate_question_context_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subject_id is not null and new.programme_id is not null and not exists (
    select 1 from content.subjects s
    where s.id = new.subject_id and s.programme_id = new.programme_id
  ) then
    raise exception using errcode = '23514', message = 'context subject does not belong to context programme';
  end if;
  if new.group_id is not null and new.subject_id is not null and not exists (
    select 1 from content.learning_groups g
    where g.id = new.group_id and g.subject_id = new.subject_id
  ) then
    raise exception using errcode = '23514', message = 'context group does not belong to context subject';
  end if;
  if new.lesson_id is not null and new.group_id is not null and not exists (
    select 1 from content.lessons l
    where l.id = new.lesson_id and l.group_id = new.group_id
  ) then
    raise exception using errcode = '23514', message = 'context lesson does not belong to context group';
  end if;
  return new;
end;
$$;

create trigger question_contexts_hierarchy_check
before insert or update on content.question_contexts
for each row execute function private.validate_question_context_hierarchy();

create or replace function private.prevent_question_context_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.enabled then
    return new;
  end if;

  if (
    new.context in ('lesson_practice', 'group_practice')
    and exists (
      select 1
      from content.question_contexts other
      where other.question_id = new.question_id
        and other.id <> new.id
        and other.enabled
        and other.context in ('mastery_assessment', 'expert_challenge')
    )
  ) or (
    new.context in ('mastery_assessment', 'expert_challenge')
    and exists (
      select 1
      from content.question_contexts other
      where other.question_id = new.question_id
        and other.id <> new.id
        and other.enabled
        and other.context in ('lesson_practice', 'group_practice')
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'a question cannot be enabled for both public practice and official mastery contexts';
  end if;

  return new;
end;
$$;

create constraint trigger question_contexts_no_practice_mastery_overlap
after insert or update on content.question_contexts
deferrable initially immediate
for each row execute function private.prevent_question_context_overlap();

create or replace function private.validate_bookmark_section()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from content.lesson_sections s
    where s.id = new.section_id and s.lesson_id = new.lesson_id
  ) then
    raise exception using errcode = '23514', message = 'bookmark section must belong to bookmark lesson';
  end if;
  return new;
end;
$$;

create trigger bookmarks_section_check
before insert or update on public.bookmarks
for each row execute function private.validate_bookmark_section();

create or replace function private.enforce_publication_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('scheduled', 'published') and new.review_status <> 'approved' then
    raise exception using errcode = '23514', message = 'scheduled and published content must be approved';
  end if;
  if tg_op = 'UPDATE' and new.version < old.version then
    raise exception using errcode = '23514', message = 'content version cannot decrease';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_published_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception using errcode = '23503', message = 'published content must be archived, not deleted';
  end if;
  return old;
end;
$$;

create or replace function private.audit_content_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
begin
  v_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into content.audit_log (
    actor_id,
    action,
    entity_kind,
    entity_id,
    old_data,
    new_data,
    metadata,
    request_id
  ) values (
    private.current_actor_id(),
    lower(tg_op),
    tg_argv[0],
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    jsonb_build_object('table', tg_table_schema || '.' || tg_table_name),
    nullif(pg_catalog.current_setting('request.header.x-request-id', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $triggers$
declare
  v_table text;
begin
  foreach v_table in array array[
    'programmes', 'subjects', 'learning_groups', 'lessons',
    'lesson_sections', 'learning_objectives', 'sources', 'questions'
  ]
  loop
    execute format(
      'create trigger %I_workflow before insert or update on content.%I for each row execute function private.enforce_publication_workflow()',
      v_table,
      v_table
    );
    execute format(
      'create trigger %I_no_published_delete before delete on content.%I for each row execute function private.prevent_published_delete()',
      v_table,
      v_table
    );
  end loop;

  foreach v_table in array array[
    'programmes', 'subjects', 'learning_groups', 'lessons',
    'lesson_sections', 'learning_objectives', 'sources', 'questions',
    'question_options', 'question_contexts'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on content.%I for each row execute function private.touch_updated_at()',
      v_table,
      v_table
    );
  end loop;
end;
$triggers$;

do $audit_triggers$
declare
  v_item record;
begin
  for v_item in
    select * from (values
      ('programmes', 'programme'),
      ('subjects', 'subject'),
      ('learning_groups', 'learning_group'),
      ('lessons', 'lesson'),
      ('lesson_sections', 'lesson_section'),
      ('learning_objectives', 'learning_objective'),
      ('sources', 'source'),
      ('questions', 'question'),
      ('question_options', 'question_option'),
      ('question_contexts', 'question_context')
    ) as x(table_name, entity_name)
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on content.%I for each row execute function private.audit_content_row(%L)',
      v_item.table_name,
      v_item.table_name,
      v_item.entity_name
    );
  end loop;
end;
$audit_triggers$;

do $touch_triggers$
declare
  v_item text;
begin
  foreach v_item in array array[
    'learner_profiles', 'lesson_progress', 'bookmarks', 'mastery_attempts',
    'group_progress', 'review_schedule', 'question_metrics'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',
      v_item,
      v_item
    );
  end loop;
  foreach v_item in array array['rooms', 'sessions', 'leaderboard_entries']
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on game.%I for each row execute function private.touch_updated_at()',
      v_item,
      v_item
    );
  end loop;
end;
$touch_triggers$;

create or replace function private.prevent_prerequisite_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dependent uuid;
  v_prerequisite uuid;
  v_has_cycle boolean;
  v_sql text;
begin
  v_dependent := (to_jsonb(new) ->> tg_argv[1])::uuid;
  v_prerequisite := (to_jsonb(new) ->> tg_argv[2])::uuid;
  v_sql := format(
    'with recursive ancestry(id) as (
       select $1::uuid
       union
       select edge.%I
       from content.%I edge
       join ancestry a on edge.%I = a.id
     )
     select exists (select 1 from ancestry where id = $2::uuid)',
    tg_argv[2],
    tg_argv[0],
    tg_argv[1]
  );
  execute v_sql into v_has_cycle using v_prerequisite, v_dependent;
  if v_has_cycle then
    raise exception using errcode = '23514', message = 'prerequisite cycle detected';
  end if;
  return new;
end;
$$;

create trigger programme_prerequisites_cycle_check
before insert or update on content.programme_prerequisites
for each row execute function private.prevent_prerequisite_cycle(
  'programme_prerequisites', 'programme_id', 'prerequisite_programme_id'
);

create trigger subject_prerequisites_cycle_check
before insert or update on content.subject_prerequisites
for each row execute function private.prevent_prerequisite_cycle(
  'subject_prerequisites', 'subject_id', 'prerequisite_subject_id'
);

create trigger group_prerequisites_cycle_check
before insert or update on content.group_prerequisites
for each row execute function private.prevent_prerequisite_cycle(
  'group_prerequisites', 'group_id', 'prerequisite_group_id'
);

create trigger lesson_prerequisites_cycle_check
before insert or update on content.lesson_prerequisites
for each row execute function private.prevent_prerequisite_cycle(
  'lesson_prerequisites', 'lesson_id', 'prerequisite_lesson_id'
);

create or replace function private.content_entity_is_visible(
  p_kind content.entity_kind,
  p_id uuid,
  p_authenticated boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'programme' then exists (
      select 1 from content.programmes p
      where p.id = p_id
        and p.status = 'published'
        and p.published_at <= now()
        and (
          p.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and p.visibility = 'authenticated')
        )
    )
    when 'subject' then exists (
      select 1 from content.subjects s
      join content.programmes p on p.id = s.programme_id
      where s.id = p_id
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (
          s.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and s.visibility = 'authenticated')
        )
        and (
          p.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and p.visibility = 'authenticated')
        )
    )
    when 'learning_group' then exists (
      select 1 from content.learning_groups g
      join content.subjects s on s.id = g.subject_id
      join content.programmes p on p.id = s.programme_id
      where g.id = p_id
        and g.status = 'published' and g.published_at <= now()
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (
          g.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and g.visibility = 'authenticated')
        )
        and (
          s.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and s.visibility = 'authenticated')
        )
        and (
          p.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and p.visibility = 'authenticated')
        )
    )
    when 'lesson' then exists (
      select 1 from content.lessons l
      join content.learning_groups g on g.id = l.group_id
      join content.subjects s on s.id = g.subject_id
      join content.programmes p on p.id = s.programme_id
      where l.id = p_id
        and l.status = 'published' and l.published_at <= now()
        and g.status = 'published' and g.published_at <= now()
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (
          l.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and l.visibility = 'authenticated')
        )
        and (
          g.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and g.visibility = 'authenticated')
        )
        and (
          s.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and s.visibility = 'authenticated')
        )
        and (
          p.visibility in ('public', 'locked', 'coming_soon')
          or (p_authenticated and p.visibility = 'authenticated')
        )
    )
    when 'lesson_section' then exists (
      select 1 from content.lesson_sections ls
      join content.lessons l on l.id = ls.lesson_id
      join content.learning_groups g on g.id = l.group_id
      join content.subjects s on s.id = g.subject_id
      join content.programmes p on p.id = s.programme_id
      where ls.id = p_id
        and ls.status = 'published' and ls.published_at <= now()
        and (ls.visibility = 'public' or (p_authenticated and ls.visibility = 'authenticated'))
        and l.status = 'published' and l.published_at <= now()
        and g.status = 'published' and g.published_at <= now()
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (l.visibility = 'public' or (p_authenticated and l.visibility = 'authenticated'))
        and (g.visibility = 'public' or (p_authenticated and g.visibility = 'authenticated'))
        and (s.visibility = 'public' or (p_authenticated and s.visibility = 'authenticated'))
        and (p.visibility = 'public' or (p_authenticated and p.visibility = 'authenticated'))
    )
    when 'learning_objective' then exists (
      select 1 from content.learning_objectives o
      join content.lessons l on l.id = o.lesson_id
      join content.learning_groups g on g.id = l.group_id
      join content.subjects s on s.id = g.subject_id
      join content.programmes p on p.id = s.programme_id
      where o.id = p_id
        and o.status = 'published' and o.published_at <= now()
        and l.status = 'published' and l.published_at <= now()
        and g.status = 'published' and g.published_at <= now()
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (l.visibility = 'public' or (p_authenticated and l.visibility = 'authenticated'))
        and (g.visibility = 'public' or (p_authenticated and g.visibility = 'authenticated'))
        and (s.visibility = 'public' or (p_authenticated and s.visibility = 'authenticated'))
        and (p.visibility = 'public' or (p_authenticated and p.visibility = 'authenticated'))
    )
    when 'question' then exists (
      select 1 from content.questions q
      join content.subjects s on s.id = q.subject_id
      join content.programmes p on p.id = s.programme_id
      left join content.learning_groups g on g.id = q.group_id
      left join content.lessons l on l.id = q.lesson_id
      left join content.learning_objectives o on o.id = q.objective_id
      where q.id = p_id
        and q.status = 'published'
        and q.published_at <= now()
        and q.retirement_status = 'active'
        and s.status = 'published' and s.published_at <= now()
        and p.status = 'published' and p.published_at <= now()
        and (g.id is null or (g.status = 'published' and g.published_at <= now()))
        and (l.id is null or (l.status = 'published' and l.published_at <= now()))
        and (o.id is null or (o.status = 'published' and o.published_at <= now()))
        and (s.visibility = 'public' or (p_authenticated and s.visibility = 'authenticated'))
        and (p.visibility = 'public' or (p_authenticated and p.visibility = 'authenticated'))
        and (g.id is null or g.visibility = 'public' or (p_authenticated and g.visibility = 'authenticated'))
        and (l.id is null or l.visibility = 'public' or (p_authenticated and l.visibility = 'authenticated'))
        and exists (
          select 1
          from content.question_contexts qc
          where qc.question_id = q.id
            and qc.context in ('lesson_practice', 'group_practice')
            and qc.enabled
            and (qc.valid_from is null or qc.valid_from <= now())
            and (qc.valid_until is null or qc.valid_until > now())
        )
    )
    when 'source' then exists (
      select 1 from content.sources s
      where s.id = p_id
        and s.status = 'published'
        and s.published_at <= now()
        and (s.visibility = 'public' or (p_authenticated and s.visibility = 'authenticated'))
    )
    else false
  end;
$$;

create view content.published_programmes
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.title,
  p.short_description,
  p.cover_asset_path,
  p.display_order,
  p.visibility,
  p.estimated_minutes,
  p.level,
  p.version,
  p.published_at,
  p.search_metadata,
  p.localisation
from content.programmes p
where p.status = 'published'
  and p.published_at <= now()
  and p.visibility in ('public', 'locked', 'coming_soon');

create view content.published_subjects
with (security_invoker = true)
as
select
  s.id,
  s.programme_id,
  s.slug,
  s.title,
  s.short_description,
  s.cover_asset_path,
  s.display_order,
  s.visibility,
  s.estimated_minutes,
  s.level,
  s.version,
  s.published_at,
  s.search_metadata,
  s.localisation
from content.subjects s
join content.programmes p on p.id = s.programme_id
where s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and s.visibility in ('public', 'locked', 'coming_soon')
  and p.visibility in ('public', 'locked', 'coming_soon');

create view content.published_learning_groups
with (security_invoker = true)
as
select
  g.id,
  g.subject_id,
  g.slug,
  g.title,
  g.short_description,
  g.cover_asset_path,
  g.display_order,
  g.visibility,
  g.estimated_minutes,
  g.level,
  g.mastery_threshold_percent,
  g.is_initially_unlocked,
  g.is_optional_expert_challenge,
  g.version,
  g.published_at,
  g.search_metadata,
  g.localisation
from content.learning_groups g
join content.subjects s on s.id = g.subject_id
join content.programmes p on p.id = s.programme_id
where g.status = 'published' and g.published_at <= now()
  and s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and g.visibility in ('public', 'locked', 'coming_soon')
  and s.visibility in ('public', 'locked', 'coming_soon')
  and p.visibility in ('public', 'locked', 'coming_soon');

create view content.published_lessons
with (security_invoker = true)
as
select
  l.id,
  l.group_id,
  l.slug,
  l.title,
  l.short_description,
  l.cover_asset_path,
  l.display_order,
  l.visibility,
  l.estimated_minutes,
  l.level,
  l.version,
  l.published_at,
  l.search_metadata,
  l.localisation
from content.lessons l
join content.learning_groups g on g.id = l.group_id
join content.subjects s on s.id = g.subject_id
join content.programmes p on p.id = s.programme_id
where l.status = 'published' and l.published_at <= now()
  and g.status = 'published' and g.published_at <= now()
  and s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and l.visibility in ('public', 'locked', 'coming_soon')
  and g.visibility in ('public', 'locked', 'coming_soon')
  and s.visibility in ('public', 'locked', 'coming_soon')
  and p.visibility in ('public', 'locked', 'coming_soon');

create view content.published_lesson_sections
with (security_invoker = true)
as
select
  ls.id,
  ls.lesson_id,
  ls.parent_section_id,
  ls.slug,
  ls.title,
  ls.block_kind,
  ls.content,
  ls.display_order,
  ls.version,
  ls.published_at
from content.lesson_sections ls
join content.lessons l on l.id = ls.lesson_id
join content.learning_groups g on g.id = l.group_id
join content.subjects s on s.id = g.subject_id
join content.programmes p on p.id = s.programme_id
where ls.status = 'published' and ls.published_at <= now()
  and l.status = 'published' and l.published_at <= now()
  and g.status = 'published' and g.published_at <= now()
  and s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and ls.visibility = 'public'
  and l.visibility = 'public'
  and g.visibility = 'public'
  and s.visibility = 'public'
  and p.visibility = 'public';

create view content.published_learning_objectives
with (security_invoker = true)
as
select
  o.id,
  o.lesson_id,
  o.code,
  o.description,
  o.display_order,
  o.mastery_weight,
  o.version,
  o.published_at
from content.learning_objectives o
join content.lessons l on l.id = o.lesson_id
join content.learning_groups g on g.id = l.group_id
join content.subjects s on s.id = g.subject_id
join content.programmes p on p.id = s.programme_id
where o.status = 'published' and o.published_at <= now()
  and l.status = 'published' and l.published_at <= now()
  and g.status = 'published' and g.published_at <= now()
  and s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and l.visibility = 'public'
  and g.visibility = 'public'
  and s.visibility = 'public'
  and p.visibility = 'public';

create view content.published_sources
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.source_kind,
  s.author,
  s.publisher,
  s.publication_year,
  s.url,
  s.citation,
  s.rights_metadata,
  s.version,
  s.published_at
from content.sources s
where s.status = 'published'
  and s.published_at <= now()
  and s.visibility = 'public';

create view content.published_questions
with (security_invoker = true)
as
select
  q.id,
  q.stable_key,
  q.subject_id,
  q.group_id,
  q.lesson_id,
  q.objective_id,
  q.difficulty,
  q.question_type,
  q.prompt,
  q.denomination_scope,
  q.rights_metadata,
  q.version,
  q.published_at
from content.questions q
join content.subjects s on s.id = q.subject_id
join content.programmes p on p.id = s.programme_id
left join content.learning_groups g on g.id = q.group_id
left join content.lessons l on l.id = q.lesson_id
where q.status = 'published'
  and q.published_at <= now()
  and q.retirement_status = 'active'
  and s.status = 'published' and s.published_at <= now()
  and p.status = 'published' and p.published_at <= now()
  and (g.id is null or (g.status = 'published' and g.published_at <= now()))
  and (l.id is null or (l.status = 'published' and l.published_at <= now()))
  and s.visibility = 'public'
  and p.visibility = 'public'
  and (g.id is null or g.visibility = 'public')
  and (l.id is null or l.visibility = 'public')
  and exists (
    select 1
    from content.question_contexts practice_context
    where practice_context.question_id = q.id
      and practice_context.context in ('lesson_practice', 'group_practice')
      and practice_context.enabled
      and (practice_context.valid_from is null or practice_context.valid_from <= now())
      and (practice_context.valid_until is null or practice_context.valid_until > now())
  );

create view content.published_question_options
with (security_invoker = true)
as
select
  o.id,
  o.question_id,
  o.position,
  o.label,
  o.content
from content.question_options o
join content.published_questions q on q.id = o.question_id
where o.enabled
;

create view content.published_question_contexts
with (security_invoker = true)
as
select
  qc.id,
  qc.question_id,
  qc.context,
  qc.programme_id,
  qc.subject_id,
  qc.group_id,
  qc.lesson_id,
  qc.weight,
  qc.settings,
  qc.valid_from,
  qc.valid_until
from content.question_contexts qc
join content.published_questions q on q.id = qc.question_id
where qc.enabled
  and qc.context in ('lesson_practice', 'group_practice')
  and (qc.valid_from is null or qc.valid_from <= now())
  and (qc.valid_until is null or qc.valid_until > now());

create view content.published_content_sources
with (security_invoker = true)
as
select
  cs.id,
  cs.entity_kind,
  cs.entity_id,
  cs.source_id,
  cs.relationship_type,
  cs.citation_locator,
  cs.rights_metadata,
  cs.display_order
from content.content_sources cs
join content.sources s on s.id = cs.source_id
where s.status = 'published'
  and s.published_at <= now()
  and s.visibility = 'public'
  and private.content_entity_is_visible(cs.entity_kind, cs.entity_id, false);

create view content.published_subject_prerequisites
with (security_invoker = true)
as
select sp.subject_id, sp.prerequisite_subject_id, sp.requirement, sp.minimum_score_percent
from content.subject_prerequisites sp
join content.published_subjects s on s.id = sp.subject_id
join content.published_subjects prerequisite on prerequisite.id = sp.prerequisite_subject_id;

create view content.published_programme_prerequisites
with (security_invoker = true)
as
select pp.programme_id, pp.prerequisite_programme_id, pp.requirement, pp.minimum_score_percent
from content.programme_prerequisites pp
join content.published_programmes p on p.id = pp.programme_id
join content.published_programmes prerequisite on prerequisite.id = pp.prerequisite_programme_id;

create view content.published_group_prerequisites
with (security_invoker = true)
as
select gp.group_id, gp.prerequisite_group_id, gp.requirement, gp.minimum_score_percent
from content.group_prerequisites gp
join content.published_learning_groups g on g.id = gp.group_id
join content.published_learning_groups prerequisite on prerequisite.id = gp.prerequisite_group_id;

create view content.published_lesson_prerequisites
with (security_invoker = true)
as
select lp.lesson_id, lp.prerequisite_lesson_id, lp.requirement, lp.minimum_score_percent
from content.lesson_prerequisites lp
join content.published_lessons l on l.id = lp.lesson_id
join content.published_lessons prerequisite on prerequisite.id = lp.prerequisite_lesson_id;

create view content.published_content_relationships
with (security_invoker = true)
as
select
  relationship.id,
  relationship.from_kind,
  relationship.from_id,
  relationship.to_kind,
  relationship.to_id,
  relationship.relationship_type,
  relationship.metadata,
  relationship.display_order
from content.content_relationships relationship
where private.content_entity_is_visible(relationship.from_kind, relationship.from_id, false)
  and private.content_entity_is_visible(relationship.to_kind, relationship.to_id, false);

create view content.published_catalogue_feed
with (security_invoker = true)
as
select
  p.id as programme_id,
  p.slug,
  p.title,
  p.short_description,
  p.cover_asset_path,
  p.display_order,
  p.version,
  p.published_at,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'title', s.title,
        'short_description', s.short_description,
        'display_order', s.display_order,
        'version', s.version,
        'groups', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', g.id,
              'slug', g.slug,
              'title', g.title,
              'short_description', g.short_description,
              'display_order', g.display_order,
              'visibility', g.visibility,
              'mastery_threshold_percent', g.mastery_threshold_percent,
              'is_initially_unlocked', g.is_initially_unlocked,
              'is_optional_expert_challenge', g.is_optional_expert_challenge,
              'version', g.version
            ) order by g.display_order, g.id
          )
          from content.learning_groups g
          where g.subject_id = s.id
            and g.status = 'published'
            and g.published_at <= now()
            and g.visibility in ('public', 'locked', 'coming_soon')
        ), '[]'::jsonb)
      ) order by s.display_order, s.id
    )
    from content.subjects s
    where s.programme_id = p.id
      and s.status = 'published'
      and s.published_at <= now()
      and s.visibility in ('public', 'locked', 'coming_soon')
  ), '[]'::jsonb) as subjects
from content.programmes p
where p.status = 'published'
  and p.published_at <= now()
  and p.visibility in ('public', 'locked', 'coming_soon');

create view content.published_live_question_feed
with (security_invoker = true)
as
select
  q.id as question_id,
  q.stable_key,
  q.version,
  q.subject_id,
  q.group_id,
  q.lesson_id,
  q.objective_id,
  q.difficulty,
  q.question_type,
  q.prompt,
  q.correct_answer_explanation,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'option_id', o.id,
        'position', o.position,
        'label', o.label,
        'content', o.content,
        'is_correct', o.is_correct,
        'explanation', o.explanation
      ) order by o.position, o.id
    )
    from content.question_options o
    where o.question_id = q.id
      and o.enabled
  ), '[]'::jsonb) as options,
  q.updated_at
from content.questions q
join content.subjects s on s.id = q.subject_id
join content.programmes p on p.id = s.programme_id
left join content.learning_groups g on g.id = q.group_id
left join content.lessons l on l.id = q.lesson_id
left join content.learning_objectives objective on objective.id = q.objective_id
where q.status = 'published'
  and q.published_at <= now()
  and q.retirement_status = 'active'
  and s.status = 'published' and s.published_at <= now() and s.visibility = 'public'
  and p.status = 'published' and p.published_at <= now() and p.visibility = 'public'
  and (g.id is null or (g.status = 'published' and g.published_at <= now() and g.visibility = 'public'))
  and (l.id is null or (l.status = 'published' and l.published_at <= now() and l.visibility = 'public'))
  and (objective.id is null or (objective.status = 'published' and objective.published_at <= now()))
  and q.question_type in ('single_choice', 'true_false')
  and (select count(*) from content.question_options o where o.question_id = q.id and o.enabled) = 4
  and (select count(*) from content.question_options o where o.question_id = q.id and o.enabled and o.is_correct) = 1
  and exists (
    select 1
    from content.question_contexts qc
    where qc.question_id = q.id
      and qc.context = 'live_quiz'
      and qc.enabled
      and (qc.valid_from is null or qc.valid_from <= now())
      and (qc.valid_until is null or qc.valid_until > now())
  );

create view content.invalid_live_question_configurations
with (security_invoker = true)
as
select
  q.id as question_id,
  q.stable_key,
  q.question_type,
  count(o.id) filter (where o.enabled)::integer as enabled_option_count,
  count(o.id) filter (where o.enabled and o.is_correct)::integer as enabled_correct_option_count,
  array_remove(array[
    case when q.question_type not in ('single_choice', 'true_false') then 'unsupported_question_type' end,
    case when count(o.id) filter (where o.enabled) <> 4 then 'enabled_option_count_must_equal_4' end,
    case when count(o.id) filter (where o.enabled and o.is_correct) <> 1 then 'enabled_correct_option_count_must_equal_1' end,
    case when s.status <> 'published' or s.published_at > now() or s.visibility <> 'public' then 'subject_not_publicly_published' end,
    case when p.status <> 'published' or p.published_at > now() or p.visibility <> 'public' then 'programme_not_publicly_published' end,
    case when g.id is not null and (g.status <> 'published' or g.published_at > now() or g.visibility <> 'public') then 'group_not_publicly_published' end,
    case when l.id is not null and (l.status <> 'published' or l.published_at > now() or l.visibility <> 'public') then 'lesson_not_publicly_published' end
  ], null) as reasons,
  q.updated_at
from content.questions q
join content.subjects s on s.id = q.subject_id
join content.programmes p on p.id = s.programme_id
left join content.learning_groups g on g.id = q.group_id
left join content.lessons l on l.id = q.lesson_id
left join content.question_options o on o.question_id = q.id
where q.status = 'published'
  and q.published_at <= now()
  and q.retirement_status = 'active'
  and exists (
    select 1
    from content.question_contexts qc
    where qc.question_id = q.id
      and qc.context = 'live_quiz'
      and qc.enabled
      and (qc.valid_from is null or qc.valid_from <= now())
      and (qc.valid_until is null or qc.valid_until > now())
  )
group by q.id, q.stable_key, q.question_type, q.updated_at,
  s.status, s.published_at, s.visibility,
  p.status, p.published_at, p.visibility,
  g.id, g.status, g.published_at, g.visibility,
  l.id, l.status, l.published_at, l.visibility
having q.question_type not in ('single_choice', 'true_false')
  or count(o.id) filter (where o.enabled) <> 4
  or count(o.id) filter (where o.enabled and o.is_correct) <> 1
  or s.status <> 'published' or s.published_at > now() or s.visibility <> 'public'
  or p.status <> 'published' or p.published_at > now() or p.visibility <> 'public'
  or (g.id is not null and (g.status <> 'published' or g.published_at > now() or g.visibility <> 'public'))
  or (l.id is not null and (l.status <> 'published' or l.published_at > now() or l.visibility <> 'public'));

create view public.review_recommendations
with (security_invoker = true)
as
select
  rs.learner_id,
  rs.question_id,
  rs.due_at,
  rs.interval_days,
  rs.ease_factor,
  rs.repetition_count,
  rs.last_result,
  q.subject_id,
  q.group_id,
  q.lesson_id,
  q.difficulty,
  q.prompt
from public.review_schedule rs
join content.published_questions q on q.id = rs.question_id
where rs.due_at <= now();

create or replace function private.owns_learner(p_learner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = p_learner_id
        and lp.auth_user_id = auth.uid()
    );
$$;

alter table content.programmes enable row level security;
alter table content.programme_prerequisites enable row level security;
alter table content.subjects enable row level security;
alter table content.subject_prerequisites enable row level security;
alter table content.learning_groups enable row level security;
alter table content.group_prerequisites enable row level security;
alter table content.lessons enable row level security;
alter table content.lesson_prerequisites enable row level security;
alter table content.lesson_sections enable row level security;
alter table content.learning_objectives enable row level security;
alter table content.sources enable row level security;
alter table content.questions enable row level security;
alter table content.question_options enable row level security;
alter table content.question_contexts enable row level security;
alter table content.content_sources enable row level security;
alter table content.content_relationships enable row level security;
alter table content.content_versions enable row level security;
alter table content.audit_log enable row level security;

alter table public.learner_profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.mastery_attempts enable row level security;
alter table public.mastery_attempt_questions enable row level security;
alter table public.mastery_answers enable row level security;
alter table public.unlocks enable row level security;
alter table public.group_progress enable row level security;
alter table public.review_schedule enable row level security;
alter table public.question_metrics enable row level security;

alter table game.rooms enable row level security;
alter table game.room_participants enable row level security;
alter table game.sessions enable row level security;
alter table game.session_questions enable row level security;
alter table game.player_answers enable row level security;
alter table game.leaderboard_entries enable row level security;

create policy programmes_anon_read on content.programmes
for select to anon
using (private.content_entity_is_visible('programme', id, false));

create policy programmes_authenticated_read on content.programmes
for select to authenticated
using (private.content_entity_is_visible('programme', id, true));

create policy subjects_anon_read on content.subjects
for select to anon
using (private.content_entity_is_visible('subject', id, false));

create policy subjects_authenticated_read on content.subjects
for select to authenticated
using (private.content_entity_is_visible('subject', id, true));

create policy learning_groups_anon_read on content.learning_groups
for select to anon
using (private.content_entity_is_visible('learning_group', id, false));

create policy learning_groups_authenticated_read on content.learning_groups
for select to authenticated
using (private.content_entity_is_visible('learning_group', id, true));

create policy lessons_anon_read on content.lessons
for select to anon
using (private.content_entity_is_visible('lesson', id, false));

create policy lessons_authenticated_read on content.lessons
for select to authenticated
using (private.content_entity_is_visible('lesson', id, true));

create policy lesson_sections_anon_read on content.lesson_sections
for select to anon
using (private.content_entity_is_visible('lesson_section', id, false));

create policy lesson_sections_authenticated_read on content.lesson_sections
for select to authenticated
using (private.content_entity_is_visible('lesson_section', id, true));

create policy learning_objectives_anon_read on content.learning_objectives
for select to anon
using (private.content_entity_is_visible('learning_objective', id, false));

create policy learning_objectives_authenticated_read on content.learning_objectives
for select to authenticated
using (private.content_entity_is_visible('learning_objective', id, true));

create policy sources_anon_read on content.sources
for select to anon
using (private.content_entity_is_visible('source', id, false));

create policy sources_authenticated_read on content.sources
for select to authenticated
using (private.content_entity_is_visible('source', id, true));

create policy questions_anon_read on content.questions
for select to anon
using (private.content_entity_is_visible('question', id, false));

create policy questions_authenticated_read on content.questions
for select to authenticated
using (private.content_entity_is_visible('question', id, true));

create policy question_options_anon_read on content.question_options
for select to anon
using (private.content_entity_is_visible('question', question_id, false));

create policy question_options_authenticated_read on content.question_options
for select to authenticated
using (private.content_entity_is_visible('question', question_id, true));

create policy question_contexts_anon_read on content.question_contexts
for select to anon
using (
  enabled
  and context in ('lesson_practice', 'group_practice')
  and (valid_from is null or valid_from <= now())
  and (valid_until is null or valid_until > now())
  and private.content_entity_is_visible('question', question_id, false)
);

create policy question_contexts_authenticated_read on content.question_contexts
for select to authenticated
using (
  enabled
  and context in ('lesson_practice', 'group_practice')
  and (valid_from is null or valid_from <= now())
  and (valid_until is null or valid_until > now())
  and private.content_entity_is_visible('question', question_id, true)
);

create policy content_sources_anon_read on content.content_sources
for select to anon
using (
  private.content_entity_is_visible(entity_kind, entity_id, false)
  and private.content_entity_is_visible('source', source_id, false)
);

create policy content_sources_authenticated_read on content.content_sources
for select to authenticated
using (
  private.content_entity_is_visible(entity_kind, entity_id, true)
  and private.content_entity_is_visible('source', source_id, true)
);

create policy content_relationships_anon_read on content.content_relationships
for select to anon
using (
  private.content_entity_is_visible(from_kind, from_id, false)
  and private.content_entity_is_visible(to_kind, to_id, false)
);

create policy content_relationships_authenticated_read on content.content_relationships
for select to authenticated
using (
  private.content_entity_is_visible(from_kind, from_id, true)
  and private.content_entity_is_visible(to_kind, to_id, true)
);

create policy programme_prerequisites_anon_read on content.programme_prerequisites
for select to anon
using (
  private.content_entity_is_visible('programme', programme_id, false)
  and private.content_entity_is_visible('programme', prerequisite_programme_id, false)
);

create policy programme_prerequisites_authenticated_read on content.programme_prerequisites
for select to authenticated
using (
  private.content_entity_is_visible('programme', programme_id, true)
  and private.content_entity_is_visible('programme', prerequisite_programme_id, true)
);

create policy subject_prerequisites_anon_read on content.subject_prerequisites
for select to anon
using (
  private.content_entity_is_visible('subject', subject_id, false)
  and private.content_entity_is_visible('subject', prerequisite_subject_id, false)
);

create policy subject_prerequisites_authenticated_read on content.subject_prerequisites
for select to authenticated
using (
  private.content_entity_is_visible('subject', subject_id, true)
  and private.content_entity_is_visible('subject', prerequisite_subject_id, true)
);

create policy group_prerequisites_anon_read on content.group_prerequisites
for select to anon
using (
  private.content_entity_is_visible('learning_group', group_id, false)
  and private.content_entity_is_visible('learning_group', prerequisite_group_id, false)
);

create policy group_prerequisites_authenticated_read on content.group_prerequisites
for select to authenticated
using (
  private.content_entity_is_visible('learning_group', group_id, true)
  and private.content_entity_is_visible('learning_group', prerequisite_group_id, true)
);

create policy lesson_prerequisites_anon_read on content.lesson_prerequisites
for select to anon
using (
  private.content_entity_is_visible('lesson', lesson_id, false)
  and private.content_entity_is_visible('lesson', prerequisite_lesson_id, false)
);

create policy lesson_prerequisites_authenticated_read on content.lesson_prerequisites
for select to authenticated
using (
  private.content_entity_is_visible('lesson', lesson_id, true)
  and private.content_entity_is_visible('lesson', prerequisite_lesson_id, true)
);

create policy learner_profiles_select_own on public.learner_profiles
for select to authenticated
using (auth_user_id = auth.uid());

create policy learner_profiles_insert_own on public.learner_profiles
for insert to authenticated
with check (
  auth_user_id = auth.uid()
  and identity_provider = 'supabase'
  and external_subject is null
);

create policy learner_profiles_update_own on public.learner_profiles
for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy lesson_progress_select_own on public.lesson_progress
for select to authenticated
using (private.owns_learner(learner_id));

create policy lesson_progress_insert_own on public.lesson_progress
for insert to authenticated
with check (private.owns_learner(learner_id));

create policy lesson_progress_update_own on public.lesson_progress
for update to authenticated
using (private.owns_learner(learner_id))
with check (private.owns_learner(learner_id));

create policy bookmarks_select_own on public.bookmarks
for select to authenticated
using (private.owns_learner(learner_id));

create policy bookmarks_insert_own on public.bookmarks
for insert to authenticated
with check (private.owns_learner(learner_id));

create policy bookmarks_update_own on public.bookmarks
for update to authenticated
using (private.owns_learner(learner_id))
with check (private.owns_learner(learner_id));

create policy bookmarks_delete_own on public.bookmarks
for delete to authenticated
using (private.owns_learner(learner_id));

create policy mastery_attempts_select_own on public.mastery_attempts
for select to authenticated
using (private.owns_learner(learner_id));

create policy mastery_answers_select_submitted_own on public.mastery_answers
for select to authenticated
using (
  private.owns_learner(learner_id)
  and exists (
    select 1 from public.mastery_attempts a
    where a.id = mastery_answers.attempt_id
      and a.learner_id = mastery_answers.learner_id
      and a.status = 'submitted'
  )
);

create policy unlocks_select_own on public.unlocks
for select to authenticated
using (private.owns_learner(learner_id));

create policy group_progress_select_own on public.group_progress
for select to authenticated
using (private.owns_learner(learner_id));

create policy review_schedule_select_own on public.review_schedule
for select to authenticated
using (private.owns_learner(learner_id));

grant usage on schema content to anon, authenticated, service_role;
grant usage on schema private to anon, authenticated, service_role;
grant usage on schema game to service_role;

grant select (
  id, slug, title, short_description, cover_asset_path, display_order,
  status, visibility, estimated_minutes, level, version, published_at,
  search_metadata, localisation
) on content.programmes to anon, authenticated;

grant select (
  id, programme_id, slug, title, short_description, cover_asset_path,
  display_order, status, visibility, estimated_minutes, level, version,
  published_at, search_metadata, localisation
) on content.subjects to anon, authenticated;

grant select (
  id, subject_id, slug, title, short_description, cover_asset_path,
  display_order, status, visibility, estimated_minutes, level,
  mastery_threshold_percent, is_initially_unlocked,
  is_optional_expert_challenge, version, published_at,
  search_metadata, localisation
) on content.learning_groups to anon, authenticated;

grant select (
  id, group_id, slug, title, short_description, cover_asset_path,
  display_order, status, visibility, estimated_minutes, level, version,
  published_at, search_metadata, localisation
) on content.lessons to anon, authenticated;

grant select (
  id, lesson_id, parent_section_id, slug, title, block_kind, content,
  display_order, status, visibility, version, published_at
) on content.lesson_sections to anon, authenticated;

grant select (
  id, lesson_id, code, description, display_order, mastery_weight,
  status, version, published_at
) on content.learning_objectives to anon, authenticated;

grant select (
  id, slug, title, source_kind, author, publisher, publication_year,
  url, citation, rights_metadata, status, visibility, version, published_at
) on content.sources to anon, authenticated;

grant select (
  id, stable_key, subject_id, group_id, lesson_id, objective_id,
  difficulty, question_type, prompt, denomination_scope, rights_metadata,
  status, retirement_status, version, published_at
) on content.questions to anon, authenticated;

grant select (id, question_id, position, label, content, enabled)
on content.question_options to anon, authenticated;

grant select (
  id, question_id, context, programme_id, subject_id, group_id, lesson_id,
  enabled, weight, settings, valid_from, valid_until
) on content.question_contexts to anon, authenticated;

grant select (programme_id, prerequisite_programme_id, requirement, minimum_score_percent)
on content.programme_prerequisites to anon, authenticated;
grant select (subject_id, prerequisite_subject_id, requirement, minimum_score_percent)
on content.subject_prerequisites to anon, authenticated;
grant select (group_id, prerequisite_group_id, requirement, minimum_score_percent)
on content.group_prerequisites to anon, authenticated;
grant select (lesson_id, prerequisite_lesson_id, requirement, minimum_score_percent)
on content.lesson_prerequisites to anon, authenticated;

grant select (
  id, entity_kind, entity_id, source_id, relationship_type,
  citation_locator, rights_metadata, display_order
) on content.content_sources to anon, authenticated;

grant select (
  id, from_kind, from_id, to_kind, to_id, relationship_type,
  metadata, display_order
) on content.content_relationships to anon, authenticated;

grant select on content.published_programmes to anon, authenticated;
grant select on content.published_subjects to anon, authenticated;
grant select on content.published_learning_groups to anon, authenticated;
grant select on content.published_lessons to anon, authenticated;
grant select on content.published_lesson_sections to anon, authenticated;
grant select on content.published_learning_objectives to anon, authenticated;
grant select on content.published_sources to anon, authenticated;
grant select on content.published_questions to anon, authenticated;
grant select on content.published_question_options to anon, authenticated;
grant select on content.published_question_contexts to anon, authenticated;
grant select on content.published_content_sources to anon, authenticated;
grant select on content.published_content_relationships to anon, authenticated;
grant select on content.published_programme_prerequisites to anon, authenticated;
grant select on content.published_subject_prerequisites to anon, authenticated;
grant select on content.published_group_prerequisites to anon, authenticated;
grant select on content.published_lesson_prerequisites to anon, authenticated;
grant select on content.published_catalogue_feed to anon, authenticated;

grant select on public.learner_profiles to authenticated;
grant insert (auth_user_id, display_name, locale, timezone, settings, last_seen_at)
  on public.learner_profiles to authenticated;
grant update (display_name, locale, timezone, settings, last_seen_at)
  on public.learner_profiles to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select on public.mastery_attempts to authenticated;
grant select on public.mastery_answers to authenticated;
grant select on public.unlocks to authenticated;
grant select on public.group_progress to authenticated;
grant select on public.review_schedule to authenticated;
grant select on public.review_recommendations to authenticated;

grant all on all tables in schema content to service_role;
grant all on all sequences in schema content to service_role;
grant all on table
  public.learner_profiles,
  public.lesson_progress,
  public.bookmarks,
  public.mastery_attempts,
  public.mastery_attempt_questions,
  public.mastery_answers,
  public.unlocks,
  public.group_progress,
  public.review_schedule,
  public.question_metrics,
  public.review_recommendations
to service_role;
grant all on all tables in schema game to service_role;
grant all on all sequences in schema game to service_role;

revoke all on content.published_live_question_feed from public, anon, authenticated;
grant select on content.published_live_question_feed to service_role;
revoke all on content.invalid_live_question_configurations from public, anon, authenticated;
grant select on content.invalid_live_question_configurations to service_role;

revoke execute on function private.content_entity_exists(content.entity_kind, uuid) from public;
revoke execute on function private.content_entity_is_visible(content.entity_kind, uuid, boolean) from public;
revoke execute on function private.owns_learner(uuid) from public;
revoke execute on function private.assert_learner_access(uuid) from public;
revoke execute on function private.request_role() from public;
revoke execute on function private.current_actor_id() from public;

grant execute on function private.content_entity_is_visible(content.entity_kind, uuid, boolean)
  to anon, authenticated, service_role;
grant execute on function private.owns_learner(uuid) to authenticated, service_role;

create or replace function private.group_requirement_met(
  p_learner_id uuid,
  p_group_id uuid,
  p_requirement content.prerequisite_requirement,
  p_minimum_score_percent numeric default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_requirement
    when 'unlock' then exists (
      select 1
      from public.unlocks u
      where u.learner_id = p_learner_id
        and u.group_id = p_group_id
    )
    when 'completion' then exists (
      select 1
      from public.group_progress gp
      where gp.learner_id = p_learner_id
        and gp.group_id = p_group_id
        and (
          gp.mastered
          or (gp.total_lessons > 0 and gp.completed_lessons >= gp.total_lessons)
        )
    )
    when 'mastery' then exists (
      select 1
      from public.group_progress gp
      where gp.learner_id = p_learner_id
        and gp.group_id = p_group_id
        and gp.mastered
        and gp.best_score_percent >= coalesce(p_minimum_score_percent, 0)
    )
    else false
  end;
$$;

create or replace function private.learner_group_is_eligible(
  p_learner_id uuid,
  p_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from content.learning_groups g
    join content.subjects s on s.id = g.subject_id
    join content.programmes p on p.id = s.programme_id
    where g.id = p_group_id
      and g.status = 'published' and g.published_at <= now()
      and s.status = 'published' and s.published_at <= now()
      and p.status = 'published' and p.published_at <= now()
      and g.visibility not in ('hidden', 'coming_soon')
      and s.visibility not in ('hidden', 'coming_soon')
      and p.visibility not in ('hidden', 'coming_soon')
      and not exists (
        select 1
        from content.programme_prerequisites pp
        where pp.programme_id = p.id
          and not (
            case pp.requirement
              when 'unlock' then exists (
                select 1
                from public.unlocks u
                join content.learning_groups prerequisite_group on prerequisite_group.id = u.group_id
                join content.subjects prerequisite_subject on prerequisite_subject.id = prerequisite_group.subject_id
                where u.learner_id = p_learner_id
                  and prerequisite_subject.programme_id = pp.prerequisite_programme_id
              )
              else exists (
                select 1
                from content.learning_groups prerequisite_group
                join content.subjects prerequisite_subject on prerequisite_subject.id = prerequisite_group.subject_id
                where prerequisite_subject.programme_id = pp.prerequisite_programme_id
                  and prerequisite_group.status = 'published'
                  and not prerequisite_group.is_optional_expert_challenge
              ) and not exists (
                select 1
                from content.learning_groups prerequisite_group
                join content.subjects prerequisite_subject on prerequisite_subject.id = prerequisite_group.subject_id
                where prerequisite_subject.programme_id = pp.prerequisite_programme_id
                  and prerequisite_group.status = 'published'
                  and not prerequisite_group.is_optional_expert_challenge
                  and not private.group_requirement_met(
                    p_learner_id,
                    prerequisite_group.id,
                    pp.requirement,
                    pp.minimum_score_percent
                  )
              )
            end
          )
      )
      and not exists (
        select 1
        from content.subject_prerequisites sp
        where sp.subject_id = s.id
          and not (
            case sp.requirement
              when 'unlock' then exists (
                select 1
                from public.unlocks u
                join content.learning_groups prerequisite_group on prerequisite_group.id = u.group_id
                where u.learner_id = p_learner_id
                  and prerequisite_group.subject_id = sp.prerequisite_subject_id
              )
              else exists (
                select 1
                from content.learning_groups prerequisite_group
                where prerequisite_group.subject_id = sp.prerequisite_subject_id
                  and prerequisite_group.status = 'published'
                  and not prerequisite_group.is_optional_expert_challenge
              ) and not exists (
                select 1
                from content.learning_groups prerequisite_group
                where prerequisite_group.subject_id = sp.prerequisite_subject_id
                  and prerequisite_group.status = 'published'
                  and not prerequisite_group.is_optional_expert_challenge
                  and not private.group_requirement_met(
                    p_learner_id,
                    prerequisite_group.id,
                    sp.requirement,
                    sp.minimum_score_percent
                  )
              )
            end
          )
      )
      and (
        g.is_initially_unlocked
        or exists (
          select 1 from public.unlocks u
          where u.learner_id = p_learner_id
            and u.group_id = g.id
            and u.reason = 'manual'
        )
        or (
          exists (
            select 1 from content.group_prerequisites gp
            where gp.group_id = g.id
          )
          and not exists (
            select 1
            from content.group_prerequisites gp
            where gp.group_id = g.id
              and not private.group_requirement_met(
                p_learner_id,
                gp.prerequisite_group_id,
                gp.requirement,
                gp.minimum_score_percent
              )
          )
        )
      )
  );
$$;

create or replace function private.mastery_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'group_id', a.group_id,
    'status', a.status,
    'started_at', a.started_at,
    'expires_at', a.expires_at,
    'question_count', a.question_count,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', aq.question_id,
          'position', aq.position,
          'version', aq.question_version,
          'question_type', aq.prompt_snapshot -> 'question_type',
          'difficulty', aq.prompt_snapshot -> 'difficulty',
          'prompt', aq.prompt_snapshot -> 'prompt',
          'options', aq.option_snapshot
        ) order by aq.position, aq.question_id
      )
      from public.mastery_attempt_questions aq
      where aq.attempt_id = a.id
    ), '[]'::jsonb)
  )
  from public.mastery_attempts a
  where a.id = p_attempt_id;
$$;

create or replace function private.start_mastery_attempt(
  p_learner_id uuid,
  p_group_id uuid,
  p_idempotency_key text,
  p_question_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
  v_group content.learning_groups%rowtype;
  v_inserted_count integer;
  v_ttl_minutes integer;
begin
  perform private.assert_learner_access(p_learner_id);

  if p_group_id is null then
    raise exception using errcode = '22023', message = 'group_id is required';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 128 then
    raise exception using errcode = '22023', message = 'idempotency key must contain 1 to 128 characters';
  end if;
  if p_question_limit is null or p_question_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'question_limit must be between 1 and 50';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_learner_id::text || ':start:' || btrim(p_idempotency_key), 0)
  );

  select a.id into v_attempt_id
  from public.mastery_attempts a
  where a.learner_id = p_learner_id
    and a.start_idempotency_key = btrim(p_idempotency_key);

  if v_attempt_id is not null then
    return private.mastery_attempt_payload(v_attempt_id);
  end if;

  select g.* into v_group
  from content.learning_groups g
  where g.id = p_group_id
    and g.status = 'published'
    and g.published_at <= now();

  if not found then
    raise exception using errcode = 'P0002', message = 'published learning group not found';
  end if;

  if not private.learner_group_is_eligible(p_learner_id, p_group_id) then
    raise exception using errcode = '42501', message = 'learning group is locked or its prerequisites are incomplete';
  end if;

  insert into public.unlocks (
    learner_id,
    group_id,
    reason,
    rule_snapshot
  ) values (
    p_learner_id,
    p_group_id,
    case when v_group.is_initially_unlocked then 'initial' else 'prerequisites_satisfied' end,
    jsonb_build_object('evaluated_at', clock_timestamp(), 'group_version', v_group.version)
  ) on conflict (learner_id, group_id) do nothing;

  v_ttl_minutes := case
    when coalesce(v_group.mastery_policy ->> 'attempt_ttl_minutes', '') ~ '^[0-9]+$'
      then greatest(5, least(1440, (v_group.mastery_policy ->> 'attempt_ttl_minutes')::integer))
    else 120
  end;

  v_attempt_id := gen_random_uuid();
  insert into public.mastery_attempts (
    id,
    learner_id,
    group_id,
    status,
    start_idempotency_key,
    pass_threshold_percent,
    expires_at
  ) values (
    v_attempt_id,
    p_learner_id,
    p_group_id,
    'in_progress',
    btrim(p_idempotency_key),
    v_group.mastery_threshold_percent,
    clock_timestamp() + pg_catalog.make_interval(mins => v_ttl_minutes)
  );

  insert into public.mastery_attempt_questions (
    attempt_id,
    question_id,
    position,
    question_version,
    prompt_snapshot,
    option_snapshot,
    scoring_snapshot,
    result_snapshot
  )
  select
    v_attempt_id,
    selected.id,
    selected.position,
    selected.version,
    jsonb_build_object(
      'question_type', selected.question_type,
      'difficulty', selected.difficulty,
      'prompt', selected.prompt
    ),
    selected.option_snapshot,
    jsonb_build_object('correct_option_ids', selected.correct_option_ids),
    jsonb_build_object(
      'explanation', selected.correct_answer_explanation,
      'options', selected.result_options
    )
  from (
    select
      q.id,
      row_number() over (order by md5(q.id::text || v_attempt_id::text), q.id)::integer - 1 as position,
      q.version,
      q.question_type,
      q.difficulty,
      q.prompt,
      q.correct_answer_explanation,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', o.id,
            'position', o.position,
            'label', o.label,
            'content', o.content
          ) order by o.position, o.id
        )
        from content.question_options o
        where o.question_id = q.id
          and o.enabled
      ) as option_snapshot,
      (
        select jsonb_agg(to_jsonb(o.id) order by o.position, o.id)
        from content.question_options o
        where o.question_id = q.id and o.enabled and o.is_correct
      ) as correct_option_ids,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', o.id,
            'is_correct', o.is_correct,
            'explanation', o.explanation
          ) order by o.position, o.id
        )
        from content.question_options o
        where o.question_id = q.id
          and o.enabled
      ) as result_options
    from content.questions q
    where q.status = 'published'
      and q.published_at <= now()
      and q.retirement_status = 'active'
      and q.question_type in ('single_choice', 'multiple_choice', 'true_false')
      and (q.group_id = p_group_id or q.group_id is null)
      and exists (
        select 1
        from content.question_contexts qc
        where qc.question_id = q.id
          and qc.context = 'mastery_assessment'
          and qc.enabled
          and coalesce(qc.group_id, q.group_id) = p_group_id
          and (qc.valid_from is null or qc.valid_from <= now())
          and (qc.valid_until is null or qc.valid_until > now())
      )
      and (select count(*) from content.question_options o where o.question_id = q.id and o.enabled) >= 2
      and exists (select 1 from content.question_options o where o.question_id = q.id and o.enabled and o.is_correct)
      and exists (select 1 from content.question_options o where o.question_id = q.id and o.enabled and not o.is_correct)
    order by md5(q.id::text || v_attempt_id::text), q.id
    limit p_question_limit
  ) selected;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'no eligible published mastery questions are configured for this group';
  end if;

  update public.mastery_attempts
  set question_count = v_inserted_count
  where id = v_attempt_id;

  insert into content.audit_log (
    actor_id,
    action,
    entity_kind,
    entity_id,
    new_data,
    metadata
  ) values (
    private.current_actor_id(),
    'mastery_attempt.started',
    'mastery_attempt',
    v_attempt_id,
    jsonb_build_object(
      'learner_id', p_learner_id,
      'group_id', p_group_id,
      'question_count', v_inserted_count
    ),
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key))
  );

  return private.mastery_attempt_payload(v_attempt_id);
end;
$$;

create or replace function private.submit_mastery_attempt(
  p_learner_id uuid,
  p_attempt_id uuid,
  p_idempotency_key text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.mastery_attempts%rowtype;
  v_attempt_question public.mastery_attempt_questions%rowtype;
  v_answer jsonb;
  v_question_id uuid;
  v_selected uuid[];
  v_correct uuid[];
  v_seen uuid[] := '{}'::uuid[];
  v_invalid_option boolean;
  v_is_correct boolean;
  v_answer_count integer := 0;
  v_correct_count integer := 0;
  v_score numeric(5,2);
  v_mastered boolean;
  v_fingerprint text;
  v_now timestamptz := clock_timestamp();
  v_new_unlocks uuid[] := '{}'::uuid[];
  v_result jsonb;
begin
  perform private.assert_learner_access(p_learner_id);

  if p_attempt_id is null then
    raise exception using errcode = '22023', message = 'attempt_id is required';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 128 then
    raise exception using errcode = '22023', message = 'idempotency key must contain 1 to 128 characters';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'answers must be a JSON array';
  end if;

  v_fingerprint := md5(p_answers::text);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_learner_id::text || ':submit:' || btrim(p_idempotency_key), 0)
  );

  select a.* into v_attempt
  from public.mastery_attempts a
  where a.id = p_attempt_id
    and a.learner_id = p_learner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'mastery attempt not found';
  end if;

  if v_attempt.status = 'submitted' then
    if v_attempt.submit_idempotency_key = btrim(p_idempotency_key)
      and v_attempt.submission_fingerprint = v_fingerprint then
      return v_attempt.result_payload;
    end if;
    raise exception using errcode = '23505', message = 'mastery attempt has already been submitted with a different request';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception using errcode = '55000', message = 'mastery attempt is not open for submission';
  end if;
  if v_attempt.expires_at <= v_now then
    raise exception using errcode = '55000', message = 'mastery attempt has expired';
  end if;
  if jsonb_array_length(p_answers) <> v_attempt.question_count then
    raise exception using errcode = '22023', message = 'one answer is required for every attempt question';
  end if;

  for v_answer in
    select item.value
    from jsonb_array_elements(p_answers) as item(value)
  loop
    if jsonb_typeof(v_answer) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'each answer must be a JSON object';
    end if;
    if jsonb_typeof(v_answer -> 'selected_option_ids') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'selected_option_ids must be a JSON array';
    end if;

    begin
      v_question_id := (v_answer ->> 'question_id')::uuid;
      select coalesce(array_agg(option_id order by option_id), '{}'::uuid[])
      into v_selected
      from (
        select option_text::uuid as option_id
        from jsonb_array_elements_text(v_answer -> 'selected_option_ids') as selected(option_text)
      ) parsed_options;
    exception
      when invalid_text_representation then
        raise exception using errcode = '22023', message = 'question_id and selected_option_ids must contain UUID values';
    end;

    if v_question_id is null then
      raise exception using errcode = '22023', message = 'question_id is required for every answer';
    end if;
    if v_question_id = any(v_seen) then
      raise exception using errcode = '22023', message = 'duplicate question_id in answers';
    end if;
    if jsonb_array_length(v_answer -> 'selected_option_ids') <> cardinality(v_selected) then
      raise exception using errcode = '22023', message = 'duplicate selected_option_ids are not allowed';
    end if;
    v_seen := array_append(v_seen, v_question_id);

    select aq.* into v_attempt_question
    from public.mastery_attempt_questions aq
    where aq.attempt_id = p_attempt_id
      and aq.question_id = v_question_id;

    if not found then
      raise exception using errcode = '22023', message = 'answer contains a question that is not part of the attempt';
    end if;

    select exists (
      select 1
      from unnest(v_selected) selected_id
      where not exists (
        select 1
        from jsonb_array_elements(v_attempt_question.option_snapshot) option_item
        where (option_item ->> 'option_id')::uuid = selected_id
      )
    ) into v_invalid_option;

    if v_invalid_option then
      raise exception using errcode = '22023', message = 'answer contains an option that is not part of the attempt question';
    end if;

    select coalesce(array_agg(correct_id order by correct_id), '{}'::uuid[])
    into v_correct
    from (
      select correct_text::uuid as correct_id
      from jsonb_array_elements_text(
        v_attempt_question.scoring_snapshot -> 'correct_option_ids'
      ) as expected(correct_text)
    ) parsed_correct;

    v_is_correct := v_selected = v_correct;
    insert into public.mastery_answers (
      attempt_id,
      learner_id,
      question_id,
      selected_option_ids,
      is_correct,
      awarded_points,
      answered_at
    ) values (
      p_attempt_id,
      p_learner_id,
      v_question_id,
      v_selected,
      v_is_correct,
      case when v_is_correct then 1 else 0 end,
      v_now
    );

    v_answer_count := v_answer_count + 1;
    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  if v_answer_count <> v_attempt.question_count then
    raise exception using errcode = '22023', message = 'answer set does not match the attempt question set';
  end if;

  v_score := round((v_correct_count::numeric * 100) / v_attempt.question_count, 2);
  v_mastered := v_score >= v_attempt.pass_threshold_percent;

  insert into public.group_progress as current_progress (
    learner_id,
    group_id,
    completed_lessons,
    total_lessons,
    best_score_percent,
    mastered,
    mastered_attempt_id,
    completed_at,
    updated_at
  ) values (
    p_learner_id,
    v_attempt.group_id,
    (
      select count(*)::integer
      from public.lesson_progress lp
      join content.lessons l on l.id = lp.lesson_id
      where lp.learner_id = p_learner_id
        and l.group_id = v_attempt.group_id
        and lp.state = 'completed'
    ),
    (
      select count(*)::integer
      from content.lessons l
      where l.group_id = v_attempt.group_id
        and l.status = 'published'
        and l.published_at <= v_now
    ),
    v_score,
    v_mastered,
    case when v_mastered then p_attempt_id else null end,
    case when v_mastered then v_now else null end,
    v_now
  )
  on conflict (learner_id, group_id) do update
  set
    completed_lessons = excluded.completed_lessons,
    total_lessons = excluded.total_lessons,
    best_score_percent = greatest(current_progress.best_score_percent, excluded.best_score_percent),
    mastered = current_progress.mastered or excluded.mastered,
    mastered_attempt_id = case
      when current_progress.mastered then current_progress.mastered_attempt_id
      when excluded.mastered then excluded.mastered_attempt_id
      else null
    end,
    completed_at = coalesce(current_progress.completed_at, excluded.completed_at),
    updated_at = v_now;

  insert into public.question_metrics as current_metrics (
    question_id,
    attempt_count,
    correct_count,
    incorrect_count,
    average_score,
    last_attempted_at,
    updated_at
  )
  select
    ma.question_id,
    1,
    case when ma.is_correct then 1 else 0 end,
    case when ma.is_correct then 0 else 1 end,
    case when ma.is_correct then 100 else 0 end,
    v_now,
    v_now
  from public.mastery_answers ma
  where ma.attempt_id = p_attempt_id
  on conflict (question_id) do update
  set
    attempt_count = current_metrics.attempt_count + 1,
    correct_count = current_metrics.correct_count + excluded.correct_count,
    incorrect_count = current_metrics.incorrect_count + excluded.incorrect_count,
    average_score = round(
      ((current_metrics.correct_count + excluded.correct_count)::numeric * 100)
      / (current_metrics.attempt_count + 1),
      2
    ),
    last_attempted_at = v_now,
    updated_at = v_now;

  insert into public.review_schedule as current_schedule (
    learner_id,
    question_id,
    due_at,
    interval_days,
    ease_factor,
    repetition_count,
    last_result,
    last_reviewed_at,
    updated_at
  )
  select
    p_learner_id,
    ma.question_id,
    v_now + pg_catalog.make_interval(days => case when ma.is_correct then 2 else 1 end),
    case when ma.is_correct then 2 else 1 end,
    case when ma.is_correct then 2.60 else 2.30 end,
    case when ma.is_correct then 1 else 0 end,
    ma.is_correct,
    v_now,
    v_now
  from public.mastery_answers ma
  where ma.attempt_id = p_attempt_id
  on conflict (learner_id, question_id) do update
  set
    interval_days = case
      when excluded.last_result then greatest(1, current_schedule.interval_days * 2)
      else 1
    end,
    due_at = v_now + pg_catalog.make_interval(days => case
      when excluded.last_result then greatest(1, current_schedule.interval_days * 2)
      else 1
    end),
    ease_factor = case
      when excluded.last_result then least(5.00, current_schedule.ease_factor + 0.10)
      else greatest(1.30, current_schedule.ease_factor - 0.20)
    end,
    repetition_count = case
      when excluded.last_result then current_schedule.repetition_count + 1
      else 0
    end,
    last_result = excluded.last_result,
    last_reviewed_at = v_now,
    updated_at = v_now;

  if v_mastered then
    with eligible_groups as (
      select g.id, g.version
      from content.learning_groups g
      where private.learner_group_is_eligible(p_learner_id, g.id)
        and not exists (
          select 1 from public.unlocks u
          where u.learner_id = p_learner_id
            and u.group_id = g.id
        )
    ), inserted_unlocks as (
      insert into public.unlocks (
        learner_id,
        group_id,
        unlocked_by_attempt_id,
        reason,
        rule_snapshot,
        unlocked_at
      )
      select
        p_learner_id,
        eligible.id,
        p_attempt_id,
        'mastery_prerequisites',
        jsonb_build_object(
          'evaluated_at', v_now,
          'trigger_attempt_id', p_attempt_id,
          'group_version', eligible.version
        ),
        v_now
      from eligible_groups eligible
      on conflict (learner_id, group_id) do nothing
      returning group_id
    )
    select coalesce(array_agg(group_id order by group_id), '{}'::uuid[])
    into v_new_unlocks
    from inserted_unlocks;
  end if;

  v_result := jsonb_build_object(
    'attempt_id', p_attempt_id,
    'group_id', v_attempt.group_id,
    'status', 'submitted',
    'submitted_at', v_now,
    'score_percent', v_score,
    'correct_count', v_correct_count,
    'question_count', v_attempt.question_count,
    'pass_threshold_percent', v_attempt.pass_threshold_percent,
    'mastered', v_mastered,
    'answers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', ma.question_id,
          'selected_option_ids', to_jsonb(ma.selected_option_ids),
          'is_correct', ma.is_correct,
          'correct_option_ids', aq.scoring_snapshot -> 'correct_option_ids',
          'explanation', aq.result_snapshot -> 'explanation',
          'options', aq.result_snapshot -> 'options'
        ) order by aq.position, ma.question_id
      )
      from public.mastery_answers ma
      join public.mastery_attempt_questions aq
        on aq.attempt_id = ma.attempt_id
       and aq.question_id = ma.question_id
      where ma.attempt_id = p_attempt_id
    ), '[]'::jsonb),
    'newly_unlocked_group_ids', to_jsonb(v_new_unlocks)
  );

  update public.mastery_attempts
  set
    status = 'submitted',
    submit_idempotency_key = btrim(p_idempotency_key),
    submission_fingerprint = v_fingerprint,
    score_percent = v_score,
    correct_count = v_correct_count,
    mastered = v_mastered,
    submitted_at = v_now,
    result_payload = v_result
  where id = p_attempt_id;

  insert into content.audit_log (
    actor_id,
    action,
    entity_kind,
    entity_id,
    new_data,
    metadata
  ) values (
    private.current_actor_id(),
    'mastery_attempt.submitted',
    'mastery_attempt',
    p_attempt_id,
    jsonb_build_object(
      'learner_id', p_learner_id,
      'group_id', v_attempt.group_id,
      'score_percent', v_score,
      'mastered', v_mastered,
      'newly_unlocked_group_ids', to_jsonb(v_new_unlocks)
    ),
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key))
  );

  return v_result;
end;
$$;

create or replace function public.start_mastery_attempt(
  p_learner_id uuid,
  p_group_id uuid,
  p_idempotency_key text,
  p_question_limit integer default 10
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.start_mastery_attempt(
    p_learner_id,
    p_group_id,
    p_idempotency_key,
    p_question_limit
  );
$$;

create or replace function public.submit_mastery_attempt(
  p_learner_id uuid,
  p_attempt_id uuid,
  p_idempotency_key text,
  p_answers jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_mastery_attempt(
    p_learner_id,
    p_attempt_id,
    p_idempotency_key,
    p_answers
  );
$$;

revoke execute on function private.group_requirement_met(uuid, uuid, content.prerequisite_requirement, numeric) from public;
revoke execute on function private.learner_group_is_eligible(uuid, uuid) from public;
revoke execute on function private.mastery_attempt_payload(uuid) from public;
revoke execute on function private.start_mastery_attempt(uuid, uuid, text, integer) from public;
revoke execute on function private.submit_mastery_attempt(uuid, uuid, text, jsonb) from public;
revoke execute on function public.start_mastery_attempt(uuid, uuid, text, integer) from public;
revoke execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) from public;

grant execute on function private.start_mastery_attempt(uuid, uuid, text, integer)
  to authenticated, service_role;
grant execute on function private.submit_mastery_attempt(uuid, uuid, text, jsonb)
  to authenticated, service_role;
grant execute on function public.start_mastery_attempt(uuid, uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb)
  to authenticated, service_role;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.content_entity_is_visible(content.entity_kind, uuid, boolean)
  to anon, authenticated;
grant execute on function private.owns_learner(uuid) to authenticated;
grant execute on function private.start_mastery_attempt(uuid, uuid, text, integer)
  to authenticated;
grant execute on function private.submit_mastery_attempt(uuid, uuid, text, jsonb)
  to authenticated;

grant execute on all functions in schema content to service_role;
grant execute on all functions in schema private to service_role;
grant execute on function public.start_mastery_attempt(uuid, uuid, text, integer) to service_role;
grant execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) to service_role;

commit;
