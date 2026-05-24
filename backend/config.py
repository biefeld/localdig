from pathlib import Path

ROOT_DIR   = Path(__file__).parent.parent
MASTER_CONF = ROOT_DIR / "db" / "master.conf"
SINGLES_DIR = ROOT_DIR / "db" / "singles"

SINGLES_DIR.mkdir(parents=True, exist_ok=True)

CACHE_TTL = 30.0   # seconds
