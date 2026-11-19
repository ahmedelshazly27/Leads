// POST { confirm: true } -> { deleted: true, ... }
// Deletes the signed-in customer's photos, visuals, scans, reviews,
// generations, consents and profile, cancels any membership, anonymises
// orders and payments (kept for accounting without a link to the person),
// and finally deletes the sign-in account.
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { listAll, removePaths } from "../_shared/storage.ts";
import { stripe } from "../_shared/stripe.ts";

serve(async (req) => {
  const { user, profile } = await requireUser(req);
  const body = await readJson<{ confirm?: boolean }>(req);
  if (body.confirm !== true) {
    throw new HttpError(400, "confirm_required", "Send { confirm: true } to delete your data.");
  }
  if (profile.role !== "customer") {
    throw new HttpError(409, "staff_account", "Staff accounts are removed by an admin.");
  }
  const db = admin();
  const uid = user.id;

  // 1. Memberships: stop future charges first.
  const subs = must(
    await db.from("subscriptions").select("id, provider, provider_sub_id, status").eq("user_id", uid),
    "subscriptions",
  );
  let cancelled = 0;
  for (const s of subs ?? []) {
    if (s.provider === "stripe" && s.status !== "canceled") {
      try {
        await stripe().subscriptions.cancel(s.provider_sub_id as string);
        cancelled++;
      } catch (err) {
        console.error("cancel subscription failed", s.provider_sub_id, (err as Error).message);
        throw new HttpError(
          502,
          "cancel_failed",
          "We could not cancel your membership. Please try again or contact us.",
        );
      }
    }
  }

  // 2. Files: photos (by folder and by recorded path) and visuals of the user's orders.
  const orders = must(await db.from("orders").select("id").eq("user_id", uid), "orders");
  const orderIds = (orders ?? []).map((o) => o.id as string);

  const scans = must(await db.from("scans").select("id").eq("user_id", uid), "scans");
  const scanIds = (scans ?? []).map((s) => s.id as string);
  const recorded = scanIds.length
    ? must(await db.from("scan_photos").select("storage_path").in("scan_id", scanIds), "scan photos")
    : [];
  const photoPaths = [...(await listAll("photos", uid)), ...(recorded ?? []).map((p) => p.storage_path as string)];
  const photosRemoved = await removePaths("photos", photoPaths);

  let visualsRemoved = 0;
  if (orderIds.length) {
    const gens = must(await db.from("generations").select("output_path").in("order_id", orderIds), "generations");
    const visualPaths = (gens ?? []).map((g) => g.output_path as string).filter(Boolean);
    for (const id of orderIds) visualPaths.push(...(await listAll("visuals", id)));
    visualsRemoved = await removePaths("visuals", visualPaths);
  }

  // 3. Rows with personal data.
  if (orderIds.length) {
    must(await db.from("generations").delete().in("order_id", orderIds), "delete generations");
    must(await db.from("reviews").delete().in("order_id", orderIds), "delete reviews");
  }
  must(await db.from("scans").delete().eq("user_id", uid), "delete scans"); // scan_photos cascade
  must(await db.from("consents").delete().eq("user_id", uid), "delete consents");
  // Only the verified sign-in email (profiles.email is a copy of it).
  if (user.email) {
    must(await db.from("waitlist").delete().eq("email", user.email.trim().toLowerCase()), "delete waitlist");
  }

  // 4. Accounting records stay, without the link to the person.
  must(await db.from("orders").update({ user_id: null }).eq("user_id", uid), "anonymise orders");
  must(await db.from("payments").update({ user_id: null }).eq("user_id", uid), "anonymise payments");
  must(await db.from("subscriptions").update({ user_id: null }).eq("user_id", uid), "anonymise subscriptions");
  must(await db.from("costs").update({ user_id: null }).eq("user_id", uid), "anonymise costs");

  // 5. Profile (cascade from the auth user) and the sign-in account.
  const { error: delErr } = await db.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error("deleteUser failed", delErr.message);
    throw new HttpError(
      500,
      "delete_failed",
      "Your data was removed but the account could not be closed. Please contact us.",
    );
  }

  await audit("user.deleted", "user", uid, {
    orders_anonymised: orderIds.length,
    photos_removed: photosRemoved,
    visuals_removed: visualsRemoved,
    subscriptions_cancelled: cancelled,
  });

  return json(req, {
    deleted: true,
    photos_removed: photosRemoved,
    visuals_removed: visualsRemoved,
    memberships_cancelled: cancelled,
  });
});
