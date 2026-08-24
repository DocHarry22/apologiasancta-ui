begin;

-- Durable user-owned canonical argument journeys. The Knowledge Engine remains
-- authoritative for propositions and relationships; this table stores only
-- canonical identifiers and user navigation metadata.
--
-- A domain enforces the canonical ID grammar for both the root and every array
-- element, including direct Data API writes that bypass application validators.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'content' and t.typname = 'canonical_knowledge_id'
  ) then
    execute $domain$
      create domain content.canonical_knowledge_id as text
      check (value ~ '^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$')
    $domain$;
  end if;
end;
$$;

create table if not exists public.saved_knowledge_journeys (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  root_node_id content.canonical_knowledge_id not null,
  node_ids content.canonical_knowledge_id[] not null check (cardinality(node_ids) between 1 and 120),
  lens text not null default 'catholic' check (lens ~ '^[a-z0-9_-]{1,80}$'),
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  share_token uuid not null default gen_random_uuid() unique,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_knowledge_journeys_owner_updated_idx
  on public.saved_knowledge_journeys (learner_id, updated_at desc);
create index if not exists saved_knowledge_journeys_root_idx
  on public.saved_knowledge_journeys (root_node_id, learner_id);
create index if not exists saved_knowledge_journeys_share_idx
  on public.saved_knowledge_journeys (share_token)
  where visibility in ('unlisted','public');

alter table public.saved_knowledge_journeys enable row level security;

-- Data API access is explicit and least-privilege. Anonymous callers never get
-- direct table access; the application exposes shared journeys only through a
-- bounded server route that checks visibility and the opaque token.
revoke all on table public.saved_knowledge_journeys from anon;
grant select, insert, update, delete on table public.saved_knowledge_journeys to authenticated;

-- Authenticated users may access only journeys owned by their learner profile.
drop policy if exists saved_knowledge_journeys_select_own on public.saved_knowledge_journeys;
create policy saved_knowledge_journeys_select_own
  on public.saved_knowledge_journeys
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = saved_knowledge_journeys.learner_id
        and lp.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists saved_knowledge_journeys_insert_own on public.saved_knowledge_journeys;
create policy saved_knowledge_journeys_insert_own
  on public.saved_knowledge_journeys
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = saved_knowledge_journeys.learner_id
        and lp.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists saved_knowledge_journeys_update_own on public.saved_knowledge_journeys;
create policy saved_knowledge_journeys_update_own
  on public.saved_knowledge_journeys
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = saved_knowledge_journeys.learner_id
        and lp.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = saved_knowledge_journeys.learner_id
        and lp.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists saved_knowledge_journeys_delete_own on public.saved_knowledge_journeys;
create policy saved_knowledge_journeys_delete_own
  on public.saved_knowledge_journeys
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.learner_profiles lp
      where lp.id = saved_knowledge_journeys.learner_id
        and lp.auth_user_id = (select auth.uid())
    )
  );

comment on domain content.canonical_knowledge_id is
  'Canonical Knowledge Engine identifier grammar used by integration-only reference columns.';
comment on table public.saved_knowledge_journeys is
  'User-owned canonical Knowledge Engine traversal paths. Stores IDs/navigation metadata only; canonical theological content remains in the Knowledge Engine.';
comment on column public.saved_knowledge_journeys.share_token is
  'Opaque token used by the application server for unlisted/public share URLs. Direct anonymous table access is revoked.';

commit;
