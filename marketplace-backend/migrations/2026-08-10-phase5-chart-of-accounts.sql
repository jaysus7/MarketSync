-- Phase 5 PR 5.1 — the canonical chart of accounts.
--
-- Account resolution is now strict: a posting whose rule names an unknown account_key
-- FAILS rather than inventing an account. That is only safe if the accounts a rule can
-- legitimately name already exist, so the chart is seeded here as a deliberate,
-- reproducible act instead of being accreted by whatever key happened to be posted first.
--
-- Mirrors ACCOUNT_DEFS in routes/accounting-engine.js exactly. A test pins the two
-- together so they cannot drift.
--
-- Idempotent and additive: existing accounts keep their id, code and name. Nothing is
-- renamed, recategorised or deactivated — a dealership that has customised an account
-- keeps its version. APPLIED TO STAGING ONLY in this PR.

insert into public.gl_accounts (dealership_id, system_key, code, name, category)
select d.id, c.system_key, c.code, c.name, c.category
from public.dealerships d
cross join (values
  -- Assets
  ('cash',                 '1000', 'Cash / Bank',              'asset'),
  ('accounts_receivable',  '1100', 'Accounts Receivable',      'asset'),
  ('contracts_in_transit', '1150', 'Contracts in Transit',     'asset'),
  ('inventory',            '1200', 'Vehicle Inventory',        'asset'),
  ('parts_inventory',      '1300', 'Parts Inventory',          'asset'),
  ('recon_wip',            '1400', 'Recon Work in Progress',   'asset'),
  ('prepaids',             '1450', 'Prepaids',                 'asset'),
  ('fixed_assets',         '1500', 'Fixed Assets',             'asset'),
  ('tax_paid',             '1600', 'Sales Tax Paid / ITCs',    'asset'),
  -- Liabilities
  ('accounts_payable',     '2000', 'Accounts Payable',         'liability'),
  ('floorplan_payable',    '2100', 'Floorplan Payable',        'liability'),
  ('tax_collected',        '2200', 'Sales Tax Payable',        'liability'),
  ('commission_payable',   '2300', 'Commission Payable',       'liability'),
  ('payroll_payable',      '2400', 'Payroll Payable',          'liability'),
  ('customer_deposits',    '2500', 'Customer Deposits',        'liability'),
  ('trade_allowance',      '2600', 'Trade Allowance',          'liability'),
  -- Equity
  ('retained_earnings',    '3000', 'Retained Earnings',        'equity'),
  -- Revenue
  ('vehicle_sales',        '4000', 'Vehicle Sales',            'income'),
  ('fni_income',           '4100', 'F&I Revenue',              'income'),
  ('service_revenue',      '4200', 'Service Revenue',          'income'),
  ('parts_revenue',        '4300', 'Parts Revenue',            'income'),
  ('warranty_revenue',     '4400', 'Warranty Revenue',         'income'),
  ('accessories_income',   '4500', 'Accessories Revenue',      'income'),
  -- Cost of sales
  ('cogs',                 '5000', 'Vehicle COGS',             'cogs'),
  ('recon_cost',           '5100', 'Recon Cost',               'cogs'),
  ('parts_cost',           '5200', 'Parts Cost',               'cogs'),
  ('warranty_cost',        '5300', 'Warranty Cost',            'cogs'),
  -- Expenses
  ('commission_expense',   '6000', 'Sales Commissions',        'expense'),
  ('advertising',          '6100', 'Advertising',              'expense'),
  ('payroll_expense',      '6200', 'Payroll',                  'expense'),
  ('rent',                 '6300', 'Rent',                     'expense'),
  ('software',             '6400', 'Software',                 'expense'),
  ('utilities',            '6500', 'Utilities',                'expense'),
  ('interest',             '6600', 'Floorplan Interest',       'expense')
) as c(system_key, code, name, category)
on conflict (dealership_id, system_key) where system_key is not null do nothing;

-- Every dealership created from here on needs the same chart before it can post.
-- Kept as an explicit callable act rather than a trigger, so account creation stays a
-- deliberate Accounting operation.
create or replace function public.accounting_seed_chart(p_dealership_id uuid)
returns int language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_added int;
begin
  insert into public.gl_accounts (dealership_id, system_key, code, name, category)
  select p_dealership_id, g.system_key, g.code, g.name, g.category
  from (
    select distinct on (system_key) system_key, code, name, category
    from public.gl_accounts
    where system_key is not null
    order by system_key, created_at asc
  ) g
  on conflict (dealership_id, system_key) where system_key is not null do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end;
$function$;

revoke all on function public.accounting_seed_chart(uuid) from public, anon, authenticated;
