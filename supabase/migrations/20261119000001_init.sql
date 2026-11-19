-- Initial schema: profiles, consents, orders, subscriptions, payments, scans,
-- scan photos, reviews, image generations, costs, ad spend, waitlist, audit log.
-- Contract: docs/BACKEND.md. Every table has row level security on.
-- Money: KWD uses 3 decimals (numeric(10,3)); provider costs use 4.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text check (char_length(full_name) <= 200),
  email              text check (char_length(email) <= 320),
  phone              text check (char_length(phone) <= 32),
  locale             text not null default 'en' check (locale in ('en', 'ar')),
  gender             text check (gender in ('male', 'female')),
  birth_year         int check (birth_year between 1900 and 2100),
  role               text not null default 'customer' check (role in ('customer', 'reviewer', 'admin')),
  -- Set only for reviewers/admins who review orders; orders are matched on it.
  reviewer_gender    text check (reviewer_gender in ('male', 'female')),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user. role and reviewer_gender can only be changed by an admin or the server.';

create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('age18', 'terms', 'privacy', 'photos', 'marketing')),
  version      text not null check (char_length(version) between 1 and 40),
  granted_at   timestamptz not null default now(),
  withdrawn_at timestamptz
);
comment on table public.consents is 'Append-only consent record. Customers may only set withdrawn_at on their own rows.';

create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles (id) on delete set null,
  provider             text not null default 'stripe' check (provider in ('stripe', 'checkout_com', 'manual')),
  provider_sub_id      text not null,
  provider_customer_id text,
  plan                 text not null check (plan in ('monthly', 'yearly')),
  status               text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  amount               numeric(10,3),
  currency             text not null default 'KWD' check (currency ~ '^[A-Z]{3}$'),
  current_period_end   timestamptz,
  trial_end            timestamptz,
  cancel_at            timestamptz,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_sub_id)
);

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  -- Null after the customer deletes their account (orders are kept for accounting).
  user_id           uuid references public.profiles (id) on delete set null,
  product           text not null check (product in ('report', 'checkin')),
  -- What was bought at checkout (null for check-ins created by renewals or schedules).
  plan              text check (plan in ('report', 'report_membership_monthly', 'report_membership_yearly',
                                         'membership_monthly', 'membership_yearly')),
  status            text not null default 'pending_payment'
                    check (status in ('pending_payment', 'paid', 'awaiting_photos', 'in_review',
                                      'changes_requested', 'delivered', 'refunded', 'cancelled')),
  amount            numeric(10,3) not null default 0 check (amount >= 0),
  currency          text not null default 'KWD' check (currency ~ '^[A-Z]{3}$'),
  provider          text not null default 'stripe' check (provider in ('stripe', 'checkout_com', 'manual')),
  provider_ref      text,
  subscription_id   uuid references public.subscriptions (id) on delete set null,
  assigned_reviewer uuid references public.profiles (id) on delete set null,
  due_at            timestamptz,
  paid_at           timestamptz,
  submitted_at      timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references public.orders (id) on delete set null,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  user_id             uuid references public.profiles (id) on delete set null,
  provider            text not null default 'stripe' check (provider in ('stripe', 'checkout_com', 'manual')),
  -- Payment intent / invoice / refund id. Refunds are their own rows with a negative amount.
  provider_ref        text not null,
  provider_charge     text,
  amount              numeric(10,3) not null,
  currency            text not null default 'KWD' check (currency ~ '^[A-Z]{3}$'),
  -- fee and net are in the payment currency (converted with the provider's rate when settled in another currency).
  fee                 numeric(10,3),
  net                 numeric(10,3),
  -- As settled by the provider (for a Dutch Stripe account usually EUR).
  settlement_currency text check (settlement_currency ~ '^[A-Z]{3}$'),
  settlement_fee      numeric(12,4),
  settlement_net      numeric(12,4),
  status              text not null check (status in ('succeeded', 'refunded', 'failed')),
  created_at          timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table public.scans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete cascade,
  order_id          uuid not null references public.orders (id) on delete cascade,
  kind              text not null default 'baseline' check (kind in ('baseline', 'checkin')),
  intake            jsonb not null default '{}'::jsonb,
  results           jsonb not null default '{}'::jsonb,
  app_version       text,
  created_at        timestamptz not null default now(),
  photos_deleted_at timestamptz
);

