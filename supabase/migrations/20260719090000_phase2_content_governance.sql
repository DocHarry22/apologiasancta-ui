-- Apologia Sancta Phase 2 doctrinal, educational, assessment and source governance.
-- This migration is data-light: it installs policy defaults and conservative official-domain
-- quality records, but it does not approve any curriculum, quotation, translation or licence.

begin;

create type content.doctrinal_classification as enum (
  'dogma',
  'definitively_held',
  'authoritative_doctrine',
  'discipline',
  'prudential_application',
  'permitted_opinion',
  'historical_claim',
  'comparative_religion_claim',
  'disputed_or_unresolved'
);

create type content.attribution_mode as enum (
  'direct_quotation',
  'paraphrase',
  'interpretation',
  'inference'
);

create type content.difficulty_mode as enum (
  'easy',
  'medium',
  'hard',
  'expert',
  'trick'
);

create type content.trick_category as enum (
  'nature_vs_person',
  'infallibility_vs_impeccability',
  'veneration_vs_worship',
  'sign_vs_merely_symbolic',
  'dogma_vs_discipline',
  'development_vs_contradiction',
  'necessary_vs_sufficient',
  'premise_vs_conclusion',
  'initial_justification_vs_growth_in_grace',
  'material_vs_formal_rejection',
  'correct_doctrine_wrong_subject'
);

create type content.workflow_stage as enum (
  'draft',
  'author_review',
  'doctrinal_review',
  'assessment_review',
  'source_licence_review',
  'approval',
  'publication',
  'analytics_review'
);

create type content.review_specialism as enum (
  'doctrinal',
  'assessment',
  'source_licence',
  'analytics',
  'comparative_eastern_orthodox',
  'comparative_lutheran',
  'comparative_reformed',
  'comparative_anglican',
  'comparative_baptist',
  'comparative_methodist',
  'comparative_pentecostal',
  'comparative_evangelical',
  'comparative_sunni',
  'comparative_shia',
  'comparative_ahmadi',
  'comparative_jehovahs_witness',
  'comparative_latter_day_saint',
  'comparative_atheist_argument'
);

create type content.review_decision as enum (
  'approved',
  'changes_requested'
);

create type content.lesson_requirement_kind as enum (
  'central_question',
  'learning_objectives',
  'concise_answer',
  'full_explanation',
  'scripture',
  'catholic_doctrinal_evidence',
  'historical_or_patristic_evidence',
  'important_distinctions',
  'serious_objection',
  'catholic_response',
  'common_misunderstandings',
  'summary',
  'practice_questions',
  'references',
  'related_apologia_graph'
);

create type content.source_authority_category as enum (
  'sacred_scripture',
  'sacred_tradition',
  'ecumenical_council',
  'papal_magisterium',
  'dicastery_magisterium',
  'catechism',
  'canon_law',
  'church_father',
  'church_doctor',
  'official_comparative_source',
  'primary_historical_source',
  'academic_secondary_source',
  'credible_reference',
  'unverified'
);

create type content.permission_status as enum (
  'unverified',
  'public_domain',
  'licensed',
  'permission_not_required_under_recorded_terms',
  'permission_requested',
  'denied',
  'expired'
);

alter type content.entity_kind add value if not exists 'doctrinal_claim';

create table content.governance_policies (
  policy_key text primary key check (policy_key ~ '^[a-z0-9_]+$'),
  schema_version integer not null check (schema_version > 0),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  active boolean not null default true,
  effective_at timestamptz not null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into content.governance_policies (
  policy_key,
  schema_version,
  rules,
  effective_at
) values (
  'phase2_content_governance',
  1,
  '{
    "normative": true,
    "teaching_position": "catholic",
    "official_mastery_threshold_percent": 100,
    "server_side_scoring": true,
    "unlimited_retakes": true,
    "prefer_unseen_equivalent_questions": true,
    "hints_during_official_attempt": false,
    "explanations_after_completion": true,
    "paid_bypass": false,
    "speed_affects_mastery": false,
    "live_competition_unlock": false,
    "offline_official_unlock": false,
    "relock_on_content_edit": false,
    "retention_review_relocks": false,
    "default_quote_limit_words": 0,
    "approved_domain_implies_reuse_permission": false,
    "workflow": [
      "draft",
      "author_review",
      "doctrinal_review",
      "assessment_review",
      "source_licence_review",
      "approval",
      "publication",
      "analytics_review"
    ]
  }'::jsonb,
  '2026-07-19T00:00:00Z'::timestamptz
);

create table content.approved_source_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (
    domain = lower(domain)
    and domain ~ '^[a-z0-9.-]+$'
    and domain !~ '^\.' and domain !~ '\.$'
  ),
  authority_scope text not null check (btrim(authority_scope) <> ''),
  approved_for_source_quality boolean not null default false,
  reuse_permission_implied boolean not null default false,
  prohibited_use_flags text[] not null default '{}'::text[],
  review_note text not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_due_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not reuse_permission_implied or reviewed_by is not null)
);

insert into content.approved_source_domains (
  domain,
  authority_scope,
  approved_for_source_quality,
  reuse_permission_implied,
  review_note
) values
  ('vatican.va', 'official_holy_see', true, false, 'Official-domain quality approval only; no reuse permission is implied.'),
  ('press.vatican.va', 'official_holy_see_press', true, false, 'Official-domain quality approval only; no reuse permission is implied.'),
  ('usccb.org', 'official_episcopal_conference', true, false, 'Official-domain quality approval only; no reuse permission is implied.'),
  ('bible.usccb.org', 'official_episcopal_conference_scripture_portal', true, false, 'Official-domain quality approval only; translation permission remains separately required.');

create table content.reviewer_qualifications (
  reviewer_id uuid not null,
  specialism content.review_specialism not null,
  evidence_note text not null check (btrim(evidence_note) <> ''),
  granted_by uuid not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  active boolean not null default true,
  primary key (reviewer_id, specialism),
  check (expires_at is null or expires_at > granted_at),
  check (not active or revoked_at is null)
);

alter table content.lessons
  add column governance_stage content.workflow_stage not null default 'draft';

alter table content.lesson_sections
  add column governance_stage content.workflow_stage not null default 'draft',
  add column attribution_mode content.attribution_mode;

alter table content.questions
  add column governance_stage content.workflow_stage not null default 'draft',
  add column difficulty_mode content.difficulty_mode,
  add column trick_category content.trick_category,
  add column equivalence_key text,
  add column quality_flags jsonb not null default '{}'::jsonb
    check (jsonb_typeof(quality_flags) = 'object'),
  add constraint questions_phase2_type check (question_type = 'single_choice') not valid,
  add constraint questions_phase2_trick check (
    (difficulty_mode = 'trick' and trick_category is not null)
    or (difficulty_mode is distinct from 'trick' and trick_category is null)
  ),
  add constraint questions_phase2_equivalence_key check (
    equivalence_key is null or equivalence_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'
  );

alter table content.sources
  add column governance_stage content.workflow_stage not null default 'draft',
  add column authority_category content.source_authority_category not null default 'unverified',
  add column copyright_status text,
  add column permission_status content.permission_status not null default 'unverified',
  add column licence_identifier text,
  add column attribution_text text,
  add column quote_limit_words integer not null default 0 check (quote_limit_words >= 0),
  add column translation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translation_metadata) = 'object'),
  add column prohibited_use_flags text[] not null default '{}'::text[],
  add column permission_expires_at timestamptz,
  add column rights_review_due_at timestamptz,
  add column rights_reviewed_by uuid,
  add column rights_reviewed_at timestamptz,
  add column approved_domain_id uuid references content.approved_source_domains(id) on delete restrict;

create table content.lesson_requirements (
  id uuid not null default gen_random_uuid() unique,
  lesson_id uuid not null references content.lessons(id) on delete restrict,
  requirement content.lesson_requirement_kind not null,
  satisfied boolean not null default false,
  non_applicable boolean not null default false,
  non_applicable_reason text,
  attribution_mode content.attribution_mode,
  source_locator text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (lesson_id, requirement),
  check (not (satisfied and non_applicable)),
  check (
    not non_applicable
    or (
      non_applicable_reason is not null
      and btrim(non_applicable_reason) <> ''
      and reviewed_by is not null
      and reviewed_at is not null
    )
  ),
  check (
    source_locator is null
    or attribution_mode is not null
  )
);

insert into content.lesson_requirements (lesson_id, requirement)
select lesson_row.id, requirement_row.requirement
from content.lessons lesson_row
cross join unnest(enum_range(null::content.lesson_requirement_kind)) as requirement_row(requirement)
on conflict (lesson_id, requirement) do nothing;

create or replace function private.seed_lesson_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into content.lesson_requirements (lesson_id, requirement)
  select new.id, requirement_row.requirement
  from unnest(enum_range(null::content.lesson_requirement_kind)) as requirement_row(requirement)
  on conflict (lesson_id, requirement) do nothing;
  return new;
end;
$$;

create trigger lessons_seed_phase2_requirements
after insert on content.lessons
for each row execute function private.seed_lesson_requirements();

create table content.doctrinal_claims (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (entity_kind in ('lesson', 'lesson_section', 'question', 'graph_relationship')),
  entity_id uuid not null,
  proposition text not null check (btrim(proposition) <> ''),
  classification content.doctrinal_classification not null,
  attribution_mode content.attribution_mode not null,
  source_locators jsonb not null default '[]'::jsonb check (jsonb_typeof(source_locators) = 'array'),
  human_review_required boolean not null default false,
  qualified_reviewer_id uuid,
  review_note text,
  status content.publication_status not null default 'draft',
  review_status content.review_status not null default 'unreviewed',
  governance_stage content.workflow_stage not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  scheduled_for timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  constraint doctrinal_claim_review_check check (
    classification <> 'disputed_or_unresolved'
    or human_review_required
  ),
  constraint doctrinal_claim_high_risk_check check (
    classification not in ('dogma', 'definitively_held')
    or qualified_reviewer_id is not null
  )
);

