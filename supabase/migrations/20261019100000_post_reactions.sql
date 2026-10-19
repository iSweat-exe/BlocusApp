-- Emoji reactions on public posts (Discord style): a signed-in user adds or removes one emoji per post, everybody
-- (Guests included) sees the totals.
--
-- Clients never write the table: they call toggle_announcement_reaction(), which checks the sign-in, the ban, the
-- visibility of the post and the rate limit in one place. The totals are read through a view (same pattern as
-- announcement_feed: the view runs with its owner's rights and only shows reactions of public posts).

create table public.announcement_reactions (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Fixed palette, kept in sync with `REACTION_EMOJIS` in src/features/announcements/reactions.ts.
  emoji text not null
    constraint announcement_reactions_emoji_palette
    check (emoji in ('👍', '💜', '😂', '😮', '😢', '🔥', '🎉', '👏')),
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id, emoji)
);

comment on table public.announcement_reactions is
  'Emoji reactions on posts, one row per (post, user, emoji). Written by toggle_announcement_reaction() only.';

-- Deleting an account removes its reactions: lookup by user.
create index announcement_reactions_user_idx on public.announcement_reactions (user_id);

alter table public.announcement_reactions enable row level security;

-- Clients only read their own reactions (to highlight them); every write goes through the function below.
revoke all on public.announcement_reactions from anon, authenticated;
grant select on public.announcement_reactions to authenticated;

create policy "announcement_reactions_select_own" on public.announcement_reactions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Adds the caller's reaction, or removes it when it already exists. Returns true when it was added.
-- Needs a signed-in, non-banned user and a public post. Limited to 60 toggles per minute (rate_limited, 54000).
create function public.toggle_announcement_reaction(p_announcement_id uuid, p_emoji text)
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

  if not exists (
    select 1 from public.announcements a where a.id = p_announcement_id and a.status = 'public'
  ) then
    raise exception 'unknown_announcement' using errcode = '22023';
  end if;

  delete from public.announcement_reactions r
   where r.announcement_id = p_announcement_id and r.user_id = caller and r.emoji = p_emoji;
  get diagnostics removed = row_count;
  if removed > 0 then
    return false;
  end if;

  -- A double tap can race with itself: the second insert is then a no-op.
  insert into public.announcement_reactions (announcement_id, user_id, emoji)
  values (p_announcement_id, caller, p_emoji)
  on conflict do nothing;
  return true;
end;
$$;

revoke execute on function public.toggle_announcement_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_announcement_reaction(uuid, text) to authenticated;

-- Totals per post and emoji, for public posts only. Readable by everybody (the home feed is public).
create view public.announcement_reaction_counts
with (security_invoker = false) as
select r.announcement_id, r.emoji, count(*)::int as total
from public.announcement_reactions r
join public.announcements a on a.id = r.announcement_id and a.status = 'public'
group by r.announcement_id, r.emoji;

comment on view public.announcement_reaction_counts is
  'Number of reactions per emoji on each public post. No user is revealed.';

revoke all on public.announcement_reaction_counts from public, anon, authenticated;
grant select on public.announcement_reaction_counts to anon, authenticated;
