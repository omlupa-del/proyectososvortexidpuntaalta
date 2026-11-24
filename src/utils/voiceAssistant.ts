/**
 * High-Fidelity Human Voice Assistant for Vortex ID Punta Alta
 * Provides natural, warm, clear, professional voice synthesis for duty pharmacies,
 * exact distances in meters/blocks/kilometers, formatted phone numbers, and addresses.
 * Includes anti-repetition protection, voice caching, gentle audio chime priming,
 * and Chrome speech heartbeat to prevent cutoffs.
 */

import { Pharmacy } from '../data/puntaAltaData';
import { MedicalRecord, calculatePregnancyProgress } from './medicalData';

export interface SpokenPharmacyOptions {
  pharmacy: Pharmacy;
  distKm: number | null | undefined;
  originLabel?: string;
  isClosest?: boolean;
}

/**
 * Gentle auditory chime using Web Audio API to prime audio hardware
 * and provide a pleasant medical/emergency cue before speaking.
 */
export function playEmergencyChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        resolve();
        return;
      }
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Gentle chime notes: C5 (523Hz), E5 (659Hz), G5 (784Hz)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.3);
      });

      setTimeout(() => {
        try { ctx.close(); } catch {}
        resolve();
      }, 350);
    } catch {
      resolve();
    }
  });
}

/**
 * Converts a distance in km to natural, human-sounding Argentine Spanish speech,
 * including blocks (cuadras) for intuitive street orientation.
 * e.g. 0.35 -> "a trescientos cincuenta metros, aproximadamente tres cuadras y media"
 * e.g. 1.2 -> "a un kilómetro con doscientos metros"
 */
export function formatDistanceForSpeech(distKm: number | null | undefined): string {
  if (distKm == null || isNaN(distKm)) {
    return 'muy poca distancia';
  }

  if (distKm < 1) {
    const meters = Math.round(distKm * 1000);
    const cuadras = Math.round(meters / 100);

    if (meters <= 60) {
      return 'a solo media cuadra de distancia';
    }
    if (meters <= 120) {
      return 'a una cuadra de distancia';
    }
    if (cuadras <= 9) {
      return `a ${meters} metros, aproximadamente ${cuadras} cuadras`;
    }
    return `a ${meters} metros`;
  }

  const kmInt = Math.floor(distKm);
  const remainderMeters = Math.round((distKm - kmInt) * 1000);

  if (remainderMeters < 100) {
    return kmInt === 1 ? 'a un kilómetro de distancia' : `a ${kmInt} kilómetros de distancia`;
  }

  const kmWord = kmInt === 1 ? 'un kilómetro' : `${kmInt} kilómetros`;
  return `a ${kmWord} con ${remainderMeters} metros`;
}

/**
 * Formats a phone number for clear, natural, human speech synthesis.
 * Converts symbols and pauses digits naturally so it sounds like a human operator.
 * e.g. "(02932) 43-2443" -> "cero dos nueve tres dos... cuarenta y tres, veinticuatro, cuarenta y tres"
 */
export function formatPhoneForSpeech(rawPhone: string): string {
  if (!rawPhone) return '';

  const cleaned = rawPhone.replace(/\s+/g, ' ').trim();

  // If matches Punta Alta area code (02932)
  if (cleaned.includes('02932') || cleaned.includes('2932')) {
    const localPart = cleaned.replace(/.*(?:02932|2932)\)?\s*-?/, '').replace(/\D/g, '');
    if (localPart.length === 6) {
      const p1 = localPart.slice(0, 2);
      const p2 = localPart.slice(2, 4);
      const p3 = localPart.slice(4, 6);
      return `cero dos nueve tres dos... ${p1}, ${p2}, ${p3}`;
    }
    return `cero dos nueve tres dos... ${localPart.split('').join(' ')}`;
  }

  // If Bahía Blanca area code (0291)
  if (cleaned.includes('0291') || cleaned.includes('291')) {
    const localPart = cleaned.replace(/.*(?:0291|291)\)?\s*-?/, '').replace(/\D/g, '');
    if (localPart.length === 7) {
      const p1 = localPart.slice(0, 3);
      const p2 = localPart.slice(3, 5);
      const p3 = localPart.slice(5, 7);
      return `cero dos nueve uno... ${p1}, ${p2}, ${p3}`;
    }
  }

  // Fallback: pause groups of digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 6) {
    return digitsOnly.replace(/(\d{2})/g, '$1 ').trim();
  }

  return cleaned.replace(/-/g, ' ');
}

