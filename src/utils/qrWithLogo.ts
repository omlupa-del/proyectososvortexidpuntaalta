import QRCode from 'qrcode';

/**
 * Draws the official Vortex ID emblem inside a canvas context.
 * Features an electric cyan shield, heartbeat pulse line, and crisp glowing typography.
 */
function drawVortexLogo(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) {
  ctx.save();

  // 1. Clear circular area with a white outer border to isolate from QR modules cleanly
  const radius = size / 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 2. Dark Navy inner circular badge
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#050b1f';
  ctx.fill();

  // 3. Neon Cyan Glowing Ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.strokeStyle = '#00f0ff';
  ctx.stroke();

  // 4. Stylized "V" Shield + Heartbeat pulse in cyan and gold
  const iconScale = size * 0.52;
  const topY = centerY - iconScale * 0.38;
  const bottomY = centerY + iconScale * 0.42;
  const leftX = centerX - iconScale * 0.42;
  const rightX = centerX + iconScale * 0.42;

  // Draw Shield Outline
  ctx.beginPath();
  ctx.moveTo(centerX, topY - iconScale * 0.08);
  ctx.lineTo(rightX, topY + iconScale * 0.1);
  ctx.lineTo(rightX - iconScale * 0.08, centerY + iconScale * 0.15);
  ctx.lineTo(centerX, bottomY);
  ctx.lineTo(leftX + iconScale * 0.08, centerY + iconScale * 0.15);
  ctx.lineTo(leftX, topY + iconScale * 0.1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.035);
  ctx.strokeStyle = '#37c8ff';
  ctx.stroke();

  // Draw Bold Stylized "V"
  ctx.beginPath();
  ctx.moveTo(leftX + iconScale * 0.14, topY + iconScale * 0.05);
  ctx.lineTo(centerX, bottomY - iconScale * 0.16);
  ctx.lineTo(rightX - iconScale * 0.14, topY + iconScale * 0.05);
  ctx.lineWidth = Math.max(2.5, size * 0.07);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Heartbeat ECG Pulse across center in gold/cyan
  ctx.beginPath();
  const pulseY = centerY + iconScale * 0.04;
  ctx.moveTo(centerX - iconScale * 0.32, pulseY);
  ctx.lineTo(centerX - iconScale * 0.14, pulseY);
  ctx.lineTo(centerX - iconScale * 0.07, pulseY - iconScale * 0.18);
  ctx.lineTo(centerX + iconScale * 0.02, pulseY + iconScale * 0.22);
  ctx.lineTo(centerX + iconScale * 0.09, pulseY - iconScale * 0.12);
  ctx.lineTo(centerX + iconScale * 0.16, pulseY);
  ctx.lineTo(centerX + iconScale * 0.32, pulseY);
  ctx.lineWidth = Math.max(1.8, size * 0.045);
  ctx.strokeStyle = '#ffd700';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Micro-badge "VORTEX" at bottom of badge
  if (size >= 60) {
    ctx.font = `900 ${Math.round(size * 0.13)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('VORTEX', centerX, centerY + radius * 0.58);
  }

  ctx.restore();
}

export interface QrOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generates a Data URL of a QR code with the official Vortex ID logo embedded in the center.
 * Uses Error Correction Level 'H' (High - 30% redundancy) so scanning works flawlessly.
 */
export async function generateQrWithVortexLogo(text: string, options: QrOptions = {}): Promise<string> {
  const width = options.width || 400;
  const margin = options.margin !== undefined ? options.margin : 2;
  const darkColor = options.darkColor || '#050b1f';
  const lightColor = options.lightColor || '#ffffff';

  // 1. Create offscreen canvas for QR
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;

  await QRCode.toCanvas(canvas, text, {
    width,
    margin,
    errorCorrectionLevel: 'H',
    color: {
      dark: darkColor,
      light: lightColor
    }
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas.toDataURL('image/png');
  }

  // 2. Draw Vortex ID Logo in the exact center (around 24% of width to stay safely within 30% tolerance)
  const logoSize = Math.round(width * 0.24);
  const centerX = width / 2;
  const centerY = width / 2;

  drawVortexLogo(ctx, centerX, centerY, logoSize);

  return canvas.toDataURL('image/png');
}

/**
 * Generates a complete high-resolution printable card (1000 x 1200 px) ready for keychains,
 * stickers, acrylic engraving, or sharing.
 */
export async function generatePrintableBrandedCard(
  text: string,
  title: string = 'VORTEX ID · PUNTA ALTA',
  subtitle: string = 'Ficha Médica de Auxilio & Farmacias 24hs',
  footerNote: string = 'Escaneá con la cámara de tu celular'
): Promise<string> {
  const cardWidth = 1000;
  const cardHeight = 1200;
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = cardWidth;
  cardCanvas.height = cardHeight;
  const ctx = cardCanvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient: Deep high-tech navy
  const grad = ctx.createLinearGradient(0, 0, 0, cardHeight);
  grad.addColorStop(0, '#0a1f55');
  grad.addColorStop(0.5, '#071536');
  grad.addColorStop(1, '#050b1f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Outer Border glowing in cyan
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#00f0ff';
  ctx.strokeRect(16, 16, cardWidth - 32, cardHeight - 32);

  // Inner thin border
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.strokeRect(28, 28, cardWidth - 56, cardHeight - 56);

  // Top Header Badge
  ctx.fillStyle = '#e11d48'; // Red SOS alert accent
  ctx.beginPath();
  ctx.roundRect(cardWidth / 2 - 240, 50, 480, 50, 25);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚨 SISTEMA DE ASISTENCIA & SALUD 24HS', cardWidth / 2, 75);

  // Main Title
  ctx.font = '900 48px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, cardWidth / 2, 160);

  // Subtitle
  ctx.font = '600 24px sans-serif';
  ctx.fillStyle = '#37c8ff';
  ctx.fillText(subtitle, cardWidth / 2, 210);

  // Generate the central QR with embedded Vortex Logo
  const qrSize = 650;
  const qrDataUrl = await generateQrWithVortexLogo(text, { width: qrSize, margin: 2 });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  // White Card behind the QR for maximum contrast and scanning
  const qrX = (cardWidth - qrSize) / 2;
  const qrY = 260;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 30);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#37c8ff';
  ctx.stroke();

  // Draw the QR image
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Footer Instructions
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffd700'; // Gold
  ctx.fillText(`📲 ${footerNote}`, cardWidth / 2, 990);

  ctx.font = '500 20px sans-serif';
  ctx.fillStyle = '#9db6dd';
  ctx.fillText('Acceso instantáneo a Ficha Médica SOS · Farmacias de Turno · Coronel Rosales', cardWidth / 2, 1035);

  // Official Seal
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#5eead4';
  ctx.fillText('VORTEX ID PUNTA ALTA · VINCULACIÓN OFICIAL CERTIFICADA', cardWidth / 2, 1110);

  return cardCanvas.toDataURL('image/png');
}
