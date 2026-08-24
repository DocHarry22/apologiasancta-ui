-- Durable canonical journey policy regression. Run after all migrations.
begin;

do $$
declare
  v_policy_count integer;
  v_constraint_text text;
  v_domain_constraint text;
  v_root_type text;
  v_nodes_type text;
begin
  if to_regclass('public.saved_knowledge_journeys') is null then
    raise exception 'saved_knowledge_journeys table is missing';
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'content' and t.typname = 'canonical_knowledge_id'
  ) then
    raise exception 'canonical_knowledge_id domain is missing';
  end if;

  select pg_get_constraintdef(c.oid)
    into v_domain_constraint
  from pg_constraint c
  join pg_type t on t.oid = c.contypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'content'
    and t.typname = 'canonical_knowledge_id'
    and c.contype = 'c'
  limit 1;

  if coalesce(v_domain_constraint, '') not like '%^[a-z][a-z0-9_-]*:%' then
    raise exception 'canonical ID domain constraint is incomplete: %', v_domain_constraint;
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_root_type
  from pg_attribute a
  where a.attrelid = 'public.saved_knowledge_journeys'::regclass
    and a.attname = 'root_node_id'
    and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod)
    into v_nodes_type
  from pg_attribute a
  where a.attrelid = 'public.saved_knowledge_journeys'::regclass
    and a.attname = 'node_ids'
    and not a.attisdropped;

  if v_root_type <> 'content.canonical_knowledge_id'
     or v_nodes_type <> 'content.canonical_knowledge_id[]' then
    raise exception 'saved journey canonical ID column types are incorrect: %, %', v_root_type, v_nodes_type;
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'saved_knowledge_journeys'
      and c.relrowsecurity
  ) then
    raise exception 'saved_knowledge_journeys must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.saved_knowledge_journeys', 'SELECT')
     or has_table_privilege('anon', 'public.saved_knowledge_journeys', 'INSERT')
     or has_table_privilege('anon', 'public.saved_knowledge_journeys', 'UPDATE')
     or has_table_privilege('anon', 'public.saved_knowledge_journeys', 'DELETE') then
    raise exception 'anon must not have direct saved journey table privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.saved_knowledge_journeys', 'SELECT')
     or not has_table_privilege('authenticated', 'public.saved_knowledge_journeys', 'INSERT')
     or not has_table_privilege('authenticated', 'public.saved_knowledge_journeys', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.saved_knowledge_journeys', 'DELETE') then
    raise exception 'authenticated role must have RLS-governed saved journey CRUD privileges';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'saved_knowledge_journeys'
    and policyname in (
      'saved_knowledge_journeys_select_own',
      'saved_knowledge_journeys_insert_own',
      'saved_knowledge_journeys_update_own',
      'saved_knowledge_journeys_delete_own'
    );
  if v_policy_count <> 4 then
    raise exception 'saved journey ownership policy set is incomplete: %', v_policy_count;
  end if;

  select string_agg(pg_get_constraintdef(oid), ' ')
    into v_constraint_text
  from pg_constraint
  where conrelid = 'public.saved_knowledge_journeys'::regclass;

  if v_constraint_text not like '%cardinality(node_ids)%120%'
     or v_constraint_text not like '%private%unlisted%public%' then
    raise exception 'saved journey structural constraints are incomplete';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'saved_knowledge_journeys'
      and indexname = 'saved_knowledge_journeys_share_idx'
  ) then
    raise exception 'saved journey share lookup index is missing';
  end if;
end;
$$;

rollback;
