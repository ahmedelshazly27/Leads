-- Advisor fixes: security definer helpers are not callable by anonymous
-- visitors; trigger functions are not callable through the API at all.

revoke execute on function public.audit_status_change() from public, anon, authenticated;
revoke execute on function public.check_reviewer_gender() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.can_review_order(uuid)', 'public.can_review_photo_path(text)',
    'public.can_review_scan(uuid)', 'public.can_review_visual_path(text)',
    'public.is_admin()', 'public.is_reviewer()', 'public.order_accepts_photos(uuid)',
    'public.order_is_open_for_review(uuid)', 'public.owns_delivered_order(uuid)',
    'public.owns_scan(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

create index if not exists generations_requested_by_idx on public.generations (requested_by);
