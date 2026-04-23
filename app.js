const reportUrl = "./data/report.json";

const els = {
  body: document.body,
  heroTitle: document.querySelector("#heroTitle"),
  noiseButton: document.querySelector("#noiseButton"),
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
  tiltCards: [...document.querySelectorAll("[data-tilt]")]
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

const easterEggs = {
  punk: {
    className: "mode-punk",
    title: "Punk Patch Loaded",
    tag: "typed: punk",
    ascii: [
      " .----------------. ",
      " | PUNK PATCH 01  | ",
      " | NO SNITCH DATA | ",
      " '----------------' "
    ].join("\n"),
    copy: "Same sanitized numbers, louder paint job. This is the class-demo flex version of the board.",
    hint: "You found the hidden word trigger. There is still one more cheat code hanging around."
  },
  dot: {
    className: "",
    title: "Status Dot Spill",
    tag: "clicked: dot",
    ascii: [
      " .------------. ",
      " |  o  o  o   | ",
      " | backstage  | ",
      " | diagnostic | ",
      " '------------' "
    ].join("\n"),
    copy: "That tiny light runs a fake backstage diagnostic because boring dashboards deserve consequences.",
    hint: "Rapid-click the status dot to pop this panel again during class."
  },
  konami: {
    className: "mode-konami",
    title: "Cheat Code Accepted",
    tag: "konami combo",
    ascii: [
      " .--------------------. ",
      " | UP UP DOWN DOWN    | ",
      " | LEFT RIGHT LEFT    | ",
      " | RIGHT B A          | ",
      " '--------------------' "
    ].join("\n"),
    copy: "Classic code, absurd reward. The board flips into full glitch-show mode without exposing a single private detail.",
    hint: "This one is excellent for the live demo. Hit the lights after it unlocks."
  }
};

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let toastTimer = 0;
let scanTimer = 0;
let glitchTimer = 0;
let dotClicks = 0;
let dotTimer = 0;
let keyBuffer = "";
let konamiIndex = 0;

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
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2200);
}

function triggerGlitch() {
  els.heroTitle.classList.remove("is-glitching");
  void els.heroTitle.offsetWidth;
  els.heroTitle.classList.add("is-glitching");
  clearTimeout(glitchTimer);
  glitchTimer = window.setTimeout(() => {
    els.heroTitle.classList.remove("is-glitching");
  }, 900);
}

function triggerNoise(message = "Board lights kicked.") {
  els.body.classList.remove("riot-scan");
  void els.body.offsetWidth;
  els.body.classList.add("riot-scan");
  clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    els.body.classList.remove("riot-scan");
  }, 1100);
  triggerGlitch();
  showToast(message);
}

function revealSecret(kind) {
  const egg = easterEggs[kind];

  if (!egg) {
    return;
  }

  if (egg.className) {
    els.body.classList.add(egg.className);
  }

  els.secretPanel.hidden = false;
  els.secretPanel.setAttribute("aria-hidden", "false");
  els.secretTitle.textContent = egg.title;
  els.secretTag.textContent = egg.tag;
  els.secretAscii.textContent = egg.ascii;
  els.secretCopy.textContent = egg.copy;
  els.secretHint.textContent = egg.hint;

  triggerNoise(`${egg.title} unlocked.`);

  if (!motionQuery.matches) {
    els.secretPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
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
  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  keyBuffer = `${keyBuffer}${normalizedKey}`.slice(-16);
  if (keyBuffer.includes("punk")) {
    keyBuffer = "";
    revealSecret("punk");
  }

  if (normalizedKey === konamiCode[konamiIndex]) {
    konamiIndex += 1;
    if (konamiIndex === konamiCode.length) {
      konamiIndex = 0;
      revealSecret("konami");
    }
  } else {
    konamiIndex = normalizedKey === konamiCode[0] ? 1 : 0;
  }
}

function handleStatusDotClick() {
  dotClicks += 1;
  clearTimeout(dotTimer);
  dotTimer = window.setTimeout(() => {
    dotClicks = 0;
  }, 900);

  if (dotClicks >= 5) {
    dotClicks = 0;
    revealSecret("dot");
  }
}

function setupInteractions() {
  els.tiltCards.forEach(setupTilt);
  els.noiseButton.addEventListener("click", () => {
    triggerNoise("Lights kicked. Board still sanitized.");
  });
  els.heroTitle.addEventListener("mouseenter", triggerGlitch);
  els.heroTitle.addEventListener("click", triggerGlitch);
  els.statusDot.addEventListener("click", handleStatusDotClick);
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
