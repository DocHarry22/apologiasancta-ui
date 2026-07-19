begin;

drop policy if exists learner_profiles_select_own on public.learner_profiles;
create policy learner_profiles_select_own
  on public.learner_profiles
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists learner_profiles_insert_own on public.learner_profiles;
create policy learner_profiles_insert_own
  on public.learner_profiles
  for insert
  to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists learner_profiles_update_own on public.learner_profiles;
create policy learner_profiles_update_own
  on public.learner_profiles
  for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create index if not exists content_sources_source_id_idx on content.content_sources (source_id);
create index if not exists group_prerequisites_prerequisite_group_id_idx on content.group_prerequisites (prerequisite_group_id);
create index if not exists lesson_prerequisites_prerequisite_lesson_id_idx on content.lesson_prerequisites (prerequisite_lesson_id);
create index if not exists lesson_sections_parent_section_id_idx on content.lesson_sections (parent_section_id);
create index if not exists programme_prerequisites_prerequisite_programme_id_idx on content.programme_prerequisites (prerequisite_programme_id);
create index if not exists question_contexts_group_id_idx on content.question_contexts (group_id);
create index if not exists question_contexts_lesson_id_idx on content.question_contexts (lesson_id);
create index if not exists question_contexts_programme_id_idx on content.question_contexts (programme_id);
create index if not exists question_contexts_subject_id_idx on content.question_contexts (subject_id);
create index if not exists questions_group_id_idx on content.questions (group_id);
create index if not exists questions_objective_id_idx on content.questions (objective_id);
create index if not exists subject_prerequisites_prerequisite_subject_id_idx on content.subject_prerequisites (prerequisite_subject_id);
create index if not exists leaderboard_entries_participant_id_idx on game.leaderboard_entries (participant_id);
create index if not exists room_participants_learner_id_idx on game.room_participants (learner_id);
create index if not exists session_questions_question_id_idx on game.session_questions (question_id);
create index if not exists bookmarks_lesson_id_idx on public.bookmarks (lesson_id);
create index if not exists bookmarks_section_id_idx on public.bookmarks (section_id);
create index if not exists group_progress_group_id_idx on public.group_progress (group_id);
create index if not exists group_progress_mastered_attempt_id_idx on public.group_progress (mastered_attempt_id);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index if not exists mastery_answers_attempt_id_learner_id_idx on public.mastery_answers (attempt_id, learner_id);
create index if not exists mastery_answers_learner_id_idx on public.mastery_answers (learner_id);
create index if not exists mastery_answers_question_id_idx on public.mastery_answers (question_id);
create index if not exists mastery_attempt_questions_question_id_idx on public.mastery_attempt_questions (question_id);
create index if not exists mastery_attempts_group_id_idx on public.mastery_attempts (group_id);
create index if not exists review_schedule_question_id_idx on public.review_schedule (question_id);
create index if not exists unlocks_group_id_idx on public.unlocks (group_id);
create index if not exists unlocks_unlocked_by_attempt_id_idx on public.unlocks (unlocked_by_attempt_id);

commit;
