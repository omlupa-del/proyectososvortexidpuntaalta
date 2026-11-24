/**
 * Welcome Voice & Audio experience for new scans in Vortex ID Punta Alta.
 * Uses Web Speech API (speechSynthesis) with Argentine/Spanish voice and Web Audio pleasant chime chords.
 */

import { welcomeMusic } from './welcomeMusic';

export type WelcomeContext = 'default' | 'scan' | 'installed' | 'data_saved';

export const WELCOME_MESSAGE_TEXT =
  '¡Gracias por elegirnos y confiar en Vortex ID Punta Alta! Es un orgullo cuidar lo más valioso: tu vida y la de quienes más querés. Ya tenés asistencia médica inmediata las 24 horas y farmacias de turno en tiempo real. Gracias por ser parte de nuestra comunidad.';

export function buildWelcomeMessage(
  userName?: string,
  context: WelcomeContext = 'default'
): string {
  const cleanName = (userName || '').trim().split(/\s+/)[0];
  const greetingPrefix = cleanName ? `¡Hola, ${cleanName}! ` : '¡';

  if (context === 'data_saved') {
    return `${greetingPrefix}${cleanName ? 'G' : 'g'}racias por elegirnos y confiar en Vortex ID Punta Alta. Tu ficha médica de emergencia ya está activa y protegida para cuidar tu vida las 24 horas. Ya podés descargar tu código QR y fondo de pantalla.`;
  }

  if (context === 'installed') {
    return `${greetingPrefix}${cleanName ? 'G' : 'g'}racias por descargar Vortex ID Punta Alta y elegirnos. Desde ahora tenés asistencia médica inmediata las 24 horas y farmacias de turno en tu celular, incluso sin conexión.`;
  }

  if (cleanName) {
    return `¡Hola, ${cleanName}! Gracias por elegirnos y confiar en Vortex ID Punta Alta. Es un orgullo cuidar lo más valioso: tu vida y la de quienes más querés. Contás con asistencia médica inmediata las 24 horas y farmacias de turno en tiempo real.`;
  }
  return WELCOME_MESSAGE_TEXT;
}

/**
 * Play a welcoming harmonic chime using Web Audio API
 */
export function playWelcomeChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic arpeggio (C5 - E5 - G5 - C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0, now + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + index * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.65);
    });
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Speak the welcome message using the most natural Spanish voice available.
 * Ducks background ambient music down while speaking, then restores volume.
 */
export function speakWelcomeGreeting(
  onStart?: () => void,
  onEnd?: () => void,
  userName?: string,
  context: WelcomeContext = 'default'
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    // Cancel any previous speech
    window.speechSynthesis.cancel();

    // Duck background music for clarity
    welcomeMusic.setDucked(true);

    // Play pleasant chime right before speech
    playWelcomeChime();

    const utterance = new SpeechSynthesisUtterance(buildWelcomeMessage(userName, context));
    utterance.lang = 'es-AR'; // Preferred Argentine Spanish
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Pick best Spanish voice
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const bestVoice =
        voices.find((v) => v.lang === 'es-AR') ||
        voices.find((v) => v.lang.startsWith('es-419')) ||
        voices.find((v) => v.lang.startsWith('es-US')) ||
        voices.find((v) => v.lang.startsWith('es-MX')) ||
        voices.find((v) => v.lang.startsWith('es'));

      if (bestVoice) {
        utterance.voice = bestVoice;
      }
    }

    if (onStart) {
      utterance.onstart = () => {
        welcomeMusic.setDucked(true);
        onStart();
      };
    }

    utterance.onend = () => {
      welcomeMusic.setDucked(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      welcomeMusic.setDucked(false);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    welcomeMusic.setDucked(false);
    return false;
  }
}

/**
 * Stop any active welcome speech and restore music volume
 */
export function stopWelcomeGreeting(): void {
  welcomeMusic.setDucked(false);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