create table public.scan_photos (
  scan_id      uuid not null references public.scans (id) on delete cascade,
  view         text not null check (view in ('face', 'body', 'side', 'faceLeft', 'faceRight', 'face45',
                                             'smile', 'frown', 'browRaise')),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  primary key (scan_id, view)
);

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders (id) on delete cascade,
  reviewer_id   uuid references public.profiles (id) on delete set null,
  status        text not null default 'in_progress' check (status in ('in_progress', 'approved', 'returned')),
  checklist     jsonb not null default '{}'::jsonb,
  notes         text,
  item_notes    jsonb not null default '{}'::jsonb,
  marker_grades jsonb not null default '{}'::jsonb,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.generations (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  scan_id      uuid references public.scans (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  kind         text not null check (kind in ('face_after', 'face_after_alt', 'body_after_front', 'body_after_side')),
  prompt       text not null,
  remarks      text,
  parent_id    uuid references public.generations (id) on delete set null,
  provider     text not null check (provider in ('fal', 'openai', 'higgsfield')),
  model        text,
  status       text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  output_path  text,
  error        text,
  cost_usd     numeric(10,4) not null default 0,
  approved     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.costs (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders (id) on delete set null,
  user_id    uuid references public.profiles (id) on delete set null,
  category   text not null check (category in ('image_generation', 'payment_fee', 'messaging', 'reviewer', 'other')),
  amount     numeric(10,4) not null,
  currency   text not null check (currency in ('USD', 'KWD', 'EUR')),
  note       text,
  created_at timestamptz not null default now()
);

create table public.ad_spend (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  platform      text not null check (platform in ('meta', 'snap', 'tiktok', 'google')),
  campaign_id   text not null,
  campaign_name text,
  spend         numeric(12,4) not null default 0,
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  impressions   int not null default 0,
  clicks        int not null default 0,
  purchases     int not null default 0,
  synced_at     timestamptz not null default now(),
  unique (date, platform, campaign_id)
);

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone      text check (char_length(phone) <= 32),
  gender     text check (gender in ('male', 'female')),
  locale     text not null default 'en' check (locale in ('en', 'ar')),
  source     text check (char_length(source) <= 64),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  target_type text,
  target_id   text,
  meta        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

-- Server-only bookkeeping (no client policies).
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index orders_user_idx           on public.orders (user_id);
create index orders_reviewer_open_idx  on public.orders (assigned_reviewer, status);
create index orders_status_idx         on public.orders (status);
create index orders_provider_ref_idx   on public.orders (provider, provider_ref);
create index orders_paid_at_idx        on public.orders (paid_at);
create index orders_delivered_at_idx   on public.orders (delivered_at) where status = 'delivered';
create index orders_subscription_idx   on public.orders (subscription_id);
create index consents_user_idx         on public.consents (user_id, kind);
create index subscriptions_user_idx    on public.subscriptions (user_id);
create index subscriptions_status_idx  on public.subscriptions (status);
create index payments_user_idx         on public.payments (user_id);
create index payments_order_idx        on public.payments (order_id);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_charge_idx       on public.payments (provider_charge);
create index payments_created_idx      on public.payments (created_at);
create index scans_user_idx            on public.scans (user_id);
create index scans_order_idx           on public.scans (order_id, created_at desc);
create index scans_photos_left_idx     on public.scans (order_id) where photos_deleted_at is null;
create index reviews_reviewer_idx      on public.reviews (reviewer_id);
create index generations_order_idx     on public.generations (order_id, created_at);
create index generations_parent_idx    on public.generations (parent_id);
create index generations_scan_idx      on public.generations (scan_id);
create index costs_order_idx           on public.costs (order_id);
create index costs_user_idx            on public.costs (user_id);
create index costs_created_idx         on public.costs (created_at);
create index ad_spend_date_idx         on public.ad_spend (date);
create index audit_target_idx          on public.audit_log (target_type, target_id);
create index audit_at_idx              on public.audit_log (at);
create index rate_limits_window_idx    on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer, fixed search_path)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- True for reviewers and admins (admins can review too).
create or replace function public.is_reviewer()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('reviewer', 'admin')
  );
