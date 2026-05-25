# localdig

A DNS infrastructure simulator built from scratch in Python (no DNS libraries, no abstractions). Raw TCP sockets, a recursive resolver, multithreaded nameservers, and a real-time web dashboard.

**[Live Demo](https://localdig.pages.dev)** runs in-browser with pre-recorded data. Clone the repo to run the full stack locally.

---

## Overview

The full DNS resolution chain (root, TLD, and authoritative nameservers) is implemented over raw TCP sockets. `launcher.py` splits a master record file into per-server configs and spawns each as a `server.py` process. `recursor.py` iterates over DNS servers, caches results with a TTL, and expires stale records on a background thread.

Servers handle concurrent connections via a thread-per-connection model, with a `threading.Lock` guarding shared record state. The cache is a TTL-keyed HashMap, repeated lookups drop from O(n) to O(1) and are benchmarked across query volumes up to 2,800.

The web dashboard streams each resolution hop over WebSocket in real time, namely root query, TLD query, authoritative query or cache hit. Also includes a concurrent stress test that fires N lookups via `asyncio.gather` to show parallel vs. sequential server throughput.

---

## Benchmarking

| Queries | No cache (ms/q) | With cache (ms/q) | Speedup |
|---|---|---|---|
| 14 | 4.64 | 4.13 | 1.12x |
| 140 | 0.56 | 0.49 | 1.16x |
| 560 | 0.43 | 0.22 | 1.95x |
| 1,400 | 0.41 | 0.12 | 3.42x |
| 2,800 | 0.40 | 0.08 | 5.00x |

Per-query latency flattens with caching while growing linearly without. The gap widens asymptotically.

---

## Stack

| | |
|---|---|
| DNS core | Python, raw TCP sockets, `threading` |
| Backend | FastAPI, uvicorn, WebSockets, `asyncio` |
| Frontend | React 18, Vite, Recharts |
| Deployment | Cloudflare Pages |

---

## Setup

**Prerequisites:** Python 3.11+, Node.js 18+

```bash
# launch DNS infrastructure
python3 core/launcher.py db/master.conf db/singles

# CLI resolver
python3 cpre/recursor.py <root_port> <timeout> [<bypass_cache>]

# web dashboard - backend
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# web dashboard - frontend
cd frontend && npm install && npm run dev
```

---

## Web dashboard

| View | |
|---|---|
| Dashboard | Launch/teardown infrastructure, live server summary |
| DNS Lookup | Animated resolution trace: root → TLD → auth, cache hits highlighted |
| Cache | Live TTL countdown bars, per-entry expiry |
| Servers | Running servers with clickable record navigation |
| Records | `!ADD` / `!DEL` commands sent directly to running servers |
| Benchmark | Cache benchmark chart + concurrent stress test with speedup visualisation |

---

## Limitations

Known simplifications relative to real-world DNS. Strikethrough items have been addressed.

- ~~Runtime record changes are not persisted~~
- ~~DNS resolution is not cached~~
- ~~Servers are single-threaded~~
- NXDOMAIN responses are final — no retry against alternative servers
- Only A record equivalents — no CNAME, MX, or AAAA
- No server redundancy or failover
- Plaintext socket communication — no TLS, no protection against spoofing or cache poisoning
- Ports substitute for IP addresses to avoid physical networking requirements