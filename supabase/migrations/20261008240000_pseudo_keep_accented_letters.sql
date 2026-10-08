-- Initial pseudo: turn accented letters into their base letter instead of dropping them
-- ("Roméo" gave "Romo", now "Romeo"). Same function as in create_profiles, only the cleaning changes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  -- NFD splits "é" into "e" + a combining accent (U+0300..U+036F), which is then removed.
  base := regexp_replace(
    regexp_replace(
      normalize(
        coalesce(
          new.raw_user_meta_data ->> 'user_name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          'user'
        ),
        nfd
      ),
      '[̀-ͯ]', '', 'g'
    ),
    '[^A-Za-z0-9_.-]', '', 'g'
  );
  base := left(base, 24);
  if char_length(base) < 3 then
    base := 'user';
  end if;

  candidate := base;
  if exists (select 1 from public.profiles where lower(pseudo) = lower(candidate)) then
    candidate := base || '_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, pseudo, avatar_url)
  values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;
