/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Tickets module
// Support workflow: customer issue → ISO triages → (optionally) escalates
// to NPT → NPT investigates → replies to ISO → ISO closes loop with
// customer. ISO and NPT use the same platform but see different ticket
// queues based on status.
// ─────────────────────────────────────────────────────────────

const { useState: useStateT, useMemo: useMemoT, useEffect: useEffectT } = React;

// ─── Status, type & severity dictionaries ──────────────────
const TICKET_STATUS = {
  "new": { label: "New", tone: "info", short: "New" },
  "iso-working": { label: "Working (ISO)", tone: "info", short: "ISO" },
  "npt-working": { label: "Working (NPT)", tone: "warning", short: "NPT" },
  "npt-resolved": { label: "Replied", tone: "info", short: "Replied" },
  "closed": { label: "Closed", tone: "success", short: "Closed" }
};
// Order used by the top stepper + sort
const STATUS_ORDER = ["new", "iso-working", "npt-working", "npt-resolved", "closed"];

// UI-facing status buckets. "Working" collapses the ISO + NPT lanes
// into a single filter option — the underlying status still records
// which team holds it (so the row pill can render "Working (ISO)" vs
// "Working (NPT)"), but the filter UI surfaces only one Working choice
// and selecting it matches both internal statuses.
const STATUS_FILTER_BUCKETS = [
{ id: "new", label: "New", statuses: ["new"] },
{ id: "working", label: "Working", statuses: ["iso-working", "npt-working"] },
{ id: "npt-resolved", label: "Replied", statuses: ["npt-resolved"] },
{ id: "closed", label: "Closed", statuses: ["closed"] }];

const STATUS_TO_BUCKET = STATUS_FILTER_BUCKETS.reduce((acc, b) => {
  b.statuses.forEach((s) => {acc[s] = b.id;});
  return acc;
}, {});

const TICKET_TYPE = {
  "Payment Failure": { label: "Payment Failure", icon: "creditcard",
    bg: "color-mix(in oklab, var(--color-error-500) 12%, transparent)",
    fg: "var(--color-error-700)" },
  "Network Issue": { label: "Network Issue", icon: "link",
    bg: "var(--color-warning-50)",
    fg: "var(--color-warning-700)" },
  "Hardware": { label: "Hardware", icon: "device",
    bg: "oklch(94% 0.03 280)",
    fg: "oklch(40% 0.18 280)" },
  "App Crash": { label: "App Crash", icon: "alert",
    bg: "oklch(95% 0.04 40)",
    fg: "oklch(46% 0.16 40)" },
  "Security Alert": { label: "Security Alert", icon: "shield",
    bg: "oklch(95% 0.04 12)",
    fg: "oklch(46% 0.18 12)" },
  "Other": { label: "Other", icon: "doc",
    bg: "var(--bg3)",
    fg: "var(--fg2)" }
};
const TICKET_TYPES = Object.keys(TICKET_TYPE);

const TICKET_SEVERITY = {
  "low": { label: "Low", tone: "neutral", weight: 0 },
  "med": { label: "Medium", tone: "info", weight: 1 },
  "high": { label: "High", tone: "warning", weight: 2 },
  "critical": { label: "Critical", tone: "danger", weight: 3 }
};

// ─── Snapshot helper ───────────────────────────────────────
// Builds the "frozen" telemetry snapshot for a device at the moment a
// ticket is created. We don't import the full deviceTelemetryFor —
// instead we lift the subset the snapshot card actually renders. That
// keeps tickets self-contained and lets seed data declare any state
// (online/offline/flagged) without depending on the device's current
// scenario.
function buildSnapshotFor(device, overrides = {}) {
  if (!device) return null;
  const seed = device.sn.split("").reduce((a, c) => a * 31 + c.charCodeAt(0) & 0x7fffffff, 0);
  const cpu = 15 + seed % 50;
  const memTotal = device.model === "X800" ? 6 : 4;
  const memUsed = parseFloat((memTotal * (0.4 + seed % 40 / 100)).toFixed(1));
  const diskTotal = device.storage?.total || 32;
  const diskUsed = device.storage?.used ?? diskTotal * 0.35;
  const wifiOn = device.network.wifi.enabled;
  const cellOn = device.network.sim.enabled;
  const ethOn = device.network.ethernet.enabled;
  const isOnline = overrides.isOnline ?? device.state === "active";

  return {
    capturedAt: overrides.capturedAt || "May 15, 2026 14:32:08",
    runtime: {
      cpu: overrides.cpu ?? cpu,
      memUsed: overrides.memUsed ?? memUsed,
      memTotal,
      diskUsed: parseFloat(diskUsed.toFixed ? diskUsed.toFixed(1) : diskUsed),
      diskTotal,
      isOnline
    },
    network: {
      primary: overrides.networkPrimary ?? (
      ethOn ? "Ethernet" : wifiOn ? "Wi-Fi" : cellOn ? "Cellular" : "Offline"),
      wifi: wifiOn ? {
        ssid: device.network.wifi.ssid,
        signalDbm: -42 - (seed >> 2) % 38,
        ip: isOnline ? `192.168.${(seed >> 4) % 32}.${seed % 254 + 1}` : null
      } : null,
      cellular: cellOn ? {
        carrier: device.network.sim.carrier,
        signalDbm: -68 - (seed >> 5) % 32
      } : null,
      ethernet: ethOn ? { linkMbps: 1000 } : null
    },
    security: {
      rooted: device.hardware.root,
      devMode: device.hardware.devMode,
      warnings: device.hardware.securityWarnings || [],
      hwAttackCount: overrides.hwAttackCount ?? (device.hardware.root ? 12 + seed % 30 : seed % 4),
      swAttackCount: overrides.swAttackCount ?? (device.hardware.devMode ? 1 + seed % 6 : 0)
    },
    battery: device.battery ? {
      level: overrides.batteryLevel ?? device.battery.level,
      health: device.battery.health
    } : null,
    firmware: device.firmware,
    os: device.os,
    recentEvents: overrides.recentEvents || [
    { at: "14:31:52", kind: "tx-fail", detail: "EMV kernel timeout — Mastercard contactless" },
    { at: "14:31:48", kind: "tx-fail", detail: "EMV kernel timeout — Mastercard contactless" },
    { at: "14:31:44", kind: "tx-fail", detail: "EMV kernel timeout — Mastercard contactless" },
    { at: "14:31:40", kind: "tx-fail", detail: "EMV kernel timeout — Mastercard contactless" },
    { at: "14:30:12", kind: "tx-success", detail: "Approved · Visa contactless · $14.20" },
    { at: "14:28:03", kind: "boot", detail: "POS Pro 4.3.2 started" }]

  };
}

