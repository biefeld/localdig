"""
Central shared state. Import from here (never from routes/sockets directly) to avoid circular imports.
"""
import threading
import collections
import datetime
from typing import Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from core.cache import Cache
from backend.config import CACHE_TTL

# ── infrastructure ─────────────────────────────────────────────────────────────
launcher_process = None          # asyncio.subprocess.Process | None
infrastructure_running: bool = False
startup_root_port: Optional[int] = None

# ── dns cache ──────────────────────────────────────────────────────────────────
dns_cache = Cache(update_period=1.0)
_cache_thread = threading.Thread(target=dns_cache.update, daemon=True)
_cache_thread.start()

# ── connection tracking ────────────────────────────────────────────────────────
conn_lock = threading.Lock()
active_connections: dict[int, int] = {}          # port -> active count
conn_log: collections.deque = collections.deque(maxlen=200)
conn_ws_clients: list = []                        # list[WebSocket]
