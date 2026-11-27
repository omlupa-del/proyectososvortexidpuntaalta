import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellRing,
  AlertTriangle,
  Pill,
  Ambulance,
  CloudRain,
  ShieldCheck,
  CheckCircle2,
  Send,
  Sparkles,
  Phone,
  ExternalLink,
  Volume2
} from 'lucide-react';
import {
  getPushPermissionState,
  requestPushPermission,
  getPushPreferences,
  savePushPreferences,
  getPushHistory,
  triggerPushNotification,
  PushAlert,
  PushPreferences
} from '../utils/pushNotifications';
import { playChirp, triggerDirectCall } from '../utils/callHandler';

interface PushAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPharmacySection?: () => void;
}

export const PushAlertsModal: React.FC<PushAlertsModalProps> = ({
  isOpen,
  onClose,
  onOpenPharmacySection
}) => {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [prefs, setPrefs] = useState<PushPreferences>(getPushPreferences());
  const [alerts, setAlerts] = useState<PushAlert[]>([]);
  const [testing, setTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPermission(getPushPermissionState());
      setPrefs(getPushPreferences());
      setAlerts(getPushHistory());

      // Fetch latest alerts from server
      fetch('/api/push/history')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.alerts) && data.alerts.length > 0) {
            setAlerts((prev) => {
              const ids = new Set(data.alerts.map((a: PushAlert) => a.id));
              const combined = [...data.alerts, ...prev.filter((p) => !ids.has(p.id))];
              return combined.slice(0, 30);
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    playChirp('click');
    const granted = await requestPushPermission();
    setPermission(getPushPermissionState());
    if (granted) {
      playChirp('success');
      setFeedback('✔ ¡Notificaciones activadas! Tu celular recibirá alertas críticas.');
      setTimeout(() => setFeedback(''), 4000);

      // Trigger a welcome notification
      await triggerPushNotification({
        type: 'general',
        title: '🔔 Vortex ID Activado',
        body: 'Notificaciones push habilitadas para emergencias y farmacias de turno en Punta Alta.'
      });
      setAlerts(getPushHistory());
    } else {
      setFeedback('Permiso no concedido. Podés habilitarlo desde el candado de la barra del navegador.');
    }
  };

  const handleTogglePref = (key: keyof PushPreferences) => {
    playChirp('click');
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePushPreferences(updated);
  };

  const handleSendTestAlert = async (type: 'emergency' | 'pharmacy' | 'weather') => {
    setTesting(true);
    playChirp('click');

    try {
      if (type === 'emergency') {
        await triggerPushNotification({
          type: 'emergency',
          title: '🚨 ALERTA SOS · PRUEBA DE AUXILIO',
          body: 'Se activó una prueba de aviso de rescate en Punta Alta. Vía directa con el SAME 107.',
          urgent: true
        });
      } else if (type === 'pharmacy') {
        await triggerPushNotification({
          type: 'pharmacy',
          title: '💊 Farmacia de Turno en Punta Alta',
          body: 'Guardia activa: Farmacia del Pueblo (Paso 498) atendiendo las 24hs hoy.',
          urgent: false
        });
      } else {
        await triggerPushNotification({
          type: 'weather',
          title: '⚠️ ALERTA METEOROLÓGICA · SMN CORONEL ROSALES',
          body: 'Ráfagas de viento costero de 65 km/h. Defensa Civil (103) y Bomberos (100) en guardia preventiva.',
          urgent: false
        });
      }
      playChirp('success');
      setAlerts(getPushHistory());
      setFeedback('✔ Notificación enviada. Verificá la barra superior de tu celular.');
      setTimeout(() => setFeedback(''), 4000);
    } catch {
      setFeedback('Error al enviar alerta.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-white dark:from-[#0a1f55] via-sky-50/70 dark:via-[#071536] to-slate-50 dark:to-[#050b1f] border-2 border-sky-500 dark:border-[#37c8ff] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-blue-950/90 my-auto text-slate-900 dark:text-white space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-300 dark:border-[#1e3f8f]/70 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-[#37c8ff] text-white shadow-lg shadow-blue-900/50">
              <BellRing className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-wide text-slate-900 dark:text-white">
                ALERTAS PUSH Y NOTIFICACIONES
              </h2>
              <p className="text-xs text-sky-700 dark:text-[#37c8ff] font-bold uppercase tracking-wider">
                Vortex ID · Punta Alta 24hs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white transition"
            aria-label="Cerrar panel de alertas"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {feedback && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center animate-fade-in flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Permission Status Box */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#07122c] border border-blue-400 dark:border-[#1e5bff]/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-gray-300">
                Estado de Notificaciones:
              </span>
            </div>
            {permission === 'granted' ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Activadas ✓</span>
              </span>
            ) : permission === 'denied' ? (
              <span className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-950 border border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5 shadow">
                <AlertTriangle className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                <span>Bloqueadas</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow">
                <Bell className="w-3.5 h-3.5 text-amber-700 dark:text-yellow-300" />
                <span>Pendiente</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-[#9db6dd] leading-relaxed">
            Recibí avisos sonoros instantáneos directamente en tu celular sobre <strong>emergencias de salud</strong>, <strong>farmacias de turno</strong> que entran de guardia y <strong>alertas meteorológicas</strong> en Punta Alta.
          </p>

          {permission !== 'granted' && (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:opacity-95 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-900/60 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <BellRing className="w-4 h-4 animate-bounce" />
              <span>Activar Notificaciones Push Ahora</span>
            </button>
          )}
        </div>

        {/* Canales de Alerta (Preferences Switches) */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-[#37c8ff] mb-1">
            Canales de Alerta Automática
          </h3>

          <div className="space-y-2 text-xs">
            {/* Emergencias */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#07122c] border border-red-300 dark:border-red-500/30 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-600/30 text-red-400 border border-red-500">
                  <Ambulance className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-slate-900 dark:text-white block font-bold">Emergencias Médicas SOS</strong>
                  <span className="text-[11px] text-slate-600 dark:text-gray-400">Rescate y asistencia SAME 107 con vibración</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.emergencyAlerts}
                onChange={() => handleTogglePref('emergencyAlerts')}
                className="w-4 h-4 accent-red-500 rounded cursor-pointer"
              />
            </label>

            {/* Farmacias de turno */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#07122c] border border-sky-300 dark:border-cyan-500/30 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-cyan-600/30 text-cyan-400 border border-cyan-500">
                  <Pill className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-slate-900 dark:text-white block font-bold">Cambio de Farmacias de Turno</strong>
                  <span className="text-[11px] text-slate-600 dark:text-gray-400">Aviso diario de guardia a las 08:30 hs</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.pharmacyAlerts}
                onChange={() => handleTogglePref('pharmacyAlerts')}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </label>

            {/* Alertas climáticas */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#07122c] border border-amber-300 dark:border-amber-500/30 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-600/30 text-amber-400 border border-amber-500">
                  <CloudRain className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-slate-900 dark:text-white block font-bold">Alertas Meteorológicas SMN</strong>
                  <span className="text-[11px] text-slate-600 dark:text-gray-400">Viento, temporal y recomendaciones</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.weatherAlerts}
                onChange={() => handleTogglePref('weatherAlerts')}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Botones de Prueba Rápida en Vivo */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-white dark:from-[#0d2a6e] to-slate-50 dark:to-[#0a1838] border border-[#37c8ff]/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-sky-700 dark:text-[#37c8ff]" />
              <span>Probar en tu Celular (Test Push)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={() => handleSendTestAlert('emergency')}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
            >
              <Ambulance className="w-3.5 h-3.5" />
              <span>Probar SOS</span>
            </button>

            <button
              type="button"
              disabled={testing}
              onClick={() => handleSendTestAlert('pharmacy')}
              className="py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-[#0b1d46] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-sky-400 dark:border-cyan-400 text-sky-700 dark:text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Probar Farmacia</span>
            </button>

            <button
              type="button"
              disabled={testing}
              onClick={() => handleSendTestAlert('weather')}
              className="py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/80 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-400 dark:border-amber-400 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>Probar Alerta Clima</span>
            </button>
          </div>
        </div>

        {/* Historial de Alertas Recibidas */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-[#9db6dd]">
            Historial de Alertas Recientes ({alerts.length})
          </h4>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-gray-400 text-center py-3">No hay alertas en el historial.</p>
            ) : (
              alerts.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${
                    item.type === 'emergency'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-500/70 text-red-800 dark:text-red-100'
                      : item.type === 'pharmacy'
                      ? 'bg-sky-50 dark:bg-cyan-950/40 border-sky-300 dark:border-cyan-500/70 text-sky-800 dark:text-cyan-100'
                      : 'bg-white dark:bg-[#07122c] border-slate-300 dark:border-[#1e3f8f] text-slate-700 dark:text-gray-200'
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5">
                    {item.type === 'emergency' ? '🚨' : item.type === 'pharmacy' ? '💊' : '⚠️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <strong className="font-bold text-slate-900 dark:text-white block truncate">{item.title}</strong>
                      <span className="text-[10px] text-slate-600 dark:text-gray-400 font-mono shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug mt-0.5 text-slate-700 dark:text-gray-200">{item.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Botón de Cierre */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white dark:bg-[#0a1838] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-slate-300 dark:border-gray-600 text-slate-900 dark:text-white font-bold text-xs active:scale-95 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
