import React from 'react';
import { BulbState } from '../types/bulb';
import { Sun, Sparkles, Sliders, Moon } from 'lucide-react';

interface BulbVisualizerProps {
  state: BulbState;
  onToggle: () => void;
  onBrightnessChange: (b: number) => void;
  onQuickPreset: (type: 'reading' | 'focus' | 'relax' | 'night' | 'cyberpunk') => void;
}

export const BulbVisualizer: React.FC<BulbVisualizerProps> = ({
  state,
  onToggle,
  onBrightnessChange,
  onQuickPreset,
}) => {
  const [r, g, b] = state.rgb;
  const currentKelvin = Math.round(2700 + (state.colorTemp / 100) * (6500 - 2700));
  const glowOpacity = state.isOn ? Math.max(0.15, state.brightness / 100) : 0;

  return (
    <div className="relative rounded-2xl bg-neutral-900 border border-neutral-800 p-6 flex flex-col items-center justify-between min-h-[460px] overflow-hidden">
      {/* Background Ambient Radiance */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: state.isOn
            ? `radial-gradient(circle at 50% 32%, rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.45}) 0%, rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.15}) 45%, transparent 75%)`
            : 'radial-gradient(circle at 50% 35%, rgba(40,40,40,0.2) 0%, transparent 60%)',
        }}
      />

      {/* Header Info */}
      <div className="w-full flex items-center justify-between text-xs text-neutral-400 z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-200">Avant Neo 50W</span>
          <span aria-hidden="true">·</span>
          <span>RGB/CCT</span>
          <span aria-hidden="true">·</span>
          <span>TCP :6668</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          {state.isOn ? (
            state.mode === 'white' ? (
              <span className="text-amber-400">{currentKelvin}K</span>
            ) : (
              <span className="text-emerald-400">RGB({r}, {g}, {b})</span>
            )
          ) : (
            <span className="text-neutral-500">Standby (0W)</span>
          )}
        </div>
      </div>

      {/* Visual Bulb Model */}
      <div className="relative my-4 flex flex-col items-center justify-center z-10 cursor-pointer" onClick={onToggle}>
        {/* Upper Diffuser Dome */}
        <div
          className="w-36 h-36 rounded-full transition-all duration-300 relative flex items-center justify-center border"
          style={{
            backgroundColor: state.isOn
              ? `rgb(${r}, ${g}, ${b})`
              : '#262626',
            borderColor: state.isOn
              ? `rgba(${r}, ${g}, ${b}, 0.8)`
              : '#404040',
            boxShadow: state.isOn
              ? `0 0 ${40 * (state.brightness / 100)}px ${15 * (state.brightness / 100)}px rgba(${r}, ${g}, ${b}, 0.7), inset 0 2px 10px rgba(255,255,255,0.8)`
              : 'inset 0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          {/* Internal Diffuser Gradient */}
          <div
            className="w-28 h-28 rounded-full pointer-events-none transition-opacity duration-300"
            style={{
              background: state.isOn
                ? `radial-gradient(circle, rgba(255,255,255,0.95) 15%, rgba(${r}, ${g}, ${b}, 0.4) 80%)`
                : 'radial-gradient(circle, rgba(70,70,70,0.3) 10%, transparent 80%)',
            }}
          />

          {/* Active scene badge over bulb */}
          {state.isOn && state.activeScene && (
            <div className="absolute -top-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900/90 text-amber-300 border border-amber-500/40 shadow-lg capitalize">
              {state.activeScene}
            </div>
          )}
        </div>

        {/* Heat Sink Fin Neck */}
        <div className="-mt-3 w-24 h-12 bg-neutral-800 border-x border-neutral-700 rounded-t-sm flex flex-col justify-around py-1 px-2 shadow-inner z-0">
          <div className="h-0.5 bg-neutral-700/80 rounded" />
          <div className="h-0.5 bg-neutral-700/80 rounded" />
          <div className="h-0.5 bg-neutral-700/80 rounded" />
          <div className="flex items-center justify-center">
            <span className="text-[9px] font-mono tracking-wider text-neutral-400">AVANT NEO</span>
          </div>
        </div>

        {/* Lamp Base (E27 Thread) */}
        <div className="w-16 h-7 bg-neutral-700 border-t border-neutral-600 rounded-b flex flex-col justify-between py-0.5 px-1 shadow-md">
          <div className="h-0.5 bg-neutral-600 rounded" />
          <div className="h-0.5 bg-neutral-600 rounded" />
          <div className="h-0.5 bg-neutral-600 rounded" />
        </div>
        <div className="w-8 h-2 bg-neutral-600 rounded-b-md" />

        {/* Desk Ambient Surface Reflection */}
        <div
          className="w-64 h-3.5 mt-2 rounded-full filter blur-sm transition-all duration-300"
          style={{
            backgroundColor: state.isOn
              ? `rgb(${r}, ${g}, ${b})`
              : '#171717',
            opacity: state.isOn ? (state.brightness / 100) * 0.7 : 0.05,
          }}
        />
      </div>

      {/* Tactile Brightness Slider & Presets */}
      <div className="w-full z-10 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" />
              <span>Brilho</span>
            </span>
            <span className="font-mono text-neutral-200">{state.brightness}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={state.brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Quick Mode Preset Buttons */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          <button
            onClick={() => onQuickPreset('reading')}
            className="flex-1 py-1.5 px-2 text-xs font-medium bg-neutral-800/80 hover:bg-neutral-800 hover:text-white text-neutral-300 rounded-lg border border-neutral-700/60 transition-colors text-center"
          >
            Leitura 4000K
          </button>
          <button
            onClick={() => onQuickPreset('focus')}
            className="flex-1 py-1.5 px-2 text-xs font-medium bg-neutral-800/80 hover:bg-neutral-800 hover:text-white text-neutral-300 rounded-lg border border-neutral-700/60 transition-colors text-center"
          >
            Foco 6500K
          </button>
          <button
            onClick={() => onQuickPreset('relax')}
            className="flex-1 py-1.5 px-2 text-xs font-medium bg-neutral-800/80 hover:bg-neutral-800 hover:text-white text-neutral-300 rounded-lg border border-neutral-700/60 transition-colors text-center"
          >
            Relax 2700K
          </button>
          <button
            onClick={() => onQuickPreset('night')}
            className="flex-1 py-1.5 px-2 text-xs font-medium bg-neutral-800/80 hover:bg-neutral-800 hover:text-white text-neutral-300 rounded-lg border border-neutral-700/60 transition-colors text-center"
          >
            Noturno 15%
          </button>
          <button
            onClick={() => onQuickPreset('cyberpunk')}
            className="flex-1 py-1.5 px-2 text-xs font-medium bg-neutral-800/80 hover:bg-neutral-800 hover:text-cyan-300 text-neutral-300 rounded-lg border border-neutral-700/60 transition-colors text-center"
          >
            Cyberpunk
          </button>
        </div>
      </div>
    </div>
  );
};
