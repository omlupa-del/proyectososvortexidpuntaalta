import React, { useEffect, useState } from 'react';
import {
  Compass,
  MapPin,
  Phone,
  Send,
  ExternalLink,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Navigation,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  Coordinates,
  isVerifiedEmergencyCoords,
  isWithinPuntaAltaArea,
  describePuntaAltaLocation,
  getNearbyMapSearchUrl,
  getCoordsFreshnessInfo,
  reverseGeocodeAnyLocation
} from '../utils/geo';
import { MedicalRecord, buildSosMessage, hasMedicalData } from '../utils/medicalData';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from '../utils/callHandler';

const TRAVELER_STORAGE_KEY = 'vortex_traveler_mode_v1';
const TRAVELER_CHECKLIST_KEY = 'vortex_traveler_checklist_v1';

interface TravelerModeSectionProps {
  coords: Coordinates | null;
  ipFallback?: Coordinates | null;
  onRequestCoords: () => void;
  gpsStatus: string;
  medicalRecord: MedicalRecord | null;
  onOpenQrModal: () => void;
}

const NATIONAL_ROUTE_NUMBERS = [
  { id: '911', number: '911', title: 'Policía / Emergencias', subtitle: 'Red Nacional 24hs', icon: '🚓' },
  { id: '107', number: '107', title: 'SAME / Ambulancia', subtitle: 'Urgencia Médica', icon: '🚑' },
  { id: '100', number: '100', title: 'Bomberos', subtitle: 'Rescate en ruta', icon: '🚒' },
  { id: '103', number: '103', title: 'Defensa Civil', subtitle: 'Clima / Temporales', icon: '🛟' },
  { id: '106', number: '106', title: 'Prefectura Naval', subtitle: 'Emergencias Costeras', icon: '⚓' },
  { id: '149', number: '149', title: 'Asistencia Vial', subtitle: 'Ayuda en rutas arg.', icon: '🛣️' }
];

const DEFAULT_CHECKLIST = [
  { id: 'qr', label: 'Credencial QR / Llavero Vortex ID visible y offline', checked: false },
  { id: 'docs', label: 'DNI, carnet de Obra Social y seguro automotor', checked: false },
  { id: 'kit', label: 'Botiquín, balizas, chaleco refractario y matafuego', checked: false }
];

