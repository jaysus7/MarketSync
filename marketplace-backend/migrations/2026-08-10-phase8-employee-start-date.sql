-- Phase 8.0: employment start date belongs to the canonical employment record.
--
-- Do not infer this from staff_members.created_at: older employees can be entered into
-- MarketSync years after they started working at the dealership.

alter table public.staff_members
  add column if not exists start_date date;

comment on column public.staff_members.start_date is
  'Actual employment start date. Null means the dealership has not recorded it.';

-- An employee may exist before login invitation, but one dealership cannot carry two
-- uninvited employment identities for the same email. Inviting links that row to Auth.
create unique index if not exists staff_members_dealership_uninvited_email_uidx
  on public.staff_members (dealership_id, lower(email))
  where user_id is null and email is not null;
