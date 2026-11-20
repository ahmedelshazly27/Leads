-- Round 3: multi-currency (GCC launch). 001-009 are live and not edited.
--
--   1. orders, payments, subscriptions and waitlist get the customer's
--      country (ISO 3166-1 alpha-2; null for rows from before this
--      migration). Amounts stay in the currency that was charged.
--   2. costs.currency accepts any ISO 4217 code (the Stripe fee is stored in
--      the settlement currency, EUR for the B.V.'s account).
--   3. The included month and the free monthly check-in orders take the
--      currency (and country) of the order / membership they belong to,
--      instead of the KWD default.
--   4. fx_rates is now based on EUR, the reporting currency (the B.V. books
--      in EUR): eur_per_unit = EUR value of one unit of the currency.
--        EUR                    base, always 1
--        USD                    manual (the admin sets it; weekly is enough)
--        KWD                    manual, pegged to an undisclosed basket, so it
--                               moves every day: update it daily
--        SAR, AED, QAR, BHD, OMR fixed pegs to the US dollar (per_usd), so
--                               their EUR value follows the USD rate
--      kwd_per_unit is kept (derived) for older readers; nothing new uses it.
--   5. The dashboard views report in EUR (columns *_eur) and keep the raw
--      amount and currency where one order or plan has one; v_revenue_by_market
--      breaks revenue down per country and currency. The admin page can show
--      any other currency in fx_rates (KWD, USD) by converting client-side.

-- ---------------------------------------------------------------------------
-- 1. Country columns
-- ---------------------------------------------------------------------------

alter table public.orders        add column if not exists country text check (country ~ '^[A-Z]{2}$');
alter table public.payments      add column if not exists country text check (country ~ '^[A-Z]{2}$');
alter table public.subscriptions add column if not exists country text check (country ~ '^[A-Z]{2}$');
alter table public.waitlist      add column if not exists country text check (country ~ '^[A-Z]{2}$');

comment on column public.orders.country is
  'Country the customer chose at checkout (ISO 3166-1 alpha-2); it set the currency and price. Null for orders from before multi-currency.';
comment on column public.payments.country is
  'Customer country (from the checkout / subscription metadata), ISO-2. Null when unknown.';
comment on column public.subscriptions.country is
  'Customer country when the membership was bought, ISO-2. Null when unknown.';
comment on column public.waitlist.country is
  'Country of the person (ISO-2), e.g. a country we do not sell in yet.';

create index if not exists waitlist_country_idx on public.waitlist (country) where country is not null;

-- ---------------------------------------------------------------------------
-- 2. Costs in any currency
-- ---------------------------------------------------------------------------

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.costs'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%currency%'
  loop
    execute format('alter table public.costs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.costs add constraint costs_currency_check check (currency ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- 3. Currency of rows the database creates itself
-- ---------------------------------------------------------------------------

-- The included month (grant_included_membership inserts it with the KWD
-- default): take the currency and country of the report order.
create or replace function public.included_membership_currency()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if new.plan = 'included' and new.provider = 'manual'
     and new.provider_sub_id ~ '^included:[0-9a-fA-F-]{36}$' then
    select currency, country into v_order
    from public.orders where id = substring(new.provider_sub_id from 10)::uuid;
    if v_order.currency is not null then
      new.currency := v_order.currency;
      new.country := coalesce(new.country, v_order.country);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_included_currency on public.subscriptions;
create trigger subscriptions_included_currency
  before insert on public.subscriptions
  for each row execute function public.included_membership_currency();

-- Free check-in orders of yearly members (ensure_monthly_checkins inserts
-- them with amount 0 and the KWD default): take the membership's currency.
create or replace function public.checkin_order_currency()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sub record;
begin
  if new.product = 'checkin' and new.amount = 0 and new.subscription_id is not null then
    select currency, country into v_sub from public.subscriptions where id = new.subscription_id;
    if v_sub.currency is not null then
      new.currency := v_sub.currency;
      new.country := coalesce(new.country, v_sub.country);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_checkin_currency on public.orders;
create trigger orders_checkin_currency
  before insert on public.orders
  for each row execute function public.checkin_order_currency();

-- Rows written before this migration: the included months and zero check-ins
-- were all KWD then, which was right (Kuwait only), so nothing to correct.

-- ---------------------------------------------------------------------------
-- 4. Exchange rates based on EUR
-- ---------------------------------------------------------------------------

alter table public.fx_rates add column if not exists eur_per_unit numeric(20,10) check (eur_per_unit > 0);
alter table public.fx_rates add column if not exists basis text not null default 'manual'
  check (basis in ('base', 'peg', 'manual'));
alter table public.fx_rates add column if not exists per_usd numeric(14,6) check (per_usd > 0);
alter table public.fx_rates add column if not exists max_age_days int check (max_age_days > 0);
alter table public.fx_rates add column if not exists note text check (char_length(note) <= 300);
alter table public.fx_rates alter column kwd_per_unit drop not null;
alter table public.fx_rates drop constraint if exists fx_rates_peg_check;
alter table public.fx_rates add constraint fx_rates_peg_check check (basis <> 'peg' or per_usd is not null);

comment on table public.fx_rates is
  'Exchange rates for the dashboards. eur_per_unit = EUR value of one unit (EUR is the reporting currency, 1). '
  'basis: base (EUR), peg (fixed to USD: per_usd units per 1 USD; eur_per_unit follows the USD rate), '
  'manual (an admin sets eur_per_unit; max_age_days says how often). kwd_per_unit is derived, kept for older readers.';
comment on column public.fx_rates.eur_per_unit is 'EUR per one unit of the currency. Null = rate missing (amounts show as missing, never as zero).';
comment on column public.fx_rates.per_usd is 'Pegged currencies: units of the currency per 1 USD (the official peg).';
comment on column public.fx_rates.max_age_days is 'Manual rates: the dashboard warns when updated_at is older than this.';

-- Carry over rates an admin already set (KWD per unit) into EUR terms.
do $$
declare
  v_eur_kwd numeric;
begin
  select kwd_per_unit into v_eur_kwd from public.fx_rates where currency = 'EUR';
  if v_eur_kwd is not null and v_eur_kwd > 0 then
    update public.fx_rates
    set eur_per_unit = round(kwd_per_unit / v_eur_kwd, 10)
    where eur_per_unit is null and kwd_per_unit is not null and currency <> 'EUR';
  end if;
end $$;

insert into public.fx_rates (currency, eur_per_unit, basis, per_usd, max_age_days, note) values
  ('EUR', 1,    'base',   null,   null, 'Reporting currency.'),
  ('USD', null, 'manual', null,   7,    'EUR value of 1 USD. Set from the rate your accountant uses (e.g. the ECB reference rate).'),
  ('KWD', null, 'manual', null,   1,    'Kuwaiti dinar: pegged to an undisclosed basket, so it moves daily. Update every day you report.'),
  ('SAR', null, 'peg',    3.75,   null, 'Saudi riyal: fixed at 3.75 per USD.'),
  ('AED', null, 'peg',    3.6725, null, 'UAE dirham: fixed at 3.6725 per USD.'),
  ('QAR', null, 'peg',    3.64,   null, 'Qatari riyal: fixed at 3.64 per USD.'),
  ('BHD', null, 'peg',    0.376,  null, 'Bahraini dinar: fixed at 0.376 per USD.'),
  ('OMR', null, 'peg',    0.3845, null, 'Omani rial: fixed at 0.3845 per USD.')
on conflict (currency) do update set
  basis        = excluded.basis,
  per_usd      = excluded.per_usd,
  max_age_days = excluded.max_age_days,
  note         = coalesce(public.fx_rates.note, excluded.note),
  -- keep a rate an admin already set; EUR is always 1
  eur_per_unit = case when excluded.basis = 'base' then 1 else public.fx_rates.eur_per_unit end;

-- Recomputes the derived values: EUR = 1, pegged currencies from the USD
-- rate, and kwd_per_unit for every row. Runs after every change to fx_rates.
create or replace function public.refresh_fx_rates()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_usd numeric;
  v_kwd numeric;
begin
  update public.fx_rates set eur_per_unit = 1, updated_at = now()
  where basis = 'base' and eur_per_unit is distinct from 1;

  select eur_per_unit into v_usd from public.fx_rates where currency = 'USD';
  update public.fx_rates
  set eur_per_unit = case when v_usd is null then null else round(v_usd / per_usd, 10) end,
      updated_at = now()
  where basis = 'peg'
    and eur_per_unit is distinct from (case when v_usd is null then null else round(v_usd / per_usd, 10) end);

  select eur_per_unit into v_kwd from public.fx_rates where currency = 'KWD';
  update public.fx_rates
  set kwd_per_unit = case
        when currency = 'KWD' then 1
        when v_kwd is null or eur_per_unit is null then null
        else round(eur_per_unit / v_kwd, 6)
      end
  where kwd_per_unit is distinct from (case
        when currency = 'KWD' then 1
        when v_kwd is null or eur_per_unit is null then null
        else round(eur_per_unit / v_kwd, 6)
      end);
end;
$$;

create or replace function public.on_fx_rates_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- The refresh itself updates fx_rates: do not recurse.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.refresh_fx_rates();
  return null;
end;
$$;

drop trigger if exists fx_rates_refresh on public.fx_rates;
create trigger fx_rates_refresh
  after insert or update or delete on public.fx_rates
  for each statement execute function public.on_fx_rates_changed();

do $$ begin perform public.refresh_fx_rates(); end $$;

-- Units of p_to per one unit of p_from (null when a rate is missing).
create or replace function public.fx_rate(p_from text, p_to text)
returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_from is null or p_to is null then null
    when p_from = p_to then 1::numeric
    else (select f.eur_per_unit from public.fx_rates f where f.currency = p_from)
         / nullif((select t.eur_per_unit from public.fx_rates t where t.currency = p_to), 0)
  end;
$$;

-- The reporting currency of the views.
create or replace function public.reporting_currency()
returns text
language sql immutable
set search_path = ''
as $$ select 'EUR'::text $$;

-- Amount in EUR, or null when no rate is set for the currency.
create or replace function public.to_eur(p_amount numeric, p_currency text)
returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_amount is null then null
    when p_currency = 'EUR' then p_amount
    else p_amount * public.fx_rate(p_currency, 'EUR')
  end;
$$;

-- Still available for older queries: now goes through the EUR rates.
create or replace function public.to_kwd(p_amount numeric, p_currency text)
returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_amount is null then null
    when p_currency = 'KWD' then p_amount
    else p_amount * public.fx_rate(p_currency, 'KWD')
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Views in EUR
-- ---------------------------------------------------------------------------

drop view if exists public.v_order_economics;
drop view if exists public.v_daily_kpis;
drop view if exists public.v_mrr;
drop view if exists public.v_revenue_by_market;

-- Per order: revenue (raw and EUR), payment fee, image cost, other costs, gross margin.
create view public.v_order_economics
with (security_invoker = true) as
with pay as (
  select
    p.order_id,
    sum(p.amount) filter (where p.status in ('succeeded', 'refunded'))                       as revenue,
    case when count(distinct p.currency) = 1 then min(p.currency) end                         as revenue_currency,
    sum(public.to_eur(p.amount, p.currency)) filter (where p.status in ('succeeded', 'refunded')) as revenue_eur,
    -sum(public.to_eur(p.amount, p.currency)) filter (where p.status = 'refunded')             as refunded_eur,
    bool_or(public.to_eur(p.amount, p.currency) is null)                                     as fx_missing
  from public.payments p
  where p.order_id is not null
  group by p.order_id
), cst as (
  select
    c.order_id,
    sum(public.to_eur(c.amount, c.currency)) filter (where c.category = 'payment_fee')      as payment_fee_eur,
    sum(c.amount) filter (where c.category = 'image_generation' and c.currency = 'USD')     as image_cost_usd,
    sum(public.to_eur(c.amount, c.currency)) filter (where c.category = 'image_generation') as image_cost_eur,
    sum(public.to_eur(c.amount, c.currency))
      filter (where c.category not in ('payment_fee', 'image_generation'))                  as other_cost_eur,
    bool_or(public.to_eur(c.amount, c.currency) is null)                                    as fx_missing
  from public.costs c
  where c.order_id is not null
  group by c.order_id
), gen as (
  select g.order_id, count(*) as generations, count(*) filter (where g.approved) as approved_generations
  from public.generations g
  group by g.order_id
)
select
  o.id                                   as order_id,
  o.user_id,
  o.product,
  o.plan,
  o.status,
  o.country,
  o.currency,
  o.amount                               as list_amount,
  o.assigned_reviewer,
  o.created_at,
  o.paid_at,
  o.submitted_at,
  o.delivered_at,
  coalesce(pay.revenue, 0)               as revenue,
  coalesce(pay.revenue_currency, o.currency) as revenue_currency,
  coalesce(pay.revenue_eur, 0)           as revenue_eur,
  coalesce(pay.refunded_eur, 0)          as refunded_eur,
  coalesce(cst.payment_fee_eur, 0)       as payment_fee_eur,
  coalesce(cst.image_cost_usd, 0)        as image_cost_usd,
  coalesce(cst.image_cost_eur, 0)        as image_cost_eur,
  coalesce(cst.other_cost_eur, 0)        as other_cost_eur,
  coalesce(gen.generations, 0)           as generations,
  coalesce(gen.approved_generations, 0)  as approved_generations,
  case when coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) then null
       else coalesce(pay.revenue_eur, 0) - coalesce(cst.payment_fee_eur, 0)
            - coalesce(cst.image_cost_eur, 0) - coalesce(cst.other_cost_eur, 0)
  end                                    as gross_margin_eur,
  case when coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) or coalesce(pay.revenue_eur, 0) <= 0 then null
       else round((pay.revenue_eur - coalesce(cst.payment_fee_eur, 0) - coalesce(cst.image_cost_eur, 0)
                   - coalesce(cst.other_cost_eur, 0)) / pay.revenue_eur * 100, 1)
  end                                    as gross_margin_pct,
  coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) as fx_missing
