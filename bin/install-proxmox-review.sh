#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly DEFAULT_ENV_PATH="/etc/proxmox-review/proxmox-review.env"
readonly DEFAULT_SERVICE_PATH="/etc/systemd/system/proxmox-review-sync.service"
readonly DEFAULT_TIMER_PATH="/etc/systemd/system/proxmox-review-sync.timer"
readonly DEFAULT_SYNC_TARGET="/usr/local/bin/proxmox-review-sync.sh"

usage() {
  cat <<'EOF'
Usage:
  install-proxmox-review.sh [options]

Options:
  --env PATH          Environment file path. Default: /etc/proxmox-review/proxmox-review.env
  --repo-dir PATH     Git checkout to publish from. Default: current repo root
  --interval SECONDS  systemd timer interval. Default: 30
  --node-label LABEL  Public-safe label shown on the dashboard
  --git-name NAME     Git commit author name for the Proxmox node
  --git-email EMAIL   Git commit author email for the Proxmox node
  --branch NAME       Git branch to push. Default: current branch or main
  --remote NAME       Git remote to push. Default: origin
  --no-start          Install files but do not enable/start the timer
  --run-now           Run one sync immediately after installation
  -h, --help          Show this help text

Notes:
  - Run this on the Proxmox node after cloning the repo with working GitHub auth.
  - Sub-minute scheduling uses a systemd timer because cron cannot run every 30 seconds.
EOF
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  local cmd="$1"
  have_cmd "$cmd" || {
    echo "Missing required command: $cmd" >&2
    exit 1
  }
}

quote_shell_value() {
  printf '%q' "$1"
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local escaped
  local tmp_file
  local found=0

  escaped="$(quote_shell_value "$value")"
  tmp_file="$(mktemp)"

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s=%s\n' "$key" "$escaped" >> "$tmp_file"
      found=1
    else
      printf '%s\n' "$line" >> "$tmp_file"
    fi
  done < "$ENV_PATH"

  if (( found == 0 )); then
    printf '\n%s=%s\n' "$key" "$escaped" >> "$tmp_file"
  fi

  install -m 0640 "$tmp_file" "$ENV_PATH"
  rm -f "$tmp_file"
}

render_template() {
  local template_path="$1"
  local output_path="$2"
  local interval_value="$3"
  local tmp_file

  tmp_file="$(mktemp)"
  sed \
    -e "s|@ENV_PATH@|$ENV_PATH|g" \
    -e "s|@SYNC_INTERVAL@|$interval_value|g" \
    "$template_path" > "$tmp_file"
  install -m 0644 "$tmp_file" "$output_path"
  rm -f "$tmp_file"
}

ENV_PATH="$DEFAULT_ENV_PATH"
REPO_DIR_OVERRIDE=""
INTERVAL_OVERRIDE=""
NODE_LABEL_OVERRIDE=""
GIT_NAME_OVERRIDE=""
GIT_EMAIL_OVERRIDE=""
BRANCH_OVERRIDE=""
REMOTE_OVERRIDE=""
START_TIMER=1
RUN_NOW=0

while (($# > 0)); do
  case "$1" in
    --env)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      ENV_PATH="$2"
      shift 2
      ;;
    --repo-dir)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      REPO_DIR_OVERRIDE="$2"
      shift 2
      ;;
    --interval)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      INTERVAL_OVERRIDE="$2"
      shift 2
      ;;
    --node-label)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      NODE_LABEL_OVERRIDE="$2"
      shift 2
      ;;
    --git-name)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      GIT_NAME_OVERRIDE="$2"
      shift 2
      ;;
    --git-email)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      GIT_EMAIL_OVERRIDE="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      BRANCH_OVERRIDE="$2"
      shift 2
      ;;
    --remote)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      REMOTE_OVERRIDE="$2"
      shift 2
      ;;
    --no-start)
      START_TIMER=0
      shift
      ;;
    --run-now)
      RUN_NOW=1
      shift
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

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run this installer as root or with sudo." >&2
  exit 1
fi

require_cmd git
require_cmd install
require_cmd sed
require_cmd systemctl

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="$(dirname "$ENV_PATH")"
SERVICE_TEMPLATE="$REPO_ROOT/systemd/proxmox-review-sync.service"
TIMER_TEMPLATE="$REPO_ROOT/systemd/proxmox-review-sync.timer"

[[ -f "$REPO_ROOT/bin/export-proxmox-report.sh" ]] || {
  echo "Exporter not found in repo: $REPO_ROOT" >&2
  exit 1
}

[[ -f "$REPO_ROOT/bin/proxmox-review-sync.sh" ]] || {
  echo "Sync script not found in repo: $REPO_ROOT" >&2
  exit 1
}

[[ -f "$SERVICE_TEMPLATE" ]] || {
  echo "Service template not found: $SERVICE_TEMPLATE" >&2
  exit 1
}

[[ -f "$TIMER_TEMPLATE" ]] || {
  echo "Timer template not found: $TIMER_TEMPLATE" >&2
  exit 1
}

