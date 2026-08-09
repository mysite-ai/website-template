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

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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
 * Loyalty / QR flow, rebuilt on shadcn base-nova primitives (Card,
 * Button, Input, Progress, Separator) so the surface follows the same
 * design vocabulary as the rest of the site — and per-brand primary /
 * primary-foreground overrides propagate automatically.
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
        {/* Header row — logo + Back link on same line */}
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            data-umami-event="click-back"
            data-umami-event-target="promo-page"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
            Back
          </a>
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={brandName}
              className="w-8 h-8 object-contain opacity-90"
            />
          ) : (
            <span className="text-[12px] font-semibold tracking-tight text-muted-foreground">
              {brandName}
            </span>
          )}
        </div>

        {/* Title block */}
        <header className="mt-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {promotionLabel}
          </p>
          <h1 className="mt-2 text-[28px] sm:text-[32px] font-semibold tracking-tight leading-tight">
            {rewardLabel}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed max-w-[24rem] mx-auto">
            {step === "teaser"
              ? "Reveal your personal QR code below. Show it at the counter to claim your reward."
              : "Show this QR code at the counter to claim your reward."}
          </p>
        </header>

        {/* STEP 1 — TEASER */}
        {step === "teaser" && (
          <Card className="mt-8">
            <CardContent className="pt-2 pb-6 flex flex-col items-center">
              <button
                type="button"
                onClick={handleReveal}
                disabled={registering}
                className="relative mb-5 aspect-square w-56 rounded-2xl bg-muted/60 grid place-items-center group hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
                aria-label="Reveal your code"
              >
                {/* Blurred QR-ish pattern preview */}
                <div
                  aria-hidden="true"
                  className="absolute inset-4 rounded-xl bg-[repeating-conic-gradient(var(--foreground)_0deg_10deg,transparent_10deg_20deg)] opacity-[0.06] blur-md"
                />
                <span className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-md group-hover:scale-105 transition-transform">
                  {registering ? (
                    "Generating…"
                  ) : (
                    <>
                      <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
                      Reveal your code
                    </>
                  )}
                </span>
              </button>
              <p className="text-[12px] text-muted-foreground">Tap to unlock your personal code</p>
            </CardContent>
            {error && <ErrorRow message={error} onDismiss={clearError} />}
          </Card>
        )}

        {/* STEP 2 — REVEALED */}
        {step === "revealed" && user && (
          <div className="mt-8 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground text-center">
                  {rewardLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-foreground/10">
                  <QRCodeCanvas
                    id="qr-revealed"
                    value={qrValue(user.first_reward_code ?? user.full_code, user.id)}
                    size={168}
                    level="M"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                </div>
                <p className="mt-4 text-[12px] text-muted-foreground text-center">
                  Show at the counter · one-time use
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  onClick={() => saveQr("qr-revealed", rewardLabel)}
                  className="w-full h-9"
                  data-umami-event="click-save-qr"
                  data-umami-event-target="promo-revealed"
                >
                  <Share2 size={14} strokeWidth={2} aria-hidden="true" />
                  Save to photos
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Save your number</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Get notified when new rewards unlock.
                </p>
              </CardHeader>
              <CardContent>
                <PhoneField
                  value={phoneInput}
                  onChange={handlePhoneInput}
                  onSubmit={handleSavePhone}
                  isValid={isPhoneValid}
                  saving={saving}
                />
                {error && (
                  <div className="mt-3">
                    <ErrorRow message={error} onDismiss={clearError} />
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground text-center">
                  Rewards only · zero spam
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3 — DONE */}
        {step === "done" && user && (
          <div className="mt-8 space-y-4">
            {/* Account chip */}
            <Card size="sm">
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-[11px] font-semibold tabular-nums">
                    {(typeof localStorage !== "undefined" && localStorage.getItem("qr_user_phone")?.slice(-2)) || "??"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold tabular-nums">
                      {typeof localStorage !== "undefined" ? localStorage.getItem("qr_user_phone") ?? "—" : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Your number · code linked</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Check size={11} strokeWidth={2.5} aria-hidden="true" /> Active
                </span>
              </CardContent>
            </Card>

            {progress && (
              <Card size="sm">
                <CardContent>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[12px] font-medium text-muted-foreground">Your progress</p>
                    <p className="text-[12px] font-semibold tabular-nums">
                      {progress.total_visits} / {progress.rewards_total} visits
                    </p>
                  </div>
                  <Progress
                    value={Math.min(100, (progress.total_visits / Math.max(1, progress.rewards_total)) * 100)}
                    className="h-1.5"
                  />
                </CardContent>
              </Card>
            )}

            {progress?.all_rewards?.map((reward, i) => {
              const isNext = !reward.unlocked && progress.next_reward?.description === reward.description;
              return (
                <Card key={i}>
                  <CardHeader>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Visit #{reward.visit_number}
                    </p>
                    <CardTitle className={reward.unlocked ? "line-through text-muted-foreground" : ""}>
                      {reward.description}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    {reward.unlocked ? (
                      <p className="text-[13px] text-muted-foreground">Redeemed</p>
                    ) : isNext ? (
                      <>
                        <div className="rounded-2xl bg-white p-3 ring-1 ring-foreground/10">
                          <QRCodeCanvas
                            id={`qr-card-${i}`}
                            value={qrValue(reward.pos_code, user.id)}
                            size={144}
                            level="M"
                            fgColor="#000000"
                            bgColor="#ffffff"
                          />
                        </div>
                        <p className="mt-3 text-[12px] font-medium text-primary">
                          Show this code at the counter
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 py-4 text-[12px] text-muted-foreground">
                        <span aria-hidden="true">🔒</span>
                        Unlocks after previous codes are redeemed
                      </div>
                    )}
                  </CardContent>
                  {isNext && (
                    <CardFooter>
                      <Button
                        type="button"
                        onClick={() => saveQr(`qr-card-${i}`, reward.description)}
                        className="w-full h-9"
                        variant="outline"
                      >
                        <Share2 size={14} strokeWidth={2} aria-hidden="true" /> Save to photos
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Separator className="my-8" />

        {/* Location strip */}
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-tight">{brandName}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{addressLabel}</p>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline tabular-nums"
              data-umami-event="click-call"
              data-umami-event-target="promo-page"
            >
              <Phone size={14} strokeWidth={2} aria-hidden="true" />
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
    <div className="space-y-2.5">
      <div className="flex h-10 rounded-lg border border-input bg-transparent overflow-hidden focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-colors">
        <div className="flex items-center px-3 border-r border-input text-[13px] font-medium text-muted-foreground shrink-0 select-none tabular-nums">
          🇵🇱 +48
        </div>
        <Input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="500 000 000"
          maxLength={11}
          className="h-full border-0 rounded-none focus-visible:ring-0 focus-visible:border-0 text-base font-medium tabular-nums"
          aria-label="Phone number"
        />
      </div>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={saving || !isValid}
        size="lg"
        className="w-full h-10"
        data-umami-event="click-submit-phone"
        data-umami-event-target="promo-phone-form"
      >
        {saving ? "Saving…" : "Save number"}
      </Button>
    </div>
  );
}

function ErrorRow({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
      <span className="mt-0.5 shrink-0" aria-hidden="true">⚠</span>
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
