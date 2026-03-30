-- Payments v1 schema for internal manual payment tracking
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  paid_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_owner_id on public.payments(owner_id);
create index if not exists idx_payments_tenant_id on public.payments(tenant_id);
create index if not exists idx_payments_property_id on public.payments(property_id);
create index if not exists idx_payments_status_due_date on public.payments(status, due_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy if not exists "payments_select_own"
on public.payments
for select
using (auth.uid() = owner_id);

create policy if not exists "payments_insert_own"
on public.payments
for insert
with check (auth.uid() = owner_id);

create policy if not exists "payments_update_own"
on public.payments
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy if not exists "payments_delete_own"
on public.payments
for delete
using (auth.uid() = owner_id);
