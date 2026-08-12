/**
 * Trial registration API — two-step challenge-response.
 *
 * Security flow:
 *   1. fetchChallenge()  → GET  /api/trial/challenge
 *      Backend issues a short-lived (10 min), single-use HMAC-signed token.
 *      No secret is embedded in the frontend; the token is opaque to the client.
 *
 *   2. registerTrial()   → POST /api/trial/register  { X-Trial-Token: <token> }
 *      Backend verifies HMAC + timestamp + burns the nonce (no replay possible).
 *
 * Rate limits (enforced server-side):
 *   challenge  — 5 req / IP / 60 s
 *   register   — 3 req / IP / 300 s
 */

import type { BackendResponse } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/trial`;

export interface TrialRegistrationRequest {
  fullName:      string;
  email:         string;
  password:      string;
  orgName:       string;
  industry?:     string;
  country?:      string;
  businessType?: string;
  fiscalYear?:   string;
  language?:     string;
  currency?:     string;
  timezone?:     string;
  modules?:      string[];
  // Captured from the marketing pricing page:
  //   erp.vrodux.com/trial?plan=micro&billing=annual&intent=buy&utm_source=pricing
  plan?:         string;
  billing?:      string;
  intent?:       string;
  utmSource?:    string;
}

export interface TrialRegistrationResponse {
  tenantId:    string;
  tenantSlug:  string;
  userId:      string;
  email:       string;
  trialEndsAt: string | null;
  /** Tier the tenant was actually created on (server-resolved, may differ from the requested slug). */
  plan?:       string | null;
  /** True when `intent=buy` — send the user to checkout rather than into the app. */
  checkoutRequested?: boolean;
  billingPeriod?: string | null;
}

// ── Step 1: Fetch challenge token ─────────────────────────────────────────────

async function fetchChallenge(): Promise<string> {
  const res  = await fetch(`${BASE}/challenge`);
  const json: BackendResponse<{ token: string }> = await res.json().catch(() => ({
    success: false, data: null, message: res.statusText, errorCode: null, traceId: "",
  }));

  if (!res.ok || !json.success || !json.data?.token) {
    if (res.status === 429)
      throw new ApiError(429, "RateLimit", "Too many requests. Please wait a moment and try again.");
    throw new ApiError(res.status, json.errorCode, json.message ?? "Failed to obtain challenge token.");
  }

  return json.data.token;
}

// ── Step 2: Register with challenge token ─────────────────────────────────────

export async function registerTrial(
  data: TrialRegistrationRequest
): Promise<TrialRegistrationResponse> {
  // Obtain a fresh single-use challenge token immediately before the request
  const challengeToken = await fetchChallenge();

  const res = await fetch(`${BASE}/register`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "X-Trial-Token": challengeToken,
    },
    body: JSON.stringify(data),
  });

  const json: BackendResponse<TrialRegistrationResponse> = await res.json().catch(() => ({
    success: false, data: null, message: res.statusText, errorCode: null, traceId: "",
  }));

  if (!res.ok || !json.success) {
    if (res.status === 429)
      throw new ApiError(429, "RateLimit", "Too many registration attempts. Please wait 5 minutes and try again.");
    if (res.status === 401)
      throw new ApiError(401, "Trial.InvalidChallenge", "Security check failed. Please refresh the page and try again.");
    throw new ApiError(res.status, json.errorCode, json.message ?? `HTTP ${res.status}`);
  }

  return json.data!;
}
