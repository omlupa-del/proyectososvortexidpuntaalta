import React, { useRef, useState } from 'react';
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
  X
} from 'lucide-react';
import { MedicalRecord } from '../utils/medicalData';
import { compressDocumentCertificate } from '../utils/imageCompressor';

export const INCUCAI_OFFICIAL_URL = 'https://www.argentina.gob.ar/salud/incucai';

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
    if (val !== 'si') {
      // Keep fields clean if user explicitly picks no or unsets
      if (val === 'no') {
        onChange('donanteRegistro', '');
        onChange('donanteCertificado', '');
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Validación / Constancia de Grupo Sanguíneo */}
      <div
        className={`rounded-2xl border bg-[#07122c] border-rose-500/40 ${
          compact ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'
        }`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4 text-rose-300" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-white block leading-tight">
                Respaldo de Grupo Sanguíneo {formData.sangre ? `(${formData.sangre})` : '(opcional)'}
              </span>
              <span className="text-[11px] text-[#9db6dd] block leading-tight">
                Subí tu estudio de laboratorio, libreta o carnet de donante para darle validez visual en la guardia.
              </span>
            </div>
          </div>

          {formData.sangreCertificado ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
              ✓ Constancia adjunta
            </span>
          ) : formData.sangreLaboratorio ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/50">
              Lab. declarado
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-rose-200 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-rose-300" />
              <span>Laboratorio / Hospital que realizó la tipificación</span>
            </label>
            <input
              type="text"
              maxLength={140}
              placeholder="Ej: Hosp. Naval Puerto Belgrano / Lab. Central"
              value={formData.sangreLaboratorio || ''}
              onChange={(e) => onChange('sangreLaboratorio', e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-rose-500/40 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-300"
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
                className="flex-1 py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 border border-rose-400/60 text-rose-100 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60"
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
                  className="p-2 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300 transition"
                  title="Quitar constancia sanguínea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {formData.sangreCertificado && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#050b1f] border border-emerald-500/40">
            <button
              type="button"
              onClick={() =>
                setPreviewDoc({
                  title: `Constancia de Grupo Sanguíneo${formData.sangre ? ` (${formData.sangre})` : ''}`,
                  subtitle: formData.sangreLaboratorio || 'Documento cargado por el titular',
                  src: formData.sangreCertificado!
                })
              }
              className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-400/60 shrink-0 group"
              title="Ampliar constancia"
            >
              <img
                src={formData.sangreCertificado}
                alt="Vista previa estudio sanguíneo"
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <ZoomIn className="w-4 h-4 text-white" />
              </span>
            </button>
            <div className="min-w-0 flex-1 text-[11px]">
              <div className="font-bold text-emerald-300">Estudio o carnet cargado y comprimido</div>
              <p className="text-[#9db6dd] leading-snug">
                Tocá la miniatura para verificar que el texto se lea nítido. En guardia hospitalaria igualmente se realiza prueba cruzada.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Donante de Órganos y Tejidos (INCUCAI / Ley Justina 27.447) */}
      <div
        className={`rounded-2xl border-2 transition-all ${
          formData.donanteOrganos === 'si'
            ? 'bg-gradient-to-br from-emerald-950/65 via-[#07211d] to-[#07122c] border-emerald-400/75 shadow-lg shadow-emerald-950/30'
            : formData.donanteOrganos === 'no'
              ? 'bg-[#0b1328] border-amber-400/50'
              : 'bg-[#07122c] border-emerald-500/30'
        } ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-black text-white block leading-tight">
              Donante de Órganos y Tejidos (INCUCAI · Ley 27.447)
            </span>
            <span className="text-[11px] text-[#9db6dd] block leading-tight">
              Indicá tu voluntad expresa y adjuntá tu credencial de Mi Argentina o acta INCUCAI si la tenés.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectDonor('si')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
              formData.donanteOrganos === 'si'
                ? 'bg-emerald-600/35 border-emerald-400 text-emerald-100 shadow'
                : 'bg-[#050b1f] border-[#1e3f8f] text-gray-300 hover:border-emerald-400/60'
            }`}
          >
            Sí, soy donante
          </button>
          <button
            type="button"
            onClick={() => handleSelectDonor('no')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
              formData.donanteOrganos === 'no'
                ? 'bg-amber-600/30 border-amber-400 text-amber-100 shadow'
                : 'bg-[#050b1f] border-[#1e3f8f] text-gray-300 hover:border-amber-400/60'
            }`}
          >
            No donante
          </button>
          <button
            type="button"
            onClick={() => handleSelectDonor('')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
              !formData.donanteOrganos
                ? 'bg-[#1e5bff]/30 border-[#37c8ff] text-white shadow'
                : 'bg-[#050b1f] border-[#1e3f8f] text-gray-300 hover:border-[#37c8ff]/60'
            }`}
          >
            Sin especificar
          </button>
        </div>

        {formData.donanteOrganos === 'si' && (
          <div className="space-y-2.5 pt-2 border-t border-emerald-400/30 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
                  N° de acta / constancia INCUCAI o Mi Argentina (opcional)
                </label>
                <input
                  type="text"
                  maxLength={110}
                  placeholder="Ej: Acta INCUCAI N° 482910 · Mi Argentina"
                  value={formData.donanteRegistro || ''}
                  onChange={(e) => onChange('donanteRegistro', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-emerald-400/50 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-300"
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
                      className="p-2 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300 transition"
                      title="Quitar constancia INCUCAI"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {formData.donanteCertificado && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-[#050b1f] border border-emerald-400/50">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      title: 'Constancia de Donante de Órganos',
                      subtitle: formData.donanteRegistro || 'Credencial Mi Argentina / INCUCAI adjunta',
                      src: formData.donanteCertificado!
                    })
                  }
                  className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-400/70 shrink-0 group"
                  title="Ampliar constancia de donante"
                >
                  <img
                    src={formData.donanteCertificado}
                    alt="Vista previa constancia de donante"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <ZoomIn className="w-4 h-4 text-white" />
                  </span>
                </button>
                <div className="min-w-0 flex-1 text-[11px]">
                  <div className="font-bold text-emerald-300">Constancia de donante cargada</div>
                  <p className="text-[#9db6dd] leading-snug">
                    Los rescatistas y el hospital podrán ampliar esta credencial. El registro oficial SINTRA / INCUCAI siempre prevalece legalmente.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-emerald-200/85 pt-0.5">
              <span>
                La validez legal definitiva se consulta en el padrón oficial SINTRA / INCUCAI.
              </span>
              <a
                href={INCUCAI_OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-emerald-300 hover:text-white underline shrink-0"
              >
                <span>Consultar / tramitar en INCUCAI</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {formData.donanteOrganos === 'no' && (
          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-400/40 text-[11px] text-amber-100 leading-snug">
            Quedará visible tu manifestación expresa de <strong>NO donante</strong>. Para que tenga validez legal plena en Argentina (Ley 27.447), asegurate de registrarla también en <strong>Mi Argentina / INCUCAI</strong>.
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-400 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Modal de vista previa en edición */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#07122c] border-2 border-emerald-400 p-4 shadow-2xl space-y-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-emerald-300">{previewDoc.title}</h4>
                {previewDoc.subtitle && (
                  <p className="text-xs text-[#9db6dd]">{previewDoc.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-white border border-white/20 max-h-[65vh] flex items-center justify-center">
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

  const hasBlood = Boolean(record.sangre);
  const hasBloodCert = Boolean(record.sangreCertificado);
  const hasBloodFlagOnly = !hasBloodCert && Boolean(record.sangreTieneDoc);
  const hasBloodLab = Boolean(record.sangreLaboratorio?.trim());

  const donorState = record.donanteOrganos || '';
  const hasDonorCert = Boolean(record.donanteCertificado);
  const hasDonorFlagOnly = !hasDonorCert && Boolean(record.donanteTieneDoc);

  if (!hasBlood && !donorState) return null;

  return (
    <>
      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {/* Respaldo de Validación Sanguínea */}
        {hasBlood && (
          <div
            className={`rounded-xl border flex items-center justify-between gap-2.5 flex-wrap ${
              hasBloodCert || hasBloodLab || hasBloodFlagOnly
                ? 'bg-[#07182d] border-emerald-400/50'
                : 'bg-[#08132c] border-[#1a3366]'
            } ${compact ? 'p-2.5 text-xs' : 'p-3 text-xs sm:text-sm'}`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {hasBloodCert || hasBloodLab || hasBloodFlagOnly ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white">
                    Validación Grupo {record.sangre}:
                  </span>
                  {hasBloodCert ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                      ✓ Constancia adjunta
                    </span>
                  ) : hasBloodFlagOnly ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                      ✓ Con constancia en nube
                    </span>
                  ) : hasBloodLab ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-200 border border-cyan-400/50">
                      Lab. declarado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-200 border border-amber-400/40">
                      Declarado por titular (sin estudio adjunto)
                    </span>
                  )}
                </div>
                {hasBloodLab && (
                  <p className="text-[11px] text-[#b4ccf0] mt-0.5 truncate">
                    Centro / Lab.: <strong className="text-white">{record.sangreLaboratorio}</strong>
                  </p>
                )}
                <p className="text-[10px] text-[#8ba6d6] mt-0.5 leading-snug">
                  En transfusión hospitalaria rige siempre la prueba cruzada de guardia.
                </p>
              </div>
            </div>

            {hasBloodCert && (
              <button
                type="button"
                onClick={() =>
                  setZoomDoc({
                    title: `Constancia Grupo Sanguíneo ${record.sangre || ''}`,
                    subtitle: record.sangreLaboratorio || 'Estudio / carnet adjuntado por el titular',
                    src: record.sangreCertificado!
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/60 text-emerald-200 hover:text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition active:scale-95"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Ver estudio</span>
              </button>
            )}
          </div>
        )}

        {/* Condición de Donante de Órganos (INCUCAI) */}
        {donorState === 'si' && (
          <div
            className={`rounded-2xl bg-gradient-to-r from-emerald-950/85 via-[#07261f] to-[#061326] border border-emerald-400/70 shadow-lg ${
              compact ? 'p-3 space-y-1.5' : 'p-3.5 sm:p-4 space-y-2'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 shrink-0" />
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-200">
                  Donante de Órganos y Tejidos
                </span>
              </div>
              {hasDonorCert ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/25 text-emerald-200 border border-emerald-400/60">
                  ✓ Constancia adjunta
                </span>
              ) : hasDonorFlagOnly ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/25 text-emerald-200 border border-emerald-400/60">
                  ✓ Constancia en nube
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/35 text-emerald-200 border border-emerald-500/40">
                  Voluntad declarada
                </span>
              )}
            </div>

            {record.donanteRegistro && (
              <div className="text-xs text-white font-semibold bg-black/35 px-2.5 py-1.5 rounded-lg border border-emerald-500/30">
                Registro / Acta: <span className="text-emerald-200">{record.donanteRegistro}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <p className="text-[11px] text-emerald-100/85 leading-snug">
                Respaldo cargado por el titular · Validación oficial en padrón SINTRA / INCUCAI (Ley 27.447).
              </p>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {hasDonorCert && (
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
                  className="px-2.5 py-1.5 rounded-lg bg-[#051814] hover:bg-[#092922] border border-emerald-400/50 text-emerald-200 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition"
                >
                  <span>Verificar INCUCAI</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {donorState === 'no' && (
          <div
            className={`rounded-xl bg-[#161006] border border-amber-500/50 flex items-start justify-between gap-2 flex-wrap ${
              compact ? 'p-2.5 text-xs' : 'p-3 text-xs sm:text-sm'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-amber-200 uppercase text-[11px] sm:text-xs">
                  Manifestó NO ser donante de órganos
                </div>
                <p className="text-[11px] text-amber-100/80 leading-snug">
                  Oposición declarada por el titular en ficha · Confirmar en padrón oficial SINTRA / INCUCAI (Ley 27.447).
                </p>
              </div>
            </div>
            <a
              href={INCUCAI_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-black/40 border border-amber-400/40 text-amber-200 hover:text-white text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
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
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md print:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomDoc(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#060d20] border-2 border-emerald-400 p-4 sm:p-5 shadow-2xl space-y-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">{zoomDoc.title}</span>
                </div>
                {zoomDoc.subtitle && (
                  <p className="text-xs text-[#9db6dd] mt-0.5">{zoomDoc.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setZoomDoc(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-white border border-white/20 max-h-[65vh] flex items-center justify-center">
              <img
                src={zoomDoc.src}
                alt={zoomDoc.title}
                className="max-h-[65vh] w-auto object-contain block"
              />
            </div>

            <p className="text-[11px] text-[#9db6dd] text-center leading-snug">
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
