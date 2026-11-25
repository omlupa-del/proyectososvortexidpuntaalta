import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Users,
  Copy,
  Check,
  Send,
  Globe,
  Calendar,
  Eye,
  EyeOff,
  HelpCircle,
  ArrowLeft,
  Activity,
  Terminal,
  Server,
  Database,
  Cpu,
  Satellite,
  Trash2,
  Download,
  Search,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { ColegioDutyImporterModal } from './ColegioDutyImporterModal';
import {
  SystemConfig,
  getStoredSystemConfig,
  fetchSystemConfig,
  saveSystemConfig,
  verifyAdminPin,
  recoverAdminPin,
  formatCurrency,
  hashActivationCode,
  getCachedAdminActivationCode,
  setCachedAdminActivationCode,
  clearMembershipUnlockLocally,
  DEFAULT_ACTIVATION_CODE
} from '../utils/systemConfig';
import { triggerPushNotification, PushAlertType } from '../utils/pushNotifications';
import { playChirp } from '../utils/callHandler';
import { setAdminWeatherOverride } from '../utils/weatherService';
import { getDutyPharmaciesForDate, PUNTA_ALTA_PHARMACIES } from '../data/puntaAltaData';
import { useAuth } from '../context/AuthContext';
import {
  SystemLogEntry,
  SystemTelemetrySnapshot,
  ServiceHealthState,
  getSystemLogs,
  logSystemEvent,
  clearSystemLogs,
  formatLogsAsText,
  probeAllServices
} from '../utils/systemTelemetry';
import { SubscribersManagerPanel } from './SubscribersManagerPanel';
import { loadSubscribers, isSubscriberOverdue } from '../utils/subscribersService';

interface SystemControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: SystemConfig) => void;
  onUnlocked?: () => void;
}

type MissionModuleTab = 'telemetria' | 'suscriptores' | 'membresia' | 'operaciones' | 'push';
type LogFilterScope = 'all' | 'errors' | 'gps' | 'sync' | 'api';

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getStatusVisual(status: ServiceHealthState): {
  glyph: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'nominal':
      return {
        glyph: '●',
        textClass: 'text-emerald-400',
        borderClass: 'border-[#1C2A45]'
      };
    case 'degraded':
    case 'unconfigured':
      return {
        glyph: '▲',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/40'
      };
    case 'error':
    case 'offline':
      return {
        glyph: '✖',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/50'
      };
    default:
      return {
        glyph: '◌',
        textClass: 'text-cyan-400',
        borderClass: 'border-[#1C2A45]'
      };
  }
}

