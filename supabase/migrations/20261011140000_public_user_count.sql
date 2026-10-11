-- Number of accounts, readable by everybody (Guests included): shown on the login page.
--
-- `profiles` is closed to `anon`, so a function is the only way to expose this, and it exposes one integer and
-- nothing else (no name, no date, no id). SECURITY DEFINER with a fixed search_path, like the other counters. The
-- application reads it through a shared cache (a database read every two minutes at most), and tolerates its
-- absence: the line simply is not shown until this migration is applied.

create function public.public_user_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profiles;
$$;

revoke execute on function public.public_user_count() from public;
grant execute on function public.public_user_count() to anon, authenticated;
