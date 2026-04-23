# Proxmox Review Board

This repo is a static website for GitHub Pages plus a Bash exporter that writes a sanitized Proxmox health report to `data/report.json`.

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
- `config/proxmox-review.conf.example` - safe config template

## Local Flow

1. On your Proxmox server, copy `config/proxmox-review.conf.example` to `/etc/proxmox-review.conf`.
2. Change only the generic `NODE_LABEL` and thresholds.
3. Generate the report JSON:

```bash
chmod +x ./bin/export-proxmox-report.sh
./bin/export-proxmox-report.sh -c /etc/proxmox-review.conf -o ./data/report.json
```

4. Preview the site through a local static web server or publish the repo to GitHub Pages.

Opening `index.html` directly with `file://` may fail because the page fetches `data/report.json` with JavaScript.

## GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, open `Pages` and set the build source to `GitHub Actions`.
3. Commit and push to `main`. The workflow in `.github/workflows/deploy-pages.yml` will deploy the site automatically.
4. Keep committing updated `data/report.json` whenever you want the site refreshed.

GitHub Pages is static. If you want updates every 2 hours, run the exporter on the Proxmox machine with cron and then push the updated JSON to GitHub.

The workflow only publishes:

- `index.html`
- `styles.css`
- `app.js`
- `data/`

It does not publish `bin/`, `config/`, or `docs/`.

Example cron line on Proxmox:

```cron
0 */2 * * * cd /path/to/repo && ./bin/export-proxmox-report.sh -c /etc/proxmox-review.conf -o ./data/report.json
```

That only regenerates the JSON. It does not automate git commits or pushes.

## Privacy Rules

Use a generic `NODE_LABEL`, such as `lab-node-1`.

Do not commit:

- real config files
- screenshots that show private browser tabs or repo URLs you do not want shared
- extra shell output that includes hostnames, IPs, or storage names
