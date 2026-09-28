import time
import logging
import threading
from typing import Tuple, Optional
import mss
from PIL import Image
from core.controller import BulbController
from core.config import ScreenSyncConfig

logger = logging.getLogger("AmbilightEngine")

class ScreenSyncEngine:
    """
    Engine de Ambilight com captura em alta taxa (mss) no display primario,
    filtro de reforco de saturacao e interpolacao linear (LERP) para suavidade.
    """
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
        """Aumenta a saturacao no espaco HSV para cores de tela nao parecerem palidas na lampada."""
        rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
        max_c = max(rf, gf, bf)
        min_c = min(rf, gf, bf)
        delta = max_c - min_c

        if max_c == 0:
            return (0, 0, 0)

        s = delta / max_c
        v = max_c

        # Eleva a saturacao
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
            monitor = sct.monitors[1]  # Monitor Primario do Windows

            while self._running:
                loop_start = time.perf_counter()

                # Captura direta e ultra-rapida da memoria de video
                sct_img = sct.grab(monitor)
                
                # Reducao bilateral acelerada para 1x1 pixel via Pillow para media ponderada instantanea
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                tiny = img.resize((1, 1), Image.Resampling.BILINEAR)
                raw_r, raw_g, raw_b = tiny.getpixel((0, 0))

                # Realce de saturacao
                target_r, target_g, target_b = self._boost_saturation(
                    raw_r, raw_g, raw_b, self.config.saturation_boost
                )

                # Linear Interpolation (LERP) para evitar cortes secos e aliviar a taxa no microcontrolador
                cur_r, cur_g, cur_b = self._current_rgb
                final_r = cur_r + (target_r - cur_r) * lerp_alpha
                final_g = cur_g + (target_g - cur_g) * lerp_alpha
                final_b = cur_b + (target_b - cur_b) * lerp_alpha
                self._current_rgb = (final_r, final_g, final_b)

                # Despacha ao driver da lampada com politica de descarte de frames em congestionamento
                self.controller.set_rgb(int(final_r), int(final_g), int(final_b), stream_mode=True)

                elapsed = time.perf_counter() - loop_start
                sleep_time = target_delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
