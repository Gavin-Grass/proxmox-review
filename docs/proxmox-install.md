# Proxmox Install

This project can auto-publish a sanitized `data/report.json` from a Proxmox node to GitHub Pages.

The installer uses a `systemd` timer, not cron.
That is intentional: cron cannot schedule jobs every 30 seconds.

## Before You Run The Installer

1. Install `git` on the Proxmox node.
2. Set up GitHub auth on that node.
3. Clone this repo to a stable path such as `/opt/proxmox-review`.
4. Make sure `git push` works from that clone before you automate it.

Use an SSH remote if you can.
That avoids embedding a personal access token in the repo URL or shell history.

Example:

```bash
apt update
apt install -y git
cd /opt
git clone git@github.com:Gavin-Grass/proxmox-review.git
cd /opt/proxmox-review
git push --dry-run origin main
```

## Install Everything

Run the installer as root:

```bash
cd /opt/proxmox-review
sudo bash ./bin/install-proxmox-review.sh --run-now
```

That will:

- create `/etc/proxmox-review/proxmox-review.env` if it does not exist
- install `/usr/local/bin/proxmox-review-sync.sh`
- install `proxmox-review-sync.service`
- install `proxmox-review-sync.timer`
- enable and start the timer
- optionally run one sync immediately

## Edit The Environment File

Main config file:

```bash
sudo nano /etc/proxmox-review/proxmox-review.env
```

Most important values:

- `NODE_LABEL`
  Use a generic public-safe label such as `lab-node-1`.
- `GIT_AUTHOR_NAME`
  Commit author name for automated pushes.
- `GIT_AUTHOR_EMAIL`
  Commit author email for automated pushes.
- `SYNC_INTERVAL_SECONDS`
  Default example is `30`.
- `CPU_ALERT_PERCENT`, `MEMORY_ALERT_PERCENT`, `ROOT_FS_ALERT_PERCENT`
  Alert thresholds shown on the dashboard.

After editing the file, reload the timer:

```bash
sudo systemctl restart proxmox-review-sync.timer
```

If you changed only threshold values and want an immediate update:

```bash
sudo systemctl start proxmox-review-sync.service
```

## Check Status

```bash
systemctl status proxmox-review-sync.timer
journalctl -u proxmox-review-sync.service -n 50 --no-pager
```

## Important Notes

- The exporter is privacy-safe by design. It does not publish hostnames, IPs, MACs, serials, usernames, guest names, guest IDs, or datastore names.
- GitHub Pages is static. A `30` second timer can generate commits that are faster than GitHub finishes deploying them.
- If you want steadier public updates, use `120` or `300` seconds instead.
