#!/usr/bin/env python3
"""
scripts/system-check.py
Sentinel Global Audit — Deep Scan CLI

Pings all 10 microservices on their health endpoints, checks response latencies,
and queries Docker stats for real-time memory usage.
Outputs a bank-grade CLI table constraint.
"""

import urllib.request
import urllib.error
import time
import subprocess
import json
import sys

# Color consts
C_RESET = "\033[0m"
C_GREEN = "\033[32m"
C_RED   = "\033[31m"
C_YELLOW= "\033[33m"
C_BLUE  = "\033[36m"
C_BOLD  = "\033[1m"

SERVICES = {
    "router-service":    4000,
    "enforcer-service":  4001,
    "vault-service":     4002,
    "usage-service":     4003,
    "sanitizer-service": 4004,
    "trust-service":     4005,
    "memory-service":    4007,
    "policy-service":    4008,
    "workflow-service":  4009,
    "web-frontend":      3000
}

def get_docker_ram():
    """Returns a dict of {container_name: mem_percentage_string}"""
    try:
        # --format "{{.Name}}|{{.MemPerc}}" outputs like: streetmp_enforcer_prod|1.24%
        res = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.MemPerc}}"],
            capture_output=True, text=True, check=True
        )
        stats = {}
        for line in res.stdout.strip().split("\n"):
            if not line: continue
            parts = line.split("|")
            if len(parts) == 2:
                # Approximate service name from container name (e.g. streetmp_router-service_prod)
                name = parts[0]
                perc = parts[1]
                for s in SERVICES.keys():
                    if s.replace("-", "") in name.replace("-", "") or s.split("-")[0] in name:
                        stats[s] = perc
        return stats
    except Exception:
        return {}

def check_service(name, port):
    url = f"http://localhost:{port}/health"
    if name == "web-frontend":
        url = f"http://localhost:{port}/api/health" # Assuming Next.js has a basic API health route or just check root
        url = f"http://localhost:{port}"

    start_time = time.time()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as response:
            status = response.getcode()
            latency_ms = int((time.time() - start_time) * 1000)
            return status, latency_ms
    except urllib.error.URLError as e:
        if hasattr(e, 'code'):
            latency_ms = int((time.time() - start_time) * 1000)
            return e.code, latency_ms
        return "DOWN", -1
    except Exception:
        return "DOWN", -1

def main():
    print(f"\n{C_BLUE}{C_BOLD}► STREETMP OS — SENTINEL GLOBAL AUDIT{C_RESET}")
    print(f"Scanning {len(SERVICES)} core microservices...\n")

    docker_stats = get_docker_ram()

    # Header
    print(f"{C_BOLD}{'SERVICE':<20} | {'PORT':<6} | {'STATUS':<8} | {'LATENCY':<8} | {'RAM %':<8}{C_RESET}")
    print("-" * 60)

    failed_count = 0

    for name, port in SERVICES.items():
        status, latency = check_service(name, port)
        ram = docker_stats.get(name, "N/A")

        # Formatting
        lat_str = f"{latency}ms" if latency >= 0 else "---"
        lat_color = C_GREEN if latency < 100 else C_YELLOW if latency < 500 else C_RED
        if latency < 0: lat_color = C_RED

        status_str = str(status)
        if status in [200, 307, 308]:
            stat_color = C_GREEN
            status_str = "OK"
        else:
            stat_color = C_RED
            failed_count += 1
            if status_str == "DOWN": status_str = "FAIL"

        print(f"{name:<20} | {port:<6} | {stat_color}{status_str:<8}{C_RESET} | {lat_color}{lat_str:<8}{C_RESET} | {ram:<8}")

    print("-" * 60)
    if failed_count == 0:
        print(f"{C_GREEN}{C_BOLD}✓ All {len(SERVICES)} microservices are healthy and responding.{C_RESET}\n")
    else:
        print(f"{C_RED}{C_BOLD}⚠ {failed_count} microservices failed health checks.{C_RESET}\n")

if __name__ == "__main__":
    main()
