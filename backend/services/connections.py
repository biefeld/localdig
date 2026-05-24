import datetime
from typing import Optional

from backend import state


def conn_inc(port: int, hostname: str) -> dict:
    with state.conn_lock:
        state.active_connections[port] = state.active_connections.get(port, 0) + 1
        entry = {
            "ts": datetime.datetime.now().strftime("%H:%M:%S"),
            "port": port,
            "hostname": hostname,
            "event": "open",
            "active": state.active_connections[port],
        }
        state.conn_log.append(entry)
    return entry


def conn_dec(port: int, hostname: str, resolved_to: Optional[int]) -> dict:
    with state.conn_lock:
        state.active_connections[port] = max(0, state.active_connections.get(port, 1) - 1)
        entry = {
            "ts": datetime.datetime.now().strftime("%H:%M:%S"),
            "port": port,
            "hostname": hostname,
            "event": "resolved" if resolved_to else "nxdomain",
            "resolved_to": resolved_to,
            "active": state.active_connections[port],
        }
        state.conn_log.append(entry)
    return entry


async def broadcast_conn(entry: dict) -> None:
    dead = []
    for ws in state.conn_ws_clients:
        try:
            await ws.send_json(entry)
        except Exception:
            dead.append(ws)
    for ws in dead:
        state.conn_ws_clients.remove(ws)
