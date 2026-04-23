# Install Script Speaker Notes

This is the short version of the installer explanation for class.

Use this when you do not want to explain every Bash detail line by line.

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

## 5. Finding The Repo And Templates

The script then:

- finds its own folder
- calculates the repo root
- points to the `systemd` template files inside the repo
- confirms the exporter, sync script, and templates actually exist

Why that matters:

- it avoids half-installing if the repo is incomplete
- it makes the script portable inside the repo

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

## 7. Installing Automation

After the env file is ready, the script:

- installs the sync script into `/usr/local/bin`
- renders the service template into a real `.service` file
- renders the timer template into a real `.timer` file

Why that matters:

- `systemd` needs final installed files, not repo templates
- the timer interval and env path get baked into the final unit files

## 8. Activating The Timer

At the end, the script:

- reloads `systemd`
- enables and starts the timer
- optionally runs one sync right away
- prints useful status and troubleshooting commands

Why that matters:

- `systemd` must reload to notice new unit files
- the user gets immediate confirmation that the install worked

## Easy Way To Say It Out Loud

If your teacher wants the short explanation:

"This installer takes a manual Proxmox setup and turns it into one command. It checks the environment, creates the private config file, installs the sync automation, enables the timer, and shows the status so I can verify it worked."

## What Makes It Good

- It keeps private config out of GitHub.
- It uses `systemd` because cron cannot run every 30 seconds.
- It validates files and commands before installing.
- It is safe to rerun because it updates the env file instead of rebuilding everything from scratch.
