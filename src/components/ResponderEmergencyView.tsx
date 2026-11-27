import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertOctagon,
  Heart,
  Phone,
  Send,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Pill,
  Stethoscope,
  Building2,
  Ambulance,
  Compass,
  ArrowRight,
  Volume2,
  VolumeX,
  Navigation,
  Star,
  LocateFixed,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Printer,
  CheckCircle2,
  Smartphone,
  Baby,
  Shield,
  BadgeCheck,
  Award
} from 'lucide-react';
import {
  MedicalRecord,
  buildSosMessage,
  buildMedicalReportSummary,
  calculatePregnancyProgress
} from '../utils/medicalData';
import {
  Coordinates,
  sortByHaversineDistance,
  getDirectionsUrl,
  getMapSearchUrl,
  getNearbyMapSearchUrl,
  estimateCoordsFromPuntaAltaAddress,
  describePuntaAltaLocation,
  isWithinPuntaAltaArea,
  isVerifiedEmergencyCoords,
  getCoordsFreshnessInfo,
  fetchGeocodedLocation,
  POPULAR_PUNTA_ALTA_SPOTS,
  DEFAULT_PUNTA_ALTA_COORDS
} from '../utils/geo';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from '../utils/callHandler';
import { PUNTA_ALTA_PHARMACIES, getDutyPharmaciesForDate, syncDutyScheduleFromServer } from '../data/puntaAltaData';
import { ClinicalHistorySection } from './ClinicalHistorySection';
import { DonorAndBloodStatusCard, getMedicalValidationStatus } from './BloodAndDonorFields';
import {
  speakNaturalSpanish,
  stopVoiceAssistant,
  buildRescuerPharmacySpeech,
  buildCriticalTriageSpeech,
  buildMedicalTriageSpeech
} from '../utils/voiceAssistant';

interface ResponderEmergencyViewProps {
  record: MedicalRecord;
  coords: Coordinates | null;
  emergencyCoords?: Coordinates | null;
  ipFallback?: Coordinates | null;
  onRequestCoords: () => void;
  gpsStatus: string;
  onOpenPortal: () => void;
  onOpenInstallGuide?: () => void;
}

