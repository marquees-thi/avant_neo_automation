import logging
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
    """
    Servidor HTTP REST local para integracao com Stream Deck, Home Assistant,
    scripts do PowerShell e webhooks locais.
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
        logger.info(f"API REST operacional em http://{self.host}:{self.port}")
