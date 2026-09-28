import React from 'react';
import { Power, Download, Monitor, Activity, Terminal, Code, BookOpen } from 'lucide-react';
import { BulbState } from '../types/bulb';

interface NavbarProps {
  activeTab: 'cockpit' | 'ambilight' | 'api' | 'code' | 'guide';
  setActiveTab: (tab: 'cockpit' | 'ambilight' | 'api' | 'code' | 'guide') => void;
  state: BulbState;
  onTogglePower: () => void;
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  state,
  onTogglePower,
  onDownloadZip,
  isDownloadingZip,
}) => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
      {/* Zone 1: Single text element wordmark */}
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
          <span>{isDownloadingZip ? 'Gerando .ZIP...' : 'Baixar Projeto (.zip)'}</span>
        </button>
      </div>
    </header>
  );
};
