import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level shared store so App banner and InstallAppModal stay synchronized
// and never miss an early `beforeinstallprompt` event.
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
let hasDispatchedAppInstalled = false;
const listeners = new Set<() => void>();
let initialized = false;

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function dispatchAppInstalledOnce() {
  if (hasDispatchedAppInstalled || typeof window === 'undefined') return;
  hasDispatchedAppInstalled = true;
  window.dispatchEvent(new CustomEvent('vortex_app_installed'));
}

function initGlobalPWAListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  sharedIsInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifyListeners();
    dispatchAppInstalledOnce();
  });
}

if (typeof window !== 'undefined') {
  initGlobalPWAListeners();
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    initGlobalPWAListeners();
    const forceUpdate = () => setTick((t) => t + 1);
    listeners.add(forceUpdate);

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iosDevice);

    return () => {
      listeners.delete(forceUpdate);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!sharedDeferredPrompt) return false;
    try {
      await sharedDeferredPrompt.prompt();
      const choice = await sharedDeferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        sharedIsInstalled = true;
        sharedDeferredPrompt = null;
        notifyListeners();
        dispatchAppInstalledOnce();
        return true;
      }
    } catch {
      // ignore cancelled/unsupported prompt
    }
    return false;
  };

  return {
    deferredPrompt: sharedDeferredPrompt,
    isInstallable: Boolean(sharedDeferredPrompt) && !sharedIsInstalled,
    isInstalled: sharedIsInstalled,
    isIOS,
    install
  };
}
