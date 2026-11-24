import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Phone,
  Clock,
  Send,
  X,
  CheckCircle2,
  Users,
  MapPin,
  Flame,
  Radio,
  Lock,
  Power,
  RotateCcw,
  Volume2,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Trash2
} from 'lucide-react';
import {
  UnattendedConfig,
  UnattendedContact,
  UnattendedContactLink,
  getUnattendedConfig,
  saveUnattendedConfig,
  executeUnattendedDispatch,
  unlockEmergencyAudio
} from '../utils/unattendedMode';
import { MedicalRecord } from '../utils/medicalData';
import {
  Coordinates,
  isVerifiedEmergencyCoords,
  getCoordsFreshnessInfo,
  describePuntaAltaLocation,
  isWithinPuntaAltaArea
} from '../utils/geo';
import { playChirp, formatTelUri, launchTelProtocol } from '../utils/callHandler';

interface UnattendedModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
  coords: Coordinates | null;
  onRequestCoords?: () => void;
  onArmedStateChange?: (isArmed: boolean) => void;
  onAutoTriggered?: () => void;
}

export const UnattendedModeModal: React.FC<UnattendedModeModalProps> = ({
  isOpen,
  onClose,
  record,
  coords,
  onRequestCoords,
  onArmedStateChange,
  onAutoTriggered
}) => {
  const [config, setConfig] = useState<UnattendedConfig>(() => getUnattendedConfig(record));
  const [activeTab, setActiveTab] = useState<'instant' | 'timer' | 'config'>('instant');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number | null>(null);
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactLabel, setNewContactLabel] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<{
    contactsNotified: number;
    primaryCalled: string;
    dispatchTime: string;
    contactLinks: UnattendedContactLink[];
    usedCoords: Coordinates | null;
  } | null>(null);

  const dispatchLockRef = useRef<boolean>(false);
  const latestRef = useRef({ record, coords, config, onArmedStateChange, onAutoTriggered });
  latestRef.current = { record, coords, config, onArmedStateChange, onAutoTriggered };

  const executeDispatchNow = async (dialSynchronouslyLaunched = false) => {
    if (dispatchLockRef.current) return;
    dispatchLockRef.current = true;
    setIsDispatching(true);
    try {
      const { record: r, coords: c, config: cfg, onArmedStateChange: onArmed } = latestRef.current;
      const result = await executeUnattendedDispatch(r, c, cfg, { dialSynchronouslyLaunched });
      setDispatchResult(result);
      setConfig((prev) => ({ ...prev, isArmed: false, timerExpiresAt: null, timerMinutes: 0 }));
      setTimerRemainingSeconds(null);
      if (onArmed) onArmed(false);
    } finally {
      dispatchLockRef.current = false;
      setIsDispatching(false);
    }
  };

  // Sync config & refresh GPS when modal opens or record changes
  useEffect(() => {
    if (isOpen) {
      const loaded = getUnattendedConfig(record);
      setConfig(loaded);

      // Refresh GPS if missing, stale (> 20s), or only rough IP
      const isStale =
        !coords?.timestamp ||
        Date.now() - coords.timestamp > 20000 ||
        coords.source === 'ip';
      if ((!isVerifiedEmergencyCoords(coords) || isStale) && onRequestCoords) {
        onRequestCoords();
      }

      // Check if timer was already running
      if (loaded.isArmed && loaded.timerExpiresAt) {
        const diff = Math.max(0, Math.floor((loaded.timerExpiresAt - Date.now()) / 1000));
        setTimerRemainingSeconds(diff);
      } else {
        setTimerRemainingSeconds(null);
      }
    }
  }, [isOpen, record]);

  // Handle active countdown before firing unattended dispatch
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      setCountdown(null);
      executeDispatchNow();
      return;
    }

    playChirp('emergency');
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle Dead Man's Switch timer (Sentinel Mode) even while modal is minimized/closed or after device wake
  useEffect(() => {
    if (!config.isArmed || !config.timerExpiresAt) return;

    const checkExpiration = () => {
      const expiresAt = latestRef.current.config.timerExpiresAt;
      if (!expiresAt) return true;
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimerRemainingSeconds(diff);

      if (diff <= 0) {
        if (latestRef.current.onAutoTriggered) {
          latestRef.current.onAutoTriggered();
        }
        executeDispatchNow();
        return true;
      }
      return false;
    };

    if (checkExpiration()) return;

    const interval = setInterval(() => {
      if (checkExpiration()) {
        clearInterval(interval);
      }
    }, 1000);

    const handleWakeCheck = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };
    document.addEventListener('visibilitychange', handleWakeCheck);
    window.addEventListener('focus', handleWakeCheck);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleWakeCheck);
      window.removeEventListener('focus', handleWakeCheck);
    };
  }, [config.isArmed, config.timerExpiresAt]);

  if (!isOpen) return null;

  const isTravelerOutsidePuntaAlta =
    isVerifiedEmergencyCoords(coords) && !isWithinPuntaAltaArea(coords);
  const enabledContactsCount = config.contacts.filter((c) => c.enabled && c.phone.trim()).length;

  const handleCloseModal = () => {
    setDispatchResult(null);
    onClose();
  };

  const handleStartInstantCountdown = () => {
    if (isDispatching) return;
    unlockEmergencyAudio();
    playChirp('emergency');
    setDispatchResult(null);
    // Refresh live GPS in parallel while countdown ticks
    if (onRequestCoords) onRequestCoords();
    if (config.graceCountdownSeconds <= 0) {
      // Launch tel: synchronously right inside user tap so Android/iOS dialer opens immediately
      launchTelProtocol(config.primaryEmergencyNumber || '911');
      executeDispatchNow(true);
    } else {
      setCountdown(config.graceCountdownSeconds);
    }
  };

  const handleCancelCountdown = () => {
    playChirp('success');
    setCountdown(null);
  };

  const handleArmTimer = (minutes: number) => {
    unlockEmergencyAudio();
    playChirp('emergency');
    setDispatchResult(null);
    const expiresAt = Date.now() + minutes * 60 * 1000;
    const updated: UnattendedConfig = {
      ...config,
      isArmed: true,
      timerMinutes: minutes,
      timerExpiresAt: expiresAt,
      armedAt: new Date().toISOString()
    };
    setConfig(updated);
    saveUnattendedConfig(updated);
    setTimerRemainingSeconds(minutes * 60);
    if (onArmedStateChange) onArmedStateChange(true);
  };

  const handleDisarm = () => {
    playChirp('success');
    const updated: UnattendedConfig = {
      ...config,
      isArmed: false,
      timerMinutes: 0,
      timerExpiresAt: null
    };
    setConfig(updated);
    saveUnattendedConfig(updated);
    setTimerRemainingSeconds(null);
    setCountdown(null);
    if (onArmedStateChange) onArmedStateChange(false);
  };

  const handleToggleContact = (id: string) => {
    const updatedContacts = config.contacts.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    const updated: UnattendedConfig = { ...config, contacts: updatedContacts };
    setConfig(updated);
    saveUnattendedConfig(updated);
  };

  const handleRemoveCustomContact = (id: string) => {
    const updatedContacts = config.contacts.filter((c) => c.id !== id);
    const updated: UnattendedConfig = { ...config, contacts: updatedContacts };
    setConfig(updated);
    saveUnattendedConfig(updated);
    playChirp('click');
  };

  const handleAddCustomContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactPhone.trim()) return;

    const newContact: UnattendedContact = {
      id: `custom-${Date.now()}`,
      label: newContactLabel.trim() || 'Contacto de Auxilio',
      phone: newContactPhone.trim(),
      enabled: true
    };

    const updated: UnattendedConfig = {
      ...config,
      contacts: [...config.contacts, newContact]
    };
    setConfig(updated);
    saveUnattendedConfig(updated);
    setNewContactPhone('');
    setNewContactLabel('');
    playChirp('success');
  };

  const formatTimerDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-[#2a0404] via-[#1a0505] to-[#070b1a] border-2 border-red-500 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-red-950/90 my-auto text-white space-y-4">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-red-900/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-900/80 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/50">
                  {config.isArmed ? 'ESTADO: ARMADO / VIGILANTE' : 'ESTADO: DESARMADO'}
                </span>
                <span className="text-[10px] font-bold text-yellow-300 flex items-center gap-0.5">
                  <Radio className="w-3 h-3 animate-ping" />
                  {isTravelerOutsidePuntaAlta && coords
                    ? `En viaje (${describePuntaAltaLocation(coords)})`
                    : 'Punta Alta'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-wide text-white">
                MODO <span className="text-red-400">DESATENDIDO</span>
              </h2>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition"
            aria-label="Cerrar ventana"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* PROMINENT MANDATORY SAFETY WARNING BANNER */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950 via-[#350707] to-red-950 border-2 border-red-500 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-yellow-300">
            <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider font-heading">
              ADVERTENCIA CRÍTICA SOBRE EL MODO DESATENDIDO
            </h3>
          </div>
          <p className="text-xs text-red-100 leading-relaxed">
            Al activarse, la app prepara tu{' '}
            <span className="text-yellow-200 font-bold underline">
              ubicación GPS exacta y ficha médica para tus contactos (WhatsApp / SMS)
            </span>{' '}
            y abre el marcador al <strong>{config.primaryEmergencyNumber}</strong>. Por seguridad de Android y iPhone,
            siempre deberás confirmar el toque verde en el teléfono (y si usás cuenta regresiva o Centinela, confirmar
            también el botón de llamada y el envío de cada mensaje).
          </p>
        </div>

        {/* ACTIVE COUNTDOWN OVERLAY IF FIRING */}
        {countdown !== null && (
          <div className="p-5 rounded-2xl bg-red-600 border-2 border-white text-center space-y-3 animate-pulse shadow-2xl">
            <span className="text-xs font-black uppercase tracking-widest text-yellow-300">
              🚨 DISPARANDO AUXILIO DESATENDIDO EN:
            </span>
            <div className="text-7xl font-black font-heading tracking-wider tabular-nums text-white">
              {countdown}
            </div>
            <p className="text-xs font-bold text-white/95">
              Marcando al {config.primaryEmergencyNumber} y enviando coordenadas GPS a {config.contacts.filter((c) => c.enabled).length} contactos...
            </p>
            <button
              type="button"
              onClick={handleCancelCountdown}
              className="w-full py-3.5 px-4 rounded-xl bg-white text-red-700 hover:bg-yellow-100 font-black text-sm uppercase tracking-wider shadow-xl active:scale-95 transition"
            >
              🛑 CANCELAR AUXILIO (FALSA ALARMA)
            </button>
          </div>
        )}

        {/* ACTIVE DISPATCHING SPINNER */}
        {isDispatching && (
          <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-yellow-400 text-center space-y-2 animate-pulse">
            <div className="text-sm font-black uppercase text-yellow-300">
              🚨 DESPACHANDO AUXILIO Y OBTENIENDO GPS EXACTO...
            </div>
            <p className="text-xs text-white/90">
              Preparando llamado automático al {config.primaryEmergencyNumber} y mensajes con ubicación.
            </p>
          </div>
        )}

        {/* DISPATCH EXECUTED CONFIRMATION BOX */}
        {dispatchResult && (
          <div className="p-4 rounded-2xl bg-emerald-950 border-2 border-emerald-500 text-center space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-6 h-6" />
              <h4 className="text-sm font-black uppercase">¡PROTOCOLO DESATENDIDO EJECUTADO!</h4>
            </div>
            <p className="text-xs text-emerald-100">
              Se despachó el auxilio a las <strong>{dispatchResult.dispatchTime} hs</strong> hacia el <strong>{dispatchResult.primaryCalled}</strong>.
            </p>
            <a
              href={formatTelUri(dispatchResult.primaryCalled)}
              target="_top"
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg border border-white/40 active:scale-95 transition"
            >
              <Phone className="w-4 h-4" />
              <span>LLAMAR AL {dispatchResult.primaryCalled} AHORA</span>
            </a>
            {dispatchResult.usedCoords ? (
              <div className="text-[11px] text-emerald-200 flex items-center justify-center gap-2 flex-wrap">
                <span>
                  📍 Punto enviado: {dispatchResult.usedCoords.lat.toFixed(5)}, {dispatchResult.usedCoords.lng.toFixed(5)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${dispatchResult.usedCoords.lat},${dispatchResult.usedCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-white inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Ver en Maps</span>
                </a>
              </div>
            ) : (
              <p className="text-[11px] text-amber-300">
                ⚠️ Se envió sin coordenadas GPS (señal/permiso no disponible al disparar).
              </p>
            )}
            {dispatchResult.contactLinks.length > 0 && (
              <div className="pt-2 border-t border-emerald-500/30 space-y-1.5 text-left">
                <span className="block text-[11px] font-bold text-emerald-200 uppercase">
                  Enviar aviso por WhatsApp o SMS con GPS a tus contactos (1 toque):
                </span>
                {dispatchResult.contactLinks.map((cl) => (
                  <div
                    key={cl.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-emerald-500/30 text-xs"
                  >
                    <div className="min-w-0">
                      <strong className="text-white block truncate">{cl.label}</strong>
                      <span className="text-[11px] text-emerald-200/80 font-mono">{cl.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={cl.waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={cl.smsUrl}
                        className="py-1.5 px-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>SMS</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE SENTINEL TIMER RUNNING INDICATOR */}
        {config.isArmed && timerRemainingSeconds !== null && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950 to-orange-950 border-2 border-orange-500 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-orange-300">
              <Clock className="w-5 h-5 animate-spin" />
              <span className="text-xs font-black uppercase tracking-wider">
                TEMPORIZADOR CENTINELA ACTIVO
              </span>
            </div>
            <div className="text-5xl font-black font-mono text-white tracking-widest">
              {formatTimerDisplay(timerRemainingSeconds)}
            </div>
            <p className="text-xs text-orange-200">
              Si no desactivás el modo antes de que el reloj llegue a 00:00, se ejecutará el auxilio automático al {config.primaryEmergencyNumber}.
            </p>
            <button
              type="button"
              onClick={handleDisarm}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-gray-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition"
            >
              ✅ LLEGUE BIEN / DESACTIVAR CENTINELA
            </button>
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="flex rounded-xl bg-black/50 p-1 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('instant')}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'instant'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Pánico Inmediato</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'timer'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Centinela (Temporizador)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-[#0d2252] text-cyan-300 border border-cyan-400 shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Destinatarios ({config.contacts.filter((c) => c.enabled).length})</span>
          </button>
        </div>

        {/* TAB 1: INSTANT PANIC MODE */}
        {activeTab === 'instant' && countdown === null && !isDispatching && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#07122c] border border-red-500/50 space-y-2">
              <span className="text-xs font-black uppercase text-red-300 block">
                Disparo de Emergencia Sin Espera
              </span>
              <p className="text-xs text-[#9db6dd] leading-relaxed">
                Ideal ante una emergencia repentina en vía pública o descompensación. Al pulsar el botón, contará {config.graceCountdownSeconds} segundos de seguridad con sonido de sirena y conectará inmediatamente con el <strong>{config.primaryEmergencyNumber}</strong>.
              </p>
              {enabledContactsCount === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  className="w-full text-left text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 rounded-xl px-3 py-2 hover:bg-amber-900/50 transition"
                >
                  ⚠️ No tenés contactos habilitados para enviar WhatsApp/SMS con GPS. Tocá acá para agregar o activar destinatarios →
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartInstantCountdown}
              disabled={isDispatching}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-2xl shadow-red-950/80 active:scale-95 transition border-2 border-white/60 animate-sos-pulse"
            >
              <ShieldAlert className="w-6 h-6 animate-bounce" />
              <span>🚨 ACTIVAR AUXILIO DESATENDIDO AHORA</span>
            </button>
          </div>
        )}

        {/* TAB 2: SENTINEL TIMER (DEAD MAN'S SWITCH) */}
        {activeTab === 'timer' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#07122c] border border-orange-500/50 space-y-2">
              <span className="text-xs font-black uppercase text-orange-300 block">
                Modo Centinela: ¿Vas de regreso a casa?
              </span>
              <p className="text-xs text-[#9db6dd] leading-relaxed">
                Activá un temporizador de seguridad. Si sufrís una agresión, pérdida de conciencia o no podés responder a tiempo, el sistema se dispara automáticamente.
              </p>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleArmTimer(mins)}
                    className="py-2.5 px-2 rounded-xl bg-orange-950/80 hover:bg-orange-900 border border-orange-500 text-orange-200 font-bold text-xs text-center transition active:scale-95 shadow"
                  >
                    ⏱️ {mins} min
                  </button>
                ))}
              </div>
            </div>

            {config.isArmed && (
              <button
                type="button"
                onClick={handleDisarm}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition"
              >
                ✅ Desarmar / Desactivar Centinela
              </button>
            )}
          </div>
        )}

        {/* TAB 3: CONTACTS & NUMBER CONFIGURATION */}
        {activeTab === 'config' && (
          <div className="space-y-3">
            {/* Primary number selector */}
            <div className="p-3 rounded-2xl bg-[#07122c] border border-white/10 space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                Número principal a marcar automáticamente:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { num: '911', label: '911 · Policía y Emergencias' },
                  { num: '107', label: '107 · SAME y Ambulancia' },
                  { num: '100', label: isTravelerOutsidePuntaAlta ? '100 · Bomberos' : '100 · Bomberos Punta Alta' },
                  { num: '103', label: '103 · Defensa Civil' }
                ].map((item) => (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => {
                      const updated: UnattendedConfig = {
                        ...config,
                        primaryEmergencyNumber: item.num,
                        primaryEmergencyLabel: item.label
                      };
                      setConfig(updated);
                      saveUnattendedConfig(updated);
                      playChirp('click');
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-left transition ${
                      config.primaryEmergencyNumber === item.num
                        ? 'bg-red-600 text-white border-white shadow-md'
                        : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grace Countdown Selector */}
            <div className="p-3 rounded-2xl bg-[#07122c] border border-white/10 space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                Cuenta regresiva de seguridad antes de marcar:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 3, 5, 10].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => {
                      const updated: UnattendedConfig = {
                        ...config,
                        graceCountdownSeconds: secs
                      };
                      setConfig(updated);
                      saveUnattendedConfig(updated);
                      playChirp('click');
                    }}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition ${
                      config.graceCountdownSeconds === secs
                        ? 'bg-orange-600 text-white border-white shadow-md'
                        : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {secs === 0 ? 'Inmediato (0s)' : `${secs} seg`}
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Contacts Checklist */}
            <div className="p-3 rounded-2xl bg-[#07122c] border border-white/10 space-y-2">
              <span className="block text-xs font-bold text-white uppercase tracking-wider">
                Contactos que recibirán el mensaje con ubicación GPS:
              </span>

              {config.contacts.length === 0 ? (
                <p className="text-xs text-amber-300 italic">
                  No hay teléfonos registrados aún en tu ficha médica. Agregá un número abajo para que reciba tu alerta.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {config.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/10 text-xs hover:bg-white/5 transition gap-2"
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={contact.enabled}
                          onChange={() => handleToggleContact(contact.id)}
                          className="w-4 h-4 accent-red-500 rounded cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <strong className="text-white block truncate">{contact.label}</strong>
                          <span className="text-[11px] text-[#9db6dd] font-mono">{contact.phone}</span>
                        </div>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            contact.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-gray-700/40 text-gray-400'
                          }`}
                        >
                          {contact.enabled ? 'Activo' : 'Pausado'}
                        </span>
                        {contact.id.startsWith('custom-') && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomContact(contact.id)}
                            className="p-1 rounded-lg bg-red-950/60 hover:bg-red-800 text-red-300 transition"
                            title="Eliminar contacto personalizado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add custom phone form */}
              <form onSubmit={handleAddCustomContact} className="pt-2 flex gap-1.5">
                <input
                  type="text"
                  placeholder="Parentesco / Nombre"
                  value={newContactLabel}
                  onChange={(e) => setNewContactLabel(e.target.value)}
                  className="w-1/3 py-1.5 px-2.5 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <input
                  type="tel"
                  placeholder="Número de celular"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  className="py-1.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 transition"
                >
                  Agregar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Live GPS Verification & Diagnostic Footer */}
        <div className="pt-2 border-t border-red-900/40 space-y-2 text-xs text-[#9db6dd]">
          {isVerifiedEmergencyCoords(coords) ? (() => {
            const freshness = getCoordsFreshnessInfo(coords);
            return (
              <div className={`p-2.5 rounded-xl flex items-center justify-between gap-2 flex-wrap border ${
                freshness.isStale
                  ? 'bg-amber-950/60 border-amber-500/60'
                  : 'bg-emerald-950/60 border-emerald-500/50'
              }`}>
                <div className="min-w-0">
                  <div className={`font-bold flex items-center gap-1.5 ${freshness.isStale ? 'text-amber-300' : 'text-emerald-300'}`}>
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${freshness.isStale ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span>
                      {freshness.isStale ? 'GPS anterior' : 'GPS real activo'} ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                      {freshness.accuracyMeters ? ` · ±${freshness.accuracyMeters}m` : ''}
                      {freshness.ageLabel ? ` · ${freshness.ageLabel}` : ''})
                    </span>
                  </div>
                  <span className={`text-[11px] block ${freshness.isStale ? 'text-amber-200/80' : 'text-emerald-200/80'}`}>
                    Referencia: {describePuntaAltaLocation(coords)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Corroborar en Maps</span>
                </a>
                {onRequestCoords && (
                  <button
                    type="button"
                    onClick={() => {
                      playChirp('click');
                      onRequestCoords();
                    }}
                    className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-emerald-300 border border-emerald-500/40"
                    title="Actualizar GPS ahora"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            );
          })() : (
            <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] text-amber-200 leading-snug">
                <strong className="text-amber-300 block">⚠️ GPS sin señal o permiso denegado</strong>
                Activá la ubicación del navegador/celular para enviar tu punto exacto si hay emergencia.
              </div>
              {onRequestCoords && (
                <button
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    onRequestCoords();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] shrink-0 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Activar GPS</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