export const TravelerModeSection: React.FC<TravelerModeSectionProps> = ({
  coords,
  ipFallback,
  onRequestCoords,
  gpsStatus,
  medicalRecord,
  onOpenQrModal
}) => {
  const verifiedCoords = isVerifiedEmergencyCoords(coords) ? coords : null;
  const isOutsidePuntaAlta = Boolean(verifiedCoords && !isWithinPuntaAltaArea(verifiedCoords));

  const [manualEnabled, setManualEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TRAVELER_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [dismissedAutoExpand, setDismissedAutoExpand] = useState<boolean>(false);
  const [customCityQuery, setCustomCityQuery] = useState<string>('');
  const [resolvedRouteLabel, setResolvedRouteLabel] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; checked: boolean }>>(() => {
    try {
      const raw = localStorage.getItem(TRAVELER_CHECKLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CHECKLIST;
  });

  const isExpanded = manualEnabled || (isOutsidePuntaAlta && !dismissedAutoExpand);
  const hasRecord = hasMedicalData(medicalRecord);
  const freshness = verifiedCoords ? getCoordsFreshnessInfo(verifiedCoords) : null;

  useEffect(() => {
    if (!isExpanded || !verifiedCoords || isWithinPuntaAltaArea(verifiedCoords)) {
      return;
    }
    let active = true;
    reverseGeocodeAnyLocation(verifiedCoords).then((label) => {
      if (active && label) {
        setResolvedRouteLabel(label);
      }
    });
    return () => {
      active = false;
    };
  }, [isExpanded, verifiedCoords]);

  const handleToggleTravelerMode = () => {
    playChirp('click');
    const next = !isExpanded;
    setManualEnabled(next);
    if (!next && isOutsidePuntaAlta) {
      setDismissedAutoExpand(true);
    } else if (next) {
      setDismissedAutoExpand(false);
    }
    try {
      localStorage.setItem(TRAVELER_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const toggleChecklistItem = (id: string) => {
    playChirp('click');
    setChecklist((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
      try {
        localStorage.setItem(TRAVELER_CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const buildNearbySearchLink = (term: string): string => {
    const cleanCity = customCityQuery.trim();
    if (cleanCity) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} cerca de ${cleanCity}`)}`;
    }
    if (verifiedCoords) {
      return getNearbyMapSearchUrl(term, verifiedCoords);
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} cerca de mi ubicacion`)}`;
  };

  const handleWhatsAppCheckIn = (mode: 'checkin' | 'sos', target: 'Familiar' | 'Amigo' | 'Cualquiera') => {
    playChirp(mode === 'sos' ? 'emergency' : 'click');
    const rawNum =
      target === 'Familiar'
        ? medicalRecord?.cfam
        : target === 'Amigo'
          ? medicalRecord?.cami
          : '';
    const waNum = rawNum ? formatWhatsAppNumber(rawNum) : '';

    let text = '';
    if (mode === 'sos') {
      text = buildSosMessage(medicalRecord, verifiedCoords, ipFallback);
    } else {
      const travelerName = medicalRecord?.nombre ? ` (${medicalRecord.nombre})` : '';
      const placeNote = resolvedRouteLabel || (verifiedCoords ? describePuntaAltaLocation(verifiedCoords) : customCityQuery.trim() || 'en viaje');
      const lines = [
        `🧭 *AVISO DE VIAJE · VORTEX ID${travelerName}*`,
        `✅ Te comparto mi ubicación actual en ruta (${placeNote}):`
      ];
      if (verifiedCoords) {
        lines.push(`https://www.google.com/maps?q=${verifiedCoords.lat},${verifiedCoords.lng}`);
      } else {
        lines.push('📍 GPS sin señal en este momento (aviso enviado desde la app).');
      }
      const now = new Date();
      lines.push(`🕒 ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`);
      text = lines.join('\n');
    }

    const url = waNum
      ? `https://wa.me/${waNum}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const completedChecklistCount = checklist.filter((c) => c.checked).length;

  return (
    <section
      id="modo-viajero"
      aria-label="Modo Viajero y Asistencia en Ruta"
      className={`my-5 rounded-2xl border transition-all shadow-xl overflow-hidden ${
        isExpanded
          ? 'bg-gradient-to-b from-[#071936] via-[#07132c] to-[#050b1f] border-2 border-cyan-400/80 shadow-cyan-950/40'
          : 'bg-[#060d20] border-[#1a3366] hover:border-cyan-400/60'
      }`}
    >
      {/* Compact Header / Toggle Bar (minimal footprint when collapsed) */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleToggleTravelerMode}
          className="flex items-center gap-3 min-w-0 text-left flex-1 focus:outline-none"
        >
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isExpanded
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-[#0a1a3d] border-[#25498a] text-cyan-300'
            }`}
          >
            <Compass className={`w-5 h-5 ${isExpanded ? 'animate-pulse' : ''}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold font-heading tracking-wide text-white">
                MODO VIAJERO · RUTA Y VACACIONES
              </h2>
              {isOutsidePuntaAlta && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/60">
                  Fuera de Punta Alta
                </span>
              )}
              {isExpanded && !isOutsidePuntaAlta && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/50">
                  Activo
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#9db6dd] truncate">
              Guardias cercanas, emergencias nacionales (911/107/149) y aviso GPS en ruta
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleToggleTravelerMode}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition active:scale-95 ${
            isExpanded
              ? 'bg-[#0b1f50] hover:bg-[#143078] border border-cyan-400/60 text-cyan-200'
              : 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/60 text-cyan-200'
          }`}
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Ocultar' : 'Activar'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Traveler Workspace */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-cyan-500/30 space-y-4 animate-fade-in">
          {/* 1. Live Location & Destination Search */}
          <div className="p-3 rounded-xl bg-[#050b1f] border border-[#1e3f8f] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                  Posición actual en viaje
                </span>
                {verifiedCoords ? (
                  <p className="text-xs font-semibold text-emerald-300 mt-0.5">
                    ✅ {resolvedRouteLabel || describePuntaAltaLocation(verifiedCoords)} ·{' '}
                    <span className="font-mono text-[11px] text-cyan-200">
                      {verifiedCoords.lat.toFixed(4)}, {verifiedCoords.lng.toFixed(4)}
                    </span>
                    {freshness?.ageLabel ? ` (${freshness.ageLabel})` : ''}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-amber-300 mt-0.5">
                    ⚠️ {gpsStatus || 'Activá el GPS o escribí la ciudad/ruta donde estás.'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {verifiedCoords && (
                  <a
                    href={`https://www.google.com/maps?q=${verifiedCoords.lat},${verifiedCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mi punto</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={onRequestCoords}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff]/60 text-[#37c8ff] text-xs font-bold flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{verifiedCoords ? 'Actualizar GPS' : 'Activar GPS'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={customCityQuery}
                onChange={(e) => setCustomCityQuery(e.target.value)}
                placeholder="Ciudad, balneario o ruta manual (ej: Pehuen Co, Bahía Blanca, Ruta 3)"
                className="w-full py-1.5 px-3 rounded-lg bg-[#071330] border border-[#1e4594] text-xs text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* 2. 1-Tap Radar for Hospitals, Pharmacies, Police & Fuel Anywhere */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" />
              <span>Buscar cerca tuyo en Google Maps {customCityQuery.trim() ? `(${customCityQuery.trim()})` : ''}</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <a
                href={buildNearbySearchLink('hospital guardia medica emergencias')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/60 text-white flex flex-col items-center text-center gap-1 transition active:scale-95"
              >
                <span className="text-lg">🏥</span>
                <span className="text-xs font-bold leading-tight">Guardia / Hospital</span>
              </a>

              <a
                href={buildNearbySearchLink('farmacia de turno abierta')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/60 text-white flex flex-col items-center text-center gap-1 transition active:scale-95"
              >
                <span className="text-lg">💊</span>
                <span className="text-xs font-bold leading-tight">Farmacia Abierta</span>
              </a>

              <a
                href={buildNearbySearchLink('comisaria policia')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/60 text-white flex flex-col items-center text-center gap-1 transition active:scale-95"
              >
                <span className="text-lg">🚓</span>
                <span className="text-xs font-bold leading-tight">Comisaría</span>
              </a>

              <a
                href={buildNearbySearchLink('estacion de servicio gomería auxilio')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/60 text-white flex flex-col items-center text-center gap-1 transition active:scale-95"
              >
                <span className="text-lg">⛽</span>
                <span className="text-xs font-bold leading-tight">Combustible / Auxilio</span>
              </a>
            </div>
          </div>

          {/* 3. National & Highway Emergency Direct Dial */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Emergencias Nacionales, Ruta y Costa (1 toque)</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NATIONAL_ROUTE_NUMBERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => triggerDirectCall(item.number, item.title, 'emergency')}
                  className="p-2.5 rounded-xl bg-[#07122c] hover:bg-[#10234f] border border-[#1e3f8f] hover:border-emerald-400/70 text-left flex items-center justify-between gap-2 transition active:scale-95"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs font-bold text-white truncate">{item.title}</span>
                    </div>
                    <span className="text-[10px] text-[#9db6dd] block truncate">{item.subtitle}</span>
                  </div>
                  <span className="text-sm font-black font-mono text-emerald-400 shrink-0">
                    {item.number}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Traveler Check-in & Route SOS via WhatsApp */}
          <div className="p-3 rounded-xl bg-[#050b1f] border border-emerald-500/40 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block">
              📲 Avisar ubicación en viaje por WhatsApp
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleWhatsAppCheckIn('checkin', medicalRecord?.cfam ? 'Familiar' : 'Cualquiera')}
                className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Avisar «Estoy bien en viaje» + GPS</span>
              </button>

              <button
                type="button"
                onClick={() => handleWhatsAppCheckIn('sos', medicalRecord?.cfam ? 'Familiar' : 'Cualquiera')}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>🚨 SOS en Ruta + Ficha Médica</span>
              </button>
            </div>
          </div>

          {/* 5. Offline Credential QR & Road Safety Checklist */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenQrModal}
              className="py-2 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-cyan-400/60 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>
                {hasRecord
                  ? 'Credencial QR lista (funciona sin señal)'
                  : 'Cargar Ficha / Credencial QR Offline'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowChecklist((v) => !v)}
              className="py-2 px-3 rounded-xl bg-[#071330] hover:bg-[#0c2050] border border-[#1e3f8f] text-[#9db6dd] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Checklist de ruta ({completedChecklistCount}/{checklist.length})</span>
            </button>
          </div>

          {showChecklist && (
            <div className="p-3 rounded-xl bg-[#040919] border border-[#1e3f8f] space-y-2 animate-fade-in">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklistItem(item.id)}
                  className="w-full flex items-center gap-2.5 text-left text-xs text-gray-200 hover:text-white py-1"
                >
                  {item.checked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <span className={item.checked ? 'line-through text-emerald-300/80' : ''}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
