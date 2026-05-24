import asyncio
import sys
from pathlib import Path

import core.launcher as _launcher
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend import state
from backend.config import MASTER_CONF, SINGLES_DIR
from backend.services.singles import read_singles

router = APIRouter(prefix="/api/infrastructure")


class LaunchRequest(BaseModel):
    master_conf: str = str(MASTER_CONF)
    singles_dir: str = str(SINGLES_DIR)


@router.post("/launch")
async def launch_infrastructure(req: LaunchRequest):
    if state.infrastructure_running:
        raise HTTPException(400, "Infrastructure already running")

    master_path = Path(req.master_conf)
    singles_path = Path(req.singles_dir)

    if not master_path.exists():
        raise HTTPException(400, f"master.conf not found: {master_path}")

    singles_path.mkdir(parents=True, exist_ok=True)

    from backend.config import ROOT_DIR
    state.launcher_process = await asyncio.create_subprocess_exec(
        sys.executable, _launcher.__file__, str(master_path), str(singles_path),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(ROOT_DIR),
    )

    await asyncio.sleep(1.5)

    if state.launcher_process.returncode is not None:
        stderr = await state.launcher_process.stderr.read()
        raise HTTPException(500, f"Launcher exited: {stderr.decode()}")

    lines = master_path.read_text().strip().splitlines()
    state.startup_root_port = int(lines[0].strip())
    state.infrastructure_running = True

    servers = read_singles(singles_path)
    return {"status": "running", "root_port": state.startup_root_port, "servers": servers}


@router.post("/teardown")
async def teardown_infrastructure():
    if not state.infrastructure_running:
        raise HTTPException(400, "Infrastructure not running")

    if state.launcher_process and state.launcher_process.returncode is None:
        state.launcher_process.terminate()
        await state.launcher_process.wait()

    state.infrastructure_running = False
    state.startup_root_port = None
    state.launcher_process = None
    return {"status": "stopped"}


@router.get("/status")
async def infrastructure_status():
    if not state.infrastructure_running:
        return {"running": False, "servers": []}

    singles_path = Path(SINGLES_DIR)
    servers = read_singles(singles_path) if singles_path.exists() else []
    return {"running": True, "root_port": state.startup_root_port, "servers": servers}
