-- Emoji reactions on posts: toggle function, closed table, public totals, ban, rate limit.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev', '{"user_name": "banned_user"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';

insert into public.announcements (id, author_id, title, body, status)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a2', 'Public', 'Texte.', 'public'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a2', 'Brouillon', 'Texte.', 'draft');

insert into public.moderation_actions (target_id, kind, reason)
values ('00000000-0000-0000-0000-0000000000a5', 'ban', 'test');

-- Guest: reads the totals, cannot react, cannot read the table.
set local role anon;
select is((select count(*)::int from public.announcement_reaction_counts), 0, '1. anon reads the (empty) totals');
select throws_ok($$select * from public.announcement_reactions$$, '42501', null, '2. anon cannot read the table');
select throws_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '👍')$$,
  '42501', null, '3. anon cannot react');

-- A member reacts, then un-reacts.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '👍'), true, '4. first toggle adds');
select is(
  (select count(*)::int from public.announcement_reactions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, '5. the member reads their own reaction');
select throws_ok(
  $$insert into public.announcement_reactions (announcement_id, user_id, emoji)
    values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', '🔥')$$,
  '42501', null, '6. direct writes are closed');
select throws_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '🤡')$$,
  '23514', null, '7. an emoji outside the palette is refused');
select throws_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f002', '👍')$$,
  '22023', 'unknown_announcement', '8. a draft cannot be reacted to');

-- Totals count everybody and reveal nobody.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select is(public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '👍'), true, '9. another member adds the same emoji');
select is(
  (select count(*)::int from public.announcement_reactions), 1,
  '10. a member only sees their own reaction rows');
set local role anon;
select is(
  (select total from public.announcement_reaction_counts
    where announcement_id = '00000000-0000-0000-0000-00000000f001' and emoji = '👍'),
  2, '11. the public totals add both reactions');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '👍'), false, '12. second toggle removes');

-- A banned user cannot react.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select throws_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '👍')$$,
  '42501', null, '13. a banned user cannot react');

-- Rate limit: 60 toggles per minute.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '🔥') from generate_series(1, 58)$$,
  '14. 60 toggles in a minute pass (2 already used)');
select throws_ok(
  $$select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f001', '🔥')$$,
  '54000', 'rate_limited', '15. the 61st is refused');

-- Deleting the post removes its reactions.
reset role;
delete from public.announcements where id = '00000000-0000-0000-0000-00000000f001';
select is((select count(*)::int from public.announcement_reactions), 0, '16. reactions go with the post');

select * from finish();
rollback;
