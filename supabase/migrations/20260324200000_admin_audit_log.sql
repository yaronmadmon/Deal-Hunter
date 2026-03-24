-- Admin audit log table
-- Tracks all admin actions (credit adjustments, suspensions, admin grants, etc.)

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Admins can insert their own audit entries; only admins can read all entries
alter table public.admin_audit_log enable row level security;

create policy "Admins can insert audit log entries"
  on public.admin_audit_log for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_emails ae
      join auth.users u on u.email = ae.email
      where u.id = auth.uid()
    )
  );

create policy "Admins can read audit log"
  on public.admin_audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_emails ae
      join auth.users u on u.email = ae.email
      where u.id = auth.uid()
    )
  );

-- Index for fast lookups
create index if not exists admin_audit_log_admin_id_idx on public.admin_audit_log(admin_id);
create index if not exists admin_audit_log_target_user_id_idx on public.admin_audit_log(target_user_id);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
