const reportUrl = "./data/report.json";

const els = {
  body: document.body,
  heroTitle: document.querySelector("#heroTitle"),
  noiseButton: document.querySelector("#noiseButton"),
  fxLayer: document.querySelector("#fxLayer"),
  matrixField: document.querySelector("#matrixField"),
  riotBanner: document.querySelector("#riotBanner"),
  riotBannerText: document.querySelector("#riotBannerText"),
  matrixSplash: document.querySelector("#matrixSplash"),
  matrixSplashTitle: document.querySelector("#matrixSplashTitle"),
  matrixSplashCopy: document.querySelector("#matrixSplashCopy"),
  terminalWindow: document.querySelector("#terminalWindow"),
  terminalState: document.querySelector("#terminalState"),
  terminalOutput: document.querySelector("#terminalOutput"),
  presenterVault: document.querySelector("#presenterVault"),
  presenterVaultBackdrop: document.querySelector("#presenterVaultBackdrop"),
  presenterClose: document.querySelector("#presenterClose"),
  presenterGrid: document.querySelector("#presenterGrid"),
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
  privacyList: document.querySelector("#privacyList"),
  secretPanel: document.querySelector("#secretPanel"),
  secretTitle: document.querySelector("#secretTitle"),
  secretTag: document.querySelector("#secretTag"),
  secretAscii: document.querySelector("#secretAscii"),
  secretCopy: document.querySelector("#secretCopy"),
  secretHint: document.querySelector("#secretHint"),
  toast: document.querySelector("#toast"),
  tiltCards: [...document.querySelectorAll("[data-tilt]")],
  metricLabels: [...document.querySelectorAll(".metric-label")],
  tapeNote: document.querySelector(".tape-note")
};

const statusLabels = {
  ok: "CHILL // GREEN",
  warning: "SIDE-EYE // AMBER",
  critical: "SIRENS // RED"
};

const konamiCode = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a"
];

const modeClasses = ["mode-punk", "mode-konami", "mode-lockdown", "arcade-overdrive"];
const matrixChars = "01#$%&*+-=<>[]{}ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const speakerNotes = [
  {
    title: "1. Setup",
    points: [
      "Uses Bash and strict error handling.",
      "Defines default paths for the env file and systemd units.",
      "Fails fast instead of limping through a broken install."
    ]
  },
  {
    title: "2. Helpers",
    points: [
      "Small helper functions keep the main flow clean.",
      "One function checks commands, another safely updates the env file.",
      "Template rendering fills in the real env path and timer interval."
    ]
  },
  {
    title: "3. Inputs",
    points: [
      "Reads command options like custom interval, repo path, or git identity.",
      "That makes the installer reusable without editing the script.",
      "Defaults still work if no options are passed."
    ]
  },
  {
    title: "4. Safety Checks",
    points: [
      "Requires root because it writes into /etc and /usr/local/bin.",
      "Verifies git, sed, install, and systemctl exist.",
      "Also confirms the repo has the scripts and templates it needs."
    ]
  },
  {
    title: "5. Config Build",
    points: [
      "Creates the real server-only env file if needed.",
      "Updates values like repo path, branch, interval, and git author.",
      "Keeps private config on Proxmox instead of in GitHub."
    ]
  },
  {
    title: "6. Automation",
    points: [
      "Installs the sync script into /usr/local/bin.",
      "Builds real systemd service and timer files from templates.",
      "Uses systemd because cron cannot run every 30 seconds."
    ]
  },
  {
    title: "7. Finish",
    points: [
      "Reloads systemd so it sees the new unit files.",
      "Starts the timer and can also run one sync immediately.",
      "Prints status commands so the user can verify it worked."
    ]
  },
  {
    title: "Say This",
    points: [
      "This script turns a manual Proxmox setup into one command.",
      "It builds the private config, installs the auto-sync timer, and starts it.",
      "The result is a public-safe dashboard that updates itself."
    ]
  }
];

const defaultMetricLabels = els.metricLabels.map((node) => node.textContent);

