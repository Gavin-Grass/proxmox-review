#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly DEFAULT_CONFIG="/etc/proxmox-review.conf"
readonly DEFAULT_OUTPUT="./data/report.json"

CONFIG_PATH="$DEFAULT_CONFIG"
OUTPUT_PATH="$DEFAULT_OUTPUT"
CONFIG_EXPLICIT=0

usage() {
  cat <<'EOF'
Usage:
  export-proxmox-report.sh [--output ./data/report.json] [-c /etc/proxmox-review.conf]

Options:
  -c, --config PATH   Load configuration from PATH.
  -o, --output PATH   Write JSON report to PATH.
  -h, --help          Show this help text.
EOF
}

while (($# > 0)); do
  case "$1" in
    -c|--config)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      CONFIG_PATH="$2"
      CONFIG_EXPLICIT=1
      shift 2
      ;;
    -o|--output)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      OUTPUT_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -f "$CONFIG_PATH" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_PATH"
elif (( CONFIG_EXPLICIT == 1 )); then
  echo "Configuration file not found: $CONFIG_PATH" >&2
  exit 1
fi

NODE_LABEL="${NODE_LABEL:-proxmox-node}"
CPU_ALERT_PERCENT="${CPU_ALERT_PERCENT:-90}"
MEMORY_ALERT_PERCENT="${MEMORY_ALERT_PERCENT:-90}"
SWAP_ALERT_PERCENT="${SWAP_ALERT_PERCENT:-25}"
ROOT_FS_ALERT_PERCENT="${ROOT_FS_ALERT_PERCENT:-85}"
INCLUDE_ZFS="${INCLUDE_ZFS:-1}"
INCLUDE_VM_COUNTS="${INCLUDE_VM_COUNTS:-1}"
INCLUDE_LXC_COUNTS="${INCLUDE_LXC_COUNTS:-1}"
INCLUDE_PVE_SERVICES="${INCLUDE_PVE_SERVICES:-1}"

readonly GENERATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

