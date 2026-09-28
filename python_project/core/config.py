import os
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