from public.orders o
left join pay on pay.order_id = o.id
left join cst on cst.order_id = o.id
left join gen on gen.order_id = o.id
where (select public.is_admin()) or public.is_service_role();

-- Per day (Kuwait time, UTC+3 like the rest of the Gulf except UAE/Oman at
-- UTC+4): orders, revenue, new customers, ad spend, CAC, ROAS, in EUR.
create view public.v_daily_kpis
with (security_invoker = true) as
with ord as (
  select (o.paid_at at time zone 'Asia/Kuwait')::date as day,
         count(*) filter (where o.product = 'report')  as orders,
         count(*) filter (where o.product = 'checkin') as checkins
  from public.orders o
  where o.paid_at is not null and o.status not in ('pending_payment', 'cancelled')
  group by 1
), dlv as (
  select (o.delivered_at at time zone 'Asia/Kuwait')::date as day, count(*) as delivered
  from public.orders o
  where o.delivered_at is not null
  group by 1
), rev as (
  select (p.created_at at time zone 'Asia/Kuwait')::date as day,
         sum(public.to_eur(p.amount, p.currency)) filter (where p.status in ('succeeded', 'refunded')) as revenue_eur,
         -sum(public.to_eur(p.amount, p.currency)) filter (where p.status = 'refunded') as refunds_eur,
         bool_or(public.to_eur(p.amount, p.currency) is null) as fx_missing
  from public.payments p
  group by 1
), firsts as (
  select o.user_id, min(o.paid_at) as first_paid_at
  from public.orders o
  where o.paid_at is not null and o.user_id is not null and o.status not in ('pending_payment', 'cancelled')
  group by o.user_id
), newc as (
  select (f.first_paid_at at time zone 'Asia/Kuwait')::date as day, count(*) as new_customers
  from firsts f
  group by 1
), sig as (
  select (pr.created_at at time zone 'Asia/Kuwait')::date as day, count(*) as signups
  from public.profiles pr
  where pr.role = 'customer'
  group by 1
), wl as (
  select (w.created_at at time zone 'Asia/Kuwait')::date as day,
         count(*) as waitlist_joins,
         count(*) filter (where w.gender = 'female') as waitlist_women
  from public.waitlist w
  group by 1
), ads as (
  select a.date as day,
         sum(public.to_eur(a.spend, a.currency)) as ad_spend_eur,
         sum(a.impressions) as impressions,
         sum(a.clicks) as clicks,
         sum(a.purchases) as ad_purchases,
         bool_or(public.to_eur(a.spend, a.currency) is null) as fx_missing
  from public.ad_spend a
  group by 1
), cst as (
  select (c.created_at at time zone 'Asia/Kuwait')::date as day,
         sum(public.to_eur(c.amount, c.currency)) as costs_eur,
         sum(c.amount) filter (where c.category = 'image_generation' and c.currency = 'USD') as image_cost_usd,
         bool_or(public.to_eur(c.amount, c.currency) is null) as fx_missing
  from public.costs c
  group by 1
), days as (
  select day from ord union select day from dlv union select day from rev union select day from newc
  union select day from sig union select day from wl union select day from ads union select day from cst
)
select
  d.day                                      as date,
  coalesce(ord.orders, 0)                    as orders,
  coalesce(ord.checkins, 0)                  as checkins,
  coalesce(dlv.delivered, 0)                 as delivered,
  coalesce(rev.revenue_eur, 0)               as revenue_eur,
  coalesce(rev.refunds_eur, 0)               as refunds_eur,
  coalesce(newc.new_customers, 0)            as new_customers,
  coalesce(sig.signups, 0)                   as signups,
  coalesce(wl.waitlist_joins, 0)             as waitlist_joins,
  coalesce(wl.waitlist_women, 0)             as waitlist_women,
  coalesce(ads.ad_spend_eur, 0)              as ad_spend_eur,
  coalesce(ads.impressions, 0)               as impressions,
  coalesce(ads.clicks, 0)                    as clicks,
  coalesce(ads.ad_purchases, 0)              as ad_purchases,
  coalesce(cst.costs_eur, 0)                 as costs_eur,
  coalesce(cst.image_cost_usd, 0)            as image_cost_usd,
  case when coalesce(newc.new_customers, 0) > 0 and coalesce(ads.ad_spend_eur, 0) > 0
       then round(ads.ad_spend_eur / newc.new_customers, 2) end   as cac_eur,
  case when coalesce(ads.ad_spend_eur, 0) > 0
       then round(coalesce(rev.revenue_eur, 0) / ads.ad_spend_eur, 2) end as roas,
  coalesce(rev.fx_missing, false) or coalesce(ads.fx_missing, false) or coalesce(cst.fx_missing, false) as fx_missing
