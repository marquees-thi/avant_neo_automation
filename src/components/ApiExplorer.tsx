import React, { useState } from 'react';
import { BulbState, ApiLog } from '../types/bulb';
import { Send, Check, Copy, Terminal, Play, CheckCircle2, Clock } from 'lucide-react';
import { virtualBulb } from '../services/virtualTuyaBulb';

interface ApiExplorerProps {
  state: BulbState;
  apiLogs: ApiLog[];
}

interface EndpointDef {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  defaultPayload?: any;
}

const ENDPOINTS: EndpointDef[] = [
  {
    method: 'GET',
    path: '/api/status',
    description: 'Consulta o estado em tempo real da lâmpada e efeitos ativos',
  },
  {
    method: 'POST',
    path: '/api/power/toggle',
    description: 'Alterna entre ligado e desligado sem perder a cor anterior',
  },
  {
    method: 'POST',
    path: '/api/color/rgb',
    description: 'Aplica cor sólida no espaço RGB (0-255)',
    defaultPayload: { r: 0, g: 255, b: 255 },
  },
  {
    method: 'POST',
    path: '/api/color/white',
    description: 'Aplica iluminação branca com brilho e temperatura CCT (0-100%)',
    defaultPayload: { brightness: 100, color_temp: 50 },
  },
  {
    method: 'POST',
    path: '/api/scene/start',
    description: 'Dispara um efeito dinâmico contínuo em thread dedicada',
    defaultPayload: { scene: 'cyberpunk' },
  },
  {
    method: 'POST',
    path: '/api/scene/stop',
    description: 'Pausa quaisquer efeitos dinâmicos ou Ambilight ativos',
  },
];

export const ApiExplorer: React.FC<ApiExplorerProps> = ({ state, apiLogs }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [payloadInput, setPayloadInput] = useState<string>(
    JSON.stringify(ENDPOINTS[0].defaultPayload || {}, null, 2)
  );
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'powershell' | 'python'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const handleSelectEndpoint = (ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setPayloadInput(JSON.stringify(ep.defaultPayload || {}, null, 2));
    setLastResponse(null);
    setLastStatus(null);
  };

  const handleExecuteRequest = () => {
    let parsedBody: any = undefined;
    if (selectedEndpoint.method === 'POST') {
      try {
        parsedBody = JSON.parse(payloadInput);
      } catch (err) {
        alert('JSON inválido no corpo da requisição');
        return;
      }
    }

    const t0 = performance.now();
    const res = virtualBulb.handleApiRequest(selectedEndpoint.method, selectedEndpoint.path, parsedBody);
    const duration = Math.round(performance.now() - t0);

    setLastStatus(res.status);
    setLastResponse(res.data);
    setLastDuration(Math.max(1, duration));
  };

  const generateCurl = () => {
    const url = `http://127.0.0.1:21420${selectedEndpoint.path}`;
    if (selectedEndpoint.method === 'GET') {
      return `curl -s ${url}`;
    }
    const cleanJson = JSON.stringify(JSON.parse(payloadInput || '{}')).replace(/"/g, '\\"');
    return `curl -s -X POST ${url} -H "Content-Type: application/json" -d "${cleanJson}"`;
  };

  const generatePowerShell = () => {
    const url = `http://127.0.0.1:21420${selectedEndpoint.path}`;
    if (selectedEndpoint.method === 'GET') {
      return `Invoke-RestMethod -Uri "${url}" -Method Get`;
    }
    return `$body = '${payloadInput.replace(/\n/g, '')}'\nInvoke-RestMethod -Uri "${url}" -Method Post -ContentType "application/json" -Body $body`;
  };

  const generatePython = () => {
    const url = `http://127.0.0.1:21420${selectedEndpoint.path}`;
    if (selectedEndpoint.method === 'GET') {
      return `import requests\n\nresp = requests.get("${url}")\nprint(resp.json())`;
    }
    return `import requests\n\npayload = ${payloadInput}\nresp = requests.post("${url}", json=payload)\nprint(resp.json())`;
  };

  const getCurrentSnippet = () => {
    if (activeSnippetTab === 'curl') return generateCurl();
    if (activeSnippetTab === 'powershell') return generatePowerShell();
    return generatePython();
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getCurrentSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Servidor Local HTTP API (`modules/api_server.py`)</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
              FastAPI + Uvicorn :21420
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Endpoints REST desacoplados para automação com Elgato Stream Deck, Home Assistant e scripts Windows
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoints List Column */}
        <div className="lg:col-span-5 space-y-2">
          <span className="text-xs font-semibold text-neutral-300 block mb-1">Endpoints Disponíveis</span>
          {ENDPOINTS.map((ep) => {
            const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
            return (
              <div
                key={`${ep.method}-${ep.path}`}
                onClick={() => handleSelectEndpoint(ep)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-amber-400 bg-neutral-950 shadow-sm'
                    : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="text-xs font-mono font-semibold text-neutral-200">{ep.path}</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-normal">{ep.description}</p>
              </div>
            );
          })}
        </div>

        {/* Request / Response Column */}
        <div className="lg:col-span-7 space-y-4">
          {/* Request Header Bar */}
          <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-amber-400 font-bold">{selectedEndpoint.method}</span>
                <span className="text-neutral-200">http://127.0.0.1:21420{selectedEndpoint.path}</span>
              </div>
              <button
                onClick={handleExecuteRequest}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3 h-3 fill-neutral-950" />
                <span>Testar Endpoint</span>
              </button>
            </div>

            {/* Request Body Editor (if POST) */}
            {selectedEndpoint.method === 'POST' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-neutral-400">Corpo da Requisição (JSON)</label>
                <textarea
                  rows={4}
                  value={payloadInput}
                  onChange={(e) => setPayloadInput(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-200 focus:outline-none focus:border-amber-400/80"
                />
              </div>
            )}

            {/* Response Viewer */}
            <div className="pt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400">Resposta da API</span>
                {lastStatus !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{lastStatus} OK</span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400">{lastDuration}ms</span>
                  </div>
                )}
              </div>

              <pre className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-36">
                {lastResponse
                  ? JSON.stringify(lastResponse, null, 2)
                  : '// Clique em "Testar Endpoint" para despachar comando imediato'}
              </pre>
            </div>
          </div>

          {/* Snippet Generator */}
          <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-0.5 bg-neutral-900 rounded-lg border border-neutral-800">
                <button
                  onClick={() => setActiveSnippetTab('curl')}
                  className={`px-2.5 py-1 text-xs font-mono rounded ${
                    activeSnippetTab === 'curl' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
                  }`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setActiveSnippetTab('powershell')}
                  className={`px-2.5 py-1 text-xs font-mono rounded ${
                    activeSnippetTab === 'powershell' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
                  }`}
                >
                  PowerShell
                </button>
                <button
                  onClick={() => setActiveSnippetTab('python')}
                  className={`px-2.5 py-1 text-xs font-mono rounded ${
                    activeSnippetTab === 'python' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
                  }`}
                >
                  Python (requests)
                </button>
              </div>

              <button
                onClick={handleCopySnippet}
                className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 rounded border border-neutral-800 flex items-center gap-1.5 transition-colors"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap">
              {getCurrentSnippet()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