create table content.governance_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (
    entity_kind in ('lesson', 'lesson_section', 'question', 'source', 'doctrinal_claim', 'graph_relationship')
  ),
  entity_id uuid not null,
  entity_version integer not null check (entity_version > 0),
  stage content.workflow_stage not null check (stage <> 'draft' and stage <> 'publication'),
  decision content.review_decision not null,
  reviewer_id uuid not null,
  reviewer_role text not null check (
    reviewer_role in ('super_admin', 'admin', 'editor', 'author', 'contributor', 'reviewer')
  ),
  specialism content.review_specialism,
  comment text,
  created_at timestamptz not null default now(),
  unique (entity_kind, entity_id, entity_version, stage, reviewer_id)
);

create index governance_reviews_current_idx
  on content.governance_reviews (entity_kind, entity_id, entity_version, stage, decision);

create table content.validation_runs (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null,
  entity_id uuid not null,
  entity_version integer not null check (entity_version > 0),
  policy_key text not null references content.governance_policies(policy_key) on delete restrict,
  policy_schema_version integer not null check (policy_schema_version > 0),
  findings jsonb not null check (jsonb_typeof(findings) = 'array'),
  error_count integer not null check (error_count >= 0),
  warning_count integer not null check (warning_count >= 0),
  run_by uuid,
  run_at timestamptz not null default now()
);

create index validation_runs_entity_idx
  on content.validation_runs (entity_kind, entity_id, entity_version, run_at desc);

create table content.mastery_policy_overrides (
  group_id uuid primary key references content.learning_groups(id) on delete restrict,
  threshold_percent numeric(5,2) not null check (threshold_percent between 0 and 100),
  reason text not null check (btrim(reason) <> ''),
  approved_by uuid not null,
  approved_at timestamptz not null,
  review_due_at timestamptz,
  active boolean not null default true
);

alter table content.learning_groups
  alter column mastery_threshold_percent set default 100,
  alter column mastery_policy set default '{
    "attempt_ttl_minutes": 120,
    "default_question_limit": 10,
    "server_side_scoring": true,
    "unlimited_retakes": true,
    "prefer_unseen_equivalent_questions": true,
    "hints_during_official_attempt": false,
    "explanations_after_completion": true,
    "paid_bypass": false,
    "speed_affects_score": false,
    "live_competition_unlock": false,
    "offline_official_unlock": false,
    "relock_on_content_edit": false,
    "retention_review_relocks": false
  }'::jsonb;

update content.learning_groups
set mastery_policy = '{
  "attempt_ttl_minutes": 120,
  "default_question_limit": 10,
  "server_side_scoring": true,
  "unlimited_retakes": true,
  "prefer_unseen_equivalent_questions": true,
  "hints_during_official_attempt": false,
  "explanations_after_completion": true,
  "paid_bypass": false,
  "speed_affects_score": false,
  "live_competition_unlock": false,
  "offline_official_unlock": false,
  "relock_on_content_edit": false,
  "retention_review_relocks": false
}'::jsonb || mastery_policy;

create table public.question_exposures (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  question_id uuid not null references content.questions(id) on delete restrict,
  equivalence_key text not null,
  exposure_count integer not null default 1 check (exposure_count > 0),
  first_exposed_at timestamptz not null default now(),
  last_exposed_at timestamptz not null default now(),
  last_attempt_id uuid references public.mastery_attempts(id) on delete restrict,
  primary key (learner_id, question_id)
);

create index question_exposures_equivalence_idx
  on public.question_exposures (learner_id, equivalence_key, last_exposed_at);

create table public.corrective_recommendations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  attempt_id uuid not null references public.mastery_attempts(id) on delete restrict,
  question_id uuid not null references content.questions(id) on delete restrict,
  objective_id uuid references content.learning_objectives(id) on delete restrict,
  lesson_id uuid references content.lessons(id) on delete restrict,
  misconception_codes text[] not null default '{}'::text[],
  recommendation jsonb not null default '{}'::jsonb check (jsonb_typeof(recommendation) = 'object'),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.retention_reviews (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  group_id uuid references content.learning_groups(id) on delete restrict,
  score_percent numeric(5,2) not null check (score_percent between 0 and 100),
  recognition jsonb not null default '{}'::jsonb check (jsonb_typeof(recognition) = 'object'),
  completed_at timestamptz not null default now(),
  check (not (recognition ? 'relock_group_id'))
);

