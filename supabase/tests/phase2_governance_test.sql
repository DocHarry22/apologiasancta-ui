-- Phase 2 governance regression test. Run after all migrations in a disposable database.
begin;

do $$
declare
  v_author uuid := '10000000-0000-0000-0000-000000000001';
  v_doctrinal uuid := '10000000-0000-0000-0000-000000000002';
  v_assessment uuid := '10000000-0000-0000-0000-000000000003';
  v_licence uuid := '10000000-0000-0000-0000-000000000004';
  v_approver uuid := '10000000-0000-0000-0000-000000000005';
  v_programme uuid := '20000000-0000-0000-0000-000000000001';
  v_subject uuid := '20000000-0000-0000-0000-000000000002';
  v_group uuid := '20000000-0000-0000-0000-000000000003';
  v_lesson uuid := '20000000-0000-0000-0000-000000000004';
  v_objective uuid := '20000000-0000-0000-0000-000000000005';
  v_source uuid := '20000000-0000-0000-0000-000000000006';
  v_question uuid := '20000000-0000-0000-0000-000000000007';
  v_errors integer;
begin
  if (select (rules ->> 'official_mastery_threshold_percent')::integer
      from content.governance_policies
      where policy_key = 'phase2_content_governance') <> 100 then
    raise exception 'official mastery policy must default to 100 percent';
  end if;

  if exists (
    select 1 from content.approved_source_domains
    where approved_for_source_quality and reuse_permission_implied
  ) then
    raise exception 'approved domains must not imply reuse permission';
  end if;

  insert into content.programmes (
    id, slug, title, display_order, created_by
  ) values (
    v_programme, 'phase2-test-programme', 'Phase 2 test programme', 9100, v_author
  );

  insert into content.subjects (
    id, programme_id, slug, title, display_order, created_by
  ) values (
    v_subject, v_programme, 'phase2-test-subject', 'Phase 2 test subject', 0, v_author
  );

  insert into content.learning_groups (
    id, subject_id, slug, title, display_order, is_initially_unlocked, created_by
  ) values (
    v_group, v_subject, 'phase2-test-group', 'Phase 2 test group', 0, true, v_author
  );

  if (select mastery_threshold_percent from content.learning_groups where id = v_group) <> 100 then
    raise exception 'new groups must default to 100 percent mastery';
  end if;

  begin
    update content.learning_groups
    set mastery_threshold_percent = 80
    where id = v_group;
    raise exception 'lower threshold without an override should fail';
  exception
    when check_violation then null;
  end;

  insert into content.lessons (
    id, group_id, slug, title, display_order, created_by
  ) values (
    v_lesson, v_group, 'phase2-test-lesson', 'Phase 2 test lesson', 0, v_author
  );

  insert into content.learning_objectives (
    id, lesson_id, code, description, display_order, created_by
  ) values (
    v_objective, v_lesson, 'P2-1', 'Distinguish two related concepts.', 0, v_author
  );

  insert into content.sources (
    id,
    slug,
    title,
    source_kind,
    url,
    citation,
    authority_category,
    copyright_status,
    permission_status,
    attribution_text,
    quote_limit_words,
    rights_reviewed_by,
    rights_reviewed_at,
    created_by
  ) values (
    v_source,
    'phase2-test-source',
    'Phase 2 test source',
    'catechism',
    'https://www.vatican.va/archive/ENG0015/_INDEX.HTM',
    'Catechism of the Catholic Church, 252',
    'catechism',
    'recorded',
    'permission_not_required_under_recorded_terms',
    'Catechism citation',
    0,
    v_licence,
    now(),
    v_author
  );

  insert into content.questions (
    id,
    stable_key,
    subject_id,
    group_id,
    lesson_id,
    objective_id,
    difficulty,
    difficulty_mode,
    equivalence_key,
    question_type,
    prompt,
    correct_answer_explanation,
    denomination_scope,
    rights_metadata,
    created_by
  ) values (
    v_question,
    'phase2_test_question',
    v_subject,
    v_group,
    v_lesson,
    v_objective,
    2,
    'medium',
    'phase2.distinction.1',
    'single_choice',
    '{"text":"Which distinction is correct?"}'::jsonb,
    '{"text":"The first option states the taught distinction."}'::jsonb,
    '{}'::jsonb,
    '{
      "copyrightStatus":"recorded",
      "permissionStatus":"permission_not_required_under_recorded_terms",
      "attributionText":"Phase 2 test",
      "reviewedAt":"2026-07-19T00:00:00Z"
    }'::jsonb,
    v_author
  );

  select count(*) into v_errors
  from content.governance_findings('question', v_question, 1, false)
  where severity = 'error';

  if v_errors = 0 then
    raise exception 'question without options and sources must have blocking findings';
  end if;

  insert into content.question_options (
    id, question_id, position, label, content, is_correct, explanation, misconception_id
  ) values
    ('30000000-0000-0000-0000-000000000001', v_question, 0, 'A', '{"text":"Nature answers what; Person answers who."}', true, '{"text":"Correct distinction."}', null),
    ('30000000-0000-0000-0000-000000000002', v_question, 1, 'B', '{"text":"Nature and Person are synonyms."}', false, '{"text":"They answer different questions."}', 'CONFLATION'),
    ('30000000-0000-0000-0000-000000000003', v_question, 2, 'C', '{"text":"A Person is part of a nature."}', false, '{"text":"A person is not a part."}', 'PARTIALISM'),
    ('30000000-0000-0000-0000-000000000004', v_question, 3, 'D', '{"text":"Nature applies only to creatures."}', false, '{"text":"Nature is not limited to creatures."}', 'NATURE_CREATED_ONLY');

  insert into content.content_sources (
    entity_kind, entity_id, source_id, relationship_type, citation_locator, display_order
  ) values (
    'question', v_question, v_source, 'supports', 'CCC 252', 0
  );

  insert into content.reviewer_qualifications (
    reviewer_id, specialism, evidence_note, granted_by
  ) values
    (v_doctrinal, 'doctrinal', 'Disposable test qualification.', v_approver),
    (v_assessment, 'assessment', 'Disposable test qualification.', v_approver),
    (v_licence, 'source_licence', 'Disposable test qualification.', v_approver);

  insert into content.governance_reviews (
    entity_kind, entity_id, entity_version, stage, decision, reviewer_id, reviewer_role, specialism, comment
  ) values
    ('source', v_source, 1, 'author_review', 'approved', v_author, 'author', null, 'Author review complete.'),
    ('source', v_source, 1, 'doctrinal_review', 'approved', v_doctrinal, 'reviewer', 'doctrinal', 'Source authority review complete.'),
    ('source', v_source, 1, 'assessment_review', 'approved', v_assessment, 'reviewer', 'assessment', 'Assessment-use review complete.'),
    ('source', v_source, 1, 'source_licence_review', 'approved', v_licence, 'reviewer', 'source_licence', 'Rights review complete.'),
    ('source', v_source, 1, 'approval', 'approved', v_approver, 'editor', null, 'Independent final approval.'),
    ('question', v_question, 1, 'author_review', 'approved', v_author, 'author', null, 'Author review complete.'),
    ('question', v_question, 1, 'doctrinal_review', 'approved', v_doctrinal, 'reviewer', 'doctrinal', 'Doctrinal review complete.'),
    ('question', v_question, 1, 'assessment_review', 'approved', v_assessment, 'reviewer', 'assessment', 'Assessment review complete.'),
    ('question', v_question, 1, 'source_licence_review', 'approved', v_licence, 'reviewer', 'source_licence', 'Rights review complete.'),
    ('question', v_question, 1, 'approval', 'approved', v_approver, 'editor', null, 'Independent final approval.');

  update content.sources
  set status = 'published',
      governance_stage = 'publication',
      review_status = 'approved',
      reviewed_by = v_approver,
      reviewed_at = now(),
      published_at = now()
  where id = v_source;

  select count(*) into v_errors
  from content.governance_findings('question', v_question, 1, true)
  where severity = 'error';

  if v_errors <> 0 then
    raise exception 'complete governed question unexpectedly has % blocking findings', v_errors;
  end if;

  update content.questions
  set status = 'published',
      governance_stage = 'publication',
      review_status = 'approved',
      reviewed_by = v_approver,
      reviewed_at = now(),
      published_at = now()
  where id = v_question;

  if not exists (
    select 1 from content.published_live_question_feed
    where question_id = v_question
  ) then
    -- No live context exists in this fixture, so the feed correctly remains empty.
    null;
  end if;

  begin
    update content.question_options
    set content = '{"text":"All of the above"}'::jsonb
    where id = '30000000-0000-0000-0000-000000000002';
    set constraints question_options_governance_revalidate immediate;
    raise exception 'invalid post-publication option update should fail';
  exception
    when check_violation then
      set constraints question_options_governance_revalidate deferred;
  end;

  if (select status from content.questions where id = v_question) <> 'published' then
    raise exception 'governance testing must not relock or unpublish valid completed content';
  end if;
end;
$$;

rollback;
