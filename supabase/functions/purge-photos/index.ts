// Daily (pg_cron, cron secret). Keeps the 90-day photo promise:
//  1. Scans past retention, whatever their order's state (see
//     photos_due_for_purge): delivered orders 90 days after delivery, refunded
//     or cancelled orders 90 days after they closed, and orders that never
//     finished (abandoned uploads, stuck reviews) 90 days after the scan.
//     Every object under {user_id}/{scan_id}/ is removed, not only the paths
//     recorded in scan_photos, then scans.photos_deleted_at is set.
//  2. Orphans: photo objects older than 3 days that belong to no scan still
//     holding photos (no scan row, or a scan already purged).
// Visuals (the delivered result) are kept. Work is capped per run; `more`
// says whether anything is left for the next run.
import { json, serve } from "../_shared/http.ts";
import { requireService } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { listAll, removePaths } from "../_shared/storage.ts";

const RETENTION_DAYS = 90;
const ORPHAN_MIN_AGE_HOURS = 72;
const PAGE = 100;
const MAX_SCANS_PER_RUN = 500;
const MAX_ORPHANS_PER_RUN = 1000;

serve(async (req) => {
  requireService(req);
  const db = admin();

  let scansDone = 0;
  let scansFailed = 0;
  let filesRemoved = 0;
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
      orphans: orphansRemoved,
      retention_days: RETENTION_DAYS,
    });
  }
  return json(req, {
    scans: scansDone,
    scans_failed: scansFailed,
    files: filesRemoved,
    orphans: orphansRemoved,
    more,
  });
});
