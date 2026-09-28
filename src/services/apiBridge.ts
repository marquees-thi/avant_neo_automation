export interface BridgeStatus {
  isConnected: boolean;
  isChecking: boolean;
  backendUrl: string;
  latencyMs: number;
  lastChecked: number | null;
  error: string | null;
  isMixedContentRisk: boolean;
}

export interface RemoteBulbStatus {
  power: boolean;
  mode: string;
  brightness: number;
  color_temp: number;
  rgb: [number, number, number];
  active_scene: string | null;
  ambilight_running: boolean;
}

class ApiBridge {
  private backendUrl: string = 'http://127.0.0.1:21420';
  private statusListeners: Array<(status: BridgeStatus) => void> = [];
  private dataListeners: Array<(data: RemoteBulbStatus) => void> = [];

  private isConnected: boolean = false;
  private isChecking: boolean = false;
  private latencyMs: number = 0;
  private lastChecked: number | null = null;
  private error: string | null = null;
  private isMixedContentRisk: boolean = false;

  // Stream throttle for Ambilight to protect the Wi-Fi Tuya socket
  private isStreamingInFlight: boolean = false;
  private nextStreamPayload: { r: number; g: number; b: number } | null = null;
  private lastStreamSentTime: number = 0;
  private minStreamIntervalMs: number = 190; // ~5.2 FPS max to prevent bulb Wi-Fi stack overflow

  constructor() {
    if (typeof window !== 'undefined') {
      // Se a página for aberta direto na porta 21420 do Python, usa a mesma origem
      if (window.location.port === '21420') {
        this.backendUrl = window.location.origin;
      } else {
        const saved = localStorage.getItem('avant_backend_url');
        if (saved) {
          this.backendUrl = saved.trim().replace(/\/+$/, '');
        }
      }

      this.isMixedContentRisk = window.location.protocol === 'https:' && this.backendUrl.startsWith('http:');
    }

    // Checagem inicial e polling de sincronização em tempo real (1 segundo)
    this.checkConnection();
    setInterval(() => this.pollStatus(), 1000);
  }

  public getStatus(): BridgeStatus {
    return {
      isConnected: this.isConnected,
      isChecking: this.isChecking,
      backendUrl: this.backendUrl,
      latencyMs: this.latencyMs,
      lastChecked: this.lastChecked,
      error: this.error,
      isMixedContentRisk: this.isMixedContentRisk,
    };
  }

