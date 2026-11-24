/**
 * Image compressor utility for Vortex ID medical profile.
 * - compressHdProfilePhoto: Produces crisp, high-resolution 400x400 square portraits
 *   (<= ~48 KB) for the Ficha de Asistencia, HD Credential Badges, Wallpapers, and Firestore.
 * - compressProfilePhoto: Produces crisp 96x96–128x128 face portraits (<= 1,520 B)
 *   used ONLY inside offline QR URL hashes (#d=...).
 */

function processToSquareDataUrl(
  input: File | Blob | string,
  attempts: Array<[number, number]>,
  maxBytes: number,
  preferPngOrHighQuality: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof input === 'string') {
      if (input.startsWith('data:image/')) {
        if (input.length <= maxBytes) {
          resolve(input);
          return;
        }
      } else {
        reject(new Error('Formato de imagen no válido'));
        return;
      }
    }

    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
        objectUrl = null;
      }
    };

    const processImage = (imgSrc: string) => {
      const img = new Image();
      if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width || 400;
          const height = img.naturalHeight || img.height || 400;

          // Crop square from upper-center so portrait faces and hair are framed cleanly
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = Math.max(0, (height - minDim) * 0.28);

          const renderToCanvas = (size: number, q: number): string => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.fillStyle = '#07122c';
            ctx.fillRect(0, 0, size, size);

            ctx.drawImage(
              img,
              startX,
              startY,
              minDim,
              minDim,
              0,
              0,
              size,
              size
            );

            const jpeg = canvas.toDataURL('image/jpeg', q);
            try {
              const webpQ = preferPngOrHighQuality ? Math.min(0.94, q) : Math.min(0.84, q + 0.06);
              const webp = canvas.toDataURL('image/webp', webpQ);
              if (webp && webp.startsWith('data:image/webp') && webp.length < jpeg.length) {
                return webp;
              }
            } catch {
              // Safari/fallback ignores image/webp
            }
            return jpeg;
          };

          let result = '';
          for (const [sz, q] of attempts) {
            const candidate = renderToCanvas(sz, q);
            if (candidate) {
              if (!result || candidate.length < result.length) {
                result = candidate;
              }
              if (candidate.length <= maxBytes) {
                result = candidate;
                break;
              }
            }
          }

          cleanup();
          if (result && result.startsWith('data:image/')) {
            resolve(result);
          } else {
            reject(new Error('No se pudo procesar la fotografía'));
          }
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error('Error procesando la imagen'));
        }
      };

      img.onerror = () => {
        cleanup();
        reject(new Error('No se pudo leer ese archivo de imagen'));
      };

      img.src = imgSrc;
    };

    if (typeof input === 'string') {
      processImage(input);
    } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        objectUrl = URL.createObjectURL(input);
        processImage(objectUrl);
      } catch {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (!result) {
            reject(new Error('Archivo de imagen vacío'));
            return;
          }
          processImage(result);
        };
        reader.onerror = () => reject(new Error('No se pudo abrir la fotografía'));
        reader.readAsDataURL(input);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          reject(new Error('Archivo de imagen vacío'));
          return;
        }
        processImage(result);
      };
      reader.onerror = () => reject(new Error('No se pudo abrir la fotografía'));
      reader.readAsDataURL(input);
    }
  });
}

export function compressHdProfilePhoto(
  input: File | Blob | string,
  targetSize = 400,
  quality = 0.9,
  maxBytes = 48000
): Promise<string> {
  const attempts: Array<[number, number]> = [
    [targetSize, quality],
    [400, 0.85],
    [360, 0.84],
    [320, 0.82],
    [280, 0.78],
    [240, 0.74]
  ];
  return processToSquareDataUrl(input, attempts, maxBytes, true);
}

export function compressProfilePhoto(
  input: File | Blob | string,
  targetSize = 128,
  quality = 0.72,
  maxBytes = 1520
): Promise<string> {
  const attempts: Array<[number, number]> = [
    [targetSize, quality],
    [120, 0.66],
    [112, 0.60],
    [104, 0.54],
    [96, 0.48],
    [88, 0.42],
    [80, 0.36],
    [72, 0.30]
  ];
  return processToSquareDataUrl(input, attempts, maxBytes, false);
}
