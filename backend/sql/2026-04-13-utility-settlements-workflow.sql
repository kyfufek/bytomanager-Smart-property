-- Utility settlement workflow persistence (minimal extension)

create table if not exists public.utility_settlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  title text,
  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'calculated', 'reviewed', 'exported', 'sent')),
  advances_total numeric not null default 0,
  actual_cost_total numeric not null default 0,
  balance_total numeric not null default 0,
  result_type text not null default 'vyrovnano'
    check (result_type in ('preplatek', 'nedoplatek', 'vyrovnano')),
  calculated_at timestamptz,
  reviewed_at timestamptz,
  exported_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utility_settlements_period_check check (period_to >= period_from)
);

create table if not exists public.utility_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.utility_settlements(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  advances_paid numeric not null default 0 check (advances_paid >= 0),
  actual_cost numeric not null default 0 check (actual_cost >= 0),
  difference numeric not null default 0,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_utility_settlements_owner_status
  on public.utility_settlements(owner_id, status, created_at desc);

create index if not exists idx_utility_settlements_tenant_period
  on public.utility_settlements(tenant_id, period_from, period_to);

create index if not exists idx_utility_settlement_items_settlement
  on public.utility_settlement_items(settlement_id, sort_order);

alter table public.utility_settlements enable row level security;
alter table public.utility_settlement_items enable row level security;

drop policy if exists utility_settlements_select_own on public.utility_settlements;
drop policy if exists utility_settlements_insert_own on public.utility_settlements;
drop policy if exists utility_settlements_update_own on public.utility_settlements;
drop policy if exists utility_settlements_delete_own on public.utility_settlements;

create policy utility_settlements_select_own
  on public.utility_settlements
  for select
  using (auth.uid() = owner_id);

create policy utility_settlements_insert_own
  on public.utility_settlements
  for insert
  with check (auth.uid() = owner_id);

create policy utility_settlements_update_own
  on public.utility_settlements
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy utility_settlements_delete_own
  on public.utility_settlements
  for delete
  using (auth.uid() = owner_id);

drop policy if exists utility_settlement_items_select_own on public.utility_settlement_items;
drop policy if exists utility_settlement_items_insert_own on public.utility_settlement_items;
drop policy if exists utility_settlement_items_update_own on public.utility_settlement_items;
drop policy if exists utility_settlement_items_delete_own on public.utility_settlement_items;

create policy utility_settlement_items_select_own
  on public.utility_settlement_items
  for select
  using (auth.uid() = owner_id);

create policy utility_settlement_items_insert_own
  on public.utility_settlement_items
  for insert
  with check (auth.uid() = owner_id);

create policy utility_settlement_items_update_own
  on public.utility_settlement_items
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy utility_settlement_items_delete_own
  on public.utility_settlement_items
  for delete
  using (auth.uid() = owner_id);