create or replace function private.current_entity_version(
  p_entity_kind text,
  p_entity_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  case p_entity_kind
    when 'lesson' then select version into v_version from content.lessons where id = p_entity_id;
    when 'lesson_section' then select version into v_version from content.lesson_sections where id = p_entity_id;
    when 'question' then select version into v_version from content.questions where id = p_entity_id;
    when 'source' then select version into v_version from content.sources where id = p_entity_id;
    when 'doctrinal_claim' then select version into v_version from content.doctrinal_claims where id = p_entity_id;
    else raise exception using errcode = '22023', message = 'unsupported governed entity kind';
  end case;
  if v_version is null then
    raise exception using errcode = 'P0002', message = 'governed entity not found';
  end if;
  return v_version;
end;
$$;

create or replace function private.current_entity_creator(
  p_entity_kind text,
  p_entity_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_creator uuid;
begin
  case p_entity_kind
    when 'lesson' then select created_by into v_creator from content.lessons where id = p_entity_id;
    when 'lesson_section' then select created_by into v_creator from content.lesson_sections where id = p_entity_id;
    when 'question' then select created_by into v_creator from content.questions where id = p_entity_id;
    when 'source' then select created_by into v_creator from content.sources where id = p_entity_id;
    when 'doctrinal_claim' then select created_by into v_creator from content.doctrinal_claims where id = p_entity_id;
    else raise exception using errcode = '22023', message = 'unsupported governed entity kind';
  end case;
  return v_creator;
end;
$$;

create or replace function private.validate_governance_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required_specialism content.review_specialism;
  v_creator uuid;
begin
  if new.entity_version <> private.current_entity_version(new.entity_kind, new.entity_id) then
    raise exception using errcode = '23514', message = 'review must target the current entity version';
  end if;

  v_required_specialism := case new.stage
    when 'doctrinal_review' then 'doctrinal'::content.review_specialism
    when 'assessment_review' then 'assessment'::content.review_specialism
    when 'source_licence_review' then 'source_licence'::content.review_specialism
    when 'analytics_review' then 'analytics'::content.review_specialism
    else null
  end;

  if v_required_specialism is not null and new.specialism is distinct from v_required_specialism then
    raise exception using errcode = '23514', message = 'review record must name the required specialism';
  end if;

  if v_required_specialism is not null and not exists (
    select 1
    from content.reviewer_qualifications qualification
    where qualification.reviewer_id = new.reviewer_id
      and qualification.specialism = v_required_specialism
      and qualification.active
      and qualification.revoked_at is null
      and (qualification.expires_at is null or qualification.expires_at > now())
  ) then
    raise exception using errcode = '42501', message = 'reviewer lacks the required active specialism';
  end if;

  if new.stage = 'approval' and new.decision = 'approved' then
    v_creator := private.current_entity_creator(new.entity_kind, new.entity_id);
    if v_creator is not null and v_creator = new.reviewer_id then
      raise exception using errcode = '42501', message = 'creator cannot be the sole final approver of high-risk content';
    end if;
    if new.reviewer_role not in ('editor', 'admin', 'super_admin') then
      raise exception using errcode = '42501', message = 'final approval requires editor or administrator authority';
    end if;
  end if;
  return new;
end;
$$;

create trigger governance_reviews_validate
before insert or update on content.governance_reviews
for each row execute function private.validate_governance_review();

create or replace function content.governance_findings(
  p_entity_kind text,
  p_entity_id uuid,
  p_entity_version integer,
  p_for_publication boolean default false
)
returns table (
  code text,
  severity text,
  review_stage content.workflow_stage,
  message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_question content.questions%rowtype;
  v_lesson content.lessons%rowtype;
  v_section content.lesson_sections%rowtype;
  v_source content.sources%rowtype;
  v_claim content.doctrinal_claims%rowtype;
  v_required_stage content.workflow_stage;
begin
  if p_entity_version <> private.current_entity_version(p_entity_kind, p_entity_id) then
    return query select 'entity.version_stale', 'error', 'author_review'::content.workflow_stage, 'Validation must target the current entity version.';
    return;
  end if;

  if p_entity_kind = 'question' then
    select * into v_question from content.questions where id = p_entity_id;

    if v_question.question_type <> 'single_choice' then
      return query select 'question.type_multiple_choice_only', 'error', 'assessment_review'::content.workflow_stage, 'Only single-choice multiple-choice questions may be published.';
    end if;
    if v_question.objective_id is null then
      return query select 'question.objective_required', 'error', 'assessment_review'::content.workflow_stage, 'A learning objective is required.';
    end if;
    if v_question.difficulty_mode is null then
      return query select 'question.difficulty_mode_required', 'error', 'assessment_review'::content.workflow_stage, 'Difficulty mode is required.';
    end if;
    if v_question.equivalence_key is null or btrim(v_question.equivalence_key) = '' then
      return query select 'question.equivalence_key_required', 'error', 'assessment_review'::content.workflow_stage, 'An equivalence key is required for retakes.';
    end if;
    if v_question.correct_answer_explanation = '{}'::jsonb then
      return query select 'question.correct_explanation_required', 'error', 'assessment_review'::content.workflow_stage, 'A correct-answer explanation is required.';
    end if;
    if coalesce(v_question.rights_metadata ->> 'permissionStatus', v_question.rights_metadata ->> 'permission_status', '') not in (
      'public_domain', 'licensed', 'permission_not_required_under_recorded_terms'
    ) then
      return query select 'question.permission_unverified', 'error', 'source_licence_review'::content.workflow_stage, 'Question rights and translation permission are not publishable.';
    end if;
    if jsonb_path_exists(v_question.quality_flags, '$.* ? (@ == true)') then
      return query select 'question.prohibited_quality_flag', 'error', 'assessment_review'::content.workflow_stage, 'A prohibited question-quality condition remains unresolved.';
    end if;
    if lower(v_question.prompt::text) ~ '\m(protestants|muslims)\s+believe\M' then
      return query select 'comparative.generic_claim', 'error', 'doctrinal_review'::content.workflow_stage, 'Name the relevant tradition rather than using a generic family claim.';
    end if;
    if lower(coalesce(v_question.denomination_scope ->> 'comparative', 'false')) = 'true' then
      if coalesce(v_question.denomination_scope ->> 'tradition', '') = ''
        or lower(v_question.denomination_scope ->> 'tradition') in ('protestants', 'protestant', 'muslims', 'muslim') then
        return query select 'comparative.named_tradition_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Comparative content requires a named tradition.';
      end if;
      if coalesce(v_question.denomination_scope ->> 'sourceLocator', v_question.denomination_scope ->> 'source_locator', '') = '' then
        return query select 'comparative.recognised_source_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Comparative content requires a recognised source locator.';
      end if;
      if (v_question.difficulty >= 4 or v_question.difficulty_mode in ('expert', 'trick'))
        and coalesce(v_question.denomination_scope ->> 'steelman', '') = '' then
        return query select 'comparative.steelman_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Advanced comparative content requires a steelman.';
      end if;
    end if;

    if (select count(*) from content.question_options option_row where option_row.question_id = p_entity_id and option_row.enabled) <> 4 then
      return query select 'question.option_count', 'error', 'assessment_review'::content.workflow_stage, 'Exactly four enabled answer options are required.';
    end if;
    if (select count(*) from content.question_options option_row where option_row.question_id = p_entity_id and option_row.enabled and option_row.is_correct) <> 1 then
      return query select 'question.one_best_answer', 'error', 'assessment_review'::content.workflow_stage, 'Exactly one enabled option must be correct.';
    end if;
    if exists (
      select 1 from content.question_options option_row
      where option_row.question_id = p_entity_id
        and option_row.enabled
        and option_row.explanation = '{}'::jsonb
    ) then
      return query select 'question.option_explanation_required', 'error', 'assessment_review'::content.workflow_stage, 'Every option requires an explanation.';
    end if;
    if exists (
      select 1 from content.question_options option_row
      where option_row.question_id = p_entity_id
        and option_row.enabled
        and not option_row.is_correct
        and coalesce(btrim(option_row.misconception_id), '') = ''
    ) then
      return query select 'question.distractor_misconception_required', 'error', 'assessment_review'::content.workflow_stage, 'Every distractor requires a misconception code.';
    end if;
    if exists (
      select 1 from content.question_options option_row
      where option_row.question_id = p_entity_id
        and option_row.enabled
        and lower(btrim(coalesce(option_row.content ->> 'text', trim(both '"' from option_row.content::text)))) ~ '^(all|none) of the above\.?
    ) then
      return query select 'question.forbidden_option', 'error', 'assessment_review'::content.workflow_stage, 'All/None of the above is prohibited.';
    end if;
    if not exists (
      select 1
      from content.content_sources source_link
      join content.sources source_row on source_row.id = source_link.source_id
      where source_link.entity_kind = 'question'
        and source_link.entity_id = p_entity_id
        and coalesce(btrim(source_link.citation_locator), '') <> ''
        and source_row.status = 'published'
        and source_row.governance_stage in ('publication', 'analytics_review')
        and source_row.authority_category <> 'unverified'
        and source_row.permission_status in (
          'public_domain', 'licensed', 'permission_not_required_under_recorded_terms'
        )
        and cardinality(source_row.prohibited_use_flags) = 0
        and (source_row.permission_expires_at is null or source_row.permission_expires_at > now())
        and (source_row.rights_review_due_at is null or source_row.rights_review_due_at > now())
        and (
          coalesce(btrim(source_link.quoted_text), '') = ''
          or (
            source_row.quote_limit_words > 0
            and cardinality(regexp_split_to_array(btrim(source_link.quoted_text), '\s+')) <= source_row.quote_limit_words
          )
        )
    ) then
      return query select 'question.authoritative_source_required', 'error', 'source_licence_review'::content.workflow_stage, 'An authoritative, precisely located and rights-cleared source is required.';
    end if;

  elsif p_entity_kind = 'lesson' then
    select * into v_lesson from content.lessons where id = p_entity_id;
    if (
      select count(*)
      from content.lesson_requirements requirement
      where requirement.lesson_id = p_entity_id
        and (
          requirement.satisfied
          or (
            requirement.non_applicable
            and coalesce(btrim(requirement.non_applicable_reason), '') <> ''
            and requirement.reviewed_by is not null
            and requirement.reviewed_at is not null
          )
        )
    ) <> 15 then
      return query select 'lesson.components_incomplete', 'error', 'author_review'::content.workflow_stage, 'All fifteen lesson requirements must be satisfied or have reviewed non-applicability.';
    end if;
    if exists (
      select 1
      from content.lesson_requirements requirement
      where requirement.lesson_id = p_entity_id
        and requirement.satisfied
        and requirement.requirement in (
          'scripture', 'catholic_doctrinal_evidence', 'historical_or_patristic_evidence',
          'references', 'related_apologia_graph'
        )
        and coalesce(btrim(requirement.source_locator), '') = ''
    ) then
      return query select 'lesson.evidence_locator_required', 'error', 'source_licence_review'::content.workflow_stage, 'Evidence and reference components require a precise source or graph locator.';
    end if;

  elsif p_entity_kind = 'lesson_section' then
    select * into v_section from content.lesson_sections where id = p_entity_id;
    if v_section.attribution_mode is null then
      return query select 'lesson_section.attribution_required', 'error', 'author_review'::content.workflow_stage, 'Every lesson section must identify quotation, paraphrase, interpretation, or inference.';
    end if;

  elsif p_entity_kind = 'source' then
    select * into v_source from content.sources where id = p_entity_id;
    if v_source.authority_category = 'unverified' then
      return query select 'source.authority_unverified', 'error', 'source_licence_review'::content.workflow_stage, 'Source authority is unverified.';
    end if;
    if coalesce(btrim(v_source.citation), '') = '' then
      return query select 'source.citation_required', 'error', 'source_licence_review'::content.workflow_stage, 'A canonical citation is required.';
    end if;
    if v_source.permission_status not in ('public_domain', 'licensed', 'permission_not_required_under_recorded_terms') then
      return query select 'source.permission_unverified', 'error', 'source_licence_review'::content.workflow_stage, 'Source permission is not publishable.';
    end if;
    if cardinality(v_source.prohibited_use_flags) > 0 then
      return query select 'source.prohibited_use', 'error', 'source_licence_review'::content.workflow_stage, 'A prohibited-use flag overrides domain approval.';
    end if;
    if v_source.permission_expires_at is not null and v_source.permission_expires_at <= now() then
      return query select 'source.permission_expired', 'error', 'source_licence_review'::content.workflow_stage, 'The recorded permission has expired.';
    end if;
    if v_source.rights_review_due_at is not null and v_source.rights_review_due_at <= now() then
      return query select 'source.rights_review_overdue', 'error', 'source_licence_review'::content.workflow_stage, 'The source and licence record is overdue for review.';
    end if;
    if exists (
      select 1
      from content.content_sources source_link
      where source_link.source_id = p_entity_id
        and coalesce(btrim(source_link.quoted_text), '') <> ''
        and (
          v_source.quote_limit_words = 0
          or cardinality(regexp_split_to_array(btrim(source_link.quoted_text), '\s+')) > v_source.quote_limit_words
        )
    ) then
      return query select 'source.quote_limit_exceeded', 'error', 'source_licence_review'::content.workflow_stage, 'A linked quotation exceeds the verified source-specific word limit.';
    end if;
    if v_source.permission_status = 'licensed' and coalesce(btrim(v_source.licence_identifier), '') = '' then
      return query select 'source.licence_required', 'error', 'source_licence_review'::content.workflow_stage, 'Licensed material requires a licence identifier.';
    end if;
    if v_source.permission_status <> 'public_domain' and coalesce(btrim(v_source.attribution_text), '') = '' then
      return query select 'source.attribution_required', 'error', 'source_licence_review'::content.workflow_stage, 'Attribution text is required.';
    end if;
    if v_source.rights_reviewed_by is null or v_source.rights_reviewed_at is null then
      return query select 'source.rights_review_required', 'error', 'source_licence_review'::content.workflow_stage, 'A source/licence reviewer must verify the rights record.';
    end if;
    if v_source.source_kind ilike '%bible%' or v_source.authority_category = 'sacred_scripture' then
      if not (
        v_source.translation_metadata ? 'translationName'
        and v_source.translation_metadata ? 'translationAbbreviation'
        and v_source.translation_metadata ? 'edition'
        and v_source.translation_metadata ? 'language'
        and v_source.translation_metadata ? 'rightsholder'
      ) then
        return query select 'source.bible_translation_metadata_required', 'error', 'source_licence_review'::content.workflow_stage, 'Bible sources require translation, edition, language and rightsholder metadata.';
      end if;
    end if;

  elsif p_entity_kind = 'doctrinal_claim' then
    select * into v_claim from content.doctrinal_claims where id = p_entity_id;
    if v_claim.classification = 'disputed_or_unresolved' and not v_claim.human_review_required then
      return query select 'claim.human_review_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Disputed or unresolved claims require qualified human review.';
    end if;
    if v_claim.classification in ('dogma', 'definitively_held') and (
      v_claim.qualified_reviewer_id is null
      or not exists (
        select 1
        from content.reviewer_qualifications qualification
        where qualification.reviewer_id = v_claim.qualified_reviewer_id
          and qualification.specialism = 'doctrinal'
          and qualification.active
          and qualification.revoked_at is null
          and (qualification.expires_at is null or qualification.expires_at > now())
      )
    ) then
      return query select 'claim.qualified_reviewer_required', 'error', 'doctrinal_review'::content.workflow_stage, 'High-risk doctrinal classifications require an active qualified doctrinal reviewer.';
    end if;
    if jsonb_array_length(v_claim.source_locators) = 0 then
      return query select 'claim.source_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Every doctrinal claim requires a precise source locator.';
    end if;
  end if;

  if p_for_publication then
    foreach v_required_stage in array array[
      'author_review'::content.workflow_stage,
      'doctrinal_review'::content.workflow_stage,
      'assessment_review'::content.workflow_stage,
      'source_licence_review'::content.workflow_stage,
      'approval'::content.workflow_stage
    ]
    loop
      if not exists (
        select 1
        from content.governance_reviews review_row
        where review_row.entity_kind = p_entity_kind
          and review_row.entity_id = p_entity_id
          and review_row.entity_version = p_entity_version
          and review_row.stage = v_required_stage
          and review_row.decision = 'approved'
      ) then
        return query select 'workflow.review_missing.' || v_required_stage::text, 'error', v_required_stage, 'Required current-version review is missing.';
      end if;
    end loop;
  end if;
end;
$$;

create or replace function private.assert_governed_entity_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_error_count integer;
begin
  if new.status not in ('approved', 'scheduled', 'published') then
    return new;
  end if;

  v_kind := case tg_table_name
    when 'lessons' then 'lesson'
    when 'lesson_sections' then 'lesson_section'
    when 'questions' then 'question'
    when 'sources' then 'source'
    when 'doctrinal_claims' then 'doctrinal_claim'
    else null
  end;

  if v_kind = 'lesson_section' and (to_jsonb(new) ->> 'attribution_mode') is null then
    raise exception using errcode = '23514', message = 'lesson section attribution mode is required before approval';
  end if;

  select count(*) into v_error_count
  from content.governance_findings(v_kind, new.id, new.version, true) finding_row
  where finding_row.severity = 'error';

  if v_error_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Phase 2 governance validation failed with %s blocking finding(s)', v_error_count);
  end if;

  if new.status = 'published' and new.governance_stage <> 'publication' then
    raise exception using errcode = '23514', message = 'published governed content must be in publication stage';
  end if;
  return new;
end;
$$;

create trigger lessons_governance_publish
before insert or update of status, governance_stage on content.lessons
for each row execute function private.assert_governed_entity_publishable();

create trigger lesson_sections_governance_publish
before insert or update of status, governance_stage on content.lesson_sections
for each row execute function private.assert_governed_entity_publishable();

create trigger questions_governance_publish
before insert or update of status, governance_stage on content.questions
for each row execute function private.assert_governed_entity_publishable();

create trigger sources_governance_publish
before insert or update of status, governance_stage on content.sources
for each row execute function private.assert_governed_entity_publishable();

create trigger doctrinal_claims_governance_publish
before insert or update of status on content.doctrinal_claims
for each row execute function private.assert_governed_entity_publishable();

create or replace function private.enforce_mastery_threshold_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mastery_threshold_percent = 100 then
    return new;
  end if;
  if new.id is null or not exists (
    select 1
    from content.mastery_policy_overrides override_row
    where override_row.group_id = new.id
      and override_row.active
      and override_row.threshold_percent = new.mastery_threshold_percent
      and (override_row.review_due_at is null or override_row.review_due_at > now())
  ) then
    raise exception using errcode = '23514', message = 'mastery threshold below 100 requires a current approved policy override';
  end if;
  return new;
end;
$$;

create trigger learning_groups_mastery_threshold
before insert or update of mastery_threshold_percent on content.learning_groups
for each row execute function private.enforce_mastery_threshold_override();

create or replace function private.revalidate_governed_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_id uuid;
  v_version integer;
  v_status content.publication_status;
  v_errors integer;
  v_linked record;
begin
  if tg_table_name = 'question_options' then
    v_kind := 'question';
    v_id := coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'content_sources' then
    v_kind := coalesce(new.entity_kind::text, old.entity_kind::text);
    v_id := coalesce(new.entity_id, old.entity_id);
  elsif tg_table_name = 'lesson_requirements' then
    v_kind := 'lesson';
    v_id := coalesce(new.lesson_id, old.lesson_id);
  elsif tg_table_name = 'governance_reviews' then
    v_kind := coalesce(new.entity_kind, old.entity_kind);
    v_id := coalesce(new.entity_id, old.entity_id);
  elsif tg_table_name = 'questions' then
    v_kind := 'question';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'lessons' then
    v_kind := 'lesson';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'sources' then
    v_kind := 'source';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'doctrinal_claims' then
    v_kind := 'doctrinal_claim';
    v_id := coalesce(new.id, old.id);
  else
    return null;
  end if;

  if v_kind in ('question', 'lesson', 'lesson_section', 'source', 'doctrinal_claim') then
    v_version := private.current_entity_version(v_kind, v_id);
    case v_kind
      when 'question' then select status into v_status from content.questions where id = v_id;
      when 'lesson' then select status into v_status from content.lessons where id = v_id;
      when 'lesson_section' then select status into v_status from content.lesson_sections where id = v_id;
      when 'source' then select status into v_status from content.sources where id = v_id;
      when 'doctrinal_claim' then select status into v_status from content.doctrinal_claims where id = v_id;
      else v_status := 'draft';
    end case;

    if v_status in ('approved', 'scheduled', 'published') then
      select count(*) into v_errors
      from content.governance_findings(v_kind, v_id, v_version, true) finding_row
      where finding_row.severity = 'error';
      if v_errors > 0 then
        raise exception using errcode = '23514', message = format(
          'governed dependency change creates %s blocking finding(s)', v_errors
        );
      end if;
    end if;
  end if;

  if tg_table_name = 'sources' then
    for v_linked in
      select question_row.id, question_row.version
      from content.content_sources link_row
      join content.questions question_row on question_row.id = link_row.entity_id
      where link_row.source_id = v_id
        and link_row.entity_kind = 'question'
        and question_row.status in ('approved', 'scheduled', 'published')
    loop
      select count(*) into v_errors
      from content.governance_findings('question', v_linked.id, v_linked.version, true) finding_row
      where finding_row.severity = 'error';
      if v_errors > 0 then
        raise exception using errcode = '23514', message = 'source change would invalidate approved or published question content';
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create constraint trigger questions_governance_revalidate
after insert or update on content.questions
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lessons_governance_revalidate
after insert or update on content.lessons
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lesson_sections_governance_revalidate
after insert or update on content.lesson_sections
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger sources_governance_revalidate
after insert or update on content.sources
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger doctrinal_claims_governance_revalidate
after insert or update on content.doctrinal_claims
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger question_options_governance_revalidate
after insert or update or delete on content.question_options
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger content_sources_governance_revalidate
after insert or update or delete on content.content_sources
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lesson_requirements_governance_revalidate
after insert or update or delete on content.lesson_requirements
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger governance_reviews_revalidate
after insert or update or delete on content.governance_reviews
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

alter table public.unlocks
  add constraint unlock_reason_governed check (
    reason in ('initial', 'manual', 'prerequisites_satisfied', 'mastery_prerequisites', 'approved_data_repair')
  ) not valid;

alter table public.unlocks validate constraint unlock_reason_governed;

create or replace function private.prevent_ordinary_unlock_relock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.maintenance_context', true), '') <> 'approved_data_repair' then
    raise exception using errcode = '42501', message = 'completed unlocks are append-only outside approved data repair';
  end if;
  return old;
end;
$$;

create trigger unlocks_no_ordinary_delete
before delete on public.unlocks
for each row execute function private.prevent_ordinary_unlock_relock();

create or replace function private.create_corrective_recommendations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'submitted' and new.status = 'submitted' then
    insert into public.corrective_recommendations (
      learner_id,
      attempt_id,
      question_id,
      objective_id,
      lesson_id,
      misconception_codes,
      recommendation
    )
    select
      new.learner_id,
      new.id,
      answer_row.question_id,
      question_row.objective_id,
      question_row.lesson_id,
      coalesce(array_agg(option_row.misconception_id) filter (
        where option_row.misconception_id is not null
      ), '{}'::text[]),
      jsonb_build_object(
        'kind', 'corrective_lesson',
        'lesson_id', question_row.lesson_id,
        'objective_id', question_row.objective_id,
        'does_not_extend_lock', true
      )
    from public.mastery_answers answer_row
    join content.questions question_row on question_row.id = answer_row.question_id
    left join content.question_options option_row
      on option_row.question_id = answer_row.question_id
     and option_row.id = any(answer_row.selected_option_ids)
    where answer_row.attempt_id = new.id
      and not answer_row.is_correct
    group by answer_row.question_id, question_row.objective_id, question_row.lesson_id
    on conflict (attempt_id, question_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger mastery_attempt_corrective_recommendations
after update of status on public.mastery_attempts
for each row execute function private.create_corrective_recommendations();

create or replace view content.published_live_question_feed
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
        'option_id', option_row.id,
        'position', option_row.position,
        'label', option_row.label,
        'content', option_row.content,
        'is_correct', option_row.is_correct,
        'explanation', option_row.explanation,
        'misconception_code', option_row.misconception_id
      ) order by option_row.position, option_row.id
    )
    from content.question_options option_row
    where option_row.question_id = q.id
      and option_row.enabled
  ), '[]'::jsonb) as options,
  q.updated_at,
  q.difficulty_mode,
  q.trick_category,
  q.equivalence_key,
  q.denomination_scope,
  q.rights_metadata,
  q.quality_flags,
  q.governance_stage,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'authority_category', source_row.authority_category,
        'locator', source_link.citation_locator,
        'citation', source_row.citation,
        'permission_status', source_row.permission_status
      ) order by source_link.display_order, source_link.id
    )
    from content.content_sources source_link
    join content.sources source_row on source_row.id = source_link.source_id
    where source_link.entity_kind = 'question'
      and source_link.entity_id = q.id
  ), '[]'::jsonb) as sources,
  true as governance_validated
