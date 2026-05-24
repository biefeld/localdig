from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend import state
from backend.services.dns import resolve_and_stream

router = APIRouter()


@router.websocket("/ws/lookup")
async def ws_lookup(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            hostname = data.get("hostname", "").strip()

            if not hostname:
                await websocket.send_json({"step": "error", "message": "Empty hostname"})
                continue

            if not state.infrastructure_running or state.startup_root_port is None:
                await websocket.send_json({"step": "error", "message": "Infrastructure not running"})
                continue

            await resolve_and_stream(websocket, hostname, state.startup_root_port)

    except WebSocketDisconnect:
        pass
