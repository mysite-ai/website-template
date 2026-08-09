/**
 * Port of wbc-v2's `saveQrImage` — renders the QR + reward + address +
 * domain + "powered by mysite.ai" as a 600×800 PNG on a canvas and
 * invokes `navigator.share` with the file (falling back to download).
 *
 * Uses the tenant's brand name in place of the hard-coded
 * "The White Bear Coffee" title.
 */

interface ShareInput {
  qrCanvasId: string;
  brandName: string;
  rewardText: string;
  address: string;
  domain: string;
  fileNameSlug: string;
}

export function shareQrImage(input: ShareInput) {
  const { qrCanvasId, brandName, rewardText, address, domain, fileNameSlug } = input;
  const qr = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
  if (!qr) return;

  const w = 600;
  const h = 800;
  const pad = 40;
  const qrSize = 320;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.fill();

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#171717");
  grad.addColorStop(1, "#404040");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 6, [24, 24, 0, 0]);
  ctx.fill();

  ctx.fillStyle = "#171717";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(brandName, w / 2, pad + 40);

  ctx.fillStyle = "#525252";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(rewardText, w / 2, pad + 78);

  const qrX = (w - qrSize) / 2;
  const qrY = pad + 110;

  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 16);
  ctx.fill();

  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  const bottomY = qrY + qrSize + 50;
  ctx.fillStyle = "#171717";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("Pokaż ten kod w kawiarni", w / 2, bottomY);

  ctx.fillStyle = "#a3a3a3";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText(address, w / 2, bottomY + 30);
  ctx.fillText(domain, w / 2, bottomY + 55);

  ctx.fillStyle = "#d4d4d4";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("powered by mysite.ai", w / 2, h - 20);

  c.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `${fileNameSlug}-qr.png`, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      nav.share({ title: brandName, files: [file] }).catch(() => {
        /* user cancelled */
      });
    } else {
      const link = document.createElement("a");
      link.download = `${fileNameSlug}-qr.png`;
      link.href = c.toDataURL();
      link.click();
    }
  });
}
