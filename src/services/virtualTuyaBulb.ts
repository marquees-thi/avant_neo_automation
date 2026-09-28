import { BulbState, TuyaDPS, TuyaPacketLog, ApiLog } from '../types/bulb';

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 1000);
  const v = Math.round(max * 1000);

  return [h, s, v];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const sNorm = s / 1000;
  const vNorm = v / 1000;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

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
}

export function kelvinToRgb(kelvin: number): [number, number, number] {
  // Approximate Kelvin to RGB (2700K - 6500K)
  const temp = kelvin / 100;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (temp <= 66) {
    red = 255;
    green = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
    if (temp <= 19) {
      blue = 0;
    } else {
      blue = Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }
  } else {
    red = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    green = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    blue = 255;
  }

  return [Math.round(red), Math.round(green), Math.round(blue)];
}

export function formatTuyaColorHex(h: number, s: number, v: number): string {
  const hHex = h.toString(16).padStart(4, '0');
  const sHex = s.toString(16).padStart(4, '0');
  const vHex = v.toString(16).padStart(4, '0');
  return `${hHex}${sHex}${vHex}`;
}

export class VirtualTuyaBulb {
  private state: BulbState = {
    isOn: true,
    mode: 'white',
    brightness: 100,
    colorTemp: 50, // 4600K
    rgb: [255, 238, 205],
    activeScene: null,
    lastUpdated: Date.now(),
  };

  private listeners: Array<(state: BulbState) => void> = [];
  private packetListeners: Array<(log: TuyaPacketLog) => void> = [];
  private apiListeners: Array<(log: ApiLog) => void> = [];

  private sceneInterval: number | null = null;
  private sceneTick = 0;

  constructor() {
    this.updateComputedRgb();
  }

  public getState(): BulbState {
    return { ...this.state };
  }

  public getTuyaDPS(): TuyaDPS {
    const [h, s, v] = rgbToHsv(...this.state.rgb);
    return {
      '20': this.state.isOn,
      '21': this.state.mode,
      '22': Math.max(10, Math.round(this.state.brightness * 10)),
      '23': Math.max(0, Math.min(1000, Math.round(this.state.colorTemp * 10))),
      '24': formatTuyaColorHex(h, s, v),
    };
  }

  public subscribe(listener: (state: BulbState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribePackets(listener: (log: TuyaPacketLog) => void): () => void {
    this.packetListeners.push(listener);
    return () => {
      this.packetListeners = this.packetListeners.filter((l) => l !== listener);
    };
  }

  public subscribeApiLogs(listener: (log: ApiLog) => void): () => void {
    this.apiListeners.push(listener);
    return () => {
      this.apiListeners = this.apiListeners.filter((l) => l !== listener);
    };
  }

  private emitState() {
    const snapshot = this.getState();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private logPacket(direction: 'TX' | 'RX', command: string, payload: string, latencyMs = 18) {
    const log: TuyaPacketLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false, fractionalSecondDigits: 3 }),
      direction,
      command,
      payload,
      latencyMs,
    };
    this.packetListeners.forEach((fn) => fn(log));
  }