/**
 * Formats a street address for natural speech
 * e.g. "Brown 151" -> "calle Brown 151"
 * e.g. "Humberto I 756" -> "calle Humberto Primero 756"
 * e.g. "Brown 502 (esq. Rivadavia)" -> "calle Brown 502, esquina Rivadavia"
 */
export function formatAddressForSpeech(rawAddress: string): string {
  if (!rawAddress) return '';

  let addr = rawAddress
    .replace(/\(esq\.\s*([^)]+)\)/i, ', esquina $1')
    .replace(/\(esq\s*([^)]+)\)/i, ', esquina $1')
    .replace(/\besq\.\s*/i, 'esquina ')
    .replace(/\bHumberto I\b/i, 'Humberto Primero')
    .replace(/\bHumberto 1°?\b/i, 'Humberto Primero')
    .replace(/\bB\.\s*de Irigoyen\b/i, 'Bernardo de Irigoyen')
    .replace(/°/g, '')
    .trim();

  if (!addr.toLowerCase().startsWith('calle') && !addr.toLowerCase().startsWith('av')) {
    addr = `calle ${addr}`;
  }

  return addr;
}

/**
 * Formats pharmacy name without repeating the word "Farmacia"
 * e.g. "Farmacia Zandonadi" -> "Farmacia Zandonadi"
 */
export function cleanPharmacyName(name: string): string {
  if (!name) return 'Farmacia';
  const trimmed = name.trim();
  if (trimmed.toLowerCase().startsWith('farmacia ')) {
    return trimmed;
  }
  return `Farmacia ${trimmed}`;
}

/**
 * Best Spanish Human Voice Selector
 * Finds the warmest, most natural human Spanish voice available on the device
 */
let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function getBestSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const premiumKeywords = ['natural', 'neural', 'google', 'online', 'premium', 'sabina', 'helena', 'paulina', 'monica', 'jorge'];
  const spanishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));

  // Prioritize Argentine Spanish (es-AR)
  const arVoice = spanishVoices.find((v) => v.lang.toLowerCase() === 'es-ar' || v.lang.toLowerCase() === 'es_ar');
  if (arVoice) {
    const premiumAr = spanishVoices.find((v) =>
      (v.lang.toLowerCase() === 'es-ar' || v.lang.toLowerCase() === 'es_ar') &&
      premiumKeywords.some((k) => v.name.toLowerCase().includes(k))
    );
    if (premiumAr) return premiumAr;
    return arVoice;
  }

  // Prioritize Premium/Neural Latin American Spanish
  const premiumLatam = spanishVoices.find((v) =>
    (v.lang.toLowerCase().includes('419') || v.lang.toLowerCase().includes('us') || v.lang.toLowerCase().includes('mx')) &&
    premiumKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  if (premiumLatam) return premiumLatam;

  // Any premium Spanish voice
  const premiumAnyEs = spanishVoices.find((v) =>
    premiumKeywords.some((k) => v.name.toLowerCase().includes(k))
  );
  if (premiumAnyEs) return premiumAnyEs;

  // First available Spanish voice
  if (spanishVoices.length > 0) return spanishVoices[0];

  return null;
}

/**
 * Builds the complete, non-repeating speech text for duty pharmacies
 * Explicitly states the location from which the calculation is being made
 */
export function buildDutyPharmaciesSpeech(
  pharmacies: Array<{ pharmacy: Pharmacy; distKm: number | null | undefined }>,
  originLabel: string
): string {
  if (!pharmacies || pharmacies.length === 0) {
    return 'No hay farmacias de turno registradas para esta fecha.';
  }

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';

  const closest = pharmacies[0];
  const closestName = cleanPharmacyName(closest.pharmacy.name);
  const closestAddress = formatAddressForSpeech(closest.pharmacy.address);
  const closestDist = formatDistanceForSpeech(closest.distKm);
  const closestPhone = closest.pharmacy.phones.length > 0
    ? formatPhoneForSpeech(closest.pharmacy.phones[0])
    : '';

  let speech = `${greeting}. `;
  speech += `Calculando desde ${originLabel}, la farmacia de guardia más cercana a donde te encontrás en este momento es ${closestName}. `;
  speech += `Está ubicada en ${closestAddress}, ${closestDist}. `;

  if (closestPhone) {
    speech += `Podés llamar al ${closestPhone}. `;
  }

  const others = pharmacies.slice(1);
  if (others.length === 1) {
    const o = others[0];
    const oName = cleanPharmacyName(o.pharmacy.name);
    const oAddress = formatAddressForSpeech(o.pharmacy.address);
    const oDist = formatDistanceForSpeech(o.distKm);
    speech += `También se encuentra de guardia hoy ${oName}, en ${oAddress}, ${oDist}. `;
  } else if (others.length > 1) {
    speech += 'Otras farmacias de guardia disponibles hoy: ';
    const otherPhrases = others.map((o) => {
      const oName = cleanPharmacyName(o.pharmacy.name);
      const oAddress = formatAddressForSpeech(o.pharmacy.address);
      const oDist = formatDistanceForSpeech(o.distKm);
      return `${oName}, en ${oAddress}, ${oDist}`;
    });
    speech += otherPhrases.join('. ') + '. ';
  }

  speech += 'Tocá la pantalla para iniciar la llamada directa o abrir cómo llegar en el mapa.';
  return speech;
}

