// Daily (pg_cron, cron secret). The 24-month limits of the privacy policy
// (section 8):
//  1. Customers with no current membership whose last order activity and last
//     membership end are more than 24 months ago (records_due_for_retention):
//     their visual files and any photo files left are deleted, then
//     scrub_user_records() deletes their scans (measurements, health answers,
//     plan inputs) and clears reviewer notes and generation prompts. Orders,
//     payments and cost rows stay (accounting, 7 years).
//  2. Waitlist entries older than 24 months are deleted.
// Work is capped per run; `more` says whether anything is left for the next run.
import { json, serve } from "../_shared/http.ts";
import { requireService } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { listAll, removePaths } from "../_shared/storage.ts";

const RETENTION_MONTHS = 24;
const PAGE = 50;
const MAX_USERS_PER_RUN = 200;

serve(async (req) => {
  requireService(req);
  const db = admin();

  let users = 0;
  let failed = 0;
  let files = 0;
  let more = false;
  const skip = new Set<string>();

  // A cleared user drops out of records_due_for_retention, so each page is
  // read from the start; users that failed in this run are skipped.
  outer: while (users + failed < MAX_USERS_PER_RUN) {
    const page: { user_id: string }[] = must(
      await db.rpc("records_due_for_retention", { p_months: RETENTION_MONTHS, p_limit: PAGE + skip.size }),
      "records due",
    ) ?? [];
    const todo = page.filter((r) => !skip.has(r.user_id));
    if (!todo.length) break;
    for (const { user_id: uid } of todo) {
      try {
        const orders = must(await db.from("orders").select("id").eq("user_id", uid), "orders");
        const orderIds = (orders ?? []).map((o) => o.id as string);
        const visualPaths: string[] = [];
        if (orderIds.length) {
          const gens = must(
            await db.from("generations").select("output_path").in("order_id", orderIds).not("output_path", "is", null),
            "generations",
          );
          visualPaths.push(...(gens ?? []).map((g) => g.output_path as string));
          for (const id of orderIds) visualPaths.push(...(await listAll("visuals", id)));
        }
        files += await removePaths("visuals", visualPaths);
        files += await removePaths("photos", await listAll("photos", uid));
        must(await db.rpc("scrub_user_records", { p_user: uid }), "scrub records");
        users++;
      } catch (err) {
        failed++;
        skip.add(uid);
        console.error("retention failed for user", uid, (err as Error).message);
      }
      if (users + failed >= MAX_USERS_PER_RUN) {
        more = true;
        break outer;
      }
    }
    if (page.length < PAGE + skip.size) break;
  }

  const waitlist = must(await db.rpc("purge_old_waitlist", { p_months: RETENTION_MONTHS }), "waitlist") as number;

  if (users || failed || waitlist) {
    await audit("retention.run", "system", null, {
      users,
      users_failed: failed,
      files,
      waitlist_deleted: waitlist,
      months: RETENTION_MONTHS,
    });
  }
  return json(req, { users, users_failed: failed, files, waitlist, more });
});
