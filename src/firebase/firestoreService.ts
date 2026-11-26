import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { MedicalRecord } from '../utils/medicalData';

export interface UserProfileData {
  userId: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

function stripUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  return cleaned as T;
}

/**
 * Creates or updates the user's profile document upon signing in
 */
export async function syncUserProfile(user: User): Promise<UserProfileData | null> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    const isAdminUser = user.email === 'omlupa@gmail.com' && user.emailVerified;

    let profile: UserProfileData;
    if (snap.exists()) {
      const data = snap.data() as UserProfileData;
      profile = {
        ...data,
        displayName: user.displayName || data.displayName || null,
        photoURL: user.photoURL || data.photoURL || null,
        role: isAdminUser ? 'admin' : (data.role || 'user'),
        updatedAt: now
      };
      await setDoc(ref, profile, { merge: true });
    } else {
      profile = {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuario Vortex ID',
        photoURL: user.photoURL || null,
        role: isAdminUser ? 'admin' : 'user',
        createdAt: now,
        updatedAt: now
      };
      await setDoc(ref, profile);
    }
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return null;
  }
}

/**
 * Deletes a public keychain mirror document when unlinked
 */
export async function deleteKeychainFromFirestore(keychainId: string): Promise<void> {
  const cleanKey = keychainId.trim().toUpperCase().replace(/^#/, '');
  if (!cleanKey) return;
  const path = `keychains/${cleanKey}`;
  try {
    await deleteDoc(doc(db, 'keychains', cleanKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Saves medical record to Firestore under user's private collection
 * and mirrors public emergency data under /keychains/{keychainId} if keychainId exists
 */
export async function saveMedicalRecordToFirestore(
  record: MedicalRecord,
  userId: string
): Promise<boolean> {
  const userPath = `users/${userId}/medicalRecords/primary`;
  try {
    const userDocRef = doc(db, 'users', userId, 'medicalRecords', 'primary');
    const {
      fotoQr: _omitQr,
      donanteTieneDoc: _omitDonanteDoc,
      sangreTieneDoc: _omitSangreDoc,
      ...firestoreSafeRecord
    } = record;
    const payload = stripUndefinedFields({
      ...firestoreSafeRecord,
      userId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(userDocRef, payload);

    // If record has a linked physical keychain ID (e.g. 0001, 0042), mirror to /keychains collection
    if (record.keychainId && record.keychainId.trim()) {
      const cleanKey = record.keychainId.trim().toUpperCase().replace(/^#/, '');
      const keychainPath = `keychains/${cleanKey}`;
      try {
        const keychainRef = doc(db, 'keychains', cleanKey);
        await setDoc(keychainRef, {
          ...payload,
          keychainId: cleanKey
        });
      } catch (kcErr) {
        handleFirestoreError(kcErr, OperationType.WRITE, keychainPath);
      }
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
    return false;
  }
}

/**
 * Loads the user's primary medical record from Firestore
 */
export async function loadMedicalRecordFromFirestore(
  userId: string
): Promise<MedicalRecord | null> {
  const userPath = `users/${userId}/medicalRecords/primary`;
  try {
    const userDocRef = doc(db, 'users', userId, 'medicalRecords', 'primary');
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as MedicalRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
    return null;
  }
}

/**
 * Loads emergency card by keychain ID directly from Firestore (scanned via QR)
 */
export async function fetchKeychainFromFirestore(
  keychainId: string
): Promise<MedicalRecord | null> {
  const cleanKey = keychainId.trim().toUpperCase().replace(/^#/, '');
  const path = `keychains/${cleanKey}`;
  try {
    const ref = doc(db, 'keychains', cleanKey);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as MedicalRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Saves duty schedule for a date to Firestore (admin operation)
 */
export async function saveDutyScheduleToFirestore(
  dateKey: string,
  pharmacyIds: string[]
): Promise<void> {
  const path = `dutySchedules/${dateKey}`;
  try {
    const ref = doc(db, 'dutySchedules', dateKey);
    await setDoc(ref, {
      dateKey,
      pharmacyIds,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Listens in real time to the user's medical record
 */
export function subscribeToUserMedicalRecord(
  userId: string,
  onData: (rec: MedicalRecord | null) => void
): () => void {
  const path = `users/${userId}/medicalRecords/primary`;
  const ref = doc(db, 'users', userId, 'medicalRecords', 'primary');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as MedicalRecord);
      } else {
        onData(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export interface FeaturedAdOverride {
  name?: string;
  badge?: string;
  tagline?: string;
  description?: string;
  address?: string;
  hours?: string;
  phone?: string;
  directDial?: string;
  whatsapp?: string;
  socialUrl?: string;
  socialLabel?: string;
  image?: string;
}

export interface PublicSystemSettings {
  monthlyFee: number;
  currency?: string;
  membershipTitle?: string;
  billingDescription?: string;
  paymentAlias: string;
  paymentCbu?: string;
  paymentHolder?: string;
  adminPhone?: string;
  isMembershipRequired: boolean;
  activationCodeHash?: string;
  customDomain?: string;
  adminPinHash?: string;
  hasCustomPin?: boolean;
  pharmacyAdOverride?: FeaturedAdOverride | null;
  remisAdOverride?: FeaturedAdOverride | null;
  updatedAt: string;
}

function sanitizeAdOverride(ad?: FeaturedAdOverride | null): FeaturedAdOverride | null | undefined {
  if (ad === undefined) return undefined;
  if (ad === null) return null;
  return stripUndefinedFields({
    name: typeof ad.name === 'string' ? ad.name.slice(0, 120) : undefined,
    badge: typeof ad.badge === 'string' ? ad.badge.slice(0, 160) : undefined,
    tagline: typeof ad.tagline === 'string' ? ad.tagline.slice(0, 200) : undefined,
    description: typeof ad.description === 'string' ? ad.description.slice(0, 1000) : undefined,
    address: typeof ad.address === 'string' ? ad.address.slice(0, 200) : undefined,
    hours: typeof ad.hours === 'string' ? ad.hours.slice(0, 240) : undefined,
    phone: typeof ad.phone === 'string' ? ad.phone.slice(0, 48) : undefined,
    directDial: typeof ad.directDial === 'string' ? ad.directDial.slice(0, 48) : undefined,
    whatsapp: typeof ad.whatsapp === 'string' ? ad.whatsapp.slice(0, 48) : undefined,
    socialUrl: typeof ad.socialUrl === 'string' ? ad.socialUrl.slice(0, 300) : undefined,
    socialLabel: typeof ad.socialLabel === 'string' ? ad.socialLabel.slice(0, 48) : undefined,
    image: typeof ad.image === 'string' ? ad.image.slice(0, 220000) : undefined
  });
}

/**
 * Fetches public membership and payment settings from Firestore (works on static Netlify).
 */
export async function fetchPublicSystemSettingsFromFirestore(): Promise<PublicSystemSettings | null> {
  try {
    const ref = doc(db, 'systemSettings', 'public');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as PublicSystemSettings;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves public membership and payment settings to Firestore (admin only).
 */
export async function savePublicSystemSettingsToFirestore(
  settings: PublicSystemSettings
): Promise<{ ok: boolean; error?: string }> {
  const path = 'systemSettings/public';
  try {
    if (!auth.currentUser) {
      return { ok: false, error: 'Falta iniciar sesión con Google Admin (omlupa@gmail.com) para guardar en la nube.' };
    }
    const ref = doc(db, 'systemSettings', 'public');
    const safeFee = Number.isFinite(Number(settings.monthlyFee))
      ? Math.min(10000000, Math.max(0, Number(settings.monthlyFee)))
      : 0;
    const payload = stripUndefinedFields({
      monthlyFee: safeFee,
      currency: String(settings.currency || 'ARS').slice(0, 16),
      membershipTitle: String(settings.membershipTitle || 'Membresía Oficial Vortex ID').slice(0, 160),
      billingDescription: String(settings.billingDescription || '').slice(0, 500),
      paymentAlias: String(settings.paymentAlias ?? '').trim().slice(0, 100) || 'vortex.id.auxilio',
      paymentCbu: String(settings.paymentCbu || '').trim().slice(0, 64),
      paymentHolder: String(settings.paymentHolder || 'VORTEX ID · PUNTA ALTA').trim().slice(0, 160),
      adminPhone: String(settings.adminPhone || '').trim().slice(0, 40),
      isMembershipRequired: Boolean(settings.isMembershipRequired),
      activationCodeHash: String(settings.activationCodeHash || '').slice(0, 128),
      customDomain: String(settings.customDomain || '').trim().slice(0, 240),
      adminPinHash: settings.adminPinHash ? String(settings.adminPinHash).slice(0, 128) : undefined,
      hasCustomPin: settings.hasCustomPin !== undefined ? Boolean(settings.hasCustomPin) : undefined,
      pharmacyAdOverride: sanitizeAdOverride(settings.pharmacyAdOverride),
      remisAdOverride: sanitizeAdOverride(settings.remisAdOverride),
      updatedAt: String(settings.updatedAt || new Date().toISOString()).slice(0, 64)
    });
    await setDoc(ref, payload);
    return { ok: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // ignore rethrow
    }
    if (/permission/i.test(rawMsg)) {
      return {
        ok: false,
        error: `Permiso denegado en Firestore: asegurate de estar conectado con omlupa@gmail.com (${auth.currentUser?.email || 'sin email'}).`
      };
    }
    return { ok: false, error: `No se pudo guardar en la nube: ${rawMsg.slice(0, 120)}` };
  }
}

export type SubscriberPaymentStatus = 'al_dia' | 'adeuda' | 'prueba' | 'baja';
export type SubscriberPlanType = 'individual' | 'familiar' | 'comercio';
export type SubscriberPaymentMethod = 'mercadopago' | 'transferencia' | 'efectivo' | 'bonificado';

export interface SubscriberData {
  id: string;
  fullName: string;
  dni?: string;
  phone: string;
  altPhone?: string;
  address?: string;
  neighborhood?: string;
  keychainId?: string;
  paymentStatus: SubscriberPaymentStatus;
  planType?: SubscriberPlanType;
  monthlyFee: number;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  nextDueDate?: string;
  paymentMethod?: SubscriberPaymentMethod;
  payerAliasOrName?: string;
  activationCodeDelivered?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function sanitizeSubscriberPayload(sub: SubscriberData): SubscriberData {
  const cleanId = String(sub.id || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  const fee = Number.isFinite(Number(sub.monthlyFee))
    ? Math.min(10000000, Math.max(0, Number(sub.monthlyFee)))
    : 0;
  const lastAmt =
    sub.lastPaymentAmount !== undefined && sub.lastPaymentAmount !== null && Number.isFinite(Number(sub.lastPaymentAmount))
      ? Math.min(10000000, Math.max(0, Number(sub.lastPaymentAmount)))
      : 0;

  return stripUndefinedFields({
    id: cleanId,
    fullName: String(sub.fullName || '').trim().slice(0, 140),
    dni: String(sub.dni || '').trim().slice(0, 24),
    phone: String(sub.phone || '').trim().slice(0, 40),
    altPhone: String(sub.altPhone || '').trim().slice(0, 40),
    address: String(sub.address || '').trim().slice(0, 200),
    neighborhood: String(sub.neighborhood || '').trim().slice(0, 80),
    keychainId: String(sub.keychainId || '').trim().toUpperCase().replace(/^#/, '').slice(0, 32),
    paymentStatus: sub.paymentStatus,
    planType: sub.planType || 'individual',
    monthlyFee: fee,
    lastPaymentAmount: lastAmt,
    lastPaymentDate: String(sub.lastPaymentDate || '').trim().slice(0, 32),
    nextDueDate: String(sub.nextDueDate || '').trim().slice(0, 32),
    paymentMethod: sub.paymentMethod || 'mercadopago',
    payerAliasOrName: String(sub.payerAliasOrName || '').trim().slice(0, 120),
    activationCodeDelivered: Boolean(sub.activationCodeDelivered),
    notes: String(sub.notes || '').trim().slice(0, 500),
    createdAt: String(sub.createdAt || new Date().toISOString()).slice(0, 64),
    updatedAt: String(sub.updatedAt || new Date().toISOString()).slice(0, 64)
  });
}

export async function fetchSubscribersFromFirestore(): Promise<{
  ok: boolean;
  subscribers: SubscriberData[];
  error?: string;
}> {
  const path = 'subscribers';
  if (!auth.currentUser) {
    return { ok: false, subscribers: [], error: 'Sin sesión Google Admin.' };
  }
  try {
    const snap = await getDocs(collection(db, 'subscribers'));
    const list: SubscriberData[] = [];
    snap.forEach((d) => {
      list.push(d.data() as SubscriberData);
    });
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return { ok: true, subscribers: list };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {
      // ignore rethrow
    }
    return { ok: false, subscribers: [], error: rawMsg };
  }
}

export async function saveSubscriberToFirestore(
  subscriber: SubscriberData
): Promise<{ ok: boolean; error?: string }> {
  const payload = sanitizeSubscriberPayload(subscriber);
  const path = `subscribers/${payload.id}`;
  if (!auth.currentUser) {
    return { ok: false, error: 'Conectá Google Admin (omlupa@gmail.com) para sincronizar en la nube.' };
  }
  try {
    await setDoc(doc(db, 'subscribers', payload.id), payload);
    return { ok: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // ignore rethrow
    }
    return { ok: false, error: rawMsg };
  }
}

export async function deleteSubscriberFromFirestore(
  subscriberId: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanId = subscriberId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const path = `subscribers/${cleanId}`;
  if (!auth.currentUser) {
    return { ok: false, error: 'Sin sesión Google Admin.' };
  }
  try {
    await deleteDoc(doc(db, 'subscribers', cleanId));
    return { ok: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {
      // ignore rethrow
    }
    return { ok: false, error: rawMsg };
  }
}

export async function fetchKeychainsForAdminFromFirestore(): Promise<MedicalRecord[]> {
  if (!auth.currentUser) return [];
  try {
    const snap = await getDocs(collection(db, 'keychains'));
    const list: MedicalRecord[] = [];
    snap.forEach((d) => {
      list.push(d.data() as MedicalRecord);
    });
    return list;
  } catch {
    return [];
  }
}

export async function fetchRegisteredCitizenRecordsForAdminFromFirestore(): Promise<
  Array<MedicalRecord & { ownerEmail?: string | null }>
> {
  if (!auth.currentUser) return [];
  const collected: Array<MedicalRecord & { ownerEmail?: string | null }> = [];
  const seenUserIds = new Set<string>();

  try {
    const [keychainsSnap, usersSnap] = await Promise.allSettled([
      getDocs(collection(db, 'keychains')),
      getDocs(collection(db, 'users'))
    ]);

    if (keychainsSnap.status === 'fulfilled') {
      keychainsSnap.value.forEach((d) => {
        const data = d.data() as MedicalRecord;
        if (data?.nombre) {
          collected.push(data);
        }
      });
    }

    if (usersSnap.status === 'fulfilled') {
      const userDocs = usersSnap.value.docs.slice(0, 120);
      const recordPromises = userDocs.map(async (uDoc) => {
        const uData = uDoc.data() as UserProfileData;
        const uid = uDoc.id;
        if (seenUserIds.has(uid)) return null;
        seenUserIds.add(uid);
        try {
          const recSnap = await getDoc(doc(db, 'users', uid, 'medicalRecords', 'primary'));
          if (recSnap.exists()) {
            return {
              ...(recSnap.data() as MedicalRecord),
              ownerEmail: uData?.email || null
            };
          }
        } catch {
          // skip unreadable user subdoc
        }
        return null;
      });

      const results = await Promise.allSettled(recordPromises);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.nombre) {
          collected.push(r.value);
        }
      }
    }
  } catch {
    // ignore partial failures
  }

  return collected;
}