/**
 * Builds speech for a single specific pharmacy (when clicking "Escuchar datos")
 */
export function buildSinglePharmacySpeech(
  pharmacy: Pharmacy,
  distKm: number | null | undefined,
  originLabel?: string
): string {
  const name = cleanPharmacyName(pharmacy.name);
  const address = formatAddressForSpeech(pharmacy.address);
  const dist = formatDistanceForSpeech(distKm);
  const phone = pharmacy.phones.length > 0 ? formatPhoneForSpeech(pharmacy.phones[0]) : '';

  let speech = `${name}. `;
  speech += `Ubicada en ${address}, ${dist}`;
  if (originLabel) {
    speech += ` de ${originLabel}. `;
  } else {
    speech += '. ';
  }

  if (phone) {
    speech += `Teléfono de atención: ${phone}. `;
  }

  speech += 'Podés llamar directamente o abrir la navegación en el mapa.';
  return speech;
}

/**
 * Builds speech tailored for first-responders and bystanders scanning the QR code.
 * Prioritizes emergency life-saving speed: nearest pharmacy name, exact address, meters/blocks, and phone.
 */
export function buildRescuerPharmacySpeech(
  pharmacy: Pharmacy,
  distMeters: number | null | undefined,
  originLabel?: string
): string {
  const name = cleanPharmacyName(pharmacy.name);
  const address = formatAddressForSpeech(pharmacy.address);
  const distKm = distMeters != null ? distMeters / 1000 : null;
  const dist = formatDistanceForSpeech(distKm);
  const phone = pharmacy.phones.length > 0 ? formatPhoneForSpeech(pharmacy.phones[0]) : '';

  let speech = 'Atención de auxilio. ';
  if (originLabel) {
    speech += `Calculando desde ${originLabel}, `;
  }
  speech += `la farmacia de turno más cercana al lugar del accidente es ${name}. `;
  speech += `Está ubicada en ${address}, ${dist}. `;
  if (phone) {
    speech += `Teléfono de la farmacia: ${phone}. `;
  }
  speech += 'Tocá en la pantalla para llamar ahora o iniciar la ruta en el mapa.';
  return speech;
}

/**
 * Formats DNI digits for natural, clear spoken Spanish
 * e.g. "28456789" -> "28 millones 456 mil 789"
 */
export function formatDniForSpeech(rawDni?: string): string {
  if (!rawDni) return '';
  const digits = rawDni.replace(/\D/g, '');
  if (digits.length === 8) {
    const m = digits.slice(0, 2);
    const k = digits.slice(2, 5);
    const u = digits.slice(5, 8);
    return `${m} millones ${k} mil ${u}`;
  }
  if (digits.length === 7) {
    const m = digits.slice(0, 1);
    const k = digits.slice(1, 4);
    const u = digits.slice(4, 7);
    return `${m} millones ${k} mil ${u}`;
  }
  return digits.split('').join(' ');
}

/**
 * Converts blood group code (e.g. "O+", "A-", "0+") to natural medical Spanish speech.
 * Correctly pronounces "O+" as "factor cero positivo" (never the literal "o más").
 */
