begin;

revoke execute on function public.start_mastery_attempt(uuid, uuid, text, integer) from public;
revoke execute on function public.start_mastery_attempt(uuid, uuid, text, integer) from anon;
revoke execute on function public.start_mastery_attempt(uuid, uuid, text, integer) from authenticated;
revoke execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) from public;
revoke execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) from anon;
revoke execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) from authenticated;

grant execute on function public.start_mastery_attempt(uuid, uuid, text, integer) to authenticated, service_role;
grant execute on function public.submit_mastery_attempt(uuid, uuid, text, jsonb) to authenticated, service_role;

commit;
