/**
 * Thin fetch wrapper around attribution-autopilot's `/api/users`.
 *
 * The template is client-side-only for these calls — every restaurant
 * site talks to `https://attribution.mysite.cx/api` directly from the
 * browser. CORS is granted per-hostname via `location_origins` on the
 * attribution project (see docs/04-attribution-integration.md).
 */

export interface RegisterBody {
  promotion_id: string;
  campaign_id: string;
  org_id: string;
  fbc: string | null;
  fbp: string | null;
  fbclid: string | null;
  ga: string | null;
  ga_session: string | null;
  multi_fbc: string | null;
  qr_event_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  r: string | null;
  c: string | null;
}

export interface RegisteredUser {
  id: string;
  full_code: string;
  first_reward_code?: string | null;
  // Fields added by attribution-autopilot's `promotion_name + reward_description` change
  // (see docs/04-attribution-integration.md). Optional so the template still works
  // against the pre-change API during the rollout window.
  promotion_name?: string;
  first_reward_description?: string | null;
  created_at?: string;
  future_rewards?: Array<{ visit_number: number; description: string; pos_code: string }>;
}

export interface ExistingUserResponse {
  status: "exists";
  requires_recovery: true;
  message: string;
}

export type CreateUserResponse = RegisteredUser | ExistingUserResponse;

export interface PhoneLookupResult {
  user: { id: string; full_code: string };
  progress?: ProgressData | null;
}

export interface ProgressReward {
  visit_number: number;
  description: string;
  pos_code: string;
  unlocked: boolean;
}

export interface ProgressData {
  total_visits: number;
  rewards_earned: number;
  rewards_total: number;
  all_rewards?: ProgressReward[];
  next_reward?: { visits_left: number; description: string };
  visits?: Array<{
    visited_at?: string;
    scanned_at?: string;
    reward?: { description: string } | null;
  }>;
}

function getApiBase(): string {
  const base =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.PUBLIC_ATTRIBUTION_API_BASE as string | undefined)) ||
    "https://attribution.mysite.cx/api";
  return base.replace(/\/$/, "");
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Attribution API ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message?.[0] ?? body?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new AttributionError(message, res.status);
  }
  return (await res.json()) as T;
}

export class AttributionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AttributionError";
  }
}

export async function createUser(body: RegisterBody): Promise<CreateUserResponse> {
  return jsonRequest<CreateUserResponse>(`${getApiBase()}/users`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePhone(
  userId: string,
  phone: string,
  leadEventId: string | null,
): Promise<{ id: string }> {
  return jsonRequest<{ id: string }>(
    `${getApiBase()}/users/${encodeURIComponent(userId)}/phone`,
    {
      method: "PATCH",
      body: JSON.stringify({ phone, lead_event_id: leadEventId }),
    },
  );
}

export async function getUser(userId: string): Promise<{ progress?: ProgressData | null } | null> {
  try {
    return await jsonRequest(`${getApiBase()}/users/${encodeURIComponent(userId)}`);
  } catch {
    return null;
  }
}

export async function findByPhone(phone: string): Promise<PhoneLookupResult | null> {
  try {
    const res = await fetch(`${getApiBase()}/users/phone/${encodeURIComponent(phone)}`);
    if (!res.ok) return null;
    return (await res.json()) as PhoneLookupResult;
  } catch {
    return null;
  }
}