  public setBackendUrl(url: string) {
    this.backendUrl = url.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('avant_backend_url', this.backendUrl);
      this.isMixedContentRisk = window.location.protocol === 'https:' && this.backendUrl.startsWith('http:');
    }
    this.checkConnection();
  }

  public subscribeStatus(listener: (status: BridgeStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public subscribeData(listener: (data: RemoteBulbStatus) => void): () => void {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter((l) => l !== listener);
    };
  }

  private emitStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((fn) => fn(s));
  }

  private emitData(data: RemoteBulbStatus) {
    this.dataListeners.forEach((fn) => fn(data));
  }

  public async checkConnection(): Promise<boolean> {
    this.isChecking = true;
    this.emitStatus();

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.backendUrl}/api/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data: RemoteBulbStatus = await res.json();
        this.latencyMs = Math.round(performance.now() - t0);
        this.isConnected = true;
        this.error = null;
        this.lastChecked = Date.now();
        this.isChecking = false;
        this.emitStatus();
        this.emitData(data);
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      this.isConnected = false;
      this.isChecking = false;
      this.error = err.name === 'AbortError' ? 'Timeout de conexão (2s)' : (err.message || 'Servidor local offline');
      this.emitStatus();
      return false;
    }
  }

  private async pollStatus() {
    if (this.isChecking) return;
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const res = await fetch(`${this.backendUrl}/api/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data: RemoteBulbStatus = await res.json();
        this.latencyMs = Math.round(performance.now() - t0);
        if (!this.isConnected) {
          this.isConnected = true;
          this.error = null;
        }
        this.lastChecked = Date.now();
        this.emitStatus();
        this.emitData(data);
      } else {
        if (this.isConnected) {
          this.isConnected = false;
          this.emitStatus();
        }
      }
    } catch {
      if (this.isConnected) {
        this.isConnected = false;
        this.emitStatus();
      }
    }
  }

  // --- Real Device Actions (HTTP Commands to http://127.0.0.1:21420) ---

  public async togglePower(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/power/toggle`, {
        method: 'POST',
      });
      if (res.ok) {
        this.pollStatus();
        return true;
      }
    } catch (err) {
      console.warn('Erro ao alternar energia no backend:', err);
    }
    return false;
  }

  public async setWhite(brightness: number, colorTemp: number): Promise<boolean> {
    try {
      const b = Math.max(1, Math.min(100, Math.round(brightness)));
      const c = Math.max(0, Math.min(100, Math.round(colorTemp)));
      const res = await fetch(`${this.backendUrl}/api/color/white?brightness=${b}&color_temp=${c}`, {
        method: 'POST',
      });
      if (res.ok) {
        this.pollStatus();
        return true;
      }
    } catch (err) {
      console.warn('Erro ao definir branco no backend:', err);
    }
    return false;
  }

  public async setRgb(r: number, g: number, b: number, isStream = false): Promise<boolean> {
    const rC = Math.max(0, Math.min(255, Math.round(r)));
    const gC = Math.max(0, Math.min(255, Math.round(g)));
    const bC = Math.max(0, Math.min(255, Math.round(b)));

    if (isStream) {
      // Throttle seguro para stream (Ambilight): nunca sobrecarrega o buffer da lâmpada
      this.nextStreamPayload = { r: rC, g: gC, b: bC };
      const now = performance.now();

      if (!this.isStreamingInFlight && now - this.lastStreamSentTime >= this.minStreamIntervalMs) {
        this.dispatchNextStreamFrame();
      }
      return true;
    }

    try {
      const res = await fetch(`${this.backendUrl}/api/color/rgb?r=${rC}&g=${gC}&b=${bC}&stream=false`, {
        method: 'POST',
      });
      if (res.ok) {
        this.pollStatus();
        return true;
      }
    } catch (err) {
      console.warn('Erro ao enviar cor RGB:', err);
    }
    return false;
  }

  private async dispatchNextStreamFrame() {
    if (!this.nextStreamPayload || this.isStreamingInFlight) return;

    const payload = this.nextStreamPayload;
    this.nextStreamPayload = null;
    this.isStreamingInFlight = true;
    this.lastStreamSentTime = performance.now();

    try {
      await fetch(
        `${this.backendUrl}/api/color/rgb?r=${payload.r}&g=${payload.g}&b=${payload.b}&stream=true`,
        { method: 'POST' }
      );
    } catch {
      // Falhas transitórias em stream são descartadas
    } finally {
      this.isStreamingInFlight = false;
      if (this.nextStreamPayload) {
        const elapsed = performance.now() - this.lastStreamSentTime;
        const waitMs = Math.max(10, this.minStreamIntervalMs - elapsed);
        setTimeout(() => this.dispatchNextStreamFrame(), waitMs);
      }
    }
  }

  public async startScene(sceneName: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/scene/start?scene=${encodeURIComponent(sceneName)}`, {
        method: 'POST',
      });
      if (res.ok) {
        this.pollStatus();
        return true;
      }
    } catch (err) {
      console.warn('Erro ao iniciar cena:', err);
    }
    return false;
  }

  public async stopScene(restoreWhite = true): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/scene/stop?restore=${restoreWhite}`, {
        method: 'POST',
      });
      if (res.ok) {
        this.pollStatus();
        return true;
      }
    } catch (err) {
      console.warn('Erro ao pausar cena:', err);
    }
    return false;
  }

  public async restoreNormalWhite(): Promise<boolean> {
    return this.stopScene(true);
  }
}

export const apiBridge = new ApiBridge();
