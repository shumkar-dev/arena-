-- ============================================================
-- Таблица рейтинга «Всадников Арены» для Supabase.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run.
--
-- Игра только читает таблицу и меняет уток через функцию arena_add_ducks:
-- напрямую писать в таблицу нельзя, а за один матч можно получить или
-- потерять не больше 15 уток. Утки не опускаются ниже 0.
-- Боты хранятся в той же таблице (is_bot = true) и занимают места наравне с игроками.
-- ============================================================

create table if not exists public.arena_rating (
  id         text primary key,                 -- игрок: случайный id устройства; бот: 'bot:<имя>'
  name       text not null,
  ducks      integer not null default 0 check (ducks >= 0),
  is_bot     boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists arena_rating_ducks on public.arena_rating (ducks desc);

alter table public.arena_rating enable row level security;

drop policy if exists "arena_rating read" on public.arena_rating;
create policy "arena_rating read" on public.arena_rating for select using (true);

-- p_base — сколько уток было до матча, если записи ещё нет (первый матч в таблице)
-- p_delta — награда за матч; вернёт новое число уток
create or replace function public.arena_add_ducks(
  p_id text, p_name text, p_is_bot boolean, p_base integer, p_delta integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if abs(p_delta) > 15 or p_base < 0 or p_base > 3000 or length(p_id) > 64 then
    raise exception 'bad value';
  end if;
  insert into arena_rating as r (id, name, ducks, is_bot)
  values (p_id, left(coalesce(p_name, 'Игрок'), 24), greatest(0, p_base + p_delta), p_is_bot)
  on conflict (id) do update
    set ducks = greatest(0, r.ducks + p_delta),
        name = left(coalesce(p_name, r.name), 24),
        updated_at = now()
  returning ducks into v;
  return v;
end $$;

revoke all on function public.arena_add_ducks(text, text, boolean, integer, integer) from public;
grant execute on function public.arena_add_ducks(text, text, boolean, integer, integer) to anon, authenticated;
