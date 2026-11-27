import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Heart,
  ShieldCheck,
  UserPlus,
  Pill,
  Smartphone,
  PartyPopper,
  Play,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { playChirp } from '../utils/callHandler';

interface WelcomeExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRegistration: () => void;
  onViewPharmacies?: () => void;
  onOpenInstallModal?: () => void;
}

export const WelcomeExperienceModal: React.FC<WelcomeExperienceModalProps> = ({
  isOpen,
  onClose,
  onStartRegistration,
  onViewPharmacies,
  onOpenInstallModal
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [speechAvailable, setSpeechAvailable] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Trigger festive confetti cannons on open
  const fireConfetti = () => {
    try {
      // Cannon from left
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.7 },
        colors: ['#00f0ff', '#37c8ff', '#ffd700', '#10b981', '#ffffff']
      });

      // Cannon from right
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.7 },
        colors: ['#00f0ff', '#37c8ff', '#ffd700', '#ec4899', '#ffffff']
      });

      // Center burst
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 100,
          origin: { x: 0.5, y: 0.5 },
          colors: ['#00f0ff', '#ffd700', '#38bdf8']
        });
      }, 250);
    } catch {
      // Canvas confetti fallback
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fireConfetti();
      playChirp('success');

      // Prepare speech greeting
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear any previous

        const text =
          '¡Te damos la bienvenida a Vortex ID Punta Alta! Un proyecto pensado con el corazón para cuidar tu vida y la de tus seres queridos ante cualquier emergencia o accidente. Ya podés cargar tu ficha médica de auxilio y tener siempre a mano las farmacias de turno de Coronel Rosales. ¡Te acompañamos en cada momento!';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-AR';
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Try to pick the best Spanish voice available
        const setBestVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const spanishVoice =
            voices.find((v) => v.lang === 'es-AR') ||
            voices.find((v) => v.lang.startsWith('es-')) ||
            voices.find((v) => v.lang.startsWith('es'));
          if (spanishVoice) {
            utterance.voice = spanishVoice;
          }
        };

        setBestVoice();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = setBestVoice;
        }

        utterance.onend = () => {
          setIsPlayingAudio(false);
        };
        utterance.onerror = () => {
          setIsPlayingAudio(false);
        };

        utteranceRef.current = utterance;
      }
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  const handleToggleVoice = () => {
    if (!speechAvailable || !utteranceRef.current) return;
    playChirp('click');

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utteranceRef.current);
      setIsPlayingAudio(true);
    }
  };

  const handleStartNow = () => {
    playChirp('success');
    fireConfetti();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
    onStartRegistration();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-white dark:from-[#0a205a] via-sky-50/70 dark:via-[#071638] to-slate-50 dark:to-[#04091a] border-2 border-sky-500 dark:border-[#00f0ff] rounded-3xl p-5 sm:p-7 shadow-2xl shadow-cyan-950/90 my-auto text-slate-900 dark:text-white space-y-4 relative overflow-hidden">
        {/* Glow ambient background circles */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-sky-100 dark:bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-100 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white transition z-10"
          aria-label="Cerrar bienvenida"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Top Header Badge */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 border border-cyan-400/50 shadow-inner">
            <PartyPopper className="w-4 h-4 text-amber-700 dark:text-amber-300 animate-bounce" />
            <span className="text-xs font-black tracking-widest text-sky-700 dark:text-cyan-300 uppercase">
              ¡Bienvenido a Vortex ID!
            </span>
            <Sparkles className="w-4 h-4 text-sky-700 dark:text-cyan-300" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-wide text-slate-900 dark:text-white leading-tight">
            Cuidando tu vida en <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-200">Punta Alta</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9db6dd] leading-snug max-w-md mx-auto">
            Un proyecto diseñado con vocación y tecnología para que ante cualquier accidente o urgencia, la asistencia sea inmediata.
          </p>
        </div>

        {/* Voice Greeting Audio Banner */}
        {speechAvailable && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 dark:from-cyan-950/80 via-sky-50/70 dark:via-[#07244d] to-blue-50 dark:to-blue-950/80 border border-sky-300 dark:border-cyan-400/60 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-3 rounded-xl flex items-center justify-center transition shadow-md active:scale-95 ${
                  isPlayingAudio
                    ? 'bg-amber-400 text-gray-950 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black'
                }`}
                title={isPlayingAudio ? 'Pausar saludo' : 'Escuchar saludo hablado'}
              >
                {isPlayingAudio ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Mensaje de Bienvenida Hablado</span>
                  {isPlayingAudio && (
                    <span className="flex gap-0.5 items-end h-3">
                      <span className="w-1 bg-cyan-400 animate-[bounce_0.6s_infinite] h-2" />
                      <span className="w-1 bg-cyan-400 animate-[bounce_0.6s_infinite_0.2s] h-3" />
                      <span className="w-1 bg-cyan-400 animate-[bounce_0.6s_infinite_0.4s] h-1.5" />
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-sky-800 dark:text-cyan-200">
                  {isPlayingAudio
                    ? 'Reproduciendo saludo en español...'
                    : 'Tocá el parlante para escuchar la bienvenida hablada.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleVoice}
              className="text-xs font-bold text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white underline shrink-0 px-2 py-1"
            >
              {isPlayingAudio ? 'Silenciar' : 'Escuchar'}
            </button>
          </div>
        )}

        {/* 3 Pillars of Protection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
          <div className="p-3 rounded-2xl bg-white dark:bg-[#071330]/90 border border-slate-300 dark:border-[#1e4594] space-y-1">
            <div className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
              <Heart className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white">Ficha Médica SOS</h3>
            <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] leading-snug">
              Tu grupo sanguíneo, alergias, medicación y contactos clave en el llavero.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#071330]/90 border border-slate-300 dark:border-[#1e4594] space-y-1">
            <div className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 flex items-center justify-center border border-cyan-500/40">
              <Pill className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white">Farmacias 24hs</h3>
            <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] leading-snug">
              Turnos oficiales de Coronel Rosales en tiempo real y a qué distancia están.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[#071330]/90 border border-slate-300 dark:border-[#1e4594] space-y-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white">100% Offline</h3>
            <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] leading-snug">
              Funciona sin internet ni datos ante emergencias o cortes en la vía pública.
            </p>
          </div>
        </div>

        {/* Big Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleStartNow}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-gray-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/80 active:scale-95 transition"
          >
            <UserPlus className="w-5 h-5 text-gray-950" />
            <span>✍️ Cargar mi Ficha Médica y Foto Ahora</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {onViewPharmacies && (
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  onClose();
                  onViewPharmacies();
                }}
                className="py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-[#0b1c44] hover:bg-sky-100 dark:hover:bg-[#122b68] border border-slate-300 dark:border-[#1e4594] text-xs font-bold text-sky-800 dark:text-cyan-200 flex items-center justify-center gap-1.5 transition"
              >
                <Pill className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400" />
                <span>Ver Farmacias</span>
              </button>
            )}

            {onOpenInstallModal && (
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  onClose();
                  onOpenInstallModal();
                }}
                className="py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-[#0b1c44] hover:bg-sky-100 dark:hover:bg-[#122b68] border border-slate-300 dark:border-[#1e4594] text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5 transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>Instalar App</span>
              </button>
            )}
          </div>

          {/* Confetti button */}
          <button
            type="button"
            onClick={() => {
              playChirp('success');
              fireConfetti();
            }}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5 transition border border-amber-300 dark:border-amber-400/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span>🎊 ¡Tirar más confeti de bienvenida!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
