// Transactional email through Resend. EMAIL_FROM must be an address on a
// domain verified in Resend, e.g. "Name <reports@example.com>".
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${res.status} ${body?.message ?? ""}`.trim() };
  return { ok: true, id: body?.id };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** "Your report is ready" in the customer's language. */
export function reportReadyEmail(opts: { locale: "en" | "ar"; name: string | null; link: string; brand: string }): Omit<EmailMessage, "to"> {
  const link = escapeHtml(opts.link);
  const brand = escapeHtml(opts.brand);
  if (opts.locale === "ar") {
    const hi = opts.name ? `مرحبا ${escapeHtml(opts.name)}،` : "مرحبا،";
    const text = `${opts.name ? `مرحبا ${opts.name}،` : "مرحبا،"}\n\nتقريرك جاهز. راجعه الفريق ووافق عليه، وتقدر تشوفه الحين مع خطتك والصور.\n\n${opts.link}\n\n${opts.brand}`;
    const html = `<div dir="rtl" style="font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;line-height:1.7;color:#111">
<p>${hi}</p>
<p>تقريرك جاهز. راجعه الفريق ووافق عليه، وتقدر تشوفه الحين مع خطتك والصور.</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">افتح التقرير</a></p>
<p style="color:#666;font-size:13px">${brand}</p></div>`;
    return { subject: "تقريرك جاهز", html, text };
  }
  const hi = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const text = `${opts.name ? `Hi ${opts.name},` : "Hi,"}\n\nYour report is ready. A reviewer has checked and approved it, and you can open it now with your plan and visuals.\n\n${opts.link}\n\n${opts.brand}`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111">
<p>${hi}</p>
<p>Your report is ready. A reviewer has checked and approved it, and you can open it now with your plan and visuals.</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Open my report</a></p>
<p style="color:#666;font-size:13px">${brand}</p></div>`;
  return { subject: "Your report is ready", html, text };
}
