import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Share2,
  Download,
  Check,
  ExternalLink,
  Send,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  DollarSign,
  Palette,
  QrCode,
  Monitor
} from 'lucide-react';
import QRCode from 'qrcode';
import { playChirp } from '../utils/callHandler';
import {
  getStoredSystemConfig,
  fetchSystemConfig,
  formatCurrency,
  SystemConfig
} from '../utils/systemConfig';
import { usePWAInstall } from '../utils/usePWAInstall';

const OFFICIAL_FUTURISTIC_QR_URL = '/assets/qr_vortex_id_futurista.png?v=41';
const OFFICIAL_NETLIFY_URL = 'https://asistentesospuntaalta.netlify.app/';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWelcomePreview?: () => void;
  initialTab?: 'qr' | 'android' | 'iphone' | 'pc' | 'marca';
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  onOpenWelcomePreview,
  initialTab = 'qr'
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'android' | 'iphone' | 'pc' | 'marca'>(initialTab);
  const [qrMode, setQrMode] = useState<'oficial' | 'app' | 'keychain'>('oficial');
  const [customKeychainNum, setCustomKeychainNum] = useState<string>('0001');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generatingPoster, setGeneratingPoster] = useState<boolean>(false);
  const {
    deferredPrompt,
    isInstalled,
    alreadyInstalledInBrowser,
    wasPromptDismissed,
    isIOS,
    install
  } = usePWAInstall();
  const [installHint, setInstallHint] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedAlias, setCopiedAlias] = useState<boolean>(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(getStoredSystemConfig());

  const isInIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  const isFirefoxDesktop =
    typeof navigator !== 'undefined' &&
    !isMobileDevice &&
    /firefox/i.test(navigator.userAgent);

  const currentOriginRoot =
    typeof window !== 'undefined' ? window.location.origin : OFFICIAL_NETLIFY_URL.replace(/\/+$/, '');
  const currentOriginHost =
    typeof window !== 'undefined' ? window.location.host : 'asistentesospuntaalta.netlify.app';
  const directTabInstallUrl = `${currentOriginRoot}/?instalar=1`;

  const netlifyOriginClean = OFFICIAL_NETLIFY_URL.replace(/\/+$/, '');

  const configuredBase =
    systemConfig.customDomain && systemConfig.customDomain.trim().startsWith('http')
      ? systemConfig.customDomain.trim().replace(/\/+$/, '')
      : netlifyOriginClean;
  const productionBase = configuredBase;
  const cleanKey = customKeychainNum.trim().toUpperCase().replace(/^#/, '') || '0001';
  const effectiveShareUrl =
    qrMode === 'oficial'
      ? `${productionBase}/`
      : qrMode === 'app'
        ? `${productionBase}/?alta=1`
        : `${productionBase}/#id=${cleanKey}`;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setInstallHint('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (qrMode === 'oficial' && effectiveShareUrl === OFFICIAL_NETLIFY_URL) {
      setQrDataUrl(OFFICIAL_FUTURISTIC_QR_URL);
      return;
    }
    if (effectiveShareUrl) {
      import('../utils/vortexQrGenerator')
        .then(({ generateVortexQrDataUrl }) => {
          return generateVortexQrDataUrl(effectiveShareUrl, {
            width: 900,
            margin: 3,
            errorCorrectionLevel: 'H'
          });
        })
        .then((url) => setQrDataUrl(url))
        .catch(() => {
          // Fallback if canvas fails
          QRCode.toDataURL(effectiveShareUrl, {
            width: 440,
            margin: 2,
            errorCorrectionLevel: 'H'
          }).then((fallbackUrl) => setQrDataUrl(fallbackUrl));
        });
    }
  }, [effectiveShareUrl, qrMode]);

  useEffect(() => {
    // Listen for system config updates
    const handleConfigUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SystemConfig>;
      if (customEvent.detail) {
        setSystemConfig(customEvent.detail);
      }
    };
    window.addEventListener('vortex_config_updated', handleConfigUpdated);

    fetchSystemConfig().then((cfg) => {
      setSystemConfig(cfg);
    });

    return () => {
      window.removeEventListener('vortex_config_updated', handleConfigUpdated);
    };
  }, []);

  if (!isOpen) return null;

  const handleCopyAlias = () => {
    playChirp('click');
    navigator.clipboard.writeText(systemConfig.paymentAlias || 'vortex.id.auxilio');
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const handleInstallClick = async () => {
    playChirp('click');
    if (deferredPrompt) {
      const accepted = await install();
      if (accepted) {
        playChirp('success');
        setInstallHint('');
      } else {
        setActiveTab(isMobileDevice ? 'android' : 'pc');
        setInstallHint(
          isMobileDevice
            ? 'Cancelaste el cuadro automático. Tocá los 3 puntitos (⋮) de Chrome arriba a la derecha → "Instalar aplicación".'
            : 'Cancelaste el cuadro automático. Hacé clic en el ícono de Instalar (monitor con flecha ↓) en la barra de direcciones arriba a la derecha, o en el menú (⋮) → Guardar y compartir / Aplicaciones → Instalar.'
        );
      }
      return;
    }
    if (alreadyInstalledInBrowser) {
      setActiveTab(isMobileDevice ? 'android' : 'pc');
      setInstallHint(
        'Vortex ID ya figura instalada en este navegador. Abrila desde el acceso directo de tu Escritorio / Menú Inicio o tocá el ícono "Abrir en aplicación" en la barra de direcciones.'
      );
      return;
    }
    if (isInIframe) {
      setInstallHint(
        `En esta vista previa embebida el navegador bloquea la descarga directa. Tocá el botón verde de arriba para abrir ${currentOriginHost} en una pestaña directa e instalarla en 1 clic.`
      );
      return;
    }
    if (isIOS) {
      setActiveTab('iphone');
      setInstallHint(
        'En iPhone/iPad tocá el botón Compartir (⎋) abajo en Safari y elegí "Agregar al inicio".'
      );
      return;
    }
    setActiveTab(isMobileDevice ? 'android' : 'pc');
    setInstallHint(
      isMobileDevice
        ? 'Tocá los 3 puntitos (⋮) de Chrome arriba a la derecha → "Instalar aplicación".'
        : wasPromptDismissed
          ? 'El navegador ocultó temporalmente el botón automático porque se cerró antes. Hacé clic en el ícono de Instalar (monitor con flecha ↓) arriba a la derecha de la barra de direcciones o menú (⋮) → Instalar.'
          : 'Hacé clic en el ícono de Instalar (monitor con flecha ↓) en la barra de direcciones arriba a la derecha, o en el menú (⋮) → Guardar y compartir → Instalar página como aplicación.'
    );
  };

  const handleCopyLink = () => {
    playChirp('click');
    navigator.clipboard.writeText(effectiveShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    playChirp('click');
    const feeText = formatCurrency(systemConfig.monthlyFee);
    const text = qrMode === 'keychain'
      ? `🚨 *VORTEX ID PUNTA ALTA · FICHA DE ASISTENCIA*\nTe comparto el enlace de la Ficha Médica del Llavero #${cleanKey}:\n${effectiveShareUrl}\n\nAnte cualquier emergencia o accidente en Punta Alta, escaneá el QR o abrí este enlace para ver datos de auxilio vitales y llamar al 107 SAME.`
      : `🚨 *VORTEX ID PUNTA ALTA*\nTe comparto esta aplicación fundamental para emergencias de salud y accidentes en Punta Alta: llevás tu Ficha Médica de Emergencia en el llavero y consultás farmacias de turno 24hs en tiempo real.\n\n💎 Membresía mensual del servicio: ${feeText}/mes.\n📲 Podés instalarla en tu celular desde este enlace:\n${effectiveShareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    playChirp('click');
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download =
      qrMode === 'oficial'
        ? 'vortex_id_qr_futurista_punta_alta.png'
        : qrMode === 'keychain'
          ? `vortex_id_llavero_${cleanKey}.png`
          : 'vortex_id_qr_alta_membresia.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPrintablePoster = () => {
    const activeQrSrc = qrDataUrl || OFFICIAL_FUTURISTIC_QR_URL;
    setGeneratingPoster(true);
    playChirp('click');

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setGeneratingPoster(false);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, 1600);
    grad.addColorStop(0, '#04091b');
    grad.addColorStop(0.55, '#091a45');
    grad.addColorStop(1, '#030714');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 1600);

    // Outer neon border
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(28, 28, 1144, 1544, 42);
    ctx.stroke();

    // Top emergency header bar
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(64, 64, 1072, 118, 26);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VORTEX ID · PUNTA ALTA', 600, 138);

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('ESCANEÁ EL QR CON LA CÁMARA DE TU CELULAR', 600, 248);

    ctx.fillStyle = '#eaf3ff';
    ctx.font = '26px sans-serif';
    ctx.fillText('Farmacias de turno 24hs · Ficha Médica SOS · 107 / 911 con GPS', 600, 294);

    // White QR backing card
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(180, 345, 840, 840, 40);
    ctx.fill();
    ctx.stroke();

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 210, 375, 780, 780);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText('ASISTENTE DE EMERGENCIAS Y SALUD', 600, 1265);

      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(effectiveShareUrl.replace(/^https?:\/\//, ''), 600, 1320);

      // Footer box
      ctx.fillStyle = '#0d2359';
      ctx.strokeStyle = '#37c8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(110, 1375, 980, 135, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Llevá tu Ficha Médica en el Llavero o Pantalla de Bloqueo', 600, 1435);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '24px sans-serif';
      ctx.fillText('SAME Salud: 107  ·  Policía: 911  ·  Bomberos: 100', 600, 1482);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download =
        qrMode === 'keychain'
          ? `poster_vortex_id_llavero_${cleanKey}.png`
          : 'poster_qr_oficial_vortex_id.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      playChirp('success');
      setGeneratingPoster(false);
    };
    qrImg.onerror = () => {
      setGeneratingPoster(false);
    };
    qrImg.src = activeQrSrc;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-[#0a1f55] via-[#071536] to-[#050b1f] border-2 border-[#37c8ff] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-blue-950/90 my-auto text-white space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#1e3f8f]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-[#37c8ff] text-white shadow-md shadow-blue-900/50">
              <Smartphone className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-wide text-white">
                INSTALAR APLICACIÓN
              </h2>
              <p className="text-xs text-[#37c8ff] font-bold uppercase">
                Vortex ID · Punta Alta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition"
            aria-label="Cerrar ventana"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Highlight Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0d2a6e] to-[#0a1b42] border border-[#37c8ff]/40 text-xs leading-relaxed space-y-1">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
            <span>Instalá la app en tu celular, PC o laptop en 30 segundos</span>
          </p>
          <p className="text-[#9db6dd]">
            Compatible con Android, iPhone, Windows y Mac sin ocupar memoria y 100% offline: la ficha médica de auxilio y las farmacias de turno quedan listas en tu pantalla principal o escritorio.
          </p>
        </div>

        {/* Direct Install Button (Always visible right below the 30-second banner) */}
        {isInstalled || alreadyInstalledInBrowser ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-400/80 flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="text-emerald-200 block">
                ¡Vortex ID ya está instalada en este dispositivo!
              </strong>
              <span className="text-emerald-100/80">
                {isInstalled
                  ? 'Podés abrirla desde tu pantalla principal o escritorio incluso sin internet.'
                  : 'Ya figura instalada en tu navegador: podés abrirla desde tu Escritorio, Menú Inicio o el ícono "Abrir en aplicación" en la barra de direcciones.'}
              </span>
            </div>
          </div>
        ) : isInIframe ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 border-2 border-emerald-400 shadow-xl space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instalación en 1 toque (abrir pestaña directa)</span>
            </span>
            <a
              href={directTabInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playChirp('click')}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500 hover:brightness-110 text-gray-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-[0.99] transition"
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              <span>Abrir en pestaña directa para instalar en 1 toque</span>
            </a>
            <p className="text-[11px] text-cyan-100/90 bg-black/35 border border-cyan-400/40 rounded-xl p-2 leading-snug">
              La vista previa embebida bloquea la descarga directa del navegador. Al abrir{' '}
              <strong className="font-mono text-cyan-300">{currentOriginHost}</strong>{' '}
              en pestaña directa se habilita la instalación nativa en Chrome / Edge.
            </p>
          </div>
        ) : deferredPrompt ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 border-2 border-emerald-400 shadow-xl space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isMobileDevice
                  ? 'Tu celular está listo para instalación en 1 toque'
                  : 'Tu PC / Laptop está lista para instalación en 1 toque'}
              </span>
            </span>

            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500 hover:brightness-110 text-gray-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-[0.99] transition"
            >
              <Download className="w-5 h-5 shrink-0" />
              <span>
                {isMobileDevice
                  ? 'Instalar App en este celular en 1 toque'
                  : 'Instalar App en esta PC / Laptop en 1 toque'}
              </span>
            </button>

            {installHint && (
              <p className="text-[11px] text-emerald-100 bg-black/40 border border-emerald-400/40 rounded-xl p-2.5 leading-snug">
                {installHint}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#07193a] via-[#0a2352] to-[#081533] border-2 border-cyan-400/70 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-300">
              <Monitor className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>
                {isMobileDevice
                  ? 'Instalá la app desde el menú de tu navegador'
                  : isFirefoxDesktop
                    ? 'Firefox PC no instala PWAs · Abrila en Chrome o Edge'
                    : 'Cómo instalar en esta PC (Chrome / Edge)'}
              </span>
            </div>

            {!isMobileDevice && !isIOS ? (
              <div className="text-[11px] text-[#cfe0ff] space-y-2 leading-relaxed">
                <p>
                  {isFirefoxDesktop
                    ? 'Firefox de escritorio no admite instalar aplicaciones web (PWA). Copiá el enlace de abajo y abrilo en Google Chrome o Microsoft Edge para instalarla en 1 clic:'
                    : wasPromptDismissed
                      ? 'Cerraste el aviso automático de instalación. Por seguridad del navegador, ahora debés instalarla desde la barra superior:'
                      : 'Si no aparece el botón automático es porque Chrome/Edge ya tiene una copia instalada, estás en modo Incógnito o cerraste un aviso anterior. Instalala directo así:'}
                </p>
                <div className="p-2.5 rounded-xl bg-black/45 border border-cyan-400/40 space-y-1">
                  <p>
                    <strong className="text-emerald-300">Opción 1 (barra de dirección):</strong> Mirá arriba a la derecha de la URL y tocá el ícono de{' '}
                    <strong className="text-white">Instalar (monitor con flecha ↓)</strong>. Si dice{' '}
                    <em>«Abrir en Vortex ID»</em>, es porque ya está instalada en tu PC.
                  </p>
                  <p>
                    <strong className="text-cyan-300">Opción 2 (menú):</strong> Tocá{' '}
                    <strong className="text-white">(⋮) → Guardar y compartir → Instalar página como aplicación</strong> (en Edge: <em>Aplicaciones → Instalar</em>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    navigator.clipboard.writeText(currentOriginRoot);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#0b1f50] hover:bg-[#143078] border border-cyan-400/60 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? '¡Enlace copiado! Pegalo en Chrome o Edge' : `Copiar enlace actual (${currentOriginHost})`}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-gray-950 font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Ver pasos para instalar en este celular</span>
              </button>
            )}

            {installHint && (
              <p className="text-[11px] text-emerald-100 bg-black/40 border border-emerald-400/40 rounded-xl p-2.5 leading-snug">
                {installHint}
              </p>
            )}
          </div>
        )}

        {/* Membresía del Servicio Vortex ID */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#1f1704] to-[#0a1f55] border-2 border-amber-400 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-200">
                Membresía Mensual del Servicio
              </h3>
            </div>
            <span className="text-base sm:text-lg font-black text-amber-300 bg-black/60 px-3 py-0.5 rounded-xl border border-amber-400/60 font-mono">
              {formatCurrency(systemConfig.monthlyFee)} / mes
            </span>
          </div>

          <p className="text-xs text-amber-100/90 leading-snug">
            Cubre la instalación, la vinculación del llavero físico numerado, guardado seguro en la nube y asistencia ante accidentes en Punta Alta.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
              systemConfig.isMembershipRequired
                ? 'bg-rose-950/90 text-rose-200 border-rose-400/70'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-400/70'
            }`}>
              {systemConfig.isMembershipRequired
                ? '🔒 Bloqueo Activo (Exige Pago + WhatsApp + Código)'
                : '🟢 Modo Prueba Abierta (Libre para testear carga)'}
            </span>
          </div>

          <div className="pt-1 flex items-center justify-between gap-2 text-xs">
            <div className="w-full flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-xl border border-amber-500/40 font-mono">
              <span className="text-gray-400">Alias MP:</span>
              <span className="font-bold text-white select-all">{systemConfig.paymentAlias || 'vortex.id.auxilio'}</span>
              <button
                type="button"
                onClick={handleCopyAlias}
                className="ml-auto text-amber-300 hover:text-white p-0.5"
                title="Copiar alias"
              >
                {copiedAlias ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Operating System, QR & Brand Tabs */}
        <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[#050b1f] border border-[#1e3f8f]">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition ${
              activeTab === 'qr'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition ${
              activeTab === 'android'
                ? 'bg-gradient-to-r from-blue-600 to-[#1e5bff] text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <span className="truncate">🤖 Android</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('iphone')}
            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition ${
              activeTab === 'iphone'
                ? 'bg-gradient-to-r from-blue-600 to-[#1e5bff] text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <span className="truncate">🍎 iPhone</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pc')}
            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition ${
              activeTab === 'pc'
                ? 'bg-gradient-to-r from-blue-600 to-[#1e5bff] text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">PC</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marca')}
            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition ${
              activeTab === 'marca'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">Marca</span>
          </button>
        </div>

        {/* Step-by-Step Instructions or QR Showcase */}
        {activeTab === 'qr' ? (
          <div className="p-4 rounded-2xl bg-[#050b1f] border border-cyan-500/80 space-y-3.5 animate-fade-in text-center">
            {/* Mode selector: QR Oficial Futurista vs Bienvenida vs Llavero */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#071330] border border-[#1e4594]">
              <button
                type="button"
                onClick={() => setQrMode('oficial')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                  qrMode === 'oficial'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                🛡️ QR Oficial App
              </button>
              <button
                type="button"
                onClick={() => setQrMode('app')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                  qrMode === 'app'
                    ? 'bg-emerald-400 text-black font-black shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                💳 Alta + Pago
              </button>
              <button
                type="button"
                onClick={() => setQrMode('keychain')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                  qrMode === 'keychain'
                    ? 'bg-amber-400 text-black font-black shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                🪪 Llavero #ID
              </button>
            </div>

            {qrMode === 'keychain' && (
              <div className="flex items-center justify-center gap-2 p-2 bg-[#071330] rounded-xl border border-amber-500/40 text-xs">
                <span className="text-gray-400">Número de Llavero:</span>
                <input
                  type="text"
                  maxLength={6}
                  value={customKeychainNum}
                  onChange={(e) => setCustomKeychainNum(e.target.value)}
                  placeholder="0001"
                  className="w-20 py-1 px-2 rounded-lg bg-black border border-amber-400 text-amber-300 font-mono font-bold text-center uppercase"
                />
                <span className="text-[11px] text-[#9db6dd]">
                  (ej: 0001, 0042)
                </span>
              </div>
            )}

            {/* QR Image Display */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-2.5 bg-white rounded-2xl shadow-xl shadow-cyan-950/60 inline-block border-4 border-cyan-400">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR Futurista Vortex ID"
                    className="w-56 h-56 sm:w-64 sm:h-64 block object-contain rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-gray-500 font-mono text-xs">
                    Generando QR...
                  </div>
                )}
              </div>
              <div className="text-[11px] text-cyan-300 font-bold">
                {qrMode === 'oficial'
                  ? 'QR Oficial Vortex ID · Escudo Integrado (900×900 HD)'
                  : qrMode === 'app'
                    ? 'QR Directo de Alta y Membresía · Escudo Vortex ID (900×900 HD)'
                    : 'Escudo oficial Vortex en el centro (Escaneo HD Nivel H)'}
              </div>
              <p className="text-xs text-cyan-100/90 font-medium max-w-xs">
                {qrMode === 'oficial'
                  ? `Escaneando este código se abre: ${productionBase.replace(/^https?:\/\//, '')}.`
                  : qrMode === 'app'
                    ? 'Quien escanee este QR irá directo al registro: en Modo Prueba carga libremente y cuando actives el Bloqueo primero verá tu Alias y WhatsApp.'
                    : `QR oficial vinculado al Llavero #${cleanKey}. Al escanear muestra los datos de auxilio.`}
              </p>

            </div>

            {/* Actions for QR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>Descargar QR (PNG HD)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPrintablePoster}
                disabled={generatingPoster}
                className="py-2.5 px-3 rounded-xl bg-[#0b1f50] hover:bg-[#143078] border border-cyan-400/70 text-cyan-100 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-60"
              >
                <QrCode className="w-4 h-4 text-cyan-300" />
                <span>{generatingPoster ? 'Armando cartel…' : 'Cartel para Imprimir'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-gray-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Send className="w-4 h-4 text-gray-950" />
              <span>Mandar enlace por WhatsApp</span>
            </button>

            {/* Test Welcome Experience Button */}
            {onOpenWelcomePreview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWelcomePreview();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-blue-500/20 hover:from-amber-500/30 hover:to-blue-500/30 border border-cyan-400/50 text-xs font-bold text-cyan-200 flex items-center justify-center gap-2 transition shadow-inner"
              >
                <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                <span>🎉 Probar Bienvenida con Confites y Voz (cómo lo verá la persona)</span>
              </button>
            )}
          </div>
        ) : activeTab === 'android' ? (
          <div className="p-4 rounded-2xl bg-[#050b1f] border border-[#1e3f8f]/80 space-y-3">
            <h3 className="text-sm font-black text-emerald-400 flex items-center gap-1.5 uppercase">
              <span>Pasos para instalar en Android (Google Chrome):</span>
            </h3>
            <ol className="space-y-2.5 text-xs text-[#eaf3ff] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <span>
                  Abrí este enlace en el navegador <strong className="text-white">Google Chrome</strong> del celular.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <span>
                  Tocá los <strong className="text-white">tres puntitos verticales (⋮)</strong> que están arriba a la derecha.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <span>
                  Tocá en <strong className="text-emerald-400">"Instalar aplicación"</strong> (o <em>"Agregar a la pantalla principal"</em>).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  ✓
                </span>
                <span>
                  <strong className="text-emerald-300">¡Listo!</strong> La app se guardará con su ícono oficial en la pantalla del celular como cualquier otra app.
                </span>
              </li>
            </ol>
          </div>
        ) : activeTab === 'iphone' ? (
          <div className="p-4 rounded-2xl bg-[#050b1f] border border-[#1e3f8f]/80 space-y-3">
            <h3 className="text-sm font-black text-cyan-400 flex items-center gap-1.5 uppercase">
              <span>Pasos para instalar en iPhone (Safari):</span>
            </h3>
            <ol className="space-y-2.5 text-xs text-[#eaf3ff] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <span>
                  Abrí este enlace en el navegador <strong className="text-white">Safari</strong> del iPhone.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <span>
                  Tocá el botón <strong className="text-white">Compartir</strong> abajo al centro (el icono de un cuadrado con una flecha hacia arriba ⎋).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <span>
                  Deslizá hacia abajo en el menú y tocá <strong className="text-cyan-300">"Agregar al inicio"</strong> (o <em>"Add to Home Screen"</em>).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  ✓
                </span>
                <span>
                  Tocá <strong className="text-emerald-300">"Agregar"</strong> arriba a la derecha. ¡Ya queda instalada en tu iPhone!
                </span>
              </li>
            </ol>
          </div>
        ) : activeTab === 'pc' ? (
          <div className="p-4 rounded-2xl bg-[#050b1f] border border-[#1e3f8f]/80 space-y-3">
            <h3 className="text-sm font-black text-cyan-300 flex items-center gap-1.5 uppercase">
              <Monitor className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Pasos para instalar en PC o Laptop (Chrome / Edge):</span>
            </h3>
            <ol className="space-y-2.5 text-xs text-[#eaf3ff] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <span>
                  Abrí <strong className="text-white font-mono">{currentOriginHost}</strong> en <strong className="text-white">Google Chrome</strong> o <strong className="text-white">Microsoft Edge</strong> desde tu computadora o notebook.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <span>
                  Arriba a la derecha en la barra de direcciones vas a ver el ícono de <strong className="text-cyan-300">«Instalar Vortex ID»</strong> (un monitor con una flecha hacia abajo ↓). También podés tocar el menú <strong className="text-white">(⋮) → Guardar y compartir / Aplicaciones → Instalar</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <span>
                  Hacé clic en <strong className="text-emerald-400">«Instalar»</strong> en el cuadro que aparece.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-xs">
                  ✓
                </span>
                <span>
                  <strong className="text-emerald-300">¡Listo!</strong> Se crea el ícono oficial de Vortex ID en tu Escritorio y Menú Inicio, y se abre como un programa propio incluso sin internet.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          /* TAB 3: MARCA, LOGO Y CONSEJOS DE PROMOCIÓN */
          <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0a1838] to-[#050b1f] border border-purple-500/60 space-y-4 animate-fade-in">
            {/* Logo Emblem & Official QR Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#07122c] p-3.5 rounded-2xl border border-purple-400/40">
              <div className="flex flex-col items-center text-center gap-2 p-2.5 rounded-xl bg-[#050b1f] border border-cyan-500/40">
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-xl bg-gradient-to-b from-[#0b2247] to-[#040c1f]">
                  <img
                    src="/assets/aistudio/image__2__7d12aee0.png"
                    alt="Emblema Oficial Vortex ID"
                    className="w-full h-full object-contain translate-y-[7%] scale-[1.5]"
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white">Escudo Oficial Vortex ID</h4>
                  <a
                    href="/assets/aistudio/image__2__7d12aee0.png"
                    download="vortex_id_escudo_oficial.png"
                    className="inline-flex py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] items-center gap-1.5 shadow active:scale-95 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Logo PNG</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-col items-center text-center gap-2 p-2.5 rounded-xl bg-[#050b1f] border border-cyan-500/40">
                <img
                  src={OFFICIAL_FUTURISTIC_QR_URL}
                  alt="QR Oficial Vortex ID Futurista"
                  className="w-28 h-28 rounded-2xl object-contain bg-white p-1 border-2 border-cyan-400 shadow-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white">QR Oficial con Logo Central</h4>
                  <a
                    href={OFFICIAL_FUTURISTIC_QR_URL}
                    download="vortex_id_qr_futurista_punta_alta.png"
                    className="inline-flex py-1.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[11px] items-center gap-1.5 shadow active:scale-95 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar QR PNG</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Guía Rápida de Promoción Local en Punta Alta */}
            <div className="space-y-2 text-xs">
              <span className="font-black text-cyan-300 uppercase tracking-wider block">
                🚀 5 Canales Prácticos para Difusión en Punta Alta:
              </span>
              <ul className="space-y-2 text-[#eaf3ff]">
                <li className="p-2.5 rounded-xl bg-[#071330] border border-[#1e3f8f] flex items-start gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">1.</span>
                  <div>
                    <strong className="text-white block">Farmacias de Turno (El Gancho Inicial):</strong>
                    Dejá stickers QR en mostradores de farmacias: <em>"Mirá qué farmacia está de guardia hoy gratis en tu celular"</em>. La gente la guarda al instante.
                  </div>
                </li>
                <li className="p-2.5 rounded-xl bg-[#071330] border border-[#1e3f8f] flex items-start gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">2.</span>
                  <div>
                    <strong className="text-white block">Remises y Taxis de Punta Alta:</strong>
                    Colocar un pequeño código adhesivo en el respaldo: <em>"En caso de urgencia en viaje: guardias médicas y SAME 107 a 1 toque"</em>.
                  </div>
                </li>
                <li className="p-2.5 rounded-xl bg-[#071330] border border-[#1e3f8f] flex items-start gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">3.</span>
                  <div>
                    <strong className="text-white block">Centros de Jubilados, PAMI y Familias:</strong>
                    Ofrecer el llavero físico numerado (#ID) para adultos mayores: sus hijos se sienten tranquilos de que ante caídas o descompensaciones el 107 tiene sus datos.
                  </div>
                </li>
                <li className="p-2.5 rounded-xl bg-[#071330] border border-[#1e3f8f] flex items-start gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">4.</span>
                  <div>
                    <strong className="text-white block">Mochilas Escolares y Ciclistas:</strong>
                    Ideal para deportistas que entrenan en Ruta 229 o Arroyo Pareja, y niños en escuelas: el llavero en la mochila salva vidas en accidentes.
                  </div>
                </li>
                <li className="p-2.5 rounded-xl bg-[#071330] border border-[#1e3f8f] flex items-start gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">5.</span>
                  <div>
                    <strong className="text-white block">Grupos de WhatsApp Barriales:</strong>
                    Compartir el link directo del portal en grupos de Ciudad Atlántida, Nueva Bahía Blanca y centro como servicio vecinal gratuito.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Share Section for friends and customers */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0a1838] to-[#07122c] border border-emerald-500/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Share2 className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                Compartir este servicio a familiares o clientes
              </h4>
            </div>
            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
              Público
            </span>
          </div>

          {/* Enlace público visualizado */}
          <div className="p-2.5 rounded-xl bg-black/60 border border-[#37c8ff]/40 text-xs flex items-center justify-between gap-2 overflow-hidden">
            <span className="font-mono text-[11px] text-[#37c8ff] truncate select-all">{effectiveShareUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-2.5 py-1 rounded-lg bg-[#1e5bff] hover:bg-blue-600 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 active:scale-95 transition"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-gray-950 font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
            >
              <Send className="w-4 h-4 text-gray-950" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="py-3 px-3 rounded-xl bg-[#0b1d46] hover:bg-[#122e7a] border border-[#37c8ff]/60 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#37c8ff]" />}
              <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace público'}</span>
            </button>
          </div>
        </div>


        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#0a1f55] hover:bg-[#133075] border border-gray-600 text-white font-bold text-xs active:scale-95 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
