const reportUrl = "./data/report.json";

const els = {
  statusDot: document.querySelector("#statusDot"),
  overallStatus: document.querySelector("#overallStatus"),
  nodeLabel: document.querySelector("#nodeLabel"),
  generatedAt: document.querySelector("#generatedAt"),
  privacyMode: document.querySelector("#privacyMode"),
  cpuMetric: document.querySelector("#cpuMetric"),
  loadMetric: document.querySelector("#loadMetric"),
  memoryMetric: document.querySelector("#memoryMetric"),
  memoryDetail: document.querySelector("#memoryDetail"),
  storageMetric: document.querySelector("#storageMetric"),
  storageDetail: document.querySelector("#storageDetail"),
  guestMetric: document.querySelector("#guestMetric"),
  guestDetail: document.querySelector("#guestDetail"),
  alertList: document.querySelector("#alertList"),
  systemFacts: document.querySelector("#systemFacts"),
  privacyList: document.querySelector("#privacyList")
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function setStatus(status) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "warning";
  els.statusDot.className = `status-dot ${normalized}`;
  els.overallStatus.textContent = normalized.toUpperCase();
}

function renderList(target, items) {
  target.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function renderFacts(summary) {
  const facts = [
    ["Uptime", summary.uptime],
    ["Swap", summary.swap.enabled ? `${summary.swap.used_percent}% in use` : "Disabled"],
    ["ZFS", `${summary.zfs.unhealthy}/${summary.zfs.total} unhealthy`],
    ["Services", `${summary.services.active} active / ${summary.services.inactive} inactive`],
    ["Busy Filesystems", String(summary.filesystems_above_threshold)]
  ];

  els.systemFacts.innerHTML = "";
  facts.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrapper.append(dt, dd);
    els.systemFacts.appendChild(wrapper);
  });
}

function renderReport(data) {
  const { site, summary, alerts, privacy } = data;

  setStatus(site.overall_status);
  els.nodeLabel.textContent = site.node_label;
  els.generatedAt.textContent = formatTimestamp(site.generated_at);
  els.privacyMode.textContent = site.privacy_mode;

  els.cpuMetric.textContent = `${summary.cpu_percent}%`;
  els.loadMetric.textContent = `Load ${summary.load.join(" / ")}`;

  els.memoryMetric.textContent = `${summary.memory.used_percent}%`;
  els.memoryDetail.textContent = `${formatBytes(summary.memory.used_bytes)} of ${formatBytes(summary.memory.total_bytes)}`;

  els.storageMetric.textContent = `${summary.root_fs.used_percent}%`;
  els.storageDetail.textContent = `${formatBytes(summary.root_fs.used_bytes)} of ${formatBytes(summary.root_fs.total_bytes)}`;

  const runningGuests = summary.virtual_machines.running + summary.containers.running;
  const totalGuests = summary.virtual_machines.total + summary.containers.total;
  els.guestMetric.textContent = `${runningGuests}/${totalGuests}`;
  els.guestDetail.textContent = `${summary.virtual_machines.running}/${summary.virtual_machines.total} VM, ${summary.containers.running}/${summary.containers.total} LXC`;

  renderList(els.alertList, alerts);
  renderList(els.privacyList, privacy);
  renderFacts(summary);
}

function renderError(message) {
  setStatus("critical");
  els.nodeLabel.textContent = "Unavailable";
  els.generatedAt.textContent = "No report loaded";
  els.privacyMode.textContent = "error";
  els.cpuMetric.textContent = "--";
  els.loadMetric.textContent = message;
  els.memoryMetric.textContent = "--";
  els.memoryDetail.textContent = "Check data/report.json";
  els.storageMetric.textContent = "--";
  els.storageDetail.textContent = "Static data not found";
  els.guestMetric.textContent = "--";
  els.guestDetail.textContent = "No guest summary";
  renderList(els.alertList, ["The dashboard could not load ./data/report.json"]);
  renderList(els.privacyList, ["Publish a sanitized JSON report before sharing the site publicly."]);
  els.systemFacts.innerHTML = "";
}

fetch(reportUrl, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  })
  .then(renderReport)
  .catch((error) => {
    renderError(error.message);
  });

