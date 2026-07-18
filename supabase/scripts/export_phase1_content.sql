-- Canonical Phase 1 content export. This includes answer keys, private notes,
-- review state and version snapshots; run only with a privileged server/admin
-- database connection and protect the resulting file as sensitive data.
--
-- Example (one compact JSON document):
--   psql "$DATABASE_URL" -X -q -t -A \
--     -f supabase/scripts/export_phase1_content.sql > phase1-content.json

select jsonb_build_object(
  'format', 'apologia-sancta-phase1-content/v1',
  'generated_at', clock_timestamp(),
  'programmes', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.display_order, row_data.id)
    from content.programmes row_data
  ), '[]'::jsonb),
  'programme_prerequisites', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.programme_id, row_data.prerequisite_programme_id)
    from content.programme_prerequisites row_data
  ), '[]'::jsonb),
  'subjects', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.programme_id, row_data.display_order, row_data.id)
    from content.subjects row_data
  ), '[]'::jsonb),
  'subject_prerequisites', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.subject_id, row_data.prerequisite_subject_id)
    from content.subject_prerequisites row_data
  ), '[]'::jsonb),
  'learning_groups', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.subject_id, row_data.display_order, row_data.id)
    from content.learning_groups row_data
  ), '[]'::jsonb),
  'group_prerequisites', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.group_id, row_data.prerequisite_group_id)
    from content.group_prerequisites row_data
  ), '[]'::jsonb),
  'lessons', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.group_id, row_data.display_order, row_data.id)
    from content.lessons row_data
  ), '[]'::jsonb),
  'lesson_prerequisites', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.lesson_id, row_data.prerequisite_lesson_id)
    from content.lesson_prerequisites row_data
  ), '[]'::jsonb),
  'lesson_sections', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.lesson_id, row_data.display_order, row_data.id)
    from content.lesson_sections row_data
  ), '[]'::jsonb),
  'learning_objectives', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.lesson_id, row_data.display_order, row_data.id)
    from content.learning_objectives row_data
  ), '[]'::jsonb),
  'sources', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.slug, row_data.id)
    from content.sources row_data
  ), '[]'::jsonb),
  'questions', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.stable_key, row_data.id)
    from content.questions row_data
  ), '[]'::jsonb),
  'question_options', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.question_id, row_data.position, row_data.id)
    from content.question_options row_data
  ), '[]'::jsonb),
  'question_contexts', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.question_id, row_data.context, row_data.id)
    from content.question_contexts row_data
  ), '[]'::jsonb),
  'content_sources', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.entity_kind, row_data.entity_id, row_data.display_order, row_data.id)
    from content.content_sources row_data
  ), '[]'::jsonb),
  'content_relationships', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.from_kind, row_data.from_id, row_data.display_order, row_data.id)
    from content.content_relationships row_data
  ), '[]'::jsonb),
  'content_versions', coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.entity_kind, row_data.entity_id, row_data.version)
    from content.content_versions row_data
  ), '[]'::jsonb)
);