// ─── Seed data ─────────────────────────────────────────────
const TICKETS_SEED = [
{
  id: "T-2026-001",
  source: "auto",
  type: "Payment Failure",
  severity: "high",
  status: "new",
  deviceSn: "N950-0014-9281",
  title: "EMV kernel timeout — 4 declines in 90 s",
  description:
  "Customer terminal at register 2 attempted four consecutive contactless reads on the same Mastercard credit card and got 'EMV kernel timeout' each time. Cashier swapped to a different card and the transaction completed normally on the first try, so the card itself appears fine.",
  attachments: [
  { kind: "log", name: "emv-kernel-2026-05-15.log", size: "412 KB" },
  { kind: "screenshot", name: "terminal-error-1432.png", size: "186 KB" }],

  ai: {
    summary: "Likely EMV kernel clock-skew on the secure element.",
    steps: [
    "Open device monitoring → check System settings → confirm Auto time is enabled",
    "If Auto time is OFF, force NTP re-sync from the system tray",
    "Reboot the POS Pro process (Apps tab → restart) and retry the transaction",
    "If errors persist, escalate to NPT for SE firmware inspection"],

    confidence: 0.82,
    citedDocs: ["KB-1428 · EMV kernel timeout patterns", "KB-0091 · Secure element clock drift"],
    generatedAt: "May 15, 2026 14:32:18"
  },
  assignedTo: null,
  createdBy: "Cloud (auto)",
  createdAt: "May 15, 2026 14:32:08",
  updatedAt: "May 15, 2026 14:32:18",
  timeline: [
  { at: "May 15, 2026 14:32:08", actor: "Cloud", kind: "created",
    note: "Auto-created from device telemetry — 4 EMV kernel timeouts in 90 s" },
  { at: "May 15, 2026 14:32:18", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 4 steps · 82 % confidence" }],

  comments: [],
  snapshotOverride: { capturedAt: "May 15, 2026 14:32:08" },
  faultWindow: { start: "May 15, 2026 14:31:30", end: "May 15, 2026 14:32:30" },
  paymentReport: {
    mid: "m_8821_riverside",
    tid: "T-NEC400084496-01",
    processor: "Mastercard M/Chip Advance",
    appVersion: "POS-Pro 4.3.2",
    latestAppVersion: "4.3.3",
    androidVersion: "11",
    networkState: "LTE · -84 dBm",
    emvKernelVersion: "CB-EMVL2 v2.1.4",
    latestKernelVersion: "CB-EMVL2 v2.1.6",
    transactionRefNo: "TX-2026-05-15-1432-887122",
    errorCode: "0x6F00",
    errorMessage: "EMV kernel timeout",
    merchantNote: "Multiple contactless attempts on the same card all timed out. Swapping cards worked. Started after lunch rush."
  }
},
{
  id: "T-2026-002",
  source: "manual",
  type: "Network Issue",
  severity: "med",
  status: "iso-working",
  deviceSn: "N750-0099-0040",
  title: "Cellular drops every 20 minutes during the lunch rush",
  description:
  "Operator at Riverside Coffee — Old-Port called in to say their handheld N750 keeps falling back to Wi-Fi during peak hours. Their Wi-Fi at the back of the store is weak so transactions stall for ~30 s while the modem re-attaches.",
  attachments: [
  { kind: "log", name: "ril-2026-05-14.log", size: "1.2 MB" }],

  ai: {
    summary: "Pattern matches known Rogers LTE Cat-4 tower handover bug.",
    steps: [
    "Verify SIM has data left (Monitoring → SIM data usage)",
    "Toggle airplane mode on the device for 10 s to force a fresh attach",
    "If recurs more than once a day, raise to NPT to lock APN to Cat-6 only"],

    confidence: 0.71,
    citedDocs: ["KB-2207 · Rogers cellular handover symptoms"],
    generatedAt: "May 15, 2026 11:18:42"
  },
  assignedTo: "Maya Hassan (ISO)",
  createdBy: "Maya Hassan (ISO)",
  createdAt: "May 15, 2026 11:14:00",
  updatedAt: "May 15, 2026 11:18:42",
  timeline: [
  { at: "May 15, 2026 11:14:00", actor: "Maya Hassan", kind: "created",
    note: "Logged by ISO from a customer phone call" },
  { at: "May 15, 2026 11:18:42", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 71 % confidence" },
  { at: "May 15, 2026 11:19:10", actor: "Maya Hassan", kind: "status",
    note: "Started working on this ticket" }],

  comments: [
  { at: "May 15, 2026 11:21:02", actor: "Maya Hassan",
    body: "Called customer back. They tried airplane-mode toggle, it worked for 40 minutes then dropped again. Will keep monitoring before escalating." }],

  snapshotOverride: { capturedAt: "May 15, 2026 11:14:00", isOnline: true, networkPrimary: "Wi-Fi" },
  faultWindow: { start: "May 15, 2026 11:09:00", end: "May 15, 2026 11:14:00" }
},
{
  id: "T-2026-003",
  source: "auto",
  type: "Security Alert",
  severity: "critical",
  status: "npt-working",
  deviceSn: "N750-0099-0040",
  title: "Root state detected — bootloader unlocked",
  description:
  "TOMS agent flagged this handheld as rooted with a bootloader unlock signature. The device is still bound to a production merchant and was used to process $3,420 in transactions today before the flag fired.",
  attachments: [
  { kind: "log", name: "integrity-check-2026-05-15.log", size: "84 KB" }],

  ai: {
    summary: "Critical tamper — recommend immediate quarantine.",
    steps: [
    "Quarantine the device from the production fleet (Devices → Bind → Unbind)",
    "Audit the last 24 h of transactions for this SN with the merchant",
    "Escalate to NPT — only Engineering can issue an attestation reset"],

    confidence: 0.94,
    citedDocs: ["KB-0001 · Tamper response runbook", "POL-0017 · PCI integrity policy"],
    generatedAt: "May 15, 2026 09:02:30"
  },
  assignedTo: "Maya Hassan (ISO)",
  nptHandler: "TOMS NPT queue",
  createdBy: "Cloud (auto)",
  createdAt: "May 15, 2026 09:02:11",
  updatedAt: "May 15, 2026 10:14:08",
  nptGrants: {
    snapshot: true, logs: true, liveProbe: true, remoteDesktop: false,
    grantedAt: "May 15, 2026 10:14:08", grantedBy: "Maya Hassan (ISO)"
  },
  timeline: [
  { at: "May 15, 2026 09:02:11", actor: "Cloud", kind: "created",
    note: "Auto-created from integrity check failure on N750-0099-0040" },
  { at: "May 15, 2026 09:02:30", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 94 % confidence" },
  { at: "May 15, 2026 09:18:14", actor: "Maya Hassan", kind: "status",
    note: "Took ticket — started ISO triage" },
  { at: "May 15, 2026 09:42:55", actor: "Maya Hassan", kind: "comment",
    note: "Confirmed root state. Quarantined device. Need attestation reset → escalating." },
  { at: "May 15, 2026 10:14:08", actor: "Maya Hassan", kind: "escalation",
    note: "Escalated to NPT — requesting attestation reset & device forensic check" }],

  comments: [
  { at: "May 15, 2026 09:42:55", actor: "Maya Hassan",
    body: "Confirmed root state via remote check. Pulled the device out of the fleet — quarantined. Need attestation reset from Engineering to safely re-bind." },
  { at: "May 15, 2026 10:14:08", actor: "Maya Hassan",
    body: "Escalating to NPT. Forensics: please confirm whether any txns in the last 24 h are at risk." }],

  snapshotOverride: { capturedAt: "May 15, 2026 09:02:11" },
  faultWindow: { start: "May 15, 2026 08:55:00", end: "May 15, 2026 09:02:30" },
  deviceReport: {
    faultCode: "security.rooted-bootloader-unlock",
    faultMessage: "Bootloader unlock signature detected",
    component: "Secure key area",
    mid: "m_4471_glacier",
    tid: "T-N750-0099-0040",
    appVersion: "POS-Pro 4.3.2",
    androidVersion: "11",
    networkState: "LTE · -78 dBm"
  }
},
{
  id: "T-2026-004",
  source: "manual",
  type: "Hardware",
  severity: "med",
  status: "npt-working",
  deviceSn: "X800-0099-1422",
  title: "Kiosk thermal printer cuts every other receipt in half",
  description:
  "Operator reports the X800 self-service kiosk at Glacier Grocers (Burnaby) is producing a torn cut on roughly every second receipt. Replacing the paper roll didn't help. Started this morning around 08:40 local.",
  attachments: [
  { kind: "screenshot", name: "printer-status.png", size: "94 KB" },
  { kind: "log", name: "printer-driver-2026-05-15.log", size: "228 KB" }],

  ai: {
    summary: "Likely cutter motor wear — common after ~250 K cuts.",
    steps: [
    "Pull the print head log: count total cuts (System param: printer.cuts_total)",
    "If > 200 000, this is mechanical wear → RMA the cutter assembly",
    "If < 200 000, escalate to NPT to inspect the firmware (cutter step calibration)"],

    confidence: 0.67,
    citedDocs: ["KB-3014 · X800 printer cutter lifecycle"],
    generatedAt: "May 14, 2026 16:48:00"
  },
  assignedTo: "Maya Hassan (ISO)",
  nptHandler: "Hossein Naderi (NPT)",
  createdBy: "Maya Hassan (ISO)",
  createdAt: "May 14, 2026 16:42:00",
  updatedAt: "May 15, 2026 08:11:22",
  nptGrants: {
    snapshot: true, logs: true, liveProbe: true, remoteDesktop: false,
    grantedAt: "May 14, 2026 17:39:00", grantedBy: "Maya Hassan (ISO)"
  },
  timeline: [
  { at: "May 14, 2026 16:42:00", actor: "Maya Hassan", kind: "created", note: "Logged by ISO" },
  { at: "May 14, 2026 16:48:00", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 67 % confidence" },
  { at: "May 14, 2026 16:52:30", actor: "Maya Hassan", kind: "status", note: "Started working" },
  { at: "May 14, 2026 17:38:09", actor: "Maya Hassan", kind: "comment",
    note: "Cut counter is 148 320 — below the wear threshold. Escalating for firmware check." },
  { at: "May 14, 2026 17:39:00", actor: "Maya Hassan", kind: "escalation",
    note: "Escalated to NPT" },
  { at: "May 15, 2026 08:11:22", actor: "Hossein Naderi", kind: "status",
    note: "NPT picked up — investigating cutter step calibration" }],

  comments: [
  { at: "May 14, 2026 17:38:09", actor: "Maya Hassan",
    body: "Cut counter is 148 320 — below wear threshold. Escalating for firmware check." }],

  snapshotOverride: { capturedAt: "May 14, 2026 16:42:00" },
  faultWindow: { start: "May 14, 2026 16:35:00", end: "May 14, 2026 16:42:00" }
},
{
  id: "T-2026-005",
  source: "manual",
  type: "App Crash",
  severity: "high",
  status: "npt-resolved",
  deviceSn: "N950-0014-3322",
  title: "POS Pro 4.3.2 crashes on opening tip screen (CAD market)",
  description:
  "Riverside Coffee HQ — every time the cashier presses the 'tip' button on POS Pro 4.3.2, the app crashes and they have to re-enter the order. Only happens in CAD. Started May 12 after the auto-update.",
  attachments: [
  { kind: "log", name: "pos-pro-crash-trace.txt", size: "412 KB" }],

  ai: {
    summary: "Stack trace matches a known fmt_currency NPE in 4.3.2.",
    steps: [
    "Confirm app version is 4.3.2 (Apps tab on device detail)",
    "Roll the merchant back to 4.3.1 from the App Publish → Versions page",
    "If rollback isn't possible right away, set tip behavior to 'preset' to avoid the crash"],

    confidence: 0.88,
    citedDocs: ["KB-4112 · POS Pro 4.3.2 known issues"],
    generatedAt: "May 13, 2026 10:08:20"
  },
  assignedTo: "Maya Hassan (ISO)",
  nptHandler: "Hossein Naderi (NPT)",
  createdBy: "Maya Hassan (ISO)",
  createdAt: "May 13, 2026 10:02:00",
  updatedAt: "May 14, 2026 14:22:15",
  nptGrants: {
    snapshot: true, logs: true, liveProbe: false, remoteDesktop: false,
    grantedAt: "May 13, 2026 11:00:00", grantedBy: "Maya Hassan (ISO)"
  },
  timeline: [
  { at: "May 13, 2026 10:02:00", actor: "Maya Hassan", kind: "created", note: "Logged by ISO" },
  { at: "May 13, 2026 10:08:20", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 88 % confidence" },
  { at: "May 13, 2026 10:55:00", actor: "Maya Hassan", kind: "comment",
    note: "Rolled merchant back to 4.3.1 — crash gone but customer wants a fix on 4.3.x" },
  { at: "May 13, 2026 11:00:00", actor: "Maya Hassan", kind: "escalation",
    note: "Escalated to NPT for a hotfix on 4.3.x" },
  { at: "May 13, 2026 13:42:18", actor: "Hossein Naderi", kind: "status",
    note: "NPT picked up — reproducing locally" },
  { at: "May 14, 2026 14:22:15", actor: "Hossein Naderi", kind: "resolution",
    note: "NPT replied to ISO — hotfix 4.3.3 published, see comments" }],

  comments: [
  { at: "May 13, 2026 10:55:00", actor: "Maya Hassan",
    body: "Rolled merchant back to 4.3.1 — crash gone but customer wants a fix on 4.3.x." },
  { at: "May 14, 2026 14:22:15", actor: "Hossein Naderi",
    body: "Reproduced. fmt_currency() NPE in CAD locale when tip percentage strings are missing the en-CA fallback. Fix is in POS Pro 4.3.3 — published to the public pool 5 minutes ago. Please push it to Riverside Coffee at your discretion, and resume 4.3.x track." }],

  snapshotOverride: { capturedAt: "May 13, 2026 10:02:00" },
  faultWindow: { start: "May 13, 2026 09:55:00", end: "May 13, 2026 10:02:00" }
},
{
  id: "T-2026-006",
  source: "manual",
  type: "Other",
  severity: "low",
  status: "closed",
  deviceSn: "N950-0014-9281",
  title: "How do I change the receipt header logo?",
  description:
  "Operator emailed asking how to upload a new logo for printed receipts. Pure how-to, no defect.",
  attachments: [],
  ai: {
    summary: "How-to — point operator at the merchant settings UI.",
    steps: [
    "Merchant detail → Settings tab → Receipt branding",
    "Upload a 300 × 80 PNG, transparent background",
    "Hit 'Push to fleet' to roll out to all bound terminals"],

    confidence: 0.97,
    citedDocs: ["KB-0501 · Receipt branding"],
    generatedAt: "May 12, 2026 09:14:00"
  },
  assignedTo: "Maya Hassan (ISO)",
  createdBy: "Maya Hassan (ISO)",
  createdAt: "May 12, 2026 09:12:00",
  updatedAt: "May 12, 2026 09:28:00",
  timeline: [
  { at: "May 12, 2026 09:12:00", actor: "Maya Hassan", kind: "created", note: "Logged by ISO" },
  { at: "May 12, 2026 09:14:00", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 97 % confidence" },
  { at: "May 12, 2026 09:18:00", actor: "Maya Hassan", kind: "comment",
    note: "Sent instructions to customer" },
  { at: "May 12, 2026 09:28:00", actor: "Maya Hassan", kind: "status",
    note: "Customer confirmed working — closed" }],

  comments: [
  { at: "May 12, 2026 09:18:00", actor: "Maya Hassan",
    body: "Walked them through the steps. They had it sorted in 4 minutes." }],

  snapshotOverride: { capturedAt: "May 12, 2026 09:12:00" },
  faultWindow: { start: "May 12, 2026 09:05:00", end: "May 12, 2026 09:12:00" }
},
{
  id: "T-2026-007",
  source: "auto",
  type: "Network Issue",
  severity: "low",
  status: "closed",
  deviceSn: "X800-0099-1422",
  title: "Ethernet link flapped 6 × in 5 min (recovered)",
  description:
  "Kiosk Ethernet auto-flap alarm fired at 02:14 (overnight). Link recovered after the 6th cycle and no transactions failed. Logged for record.",
  attachments: [],
  ai: {
    summary: "Likely PoE switch flap — recovered without intervention.",
    steps: [
    "If flap recurs the following night, ask the merchant to check the PoE switch port",
    "Otherwise, no further action"],

    confidence: 0.78,
    citedDocs: ["KB-1809 · Ethernet flap noise floor"],
    generatedAt: "May 11, 2026 02:14:30"
  },
  assignedTo: "Maya Hassan (ISO)",
  createdBy: "Cloud (auto)",
  createdAt: "May 11, 2026 02:14:08",
  updatedAt: "May 11, 2026 09:01:00",
  timeline: [
  { at: "May 11, 2026 02:14:08", actor: "Cloud", kind: "created", note: "Auto-created — Ethernet flap" },
  { at: "May 11, 2026 02:14:30", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 78 % confidence" },
  { at: "May 11, 2026 09:01:00", actor: "Maya Hassan", kind: "status",
    note: "Closed — no recurrence overnight" }],

  comments: [],
  snapshotOverride: { capturedAt: "May 11, 2026 02:14:08" },
  faultWindow: { start: "May 11, 2026 02:09:00", end: "May 11, 2026 02:14:30" },
  deviceReport: {
    faultCode: "network.ethernet-flap",
    faultMessage: "Ethernet link flapped 6× in 5 min",
    component: "Ethernet",
    mid: "m_4471_glacier",
    tid: "T-X800-0099-1422",
    appVersion: "POS-Pro 4.3.2",
    androidVersion: "11",
    networkState: "Ethernet · 100 Mbps (flapping)"
  }
},
{
  id: "T-2026-008",
  source: "manual",
  type: "Payment Failure",
  severity: "high",
  status: "iso-working",
  deviceSn: "S60-0488-0021",
  title: "Inserted-chip reads fail with code 6985 on all cards",
  description:
  "Café Plateau cashier reports every inserted-chip transaction returns 'EMV 6985 — condition not satisfied'. Contactless works fine on the same device. Has been failing for ~2 hours.",
  attachments: [
  { kind: "log", name: "icc-2026-05-15.log", size: "320 KB" },
  { kind: "screenshot", name: "error-6985.png", size: "112 KB" }],

  ai: {
    summary: "Most likely AID priority configuration drift on the ICC kernel.",
    steps: [
    "Open device monitoring → Security module switches → confirm 'Insert (chip)' is enabled",
    "Re-collect telemetry to refresh the ICC kernel state",
    "If still failing, escalate to NPT — they have an internal tool to re-deploy AID priorities"],

    confidence: 0.74,
    citedDocs: ["KB-3201 · ICC 6985 patterns"],
    generatedAt: "May 15, 2026 13:42:00"
  },
  assignedTo: "Maya Hassan (ISO)",
  createdBy: "Maya Hassan (ISO)",
  createdAt: "May 15, 2026 13:40:00",
  updatedAt: "May 15, 2026 13:50:11",
  timeline: [
  { at: "May 15, 2026 13:40:00", actor: "Maya Hassan", kind: "created", note: "Logged by ISO" },
  { at: "May 15, 2026 13:42:00", actor: "AI Assistant", kind: "ai",
    note: "Suggested resolution generated · 3 steps · 74 % confidence" },
  { at: "May 15, 2026 13:50:11", actor: "Maya Hassan", kind: "status",
    note: "Started working — running remote detect" }],

  comments: [],
  snapshotOverride: { capturedAt: "May 15, 2026 13:40:00" },
  faultWindow: { start: "May 15, 2026 13:30:00", end: "May 15, 2026 13:40:00" }
}];


// Initialise window cache — preserves edits across navigations.
window.TICKETS = window.TICKETS || TICKETS_SEED.map((t) => ({ ...t }));

function findTicketById(id) {
  return (window.TICKETS || []).find((t) => t.id === id) || null;
}

// Inferred origin — payment-exception (auto + payment data), device-exception
// (auto, non-payment), or manual. Lets us avoid stamping the field on every
// existing mock ticket explicitly.
function ticketOrigin(t) {
  if (!t) return "manual";
  if (t.origin) return t.origin;
  if (t.source === "auto" && t.paymentReport) return "payment-exception";
  if (t.source === "auto") return "device-exception";
  return "manual";
}
function openTicketsForDevice(sn) {
  return (window.TICKETS || []).filter((t) => t.deviceSn === sn && t.status !== "closed");
}
function ticketsForRole(role) {
  // ISO: anything not currently in NPT's hands.
  // NPT: anything in NPT's queue or being worked on by NPT.
  const all = window.TICKETS || [];
  if (role === "NPT") return all.filter((t) => ["npt-working", "npt-resolved"].includes(t.status));
  return all;
}
function currentRole() {
  const tenant = window.__activeTenant;
  if (!tenant) return "ISO";
  if (tenant.contracts?.includes("NPT")) return "NPT";
  return "ISO";
}
// Identity used for "Mine" scope. Mirrors the actor strings written
// into ticket.assignedTo (ISO) / ticket.nptHandler (NPT).
function currentUser() {
  return currentRole() === "NPT" ? "Hossein Naderi (NPT)" : "Maya Hassan (ISO)";
}
// 'Mine' means: I'm responsible for this ticket right now.
//   • ISO is the case owner across the whole lifecycle — match assignedTo
//   • NPT is only on-the-hook while it's in NPT's lane — match nptHandler
function isMine(ticket, me = currentUser()) {
  if (currentRole() === "NPT") return ticket.nptHandler === me;
  return ticket.assignedTo === me;
}

// Team rosters used by the Assign dialog. Keyed by role — ISO sees their
// ISO peers, NPT sees the engineering bench. The queue entries let an
// operator un-claim a ticket back to the shared inbox.
const TICKET_ROSTER = {
  ISO: [
  { id: "Maya Hassan (ISO)", name: "Maya Hassan", sub: "ISO · Tier-2 · you", self: true },
  { id: "Sarah Chen (ISO)", name: "Sarah Chen", sub: "ISO · Tier-2 · payments specialist" },
  { id: "Diego Alvarez (ISO)", name: "Diego Alvarez", sub: "ISO · Tier-2 · hardware lead" },
  { id: "Priya Nair (ISO)", name: "Priya Nair", sub: "ISO · Tier-1 · merchant onboarding" },
  { id: "Omar Haddad (ISO)", name: "Omar Haddad", sub: "ISO · Tier-1 · weekend shift" },
  { id: "TOMS ISO queue", name: "Back to ISO queue", sub: "Unassign — anyone on the team can pick it up", queue: true }],

  NPT: [
  { id: "Hossein Naderi (NPT)", name: "Hossein Naderi", sub: "NPT · Senior · you", self: true },
  { id: "Lin Wei (NPT)", name: "Lin Wei", sub: "NPT · Senior · firmware / kernel" },
  { id: "Adrian Schmidt (NPT)", name: "Adrian Schmidt", sub: "NPT · Mid · payments runtime" },
  { id: "Yuki Tanaka (NPT)", name: "Yuki Tanaka", sub: "NPT · Mid · device security" },
  { id: "TOMS NPT queue", name: "Back to NPT queue", sub: "Unassign — anyone on engineering can pick it up", queue: true }]

};

// ─── List screen ───────────────────────────────────────────
function TicketsListScreen({ navigate }) {
  const role = currentRole();
  const me = currentUser();
  const all = useMemoT(() => ticketsForRole(role), [role]);
  // Scope cut — 'mine' vs 'all'. Persisted per-role so ISO and NPT each
  // remember their preferred default. Falls back to 'mine' first time.
  const scopeKey = `tickets.scope.${role}`;
  const [scope, setScope] = useStateT(() => {
    try {return localStorage.getItem(scopeKey) || "mine";} catch {return "mine";}
  });
  useEffectT(() => {
    try {localStorage.setItem(scopeKey, scope);} catch {}
  }, [scope, scopeKey]);
  const [q, setQ] = useStateT("");
  // Status filter is a multi-select dropdown of UI buckets (New / Working
  // / Replied / Closed). Working covers both iso-working and npt-working.
  // Default excludes 'closed' so the operator sees only open tickets.
  const [statusFilters, setStatusFilters] = useStateT(() => {
    const s = new Set(STATUS_FILTER_BUCKETS.map((b) => b.id));
    s.delete("closed");
    return s;
  });
  const [typeFilter, setTypeFilter] = useStateT("any");
  const [sevFilter, setSevFilter] = useStateT("any");
  const [sourceFilter, setSourceFilter] = useStateT("any");
  // Assignee filter only meaningful in the 'all' scope — in 'mine' the
  // list is already narrowed to the current user.
  const [assigneeFilter, setAssigneeFilter] = useStateT("any");
  // Distinct assignees that appear on visible tickets, sorted alphabetically.
  // Queue entries sort last so they don't crowd the human names at the top.
  // ISO filters by case owner (assignedTo); NPT filters by investigator (nptHandler).
  const assigneeField = role === "NPT" ? "nptHandler" : "assignedTo";
  const assigneeOptions = useMemoT(() => {
    const names = new Set();
    all.forEach((t) => {if (t[assigneeField]) names.add(t[assigneeField]);});
    return [...names].sort((a, b) => {
      const aQ = a.toLowerCase().includes("queue");
      const bQ = b.toLowerCase().includes("queue");
      if (aQ !== bQ) return aQ ? 1 : -1;
      return a.localeCompare(b);
    });
  }, [all, assigneeField]);

  // Filter predicate shared by both chip counts and the visible list,
  // so the numbers on Mine/All always reflect 'what you'd actually see
  // if you switched to that scope right now' (with current filters).
  const matchesFilters = (t) => {
    const bucket = STATUS_TO_BUCKET[t.status];
    if (!statusFilters.has(bucket)) return false;
    if (typeFilter !== "any" && t.type !== typeFilter) return false;
    if (sevFilter !== "any" && t.severity !== sevFilter) return false;
    if (sourceFilter !== "any" && t.source !== sourceFilter) return false;
    if (q) {
      const n = q.toLowerCase();
      if (!`${t.id} ${t.title} ${t.deviceSn} ${t.type}`.toLowerCase().includes(n)) return false;
    }
    return true;
  };
  const mineList = useMemoT(() => all.filter((t) => isMine(t, me) && t.status !== "new" && t.status !== "closed" && matchesFilters(t)),
  [all, me, statusFilters, typeFilter, sevFilter, sourceFilter, q]);
  const allList = useMemoT(() => all.filter((t) => matchesFilters(t) && (scope === "all" ? assigneeFilter === "any" ?
  true :
  assigneeFilter === "__unassigned" ? !t[assigneeField] : t[assigneeField] === assigneeFilter : true)),
  [all, statusFilters, typeFilter, sevFilter, sourceFilter, q, scope, assigneeFilter, assigneeField]);
  const mineCount = mineList.length;
  const allCount = allList.length;

  const filtered = useMemoT(() => (scope === "mine" ? mineList : allList).slice().sort((a, b) => {
    // sort by status order, then updatedAt desc
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  }), [scope, mineList, allList]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <window.PageHeader
        title="Tickets"
        subtitle={role === "NPT" ?
        "Tickets escalated to the TOMS platform team for investigation." :
        "Customer-reported and auto-generated tickets. Triage, resolve, or escalate to NPT."}
        actions={
        <window.Button primary icon="plus"
        onClick={() => navigate({ screen: "newTicket" })}>New ticket</window.Button>
        }
        tabs={
        <div role="tablist" aria-label="Ticket scope"
        style={{ display: "flex", gap: 28, alignItems: "flex-end", width: "100%" }}>
            {[
          { id: "mine", label: "Mine", count: mineCount },
          { id: "all", label: "All", count: allCount }].
          map((s) => {
            const on = scope === s.id;
            return (
              <button key={s.id} role="tab" aria-selected={on}
              onClick={() => setScope(s.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 0",
                border: 0, background: "transparent",
                color: on ? "var(--fg1)" : "var(--fg3)",
                fontFamily: "inherit",
                fontSize: 14, fontWeight: on ? 600 : 500,
                cursor: "pointer",
                position: "relative",
                transition: "color .15s ease"
              }}
              onMouseEnter={(e) => {if (!on) e.currentTarget.style.color = "var(--fg2)";}}
              onMouseLeave={(e) => {if (!on) e.currentTarget.style.color = "var(--fg3)";}}>
                  <span>{s.label}</span>
                  <span className="mono num" style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "1px 8px", borderRadius: 999,
                  background: "var(--bg3)",
                  color: "var(--fg2)",
                  border: "1px solid var(--border-1)",
                  minWidth: 20, textAlign: "center"
                }}>{s.count}</span>
                  {on &&
                <span style={{
                  position: "absolute", left: 0, right: 0, bottom: -1,
                  height: 2, background: "var(--fg1)", borderRadius: 2
                }} />
                }
                </button>);

          })}
          </div>
        } />

      <div style={{ flex: 1, overflow: "auto", background: "var(--color-bg-1)" }}>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "var(--space-5) var(--space-6) var(--space-3)", flexWrap: "wrap" }}>
          <window.Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search ID, title, device SN…"
          prefix={<window.Ico name="search" size={12} />}
          style={{ flex: 1, minWidth: 240, maxWidth: 380 }} />
          <StatusFilterDropdown buckets={STATUS_FILTER_BUCKETS}
          value={statusFilters} onChange={setStatusFilters} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyleT}>
            <option value="any">All types</option>
            {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} style={selectStyleT}>
            <option value="any">All severities</option>
            {Object.keys(TICKET_SEVERITY).map((s) => <option key={s} value={s}>{TICKET_SEVERITY[s].label}</option>)}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyleT}>
            <option value="any">All sources</option>
            <option value="auto">Auto (cloud)</option>
            <option value="manual">Manual (ISO)</option>
          </select>
          {scope === "all" &&
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
          style={selectStyleT} title="Filter by assignee">
              <option value="any">All assignees</option>
              <option value="__unassigned">— Unassigned —</option>
              {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          }
          <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Table */}
        <div style={{ padding: "var(--space-3) var(--space-6) var(--space-6)" }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-1)" }}>
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg3)", textAlign: "left" }}>
                    {["ID", "Source", "Type", "Title", "Device", "Sev", "Status",
                    ...(scope === "mine" ? [] : ["Assignee"]),
                    "Updated", ""].map((h, i) =>
                    <th key={i} className="overline" style={{
                      padding: "10px 14px", fontSize: 10.5,
                      borderBottom: "1px solid var(--border-1)",
                      whiteSpace: "nowrap"
                    }}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 &&
                  <tr><td colSpan={scope === "mine" ? 9 : 10} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)" }}>
                      {scope === "mine" && mineCount === 0 ?
                      <span>Nothing is assigned to you.{" "}
                            <button onClick={() => setScope("all")} style={{
                          background: "transparent", border: 0, padding: 0,
                          color: "var(--color-primary-600)", cursor: "pointer",
                          fontFamily: "inherit", fontSize: "inherit",
                          textDecoration: "underline", textUnderlineOffset: 2
                        }}>Switch to All tickets →</button>
                          </span> :
                      "No tickets match those filters."}
                    </td></tr>
                  }
                  {filtered.map((t) => {
                    const st = TICKET_STATUS[t.status] || TICKET_STATUS.new;
                    const ty = TICKET_TYPE[t.type] || TICKET_TYPE.Other;
                    const sv = TICKET_SEVERITY[t.severity] || TICKET_SEVERITY.low;
                    return (
                      <tr key={t.id}
                      onClick={() => navigate({ screen: "ticketDetail", ticketId: t.id })}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border-1)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{t.id}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <SourceChip source={t.source} />
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <TypeChip type={t.type} compact />
                        </td>
                        <td style={{ padding: "12px 14px", maxWidth: 320 }}>
                          <div style={{ fontSize: 12.5, color: "var(--fg1)", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.title}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{t.deviceSn}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <window.Pill tone={sv.tone} dot size="sm">{sv.label}</window.Pill>
                        </td>
                        <td style={{ padding: "12px 14px", minWidth: 0 }}>
                          <div style={{
                            display: "flex", flexDirection: "column", gap: 3,
                            alignItems: "flex-start", minWidth: 0
                          }}>
                            <window.Pill tone={st.tone} dot size="sm">{st.label}</window.Pill>
                            {t.nptHandler && ["npt-working", "npt-resolved"].includes(t.status) &&
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              maxWidth: "100%", minWidth: 0,
                              fontSize: 10.5, color: "var(--fg3)",
                              fontFamily: "var(--font-family-mono)"
                            }} title={t.nptHandler}>
                                <window.Ico name="arrowR" size={9} stroke={1.8}
                              style={{ flexShrink: 0 }} />
                                <span style={{
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap", minWidth: 0
                              }}>NPT:{" "}{/queue/i.test(t.nptHandler) ?
                                <em style={{ fontStyle: "italic" }}>queue</em> :
                                t.nptHandler.replace(/\s*\(NPT\)\s*$/, "")}</span>
                              </span>
                            }
                          </div>
                        </td>
                        {scope !== "mine" &&
                        <td style={{ padding: "12px 14px" }}>
                            <AssigneeCell value={t[assigneeField]} me={me} />
                          </td>
                        }
                        <td style={{ padding: "12px 14px", fontSize: 11.5, color: "var(--fg2)" }}>
                          <span className="mono">{t.updatedAt}</span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <window.Ico name="chevr" size={14} style={{ color: "var(--fg3)" }} />
                        </td>
                      </tr>);

                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

// ─── Fault time-window picker ──────────────────────────────
// Quick presets row + a "Custom" tab that reveals two datetime-local
// inputs. The cloud uses the chosen window to scope a log pull at
// ticket-creation time.
function toLocalIso(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const FAULT_PRESETS = [
{ id: "15min", label: "Last 15 min" },
{ id: "30min", label: "Last 30 min" },
{ id: "1h", label: "Last 1 hour" },
{ id: "2h", label: "Last 2 hours" },
{ id: "custom", label: "Custom" }];

function FaultWindowPicker({ preset, onPreset, customStart, customEnd,
  onCustomStart, onCustomEnd, nowAnchor }) {
  // When "Custom" is first selected, seed the inputs to a 30-minute window
  // ending at the anchor so the operator has a starting point.
  React.useEffect(() => {
    if (preset !== "custom") return;
    if (!customEnd) onCustomEnd(nowAnchor);
    if (!customStart) {
      const end = new Date(nowAnchor);
      const start = new Date(end.getTime() - 30 * 60 * 1000);
      onCustomStart(toLocalIso(start));
    }
  }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FAULT_PRESETS.map((p) => {
          const on = preset === p.id;
          return (
            <button key={p.id} type="button" onClick={() => onPreset(p.id)}
            style={{
              padding: "5px 12px", borderRadius: "var(--radius-sm)",
              background: on ? "var(--color-primary-50)" : "var(--bg2)",
              color: on ? "var(--color-primary-700)" : "var(--fg2)",
              border: "1px solid " + (on ?
              "color-mix(in oklab, var(--color-primary-500) 25%, transparent)" :
              "var(--border-1)"),
              fontSize: 11.5, fontWeight: on ? 500 : 400,
              cursor: "pointer", fontFamily: "inherit"
            }}>{p.label}</button>);

        })}
      </div>
      {preset === "custom" &&
      <div style={{ display: "grid",
        gridTemplateColumns: "1fr 1fr", gap: 10,
        padding: 10,
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)"
      }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="overline" style={{ fontSize: 9.5 }}>Start</span>
            <input type="datetime-local" value={customStart}
          onChange={(e) => onCustomStart(e.target.value)}
          style={faultTimeInput} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="overline" style={{ fontSize: 9.5 }}>End</span>
            <input type="datetime-local" value={customEnd}
          onChange={(e) => onCustomEnd(e.target.value)}
          style={faultTimeInput} />
          </label>
        </div>
      }
    </div>);

}
const faultTimeInput = {
  padding: "6px 10px",
  background: "var(--bg1)",
  border: "1px solid var(--border-1)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-family-mono)", fontSize: 12,
  color: "var(--fg1)"
};

// ─── Device picker (dual-mode search) ──────────────────────
// Two search paths to the same outcome (a single device SN):
//   1. "By SN"            — substring match on normalized SN (strip
//                          dashes/spaces). Backward-compatible: typing
//                          the last 6 digits OR the full SN both work.
//   2. "By Merchant/Store" — substring match on merchant.name and
//                          store.name. Results grouped merchant →
//                          store → devices; stores auto-expand on
//                          query, default-collapsed when browsing.
//
// Once a device is picked, the search UI collapses to a compact
// "selected device" card with a Change button.
const normSn = (s) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

// ─── DevicePicker (A · Twin Lanes) ──────────────────────────
// SN input + Merchant/Store selector live side-by-side; both narrow
// the SAME candidate list. No tab switching — operators don't have
// to choose a path before they start. Empty state surfaces terminals
// the operator has recently ticketed so same-device repeat reports
// are one click.
function DevicePicker({ value, onChange }) {
  const allDevices = window.PROD_DEVICES || [];
  const selectedDevice = value ? allDevices.find((d) => d.sn === value) : null;
  const [snQ, setSnQ] = useStateT("");
  const [merchantId, setMerchantId] = useStateT(null);
  const [storeId, setStoreId] = useStateT(null);
  const [activeIdx, setActiveIdx] = useStateT(0);

  const normSnQ = normSn(snQ);
  const candidates = useMemoT(() => {
    let list = allDevices;
    if (merchantId) list = list.filter((d) => d.merchantId === merchantId);
    if (storeId) list = list.filter((d) => d.storeId === storeId);
    if (normSnQ) list = list.filter((d) => normSn(d.sn).includes(normSnQ));
    return list;
  }, [allDevices, merchantId, storeId, normSnQ]);

  useEffectT(() => {setActiveIdx(0);}, [snQ, merchantId, storeId]);

  // Global ⌘K (Ctrl-K on Linux/Windows) refocuses the SN input.
  // Uses a data attribute selector so we don't need to forward refs
  // through the design-system Input wrapper.
  useEffectT(() => {
    if (selectedDevice) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "k") {
        const el = document.querySelector("[data-dp-sn-input]");
        if (el) {e.preventDefault();el.focus();el.select && el.select();}
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDevice]);

  if (selectedDevice) {
    return <DevicePickerSelected device={selectedDevice}
    onClear={() => {
      onChange("");
      setSnQ("");setMerchantId(null);setStoreId(null);
    }} />;
  }

  const hasFilter = !!(normSnQ || merchantId || storeId);

  // Arrow-key navigation across the candidate list, bound to the SN
  // input so operators never have to leave the keyboard.
  const onSnKey = (e) => {
    const items = candidates;
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[Math.min(activeIdx, items.length - 1)];
      if (pick) onChange(pick.sn);
    }
  };

  return (
    <div style={{
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      background: "var(--bg2)"
    }}>
      {/* ── Lane 1 · Quick by SN ─────────────────────────────── */}
      <DPLane title="Quick by SN" iconName="search">
        <window.Input
          value={snQ}
          onChange={(e) => setSnQ(e.target.value)}
          onKeyDown={onSnKey}
          placeholder="Last 6 digits or full SN — e.g. 149281"
          prefix={<window.Ico name="search" size={12} />}
          suffix={normSnQ ?
          <button type="button" onClick={() => setSnQ("")}
          title="Clear" style={{
            padding: 2, color: "var(--fg3)",
            display: "inline-flex", cursor: "pointer"
          }}>
              <window.Ico name="x" size={11} />
            </button> :
          null}
          mono
          autoFocus
          data-dp-sn-input="true" />
      </DPLane>

      {/* AND / OR rule between the two lanes */}
      <div style={{
        padding: "3px 0", textAlign: "center",
        background: "var(--bg3)",
        color: "var(--fg3)",
        fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase",
        fontWeight: 600,
        borderTop: "1px solid var(--color-border-subtle)",
        borderBottom: "1px solid var(--color-border-subtle)",
        fontFamily: "var(--font-family-sans)"
      }}>and / or</div>

      {/* ── Lane 2 · By customer ─────────────────────────────── */}
      <DPLane title="By customer" iconName="store"
      right={merchantId || storeId ?
      <button type="button"
      onClick={() => {setMerchantId(null);setStoreId(null);}}
      style={{
        color: "var(--fg3)", fontSize: 11,
        padding: "2px 6px", cursor: "pointer",
        fontFamily: "var(--font-family-sans)",
        borderRadius: 3
      }}>Clear scope</button> :
      null}>
        <DPCustomerScope
          merchantId={merchantId} storeId={storeId}
          onMerchant={(m) => {setMerchantId(m);setStoreId(null);}}
          onStore={setStoreId} />
      </DPLane>

      {/* ── Candidate list (filter intersection OR empty hint) ── */}
      <div style={{
        background: "var(--bg1)",
        borderTop: "1px solid var(--color-border-subtle)",
        maxHeight: 320, overflow: "auto",
        borderRadius: "0 0 calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px)"
      }}>
        {hasFilter ?
        <DPCandidates candidates={candidates} normSnQ={normSnQ}
        activeIdx={activeIdx} setActiveIdx={setActiveIdx}
        onPick={onChange} /> :

        <DPEmpty
          title="Type an SN or pick a merchant / store to see candidates."
          hint="Both lanes filter the same list — use either, or both for a tighter match." />
        }
      </div>
    </div>);

}

// Selected state — compact card replacing the picker once a device is
// chosen. Mirrors the visual language of LinkedDeviceCard on the
// ticket detail page so the user recognises the device immediately.
function DevicePickerSelected({ device, onClear }) {
  const merchant = window.findMerchantById?.(device.merchantId);
  const store = merchant?.stores?.find((s) => s.id === device.storeId);
  const isOnline = device.state === "active";
  return (
    <div style={{
      padding: "12px 14px",
      background: "color-mix(in oklab, var(--color-primary-600) 7%, transparent)",
      border: "1px solid color-mix(in oklab, var(--color-primary-500) 32%, transparent)",
      borderRadius: "var(--radius-md)",
      display: "flex", alignItems: "center", gap: 12
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(155deg, oklch(28% 0.05 232) 0%, oklch(38% 0.07 232) 100%)",
        color: "#dde2f0", display: "grid", placeItems: "center",
        fontSize: 11, fontWeight: 700,
        fontFamily: "var(--font-family-mono)",
        letterSpacing: "-0.02em"
      }}>{device.model.slice(0, 2)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg1)" }}>
            {device.sn}
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{device.model}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10.5, color: isOnline ? "var(--color-success-700)" : "var(--fg3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: isOnline ? "var(--success)" : "var(--border-2)" }} />
            {isOnline ? "online" : "offline"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {merchant ?
          <span><b style={{ fontWeight: 500, color: "var(--fg1)" }}>{merchant.name}</b>
              {store && <> · {store.name}{store.isHQ ? " (HQ)" : ""}</>}</span> :
          "Unbound"}
        </div>
      </div>
      <button type="button" onClick={onClear}
      style={{
        padding: "6px 12px",
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-sm)",
        fontSize: 11.5, color: "var(--fg2)", fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
        display: "inline-flex", alignItems: "center", gap: 5
      }}
      onMouseEnter={(e) => {e.currentTarget.style.background = "var(--bg3)";e.currentTarget.style.color = "var(--fg1)";}}
      onMouseLeave={(e) => {e.currentTarget.style.background = "var(--bg2)";e.currentTarget.style.color = "var(--fg2)";}}>
        <window.Ico name="refresh" size={11} stroke={2} />
        Change
      </button>
    </div>);

}

// ─── Lane wrapper (uppercase label + slot for content) ──────
function DPLane({ title, iconName, right, children }) {
  return (
    <div style={{ background: "var(--bg2)", padding: "12px 14px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 8,
        fontSize: 10.5, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: "var(--fg3)",
        fontFamily: "var(--font-family-sans)"
      }}>
        {iconName && <window.Ico name={iconName} size={11} stroke={1.8}
        style={{ color: "var(--fg3)" }} />}
        <span>{title}</span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      {children}
    </div>);

}

function DPKbd({ children }) {
  return (
    <kbd style={{
      fontFamily: "var(--font-family-mono)",
      fontSize: 10,
      padding: "1px 5px",
      background: "var(--bg3)",
      border: "1px solid var(--color-border-default)",
      borderRadius: 3,
      color: "var(--fg2)",
      lineHeight: 1.2
    }}>{children}</kbd>);

}

// ─── Customer scope (merchant + store typeahead with chips) ──
// Single search input that dynamically searches across merchants AND
// their stores while no merchant is pinned. Once a merchant chip is
// added, the same input becomes a within-merchant store filter. Picking
// a store result auto-pins its merchant — saves a second click.
function DPCustomerScope({ merchantId, storeId, onMerchant, onStore }) {
  const merchants = window.MERCHANTS || [];
  const merchant = merchantId ? merchants.find((m) => m.id === merchantId) : null;
  const store = merchant && storeId ?
  merchant.stores?.find((s) => s.id === storeId) : null;

  const [q, setQ] = useStateT("");
  const [open, setOpen] = useStateT(false);
  const wrapRef = React.useRef(null);

  useEffectT(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Result shape depends on whether a merchant is already pinned:
  //   • no merchant → search merchants + stores together
  //   • merchant pinned → search filters this merchant's stores
  const results = useMemoT(() => {
    const nq = q.trim().toLowerCase();
    if (merchant) {
      const stores = (merchant.stores || []).
      filter((s) => !nq || s.name.toLowerCase().includes(nq));
      return { mode: "stores", stores };
    }
    const hits = [];
    for (const m of merchants) {
      const merchantHit = !nq || m.name.toLowerCase().includes(nq);
      if (merchantHit) hits.push({ kind: "merchant", merchant: m });
      if (nq) {
        for (const s of m.stores || []) {
          if (s.name.toLowerCase().includes(nq) && !merchantHit) {
            hits.push({ kind: "store", merchant: m, store: s });
          }
        }
      }
      if (hits.length > 40) break;
    }
    return { mode: "mixed", hits };
  }, [q, merchant, merchants]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Active scope chips */}
      {(merchant || store) &&
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {merchant &&
        <DPChip iconName="store" label={merchant.name}
        onClear={() => {onMerchant(null);onStore(null);setQ("");}} />
        }
          {store &&
        <DPChip label={store.name + (store.isHQ ? " (HQ)" : "")}
        onClear={() => onStore(null)} />
        }
        </div>
      }

      {/* Search input — hidden when both merchant + store already pinned. */}
      {!store &&
      <window.Input
        value={q}
        onChange={(e) => {setQ(e.target.value);setOpen(true);}}
        onFocus={() => setOpen(true)}
        placeholder={merchant ?
        `Filter stores in ${merchant.name}…` :
        "Search merchant or store name — e.g. Riverside"}
        prefix={<window.Ico name="search" size={12} />}
        suffix={q ?
        <button type="button" onClick={() => setQ("")}
        style={{ padding: 2, color: "var(--fg3)", display: "inline-flex", cursor: "pointer" }}>
              <window.Ico name="x" size={11} />
            </button> :
        null} />
      }

      {/* Floating result panel */}
      {open && !store &&
      <div style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
        zIndex: 30,
        background: "var(--bg2)",
        border: "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
        overflow: "hidden",
        maxHeight: 260,
        overflowY: "auto"
      }}>
          {results.mode === "stores" ?
        results.stores.length === 0 ?
        <DPEmpty title="No store matches." /> :

        <>
                <DPDropHead>Stores in {merchant.name}</DPDropHead>
                {results.stores.map((s) =>
          <DPDropRow key={s.id}
          onClick={() => {onStore(s.id);setQ("");setOpen(false);}}>
                    <window.Ico name="store" size={12}
            style={{ color: "var(--fg3)", flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: 12.5, color: "var(--fg1)" }}>
                      <DPHilite text={s.name} q={q.toLowerCase()} />
                    </span>
                    {s.isHQ &&
            <span style={{
              fontSize: 8.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
              background: "var(--color-primary-50)", color: "var(--color-primary-700)",
              letterSpacing: "0.06em", fontFamily: "var(--font-family-mono)"
            }}>HQ</span>
            }
                  </DPDropRow>
          )}
              </> :

        results.hits.length === 0 ?
        <DPEmpty title={`No merchant or store matches "${q}".`} /> :

        <>
              <DPDropHead>{q ? `Matches for "${q}"` : "All merchants"}</DPDropHead>
              {results.hits.slice(0, 20).map((h) => h.kind === "merchant" ?
          <DPDropRow key={"m-" + h.merchant.id}
          onClick={() => {onMerchant(h.merchant.id);setQ("");setOpen(false);}}>
                  <window.Ico name="store" size={12}
            style={{ color: "var(--fg3)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: 12.5, color: "var(--fg1)", fontWeight: 500 }}>
                    <DPHilite text={h.merchant.name} q={q.toLowerCase()} />
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--fg3)",
              fontFamily: "var(--font-family-mono)", flexShrink: 0 }}>
                    {(h.merchant.stores || []).length} store{(h.merchant.stores || []).length === 1 ? "" : "s"}
                  </span>
                </DPDropRow> :

          <DPDropRow key={"s-" + h.store.id}
          onClick={() => {
            onMerchant(h.merchant.id);
            onStore(h.store.id);
            setQ("");setOpen(false);
          }}>
                  <span style={{ flexShrink: 0, color: "var(--fg3)", paddingLeft: 14, display: "inline-flex" }}>
                    <window.Ico name="chevr" size={10} stroke={2} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: 12.5, color: "var(--fg1)" }}>
                    <DPHilite text={h.store.name} q={q.toLowerCase()} />
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--fg3)",
              flexShrink: 0,
              fontFamily: "var(--font-family-sans)" }}>
                    in {h.merchant.name}
                  </span>
                </DPDropRow>
          )}
            </>
        }
        </div>
      }
    </div>);

}

