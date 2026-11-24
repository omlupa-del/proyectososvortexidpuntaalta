import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClinicalEventPayload {
  id: string;
  type: 'internacion' | 'cirugia' | 'antecedente' | 'otro';
  title: string;
  date?: string;
  institution?: string;
  details?: string;
}

interface MedicalRecordPayload {
  keychainId?: string;
  nombre?: string;
  dni?: string;
  domicilio?: string;
  sangre?: string;
  enf?: string;
  med?: string;
  obraSocial?: string;
  doc?: string;
  tel?: string;
  cfam?: string;
  cami?: string;
  cmed?: string;
  foto?: string;
  historialClinico?: ClinicalEventPayload[];
  cirugiasPrevias?: string;
  internacionesPrevias?: string;
  antecedentesFamiliares?: string;
  historialClinicoProtected?: boolean;
  updatedAt?: string;
}

interface DatabaseStructure {
  primaryRecord: MedicalRecordPayload | null;
  keychains: Record<string, MedicalRecordPayload>;
}

interface SystemConfigPayload {
  monthlyFee: number;
  currency: string;
  membershipTitle: string;
  billingDescription: string;
  paymentAlias: string;
  paymentCbu: string;
  paymentHolder: string;
  adminPhone: string;
  adminPin: string;
  isMembershipRequired: boolean;
  activationCodeHash?: string;
  customDomain?: string;
  pharmacyAdOverride?: Record<string, unknown> | null;
  remisAdOverride?: Record<string, unknown> | null;
  updatedAt?: string;
}

// Crisp default verified face photo for initial emergency record
const DEFAULT_VERIFIED_PHOTO =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="%23071536"/><circle cx="48" cy="40" r="19" fill="%23f8d1ab"/><rect x="41" y="52" width="14" height="18" fill="%23f1c29b"/><path d="M14 96 C24 70 72 70 82 96 Z" fill="%231e5bff"/><path d="M40 69 L48 80 L56 69" stroke="%23ffffff" stroke-width="2" fill="none"/><ellipse cx="48" cy="27" rx="21" ry="14" fill="%23382215"/><circle cx="41" cy="39" r="2.5" fill="%231c2833"/><circle cx="55" cy="39" r="2.5" fill="%231c2833"/><path d="M48 40 L46 47 L50 47" stroke="%23d99f73" stroke-width="1.8" fill="none"/><path d="M42 52 Q48 56 54 52" stroke="%23a85038" stroke-width="2" fill="none"/><rect x="2" y="2" width="92" height="92" rx="14" fill="none" stroke="%2337c8ff" stroke-width="3"/></svg>';

const INITIAL_PRIMARY_RECORD: MedicalRecordPayload = {
  keychainId: '0042',
  nombre: 'Carlos Alberto Gómez',
  dni: '28.452.910',
  domicilio: 'Colón 415, Punta Alta',
  sangre: 'O+',
  enf: 'Hipertensión controlada · Alergia severa a Penicilina',
  med: 'Losartán 50mg (1 comprimido cada mañana)',
  obraSocial: 'DIBA / IOSFA (Afiliado N° 48201-9)',
  doc: 'Dra. Marcela Rossi (Clínica Coronel Rosales)',
  tel: '02932421222',
  cfam: '2932456789',
  cami: '2932654321',
  cmed: '02932421222',
  foto: DEFAULT_VERIFIED_PHOTO,
  historialClinico: [
    {
      id: 'h1',
      type: 'cirugia',
      title: 'Apendicectomía Laparoscópica',
      date: 'Noviembre 2018',
      institution: 'Hospital Naval Puerto Belgrano',
      details: 'Sin complicaciones posoperatorias. Buena tolerancia anestésica.'
    },
    {
      id: 'h2',
      type: 'internacion',
      title: 'Internación por Neumonía Bilateral',
      date: 'Julio 2021 (7 días)',
      institution: 'Hospital Municipal Eva Perón',
      details: 'Oxigenoterapia y antibióticos macrólidos (respetar alergia estricta a penicilinas).'
    },
    {
      id: 'h3',
      type: 'antecedente',
      title: 'Cardiopatía Isquémica e Hipertensión',
      date: 'Línea paterna directa',
      institution: 'Punta Alta',
      details: 'Padre con infarto agudo de miocardio a los 62 años. Madre con HTA crónica.'
    }
  ],
  cirugiasPrevias: 'Apendicectomía Laparoscópica (2018 - Hospital Naval)',
  internacionesPrevias: 'Neumonía bilateral (Julio 2021 - Hospital Eva Perón)',
  antecedentesFamiliares: 'Padre: Infarto a los 62 años. Madre: Hipertensión arterial.',
  historialClinicoProtected: true,
  updatedAt: new Date().toISOString()
};

