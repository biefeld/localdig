import asyncio
import sys

import benchmarking.driver as _driver
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import MASTER_CONF, ROOT_DIR
from backend.services.singles import parse_benchmark_output

router = APIRouter(prefix="/api/benchmark")


class BenchmarkRequest(BaseModel):
    master_conf: str = str(MASTER_CONF)


@router.post("/run")
async def run_benchmark(req: BenchmarkRequest):
    from pathlib import Path
    master_path = Path(req.master_conf) if req.master_conf else MASTER_CONF
    if not master_path.exists():
        raise HTTPException(400, f"master.conf not found: {master_path}")

    proc = await asyncio.create_subprocess_exec(
        sys.executable, _driver.__file__, str(master_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(ROOT_DIR),
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)

    if proc.returncode != 0:
        raise HTTPException(500, stderr.decode())

    return {"results": parse_benchmark_output(stdout.decode())}
