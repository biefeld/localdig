import asyncio
import random
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend import state
from backend.config import SINGLES_DIR
from backend.services.dns import tcp_send
from backend.services.singles import read_singles

router = APIRouter(prefix="/api/stress")


class StressRequest(BaseModel):
    count: int = 20
    hostnames: list[str] = []


@router.post("/run")
async def run_stress_test(req: StressRequest):
    if not state.infrastructure_running or state.startup_root_port is None:
        raise HTTPException(400, "Infrastructure not running")

    servers = read_singles(Path(SINGLES_DIR))
    auth_records = [
        r["hostname"]
        for s in servers if s["kind"] == "auth"
        for r in s["records"]
    ]

    if not auth_records:
        raise HTTPException(400, "No auth records found")

    hostnames = req.hostnames or [random.choice(auth_records) for _ in range(req.count)]
    root_port = state.startup_root_port

    async def single_lookup(hostname: str) -> dict:
        t0 = time.perf_counter()
        try:
            loop = asyncio.get_event_loop()
            parts = hostname.split(".")
            r1 = await loop.run_in_executor(None, tcp_send, root_port, parts[-1])
            if r1 == "NXDOMAIN":
                return {"hostname": hostname, "status": "nxdomain", "ms": 0}
            r2 = await loop.run_in_executor(None, tcp_send, int(r1), ".".join(parts[-2:]))
            if r2 == "NXDOMAIN":
                return {"hostname": hostname, "status": "nxdomain", "ms": 0}
            r3 = await loop.run_in_executor(None, tcp_send, int(r2), hostname)
            ms = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "hostname": hostname,
                "status": "nxdomain" if r3 == "NXDOMAIN" else "resolved",
                "port": None if r3 == "NXDOMAIN" else int(r3),
                "ms": ms,
            }
        except Exception as e:
            return {"hostname": hostname, "status": "error", "ms": 0, "error": str(e)}

    t_start = time.perf_counter()
    results = await asyncio.gather(*[single_lookup(h) for h in hostnames])
    total_ms = round((time.perf_counter() - t_start) * 1000, 1)

    resolved = [r for r in results if r["status"] == "resolved"]
    avg_ms = round(sum(r["ms"] for r in resolved) / len(resolved), 1) if resolved else 0

    return {
        "results": list(results),
        "summary": {
            "total": len(hostnames),
            "resolved": len(resolved),
            "nxdomain": len([r for r in results if r["status"] == "nxdomain"]),
            "errors": len([r for r in results if r["status"] == "error"]),
            "parallel_ms": total_ms,
            "sequential_estimate_ms": round(avg_ms * len(hostnames), 1),
            "speedup": round((avg_ms * len(hostnames)) / total_ms, 2) if total_ms > 0 else 1,
            "avg_ms_per_lookup": avg_ms,
        }
    }