$$;

-- True when the request runs with the service key or as a database owner role
-- (edge functions, webhooks, triggers inside security definer functions).
create or replace function public.is_service_role()
returns boolean
language sql stable
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or coalesce((select auth.jwt()) ->> 'role', '') = 'service_role';
$$;

-- The signed-in user is the reviewer assigned to this order (or an admin).
create or replace function public.can_review_order(p_order uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.orders o
    join public.profiles p on p.id = o.assigned_reviewer
    where o.id = p_order
      and o.assigned_reviewer = (select auth.uid())
      and p.role in ('reviewer', 'admin')
  );
$$;

-- The signed-in user owns this order and it has been delivered.
create or replace function public.owns_delivered_order(p_order uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where id = p_order and user_id = (select auth.uid()) and status = 'delivered'
  );
$$;

-- The signed-in user owns this scan.
create or replace function public.owns_scan(p_scan uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.scans where id = p_scan and user_id = (select auth.uid()));
$$;

-- The signed-in user may read this scan as its assigned reviewer (or admin).
create or replace function public.can_review_scan(p_scan uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.scans s
    where s.id = p_scan and public.can_review_order(s.order_id)
  );
$$;

-- The order belongs to the signed-in user and is waiting for photos.
create or replace function public.order_accepts_photos(p_order uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where id = p_order and user_id = (select auth.uid())
      and status in ('awaiting_photos', 'changes_requested')
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger orders_updated_at        before update on public.orders        for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger reviews_updated_at       before update on public.reviews       for each row execute function public.set_updated_at();

-- New auth user -> profiles row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
  v_gender text := new.raw_user_meta_data ->> 'gender';
begin
  insert into public.profiles (id, email, phone, full_name, locale, gender)
  values (
    new.id,
    new.email,
    new.phone,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200), ''),
    case when v_locale in ('en', 'ar') then v_locale else 'en' end,
    case when v_gender in ('male', 'female') then v_gender else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers cannot give themselves a role, a reviewer gender or a Stripe id.
create or replace function public.guard_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'customer';
    new.reviewer_gender := null;
    new.stripe_customer_id := null;
  elsif new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.reviewer_gender is distinct from old.reviewer_gender
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only an admin can change role, reviewer_gender or billing fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.guard_profile();

-- Reviewers may only move an assigned order between in_review and
-- changes_requested. Everything else goes through edge functions.
create or replace function public.guard_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
    raise exception 'Only the order status can be changed here' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('in_review', 'changes_requested') and new.status in ('in_review', 'changes_requested')) then
    raise exception 'Status change % -> % must go through the server', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_guard
  before update on public.orders
  for each row execute function public.guard_order();

-- Reviewers cannot approve directly (approve-delivery does that) or move a review.
create or replace function public.guard_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;
  if new.status = 'approved' or new.approved_at is not null then
    raise exception 'Approval goes through approve-delivery' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.order_id is distinct from old.order_id or new.reviewer_id is distinct from old.reviewer_id) then
    raise exception 'order_id and reviewer_id cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reviews_guard
  before insert or update on public.reviews
  for each row execute function public.guard_review();

