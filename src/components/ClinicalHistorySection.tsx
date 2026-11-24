import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  HeartPulse,
  Syringe,
  Dna,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  HelpCircle
} from 'lucide-react';
import {
  MedicalRecord,
  ClinicalEvent,
  getStoredPinHash,
  hashPin
} from '../utils/medicalData';
import { playChirp } from '../utils/callHandler';
import { PersonalPinRecoveryBox } from './PersonalPinRecoveryBox';

interface ClinicalHistorySectionProps {
  record: MedicalRecord | null;
  isEditing?: boolean;
  editForm?: MedicalRecord;
  onUpdateRecord?: (updated: MedicalRecord) => void;
  onFormChange?: (field: keyof MedicalRecord, value: any) => void;
  isRescuerView?: boolean;
}

export const ClinicalHistorySection: React.FC<ClinicalHistorySectionProps> = ({
  record,
  isEditing = false,
  editForm,
  onUpdateRecord,
  onFormChange,
  isRescuerView = false
}) => {
  const currentRecord = isEditing ? editForm || record : record;

  const [isUnlocked, setIsUnlocked] = useState<boolean>(isEditing || isRescuerView);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [showRecoveryMode, setShowRecoveryMode] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'internacion' | 'cirugia' | 'antecedente'>('all');

  // New Event Form State
  const [newType, setNewType] = useState<ClinicalEvent['type']>('cirugia');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newInstitution, setNewInstitution] = useState<string>('');
  const [newDetails, setNewDetails] = useState<string>('');

  const rawEvents: ClinicalEvent[] = currentRecord?.historialClinico || [];

  const handleUnlock = async () => {
    const cleaned = pinInput.trim();
    if (!cleaned) {
      setPinError('Ingresá tu clave PIN');
      return;
    }

    const storedHash = getStoredPinHash();
    if (!storedHash) {
      // Only allow default 1234 if no custom user PIN was configured yet
      if (cleaned === '1234') {
        setIsUnlocked(true);
        setPinInput('');
        setShowPin(false);
        setPinError('');
        playChirp('success');
      } else {
        setPinError('Aún no configuraste un PIN propio. Usá 1234 o definí tu PIN en Editar Datos.');
        playChirp('click');
      }
      return;
    }

    try {
      const inputHash = await hashPin(cleaned);
      if (inputHash === storedHash) {
        setIsUnlocked(true);
        setPinInput('');
        setShowPin(false);
        setPinError('');
        playChirp('success');
      } else {
        setPinError('Clave PIN incorrecta');
        playChirp('click');
      }
    } catch {
      setPinError('Error al validar la clave');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPinInput('');
    setPinError('');
    playChirp('click');
  };

  const handleAddEvent = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!newTitle.trim()) return;

    const newEvent: ClinicalEvent = {
      id: `ev-${Date.now()}`,
      type: newType,
      title: newTitle.trim(),
      date: newDate.trim(),
      institution: newInstitution.trim(),
      details: newDetails.trim()
    };

    const updatedEvents = [newEvent, ...rawEvents];

    if (onFormChange) {
      onFormChange('historialClinico', updatedEvents);
    } else if (onUpdateRecord && currentRecord) {
      onUpdateRecord({
        ...currentRecord,
        historialClinico: updatedEvents
      });
    }

    // Reset Form
    setNewTitle('');
    setNewDate('');
    setNewInstitution('');
    setNewDetails('');
    setShowAddModal(false);
    playChirp('success');
  };

  const handleDeleteEvent = (id: string) => {
    const updatedEvents = rawEvents.filter((ev) => ev.id !== id);
    if (onFormChange) {
      onFormChange('historialClinico', updatedEvents);
    } else if (onUpdateRecord && currentRecord) {
      onUpdateRecord({
        ...currentRecord,
        historialClinico: updatedEvents
      });
    }
    playChirp('click');
  };

  const filteredEvents = rawEvents.filter((ev) => {
    if (activeFilter === 'all') return true;
    return ev.type === activeFilter;
  });

  const getEventIcon = (type: ClinicalEvent['type']) => {
    switch (type) {
      case 'cirugia':
        return <Syringe className="w-4 h-4 text-rose-400" />;
      case 'internacion':
        return <HeartPulse className="w-4 h-4 text-amber-400" />;
      case 'antecedente':
        return <Dna className="w-4 h-4 text-cyan-400" />;
      default:
        return <FileText className="w-4 h-4 text-blue-400" />;
    }
  };

  const getEventBadge = (type: ClinicalEvent['type']) => {
    switch (type) {
      case 'cirugia':
        return { label: 'Cirugía', color: 'bg-rose-950 text-rose-300 border-rose-500/50' };
      case 'internacion':
        return { label: 'Internación', color: 'bg-amber-950 text-amber-300 border-amber-500/50' };
      case 'antecedente':
        return { label: 'Antecedente Familiar', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/50' };
      default:
        return { label: 'Historial', color: 'bg-blue-950 text-blue-300 border-blue-500/50' };
    }
  };

  const isProtected = !isRescuerView && (currentRecord?.historialClinicoProtected !== false);

  return (
    <div className="my-3.5 rounded-3xl bg-gradient-to-br from-[#0c1836] via-[#08122c] to-[#040a1c] border-2 border-[#1e5bff]/80 p-4 sm:p-5 shadow-2xl space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e3f8f]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-600/20 text-[#37c8ff] border border-blue-500/50">
            <FileText className="w-5 h-5 text-[#37c8ff]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black font-heading text-white uppercase tracking-wider">
                HISTORIAL CLÍNICO Y ANTECEDENTES
              </h3>
              {isProtected && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-950 text-[#37c8ff] border border-[#37c8ff]/40 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> PIN PROTEGIDO
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#9db6dd]">
              Internaciones previas · Cirugías importantes · Antecedentes familiares
            </p>
          </div>
        </div>

        {/* Lock / Unlock Toggle Button */}
        {!isEditing && isProtected && isUnlocked && (
          <button
            type="button"
            onClick={handleLock}
            className="px-2.5 py-1 rounded-xl bg-[#0a1838] hover:bg-[#122e7a] border border-gray-600 text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition active:scale-95"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Bloquear</span>
          </button>
        )}
      </div>

      {/* STATE 1: LOCKED WITH PIN */}
      {isProtected && !isUnlocked && !isEditing ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#071330] via-[#061026] to-[#050b1f] border border-amber-400/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/60 flex items-center justify-center text-amber-300 shrink-0">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-black uppercase text-amber-200">
                Información Confidencial Protegida
              </h4>
              <p className="text-xs text-[#9db6dd] leading-snug mt-0.5">
                Por privacidad del titular, el historial de internaciones, cirugías previas y antecedentes familiares está protegido con clave PIN.
              </p>
            </div>
          </div>

          {/* Quick Summary Pill Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-gray-700 text-[10px] text-gray-300 font-semibold flex items-center gap-1">
              <HeartPulse className="w-3 h-3 text-amber-400" />
              <span>Internaciones previas: {currentRecord?.internacionesPrevias ? 'Registradas' : 'Protegidas'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-gray-700 text-[10px] text-gray-300 font-semibold flex items-center gap-1">
              <Syringe className="w-3 h-3 text-rose-400" />
              <span>Cirugías previas: {currentRecord?.cirugiasPrevias ? 'Registradas' : 'Protegidas'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-gray-700 text-[10px] text-gray-300 font-semibold flex items-center gap-1">
              <Dna className="w-3 h-3 text-cyan-400" />
              <span>Antecedentes familiares: {currentRecord?.antecedentesFamiliares ? 'Registrados' : 'Protegidos'}</span>
            </span>
          </div>

          {/* PIN Input Bar */}
          {!showRecoveryMode ? (
            <>
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    placeholder="Ingresá PIN (4 a 6 números)"
                    className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-[#050b1f] border border-[#1e3f8f] text-sm text-white font-mono focus:outline-none focus:border-[#37c8ff]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-cyan-300/80 hover:text-white transition"
                    aria-label={showPin ? 'Ocultar PIN' : 'Ver PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleUnlock}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#1e5bff] hover:opacity-90 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Desbloquear Historial</span>
                </button>
              </div>
              {pinError && <p className="text-xs text-red-400 font-bold">{pinError}</p>}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playChirp('click');
                    setPinError('');
                    setShowRecoveryMode(true);
                  }}
                  className="text-xs text-[#37c8ff] hover:text-white underline underline-offset-4 flex items-center gap-1.5 font-semibold transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>¿Olvidaste tu clave? Recuperar</span>
                </button>
              </div>
            </>
          ) : (
            <div className="pt-2">
              <PersonalPinRecoveryBox
                record={currentRecord}
                onCancel={() => setShowRecoveryMode(false)}
                onRecovered={() => {
                  setShowRecoveryMode(false);
                  setIsUnlocked(true);
                  setPinInput('');
                  setPinError('');
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* STATE 2: UNLOCKED VIEW OR EDIT MODE */
        <div className="space-y-3.5">
          {/* Quick Summary Cards (Internaciones, Cirugías, Antecedentes Familiares) */}
          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Cirugías Importantes */}
            <div className="p-3.5 rounded-2xl bg-[#071536] border border-rose-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Syringe className="w-4 h-4 text-rose-400" />
                  <span>Cirugías Importantes / Intervenciones</span>
                </span>
                <span className="text-[10px] font-bold text-rose-400/80">Quirúrgico</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={currentRecord?.cirugiasPrevias || ''}
                  onChange={(e) => onFormChange && onFormChange('cirugiasPrevias', e.target.value)}
                  placeholder="Ej: Apendicectomía (2018 - Hospital Naval), Prótesis de cadera derecha"
                  className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-rose-500/60 text-xs text-white"
                />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                  {currentRecord?.cirugiasPrevias ||
                    rawEvents.find((e) => e.type === 'cirugia')?.title ||
                    'Sin cirugías previas declaradas.'}
                </p>
              )}
            </div>

            {/* 2. Internaciones Previas */}
            <div className="p-3.5 rounded-2xl bg-[#071536] border border-amber-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-amber-400" />
                  <span>Internaciones Previas y Fechas</span>
                </span>
                <span className="text-[10px] font-bold text-amber-400/80">Hospitalario</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={currentRecord?.internacionesPrevias || ''}
                  onChange={(e) => onFormChange && onFormChange('internacionesPrevias', e.target.value)}
                  placeholder="Ej: Neumonía bilateral (Julio 2021 - Hospital Eva Perón, 7 días)"
                  className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-amber-500/60 text-xs text-white"
                />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                  {currentRecord?.internacionesPrevias ||
                    rawEvents.find((e) => e.type === 'internacion')?.title ||
                    'Sin internaciones previas registradas.'}
                </p>
              )}
            </div>

            {/* 3. Antecedentes Familiares */}
            <div className="p-3.5 rounded-2xl bg-[#071536] border border-cyan-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Dna className="w-4 h-4 text-cyan-400" />
                  <span>Antecedentes Clínicos Familiares (Hereditarios)</span>
                </span>
                <span className="text-[10px] font-bold text-cyan-400/80">Genético</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={currentRecord?.antecedentesFamiliares || ''}
                  onChange={(e) => onFormChange && onFormChange('antecedentesFamiliares', e.target.value)}
                  placeholder="Ej: Padre: Infarto a los 62 años. Madre: Hipertensión arterial y Diabetes"
                  className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-cyan-500/60 text-xs text-white"
                />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                  {currentRecord?.antecedentesFamiliares ||
                    rawEvents.find((e) => e.type === 'antecedente')?.title ||
                    'Sin antecedentes familiares declarados.'}
                </p>
              )}
            </div>
          </div>

          {/* Timeline of Clinical Events */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-300 uppercase tracking-wider">
                Eventos e intervenciones detalladas ({rawEvents.length}):
              </span>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Evento</span>
                </button>
              )}
            </div>

            {/* Filter Tabs if multiple events */}
            {rawEvents.length > 2 && (
              <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
                {(['all', 'cirugia', 'internacion', 'antecedente'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize transition shrink-0 ${
                      activeFilter === filter
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-[#050b1f] text-gray-400 hover:text-white border border-[#1e3f8f]'
                    }`}
                  >
                    {filter === 'all' ? 'Todos' : filter === 'cirugia' ? 'Cirugías' : filter === 'internacion' ? 'Internaciones' : 'Familiares'}
                  </button>
                ))}
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">
                No hay eventos específicos cargados en esta categoría.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((ev) => {
                  const badge = getEventBadge(ev.type);
                  return (
                    <div
                      key={ev.id}
                      className="p-3 rounded-2xl bg-[#050d24] border border-[#1e3f8f]/70 hover:border-[#37c8ff]/60 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-black/40 border border-gray-700">
                            {getEventIcon(ev.type)}
                          </span>
                          <div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                              {ev.title}
                            </h4>
                          </div>
                        </div>

                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="text-gray-400 hover:text-red-400 p-1"
                            title="Eliminar evento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Date & Institution metadata */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9db6dd]">
                        {ev.date && (
                          <span className="flex items-center gap-1 font-mono font-bold text-gray-200">
                            <Calendar className="w-3 h-3 text-[#37c8ff]" />
                            {ev.date}
                          </span>
                        )}
                        {ev.institution && (
                          <span className="flex items-center gap-1 text-[#37c8ff]">
                            <Building2 className="w-3 h-3" />
                            {ev.institution}
                          </span>
                        )}
                      </div>

                      {ev.details && (
                        <p className="text-xs text-[#eaf3ff] bg-black/30 p-2 rounded-xl border border-gray-800 leading-snug">
                          {ev.details}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy Protection Switch in Edit Mode */}
          {isEditing && (
            <div className="pt-2 p-3 rounded-2xl bg-[#050b1f] border border-[#1e3f8f] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Exigir clave PIN para ver este historial
                </span>
                <span className="text-[11px] text-[#9db6dd]">
                  Mantiene protegida tu información clínica ante personas no autorizadas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={currentRecord?.historialClinicoProtected !== false}
                onChange={(e) => onFormChange && onFormChange('historialClinicoProtected', e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Modal to Add New Clinical Event */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-sm bg-gradient-to-b from-[#0a1f55] to-[#07122c] border-2 border-[#37c8ff] rounded-3xl p-5 shadow-2xl space-y-3 text-white">
                <div className="flex items-center justify-between pb-2 border-b border-[#1e3f8f]">
                  <h4 className="text-sm font-black uppercase text-white flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Nuevo Registro Clínico</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Tipo de Evento:</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['cirugia', 'internacion', 'antecedente'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewType(t)}
                          className={`py-1.5 px-1 rounded-lg font-bold capitalize transition border text-[11px] ${
                            newType === t
                              ? 'bg-blue-600 text-white border-[#37c8ff]'
                              : 'bg-[#050b1f] text-gray-300 border-gray-700'
                          }`}
                        >
                          {t === 'cirugia' ? 'Cirugía' : t === 'internacion' ? 'Internación' : 'Familiar'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Título / Diagnóstico / Cirugía:</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ej: Colecistectomía / Internación por Neumonía"
                      className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-[#1e3f8f] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-300 font-bold mb-1">Fecha / Año:</label>
                      <input
                        type="text"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        placeholder="Ej: Octubre 2022"
                        className="w-full py-2 px-2.5 rounded-xl bg-[#050b1f] border border-[#1e3f8f] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 font-bold mb-1">Institución / Hospital:</label>
                      <input
                        type="text"
                        value={newInstitution}
                        onChange={(e) => setNewInstitution(e.target.value)}
                        placeholder="Hospital Eva Perón"
                        className="w-full py-2 px-2.5 rounded-xl bg-[#050b1f] border border-[#1e3f8f] text-white"
                      />
                    </div>
                  </div>

                  {/* Quick Punta Alta Hospital presets */}
                  <div className="flex gap-1 flex-wrap">
                    {['Hospital Eva Perón', 'Hospital Naval', 'Clínica Rosales'].map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setNewInstitution(inst)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-[#07183d] text-[#37c8ff] hover:bg-[#0d2866] border border-[#1e3f8f]"
                      >
                        + {inst}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Detalles / Anestesia / Observaciones:</label>
                    <textarea
                      rows={2}
                      value={newDetails}
                      onChange={(e) => setNewDetails(e.target.value)}
                      placeholder="Sin complicaciones, buena tolerancia anestésica, prótesis..."
                      className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-[#1e3f8f] text-white resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!newTitle.trim()}
                      onClick={handleAddEvent}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-black text-xs text-gray-950 uppercase disabled:opacity-50"
                    >
                      Guardar en Historial
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
