import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Pill,
  User,
  MapPin,
  Phone,
  Eye,
  EyeOff,
  Link2,
  Tag,
  QrCode,
  Trash2,
  Sparkles,
  RotateCcw,
  HelpCircle,
  ZoomIn
} from 'lucide-react';
import {
  MedicalRecord,
  BLOOD_TYPES,
  saveMedicalRecord,
  hashPin,
  getStoredPinHash,
  savePinHash,
  hasMedicalData,
  clearMedicalRecord,
  SAMPLE_DEMO_RECORD,
  calculatePregnancyProgress,
  optimizeRecordPhoto
} from '../utils/medicalData';
import { playChirp } from '../utils/callHandler';
import { PhotoUploader } from './PhotoUploader';
import { ClinicalHistorySection } from './ClinicalHistorySection';
import { PregnancyFields } from './PregnancyFields';
import { SystemConfig, getStoredSystemConfig, isMembershipUnlockedLocally } from '../utils/systemConfig';
import { MembershipGateCard } from './MembershipGateCard';
import { PersonalPinRecoveryBox } from './PersonalPinRecoveryBox';

interface MedicalIdSectionProps {
  medicalRecord: MedicalRecord | null;
  onRecordUpdated: (record: MedicalRecord) => void;
  onRecordCleared?: () => void;
  onOpenSosModal: () => void;
  onOpenKeychainModal?: () => void;
  onOpenQrModal?: () => void;
  systemConfig?: SystemConfig;
  isMembershipUnlocked?: boolean;
  onMembershipUnlocked?: () => void;
  onPreviewDemoSos?: () => void;
}

