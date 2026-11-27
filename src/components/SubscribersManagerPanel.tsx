import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserPlus,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Pencil,
  Trash2,
  Check,
  X,
  DatabaseBackup,
  ShieldCheck
} from 'lucide-react';
import {
  SubscriberData,
  SubscriberPaymentStatus,
  SubscriberPlanType,
  SubscriberPaymentMethod,
  loadSubscribers,
  saveSubscriberRecord,
  deleteSubscriberRecord,
  importSubscribersFromLinkedKeychains,
  buildSubscriberWhatsAppUrl,
  exportSubscribersCsv,
  isSubscriberOverdue,
  isDateExpiredOnly,
  getTodayIsoDate,
  addOneMonthIsoDate
} from '../utils/subscribersService';
import { SystemConfig, formatCurrency } from '../utils/systemConfig';
import { playChirp } from '../utils/callHandler';

interface SubscribersManagerPanelProps {
  systemConfig: SystemConfig;
  adminPin: string;
  activationCodeInput: string;
  isAdmin: boolean;
  onSignInGoogle: () => void;
  onCountsChange?: (total: number, overdue: number) => void;
}

type SubscriberFilterTab = 'all' | 'al_dia' | 'adeuda' | 'prueba' | 'baja';

interface SubscriberFormState {
  id: string;
  fullName: string;
  dni: string;
  phone: string;
  altPhone: string;
  address: string;
  neighborhood: string;
  keychainId: string;
  paymentStatus: SubscriberPaymentStatus;
  planType: SubscriberPlanType;
  monthlyFee: number;
  lastPaymentAmount: number;
  lastPaymentDate: string;
  nextDueDate: string;
  paymentMethod: SubscriberPaymentMethod;
  payerAliasOrName: string;
  activationCodeDelivered: boolean;
  notes: string;
  createdAt: string;
}

function createEmptyForm(defaultFee: number): SubscriberFormState {
  const today = getTodayIsoDate();
  return {
    id: '',
    fullName: '',
    dni: '',
    phone: '',
    altPhone: '',
    address: '',
    neighborhood: '',
    keychainId: '',
    paymentStatus: 'al_dia',
    planType: 'individual',
    monthlyFee: defaultFee,
    lastPaymentAmount: defaultFee,
    lastPaymentDate: today,
    nextDueDate: addOneMonthIsoDate(today),
    paymentMethod: 'mercadopago',
    payerAliasOrName: '',
    activationCodeDelivered: false,
    notes: '',
    createdAt: ''
  };
}

function getPaymentStatusMeta(sub: SubscriberData): {
  glyph: string;
  label: string;
  textClass: string;
} {
  if (sub.paymentStatus === 'adeuda') {
    return { glyph: '✖', label: 'Adeuda', textClass: 'text-rose-700 dark:text-rose-400' };
  }
  if (isDateExpiredOnly(sub)) {
    return { glyph: '▲', label: 'Vencido', textClass: 'text-amber-700 dark:text-amber-400' };
  }
  if (sub.paymentStatus === 'al_dia') {
    return { glyph: '●', label: 'Al Día', textClass: 'text-emerald-700 dark:text-emerald-400' };
  }
  if (sub.paymentStatus === 'prueba') {
    return { glyph: '◌', label: 'Prueba', textClass: 'text-sky-700 dark:text-cyan-400' };
  }
  return { glyph: '—', label: 'Baja', textClass: 'text-slate-600 dark:text-slate-400' };
}