function DPChip({ iconName, label, onClear }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 4px 3px 9px",
      background: "color-mix(in oklab, var(--color-primary-500) 12%, transparent)",
      border: "1px solid color-mix(in oklab, var(--color-primary-500) 32%, transparent)",
      borderRadius: 999,
      fontSize: 11.5, color: "var(--color-primary-700)",
      fontFamily: "var(--font-family-sans)",
      fontWeight: 500
    }}>
      {iconName && <window.Ico name={iconName} size={10} stroke={2}
      style={{ color: "var(--color-primary-700)" }} />}
      <span style={{ maxWidth: 200, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button type="button" onClick={onClear}
      title="Remove" style={{
        padding: 2, color: "var(--color-primary-700)",
        opacity: 0.7, display: "inline-flex", cursor: "pointer",
        borderRadius: 999
      }}>
        <window.Ico name="x" size={10} stroke={2.4} />
      </button>
    </span>);

}

function DPDropHead({ children }) {
  return (
    <div style={{
      padding: "6px 12px",
      background: "var(--bg3)",
      fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--fg3)", fontWeight: 600,
      fontFamily: "var(--font-family-sans)",
      borderBottom: "1px solid var(--color-border-subtle)"
    }}>{children}</div>);

}

function DPDropRow({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
    style={{
      display: "flex", width: "100%", padding: "8px 12px",
      alignItems: "center", gap: 8, textAlign: "left",
      background: "transparent", border: 0,
      borderBottom: "1px solid var(--color-border-subtle)",
      cursor: "pointer", fontFamily: "inherit"
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {children}
    </button>);

}

// ─── Candidate list (intersection of SN + scope filters) ────
function DPCandidates({ candidates, normSnQ, activeIdx, setActiveIdx, onPick }) {
  if (candidates.length === 0) {
    return <DPEmpty
      title="No terminals match the current filters."
      hint="Loosen the SN digits, or clear the merchant / store scope." />;
  }
  const shown = candidates.slice(0, 60);
  return (
    <div>
      <div style={{
        padding: "6px 12px",
        fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--fg3)", fontWeight: 600,
        fontFamily: "var(--font-family-sans)",
        borderBottom: "1px solid var(--color-border-subtle)",
        background: "var(--bg2)",
        display: "flex", alignItems: "center", gap: 6
      }}>
        <span>Candidates · narrowed by your filters</span>
        <span style={{ marginLeft: "auto", color: "var(--fg3)",
          fontFamily: "var(--font-family-mono)", letterSpacing: 0,
          textTransform: "none" }}>
          {candidates.length}
        </span>
      </div>
      {shown.map((d, i) =>
      <DPCandidateRow key={d.sn}
      device={d} normSnQ={normSnQ}
      active={i === activeIdx}
      onHover={() => setActiveIdx(i)}
      onPick={() => onPick(d.sn)} />
      )}
      {candidates.length > 60 &&
      <div style={{
        padding: "10px 14px", textAlign: "center",
        fontSize: 11, color: "var(--fg3)",
        fontFamily: "var(--font-family-sans)",
        borderTop: "1px solid var(--color-border-subtle)"
      }}>+ {candidates.length - 60} more — narrow the scope to see them.</div>
      }
    </div>);

}

function DPCandidateRow({ device, normSnQ, active, onHover, onPick }) {
  const merchant = window.findMerchantById?.(device.merchantId);
  const store = merchant?.stores?.find((s) => s.id === device.storeId);
  const isOnline = device.state === "active";
  const openCount = (window.openTicketsForDevice?.(device.sn) || []).length;

  // Selection fires on mousedown (not click) so it pre-empts any
  // outside-click handler that might be racing — the merchant-search
  // dropdown above us listens on document mousedown to close itself,
  // and we don't want that re-render to interfere with picking a row.
  // mousedown also wins against the SN input's blur, which fires
  // between mousedown and click and could swallow focus mid-flight.
  const handlePick = (e) => {
    // Left mouse button only; ignore right-clicks etc.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    onPick();
  };

  return (
    <button type="button"
    onMouseDown={handlePick}
    onClick={handlePick}
    onMouseEnter={onHover}
    style={{
      display: "flex", width: "100%",
      padding: active ? "10px 14px 10px 11px" : "10px 14px",
      alignItems: "center", gap: 12, textAlign: "left",
      background: active ? "var(--bg-hover)" : "transparent",
      border: 0,
      borderBottom: "1px solid var(--color-border-subtle)",
      borderLeft: active ? "3px solid var(--color-primary-600)" : "3px solid transparent",
      cursor: "pointer", fontFamily: "inherit"
    }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>
            <DPHiliteSn text={device.sn} normQ={normSnQ} />
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{device.model}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, color: isOnline ? "var(--color-success-700)" : "var(--fg3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: isOnline ? "var(--success)" : "var(--border-2)" }} />
            {isOnline ? "online" : "offline"}
          </span>
          {openCount > 0 &&
          <span title={`This terminal has ${openCount} unresolved ticket(s) — check before opening another.`}
          style={{
            padding: "1px 6px", borderRadius: 999,
            fontSize: 10, fontWeight: 600,
            background: "color-mix(in oklab, var(--color-warning-500) 14%, transparent)",
            color: "var(--color-warning-700)",
            fontFamily: "var(--font-family-sans)"
          }}>{openCount} open</span>
          }
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fg2)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "var(--font-family-sans)" }}>
          {merchant?.name || "Unbound"}
          {store && <> · {store.name}{store.isHQ ? " (HQ)" : ""}</>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0,
        fontSize: 10, color: "var(--fg3)",
        fontFamily: "var(--font-family-mono)" }}>
        {device.lastSeen || "—"}
      </div>
    </button>);

}

// Highlights a substring match inside the SN text. Both sides are
// normalized (lower-case, dashes/spaces stripped) before searching, so
// typing "149281" correctly highlights "0014-9281" in "N950-0014-9281".
function DPHiliteSn({ text, normQ }) {
  if (!normQ) return <>{text}</>;
  const normText = normSn(text);
  const startInNorm = normText.indexOf(normQ);
  if (startInNorm === -1) return <>{text}</>;
  // Map normalized indices back to original positions.
  let normIdx = 0;
  let oStart = -1,oEnd = -1;
  for (let i = 0; i < text.length; i++) {
    const isAlnum = /[a-z0-9]/i.test(text[i]);
    if (isAlnum) {
      if (normIdx === startInNorm) oStart = i;
      if (normIdx === startInNorm + normQ.length - 1) {oEnd = i + 1;break;}
      normIdx++;
    }
  }
  if (oStart === -1 || oEnd === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, oStart)}
      <span style={dpHiliteStyle}>{text.slice(oStart, oEnd)}</span>
      {text.slice(oEnd)}
    </>);

}

// Plain case-insensitive substring highlight (for merchant + store names).
function DPHilite({ text, q }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={dpHiliteStyle}>{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>);

}
const dpHiliteStyle = {
  background: "color-mix(in oklab, var(--color-primary-500) 24%, transparent)",
  color: "var(--color-primary-700)",
  fontWeight: 600,
  padding: "0 2px", borderRadius: 2
};

function DPEmpty({ title, hint }) {
  return (
    <div style={{ padding: "32px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 12.5, color: "var(--fg2)", marginBottom: 6,
        textWrap: "pretty" }}>{title}</div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--fg3)",
        textWrap: "pretty" }}>{hint}</div>}
    </div>);

}

function DPFooter({ children }) {
  return (
    <div style={{
      padding: "6px 14px",
      fontSize: 10.5, color: "var(--fg3)",
      background: "var(--bg2)",
      borderTop: "1px solid var(--color-border-subtle)",
      textAlign: "right",
      fontFamily: "var(--font-family-mono)"
    }}>{children}</div>);

}


