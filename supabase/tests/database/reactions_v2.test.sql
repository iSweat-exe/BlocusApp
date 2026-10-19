-- Reactions v2: reactions on events, and "who reacted" for posts and events (signed-in people only).
begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1@test.dev', '{"user_name": "first_member"}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b2@test.dev', '{"user_name": "second_member"}'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5@test.dev', '{"user_name": "banned_member"}');

insert into public.moderation_actions (target_id, kind, reason)
values ('00000000-0000-0000-0000-0000000000b5', 'ban', 'test');

insert into public.events (id, title, starts_at)
values ('00000000-0000-0000-0000-00000000e001', 'Départ', now() + interval '1 day');
insert into public.announcements (id, title, body, status)
values
  ('00000000-0000-0000-0000-00000000f101', 'Public', 'Texte.', 'public'),
  ('00000000-0000-0000-0000-00000000f102', 'Brouillon', 'Texte.', 'draft');

-- Guest: totals only, no table, no reaction, no list of who reacted.
set local role anon;
select is((select count(*)::int from public.event_reaction_counts), 0, '1. anon reads the (empty) event totals');
select throws_ok($$select * from public.event_reactions$$, '42501', null, '2. anon cannot read the event table');
select throws_ok(
  $$select public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '👍')$$,
  '42501', null, '3. anon cannot react to an event');
select throws_ok(
  $$select * from public.list_event_reactors('00000000-0000-0000-0000-00000000e001')$$,
  '42501', null, '4. anon cannot list who reacted');

-- Two members react to the event and to a post.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select is(public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '🎉'), true, '5. a member reacts to an event');
select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f101', '👍');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is(public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '🎉'), true, '6. another member adds the same emoji');
select public.toggle_announcement_reaction('00000000-0000-0000-0000-00000000f101', '🔥');

select throws_ok(
  $$select public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '🤡')$$,
  '23514', null, '7. an emoji outside the palette is refused');
select throws_ok(
  $$select public.toggle_event_reaction('00000000-0000-0000-0000-00000000e999', '🎉')$$,
  '22023', 'unknown_event', '8. an unknown event is refused');

-- Who reacted: pseudos by emoji, in the order of the reactions.
select is(
  (select array_agg(pseudo order by pseudo) from public.list_event_reactors('00000000-0000-0000-0000-00000000e001')),
  array['first_member', 'second_member'],
  '9. a member sees who reacted to an event');
select is(
  (select array_agg(emoji || ':' || pseudo order by emoji, pseudo)
     from public.list_announcement_reactors('00000000-0000-0000-0000-00000000f101')),
  array['👍:first_member', '🔥:second_member'],
  '10. and to a post, by emoji');
select is(
  (select count(*)::int from public.list_announcement_reactors('00000000-0000-0000-0000-00000000f102')), 0,
  '11. nothing is listed for a draft');

-- The totals count everybody and reveal nobody.
set local role anon;
select is(
  (select total from public.event_reaction_counts
    where event_id = '00000000-0000-0000-0000-00000000e001' and emoji = '🎉'),
  2, '12. the public event totals add both reactions');

-- Direct writes stay closed, a member only reads their own rows.
set local role authenticated;
select throws_ok(
  $$insert into public.event_reactions (event_id, user_id, emoji)
    values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b2', '🔥')$$,
  '42501', null, '13. direct writes are closed');
select is((select count(*)::int from public.event_reactions), 1, '14. a member only sees their own event reaction');

-- Second toggle removes; a banned user cannot react.
select is(public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '🎉'), false, '15. the second toggle removes');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b5", "role": "authenticated"}';
select throws_ok(
  $$select public.toggle_event_reaction('00000000-0000-0000-0000-00000000e001', '🎉')$$,
  '42501', null, '16. a banned user cannot react to an event');

-- Deleting the event removes its reactions.
reset role;
delete from public.events where id = '00000000-0000-0000-0000-00000000e001';
select is((select count(*)::int from public.event_reactions), 0, '17. reactions go with the event');

select * from finish();
rollback;
