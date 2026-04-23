# Install Script Line-By-Line

This guide explains [bin/install-proxmox-review.sh](../bin/install-proxmox-review.sh) in plain English.

Use it like a class script:

- say what the line does
- say why the script needs it
- move on without getting stuck in shell syntax

## Fast Summary

The installer does five big jobs:

1. checks that it is running as root and that required tools exist
2. figures out where the repo and config files live
3. creates or updates the Proxmox env file
4. installs the sync script and `systemd` unit files
5. reloads `systemd`, starts the timer, and prints status

## Line-By-Line Notes

### Lines 1-9

- `1` `#!/usr/bin/env bash`
  This tells Linux to run the script with Bash.
- `2` `set -Eeuo pipefail`
  This makes the script stricter so it stops on errors instead of silently continuing.
- `3` blank line
  This is just spacing to make the file easier to read.
- `4` `readonly SCRIPT_NAME="${0##*/}"`
  This stores the script filename by itself, without the full path.
- `5` `readonly DEFAULT_ENV_PATH="/etc/proxmox-review/proxmox-review.env"`
  This is the default location for the real server config file.
- `6` `readonly DEFAULT_SERVICE_PATH="/etc/systemd/system/proxmox-review-sync.service"`
  This is where the installer will place the `systemd` service file.
- `7` `readonly DEFAULT_TIMER_PATH="/etc/systemd/system/proxmox-review-sync.timer"`
  This is where the installer will place the `systemd` timer file.
- `8` `readonly DEFAULT_SYNC_TARGET="/usr/local/bin/proxmox-review-sync.sh"`
  This is where the sync script gets copied so `systemd` can run it reliably.
- `9` blank line
  More spacing for readability.

### Lines 10-32

- `10` `usage() {`
  This starts a helper function named `usage`.
- `11` `cat <<'EOF'`
  This begins a block of help text that prints exactly as written.
- `12` `Usage:`
  This labels the next lines as command usage help.
- `13` `install-proxmox-review.sh [options]`
  This shows the basic command format.
- `14` blank line
  Spacing inside the help text.
- `15` `Options:`
  This starts the option list.
- `16` `--env PATH ...`
  This says you can choose a custom env file path.
- `17` `--repo-dir PATH ...`
  This says you can point the installer at a different repo location.
- `18` `--interval SECONDS ...`
  This says you can change how often the timer runs.
- `19` `--node-label LABEL ...`
  This says you can set the public-safe dashboard name from the command line.
- `20` `--git-name NAME ...`
  This says you can set the git author name from the command line.
- `21` `--git-email EMAIL ...`
  This says you can set the git author email from the command line.
- `22` `--branch NAME ...`
  This says you can choose which git branch gets pushed.
- `23` `--remote NAME ...`
  This says you can choose which git remote gets pushed.
- `24` `--no-start ...`
  This says the installer can skip starting the timer.
- `25` `--run-now ...`
  This says the installer can also trigger one immediate sync.
- `26` `-h, --help ...`
  This says the script can print help and exit.
- `27` blank line
  Spacing inside the help text.
- `28` `Notes:`
  This starts the note section.
- `29` `- Run this on the Proxmox node ...`
  This reminds the user the script is meant to run on the actual Proxmox box.
- `30` `- Sub-minute scheduling uses a systemd timer ...`
  This explains why the installer uses `systemd` instead of cron.
- `31` `EOF`
  This ends the help text block.
- `32` `}`
  This ends the `usage` function.

### Lines 34-44

- `34` `have_cmd() {`
  This starts a helper function that checks whether a command exists.
- `35` `command -v "$1" >/dev/null 2>&1`
  This tests whether the command name passed into the function is on the system.
- `36` `}`
  This ends the `have_cmd` function.
- `37` blank line
  Spacing between helper functions.
- `38` `require_cmd() {`
  This starts a stricter helper function.
- `39` `local cmd="$1"`
  This stores the command name in a local variable.
- `40` `have_cmd "$cmd" || {`
  This checks whether the command exists, and if not, runs the block below.
