"""
DNS Benchmarking Driver
Compares cached vs non-cached resolution performance.

Usage: python3 driver.py [master_file] [singles_dir] [cache_ttl]
"""

import subprocess
import socket
import sys
import time
import os
import matplotlib.pyplot as plt

MASTER_FILE  = sys.argv[1] if len(sys.argv) > 1 else "master.conf"
SINGLES_DIR  = sys.argv[2] if len(sys.argv) > 2 else "singles"
CACHE_TTL    = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
REPEATS      = [1, 10, 50, 100]
TIMEOUT      = 5.0
STARTUP_WAIT = 1.5
CONNECT_TRIES  = 10
CONNECT_DELAY  = 0.3

def read_master(path):
    """Return (root_port, [hostnames]) from master.conf."""
    with open(path) as f:
        lines = [l.strip() for l in f if l.strip()]
    root_port = int(lines[0])
    hostnames = [l.split(",")[0] for l in lines[1:]]
    return root_port, hostnames


def validate_connection(root_port):
    """Try to open a TCP connection to the root server."""
    for _ in range(CONNECT_TRIES):
        try:
            with socket.create_connection(("127.0.0.1", root_port), timeout=2):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(CONNECT_DELAY)
    return False


def launch_servers(root_port):
    """Start launcher.py and wait for servers to be ready."""
    proc = subprocess.Popen(
        ["python3", "launcher.py", MASTER_FILE, SINGLES_DIR],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(STARTUP_WAIT)
    if proc.poll() is not None:
        print("  ERROR: launcher.py exited early.")
        sys.exit(1)
    return proc


def stop_servers(proc, label):
    os.system("pgrep -fl Python | awk '!/driver\.py/{print $1}' | xargs kill ")


def run_phase(label, cmd, hostnames, root_port, repeat):
    """Feed hostnames×repeats into the recursor and return elapsed time."""
    # print(f"\n{'='*60}")
    # print(f"  PHASE: {label}")
    # print(f"  Command: {' '.join(cmd)}")
    # print(f"  Lookups: {len(hostnames)} hostnames x {repeats} rounds = "
    #       f"{len(hostnames) * repeats} queries")
    # print(f"{'='*60}")

    # print(f"  Validating connection to root (port {root_port})...", end=" ")
    if not validate_connection(root_port):
        print("FAILED - root server not reachable. Aborting.")
        sys.exit(1)
    # print("OK")

    queries = hostnames * repeat
    stdin_data = "\n".join(queries) + "\n"

    start = time.perf_counter()
    proc = subprocess.run(
        cmd,
        input=stdin_data,
        capture_output=True,
        text=True,
    )
    elapsed = time.perf_counter() - start

    responses = proc.stdout.strip().split("\n") if proc.stdout.strip() else []
    # print(f"\n  Sample responses (first 10):")
    # for r in responses[:10]:
    #     print(f"    {r}")
    # if len(responses) > 10:
    #     print(f"    ... ({len(responses)} total)")

    if proc.stderr.strip():
        print(f"\n  Stderr: {proc.stderr}")

    # print(f"\n  {label} completed in {elapsed:.4f}s "
    #       f"({elapsed / len(queries) * 1000:.2f} ms/query avg)")
    return elapsed


def execute(repeat):
    if not os.path.exists(MASTER_FILE):
        print(f"master file '{MASTER_FILE}' not found.")
        sys.exit(1)

    root_port, hostnames = read_master(MASTER_FILE)

    # print("=" * 60)
    # print("  DNS CACHING BENCHMARK DRIVER")
    # print("=" * 60)
    # print(f"  Master file : {MASTER_FILE}")
    # print(f"  Singles dir : {SINGLES_DIR}")
    # print(f"  Root port   : {root_port}")
    # print(f"  Hostnames   : {hostnames}")
    # print(f"  Repeat     : {repeat}")
    # print(f"  Cache TTL   : {CACHE_TTL}s")

    # Without caching
    launcher = launch_servers(root_port)
    no_cache_cmd = [
        "python3", "benchmarking/recursor_no_caching.py",
        str(root_port), str(TIMEOUT)
    ]
    no_cache_time = run_phase("WITHOUT CACHING", no_cache_cmd, hostnames, root_port, repeat)
    stop_servers(launcher, "no-cache phase")

    time.sleep(0.5)

    # With caching
    launcher = launch_servers(root_port)
    cached_cmd = [
        "python3", "benchmarking/recursor_caching.py",
        str(root_port), str(TIMEOUT), str(CACHE_TTL)
    ]
    cached_time = run_phase("WITH CACHING", cached_cmd, hostnames, root_port, repeat)
    stop_servers(launcher, "cached phase")

    total_queries = len(hostnames) * repeat
    speedup = no_cache_time / cached_time if cached_time > 0 else float("inf")


    return total_queries, no_cache_time, cached_time, speedup


def generate_graph(data):

    x = [a[0] for a in data]
    y1 = [a[1] for a in data]
    y2 = [a[2] for a in data]

    plt.plot(x, y1, label='no cache')
    plt.plot(x, y2, label='cache')

    plt.xlabel("Number of queries")
    plt.ylabel("Time (seconds)")
    plt.title("Caching DNS records is faster")
    plt.legend()
    plt.grid(True)

    plt.show()


def main():

    data = []
    print(f"\n{'='*60}")
    print(f"  BENCHMARK SUMMARY")
    print(f"{'='*60}")
    for repeat in REPEATS:
        total_queries, no_cache_time, cached_time, speedup = execute(repeat)

        print(f"  Total queries per phase : {total_queries}")
        print(f"  Without caching         : {no_cache_time:.4f}s  "
            f"({no_cache_time / total_queries * 1000:.2f} ms/query)")
        print(f"  With caching            : {cached_time:.4f}s  "
            f"({cached_time / total_queries * 1000:.2f} ms/query)")
        print(f"  Speedup                 : {speedup:.2f}x faster with cache")
        print(f"  Time saved              : {no_cache_time - cached_time:.4f}s")

        data.append([total_queries, no_cache_time, cached_time])


        total_queries, no_cache_time, cached_time, speedup = None, None, None, None



        print(f"{'='*60}\n")


    generate_graph(data)

if __name__ == "__main__":
    main()