  public logApiCall(method: 'GET' | 'POST', endpoint: string, status: number, reqBody: unknown, resBody: unknown, durationMs: number) {
    const log: ApiLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      method,
      endpoint,
      status,
      requestBody: reqBody,
      responseBody: resBody,
      durationMs,
    };
    this.apiListeners.forEach((fn) => fn(log));
  }

  private updateComputedRgb() {
    if (this.state.mode === 'white') {
      const kelvin = 2700 + (this.state.colorTemp / 100) * (6500 - 2700);
      const [r, g, b] = kelvinToRgb(kelvin);
      this.state.rgb = [r, g, b];
    }
  }

  public turnOn() {
    this.stopScene();
    this.state.isOn = true;
    this.state.lastUpdated = Date.now();
    this.logPacket('TX', 'CONTROL_3.5 (turn_on)', JSON.stringify({ '20': true }));
    this.emitState();
  }

  public turnOff() {
    this.stopScene();
    this.state.isOn = false;
    this.state.lastUpdated = Date.now();
    this.logPacket('TX', 'CONTROL_3.5 (turn_off)', JSON.stringify({ '20': false }));
    this.emitState();
  }

  public toggle() {
    if (this.state.isOn) {
      this.turnOff();
    } else {
      this.turnOn();
    }
  }

  public setWhite(brightness: number, colorTemp: number) {
    this.stopScene();
    this.state.isOn = true;
    this.state.mode = 'white';
    this.state.brightness = Math.max(0, Math.min(100, brightness));
    this.state.colorTemp = Math.max(0, Math.min(100, colorTemp));
    this.updateComputedRgb();
    this.state.lastUpdated = Date.now();

    this.logPacket(
      'TX',
      'CONTROL_3.5 (set_white_percentage)',
      JSON.stringify({
        '20': true,
        '21': 'white',
        '22': Math.round(this.state.brightness * 10),
        '23': Math.round(this.state.colorTemp * 10),
      })
    );
    this.emitState();
  }

  public setRgb(r: number, g: number, b: number, streamMode = false) {
    if (!streamMode) {
      this.stopScene();
    }
    const rC = Math.max(0, Math.min(255, Math.round(r)));
    const gC = Math.max(0, Math.min(255, Math.round(g)));
    const bC = Math.max(0, Math.min(255, Math.round(b)));

    this.state.isOn = true;
    this.state.mode = 'colour';
    this.state.rgb = [rC, gC, bC];
    this.state.lastUpdated = Date.now();

    const [h, s, v] = rgbToHsv(rC, gC, bC);
    if (!streamMode || Math.random() < 0.2) {
      this.logPacket(
        'TX',
        streamMode ? 'STREAM_3.5 (set_colour)' : 'CONTROL_3.5 (set_colour)',
        JSON.stringify({ '20': true, '21': 'colour', '24': formatTuyaColorHex(h, s, v) }),
        streamMode ? 8 : 19
      );
    }
    this.emitState();
  }

  public setBrightness(brightness: number) {
    this.state.brightness = Math.max(1, Math.min(100, brightness));
    this.state.lastUpdated = Date.now();
    this.logPacket('TX', 'CONTROL_3.5 (set_brightness)', JSON.stringify({ '22': Math.round(this.state.brightness * 10) }));
    this.emitState();
  }

  public stopScene() {
    if (this.sceneInterval !== null) {
      window.clearInterval(this.sceneInterval);
      this.sceneInterval = null;
    }
    this.state.activeScene = null;
    this.emitState();
  }

  public startScene(scene: 'cyberpunk' | 'candle' | 'circadian' | 'ambilight') {
    this.stopScene();
    this.state.isOn = true;
    this.state.activeScene = scene;
    this.sceneTick = 0;

    if (scene === 'cyberpunk') {
      this.state.mode = 'colour';
      const colorA = [0, 255, 255];
      const colorB = [255, 0, 150];

      this.sceneInterval = window.setInterval(() => {
        this.sceneTick += 0.08;
        const sinVal = (Math.sin(this.sceneTick) + 1.0) / 2.0;
        const r = Math.round(colorA[0] + (colorB[0] - colorA[0]) * sinVal);
        const g = Math.round(colorA[1] + (colorB[1] - colorA[1]) * sinVal);
        const b = Math.round(colorA[2] + (colorB[2] - colorA[2]) * sinVal);
        this.setRgb(r, g, b, true);
      }, 50);
    } else if (scene === 'candle') {
      this.state.mode = 'colour';
      this.sceneInterval = window.setInterval(() => {
        const r = 255;
        const g = 110 + Math.floor(Math.random() * 45);
        const b = 10 + Math.floor(Math.random() * 25);
        this.setRgb(r, g, b, true);
      }, 120);
    } else if (scene === 'circadian') {
      const applyCircadian = () => {
        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;
        let brightness = 100;
        let temp = 100;

        if (hour >= 6 && hour < 9) {
          const pct = (hour - 6) / 3;
          brightness = Math.round(40 + 60 * pct);
          temp = Math.round(20 + 50 * pct);
        } else if (hour >= 9 && hour < 18) {
          brightness = 100;
          temp = 100;
        } else if (hour >= 18 && hour < 22) {
          const pct = (hour - 18) / 4;
          brightness = Math.round(100 - 40 * pct);
          temp = Math.round(100 - 90 * pct);
        } else {
          brightness = 25;
          temp = 0;
        }

        this.state.mode = 'white';
        this.state.brightness = brightness;
        this.state.colorTemp = temp;
        this.updateComputedRgb();
        this.emitState();
      };

      applyCircadian();
      this.sceneInterval = window.setInterval(applyCircadian, 5000);
    }

    this.emitState();
  }

  public handleApiRequest(method: string, endpoint: string, body?: any): { status: number; data: any } {
    const t0 = performance.now();
    let resStatus = 200;
    let resData: any = { status: 'ok' };

    if (method === 'GET' && endpoint === '/api/status') {
      resData = {
        power: this.state.isOn,
        mode: this.state.mode,
        brightness: this.state.brightness,
        color_temp: this.state.colorTemp,
        rgb: this.state.rgb,
        active_scene: this.state.activeScene,
        ambilight_running: this.state.activeScene === 'ambilight',
      };
    } else if (method === 'POST' && endpoint === '/api/power/toggle') {
      this.toggle();
      resData = { status: 'ok', power: this.state.isOn };
    } else if (method === 'POST' && endpoint === '/api/color/rgb') {
      if (body && typeof body.r === 'number' && typeof body.g === 'number' && typeof body.b === 'number') {
        this.setRgb(body.r, body.g, body.b);
        resData = { status: 'ok', rgb: [body.r, body.g, body.b] };
      } else {
        resStatus = 400;
        resData = { detail: 'Campos r, g, b obrigatorios (0-255)' };
      }
    } else if (method === 'POST' && endpoint === '/api/color/white') {
      if (body && typeof body.brightness === 'number' && typeof body.color_temp === 'number') {
        this.setWhite(body.brightness, body.color_temp);
        resData = { status: 'ok', brightness: body.brightness, color_temp: body.color_temp };
      } else {
        resStatus = 400;
        resData = { detail: 'Campos brightness e color_temp obrigatorios (0-100)' };
      }
    } else if (method === 'POST' && endpoint === '/api/scene/start') {
      const scene = body?.scene?.toLowerCase();
      if (['cyberpunk', 'candle', 'circadian', 'ambilight'].includes(scene)) {
        this.startScene(scene);
        resData = { status: 'ok', scene };
      } else {
        resStatus = 400;
        resData = { detail: `Cena desconhecida: ${scene}` };
      }
    } else if (method === 'POST' && endpoint === '/api/scene/stop') {
      this.stopScene();
      resData = { status: 'ok', message: 'Efeitos parados.' };
    } else {
      resStatus = 404;
      resData = { detail: 'Endpoint nao encontrado' };
    }

    const duration = Math.round(performance.now() - t0);
    this.logApiCall(method as 'GET' | 'POST', endpoint, resStatus, body, resData, Math.max(2, duration));
    return { status: resStatus, data: resData };
  }
}

// Global Singleton Instance
export const virtualBulb = new VirtualTuyaBulb();
