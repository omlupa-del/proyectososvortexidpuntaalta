import React, { useEffect, useRef, useState } from 'react';
import {
  FileCheck2,
  Upload,
  Trash2,
  HeartHandshake,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ZoomIn,
  Building2,
  AlertCircle,
  X,
  BadgeCheck,
  Award,
  Check
} from 'lucide-react';
import { MedicalRecord } from '../utils/medicalData';
import { compressDocumentCertificate } from '../utils/imageCompressor';

export const INCUCAI_OFFICIAL_URL = 'https://www.argentina.gob.ar/salud/incucai';

export interface MedicalValidationStatus {
  hasBlood: boolean;
  hasBloodCert: boolean;
  hasBloodLab: boolean;
  isBloodValidated: boolean;
  donorState: 'si' | 'no' | '';
  hasDonorCert: boolean;
  hasDonorReg: boolean;
  isDonorValidated: boolean;
  isDualVerified: boolean;
}

export function getMedicalValidationStatus(
  record: MedicalRecord | null | undefined
): MedicalValidationStatus {
  const hasBlood = Boolean(record?.sangre);
  const hasBloodCert = Boolean(record?.sangreCertificado || record?.sangreTieneDoc);
  const hasBloodLab = Boolean(record?.sangreLaboratorio?.trim());
  const isBloodValidated = hasBlood && (hasBloodCert || hasBloodLab);

  const donorState = (record?.donanteOrganos || '') as 'si' | 'no' | '';
  const hasDonorCert = Boolean(record?.donanteCertificado || record?.donanteTieneDoc);
  const hasDonorReg = Boolean(record?.donanteRegistro?.trim());
  const isDonorValidated = donorState === 'si' && (hasDonorCert || hasDonorReg);

  return {
    hasBlood,
    hasBloodCert,
    hasBloodLab,
    isBloodValidated,
    donorState,
    hasDonorCert,
    hasDonorReg,
    isDonorValidated,
    isDualVerified: isBloodValidated && isDonorValidated
  };
}

/**
 * Crisp rosette seal SVG used to visually distinguish validated blood type / organ donor backing
 */
