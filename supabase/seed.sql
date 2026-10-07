-- Dev seed (A-006): one account per role. Sign-in is OAuth only, so no password is set.
-- Profiles are created by the on_auth_user_created trigger, then the role is assigned.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user@seed.test', '{"user_name": "seed_user"}'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@seed.test', '{"user_name": "seed_manager"}'),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderator@seed.test', '{"user_name": "seed_moderator"}'),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@seed.test', '{"user_name": "seed_admin"}'),
  ('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super_admin@seed.test', '{"user_name": "seed_super_admin"}');

update public.profiles
   set role = split_part(u.email, '@', 1)
  from auth.users u
 where u.id = profiles.id and u.email like '%@seed.test';
