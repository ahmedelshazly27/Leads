-- Follow-ups to 001-005 (those are applied to the live project and are not edited):
--   1. consents.kind accepts 'withdrawal_waiver' (the request to start the report
--      within the 14-day withdrawal period, given before photos are submitted).
--   2. orders.scan_id: the scan submit-scan accepted for the order.
--   3. Customers may delete their own scans (and single scan photos) while the
--      order still accepts photos (retakes before submitting).
--   4. withdraw_photo_consent_records(): the database part of withdrawing photo
--      consent (the withdraw-photo-consent function removes the files first).
--   5. Retention: records_due_for_retention() / scrub_user_records() for the
--      24-month rule, purge_old_waitlist() for waitlist entries.

-- ---------------------------------------------------------------------------
-- 1. Consent kinds
-- ---------------------------------------------------------------------------

alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check
  check (kind in ('age18', 'terms', 'privacy', 'photos', 'marketing', 'withdrawal_waiver'));

-- ---------------------------------------------------------------------------
-- 2. The accepted scan of an order
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists scan_id uuid references public.scans (id) on delete set null;
comment on column public.orders.scan_id is 'The scan accepted by submit-scan (the one under review). Null before submission or after the scan is deleted.';
create index if not exists orders_scan_idx on public.orders (scan_id);

-- ---------------------------------------------------------------------------
-- 3. Customers delete their own scans before submitting
-- ---------------------------------------------------------------------------

drop policy if exists "scans: delete own while open" on public.scans;
create policy "scans: delete own while open" on public.scans
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.order_accepts_photos(order_id));

-- The order of the scan accepts photos and the scan belongs to the caller.
create or replace function public.scan_accepts_photos(p_scan uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.scans s
    where s.id = p_scan and s.user_id = (select auth.uid()) and public.order_accepts_photos(s.order_id)
  );
$$;
revoke execute on function public.scan_accepts_photos(uuid) from public, anon;
grant execute on function public.scan_accepts_photos(uuid) to authenticated, service_role;

drop policy if exists "scan_photos: delete own while open" on public.scan_photos;
create policy "scan_photos: delete own while open" on public.scan_photos
  for delete to authenticated
  using (public.scan_accepts_photos(scan_id));

