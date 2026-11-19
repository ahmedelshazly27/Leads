// Daily (pg_cron, service key). Pulls campaign-level daily insights from the
// Meta Marketing API for the last N days (default 7) and upserts ad_spend.
// Secrets: META_ACCESS_TOKEN (system user token with ads_read),
// META_AD_ACCOUNT_ID (with or without "act_"), optional META_API_VERSION.
import { HttpError, json, requireEnv, serve } from "../_shared/http.ts";
import { requireService } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";

interface InsightRow {
  date_start: string;
  campaign_id: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  account_currency?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

// Meta reports the same purchase under several overlapping action types; take
// the first one present instead of adding them up.
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

function purchases(actions: InsightRow["actions"]): number {
  for (const t of PURCHASE_TYPES) {
    const a = actions?.find((x) => x.action_type === t);
    if (a) return Math.round(Number(a.value) || 0);
  }
  return 0;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

serve(async (req) => {
  requireService(req);
  let days = 7;
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (Number.isInteger(body?.days)) days = Math.min(Math.max(body.days, 1), 90);
  }

  const token = requireEnv("META_ACCESS_TOKEN");
  const account = requireEnv("META_AD_ACCOUNT_ID").replace(/^act_/, "");
  const version = Deno.env.get("META_API_VERSION") ?? "v21.0";

  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 86400_000);
  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency",
    time_increment: "1",
    time_range: JSON.stringify({ since: isoDate(since), until: isoDate(until) }),
    limit: "500",
    access_token: token,
  });

  let url: string | null = `https://graph.facebook.com/${version}/act_${account}/insights?${params}`;
  const rows: InsightRow[] = [];
  for (let page = 0; url && page < 50; page++) {
    const res: Response = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new HttpError(502, "meta_error", `Meta API: ${msg}`);
    }
    rows.push(...((body?.data ?? []) as InsightRow[]));
    url = body?.paging?.next ?? null;
  }

  const records = rows
    .filter((r) => r.campaign_id && r.date_start)
    .map((r) => ({
      date: r.date_start,
      platform: "meta",
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name ?? null,
      spend: Number(r.spend ?? 0),
      currency: (r.account_currency ?? "USD").toUpperCase(),
      impressions: Math.round(Number(r.impressions ?? 0)),
      clicks: Math.round(Number(r.clicks ?? 0)),
      purchases: purchases(r.actions),
      synced_at: new Date().toISOString(),
    }));

  const db = admin();
  for (let i = 0; i < records.length; i += 500) {
    must(
      await db.from("ad_spend").upsert(records.slice(i, i + 500), { onConflict: "date,platform,campaign_id" }),
      "ad_spend upsert",
    );
  }

  const spend = records.reduce((s, r) => s + r.spend, 0);
  await audit("ads.synced", "ad_spend", null, {
    platform: "meta",
    days,
    rows: records.length,
    spend: Math.round(spend * 100) / 100,
  });
  return json(req, { rows: records.length, since: isoDate(since), until: isoDate(until), spend });
});
