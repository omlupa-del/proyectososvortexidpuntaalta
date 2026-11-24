import {
  SubscriberData,
  SubscriberPaymentStatus,
  SubscriberPlanType,
  SubscriberPaymentMethod,
  fetchSubscribersFromFirestore,
  saveSubscriberToFirestore,
  deleteSubscriberFromFirestore,
  fetchRegisteredCitizenRecordsForAdminFromFirestore
} from '../firebase/firestoreService';
import { SystemConfig, formatAdminWhatsAppNumber, formatCurrency } from './systemConfig';
import { logSystemEvent } from './systemTelemetry';

export type {
  SubscriberData,
  SubscriberPaymentStatus,
  SubscriberPlanType,
  SubscriberPaymentMethod
};

const LOCAL_SUBSCRIBERS_CACHE_KEY = 'vortex_subscribers_cache_v1';

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addOneMonthIsoDate(baseIsoDate?: string): string {
  const clean = (baseIsoDate || '').trim();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(clean)
    ? new Date(`${clean}T12:00:00`)
    : new Date();
  const next = new Date(base.getTime());
  const targetMonth = next.getMonth() + 1;
  next.setMonth(targetMonth);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSubscriberOverdue(sub: SubscriberData): boolean {
  if (sub.paymentStatus === 'adeuda') return true;
  if (sub.paymentStatus === 'al_dia' && sub.nextDueDate && /^\d{4}-\d{2}-\d{2}$/.test(sub.nextDueDate)) {
    return sub.nextDueDate < getTodayIsoDate();
  }
  return false;
}

export function isDateExpiredOnly(sub: SubscriberData): boolean {
  return (
    sub.paymentStatus === 'al_dia' &&
    Boolean(sub.nextDueDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(sub.nextDueDate || '') &&
    (sub.nextDueDate as string) < getTodayIsoDate()
  );
}

function loadLocalCache(): SubscriberData[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUBSCRIBERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCache(list: SubscriberData[]): void {
  try {
    localStorage.setItem(LOCAL_SUBSCRIBERS_CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage limits
  }
}

function mergeSubscriberLists(lists: SubscriberData[][]): SubscriberData[] {
  const byId = new Map<string, SubscriberData>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id) continue;
      const existing = byId.get(item.id);
      if (!existing || (item.updatedAt || '') >= (existing.updatedAt || '')) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

export async function loadSubscribers(adminPin: string): Promise<{
  subscribers: SubscriberData[];
  cloudSynced: boolean;
  serverSynced: boolean;
}> {
  const local = loadLocalCache();
  let cloudList: SubscriberData[] = [];
  let serverList: SubscriberData[] = [];
  let cloudSynced = false;
  let serverSynced = false;

  const [cloudRes, serverRes] = await Promise.allSettled([
    fetchSubscribersFromFirestore(),
    fetch('/api/subscribers', {
      headers: adminPin ? { 'x-admin-pin': adminPin } : {}
    }).then(async (r) => {
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return null;
      return r.json();
    })
  ]);

  if (cloudRes.status === 'fulfilled' && cloudRes.value.ok) {
    cloudList = cloudRes.value.subscribers;
    cloudSynced = true;
  }
  if (serverRes.status === 'fulfilled' && serverRes.value?.success && Array.isArray(serverRes.value.subscribers)) {
    serverList = serverRes.value.subscribers;
    serverSynced = true;
  }

  const merged = mergeSubscriberLists([local, serverList, cloudList]);
  saveLocalCache(merged);
  return { subscribers: merged, cloudSynced, serverSynced };
}

export async function saveSubscriberRecord(
  subscriber: SubscriberData,
  adminPin: string
): Promise<{
  ok: boolean;
  subscriber: SubscriberData;
  syncedToCloud: boolean;
  syncedToServer: boolean;
  error?: string;
}> {
  const now = new Date().toISOString();
  const cleanId = (
    subscriber.id ||
    `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  )
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);

  const normalized: SubscriberData = {
    ...subscriber,
    id: cleanId,
    fullName: subscriber.fullName.trim(),
    dni: (subscriber.dni || '').trim(),
    phone: subscriber.phone.trim(),
    altPhone: (subscriber.altPhone || '').trim(),
    address: (subscriber.address || '').trim(),
    neighborhood: (subscriber.neighborhood || '').trim(),
    keychainId: (subscriber.keychainId || '').trim().toUpperCase().replace(/^#/, ''),
    monthlyFee: Math.max(0, Number(subscriber.monthlyFee) || 0),
    lastPaymentAmount: Math.max(0, Number(subscriber.lastPaymentAmount) || 0),
    lastPaymentDate: (subscriber.lastPaymentDate || '').trim(),
    nextDueDate: (subscriber.nextDueDate || '').trim(),
    payerAliasOrName: (subscriber.payerAliasOrName || '').trim(),
    notes: (subscriber.notes || '').trim(),
    createdAt: subscriber.createdAt || now,
    updatedAt: now
  };

  // Update local cache immediately
  const cached = loadLocalCache();
  const idx = cached.findIndex((s) => s.id === normalized.id);
  const nextCache =
    idx >= 0
      ? cached.map((s) => (s.id === normalized.id ? normalized : s))
      : [normalized, ...cached];
  saveLocalCache(nextCache);

  // Persist to Express server & Firestore in parallel
  const [cloudRes, serverRes] = await Promise.allSettled([
    saveSubscriberToFirestore(normalized),
    fetch('/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminPin ? { 'x-admin-pin': adminPin } : {})
      },
      body: JSON.stringify(normalized)
    }).then(async (r) => {
      if (!r.ok) return { ok: false };
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return { ok: false };
      const data = await r.json();
      return { ok: Boolean(data?.success) };
    })
  ]);

  const syncedToCloud = cloudRes.status === 'fulfilled' && cloudRes.value.ok;
  const syncedToServer = serverRes.status === 'fulfilled' && serverRes.value.ok;
  const cloudErr = cloudRes.status === 'fulfilled' ? cloudRes.value.error : undefined;

  logSystemEvent({
    level: syncedToCloud || syncedToServer ? 'info' : 'warn',
    category: 'sync',
    source: 'Padrón Suscriptores',
    message: `${normalized.fullName} guardado (${normalized.paymentStatus.replace('_', ' ')})`,
    detail: syncedToCloud
      ? 'Sincronizado en Firestore y respaldo local'
      : cloudErr || 'Guardado localmente (conectá Google Admin para nube)'
  });

  return {
    ok: true,
    subscriber: normalized,
    syncedToCloud,
    syncedToServer,
    error: !syncedToCloud ? cloudErr : undefined
  };
}

export async function deleteSubscriberRecord(
  subscriberId: string,
  adminPin: string
): Promise<{ syncedToCloud: boolean; syncedToServer: boolean }> {
  const nextCache = loadLocalCache().filter((s) => s.id !== subscriberId);
  saveLocalCache(nextCache);

  const [cloudRes, serverRes] = await Promise.allSettled([
    deleteSubscriberFromFirestore(subscriberId),
    fetch(`/api/subscribers/${encodeURIComponent(subscriberId)}`, {
      method: 'DELETE',
      headers: adminPin ? { 'x-admin-pin': adminPin } : {}
    }).then((r) => r.ok)
  ]);

  const syncedToCloud = cloudRes.status === 'fulfilled' && cloudRes.value.ok;
  const syncedToServer = serverRes.status === 'fulfilled' && Boolean(serverRes.value);

  logSystemEvent({
    level: 'info',
    category: 'sync',
    source: 'Padrón Suscriptores',
    message: `Suscriptor ${subscriberId} eliminado del padrón`
  });

  return { syncedToCloud, syncedToServer };
}

export async function importSubscribersFromLinkedKeychains(
  existingSubscribers: SubscriberData[],
  defaultMonthlyFee: number,
  adminPin: string,
  isMembershipRequired = false
): Promise<{ importedCount: number; subscribers: SubscriberData[] }> {
  const existingKeys = new Set(
    existingSubscribers
      .map((s) => (s.keychainId || '').trim().toUpperCase())
      .filter(Boolean)
  );
  const existingDnis = new Set(
    existingSubscribers
      .map((s) => (s.dni || '').replace(/\D/g, ''))
      .filter(Boolean)
  );
  const existingNamePhones = new Set(
    existingSubscribers
      .map((s) => `${s.fullName.trim().toLowerCase()}|${s.phone.replace(/\D/g, '')}`)
      .filter((k) => !k.endsWith('|'))
  );

  const [cloudCitizenRecords, serverData] = await Promise.all([
    fetchRegisteredCitizenRecordsForAdminFromFirestore(),
    fetch('/api/records/all?includeRecords=true', {
      headers: adminPin ? { 'x-admin-pin': adminPin } : {}
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  ]);

  const candidates: Array<{
    keychainId?: string;
    nombre?: string;
    dni?: string;
    domicilio?: string;
    tel?: string;
    cfam?: string;
    ownerEmail?: string | null;
  }> = [...cloudCitizenRecords];

  if (serverData?.keychains && typeof serverData.keychains === 'object') {
    for (const [kcId, rec] of Object.entries(serverData.keychains)) {
      candidates.push({ ...(rec as Record<string, string>), keychainId: kcId });
    }
  }
  if (serverData?.primaryRecord) {
    candidates.push(serverData.primaryRecord);
  }

  let importedCount = 0;
  let updatedList = [...existingSubscribers];
  const today = getTodayIsoDate();

  for (const cand of candidates) {
    const cleanName = (cand.nombre || '').trim();
    const cleanPhone = (cand.tel || cand.cfam || '').trim();
    const cleanKey = (cand.keychainId || '').trim().toUpperCase().replace(/^#/, '');
    const cleanDniDigits = (cand.dni || '').replace(/\D/g, '');
    const namePhoneKey = `${cleanName.toLowerCase()}|${cleanPhone.replace(/\D/g, '')}`;

    if (!cleanName || (!cleanPhone && !cleanKey && !cleanDniDigits)) continue;
    if (cleanKey && existingKeys.has(cleanKey)) continue;
    if (cleanDniDigits && existingDnis.has(cleanDniDigits)) continue;
    if (cleanPhone && existingNamePhones.has(namePhoneKey)) continue;

    if (cleanKey) existingKeys.add(cleanKey);
    if (cleanDniDigits) existingDnis.add(cleanDniDigits);
    if (cleanPhone) existingNamePhones.add(namePhoneKey);

    const newId = cleanKey
      ? `sub_kc_${cleanKey.replace(/[^a-zA-Z0-9_-]/g, '')}`
      : cleanDniDigits
        ? `sub_dni_${cleanDniDigits}`
        : `sub_${Date.now()}_${importedCount}`;

    const newSub: SubscriberData = {
      id: newId,
      fullName: cleanName,
      dni: (cand.dni || '').trim(),
      phone: cleanPhone || 'Sin teléfono cargado',
      altPhone: cand.cfam && cand.cfam !== cleanPhone ? cand.cfam.trim() : '',
      address: (cand.domicilio || '').trim(),
      neighborhood: '',
      keychainId: cleanKey,
      paymentStatus: isMembershipRequired ? 'adeuda' : 'prueba',
      planType: 'individual',
      monthlyFee: defaultMonthlyFee,
      lastPaymentAmount: 0,
      lastPaymentDate: '',
      nextDueDate: isMembershipRequired ? today : addOneMonthIsoDate(today),
      paymentMethod: 'mercadopago',
      payerAliasOrName: cand.ownerEmail ? String(cand.ownerEmail).trim() : '',
      activationCodeDelivered: false,
      notes: 'Cargado automáticamente desde ficha registrada en la app.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await saveSubscriberRecord(newSub, adminPin);
    updatedList = [res.subscriber, ...updatedList.filter((x) => x.id !== res.subscriber.id)];
    importedCount++;
  }

  return { importedCount, subscribers: updatedList };
}

export function buildSubscriberWhatsAppUrl(
  sub: SubscriberData,
  config: SystemConfig,
  activationCode?: string
): string {
  const digits = formatAdminWhatsAppNumber(sub.phone);
  const feeStr = formatCurrency(sub.monthlyFee || config.monthlyFee);
  const alias = config.paymentAlias || 'vortex.id.auxilio';
  const overdue = isSubscriberOverdue(sub);

  let text = '';
  if (overdue) {
    text =
      `Hola *${sub.fullName}*! Te escribimos desde *Vortex ID Punta Alta* 🛡️.\n\n` +
      `Te recordamos que la cuota mensual de mantenimiento de tu Ficha SOS` +
      `${sub.keychainId ? ` (Llavero #${sub.keychainId})` : ''} es de *${feeStr}*.\n` +
      `${sub.nextDueDate ? `• Vencimiento: ${sub.nextDueDate}\n` : ''}` +
      `• Alias Mercado Pago / Banco: *${alias}*\n\n` +
      `Cuando realices la transferencia envianos el comprobante por este medio para mantener tu servicio activo 24hs. ¡Muchas gracias!`;
  } else {
    const codePart = activationCode
      ? `\n🔑 Tu Código de Alta es: *${activationCode.trim().toUpperCase()}*\n`
      : '';
    text =
      `Hola *${sub.fullName}*! Confirmamos tu suscripción *AL DÍA* en *Vortex ID Punta Alta* ✅\n` +
      `${sub.keychainId ? `• Llavero vinculado: *#${sub.keychainId}*\n` : ''}` +
      `${sub.nextDueDate ? `• Próximo vencimiento: *${sub.nextDueDate}*\n` : ''}` +
      `${codePart}` +
      `¡Gracias por cuidar tu seguridad y la de tu familia!`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function exportSubscribersCsv(subscribers: SubscriberData[]): string {
  const headers = [
    'ID',
    'Nombre Completo',
    'DNI',
    'Celular',
    'Tel Alternativo',
    'Dirección',
    'Barrio / Zona',
    'Llavero QR',
    'Estado Pago',
    'Vencido Hoy',
    'Plan',
    'Cuota Mensual',
    'Último Pago ($)',
    'Fecha Último Pago',
    'Próximo Vencimiento',
    'Medio de Pago',
    'Titular Transferencia / MP',
    'Código Entregado',
    'Observaciones'
  ];

  const escapeCell = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const statusText = (s: SubscriberData) => {
    if (s.paymentStatus === 'adeuda') return 'ADEUDA';
    if (isDateExpiredOnly(s)) return 'VENCIDO';
    if (s.paymentStatus === 'al_dia') return 'AL DIA';
    if (s.paymentStatus === 'prueba') return 'PRUEBA';
    return 'BAJA';
  };

  const rows = subscribers.map((s) =>
    [
      s.id,
      s.fullName,
      s.dni || '',
      s.phone,
      s.altPhone || '',
      s.address || '',
      s.neighborhood || '',
      s.keychainId ? `#${s.keychainId}` : '',
      statusText(s),
      isSubscriberOverdue(s) ? 'SI' : 'NO',
      s.planType || 'individual',
      s.monthlyFee,
      s.lastPaymentAmount || 0,
      s.lastPaymentDate || '',
      s.nextDueDate || '',
      s.paymentMethod || '',
      s.payerAliasOrName || '',
      s.activationCodeDelivered ? 'SI' : 'NO',
      s.notes || ''
    ]
      .map(escapeCell)
      .join(';')
  );

  return '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\n');
}