const DEFAULT_SYSTEM_CONFIG: SystemConfigPayload = {
  monthlyFee: 3000,
  currency: 'ARS',
  membershipTitle: 'Membresía Oficial Vortex ID',
  billingDescription: 'Mantenimiento del servicio 24hs, alojamiento seguro en la nube y respuesta inmediata ante accidentes en Punta Alta.',
  paymentAlias: 'vortex.id.auxilio',
  paymentCbu: '0000003100049281048201',
  paymentHolder: 'VORTEX ID · PUNTA ALTA',
  adminPhone: '2932420000',
  adminPin: '1234',
  isMembershipRequired: false,
  activationCodeHash: '0e790feb7507f71d95d3743b15b81aacee754df726f79e9c11c937bac92afb8b',
  customDomain: '',
  updatedAt: '2026-01-01T00:00:00.000Z'
};


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Accept up to 15mb payload for base64 photo profiles
  app.use(express.json({ limit: '15mb' }));

  const DB_FILE = path.join(__dirname, '.records_db.json');
  const CONFIG_FILE = path.join(__dirname, '.system_config.json');

  let db: DatabaseStructure = {
    primaryRecord: null,
    keychains: {}
  };

  let systemConfig: SystemConfigPayload = { ...DEFAULT_SYSTEM_CONFIG };

  // Load Records DB
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading DB file:', err);
  }

  // Load System Config
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      systemConfig = { ...DEFAULT_SYSTEM_CONFIG, ...JSON.parse(content) };
    } else {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(systemConfig, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error loading config file:', err);
  }

  const persistDb = () => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving DB file:', err);
    }
  };

  const persistConfig = () => {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(systemConfig, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving config file:', err);
    }
  };

  const hashAdminPinServer = (pin: string): string =>
    crypto.createHash('sha256').update(pin.trim()).digest('hex');

  const sanitizeConfig = (cfg: SystemConfigPayload) => {
    const { adminPin, ...safe } = cfg;
    const effectivePin = String(adminPin || '1234').trim();
    return {
      ...safe,
      adminPinHash: hashAdminPinServer(effectivePin),
      hasCustomPin: Boolean(effectivePin && effectivePin !== '1234')
    };
  };

  const getProvidedPin = (req: Request): string => {
    const headerPin = req.header('x-admin-pin');
    if (typeof headerPin === 'string' && headerPin.trim()) return headerPin.trim();
    const bodyPin = (req.body as Record<string, unknown> | undefined)?.currentAdminPin;
    if (typeof bodyPin === 'string' && bodyPin.trim()) return bodyPin.trim();
    const queryPin = req.query.pin;
    if (typeof queryPin === 'string' && queryPin.trim()) return queryPin.trim();
    return '';
  };

  const isValidAdminPin = (req: Request): boolean => {
    const provided = getProvidedPin(req);
    const expected = String(systemConfig.adminPin || '1234').trim();
    return Boolean(provided) && provided === expected;
  };

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Verify Administrator PIN without exposing it over GET
  app.post('/api/system/verify-pin', (req: Request, res: Response) => {
    const { pin } = (req.body || {}) as { pin?: string };
    const provided = String(pin || '').trim();
    const expected = String(systemConfig.adminPin || '1234').trim();
    if (!provided) {
      return res.status(400).json({ valid: false, error: 'PIN requerido.' });
    }
    const valid = provided === expected;
    if (!valid) {
      return res.status(401).json({ valid: false, error: 'PIN incorrecto.' });
    }
    return res.json({ valid: true });
  });

  // Get System Configuration (monthly membership fee, alias, etc. — never exposes adminPin)
  app.get('/api/system/config', (_req: Request, res: Response) => {
    res.json({ success: true, config: sanitizeConfig(systemConfig) });
  });

  // Update System Configuration (Control General del Sistema - requires current admin PIN)
  app.post('/api/system/config', (req: Request, res: Response) => {
    const incoming = req.body as Partial<SystemConfigPayload> & {
      currentAdminPin?: string;
      newAdminPin?: string;
    };
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Configuración inválida' });
    }

    if (!isValidAdminPin(req)) {
      return res.status(401).json({ error: 'Autorización requerida: PIN de administrador inválido o faltante.' });
    }

    const { currentAdminPin: _cur, newAdminPin, adminPin: incomingAdminPin, ...safeIncoming } = incoming;
    const candidatePin = String(newAdminPin || incomingAdminPin || '').trim();
    const nextAdminPin =
      candidatePin && candidatePin.length >= 4
        ? candidatePin.slice(0, 8)
        : systemConfig.adminPin;

    systemConfig = {
      ...systemConfig,
      ...safeIncoming,
      adminPin: nextAdminPin,
      monthlyFee:
        incoming.monthlyFee !== undefined && !Number.isNaN(Number(incoming.monthlyFee))
          ? Math.max(0, Number(incoming.monthlyFee))
          : systemConfig.monthlyFee,
      updatedAt: new Date().toISOString()
    };

    persistConfig();
    console.log(`[Vortex ID Admin] System config updated: Cuota mensual $${systemConfig.monthlyFee} ARS (Alias: ${systemConfig.paymentAlias})`);
    res.json({ success: true, config: sanitizeConfig(systemConfig) });
  });

  // Recover / Reset Administrator PIN after verifying owner email or registered admin phone
  app.post('/api/system/recover-pin', (req: Request, res: Response) => {
    const { identity, newPin } = req.body as { identity?: string; newPin?: string };
    const cleanIdentity = String(identity || '').trim().toLowerCase();

    if (!cleanIdentity) {
      return res.status(400).json({ error: 'Ingresá tu correo de administrador o número de WhatsApp registrado.' });
    }

    const ownerEmails = ['omlupa@gmail.com'];
    const identityDigits = cleanIdentity.replace(/\D/g, '');
    const configuredPhoneDigits = String(systemConfig.adminPhone || '').replace(/\D/g, '');

    const matchesEmail = ownerEmails.includes(cleanIdentity);
    const matchesPhone =
      identityDigits.length >= 6 &&
      configuredPhoneDigits.length >= 6 &&
      (configuredPhoneDigits === identityDigits ||
        configuredPhoneDigits.endsWith(identityDigits) ||
        identityDigits.endsWith(configuredPhoneDigits));

    if (!matchesEmail && !matchesPhone) {
      return res.status(403).json({
        error: 'El correo o WhatsApp ingresado no coincide con los datos del administrador registrados.'
      });
    }

    const cleanedNewPin = String(newPin || '').trim();
    if (cleanedNewPin && cleanedNewPin.length < 4) {
      return res.status(400).json({ error: 'La nueva clave PIN debe tener al menos 4 caracteres.' });
    }

    const nextPin = cleanedNewPin ? cleanedNewPin.slice(0, 8) : '1234';
    systemConfig = {
      ...systemConfig,
      adminPin: nextPin,
      updatedAt: new Date().toISOString()
    };

    persistConfig();
    console.log(`[Vortex ID Admin] Administrator PIN recovered/reset via ${matchesEmail ? 'email' : 'phone'}.`);
    res.json({ success: true, adminPin: nextPin, config: sanitizeConfig(systemConfig) });
  });

  // Emergency offline bundle containing critical contacts, pharmacies directory, and sanitized config
  app.get('/api/emergency/offline-bundle', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      offlineReady: true,
      city: 'Punta Alta, Coronel Rosales',
      emergencyServices: [
        { id: '911', title: '911 · Policía Comunal', subtitle: 'Emergencias de Seguridad Punta Alta', directDial: '911' },
        { id: '107', title: '107 · SAME y Ambulancia', subtitle: 'Hospital Municipal Eva Perón (Guardia)', directDial: '107' },
        { id: '100', title: '100 · Bomberos Voluntarios', subtitle: 'Cuartel Central Mitre 537', directDial: '100' },
        { id: '103', title: '103 · Defensa Civil', subtitle: 'Temporal / Inundación · Municipio Coronel Rosales', directDial: '103' },
        { id: 'hnpb', title: 'Hospital Naval Puerto Belgrano', subtitle: 'Guardia Médica 24hs', directDial: '02932489600' },
        { id: 'hosp_muni', title: 'Hospital Municipal Eva Perón', subtitle: 'Guardia Adultos y Pediátrica · Uriburu 650', directDial: '02932421222' }
      ],
      pharmaciesCount: 20,
      systemConfig: sanitizeConfig(systemConfig),
      primaryRecord: db.primaryRecord
    });
  });

  const DUTY_FILE = path.join(__dirname, '.duty_schedule.json');
  let customDutySchedule: Record<string, string[]> = {};

  try {
    if (fs.existsSync(DUTY_FILE)) {
      customDutySchedule = JSON.parse(fs.readFileSync(DUTY_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading duty schedule file:', err);
  }

  const persistDutySchedule = () => {
    try {
      fs.writeFileSync(DUTY_FILE, JSON.stringify(customDutySchedule, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving duty schedule file:', err);
    }
  };

  // Get synced duty schedule for all months
  app.get('/api/pharmacies/duty-schedule', (_req: Request, res: Response) => {
    res.json({
      success: true,
      schedule: customDutySchedule,
      updatedAt: new Date().toISOString()
    });
  });

  // Save / Update duty schedule (single date or full month - protected by admin PIN)
  app.post('/api/pharmacies/duty-schedule', (req: Request, res: Response) => {
    if (!isValidAdminPin(req)) {
      return res.status(401).json({ error: 'PIN de administrador requerido para modificar guardias.' });
    }

    const body = req.body as { schedule?: Record<string, string[]>; dateKey?: string; pharmacyIds?: string[] };
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Datos de turno inválidos.' });
    }

    if (body.schedule && typeof body.schedule === 'object') {
      customDutySchedule = {
        ...customDutySchedule,
        ...body.schedule
      };
      persistDutySchedule();
      console.log(`[Vortex ID Duty] Updated ${Object.keys(body.schedule).length} duty dates in schedule.`);
      return res.json({ success: true, schedule: customDutySchedule });
    }

    if (body.dateKey && Array.isArray(body.pharmacyIds)) {
      customDutySchedule[body.dateKey] = body.pharmacyIds;
      persistDutySchedule();
      console.log(`[Vortex ID Duty] Set duty for ${body.dateKey}: ${body.pharmacyIds.join(', ')}`);
      return res.json({ success: true, schedule: customDutySchedule });
    }

    return res.status(400).json({ error: 'Formato esperado: { schedule: { "YYYY-MM-DD": ["f1", "f2"] } }' });
  });

  // Get primary medical record (for device sync)
  app.get('/api/records/primary', (_req: Request, res: Response) => {
    res.json({ success: true, record: db.primaryRecord });
  });

  // Get keychain count publicly; only return PII records when authenticated with admin PIN
  app.get('/api/records/all', (req: Request, res: Response) => {
    const count = Object.keys(db.keychains).length;
    if (req.query.includeRecords === 'true') {
      if (!isValidAdminPin(req)) {
        return res.status(401).json({ error: 'PIN de administrador requerido para listar fichas.' });
      }
      return res.json({
        success: true,
        count,
        primaryRecord: db.primaryRecord,
        keychains: db.keychains
      });
    }
    res.json({
      success: true,
      count
    });
  });

  // --- Subscribers Roster & Billing Database Store (initialized early for auto-enrollment) ---
  interface SubscriberPayload {
    id: string;
    fullName: string;
    dni?: string;
    phone: string;
    altPhone?: string;
    address?: string;
    neighborhood?: string;
    keychainId?: string;
    paymentStatus: 'al_dia' | 'adeuda' | 'prueba' | 'baja';
    planType?: 'individual' | 'familiar' | 'comercio';
    monthlyFee: number;
    lastPaymentAmount?: number;
    lastPaymentDate?: string;
    nextDueDate?: string;
    paymentMethod?: 'mercadopago' | 'transferencia' | 'efectivo' | 'bonificado';
    payerAliasOrName?: string;
    activationCodeDelivered?: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }

  const SUBSCRIBERS_FILE = path.join(__dirname, '.subscribers_db.json');
  let subscribersList: SubscriberPayload[] = [];
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        subscribersList = parsed;
      }
    }
  } catch (err) {
    console.error('Error loading subscribers file:', err);
    subscribersList = [];
  }

  const persistSubscribers = () => {
    try {
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribersList, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving subscribers file:', err);
    }
  };

  const autoUpsertSubscriberFromMedicalRecord = (record: MedicalRecordPayload) => {
    const cleanName = String(record.nombre || '').trim();
    if (!cleanName) return;

    const cleanKey = String(record.keychainId || '').trim().toUpperCase().replace(/^#/, '');
    const cleanDni = String(record.dni || '').trim();
    const cleanDniDigits = cleanDni.replace(/\D/g, '');
    const cleanPhone = String(record.tel || record.cfam || '').trim();
    const cleanAlt = record.cfam && record.cfam !== record.tel ? String(record.cfam).trim() : '';
    const cleanAddress = String(record.domicilio || '').trim();

    if (!cleanPhone && !cleanKey && !cleanDniDigits) return;

    const now = new Date().toISOString();
    const todayDate = now.slice(0, 10);
    const nextMonthDateObj = new Date();
    nextMonthDateObj.setMonth(nextMonthDateObj.getMonth() + 1);
    const nextMonthDate = nextMonthDateObj.toISOString().slice(0, 10);

    const matchIdx = subscribersList.findIndex((s) => {
      if (cleanKey && (s.keychainId || '').toUpperCase() === cleanKey) return true;
      const sDniDigits = (s.dni || '').replace(/\D/g, '');
      if (cleanDniDigits && sDniDigits && sDniDigits === cleanDniDigits) return true;
      return (
        s.fullName.trim().toLowerCase() === cleanName.toLowerCase() &&
        Boolean(cleanPhone) &&
        s.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, '')
      );
    });

    if (matchIdx >= 0) {
      const prev = subscribersList[matchIdx];
      subscribersList[matchIdx] = {
        ...prev,
        fullName: cleanName.slice(0, 140),
        dni: cleanDni ? cleanDni.slice(0, 24) : prev.dni,
        phone: (cleanPhone || prev.phone).slice(0, 40),
        altPhone: cleanAlt ? cleanAlt.slice(0, 40) : prev.altPhone,
        address: cleanAddress ? cleanAddress.slice(0, 200) : prev.address,
        keychainId: cleanKey ? cleanKey.slice(0, 32) : prev.keychainId,
        updatedAt: now
      };
    } else {
      const generatedId = cleanKey
        ? `sub_kc_${cleanKey.replace(/[^a-zA-Z0-9_-]/g, '')}`
        : cleanDniDigits
          ? `sub_dni_${cleanDniDigits}`
          : `sub_app_${Date.now()}`;

      subscribersList.unshift({
        id: generatedId.slice(0, 128),
        fullName: cleanName.slice(0, 140),
        dni: cleanDni.slice(0, 24),
        phone: (cleanPhone || 'Sin teléfono cargado').slice(0, 40),
        altPhone: cleanAlt.slice(0, 40),
        address: cleanAddress.slice(0, 200),
        neighborhood: '',
        keychainId: cleanKey.slice(0, 32),
        paymentStatus: systemConfig.isMembershipRequired ? 'adeuda' : 'prueba',
        planType: 'individual',
        monthlyFee: Number(systemConfig.monthlyFee) || 3000,
        lastPaymentAmount: 0,
        lastPaymentDate: '',
        nextDueDate: systemConfig.isMembershipRequired ? todayDate : nextMonthDate,
        paymentMethod: 'mercadopago',
        payerAliasOrName: '',
        activationCodeDelivered: false,
        notes: 'Cargado automáticamente al registrarse en la aplicación.',
        createdAt: now,
        updatedAt: now
      });
    }
    persistSubscribers();
  };

  // Save / Sync primary medical record (stores photo and all emergency details)
  app.post('/api/records/primary', (req: Request, res: Response) => {
    const record = req.body as MedicalRecordPayload;
    if (!record || typeof record !== 'object') {
      return res.status(400).json({ error: 'Formato de ficha inválido' });
    }

    record.updatedAt = new Date().toISOString();
    // Guarantee photo is preserved if record had one previously
    if (!record.foto && db.primaryRecord?.foto) {
      record.foto = db.primaryRecord.foto;
    }

    db.primaryRecord = record;

    if (record.keychainId && record.keychainId.trim()) {
      const cleanKey = record.keychainId.trim().toUpperCase().replace(/^#/, '');
      db.keychains[cleanKey] = record;
    }

    persistDb();
    autoUpsertSubscriberFromMedicalRecord(record);
    console.log(`[Vortex ID Sync] Primary record updated: ${record.nombre || 'Sin nombre'} (Photo: ${record.foto ? 'YES' : 'NO'}, Keychain: ${record.keychainId || 'NONE'})`);
    res.json({ success: true, record });
  });

  // Query medical record by correlative keychain ID (#0042)
  app.get('/api/records/keychain/:id', (req: Request, res: Response) => {
    const rawId = req.params.id;
    const cleanId = String(rawId).trim().toUpperCase().replace(/^#/, '');

    const record = db.keychains[cleanId] || (
      db.primaryRecord?.keychainId?.toUpperCase() === cleanId ? db.primaryRecord : null
    );

    if (record) {
      res.json({ found: true, record });
    } else {
      res.status(404).json({ found: false, message: `Llavero #${cleanId} aún no fue vinculado.` });
    }
  });

  // Delete / Reset primary record
  app.delete('/api/records/primary', (_req: Request, res: Response) => {
    db.primaryRecord = null;
    persistDb();
    console.log('[Vortex ID] Primary record cleared');
    res.json({ success: true, message: 'Ficha médica primaria eliminada' });
  });

  // Geocoding endpoint to resolve any address or corner in Punta Alta or across Argentina
  app.get('/api/geocode', async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    const clean = q.toLowerCase().trim();

    // 1. Exact local matches for Punta Alta (instant zero-latency response)
    const exactMatches: Record<string, { lat: number; lng: number; label: string }> = {
      'colon 414': { lat: -38.882207, lng: -62.083263, label: 'Colón 414, Punta Alta' },
      'colón 414': { lat: -38.882207, lng: -62.083263, label: 'Colón 414, Punta Alta' },
      'colon 415': { lat: -38.882207, lng: -62.083263, label: 'Colón 415, Punta Alta' },
      'colón 415': { lat: -38.882207, lng: -62.083263, label: 'Colón 415, Punta Alta' },
      '25 de mayo 345': { lat: -38.882494, lng: -62.078526, label: '25 de Mayo 345 (Farmacia Fontanarrosa), Punta Alta' },
      'colon y rivadavia': { lat: -38.880805, lng: -62.080533, label: 'Colón y Rivadavia (Farmacia Argentina)' },
      'colón y rivadavia': { lat: -38.880805, lng: -62.080533, label: 'Colón y Rivadavia (Farmacia Argentina)' },
      'rivadavia 199': { lat: -38.880805, lng: -62.080533, label: 'Rivadavia 199 (esq. Colón), Punta Alta' },
      'espora 428': { lat: -38.880344, lng: -62.072798, label: 'Espora 428 (Farmacia García), Punta Alta' },
      'brown 502': { lat: -38.879905, lng: -62.076123, label: 'Brown 502 (Farmacia Veron), Punta Alta' },
      'tucuman 138': { lat: -38.881948, lng: -62.062903, label: 'Av. Tucumán 138 (Maciel - Acceso Ruta 249), Punta Alta' }
    };
    for (const [key, val] of Object.entries(exactMatches)) {
      if (clean.includes(key)) {
        return res.json({ success: true, ...val, source: 'exact_calibrated' });
      }
    }

    // 2. Query Nominatim OpenStreetMap for real-world geocoding in Argentina
    try {
      const searchQuery = clean.includes('punta alta') || clean.includes('argentina')
        ? clean
        : `${clean}, Punta Alta, Buenos Aires, Argentina`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&q=${encodeURIComponent(searchQuery)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VortexID-EmergencyApp/1.0 (contact@vortexid.org)'
        }
      });
      clearTimeout(timer);
      if (resp.ok) {
        const results = await resp.json();
        if (Array.isArray(results) && results.length > 0) {
          const first = results[0];
          return res.json({
            success: true,
            lat: parseFloat(first.lat),
            lng: parseFloat(first.lon),
            label: first.display_name.split(',').slice(0, 3).join(','),
            source: 'openstreetmap'
          });
        }
      }
    } catch (err) {
      console.warn('[Geocode API Error]', err);
    }

    // Not found: do NOT pretend Plaza Belgrano is the requested street
    res.json({
      success: false,
      found: false,
      error: 'No pudimos ubicar esa dirección exacta en Punta Alta.',
      source: 'not_found'
    });
  });

  // Link a physical keychain number to a record
  app.post('/api/records/link', (req: Request, res: Response) => {
    const { keychainId, record } = req.body as { keychainId?: string; record?: MedicalRecordPayload };
    if (!keychainId || !record) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    const cleanId = String(keychainId).trim().toUpperCase().replace(/^#/, '');
    const updatedRecord: MedicalRecordPayload = {
      ...record,
      keychainId: cleanId,
      foto: record.foto || db.primaryRecord?.foto || DEFAULT_VERIFIED_PHOTO,
      updatedAt: new Date().toISOString()
    };

    db.keychains[cleanId] = updatedRecord;
    db.primaryRecord = updatedRecord;
    persistDb();
    autoUpsertSubscriberFromMedicalRecord(updatedRecord);

    console.log(`[Vortex ID Link] Keychain #${cleanId} linked to ${record.nombre || 'titular'}`);
    res.json({ success: true, record: updatedRecord });
  });

  // --- Subscribers Roster & Billing Database API (Admin PIN Protected) ---
  app.get('/api/subscribers', (req: Request, res: Response) => {
    if (!isValidAdminPin(req)) {
      return res.status(401).json({ error: 'PIN de administrador requerido para consultar el padrón de suscriptores.' });
    }
    res.json({ success: true, subscribers: subscribersList });
  });

  app.post('/api/subscribers', (req: Request, res: Response) => {
    if (!isValidAdminPin(req)) {
      return res.status(401).json({ error: 'PIN de administrador requerido para guardar suscriptores.' });
    }
    const body = req.body as Partial<SubscriberPayload>;
    if (!body || typeof body !== 'object' || !String(body.fullName || '').trim() || !String(body.phone || '').trim()) {
      return res.status(400).json({ error: 'Nombre completo y número de celular son obligatorios.' });
    }

    const now = new Date().toISOString();
    const id = String(body.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 128);

    const existingIdx = subscribersList.findIndex((s) => s.id === id);
    const createdAt = existingIdx >= 0 ? subscribersList[existingIdx].createdAt : (body.createdAt || now);

    const record: SubscriberPayload = {
      id,
      fullName: String(body.fullName).trim().slice(0, 140),
      dni: String(body.dni || '').trim().slice(0, 24),
      phone: String(body.phone).trim().slice(0, 40),
      altPhone: String(body.altPhone || '').trim().slice(0, 40),
      address: String(body.address || '').trim().slice(0, 200),
      neighborhood: String(body.neighborhood || '').trim().slice(0, 80),
      keychainId: String(body.keychainId || '').trim().toUpperCase().replace(/^#/, '').slice(0, 32),
      paymentStatus:
        body.paymentStatus === 'al_dia' ||
        body.paymentStatus === 'adeuda' ||
        body.paymentStatus === 'prueba' ||
        body.paymentStatus === 'baja'
          ? body.paymentStatus
          : 'adeuda',
      planType:
        body.planType === 'familiar' || body.planType === 'comercio' ? body.planType : 'individual',
      monthlyFee: Math.max(0, Math.min(10000000, Number(body.monthlyFee ?? systemConfig.monthlyFee) || 0)),
      lastPaymentAmount:
        body.lastPaymentAmount !== undefined && body.lastPaymentAmount !== null
          ? Math.max(0, Math.min(10000000, Number(body.lastPaymentAmount) || 0))
          : 0,
      lastPaymentDate: String(body.lastPaymentDate || '').trim().slice(0, 32),
      nextDueDate: String(body.nextDueDate || '').trim().slice(0, 32),
      paymentMethod:
        body.paymentMethod === 'transferencia' ||
        body.paymentMethod === 'efectivo' ||
        body.paymentMethod === 'bonificado'
          ? body.paymentMethod
          : 'mercadopago',
      payerAliasOrName: String(body.payerAliasOrName || '').trim().slice(0, 120),
      activationCodeDelivered: Boolean(body.activationCodeDelivered),
      notes: String(body.notes || '').trim().slice(0, 500),
      createdAt,
      updatedAt: now
    };

    if (existingIdx >= 0) {
      subscribersList[existingIdx] = record;
    } else {
      subscribersList.unshift(record);
    }
    persistSubscribers();
    res.json({ success: true, subscriber: record });
  });

  app.delete('/api/subscribers/:id', (req: Request, res: Response) => {
    if (!isValidAdminPin(req)) {
      return res.status(401).json({ error: 'PIN de administrador requerido para eliminar suscriptores.' });
    }
    const targetId = String(req.params.id || '').trim();
    const before = subscribersList.length;
    subscribersList = subscribersList.filter((s) => s.id !== targetId);
    if (subscribersList.length !== before) {
      persistSubscribers();
    }
    res.json({ success: true, removed: before !== subscribersList.length });
  });

  // --- Push Notifications API ---
  const ALERTS_FILE = path.join(__dirname, '.alerts_db.json');
  let pushAlerts: any[] = [];
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      pushAlerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
    }
  } catch {
    pushAlerts = [];
  }

  const persistAlerts = () => {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(pushAlerts.slice(0, 50), null, 2), 'utf-8');
    } catch {
      // ignore
    }
  };

  // Get push notification alert history
  app.get('/api/push/history', (_req: Request, res: Response) => {
    res.json({ success: true, alerts: pushAlerts });
  });

  // Real-time System Telemetry & Gemini API Probe (cached 30s unless ?force=1)
  let geminiProbeCache: {
    checkedAtMs: number;
    payload: {
      configured: boolean;
      status: 'nominal' | 'error' | 'unconfigured';
      httpStatus?: number;
      latencyMs: number | null;
      detail: string;
    };
  } | null = null;

  app.get('/api/telemetry/status', async (req: Request, res: Response) => {
    const force = req.query.force === '1';
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const nowMs = Date.now();

    let geminiStatus: {
      configured: boolean;
      status: 'nominal' | 'error' | 'unconfigured';
      httpStatus?: number;
      latencyMs: number | null;
      detail: string;
    };

    if (!apiKey) {
      geminiStatus = {
        configured: false,
        status: 'unconfigured',
        latencyMs: null,
        detail: 'Clave GEMINI_API_KEY no configurada en las variables de entorno.'
      };
    } else if (!force && geminiProbeCache && nowMs - geminiProbeCache.checkedAtMs < 30000) {
      geminiStatus = geminiProbeCache.payload;
    } else {
      const startMs = Date.now();
      try {
        const probeRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
          {
            method: 'GET',
            headers: { 'x-goog-api-key': apiKey },
            signal: AbortSignal.timeout(4000)
          }
        );
        const latencyMs = Math.max(1, Date.now() - startMs);
        if (probeRes.ok) {
          geminiStatus = {
            configured: true,
            status: 'nominal',
            httpStatus: probeRes.status,
            latencyMs,
            detail: `Endpoint generativelanguage.googleapis.com operativo (HTTP ${probeRes.status}).`
          };
        } else {
          geminiStatus = {
            configured: true,
            status: 'error',
            httpStatus: probeRes.status,
            latencyMs,
            detail: `Gemini API respondió HTTP ${probeRes.status}. Verificá cuota o permisos de clave.`
          };
        }
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - startMs);
        geminiStatus = {
          configured: true,
          status: 'error',
          latencyMs,
          detail: err instanceof Error ? err.message : 'Timeout al contactar Gemini API.'
        };
      }
      geminiProbeCache = { checkedAtMs: nowMs, payload: geminiStatus };
    }

    const mem = process.memoryUsage();
    res.json({
      success: true,
      time: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
      keychainsCount: Object.keys(db.keychains || {}).length,
      pushAlertsCount: Array.isArray(pushAlerts) ? pushAlerts.length : 0,
      gemini: geminiStatus
    });
  });

  // Broadcast push alert to users and store (emergency SOS allowed; admin broadcasts require PIN)
  app.post('/api/push/broadcast', (req: Request, res: Response) => {
    const alert = req.body;
    if (!alert || !alert.title || !alert.body) {
      return res.status(400).json({ error: 'Título y mensaje requeridos.' });
    }

    const isEmergencyAlert = alert.type === 'emergency' || alert.urgent === true;
    if (!isEmergencyAlert && !isValidAdminPin(req)) {
      return res.status(401).json({ error: 'PIN de administrador requerido para emitir comunicados generales.' });
    }

    const newAlert = {
      id: alert.id || `alert-${Date.now()}`,
      type: alert.type || 'general',
      title: alert.title,
      body: alert.body,
      timestamp: alert.timestamp || new Date().toISOString(),
      dataUrl: alert.dataUrl || '/',
      urgent: Boolean(alert.urgent)
    };

    pushAlerts.unshift(newAlert);
    if (pushAlerts.length > 50) pushAlerts = pushAlerts.slice(0, 50);
    persistAlerts();

    console.log(`[Vortex ID Push] Alert Broadcasted: [${newAlert.type.toUpperCase()}] ${newAlert.title}`);
    res.json({ success: true, alert: newAlert });
  });

  // Vite Integration
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Vortex ID Server online at http://0.0.0.0:${PORT} (Monthly Fee: $${systemConfig.monthlyFee})`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
