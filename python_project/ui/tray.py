import pystray
from PIL import Image, ImageDraw
import logging
import webbrowser
from typing import Callable, Optional

logger = logging.getLogger("TrayUI")

class SystemTrayApp:
    """
    Interface residente na Area de Notificacao (System Tray) do Windows 11.
    Gera dinamicamente icones Pillow refletindo a cor e status de alimentacao da lampada.
    """
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
        """Gera um icone circular com anel escuro e centro iluminado."""
        size = 64
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        # Borda externa escura
        draw.ellipse((2, 2, size - 2, size - 2), fill=(30, 30, 30, 255))
        # Centro iluminado colorido
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
        """O tray icon deve rodar na Main Thread para processar a bomba de mensagens Win32."""
        self.icon.run()

    def stop(self):
        self.icon.stop()