export const ValidationSealEmblem: React.FC<{
  tone?: 'gold' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
}> = ({ tone = 'gold', size = 'md' }) => {
  const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const strokeMain = tone === 'gold' ? '#fbbf24' : '#34d399';
  const fillBg = tone === 'gold' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(16, 185, 129, 0.22)';
  const checkColor = tone === 'gold' ? '#fef3c7' : '#d1fae5';

  return (
    <div className={`relative ${dim} shrink-0 flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-md">
        <circle cx="24" cy="24" r="21" fill={fillBg} stroke={strokeMain} strokeWidth="2.4" strokeDasharray="4 2" />
        <circle cx="24" cy="24" r="16" fill="#061423" stroke={strokeMain} strokeWidth="2" />
        <path
          d="M16.5 24.5L21.5 29.5L32 18.5"
          fill="none"
          stroke={checkColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

interface BloodAndDonorFieldsProps {
  formData: MedicalRecord;
  onChange: (field: keyof MedicalRecord, value: any) => void;
  compact?: boolean;
}

export const BloodAndDonorFields: React.FC<BloodAndDonorFieldsProps> = ({
  formData,
  onChange,
  compact = false
}) => {
  const bloodInputRef = useRef<HTMLInputElement | null>(null);
  const donorInputRef = useRef<HTMLInputElement | null>(null);
  const [bloodUploading, setBloodUploading] = useState(false);
  const [donorUploading, setDonorUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; subtitle?: string; src: string } | null>(null);
  const [donorFlashKey, setDonorFlashKey] = useState(0);
  const [donorScaleActive, setDonorScaleActive] = useState(false);
  const [donorSavedToast, setDonorSavedToast] = useState(false);
  const flashTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const triggerDonorFeedback = () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);

    setDonorScaleActive(false);
    setDonorFlashKey((k) => k + 1);
    setDonorSavedToast(true);

    window.requestAnimationFrame(() => {
      setDonorScaleActive(true);
    });

    flashTimerRef.current = window.setTimeout(() => {
      setDonorScaleActive(false);
    }, 520);

    toastTimerRef.current = window.setTimeout(() => {
      setDonorSavedToast(false);
    }, 2200);
  };

  const validation = getMedicalValidationStatus(formData);

  const handleUploadCertificate = async (
    file: File | undefined,
    field: 'sangreCertificado' | 'donanteCertificado',
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!file) return;
    setUploadError('');
    setLoading(true);
    try {
      const compressed = await compressDocumentCertificate(file);
      onChange(field, compressed);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'No se pudo procesar esa imagen. Probá con JPG o PNG.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDonor = (val: 'si' | 'no' | '') => {
    onChange('donanteOrganos', val);
    if (val === 'si') {
      triggerDonorFeedback();
    } else {
      setDonorScaleActive(false);
      setDonorSavedToast(false);
    }
    if (val === 'no') {
      onChange('donanteRegistro', '');
      onChange('donanteCertificado', '');
    }
  };

  return (
    <div className="space-y-3">
      {/* Live Distinction Banner inside Edit Form when blood/donor backing is confirmed */}
      {(validation.isBloodValidated || validation.isDonorValidated) && (
        <div
          className={`rounded-2xl border-2 p-3 flex items-center justify-between gap-3 shadow-lg animate-fade-in ${
            validation.isDualVerified
              ? 'bg-gradient-to-r from-amber-50 dark:from-amber-950/60 via-teal-50/70 dark:via-[#0c261f] to-emerald-50 dark:to-emerald-950/75 border-amber-300 dark:border-amber-400/80'
              : 'bg-gradient-to-r from-emerald-50 dark:from-[#07211d] to-slate-50 dark:to-[#0a1b36] border-emerald-300 dark:border-emerald-400/70'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ValidationSealEmblem
              tone={validation.isDualVerified ? 'gold' : 'emerald'}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[11px] font-black uppercase tracking-wider ${
                    validation.isDualVerified ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {validation.isDualVerified
                    ? '★ Distinción Doble Activa en Ficha'
                    : '✓ Sello de Respaldo Activo'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                {validation.isDualVerified
                  ? `Grupo ${formData.sangre} validado + Donante de órganos confirmado.`
                  : validation.isBloodValidated
                    ? `Grupo sanguíneo ${formData.sangre} con respaldo visual confirmado.`
                    : 'Condición de donante de órganos con respaldo confirmado.'}
              </p>
              <p className="text-[10px] text-slate-700 dark:text-[#b4ccf0]">
                Los rescatistas verán este sello dorado/verde al escanear tu QR o abrir tu credencial.
              </p>
            </div>
          </div>
          <Award
            className={`w-6 h-6 shrink-0 hidden sm:block ${
              validation.isDualVerified ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}
          />
        </div>
      )}

      {/* 1. Validación / Constancia de Grupo Sanguíneo */}
      <div
        className={`rounded-2xl border transition-all ${
          validation.isBloodValidated
            ? 'bg-gradient-to-br from-white dark:from-[#091c2f] to-slate-50 dark:to-[#07122c] border-emerald-300 dark:border-emerald-400/65 shadow-md'
            : 'bg-white dark:bg-[#07122c] border-rose-300 dark:border-rose-500/40'
        } ${compact ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'}`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                validation.isBloodValidated
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400/60'
                  : 'bg-rose-100 dark:bg-rose-500/20 border-rose-400/50'
              }`}
            >
              {validation.isBloodValidated ? (
                <BadgeCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <FileCheck2 className="w-4 h-4 text-rose-700 dark:text-rose-300" />
              )}
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block leading-tight">
                Respaldo de Grupo Sanguíneo {formData.sangre ? `(${formData.sangre})` : '(opcional)'}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-[#9db6dd] block leading-tight">
                Subí tu estudio de laboratorio o carnet para activar el sello visual de validación.
              </span>
            </div>
          </div>

          {validation.isBloodValidated ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-400/60 inline-flex items-center gap-1">
              <BadgeCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
              <span>{formData.sangreCertificado ? 'Validado con estudio' : 'Validado por lab.'}</span>
            </span>
          ) : formData.sangre ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-400/40">
              Sin respaldo adjunto
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-rose-800 dark:text-rose-200 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
              <span>Laboratorio / Hospital que realizó la tipificación</span>
            </label>
            <input
              type="text"
              maxLength={140}
              placeholder="Ej: Hosp. Naval Puerto Belgrano / Lab. Central"
              value={formData.sangreLaboratorio || ''}
              onChange={(e) => onChange('sangreLaboratorio', e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-rose-300 dark:border-rose-500/40 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-300"
            />
          </div>

          <div>
            <input
              ref={bloodInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleUploadCertificate(e.target.files?.[0], 'sangreCertificado', setBloodUploading);
                e.currentTarget.value = '';
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={bloodUploading}
                onClick={() => bloodInputRef.current?.click()}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 hover:bg-rose-100 dark:hover:bg-rose-900/90 border border-rose-300 dark:border-rose-400/60 text-rose-800 dark:text-rose-100 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {bloodUploading
                    ? 'Procesando imagen...'
                    : formData.sangreCertificado
                      ? 'Cambiar foto de estudio'
                      : 'Adjuntar foto de estudio / carnet'}
                </span>
              </button>

              {formData.sangreCertificado && (
                <button
                  type="button"
                  onClick={() => onChange('sangreCertificado', '')}
                  className="p-2 rounded-xl bg-red-50 dark:bg-red-950/70 hover:bg-red-100 dark:hover:bg-red-900 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 transition"
                  title="Quitar constancia sanguínea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {formData.sangreCertificado && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-emerald-300 dark:border-emerald-500/50">
            <button
              type="button"
              onClick={() =>
                setPreviewDoc({
                  title: `Constancia de Grupo Sanguíneo${formData.sangre ? ` (${formData.sangre})` : ''}`,
                  subtitle: formData.sangreLaboratorio || 'Documento cargado por el titular',
                  src: formData.sangreCertificado!
                })
              }
              className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-300 dark:border-emerald-400/60 shrink-0 group"
              title="Ampliar constancia"
            >
              <img
                src={formData.sangreCertificado}
                alt="Vista previa estudio sanguíneo"
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 bg-slate-100 dark:bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <ZoomIn className="w-4 h-4 text-slate-900 dark:text-white" />
              </span>
            </button>
            <div className="min-w-0 flex-1 text-[11px]">
              <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" />
                <span>Estudio cargado · Distinción de validez activa</span>
              </div>
              <p className="text-slate-600 dark:text-[#9db6dd] leading-snug">
                Tocá la miniatura para revisar nitidez. En guardia hospitalaria igualmente rige la prueba cruzada.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Donante de Órganos y Tejidos (INCUCAI / Ley Justina 27.447) */}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          donorScaleActive ? 'animate-donor-scale-up ring-2 ring-emerald-300/60' : ''
        } ${
          formData.donanteOrganos === 'si'
            ? validation.isDonorValidated
              ? 'bg-gradient-to-br from-emerald-50 dark:from-emerald-950/75 via-teal-50/70 dark:via-[#07261e] to-slate-50 dark:to-[#0a1c2e] border-amber-300 dark:border-amber-400/75 shadow-lg shadow-emerald-950/40'
              : 'bg-gradient-to-br from-emerald-50 dark:from-emerald-950/65 via-teal-50/70 dark:via-[#07211d] to-slate-50 dark:to-[#07122c] border-emerald-300 dark:border-emerald-400/75 shadow-lg shadow-emerald-950/30'
            : formData.donanteOrganos === 'no'
              ? 'bg-white dark:bg-[#0b1328] border-amber-300 dark:border-amber-400/50'
              : 'bg-white dark:bg-[#07122c] border-emerald-300 dark:border-emerald-500/30'
        } ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
      >
        {donorFlashKey > 0 && formData.donanteOrganos === 'si' && (
          <span
            key={donorFlashKey}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent animate-donor-shimmer"
          />
        )}

        <div className="relative flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ${
                formData.donanteOrganos === 'si'
                  ? 'bg-emerald-100 dark:bg-emerald-500/30 border-emerald-300/80 shadow-sm shadow-emerald-400/30'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400/60'
              } ${donorScaleActive ? 'scale-110' : ''}`}
            >
              <HeartHandshake className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block leading-tight">
                Donante de Órganos y Tejidos (INCUCAI · Ley 27.447)
              </span>
              <span className="text-[11px] text-slate-600 dark:text-[#9db6dd] block leading-tight">
                Indicá tu voluntad y adjuntá credencial Mi Argentina / INCUCAI para activar la distinción verificada.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {donorSavedToast && formData.donanteOrganos === 'si' && (
              <span
                key={`toast-${donorFlashKey}`}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-400/25 text-emerald-800 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-300/80 inline-flex items-center gap-1 animate-donor-badge-pop shadow-sm shadow-emerald-500/25"
              >
                <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-300 stroke-[3]" />
                <span>Marcado en ficha</span>
              </span>
            )}
            {validation.isDonorValidated && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-300/70 inline-flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                <span>Donante confirmado</span>
              </span>
            )}
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-pressed={formData.donanteOrganos === 'si'}
            onClick={() => handleSelectDonor('si')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 inline-flex items-center justify-center gap-1.5 ${
              donorScaleActive ? 'animate-donor-scale-up' : ''
            } ${
              formData.donanteOrganos === 'si'
                ? 'bg-emerald-100 dark:bg-emerald-600/40 border-emerald-300 text-emerald-50 shadow-md shadow-emerald-900/50'
                : 'bg-slate-50 dark:bg-[#050b1f] border-slate-300 dark:border-[#1e3f8f] text-slate-700 dark:text-gray-300 hover:border-emerald-500 dark:hover:border-emerald-400/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all duration-200 ${
                formData.donanteOrganos === 'si'
                  ? 'bg-emerald-400 border-emerald-200 text-slate-950 scale-105'
                  : 'bg-white dark:bg-[#07122c] border-blue-400 dark:border-[#365ec9] text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check
                key={donorFlashKey}
                className={`w-3 h-3 stroke-[3] ${
                  formData.donanteOrganos === 'si' ? 'animate-donor-badge-pop' : ''
                }`}
              />
            </span>
            <span>Sí, soy donante</span>
          </button>
          <button
            type="button"
            aria-pressed={formData.donanteOrganos === 'no'}
            onClick={() => handleSelectDonor('no')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
              formData.donanteOrganos === 'no'
                ? 'bg-amber-100 dark:bg-amber-600/30 border-amber-400 text-amber-800 dark:text-amber-100 shadow'
                : 'bg-slate-50 dark:bg-[#050b1f] border-slate-300 dark:border-[#1e3f8f] text-slate-700 dark:text-gray-300 hover:border-amber-500 dark:hover:border-amber-400/60'
            }`}
          >
            No donante
          </button>
          <button
            type="button"
            aria-pressed={!formData.donanteOrganos}
            onClick={() => handleSelectDonor('')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
              !formData.donanteOrganos
                ? 'bg-[#1e5bff]/30 border-sky-500 dark:border-[#37c8ff] text-white shadow'
                : 'bg-slate-50 dark:bg-[#050b1f] border-slate-300 dark:border-[#1e3f8f] text-slate-700 dark:text-gray-300 hover:border-[#37c8ff]/60'
            }`}
          >
            Sin especificar
          </button>
        </div>

        {formData.donanteOrganos === 'si' && (
          <div className="space-y-2.5 pt-2 border-t border-emerald-300 dark:border-emerald-400/30 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                  N° de acta / constancia INCUCAI o Mi Argentina (opcional)
                </label>
                <input
                  type="text"
                  maxLength={110}
                  placeholder="Ej: Acta INCUCAI N° 482910 · Mi Argentina"
                  value={formData.donanteRegistro || ''}
                  onChange={(e) => onChange('donanteRegistro', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-emerald-300 dark:border-emerald-400/50 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-300"
                />
              </div>

              <div>
                <input
                  ref={donorInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleUploadCertificate(e.target.files?.[0], 'donanteCertificado', setDonorUploading);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={donorUploading}
                    onClick={() => donorInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-400/70 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {donorUploading
                        ? 'Procesando imagen...'
                        : formData.donanteCertificado
                          ? 'Cambiar constancia INCUCAI'
                          : 'Adjuntar captura Mi Argentina / INCUCAI'}
                    </span>
                  </button>

                  {formData.donanteCertificado && (
                    <button
                      type="button"
                      onClick={() => onChange('donanteCertificado', '')}
                      className="p-2 rounded-xl bg-red-50 dark:bg-red-950/70 hover:bg-red-100 dark:hover:bg-red-900 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 transition"
                      title="Quitar constancia INCUCAI"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {formData.donanteCertificado && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-amber-300 dark:border-amber-400/60">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      title: 'Constancia de Donante de Órganos',
                      subtitle: formData.donanteRegistro || 'Credencial Mi Argentina / INCUCAI adjunta',
                      src: formData.donanteCertificado!
                    })
                  }
                  className="relative w-14 h-14 rounded-lg overflow-hidden border border-amber-300 dark:border-amber-300/80 shrink-0 group"
                  title="Ampliar constancia de donante"
                >
                  <img
                    src={formData.donanteCertificado}
                    alt="Vista previa constancia de donante"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-slate-100 dark:bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <ZoomIn className="w-4 h-4 text-slate-900 dark:text-white" />
                  </span>
                </button>
                <div className="min-w-0 flex-1 text-[11px]">
                  <div className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                    <span>Constancia INCUCAI cargada · Distinción activa</span>
                  </div>
                  <p className="text-slate-600 dark:text-[#9db6dd] leading-snug">
                    Los rescatistas y el hospital podrán ampliar esta credencial. El registro oficial SINTRA / INCUCAI prevalece legalmente.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-emerald-800 dark:text-emerald-200/85 pt-0.5">
              <span>
                La validez legal definitiva se consulta en el padrón oficial SINTRA / INCUCAI.
              </span>
              <a
                href={INCUCAI_OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 hover:text-slate-950 dark:hover:text-white underline shrink-0"
              >
                <span>Consultar / tramitar en INCUCAI</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {formData.donanteOrganos === 'no' && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-400/40 text-[11px] text-amber-800 dark:text-amber-100 leading-snug">
            Quedará visible tu manifestación expresa de <strong>NO donante</strong>. Para que tenga validez legal plena en Argentina (Ley 27.447), asegurate de registrarla también en <strong>Mi Argentina / INCUCAI</strong>.
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-400 dark:border-red-400 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Modal de vista previa en edición */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 dark:bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#07122c] border-2 border-emerald-400 dark:border-emerald-400 p-4 shadow-2xl space-y-3 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-emerald-700 dark:text-emerald-300">{previewDoc.title}</h4>
                {previewDoc.subtitle && (
                  <p className="text-xs text-slate-600 dark:text-[#9db6dd]">{previewDoc.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200/70 dark:hover:bg-white/20 text-slate-900 dark:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-white/20 max-h-[65vh] flex items-center justify-center">
              <img
                src={previewDoc.src}
                alt={previewDoc.title}
                className="max-h-[65vh] w-auto object-contain block"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DonorAndBloodStatusCardProps {
  record: MedicalRecord | null | undefined;
  compact?: boolean;
}

export const DonorAndBloodStatusCard: React.FC<DonorAndBloodStatusCardProps> = ({
  record,
  compact = false
}) => {
  const [zoomDoc, setZoomDoc] = useState<{ title: string; subtitle?: string; src: string } | null>(null);

  if (!record) return null;

  const status = getMedicalValidationStatus(record);
  const hasBloodCertImg = Boolean(record.sangreCertificado);
  const hasDonorCertImg = Boolean(record.donanteCertificado);

  if (!status.hasBlood && !status.donorState) return null;

  return (
    <>
      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {/* DISTINCIÓN VISUAL DE VALIDEZ CONFIRMADA (cuando Sangre y/o Donante cuentan con respaldo verificable) */}
        {(status.isBloodValidated || status.isDonorValidated) && (
          <div
            className={`relative overflow-hidden rounded-2xl border-2 shadow-xl ${
              status.isDualVerified
                ? 'bg-gradient-to-r from-amber-50 dark:from-[#1f1604] via-teal-50/70 dark:via-[#07261c] to-slate-50 dark:to-[#071a33] border-amber-300 dark:border-amber-300/85'
                : 'bg-gradient-to-r from-emerald-50 dark:from-[#06231d] via-teal-50/70 dark:via-[#071f26] to-slate-50 dark:to-[#08152e] border-emerald-300 dark:border-emerald-400/80'
            } ${compact ? 'p-2.5' : 'p-3.5'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <ValidationSealEmblem
                  tone={status.isDualVerified ? 'gold' : 'emerald'}
                  size={compact ? 'sm' : 'md'}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-wider ${
                        status.isDualVerified ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {status.isDualVerified
                        ? '★ DISTINCIÓN DE VALIDEZ VERIFICADA (DOBLE RESPALDO)'
                        : '✓ SELLO DE VALIDEZ VISUAL CONFIRMADA'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {status.isBloodValidated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-100 border border-emerald-300/60">
                        <BadgeCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                        <span>Grupo {record.sangre} Validado</span>
                      </span>
                    )}
                    {status.isDonorValidated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-400/20 text-amber-800 dark:text-amber-100 border border-amber-300 dark:border-amber-300/70">
                        <Award className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                        <span>Donante INCUCAI Confirmado</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                {hasBloodCertImg && (
                  <button
                    type="button"
                    onClick={() =>
                      setZoomDoc({
                        title: `Constancia Grupo Sanguíneo ${record.sangre || ''}`,
                        subtitle: record.sangreLaboratorio || 'Estudio / carnet adjuntado por el titular',
                        src: record.sangreCertificado!
                      })
                    }
                    className="w-10 h-10 rounded-lg overflow-hidden border-2 border-emerald-300 dark:border-emerald-300/80 shadow hover:scale-105 transition"
                    title="Ampliar estudio de sangre"
                  >
                    <img
                      src={record.sangreCertificado}
                      alt="Miniatura estudio sanguíneo"
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
                {hasDonorCertImg && (
                  <button
                    type="button"
                    onClick={() =>
                      setZoomDoc({
                        title: 'Constancia de Donante de Órganos',
                        subtitle: record.donanteRegistro || 'Credencial Mi Argentina / INCUCAI adjuntada por titular',
                        src: record.donanteCertificado!
                      })
                    }
                    className="w-10 h-10 rounded-lg overflow-hidden border-2 border-amber-300 dark:border-amber-300/80 shadow hover:scale-105 transition"
                    title="Ampliar constancia INCUCAI"
                  >
                    <img
                      src={record.donanteCertificado}
                      alt="Miniatura constancia donante"
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Respaldo de Validación Sanguínea */}
        {status.hasBlood && (
          <div
            className={`rounded-xl border flex items-center justify-between gap-2.5 flex-wrap ${
              status.isBloodValidated
                ? 'bg-sky-50 dark:bg-[#071b2e] border-emerald-300 dark:border-emerald-400/60 shadow-md'
                : 'bg-white dark:bg-[#08132c] border-slate-200 dark:border-[#1a3366]'
            } ${compact ? 'p-2.5 text-xs' : 'p-3 text-xs sm:text-sm'}`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {status.isBloodValidated ? (
                <BadgeCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Grupo {record.sangre}:
                  </span>
                  {hasBloodCertImg ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-400/60 inline-flex items-center gap-1">
                      <span>✓ Validado con estudio</span>
                    </span>
                  ) : status.hasBloodCert ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-400/60">
                      ✓ Constancia en nube
                    </span>
                  ) : status.hasBloodLab ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-100 dark:bg-cyan-500/25 text-sky-800 dark:text-cyan-100 border border-cyan-400/60">
                      ✓ Validado por Lab.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-400/40">
                      Declarado por titular (sin estudio adjunto)
                    </span>
                  )}
                </div>
                {status.hasBloodLab && (
                  <p className="text-[11px] text-slate-700 dark:text-[#b4ccf0] mt-0.5 truncate">
                    Centro / Lab.: <strong className="text-slate-900 dark:text-white">{record.sangreLaboratorio}</strong>
                  </p>
                )}
                <p className="text-[10px] text-slate-600 dark:text-[#8ba6d6] mt-0.5 leading-snug">
                  En transfusión hospitalaria rige siempre la prueba cruzada de guardia.
                </p>
              </div>
            </div>

            {hasBloodCertImg && (
              <button
                type="button"
                onClick={() =>
                  setZoomDoc({
                    title: `Constancia Grupo Sanguíneo ${record.sangre || ''}`,
                    subtitle: record.sangreLaboratorio || 'Estudio / carnet adjuntado por el titular',
                    src: record.sangreCertificado!
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/70 text-emerald-800 dark:text-emerald-100 hover:text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition active:scale-95"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Ver estudio</span>
              </button>
            )}
          </div>
        )}

        {/* Condición de Donante de Órganos (INCUCAI) */}
        {status.donorState === 'si' && (
          <div
            className={`rounded-2xl border shadow-lg ${
              status.isDonorValidated
                ? 'bg-gradient-to-r from-emerald-50 dark:from-emerald-950/90 via-teal-50/70 dark:via-[#082b21] to-white dark:to-[#171d0c] border-amber-300 dark:border-amber-300/75'
                : 'bg-gradient-to-r from-emerald-50 dark:from-emerald-950/85 via-teal-50/70 dark:via-[#07261f] to-slate-50 dark:to-[#061326] border-emerald-300 dark:border-emerald-400/70'
            } ${compact ? 'p-3 space-y-1.5' : 'p-3.5 sm:p-4 space-y-2'}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-100">
                  Donante de Órganos y Tejidos
                </span>
              </div>
              {hasDonorCertImg ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-300/70 inline-flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                  <span>✓ Confirmado con constancia</span>
                </span>
              ) : status.hasDonorCert ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-300/70">
                  ✓ Constancia en nube
                </span>
              ) : status.hasDonorReg ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-400/60">
                  ✓ Con N° de registro
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-black/35 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40">
                  Voluntad declarada
                </span>
              )}
            </div>

            {record.donanteRegistro && (
              <div className="text-xs text-slate-900 dark:text-white font-semibold bg-slate-100 dark:bg-black/35 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/35">
                Registro / Acta: <span className="text-amber-800 dark:text-amber-200">{record.donanteRegistro}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <p className="text-[11px] text-emerald-800 dark:text-emerald-100/85 leading-snug">
                Respaldo cargado por el titular · Validación oficial en padrón SINTRA / INCUCAI (Ley 27.447).
              </p>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {hasDonorCertImg && (
                  <button
                    type="button"
                    onClick={() =>
                      setZoomDoc({
                        title: 'Constancia de Donante de Órganos',
                        subtitle: record.donanteRegistro || 'Credencial Mi Argentina / INCUCAI adjuntada por titular',
                        src: record.donanteCertificado!
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition active:scale-95"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Ver constancia INCUCAI</span>
                  </button>
                )}

                <a
                  href={INCUCAI_OFFICIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-[#051814] hover:bg-emerald-100 dark:hover:bg-[#092922] border border-emerald-300 dark:border-emerald-400/50 text-emerald-800 dark:text-emerald-200 hover:text-slate-950 dark:hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition"
                >
                  <span>Verificar INCUCAI</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {status.donorState === 'no' && (
          <div
            className={`rounded-xl bg-[#161006] border border-amber-500/50 flex items-start justify-between gap-2 flex-wrap ${
              compact ? 'p-2.5 text-xs' : 'p-3 text-xs sm:text-sm'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-amber-800 dark:text-amber-200 uppercase text-[11px] sm:text-xs">
                  Manifestó NO ser donante de órganos
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-100/80 leading-snug">
                  Oposición declarada por el titular en ficha · Confirmar en padrón oficial SINTRA / INCUCAI (Ley 27.447).
                </p>
              </div>
            </div>
            <a
              href={INCUCAI_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-black/40 border border-amber-300 dark:border-amber-400/40 text-amber-800 dark:text-amber-200 hover:text-slate-950 dark:hover:text-white text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
            >
              <span>SINTRA / INCUCAI</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Modal fullscreen para constancias en vista de emergencia / titular */}
      {zoomDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 dark:bg-black/90 backdrop-blur-md print:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomDoc(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-50 dark:bg-[#060d20] border-2 border-emerald-400 dark:border-emerald-400 p-4 sm:p-5 shadow-2xl space-y-3 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">{zoomDoc.title}</span>
                </div>
                {zoomDoc.subtitle && (
                  <p className="text-xs text-slate-600 dark:text-[#9db6dd] mt-0.5">{zoomDoc.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setZoomDoc(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200/70 dark:hover:bg-white/20 text-slate-900 dark:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-white/20 max-h-[65vh] flex items-center justify-center">
              <img
                src={zoomDoc.src}
                alt={zoomDoc.title}
                className="max-h-[65vh] w-auto object-contain block"
              />
            </div>

            <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] text-center leading-snug">
              Documento cargado por el titular como respaldo visual. Verificá los datos oficiales de identidad y padrón clínico según protocolo médico.
            </p>

            <button
              type="button"
              onClick={() => setZoomDoc(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow active:scale-95 transition"
            >
              Cerrar constancia
            </button>
          </div>
        </div>
      )}
    </>
  );
};
