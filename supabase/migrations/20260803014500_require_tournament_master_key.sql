create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.application_secrets (
  name text primary key,
  value_hash bytea not null,
  updated_at timestamptz not null default now()
);

revoke all on private.application_secrets from public, anon, authenticated;

insert into private.application_secrets (name, value_hash)
values (
  'tournament_master_key',
  decode(
    '97e27af2ed7e24a82abb6bec62725baa815af600616025aeb4b4a3a0a384cdd3',
    'hex'
  )
)
on conflict (name) do update
set value_hash = excluded.value_hash,
    updated_at = clock_timestamp();

drop function public.create_cloud_tournament(text, text, jsonb);

create or replace function public.create_cloud_tournament(
  p_name text,
  p_master_key text,
  p_edit_key text,
  p_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_tournament_id uuid;
begin
  if not exists (
    select 1
    from private.application_secrets secret
    where secret.name = 'tournament_master_key'
      and secret.value_hash = extensions.digest(
        convert_to(p_master_key, 'UTF8'),
        'sha256'
      )
  ) then
    raise exception 'Invalid tournament master key'
      using errcode = '42501';
  end if;

  if char_length(trim(p_name)) not between 1 and 100 then
    raise exception 'Tournament name must contain between 1 and 100 characters';
  end if;

  if char_length(p_edit_key) < 32 then
    raise exception 'Edit key is too short';
  end if;

  insert into public.tournaments (name, state)
  values (trim(p_name), p_state)
  returning id into new_tournament_id;

  insert into public.tournament_edit_keys (tournament_id, key_hash)
  values (
    new_tournament_id,
    extensions.digest(convert_to(p_edit_key, 'UTF8'), 'sha256')
  );

  perform public.replace_tournament_snapshot(new_tournament_id, p_state);
  return new_tournament_id;
end;
$$;

revoke all on function public.create_cloud_tournament(text, text, text, jsonb)
  from public;
grant execute on function public.create_cloud_tournament(text, text, text, jsonb)
  to anon, authenticated;
