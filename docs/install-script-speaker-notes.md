# Install Script Speaker Notes

This is the short version of the installer explanation for class.

Use this when you do not want to explain every Bash detail line by line.
Each section includes a small example from the real script so you can point to code while you talk.

## 30-Second Version

The install script automates the full Proxmox setup for the project.

It:

1. checks that the script is running as root and that required tools exist
2. finds the repo and config file locations
3. creates or updates the private env file on the server
4. installs the sync script and `systemd` timer files
5. reloads `systemd`, starts the timer, and prints status

## 1. Setup And Safety

At the top, the script:

- tells Linux to use Bash
- turns on strict error handling
- defines default paths for the env file, service file, timer file, and sync script

Why that matters:

- the script fails fast instead of continuing with broken state
- all important file locations are stored once and reused later

Example from the script:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEFAULT_ENV_PATH="/etc/proxmox-review/proxmox-review.env"
readonly DEFAULT_SERVICE_PATH="/etc/systemd/system/proxmox-review-sync.service"
```

What to say:

"This part sets the shell, turns on strict mode, and defines the important file paths once so the rest of the script can reuse them."

## 2. Helper Functions

The script defines a few small helper functions:

- `usage`
  prints the help menu
- `have_cmd`
  checks whether a command exists
- `require_cmd`
  stops the script if a required tool is missing
- `quote_shell_value`
  safely escapes values before writing them into the env file
- `upsert_env_var`
  updates an env variable if it exists, or adds it if it does not
- `render_template`
  fills in placeholders inside the `systemd` template files

Why that matters:

- the main install flow stays readable
- repeated logic is kept in one place
- config edits are safer because they happen through a temp file first

Example from the script:

```bash
require_cmd() {
  local cmd="$1"
  have_cmd "$cmd" || {
    echo "Missing required command: $cmd" >&2
    exit 1
  }
}
```

What to say:

"Instead of writing the same check over and over, the script wraps it in a helper function. That keeps the main flow cleaner."

## 3. Reading Command Options

The script accepts optional flags like:

- `--env`
- `--repo-dir`
- `--interval`
- `--node-label`
- `--git-name`
- `--git-email`
- `--branch`
- `--remote`
- `--no-start`
- `--run-now`

Why that matters:

- the same installer can work in slightly different environments
- the user can override defaults without editing the script

Example from the script:

```bash
while (($# > 0)); do
  case "$1" in
    --interval)
      INTERVAL_OVERRIDE="$2"
      shift 2
      ;;
```

What to say:

"This is the argument parser. It lets the script accept options like a custom timer interval without changing the file itself."

## 4. Root And Dependency Checks

Before it changes anything, the script checks:

- it is running as root or with `sudo`
- `git` exists
- `install` exists
- `sed` exists
- `systemctl` exists

Why that matters:

- installing files into `/etc/systemd/system` needs root
- the script depends on those commands to finish correctly

Example from the script:

```bash
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run this installer as root or with sudo." >&2
  exit 1
fi

require_cmd git
require_cmd systemctl
```

What to say:

"Before it installs anything, it checks that it has admin rights and that the required commands are actually available."

## 5. Finding The Repo And Templates

The script then:

- finds its own folder
- calculates the repo root
- points to the `systemd` template files inside the repo
- confirms the exporter, sync script, and templates actually exist

Why that matters:

- it avoids half-installing if the repo is incomplete
- it makes the script portable inside the repo

Example from the script:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_TEMPLATE="$REPO_ROOT/systemd/proxmox-review-sync.service"
```

What to say:

"This part figures out where the script is running from, then builds the repo paths from that so it can find the template files."

## 6. Building The Real Env File

Next, the script:

- creates `/etc/proxmox-review` if needed
- copies the example env file if the real one does not exist
- reads the current interval from that env file if it already exists
- chooses final values for repo path, branch, remote, interval, and git identity
- writes those values into the env file

Why that matters:

- private settings stay on the Proxmox server
- rerunning the installer updates config instead of blowing it away
- the env file becomes the single source of truth

Example from the script:

```bash
if [[ ! -f "$ENV_PATH" ]]; then
  install -m 0640 "$REPO_ROOT/config/proxmox-review.env.example" "$ENV_PATH"
fi

upsert_env_var "REPO_DIR" "$REPO_DIR"
upsert_env_var "SYNC_INTERVAL_SECONDS" "$INTERVAL_VALUE"
```

What to say:

"If the real env file does not exist yet, the installer creates it from the safe template. After that, it writes the final settings into that file."

## 7. Installing Automation

After the env file is ready, the script:

- installs the sync script into `/usr/local/bin`
- renders the service template into a real `.service` file
- renders the timer template into a real `.timer` file

Why that matters:

- `systemd` needs final installed files, not repo templates
- the timer interval and env path get baked into the final unit files

Example from the script:

```bash
install -m 0755 "$REPO_ROOT/bin/proxmox-review-sync.sh" "$DEFAULT_SYNC_TARGET"
render_template "$SERVICE_TEMPLATE" "$DEFAULT_SERVICE_PATH" "$INTERVAL_VALUE"
render_template "$TIMER_TEMPLATE" "$DEFAULT_TIMER_PATH" "$INTERVAL_VALUE"
```

What to say:

"Here the installer copies the sync script into a normal system path, then converts the repo templates into real systemd files."

## 8. Activating The Timer

At the end, the script:

- reloads `systemd`
- enables and starts the timer
- optionally runs one sync right away
- prints useful status and troubleshooting commands

Why that matters:

- `systemd` must reload to notice new unit files
- the user gets immediate confirmation that the install worked

Example from the script:

```bash
systemctl daemon-reload
systemctl enable --now proxmox-review-sync.timer

if (( RUN_NOW == 1 )); then
  systemctl start proxmox-review-sync.service
fi
```

What to say:

"At the end, the script reloads systemd, enables the timer, and can optionally run the sync once right away so the user sees it work."

## Easy Way To Say It Out Loud

If your teacher wants the short explanation:

"This installer takes a manual Proxmox setup and turns it into one command. It checks the environment, creates the private config file, installs the sync automation, enables the timer, and shows the status so I can verify it worked."

## Best Demo Flow

If you want the presentation to feel smooth:

1. Start with the 30-second version.
2. Show one code example from each section instead of every line.
3. Emphasize privacy, automation, and why `systemd` was used instead of cron.
4. End by showing that the timer starts and that the status command confirms it worked.

## What Makes It Good

- It keeps private config out of GitHub.
- It uses `systemd` because cron cannot run every 30 seconds.
- It validates files and commands before installing.
- It is safe to rerun because it updates the env file instead of rebuilding everything from scratch.
