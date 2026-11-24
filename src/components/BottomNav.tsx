import React from 'react';
import { PlusSquare, AlertCircle, Heart, Car, QrCode, Shield } from 'lucide-react';

interface BottomNavProps {
  onOpenSos: () => void;
  onOpenQrModal: () => void;
  hasMedicalData: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  onOpenSos,
  onOpenQrModal,
  hasMedicalData
}) => {
  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-40 bg-[#050b1f]/95 backdrop-blur-md border-t border-[#1e5bff]/60 shadow-[0_-8px_25px_rgba(0,0,0,0.7)] px-2 py-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))]"
      aria-label="Navegación rápida de emergencia"
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        <a
          href="#farmacias"
          aria-label="Ir a Farmacias de turno"
          className="flex flex-col items-center justify-center p-1 text-[#9db6dd] hover:text-[#37c8ff] transition text-center group flex-1"
        >
          <span className="text-xl group-hover:scale-110 transition" aria-hidden="true">➕</span>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Farmacias</span>
        </a>

        <a
          href="#emergencias"
          aria-label="Ir a Teléfonos de Emergencias"
          className="flex flex-col items-center justify-center p-1 text-red-400 hover:text-red-300 transition text-center group flex-1"
        >
          <span className="text-xl group-hover:scale-110 transition" aria-hidden="true">🚨</span>
          <span className="text-[11px] font-bold tracking-tight mt-0.5">Emergencias</span>
        </a>

        {/* SOS Center Button (Main Emergency Sheet) */}
        <button
          type="button"
          onClick={onOpenSos}
          className="relative -top-3 flex flex-col items-center justify-center mx-1 group"
          aria-label="Abrir Ficha de Emergencia SOS"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-red-600 border-2 border-white shadow-lg shadow-red-950 flex items-center justify-center text-white text-xl active:scale-90 transition transform animate-pulse" aria-hidden="true">
            🆘
          </div>
          <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest mt-0.5">
            SOS
          </span>
        </button>

        <a
          href="#transporte"
          aria-label="Ir a Remis 24 horas"
          className="flex flex-col items-center justify-center p-1 text-[#9db6dd] hover:text-[#37c8ff] transition text-center group flex-1"
        >
          <span className="text-xl group-hover:scale-110 transition" aria-hidden="true">🚖</span>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Remis 24h</span>
        </a>

        {/* Mi QR / Credencial Llavero */}
        <button
          type="button"
          onClick={onOpenQrModal}
          className="flex flex-col items-center justify-center p-1 text-[#37c8ff] hover:text-white transition text-center group flex-1 relative"
          aria-label="Abrir mi QR y Credencial de Llavero"
        >
          <div className="relative" aria-hidden="true">
            <span className="text-xl group-hover:scale-110 transition">🪪</span>
            {hasMedicalData && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-[11px] font-bold tracking-tight mt-0.5">Mi QR</span>
        </button>
      </div>
    </nav>
  );
};
