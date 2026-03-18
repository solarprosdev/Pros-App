/**
 * Ramp API client.
 * Step 1: Get an access token (client_credentials).
 * Step 2: GET /vendors – find vendor by name.
 * Step 3: POST /vendors/{id}/update-bank-accounts – update ACH details.
 */

const RAMP_TOKEN_URL = "https://api.ramp.com/developer/v1/token";
const RAMP_VENDORS_URL = "https://api.ramp.com/developer/v1/vendors";
const RAMP_SCOPES = "users:read users:write vendors:read vendors:write";

/** Thrown when Ramp explicitly rejects the routing number as invalid. */
export class RampRoutingNumberError extends Error {
  constructor(message = "Invalid routing number.") {
    super(message);
    this.name = "RampRoutingNumberError";
  }
}

export interface RampTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface RampVendor {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface RampVendorsResponse {
  data: RampVendor[];
  page?: { next?: string };
  [key: string]: unknown;
}

// ─── Step 1: Access Token ────────────────────────────────────────────────────

/**
 * Get a Ramp API access token using client_credentials.
 * Uses RAMP_BASIC_AUTH env var (Base64 encoded client_id:client_secret).
 */
export async function getRampAccessToken(): Promise<string> {
  console.log("[Ramp] ====== STEP 1: GET ACCESS TOKEN ======");
  console.log("[Ramp] [Token] POST", RAMP_TOKEN_URL);
  console.log("[Ramp] [Token] Scope:", RAMP_SCOPES);

  const basicAuth = process.env.RAMP_BASIC_AUTH?.trim();
  if (!basicAuth) {
    throw new Error("RAMP_BASIC_AUTH is not set in environment variables.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: RAMP_SCOPES,
  });

  const res = await fetch(RAMP_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const resText = await res.text();
  console.log("[Ramp] [Token] Response status:", res.status, res.statusText);
  console.log("[Ramp] [Token] Response body:", resText.slice(0, 500));

  if (!res.ok) {
    console.error("[Ramp] [Token] FAILED – status:", res.status, resText.slice(0, 300));
    throw new Error(`Ramp token request failed (${res.status}): ${resText.slice(0, 300)}`);
  }

  const data = JSON.parse(resText) as RampTokenResponse;
  console.log("[Ramp] [Token] SUCCESS – token_type:", data.token_type, "| expires_in:", data.expires_in, "| scope:", data.scope);
  console.log("[Ramp] [Token] access_token (first 20 chars):", data.access_token?.slice(0, 20) + "...");
  return data.access_token;
}

// ─── Step 2: GET Vendors ─────────────────────────────────────────────────────

/**
 * GET /vendors – returns the vendor list.
 * Optionally filters by name query param.
 */
export async function getRampVendors(
  accessToken: string,
  name?: string
): Promise<RampVendorsResponse> {
  const log = (msg: string, ...args: unknown[]) => console.log("[Ramp] [GET Vendors]", msg, ...args);
  const err = (msg: string, ...args: unknown[]) => console.error("[Ramp] [GET Vendors]", msg, ...args);

  console.log("[Ramp] ====== STEP 2: GET VENDORS ======");

  const url = new URL(RAMP_VENDORS_URL);
  if (name) url.searchParams.set("name", name);

  log("Request URL:", url.toString());
  log("Filtering by name:", name ?? "(none)");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const resText = await res.text();
  log("Response status:", res.status, res.statusText);
  log("Response body (first 1000 chars):", resText.slice(0, 1000));

  if (!res.ok) {
    err("FAILED – status:", res.status, resText.slice(0, 300));
    throw new Error(`Ramp GET vendors failed (${res.status}): ${resText.slice(0, 300)}`);
  }

  let parsed: RampVendorsResponse;
  try {
    parsed = JSON.parse(resText) as RampVendorsResponse;
  } catch {
    throw new Error(`Ramp GET vendors – unexpected non-JSON response: ${resText.slice(0, 200)}`);
  }

  log(`SUCCESS – total vendors returned: ${parsed.data?.length ?? 0}`);
  log("Vendor names in response:", parsed.data?.map((v) => `"${v.name}" (id: ${v.id})`));
  return parsed;
}

// ─── Step 3: Update Bank Account ─────────────────────────────────────────────

/**
 * POST /vendors/{vendorId}/update-bank-accounts
 * Updates ACH details for the given vendor.
 */
export async function updateVendorBankAccount(
  accessToken: string,
  vendorId: string,
  accountNumber: string,
  routingNumber: string
): Promise<unknown> {
  const log = (msg: string, ...args: unknown[]) => console.log("[Ramp] [Update Bank]", msg, ...args);
  const err = (msg: string, ...args: unknown[]) => console.error("[Ramp] [Update Bank]", msg, ...args);

  console.log("[Ramp] ====== STEP 3: UPDATE BANK ACCOUNT ======");

  const url = `${RAMP_VENDORS_URL}/${vendorId}/update-bank-accounts`;

  const payload = {
    ach_details: {
      account_number: accountNumber,
      routing_number: routingNumber,
    },
    is_default: false,
  };

  log("Request URL:", url);
  log("Vendor ID:", vendorId);
  log("Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const resText = await res.text();
  log("Response status:", res.status, res.statusText);
  log("Response body (first 1000 chars):", resText.slice(0, 1000));

  if (!res.ok) {
    err("FAILED – status:", res.status, resText.slice(0, 300));
    // Detect routing number validation error specifically so the caller can surface it to the user
    if (res.status === 422) {
      try {
        const errBody = JSON.parse(resText) as { error_v2?: { additional_info?: { ach_details?: { routing_number?: string[] } } } };
        const routingErrors = errBody?.error_v2?.additional_info?.ach_details?.routing_number;
        if (routingErrors && routingErrors.length > 0) {
          throw new RampRoutingNumberError(routingErrors[0]);
        }
      } catch (parseErr) {
        if (parseErr instanceof RampRoutingNumberError) throw parseErr;
      }
    }
    throw new Error(`Ramp update bank account failed (${res.status}): ${resText.slice(0, 300)}`);
  }

  let resJson: unknown;
  try {
    resJson = JSON.parse(resText);
  } catch {
    resJson = resText;
  }

  log("SUCCESS – full response:", JSON.stringify(resJson, null, 2));
  return resJson;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Full Ramp sync flow triggered on profile save:
 * 1. Get access token
 * 2. GET vendors, find vendor matching fullName
 * 3. POST update-bank-accounts for that vendor
 */
export async function syncRampBankAccount(
  fullName: string,
  accountNumber: string,
  routingNumber: string
): Promise<void> {
  const log = (msg: string, ...args: unknown[]) => console.log("[Ramp] [Sync]", msg, ...args);
  const err = (msg: string, ...args: unknown[]) => console.error("[Ramp] [Sync]", msg, ...args);

  log("Starting Ramp bank account sync for:", fullName);

  // Step 1
  const accessToken = await getRampAccessToken();

  // Step 2 – find vendor by name
  const vendorsRes = await getRampVendors(accessToken, fullName);
  const vendors = vendorsRes.data ?? [];

  const vendor = vendors.find(
    (v) => v.name?.toLowerCase().trim() === fullName.toLowerCase().trim()
  );

  if (!vendor) {
    err(`No vendor found matching name "${fullName}" – bank account update skipped`);
    log("Available vendor names:", vendors.map((v) => v.name));
    return;
  }

  log(`Found vendor: id=${vendor.id}, name=${vendor.name}`);

  // Step 3 – update bank account
  await updateVendorBankAccount(accessToken, vendor.id, accountNumber, routingNumber);

  log("Ramp bank account sync complete for:", fullName);
}
