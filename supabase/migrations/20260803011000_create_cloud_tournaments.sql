create extension if not exists pgcrypto with schema extensions;

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'completed')),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  position integer not null check (position >= 0),
  display_name text not null check (char_length(display_name) between 1 and 30),
  primary key (tournament_id, position)
);

create table public.tournament_games (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_a_position integer not null,
  player_b_position integer not null,
  game_number integer not null check (game_number between 1 and 5),
  town_a text check (
    town_a is null or town_a in (
      'Bulwark', 'Castle', 'Conflux', 'Cove', 'Dungeon', 'Factory',
      'Fortress', 'Inferno', 'Necropolis', 'Rampart', 'Stronghold', 'Tower'
    )
  ),
  town_b text check (
    town_b is null or town_b in (
      'Bulwark', 'Castle', 'Conflux', 'Cove', 'Dungeon', 'Factory',
      'Fortress', 'Inferno', 'Necropolis', 'Rampart', 'Stronghold', 'Tower'
    )
  ),
  winner text check (winner is null or winner in ('A', 'B')),
  primary key (
    tournament_id,
    player_a_position,
    player_b_position,
    game_number
  ),
  foreign key (tournament_id, player_a_position)
    references public.tournament_players(tournament_id, position)
    on delete cascade,
  foreign key (tournament_id, player_b_position)
    references public.tournament_players(tournament_id, position)
    on delete cascade,
  check (player_a_position < player_b_position),
  check (winner is null or (town_a is not null and town_b is not null))
);

create table public.tournament_edit_keys (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  key_hash bytea not null,
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_games enable row level security;
alter table public.tournament_edit_keys enable row level security;

create policy "Public tournaments are readable"
  on public.tournaments
  for select
  to anon, authenticated
  using (true);

create policy "Public tournament players are readable"
  on public.tournament_players
  for select
  to anon, authenticated
  using (true);

create policy "Public tournament games are readable"
  on public.tournament_games
  for select
  to anon, authenticated
  using (true);

grant select on public.tournaments to anon, authenticated;
grant select on public.tournament_players to anon, authenticated;
grant select on public.tournament_games to anon, authenticated;
revoke all on public.tournament_edit_keys from anon, authenticated;

create or replace function public.replace_tournament_snapshot(
  p_tournament_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_count integer;
  match_entry record;
  game_entry record;
  player_a integer;
  player_b integer;
begin
  if coalesce(jsonb_typeof(p_state), '') <> 'object'
    or coalesce(jsonb_typeof(p_state -> 'players'), '') <> 'array'
    or jsonb_array_length(p_state -> 'players') < 2
    or coalesce(jsonb_typeof(p_state -> 'matches'), '') <> 'object'
  then
    raise exception 'Invalid tournament state';
  end if;

  player_count := jsonb_array_length(p_state -> 'players');

  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'players') as player(value)
    where jsonb_typeof(player.value) <> 'string'
      or char_length(trim(player.value #>> '{}')) not between 1 and 30
  ) then
    raise exception 'Invalid tournament player';
  end if;

  for match_entry in
    select match.key, match.value
    from jsonb_each(p_state -> 'matches') as match(key, value)
  loop
    if match_entry.key !~ '^[0-9]+-[0-9]+$' then
      raise exception 'Invalid tournament matchup key';
    end if;

    player_a := split_part(match_entry.key, '-', 1)::integer;
    player_b := split_part(match_entry.key, '-', 2)::integer;
    if player_a < 0 or player_a >= player_b or player_b >= player_count then
      raise exception 'Invalid tournament matchup players';
    end if;

    if jsonb_typeof(match_entry.value) <> 'array'
      or jsonb_array_length(match_entry.value) <> 5
    then
      raise exception 'Each matchup must contain exactly five games';
    end if;

    for game_entry in
      select game.value
      from jsonb_array_elements(match_entry.value) as game(value)
    loop
      if jsonb_typeof(game_entry.value) <> 'object'
        or not (game_entry.value ? 'townA')
        or not (game_entry.value ? 'townB')
        or not (game_entry.value ? 'winner')
        or jsonb_typeof(game_entry.value -> 'townA') <> 'string'
        or jsonb_typeof(game_entry.value -> 'townB') <> 'string'
        or not (
          game_entry.value -> 'winner' = 'null'::jsonb
          or game_entry.value ->> 'winner' in ('A', 'B')
        )
        or (
          game_entry.value ->> 'winner' in ('A', 'B')
          and (
            game_entry.value ->> 'townA' = ''
            or game_entry.value ->> 'townB' = ''
          )
        )
      then
        raise exception 'Invalid tournament game';
      end if;
    end loop;
  end loop;

  delete from public.tournament_games
  where tournament_id = p_tournament_id;

  delete from public.tournament_players
  where tournament_id = p_tournament_id;

  insert into public.tournament_players (
    tournament_id,
    position,
    display_name
  )
  select
    p_tournament_id,
    player.ordinality::integer - 1,
    player.display_name
  from jsonb_array_elements_text(p_state -> 'players')
    with ordinality as player(display_name, ordinality);

  insert into public.tournament_games (
    tournament_id,
    player_a_position,
    player_b_position,
    game_number,
    town_a,
    town_b,
    winner
  )
  select
    p_tournament_id,
    split_part(match.key, '-', 1)::integer,
    split_part(match.key, '-', 2)::integer,
    game.ordinality::integer,
    nullif(game.value ->> 'townA', ''),
    nullif(game.value ->> 'townB', ''),
    nullif(game.value ->> 'winner', '')
  from jsonb_each(p_state -> 'matches') as match(key, games)
  cross join lateral jsonb_array_elements(match.games)
    with ordinality as game(value, ordinality);
end;
$$;

revoke all on function public.replace_tournament_snapshot(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.create_cloud_tournament(
  p_name text,
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

revoke all on function public.create_cloud_tournament(text, text, jsonb)
  from public;
grant execute on function public.create_cloud_tournament(text, text, jsonb)
  to anon, authenticated;

create or replace function public.save_cloud_tournament(
  p_tournament_id uuid,
  p_edit_key text,
  p_state jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_at timestamptz;
begin
  if not exists (
    select 1
    from public.tournament_edit_keys edit_key
    join public.tournaments tournament
      on tournament.id = edit_key.tournament_id
    where edit_key.tournament_id = p_tournament_id
      and tournament.status = 'active'
      and edit_key.key_hash = extensions.digest(
        convert_to(p_edit_key, 'UTF8'),
        'sha256'
      )
  ) then
    raise exception 'Invalid edit key or completed tournament'
      using errcode = '42501';
  end if;

  update public.tournaments
  set state = p_state,
      updated_at = clock_timestamp()
  where id = p_tournament_id
  returning updated_at into saved_at;

  perform public.replace_tournament_snapshot(p_tournament_id, p_state);
  return saved_at;
end;
$$;

revoke all on function public.save_cloud_tournament(uuid, text, jsonb)
  from public;
grant execute on function public.save_cloud_tournament(uuid, text, jsonb)
  to anon, authenticated;
