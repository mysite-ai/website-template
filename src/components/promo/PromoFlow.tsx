import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Check, Phone, Share2, Sparkles } from "lucide-react";
import { qrValue, useAttribution, type AttributionLocation } from "@/lib/attribution/useAttribution";
import {
  getMetaEventId,
  trackLeadSubmitted,
  trackMetaEventOnce,
  trackQrGenerated,
  type PixelLocation,
} from "@/lib/attribution/metaPixel";
import { shareQrImage } from "@/lib/promo/shareQrImage";
import { formatPhone } from "@/lib/utils";

export interface PromoFlowProps {
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  addressLabel: string;
  domain: string;
  phone: string | null;
  promotionName: string | null;
  rewardDescription: string | null;
  attribution: AttributionLocation | null;
  pixel: PixelLocation;
}

type FlowStep = "teaser" | "revealed" | "phone" | "done";

/**
 * Loyalty / QR flow. Mirrors wbc-v2's `Promocja.tsx`:
 * teaser -> revealed -> phone -> done, with the shareable QR canvas.
 */
export default function PromoFlow(props: PromoFlowProps) {
  const {
    brandName,
    brandSlug,
    brandLogoUrl,
    addressLabel,
    domain,
    phone,
    promotionName,
    rewardDescription,
    attribution,
    pixel,
  } = props;

  const {
    user,
    progress,
    phoneSaved,
    registering,
    error,
    clearError,
    register,
    savePhone,
  } = useAttribution(attribution);

  const [phoneInput, setPhoneInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<FlowStep>(() =>
    phoneSaved ? "done" : user ? "revealed" : "teaser",
  );

  useEffect(() => {
    setStep(phoneSaved ? "done" : user ? "revealed" : "teaser");
  }, [user, phoneSaved]);

  const handleReveal = async () => {
    const qrEventId = getMetaEventId("QRGenerated");
    const result = await register({ qrEventId });
    if (result) {
      trackMetaEventOnce(`mysite_meta_qr_generated_${result.id}`, () =>
        trackQrGenerated(pixel, qrEventId),
      );
      setStep("revealed");
    }
  };

  const handlePhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 9);
    setPhoneInput(digits);
  };

  const isPhoneValid = phoneInput.replace(/\D/g, "").length === 9;

  const handleSavePhone = async () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length !== 9) return;
    const leadEventId = getMetaEventId("Lead");
    setSaving(true);
    const ok = await savePhone(`+48${digits}`, { leadEventId });
    setSaving(false);
    if (ok) {
      trackMetaEventOnce(`mysite_meta_lead_submitted_${user?.id ?? "unknown"}`, () =>
        trackLeadSubmitted(pixel, leadEventId),
      );
      setStep("done");
    }
  };

  const rewardLabel =
    rewardDescription ?? user?.first_reward_description ?? "Your reward code";
  const promotionLabel = promotionName ?? user?.promotion_name ?? "Loyalty program";
  const fileNameSlug = brandSlug || "mysite";

  const saveQr = (canvasId: string, rewardText: string) =>
    shareQrImage({
      qrCanvasId: canvasId,
      brandName,
      rewardText,
      address: addressLabel,
      domain,
      fileNameSlug,
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="section-well py-6 sm:py-8">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          data-umami-event="click-back"
          data-umami-event-target="promo-page"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back
        </a>

        <div className="mt-8 text-center">
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={brandName}
              className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-5 object-contain"
            />
          ) : (
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-muted text-foreground grid place-items-center text-2xl font-semibold">
              {brandName.charAt(0)}
            </div>
          )}

          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight leading-tight">
            {promotionLabel}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed max-w-[24rem] mx-auto">
            Scan the QR code at the counter to claim your reward.
          </p>
        </div>

        {/* STEP 1 — TEASER */}
        {step === "teaser" && (
          <div className="map-card mt-6 p-6 sm:p-8 relative overflow-hidden">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {brandName}
            </p>
            <p className="text-xl sm:text-2xl font-semibold mb-4">{rewardLabel}</p>

            <div className="relative flex justify-center mb-4">
              <div
                className="cursor-pointer group"
                onClick={!registering ? handleReveal : undefined}
              >
                <div className="bg-background p-4 rounded-xl border border-border shadow-sm">
                  <div
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg bg-[repeating-conic-gradient(#00000015_0deg_10deg,#00000000_10deg_20deg)]"
                    style={{ filter: "blur(6px)", opacity: 0.5 }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleReveal}
                  disabled={registering}
                  data-umami-event="click-reveal-qr"
                  data-umami-event-target="promo-teaser"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg hover:scale-105 transition-transform disabled:opacity-70 disabled:cursor-progress"
                >
                  {registering ? (
                    <span className="animate-pulse">Generating…</span>
                  ) : (
                    <>
                      <Sparkles size={18} aria-hidden="true" />
                      Reveal your code
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Tap to unlock your personal code
            </p>

            {error && <ErrorBanner error={error} onDismiss={clearError} />}
          </div>
        )}

        {/* STEP 2 — REVEALED */}
        {step === "revealed" && user && (
          <div className="mt-6 space-y-4">
            <div className="map-card p-5 sm:p-6 text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {rewardLabel}
              </p>
              <div className="bg-background p-4 rounded-xl border border-border shadow-sm inline-block">
                <QRCodeCanvas
                  id="qr-revealed"
                  value={qrValue(user.first_reward_code ?? user.full_code, user.id)}
                  size={200}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Show this code at the counter to claim your reward
              </p>
              <button
                type="button"
                onClick={() => saveQr("qr-revealed", rewardLabel)}
                data-umami-event="click-save-qr"
                data-umami-event-target="promo-revealed"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:scale-[1.01] transition-transform"
              >
                <Share2 size={16} aria-hidden="true" /> Save to photos
              </button>
            </div>

            <div className="map-card p-5 sm:p-6">
              <p className="text-lg font-semibold text-center mb-1">Save your number</p>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Get notified when new rewards unlock
              </p>
              <PhoneField
                value={phoneInput}
                onChange={handlePhoneInput}
                onSubmit={handleSavePhone}
                isValid={isPhoneValid}
                saving={saving}
              />
              {error && <ErrorBanner error={error} onDismiss={clearError} />}
              <p className="text-xs text-muted-foreground mt-3 text-center">
                🔒 Rewards only. Zero spam.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3 — DONE */}
        {step === "done" && user && (
          <div className="mt-6 space-y-4">
            <div className="map-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                  {(typeof localStorage !== "undefined" && localStorage.getItem("qr_user_phone")?.slice(-2)) || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {typeof localStorage !== "undefined" ? localStorage.getItem("qr_user_phone") ?? "—" : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Your number · code linked</p>
                </div>
              </div>
              <div className="pill">
                <Check size={12} aria-hidden="true" /> Active
              </div>
            </div>

            {progress && (
              <div className="map-card p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Your progress</span>
                  <span className="font-semibold">
                    {progress.total_visits} / {progress.rewards_total} visits
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-700"
                    style={{
                      width: `${Math.min(
                        100,
                        (progress.total_visits / Math.max(1, progress.rewards_total)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {progress?.all_rewards?.map((reward, i) => {
              const isNext = !reward.unlocked && progress.next_reward?.description === reward.description;
              return (
                <div key={i} className="map-card p-4 text-center">
                  {reward.unlocked ? (
                    <>
                      <p className="text-sm font-semibold line-through opacity-70">{reward.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Redeemed</p>
                    </>
                  ) : isNext ? (
                    <>
                      <div className="bg-background p-3 rounded-xl border border-border shadow-sm inline-block">
                        <QRCodeCanvas
                          id={`qr-card-${i}`}
                          value={qrValue(reward.pos_code, user.id)}
                          size={160}
                          level="M"
                        />
                      </div>
                      <p className="text-base font-semibold mt-3">{reward.description}</p>
                      <p className="text-xs text-primary font-medium mt-1">
                        Show this code at the counter
                      </p>
                      <button
                        type="button"
                        onClick={() => saveQr(`qr-card-${i}`, reward.description)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                      >
                        <Share2 size={14} aria-hidden="true" /> Save to photos
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">🔒 Visit #{reward.visit_number}</p>
                      <p className="text-xs text-muted-foreground mt-1">Unlocks after previous codes are redeemed</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Location card */}
        <div className="map-card mt-6 p-5 sm:p-6">
          <p className="text-sm font-semibold">📍 {brandName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{addressLabel}</p>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              data-umami-event="click-call"
              data-umami-event-target="promo-page"
            >
              <Phone size={16} aria-hidden="true" />
              {formatPhone(phone)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface PhoneFieldProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isValid: boolean;
  saving: boolean;
}

function PhoneField({ value, onChange, onSubmit, isValid, saving }: PhoneFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex h-14 rounded-xl border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
        <div className="flex items-center px-3 bg-muted border-r border-border text-sm font-semibold text-muted-foreground shrink-0 select-none">
          🇵🇱 +48
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="500 000 000"
          maxLength={11}
          className="flex-1 px-3 py-2 text-lg font-medium bg-transparent outline-none placeholder:text-muted-foreground"
          aria-label="Phone number"
        />
        {value.length > 0 && (
          <div className="flex items-center pr-3">
            {isValid ? (
              <Check size={18} className="text-primary" aria-hidden="true" />
            ) : (
              <span className="text-xs text-muted-foreground">
                {value.replace(/\D/g, "").length}/9
              </span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || !isValid}
        data-umami-event="click-submit-phone"
        data-umami-event-target="promo-phone-form"
        className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-base font-semibold inline-flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "…" : "Save number"}
      </button>
    </div>
  );
}

function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium px-4 py-3 rounded-xl">
      <span className="shrink-0" aria-hidden="true">
        ⚠️
      </span>
      <p className="flex-1">{error}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-destructive/60 hover:text-destructive"
        aria-label="Zamknij"
      >
        ✕
      </button>
    </div>
  );
}
