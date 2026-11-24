/**
 * Offline Emergency & Pharmacy Data Manager for Vortex ID
 * Ensures critical medical records, 24h duty pharmacies, and emergency call grids
 * are cached, synchronized with the Service Worker, and 100% accessible offline.
 */

import { useState, useEffect } from 'react';
import { MedicalRecord } from './medicalData';

export interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerActive: boolean;
  isEmergencyBundleCached: boolean;
  cachedEndpointsCount: number;
  lastChecked: string;
}

/**
 * Hook to monitor online/offline network connectivity in real-time
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Synchronize the user's active medical record into the Service Worker's Emergency Cache
 * so it is available even when scanning the keychain completely offline.
 */
export function syncEmergencyRecordToWorker(record: MedicalRecord | null) {
  if (!record || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage({
        type: 'CACHE_EMERGENCY_DATA',
        record,
        keychainId: record.keychainId
      });
    } else {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: 'CACHE_EMERGENCY_DATA',
          record,
          keychainId: record.keychainId
        });
      });
    }
  } catch (err) {
    console.warn('Error syncing record to SW cache:', err);
  }
}

/**
 * Prime and pre-cache the emergency offline bundle from the backend
 */
export async function primeEmergencyOfflineCache(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const res = await fetch('/api/emergency/offline-bundle');
    return res.ok;
  } catch (err) {
    console.warn('Could not prime offline bundle over network (may already be offline):', err);
    return false;
  }
}

/**
 * Check whether the Service Worker emergency cache is primed and ready
 */
export async function queryOfflineCacheStatus(): Promise<{
  offlineReady: boolean;
  cachedEndpointsCount: number;
  hasEmergencyBundle: boolean;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { offlineReady: false, cachedEndpointsCount: 0, hasEmergencyBundle: false };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ offlineReady: 'caches' in window, cachedEndpointsCount: 0, hasEmergencyBundle: false });
    }, 1500);

    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data);
      };

      const worker = navigator.serviceWorker.controller;
      if (worker) {
        worker.postMessage({ type: 'CHECK_OFFLINE_CACHE' }, [channel.port2]);
      } else {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({ type: 'CHECK_OFFLINE_CACHE' }, [channel.port2]);
        });
      }
    } catch {
      clearTimeout(timeout);
      resolve({ offlineReady: true, cachedEndpointsCount: 0, hasEmergencyBundle: false });
    }
  });
}
