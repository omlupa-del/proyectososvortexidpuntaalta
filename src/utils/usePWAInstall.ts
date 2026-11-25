import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __vortexDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    __vortexAppInstalled?: boolean;
  }
}

// Module-level shared store so App banner and InstallAppModal stay synchronized
// and never miss an early `beforeinstallprompt` event captured in index.html <head>.
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
let sharedAlreadyInstalledInBrowser = false;
let sharedWasPromptDismissed = false;
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

function syncFromHeadBuffer() {
  if (typeof window === 'undefined') return;
  if (window.__vortexAppInstalled) {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
  } else if (window.__vortexDeferredInstallPrompt) {
    sharedDeferredPrompt = window.__vortexDeferredInstallPrompt;
    sharedWasPromptDismissed = false;
  }
}

function checkRelatedInstalledApps() {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== 'function') return;
  nav
    .getInstalledRelatedApps()
    .then((apps) => {
      if (Array.isArray(apps) && apps.length > 0) {
        sharedAlreadyInstalledInBrowser = true;
        notifyListeners();
      }
    })
    .catch(() => {});
}

function initGlobalPWAListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  sharedIsInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  syncFromHeadBuffer();
  checkRelatedInstalledApps();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    window.__vortexDeferredInstallPrompt = sharedDeferredPrompt;
    sharedWasPromptDismissed = false;
    notifyListeners();
  });

  window.addEventListener('vortex_beforeinstallprompt_ready', () => {
    syncFromHeadBuffer();
    notifyListeners();
  });

  const handleInstalled = () => {
    sharedIsInstalled = true;
    sharedAlreadyInstalledInBrowser = true;
    sharedDeferredPrompt = null;
    sharedWasPromptDismissed = false;
    window.__vortexAppInstalled = true;
    window.__vortexDeferredInstallPrompt = null;
    notifyListeners();
    dispatchAppInstalledOnce();
  };

  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('vortex_native_app_installed', handleInstalled);
}

if (typeof window !== 'undefined') {
  initGlobalPWAListeners();
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    initGlobalPWAListeners();
    syncFromHeadBuffer();
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
    const promptToUse = sharedDeferredPrompt || window.__vortexDeferredInstallPrompt || null;
    if (!promptToUse) return false;

    // A BeforeInstallPromptEvent can only be invoked once in Chromium.
    sharedDeferredPrompt = null;
    window.__vortexDeferredInstallPrompt = null;

    try {
      await promptToUse.prompt();
      const choice = await promptToUse.userChoice;
      if (choice.outcome === 'accepted') {
        sharedIsInstalled = true;
        sharedAlreadyInstalledInBrowser = true;
        sharedWasPromptDismissed = false;
        notifyListeners();
        dispatchAppInstalledOnce();
        return true;
      }
      sharedWasPromptDismissed = true;
      notifyListeners();
    } catch {
      sharedWasPromptDismissed = true;
      notifyListeners();
    }
    return false;
  };

  return {
    deferredPrompt: sharedDeferredPrompt,
    isInstallable: Boolean(sharedDeferredPrompt) && !sharedIsInstalled,
    isInstalled: sharedIsInstalled,
    alreadyInstalledInBrowser: sharedAlreadyInstalledInBrowser,
    wasPromptDismissed: sharedWasPromptDismissed,
    isIOS,
    install
  };
}
