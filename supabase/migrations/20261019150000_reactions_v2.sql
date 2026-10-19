-- Reactions, second step: reactions on events, and "who reacted" for posts and events.
--
-- Events get the same model as posts (post_reactions migration): clients never write the table, they call
-- toggle_event_reaction(), and the totals are read through a view that reveals nobody. The list of who reacted
-- is a function for signed-in people only: pseudos are public profile data, but Guests (no account) only see totals.

create table public.event_reactions (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Same fixed palette as `announcement_reactions`, kept in sync with `REACTION_EMOJIS` (reactions.ts).
  emoji text not null
    constraint event_reactions_emoji_palette
    check (emoji in ('👍', '💜', '😂', '😮', '😢', '🔥', '🎉', '👏')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, emoji)
);

comment on table public.event_reactions is
  'Emoji reactions on events, one row per (event, user, emoji). Written by toggle_event_reaction() only.';

-- Deleting an account removes its reactions: lookup by user.
create index event_reactions_user_idx on public.event_reactions (user_id);

alter table public.event_reactions enable row level security;

-- Clients only read their own reactions (to highlight them); every write goes through the function below.
revoke all on public.event_reactions from anon, authenticated;
grant select on public.event_reactions to authenticated;

create policy "event_reactions_select_own" on public.event_reactions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Adds the caller's reaction, or removes it when it already exists. Returns true when it was added.
-- Needs a signed-in, non-banned user and an existing event. Shares the post limit: 60 toggles per minute.
create function public.toggle_event_reaction(p_event_id uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  removed int;
begin
  if caller is null or public.is_banned(caller) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.consume_rate_limit('reaction.write', 60, interval '1 minute');

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'unknown_event' using errcode = '22023';
  end if;

  delete from public.event_reactions r
   where r.event_id = p_event_id and r.user_id = caller and r.emoji = p_emoji;
  get diagnostics removed = row_count;
  if removed > 0 then
    return false;
  end if;

  insert into public.event_reactions (event_id, user_id, emoji)
  values (p_event_id, caller, p_emoji)
  on conflict do nothing;
  return true;
end;
$$;

revoke execute on function public.toggle_event_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_event_reaction(uuid, text) to authenticated;

-- Totals per event and emoji. Readable by everybody (the calendar is public).
create view public.event_reaction_counts
with (security_invoker = false) as
select r.event_id, r.emoji, count(*)::int as total
from public.event_reactions r
group by r.event_id, r.emoji;

comment on view public.event_reaction_counts is
  'Number of reactions per emoji on each event. No user is revealed.';

revoke all on public.event_reaction_counts from public, anon, authenticated;
grant select on public.event_reaction_counts to anon, authenticated;

-- Who reacted to a public post, by emoji: pseudos in the order of the reactions, at most 500 rows (a page of a few
-- hundred reactions is already far more than a screen can show). Signed-in people only: a Guest gets 42501.
create function public.list_announcement_reactors(p_announcement_id uuid)
returns table (emoji text, pseudo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select r.emoji, p.pseudo
      from public.announcement_reactions r
      join public.profiles p on p.id = r.user_id
      join public.announcements a on a.id = r.announcement_id and a.status = 'public'
     where r.announcement_id = p_announcement_id
     order by r.created_at, p.pseudo
     limit 500;
end;
$$;

revoke execute on function public.list_announcement_reactors(uuid) from public, anon;
grant execute on function public.list_announcement_reactors(uuid) to authenticated;

-- Same for an event.
create function public.list_event_reactors(p_event_id uuid)
returns table (emoji text, pseudo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select r.emoji, p.pseudo
      from public.event_reactions r
      join public.profiles p on p.id = r.user_id
     where r.event_id = p_event_id
     order by r.created_at, p.pseudo
     limit 500;
end;
$$;

revoke execute on function public.list_event_reactors(uuid) from public, anon;
grant execute on function public.list_event_reactors(uuid) to authenticated;