// ─── Title field (with AI shimmer + source badge) ──────────
// Wraps an input that doubles as the autosaved Title for a new ticket.
// • Loading: shows a moving shimmer bar over the input + a spinner glyph.
// • AI:      stamps a small ✨ AI badge on the right.
// • Slice:   stamps a tiny "auto" badge.
// • Manual:  shows a `n / max` counter.
// The component is presentational — the parent owns all state.
function TitleField({ value, onChange, loading, source, max }) {
  const showAi    = source === "ai"    && !loading;
  const showSlice = source === "slice" && !loading;
  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes ttlShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(220%);  }
        }
      `}</style>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={loading ? "" : "Auto-summarised — click to edit"}
        maxLength={max}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "8px 92px 8px 12px",
          fontFamily: "inherit", fontSize: 13, lineHeight: 1.4,
          background: loading ? "var(--bg2)" : "var(--bg1)",
          border: "1px solid",
          borderColor: loading ? "color-mix(in oklab, var(--color-primary-500) 35%, transparent)"
                               : "var(--border-1)",
          borderRadius: "var(--radius-md)",
          color: loading ? "var(--fg3)" : "var(--fg1)",
          transition: "background .15s ease, border-color .15s ease",
        }} />
      {/* Shimmer bar — overlays the input while AI is drafting */}
      {loading && (
        <span aria-hidden style={{
          position: "absolute", inset: 1,
          borderRadius: "var(--radius-md)",
          overflow: "hidden", pointerEvents: "none",
        }}>
          <span style={{
            display: "block",
            position: "absolute", top: 0, bottom: 0, left: 0, width: "40%",
            background: "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-primary-500) 18%, transparent) 50%, transparent 100%)",
            animation: "ttlShimmer 1.4s ease-in-out infinite",
          }} />
        </span>
      )}
      {/* Right-aligned status badge */}
      <span style={{
        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
        display: "inline-flex", alignItems: "center", gap: 5,
        pointerEvents: "none",
      }}>
        {loading && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "1px 7px", borderRadius: 999,
            background: "color-mix(in oklab, var(--color-primary-500) 10%, transparent)",
            color: "var(--color-primary-700)",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
          }}>
            <span aria-hidden style={{
              width: 9, height: 9, borderRadius: "50%",
              border: "1.5px solid var(--color-primary-200)",
              borderTopColor: "var(--color-primary-600)",
              animation: "spin .7s linear infinite",
            }} />
            <span style={{ fontFamily: "var(--font-family-mono)" }}>AI</span>
          </span>
        )}
        {showAi && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "1px 7px", borderRadius: 999,
            background: "color-mix(in oklab, var(--color-primary-500) 12%, transparent)",
            color: "var(--color-primary-700)",
            border: "1px solid color-mix(in oklab, var(--color-primary-500) 25%, transparent)",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
            fontFamily: "var(--font-family-mono)",
          }} title="Generated by Carbon AI — click the field to override">
            <window.Ico name="sparkle" size={9} stroke={2} /> AI
          </span>
        )}
        {showSlice && (
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "1px 6px", borderRadius: 999,
            background: "var(--bg3)", color: "var(--fg3)",
            border: "1px solid var(--border-1)",
            fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em",
            fontFamily: "var(--font-family-mono)",
            textTransform: "uppercase",
          }} title="Auto-trimmed from description (no AI)">AUTO</span>
        )}
        {!loading && !showAi && !showSlice && value && (
          <span className="mono num" style={{
            fontSize: 10.5, color: "var(--fg3)",
          }}>{value.length}/{max}</span>
        )}
      </span>
    </div>
  );
}

// ─── New ticket form ───────────────────────────────────────
// Used by both roles. ISO logs customer-reported tickets that enter
// the standard triage flow; NPT logs internal tickets that go
// straight to "npt-working" with the NPT operator on the case.
function NewTicketScreen({ navigate, presetSn }) {
  const allDevices = window.PROD_DEVICES || [];
  const [sn, setSn] = useStateT(presetSn || "");
  const [type, setType] = useStateT("Payment Failure");
  const [severity, setSeverity] = useStateT("med");
  const [title, setTitle] = useStateT("");
  // Title source — drives the right-side badge on the Title input.
  //   'empty'  — no description yet
  //   'ai'     — last successful Claude summary
  //   'slice'  — deterministic fallback (first ≤30 chars of desc)
  //   'manual' — operator has typed; AI suggestions disabled
  const [titleSource, setTitleSource] = useStateT("empty");
  const [titleLoading, setTitleLoading] = useStateT(false);
  // Race-guard: every debounce request bumps this counter; the resolver
  // only commits if it still matches when the response lands.
  const titleReqRef = React.useRef(0);
  const titleTouched = titleSource === "manual";
  const [description, setDescription] = useStateT("");

  // Fault window — a preset bucket OR a custom datetime range. The cloud
  // uses this window to auto-pull device logs at submit time. Default is
  // "last 30 minutes" relative to the anchor below; the picker lets the
  // operator override with explicit ISO timestamps when they know the
  // exact moment of failure.
  const NOW_ANCHOR = "2026-05-15T14:55";
  const [windowPreset, setWindowPreset] = useStateT("30min");
  const [customStart, setCustomStart] = useStateT("");
  const [customEnd, setCustomEnd] = useStateT("");
  const computeWindow = () => {
    if (windowPreset === "custom") {
      return { start: customStart || NOW_ANCHOR, end: customEnd || NOW_ANCHOR };
    }
    const mins = { "15min": 15, "30min": 30, "1h": 60, "2h": 120 }[windowPreset] || 30;
    const end = new Date(NOW_ANCHOR);
    const start = new Date(end.getTime() - mins * 60 * 1000);
    return { start: toLocalIso(start), end: toLocalIso(end) };
  };

  const matchedDevice = allDevices.find((d) => d.sn === sn);

  // Title is optional — when blank we auto-summarise from the description.
  // Description is the required free-text field.
  const trimmedDesc = description.trim();
  const canSubmit = sn && matchedDevice && trimmedDesc.length > 4;

  // Deterministic fallback: clip the description to a short headline.
  // Used when the AI call hasn't returned yet, fails, or the description
  // is too short to be worth summarising. Hard cap at TITLE_MAX so the
  // ticket-list cell never overflows.
  const TITLE_MAX = 30;
  const summariseTitle = (desc) => {
    const flat = desc.replace(/\s+/g, " ").trim();
    if (!flat) return "";
    const sentenceEnd = flat.search(/[。.!?！？]\s|[。.!?！？]$/);
    let cut = sentenceEnd > 0 ? flat.slice(0, sentenceEnd) : flat;
    if (cut.length <= TITLE_MAX) return cut;
    const slice = cut.slice(0, TITLE_MAX - 1);
    const lastSpace = slice.lastIndexOf(" ");
    return (lastSpace > 12 ? slice.slice(0, lastSpace) : slice) + "…";
  };

  // Strip wrapping quotes / trailing punctuation Claude likes to add,
  // then hard-clip to TITLE_MAX so we never blow the visual cap.
  const cleanAiTitle = (raw) => {
    if (!raw) return "";
    let s = String(raw).trim()
      .replace(/^["'“‘「『]+|["'”’」』]+$/g, "")
      .replace(/[。.!?！？]+$/g, "")
      .trim();
    if (s.length > TITLE_MAX) s = s.slice(0, TITLE_MAX - 1).trimEnd() + "…";
    return s;
  };

  // Debounced AI summary. Fires ≈700 ms after the operator stops typing
  // in Description; while in flight, the Title field shows a shimmer.
  // Falls back to the slice helper on failure / short input / missing
  // claude bridge. Suspends entirely once the operator has typed in the
  // Title field — once it's "manual" we never overwrite their text.
  useEffectT(() => {
    if (titleTouched) return;
    if (trimmedDesc.length < 8) {
      setTitleLoading(false);
      titleReqRef.current++;
      setTitle("");
      setTitleSource("empty");
      return;
    }
    const myReq = ++titleReqRef.current;
    setTitleLoading(true);
    const fallback = () => {
      if (titleReqRef.current !== myReq) return;
      setTitle(summariseTitle(trimmedDesc));
      setTitleSource("slice");
      setTitleLoading(false);
    };
    const timer = setTimeout(async () => {
      if (titleReqRef.current !== myReq) return;
      // No claude bridge in this build — fall back to deterministic slice.
      if (typeof window.claude?.complete !== "function") {
        fallback();
        return;
      }
      try {
        const prompt =
`Generate a concise support-ticket title (≤30 characters, 4–7 words).
Output ONLY the title. No quotes, no trailing punctuation.