export const ResponderEmergencyView: React.FC<ResponderEmergencyViewProps> = ({
  record,
  coords,
  emergencyCoords,
  ipFallback,
  onRequestCoords,
  gpsStatus,
  onOpenPortal,
  onOpenInstallGuide
}) => {
  const [originMode, setOriginMode] = useState<'gps' | 'manual' | 'domicilio' | 'centro'>('gps');
  const [customCoords, setCustomCoords] = useState<Coordinates | null>(null);
  const [customLabel, setCustomLabel] = useState<string>('');
  const [showSpotSelector, setShowSpotSelector] = useState<boolean>(false);
  const [showTopCornerPicker, setShowTopCornerPicker] = useState<boolean>(false);
  const [streetCornerInput, setStreetCornerInput] = useState<string>('');
  const [streetCornerError, setStreetCornerError] = useState<string>('');
  const [isResolvingCorner, setIsResolvingCorner] = useState<boolean>(false);
  const [showAllDuty, setShowAllDuty] = useState<boolean>(false);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<string>('');
  const [manualCopyReport, setManualCopyReport] = useState<string | null>(null);
  const [dutyClockTick, setDutyClockTick] = useState<number>(0);

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [spokenSubtitle, setSpokenSubtitle] = useState<string>('');
  const [speakingType, setSpeakingType] = useState<'critical' | 'full' | 'pharmacy' | null>(null);
  const [isPhotoZoomOpen, setIsPhotoZoomOpen] = useState<boolean>(false);
  const [photoRenderError, setPhotoRenderError] = useState<boolean>(false);

  useEffect(() => {
    onRequestCoords();
    syncDutyScheduleFromServer().then(() => {
      setDutyClockTick((t) => t + 1);
    });
    const onDutyUpdated = () => setDutyClockTick((t) => t + 1);
    window.addEventListener('vortex_duty_updated', onDutyUpdated);
    const interval = setInterval(() => {
      setDutyClockTick((t) => t + 1);
    }, 60000);

    return () => {
      stopVoiceAssistant();
      window.removeEventListener('vortex_duty_updated', onDutyUpdated);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    stopVoiceAssistant();
    setIsSpeaking(false);
    setSpokenSubtitle('');
    setSpeakingType(null);
  }, [originMode, customCoords]);

  const domicileCoords = useMemo(() => {
    return estimateCoordsFromPuntaAltaAddress(record.domicilio);
  }, [record.domicilio]);

  const isGpsInPuntaAlta = useMemo(() => {
    return coords ? isWithinPuntaAltaArea(coords) : false;
  }, [coords]);

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
    if (customCoords) return customCoords;
    return DEFAULT_PUNTA_ALTA_COORDS;
  }, [originMode, customCoords, domicileCoords, coords]);

  const originDescription = useMemo((): string => {
    if (originMode === 'manual' && customLabel) {
      return customLabel;
    }
    if (originMode === 'domicilio' && record.domicilio) {
      return `Domicilio de ${record.nombre ? record.nombre.split(' ')[0] : 'titular'} (${record.domicilio.split(',')[0]})`;
    }
    if (originMode === 'centro') {
      return 'Plaza Belgrano (Centro)';
    }
    if (coords && isGpsInPuntaAlta) {
      const zone = describePuntaAltaLocation(coords);
      return zone && zone !== 'Punta Alta' ? `Tu GPS (${zone})` : 'Tu ubicación GPS en tiempo real';
    }
    if (coords && isVerifiedEmergencyCoords(coords)) {
      return `Tu GPS (${describePuntaAltaLocation(coords)})`;
    }
    return 'Plaza Belgrano (referencia sin GPS activo)';
  }, [originMode, customLabel, record.domicilio, record.nombre, coords, isGpsInPuntaAlta]);

  const dutyInfo = useMemo(() => {
    return getDutyPharmaciesForDate(new Date());
  }, [dutyClockTick]);

  const dutyPharmaciesWithDist = useMemo(() => {
    const rawDuty = PUNTA_ALTA_PHARMACIES.filter((p) => dutyInfo.pharmacyIds.includes(p.id));
    return sortByHaversineDistance(rawDuty, effectiveCoords);
  }, [dutyInfo.pharmacyIds, effectiveCoords]);

  const closestDuty = dutyPharmaciesWithDist[0];
  const otherDuty = dutyPharmaciesWithDist.slice(1);

  const reportSosCoords = useMemo((): Coordinates | null => {
    if (originMode === 'manual' && customCoords) {
      return { ...customCoords, source: 'manual', label: customLabel || 'Esquina confirmada por socorrista' };
    }
    if (originMode === 'domicilio' && domicileCoords) {
      return { ...domicileCoords, source: 'manual', label: `Domicilio (${record.domicilio || 'titular'})` };
    }
    if (isVerifiedEmergencyCoords(emergencyCoords)) {
      return emergencyCoords;
    }
    if (isVerifiedEmergencyCoords(coords) && (coords.source === 'gps' || coords.source === 'network')) {
      return coords;
    }
    return null;
  }, [originMode, customCoords, customLabel, domicileCoords, record.domicilio, emergencyCoords, coords]);

  const sosFreshness = reportSosCoords ? getCoordsFreshnessInfo(reportSosCoords) : null;

  const isTravelerOutsidePuntaAlta = Boolean(
    originMode === 'gps' && isVerifiedEmergencyCoords(coords) && !isGpsInPuntaAlta
  );

  const handleApplyStreetCorner = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = streetCornerInput.trim();
    if (!query) return;
    setStreetCornerError('');
    setIsResolvingCorner(true);
    try {
      const res = await fetchGeocodedLocation(query);
      if (res) {
        playChirp('success');
        setCustomCoords({ ...res.coords, source: 'manual', label: res.label });
        setCustomLabel(res.label);
        setOriginMode('manual');
        setShowSpotSelector(false);
        setShowTopCornerPicker(false);
        setStreetCornerInput('');
      } else {
        setStreetCornerError('No encontramos esa calle en Punta Alta (probá ej: "Brown 850" o "Paso y Mitre").');
      }
    } finally {
      setIsResolvingCorner(false);
    }
  };

  const handleCopyReport = async () => {
    playChirp('click');
    const summary = buildMedicalReportSummary(record, reportSosCoords);
    try {
      await navigator.clipboard.writeText(summary);
      setIsCopied(true);
      playChirp('success');
      setCopyToast('¡Ficha médica copiada! Lista para pegar en guardia o WhatsApp.');
      setTimeout(() => {
        setIsCopied(false);
        setCopyToast('');
      }, 4000);
    } catch {
      setManualCopyReport(summary);
    }
  };

  const handleSendWhatsAppTo = (phone?: string) => {
    const wa = phone ? formatWhatsAppNumber(phone) : '';
    const message = buildSosMessage(record, reportSosCoords, ipFallback);
    const url = wa
      ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSpeakMedicalTriage = async (mode: 'critical' | 'full' = 'critical') => {
    if (isSpeaking && speakingType === mode) {
      stopVoiceAssistant();
      setIsSpeaking(false);
      setSpokenSubtitle('');
      setSpeakingType(null);
      return;
    }

    playChirp('click');
    const text =
      mode === 'full' ? buildMedicalTriageSpeech(record) : buildCriticalTriageSpeech(record);
    setSpokenSubtitle(text);
    setIsSpeaking(true);
    setSpeakingType(mode);

    await speakNaturalSpanish(
      text,
      0.92,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setSpokenSubtitle('');
        setSpeakingType(null);
      },
      () => {
        setIsSpeaking(false);
        setSpokenSubtitle('');
        setSpeakingType(null);
      }
    );
  };

  const handleSpeakClosestPharmacy = async () => {
    if (!closestDuty) return;

    if (isSpeaking && speakingType === 'pharmacy') {
      stopVoiceAssistant();
      setIsSpeaking(false);
      setSpokenSubtitle('');
      setSpeakingType(null);
      return;
    }

    playChirp('click');
    const text = buildRescuerPharmacySpeech(
      closestDuty,
      closestDuty.distMeters,
      originDescription
    );

    setSpokenSubtitle(text);
    setIsSpeaking(true);
    setSpeakingType('pharmacy');

    await speakNaturalSpanish(
      text,
      0.92,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setSpokenSubtitle('');
        setSpeakingType(null);
      },
      () => {
        setIsSpeaking(false);
        setSpokenSubtitle('');
        setSpeakingType(null);
      }
    );
  };

  const handleSelectSpot = (spot: (typeof POPULAR_PUNTA_ALTA_SPOTS)[0]) => {
    playChirp('click');
    setCustomCoords(spot.coords);
    setCustomLabel(spot.label);
    setOriginMode('manual');
    setShowSpotSelector(false);
  };

  const handleResetGps = () => {
    playChirp('click');
    setOriginMode('gps');
    onRequestCoords();
    setShowSpotSelector(false);
  };

  const handlePrint = () => {
    playChirp('click');
    window.print();
  };

  const primaryContactPhone = record.cfam || record.tel || record.cami;
  const primaryContactLabel = record.cfam
    ? 'Familiar directo'
    : record.tel
    ? 'Contacto principal'
    : 'Allegado';

  const pregnancy = calculatePregnancyProgress(record);

  return (
    <div id="responder-clinical-report" className="space-y-3.5 animate-fade-in pb-16">
      {/* 1. HERO IDENTITY + BLOOD TYPE UNIFIED ABOVE THE FOLD */}
      <section
        aria-label="Identidad y grupo sanguíneo de emergencia"
        className="relative rounded-2xl bg-gradient-to-b from-[#d1192c] via-[#a91020] to-[#7c0a16] text-white shadow-2xl shadow-red-950/80 border border-red-300/80 overflow-hidden"
      >
        <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-white/85" />
        <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-white/85" />

        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Status Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-2">
            <span className="text-[11px] font-mono uppercase font-bold tracking-[0.14em] text-yellow-200">
              {isTravelerOutsidePuntaAlta
                ? 'AUXILIO EN VIAJE · FICHA MÉDICA'
                : 'PRIORIDAD 01 · ASISTENCIA MÉDICA'}
            </span>
            {record.keychainId && (
              <span className="px-2 py-0.5 rounded-md bg-black/50 text-yellow-300 font-mono tabular-nums text-[11px] font-bold border border-yellow-300/50">
                LLAVERO #{record.keychainId}
              </span>
            )}
          </div>

          {/* Photo + Identity */}
          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (record.foto && !photoRenderError) {
                    setIsPhotoZoomOpen(true);
                  }
                }}
                className={`w-28 h-28 sm:w-32 sm:h-32 min-w-[112px] min-h-[112px] sm:min-w-[128px] sm:min-h-[128px] rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-black/40 flex items-center justify-center shrink-0 ${
                  record.foto && !photoRenderError ? 'cursor-zoom-in hover:scale-[1.03] transition' : 'cursor-default'
                }`}
                title={record.foto && !photoRenderError ? 'Tocar para ampliar rostro' : 'Sin fotografía'}
              >
                {record.foto && !photoRenderError ? (
                  <img
                    src={record.foto}
                    alt={record.nombre || 'Persona asistida'}
                    className="w-full h-full object-cover block"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onError={() => setPhotoRenderError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/80">
                    <AlertOctagon className="w-9 h-9 text-white/90" />
                    <span className="text-[10px] font-bold uppercase mt-1">Sin foto</span>
                  </div>
                )}
              </button>
              {record.foto && !photoRenderError && (
                <span className="absolute -bottom-1.5 -right-1 px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-0.5 shadow border border-black/30 pointer-events-none">
                  <ShieldCheck className="w-3 h-3" />
                  ID OK
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-yellow-200 block">
                Estás asistiendo a:
              </span>
              <h1 className="text-2xl sm:text-3xl font-black font-heading text-white leading-tight mt-0.5 break-words">
                {record.nombre || 'Persona sin nombre registrado'}
              </h1>
              <p className="text-[11px] text-white/90 font-medium leading-snug mt-0.5">
                Tocá la foto para ampliar y corroborar el rostro.
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2 text-xs text-white">
                {record.dni && (
                  <span className="font-mono tabular-nums font-bold bg-black/35 px-2 py-0.5 rounded border border-white/25">
                    DNI {record.dni}
                  </span>
                )}
                {record.sexo && (
                  <span className="font-semibold px-2 py-0.5 rounded bg-black/35 border border-white/25 text-yellow-100">
                    {record.sexo}
                  </span>
                )}
                {(() => {
                  const v = getMedicalValidationStatus(record);
                  if (v.isDonorValidated) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/90 border border-amber-300/80 text-amber-200 font-black uppercase text-[10px] tracking-wider shadow">
                        <Award className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>Donante INCUCAI ✓</span>
                      </span>
                    );
                  }
                  if (v.donorState === 'si') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/85 border border-emerald-400/70 text-emerald-200 font-bold uppercase text-[10px] tracking-wider">
                        <span>💚 Donante Declarado</span>
                      </span>
                    );
                  }
                  return null;
                })()}
                {record.domicilio && (
                  <span className="font-medium flex items-center gap-1 text-white/95 truncate max-w-full">
                    <MapPin className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                    <span className="truncate">{record.domicilio}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {isTravelerOutsidePuntaAlta && coords && (
            <div className="pt-2 border-t border-white/20 flex items-center gap-1.5 text-xs text-yellow-100 font-semibold">
              <Compass className="w-4 h-4 text-cyan-200 shrink-0" />
              <span>
                En viaje fuera de Punta Alta ({describePuntaAltaLocation(coords)}) · Ficha y contactos 100% activos.
              </span>
            </div>
          )}
        </div>

        {/* Prominent 1-Tap Voice Triage Trigger right below Photo & Identity, above Blood Factor */}
        <div className="print:hidden px-3.5 sm:px-4 pb-3">
          <button
            type="button"
            onClick={() => handleSpeakMedicalTriage('critical')}
            aria-label={
              isSpeaking && speakingType === 'critical'
                ? 'Detener lectura de alerta médica'
                : 'Escuchar alerta médica crítica de 10 segundos'
            }
            className={`w-full min-h-[48px] py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between gap-3 transition active:scale-[0.99] shadow-lg border ${
              isSpeaking && speakingType === 'critical'
                ? 'bg-[#040917] border-yellow-300 text-yellow-200'
                : 'bg-[#060f23]/95 hover:bg-[#0a1a3a] border-cyan-300/80 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 text-left">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  isSpeaking && speakingType === 'critical'
                    ? 'bg-red-600/30 border-red-400 text-red-200'
                    : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                }`}
              >
                {isSpeaking && speakingType === 'critical' ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-heading font-black uppercase tracking-wider leading-tight truncate">
                  {isSpeaking && speakingType === 'critical'
                    ? 'Detener Voz · Silenciar'
                    : 'Escuchar Alerta Médica (10s)'}
                </span>
                <span className="block text-[11px] text-cyan-200/90 font-medium truncate">
                  {isSpeaking && speakingType === 'critical'
                    ? 'Reproduciendo datos críticos...'
                    : 'Nombre · Factor sanguíneo · Alergias · Medicación'}
                </span>
              </div>
            </div>
            <span className="px-2 py-1 rounded-md bg-cyan-400/15 border border-cyan-400/40 text-[10px] font-mono font-bold uppercase text-cyan-200 shrink-0">
              {isSpeaking && speakingType === 'critical' ? 'Activo' : 'Voz 1 Toque'}
            </span>
          </button>
        </div>

        {/* Integrated Critical Blood Type Bar inside Hero */}
        {record.sangre && (() => {
          const v = getMedicalValidationStatus(record);
          return (
            <div className="px-3.5 py-2.5 sm:px-4 bg-black/45 border-t border-white/25 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    v.isBloodValidated
                      ? 'bg-emerald-500/25 border-emerald-300/80 shadow-md shadow-emerald-950'
                      : 'bg-white/15 border-white/30'
                  }`}
                >
                  {v.isBloodValidated ? (
                    <BadgeCheck className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <Heart className="w-5 h-5 text-white fill-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono uppercase font-black tracking-wider text-red-100 block">
                      Grupo Sanguíneo y Factor
                    </span>
                    {v.hasBloodCert ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-amber-300/80 text-[9px] font-mono font-black uppercase text-amber-100 inline-flex items-center gap-1 shadow">
                        <BadgeCheck className="w-3 h-3 text-emerald-300" />
                        <span>VALIDADO · CONSTANCIA</span>
                      </span>
                    ) : v.hasBloodLab ? (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-300/70 text-[9px] font-mono font-black uppercase text-cyan-100 inline-flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3 text-cyan-300" />
                        <span>VALIDADO POR LAB.</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-white/15 border border-white/25 text-[9px] font-mono font-bold uppercase text-white/90">
                        Declarado
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/85 block truncate">
                    {record.sangreLaboratorio
                      ? `Validado: ${record.sangreLaboratorio}`
                      : 'Dato crítico para guardia y transfusión'}
                  </span>
                </div>
              </div>
              <div className="relative shrink-0">
                <div
                  className={`px-4 py-1.5 rounded-xl bg-white text-red-700 font-black font-heading text-2xl sm:text-3xl shadow-lg tracking-wider border-2 ${
                    v.isBloodValidated
                      ? 'border-amber-300 ring-2 ring-emerald-400/80'
                      : 'border-red-200'
                  }`}
                >
                  {record.sangre}
                </div>
                {v.isBloodValidated && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-emerald-600 border border-amber-300 text-[8px] font-mono font-black uppercase text-white tracking-wider shadow whitespace-nowrap">
                    ✓ VALIDADO
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* Subtítulos de Asistente de Voz en Vivo (visible al instante debajo de la tarjeta principal) */}
      {isSpeaking && spokenSubtitle && (
        <div className="p-3.5 rounded-2xl bg-[#040917] border border-cyan-400 text-xs text-white space-y-1.5 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 font-bold border-b border-cyan-500/30 pb-1.5">
            <span>
              {speakingType === 'critical'
                ? 'Voz Triage Crítico (10 seg)'
                : speakingType === 'full'
                ? 'Lectura Ficha Completa'
                : 'Asistente de voz de auxilio'}
            </span>
            <button
              type="button"
              onClick={() => {
                stopVoiceAssistant();
                setIsSpeaking(false);
                setSpokenSubtitle('');
                setSpeakingType(null);
              }}
              className="text-red-400 hover:text-red-300 underline font-bold uppercase text-[10px]"
            >
              Silenciar
            </button>
          </div>
          <p className="text-sm font-medium leading-relaxed text-[#eaf3ff]">{spokenSubtitle}</p>
        </div>
      )}

      {/* 2. UNIFIED IMMEDIATE TRIAGE ACTION DECK (Familiar + WhatsApp GPS + 107 SAME + 911 Policía) */}
      <section
        aria-label="Acciones de auxilio inmediato"
        className="print:hidden relative rounded-2xl bg-[#060d20] border border-emerald-500/60 shadow-xl p-3.5 sm:p-4 space-y-3"
      >
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400/80 rounded-tl-sm" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400/80 rounded-br-sm" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-black font-heading uppercase text-white tracking-wider">
              Auxilio Inmediato · 1 Toque
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
            Despacho Rápido
          </span>
        </div>

        {/* 2x2 Tactical Dispatch Matrix */}
        <div className="grid grid-cols-2 gap-2.5">
          {primaryContactPhone ? (
            <>
              <button
                type="button"
                onClick={() => triggerDirectCall(primaryContactPhone, `Llamar a ${primaryContactLabel} de ${record.nombre}`)}
                className="min-h-[54px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="truncate">Llamar {primaryContactLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsAppTo(primaryContactPhone)}
                className="min-h-[54px] py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-gray-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
              >
                <Send className="w-4 h-4 shrink-0 text-gray-950" />
                <span className="truncate">WhatsApp + GPS</span>
              </button>
            </>
          ) : (
            <div className="col-span-2 p-2.5 rounded-xl bg-[#08132c] border border-[#1a3366] text-xs text-[#9db6dd] text-center font-semibold">
              Sin familiar cargado en la ficha. Activá 107 SAME o 911 Policía abajo:
            </div>
          )}

          {/* Direct 107 SAME */}
          <button
            type="button"
            onClick={() => triggerDirectCall('107', '107 · SAME Ambulancia', 'emergency')}
            className="min-h-[54px] px-3 py-2 rounded-xl bg-[#051a14] hover:bg-[#082820] border border-emerald-400/70 text-left flex items-center justify-between gap-2 active:scale-95 transition"
          >
            <div className="min-w-0">
              <span className="block font-mono tabular-nums text-lg sm:text-xl font-bold text-emerald-400 leading-none">
                107
              </span>
              <span className="block text-[11px] font-heading font-bold uppercase tracking-wider text-emerald-100 mt-0.5 truncate">
                SAME Ambulancia
              </span>
            </div>
            <Ambulance className="w-5 h-5 text-emerald-300 shrink-0" />
          </button>

          {/* Direct 911 Policía */}
          <button
            type="button"
            onClick={() => triggerDirectCall('911', '911 · Policía y Emergencias', 'emergency')}
            className="min-h-[54px] px-3 py-2 rounded-xl bg-[#1a070f] hover:bg-[#270b17] border border-rose-400/70 text-left flex items-center justify-between gap-2 active:scale-95 transition"
          >
            <div className="min-w-0">
              <span className="block font-mono tabular-nums text-lg sm:text-xl font-bold text-rose-400 leading-none">
                911
              </span>
              <span className="block text-[11px] font-heading font-bold uppercase tracking-wider text-rose-100 mt-0.5 truncate">
                Policía
              </span>
            </div>
            <Shield className="w-5 h-5 text-rose-300 shrink-0" />
          </button>
        </div>

        {/* GPS Location Telemetry & Quick Corner Fix */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#162d59] text-xs text-[#9db6dd] flex-wrap">
          <span className="flex items-center gap-1.5 min-w-0">
            <Compass className={`w-4 h-4 shrink-0 ${reportSosCoords ? (sosFreshness?.isStale ? 'text-amber-400' : 'text-emerald-400') : 'text-amber-400'}`} />
            <span className={`font-mono tabular-nums text-[11px] font-semibold ${reportSosCoords ? (sosFreshness?.isStale ? 'text-amber-200' : 'text-emerald-200') : 'text-amber-200'}`}>
              {reportSosCoords
                ? reportSosCoords.source === 'manual'
                  ? `Esquina confirmada: ${reportSosCoords.label || 'Punto marcado'}`
                  : `${sosFreshness?.isStale ? 'GPS anterior' : 'GPS listo'} (${reportSosCoords.lat.toFixed(4)}, ${reportSosCoords.lng.toFixed(4)}${sosFreshness?.accuracyMeters ? ` · ±${sosFreshness.accuracyMeters}m` : ''} · ${describePuntaAltaLocation(reportSosCoords)})`
                : gpsStatus || 'GPS sin señal: activá ubicación o fijá la esquina'}
            </span>
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowTopCornerPicker((v) => !v);
                setStreetCornerError('');
              }}
              className="text-[11px] text-cyan-300 underline hover:text-white font-bold"
            >
              {showTopCornerPicker ? 'Cerrar esquina' : 'Fijar esquina'}
            </button>
            <button
              type="button"
              onClick={handleResetGps}
              className="text-[11px] text-[#37c8ff] underline hover:text-white font-bold"
            >
              Actualizar GPS
            </button>
          </div>
        </div>

        {showTopCornerPicker && (
          <div className="p-2.5 rounded-xl bg-[#040917] border border-cyan-400/50 space-y-2 text-xs animate-fade-in">
            <p className="text-[11px] font-bold text-cyan-300">
              Escribí la calle o esquina exacta del accidente en vía pública:
            </p>
            <form onSubmit={handleApplyStreetCorner} className="flex gap-2">
              <input
                type="text"
                value={streetCornerInput}
                onChange={(e) => {
                  setStreetCornerInput(e.target.value);
                  if (streetCornerError) setStreetCornerError('');
                }}
                placeholder="Ej: Brown y Paso, Espora 428, Ruta 249..."
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#07122c] border border-[#1e4594] text-white text-xs"
              />
              <button
                type="submit"
                disabled={isResolvingCorner}
                className="py-1.5 px-3 rounded-lg bg-cyan-500 text-black font-bold text-xs shrink-0"
              >
                {isResolvingCorner ? '…' : 'Fijar'}
              </button>
            </form>
            {streetCornerError && <p className="text-[11px] text-red-300 font-semibold">{streetCornerError}</p>}
            <div className="flex flex-wrap gap-1">
              {POPULAR_PUNTA_ALTA_SPOTS.slice(0, 6).map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => {
                    handleSelectSpot(spot);
                    setShowTopCornerPicker(false);
                  }}
                  className="px-2 py-1 rounded-md bg-[#0a1838] hover:bg-[#122e7a] border border-[#1e3f8f] text-[11px] text-gray-200"
                >
                  {spot.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. SINGLE-ROW CLINICAL TOOLS BAR (No duplicate WhatsApp or Critical Voice button) */}
      <div className="print:hidden grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleSpeakMedicalTriage('full')}
          className={`min-h-[44px] py-2.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition border ${
            isSpeaking && speakingType === 'full'
              ? 'bg-red-600 border-red-400 text-white'
              : 'bg-[#08132c] hover:bg-[#10244d] border-cyan-400/50 text-cyan-200 hover:text-white'
          }`}
          title="Lectura completa por voz (incluye DNI, obra social, historial y contactos)"
        >
          {isSpeaking && speakingType === 'full' ? (
            <>
              <VolumeX className="w-4 h-4 text-white shrink-0" />
              <span className="truncate">Detener Voz</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-[#37c8ff] shrink-0" />
              <span className="truncate">Ficha Completa</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyReport}
          className={`min-h-[44px] py-2.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition border ${
            isCopied
              ? 'bg-emerald-600 border-emerald-400 text-white'
              : 'bg-[#08132c] hover:bg-[#10244d] border-[#24478a] text-[#cde0ff] hover:text-white'
          }`}
          title="Copiar resumen médico para guardia"
        >
          {isCopied ? <Check className="w-4 h-4 text-white shrink-0" /> : <Copy className="w-4 h-4 text-[#37c8ff] shrink-0" />}
          <span className="truncate">{isCopied ? '¡Copiado!' : 'Copiar Ficha'}</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="min-h-[44px] py-2.5 px-2.5 rounded-xl bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-[#cde0ff] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
          title="Imprimir resumen médico de emergencia"
        >
          <Printer className="w-4 h-4 text-[#37c8ff] shrink-0" />
          <span className="truncate">Imprimir</span>
        </button>
      </div>

      {/* Toast Feedback when Copied */}
      {copyToast && (
        <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* 3B. VALIDACIÓN SANGUÍNEA Y CONDICIÓN DE DONANTE DE ÓRGANOS (INCUCAI) */}
      {(record.sangre || record.donanteOrganos) && (
        <DonorAndBloodStatusCard record={record} />
      )}

      {/* 4. ALERTA OBSTÉTRICA AUTOMÁTICA (SI ESTÁ EMBARAZADA) */}
      {pregnancy && (
        <div className="relative p-4 rounded-2xl bg-[#1f071f] border border-pink-400/70 shadow-xl space-y-2.5">
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-pink-300 rounded-tl-sm" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-pink-200 font-black text-xs sm:text-sm uppercase tracking-wider">
              <Baby className="w-5 h-5 text-pink-300 shrink-0" />
              <span>Embarazo en Curso · Alerta Obstétrica</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase bg-pink-500/30 border border-pink-400 text-pink-100">
              {pregnancy.trimesterLabel}
            </span>
          </div>

          <div className="bg-black/45 p-3.5 rounded-xl border border-pink-400/40 space-y-1">
            <div className="text-xl sm:text-2xl font-black text-white font-heading tracking-wide">
              {pregnancy.detailedLabel}
            </div>
            {pregnancy.dueDateFormatted && (
              <div className="text-xs text-pink-200 font-semibold">
                FPP: <strong className="text-white">{pregnancy.dueDateFormatted}</strong>
                {pregnancy.hasValidAnchorDate && ` · Faltan aprox. ${pregnancy.daysRemaining} días`}
              </div>
            )}
            {record.embarazoObstetra && (
              <div className="text-xs text-pink-100 pt-1">
                <strong>Obstetricia:</strong> {record.embarazoObstetra}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. DATOS CLÍNICOS VITALES (Alergias, Medicación, Cobertura) */}
      <div className="space-y-3">
        {/* Alergias y Patologías Previas */}
        <div className="relative p-4 rounded-2xl bg-[#160f05] border border-amber-400/70 shadow-xl space-y-2">
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400 rounded-tl-sm" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Alergias y Enfermedades Previas</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded border border-amber-500/50">
              Crítico
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-50 leading-snug bg-black/50 p-3.5 rounded-xl border border-amber-500/40">
            {record.enf || 'Ninguna alergia ni patología previa declarada'}
          </div>
        </div>

        {/* Medicación habitual */}
        <div className="relative p-4 rounded-2xl bg-[#051526] border border-cyan-400/70 shadow-xl space-y-2">
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400 rounded-tl-sm" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-cyan-300 font-black text-xs sm:text-sm uppercase tracking-wider">
              <Pill className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Medicación Habitual</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-500/50">
              Farmacología
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-cyan-50 leading-snug bg-black/50 p-3.5 rounded-xl border border-cyan-500/40">
            {record.med || 'No toma medicamentos habituales'}
          </div>
        </div>

        {/* Obra Social y Médico */}
        {(record.obraSocial || record.doc) && (
          <div className="p-4 rounded-2xl bg-[#060d20] border border-[#1a3366] shadow-xl space-y-2.5">
            <h3 className="text-[11px] font-mono font-bold text-[#8db4f0] uppercase tracking-wider">
              Cobertura Médica y Profesional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {record.obraSocial && (
                <div className="p-3 rounded-xl bg-[#08132c] border border-[#162d59] space-y-0.5">
                  <span className="text-[11px] text-[#9db6dd] font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#37c8ff]" />
                    <span>Obra Social / Prepaga</span>
                  </span>
                  <span className="font-bold text-base sm:text-lg text-white block">
                    {record.obraSocial}
                  </span>
                </div>
              )}
              {record.doc && (
                <div className="p-3 rounded-xl bg-[#08132c] border border-[#162d59] space-y-0.5">
                  <span className="text-[11px] text-[#9db6dd] font-semibold flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-[#37c8ff]" />
                    <span>Médico de cabecera</span>
                  </span>
                  <span className="font-bold text-base sm:text-lg text-white block">
                    {record.doc}
                  </span>
                  {record.cmed && (
                    <button
                      type="button"
                      onClick={() => triggerDirectCall(record.cmed!, `Médico ${record.doc}`)}
                      className="mt-1 text-xs text-emerald-400 font-bold flex items-center gap-1 hover:underline font-mono tabular-nums"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar: {record.cmed}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Historial Clínico Confidencial */}
      <ClinicalHistorySection
        record={record}
        isRescuerView={true}
      />

      {/* 7. Todos los Contactos Registrados */}
      <div className="p-4 rounded-2xl bg-[#060d20] border border-[#1a3366] space-y-2.5">
        <h3 className="text-[11px] font-mono font-bold text-[#8db4f0] uppercase tracking-wider">
          Contactos de Auxilio Registrados
        </h3>
        <div className="space-y-2">
          {record.tel && (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#08132c] border border-[#162d59] gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#8ba6d6] uppercase font-bold block">Teléfono de Emergencia</span>
                <span className="text-base font-mono tabular-nums font-bold text-white">{record.tel}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDirectCall(record.tel!, 'Teléfono de Auxilio')}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow active:scale-95 transition"
                  title="Llamar"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppTo(record.tel!)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow active:scale-95 transition"
                  title="WhatsApp"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {record.cfam && (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#08132c] border border-[#162d59] gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#8ba6d6] uppercase font-bold block">Familiar Directo</span>
                <span className="text-base font-mono tabular-nums font-bold text-white">{record.cfam}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDirectCall(record.cfam!, 'Familiar')}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow active:scale-95 transition"
                  title="Llamar"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppTo(record.cfam!)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow active:scale-95 transition"
                  title="WhatsApp"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {record.cami && (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#08132c] border border-[#162d59] gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#8ba6d6] uppercase font-bold block">Amigo / Allegado</span>
                <span className="text-base font-mono tabular-nums font-bold text-white">{record.cami}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDirectCall(record.cami!, 'Amigo')}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow active:scale-95 transition"
                  title="Llamar"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppTo(record.cami!)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow active:scale-95 transition"
                  title="WhatsApp"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {record.cmed && (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#08132c] border border-[#162d59] gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-[#8ba6d6] uppercase font-bold block">Médico de cabecera</span>
                <span className="text-base font-mono tabular-nums font-bold text-white">{record.cmed}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerDirectCall(record.cmed!, 'Médico')}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow active:scale-95 transition"
                  title="Llamar"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppTo(record.cmed!)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow active:scale-95 transition"
                  title="WhatsApp"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 8. Guardias Hospitalarias Locales (1 Toque) */}
      <div className="print:hidden p-4 rounded-2xl bg-[#060d20] border border-[#1a3366] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-[11px] font-mono font-bold uppercase text-[#8db4f0] tracking-wider">
              {isTravelerOutsidePuntaAlta
                ? 'Hospitales y Guardias Cercanas (En Viaje)'
                : 'Guardias Hospitalarias 24hs · Punta Alta'}
            </h3>
          </div>
        </div>

        {isTravelerOutsidePuntaAlta && reportSosCoords && (
          <a
            href={getNearbyMapSearchUrl('hospital guardia medica emergencias', reportSosCoords)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow active:scale-95 transition"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Buscar Hospital / Guardia más cercana a mi GPS actual</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </a>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => triggerDirectCall('02932421222', 'Hospital Municipal Eva Perón (Guardia)')}
            className="p-3 rounded-xl bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-white text-left active:scale-95 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">Municipal</span>
              <span className="text-[10px] text-emerald-300 font-mono font-bold">24hs</span>
            </div>
            <div className="text-sm sm:text-base font-black font-heading mt-1.5 leading-tight">
              Hosp. Eva Perón
            </div>
            <span className="text-xs text-[#9db6dd] font-mono tabular-nums font-semibold mt-0.5">
              02932 42-1222
            </span>
          </button>

          <button
            type="button"
            onClick={() => triggerDirectCall('02932489600', 'Hospital Naval Puerto Belgrano (Guardia)')}
            className="p-3 rounded-xl bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-white text-left active:scale-95 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">Base Naval</span>
              <span className="text-[10px] text-emerald-300 font-mono font-bold">24hs</span>
            </div>
            <div className="text-sm sm:text-base font-black font-heading mt-1.5 leading-tight">
              Hosp. Naval HNPB
            </div>
            <span className="text-xs text-[#9db6dd] font-mono tabular-nums font-semibold mt-0.5">
              02932 48-9600
            </span>
          </button>
        </div>
      </div>

      {/* 9. FARMACIA DE TURNO MÁS CERCANA */}
      <div
        id="rescuer-duty-pharmacy"
        className="print:hidden relative p-4 rounded-2xl bg-[#060d20] border border-emerald-500/60 shadow-xl space-y-3"
      >
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400/80 rounded-tl-sm" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400/80 rounded-br-sm" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#162d59] pb-2.5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-black font-heading uppercase text-white tracking-wider">
                {isTravelerOutsidePuntaAlta
                  ? 'Farmacia Más Cercana (En Viaje)'
                  : 'Farmacia de Turno Más Cercana'}
              </span>
              <span className="block text-[11px] text-[#9db6dd]">
                {isTravelerOutsidePuntaAlta && coords
                  ? `GPS en ${describePuntaAltaLocation(coords)}`
                  : `Medido desde: ${originDescription}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 flex-wrap">
            {originMode !== 'gps' ? (
              <button
                type="button"
                onClick={handleResetGps}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Usar mi GPS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetGps}
                className="px-2.5 py-1.5 rounded-lg bg-[#08132c] hover:bg-[#10244d] border border-cyan-400/50 text-cyan-200 hover:text-white font-bold text-[11px] flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>GPS</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSpotSelector(!showSpotSelector)}
              className="px-2.5 py-1.5 rounded-lg bg-[#08132c] border border-[#24478a] text-cyan-200 text-[11px] font-bold flex items-center gap-1"
            >
              <span>{showSpotSelector ? 'Ocultar' : 'Cambiar esquina'}</span>
              {showSpotSelector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {showSpotSelector && (
          <div className="p-2.5 rounded-xl bg-[#040917] border border-cyan-400/50 space-y-2 animate-fade-in text-xs">
            <span className="text-[11px] font-bold text-cyan-300 block">
              ¿En qué calle, esquina o zona de Punta Alta estás asistiendo?
            </span>
            <form onSubmit={handleApplyStreetCorner} className="flex gap-1.5">
              <input
                type="text"
                value={streetCornerInput}
                onChange={(e) => {
                  setStreetCornerInput(e.target.value);
                  if (streetCornerError) setStreetCornerError('');
                }}
                placeholder="Escribí calle y altura o esquina..."
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#07122c] border border-[#1e4594] text-white text-xs"
              />
              <button
                type="submit"
                disabled={isResolvingCorner}
                className="py-1.5 px-3 rounded-lg bg-cyan-500 text-black font-bold text-xs shrink-0"
              >
                {isResolvingCorner ? '…' : 'Fijar'}
              </button>
            </form>
            {streetCornerError && <p className="text-[11px] text-red-300 font-semibold">{streetCornerError}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {POPULAR_PUNTA_ALTA_SPOTS.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => handleSelectSpot(spot)}
                  className={`p-1.5 rounded-lg text-left text-[11px] font-bold transition truncate ${
                    originMode === 'manual' && customLabel === spot.label
                      ? 'bg-cyan-400 text-black'
                      : 'bg-[#0a1838] hover:bg-[#122e7a] text-gray-200 border border-[#1e3f8f]'
                  }`}
                >
                  {spot.label}
                </button>
              ))}
            </div>
            {record.domicilio && (
              <button
                type="button"
                onClick={() => {
                  playChirp('click');
                  setOriginMode('domicilio');
                  setShowSpotSelector(false);
                }}
                className={`w-full p-2 rounded-lg text-xs font-bold flex items-center justify-between border ${
                  originMode === 'domicilio'
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-[#0a1838] text-amber-200 border-amber-500/50 hover:bg-[#122e7a]'
                }`}
              >
                <span>Domicilio del titular: {record.domicilio}</span>
                <span className="text-[10px] font-black uppercase">Elegir</span>
              </button>
            )}
          </div>
        )}

        {isTravelerOutsidePuntaAlta && isVerifiedEmergencyCoords(effectiveCoords) && (
          <div className="p-3.5 rounded-xl bg-[#081f24] border border-cyan-400/60 space-y-2">
            <p className="text-xs text-white font-semibold">
              Para localizar una farmacia abierta en {describePuntaAltaLocation(effectiveCoords)}:
            </p>
            <a
              href={getNearbyMapSearchUrl('farmacia de turno abierta', effectiveCoords)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-gray-950 font-black text-xs flex items-center justify-center gap-2 shadow"
            >
              <Pill className="w-4 h-4 shrink-0" />
              <span>Buscar Farmacia Abierta cerca de mí</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </a>
          </div>
        )}

        {closestDuty ? (
          <div className="p-3.5 rounded-xl bg-[#072118] border border-emerald-500/50 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                  <Star className="w-3 h-3 fill-emerald-300" />
                  {isTravelerOutsidePuntaAlta ? 'De turno hoy en Punta Alta' : 'Guardia hoy · Más cercana'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black font-heading text-white leading-tight">
                  {closestDuty.name}
                </h3>
                <a
                  href={getMapSearchUrl(closestDuty.address, closestDuty.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-100/90 hover:text-white underline decoration-dotted inline-flex items-center gap-1 mt-0.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{closestDuty.address}</span>
                </a>
              </div>

              {closestDuty.distMeters != null && (
                <div className="text-right shrink-0">
                  <span className="text-lg sm:text-xl font-mono tabular-nums font-black text-emerald-300 block leading-none">
                    {closestDuty.distMeters < 1000
                      ? `${closestDuty.distMeters} m`
                      : `${(closestDuty.distMeters / 1000).toFixed(2).replace('.', ',')} km`}
                  </span>
                  <span className="text-[11px] text-white/80 font-mono block mt-0.5">
                    {closestDuty.distMeters < 1000
                      ? `~${Math.max(1, Math.round(closestDuty.distMeters / 100))} cuadras`
                      : 'Haversine'}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {closestDuty.phones.length > 0 ? (
                <button
                  type="button"
                  onClick={() => triggerDirectCall(closestDuty.phones[0], closestDuty.name, 'pharmacy')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">{closestDuty.phones[0]}</span>
                </button>
              ) : (
                <div className="py-2 px-3 rounded-xl bg-black/30 text-gray-400 text-xs text-center flex items-center justify-center">
                  Sin teléfono fijo
                </div>
              )}

              <a
                href={getDirectionsUrl(
                  {
                    name: closestDuty.name,
                    address: closestDuty.address,
                    lat: closestDuty.lat,
                    lng: closestDuty.lng
                  },
                  effectiveCoords
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-cyan-400/60 text-cyan-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-300" />
                <span>Cómo llegar</span>
              </a>

              <button
                type="button"
                onClick={handleSpeakClosestPharmacy}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition ${
                  isSpeaking && speakingType === 'pharmacy'
                    ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400'
                    : 'bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-cyan-200 hover:text-white'
                }`}
              >
                {isSpeaking && speakingType === 'pharmacy' ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Detener voz</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Escuchar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-amber-300 bg-black/40 rounded-xl">
            No se encontraron farmacias de guardia registradas para hoy.
          </div>
        )}

        {otherDuty.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAllDuty(!showAllDuty)}
              className="w-full py-2 px-3 rounded-xl bg-[#08132c] hover:bg-[#10244d] border border-emerald-500/35 text-emerald-300 font-bold text-xs flex items-center justify-between transition"
            >
              <span>Otras farmacias de guardia hoy ({otherDuty.length} más)</span>
              {showAllDuty ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAllDuty && (
              <div className="mt-2 space-y-2 animate-fade-in">
                {otherDuty.map((pharmacy) => {
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

                  return (
                    <div
                      key={pharmacy.id}
                      className="p-3 rounded-xl bg-[#08132c] border border-[#162d59] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm font-bold">{pharmacy.name}</strong>
                          {pharmacy.distMeters != null && (
                            <span className="text-emerald-400 font-mono tabular-nums font-bold">
                              · {pharmacy.distMeters < 1000 ? `${pharmacy.distMeters}m` : `${(pharmacy.distMeters / 1000).toFixed(2).replace('.', ',')} km`}
                            </span>
                          )}
                        </div>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#9db6dd] hover:text-white inline-flex items-center gap-1 underline decoration-dotted mt-0.5"
                        >
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          <span>{pharmacy.address}</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pharmacy.phones.map((phone, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => triggerDirectCall(phone, pharmacy.name, 'pharmacy')}
                            className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Llamar</span>
                          </button>
                        ))}
                        <a
                          href={dirUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1 px-2.5 rounded-lg bg-[#0a1f55] border border-cyan-400/60 text-cyan-200 hover:text-white font-bold flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Ruta</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 10. Aclaración y CTAs Finales */}
      <p className="text-center text-xs text-[#8ba6d6] px-2 leading-relaxed">
        Ficha de auxilio vinculada por el titular a su llavero Vortex ID para respuesta ante emergencias médicas.
      </p>

      {onOpenInstallGuide && (
        <div className="print:hidden">
          <button
            type="button"
            onClick={onOpenInstallGuide}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-lg border border-emerald-300/60"
          >
            <Smartphone className="w-4 h-4 text-yellow-200 shrink-0" />
            <span>Instalar Vortex ID gratis en este celular</span>
          </button>
        </div>
      )}

      <div className="print:hidden">
        <button
          type="button"
          onClick={onOpenPortal}
          className="w-full py-3 px-4 rounded-xl bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-cyan-200 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95"
        >
          <span>Ver portal general de Punta Alta y farmacias de turno</span>
          <ArrowRight className="w-4 h-4 text-[#37c8ff]" />
        </button>
      </div>

      {/* Inline Manual Copy Report Modal */}
      {manualCopyReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md print:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#060d20] border border-[#37c8ff] p-4 sm:p-5 shadow-2xl space-y-3 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#37c8ff]">
                Copiar Reporte Médico
              </h3>
              <button
                type="button"
                onClick={() => setManualCopyReport(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
            <p className="text-xs text-[#9db6dd]">
              Tu navegador bloqueó el portapapeles automático. Mantené presionado el texto o seleccioná todo para copiarlo:
            </p>
            <textarea
              readOnly
              value={manualCopyReport}
              rows={8}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full p-3 rounded-xl bg-[#040917] border border-[#1e5bff]/60 text-xs text-white font-mono focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Fullscreen Identity Verification Photo Zoom Modal */}
      {isPhotoZoomOpen && record.foto && !photoRenderError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md print:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsPhotoZoomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#060d20] border border-[#37c8ff] p-5 shadow-2xl space-y-3 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#37c8ff] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Corroborar Identidad del Titular</span>
            </div>
            {(() => {
              const isCompactOfflinePhoto = Boolean(record.foto && record.foto.length < 2500);
              return (
                <>
                  <div
                    className={`${
                      isCompactOfflinePhoto ? 'w-52 h-52' : 'w-64 h-64 sm:w-72 sm:h-72'
                    } mx-auto rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-[#040917]`}
                  >
                    <img
                      src={record.foto}
                      alt={record.nombre || 'Foto del titular'}
                      className="w-full h-full object-cover block"
                    />
                  </div>
                  <div>
                    <div className="text-xl font-black font-heading text-white">
                      {record.nombre || 'Titular registrado'}
                    </div>
                    {record.dni && (
                      <div className="text-sm font-mono tabular-nums font-bold text-[#37c8ff]">
                        DNI {record.dni}
                      </div>
                    )}
                    <p className="text-[11px] text-[#9db6dd] mt-1">
                      Confirmá que el rostro coincida con la persona asistida antes de aplicar medicación.
                    </p>
                  </div>
                </>
              );
            })()}
            <button
              type="button"
              onClick={() => setIsPhotoZoomOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#1e5bff] hover:bg-blue-500 text-white font-bold text-xs shadow active:scale-95 transition"
            >
              Cerrar vista ampliada
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