export const MedicalIdSection: React.FC<MedicalIdSectionProps> = ({
  medicalRecord,
  onRecordUpdated,
  onRecordCleared,
  onOpenSosModal,
  onOpenKeychainModal,
  onOpenQrModal,
  systemConfig,
  isMembershipUnlocked,
  onMembershipUnlocked,
  onPreviewDemoSos
}) => {
  const effectiveConfig = systemConfig || getStoredSystemConfig();
  const [localUnlocked, setLocalUnlocked] = useState<boolean>(() => isMembershipUnlockedLocally());
  const effectiveUnlocked =
    typeof isMembershipUnlocked === 'boolean' ? isMembershipUnlocked : localUnlocked;
  const isGateBlocked = Boolean(effectiveConfig.isMembershipRequired && !effectiveUnlocked);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [showPinDialog, setShowPinDialog] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [showUnlockPin, setShowUnlockPin] = useState<boolean>(false);
  const [showRecoveryMode, setShowRecoveryMode] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<MedicalRecord>({});
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [largeTextMode, setLargeTextMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vortex_large_text_mode_v1') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncLargeText = () => {
      try {
        setLargeTextMode(localStorage.getItem('vortex_large_text_mode_v1') === '1');
      } catch {}
    };
    window.addEventListener('vortex_large_text_changed', syncLargeText);
    return () => window.removeEventListener('vortex_large_text_changed', syncLargeText);
  }, []);

  const toggleLargeTextMode = () => {
    playChirp('click');
    setLargeTextMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vortex_large_text_mode_v1', next ? '1' : '0');
        window.dispatchEvent(new CustomEvent('vortex_large_text_changed'));
      } catch {}
      return next;
    });
  };

  const hasData = hasMedicalData(medicalRecord);
  const hasPinConfigured = Boolean(getStoredPinHash());

  useEffect(() => {
    if (medicalRecord && hasMedicalData(medicalRecord)) {
      setFormData(medicalRecord);
    } else {
      setFormData({});
      setIsUnlocked(true);
    }
  }, [medicalRecord]);

  // Handle PIN Unlock
  const handleUnlock = async () => {
    const storedHash = getStoredPinHash();
    if (!storedHash) {
      setIsUnlocked(true);
      setShowPinDialog(false);
      return;
    }

    if (!pinInput.trim()) {
      setPinError('Ingresá tu clave numérica');
      return;
    }

    try {
      const enteredHash = await hashPin(pinInput);
      if (enteredHash === storedHash) {
        setIsUnlocked(true);
        setShowPinDialog(false);
        setPinInput('');
        setPinError('');
        playChirp('success');
      } else {
        setPinError('Clave incorrecta. No se permiten cambios no autorizados.');
        playChirp('click');
      }
    } catch {
      setPinError('Error al validar la clave.');
    }
  };

  // Lock form immediately
  const handleLock = () => {
    setIsUnlocked(false);
    setShowPinDialog(false);
    setPinInput('');
    setPinError('');
    setNewPin('');
    setConfirmPin('');
    playChirp('click');
  };

  // Handle complete wipe to start fresh from scratch (Option 2)
  const handleConfirmWipe = () => {
    clearMedicalRecord();
    setFormData({});
    setIsUnlocked(true);
    setShowClearConfirm(false);
    setShowPinDialog(false);
    if (onRecordCleared) onRecordCleared();
    setStatusMessage('✔ Ficha reiniciada. Podés cargar tu propia foto y tus datos desde cero.');
    playChirp('success');
    setTimeout(() => setStatusMessage(''), 5000);
  };

  // Helper to load sample test data if user wants to preview or test scanning
  const handleLoadDemo = () => {
    setFormData({ ...SAMPLE_DEMO_RECORD });
    setStatusMessage('ℹ️ Datos de prueba cargados. Creá tu PIN abajo y tocá "GUARDAR DATOS Y BLOQUEAR FORMULARIO" para generar tu QR y Fondo de Bloqueo.');
    playChirp('click');
    setTimeout(() => setStatusMessage(''), 7000);
  };

  // Helper to clear form in edit mode
  const handleClearForm = () => {
    setFormData({});
    setStatusMessage('Formulario en blanco listo para completar.');
    playChirp('click');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Handle Form Change
  const handleChange = (field: keyof MedicalRecord, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMedicalData(formData)) {
      setStatusMessage('Completá al menos el nombre y un dato médico para guardar tu ficha.');
      return;
    }

    // If no PIN configured yet, require one
    if (!hasPinConfigured) {
      if (!newPin.trim() || !/^\d{4,6}$/.test(newPin.trim())) {
        setStatusMessage('Es obligatorio crear una clave de 4 a 6 números para proteger tus datos.');
        return;
      }
      if (newPin !== confirmPin) {
        setStatusMessage('Las dos claves ingresadas no coinciden.');
        return;
      }
      const hashed = await hashPin(newPin.trim());
      savePinHash(hashed);
    } else if (newPin.trim()) {
      // User is updating their PIN
      if (!/^\d{4,6}$/.test(newPin.trim())) {
        setStatusMessage('La nueva clave debe tener de 4 a 6 números.');
        return;
      }
      if (newPin !== confirmPin) {
        setStatusMessage('Las dos claves ingresadas no coinciden.');
        return;
      }
      const hashed = await hashPin(newPin.trim());
      savePinHash(hashed);
    }

    let recordToSave: MedicalRecord = formData;
    if (recordToSave.foto) {
      recordToSave = await optimizeRecordPhoto(recordToSave, true);
      setFormData(recordToSave);
    } else if (recordToSave.fotoQr) {
      recordToSave = { ...recordToSave, fotoQr: undefined };
    }

    const saved = saveMedicalRecord(recordToSave);
    if (saved) {
      onRecordUpdated(recordToSave);
      setIsUnlocked(false); // Hide form immediately upon saving as requested!
      setNewPin('');
      setConfirmPin('');
      setStatusMessage('✔ Datos guardados y protegidos con clave. El formulario se ha bloqueado.');
      playChirp('success');
      setTimeout(() => setStatusMessage(''), 5000);
    } else {
      setStatusMessage('No se pudo guardar en este dispositivo.');
    }
  };

  return (
    <section id="ficha-medica" className="my-5 rounded-3xl bg-gradient-to-b from-[#0b1d46] to-[#07122c] border border-[#1e5bff] p-4 sm:p-5 shadow-2xl shadow-blue-950/60 scroll-mt-20">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e3f8f]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-500 flex items-center justify-center text-xl">
            🪪
          </div>
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-wide text-white">
              FICHA DE ASISTENCIA PERSONAL
            </h2>
            <p className="text-xs text-[#9db6dd]">
              Tus datos en este dispositivo · Protegidos bajo clave
            </p>
          </div>
        </div>

        {hasData && isUnlocked && (
          <button
            type="button"
            onClick={handleLock}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff]/60 text-xs font-semibold text-white transition active:scale-95"
          >
            <Lock className="w-3.5 h-3.5 text-[#37c8ff]" />
            <span>Bloquear ahora</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="my-3 p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* CASE 1: Data is loaded and form is LOCKED (Default Safe State) */}
      {hasData && !isUnlocked ? (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-2xl bg-[#07122c] border border-[#1e3f8f] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>FICHA ACTIVA EN ESTE DISPOSITIVO</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0a1f55] text-[#37c8ff] border border-[#1e5bff]/50">
                🔒 Formulario oculto
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                {/* Photo with security check badge */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 min-w-[96px] min-h-[96px] sm:min-w-[112px] sm:min-h-[112px] rounded-2xl overflow-hidden border-2 border-[#37c8ff] bg-[#07122c] flex items-center justify-center shadow-lg shadow-blue-950 shrink-0">
                    {medicalRecord?.foto ? (
                      <img
                        src={medicalRecord.foto}
                        alt="Foto titular"
                        className="w-full h-full object-cover block"
                        loading="eager"
                      />
                    ) : (
                      <User className="w-10 h-10 text-[#37c8ff]/60" />
                    )}
                  </div>
                  {medicalRecord?.foto && (
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      ID OK
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-[#9db6dd] uppercase font-bold tracking-wider">
                    Persona titular
                  </span>
                  <div className="text-2xl font-black font-heading text-white">
                    {medicalRecord?.nombre}
                  </div>
                  {medicalRecord?.dni && (
                    <div className="text-xs text-[#37c8ff]">DNI: {medicalRecord.dni}</div>
                  )}
                  {medicalRecord?.domicilio && (
                    <div className="text-xs text-gray-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-[#37c8ff]" />
                      <span>{medicalRecord.domicilio}</span>
                    </div>
                  )}
                </div>
              </div>

              {medicalRecord?.sangre && (
                <div className="shrink-0 text-center px-4 py-2 rounded-2xl bg-gradient-to-b from-red-600 to-rose-800 text-white border-2 border-red-300 shadow-md">
                  <span className="text-[10px] font-bold tracking-wider block opacity-90">GRUPO</span>
                  <span className="text-3xl font-black font-heading tracking-widest">
                    {medicalRecord.sangre}
                  </span>
                </div>
              )}
            </div>

            {/* Medical Summary Badges */}
            <div className="pt-2 border-t border-[#1e3f8f]/40 space-y-1.5 text-xs">
              {(() => {
                const preg = calculatePregnancyProgress(medicalRecord);
                if (!preg) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-pink-950/60 border border-pink-400/60 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-pink-200 font-bold">
                      🤰 Embarazo en curso: <span className="text-white">{preg.detailedLabel}</span>
                    </div>
                    {preg.dueDateFormatted && (
                      <span className="text-[11px] text-pink-300 font-semibold">
                        FPP: {preg.dueDateFormatted}
                      </span>
                    )}
                  </div>
                );
              })()}
              {medicalRecord?.enf && (
                <div className="flex items-start gap-1.5 text-amber-300">
                  <span className="font-bold shrink-0">Alergias / Enfermedad:</span>
                  <span className="text-white">{medicalRecord.enf}</span>
                </div>
              )}
              {medicalRecord?.med && (
                <div className="flex items-start gap-1.5 text-cyan-300">
                  <span className="font-bold shrink-0">Medicación:</span>
                  <span className="text-white">{medicalRecord.med}</span>
                </div>
              )}
              {medicalRecord?.tel && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-bold">Contacto de auxilio:</span>
                  <span className="text-white font-mono">{medicalRecord.tel}</span>
                </div>
              )}

              {/* Physical Keychain Link Status */}
              <div className="pt-2 border-t border-[#1e3f8f]/40 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[#9db6dd]">Llavero Físico:</span>
                  {medicalRecord?.keychainId ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      #{medicalRecord.keychainId} ACTIVO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Sin vincular
                    </span>
                  )}
                </div>

                {onOpenKeychainModal && (
                  <button
                    type="button"
                    onClick={onOpenKeychainModal}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 border border-amber-400 text-xs font-bold text-amber-300 hover:text-white flex items-center gap-1 transition active:scale-95"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>{medicalRecord?.keychainId ? 'Gestionar' : 'Vincular Llavero'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-[#9db6dd] leading-relaxed">
            🛡️ Los datos están guardados de forma segura en este celular. Nadie puede ver el formulario ni alterar la información sin ingresar tu clave secreta.
          </p>

          {/* Action to modify: requires PIN & View QR & Wipe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {onOpenQrModal && (
              <button
                type="button"
                onClick={onOpenQrModal}
                className="py-3 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:opacity-95 text-white font-bold text-xs sm:text-sm tracking-wide transition active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-blue-950"
              >
                <QrCode className="w-4 h-4 text-[#37c8ff]" />
                <span>Ver / Descargar QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSosModal}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs sm:text-sm transition active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-red-950"
            >
              <span>Ver Ficha SOS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowPinDialog(true);
                setShowClearConfirm(false);
                setPinError('');
                setPinInput('');
              }}
              className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff] text-white font-bold text-xs sm:text-sm tracking-wide transition active:scale-95 shadow-md"
            >
              <KeyRound className="w-4 h-4 text-[#37c8ff]" />
              <span>Modificar (PIN)</span>
            </button>
          </div>

          {/* Reset / Wipe button to let user start completely empty */}
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setShowClearConfirm(true);
                setShowPinDialog(false);
              }}
              className="text-xs text-red-300 hover:text-red-200 py-1.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-950/80 border border-red-500/40 flex items-center gap-1.5 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Limpiar ficha / Cargar datos de otra persona</span>
            </button>
          </div>

          {/* Wipe Confirmation Dialog */}
          {showClearConfirm && (
            <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-500 space-y-3 animate-fade-in text-center">
              <div className="text-white font-bold text-sm">
                ¿Querés borrar la ficha actual para cargar una nueva persona desde cero?
              </div>
              <p className="text-xs text-red-200">
                Se eliminarán los datos de este celular y el formulario quedará completamente en blanco listo para subir tu foto y escribir tus datos.
              </p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={handleConfirmWipe}
                  className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition active:scale-95"
                >
                  Sí, borrar y empezar de cero
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs transition active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* PIN Dialog Modal */}
          {showPinDialog && (
            <div className="p-4 rounded-2xl bg-[#07122c] border-2 border-[#37c8ff] space-y-3 animate-fade-in">
              {!showRecoveryMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-white font-heading">
                      <Lock className="w-4 h-4 text-[#37c8ff]" />
                      <span>INGRESÁ TU CLAVE PARA DESBLOQUEAR</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinDialog(false);
                        setShowRecoveryMode(false);
                        setPinError('');
                      }}
                      className="text-xs text-[#9db6dd] hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showUnlockPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Tu clave (4 a 6 números)"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          if (pinError) setPinError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        className="w-full py-2.5 pl-4 pr-10 rounded-xl bg-[#050b1f] border border-[#1e5bff] text-center text-xl tracking-widest text-white focus:outline-none focus:border-[#37c8ff]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowUnlockPin((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#37c8ff] hover:text-white transition"
                        aria-label={showUnlockPin ? 'Ocultar clave' : 'Ver clave'}
                        title={showUnlockPin ? 'Ocultar clave' : 'Ver clave'}
                      >
                        {showUnlockPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleUnlock}
                      className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:from-blue-500 hover:to-blue-600 text-white font-bold text-sm shadow-md transition active:scale-95"
                    >
                      Desbloquear
                    </button>
                  </div>

                  {pinError && <p className="text-xs text-red-400 font-semibold">{pinError}</p>}

                  <div className="pt-0.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        playChirp('click');
                        setPinError('');
                        setShowRecoveryMode(true);
                      }}
                      className="text-xs text-[#37c8ff] hover:text-white underline underline-offset-4 flex items-center gap-1.5 font-semibold transition"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>¿Olvidaste tu clave? Recuperar</span>
                    </button>
                  </div>
                </>
              ) : (
                <PersonalPinRecoveryBox
                  record={medicalRecord}
                  onCancel={() => setShowRecoveryMode(false)}
                  onRecovered={() => {
                    setShowRecoveryMode(false);
                    setShowPinDialog(false);
                    setIsUnlocked(true);
                    setPinInput('');
                    setPinError('');
                    setStatusMessage('✔ Clave restablecida correctamente. Ya podés editar tu ficha.');
                    setTimeout(() => setStatusMessage(''), 5000);
                  }}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        /* CASE 2: Editing Form (Shown on first time setup OR after unlocking with PIN) */
        <div className="mt-4 space-y-4">
          {/* Membership Status / Payment & Activation Gate */}
          <MembershipGateCard
            systemConfig={effectiveConfig}
            isUnlocked={effectiveUnlocked}
            onUnlocked={() => {
              setLocalUnlocked(true);
              if (onMembershipUnlocked) onMembershipUnlocked();
            }}
            onPreviewDemoSos={onPreviewDemoSos}
          />

          {isGateBlocked ? null : (
            <>
          {!hasData && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0d2a6e]/70 via-[#091b42] to-[#071536] border-2 border-[#37c8ff] text-white space-y-3 shadow-xl">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl sm:text-3xl">👋</span>
                <div>
                  <strong className="block text-base sm:text-lg text-[#37c8ff] font-heading font-black tracking-wide">
                    ¡BIENVENIDO A VORTEX ID · PUNTA ALTA!
                  </strong>
                  <p className="text-xs text-[#9db6dd]">
                    Ficha de protección médica vacía · Lista para que cargues tus datos
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[#eaf3ff] leading-relaxed">
                Este es el sistema oficial de socorro de Punta Alta. Subí tu foto y completá tu información personal a continuación para activar tu cobertura ante accidentes y emergencias.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-[#9db6dd]">
                <div className="p-2.5 rounded-xl bg-[#050b1f]/80 border border-[#1e5bff]/40 flex items-center gap-2">
                  <span className="text-base">📸</span>
                  <span>1. Subí tu foto o selfie</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#050b1f]/80 border border-[#1e5bff]/40 flex items-center gap-2">
                  <span className="text-base">🪪</span>
                  <span>2. Nombre, DNI y contactos</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#050b1f]/80 border border-[#1e5bff]/40 flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <span>3. Creá tu PIN de 4 números</span>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-[#1e3f8f]/40">
                <span className="text-[11px] text-[#9db6dd]">
                  ¿Querés probar con un ejemplo primero?
                </span>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-3 py-1.5 rounded-lg bg-blue-950/90 hover:bg-blue-900 border border-[#37c8ff]/70 text-xs font-bold text-[#37c8ff] hover:text-white flex items-center gap-1.5 transition active:scale-95 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cargar datos de prueba (Demo)</span>
                </button>
              </div>
            </div>
          )}

          {/* Accessibility: Large Text Mode Toggle for Low-Vision Users */}
          <div className="p-3 rounded-2xl bg-[#071536] border border-cyan-400/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shrink-0">
                <ZoomIn className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-white block">
                  Modo Letra Grande (Poca Visión)
                </span>
                <span className="text-[11px] text-[#9db6dd]">
                  Agranda textos, casillas y bordes para completar tus datos con mayor claridad.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleLargeTextMode}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 shrink-0 border ${
                largeTextMode
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 border-emerald-300 shadow-md'
                  : 'bg-[#0a235c] hover:bg-[#12368a] text-cyan-200 border-cyan-400/70'
              }`}
            >
              {largeTextMode ? '✓ Letra Grande ACTIVADA' : '🔍 Activar Letra Grande'}
            </button>
          </div>

          <form onSubmit={handleSave} className={`space-y-3 ${largeTextMode ? 'vortex-large-text' : ''}`}>
            {/* Profile Photo Uploader */}
            <PhotoUploader
              currentPhoto={formData.foto}
              onPhotoSelected={(foto) =>
                setFormData((prev) => ({ ...prev, foto: foto || '', fotoQr: undefined }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  Nombre y apellido completo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Carlos Pérez"
                  value={formData.nombre || ''}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  DNI / Documento de identidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: 28.456.789"
                  value={formData.dni || ''}
                  onChange={(e) => handleChange('dni', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  Domicilio en Punta Alta
                </label>
                <input
                  type="text"
                  placeholder="Ej: Paso 1234, Punta Alta"
                  value={formData.domicilio || ''}
                  onChange={(e) => handleChange('domicilio', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  Grupo Sanguíneo
                </label>
                <select
                  value={formData.sangre || ''}
                  onChange={(e) => handleChange('sangre', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                >
                  <option value="">Seleccionar</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector de Sexo Biológico y Datos de Embarazo Auto-Actualizables */}
            <PregnancyFields
              formData={formData}
              onChange={handleChange}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  ¿Tiene alguna enfermedad o alergia?
                </label>
                <input
                  type="text"
                  placeholder="Ej: Hipertensión, Diabetes, Alérgico a penicilina"
                  value={formData.enf || ''}
                  onChange={(e) => handleChange('enf', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cyan-300 mb-1">
                  ¿Toma medicamentos habitualmente?
                </label>
                <input
                  type="text"
                  placeholder="Ej: Losartán 50mg, Levotiroxina"
                  value={formData.med || ''}
                  onChange={(e) => handleChange('med', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  Obra Social / Prepaga (DIBA, IOMA, PAMI, etc.)
                </label>
                <input
                  type="text"
                  placeholder="Ej: DIBA, IOMA, PAMI, OSDE"
                  value={formData.obraSocial || ''}
                  onChange={(e) => handleChange('obraSocial', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9db6dd] mb-1">
                  Médico de cabecera / Centro de salud
                </label>
                <input
                  type="text"
                  placeholder="Nombre de tu doctor o clínica"
                  value={formData.doc || ''}
                  onChange={(e) => handleChange('doc', e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                />
              </div>
            </div>

            {/* Contact Phones */}
            <div className="p-3.5 rounded-2xl bg-[#07122c] border border-[#1e3f8f]/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#37c8ff]">
                Teléfonos y WhatsApp para auxilio de emergencia
              </h4>
              <p className="text-[11px] text-[#9db6dd]">
                Ingresá con código de área (ej: 2932123456). Ante una emergencia, cualquier persona podrá presionar para llamarlos o mandarles un WhatsApp con tu ubicación GPS.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Teléfono principal de auxilio</label>
                  <input
                    type="tel"
                    placeholder="Ej: 2932420000"
                    value={formData.tel || ''}
                    onChange={(e) => handleChange('tel', e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#050b1f] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1">WhatsApp de Familiar</label>
                  <input
                    type="tel"
                    placeholder="Ej: 2932123456"
                    value={formData.cfam || ''}
                    onChange={(e) => handleChange('cfam', e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#050b1f] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1">WhatsApp de Amigo / Allegado</label>
                  <input
                    type="tel"
                    placeholder="Ej: 2932654321"
                    value={formData.cami || ''}
                    onChange={(e) => handleChange('cami', e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#050b1f] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1">WhatsApp de Médico de cabecera</label>
                  <input
                    type="tel"
                    placeholder="Ej: 2932987654"
                    value={formData.cmed || ''}
                    onChange={(e) => handleChange('cmed', e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#050b1f] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Historial Clínico y Antecedentes (Editable) */}
            <ClinicalHistorySection
              record={medicalRecord}
              isEditing={true}
              editForm={formData}
              onFormChange={handleChange}
            />

            {/* Clave de Seguridad OBLIGATORIA */}
            <div className="p-3.5 rounded-2xl bg-[#091535] border-2 border-[#37c8ff]/60 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#37c8ff]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {hasPinConfigured ? 'Cambiar clave PIN de seguridad (opcional)' : 'Crear clave PIN de seguridad (obligatoria)'}
                </span>
              </div>
              <p className="text-[11px] text-[#9db6dd]">
                Esta clave numérica (4 a 6 números) protegerá tus datos. Una vez guardados, nadie podrá ver este formulario ni alterarlo sin tu clave.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Clave (4 a 6 números)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                  required={!hasPinConfigured}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Repetir clave para confirmar"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-sm text-white focus:outline-none focus:border-[#37c8ff]"
                  required={!hasPinConfigured || Boolean(newPin)}
                />
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:from-blue-500 hover:to-blue-600 text-white font-bold text-base font-heading tracking-wide shadow-lg shadow-blue-950 transition active:scale-95"
              >
                <Save className="w-5 h-5" />
                <span>GUARDAR DATOS Y BLOQUEAR FORMULARIO</span>
              </button>

              {Boolean(formData.nombre || formData.dni || formData.foto) && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="py-3 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold transition active:scale-95"
                >
                  Limpiar campos
                </button>
              )}

              {hasData && (
                <button
                  type="button"
                  onClick={handleLock}
                  className="py-3 px-4 rounded-xl bg-[#07122c] hover:bg-white/10 border border-gray-700 text-gray-300 text-xs font-semibold transition"
                >
                  Cancelar y bloquear
                </button>
              )}
            </div>
          </form>
            </>
          )}
        </div>
      )}
    </section>
  );
};