Type: ${type}
Severity: ${TICKET_SEVERITY[severity]?.label || severity}
Description: ${trimmedDesc}`;
        const out = await window.claude.complete(prompt);
        if (titleReqRef.current !== myReq) return; // a newer request superseded us
        const cleaned = cleanAiTitle(out);
        if (!cleaned) { fallback(); return; }
        setTitle(cleaned);
        setTitleSource("ai");
        setTitleLoading(false);
      } catch (e) {
        fallback();
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedDesc, type, severity, titleTouched]);

  const submit = () => {
    if (!canSubmit) return;
    const faultWindow = computeWindow();
    const tickets = window.TICKETS || [];
    const nextNum = String(tickets.length + 1).padStart(3, "0");
    const now = "May 15, 2026 14:55:00";
    const finalTitle = title.trim() || summariseTitle(trimmedDesc) || "(Untitled ticket)";
    // Tag the ticket based on who's creating it. NPT-internal tickets
    // never leave the NPT lane, so they jump straight to "npt-working"
    // with the NPT operator on both createdBy and nptHandler. ISO-logged
    // tickets enter the standard ISO triage flow.
    const role = currentRole();
    const isNpt = role === "NPT";
    const me = currentUser();
    const newTicket = {
      id: `T-2026-${nextNum}`,
      source: "manual", type, severity,
      // NPT-logged tickets are flagged as 'internal' so the detail
      // screen can drop the ISO-facing actions (no Reply to ISO, no
      // npt-resolved "Replied" status — they belong to NPT end-to-end
      // and close directly).
      origin: isNpt ? "internal" : "manual",
      status: isNpt ? "npt-working" : "new",
      deviceSn: sn,
      title: finalTitle,
      description: trimmedDesc,
      attachments: [
      // Cloud auto-pulled a log slice covering the fault window.
      { kind: "log", name: `pulled-${faultWindow.start.replace(/[^0-9]/g, "").slice(0, 12)}.log`,
        size: "812 KB" }],

      ai: null, // generated after submit
      assignedTo: isNpt ? null : "Maya Hassan (ISO)",
      nptHandler: isNpt ? me : undefined,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
      timeline: [
      { at: now, actor: me.replace(/ \(.+\)$/, ""), kind: "created",
        note: isNpt ? "Logged by NPT (internal)" : "Logged by ISO" }],

      comments: [],
      snapshotOverride: { capturedAt: now },
      faultWindow,
      _aiPending: true
    };
    tickets.unshift(newTicket);
    window.showToast?.(`Ticket ${newTicket.id} created · AI analysing…`, "success");
    navigate({ screen: "ticketDetail", ticketId: newTicket.id });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <window.PageHeader
        title="New ticket"
        subtitle={currentRole() === "NPT"
          ? "Log an NPT-internal ticket — stays inside the NPT lane and is assigned to you. AI will analyse the description and propose a resolution after you submit."
          : "Log a customer-reported issue. AI will analyse it and propose a resolution as soon as you submit."} />

      <div style={{ flex: 1, overflow: "auto", background: "var(--color-bg-1)" }}>
        <div className="page-content--narrow" style={{ padding: "var(--space-6)" }}>
          <window.Card padding={20}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Device picker — dual-mode search (By SN / By Merchant·Store).
                    Once a device is selected the picker collapses to a
                    compact selected-state card with a Change button. */}
              <window.Field label="Device serial number" required
              hint="Type SN digits, pick a merchant/store, or both — both lanes filter the same candidate list.">
                <DevicePicker value={sn} onChange={setSn} />
              </window.Field>

              {/* Type + severity in a row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <window.Field label="Type" required>
                  <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyleT}>
                    {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </window.Field>
                <window.Field label="Severity" required>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={selectStyleT}>
                    {Object.keys(TICKET_SEVERITY).map((s) =>
                    <option key={s} value={s}>{TICKET_SEVERITY[s].label}</option>)}
                  </select>
                </window.Field>
              </div>

              <window.Field label="Title"
              hint={titleTouched
                ? <span><span className="mono">{title.length}</span> / {TITLE_MAX} — short summary of the issue.</span>
                : titleLoading
                ? <span>Drafting a short headline from the description…</span>
                : titleSource === "ai"
                ? <span>AI-generated headline (≤{TITLE_MAX} chars). Click the field to override.</span>
                : titleSource === "slice"
                ? <span>Auto-trimmed from description. Click the field to override.</span>
                : <span>Optional — leave blank to auto-summarise from the description below.</span>}>
                <TitleField
                  value={title}
                  onChange={(v) => {
                    setTitle(v.slice(0, TITLE_MAX));
                    setTitleSource(v.length === 0 ? "empty" : "manual");
                    setTitleLoading(false);
                    titleReqRef.current++; // cancel any inflight AI request
                  }}
                  loading={titleLoading}
                  source={titleSource}
                  max={TITLE_MAX} />
              </window.Field>

              <window.Field label="Description" required
              hint="Paste what the customer said. Drives both the AI suggestion and the auto-summarised title.">
                <window.Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What did the customer see? When did it start? Has this happened before?"
                rows={5} />
              </window.Field>

              {/* Fault time window — preset + custom picker. The cloud will pull
                    device logs covering this range and pre-attach them to the ticket. */}
              <window.Field label="Fault time window" required
              hint="Cloud pulls device logs for this range and attaches them so the workbench opens with the right context.">
                <FaultWindowPicker preset={windowPreset} onPreset={setWindowPreset}
                customStart={customStart} customEnd={customEnd}
                onCustomStart={setCustomStart} onCustomEnd={setCustomEnd}
                nowAnchor={NOW_ANCHOR} />
              </window.Field>

              <div style={{
                padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px dashed var(--color-border-subtle)",
                borderRadius: "var(--radius-md)",
                fontSize: 11.5, color: "var(--fg3)", lineHeight: 1.55
              }}>
                <b style={{ color: "var(--fg2)" }}>Note:</b> when you submit, the cloud will freeze a snapshot of the device's
                runtime state (CPU, network, security flags, recent events) and pull a slice of device logs
                covering the fault window above. Both attach to the ticket so the workbench opens with context.
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <window.Button onClick={() => navigate({ screen: "tickets" })}>Cancel</window.Button>
                <window.Button primary icon="plus" disabled={!canSubmit} onClick={submit}>
                  Create ticket
                </window.Button>
              </div>
            </div>
          </window.Card>
        </div>
      </div>
    </div>);

}

// ─── Detail screen ─────────────────────────────────────────
function TicketDetailScreen({ ticket, navigate }) {
  const role = currentRole();
  const device = window.findDeviceBySn?.(ticket.deviceSn);
  const merchant = device ? window.findMerchantById?.(device.merchantId) : null;
  const snapshot = useMemoT(
    () => buildSnapshotFor(device, ticket.snapshotOverride || {}),
    [ticket.id, device?.sn]
  );

  const [confirmAction, setConfirmAction] = useStateT(null);
  const [escalateOpen, setEscalateOpen] = useStateT(false);
  const [replyOpen, setReplyOpen] = useStateT(false);
  const [replyCloseOpen, setReplyCloseOpen] = useStateT(false);
  // NPT-internal tickets close with a resolution note (no customer
  // reply, no ISO handoff). Separate dialog state so it doesn't
  // collide with the ISO-side replyClose flow.
  const [internalCloseOpen, setInternalCloseOpen] = useStateT(false);
  const [assignOpen, setAssignOpen] = useStateT(false);
  // Reopen requires a confirmation modal with a mandatory comment so
  // the audit trail captures *why* a closed ticket is being revived.
  const [reopenOpen, setReopenOpen] = useStateT(false);
  const [previewAttachment, setPreviewAttachment] = useStateT(null);
  const [comment, setComment] = useStateT("");
  // AI generation simulation for freshly-created tickets.
  const [aiState, setAiState] = useStateT(ticket._aiPending ? "loading" : "ready");
  useEffectT(() => {
    if (!ticket._aiPending) return;
    const t = setTimeout(() => {
      // generate a generic suggestion
      ticket.ai = {
        summary: "Based on similar past incidents, the most likely cause is a device-side configuration drift.",
        steps: [
        "Refresh device telemetry (Monitoring tab → Re-collect)",
        "Verify Security module switches are all enabled for the affected payment path",
        "If problem persists, run a remote diagnostic — escalate to NPT if it returns red"],

        confidence: 0.7,
        citedDocs: ["KB-0000 · Generic triage playbook"],
        generatedAt: "May 15, 2026 14:55:30"
      };
      ticket._aiPending = false;
      setAiState("ready");
    }, 1800);
    return () => clearTimeout(t);
  }, [ticket.id]);

  // Status transitions — drives the action buttons.
  const transitions = useMemoT(() => {
    const out = [];
    if (role === "ISO") {
      if (ticket.status === "new") {
        out.push({ id: "take", label: "Take & open workbench", icon: "external", primary: true,
          to: "iso-working", toast: "Ticket taken — opening workbench",
          claim: true,
          afterApply: () => window.openWorkbenchInNewWindow?.(ticket.id) });
      }
      if (ticket.status === "iso-working" || ticket.status === "npt-resolved") {
        out.push({ id: "escalate", label: "Escalate to NPT", icon: "upload",
          to: "npt-working", toast: "Escalated to NPT", danger: true,
          customDialog: "escalate"
        });
        out.push({ id: "close-customer", label: "Reply to customer & close", icon: "check", primary: true,
          to: "closed", toast: "Ticket closed — customer notified",
          customDialog: "replyClose"
        });
      }
      if (ticket.status === "closed") {
        out.push({ id: "reopen", label: "Reopen", icon: "refresh",
          to: "iso-working", toast: "Ticket reopened",
          customDialog: "reopen" });
      }
    } else if (role === "NPT") {
      const isInternal = ticketOrigin(ticket) === "internal";
      // NPT take: status is already npt-working when escalated; the
      // signal that nobody on NPT owns it yet is nptHandler === queue.
      if (ticket.status === "npt-working" && ticket.nptHandler === "TOMS NPT queue") {
        out.push({ id: "npt-take", label: "Take & open workbench", icon: "external", primary: true,
          to: "npt-working", toast: "NPT taking ticket — opening workbench",
          claim: true,
          afterApply: () => window.openWorkbenchInNewWindow?.(ticket.id) });
      }
      if (ticket.status === "npt-working" && ticket.nptHandler !== "TOMS NPT queue") {
        if (isInternal) {
          // NPT-internal: no ISO to reply to and no customer waiting on
          // the other end. Close it directly with a resolution note —
          // skip the npt-resolved ("Replied") interstitial entirely.
          out.push({ id: "npt-internal-close", label: "Close ticket", icon: "check", primary: true,
            to: "closed", toast: "Ticket closed",
            customDialog: "internalClose"
          });
        } else {
          out.push({ id: "npt-reply", label: "Reply to ISO", icon: "upload", primary: true,
            to: "npt-resolved", toast: "Reply sent to ISO",
            customDialog: "reply"
          });
        }
      }
      // NPT-internal closed tickets stay in NPT's lane, so NPT can
      // reopen them directly (no need to bounce through ISO).
      if (ticket.status === "closed" && isInternal) {
        out.push({ id: "npt-internal-reopen", label: "Reopen", icon: "refresh",
          to: "npt-working", toast: "Ticket reopened",
          customDialog: "reopen" });
      }
    }
    return out;
  }, [role, ticket.status]);

  const applyTransition = (tr) => {
    const now = "May 15, 2026 14:58:00";
    ticket.status = tr.to;
    ticket.updatedAt = now;
    // 'claim' transitions take ownership of a queued ticket without
    // moving the status (e.g. NPT picking from the queue). ISO claims
    // write assignedTo (case owner); NPT claims write nptHandler.
    if (tr.claim) {
      if (role === "NPT") ticket.nptHandler = currentUser();else
      ticket.assignedTo = currentUser();
    }
    ticket.timeline = [
    ...(ticket.timeline || []),
    { at: now,
      actor: role === "NPT" ? "Hossein Naderi" : "Maya Hassan",
      kind: tr.id.includes("escalate") ? "escalation" :
      tr.id.includes("close") ? "resolution" :
      tr.id.includes("reply") ? "resolution" :
      "status",
      note: tr.toast }];

    window.showToast?.(tr.toast, "success");
    setConfirmAction(null);
    if (tr.afterApply) tr.afterApply((r) => window.__navigate?.(r));
  };

  // Escalate-to-NPT changes status + records access grants. The ISO
  // case owner (ticket.assignedTo) STAYS the same — ISO is on the hook
  // for the whole lifecycle. We just route the work into NPT's queue
  // via the nptHandler field.
  const applyEscalation = ({ grants, reason }) => {
    const now = "May 15, 2026 14:58:00";
    ticket.status = "npt-working";
    ticket.updatedAt = now;
    ticket.nptHandler = "TOMS NPT queue";
    ticket.nptGrants = { ...grants, grantedAt: now, grantedBy: "Maya Hassan (ISO)" };
    const grantSummary = Object.entries(grants).filter(([, v]) => v).map(([k]) => GRANT_LABELS[k]).join(" · ");
    ticket.timeline = [
    ...(ticket.timeline || []),
    { at: now, actor: "Maya Hassan", kind: "escalation",
      note: `Escalated to NPT · granted access: ${grantSummary || "none"}` },
    ...(reason ? [{ at: now, actor: "Maya Hassan", kind: "comment",
      note: `Reason: ${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}` }] : [])];

    if (reason) {
      ticket.comments = [...(ticket.comments || []), {
        at: now, actor: "Maya Hassan",
        body: `Escalation note to NPT: ${reason}`
      }];
    }
    window.showToast?.("Escalated to NPT — access grants recorded", "success");
    setEscalateOpen(false);
  };

  // Reassign — moves the ticket to another teammate or back to a queue.
  // ISO reassign moves the case owner (assignedTo); NPT reassign moves
  // the investigator slot (nptHandler). They never cross-write.
  const applyAssign = ({ assignee, reason }) => {
    const now = "May 15, 2026 14:58:00";
    const field = role === "NPT" ? "nptHandler" : "assignedTo";
    const prev = ticket[field] || "Unassigned";
    const meName = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";
    const recipient = TICKET_ROSTER[role]?.find((r) => r.id === assignee);
    const targetLabel = recipient?.queue ? recipient.name.toLowerCase() : recipient?.name || assignee;
    ticket[field] = assignee;
    ticket.updatedAt = now;
    ticket.timeline = [
    ...(ticket.timeline || []),
    { at: now, actor: meName, kind: "status",
      note: `Reassigned · ${prev} → ${targetLabel}` },
    { at: now, actor: meName, kind: "comment",
      note: `Reason: ${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}` }];

    ticket.comments = [...(ticket.comments || []), {
      at: now, actor: meName,
      body: `Handoff note for ${targetLabel}: ${reason}`
    }];
    window.showToast?.(recipient?.queue ?
    "Returned to queue — anyone on the team can pick it up" :
    `Reassigned to ${recipient?.name || assignee}`, "success");
    setAssignOpen(false);
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    const now = "May 15, 2026 14:58:30";
    ticket.comments = [...(ticket.comments || []), {
      at: now,
      actor: role === "NPT" ? "Hossein Naderi" : "Maya Hassan",
      body: comment.trim()
    }];
    ticket.timeline = [...(ticket.timeline || []), {
      at: now,
      actor: role === "NPT" ? "Hossein Naderi" : "Maya Hassan",
      kind: "comment",
      note: comment.trim().slice(0, 80) + (comment.trim().length > 80 ? "…" : "")
    }];
    ticket.updatedAt = now;
    setComment("");
    window.showToast?.("Comment added", "success");
  };

  const sv = TICKET_SEVERITY[ticket.severity] || TICKET_SEVERITY.low;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ─── Header ─── */}
      <div style={{ background: "var(--color-bg-2)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <button onClick={() => navigate({ screen: "tickets" })}
          style={{ color: "var(--fg3)", padding: 4, marginTop: 4 }} title="Back">
            <window.Ico name="chevl" size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="mono" style={{
                fontSize: 13, fontWeight: 600, color: "var(--fg3)", letterSpacing: "0.02em",
                whiteSpace: "nowrap"
              }}>{ticket.id}</span>
              <TypeChip type={ticket.type} />
              <window.Pill tone={sv.tone} dot size="sm">{sv.label}</window.Pill>
              <SourceChip source={ticket.source} />
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 600, lineHeight: 1.3,
              letterSpacing: "-0.01em", maxWidth: 880, textWrap: "pretty" }}>
              {ticket.title}
            </h1>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg3)" }}>
              On{" "}
              <a href="#" onClick={(e) => {e.preventDefault();
                navigate({ screen: "deviceDetail", deviceSn: ticket.deviceSn });}}
              className="mono"
              style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                {ticket.deviceSn}
              </a>
              {device && <> · {device.model}</>}
              {merchant && <> · {merchant.name}</>}
              {" · "}<span className="mono">created {ticket.createdAt}</span>
            </div>
          </div>
          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: "auto", alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {/* Open workbench is only visible to whoever currently
                  owns the ticket — once ISO escalates to NPT, the case
                  is out of ISO's hands and the workbench button hides
                  until NPT replies. Same the other way around. */}
              {((role === "ISO" && ["iso-working", "npt-resolved"].includes(ticket.status)) ||
                (role === "NPT" && ticket.status === "npt-working" && ticket.nptHandler !== "TOMS NPT queue")) &&
              <window.Button size="sm" icon="external"
              onClick={() => window.openWorkbenchInNewWindow?.(ticket.id)}>
                  Open workbench
                </window.Button>
              }
              {/* Assign — only available AFTER the ticket has been taken.
                    ISO can reassign while it sits in their lane (working
                    or replied, never 'new' — must take it first). NPT can
                    reassign only after picking it up from the NPT queue.
                    Closed tickets are immutable. */}
              {(role === "ISO" && ["iso-working", "npt-resolved"].includes(ticket.status) ||
              role === "NPT" && ticket.status === "npt-working" && ticket.nptHandler !== "TOMS NPT queue") &&
              <window.Button size="sm" icon="users"
              onClick={() => setAssignOpen(true)}>
                  Assign
                </window.Button>
              }
              {transitions.map((tr) =>
              <window.Button key={tr.id} size="sm"
              primary={tr.primary} danger={tr.danger}
              icon={tr.icon}
              onClick={() => tr.customDialog === "escalate" ? setEscalateOpen(true) :
              tr.customDialog === "reply" ? setReplyOpen(true) :
              tr.customDialog === "replyClose" ? setReplyCloseOpen(true) :
              tr.customDialog === "internalClose" ? setInternalCloseOpen(true) :
              tr.customDialog === "reopen" ? setReopenOpen(true) :
              tr.dialog ? setConfirmAction(tr) :
              applyTransition(tr)}>
                  {tr.label}
                </window.Button>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--fg3)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>You are acting as</span>
              <span style={{
                padding: "1px 6px", borderRadius: 3,
                background: role === "NPT" ? "oklch(95% 0.04 12)" : "oklch(94% 0.03 152)",
                color: role === "NPT" ? "oklch(46% 0.18 12)" : "var(--color-success-700)",
                fontWeight: 600, letterSpacing: "0.04em",
                fontFamily: "var(--font-mono)", fontSize: 9.5
              }}>{role}</span>
            </div>
          </div>
        </div>

        {/* Status stepper */}
        <div style={{ padding: "16px 24px 16px" }}>
          <StatusStepper status={ticket.status} ticket={ticket} />
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", background: "var(--color-bg-1)" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 16,
          maxWidth: 1280, margin: "0 auto", width: "100%"
        }}>
          {/* Left main */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <DescriptionCard ticket={ticket}
            onPreviewAttachment={setPreviewAttachment} />
            <DeviceSnapshotCard snapshot={snapshot} device={device}
            onOpenDevice={() => navigate({ screen: "deviceDetail", deviceSn: ticket.deviceSn })} />
            <CommentsCard ticket={ticket} comment={comment} setComment={setComment} onSubmit={submitComment} role={role} />
          </div>
          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <LinkedDeviceCard device={device} merchant={merchant}
            onOpen={() => navigate({ screen: "deviceDetail", deviceSn: ticket.deviceSn })}
            onOpenMerchant={() => merchant && navigate({ screen: "merchantDetail", merchantId: merchant.id, tab: "terminals" })} />
            {ticket.nptGrants && <NptGrantsCard grants={ticket.nptGrants} />}
            <MetaCard ticket={ticket} />
            <TimelineCard timeline={ticket.timeline} />
          </div>
        </div>
      </div>

      <window.ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.dialog?.title}
        body={confirmAction?.dialog?.body}
        confirmLabel={confirmAction?.dialog?.confirmLabel}
        tone={confirmAction?.danger ? "danger" : "primary"}
        icon={confirmAction?.icon}
        onConfirm={() => applyTransition(confirmAction)} />

      <EscalateDialog
        open={escalateOpen}
        ticket={ticket}
        device={device}
        snapshot={snapshot}
        onClose={() => setEscalateOpen(false)}
        onConfirm={applyEscalation} />

      <ReplyCloseDialog
        open={replyCloseOpen}
        ticket={ticket}
        onClose={() => setReplyCloseOpen(false)}
        onConfirm={({ note }) => {
          const now = "May 15, 2026 14:58:00";
          const actor = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";
          ticket.status = "closed";
          ticket.updatedAt = now;
          ticket.timeline = [
          ...(ticket.timeline || []),
          { at: now, actor, kind: "resolution",
            note: "Ticket closed — customer notified" + (note ? " · with reply" : "") }];

          // Always record a comment when closing — even if no customer
          // reply was attached, the close itself is an audit-worthy
          // event that should appear in the comments thread.
          const closeBody = note
            ? `Reply to customer (sent on close):\n${note}`
            : "Closed the ticket — no customer reply attached.";
          ticket.comments = [...(ticket.comments || []), {
            at: now, actor, body: closeBody,
          }];
          ticket.timeline.push({ at: now, actor, kind: "comment",
            note: note
              ? `Reply: ${note.slice(0, 80)}${note.length > 80 ? "…" : ""}`
              : "Closed without customer reply" });
          window.showToast?.("Ticket closed — customer notified", "success");
          setReplyCloseOpen(false);
        }} />

      <InternalCloseDialog
        open={internalCloseOpen}
        ticket={ticket}
        onClose={() => setInternalCloseOpen(false)}
        onConfirm={({ note }) => {
          const now = "May 15, 2026 14:58:00";
          const actor = "Hossein Naderi";
          ticket.status = "closed";
          ticket.updatedAt = now;
          const trimmed = (note || "").trim();
          ticket.timeline = [
            ...(ticket.timeline || []),
            { at: now, actor, kind: "resolution",
              note: trimmed
                ? `Closed (NPT-internal) · ${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}`
                : "Closed (NPT-internal)" }];
          // Always record a comment when closing — keeps the thread
          // self-explanatory for anyone reviewing the audit trail.
          ticket.comments = [...(ticket.comments || []), {
            at: now, actor,
            body: trimmed
              ? `Resolution note:\n${trimmed}`
              : "Closed without a resolution note."
          }];
          window.showToast?.("Ticket closed", "success");
          setInternalCloseOpen(false);
        }} />

      <AssignDialog
        open={assignOpen}
        ticket={ticket}
        role={role}
        me={role === "NPT" ? "Hossein Naderi (NPT)" : "Maya Hassan (ISO)"}
        onClose={() => setAssignOpen(false)}
        onConfirm={applyAssign} />

      <ReopenDialog
        open={reopenOpen}
        ticket={ticket}
        role={role}
        onClose={() => setReopenOpen(false)}
        onConfirm={(reason) => {
          const now = "May 15, 2026 14:58:00";
          const actor = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";
          // NPT-internal tickets reopen back into the NPT lane — they
          // never touched ISO and shouldn't route through it on revive.
          const reopenTo = ticketOrigin(ticket) === "internal" ? "npt-working" : "iso-working";
          ticket.status = reopenTo;
          ticket.updatedAt = now;
          // Reason is optional, but the reopen itself is always logged
          // as a comment so the audit trail stays complete.
          const trimmed = (reason || "").trim();
          ticket.timeline = [
            ...(ticket.timeline || []),
            { at: now, actor, kind: "status",
              note: trimmed
                ? `Reopened · ${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}`
                : "Reopened — no reason provided" },
            { at: now, actor, kind: "comment",
              note: trimmed
                ? `Reopen reason: ${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}`
                : "Reopened without reason" },
          ];
          ticket.comments = [...(ticket.comments || []), {
            at: now, actor,
            body: trimmed
              ? `Reopened the ticket — ${trimmed}`
              : "Reopened the ticket — no reason provided.",
          }];
          window.showToast?.("Ticket reopened", "success");
          setReopenOpen(false);
        }} />

      <ReplyDialog
        open={replyOpen}
        ticket={ticket}
        onClose={() => setReplyOpen(false)}
        onConfirm={(payload) => {
          const now = "May 15, 2026 14:58:00";
          ticket.status = "npt-resolved";
          ticket.updatedAt = now;
          // assignedTo stays on the ISO case owner. nptHandler keeps
          // the last NPT investigator so ISO knows who to follow up with.
          ticket.solution = {
            summary: payload.summary,
            steps: payload.steps,
            rootCause: payload.rootCause,
            sentAt: now,
            sentBy: "Hossein Naderi (NPT)"
          };
          ticket.timeline = [
          ...(ticket.timeline || []),
          { at: now, actor: "Hossein Naderi", kind: "resolution",
            note: `Replied to ISO with solution: ${payload.summary.slice(0, 80)}${payload.summary.length > 80 ? "…" : ""}` }];

          ticket.comments = [...(ticket.comments || []), {
            at: now, actor: "Hossein Naderi",
            body: `Solution${payload.rootCause ? ` (root cause: ${payload.rootCause})` : ""}:\n${payload.summary}${payload.steps ? `\n\nSteps for ISO to apply:\n${payload.steps}` : ""}`
          }];
          window.showToast?.("Reply sent to ISO with solution", "success");
          setReplyOpen(false);
        }} />

      <AttachmentPreviewModal
        attachment={previewAttachment}
        ticket={ticket}
        onClose={() => setPreviewAttachment(null)} />
    </div>);

}

// ─── Status stepper ────────────────────────────────────────
function StatusStepper({ status, ticket }) {
  // Visual steps. Working covers both iso-working and npt-working;
  // we add an ISO / NPT sub-badge on the active Working step so the
  // reader can still see which team currently holds the ticket.
  // NPT-internal tickets skip the "Replied" step entirely — they go
  // straight from Working to Closed (no ISO to hand back to).
  const isInternal = ticket && window.ticketOrigin?.(ticket) === "internal";
  const steps = isInternal ?
  [
  { id: "new", label: "New" },
  { id: "working", label: "Working" },
  { id: "closed", label: "Closed" }] :

  [
  { id: "new", label: "New" },
  { id: "working", label: "Working" },
  { id: "npt-resolved", label: "Replied", optional: true },
  { id: "closed", label: "Closed" }];

  const STATUS_TO_STEP_IDX = isInternal ?
  { "new": 0, "iso-working": 1, "npt-working": 1, "closed": 2 } :
  { "new": 0, "iso-working": 1, "npt-working": 1,
    "npt-resolved": 2, "closed": 3 };
  const currentIdx = STATUS_TO_STEP_IDX[status] ?? 0;
  const workingOwner = status === "iso-working" ? "ISO" :
  status === "npt-working" ? "NPT" : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
      {steps.map((s, i) => {
        const passed = i < currentIdx;
        const here = i === currentIdx;
        const color = here ? "var(--color-primary-700)" :
        passed ? "var(--color-success-700)" :
        "var(--fg3)";
        const bg = here ? "var(--color-primary-100)" :
        passed ? "oklch(94% 0.04 152)" :
        "var(--bg2)";
        const border = here ? "color-mix(in oklab, var(--color-primary-500) 35%, transparent)" :
        passed ? "color-mix(in oklab, var(--color-success-500) 25%, transparent)" :
        "var(--border-1)";
        return (
          <React.Fragment key={s.id}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: bg, color,
                display: "grid", placeItems: "center",
                border: `1px solid ${border}`,
                fontSize: 10.5, fontWeight: 600, fontFamily: "var(--font-mono)",
                flexShrink: 0
              }}>
                {passed ? <window.Ico name="check" size={11} stroke={2.5} /> : i + 1}
              </span>
              <span style={{
                fontSize: 11.5,
                color: here ? "var(--fg1)" : passed ? "var(--fg2)" : "var(--fg3)",
                fontWeight: here ? 600 : 400,
                whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                {s.label}
                {s.id === "working" && here && workingOwner &&
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: "1px 6px",
                  borderRadius: 3, letterSpacing: "0.06em",
                  fontFamily: "var(--font-mono)",
                  background: workingOwner === "NPT" ?
                  "var(--warning-bg)" : "var(--info-bg)",
                  color: workingOwner === "NPT" ?
                  "var(--color-warning-700)" : "var(--color-info-700)"
                }}>{workingOwner}</span>
                }
              </span>
            </div>
            {i < steps.length - 1 &&
            <span style={{
              width: 32, height: 1, margin: "0 8px",
              background: i < currentIdx ?
              "color-mix(in oklab, var(--color-success-500) 35%, transparent)" :
              "var(--border-1)"
            }} />
            }
          </React.Fragment>);

      })}
    </div>);

}

// ─── Description + attachments ─────────────────────────────
function DescriptionCard({ ticket, onPreviewAttachment }) {
  return (
    <window.Card title="Description"
    hint={ticket.source === "auto" ?
    "Auto-captured from device telemetry at the time of the alert." :
    "Logged by the ISO operator based on a customer report."}>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg1)", textWrap: "pretty" }}>
        {ticket.description}
      </div>
      {ticket.attachments && ticket.attachments.length > 0 &&
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: "1px dashed var(--color-border-subtle)"
      }}>
          <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
            Attachments · <span className="mono num">{ticket.attachments.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ticket.attachments.map((a, i) =>
          <AttachmentChip key={i} attachment={a}
          onClick={() => onPreviewAttachment?.(a)} />
          )}
          </div>
        </div>
      }
    </window.Card>);

}

function AttachmentChip({ attachment, onClick }) {
  const iconForKind = attachment.kind === "log" ? "doc" :
  attachment.kind === "screenshot" ? "device" :
  "package";
  const bg = attachment.kind === "log" ? "var(--bg3)" :
  attachment.kind === "screenshot" ? "oklch(94% 0.03 230)" :
  "var(--bg3)";
  return (
    <button type="button" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "7px 10px",
      background: bg, border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer", textAlign: "left",
      transition: "background .12s ease, border-color .12s ease"
    }}
    onClick={onClick}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-primary-500)"}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-1)"}>
      <window.Ico name={iconForKind} size={14} stroke={1.8} style={{ color: "var(--fg2)" }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg1)" }}>{attachment.name}</span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{attachment.size}</span>
      <window.Ico name="external" size={11} stroke={1.8} style={{ color: "var(--fg3)", marginLeft: 2 }} />
    </button>);

}

// ─── AI suggestion card ────────────────────────────────────
function AISuggestionCard({ ticket, aiState }) {
  if (aiState === "loading" || !ticket.ai) {
    return (
      <window.Card title="AI suggestion"
      hint="Carbon AI is reviewing similar past incidents and your device snapshot…">
        <div style={{
          padding: "24px 18px", textAlign: "center",
          background: "var(--bg2)",
          border: "1px dashed var(--color-border-subtle)",
          borderRadius: "var(--radius-md)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            border: "2.5px solid var(--color-bg-3)",
            borderTopColor: "var(--color-primary-600)",
            animation: "spin .8s linear infinite"
          }} />
          <span style={{ fontSize: 12.5, color: "var(--fg2)" }}>
            Analysing… typically takes 2 – 3 seconds.
          </span>
        </div>
      </window.Card>);

  }
  const ai = ticket.ai;
  const confColor = ai.confidence > 0.85 ? "var(--color-success-700)" :
  ai.confidence > 0.7 ? "var(--color-info-700)" :
  "var(--color-warning-700)";
  return (
    <window.Card title="AI suggestion"
    hint={<>Generated by Carbon AI from <span className="mono">{ai.citedDocs.length}</span> matching playbook{ai.citedDocs.length === 1 ? "" : "s"}. Treat as a starting point, not a verdict.</>}
    action={
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 8px", borderRadius: 999,
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      fontSize: 11
    }}>
          <span style={{ color: "var(--fg3)" }}>confidence</span>
          <span className="mono" style={{ color: confColor, fontWeight: 600 }}>
            {Math.round(ai.confidence * 100)}%
          </span>
        </span>
    }>
      <div style={{
        padding: "12px 14px",
        background: "linear-gradient(180deg, var(--color-primary-50) 0%, transparent 100%)",
        border: "1px solid color-mix(in oklab, var(--color-primary-500) 18%, transparent)",
        borderRadius: "var(--radius-md)",
        marginBottom: 14
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: "var(--color-primary-100)", color: "var(--color-primary-700)",
            display: "grid", placeItems: "center",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "var(--font-mono)"
          }}>AI</span>
          <span className="overline" style={{ fontSize: 10, color: "var(--color-primary-700)" }}>
            Summary
          </span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg1)", lineHeight: 1.5, textWrap: "pretty" }}>
          {ai.summary}
        </div>
      </div>

      <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
        Recommended steps · <span className="mono num">{ai.steps.length}</span>
      </div>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 8 }}>
        {ai.steps.map((s, i) =>
        <li key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 12px",
          background: "var(--bg2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)"
        }}>
            <span style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            background: "var(--color-primary-50)", color: "var(--color-primary-700)",
            display: "grid", placeItems: "center",
            fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)"
          }}>{i + 1}</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg1)", textWrap: "pretty" }}>{s}</span>
          </li>
        )}
      </ol>

      <div style={{
        marginTop: 14, paddingTop: 10,
        borderTop: "1px dashed var(--color-border-subtle)",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontSize: 11.5, color: "var(--fg3)"
      }}>
        <span className="overline" style={{ fontSize: 9.5 }}>Cited</span>
        {ai.citedDocs.map((d, i) =>
        <span key={i} style={{
          padding: "2px 8px", borderRadius: 999,
          background: "var(--bg3)", border: "1px solid var(--border-1)",
          fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg2)"
        }}>{d}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10.5 }}>
          generated <span className="mono">{ai.generatedAt}</span>
        </span>
      </div>
    </window.Card>);

}

// ─── Device snapshot card ──────────────────────────────────
function DeviceSnapshotCard({ snapshot, device, onOpenDevice }) {
  if (!snapshot || !device) {
    return (
      <window.Card title="Device snapshot">
        <div style={{ padding: 14, fontSize: 12.5, color: "var(--fg3)" }}>
          No snapshot — the source device is no longer in the fleet.
        </div>
      </window.Card>);

  }
  const r = snapshot.runtime;
  const diskPct = Math.round(r.diskUsed / r.diskTotal * 100);
  const memPct = Math.round(r.memUsed / r.memTotal * 100);
  return (
    <window.Card title="Device snapshot"
    hint={<>Frozen state of <span className="mono">{device.sn}</span> at the moment this ticket was created. Useful for diagnosing what was happening when the issue fired.</>}
    action={
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="overline" style={{ fontSize: 9.5 }}>captured</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg2)" }}>{snapshot.capturedAt}</span>
          <button onClick={onOpenDevice} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, color: "var(--accent)",
        textDecoration: "underline", textUnderlineOffset: 2,
        background: "transparent", border: 0, padding: "2px 4px", cursor: "pointer"
      }}>View live device <window.Ico name="external" size={10} /></button>
        </span>
    }>
      {/* 4-column tile grid: Runtime · Network · Security · Battery */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 10 }}>
        {/* Runtime */}
        <SnapPanel label="Runtime" snap>
          <SnapMeter label="CPU" value={`${r.cpu}%`} pct={r.cpu} />
          <SnapMeter label="Memory" value={`${r.memUsed}/${r.memTotal} GB`} pct={memPct} />
          <SnapMeter label="Storage" value={`${r.diskUsed}/${r.diskTotal} GB`} pct={diskPct} />
          <SnapRow label="Status"
          value={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: r.isOnline ? "var(--success)" : "var(--border-2)" }} />
              <span style={{ color: r.isOnline ? "var(--color-success-700)" : "var(--fg2)",
              fontWeight: 500 }}>{r.isOnline ? "Online" : "Offline"}</span>
            </span>} />
        </SnapPanel>
        {/* Network */}
        <SnapPanel label="Network" snap>
          <SnapRow label="Primary"
          value={<span className="mono" style={{ fontWeight: 500, color: "var(--fg1)" }}>{snapshot.network.primary}</span>} />
          {snapshot.network.wifi &&
          <>
              <SnapRow label="Wi-Fi SSID" value={<span className="mono">{snapshot.network.wifi.ssid}</span>} />
              <SnapRow label="Wi-Fi signal" value={<span className="mono">{snapshot.network.wifi.signalDbm} dBm</span>} />
              {snapshot.network.wifi.ip &&
            <SnapRow label="Wi-Fi IP" value={<span className="mono" style={{ fontSize: 11 }}>{snapshot.network.wifi.ip}</span>} />
            }
            </>
          }
          {snapshot.network.cellular &&
          <>
              <SnapRow label="Carrier" value={snapshot.network.cellular.carrier} />
              <SnapRow label="Cell signal" value={<span className="mono">{snapshot.network.cellular.signalDbm} dBm</span>} />
            </>
          }
          {snapshot.network.ethernet &&
          <SnapRow label="Ethernet" value={<span className="mono">{snapshot.network.ethernet.linkMbps} Mbps</span>} />
          }
        </SnapPanel>
        {/* Security */}
        <SnapPanel label="Security" snap>
          <SnapRow label="Root"
          value={<span style={{ color: snapshot.security.rooted ? "var(--color-error-700)" : "var(--color-success-700)",
            fontWeight: 500 }}>
              {snapshot.security.rooted ? "Rooted" : "Clean"}
            </span>} />
          <SnapRow label="Dev mode"
          value={<span style={{ color: snapshot.security.devMode ? "var(--color-warning-700)" : "var(--color-success-700)" }}>
              {snapshot.security.devMode ? "Enabled" : "Disabled"}
            </span>} />
          <SnapRow label="HW attacks"
          value={<span className="mono num">{snapshot.security.hwAttackCount}</span>} />
          <SnapRow label="SW attacks"
          value={<span className="mono num">{snapshot.security.swAttackCount}</span>} />
          {snapshot.security.warnings.length > 0 &&
          <div style={{ marginTop: 4,
            padding: "5px 8px",
            background: "var(--warning-bg)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 25%, transparent)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11, color: "var(--color-warning-700)",
            lineHeight: 1.45
          }}>
              {snapshot.security.warnings.join(" · ")}
            </div>
          }
        </SnapPanel>
        {/* Battery + firmware */}
        <SnapPanel label="System" snap>
          {snapshot.battery &&
          <SnapMeter label="Battery"
          value={`${snapshot.battery.level}% · ${snapshot.battery.health}`}
          pct={snapshot.battery.level}
          tone={snapshot.battery.level < 20 ? "warning" : null} />
          }
          {!snapshot.battery && <SnapRow label="Power" value="Line-powered" />}
          <SnapRow label="OS" value={<span className="mono">{snapshot.os}</span>} />
          <SnapRow label="Firmware" value={<span className="mono" style={{ fontSize: 11 }}>{snapshot.firmware}</span>} />
        </SnapPanel>
      </div>

      {/* Recent events */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: "1px dashed var(--color-border-subtle)"
      }}>
        <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
          Recent events at capture · <span className="mono num">{snapshot.recentEvents.length}</span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none",
          display: "flex", flexDirection: "column", gap: 4 }}>
          {snapshot.recentEvents.map((e, i) => {
            const isFail = e.kind === "tx-fail";
            return (
              <li key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "5px 10px",
                background: isFail ? "var(--error-bg)" : "var(--bg2)",
                border: "1px solid",
                borderColor: isFail ? "color-mix(in oklab, var(--color-error-500) 20%, transparent)" : "var(--border-1)",
                borderRadius: "var(--radius-sm)",
                fontSize: 11.5
              }}>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)", minWidth: 56 }}>{e.at}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                  background: isFail ? "color-mix(in oklab, var(--color-error-500) 12%, transparent)" : "var(--bg3)",
                  color: isFail ? "var(--color-error-700)" : "var(--fg2)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  fontFamily: "var(--font-mono)"
                }}>{e.kind}</span>
                <span style={{ flex: 1, color: isFail ? "var(--color-error-700)" : "var(--fg2)" }}>{e.detail}</span>
              </li>);

          })}
        </ul>
      </div>
    </window.Card>);

}

function SnapPanel({ label, snap, children }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative", minWidth: 0
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span className="overline" style={{ fontSize: 10 }}>{label}</span>
        {snap && <span style={{
          fontSize: 8.5, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
          background: "var(--bg3)", color: "var(--fg3)",
          letterSpacing: "0.05em", textTransform: "uppercase",
          fontFamily: "var(--font-mono)"
        }}>snapshot</span>}
      </div>
      {children}
    </div>);

}
function SnapRow({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--fg3)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--fg1)", minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{value}</span>
    </div>);

}
function SnapMeter({ label, value, pct, tone }) {
  const color = tone === "warning" ? "var(--color-warning-500)" :
  pct >= 85 ? "var(--color-warning-500)" :
  "var(--color-primary-500)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--fg3)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--fg1)", fontWeight: 500 }}>{value}</span>
      </div>
      <div style={{ marginTop: 3, height: 4, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, transition: "width .2s ease" }} />
      </div>
    </div>);

}

// ─── Comments ──────────────────────────────────────────────
function CommentsCard({ ticket, comment, setComment, onSubmit, role }) {
  const comments = ticket.comments || [];
  return (
    <window.Card title={`Comments · ${comments.length}`}
    hint="Internal conversation between ISO and NPT. Customer doesn't see these.">
      {comments.length === 0 ?
      <div style={{
        padding: "16px 14px", textAlign: "center",
        fontSize: 12, color: "var(--fg3)",
        background: "var(--bg2)",
        border: "1px dashed var(--color-border-subtle)",
        borderRadius: "var(--radius-md)"
      }}>
          No comments yet.
        </div> :

      <ul style={{ margin: 0, padding: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c, i) => {
          const isNpt = c.actor.includes("Hossein") || c.actor.includes("(NPT)");
          return (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: isNpt ? "oklch(95% 0.04 12)" : "oklch(94% 0.03 152)",
                color: isNpt ? "oklch(46% 0.18 12)" : "var(--color-success-700)",
                display: "grid", placeItems: "center",
                fontSize: 10, fontWeight: 600, flexShrink: 0,
                fontFamily: "var(--font-mono)"
              }}>{c.actor.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>{c.actor}</span>
                    <span style={{
                    fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                    background: isNpt ? "oklch(95% 0.04 12)" : "oklch(94% 0.03 152)",
                    color: isNpt ? "oklch(46% 0.18 12)" : "var(--color-success-700)",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    fontFamily: "var(--font-mono)"
                  }}>{isNpt ? "NPT" : "ISO"}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{c.at}</span>
                  </div>
                  <div style={{
                  marginTop: 4, padding: "8px 12px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--fg1)",
                  lineHeight: 1.55, textWrap: "pretty"
                }}>{c.body}</div>
                </div>
              </li>);

        })}
        </ul>
      }

      {/* Composer */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: "1px dashed var(--color-border-subtle)"
      }}>
        <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
          Add comment as {role}
        </div>
        <window.Textarea value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={role === "NPT" ?
        "Share your findings with ISO. They will relay relevant info to the customer." :
        "Leave a note for NPT or for your future self…"}
        rows={3} />
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <window.Button size="sm" primary icon="upload" disabled={!comment.trim()} onClick={onSubmit}>
            Post comment
          </window.Button>
        </div>
      </div>
    </window.Card>);

}

// ─── Right sidebar cards ───────────────────────────────────
function LinkedDeviceCard({ device, merchant, onOpen, onOpenMerchant }) {
  if (!device) {
    return (
      <window.Card title="Linked device">
        <div style={{ padding: 14, fontSize: 12.5, color: "var(--fg3)" }}>Device not found in fleet.</div>
      </window.Card>);

  }
  const isOnline = device.state === "active";
  return (
    <window.Card title="Linked device" padding={0}>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(155deg, oklch(28% 0.05 232) 0%, oklch(38% 0.07 232) 100%)`,
            color: "#dde2f0",
            display: "grid", placeItems: "center",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
            letterSpacing: "-0.02em"
          }}>{device.model.slice(0, 2)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {device.sn}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{device.model}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, color: isOnline ? "var(--color-success-700)" : "var(--fg3)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: isOnline ? "var(--success)" : "var(--border-2)" }} />
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        {merchant &&
        <div style={{ fontSize: 11.5, color: "var(--fg3)" }}>
            Bound to{" "}
            <a href="#" onClick={(e) => {e.preventDefault();onOpenMerchant();}}
          style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {merchant.name}
            </a>
          </div>
        }
        <window.Button size="sm" icon="external" onClick={onOpen}>Open device detail</window.Button>
      </div>
    </window.Card>);

}

