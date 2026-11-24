/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { SosBanner } from './components/SosBanner';
import { MissionControlConsole } from './components/MissionControlConsole';
import { EmergencyCallGrid } from './components/EmergencyCallGrid';
import { PharmacySection } from './components/PharmacySection';
import { WeatherAlertCard } from './components/WeatherAlertCard';
import { ServicesSection } from './components/ServicesSection';
import { MedicalIdSection } from './components/MedicalIdSection';
import { MedicalIdModal } from './components/MedicalIdModal';
import { EmergencyCredentialModal } from './components/EmergencyCredentialModal';
import { EmergencyDialerModal } from './components/EmergencyDialerModal';
import { KeychainLinkModal } from './components/KeychainLinkModal';
import { ResponderEmergencyView } from './components/ResponderEmergencyView';
import { InstallAppModal } from './components/InstallAppModal';
import { SystemControlModal } from './components/SystemControlModal';
import { PushAlertsModal } from './components/PushAlertsModal';
import { WelcomeOnboardingModal } from './components/WelcomeOnboardingModal';
import { WelcomeContext } from './utils/welcomeVoice';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { syncEmergencyRecordToWorker } from './utils/offlineManager';
import { BottomNav } from './components/BottomNav';
import {
  Coordinates,
  getStoredCoords,
  saveStoredCoords,
  getLastRealGpsCoords,
  saveLastRealGpsCoords,
  isVerifiedEmergencyCoords,
  shouldReplaceEmergencyCoords,
  estimateCoordsFromPuntaAltaAddress,
  describePuntaAltaLocation,
  DEFAULT_PUNTA_ALTA_COORDS,
  isWithinPuntaAltaArea,
  fetchIpFallbackCoordinates,
  sortByHaversineDistance
} from './utils/geo';
import {
  loadMedicalRecord,
  MedicalRecord,
  hasMedicalData,
  linkRecordToKeychain,
  fetchRecordFromCloud,
  optimizeRecordPhoto,
  findMatchingLocalHdPhoto,
  recordsMatchSamePerson,
  clearMedicalRecord,
  SAMPLE_DEMO_RECORD
} from './utils/medicalData';
import {
  fetchSystemConfig,
  getStoredSystemConfig,
  formatCurrency,
  isMembershipUnlockedLocally,
  SystemConfig
} from './utils/systemConfig';
import { subscribeToActiveCall, ActiveCall, closeActiveCall, playChirp } from './utils/callHandler';
import {
  PUNTA_ALTA_PHARMACIES,
  getDutyPharmaciesForDate,
  syncDutyScheduleFromServer
} from './data/puntaAltaData';
import {
  speakNaturalSpanish,
  stopVoiceAssistant,
  buildDutyPharmaciesSpeech
} from './utils/voiceAssistant';
import { initPushNotifications } from './utils/pushNotifications';
import { useAuth } from './context/AuthContext';
import {
  saveMedicalRecordToFirestore,
  loadMedicalRecordFromFirestore,
  fetchKeychainFromFirestore,
  deleteKeychainFromFirestore
} from './firebase/firestoreService';
import { usePWAInstall } from './utils/usePWAInstall';
import { logSystemEvent } from './utils/systemTelemetry';
import { HeartHandshake, QrCode, Link2, Tag, Settings, Download, X, ShieldCheck, Eye, Lock } from 'lucide-react';