- `41` `echo "Missing required command: $cmd" >&2`
  This prints a clear error message to standard error.
- `42` `exit 1`
  This stops the script with an error code.
- `43` `}`
  This ends the failure block.
- `44` `}`
  This ends the `require_cmd` function.

### Lines 46-75

- `46` `quote_shell_value() {`
  This starts a helper function for safely writing values into a shell-style env file.
- `47` `printf '%q' "$1"`
  This escapes the value so spaces and special characters do not break the file.
- `48` `}`
  This ends the quoting helper.
- `49` blank line
  Spacing between helper functions.
- `50` `upsert_env_var() {`
  This starts the function that updates one variable in the env file.
- `51` `local key="$1"`
  This stores the variable name.
- `52` `local value="$2"`
  This stores the variable value.
- `53` `local escaped`
  This declares a variable that will hold the escaped value.
- `54` `local tmp_file`
  This declares a variable for a temporary file.
- `55` `local found=0`
  This starts a flag at false so the script knows whether the key already existed.
- `56` blank line
  Spacing inside the function.
- `57` `escaped="$(quote_shell_value "$value")"`
  This safely escapes the value before writing it.
- `58` `tmp_file="$(mktemp)"`
  This creates a temporary file to build the updated config safely.
- `59` blank line
  Spacing before the read loop.
- `60` `while IFS= read -r line || [[ -n "$line" ]]; do`
  This reads the env file line by line without losing formatting at the end.
- `61` `if [[ "$line" == "$key="* ]]; then`
  This checks whether the current line already defines the variable we want to change.
- `62` `printf '%s=%s\n' "$key" "$escaped" >> "$tmp_file"`
  If the key matches, it writes the new version of that setting.
- `63` `found=1`
  This marks that the variable was already present.
- `64` `else`
  If the current line is not the target variable, do something else.
- `65` `printf '%s\n' "$line" >> "$tmp_file"`
  This copies the old line into the temporary file unchanged.
- `66` `fi`
  This ends the `if` check inside the loop.
- `67` `done < "$ENV_PATH"`
  This ends the loop and tells it to read from the env file.
- `68` blank line
  Spacing after the loop.
- `69` `if (( found == 0 )); then`
  If the variable was never found, the script needs to add it.
- `70` `printf '\n%s=%s\n' "$key" "$escaped" >> "$tmp_file"`
  This appends the new variable to the end of the file.
- `71` `fi`
  This ends the missing-key check.
- `72` blank line
  Spacing before replacing the real file.
- `73` `install -m 0640 "$tmp_file" "$ENV_PATH"`
  This safely replaces the real env file and sets secure permissions.
- `74` `rm -f "$tmp_file"`
  This deletes the temporary file.
- `75` `}`
  This ends the `upsert_env_var` function.

### Lines 77-90

- `77` `render_template() {`
  This starts the function that builds the final `systemd` files from templates.
- `78` `local template_path="$1"`
  This stores the template file location.
- `79` `local output_path="$2"`
  This stores where the finished file should go.
- `80` `local interval_value="$3"`
  This stores the timer interval that should be inserted.
- `81` `local tmp_file`
  This declares a variable for another temporary file.
- `82` blank line
  Spacing inside the function.
- `83` `tmp_file="$(mktemp)"`
  This creates a temporary output file.
