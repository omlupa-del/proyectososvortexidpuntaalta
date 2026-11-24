import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  MapPin,
  Car,
  Navigation,
  Clock,
  CheckCircle2,
  Megaphone,
  Upload,
  ExternalLink,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Save,
  X,
  Share2,
  Pill
} from 'lucide-react';
import {
  FEATURED_PHARMACIES,
  FEATURED_REMISES,
  SPONSOR_CONTACT,
  FeaturedBusiness
} from '../data/featuredSponsors';
import { triggerDirectCall, playChirp } from '../utils/callHandler';
import { getDirectionsUrl, calculateDistanceKm, Coordinates } from '../utils/geo';
import { speakNaturalSpanish, stopVoiceAssistant, buildSinglePharmacySpeech } from '../utils/voiceAssistant';
import {
  FeaturedAdOverride,
  SystemConfig,
  fetchSystemConfig,
  getStoredSystemConfig,
  recoverAdminPin,
  saveSystemConfig,
  verifyAdminPin
} from '../utils/systemConfig';
import { useAuth } from '../context/AuthContext';

interface ServicesSectionProps {
  coords: Coordinates | null;
  canManageSponsors?: boolean;
}

/**
 * Compress a storefront photo with Canvas so it stays crisp (~800px wide, <150KB)
 * and syncs cleanly to both localStorage and Firestore cloud settings.
 */
function compressStorefrontImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxWidth = 800;
        const maxHeight = 520;
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 180000 && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada'));
    };
    img.src = objectUrl;
  });
}

function mergeAdWithOverride(base: FeaturedBusiness, override?: FeaturedAdOverride | null, legacyPhoto?: string): FeaturedBusiness {
  if (!override && !legacyPhoto) return base;
  return {
    ...base,
    name: override?.name?.trim() || base.name,
    badge: override?.badge?.trim() || base.badge,
    tagline: override?.tagline?.trim() || base.tagline,
    description: override?.description?.trim() || base.description,
    address: override?.address?.trim() || base.address,
    hours: override?.hours?.trim() || base.hours,
    phone: override?.phone?.trim() || base.phone,
    directDial: override?.directDial?.trim() || (override?.phone ? override.phone.replace(/\D/g, '') : base.directDial),
    whatsapp: override?.whatsapp !== undefined ? override.whatsapp.trim() : base.whatsapp,
    socialUrl: override?.socialUrl !== undefined ? override.socialUrl.trim() : base.socialUrl,
    socialLabel: override?.socialLabel?.trim() || base.socialLabel,
    image: override?.image?.trim() || legacyPhoto || base.image
  };
}

