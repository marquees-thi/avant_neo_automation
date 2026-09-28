import React, { useState } from 'react';
import { BulbState } from '../types/bulb';
import { Play, Square, Flame, Sun, Sparkles, Clock, Compass } from 'lucide-react';

interface ScenesEngineProps {
  state: BulbState;
  onStartScene: (scene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight') => void;
  onStopScene: () => void;
  onSetWhite: (brightness: number, colorTemp: number) => void;
}

export const ScenesEngine: React.FC<ScenesEngineProps> = ({
  state,
  onStartScene,
  onStopScene,
  onSetWhite,
}) => {
  const [simulatedHour, setSimulatedHour] = useState<number>(new Date().getHours());

  // Circadian Curve Formula from scenes.py
  const calculateCircadianForHour = (hour: number) => {
    let brightness = 100;
    let temp = 100;

    if (hour >= 6 && hour < 9) {
      const pct = (hour - 6) / 3;
      brightness = Math.round(40 + 60 * pct);
      temp = Math.round(20 + 50 * pct);
    } else if (hour >= 9 && hour < 18) {
      brightness = 100;
      temp = 100;
    } else if (hour >= 18 && hour < 22) {
      const pct = (hour - 18) / 4;
      brightness = Math.round(100 - 40 * pct);
      temp = Math.round(100 - 90 * pct);
    } else {
      brightness = 25;
      temp = 0;
    }

    const kelvin = Math.round(2700 + (temp / 100) * (6500 - 2700));
    return { brightness, temp, kelvin };
  };

  const previewCircadian = calculateCircadianForHour(simulatedHour);

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-base font-semibold text-white">Engine de Cenas Dinâmicas (`core/scenes.py`)</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Mecanismo multithread com cancelamento seguro via <code className="text-amber-300">threading.Event</code> e zero bloqueio de socket
          </p>
        </div>

        {state.activeScene && (
          <button
            onClick={onStopScene}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Square className="w-3.5 h-3.5 fill-rose-400" />
            <span>Parar Cena ({state.activeScene})</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Cyberpunk Neon Pulse */}
        <div
          className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
            state.activeScene === 'cyberpunk'
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-neutral-800 bg-neutral-950/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Oscilador Harmônico
              </span>
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 animate-pulse" />
            </div>

            <h3 className="text-sm font-semibold text-white mt-2">Cyberpunk Neon Pulse</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Onda senoidal contínua alternando entre Ciano Elétrico <code className="text-cyan-300">(0, 255, 255)</code> e Magenta Neon <code className="text-fuchsia-300">(255, 0, 150)</code> a 20 FPS.
            </p>

            <div className="mt-4 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1">
              <div>Frequência: <span className="text-cyan-300">t += 0.08 (~0.25 Hz)</span></div>
              <div>Intervalo de sleep: <span className="text-neutral-400">50ms (stream_mode=True)</span></div>
            </div>
          </div>

          <button
            onClick={() => onStartScene('cyberpunk')}
            className={`mt-5 w-full py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              state.activeScene === 'cyberpunk'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{state.activeScene === 'cyberpunk' ? 'Executando...' : 'Iniciar Cyberpunk'}</span>
          </button>
        </div>

        {/* Card 2: Candlelight / Fire */}
        <div
          className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
            state.activeScene === 'candle'
              ? 'border-amber-400 bg-amber-950/20'
              : 'border-neutral-800 bg-neutral-950/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Jitter Orgânico
              </span>
              <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
            </div>

            <h3 className="text-sm font-semibold text-white mt-2">Vela Viva / Lareira</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Flicker térmico com micro-variações no canal verde (100–155) e azul (10–35), simulando chama de pavio com jitter temporal entre 80ms e 250ms.
            </p>

            <div className="mt-4 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1">
              <div>Matiz: <span className="text-amber-300">Âmbar e Ouro Quente</span></div>
              <div>Jitter randômico: <span className="text-neutral-400">uniform(0.08, 0.25)s</span></div>
            </div>
          </div>

          <button
            onClick={() => onStartScene('candle')}
            className={`mt-5 w-full py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              state.activeScene === 'candle'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{state.activeScene === 'candle' ? 'Executando...' : 'Iniciar Efeito Vela'}</span>
          </button>
        </div>

        {/* Card 3: Circadian Rhythm */}
        <div
          className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
            state.activeScene === 'circadian'
              ? 'border-emerald-400 bg-emerald-950/20'
              : 'border-neutral-800 bg-neutral-950/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Relógio Biológico
              </span>
              <Sun className="w-4 h-4 text-emerald-400" />
            </div>

            <h3 className="text-sm font-semibold text-white mt-2">Ritmo Circadiano 24H</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Worker em background que ajusta a temperatura Kelvin e brilho conforme o sol real, mantendo melatonina preservada à noite e foco de dia.
            </p>

            <div className="mt-4 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1">
              <div>Atualização: <span className="text-emerald-300">A cada 60s em background</span></div>
              <div>Curva atual: <span className="text-neutral-300">{previewCircadian.kelvin}K ({previewCircadian.brightness}% lux)</span></div>
            </div>
          </div>

          <button
            onClick={() => onStartScene('circadian')}
            className={`mt-5 w-full py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              state.activeScene === 'circadian'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{state.activeScene === 'circadian' ? 'Ativo em Background' : 'Ativar Circadiano'}</span>
          </button>
        </div>
      </div>

      {/* Interactive 24-Hour Solar Timeline Explorer */}
      <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Simulador da Curva Solar Circadiana</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-neutral-400">Horário Selecionado:</span>
            <span className="text-amber-400 font-semibold">{simulatedHour.toString().padStart(2, '0')}:00h</span>
            <span className="text-neutral-500">|</span>
            <span className="text-white">{previewCircadian.kelvin}K</span>
            <span className="text-neutral-500">|</span>
            <span className="text-emerald-400">{previewCircadian.brightness}% lux</span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="23"
          value={simulatedHour}
          onChange={(e) => setSimulatedHour(Number(e.target.value))}
          className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />

        {/* Timeline phases */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className={`p-2.5 rounded-lg border ${simulatedHour >= 0 && simulatedHour < 6 ? 'border-amber-400 bg-amber-950/20' : 'border-neutral-850 bg-neutral-900/60'}`}>
            <span className="font-semibold text-neutral-300 block">Madrugada (00h-06h)</span>
            <span className="text-[11px] text-neutral-400">2700K Âmbar · 25% lux</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${simulatedHour >= 6 && simulatedHour < 9 ? 'border-amber-400 bg-amber-950/20' : 'border-neutral-850 bg-neutral-900/60'}`}>
            <span className="font-semibold text-amber-300 block">Amanhecer (06h-09h)</span>
            <span className="text-[11px] text-neutral-400">2700K → 4500K · 40% → 100%</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${simulatedHour >= 9 && simulatedHour < 18 ? 'border-amber-400 bg-amber-950/20' : 'border-neutral-850 bg-neutral-900/60'}`}>
            <span className="font-semibold text-sky-300 block">Pleno Dia (09h-18h)</span>
            <span className="text-[11px] text-neutral-400">6500K Frio · 100% lux (Foco)</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${simulatedHour >= 18 && simulatedHour <= 23 ? 'border-amber-400 bg-amber-950/20' : 'border-neutral-850 bg-neutral-900/60'}`}>
            <span className="font-semibold text-amber-300 block">Anoitecer (18h-22h)</span>
            <span className="text-[11px] text-neutral-400">4500K → 2700K · 100% → 60%</span>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            onClick={() => onSetWhite(previewCircadian.brightness, previewCircadian.temp)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Aplicar Este Ponto Solar na Lâmpada Agora
          </button>
        </div>
      </div>
    </div>
  );
};