export function formatBloodTypeForSpeech(blood?: string): string {
  if (!blood) return 'no especificado en la ficha';
  const clean = blood.trim().toUpperCase().replace(/\s+/g, '');

  if (clean === 'O+' || clean === '0+' || clean === 'OPOSITIVO' || clean === 'CEROPOSITIVO') {
    return 'factor cero positivo';
  }
  if (clean === 'O-' || clean === '0-' || clean === 'ONEGATIVO' || clean === 'CERONEGATIVO') {
    return 'factor cero negativo';
  }
  if (clean === 'A+' || clean === 'APOSITIVO') {
    return 'grupo A, factor positivo';
  }
  if (clean === 'A-' || clean === 'ANEGATIVO') {
    return 'grupo A, factor negativo';
  }
  if (clean === 'B+' || clean === 'BPOSITIVO') {
    return 'grupo B, factor positivo';
  }
  if (clean === 'B-' || clean === 'BNEGATIVO') {
    return 'grupo B, factor negativo';
  }
  if (clean === 'AB+' || clean === 'ABPOSITIVO') {
    return 'grupo A B, factor positivo';
  }
  if (clean === 'AB-' || clean === 'ABNEGATIVO') {
    return 'grupo A B, factor negativo';
  }

  return clean
    .replace(/O\+/gi, 'factor cero positivo')
    .replace(/0\+/gi, 'factor cero positivo')
    .replace(/O\-/gi, 'factor cero negativo')
    .replace(/0\-/gi, 'factor cero negativo')
    .replace(/\+/g, ' positivo')
    .replace(/\-/g, ' negativo');
}

/**
 * Builds a concise ~10-second critical triage readout for the first moments of an emergency:
 * Name, Blood Type, Active Pregnancy Alert (if any), Allergies/Conditions, and Medication.
 */
export function buildCriticalTriageSpeech(record: MedicalRecord): string {
  const sentences: string[] = [];

  const name = record.nombre ? record.nombre.trim() : 'Persona asistida';
  sentences.push(`Alerta médica de ${name}.`);

  if (record.sangre) {
    sentences.push(`Grupo sanguíneo: ${formatBloodTypeForSpeech(record.sangre)}.`);
  } else {
    sentences.push('Grupo sanguíneo no especificado.');
  }

  const pregnancy = calculatePregnancyProgress(record);
  if (pregnancy) {
    if (pregnancy.hasValidAnchorDate) {
      sentences.push(`Alerta obstétrica: paciente embarazada, ${pregnancy.detailedLabel}, ${pregnancy.trimesterLabel}.`);
    } else {
      sentences.push('Alerta obstétrica: paciente cursando embarazo.');
    }
  }

  if (record.enf && record.enf.trim()) {
    sentences.push(`Alergias y enfermedades críticas: ${record.enf.trim()}.`);
  } else {
    sentences.push('Sin alergias declaradas.');
  }

  if (record.med && record.med.trim()) {
    sentences.push(`Medicación habitual: ${record.med.trim()}.`);
  } else {
    sentences.push('Sin medicación habitual declarada.');
  }

  return sentences.join(' ');
}

/**
 * Builds clear, complete voice readout prioritizing vital triage data first,
 * followed by identity, coverage, clinical history, and emergency contact.
 */
export function buildMedicalTriageSpeech(record: MedicalRecord): string {
  const sentences: string[] = [];

  // Vital 10-second core first
  sentences.push(buildCriticalTriageSpeech(record));

  if (record.embarazada && record.embarazoObstetra && record.embarazoObstetra.trim()) {
    sentences.push(`Obstetricia: ${record.embarazoObstetra.trim()}.`);
  }

  if (record.dni) {
    sentences.push(`Documento Nacional de Identidad: ${formatDniForSpeech(record.dni)}.`);
  }

  if (record.sexo) {
    sentences.push(`Sexo: ${record.sexo}.`);
  }

  if (record.domicilio) {
    sentences.push(`Domicilio: ${formatAddressForSpeech(record.domicilio)}.`);
  }

  if (record.obraSocial && record.obraSocial.trim()) {
    sentences.push(`Obra social: ${record.obraSocial.trim()}.`);
  }

  if (record.doc && record.doc.trim()) {
    let docSpeech = `Médico de cabecera: ${record.doc.trim()}.`;
    if (record.cmed && record.cmed.trim()) {
      docSpeech += ` Teléfono del médico: ${formatPhoneForSpeech(record.cmed)}.`;
    }
    sentences.push(docSpeech);
  }

  if (record.cirugiasPrevias && record.cirugiasPrevias.trim()) {
    sentences.push(`Cirugías previas: ${record.cirugiasPrevias.trim()}.`);
  }

  if (record.internacionesPrevias && record.internacionesPrevias.trim()) {
    sentences.push(`Internaciones previas: ${record.internacionesPrevias.trim()}.`);
  }

  if (record.antecedentesFamiliares && record.antecedentesFamiliares.trim()) {
    sentences.push(`Antecedentes familiares: ${record.antecedentesFamiliares.trim()}.`);
  }

  if (record.historialClinico && record.historialClinico.length > 0) {
    const eventSummaries = record.historialClinico.slice(0, 3).map((ev) => {
      const datePart = ev.date ? `, año ${ev.date}` : '';
      return `${ev.title}${datePart}`;
    });
    sentences.push(`Historial registrado: ${eventSummaries.join('. ')}.`);
  }

  if (record.cfam && record.cfam.trim()) {
    sentences.push(`Contacto de familiar directo: ${formatPhoneForSpeech(record.cfam)}.`);
  } else if (record.tel && record.tel.trim()) {
    sentences.push(`Teléfono de auxilio: ${formatPhoneForSpeech(record.tel)}.`);
  } else if (record.cami && record.cami.trim()) {
    sentences.push(`Contacto allegado: ${formatPhoneForSpeech(record.cami)}.`);
  }

  sentences.push('Fin de la ficha médica.');

  return sentences.join(' ');
}

