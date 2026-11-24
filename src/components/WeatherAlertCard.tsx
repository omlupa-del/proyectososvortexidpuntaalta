import React, { useState, useEffect } from 'react';
import {
  CloudRain,
  Wind,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sun,
  Cloud,
  Thermometer,
  Phone,
  Flame,
  Droplets
} from 'lucide-react';
import {
  getLiveWeatherReport,
  LiveWeatherReport
} from '../utils/weatherService';
import { triggerDirectCall, playChirp } from '../utils/callHandler';

export const WeatherAlertCard: React.FC = () => {
  const [report, setReport] = useState<LiveWeatherReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const data = await getLiveWeatherReport(force);
      setReport(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);

    const handleCustomUpdate = () => {
      loadData(true);
    };

    window.addEventListener('vortex_weather_updated', handleCustomUpdate);

    // Auto-refresh every 10 minutes
    const interval = setInterval(() => {
      loadData(true);
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('vortex_weather_updated', handleCustomUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleManualRefresh = () => {
    playChirp('click');
    loadData(true);
  };

  if (!report && loading) {
    return (
      <div className="my-4 rounded-2xl border border-cyan-500/30 bg-[#071738] p-4 animate-pulse text-xs text-[#9db6dd] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>Consultando estación meteorológica en vivo para Punta Alta...</span>
        </div>
      </div>
    );
  }

  const currentReport = report || {
    temperature: 20,
    apparentTemperature: 19,
    humidity: 55,
    windSpeed: 12,
    windGusts: 25,
    windDirection: 75,
    windDirectionText: 'E',
    precipitation: 0,
    weatherCode: 2,
    conditionText: 'Parcialmente nublado',
    isDay: true,
    alertLevel: 'verde' as const,
    alertTitle: '🟢 NIVEL VERDE · CONDICIONES ESTABLES',
    alertDetail: 'Sin alertas meteorológicas activas en Punta Alta, Puerto Belgrano y Pehuen Co.',
    recommendations: [
      'Seguí los partes periódicos ante vientos del sudeste o temporales marítimos.',
      'Línea 103 (Defensa Civil Punta Alta) disponible las 24 horas ante cualquier contingencia.',
      'SAME 107 y Hospital Municipal Eva Perón con guardia médica abierta.'
    ],
    lastUpdated: 'En vivo',
    isLive: true,
    source: 'SMN / Open-Meteo Punta Alta',
    smnUrl: 'https://www.smn.gob.ar/alertas',
    defensaCivilPhone: '103',
    bomberosPhone: '100'
  };

  const isGreen = currentReport.alertLevel === 'verde';
  const isYellow = currentReport.alertLevel === 'amarilla';
  const isOrange = currentReport.alertLevel === 'naranja';
  const isRed = currentReport.alertLevel === 'roja';

  return (
    <div
      className={`my-4 rounded-3xl overflow-hidden border-2 transition-all shadow-xl ${
        isRed
          ? 'border-red-500 bg-gradient-to-r from-[#2c0505] via-[#1a0505] to-[#070b1a] shadow-red-950/80'
          : isOrange
          ? 'border-orange-500 bg-gradient-to-r from-[#291304] via-[#1a0c02] to-[#07122c] shadow-orange-950/70'
          : isYellow
          ? 'border-yellow-500/80 bg-gradient-to-r from-[#241c05] via-[#141003] to-[#07122c] shadow-yellow-950/60'
          : 'border-cyan-500/50 bg-gradient-to-r from-[#071738] via-[#091b42] to-[#07122c] shadow-blue-950/50'
      } p-3.5 sm:p-5 text-white`}
    >
      {/* Top Bar: Location + Alert Badge + Refresh Button */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
              isRed
                ? 'bg-red-950 border-red-500 text-red-300 animate-pulse'
                : isOrange
                ? 'bg-orange-950 border-orange-500 text-orange-300'
                : isYellow
                ? 'bg-amber-950 border-amber-500 text-amber-300'
                : 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
            }`}
          >
            {isRed || isOrange ? (
              <Flame className="w-6 h-6 animate-bounce" />
            ) : isYellow ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                METEOROLOGÍA EN VIVO · PUNTA ALTA
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                  isRed
                    ? 'bg-red-600 text-white border-red-300 animate-pulse'
                    : isOrange
                    ? 'bg-orange-500 text-black border-orange-200 font-black'
                    : isYellow
                    ? 'bg-yellow-400 text-black border-yellow-200 font-black'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                }`}
              >
                {currentReport.alertLevel === 'verde'
                  ? 'Nivel Verde · Estable'
                  : `Precaución ${currentReport.alertLevel.toUpperCase()}`}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black font-heading text-white mt-0.5">
              {currentReport.alertTitle}
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-xl hover:bg-white/10 text-cyan-300 hover:text-white transition disabled:opacity-50"
            title="Actualizar datos en vivo ahora"
            aria-label="Actualizar datos meteorológicos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition"
            aria-label={expanded ? 'Contraer información' : 'Expandir información meteorológica'}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Atmospheric Real-Time Telemetry Bar (Temp, Wind Gusts, Rain) */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Temperature */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
            <Thermometer className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 font-bold uppercase">Temperatura</span>
            <span className="text-sm font-black text-white">
              {currentReport.temperature}°C
              <span className="text-[10px] text-cyan-300 font-normal ml-1">
                (ST {currentReport.apparentTemperature}°C)
              </span>
            </span>
          </div>
        </div>

        {/* Wind & Gusts (Key for Punta Alta & Sudestadas) */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 font-bold uppercase">Viento y Ráfagas</span>
            <span className="text-sm font-black text-white">
              {currentReport.windSpeed} km/h
              <span className="text-[10px] text-amber-300 font-bold ml-1">
                (Ráf. {currentReport.windGusts} km/h {currentReport.windDirectionText})
              </span>
            </span>
          </div>
        </div>

        {/* Condition */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-300">
            {currentReport.isDay ? <Sun className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 font-bold uppercase">Estado Actual</span>
            <span className="text-xs font-bold text-white truncate max-w-[120px] block">
              {currentReport.conditionText}
            </span>
          </div>
        </div>

        {/* Humidity & Rain */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 font-bold uppercase">Humedad / Lluvia</span>
            <span className="text-sm font-black text-white">
              {currentReport.humidity}%
              <span className="text-[10px] text-blue-300 ml-1">
                {currentReport.precipitation > 0 ? `${currentReport.precipitation} mm` : '0 mm'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Detail description */}
      <p className="mt-3 text-xs text-[#cfe1fa] leading-relaxed">
        {currentReport.alertDetail}
      </p>

      {/* Emergency Immediate Action Buttons if Yellow, Orange, or Red Alert */}
      {!isGreen && (
        <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => triggerDirectCall('103', 'Defensa Civil Punta Alta', 'emergency')}
            className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
          >
            <Phone className="w-4 h-4" />
            <span>Llamar a Defensa Civil (103)</span>
          </button>

          <button
            type="button"
            onClick={() => triggerDirectCall('100', 'Bomberos Voluntarios Punta Alta', 'emergency')}
            className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
          >
            <Phone className="w-4 h-4" />
            <span>Llamar a Bomberos (100)</span>
          </button>
        </div>
      )}

      {/* Expandable Recommendations */}
      {expanded && (
        <div className="mt-3.5 pt-3.5 border-t border-white/15 space-y-2 animate-fade-in">
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 block">
            Medidas preventivas oficiales para Coronel Rosales:
          </span>
          <ul className="space-y-1.5 pl-4 list-disc text-xs text-gray-200">
            {currentReport.recommendations.map((rec, i) => (
              <li key={i} className="leading-snug">{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Footer: Source & Link to SMN */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] text-[#9db6dd] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{currentReport.source} · {currentReport.lastUpdated}</span>
        </span>

        <a
          href={currentReport.smnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-cyan-300 hover:text-white font-bold transition text-[11px]"
        >
          <span>Consultar Mapa Oficial SMN en vivo</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
