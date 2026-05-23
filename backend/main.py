"""
nxdomain GUI — FastAPI backend
Wraps launcher.py, recursor.py, server.py as subprocesses and exposes
REST + WebSocket endpoints for the React frontend.

Run from the repo root:
    uvicorn backend.main:app --reload --port 8000
"""

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# import cache from repo root
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent.parent))
from cache import Cache

# ── paths ──────────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent.parent   # repo root
RENDER_SECRETS_DIR = Path("/etc/secrets")

# 1. Handle the Read-Only Master Config
if RENDER_SECRETS_DIR.exists():
    MASTER_CONF = RENDER_SECRETS_DIR / "master.conf"
else:
    MASTER_CONF = ROOT_DIR / "master.conf"

# 2. Handle the Writeable Singles Directory 
# Force this to live in the app root so Python can safely create/write to it
SINGLES_DIR = ROOT_DIR / "singles"

# 3. Safely auto-create the directory at startup
SINGLES_DIR.mkdir(parents=True, exist_ok=True)


# ── state ──────────────────────────────────────────────────────────────────────
launcher_process: Optional[asyncio.subprocess.Process] = None
infrastructure_running = False
startup_root_port: Optional[int] = None

# ── cache ─────────────────────────────────────────────────────────────────────
CACHE_TTL = 30.0   # seconds — adjust as needed
dns_cache = Cache(update_period=1.0)
import threading as _threading
_cache_thread = _threading.Thread(target=dns_cache.update, daemon=True)
_cache_thread.start()


# ── lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # clean up launcher on shutdown
    global launcher_process
    if launcher_process and launcher_process.returncode is None:
        launcher_process.terminate()
        await launcher_process.wait()


