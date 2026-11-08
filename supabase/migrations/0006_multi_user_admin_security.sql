-- Migration 0006: Secure Multi-User Administration & RLS Hardening
-- Local proposal: Do NOT execute on production without owner approval.

-- 1. Upgrade public.is_admin() to support both active owners and active full admins
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and role in ('owner', 'admin')
      and is_active = true
  );
$$;

-- 2. Define public.is_owner() to strictly identify the active owner profile
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- 3. Hardened RLS policies for public.admin_profiles
-- Drop legacy or broad management policies
drop policy if exists owner_manage_admin_profiles on public.admin_profiles;
drop policy if exists admin_profiles_select on public.admin_profiles;
drop policy if exists admin_profiles_insert on public.admin_profiles;
drop policy if exists admin_profiles_update on public.admin_profiles;
drop policy if exists admin_profiles_delete on public.admin_profiles;

-- Ensure RLS is active on admin_profiles
alter table public.admin_profiles enable row level security;

-- Active administrators and owner can view admin profiles; fast-path direct read for user's own row prevents RLS recursion
create policy admin_profiles_select on public.admin_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

-- Only the verified Owner can insert new administrator profiles via client API
create policy admin_profiles_insert on public.admin_profiles
  for insert to authenticated
  with check (public.is_owner());

-- Only the verified Owner can update administrator profiles via client API
create policy admin_profiles_update on public.admin_profiles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Only the verified Owner can delete administrator profiles via client API
create policy admin_profiles_delete on public.admin_profiles
  for delete to authenticated
  using (public.is_owner());

-- 4. Invariant Database Triggers for Privilege Escalation & Bootstrap Protection
create or replace function public.enforce_admin_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_count int;
begin
  -- 1. INSERT RULES
  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      -- Count existing owners in admin_profiles
      select count(*) into v_owner_count
      from public.admin_profiles
      where role = 'owner';

      if v_owner_count > 0 then
        -- An owner already exists. Only an existing active owner or superuser can provision or transfer owner role
        if not public.is_owner() and current_user not in ('postgres', 'supabase_admin') then
          raise exception 'An owner profile already exists. Only an existing active owner can assign the owner role.';
        end if;
      else
        -- BOOTSTRAP CASE: Zero owners exist in admin_profiles.
        -- Ensure this bootstrap CANNOT be performed via client API / PostgREST (auth.role() = 'authenticated')
        if auth.role() = 'authenticated' then
          raise exception 'Initial owner bootstrap is prohibited through client API. Execute via trusted Supabase SQL Editor.';
        end if;

        -- Verify that target user exists in auth.users
        if not exists (select 1 from auth.users where id = new.user_id) then
          raise exception 'Target user_id % does not exist in auth.users. Create the Auth user first.', new.user_id;
        end if;
      end if;
    end if;

  -- 2. UPDATE RULES
  elsif tg_op = 'UPDATE' then
    -- Prevent deactivating or demoting the owner account
    if old.role = 'owner' and (new.role != 'owner' or new.is_active != true) then
      raise exception 'The owner account cannot be demoted or deactivated.';
    end if;

    -- Prevent reassigning owner user_id except by database administrators in SQL Editor (emergency recovery)
    if old.role = 'owner' and new.user_id != old.user_id then
      if current_user not in ('postgres', 'supabase_admin') then
        raise exception 'The owner user ID can only be reassigned by database administrators in the SQL Editor.';
      end if;
    end if;

    -- Prevent non-owners from promoting anyone to owner
    if new.role = 'owner' and old.role != 'owner' then
      if not public.is_owner() and current_user not in ('postgres', 'supabase_admin') then
        raise exception 'Only an existing active owner or database administrator can promote a user to owner.';
      end if;
    end if;

    -- Prevent admins from modifying their own role or active status
    if old.role = 'admin' and (new.role != old.role or new.is_active != old.is_active) then
      if not public.is_owner() and current_user not in ('postgres', 'supabase_admin') then
        raise exception 'Administrators cannot alter administrative roles or active status.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists admin_profile_security_guard on public.admin_profiles;
create trigger admin_profile_security_guard
  before insert or update on public.admin_profiles
  for each row execute function public.enforce_admin_profile_security();

