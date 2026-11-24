/**
 * Verified face photo generator for Vortex ID Punta Alta.
 * Produces crisp, lightweight (~900B-1.2KB) square face photos
 * that render cleanly on mobile screens and fit inside QR codes.
 */

export function generateVerifiedFacePhoto(options?: {
  name?: string;
  hairColor?: string;
  shirtColor?: string;
}): string {
  if (typeof document === 'undefined') return '';

  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw on normalized 96x96 coordinate system scaled smoothly to 320x320 HD
  ctx.scale(size / 96, size / 96);

  // 1. Studio backdrop gradient (Emergency Blue / Dark Slate)
  const bg = ctx.createLinearGradient(0, 0, 96, 96);
  bg.addColorStop(0, '#0d2252');
  bg.addColorStop(0.5, '#071536');
  bg.addColorStop(1, '#050b1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 96, 96);

  // 2. Security subtle grid pattern
  ctx.strokeStyle = 'rgba(55, 200, 255, 0.12)';
  ctx.lineWidth = 0.8;
  for (let i = 12; i < 96; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(96, i);
    ctx.stroke();
  }

  // 3. Shoulders and Chest (Medical / Civilian Dark Navy Polo)
  const shirtColor = options?.shirtColor || '#1e5bff';
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.moveTo(12, 96);
  ctx.quadraticCurveTo(24, 70, 48, 68);
  ctx.quadraticCurveTo(72, 70, 84, 96);
  ctx.closePath();
  ctx.fill();

  // Polo collar details
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 69);
  ctx.lineTo(48, 80);
  ctx.lineTo(56, 69);
  ctx.stroke();

  // 4. Neck
  ctx.fillStyle = '#f1c29b';
  ctx.beginPath();
  ctx.rect(41, 52, 14, 18);
  ctx.fill();

  // 5. Head / Face oval
  ctx.fillStyle = '#f8d1ab';
  ctx.beginPath();
  ctx.ellipse(48, 42, 19, 23, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.ellipse(28, 43, 3.5, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(68, 43, 3.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 6. Hair
  const hair = options?.hairColor || '#382215';
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(48, 27, 21, 14, 0, Math.PI, 0, true);
  ctx.fill();

  // Sideburns
  ctx.beginPath();
  ctx.rect(27, 30, 4, 12);
  ctx.rect(65, 30, 4, 12);
  ctx.fill();

  // 7. Eyes
  ctx.fillStyle = '#1c2833';
  ctx.beginPath();
  ctx.arc(41, 41, 2.5, 0, Math.PI * 2);
  ctx.arc(55, 41, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = hair;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(37, 36);
  ctx.quadraticCurveTo(41, 34, 45, 36);
  ctx.moveTo(51, 36);
  ctx.quadraticCurveTo(55, 34, 59, 36);
  ctx.stroke();

  // 8. Nose
  ctx.strokeStyle = '#d99f73';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(48, 41);
  ctx.lineTo(46, 48);
  ctx.lineTo(50, 48);
  ctx.stroke();

  // 9. Mouth
  ctx.strokeStyle = '#a85038';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(48, 51, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // 10. Outer Verification Border
  ctx.strokeStyle = '#37c8ff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.5, 1.5, 93, 93);

  try {
    const webp = canvas.toDataURL('image/webp', 0.9);
    if (webp && webp.startsWith('data:image/webp')) {
      return webp;
    }
  } catch {
    // ignore
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}