function MetaCard({ ticket }) {
  const me = currentUser();
  const showNpt = ticket.nptHandler &&
  ["npt-working", "npt-resolved"].includes(ticket.status);
  return (
    <window.Card title="Ticket info">
      {/* ISO case owner — the responsible party across the whole
            lifecycle. Always shown, always at the top. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", marginBottom: showNpt ? 6 : 10,
        background: ticket.assignedTo === me ?
        "color-mix(in oklab, var(--color-primary-600) 8%, transparent)" :
        "var(--bg1)",
        border: "1px solid",
        borderColor: ticket.assignedTo === me ?
        "color-mix(in oklab, var(--color-primary-600) 28%, transparent)" :
        "var(--border-1)",
        borderRadius: "var(--radius-md)"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="overline" style={{ fontSize: 9.5, marginBottom: 4 }}>
            ISO case owner
          </div>
          <AssigneeCell value={ticket.assignedTo} me={me} />
        </div>
      </div>
      {/* NPT investigator — only present while the ticket is in (or
            coming back from) NPT's lane. Lower visual weight than the
            ISO owner because NPT doesn't carry the whole case. */}
      {showNpt &&
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", marginBottom: 10,
        background: ticket.nptHandler === me ?
        "color-mix(in oklab, var(--color-warning-500) 8%, transparent)" :
        "var(--bg2)",
        border: "1px solid",
        borderColor: ticket.nptHandler === me ?
        "color-mix(in oklab, var(--color-warning-500) 28%, transparent)" :
        "var(--border-1)",
        borderRadius: "var(--radius-md)"
      }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="overline" style={{ fontSize: 9.5, marginBottom: 4 }}>
              {ticket.status === "npt-resolved" ? "NPT investigator (replied)" : "NPT investigator"}
            </div>
            <AssigneeCell value={ticket.nptHandler} me={me} />
          </div>
        </div>
      }
      <div style={{
        display: "grid",
        gridTemplateColumns: "98px minmax(0, 1fr)",
        rowGap: 8, columnGap: 12,
        fontSize: 12.5
      }}>
        <Kv label="Reporter" value={<span>{ticket.createdBy}</span>} />
        <Kv label="Created" value={<span className="mono" style={{ fontSize: 12 }}>{ticket.createdAt}</span>} />
        <Kv label="Updated" value={<span className="mono" style={{ fontSize: 12 }}>{ticket.updatedAt}</span>} />
        {ticket.faultWindow &&
        <Kv label="Fault window" value={<FaultWindowRange window={ticket.faultWindow} />} />
        }
      </div>
    </window.Card>);

}

// Renders the start → end of a fault window, stacked on two lines so it
// fits the 320 px sidebar without truncating the timestamps.
function FaultWindowRange({ window: w }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2,
      fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.35,
      fontVariantNumeric: "tabular-nums" }}>
      <span>{w.start}</span>
      <span style={{ color: "var(--fg3)" }}>
        <span style={{ marginRight: 6 }}>→</span>{w.end}
      </span>
    </div>);

}

function NptGrantsCard({ grants }) {
  const items = Object.entries(GRANT_INFO).map(([key, info]) => ({
    key, info, granted: !!grants[key]
  }));
  const grantedCount = items.filter((i) => i.granted).length;
  return (
    <window.Card title="NPT access grants"
    hint={<>Scopes ISO authorized for NPT. <span className="mono">{grantedCount}</span> of <span className="mono">{items.length}</span> granted.</>}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map(({ key, info, granted }) =>
        <li key={key} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px",
          background: granted ? "oklch(96% 0.03 152)" : "var(--bg2)",
          border: "1px solid",
          borderColor: granted ?
          "color-mix(in oklab, var(--color-success-500) 22%, transparent)" :
          "var(--border-1)",
          borderRadius: "var(--radius-sm)",
          opacity: granted ? 1 : 0.7
        }}>
            <window.Ico name={granted ? "check" : "x"} size={11} stroke={2.5}
          style={{ color: granted ? "var(--color-success-700)" : "var(--fg3)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: granted ? "var(--fg1)" : "var(--fg3)",
            fontWeight: granted ? 500 : 400, flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {info.label}
            </span>
          </li>
        )}
      </ul>
      <div style={{ marginTop: 10, paddingTop: 8,
        borderTop: "1px dashed var(--color-border-subtle)",
        display: "flex", justifyContent: "space-between", gap: 8,
        fontSize: 10.5, color: "var(--fg3)"
      }}>
        <span>Granted by</span>
        <span style={{ color: "var(--fg2)" }}>{grants.grantedBy}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
        fontSize: 10.5, color: "var(--fg3)", marginTop: 3 }}>
        <span>At</span>
        <span className="mono" style={{ color: "var(--fg2)" }}>{grants.grantedAt}</span>
      </div>
    </window.Card>);

}

function Kv({ label, value }) {
  return (
    <>
      <span className="overline" style={{ fontSize: 9.5, paddingTop: 2 }}>{label}</span>
      <span style={{ color: "var(--fg1)", minWidth: 0 }}>{value}</span>
    </>);

}

function TimelineCard({ timeline }) {
  return (
    <window.Card title={`Activity · ${timeline.length}`}>
      <ol style={{ margin: 0, padding: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 0 }}>
        {[...timeline].reverse().map((e, i, arr) => {
          const meta = TL_KIND[e.kind] || TL_KIND.status;
          const isLast = i === arr.length - 1;
          return (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start",
              paddingBottom: isLast ? 0 : 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: meta.bg, color: meta.color,
                  display: "grid", placeItems: "center",
                  border: `1px solid ${meta.border}`
                }}><window.Ico name={meta.icon} size={10} stroke={1.8} /></span>
                {!isLast &&
                <span style={{ width: 1, flex: 1, marginTop: 2,
                  background: "var(--color-border-subtle)", minHeight: 14 }} />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: 12, color: "var(--fg1)", lineHeight: 1.45,
                  textWrap: "pretty", overflowWrap: "break-word" }}>{e.note}</div>
                <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--fg3)",
                  display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="mono">{e.at}</span>
                  <span>· {e.actor}</span>
                </div>
              </div>
            </li>);

        })}
      </ol>
    </window.Card>);

}

const TL_KIND = {
  created: { icon: "plus", color: "var(--color-info-700)", bg: "var(--color-info-50)", border: "color-mix(in oklab, var(--color-info-500) 22%, transparent)" },
  ai: { icon: "shield", color: "var(--color-primary-700)", bg: "var(--color-primary-50)", border: "color-mix(in oklab, var(--color-primary-500) 22%, transparent)" },
  status: { icon: "check", color: "var(--color-success-700)", bg: "oklch(96% 0.03 152)", border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)" },
  comment: { icon: "edit", color: "var(--fg2)", bg: "var(--bg3)", border: "var(--color-border-subtle)" },
  escalation: { icon: "upload", color: "var(--color-warning-700)", bg: "var(--warning-bg)", border: "color-mix(in oklab, var(--color-warning-500) 22%, transparent)" },
  resolution: { icon: "check", color: "var(--color-success-700)", bg: "oklch(96% 0.03 152)", border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)" }
};

// ─── Shared chip components ────────────────────────────────
function TypeChip({ type, compact }) {
  const t = TICKET_TYPE[type] || TICKET_TYPE.Other;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: compact ? "2px 8px" : "3px 9px",
      borderRadius: 999,
      background: t.bg, color: t.fg,
      fontSize: compact ? 10.5 : 11, fontWeight: 500,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap"
    }}>
      <window.Ico name={t.icon} size={compact ? 10 : 11} stroke={1.8} />
      {t.label}
    </span>);

}

// ─── Assignee cell (tickets table) ─────────────────────────
// Compact avatar + name. Queue assignments use a users icon and italic
// label so they read as "ownerless waiting room" at a glance. The
// current user's row is tinted to make "what's on my plate" pop.
function AssigneeCell({ value, me }) {
  if (!value) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "2px 8px", borderRadius: 999,
        background: "var(--bg3)", border: "1px dashed var(--border-1)",
        fontSize: 11, color: "var(--fg3)", fontStyle: "italic"
      }}>Unassigned</span>);

  }
  const isQueue = /queue/i.test(value);
  const isMe = value === me;
  const display = value.replace(/\s*\((ISO|NPT)\)\s*$/i, "");
  const initials = isQueue ? null :
  display.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      maxWidth: 200, minWidth: 0
    }}>
      <span style={{
        width: 22, height: 22, flexShrink: 0,
        borderRadius: "50%",
        background: isQueue ? "var(--bg3)" :
        isMe ? "color-mix(in oklab, var(--color-primary-600) 18%, transparent)" :
        "color-mix(in oklab, var(--color-primary-600) 9%, transparent)",
        color: isQueue ? "var(--fg2)" : "var(--color-primary-700)",
        display: "grid", placeItems: "center",
        fontSize: 9.5, fontWeight: 600,
        fontFamily: "var(--font-family-mono)",
        border: isMe ? "1px solid color-mix(in oklab, var(--color-primary-600) 35%, transparent)" :
        "1px solid var(--border-1)"
      }}>
        {isQueue ?
        <window.Ico name="users" size={11} stroke={1.8} /> :
        initials}
      </span>
      <span style={{
        fontSize: 12, color: isMe ? "var(--color-primary-700)" : "var(--fg1)",
        fontWeight: isMe ? 600 : 500,
        fontStyle: isQueue ? "italic" : "normal",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        minWidth: 0
      }} title={value}>
        {display}{isMe && <span style={{
          marginLeft: 5, fontSize: 9.5, fontWeight: 600,
          letterSpacing: "0.04em", color: "var(--color-primary-700)",
          opacity: 0.7
        }}>YOU</span>}
      </span>
    </span>);

}

function SourceChip({ source }) {
  const isAuto = source === "auto";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999,
      background: isAuto ? "oklch(94% 0.03 230)" : "var(--bg3)",
      color: isAuto ? "oklch(40% 0.16 230)" : "var(--fg2)",
      border: "1px solid var(--border-1)",
      fontSize: 10.5, fontWeight: 500,
      whiteSpace: "nowrap"
    }}>
      <window.Ico name={isAuto ? "bolt" : "edit"} size={10} stroke={1.8} />
      {isAuto ? "Auto" : "Manual"}
    </span>);

}

const selectStyleT = {
  padding: "7px 10px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border-default)", fontSize: 12,
  fontFamily: "inherit",
  background: "var(--bg2)", color: "var(--fg1)"
};

// ─── Status multi-select dropdown ─────────────────────────
// Replaces the old pill row. Button shows current selection state;
// popover holds the four UI buckets (New / Working / Replied / Closed)
// as checkboxes. "Working" matches both iso-working and npt-working.
function StatusFilterDropdown({ buckets, value, onChange }) {
  const [open, setOpen] = useStateT(false);
  const ref = React.useRef(null);
  useEffectT(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    function esc(e) {if (e.key === "Escape") setOpen(false);}
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const count = value.size;
  const total = buckets.length;
  const allOn = count === total;
  const isDefault = count === total - 1 && !value.has("closed");
  const triggerLabel = count === 0 ? "None" :
  allOn ? "All" :
  isDefault ? "Open only" :
  buckets.filter((b) => value.has(b.id)).map((b) => b.label).join(", ");

  const toggle = (id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);else next.add(id);
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
      aria-haspopup="listbox" aria-expanded={open}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 10px", borderRadius: "var(--radius-sm)",
        border: "1px solid " + (open ? "var(--color-primary-500)" : "var(--color-border-default)"),
        background: "var(--bg2)", color: "var(--fg1)",
        fontFamily: "inherit", fontSize: 12, cursor: "pointer",
        minWidth: 188, maxWidth: 280,
        transition: "border-color .12s ease"
      }}>
        <span style={{ color: "var(--fg3)", flexShrink: 0 }}>Status</span>
        <span style={{
          fontWeight: 500, flex: 1, textAlign: "left",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          minWidth: 0
        }}>{triggerLabel}</span>
        <span className="mono num" style={{
          padding: "1px 6px", borderRadius: 999,
          background: allOn || count === 0 ?
          "var(--bg3)" :
          "color-mix(in oklab, var(--color-primary-600) 14%, transparent)",
          color: allOn || count === 0 ?
          "var(--fg2)" :
          "var(--color-primary-700)",
          fontSize: 10.5, fontWeight: 600,
          minWidth: 16, textAlign: "center", flexShrink: 0
        }}>{count}</span>
        <window.Ico name="chevd" size={11} stroke={2}
        style={{ color: "var(--fg3)", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform .15s ease" }} />
      </button>
      {open &&
      <div role="listbox" style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0,
        background: "var(--bg2)", border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-2)",
        minWidth: 220, zIndex: 100, padding: 4
      }}>
          <div style={{
          padding: "6px 10px 6px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px dashed var(--color-border-subtle)",
          marginBottom: 4
        }}>
            <span className="overline" style={{ fontSize: 9.5 }}>Filter status</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button"
            onClick={() => onChange(new Set(buckets.map((b) => b.id)))}
            style={linkBtn}>All</button>
              <span style={{ color: "var(--border-2)" }}>·</span>
              <button type="button"
            onClick={() => onChange(new Set())}
            style={linkBtn}>None</button>
            </div>
          </div>
          {buckets.map((b) => {
          const on = value.has(b.id);
          return (
            <label key={b.id} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 10px", cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              fontSize: 12.5, color: "var(--fg1)",
              userSelect: "none"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span style={{ position: "relative", display: "block", width: 14, height: 14, flexShrink: 0 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(b.id)}
                style={{
                  appearance: "none", WebkitAppearance: "none", margin: 0,
                  width: 14, height: 14, borderRadius: 3,
                  border: "1.5px solid",
                  borderColor: on ? "var(--color-primary-600)" : "var(--color-border-strong)",
                  background: on ? "var(--color-primary-600)" : "var(--bg2)",
                  cursor: "pointer", display: "block"
                }} />
                  {on &&
                <window.Ico name="check" size={10} stroke={3}
                style={{ position: "absolute", top: 2, left: 2, color: "#fff", pointerEvents: "none" }} />
                }
                </span>
                <span style={{ flex: 1 }}>{b.label}</span>
                {b.id === "working" &&
              <span style={{
                fontSize: 9.5, color: "var(--fg3)",
                fontFamily: "var(--font-mono)", letterSpacing: "0.04em"
              }}>ISO + NPT</span>
              }
              </label>);

        })}
        </div>
      }
    </div>);

}
const linkBtn = {
  background: "transparent", border: 0, padding: "2px 4px",
  fontSize: 10.5, color: "var(--color-primary-700)", cursor: "pointer",
  fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2
};

// ─── Escalation dialog (with NPT access grants) ────────────
// When ISO escalates a ticket to NPT, they MUST explicitly grant NPT
// the access scopes the engineering team needs. This is logged on the
// ticket so there's a clean audit trail of who gave what permission.
const GRANT_LABELS = {
  snapshot: "Device snapshot",
  logs: "Device logs",
  liveProbe: "Live diagnostic probe",
  remoteDesktop: "Remote desktop session"
};
const GRANT_INFO = {
  snapshot: {
    label: "Device snapshot",
    detail: "The runtime telemetry captured at ticket creation (CPU, network, security flags, recent events).",
    sensitivity: "low"
  },
  logs: {
    label: "Device logs",
    detail: "All attached logs on this ticket + any future on-demand log pulls NPT performs.",
    sensitivity: "low"
  },
  liveProbe: {
    label: "Live diagnostic probe",
    detail: "Read-only commands against the device — process list, network state, settings. No write access.",
    sensitivity: "med"
  },
  remoteDesktop: {
    label: "Remote desktop session",
    detail: "NPT can mirror the device screen and (with operator at the device) capture screen content. Most invasive option — only grant if logs aren't enough.",
    sensitivity: "high"
  }
};

function EscalateDialog({ open, ticket, device, snapshot, onClose, onConfirm }) {
  const [grants, setGrants] = useStateT({
    snapshot: true, logs: true, liveProbe: false, remoteDesktop: false
  });
  const [reason, setReason] = useStateT("");

  useEffectT(() => {
    if (!open) {
      // Reset on close — re-opens with safe defaults.
      setGrants({ snapshot: true, logs: true, liveProbe: false, remoteDesktop: false });
      setReason("");
    }
  }, [open]);

  if (!open) return null;
  const granted = Object.values(grants).filter(Boolean).length;
  const canConfirm = granted > 0 && reason.trim().length > 0;

  const toggle = (k) => setGrants((g) => ({ ...g, [k]: !g[k] }));

  return (
    <window.Modal open onClose={onClose} width={600}
    title="Escalate to NPT"
    subtitle={<>Authorize the TOMS engineering team to investigate <span className="mono">{ticket.id}</span>. They will reply to you — they never contact the customer directly.</>}
    footer={
    <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            <span className="mono num">{granted}</span> of <span className="mono num">4</span> access scopes granted
            {!reason.trim() && <span style={{ color: "var(--color-warning-700)", marginLeft: 8 }}>· reason required</span>}
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="upload" disabled={!canConfirm}
      onClick={() => onConfirm({ grants, reason: reason.trim() })}>
            Escalate &amp; share access
          </window.Button>
        </>
    }>
      {/* Device context */}
      <div style={{
        padding: "10px 12px", marginBottom: 14,
        background: "var(--bg2)", border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 12, color: "var(--fg2)"
      }}>
        <window.Ico name="device" size={14} stroke={1.8} style={{ color: "var(--fg3)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          NPT will see the following device:{" "}
          <span className="mono" style={{ color: "var(--fg1)", fontWeight: 500 }}>{ticket.deviceSn}</span>
          {device && <> · {device.model}</>}
          {snapshot && <> · snapshot captured <span className="mono">{snapshot.capturedAt}</span></>}
        </div>
      </div>

      {/* Grants */}
      <div className="overline" style={{ fontSize: 10, marginBottom: 8, color: "var(--fg2)" }}>
        Grant NPT access to —
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {Object.entries(GRANT_INFO).map(([key, g]) =>
        <GrantRow key={key}
        id={key}
        checked={grants[key]}
        onToggle={() => toggle(key)}
        info={g} />
        )}
      </div>

      {/* Reason */}
      <div className="overline" style={{ fontSize: 10, marginBottom: 6, color: "var(--fg2)" }}>
        Reason for escalation <span style={{ color: "var(--color-error-700)" }}>*</span>
      </div>
      <window.Textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 400))}
      placeholder="What have you already tried? What do you need NPT to confirm or fix?"
      rows={3} />
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg3)",
        display: "flex", justifyContent: "space-between" }}>
        <span>Becomes the first comment NPT sees on this ticket.</span>
        <span className="mono num">{reason.length}/400</span>
      </div>

      {/* Audit notice */}
      <div style={{
        marginTop: 14, padding: "10px 12px",
        background: "color-mix(in oklab, var(--color-info-500) 6%, transparent)",
        border: "1px solid color-mix(in oklab, var(--color-info-500) 18%, transparent)",
        borderRadius: "var(--radius-md)",
        fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.55,
        display: "flex", gap: 8
      }}>
        <window.Ico name="info" size={13} stroke={1.8} style={{ color: "var(--color-info-700)", flexShrink: 0, marginTop: 1 }} />
        <span>
          <b style={{ color: "var(--fg1)" }}>Audit trail:</b> the access scopes you grant here are written to the ticket
          timeline and are visible to the merchant on request. NPT only gets these scopes for this single ticket;
          escalating a different ticket re-asks. You can revoke at any time before NPT picks up.
        </span>
      </div>
    </window.Modal>);

}

