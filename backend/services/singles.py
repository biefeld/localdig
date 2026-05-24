from pathlib import Path


def read_singles(singles_dir: Path) -> list[dict]:
    """Parse all .conf files in singles_dir into server descriptors."""
    servers = []
    for conf in sorted(singles_dir.glob("*.conf")):
        lines = conf.read_text().strip().splitlines()
        if not lines:
            continue
        port = int(lines[0].strip())
        records = []
        for line in lines[1:]:
            line = line.strip()
            if "," in line:
                host, rport = line.rsplit(",", 1)
                records.append({"hostname": host.strip(), "port": int(rport.strip())})
        name = conf.stem
        if name == "root":
            kind = "root"
        elif name.startswith("tld-"):
            kind = "tld"
        elif name.startswith("auth-"):
            kind = "auth"
        else:
            kind = "unknown"
        servers.append({"name": name, "kind": kind, "port": port, "records": records, "conf": str(conf)})
    return servers


def parse_benchmark_output(output: str) -> list[dict]:
    """Parse the benchmark text summary into structured data."""
    results = []
    current: dict = {}
    for line in output.splitlines():
        line = line.strip()
        if "Total queries per phase" in line:
            if current:
                results.append(current)
            current = {"queries": int(line.split(":")[-1].strip())}
        elif "Without caching" in line:
            parts = line.split()
            current["without_cache_s"] = float(parts[3].replace("s", ""))
            current["without_cache_ms_per"] = float(parts[4].strip("(ms/query)"))
        elif "With caching" in line and "Speedup" not in line:
            parts = line.split()
            current["with_cache_s"] = float(parts[3].replace("s", ""))
            current["with_cache_ms_per"] = float(parts[4].strip("(ms/query)"))
        elif "Speedup" in line:
            current["speedup"] = float(line.split()[2].replace("x", ""))
    if current:
        results.append(current)
    return results