export const SystemControlModal: React.FC<SystemControlModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onUnlocked
}) => {
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const [config, setConfig] = useState<SystemConfig>(getStoredSystemConfig());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [activeModule, setActiveModule] = useState<MissionModuleTab>('telemetria');
  const [verifiedAdminPin, setVerifiedAdminPin] = useState<string>('');
  const [pendingAdminPin, setPendingAdminPin] = useState<string>('');
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [keychainCount, setKeychainCount] = useState<number>(1);
  const [copiedAlias, setCopiedAlias] = useState<boolean>(false);
  const [copiedWhatsAppReply, setCopiedWhatsAppReply] = useState<boolean>(false);
  const [activationCodeInput, setActivationCodeInput] = useState<string>(() => getCachedAdminActivationCode());
  const [isDutyImporterOpen, setIsDutyImporterOpen] = useState<boolean>(false);

  // PIN visibility & recovery state
  const [showUnlockPin, setShowUnlockPin] = useState<boolean>(false);
  const [showConfigPin, setShowConfigPin] = useState<boolean>(false);
  const [showRecoveryMode, setShowRecoveryMode] = useState<boolean>(false);
  const [recoveryIdentity, setRecoveryIdentity] = useState<string>('');
  const [recoveryNewPin, setRecoveryNewPin] = useState<string>('');
  const [showRecoveryPin, setShowRecoveryPin] = useState<boolean>(false);
  const [recovering, setRecovering] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState<string>('');

  // Push notification broadcast state
  const [pushTitle, setPushTitle] = useState<string>('ALERTA SOS · ACCIDENTE EN VÍA PÚBLICA');
  const [pushBody, setPushBody] = useState<string>('Se requiere presencia y paso prioritario para ambulancia SAME 107.');
  const [pushType, setPushType] = useState<PushAlertType>('emergency');
  const [broadcastingPush, setBroadcastingPush] = useState<boolean>(false);
  const [pushBroadcastMsg, setPushBroadcastMsg] = useState<string>('');

  // NASA Mission Control Telemetry & Logs state
  const [clockText, setClockText] = useState<string>(() =>
    new Date().toLocaleTimeString('es-AR', { hour12: false })
  );
  const [telemetry, setTelemetry] = useState<SystemTelemetrySnapshot | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [autoProbe, setAutoProbe] = useState<boolean>(true);
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getSystemLogs());
  const [logFilter, setLogFilter] = useState<LogFilterScope>('all');
  const [logSearch, setLogSearch] = useState<string>('');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [testingGps, setTestingGps] = useState<boolean>(false);
  const [subscriberCounts, setSubscriberCounts] = useState<{ total: number; overdue: number }>({
    total: 0,
    overdue: 0
  });
  const mainViewportRef = useRef<HTMLDivElement>(null);

  const handleSubscriberCountsChange = useCallback((total: number, overdue: number) => {
    setSubscriberCounts((prev) =>
      prev.total === total && prev.overdue === overdue ? prev : { total, overdue }
    );
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      mainViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeModule, isUnlocked]);

  const runTelemetryProbe = useCallback(async (force = false) => {
    setProbing(true);
    try {
      const snap = await probeAllServices(force);
      setTelemetry(snap);
      if (snap.backendKeychains !== null) {
        setKeychainCount(snap.backendKeychains);
      }
    } finally {
      setProbing(false);
    }
  }, []);

  // Live mission clock & auto telemetry probe while unlocked
  useEffect(() => {
    if (!isOpen) return;

    const clockInterval = setInterval(() => {
      setClockText(new Date().toLocaleTimeString('es-AR', { hour12: false }));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isUnlocked) return;

    runTelemetryProbe(false);
    setLogs(getSystemLogs());
    loadSubscribers(verifiedAdminPin)
      .then((res) => {
        const overdue = res.subscribers.filter((s) => isSubscriberOverdue(s)).length;
        setSubscriberCounts({ total: res.subscribers.length, overdue });
      })
      .catch(() => {});

    const handleLogAdded = () => setLogs(getSystemLogs());
    const handleLogsCleared = () => setLogs([]);
    window.addEventListener('vortex_system_log_added', handleLogAdded);
    window.addEventListener('vortex_system_logs_cleared', handleLogsCleared);

    let probeTimer: ReturnType<typeof setInterval> | undefined;
    if (autoProbe) {
      probeTimer = setInterval(() => {
        runTelemetryProbe(false);
      }, 15000);
    }

    return () => {
      window.removeEventListener('vortex_system_log_added', handleLogAdded);
      window.removeEventListener('vortex_system_logs_cleared', handleLogsCleared);
      if (probeTimer) clearInterval(probeTimer);
    };
  }, [isOpen, isUnlocked, autoProbe, runTelemetryProbe, verifiedAdminPin]);

  useEffect(() => {
    if (isOpen) {
      fetchSystemConfig().then((cfg) => {
        setConfig(cfg);
      });

      fetch('/api/records/all')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.count === 'number') {
            setKeychainCount(data.count || 1);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const errorLogCount = useMemo(
    () => logs.filter((l) => l.level === 'error').length,
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((entry) => {
      if (logFilter === 'errors' && entry.level === 'info') return false;
      if (logFilter === 'gps' && entry.category !== 'gps') return false;
      if (logFilter === 'sync' && entry.category !== 'sync' && entry.category !== 'firestore') {
        return false;
      }
      if (
        logFilter === 'api' &&
        entry.category !== 'api' &&
        entry.category !== 'gemini' &&
        entry.category !== 'firestore'
      ) {
        return false;
      }
      if (q) {
        const hay = `${entry.source} ${entry.category} ${entry.message} ${entry.detail || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, logFilter, logSearch]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setPinInput('');
    setPinError('');
    setVerifiedAdminPin('');
    setPendingAdminPin('');
    setShowUnlockPin(false);
    setShowConfigPin(false);
    setShowRecoveryMode(false);
    setRecoveryIdentity('');
    setRecoveryNewPin('');
    setShowRecoveryPin(false);
    setRecoveryError('');
    setRecoverySuccess('');
    setSuccessMessage('');
    setSaveError('');
    setIsUnlocked(false);
    onClose();
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!cleaned) {
      setPinError('Ingresá tu clave PIN de administrador.');
      return;
    }

    setVerifyingPin(true);
    setPinError('');
    try {
      const result = await verifyAdminPin(cleaned);
      if (result.valid) {
        setVerifiedAdminPin(cleaned);
        setPendingAdminPin(cleaned);
        setIsUnlocked(true);
        setPinInput('');
        setShowUnlockPin(false);
        playChirp('success');
        logSystemEvent({
          level: 'info',
          category: 'auth',
          source: 'Control de Misión',
          message: `Acceso concedido al panel (${isAdmin ? user?.email : 'PIN maestro'})`
        });
        onUnlocked?.();
      } else {
        setPinError(
          result.error || 'PIN incorrecto. Tocá el ojo para verificar lo que escribiste o usá "¿Olvidaste tu clave?".'
        );
        logSystemEvent({
          level: 'warn',
          category: 'auth',
          source: 'Control de Misión',
          message: 'Intento fallido de acceso con PIN administrativo'
        });
        playChirp('click');
      }
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleRecoverPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    const cleanIdentity = recoveryIdentity.trim().toLowerCase();
    const verifiedAdminEmail = isAdmin ? (user?.email || 'omlupa@gmail.com') : null;
    if (!cleanIdentity && !verifiedAdminEmail) {
      setRecoveryError('Ingresá tu correo/WhatsApp de administrador o conectate con Google Admin.');
      return;
    }

    setRecovering(true);
    playChirp('click');

    try {
      const res = await recoverAdminPin({
        identity: recoveryIdentity.trim(),
        newPin: recoveryNewPin.trim(),
        verifiedAdminEmail
      });

      if (!res.ok || !res.config) {
        setRecoveryError(res.error || 'No se pudo verificar la identidad del administrador.');
        return;
      }

      const nextPin = String(res.adminPin || '1234');
      setConfig(res.config);
      if (onConfigSaved) onConfigSaved(res.config);
      playChirp('success');
      setRecoverySuccess(`Clave PIN restablecida correctamente a: ${nextPin}. Ingresando al panel…`);

      setTimeout(() => {
        setVerifiedAdminPin(nextPin);
        setPendingAdminPin(nextPin);
        setShowRecoveryMode(false);
        setRecoveryIdentity('');
        setRecoveryNewPin('');
        setRecoverySuccess('');
        setIsUnlocked(true);
        onUnlocked?.();
      }, 1100);
    } catch {
      setRecoveryError('Sin conexión con el servidor. Intentá verificando con Google Admin.');
    } finally {
      setRecovering(false);
    }
  };

  const handleChange = (field: keyof SystemConfig, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleQuickFeeSelect = (amount: number) => {
    playChirp('click');
    setConfig((prev) => ({
      ...prev,
      monthlyFee: amount
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSuccessMessage('');
    playChirp('click');

    const cleanedPendingPin = pendingAdminPin.trim();
    if (cleanedPendingPin && cleanedPendingPin.length < 4) {
      setSaveError('La clave PIN de administrador debe tener al menos 4 caracteres.');
      setSaving(false);
      return;
    }

    try {
      const nextPin = cleanedPendingPin || verifiedAdminPin || '1234';
      const cleanedActivation = (activationCodeInput || DEFAULT_ACTIVATION_CODE).trim().toUpperCase();
      setCachedAdminActivationCode(cleanedActivation);
      const activationHash = await hashActivationCode(cleanedActivation);

      const result = await saveSystemConfig(
        {
          ...config,
          activationCodeHash: activationHash,
          newAdminPin: nextPin
        },
        verifiedAdminPin
      );
      setConfig(result.config);
      if (onConfigSaved) onConfigSaved(result.config);

      if (result.ok) {
        setVerifiedAdminPin(nextPin);
        setPendingAdminPin(nextPin);
        if (result.syncedToCloud) {
          setSuccessMessage('Configuración guardada y sincronizada en Firestore para todos los dispositivos.');
        } else {
          setSuccessMessage(
            result.error
              ? `Guardado localmente. ${result.error}`
              : 'Configuración guardada en este servidor.'
          );
        }
        playChirp('success');
        runTelemetryProbe(false);
      } else {
        setSaveError(result.error || 'No se pudo sincronizar con el servidor.');
      }
    } catch {
      setSaveError('Error al guardar en el servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcastPush = async () => {
    if (!pushTitle.trim()) return;
    setBroadcastingPush(true);
    playChirp('click');
    try {
      await triggerPushNotification({
        type: pushType,
        title: pushTitle.trim(),
        body: pushBody.trim() || 'Aviso de Vortex ID Punta Alta',
        urgent: pushType === 'emergency',
        adminPin: verifiedAdminPin
      });

      if (pushType === 'weather') {
        setAdminWeatherOverride({
          alertLevel: 'naranja',
          alertTitle: pushTitle.trim(),
          alertDetail: pushBody.trim(),
          source: 'Comunicado Oficial Defensa Civil Coronel Rosales'
        });
      }

      logSystemEvent({
        level: 'info',
        category: 'api',
        source: 'Difusión Push',
        message: `Alerta transmitida (${pushType}): ${pushTitle.trim()}`
      });

      playChirp('success');
      setPushBroadcastMsg('Alerta transmitida correctamente a los dispositivos suscriptos.');
      setTimeout(() => setPushBroadcastMsg(''), 4500);
    } catch {
      logSystemEvent({
        level: 'error',
        category: 'api',
        source: 'Difusión Push',
        message: 'Error al transmitir alerta push a la red'
      });
      setPushBroadcastMsg('Error al transmitir alerta.');
    } finally {
      setBroadcastingPush(false);
    }
  };

  const handleResetWeatherToLive = () => {
    playChirp('click');
    setAdminWeatherOverride(null);
    setPushBroadcastMsg('Clima restablecido a detección meteorológica en vivo (Open-Meteo / SMN).');
    setTimeout(() => setPushBroadcastMsg(''), 4500);
  };

  const handleCopyAlias = () => {
    playChirp('click');
    navigator.clipboard.writeText(config.paymentAlias || 'vortex.id.auxilio');
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const handleCopyWhatsAppReply = () => {
    playChirp('click');
    const codeToShare = (activationCodeInput || DEFAULT_ACTIVATION_CODE).trim().toUpperCase();
    const msg =
      `¡Hola! Recibimos y verificamos tu comprobante de Membresía Vortex ID ✅\n\n` +
      `🔑 Tu *Código de Alta* es: *${codeToShare}*\n\n` +
      `Ingresalo en la app (en el Paso 3) para desbloquear la carga de tu foto, grupo sanguíneo, alergias y descargar tu QR personal para pantalla bloqueada.`;
    navigator.clipboard.writeText(msg);
    setCopiedWhatsAppReply(true);
    setTimeout(() => setCopiedWhatsAppReply(false), 2500);
  };

  const handleRunGpsDiagnostic = () => {
    if (!('geolocation' in navigator)) {
      logSystemEvent({
        level: 'error',
        category: 'gps',
        source: 'Diagnóstico GPS',
        message: 'API navigator.geolocation no disponible en este navegador'
      });
      return;
    }
    setTestingGps(true);
    playChirp('click');
    const start = performance.now();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ms = Math.round(performance.now() - start);
        const acc = Math.round(pos.coords.accuracy || 0);
        logSystemEvent({
          level: 'info',
          category: 'gps',
          source: 'Diagnóstico GPS',
          message: `Fijación GPS verificada en ${ms} ms (precisión ±${acc} m)`,
          detail: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        });
        setTestingGps(false);
        runTelemetryProbe(false);
      },
      (err) => {
        logSystemEvent({
          level: 'error',
          category: 'gps',
          source: 'Diagnóstico GPS',
          message: `Fallo en prueba manual de GPS (código ${err.code})`,
          detail: err.message
        });
        setTestingGps(false);
        runTelemetryProbe(false);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  const handleExportLogs = () => {
    const content = formatLogsAsText(logs);
    const blob = new Blob([content || 'Sin eventos registrados.\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vortex_id_logs_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playChirp('click');
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(formatLogsAsText(filteredLogs));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const firestoreNode = telemetry?.nodes.find((n) => n.id === 'firestore');
  const geminiNode = telemetry?.nodes.find((n) => n.id === 'gemini');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#03050A]/90 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Control de Misión · Vortex ID"
    >
      {/* LOCKED AUTH GATE OR RECOVERY VIEW */}
      {!isUnlocked ? (
        <div className="w-full max-w-md bg-[#060911] border border-[#1C2A45] rounded-2xl shadow-2xl my-auto text-slate-100 overflow-hidden">
          <div className="px-5 py-3.5 bg-[#090E1A] border-b border-[#1C2A45] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold font-heading tracking-wide text-white truncate">
                Control de Misión · Vortex ID
              </h2>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                Acceso administrativo restringido
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar panel de control"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            {!showRecoveryMode ? (
              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Verificación de Operador</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ingresá el PIN maestro para abrir telemetría de servidores, consola de errores, cuotas de membresía y difusión comunitaria.
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    PIN de Administrador {!config.hasCustomPin ? '(Por defecto: 1234)' : ''}
                  </label>
                  <div className="relative">
                    <input
                      type={showUnlockPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        if (pinError) setPinError('');
                      }}
                      placeholder="••••"
                      className="w-full py-2.5 pl-11 pr-11 rounded-lg bg-[#0B111E] border border-[#1C2A45] text-lg text-white font-mono tracking-widest text-center focus:outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPin((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-cyan-300 transition-colors"
                      aria-label={showUnlockPin ? 'Ocultar clave' : 'Visualizar clave'}
                    >
                      {showUnlockPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pinError && <p className="text-xs text-rose-400 font-medium mt-1.5">{pinError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={verifyingPin}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{verifyingPin ? 'Verificando PIN…' : 'Desbloquear Control de Misión'}</span>
                </button>

                <div className="pt-1 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      playChirp('click');
                      setPinError('');
                      setShowRecoveryMode(true);
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 underline underline-offset-4 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>¿Olvidaste tu clave? Recuperar o restablecer PIN</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRecoverPin} className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>Recuperar Clave de Administrador</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryMode(false);
                      setRecoveryError('');
                      setRecoverySuccess('');
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Verificá tu identidad con Google Admin o con tu correo/WhatsApp registrado para definir un nuevo PIN (vacío restablece a <code className="text-amber-400">1234</code>).
                </p>

                <div className="p-3 rounded-lg bg-[#0B111E] border border-[#1C2A45] flex items-center justify-between gap-2 flex-wrap">
                  {isAdmin ? (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Google Admin verificado ({user?.email})</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-300">
                        Verificación rápida con Google Admin:
                      </span>
                      <button
                        type="button"
                        onClick={() => signInWithGoogle()}
                        className="px-3 py-1.5 rounded-md bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shrink-0"
                      >
                        Verificar Google Admin
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Correo de administrador o WhatsApp registrado
                  </label>
                  <input
                    type="text"
                    value={recoveryIdentity}
                    onChange={(e) => {
                      setRecoveryIdentity(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    placeholder={isAdmin ? (user?.email || 'omlupa@gmail.com') : 'Ej: tu@correo.com o 2932420000'}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#0B111E] border border-[#1C2A45] text-sm text-white focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nueva Clave PIN (4 a 8 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showRecoveryPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      value={recoveryNewPin}
                      onChange={(e) => {
                        setRecoveryNewPin(e.target.value);
                        if (recoveryError) setRecoveryError('');
                      }}
                      placeholder="Vacío = restablecer a 1234"
                      className="w-full py-2.5 pl-3 pr-10 rounded-lg bg-[#0B111E] border border-[#1C2A45] text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPin((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-cyan-300"
                      aria-label={showRecoveryPin ? 'Ocultar nueva clave' : 'Ver nueva clave'}
                    >
                      {showRecoveryPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {recoveryError && (
                  <p className="text-xs text-rose-400 font-medium bg-rose-950/40 border border-rose-500/40 rounded-lg p-2.5">
                    {recoveryError}
                  </p>
                )}

                {recoverySuccess && (
                  <p className="text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5">
                    {recoverySuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={recovering}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{recovering ? 'Verificando identidad…' : 'Restablecer Clave y Entrar'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* UNLOCKED: MODULAR NASA MISSION CONTROL WORKSPACE */
        <form
          onSubmit={handleSave}
          className="w-full max-w-5xl bg-[#060911] border border-[#1C2A45] rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* 1. Top Telemetry Ribbon */}
          <div className="px-4 py-2.5 bg-[#090E1A] border-b border-[#1C2A45] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Activity className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                <h2 className="text-base sm:text-lg font-bold font-heading tracking-wide text-white whitespace-nowrap">
                  Control de Misión · Vortex ID
                </h2>
                <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                  Punta Alta · {clockText}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => runTelemetryProbe(true)}
                disabled={probing}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-[#1C2A45] text-xs font-medium text-cyan-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
                <span>{probing ? 'Sondeando…' : 'Sondear API'}</span>
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
                aria-label="Cerrar panel de control"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. Asymmetric Split Console */}
          <div className="grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[248px_1fr] flex-1 min-h-0 overflow-hidden">
            {/* Left Modular Navigation & Live Instrument Readout */}
            <aside className="bg-[#080D18] border-b lg:border-b-0 lg:border-r border-[#1C2A45] p-3 lg:p-4 flex flex-col justify-between gap-4 shrink-0 max-h-[38vh] lg:max-h-none overflow-y-auto">
              <nav
                aria-label="Módulos del Control de Misión"
                className="flex flex-wrap lg:flex-col gap-1.5"
              >
                {[
                  { id: 'telemetria' as MissionModuleTab, label: 'Telemetría y Logs', icon: Terminal },
                  { id: 'suscriptores' as MissionModuleTab, label: 'Base de Suscriptores', icon: Users },
                  { id: 'membresia' as MissionModuleTab, label: 'Membresía y Alias', icon: CreditCard },
                  { id: 'operaciones' as MissionModuleTab, label: 'Turnos y Sponsors', icon: SlidersHorizontal },
                  { id: 'push' as MissionModuleTab, label: 'Difusión Push', icon: Radio }
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        playChirp('click');
                        setActiveModule(item.id);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-cyan-500/15 border border-cyan-400/50 text-cyan-200'
                          : 'border border-transparent text-slate-400 hover:text-white hover:bg-[#0E1627]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'telemetria' && errorLogCount > 0 && (
                        <span className="font-mono tabular-nums text-[11px] text-rose-400 font-bold">
                          {errorLogCount}
                        </span>
                      )}
                      {item.id === 'suscriptores' && subscriberCounts.overdue > 0 && (
                        <span className="font-mono tabular-nums text-[11px] text-amber-400 font-bold">
                          {subscriberCounts.overdue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Desktop Live Parameter Readouts (Unboxed Tabular Discipline) */}
              <div className="hidden lg:block pt-3 border-t border-[#1C2A45] space-y-2.5 text-xs">
                <div className="text-[11px] font-medium text-slate-400">
                  Resumen de Instrumentos
                </div>

                <div className="space-y-2 font-mono tabular-nums">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Firestore</span>
                    <span className={firestoreNode ? getStatusVisual(firestoreNode.status).textClass : 'text-slate-400'}>
                      {firestoreNode
                        ? `${getStatusVisual(firestoreNode.status).glyph} ${firestoreNode.latencyMs !== null ? `${firestoreNode.latencyMs} ms` : firestoreNode.statusLabel}`
                        : '◌ —'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Gemini API</span>
                    <span className={geminiNode ? getStatusVisual(geminiNode.status).textClass : 'text-slate-400'}>
                      {geminiNode
                        ? `${getStatusVisual(geminiNode.status).glyph} ${geminiNode.latencyMs !== null ? `${geminiNode.latencyMs} ms` : geminiNode.statusLabel}`
                        : '◌ —'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Registro</span>
                    <span className={config.isMembershipRequired ? 'text-rose-400' : 'text-emerald-400'}>
                      {config.isMembershipRequired ? 'Bloqueo ON' : 'Prueba libre'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Cuota</span>
                    <span className="text-white">{formatCurrency(config.monthlyFee)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Suscriptores</span>
                    <span className="text-cyan-300">
                      {subscriberCounts.total}
                      {subscriberCounts.overdue > 0 ? ` (${subscriberCounts.overdue} debe)` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Llaveros</span>
                    <span className="text-cyan-300">{keychainCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Errores Log</span>
                    <span className={errorLogCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      {errorLogCount}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Viewport Stage */}
            <div
              ref={mainViewportRef}
              className="h-full min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 bg-[#060911]"
            >
              {/* MODULE 1: TELEMETRÍA EN VIVO & CONSOLA DE LOGS */}
              {activeModule === 'telemetria' && (
                <div className="space-y-5">
                  {/* Live Server Telemetry Strip (scoped to Telemetría so other modules jump straight to top) */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {(telemetry?.nodes || [
                      {
                        id: 'firestore' as const,
                        name: 'Firebase Firestore',
                        status: 'checking' as ServiceHealthState,
                        statusLabel: 'Verificando…',
                        latencyMs: null,
                        detail: 'Midiendo enlace con base en la nube…',
                        endpoint: 'systemSettings/public',
                        checkedAt: ''
                      },
                      {
                        id: 'gemini' as const,
                        name: 'Google Gemini API',
                        status: 'checking' as ServiceHealthState,
                        statusLabel: 'Verificando…',
                        latencyMs: null,
                        detail: 'Consultando estado de endpoint…',
                        endpoint: 'generativelanguage.googleapis.com',
                        checkedAt: ''
                      },
                      {
                        id: 'backend' as const,
                        name: 'API Backend Express',
                        status: 'checking' as ServiceHealthState,
                        statusLabel: 'Verificando…',
                        latencyMs: null,
                        detail: 'Sondeando /api/telemetry/status…',
                        endpoint: '/api/telemetry/status',
                        checkedAt: ''
                      },
                      {
                        id: 'gps_sw' as const,
                        name: 'GPS & Caché Offline',
                        status: 'checking' as ServiceHealthState,
                        statusLabel: 'Verificando…',
                        latencyMs: null,
                        detail: 'Evaluando sensores y Service Worker…',
                        endpoint: 'navigator.geolocation',
                        checkedAt: ''
                      }
                    ]).map((node) => {
                      const vis = getStatusVisual(node.status);
                      const NodeIcon =
                        node.id === 'firestore'
                          ? Database
                          : node.id === 'gemini'
                            ? Cpu
                            : node.id === 'backend'
                              ? Server
                              : Satellite;
                      return (
                        <div
                          key={node.id}
                          className={`p-3.5 rounded-xl bg-[#0B111E] border ${vis.borderClass} flex flex-col justify-between gap-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-400 truncate">
                              {node.name}
                            </span>
                            <NodeIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-xs font-semibold ${vis.textClass} truncate`}>
                              {vis.glyph} {node.statusLabel}
                            </span>
                            <span className="text-lg font-mono tabular-nums font-bold text-white whitespace-nowrap">
                              {node.latencyMs !== null
                                ? node.id === 'gps_sw'
                                  ? `±${node.latencyMs}m`
                                  : `${node.latencyMs} ms`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Detailed API & Cloud Diagnostics Table */}
                  <section className="rounded-xl bg-[#0B111E] border border-[#1C2A45] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1C2A45] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Estado en Tiempo Real · Servidores y APIs
                        </h3>
                        <p className="text-xs text-slate-400">
                          Medición directa de latencia y conectividad hacia Firestore, Gemini API, Backend y GPS
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoProbe}
                            onChange={(e) => setAutoProbe(e.target.checked)}
                            className="accent-cyan-400 rounded"
                          />
                          <span>Auto-sondeo 15s</span>
                        </label>
                        {telemetry?.backendUptimeSec !== null && telemetry?.backendUptimeSec !== undefined && (
                          <span className="font-mono tabular-nums text-slate-400">
                            Uptime {formatUptime(telemetry.backendUptimeSec)}
                            {telemetry.backendMemoryMb ? ` · ${telemetry.backendMemoryMb} MB` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-[#1C2A45]">
                      {(telemetry?.nodes || []).map((node) => {
                        const vis = getStatusVisual(node.status);
                        return (
                          <div
                            key={node.id}
                            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-[#0E1627]/60 transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-white">{node.name}</span>
                                <span className="text-slate-500">·</span>
                                <span className="font-mono text-[11px] text-slate-400 truncate">
                                  {node.endpoint}
                                </span>
                              </div>
                              <p className="text-slate-400 leading-snug">{node.detail}</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
                              <span className={`font-semibold ${vis.textClass}`}>
                                {vis.glyph} {node.statusLabel}
                              </span>
                              <span className="text-slate-200 w-16 text-right">
                                {node.latencyMs !== null
                                  ? node.id === 'gps_sw'
                                    ? `±${node.latencyMs} m`
                                    : `${node.latencyMs} ms`
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* System Event Log Console */}
                  <section className="rounded-xl bg-[#0B111E] border border-[#1C2A45] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1C2A45] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Consola de Logs de Eventos del Sistema
                        </h3>
                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                          {logs.length} registros · {errorLogCount} errores capturados
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleRunGpsDiagnostic}
                          disabled={testingGps}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-[#1C2A45] text-xs font-medium text-cyan-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Satellite className="w-3.5 h-3.5" />
                          <span>{testingGps ? 'Probando GPS…' : 'Probar GPS'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyLogs}
                          disabled={filteredLogs.length === 0}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-[#1C2A45] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                        >
                          {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLogs ? 'Copiado' : 'Copiar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportLogs}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-[#1C2A45] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Exportar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearSystemLogs();
                            playChirp('click');
                          }}
                          disabled={logs.length === 0}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#0E1627] hover:bg-rose-950/60 border border-[#1C2A45] hover:border-rose-500/40 text-xs font-medium text-rose-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Limpiar</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="px-4 py-2.5 bg-[#080D18] border-b border-[#1C2A45] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1 p-1 bg-[#05080F] border border-[#1C2A45] rounded-lg overflow-x-auto">
                        {[
                          { id: 'all' as LogFilterScope, label: 'Todos' },
                          { id: 'errors' as LogFilterScope, label: 'Errores y Avisos' },
                          { id: 'gps' as LogFilterScope, label: 'GPS' },
                          { id: 'sync' as LogFilterScope, label: 'Sincronización' },
                          { id: 'api' as LogFilterScope, label: 'API / Nube' }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setLogFilter(tab.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              logFilter === tab.id
                                ? 'bg-cyan-500/20 text-cyan-200'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          placeholder="Buscar evento o módulo…"
                          className="w-full py-1.5 pl-8 pr-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Terminal Log Feed */}
                    <div className="bg-[#05080F] max-h-72 overflow-y-auto divide-y divide-[#131C30] font-mono text-xs">
                      {filteredLogs.length === 0 ? (
                        <div className="p-6 text-center space-y-2">
                          <p className="text-slate-400">
                            Sin eventos registrados para este filtro. El sistema opera en estado nominal.
                          </p>
                          <button
                            type="button"
                            onClick={() => runTelemetryProbe(true)}
                            className="px-3 py-1.5 rounded-lg bg-[#0B111E] border border-[#1C2A45] text-cyan-300 hover:text-white text-xs font-sans font-medium transition-colors"
                          >
                            Ejecutar sondeo completo ahora
                          </button>
                        </div>
                      ) : (
                        filteredLogs.map((entry) => {
                          const timeStr = new Date(entry.timestamp).toLocaleTimeString('es-AR', {
                            hour12: false
                          });
                          const lvlStyle =
                            entry.level === 'error'
                              ? 'text-rose-400'
                              : entry.level === 'warn'
                                ? 'text-amber-400'
                                : 'text-emerald-400';
                          const lvlText =
                            entry.level === 'error'
                              ? 'ERROR'
                              : entry.level === 'warn'
                                ? 'AVISO'
                                : 'INFO ';

                          return (
                            <div
                              key={entry.id}
                              className="px-3.5 py-2.5 hover:bg-[#0A101E] transition-colors flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3"
                            >
                              <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                <span className="text-slate-500">{timeStr}</span>
                                <span className={`font-bold ${lvlStyle}`}>{lvlText}</span>
                                <span className="text-cyan-400">{entry.source}</span>
                              </div>
                              <div className="min-w-0 flex-1 font-sans">
                                <span className="text-slate-200">{entry.message}</span>
                                {entry.detail && (
                                  <span className="block font-mono text-[11px] text-slate-400 break-all mt-0.5">
                                    {entry.detail}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* MODULE 2: BASE DE DATOS DE SUSCRIPTORES Y COBROS */}
              {activeModule === 'suscriptores' && (
                <SubscribersManagerPanel
                  systemConfig={config}
                  adminPin={verifiedAdminPin}
                  activationCodeInput={activationCodeInput}
                  isAdmin={isAdmin}
                  onSignInGoogle={() => signInWithGoogle()}
                  onCountsChange={handleSubscriberCountsChange}
                />
              )}

              {/* MODULE 3: MEMBRESÍA, TARIFAS Y DATOS DE COBRO */}
              {activeModule === 'membresia' && (
                <div className="space-y-4">
                  {/* Modo de Acceso */}
                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Modo de Acceso al Registro (QR de Alta)
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Elegí si la carga de ficha médica es libre para pruebas o requiere pago y código de alta
                        </p>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold ${
                          config.isMembershipRequired ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {config.isMembershipRequired ? '● Bloqueo Activo' : '● Prueba Abierta'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          playChirp('click');
                          handleChange('isMembershipRequired', false);
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          !config.isMembershipRequired
                            ? 'bg-emerald-500/10 border-emerald-400/60 text-white'
                            : 'bg-[#080D18] border-[#1C2A45] text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-400">Prueba Abierta</span>
                          {!config.isMembershipRequired && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Carga libre de datos y generación de QR sin solicitar código de activación.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playChirp('click');
                          handleChange('isMembershipRequired', true);
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          config.isMembershipRequired
                            ? 'bg-rose-500/10 border-rose-400/60 text-white'
                            : 'bg-[#080D18] border-[#1C2A45] text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-rose-400">Bloqueado (Pago + WhatsApp)</span>
                          {config.isMembershipRequired && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Solicita transferencia al Alias, comprobante por WhatsApp e ingreso del Código de Alta.
                        </p>
                      </button>
                    </div>

                    {/* Código de Alta */}
                    <div className="pt-2 border-t border-[#1C2A45] space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-medium text-slate-300">
                          Código de Alta para clientes verificados
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            clearMembershipUnlockLocally();
                            playChirp('click');
                            setSuccessMessage('Se reinició la activación en este navegador para probar el bloqueo.');
                            setTimeout(() => setSuccessMessage(''), 3500);
                          }}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                        >
                          Probar bloqueo en este equipo
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={24}
                          value={activationCodeInput}
                          onChange={(e) => setActivationCodeInput(e.target.value.toUpperCase())}
                          placeholder="VORTEXPA"
                          className="flex-1 py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-sm font-mono font-bold tracking-widest text-amber-300 uppercase text-center focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={handleCopyWhatsAppReply}
                          className="py-2 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
                        >
                          {copiedWhatsAppReply ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedWhatsAppReply ? 'Respuesta Copiada' : 'Copiar Respuesta WhatsApp'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Google Admin Sync Status */}
                    <div className="pt-2 border-t border-[#1C2A45] flex items-center justify-between gap-2 flex-wrap text-xs">
                      {isAdmin ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Nube conectada ({user?.email}): los cambios impactan en Netlify al instante.</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-amber-300">
                            Conectate como Google Admin para sincronizar los cambios en Netlify:
                          </span>
                          <button
                            type="button"
                            onClick={() => signInWithGoogle()}
                            className="px-3 py-1.5 rounded-md bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shrink-0"
                          >
                            Conectar Google Admin
                          </button>
                        </>
                      )}
                    </div>
                  </section>

                  {/* Cuota Mensual */}
                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-white">Cuota de Membresía Mensual</h3>
                      </div>
                      <span className="text-sm font-mono tabular-nums font-bold text-amber-300">
                        {formatCurrency(config.monthlyFee)} / mes
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-end">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Monto ($ ARS)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-amber-400">$</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={config.monthlyFee}
                            onChange={(e) => handleChange('monthlyFee', Number(e.target.value) || 0)}
                            className="w-full py-2 pl-7 pr-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-base font-mono tabular-nums font-bold text-white focus:outline-none focus:border-cyan-400"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {[2500, 3000, 3500, 4000, 5000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleQuickFeeSelect(amt)}
                            className={`py-2 px-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors border ${
                              config.monthlyFee === amt
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-[#080D18] text-slate-300 border-[#1C2A45] hover:border-cyan-400/50'
                            }`}
                          >
                            ${amt.toLocaleString('es-AR')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Datos de Cobro */}
                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Datos de Cobro (Mercado Pago / Banco / WhatsApp)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Alias Mercado Pago / CVU</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={config.paymentAlias || ''}
                            onChange={(e) => handleChange('paymentAlias', e.target.value)}
                            placeholder="vortex.id.auxilio"
                            className="w-full py-2 pl-3 pr-9 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={handleCopyAlias}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                            title="Copiar alias"
                          >
                            {copiedAlias ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Titular de la Cuenta</label>
                        <input
                          type="text"
                          value={config.paymentHolder || ''}
                          onChange={(e) => handleChange('paymentHolder', e.target.value)}
                          placeholder="VORTEX ID PUNTA ALTA"
                          className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">CBU / CVU Bancario</label>
                        <input
                          type="text"
                          value={config.paymentCbu || ''}
                          onChange={(e) => handleChange('paymentCbu', e.target.value)}
                          placeholder="00000031000..."
                          className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">WhatsApp para Comprobantes</label>
                        <input
                          type="tel"
                          value={config.adminPhone || ''}
                          onChange={(e) => handleChange('adminPhone', e.target.value)}
                          placeholder="2932420000"
                          className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Dominio y Seguridad PIN */}
                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Dominio de Producción (Opcional)</span>
                      </label>
                      <input
                        type="url"
                        value={config.customDomain || ''}
                        onChange={(e) => handleChange('customDomain', e.target.value)}
                        placeholder="https://proyectososvortexid.netlify.app"
                        className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-mono text-cyan-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Clave PIN de Administrador</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfigPin ? 'text' : 'password'}
                          maxLength={8}
                          value={pendingAdminPin}
                          onChange={(e) => setPendingAdminPin(e.target.value)}
                          className="w-full py-2 pl-3 pr-9 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfigPin((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white"
                          aria-label={showConfigPin ? 'Ocultar PIN' : 'Visualizar PIN'}
                        >
                          {showConfigPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* MODULE 3: OPERACIONES (TURNOS FARMACIAS & SPONSORS) */}
              {activeModule === 'operaciones' && (
                <div className="space-y-4">
                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-white">
                          Farmacias de Turno · Colegio de Farmacéuticos
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                        Pegá la circular mensual del Colegio de Farmacéuticos de Punta Alta para actualizar automáticamente el cronograma 24hs en la nube y en todos los llaveros.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDutyImporterOpen(true)}
                      className="min-h-[40px] py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                    >
                      Abrir Importador Mensual
                    </button>
                  </section>

                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">
                        Publicidad Destacada (Farmacia y Remís)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Editá foto de fachada, nombre, horarios, WhatsApp o redes sociales de los comercios sponsors.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playChirp('click');
                          onClose();
                          window.dispatchEvent(
                            new CustomEvent('vortex_open_ad_admin', {
                              detail: { target: 'pharmacy', adminPin: verifiedAdminPin }
                            })
                          );
                        }}
                        className="min-h-[40px] py-2 px-3.5 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-cyan-400/50 text-cyan-200 font-semibold text-xs transition-colors"
                      >
                        Editar Farmacia
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playChirp('click');
                          onClose();
                          window.dispatchEvent(
                            new CustomEvent('vortex_open_ad_admin', {
                              detail: { target: 'remis', adminPin: verifiedAdminPin }
                            })
                          );
                        }}
                        className="min-h-[40px] py-2 px-3.5 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-amber-400/50 text-amber-200 font-semibold text-xs transition-colors"
                      >
                        Editar Remís
                      </button>
                    </div>
                  </section>

                  <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Llaveros activos registrados en el servidor</span>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-bold text-emerald-400">
                      {keychainCount} vinculados
                    </span>
                  </section>
                </div>
              )}

              {/* MODULE 4: DIFUSIÓN PUSH COMUNITARIA */}
              {activeModule === 'push' && (
                <section className="p-4 rounded-xl bg-[#0B111E] border border-[#1C2A45] space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Transmisor de Alertas Push a la Comunidad
                      </h3>
                      <p className="text-xs text-slate-400">
                        Enviá avisos prioritarios de emergencia, farmacias de guardia o alertas climáticas
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetWeatherToLive}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors"
                    >
                      Restablecer clima a SMN en vivo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPushTitle('ALERTA SOS · ACCIDENTE EN VÍA PÚBLICA');
                        setPushBody('Se requiere presencia y paso prioritario para ambulancia SAME 107.');
                        setPushType('emergency');
                        playChirp('click');
                      }}
                      className="p-2.5 rounded-lg bg-[#080D18] hover:bg-rose-950/50 border border-rose-500/40 text-xs font-semibold text-rose-300 text-left transition-colors"
                    >
                      Emergencia SOS
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const currentDuty = getDutyPharmaciesForDate(new Date());
                        const dutyList = PUNTA_ALTA_PHARMACIES.filter((p) =>
                          currentDuty.pharmacyIds.includes(p.id)
                        )
                          .map((p) => `${p.name} (${p.address})`)
                          .join(' · ');
                        setPushTitle('FARMACIAS DE TURNO HOY EN PUNTA ALTA');
                        setPushBody(
                          dutyList
                            ? `Guardia activa 24hs (${currentDuty.activeWindow}): ${dutyList}.`
                            : 'Consultá en la app la farmacia de guardia 24hs más cercana a tu ubicación.'
                        );
                        setPushType('pharmacy');
                        playChirp('click');
                      }}
                      className="p-2.5 rounded-lg bg-[#080D18] hover:bg-cyan-950/50 border border-cyan-500/40 text-xs font-semibold text-cyan-300 text-left transition-colors"
                    >
                      Farmacia 24hs
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPushTitle('ALERTA TEMPORAL · SMN PUNTA ALTA');
                        setPushBody('Fuertes ráfagas de viento y lluvia en Coronel Rosales. Guardias 107 y 100 operativas.');
                        setPushType('weather');
                        playChirp('click');
                      }}
                      className="p-2.5 rounded-lg bg-[#080D18] hover:bg-amber-950/50 border border-amber-500/40 text-xs font-semibold text-amber-300 text-left transition-colors"
                    >
                      Alerta Clima
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPushTitle('RECORDATORIO DE MEMBRESÍA VORTEX ID');
                        setPushBody(
                          `La cuota mensual de mantenimiento del servicio es de ${formatCurrency(config.monthlyFee)}. Alias: ${config.paymentAlias || 'vortex.id.auxilio'}`
                        );
                        setPushType('general');
                        playChirp('click');
                      }}
                      className="p-2.5 rounded-lg bg-[#080D18] hover:bg-emerald-950/50 border border-emerald-500/40 text-xs font-semibold text-emerald-300 text-left transition-colors"
                    >
                      Cuota Mensual
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Título de la Alerta</label>
                      <input
                        type="text"
                        value={pushTitle}
                        onChange={(e) => setPushTitle(e.target.value)}
                        placeholder="Título del aviso"
                        className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Mensaje de la Alerta</label>
                      <textarea
                        rows={3}
                        value={pushBody}
                        onChange={(e) => setPushBody(e.target.value)}
                        placeholder="Escribí el texto de la alerta..."
                        className="w-full py-2 px-3 rounded-lg bg-[#05080F] border border-[#1C2A45] text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={broadcastingPush || !pushTitle.trim()}
                      onClick={handleBroadcastPush}
                      className="min-h-[42px] w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{broadcastingPush ? 'Transmitiendo Alerta…' : 'Transmitir Alerta Push'}</span>
                    </button>

                    {pushBroadcastMsg && (
                      <p className="text-xs text-emerald-400 font-medium text-center">
                        {pushBroadcastMsg}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* 3. Persistent Bottom Action Bar */}
          <div className="px-4 py-3 bg-[#090E1A] border-t border-[#1C2A45] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 text-xs">
              {saveError ? (
                <span className="text-rose-400 font-medium">{saveError}</span>
              ) : successMessage ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </span>
              ) : (
                <span className="text-slate-400">
                  Guardá para aplicar cambios de cuota, bloqueo, cobros o dominio en la nube.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Configuración</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="min-h-[40px] py-2 px-4 rounded-lg bg-[#0E1627] hover:bg-[#15223B] border border-[#1C2A45] text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
              >
                Cerrar
              </button>
            </div>
          </div>
        </form>
      )}

      <ColegioDutyImporterModal
        isOpen={isDutyImporterOpen}
        onClose={() => setIsDutyImporterOpen(false)}
        adminPin={verifiedAdminPin}
      />
    </div>
  );
};
