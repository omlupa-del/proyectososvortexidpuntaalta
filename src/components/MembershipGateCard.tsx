import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  Send,
  KeyRound,
  Lock,
  Unlock,
  Sparkles,
  Eye,
  HeartPulse,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import {
  SystemConfig,
  formatCurrency,
  buildMembershipWhatsAppUrl,
  verifyActivationCode,
  unlockMembershipLocally
} from '../utils/systemConfig';
import { playChirp } from '../utils/callHandler';

interface MembershipGateCardProps {
  systemConfig: SystemConfig;
  isUnlocked: boolean;
  onUnlocked: () => void;
  onPreviewDemoSos?: () => void;
  compact?: boolean;
}

export const MembershipGateCard: React.FC<MembershipGateCardProps> = ({
  systemConfig,
  isUnlocked,
  onUnlocked,
  onPreviewDemoSos,
  compact = false
}) => {
  const [copiedAlias, setCopiedAlias] = useState<boolean>(false);
  const [copiedCbu, setCopiedCbu] = useState<boolean>(false);
  const [applicantName, setApplicantName] = useState<string>('');
  const [applicantDni, setApplicantDni] = useState<string>('');
  const [activationCode, setActivationCode] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string>('');
  const [justUnlockedMsg, setJustUnlockedMsg] = useState<string>('');

  const feeFormatted = formatCurrency(systemConfig.monthlyFee);
  const alias = systemConfig.paymentAlias || 'vortex.id.auxilio';
  const cbu = systemConfig.paymentCbu || '';
  const holder = systemConfig.paymentHolder || 'VORTEX ID · PUNTA ALTA';

  const handleCopyAlias = async () => {
    playChirp('click');
    try {
      await navigator.clipboard.writeText(alias);
    } catch {
      // fallback ignore
    }
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2200);
  };

  const handleCopyCbu = async () => {
    if (!cbu) return;
    playChirp('click');
    try {
      await navigator.clipboard.writeText(cbu);
    } catch {
      // fallback ignore
    }
    setCopiedCbu(true);
    setTimeout(() => setCopiedCbu(false), 2200);
  };

  const handleSendWhatsAppReceipt = () => {
    playChirp('click');
    const url = buildMembershipWhatsAppUrl(systemConfig, {
      nombre: applicantName,
      dni: applicantDni
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    if (!activationCode.trim()) {
      setCodeError('Ingresá el Código de Alta que recibiste por WhatsApp.');
      return;
    }

    setVerifying(true);
    try {
      const ok = await verifyActivationCode(activationCode, systemConfig);
      if (ok) {
        unlockMembershipLocally({
          holderName: applicantName.trim(),
          phone: applicantDni.trim()
        });
        playChirp('success');
        setJustUnlockedMsg('✔ ¡Membresía activada! Ya podés cargar tu foto, datos vitales y descargar tu QR.');
        onUnlocked();
      } else {
        playChirp('click');
        setCodeError('Código incorrecto. Verificá las letras/números o pedilo enviando el comprobante por WhatsApp.');
      }
    } finally {
      setVerifying(false);
    }
  };

  // CASE A: Open Trial Mode (isMembershipRequired === false) -> Non-invasive informational strip only
  if (!systemConfig.isMembershipRequired) {
    return (
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 dark:from-emerald-950/70 via-sky-50/70 dark:via-[#0a2342] to-slate-50 dark:to-[#071536] border border-emerald-300 dark:border-emerald-400/60 shadow-lg space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/50">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                Modo Prueba Abierta · Carga Gratuita Habilitada
              </h3>
              <p className="text-[11px] text-slate-700 dark:text-[#cfe4ff]">
                Cargá tu ficha médica ahora y probá tu QR en la pantalla bloqueada sin costo inicial.
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-black/50 border border-amber-300 dark:border-amber-400/50 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono">
            Plan mensual: {feeFormatted}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-300 dark:border-emerald-500/20 text-[11px] text-slate-600 dark:text-[#9db6dd]">
          <div className="flex items-center gap-1.5">
            <span>Alias de adhesión voluntaria:</span>
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/60 text-sky-700 dark:text-cyan-300 font-mono font-bold select-all">
              {alias}
            </code>
            <button
              type="button"
              onClick={handleCopyAlias}
              className="p-1 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200/70 dark:hover:bg-white/20 text-slate-900 dark:text-white transition"
              title="Copiar alias"
            >
              {copiedAlias ? <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {onPreviewDemoSos && (
            <button
              type="button"
              onClick={() => {
                playChirp('click');
                onPreviewDemoSos();
              }}
              className="text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white font-bold flex items-center gap-1 underline underline-offset-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver ejemplo de cómo salva vidas</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // CASE B: Membership required AND already unlocked on this device
  if (isUnlocked) {
    return (
      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/60 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{justUnlockedMsg || 'Membresía Vortex ID verificada · Carga de Ficha y QR habilitada'}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase">
          Activa
        </span>
      </div>
    );
  }

  // CASE C: Membership required AND NOT unlocked yet -> Trust-building 3-Step Payment + WhatsApp Gate
  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-white dark:from-[#0d2254] via-sky-50/70 dark:via-[#081638] to-slate-50 dark:to-[#050b1f] border-2 border-amber-400 dark:border-amber-400 shadow-2xl shadow-amber-950/40 space-y-4 text-slate-900 dark:text-white animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-amber-300 dark:border-amber-400/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black flex items-center justify-center shadow-lg shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-400/50">
                Alta Oficial Punta Alta
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Activación Personalizada
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-heading tracking-wide text-slate-900 dark:text-white mt-0.5">
              Activá tu Ficha SOS y QR Personal
            </h3>
          </div>
        </div>

        <div className="text-right shrink-0 bg-slate-100 dark:bg-black/50 px-3 py-1.5 rounded-2xl border border-amber-300 dark:border-amber-400/60">
          <span className="text-[10px] text-amber-800 dark:text-amber-200 uppercase font-bold block">Membresía</span>
          <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">{feeFormatted}</span>
          <span className="text-[10px] text-slate-700 dark:text-gray-300 block">/ mes</span>
        </div>
      </div>

      {/* Non-invasive Free Emergency Promise */}
      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-[11px] text-emerald-800 dark:text-emerald-100 flex items-start gap-2 leading-snug">
        <HeartPulse className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong>Compromiso Comunitario:</strong> Las llamadas de emergencia al <strong>107 / 911</strong>, las farmacias de turno 24hs y el escaneo ante accidentes son <strong>siempre gratuitos</strong>. La membresía mantiene tu ficha cifrada, QR HD para pantalla bloqueada y soporte local.
        </span>
      </div>

      {/* Preview Demo before paying (Non-invasive trust builder) */}
      {onPreviewDemoSos && !compact && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-[#071330] border border-sky-300 dark:border-cyan-400/50">
          <div className="text-xs text-sky-800 dark:text-cyan-100 leading-snug">
            <strong className="text-sky-700 dark:text-cyan-300 block">¿Querés ver primero cómo salva tu vida?</strong>
            Probá una ficha real de auxilio antes de abonar.
          </div>
          <button
            type="button"
            onClick={() => {
              playChirp('click');
              onPreviewDemoSos();
            }}
            className="px-3 py-2 rounded-xl bg-sky-100 dark:bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-sky-800 dark:text-cyan-200 font-bold text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Demo SOS</span>
          </button>
        </div>
      )}

      {/* STEP 1: Alias & Transfer Info */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050b1f] border border-blue-400 dark:border-[#1e5bff]/70 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-[#37c8ff] flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" />
            <span>Paso 1 · Transferí {feeFormatted}</span>
          </span>
          <a
            href="https://www.mercadopago.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white font-bold flex items-center gap-1 underline"
          >
            <span>Abrir Mercado Pago</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0a1838] border border-sky-300 dark:border-cyan-500/40 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-600 dark:text-gray-400 block uppercase font-bold">Alias (Mercado Pago / Banco)</span>
              <span className="text-sm font-mono font-black text-slate-900 dark:text-white select-all truncate block">{alias}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyAlias}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[11px] flex items-center gap-1 shrink-0 active:scale-95 transition"
            >
              {copiedAlias ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAlias ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0a1838] border border-slate-300 dark:border-[#1e3f8f] flex flex-col justify-center">
            <span className="text-[10px] text-slate-600 dark:text-gray-400 block uppercase font-bold">Titular de la cuenta</span>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-200 truncate">{holder}</span>
            {cbu && (
              <button
                type="button"
                onClick={handleCopyCbu}
                className="mt-1 text-[10px] text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white font-mono flex items-center gap-1 text-left"
              >
                <span>CBU/CVU: {cbu.slice(0, 12)}…</span>
                {copiedCbu ? <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* STEP 2: Send Receipt to Admin WhatsApp */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050b1f] border border-emerald-300 dark:border-emerald-500/60 space-y-2.5">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          <span>Paso 2 · Enviá el comprobante por WhatsApp</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Tu nombre y apellido (opcional)"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#0a1838] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
          />
          <input
            type="text"
            placeholder="DNI o celular (opcional)"
            value={applicantDni}
            onChange={(e) => setApplicantDni(e.target.value)}
            className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#0a1838] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
          />
        </div>

        <button
          type="button"
          onClick={handleSendWhatsAppReceipt}
          className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-gray-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95 transition"
        >
          <Send className="w-4 h-4 text-gray-950" />
          <span>Enviar Comprobante por WhatsApp y Pedir Código</span>
        </button>
      </div>

      {/* STEP 3: Enter Activation Code received from Admin */}
      <form
        onSubmit={handleVerifyCode}
        className="p-3.5 rounded-2xl bg-white dark:bg-[#071536] border-2 border-amber-300 dark:border-amber-400/70 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4" />
            <span>Paso 3 · Ingresá tu Código de Alta</span>
          </label>
          <span className="text-[10px] text-slate-700 dark:text-gray-300">Lo recibís al instante por WhatsApp</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={activationCode}
            onChange={(e) => {
              setActivationCode(e.target.value.toUpperCase());
              if (codeError) setCodeError('');
            }}
            placeholder="Ej: VORTEXPA"
            className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-amber-300 dark:border-amber-400/70 text-sm font-mono font-black tracking-widest text-slate-900 dark:text-white uppercase text-center focus:outline-none focus:border-amber-500 dark:focus:border-amber-300"
          />
          <button
            type="submit"
            disabled={verifying}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:opacity-95 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition disabled:opacity-50"
          >
            <Unlock className="w-4 h-4" />
            <span>{verifying ? 'Verificando…' : 'Activar y Cargar Datos'}</span>
          </button>
        </div>

        {codeError && (
          <p className="text-xs text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-500/40 rounded-xl p-2 text-center">
            {codeError}
          </p>
        )}
      </form>
    </div>
  );
};
