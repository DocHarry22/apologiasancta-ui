-- Test-only compatibility shim for running the migration against a plain
-- PostgreSQL 16 container. A real Supabase database already owns these roles,
-- auth schema objects, and auth.uid(). Do not deploy this file as a migration.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
