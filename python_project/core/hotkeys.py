import ctypes
from ctypes import wintypes
import threading
import logging
from typing import Dict, Callable, Tuple

logger = logging.getLogger("Win32Hotkeys")

user32 = ctypes.windll.user32

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_MAP = {
    "l": 0x4C,
    "r": 0x52,
    "a": 0x41,
    "c": 0x43,
    "up": 0x26,
    "down": 0x28,
    "left": 0x25,
    "right": 0x27,
    "space": 0x20,
}

class GlobalHotkeys:
    """
    Atalhos globais de teclado usando a API nativa Win32 (RegisterHotKey).
    Nao interfere no gameplay em tela cheia nem depende de hooks pesados de teclado.
    """
    def __init__(self):
        self._handlers: Dict[int, Tuple[int, int, Callable]] = {}
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
        self._handlers[hotkey_id] = (modifiers, vk, callback)

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._msg_loop, daemon=True, name="HotkeyMessageLoop")
        self._thread.start()

    def _msg_loop(self):
        registered_ids = []
        for hid, (mods, vk, cb) in self._handlers.items():
            if user32.RegisterHotKey(None, hid, mods, vk):
                registered_ids.append(hid)
            else:
                logger.error(f"Falha ao registrar hotkey ID {hid} ({vk})")

        msg = wintypes.MSG()
        while self._running:
            res = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
            if res <= 0:
                break
            if msg.message == 0x0312:  # WM_HOTKEY
                hid = msg.wParam
                if hid in self._handlers:
                    _, _, cb = self._handlers[hid]
                    try:
                        cb()
                    except Exception as e:
                        logger.error(f"Erro executando callback do atalho: {e}")

        for hid in registered_ids:
            user32.UnregisterHotKey(None, hid)

    def stop(self):
        self._running = False
        user32.PostQuitMessage(0)
