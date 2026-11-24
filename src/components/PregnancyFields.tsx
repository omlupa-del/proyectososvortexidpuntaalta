import React, { useState, useEffect } from 'react';
import { Baby, Calendar, Sparkles, Stethoscope } from 'lucide-react';
import {
  MedicalRecord,
  calculatePregnancyProgress,
  computeFumFromGestationalInput
} from '../utils/medicalData';

interface PregnancyFieldsProps {
  formData: MedicalRecord;
  onChange: (field: keyof MedicalRecord, value: any) => void;
  compact?: boolean;
}

export const PregnancyFields: React.FC<PregnancyFieldsProps> = ({
  formData,
  onChange,
  compact = false
}) => {
  const [inputMode, setInputMode] = useState<'meses' | 'semanas' | 'fum'>('meses');
  const [monthsVal, setMonthsVal] = useState<string>('');
  const [weeksVal, setWeeksVal] = useState<string>('');

  const progress = calculatePregnancyProgress(formData);

  useEffect(() => {
    if (progress && progress.hasValidAnchorDate) {
      setMonthsVal(String(Math.max(1, Math.round(progress.monthsFloat))));
      setWeeksVal(String(progress.weeks));
    }
  }, [formData.embarazada, formData.embarazoFum]);

  const handleSexSelect = (sexo: 'Femenino' | 'Masculino' | 'Otro') => {
    onChange('sexo', sexo);
    if (sexo !== 'Femenino' && formData.embarazada) {
      onChange('embarazada', false);
      onChange('embarazoFum', '');
      onChange('embarazoObstetra', '');
    }
  };

  const handleTogglePregnant = (checked: boolean) => {
    onChange('embarazada', checked);
    if (!checked) {
      onChange('embarazoFum', '');
      onChange('embarazoObstetra', '');
      setMonthsVal('');
      setWeeksVal('');
    }
  };

  const handleMonthsChange = (raw: string) => {
    setMonthsVal(raw);
    const num = parseFloat(raw.replace(',', '.'));
    if (!isNaN(num) && num >= 0 && num <= 10) {
      const fum = computeFumFromGestationalInput('meses', num);
      onChange('embarazoFum', fum);
    }
  };

  const handleWeeksChange = (raw: string) => {
    setWeeksVal(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 0 && num <= 44) {
      const fum = computeFumFromGestationalInput('semanas', num);
      onChange('embarazoFum', fum);
    }
  };

  return (
    <div className="space-y-3">
      {/* Selector de Sexo */}
      <div>
        <label className="block text-xs font-semibold text-[#9db6dd] mb-1.5">
          Sexo biológico (para protocolos médicos de emergencia)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['Femenino', 'Masculino', 'Otro'] as const).map((sexOpt) => {
            const active = formData.sexo === sexOpt;
            return (
              <button
                key={sexOpt}
                type="button"
                onClick={() => handleSexSelect(sexOpt)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition active:scale-95 ${
                  active
                    ? sexOpt === 'Femenino'
                      ? 'bg-pink-600/30 border-pink-400 text-pink-200 shadow-md shadow-pink-950/50'
                      : 'bg-[#1e5bff]/30 border-[#37c8ff] text-white shadow-md shadow-blue-950/50'
                    : 'bg-[#07122c] border-[#1e3f8f] text-gray-300 hover:border-[#37c8ff]/60'
                }`}
              >
                {sexOpt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Datos esenciales de embarazo si es Femenino */}
      {formData.sexo === 'Femenino' && (
        <div
          className={`rounded-2xl border-2 transition-all ${
            formData.embarazada
              ? 'bg-gradient-to-br from-pink-950/70 via-[#1f0d2b] to-[#0b1538] border-pink-400/80 shadow-xl shadow-pink-950/40'
              : 'bg-[#07122c] border-pink-500/30'
          } ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
        >
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-400/60 flex items-center justify-center shrink-0">
                <Baby className="w-5 h-5 text-pink-300" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-white block">
                  ¿Se encuentra embarazada actualmente?
                </span>
                <span className="text-[11px] text-pink-200/80 block leading-tight">
                  El sistema actualizará automáticamente los meses y semanas con el paso del tiempo.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formData.embarazada)}
              onChange={(e) => handleTogglePregnant(e.target.checked)}
              className="w-5 h-5 accent-pink-500 rounded cursor-pointer shrink-0"
            />
          </label>

          {formData.embarazada && (
            <div className="space-y-3 pt-2 border-t border-pink-400/30 animate-fade-in">
              {/* Modo de carga de edad gestacional */}
              <div>
                <span className="text-[11px] font-bold text-pink-200 uppercase tracking-wider block mb-1.5">
                  ¿Cómo preferís cargar el tiempo de gestación actual?
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInputMode('meses')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition ${
                      inputMode === 'meses'
                        ? 'bg-pink-500 text-white border-pink-300 shadow'
                        : 'bg-[#050b1f] text-pink-200/80 border-pink-500/30 hover:text-white'
                    }`}
                  >
                    Por Meses
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('semanas')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition ${
                      inputMode === 'semanas'
                        ? 'bg-pink-500 text-white border-pink-300 shadow'
                        : 'bg-[#050b1f] text-pink-200/80 border-pink-500/30 hover:text-white'
                    }`}
                  >
                    Por Semanas
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('fum')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition ${
                      inputMode === 'fum'
                        ? 'bg-pink-500 text-white border-pink-300 shadow'
                        : 'bg-[#050b1f] text-pink-200/80 border-pink-500/30 hover:text-white'
                    }`}
                  >
                    Fecha FUM
                  </button>
                </div>
              </div>

              {inputMode === 'meses' && (
                <div>
                  <label className="block text-xs font-semibold text-pink-200 mb-1">
                    Meses de embarazo actuales (1 a 9)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={9}
                      step={0.5}
                      placeholder="Ej: 4 o 4.5"
                      value={monthsVal}
                      onChange={(e) => handleMonthsChange(e.target.value)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#050b1f] border border-pink-400/60 text-sm text-white focus:outline-none focus:border-pink-300"
                    />
                    <span className="text-xs font-bold text-pink-200 shrink-0">meses hoy</span>
                  </div>
                </div>
              )}

              {inputMode === 'semanas' && (
                <div>
                  <label className="block text-xs font-semibold text-pink-200 mb-1">
                    Semanas de gestación actuales (1 a 42)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={42}
                      placeholder="Ej: 22"
                      value={weeksVal}
                      onChange={(e) => handleWeeksChange(e.target.value)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#050b1f] border border-pink-400/60 text-sm text-white focus:outline-none focus:border-pink-300"
                    />
                    <span className="text-xs font-bold text-pink-200 shrink-0">semanas hoy</span>
                  </div>
                </div>
              )}

              {inputMode === 'fum' && (
                <div>
                  <label className="block text-xs font-semibold text-pink-200 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-pink-300" />
                    <span>Fecha de Última Menstruación (FUM)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.embarazoFum || ''}
                    onChange={(e) => onChange('embarazoFum', e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-pink-400/60 text-sm text-white focus:outline-none focus:border-pink-300"
                  />
                </div>
              )}

              {/* Vista previa del cálculo automático en tiempo real */}
              {progress && progress.hasValidAnchorDate && (
                <div className="p-3 rounded-xl bg-black/50 border border-pink-400/50 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-pink-300 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                      <span>Cálculo automático para hoy:</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-200 border border-pink-400/40">
                      {progress.trimesterLabel}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-white">
                    🤰 {progress.detailedLabel}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-pink-200/90">
                    {progress.dueDateFormatted && (
                      <span>Fecha probable de parto (FPP): <strong>{progress.dueDateFormatted}</strong></span>
                    )}
                    <span>Se actualizará solo cada semana y mes.</span>
                  </div>
                </div>
              )}

              {/* Datos obstétricos esenciales */}
              <div>
                <label className="block text-xs font-semibold text-pink-200 mb-1 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-pink-300" />
                  <span>Obstetra, maternidad / alertas obstétricas (ej: cesárea previa, Rh-, diabetes gest.)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dra. López (Hosp. Penna / Naval) · Embarazo normal / Factor Rh-"
                  value={formData.embarazoObstetra || ''}
                  onChange={(e) => onChange('embarazoObstetra', e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-[#050b1f] border border-pink-400/50 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-300"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
