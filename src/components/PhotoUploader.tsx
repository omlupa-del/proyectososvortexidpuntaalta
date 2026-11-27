import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Check, ShieldCheck, AlertCircle, User, Sparkles } from 'lucide-react';
import { compressHdProfilePhoto } from '../utils/imageCompressor';
import { generateVerifiedFacePhoto } from '../utils/samplePhoto';
import { playChirp } from '../utils/callHandler';

interface PhotoUploaderProps {
  currentPhoto?: string;
  onPhotoSelected: (base64Photo: string | undefined) => void;
  disabled?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  currentPhoto,
  onPhotoSelected,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isLegacyCompactPhoto = Boolean(currentPhoto && currentPhoto.length <= 1500);

  const processFile = async (file: File) => {
    setError('');
    setLoading(true);

    try {
      // Compress cleanly to crisp 400x400 HD portrait (<= 48KB) for Ficha de Asistencia, Badges & Cloud
      const compressed = await compressHdProfilePhoto(file, 400, 0.9, 48000);
      onPhotoSelected(compressed);
      playChirp('success');
    } catch {
      setError('No se pudo procesar esa foto (probá sacar una selfie o elegir una imagen JPG/PNG).');
      playChirp('click');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleUseSamplePhoto = () => {
    playChirp('click');
    const sample = generateVerifiedFacePhoto();
    onPhotoSelected(sample);
  };

  const handleRemove = () => {
    onPhotoSelected(undefined);
    playChirp('click');
  };

  return (
    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#07122c] border border-blue-400 dark:border-[#1e5bff]/60 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold text-sky-700 dark:text-[#37c8ff] uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          <span>Fotografía Oficial de Seguridad (Identidad)</span>
        </label>
        {currentPhoto && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
              isLegacyCompactPhoto
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-500/80 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-500/80 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <Check className="w-3 h-3" />
            {isLegacyCompactPhoto ? 'Foto compacta (tocá para subir HD)' : 'Foto HD nítida lista'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3.5">
        {/* Photo Preview / Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-400 dark:border-emerald-400 shadow-md shadow-blue-950/80 bg-slate-50 dark:bg-[#050b1f] flex items-center justify-center shrink-0"
            style={{ width: '80px', height: '80px', minWidth: '80px', minHeight: '80px' }}
          >
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt="Foto del titular para verificación de identidad"
                className="w-full h-full object-cover block"
                loading="eager"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 dark:text-gray-500">
                <User className="w-9 h-9 text-sky-700 dark:text-[#37c8ff]/60" />
                <span className="text-[9px] uppercase font-bold text-slate-600 dark:text-[#9db6dd] mt-0.5">Sin foto</span>
              </div>
            )}
          </div>

          {currentPhoto && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow" title="Titular verificado">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-1 space-y-1.5">
          {/* File input (gallery/disk) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || loading}
            className="sr-only"
            id="vortex-photo-input"
          />

          {/* Camera input (front camera capture) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileChange}
            disabled={disabled || loading}
            className="sr-only"
            id="vortex-camera-input"
          />

          <div className="grid grid-cols-2 gap-1.5">
            <label
              htmlFor="vortex-camera-input"
              className={`py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition cursor-pointer text-center ${
                disabled || loading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>Tomar selfie</span>
            </label>

            <label
              htmlFor="vortex-photo-input"
              className={`py-2 px-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition cursor-pointer text-center ${
                disabled || loading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>{currentPhoto ? 'Cambiar foto' : 'Elegir archivo'}</span>
            </label>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleUseSamplePhoto}
              disabled={disabled || loading}
              className="flex-1 py-1 px-2 rounded-lg bg-sky-50 dark:bg-[#0b1d46] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/40 text-sky-700 dark:text-[#37c8ff] text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
            >
              <Sparkles className="w-3 h-3 text-amber-700 dark:text-yellow-300" />
              <span>Usar foto oficial de muestra</span>
            </button>

            {currentPhoto && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || loading}
                className="py-1 px-2.5 rounded-lg bg-sky-50 dark:bg-[#0b1d46] hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                title="Quitar foto"
              >
                <Trash2 className="w-3 h-3" />
                <span>Quitar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 dark:text-red-400 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Rationale explanation */}
      <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-[#0b1d46]/90 border border-blue-400 dark:border-[#1e5bff]/40 text-[11px] text-slate-900 dark:text-[#eaf3ff] flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <span className="leading-snug">
          <strong className="text-slate-900 dark:text-white">Verificación Antirrobo:</strong> Los socorristas y médicos del SAME 107 comparan el rostro del accidentado con esta foto para certificar que el llavero le pertenece.
        </span>
      </div>
    </div>
  );
};
