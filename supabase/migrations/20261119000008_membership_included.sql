-- Round 2 follow-ups (001-007 are not edited):
--   1. Included membership: a paid "report" order (report only) gives 30 days
--      of membership with no auto-renew. It is a subscriptions row with
--      provider 'manual', plan 'included', amount 0, provider_sub_id
--      'included:<order id>'. Granted when the order is paid, ended when the
--      order is refunded, when a paid (Stripe) membership starts, or when the
--      30 days are over (expire_included_memberships, daily).
--   2. v_mrr and ensure_monthly_checkins ignore included memberships (no
--      revenue; like the Stripe trial, the included month has no check-in: the
--      report is that month's scan).
--   3. email_reminders: one row per reminder email sent (idempotency marker
--      for the membership-reminders function), and membership_reminders_due().
--   4. Retention clock: records_due_for_retention() now uses order and
--      membership dates (created, paid, submitted, delivered, membership end)
--      instead of orders.updated_at, so an admin edit no longer restarts the
--      24 months.

-- ---------------------------------------------------------------------------
-- 1. Included membership
-- ---------------------------------------------------------------------------

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('monthly', 'yearly', 'included'));
comment on column public.subscriptions.plan is
  'monthly / yearly: paid membership (Stripe). included: the 30 days of membership that come with a report bought on its own (provider manual, amount 0, never renews; current_period_end is when it ends).';

create index if not exists subscriptions_included_open_idx on public.subscriptions (current_period_end)
  where plan = 'included' and status = 'active';

-- Days of membership included with the report.
create or replace function public.included_membership_days()
returns int
language sql immutable
set search_path = ''
as $$ select 30 $$;

