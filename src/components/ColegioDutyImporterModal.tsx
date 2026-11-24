import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Save,
  Trash2,
  Info
} from 'lucide-react';
import {
  PUNTA_ALTA_PHARMACIES,
  parseColegioDutyRoster,
  saveFullDutySchedule,
  getPuntaAltaTimeParts
} from '../data/puntaAltaData';
import { playChirp } from '../utils/callHandler';
import { useAuth } from '../context/AuthContext';
import { saveDutyScheduleToFirestore } from '../firebase/firestoreService';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface ColegioDutyImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  adminPin?: string;
}

export const ColegioDutyImporterModal: React.FC<ColegioDutyImporterModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  adminPin
}) => {
  const { user, isAdmin } = useAuth();
  const nowParts = getPuntaAltaTimeParts(new Date());
  const [selectedMonth, setSelectedMonth] = useState<number>(nowParts.month);
  const [selectedYear, setSelectedYear] = useState<number>(nowParts.year);
  const [rawText, setRawText] = useState<string>('');
  const [parsedSchedule, setParsedSchedule] = useState<Record<string, string[]>>({});
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  if (!isOpen) return null;

  const selectedMonthLabel = `${MONTH_NAMES[selectedMonth - 1] || 'Mes'} ${selectedYear}`;

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const allDateKeys = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const month = String(selectedMonth).padStart(2, '0');
    return `${selectedYear}-${month}-${day}`;
  });

  const handleParse = () => {
    if (!rawText.trim()) return;
    playChirp('click');
    const result = parseColegioDutyRoster(rawText, selectedYear, selectedMonth);
    setParsedSchedule(result.schedule);
    setUnrecognized(result.unrecognizedLines);
    setIsProcessed(true);
    playChirp('success');
  };

  const handleTogglePharmacy = (dateKey: string, pharmacyId: string) => {
    setParsedSchedule((prev) => {
      const current = prev[dateKey] || [];
      const updated = current.includes(pharmacyId)
        ? current.filter((id) => id !== pharmacyId)
        : [...current, pharmacyId];
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const handleClearDay = (dateKey: string) => {
    setParsedSchedule((prev) => {
      const copy = { ...prev };
      delete copy[dateKey];
      return copy;
    });
  };

  const handleSave = async () => {
    if (Object.keys(parsedSchedule).length === 0) return;
    setIsSaving(true);
    playChirp('click');
    try {
      const ok = await saveFullDutySchedule(parsedSchedule, adminPin);

      // If signed in as Firebase admin, also mirror duty schedule dates to Firestore
      if (user && isAdmin) {
        Promise.all(
          Object.entries(parsedSchedule).map(([dateKey, pharmacyIds]) =>
            saveDutyScheduleToFirestore(dateKey, pharmacyIds).catch(() => {})
          )
        ).catch(() => {});
      }

      if (ok) {
        playChirp('success');
        setSuccessMessage(`✔ ¡Se guardó y sincronizó el cronograma oficial de ${Object.keys(parsedSchedule).length} días con éxito!`);
        setTimeout(() => {
          onImportComplete?.();
          onClose();
        }, 1600);
      } else {
        setSuccessMessage('✔ Cronograma guardado localmente (sin autorización o conexión de servidor).');
        setTimeout(() => {
          onImportComplete?.();
          onClose();
        }, 1600);
      }
    } catch {
      setSuccessMessage('Error al sincronizar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSample = () => {
    const sample = `TURNOS DE FARMACIAS DE CNEL.ROSALES
NOVIEMBRE 2026 (Horario: 8:30 a 8:30 hs)

DOMINGO 1: FONTANARROSA - PALAVECINO - BUSINELLI
LUNES 2: VERON - PUNTA ALTA
MARTES 3: DEL PUERTO - GALENO
MIÉRCOLES 4: CURIE - DEL BARRIO
JUEVES 5: FONTANARROSA - MARQUES
VIERNES 6: BUSINELLI - DE DIOS
SÁBADO 7: GALENO - DEL PUERTO
DOMINGO 8: GALENO - BARRRESI - PUNTA ALTA
LUNES 9: ARGENTINA - VERON
MARTES 10: AUSILI - ZANDONADI
MIÉRCOLES 11: EL AGUILA - PEREYRA
JUEVES 12: DEL PUERTO - GALENO
VIERNES 13: DEL BARRIO - GARCIA
SÁBADO 14: ZANDONADI - BARRESI - AUSILI
DOMINGO 15: ZANDONADI - PEREYRA - DEL LEON
LUNES 16: FONTANARROSA - PALAVECINO
MARTES 17: BUSINELLI - DEL LEON
MIÉRCOLES 18: ARGENTINA - MACIEL
JUEVES 19: AUSILI - BARRESI
VIERNES 20: PUNTA ALTA - PEREYRA
SÁBADO 21: DEL BARRIO - DEL LEON - BUSINELLI
DOMINGO 22: DE DIOS - AUSILI - MACIEL
LUNES 23: DEL PUERTO - GALENO
MARTES 24: CURIE - GARCIA
MIÉRCOLES 25: MARQUES - PALAVECINO
JUEVES 26: DE DIOS - BARRESI
VIERNES 27: MACIEL - VERON
SÁBADO 28: CURIE - DE DIOS - GARCIA
DOMINGO 29: CURIE - BARRESI - GARCIA
LUNES 30: ZANDONADI - BARRESI`;
    setRawText(sample);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-[#030919] border-2 border-cyan-400/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#071330] to-[#0a1e4a] border-b border-[#1e4594] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                <span>Colegio de Farmacéuticos</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-normal">
                  Punta Alta
                </span>
              </h3>
              <p className="text-xs text-[#9db6dd]">
                Ingresador Automático de Guardias de 24 hs (08:30 a 08:30 hs)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Instrucciones y Mes */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#071536] p-3.5 rounded-xl border border-cyan-500/20 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">¿Cómo funciona?</span>
                <p className="text-[#9db6dd] text-[11px] mt-0.5">
                  Copiá el texto del correo que te mandó el Colegio de Farmacéuticos (o escribí los días) y pegalo acá. El sistema reconocerá automáticamente los números de día y los nombres de las 20 farmacias oficiales de Punta Alta.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-gray-400 text-xs">Mes:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1 bg-cyan-950 border border-cyan-400 text-cyan-200 font-bold rounded-lg text-xs focus:outline-none"
                aria-label="Seleccionar mes"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-2.5 py-1 bg-cyan-950 border border-cyan-400 text-cyan-200 font-bold rounded-lg text-xs focus:outline-none"
                aria-label="Seleccionar año"
              >
                {[2025, 2026, 2027, 2028].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea para pegar el correo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pegar acá el contenido del correo del Colegio:</span>
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-[11px] text-cyan-300 hover:underline"
              >
                Cargar formato de prueba
              </button>
            </div>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ejemplo:&#10;01/11: Farmacia García y Maciel&#10;02/11: Marqués y Palavecino&#10;03/11: De Dios y Del León..."
              className="w-full p-3 rounded-xl bg-[#040a1b] border border-[#1e4594] text-xs font-mono text-cyan-100 placeholder-gray-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Botón de análisis automático */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-black font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>⚡ Analizar y Detectar Farmacias Automáticamente</span>
            </button>

            {isProcessed && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{Object.keys(parsedSchedule).length} de {daysInMonth} días asignados</span>
              </span>
            )}
          </div>

          {/* Warning de líneas no reconocidas si las hubiera */}
          {unrecognized.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>{unrecognized.length} líneas no contenían fecha o nombre claro de farmacia:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-300/80 max-h-24 overflow-y-auto space-y-0.5">
                {unrecognized.slice(0, 5).map((u, i) => (
                  <li key={i} className="truncate">{u}</li>
                ))}
                {unrecognized.length > 5 && <li>... y {unrecognized.length - 5} más</li>}
              </ul>
            </div>
          )}

          {/* Tabla de días del mes seleccionado */}
          {isProcessed && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Cronograma Detectado de {selectedMonthLabel} (Revisión interactiva)</span>
                </h4>
                <span className="text-[11px] text-gray-400">Podés hacer clic en cualquier farmacia para añadirla o quitarla</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {allDateKeys.map((dateKey) => {
                  const dayNum = parseInt(dateKey.split('-')[2], 10);
                  const dObj = new Date(selectedYear, selectedMonth - 1, dayNum);
                  const dayName = dObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                  const assignedIds = parsedSchedule[dateKey] || [];

                  return (
                    <div
                      key={dateKey}
                      className={`p-2.5 rounded-xl border text-xs transition ${
                        assignedIds.length > 0
                          ? 'bg-[#071330] border-cyan-500/40'
                          : 'bg-black/30 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-cyan-300 capitalize">
                          {dayName} ({dateKey})
                        </span>
                        {assignedIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleClearDay(dateKey)}
                            className="text-gray-500 hover:text-red-400 text-[10px]"
                            title="Limpiar este día"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-red-400 font-bold">Sin asignar</span>
                        )}
                      </div>

                      {/* Chips de farmacias asignadas */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {assignedIds.map((id) => {
                          const ph = PUNTA_ALTA_PHARMACIES.find((p) => p.id === id);
                          return (
                            <span
                              key={id}
                              onClick={() => handleTogglePharmacy(dateKey, id)}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-red-500/20 hover:border-red-400 hover:text-red-200 transition"
                              title="Hacé clic para remover"
                            >
                              {ph?.name || id}
                              <X className="w-2.5 h-2.5" />
                            </span>
                          );
                        })}
                      </div>

                      {/* Selector rápido de agregar farmacia a este día */}
                      <details className="text-[10px] text-gray-400">
                        <summary className="cursor-pointer hover:text-cyan-300 text-[10px]">
                          + Agregar/Cambiar farmacia en este día
                        </summary>
                        <div className="grid grid-cols-2 gap-1 mt-1.5 p-1.5 bg-[#030919] rounded-lg max-h-32 overflow-y-auto">
                          {PUNTA_ALTA_PHARMACIES.map((p) => {
                            const isAssigned = assignedIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleTogglePharmacy(dateKey, p.id)}
                                className={`text-left p-1 rounded text-[10px] truncate transition ${
                                  isAssigned
                                    ? 'bg-emerald-950 text-emerald-300 font-bold'
                                    : 'hover:bg-white/10 text-gray-400'
                                }`}
                              >
                                {isAssigned ? '✓ ' : '+ '}{p.name.replace('Farmacia ', '')}
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback message */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-200 text-xs font-bold text-center">
              {successMessage}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-[#071330] border-t border-[#1e4594] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl hover:bg-white/10 text-gray-300 text-xs"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={Object.keys(parsedSchedule).length === 0 || isSaving}
            className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Guardando...'
                : `💾 Guardar y Activar Cronograma (${Object.keys(parsedSchedule).length} días)`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
