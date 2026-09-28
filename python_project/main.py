import sys
import logging
from core.config import load_config
from core.controller import BulbController
from core.scenes import SceneEngine
from core.hotkeys import GlobalHotkeys
from modules.screen_sync import ScreenSyncEngine
from modules.api_server import APIServer
from ui.tray import SystemTrayApp

# Configuracao de Log Estruturado
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

    logger.info("Hotkeys globais registradas:")
    for name, hk in config.hotkeys.items():
        logger.info(f" - {name}: {hk}")
    logger.info("Sistema operacional. Alocando thread principal para a interface do Windows.")

    # 7. Execucao Bloqueante da Bandeja na Main Thread
    try:
        tray_app.run()
    except KeyboardInterrupt:
        handle_quit()

if __name__ == "__main__":
    main()
