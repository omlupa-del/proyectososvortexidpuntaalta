import React, { useRef } from 'react';
import { Download, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { playChirp } from '../utils/callHandler';

interface HeaderProps {
  onOpenCommand?: () => void;
  showCommandButton?: boolean;
  onInstallApp?: () => void;
  isInstallable?: boolean;
  isInstalled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommand,
  showCommandButton = false,
  onInstallApp,
  isInstallable = false,
  isInstalled = false
}) => {
  const { user, loading, isAdmin, signInWithGoogle, logout } = useAuth();
  const tapTimestampsRef = useRef<number[]>([]);

  const handleEmblemTap = () => {
    if (!onOpenCommand) return;
    const now = Date.now();
    const recent = tapTimestampsRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    tapTimestampsRef.current = recent;
    if (recent.length >= 5) {
      tapTimestampsRef.current = [];
      playChirp('click');
      onOpenCommand();
    }
  };

  return (
    <header className="py-2.5 border-b border-[#183160] flex items-center justify-between gap-3 select-none">
      {/* Left Zone: Official Emblem (5 taps = secret Command Gate) + Wordmark */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleEmblemTap}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-cyan-400/70 bg-[#061229] overflow-hidden shrink-0 shadow-[0_0_12px_rgba(55,200,255,0.2)] active:scale-95 transition-transform focus:outline-none"
          aria-label="Vortex ID Punta Alta"
        >
          <img
            src="/assets/aistudio/image__2__7d12aee0.png"
            alt="Logo Vortex ID"
            className="w-full h-full object-contain translate-y-[7%] scale-[1.52] pointer-events-none"
          />
        </button>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-[0.14em] font-heading text-white whitespace-nowrap shrink-0 leading-none">
            VORTEX <span className="text-[#37c8ff]">ID</span>
          </h1>
          <span
            aria-hidden="true"
            className="hidden min-[380px]:inline text-[#37c8ff]/50 text-xs shrink-0"
          >
            ·
          </span>
          <span className="hidden min-[380px]:inline text-xs font-medium text-[#8fa9d8] whitespace-nowrap truncate">
            Punta Alta
          </span>
        </div>
      </div>

      {/* Right Zone: Install App + Auth + Exclusive Admin Command Trigger */}
      <div className="shrink-0 flex items-center gap-1.5">
        {!isInstalled && onInstallApp && (
          <button
            type="button"
            onClick={() => {
              playChirp('click');
              onInstallApp();
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-black transition active:scale-95 shrink-0 ${
              isInstallable
                ? 'bg-emerald-400 hover:bg-emerald-300 border-emerald-300 text-gray-950 shadow-md shadow-emerald-950/40'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/70 text-emerald-200'
            }`}
            title={isInstallable ? 'Instalar Vortex ID en 1 toque' : 'Descargar / Instalar Vortex ID en PC o Celular'}
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden min-[430px]:inline">Instalar</span>
          </button>
        )}

        {(isAdmin || showCommandButton) && onOpenCommand && (
          <button
            type="button"
            onClick={onOpenCommand}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/70 text-[11px] font-black text-amber-200 transition active:scale-95 shrink-0"
            title="Abrir Control General (Solo Operador)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Comando</span>
          </button>
        )}

        {loading ? (
          <span className="text-[11px] font-mono text-[#8fa9d8] whitespace-nowrap">
            Conectando...
          </span>
        ) : user ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#07122a] border border-[#1d3a70] text-xs">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Usuario'}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full border border-cyan-400/70 object-cover shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-cyan-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="text-white font-medium text-[11px] max-w-[100px] sm:max-w-[160px] truncate whitespace-nowrap">
              {user.displayName || user.email}
            </span>
            {isAdmin && (
              <span className="text-[10px] font-mono font-semibold text-amber-300 whitespace-nowrap">
                · Admin
              </span>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="text-[#8fa9d8] hover:text-red-400 transition-colors p-0.5 shrink-0"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#081530] hover:bg-[#0e224d] border border-[#25498a] text-xs font-semibold text-white transition-colors duration-150 active:scale-95 whitespace-nowrap shrink-0"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Acceder con Google</span>
          </button>
        )}
      </div>
    </header>
  );
};
