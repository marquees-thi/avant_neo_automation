import logging
import threading
import json
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from core.controller import BulbController
from core.scenes import SceneEngine
from modules.screen_sync import ScreenSyncEngine

logger = logging.getLogger("APIServer")

app = FastAPI(title="Avant Neo 50W IoT Engine", version="1.0.0")

class ColorRGBRequest(BaseModel):
    r: int = Field(..., ge=0, le=255)
    g: int = Field(..., ge=0, le=255)
    b: int = Field(..., ge=0, le=255)

class WhiteRequest(BaseModel):
    brightness: int = Field(..., ge=0, le=100)
    color_temp: int = Field(..., ge=0, le=100)

class SceneRequest(BaseModel):
    scene: str

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avant Neo 50W · Cockpit Local</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --card-bg: #141414;
      --border: #262626;
      --text: #ededed;
      --muted: #a1a1a1;
      --accent: #f59e0b;
      --accent-glow: rgba(245, 158, 11, 0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
    .title-group { display: flex; align-items: center; gap: 10px; }
    .brand { font-size: 1.1rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
    .badge { font-size: 0.75rem; background: #222; color: #10b981; border: 1px solid #059669; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
    .btn-power { background: #262626; border: 1px solid #404040; color: #fff; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-power.on { background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; color: #fbbf24; box-shadow: 0 0 10px var(--accent-glow); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    @media(min-width: 768px) { .grid { grid-template-columns: 320px 1fr; } }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .visualizer { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; position: relative; overflow: hidden; border-radius: 10px; background: #0c0c0c; border: 1px solid #1f1f1f; }
    .bulb-glow { width: 120px; height: 120px; border-radius: 50%; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 40px rgba(255,255,255,0.2); border: 2px solid #333; }
    .bulb-base { width: 44px; height: 26px; background: #2a2a2a; border-radius: 0 0 6px 6px; border: 1px solid #3a3a3a; margin-top: -6px; z-index: 2; }
    .bulb-thread { width: 28px; height: 14px; background: #1f1f1f; border-radius: 0 0 4px 4px; border: 1px solid #333; }
    .slider-group { display: flex; flex-direction: column; gap: 6px; }
    .slider-label { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted); }
    .slider-label span:last-child { color: var(--text); font-family: monospace; }
    input[type=range] { width: 100%; height: 6px; border-radius: 4px; background: #262626; outline: none; appearance: none; cursor: pointer; accent-color: var(--accent); }
    .cct-slider { background: linear-gradient(to right, #ff9e22 0%, #ffdf9e 40%, #ffffff 70%, #d4e8ff 100%) !important; }
    .section-title { font-size: 0.85rem; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .btn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
    .btn-preset { background: #1a1a1a; border: 1px solid #2a2a2a; color: #ccc; padding: 8px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 500; cursor: pointer; text-align: center; transition: all 0.15s; }
    .btn-preset:hover { background: #262626; color: #fff; border-color: #404040; }
    .swatches { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .swatch { height: 34px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: transform 0.15s; }
    .swatch:hover { transform: scale(1.08); border-color: #fff; }
    .scenes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .btn-scene { background: #171717; border: 1px solid #262626; color: #ddd; padding: 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; text-align: left; transition: all 0.2s; }
    .btn-scene:hover { border-color: var(--accent); color: #fff; }
    .btn-scene.active { background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #fbbf24; }
    .status-bar { font-family: monospace; font-size: 0.75rem; color: var(--muted); border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-group">
        <span class="brand">Avant Neo 50W</span>
        <span class="badge">Tuya 3.5 :6668</span>
      </div>
      <button id="pwrBtn" class="btn-power" onclick="togglePower()">Carregando...</button>
    </header>

    <div class="grid">
      <!-- Visualizer Card -->
      <div class="card">
        <div class="visualizer">
          <div id="bulbGlow" class="bulb-glow"></div>
          <div class="bulb-base"></div>
          <div class="bulb-thread"></div>
        </div>

        <div class="slider-group">
          <div class="slider-label">
            <span>Brilho</span>
            <span id="txtBrightness">100%</span>
          </div>
          <input type="range" id="rngBrightness" min="1" max="100" value="100" onchange="sendWhite()">
        </div>

        <div class="slider-group">
          <div class="slider-label">
            <span>Temperatura CCT</span>
            <span id="txtTemp">4600K</span>
          </div>
          <input type="range" id="rngTemp" class="cct-slider" min="0" max="100" value="50" onchange="sendWhite()">
        </div>

        <div class="btn-grid">
          <button class="btn-preset" onclick="setPreset(100, 0)">2700K Relax</button>
          <button class="btn-preset" onclick="setPreset(100, 50)">4000K Leitura</button>
          <button class="btn-preset" onclick="setPreset(100, 100)">6500K Foco</button>
          <button class="btn-preset" onclick="setPreset(15, 0)">Noturno</button>
        </div>
      </div>

      <!-- Controls & Scenes Card -->
      <div class="card">
        <div>
          <div class="section-title">Cores RGB Rápidas</div>
          <div class="swatches" style="margin-top: 8px;">
            <div class="swatch" style="background: #00ffff;" onclick="sendRgb(0,255,255)" title="Ciano"></div>
            <div class="swatch" style="background: #ff0096;" onclick="sendRgb(255,0,150)" title="Magenta"></div>
            <div class="swatch" style="background: #ff8c14;" onclick="sendRgb(255,140,20)" title="Âmbar"></div>
            <div class="swatch" style="background: #a855f7;" onclick="sendRgb(168,85,247)" title="Violeta"></div>
            <div class="swatch" style="background: #2563eb;" onclick="sendRgb(37,99,235)" title="Azul"></div>
            <div class="swatch" style="background: #22c55e;" onclick="sendRgb(34,197,94)" title="Verde"></div>
          </div>
        </div>

        <div>
          <div class="section-title">Efeitos & Cenas em Background</div>
          <div class="scenes-grid" style="margin-top: 8px;">
            <button id="btnAmbilight" class="btn-scene" onclick="toggleScene('ambilight')">
              <div>Ambilight (Tela)</div>
              <small style="color:#888; font-weight:normal;">Sincronizar monitor</small>
            </button>
            <button id="btnCircadian" class="btn-scene" onclick="toggleScene('circadian')">
              <div>Ritmo Circadiano</div>
              <small style="color:#888; font-weight:normal;">Ajuste solar 24h</small>
            </button>
            <button id="btnCandle" class="btn-scene" onclick="toggleScene('candle')">
              <div>Vela / Lareira</div>
              <small style="color:#888; font-weight:normal;">Chama orgânica</small>
            </button>
            <button id="btnCyberpunk" class="btn-scene" onclick="toggleScene('cyberpunk')">
              <div>Cyberpunk Pulse</div>
              <small style="color:#888; font-weight:normal;">Ciano e Magenta</small>
            </button>
          </div>
        </div>

        <div style="margin-top: auto;">
          <button class="btn-preset" style="width: 100%; padding: 10px;" onclick="stopScenes()">
            Pausar Todos os Efeitos Dinâmicos
          </button>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div>Modo: <span id="lblMode">-</span> · Brilho: <span id="lblLux">-</span> · Temp: <span id="lblTemp">-</span></div>
      <div>API: 127.0.0.1:21420 · TCP Tuya: OK</div>
    </div>
  </div>

  <script>
    let currentState = null;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        currentState = data;
        updateUI(data);
      } catch (e) {
        console.error("Erro consultando /api/status:", e);
      }
    }

    function updateUI(s) {
      const pwrBtn = document.getElementById('pwrBtn');
      pwrBtn.innerText = s.power ? 'Ligada' : 'Desligada';
      pwrBtn.className = 'btn-power ' + (s.power ? 'on' : '');

      const glow = document.getElementById('bulbGlow');
      if (s.power) {
        glow.style.backgroundColor = 'rgb(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ')';
        glow.style.boxShadow = '0 0 ' + (s.brightness * 0.7) + 'px rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ', 0.8)';
        glow.style.opacity = '1';
      } else {
        glow.style.backgroundColor = '#222';
        glow.style.boxShadow = 'none';
        glow.style.opacity = '0.3';
      }

      document.getElementById('rngBrightness').value = s.brightness;
      document.getElementById('txtBrightness').innerText = s.brightness + '%';

      document.getElementById('rngTemp').value = s.color_temp;
      const kelvin = Math.round(2700 + (s.color_temp / 100) * (6500 - 2700));
      document.getElementById('txtTemp').innerText = kelvin + 'K';

      document.getElementById('lblMode').innerText = s.mode;
      document.getElementById('lblLux').innerText = s.brightness + '%';
      document.getElementById('lblTemp').innerText = s.color_temp + '%';

      // Update scene buttons
      ['ambilight', 'circadian', 'candle', 'cyberpunk'].forEach(sc => {
        const btn = document.getElementById('btn' + sc.charAt(0).toUpperCase() + sc.slice(1));
        if (btn) {
          if (s.active_scene === sc || (sc === 'ambilight' && s.ambilight_running)) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        }
      });
    }

    async function togglePower() {
      await fetch('/api/power/toggle', { method: 'POST' });
      fetchStatus();
    }

    async function sendWhite() {
      const b = parseInt(document.getElementById('rngBrightness').value);
      const t = parseInt(document.getElementById('rngTemp').value);
      await fetch('/api/color/white', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: b, color_temp: t })
      });
      fetchStatus();
    }

    async function setPreset(b, t) {
      document.getElementById('rngBrightness').value = b;
      document.getElementById('rngTemp').value = t;
      await sendWhite();
    }

    async function sendRgb(r, g, b) {
      await fetch('/api/color/rgb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r: r, g: g, b: b })
      });
      fetchStatus();
    }

    async function toggleScene(name) {
      if (currentState && (currentState.active_scene === name || (name === 'ambilight' && currentState.ambilight_running))) {
        await stopScenes();
      } else {
        await fetch('/api/scene/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scene: name })
        });
      }
      fetchStatus();
    }

    async function stopScenes() {
      await fetch('/api/scene/stop', { method: 'POST' });
      fetchStatus();
    }

    fetchStatus();
    setInterval(fetchStatus, 1500);
  </script>
</body>
</html>
"""

async def parse_flexible_json(request: Request) -> dict:
    """
    Parser tolerante a falhas que trata formatos de entrada do Windows CMD,
    aspas escapadas e tipos de conteudo diversos.
    """
    body_bytes = await request.body()
    if not body_bytes:
        return {}
    
    text = body_bytes.decode("utf-8", errors="replace").strip()
    
    # Se o CMD enviou aspas escapadas como {\"r\": 0}, remove a barra invertida antes das aspas
    if '\\"' in text:
        text = text.replace('\\"', '"')

    try:
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Erro ao decodificar JSON bruto: {e}, payload recebido: {text}")
        raise HTTPException(
            status_code=400,
            detail=f"Formato JSON invalido. Certifique-se de usar aspas duplas: {text}"
        )

class APIServer:
    """
    Servidor HTTP REST e Painel Web para a workstation.
    Serve a API em /api/* e o Cockpit Web em /.
    """
    def __init__(
        self,
        host: str,
        port: int,
        controller: BulbController,
        scenes: SceneEngine,
        ambilight: ScreenSyncEngine
    ):
        self.host = host
        self.port = port
        self.controller = controller
        self.scenes = scenes
        self.ambilight = ambilight
        self._server_thread: Optional[threading.Thread] = None

        self._setup_routes()

    def _setup_routes(self):
        @app.get("/", response_class=HTMLResponse)
        def serve_dashboard():
            return HTMLResponse(content=DASHBOARD_HTML)

        @app.get("/dashboard", response_class=HTMLResponse)
        def serve_dashboard_alias():
            return HTMLResponse(content=DASHBOARD_HTML)

        @app.get("/api/status")
        def get_status():
            return {
                "power": self.controller.state.is_on,
                "mode": self.controller.state.mode,
                "brightness": self.controller.state.brightness,
                "color_temp": self.controller.state.color_temp,
                "rgb": list(self.controller.state.rgb),
                "active_scene": self.scenes.current_scene,
                "ambilight_running": self.ambilight.is_running()
            }

        @app.post("/api/power/toggle")
        def toggle_power():
            self._disable_dynamic_modes()
            self.controller.toggle()
            return {"status": "ok", "power": self.controller.state.is_on}

        @app.post("/api/color/rgb")
        async def set_rgb(request: Request):
            data = await parse_flexible_json(request)
            if "r" not in data or "g" not in data or "b" not in data:
                raise HTTPException(status_code=400, detail="Campos r, g, b obrigatorios (0 a 255)")
            
            r = int(data["r"])
            g = int(data["g"])
            b = int(data["b"])
            self._disable_dynamic_modes()
            self.controller.set_rgb(r, g, b)
            return {"status": "ok", "rgb": [r, g, b]}

        @app.post("/api/color/white")
        async def set_white(request: Request):
            data = await parse_flexible_json(request)
            if "brightness" not in data or "color_temp" not in data:
                raise HTTPException(status_code=400, detail="Campos brightness e color_temp obrigatorios (0 a 100)")
            
            brightness = int(data["brightness"])
            color_temp = int(data["color_temp"])
            self._disable_dynamic_modes()
            self.controller.set_white(brightness, color_temp)
            return {"status": "ok", "brightness": brightness, "color_temp": color_temp}

        @app.post("/api/scene/start")
        async def start_scene(request: Request):
            data = await parse_flexible_json(request)
            if "scene" not in data:
                raise HTTPException(status_code=400, detail="Campo 'scene' obrigatorio")
            
            scene_name = str(data["scene"]).lower()
            if scene_name == "ambilight":
                self.scenes.stop_active_scene()
                self.ambilight.start()
                return {"status": "ok", "mode": "ambilight"}
            
            try:
                self.ambilight.stop()
                self.scenes.start_scene(scene_name)
                return {"status": "ok", "scene": scene_name}
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        @app.post("/api/scene/stop")
        def stop_scene():
            self._disable_dynamic_modes()
            return {"status": "ok", "message": "Efeitos e Ambilight pausados."}

    def _disable_dynamic_modes(self):
        if self.ambilight.is_running():
            self.ambilight.stop()
        if self.scenes.current_scene:
            self.scenes.stop_active_scene()

    def start(self):
        server_config = uvicorn.Config(
            app=app,
            host=self.host,
            port=self.port,
            log_level="warning",
            access_log=False
        )
        server = uvicorn.Server(server_config)

        self._server_thread = threading.Thread(
            target=server.run,
            daemon=True,
            name="UvicornWorker"
        )
        self._server_thread.start()
        logger.info(f"API REST operacional e Painel Web disponivel em http://{self.host}:{self.port}")