let activeMode = null;
let currentReport = null;
let toastTimer = 0;
let bannerTimer = 0;
let glitchTimer = 0;
let scanTimer = 0;
let glitchLoop = 0;
let bannerHideTimer = 0;
let matrixSplashHideTimer = 0;
let terminalHideTimer = 0;
let dotClicks = 0;
let dotTimer = 0;
let keyBuffer = "";
let konamiIndex = 0;
let tapeClicks = 0;
let tapeClickTimer = 0;
let scheduledEffects = [];

function scheduleEffect(fn, delay) {
  const id = window.setTimeout(() => {
    scheduledEffects = scheduledEffects.filter((value) => value !== id);
    fn();
  }, delay);

  scheduledEffects.push(id);
  return id;
}

function clearScheduledEffects() {
  scheduledEffects.forEach((id) => {
    window.clearTimeout(id);
  });
  scheduledEffects = [];
}

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

function animateNumber(element, target, suffix = "", duration = 850) {
  if (motionQuery.matches || !Number.isFinite(target)) {
    element.textContent = `${target}${suffix}`;
    return;
  }

  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const value = Math.round(target * eased);
    element.textContent = `${value}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function setStatus(status) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "warning";
  els.statusDot.className = `status-dot ${normalized}`;
  els.overallStatus.textContent = statusLabels[normalized] || normalized.toUpperCase();
  els.body.dataset.status = normalized;
}

function renderList(target, items) {
  target.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2200);
}

function showBanner(text, duration = 2300) {
  window.clearTimeout(bannerHideTimer);
  els.riotBanner.hidden = false;
  els.riotBanner.setAttribute("aria-hidden", "false");
  els.riotBannerText.textContent = text;
  els.riotBanner.classList.add("is-live");

  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    hideBanner();
  }, duration);
}

function hideBanner(immediate = false) {
  window.clearTimeout(bannerTimer);
  window.clearTimeout(bannerHideTimer);
  els.riotBanner.classList.remove("is-live");

  if (immediate) {
    els.riotBanner.hidden = true;
    els.riotBanner.setAttribute("aria-hidden", "true");
    return;
  }

  bannerHideTimer = window.setTimeout(() => {
    els.riotBanner.hidden = true;
    els.riotBanner.setAttribute("aria-hidden", "true");
  }, 260);
}

function triggerGlitch() {
  els.heroTitle.classList.remove("is-glitching");
  void els.heroTitle.offsetWidth;
  els.heroTitle.classList.add("is-glitching");
  window.clearTimeout(glitchTimer);
  glitchTimer = window.setTimeout(() => {
    els.heroTitle.classList.remove("is-glitching");
  }, 900);
}

function triggerNoise(message = "Board lights kicked.") {
  els.body.classList.remove("riot-scan");
  void els.body.offsetWidth;
  els.body.classList.add("riot-scan");
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    els.body.classList.remove("riot-scan");
  }, 1100);
  triggerGlitch();
  showToast(message);
}

function flashSecretPanel() {
  els.secretPanel.classList.remove("flash");
  void els.secretPanel.offsetWidth;
  els.secretPanel.classList.add("flash");
}

function setMetricLabels(labels = defaultMetricLabels) {
  els.metricLabels.forEach((node, index) => {
    node.textContent = labels[index] || defaultMetricLabels[index];
  });
}

function spawnBadge(text, variant = "cyan") {
  if (motionQuery.matches) {
    return;
  }

  const badge = document.createElement("span");
  badge.className = `fx-badge fx-badge--${variant}`;
  badge.textContent = text;
  badge.style.left = `${10 + Math.random() * 72}%`;
  badge.style.top = `${18 + Math.random() * 58}%`;
  badge.style.setProperty("--burst-x", `${(Math.random() - 0.5) * 140}px`);
  badge.style.setProperty("--burst-y", `${-110 - Math.random() * 90}px`);
  badge.style.setProperty("--burst-rotate", `${-14 + Math.random() * 28}deg`);
  els.fxLayer.appendChild(badge);

  scheduleEffect(() => {
    badge.remove();
  }, 2500);
}

function launchBadgeBurst(words, variants = ["cyan", "lime", "red"]) {
  words.forEach((word, index) => {
    scheduleEffect(() => {
      spawnBadge(word, variants[index % variants.length]);
    }, index * 90);
  });
}

function pulseChaos(duration = 4200) {
  els.body.classList.add("arcade-overdrive");
  scheduleEffect(() => {
    els.body.classList.remove("arcade-overdrive");
  }, duration);
}

function randomMatrixColumn(lines = 28) {
  let output = "";

  for (let index = 0; index < lines; index += 1) {
    output += `${matrixChars[Math.floor(Math.random() * matrixChars.length)]}\n`;
  }

  return output;
}

function buildMatrixField() {
  els.matrixField.innerHTML = "";

  for (let index = 0; index < 18; index += 1) {
    const column = document.createElement("span");
    column.className = "matrix-column";
    column.textContent = randomMatrixColumn(30 + Math.floor(Math.random() * 12));
    column.style.left = `${index * 5.6 + Math.random() * 2}%`;
    column.style.opacity = `${0.42 + Math.random() * 0.45}`;
    column.style.fontSize = `${0.68 + Math.random() * 0.25}rem`;
    column.style.setProperty("--fall-duration", `${9 + Math.random() * 8}s`);
    column.style.setProperty("--fall-delay", `${-Math.random() * 12}s`);
    els.matrixField.appendChild(column);
  }

  els.matrixField.classList.add("is-live");
}

function clearMatrixField() {
  els.matrixField.classList.remove("is-live");
  els.matrixField.innerHTML = "";
}

function showMatrixSplash(title, copy, duration = 2100) {
  window.clearTimeout(matrixSplashHideTimer);
  els.matrixSplashTitle.textContent = title;
  els.matrixSplashCopy.textContent = copy;
  els.matrixSplash.hidden = false;
  els.matrixSplash.setAttribute("aria-hidden", "false");
  els.matrixSplash.classList.add("is-live");

  scheduleEffect(() => {
    hideMatrixSplash();
  }, duration);
}

function hideMatrixSplash(immediate = false) {
  window.clearTimeout(matrixSplashHideTimer);
  els.matrixSplash.classList.remove("is-live");

  if (immediate) {
    els.matrixSplash.hidden = true;
    els.matrixSplash.setAttribute("aria-hidden", "true");
    return;
  }

  matrixSplashHideTimer = window.setTimeout(() => {
    els.matrixSplash.hidden = true;
    els.matrixSplash.setAttribute("aria-hidden", "true");
  }, 260);
}

function showTerminalWindow() {
  window.clearTimeout(terminalHideTimer);
  els.terminalWindow.hidden = false;
  els.terminalWindow.setAttribute("aria-hidden", "false");
  els.terminalWindow.classList.add("is-live");
}

function renderPresenterNotes() {
  if (els.presenterGrid.childElementCount > 0) {
    return;
  }

  speakerNotes.forEach((section, index) => {
    const card = document.createElement("article");
    card.className = "presenter-card";
    card.style.setProperty("--note-order", String(index));

    const title = document.createElement("h3");
    title.textContent = section.title;

    const list = document.createElement("ul");
    section.points.forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      list.appendChild(item);
    });

    card.append(title, list);
    els.presenterGrid.appendChild(card);
  });
}

function openPresenterVault() {
  renderPresenterNotes();
  els.presenterVault.hidden = false;
  els.presenterVault.setAttribute("aria-hidden", "false");
  els.body.classList.add("presenter-mode");
  triggerNoise("Class mode loaded.");
  showBanner("CLASS MODE // SPEAKER NOTES UNSEALED", 2400);
}

function closePresenterVault() {
  els.presenterVault.hidden = true;
  els.presenterVault.setAttribute("aria-hidden", "true");
  els.body.classList.remove("presenter-mode");
}

function hideTerminalWindow(immediate = false) {
  window.clearTimeout(terminalHideTimer);
  els.terminalWindow.classList.remove("is-live");
  els.terminalWindow.classList.remove("is-denied");

  if (immediate) {
    els.terminalWindow.hidden = true;
    els.terminalWindow.setAttribute("aria-hidden", "true");
    return;
  }

  terminalHideTimer = window.setTimeout(() => {
    els.terminalWindow.hidden = true;
    els.terminalWindow.setAttribute("aria-hidden", "true");
  }, 260);
}

function appendTerminalLine(text) {
  const next = els.terminalOutput.textContent ? `${els.terminalOutput.textContent}\n${text}` : text;
  els.terminalOutput.textContent = next;
  els.terminalOutput.scrollTop = els.terminalOutput.scrollHeight;
}

function showSecretPanel({ title, tag, ascii, copy, hint, variantClass = "" }) {
  els.secretPanel.hidden = false;
  els.secretPanel.setAttribute("aria-hidden", "false");
  els.secretPanel.classList.remove("mode-punk", "mode-lockdown");

  if (variantClass) {
    els.secretPanel.classList.add(variantClass);
  }

  els.secretTitle.textContent = title;
  els.secretTag.textContent = tag;
  els.secretAscii.textContent = ascii;
  els.secretCopy.textContent = copy;
  els.secretHint.textContent = hint;
  flashSecretPanel();
}

function hideSecretPanel() {
  els.secretPanel.hidden = true;
  els.secretPanel.setAttribute("aria-hidden", "true");
  els.secretPanel.classList.remove("mode-punk", "mode-lockdown");
}

function clearModeVisuals() {
  els.body.classList.remove(...modeClasses, "riot-scan");
  clearMatrixField();
  hideMatrixSplash(true);
  hideTerminalWindow(true);
  hideBanner(true);
  hideSecretPanel();
  setMetricLabels(defaultMetricLabels);
  els.fxLayer.innerHTML = "";
  els.terminalOutput.textContent = "";
  els.terminalState.textContent = "idle";
}

function stopLoops() {
  if (glitchLoop) {
    window.clearInterval(glitchLoop);
    glitchLoop = 0;
  }
}

function clearActiveMode(options = {}) {
  const { announce = false, message = "Noise cleared. Default board restored." } = options;

  activeMode = null;
  dotClicks = 0;
  keyBuffer = "";
  konamiIndex = 0;
  clearScheduledEffects();
  stopLoops();
  clearModeVisuals();
  if (currentReport) {
    renderReport(currentReport);
  }
  if (announce) {
    triggerNoise(message);
  }
}

function applyPunkReadout() {
  if (!currentReport) {
    return;
  }

  const { site, summary } = currentReport;
  els.overallStatus.textContent = "LOUD // CLEAN";
  els.nodeLabel.textContent = `${site.node_label} // riot deck`;
  els.generatedAt.textContent = `fresh mess // ${formatTimestamp(site.generated_at)}`;
  els.privacyMode.textContent = "punk / sanitized / zero snitch";
  els.loadMetric.textContent = `Amp ${summary.load.join(" // ")}`;
  els.memoryDetail.textContent = `${formatBytes(summary.memory.used_bytes)} slammed into ${formatBytes(summary.memory.total_bytes)}`;
  els.storageDetail.textContent = `${formatBytes(summary.root_fs.used_bytes)} stacked on ${formatBytes(summary.root_fs.total_bytes)}`;
  els.guestDetail.textContent = `${summary.virtual_machines.running}/${summary.virtual_machines.total} vm // ${summary.containers.running}/${summary.containers.total} lxc // masked`;
}

