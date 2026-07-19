-- Reverses only objects created by 20260717175144_phase1_learning_foundation.sql.
-- Take a backup first. This intentionally destroys Phase 1 content and learner data.

begin;

drop function if exists public.submit_mastery_attempt(uuid, uuid, text, jsonb);
drop function if exists public.start_mastery_attempt(uuid, uuid, text, integer);

drop view if exists public.review_recommendations;

drop view if exists content.invalid_live_question_configurations;
drop view if exists content.published_live_question_feed;
drop view if exists content.published_catalogue_feed;
drop view if exists content.published_content_relationships;
drop view if exists content.published_lesson_prerequisites;
drop view if exists content.published_group_prerequisites;
drop view if exists content.published_subject_prerequisites;
drop view if exists content.published_programme_prerequisites;
drop view if exists content.published_content_sources;
drop view if exists content.published_question_contexts;
drop view if exists content.published_question_options;
drop view if exists content.published_questions;
drop view if exists content.published_sources;
drop view if exists content.published_learning_objectives;
drop view if exists content.published_lesson_sections;
drop view if exists content.published_lessons;
drop view if exists content.published_learning_groups;
drop view if exists content.published_subjects;
drop view if exists content.published_programmes;

drop table if exists game.leaderboard_entries;
drop table if exists game.player_answers;
drop table if exists game.session_questions;
drop table if exists game.sessions;
drop table if exists game.room_participants;
drop table if exists game.rooms;

drop table if exists public.question_metrics;
drop table if exists public.review_schedule;
drop table if exists public.group_progress;
drop table if exists public.unlocks;
drop table if exists public.mastery_answers;
drop table if exists public.mastery_attempt_questions;
drop table if exists public.mastery_attempts;
drop table if exists public.bookmarks;
drop table if exists public.lesson_progress;
drop table if exists public.learner_profiles;

drop table if exists content.audit_log;
drop table if exists content.content_versions;
drop table if exists content.content_relationships;
drop table if exists content.content_sources;
drop table if exists content.question_contexts;
drop table if exists content.question_options;
drop table if exists content.questions;
drop table if exists content.sources;
drop table if exists content.learning_objectives;
drop table if exists content.lesson_sections;
drop table if exists content.lesson_prerequisites;
drop table if exists content.lessons;
drop table if exists content.group_prerequisites;
drop table if exists content.learning_groups;
drop table if exists content.subject_prerequisites;
drop table if exists content.subjects;
drop table if exists content.programme_prerequisites;
drop table if exists content.programmes;

drop function if exists private.submit_mastery_attempt(uuid, uuid, text, jsonb);
drop function if exists private.start_mastery_attempt(uuid, uuid, text, integer);
drop function if exists private.mastery_attempt_payload(uuid);
drop function if exists private.learner_group_is_eligible(uuid, uuid);
drop function if exists private.group_requirement_met(uuid, uuid, content.prerequisite_requirement, numeric);
drop function if exists private.owns_learner(uuid);
drop function if exists private.content_entity_is_visible(content.entity_kind, uuid, boolean);
drop function if exists private.prevent_prerequisite_cycle();
drop function if exists private.audit_content_row();
drop function if exists private.prevent_published_delete();
drop function if exists private.enforce_publication_workflow();
drop function if exists private.validate_bookmark_section();
drop function if exists private.prevent_question_context_overlap();
drop function if exists private.validate_question_context_hierarchy();
drop function if exists private.validate_question_hierarchy();
drop function if exists private.validate_section_parent();
drop function if exists private.assert_content_entity_reference();
drop function if exists private.content_entity_exists(content.entity_kind, uuid);
drop function if exists private.assert_learner_access(uuid);
drop function if exists private.request_role();
drop function if exists private.current_actor_id();
drop function if exists private.touch_updated_at();

drop type if exists public.mastery_attempt_status;
drop type if exists public.lesson_progress_state;

drop type if exists content.question_retirement_status;
drop type if exists content.question_context_kind;
drop type if exists content.question_kind;
drop type if exists content.entity_kind;
drop type if exists content.block_kind;
drop type if exists content.prerequisite_requirement;
drop type if exists content.content_visibility;
drop type if exists content.review_status;
drop type if exists content.publication_status;

drop schema if exists game;
drop schema if exists private;
drop schema if exists content;

commit;