from content.questions q
join content.subjects s on s.id = q.subject_id
join content.programmes p on p.id = s.programme_id
left join content.learning_groups g on g.id = q.group_id
left join content.lessons l on l.id = q.lesson_id
left join content.learning_objectives objective on objective.id = q.objective_id
where q.status = 'published'
  and q.published_at <= now()
  and q.retirement_status = 'active'
  and q.question_type = 'single_choice'
  and q.governance_stage in ('publication', 'analytics_review')
  and not exists (
    select 1
    from content.governance_findings('question', q.id, q.version, true) finding_row
    where finding_row.severity = 'error'
  )
  and s.status = 'published' and s.published_at <= now() and s.visibility = 'public'
  and p.status = 'published' and p.published_at <= now() and p.visibility = 'public'
  and (g.id is null or (
    g.status = 'published' and g.published_at <= now() and g.visibility = 'public'
  ))
  and (l.id is null or (
    l.status = 'published' and l.published_at <= now() and l.visibility = 'public'
  ))
  and (objective.id is null or (
    objective.status = 'published' and objective.published_at <= now()
  ))
  and exists (
    select 1
    from content.question_contexts live_context
    where live_context.question_id = q.id
      and live_context.context = 'live_quiz'
      and live_context.enabled
      and (live_context.valid_from is null or live_context.valid_from <= now())
      and (live_context.valid_until is null or live_context.valid_until > now())
  );

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

  select attempt_row.id into v_attempt_id
  from public.mastery_attempts attempt_row
  where attempt_row.learner_id = p_learner_id
    and attempt_row.start_idempotency_key = btrim(p_idempotency_key);

  if v_attempt_id is not null then
    return private.mastery_attempt_payload(v_attempt_id);
  end if;

  select group_row.* into v_group
  from content.learning_groups group_row
  where group_row.id = p_group_id
    and group_row.status = 'published'
    and group_row.published_at <= now();

  if not found then
    raise exception using errcode = 'P0002', message = 'published learning group not found';
  end if;
  if not private.learner_group_is_eligible(p_learner_id, p_group_id) then
    raise exception using errcode = '42501', message = 'learning group is locked or its prerequisites are incomplete';
  end if;

  insert into public.unlocks (learner_id, group_id, reason, rule_snapshot)
  values (
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
    id, learner_id, group_id, status, start_idempotency_key,
    pass_threshold_percent, expires_at
  ) values (
    v_attempt_id, p_learner_id, p_group_id, 'in_progress',
    btrim(p_idempotency_key), v_group.mastery_threshold_percent,
    clock_timestamp() + pg_catalog.make_interval(mins => v_ttl_minutes)
  );

  insert into public.mastery_attempt_questions (
    attempt_id, question_id, position, question_version,
    prompt_snapshot, option_snapshot, scoring_snapshot, result_snapshot
  )
  select
    v_attempt_id,
    selected.id,
    selected.position,
    selected.version,
    jsonb_build_object(
      'question_type', selected.question_type,
      'difficulty', selected.difficulty,
      'difficulty_mode', selected.difficulty_mode,
      'prompt', selected.prompt,
      'equivalence_key', selected.equivalence_key
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
      row_number() over (
        order by
          (exposure.question_id is null) desc,
          exposure.last_exposed_at asc nulls first,
          md5(q.id::text || v_attempt_id::text),
          q.id
      )::integer - 1 as position,
      q.version,
      q.question_type,
      q.difficulty,
      q.difficulty_mode,
      q.equivalence_key,
      q.prompt,
      q.correct_answer_explanation,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', option_row.id,
            'position', option_row.position,
            'label', option_row.label,
            'content', option_row.content
          ) order by option_row.position, option_row.id
        )
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled
      ) as option_snapshot,
      (
        select jsonb_agg(to_jsonb(option_row.id) order by option_row.position, option_row.id)
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled and option_row.is_correct
      ) as correct_option_ids,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', option_row.id,
            'is_correct', option_row.is_correct,
            'explanation', option_row.explanation,
            'misconception_code', option_row.misconception_id
          ) order by option_row.position, option_row.id
        )
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled
      ) as result_options
    from content.questions q
    left join public.question_exposures exposure
      on exposure.learner_id = p_learner_id
     and exposure.question_id = q.id
    where q.status = 'published'
      and q.published_at <= now()
      and q.retirement_status = 'active'
      and q.question_type = 'single_choice'
      and q.governance_stage in ('publication', 'analytics_review')
      and q.equivalence_key is not null
      and (q.group_id = p_group_id or q.group_id is null)
      and exists (
        select 1
        from content.question_contexts context_row
        where context_row.question_id = q.id
          and context_row.context = 'mastery_assessment'
          and context_row.enabled
          and coalesce(context_row.group_id, q.group_id) = p_group_id
          and (context_row.valid_from is null or context_row.valid_from <= now())
          and (context_row.valid_until is null or context_row.valid_until > now())
      )
      and (select count(*) from content.question_options option_row where option_row.question_id = q.id and option_row.enabled) = 4
      and (select count(*) from content.question_options option_row where option_row.question_id = q.id and option_row.enabled and option_row.is_correct) = 1
      and not exists (
        select 1
        from content.governance_findings('question', q.id, q.version, true) finding_row
        where finding_row.severity = 'error'
      )
    order by
      (exposure.question_id is null) desc,
      exposure.last_exposed_at asc nulls first,
      md5(q.id::text || v_attempt_id::text),
      q.id
    limit p_question_limit
  ) selected;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'no eligible governed mastery questions are configured for this group';
  end if;

  update public.mastery_attempts
  set question_count = v_inserted_count
  where id = v_attempt_id;

  insert into public.question_exposures (
    learner_id, question_id, equivalence_key, last_exposed_at, last_attempt_id
  )
  select
    p_learner_id,
    attempt_question.question_id,
    question_row.equivalence_key,
    clock_timestamp(),
    v_attempt_id
  from public.mastery_attempt_questions attempt_question
  join content.questions question_row on question_row.id = attempt_question.question_id
  where attempt_question.attempt_id = v_attempt_id
  on conflict (learner_id, question_id) do update
  set exposure_count = public.question_exposures.exposure_count + 1,
      equivalence_key = excluded.equivalence_key,
      last_exposed_at = excluded.last_exposed_at,
      last_attempt_id = excluded.last_attempt_id;

  insert into content.audit_log (
    actor_id, action, entity_kind, entity_id, new_data, metadata
  ) values (
    private.current_actor_id(),
    'mastery_attempt.started',
    'mastery_attempt',
    v_attempt_id,
    jsonb_build_object(
      'learner_id', p_learner_id,
      'group_id', p_group_id,
      'question_count', v_inserted_count,
      'selection_policy', 'prefer_unseen_then_least_recently_seen_equivalent'
    ),
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key))
  );

  return private.mastery_attempt_payload(v_attempt_id);