create or replace function public.prevent_owner_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'The owner account profile cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists admin_profile_deletion_guard on public.admin_profiles;
create trigger admin_profile_deletion_guard
  before delete on public.admin_profiles
  for each row execute function public.prevent_owner_profile_deletion();

-- 5. Safe, Explicit Initial Owner Provisioning Helper Function (SQL Editor Only)
create or replace function public.bootstrap_initial_owner(
  p_user_id uuid,
  p_display_name text default 'Mohammed Rayyan'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- 1. Check if owner already exists
  if exists (select 1 from public.admin_profiles where role = 'owner') then
    raise exception 'An owner profile already exists. Bootstrap procedure can only be run once.';
  end if;

  -- 2. Verify target user exists in auth.users
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User ID % does not exist in auth.users. Create the Supabase Auth user first.', p_user_id;
  end if;

  -- 3. Insert or update the initial owner record
  insert into public.admin_profiles (user_id, role, display_name, is_active)
  values (p_user_id, 'owner', coalesce(p_display_name, 'Mohammed Rayyan'), true)
  on conflict (user_id) do update
  set role = 'owner',
      display_name = coalesce(excluded.display_name, public.admin_profiles.display_name),
      is_active = true,
      updated_at = now();
end;
$$;

-- Restrict execution of bootstrap_initial_owner strictly to postgres superuser (SQL Editor)
revoke all on function public.bootstrap_initial_owner(uuid, text) from public;
revoke all on function public.bootstrap_initial_owner(uuid, text) from anon, authenticated, service_role;
grant execute on function public.bootstrap_initial_owner(uuid, text) to postgres;

-- 6. Emergency Owner Rebind & Recovery Procedure (SQL Editor Only)
create or replace function public.emergency_rebind_owner(
  p_new_owner_user_id uuid,
  p_new_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_owner_id uuid;
begin
  -- 1. Must be executed as postgres superuser in SQL Editor
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Emergency rebind is strictly restricted to database superusers in the SQL Editor.';
  end if;

  -- 2. Verify target user exists in auth.users
  if not exists (select 1 from auth.users where id = p_new_owner_user_id) then
    raise exception 'Target user ID % does not exist in auth.users. Create the Auth user first.', p_new_owner_user_id;
  end if;

  -- 3. Retrieve current owner ID
  select user_id into v_old_owner_id
  from public.admin_profiles
  where role = 'owner'
  limit 1;

  if v_old_owner_id is null then
    -- No owner exists, route to bootstrap
    perform public.bootstrap_initial_owner(p_new_owner_user_id, p_new_display_name);
    return;
  end if;

  if v_old_owner_id = p_new_owner_user_id then
    -- Same user, just ensure active and update display name if provided
    update public.admin_profiles
    set display_name = coalesce(p_new_display_name, display_name),
        is_active = true,
        updated_at = now()
    where user_id = v_old_owner_id;
    return;
  end if;

  -- 4. If a profile already exists for the new UUID (e.g. as admin), remove it first
  delete from public.admin_profiles where user_id = p_new_owner_user_id;

  -- 5. Rebind existing owner profile by updating primary key user_id
  update public.admin_profiles
  set user_id = p_new_owner_user_id,
      display_name = coalesce(p_new_display_name, display_name),
      is_active = true,
      updated_at = now()
  where user_id = v_old_owner_id;

  -- 6. Log the administrative recovery in activity logs
  insert into public.admin_activity_logs (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_new_owner_user_id,
    'emergency_owner_rebind',
    'admin_profiles',
    p_new_owner_user_id,
    jsonb_build_object(
      'previous_owner_id', v_old_owner_id,
      'new_owner_id', p_new_owner_user_id,
      'executed_by', current_user,
      'timestamp', now()
    )
  );
end;
$$;

-- Restrict execution of emergency_rebind_owner strictly to postgres superuser (SQL Editor)
revoke all on function public.emergency_rebind_owner(uuid, text) from public;
revoke all on function public.emergency_rebind_owner(uuid, text) from anon, authenticated, service_role;
grant execute on function public.emergency_rebind_owner(uuid, text) to postgres;
