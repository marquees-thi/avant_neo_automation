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
        self.color_temp: int = 50   # 0 (quente 2700K) a 100 (frio 6500K)
        self.rgb: Tuple[int, int, int] = (255, 255, 255)
        self.last_seen: float = 0.0

class BulbController:
    """
    Driver de baixa latência e alta resiliência para lâmpada inteligente Avant Neo 50W (Tuya 3.5).
    
    Arquitetura de performance:
    1. Fila de Comandos Prioritários (Ligar, Desligar, Branco, Cor Estática):
       Processamento imediato com cancelamento instantâneo de streaming anterior.
    2. Slot Atômico de Streaming (Ambilight e Cenas):
       Amostragem de frame mais recente (Latest-Value Sampling) com descarte automático
       de frames defasados, garantindo resposta zero-delay ao trocar de modo.
    3. Proteção anti-bloqueio de socket:
       Taxa máxima controlada (4.5 a 5 Hz) para evitar exaustão de conexões TCP
       no microcontrolador Wi-Fi da lâmpada.
    4. Auto-recuperação desacoplada:
       Varredura UDP ocorre em thread separada com cooldown e NUNCA bloqueia comandos de usuário.
    """
    def __init__(self, config: AppConfig):
        self.config = config
        self.state = BulbState()
        self._lock = threading.Lock()
        
        # Fila prioritária para comandos de usuário
        self._cmd_queue: queue.Queue = queue.Queue(maxsize=15)
        
        # Slot atômico para streaming (Ambilight e Cenas)
        self._latest_stream_frame = None
        self._stream_lock = threading.Lock()
        
        # Flag de aborto imediato para cancelamento instantâneo
        self._abort_signal = threading.Event()
        
        self._running = True
        self._consecutive_priority_failures = 0
        self._last_udp_scan_time = 0.0
        self._last_packet_sent_time = 0.0
        
        # Intervalo mínimo entre pacotes físicos para estabilidade da lâmpada Tuya Wi-Fi (~5 Hz)
        self._min_packet_interval = 0.18
        
        self.device = self._create_device_instance(self.config.device.ip)
        
        # Thread de envio serializado de pacotes TCP
        self._worker_thread = threading.Thread(target=self._command_worker, daemon=True, name="BulbWorker")
        self._worker_thread.start()
        
        # Consulta estado inicial da lâmpada
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

    def clear_queue(self):
        """Descarta imediatamente todos os comandos pendentes e frames de streaming."""
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
            
            # 1. Verifica primeiro comandos de usuário prioritários
            try:
                item = self._cmd_queue.get_nowait()
                is_stream_item = False
            except queue.Empty:
                pass
            
            # 2. Se não há comando prioritário, pega o frame mais recente do streaming
            if item is None:
                with self._stream_lock:
                    if self._latest_stream_frame is not None:
                        item = self._latest_stream_frame
                        self._latest_stream_frame = None
                        is_stream_item = True

            if item is None:
                time.sleep(0.01)
                continue

            # Controle de taxa (pacing) para não sobrecarregar o buffer do microcontrolador Tuya
            now = time.perf_counter()
            time_since_last = now - self._last_packet_sent_time
            if is_stream_item and time_since_last < self._min_packet_interval:
                time.sleep(self._min_packet_interval - time_since_last)

            # Se recebeu sinal de aborto durante a espera, descarta frame de stream
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
                    # Em modo streaming, falhas de frames intermediários são descartadas silenciosamente
                    logger.debug(f"Frame de streaming descartado: {e}")

            # Se houver falhas consecutivas REAIS em comandos prioritários, dispara auto-recovery assíncrono
            if not is_stream_item and not success and self._consecutive_priority_failures >= 4:
                self._trigger_async_recovery()

            # Notifica conclusão da fila se era comando prioritário
            if not is_stream_item:
                try:
                    self._cmd_queue.task_done()
                except ValueError:
                    pass

    def _dispatch_priority(self, func: Callable, *args, **kwargs):
        """Limpa fila e executa com prioridade máxima o comando do usuário."""
        self.clear_queue()
        try:
            self._cmd_queue.put_nowait((func, args, kwargs))
        except queue.Full:
            pass

    def _dispatch_stream(self, func: Callable, *args, **kwargs):
        """Atualiza atomicamente o frame mais recente, descartando anteriores."""
        with self._stream_lock:
            self._latest_stream_frame = (func, args, kwargs)

    def _trigger_async_recovery(self):
        """Inicia varredura UDP de recuperação sem travar a thread de comandos."""
        now = time.time()
        if now - self._last_udp_scan_time < 45.0:
            return  # Cooldown de 45 segundos para evitar varreduras excessivas
        
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

    # --- Métodos de Interface Pública ---

    def sync_state(self) -> Dict[str, Any]:
        """Consulta bloqueante pontual para extrair o estado atual da lâmpada."""
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
        """
        brightness: 0 a 100 (%)
        color_temp: 0 (Quente/Âmbar 2700K) a 100 (Frio 6500K)
        """
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
        """
        stream_mode=True: Utiliza o slot de amostragem de frame mais recente.
        stream_mode=False: Limpa a fila e aplica a cor estática imediatamente.
        """
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
        """Retorna instantaneamente a lâmpada ao modo normal de trabalho (Branco 4000K, 100%)."""
        self.clear_queue()
        self.set_white(100, 50)
        logger.info("Lâmpada restaurada instantaneamente ao modo normal (4000K, 100%).")

    def close(self):
        self._running = False
        self.clear_queue()
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=0.5)
