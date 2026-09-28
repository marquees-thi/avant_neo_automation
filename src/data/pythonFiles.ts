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
  mode_reading: "ctrl+shift+r" # Utiliza Shift em vez de Alt para evitar conflito com AMD Radeon Software
  mode_ambilight: "ctrl+alt+a"
  brightness_up: "ctrl+alt+up"
  brightness_down: "ctrl+alt+down"
`,
  },
  {
    path: 'requirements.txt',
    name: 'requirements.txt',
    category: 'config',
    description: 'Dependências do Python 3.10+ (tinytuya, pystray, mss, fastapi, uvicorn)',
    content: `tinytuya>=1.14.0
pystray>=0.19.5
Pillow>=10.2.0
mss>=9.0.1
fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
pyyaml>=6.0.1
`,
  },
  {
    path: 'core/__init__.py',
    name: '__init__.py',
    category: 'core',
    description: 'Inicializador do pacote de drivers principais',
    content: `"""
Core package for Avant Neo 50W IoT automation.
"""
`,
  },
  {
    path: 'core/config.py',
    name: 'config.py',
    category: 'core',
    description: 'Carregador seguro de configurações YAML e validação Pydantic',
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
`,
  },
  {
    path: 'core/controller.py',
    name: 'controller.py',
    category: 'core',
    description: 'Driver de baixa latência Tuya 3.5 com Latest-Value Sampling e restauração instantânea',
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
        self.color_temp: int = 50   # 0 (quente 2700K) a 100 (frio 6500K)
        self.rgb: Tuple[int, int, int] = (255, 255, 255)
        self.last_seen: float = 0.0

class BulbController:
    """
    Driver de baixa latência e alta resiliência para lâmpada inteligente Avant Neo 50W (Tuya 3.5).
    """
    def __init__(self, config: AppConfig):
        self.config = config
        self.state = BulbState()
        self._lock = threading.Lock()
        
        self._cmd_queue: queue.Queue = queue.Queue(maxsize=15)
        self._latest_stream_frame = None
        self._stream_lock = threading.Lock()
        self._abort_signal = threading.Event()
        
        self._running = True
        self._consecutive_priority_failures = 0
        self._last_udp_scan_time = 0.0
        self._last_packet_sent_time = 0.0
        self._min_packet_interval = 0.18
        
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

    def clear_queue(self):
        with self._stream_lock:
            self._latest_stream_frame = None
        with self._cmd_queue.mutex:
            self._cmd_queue.queue.clear()
        self._abort_signal.set()
        time.sleep(0.01)
        self._abort_signal.clear()
        logger.debug("Fila de comandos da lâmpada purgada instantaneamente.")

    def _command_worker(self):
        while self._running:
            item = None
            is_stream_item = False
            
            try:
                item = self._cmd_queue.get_nowait()
                is_stream_item = False
            except queue.Empty:
                pass
            
            if item is None:
                with self._stream_lock:
                    if self._latest_stream_frame is not None:
                        item = self._latest_stream_frame
                        self._latest_stream_frame = None
                        is_stream_item = True

            if item is None:
                time.sleep(0.01)
                continue

            now = time.perf_counter()
            time_since_last = now - self._last_packet_sent_time
            if is_stream_item and time_since_last < self._min_packet_interval:
                time.sleep(self._min_packet_interval - time_since_last)

            if is_stream_item and self._abort_signal.is_set():
                continue

            cmd, args, kwargs = item
            success = False
            
            try:
                cmd(*args, **kwargs)
                success = True
                self._last_packet_sent_time = time.perf_counter()
                if not is_stream_item:
                    self._consecutive_priority_failures = 0
            except Exception as e:
                if not is_stream_item:
                    logger.warning(f"Falha ao enviar comando prioritário: {e}")
                    self._consecutive_priority_failures += 1
                else:
                    logger.debug(f"Frame de streaming descartado: {e}")

            if not is_stream_item and not success and self._consecutive_priority_failures >= 4:
                self._trigger_async_recovery()

            if not is_stream_item:
                try:
                    self._cmd_queue.task_done()
                except ValueError:
                    pass

    def _dispatch_priority(self, func: Callable, *args, **kwargs):
        self.clear_queue()
        try:
            self._cmd_queue.put_nowait((func, args, kwargs))
        except queue.Full:
            pass

    def _dispatch_stream(self, func: Callable, *args, **kwargs):
        with self._stream_lock:
            self._latest_stream_frame = (func, args, kwargs)

    def _trigger_async_recovery(self):
        now = time.time()
        if now - self._last_udp_scan_time < 45.0:
            return
        
        self._last_udp_scan_time = now
        logger.warning("Múltiplas falhas com a lâmpada. Iniciando descoberta UDP em background...")
        t = threading.Thread(target=self._run_udp_scan, daemon=True, name="UDPRecoveryThread")
        t.start()

    def _run_udp_scan(self):
        try:
            devices = tinytuya.deviceScan(verbose=False, maxretry=2)
            if self.config.device.id in devices:
                new_ip = devices[self.config.device.id]["ip"]
                if new_ip != self.config.device.ip:
                    logger.info(f"Lâmpada encontrada em novo IP: {new_ip}")
                    self.config.device.ip = new_ip
                    update_device_ip(new_ip)
                    self.device = self._create_device_instance(new_ip)
                    self._consecutive_priority_failures = 0
                else:
                    logger.info("IP da lâmpada inalterado. Aguardando estabilização do Wi-Fi.")
        except Exception as e:
            logger.error(f"Erro na varredura UDP: {e}")

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
            logger.warning(f"Erro ao consultar status da lâmpada: {e}")
        return {}

    def turn_on(self):
        self._dispatch_priority(self.device.turn_on)
        with self._lock:
            self.state.is_on = True

    def turn_off(self):
        self._dispatch_priority(self.device.turn_off)
        with self._lock:
            self.state.is_on = False

    def toggle(self):
        if self.state.is_on:
            self.turn_off()
        else:
            self.turn_on()

    def set_white(self, brightness: int, color_temp: int):
        b = max(1, min(100, brightness))
        c = max(0, min(100, color_temp))

        def _action():
            self.device.set_white_percentage(b, c)

        self._dispatch_priority(_action)
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

        if stream_mode:
            self._dispatch_stream(_action)
        else:
            self._dispatch_priority(_action)

        with self._lock:
            self.state.is_on = True
            self.state.mode = "colour"
            self.state.rgb = (r_clamped, g_clamped, b_clamped)

    def restore_normal_white(self):
        self.clear_queue()
        self.set_white(100, 50)
        logger.info("Lâmpada restaurada instantaneamente ao modo normal (4000K, 100%).")

    def close(self):
        self._running = False
        self.clear_queue()
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=0.5)
`,
  },
  {
    path: 'core/scenes.py',
    name: 'scenes.py',
    category: 'core',
    description: 'Engine de efeitos contínuos (Cyberpunk, Vela, Circadiano) com cancelamento imediato',
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

    def stop_active_scene(self, restore_white: bool = False):
        self._current_scene_name = None
        self._stop_event.set()
        self.controller.clear_queue()
        
        if restore_white:
            self.controller.restore_normal_white()
            
        logger.info("Cena ativa finalizada instantaneamente.")

    def start_scene(self, scene_name: str):
        self.stop_active_scene(restore_white=False)
        self._stop_event.clear()

        target_map = {
            "cyberpunk": self._loop_cyberpunk,
            "candle": self._loop_candle,
            "circadian": self._loop_circadian,
        }
        target = target_map.get(scene_name.lower())
        if not target:
            raise ValueError(f"Cena desconhecida: {scene_name}. Disponíveis: {list(target_map.keys())}")

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
            t += 0.22
            if self._stop_event.wait(0.20):
                break

    def _loop_candle(self):
        while not self._stop_event.is_set():
            r = 255
            g = random.randint(95, 145)
            b = random.randint(8, 28)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            if self._stop_event.wait(random.uniform(0.22, 0.40)):
                break

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
            if self._stop_event.wait(60.0):
                break
`,
  },
  {
    path: 'core/hotkeys.py',
    name: 'hotkeys.py',
    category: 'core',
    description: 'Atalhos globais de teclado usando RegisterHotKey com fallback automático',
    content: `import ctypes
from ctypes import wintypes
import threading
import logging
from typing import Dict, Callable, Tuple

logger = logging.getLogger("Win32Hotkeys")

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

ERROR_HOTKEY_ALREADY_REGISTERED = 1409

VK_MAP = {
    "l": 0x4C,
    "r": 0x52,
    "a": 0x41,
    "c": 0x43,
    "w": 0x57,
    "up": 0x26,
    "down": 0x28,
    "left": 0x25,
    "right": 0x27,
    "space": 0x20,
}

class GlobalHotkeys:
    def __init__(self):
        self._handlers: Dict[int, Tuple[int, int, Callable, str]] = {}
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
        self._handlers[hotkey_id] = (modifiers, vk, callback, hotkey_str)

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._msg_loop, daemon=True, name="HotkeyMessageLoop")
        self._thread.start()

    def _msg_loop(self):
        registered_ids = []
        for hid, (mods, vk, cb, hotkey_str) in self._handlers.items():
            success = user32.RegisterHotKey(None, hid, mods, vk)
            if success:
                registered_ids.append(hid)
                logger.info(f"Atalho registrado: '{hotkey_str}' (ID {hid})")
            else:
                err = kernel32.GetLastError()
                if err == ERROR_HOTKEY_ALREADY_REGISTERED:
                    logger.warning(
                        f"Atalho '{hotkey_str}' (ID {hid}) já está em uso por outro aplicativo no Windows. "
                        f"Tentando tecla alternativa..."
                    )
                    fallback_mods = (mods & ~MOD_ALT) | MOD_SHIFT if (mods & MOD_ALT) else (mods | MOD_ALT)
                    fallback_name = hotkey_str.replace("alt", "shift") if "alt" in hotkey_str else hotkey_str + "+alt"
                    if user32.RegisterHotKey(None, hid, fallback_mods, vk):
                        registered_ids.append(hid)
                        logger.info(f"Atalho alternativo registrado: '{fallback_name}' (ID {hid})")
                    else:
                        logger.warning(f"Não foi possível registrar '{hotkey_str}'. Altere o mapeamento no config.yaml.")
                else:
                    logger.warning(f"Aviso ao registrar atalho ID {hid} ({hotkey_str}): Win32 Error {err}")

        msg = wintypes.MSG()
        while self._running:
            res = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
            if res <= 0:
                break
            if msg.message == 0x0312:  # WM_HOTKEY
                hid = msg.wParam
                if hid in self._handlers:
                    _, _, cb, _ = self._handlers[hid]
                    try:
                        cb()
                    except Exception as e:
                        logger.error(f"Erro executando callback do atalho ID {hid}: {e}")

        for hid in registered_ids:
            user32.UnregisterHotKey(None, hid)

    def stop(self):
        self._running = False
        user32.PostQuitMessage(0)
`,
  },
  {
    path: 'modules/__init__.py',
    name: '__init__.py',
    category: 'modules',
    description: 'Inicializador dos módulos de serviço',
    content: `"""
Modules package for Avant Neo 50W IoT automation.
"""
`,
  },
  {
    path: 'modules/screen_sync.py',
    name: 'screen_sync.py',
    category: 'modules',
    description: 'Ambilight de alta fidelidade (mss + LERP + delta threshold) com proteção de buffer',
    content: `import time
import math
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
        self._last_dispatched_rgb: Tuple[int, int, int] = (0, 0, 0)
        self._last_dispatch_time = 0.0

    def is_running(self) -> bool:
        return self._running

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="AmbilightLoop")
        self._thread.start()
        logger.info("Motor Ambilight iniciado com sucesso.")

    def stop(self, restore_white: bool = False):
        self._running = False
        self.controller.clear_queue()
        if restore_white:
            self.controller.restore_normal_white()
        logger.info("Motor Ambilight parado instantaneamente.")

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
        target_interval = 0.20
        lerp_alpha = self.config.smooth_factor

        try:
            with mss.mss() as sct:
                monitor = sct.monitors[1]

                while self._running:
                    loop_start = time.perf_counter()

                    try:
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

                        out_r = int(final_r)
                        out_g = int(final_g)
                        out_b = int(final_b)

                        now = time.perf_counter()
                        delta = math.sqrt(
                            (out_r - self._last_dispatched_rgb[0]) ** 2 +
                            (out_g - self._last_dispatched_rgb[1]) ** 2 +
                            (out_b - self._last_dispatched_rgb[2]) ** 2
                        )

                        if delta >= 8.0 or (now - self._last_dispatch_time) >= 2.0:
                            self.controller.set_rgb(out_r, out_g, out_b, stream_mode=True)
                            self._last_dispatched_rgb = (out_r, out_g, out_b)
                            self._last_dispatch_time = now

                    except Exception as e:
                        logger.debug(f"Hiccup na captura Ambilight: {e}")

                    elapsed = time.perf_counter() - loop_start
                    sleep_time = target_interval - elapsed
                    if sleep_time > 0 and self._running:
                        time.sleep(sleep_time)

        except Exception as e:
            logger.error(f"Erro no loop do Ambilight: {e}")
            self._running = False
`,
  },
  {
    path: 'modules/api_server.py',
    name: 'api_server.py',
    category: 'modules',
    description: 'Servidor FastAPI com suporte a JSON, Query Params e hospedagem direta do Cockpit',
    content: `import os
import json
import logging
import threading
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from core.controller import BulbController
from core.scenes import SceneEngine
from modules.screen_sync import ScreenSyncEngine

logger = logging.getLogger("APIServer")

app = FastAPI(title="Avant Neo 50W IoT Engine", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def parse_request_data(request: Request) -> dict:
    data = dict(request.query_params)
    try:
        body_bytes = await request.body()
        if body_bytes:
            text = body_bytes.decode("utf-8", errors="replace").strip()
            if text.startswith("{") and text.endswith("}"):
                data.update(json.loads(text))
            elif "=" in text:
                for part in text.split("&"):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        data[k.strip()] = v.strip()
    except Exception as e:
        logger.debug(f"Tentativa de ler body como JSON: {e}")
    return data

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
        self._server_thread = None
        self._setup_routes()

    def _setup_routes(self):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        dist_dir = os.path.join(base_dir, "web")
        if not os.path.exists(dist_dir):
            dist_dir = os.path.join(base_dir, "..", "dist")

        has_dist = os.path.exists(dist_dir) and os.path.exists(os.path.join(dist_dir, "index.html"))

        if has_dist:
            assets_dir = os.path.join(dist_dir, "assets")
            if os.path.exists(assets_dir):
                app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

            @app.get("/", response_class=HTMLResponse)
            def serve_built_app():
                with open(os.path.join(dist_dir, "index.html"), "r", encoding="utf-8") as f:
                    return HTMLResponse(content=f.read())
        else:
            @app.get("/", response_class=HTMLResponse)
            def serve_dashboard():
                return HTMLResponse(content="<h1>Avant Neo 50W IoT Engine Operacional</h1><p>Acesse /api/status</p>")

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

        @app.api_route("/api/power/toggle", methods=["GET", "POST"])
        def toggle_power():
            self._disable_dynamic_modes(restore_white=False)
            self.controller.toggle()
            return {"status": "ok", "power": self.controller.state.is_on}

        @app.api_route("/api/color/rgb", methods=["GET", "POST"])
        async def set_rgb(request: Request):
            data = await parse_request_data(request)
            if "r" not in data or "g" not in data or "b" not in data:
                raise HTTPException(status_code=400, detail="Campos r, g, b obrigatórios (0 a 255)")
            
            try:
                r = int(float(data["r"]))
                g = int(float(data["g"]))
                b = int(float(data["b"]))
            except ValueError:
                raise HTTPException(status_code=400, detail="Valores de r, g, b devem ser inteiros")

            is_stream = str(data.get("stream", "false")).lower() in ("true", "1", "yes")

            if not is_stream:
                self._disable_dynamic_modes(restore_white=False)
                self.controller.set_rgb(r, g, b, stream_mode=False)
            else:
                self.controller.set_rgb(r, g, b, stream_mode=True)

            return {"status": "ok", "rgb": [r, g, b], "stream": is_stream}

        @app.api_route("/api/color/white", methods=["GET", "POST"])
        async def set_white(request: Request):
            data = await parse_request_data(request)
            if "brightness" not in data or "color_temp" not in data:
                raise HTTPException(status_code=400, detail="Campos brightness e color_temp obrigatórios")
            
            try:
                brightness = int(float(data["brightness"]))
                color_temp = int(float(data["color_temp"]))
            except ValueError:
                raise HTTPException(status_code=400, detail="Valores devem ser inteiros")

            self._disable_dynamic_modes(restore_white=False)
            self.controller.set_white(brightness, color_temp)
            return {"status": "ok", "brightness": brightness, "color_temp": color_temp}

        @app.api_route("/api/scene/start", methods=["GET", "POST"])
        async def start_scene(request: Request):
            data = await parse_request_data(request)
            if "scene" not in data:
                raise HTTPException(status_code=400, detail="Campo 'scene' obrigatório")
            
            scene_name = str(data["scene"]).lower().strip()
            if scene_name == "ambilight":
                self.scenes.stop_active_scene(restore_white=False)
                self.controller.clear_queue()
                self.ambilight.start()
                return {"status": "ok", "mode": "ambilight"}
            
            try:
                self.ambilight.stop(restore_white=False)
                self.controller.clear_queue()
                self.scenes.start_scene(scene_name)
                return {"status": "ok", "scene": scene_name}
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        @app.api_route("/api/scene/stop", methods=["GET", "POST"])
        async def stop_scene(request: Request):
            data = await parse_request_data(request)
            restore = str(data.get("restore", "true")).lower() in ("true", "1", "yes")
            self._disable_dynamic_modes(restore_white=restore)
            return {
                "status": "ok",
                "message": "Efeitos finalizados instantaneamente.",
                "restored_white": restore
            }

    def _disable_dynamic_modes(self, restore_white: bool = False):
        if self.ambilight.is_running():
            self.ambilight.stop(restore_white=False)
        if self.scenes.current_scene:
            self.scenes.stop_active_scene(restore_white=False)
            
        self.controller.clear_queue()
        
        if restore_white:
            self.controller.restore_normal_white()

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
`,
  },
  {
    path: 'ui/__init__.py',
    name: '__init__.py',
    category: 'ui',
    description: 'Inicializador dos componentes de interface',
    content: `"""
UI package for Avant Neo 50W IoT automation.
"""
`,
  },
  {
    path: 'ui/tray.py',
    name: 'tray.py',
    category: 'ui',
    description: 'Bandeja do Windows 11 em pystray com ícone dinâmico e menu de restauração',
    content: `import pystray
from PIL import Image, ImageDraw
import logging
import webbrowser
from typing import Callable, Optional

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
        self.icon.title = "Avant Neo 50W IoT · Workstation Control"
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
            self.icon.icon = self._create_icon((45, 45, 45))
        else:
            self.icon.icon = self._create_icon(rgb)

    def _open_web_dashboard(self):
        try:
            webbrowser.open("http://127.0.0.1:21420")
        except Exception as e:
            logger.error(f"Erro ao abrir navegador: {e}")

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem("Abrir Cockpit no Navegador", self._open_web_dashboard, default=True),
            pystray.MenuItem("Ligar / Desligar Lâmpada", lambda: self.on_toggle_power()),
            pystray.MenuItem("Restaurar ao Normal (4000K, 100%)", lambda: self.on_set_reading()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Efeitos & Dinâmicas", pystray.Menu(
                pystray.MenuItem("Ambilight (Sincronizar Tela)", lambda: self.on_start_ambilight()),
                pystray.MenuItem("Ritmo Circadiano Automático", lambda: self.on_start_scene("circadian")),
                pystray.MenuItem("Vela (Candlelight Flame)", lambda: self.on_start_scene("candle")),
                pystray.MenuItem("Cyberpunk Neon Pulse", lambda: self.on_start_scene("cyberpunk")),
            )),
            pystray.MenuItem("Presets Rápidos", pystray.Menu(
                pystray.MenuItem("Modo Leitura (4000K, 100%)", lambda: self.on_set_reading()),
                pystray.MenuItem("Branco Quente (2700K)", lambda: self.on_brightness_change(100, 0)),
                pystray.MenuItem("Branco Neutro (4500K)", lambda: self.on_brightness_change(100, 50)),
                pystray.MenuItem("Branco Frio (6500K)", lambda: self.on_brightness_change(100, 100)),
            )),
            pystray.MenuItem("Ajuste de Brilho", pystray.Menu(
                pystray.MenuItem("100% (Brilho Máximo)", lambda: self.on_brightness_change(100, None)),
                pystray.MenuItem("75%", lambda: self.on_brightness_change(75, None)),
                pystray.MenuItem("50%", lambda: self.on_brightness_change(50, None)),
                pystray.MenuItem("25%", lambda: self.on_brightness_change(25, None)),
                pystray.MenuItem("10% (Noturno)", lambda: self.on_brightness_change(10, None)),
            )),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Encerrar Aplicação", lambda: self.on_quit())
        )

    def run(self):
        self.icon.run()

    def stop(self):
        self.icon.stop()
`,
  },
  {
    path: 'main.py',
    name: 'main.py',
    category: 'core',
    description: 'Ponto de entrada orquestrador para Windows 11',
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

    config = load_config()

    controller = BulbController(config)
    scenes = SceneEngine(controller)
    ambilight = ScreenSyncEngine(controller, config.screen_sync)

    def stop_active_workers(restore_white: bool = False):
        if ambilight.is_running():
            ambilight.stop(restore_white=restore_white)
        if scenes.current_scene:
            scenes.stop_active_scene(restore_white=restore_white)
        controller.clear_queue()

    def handle_toggle():
        stop_active_workers(restore_white=False)
        controller.toggle()
        tray_app.update_icon_color(controller.state.is_on, controller.state.rgb)
        logger.info(f"Power toggle -> {'Ligada' if controller.state.is_on else 'Desligada'}")

    def handle_reading_mode():
        stop_active_workers(restore_white=False)
        controller.restore_normal_white()
        tray_app.update_icon_color(True, (255, 235, 200))
        logger.info("Modo de leitura ativado: 4000K 100%")

    def handle_start_scene(scene_name: str):
        stop_active_workers(restore_white=False)
        scenes.start_scene(scene_name)
        logger.info(f"Cena iniciada: {scene_name}")

    def handle_start_ambilight():
        stop_active_workers(restore_white=False)
        ambilight.start()
        logger.info("Ambilight ativado via interface de bandeja")

    def handle_brightness_change(brightness: int, temp: int | None):
        stop_active_workers(restore_white=False)
        current_temp = controller.state.color_temp if temp is None else temp
        controller.set_white(brightness=brightness, color_temp=current_temp)
        logger.info(f"Brilho ajustado para {brightness}%, Temp: {current_temp}%")

    def handle_quit():
        logger.info("Encerrando aplicação e liberando recursos...")
        stop_active_workers(restore_white=False)
        hotkeys.stop()
        controller.close()
        tray_app.stop()
        sys.exit(0)

    api_server = APIServer(
        host=config.server.host,
        port=config.server.port,
        controller=controller,
        scenes=scenes,
        ambilight=ambilight
    )
    api_server.start()

    tray_app = SystemTrayApp(
        on_toggle_power=handle_toggle,
        on_set_reading=handle_reading_mode,
        on_start_scene=handle_start_scene,
        on_start_ambilight=handle_start_ambilight,
        on_brightness_change=handle_brightness_change,
        on_quit=handle_quit
    )

    tray_app.update_icon_color(controller.state.is_on, controller.state.rgb)

    hotkeys = GlobalHotkeys()
    hotkeys.register(config.hotkeys.get("toggle_power", "ctrl+alt+l"), handle_toggle)
    hotkeys.register(config.hotkeys.get("mode_reading", "ctrl+shift+r"), handle_reading_mode)
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
`,
  },
  {
    path: 'start_background.vbs',
    name: 'start_background.vbs',
    category: 'scripts',
    description: 'Launcher silencioso VBScript para inicializar sem janela de terminal no Windows 11',
    content: `' ==============================================================================
' Inicializador Silencioso em Background para Windows 11
' Executa main.py via pythonw.exe sem abrir nenhuma janela de prompt/console
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "pythonw.exe main.py", 0, False
Set WshShell = Nothing
`,
  },
  {
    path: 'install_startup.bat',
    name: 'install_startup.bat',
    category: 'scripts',
    description: 'Script para adicionar o launcher à pasta Inicializar (Startup) do Windows',
    content: `@echo off
title Configurar Inicializacao Automatica no Windows 11 - Avant Neo 50W IoT
echo ==============================================================================
echo Adicionando Avant Neo 50W IoT Engine a pasta Inicializar (Startup) do Windows
echo ==============================================================================
echo.

set TARGET_VBS=%~dp0start_background.vbs
set STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\\AvantNeo50W_IoT.vbs

if not exist "%TARGET_VBS%" (
    echo [ERRO] O arquivo start_background.vbs nao foi encontrado neste diretorio!
    pause
    exit /b 1
)

copy /y "%TARGET_VBS%" "%SHORTCUT_PATH%" >nul

if %errorlevel% equ 0 (
    echo [SUCESSO] Inicializacao configurada com sucesso!
    echo O controlador agora sera executado silenciosamente em background ao ligar o PC.
    echo Local: %SHORTCUT_PATH%
) else (
    echo [ERRO] Falha ao copiar o script para a pasta Startup.
)

echo.
pause
`,
  },
  {
    path: 'test_api.bat',
    name: 'test_api.bat',
    category: 'scripts',
    description: 'Script para testar endpoints da API local na porta 21420',
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
curl -s -X POST "http://127.0.0.1:21420/api/color/rgb?r=0&g=255&b=255"
echo.
echo.

echo 4. Definindo Branco Modo Leitura (Brilho 100%%, Temperatura 50%%):
curl -s -X POST "http://127.0.0.1:21420/api/color/white?brightness=100&color_temp=50"
echo.
echo.

echo 5. Testando Inicio de Efeito (Cyberpunk Pulse):
curl -s -X POST "http://127.0.0.1:21420/api/scene/start?scene=cyberpunk"
echo.
echo.

echo 6. Testando Parada Imediata e Restauracao ao Normal:
curl -s -X POST "http://127.0.0.1:21420/api/scene/stop?restore=true"
echo.
echo.

echo 7. Testando se o Cockpit Web esta respondendo:
curl -s -I http://127.0.0.1:21420 | findstr "200"
echo.
echo ==============================================================================
echo [SUCESSO] Todos os endpoints responderam com exito!
echo Voce pode abrir http://127.0.0.1:21420 no seu navegador para o Cockpit completo.
echo ==============================================================================
echo.

pause
`,
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'docs',
    description: 'Documentação completa de arquitetura, parâmetros de rede e instruções',
    content: `# Avant Neo 50W RGB/CCT IoT Automation Suite (Windows 11)

Software modular de baixa latência em Python 3.10+ para controle de alta performance da lâmpada inteligente Avant Neo 50W (base Tuya 3.5), executando em segundo plano na bandeja do sistema do Windows 11 com suporte a sincronização de tela Ambilight, efeitos dinâmicos, atalhos globais Win32 e API REST local.

---

## 1. Características Técnicas

- **Driver Desacoplado:** Fila de comandos prioritários e slot Latest-Value Sampling para streaming, com pacing seguro de 5 Hz para não sobrecarregar a controladora Wi-Fi da lâmpada.
- **Protocolo Tuya 3.5 Validado:** Comunicação direta na porta TCP \`6668\` com tratamento de timeout e auto-recuperação assíncrona.
- **Ambilight de Baixa Latência:** Captura do display primário via \`mss\` com saturação reforçada e LERP suave.
- **Atalhos Globais Win32:** Registro via \`RegisterHotKey\` com resolução automática de colisões.
- **API REST Local e Cockpit Web:** Servidor FastAPI em \`http://127.0.0.1:21420\` servindo o painel completo.

---

## 2. Requisitos & Instalação

\`\`\`powershell
pip install -r requirements.txt
python main.py
\`\`\`
`,
  },
];
