import React from 'react';
import {
  Clock,
  MapPin,
  QrCode,
  Link2,
  PhoneCall,
  Bell,
  Smartphone,
  Volume2,
  ChevronRight
} from 'lucide-react';

interface MissionControlConsoleProps {
  shiftLabel: string;
  locationLabel?: string;
  onScrollToPharmacy?: () => void;
  onOpenQrModal?: () => void;
  onOpenKeychainModal?: () => void;
  onScrollToEmergencies?: () => void;
  onOpenPushModal?: () => void;
  onOpenInstallModal?: () => void;
  onOpenWelcome?: () => void;
  keychainId?: string;
  hasMedicalData: boolean;
}

export const MissionControlConsole: React.FC<MissionControlConsoleProps> = ({
  shiftLabel,
  locationLabel,
  onScrollToPharmacy,
  onOpenQrModal,
  onOpenKeychainModal,
  onScrollToEmergencies,
  onOpenPushModal,
  onOpenInstallModal,
  onOpenWelcome,
  keychainId,
  hasMedicalData
}) => {
  return (
    <section
      aria-label="Consola de sistemas y guardia activa"
      className="my-3.5 relative rounded-2xl bg-white dark:bg-[#060d20] border border-slate-200 dark:border-[#1a3366] shadow-md dark:shadow-xl overflow-hidden transition-colors duration-200"
    >
      {/* Precision aerospace corner reticles */}
      <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-sky-500/70 dark:border-cyan-400/70 rounded-tl-sm" />
      <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-sky-500/70 dark:border-cyan-400/70 rounded-tr-sm" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-sky-500/70 dark:border-cyan-400/70 rounded-bl-sm" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-sky-500/70 dark:border-cyan-400/70 rounded-br-sm" />

      {/* Top Telemetry Header: Guardia Activa + Section Title */}
      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-[#08132c] border-b border-slate-200 dark:border-[#162d59] flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-heading font-bold tracking-[0.14em] uppercase text-slate-600 dark:text-[#8db4f0]">
          Consola de Módulos · Punta Alta
        </span>

        <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-sky-700 dark:text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold tracking-wide">{shiftLabel}</span>
        </div>
      </div>

      {/* Live Proximity & Duty Telemetry Strip (Unboxed, clickable to jump to radar) */}
      <button
        type="button"
        onClick={onScrollToPharmacy}
        className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-sky-50 dark:bg-[#071128] dark:hover:bg-[#0b1b3e] border-b border-slate-200 dark:border-[#162d59] flex items-center justify-between gap-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        title="Ver radar de ubicación y farmacias de turno"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-[#84a1d1] font-semibold">
              Ubicación y farmacia de guardia más cercana
            </span>
            <span className="block text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 truncate">
              {locationLabel || 'Punta Alta · Turno 24h'}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-sky-700 dark:text-cyan-300 shrink-0 whitespace-nowrap">
          <span>Ver radar</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </button>

      {/* Modular Instrumentation Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-200 dark:bg-[#152a54]">
        {onOpenQrModal && (
          <button
            type="button"
            onClick={onOpenQrModal}
            className="min-h-[64px] p-3 bg-white hover:bg-sky-50 active:bg-sky-100 dark:bg-[#060f23] dark:hover:bg-[#0c1b3b] dark:active:bg-[#10244d] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/35 dark:border-cyan-500/35 flex items-center justify-center shrink-0 mt-0.5">
              <QrCode className="w-4 h-4 text-sky-700 dark:text-cyan-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                Mi QR
              </span>
              <span
                className={`block text-[11px] font-mono tabular-nums mt-0.5 truncate ${
                  hasMedicalData ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-[#8ba6d6]'
                }`}
              >
                {hasMedicalData ? 'Credencial activa' : 'Sin datos'}
              </span>
            </div>
          </button>
        )}

        {onOpenKeychainModal && (
          <button
            type="button"
            onClick={onOpenKeychainModal}
            className="min-h-[64px] p-3 bg-white hover:bg-amber-50 active:bg-amber-100 dark:bg-[#060f23] dark:hover:bg-[#0c1b3b] dark:active:bg-[#10244d] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
            title="Vincular llavero físico numerado"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/10 border border-amber-500/40 dark:border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Link2 className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                {keychainId ? `Llavero #${keychainId}` : 'Vincular Llavero'}
              </span>
              <span className="block text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-200/85 mt-0.5 truncate">
                {keychainId ? 'Enlace activo' : 'Llave física #ID'}
              </span>
            </div>
          </button>
        )}

        {onScrollToEmergencies && (
          <button
            type="button"
            onClick={onScrollToEmergencies}
            aria-label="Ir a teléfonos de emergencia y aviso GPS por WhatsApp"
            className="min-h-[64px] p-3 bg-white hover:bg-rose-50 active:bg-rose-100 dark:bg-[#060f23] dark:hover:bg-[#1a0d18] dark:active:bg-[#241020] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
            title="Llamar al 107 / 911 o enviar ubicación GPS por WhatsApp"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/15 border border-rose-500/45 flex items-center justify-center shrink-0 mt-0.5">
              <PhoneCall className="w-4 h-4 text-rose-700 dark:text-rose-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                Emergencias SOS
              </span>
              <span className="block text-[11px] text-rose-700 dark:text-rose-300/90 mt-0.5 truncate">
                107 · 911 · GPS Familiar
              </span>
            </div>
          </button>
        )}

        {onOpenPushModal && (
          <button
            type="button"
            onClick={onOpenPushModal}
            className="min-h-[64px] p-3 bg-white hover:bg-sky-50 active:bg-sky-100 dark:bg-[#060f23] dark:hover:bg-[#0c1b3b] dark:active:bg-[#10244d] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
            title="Centro de alertas y notificaciones push en tiempo real"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/40 dark:border-sky-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                Alertas Push
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-[#8ba6d6] mt-0.5 truncate">
                Turnos y clima
              </span>
            </div>
          </button>
        )}

        {onOpenInstallModal && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="min-h-[64px] p-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 dark:bg-[#060f23] dark:hover:bg-[#0c1b3b] dark:active:bg-[#10244d] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            title="Ver y descargar el QR Oficial con logo para compartir o instalar la app"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-500/40 dark:border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                Instalar App
              </span>
              <span className="block text-[11px] text-emerald-700 dark:text-emerald-300/90 mt-0.5 truncate">
                QR Oficial · PWA
              </span>
            </div>
          </button>
        )}

        {onOpenWelcome && (
          <button
            type="button"
            onClick={onOpenWelcome}
            className="min-h-[64px] p-3 bg-white hover:bg-blue-50 active:bg-blue-100 dark:bg-[#060f23] dark:hover:bg-[#0c1b3b] dark:active:bg-[#10244d] text-left transition-colors duration-150 flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
            title="Ver bienvenida guiada y locución hablada"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 border border-blue-500/40 dark:border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Volume2 className="w-4 h-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                Bienvenida & Voz
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-[#8ba6d6] mt-0.5 truncate">
                Presentación hablada
              </span>
            </div>
          </button>
        )}
      </div>
    </section>
  );
};