function applyKonamiReadout() {
  if (!currentReport) {
    return;
  }

  const { site, summary } = currentReport;
  els.overallStatus.textContent = "GHOST // MATRIX";
  els.nodeLabel.textContent = `${site.node_label}::sim`;
  els.generatedAt.textContent = `clock drift // ${formatTimestamp(site.generated_at)}`;
  els.privacyMode.textContent = "matrix / sanitized / readonly";
  els.loadMetric.textContent = `CLK ${summary.load.join(" // ")}`;
  els.memoryDetail.textContent = `alloc ${formatBytes(summary.memory.used_bytes)} / ${formatBytes(summary.memory.total_bytes)} // cache safe`;
  els.storageDetail.textContent = `sector ${formatBytes(summary.root_fs.used_bytes)} / ${formatBytes(summary.root_fs.total_bytes)} // readonly`;
  els.guestDetail.textContent = `vm ${summary.virtual_machines.running}/${summary.virtual_machines.total} // lxc ${summary.containers.running}/${summary.containers.total} // ghosted`;
}

function applyLockdownReadout() {
  els.overallStatus.textContent = "LOCKED // DENIED";
  els.nodeLabel.textContent = "redacted";
  els.generatedAt.textContent = "sealed after intrusion attempt";
  els.privacyMode.textContent = "lockdown / hard redaction";
  els.loadMetric.textContent = "telemetry sealed";
  els.memoryDetail.textContent = "redacted";
  els.storageDetail.textContent = "redacted";
  els.guestDetail.textContent = "redacted";
}

