# Publishing Notes

The static site reads `data/report.json` directly from the repo.
Deployment is handled by `.github/workflows/deploy-pages.yml`.

Safe workflow:

1. Generate `data/report.json` on the Proxmox server with `bin/export-proxmox-report.sh`.
2. Review the JSON once before publishing.
3. Commit and push to `main`.
4. Let the GitHub Pages workflow deploy the updated site.

The workflow publishes only the site files and `data/`. It does not deploy the Bash exporter, config templates, or docs.

Do not add private metadata to the JSON schema unless you are sure the repo will remain private.
