-- Drop existing tables and functions if they exist
drop table if exists public.games cascade;
drop function if exists public.join_game cascade;
drop function if exists public.submit_guess cascade;
drop function if exists public.update_game_status cascade;

-- Create games table
create table public.games (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null,
  word text not null check (length(word) = 5),
  status text not null check (status in ('waiting', 'playing', 'finished')),
  players jsonb not null default '[]'::jsonb,
  started_at bigint,
  ended_at bigint,
  winner jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable realtime for games table
alter publication supabase_realtime add table games;

-- Create RLS policies
alter table public.games enable row level security;

create policy "Anyone can read games"
  on public.games for select
  using (true);

create policy "Anyone can insert games"
  on public.games for insert
  with check (true);

create policy "Anyone can update games"
  on public.games for update
  using (true);

-- Create functions
create or replace function public.join_game(
  p_game_id uuid,
  p_player jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id for update;
  
  if v_game.status != 'waiting' then
    raise exception 'Game is not in waiting state';
  end if;
  
  if jsonb_array_length(v_game.players) >= 8 then
    raise exception 'Game is full';
  end if;
  
  update games
  set players = players || p_player
  where id = p_game_id;
end;
$$;

create or replace function public.submit_guess(
  p_game_id uuid,
  p_guess text,
  p_player_id text,
  p_result text
)
returns void
language plpgsql
security definer
as $$
declare
  v_game games;
  v_player_index integer;
  v_is_correct boolean;
  v_guess_obj jsonb;
begin
  select * into v_game from games where id = p_game_id for update;
  
  if v_game.status != 'playing' then
    raise exception 'Game is not in playing state';
  end if;
  
  select ordinality - 1 into v_player_index
  from jsonb_array_elements(v_game.players) with ordinality
  where value->>'id' = p_player_id;
  
  if v_player_index is null then
    raise exception 'Player not found in game';
  end if;

  -- Create guess object
  v_guess_obj := jsonb_build_object(
    'word', p_guess,
    'result', p_result
  );

  -- Check if all results are 'c' (correct)
  v_is_correct := p_result = 'ccccc';

  update games
  set players = jsonb_set(
    jsonb_set(
      players,
      array[v_player_index::text, 'guesses'],
      coalesce(players->v_player_index->'guesses', '[]'::jsonb) || v_guess_obj
    ),
    array[v_player_index::text, 'solved'],
    to_jsonb(v_is_correct)
  ),
  winner = case
    when v_is_correct and winner is null
    then players->v_player_index
    else winner
  end,
  ended_at = case
    when v_is_correct and winner is null
    then extract(epoch from now()) * 1000
    else ended_at
  end
  where id = p_game_id;
end;
$$;

create or replace function public.update_game_status(
  p_game_id uuid,
  p_status text,
  p_started_at bigint default null,
  p_ended_at bigint default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_game games;
begin
  select * into v_game from games where id = p_game_id for update;
  
  if p_status not in ('waiting', 'playing', 'finished') then
    raise exception 'Invalid game status';
  end if;
  
  update games
  set status = p_status,
      started_at = coalesce(p_started_at, started_at),
      ended_at = coalesce(p_ended_at, ended_at)
  where id = p_game_id;
end;
$$;