export default function App() {
  const { user, isAdmin } = useAuth();
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
  const [isFromLink, setIsFromLink] = useState<boolean>(false);
  const [showFullPortal, setShowFullPortal] = useState<boolean>(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isKeychainModalOpen, setIsKeychainModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [installModalTab, setInstallModalTab] = useState<'qr' | 'android' | 'iphone' | 'pc' | 'marca'>('qr');
  const [dismissedPwaBanner, setDismissedPwaBanner] = useState<boolean>(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isSystemControlOpen, setIsSystemControlOpen] = useState<boolean>(false);
  const [operatorSessionActive, setOperatorSessionActive] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('vortex_operator_mode_v1') === '1';
    } catch {
      return false;
    }
  });
  const [citizenPreviewMode, setCitizenPreviewMode] = useState<boolean>(false);
  const showOperatorHud = (isAdmin || operatorSessionActive) && !citizenPreviewMode;
  const [isPushModalOpen, setIsPushModalOpen] = useState<boolean>(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState<boolean>(false);
  const [welcomeContext, setWelcomeContext] = useState<WelcomeContext>('default');
  const [isTriggeredByScan, setIsTriggeredByScan] = useState<boolean>(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(getStoredSystemConfig());
  const [isMembershipUnlocked, setIsMembershipUnlocked] = useState<boolean>(() =>
    isMembershipUnlockedLocally()
  );
  const [isDemoPreviewOpen, setIsDemoPreviewOpen] = useState<boolean>(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [scannedUnlinkedId, setScannedUnlinkedId] = useState<string | null>(null);
  const [confirmClearRecord, setConfirmClearRecord] = useState<boolean>(false);
  const [dutyClockTick, setDutyClockTick] = useState<number>(0);
  const [isSpeakingTopDuty, setIsSpeakingTopDuty] = useState<boolean>(false);
  const [topDutySpokenSubtitle, setTopDutySpokenSubtitle] = useState<string>('');

  // Real device GPS/network coordinates (never fabricated with hardcoded Colon 415)
  const [coords, setCoords] = useState<Coordinates | null>(
    () => getStoredCoords() || getLastRealGpsCoords(15 * 60 * 1000)
  );
  // Strictly verified real device GPS/network coordinates for SOS & medical emergencies
  const [emergencyCoords, setEmergencyCoords] = useState<Coordinates | null>(() => getLastRealGpsCoords());
  // Separate coarse IP fallback ONLY for warning/outage diagnostics (never treated as verified GPS)
  const [ipFallbackCoords, setIpFallbackCoords] = useState<Coordinates | null>(null);
  const emergencyCoordsRef = useRef<Coordinates | null>(emergencyCoords);
  emergencyCoordsRef.current = emergencyCoords;

  // Synchronized pharmacy radar origin selected in PharmacySection (for consistent Header label)
  const [pharmacyOrigin, setPharmacyOrigin] = useState<{
    coords: Coordinates | null;
    label: string;
    mode: 'gps' | 'manual' | 'domicilio' | 'centro';
  }>(() => {
    try {
      const pref = localStorage.getItem('vortex_preferred_origin_mode_v4');
      if (pref) {
        const p = JSON.parse(pref);
        if (p?.label && /414\s*\/\s*415|col[oó]n\s*415/i.test(String(p.label))) {
          return { coords: null, label: '', mode: 'gps' };
        }
        if (p?.mode && p.mode !== 'gps') {
          return {
            coords: p.coords || null,
            label: p.label || '',
            mode: p.mode
          };
        }
      }
    } catch {}
    return { coords: null, label: '', mode: 'gps' };
  });

  const applyEmergencyCoords = (incoming: Coordinates) => {
    setEmergencyCoords((prev) => (shouldReplaceEmergencyCoords(prev, incoming) ? incoming : prev));
    saveLastRealGpsCoords(incoming);
  };

  const [gpsStatus, setGpsStatus] = useState<string>('Buscando señal GPS real del dispositivo…');

  // Dynamic duty shift label & nearest duty pharmacy for Header
  const currentDutyInfo = useMemo(() => {
    return getDutyPharmaciesForDate(new Date());
  }, [dutyClockTick]);

  const shiftLabel = currentDutyInfo.shiftLabel;

  const effectivePharmacyOrigin = useMemo((): { coords: Coordinates | null; tag: string } => {
    if (pharmacyOrigin.mode === 'manual' && pharmacyOrigin.coords) {
      return { coords: pharmacyOrigin.coords, tag: pharmacyOrigin.label || 'Ubicación elegida' };
    }
    if (pharmacyOrigin.mode === 'domicilio') {
      const dom = estimateCoordsFromPuntaAltaAddress(medicalRecord?.domicilio);
      if (dom) {
        return { coords: dom, tag: 'tu domicilio' };
      }
    }
    if (pharmacyOrigin.mode === 'centro') {
      return { coords: DEFAULT_PUNTA_ALTA_COORDS, tag: 'Centro' };
    }
    if (coords && isVerifiedEmergencyCoords(coords)) {
      return {
        coords,
        tag: isWithinPuntaAltaArea(coords) ? 'tu GPS' : describePuntaAltaLocation(coords)
      };
    }
    return { coords: null, tag: '' };
  }, [pharmacyOrigin, medicalRecord?.domicilio, coords]);

  const headerLocationLabel = useMemo(() => {
    const dutyPharmacies = PUNTA_ALTA_PHARMACIES.filter((p) =>
      currentDutyInfo.pharmacyIds.includes(p.id)
    );
    const pool = dutyPharmacies.length > 0 ? dutyPharmacies : PUNTA_ALTA_PHARMACIES;

    if (!effectivePharmacyOrigin.coords) {
      return 'Farmacias de turno · Activar GPS o elegir calle';
    }

    const sorted = sortByHaversineDistance(pool, effectivePharmacyOrigin.coords);
    const closest = sorted[0];
    if (!closest) return 'Punta Alta · Turno 24h';
    const distLabel =
      closest.distMeters < 1000
        ? `a ${closest.distMeters}m`
        : `a ${(closest.distMeters / 1000).toFixed(1).replace('.', ',')} km`;
    if (pharmacyOrigin.mode === 'gps' && !isWithinPuntaAltaArea(effectivePharmacyOrigin.coords)) {
      return `GPS ${describePuntaAltaLocation(effectivePharmacyOrigin.coords)} · Turno más cercana: ${closest.name} (${distLabel})`;
    }
    return `Turno más cercana (${effectivePharmacyOrigin.tag}): ${closest.name} (${distLabel})`;
  }, [effectivePharmacyOrigin, pharmacyOrigin.mode, currentDutyInfo.pharmacyIds]);

  const sortedActiveDutyPharmacies = useMemo(() => {
    const dutyPharmacies = PUNTA_ALTA_PHARMACIES.filter((p) =>
      currentDutyInfo.pharmacyIds.includes(p.id)
    );
    const pool = dutyPharmacies.length > 0 ? dutyPharmacies : PUNTA_ALTA_PHARMACIES;
    const refCoords = effectivePharmacyOrigin.coords || DEFAULT_PUNTA_ALTA_COORDS;
    return sortByHaversineDistance(pool, refCoords);
  }, [currentDutyInfo.pharmacyIds, effectivePharmacyOrigin.coords]);

  const topDutyClosestSummary = useMemo(() => {
    const closest = sortedActiveDutyPharmacies[0];
    if (!closest) return 'Tocá para oír las farmacias de turno de hoy';
    const distLabel =
      closest.distMeters < 1000
        ? `a ${closest.distMeters} m`
        : `a ${(closest.distMeters / 1000).toFixed(1).replace('.', ',')} km`;
    return `Hoy: ${closest.name} (${closest.address} · ${distLabel})`;
  }, [sortedActiveDutyPharmacies]);

  const handleToggleTopDutyVoice = async () => {
    if (isSpeakingTopDuty) {
      stopVoiceAssistant();
      setIsSpeakingTopDuty(false);
      setTopDutySpokenSubtitle('');
      return;
    }

    if (sortedActiveDutyPharmacies.length === 0) return;

    playChirp('click');
    let originDescription = 'Plaza Belgrano (Centro)';
    if (effectivePharmacyOrigin.coords) {
      if (pharmacyOrigin.mode === 'manual' && pharmacyOrigin.label) {
        originDescription = pharmacyOrigin.label;
      } else if (pharmacyOrigin.mode === 'domicilio') {
        originDescription = 'tu domicilio guardado';
      } else if (pharmacyOrigin.mode === 'centro') {
        originDescription = 'Plaza Belgrano (Centro)';
      } else if (
        typeof effectivePharmacyOrigin.coords.accuracy === 'number' &&
        effectivePharmacyOrigin.coords.accuracy > 150
      ) {
        originDescription = 'tu ubicación aproximada por red en Punta Alta';
      } else {
        originDescription = 'tu ubicación GPS actual';
      }
    }

    const text = buildDutyPharmaciesSpeech(
      sortedActiveDutyPharmacies.map((p) => ({ pharmacy: p, distKm: p.distKm })),
      originDescription
    );
    setTopDutySpokenSubtitle(text);
    setIsSpeakingTopDuty(true);

    await speakNaturalSpanish(
      text,
      0.92,
      () => setIsSpeakingTopDuty(true),
      () => {
        setIsSpeakingTopDuty(false);
        setTopDutySpokenSubtitle('');
      },
      () => {
        setIsSpeakingTopDuty(false);
        setTopDutySpokenSubtitle('');
      },
      'sos_banner_duty'
    );
  };

  // Subscribe to call dispatcher, origin changes, duty updates & system config updates
  useEffect(() => {
    const unsubscribe = subscribeToActiveCall((call) => {
      setActiveCall(call);
    });

    const handleConfigUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SystemConfig>;
      if (customEvent.detail) {
        setSystemConfig(customEvent.detail);
      }
    };
    window.addEventListener('vortex_config_updated', handleConfigUpdated);

    const handleMembershipUpdated = () => {
      setIsMembershipUnlocked(isMembershipUnlockedLocally());
    };
    window.addEventListener('vortex_membership_unlocked', handleMembershipUpdated);

    const handleOriginChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        coords?: Coordinates | null;
        label?: string;
        mode?: 'gps' | 'manual' | 'domicilio' | 'centro';
      }>;
      if (customEvent.detail) {
        setPharmacyOrigin({
          coords: customEvent.detail.coords || null,
          label: customEvent.detail.label || '',
          mode: customEvent.detail.mode || 'gps'
        });
      }
    };
    window.addEventListener('vortex_origin_changed', handleOriginChanged);

    const handleRealGpsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<Coordinates>;
      if (customEvent.detail && isVerifiedEmergencyCoords(customEvent.detail)) {
        setEmergencyCoords((prev) =>
          shouldReplaceEmergencyCoords(prev, customEvent.detail) ? customEvent.detail : prev
        );
      }
    };
    window.addEventListener('vortex_real_gps_updated', handleRealGpsUpdated);

    const handleDutyUpdated = () => {
      setDutyClockTick((t) => t + 1);
    };
    window.addEventListener('vortex_duty_updated', handleDutyUpdated);

    const handleVoiceState = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean; sourceId?: string | null }>).detail;
      if (!detail?.active || (detail.sourceId && detail.sourceId !== 'sos_banner_duty')) {
        setIsSpeakingTopDuty(false);
        setTopDutySpokenSubtitle('');
      }
    };
    window.addEventListener('vortex_voice_state', handleVoiceState);

    const handleAppInstalled = () => {
      try {
        localStorage.setItem('vortex_welcome_seen_install_v1', '1');
      } catch {}
      setIsInstallModalOpen(false);
      setIsTriggeredByScan(false);
      setWelcomeContext('installed');
      setIsWelcomeModalOpen(true);
    };
    window.addEventListener('vortex_app_installed', handleAppInstalled);

    // First-time launch of the installed standalone PWA on Android/iOS
    let standaloneTimer: ReturnType<typeof setTimeout> | undefined;
    const isStandaloneLaunch =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandaloneLaunch) {
      let alreadyWelcomed = false;
      try {
        alreadyWelcomed = localStorage.getItem('vortex_welcome_seen_install_v1') === '1';
      } catch {
        alreadyWelcomed = false;
      }
      if (!alreadyWelcomed) {
        standaloneTimer = setTimeout(() => {
          try {
            localStorage.setItem('vortex_welcome_seen_install_v1', '1');
          } catch {}
          setIsTriggeredByScan(false);
          setWelcomeContext('installed');
          setIsWelcomeModalOpen(true);
        }, 450);
      }
    }

    const dutyTimer = setInterval(() => {
      setDutyClockTick((t) => t + 1);
    }, 60000);

    fetchSystemConfig().then((cfg) => {
      setSystemConfig(cfg);
    });

    syncDutyScheduleFromServer().then(() => {
      setDutyClockTick((t) => t + 1);
    });

    // Initialize Push Notifications and Service Worker
    initPushNotifications().catch((err) => {
      console.warn('Push init error:', err);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('vortex_config_updated', handleConfigUpdated);
      window.removeEventListener('vortex_membership_unlocked', handleMembershipUpdated);
      window.removeEventListener('vortex_origin_changed', handleOriginChanged);
      window.removeEventListener('vortex_real_gps_updated', handleRealGpsUpdated);
      window.removeEventListener('vortex_duty_updated', handleDutyUpdated);
      window.removeEventListener('vortex_voice_state', handleVoiceState);
      window.removeEventListener('vortex_app_installed', handleAppInstalled);
      if (standaloneTimer) clearTimeout(standaloneTimer);
      clearInterval(dutyTimer);
    };
  }, []);

  // Load Medical Record on Mount (either from URL hash #d=..., #id=..., localStorage, or Cloud API)
  useEffect(() => {
    const initRecord = async () => {
      const { record, isFromLink: fromLink, scannedKeychainNumber, isUnlinkedScannedKeychain } = loadMedicalRecord();
      let active = record;

      if (active) {
        // When scanning a QR on the same device, immediately restore the stored 400x400 HD portrait
        if (fromLink) {
          const localHd = findMatchingLocalHdPhoto(active);
          if (localHd) {
            active = { ...active, foto: localHd };
          }
        }

        setMedicalRecord(active);
        syncEmergencyRecordToWorker(active);
        setIsFromLink(fromLink);
        if (fromLink) {
          setShowFullPortal(false);
        }

        // Preserve HD foto (400x400) while upgrading any legacy blurry <=950B QR portrait to crisp 128x128
        let shouldUpgradeQr = false;
        if (!fromLink && active.foto) {
          const hasLegacyTinyQr = Boolean(
            active.fotoQr && active.fotoQr.length <= 950 && active.foto.length > 3000
          );
          let alreadyAttemptedUpgrade = false;
          try {
            alreadyAttemptedUpgrade = Boolean(sessionStorage.getItem('vortex_qr_hd_upgraded_v2'));
          } catch {
            alreadyAttemptedUpgrade = false;
          }
          if (
            !active.fotoQr ||
            active.fotoQr.length > 1650 ||
            active.foto.length > 55000 ||
            (hasLegacyTinyQr && !alreadyAttemptedUpgrade)
          ) {
            shouldUpgradeQr = true;
            try {
              sessionStorage.setItem('vortex_qr_hd_upgraded_v2', '1');
            } catch {
              // ignore
            }
          }
        }

        if (shouldUpgradeQr) {
          optimizeRecordPhoto(active, true).then((optimized) => {
            if (
              optimized.foto !== active?.foto ||
              optimized.fotoQr !== active?.fotoQr
            ) {
              setMedicalRecord((prev) =>
                prev
                  ? { ...prev, foto: optimized.foto, fotoQr: optimized.fotoQr }
                  : optimized
              );
              syncEmergencyRecordToWorker(optimized);
            }
          });
        }

        // Hydrate HD photo/data from Firestore & Cloud API if active record came from a link or lacks HD portrait
        if (active.keychainId) {
          Promise.all([
            fetchKeychainFromFirestore(active.keychainId).catch(() => null),
            fetchRecordFromCloud(active.keychainId).catch(() => null)
          ]).then(([fsRec, apiRec]) => {
            const candidates = [fsRec, apiRec].filter(Boolean) as MedicalRecord[];
            setMedicalRecord((prev) => {
              const base = prev || active!;
              let bestFoto = base.foto || '';
              for (const cand of candidates) {
                if (
                  cand.foto &&
                  cand.foto.startsWith('data:image/') &&
                  cand.foto.length > bestFoto.length
                ) {
                  bestFoto = cand.foto;
                }
              }
              if (!bestFoto || bestFoto === base.foto) return base;
              const updated = { ...base, foto: bestFoto };
              syncEmergencyRecordToWorker(updated);
              return updated;
            });
          });
        } else if (!active.foto || active.foto.length < 3000) {
          Promise.all([
            fetchRecordFromCloud().catch(() => null),
            user?.uid ? loadMedicalRecordFromFirestore(user.uid).catch(() => null) : Promise.resolve(null)
          ]).then(([apiRec, fsUserRec]) => {
            const candidates = [fsUserRec, apiRec].filter(Boolean) as MedicalRecord[];
            setMedicalRecord((prev) => {
              const base = prev || active!;
              let bestFoto = base.foto || '';
              for (const cand of candidates) {
                if (
                  cand.foto &&
                  cand.foto.startsWith('data:image/') &&
                  cand.foto.length > bestFoto.length + 1000 &&
                  (!fromLink || recordsMatchSamePerson(base, cand))
                ) {
                  bestFoto = cand.foto;
                }
              }
              if (!bestFoto || bestFoto === base.foto) return base;
              const updated = { ...base, foto: bestFoto };
              syncEmergencyRecordToWorker(updated);
              return updated;
            });
          });
        }
      } else if (scannedKeychainNumber) {
        // Query Firestore or cloud backend for this physical keychain (never crash if offline/blocked)
        let cloudRecord: MedicalRecord | null = null;
        try {
          cloudRecord = await fetchKeychainFromFirestore(scannedKeychainNumber);
        } catch {
          cloudRecord = null;
        }
        if (!cloudRecord) {
          cloudRecord = await fetchRecordFromCloud(scannedKeychainNumber);
        }
        if (cloudRecord && hasMedicalData(cloudRecord)) {
          setMedicalRecord(cloudRecord);
          setIsFromLink(true);
          setShowFullPortal(false);
          setScannedUnlinkedId(null);
        } else if (isUnlinkedScannedKeychain) {
          setScannedUnlinkedId(scannedKeychainNumber);
          setMedicalRecord(null);
        }
      } else {
        // Option 2: Brand new installation starts completely empty!
        // No dummy or preloaded data is forced onto new visitors.
        setMedicalRecord(null);
      }

      // Check private operator URL route (?cmd=control, ?admin=1, #control)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const wantsControl =
          urlParams.get('cmd') === 'control' ||
          urlParams.get('admin') === '1' ||
          window.location.hash === '#control';
        if (wantsControl) {
          setIsSystemControlOpen(true);
          if (urlParams.has('cmd') || urlParams.has('admin')) {
            urlParams.delete('cmd');
            urlParams.delete('admin');
            const cleanQuery = urlParams.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash === '#control' ? '' : window.location.hash}`;
            window.history.replaceState({}, '', cleanUrl);
          } else if (window.location.hash === '#control') {
            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
          }
        }
      } catch {}

      // Check if user entered via QR code scan or referral (?alta=1, ?welcome=1, ?scan=new, #bienvenido)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isAltaParam = urlParams.get('alta') === '1';
        const isWelcomeParam =
          isAltaParam ||
          urlParams.get('welcome') === '1' ||
          urlParams.get('scan') === 'new' ||
          urlParams.get('origen') === 'qr' ||
          window.location.hash === '#bienvenido';

        if (isWelcomeParam && !active && !scannedKeychainNumber) {
          clearMedicalRecord();
          setMedicalRecord(null);
          setIsFromLink(false);
          setShowFullPortal(true);
          setScannedUnlinkedId(null);
          if (isAltaParam) {
            setTimeout(() => {
              document.getElementById('ficha-medica')?.scrollIntoView({ behavior: 'smooth' });
            }, 250);
          } else {
            setIsTriggeredByScan(true);
            setWelcomeContext('scan');
            setIsWelcomeModalOpen(true);
          }
        }
      } catch {}
    };

    initRecord();

    window.addEventListener('hashchange', initRecord);

    return () => {
      window.removeEventListener('hashchange', initRecord);
    };
  }, []);

  // Multi-Stage Geolocation Watcher (fast GPS + network triangulation + honest IP diagnostic)
  const requestGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('⚠️ Este navegador no soporta GPS. Indicá tu esquina manualmente.');
      fetchIpFallbackCoordinates().then((ipCoords) => {
        if (ipCoords) {
          setIpFallbackCoords(ipCoords);
          if (isWithinPuntaAltaArea(ipCoords)) {
            setGpsStatus('⚠️ Sin GPS hardware · Red aproximada en Punta Alta (confirmar esquina).');
          }
        }
      });
      return;
    }

    setGpsStatus('Buscando señal GPS real del dispositivo…');

    // Stage 1: High accuracy GPS hardware
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy || 15);
        const nextCoords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: acc,
          source: acc > 250 ? 'network' : 'gps',
          timestamp: Date.now()
        };
        applyEmergencyCoords(nextCoords);
        setCoords((prev) => (shouldReplaceEmergencyCoords(prev, nextCoords) ? nextCoords : prev));
        saveStoredCoords(nextCoords);
        const zone = describePuntaAltaLocation(nextCoords);
        setGpsStatus(`📍 GPS en vivo (±${acc}m · ${zone})`);
      },
      (err) => {
        // Stage 2: If timeout or unavailable, fallback to device WiFi/cell network geolocation
        if (err.code === 2 || err.code === 3) {
          logSystemEvent({
            level: 'warn',
            category: 'gps',
            source: 'Geolocalización',
            message:
              err.code === 3
                ? 'Timeout al obtener GPS de alta precisión; usando red WiFi/celular'
                : 'Señal satelital GPS no disponible; intentando red WiFi/celular',
            detail: err.message
          });
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const acc = Math.round(pos.coords.accuracy || 120);
              const nextCoords: Coordinates = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: acc,
                source: 'network',
                timestamp: Date.now()
              };
              applyEmergencyCoords(nextCoords);
              setCoords((prev) => (shouldReplaceEmergencyCoords(prev, nextCoords) ? nextCoords : prev));
              saveStoredCoords(nextCoords);
              const zone = describePuntaAltaLocation(nextCoords);
              setGpsStatus(`📍 Ubicación por red móvil/WiFi (±${acc}m · ${zone})`);
            },
            (fallbackErr) => {
              logSystemEvent({
                level: 'error',
                category: 'gps',
                source: 'Geolocalización',
                message: 'Fallo total de GPS y triangulación por red; consultando IP aproximada',
                detail: fallbackErr?.message || `Código ${fallbackErr?.code}`
              });
              // Coarse IP fallback ONLY stored as non-verified diagnostic hint
              fetchIpFallbackCoordinates().then((ipCoords) => {
                if (ipCoords) {
                  setIpFallbackCoords(ipCoords);
                  if (isWithinPuntaAltaArea(ipCoords)) {
                    setGpsStatus('⚠️ Sin GPS satelital · Red aproximada en Punta Alta (no exacta).');
                  } else {
                    setGpsStatus(
                      `⚠️ Sin GPS satelital (${ipCoords.label ? `red detectada en ${ipCoords.label}` : 'ubicación no exacta'}). Activá Ubicación o elegí tu calle.`
                    );
                  }
                } else {
                  setGpsStatus('⚠️ Sin señal GPS en este momento. Verificá tener Ubicación activa o elegí tu calle.');
                }
              });
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 30000
            }
          );
        } else if (err.code === 1) {
          logSystemEvent({
            level: 'error',
            category: 'gps',
            source: 'Geolocalización',
            message: 'Permiso de GPS denegado por el usuario o navegador',
            detail: err.message || 'PERMISSION_DENIED'
          });
          // Permission denied -> record IP diagnostic only, never overwrite GPS or claim verified GPS
          fetchIpFallbackCoordinates().then((ipCoords) => {
            if (ipCoords) {
              setIpFallbackCoords(ipCoords);
            }
            setGpsStatus('⚠️ Permiso GPS bloqueado. Activá Ubicación en tu navegador o elegí tu calle manualmente.');
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000
      }
    );
  };

  // Continuous geolocation watch + auto-refresh when app wakes from background or lacks fresh GPS
  useEffect(() => {
    const timer = setTimeout(() => {
      requestGeolocation();
    }, 350);

    let watchId: number | undefined;
    if ('geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const acc = Math.round(pos.coords.accuracy || 15);
            const nextCoords: Coordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: acc,
              source: acc > 250 ? 'network' : 'gps',
              timestamp: Date.now()
            };
            applyEmergencyCoords(nextCoords);
            setCoords((prev) => (shouldReplaceEmergencyCoords(prev, nextCoords) ? nextCoords : prev));
            saveStoredCoords(nextCoords);
            const zone = describePuntaAltaLocation(nextCoords);
            setGpsStatus(`📍 GPS en vivo (±${acc}m · ${zone})`);
          },
          () => {
            // Keep existing coords if watch temporarily loses signal
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
          }
        );
      } catch {
        // ignore
      }
    }

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        const last = getLastRealGpsCoords(20000);
        if (!last) {
          requestGeolocation();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    const retryTimer = setInterval(() => {
      const curr = emergencyCoordsRef.current;
      const isMissingOrStale =
        !curr ||
        !curr.timestamp ||
        Date.now() - curr.timestamp > 60000;
      if (isMissingOrStale && document.visibilityState === 'visible') {
        requestGeolocation();
      }
    }, 25000);

    return () => {
      clearTimeout(timer);
      clearInterval(retryTimer);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      if (watchId !== undefined && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Synchronize user's private emergency record with Firestore when signed in
  useEffect(() => {
    if (!user) return;
    if (!medicalRecord) {
      loadMedicalRecordFromFirestore(user.uid)
        .then((cloudRec) => {
          if (cloudRec && hasMedicalData(cloudRec)) {
            setMedicalRecord(cloudRec);
            syncEmergencyRecordToWorker(cloudRec);
          }
        })
        .catch(() => {});
    } else if (isFromLink && (!medicalRecord.foto || medicalRecord.foto.length < 3000)) {
      loadMedicalRecordFromFirestore(user.uid)
        .then((cloudRec) => {
          if (
            cloudRec?.foto &&
            cloudRec.foto.startsWith('data:image/') &&
            cloudRec.foto.length > (medicalRecord.foto?.length || 0) + 1000 &&
            recordsMatchSamePerson(medicalRecord, cloudRec)
          ) {
            setMedicalRecord((prev) => {
              if (!prev) return prev;
              const updated = { ...prev, foto: cloudRec.foto };
              syncEmergencyRecordToWorker(updated);
              return updated;
            });
          }
        })
        .catch(() => {});
    } else if (!isFromLink && hasMedicalData(medicalRecord)) {
      // Back up locally saved record & linked keychain ID to Firestore once signed in
      saveMedicalRecordToFirestore(medicalRecord, user.uid).catch(() => {});
    }
  }, [user]);

  const handleRecordUpdated = (updatedRecord: MedicalRecord) => {
    const hadDataBefore = hasMedicalData(medicalRecord);
    setMedicalRecord(updatedRecord);
    syncEmergencyRecordToWorker(updatedRecord);
    if (user) {
      saveMedicalRecordToFirestore(updatedRecord, user.uid);
    }
    if (!hadDataBefore && hasMedicalData(updatedRecord) && !isFromLink) {
      setIsSosModalOpen(false);
      setIsQrModalOpen(false);
      setIsTriggeredByScan(false);
      setWelcomeContext('data_saved');
      setIsWelcomeModalOpen(true);
    }
  };

  const hasData = hasMedicalData(medicalRecord);

  return (
    <div className="min-h-screen text-[#eaf3ff] pb-24 px-3 sm:px-4 max-w-xl sm:max-w-2xl mx-auto selection:bg-[#37c8ff]/30">
      {/* Offline Status & Life-Saving Assurance Banner */}
      <OfflineStatusBanner
        medicalRecord={medicalRecord}
        onOpenSos={() => setIsSosModalOpen(true)}
      />

      {/* Rescuer Emergency Mode: When another person scans the QR keychain, show ONLY the medical rescue sheet */}
      {isFromLink && medicalRecord && !showFullPortal ? (
        <>
          <div className="pt-3 pb-2.5 px-1 flex items-center justify-between gap-2 border-b border-[#162d59]/80 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#061229] border border-cyan-400/70 overflow-hidden shrink-0 shadow-[0_0_12px_rgba(55,200,255,0.2)]">
                <img
                  src="/assets/aistudio/image__2__7d12aee0.png"
                  alt="Logo Vortex ID"
                  className="w-full h-full object-contain translate-y-[7%] scale-[1.52]"
                />
              </div>
              <div className="min-w-0 leading-none">
                <span className="block text-sm font-black font-heading text-white uppercase tracking-wider truncate">
                  Vortex ID · Modo Socorrista
                </span>
                <span className="block text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest mt-0.5 truncate">
                  Protocolo Auxilio · Punta Alta
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFullPortal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-[11px] text-cyan-300 hover:text-white font-semibold shrink-0 transition"
            >
              Ver portal →
            </button>
          </div>

          <ResponderEmergencyView
            record={medicalRecord}
            coords={coords}
            emergencyCoords={emergencyCoords}
            ipFallback={ipFallbackCoords}
            onRequestCoords={requestGeolocation}
            gpsStatus={gpsStatus}
            onOpenPortal={() => setShowFullPortal(true)}
            onOpenInstallGuide={() => setIsInstallModalOpen(true)}
          />
        </>
      ) : (
        <>
          {/* Automatic PWA Install Banner (appears immediately when installable on Android/Chrome or iOS Safari) */}
          {!isInstalled && !dismissedPwaBanner && (isInstallable || isIOS) && (
            <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#0a2d29] to-[#0a1f55] border-2 border-emerald-400/90 shadow-xl flex items-center justify-between gap-2.5 animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400 shrink-0">
                  <Download className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">
                    {typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
                      ? 'Instalá Vortex ID en tu celular'
                      : 'Instalá Vortex ID en tu PC / Laptop'}
                  </p>
                  <p className="text-[11px] text-emerald-200/90 truncate">
                    Acceso directo offline 24hs en 1 clic
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isInstallable) {
                      install();
                    } else {
                      setInstallModalTab('iphone');
                      setIsInstallModalOpen(true);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-green-400 hover:brightness-110 text-gray-950 font-black text-xs shadow-md active:scale-95 transition"
                >
                  {isInstallable ? 'Instalar' : 'Cómo instalar'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedPwaBanner(true)}
                  className="p-1.5 rounded-lg text-emerald-200/70 hover:text-white hover:bg-white/10 transition"
                  aria-label="Ocultar aviso de instalación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Compact Top Command Bar */}
          <Header
            onOpenCommand={() => setIsSystemControlOpen(true)}
            showCommandButton={isAdmin || operatorSessionActive}
          />

          {/* Exclusive Operator Command HUD (Never visible to citizens) */}
          {showOperatorHud && !isFromLink && (
            <div className="my-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-950/80 via-[#161205] to-[#081533] border border-amber-400/60 flex flex-wrap items-center justify-between gap-2 text-xs shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                <span className="font-black text-amber-200 tracking-wide uppercase text-[10px] sm:text-[11px] truncate">
                  Modo Comando · {systemConfig.isMembershipRequired ? 'Bloqueo ON' : 'Prueba Abierta'} · {formatCurrency(systemConfig.monthlyFee)}/mes
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSystemControlOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-[11px] flex items-center gap-1 transition active:scale-95"
                >
                  <Settings className="w-3 h-3" aria-hidden="true" />
                  <span>Control General</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCitizenPreviewMode(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#081533] hover:bg-[#102658] border border-cyan-400/50 text-cyan-200 font-bold text-[11px] flex items-center gap-1 transition"
                  title="Ocultar barra de operador temporalmente para ver la app como un ciudadano"
                >
                  <Eye className="w-3 h-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Vista Ciudadana</span>
                </button>
                {operatorSessionActive && !isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setOperatorSessionActive(false);
                      setCitizenPreviewMode(false);
                      try {
                        sessionStorage.removeItem('vortex_operator_mode_v1');
                      } catch {}
                    }}
                    className="px-2 py-1 rounded-lg bg-black/50 hover:bg-red-950/70 border border-red-400/40 text-red-200 font-bold text-[11px] flex items-center gap-1 transition"
                    title="Cerrar sesión de operador"
                  >
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span className="hidden sm:inline">Bloquear</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {citizenPreviewMode && (isAdmin || operatorSessionActive) && !isFromLink && (
            <div className="my-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCitizenPreviewMode(false)}
                className="px-2.5 py-1 rounded-lg bg-[#07132c] border border-amber-400/40 text-amber-200/90 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
              >
                <ShieldCheck className="w-3 h-3 text-amber-300" aria-hidden="true" />
                <span>Restaurar barra Comando</span>
              </button>
            </div>
          )}

          {/* Sticky Return Bar for Responders who temporarily switched to Portal View */}
          {isFromLink && medicalRecord && (
            <div className="sticky top-2 z-40 my-3 p-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white flex items-center justify-between shadow-2xl border-2 border-white/90 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 animate-ping shrink-0" />
                <span className="text-xs font-black uppercase tracking-wide truncate">
                  Asistiendo a: {medicalRecord.nombre}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPortal(false)}
                className="px-3 py-1.5 bg-white hover:bg-yellow-100 text-red-700 font-black text-xs rounded-xl shadow active:scale-95 transition shrink-0"
              >
                Volver a Ficha SOS
              </button>
            </div>
          )}

          {/* Unlinked Keychain Detected Prompt Banner */}
          {scannedUnlinkedId && (
            <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-amber-950 via-[#1e1b0a] to-[#0d2252] border-2 border-amber-400 shadow-xl flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-xl shrink-0">
                  🏷️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Llavero Físico #{scannedUnlinkedId} Detectado</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">Nuevo</span>
                  </h3>
                  <p className="text-xs text-amber-200/90 mt-0.5 leading-snug">
                    {hasData
                      ? `Detectamos que ya tenés tu ficha médica cargada (${medicalRecord?.nombre}). ¿Querés vincular este llavero físico con 1 clic?`
                      : 'Cargá tu ficha médica para asociarla a este llavero físico en 1 clic.'}
                  </p>
                </div>
              </div>
              {hasData ? (
                <button
                  type="button"
                  onClick={() => {
                    if (medicalRecord) {
                      const updated = linkRecordToKeychain(scannedUnlinkedId, medicalRecord);
                      handleRecordUpdated(updated);
                      setScannedUnlinkedId(null);
                      setIsQrModalOpen(true);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-gray-950 font-bold text-xs shrink-0 shadow-lg active:scale-95 transition"
                >
                  🔗 Vincular ya
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setScannedUnlinkedId(null);
                    document.getElementById('ficha-medica')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 shadow-lg active:scale-95 transition"
                >
                  Completar ficha
                </button>
              )}
            </div>
          )}

          {/* Main SOS Banner: Priority 1 right below compact Top Bar */}
          {!isFromLink && (
            <SosBanner
              onOpenSos={() => setIsSosModalOpen(true)}
              onToggleSpeakPharmacies={handleToggleTopDutyVoice}
              isSpeakingPharmacies={isSpeakingTopDuty}
              closestDutySummary={topDutyClosestSummary}
              spokenSubtitle={topDutySpokenSubtitle}
              onScrollToPharmacies={() => {
                document.getElementById('farmacias')?.scrollIntoView({ behavior: 'smooth' });
              }}
              hasMedicalData={hasData}
              name={medicalRecord?.nombre}
            />
          )}

          {/* Mission Control Console: Guardia activa, ubicación & sistemas operativos */}
          {!isFromLink && (
            <MissionControlConsole
              shiftLabel={shiftLabel}
              locationLabel={headerLocationLabel}
              onScrollToPharmacy={() => {
                document.getElementById('farmacias')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenQrModal={() => setIsQrModalOpen(true)}
              onOpenKeychainModal={() => setIsKeychainModalOpen(true)}
              onScrollToEmergencies={() => {
                document.getElementById('emergencias')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenPushModal={() => setIsPushModalOpen(true)}
              onOpenInstallModal={() => {
                setInstallModalTab('qr');
                setIsInstallModalOpen(true);
              }}
              onOpenWelcome={() => {
                setIsTriggeredByScan(false);
                setWelcomeContext('default');
                setIsWelcomeModalOpen(true);
              }}
              keychainId={medicalRecord?.keychainId}
              hasMedicalData={hasData}
            />
          )}

          {/* Quick-Jump Activation Banner when scanning root URL in Blocked Membership Mode */}
          {!isFromLink && !hasData && systemConfig.isMembershipRequired && !isMembershipUnlocked && (
            <div className="my-3.5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-[#1f1704] to-[#0a1f55] border-2 border-amber-400 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                  🔒 Activación de Membresía ({formatCurrency(systemConfig.monthlyFee)}/mes)
                </span>
                <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                  ¿Querés cargar tu Ficha Médica SOS y descargar tu QR de bloqueo?
                </p>
                <p className="text-[11px] text-amber-100/90">
                  Aboná al Alias <strong className="text-cyan-300 font-mono">{systemConfig.paymentAlias}</strong>, mandá el comprobante por WhatsApp e ingresá tu Código de Alta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('ficha-medica')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:opacity-95 text-black font-black text-xs shrink-0 shadow-md active:scale-95 transition"
              >
                💳 Activar y Cargar Ficha
              </button>
            </div>
          )}

          {/* Weather Alert Widget (SMN Punta Alta) */}
          <WeatherAlertCard />

      {/* Duty Pharmacies with Live Geolocation & Voice Assistant */}
      <PharmacySection
        coords={coords}
        onRequestCoords={requestGeolocation}
        gpsStatus={gpsStatus}
        medicalRecord={medicalRecord}
      />

      {/* Direct Emergency Call Grid (911, 107, 100, 103, HNPB, Hosp. Eva Perón) */}
      <EmergencyCallGrid
        medicalRecord={medicalRecord}
        coords={emergencyCoords}
        ipFallback={ipFallbackCoords}
        onRequestCoords={requestGeolocation}
        gpsStatus={gpsStatus}
      />

      {/* Featured Pharmacy & 24h Transport Services with Real Photos */}
      <ServicesSection
        coords={effectivePharmacyOrigin.coords || coords}
        canManageSponsors={showOperatorHud}
      />

      {/* Ficha de Asistencia Personal:
          Una vez cargada, los datos privados están ocultos para proteger la privacidad.
          Solo se muestra el acceso directo a la Credencial QR y botón para abrir con PIN. */}
      {hasData ? (
        <section className="my-5 p-4 rounded-3xl bg-gradient-to-r from-[#0a1f55] via-[#0b1d46] to-[#07122c] border border-[#37c8ff]/60 shadow-xl shadow-blue-950/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#37c8ff] bg-gradient-to-tr from-blue-600 to-[#37c8ff] text-white flex items-center justify-center shadow-md shadow-blue-900/50 shrink-0"
                  style={{ width: '80px', height: '80px', minWidth: '80px', minHeight: '80px' }}
                >
                  {medicalRecord?.foto ? (
                    <img
                      src={medicalRecord.foto}
                      alt="Foto titular"
                      className="w-full h-full object-cover block"
                      loading="eager"
                    />
                  ) : (
                    <span className="text-3xl">🪪</span>
                  )}
                </div>
                {medicalRecord?.foto && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ficha protegida con PIN
                  </span>
                  {medicalRecord?.sangre && (
                    <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">
                      {medicalRecord.sangre}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold font-heading text-white">
                  MI CREDENCIAL Y QR PARA LLAVERO
                </h3>
                <p className="text-xs text-[#9db6dd]">
                  {medicalRecord?.nombre ? `Titular: ${medicalRecord.nombre}` : 'Datos listos para auxilio'} · Ocultos al público
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Ver / Descargar mi QR</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSosModalOpen(true)}
              className="py-2.5 px-3 rounded-xl bg-[#07122c] hover:bg-[#0f275e] border border-[#37c8ff]/60 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <span>Abrir Ficha SOS</span>
            </button>
          </div>

          {/* Dedicated Physical Keychain Link Action Banner */}
          <div className="mt-3.5 pt-3 border-t border-[#1e3f8f]/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-[#071536] via-[#091b42] to-[#0a1838] border border-amber-500/60 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Llavero Físico (#ID)
                  </span>
                  {medicalRecord?.keychainId ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      #{medicalRecord.keychainId} VINCULADO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Sin asociar
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#9db6dd]">
                  {medicalRecord?.keychainId
                    ? `Enlazado al llavero #${medicalRecord.keychainId}. Quien lo escanee verá tu ficha.`
                    : '¿Compraste un llavero con número impreso? Vinculalo acá en 1 clic.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsKeychainModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{medicalRecord?.keychainId ? 'Gestionar Llavero' : '🔗 Vincular Llavero Físico'}</span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFromLink(true);
                setShowFullPortal(false);
              }}
              className="py-2.5 px-3 rounded-xl bg-[#0d2252] hover:bg-[#133075] border border-[#37c8ff]/40 text-[#37c8ff] hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <span>👁️ Probar vista de socorrista</span>
            </button>

            {!confirmClearRecord ? (
              <button
                type="button"
                onClick={() => setConfirmClearRecord(true)}
                className="py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-950/80 border border-red-500/40 text-red-300 hover:text-red-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>🗑️ Limpiar / Cargar otra persona</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    clearMedicalRecord();
                    setMedicalRecord(null);
                    setConfirmClearRecord(false);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px]"
                >
                  Confirmar borrado
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearRecord(false)}
                  className="py-1.5 px-2.5 rounded-lg bg-black/40 text-gray-200 text-[11px] font-semibold"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <MedicalIdSection
          medicalRecord={medicalRecord}
          onRecordUpdated={(rec) => {
            const hadDataBefore = hasMedicalData(medicalRecord);
            handleRecordUpdated(rec);
            if (hadDataBefore) {
              setIsQrModalOpen(true);
            }
          }}
          onRecordCleared={() => setMedicalRecord(null)}
          onOpenSosModal={() => setIsSosModalOpen(true)}
          onOpenKeychainModal={() => setIsKeychainModalOpen(true)}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          systemConfig={systemConfig}
          isMembershipUnlocked={isMembershipUnlocked}
          onMembershipUnlocked={() => setIsMembershipUnlocked(true)}
          onPreviewDemoSos={() => setIsDemoPreviewOpen(true)}
        />
      )}

      {/* Official Futuristic QR & Install App Banner for Users & Families */}
      {(() => {
        const netlifyOrigin = 'https://proyectososvortexid.netlify.app';
        const activeTargetBase =
          systemConfig.customDomain && systemConfig.customDomain.trim().startsWith('http')
            ? systemConfig.customDomain.trim().replace(/\/+$/, '')
            : netlifyOrigin;
        const bannerQrSrc = '/assets/qr_vortex_id_futurista.png?v=38';

        return (
          <section className="my-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#071739] via-[#07243b] to-[#0a1f55] border-2 border-cyan-400/80 shadow-2xl">
            <div className="flex items-center gap-3.5 w-full">
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(true)}
                className="w-24 h-24 rounded-2xl bg-white p-1.5 border-2 border-cyan-400 shadow-lg shadow-cyan-950/70 shrink-0 hover:scale-105 active:scale-95 transition"
                title="Ampliar y compartir QR Oficial Vortex ID"
              >
                <img
                  src={bannerQrSrc}
                  alt="QR Oficial Vortex ID Futurista"
                  className="w-full h-full object-contain rounded-lg block"
                  referrerPolicy="no-referrer"
                />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  QR Oficial & Instalar App
                </h3>
                <p className="text-xs text-[#9db6dd] mt-0.5 leading-snug">
                  Abre:{' '}
                  <span className="font-mono text-cyan-300 break-all">
                    {activeTargetBase.replace(/^https?:\/\//, '')}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInstallModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-gray-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Ver QR / Instalar App</span>
                  </button>
                  <a
                    href={bannerQrSrc}
                    download="vortex_id_qr_futurista_punta_alta.png"
                    className="px-3 py-2 rounded-xl bg-[#050b1f] hover:bg-[#0d2252] border border-cyan-400/60 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <span>Descargar PNG</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Footer */}
      <footer className="mt-8 mb-6 text-center text-xs text-[#9db6dd] space-y-1">
        <p>
          <strong className="text-[#37c8ff]">VORTEX ID · PUNTA ALTA</strong>
        </p>
        <p>Un solo QR en tu llavero, asistencia inmediata en cualquier emergencia.</p>
        <p className="text-[10px] text-gray-500 pt-2">
          Ante emergencias con riesgo de vida llamar inmediatamente al 107 (Salud) o 911 (Seguridad).
        </p>
      </footer>

      {/* Bottom Floating Navigation (only shown in standard portal view) */}
      <BottomNav
        onOpenSos={() => setIsSosModalOpen(true)}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        hasMedicalData={hasData}
      />
    </>
  )}

      {/* Emergency Dialing HUD / Modal (Guarantees call launches or gives 1-tap dial/copy) */}
      <EmergencyDialerModal
        activeCall={activeCall}
        onClose={closeActiveCall}
      />

      {/* La Ficha Principal: SOS Emergency Medical ID Modal with in-place PIN-protected editor */}
      <MedicalIdModal
        isOpen={isSosModalOpen || isDemoPreviewOpen}
        onClose={() => {
          setIsSosModalOpen(false);
          setIsDemoPreviewOpen(false);
        }}
        record={isDemoPreviewOpen ? SAMPLE_DEMO_RECORD : medicalRecord}
        coords={emergencyCoords}
        ipFallback={ipFallbackCoords}
        gpsStatus={gpsStatus}
        onRequestCoords={requestGeolocation}
        onRecordUpdated={isDemoPreviewOpen ? undefined : handleRecordUpdated}
        onOpenQrModal={isDemoPreviewOpen ? undefined : () => setIsQrModalOpen(true)}
      />

      {/* Mi QR y Credencial de Emergencia Modal (High-res QR Badge, Wallpaper generator, Copy link) */}
      <EmergencyCredentialModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        record={medicalRecord}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenEditForm={() => {
          if (!hasData) {
            setTimeout(() => {
              document.getElementById('ficha-medica')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else {
            setIsSosModalOpen(true);
          }
        }}
        onRecordUpdated={handleRecordUpdated}
        onKeychainUnlinked={(oldId) => {
          if (user) {
            deleteKeychainFromFirestore(oldId);
          }
        }}
      />

      {/* Dedicated Physical Keychain Link Modal */}
      <KeychainLinkModal
        isOpen={isKeychainModalOpen}
        onClose={() => setIsKeychainModalOpen(false)}
        record={medicalRecord}
        onRecordUpdated={handleRecordUpdated}
      />

      {/* Dedicated PWA Install & Distribution Modal Guide */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        initialTab={installModalTab}
        onOpenWelcomePreview={() => {
          setIsTriggeredByScan(false);
          setWelcomeContext('default');
          setIsWelcomeModalOpen(true);
        }}
      />

      {/* Celebratory Welcome & Spoken Onboarding Modal for New Scans, App Install & Data Save */}
      <WelcomeOnboardingModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
        isTriggeredByScan={isTriggeredByScan}
        welcomeContext={welcomeContext}
        systemConfig={systemConfig}
        isMembershipUnlocked={isMembershipUnlocked}
        userName={medicalRecord?.nombre}
        hasMedicalData={hasData}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onStartRegistration={() => {
          setIsWelcomeModalOpen(false);
          // If unconfigured, start 100% empty
          if (!medicalRecord) {
            clearMedicalRecord();
            setMedicalRecord(null);
          }
          // Scroll directly to blank medical ID registration form (or Membership Gate)
          setTimeout(() => {
            const section = document.getElementById('ficha-medica') || document.querySelector('section');
            if (section) {
              section.scrollIntoView({ behavior: 'smooth' });
            }
          }, 150);
        }}
        onExplorePharmacies={() => {
          setIsWelcomeModalOpen(false);
          setTimeout(() => {
            document.getElementById('farmacias')?.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        }}
      />

      {/* Centro de Control General del Sistema (Acceso exclusivo Operador) */}
      <SystemControlModal
        isOpen={isSystemControlOpen}
        onClose={() => setIsSystemControlOpen(false)}
        onConfigSaved={(cfg) => setSystemConfig(cfg)}
        onUnlocked={() => {
          setOperatorSessionActive(true);
          setCitizenPreviewMode(false);
          try {
            sessionStorage.setItem('vortex_operator_mode_v1', '1');
          } catch {}
        }}
      />

      {/* Centro de Notificaciones Push (Emergencias, Farmacias de Turno, Alerta Clima) */}
      <PushAlertsModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        onOpenPharmacySection={() => {
          document.getElementById('farmacias')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </div>
  );
}
