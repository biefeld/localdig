"""
WebSocket benchmark endpoint.
Streams each phase result as it completes rather than waiting for all phases.
"""
import asyncio
import concurrent.futures
import datetime as dt
import statistics
import threading
import time
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.dns import tcp_send
from backend import state

router = APIRouter()

REPEATS        = [1, 5, 10, 15]
CACHE_TTL      = 60.0
RUNS_PER_PHASE = 3
QUERY_DELAY    = 0.005  # rate limit between TCP calls

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="benchmark")


# In memory benchmarking cache

class _Record:
    def __init__(self, port: str):
        self.port   = port
        self.expiry = dt.datetime.now() + dt.timedelta(seconds=CACHE_TTL)

    def is_expired(self) -> bool:
        return self.expiry < dt.datetime.now()


class _BenchCache:
    def __init__(self):
        self._d: dict[str, _Record] = {}
        self._lock = threading.Lock()

    def get(self, h: str) -> Optional[_Record]:
        with self._lock:
            r = self._d.get(h)
            return r if r and not r.is_expired() else None

    def add(self, h: str, port: str) -> None:
        with self._lock:
            self._d[h] = _Record(port)


# Services

def _resolve(root_port: int, hostname: str) -> Optional[str]:
    try:
        parts     = hostname.split(".")
        tld_port  = tcp_send(root_port, parts[-1])
        if "NXDOMAIN" in tld_port:
            return None
        auth_port = tcp_send(int(tld_port), f"{parts[-2]}.{parts[-1]}")
        if "NXDOMAIN" in auth_port:
            return None
        result    = tcp_send(int(auth_port), hostname)
        return None if "NXDOMAIN" in result else result.strip()
    except (OSError, ValueError):
        return None


def _build_queries(hostnames: list[str], repeat: int) -> list[str]:
    queries = []
    for h in hostnames:
        queries.extend([h] * repeat)
    return queries


def _run_no_cache(root_port: int, queries: list[str]) -> float:
    elapsed = 0.0
    for h in queries:
        t0 = time.perf_counter()
        _resolve(root_port, h)
        elapsed += time.perf_counter() - t0
        time.sleep(QUERY_DELAY)
    return elapsed


def _run_with_cache(root_port: int, queries: list[str]) -> float:
    cache = _BenchCache()
    elapsed = 0.0
    for h in queries:
        t0 = time.perf_counter()
        if cache.get(h):
            elapsed += time.perf_counter() - t0
            time.sleep(QUERY_DELAY)
            continue
        result = _resolve(root_port, h)
        elapsed += time.perf_counter() - t0
        if result:
            cache.add(h, result)
        time.sleep(QUERY_DELAY)
    return elapsed


def _averaged(fn, root_port: int, queries: list[str]) -> float:
    return statistics.mean(fn(root_port, queries) for _ in range(RUNS_PER_PHASE))


def _run_phase(root_port: int, hostnames: list[str], repeat: int) -> dict:
    queries    = _build_queries(hostnames, repeat)
    n          = len(queries)
    no_cache_t = _averaged(_run_no_cache, root_port, queries)
    time.sleep(0.3)
    cache_t    = _averaged(_run_with_cache, root_port, queries)
    time.sleep(0.3)
    speedup    = no_cache_t / cache_t if cache_t > 0 else 1.0
    return {
        "repeat":               repeat,
        "queries":              n,
        "without_cache_ms_per": round(no_cache_t / n * 1000, 2),
        "with_cache_ms_per":    round(cache_t / n * 1000, 2),
        "speedup":              round(speedup, 2),
    }




# Sockets

@router.websocket("/ws/benchmark")
async def ws_benchmark(websocket: WebSocket):
    await websocket.accept()

    try:
        # wait for start signal from client
        msg = await websocket.receive_json()
        if msg.get("action") != "start":
            await websocket.send_json({"event": "error", "message": "Expected {action: start}"})
            return

        if not state.infrastructure_running or state.startup_root_port is None:
            await websocket.send_json({"event": "error", "message": "Infrastructure not running"})
            return

        from pathlib import Path
        from backend.config import MASTER_CONF
        master_conf = msg.get("master_conf", "")
        master_path = Path(master_conf) if master_conf and Path(master_conf).exists() else MASTER_CONF
        if not master_path.exists():
            await websocket.send_json({"event": "error", "message": f"master.conf not found: {master_path}"})
            return

        lines     = master_path.read_text().strip().splitlines()
        all_hostnames = [l.split(",")[0] for l in lines[1:] if "," in l]
        # use small fixed subset to keep connection count manageable
        hostnames = all_hostnames[:10]
        root_port = state.startup_root_port
        loop      = asyncio.get_event_loop()

        await websocket.send_json({
            "event":     "started",
            "phases":    len(REPEATS),
            "hostnames": len(hostnames),
            "runs":      RUNS_PER_PHASE,
        })

        for i, repeat in enumerate(REPEATS):
            await websocket.send_json({"event": "phase_start", "repeat": repeat, "index": i})

            result = await loop.run_in_executor(
                _executor, _run_phase, root_port, hostnames, repeat
            )

            await websocket.send_json({"event": "phase_done", "index": i, "result": result})

        await websocket.send_json({"event": "complete"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"event": "error", "message": str(e)})
        except Exception:
            pass