function runTitleRiff(count = 3, spacing = 180) {
  for (let index = 0; index < count; index += 1) {
    scheduleEffect(() => {
      triggerGlitch();
    }, index * spacing);
  }
}

function startKonamiLoop() {
  stopLoops();
  glitchLoop = window.setInterval(() => {
    triggerGlitch();
  }, 1700);
}

function activatePunkMode() {
  clearActiveMode();
  activeMode = "punk";
  els.body.classList.add("mode-punk");
  setMetricLabels(["CPU Riot", "RAM Wreck", "Disk Noise", "Guest Mob"]);
  applyPunkReadout();
  showSecretPanel({
    title: "Punk Patch Loaded",
    tag: "typed: punk",
    ascii: [
      " .----------------. ",
      " | PUNK PATCH 01  | ",
      " | NO SNITCH DATA | ",
      " '----------------' "
    ].join("\n"),
    copy: "The board keeps the same sanitized report, but the whole presentation kicks over into loud demo mode.",
    hint: "This one stays active until you clear the noise or trigger another hidden mode.",
    variantClass: "mode-punk"
  });
  showBanner("PUNK MODE // PRIVATE DATA STAYS BURIED", 2800);
  launchBadgeBurst(["PUNK PATCH", "SAFE FLEX", "NO NAMES", "NO IPS", "LOUD BOARD"]);
  pulseChaos(2400);
  runTitleRiff(4, 150);
  triggerNoise("Punk mode locked in.");
}

