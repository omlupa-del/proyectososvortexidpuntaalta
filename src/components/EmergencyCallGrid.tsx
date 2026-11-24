import React, { useState } from 'react';
import { Phone, MapPin, Share2, Send, ShieldAlert, ExternalLink, RefreshCw, Edit3, X } from 'lucide-react';
import { EMERGENCY_SERVICES, EmergencyContact } from '../data/puntaAltaData';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from '../utils/callHandler';
import {
  getMapSearchUrl,
  Coordinates,
  isVerifiedEmergencyCoords,
  getCoordsFreshnessInfo,
  describePuntaAltaLocation,
  POPULAR_PUNTA_ALTA_SPOTS,
  fetchGeocodedLocation
} from '../utils/geo';
import { MedicalRecord, buildSosMessage } from '../utils/medicalData';

interface EmergencyCallGridProps {
  medicalRecord: MedicalRecord | null;
  coords: Coordinates | null;
  ipFallback?: Coordinates | null;
  onRequestCoords: () => void;
  gpsStatus: string;
  onOpenUnattended?: () => void;
}

export const EmergencyCallGrid: React.FC<EmergencyCallGridProps> = ({
  medicalRecord,
  coords,
  ipFallback,
  onRequestCoords,
  gpsStatus,
  onOpenUnattended
}) => {
  const [manualAccidentCoords, setManualAccidentCoords] = useState<Coordinates | null>(null);
  const [showCornerPicker, setShowCornerPicker] = useState<boolean>(false);
  const [cornerInput, setCornerInput] = useState<string>('');
  const [isResolvingCorner, setIsResolvingCorner] = useState<boolean>(false);
  const [cornerError, setCornerError] = useState<string>('');

  const activeEmergencyCoords = manualAccidentCoords || (isVerifiedEmergencyCoords(coords) ? coords : null);
  const freshness = activeEmergencyCoords ? getCoordsFreshnessInfo(activeEmergencyCoords) : null;

  const handleApplyCorner = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = cornerInput.trim();
    if (!query) return;
    setCornerError('');
    setIsResolvingCorner(true);
    try {
      const res = await fetchGeocodedLocation(query);
      if (res) {
        playChirp('success');
        setManualAccidentCoords({ ...res.coords, source: 'manual', label: res.label });
        setShowCornerPicker(false);
        setCornerInput('');
      } else {
        setCornerError('No encontramos esa calle o esquina en Punta Alta. Probá ej: "Brown 850" o "Paso y Mitre".');
      }
    } finally {
      setIsResolvingCorner(false);
    }
  };

  const handleCall = (service: EmergencyContact) => {
    triggerDirectCall(service.directDial, service.title, 'emergency');
  };

  const handleShareLocationWhatsApp = (targetType: 'Familiar' | 'Amigo' | 'Médico' | 'Cualquiera') => {
    const rawNumber =
      targetType === 'Familiar'
        ? medicalRecord?.cfam
        : targetType === 'Amigo'
        ? medicalRecord?.cami
        : targetType === 'Médico'
        ? medicalRecord?.cmed
        : '';

    const waNum = rawNumber ? formatWhatsAppNumber(rawNumber) : '';
    const message = buildSosMessage(medicalRecord, activeEmergencyCoords, ipFallback);
    const encoded = encodeURIComponent(message);

    const waUrl = waNum ? `https://wa.me/${waNum}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Check if user has personal emergency contacts saved
  const personalContacts = [
    { label: 'Familiar', phone: medicalRecord?.cfam },
    { label: 'Amigo', phone: medicalRecord?.cami },
    { label: 'Médico', phone: medicalRecord?.cmed },
    { label: 'Contacto SOS', phone: medicalRecord?.tel }
  ].filter((c) => Boolean(c.phone));

  return (
    <section id="emergencias" className="my-5 rounded-2xl bg-gradient-to-b from-[#140814] via-[#0b1736] to-[#07122c] border-2 border-red-500/70 p-4 sm:p-5 shadow-2xl shadow-red-950/40">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-red-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600/30 border border-red-500 flex items-center justify-center text-xl">
            🚨
          </div>
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-wide text-white flex items-center gap-2">
              EMERGENCIAS PUNTA ALTA
            </h2>
            <p className="text-xs text-[#9db6dd]">
              Llamada directa en 1 toque · Asistencia médica, policial y rescate
            </p>
          </div>
        </div>
      </div>

      {/* Modo Desatendido Quick Access Card */}
      {onOpenUnattended && (
        <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-red-950 via-[#260505] to-red-950 border border-red-500/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg shadow-red-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  Modo Desatendido · Auxilio Automático
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white animate-pulse">
                  SIN ESPERA
                </span>
              </div>
              <p className="text-xs text-red-200/90 leading-tight">
                Dispara GPS a tus contactos y llama al 911 sin requerir confirmación en pantalla.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUnattended}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition shrink-0 text-center"
          >
            Activar / Configurar
          </button>
        </div>
      )}

      {/* Emergency Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EMERGENCY_SERVICES.map((srv) => (
          <div
            key={srv.id}
            className="flex flex-col justify-between p-3.5 rounded-xl bg-[#07122c]/90 border border-[#1e3f8f] hover:border-red-400/60 transition shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{srv.icon}</span>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white tracking-wide">
                    {srv.title}
                  </h3>
                  <p className="text-xs text-[#9db6dd] line-clamp-1">{srv.subtitle}</p>
                </div>
              </div>
              <span className="text-2xl font-extrabold font-heading text-red-400 tabular-nums">
                {srv.number}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCall(srv)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-md shadow-emerald-950/60 active:scale-95 transition"
              >
                <Phone className="w-4 h-4" />
                <span>Llamar al {srv.number}</span>
              </button>

              <a
                href={getMapSearchUrl(srv.mapQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2.5 rounded-lg bg-[#0a1f55] hover:bg-[#122e7a] border border-[#1e5bff]/60 text-[#37c8ff] hover:text-white transition"
                title={`Ver ${srv.title} en mapa`}
              >
                <MapPin className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Personal Emergency Contacts (If configured in medical record) */}
      {personalContacts.length > 0 && (
        <div className="mt-4 p-3.5 rounded-xl bg-[#0a1738] border border-[#1e5bff]/60">
          <h3 className="text-sm font-bold font-heading uppercase tracking-wider text-[#37c8ff] flex items-center gap-1.5 mb-2">
            <Phone className="w-4 h-4" />
            Tus contactos personales de auxilio
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {personalContacts.map((c, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#07122c] border border-[#1e3f8f]"
              >
                <div>
                  <span className="text-xs font-semibold text-[#9db6dd]">{c.label}</span>
                  <div className="text-sm font-bold text-white tabular-nums">{c.phone}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerDirectCall(c.phone!, `Contacto: ${c.label}`, 'contact')}
                    className="py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Llamar</span>
                  </button>
                  <a
                    href={`https://wa.me/${formatWhatsAppNumber(c.phone!)}?text=${encodeURIComponent(
                      buildSosMessage(medicalRecord, activeEmergencyCoords, ipFallback)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 rounded-md bg-emerald-950 border border-emerald-500/80 text-emerald-300 text-xs font-bold transition hover:bg-emerald-900"
                    title="Avisar por WhatsApp con GPS"
                  >
                    <Send className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share GPS Location by WhatsApp */}
      <div className="mt-4 p-3.5 rounded-xl bg-[#07122c] border border-[#1e3f8f]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold font-heading text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#37c8ff]" />
              Compartir ubicación exacta del incidente
            </h3>
            {manualAccidentCoords ? (
              <p className="text-xs text-cyan-300 font-semibold mt-0.5">
                📍 Esquina confirmada: {manualAccidentCoords.label} ({manualAccidentCoords.lat.toFixed(5)}, {manualAccidentCoords.lng.toFixed(5)})
              </p>
            ) : activeEmergencyCoords ? (
              <p className={`text-xs font-semibold mt-0.5 ${freshness?.isStale ? 'text-amber-300' : 'text-emerald-300'}`}>
                {freshness?.isStale ? '🕒 GPS anterior' : '✅ GPS real listo'}: {activeEmergencyCoords.lat.toFixed(5)}, {activeEmergencyCoords.lng.toFixed(5)}
                {freshness?.accuracyMeters ? ` (±${freshness.accuracyMeters}m)` : ''}
                {freshness?.ageLabel ? ` · ${freshness.ageLabel}` : ''}
                {` · ${describePuntaAltaLocation(activeEmergencyCoords)}`}
              </p>
            ) : (
              <p className="text-xs text-amber-300 font-semibold mt-0.5">
                ⚠️ {gpsStatus || 'GPS sin señal todavía. Tocá "Activar GPS" o marcá la esquina exacta.'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {activeEmergencyCoords && (
              <a
                href={`https://www.google.com/maps?q=${activeEmergencyCoords.lat},${activeEmergencyCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1 px-2.5 rounded-md bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-500/60 text-xs text-emerald-200 font-semibold flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Ver mi punto</span>
              </a>
            )}
            {manualAccidentCoords ? (
              <button
                type="button"
                onClick={() => {
                  setManualAccidentCoords(null);
                  onRequestCoords();
                }}
                className="py-1 px-2.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-xs text-white font-bold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Volver a GPS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestCoords}
                className="py-1 px-2.5 rounded-md bg-[#0a1f55] border border-[#37c8ff]/60 text-xs text-[#37c8ff] hover:text-white font-medium flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{activeEmergencyCoords ? 'Actualizar GPS' : 'Activar GPS'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowCornerPicker((v) => !v);
                setCornerError('');
              }}
              className="py-1 px-2.5 rounded-md bg-[#0a1838] hover:bg-[#122e7a] border border-cyan-500/50 text-xs text-cyan-200 font-semibold flex items-center gap-1 transition"
              title="Indicar esquina exacta si el GPS está bloqueado o en vía pública"
            >
              {showCornerPicker ? <X className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
              <span>{showCornerPicker ? 'Cerrar' : 'Marcar esquina'}</span>
            </button>
          </div>
        </div>

        {showCornerPicker && (
          <div className="mt-3 p-3 rounded-xl bg-[#040a1b] border border-cyan-400/50 space-y-2 text-xs animate-fade-in">
            <p className="text-[11px] font-bold text-cyan-300">
              📍 ¿En qué calle o esquina ocurrió el incidente en vía pública?
            </p>
            <form onSubmit={handleApplyCorner} className="flex gap-2">
              <input
                type="text"
                value={cornerInput}
                onChange={(e) => {
                  setCornerInput(e.target.value);
                  if (cornerError) setCornerError('');
                }}
                placeholder="Ej: Brown y Paso, Espora 428, Ruta 249..."
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#071330] border border-[#1e4594] text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={isResolvingCorner}
                className="py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-black font-bold text-xs shrink-0"
              >
                {isResolvingCorner ? 'Buscando…' : 'Fijar punto'}
              </button>
            </form>
            {cornerError && (
              <p className="text-[11px] text-red-300 font-semibold">⚠️ {cornerError}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {POPULAR_PUNTA_ALTA_SPOTS.slice(0, 6).map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    setManualAccidentCoords({ ...spot.coords, source: 'manual', label: spot.label });
                    setShowCornerPicker(false);
                  }}
                  className="px-2 py-1 rounded-md bg-[#0a1838] hover:bg-[#122e7a] border border-[#1e3f8f] text-[11px] text-gray-200"
                >
                  📍 {spot.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleShareLocationWhatsApp('Familiar')}
            className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/70 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Familiar</span>
          </button>

          <button
            type="button"
            onClick={() => handleShareLocationWhatsApp('Amigo')}
            className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/70 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Amigo</span>
          </button>

          <button
            type="button"
            onClick={() => handleShareLocationWhatsApp('Médico')}
            className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/70 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Médico</span>
          </button>

          <button
            type="button"
            onClick={() => handleShareLocationWhatsApp('Cualquiera')}
            className="py-2 px-3 rounded-lg bg-[#0a1f55] hover:bg-[#122e7a] border border-[#1e5bff] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 text-[#37c8ff]" />
            <span>Elegir contacto</span>
          </button>
        </div>
      </div>
    </section>
  );
};