-- Audit log for status changes.
create or replace function public.audit_status_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.audit_log (actor, action, target_type, target_id, meta)
    values (
      (select auth.uid()),
      tg_table_name || '.status',
      tg_table_name,
      new.id::text,
      jsonb_build_object('from', case when tg_op = 'INSERT' then null else old.status end, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger orders_audit
  after insert or update of status on public.orders
  for each row execute function public.audit_status_change();
create trigger reviews_audit
  after insert or update of status on public.reviews
  for each row execute function public.audit_status_change();
create trigger subscriptions_audit
  after insert or update of status on public.subscriptions
  for each row execute function public.audit_status_change();

-- Waitlist emails are stored trimmed and lower-case so the unique key dedups.
create or replace function public.normalize_waitlist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.phone := nullif(btrim(new.phone), '');
  return new;
end;
$$;

create trigger waitlist_normalize
  before insert or update on public.waitlist
  for each row execute function public.normalize_waitlist();

-- ---------------------------------------------------------------------------
-- Server-side helpers called by edge functions / cron (service role only)
-- ---------------------------------------------------------------------------

-- Assigns the least-busy reviewer whose reviewer_gender matches the customer's
-- gender. Women's orders can only ever go to female reviewers. Returns null
-- (order stays unassigned for an admin) when no matching reviewer exists.
create or replace function public.assign_reviewer(p_order uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gender   text;
  v_current  uuid;
  v_reviewer uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.assign_reviewer'));

  select p.gender, o.assigned_reviewer into v_gender, v_current
  from public.orders o
  join public.profiles p on p.id = o.user_id
  where o.id = p_order;

  if v_current is not null then
    return v_current;
  end if;
  if v_gender is null then
    return null;
  end if;

  select r.id into v_reviewer
  from public.profiles r
  where r.role in ('reviewer', 'admin')
    and r.reviewer_gender = v_gender
  order by
    (r.role = 'admin'),
    (select count(*) from public.orders o2
      where o2.assigned_reviewer = r.id and o2.status in ('in_review', 'changes_requested')),
    random()
  limit 1;

  if v_reviewer is not null then
    update public.orders set assigned_reviewer = v_reviewer where id = p_order and assigned_reviewer is null;
    insert into public.audit_log (actor, action, target_type, target_id, meta)
    values (null, 'orders.assigned', 'orders', p_order::text, jsonb_build_object('reviewer', v_reviewer, 'gender', v_gender));
  end if;
  return v_reviewer;
end;
$$;

-- Database-level guarantee of the gender rule, whoever assigns the reviewer.
create or replace function public.check_reviewer_gender()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_customer_gender text;
  v_reviewer_gender text;
  v_reviewer_role   text;
begin
  if new.assigned_reviewer is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_reviewer is not distinct from old.assigned_reviewer
     and new.user_id is not distinct from old.user_id then
    return new;
  end if;
  select gender into v_customer_gender from public.profiles where id = new.user_id;
  select reviewer_gender, role into v_reviewer_gender, v_reviewer_role from public.profiles where id = new.assigned_reviewer;
  if v_reviewer_role not in ('reviewer', 'admin') then
    raise exception 'Assigned user is not a reviewer' using errcode = '23514';
  end if;
  if v_customer_gender = 'female' and v_reviewer_gender is distinct from 'female' then
    raise exception 'Orders from women can only be assigned to female reviewers' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger orders_reviewer_gender
  before insert or update of assigned_reviewer, user_id on public.orders
  for each row execute function public.check_reviewer_gender();

-- Fixed-window rate limiter. Returns true while under the limit.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end;
$$;

-- Yearly members pay once a year but get a check-in every month: create one
-- check-in order per active yearly subscription when the last one is 30+ days
-- old and none is still waiting for photos. Monthly members get theirs from
-- each paid invoice (stripe-webhook). Returns the number of orders created.
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

revoke execute on function public.assign_reviewer(uuid) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.ensure_monthly_checkins() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.assign_reviewer(uuid) to service_role;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
grant execute on function public.ensure_monthly_checkins() to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.consents      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders        enable row level security;
alter table public.payments      enable row level security;
alter table public.scans         enable row level security;
alter table public.scan_photos   enable row level security;
alter table public.reviews       enable row level security;
alter table public.generations   enable row level security;
alter table public.costs         enable row level security;
alter table public.ad_spend      enable row level security;
alter table public.waitlist      enable row level security;
alter table public.audit_log     enable row level security;
alter table public.stripe_events enable row level security;
alter table public.rate_limits   enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin all" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- consents
create policy "consents: read own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: insert own" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()) and withdrawn_at is null);
create policy "consents: withdraw own" on public.consents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "consents: admin read" on public.consents
  for select to authenticated using ((select public.is_admin()));
-- Customers can only touch withdrawn_at.
revoke update on public.consents from anon, authenticated;
grant update (withdrawn_at) on public.consents to authenticated;

-- subscriptions (written by the webhook with the service key)
create policy "subscriptions: read own" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "subscriptions: admin all" on public.subscriptions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders (created and moved by edge functions; reviewers move in_review <-> changes_requested)
create policy "orders: read own" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "orders: reviewer reads assigned" on public.orders
  for select to authenticated using (assigned_reviewer = (select auth.uid()) and (select public.is_reviewer()));
create policy "orders: reviewer updates assigned" on public.orders
  for update to authenticated
  using (assigned_reviewer = (select auth.uid()) and (select public.is_reviewer()))
  with check (assigned_reviewer = (select auth.uid()));
create policy "orders: admin all" on public.orders
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- payments
create policy "payments: read own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "payments: admin all" on public.payments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- scans
create policy "scans: read own" on public.scans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "scans: insert own" on public.scans
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.order_accepts_photos(order_id));
create policy "scans: reviewer reads assigned" on public.scans
  for select to authenticated using (public.can_review_order(order_id));
