// Daily (pg_cron, cron secret). Keeps the 90-day photo promise:
//  1. Scans past retention, whatever their order's state (see
//     photos_due_for_purge): delivered orders 90 days after delivery, refunded
//     or cancelled orders 90 days after they closed, and orders that never
//     finished (abandoned uploads, stuck reviews) 90 days after the scan.
//     Every object under {user_id}/{scan_id}/ is removed, not only the paths
//     recorded in scan_photos, then scans.photos_deleted_at is set.
//  2. Orphans: photo objects older than 3 days that belong to no scan still
//     holding photos (no scan row, or a scan already purged).
// Visuals: with the photos of a refunded or cancelled order its visuals are
// deleted too: nobody will see them. Open orders keep theirs.
// Visuals of delivered reports stay in the customer's account (privacy policy:
// "kept in your account ... until you delete them or your account"; the
// 24-month rule in purge-records removes them later). Set the function secret
// VISUALS_WITH_PHOTOS=all to delete delivered visuals with the photos as well
// (update the privacy policy first). Work is capped per run; `more` says
// whether anything is left for the next run.
import { json, serve } from "../_shared/http.ts";
import { requireService } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { listAll, removePaths } from "../_shared/storage.ts";

const RETENTION_DAYS = 90;
const ORPHAN_MIN_AGE_HOURS = 72;
const PAGE = 100;
const MAX_SCANS_PER_RUN = 500;
const MAX_ORPHANS_PER_RUN = 1000;
const VISUALS_ALL = (Deno.env.get("VISUALS_WITH_PHOTOS") ?? "").trim().toLowerCase() === "all";

// Closed orders that were never delivered lose their visuals with the photos;
// open orders keep them (a newer scan may still be in review).
const visualsGo = (status: string | undefined) =>
  status === "refunded" || status === "cancelled" || (VISUALS_ALL && status === "delivered");

// Deletes the visual files of an order and clears generations.output_path.
// Returns the number of files removed.
async function purgeVisuals(orderId: string): Promise<number> {
  const db = admin();
  const gens = must(
    await db.from("generations").select("output_path").eq("order_id", orderId).not("output_path", "is", null),
    "generations",
  );
  const paths = (gens ?? []).map((g) => g.output_path as string);
  paths.push(...(await listAll("visuals", orderId)));
  if (!paths.length) return 0;
  const removed = await removePaths("visuals", paths);
  must(
    await db.from("generations").update({ output_path: null }).eq("order_id", orderId).not("output_path", "is", null),
    "clear generation outputs",
  );
  return removed;
}

serve(async (req) => {
  requireService(req);
  const db = admin();

  let scansDone = 0;
  let scansFailed = 0;
  let filesRemoved = 0;
  let visualsRemoved = 0;
  const visualsDone = new Set<string>();
  let after: string | null = null;
  let more = false;

  // 1. Scans past retention, in pages ordered by scan id. A scan that fails is
  // skipped (the cursor moves past it) and retried on the next run.
  while (scansDone + scansFailed < MAX_SCANS_PER_RUN) {
    const page: { scan_id: string; user_id: string | null }[] = must(
      await db.rpc("photos_due_for_purge", { p_days: RETENTION_DAYS, p_limit: PAGE, p_after: after }),
      "scans due",
    ) ?? [];
    if (!page.length) break;
    for (const row of page) {
      after = row.scan_id;
      try {
        const recorded = must(
          await db.from("scan_photos").select("storage_path").eq("scan_id", row.scan_id),
          "scan photos",
        );
        const paths = (recorded ?? []).map((p) => p.storage_path as string);
        if (row.user_id) paths.push(...(await listAll("photos", `${row.user_id}/${row.scan_id}`)));
        filesRemoved += await removePaths("photos", paths);
        must(await db.from("scan_photos").delete().eq("scan_id", row.scan_id), "delete scan photos");
        must(
          await db.from("scans").update({ photos_deleted_at: new Date().toISOString() }).eq("id", row.scan_id),
          "mark scan",
        );
        // Two plain reads: scans and orders are linked both ways (scans.order_id
        // and orders.scan_id), so an embedded orders(...) select is ambiguous.
        const scan = must(
          await db.from("scans").select("order_id").eq("id", row.scan_id).maybeSingle(),
          "scan order",
        ) as { order_id: string | null } | null;
        const ord = scan?.order_id
          ? must(await db.from("orders").select("status").eq("id", scan.order_id).maybeSingle(), "order status") as
            | { status: string }
            | null
          : null;
        if (scan?.order_id && !visualsDone.has(scan.order_id) && visualsGo(ord?.status)) {
          visualsDone.add(scan.order_id);
          visualsRemoved += await purgeVisuals(scan.order_id);
        }
        scansDone++;
      } catch (err) {
        scansFailed++;
        console.error("purge failed for scan", row.scan_id, (err as Error).message);
      }
      if (scansDone + scansFailed >= MAX_SCANS_PER_RUN) {
        more = true;
        break;
      }
    }
    if (page.length < PAGE) break;
  }

  // 2. Orphaned objects (runs after step 1, so files of scans purged above
  // that were missed by the folder listing are caught too).
  const orphans: { name: string }[] = must(
    await db.rpc("orphan_photo_objects", { p_min_age_hours: ORPHAN_MIN_AGE_HOURS, p_limit: MAX_ORPHANS_PER_RUN }),
    "orphan photos",
  ) ?? [];
  const orphansRemoved = orphans.length ? await removePaths("photos", orphans.map((o) => o.name)) : 0;
  if (orphans.length >= MAX_ORPHANS_PER_RUN) more = true;

  if (scansDone || scansFailed || orphansRemoved) {
    await audit("photos.purged", "scans", null, {
      scans: scansDone,
      scans_failed: scansFailed,
      files: filesRemoved,
      visuals: visualsRemoved,
      orphans: orphansRemoved,
      retention_days: RETENTION_DAYS,
    });
  }
  return json(req, {
    scans: scansDone,
    scans_failed: scansFailed,
    files: filesRemoved,
    visuals: visualsRemoved,
    orphans: orphansRemoved,
    more,
  });
});
