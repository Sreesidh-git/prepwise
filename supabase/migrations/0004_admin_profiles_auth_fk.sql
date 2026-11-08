-- Restore the Auth relationship without replacing the existing table.
-- The preflight check makes invalid existing rows fail explicitly instead of
-- allowing a partial or misleading migration result.
do $$
begin
  if exists (
    select 1
    from public.admin_profiles profile
    left join auth.users auth_user on auth_user.id = profile.user_id
    where auth_user.id is null
  ) then
    raise exception 'Cannot add admin_profiles_user_id_auth_users_fkey: orphaned admin_profiles rows exist';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.admin_profiles'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.conkey = array[
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.admin_profiles'::regclass
            and attribute.attname = 'user_id'
            and not attribute.attisdropped
        )::smallint
      ]
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;
