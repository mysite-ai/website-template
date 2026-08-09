import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUser,
  findByPhone,
  getUser,
  updatePhone,
  type ProgressData,
  type RegisterBody,
  type RegisteredUser,
} from "./client";
import {
  getAttributionParam,
  getCookie,
  getGaSessionCookie,
  getMultiFbc,
  persistUtmParams,
} from "./tracking";

/**
 * useAttribution — direct port of wbc-v2's `useQrTracker` adapted to
 * receive tenant fields as arguments instead of pulling from a
 * `LocationConfig` context.
 *
 * Behavior matches wbc-v2 verbatim:
 *   - `registerPromise` + `lockRef` module-level dedupe
 *   - `localStorage.qr_user` / `localStorage.qr_user_phone` caching
 *   - `GET /users/phone/:phone` probe-then-swap in `savePhone`
 *   - Same error strings for the same failure modes
 *
 * See docs/04-attribution-integration.md.
 */

export interface AttributionLocation {
  promotionId: string;
  campaignId: string;
  orgId: string;
}

export interface QrUser extends RegisteredUser {
  // Locally-cached copy — everything already in `RegisteredUser`.
}

interface RegisterMeta {
  qrEventId?: string;
}

interface SavePhoneMeta {
  leadEventId?: string;
}

// Module-scoped, so concurrent hook instances share one in-flight request.
let registerPromise: Promise<QrUser | null> | null = null;

// Persist attribution params on module load (matches wbc-v2 side effect).
if (typeof window !== "undefined") persistUtmParams();

export function useAttribution(location: AttributionLocation | null) {
  const [user, setUser] = useState<QrUser | null>(() => {
    if (typeof localStorage === "undefined") return null;
    try {
      const stored = localStorage.getItem("qr_user");
      return stored ? (JSON.parse(stored) as QrUser) : null;
    } catch {
      return null;
    }
  });
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(() =>
    typeof localStorage !== "undefined" && !!localStorage.getItem("qr_user_phone"),
  );
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const buildBody = useCallback(
    (loc: AttributionLocation, meta?: RegisterMeta): RegisterBody => ({
      promotion_id: loc.promotionId,
      campaign_id: loc.campaignId,
      org_id: loc.orgId,
      fbc: getCookie("_fbc"),
      fbp: getCookie("_fbp"),
      fbclid: getAttributionParam("fbclid"),
      ga: getCookie("_ga"),
      ga_session: getGaSessionCookie(),
      multi_fbc: getMultiFbc(),
      qr_event_id: meta?.qrEventId ?? null,
      utm_source: getAttributionParam("utm_source"),
      utm_medium: getAttributionParam("utm_medium"),
      utm_campaign: getAttributionParam("utm_campaign"),
      utm_content: getAttributionParam("utm_content"),
      r: getAttributionParam("r"),
      c: getAttributionParam("c"),
    }),
    [],
  );

  const register = useCallback(
    async (meta?: RegisterMeta): Promise<QrUser | null> => {
      setError(null);
      if (!location) {
        setError("Promotion is not configured.");
        return null;
      }

      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("qr_user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as QrUser;
            setUser(parsed);
            return parsed;
          } catch {
            /* fall through */
          }
        }
      }

      if (lockRef.current && registerPromise) return registerPromise;
      lockRef.current = true;
      setRegistering(true);

      registerPromise = (async (): Promise<QrUser | null> => {
        try {
          const data = await createUser(buildBody(location, meta));
          if ("status" in data && data.status === "exists") {
            setError(data.message ?? "This phone number is already registered.");
            return null;
          }
          const registered = data as QrUser;
          try {
            localStorage.setItem("qr_user", JSON.stringify(registered));
          } catch {
            /* ignore */
          }
          setUser(registered);
          return registered;
        } catch (err) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Can't reach the server. Check your connection and try again.";
          setError(message);
          return null;
        } finally {
          setRegistering(false);
          lockRef.current = false;
          registerPromise = null;
        }
      })();

      return registerPromise;
    },
    [buildBody, location],
  );

  // If the phone is already saved (returning visitor), fetch progress by phone.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const phone = localStorage.getItem("qr_user_phone");
    if (!phone) return;
    (async () => {
      const found = await findByPhone(phone);
      if (found?.progress) setProgress(found.progress);
    })();
  }, [phoneSaved]);

  // Otherwise fetch progress by user id.
  useEffect(() => {
    if (!user || phoneSaved) return;
    (async () => {
      const data = await getUser(user.id);
      if (data?.progress) setProgress(data.progress);
    })();
  }, [user, phoneSaved]);

  const savePhone = useCallback(
    async (phoneNumber: string, meta?: SavePhoneMeta): Promise<boolean> => {
      setError(null);
      if (!user) {
        setError("Generate a QR code first.");
        return false;
      }
      try {
        // Probe-then-swap: if this phone already belongs to another user,
        // adopt that user id and skip the PATCH.
        const existing = await findByPhone(phoneNumber);
        if (existing?.user && existing.user.id !== user.id) {
          const swapped: QrUser = {
            id: existing.user.id,
            full_code: existing.user.full_code,
          };
          try {
            localStorage.setItem("qr_user", JSON.stringify(swapped));
            localStorage.setItem("qr_user_phone", phoneNumber);
          } catch {
            /* ignore */
          }
          setUser(swapped);
          setProgress(existing.progress ?? null);
          setPhoneSaved(true);
          return true;
        }

        await updatePhone(user.id, phoneNumber, meta?.leadEventId ?? null);
        try {
          localStorage.setItem("qr_user_phone", phoneNumber);
        } catch {
          /* ignore */
        }
        setPhoneSaved(true);
        return true;
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't save the number. Please try again.";
        setError(message);
        return false;
      }
    },
    [user],
  );

  return useMemo(
    () => ({ user, progress, phoneSaved, registering, error, clearError, register, savePhone }),
    [user, progress, phoneSaved, registering, error, clearError, register, savePhone],
  );
}

export function qrValue(code: string | null | undefined, userId: string): string {
  const normalizedCode = code?.trim() || "UNKNOWN";
  if (normalizedCode.endsWith(`-${userId}`)) return normalizedCode;
  return `${normalizedCode}-${userId}`;
}
