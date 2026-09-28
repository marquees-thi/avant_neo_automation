import time
import math
import random
import logging
import threading
from datetime import datetime
from typing import Optional
from core.controller import BulbController

logger = logging.getLogger("SceneEngine")

class SceneEngine:
    """
    Engine de efeitos dinâmicos e ritmos contínuos para Avant Neo 50W.
    Opera com cancelamento limpo e imediato via threading.Event, sem nunca
    bloquear a thread principal ou o servidor de API.
    """
    def __init__(self, controller: BulbController):
        self.controller = controller
        self._current_scene_name: Optional[str] = None
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @property
    def current_scene(self) -> Optional[str]:
        return self._current_scene_name

    def stop_active_scene(self, restore_white: bool = False):
        """Interrompe a cena ativa imediatamente e purga qualquer frame pendente."""
        self._current_scene_name = None
        self._stop_event.set()
        self.controller.clear_queue()
        
        if restore_white:
            self.controller.restore_normal_white()
            
        logger.info("Cena ativa finalizada instantaneamente.")

    def start_scene(self, scene_name: str):
        # Para cena anterior imediatamente
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

    # --- Implementação dos Loops de Efeito ---

    def _loop_cyberpunk(self):
        """Oscilação suave entre Ciano Elétrico (0, 255, 255) e Magenta Neon (255, 0, 150)."""
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
            # wait(0.20) acorda instantaneamente no momento exato em que stop_event.set() é chamado
            if self._stop_event.wait(0.20):
                break

    def _loop_candle(self):
        """Oscilação pseudo-randômica imitando chama viva / lareira âmbar."""
        while not self._stop_event.is_set():
            r = 255
            g = random.randint(95, 145)
            b = random.randint(8, 28)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            if self._stop_event.wait(random.uniform(0.22, 0.40)):
                break

    def _loop_circadian(self):
        """Ajusta a temperatura de cor e brilho baseado no relógio local."""
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