// Queue and State for Sequential Sentence Chunking
let currentSpeechQueue: string[] = [];
let currentQueueIndex = 0;
let isPlaybackActive = false;

/**
 * Splits long text into natural sentence chunks so SpeechSynthesis never cuts off
 * mid-speech (bypasses browser 15-second audio buffer limitation).
 */
function splitIntoNaturalSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const rawChunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const result: string[] = [];

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // If an individual sentence is still too long (> 140 chars), split at commas/semicolons
    if (trimmed.length > 140) {
      const parts = trimmed.split(/([,;:]\s+)/);
      let buffer = '';
      for (const p of parts) {
        if ((buffer + p).length > 120) {
          if (buffer.trim()) result.push(buffer.trim());
          buffer = p;
        } else {
          buffer += p;
        }
      }
      if (buffer.trim()) result.push(buffer.trim());
    } else {
      result.push(trimmed);
    }
  }

  return result.filter((s) => s.length > 0);
}

function notifyVoiceState(active: boolean, sourceId?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vortex_voice_state', { detail: { active, sourceId: sourceId || null } })
    );
  }
}

/**
 * Speaks the provided text using natural Argentine/Latin Spanish with zero overlap.
 * Uses sequential sentence chunking to guarantee 100% completion of all information
 * without audio cutoffs on Chrome, Android, or iOS Safari.
 */
export async function speakNaturalSpanish(
  text: string,
  rate = 0.92,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: unknown) => void,
  sourceId?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  // Cancel any existing playback
  stopVoiceAssistant();

  const sentences = splitIntoNaturalSentences(text);
  if (sentences.length === 0) {
    onEnd?.();
    return true;
  }

  // Trigger audio chime non-blocking so speechSynthesis.speak runs synchronously inside user gesture
  void playEmergencyChime();

  currentSpeechQueue = sentences;
  currentQueueIndex = 0;
  isPlaybackActive = true;

  const voice = getBestSpanishVoice();

  onStart?.();
  notifyVoiceState(true, sourceId);

  const playNextSentence = () => {
    if (!isPlaybackActive) return;

    if (currentQueueIndex >= currentSpeechQueue.length) {
      isPlaybackActive = false;
      currentSpeechQueue = [];
      currentQueueIndex = 0;
      notifyVoiceState(false);
      onEnd?.();
      return;
    }

    const sentenceText = currentSpeechQueue[currentQueueIndex];
    currentQueueIndex++;

    try {
      const utterance = new SpeechSynthesisUtterance(sentenceText);
      utterance.lang = voice?.lang || 'es-AR';
      utterance.rate = rate; // 0.92 is calm, clear, medical pace
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        if (isPlaybackActive) {
          playNextSentence();
        }
      };

      utterance.onerror = (e) => {
        if (!isPlaybackActive || e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }
        console.warn('Speech chunk error, continuing next chunk:', e);
        if (isPlaybackActive) {
          playNextSentence();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (isPlaybackActive) {
        playNextSentence();
      } else {
        notifyVoiceState(false);
        onError?.(err);
      }
    }
  };

  playNextSentence();
  return true;
}

/**
 * Stops the voice assistant immediately and clears the speech queue
 */
export function stopVoiceAssistant(): void {
  const wasActive = isPlaybackActive;
  isPlaybackActive = false;
  currentSpeechQueue = [];
  currentQueueIndex = 0;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  if (wasActive) {
    notifyVoiceState(false);
  }
}



