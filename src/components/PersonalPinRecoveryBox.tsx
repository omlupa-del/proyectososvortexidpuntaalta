import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { MedicalRecord, recoverPersonalRecordPin } from '../utils/medicalData';
import { playChirp } from '../utils/callHandler';
import { useAuth } from '../context/AuthContext';

interface PersonalPinRecoveryBoxProps {
  record: MedicalRecord | null | undefined;
  onRecovered: () => void;
  onCancel: () => void;
}

export const PersonalPinRecoveryBox: React.FC<PersonalPinRecoveryBoxProps> = ({
  record,
  onRecovered,
  onCancel
}) => {
  const { user, signInWithGoogle } = useAuth();
  const [identityInput, setIdentityInput] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [useGoogleAuth, setUseGoogleAuth] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const hasDni = Boolean(record?.dni && record.dni.replace(/\D/g, '').length >= 6);
  const hasPhone = Boolean(
    (record?.tel && record.tel.replace(/\D/g, '').length >= 6) ||
      (record?.cfam && record.cfam.replace(/\D/g, '').length >= 6)
  );
  const hasKeychain = Boolean(record?.keychainId);

  const expectedHint = [
    hasDni ? 'tu DNI registrado' : null,
    hasPhone ? 'teléfono / WhatsApp de la ficha' : null,
    hasKeychain ? 'N° de llavero' : null,
    !hasDni && !hasPhone && !hasKeychain && record?.nombre ? 'tu nombre completo' : null
  ]
    .filter(Boolean)
    .join(', ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await recoverPersonalRecordPin({
        record,
        identityInput,
        newPin,
        isGoogleVerifiedOwner: Boolean(user && useGoogleAuth)
      });
      if (!res.ok) {
        playChirp('click');
        setError(res.error || 'No se pudo restablecer la clave.');
        return;
      }
      playChirp('success');
      setSuccessMsg('✔ Nueva clave guardada. Desbloqueando tu ficha…');
      setTimeout(() => {
        onRecovered();
      }, 650);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-blue-400 dark:border-[#1e5bff]/40">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-sky-700 dark:text-[#37c8ff]">
          <KeyRound className="w-4 h-4 shrink-0" />
          <span>Recuperar o Cambiar Clave de tu Ficha</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-600 dark:text-[#9db6dd] hover:text-slate-950 dark:hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-900 dark:text-[#eaf3ff] leading-snug">
        {expectedHint
          ? `Para proteger tus datos médicos, verificá tu identidad ingresando ${expectedHint} (o con tu cuenta Google) y definí una nueva clave.`
          : 'Definí una nueva clave numérica de 4 a 6 dígitos para volver a editar tu ficha.'}
      </p>

      {/* Google session quick verification option */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-blue-400 dark:border-[#1e5bff]/40 flex items-center justify-between gap-2 flex-wrap">
        {user ? (
          <label className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={useGoogleAuth}
              onChange={(e) => {
                setUseGoogleAuth(e.target.checked);
                if (error) setError('');
              }}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>Verificar con mi Google ({user.email || user.displayName})</span>
          </label>
        ) : (
          <>
            <span className="text-[11px] text-slate-600 dark:text-[#9db6dd]">
              ¿Tenés tu cuenta Google vinculada?
            </span>
            <button
              type="button"
              onClick={async () => {
                await signInWithGoogle();
                setUseGoogleAuth(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-white text-gray-950 font-black text-[11px] hover:bg-gray-200 transition"
            >
              Verificar con Google
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {expectedHint && !useGoogleAuth && (
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] font-semibold mb-1">
              Dato de identidad ({hasDni ? 'DNI' : hasPhone ? 'Teléfono' : hasKeychain ? 'Llavero' : 'Nombre'}):
            </label>
            <input
              type="text"
              value={identityInput}
              onChange={(e) => {
                setIdentityInput(e.target.value);
                if (error) setError('');
              }}
              placeholder={hasDni ? 'Ej: 28452910' : hasPhone ? 'Ej: 2932421222' : 'Ingresá tu dato'}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-blue-500 dark:border-[#1e5bff] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-[#37c8ff]"
              autoFocus
            />
          </div>
        )}

        <div className={expectedHint && !useGoogleAuth ? '' : 'sm:col-span-2'}>
          <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] font-semibold mb-1">
            Nueva clave PIN (4 a 6 números):
          </label>
          <div className="relative">
            <input
              type={showNewPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ej: 1234"
              className="w-full py-2 pl-3 pr-10 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-blue-500 dark:border-[#1e5bff] text-sm font-mono tracking-widest text-center text-slate-900 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-[#37c8ff]"
            />
            <button
              type="button"
              onClick={() => setShowNewPin((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-sky-700 dark:text-[#37c8ff] hover:text-slate-950 dark:hover:text-white transition"
              aria-label={showNewPin ? 'Ocultar nueva clave' : 'Ver nueva clave'}
            >
              {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-700 dark:text-red-400 font-semibold">{error}</p>}
      {successMsg && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-gray-950 font-black text-xs sm:text-sm shadow-lg transition active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Verificando…' : 'Restablecer Clave y Desbloquear'}
      </button>
    </form>
  );
};