function activateKonamiMode() {
  clearActiveMode();
  activeMode = "konami";
  els.body.classList.add("mode-konami");
  setMetricLabels(["Boss Fight", "Combo Meter", "Loot Crate", "Crew Size"]);
  applyKonamiReadout();
  buildMatrixField();
  showMatrixSplash(
    "GLITCH / MATRIX MODE",
    "Matrix rain engaged. The whole board stays in cheat-code mode until you clear it."
  );
  showBanner("KONAMI MODE // DEMO CHAOS ENABLED", 3200);
  launchBadgeBurst(
    ["1UP", "COMBO", "GLITCH", "BOSS MODE", "SAFE DATA", "ARCADE"],
    ["lime", "red", "cyan"]
  );
  pulseChaos(5200);
  runTitleRiff(6, 120);
  startKonamiLoop();
  triggerNoise("Konami mode engaged.");
}

function activateLockdownTheme() {
  activeMode = "lockdown";
  els.body.classList.add("mode-lockdown");
  setMetricLabels(["CPU Seal", "RAM Seal", "Disk Seal", "Guest Seal"]);
  applyLockdownReadout();
  showSecretPanel({
    title: "Security Lockout",
    tag: "status-dot / denied",
    ascii: [
      "██ SYSTEM LOCKDOWN ██",
      "██ READ ONLY MODE  ██",
      "██ PRIVATE DATA    ██",
      "██ STAYS BLOCKED   ██"
    ].join("\n"),
    copy: "The access probe tripped the redaction wall. The board is now in a locked, sealed presentation state.",
    hint: "Clear The Noise to restore the normal dashboard.",
    variantClass: "mode-lockdown"
  });
  showBanner("ACCESS DENIED // LOCKDOWN MODE", 2800);
  launchBadgeBurst(["DENIED", "LOCKDOWN", "REDACTED", "NO ACCESS"], ["red", "cyan", "red"]);
  triggerNoise("Access denied. Dashboard locked down.");
}

