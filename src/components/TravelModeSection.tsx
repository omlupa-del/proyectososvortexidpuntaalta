import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  MapPin,
  Hospital,
  Pill,
  Shield,
  Phone,
  Navigation,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CloudSun,
  AlertTriangle
} from 'lucide-react';
import {
  Coordinates,
  isWithinPuntaAltaArea,
  isVerifiedEmergencyCoords,
  getDirectionsUrl,
  getNearbyMapSearchUrl,
  formatPharmacyDistanceBadge,
  calculateDistanceKm,
  DEFAULT_PUNTA_ALTA_COORDS
} from '../utils/geo';
import { triggerDirectCall, playChirp } from '../utils/callHandler';
import {
  TravelPlaceCategory,
  TravelNearbyPlace,
  TravelLocationInfo,
  TravelLocalWeather,
  reverseGeocodeTravelLocation,
  searchCityForTravelPreview,
  fetchTravelNearbyPlaces,
  fetchTravelLocalWeather
} from '../utils/travelModeService';

interface TravelModeSectionProps {
  coords: Coordinates | null;
  emergencyCoords?: Coordinates | null;
  onRequestCoords: () => void;
  gpsStatus: string;
}

export const TravelModeSection: React.FC<TravelModeSectionProps> = ({
  coords,
  emergencyCoords,
  onRequestCoords,
  gpsStatus
}) => {
  const realDeviceCoords = useMemo(() => {
    if (isVerifiedEmergencyCoords(emergencyCoords)) return emergencyCoords;
    if (isVerifiedEmergencyCoords(coords)) return coords;
    return null;
  }, [coords, emergencyCoords]);

  const isOutsidePuntaAlta = useMemo(() => {
    if (!realDeviceCoords) return false;
    return !isWithinPuntaAltaArea(realDeviceCoords);
  }, [realDeviceCoords]);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [previewCoords, setPreviewCoords] = useState<Coordinates | null>(null);
  const [cityQuery, setCityQuery] = useState<string>('');
  const [searchingCity, setSearchingCity] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');

  const [activeCategory, setActiveCategory] = useState<TravelPlaceCategory>('hospital');
  const [locationInfo, setLocationInfo] = useState<TravelLocationInfo | null>(null);
  const [localWeather, setLocalWeather] = useState<TravelLocalWeather | null>(null);
  const [places, setPlaces] = useState<TravelNearbyPlace[]>([]);
  const [placesSource, setPlacesSource] = useState<'live' | 'cache' | 'unavailable'>('live');
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);

  // Auto-open Travel Mode if real device GPS detects user is traveling outside Punta Alta
  useEffect(() => {
    if (isOutsidePuntaAlta && !previewCoords) {
      setIsExpanded(true);
    }
  }, [isOutsidePuntaAlta, previewCoords]);

  const activeTravelCoords: Coordinates | null = previewCoords || realDeviceCoords;
  const shouldLoadTravelData = Boolean(activeTravelCoords && (isExpanded || isOutsidePuntaAlta));

  const loadTravelData = async (target: Coordinates, forceRefresh = false) => {
    setLoadingPlaces(true);
    try {
      const [loc, weather, nearby] = await Promise.all([
        reverseGeocodeTravelLocation(target),
        fetchTravelLocalWeather(target),
        fetchTravelNearbyPlaces(target, 15000, forceRefresh)
      ]);
      setLocationInfo(loc);
      setLocalWeather(weather);
      setPlaces(nearby.places);
      setPlacesSource(nearby.source);
    } finally {
      setLoadingPlaces(false);
    }
  };

  useEffect(() => {
    if (!shouldLoadTravelData || !activeTravelCoords) return;
    loadTravelData(activeTravelCoords, false);
  }, [
    shouldLoadTravelData,
    activeTravelCoords?.lat.toFixed(3),
    activeTravelCoords?.lng.toFixed(3)
  ]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q) return;
    setSearchError('');
    setSearchingCity(true);
    try {
      const hit = await searchCityForTravelPreview(q);
      if (hit) {
        playChirp('success');
        setPreviewCoords(hit.coords);
        setIsExpanded(true);
      } else {
        setSearchError('No encontramos esa localidad. Probá con ciudad y provincia (ej: "Bahía Blanca" o "Tandil, Buenos Aires").');
      }
    } finally {
      setSearchingCity(false);
    }
  };

  const hospitalPlaces = useMemo(
    () => places.filter((p) => p.category === 'hospital'),
    [places]
  );
  const pharmacyPlaces = useMemo(
    () => places.filter((p) => p.category === 'pharmacy'),
    [places]
  );
  const policePlaces = useMemo(
    () => places.filter((p) => p.category === 'police'),
    [places]
  );

  const visiblePlaces =
    activeCategory === 'hospital'
      ? hospitalPlaces
      : activeCategory === 'pharmacy'
        ? pharmacyPlaces
        : policePlaces;

  const distanceFromPuntaAltaKm = activeTravelCoords
    ? Math.round(
        calculateDistanceKm(
          activeTravelCoords.lat,
          activeTravelCoords.lng,
          DEFAULT_PUNTA_ALTA_COORDS.lat,
          DEFAULT_PUNTA_ALTA_COORDS.lng
        )
      )
    : null;

  const activePlaceLabel =
    previewCoords?.label ||
    locationInfo?.displayName ||
    (activeTravelCoords?.label ? activeTravelCoords.label : 'Ubicación actual');

  const mapsFallbackQuery =
    activeCategory === 'hospital'
      ? 'hospital guardia medica 24hs'
      : activeCategory === 'pharmacy'
        ? 'farmacia de turno abierta'
        : 'comisaria policia';

  return (
    <section
      id="modo-viajero"
      className={`my-3.5 rounded-3xl border transition-all ${
        isOutsidePuntaAlta || previewCoords
          ? 'bg-gradient-to-br from-[#071a3d] via-[#07263b] to-[#050d24] border-2 border-cyan-400/90 shadow-2xl shadow-cyan-950/50'
          : 'bg-[#061229]/90 border-[#1b3a73] shadow-lg'
      }`}
    >
      {/* Compact Header / Toggle Strip (never disrupts Punta Alta layout) */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`p-2 rounded-xl border shrink-0 ${
              isOutsidePuntaAlta || previewCoords
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-[#0b1f48] border-[#264b8f] text-cyan-300'
            }`}
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                Modo Viajero · Cobertura Nacional
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  isOutsidePuntaAlta
                    ? 'bg-emerald-400 text-gray-950'
                    : previewCoords
                      ? 'bg-amber-400 text-gray-950'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40'
                }`}
              >
                {isOutsidePuntaAlta
                  ? 'Activo por GPS'
                  : previewCoords
                    ? 'Vista de viaje'
                    : 'Automático fuera de Punta Alta'}
              </span>
            </div>
            <p className="text-[11px] text-[#9db6dd] truncate">
              {isOutsidePuntaAlta || previewCoords
                ? `${activePlaceLabel}${distanceFromPuntaAltaKm !== null ? ` · a ${distanceFromPuntaAltaKm} km de Punta Alta` : ''}`
                : 'En viaje detecta tu GPS y muestra hospitales, guardias 24hs, farmacias y comisarías cercanas.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playChirp('click');
            setIsExpanded((prev) => !prev);
          }}
          className="px-3 py-1.5 rounded-xl bg-[#0d2454] hover:bg-[#153578] border border-cyan-400/50 text-cyan-200 font-bold text-xs inline-flex items-center gap-1.5 transition active:scale-95 shrink-0"
        >
          <span>{isExpanded ? 'Ocultar' : 'Abrir Modo Viajero'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Travel Mode Body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#1c3b73]/70 space-y-3.5 animate-fade-in">
          {/* City Search / GPS Controls */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <form onSubmit={handleCitySearch} className="flex-1 flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-cyan-300/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Probar o buscar otra ciudad (ej: Bahía Blanca, Tandil, Córdoba)..."
                  className="w-full py-2 pl-8 pr-3 rounded-xl bg-[#040a1a] border border-[#244a8c] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                disabled={searchingCity}
                className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-black text-xs transition active:scale-95 disabled:opacity-60 shrink-0"
              >
                {searchingCity ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            <div className="flex items-center gap-1.5 shrink-0">
              {previewCoords && (
                <button
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    setPreviewCoords(null);
                    setCityQuery('');
                    setSearchError('');
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-bold text-xs transition"
                >
                  Volver a mi GPS
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  if (activeTravelCoords) {
                    loadTravelData(activeTravelCoords, true);
                  } else {
                    onRequestCoords();
                  }
                }}
                disabled={loadingPlaces}
                className="px-3 py-2 rounded-xl bg-[#0b1f48] hover:bg-[#13306d] border border-cyan-400/50 text-cyan-200 font-bold text-xs inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPlaces ? 'animate-spin' : ''}`} />
                <span>{activeTravelCoords ? 'Actualizar' : 'Activar GPS'}</span>
              </button>
            </div>
          </div>

          {searchError && (
            <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-500/40 rounded-xl px-3 py-2">
              {searchError}
            </p>
          )}

          {!activeTravelCoords ? (
            <div className="p-4 rounded-2xl bg-[#040a1a] border border-cyan-500/40 text-center space-y-2">
              <p className="text-xs text-[#cfe0ff]">
                Activá el GPS del dispositivo ({gpsStatus || 'pendiente'}) o escribí arriba cualquier localidad del país para ver hospitales, guardias, farmacias y clima local en vivo.
              </p>
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  onRequestCoords();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-gray-950 font-black text-xs inline-flex items-center gap-1.5 shadow"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Detectar mi ubicación actual</span>
              </button>
            </div>
          ) : (
            <>
              {/* Current Travel City + Local Weather Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#040a1a]/90 border border-cyan-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                      {previewCoords ? 'Localidad consultada' : 'Localidad detectada por GPS'}
                    </span>
                    <p className="text-sm font-black text-white truncate">{activePlaceLabel}</p>
                    {locationInfo?.road && (
                      <p className="text-[11px] text-[#9db6dd] truncate">Cerca de {locationInfo.road}</p>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${activeTravelCoords.lat},${activeTravelCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-[#0b1f48] hover:bg-[#143170] border border-cyan-400/50 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Ver mapa</span>
                  </a>
                </div>

                <div className="p-3 rounded-2xl bg-[#040a1a]/90 border border-cyan-500/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CloudSun className="w-6 h-6 text-cyan-300 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                        Clima en el lugar
                      </span>
                      {localWeather ? (
                        <p className="text-xs font-bold text-white truncate">
                          {localWeather.temperature}°C · {localWeather.conditionText} · Viento {localWeather.windSpeed} km/h
                        </p>
                      ) : (
                        <p className="text-xs text-[#9db6dd]">Consultando estación local...</p>
                      )}
                    </div>
                  </div>
                  {localWeather && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                        localWeather.alertLevel === 'roja'
                          ? 'bg-red-600 text-white'
                          : localWeather.alertLevel === 'naranja'
                            ? 'bg-orange-500 text-black'
                            : localWeather.alertLevel === 'amarilla'
                              ? 'bg-amber-400 text-black'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                      }`}
                    >
                      {localWeather.alertLevel === 'verde' ? 'Estable' : `Alerta ${localWeather.alertLevel}`}
                    </span>
                  )}
                </div>
              </div>

              {/* National 1-Tap Emergency Numbers Strip */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { dial: '107', label: '107 SAME', cls: 'bg-red-600 hover:bg-red-500 text-white' },
                  { dial: '911', label: '911 Policía', cls: 'bg-blue-700 hover:bg-blue-600 text-white' },
                  { dial: '100', label: '100 Bomberos', cls: 'bg-orange-600 hover:bg-orange-500 text-white' },
                  { dial: '103', label: '103 Def. Civil', cls: 'bg-amber-500 hover:bg-amber-400 text-gray-950' }
                ].map((em) => (
                  <button
                    key={em.dial}
                    type="button"
                    onClick={() => triggerDirectCall(em.dial, em.label, 'emergency')}
                    className={`py-2 px-1.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow active:scale-95 transition ${em.cls}`}
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    <span className="truncate">{em.label}</span>
                  </button>
                ))}
              </div>

              {/* Category Filter Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#040a1a] border border-[#1d3b75]">
                <button
                  type="button"
                  onClick={() => setActiveCategory('hospital')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    activeCategory === 'hospital'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow'
                      : 'text-[#9db6dd] hover:text-white'
                  }`}
                >
                  <Hospital className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Hospitales ({hospitalPlaces.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('pharmacy')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    activeCategory === 'pharmacy'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-gray-950 font-black shadow'
                      : 'text-[#9db6dd] hover:text-white'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Farmacias ({pharmacyPlaces.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('police')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    activeCategory === 'police'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                      : 'text-[#9db6dd] hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Comisarías ({policePlaces.length})</span>
                </button>
              </div>

              {activeCategory === 'pharmacy' && (
                <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-400/40 flex items-start gap-2 text-[11px] text-amber-100/90">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    Los turnos rotativos nocturnos dependen de cada Colegio de Farmacéuticos local. Acá ves las farmacias más cercanas por GPS y podés verificar abiertas ahora en Google Maps con 1 toque.
                  </span>
                </div>
              )}

              {/* Results List */}
              {loadingPlaces && visiblePlaces.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#040a1a] border border-[#1d3b75] text-center text-xs text-cyan-200 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Buscando centros de salud y farmacias reales alrededor de {activePlaceLabel}...</span>
                </div>
              ) : visiblePlaces.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#040a1a] border border-[#1d3b75] text-center space-y-2.5">
                  <p className="text-xs text-[#cfe0ff]">
                    {placesSource === 'unavailable'
                      ? 'El mapa abierto está momentáneamente saturado o sin señal para esta consulta.'
                      : 'No encontramos registros detallados de esta categoría dentro de 15 km en el mapa abierto.'}
                  </p>
                  <a
                    href={getNearbyMapSearchUrl(mapsFallbackQuery, activeTravelCoords)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-gray-950 font-black text-xs shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buscar directo en Google Maps</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {visiblePlaces.map((place) => (
                    <div
                      key={place.id}
                      className="p-3 rounded-2xl bg-[#040a1a]/95 border border-[#1f407d] hover:border-cyan-400/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-black text-white truncate">
                            {place.name}
                          </h3>
                          {place.is24h && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-[10px]">
                              24 HS
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 font-bold text-[10px]">
                            {formatPharmacyDistanceBadge(place.distMeters, { includeApprox: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9db6dd] truncate">
                          {place.subtitle} · {place.address}
                        </p>
                        {place.openingHours && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            Horario mapa: {place.openingHours}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {place.phone && (
                          <button
                            type="button"
                            onClick={() => triggerDirectCall(place.phone!, place.name, 'emergency')}
                            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs inline-flex items-center gap-1 active:scale-95 transition"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Llamar</span>
                          </button>
                        )}
                        <a
                          href={getDirectionsUrl(
                            {
                              name: place.name,
                              address: place.address,
                              lat: place.lat,
                              lng: place.lng
                            },
                            activeTravelCoords
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-[#0e2961] hover:bg-[#163a85] border border-cyan-400/60 text-cyan-200 font-bold text-xs inline-flex items-center gap-1 active:scale-95 transition"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Cómo llegar</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Google Maps Quick Fallback */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-slate-400">
                  Fuente abierta en tiempo real (OpenStreetMap + Open-Meteo) · Radio 15 km
                </span>
                <a
                  href={getNearbyMapSearchUrl(mapsFallbackQuery, activeTravelCoords)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir «{mapsFallbackQuery}» en Google Maps</span>
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
