create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  game_username text not null check (
    char_length(trim(game_username)) between 1 and 30
  ),
  created_at timestamptz not null default now()
);

create unique index profiles_game_username_unique
  on public.profiles (lower(trim(game_username)));

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

grant select on public.profiles to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  username text;
begin
  username := trim(new.raw_user_meta_data ->> 'game_username');

  if username is null or char_length(username) not between 1 and 30 then
    raise exception 'In-game username must contain between 1 and 30 characters';
  end if;

  insert into public.profiles (id, game_username)
  values (new.id, username);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
