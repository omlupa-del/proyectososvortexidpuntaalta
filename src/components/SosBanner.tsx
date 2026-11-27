import React from 'react';
import { HeartPulse, Volume2, VolumeX, MapPin, Phone } from 'lucide-react';
import { triggerDirectCall } from '../utils/callHandler';

interface SosBannerProps {
  onOpenSos: () => void;
  onToggleSpeakPharmacies?: () => void;
  isSpeakingPharmacies?: boolean;
  closestDutySummary?: string;
  spokenSubtitle?: string;
  onScrollToPharmacies?: () => void;
  hasMedicalData: boolean;
  name?: string;
}

export const SosBanner: React.FC<SosBannerProps> = ({
  onOpenSos,
  onToggleSpeakPharmacies,
  isSpeakingPharmacies = false,
  closestDutySummary,
  spokenSubtitle,
  onScrollToPharmacies,
  hasMedicalData,
  name
}) => {
  return (
    <section aria-label="Acceso prioritario de emergencia" className="pt-3 pb-1 space-y-2.5">
      {/* 1. Primary Orbital Alert Card: FICHA DE EMERGENCIA / SOS */}
      <button
        type="button"
        onClick={onOpenSos}
        aria-label={
          hasMedicalData && name
            ? `Abrir Ficha de Emergencia SOS de ${name}`
            : 'Abrir Ficha de Emergencia SOS para cargar tus datos'
        }
        className="w-full relative group overflow-hidden rounded-2xl py-5 px-4 sm:py-6 sm:px-6 bg-gradient-to-b from-[#d81d30] via-[#b81224] to-[#870a18] text-white shadow-xl shadow-red-950/60 border border-red-300/70 active:scale-[0.99] transition-transform duration-150 animate-sos-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {/* NASA Telemetry Corner Reticles */}
        <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-white/85" />
        <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-white/85" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-white/85" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-white/85" />

        <div className="flex flex-col items-center justify-center text-center gap-2">
          <span className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-red-100/90">
            Prioridad 01 · Auxilio Médico
          </span>

          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
            <HeartPulse className="w-6 h-6 sm:w-8 sm:h-8 text-white shrink-0" aria-hidden="true" />
            <span className="text-[1.45rem] min-[380px]:text-[1.7rem] sm:text-4xl font-black font-heading tracking-[0.06em] uppercase leading-none drop-shadow whitespace-nowrap">
              FICHA DE EMERGENCIA
            </span>
          </div>

          <div className="flex items-center justify-center">
            <span className="px-5 py-0.5 rounded-lg bg-black/30 border border-white/60 text-2xl sm:text-3xl font-black font-heading tracking-[0.28em] text-white leading-tight">
              SOS
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-white/95 max-w-md leading-snug">
            {hasMedicalData && name
              ? `Titular: ${name} · Tocá para ver y avisar`
              : 'Ficha médica vacía · Tocá para cargar tu foto y datos de auxilio'}
          </p>
        </div>
      </button>

      {/* 2. Dual Tactical Dispatch Triggers: 107 AMBULANCIA | 911 POLICÍA */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => triggerDirectCall('107', '107 · Ambulancia y Hospital', 'emergency')}
          aria-label="Llamar al 107 Ambulancia y Hospital"
          className="relative min-h-[60px] px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-[#051a14] dark:hover:bg-[#082820] active:scale-[0.98] border border-emerald-500/70 dark:border-emerald-500/65 text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span aria-hidden="true" className="pointer-events-none absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-emerald-600/70 dark:border-emerald-400/70" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-emerald-600/70 dark:border-emerald-400/70" />

          <div className="min-w-0">
            <span className="block font-mono tabular-nums text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-none">
              107
            </span>
            <span className="block text-xs sm:text-sm font-heading font-bold tracking-wider text-emerald-950 dark:text-emerald-100 uppercase mt-1 truncate">
              AMBULANCIA
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-600/40 dark:border-emerald-400/40 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => triggerDirectCall('911', '911 · Policía y Emergencias', 'emergency')}
          aria-label="Llamar al 911 Policía y Emergencias"
          className="relative min-h-[60px] px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-[#1a070f] dark:hover:bg-[#270b17] active:scale-[0.98] border border-rose-500/70 dark:border-rose-500/65 text-left transition-all duration-150 flex items-center justify-between gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <span aria-hidden="true" className="pointer-events-none absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-rose-600/70 dark:border-rose-400/70" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-rose-600/70 dark:border-rose-400/70" />

          <div className="min-w-0">
            <span className="block font-mono tabular-nums text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-400 leading-none">
              911
            </span>
            <span className="block text-xs sm:text-sm font-heading font-bold tracking-wider text-rose-950 dark:text-rose-100 uppercase mt-1 truncate">
              POLICÍA
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/15 border border-rose-600/40 dark:border-rose-400/40 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-rose-700 dark:text-rose-300" aria-hidden="true" />
          </div>
        </button>
      </div>

      {/* 3. Audio Telemetry Bar: ESCUCHAR FARMACIAS DE TURNO (+ Ver) */}
      {onToggleSpeakPharmacies && (
        <div className="space-y-1.5">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={onToggleSpeakPharmacies}
              aria-label={
                isSpeakingPharmacies
                  ? 'Detener locución de farmacias de turno'
                  : 'Escuchar por voz las farmacias de turno de hoy'
              }
              className={`flex-1 min-w-0 min-h-[54px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-between gap-2.5 transition-all duration-150 active:scale-[0.99] border shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isSpeakingPharmacies
                  ? 'bg-red-700 hover:bg-red-600 border-red-300 text-white'
                  : 'bg-white hover:bg-sky-50 dark:bg-[#07142b] dark:hover:bg-[#0b1e40] border-sky-400/70 dark:border-cyan-500/50 text-slate-900 dark:text-cyan-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    isSpeakingPharmacies
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-sky-500/10 border-sky-500/40 dark:border-cyan-400/45 text-sky-700 dark:text-cyan-300'
                  }`}
                >
                  {isSpeakingPharmacies ? (
                    <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className={`block font-heading uppercase tracking-wider leading-tight text-sm sm:text-base ${
                      isSpeakingPharmacies ? 'text-white' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {isSpeakingPharmacies
                      ? 'DETENER VOZ · FARMACIAS'
                      : 'ESCUCHAR FARMACIAS DE TURNO'}
                  </span>
                  {closestDutySummary && (
                    <span
                      className={`block text-[11px] font-mono font-medium truncate mt-0.5 ${
                        isSpeakingPharmacies
                          ? 'text-red-100'
                          : 'text-sky-700 dark:text-cyan-300/90'
                      }`}
                    >
                      {closestDutySummary}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase shrink-0 border ${
                  isSpeakingPharmacies
                    ? 'bg-black/35 border-white/30 text-white'
                    : 'bg-sky-500/15 dark:bg-cyan-400/15 border-sky-500/50 dark:border-cyan-400/50 text-sky-800 dark:text-cyan-200'
                }`}
              >
                {isSpeakingPharmacies ? 'Sonando' : 'Voz'}
              </span>
            </button>

            {onScrollToPharmacies && (
              <button
                type="button"
                onClick={onScrollToPharmacies}
                aria-label="Ir a ver todas las farmacias de turno"
                className="min-w-[54px] px-3 py-2 rounded-xl bg-white hover:bg-sky-50 dark:bg-[#07142b] dark:hover:bg-[#0b1e40] border border-sky-400/70 dark:border-cyan-500/45 text-sky-800 dark:text-cyan-200 hover:text-slate-950 dark:hover:text-white text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 shadow-xs transition-colors duration-150 active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                title="Ver farmacias de turno en pantalla"
              >
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Ver</span>
              </button>
            )}
          </div>

          {isSpeakingPharmacies && spokenSubtitle && (
            <div className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-[#06142e] border border-sky-400/60 dark:border-cyan-400/40 text-[11px] text-emerald-900 dark:text-emerald-200 leading-snug">
              <strong className="text-sky-700 dark:text-cyan-300">Locución activa:</strong> {spokenSubtitle}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
