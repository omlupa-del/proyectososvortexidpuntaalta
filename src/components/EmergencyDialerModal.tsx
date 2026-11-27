import React, { useEffect, useState, useRef } from 'react';
import { Phone, Copy, Check, MessageSquare, AlertTriangle, X, ShieldAlert, Sparkles, Radio } from 'lucide-react';
import { ActiveCall, closeActiveCall, formatTelUri, formatWhatsAppNumber, launchTelProtocol, playChirp } from '../utils/callHandler';

interface EmergencyDialerModalProps {
  activeCall: ActiveCall | null;
  onClose: () => void;
  onSendWhatsApp?: (phone: string) => void;
}

export const EmergencyDialerModal: React.FC<EmergencyDialerModalProps> = ({
  activeCall,
  onClose,
  onSendWhatsApp
}) => {
  const [copied, setCopied] = useState(false);
  const [dialStage, setDialStage] = useState<'preparing' | 'attempting' | 'blocked' | 'navigated'>('preparing');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isEmbeddedFrame, setIsEmbeddedFrame] = useState(false);
  const hasNavigatedAway = useRef(false);

  useEffect(() => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      'ontouchstart' in window;
    setIsMobileDevice(isMobile);
    try {
      setIsEmbeddedFrame(window.self !== window.top);
    } catch {
      setIsEmbeddedFrame(true);
    }
  }, []);

  useEffect(() => {
    if (!activeCall) return;

    setCopied(false);
    setDialStage(activeCall.isAsyncTrigger ? 'preparing' : 'attempting');
    hasNavigatedAway.current = false;

    const handleAppSwitch = () => {
      hasNavigatedAway.current = true;
      setDialStage('navigated');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAppSwitch();
      }
    };

    window.addEventListener('blur', handleAppSwitch, { once: true });
    window.addEventListener('pagehide', handleAppSwitch, { once: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let dialTimer: ReturnType<typeof setTimeout> | undefined;
    let detectBlockTimer: ReturnType<typeof setTimeout> | undefined;

    if (activeCall.isAsyncTrigger) {
      // Delayed/Sentinel activation: attempt OS dialer once after modal mounts
      dialTimer = setTimeout(() => {
        setDialStage('attempting');
        launchTelProtocol(activeCall.number);

        detectBlockTimer = setTimeout(() => {
          if (!hasNavigatedAway.current && document.visibilityState === 'visible') {
            setDialStage('blocked');
            playChirp('emergency');
            if (navigator.vibrate) {
              try {
                navigator.vibrate([80, 50, 120]);
              } catch {}
            }
          }
        }, 900);
      }, 250);
    } else {
      // Synchronous tap already triggered tel: inside click gesture; verify if OS opened dialer
      detectBlockTimer = setTimeout(() => {
        if (!hasNavigatedAway.current && document.visibilityState === 'visible') {
          setDialStage('blocked');
        }
      }, 950);
    }

    return () => {
      if (dialTimer) clearTimeout(dialTimer);
      if (detectBlockTimer) clearTimeout(detectBlockTimer);
      window.removeEventListener('blur', handleAppSwitch);
      window.removeEventListener('pagehide', handleAppSwitch);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeCall]);

  if (!activeCall) return null;

  const telUri = formatTelUri(activeCall.number);
  const isEmergency = activeCall.source === 'emergency';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCall.cleanNumber || activeCall.number);
      setCopied(true);
      playChirp('success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeCall.cleanNumber || activeCall.number;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Direct native tap-to-call on user interaction (href={telUri} handles native invocation cleanly)
  const handleNativeTapToCall = () => {
    playChirp(isEmergency ? 'emergency' : 'click');
    if (navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 150]);
      } catch {}
    }
    hasNavigatedAway.current = true;
    setDialStage('navigated');
  };

  const waNumber = formatWhatsAppNumber(activeCall.number);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialer-title"
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-white dark:from-[#0b1d46] via-sky-50/70 dark:via-[#09173a] to-slate-50 dark:to-[#050b1f] border-t-2 sm:border-2 border-sky-500 dark:border-[#37c8ff] sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl shadow-blue-900/80 transition-all transform">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-[#1e3f8f]/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-400 border border-red-500/30">
              {isEmergency ? (
                <ShieldAlert className="w-6 h-6 animate-pulse text-red-500" />
              ) : (
                <Phone className="w-5 h-5 text-sky-700 dark:text-[#37c8ff]" />
              )}
            </span>
            <div>
              <h3 id="dialer-title" className="text-xl font-bold font-heading tracking-wide text-slate-900 dark:text-white">
                {activeCall.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#9db6dd]">
                {dialStage === 'preparing' && 'Preparando conexión telefónica…'}
                {dialStage === 'attempting' && 'Iniciando marcador del sistema operativo…'}
                {dialStage === 'blocked' &&
                  (isMobileDevice && !isEmbeddedFrame
                    ? 'Confirmación requerida: tocá el botón verde para discar'
                    : 'Vista previa / PC: tocá el botón verde o copiá el número')}
                {dialStage === 'navigated' && 'Marcador telefónico abierto en tu teléfono'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              closeActiveCall();
            }}
            className="p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-[#9db6dd] hover:text-slate-950 dark:hover:text-white transition"
            aria-label="Cerrar ventana de llamada"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Interceptor Alert: Shown if browser/OS did not auto-switch to phone dialer */}
        {dialStage === 'blocked' && (
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 dark:from-amber-950/90 to-red-50 dark:to-red-950/90 border-2 border-amber-300 dark:border-amber-500/80 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2.5 shadow-lg shadow-amber-950/50 animate-fade-in">
            <AlertTriangle className="w-6 h-6 text-amber-700 dark:text-amber-400 shrink-0 animate-bounce" />
            <div className="leading-snug">
              <span className="block font-bold text-slate-900 dark:text-white text-sm font-heading tracking-wide uppercase">
                {isMobileDevice && !isEmbeddedFrame
                  ? 'CONFIRMAR LLAMADA EN 1 TOQUE'
                  : 'MARCADOR LISTO (VISTA WEB / PC)'}
              </span>
              {isMobileDevice && !isEmbeddedFrame ? (
                <>
                  Por seguridad del celular, los temporizadores automáticos requieren tu toque.{' '}
                  <strong>Tocá el botón verde</strong> para iniciar la llamada directa.
                </>
              ) : (
                <>
                  En PC o dentro de esta vista previa no se puede abrir un teléfono automáticamente. En un celular abre directo; aquí podés tocar el{' '}
                  <strong>botón verde</strong> o copiar el número.
                </>
              )}
            </div>
          </div>
        )}

        {/* Big Number Display */}
        <div className="my-5 text-center">
          <div className="inline-block px-6 py-3 rounded-2xl bg-white dark:bg-[#07122c] border-2 border-blue-400 dark:border-[#1e5bff]/70 shadow-inner">
            <span className="text-5xl sm:text-6xl font-black tracking-wider font-heading text-slate-900 dark:text-white tabular-nums drop-shadow-[0_0_15px_rgba(55,200,255,0.45)]">
              {activeCall.number}
            </span>
          </div>

          {dialStage === 'preparing' && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-sky-700 dark:text-[#37c8ff]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#37c8ff] animate-ping" />
              Sincronizando llamada con tu dispositivo (500ms)…
            </div>
          )}

          {dialStage === 'attempting' && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              Abriendo aplicación de teléfono…
            </div>
          )}

          {dialStage === 'navigated' && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Llamada enviada al marcador de tu teléfono
            </div>
          )}
        </div>

        {/* Native Tap-To-Call Big Button (Guaranteed target="_top" with native window.location fallback) */}
        <div className="space-y-3">
          <a
            href={telUri}
            target="_top"
            rel="noopener"
            onClick={handleNativeTapToCall}
            className={`w-full flex items-center justify-center gap-3 py-4 sm:py-5 px-6 rounded-2xl text-white font-extrabold text-xl sm:text-2xl font-heading tracking-wider shadow-2xl active:scale-[0.97] transition-all transform border-2 ${
              dialStage === 'blocked'
                ? 'bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-500 hover:from-emerald-400 hover:to-green-500 border-white shadow-emerald-900/80 animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-green-500 border-emerald-400/50 shadow-emerald-950/60'
            }`}
          >
            <Phone className="w-7 h-7 shrink-0 animate-bounce" />
            <span className="uppercase">
              TOCÁ PARA LLAMAR AL {activeCall.cleanNumber || activeCall.number}
            </span>
          </a>

          {/* Secondary Action Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#102b74] border border-blue-400 dark:border-[#1e5bff]/70 text-slate-900 dark:text-white font-semibold text-sm transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-sky-700 dark:text-[#37c8ff]" />
                  <span>Copiar número</span>
                </>
              )}
            </button>

            {waNumber ? (
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-500/80 text-emerald-700 dark:text-emerald-300 font-semibold text-sm transition active:scale-95"
              >
                <MessageSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>WhatsApp</span>
              </a>
            ) : onSendWhatsApp ? (
              <button
                type="button"
                onClick={() => onSendWhatsApp(activeCall.number)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#102b74] border border-blue-400 dark:border-[#1e5bff]/70 text-sky-700 dark:text-[#37c8ff] font-semibold text-sm transition active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Avisar alerta</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  closeActiveCall();
                }}
                className="flex items-center justify-center py-3 px-4 rounded-xl bg-white dark:bg-[#07122c] border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-gray-800 transition"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>

        {/* Technical Safety Note */}
        <div className="mt-4 p-3 rounded-xl bg-white dark:bg-[#07122c]/90 border border-slate-300 dark:border-[#1e3f8f]/40 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-sky-700 dark:text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Garantía de llamada directa:</strong> En celulares, el botón verde invoca el protocolo nativo <code className="text-sky-700 dark:text-cyan-300">tel:</code>. Si tu sistema operativo no responde al discado automático, un solo toque en el botón verde inicia la llamada de inmediato.
          </p>
        </div>
      </div>
    </div>
  );
};
