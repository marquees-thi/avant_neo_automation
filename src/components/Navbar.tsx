import React, { useState } from 'react';
import { Power, Download, Monitor, Activity, Terminal, Code, BookOpen, Wifi, WifiOff, RefreshCw, Settings2 } from 'lucide-react';
import { BulbState } from '../types/bulb';
import { BridgeStatus } from '../services/apiBridge';

interface NavbarProps {
  activeTab: 'cockpit' | 'ambilight' | 'api' | 'code' | 'guide';
  setActiveTab: (tab: 'cockpit' | 'ambilight' | 'api' | 'code' | 'guide') => void;
  state: BulbState;
  bridgeStatus: BridgeStatus;
  onTogglePower: () => void;
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
  onReconnectBridge: () => void;
  onUpdateBackendUrl: (url: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  state,
  bridgeStatus,
  onTogglePower,
  onDownloadZip,
  isDownloadingZip,
  onReconnectBridge,
  onUpdateBackendUrl,
}) => {
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [tempUrl, setTempUrl] = useState(bridgeStatus.backendUrl);

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
        {/* Zone 1: Single text element wordmark + Real Device Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className="w-3.5 h-3.5 rounded-full transition-all duration-300 shadow-sm"
            style={{
              backgroundColor: state.isOn
                ? `rgb(${state.rgb[0]}, ${state.rgb[1]}, ${state.rgb[2]})`
                : '#525252',
              boxShadow: state.isOn
                ? `0 0 12px rgba(${state.rgb[0]}, ${state.rgb[1]}, ${state.rgb[2]}, 0.8)`
                : 'none',
            }}
          />
          <button
            onClick={() => setActiveTab('cockpit')}
            className="text-left font-bold tracking-tight text-white hover:text-amber-300 transition-colors"
          >
            Avant Neo 50W IoT
          </button>

          {/* Real Device Hardware Status Pill */}
          <button
            onClick={() => setShowBridgeModal(true)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-full border transition-all ${
              bridgeStatus.isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Clique para configurar a conexão com o servidor Python local"
          >
            {bridgeStatus.isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Lâmpada Real ({bridgeStatus.latencyMs}ms)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>Modo Simulador (Conectar)</span>
              </>
            )}
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`transition-colors flex items-center gap-1.5 ${
              activeTab === 'cockpit' ? 'text-white font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Cockpit & Lâmpada</span>
          </button>
          <button
            onClick={() => setActiveTab('ambilight')}
            className={`transition-colors flex items-center gap-1.5 ${
              activeTab === 'ambilight' ? 'text-white font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Ambilight & Efeitos</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`transition-colors flex items-center gap-1.5 ${
              activeTab === 'api' ? 'text-white font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>API REST & Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`transition-colors flex items-center gap-1.5 ${
              activeTab === 'code' ? 'text-white font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Código Python Windows 11</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`transition-colors flex items-center gap-1.5 ${
              activeTab === 'guide' ? 'text-white font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Instalação</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePower}
            title={state.isOn ? 'Desligar Lâmpada' : 'Ligar Lâmpada'}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all duration-200 ${
              state.isOn
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{state.isOn ? 'Ligada' : 'Desligada'}</span>
          </button>

          <button
            onClick={onDownloadZip}
            disabled={isDownloadingZip}
            className="px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingZip ? 'Gerando...' : 'Baixar (.zip)'}</span>
          </button>
        </div>
      </header>

      {/* Connection Bridge Modal */}
      {showBridgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Comunicação com a Lâmpada Local</h3>
              </div>
              <button
                onClick={() => setShowBridgeModal(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              O aplicativo no navegador comunica-se diretamente com o serviço Python rodando na sua máquina via HTTP local:
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300">URL do Servidor Local (FastAPI):</label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="http://127.0.0.1:21420"
                className="w-full p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Status atual:</span>
                <span className={bridgeStatus.isConnected ? 'text-emerald-400 font-semibold flex items-center gap-1.5' : 'text-amber-400 font-semibold'}>
                  {bridgeStatus.isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  {bridgeStatus.isConnected ? 'Conectado à Lâmpada Física' : 'Desconectado'}
                </span>
              </div>
              {bridgeStatus.isConnected && (
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-neutral-500">Latência da API Local:</span>
                  <span className="text-emerald-300 font-medium">{bridgeStatus.latencyMs}ms</span>
                </div>
              )}
              {bridgeStatus.isMixedContentRisk && !bridgeStatus.isConnected && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded border border-amber-500/20 space-y-1.5 mt-2">
                  <div className="font-semibold text-amber-200">Atenção (Bloqueio HTTPS do Navegador):</div>
                  <div>
                    Você está acessando esta página via HTTPS. Navegadores bloqueiam conexões diretas para servidores HTTP locais (127.0.0.1).
                  </div>
                  <div>
                    👉 Abra o Cockpit diretamente pelo servidor Python local:
                  </div>
                  <a
                    href="http://127.0.0.1:21420"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 px-3 py-1 bg-amber-400 text-neutral-950 font-bold rounded text-[11px] hover:bg-amber-300"
                  >
                    Abrir http://127.0.0.1:21420
                  </a>
                </div>
              )}
              {bridgeStatus.error && !bridgeStatus.isConnected && !bridgeStatus.isMixedContentRisk && (
                <div className="text-[11px] text-rose-400 mt-1">
                  Nota: Inicie o software no Windows com <code className="text-neutral-300">python main.py</code> ou pelo ícone na barra de tarefas para conectar.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  onUpdateBackendUrl(tempUrl);
                  onReconnectBridge();
                }}
                disabled={bridgeStatus.isChecking}
                className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bridgeStatus.isChecking ? 'animate-spin' : ''}`} />
                <span>{bridgeStatus.isChecking ? 'Testando...' : 'Salvar & Conectar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
