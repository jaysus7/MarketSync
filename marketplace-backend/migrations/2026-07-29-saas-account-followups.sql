-- MarketSync SaaS back-office follow-ups. These are deliberately separate from
-- dealership crm_tasks: the subject is an account, not a dealership customer.
create table if not exists public.saas_account_followups (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  title text not null,
  note text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saas_account_followups_open_due_idx
  on public.saas_account_followups (completed_at, due_at asc);
create index if not exists saas_account_followups_dealer_idx
  on public.saas_account_followups (dealership_id, completed_at, due_at asc);

alter table public.saas_account_followups enable row level security;