function runLockdownSequence() {
  clearActiveMode();
  showTerminalWindow();
  els.terminalOutput.textContent = "";
  els.terminalState.textContent = "probing";
  els.terminalWindow.classList.remove("is-denied");

  const steps = [
    { state: "boot", text: "> ./access_probe.exe --scope public_repo --mode escalate" },
    { state: "boot", text: "[init] loading readonly telemetry map" },
    { state: "probe", text: "[probe] enumerating public dashboard surface" },
    { state: "probe", text: "[probe] checking vm-count cache boundary" },
    { state: "probe", text: "[probe] testing storage summary token" },
    { state: "escalating", text: "[auth] privilege elevation request queued" },
    { state: "escalating", text: "[auth] shadow session handshake -> partial" },
    { state: "escalating", text: "[auth] disclosure wall detected" },
    { state: "denied", text: "[shield] private identifier redaction layer tripped" },
    { state: "denied", text: "[policy] outbound leak risk -> blocked" },
    { state: "denied", text: "[halt] ACCESS DENIED // lockdown engaged" }
  ];

  steps.forEach((step, index) => {
    scheduleEffect(() => {
      els.terminalState.textContent = step.state;
      if (step.state === "denied") {
        els.terminalWindow.classList.add("is-denied");
      }
      appendTerminalLine(step.text);
    }, index * 250);
  });

  scheduleEffect(() => {
    hideTerminalWindow();
    activateLockdownTheme();
  }, steps.length * 250 + 1150);
}

function stylizeAlerts(alerts) {
  return alerts.map((message) => {
    if (message === "No active threshold alerts") {
      return "No active threshold alerts. The gremlins are asleep.";
    }
    return message;
  });
}

function stylizePrivacy(items) {
  return items.map((message) => `Rule: ${message}`);
}

