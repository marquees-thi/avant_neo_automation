import React from 'react';
import { Terminal, Shield, Rocket, Monitor, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

export const SetupGuide: React.FC = () => {
  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      <div className="pb-4 border-b border-neutral-800">
        <h2 className="text-base font-semibold text-white">Guia de Implantação no Windows 11</h2>
        <p className="text-xs text-neutral-400 mt-1">
          Passo a passo para execução silenciosa em segundo plano, auto-inicialização e integração com a workstation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Python Environment */}
        <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-sm font-semibold text-white">Ambiente e Dependências</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Certifique-se de que o <strong>Python 3.10 ou superior</strong> está instalado com a opção <em>"Add Python to PATH"</em> marcada.
          </p>
          <div className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 space-y-1">
            <div className="text-neutral-500"># Instalar pacotes de baixa latência:</div>
            <div className="text-amber-300">pip install -r requirements.txt</div>
          </div>
        </div>

        {/* Step 2: Background Execution */}
        <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-semibold text-white">Execução Invisível (Zero Janela)</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Para evitar que um terminal preto fique aberto na barra de tarefas, o projeto inclui o inicializador VBScript nativo:
          </p>
          <div className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 space-y-1">
            <div className="text-neutral-500"># Dê duplo-clique no arquivo:</div>
            <div className="text-emerald-400">start_background.vbs</div>
            <div className="text-neutral-500"># Ou via terminal sem console:</div>
            <div className="text-neutral-400">pythonw main.py</div>
          </div>
        </div>

        {/* Step 3: Windows Startup */}
        <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-sm font-semibold text-white">Auto-Inicialização no Login</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Para ligar a bandeja automaticamente sempre que você fizer login no Windows 11, execute o script instalador:
          </p>
          <div className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 space-y-1">
            <div className="text-neutral-500"># Cria atalho em shell:startup:</div>
            <div className="text-amber-300">install_startup.bat</div>
          </div>
        </div>

        {/* Step 4: Firewall & Network */}
        <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-mono font-bold text-xs flex items-center justify-center">
              4
            </span>
            <h3 className="text-sm font-semibold text-white">Regras de Rede & Firewall</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            A lâmpada precisa de comunicação local na mesma sub-rede (2.4 GHz WiFi):
          </p>
          <ul className="text-xs text-neutral-400 list-disc list-inside space-y-1">
            <li><strong className="text-neutral-200">TCP 6668:</strong> Cargas úteis AES da Tuya 3.5</li>
            <li><strong className="text-neutral-200">UDP 6666/6667:</strong> Descoberta local automática (Auto-recovery de IP)</li>
            <li><strong className="text-neutral-200">TCP 21420:</strong> Servidor HTTP REST local</li>
          </ul>
        </div>
      </div>

      {/* Stream Deck / Macro Integration Section */}
      <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Monitor className="w-4 h-4 text-sky-400" />
          <span>Integração com Elgato Stream Deck / Atalhos do Windows</span>
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          No Stream Deck, configure uma ação do tipo <strong>"System: Website"</strong> (GET) ou <strong>"API Request"</strong> com as seguintes URLs:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 text-[10px] block">Toggle Power</span>
            <span className="text-amber-300 font-semibold mt-1 block">POST /api/power/toggle</span>
          </div>
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 text-[10px] block">Modo Leitura</span>
            <span className="text-sky-300 font-semibold mt-1 block">POST /api/color/white</span>
          </div>
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 text-[10px] block">Modo Ambilight</span>
            <span className="text-emerald-300 font-semibold mt-1 block">POST /api/scene/start</span>
          </div>
        </div>
      </div>
    </div>
  );
};
