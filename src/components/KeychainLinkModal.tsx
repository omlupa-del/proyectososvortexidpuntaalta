import React, { useState } from 'react';
import {
  X,
  Link2,
  Tag,
  CheckCircle2,
  ShieldCheck,
  User,
  QrCode,
  Copy,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Unlink
} from 'lucide-react';
import {
  MedicalRecord,
  hasMedicalData,
  linkRecordToKeychain,
  unlinkRecordFromKeychain,
  generateCorrelativeUrl,
  generateKeychainUrl
} from '../utils/medicalData';
import { playChirp } from '../utils/callHandler';

interface KeychainLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
  onRecordUpdated: (updated: MedicalRecord) => void;
}

export const KeychainLinkModal: React.FC<KeychainLinkModalProps> = ({
  isOpen,
  onClose,
  record,
  onRecordUpdated
}) => {
  const [keychainInput, setKeychainInput] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isChanging, setIsChanging] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentId = record?.keychainId;

  const handleLink = (idToLink?: string) => {
    const rawId = idToLink || keychainInput;
    const cleanId = rawId.trim().replace(/^#+/, '');

    if (!cleanId) {
      setErrorMessage('Por favor escribí el número impreso en el llavero (ej: 0042).');
      return;
    }

    if (!record) {
      setErrorMessage('Primero debés tener una ficha médica guardada.');
      return;
    }

    try {
      const updated = linkRecordToKeychain(record, cleanId);
      onRecordUpdated(updated);
      setSuccessMessage(`¡Llavero #${cleanId.toUpperCase()} vinculado exitosamente a tu ficha!`);
      setErrorMessage('');
      setIsChanging(false);
      setKeychainInput('');
      playChirp('success');
    } catch (err) {
      setErrorMessage('Error al vincular el llavero. Intentá nuevamente.');
    }
  };

  const handleUnlink = () => {
    if (!record || !record.keychainId) return;
    const oldId = record.keychainId;
    const updated = unlinkRecordFromKeychain(record);
    onRecordUpdated(updated);
    setSuccessMessage(`Se desvinculó el llavero #${oldId}.`);
    setErrorMessage('');
    setIsChanging(false);
    playChirp('click');
  };

  const handleCopyLink = () => {
    if (!currentId) return;
    const url =
      record && hasMedicalData(record)
        ? generateKeychainUrl(record)
        : generateCorrelativeUrl(currentId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      playChirp('click');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keychain-link-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-white dark:from-[#0a1838] via-sky-50/70 dark:via-[#08132d] to-slate-50 dark:to-[#050b1f] border-2 border-blue-500 dark:border-[#1e5bff] p-5 sm:p-6 shadow-2xl shadow-blue-950/80 text-slate-900 dark:text-white my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/60 flex items-center justify-center text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white transition active:scale-95 z-10"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-300 dark:border-[#1e3f8f]/60 pr-10">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/20 border-2 border-amber-400 dark:border-amber-400 flex items-center justify-center text-amber-700 dark:text-amber-300 shadow-md shadow-amber-950/50 shrink-0">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
              VINCULACIÓN RÁPIDA EN 1 PASO
            </span>
            <h2 id="keychain-link-title" className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white">
              Vincular Llavero Físico
            </h2>
          </div>
        </div>

        {/* Holder preview card */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-[#1e3f8f] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-sky-500 dark:border-[#37c8ff] bg-sky-50 dark:bg-[#0a1f55] flex items-center justify-center shrink-0"
              style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px' }}
            >
              {record?.foto ? (
                <img
                  src={record.foto}
                  alt="Foto titular"
                  className="w-full h-full object-cover block"
                  loading="eager"
                />
              ) : (
                <User className="w-6 h-6 text-sky-700 dark:text-[#37c8ff]" />
              )}
            </div>
            <div>
              <span className="text-[10px] text-slate-600 dark:text-[#9db6dd] font-bold uppercase tracking-wider">
                Ficha a vincular
              </span>
              <div className="text-base sm:text-lg font-black font-heading text-slate-900 dark:text-white">
                {record?.nombre || 'Titular de la ficha'}
              </div>
              <div className="text-xs text-sky-700 dark:text-[#37c8ff]">
                {record?.dni ? `DNI: ${record.dni}` : 'Punta Alta · Buenos Aires'}
              </div>
            </div>
          </div>

          {record?.sangre && (
            <div className="shrink-0 text-center px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-600/90 text-white border border-red-400 text-xs font-black font-heading">
              {record.sangre}
            </div>
          )}
        </div>

        {/* Success feedback */}
        {successMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error feedback */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/90 border border-red-400 dark:border-red-500 text-red-800 dark:text-red-200 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STATE A: Already Linked */}
        {currentId && !isChanging ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 dark:from-emerald-950/60 to-slate-50 dark:to-[#071536] border-2 border-emerald-300 dark:border-emerald-500/80 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Llavero Físico Enlazado
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-black font-black font-mono text-sm shadow">
                  #{currentId}
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-gray-200 mt-2 leading-relaxed">
                ¡Tu ficha médica ya está activa en el llavero físico <strong>#{currentId}</strong>! No necesitás volver a cargar nada. Quien escanee el QR del llavero verá inmediatamente tu foto, tus contactos de emergencia y tus datos médicos.
              </p>

              <div className="mt-3 pt-3 border-t border-emerald-300 dark:border-emerald-500/30 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-600 dark:text-[#9db6dd] font-mono">
                  Enlace directo: #id={currentId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1 rounded-lg bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/60 text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 transition active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-700 dark:text-[#37c8ff]" />
                  <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
                </button>
              </div>
            </div>

            {/* Actions for linked keychain */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsChanging(true)}
                className="py-2.5 px-4 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-sky-500 dark:border-[#37c8ff] text-slate-900 dark:text-white font-bold text-xs flex items-center gap-2 transition active:scale-95"
              >
                <Tag className="w-4 h-4 text-sky-700 dark:text-[#37c8ff]" />
                <span>Cambiar número de llavero</span>
              </button>

              <button
                type="button"
                onClick={handleUnlink}
                className="py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 font-semibold text-xs flex items-center gap-2 transition active:scale-95"
              >
                <Unlink className="w-4 h-4 text-red-700 dark:text-red-400" />
                <span>Desvincular</span>
              </button>
            </div>
          </div>
        ) : (
          /* STATE B: Not Linked yet, or Changing */
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#07122c] border border-amber-300 dark:border-amber-500/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <Tag className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>¿Cómo funciona?</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-gray-200 leading-relaxed">
                Si compraste un llavero físico con QR impreso y número correlativo (ej: <strong>0042</strong> o <strong>0125</strong>), solo tenés que escribir ese número aquí.
              </p>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-500/40 text-[11px] text-slate-600 dark:text-[#9db6dd] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-sky-700 dark:text-[#37c8ff] shrink-0 mt-0.5" />
                <span>
                  <strong>Sin volver a cargar nada:</strong> El sistema enlaza al instante toda la información que ya completaste en tu ficha con ese número de llavero físico.
                </span>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Número impreso en tu llavero físico:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-gray-400 font-mono font-bold text-base">
                    #
                  </span>
                  <input
                    type="text"
                    placeholder="Ej: 0042"
                    value={keychainInput}
                    onChange={(e) => {
                      setKeychainInput(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLink()}
                    className="w-full py-3 pl-8 pr-4 rounded-xl bg-slate-50 dark:bg-[#050b1f] border-2 border-blue-500 dark:border-[#1e5bff] focus:border-emerald-500 dark:focus:border-emerald-400 text-slate-900 dark:text-white font-mono font-bold text-lg placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none transition uppercase"
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleLink()}
                  className="py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 hover:from-emerald-500 hover:to-green-400 text-white font-black font-heading text-sm shadow-lg shadow-emerald-950 flex items-center gap-2 active:scale-95 transition shrink-0"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Vincular Ahora</span>
                </button>
              </div>
            </div>

            {/* Quick shortcuts for testing/simulation */}
            <div className="pt-2 border-t border-slate-300 dark:border-[#1e3f8f]/40 flex items-center justify-between text-xs text-slate-600 dark:text-[#9db6dd] flex-wrap gap-2">
              <span>Probar números de ejemplo:</span>
              <div className="flex gap-1.5">
                {['0001', '0042', '0125'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setKeychainInput(num);
                      handleLink(num);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/50 text-slate-900 dark:text-white font-mono font-bold text-[11px] transition active:scale-95"
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>

            {isChanging && (
              <button
                type="button"
                onClick={() => setIsChanging(false)}
                className="w-full py-2 text-center text-xs text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white"
              >
                Cancelar cambio y mantener #{currentId}
              </button>
            )}
          </div>
        )}

        {/* Modal Footer button */}
        <div className="mt-6 pt-4 border-t border-slate-300 dark:border-[#1e3f8f]/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-[#37c8ff]/60 text-slate-900 dark:text-white font-bold text-xs transition active:scale-95"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
