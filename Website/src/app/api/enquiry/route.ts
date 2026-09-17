import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

/**
 * Enquiries are relayed server-side rather than posted from the browser.
 *
 * Two reasons this is not a direct client -> CRM fetch:
 *  1. The inbound key is the only thing protecting that endpoint. Putting it in a
 *     NEXT_PUBLIC_ variable would publish it in the JS bundle, and anyone could then
 *     post junk leads straight into the CRM.
 *  2. HMAC signing needs the shared secret, which must never reach the client.
 *
 * The field names below match the synonyms the CRM's GenericInboundProvider already
 * understands, so leads land with Requirements (budget / timeframe / interest) populated
 * instead of dumped into the Form Responses catch-all.
 */

interface EnquiryPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  interested_in?: string;
  budget?: string;
  timeframe?: string;
  message?: string;
  form_name?: string;
  property_reference?: string;
  page_url?: string;
  locale?: string;
}

const MAX_FIELD = 2000;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as EnquiryPayload;
  const email = clean(input.email);
  const phone = clean(input.phone);

  // An enquiry with no way to reply is worthless to the client and would sit in the
  // CRM as an untouchable row, so it is rejected here rather than forwarded.
  if (!email && !phone) {
    return NextResponse.json({ error: "no_contact" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Checked only after the input is known to be good, so a malformed submission is
  // reported as a client error whatever the deployment config happens to be.
  const inboundUrl = process.env.CRM_INBOUND_URL;
  if (!inboundUrl) {
    // Logged loudly, but the visitor is never told the site is misconfigured — they
    // would simply leave. The enquiry is still lost, so this must be monitored.
    console.error("[enquiry] CRM_INBOUND_URL is not set; the enquiry was not delivered.");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const payload = {
    first_name: clean(input.firstName),
    last_name: clean(input.lastName),
    email,
    phone,
    whatsapp: clean(input.whatsapp),
    interested_in: clean(input.interested_in),
    budget: clean(input.budget),
    timeframe: clean(input.timeframe),
    message: clean(input.message),
    source: "website",
    form_name: clean(input.form_name) ?? "Website enquiry",
    property_reference: clean(input.property_reference),
    page_url: clean(input.page_url),
    language: clean(input.locale),
  };

  const raw = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };

  const secret = process.env.CRM_SIGNING_SECRET;
  if (secret) {
    // Must be computed over the exact bytes sent, or the receiver's check fails.
    headers["X-Vrodux-Signature"] = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  }

  try {
    const res = await fetch(inboundUrl, {
      method: "POST",
      headers,
      body: raw,
      // The CRM acks immediately and processes from its durable inbox, so a slow
      // response means something is wrong rather than something is queued.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[enquiry] CRM rejected the lead: ${res.status} ${await res.text().catch(() => "")}`);
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[enquiry] Could not reach the CRM:", err);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
