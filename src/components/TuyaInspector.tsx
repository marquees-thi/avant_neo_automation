import React from 'react';
import { BulbState, TuyaDPS, TuyaPacketLog } from '../types/bulb';
import { Cpu, ShieldCheck, Activity, Trash2, ArrowUpRight, ArrowDownLeft, Network } from 'lucide-react';

interface TuyaInspectorProps {
  state: BulbState;
  dps: TuyaDPS;
  packets: TuyaPacketLog[];
  onClearPackets: () => void;
}

export const TuyaInspector: React.FC<TuyaInspectorProps> = ({
  state,
  dps,
  packets,
  onClearPackets,
}) => {
  return (
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      {/* Top Credentials Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Inspetor Tuya 3.5 & DPS em Tempo Real</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Protocolo 3.5 Validado
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Conexão TCP direta na porta 6668 com criptografia AES e desativação de persistência de socket
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClearPackets}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg border border-neutral-700/60 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Buffer</span>
          </button>
        </div>
      </div>

      {/* Hardware Spec Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">DEVICE_ID</span>
          <span className="text-neutral-200 font-semibold block mt-1 truncate" title="eb5e42ea6ec240ba55xays">
            eb5e42ea6ec240ba55xays
          </span>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">LOCAL_KEY</span>
          <span className="text-amber-400 font-semibold block mt-1 truncate">
            &lt;[(/yO6c[jZAdoWy
          </span>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">ENDEREÇO IP</span>
          <span className="text-emerald-400 font-semibold block mt-1">
            192.168.200.136:6668
          </span>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">SOCKET POOLING</span>
          <span className="text-sky-400 font-semibold block mt-1">
            Persistent=False (Resiliente)
          </span>
        </div>
      </div>

      {/* DPS Table */}
      <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 text-xs">
          <span className="font-semibold text-neutral-200">Mapeamento Oficial de DPS (Data Points Schema)</span>
          <span className="font-mono text-neutral-400">tinytuya.BulbDevice()</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-neutral-400 text-[10px]">DPS 20 (Switch)</div>
            <div className="text-sm font-semibold mt-1">
              <span className={dps['20'] ? 'text-emerald-400' : 'text-neutral-500'}>
                {dps['20'] ? 'TRUE (ON)' : 'FALSE (OFF)'}
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Alimentação geral</div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-neutral-400 text-[10px]">DPS 21 (Mode)</div>
            <div className="text-sm font-semibold text-amber-300 mt-1 uppercase">
              "{dps['21']}"
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">white / colour / scene</div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-neutral-400 text-[10px]">DPS 22 (Bright)</div>
            <div className="text-sm font-semibold text-white mt-1">
              {dps['22']} <span className="text-[10px] text-neutral-400">({state.brightness}%)</span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Range: 10 a 1000</div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-neutral-400 text-[10px]">DPS 23 (Temp CCT)</div>
            <div className="text-sm font-semibold text-sky-300 mt-1">
              {dps['23']} <span className="text-[10px] text-neutral-400">({state.colorTemp}%)</span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">0 (2700K) - 1000 (6500K)</div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="text-neutral-400 text-[10px]">DPS 24 (Color HSV)</div>
            <div className="text-sm font-semibold text-fuchsia-300 mt-1 truncate" title={dps['24']}>
              0x{dps['24']}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Hex: HHHHSSSSVVVV</div>
          </div>
        </div>
      </div>

      {/* Frame Stream Logger */}
      <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-200 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Fluxo de Pacotes TCP (Porta 6668)</span>
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            {packets.length} mensagens no buffer circular
          </span>
        </div>

        <div className="h-44 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
          {packets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-neutral-500">
              Aguardando transmissão de comandos de rede...
            </div>
          ) : (
            packets.map((pkt) => (
              <div
                key={pkt.id}
                className="flex items-center justify-between p-2 rounded bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {pkt.direction === 'TX' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> TX
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3" /> RX
                    </span>
                  )}
                  <span className="text-neutral-400">{pkt.timestamp}</span>
                  <span className="text-neutral-200 font-semibold">{pkt.command}</span>
                  <span className="text-neutral-400 truncate max-w-xs">{pkt.payload}</span>
                </div>

                <div className="text-neutral-400 shrink-0">
                  <span className="text-emerald-400">{pkt.latencyMs}ms</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
