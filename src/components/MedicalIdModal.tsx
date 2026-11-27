import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Phone,
  Send,
  AlertOctagon,
  Heart,
  Pill,
  User,
  MapPin,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  ShieldAlert,
  KeyRound,
  Lock,
  Save,
  CheckCircle2,
  QrCode,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Edit3,
  HelpCircle,
  ZoomIn,
  BadgeCheck,
  Award
} from 'lucide-react';
import {
  MedicalRecord,
  BLOOD_TYPES,
  buildSosMessage,
  hashPin,
  getStoredPinHash,
  savePinHash,
  saveMedicalRecord,
  hasMedicalData,
  generateKeychainUrl,
  generateCorrelativeUrl,
  calculatePregnancyProgress,
  optimizeRecordPhoto
} from '../utils/medicalData';
import {
  Coordinates,
  isVerifiedEmergencyCoords,
  getCoordsFreshnessInfo,
  describePuntaAltaLocation,
  POPULAR_PUNTA_ALTA_SPOTS,
  fetchGeocodedLocation
} from '../utils/geo';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from '../utils/callHandler';
import { generateVortexQrDataUrl } from '../utils/vortexQrGenerator';
import { getEffectiveOrigin } from '../utils/systemConfig';
import { PhotoUploader } from './PhotoUploader';
import { ClinicalHistorySection } from './ClinicalHistorySection';
import { PregnancyFields } from './PregnancyFields';
import { BloodAndDonorFields, DonorAndBloodStatusCard, getMedicalValidationStatus } from './BloodAndDonorFields';
import { PersonalPinRecoveryBox } from './PersonalPinRecoveryBox';
import { DailyMedicationSection } from './DailyMedicationSection';

interface MedicalIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
  coords: Coordinates | null;
  ipFallback?: Coordinates | null;
  gpsStatus?: string;
  onRequestCoords?: () => void;
  onRecordUpdated?: (updated: MedicalRecord) => void;
  onOpenQrModal?: () => void;
}

