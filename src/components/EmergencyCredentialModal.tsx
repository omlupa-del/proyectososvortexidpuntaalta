import React, { useRef, useState, useEffect } from 'react';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Printer,
  Smartphone,
  Shield,
  Heart,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Share2,
  X,
  KeyRound,
  Eye,
  CheckCircle2,
  User,
  ShieldCheck,
  Tag,
  Link2,
  BadgeCheck,
  Award
} from 'lucide-react';
import {
  MedicalRecord,
  generateKeychainUrl,
  hasMedicalData,
  linkRecordToKeychain,
  unlinkRecordFromKeychain,
  generateCorrelativeUrl,
  calculatePregnancyProgress,
  decodeRecordFromHash,
  optimizeRecordPhoto
} from '../utils/medicalData';
import { getEffectiveOrigin } from '../utils/systemConfig';
import { playChirp } from '../utils/callHandler';
import { generateVortexQrDataUrl, renderVortexQrToCanvas } from '../utils/vortexQrGenerator';
import { getMedicalValidationStatus } from './BloodAndDonorFields';

interface EmergencyCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
  onOpenSosModal: () => void;
  onOpenEditForm: () => void;
  onRecordUpdated?: (record: MedicalRecord) => void;
  onKeychainUnlinked?: (oldId: string) => void;
}

