begin;

drop trigger if exists mastery_attempt_apply_node_mastery on public.mastery_attempts;
drop function if exists private.mastery_attempt_node_mastery_trigger();
drop function if exists private.apply_node_mastery_from_attempt(uuid);

drop policy if exists learner_node_mastery_evidence_select_own on public.learner_node_mastery_evidence;
drop policy if exists learner_node_mastery_select_own on public.learner_node_mastery;

drop table if exists public.learner_node_mastery_evidence;
drop table if exists public.learner_node_mastery;
drop table if exists content.question_knowledge_nodes;
drop table if exists content.lesson_knowledge_nodes;

commit;
