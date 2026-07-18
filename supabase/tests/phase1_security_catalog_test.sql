-- Catalog-level security assertions for the Phase 1 foundation.

do $security_catalog$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('content', 'game')
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;
  if v_count <> 0 then
    raise exception '% content/game tables do not have RLS enabled', v_count;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'learner_profiles', 'lesson_progress', 'bookmarks', 'mastery_attempts',
      'mastery_attempt_questions', 'mastery_answers', 'unlocks',
      'group_progress', 'review_schedule', 'question_metrics'
    )
    and not c.relrowsecurity;
  if v_count <> 0 then
    raise exception '% Phase 1 public tables do not have RLS enabled', v_count;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'content'
    and c.relkind = 'v'
    and c.relname like 'published_%'
    and not coalesce(c.reloptions @> array['security_invoker=true'], false);
  if v_count <> 0 then
    raise exception '% published views are not security_invoker', v_count;
  end if;

  if has_column_privilege('anon', 'content.question_options', 'is_correct', 'select')
    or has_column_privilege('authenticated', 'content.question_options', 'is_correct', 'select')
    or has_column_privilege('anon', 'content.questions', 'correct_answer_explanation', 'select')
    or has_column_privilege('authenticated', 'content.questions', 'private_notes', 'select') then
    raise exception 'public roles have direct answer-key or private-note column access';
  end if;

  if has_table_privilege('anon', 'content.published_live_question_feed', 'select')
    or has_table_privilege('authenticated', 'content.published_live_question_feed', 'select')
    or has_table_privilege('anon', 'content.invalid_live_question_configurations', 'select')
    or has_table_privilege('authenticated', 'content.invalid_live_question_configurations', 'select') then
    raise exception 'public roles can read a service-only live view';
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname in ('content', 'public', 'private', 'game')
    and (
      n.nspname <> 'private'
      or not coalesce(p.proconfig @> array['search_path=""'], false)
    );
  if v_count <> 0 then
    raise exception '% security-definer functions are exposed or have an unsafe search_path', v_count;
  end if;

  if has_function_privilege('anon', 'private.start_mastery_attempt(uuid,uuid,text,integer)', 'execute')
    or has_function_privilege('anon', 'private.submit_mastery_attempt(uuid,uuid,text,jsonb)', 'execute')
    or has_function_privilege('anon', 'public.start_mastery_attempt(uuid,uuid,text,integer)', 'execute')
    or has_function_privilege('anon', 'public.submit_mastery_attempt(uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'anon can execute mastery functions';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'content'
      and c.relname = 'question_contexts'
      and t.tgname = 'question_contexts_no_practice_mastery_overlap'
      and t.tgconstraint <> 0
      and t.tgdeferrable
  ) then
    raise exception 'practice/mastery overlap constraint trigger is missing or not deferrable';
  end if;
end;
$security_catalog$;

select 'phase1_security_catalog_test_ok' as result;
