import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Power, Clock, PhoneCall } from 'lucide-react';
import {
  UnattendedConfig,
  getUnattendedConfig,
  saveUnattendedConfig
} from '../utils/unattendedMode';
import { playChirp } from '../utils/callHandler';

interface UnattendedModeStatusBarProps {
  onOpenModal: () => void;
}

export const UnattendedModeStatusBar: React.FC<UnattendedModeStatusBarProps> = ({ onOpenModal }) => {
  const [config, setConfig] = useState<UnattendedConfig>(() => getUnattendedConfig());
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const syncNow = () => {
      const current = getUnattendedConfig();
      setConfig(current);
      if (current.isArmed && current.timerExpiresAt) {
        const diff = Math.max(0, Math.floor((current.timerExpiresAt - Date.now()) / 1000));
        setRemainingSeconds(diff);
      } else {
        setRemainingSeconds(null);
      }
    };

    const handleConfigChange = (e: Event) => {
      const custom = e as CustomEvent<UnattendedConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
        if (custom.detail.isArmed && custom.detail.timerExpiresAt) {
          setRemainingSeconds(Math.max(0, Math.floor((custom.detail.timerExpiresAt - Date.now()) / 1000)));
        } else {
          setRemainingSeconds(null);
        }
      } else {
        syncNow();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };

    window.addEventListener('vortex_unattended_config_changed', handleConfigChange);
    document.addEventListener('visibilitychange', handleVisibility);

    syncNow();
    const interval = setInterval(syncNow, 1000);

    return () => {
      window.removeEventListener('vortex_unattended_config_changed', handleConfigChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  if (!config.isArmed) return null;

  const handleQuickDisarm = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChirp('success');
    const updated: UnattendedConfig = {
      ...config,
      isArmed: false,
      timerExpiresAt: null,
      timerMinutes: 0
    };
    setConfig(updated);
    saveUnattendedConfig(updated);
    setRemainingSeconds(null);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <aside
      aria-label="Estado activo del Modo Desatendido"
      className="sticky top-2 z-50 my-2 px-3 sm:px-4"
    >
      <div
        onClick={onOpenModal}
        className="w-full p-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-700 to-red-600 text-white shadow-2xl border-2 border-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 cursor-pointer hover:brightness-110 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white text-red-600 flex items-center justify-center font-black shrink-0 shadow">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                🛡️ MODO DESATENDIDO ACTIVO
              </span>
              {remainingSeconds !== null && (
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-white text-[11px] font-mono font-bold border border-yellow-300/40">
                  ⏳ {formatTimer(remainingSeconds)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/95 leading-tight">
              Destino automático: <strong>{config.primaryEmergencyNumber}</strong> · Sin confirmación al vencer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleQuickDisarm}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white text-red-700 hover:bg-yellow-100 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            <Power className="w-4 h-4" />
            <span>DESACTIVAR AHORA</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