export const SubscribersManagerPanel: React.FC<SubscribersManagerPanelProps> = ({
  systemConfig,
  adminPin,
  activationCodeInput,
  isAdmin,
  onSignInGoogle,
  onCountsChange
}) => {
  const [subscribers, setSubscribers] = useState<SubscriberData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<SubscriberFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState<SubscriberFormState>(() =>
    createEmptyForm(systemConfig.monthlyFee)
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const onCountsChangeRef = useRef(onCountsChange);
  onCountsChangeRef.current = onCountsChange;

  const showBanner = (type: 'ok' | 'warn' | 'err', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadSubscribers(adminPin);
      let currentList = res.subscribers;
      setSubscribers(currentList);
      setCloudSynced(res.cloudSynced);

      // Carga automática de titulares registrados en la app (llaveros y cuentas Google)
      const syncRes = await importSubscribersFromLinkedKeychains(
        currentList,
        systemConfig.monthlyFee,
        adminPin,
        systemConfig.isMembershipRequired
      );
      if (syncRes.importedCount > 0) {
        currentList = syncRes.subscribers;
        setSubscribers(currentList);
        showBanner(
          'ok',
          `Se cargaron automáticamente ${syncRes.importedCount} titular${syncRes.importedCount === 1 ? '' : 'es'} desde registros de la aplicación.`
        );
      }
    } finally {
      setLoading(false);
    }
  }, [adminPin, systemConfig.monthlyFee, systemConfig.isMembershipRequired]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster, isAdmin]);

  const metrics = useMemo(() => {
    let alDiaCount = 0;
    let overdueCount = 0;
    let trialOrOffCount = 0;
    let collectedMonthly = 0;
    let pendingDebt = 0;

    for (const s of subscribers) {
      if (isSubscriberOverdue(s)) {
        overdueCount++;
        pendingDebt += Number(s.monthlyFee) || 0;
      } else if (s.paymentStatus === 'al_dia') {
        alDiaCount++;
        collectedMonthly += Number(s.monthlyFee) || 0;
      } else {
        trialOrOffCount++;
      }
    }

    return {
      total: subscribers.length,
      alDiaCount,
      overdueCount,
      trialOrOffCount,
      collectedMonthly,
      pendingDebt
    };
  }, [subscribers]);

  useEffect(() => {
    onCountsChangeRef.current?.(metrics.total, metrics.overdueCount);
  }, [metrics.total, metrics.overdueCount]);

  const filteredSubscribers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subscribers.filter((sub) => {
      if (filterTab === 'al_dia' && (sub.paymentStatus !== 'al_dia' || isSubscriberOverdue(sub))) {
        return false;
      }
      if (filterTab === 'adeuda' && !isSubscriberOverdue(sub)) {
        return false;
      }
      if (filterTab === 'prueba' && sub.paymentStatus !== 'prueba') {
        return false;
      }
      if (filterTab === 'baja' && sub.paymentStatus !== 'baja') {
        return false;
      }
      if (q) {
        const hay = `${sub.fullName} ${sub.dni || ''} ${sub.phone} ${sub.address || ''} ${sub.neighborhood || ''} ${sub.keychainId || ''} ${sub.payerAliasOrName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [subscribers, filterTab, searchQuery]);

  const handleOpenNew = () => {
    playChirp('click');
    setFormState(createEmptyForm(systemConfig.monthlyFee));
    setIsFormOpen(true);
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 40);
  };

  const handleOpenEdit = (sub: SubscriberData) => {
    playChirp('click');
    setFormState({
      id: sub.id,
      fullName: sub.fullName,
      dni: sub.dni || '',
      phone: sub.phone,
      altPhone: sub.altPhone || '',
      address: sub.address || '',
      neighborhood: sub.neighborhood || '',
      keychainId: sub.keychainId || '',
      paymentStatus: sub.paymentStatus,
      planType: sub.planType || 'individual',
      monthlyFee: sub.monthlyFee,
      lastPaymentAmount: sub.lastPaymentAmount ?? sub.monthlyFee,
      lastPaymentDate: sub.lastPaymentDate || '',
      nextDueDate: sub.nextDueDate || '',
      paymentMethod: sub.paymentMethod || 'mercadopago',
      payerAliasOrName: sub.payerAliasOrName || '',
      activationCodeDelivered: Boolean(sub.activationCodeDelivered),
      notes: sub.notes || '',
      createdAt: sub.createdAt
    });
    setIsFormOpen(true);
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 40);
  };

  const handleSaveForm = async () => {
    if (!formState.fullName.trim() || !formState.phone.trim()) {
      showBanner('err', 'Nombre completo y número de celular son obligatorios.');
      return;
    }

    setSaving(true);
    playChirp('click');
    try {
      const now = new Date().toISOString();
      const payload: SubscriberData = {
        id: formState.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fullName: formState.fullName.trim(),
        dni: formState.dni.trim(),
        phone: formState.phone.trim(),
        altPhone: formState.altPhone.trim(),
        address: formState.address.trim(),
        neighborhood: formState.neighborhood.trim(),
        keychainId: formState.keychainId.trim().toUpperCase().replace(/^#/, ''),
        paymentStatus: formState.paymentStatus,
        planType: formState.planType,
        monthlyFee: Number(formState.monthlyFee) || 0,
        lastPaymentAmount: Number(formState.lastPaymentAmount) || 0,
        lastPaymentDate: formState.lastPaymentDate,
        nextDueDate: formState.nextDueDate,
        paymentMethod: formState.paymentMethod,
        payerAliasOrName: formState.payerAliasOrName.trim(),
        activationCodeDelivered: formState.activationCodeDelivered,
        notes: formState.notes.trim(),
        createdAt: formState.createdAt || now,
        updatedAt: now
      };

      const res = await saveSubscriberRecord(payload, adminPin);
      setSubscribers((prev) => {
        const exists = prev.some((s) => s.id === res.subscriber.id);
        return exists
          ? prev.map((s) => (s.id === res.subscriber.id ? res.subscriber : s))
          : [res.subscriber, ...prev];
      });
      setCloudSynced(res.syncedToCloud);
      setIsFormOpen(false);
      playChirp('success');
      showBanner(
        res.syncedToCloud ? 'ok' : 'warn',
        res.syncedToCloud
          ? `${res.subscriber.fullName} guardado y sincronizado en la nube.`
          : `${res.subscriber.fullName} guardado localmente. Conectá Google Admin para sincronizar en Netlify.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickMarkPaid = async (sub: SubscriberData) => {
    playChirp('click');
    const today = getTodayIsoDate();
    const baseNext =
      sub.nextDueDate && sub.nextDueDate >= today ? sub.nextDueDate : today;
    const updated: SubscriberData = {
      ...sub,
      paymentStatus: 'al_dia',
      lastPaymentDate: today,
      lastPaymentAmount: sub.monthlyFee || systemConfig.monthlyFee,
      nextDueDate: addOneMonthIsoDate(baseNext),
      updatedAt: new Date().toISOString()
    };
    const res = await saveSubscriberRecord(updated, adminPin);
    setSubscribers((prev) => prev.map((s) => (s.id === res.subscriber.id ? res.subscriber : s)));
    setCloudSynced(res.syncedToCloud);
    playChirp('success');
    showBanner(
      'ok',
      `Pago registrado para ${sub.fullName}. Próximo vencimiento: ${res.subscriber.nextDueDate}.`
    );
  };

  const handleQuickMarkDebt = async (sub: SubscriberData) => {
    playChirp('click');
    const updated: SubscriberData = {
      ...sub,
      paymentStatus: 'adeuda',
      updatedAt: new Date().toISOString()
    };
    const res = await saveSubscriberRecord(updated, adminPin);
    setSubscribers((prev) => prev.map((s) => (s.id === res.subscriber.id ? res.subscriber : s)));
    setCloudSynced(res.syncedToCloud);
    showBanner('warn', `${sub.fullName} marcado como ADEUDA.`);
  };

  const handleDeleteSubscriber = async (subscriberId: string) => {
    playChirp('click');
    await deleteSubscriberRecord(subscriberId, adminPin);
    setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
    setConfirmDeleteId(null);
    showBanner('ok', 'Suscriptor eliminado del padrón.');
  };

  const handleImportFromKeychains = async () => {
    setImporting(true);
    playChirp('click');
    try {
      const res = await importSubscribersFromLinkedKeychains(
        subscribers,
        systemConfig.monthlyFee,
        adminPin,
        systemConfig.isMembershipRequired
      );
      setSubscribers(res.subscribers);
      if (res.importedCount > 0) {
        playChirp('success');
        showBanner(
          'ok',
          `Se sincronizaron ${res.importedCount} titular${res.importedCount === 1 ? '' : 'es'} nuevos desde la aplicación.`
        );
      } else {
        showBanner('warn', 'Padrón actualizado: no hay registros nuevos en la nube o servidor.');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = () => {
    playChirp('click');
    const csv = exportSubscribersCsv(filteredSubscribers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vortex_suscriptores_${getTodayIsoDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Google Admin Cloud Sync Reminder if not connected */}
      {!isAdmin && (
        <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0B111E] border border-amber-300 dark:border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-700 dark:text-amber-300">
            Conectá Google Admin (omlupa@gmail.com) para sincronizar automáticamente los registros de Netlify y guardar cobranzas en la nube.
          </span>
          <button
            type="button"
            onClick={onSignInGoogle}
            className="px-3 py-1.5 rounded-lg bg-white text-slate-950 font-semibold text-xs hover:bg-slate-200 transition shrink-0"
          >
            Conectar Google Admin
          </button>
        </div>
      )}

      {/* Action & Filter Toolbar + Inline Alta Form First */}
      <section className="rounded-xl bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-[#1C2A45] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1C2A45] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Base de Datos de Suscriptores y Cobranzas
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Alta directa, carga automática desde la app, pagos, vencimientos, dirección, celular y llavero QR
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleImportFromKeychains}
              disabled={importing}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0E1627] hover:bg-slate-100 dark:hover:bg-[#15223B] border border-slate-200 dark:border-[#1C2A45] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <DatabaseBackup className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400" />
              <span>{importing ? 'Sincronizando…' : 'Sincronizar App'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredSubscribers.length === 0}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0E1627] hover:bg-slate-100 dark:hover:bg-[#15223B] border border-slate-200 dark:border-[#1C2A45] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNew}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo Suscriptor</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`px-4 py-2 text-xs border-b border-slate-200 dark:border-[#1C2A45] flex items-center justify-between gap-2 ${
              feedbackMsg.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : feedbackMsg.type === 'warn'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              aria-label="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Add / Edit Drawer Panel (Positioned right below toolbar for instant Alta access) */}
        {isFormOpen && (
          <div ref={formSectionRef} className="p-4 bg-slate-50 dark:bg-[#070B14] border-b border-slate-200 dark:border-[#1C2A45] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-sky-700 dark:text-cyan-300">
                {formState.id ? `Editar Suscriptor · ${formState.fullName}` : 'Alta de Nuevo Suscriptor'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  maxLength={140}
                  value={formState.fullName}
                  onChange={(e) => setFormState((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Ej: María Laura Fernández"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Nro. de Celular *</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={formState.phone}
                  onChange={(e) => setFormState((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Ej: 2932456789"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">DNI</label>
                <input
                  type="text"
                  maxLength={24}
                  value={formState.dni}
                  onChange={(e) => setFormState((p) => ({ ...p, dni: e.target.value }))}
                  placeholder="Ej: 32.450.112"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Dirección (Calle y Altura)</label>
                <input
                  type="text"
                  maxLength={200}
                  value={formState.address}
                  onChange={(e) => setFormState((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Ej: Bernardo de Irigoyen 620, Punta Alta"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Barrio / Zona</label>
                <input
                  type="text"
                  maxLength={80}
                  value={formState.neighborhood}
                  onChange={(e) => setFormState((p) => ({ ...p, neighborhood: e.target.value }))}
                  placeholder="Ej: Centro, Villa Mora, Ciudad Atlántida"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">N° de Llavero QR</label>
                <input
                  type="text"
                  maxLength={32}
                  value={formState.keychainId}
                  onChange={(e) =>
                    setFormState((p) => ({
                      ...p,
                      keychainId: e.target.value.toUpperCase().replace(/^#/, '')
                    }))
                  }
                  placeholder="Ej: 0042"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-sky-700 dark:text-cyan-300 uppercase focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Estado de Pago</label>
                <select
                  value={formState.paymentStatus}
                  onChange={(e) =>
                    setFormState((p) => ({
                      ...p,
                      paymentStatus: e.target.value as SubscriberPaymentStatus
                    }))
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                >
                  <option value="al_dia">Al Día (Pagó)</option>
                  <option value="adeuda">Adeuda</option>
                  <option value="prueba">En Prueba (Sin Cargo)</option>
                  <option value="baja">Baja / Suspendido</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Tipo de Plan</label>
                <select
                  value={formState.planType}
                  onChange={(e) =>
                    setFormState((p) => ({
                      ...p,
                      planType: e.target.value as SubscriberPlanType
                    }))
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                >
                  <option value="individual">Individual</option>
                  <option value="familiar">Grupo Familiar</option>
                  <option value="comercio">Comercio / Sponsor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Cuota Mensual ($ ARS)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={formState.monthlyFee}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, monthlyFee: Number(e.target.value) || 0 }))
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono tabular-nums text-amber-700 dark:text-amber-300 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Medio de Pago</label>
                <select
                  value={formState.paymentMethod}
                  onChange={(e) =>
                    setFormState((p) => ({
                      ...p,
                      paymentMethod: e.target.value as SubscriberPaymentMethod
                    }))
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                >
                  <option value="mercadopago">Mercado Pago / Alias</option>
                  <option value="transferencia">Transferencia CBU/CVU</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="bonificado">Bonificado</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Fecha Último Pago</label>
                <input
                  type="date"
                  value={formState.lastPaymentDate}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, lastPaymentDate: e.target.value }))
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Próximo Vencimiento</label>
                <input
                  type="date"
                  value={formState.nextDueDate}
                  onChange={(e) => setFormState((p) => ({ ...p, nextDueDate: e.target.value }))}
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Titular Transferencia / MP</label>
                <input
                  type="text"
                  maxLength={120}
                  value={formState.payerAliasOrName}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, payerAliasOrName: e.target.value }))
                  }
                  placeholder="Si paga otra persona (ej: cónyuge)"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Tel. Alternativo / Familiar</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={formState.altPhone}
                  onChange={(e) => setFormState((p) => ({ ...p, altPhone: e.target.value }))}
                  placeholder="Ej: 2932419988"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Observaciones Internas</label>
                <input
                  type="text"
                  maxLength={500}
                  value={formState.notes}
                  onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Ej: Paga del 1 al 10, llavero entregado en mano…"
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                />
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formState.activationCodeDelivered}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, activationCodeDelivered: e.target.checked }))
                    }
                    className="accent-cyan-400 rounded"
                  />
                  <span>Código de Alta entregado</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#1C2A45]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-[#1C2A45] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Guardando…' : 'Guardar en Base de Datos'}</span>
              </button>
            </div>
          </div>
        )}

        {/* KPI Metrics Strip (1px hairline border grid, tabular numerals) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 dark:border-[#1C2A45] divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#1C2A45] bg-white dark:bg-[#080D18]">
          <div className="p-3">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">Padrón Total</span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {metrics.total}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">suscriptores</span>
            </div>
          </div>

          <div className="p-3">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">Al Día (Pagaron)</span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-lg font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                {metrics.alDiaCount}
              </span>
              <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatCurrency(metrics.collectedMonthly)}
              </span>
            </div>
          </div>

          <div className="p-3">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">Adeudan / Vencidos</span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-lg font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                {metrics.overdueCount}
              </span>
              <span className="text-xs font-mono tabular-nums text-rose-700 dark:text-rose-300">
                {formatCurrency(metrics.pendingDebt)}
              </span>
            </div>
          </div>

          <div className="p-3">
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">Prueba / Baja</span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-lg font-mono tabular-nums font-bold text-sky-700 dark:text-cyan-300">
                {metrics.trialOrOffCount}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {cloudSynced ? '● Nube OK' : '▲ Local'}
              </span>
            </div>
          </div>
        </div>

        {/* Segmented Filters & Search */}
        <div className="px-4 py-2.5 bg-white dark:bg-[#080D18] border-b border-slate-200 dark:border-[#1C2A45] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] rounded-lg overflow-x-auto">
            {[
              { id: 'all' as SubscriberFilterTab, label: `Todos (${metrics.total})` },
              { id: 'al_dia' as SubscriberFilterTab, label: `Al Día (${metrics.alDiaCount})` },
              { id: 'adeuda' as SubscriberFilterTab, label: `Adeudan (${metrics.overdueCount})` },
              { id: 'prueba' as SubscriberFilterTab, label: 'Prueba' },
              { id: 'baja' as SubscriberFilterTab, label: 'Baja' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterTab === tab.id
                    ? 'bg-sky-100 dark:bg-cyan-500/20 text-sky-800 dark:text-cyan-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nombre, DNI, cel, dirección…"
                className="w-full py-1.5 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
              />
            </div>
            <button
              type="button"
              onClick={fetchRoster}
              disabled={loading}
              title="Recargar padrón"
              className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#05080F] border border-slate-200 dark:border-[#1C2A45] text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="overflow-x-auto bg-slate-50 dark:bg-[#05080F]">
          {loading ? (
            <div className="p-6 space-y-2.5">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-11 rounded-lg bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-[#1C2A45] animate-pulse"
                />
              ))}
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {subscribers.length === 0
                  ? 'Todavía no hay suscriptores cargados en la base de datos.'
                  : 'Ningún suscriptor coincide con el filtro o búsqueda actual.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenNew}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Cargar Primer Suscriptor</span>
                </button>
                {subscribers.length === 0 && (
                  <button
                    type="button"
                    onClick={handleImportFromKeychains}
                    className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-[#1C2A45] text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-medium text-xs inline-flex items-center gap-1.5"
                  >
                    <DatabaseBackup className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400" />
                    <span>Sincronizar registros de la App</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1C2A45] bg-white dark:bg-[#080D18] text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-3">Titular / Llavero</th>
                  <th className="py-2.5 px-3">Celular y Dirección</th>
                  <th className="py-2.5 px-3">Estado y Vencimiento</th>
                  <th className="py-2.5 px-3 text-right">Cuota</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#131C30]">
                {filteredSubscribers.map((sub) => {
                  const statusMeta = getPaymentStatusMeta(sub);
                  const overdue = isSubscriberOverdue(sub);
                  const waUrl = buildSubscriberWhatsAppUrl(
                    sub,
                    systemConfig,
                    activationCodeInput
                  );
                  const isDeleting = confirmDeleteId === sub.id;

                  return (
                    <tr key={sub.id} className="hover:bg-slate-100 dark:hover:bg-[#0A101E] transition-colors align-top">
                      <td className="py-2.5 px-3 min-w-[170px]">
                        <div className="font-semibold text-slate-900 dark:text-white">{sub.fullName}</div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
                          {sub.keychainId && (
                            <span className="text-sky-700 dark:text-cyan-300">#{sub.keychainId}</span>
                          )}
                          {sub.dni && <span>DNI {sub.dni}</span>}
                          {sub.activationCodeDelivered && (
                            <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" /> Alta OK
                            </span>
                          )}
                        </div>
                        {sub.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {sub.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 min-w-[180px]">
                        <div className="font-mono tabular-nums text-slate-700 dark:text-slate-200">{sub.phone}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          {sub.address || 'Sin dirección'}
                          {sub.neighborhood ? ` · ${sub.neighborhood}` : ''}
                        </div>
                        {sub.payerAliasOrName && (
                          <div className="text-[11px] text-slate-500">
                            Transf.: {sub.payerAliasOrName}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 min-w-[155px] font-mono tabular-nums">
                        <div className={`font-semibold ${statusMeta.textClass}`}>
                          {statusMeta.glyph} {statusMeta.label}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {sub.nextDueDate ? `Vence: ${sub.nextDueDate}` : 'Sin vencimiento'}
                        </div>
                        {sub.lastPaymentDate && (
                          <div className="text-[11px] text-slate-500">
                            Últ. pago: {sub.lastPaymentDate}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(sub.monthlyFee)}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {sub.planType || 'individual'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[11px] text-rose-700 dark:text-rose-300">¿Borrar?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubscriber(sub.id)}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-white dark:bg-[#0E1627] border border-slate-200 dark:border-[#1C2A45] text-slate-700 dark:text-slate-300 text-[11px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickMarkPaid(sub)}
                              title="Registrar pago de hoy (+1 mes)"
                              className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Pagó</span>
                            </button>

                            {!overdue && sub.paymentStatus !== 'baja' && (
                              <button
                                type="button"
                                onClick={() => handleQuickMarkDebt(sub)}
                                title="Marcar como adeuda"
                                className="p-1.5 rounded-md bg-white dark:bg-[#0E1627] hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-[#1C2A45] text-amber-700 dark:text-amber-300 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => playChirp('click')}
                              title={
                                overdue
                                  ? 'Enviar recordatorio de cuota por WhatsApp'
                                  : 'Enviar confirmación / Código de Alta por WhatsApp'
                              }
                              className="p-1.5 rounded-md bg-white dark:bg-[#0E1627] hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-[#1C2A45] text-emerald-700 dark:text-emerald-400 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(sub)}
                              title="Editar suscriptor"
                              className="p-1.5 rounded-md bg-white dark:bg-[#0E1627] hover:bg-slate-100 dark:hover:bg-[#15223B] border border-slate-200 dark:border-[#1C2A45] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(sub.id)}
                              title="Eliminar suscriptor"
                              className="p-1.5 rounded-md bg-white dark:bg-[#0E1627] hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-[#1C2A45] text-slate-600 dark:text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
