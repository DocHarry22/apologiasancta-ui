begin;

revoke execute on function public.start_mastery_attempt(uuid, uuid) from public;
revoke execute on function public.start_mastery_attempt(uuid, uuid) from anon;
revoke execute on function public.start_mastery_attempt(uuid, uuid) from authenticated;
revoke execute on function public.submit_mastery_attempt(uuid, jsonb) from public;
revoke execute on function public.submit_mastery_attempt(uuid, jsonb) from anon;
revoke execute on function public.submit_mastery_attempt(uuid, jsonb) from authenticated;

grant execute on function public.start_mastery_attempt(uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_mastery_attempt(uuid, jsonb) to authenticated, service_role;

commit;
