import datetime

from fastapi import APIRouter, HTTPException

from backend import state
from backend.config import CACHE_TTL

router = APIRouter(prefix="/api/cache")


@router.get("/entries")
async def get_cache_entries():
    now = datetime.datetime.now()
    entries = []
    with state.dns_cache._lock:
        for hostname, record in state.dns_cache.cache.items():
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


@router.delete("/entries/{hostname:path}")
async def evict_cache_entry(hostname: str):
    with state.dns_cache._lock:
        if hostname in state.dns_cache.cache:
            del state.dns_cache.cache[hostname]
            return {"ok": True}
    raise HTTPException(404, f"{hostname} not in cache")


@router.delete("/entries")
async def clear_cache():
    with state.dns_cache._lock:
        state.dns_cache.cache.clear()
    return {"ok": True}