from days d
left join ord  on ord.day  = d.day
left join dlv  on dlv.day  = d.day
left join rev  on rev.day  = d.day
left join newc on newc.day = d.day
left join sig  on sig.day  = d.day
left join wl   on wl.day   = d.day
left join ads  on ads.day  = d.day
left join cst  on cst.day  = d.day
where (select public.is_admin()) or public.is_service_role();

-- Monthly recurring revenue per plan and currency: active subscriptions x
-- monthly equivalent, raw and in EUR. The included month (no payment) is
-- left out. Trialing members are shown separately.
create view public.v_mrr
with (security_invoker = true) as
select
  s.plan,
  s.currency,
  count(*) filter (where s.status = 'active')   as active,
  count(*) filter (where s.status = 'trialing') as trialing,
  count(*) filter (where s.status = 'past_due') as past_due,
  count(*) filter (where s.status in ('active', 'trialing') and s.cancel_at is not null) as cancelling,
  coalesce(sum(case s.plan when 'yearly' then s.amount / 12 else s.amount end)
           filter (where s.status = 'active'), 0)   as mrr,
  coalesce(sum(case s.plan when 'yearly' then s.amount / 12 else s.amount end)
           filter (where s.status = 'trialing'), 0) as trialing_mrr,
  coalesce(sum(public.to_eur(case s.plan when 'yearly' then s.amount / 12 else s.amount end, s.currency))
           filter (where s.status = 'active'), 0)   as mrr_eur,
  coalesce(sum(public.to_eur(case s.plan when 'yearly' then s.amount / 12 else s.amount end, s.currency))
           filter (where s.status = 'trialing'), 0) as trialing_mrr_eur,
  coalesce(bool_or(s.amount is null or public.to_eur(s.amount, s.currency) is null)
    filter (where s.status in ('active', 'trialing')), false) as data_missing
