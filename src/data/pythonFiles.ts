export interface PythonFileItem {
  path: string;
  name: string;
  category: 'core' | 'modules' | 'ui' | 'config' | 'scripts' | 'docs';
  description: string;
  content: string;
}

export const PYTHON_FILES: PythonFileItem[] = [
  {
    path: 'config.yaml',
    name: 'config.yaml',
    category: 'config',
    description: 'Parâmetros de conexão, credenciais Tuya 3.5, rede e atalhos globais',
    content: `# ==============================================================================
# AVANT NEO 50W RGB/CCT - CONFIGURACAO DO CONTROLADOR IOT (WINDOWS 11)
# ==============================================================================

device:
  id: "eb5e42ea6ec240ba55xays"
  local_key: "<[(/yO6c[jZAdoWy"
  ip: "192.168.200.136"
  version: 3.5
  socket_timeout: 2.0

server:
  host: "127.0.0.1"
  port: 21420

screen_sync:
  target_fps: 20
  saturation_boost: 1.35
  smooth_factor: 0.25 # Fator LERP de suavizacao (0.01 a 1.0)

hotkeys:
  toggle_power: "ctrl+alt+l"
  mode_reading: "ctrl+alt+r"
  mode_ambilight: "ctrl+alt+a"
  brightness_up: "ctrl+alt+up"
  brightness_down: "ctrl+alt+down"
`
  },
  {
    path: 'requirements.txt',
    name: 'requirements.txt',
    category: 'config',
    description: 'Dependências Python modernas para Windows 11',
    content: `tinytuya>=1.14.0
pystray>=0.19.5
Pillow>=10.2.0
mss>=9.0.1
fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
pyyaml>=6.0.1
`
  },
  {
    path: 'main.py',
    name: 'main.py',
    category: 'core',
    description: 'Ponto de entrada do sistema: orquestrador multithread e loop Win32',
    content: `import sys
import logging
from core.config import load_config
from core.controller import BulbController
from core.scenes import SceneEngine
from core.hotkeys import GlobalHotkeys
from modules.screen_sync import ScreenSyncEngine
from modules.api_server import APIServer
from ui.tray import SystemTrayApp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("MainApp")

def main():
    logger.info("==================================================")
    logger.info("Avant Neo 50W IoT Automation Suite (Windows 11)")
    logger.info("Protocolo: Tuya 3.5 | Porta: 6668 | API: 21420")
    logger.info("==================================================")

    # 1. Carrega Configuracoes (config.yaml)
    config = load_config()

    # 2. Instancia Drivers Centrais
    controller = BulbController(config)
    scenes = SceneEngine(controller)
    ambilight = ScreenSyncEngine(controller, config.screen_sync)

    # 3. Helpers de Controle de Fluxo
    def stop_active_workers():
        if ambilight.is_running():
            ambilight.stop()
        if scenes.current_scene:
            scenes.stop_active_scene()

    def handle_toggle():
        stop_active_workers()
        controller.toggle()
        tray_app.update_icon_color(controller.state.is_on, controller.state.rgb)
        logger.info(f"Power toggle -> {'Ligada' if controller.state.is_on else 'Desligada'}")

    def handle_reading_mode():
        stop_active_workers()
        # Leitura ideal: 100% de brilho, 4000K (temperatura intermediaria 50%)
        controller.set_white(brightness=100, color_temp=50)
        tray_app.update_icon_color(True, (255, 235, 200))
        logger.info("Modo de leitura ativado: 4000K 100%")

    def handle_start_scene(scene_name: str):
        stop_active_workers()
        scenes.start_scene(scene_name)
        logger.info(f"Cena iniciada: {scene_name}")

    def handle_start_ambilight():
        stop_active_workers()
        ambilight.start()
        logger.info("Ambilight ativado via interface de bandeja")

    def handle_brightness_change(brightness: int, temp: int | None):
        stop_active_workers()
        current_temp = controller.state.color_temp if temp is None else temp
        controller.set_white(brightness=brightness, color_temp=current_temp)
        logger.info(f"Brilho ajustado para {brightness}%, Temp: {current_temp}%")

    def handle_quit():
        logger.info("Encerrando aplicacao e liberando recursos de socket...")
        stop_active_workers()
        hotkeys.stop()
        controller.close()
        tray_app.stop()
        sys.exit(0)

    # 4. Servidor Local HTTP API (FastAPI + Uvicorn)
    api_server = APIServer(
        host=config.server.host,
        port=config.server.port,
        controller=controller,
        scenes=scenes,
        ambilight=ambilight
    )
    api_server.start()

    # 5. Interface de Bandeja (System Tray - pystray)
    tray_app = SystemTrayApp(
        on_toggle_power=handle_toggle,
        on_set_reading=handle_reading_mode,
        on_start_scene=handle_start_scene,
        on_start_ambilight=handle_start_ambilight,
        on_brightness_change=handle_brightness_change,
        on_quit=handle_quit
    )

    # Atualiza icone com estado inicial da lampada
    tray_app.update_icon_color(controller.state.is_on, controller.state.rgb)

    # 6. Atalhos Globais de Teclado (Win32 nativo)
    hotkeys = GlobalHotkeys()
    hotkeys.register(config.hotkeys.get("toggle_power", "ctrl+alt+l"), handle_toggle)
    hotkeys.register(config.hotkeys.get("mode_reading", "ctrl+alt+r"), handle_reading_mode)
    hotkeys.register(config.hotkeys.get("mode_ambilight", "ctrl+alt+a"), handle_start_ambilight)
    hotkeys.register(
        config.hotkeys.get("brightness_up", "ctrl+alt+up"),
        lambda: handle_brightness_change(min(100, controller.state.brightness + 15), None)
    )
    hotkeys.register(
        config.hotkeys.get("brightness_down", "ctrl+alt+down"),
        lambda: handle_brightness_change(max(10, controller.state.brightness - 15), None)
    )
    hotkeys.start()

    logger.info("Sistema operacional. Alocando thread principal para a interface do Windows.")

    try:
        tray_app.run()
    except KeyboardInterrupt:
        handle_quit()

if __name__ == "__main__":
    main()
`
  },
  {
    path: 'core/config.py',
    name: 'config.py',
    category: 'core',
    description: 'Validação Pydantic e persistência automática de novo IP',
    content: `import os
import yaml
from pydantic import BaseModel, Field
from typing import Dict, Any

CONFIG_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config.yaml"))

class DeviceConfig(BaseModel):
    id: str
    local_key: str
    ip: str
    version: float = 3.5
    socket_timeout: float = 2.0

class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 21420

class ScreenSyncConfig(BaseModel):
    target_fps: int = 20
    saturation_boost: float = 1.35
    smooth_factor: float = 0.25

class AppConfig(BaseModel):
    device: DeviceConfig
    server: ServerConfig
    screen_sync: ScreenSyncConfig
    hotkeys: Dict[str, str]

def load_config() -> AppConfig:
    if not os.path.exists(CONFIG_FILE_PATH):
        raise FileNotFoundError(f"Arquivo de configuracao nao encontrado: {CONFIG_FILE_PATH}")
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return AppConfig(**data)

def update_device_ip(new_ip: str) -> None:
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    data["device"]["ip"] = new_ip
    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, default_flow_style=False)
`
  },
  {
    path: 'core/controller.py',
    name: 'controller.py',
    category: 'core',
    description: 'Driver da lâmpada com fila desacoplada e auto-recovery UDP',
    content: `import time
import logging
import queue
import threading
from typing import Optional, Tuple, Dict, Any, Callable
import tinytuya
from core.config import AppConfig, update_device_ip

logger = logging.getLogger("BulbController")

class BulbState:
    def __init__(self):
        self.is_on: bool = False
        self.mode: str = "white"
        self.brightness: int = 100  # 0 a 100%
        self.color_temp: int = 100  # 0 (quente 2700K) a 100 (frio 6500K)
        self.rgb: Tuple[int, int, int] = (255, 255, 255)
        self.last_seen: float = 0.0

class BulbController:
    """
    Driver resiliente para lampada inteligente Avant Neo 50W (protocolo Tuya 3.5).
    Usa fila de comandos com thread dedicada para evitar bloqueios de socket na UI.
    """
    def __init__(self, config: AppConfig):
        self.config = config
        self.state = BulbState()
        self._lock = threading.Lock()
        
        self._cmd_queue: queue.Queue = queue.Queue(maxsize=30)
        self._running = True
        
        self.device = self._create_device_instance(self.config.device.ip)
        
        self._worker_thread = threading.Thread(target=self._command_worker, daemon=True, name="BulbWorker")
        self._worker_thread.start()
        
        self.sync_state()

    def _create_device_instance(self, ip: str) -> tinytuya.BulbDevice:
        dev = tinytuya.BulbDevice(
            dev_id=self.config.device.id,
            address=ip,
            local_key=self.config.device.local_key,
            version=self.config.device.version
        )
        dev.set_socketPersistent(False)
        dev.set_socketTimeout(self.config.device.socket_timeout)
        return dev

    def _command_worker(self):
        while self._running:
            try:
                cmd, args, kwargs = self._cmd_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            success = False
            for attempt in range(2):
                try:
                    cmd(*args, **kwargs)
                    success = True
                    break
                except Exception as e:
                    logger.warning(f"Falha de I/O na tentativa {attempt + 1}: {e}")
                    time.sleep(0.1)

            if not success:
                logger.error("Falha persistente de rede com a lampada. Iniciando auto-recovery UDP...")
                self._handle_network_failure()

            self._cmd_queue.task_done()

    def _dispatch(self, func: Callable, *args, drop_if_congested: bool = False, **kwargs):
        if drop_if_congested and self._cmd_queue.full():
            try:
                self._cmd_queue.get_nowait()
                self._cmd_queue.task_done()
            except queue.Empty:
                pass
        try:
            self._cmd_queue.put_nowait((func, args, kwargs))
        except queue.Full:
            pass

    def _handle_network_failure(self):
        logger.info("Executando varredura UDP por tinytuya.deviceScan()...")
        try:
            devices = tinytuya.deviceScan(verbose=False, maxretry=2)
            if self.config.device.id in devices:
                new_ip = devices[self.config.device.id]["ip"]
                if new_ip != self.config.device.ip:
                    logger.info(f"Dispositivo encontrado em novo IP: {new_ip}")
                    self.config.device.ip = new_ip
                    update_device_ip(new_ip)
                    self.device = self._create_device_instance(new_ip)
        except Exception as e:
            logger.error(f"Erro na recuperacao UDP: {e}")

    def sync_state(self) -> Dict[str, Any]:
        try:
            data = self.device.status()
            if "dps" in data:
                dps = data["dps"]
                with self._lock:
                    self.state.is_on = dps.get("20", self.state.is_on)
                    self.state.mode = dps.get("21", self.state.mode)
                    if "22" in dps:
                        self.state.brightness = int(dps["22"] / 10)
                    if "23" in dps:
                        self.state.color_temp = int(dps["23"] / 10)
                    self.state.last_seen = time.time()
                return dps
        except Exception as e:
            logger.error(f"Erro ao consultar status: {e}")
        return {}

    def turn_on(self):
        self._dispatch(self.device.turn_on)
        with self._lock:
            self.state.is_on = True

    def turn_off(self):
        self._dispatch(self.device.turn_off)
        with self._lock:
            self.state.is_on = False

    def toggle(self):
        if self.state.is_on:
            self.turn_off()
        else:
            self.turn_on()

    def set_white(self, brightness: int, color_temp: int):
        b = max(0, min(100, brightness))
        c = max(0, min(100, color_temp))

        def _action():
            self.device.set_white_percentage(b, c)

        self._dispatch(_action)
        with self._lock:
            self.state.is_on = True
            self.state.mode = "white"
            self.state.brightness = b
            self.state.color_temp = c

    def set_rgb(self, r: int, g: int, b: int, stream_mode: bool = False):
        r_clamped = max(0, min(255, r))
        g_clamped = max(0, min(255, g))
        b_clamped = max(0, min(255, b))

        def _action():
            self.device.set_colour(r_clamped, g_clamped, b_clamped)

        self._dispatch(_action, drop_if_congested=stream_mode)
        with self._lock:
            self.state.is_on = True
            self.state.mode = "colour"
            self.state.rgb = (r_clamped, g_clamped, b_clamped)

    def close(self):
        self._running = False
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.0)
`
  },
  {
    path: 'core/scenes.py',
    name: 'scenes.py',
    category: 'core',
    description: 'Motor de efeitos dinâmicos: Cyberpunk, Vela e Ciclo Circadiano',
    content: `import time
import math
import random
import logging
import threading
from datetime import datetime
from typing import Optional
from core.controller import BulbController

logger = logging.getLogger("SceneEngine")

class SceneEngine:
    def __init__(self, controller: BulbController):
        self.controller = controller
        self._current_scene_name: Optional[str] = None
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @property
    def current_scene(self) -> Optional[str]:
        return self._current_scene_name

    def stop_active_scene(self):
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self._thread.join(timeout=2.0)
        self._current_scene_name = None
        self._stop_event.clear()

    def start_scene(self, scene_name: str):
        self.stop_active_scene()
        target_map = {
            "cyberpunk": self._loop_cyberpunk,
            "candle": self._loop_candle,
            "circadian": self._loop_circadian,
        }
        target = target_map.get(scene_name.lower())
        if not target:
            raise ValueError(f"Cena desconhecida: {scene_name}")

        self._current_scene_name = scene_name.lower()
        self._thread = threading.Thread(target=target, daemon=True, name=f"Scene-{scene_name}")
        self._thread.start()
        logger.info(f"Cena iniciada: {scene_name}")

    def _loop_cyberpunk(self):
        color_a = (0, 255, 255)
        color_b = (255, 0, 150)
        t = 0.0
        while not self._stop_event.is_set():
            sin_val = (math.sin(t) + 1.0) / 2.0
            r = int(color_a[0] + (color_b[0] - color_a[0]) * sin_val)
            g = int(color_a[1] + (color_b[1] - color_a[1]) * sin_val)
            b = int(color_a[2] + (color_b[2] - color_a[2]) * sin_val)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            t += 0.08
            time.sleep(0.05)

    def _loop_candle(self):
        while not self._stop_event.is_set():
            r = 255
            g = random.randint(100, 155)
            b = random.randint(10, 35)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            time.sleep(random.uniform(0.08, 0.25))

    def _loop_circadian(self):
        while not self._stop_event.is_set():
            now = datetime.now()
            hour = now.hour + now.minute / 60.0

            if 6.0 <= hour < 9.0:
                pct = (hour - 6.0) / 3.0
                brightness = int(40 + (60 * pct))
                temp = int(20 + (50 * pct))
            elif 9.0 <= hour < 18.0:
                brightness = 100
                temp = 100
            elif 18.0 <= hour < 22.0:
                pct = (hour - 18.0) / 4.0
                brightness = int(100 - (40 * pct))
                temp = int(100 - (90 * pct))
            else:
                brightness = 25
                temp = 0

            self.controller.set_white(brightness, temp)
            self._stop_event.wait(60.0)
`
  },
  {
    path: 'core/hotkeys.py',
    name: 'hotkeys.py',
    category: 'core',
    description: 'Atalhos globais de teclado usando a API nativa Win32 (RegisterHotKey)',
    content: `import ctypes
from ctypes import wintypes
import threading
import logging
from typing import Dict, Callable, Tuple

logger = logging.getLogger("Win32Hotkeys")

user32 = ctypes.windll.user32

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_MAP = {
    "l": 0x4C,
    "r": 0x52,
    "a": 0x41,
    "c": 0x43,
    "up": 0x26,
    "down": 0x28,
}

class GlobalHotkeys:
    def __init__(self):
        self._handlers: Dict[int, Tuple[int, int, Callable]] = {}
        self._thread: threading.Thread = None
        self._running = False

    def _parse_hotkey(self, hotkey_str: str) -> tuple[int, int]:
        parts = [p.strip().lower() for p in hotkey_str.split("+")]
        modifiers = MOD_NOREPEAT
        vk = 0

        for part in parts:
            if part in ("ctrl", "control"):
                modifiers |= MOD_CONTROL
            elif part == "alt":
                modifiers |= MOD_ALT
            elif part == "shift":
                modifiers |= MOD_SHIFT
            elif part in ("win", "super"):
                modifiers |= MOD_WIN
            elif part in VK_MAP:
                vk = VK_MAP[part]
            else:
                if len(part) == 1:
                    vk = ord(part.upper())

        return modifiers, vk

    def register(self, hotkey_str: str, callback: Callable):
        modifiers, vk = self._parse_hotkey(hotkey_str)
        hotkey_id = len(self._handlers) + 1
        self._handlers[hotkey_id] = (modifiers, vk, callback)

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._msg_loop, daemon=True, name="HotkeyMessageLoop")
        self._thread.start()

    def _msg_loop(self):
        registered_ids = []
        for hid, (mods, vk, cb) in self._handlers.items():
            if user32.RegisterHotKey(None, hid, mods, vk):
                registered_ids.append(hid)
            else:
                logger.error(f"Falha ao registrar hotkey ID {hid} ({vk})")

        msg = wintypes.MSG()
        while self._running:
            res = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
            if res <= 0:
                break
            if msg.message == 0x0312:  # WM_HOTKEY
                hid = msg.wParam
                if hid in self._handlers:
                    _, _, cb = self._handlers[hid]
                    try:
                        cb()
                    except Exception as e:
                        logger.error(f"Erro executando callback do atalho: {e}")

        for hid in registered_ids:
            user32.UnregisterHotKey(None, hid)

    def stop(self):
        self._running = False
        user32.PostQuitMessage(0)
`
  },
  {
    path: 'modules/screen_sync.py',
    name: 'screen_sync.py',
    category: 'modules',
    description: 'Motor Ambilight com mss C-native, reforço de saturação e LERP a 20 FPS',
    content: `import time
import logging
import threading
from typing import Tuple, Optional
import mss
from PIL import Image
from core.controller import BulbController
from core.config import ScreenSyncConfig

logger = logging.getLogger("AmbilightEngine")

class ScreenSyncEngine:
    def __init__(self, controller: BulbController, config: ScreenSyncConfig):
        self.controller = controller
        self.config = config
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._current_rgb: Tuple[float, float, float] = (255.0, 255.0, 255.0)

    def is_running(self) -> bool:
        return self._running

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="AmbilightLoop")
        self._thread.start()
        logger.info("Motor Ambilight iniciado com sucesso.")

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        logger.info("Motor Ambilight parado.")

    def _boost_saturation(self, r: int, g: int, b: int, factor: float) -> Tuple[int, int, int]:
        rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
        max_c = max(rf, gf, bf)
        min_c = min(rf, gf, bf)
        delta = max_c - min_c

        if max_c == 0:
            return (0, 0, 0)

        s = delta / max_c
        v = max_c
        s = min(1.0, s * factor)

        if delta == 0:
            return (int(v * 255), int(v * 255), int(v * 255))

        h = 0.0
        if max_c == rf:
            h = (gf - bf) / delta % 6
        elif max_c == gf:
            h = (bf - rf) / delta + 2
        else:
            h = (rf - gf) / delta + 4
        h *= 60.0

        c = v * s
        x = c * (1 - abs((h / 60.0) % 2 - 1))
        m = v - c

        r1, g1, b1 = 0.0, 0.0, 0.0
        if 0 <= h < 60:
            r1, g1, b1 = c, x, 0
        elif 60 <= h < 120:
            r1, g1, b1 = x, c, 0
        elif 120 <= h < 180:
            r1, g1, b1 = 0, c, x
        elif 180 <= h < 240:
            r1, g1, b1 = 0, x, c
        elif 240 <= h < 300:
            r1, g1, b1 = x, 0, c
        else:
            r1, g1, b1 = c, 0, x

        return (int((r1 + m) * 255), int((g1 + m) * 255), int((b1 + m) * 255))

    def _capture_loop(self):
        target_delay = 1.0 / self.config.target_fps
        lerp_alpha = self.config.smooth_factor

        with mss.mss() as sct:
            monitor = sct.monitors[1]

            while self._running:
                loop_start = time.perf_counter()

                sct_img = sct.grab(monitor)
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                tiny = img.resize((1, 1), Image.Resampling.BILINEAR)
                raw_r, raw_g, raw_b = tiny.getpixel((0, 0))

                target_r, target_g, target_b = self._boost_saturation(
                    raw_r, raw_g, raw_b, self.config.saturation_boost
                )

                cur_r, cur_g, cur_b = self._current_rgb
                final_r = cur_r + (target_r - cur_r) * lerp_alpha
                final_g = cur_g + (target_g - cur_g) * lerp_alpha
                final_b = cur_b + (target_b - cur_b) * lerp_alpha
                self._current_rgb = (final_r, final_g, final_b)

                self.controller.set_rgb(int(final_r), int(final_g), int(final_b), stream_mode=True)

                elapsed = time.perf_counter() - loop_start
                sleep_time = target_delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
`
  },
  {
    path: 'modules/api_server.py',
    name: 'api_server.py',
    category: 'modules',
    description: 'Servidor local FastAPI + Uvicorn na porta 21420',
    content: `import logging
import threading
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
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

class APIServer:
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
        @app.get("/api/status")
        def get_status():
            return {
                "power": self.controller.state.is_on,
                "mode": self.controller.state.mode,
                "brightness": self.controller.state.brightness,
                "color_temp": self.controller.state.color_temp,
                "rgb": self.controller.state.rgb,
                "active_scene": self.scenes.current_scene,
                "ambilight_running": self.ambilight.is_running()
            }

        @app.post("/api/power/toggle")
        def toggle_power():
            self._disable_dynamic_modes()
            self.controller.toggle()
            return {"status": "ok", "power": self.controller.state.is_on}

        @app.post("/api/color/rgb")
        def set_rgb(payload: ColorRGBRequest):
            self._disable_dynamic_modes()
            self.controller.set_rgb(payload.r, payload.g, payload.b)
            return {"status": "ok", "rgb": [payload.r, payload.g, payload.b]}

        @app.post("/api/color/white")
        def set_white(payload: WhiteRequest):
            self._disable_dynamic_modes()
            self.controller.set_white(payload.brightness, payload.color_temp)
            return {"status": "ok", "brightness": payload.brightness, "color_temp": payload.color_temp}

        @app.post("/api/scene/start")
        def start_scene(payload: SceneRequest):
            scene_name = payload.scene.lower()
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
            return {"status": "ok", "message": "Efeitos parados."}

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
        logger.info(f"API REST operacional em http://{self.host}:{self.port}")
`
  },
  {
    path: 'ui/tray.py',
    name: 'tray.py',
    category: 'ui',
    description: 'Interface de bandeja no Windows 11 com ícone Pillow dinâmico',
    content: `import pystray
from PIL import Image, ImageDraw
import logging
from typing import Callable

logger = logging.getLogger("TrayUI")

class SystemTrayApp:
    def __init__(
        self,
        on_toggle_power: Callable,
        on_set_reading: Callable,
        on_start_scene: Callable,
        on_start_ambilight: Callable,
        on_brightness_change: Callable,
        on_quit: Callable
    ):
        self.on_toggle_power = on_toggle_power
        self.on_set_reading = on_set_reading
        self.on_start_scene = on_start_scene
        self.on_start_ambilight = on_start_ambilight
        self.on_brightness_change = on_brightness_change
        self.on_quit = on_quit

        self.icon = pystray.Icon("avant_iot_bulb")
        self.icon.title = "Avant Neo 50W IoT"
        self.icon.icon = self._create_icon((120, 120, 120))
        self.icon.menu = self._build_menu()

    def _create_icon(self, color: tuple) -> Image.Image:
        size = 64
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse((2, 2, size - 2, size - 2), fill=(30, 30, 30, 255))
        draw.ellipse((8, 8, size - 8, size - 8), fill=color)
        return image

    def update_icon_color(self, is_on: bool, rgb: tuple = (255, 255, 255)):
        if not is_on:
            self.icon.icon = self._create_icon((40, 40, 40))
        else:
            self.icon.icon = self._create_icon(rgb)

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem("Ligar / Desligar Lâmpada", lambda: self.on_toggle_power()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Cenas e Efeitos", pystray.Menu(
                pystray.MenuItem("Ambilight (Sincronizar Tela)", lambda: self.on_start_ambilight()),
                pystray.MenuItem("Ritmo Circadiano", lambda: self.on_start_scene("circadian")),
                pystray.MenuItem("Vela (Candlelight)", lambda: self.on_start_scene("candle")),
                pystray.MenuItem("Cyberpunk Neon", lambda: self.on_start_scene("cyberpunk")),
            )),
            pystray.MenuItem("Presets Rápidos", pystray.Menu(
                pystray.MenuItem("Modo Leitura (4000K, 100%)", lambda: self.on_set_reading()),
                pystray.MenuItem("Branco Quente (2700K)", lambda: self.on_brightness_change(100, 0)),
                pystray.MenuItem("Branco Neutro (4500K)", lambda: self.on_brightness_change(100, 50)),
                pystray.MenuItem("Branco Frio (6500K)", lambda: self.on_brightness_change(100, 100)),
            )),
            pystray.MenuItem("Ajuste de Brilho", pystray.Menu(
                pystray.MenuItem("100%", lambda: self.on_brightness_change(100, None)),
                pystray.MenuItem("75%", lambda: self.on_brightness_change(75, None)),
                pystray.MenuItem("50%", lambda: self.on_brightness_change(50, None)),
                pystray.MenuItem("25%", lambda: self.on_brightness_change(25, None)),
            )),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Encerrar Aplicação", lambda: self.on_quit())
        )

    def run(self):
        self.icon.run()

    def stop(self):
        self.icon.stop()
`
  },
  {
    path: 'start_background.vbs',
    name: 'start_background.vbs',
    category: 'scripts',
    description: 'Launcher silencioso VBScript para Windows 11 sem janela de console',
    content: `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strScriptDir

' Executa usando pythonw (Python Windowless) sem foco e sem janela (0)
WshShell.Run "pythonw main.py", 0, False
`
  },
  {
    path: 'install_startup.bat',
    name: 'install_startup.bat',
    category: 'scripts',
    description: 'Configurador automático de inicialização com o Windows 11',
    content: `@echo off
title Configurar Inicializacao Automatica no Windows 11 - Avant Neo 50W IoT
echo ==============================================================================
echo Adicionando Avant Neo 50W IoT Engine a pasta Inicializar (Startup) do Windows
echo ==============================================================================
echo.

set SCRIPT_DIR=%~dp0
set TARGET_VBS=%SCRIPT_DIR%start_background.vbs
set STARTUP_FOLDER=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\\AvantNeoBulb.lnk

powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%');$s.TargetPath='wscript.exe';$s.Arguments='\"%TARGET_VBS%\"';$s.WorkingDirectory='%SCRIPT_DIR%';$s.Description='Avant Neo 50W IoT Background Controller';$s.Save()"

if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Atalho criado com sucesso em:
    echo %SHORTCUT_PATH%
    echo.
    echo O aplicativo agora iniciara automaticamente de forma silenciosa sempre
    echo que voce fizer login no Windows 11!
) else (
    echo [ERRO] Falha ao criar o atalho de inicializacao.
)

echo.
pause
`
  },
  {
    path: 'test_api.bat',
    name: 'test_api.bat',
    category: 'scripts',
    description: 'Script de teste rápido dos endpoints cURL da API REST local',
    content: `@echo off
title Teste Rapido da API REST Local - Avant Neo 50W (Porta 21420)
echo ==============================================================================
echo Testando Endpoints da API Local (http://127.0.0.1:21420)
echo ==============================================================================
echo.

echo 1. Consultando Status Geral:
curl -s http://127.0.0.1:21420/api/status
echo.
echo.

echo 2. Alternando Alimentacao (Toggle Power):
curl -s -X POST http://127.0.0.1:21420/api/power/toggle
echo.
echo.

echo 3. Definindo Cor Cyberpunk Neon (Ciano 0, 255, 255):
curl -s -X POST http://127.0.0.1:21420/api/color/rgb -H "Content-Type: application/json" -d "{\"r\":0,\"g\":255,\"b\":255}"
echo.
echo.

echo 4. Definindo Branco Modo Leitura (Brilho 100%%, Temperatura 50%%):
curl -s -X POST http://127.0.0.1:21420/api/color/white -H "Content-Type: application/json" -d "{\"brightness\":100,\"color_temp\":50}"
echo.
echo.

echo 5. Iniciando Modo Ambilight:
curl -s -X POST http://127.0.0.1:21420/api/scene/start -H "Content-Type: application/json" -d "{\"scene\":\"ambilight\"}"
echo.
echo.

pause
`
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'docs',
    description: 'Manual completo de instalação, atalhos e protocolo Tuya 3.5',
    content: `# Avant Neo 50W RGB/CCT IoT Automation Suite (Windows 11)

Software modular de baixa latência em Python 3.10+ para controle de alta performance da lâmpada inteligente Avant Neo 50W (base Tuya 3.5), executando em segundo plano na bandeja do sistema do Windows 11 com suporte a sincronização de tela Ambilight, efeitos dinâmicos, atalhos globais Win32 e API REST local.

---

## 1. Características Técnicas

- **Driver Desacoplado:** Fila de comandos \`queue.Queue\` em thread dedicada. Chamadas de rede TCP da \`tinytuya\` nunca travam a UI, Ambilight ou atalhos.
- **Protocolo Tuya 3.5 Validado:** Comunicação direta na porta TCP \`6668\` usando \`socketPersistent(False)\` e timeout de 2.0s para evitar travamentos de socket.
- **Ambilight de Baixa Latência:** Captura do display primário via \`mss\` (C-native) com saturação reforçada no espaço HSV e interpolação linear (LERP) a 20 FPS.
- **Atalhos Globais Win32:** Registro via \`ctypes.windll.user32.RegisterHotKey\` (não interfere em jogos em tela cheia nem consome CPU).
- **Auto-Recovery DHCP:** Mecanismo automático via \`tinytuya.deviceScan()\` para recuperar a comunicação caso o roteador atribua novo IP.
- **API REST Local:** Servidor FastAPI + Uvicorn em \`http://127.0.0.1:21420\` para automação via Stream Deck, scripts ou Home Assistant.
- **Bandeja do Windows:** Ícone dinâmico em \`pystray\` com representação fiel da cor e estado da lâmpada.

---

## 2. Requisitos & Instalação

\`\`\`powershell
pip install -r requirements.txt
\`\`\`

## 3. Execução

- **Em Primeiro Plano (Debug):** \`python main.py\`
- **Silencioso em Background:** Dê duplo clique em \`start_background.vbs\` ou rode \`pythonw main.py\`
- **Auto-Inicialização no Windows 11:** Execute \`install_startup.bat\`
`
  }
];
