import React, { useState, useEffect, useRef } from 'react';
import { BulbState } from '../types/bulb';
import { Play, Square, Settings2, Video, Sliders, RefreshCw, Zap } from 'lucide-react';

interface AmbilightEngineProps {
  state: BulbState;
  onSetRgbStream: (r: number, g: number, b: number) => void;
  onStopScene: () => void;
}

export const AmbilightEngine: React.FC<AmbilightEngineProps> = ({
  state,
  onSetRgbStream,
  onStopScene,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState<'screen' | 'synthetic'>('synthetic');
  const [syntheticPattern, setSyntheticPattern] = useState<'cyberpunk' | 'sunset' | 'aurora' | 'gaming'>('cyberpunk');
  
  // Ambilight Parameters from config.yaml
  const [targetFps, setTargetFps] = useState(20);
  const [saturationBoost, setSaturationBoost] = useState(1.35);
  const [smoothFactor, setSmoothFactor] = useState(0.25);

  // Live Metrics
  const [measuredFps, setMeasuredFps] = useState(20);
  const [rawColor, setRawColor] = useState<[number, number, number]>([0, 0, 0]);
  const [boostedColor, setBoostedColor] = useState<[number, number, number]>([0, 0, 0]);
  const [finalLerpColor, setFinalLerpColor] = useState<[number, number, number]>([0, 0, 0]);

  // Video / Canvas References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentLerpRef = useRef<[number, number, number]>([255, 255, 255]);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());

  // Boost Saturation Function matching Python screen_sync.py
  const boostSaturation = (r: number, g: number, b: number, factor: number): [number, number, number] => {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;
    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;

    if (max === 0) return [0, 0, 0];

    let s = delta / max;
    const v = max;
    s = Math.min(1.0, s * factor);

    if (delta === 0) {
      const val = Math.round(v * 255);
      return [val, val, val];
    }

    let h = 0;
    if (max === rf) {
      h = ((gf - bf) / delta) % 6;
    } else if (max === gf) {
      h = (bf - rf) / delta + 2;
    } else {
      h = (rf - gf) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1 = 0, g1 = 0, b1 = 0;
    if (h >= 0 && h < 60) {
      r1 = c; g1 = x; b1 = 0;
    } else if (h >= 60 && h < 120) {
      r1 = x; g1 = c; b1 = 0;
    } else if (h >= 120 && h < 180) {
      r1 = 0; g1 = c; b1 = x;
    } else if (h >= 180 && h < 240) {
      r1 = 0; g1 = x; b1 = c;
    } else if (h >= 240 && h < 300) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }

    return [
      Math.round((r1 + m) * 255),
      Math.round((g1 + m) * 255),
      Math.round((b1 + m) * 255),
    ];
  };

  const startScreenCapture = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: targetFps } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsRunning(true);
      } else {
        alert('Seu navegador não suporta compartilhamento de tela neste ambiente. Alternando para modo sintético de alta velocidade.');
        setSourceType('synthetic');
        setIsRunning(true);
      }
    } catch (err) {
      console.warn('Screen capture declined or unavailable:', err);
      // Fallback to synthetic
      setSourceType('synthetic');
      setIsRunning(true);
    }
  };

  const stopAmbilight = () => {
    setIsRunning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    onStopScene();
  };

  // Synthetic Canvas Animation Loop
  useEffect(() => {
    if (!isRunning) return;

    let syntheticTime = 0;
    const intervalMs = 1000 / targetFps;

    const processFrame = () => {
      const now = performance.now();
      if (now - lastTickRef.current >= intervalMs) {
        lastTickRef.current = now;
        frameCountRef.current++;

        let sampleR = 0;
        let sampleG = 0;
        let sampleB = 0;

        if (sourceType === 'screen' && videoRef.current && videoRef.current.readyState >= 2) {
          // Downsampling from real video
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 1, 1);
              const pixel = ctx.getImageData(0, 0, 1, 1).data;
              sampleR = pixel[0];
              sampleG = pixel[1];
              sampleB = pixel[2];
            }
          }
        } else {
          // Synthetic Pattern Generator
          syntheticTime += 0.05;
          if (syntheticPattern === 'cyberpunk') {
            const wave = (Math.sin(syntheticTime) + 1) / 2;
            sampleR = Math.round(wave * 255);
            sampleG = Math.round((1 - wave) * 230);
            sampleB = 255;
          } else if (syntheticPattern === 'sunset') {
            const wave = (Math.sin(syntheticTime * 0.8) + 1) / 2;
            sampleR = 255;
            sampleG = Math.round(90 + wave * 90);
            sampleB = Math.round(20 + wave * 40);
          } else if (syntheticPattern === 'aurora') {
            const wave = (Math.sin(syntheticTime * 1.2) + 1) / 2;
            sampleR = Math.round(15 + wave * 40);
            sampleG = Math.round(180 + wave * 75);
            sampleB = Math.round(140 + wave * 100);
          } else {
            // Gaming action
            const wave = (Math.sin(syntheticTime * 2.5) + 1) / 2;
            sampleR = Math.round(220 * wave);
            sampleG = Math.round(40 + 160 * (1 - wave));
            sampleB = Math.round(240 * (1 - wave));
          }
        }

        // Draw preview representation
        const prevCanvas = previewCanvasRef.current;
        if (prevCanvas) {
          const ctx = prevCanvas.getContext('2d');
          if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, prevCanvas.width, prevCanvas.height);
            grad.addColorStop(0, `rgb(${sampleR}, ${sampleG}, ${sampleB})`);
            grad.addColorStop(1, `rgb(${Math.round(sampleR * 0.6)}, ${Math.round(sampleG * 0.6)}, ${Math.round(sampleB * 0.6)})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, prevCanvas.width, prevCanvas.height);
          }
        }

        setRawColor([sampleR, sampleG, sampleB]);

        // Saturation Boost
        const [boostedR, boostedG, boostedB] = boostSaturation(sampleR, sampleG, sampleB, saturationBoost);
        setBoostedColor([boostedR, boostedG, boostedB]);

        // LERP Smooth
        const [curR, curG, curB] = currentLerpRef.current;
        const finalR = curR + (boostedR - curR) * smoothFactor;
        const finalG = curG + (boostedG - curG) * smoothFactor;
        const finalB = curB + (boostedB - curB) * smoothFactor;
        currentLerpRef.current = [finalR, finalG, finalB];

        const outR = Math.round(finalR);
        const outG = Math.round(finalG);
        const outB = Math.round(finalB);

        setFinalLerpColor([outR, outG, outB]);
        onSetRgbStream(outR, outG, outB);

        // FPS meter
        if (Date.now() - lastFpsCalcRef.current >= 1000) {
          setMeasuredFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsCalcRef.current = Date.now();
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, sourceType, syntheticPattern, targetFps, saturationBoost, smoothFactor]);

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Ambilight Engine (Screen Sync)</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              mss + LERP 20 FPS
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Captura do monitor em tempo real, redução bilinear para 1x1 pixel, realce de saturação HSV e amortecimento LERP
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={stopAmbilight}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-500 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Parar Ambilight</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (sourceType === 'screen') {
                  startScreenCapture();
                } else {
                  setIsRunning(true);
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-neutral-950" />
              <span>Iniciar Ambilight</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Visual Pipeline + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline Preview Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
              <span className="font-medium text-neutral-200">Pipeline de Processamento em Tempo Real</span>
              <span className="font-mono text-emerald-400">{measuredFps} FPS Estável</span>
            </div>

            {/* Hidden capture element */}
            <video ref={videoRef} className="hidden" autoPlay playsInline muted />
            <canvas ref={canvasRef} width={1} height={1} className="hidden" />

            {/* Visual Canvas Display */}
            <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 h-44 flex items-center justify-center">
              <canvas ref={previewCanvasRef} width={320} height={180} className="w-full h-full object-cover" />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
              
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono">
                <span className="text-white bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                  Entrada: {sourceType === 'screen' ? 'Monitor Primário (mss)' : `Sintético (${syntheticPattern})`}
                </span>
                <span className="text-amber-300 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                  Saída Tuya 3.5: RGB({finalLerpColor[0]}, {finalLerpColor[1]}, {finalLerpColor[2]})
                </span>
              </div>
            </div>

            {/* Mathematical Step Breakdown */}
            <div className="grid grid-cols-3 gap-3 mt-3 text-center font-mono">
              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">1. Média Bruta</span>
                <div
                  className="w-full h-3 rounded mt-1.5 mb-1"
                  style={{ backgroundColor: `rgb(${rawColor.join(',')})` }}
                />
                <span className="text-xs text-neutral-200">
                  {rawColor[0]}, {rawColor[1]}, {rawColor[2]}
                </span>
              </div>

              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">2. Boost Sat {saturationBoost}x</span>
                <div
                  className="w-full h-3 rounded mt-1.5 mb-1"
                  style={{ backgroundColor: `rgb(${boostedColor.join(',')})` }}
                />
                <span className="text-xs text-amber-300">
                  {boostedColor[0]}, {boostedColor[1]}, {boostedColor[2]}
                </span>
              </div>

              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">3. LERP α={smoothFactor}</span>
                <div
                  className="w-full h-3 rounded mt-1.5 mb-1 shadow-sm"
                  style={{ backgroundColor: `rgb(${finalLerpColor.join(',')})` }}
                />
                <span className="text-xs text-emerald-400">
                  {finalLerpColor[0]}, {finalLerpColor[1]}, {finalLerpColor[2]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-5">
            <span className="text-xs font-semibold text-neutral-200 block border-b border-neutral-800 pb-2">
              Configurações do Algoritmo (`config.yaml`)
            </span>

            {/* Source Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Fonte de Captura</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSourceType('synthetic');
                    if (isRunning && streamRef.current) {
                      streamRef.current.getTracks().forEach((t) => t.stop());
                      streamRef.current = null;
                    }
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                    sourceType === 'synthetic'
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Loop de Teste
                </button>
                <button
                  onClick={() => {
                    setSourceType('screen');
                    if (isRunning) startScreenCapture();
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                    sourceType === 'screen'
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Tela do Monitor (Real)
                </button>
              </div>
            </div>

            {sourceType === 'synthetic' && (
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400">Padrão Dinâmico de Teste</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cyberpunk', 'sunset', 'aurora', 'gaming'] as const).map((pat) => (
                    <button
                      key={pat}
                      onClick={() => setSyntheticPattern(pat)}
                      className={`py-1.5 px-2 text-xs font-medium capitalize rounded-md border transition-colors ${
                        syntheticPattern === pat
                          ? 'border-neutral-700 bg-neutral-800 text-white'
                          : 'border-neutral-800/80 bg-neutral-900/50 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {pat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target FPS Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Taxa de Quadros (target_fps)</span>
                <span className="font-mono text-neutral-200">{targetFps} FPS</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                step="5"
                value={targetFps}
                onChange={(e) => setTargetFps(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[11px] text-neutral-500 block">
                20 FPS é a taxa ideal para evitar travamentos de buffer no microcontrolador Tuya.
              </span>
            </div>

            {/* Saturation Boost Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Reforço de Saturação (saturation_boost)</span>
                <span className="font-mono text-neutral-200">{saturationBoost.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.05"
                value={saturationBoost}
                onChange={(e) => setSaturationBoost(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[11px] text-neutral-500 block">
                Compensa a perda de vibração de cores escuras e cinzas de interfaces de desktop.
              </span>
            </div>

            {/* Smooth Factor Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Fator de Amortecimento LERP (smooth_factor)</span>
                <span className="font-mono text-neutral-200">{smoothFactor.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={smoothFactor}
                onChange={(e) => setSmoothFactor(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[11px] text-neutral-500 block">
                Valores menores geram transições mais aveludadas; valores maiores respondem mais rápido.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