if [[ -n "$REPO_DIR_OVERRIDE" ]]; then
  REPO_DIR="$REPO_DIR_OVERRIDE"
else
  REPO_DIR="$REPO_ROOT"
fi

[[ -d "$REPO_DIR/.git" ]] || {
  echo "Repo directory is not a git checkout: $REPO_DIR" >&2
  exit 1
}

CURRENT_BRANCH="$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || true)"
CURRENT_REMOTE="origin"
if ! git -C "$REPO_DIR" remote get-url "$CURRENT_REMOTE" >/dev/null 2>&1; then
  CURRENT_REMOTE="$(git -C "$REPO_DIR" remote | head -n 1 || true)"
fi

mkdir -p "$ENV_DIR"

if [[ ! -f "$ENV_PATH" ]]; then
  install -m 0640 "$REPO_ROOT/config/proxmox-review.env.example" "$ENV_PATH"
fi

EXISTING_INTERVAL="$(sed -n 's/^SYNC_INTERVAL_SECONDS=//p' "$ENV_PATH" | tail -n 1)"
INTERVAL_VALUE="${INTERVAL_OVERRIDE:-${EXISTING_INTERVAL:-30}}"
[[ "$INTERVAL_VALUE" =~ ^[0-9]+$ ]] || {
  echo "--interval must be an integer number of seconds" >&2
  exit 1
}
(( INTERVAL_VALUE > 0 )) || {
  echo "--interval must be greater than 0" >&2
  exit 1
}

if [[ -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="main"
fi

if [[ -z "$CURRENT_REMOTE" ]]; then
  CURRENT_REMOTE="origin"
fi

if [[ -z "$GIT_NAME_OVERRIDE" ]]; then
  GIT_NAME_OVERRIDE="$(git -C "$REPO_DIR" config user.name 2>/dev/null || git config --global user.name 2>/dev/null || true)"
fi

if [[ -z "$GIT_EMAIL_OVERRIDE" ]]; then
  GIT_EMAIL_OVERRIDE="$(git -C "$REPO_DIR" config user.email 2>/dev/null || git config --global user.email 2>/dev/null || true)"
fi

upsert_env_var "REPO_DIR" "$REPO_DIR"
upsert_env_var "OUTPUT_RELATIVE_PATH" "data/report.json"
upsert_env_var "GIT_REMOTE" "${REMOTE_OVERRIDE:-$CURRENT_REMOTE}"
upsert_env_var "GIT_BRANCH" "${BRANCH_OVERRIDE:-$CURRENT_BRANCH}"
upsert_env_var "SYNC_INTERVAL_SECONDS" "$INTERVAL_VALUE"
upsert_env_var "AUTO_PUSH" "1"
upsert_env_var "GIT_PULL_BEFORE_PUSH" "1"
upsert_env_var "COMMIT_MESSAGE_PREFIX" "Update Proxmox report"

if [[ -n "$NODE_LABEL_OVERRIDE" ]]; then
  upsert_env_var "NODE_LABEL" "$NODE_LABEL_OVERRIDE"
fi

if [[ -n "$GIT_NAME_OVERRIDE" ]]; then
  upsert_env_var "GIT_AUTHOR_NAME" "$GIT_NAME_OVERRIDE"
fi

if [[ -n "$GIT_EMAIL_OVERRIDE" ]]; then
  upsert_env_var "GIT_AUTHOR_EMAIL" "$GIT_EMAIL_OVERRIDE"
fi

install -m 0755 "$REPO_ROOT/bin/proxmox-review-sync.sh" "$DEFAULT_SYNC_TARGET"
render_template "$SERVICE_TEMPLATE" "$DEFAULT_SERVICE_PATH" "$INTERVAL_VALUE"
render_template "$TIMER_TEMPLATE" "$DEFAULT_TIMER_PATH" "$INTERVAL_VALUE"

systemctl daemon-reload

if (( START_TIMER == 1 )); then
  systemctl enable --now proxmox-review-sync.timer
fi

if (( RUN_NOW == 1 )); then
  systemctl start proxmox-review-sync.service
fi

echo "Installed Proxmox Review automation."
echo "Environment file: $ENV_PATH"
echo "Repo directory: $REPO_DIR"
echo "Timer interval: ${INTERVAL_VALUE}s"

if grep -q '^GIT_AUTHOR_EMAIL=change-me@example\.com$' "$ENV_PATH"; then
  echo "Warning: update GIT_AUTHOR_EMAIL in $ENV_PATH before relying on automated commits."
fi

if (( START_TIMER == 1 )); then
  echo "Timer status:"
  systemctl --no-pager --full status proxmox-review-sync.timer || true
else
  echo "Timer files were installed but not started."
fi

echo
echo "Edit the environment file if needed, then rerun:"
echo "  systemctl restart proxmox-review-sync.timer"
echo
echo "Useful checks:"
echo "  systemctl status proxmox-review-sync.timer"
echo "  journalctl -u proxmox-review-sync.service -n 50 --no-pager"