from public.subscriptions s
where s.status <> 'canceled'
  and s.plan <> 'included'
  and ((select public.is_admin()) or public.is_service_role())
group by s.plan, s.currency;

-- Revenue per Kuwait-time month, country and currency (raw and EUR). The
-- country is the payment's, else its order's or membership's; null = unknown
-- (payments from before multi-currency).
create view public.v_revenue_by_market
with (security_invoker = true) as
select
  date_trunc('month', p.created_at at time zone 'Asia/Kuwait')::date as month,
  coalesce(p.country, o.country, s.country)                            as country,
  p.currency,
  count(*) filter (where p.status = 'succeeded')                       as payments,
  count(distinct p.user_id) filter (where p.status = 'succeeded')      as paying_customers,
  coalesce(sum(p.amount) filter (where p.status = 'succeeded'), 0)     as gross,
  coalesce(-sum(p.amount) filter (where p.status = 'refunded'), 0)     as refunds,
  coalesce(sum(p.amount) filter (where p.status in ('succeeded', 'refunded')), 0) as net,
  coalesce(sum(public.to_eur(p.amount, p.currency)) filter (where p.status in ('succeeded', 'refunded')), 0) as net_eur,
  coalesce(bool_or(public.to_eur(p.amount, p.currency) is null), false) as fx_missing