json_escape() {
  local text="$1"
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  text=${text//$'\n'/\\n}
  text=${text//$'\r'/\\r}
  text=${text//$'\t'/\\t}
  printf '%s' "$text"
}

read_cpu_totals() {
  local cpu user nice system idle iowait irq softirq steal guest guest_nice
  read -r cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat

  local total=$((user + nice + system + idle + iowait + irq + softirq + steal + guest + guest_nice))
  local idle_total=$((idle + iowait))
  printf '%s %s\n' "$total" "$idle_total"
}

cpu_usage_percent() {
  local total1 idle1 total2 idle2 total_delta idle_delta
  read -r total1 idle1 < <(read_cpu_totals)
  sleep 1
  read -r total2 idle2 < <(read_cpu_totals)

  total_delta=$((total2 - total1))
  idle_delta=$((idle2 - idle1))

  if (( total_delta <= 0 )); then
    echo 0
    return
  fi

  echo $(( (100 * (total_delta - idle_delta)) / total_delta ))
}

uptime_pretty() {
  local total_seconds days hours minutes
  total_seconds="$(cut -d. -f1 /proc/uptime)"
  days=$((total_seconds / 86400))
  hours=$(((total_seconds % 86400) / 3600))
  minutes=$(((total_seconds % 3600) / 60))
  printf '%sd %sh %sm' "$days" "$hours" "$minutes"
}

meminfo_value() {
  local key="$1"
  awk -v k="$key" '$1 == k ":" {print $2; exit}' /proc/meminfo
}

root_fs_stats() {
  df -P -B1 / | awk 'NR == 2 {gsub(/%/, "", $5); print $2, $3, $4, $5}'
}

hot_filesystem_count() {
  df -P -x tmpfs -x devtmpfs | awk -v threshold="$ROOT_FS_ALERT_PERCENT" '
    NR > 1 {
      gsub(/%/, "", $5)
      if ($5 >= threshold) {
        count++
      }
    }
    END {print count + 0}
  '
}

count_guest_states() {
  local conf_dir="$1"
  local tool="$2"
  local total=0
  local running=0
  local conf_file guest_id status_line
  local files=()

  if [[ -d "$conf_dir" ]]; then
    shopt -s nullglob
    files=("$conf_dir"/*.conf)
    shopt -u nullglob
  fi

  for conf_file in "${files[@]}"; do
    guest_id="${conf_file##*/}"
    guest_id="${guest_id%.conf}"
    total=$((total + 1))

    if status_line="$("$tool" status "$guest_id" 2>/dev/null)" && [[ "$status_line" == *"running"* ]]; then
      running=$((running + 1))
    fi
  done

  printf '%s %s\n' "$total" "$running"
}

zfs_health_counts() {
  local total=0
  local unhealthy=0
  local health

  if ! have_cmd zpool; then
    printf '0 0\n'
    return
  fi

  while IFS= read -r health; do
    [[ -n "$health" ]] || continue
    total=$((total + 1))
    if [[ "$health" != "ONLINE" ]]; then
      unhealthy=$((unhealthy + 1))
    fi
  done < <(zpool list -H -o health 2>/dev/null || true)

  printf '%s %s\n' "$total" "$unhealthy"
}

core_service_counts() {
  local active=0
  local inactive=0
  local service load_state
  local services=(pve-cluster pvedaemon pveproxy pvestatd)

  if ! have_cmd systemctl; then
    printf '0 0\n'
    return
  fi

  for service in "${services[@]}"; do
    load_state="$(systemctl show -p LoadState --value "$service" 2>/dev/null || true)"
    [[ "$load_state" == "loaded" ]] || continue

    if systemctl is-active --quiet "$service"; then
      active=$((active + 1))
    else
      inactive=$((inactive + 1))
    fi
  done

  printf '%s %s\n' "$active" "$inactive"
}

declare -a ALERTS=()

append_alert() {
  ALERTS+=("$1")
}

cpu_percent="$(cpu_usage_percent)"
cpu_cores="$(nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo)"
read -r load1 load5 load15 _ < /proc/loadavg

mem_total_kb="$(meminfo_value MemTotal)"
mem_available_kb="$(meminfo_value MemAvailable)"
mem_used_kb=$((mem_total_kb - mem_available_kb))
mem_used_percent=$((100 * mem_used_kb / mem_total_kb))

swap_total_kb="$(meminfo_value SwapTotal)"
swap_free_kb="$(meminfo_value SwapFree)"
swap_used_kb=$((swap_total_kb - swap_free_kb))
swap_used_percent=0
swap_enabled=false
if (( swap_total_kb > 0 )); then
  swap_enabled=true
  swap_used_percent=$((100 * swap_used_kb / swap_total_kb))
fi

read -r root_total_bytes root_used_bytes root_avail_bytes root_used_percent < <(root_fs_stats)
root_hot_count="$(hot_filesystem_count)"

vm_total=0
vm_running=0
if (( INCLUDE_VM_COUNTS == 1 )) && have_cmd qm; then
  read -r vm_total vm_running < <(count_guest_states /etc/pve/qemu-server qm)
fi

lxc_total=0
lxc_running=0
if (( INCLUDE_LXC_COUNTS == 1 )) && have_cmd pct; then
  read -r lxc_total lxc_running < <(count_guest_states /etc/pve/lxc pct)
fi

zfs_total=0
zfs_unhealthy=0
if (( INCLUDE_ZFS == 1 )); then
  read -r zfs_total zfs_unhealthy < <(zfs_health_counts)
fi

services_active=0
services_inactive=0
if (( INCLUDE_PVE_SERVICES == 1 )); then
  read -r services_active services_inactive < <(core_service_counts)
fi

if (( cpu_percent >= CPU_ALERT_PERCENT )); then
  append_alert "CPU usage is above threshold: ${cpu_percent}%"
fi
if (( mem_used_percent >= MEMORY_ALERT_PERCENT )); then
  append_alert "Memory usage is above threshold: ${mem_used_percent}%"
fi
if (( swap_total_kb > 0 && swap_used_percent >= SWAP_ALERT_PERCENT )); then
  append_alert "Swap usage is above threshold: ${swap_used_percent}%"
fi
if (( root_used_percent >= ROOT_FS_ALERT_PERCENT )); then
  append_alert "Root filesystem usage is above threshold: ${root_used_percent}%"
fi
if (( root_hot_count > 0 )); then
  append_alert "${root_hot_count} filesystem(s) are at or above ${ROOT_FS_ALERT_PERCENT}% usage"
fi
if (( zfs_unhealthy > 0 )); then
  append_alert "${zfs_unhealthy} ZFS pool(s) are not ONLINE"
fi
if (( services_inactive > 0 )); then
  append_alert "${services_inactive} Proxmox core service(s) are inactive"
fi

overall_status="ok"
if ((${#ALERTS[@]} > 0)); then
  overall_status="warning"
fi
if (( services_inactive > 0 || zfs_unhealthy > 0 )); then
  overall_status="critical"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

{
  cat <<EOF
{
  "site": {
    "title": "Proxmox Review Board",
    "generated_at": "$GENERATED_AT",
    "node_label": "$(json_escape "$NODE_LABEL")",
    "privacy_mode": "sanitized-static-report",
    "overall_status": "$overall_status"
  },
  "summary": {
    "cpu_percent": $cpu_percent,
    "cpu_cores": $cpu_cores,
    "load": [$load1, $load5, $load15],
    "uptime": "$(uptime_pretty)",
    "memory": {
      "used_bytes": $((mem_used_kb * 1024)),
      "total_bytes": $((mem_total_kb * 1024)),
      "used_percent": $mem_used_percent
    },
    "swap": {
      "enabled": $swap_enabled,
      "used_bytes": $((swap_used_kb * 1024)),
      "total_bytes": $((swap_total_kb * 1024)),
      "used_percent": $swap_used_percent
    },
    "root_fs": {
      "used_bytes": $root_used_bytes,
      "total_bytes": $root_total_bytes,
      "available_bytes": $root_avail_bytes,
      "used_percent": $root_used_percent
    },
    "filesystems_above_threshold": $root_hot_count,
    "virtual_machines": {
      "running": $vm_running,
      "total": $vm_total
    },
    "containers": {
      "running": $lxc_running,
      "total": $lxc_total
    },
    "zfs": {
      "unhealthy": $zfs_unhealthy,
      "total": $zfs_total
    },
    "services": {
      "active": $services_active,
      "inactive": $services_inactive
    }
  },
  "alerts": [
EOF

  if ((${#ALERTS[@]} == 0)); then
    printf '    "No active threshold alerts"\n'
  else
    for i in "${!ALERTS[@]}"; do
      suffix=","
      if [[ "$i" == "$((${#ALERTS[@]} - 1))" ]]; then
        suffix=""
      fi
      printf '    "%s"%s\n' "$(json_escape "${ALERTS[$i]}")" "$suffix"
    done
  fi

  cat <<'EOF'
  ],
  "privacy": [
    "Hostnames, FQDNs, IPs, MAC addresses, serial numbers, and usernames are excluded.",
    "Guest names and guest IDs are not published; only running and total counts are shown.",
    "Storage and ZFS data are summarized without revealing pool names or datastore names."
  ]
}
EOF
} > "$OUTPUT_PATH"

printf 'Wrote sanitized report to %s\n' "$OUTPUT_PATH"