export const EmergencyCredentialModal: React.FC<EmergencyCredentialModalProps> = ({
  isOpen,
  onClose,
  record,
  onOpenSosModal,
  onOpenEditForm,
  onRecordUpdated,
  onKeychainUnlinked
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [wallpaperDownloading, setWallpaperDownloading] = useState<boolean>(false);
  const [wallpaperNotice, setWallpaperNotice] = useState<string>('');
  const [generatedWallpaperUrl, setGeneratedWallpaperUrl] = useState<string>('');
  const [generatedWallpaperFilename, setGeneratedWallpaperFilename] = useState<string>('VortexID_PantallaBloqueo.png');
  const [keychainInput, setKeychainInput] = useState<string>('');
  const [linkingSuccess, setLinkingSuccess] = useState<string>('');
  const [isLinkingOpen, setIsLinkingOpen] = useState<boolean>(!record?.keychainId);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const [derivedQrPhoto, setDerivedQrPhoto] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !record?.foto) {
      setDerivedQrPhoto('');
      return;
    }
    if (record.fotoQr && record.fotoQr.length > 950 && record.fotoQr.length <= 1650) {
      setDerivedQrPhoto(record.fotoQr);
      return;
    }
    if (record.foto.length <= 1650) {
      setDerivedQrPhoto(record.foto);
      return;
    }
    let cancelled = false;
    optimizeRecordPhoto(record, true).then((updated) => {
      if (!cancelled && updated.fotoQr) {
        setDerivedQrPhoto(updated.fotoQr);
        if (onRecordUpdated && updated.fotoQr !== record.fotoQr) {
          onRecordUpdated(updated);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, record, onRecordUpdated]);

  const effectiveProdOrigin = getEffectiveOrigin().replace(/\/+$/, '');

  const hasData = hasMedicalData(record);
  const qrUrl = React.useMemo(() => {
    if (record && hasData) {
      const shouldPreferDerived =
        Boolean(derivedQrPhoto) &&
        (!record.fotoQr ||
          record.fotoQr.length <= 950 ||
          record.fotoQr.length > 1650 ||
          derivedQrPhoto !== record.fotoQr);
      const effectiveRecord = shouldPreferDerived ? { ...record, fotoQr: derivedQrPhoto } : record;
      return generateKeychainUrl(effectiveRecord);
    }
    if (record?.keychainId) {
      return generateCorrelativeUrl(record.keychainId);
    }
    return `${effectiveProdOrigin}/?welcome=1`;
  }, [record, hasData, derivedQrPhoto, effectiveProdOrigin]);

  const qrIncludesPhoto = React.useMemo(() => {
    if (!record?.foto) return false;
    const hashPart = qrUrl.split('#')[1] || '';
    const matchD = hashPart.match(/(?:^|&)d=([A-Za-z0-9_-]+)/);
    if (!matchD) return false;
    const decoded = decodeRecordFromHash(matchD[1]);
    return Boolean(decoded?.foto);
  }, [qrUrl, record?.foto]);

  const handleLinkKeychain = () => {
    if (!keychainInput.trim() || !record) return;
    const cleanId = keychainInput.trim().toUpperCase().replace(/^#/, '');
    const updated = linkRecordToKeychain(cleanId, record);
    if (onRecordUpdated) {
      onRecordUpdated(updated);
    }
    setIsLinkingOpen(false);
    setKeychainInput('');
    playChirp('success');
    setLinkingSuccess(`✔ ¡Llavero #${cleanId} vinculado con éxito a tu ficha médica!`);
    setTimeout(() => setLinkingSuccess(''), 4500);
  };

  const handleUnlinkKeychain = () => {
    if (!record) return;
    const oldId = record.keychainId;
    const updated = unlinkRecordFromKeychain(record);
    if (onRecordUpdated) {
      onRecordUpdated(updated);
    }
    if (oldId && onKeychainUnlinked) {
      onKeychainUnlinked(oldId);
    }
    playChirp('click');
    setLinkingSuccess('Llavero desvinculado.');
    setTimeout(() => setLinkingSuccess(''), 3000);
  };

  // Render QR Code (both DataURL image and Canvas) with embedded Vortex logo
  useEffect(() => {
    if (!isOpen || !qrUrl) return;

    setIsLinkingOpen(!record?.keychainId);

    generateVortexQrDataUrl(qrUrl, {
      width: 440,
      margin: 3,
      errorCorrectionLevel: 'H'
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating Vortex QR:', err);
      });

    if (canvasRef.current) {
      renderVortexQrToCanvas(canvasRef.current, qrUrl, {
        width: 340,
        margin: 3,
        errorCorrectionLevel: 'H'
      }).catch((err) => {
        console.error('Error drawing Vortex QR on canvas:', err);
      });
    }
  }, [isOpen, qrUrl, record?.keychainId]);

  useEffect(() => {
    // Clear stale generated wallpaper preview whenever modal closes or record changes
    setGeneratedWallpaperUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(prev);
        } catch {}
      }
      return '';
    });
    setWallpaperNotice('');
  }, [qrUrl, isOpen]);

  if (!isOpen) return null;

  const triggerCanvasDownload = (canvas: HTMLCanvasElement, fileName: string): Promise<string> => {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            resolve(blobUrl);
            return;
          }
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch {
            // Canvas tainted fallback
          }
          resolve(dataUrl);
        }, 'image/png');
      } catch {
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {}
        resolve(dataUrl);
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      playChirp('success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = qrUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Download High-Resolution Keychain / Sticker Badge (800x920 PNG)
  const handleDownloadKeychainBadge = () => {
    if (!hasData && !record?.keychainId) {
      setWallpaperNotice('⚠️ Primero completá y guardá tu ficha médica con clave PIN para que el QR incluya tu nombre y datos clínicos.');
      playChirp('click');
      return;
    }
    setDownloading(true);
    playChirp('click');

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setDownloading(false);
      return;
    }

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 920);
    bgGrad.addColorStop(0, '#07122c');
    bgGrad.addColorStop(0.5, '#0a1d48');
    bgGrad.addColorStop(1, '#050b1f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 920);

    // Outer Border
    ctx.strokeStyle = '#1e5bff';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 780, 900);

    // Inner Glow Line
    ctx.strokeStyle = '#37c8ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 760, 880);

    // Top Header Banner
    ctx.fillStyle = '#ef2b3a';
    ctx.fillRect(20, 20, 760, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 VORTEX ID · ASISTENCIA SOS', 400, 78);

    // Subtitle
    ctx.fillStyle = '#37c8ff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('CREDENCIAL MÉDICA PARA LLAVERO · PUNTA ALTA', 400, 155);

    // Name & Blood Type Box
    ctx.fillStyle = '#0f275e';
    ctx.strokeStyle = '#2b6fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 180, 720, 110, 18);
    ctx.fill();
    ctx.stroke();

    const hasPhoto = Boolean(record?.foto);
    const textStartX = hasPhoto ? 165 : 65;

    ctx.fillStyle = '#eaf3ff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    const nombre = record?.nombre ? record.nombre.toUpperCase() : 'TITULAR REGISTRADO';
    ctx.fillText(nombre.slice(0, 24), textStartX, 228);

    ctx.fillStyle = '#9db6dd';
    ctx.font = '22px sans-serif';
    const dniText = record?.keychainId
      ? `DNI: ${record.dni || 'S/D'} · LLAVERO #${record.keychainId}`
      : (record?.dni ? `DNI: ${record.dni}` : 'PUNTA ALTA - BUENOS AIRES');
    ctx.fillText(dniText, textStartX, 265);

    const validation = getMedicalValidationStatus(record);

    // Blood Badge
    if (record?.sangre) {
      ctx.fillStyle = '#ef2b3a';
      ctx.beginPath();
      ctx.roundRect(620, 195, 120, 80, 12);
      ctx.fill();

      if (validation.isBloodValidated) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GRUPO', 680, 222);

      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(record.sangre, 680, 260);

      if (validation.isBloodValidated) {
        ctx.fillStyle = '#059669';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(622, 268, 116, 22, 11);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('✓ VALIDADO', 680, 283);
      }
    }

    if (validation.donorState === 'si') {
      ctx.fillStyle = validation.isDonorValidated ? '#064e3b' : '#063d2d';
      ctx.strokeStyle = validation.isDonorValidated ? '#fbbf24' : '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(175, 294, 450, 24, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = validation.isDonorValidated ? '#fde68a' : '#a7f3d0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        validation.isDonorValidated
          ? '★ DONANTE DE ÓRGANOS VALIDADO (INCUCAI ✓)'
          : '💚 DONANTE DE ÓRGANOS DECLARADO (INCUCAI)',
        400,
        310
      );
    }

    // QR Container Box (White card)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(175, 322, 450, 444, 24);
    ctx.fill();

    const proceedWithDownload = async () => {
      try {
        const url = await generateVortexQrDataUrl(qrUrl, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: 'H'
        });
        const qrImg = new Image();
        qrImg.onload = async () => {
          ctx.drawImage(qrImg, 190, 334, 420, 420);

          // Footer instructions
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ESCANEAR EN CASO DE EMERGENCIA O ACCIDENTE', 400, 805);

          ctx.fillStyle = '#37c8ff';
          ctx.font = '19px sans-serif';
          ctx.fillText('Abre Ficha Médica de auxilio · Llamada al 107 y 911 con GPS', 400, 838);

          ctx.fillStyle = '#9db6dd';
          ctx.font = '15px sans-serif';
          ctx.fillText('IDENTIDAD VERIFICADA · VORTEX ID PUNTA ALTA', 400, 870);

          const badgeFileName = `VortexID_Llavero_${(record?.nombre || 'QR').replace(/\s+/g, '_')}.png`;
          await triggerCanvasDownload(canvas, badgeFileName);
          playChirp('success');
          setDownloading(false);
        };
        qrImg.onerror = () => setDownloading(false);
        qrImg.src = url;
      } catch {
        setDownloading(false);
      }
    };

    // If photo exists, draw it into the badge first
    if (record?.foto) {
      const pImg = new Image();
      if (!record.foto.startsWith('data:')) {
        pImg.crossOrigin = 'anonymous';
      }
      pImg.onload = () => {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.roundRect(55, 195, 80, 80, 14);
        ctx.clip();
        ctx.drawImage(pImg, 55, 195, 80, 80);
        ctx.restore();

        ctx.strokeStyle = '#37c8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(55, 195, 80, 80, 14);
        ctx.stroke();

        proceedWithDownload();
      };
      pImg.onerror = () => proceedWithDownload();
      pImg.src = record.foto;
    } else {
      proceedWithDownload();
    }
  };

  // Download or Share Smartphone Lock Screen Wallpaper (1080x1920 PNG)
  // Top region (0..320) stays dark and uncluttered so phone lock screen clock never covers SOS data.
  const handleDownloadWallpaper = async (preferShare = false) => {
    if (!hasData && !record?.keychainId) {
      setWallpaperNotice('⚠️ Todavía no guardaste tu ficha médica. Completá el formulario (o cargá los datos de prueba) y tocá "GUARDAR DATOS Y BLOQUEAR FORMULARIO" antes de descargar el fondo.');
      playChirp('click');
      return;
    }
    setWallpaperDownloading(true);
    setWallpaperNotice('');
    playChirp('click');

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setWallpaperDownloading(false);
      return;
    }

    // Deep tech dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#040816');
    bgGrad.addColorStop(0.3, '#07122c');
    bgGrad.addColorStop(0.7, '#0b1d46');
    bgGrad.addColorStop(1, '#02050e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Subtle zone note at very top behind clock
    ctx.fillStyle = 'rgba(157, 182, 221, 0.35)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VORTEX ID · PANTALLA DE EMERGENCIA SIN DESBLOQUEO', 540, 80);

    // Glowing circle in center
    const radial = ctx.createRadialGradient(540, 1060, 50, 540, 1060, 550);
    radial.addColorStop(0, 'rgba(30, 91, 255, 0.25)');
    radial.addColorStop(0.6, 'rgba(55, 200, 255, 0.08)');
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 440, 1080, 1180);

    // Top SOS Pill placed below lock-screen clock area (y: 350)
    ctx.fillStyle = '#ef2b3a';
    ctx.beginPath();
    ctx.roundRect(190, 350, 700, 74, 37);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 FICHA MÉDICA SOS · SIN CLAVE', 540, 399);

    const pregnancy = calculatePregnancyProgress(record);

    const proceedWithWallpaper = async () => {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        (record?.nombre ? record.nombre.toUpperCase() : 'TITULAR REGISTRADO').slice(0, 28),
        540,
        595
      );

      ctx.fillStyle = '#37c8ff';
      ctx.font = 'bold 26px sans-serif';
      const subText = record?.keychainId
        ? `PUNTA ALTA · VORTEX ID #${record.keychainId}`
        : 'PUNTA ALTA · VORTEX ID';
      ctx.fillText(subText, 540, 636);

      const validation = getMedicalValidationStatus(record);
      const drawValidatedBloodBadge = (x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = '#ef2b3a';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 20);
        ctx.fill();
        if (validation.isBloodValidated) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(w >= 245 ? 'GRUPO Y FACTOR' : 'GRUPO', x + w / 2, y + 30);
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(record?.sangre || '', x + w / 2, y + 70);

        if (validation.isBloodValidated) {
          ctx.fillStyle = '#059669';
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(x + 22, y + h - 14, w - 44, 26, 13);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fef3c7';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText('✓ VALIDADO', x + w / 2, y + h + 4);
        }
      };

      // Blood type + optional pregnancy badge row
      let qrTopY = 778;
      if (record?.sangre && pregnancy) {
        // Blood box left
        drawValidatedBloodBadge(140, 660, 230, 88);

        // Pregnancy alert pill right
        ctx.fillStyle = '#9d174d';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(390, 660, 550, 88, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMBARAZO EN CURSO', 665, 690);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(pregnancy.detailedLabel.slice(0, 30), 665, 730);
      } else if (record?.sangre) {
        drawValidatedBloodBadge(415, 660, 250, 88);
      } else if (pregnancy) {
        ctx.fillStyle = '#9d174d';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(190, 660, 700, 88, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ALERTA OBSTÉTRICA · EMBARAZO', 540, 690);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(pregnancy.detailedLabel.slice(0, 34), 540, 730);
      } else {
        qrTopY = 700;
      }

      // QR Box with Vortex logo in center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(240, qrTopY, 600, 600, 36);
      ctx.fill();

      try {
        const url = await generateVortexQrDataUrl(qrUrl, {
          width: 560,
          margin: 2,
          errorCorrectionLevel: 'H'
        });

        const qrImg = new Image();
        qrImg.onload = async () => {
          ctx.drawImage(qrImg, 260, qrTopY + 20, 560, 560);

          const textBaseY = qrTopY + 645;

          // Instructions below QR
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText('ESCANEAR SIN DESBLOQUEAR EL CELULAR', 540, textBaseY);

          ctx.fillStyle = '#37c8ff';
          ctx.font = 'bold 24px sans-serif';
          ctx.fillText('APUNTÁ CON LA CÁMARA DE OTRO TELÉFONO', 540, textBaseY + 38);

          // Clinical & Emergency Summary Lines directly visible on lock screen
          const summaryLines: Array<{ text: string; color: string }> = [];
          if (validation.isDonorValidated) {
            summaryLines.push({
              text: '★ DONANTE DE ÓRGANOS VALIDADO (INCUCAI ✓)',
              color: '#fde68a'
            });
          } else if (validation.donorState === 'si') {
            summaryLines.push({
              text: '💚 DONANTE DE ÓRGANOS DECLARADO (INCUCAI)',
              color: '#6ee7b7'
            });
          }
          if (record?.enf) {
            summaryLines.push({
              text: `⚠️ Alergias/Enf: ${record.enf.slice(0, 48)}`,
              color: '#fcd34d'
            });
          }
          if (record?.med) {
            summaryLines.push({
              text: `💊 Medicación: ${record.med.slice(0, 48)}`,
              color: '#67e8f9'
            });
          }
          const clinicalNote =
            record?.cirugiasPrevias ||
            record?.internacionesPrevias ||
            record?.historialClinico?.[0]?.title;
          if (clinicalNote && summaryLines.length < 3) {
            summaryLines.push({
              text: `📋 Clínico: ${clinicalNote.slice(0, 48)}`,
              color: '#e2e8f0'
            });
          }
          const contactTel = record?.cfam || record?.tel || record?.cami;
          if (contactTel) {
            summaryLines.push({
              text: `📞 Avisar urgente a: ${contactTel}`,
              color: '#86efac'
            });
          }

          if (summaryLines.length === 0) {
            ctx.fillStyle = '#9db6dd';
            ctx.font = '22px sans-serif';
            ctx.fillText('Abre ficha clínica completa, alergias, contactos y GPS', 540, textBaseY + 80);
          } else {
            summaryLines.slice(0, 4).forEach((line, idx) => {
              ctx.fillStyle = line.color;
              ctx.font = 'bold 21px sans-serif';
              ctx.fillText(line.text, 540, textBaseY + 78 + idx * 30);
            });
          }

          // Emergency numbers at bottom
          const footerY = Math.min(1760, Math.max(1660, textBaseY + 185));
          ctx.fillStyle = '#112959';
          ctx.beginPath();
          ctx.roundRect(140, footerY, 800, 110, 24);
          ctx.fill();

          ctx.strokeStyle = '#1e5bff';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText('🚑 SAME Salud: 107   |   🚨 Policía: 911', 540, footerY + 67);

          const fileName = `VortexID_PantallaBloqueo_${(record?.nombre || 'QR').replace(/\s+/g, '_')}.png`;
          setGeneratedWallpaperFilename(fileName);

          // Always generate an image preview URL (Blob URL or DataURL fallback) so user sees it right away
          const previewDataUrl = canvas.toDataURL('image/png');

          // Attempt Web Share with File when requested on mobile devices
          if (preferShare && typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
              const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((b) => resolve(b), 'image/png')
              );
              if (blob) {
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  setGeneratedWallpaperUrl(previewDataUrl);
                  await navigator.share({
                    files: [file],
                    title: 'Fondo de Pantalla de Bloqueo · Vortex ID',
                    text: 'Guardá esta imagen o elegí "Usar como fondo de pantalla de bloqueo" para que puedan escanear tu QR sin pedir clave.'
                  });
                  playChirp('success');
                  setWallpaperNotice('✔ Imagen lista. En tu Galería elegí "Usar como fondo de pantalla de bloqueo".');
                  setWallpaperDownloading(false);
                  return;
                }
              }
            } catch {
              // User cancelled share or browser unsupported; fallback to download + preview below
            }
          }

          const downloadedUrl = await triggerCanvasDownload(canvas, fileName);
          setGeneratedWallpaperUrl(previewDataUrl || downloadedUrl);
          playChirp('success');
          setWallpaperNotice(
            '✔ Imagen generada y descargada. Si no la ves en Descargas, mantené presionada la vista previa de abajo → Guardar imagen, y luego ponela como Fondo de Pantalla de Bloqueo.'
          );
          setWallpaperDownloading(false);
        };
        qrImg.onerror = () => {
          setWallpaperNotice('No se pudo renderizar el QR en la imagen. Intentá nuevamente.');
          setWallpaperDownloading(false);
        };
        qrImg.src = url;
      } catch {
        setWallpaperNotice('Error al generar la imagen de pantalla de bloqueo.');
        setWallpaperDownloading(false);
      }
    };

    if (record?.foto) {
      const pImg = new Image();
      if (!record.foto.startsWith('data:')) {
        pImg.crossOrigin = 'anonymous';
      }
      pImg.onload = () => {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.roundRect(485, 442, 110, 110, 22);
        ctx.clip();
        ctx.drawImage(pImg, 485, 442, 110, 110);
        ctx.restore();

        ctx.strokeStyle = '#37c8ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(485, 442, 110, 110, 22);
        ctx.stroke();

        proceedWithWallpaper();
      };
      pImg.onerror = () => proceedWithWallpaper();
      pImg.src = record.foto;
    } else {
      proceedWithWallpaper();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-[#0a1838] via-[#07122c] to-[#040816] border-2 border-[#1e5bff] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-blue-950/80 my-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e5bff]/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#1e5bff]/20 text-[#37c8ff] border border-[#1e5bff]/60">
              <QrCode className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-heading text-white tracking-wider">
                MI QR Y CREDENCIAL
              </h2>
              <p className="text-xs text-[#37c8ff] font-semibold uppercase tracking-wider">
                Vortex ID · Llavero de Emergencia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition"
            aria-label="Cerrar credencial"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* If no data yet, warn clearly so user saves their ficha before downloading wallpaper/QR */}
          {!hasData ? (
            <div className="p-3.5 rounded-2xl bg-amber-950/75 border-2 border-amber-400/80 shadow-lg space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center shrink-0 shadow">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black font-heading text-amber-200">
                      ⚠️ FICHA MÉDICA TODAVÍA SIN GUARDAR
                    </h3>
                    <p className="text-[11px] text-amber-100/90 leading-snug">
                      Si cargaste datos en el formulario, recordá crear tu clave PIN y tocar <strong>"GUARDAR DATOS Y BLOQUEAR FORMULARIO"</strong> para que este QR y el Fondo de Pantalla muestren tu nombre y datos clínicos al escanear.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditForm();
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs tracking-wide shadow-md active:scale-95 transition shrink-0"
                >
                  ➕ Ir a Ficha
                </button>
              </div>
            </div>
          ) : (
            /* Titular Preview Card with Photo */
            <div className="p-3.5 rounded-2xl bg-[#0b1d46] border border-[#1e5bff]/50 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#37c8ff] bg-[#07122c] flex items-center justify-center shrink-0"
                    style={{ width: '80px', height: '80px', minWidth: '80px', minHeight: '80px' }}
                  >
                    {record?.foto ? (
                      <img
                        src={record.foto}
                        alt="Foto del titular"
                        className="w-full h-full object-cover block"
                        loading="eager"
                      />
                    ) : (
                      <User className="w-9 h-9 text-[#37c8ff]/60" />
                    )}
                  </div>
                  {record?.foto && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-[#9db6dd] uppercase font-bold tracking-wider block">
                    Titular del Llavero
                  </span>
                  <div className="text-lg sm:text-xl font-black font-heading text-white leading-tight">
                    {record?.nombre || 'Titular Registrado'}
                  </div>
                  <div className="text-xs text-[#37c8ff] flex items-center gap-1.5 flex-wrap">
                    <span>{record?.dni ? `DNI: ${record.dni}` : 'Punta Alta · Buenos Aires'}</span>
                    {record?.keychainId && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[10px]">
                        🏷️ #{record.keychainId}
                      </span>
                    )}
                    {(() => {
                      const v = getMedicalValidationStatus(record);
                      if (v.isDonorValidated) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/75 text-amber-200 text-[10px] font-black uppercase">
                            <Award className="w-3 h-3 text-amber-300" />
                            <span>Donante Validado</span>
                          </span>
                        );
                      }
                      if (v.donorState === 'si') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-[10px] font-bold uppercase">
                            <span>💚 Donante</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              {record?.sangre ? (() => {
                const v = getMedicalValidationStatus(record);
                return (
                  <div className="relative shrink-0">
                    <div
                      className={`text-center px-3 py-1.5 rounded-xl bg-gradient-to-b from-red-600 to-rose-700 text-white border shadow-md ${
                        v.isBloodValidated
                          ? 'border-amber-300 ring-2 ring-emerald-400/75'
                          : 'border-red-300'
                      }`}
                    >
                      <span className="text-[9px] font-bold block opacity-90">GRUPO</span>
                      <span className="text-xl font-black font-heading">{record.sangre}</span>
                    </div>
                    {v.isBloodValidated && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-emerald-600 border border-amber-300 text-white text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-0.5 shadow whitespace-nowrap">
                        <BadgeCheck className="w-2.5 h-2.5 text-amber-200" />
                        <span>VALIDADO</span>
                      </span>
                    )}
                  </div>
                );
              })() : (
                <span className="text-xs text-gray-400">Sin grupo</span>
              )}
            </div>
          )}

            {/* Notification of Linking success */}
            {linkingSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{linkingSuccess}</span>
              </div>
            )}

            {/* Anti-theft / security identity check callout */}
            <div className="p-3 rounded-xl bg-blue-950/80 border border-blue-500/60 text-xs text-blue-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#37c8ff] shrink-0 mt-0.5" />
              <span className="leading-snug">
                <strong className="text-white">Seguridad Antirrobo / Extravío:</strong> Si otra persona encuentra o sustrae tu llavero y tiene un accidente, los paramédicos y el personal del 107 cotejarán su rostro con la foto de esta ficha, impidiendo errores de identidad y protegiendo tu historial médico.
              </span>
            </div>

            {/* Practical Physical Correlative Keychain Linking Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0b1d46] to-[#071536] border border-[#1e5bff]/60 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Llavero Físico Numerado (#ID)
                      </h4>
                      {record?.keychainId ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          #{record.keychainId} VINCULADO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Sin asociar
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9db6dd] mt-0.5 leading-snug">
                      {record?.keychainId
                        ? `Tu ficha médica ya está enlazada al llavero físico #${record.keychainId}. No necesitás reescribir nada.`
                        : '¿Compraste un llavero con número impreso? Vinculalo acá con 1 clic sin volver a escribir tus datos.'}
                    </p>
                  </div>
                </div>

                {!record?.keychainId && !isLinkingOpen && (
                  <button
                    type="button"
                    onClick={() => setIsLinkingOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#1e5bff] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow transition active:scale-95 shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Vincular</span>
                  </button>
                )}
              </div>

              {/* Form to link correlative number */}
              {(!record?.keychainId && isLinkingOpen) && (
                <div className="mt-3 pt-3 border-t border-[#1e3f8f]/40 space-y-2 animate-fade-in">
                  <label className="block text-[11px] text-gray-300 font-semibold">
                    Escribí el número impreso en tu llavero físico (ej: <strong>0042</strong> o <strong>125</strong>):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: 0042"
                      value={keychainInput}
                      onChange={(e) => setKeychainInput(e.target.value.toUpperCase())}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-[#07122c] border border-[#1e5bff] text-sm text-white font-mono uppercase focus:outline-none focus:border-[#37c8ff]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleLinkKeychain}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Asociar ya</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLinkingOpen(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}

              {/* Already linked details */}
              {record?.keychainId && (
                <div className="mt-2.5 pt-2 border-t border-[#1e3f8f]/40 flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="text-emerald-300 font-mono text-[11px] flex items-center gap-1">
                    <span>✓ Llavero #{record.keychainId}:</span>
                    <strong className="text-white">
                      {hasData ? 'QR con ficha clínica offline incrustada' : `...#id=${record.keychainId}`}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleUnlinkKeychain}
                    className="text-[11px] text-red-300 hover:text-red-200 underline font-semibold"
                  >
                    Desvincular o cambiar número
                  </button>
                </div>
              )}
            </div>

            {/* QR Code Presentation Box */}
            <div className="relative p-5 rounded-2xl bg-gradient-to-b from-white via-gray-50 to-gray-100 text-[#050b1f] text-center shadow-xl border-4 border-[#37c8ff]">
              <div className="text-[11px] font-black tracking-widest text-red-600 uppercase mb-2">
                🚨 VORTEX ID · ASISTENCIA MÉDICA SOS 🚨
              </div>

              {/* Canvas rendered QR with Image Fallback */}
              <div className="flex justify-center my-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR de Emergencia Vortex ID"
                    className="w-56 h-56 sm:w-60 sm:h-60 rounded-xl shadow-md border-2 border-[#050b1f]/10 block bg-white"
                  />
                ) : (
                  <canvas ref={canvasRef} className="rounded-xl shadow-md border-2 border-[#050b1f]/10" />
                )}
              </div>

              <div className="mt-2 text-xs font-bold text-[#050b1f]">
                ESCANEAR CON CUALQUIER CELULAR EN CASO DE EMERGENCIA
              </div>
              <div className="text-[11px] text-gray-600">
                Abre al instante la Ficha con foto, llamadas al 107 / 911 y GPS
              </div>
              {hasData && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <span>✓ Datos médicos incrustados offline ({qrUrl.length} bytes)</span>
                  </span>
                  {qrIncludesPhoto ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 text-[10px] font-bold">
                      <span>📸 Foto HD en ficha + foto incluida en QR</span>
                    </span>
                  ) : record?.foto ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                      <span>⏳ Optimizando miniatura QR…</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                      <span>⚠️ Sin foto de identidad cargada</span>
                    </span>
                  )}
                </div>
              )}

            </div>

            {/* Privacy note */}
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Privacidad activa:</strong> Tus datos de edición están ocultos. Solo con tu clave PIN podés modificarlos.
              </span>
            </div>

            {/* Download and Share Buttons Grid */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadKeychainBadge}
                disabled={downloading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-[#1e5bff] to-[#37c8ff] hover:opacity-95 text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-950 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloading ? 'Generando imagen HD con tu foto…' : 'Descargar QR para Llavero / Sticker (PNG HD)'}
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadWallpaper(false)}
                  disabled={wallpaperDownloading}
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-700 hover:opacity-95 text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-950 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>
                    {wallpaperDownloading ? 'Creando fondo HD…' : 'Descargar Fondo de Bloqueo'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadWallpaper(true)}
                  disabled={wallpaperDownloading}
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-fuchsia-700 to-purple-700 hover:opacity-95 border border-fuchsia-400/50 text-white font-bold text-xs tracking-wide shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Guardar / Enviar a Galería</span>
                </button>
              </div>

              {wallpaperNotice && (
                <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-400 text-purple-100 text-xs font-semibold text-center animate-fade-in">
                  {wallpaperNotice}
                </div>
              )}

              {/* Vista previa instantánea del Fondo de Bloqueo generado (permite guardar con 1 toque o mantener presionado en iOS/Android) */}
              {generatedWallpaperUrl && (
                <div className="p-3.5 rounded-2xl bg-[#040917] border-2 border-purple-400 space-y-2.5 animate-fade-in text-center">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-purple-300" />
                      <span>Vista Previa · Pantalla de Bloqueo</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setGeneratedWallpaperUrl('')}
                      className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/5"
                    >
                      Ocultar
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <img
                      src={generatedWallpaperUrl}
                      alt="Fondo de Pantalla de Bloqueo Vortex ID"
                      className="max-h-72 rounded-2xl border-2 border-purple-400/70 shadow-2xl object-contain bg-[#040816]"
                    />
                  </div>

                  <p className="text-[11px] text-purple-200 leading-snug">
                    📱 <strong>En celular:</strong> si tu navegador no abrió la descarga automática, mantené presionada la imagen de arriba y tocá <strong>"Guardar en Fotos / Descargar imagen"</strong>. Luego abrí tu Galería → <strong>Usar como fondo → Pantalla de bloqueo</strong>.
                  </p>

                  <a
                    href={generatedWallpaperUrl}
                    download={generatedWallpaperFilename}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow transition active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Guardar archivo PNG</span>
                  </a>
                </div>
              )}

              {/* Guía rápida pantalla de bloqueo */}
              <div className="p-3 rounded-xl bg-[#07122c] border border-purple-500/40 text-[11px] text-[#c7d7f4] space-y-1">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Cómo poner el QR en tu Pantalla de Bloqueo (sin saber tu clave):</span>
                </div>
                <p className="leading-snug text-[#9db6dd]">
                  1) Tocá <strong>Descargar Fondo de Bloqueo</strong> (deja espacio arriba para el reloj). 2) Abrí la imagen en <strong>Galería / Fotos</strong>. 3) Elegí <strong>Usar como fondo → Pantalla de bloqueo</strong>. Por seguridad del teléfono, Android y iPhone requieren ese paso manual una sola vez.
                </p>
              </div>

              {/* Direct public link indicator */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-[#1e5bff]/60 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-[#37c8ff] truncate select-all">{qrUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded-lg bg-[#1e5bff] hover:bg-blue-600 text-white font-bold shrink-0 flex items-center gap-1 active:scale-95 transition text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 rounded-xl bg-[#0b1d46] hover:bg-[#112a63] border border-[#1e5bff]/70 text-xs font-bold text-[#37c8ff] hover:text-white flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar enlace SOS'}</span>
                </button>


                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (qrUrl.includes('#')) {
                      window.location.hash = qrUrl.substring(qrUrl.indexOf('#'));
                      window.dispatchEvent(new HashChangeEvent('hashchange'));
                    } else {
                      window.location.href = qrUrl;
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/50 text-xs font-black text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  <span>Probar escaneo aquí</span>
                </button>
              </div>

              {/* Edit Data with PIN */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSosModal();
                }}
                className="w-full py-2 px-3 rounded-xl bg-transparent hover:bg-white/5 text-[11px] text-gray-400 hover:text-gray-200 flex items-center justify-center gap-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Modificar datos personales o cambiar foto / PIN</span>
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};