from public.payments p
left join public.orders o on o.id = p.order_id
left join public.subscriptions s on s.id = p.subscription_id
where p.status in ('succeeded', 'refunded')
  and ((select public.is_admin()) or public.is_service_role())
group by 1, 2, 3;

revoke all on public.v_order_economics, public.v_daily_kpis, public.v_mrr, public.v_revenue_by_market from anon;
revoke all on public.v_order_economics, public.v_daily_kpis, public.v_mrr, public.v_revenue_by_market from authenticated;
grant select on public.v_order_economics, public.v_daily_kpis, public.v_mrr, public.v_revenue_by_market
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Function access
-- ---------------------------------------------------------------------------

revoke execute on function public.included_membership_currency() from public, anon, authenticated;
revoke execute on function public.checkin_order_currency() from public, anon, authenticated;
revoke execute on function public.on_fx_rates_changed() from public, anon, authenticated;
revoke execute on function public.refresh_fx_rates() from public, anon, authenticated;
grant execute on function public.refresh_fx_rates() to service_role;

revoke execute on function public.fx_rate(text, text) from public, anon;
revoke execute on function public.to_eur(numeric, text) from public, anon;
revoke execute on function public.to_kwd(numeric, text) from public, anon;
grant execute on function public.fx_rate(text, text) to authenticated, service_role;
grant execute on function public.to_eur(numeric, text) to authenticated, service_role;
grant execute on function public.to_kwd(numeric, text) to authenticated, service_role;
grant execute on function public.reporting_currency() to authenticated, service_role;
