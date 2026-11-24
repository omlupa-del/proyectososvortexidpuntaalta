import React, { useState } from 'react';
import {
  MapPin,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  LocateFixed
} from 'lucide-react';
import {
  Coordinates,
  POPULAR_PUNTA_ALTA_SPOTS,
  describePuntaAltaLocation,
  getCoordsFreshnessInfo,
  reverseGeocodePuntaAlta
} from '../utils/geo';
import { playChirp } from '../utils/callHandler';
import { Pharmacy } from '../data/puntaAltaData';

export interface GpsRadarHudProps {
  effectiveCoords: Coordinates;
  originMode: 'gps' | 'manual' | 'domicilio' | 'centro';
  customLocationLabel: string;
  closestPharmacy?: (Pharmacy & { distMeters: number }) | null;
  rawGpsCoords: Coordinates | null;
  gpsStatus: string;
  isGpsOutside: boolean;
  isUsingCenterFallback?: boolean;
  onSelectSpot: (spot: typeof POPULAR_PUNTA_ALTA_SPOTS[0]) => void;
  onApplyManualAddress: (address: string) => Promise<{ ok: boolean; label?: string; error?: string }>;
  onForceGps: () => void;
  onSelectDomicilio: () => void;
  hasDomicilio: boolean;
  domicilioText?: string;
}