function buildSocialHref(business: FeaturedBusiness): string {
  const raw = (business.socialUrl || '').trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    return `https://${raw.replace(/^\/+/, '')}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${business.name} Punta Alta Instagram Facebook`
  )}`;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  coords,
  canManageSponsors = false
}) => {
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const showSponsorAdminTrigger = isAdmin || canManageSponsors;

  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => getStoredSystemConfig());
  const [legacyPharmacyPhoto, setLegacyPharmacyPhoto] = useState<string>('');
  const [legacyRemisPhoto, setLegacyRemisPhoto] = useState<string>('');

  // Discrete admin lock & PIN/Recovery state
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState<boolean>(false);
  const [isAdAdminUnlocked, setIsAdAdminUnlocked] = useState<boolean>(false);
  const [verifiedAdminPin, setVerifiedAdminPin] = useState<string>('');
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [showAdminPin, setShowAdminPin] = useState<boolean>(false);
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);
  const [adminPinError, setAdminPinError] = useState<string>('');

  // Forgotten PIN recovery state
  const [showRecoveryMode, setShowRecoveryMode] = useState<boolean>(false);
  const [recoveryIdentity, setRecoveryIdentity] = useState<string>('');
  const [recoveryNewPin, setRecoveryNewPin] = useState<string>('');
  const [showRecoveryPin, setShowRecoveryPin] = useState<boolean>(false);
  const [recoveringPin, setRecoveringPin] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState<string>('');

  // Unlocked ad editor state
  const [editingTarget, setEditingTarget] = useState<'pharmacy' | 'remis'>('pharmacy');
  const [adForm, setAdForm] = useState<FeaturedAdOverride>({});
  const [savingAd, setSavingAd] = useState<boolean>(false);
  const [adSaveStatus, setAdSaveStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string>('');

  const [isSpeakingVeron, setIsSpeakingVeron] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedPharm = localStorage.getItem('vortex_custom_pharmacy_photo');
      if (savedPharm) setLegacyPharmacyPhoto(savedPharm);
      const savedRemis = localStorage.getItem('vortex_custom_remis_photo');
      if (savedRemis) setLegacyRemisPhoto(savedRemis);
    } catch {
      // ignore
    }

    fetchSystemConfig().then((cfg) => {
      setSystemConfig(cfg);
    });

    const handleConfigUpdated = (e: Event) => {
      const detail = (e as CustomEvent<SystemConfig>).detail;
      if (detail) {
        setSystemConfig(detail);
      } else {
        setSystemConfig(getStoredSystemConfig());
      }
    };

    const handleOpenAdAdmin = (e: Event) => {
      const detail = (e as CustomEvent<{ target?: 'pharmacy' | 'remis'; adminPin?: string }>).detail;
      if (detail?.target === 'pharmacy' || detail?.target === 'remis') {
        setEditingTarget(detail.target);
      }
      if (detail?.adminPin) {
        setVerifiedAdminPin(detail.adminPin);
        setIsAdAdminUnlocked(true);
        setShowAdminPinPrompt(false);
      } else {
        setShowAdminPinPrompt(true);
      }
      setAdminPinError('');
      setShowRecoveryMode(false);
      setRecoveryError('');
      setRecoverySuccess('');
    };

    window.addEventListener('vortex_config_updated', handleConfigUpdated);
    window.addEventListener('vortex_open_ad_admin', handleOpenAdAdmin);
    return () => {
      window.removeEventListener('vortex_config_updated', handleConfigUpdated);
      window.removeEventListener('vortex_open_ad_admin', handleOpenAdAdmin);
    };
  }, []);

  const defaultPharmacy = FEATURED_PHARMACIES[0];
  const defaultRemis = FEATURED_REMISES[0];

  const activePharmacy = mergeAdWithOverride(
    defaultPharmacy,
    systemConfig.pharmacyAdOverride,
    legacyPharmacyPhoto
  );
  const activeRemis = mergeAdWithOverride(
    defaultRemis,
    systemConfig.remisAdOverride,
    legacyRemisPhoto
  );

  // Sync editor fields when target changes or panel unlocks
  useEffect(() => {
    if (!isAdAdminUnlocked) return;
    const source = editingTarget === 'pharmacy' ? activePharmacy : activeRemis;
    const override = editingTarget === 'pharmacy' ? systemConfig.pharmacyAdOverride : systemConfig.remisAdOverride;
    setAdForm({
      name: source.name,
      badge: source.badge,
      tagline: source.tagline,
      description: source.description,
      address: source.address,
      hours: source.hours,
      phone: source.phone,
      directDial: source.directDial,
      whatsapp: source.whatsapp || '',
      socialUrl: source.socialUrl || '',
      socialLabel: source.socialLabel || '',
      image: override?.image || ''
    });
    setPhotoUploadError('');
    setAdSaveStatus(null);
  }, [isAdAdminUnlocked, editingTarget]);

  const pharmacyDistKm = coords
    ? calculateDistanceKm(coords.lat, coords.lng, activePharmacy.lat, activePharmacy.lng)
    : null;

  const handleSpeakVeron = () => {
    if (isSpeakingVeron) {
      stopVoiceAssistant();
      setIsSpeakingVeron(false);
      return;
    }

    const text = buildSinglePharmacySpeech(
      {
        id: 'f9',
        name: activePharmacy.name,
        address: activePharmacy.address,
        phones: [activePharmacy.phone],
        lat: activePharmacy.lat,
        lng: activePharmacy.lng
      },
      pharmacyDistKm,
      coords ? 'tu ubicación actual' : 'el centro de Punta Alta'
    );

    setIsSpeakingVeron(true);
    speakNaturalSpanish(
      text,
      0.92,
      () => setIsSpeakingVeron(true),
      () => setIsSpeakingVeron(false),
      () => setIsSpeakingVeron(false)
    );
  };

  const handleToggleSecretTrigger = (target: 'pharmacy' | 'remis') => {
    playChirp('click');
    setEditingTarget(target);
    if (isAdAdminUnlocked) {
      return;
    }
    setShowAdminPinPrompt(true);
    setAdminPinError('');
    setAdminPinInput('');
    setShowRecoveryMode(false);
    setRecoveryError('');
    setRecoverySuccess('');
  };

  const handleVerifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = adminPinInput.trim();
    if (!cleaned) {
      setAdminPinError('Ingresá tu clave única de administrador.');
      return;
    }

    setVerifyingPin(true);
    setAdminPinError('');
    try {
      const res = await verifyAdminPin(cleaned);
      if (res.valid) {
        playChirp('success');
        setVerifiedAdminPin(cleaned);
        setIsAdAdminUnlocked(true);
        setShowAdminPinPrompt(false);
        setAdminPinInput('');
        setShowAdminPin(false);
      } else {
        playChirp('click');
        setAdminPinError(res.error || 'Clave incorrecta. Tocá el ojo para verificar o usá "¿Olvidaste tu clave?".');
      }
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleRecoverPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    const verifiedEmail = isAdmin ? (user?.email || 'omlupa@gmail.com') : null;
    if (!recoveryIdentity.trim() && !verifiedEmail) {
      setRecoveryError('Verificá con Google Admin o ingresá tu correo/WhatsApp de administrador.');
      return;
    }

    setRecoveringPin(true);
    playChirp('click');
    try {
      const res = await recoverAdminPin({
        identity: recoveryIdentity.trim(),
        newPin: recoveryNewPin.trim(),
        verifiedAdminEmail: verifiedEmail
      });
      if (!res.ok || !res.config) {
        setRecoveryError(res.error || 'No se pudo verificar la identidad del administrador.');
        return;
      }

      const nextPin = String(res.adminPin || '1234');
      setSystemConfig(res.config);
      playChirp('success');
      setRecoverySuccess(`✔ Clave única restablecida (${nextPin}). Desbloqueando editor…`);
      setTimeout(() => {
        setVerifiedAdminPin(nextPin);
        setIsAdAdminUnlocked(true);
        setShowAdminPinPrompt(false);
        setShowRecoveryMode(false);
        setRecoveryIdentity('');
        setRecoveryNewPin('');
        setRecoverySuccess('');
      }, 950);
    } finally {
      setRecoveringPin(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploadError('');
    try {
      const compressed = await compressStorefrontImage(file);
      setAdForm((prev) => ({ ...prev, image: compressed }));
      playChirp('success');
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : 'Error al procesar la foto.');
    }
  };

  const handleSaveAdChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAd(true);
    setAdSaveStatus(null);
    playChirp('click');

    const cleanPhone = (adForm.phone || '').trim();
    const cleanWhatsapp = (adForm.whatsapp || '').trim();
    const cleanSocialUrl = (adForm.socialUrl || '').trim();
    const cleanSocialLabel = (adForm.socialLabel || '').trim();
    const cleanImage = (adForm.image || '').trim();

    const overridePayload: FeaturedAdOverride = {
      name: (adForm.name || '').trim() || undefined,
      badge: (adForm.badge || '').trim() || undefined,
      tagline: (adForm.tagline || '').trim() || undefined,
      description: (adForm.description || '').trim() || undefined,
      address: (adForm.address || '').trim() || undefined,
      hours: (adForm.hours || '').trim() || undefined,
      phone: cleanPhone || undefined,
      directDial: cleanPhone ? cleanPhone.replace(/\D/g, '') : undefined,
      whatsapp: cleanWhatsapp,
      socialUrl: cleanSocialUrl,
      socialLabel: cleanSocialLabel || undefined,
      image: cleanImage || undefined
    };

    try {
      const patch: Partial<SystemConfig> =
        editingTarget === 'pharmacy'
          ? { pharmacyAdOverride: overridePayload }
          : { remisAdOverride: overridePayload };

      if (editingTarget === 'pharmacy') {
        if (cleanImage) {
          localStorage.setItem('vortex_custom_pharmacy_photo', cleanImage);
          setLegacyPharmacyPhoto(cleanImage);
        } else {
          localStorage.removeItem('vortex_custom_pharmacy_photo');
          setLegacyPharmacyPhoto('');
        }
      } else {
        if (cleanImage) {
          localStorage.setItem('vortex_custom_remis_photo', cleanImage);
          setLegacyRemisPhoto(cleanImage);
        } else {
          localStorage.removeItem('vortex_custom_remis_photo');
          setLegacyRemisPhoto('');
        }
      }

      const result = await saveSystemConfig(patch, verifiedAdminPin);
      setSystemConfig(result.config);

      if (result.ok) {
        playChirp('success');
        setAdSaveStatus({
          ok: true,
          msg: result.syncedToCloud
            ? '✔ Publicidad actualizada y publicada en la nube para todos los celulares.'
            : '✔ Publicidad guardada localmente. (Conectá Google Admin si querés publicarla a todos los celulares en Netlify).'
        });
      } else {
        setAdSaveStatus({
          ok: false,
          msg: result.error || 'No se pudo sincronizar la publicidad.'
        });
      }
    } catch {
      setAdSaveStatus({ ok: false, msg: 'Error al guardar los cambios de publicidad.' });
    } finally {
      setSavingAd(false);
    }
  };

  const handleResetAdToOfficial = async () => {
    setSavingAd(true);
    setAdSaveStatus(null);
    playChirp('click');

    try {
      if (editingTarget === 'pharmacy') {
        localStorage.removeItem('vortex_custom_pharmacy_photo');
        setLegacyPharmacyPhoto('');
      } else {
        localStorage.removeItem('vortex_custom_remis_photo');
        setLegacyRemisPhoto('');
      }

      const patch: Partial<SystemConfig> =
        editingTarget === 'pharmacy'
          ? { pharmacyAdOverride: null }
          : { remisAdOverride: null };

      const result = await saveSystemConfig(patch, verifiedAdminPin);
      setSystemConfig(result.config);

      const base = editingTarget === 'pharmacy' ? defaultPharmacy : defaultRemis;
      setAdForm({
        name: base.name,
        badge: base.badge,
        tagline: base.tagline,
        description: base.description,
        address: base.address,
        hours: base.hours,
        phone: base.phone,
        directDial: base.directDial,
        whatsapp: base.whatsapp || '',
        socialUrl: base.socialUrl || '',
        socialLabel: base.socialLabel || '',
        image: ''
      });
      playChirp('success');
      setAdSaveStatus({ ok: true, msg: '✔ Se restauró la publicidad oficial original.' });
    } finally {
      setSavingAd(false);
    }
  };

  const sponsorWhatsappHref = `https://wa.me/${SPONSOR_CONTACT.whatsapp}?text=${encodeURIComponent(
    'Hola! Me comunico desde Vortex ID Punta Alta. Me gustaría recibir información para publicitar mi comercio/servicio en la aplicación.'
  )}`;

  const previewEditPhoto =
    adForm.image ||
    (editingTarget === 'pharmacy' ? defaultPharmacy.image : defaultRemis.image);

  return (
    <div className="space-y-4 my-5">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#8db4f0] font-semibold">
          Sponsors Esenciales · Punta Alta
        </span>
        <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
          Comercios Adheridos
        </span>
      </div>

      {/* 1. FARMACIA DESTACADA (Compact Aerospace Card) */}
      <section
        id="salud"
        className="relative rounded-2xl bg-[#060d20] border border-[#1a3366] shadow-xl overflow-hidden transition-colors"
      >
        {/* Top Accent Bar & Precision Corner Reticles */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400/80 via-[#37c8ff]/80 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-sm" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/70 rounded-br-sm" />

        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Compact Top Split Header: Thumbnail + Business Identity */}
          <div className="flex items-start gap-3">
            <a
              href={activePharmacy.streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-xl overflow-hidden border border-[#24478a] bg-black shrink-0 group"
              title="Ver fachada en Google Maps"
            >
              <img
                src={activePharmacy.image}
                alt={`Fachada de ${activePharmacy.name} en ${activePharmacy.address}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 border border-white/30 text-[9px] font-mono text-cyan-300 flex items-center gap-0.5">
                <ExternalLink className="w-2.5 h-2.5" />
                Maps
              </span>
            </a>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider truncate">
                  <Pill className="w-3 h-3 shrink-0" />
                  <span className="truncate">Farmacia Destacada</span>
                </span>

                {showSponsorAdminTrigger && (
                  <button
                    type="button"
                    onClick={() => handleToggleSecretTrigger('pharmacy')}
                    aria-label="Administrar publicidad farmacia"
                    title="Administrar sponsor"
                    className={`p-1 rounded-lg transition-all duration-200 shrink-0 ${
                      isAdAdminUnlocked && editingTarget === 'pharmacy'
                        ? 'bg-cyan-500/20 border border-cyan-400/70 opacity-100 text-cyan-300'
                        : 'bg-transparent opacity-60 hover:opacity-100 focus:opacity-100 text-[#7ca4e8]'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-wide text-white leading-tight mt-1 truncate">
                {activePharmacy.name}
              </h2>
              <p className="text-xs text-[#37c8ff] font-medium truncate">
                {activePharmacy.tagline}
              </p>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1.5 text-[11px] text-[#b4c8ea]">
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">{activePharmacy.address}</span>
                </span>
                {pharmacyDistKm != null && (
                  <span className="font-mono tabular-nums text-emerald-300 font-bold">
                    · a {pharmacyDistKm < 1 ? `${Math.round(pharmacyDistKm * 1000)} m` : `${pharmacyDistKm.toFixed(1).replace('.', ',')} km`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Concise Description + Compact Highlights */}
          <p className="text-xs text-[#9db6dd] leading-relaxed line-clamp-2">
            {activePharmacy.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-[#08132c] border border-[#162d59] text-[11px] text-[#9db6dd]">
            <span className="inline-flex items-center gap-1 text-white font-mono tabular-nums font-bold">
              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
              {activePharmacy.phone}
            </span>
            <span className="text-[#35538f]" aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1 truncate flex-1 min-w-[160px]">
              <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{activePharmacy.hours}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8ba6d6]">
            {activePharmacy.highlights.slice(0, 3).map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{h}</span>
              </span>
            ))}
          </div>

          {/* Compact Action Bar with Redes Sociales Button */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => triggerDirectCall(activePharmacy.directDial || activePharmacy.phone, activePharmacy.name, 'pharmacy')}
              className="sm:flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Llamar</span>
            </button>

            {activePharmacy.whatsapp && (
              <a
                href={`https://wa.me/${activePharmacy.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sm:flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

            <a
              href={buildSocialHref(activePharmacy)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir redes sociales de Farmacia Verón"
              className="min-h-[40px] py-2 px-3 rounded-xl bg-[#101c42] hover:bg-[#192c66] border border-fuchsia-400/55 text-fuchsia-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-fuchsia-300" />
              <span className="truncate">{activePharmacy.socialLabel || 'Redes Sociales'}</span>
            </a>

            <div className="flex items-center gap-2 col-span-1 sm:col-span-auto">
              <a
                href={getDirectionsUrl({
                  name: activePharmacy.name,
                  address: activePharmacy.address,
                  lat: activePharmacy.lat,
                  lng: activePharmacy.lng
                }, coords)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff]/60 text-[#37c8ff] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Mapa</span>
              </a>

              <button
                type="button"
                onClick={handleSpeakVeron}
                className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
                  isSpeakingVeron
                    ? 'bg-red-600 text-white border border-red-400'
                    : 'bg-[#08132c] hover:bg-[#10244d] border border-[#24478a] text-cyan-300 hover:text-white'
                }`}
                aria-label={isSpeakingVeron ? 'Silenciar voz' : 'Escuchar dirección y teléfono'}
                title={isSpeakingVeron ? 'Silenciar voz' : 'Escuchar dirección y teléfono'}
              >
                {isSpeakingVeron ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REMIS CENTRO (Compact Aerospace Card) */}
      <section
        id="transporte"
        className="relative rounded-2xl bg-[#060d20] border border-[#1a3366] shadow-xl overflow-hidden transition-colors"
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-400/80 via-orange-400/70 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400/70 rounded-tl-sm" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-400/70 rounded-br-sm" />

        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Compact Top Split Header */}
          <div className="flex items-start gap-3">
            <a
              href={activeRemis.streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-20 h-20 sm:w-28 sm:h-24 rounded-xl overflow-hidden border border-amber-500/40 bg-black shrink-0 group"
              title="Ver fachada en Google Maps"
            >
              <img
                src={activeRemis.image}
                alt={`Fachada de ${activeRemis.name} en ${activeRemis.address}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 border border-white/30 text-[9px] font-mono text-amber-300 flex items-center gap-0.5">
                <ExternalLink className="w-2.5 h-2.5" />
                Maps
              </span>
            </a>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider truncate">
                  <Car className="w-3 h-3 shrink-0" />
                  <span className="truncate">Remisería 24 Hs</span>
                </span>

                {showSponsorAdminTrigger && (
                  <button
                    type="button"
                    onClick={() => handleToggleSecretTrigger('remis')}
                    aria-label="Administrar publicidad remis"
                    title="Administrar sponsor"
                    className={`p-1 rounded-lg transition-all duration-200 shrink-0 ${
                      isAdAdminUnlocked && editingTarget === 'remis'
                        ? 'bg-amber-500/20 border border-amber-400/70 opacity-100 text-amber-300'
                        : 'bg-transparent opacity-60 hover:opacity-100 focus:opacity-100 text-amber-300/70'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-wide text-white leading-tight mt-1 truncate">
                {activeRemis.name}
              </h2>
              <p className="text-xs text-amber-300 font-medium truncate">
                {activeRemis.tagline}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-[#b4c8ea]">
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{activeRemis.address}</span>
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#9db6dd] leading-relaxed line-clamp-2">
            {activeRemis.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-[#08132c] border border-[#162d59] text-[11px] text-[#9db6dd]">
            <span className="inline-flex items-center gap-1 text-white font-mono tabular-nums font-bold">
              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
              {activeRemis.phone}
            </span>
            <span className="text-[#35538f]" aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1 truncate flex-1 min-w-[160px] text-amber-200/90">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{activeRemis.hours}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8ba6d6]">
            {activeRemis.highlights.slice(0, 3).map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{h}</span>
              </span>
            ))}
          </div>

          {/* Compact Action Bar with Redes Sociales Button */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => triggerDirectCall(activeRemis.directDial || activeRemis.phone, activeRemis.name, 'service')}
              className="sm:flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Pedir remis</span>
            </button>

            {activeRemis.whatsapp && (
              <a
                href={`https://wa.me/${activeRemis.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sm:flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

            <a
              href={buildSocialHref(activeRemis)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir redes sociales de Remis Centro 24 Hs"
              className="min-h-[40px] py-2 px-3 rounded-xl bg-[#101c42] hover:bg-[#192c66] border border-fuchsia-400/55 text-fuchsia-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-fuchsia-300" />
              <span className="truncate">{activeRemis.socialLabel || 'Redes Sociales'}</span>
            </a>

            <a
              href={getDirectionsUrl({
                name: activeRemis.name,
                address: activeRemis.address,
                lat: activeRemis.lat,
                lng: activeRemis.lng
              }, coords)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] py-2 px-3 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff]/60 text-[#37c8ff] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Mapa</span>
            </a>
          </div>
        </div>
      </section>

      {/* 3. COMPACT BUSINESS SPONSORSHIP INVITATION BAR */}
      <div className="px-4 py-3.5 rounded-2xl bg-[#060d20] border border-[#1a3366] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[#37c8ff] text-[10px] font-mono font-bold uppercase tracking-wider">
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            <span>Espacio Comercial · Punta Alta</span>
          </div>
          <h3 className="text-sm font-bold font-heading text-white leading-snug">
            {SPONSOR_CONTACT.title}
          </h3>
        </div>
        <a
          href={sponsorWhatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#0a1f55] hover:bg-[#122e7a] border border-[#37c8ff]/70 text-white font-bold text-xs transition active:scale-95"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>Publicitar comercio</span>
        </a>
      </div>

      {/* Modal centrado de clave única, recuperación y edición de Publicidad (Farmacia y Remís) */}
      {(showAdminPinPrompt || isAdAdminUnlocked) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Administración de Sponsors · Vortex ID"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#040a1b] border-2 border-cyan-400/70 shadow-2xl shadow-blue-950 p-4 sm:p-5 space-y-3">
            {showAdminPinPrompt && !isAdAdminUnlocked && (
              <div className="space-y-3">
                {!showRecoveryMode ? (
                  <form onSubmit={handleVerifyPinSubmit} className="space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
                      <span className="text-xs sm:text-sm font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wide">
                        <Lock className="w-4 h-4" />
                        <span>Clave de Administrador · Sponsors ({editingTarget === 'remis' ? 'Remís' : 'Farmacia'})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAdminPinPrompt(false)}
                        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                        aria-label="Cerrar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[160px]">
                        <input
                          type={showAdminPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={8}
                          value={adminPinInput}
                          onChange={(e) => {
                            setAdminPinInput(e.target.value);
                            if (adminPinError) setAdminPinError('');
                          }}
                          placeholder="Clave única..."
                          className="w-full py-2.5 pl-3 pr-10 rounded-xl bg-[#0a1838] border border-cyan-500/50 text-sm text-white font-mono tracking-widest text-center focus:outline-none focus:border-cyan-300"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPin((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-cyan-300 hover:text-white hover:bg-white/10 transition"
                          aria-label={showAdminPin ? 'Ocultar clave' : 'Ver clave'}
                          title={showAdminPin ? 'Ocultar clave' : 'Ver clave'}
                        >
                          {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={verifyingPin}
                        className="py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm transition active:scale-95 disabled:opacity-50"
                      >
                        {verifyingPin ? 'Verificando…' : 'Ingresar'}
                      </button>
                    </div>

                    {adminPinError && (
                      <p className="text-xs text-red-400 font-semibold">{adminPinError}</p>
                    )}

                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          playChirp('click');
                          setAdminPinError('');
                          setRecoveryError('');
                          setRecoverySuccess('');
                          setShowRecoveryMode(true);
                        }}
                        className="text-xs text-cyan-300 hover:text-white underline underline-offset-4 flex items-center gap-1 transition"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>¿Olvidaste tu clave? Recuperar</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRecoverPinSubmit} className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
                      <span className="text-xs sm:text-sm font-black text-cyan-300 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" />
                        <span>Recuperar Clave Única</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRecoveryMode(false);
                            setRecoveryError('');
                            setRecoverySuccess('');
                          }}
                          className="text-xs text-gray-300 hover:text-white"
                        >
                          ← Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAdminPinPrompt(false)}
                          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
                          aria-label="Cerrar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0a1838] border border-cyan-500/30 flex items-center justify-between gap-2 flex-wrap">
                      {isAdmin ? (
                        <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Admin verificado ({user?.email})</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[11px] text-cyan-200">
                            Verificación rápida con tu Google Admin:
                          </span>
                          <button
                            type="button"
                            onClick={() => signInWithGoogle()}
                            className="px-2.5 py-1 rounded-lg bg-white text-gray-950 font-black text-[11px] hover:bg-gray-200 transition"
                          >
                            Verificar Google Admin
                          </button>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={recoveryIdentity}
                        onChange={(e) => {
                          setRecoveryIdentity(e.target.value);
                          if (recoveryError) setRecoveryError('');
                        }}
                        placeholder={isAdmin ? (user?.email || 'omlupa@gmail.com') : 'Correo o WhatsApp admin'}
                        className="w-full py-2 px-3 rounded-xl bg-[#0a1838] border border-[#1e3f8f] text-xs text-white focus:outline-none focus:border-cyan-400"
                      />

                      <div className="relative">
                        <input
                          type={showRecoveryPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={8}
                          value={recoveryNewPin}
                          onChange={(e) => {
                            setRecoveryNewPin(e.target.value);
                            if (recoveryError) setRecoveryError('');
                          }}
                          placeholder="Nueva clave (vacío = 1234)"
                          className="w-full py-2 pl-3 pr-9 rounded-xl bg-[#0a1838] border border-[#1e3f8f] text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecoveryPin((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-cyan-300 hover:text-white"
                          aria-label={showRecoveryPin ? 'Ocultar nueva clave' : 'Ver nueva clave'}
                        >
                          {showRecoveryPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {recoveryError && (
                      <p className="text-[11px] text-red-400 font-semibold">{recoveryError}</p>
                    )}
                    {recoverySuccess && (
                      <p className="text-[11px] text-emerald-300 font-bold">{recoverySuccess}</p>
                    )}

                    <button
                      type="submit"
                      disabled={recoveringPin}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs transition active:scale-95 disabled:opacity-50"
                    >
                      {recoveringPin ? 'Restableciendo…' : 'Restablecer Clave y Entrar'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {isAdAdminUnlocked && (
              <form onSubmit={handleSaveAdChanges} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-cyan-500/30 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-200">
                      Modo Admin · Editar Sponsors Destacados
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChirp('click');
                      setIsAdAdminUnlocked(false);
                      setShowAdminPinPrompt(false);
                      setVerifiedAdminPin('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-500/60 text-[11px] font-bold text-red-200 flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Cerrar y Bloquear</span>
                  </button>
                </div>

                {/* Selector de aviso a editar */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTarget('pharmacy')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      editingTarget === 'pharmacy'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-[#07122c] border-[#1e3f8f] text-gray-400 hover:text-white'
                    }`}
                  >
                    💊 Farmacia Publicitada
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTarget('remis')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      editingTarget === 'remis'
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-[#07122c] border-[#1e3f8f] text-gray-400 hover:text-white'
                    }`}
                  >
                    🚕 Remís Publicitado
                  </button>
                </div>

                {/* Subir / cambiar foto de fachada */}
                <div className="p-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] flex flex-col sm:flex-row items-center gap-3">
                  <img
                    src={previewEditPhoto}
                    alt="Vista previa de fachada"
                    className="w-24 h-16 rounded-lg object-cover border border-cyan-500/40 shrink-0"
                  />
                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Cambiar foto de fachada</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {adForm.image && (
                        <button
                          type="button"
                          onClick={() => setAdForm((prev) => ({ ...prev, image: '' }))}
                          className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-gray-600 text-[11px] text-gray-300 hover:text-white"
                        >
                          Usar foto oficial
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9db6dd]">
                      La foto se optimiza automáticamente para cargar rápido en celulares y en Netlify.
                    </p>
                    {photoUploadError && (
                      <p className="text-[11px] text-red-400 font-bold">{photoUploadError}</p>
                    )}
                  </div>
                </div>

                {/* Campos editables de la publicidad */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Nombre del comercio:
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={adForm.name || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Etiqueta superior (Badge):
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      value={adForm.badge || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, badge: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Subtítulo / Eslogan:
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={adForm.tagline || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, tagline: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Descripción comercial:
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={adForm.description || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Dirección:
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={adForm.address || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Horarios de atención:
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={adForm.hours || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, hours: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Teléfono visible:
                    </label>
                    <input
                      type="text"
                      maxLength={48}
                      value={adForm.phone || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      WhatsApp (ej: 5492932427979):
                    </label>
                    <input
                      type="text"
                      maxLength={48}
                      value={adForm.whatsapp || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Link Red Social (Instagram / Facebook):
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="https://instagram.com/..."
                      value={adForm.socialUrl || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, socialUrl: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                      Texto botón redes:
                    </label>
                    <input
                      type="text"
                      maxLength={48}
                      placeholder="Ej: Instagram / Redes Sociales"
                      value={adForm.socialLabel || ''}
                      onChange={(e) => setAdForm((prev) => ({ ...prev, socialLabel: e.target.value }))}
                      className="w-full py-2 px-3 rounded-xl bg-[#07122c] border border-[#1e3f8f] text-white"
                    />
                  </div>
                </div>

                {/* Estado nube Netlify */}
                {!isAdmin && (
                  <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/40 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <span className="text-amber-200">
                      Para que esta publicidad modificada la vean todos los celulares en Netlify:
                    </span>
                    <button
                      type="button"
                      onClick={() => signInWithGoogle()}
                      className="px-2.5 py-1 rounded-lg bg-white text-gray-950 font-black text-[11px] hover:bg-gray-200 transition"
                    >
                      Conectar Google Admin
                    </button>
                  </div>
                )}

                {adSaveStatus && (
                  <p
                    className={`text-xs font-bold rounded-xl p-2.5 border ${
                      adSaveStatus.ok
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                        : 'bg-red-950/60 border-red-500/50 text-red-300'
                    }`}
                  >
                    {adSaveStatus.msg}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingAd}
                    onClick={handleResetAdToOfficial}
                    className="py-2 px-3 rounded-xl bg-[#07122c] hover:bg-red-950/50 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar oficial</span>
                  </button>

                  <button
                    type="submit"
                    disabled={savingAd}
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-gray-950 font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingAd ? 'Guardando…' : 'Guardar Publicidad'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