create policy "scans: admin all" on public.scans
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- scan_photos
create policy "scan_photos: read own" on public.scan_photos
  for select to authenticated using (public.owns_scan(scan_id));
create policy "scan_photos: insert own" on public.scan_photos
  for insert to authenticated
  with check (
    public.owns_scan(scan_id)
    and storage_path like (select auth.uid())::text || '/' || scan_id::text || '/%'
  );
create policy "scan_photos: replace own" on public.scan_photos
  for update to authenticated
  using (public.owns_scan(scan_id))
  with check (public.owns_scan(scan_id) and storage_path like (select auth.uid())::text || '/' || scan_id::text || '/%');
create policy "scan_photos: reviewer reads assigned" on public.scan_photos
  for select to authenticated using (public.can_review_scan(scan_id));
create policy "scan_photos: admin all" on public.scan_photos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- reviews
create policy "reviews: reviewer reads assigned" on public.reviews
  for select to authenticated using (public.can_review_order(order_id));
create policy "reviews: reviewer creates assigned" on public.reviews
  for insert to authenticated
  with check (public.can_review_order(order_id) and reviewer_id = (select auth.uid()));
create policy "reviews: reviewer updates assigned" on public.reviews
  for update to authenticated
  using (public.can_review_order(order_id)) with check (public.can_review_order(order_id));
create policy "reviews: customer reads delivered" on public.reviews
  for select to authenticated using (public.owns_delivered_order(order_id));
create policy "reviews: admin all" on public.reviews
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- generations (written by generate-visual / approve-delivery with the service key)
create policy "generations: reviewer reads assigned" on public.generations
  for select to authenticated using (public.can_review_order(order_id));
create policy "generations: customer reads approved" on public.generations
  for select to authenticated using (approved and public.owns_delivered_order(order_id));
create policy "generations: admin all" on public.generations
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- costs, ad_spend, audit_log: admin only
create policy "costs: admin all" on public.costs
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "ad_spend: admin all" on public.ad_spend
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "audit_log: admin read" on public.audit_log
  for select to authenticated using ((select public.is_admin()));

-- waitlist: anyone may join, nobody but an admin may read
create policy "waitlist: anyone joins" on public.waitlist
  for insert to anon, authenticated with check (true);
create policy "waitlist: admin read" on public.waitlist
  for select to authenticated using ((select public.is_admin()));
create policy "waitlist: admin delete" on public.waitlist
  for delete to authenticated using ((select public.is_admin()));

-- stripe_events, rate_limits: no policies (service role only).
