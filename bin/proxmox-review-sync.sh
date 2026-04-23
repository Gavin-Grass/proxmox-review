#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly DEFAULT_ENV="/etc/proxmox-review/proxmox-review.env"

usage() {
  cat <<'EOF'
Usage:
  proxmox-review-sync.sh [--env /etc/proxmox-review/proxmox-review.env]

Runs the sanitized Proxmox exporter, commits data/report.json, and pushes it.
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

ENV_PATH="$DEFAULT_ENV"

while (($# > 0)); do
  case "$1" in
    -e|--env)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      ENV_PATH="$2"
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

[[ -f "$ENV_PATH" ]] || {
  echo "Environment file not found: $ENV_PATH" >&2
  exit 1
}

# shellcheck disable=SC1090
source "$ENV_PATH"

REPO_DIR="${REPO_DIR:-}"
OUTPUT_RELATIVE_PATH="${OUTPUT_RELATIVE_PATH:-data/report.json}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-}"
GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-}"
COMMIT_MESSAGE_PREFIX="${COMMIT_MESSAGE_PREFIX:-Update Proxmox report}"
AUTO_PUSH="${AUTO_PUSH:-1}"
GIT_PULL_BEFORE_PUSH="${GIT_PULL_BEFORE_PUSH:-1}"
EXPORTER_PATH="${EXPORTER_PATH:-}"

[[ -n "$REPO_DIR" ]] || {
  echo "REPO_DIR must be set in $ENV_PATH" >&2
  exit 1
}

if [[ -z "$EXPORTER_PATH" ]]; then
  EXPORTER_PATH="$REPO_DIR/bin/export-proxmox-report.sh"
fi

if [[ "$GIT_AUTHOR_EMAIL" == "change-me@example.com" ]]; then
  GIT_AUTHOR_EMAIL=""
fi

require_cmd bash
require_cmd git

[[ -d "$REPO_DIR/.git" ]] || {
  echo "REPO_DIR is not a git repository: $REPO_DIR" >&2
  exit 1
}

[[ -f "$EXPORTER_PATH" ]] || {
  echo "Exporter script not found: $EXPORTER_PATH" >&2
  exit 1
}

cd "$REPO_DIR"

if [[ -n "$GIT_AUTHOR_NAME" ]]; then
  git config user.name "$GIT_AUTHOR_NAME"
fi

if [[ -n "$GIT_AUTHOR_EMAIL" ]]; then
  git config user.email "$GIT_AUTHOR_EMAIL"
fi

mapfile -t dirty_lines < <(git status --porcelain --untracked-files=no)
for line in "${dirty_lines[@]}"; do
  path="${line:3}"
  if [[ "$path" != "$OUTPUT_RELATIVE_PATH" ]]; then
    echo "Refusing to sync: local changes exist outside $OUTPUT_RELATIVE_PATH" >&2
    exit 1
  fi
done

if (( GIT_PULL_BEFORE_PUSH == 1 )) && ((${#dirty_lines[@]} == 0)); then
  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
fi

OUTPUT_PATH="$REPO_DIR/$OUTPUT_RELATIVE_PATH"
bash "$EXPORTER_PATH" -c "$ENV_PATH" -o "$OUTPUT_PATH"

git add -- "$OUTPUT_RELATIVE_PATH"

if git diff --cached --quiet -- "$OUTPUT_RELATIVE_PATH"; then
  echo "No report changes to commit."
  exit 0
fi

timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
git commit -m "$COMMIT_MESSAGE_PREFIX $timestamp"

if (( AUTO_PUSH == 1 )); then
  git push "$GIT_REMOTE" "$GIT_BRANCH"
else
  echo "Committed locally. AUTO_PUSH=0, so no push was attempted."
fi
