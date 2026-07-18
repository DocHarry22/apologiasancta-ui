-- Run after the foundation migration and phase1_minimal.sql fixture.
-- The script raises on failure and is safe to run repeatedly in a disposable DB.

begin;

insert into public.learner_profiles (
  id, identity_provider, external_subject, display_name
) values
  (
    'c0000000-0000-4000-8000-000000000001',
    'phase1_test',
    'successful-learner',
    'Successful Test Learner'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'phase1_test',
    'unsuccessful-learner',
    'Unsuccessful Test Learner'
  )
on conflict (id) do update set
  display_name = excluded.display_name;

do $test_mastery$
declare
  v_start jsonb;
  v_start_replay jsonb;
  v_result jsonb;
  v_result_replay jsonb;
  v_failed_start jsonb;
  v_failed_result jsonb;
  v_attempt_id uuid;
  v_failed_attempt_id uuid;
  v_metric_count bigint;
begin
  v_start := public.start_mastery_attempt(
    'c0000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'phase1-success-start',
    1
  );
  v_start_replay := public.start_mastery_attempt(
    'c0000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'phase1-success-start',
    1
  );

  if v_start is distinct from v_start_replay then
    raise exception 'start_mastery_attempt is not idempotent';
  end if;
  if v_start::text like '%is_correct%'
    or v_start::text like '%correct_option_ids%'
    or v_start::text like '%explanation%' then
    raise exception 'initial mastery payload leaks answer data';
  end if;

  v_attempt_id := (v_start ->> 'attempt_id')::uuid;
  v_result := public.submit_mastery_attempt(
    'c0000000-0000-4000-8000-000000000001',
    v_attempt_id,
    'phase1-success-submit',
    jsonb_build_array(jsonb_build_object(
      'question_id', '80000000-0000-4000-8000-000000000001',
      'selected_option_ids', jsonb_build_array('90000000-0000-4000-8000-000000000001')
    ))
  );
  v_result_replay := public.submit_mastery_attempt(
    'c0000000-0000-4000-8000-000000000001',
    v_attempt_id,
    'phase1-success-submit',
    jsonb_build_array(jsonb_build_object(
      'question_id', '80000000-0000-4000-8000-000000000001',
      'selected_option_ids', jsonb_build_array('90000000-0000-4000-8000-000000000001')
    ))
  );

  if v_result is distinct from v_result_replay then
    raise exception 'submit_mastery_attempt is not idempotent';
  end if;
  if (v_result ->> 'mastered')::boolean is not true then
    raise exception 'correct server-scored attempt did not master the group';
  end if;
  if not exists (
    select 1 from public.unlocks
    where learner_id = 'c0000000-0000-4000-8000-000000000001'
      and group_id = '30000000-0000-4000-8000-000000000002'
      and unlocked_by_attempt_id = v_attempt_id
  ) then
    raise exception 'successful mastery did not unlock the dependent group';
  end if;

  v_failed_start := public.start_mastery_attempt(
    'c0000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'phase1-failed-start',
    1
  );
  v_failed_attempt_id := (v_failed_start ->> 'attempt_id')::uuid;
  v_failed_result := public.submit_mastery_attempt(
    'c0000000-0000-4000-8000-000000000002',
    v_failed_attempt_id,
    'phase1-failed-submit',
    jsonb_build_array(jsonb_build_object(
      'question_id', '80000000-0000-4000-8000-000000000001',
      'selected_option_ids', jsonb_build_array('90000000-0000-4000-8000-000000000002')
    ))
  );

  if (v_failed_result ->> 'mastered')::boolean is not false then
    raise exception 'incorrect server-scored attempt unexpectedly mastered the group';
  end if;
  if exists (
    select 1 from public.unlocks
    where learner_id = 'c0000000-0000-4000-8000-000000000002'
      and group_id = '30000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'failed mastery unexpectedly unlocked the dependent group';
  end if;

  select attempt_count into v_metric_count
  from public.question_metrics
  where question_id = '80000000-0000-4000-8000-000000000001';
  if v_metric_count <> 2 then
    raise exception 'idempotent replay changed question metrics: %', v_metric_count;
  end if;
end;
$test_mastery$;

do $test_constraints$
begin
  begin
    insert into content.group_prerequisites (
      group_id, prerequisite_group_id, requirement
    ) values (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'mastery'
    );
    raise exception 'prerequisite cycle was accepted';
  exception
    when check_violation then null;
  end;

  insert into content.programmes (
    id, slug, title, display_order, status, visibility, review_status
  ) values (
    'd0000000-0000-4000-8000-000000000001',
    'phase1-draft-hidden-check',
    'Draft Exclusion Check',
    9901,
    'draft',
    'public',
    'unreviewed'
  ) on conflict (id) do nothing;

  if exists (
    select 1 from content.published_programmes
    where id = 'd0000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'draft content appeared in a published view';
  end if;

  begin
    insert into content.question_contexts (
      id, question_id, context, subject_id, group_id, lesson_id, enabled
    ) values (
      'a0000000-0000-4000-8000-000000000003',
      '80000000-0000-4000-8000-000000000001',
      'group_practice',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      true
    );
    raise exception 'practice/mastery context overlap was accepted on insert';
  exception
    when check_violation then null;
  end;

  insert into content.question_contexts (
    id, question_id, context, subject_id, group_id, lesson_id, enabled
  ) values (
    'a0000000-0000-4000-8000-000000000004',
    '80000000-0000-4000-8000-000000000001',
    'lesson_practice',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    false
  ) on conflict (id) do update set enabled = false;

  begin
    update content.question_contexts
    set enabled = true
    where id = 'a0000000-0000-4000-8000-000000000004';
    raise exception 'practice/mastery context overlap was accepted on update';
  exception
    when check_violation then null;
  end;

  if exists (
    select 1 from content.published_questions
    where id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'official mastery-only question appeared in public practice view';
  end if;
  if not exists (
    select 1 from content.published_questions
    where id = '80000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'public practice-only question is missing from public practice view';
  end if;

  update content.programmes
  set visibility = 'authenticated'
  where id = '10000000-0000-4000-8000-000000000001';
  if exists (
    select 1 from content.published_programmes
    where id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'owner-bypass view exposed authenticated programme';
  end if;
  update content.programmes
  set visibility = 'public'
  where id = '10000000-0000-4000-8000-000000000001';

  update content.subjects
  set visibility = 'hidden'
  where id = '20000000-0000-4000-8000-000000000001';
  if exists (
    select 1 from content.published_learning_groups
    where id = '30000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'published group ignored hidden ancestor visibility';
  end if;
  update content.subjects
  set visibility = 'public'
  where id = '20000000-0000-4000-8000-000000000001';

  update content.learning_groups
  set visibility = 'locked'
  where id = '30000000-0000-4000-8000-000000000001';
  if not exists (
    select 1 from content.published_learning_groups
    where id = '30000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'locked group metadata is missing from hierarchy preview';
  end if;
  if exists (
    select 1 from content.published_lesson_sections
    where id = '50000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'locked ancestor exposed lesson section content';
  end if;
  update content.learning_groups
  set visibility = 'public'
  where id = '30000000-0000-4000-8000-000000000001';

  if not exists (
    select 1 from content.published_live_question_feed
    where question_id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'valid four-option fixture is missing from live feed';
  end if;

  update content.question_options
  set enabled = false
  where id = '90000000-0000-4000-8000-000000000004';
  if exists (
    select 1 from content.published_live_question_feed
    where question_id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'live feed accepted a question with fewer than four enabled options';
  end if;
  if not exists (
    select 1 from content.invalid_live_question_configurations
    where question_id = '80000000-0000-4000-8000-000000000001'
      and 'enabled_option_count_must_equal_4' = any(reasons)
  ) then
    raise exception 'invalid live option count was not diagnosed';
  end if;
  update content.question_options
  set enabled = true
  where id = '90000000-0000-4000-8000-000000000004';

  update content.question_options
  set is_correct = true
  where id = '90000000-0000-4000-8000-000000000002';
  if exists (
    select 1 from content.published_live_question_feed
    where question_id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'live feed accepted multiple correct options';
  end if;
  update content.question_options
  set is_correct = false
  where id = '90000000-0000-4000-8000-000000000002';

  update content.questions
  set question_type = 'multiple_choice'
  where id = '80000000-0000-4000-8000-000000000001';
  if exists (
    select 1 from content.published_live_question_feed
    where question_id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'live feed accepted unsupported multiple-choice item';
  end if;
  update content.questions
  set question_type = 'single_choice'
  where id = '80000000-0000-4000-8000-000000000001';
end;
$test_constraints$;

commit;

set role anon;

do $test_anon_access$
declare
  v_count integer;
begin
  select count(*) into v_count from content.published_programmes;
  if v_count < 1 then
    raise exception 'anon cannot read published catalogue';
  end if;

  begin
    perform is_correct from content.question_options limit 1;
    raise exception 'anon can read raw answer keys';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform * from content.published_live_question_feed limit 1;
    raise exception 'anon can read service-only live answer feed';
  exception
    when insufficient_privilege then null;
  end;
end;
$test_anon_access$;

reset role;

insert into auth.users (id) values (
  'e0000000-0000-4000-8000-000000000001'
) on conflict (id) do nothing;

insert into public.learner_profiles (
  id, auth_user_id, identity_provider, display_name
) values (
  'e1000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'supabase',
  'Authenticated RLS Learner'
) on conflict (id) do update set
  auth_user_id = excluded.auth_user_id,
  display_name = excluded.display_name;

select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

do $test_authenticated_access$
declare
  v_profile_count integer;
  v_start jsonb;
begin
  select count(*) into v_profile_count from public.learner_profiles;
  if v_profile_count <> 1 then
    raise exception 'authenticated learner profile RLS returned % rows', v_profile_count;
  end if;

  v_start := public.start_mastery_attempt(
    'e1000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'phase1-authenticated-start',
    1
  );
  if v_start::text like '%is_correct%' then
    raise exception 'authenticated initial payload leaks answer key';
  end if;
end;
$test_authenticated_access$;

reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'service_role', false);
set role service_role;

do $test_service_feed$
declare
  v_has_correct boolean;
  v_option_count integer;
  v_correct_count integer;
begin
  select
    (options -> 0 ? 'is_correct'),
    jsonb_array_length(options),
    (
      select count(*)::integer
      from jsonb_array_elements(options) option_item
      where (option_item ->> 'is_correct')::boolean
    )
  into v_has_correct, v_option_count, v_correct_count
  from content.published_live_question_feed
  where question_id = '80000000-0000-4000-8000-000000000001'
  limit 1;
  if v_has_correct is not true then
    raise exception 'service-only live feed is missing its answer key';
  end if;
  if v_option_count <> 4 or v_correct_count <> 1 then
    raise exception 'live feed contract expected 4 enabled options and exactly 1 correct';
  end if;
end;
$test_service_feed$;

reset role;

select 'phase1_foundation_test_ok' as result;
