# Proxmox Review Board

This repo is a static website for GitHub Pages plus Bash automation that writes a sanitized Proxmox health report to `data/report.json`.

The website is public-safe by design:

- no hostnames or FQDNs
- no IP addresses, MAC addresses, or serial numbers
- no VM names, container names, or guest IDs
- no storage pool names or datastore names

## Files

- `index.html` - static dashboard page
- `styles.css` - custom visual design
- `app.js` - loads and renders `data/report.json`
- `data/report.json` - sample sanitized report
- `bin/export-proxmox-report.sh` - Bash script that generates the JSON report
- `bin/proxmox-review-sync.sh` - commits and pushes the refreshed JSON report
- `bin/install-proxmox-review.sh` - installs the env file plus `systemd` automation on Proxmox
- `config/proxmox-review.conf.example` - legacy exporter-only config example
- `config/proxmox-review.env.example` - shared env config for exporter plus auto-push
- `systemd/` - service and timer templates used by the installer

## Local Flow

1. On your Proxmox server, copy `config/proxmox-review.env.example` to `/etc/proxmox-review/proxmox-review.env`.
2. Change only the generic `NODE_LABEL`, git identity, and thresholds.
3. Generate the report JSON:

```bash
chmod +x ./bin/export-proxmox-report.sh
./bin/export-proxmox-report.sh -c /etc/proxmox-review/proxmox-review.env -o ./data/report.json
```

4. Preview the site through a local static web server or publish the repo to GitHub Pages.

Opening `index.html` directly with `file://` may fail because the page fetches `data/report.json` with JavaScript.

## GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, open `Pages` and set the build source to `GitHub Actions`.
3. Commit and push to `main`. The workflow in `.github/workflows/deploy-pages.yml` will deploy the site automatically.
4. Keep committing updated `data/report.json` whenever you want the site refreshed.

GitHub Pages is static. If you want automated updates from the Proxmox node, run the installer and let the included `systemd` timer handle the sync.

Quick install on Proxmox after cloning the repo:

```bash
sudo bash ./bin/install-proxmox-review.sh --run-now
```

That creates `/etc/proxmox-review/proxmox-review.env`, installs the sync service, and starts a timer.

Full Proxmox setup notes are in [docs/proxmox-install.md](docs/proxmox-install.md).

The workflow only publishes:

- `index.html`
- `styles.css`
- `app.js`
- `data/`

It does not publish `bin/`, `config/`, or `docs/`.

For a public static site, a `30` second sync interval is possible but aggressive. GitHub Pages deployments can take longer than the push interval, so `120` or `300` seconds is a better steady-state setting.

## Privacy Rules

Use a generic `NODE_LABEL`, such as `lab-node-1`.

Do not commit:

- real config files
- screenshots that show private browser tabs or repo URLs you do not want shared
- extra shell output that includes hostnames, IPs, or storage names