function renderFacts(summary) {
  const facts = [
    ["Uptime", summary.uptime],
    ["Swap Spill", summary.swap.enabled ? `${summary.swap.used_percent}% in use` : "Disabled"],
    ["ZFS Mood", `${summary.zfs.unhealthy}/${summary.zfs.total} unhealthy`],
    ["Core Crew", `${summary.services.active} active / ${summary.services.inactive} inactive`],
    ["Hot Filesystems", String(summary.filesystems_above_threshold)]
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
  currentReport = data;

  setStatus(site.overall_status);
  document.title = `${site.title} // Riot Edition`;
  els.nodeLabel.textContent = site.node_label;
  els.generatedAt.textContent = formatTimestamp(site.generated_at);
  els.privacyMode.textContent = site.privacy_mode.replaceAll("-", " / ");

  animateNumber(els.cpuMetric, summary.cpu_percent, "%");
  els.loadMetric.textContent = `Load ${summary.load.join(" // ")}`;

  animateNumber(els.memoryMetric, summary.memory.used_percent, "%");
  els.memoryDetail.textContent = `${formatBytes(summary.memory.used_bytes)} of ${formatBytes(summary.memory.total_bytes)} online`;

  animateNumber(els.storageMetric, summary.root_fs.used_percent, "%");
  els.storageDetail.textContent = `${formatBytes(summary.root_fs.used_bytes)} of ${formatBytes(summary.root_fs.total_bytes)} on deck`;

  const runningGuests = summary.virtual_machines.running + summary.containers.running;
  const totalGuests = summary.virtual_machines.total + summary.containers.total;
  els.guestMetric.textContent = `${runningGuests}/${totalGuests}`;
  els.guestDetail.textContent = `${summary.virtual_machines.running}/${summary.virtual_machines.total} VM // ${summary.containers.running}/${summary.containers.total} LXC`;

  renderList(els.alertList, stylizeAlerts(alerts));
  renderList(els.privacyList, stylizePrivacy(privacy));
  renderFacts(summary);
}

function renderError(message) {
  setStatus("critical");
  els.nodeLabel.textContent = "Unavailable";
  els.generatedAt.textContent = "No report loaded";
  els.privacyMode.textContent = "error";
  els.cpuMetric.textContent = "--";
  els.loadMetric.textContent = `Report missing // ${message}`;
  els.memoryMetric.textContent = "--";
  els.memoryDetail.textContent = "Check data/report.json";
  els.storageMetric.textContent = "--";
  els.storageDetail.textContent = "Static data not found";
  els.guestMetric.textContent = "--";
  els.guestDetail.textContent = "No guest summary";
  renderList(els.alertList, ["The dashboard could not load ./data/report.json. The lights are on, the JSON is not."]);
  renderList(els.privacyList, ["Rule: Publish a sanitized JSON report before showing this page in public."]);
  els.systemFacts.innerHTML = "";
}

function setupTilt(card) {
  if (motionQuery.matches) {
    return;
  }

  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-y", `${x * 9}deg`);
    card.style.setProperty("--tilt-x", `${y * -9}deg`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--tilt-x", "0deg");
  });
}

function handleKeydown(event) {
  if (event.key === "Escape" && !els.presenterVault.hidden) {
    closePresenterVault();
    return;
  }

  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  keyBuffer = `${keyBuffer}${normalizedKey}`.slice(-20);
  if (keyBuffer.includes("class")) {
    keyBuffer = "";
    openPresenterVault();
    return;
  }

  if (keyBuffer.includes("punk")) {
    keyBuffer = "";
    activatePunkMode();
    return;
  }

  if (normalizedKey === konamiCode[konamiIndex]) {
    konamiIndex += 1;
    if (konamiIndex === konamiCode.length) {
      konamiIndex = 0;
      activateKonamiMode();
    }
  } else {
    konamiIndex = normalizedKey === konamiCode[0] ? 1 : 0;
  }
}

function handleStatusDotClick() {
  dotClicks += 1;
  window.clearTimeout(dotTimer);
  dotTimer = window.setTimeout(() => {
    dotClicks = 0;
  }, 900);

  if (dotClicks >= 5) {
    dotClicks = 0;
    runLockdownSequence();
  }
}

function handleTapeNoteClick() {
  tapeClicks += 1;
  window.clearTimeout(tapeClickTimer);
  tapeClickTimer = window.setTimeout(() => {
    tapeClicks = 0;
  }, 1000);

  if (tapeClicks >= 3) {
    tapeClicks = 0;
    openPresenterVault();
  }
}

function handleTapeNoteKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openPresenterVault();
  }
}

function setupInteractions() {
  els.tiltCards.forEach(setupTilt);
  els.noiseButton.addEventListener("click", () => {
    const hadMode = activeMode !== null;
    clearActiveMode({
      announce: true,
      message: hadMode ? "Noise cleared. Default board restored." : "Board already clean. No hidden mode active."
    });
  });
  els.heroTitle.addEventListener("click", triggerGlitch);
  els.statusDot.addEventListener("click", handleStatusDotClick);
  els.tapeNote.addEventListener("click", handleTapeNoteClick);
  els.tapeNote.addEventListener("keydown", handleTapeNoteKeydown);
  els.presenterClose.addEventListener("click", closePresenterVault);
  els.presenterVaultBackdrop.addEventListener("click", closePresenterVault);
  document.addEventListener("keydown", handleKeydown);
}

setupInteractions();

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