- `84` `sed \`
  This starts a `sed` command that will replace placeholder text.
- `85` `-e "s|@ENV_PATH@|$ENV_PATH|g" \`
  This swaps the template marker `@ENV_PATH@` with the real env file path.
- `86` `-e "s|@SYNC_INTERVAL@|$interval_value|g" \`
  This swaps the template marker `@SYNC_INTERVAL@` with the real number of seconds.
- `87` `"$template_path" > "$tmp_file"`
  This reads the template and writes the finished version into the temp file.
- `88` `install -m 0644 "$tmp_file" "$output_path"`
  This copies the finished file into place with normal read permissions.
- `89` `rm -f "$tmp_file"`
  This removes the temporary file.
- `90` `}`
  This ends the `render_template` function.

### Lines 92-101

- `92` `ENV_PATH="$DEFAULT_ENV_PATH"`
  This starts the env path at the default value.
- `93` `REPO_DIR_OVERRIDE=""`
  This creates an empty variable for a possible custom repo path.
- `94` `INTERVAL_OVERRIDE=""`
  This creates an empty variable for a possible custom timer interval.
- `95` `NODE_LABEL_OVERRIDE=""`
  This creates an empty variable for a possible custom node label.
- `96` `GIT_NAME_OVERRIDE=""`
  This creates an empty variable for a possible custom git name.
- `97` `GIT_EMAIL_OVERRIDE=""`
  This creates an empty variable for a possible custom git email.
- `98` `BRANCH_OVERRIDE=""`
  This creates an empty variable for a possible custom branch.
- `99` `REMOTE_OVERRIDE=""`
  This creates an empty variable for a possible custom remote.
- `100` `START_TIMER=1`
  This sets the default behavior to start the timer after install.
- `101` `RUN_NOW=0`
  This sets the default behavior to not trigger an immediate sync unless requested.

### Lines 103-163

- `103` `while (($# > 0)); do`
  This starts a loop that reads command-line arguments one by one.
- `104` `case "$1" in`
  This checks the current argument and decides what to do with it.
- `105-109` `--env)` block
  This option takes the next value and stores it in `ENV_PATH`.
- `106` value check
  This makes sure `--env` actually got a path after it.
- `107` assignment
  This saves that path.
- `108` `shift 2`
  This skips past the option and its value.
- `109` `;;`
  This ends that case branch.
- `110-114` `--repo-dir)` block
  This does the same pattern for a custom repo directory.
- `115-119` `--interval)` block
  This does the same pattern for a custom timer interval.
- `120-124` `--node-label)` block
  This does the same pattern for a custom public node label.
- `125-129` `--git-name)` block
  This does the same pattern for a custom git author name.
- `130-134` `--git-email)` block
  This does the same pattern for a custom git author email.
- `135-139` `--branch)` block
  This does the same pattern for a custom branch name.
- `140-144` `--remote)` block
  This does the same pattern for a custom remote name.
- `145-148` `--no-start)` block
  This turns off automatic timer startup.
- `146` `START_TIMER=0`
  This changes the default so the timer will not start.
- `147` `shift`
  This skips just that one option because it has no extra value.
- `149-152` `--run-now)` block
  This turns on an immediate first sync after install.
- `150` `RUN_NOW=1`
  This changes the default so the script starts the sync service once.
- `151` `shift`
  This skips just that one option.
- `153-156` help block
  This prints help and exits cleanly.
- `157-161` fallback block
  This catches unknown options, prints an error, and exits.
- `162` `esac`
  This ends the `case` statement.
- `163` `done`
  This ends the argument-reading loop.

### Lines 165-173

- `165` `if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then`
  This checks whether the script is running as root.
- `166` `echo "Run this installer as root or with sudo." >&2`
  This prints a helpful message if it is not.
- `167` `exit 1`
  This stops the script because it cannot install system files without root.
- `168` `fi`
  This ends the root check.
- `170` `require_cmd git`
  This makes sure `git` exists.
- `171` `require_cmd install`
  This makes sure the `install` command exists.
- `172` `require_cmd sed`
  This makes sure `sed` exists.
- `173` `require_cmd systemctl`
  This makes sure `systemd` tools exist.

### Lines 175-199

- `175` `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`
  This finds the folder that contains the installer script itself.
- `176` `REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"`
  This moves one level up to get the repo root folder.
- `177` `ENV_DIR="$(dirname "$ENV_PATH")"`
  This gets the parent directory of the env file.
- `178` `SERVICE_TEMPLATE="$REPO_ROOT/systemd/proxmox-review-sync.service"`
  This points to the service template inside the repo.
- `179` `TIMER_TEMPLATE="$REPO_ROOT/systemd/proxmox-review-sync.timer"`
  This points to the timer template inside the repo.
- `180` blank line
  Spacing before validation checks.
- `181-184` exporter check
  This makes sure the exporter script exists in the repo.
- `185` blank line
  Spacing between checks.
- `186-189` sync script check
  This makes sure the sync script exists in the repo.
- `190` blank line
  Spacing between checks.
- `191-194` service template check
  This makes sure the service template exists in the repo.
- `195` blank line
  Spacing between checks.
- `196-199` timer template check
  This makes sure the timer template exists in the repo.

### Lines 201-249

- `201` `if [[ -n "$REPO_DIR_OVERRIDE" ]]; then`
  This checks whether the user passed a custom repo directory.
- `202` `REPO_DIR="$REPO_DIR_OVERRIDE"`
  If so, it uses that custom path.
- `203` `else`
  Otherwise, use the default.
- `204` `REPO_DIR="$REPO_ROOT"`
  The default repo path is the current repo itself.
- `205` `fi`
  This ends the repo path choice.
- `206` blank line
  Spacing before the next safety check.
- `207-210` git repo check
  This makes sure the chosen repo directory really is a git checkout.
- `212` `CURRENT_BRANCH=...`
  This asks git what branch the repo is currently on.
- `213` `CURRENT_REMOTE="origin"`
  This starts with the normal default remote name.
- `214` `if ! git -C "$REPO_DIR" remote get-url "$CURRENT_REMOTE" ...`
  This checks whether `origin` actually exists.
- `215` `CURRENT_REMOTE="$(git -C "$REPO_DIR" remote | head -n 1 || true)"`
  If `origin` does not exist, this falls back to the first remote it can find.
- `216` `fi`
  This ends the remote fallback logic.
- `218` `mkdir -p "$ENV_DIR"`
  This creates the env file directory if it does not exist yet.
- `220` `if [[ ! -f "$ENV_PATH" ]]; then`
  This checks whether the real env file already exists.
- `221` `install -m 0640 "$REPO_ROOT/config/proxmox-review.env.example" "$ENV_PATH"`
  If it does not exist, this copies the template into place with secure permissions.
- `222` `fi`
  This ends the env creation check.
- `224` `EXISTING_INTERVAL=...`
  This reads the current interval value from the env file if one is already there.
- `225` `INTERVAL_VALUE="${INTERVAL_OVERRIDE:-${EXISTING_INTERVAL:-30}}"`
  This chooses the interval in priority order: command-line value, existing config value, then default `30`.
- `226-229` integer check
  This makes sure the interval is a whole number.
- `230-233` positive check
  This makes sure the interval is greater than zero.
- `235-237` branch fallback
  If git could not detect a branch, this uses `main`.
- `239-241` remote fallback
  If git could not detect a remote, this uses `origin`.
- `243-245` git name lookup
  If the user did not pass `--git-name`, this tries repo config first and global git config second.
- `247-249` git email lookup
  If the user did not pass `--git-email`, this tries repo config first and global git config second.

### Lines 251-270

- `251` `upsert_env_var "REPO_DIR" "$REPO_DIR"`
  This writes the final repo path into the env file.
- `252` `upsert_env_var "OUTPUT_RELATIVE_PATH" "data/report.json"`
  This writes the path of the generated JSON file.
- `253` `upsert_env_var "GIT_REMOTE" "${REMOTE_OVERRIDE:-$CURRENT_REMOTE}"`
  This writes the final remote name into the env file.
- `254` `upsert_env_var "GIT_BRANCH" "${BRANCH_OVERRIDE:-$CURRENT_BRANCH}"`
  This writes the final branch name into the env file.
- `255` `upsert_env_var "SYNC_INTERVAL_SECONDS" "$INTERVAL_VALUE"`
  This writes the final timer interval into the env file.
- `256` `upsert_env_var "AUTO_PUSH" "1"`
  This turns on automatic push behavior.
- `257` `upsert_env_var "GIT_PULL_BEFORE_PUSH" "1"`
  This turns on an automatic pull before each push.
- `258` `upsert_env_var "COMMIT_MESSAGE_PREFIX" "Update Proxmox report"`
  This sets the commit message prefix.
- `259` blank line
  Spacing before optional settings.
- `260-262` node label block
  If the user passed `--node-label`, this writes it into the env file.
- `264-266` git name block
  If the script found or was given a git author name, this writes it into the env file.
- `268-270` git email block
  If the script found or was given a git author email, this writes it into the env file.

### Lines 272-284

- `272` `install -m 0755 "$REPO_ROOT/bin/proxmox-review-sync.sh" "$DEFAULT_SYNC_TARGET"`
  This copies the sync script into `/usr/local/bin` and makes it executable.
- `273` `render_template "$SERVICE_TEMPLATE" "$DEFAULT_SERVICE_PATH" "$INTERVAL_VALUE"`
  This builds and installs the final `systemd` service file.
- `274` `render_template "$TIMER_TEMPLATE" "$DEFAULT_TIMER_PATH" "$INTERVAL_VALUE"`
  This builds and installs the final `systemd` timer file.
- `275` blank line
  Spacing before systemd commands.
- `276` `systemctl daemon-reload`
  This tells `systemd` to reload unit files after the installer changed them.
- `278-280` timer start block
  If starting is enabled, this enables the timer and starts it immediately.
- `282-284` run-now block
  If `--run-now` was passed, this starts one immediate sync service run.

### Lines 286-308

- `286` `echo "Installed Proxmox Review automation."`
  This prints a success message.
- `287` `echo "Environment file: $ENV_PATH"`
  This tells the user where the config file lives.
- `288` `echo "Repo directory: $REPO_DIR"`
  This tells the user which repo checkout the installer used.
- `289` `echo "Timer interval: ${INTERVAL_VALUE}s"`
  This tells the user how often the timer will run.
- `290` blank line
  Spacing before the warning check.
- `291` `if grep -q '^GIT_AUTHOR_EMAIL=change-me@example\.com$' "$ENV_PATH"; then`
  This checks whether the user forgot to replace the fake example email.
- `292` `echo "Warning: update GIT_AUTHOR_EMAIL ..."`
  This prints a warning if the placeholder email is still there.
- `293` `fi`
  This ends the warning check.
- `294` blank line
  Spacing before the final status output.
- `295` `if (( START_TIMER == 1 )); then`
  This checks whether the installer actually started the timer.
- `296` `echo "Timer status:"`
  This labels the next status output.
- `297` `systemctl --no-pager --full status proxmox-review-sync.timer || true`
  This prints the timer status, but does not crash the script if the status command itself fails.
- `298` `else`
  If the timer was not started, do something different.
- `299` `echo "Timer files were installed but not started."`
  This tells the user the files were installed but startup was skipped.
- `300` `fi`
  This ends the timer status block.
- `301` blank line
  Spacing before the final instructions.
- `302` `echo`
  This prints a blank line.
- `303` `echo "Edit the environment file if needed, then rerun:"`
  This tells the user the next step.
- `304` `echo "  systemctl restart proxmox-review-sync.timer"`
  This prints the command to reload the timer after config changes.
- `305` `echo`
  This prints another blank line.
- `306` `echo "Useful checks:"`
  This labels the final troubleshooting commands.
- `307` `echo "  systemctl status proxmox-review-sync.timer"`
  This shows how to check the timer.
- `308` `echo "  journalctl -u proxmox-review-sync.service -n 50 --no-pager"`
  This shows how to read the recent sync logs.

## Easy Class Version

If you need the shortest possible way to explain the script out loud:

1. It sets safe defaults and defines helper functions.
2. It reads command-line options like custom paths or timing.
3. It checks that it is running as root and that required commands exist.
4. It finds the repo, env file, and `systemd` templates.
5. It creates or updates the env file with the final values.
6. It installs the sync script and builds the `systemd` service and timer.
7. It reloads `systemd`, starts the timer, and shows status.

## What To Emphasize In Class

- It uses `systemd`, not cron, because the project wanted 30-second updates.
- It writes to a real env file so private settings stay on the Proxmox server, not in GitHub.
- It uses temporary files when editing config and template files so it does not corrupt them mid-write.
- It validates paths and required files before installing anything.
- It prints status at the end so the user can confirm the install actually worked.
