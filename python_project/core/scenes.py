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
    Engine de efeitos visuais e ritmos luminosos continuos.
    Opera em threads desacopladas com cancelamento limpo via threading.Event.
    """
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
            raise ValueError(f"Cena desconhecida: {scene_name}. Disponiveis: {list(target_map.keys())}")

        self._current_scene_name = scene_name.lower()
        self._thread = threading.Thread(target=target, daemon=True, name=f"Scene-{scene_name}")
        self._thread.start()
        logger.info(f"Cena iniciada: {scene_name}")

    # --- Implementacao dos Loops de Cena ---

    def _loop_cyberpunk(self):
        """Interpola ciclicamente entre Ciano Eletrico (0, 255, 255) e Magenta Neon (255, 0, 150)."""
        color_a = (0, 255, 255)
        color_b = (255, 0, 150)
        t = 0.0
        while not self._stop_event.is_set():
            sin_val = (math.sin(t) + 1.0) / 2.0  # 0.0 a 1.0
            r = int(color_a[0] + (color_b[0] - color_a[0]) * sin_val)
            g = int(color_a[1] + (color_b[1] - color_a[1]) * sin_val)
            b = int(color_a[2] + (color_b[2] - color_a[2]) * sin_val)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            t += 0.08
            time.sleep(0.05)

    def _loop_candle(self):
        """Oscilacao pseudo-randomica imitando chama viva / lareira ambar."""
        while not self._stop_event.is_set():
            r = 255
            g = random.randint(100, 155)
            b = random.randint(10, 35)

            self.controller.set_rgb(r, g, b, stream_mode=True)
            time.sleep(random.uniform(0.08, 0.25))

    def _loop_circadian(self):
        """Ajusta a temperatura de cor e brilho baseado no horario solar local."""
        while not self._stop_event.is_set():
            now = datetime.now()
            hour = now.hour + now.minute / 60.0

            if 6.0 <= hour < 9.0:
                # Amanhecer: Transicao de luz quente para neutra
                pct = (hour - 6.0) / 3.0
                brightness = int(40 + (60 * pct))
                temp = int(20 + (50 * pct))
            elif 9.0 <= hour < 18.0:
                # Pleno dia: 100% de luz solar fria (foco e alerta)
                brightness = 100
                temp = 100
            elif 18.0 <= hour < 22.0:
                # Anoitecer: Reducao progressiva de luz azul
                pct = (hour - 18.0) / 4.0
                brightness = int(100 - (40 * pct))
                temp = int(100 - (90 * pct))
            else:
                # Madrugada: Luz ambar profunda, minimo brilho
                brightness = 25
                temp = 0

            self.controller.set_white(brightness, temp)
            self._stop_event.wait(60.0)
