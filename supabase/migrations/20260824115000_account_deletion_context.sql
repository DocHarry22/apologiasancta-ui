begin;

-- Learner account deletion is a distinct, user-authorized lifecycle operation.
-- Unlocks remain append-only during ordinary product use, while this narrowly
-- scoped transaction context permits deletion of the requesting learner's
-- account-linked unlock rows.
create or replace function private.prevent_ordinary_unlock_relock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text;
begin
  v_context := coalesce(current_setting('app.maintenance_context', true), '');
  if v_context not in ('approved_data_repair', 'account_deletion') then
    raise exception using errcode = '42501', message = 'completed unlocks are append-only outside approved data repair or account deletion';
  end if;
  return old;
end;
$$;

revoke execute on function private.prevent_ordinary_unlock_relock() from public, anon, authenticated;
grant execute on function private.prevent_ordinary_unlock_relock() to service_role;

comment on function private.prevent_ordinary_unlock_relock() is
  'Prevents ordinary unlock deletion; permits approved data repair and server-authorized learner account deletion contexts.';

commit;