export const MedicalIdModal: React.FC<MedicalIdModalProps> = ({
  isOpen,
  onClose,
  record,
  coords,
  ipFallback,
  gpsStatus,
  onRequestCoords,
  onRecordUpdated,
  onOpenQrModal
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showPinInput, setShowPinInput] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showUnlockPin, setShowUnlockPin] = useState<boolean>(false);
  const [showRecoveryMode, setShowRecoveryMode] = useState<boolean>(false);
  const [showChangePin, setShowChangePin] = useState<boolean>(false);

  const [manualAccidentCoords, setManualAccidentCoords] = useState<Coordinates | null>(null);
  const [showCornerPicker, setShowCornerPicker] = useState<boolean>(false);
  const [cornerQuery, setCornerQuery] = useState<string>('');
  const [cornerError, setCornerError] = useState<string>('');
  const [isResolvingCorner, setIsResolvingCorner] = useState<boolean>(false);
  const [isPhotoZoomOpen, setIsPhotoZoomOpen] = useState<boolean>(false);
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

  // Editable form state
  const [editForm, setEditForm] = useState<MedicalRecord>(record || {});

  useEffect(() => {
    setEditForm(record || {});
  }, [record]);

  useEffect(() => {
    if (!isOpen || !onRequestCoords) return;
    const isStale =
      !coords?.timestamp ||
      Date.now() - coords.timestamp > 20000;
    if (!isVerifiedEmergencyCoords(coords) || isStale) {
      onRequestCoords();
    }
  }, [isOpen]);

  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate QR Code with embedded Vortex logo for scanning directly from the Ficha
  useEffect(() => {
    let url = '';
    if (record && hasMedicalData(record)) {
      url = generateKeychainUrl(record);
    } else if (record?.keychainId) {
      url = generateCorrelativeUrl(record.keychainId);
    } else {
      url = `${getEffectiveOrigin()}/?welcome=1`;
    }

    generateVortexQrDataUrl(url, {
      width: 440,
      margin: 3,
      errorCorrectionLevel: 'H'
    })
      .then((dataUri) => {
        setQrDataUrl(dataUri);
      })
      .catch((err) => {
        console.error('Error generating Vortex QR in modal:', err);
      });
  }, [record, isOpen]);

  if (!isOpen) return null;

  const contacts = [
    { label: 'Teléfono de Auxilio', phone: record?.tel, isSos: true },
    { label: 'Familiar', phone: record?.cfam },
    { label: 'Amigo / Allegado', phone: record?.cami },
    { label: 'Médico de cabecera', phone: record?.cmed }
  ].filter((c) => Boolean(c.phone));

  const activeEmergencyCoords = manualAccidentCoords || (isVerifiedEmergencyCoords(coords) ? coords : null);
  const freshness = activeEmergencyCoords ? getCoordsFreshnessInfo(activeEmergencyCoords) : null;

  const handleApplyManualCorner = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cornerQuery.trim();
    if (!q) return;
    setCornerError('');
    setIsResolvingCorner(true);
    try {
      const res = await fetchGeocodedLocation(q);
      if (res) {
        playChirp('success');
        setManualAccidentCoords({ ...res.coords, source: 'manual', label: res.label });
        setShowCornerPicker(false);
        setCornerQuery('');
      } else {
        setCornerError('No encontramos esa calle en Punta Alta (probá ej: "Brown 850" o "Paso y Mitre").');
      }
    } finally {
      setIsResolvingCorner(false);
    }
  };

  const handleSendWhatsAppTo = (phone?: string) => {
    const wa = phone ? formatWhatsAppNumber(phone) : '';
    const message = buildSosMessage(record, activeEmergencyCoords, ipFallback);
    const url = wa
      ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleUnlockEdit = async () => {
    const stored = getStoredPinHash();
    if (!stored) {
      setIsEditing(true);
      setShowPinInput(false);
      return;
    }

    if (!pin.trim()) {
      setPinError('Ingresá tu clave numérica');
      return;
    }

    try {
      const enteredHash = await hashPin(pin);
      if (enteredHash === stored) {
        setIsEditing(true);
        setShowPinInput(false);
        setEditForm(record || {});
        setPin('');
        setPinError('');
        playChirp('success');
      } else {
        setPinError('Clave incorrecta');
        playChirp('click');
      }
    } catch {
      setPinError('Error al validar');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMedicalData(editForm)) {
      setStatusMessage('Completá al menos el nombre y un dato de salud.');
      return;
    }

    if (newPin.trim()) {
      if (!/^\d{4,6}$/.test(newPin.trim())) {
        setStatusMessage('La clave PIN debe tener entre 4 y 6 números.');
        return;
      }
      if (newPin !== confirmPin) {
        setStatusMessage('Las dos claves no coinciden.');
        return;
      }
      const hashed = await hashPin(newPin.trim());
      savePinHash(hashed);
    }

    let recordToSave: MedicalRecord = editForm;
    if (recordToSave.foto) {
      recordToSave = await optimizeRecordPhoto(recordToSave, true);
      setEditForm(recordToSave);
    } else if (recordToSave.fotoQr) {
      recordToSave = { ...recordToSave, fotoQr: undefined };
    }

    const saved = saveMedicalRecord(recordToSave);
    if (saved) {
      if (onRecordUpdated) onRecordUpdated(recordToSave);
      setIsEditing(false);
      setNewPin('');
      setConfirmPin('');
      setStatusMessage('✔ Datos actualizados y protegidos con clave.');
      playChirp('success');
      setTimeout(() => setStatusMessage(''), 4000);
    }
  };

  const handleChange = (field: keyof MedicalRecord, value: any) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-rose-50 dark:from-[#180811] via-sky-50/70 dark:via-[#0b1d46] to-slate-50 dark:to-[#07122c] border-2 border-red-400 dark:border-red-500 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-red-950/80 my-auto">
        {/* Top First Responder Alert Banner */}
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center gap-2.5 shadow-md">
          <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce text-white" />
          <div className="text-xs font-semibold leading-tight">
            <span className="block font-black font-heading text-sm uppercase tracking-wider">
              FICHA PRINCIPAL DE ASISTENCIA
            </span>
            Datos médicos de auxilio inmediato para socorrer en Punta Alta.
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-red-300 dark:border-red-500/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-600/30 text-red-700 dark:text-red-400 border border-red-400 dark:border-red-500 animate-pulse">
              <AlertOctagon className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-black font-heading text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                {isEditing ? 'EDITAR MIS DATOS' : 'FICHA MÉDICA SOS'}
              </h2>
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold uppercase tracking-wider">
                Vortex ID · Punta Alta
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsEditing(false);
              setShowPinInput(false);
              onClose();
            }}
            className="p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white transition"
            aria-label="Cerrar ficha de emergencia"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {statusMessage && (
          <div className="my-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs text-center font-bold">
            {statusMessage}
          </div>
        )}

        {/* VIEW 1: In-Place Editing Form (when unlocked by owner with PIN) */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className={`mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1 ${largeTextMode ? 'vortex-large-text' : ''}`}>
            {/* Accessibility: Large Text Toggle */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#071536] border border-sky-300 dark:border-cyan-400/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-sky-800 dark:text-cyan-200 font-bold">
                <ZoomIn className="w-4 h-4 text-sky-700 dark:text-cyan-300 shrink-0" />
                <span>Letra Grande (Poca visión)</span>
              </div>
              <button
                type="button"
                onClick={toggleLargeTextMode}
                className={`px-3 py-1 rounded-lg text-xs font-black transition border ${
                  largeTextMode
                    ? 'bg-emerald-500 text-gray-950 border-emerald-300'
                    : 'bg-sky-50 dark:bg-[#0a235c] text-sky-800 dark:text-cyan-200 border-sky-300 dark:border-cyan-400/60'
                }`}
              >
                {largeTextMode ? '✓ Activada' : 'Activar'}
              </button>
            </div>
            {/* Profile Photo Uploader */}
            <PhotoUploader
              currentPhoto={editForm.foto}
              onPhotoSelected={(foto) =>
                setEditForm((prev) => ({ ...prev, foto: foto || '', fotoQr: undefined }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9db6dd] mb-1">Nombre y apellido</label>
                <input
                  type="text"
                  value={editForm.nombre || ''}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9db6dd] mb-1">DNI / Documento</label>
                <input
                  type="text"
                  value={editForm.dni || ''}
                  onChange={(e) => handleChange('dni', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9db6dd] mb-1">Domicilio en Punta Alta</label>
                <input
                  type="text"
                  value={editForm.domicilio || ''}
                  onChange={(e) => handleChange('domicilio', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9db6dd] mb-1">Grupo Sanguíneo</label>
                <select
                  value={editForm.sangre || ''}
                  onChange={(e) => handleChange('sangre', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
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

            {/* Respaldo de Grupo Sanguíneo y Donante de Órganos */}
            <BloodAndDonorFields
              formData={editForm}
              onChange={handleChange}
              compact={true}
            />

            {/* Sexo Biológico y Embarazo Auto-Actualizable */}
            <PregnancyFields
              formData={editForm}
              onChange={handleChange}
              compact={true}
            />

            <div>
              <label className="block text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">¿Enfermedades o Alergias?</label>
              <input
                type="text"
                value={editForm.enf || ''}
                onChange={(e) => handleChange('enf', e.target.value)}
                placeholder="Ej: Hipertensión, Diabetes, Alérgico a penicilina"
                className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-amber-300 dark:border-amber-500/60 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sky-700 dark:text-cyan-300 mb-1">¿Medicación habitual?</label>
              <input
                type="text"
                value={editForm.med || ''}
                onChange={(e) => handleChange('med', e.target.value)}
                placeholder="Ej: Losartán 50mg, Insulina"
                className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-sky-300 dark:border-cyan-500/60 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <DailyMedicationSection
              compact={true}
              defaultExpanded={false}
              currentSosMedText={editForm.med}
              onSyncToSosMedField={(summary) => handleChange('med', summary)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">Obra Social / Prepaga</label>
                <input
                  type="text"
                  value={editForm.obraSocial || ''}
                  onChange={(e) => handleChange('obraSocial', e.target.value)}
                  placeholder="Ej: IOMA, OSDE, PAMI"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">Médico de cabecera</label>
                <input
                  type="text"
                  value={editForm.doc || ''}
                  onChange={(e) => handleChange('doc', e.target.value)}
                  placeholder="Dr/a. Apellido"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">Teléfono principal de auxilio</label>
                <input
                  type="tel"
                  value={editForm.tel || ''}
                  onChange={(e) => handleChange('tel', e.target.value)}
                  placeholder="2932420000"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">WhatsApp Familiar</label>
                <input
                  type="tel"
                  value={editForm.cfam || ''}
                  onChange={(e) => handleChange('cfam', e.target.value)}
                  placeholder="2932123456"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-emerald-300 dark:border-emerald-500/60 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">Contacto Amigo / Vecino</label>
                <input
                  type="tel"
                  value={editForm.cami || ''}
                  onChange={(e) => handleChange('cami', e.target.value)}
                  placeholder="2932654321"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-gray-300 mb-1">Teléfono Médico / Guardia</label>
                <input
                  type="tel"
                  value={editForm.cmed || ''}
                  onChange={(e) => handleChange('cmed', e.target.value)}
                  placeholder="2932421234"
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Sección de Historial Clínico y Antecedentes (Editable) */}
            <ClinicalHistorySection
              record={record}
              isEditing={true}
              editForm={editForm}
              onFormChange={handleChange}
            />

            {/* Change PIN option */}
            <div className="p-3 rounded-xl bg-white dark:bg-[#07122c] border border-blue-400 dark:border-[#1e5bff]/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Cambiar clave PIN (opcional)</label>
                <button
                  type="button"
                  onClick={() => setShowChangePin((v) => !v)}
                  className="text-[11px] text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white flex items-center gap-1"
                >
                  {showChangePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showChangePin ? 'Ocultar' : 'Ver'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type={showChangePin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Nueva clave (4 a 6)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white"
                />
                <input
                  type={showChangePin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Repetir clave"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] text-white font-bold text-sm tracking-wide shadow-md active:scale-95 transition"
              >
                Guardar y bloquear
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="py-3 px-4 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          /* VIEW 2: Standard Clean Emergency Sheet (Safe for Responders & Medical Staff) */
          <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {!hasMedicalData(record) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-300 dark:border-amber-500/80 text-center space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ <strong>Esta ficha médica aún no tiene datos cargados.</strong> Para que funcione ante un accidente, completá tu nombre, DNI, grupo sanguíneo y teléfonos de auxilio.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    const el = document.getElementById('info');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="py-1.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] text-white font-bold text-xs shadow active:scale-95 transition"
                >
                  Cargar mis datos y foto ahora
                </button>
              </div>
            )}

            {/* Person Card with Photo Verification & Blood Type */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#07122c] border border-red-300 dark:border-red-500/60 shadow-inner space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Photo of the owner with robust responsive sizing and tap-to-zoom */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (record?.foto) setIsPhotoZoomOpen(true);
                      }}
                      className={`w-28 h-28 sm:w-32 sm:h-32 min-w-[112px] min-h-[112px] sm:min-w-[128px] sm:min-h-[128px] rounded-2xl overflow-hidden border-2 border-[#37c8ff] shadow-lg shadow-blue-950 bg-slate-50 dark:bg-[#050b1f] flex items-center justify-center shrink-0 ${
                        record?.foto ? 'cursor-zoom-in hover:scale-105 transition' : 'cursor-default'
                      }`}
                      title={record?.foto ? 'Tocar para ampliar fotografía' : 'Sin foto'}
                    >
                      {record?.foto ? (
                        <img
                          src={record.foto}
                          alt={`Fotografía oficial de ${record?.nombre || 'titular'}`}
                          className="w-full h-full object-cover block"
                          loading="eager"
                          onError={(e) => {
                            // If base64 photo failed to render, show fallback icon
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex flex-col items-center justify-center text-gray-500 ${record?.foto ? 'hidden' : 'flex'}`}
                      >
                        <User className="w-10 h-10 text-sky-700 dark:text-[#37c8ff]/60" />
                        <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-gray-400 mt-1">Sin foto</span>
                      </div>
                    </button>
                    {record?.foto && (
                      <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow pointer-events-none">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        ID OK
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-600 dark:text-[#9db6dd] uppercase font-bold tracking-wider block">
                      Titular del llavero
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900 dark:text-white leading-tight">
                      {record?.nombre || 'Ficha vacía (Sin registrar)'}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {record?.dni && (
                        <span className="text-xs text-sky-700 dark:text-[#37c8ff] font-semibold">DNI: {record.dni}</span>
                      )}
                      {(() => {
                        const v = getMedicalValidationStatus(record);
                        if (v.isDonorValidated) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-300/75 text-amber-800 dark:text-amber-200 text-[9px] font-black uppercase">
                              <Award className="w-2.5 h-2.5 text-amber-700 dark:text-amber-300" />
                              <span>Donante Validado</span>
                            </span>
                          );
                        }
                        if (v.donorState === 'si') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-400/60 text-emerald-800 dark:text-emerald-200 text-[9px] font-bold uppercase">
                              <span>💚 Donante</span>
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {record?.domicilio && (
                      <div className="text-xs text-slate-700 dark:text-gray-300 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-sky-700 dark:text-[#37c8ff] shrink-0" />
                        <span className="truncate max-w-[170px] sm:max-w-none">{record.domicilio}</span>
                      </div>
                    )}
                  </div>
                </div>

                {record?.sangre ? (() => {
                  const v = getMedicalValidationStatus(record);
                  return (
                    <div className="relative shrink-0">
                      <div
                        className={`text-center px-3.5 py-2 rounded-2xl bg-gradient-to-b from-red-600 to-rose-800 text-white border-2 shadow-lg shadow-red-950 ${
                          v.isBloodValidated
                            ? 'border-amber-400 dark:border-amber-300 ring-2 ring-emerald-400/75'
                            : 'border-red-400 dark:border-red-300'
                        }`}
                      >
                        <span className="text-[9px] font-bold tracking-wider block opacity-90">GRUPO</span>
                        <span className="text-2xl sm:text-3xl font-black font-heading tracking-widest">{record.sangre}</span>
                      </div>
                      {v.isBloodValidated && (
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-600 border border-amber-300 text-white text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-0.5 shadow whitespace-nowrap">
                          <BadgeCheck className="w-2.5 h-2.5 text-amber-200" />
                          <span>VALIDADO</span>
                        </span>
                      )}
                    </div>
                  );
                })() : (
                  <div className="shrink-0 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 text-xs text-slate-600 dark:text-gray-400">
                    Sin grupo
                  </div>
                )}
              </div>

              {/* Security Identity Notice (prevents treating wrong person if keychain was stolen or lost) */}
              {record?.foto ? (
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-500/60 flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                  <ShieldCheck className="w-4 h-4 text-sky-700 dark:text-[#37c8ff] shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-slate-900 dark:text-white">Control de Identidad:</strong> Confirme que la persona que sufre la emergencia sea la misma de esta fotografía para verificar que el llavero no pertenezca a un tercero por robo o extravío.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/60 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-amber-700 dark:text-amber-300">Aviso a socorristas:</strong> Ficha sin fotografía cargada. Cotejar nombre con DNI físico antes de suministrar medicamentos específicos.
                  </span>
                </div>
              )}
            </div>

            {/* Validación Sanguínea y Donante de Órganos */}
            <DonorAndBloodStatusCard record={record} compact={true} />

            {/* CÓDIGO QR DIRECTO EN LA FICHA PARA ESCANEAR */}
            <div className="p-4 rounded-2xl bg-white text-[#050b1f] text-center shadow-xl border-4 border-sky-500 dark:border-[#37c8ff]">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1.5 text-xs font-black text-red-600 uppercase tracking-wider">
                  <QrCode className="w-4 h-4 text-red-600 animate-pulse" />
                  <span>CÓDIGO QR DE LA FICHA</span>
                </div>
                {record?.keychainId ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-400 dark:border-emerald-300">
                    🏷️ LLAVERO #{record.keychainId}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                    FICHA ACTIVA
                  </span>
                )}
              </div>

              {/* QR Image */}
              <div className="flex flex-col items-center justify-center my-2.5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR de la Ficha Médica con logo Vortex ID"
                    className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-xl shadow-md border-2 border-gray-900/10 block bg-white"
                  />
                ) : (
                  <div className="w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center bg-gray-100 rounded-xl text-slate-500 dark:text-gray-500 text-xs">
                    Generando QR…
                  </div>
                )}
              </div>

              <div className="text-xs font-black text-[#050b1f] uppercase tracking-wide">
                ESCANEAR CON LA CÁMARA DE CUALQUIER CELULAR
              </div>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Abre al instante esta Ficha con foto, llamadas al 107/911 y GPS
              </p>

              {onOpenQrModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenQrModal();
                  }}
                  className="mt-3 w-full py-2 px-3 rounded-xl bg-white dark:bg-[#07122c] hover:bg-sky-100 dark:hover:bg-[#0f275e] text-slate-900 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5 text-sky-700 dark:text-[#37c8ff]" />
                  <span>Descargar credencial para llavero o fondo de pantalla HD</span>
                </button>
              )}
            </div>

            {/* Alerta Obstétrica en Tiempo Real (Embarazo) */}
            {(() => {
              const preg = calculatePregnancyProgress(record);
              if (!preg) return null;
              return (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-50 dark:from-pink-950/90 via-pink-50/70 dark:via-[#2a0c2e] to-slate-50 dark:to-[#0a1838] border-2 border-pink-400 dark:border-pink-400 shadow-lg space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-pink-700 dark:text-pink-300 uppercase tracking-wider">
                      🤰 EMBARAZO EN CURSO · ACTUALIZADO AL DÍA DE HOY
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white">
                      {preg.trimesterLabel}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {preg.detailedLabel}
                  </div>
                  {preg.dueDateFormatted && (
                    <div className="text-xs text-pink-800 dark:text-pink-200">
                      Fecha probable de parto (FPP): <strong>{preg.dueDateFormatted}</strong>
                    </div>
                  )}
                  {record?.embarazoObstetra && (
                    <div className="text-xs text-pink-800 dark:text-pink-100 bg-slate-100 dark:bg-black/40 p-2 rounded-xl border border-pink-300 dark:border-pink-400/30 mt-1">
                      <strong>Obstetricia:</strong> {record.embarazoObstetra}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Health Conditions */}
            {record?.enf && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0a1838] border border-amber-300 dark:border-amber-500/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Enfermedades preexistentes / Alergias</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{record.enf}</p>
              </div>
            )}

            {/* Medications */}
            {record?.med && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0a1838] border border-sky-300 dark:border-cyan-500/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-cyan-300 uppercase tracking-wider mb-1">
                  <Pill className="w-3.5 h-3.5" />
                  <span>Medicamentos habituales que toma</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{record.med}</p>
              </div>
            )}

            {/* Medicación Diaria y Recordatorios Simples */}
            <DailyMedicationSection
              compact={true}
              defaultExpanded={false}
            />

            {/* Obra Social & Doctor */}
            {(record?.obraSocial || record?.doc) && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0a1838] border border-slate-300 dark:border-[#1e3f8f] space-y-1.5">
                {record?.obraSocial && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-[#9db6dd]">Obra Social / Cobertura:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{record.obraSocial}</span>
                  </div>
                )}
                {record?.doc && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-[#9db6dd]">Médico de cabecera:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{record.doc}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sección de Historial Clínico y Antecedentes (Protegido con PIN) */}
            <ClinicalHistorySection
              record={record}
              isEditing={false}
            />

            {/* Emergency Contacts List */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#07122c] border border-red-300 dark:border-red-500/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                <span>Contactos a avisar de inmediato</span>
              </h4>

              {contacts.length === 0 ? (
                <p className="text-xs text-slate-600 dark:text-[#9db6dd]">
                  No hay contactos cargados en esta ficha.
                </p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50 dark:bg-[#0b1d46] border border-slate-300 dark:border-[#1e3f8f]"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{c.label}</span>
                        <span className="text-xs text-slate-600 dark:text-[#9db6dd] tabular-nums font-mono">{c.phone}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => triggerDirectCall(c.phone!, c.label, 'emergency')}
                          className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md active:scale-95 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Llamar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppTo(c.phone)}
                          className="py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                          title="Enviar alerta por WhatsApp con GPS"
                        >
                          <Send className="w-3 h-3" />
                          <span>Avisar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: Ver QR Llavero & Unlock Edit with PIN */}
            <div className="pt-2">
              {!showPinInput ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onOpenQrModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenQrModal();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-[#0b1d46] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/60 text-xs font-bold text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Ver mi QR de Llavero</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPinInput(true)}
                    className={`py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-[#122e7a] border border-blue-400 dark:border-[#1e5bff]/60 text-xs font-semibold text-gray-300 hover:text-white transition flex items-center justify-center gap-1.5 ${
                      !onOpenQrModal ? 'w-full' : ''
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Modificar datos (Clave PIN)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#07122c] border border-sky-500 dark:border-[#37c8ff] space-y-2 animate-fade-in">
                  {!showRecoveryMode ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#9db6dd]">
                        <span>Ingresá tu clave numérica para editar:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPinInput(false);
                            setShowRecoveryMode(false);
                            setPinError('');
                            setPin('');
                          }}
                          className="text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white"
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
                            value={pin}
                            onChange={(e) => {
                              setPin(e.target.value);
                              if (pinError) setPinError('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlockEdit()}
                            className="w-full py-2 pl-3 pr-10 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-blue-500 dark:border-[#1e5bff] text-center text-lg text-slate-900 dark:text-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowUnlockPin((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white p-1"
                            aria-label={showUnlockPin ? 'Ocultar clave PIN' : 'Mostrar clave PIN'}
                          >
                            {showUnlockPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleUnlockEdit}
                          className="py-2 px-4 rounded-xl bg-[#1e5bff] text-white font-bold text-xs shadow transition active:scale-95"
                        >
                          Abrir
                        </button>
                      </div>
                      {pinError && <p className="text-xs text-red-700 dark:text-red-400 font-semibold">{pinError}</p>}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            playChirp('click');
                            setPinError('');
                            setShowRecoveryMode(true);
                          }}
                          className="text-xs text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white underline underline-offset-4 flex items-center gap-1.5 font-semibold transition"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>¿Olvidaste tu clave? Recuperar</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <PersonalPinRecoveryBox
                      record={record}
                      onCancel={() => setShowRecoveryMode(false)}
                      onRecovered={() => {
                        setShowRecoveryMode(false);
                        setShowPinInput(false);
                        setIsEditing(true);
                        setEditForm(record || {});
                        setPin('');
                        setPinError('');
                        setStatusMessage('✔ Clave restablecida. Ya podés modificar tu ficha.');
                        setTimeout(() => setStatusMessage(''), 4000);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Fast Action Buttons: WhatsApp SOS & 107/911 */}
        {!isEditing && (
          <div className="mt-4 pt-3 border-t border-red-300 dark:border-red-500/30 space-y-2">
            <div className="text-[11px] flex items-center justify-between gap-2 px-1 flex-wrap">
              {manualAccidentCoords ? (
                <span className="text-sky-700 dark:text-cyan-300 font-semibold">
                  📍 Esquina del accidente: {manualAccidentCoords.label}
                </span>
              ) : activeEmergencyCoords ? (
                <span className={`font-semibold ${freshness?.isStale ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {freshness?.isStale ? '🕒 GPS anterior' : '✅ GPS real listo'} ({activeEmergencyCoords.lat.toFixed(4)}, {activeEmergencyCoords.lng.toFixed(4)}
                  {freshness?.accuracyMeters ? ` · ±${freshness.accuracyMeters}m` : ''}
                  {freshness?.ageLabel ? ` · ${freshness.ageLabel}` : ''}
                  {` · ${describePuntaAltaLocation(activeEmergencyCoords)}`})
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                  ⚠️ {gpsStatus || 'GPS sin señal aún (podés marcar la esquina o enviar igual)'}
                </span>
              )}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {activeEmergencyCoords && (
                  <a
                    href={`https://www.google.com/maps?q=${activeEmergencyCoords.lat},${activeEmergencyCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-800 dark:text-emerald-200 hover:text-slate-950 dark:hover:text-white underline font-bold inline-flex items-center gap-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver punto</span>
                  </a>
                )}
                {manualAccidentCoords ? (
                  <button
                    type="button"
                    onClick={() => {
                      playChirp('click');
                      setManualAccidentCoords(null);
                      onRequestCoords?.();
                    }}
                    className="text-emerald-700 dark:text-emerald-300 hover:text-slate-950 dark:hover:text-white underline font-bold inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Usar GPS</span>
                  </button>
                ) : (
                  onRequestCoords && (
                    <button
                      type="button"
                      onClick={() => {
                        playChirp('click');
                        onRequestCoords();
                      }}
                      className="text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white underline font-bold inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{activeEmergencyCoords ? 'Actualizar' : 'Activar GPS'}</span>
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowCornerPicker((v) => !v);
                    setCornerError('');
                  }}
                  className="text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white underline font-bold inline-flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{showCornerPicker ? 'Cerrar' : 'Esquina'}</span>
                </button>
              </div>
            </div>

            {showCornerPicker && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#040a1b] border border-sky-300 dark:border-cyan-400/50 space-y-2 text-xs animate-fade-in">
                <form onSubmit={handleApplyManualCorner} className="flex gap-1.5">
                  <input
                    type="text"
                    value={cornerQuery}
                    onChange={(e) => {
                      setCornerQuery(e.target.value);
                      if (cornerError) setCornerError('');
                    }}
                    placeholder="Calle o esquina del accidente (ej: Brown y Paso)"
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e4594] text-slate-900 dark:text-white text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isResolvingCorner}
                    className="py-1.5 px-3 rounded-lg bg-cyan-500 text-black font-bold text-xs shrink-0"
                  >
                    {isResolvingCorner ? '…' : 'Fijar'}
                  </button>
                </form>
                {cornerError && <p className="text-[11px] text-red-700 dark:text-red-300 font-semibold">{cornerError}</p>}
                <div className="flex flex-wrap gap-1">
                  {POPULAR_PUNTA_ALTA_SPOTS.slice(0, 4).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => {
                        playChirp('click');
                        setManualAccidentCoords({ ...spot.coords, source: 'manual', label: spot.label });
                        setShowCornerPicker(false);
                      }}
                      className="px-2 py-0.5 rounded bg-white dark:bg-[#0a1838] border border-slate-300 dark:border-[#1e3f8f] text-[10px] text-slate-700 dark:text-gray-200"
                    >
                      {spot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Share with GPS button */}
            <button
              type="button"
              onClick={() => handleSendWhatsAppTo()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-950 transition active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Compartir alerta con mi ubicación actual (WhatsApp)</span>
            </button>

            {/* Quick 107 & 911 calls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => triggerDirectCall('107', '107 Emergencias Médicas', 'emergency')}
                className="py-3 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>107 Ambulancia</span>
              </button>

              <button
                type="button"
                onClick={() => triggerDirectCall('911', '911 Policía Punta Alta', 'emergency')}
                className="py-3 px-3 rounded-xl bg-rose-50 dark:bg-rose-900/90 hover:bg-rose-800 border border-red-400 dark:border-red-500 text-red-800 dark:text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>911 Policía</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Photo Zoom Preview */}
      {isPhotoZoomOpen && record?.foto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 dark:bg-black/90 backdrop-blur-md"
          onClick={() => setIsPhotoZoomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#07122c] border-2 border-sky-500 dark:border-[#37c8ff] p-5 shadow-2xl space-y-3 text-center text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-[#37c8ff] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Fotografía del Titular</span>
            </div>
            <div className="w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-slate-50 dark:bg-[#050b1f]">
              <img
                src={record.foto}
                alt={record.nombre || 'Foto del titular'}
                className="w-full h-full object-cover block"
              />
            </div>
            {record.nombre && (
              <div className="text-lg font-black font-heading text-slate-900 dark:text-white">{record.nombre}</div>
            )}
            <button
              type="button"
              onClick={() => setIsPhotoZoomOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#1e5bff] hover:bg-blue-500 text-white font-bold text-xs shadow active:scale-95 transition"
            >
              Cerrar vista ampliada
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