end;
$$;

alter table content.governance_policies enable row level security;
alter table content.approved_source_domains enable row level security;
alter table content.reviewer_qualifications enable row level security;
alter table content.lesson_requirements enable row level security;
alter table content.doctrinal_claims enable row level security;
alter table content.governance_reviews enable row level security;
alter table content.validation_runs enable row level security;
alter table content.mastery_policy_overrides enable row level security;
alter table public.question_exposures enable row level security;
alter table public.corrective_recommendations enable row level security;
alter table public.retention_reviews enable row level security;

create policy governance_policies_service_all on content.governance_policies for all to service_role using (true) with check (true);
create policy approved_source_domains_service_all on content.approved_source_domains for all to service_role using (true) with check (true);
create policy reviewer_qualifications_service_all on content.reviewer_qualifications for all to service_role using (true) with check (true);
create policy lesson_requirements_service_all on content.lesson_requirements for all to service_role using (true) with check (true);
create policy doctrinal_claims_service_all on content.doctrinal_claims for all to service_role using (true) with check (true);
create policy governance_reviews_service_all on content.governance_reviews for all to service_role using (true) with check (true);
create policy validation_runs_service_all on content.validation_runs for all to service_role using (true) with check (true);
create policy mastery_policy_overrides_service_all on content.mastery_policy_overrides for all to service_role using (true) with check (true);
create policy question_exposures_learner_select on public.question_exposures for select to authenticated using (private.owns_learner(learner_id));
create policy corrective_recommendations_learner_select on public.corrective_recommendations for select to authenticated using (private.owns_learner(learner_id));
create policy retention_reviews_learner_select on public.retention_reviews for select to authenticated using (private.owns_learner(learner_id));
create policy question_exposures_service_all on public.question_exposures for all to service_role using (true) with check (true);
create policy corrective_recommendations_service_all on public.corrective_recommendations for all to service_role using (true) with check (true);
create policy retention_reviews_service_all on public.retention_reviews for all to service_role using (true) with check (true);

revoke all on content.governance_policies from public, anon, authenticated;
revoke all on content.approved_source_domains from public, anon, authenticated;
revoke all on content.reviewer_qualifications from public, anon, authenticated;
revoke all on content.lesson_requirements from public, anon, authenticated;
revoke all on content.doctrinal_claims from public, anon, authenticated;
revoke all on content.governance_reviews from public, anon, authenticated;
revoke all on content.validation_runs from public, anon, authenticated;
revoke all on content.mastery_policy_overrides from public, anon, authenticated;
revoke all on public.question_exposures from public, anon;
revoke all on public.corrective_recommendations from public, anon;
revoke all on public.retention_reviews from public, anon;

