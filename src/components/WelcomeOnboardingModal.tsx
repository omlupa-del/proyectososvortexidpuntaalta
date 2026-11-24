import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Music,
  Camera,
  HeartPulse,
  KeyRound,
  ArrowRight,
  X,
  Stethoscope,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import {
  speakWelcomeGreeting,
  stopWelcomeGreeting,
  playWelcomeChime,
  buildWelcomeMessage,
  WelcomeContext
} from '../utils/welcomeVoice';
import { welcomeMusic } from '../utils/welcomeMusic';
import { playChirp } from '../utils/callHandler';
import { SystemConfig, formatCurrency } from '../utils/systemConfig';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRegistration: () => void;
  onExplorePharmacies?: () => void;
  onOpenQrModal?: () => void;
  isTriggeredByScan?: boolean;
  welcomeContext?: WelcomeContext;
  systemConfig?: SystemConfig;
  isMembershipUnlocked?: boolean;
  userName?: string;
  hasMedicalData?: boolean;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartRegistration,
  onExplorePharmacies,
  onOpenQrModal,
  isTriggeredByScan = false,
  welcomeContext = 'default',
  systemConfig,
  isMembershipUnlocked = false,
  userName,
  hasMedicalData = false
}) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState<boolean>(false);

  const effectiveContext: WelcomeContext =
    welcomeContext !== 'default'
      ? welcomeContext
      : isTriggeredByScan
      ? 'scan'
      : 'default';

  const welcomeMessage = buildWelcomeMessage(userName, effectiveContext);
  const firstName = (userName || '').trim().split(/\s+/)[0];

  // Trigger Confetti Celebration, Ambient Background Music and Spoken Voice when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopWelcomeGreeting();
      welcomeMusic.stop();
      setIsPlayingVoice(false);
      return;
    }

    const fireCelebration = () => {
      confetti({
        particleCount: 75,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#37c8ff', '#fbbf24', '#1e5bff', '#10b981', '#ffffff']
      });

      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 60,
          origin: { x: 0.1, y: 0.65 },
          colors: ['#37c8ff', '#fbbf24', '#ef4444']
        });
      }, 250);

      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 60,
          origin: { x: 0.9, y: 0.65 },
          colors: ['#37c8ff', '#10b981', '#fbbf24']
        });
      }, 450);
    };

    fireCelebration();
    welcomeMusic.start();
    setIsMusicMuted(welcomeMusic.getIsMuted());

    playWelcomeChime();
    const voiceTimer = setTimeout(() => {
      setIsPlayingVoice(true);
      speakWelcomeGreeting(
        () => setIsPlayingVoice(true),
        () => {
          setIsPlayingVoice(false);
          setHasPlayedOnce(true);
        },
        userName,
        effectiveContext
      );
    }, 180);

    return () => {
      clearTimeout(voiceTimer);
      stopWelcomeGreeting();
      welcomeMusic.stop();
    };
  }, [isOpen, userName, effectiveContext]);

  if (!isOpen) return null;

  const handleToggleVoice = () => {
    playChirp('click');
    if (isPlayingVoice) {
      stopWelcomeGreeting();
      setIsPlayingVoice(false);
    } else {
      setIsPlayingVoice(true);
      speakWelcomeGreeting(
        () => setIsPlayingVoice(true),
        () => setIsPlayingVoice(false),
        userName,
        effectiveContext
      );
    }
  };

  const handleToggleMusic = () => {
    playChirp('click');
    const muted = welcomeMusic.toggleMute();
    setIsMusicMuted(muted);
  };

  const handleReplayCelebration = () => {
    playChirp('success');
    confetti({
      particleCount: 70,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#37c8ff', '#fbbf24', '#1e5bff', '#10b981']
    });
    if (!welcomeMusic.getIsPlaying()) {
      welcomeMusic.start();
    }
    handleToggleVoice();
  };

  const handlePrimaryAction = () => {
    playChirp('success');
    stopWelcomeGreeting();
    welcomeMusic.stop();
    onClose();
    if ((effectiveContext === 'data_saved' || hasMedicalData) && onOpenQrModal) {
      onOpenQrModal();
    } else {
      onStartRegistration();
    }
  };

  const handlePharmacies = () => {
    playChirp('click');
    stopWelcomeGreeting();
    welcomeMusic.stop();
    onClose();
    if (onExplorePharmacies) {
      onExplorePharmacies();
    }
  };

  const headerKicker =
    effectiveContext === 'data_saved'
      ? 'Ficha médica activada · Punta Alta'
      : effectiveContext === 'installed'
      ? 'Aplicación instalada · Punta Alta'
      : effectiveContext === 'scan'
      ? 'Escaneo verificado · Punta Alta'
      : 'Bienvenida oficial · Punta Alta';

  const heroDescription =
    effectiveContext === 'data_saved'
      ? 'Tu ficha médica ya está guardada y protegida con clave. Ya podés descargar tu credencial QR y llevar tu auxilio siempre con vos.'
      : effectiveContext === 'installed'
      ? 'Ya tenés Vortex ID instalado en tu dispositivo para acceder en 1 toque las 24 horas, incluso sin conexión a internet.'
      : 'Confiaste en Vortex ID para cuidar lo más valioso: tu vida y la de quienes más querés. Estamos con vos las 24 horas en todo Coronel Rosales.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a Vortex ID Punta Alta"
    >
      <div className="relative w-full max-w-lg bg-[#060d20] border border-cyan-400/60 rounded-2xl p-5 sm:p-6 shadow-2xl my-auto text-white space-y-4 overflow-hidden">
        {/* Aerospace Corner Reticles */}
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
        <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[#183160] pb-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#07142b] border border-cyan-400/70 overflow-hidden shrink-0 shadow-[0_0_16px_rgba(55,200,255,0.22)]">
              <img
                src="/assets/aistudio/image__2__7d12aee0.png"
                alt="Escudo oficial Vortex ID"
                className="w-full h-full object-contain translate-y-[7%] scale-[1.52]"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono text-cyan-300 tracking-wider uppercase truncate">
                {headerKicker}
              </div>
              <h2 className="text-2xl sm:text-[1.7rem] font-black font-heading tracking-wide text-white leading-tight">
                VORTEX <span className="text-[#37c8ff]">ID</span> AUXILIO
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopWelcomeGreeting();
              welcomeMusic.stop();
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-white/10 text-[#9db6dd] hover:text-white transition-colors shrink-0"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Special Gratitude Hero Banner with Official Vortex ID Emblem */}
        <div className="relative p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[#0a1c42] via-[#081533] to-[#0a182c] border border-cyan-400/45 text-center space-y-2.5">
          <div className="mx-auto w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-cyan-400/80 shadow-[0_0_28px_rgba(55,200,255,0.3)] bg-gradient-to-b from-[#0b2247] to-[#040c1f]">
            <img
              src="/assets/aistudio/image__2__7d12aee0.png"
              alt="Logo oficial Vortex ID Punta Alta"
              className="w-full h-full object-contain translate-y-[7%] scale-[1.52] drop-shadow-[0_0_16px_rgba(55,200,255,0.45)]"
            />
          </div>

          <div className="inline-flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-amber-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
            <span>
              {effectiveContext === 'data_saved'
                ? 'Protección Personal Activa'
                : effectiveContext === 'installed'
                ? 'Acceso Directo Instalado'
                : 'Comunidad Protegida'}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black font-heading tracking-wide text-white uppercase leading-none text-balance">
            {firstName ? `¡Gracias por elegirnos, ${firstName}!` : '¡Gracias por elegirnos!'}
          </h3>

          <p className="text-xs sm:text-sm text-[#dbe9ff] leading-relaxed max-w-md mx-auto">
            {heroDescription}
          </p>

          <p className="text-[11px] font-mono text-amber-200/85 pt-0.5">
            Siempre cerca · Auxilio inmediato · Punta Alta
          </p>
        </div>

        {/* Multimedia Welcome Box: Spoken Voice + Ambient Music + Equalizer Wave */}
        <div className="p-3.5 rounded-xl bg-[#071128] border border-[#1a3366] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 bg-black/40 rounded border border-cyan-500/30">
                <span
                  className={`w-1 bg-cyan-400 rounded-sm transition-all duration-300 ${
                    !isMusicMuted ? 'h-3.5 animate-pulse' : 'h-1 opacity-40'
                  }`}
                />
                <span
                  className={`w-1 bg-cyan-300 rounded-sm transition-all duration-500 ${
                    !isMusicMuted ? 'h-2 animate-pulse delay-75' : 'h-1 opacity-40'
                  }`}
                />
                <span
                  className={`w-1 bg-blue-400 rounded-sm transition-all duration-300 ${
                    !isMusicMuted ? 'h-3.5 animate-pulse delay-150' : 'h-1 opacity-40'
                  }`}
                />
                <span
                  className={`w-1 bg-amber-300 rounded-sm transition-all duration-500 ${
                    !isMusicMuted ? 'h-2 animate-pulse delay-100' : 'h-1 opacity-40'
                  }`}
                />
              </div>

              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                {isPlayingVoice
                  ? 'Mensaje de voz activo'
                  : !isMusicMuted
                  ? 'Audio ambiental activo'
                  : 'Audio en pausa'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMusic}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition border ${
                  !isMusicMuted
                    ? 'bg-blue-600/25 border-blue-400/40 text-blue-200 hover:bg-blue-600/35'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'
                }`}
                title={!isMusicMuted ? 'Silenciar música de fondo' : 'Activar música de fondo'}
              >
                <Music className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                <span>{isMusicMuted ? 'Música: Off' : 'Música: On'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleVoice}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                  isPlayingVoice
                    ? 'bg-cyan-400 border-cyan-300 text-gray-950'
                    : 'bg-[#0b1b3e] border-[#25498a] text-cyan-200 hover:text-white'
                }`}
                title={isPlayingVoice ? 'Silenciar locución' : 'Escuchar locución'}
              >
                {isPlayingVoice ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Silenciar</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                    <span>{hasPlayedOnce ? 'Repetir' : 'Escuchar'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReplayCelebration}
                className="p-1.5 rounded-lg bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/40 transition active:scale-95"
                title="Celebrar con confeti"
                aria-label="Celebrar con confeti"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#e3efff] leading-relaxed bg-black/35 p-3 rounded-lg border border-cyan-500/20">
            "{welcomeMessage}"
          </p>
        </div>

        {/* 3-Step Protection Matrix */}
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9db6dd]">
            Cómo protege tu seguridad Vortex ID
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#152a54] rounded-xl overflow-hidden border border-[#1a3366]">
            <div className="p-3 bg-[#060f23] text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-blue-500/15 border border-blue-400/35 text-blue-300 flex items-center justify-center">
                <Camera className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-white">1. Tu Foto Real</h4>
              <p className="text-[11px] text-[#9db6dd] leading-snug">
                Identificación inmediata para médicos y bomberos.
              </p>
            </div>

            <div className="p-3 bg-[#060f23] text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-rose-500/15 border border-rose-400/35 text-rose-300 flex items-center justify-center">
                <HeartPulse className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-white">2. Datos Vitales</h4>
              <p className="text-[11px] text-[#9db6dd] leading-snug">
                Alergias, grupo sanguíneo, medicación y familiares.
              </p>
            </div>

            <div className="p-3 bg-[#060f23] text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 flex items-center justify-center">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-white">3. Tu Llavero</h4>
              <p className="text-[11px] text-[#9db6dd] leading-snug">
                Código QR físico listo para llevar con tus llaves.
              </p>
            </div>
          </div>
        </div>

        {/* Membership Gate Preview Notice when Blocked Mode is active */}
        {!hasMedicalData && systemConfig?.isMembershipRequired && !isMembershipUnlocked && (
          <div className="p-3.5 rounded-xl bg-[#141006] border border-amber-400/70 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-amber-300 uppercase tracking-wide">
                Membresía Comunitaria
              </strong>
              <span className="font-mono font-bold text-amber-200 tabular-nums">
                {formatCurrency(systemConfig.monthlyFee)}/mes
              </span>
            </div>
            <p className="text-amber-100/90 leading-snug">
              Al continuar verás el Alias oficial (<code className="text-cyan-300 font-mono font-bold">{systemConfig.paymentAlias}</code>), envío directo del comprobante por WhatsApp e ingreso del Código de Alta.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:brightness-110 text-gray-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition"
          >
            {(effectiveContext === 'data_saved' || hasMedicalData) && onOpenQrModal ? (
              <>
                <QrCode className="w-5 h-5 text-gray-950" aria-hidden="true" />
                <span>Ver Mi QR y Fondo de Bloqueo</span>
              </>
            ) : (
              <>
                <span>
                  {systemConfig?.isMembershipRequired && !isMembershipUnlocked
                    ? 'Activar Membresía y Cargar mi Ficha'
                    : 'Comenzar a Cargar mi Ficha Médica'}
                </span>
                <ArrowRight className="w-5 h-5 text-gray-950" aria-hidden="true" />
              </>
            )}
          </button>

          {onExplorePharmacies && (
            <button
              type="button"
              onClick={handlePharmacies}
              className="w-full py-2.5 px-3 rounded-xl bg-[#07142b] hover:bg-[#0c1f42] text-cyan-200 text-xs font-bold flex items-center justify-center gap-1.5 transition border border-[#1d3b72]"
            >
              <Stethoscope className="w-4 h-4 text-cyan-300" aria-hidden="true" />
              <span>Ver Farmacias de Turno Ahora en Punta Alta</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
