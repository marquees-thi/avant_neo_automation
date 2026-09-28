import time
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
        
        # Fila de comandos: Para streaming rapido (Ambilight), comandos obsoletos sao descartados
        self._cmd_queue: queue.Queue = queue.Queue(maxsize=30)
        self._running = True
        
        self.device = self._create_device_instance(self.config.device.ip)
        
        # Thread dedicada para comandos TCP sincronos
        self._worker_thread = threading.Thread(target=self._command_worker, daemon=True, name="BulbWorker")
        self._worker_thread.start()
        
        # Atualiza status inicial
        self.sync_state()

    def _create_device_instance(self, ip: str) -> tinytuya.BulbDevice:
        dev = tinytuya.BulbDevice(
            dev_id=self.config.device.id,
            address=ip,
            local_key=self.config.device.local_key,
            version=self.config.device.version
        )
        # Port 6668 fecha com frequencia na versao 3.5; False reduz resets de conexao
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
        """Descobre novo IP se o DHCP do roteador expirou."""
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
                else:
                    logger.info("IP permanece o mesmo. Apenas oscilacao de rede transitoria.")
        except Exception as e:
            logger.error(f"Erro na recuperacao UDP: {e}")

    # --- Metodos de Interface Publica ---

    def sync_state(self) -> Dict[str, Any]:
        """Consulta bloqueante (usar pontualmente) para extrair o estado atual."""
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
        """
        brightness: 0 a 100 (%)
        color_temp: 0 (Quente/Ambar 2700K) a 100 (Frio 6500K)
        """
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
        """
        stream_mode=True ativa politica agressiva de descarte de frames antigos
        para evitar latencia cumulativa no Ambilight.
        """
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