grant select, insert, update, delete on content.governance_policies to service_role;
grant select, insert, update, delete on content.approved_source_domains to service_role;
grant select, insert, update, delete on content.reviewer_qualifications to service_role;
grant select, insert, update, delete on content.lesson_requirements to service_role;
grant select, insert, update, delete on content.doctrinal_claims to service_role;
grant select, insert, update, delete on content.governance_reviews to service_role;
grant select, insert on content.validation_runs to service_role;
grant select, insert, update, delete on content.mastery_policy_overrides to service_role;
grant select on public.question_exposures, public.corrective_recommendations, public.retention_reviews to authenticated;
grant select, insert, update, delete on public.question_exposures, public.corrective_recommendations, public.retention_reviews to service_role;

revoke execute on function content.governance_findings(text, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function content.governance_findings(text, uuid, integer, boolean) to service_role;
revoke execute on function private.current_entity_version(text, uuid) from public, anon, authenticated;
revoke execute on function private.current_entity_creator(text, uuid) from public, anon, authenticated;
revoke execute on function private.validate_governance_review() from public, anon, authenticated;
revoke execute on function private.assert_governed_entity_publishable() from public, anon, authenticated;
revoke execute on function private.enforce_mastery_threshold_override() from public, anon, authenticated;
revoke execute on function private.revalidate_governed_dependency() from public, anon, authenticated;
revoke execute on function private.prevent_ordinary_unlock_relock() from public, anon, authenticated;
revoke execute on function private.create_corrective_recommendations() from public, anon, authenticated;
revoke execute on function private.seed_lesson_requirements() from public, anon, authenticated;
grant execute on all functions in schema content to service_role;
grant execute on all functions in schema private to service_role;

commit;

    ) then
      return query select 'question.forbidden_option', 'error', 'assessment_review'::content.workflow_stage, 'All/None of the above is prohibited.';
    end if;
    if not exists (
      select 1
      from content.content_sources source_link
      join content.sources source_row on source_row.id = source_link.source_id
      where source_link.entity_kind = 'question'
        and source_link.entity_id = p_entity_id
        and coalesce(btrim(source_link.citation_locator), '') <> ''
        and source_row.status = 'published'
        and source_row.governance_stage in ('publication', 'analytics_review')
        and source_row.authority_category <> 'unverified'
        and source_row.permission_status in (
          'public_domain', 'licensed', 'permission_not_required_under_recorded_terms'
        )
        and cardinality(source_row.prohibited_use_flags) = 0
        and (source_row.permission_expires_at is null or source_row.permission_expires_at > now())
        and (source_row.rights_review_due_at is null or source_row.rights_review_due_at > now())
        and (
          coalesce(btrim(source_link.quoted_text), '') = ''
          or (
            source_row.quote_limit_words > 0
            and cardinality(regexp_split_to_array(btrim(source_link.quoted_text), '\s+')) <= source_row.quote_limit_words
          )
        )
    ) then
      return query select 'question.authoritative_source_required', 'error', 'source_licence_review'::content.workflow_stage, 'An authoritative, precisely located and rights-cleared source is required.';
    end if;

  elsif p_entity_kind = 'lesson' then
    select * into v_lesson from content.lessons where id = p_entity_id;
    if (
      select count(*)
      from content.lesson_requirements requirement
      where requirement.lesson_id = p_entity_id
        and (
          requirement.satisfied
          or (
            requirement.non_applicable
            and coalesce(btrim(requirement.non_applicable_reason), '') <> ''
            and requirement.reviewed_by is not null
            and requirement.reviewed_at is not null
          )
        )
    ) <> 15 then
      return query select 'lesson.components_incomplete', 'error', 'author_review'::content.workflow_stage, 'All fifteen lesson requirements must be satisfied or have reviewed non-applicability.';
    end if;
    if exists (
      select 1
      from content.lesson_requirements requirement
      where requirement.lesson_id = p_entity_id
        and requirement.satisfied
        and requirement.requirement in (
          'scripture', 'catholic_doctrinal_evidence', 'historical_or_patristic_evidence',
          'references', 'related_apologia_graph'
        )
        and coalesce(btrim(requirement.source_locator), '') = ''
    ) then
      return query select 'lesson.evidence_locator_required', 'error', 'source_licence_review'::content.workflow_stage, 'Evidence and reference components require a precise source or graph locator.';
    end if;

  elsif p_entity_kind = 'lesson_section' then
    select * into v_section from content.lesson_sections where id = p_entity_id;
    if v_section.attribution_mode is null then
      return query select 'lesson_section.attribution_required', 'error', 'author_review'::content.workflow_stage, 'Every lesson section must identify quotation, paraphrase, interpretation, or inference.';
    end if;

  elsif p_entity_kind = 'source' then
    select * into v_source from content.sources where id = p_entity_id;
    if v_source.authority_category = 'unverified' then
      return query select 'source.authority_unverified', 'error', 'source_licence_review'::content.workflow_stage, 'Source authority is unverified.';
    end if;
    if coalesce(btrim(v_source.citation), '') = '' then
      return query select 'source.citation_required', 'error', 'source_licence_review'::content.workflow_stage, 'A canonical citation is required.';
    end if;
    if v_source.permission_status not in ('public_domain', 'licensed', 'permission_not_required_under_recorded_terms') then
      return query select 'source.permission_unverified', 'error', 'source_licence_review'::content.workflow_stage, 'Source permission is not publishable.';
    end if;
    if cardinality(v_source.prohibited_use_flags) > 0 then
      return query select 'source.prohibited_use', 'error', 'source_licence_review'::content.workflow_stage, 'A prohibited-use flag overrides domain approval.';
    end if;
    if v_source.permission_expires_at is not null and v_source.permission_expires_at <= now() then
      return query select 'source.permission_expired', 'error', 'source_licence_review'::content.workflow_stage, 'The recorded permission has expired.';
    end if;
    if v_source.rights_review_due_at is not null and v_source.rights_review_due_at <= now() then
      return query select 'source.rights_review_overdue', 'error', 'source_licence_review'::content.workflow_stage, 'The source and licence record is overdue for review.';
    end if;
    if exists (
      select 1
      from content.content_sources source_link
      where source_link.source_id = p_entity_id
        and coalesce(btrim(source_link.quoted_text), '') <> ''
        and (
          v_source.quote_limit_words = 0
          or cardinality(regexp_split_to_array(btrim(source_link.quoted_text), '\s+')) > v_source.quote_limit_words
        )
    ) then
      return query select 'source.quote_limit_exceeded', 'error', 'source_licence_review'::content.workflow_stage, 'A linked quotation exceeds the verified source-specific word limit.';
    end if;
    if v_source.permission_status = 'licensed' and coalesce(btrim(v_source.licence_identifier), '') = '' then
      return query select 'source.licence_required', 'error', 'source_licence_review'::content.workflow_stage, 'Licensed material requires a licence identifier.';
    end if;
    if v_source.permission_status <> 'public_domain' and coalesce(btrim(v_source.attribution_text), '') = '' then
      return query select 'source.attribution_required', 'error', 'source_licence_review'::content.workflow_stage, 'Attribution text is required.';
    end if;
    if v_source.rights_reviewed_by is null or v_source.rights_reviewed_at is null then
      return query select 'source.rights_review_required', 'error', 'source_licence_review'::content.workflow_stage, 'A source/licence reviewer must verify the rights record.';
    end if;
    if v_source.source_kind ilike '%bible%' or v_source.authority_category = 'sacred_scripture' then
      if not (
        v_source.translation_metadata ? 'translationName'
        and v_source.translation_metadata ? 'translationAbbreviation'
        and v_source.translation_metadata ? 'edition'
        and v_source.translation_metadata ? 'language'
        and v_source.translation_metadata ? 'rightsholder'
      ) then
        return query select 'source.bible_translation_metadata_required', 'error', 'source_licence_review'::content.workflow_stage, 'Bible sources require translation, edition, language and rightsholder metadata.';
      end if;
    end if;

  elsif p_entity_kind = 'doctrinal_claim' then
    select * into v_claim from content.doctrinal_claims where id = p_entity_id;
    if v_claim.classification = 'disputed_or_unresolved' and not v_claim.human_review_required then
      return query select 'claim.human_review_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Disputed or unresolved claims require qualified human review.';
    end if;
    if v_claim.classification in ('dogma', 'definitively_held') and (
      v_claim.qualified_reviewer_id is null
      or not exists (
        select 1
        from content.reviewer_qualifications qualification
        where qualification.reviewer_id = v_claim.qualified_reviewer_id
          and qualification.specialism = 'doctrinal'
          and qualification.active
          and qualification.revoked_at is null
          and (qualification.expires_at is null or qualification.expires_at > now())
      )
    ) then
      return query select 'claim.qualified_reviewer_required', 'error', 'doctrinal_review'::content.workflow_stage, 'High-risk doctrinal classifications require an active qualified doctrinal reviewer.';
    end if;
    if jsonb_array_length(v_claim.source_locators) = 0 then
      return query select 'claim.source_required', 'error', 'doctrinal_review'::content.workflow_stage, 'Every doctrinal claim requires a precise source locator.';
    end if;
  end if;

  if p_for_publication then
    foreach v_required_stage in array array[
      'author_review'::content.workflow_stage,
      'doctrinal_review'::content.workflow_stage,
      'assessment_review'::content.workflow_stage,
      'source_licence_review'::content.workflow_stage,
      'approval'::content.workflow_stage
    ]
    loop
      if not exists (
        select 1
        from content.governance_reviews review_row
        where review_row.entity_kind = p_entity_kind
          and review_row.entity_id = p_entity_id
          and review_row.entity_version = p_entity_version
          and review_row.stage = v_required_stage
          and review_row.decision = 'approved'
      ) then
        return query select 'workflow.review_missing.' || v_required_stage::text, 'error', v_required_stage, 'Required current-version review is missing.';
      end if;
    end loop;
  end if;
end;
$$;

