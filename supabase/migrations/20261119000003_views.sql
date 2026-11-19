-- Dashboard views (admin only). security_invoker = true so the caller's RLS
-- applies, plus an explicit admin/service check so customers never see rows.
-- Everything is reported in KWD. Costs in other currencies (image API in USD,
-- ad spend in the ad account's currency) are converted with fx_rates, which an
-- admin keeps up to date. When a needed rate is missing, the converted value
-- is null and fx_missing is true, rather than silently counting it as zero.

create table if not exists public.fx_rates (
  currency     text primary key check (currency ~ '^[A-Z]{3}$'),
  kwd_per_unit numeric(14,6) not null check (kwd_per_unit > 0),
  updated_at   timestamptz not null default now()
);
comment on table public.fx_rates is 'KWD per one unit of the currency. Set USD and EUR (and the Meta ad account currency) yourself; KWD is 1.';

insert into public.fx_rates (currency, kwd_per_unit) values ('KWD', 1) on conflict (currency) do nothing;

alter table public.fx_rates enable row level security;
drop policy if exists "fx_rates: admin all" on public.fx_rates;
create policy "fx_rates: admin all" on public.fx_rates
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Amount in KWD, or null when no rate is set for the currency.
create or replace function public.to_kwd(p_amount numeric, p_currency text)
returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_amount is null then null
    when p_currency = 'KWD' then p_amount
    else p_amount * (select r.kwd_per_unit from public.fx_rates r where r.currency = p_currency)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Per order: revenue, payment fee, image cost, other costs, gross margin.
-- ---------------------------------------------------------------------------
create or replace view public.v_order_economics
with (security_invoker = true) as
with pay as (
  select
    p.order_id,
    sum(public.to_kwd(p.amount, p.currency)) filter (where p.status in ('succeeded', 'refunded')) as revenue_kwd,
    -sum(public.to_kwd(p.amount, p.currency)) filter (where p.status = 'refunded')               as refunded_kwd,
    bool_or(public.to_kwd(p.amount, p.currency) is null)                                         as fx_missing
  from public.payments p
  where p.order_id is not null
  group by p.order_id
), cst as (
  select
    c.order_id,
    sum(public.to_kwd(c.amount, c.currency)) filter (where c.category = 'payment_fee')          as payment_fee_kwd,
    sum(c.amount) filter (where c.category = 'image_generation' and c.currency = 'USD')         as image_cost_usd,
    sum(public.to_kwd(c.amount, c.currency)) filter (where c.category = 'image_generation')     as image_cost_kwd,
    sum(public.to_kwd(c.amount, c.currency))
      filter (where c.category not in ('payment_fee', 'image_generation'))                      as other_cost_kwd,
    bool_or(public.to_kwd(c.amount, c.currency) is null)                                        as fx_missing
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
  o.assigned_reviewer,
  o.created_at,
  o.paid_at,
  o.submitted_at,
  o.delivered_at,
  coalesce(pay.revenue_kwd, 0)           as revenue_kwd,
  coalesce(pay.refunded_kwd, 0)          as refunded_kwd,
  coalesce(cst.payment_fee_kwd, 0)       as payment_fee_kwd,
  coalesce(cst.image_cost_usd, 0)        as image_cost_usd,
  coalesce(cst.image_cost_kwd, 0)        as image_cost_kwd,
  coalesce(cst.other_cost_kwd, 0)        as other_cost_kwd,
  coalesce(gen.generations, 0)           as generations,
  coalesce(gen.approved_generations, 0)  as approved_generations,
  case when coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) then null
       else coalesce(pay.revenue_kwd, 0) - coalesce(cst.payment_fee_kwd, 0)
            - coalesce(cst.image_cost_kwd, 0) - coalesce(cst.other_cost_kwd, 0)
  end                                    as gross_margin_kwd,
  case when coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) or coalesce(pay.revenue_kwd, 0) <= 0 then null
       else round((pay.revenue_kwd - coalesce(cst.payment_fee_kwd, 0) - coalesce(cst.image_cost_kwd, 0)
                   - coalesce(cst.other_cost_kwd, 0)) / pay.revenue_kwd * 100, 1)
  end                                    as gross_margin_pct,
  coalesce(pay.fx_missing, false) or coalesce(cst.fx_missing, false) as fx_missing
from public.orders o
left join pay on pay.order_id = o.id
left join cst on cst.order_id = o.id
left join gen on gen.order_id = o.id
where (select public.is_admin()) or public.is_service_role();

-- ---------------------------------------------------------------------------
-- Per day (Kuwait time): orders, revenue, new customers, ad spend, CAC, ROAS.
-- ---------------------------------------------------------------------------
create or replace view public.v_daily_kpis
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
         sum(public.to_kwd(p.amount, p.currency)) filter (where p.status in ('succeeded', 'refunded')) as revenue_kwd,
         -sum(public.to_kwd(p.amount, p.currency)) filter (where p.status = 'refunded') as refunds_kwd,
         bool_or(public.to_kwd(p.amount, p.currency) is null) as fx_missing
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
         sum(public.to_kwd(a.spend, a.currency)) as ad_spend_kwd,
         sum(a.impressions) as impressions,
         sum(a.clicks) as clicks,
         sum(a.purchases) as ad_purchases,
         bool_or(public.to_kwd(a.spend, a.currency) is null) as fx_missing
  from public.ad_spend a
  group by 1
), cst as (
  select (c.created_at at time zone 'Asia/Kuwait')::date as day,
         sum(public.to_kwd(c.amount, c.currency)) as costs_kwd,
         sum(c.amount) filter (where c.category = 'image_generation' and c.currency = 'USD') as image_cost_usd,
         bool_or(public.to_kwd(c.amount, c.currency) is null) as fx_missing
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
  coalesce(rev.revenue_kwd, 0)               as revenue_kwd,
  coalesce(rev.refunds_kwd, 0)               as refunds_kwd,
  coalesce(newc.new_customers, 0)            as new_customers,
  coalesce(sig.signups, 0)                   as signups,
  coalesce(wl.waitlist_joins, 0)             as waitlist_joins,
  coalesce(wl.waitlist_women, 0)             as waitlist_women,
  coalesce(ads.ad_spend_kwd, 0)              as ad_spend_kwd,
  coalesce(ads.impressions, 0)               as impressions,
  coalesce(ads.clicks, 0)                    as clicks,
  coalesce(ads.ad_purchases, 0)              as ad_purchases,
  coalesce(cst.costs_kwd, 0)                 as costs_kwd,
  coalesce(cst.image_cost_usd, 0)            as image_cost_usd,
  case when coalesce(newc.new_customers, 0) > 0 and coalesce(ads.ad_spend_kwd, 0) > 0
       then round(ads.ad_spend_kwd / newc.new_customers, 3) end   as cac_kwd,
  case when coalesce(ads.ad_spend_kwd, 0) > 0
       then round(coalesce(rev.revenue_kwd, 0) / ads.ad_spend_kwd, 2) end as roas,
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

-- ---------------------------------------------------------------------------
-- Monthly recurring revenue: active subscriptions x monthly equivalent.
-- Trialing members are shown separately (they have not paid for the plan yet).
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
  and ((select public.is_admin()) or public.is_service_role())
group by s.plan;

revoke all on public.v_order_economics, public.v_daily_kpis, public.v_mrr from anon;
revoke all on public.v_order_economics, public.v_daily_kpis, public.v_mrr from authenticated;
grant select on public.v_order_economics, public.v_daily_kpis, public.v_mrr to authenticated, service_role;
