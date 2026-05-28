import asyncio
import datetime
import socket
import time

from fastapi import WebSocket

from backend.config import CACHE_TTL
from backend import state
from backend.services.connections import conn_inc, conn_dec, broadcast_conn


def tcp_send(port: int, message: str, timeout: float = 2.0, retries: int = 3) -> str:
    """Send a raw TCP message to a server and return the single-line response."""
    for attempt in range(retries):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=timeout) as s:
                s.sendall((message + "\n").encode())
                return s.recv(1024).decode().strip()
        except ConnectionRefusedError:
            if attempt < retries - 1:
                time.sleep(0.05 * (attempt + 1))
            else:
                return "NXDOMAIN"
        except OSError:
            return "NXDOMAIN"
    return "NXDOMAIN"


async def resolve_and_stream(ws: WebSocket, hostname: str, root_port: int) -> None:
    """Walk the resolution chain, using cache when available, streaming each hop."""

    async def emit(step: str, **kwargs):
        await ws.send_json({"step": step, **kwargs})

    try:
        # cache check
        cached = state.dns_cache.resolve(hostname)
        if cached and not cached.is_expired():
            await emit("cache_hit", hostname=hostname, port=int(cached.port),
                       expires=cached.expiry.strftime("%H:%M:%S"))
            return

        parts = hostname.split(".")
        tld = parts[-1]
        domain = ".".join(parts[-2:])
        loop = asyncio.get_event_loop()

        # root
        t0 = time.perf_counter()
        root_resp = await loop.run_in_executor(None, tcp_send, root_port, tld)
        root_ms = round((time.perf_counter() - t0) * 1000, 1)
        if root_resp == "NXDOMAIN":
            await emit("nxdomain", stage="root", query=tld, port=root_port, ms=root_ms)
            return
        tld_port = int(root_resp)
        entry = conn_inc(root_port, tld)
        await broadcast_conn(entry)
        await emit("root", query=tld, port=root_port, result_port=tld_port, ms=root_ms)
        conn_dec(root_port, tld, tld_port)
        await asyncio.sleep(0.15)

        # tld
        t1 = time.perf_counter()
        tld_resp = await loop.run_in_executor(None, tcp_send, tld_port, domain)
        tld_ms = round((time.perf_counter() - t1) * 1000, 1)
        if tld_resp == "NXDOMAIN":
            await emit("nxdomain", stage="tld", query=domain, port=tld_port, ms=tld_ms)
            return
        auth_port = int(tld_resp)
        entry = conn_inc(tld_port, domain)
        await broadcast_conn(entry)
        await emit("tld", query=domain, port=tld_port, result_port=auth_port, ms=tld_ms)
        conn_dec(tld_port, domain, auth_port)
        await asyncio.sleep(0.15)

        # auth
        t2 = time.perf_counter()
        auth_resp = await loop.run_in_executor(None, tcp_send, auth_port, hostname)
        auth_ms = round((time.perf_counter() - t2) * 1000, 1)
        if auth_resp == "NXDOMAIN":
            await emit("nxdomain", stage="auth", query=hostname, port=auth_port, ms=auth_ms)
            return
        final_port = int(auth_resp)
        total_ms = round(root_ms + tld_ms + auth_ms, 1)
        entry = conn_inc(auth_port, hostname)
        await broadcast_conn(entry)
        await emit("auth", query=hostname, port=auth_port, result_port=final_port, ms=auth_ms)
        conn_dec(auth_port, hostname, final_port)
        await asyncio.sleep(0.1)

        # cache
        expiry = datetime.datetime.now() + datetime.timedelta(seconds=CACHE_TTL)
        state.dns_cache.add(hostname, str(final_port), expiry)
        await emit("resolved", hostname=hostname, port=final_port, total_ms=total_ms)

    except Exception as e:
        await ws.send_json({"step": "error", "message": str(e)})