create or replace function private.assert_governed_entity_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_error_count integer;
begin
  if new.status not in ('approved', 'scheduled', 'published') then
    return new;
  end if;

  v_kind := case tg_table_name
    when 'lessons' then 'lesson'
    when 'lesson_sections' then 'lesson_section'
    when 'questions' then 'question'
    when 'sources' then 'source'
    when 'doctrinal_claims' then 'doctrinal_claim'
    else null
  end;

  if v_kind = 'lesson_section' and (to_jsonb(new) ->> 'attribution_mode') is null then
    raise exception using errcode = '23514', message = 'lesson section attribution mode is required before approval';
  end if;

  select count(*) into v_error_count
  from content.governance_findings(v_kind, new.id, new.version, true) finding_row
  where finding_row.severity = 'error';

  if v_error_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Phase 2 governance validation failed with %s blocking finding(s)', v_error_count);
  end if;

  if new.status = 'published' and new.governance_stage <> 'publication' then
    raise exception using errcode = '23514', message = 'published governed content must be in publication stage';
  end if;
  return new;
end;
$$;

create trigger lessons_governance_publish
before insert or update of status, governance_stage on content.lessons
for each row execute function private.assert_governed_entity_publishable();

create trigger lesson_sections_governance_publish
before insert or update of status, governance_stage on content.lesson_sections
for each row execute function private.assert_governed_entity_publishable();

create trigger questions_governance_publish
before insert or update of status, governance_stage on content.questions
for each row execute function private.assert_governed_entity_publishable();

create trigger sources_governance_publish
before insert or update of status, governance_stage on content.sources
for each row execute function private.assert_governed_entity_publishable();

create trigger doctrinal_claims_governance_publish
before insert or update of status on content.doctrinal_claims
for each row execute function private.assert_governed_entity_publishable();

create or replace function private.enforce_mastery_threshold_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mastery_threshold_percent = 100 then
    return new;
  end if;
  if new.id is null or not exists (
    select 1
    from content.mastery_policy_overrides override_row
    where override_row.group_id = new.id
      and override_row.active
      and override_row.threshold_percent = new.mastery_threshold_percent
      and (override_row.review_due_at is null or override_row.review_due_at > now())
  ) then
    raise exception using errcode = '23514', message = 'mastery threshold below 100 requires a current approved policy override';
  end if;
  return new;
end;
$$;

create trigger learning_groups_mastery_threshold
before insert or update of mastery_threshold_percent on content.learning_groups
for each row execute function private.enforce_mastery_threshold_override();

create or replace function private.revalidate_governed_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_id uuid;
  v_version integer;
  v_status content.publication_status;
  v_errors integer;
  v_linked record;
begin
  if tg_table_name = 'question_options' then
    v_kind := 'question';
    v_id := coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'content_sources' then
    v_kind := coalesce(new.entity_kind::text, old.entity_kind::text);
    v_id := coalesce(new.entity_id, old.entity_id);
  elsif tg_table_name = 'lesson_requirements' then
    v_kind := 'lesson';
    v_id := coalesce(new.lesson_id, old.lesson_id);
  elsif tg_table_name = 'governance_reviews' then
    v_kind := coalesce(new.entity_kind, old.entity_kind);
    v_id := coalesce(new.entity_id, old.entity_id);
  elsif tg_table_name = 'questions' then
    v_kind := 'question';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'lessons' then
    v_kind := 'lesson';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'sources' then
    v_kind := 'source';
    v_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'doctrinal_claims' then
    v_kind := 'doctrinal_claim';
    v_id := coalesce(new.id, old.id);
  else
    return null;
  end if;

  if v_kind in ('question', 'lesson', 'lesson_section', 'source', 'doctrinal_claim') then
    v_version := private.current_entity_version(v_kind, v_id);
    case v_kind
      when 'question' then select status into v_status from content.questions where id = v_id;
      when 'lesson' then select status into v_status from content.lessons where id = v_id;
      when 'lesson_section' then select status into v_status from content.lesson_sections where id = v_id;
      when 'source' then select status into v_status from content.sources where id = v_id;
      when 'doctrinal_claim' then select status into v_status from content.doctrinal_claims where id = v_id;
      else v_status := 'draft';
    end case;

    if v_status in ('approved', 'scheduled', 'published') then
      select count(*) into v_errors
      from content.governance_findings(v_kind, v_id, v_version, true) finding_row
      where finding_row.severity = 'error';
      if v_errors > 0 then
        raise exception using errcode = '23514', message = format(
          'governed dependency change creates %s blocking finding(s)', v_errors
        );
      end if;
    end if;
  end if;

  if tg_table_name = 'sources' then
    for v_linked in
      select question_row.id, question_row.version
      from content.content_sources link_row
      join content.questions question_row on question_row.id = link_row.entity_id
      where link_row.source_id = v_id
        and link_row.entity_kind = 'question'
        and question_row.status in ('approved', 'scheduled', 'published')
    loop
      select count(*) into v_errors
      from content.governance_findings('question', v_linked.id, v_linked.version, true) finding_row
      where finding_row.severity = 'error';
      if v_errors > 0 then
        raise exception using errcode = '23514', message = 'source change would invalidate approved or published question content';
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create constraint trigger questions_governance_revalidate
after insert or update on content.questions
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lessons_governance_revalidate
after insert or update on content.lessons
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lesson_sections_governance_revalidate
after insert or update on content.lesson_sections
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger sources_governance_revalidate
after insert or update on content.sources
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger doctrinal_claims_governance_revalidate
after insert or update on content.doctrinal_claims
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger question_options_governance_revalidate
after insert or update or delete on content.question_options
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger content_sources_governance_revalidate
after insert or update or delete on content.content_sources
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger lesson_requirements_governance_revalidate
after insert or update or delete on content.lesson_requirements
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

create constraint trigger governance_reviews_revalidate
after insert or update or delete on content.governance_reviews
deferrable initially deferred
for each row execute function private.revalidate_governed_dependency();

alter table public.unlocks
  add constraint unlock_reason_governed check (
    reason in ('initial', 'manual', 'prerequisites_satisfied', 'mastery_prerequisites', 'approved_data_repair')
  ) not valid;

alter table public.unlocks validate constraint unlock_reason_governed;

create or replace function private.prevent_ordinary_unlock_relock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.maintenance_context', true), '') <> 'approved_data_repair' then
    raise exception using errcode = '42501', message = 'completed unlocks are append-only outside approved data repair';
  end if;
  return old;
end;
$$;

create trigger unlocks_no_ordinary_delete
before delete on public.unlocks
for each row execute function private.prevent_ordinary_unlock_relock();

create or replace function private.create_corrective_recommendations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'submitted' and new.status = 'submitted' then
    insert into public.corrective_recommendations (
      learner_id,
      attempt_id,
      question_id,
      objective_id,
      lesson_id,
      misconception_codes,
      recommendation
    )
    select
      new.learner_id,
      new.id,
      answer_row.question_id,
      question_row.objective_id,
      question_row.lesson_id,
      coalesce(array_agg(option_row.misconception_id) filter (
        where option_row.misconception_id is not null
      ), '{}'::text[]),
      jsonb_build_object(
        'kind', 'corrective_lesson',
        'lesson_id', question_row.lesson_id,
        'objective_id', question_row.objective_id,
        'does_not_extend_lock', true
      )
    from public.mastery_answers answer_row
    join content.questions question_row on question_row.id = answer_row.question_id
    left join content.question_options option_row
      on option_row.question_id = answer_row.question_id
     and option_row.id = any(answer_row.selected_option_ids)
    where answer_row.attempt_id = new.id
      and not answer_row.is_correct
    group by answer_row.question_id, question_row.objective_id, question_row.lesson_id
    on conflict (attempt_id, question_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger mastery_attempt_corrective_recommendations
after update of status on public.mastery_attempts
for each row execute function private.create_corrective_recommendations();

create or replace view content.published_live_question_feed
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
        'option_id', option_row.id,
        'position', option_row.position,
        'label', option_row.label,
        'content', option_row.content,
        'is_correct', option_row.is_correct,
        'explanation', option_row.explanation,
        'misconception_code', option_row.misconception_id
      ) order by option_row.position, option_row.id
    )
    from content.question_options option_row
    where option_row.question_id = q.id
      and option_row.enabled
  ), '[]'::jsonb) as options,
  q.updated_at,
  q.difficulty_mode,
  q.trick_category,
  q.equivalence_key,
  q.denomination_scope,
  q.rights_metadata,
  q.quality_flags,
  q.governance_stage,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'authority_category', source_row.authority_category,
        'locator', source_link.citation_locator,
        'citation', source_row.citation,
        'permission_status', source_row.permission_status
      ) order by source_link.display_order, source_link.id
    )
    from content.content_sources source_link
    join content.sources source_row on source_row.id = source_link.source_id
    where source_link.entity_kind = 'question'
      and source_link.entity_id = q.id
  ), '[]'::jsonb) as sources,
  true as governance_validated
