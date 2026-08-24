begin;

-- The canonical Knowledge Engine remains a separate service/system of record.
-- These bridge tables store stable canonical identifiers only; they never copy
-- theological propositions into the learning database.

create table if not exists content.lesson_knowledge_nodes (
  lesson_id uuid not null references content.lessons(id) on delete cascade,
  node_id text not null check (node_id ~ '^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$'),
  node_revision_id text check (node_revision_id is null or node_revision_id ~ '^rev:[a-z0-9._:-]+$'),
  role text not null default 'supporting' check (role in ('primary','supporting','objection','response','evidence','prerequisite')),
  display_order integer not null default 0 check (display_order >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (lesson_id, node_id, role)
);

create index if not exists lesson_knowledge_nodes_node_idx
  on content.lesson_knowledge_nodes (node_id, lesson_id);

create table if not exists content.question_knowledge_nodes (
  question_id uuid not null references content.questions(id) on delete cascade,
  node_id text not null check (node_id ~ '^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$'),
  node_revision_id text check (node_revision_id is null or node_revision_id ~ '^rev:[a-z0-9._:-]+$'),
  role text not null default 'tested' check (role in ('tested','distractor_concept','explanation','evidence')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (question_id, node_id, role)
);

create index if not exists question_knowledge_nodes_node_idx
  on content.question_knowledge_nodes (node_id, question_id);
create index if not exists question_knowledge_nodes_tested_idx
  on content.question_knowledge_nodes (question_id, node_id)
  where role = 'tested';

create table if not exists public.learner_node_mastery (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  node_id text not null check (node_id ~ '^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$'),
  mastery_percent numeric(5,2) not null default 0 check (mastery_percent between 0 and 100),
  evidence_attempts integer not null default 0 check (evidence_attempts >= 0),
  correct_evidence integer not null default 0 check (correct_evidence >= 0 and correct_evidence <= evidence_attempts),
  last_question_id uuid references content.questions(id) on delete set null,
  last_attempt_id uuid references public.mastery_attempts(id) on delete set null,
  first_evidence_at timestamptz,
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (learner_id, node_id)
);

create index if not exists learner_node_mastery_node_idx
  on public.learner_node_mastery (node_id, mastery_percent desc);

-- Immutable evidence ledger makes attempt processing repeatable and prevents a
-- retried submission from inflating concept mastery.
create table if not exists public.learner_node_mastery_evidence (
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  attempt_id uuid not null references public.mastery_attempts(id) on delete restrict,
  question_id uuid not null references content.questions(id) on delete restrict,
  node_id text not null check (node_id ~ '^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$'),
  node_revision_id text,
  is_correct boolean not null,
  evidenced_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_id, node_id)
);

create index if not exists learner_node_mastery_evidence_learner_node_idx
  on public.learner_node_mastery_evidence (learner_id, node_id, evidenced_at desc);

create or replace function private.apply_node_mastery_from_attempt(p_attempt_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.mastery_attempt_status;
  v_learner_id uuid;
  v_submitted_at timestamptz;
  v_inserted integer := 0;
begin
  select a.status, a.learner_id, a.submitted_at
    into v_status, v_learner_id, v_submitted_at
  from public.mastery_attempts a
  where a.id = p_attempt_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'mastery attempt not found';
  end if;
  if v_status <> 'submitted' or v_submitted_at is null then
    return 0;
  end if;

  with inserted as (
    insert into public.learner_node_mastery_evidence (
      learner_id, attempt_id, question_id, node_id, node_revision_id, is_correct, evidenced_at
    )
    select
      a.learner_id,
      a.id,
      ans.question_id,
      qkn.node_id,
      qkn.node_revision_id,
      ans.is_correct,
      coalesce(a.submitted_at, ans.answered_at)
    from public.mastery_attempts a
    join public.mastery_answers ans
      on ans.attempt_id = a.id and ans.learner_id = a.learner_id
    join content.question_knowledge_nodes qkn
      on qkn.question_id = ans.question_id and qkn.role = 'tested'
    where a.id = p_attempt_id
      and a.status = 'submitted'
    on conflict (attempt_id, question_id, node_id) do nothing
    returning learner_id, node_id, question_id, attempt_id, is_correct, evidenced_at
  ), aggregated as (
    select
      learner_id,
      node_id,
      count(*)::integer as evidence_attempts,
      count(*) filter (where is_correct)::integer as correct_evidence,
      max(evidenced_at) as last_evidence_at
    from inserted
    group by learner_id, node_id
  ), latest as (
    select distinct on (i.learner_id, i.node_id)
      i.learner_id, i.node_id, i.question_id, i.attempt_id
    from inserted i
    order by i.learner_id, i.node_id, i.evidenced_at desc, i.question_id
  ), upserted as (
    insert into public.learner_node_mastery (
      learner_id, node_id, mastery_percent, evidence_attempts, correct_evidence,
      last_question_id, last_attempt_id, first_evidence_at, last_evidence_at, updated_at
    )
    select
      ag.learner_id,
      ag.node_id,
      round((ag.correct_evidence::numeric * 100.0) / greatest(ag.evidence_attempts, 1), 2),
      ag.evidence_attempts,
      ag.correct_evidence,
      l.question_id,
      l.attempt_id,
      ag.last_evidence_at,
      ag.last_evidence_at,
      clock_timestamp()
    from aggregated ag
    join latest l using (learner_id, node_id)
    on conflict (learner_id, node_id) do update set
      evidence_attempts = public.learner_node_mastery.evidence_attempts + excluded.evidence_attempts,
      correct_evidence = public.learner_node_mastery.correct_evidence + excluded.correct_evidence,
      mastery_percent = round(
        ((public.learner_node_mastery.correct_evidence + excluded.correct_evidence)::numeric * 100.0)
        / greatest(public.learner_node_mastery.evidence_attempts + excluded.evidence_attempts, 1),
        2
      ),
      last_question_id = excluded.last_question_id,
      last_attempt_id = excluded.last_attempt_id,
      first_evidence_at = coalesce(public.learner_node_mastery.first_evidence_at, excluded.first_evidence_at),
      last_evidence_at = greatest(public.learner_node_mastery.last_evidence_at, excluded.last_evidence_at),
      updated_at = clock_timestamp()
    returning 1
  )
  select count(*)::integer into v_inserted from inserted;

  return v_inserted;
end;
$$;

create or replace function private.mastery_attempt_node_mastery_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.apply_node_mastery_from_attempt(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists mastery_attempt_apply_node_mastery on public.mastery_attempts;
create trigger mastery_attempt_apply_node_mastery
after insert or update of status on public.mastery_attempts
for each row execute function private.mastery_attempt_node_mastery_trigger();

alter table public.learner_node_mastery enable row level security;
alter table public.learner_node_mastery_evidence enable row level security;

-- Learners may inspect their own derived mastery but may not manufacture or
-- edit assessment evidence from the client. Server-side governed attempt
-- processing owns all writes.
drop policy if exists learner_node_mastery_select_own on public.learner_node_mastery;
create policy learner_node_mastery_select_own
  on public.learner_node_mastery
  for select
  to authenticated
  using (exists (
    select 1 from public.learner_profiles lp
    where lp.id = learner_node_mastery.learner_id
      and lp.auth_user_id = (select auth.uid())
  ));

drop policy if exists learner_node_mastery_evidence_select_own on public.learner_node_mastery_evidence;
create policy learner_node_mastery_evidence_select_own
  on public.learner_node_mastery_evidence
  for select
  to authenticated
  using (exists (
    select 1 from public.learner_profiles lp
    where lp.id = learner_node_mastery_evidence.learner_id
      and lp.auth_user_id = (select auth.uid())
  ));

revoke insert, update, delete on public.learner_node_mastery from anon, authenticated;
revoke insert, update, delete on public.learner_node_mastery_evidence from anon, authenticated;
grant select on public.learner_node_mastery to authenticated;
grant select on public.learner_node_mastery_evidence to authenticated;

comment on table content.lesson_knowledge_nodes is 'Canonical Knowledge Engine references used by lessons; theological content remains in the Knowledge Engine.';
comment on table content.question_knowledge_nodes is 'Canonical Knowledge Engine concepts tested/explained by governed questions.';
comment on table public.learner_node_mastery is 'Derived concept mastery from submitted governed assessments; not client writable.';
comment on function private.apply_node_mastery_from_attempt(uuid) is 'Idempotently derives canonical-node mastery from stored mastery_answers and tested-node mappings.';

commit;