-- ---------------------------------------------------------------------------
-- 4. Photo consent withdrawn (called by withdraw-photo-consent with the service
--    key, after it removed the photo files and the visuals of the orders that
--    are cancelled here). In one transaction:
--      - photo consents marked withdrawn
--      - scan_photos rows deleted, scans.photos_deleted_at set
--      - measurements and health answers cleared (scans.intake / results)
--      - orders whose photos were submitted but not delivered (in_review,
--        changes_requested) cancelled: the review cannot continue. Refunds are
--        issued by hand (see the refund policy), so each cancellation is logged
--        with what the refund policy suggests.
--      - generations of those orders lose their output (files already removed)
--    Orders still waiting for photos stay open: the customer can give the
--    consent again and submit later (or ask for a full refund).
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_photo_consent_records(p_user uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_scans     int;
  v_consents  int;
  v_cancelled jsonb := '[]'::jsonb;
  v_order     record;
  v_started   boolean;
  v_waiver    boolean;
begin
  update public.consents set withdrawn_at = now()
  where user_id = p_user and kind = 'photos' and withdrawn_at is null;
  get diagnostics v_consents = row_count;

  delete from public.scan_photos sp using public.scans s
  where sp.scan_id = s.id and s.user_id = p_user;

  update public.scans
  set photos_deleted_at = coalesce(photos_deleted_at, now()),
      intake = '{}'::jsonb,
      results = '{}'::jsonb
  where user_id = p_user
    and (photos_deleted_at is null or intake <> '{}'::jsonb or results <> '{}'::jsonb);
  get diagnostics v_scans = row_count;

  select exists (
    select 1 from public.consents
    where user_id = p_user and kind = 'withdrawal_waiver' and withdrawn_at is null
  ) into v_waiver;

  for v_order in
    select o.id, o.status, o.product, o.amount, o.currency
    from public.orders o
    where o.user_id = p_user and o.status in ('in_review', 'changes_requested')
    for update
  loop
    v_started := exists (select 1 from public.reviews r where r.order_id = v_order.id)
              or exists (select 1 from public.generations g where g.order_id = v_order.id);
    update public.orders set status = 'cancelled' where id = v_order.id;
    update public.generations set output_path = null, approved = false where order_id = v_order.id;
    insert into public.audit_log (actor, action, target_type, target_id, meta)
    values (
      p_user, 'orders.cancelled_consent_withdrawn', 'orders', v_order.id::text,
      jsonb_build_object(
        'from', v_order.status,
        'product', v_order.product,
        'amount', v_order.amount,
        'currency', v_order.currency,
        'review_started', v_started,
        'withdrawal_waiver', v_waiver,
        'refund', 'manual',
        -- Refund policy section 3: full refund if our review had not started,
        -- otherwise the price less a fair amount for the work already done.
        'refund_policy', case when v_order.amount <= 0 then 'none (included check-in)'
                              when v_started then 'partial' else 'full' end
      )
    );
    v_cancelled := v_cancelled || jsonb_build_object('order_id', v_order.id, 'review_started', v_started);
  end loop;

  insert into public.audit_log (actor, action, target_type, target_id, meta)
  values (p_user, 'consents.photos_withdrawn', 'user', p_user::text,
          jsonb_build_object('scans', v_scans, 'consents', v_consents, 'orders_cancelled', jsonb_array_length(v_cancelled)));

  return jsonb_build_object('scans', v_scans, 'consents', v_consents, 'cancelled', v_cancelled);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Retention (privacy policy section 8)
--    Measurements, scores, health answers, plan and reviewer notes: at most 24
--    months after the customer's last order or membership ends. Orders and
--    payments themselves are accounting records (7 years) and stay.
-- ---------------------------------------------------------------------------

-- Customers with no current membership whose last order activity and last
-- membership end are older than p_months, and who still have records to clear.
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
        (select max(greatest(o.created_at, coalesce(o.delivered_at, o.created_at), o.updated_at))
           from public.orders o where o.user_id = p.id),
        (select max(greatest(coalesce(s.canceled_at, s.created_at), coalesce(s.current_period_end, s.created_at), coalesce(s.cancel_at, s.created_at)))
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

-- Clears one customer's measurements, health answers, plan and reviewer notes.
-- The purge-records function removes the photo and visual files first. Orders,
-- payments and cost rows (with image costs) are kept.
create or replace function public.scrub_user_records(p_user uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_scans   int;
  v_reviews int;
  v_gens    int;
begin
  -- Scans hold the intake (health answers), measurements and plan inputs;
  -- scan_photos go with them (cascade), orders.scan_id is set to null.
  delete from public.scans where user_id = p_user;
  get diagnostics v_scans = row_count;

  update public.reviews r
  set checklist = '{}'::jsonb, notes = null, item_notes = '{}'::jsonb, marker_grades = '{}'::jsonb
  from public.orders o
  where o.id = r.order_id and o.user_id = p_user
    and (r.notes is not null or r.item_notes <> '{}'::jsonb or r.marker_grades <> '{}'::jsonb or r.checklist <> '{}'::jsonb);
  get diagnostics v_reviews = row_count;

  -- Generation rows stay for the cost history, without prompts or images.
  update public.generations g
  set prompt = '', remarks = null, output_path = null
  from public.orders o
  where o.id = g.order_id and o.user_id = p_user
    and (g.prompt <> '' or g.remarks is not null or g.output_path is not null);
  get diagnostics v_gens = row_count;

  insert into public.audit_log (actor, action, target_type, target_id, meta)
  values (null, 'retention.records_cleared', 'user', p_user::text,
          jsonb_build_object('scans', v_scans, 'reviews', v_reviews, 'generations', v_gens));
  return jsonb_build_object('scans', v_scans, 'reviews', v_reviews, 'generations', v_gens);
end;
$$;

-- Waitlist entries are kept at most p_months.
create or replace function public.purge_old_waitlist(p_months int default 24)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.waitlist where created_at < now() - make_interval(months => p_months);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.withdraw_photo_consent_records(uuid) from public, anon, authenticated;
revoke execute on function public.records_due_for_retention(int, int) from public, anon, authenticated;
revoke execute on function public.scrub_user_records(uuid) from public, anon, authenticated;
revoke execute on function public.purge_old_waitlist(int) from public, anon, authenticated;
grant execute on function public.withdraw_photo_consent_records(uuid) to service_role;
grant execute on function public.records_due_for_retention(int, int) to service_role;
grant execute on function public.scrub_user_records(uuid) to service_role;
grant execute on function public.purge_old_waitlist(int) to service_role;
