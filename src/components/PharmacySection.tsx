import React, { useState, useMemo, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Search,
  AlertCircle,
  Star,
  Clock,
  Sparkles,
  Edit3,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  Sun,
  Moon,
  Calendar,
  X,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { GpsRadarHud } from './GpsRadarHud';
import { ColegioDutyImporterModal } from './ColegioDutyImporterModal';
import {
  Pharmacy,
  PUNTA_ALTA_PHARMACIES,
  getDutyPharmaciesForDate,
  saveCustomDutyOverride,
  clearCustomDutyOverride,
  getCustomDutyOverrides,
  getPuntaAltaTimeParts,
  syncDutyScheduleFromServer,
  DutyShiftInfo
} from '../data/puntaAltaData';
import {
  Coordinates,
  sortByHaversineDistance,
  getDirectionsUrl,
  getMapSearchUrl,
  estimateCoordsFromPuntaAltaAddress,
  fetchGeocodedLocation,
  describePuntaAltaLocation,
  isWithinPuntaAltaArea,
  isVerifiedEmergencyCoords,
  formatPharmacyDistanceBadge,
  reverseGeocodePuntaAlta,
  POPULAR_PUNTA_ALTA_SPOTS,
  DEFAULT_PUNTA_ALTA_COORDS
} from '../utils/geo';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from '../utils/callHandler';
import { MedicalRecord } from '../utils/medicalData';
import { verifyAdminPin, recoverAdminPin } from '../utils/systemConfig';
import { useAuth } from '../context/AuthContext';
import {
  speakNaturalSpanish,
  stopVoiceAssistant,
  buildDutyPharmaciesSpeech
} from '../utils/voiceAssistant';

interface PharmacySectionProps {
  coords: Coordinates | null;
  onRequestCoords: () => void;
  gpsStatus: string;
  medicalRecord?: MedicalRecord | null;
}

export const PharmacySection: React.FC<PharmacySectionProps> = ({
  coords,
  onRequestCoords,
  gpsStatus,
  medicalRecord
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [shiftPreference, setShiftPreference] = useState<'active_now' | 'next_shift'>('active_now');
  const [dutyVersion, setDutyVersion] = useState<number>(0);
  const [clockTick, setClockTick] = useState<number>(0);
  const [isEditingDuty, setIsEditingDuty] = useState<boolean>(false);
  const [dutyEditError, setDutyEditError] = useState<string>('');
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [editingSelectedIds, setEditingSelectedIds] = useState<string[]>([]);
  const [editSearch, setEditSearch] = useState<string>('');
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const [isAdminDutyUnlocked, setIsAdminDutyUnlocked] = useState<boolean>(false);
  const [verifiedAdminPin, setVerifiedAdminPin] = useState<string>('');
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string>('');
  const [showAdminPin, setShowAdminPin] = useState<boolean>(false);
  const [showDutyRecovery, setShowDutyRecovery] = useState<boolean>(false);
  const [dutyRecIdentity, setDutyRecIdentity] = useState<string>('');
  const [dutyRecNewPin, setDutyRecNewPin] = useState<string>('');
  const [showDutyRecPin, setShowDutyRecPin] = useState<boolean>(false);
  const [dutyRecError, setDutyRecError] = useState<string>('');
  const [dutyRecBusy, setDutyRecBusy] = useState<boolean>(false);

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [spokenSubtitle, setSpokenSubtitle] = useState<string>('');
  const [showAllList, setShowAllList] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const PREF_ORIGIN_STORAGE_KEY = 'vortex_preferred_origin_mode_v4';

  // Origin mode defaults to live 'gps' so every neighbor gets distances from their real position
  const [originMode, setOriginMode] = useState<'gps' | 'manual' | 'domicilio' | 'centro'>(() => {
    try {
      const stored = localStorage.getItem(PREF_ORIGIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.label && /414\s*\/\s*415|col[oó]n\s*415/i.test(String(parsed.label))) {
          localStorage.setItem(PREF_ORIGIN_STORAGE_KEY, JSON.stringify({ mode: 'gps' }));
          return 'gps';
        }
        if (parsed.mode) return parsed.mode;
      }
    } catch {}
    return 'gps';
  });

  const [customCoords, setCustomCoords] = useState<Coordinates | null>(() => {
    try {
      const stored = localStorage.getItem(PREF_ORIGIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.label && /414\s*\/\s*415|col[oó]n\s*415/i.test(String(parsed.label))) {
          return null;
        }
        if (parsed.coords) return parsed.coords;
      }
    } catch {}
    return null;
  });

  const [customLocationLabel, setCustomLocationLabel] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(PREF_ORIGIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.label && /414\s*\/\s*415|col[oó]n\s*415/i.test(String(parsed.label))) {
          return '';
        }
        if (parsed.label) return parsed.label;
      }
    } catch {}
    return '';
  });

  const [liveGpsStreet, setLiveGpsStreet] = useState<string>('');

  const isCoarseNetworkGps = Boolean(
    originMode === 'gps' &&
      coords &&
      typeof coords.accuracy === 'number' &&
      coords.accuracy > 150
  );

  useEffect(() => {
    let cancelled = false;
    if (originMode !== 'gps' || !coords || !isWithinPuntaAltaArea(coords) || isCoarseNetworkGps) {
      setLiveGpsStreet('');
      return;
    }
    reverseGeocodePuntaAlta(coords).then((street) => {
      if (!cancelled) {
        setLiveGpsStreet(street || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [originMode, isCoarseNetworkGps, coords?.lat, coords?.lng]);

  // Check if GPS signal is coming from outside Punta Alta
  const isGpsOutside = useMemo(() => {
    return coords ? !isWithinPuntaAltaArea(coords) : false;
  }, [coords]);

  const isUsingCenterFallback = originMode === 'gps' && !isVerifiedEmergencyCoords(coords);

  // Domicile coordinates of the person
  const domicileCoords = useMemo(() => {
    return estimateCoordsFromPuntaAltaAddress(medicalRecord?.domicilio);
  }, [medicalRecord?.domicilio]);

  // Calculate effective origin coordinates (never silently falls back to Plaza Belgrano when real GPS exists)
  const effectiveCoords = useMemo((): Coordinates => {
    if (originMode === 'manual' && customCoords) {
      return customCoords;
    }
    if (originMode === 'domicilio' && domicileCoords) {
      return domicileCoords;
    }
    if (originMode === 'centro') {
      return DEFAULT_PUNTA_ALTA_COORDS;
    }
    if (coords && isVerifiedEmergencyCoords(coords)) {
      return coords;
    }
    return DEFAULT_PUNTA_ALTA_COORDS;
  }, [originMode, customCoords, domicileCoords, coords]);

  const currentOriginDescription = useMemo((): string => {
    if (originMode === 'manual' && customLocationLabel) {
      return customLocationLabel;
    }
    if (originMode === 'domicilio' && medicalRecord?.domicilio) {
      return `tu domicilio (${medicalRecord.domicilio.split(',')[0]})`;
    }
    if (originMode === 'centro') {
      return 'Plaza Belgrano (Centro)';
    }
    if (coords && isWithinPuntaAltaArea(coords)) {
      if (isCoarseNetworkGps) {
        return 'tu ubicación aproximada por red en Punta Alta';
      }
      if (liveGpsStreet) {
        return `tu GPS (${liveGpsStreet})`;
      }
      const zone = describePuntaAltaLocation(coords);
      return zone && zone !== 'Punta Alta' ? `tu GPS (${zone})` : 'tu GPS satelital';
    }
    if (coords && isVerifiedEmergencyCoords(coords)) {
      return `tu GPS (${describePuntaAltaLocation(coords)})`;
    }
    return 'Plaza Belgrano (sin señal GPS activa)';
  }, [originMode, customLocationLabel, medicalRecord?.domicilio, coords, liveGpsStreet, isCoarseNetworkGps]);

  // Get current Punta Alta time parts (auto-updates every 60s across 08:30 shift transitions)
  const paTime = useMemo(() => {
    return getPuntaAltaTimeParts(new Date());
  }, [clockTick]);

  // Duty pharmacies for the chosen date and shift preference
  const dutyInfo: DutyShiftInfo = useMemo(() => {
    // dutyVersion and clockTick included to trigger reload on overrides and 08:30 shift rollovers
    const refDate = isTodayRefDate(selectedDate, paTime) ? new Date() : selectedDate;
    return getDutyPharmaciesForDate(refDate, shiftPreference);
  }, [selectedDate, shiftPreference, dutyVersion, clockTick, paTime]);

  // All 20 pharmacies directory strictly sorted by Haversine distance
  const allPharmaciesWithDist = useMemo(() => {
    return sortByHaversineDistance(PUNTA_ALTA_PHARMACIES, effectiveCoords);
  }, [effectiveCoords]);

  // Duty pharmacies strictly sorted by distance
  const dutyPharmaciesWithDist = useMemo(() => {
    const rawDuty = PUNTA_ALTA_PHARMACIES.filter((p) => dutyInfo.pharmacyIds.includes(p.id));
    return sortByHaversineDistance(rawDuty, effectiveCoords);
  }, [dutyInfo.pharmacyIds, effectiveCoords]);

  // The CLOSEST pharmacy currently ON DUTY (guardia 24hs)
  const closestDutyPharmacy = useMemo(() => {
    return dutyPharmaciesWithDist[0] || null;
  }, [dutyPharmaciesWithDist]);

  // Closest commercial pharmacy (for reference during daylight hours)
  const closestOverallPharmacy = useMemo(() => {
    return allPharmaciesWithDist[0] || null;
  }, [allPharmaciesWithDist]);

  // Filtered list for search query
  const filteredAllPharmacies = useMemo(() => {
    if (!searchQuery.trim()) return allPharmaciesWithDist;
    const q = searchQuery.toLowerCase();
    return allPharmaciesWithDist.filter(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
    );
  }, [searchQuery, allPharmaciesWithDist]);

  // Listen to duty updates & 60s shift transitions
  useEffect(() => {
    const handleDutyUpdated = () => {
      setDutyVersion((v) => v + 1);
    };

    window.addEventListener('vortex_duty_updated', handleDutyUpdated);

    // Initial sync of duty schedule from server
    syncDutyScheduleFromServer().then(() => {
      setDutyVersion((v) => v + 1);
    });

    // Live 60s clock tick so 08:30 hs duty transitions update automatically without reload
    const tickTimer = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 60000);

    return () => {
      clearInterval(tickTimer);
      window.removeEventListener('vortex_duty_updated', handleDutyUpdated);
    };
  }, []);

  // Stop voice assistant on unmount or date change
  useEffect(() => {
    return () => {
      stopVoiceAssistant();
    };
  }, []);

  useEffect(() => {
    stopVoiceAssistant();
    setIsSpeaking(false);
    setCurrentlySpeakingId(null);
    setSpokenSubtitle('');
  }, [selectedDate, shiftPreference, originMode, customCoords]);

  // Initialize edit selection when opening editor
  const handleOpenDutyEditor = () => {
    playChirp('click');
    setDutyEditError('');
    setEditingSelectedIds([...dutyInfo.pharmacyIds]);
    setIsEditingDuty(true);
  };

  const handleToggleDutyPharmacy = (id: string) => {
    playChirp('click');
    setDutyEditError('');
    setEditingSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pId) => pId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSaveDutyCustom = () => {
    if (editingSelectedIds.length === 0) {
      setDutyEditError('Seleccioná al menos una farmacia de guardia antes de guardar.');
      return;
    }
    playChirp('success');
    setDutyEditError('');
    saveCustomDutyOverride(dutyInfo.dateKey, editingSelectedIds, verifiedAdminPin);
    setDutyVersion((v) => v + 1);
    setIsEditingDuty(false);
  };

  const handleResetDutyOfficial = () => {
    playChirp('click');
    setDutyEditError('');
    clearCustomDutyOverride(dutyInfo.dateKey);
    setDutyVersion((v) => v + 1);
    setIsEditingDuty(false);
  };

  const handleVerifyAdminGlyphPin = async () => {
    const cleaned = adminPinInput.trim();
    if (!cleaned) {
      setAdminPinError('Ingresá la clave PIN');
      return;
    }
    const res = await verifyAdminPin(cleaned);
    if (res.valid) {
      playChirp('success');
      setVerifiedAdminPin(cleaned);
      setIsAdminDutyUnlocked(true);
      setShowAdminPinPrompt(false);
      setAdminPinInput('');
      setAdminPinError('');
      setShowAdminPin(false);
      setShowDutyRecovery(false);
    } else {
      setAdminPinError(res.error || 'Clave incorrecta');
    }
  };

  const handleRecoverDutyAdminPin = async () => {
    setDutyRecError('');
    setDutyRecBusy(true);
    try {
      const res = await recoverAdminPin({
        identity: dutyRecIdentity.trim(),
        newPin: dutyRecNewPin.trim(),
        verifiedAdminEmail: isAdmin ? (user?.email || 'omlupa@gmail.com') : null
      });
      if (!res.ok) {
        setDutyRecError(res.error || 'No se pudo verificar la identidad del administrador.');
        return;
      }
      playChirp('success');
      setVerifiedAdminPin(res.adminPin || '1234');
      setIsAdminDutyUnlocked(true);
      setShowAdminPinPrompt(false);
      setShowDutyRecovery(false);
      setDutyRecIdentity('');
      setDutyRecNewPin('');
      setAdminPinInput('');
      setAdminPinError('');
    } finally {
      setDutyRecBusy(false);
    }
  };

  const handleSelectSpot = (spot: typeof POPULAR_PUNTA_ALTA_SPOTS[0]) => {
    playChirp('click');
    setCustomCoords(spot.coords);
    setCustomLocationLabel(spot.label);
    setOriginMode('manual');
    try {
      localStorage.setItem(
        PREF_ORIGIN_STORAGE_KEY,
        JSON.stringify({ mode: 'manual', label: spot.label, coords: spot.coords })
      );
    } catch {}
    window.dispatchEvent(
      new CustomEvent('vortex_origin_changed', {
        detail: { coords: spot.coords, label: spot.label, mode: 'manual' }
      })
    );
  };

  const handleApplyManualAddress = async (
    query: string
  ): Promise<{ ok: boolean; label?: string; error?: string }> => {
    const trimmed = query.trim();
    if (!trimmed) {
      return { ok: false, error: 'Ingresá una calle o esquina de Punta Alta.' };
    }
    const res = await fetchGeocodedLocation(trimmed);
    if (res) {
      playChirp('click');
      setCustomCoords(res.coords);
      setCustomLocationLabel(res.label);
      setOriginMode('manual');
      try {
        localStorage.setItem(
          PREF_ORIGIN_STORAGE_KEY,
          JSON.stringify({ mode: 'manual', label: res.label, coords: res.coords })
        );
      } catch {}
      window.dispatchEvent(
        new CustomEvent('vortex_origin_changed', {
          detail: { coords: res.coords, label: res.label, mode: 'manual' }
        })
      );
      return { ok: true, label: res.label };
    }
    return {
      ok: false,
      error:
        'No pudimos ubicar esa calle en Punta Alta. Probá con calle y altura (ej: Brown 850) o esquina (ej: Paso y Mitre).'
    };
  };

  const handleForceGps = () => {
    playChirp('click');
    setOriginMode('gps');
    onRequestCoords();
    try {
      localStorage.setItem(PREF_ORIGIN_STORAGE_KEY, JSON.stringify({ mode: 'gps' }));
    } catch {}
    window.dispatchEvent(
      new CustomEvent('vortex_origin_changed', {
        detail: { coords: coords || null, label: 'GPS en vivo', mode: 'gps' }
      })
    );
  };

  useEffect(() => {
    const handleVoiceState = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean; sourceId?: string | null }>).detail;
      if (!detail?.active) {
        setIsSpeaking(false);
        setCurrentlySpeakingId(null);
        setSpokenSubtitle('');
      } else if (detail.sourceId && detail.sourceId !== 'pharmacy_section_duty') {
        setIsSpeaking(false);
        setCurrentlySpeakingId(null);
        setSpokenSubtitle('');
      }
    };
    window.addEventListener('vortex_voice_state', handleVoiceState);
    return () => window.removeEventListener('vortex_voice_state', handleVoiceState);
  }, []);

  // Voice Assistant: announce all active duty pharmacies starting with the closest
  const handleSpeakDutyPharmacies = async () => {
    if (dutyPharmaciesWithDist.length === 0) return;

    if (isSpeaking && currentlySpeakingId === 'pharmacy_section_duty') {
      stopVoiceAssistant();
      setIsSpeaking(false);
      setCurrentlySpeakingId(null);
      setSpokenSubtitle('');
      return;
    }

    playChirp('click');
    const text = buildDutyPharmaciesSpeech(
      dutyPharmaciesWithDist.map((p) => ({ pharmacy: p, distKm: p.distKm })),
      currentOriginDescription
    );
    setSpokenSubtitle(text);
    setCurrentlySpeakingId('pharmacy_section_duty');
    setIsSpeaking(true);

    await speakNaturalSpanish(
      text,
      0.92,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setCurrentlySpeakingId(null);
        setSpokenSubtitle('');
      },
      () => {
        setIsSpeaking(false);
        setCurrentlySpeakingId(null);
        setSpokenSubtitle('');
      },
      'pharmacy_section_duty'
    );
  };

  const handleDayOffset = (offset: number) => {
    playChirp('click');
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  function isTodayRefDate(d: Date, currentPa: ReturnType<typeof getPuntaAltaTimeParts>): boolean {
    const dPa = getPuntaAltaTimeParts(d);
    return dPa.day === currentPa.day && dPa.month === currentPa.month && dPa.year === currentPa.year;
  }

  const isToday = useMemo(() => {
    return isTodayRefDate(selectedDate, paTime);
  }, [selectedDate, paTime]);

  return (
    <section id="farmacias" className="my-5 rounded-2xl bg-slate-50 dark:bg-[#050e24] border border-slate-300 dark:border-[#1e4594] p-4 sm:p-5 shadow-xl text-slate-900 dark:text-white space-y-4">
      
      {/* 1. Barra de Ubicación de Usuario */}
      <GpsRadarHud
        effectiveCoords={effectiveCoords}
        originMode={originMode}
        customLocationLabel={customLocationLabel}
        rawGpsCoords={coords}
        gpsStatus={gpsStatus}
        isGpsOutside={isGpsOutside}
        isUsingCenterFallback={isUsingCenterFallback}
        onSelectSpot={handleSelectSpot}
        onApplyManualAddress={handleApplyManualAddress}
        onForceGps={handleForceGps}
        onSelectDomicilio={() => {
          playChirp('click');
          setOriginMode('domicilio');
          try {
            localStorage.setItem(PREF_ORIGIN_STORAGE_KEY, JSON.stringify({ mode: 'domicilio' }));
          } catch {}
          window.dispatchEvent(
            new CustomEvent('vortex_origin_changed', {
              detail: {
                coords: domicileCoords || null,
                label: medicalRecord?.domicilio || 'Mi domicilio',
                mode: 'domicilio'
              }
            })
          );
        }}
        hasDomicilio={Boolean(medicalRecord?.domicilio && domicileCoords)}
        domicilioText={medicalRecord?.domicilio}
      />

      {/* 2. TARJETA DESTACADA PRINCIPAL: FARMACIA DE TURNO (GUARDIA 24 HS) MÁS CERCANA */}
      {closestDutyPharmacy ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 dark:from-[#06241a] via-teal-50/70 dark:via-[#082a20] to-slate-50 dark:to-[#061838] border-2 border-emerald-400 dark:border-emerald-400 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-black" />
                  <span>FARMACIA DE TURNO MÁS CERCANA</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                  GUARDIA 24 HS ABIERTA
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold font-mono">
                  {closestDutyPharmacy.distMeters != null
                    ? `${formatPharmacyDistanceBadge(closestDutyPharmacy.distMeters, { includeApprox: true })} de ${currentOriginDescription}`
                    : ''}
                </span>
              </div>

              <h3 className="text-2xl font-black font-heading text-slate-900 dark:text-white mt-1.5">
                {closestDutyPharmacy.name}
              </h3>

              <p className="text-sm text-slate-700 dark:text-[#c8e2ff] flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{closestDutyPharmacy.address}</span>
                {closestDutyPharmacy.notes && (
                  <span className="text-slate-700 dark:text-gray-300 text-xs hidden sm:inline">({closestDutyPharmacy.notes})</span>
                )}
              </p>
            </div>

            {/* Acciones directas para urgencias */}
            <div className="flex items-center gap-2 flex-wrap">
              {closestDutyPharmacy.phones[0] && (
                <button
                  type="button"
                  onClick={() => triggerDirectCall(closestDutyPharmacy.phones[0], closestDutyPharmacy.name, 'pharmacy')}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-gray-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg active:scale-95 transition"
                >
                  <Phone className="w-4 h-4 fill-current" />
                  <span>Llamar {closestDutyPharmacy.phones[0]}</span>
                </button>
              )}

              {closestDutyPharmacy.whatsapp && (
                <a
                  href={`https://wa.me/${formatWhatsAppNumber(closestDutyPharmacy.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-400 dark:border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              )}

              <a
                href={getDirectionsUrl({
                  name: closestDutyPharmacy.name,
                  address: closestDutyPharmacy.address,
                  lat: closestDutyPharmacy.lat,
                  lng: closestDutyPharmacy.lng
                }, effectiveCoords)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3.5 rounded-xl bg-sky-50 dark:bg-[#0a235c] hover:bg-sky-100 dark:hover:bg-[#12368a] border border-sky-400 dark:border-cyan-400 text-sky-800 dark:text-cyan-200 hover:text-slate-950 dark:hover:text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow"
              >
                <Navigation className="w-4 h-4" />
                <span>Cómo llegar</span>
              </a>

              <button
                type="button"
                onClick={handleSpeakDutyPharmacies}
                className={`py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow ${
                  isSpeaking && currentlySpeakingId === 'pharmacy_section_duty'
                    ? 'bg-red-600 hover:bg-red-500 text-white border border-red-300'
                    : 'bg-sky-50 dark:bg-[#09214f] hover:bg-sky-100 dark:hover:bg-[#12368a] border border-sky-400 dark:border-cyan-300 text-sky-800 dark:text-cyan-100'
                }`}
                aria-label={isSpeaking ? 'Detener voz de farmacias de turno' : 'Escuchar farmacias de turno por voz'}
              >
                {isSpeaking && currentlySpeakingId === 'pharmacy_section_duty' ? (
                  <VolumeX className="w-4 h-4 shrink-0" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-700 dark:text-cyan-300 shrink-0" />
                )}
                <span>{isSpeaking && currentlySpeakingId === 'pharmacy_section_duty' ? 'Detener voz' : 'Escuchar turno'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white dark:bg-[#071330] border border-amber-300 dark:border-amber-500/40 text-center text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle className="w-5 h-5 mx-auto mb-1.5 text-amber-700 dark:text-amber-400" />
          No se encontraron farmacias de turno registradas para esta fecha.
        </div>
      )}

      {/* 3. ENCABEZADO Y CONTROL DE TURNOS (REGLA 08:30 HS A 08:30 HS) */}
      <div className="pt-1">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#071330] border border-slate-300 dark:border-[#1e4594] space-y-3">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-base font-black text-slate-900 dark:text-white tracking-wide">
                  FARMACIAS DE TURNO · PUNTA ALTA
                </h4>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-sky-50 dark:bg-[#0c2356] text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-cyan-500/30">
                  🕒 Hora local: {dutyInfo.currentTimeInPuntaAlta}
                </span>
                {dutyInfo.isCustomOverride && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    Ajuste personalizado activo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9db6dd] mt-1">
                {dutyInfo.shiftLabel} <span className="text-sky-700 dark:text-cyan-300">({dutyInfo.activeWindow})</span>
              </p>
            </div>

            {/* Acciones públicas + Botón de voz + Ícono críptico exclusivo de administrador */}
            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              {dutyPharmaciesWithDist.length > 0 && (
                <button
                  type="button"
                  onClick={handleSpeakDutyPharmacies}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
                    isSpeaking && currentlySpeakingId === 'pharmacy_section_duty'
                      ? 'bg-red-600 hover:bg-red-500 border-red-300 text-white shadow'
                      : 'bg-sky-100 dark:bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/70 text-sky-800 dark:text-cyan-200 hover:text-white'
                  }`}
                >
                  {isSpeaking && currentlySpeakingId === 'pharmacy_section_duty' ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-300" />
                  )}
                  <span>
                    {isSpeaking && currentlySpeakingId === 'pharmacy_section_duty'
                      ? 'Detener voz'
                      : 'Escuchar farmacias de turno'}
                  </span>
                </button>
              )}

              <a
                href="https://www.elrosalenio.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white text-xs flex items-center gap-1 transition"
                title="Consultar diario local El Rosalenio"
              >
                <span>El Rosalenio</span>
                <ExternalLink className="w-3 h-3 text-sky-700 dark:text-cyan-400" />
              </a>

              {/* Ícono críptico especial (invisible en propósito para el usuario común) */}
              <button
                type="button"
                onClick={() => {
                  if (isAdminDutyUnlocked) {
                    setIsAdminDutyUnlocked(false);
                    setIsEditingDuty(false);
                    setShowAdminPinPrompt(false);
                  } else {
                    setShowAdminPinPrompt((prev) => !prev);
                    setAdminPinError('');
                    setAdminPinInput('');
                  }
                }}
                aria-label="Vtx"
                className={`p-1.5 rounded-lg transition-all duration-300 group relative ${
                  isAdminDutyUnlocked
                    ? 'bg-sky-100 dark:bg-cyan-500/20 border border-cyan-400/60 opacity-100 shadow-[0_0_12px_rgba(55,200,255,0.35)]'
                    : 'bg-transparent hover:bg-slate-200/70 dark:hover:bg-white/5 opacity-30 hover:opacity-80'
                }`}
              >
                <svg
                  viewBox="0 0 32 32"
                  className="w-5 h-5 transition-transform duration-700 group-hover:rotate-90"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Hexágono alquímico exterior */}
                  <polygon
                    points="16,2 28,9 28,23 16,30 4,23 4,9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    className={isAdminDutyUnlocked ? 'text-sky-700 dark:text-cyan-300' : 'text-slate-600 dark:text-[#5b7db8]'}
                  />
                  {/* Triángulos entrelazados (astrolabio Vortex) */}
                  <polygon
                    points="16,6 24.5,21 7.5,21"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-sky-700 dark:text-cyan-400/80"
                  />
                  <polygon
                    points="16,26 24.5,11 7.5,11"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-indigo-600 dark:text-indigo-400/70"
                  />
                  {/* Órbita e iris central */}
                  <circle
                    cx="16"
                    cy="16"
                    r="3.2"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    className={isAdminDutyUnlocked ? 'text-emerald-700 dark:text-emerald-300' : 'text-sky-700 dark:text-cyan-300'}
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="1.1"
                    fill="currentColor"
                    className={isAdminDutyUnlocked ? 'text-emerald-700 dark:text-emerald-400' : 'text-sky-800 dark:text-cyan-200'}
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Prompt discreto de clave PIN tras tocar el glifo críptico */}
          {showAdminPinPrompt && !isAdminDutyUnlocked && (
            <div className="pt-2 border-t border-sky-300 dark:border-cyan-500/20 space-y-2 animate-fade-in">
              {!showDutyRecovery ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDutyRecError('');
                      setShowDutyRecovery(true);
                    }}
                    className="text-[11px] text-sky-700 dark:text-cyan-300/80 hover:text-sky-800 dark:hover:text-cyan-200 underline underline-offset-2 flex items-center gap-1 mr-auto"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>¿Olvidaste tu clave?</span>
                  </button>
                  <div className="relative">
                    <input
                      type={showAdminPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="Clave..."
                      value={adminPinInput}
                      onChange={(e) => {
                        setAdminPinInput(e.target.value);
                        setAdminPinError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleVerifyAdminGlyphPin();
                        }
                      }}
                      className="w-36 py-1 pl-2.5 pr-7 rounded-lg bg-slate-50 dark:bg-[#040a1b] border border-sky-300 dark:border-cyan-500/40 text-xs text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPin((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sky-700 dark:text-cyan-300/80 hover:text-slate-950 dark:hover:text-white p-0.5"
                      aria-label={showAdminPin ? 'Ocultar clave' : 'Ver clave'}
                    >
                      {showAdminPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyAdminGlyphPin}
                    className="py-1 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminPinPrompt(false)}
                    className="py-1 px-2 rounded-lg text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white text-xs"
                  >
                    ✕
                  </button>
                  {adminPinError && (
                    <span className="text-[11px] text-red-700 dark:text-red-400 font-semibold w-full text-right">
                      {adminPinError}
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#040a1b] border border-sky-300 dark:border-cyan-500/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sky-700 dark:text-cyan-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Recuperar clave única de Admin</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDutyRecovery(false)}
                      className="text-[11px] text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white"
                    >
                      Volver
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isAdmin ? (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Google Admin ({user?.email})</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => signInWithGoogle()}
                        className="px-2.5 py-1 rounded-lg bg-white text-gray-950 font-bold text-[11px] hover:bg-gray-200 transition"
                      >
                        Verificar con Google Admin
                      </button>
                    )}
                    <input
                      type="text"
                      value={dutyRecIdentity}
                      onChange={(e) => setDutyRecIdentity(e.target.value)}
                      placeholder="O correo / WhatsApp"
                      className="flex-1 min-w-[140px] py-1 px-2 rounded-lg bg-white dark:bg-[#081333] border border-sky-300 dark:border-cyan-500/40 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[150px]">
                      <input
                        type={showDutyRecPin ? 'text' : 'password'}
                        maxLength={8}
                        value={dutyRecNewPin}
                        onChange={(e) => setDutyRecNewPin(e.target.value)}
                        placeholder="Nueva clave (vacío = 1234)"
                        className="w-full py-1 pl-2.5 pr-7 rounded-lg bg-white dark:bg-[#081333] border border-sky-300 dark:border-cyan-500/40 text-xs text-slate-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDutyRecPin((p) => !p)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sky-700 dark:text-cyan-300/80 hover:text-slate-950 dark:hover:text-white"
                        aria-label={showDutyRecPin ? 'Ocultar nueva clave' : 'Ver nueva clave'}
                      >
                        {showDutyRecPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={dutyRecBusy}
                      onClick={handleRecoverDutyAdminPin}
                      className="py-1 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {dutyRecBusy ? 'Verificando…' : 'Restablecer y Entrar'}
                    </button>
                  </div>
                  {dutyRecError && (
                    <p className="text-[11px] text-red-700 dark:text-red-400 font-semibold">{dutyRecError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Barra oculta de gestión exclusiva de administrador */}
          {isAdminDutyUnlocked && (
            <div className="pt-2 border-t border-sky-300 dark:border-cyan-400/30 flex items-center justify-between gap-2 flex-wrap animate-fade-in">
              <span className="text-[11px] font-mono text-sky-700 dark:text-cyan-300 uppercase tracking-wider">
                Gestión de Turnos (Admin)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    setIsImporterOpen(true);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 border border-cyan-400 text-white text-xs font-black flex items-center gap-1.5 active:scale-95 transition shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-800 dark:text-cyan-200" />
                  <span>📥 Cargar Turnos Colegio</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDutyEditor}
                  className="py-1.5 px-3 rounded-lg bg-sky-50 dark:bg-[#0c2356] hover:bg-sky-100 dark:hover:bg-[#143b91] border border-sky-300 dark:border-cyan-400/80 text-sky-800 dark:text-cyan-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shadow"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>¿Cambió la guardia? Corregir</span>
                </button>
              </div>
            </div>
          )}

          {/* Selector de Guardia Activa vs Próximo Turno & Fechas */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            
            {/* Toggles de Turno Activo / Próximo Turno */}
            <div className="inline-flex rounded-lg bg-slate-50 dark:bg-[#040a1b] p-0.5 border border-slate-300 dark:border-[#1e4594]">
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  setShiftPreference('active_now');
                }}
                className={`py-1 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                  shiftPreference === 'active_now'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Guardia Activa Ahora</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  setShiftPreference('next_shift');
                }}
                className={`py-1 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
                  shiftPreference === 'next_shift'
                    ? 'bg-[#1e5bff] text-white shadow'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>Próximo Turno (desde 08:30 hs)</span>
              </button>
            </div>

            {/* Navegación por día */}
            <div className="flex items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleDayOffset(-1)}
                className="px-2.5 py-1 text-xs rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-[#9db6dd] transition"
              >
                Ayer
              </button>
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  setSelectedDate(new Date());
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  isToday ? 'bg-[#1e5bff] text-white shadow' : 'text-slate-600 dark:text-[#9db6dd] hover:bg-slate-200/70 dark:hover:bg-white/10'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleDayOffset(1)}
                className="px-2.5 py-1 text-xs rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-[#9db6dd] transition"
              >
                Mañana
              </button>
            </div>
          </div>
        </div>

        {/* MODAL / PANEL DE EDICIÓN RÁPIDA DE GUARDIA */}
        {isEditingDuty && (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-[#030919] border-2 border-sky-400 dark:border-cyan-400 shadow-2xl space-y-3 animate-fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-sky-700 dark:text-cyan-400" />
                  <span>Ajustar Farmacias de Guardia para el {dutyInfo.dateKey}</span>
                </h5>
                <p className="text-xs text-slate-600 dark:text-gray-400">
                  Seleccioná las farmacias de guardia confirmadas hoy por el Colegio de Farmacéuticos:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingDuty(false)}
                className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Buscador de farmacias en el editor */}
            <input
              type="text"
              placeholder="Filtrar por nombre o calle (ej: Garcia, Maciel, Argentina, Espora)..."
              value={editSearch}
              onChange={(e) => setEditSearch(e.target.value)}
              className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-[#071330] border border-slate-300 dark:border-[#1e4594] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-xs focus:outline-none"
            />

            {/* Lista seleccionable de las 20 farmacias */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-200 dark:divide-white/5">
              {PUNTA_ALTA_PHARMACIES.filter(
                (p) =>
                  !editSearch ||
                  p.name.toLowerCase().includes(editSearch.toLowerCase()) ||
                  p.address.toLowerCase().includes(editSearch.toLowerCase())
              ).map((p) => {
                const isSelected = editingSelectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleToggleDutyPharmacy(p.id)}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-400 text-slate-900 dark:text-white'
                        : 'hover:bg-slate-200/70 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{p.name}</span>
                      <span className="text-slate-600 dark:text-gray-400 ml-2">({p.address})</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-emerald-500 text-black font-black' : 'border border-slate-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {dutyEditError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/70 border border-red-400 dark:border-red-500 text-red-800 dark:text-red-200 text-xs font-semibold">
                {dutyEditError}
              </div>
            )}

            {/* Botones de acción del editor */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10 flex-wrap">
              <button
                type="button"
                onClick={handleResetDutyOfficial}
                className="py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 text-xs flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer oficial</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingDuty(false)}
                  className="py-1.5 px-3 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDutyCustom}
                  className="py-1.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar guardia ({editingSelectedIds.length} farmacias)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE OTRAS FARMACIAS DE GUARDIA HOY (sin duplicar la más cercana ya destacada arriba) */}
        {dutyPharmaciesWithDist.length > 1 && (
          <div className="mt-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-300/90 px-1">
              Otras farmacias también de turno hoy ({dutyPharmaciesWithDist.length - 1}):
            </p>
            {dutyPharmaciesWithDist.slice(1).map((pharmacy) => {
              const dirUrl = getDirectionsUrl(
                {
                  name: pharmacy.name,
                  address: pharmacy.address,
                  lat: pharmacy.lat,
                  lng: pharmacy.lng
                },
                effectiveCoords
              );
              const mapUrl = getMapSearchUrl(pharmacy.address, pharmacy.name);
              const waNumber = pharmacy.whatsapp ? formatWhatsAppNumber(pharmacy.whatsapp) : '';

              return (
                <div
                  key={pharmacy.id}
                  className="p-3.5 sm:p-4 rounded-xl transition bg-white dark:bg-[#071330] border border-slate-300 dark:border-[#1e4594] hover:border-sky-500 dark:hover:border-cyan-400/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-black text-slate-900 dark:text-white">
                          {pharmacy.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-cyan-950 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-cyan-500/40 uppercase">
                          De guardia 24 hs
                        </span>
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold font-mono">
                          {formatPharmacyDistanceBadge(pharmacy.distMeters)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-sky-800 dark:text-[#b8d6ff]">
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-sky-800 dark:hover:text-cyan-300 underline decoration-dotted inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400" />
                          <span>{pharmacy.address}</span>
                        </a>
                        {pharmacy.notes && (
                          <span className="text-slate-600 dark:text-gray-400 hidden sm:inline">· {pharmacy.notes}</span>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción directos */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {pharmacy.phones.map((phone, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => triggerDirectCall(phone, pharmacy.name, 'pharmacy')}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{phone}</span>
                        </button>
                      ))}

                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <a
                        href={dirUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 rounded-lg bg-sky-50 dark:bg-[#0a235c] hover:bg-sky-100 dark:hover:bg-[#12368a] border border-sky-300 dark:border-cyan-400/80 text-sky-800 dark:text-cyan-200 hover:text-slate-950 dark:hover:text-white text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Cómo llegar</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. ASISTENTE DE VOZ ACCESIBLE */}
      <div className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-[#071330] border border-slate-300 dark:border-[#1e4594] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
          <Volume2 className="w-4 h-4 text-sky-700 dark:text-cyan-400 shrink-0" />
          <span>Voz accesible:</span>
          {isSpeaking && spokenSubtitle && (
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate max-w-xs sm:max-w-md">
              "{spokenSubtitle}"
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSpeakDutyPharmacies}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto ${
            isSpeaking && currentlySpeakingId === 'pharmacy_section_duty'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-sky-50 dark:bg-[#0a235c] hover:bg-sky-100 dark:hover:bg-[#12368a] border border-sky-400 dark:border-cyan-400 text-sky-800 dark:text-cyan-200'
          }`}
        >
          {isSpeaking && currentlySpeakingId === 'pharmacy_section_duty' ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
          <span>
            {isSpeaking && currentlySpeakingId === 'pharmacy_section_duty'
              ? 'Detener voz'
              : 'Escuchar todas las farmacias de turno'}
          </span>
        </button>
      </div>

      {/* 5. ACORDEÓN: GUÍA COMPLETA DE TODAS LAS 20 FARMACIAS (HORARIO COMERCIAL) */}
      <div className="pt-2 border-t border-slate-300 dark:border-[#1e4594]/40">
        <button
          type="button"
          onClick={() => setShowAllList(!showAllList)}
          className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white dark:bg-[#071330] hover:bg-sky-100 dark:hover:bg-[#0c1f4a] border border-slate-200 dark:border-white/10 text-xs transition"
        >
          <span className="font-bold text-slate-700 dark:text-gray-300 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400" />
            <span>Guía de las 20 farmacias de Punta Alta por cercanía (horario comercial diurno)</span>
          </span>
          <span className="text-sky-700 dark:text-[#37c8ff] font-semibold">
            {showAllList ? 'Ocultar' : 'Ver lista completa'}
          </span>
        </button>

        {showAllList && (
          <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#030919] border border-slate-300 dark:border-[#1e4594] space-y-2 text-xs animate-fade-in">
            <p className="text-[11px] text-slate-600 dark:text-gray-400">
              * Nota: Durante la noche y madrugadas sólo atienden las de turno arriba indicadas. En horario de comercio habitual (08:30 a 12:30 y 16:30 a 20:30 hs) atienden todas.
            </p>
            <input
              type="text"
              placeholder="Buscar por nombre o calle (ej: Garcia, Argentina, Brown, Mitre)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-[#071330] border border-slate-300 dark:border-[#1e4594] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-xs focus:outline-none"
            />
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-200 dark:divide-white/5">
              {filteredAllPharmacies.map((p) => (
                <div key={p.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white mr-2">{p.name}</span>
                    <span className="text-slate-600 dark:text-gray-400">{p.address}</span>
                    {p.distMeters != null && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold ml-2">
                        · {formatPharmacyDistanceBadge(p.distMeters)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.phones[0] && (
                      <button
                        type="button"
                        onClick={() => triggerDirectCall(p.phones[0], p.name, 'pharmacy')}
                        className="py-1 px-2 rounded bg-emerald-100 dark:bg-emerald-600/80 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                      >
                        Llamar
                      </button>
                    )}
                    <a
                      href={getDirectionsUrl({ name: p.name, address: p.address, lat: p.lat, lng: p.lng }, effectiveCoords)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 rounded bg-sky-50 dark:bg-[#0a235c] hover:bg-sky-100 dark:hover:bg-[#12368a] text-sky-800 dark:text-cyan-200 text-[11px]"
                    >
                      Ir
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE IMPORTACIÓN DEL COLEGIO DE FARMACÉUTICOS */}
      <ColegioDutyImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={() => setDutyVersion((v) => v + 1)}
        adminPin={verifiedAdminPin}
      />
    </section>
  );
};
