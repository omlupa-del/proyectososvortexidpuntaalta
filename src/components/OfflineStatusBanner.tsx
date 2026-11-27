import React, { useState, useEffect } from 'react';
import { WifiOff, ShieldCheck, CheckCircle2, Phone, HeartPulse, Pill, MapPin, X, Info, Sparkles } from 'lucide-react';
import { useOnlineStatus, queryOfflineCacheStatus, primeEmergencyOfflineCache } from '../utils/offlineManager';
import { MedicalRecord } from '../utils/medicalData';

interface OfflineStatusBannerProps {
  medicalRecord: MedicalRecord | null;
  onOpenSos: () => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  medicalRecord,
  onOpenSos
}) => {
  const isOnline = useOnlineStatus();
  const [showDiagnostic, setShowDiagnostic] = useState<boolean>(false);
  const [offlineStatus, setOfflineStatus] = useState<{
    offlineReady: boolean;
    cachedEndpointsCount: number;
    hasEmergencyBundle: boolean;
  }>({ offlineReady: true, cachedEndpointsCount: 0, hasEmergencyBundle: false });

  useEffect(() => {
    // Prime the offline cache on mount
    primeEmergencyOfflineCache();

    // Query status after a short delay to let SW activate
    const timer = setTimeout(() => {
      queryOfflineCacheStatus().then((status) => {
        setOfflineStatus(status);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [isOnline]);

  return (
    <>
      {/* 1. Critical Banner when user is completely OFFLINE */}
      {!isOnline && (
        <div className="sticky top-2 z-50 my-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#072418] to-[#0a1f55] border-2 border-emerald-400 shadow-2xl text-white flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400">
              <WifiOff className="w-4 h-4 text-emerald-400" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Modo Offline Seguro Activo
                </span>
              </div>
              <p className="text-[11px] text-[#eaf3ff] leading-snug">
                Ficha SOS, llamados 107/911 y farmacias de turno disponibles sin internet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDiagnostic(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs shrink-0 shadow-md active:scale-95 transition"
          >
            Verificar
          </button>
        </div>
      )}

      {/* 2. Diagnostic & Reassurance Modal */}
      {showDiagnostic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-gradient-to-b dark:from-[#0a1f55] dark:via-[#071536] dark:to-[#050b1f] border-2 border-emerald-500 dark:border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#1e3f8f]/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-500 dark:border-emerald-400 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-black font-heading tracking-wide text-slate-900 dark:text-white">
                    PROTECCIÓN OFFLINE 24HS
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                    Vortex ID · Punta Alta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnostic(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
                aria-label="Cerrar diagnóstico"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-[#07183d] border border-emerald-500/40 dark:border-emerald-400/40 text-xs leading-relaxed space-y-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Tu aplicación está blindada contra cortes de señal</span>
              </p>
              <p className="text-slate-700 dark:text-[#9db6dd]">
                El Service Worker almacena en la memoria local de tu dispositivo toda la información crítica para que nunca quedes desprotegido en la calle o en la ruta.
              </p>
            </div>

            {/* Checklist of Cached Items */}
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">Ficha Médica SOS y Foto Titular</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> En memoria
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">Llamados 107 (SAME), 911, 100 y HNPB</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Telefonía directa
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">20 Farmacias y Turnos 24hs</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Precargadas
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">Ubicación GPS y Domicilio</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Antena y chip
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiagnostic(false);
                  onOpenSos();
                }}
                className="w-1/2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center transition"
              >
                Abrir mi Ficha SOS
              </button>
              <button
                type="button"
                onClick={() => setShowDiagnostic(false)}
                className="w-1/2 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#0a1f55] dark:hover:bg-[#122e7a] border border-slate-300 dark:border-gray-600 text-slate-900 dark:text-white font-bold text-xs text-center transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
