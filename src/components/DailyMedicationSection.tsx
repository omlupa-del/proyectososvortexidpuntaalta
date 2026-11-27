import React, { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Clock,
  Edit3,
  Pill,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import {
  DAILY_MEDS_UPDATED_EVENT,
  DailyMedication,
  addDailyMedication,
  deleteDailyMedication,
  formatMedicationsForSosField,
  getNextPendingMedication,
  getTakenTodayIds,
  loadDailyMedications,
  markMedicationTakenToday,
  toggleMedicationReminder,
  triggerTestMedicationReminder,
  updateDailyMedication
} from '../utils/medicationReminders';
import { getPushPermissionState, requestPushPermission } from '../utils/pushNotifications';
import { playChirp } from '../utils/callHandler';

interface DailyMedicationSectionProps {
  compact?: boolean;
  defaultExpanded?: boolean;
  onSyncToSosMedField?: (summaryText: string) => void;
  currentSosMedText?: string;
}

export const DailyMedicationSection: React.FC<DailyMedicationSectionProps> = ({
  compact = false,
  defaultExpanded = false,
  onSyncToSosMedField,
  currentSosMedText
}) => {
  const [medications, setMedications] = useState<DailyMedication[]>(() => loadDailyMedications());
  const [takenTodayIds, setTakenTodayIds] = useState<string[]>(() => getTakenTodayIds());
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState<string>('');
  const [dose, setDose] = useState<string>('');
  const [time, setTime] = useState<string>('08:00');
  const [notes, setNotes] = useState<string>('');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [permState, setPermState] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() =>
    getPushPermissionState()
  );

  useEffect(() => {
    const refresh = () => {
      setMedications(loadDailyMedications());
      setTakenTodayIds(getTakenTodayIds());
      setPermState(getPushPermissionState());
    };
    window.addEventListener(DAILY_MEDS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(DAILY_MEDS_UPDATED_EVENT, refresh);
    };
  }, []);

  const takenCount = useMemo(
    () => medications.filter((m) => takenTodayIds.includes(m.id)).length,
    [medications, takenTodayIds]
  );

  const nextPending = useMemo(
    () => getNextPendingMedication(medications, takenTodayIds),
    [medications, takenTodayIds]
  );

  const showTempFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3200);
  };

  const resetForm = () => {
    setName('');
    setDose('');
    setTime('08:00');
    setNotes('');
    setReminderEnabled(true);
    setEditingId(null);
    setFormError('');
  };

  const handleOpenAddForm = () => {
    playChirp('click');
    resetForm();
    setIsExpanded(true);
    setIsFormOpen(true);
  };

  const handleStartEdit = (med: DailyMedication) => {
    playChirp('click');
    setEditingId(med.id);
    setName(med.name);
    setDose(med.dose);
    setTime(med.time);
    setNotes(med.notes || '');
    setReminderEnabled(med.reminderEnabled);
    setFormError('');
    setIsExpanded(true);
    setIsFormOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Ingresá el nombre del medicamento.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setFormError('Seleccioná un horario válido.');
      return;
    }

    playChirp('success');
    if (editingId) {
      updateDailyMedication(editingId, {
        name,
        dose,
        time,
        notes,
        reminderEnabled
      });
      showTempFeedback(`✔ Actualizado: ${name.trim()} (${time} hs)`);
    } else {
      addDailyMedication({
        name,
        dose,
        time,
        notes,
        reminderEnabled
      });
      showTempFeedback(`✔ Agregado: ${name.trim()} (${time} hs)`);
    }

    resetForm();
    setIsFormOpen(false);
  };

  const handleToggleTaken = (med: DailyMedication) => {
    const alreadyTaken = takenTodayIds.includes(med.id);
    playChirp(alreadyTaken ? 'click' : 'success');
    markMedicationTakenToday(med.id, !alreadyTaken);
    if (!alreadyTaken) {
      showTempFeedback(`✔ Marcada como tomada hoy: ${med.name}`);
    }
  };

  const handleToggleReminder = (med: DailyMedication) => {
    playChirp('click');
    toggleMedicationReminder(med.id);
  };

  const handleDelete = (med: DailyMedication) => {
    playChirp('click');
    deleteDailyMedication(med.id);
    if (editingId === med.id) {
      resetForm();
      setIsFormOpen(false);
    }
    showTempFeedback(`Eliminado: ${med.name}`);
  };

  const handleEnableBrowserAlerts = async () => {
    playChirp('click');
    const granted = await requestPushPermission();
    setPermState(getPushPermissionState());
    if (granted) {
      showTempFeedback('🔔 Avisos del navegador activados para tus recordatorios.');
    } else {
      showTempFeedback('Podés ver los recordatorios igualmente dentro de la app.');
    }
  };

  const handleTestReminder = async () => {
    playChirp('click');
    await triggerTestMedicationReminder(medications[0]);
    showTempFeedback('🔔 Recordatorio de prueba enviado.');
  };

  const handleCopyToSosField = () => {
    if (!onSyncToSosMedField || medications.length === 0) return;
    playChirp('success');
    const summary = formatMedicationsForSosField(medications);
    onSyncToSosMedField(summary);
    showTempFeedback('✔ Lista copiada al campo Medicación SOS de tu ficha.');
  };

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-[#07122c] border border-cyan-500/40 shadow-md overflow-hidden ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {/* Header / Summary Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            playChirp('click');
            setIsExpanded((v) => !v);
          }}
          className="flex-1 min-w-[200px] flex items-center gap-2.5 text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center text-sky-700 dark:text-cyan-300 shrink-0">
            <Pill className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-200 transition">
                Medicación Diaria y Recordatorios
              </span>
              {medications.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                    takenCount === medications.length
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50'
                      : 'bg-sky-100 dark:bg-cyan-500/20 text-sky-800 dark:text-cyan-200 border-cyan-500/40'
                  }`}
                >
                  {takenCount}/{medications.length} hoy
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] truncate">
              {medications.length === 0
                ? 'Registrá tus medicamentos diarios y horarios para recibir avisos simples.'
                : nextPending
                ? `Próxima dosis: ${nextPending.time} hs · ${nextPending.name}${
                    nextPending.dose ? ` (${nextPending.dose})` : ''
                  }`
                : '✔ Todas las tomas de hoy están completadas'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="px-2.5 py-1.5 rounded-xl bg-sky-100 dark:bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-sky-800 dark:text-cyan-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playChirp('click');
              setIsExpanded((v) => !v);
            }}
            className="p-1.5 rounded-xl bg-sky-50 dark:bg-[#0b1d46] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-slate-300 dark:border-[#1e3f8f] text-sky-700 dark:text-cyan-300 transition"
            aria-label={isExpanded ? 'Contraer medicación diaria' : 'Expandir medicación diaria'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold">
          {feedback}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-300 dark:border-[#1e3f8f]/60 space-y-3 animate-fade-in">
          {/* Simple Reminder Controls Bar */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f]/70 flex items-center justify-between gap-2 flex-wrap text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9db6dd]">
              <AlarmClock className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-300 shrink-0" />
              {permState === 'granted' ? (
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                  Avisos activos (en pantalla + navegador)
                </span>
              ) : permState === 'denied' ? (
                <span>Avisos en pantalla activos (navegador bloqueado en ajustes)</span>
              ) : (
                <span>Recordatorios en pantalla activos</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {permState === 'default' && (
                <button
                  type="button"
                  onClick={handleEnableBrowserAlerts}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#050b1f] font-bold text-[11px] transition active:scale-95"
                >
                  Activar avisos del navegador
                </button>
              )}
              <button
                type="button"
                onClick={handleTestReminder}
                className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-[#0b1d46] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-sky-300 dark:border-cyan-500/40 text-sky-800 dark:text-cyan-200 font-semibold text-[11px] flex items-center gap-1 transition active:scale-95"
              >
                <Bell className="w-3 h-3" />
                <span>Probar aviso</span>
              </button>
            </div>
          </div>

          {/* Add / Edit Inline Form */}
          {isFormOpen && (
            <form
              onSubmit={handleSubmitForm}
              className="p-3 rounded-xl bg-white dark:bg-[#0a1838] border border-sky-300 dark:border-cyan-400/60 space-y-2.5 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-800 dark:text-cyan-200">
                  {editingId ? 'Editar medicamento diario' : 'Nuevo medicamento diario'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                  className="p-1 rounded-lg text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white"
                  aria-label="Cerrar formulario"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] mb-1">
                    Nombre del medicamento *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Losartán, Levotiroxina, Metformina"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] mb-1">Horario diario *</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] mb-1">
                    Dosis / cantidad (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 50 mg · 1 comprimido"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-[#9db6dd] mb-1">Nota breve (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: En ayunas / Con el almuerzo"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-[#1e3f8f] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-900 dark:text-white cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="rounded border-slate-300 dark:border-[#1e3f8f] bg-slate-50 dark:bg-[#050b1f] text-sky-700 dark:text-cyan-400 focus:ring-cyan-400"
                />
                <span>Activar recordatorio diario a las {time} hs</span>
              </label>

              {formError && <p className="text-[11px] text-red-700 dark:text-red-400 font-semibold">{formError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow active:scale-95 transition"
                >
                  {editingId ? 'Guardar cambios' : 'Guardar medicamento'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#050b1f] border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Medications List */}
          {medications.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050b1f]/80 border border-dashed border-slate-300 dark:border-[#1e3f8f] text-center space-y-2">
              <p className="text-xs text-slate-600 dark:text-[#9db6dd]">
                Todavía no agregaste medicamentos diarios en este dispositivo.
              </p>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-100 dark:bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-sky-800 dark:text-cyan-200 text-xs font-bold transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cargar mi primer medicamento</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {medications.map((med) => {
                const isTaken = takenTodayIds.includes(med.id);
                return (
                  <div
                    key={med.id}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                      isTaken
                        ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-white dark:bg-[#0a1838] border-slate-300 dark:border-[#1e3f8f]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTaken(med)}
                        className={`mt-0.5 shrink-0 transition active:scale-90 ${
                          isTaken ? 'text-emerald-700 dark:text-emerald-400' : 'text-sky-700 dark:text-cyan-300 hover:text-slate-950 dark:hover:text-white'
                        }`}
                        title={isTaken ? 'Desmarcar toma de hoy' : 'Marcar como tomada hoy'}
                        aria-label={isTaken ? 'Desmarcar toma de hoy' : 'Marcar como tomada hoy'}
                      >
                        {isTaken ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#050b1f] border border-sky-300 dark:border-cyan-500/40 text-sky-700 dark:text-cyan-300 font-mono font-bold text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>{med.time} hs</span>
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              isTaken ? 'line-through text-emerald-800 dark:text-emerald-200/80' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {med.name}
                          </span>
                          {med.dose && (
                            <span className="text-[11px] text-sky-800 dark:text-cyan-200/90 font-medium">
                              · {med.dose}
                            </span>
                          )}
                        </div>
                        {med.notes && (
                          <p className="text-[11px] text-slate-600 dark:text-[#9db6dd] mt-0.5">{med.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTaken(med)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 ${
                          isTaken
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-400/50 text-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-[#050b1f] hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-slate-300 dark:border-[#1e3f8f] text-slate-700 dark:text-gray-200'
                        }`}
                      >
                        {isTaken ? '✓ Tomada' : 'Marcar tomada'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleReminder(med)}
                        className={`p-1.5 rounded-lg border transition ${
                          med.reminderEnabled
                            ? 'bg-sky-100 dark:bg-cyan-500/15 border-cyan-400/50 text-sky-700 dark:text-cyan-300'
                            : 'bg-slate-50 dark:bg-[#050b1f] border-slate-300 dark:border-gray-700 text-slate-500 dark:text-gray-500'
                        }`}
                        title={
                          med.reminderEnabled
                            ? 'Recordatorio activo (tocá para silenciar)'
                            : 'Recordatorio pausado (tocá para activar)'
                        }
                        aria-label="Alternar recordatorio"
                      >
                        {med.reminderEnabled ? (
                          <Bell className="w-3.5 h-3.5" />
                        ) : (
                          <BellOff className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(med)}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#050b1f] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-slate-300 dark:border-[#1e3f8f] text-slate-600 dark:text-[#9db6dd] hover:text-slate-950 dark:hover:text-white transition"
                        title="Editar medicamento"
                        aria-label="Editar medicamento"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(med)}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#050b1f] hover:bg-red-100 dark:hover:bg-red-950/80 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 transition"
                        title="Eliminar medicamento"
                        aria-label="Eliminar medicamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional helper to copy list into the SOS Ficha med text field */}
          {onSyncToSosMedField && medications.length > 0 && (
            <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyToSosField}
                className="w-full py-2 px-3 rounded-xl bg-sky-50 dark:bg-[#0a1f55] hover:bg-sky-100 dark:hover:bg-[#122e7a] border border-sky-300 dark:border-cyan-400/50 text-sky-800 dark:text-cyan-200 hover:text-slate-950 dark:hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>
                  {currentSosMedText?.trim()
                    ? 'Actualizar campo "Medicación habitual" de la Ficha SOS'
                    : 'Copiar esta lista al campo "Medicación habitual" de la Ficha SOS'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
