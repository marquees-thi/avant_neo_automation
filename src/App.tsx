import React, { useState, useEffect, useCallback } from 'react';
import { BulbState, TuyaDPS, TuyaPacketLog, ApiLog } from './types/bulb';
import { virtualBulb } from './services/virtualTuyaBulb';
import { apiBridge, BridgeStatus, RemoteBulbStatus } from './services/apiBridge';
import { Navbar } from './components/Navbar';
import { BulbVisualizer } from './components/BulbVisualizer';
import { BulbControls } from './components/BulbControls';
import { AmbilightEngine } from './components/AmbilightEngine';
import { ScenesEngine } from './components/ScenesEngine';
import { TuyaInspector } from './components/TuyaInspector';
import { ApiExplorer } from './components/ApiExplorer';
import { WindowsTrayPreview } from './components/WindowsTrayPreview';
import { CodeExplorer } from './components/CodeExplorer';
import { SetupGuide } from './components/SetupGuide';
import { PYTHON_FILES } from './data/pythonFiles';
import JSZip from 'jszip';

export default function App() {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'ambilight' | 'api' | 'code' | 'guide'>('cockpit');
  const [bulbState, setBulbState] = useState<BulbState>(virtualBulb.getState());
  const [tuyaDps, setTuyaDps] = useState<TuyaDPS>(virtualBulb.getTuyaDPS());
  const [packets, setPackets] = useState<TuyaPacketLog[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(apiBridge.getStatus());

  // Subscribe to real Python backend bridge
  useEffect(() => {
    const unsubBridgeStatus = apiBridge.subscribeStatus((newStatus) => {
      setBridgeStatus(newStatus);
    });

    const unsubBridgeData = apiBridge.subscribeData((remote: RemoteBulbStatus) => {
      // Sync real bulb hardware state with React UI
      setBulbState((prev) => ({
        ...prev,
        isOn: remote.power,
        mode: remote.mode as 'white' | 'colour' | 'scene',
        brightness: remote.brightness,
        colorTemp: remote.color_temp,
        rgb: remote.rgb,
        activeScene: (remote.active_scene as any) || (remote.ambilight_running ? 'ambilight' : null),
        lastUpdated: Date.now(),
      }));
    });

    return () => {
      unsubBridgeStatus();
      unsubBridgeData();
    };
  }, []);

  // Subscribe to virtual bulb events
  useEffect(() => {
    const unsubState = virtualBulb.subscribe((newState) => {
      if (!bridgeStatus.isConnected) {
        setBulbState(newState);
      }
      setTuyaDps(virtualBulb.getTuyaDPS());
    });

    const unsubPackets = virtualBulb.subscribePackets((newPkt) => {
      setPackets((prev) => [newPkt, ...prev.slice(0, 49)]);
    });

    const unsubApi = virtualBulb.subscribeApiLogs((newLog) => {
      setApiLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubState();
      unsubPackets();
      unsubApi();
    };
  }, [bridgeStatus.isConnected]);

  // Integrated Handlers (Dispatches to real hardware via apiBridge AND updates simulator)
  const handleTogglePower = useCallback(async () => {
    virtualBulb.toggle();
    if (bridgeStatus.isConnected) {
      await apiBridge.togglePower();
    }
  }, [bridgeStatus.isConnected]);

  const handleSetWhite = useCallback(async (brightness: number, colorTemp: number) => {
    virtualBulb.setWhite(brightness, colorTemp);
    if (bridgeStatus.isConnected) {
      await apiBridge.setWhite(brightness, colorTemp);
    }
  }, [bridgeStatus.isConnected]);

  const handleSetRgb = useCallback(async (r: number, g: number, b: number) => {
    virtualBulb.setRgb(r, g, b);
    if (bridgeStatus.isConnected) {
      await apiBridge.setRgb(r, g, b, false);
    }
  }, [bridgeStatus.isConnected]);

  const handleSetRgbStream = useCallback((r: number, g: number, b: number) => {
    virtualBulb.setRgb(r, g, b, true);
    if (bridgeStatus.isConnected) {
      apiBridge.setRgb(r, g, b, true);
    }
  }, [bridgeStatus.isConnected]);

  const handleStartScene = useCallback(async (scene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight') => {
    virtualBulb.startScene(scene);
    if (bridgeStatus.isConnected) {
      await apiBridge.startScene(scene);
    }
  }, [bridgeStatus.isConnected]);

  const handleStopScene = useCallback(async (restoreWhite = true) => {
    virtualBulb.stopScene();
    if (restoreWhite) {
      virtualBulb.setWhite(100, 50);
    }
    if (bridgeStatus.isConnected) {
      await apiBridge.stopScene(restoreWhite);
    }
  }, [bridgeStatus.isConnected]);

  const handleRestoreNormal = useCallback(async () => {
    virtualBulb.stopScene();
    virtualBulb.setWhite(100, 50);
    if (bridgeStatus.isConnected) {
      await apiBridge.restoreNormalWhite();
    }
  }, [bridgeStatus.isConnected]);

  // Quick Preset Handler
  const handleQuickPreset = useCallback(async (type: 'reading' | 'focus' | 'relax' | 'night' | 'cyberpunk') => {
    if (type === 'reading') {
      await handleSetWhite(100, 50); // 4600K
    } else if (type === 'focus') {
      await handleSetWhite(100, 100); // 6500K
    } else if (type === 'relax') {
      await handleSetWhite(100, 0); // 2700K
    } else if (type === 'night') {
      await handleSetWhite(15, 0); // 2700K 15% lux
    } else if (type === 'cyberpunk') {
      await handleStartScene('cyberpunk');
    }
  }, [handleSetWhite, handleStartScene]);

  // ZIP Generation & Download
  const handleDownloadZip = async () => {
    try {
      setIsDownloadingZip(true);
      const zip = new JSZip();

      PYTHON_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'avant_light_controller_win11.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error creating ZIP archive:', err);
      alert('Erro ao compactar os arquivos do projeto.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* 3-Zone Top Navigation Bar with Real Hardware Connection Badge */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        state={bulbState}
        bridgeStatus={bridgeStatus}
        onTogglePower={handleTogglePower}
        onDownloadZip={handleDownloadZip}
        isDownloadingZip={isDownloadingZip}
        onReconnectBridge={() => apiBridge.checkConnection()}
        onUpdateBackendUrl={(url) => apiBridge.setBackendUrl(url)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Tab 1: Cockpit & Lâmpada */}
        {activeTab === 'cockpit' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Visual Bulb Model */}
              <div className="lg:col-span-5">
                <BulbVisualizer
                  state={bulbState}
                  onToggle={handleTogglePower}
                  onBrightnessChange={(b) => handleSetWhite(b, bulbState.colorTemp)}
                  onQuickPreset={handleQuickPreset}
                />
              </div>

              {/* Right Column: Fine Controls */}
              <div className="lg:col-span-7">
                <BulbControls
                  state={bulbState}
                  onSetWhite={handleSetWhite}
                  onSetRgb={handleSetRgb}
                  onStartScene={handleStartScene}
                />
              </div>
            </div>

            {/* Protocol & DPS Inspector */}
            <TuyaInspector
              state={bulbState}
              dps={tuyaDps}
              packets={packets}
              onClearPackets={() => setPackets([])}
            />

            {/* Windows 11 Tray Interface Preview */}
            <WindowsTrayPreview
              state={bulbState}
              onTogglePower={handleTogglePower}
              onSetWhite={handleSetWhite}
              onStartScene={handleStartScene}
            />
          </div>
        )}

        {/* Tab 2: Ambilight & Efeitos */}
        {activeTab === 'ambilight' && (
          <div className="space-y-8">
            <AmbilightEngine
              state={bulbState}
              onSetRgbStream={handleSetRgbStream}
              onStopScene={handleStopScene}
            />

            <ScenesEngine
              state={bulbState}
              onStartScene={handleStartScene}
              onStopScene={handleStopScene}
              onSetWhite={handleSetWhite}
            />
          </div>
        )}

        {/* Tab 3: API REST & Logs */}
        {activeTab === 'api' && (
          <div className="space-y-8">
            <ApiExplorer state={bulbState} apiLogs={apiLogs} />

            <TuyaInspector
              state={bulbState}
              dps={tuyaDps}
              packets={packets}
              onClearPackets={() => setPackets([])}
            />
          </div>
        )}

        {/* Tab 4: Código Python Windows 11 */}
        {activeTab === 'code' && (
          <div className="space-y-8">
            <CodeExplorer
              onDownloadZip={handleDownloadZip}
              isDownloadingZip={isDownloadingZip}
            />
          </div>
        )}

        {/* Tab 5: Guia de Instalação */}
        {activeTab === 'guide' && (
          <div className="space-y-8">
            <SetupGuide />
            <WindowsTrayPreview
              state={bulbState}
              onTogglePower={handleTogglePower}
              onSetWhite={handleSetWhite}
              onStartScene={handleStartScene}
            />
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-neutral-800/80 py-4 px-6 text-center text-xs text-neutral-500 font-mono">
        <span>Avant Neo 50W RGB/CCT IoT Automation Suite</span>
        <span className="mx-2">·</span>
        <span>Tuya Protocol 3.5 (TCP 6668 / UDP 6666-6667)</span>
        <span className="mx-2">·</span>
        <span className={bridgeStatus.isConnected ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
          {bridgeStatus.isConnected ? `Hardware Conectado (${bridgeStatus.backendUrl})` : 'Modo Simulador'}
        </span>
      </footer>
    </div>
  );
}