-- Grants (or extends) the included membership for a paid report-only order.
-- Does nothing when the order is not a paid report-only order, the account is
-- gone, or the customer already has a paid membership. Idempotent: one row per
-- order (provider_sub_id 'included:<order id>'). Returns the subscription id.
create or replace function public.grant_included_membership(p_order uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order  record;
  v_start  timestamptz;
  v_end    timestamptz;
  v_sub    uuid;
begin
  select id, user_id, plan, product, status, paid_at, subscription_id into v_order
  from public.orders where id = p_order;
  if v_order.id is null or v_order.user_id is null
     or v_order.product <> 'report' or v_order.plan is distinct from 'report'
     or v_order.status not in ('paid', 'awaiting_photos', 'in_review', 'changes_requested', 'delivered') then
    return null;
  end if;

  -- Already granted for this order.
  select id into v_sub from public.subscriptions
  where provider = 'manual' and provider_sub_id = 'included:' || p_order::text;
  if v_sub is not null then
    return v_sub;
  end if;

  -- A paid membership already gives the benefits.
  if exists (
    select 1 from public.subscriptions s
    where s.user_id = v_order.user_id and s.plan <> 'included'
      and s.status in ('trialing', 'active', 'past_due')
  ) then
    return null;
  end if;

  v_start := coalesce(v_order.paid_at, now());
  v_end := v_start + make_interval(days => public.included_membership_days());

  -- A second report while an included month is running: one membership row,
  -- running until the later end.
  select id into v_sub from public.subscriptions
  where user_id = v_order.user_id and plan = 'included' and status = 'active'
  order by current_period_end desc nulls last
  limit 1
  for update;

  if v_sub is not null then
    update public.subscriptions
    set current_period_end = greatest(current_period_end, v_end)
    where id = v_sub;
  else
    insert into public.subscriptions (user_id, provider, provider_sub_id, plan, status, amount, currency, current_period_end)
    values (v_order.user_id, 'manual', 'included:' || p_order::text, 'included', 'active', 0, 'KWD', v_end)
    on conflict (provider, provider_sub_id) do nothing
    returning id into v_sub;
    if v_sub is null then
      select id into v_sub from public.subscriptions
      where provider = 'manual' and provider_sub_id = 'included:' || p_order::text;
    end if;
  end if;

  update public.orders set subscription_id = v_sub where id = p_order and subscription_id is null;
  return v_sub;
end;
$$;

-- Ends included memberships whose 30 days are over. Returns how many.
create or replace function public.expire_included_memberships()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.subscriptions
  set status = 'canceled', canceled_at = current_period_end
  where plan = 'included' and status = 'active'
    and (current_period_end is null or current_period_end <= now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A report-only order was refunded: its days come off the included month. The
-- included row (one per customer, possibly extended by a second report) then
-- runs until 30 days after the latest other report still paid, or ends now
-- when there is none or that date has passed.
create or replace function public.recompute_included_membership(p_order uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sub  uuid;
  v_end  timestamptz;
begin
  select s.id into v_sub
  from public.subscriptions s
  where s.plan = 'included' and s.status = 'active'
    and (s.provider_sub_id = 'included:' || p_order::text
         or s.id = (select o.subscription_id from public.orders o where o.id = p_order))
  limit 1
  for update;
  if v_sub is null then
    return;
  end if;

  select max(coalesce(o.paid_at, o.created_at) + make_interval(days => public.included_membership_days())) into v_end
  from public.orders o
  where o.subscription_id = v_sub and o.id <> p_order
    and o.product = 'report' and o.plan = 'report'
    and o.status in ('paid', 'awaiting_photos', 'in_review', 'changes_requested', 'delivered');

  if v_end is null or v_end <= now() then
    update public.subscriptions set status = 'canceled', canceled_at = now() where id = v_sub;
  else
    update public.subscriptions set current_period_end = v_end where id = v_sub;
  end if;
end;
$$;

-- Report-only order paid -> included membership; refunded -> it ends.
create or replace function public.on_report_order_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.product <> 'report' or new.plan is distinct from 'report' or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status in ('paid', 'awaiting_photos') then
    perform public.grant_included_membership(new.id);
  elsif new.status = 'refunded' then
    perform public.recompute_included_membership(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_included_membership on public.orders;
create trigger orders_included_membership
  after update of status on public.orders
  for each row execute function public.on_report_order_status();

-- A paid membership starting (Stripe trial or active) replaces the included
-- month. create-checkout already starts its trial at the end of the included
-- month, so the benefits run on without a gap.
create or replace function public.on_paid_membership_started()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.plan <> 'included' and new.user_id is not null and new.status in ('trialing', 'active') then
    update public.subscriptions
    set status = 'canceled', canceled_at = now()
    where user_id = new.user_id and plan = 'included' and status = 'active' and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_replace_included on public.subscriptions;
create trigger subscriptions_replace_included
  after insert or update of status, user_id on public.subscriptions
  for each row execute function public.on_paid_membership_started();

-- Report-only orders paid before this migration: grant what is still left of
-- their 30 days (orders paid more than 30 days ago get nothing: it is over).
select public.grant_included_membership(o.id)
from public.orders o
where o.product = 'report' and o.plan = 'report'
  and o.status in ('awaiting_photos', 'in_review', 'changes_requested', 'delivered')
  and o.paid_at > now() - make_interval(days => public.included_membership_days());

-- ---------------------------------------------------------------------------
-- 2. MRR and check-ins ignore the included month
-- ---------------------------------------------------------------------------

create or replace view public.v_mrr
with (security_invoker = true) as
select
  s.plan,
  count(*) filter (where s.status = 'active')   as active,
  count(*) filter (where s.status = 'trialing') as trialing,
  count(*) filter (where s.status = 'past_due') as past_due,
  count(*) filter (where s.status in ('active', 'trialing') and s.cancel_at is not null) as cancelling,
  coalesce(sum(public.to_kwd(case s.plan when 'yearly' then s.amount / 12 else s.amount end, s.currency))
           filter (where s.status = 'active'), 0)   as mrr_kwd,
  coalesce(sum(public.to_kwd(case s.plan when 'yearly' then s.amount / 12 else s.amount end, s.currency))
           filter (where s.status = 'trialing'), 0) as trialing_mrr_kwd,
  bool_or(s.amount is null or public.to_kwd(s.amount, s.currency) is null)
    filter (where s.status in ('active', 'trialing')) as data_missing
from public.subscriptions s
where s.status <> 'canceled'
  and s.plan <> 'included'
  and ((select public.is_admin()) or public.is_service_role())
group by s.plan;

-- Same as in 001, written out so the rule is explicit: only a paid yearly
-- membership gets the scheduled monthly check-in (monthly members get theirs
-- from each paid invoice). The included month and a Stripe trial get none.
create or replace function public.ensure_monthly_checkins()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with due as (
    select s.id as subscription_id, s.user_id, s.provider
    from public.subscriptions s
    where s.plan = 'yearly'
      and s.status = 'active'
      and s.user_id is not null
      and not exists (
        select 1 from public.orders o
        where o.user_id = s.user_id
          and (
            (o.product = 'checkin' and o.created_at > now() - interval '30 days')
            or (o.product = 'report' and o.created_at > now() - interval '30 days')
            or o.status in ('awaiting_photos', 'pending_payment')
          )
      )
  ), ins as (
    insert into public.orders (user_id, product, status, amount, provider, subscription_id, paid_at)
    select user_id, 'checkin', 'awaiting_photos', 0, provider, subscription_id, now() from due
    returning id
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reminder emails
-- ---------------------------------------------------------------------------

create table if not exists public.email_reminders (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('included_ending', 'yearly_renewal')),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_id         uuid references public.profiles (id) on delete set null,
  -- The period end the reminder is about: one email per kind and period.
  period_end      timestamptz not null,
  locale          text check (locale in ('en', 'ar')),
  -- Null while the email is being sent (a claim); set once the provider accepted it.
  sent_at         timestamptz,
  provider_id     text,
  created_at      timestamptz not null default now()
);
create unique index if not exists email_reminders_once_uidx on public.email_reminders (kind, subscription_id, period_end);
create index if not exists email_reminders_user_idx on public.email_reminders (user_id);
alter table public.email_reminders enable row level security;
comment on table public.email_reminders is 'One row per membership reminder email (membership-reminders function). Service role only.';
revoke all on public.email_reminders from anon, authenticated;

-- Memberships that need a reminder now and have not had one for this period:
--   included_ending  included month ending within 5 days
--   yearly_renewal   paid yearly membership whose 12 months end within 30 days
--                    and that is not cancelling (it then continues monthly)
-- (dropped first: the result columns may differ when this file is re-applied)
drop function if exists public.membership_reminders_due(int);
create or replace function public.membership_reminders_due(p_limit int default 200)
returns table (kind text, subscription_id uuid, user_id uuid, period_end timestamptz, locale text, full_name text,
               schedule_failed boolean)
language sql stable security definer
set search_path = ''
as $$
  select r.kind, r.id, r.user_id, r.current_period_end, p.locale, p.full_name,
    -- The yearly-then-monthly Stripe schedule failed and was not created since:
    -- the membership would renew yearly, so the usual reminder text is wrong.
    (r.kind = 'yearly_renewal' and exists (
      select 1 from public.audit_log f
      where f.action = 'stripe.schedule_failed' and f.target_id = r.id::text
        and not exists (
          select 1 from public.audit_log c
          where c.action = 'stripe.schedule_created' and c.target_id = r.id::text and c.at > f.at
        )
    )) as schedule_failed
  from (
    select 'included_ending'::text as kind, s.id, s.user_id, s.current_period_end
    from public.subscriptions s
    where s.plan = 'included' and s.status = 'active'
      and s.current_period_end > now() and s.current_period_end <= now() + interval '5 days'
    union all
    select 'yearly_renewal'::text, s.id, s.user_id, s.current_period_end
    from public.subscriptions s
    where s.plan = 'yearly' and s.status = 'active' and s.cancel_at is null
      and s.current_period_end > now() and s.current_period_end <= now() + interval '30 days'
  ) r
  join public.profiles p on p.id = r.user_id
  where not exists (
    select 1 from public.email_reminders e
    where e.kind = r.kind and e.subscription_id = r.id and e.period_end = r.current_period_end
  )
  order by r.current_period_end
  limit greatest(1, least(p_limit, 1000));
$$;

-- ---------------------------------------------------------------------------
-- 4. Retention clock (replaces the 006 version)
-- ---------------------------------------------------------------------------

-- Customers with no current membership whose last activity is older than
-- p_months, and who still have records to clear. Activity = account created,
-- an order created / paid / submitted / delivered, or a membership ending.
-- orders.updated_at is deliberately not used: an admin edit or a status fix on
-- an old order must not restart the 24 months.
create or replace function public.records_due_for_retention(p_months int default 24, p_limit int default 100)
returns table (user_id uuid, last_activity timestamptz)
language sql stable security definer
set search_path = ''
as $$
  with activity as (
    select
      p.id as user_id,
      greatest(
        p.created_at,
        (select max(greatest(o.created_at, o.paid_at, o.submitted_at, o.delivered_at))
           from public.orders o where o.user_id = p.id),
        -- A membership ends when its status became canceled (audit_log, written
        -- by the subscriptions_audit trigger). Without that record: its period
        -- end, or canceled_at when that is earlier. (Stripe's canceled_at is when
        -- the cancellation was requested, which can be months before the end,
        -- so it is not used on its own.)
        (select max(greatest(
                  s.created_at,
                  coalesce(
                    (select max(a.at) from public.audit_log a
                      where a.action = 'subscriptions.status' and a.target_type = 'subscriptions'
                        and a.target_id = s.id::text and a.meta ->> 'to' = 'canceled'),
                    least(s.current_period_end, s.canceled_at))))
           from public.subscriptions s where s.user_id = p.id)
      ) as last_at
    from public.profiles p
    where p.role = 'customer'
      and not exists (
        select 1 from public.subscriptions s
        where s.user_id = p.id and s.status in ('trialing', 'active', 'past_due')
      )
  )
  select a.user_id, a.last_at
  from activity a
  where a.last_at < now() - make_interval(months => p_months)
    and (
      exists (select 1 from public.scans s where s.user_id = a.user_id)
      or exists (
        select 1 from public.reviews r join public.orders o on o.id = r.order_id
        where o.user_id = a.user_id
          and (r.notes is not null or r.item_notes <> '{}'::jsonb or r.marker_grades <> '{}'::jsonb or r.checklist <> '{}'::jsonb)
      )
      or exists (
        select 1 from public.generations g join public.orders o on o.id = g.order_id
        where o.user_id = a.user_id and (g.prompt <> '' or g.remarks is not null or g.output_path is not null)
      )
    )
  order by a.last_at
  limit greatest(1, least(p_limit, 1000));
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.grant_included_membership(uuid) from public, anon, authenticated;
revoke execute on function public.expire_included_memberships() from public, anon, authenticated;
revoke execute on function public.on_report_order_status() from public, anon, authenticated;
revoke execute on function public.recompute_included_membership(uuid) from public, anon, authenticated;
revoke execute on function public.on_paid_membership_started() from public, anon, authenticated;
revoke execute on function public.membership_reminders_due(int) from public, anon, authenticated;
revoke execute on function public.records_due_for_retention(int, int) from public, anon, authenticated;
revoke execute on function public.ensure_monthly_checkins() from public, anon, authenticated;
grant execute on function public.grant_included_membership(uuid) to service_role;
grant execute on function public.expire_included_memberships() to service_role;
grant execute on function public.membership_reminders_due(int) to service_role;
grant execute on function public.records_due_for_retention(int, int) to service_role;
grant execute on function public.ensure_monthly_checkins() to service_role;
grant execute on function public.included_membership_days() to authenticated, service_role;
