import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend import state

router = APIRouter()


@router.websocket("/ws/connections")
async def ws_connections(websocket: WebSocket):
    """Streams connection open/close events and per-server active counts."""
    await websocket.accept()
    state.conn_ws_clients.append(websocket)

    # send current snapshot on connect
    with state.conn_lock:
        await websocket.send_json({
            "event": "snapshot",
            "active_connections": dict(state.active_connections),
            "log": list(state.conn_log)[-50:],
        })

    try:
        while True:
            await asyncio.sleep(1)
            with state.conn_lock:
                await websocket.send_json({
                    "event": "tick",
                    "active_connections": dict(state.active_connections),
                })
    except WebSocketDisconnect:
        if websocket in state.conn_ws_clients:
            state.conn_ws_clients.remove(websocket)
