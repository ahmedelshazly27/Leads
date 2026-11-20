// Daily (pg_cron, cron secret; job membership-reminders-daily). Membership
// emails, each in the customer's language with links to the pages in that
// language:
//   included_ending  the 30 days of membership included with a report bought
//                    on its own end within 5 days: nothing renews; links to
//                    join monthly or yearly (/account?join=membership_monthly,
//                    /account?join=membership_yearly, under /ar for Arabic).
//   yearly_renewal   a yearly membership (not cancelling) reaches the end of
//                    its 12 months within 30 days: terms section 7 promises
//                    this reminder; it then continues monthly.
// First ends included months that are over (expire_included_memberships).
//
// Idempotent: each email is claimed in email_reminders (unique per kind,
// membership and period end) before it is sent, so a second run, or two runs
// at once, never send it twice. A failed send releases the claim, so the next
// day's run tries again while the reminder window is still open. A yearly
// reminder whose Stripe schedule failed is held (see below).
import { json, readJson, serve } from "../_shared/http.ts";
import { requireService } from "../_shared/auth.ts";
import { admin, audit, customerContact, must } from "../_shared/supabase.ts";
import { customerUrl, includedEndingEmail, sendEmail, yearlyRenewalEmail } from "../_shared/email.ts";
import { currencyForCountry, FALLBACK_CURRENCY, hasCurrency, priceOf } from "../_shared/prices.ts";

interface Due {
  kind: "included_ending" | "yearly_renewal";
  subscription_id: string;
  user_id: string;
  period_end: string;
  locale: string | null;
  full_name: string | null;
  /** yearly_renewal only: the yearly-then-monthly Stripe schedule failed (stripe.schedule_failed) */
  schedule_failed: boolean | null;
}

const MAX_PER_RUN = 500;

serve(async (req) => {
  requireService(req);
  const body = await readJson<{ dry_run?: boolean }>(req);
  const dryRun = body.dry_run === true;
  const db = admin();

  const expired = dryRun ? 0 : (must(await db.rpc("expire_included_memberships"), "expire included") as number);
  const due = (must(await db.rpc("membership_reminders_due", { p_limit: MAX_PER_RUN }), "reminders due") ??
    []) as Due[];
  if (dryRun) {
    return json(req, {
      dry_run: true,
      due: due.map(({ kind, subscription_id, period_end, schedule_failed }) => ({
        kind,
        subscription_id,
        period_end,
        ...(schedule_failed ? { held: "schedule_failed" } : {}),
      })),
    });
  }

  // Prices in the membership's currency: a yearly plan continues at the
  // monthly price of its own currency, and the included month offers the
  // memberships in the currency the report was paid in.
  const subIds = [...new Set(due.map((r) => r.subscription_id))];
  const subCur = new Map<string, string>();
  for (let i = 0; i < subIds.length; i += 200) {
    const rows = must(
      await db.from("subscriptions").select("id, currency, country").in("id", subIds.slice(i, i + 200)),
      "subscription currencies",
    ) ?? [];
    for (const s of rows) {
      const cur = String(s.currency ?? "").toUpperCase();
      subCur.set(
        s.id as string,
        hasCurrency(cur) ? cur : s.country ? currencyForCountry(s.country as string) : FALLBACK_CURRENCY,
      );
    }
  }
  const pricesFor = (subscriptionId: string) => {
    const currency = subCur.get(subscriptionId) ?? "KWD";
    return { monthly: priceOf("monthly", currency), yearly: priceOf("yearly", currency), currency };
  };
  const counts = { sent: 0, skipped: 0, failed: 0, held: 0 };

  for (const r of due) {
    // Without the schedule the membership would renew yearly, so the reminder
    // ("then KWD 5 a month", in its own currency) would be wrong. Hold it (no claim) until an admin
    // fixes the schedule (stripe.schedule_failed is on the admin dashboard);
    // a later run sends it while the 30-day window is still open.
    if (r.kind === "yearly_renewal" && r.schedule_failed) {
      console.warn("yearly reminder held: the Stripe schedule failed", r.subscription_id);
      counts.held++;
      continue;
    }
    // Claim first: the unique index makes a second claim for the same period fail.
    const { data: claim, error: claimErr } = await db.from("email_reminders").insert({
      kind: r.kind,
      subscription_id: r.subscription_id,
      user_id: r.user_id,
      period_end: r.period_end,
      locale: r.locale === "ar" ? "ar" : "en",
    }).select("id").maybeSingle();
    if (claimErr || !claim) {
      if (claimErr?.code !== "23505") {
        console.error("reminder claim failed", r.kind, r.subscription_id, claimErr?.message);
      }
      counts.skipped++;
      continue;
    }

    let sentId: string | undefined;
    let error: string | undefined;
    try {
      const to = await customerContact(r.user_id);
      if (!to) {
        // No account email: keep the claim so it is not retried every day.
        await db.from("email_reminders").update({ provider_id: "no_email" }).eq("id", claim.id);
        counts.skipped++;
        continue;
      }
      const msg = r.kind === "included_ending"
        ? includedEndingEmail({
          locale: to.locale,
          name: to.name,
          endsAt: r.period_end,
          monthlyLink: customerUrl(to.locale, "/account?join=membership_monthly"),
          yearlyLink: customerUrl(to.locale, "/account?join=membership_yearly"),
          prices: pricesFor(r.subscription_id),
        })
        : yearlyRenewalEmail({
          locale: to.locale,
          name: to.name,
          endsAt: r.period_end,
          accountLink: customerUrl(to.locale, "/account"),
          prices: pricesFor(r.subscription_id),
        });
      const res = await sendEmail({ to: to.email, ...msg });
      if (res.ok) sentId = res.id ?? "sent";
      else error = res.error;
    } catch (err) {
      error = (err as Error).message;
    }

    if (sentId) {
      must(
        await db.from("email_reminders").update({ sent_at: new Date().toISOString(), provider_id: sentId }).eq(
          "id",
          claim.id,
        ),
        "reminder sent",
      );
      counts.sent++;
    } else {
      console.warn("reminder email not sent", r.kind, r.subscription_id, error);
      await db.from("email_reminders").delete().eq("id", claim.id);
      counts.failed++;
    }
  }

  if (expired || counts.sent || counts.failed || counts.held) {
    await audit("membership.reminders_run", "system", null, { expired_included: expired, ...counts });
  }
  return json(req, { expired_included: expired, due: due.length, ...counts });
});