export const GpsRadarHud: React.FC<GpsRadarHudProps> = ({
  effectiveCoords,
  originMode,
  customLocationLabel,
  rawGpsCoords,
  gpsStatus,
  isGpsOutside,
  isUsingCenterFallback,
  onSelectSpot,
  onApplyManualAddress,
  onForceGps,
  onSelectDomicilio,
  hasDomicilio,
  domicilioText
}) => {
  const [isSearchingStreet, setIsSearchingStreet] = useState<boolean>(false);
  const [streetQuery, setStreetQuery] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [isSyncingGps, setIsSyncingGps] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [liveStreetName, setLiveStreetName] = useState<string>('');

  const hasLiveGpsInCity = originMode === 'gps' && Boolean(rawGpsCoords) && !isGpsOutside;
  const isCoarseNetworkGps =
    hasLiveGpsInCity &&
    typeof rawGpsCoords?.accuracy === 'number' &&
    rawGpsCoords.accuracy > 150;

  React.useEffect(() => {
    let cancelled = false;
    if (!hasLiveGpsInCity || !rawGpsCoords || isCoarseNetworkGps) {
      setLiveStreetName('');
      return;
    }
    reverseGeocodePuntaAlta(rawGpsCoords).then((street) => {
      if (!cancelled) {
        setLiveStreetName(street || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasLiveGpsInCity, isCoarseNetworkGps, rawGpsCoords?.lat, rawGpsCoords?.lng]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3200);
  };

  const handleManualSearchSubmit = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const query = (directText || streetQuery).trim();
    if (!query) return;

    setSearchError('');
    setIsGeocoding(true);
    try {
      const result = await onApplyManualAddress(query);
      if (result.ok) {
        triggerToast(`Ubicación fijada en "${result.label || query}"`);
        setIsSearchingStreet(false);
        setStreetQuery('');
      } else {
        setSearchError(
          result.error ||
            'No encontramos esa dirección en Punta Alta. Probá calle y altura (ej: Brown 850) o esquina.'
        );
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleGpsSyncClick = () => {
    setIsSyncingGps(true);
    setSearchError('');
    playChirp('click');
    onForceGps();
    triggerToast('Actualizando GPS real de tu dispositivo…');
    setTimeout(() => {
      setIsSyncingGps(false);
    }, 1800);
  };

  const freshness = hasLiveGpsInCity ? getCoordsFreshnessInfo(rawGpsCoords) : null;
  const zoneLabel = hasLiveGpsInCity && rawGpsCoords ? describePuntaAltaLocation(rawGpsCoords) : '';

  let headingTitle = 'Referencia: Plaza Belgrano (Centro)';
  let subtitleText =
    gpsStatus || 'Activá GPS en tu celular o elegí tu calle para medir desde tu cuadra.';

  if (originMode === 'manual' && customLocationLabel) {
    headingTitle = `${customLocationLabel}, Punta Alta`;
    subtitleText = 'Mostrando farmacias ordenadas exactamente desde esta ubicación elegida';
  } else if (originMode === 'domicilio' && domicilioText) {
    headingTitle = `Domicilio: ${domicilioText}`;
    subtitleText = 'Mostrando farmacias ordenadas desde tu domicilio guardado';
  } else if (originMode === 'centro') {
    headingTitle = 'Plaza Belgrano (Centro)';
    subtitleText = 'Mostrando farmacias ordenadas desde el centro de Punta Alta';
  } else if (hasLiveGpsInCity && isCoarseNetworkGps) {
    headingTitle = 'Punta Alta (ubicación aprox. por red/WiFi)';
    const accPart = freshness?.accuracyMeters ? `±${freshness.accuracyMeters}m` : 'aprox.';
    subtitleText = `La señal por WiFi o antena (${accPart}) puede desviarse varias cuadras. Tocá "Elegir mi calle" para ubicación exacta.`;
  } else if (hasLiveGpsInCity) {
    headingTitle =
      liveStreetName ||
      (zoneLabel && zoneLabel !== 'Punta Alta' ? zoneLabel : 'Tu ubicación actual en Punta Alta');
    const accPart = freshness?.accuracyMeters ? `±${freshness.accuracyMeters}m` : 'activo';
    const agePart = freshness?.ageLabel ? ` · ${freshness.ageLabel}` : '';
    subtitleText = `Distancias calculadas desde tu GPS en tiempo real (${accPart}${agePart})`;
  } else if (originMode === 'gps' && rawGpsCoords && isGpsOutside) {
    const outsideDesc = describePuntaAltaLocation(rawGpsCoords);
    headingTitle = `Tu GPS real (${outsideDesc})`;
    subtitleText = 'Midiendo distancia real en km desde tu ubicación actual. ¿Buscás farmacias desde una calle de Punta Alta? Tocá "Elegir mi calle".';
  } else if (effectiveCoords?.label && originMode !== 'gps') {
    headingTitle = effectiveCoords.label;
  }

  return (
    <div className="mb-4 rounded-2xl bg-[#071330] border border-[#1e5bff]/50 p-4 shadow-lg text-white">
      {/* Toast de confirmación */}
      {toastMessage && (
        <div className="mb-3 py-1.5 px-3 rounded-xl bg-emerald-600/90 text-white font-bold text-xs flex items-center justify-between animate-fade-in shadow">
          <span>✓ {toastMessage}</span>
          <button type="button" onClick={() => setToastMessage('')} className="text-[10px] uppercase underline ml-2">
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Ubicación Honesta y Clara */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              hasLiveGpsInCity
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : isUsingCenterFallback
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
            }`}
          >
            {isUsingCenterFallback ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <MapPin className={`w-5 h-5 ${hasLiveGpsInCity ? 'text-emerald-400' : 'text-cyan-400'}`} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                Punto de Origen
              </span>
              {hasLiveGpsInCity && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400 text-black uppercase">
                  GPS en vivo {freshness?.accuracyMeters ? `· ±${freshness.accuracyMeters}m` : ''}
                </span>
              )}
              {originMode === 'gps' && rawGpsCoords && isGpsOutside && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-cyan-400 text-black uppercase">
                  GPS {describePuntaAltaLocation(rawGpsCoords)}
                </span>
              )}
              {originMode === 'gps' && !rawGpsCoords && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/60 uppercase">
                  Sin GPS activo · Centro
                </span>
              )}
              {originMode === 'manual' && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-cyan-400 text-black uppercase">
                  Calle confirmada
                </span>
              )}
              {originMode === 'domicilio' && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-black uppercase">
                  Tu domicilio
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white leading-tight mt-0.5 truncate">
              {headingTitle}
            </h3>
            <p className={`text-[11px] leading-snug mt-0.5 ${isUsingCenterFallback ? 'text-amber-200' : 'text-[#9db6dd]'}`}>
              {subtitleText}
            </p>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleGpsSyncClick}
            disabled={isSyncingGps}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
              originMode !== 'gps'
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow'
                : 'bg-[#0c235c] hover:bg-[#12368a] border-cyan-400/60 text-cyan-200 hover:text-white'
            }`}
          >
            {originMode !== 'gps' ? (
              <LocateFixed className="w-3.5 h-3.5" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGps ? 'animate-spin' : ''}`} />
            )}
            <span>
              {isSyncingGps
                ? 'GPS…'
                : originMode !== 'gps'
                ? 'Usar mi GPS'
                : 'Actualizar GPS'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSearchingStreet(!isSearchingStreet);
              setSearchError('');
            }}
            className="py-1.5 px-3 rounded-xl bg-[#0a1838] hover:bg-[#0e214d] border border-white/20 hover:border-cyan-400 text-gray-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isSearchingStreet ? 'Cerrar' : 'Elegir mi calle'}</span>
            {isSearchingStreet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Buscador de Calle / Barrio Plegable */}
      {isSearchingStreet && (
        <div className="mt-3 pt-3 border-t border-[#1e4594]/60 space-y-2.5 text-xs animate-fade-in">
          <form onSubmit={(e) => handleManualSearchSubmit(e)} className="flex gap-2">
            <input
              type="text"
              value={streetQuery}
              onChange={(e) => {
                setStreetQuery(e.target.value);
                if (searchError) setSearchError('');
              }}
              placeholder="Escribí tu calle o esquina (ej: Brown 1500, Paso y Mitre, Yrigoyen 800)..."
              className="flex-1 py-2 px-3 rounded-xl bg-[#030919] border border-cyan-400/70 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={isGeocoding}
              className="py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-black font-bold text-xs transition shrink-0"
            >
              {isGeocoding ? 'Buscando…' : 'Fijar'}
            </button>
          </form>

          {searchError && (
            <div className="p-2 rounded-lg bg-red-950/70 border border-red-500/60 text-red-200 text-[11px] font-semibold">
              ⚠️ {searchError}
            </div>
          )}

          {/* Atajos por zonas y barrios de Punta Alta */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px]">
            <span className="text-[#9db6dd] font-semibold">Zonas rápidas:</span>
            {POPULAR_PUNTA_ALTA_SPOTS.slice(0, 7).map((spot) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => {
                  onSelectSpot(spot);
                  triggerToast(`Ubicación fijada en ${spot.label}`);
                  setIsSearchingStreet(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0a1838] hover:bg-[#122e7a] border border-[#1e3f8f] text-gray-200 hover:text-white transition"
              >
                📍 {spot.label}
              </button>
            ))}
            {hasDomicilio && (
              <button
                type="button"
                onClick={() => {
                  onSelectDomicilio();
                  triggerToast('Fijado en tu domicilio');
                  setIsSearchingStreet(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/50 text-amber-200 font-semibold transition"
              >
                🏠 Mi Domicilio
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
