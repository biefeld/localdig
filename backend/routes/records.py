import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend import state
from backend.services.dns import tcp_send

router = APIRouter(prefix="/api/records")


class RecordEdit(BaseModel):
    port: int
    hostname: str
    target_port: Optional[int] = None   # None = DEL, int = ADD


@router.post("/edit")
async def edit_record(req: RecordEdit):
    if not state.infrastructure_running:
        raise HTTPException(400, "Infrastructure not running")

    cmd = f"!ADD {req.hostname} {req.target_port}" if req.target_port is not None else f"!DEL {req.hostname}"

    try:
        resp = await asyncio.get_event_loop().run_in_executor(
            None, tcp_send, req.port, cmd
        )
        return {"ok": True, "response": resp}
    except Exception as e:
        raise HTTPException(500, str(e))
