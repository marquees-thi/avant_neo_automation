export interface BulbState {
  isOn: boolean;
  mode: 'white' | 'colour' | 'scene';
  brightness: number; // 0 to 100
  colorTemp: number; // 0 (2700K warm) to 100 (6500K cold)
  rgb: [number, number, number];
  activeScene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight' | null;
  lastUpdated: number;
}

export interface TuyaDPS {
  '20': boolean; // Power switch
  '21': string;  // Mode: "white", "colour", "scene"
  '22': number;  // Brightness: 10 - 1000
  '23': number;  // Color Temperature: 0 - 1000
  '24': string;  // Colour Data: HHHHSSSSVVVV in hex
}

export interface TuyaPacketLog {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  command: string;
  payload: string;
  latencyMs: number;
}

export interface ApiLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  endpoint: string;
  status: number;
  requestBody?: unknown;
  responseBody: unknown;
  durationMs: number;
}
