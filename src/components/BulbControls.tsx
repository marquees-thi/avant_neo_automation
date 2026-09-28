import React, { useState } from 'react';
import { BulbState } from '../types/bulb';
import { Sun, Palette, Sliders, Flame, Sparkles } from 'lucide-react';
import { rgbToHsv } from '../services/virtualTuyaBulb';

interface BulbControlsProps {
  state: BulbState;
  onSetWhite: (brightness: number, colorTemp: number) => void;
  onSetRgb: (r: number, g: number, b: number) => void;
  onStartScene: (scene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight') => void;
}

const COLOR_SWATCHES = [
  { name: 'Ciano Cyberpunk', rgb: [0, 255, 255] as [number, number, number] },
  { name: 'Magenta Neon', rgb: [255, 0, 150] as [number, number, number] },
  { name: 'Âmbar Dourado', rgb: [255, 140, 20] as [number, number, number] },
  { name: 'Violeta Profundo', rgb: [168, 85, 247] as [number, number, number] },
  { name: 'Azul Elétrico', rgb: [37, 99, 235] as [number, number, number] },
  { name: 'Verde Matrix', rgb: [34, 197, 94] as [number, number, number] },
  { name: 'Coral Pôr do Sol', rgb: [244, 63, 94] as [number, number, number] },
  { name: 'Branco Puro 5500K', rgb: [255, 245, 235] as [number, number, number] },
];

export const BulbControls: React.FC<BulbControlsProps> = ({
  state,
  onSetWhite,
  onSetRgb,
  onStartScene,
}) => {
  const [controlMode, setControlMode] = useState<'white' | 'rgb' | 'scenes'>('white');

  const currentKelvin = Math.round(2700 + (state.colorTemp / 100) * (6500 - 2700));

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 flex flex-col justify-between">
      {/* Top Segmented Controls */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-white">Parâmetros de Iluminação</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Ajuste fino de temperatura CCT, espectro RGB e efeitos dinâmicos</p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
            <button
              onClick={() => setControlMode('white')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                controlMode === 'white'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Branco CCT
            </button>
            <button
              onClick={() => setControlMode('rgb')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                controlMode === 'rgb'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Cores RGB
            </button>
            <button
              onClick={() => setControlMode('scenes')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                controlMode === 'scenes'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Efeitos & Cenas
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="pt-6">
          {controlMode === 'white' && (
            <div className="space-y-6">
              {/* Color Temperature Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300 font-medium">Temperatura de Cor (CCT)</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-amber-400 font-semibold">{currentKelvin}K</span>
                    <span className="text-neutral-500">({state.colorTemp}%)</span>
                  </div>
                </div>

                <div className="relative pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={state.colorTemp}
                    onChange={(e) => onSetWhite(state.brightness, Number(e.target.value))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff9e22 0%, #ffdf9e 40%, #ffffff 70%, #d4e8ff 100%)',
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2 font-mono">
                    <span>2700K (Âmbar/Quente)</span>
                    <span>4500K (Neutro)</span>
                    <span>6500K (Luz Fria)</span>
                  </div>
                </div>
              </div>

              {/* White Brightness */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300 font-medium">Intensidade do Branco</span>
                  <span className="font-mono text-neutral-200">{state.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={state.brightness}
                  onChange={(e) => onSetWhite(Number(e.target.value), state.colorTemp)}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Kelvin Presets */}
              <div className="pt-2">
                <span className="text-xs font-medium text-neutral-400 block mb-2">Predefinições de Trabalho</span>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => onSetWhite(100, 0)}
                    className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 text-left transition-colors"
                  >
                    <div className="text-xs font-semibold text-amber-300">2700K Relax</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Luz quente aconchegante</div>
                  </button>
                  <button
                    onClick={() => onSetWhite(100, 50)}
                    className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 text-left transition-colors"
                  >
                    <div className="text-xs font-semibold text-neutral-200">4600K Leitura</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Equilíbrio para leitura</div>
                  </button>
                  <button
                    onClick={() => onSetWhite(100, 100)}
                    className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/80 text-left transition-colors"
                  >
                    <div className="text-xs font-semibold text-sky-300">6500K Foco</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Alerta e produtividade</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {controlMode === 'rgb' && (
            <div className="space-y-6">
              {/* Quick Color Swatches */}
              <div>
                <span className="text-xs font-medium text-neutral-400 block mb-3">Paleta Rápida da Estação</span>
                <div className="grid grid-cols-4 gap-2.5">
                  {COLOR_SWATCHES.map((swatch) => {
                    const isSelected =
                      state.mode === 'colour' &&
                      state.rgb[0] === swatch.rgb[0] &&
                      state.rgb[1] === swatch.rgb[1] &&
                      state.rgb[2] === swatch.rgb[2];

                    return (
                      <button
                        key={swatch.name}
                        onClick={() => onSetRgb(...swatch.rgb)}
                        className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-neutral-800/80'
                            : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/60'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full shadow-inner"
                          style={{ backgroundColor: `rgb(${swatch.rgb.join(',')})` }}
                        />
                        <span className="text-[11px] text-neutral-300 font-medium truncate w-full text-center">
                          {swatch.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fine RGB Sliders */}
              <div className="space-y-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
                <span className="text-xs font-medium text-neutral-400 block mb-1">Ajuste Fino de Canais (R, G, B)</span>
                
                {/* Red */}
                <div className="flex items-center gap-3">
                  <span className="w-4 text-xs font-mono text-red-400 font-semibold">R</span>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={state.rgb[0]}
                    onChange={(e) => onSetRgb(Number(e.target.value), state.rgb[1], state.rgb[2])}
                    className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <span className="w-8 text-right font-mono text-xs text-neutral-300">{state.rgb[0]}</span>
                </div>

                {/* Green */}
                <div className="flex items-center gap-3">
                  <span className="w-4 text-xs font-mono text-emerald-400 font-semibold">G</span>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={state.rgb[1]}
                    onChange={(e) => onSetRgb(state.rgb[0], Number(e.target.value), state.rgb[2])}
                    className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="w-8 text-right font-mono text-xs text-neutral-300">{state.rgb[1]}</span>
                </div>

                {/* Blue */}
                <div className="flex items-center gap-3">
                  <span className="w-4 text-xs font-mono text-blue-400 font-semibold">B</span>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={state.rgb[2]}
                    onChange={(e) => onSetRgb(state.rgb[0], state.rgb[1], Number(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="w-8 text-right font-mono text-xs text-neutral-300">{state.rgb[2]}</span>
                </div>
              </div>
            </div>
          )}

          {controlMode === 'scenes' && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-neutral-400 block mb-2">Motores Contínuos em Thread Dedicada</span>
              
              <div
                onClick={() => onStartScene('cyberpunk')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  state.activeScene === 'cyberpunk'
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
                    <span className="text-sm font-semibold text-white">Cyberpunk Neon Pulse</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-300">20 Hz</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1.5">
                  Oscilação senoidal suave entre Ciano Elétrico (0, 255, 255) e Magenta Neon (255, 0, 150).
                </p>
              </div>

              <div
                onClick={() => onStartScene('candle')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  state.activeScene === 'candle'
                    ? 'border-amber-400 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">Vela Viva / Lareira Âmbar</span>
                  </div>
                  <span className="text-xs font-mono text-amber-300">Jitter Orgânico</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1.5">
                  Variação pseudo-aleatória de temperatura e intensidade simulando chama orgânica.
                </p>
              </div>

              <div
                onClick={() => onStartScene('circadian')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  state.activeScene === 'circadian'
                    ? 'border-emerald-400 bg-emerald-950/20'
                    : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sun className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Ritmo Circadiano 24H</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-300">Auto Solar</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1.5">
                  Worker em segundo plano adaptando Kelvin e lux com base no relógio do Windows.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
        <span>DPS 21 Mode: {state.mode}</span>
        <span>DPS 22 Lux: {state.brightness * 10}</span>
        <span>DPS 23 Temp: {state.colorTemp * 10}</span>
      </div>
    </div>
  );
};