from content.questions q
join content.subjects s on s.id = q.subject_id
join content.programmes p on p.id = s.programme_id
left join content.learning_groups g on g.id = q.group_id
left join content.lessons l on l.id = q.lesson_id
left join content.learning_objectives objective on objective.id = q.objective_id
where q.status = 'published'
  and q.published_at <= now()
  and q.retirement_status = 'active'
  and q.question_type = 'single_choice'
  and q.governance_stage in ('publication', 'analytics_review')
  and not exists (
    select 1
    from content.governance_findings('question', q.id, q.version, true) finding_row
    where finding_row.severity = 'error'
  )
  and s.status = 'published' and s.published_at <= now() and s.visibility = 'public'
  and p.status = 'published' and p.published_at <= now() and p.visibility = 'public'
  and (g.id is null or (
    g.status = 'published' and g.published_at <= now() and g.visibility = 'public'
  ))
  and (l.id is null or (
    l.status = 'published' and l.published_at <= now() and l.visibility = 'public'
  ))
  and (objective.id is null or (
    objective.status = 'published' and objective.published_at <= now()
  ))
  and exists (
    select 1
    from content.question_contexts live_context
    where live_context.question_id = q.id
      and live_context.context = 'live_quiz'
      and live_context.enabled
      and (live_context.valid_from is null or live_context.valid_from <= now())
      and (live_context.valid_until is null or live_context.valid_until > now())
  );

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

  select attempt_row.id into v_attempt_id
  from public.mastery_attempts attempt_row
  where attempt_row.learner_id = p_learner_id
    and attempt_row.start_idempotency_key = btrim(p_idempotency_key);

  if v_attempt_id is not null then
    return private.mastery_attempt_payload(v_attempt_id);
  end if;

  select group_row.* into v_group
  from content.learning_groups group_row
  where group_row.id = p_group_id
    and group_row.status = 'published'
    and group_row.published_at <= now();

  if not found then
    raise exception using errcode = 'P0002', message = 'published learning group not found';
  end if;
  if not private.learner_group_is_eligible(p_learner_id, p_group_id) then
    raise exception using errcode = '42501', message = 'learning group is locked or its prerequisites are incomplete';
  end if;

  insert into public.unlocks (learner_id, group_id, reason, rule_snapshot)
  values (
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
    id, learner_id, group_id, status, start_idempotency_key,
    pass_threshold_percent, expires_at
  ) values (
    v_attempt_id, p_learner_id, p_group_id, 'in_progress',
    btrim(p_idempotency_key), v_group.mastery_threshold_percent,
    clock_timestamp() + pg_catalog.make_interval(mins => v_ttl_minutes)
  );

  insert into public.mastery_attempt_questions (
    attempt_id, question_id, position, question_version,
    prompt_snapshot, option_snapshot, scoring_snapshot, result_snapshot
  )
  select
    v_attempt_id,
    selected.id,
    selected.position,
    selected.version,
    jsonb_build_object(
      'question_type', selected.question_type,
      'difficulty', selected.difficulty,
      'difficulty_mode', selected.difficulty_mode,
      'prompt', selected.prompt,
      'equivalence_key', selected.equivalence_key
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
      row_number() over (
        order by
          (exposure.question_id is null) desc,
          exposure.last_exposed_at asc nulls first,
          md5(q.id::text || v_attempt_id::text),
          q.id
      )::integer - 1 as position,
      q.version,
      q.question_type,
      q.difficulty,
      q.difficulty_mode,
      q.equivalence_key,
      q.prompt,
      q.correct_answer_explanation,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', option_row.id,
            'position', option_row.position,
            'label', option_row.label,
            'content', option_row.content
          ) order by option_row.position, option_row.id
        )
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled
      ) as option_snapshot,
      (
        select jsonb_agg(to_jsonb(option_row.id) order by option_row.position, option_row.id)
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled and option_row.is_correct
      ) as correct_option_ids,
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_id', option_row.id,
            'is_correct', option_row.is_correct,
            'explanation', option_row.explanation,
            'misconception_code', option_row.misconception_id
          ) order by option_row.position, option_row.id
        )
        from content.question_options option_row
        where option_row.question_id = q.id and option_row.enabled
      ) as result_options
    from content.questions q
    left join public.question_exposures exposure
      on exposure.learner_id = p_learner_id
     and exposure.question_id = q.id
    where q.status = 'published'
      and q.published_at <= now()
      and q.retirement_status = 'active'
      and q.question_type = 'single_choice'
      and q.governance_stage in ('publication', 'analytics_review')
      and q.equivalence_key is not null
      and (q.group_id = p_group_id or q.group_id is null)
      and exists (
        select 1
        from content.question_contexts context_row
        where context_row.question_id = q.id
          and context_row.context = 'mastery_assessment'
          and context_row.enabled
          and coalesce(context_row.group_id, q.group_id) = p_group_id
          and (context_row.valid_from is null or context_row.valid_from <= now())
          and (context_row.valid_until is null or context_row.valid_until > now())
      )
      and (select count(*) from content.question_options option_row where option_row.question_id = q.id and option_row.enabled) = 4
      and (select count(*) from content.question_options option_row where option_row.question_id = q.id and option_row.enabled and option_row.is_correct) = 1
      and not exists (
        select 1
        from content.governance_findings('question', q.id, q.version, true) finding_row
        where finding_row.severity = 'error'
      )
    order by
      (exposure.question_id is null) desc,
      exposure.last_exposed_at asc nulls first,
      md5(q.id::text || v_attempt_id::text),
      q.id
    limit p_question_limit
  ) selected;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    raise exception using errcode = 'P0002', message = 'no eligible governed mastery questions are configured for this group';
  end if;

  update public.mastery_attempts
  set question_count = v_inserted_count
  where id = v_attempt_id;

  insert into public.question_exposures (
    learner_id, question_id, equivalence_key, last_exposed_at, last_attempt_id
  )
  select
    p_learner_id,
    attempt_question.question_id,
    question_row.equivalence_key,
    clock_timestamp(),
    v_attempt_id
  from public.mastery_attempt_questions attempt_question
  join content.questions question_row on question_row.id = attempt_question.question_id
  where attempt_question.attempt_id = v_attempt_id
  on conflict (learner_id, question_id) do update
  set exposure_count = public.question_exposures.exposure_count + 1,
      equivalence_key = excluded.equivalence_key,
      last_exposed_at = excluded.last_exposed_at,
      last_attempt_id = excluded.last_attempt_id;

  insert into content.audit_log (
    actor_id, action, entity_kind, entity_id, new_data, metadata
  ) values (
    private.current_actor_id(),
    'mastery_attempt.started',
    'mastery_attempt',
    v_attempt_id,
    jsonb_build_object(
      'learner_id', p_learner_id,
      'group_id', p_group_id,
      'question_count', v_inserted_count,
      'selection_policy', 'prefer_unseen_then_least_recently_seen_equivalent'
    ),
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key))
  );

  return private.mastery_attempt_payload(v_attempt_id);
end;
$$;

alter table content.governance_policies enable row level security;
alter table content.approved_source_domains enable row level security;
alter table content.reviewer_qualifications enable row level security;
alter table content.lesson_requirements enable row level security;
alter table content.doctrinal_claims enable row level security;
alter table content.governance_reviews enable row level security;
alter table content.validation_runs enable row level security;
alter table content.mastery_policy_overrides enable row level security;
alter table public.question_exposures enable row level security;
alter table public.corrective_recommendations enable row level security;
alter table public.retention_reviews enable row level security;

create policy governance_policies_service_all on content.governance_policies for all to service_role using (true) with check (true);
create policy approved_source_domains_service_all on content.approved_source_domains for all to service_role using (true) with check (true);
create policy reviewer_qualifications_service_all on content.reviewer_qualifications for all to service_role using (true) with check (true);
create policy lesson_requirements_service_all on content.lesson_requirements for all to service_role using (true) with check (true);
create policy doctrinal_claims_service_all on content.doctrinal_claims for all to service_role using (true) with check (true);
create policy governance_reviews_service_all on content.governance_reviews for all to service_role using (true) with check (true);
create policy validation_runs_service_all on content.validation_runs for all to service_role using (true) with check (true);
create policy mastery_policy_overrides_service_all on content.mastery_policy_overrides for all to service_role using (true) with check (true);
create policy question_exposures_learner_select on public.question_exposures for select to authenticated using (private.owns_learner(learner_id));
create policy corrective_recommendations_learner_select on public.corrective_recommendations for select to authenticated using (private.owns_learner(learner_id));
create policy retention_reviews_learner_select on public.retention_reviews for select to authenticated using (private.owns_learner(learner_id));
create policy question_exposures_service_all on public.question_exposures for all to service_role using (true) with check (true);
create policy corrective_recommendations_service_all on public.corrective_recommendations for all to service_role using (true) with check (true);
create policy retention_reviews_service_all on public.retention_reviews for all to service_role using (true) with check (true);

revoke all on content.governance_policies from public, anon, authenticated;
revoke all on content.approved_source_domains from public, anon, authenticated;
revoke all on content.reviewer_qualifications from public, anon, authenticated;
revoke all on content.lesson_requirements from public, anon, authenticated;
revoke all on content.doctrinal_claims from public, anon, authenticated;
revoke all on content.governance_reviews from public, anon, authenticated;
revoke all on content.validation_runs from public, anon, authenticated;
revoke all on content.mastery_policy_overrides from public, anon, authenticated;
revoke all on public.question_exposures from public, anon;
revoke all on public.corrective_recommendations from public, anon;
revoke all on public.retention_reviews from public, anon;

grant select, insert, update, delete on content.governance_policies to service_role;
grant select, insert, update, delete on content.approved_source_domains to service_role;
grant select, insert, update, delete on content.reviewer_qualifications to service_role;
grant select, insert, update, delete on content.lesson_requirements to service_role;
grant select, insert, update, delete on content.doctrinal_claims to service_role;
grant select, insert, update, delete on content.governance_reviews to service_role;
grant select, insert on content.validation_runs to service_role;
grant select, insert, update, delete on content.mastery_policy_overrides to service_role;
grant select on public.question_exposures, public.corrective_recommendations, public.retention_reviews to authenticated;
grant select, insert, update, delete on public.question_exposures, public.corrective_recommendations, public.retention_reviews to service_role;

revoke execute on function content.governance_findings(text, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function content.governance_findings(text, uuid, integer, boolean) to service_role;
revoke execute on function private.current_entity_version(text, uuid) from public, anon, authenticated;
revoke execute on function private.current_entity_creator(text, uuid) from public, anon, authenticated;
revoke execute on function private.validate_governance_review() from public, anon, authenticated;
revoke execute on function private.assert_governed_entity_publishable() from public, anon, authenticated;
revoke execute on function private.enforce_mastery_threshold_override() from public, anon, authenticated;
revoke execute on function private.revalidate_governed_dependency() from public, anon, authenticated;
revoke execute on function private.prevent_ordinary_unlock_relock() from public, anon, authenticated;
revoke execute on function private.create_corrective_recommendations() from public, anon, authenticated;
revoke execute on function private.seed_lesson_requirements() from public, anon, authenticated;
grant execute on all functions in schema content to service_role;
grant execute on all functions in schema private to service_role;

commit;
