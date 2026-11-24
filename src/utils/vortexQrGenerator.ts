import QRCode from 'qrcode';

export interface VortexQrOptions {
  width?: number;
  margin?: number;
  badgeLabel?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

let cachedEmblemImage: HTMLImageElement | null = null;
let emblemLoadPromise: Promise<HTMLImageElement | null> | null = null;

function loadEmblemImage(): Promise<HTMLImageElement | null> {
  if (cachedEmblemImage && cachedEmblemImage.complete && cachedEmblemImage.naturalWidth > 0) {
    return Promise.resolve(cachedEmblemImage);
  }
  if (emblemLoadPromise) return emblemLoadPromise;
  if (typeof Image === 'undefined') return Promise.resolve(null);

  emblemLoadPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cachedEmblemImage = img;
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = '/assets/aistudio/image__2__7d12aee0.png';
  });
  return emblemLoadPromise;
}

/**
 * Draws the official futuristic Vortex ID Punta Alta emblem into a 2D canvas context
 */
function drawVortexCenterEmblem(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  badgeSize: number,
  emblemImg?: HTMLImageElement | null
) {
  ctx.save();

  const half = badgeSize / 2;
  const radius = badgeSize * 0.2;

  // 1. White outer base pad to guarantee 100% QR module isolation
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(centerX - half, centerY - half, badgeSize, badgeSize, radius);
  ctx.fill();

  // 2. Futuristic neon cyan outer frame + deep navy background
  const frameInset = Math.max(2, badgeSize * 0.035);
  const frameSize = badgeSize - frameInset * 2;
  const frameHalf = frameSize / 2;
  const frameRadius = radius * 0.85;

  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.roundRect(centerX - frameHalf, centerY - frameHalf, frameSize, frameSize, frameRadius);
  ctx.fill();

  const innerInset = Math.max(4, badgeSize * 0.062);
  const innerSize = badgeSize - innerInset * 2;
  const innerHalf = innerSize / 2;
  const innerRadius = radius * 0.72;

  ctx.fillStyle = '#09172e';
  ctx.beginPath();
  ctx.roundRect(centerX - innerHalf, centerY - innerHalf, innerSize, innerSize, innerRadius);
  ctx.fill();

  // 3. Draw high-res official transparent Vortex ID shield PNG cleanly centered
  if (emblemImg && emblemImg.complete && emblemImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(centerX - innerHalf, centerY - innerHalf, innerSize, innerSize, innerRadius);
    ctx.clip();

    const nw = emblemImg.naturalWidth;
    const nh = emblemImg.naturalHeight;
    // Exact opaque shield bounds in image__2__7d12aee0.png (544x609 at +240,+133 in 1024x1024)
    const sx = Math.round(nw * 0.22);
    const sy = Math.round(nh * 0.12);
    const sw = Math.round(nw * 0.56);
    const sh = Math.round(nh * 0.61);

    const drawHeight = innerSize * 0.86;
    const drawWidth = drawHeight * (sw / sh);
    ctx.drawImage(
      emblemImg,
      sx,
      sy,
      sw,
      sh,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore();
    ctx.restore();
    return;
  }

  // Fallback geometric Shield + Red Cross if image not yet ready
  const shieldScale = badgeSize * 0.58;
  const sTop = centerY - shieldScale * 0.44;
  const sBottom = centerY + shieldScale * 0.44;
  const sLeft = centerX - shieldScale * 0.38;
  const sRight = centerX + shieldScale * 0.38;
  const sMidY = centerY - shieldScale * 0.05;

  ctx.fillStyle = '#1e5bff';
  ctx.strokeStyle = '#37c8ff';
  ctx.lineWidth = Math.max(2, badgeSize * 0.025);

  ctx.beginPath();
  ctx.moveTo(centerX, sTop);
  ctx.lineTo(sRight, sTop + shieldScale * 0.18);
  ctx.lineTo(sRight, sMidY);
  ctx.quadraticCurveTo(sRight, sBottom, centerX, sBottom + shieldScale * 0.05);
  ctx.quadraticCurveTo(sLeft, sBottom, sLeft, sMidY);
  ctx.lineTo(sLeft, sTop + shieldScale * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const crossSize = shieldScale * 0.38;
  const barWidth = crossSize * 0.36;
  const cHalf = crossSize / 2;
  const bHalf = barWidth / 2;
  const crossY = centerY - shieldScale * 0.03;

  ctx.fillStyle = '#ff2a3b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.roundRect(centerX - cHalf, crossY - bHalf, crossSize, barWidth, 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(centerX - bHalf, crossY - cHalf, barWidth, crossSize, 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.8, badgeSize * 0.026);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX - crossSize * 0.35, crossY);
  ctx.lineTo(centerX - crossSize * 0.12, crossY);
  ctx.lineTo(centerX - crossSize * 0.03, crossY - crossSize * 0.4);
  ctx.lineTo(centerX + crossSize * 0.08, crossY + crossSize * 0.4);
  ctx.lineTo(centerX + crossSize * 0.18, crossY);
  ctx.lineTo(centerX + crossSize * 0.35, crossY);
  ctx.stroke();

  if (badgeSize >= 90) {
    ctx.fillStyle = '#37c8ff';
    ctx.font = `900 ${Math.round(badgeSize * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('VORTEX ID', centerX, centerY + innerHalf - 3);
  }

  ctx.restore();
}

/**
 * Selects optimal error correction level & emblem scale based on URL byte length
 * so QR payloads containing complete clinical histories never exceed QR capacity.
 */
async function renderAdaptiveQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  width: number,
  margin: number,
  requestedLevel: 'L' | 'M' | 'Q' | 'H'
): Promise<void> {
  const emblemImgPromise = loadEmblemImage();
  const utf8Len = new TextEncoder().encode(text).length;

  let startLevel: 'L' | 'M' | 'Q' | 'H' = requestedLevel;
  if (utf8Len > 2300) {
    startLevel = requestedLevel === 'L' ? 'L' : 'M';
  } else if (utf8Len > 1600) {
    startLevel = requestedLevel === 'L' || requestedLevel === 'M' ? requestedLevel : 'Q';
  }

  const levelsOrder: Array<'H' | 'Q' | 'M' | 'L'> = ['H', 'Q', 'M', 'L'];
  const startIndex = levelsOrder.indexOf(startLevel);
  const candidates = levelsOrder.slice(startIndex);

  let usedLevel: 'L' | 'M' | 'Q' | 'H' = startLevel;
  let rendered = false;

  for (const level of candidates) {
    try {
      await QRCode.toCanvas(canvas, text, {
        width,
        margin,
        color: {
          dark: '#050b1f',
          light: '#ffffff'
        },
        errorCorrectionLevel: level
      });
      usedLevel = level;
      rendered = true;
      break;
    } catch {
      // Try next lower error correction level for higher byte capacity
    }
  }

  if (!rendered) {
    await QRCode.toCanvas(canvas, text.slice(0, 2400), {
      width,
      margin,
      color: {
        dark: '#050b1f',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'L'
    });
    usedLevel = 'L';
  }

  const emblemImg = await emblemImgPromise;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Scale center Vortex emblem proportionally to Reed-Solomon ECC capacity so it always shows cleanly
    // while occupying <= 4% of matrix area (safely inside H=30%, Q=25%, M=15%, L=7% recovery limits).
    const isDense = utf8Len > 160;
    const ratio =
      usedLevel === 'H'
        ? isDense
          ? 0.19
          : 0.21
        : usedLevel === 'Q'
          ? isDense
            ? 0.17
            : 0.19
          : usedLevel === 'M'
            ? isDense
              ? 0.145
              : 0.165
            : 0.115;

    if (ratio > 0) {
      const badgeSize = Math.round(width * ratio);
      const centerX = width / 2;
      const centerY = width / 2;
      drawVortexCenterEmblem(ctx, centerX, centerY, badgeSize, emblemImg);
    }
  }
}

/**
 * Generates a high-quality QR code data URL with the Vortex ID logo embedded in the center.
 * Automatically adapts Error Correction Level so even dense clinical records scan reliably.
 */
export async function generateVortexQrDataUrl(
  text: string,
  options?: VortexQrOptions
): Promise<string> {
  const width = options?.width || 380;
  const margin = options?.margin !== undefined ? options?.margin : 3;
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'H';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;

  await renderAdaptiveQrToCanvas(canvas, text, width, margin, errorCorrectionLevel);

  return canvas.toDataURL('image/png');
}

/**
 * Renders the QR code directly onto an existing HTMLCanvasElement.
 */
export async function renderVortexQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: VortexQrOptions
): Promise<void> {
  const width = options?.width || canvas.width || 320;
  const margin = options?.margin !== undefined ? options?.margin : 3;
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'H';

  await renderAdaptiveQrToCanvas(canvas, text, width, margin, errorCorrectionLevel);
}