function GrantRow({ id, checked, onToggle, info }) {
  const sensTone = info.sensitivity === "high" ? { bg: "var(--error-bg)", fg: "var(--color-error-700)", label: "Sensitive" } :
  info.sensitivity === "med" ? { bg: "var(--warning-bg)", fg: "var(--color-warning-700)", label: "Moderate" } :
  { bg: "oklch(94% 0.03 152)", fg: "var(--color-success-700)", label: "Routine" };
  return (
    <label htmlFor={`grant-${id}`} style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 12px",
      background: checked ? "var(--color-primary-50)" : "var(--bg2)",
      border: "1px solid",
      borderColor: checked ? "color-mix(in oklab, var(--color-primary-500) 25%, transparent)" : "var(--border-1)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      transition: "background .12s ease, border-color .12s ease"
    }}>
      <span style={{
        position: "relative", display: "block", flexShrink: 0,
        width: 16, height: 16, marginTop: 2
      }}>
        <input id={`grant-${id}`} type="checkbox" checked={checked} onChange={onToggle}
        style={{
          appearance: "none", WebkitAppearance: "none",
          width: 16, height: 16, borderRadius: 4,
          border: "1.5px solid",
          borderColor: checked ? "var(--color-primary-600)" : "var(--color-border-strong)",
          background: checked ? "var(--color-primary-600)" : "var(--bg2)",
          cursor: "pointer", margin: 0, display: "block"
        }} />
        {checked &&
        <window.Ico name="check" size={11} stroke={3}
        style={{ position: "absolute", top: 2.5, left: 2.5, color: "#fff", pointerEvents: "none" }} />
        }
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)" }}>{info.label}</span>
          <span style={{
            fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 999,
            background: sensTone.bg, color: sensTone.fg,
            letterSpacing: "0.04em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)", whiteSpace: "nowrap"
          }}>{sensTone.label}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--fg3)", lineHeight: 1.5 }}>{info.detail}</div>
      </div>
    </label>);

}

// ─── Attachment preview modal ──────────────────────────────
// Logs render as a mono code block; screenshots render as a stylised
// SVG mock of what the POS displayed. The content is keyed by filename
// so the same attachment always shows the same body — feels real for a
// demo without us actually shipping log/image files.

// Canned log content per filename. Each line is { t, lvl, msg }.
const FAKE_LOGS = {
  "emv-kernel-2026-05-15.log": [
  ["14:31:40.012", "I", "EMV-Kernel  start tx · contactless · MasterCard"],
  ["14:31:40.114", "I", "EMV-Kernel  SELECT 2PAY.SYS.DDF01 ok"],
  ["14:31:40.218", "I", "EMV-Kernel  AID A0000000041010 selected"],
  ["14:31:40.422", "W", "EMV-Kernel  GPO response slow (412 ms, expected < 200)"],
  ["14:31:40.911", "E", "EMV-Kernel  GENERATE AC timeout after 600 ms"],
  ["14:31:40.912", "E", "EMV-Kernel  kernel timeout — terminal returns 6F00"],
  ["14:31:40.913", "I", "PayCore     declined · code = EMV_KERNEL_TIMEOUT"],
  ["14:31:44.001", "I", "EMV-Kernel  start tx · contactless · MasterCard"],
  ["14:31:44.503", "E", "EMV-Kernel  GENERATE AC timeout after 600 ms"],
  ["14:31:44.504", "I", "PayCore     declined · code = EMV_KERNEL_TIMEOUT"],
  ["14:31:48.022", "I", "EMV-Kernel  start tx · contactless · MasterCard"],
  ["14:31:48.520", "E", "EMV-Kernel  GENERATE AC timeout after 600 ms"],
  ["14:31:48.521", "I", "PayCore     declined · code = EMV_KERNEL_TIMEOUT"],
  ["14:31:52.044", "I", "EMV-Kernel  start tx · contactless · MasterCard"],
  ["14:31:52.541", "E", "EMV-Kernel  GENERATE AC timeout after 600 ms"],
  ["14:31:52.541", "I", "PayCore     declined · code = EMV_KERNEL_TIMEOUT"],
  ["14:31:52.660", "W", "SecureEl    clock drift detected · agent ts vs SE ts = +18.4 s"],
  ["14:31:52.661", "W", "SecureEl    candidate root cause for AC timeout"],
  ["14:32:08.001", "I", "TelemetryAg uploading alert payload · 4 EMV failures / 90 s"]],

  "ril-2026-05-14.log": [
  ["11:50:01.220", "I", "RIL         registered · Rogers · LTE Cat-4 · band B7"],
  ["11:50:01.225", "I", "RIL         RSRP -86 dBm · RSRQ -10 dB · serving cell 24074"],
  ["11:52:14.100", "W", "RIL         handover attempt to LTE Cat-6 · band B12"],
  ["11:52:14.512", "E", "RIL         handover failed · cell ho_lst.failurecount = 1"],
  ["11:52:14.513", "W", "RIL         falling back to Wi-Fi for next 12 s"],
  ["11:52:18.001", "I", "WifiState   joined Riverside-Old-Port-2G · weak (-78 dBm)"],
  ["11:52:26.118", "I", "RIL         re-attached cellular · LTE Cat-4 · RSRP -89 dBm"],
  ["12:10:01.331", "W", "RIL         second drop event · 18 minutes from last"],
  ["12:10:01.332", "E", "RIL         handover failed · cell ho_lst.failurecount = 2"],
  ["12:10:05.402", "I", "WifiState   joined Riverside-Old-Port-2G · weak (-80 dBm)"],
  ["12:10:18.041", "I", "RIL         re-attached cellular · stable"],
  ["12:35:02.020", "W", "RIL         third drop event · 25 minutes from last"],
  ["12:35:08.514", "I", "TelemetryAg uploading cellular drop pattern report"]],

  "integrity-check-2026-05-15.log": [
  ["09:01:55.011", "I", "Integrity   start scheduled scan"],
  ["09:01:55.012", "I", "Integrity   bootloader status = unlocked"],
  ["09:01:55.013", "E", "Integrity   FAILED check 01 · bootloader must be locked"],
  ["09:01:55.022", "I", "Integrity   /system mount = rw (expected ro)"],
  ["09:01:55.023", "E", "Integrity   FAILED check 02 · /system writable"],
  ["09:01:55.041", "I", "Integrity   su binary present at /system/xbin/su"],
  ["09:01:55.042", "E", "Integrity   FAILED check 03 · su binary detected"],
  ["09:01:55.099", "I", "Integrity   safetynet attestation = FAILED"],
  ["09:01:55.110", "E", "Integrity   FAILED check 04 · attestation chain broken"],
  ["09:02:01.001", "W", "TamperAgent raising HIGH-severity alert to cloud"],
  ["09:02:11.220", "I", "TelemetryAg cloud accepted · ticket T-2026-003 created"]],

  "printer-driver-2026-05-15.log": [
  ["08:35:01.020", "I", "Printer     init · model TM-T88VI-X800 · firmware 2.04"],
  ["08:35:01.105", "I", "Printer     cuts_total = 148302 · paper_left = 38 m"],
  ["08:38:14.221", "I", "Printer     receipt rendered · 412 bytes"],
  ["08:38:14.318", "W", "Printer     cutter step duration 286 ms (expected 220-260)"],
  ["08:38:14.320", "E", "Printer     incomplete cut detected · paper not fully separated"],
  ["08:38:14.321", "I", "Printer     cuts_total = 148303"],
  ["08:40:38.041", "I", "Printer     receipt rendered · 380 bytes"],
  ["08:40:38.138", "W", "Printer     cutter step duration 291 ms"],
  ["08:40:38.140", "E", "Printer     incomplete cut detected · second consecutive"],
  ["08:42:51.012", "I", "Printer     receipt rendered · 420 bytes · cut OK"],
  ["08:45:17.099", "E", "Printer     incomplete cut · 4th in 10 minutes"],
  ["08:45:17.100", "W", "TelemetryAg pattern threshold crossed · agent uploading"]],

  "pos-pro-crash-trace.txt": [
  ["10:01:42.118", "I", "POS-Pro     opening tip-prompt screen · order=#41028"],
  ["10:01:42.220", "E", "POS-Pro     java.lang.NullPointerException"],
  ["10:01:42.221", "E", "POS-Pro       at com.acme.pos.fmt.fmt_currency(Currency.kt:48)"],
  ["10:01:42.222", "E", "POS-Pro       at com.acme.pos.tip.TipScreen.computePresets(TipScreen.kt:112)"],
  ["10:01:42.222", "E", "POS-Pro       at com.acme.pos.tip.TipScreen.onResume(TipScreen.kt:74)"],
  ["10:01:42.223", "E", "POS-Pro       at android.app.Activity.performResume(Activity.java:8420)"],
  ["10:01:42.224", "E", "POS-Pro     FATAL — locale=en-CA · tipPercents=[null,null,null]"],
  ["10:01:42.310", "I", "POS-Pro     crash report captured · uploading on next sync"],
  ["10:01:48.001", "I", "POS-Pro     restarting · order=#41028 recovered to draft"]],

  "icc-2026-05-15.log": [
  ["13:30:14.011", "I", "EMV-Kernel  ICC inserted"],
  ["13:30:14.082", "I", "EMV-Kernel  ATR ok · 3B...90 00"],
  ["13:30:14.118", "I", "EMV-Kernel  SELECT 1PAY.SYS.DDF01"],
  ["13:30:14.301", "W", "EMV-Kernel  AID priority list mismatch with kernel config"],
  ["13:30:14.302", "I", "EMV-Kernel  loaded fallback AID order"],
  ["13:30:14.421", "I", "EMV-Kernel  AID A0000000031010 candidate (Visa)"],
  ["13:30:14.520", "E", "EMV-Kernel  GET PROCESSING OPTIONS returns 6985"],
  ["13:30:14.521", "E", "EMV-Kernel  6985 = conditions of use not satisfied"],
  ["13:30:14.522", "I", "PayCore     decline · code = ICC_6985 · advise insert again"],
  ["13:30:14.901", "I", "EMV-Kernel  ICC re-inserted by cashier"],
  ["13:30:15.520", "E", "EMV-Kernel  identical 6985 outcome"]]

};
// Default fallback for unknown filenames.
const FALLBACK_LOG = [
["00:00:00.000", "I", "TelemetryAg log not preserved for this attachment"],
["00:00:00.001", "W", "TelemetryAg only a stub line was retained — file integrity below threshold"]];

function logLinesFor(name) {
  return FAKE_LOGS[name] || FALLBACK_LOG;
}

// SVG mock of the screenshot the device captured. Different filename →
// different mock so it feels coherent with each ticket.
function ScreenshotMock({ name }) {
  if (name === "terminal-error-1432.png") {
    return <PosErrorMock title="Transaction declined"
    sub="EMV kernel timeout · please try again"
    code="0x6F00" cardHint="Mastercard contactless" tone="error" />;
  }
  if (name === "error-6985.png") {
    return <PosErrorMock title="Transaction declined"
    sub="Conditions of use not satisfied"
    code="0x6985" cardHint="Visa chip insert" tone="error" />;
  }
  if (name === "printer-status.png") {
    return <PosErrorMock title="Receipt warning"
    sub="Last receipt was not fully cut"
    code="PRN_INCOMPLETE_CUT" cardHint="Re-print? Yes / No" tone="warning" />;
  }
  return <PosErrorMock title="POS screen" sub="(no mock available)"
  code="—" cardHint="" tone="warning" />;
}

function PosErrorMock({ title, sub, code, cardHint, tone }) {
  const accent = tone === "error" ? "oklch(54% 0.20 25)" : "oklch(60% 0.18 70)";
  return (
    <div style={{
      width: "100%", aspectRatio: "9 / 16", maxWidth: 320, margin: "0 auto",
      background: "linear-gradient(170deg, oklch(15% 0.04 250) 0%, oklch(10% 0.02 250) 100%)",
      borderRadius: 18, padding: 14,
      boxShadow: "0 16px 40px rgba(0,0,0,.3)",
      color: "#fff", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-family-sans)",
      position: "relative", overflow: "hidden"
    }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: 10, fontFamily: "var(--font-family-mono)",
        color: "rgba(255,255,255,.7)", marginBottom: 14 }}>
        <span>14:32</span>
        <span>● ● ● 4G  ▮▮▯</span>
      </div>
      {/* Big circle icon */}
      <div style={{
        width: 88, height: 88, margin: "12px auto 0",
        borderRadius: "50%", background: `color-mix(in oklab, ${accent} 24%, transparent)`,
        border: `2px solid ${accent}`,
        display: "grid", placeItems: "center",
        boxShadow: `0 0 0 8px color-mix(in oklab, ${accent} 12%, transparent)`
      }}>
        <span style={{ fontSize: 42, color: accent, fontWeight: 600, lineHeight: 1 }}>
          {tone === "error" ? "✕" : "!"}
        </span>
      </div>
      <div style={{ marginTop: 18, textAlign: "center", padding: "0 6px" }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.75)", lineHeight: 1.5 }}>
          {sub}
        </div>
      </div>
      <div style={{
        marginTop: 14, padding: "10px 12px",
        background: "rgba(255,255,255,.04)", borderRadius: 8,
        border: "1px solid rgba(255,255,255,.06)",
        fontFamily: "var(--font-family-mono)", fontSize: 10.5,
        color: "rgba(255,255,255,.7)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(255,255,255,.45)" }}>code</span>
          <span style={{ color: accent, fontWeight: 600 }}>{code}</span>
        </div>
        {cardHint &&
        <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,.45)" }}>card</span>
            <span>{cardHint}</span>
          </div>
        }
      </div>
      <div style={{ flex: 1 }} />
      {/* Faux buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, padding: "10px 0", borderRadius: 8,
          background: "rgba(255,255,255,.08)", textAlign: "center",
          fontSize: 12, fontWeight: 500 }}>Cancel</div>
        <div style={{ flex: 1, padding: "10px 0", borderRadius: 8,
          background: accent, color: "#fff", textAlign: "center",
          fontSize: 12, fontWeight: 600 }}>Retry</div>
      </div>
      {/* Home indicator */}
      <div style={{ width: 80, height: 3, borderRadius: 2,
        background: "rgba(255,255,255,.4)", margin: "10px auto 0" }} />
    </div>);

}

// ─── Assign dialog ─────────────────────────────────────────
// Reassigns a ticket to another teammate (or back to the queue).
// Reason is required (>= 8 chars) so the recipient gets context;
// reason is appended both to the ticket timeline and as a comment so
// it surfaces in the conversation thread, not just the audit log.
function AssignDialog({ open, ticket, role, me, onClose, onConfirm }) {
  const roster = TICKET_ROSTER[role] || [];
  // ISO manages the case-owner slot (assignedTo). NPT manages the
  // investigator slot (nptHandler). The dialog only ever moves the
  // slot that belongs to the current role.
  const slotField = role === "NPT" ? "nptHandler" : "assignedTo";
  const currentHolder = ticket[slotField];
  const candidates = roster.filter((r) => r.id !== currentHolder);
  const [assignee, setAssignee] = useStateT(null);
  const [reason, setReason] = useStateT("");
  useEffectT(() => {
    if (!open) {setAssignee(null);setReason("");}
  }, [open]);
  if (!open) return null;
  const selected = roster.find((r) => r.id === assignee);
  const canConfirm = !!assignee && reason.trim().length > 0;
  const prevLabel = currentHolder || "Unassigned";

  return (
    <window.Modal open onClose={onClose} width={560}
    title="Reassign ticket"
    subtitle={<>Hand off <span className="mono">{ticket.id}</span> to a teammate or return it to the queue. The reason is shared with the recipient.</>}
    footer={
    <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {!assignee && <span style={{ color: "var(--color-warning-700)" }}>Pick a recipient</span>}
            {assignee && !reason.trim() &&
        <span style={{ color: "var(--color-warning-700)" }}>Reason required</span>
        }
            {canConfirm && <span style={{ color: "var(--color-success-700)" }}>Ready to hand off</span>}
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="user" disabled={!canConfirm}
      onClick={() => onConfirm({ assignee, reason: reason.trim() })}>
            {selected?.queue ? "Return to queue" : "Reassign"}
          </window.Button>
        </>
    }>
      {/* Current owner */}
      <div style={{
        padding: "8px 12px", marginBottom: 14,
        background: "var(--bg2)", border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        fontSize: 12, color: "var(--fg2)",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"
      }}>
        <span style={{ color: "var(--fg3)" }}>Currently with</span>
        <span style={{ fontWeight: 500, color: "var(--fg1)" }}>{prevLabel}</span>
        {currentHolder === me &&
        <span style={{
          padding: "1px 7px", borderRadius: 999,
          background: "var(--info-bg)", color: "var(--color-info-700)",
          fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
          textTransform: "uppercase"
        }}>YOU</span>
        }
      </div>

      {/* Recipient list */}
      <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Hand off to</div>
      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        maxHeight: 280, overflow: "auto",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg1)",
        padding: 4
      }}>
        {candidates.map((r) => {
          const on = assignee === r.id;
          const initials = r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <button key={r.id} type="button" onClick={() => setAssignee(r.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr) auto",
              gap: 10, alignItems: "center", textAlign: "left",
              padding: "9px 10px", borderRadius: "var(--radius-sm)",
              border: on ? "1px solid color-mix(in oklab, var(--color-primary-600) 50%, transparent)" :
              "1px solid transparent",
              background: on ? "color-mix(in oklab, var(--color-primary-600) 8%, transparent)" :
              "transparent",
              cursor: "pointer", fontFamily: "inherit",
              transition: "background .12s ease, border-color .12s ease"
            }}
            onMouseEnter={(e) => {if (!on) e.currentTarget.style.background = "var(--bg2)";}}
            onMouseLeave={(e) => {if (!on) e.currentTarget.style.background = "transparent";}}>
              <span style={{
                width: 30, height: 30, borderRadius: "50%",
                background: r.queue ? "var(--bg3)" : "color-mix(in oklab, var(--color-primary-600) 14%, transparent)",
                color: r.queue ? "var(--fg2)" : "var(--color-primary-700)",
                display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 600,
                fontFamily: "var(--font-family-mono)",
                flexShrink: 0
              }}>
                {r.queue ?
                <window.Ico name="users" size={13} stroke={1.8} /> :
                initials}
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)" }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 1, textWrap: "pretty" }}>
                  {r.sub}
                </div>
              </span>
              {on &&
              <window.Ico name="check" size={14} stroke={2.4}
              style={{ color: "var(--color-primary-700)" }} />
              }
            </button>);

        })}
        {candidates.length === 0 &&
        <div style={{ padding: "14px 10px", textAlign: "center",
          fontSize: 12, color: "var(--fg3)" }}>
            No other teammates available to hand off to.
          </div>
        }
      </div>

      {/* Reason */}
      <div style={{ marginTop: 14 }}>
        <div className="overline" style={{ fontSize: 10, marginBottom: 6,
          display: "flex", alignItems: "center", gap: 6 }}>
          <span>Why this person</span>
          <span style={{ color: "var(--color-warning-700)", fontWeight: 600 }}>· required</span>
        </div>
        <textarea value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={selected?.queue ?
        "Why are you returning this to the queue? e.g. 'going off-shift, partial notes in comments'" :
        "Why is this person the right next owner? e.g. 'Sarah owns the merchant relationship and has run this fault before'"}
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "8px 10px",
          fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.55,
          background: "var(--bg1)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          color: "var(--fg1)", resize: "vertical"
        }} />
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg3)" }}>
          Posted as a comment so the new owner sees it inline.
        </div>
      </div>
    </window.Modal>);

}

