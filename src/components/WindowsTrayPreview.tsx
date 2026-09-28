import React, { useState } from 'react';
import { BulbState } from '../types/bulb';
import { Keyboard, MousePointerClick, ChevronUp, Bell, Wifi, Volume2, Monitor } from 'lucide-react';

interface WindowsTrayPreviewProps {
  state: BulbState;
  onTogglePower: () => void;
  onSetWhite: (brightness: number, colorTemp: number) => void;
  onStartScene: (scene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight') => void;
}

export const WindowsTrayPreview: React.FC<WindowsTrayPreviewProps> = ({
  state,
  onTogglePower,
  onSetWhite,
  onStartScene,
}) => {
  const [menuOpen, setMenuOpen] = useState(true);
  const [activeSubmenu, setActiveSubmenu] = useState<'scenes' | 'presets' | 'brightness' | null>(null);

  const [r, g, b] = state.rgb;

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-base font-semibold text-white">Interface de Notificação Windows 11 (`ui/tray.py`)</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Ícone dinâmico em segundo plano via <code className="text-amber-300">pystray + Pillow</code> e atalhos de teclado nativos Win32
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>{menuOpen ? 'Ocultar Menu do Ícone' : 'Abrir Menu do Ícone'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Taskbar & Menu Simulation */}
        <div className="lg:col-span-7 flex flex-col justify-end">
          <div className="relative bg-neutral-950/90 rounded-2xl border border-neutral-800 p-6 min-h-[360px] flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Desktop Wallpaper Mock */}
            <div className="absolute inset-0 bg-gradient-to-tr from-neutral-950 via-neutral-900/50 to-neutral-950 opacity-90 pointer-events-none" />

            {/* Tray Context Menu Popover */}
            {menuOpen && (
              <div className="relative z-20 self-end mb-4 w-64 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 text-xs font-sans text-neutral-200 divide-y divide-neutral-800/80">
                <div className="pb-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Avant Neo 50W IoT
                  </div>
                  <button
                    onClick={onTogglePower}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 hover:text-white font-medium flex items-center justify-between transition-colors"
                  >
                    <span>Ligar / Desligar Lâmpada</span>
                    <span className="font-mono text-[10px] text-neutral-400">Ctrl+Alt+L</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setActiveSubmenu(activeSubmenu === 'scenes' ? null : 'scenes')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 hover:text-white font-medium flex items-center justify-between transition-colors"
                  >
                    <span>Cenas e Efeitos</span>
                    <span className="text-neutral-500">▶</span>
                  </button>

                  {activeSubmenu === 'scenes' && (
                    <div className="pl-3 pr-1 py-1 space-y-0.5 bg-neutral-950/70 rounded-lg my-1 border border-neutral-800/60">
                      <button
                        onClick={() => onStartScene('ambilight')}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-amber-300 text-[11px]"
                      >
                        Ambilight (Monitor Primário)
                      </button>
                      <button
                        onClick={() => onStartScene('circadian')}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-emerald-300 text-[11px]"
                      >
                        Ritmo Circadiano 24H
                      </button>
                      <button
                        onClick={() => onStartScene('candle')}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-amber-300 text-[11px]"
                      >
                        Vela / Lareira
                      </button>
                      <button
                        onClick={() => onStartScene('cyberpunk')}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-cyan-300 text-[11px]"
                      >
                        Cyberpunk Neon
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveSubmenu(activeSubmenu === 'presets' ? null : 'presets')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 hover:text-white font-medium flex items-center justify-between transition-colors"
                  >
                    <span>Presets Rápidos</span>
                    <span className="text-neutral-500">▶</span>
                  </button>

                  {activeSubmenu === 'presets' && (
                    <div className="pl-3 pr-1 py-1 space-y-0.5 bg-neutral-950/70 rounded-lg my-1 border border-neutral-800/60">
                      <button
                        onClick={() => onSetWhite(100, 50)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-white text-[11px]"
                      >
                        Modo Leitura (4000K, 100%)
                      </button>
                      <button
                        onClick={() => onSetWhite(100, 0)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-amber-300 text-[11px]"
                      >
                        Branco Quente (2700K)
                      </button>
                      <button
                        onClick={() => onSetWhite(100, 100)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-sky-300 text-[11px]"
                      >
                        Branco Frio (6500K)
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveSubmenu(activeSubmenu === 'brightness' ? null : 'brightness')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 hover:text-white font-medium flex items-center justify-between transition-colors"
                  >
                    <span>Ajuste de Brilho</span>
                    <span className="text-neutral-500">▶</span>
                  </button>

                  {activeSubmenu === 'brightness' && (
                    <div className="pl-3 pr-1 py-1 space-y-0.5 bg-neutral-950/70 rounded-lg my-1 border border-neutral-800/60">
                      {[100, 75, 50, 25, 10].map((lux) => (
                        <button
                          key={lux}
                          onClick={() => onSetWhite(lux, state.colorTemp)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-neutral-800 hover:text-white text-[11px]"
                        >
                          {lux}% ({lux * 10} DPS)
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <div className="px-2.5 py-1 text-[11px] text-neutral-400">
                    Status: <span className={state.isOn ? 'text-emerald-400' : 'text-neutral-500'}>{state.isOn ? 'Ligada' : 'Desligada'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Windows 11 Taskbar */}
            <div className="relative z-10 w-full h-12 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl px-4 flex items-center justify-between">
              {/* Left: Windows 11 Centered Icons Simulation */}
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 grid grid-cols-2 gap-0.5 opacity-80 hover:opacity-100 cursor-pointer">
                  <div className="bg-sky-400 rounded-xs" />
                  <div className="bg-sky-400 rounded-xs" />
                  <div className="bg-sky-400 rounded-xs" />
                  <div className="bg-sky-400 rounded-xs" />
                </div>
                <div className="w-32 h-6 bg-neutral-800/80 rounded-md border border-neutral-700/50 flex items-center px-2 text-[10px] text-neutral-400">
                  Pesquisar
                </div>
              </div>

              {/* Right: System Tray & Clock */}
              <div className="flex items-center gap-3">
                <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                <Wifi className="w-3.5 h-3.5 text-neutral-400" />
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />

                {/* The Dynamic Pystray Icon! */}
                <div
                  onClick={() => setMenuOpen(!menuOpen)}
                  title={`Avant Neo 50W (${state.isOn ? 'Ligada' : 'Desligada'})`}
                  className="w-6 h-6 rounded-md bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center cursor-pointer hover:bg-neutral-700 transition-colors shadow-sm"
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: state.isOn ? `rgb(${r}, ${g}, ${b})` : '#525252',
                      boxShadow: state.isOn
                        ? `0 0 8px rgba(${r}, ${g}, ${b}, 0.85)`
                        : 'none',
                    }}
                  />
                </div>

                <div className="text-[11px] font-mono text-neutral-300 text-right leading-tight">
                  <div>12:45</div>
                  <div className="text-[9px] text-neutral-500">28/09/2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Hotkeys Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-950 rounded-xl p-5 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Atalhos Globais Registrados (`core/hotkeys.py`)</span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Atalhos implementados com a API Win32 <code className="text-neutral-200">user32.RegisterHotKey</code>. Funcionam sobre qualquer jogo ou aplicação em tela cheia com 0% de uso de CPU.
            </p>

            <div className="space-y-2 pt-1 font-mono text-xs">
              <div
                onClick={onTogglePower}
                className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">Ligar / Desligar</span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 border border-neutral-700 font-semibold">
                  Ctrl + Alt + L
                </span>
              </div>

              <div
                onClick={() => onSetWhite(100, 50)}
                className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">Modo Leitura 4000K</span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold">
                  Ctrl + Alt + R
                </span>
              </div>

              <div
                onClick={() => onStartScene('ambilight')}
                className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">Ambilight Tela</span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-cyan-300 border border-neutral-700 font-semibold">
                  Ctrl + Alt + A
                </span>
              </div>

              <div
                onClick={() => onSetWhite(Math.min(100, state.brightness + 15), state.colorTemp)}
                className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">Aumentar Brilho (+15%)</span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold">
                  Ctrl + Alt + Up
                </span>
              </div>

              <div
                onClick={() => onSetWhite(Math.max(10, state.brightness - 15), state.colorTemp)}
                className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 cursor-pointer transition-colors"
              >
                <span className="text-neutral-300">Diminuir Brilho (-15%)</span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold">
                  Ctrl + Alt + Down
                </span>
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 font-mono">
              Clique em qualquer atalho acima para testar a ação imediatamente.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
