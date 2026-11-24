/**
 * Call Handler & Emergency Dispatcher
 * Solves the issue where emergency calls might not launch automatically or get blocked in iframes/webviews.
 */

export interface ActiveCall {
  number: string;
  cleanNumber: string;
  title: string;
  category?: string;
  source: 'emergency' | 'pharmacy' | 'contact' | 'service';
  autoDialTriggeredAt?: number;
  isAsyncTrigger?: boolean;
}

type CallListener = (call: ActiveCall | null) => void;
const listeners = new Set<CallListener>();

let currentCall: ActiveCall | null = null;

export function subscribeToActiveCall(listener: CallListener): () => void {
  listeners.add(listener);
  listener(currentCall);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyCall(call: ActiveCall | null) {
  currentCall = call;
  listeners.forEach((fn) => fn(call));
}

export function closeActiveCall() {
  notifyCall(null);
}

/**
 * Format a phone number cleanly for tel: protocol in Argentina
 */
export function formatTelUri(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '');
  // If it's a short emergency number like 911, 107, 100, 103, 101
  if (clean.length <= 4) {
    return `tel:${clean}`;
  }
  // If it starts with 549 or +549
  if (clean.startsWith('+')) {
    return `tel:${clean}`;
  }
  if (clean.startsWith('549')) {
    return `tel:+${clean}`;
  }
  // Standard Punta Alta local number starting with 02932
  return `tel:${clean}`;
}

/**
 * Launches tel: protocol synchronously via a temporary anchor click so mobile browsers
 * preserve the live user-activation gesture and never trigger cross-origin iframe errors.
 */
export function launchTelProtocol(phone: string): void {
  if (typeof document === 'undefined') return;
  const telUri = formatTelUri(phone);
  try {
    const link = document.createElement('a');
    link.href = telUri;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    try {
      window.location.href = telUri;
    } catch {
      // Handled by EmergencyDialerModal fallback
    }
  }
}

/**
 * Play a high-contrast sound chirp/beep using Web Audio API for tactile feedback
 */
export function playChirp(type: 'emergency' | 'click' | 'success' = 'click') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'emergency') {
      // Urgent double high-pitch tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // AudioContext blocked or not allowed until user gesture
  }
}

/**
 * Trigger immediate emergency call.
 * Launches tel: synchronously during user tap to preserve gesture activation on iOS/Android,
 * and opens EmergencyDialerModal as an interactive fallback HUD.
 */
export function triggerDirectCall(
  phone: string,
  title: string = 'Llamada de Emergencia',
  source: ActiveCall['source'] = 'emergency',
  options?: { isAsyncTrigger?: boolean }
) {
  const cleanNumber = phone.replace(/[^\d+]/g, '');

  // 1. Tactile haptic feedback (vibration)
  try {
    if (navigator.vibrate) {
      if (source === 'emergency') {
        navigator.vibrate([100, 50, 150]);
      } else {
        navigator.vibrate(40);
      }
    }
  } catch {
    // ignore
  }

  // 2. Audible tone
  playChirp(source === 'emergency' ? 'emergency' : 'click');

  // 3. Attempt native tel: synchronously while the user tap gesture is active
  if (!options?.isAsyncTrigger) {
    launchTelProtocol(phone);
  }

  // 4. Launch fallback modal HUD
  const callData: ActiveCall = {
    number: phone,
    cleanNumber,
    title,
    source,
    autoDialTriggeredAt: Date.now(),
    isAsyncTrigger: Boolean(options?.isAsyncTrigger)
  };
  notifyCall(callData);
}

/**
 * Format WhatsApp Argentina international number (549...)
 */
export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return `549${digits.slice(2)}`;
  if (digits.length === 10) return `549${digits}`; // e.g. 2932123456 -> 5492932123456
  return digits;
}