// ─── NPT Reply dialog ──────────────────────────────────────
// NPT replies to ISO with a structured Solution. The Solution summary
// is required (>= 12 chars); root cause + steps are optional but encouraged.
// Everything is stored on ticket.solution AND posted as a comment so ISO
// can copy/paste it directly into their customer reply.
function ReplyDialog({ open, ticket, onClose, onConfirm }) {
  const [summary, setSummary] = useStateT("");
  const [rootCause, setRootCause] = useStateT("");
  const [steps, setSteps] = useStateT("");
  useEffectT(() => {
    if (!open) {setSummary("");setRootCause("");setSteps("");}
  }, [open]);
  if (!open) return null;
  const canConfirm = summary.trim().length > 0;

  return (
    <window.Modal open onClose={onClose} width={620}
    title="Reply to ISO"
    subtitle={<>Send a Solution back to ISO for <span className="mono">{ticket.id}</span>. ISO relays this to the customer — write it so it's usable as-is.</>}
    footer={
    <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {!summary.trim() ?
        <span style={{ color: "var(--color-warning-700)" }}>Solution summary required</span> :
        <span style={{ color: "var(--color-success-700)" }}>Ready to send</span>}
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="send" disabled={!canConfirm}
      onClick={() => onConfirm({
        summary: summary.trim(),
        rootCause: rootCause.trim(),
        steps: steps.trim()
      })}>
            Send reply
          </window.Button>
        </>
    }>
      {/* Solution summary — required */}
      <div>
        <div className="overline" style={{ fontSize: 10, marginBottom: 6,
          display: "flex", alignItems: "center", gap: 6 }}>
          <span>Solution summary</span>
          <span style={{ color: "var(--color-warning-700)", fontWeight: 600 }}>· required</span>
        </div>
        <textarea value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What did you do? Write a 1–3 sentence answer ISO can read back to the customer. e.g. 'Hotfix 4.3.3 published to the public app pool — push to the merchant's devices and the crash is gone.'"
        rows={3}
        autoFocus
        style={inputStyle} />
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg3)" }}>
          Goes to ISO and is mirrored to <code style={{ background: "var(--bg2)", padding: "1px 4px", borderRadius: 3 }}>ticket.solution</code>.
        </div>
      </div>

      {/* Root cause — optional */}
      <div style={{ marginTop: 14 }}>
        <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
          Root cause <span style={{ color: "var(--fg3)", fontWeight: 400, letterSpacing: 0 }}>· optional</span>
        </div>
        <input value={rootCause}
        onChange={(e) => setRootCause(e.target.value)}
        placeholder="One line — e.g. 'fmt_currency() NPE in CAD locale tip strings'"
        style={inputStyle} />
      </div>

      {/* Steps for ISO — optional */}
      <div style={{ marginTop: 14 }}>
        <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
          Steps for ISO to apply <span style={{ color: "var(--fg3)", fontWeight: 400, letterSpacing: 0 }}>· optional</span>
        </div>
        <textarea value={steps}
        onChange={(e) => setSteps(e.target.value)}
        placeholder={"One per line, e.g.:\n1. Push POS Pro 4.3.3 to merchant 'Lakeside Café'\n2. Confirm crash gone with merchant\n3. Close ticket"}
        rows={4}
        style={inputStyle} />
      </div>

      {/* Audit hint */}
      <div style={{
        marginTop: 14, padding: "10px 12px",
        background: "color-mix(in oklab, var(--color-info-500) 6%, transparent)",
        border: "1px solid color-mix(in oklab, var(--color-info-500) 18%, transparent)",
        borderRadius: "var(--radius-md)",
        fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.55,
        display: "flex", gap: 8
      }}>
        <window.Ico name="info" size={13} stroke={1.8}
        style={{ color: "var(--color-info-700)", flexShrink: 0, marginTop: 1 }} />
        <span>
          The Solution is posted to the ticket timeline AND added as a comment so ISO
          can read it inline. NPT never contacts the customer — ISO does.
        </span>
      </div>
    </window.Modal>);

}

// Shared input style used by ReplyDialog's textarea + input fields.
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  padding: "8px 10px",
  fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.55,
  background: "var(--bg1)",
  border: "1px solid var(--border-1)",
  borderRadius: "var(--radius-md)",
  color: "var(--fg1)", resize: "vertical"
};

function AttachmentPreviewModal({ attachment, ticket, onClose }) {
  if (!attachment) return null;
  const isLog = attachment.kind === "log";
  const isShot = attachment.kind === "screenshot";

  return (
    <window.Modal open onClose={onClose} width={760}
    title={attachment.name}
    subtitle={
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
        fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
        background: isLog ? "var(--bg3)" : "oklch(94% 0.03 230)",
        color: isLog ? "var(--fg2)" : "oklch(40% 0.16 230)",
        letterSpacing: "0.05em", textTransform: "uppercase",
        fontFamily: "var(--font-mono)"
      }}>{attachment.kind}</span>
          <span className="mono" style={{ color: "var(--fg3)" }}>{attachment.size}</span>
          <span style={{ color: "var(--fg3)" }}>· captured from</span>
          <a href="#" onClick={(e) => {e.preventDefault();}}
      className="mono" style={{ color: "var(--accent)", textDecoration: "underline",
        textUnderlineOffset: 2 }}>{ticket.deviceSn}</a>
        </span>
    }
    footer={
    <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            Read-only preview — full file available via the device agent.
          </span>
          <window.Button icon="download"
      onClick={() => window.showToast?.(`Downloading ${attachment.name}…`, "info")}>
            Download
          </window.Button>
          <window.Button primary onClick={onClose}>Close</window.Button>
        </>
    }
    padding={isShot ? "var(--space-6)" : 0}>
      {isLog && <LogViewer name={attachment.name} />}
      {isShot &&
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: 460, background: "var(--color-bg-3)",
        borderRadius: "var(--radius-md)", padding: 18
      }}>
          <ScreenshotMock name={attachment.name} />
        </div>
      }
      {!isLog && !isShot &&
      <div style={{ padding: 30, textAlign: "center", color: "var(--fg3)", fontSize: 13 }}>
          Preview not available for this file type.
        </div>
      }
    </window.Modal>);

}

function LogViewer({ name }) {
  const lines = logLinesFor(name);
  const [query, setQuery] = useStateT("");
  const [levels, setLevels] = useStateT({ I: true, W: true, E: true });
  const [activeMatch, setActiveMatch] = useStateT(0);
  const bodyRef = React.useRef(null);

  const toggleLevel = (l) => setLevels((s) => ({ ...s, [l]: !s[l] }));

  // Filter + match-index calculation
  const { filtered, matchCount } = useMemoT(() => {
    const q = query.trim().toLowerCase();
    const filtered = [];
    let mCount = 0;
    lines.forEach(([t, lvl, msg], origIdx) => {
      if (!levels[lvl]) return;
      const hay = `${t} ${lvl} ${msg}`.toLowerCase();
      const hasMatch = q && hay.includes(q);
      if (q && !hasMatch) return;
      filtered.push({ t, lvl, msg, origIdx, isMatch: hasMatch });
      if (hasMatch) mCount++;
    });
    return { filtered, matchCount: mCount };
  }, [lines, query, levels]);

  // Reset active match when query changes
  useEffectT(() => {setActiveMatch(0);}, [query]);

  // Scroll to active match
  useEffectT(() => {
    if (!query || matchCount === 0 || !bodyRef.current) return;
    const rows = bodyRef.current.querySelectorAll("tr[data-match='1']");
    const target = rows[activeMatch];
    if (target) {
      const container = bodyRef.current;
      const top = target.offsetTop - container.offsetTop - 80;
      container.scrollTop = Math.max(0, top);
    }
  }, [activeMatch, matchCount, query]);

  const counts = useMemoT(() => {
    const out = { I: 0, W: 0, E: 0 };
    lines.forEach(([, lvl]) => {out[lvl] = (out[lvl] || 0) + 1;});
    return out;
  }, [lines]);

  // Render a line's message with the search term highlighted.
  const renderMsg = (msg) => {
    const q = query.trim();
    if (!q) return msg;
    const lower = msg.toLowerCase();
    const qLower = q.toLowerCase();
    const out = [];
    let i = 0,found;
    while ((found = lower.indexOf(qLower, i)) !== -1) {
      if (found > i) out.push(msg.slice(i, found));
      out.push(<mark key={i} style={{
        background: "oklch(70% 0.18 75)", color: "oklch(15% 0.04 250)",
        padding: "0 2px", borderRadius: 2, fontWeight: 600
      }}>{msg.slice(found, found + q.length)}</mark>);
      i = found + q.length;
    }
    if (i < msg.length) out.push(msg.slice(i));
    return out;
  };

  return (
    <div style={{ background: "oklch(12% 0.01 250)", display: "flex", flexDirection: "column" }}>
      {/* Terminal-style toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 12px",
        background: "oklch(16% 0.01 250)",
        borderBottom: "1px solid oklch(22% 0.01 250)"
      }}>
        {/* Faux traffic lights */}
        <div style={{ display: "flex", gap: 5, marginRight: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(58% 0.20 25)" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(72% 0.16 80)" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(60% 0.16 142)" }} />
        </div>

        {/* Search box */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px",
          background: "oklch(18% 0.01 250)",
          border: "1px solid oklch(26% 0.01 250)",
          borderRadius: "var(--radius-sm)",
          flex: 1, minWidth: 200, maxWidth: 360
        }}>
          <window.Ico name="search" size={12} stroke={1.8}
          style={{ color: "oklch(55% 0.02 240)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="grep…"
          style={{
            flex: 1, background: "transparent", border: 0, outline: "none",
            fontFamily: "var(--font-family-mono)", fontSize: 11.5,
            color: "oklch(92% 0.005 240)", padding: 0
          }} />
          {query &&
          <button onClick={() => setQuery("")}
          style={{
            background: "transparent", border: 0, padding: 0, cursor: "pointer",
            color: "oklch(55% 0.02 240)", display: "inline-flex"
          }}>
              <window.Ico name="x" size={11} />
            </button>
          }
          {query && matchCount > 0 &&
          <span className="mono" style={{ fontSize: 10, color: "oklch(70% 0.02 240)",
            padding: "0 6px", borderLeft: "1px solid oklch(26% 0.01 250)" }}>
              <span style={{ color: "oklch(82% 0.10 75)" }}>{activeMatch + 1}</span>
              <span style={{ color: "oklch(48% 0.02 240)" }}> / {matchCount}</span>
            </span>
          }
          {query && matchCount === 0 &&
          <span className="mono" style={{ fontSize: 10, color: "oklch(70% 0.18 25)" }}>no match</span>
          }
          {query && matchCount > 0 &&
          <span style={{ display: "inline-flex", gap: 1 }}>
              <button onClick={() => setActiveMatch((i) => (i - 1 + matchCount) % matchCount)}
            title="Previous match (Shift+Enter)"
            style={{
              background: "transparent", border: 0, padding: "0 2px", cursor: "pointer",
              color: "oklch(72% 0.02 240)", display: "inline-flex"
            }}>
                <window.Ico name="chevu" size={11} />
              </button>
              <button onClick={() => setActiveMatch((i) => (i + 1) % matchCount)}
            title="Next match (Enter)"
            style={{
              background: "transparent", border: 0, padding: "0 2px", cursor: "pointer",
              color: "oklch(72% 0.02 240)", display: "inline-flex"
            }}>
                <window.Ico name="chevd" size={11} />
              </button>
            </span>
          }
        </div>

        {/* Level filter chips */}
        <div style={{ display: "inline-flex", gap: 4 }}>
          {["I", "W", "E"].map((l) => {
            const on = levels[l];
            const color = l === "E" ? "oklch(70% 0.18 25)" :
            l === "W" ? "oklch(80% 0.16 75)" :
            "oklch(70% 0.05 240)";
            return (
              <button key={l} onClick={() => toggleLevel(l)}
              title={`Toggle ${l === "I" ? "info" : l === "W" ? "warning" : "error"} lines`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 8px",
                background: on ? `color-mix(in oklab, ${color} 16%, transparent)` : "transparent",
                border: "1px solid",
                borderColor: on ? `color-mix(in oklab, ${color} 35%, transparent)` : "oklch(26% 0.01 250)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-family-mono)", fontSize: 10.5, fontWeight: 600,
                color: on ? color : "oklch(48% 0.02 240)",
                cursor: "pointer",
                textDecoration: on ? "none" : "line-through",
                textDecorationColor: "oklch(48% 0.02 240)",
                letterSpacing: "0.04em"
              }}>
                {l}
                <span style={{
                  color: on ? color : "oklch(40% 0.02 240)",
                  fontWeight: 500, opacity: on ? 0.85 : 0.6
                }}>{counts[l]}</span>
              </button>);

          })}
        </div>

        {/* Spacer + counts */}
        <span style={{ marginLeft: "auto",
          fontFamily: "var(--font-family-mono)", fontSize: 10,
          color: "oklch(55% 0.02 240)" }}>
          <span style={{ color: "oklch(78% 0.02 240)" }}>{filtered.length}</span>
          <span> / {lines.length} lines</span>
        </span>
      </div>

      {/* Log body — fixed height keeps the modal stable when filter changes */}
      <div ref={bodyRef} style={{
        height: 460, overflow: "auto",
        fontFamily: "var(--font-family-mono)",
        fontSize: 11.5, lineHeight: 1.6
      }}>
        {filtered.length === 0 ?
        <div style={{
          height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
          padding: "0 16px",
          color: "oklch(55% 0.02 240)", fontSize: 12, textAlign: "center"
        }}>
            <window.Ico name="search" size={20} stroke={1.5}
          style={{ color: "oklch(40% 0.02 240)" }} />
            <div>No lines match the current filter.</div>
            {query &&
          <div style={{ fontSize: 11, color: "oklch(48% 0.02 240)" }}>
                Try clearing the search or enabling more levels above.
              </div>
          }
          </div> :

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {filtered.map((line, i) => {
              const lvlColor = line.lvl === "E" ? "oklch(70% 0.18 25)" :
              line.lvl === "W" ? "oklch(80% 0.16 75)" :
              "oklch(70% 0.05 240)";
              // Only the active match gets highlighted; the others stay normal.
              const isActiveMatch = line.isMatch && filtered.filter((x, idx) => x.isMatch && idx <= i).length - 1 === activeMatch;
              const rowBg = isActiveMatch ? "oklch(22% 0.10 75 / 0.45)" :
              line.lvl === "E" ? "oklch(20% 0.07 25 / 0.4)" :
              "transparent";
              return (
                <tr key={line.origIdx} data-match={line.isMatch ? "1" : "0"}
                style={{ background: rowBg }}>
                    <td style={{
                    padding: "2px 12px 2px 16px",
                    color: "oklch(48% 0.02 240)",
                    whiteSpace: "nowrap", verticalAlign: "top",
                    userSelect: "none", width: 1,
                    fontSize: 10.5,
                    borderRight: isActiveMatch ? "2px solid oklch(80% 0.16 75)" : "2px solid transparent"
                  }}>{String(line.origIdx + 1).padStart(3, " ")}</td>
                    <td style={{
                    padding: "2px 10px 2px 0",
                    color: "oklch(70% 0.02 240)",
                    whiteSpace: "nowrap", verticalAlign: "top",
                    width: 1
                  }}>{line.t}</td>
                    <td style={{
                    padding: "2px 8px 2px 0",
                    width: 1
                  }}>
                      <span style={{
                      color: lvlColor, fontWeight: 600,
                      padding: "0 5px", borderRadius: 2,
                      background: `color-mix(in oklab, ${lvlColor} 14%, transparent)`
                    }}>{line.lvl}</span>
                    </td>
                    <td style={{
                    padding: "2px 16px 2px 0",
                    color: line.lvl === "E" ? "oklch(82% 0.10 25)" : "oklch(90% 0.005 240)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word"
                  }}>{renderMsg(line.msg)}</td>
                  </tr>);

            })}
            </tbody>
          </table>
        }
      </div>

      {/* Footer status line */}
      <div style={{
        padding: "5px 14px",
        background: "oklch(16% 0.01 250)",
        borderTop: "1px solid oklch(22% 0.01 250)",
        fontFamily: "var(--font-family-mono)", fontSize: 10,
        color: "oklch(55% 0.02 240)",
        display: "flex", justifyContent: "space-between", gap: 10
      }}>
        <span>
          <span style={{ color: "oklch(70% 0.05 240)" }}>{counts.I || 0}I</span>
          <span> · </span>
          <span style={{ color: "oklch(80% 0.16 75)" }}>{counts.W || 0}W</span>
          <span> · </span>
          <span style={{ color: "oklch(70% 0.18 25)" }}>{counts.E || 0}E</span>
        </span>
        <span>
          {query ? <>filter: <span style={{ color: "oklch(82% 0.10 75)" }}>"{query}"</span></> : "no filter"}
        </span>
      </div>
    </div>);

}

// ─── Reply to customer & close ─────────────────────────────
// Closing a ticket optionally lets the operator attach a short note to
// the resolution notification (and as a comment on the ticket). The note
// is optional — the close fires regardless of whether it's filled.
function ReplyCloseDialog({ open, ticket, onClose, onConfirm }) {
  const [note, setNote] = useStateT("");
  useEffectT(() => { if (!open) setNote(""); }, [open]);
  if (!open) return null;
  const trimmed = note.trim();
  return (
    <window.Modal open onClose={onClose} width={520}
    title="Reply to customer and close?"
    subtitle={<>Mark <span className="mono">{ticket.id}</span> as resolved and notify the customer. You can reopen later if needed.</>}
    footer={
    <>
        <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
          {trimmed ?
          <span style={{ color: "var(--color-success-700)" }}>Note will be sent with the closing email</span> :
          "Note is optional"}
        </span>
        <window.Button onClick={onClose}>Cancel</window.Button>
        <window.Button primary icon="check"
        onClick={() => onConfirm({ note: trimmed })}>
          Notify & close
        </window.Button>
      </>}>
      <window.Field label="Reply to customer"
      hint="Optional — included in the resolution email sent to the merchant, and logged as a comment.">
        <window.Textarea value={note} onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="e.g. We've confirmed the fault is fixed. Please reach out again if it returns." />
      </window.Field>
    </window.Modal>);

}

// ─── NPT-internal close dialog ─────────────────────────────
// Slim variant of ReplyCloseDialog for tickets NPT logged on its own.
// No customer on the other end, no ISO handoff — just a resolution
// note for the audit trail. Closes go straight from npt-working to
// closed, skipping the npt-resolved ("Replied") interstitial.
function InternalCloseDialog({ open, ticket, onClose, onConfirm }) {
  const [note, setNote] = useStateT("");
  useEffectT(() => { if (!open) setNote(""); }, [open]);
  if (!open) return null;
  const trimmed = note.trim();
  return (
    <window.Modal open onClose={onClose} width={520}
    title="Close this ticket?"
    subtitle={<>Close <span className="mono">{ticket.id}</span>. This is an NPT-internal ticket, so it goes straight to <b>Closed</b> — no reply to ISO needed.</>}
    footer={
    <>
        <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
          {trimmed ?
          <span style={{ color: "var(--color-success-700)" }}>Resolution note will be saved on the ticket</span> :
          "Resolution note is optional"}
        </span>
        <window.Button onClick={onClose}>Cancel</window.Button>
        <window.Button primary icon="check"
        onClick={() => onConfirm({ note: trimmed })}>
          Close ticket
        </window.Button>
      </>}>
      <window.Field label="Resolution note"
      hint="Optional — recorded as a comment and visible on the timeline. Helpful when the same fault resurfaces later.">
        <window.Textarea value={note} onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="e.g. Rebooted the gateway and the lockup cleared. Will monitor for recurrence over the next 24h." />
      </window.Field>
    </window.Modal>);

}

// ─── Reopen-ticket dialog ──────────────────────────────────
// Reopening a closed ticket is a meaningful audit event — operators
// must explain *why* (mandatory comment) so the trail later answers
// "I see this was closed once, who reopened it and what changed?".
function ReopenDialog({ open, ticket, role, onClose, onConfirm }) {
  const [reason, setReason] = useStateT("");
  useEffectT(() => { if (!open) setReason(""); }, [open]);
  if (!open) return null;
  const trimmed = reason.trim();
  const actor = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";
  // Reason is optional — the reopen itself is always logged as a
  // comment, but we let operators reopen quickly without a long note
  // for the routine "customer says it returned, no time to elaborate"
  // case.
  const submit = () => onConfirm(trimmed);
  return (
    <window.Modal open onClose={onClose} width={520}
      title={<>Reopen <span className="mono">{ticket.id}</span>?</>}
      subtitle={<>The ticket will move back to <b>ISO working</b>. A
        comment is added to the thread so the team knows the case is
        being revived — adding a reason is recommended but not required.</>}
      footer={
        <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {trimmed
              ? <span style={{ color: "var(--color-success-700)" }}>Reason will be recorded</span>
              : <span>No reason — a generic comment will be recorded</span>}
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="refresh" onClick={submit}>
            Reopen ticket
          </window.Button>
        </>
      }>
      {/* What changed since close — current resolution recap */}
      {ticket.timeline && (() => {
        const lastResolution = [...(ticket.timeline || [])].reverse()
          .find(e => e.kind === "resolution");
        if (!lastResolution) return null;
        return (
          <div style={{
            padding: "10px 12px", marginBottom: 14,
            background: "var(--bg2)", border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--fg2)", lineHeight: 1.5,
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 4 }}>
              Closed previously
            </div>
            <div className="mono" style={{ color: "var(--fg3)", fontSize: 11 }}>
              {lastResolution.at}
            </div>
            <div style={{ color: "var(--fg1)", marginTop: 2 }}>
              {lastResolution.note}
            </div>
          </div>
        );
      })()}

      <window.Field
        label={<>Reason for reopening <span style={{ color: "var(--fg3)",
          fontWeight: 400, letterSpacing: 0 }}>· optional</span></>}
        hint={<>Posts to <span className="mono">{ticket.id}</span> as <span style={{ color: "var(--fg2)", fontWeight: 500 }}>{actor}</span>. Visible in the comments thread.</>}>
        <window.Textarea value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 400))}
          rows={4}
          placeholder="What changed? e.g. Customer reports the fault recurred at 14:32 — same symptom as before." />
      </window.Field>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg3)",
        display: "flex", justifyContent: "flex-end" }}>
        <span className="mono num">{reason.length}/400</span>
      </div>
    </window.Modal>
  );
}


function CommentDialog({ open, ticket, role, onClose, onSubmit }) {
  const [draft, setDraft] = useStateT("");
  useEffectT(() => { if (!open) setDraft(""); }, [open]);
  if (!open) return null;
  const trimmed = draft.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft("");
  };
  const actor = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";
  return (
    <window.Modal open onClose={onClose} width={520}
    title="Add comment"
    subtitle={<>Posts to <span className="mono">{ticket.id}</span> as <span style={{ color: "var(--fg2)", fontWeight: 500 }}>{actor}</span>. Visible on the ticket timeline.</>}
    footer={
    <>
        <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
          {trimmed ?
          <span style={{ color: "var(--color-success-700)" }}>Ready to post</span> :
          "Anything you want teammates to see"}
        </span>
        <window.Button onClick={onClose}>Cancel</window.Button>
        <window.Button primary icon="arrowR" disabled={!trimmed} onClick={submit}>
          Post comment
        </window.Button>
      </>}>
      <window.Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
      rows={5}
      placeholder="What you tried, observations, hand-off context — anything teammates should see." />
    </window.Modal>);

}

// ─── Exports ───────────────────────────────────────────────
Object.assign(window, {
  TicketsListScreen, TicketDetailScreen, NewTicketScreen,
  findTicketById, openTicketsForDevice, currentRole, currentUser, ticketOrigin,
  TICKET_STATUS, TICKET_TYPE, TICKET_SEVERITY, STATUS_ORDER, TICKET_ROSTER,
  // Dialogs reused by the Workbench top-bar actions so it can Assign /
  // Escalate to NPT / Reply & close from inside the tool tab.
  EscalateDialog, AssignDialog, ReplyDialog, ReplyCloseDialog, InternalCloseDialog, CommentDialog,
  GRANT_LABELS, buildSnapshotFor,
  ScreenshotMock, PosErrorMock,
  logLinesFor
});