app = FastAPI(title="nxdomain GUI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://nxdomain.pages.dev"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── models ─────────────────────────────────────────────────────────────────────
class LaunchRequest(BaseModel):
    master_conf: str = str(MASTER_CONF)   # path to master.conf
    singles_dir: str = str(SINGLES_DIR)  # path to singles dir


class RecordEdit(BaseModel):
    port: int        # which server to send the command to
    hostname: str
    target_port: Optional[int] = None   # None = DEL, int = ADD


class BenchmarkRequest(BaseModel):
    master_conf: str = str(MASTER_CONF)


# ── helpers ────────────────────────────────────────────────────────────────────
def _read_singles(singles_dir: Path) -> list[dict]:
    """Parse all .conf files in singles_dir into server descriptors."""
    servers = []
    for conf in sorted(singles_dir.glob("*.conf")):
        lines = conf.read_text().strip().splitlines()
        if not lines:
            continue
        port = int(lines[0].strip())
        records = []
        for line in lines[1:]:
            line = line.strip()
            if "," in line:
                host, rport = line.rsplit(",", 1)
                records.append({"hostname": host.strip(), "port": int(rport.strip())})
        name = conf.stem
        if name == "root":
            kind = "root"
        elif name.startswith("tld-"):
            kind = "tld"
        elif name.startswith("auth-"):
            kind = "auth"
        else:
            kind = "unknown"
        servers.append({"name": name, "kind": kind, "port": port, "records": records, "conf": str(conf)})
    return servers


def _tcp_send(port: int, message: str, timeout: float = 2.0) -> str:
    """Send a raw TCP message to a server and return the response."""
    with socket.create_connection(("127.0.0.1", port), timeout=timeout) as s:
        s.sendall((message + "\n").encode())
        data = b""
        s.settimeout(timeout)
        try:
            while chunk := s.recv(4096):
                data += chunk
        except (socket.timeout, ConnectionResetError):
            pass
    return data.decode().strip()


# ── infrastructure endpoints ───────────────────────────────────────────────────
@app.post("/api/infrastructure/launch")
async def launch_infrastructure(req: LaunchRequest):
    global launcher_process, infrastructure_running, startup_root_port

    if infrastructure_running:
        raise HTTPException(400, "Infrastructure already running")

    master_path = Path(req.master_conf)
    singles_path = Path(req.singles_dir)

    if not master_path.exists():
        raise HTTPException(400, f"master.conf not found: {master_path}")

    singles_path.mkdir(parents=True, exist_ok=True)

    launcher_process = await asyncio.create_subprocess_exec(
        sys.executable, str(ROOT_DIR / "launcher.py"), str(master_path), str(singles_path),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(ROOT_DIR),
    )

    # Give launcher time to spin up servers
    await asyncio.sleep(1.5)

    if launcher_process.returncode is not None:
        stderr = await launcher_process.stderr.read()
        raise HTTPException(500, f"Launcher exited: {stderr.decode()}")

    # Read root port from master.conf
    lines = master_path.read_text().strip().splitlines()
    startup_root_port = int(lines[0].strip())
    infrastructure_running = True

    servers = _read_singles(singles_path)
    return {"status": "running", "root_port": startup_root_port, "servers": servers}


@app.post("/api/infrastructure/teardown")
async def teardown_infrastructure():
    global launcher_process, infrastructure_running, startup_root_port

    if not infrastructure_running:
        raise HTTPException(400, "Infrastructure not running")

    if launcher_process and launcher_process.returncode is None:
        launcher_process.terminate()
        await launcher_process.wait()

    infrastructure_running = False
    startup_root_port = None
    launcher_process = None
    return {"status": "stopped"}


@app.get("/api/infrastructure/status")
async def infrastructure_status():
    if not infrastructure_running:
        return {"running": False, "servers": []}

    singles_path = Path(SINGLES_DIR)
    servers = _read_singles(singles_path) if singles_path.exists() else []
    return {"running": True, "root_port": startup_root_port, "servers": servers}


# ── dns lookup websocket ───────────────────────────────────────────────────────
@app.websocket("/ws/lookup")
async def ws_lookup(websocket: WebSocket):
    """
    Streams DNS resolution steps back to the client in real time.
    Client sends: {"hostname": "www.google.com"}
    Server emits: {"step": "root"|"tld"|"auth"|"resolved"|"error", ...}
    """
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            hostname = data.get("hostname", "").strip()

            if not hostname:
                await websocket.send_json({"step": "error", "message": "Empty hostname"})
                continue

            if not infrastructure_running or startup_root_port is None:
                await websocket.send_json({"step": "error", "message": "Infrastructure not running"})
                continue

            await _resolve_and_stream(websocket, hostname, startup_root_port)

    except WebSocketDisconnect:
        pass


async def _resolve_and_stream(ws: WebSocket, hostname: str, root_port: int):
    """Walk the resolution chain, using cache when available."""

    async def emit(step: str, **kwargs):
        await ws.send_json({"step": step, **kwargs})

    try:
        # ── cache check ───────────────────────────────────────────────────────
        cached = dns_cache.resolve(hostname)
        if cached and not cached.is_expired():
            await emit("cache_hit", hostname=hostname, port=int(cached.port),
                       expires=cached.expiry.strftime("%H:%M:%S"))
            return

        # ── Step 1 — root ─────────────────────────────────────────────────────
        t0 = time.perf_counter()
        parts = hostname.split(".")
        tld = parts[-1]
        root_resp = await asyncio.get_event_loop().run_in_executor(
            None, _tcp_send, root_port, tld
        )
        root_ms = round((time.perf_counter() - t0) * 1000, 1)

        if root_resp == "NXDOMAIN":
            await emit("nxdomain", stage="root", query=tld, port=root_port, ms=root_ms)
            return
        tld_port = int(root_resp)
        await emit("root", query=tld, port=root_port, result_port=tld_port, ms=root_ms)
        await asyncio.sleep(0.15)

        # ── Step 2 — TLD ──────────────────────────────────────────────────────
        t1 = time.perf_counter()
        domain = ".".join(parts[-2:])
        tld_resp = await asyncio.get_event_loop().run_in_executor(
            None, _tcp_send, tld_port, domain
        )
        tld_ms = round((time.perf_counter() - t1) * 1000, 1)

        if tld_resp == "NXDOMAIN":
            await emit("nxdomain", stage="tld", query=domain, port=tld_port, ms=tld_ms)
            return
        auth_port = int(tld_resp)
        await emit("tld", query=domain, port=tld_port, result_port=auth_port, ms=tld_ms)
        await asyncio.sleep(0.15)

        # ── Step 3 — authoritative ────────────────────────────────────────────
        t2 = time.perf_counter()
        auth_resp = await asyncio.get_event_loop().run_in_executor(
            None, _tcp_send, auth_port, hostname
        )
        auth_ms = round((time.perf_counter() - t2) * 1000, 1)

        if auth_resp == "NXDOMAIN":
            await emit("nxdomain", stage="auth", query=hostname, port=auth_port, ms=auth_ms)
            return

        final_port = int(auth_resp)
        total_ms = round(root_ms + tld_ms + auth_ms, 1)
        await emit("auth", query=hostname, port=auth_port, result_port=final_port, ms=auth_ms)
        await asyncio.sleep(0.1)

        # ── populate cache ────────────────────────────────────────────────────
        expiry = datetime.datetime.now() + datetime.timedelta(seconds=CACHE_TTL)
        dns_cache.add(hostname, str(final_port), expiry)

        await emit("resolved", hostname=hostname, port=final_port, total_ms=total_ms)

    except Exception as e:
        await emit("error", message=str(e))


# ── record management ──────────────────────────────────────────────────────────
@app.post("/api/records/edit")
async def edit_record(req: RecordEdit):
    """Send !ADD or !DEL to a running server."""
    if not infrastructure_running:
        raise HTTPException(400, "Infrastructure not running")

    if req.target_port is not None:
        cmd = f"!ADD {req.hostname} {req.target_port}"
    else:
        cmd = f"!DEL {req.hostname}"

    try:
        resp = await asyncio.get_event_loop().run_in_executor(
            None, _tcp_send, req.port, cmd
        )
        return {"ok": True, "response": resp}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── benchmark ──────────────────────────────────────────────────────────────────
@app.post("/api/benchmark/run")
async def run_benchmark(req: BenchmarkRequest):
    """Run the benchmarking driver and return structured results."""
    master_path = Path(req.master_conf) if req.master_conf else MASTER_CONF
    if not master_path.exists():
        raise HTTPException(400, f"master.conf not found: {master_path}")

    proc = await asyncio.create_subprocess_exec(
        sys.executable, str(ROOT_DIR / "benchmarking" / "driver.py"), str(master_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(ROOT_DIR),
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)

    if proc.returncode != 0:
        raise HTTPException(500, stderr.decode())

    results = _parse_benchmark_output(stdout.decode())
    return {"results": results}


def _parse_benchmark_output(output: str) -> list[dict]:
    """Parse the benchmark text summary into structured data."""
    results = []
    current: dict = {}
    for line in output.splitlines():
        line = line.strip()
        if "Total queries per phase" in line:
            if current:
                results.append(current)
            current = {"queries": int(line.split(":")[-1].strip())}
        elif "Without caching" in line:
            parts = line.split()
            current["without_cache_s"] = float(parts[3].replace("s", ""))
            current["without_cache_ms_per"] = float(parts[4].strip("(ms/query)"))
        elif "With caching" in line and "Speedup" not in line:
            parts = line.split()
            current["with_cache_s"] = float(parts[3].replace("s", ""))
            current["with_cache_ms_per"] = float(parts[4].strip("(ms/query)"))
        elif "Speedup" in line:
            current["speedup"] = float(line.split()[2].replace("x", ""))
    if current:
        results.append(current)
    return results


# ── cache endpoints ────────────────────────────────────────────────────────────
@app.get("/api/cache/entries")
async def get_cache_entries():
    """Return all live cache entries with remaining TTL."""
    now = datetime.datetime.now()
    entries = []
    with dns_cache._lock:
        for hostname, record in dns_cache.cache.items():
            remaining = (record.expiry - now).total_seconds()
            if remaining > 0:
                entries.append({
                    "hostname": hostname,
                    "port": int(record.port),
                    "expires": record.expiry.strftime("%H:%M:%S"),
                    "remaining_s": round(remaining, 1),
                    "ttl": CACHE_TTL,
                })
    return {"entries": entries, "ttl": CACHE_TTL}


@app.delete("/api/cache/entries/{hostname:path}")
async def evict_cache_entry(hostname: str):
    with dns_cache._lock:
        if hostname in dns_cache.cache:
            del dns_cache.cache[hostname]
            return {"ok": True}
    raise HTTPException(404, f"{hostname} not in cache")


@app.delete("/api/cache/entries")
async def clear_cache():
    with dns_cache._lock:
        dns_cache.cache.clear()
    return {"ok": True}