/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Devices (production fleet) — ISO-only
// Each device is a physical terminal an ISO has activated and now operates.
// Scope per the product spec:
//   1. Basic identity     — SN, model, OS/firmware, activated/created, last seen
//   2. Hardware posture   — root, dev-mode, security warnings
//   3. Network            — SIM, ethernet, Wi-Fi (SSID)
//   4. Pre-installed apps — name, version, installed-at, system flag, logo
//   5. System settings    — timezone, language, auto-sync flags
// We keep this read-mostly: an ISO inspects a device, occasionally re-binds
// or reboots; we don't replicate the device's own settings UI in here.
// ─────────────────────────────────────────────────────────────

const { useState: useStateD, useMemo: useMemoD, useEffect: useEffectD } = React;

// ─── Seed data ──────────────────────────────────────────────
// Six representative devices spanning each Carbon model and most flag
// combinations (root, dev-mode, security alerts) so the detail page shows
// realistic variation.
const DEVICES_SEED = [
  {
    sn: "N950-0014-9281", model: "N950",
    os: "Android 14", firmware: "TOMS 8.2.1-r127", buildNumber: "8.2.1.127.prod",
    activatedAt: "Feb 14, 2025",   createdAt: "Feb 10, 2025",   lastSeenAt: "5 min ago",
    state: "active", merchantId: "m-coffee", storeId: "s-coffee-hq",
    imei: "354782109876541", macAddress: "C8:E0:EB:14:9A:28",
    storage: { total: 32, used: 11.4 },        // GB
    battery: { level: 87, health: "good" },
    hardware: { root: false, devMode: false,  securityWarnings: [] },
    network:  { sim: { enabled: true,  carrier: "Bell" },
                ethernet: { enabled: false },
                wifi: { enabled: true,  ssid: "Riverside-POS" } },
    settings: { timezone: "America/Toronto", language: "en-CA",
                autoTimezone: true, autoTime: true },
    apps: [
      { id: "pos",      name: "Acme POS Pro",  version: "4.3.2",   installedAt: "May 10, 2025", system: false },
      { id: "loyalty",  name: "Loyalty+",      version: "1.3.4",   installedAt: "Apr 20, 2025", system: false },
      { id: "toms-mdm", name: "TOMS MDM",      version: "5.1.0",   installedAt: "Feb 14, 2025", system: true  },
      { id: "toms-pay", name: "TOMS PayCore",  version: "3.8.2",   installedAt: "Feb 14, 2025", system: true  },
      { id: "android",  name: "Android System", version: "14",     installedAt: "Feb 14, 2025", system: true  },
    ],
  },
  {
    sn: "N950-0014-3322", model: "N950",
    os: "Android 14", firmware: "TOMS 8.2.1-r127", buildNumber: "8.2.1.127.prod",
    activatedAt: "Nov 04, 2024", createdAt: "Oct 28, 2024", lastSeenAt: "just now",
    state: "active", merchantId: "m-bistro", storeId: "s-bistro-hq",
    imei: "354782109876702", macAddress: "C8:E0:EB:14:33:22",
    storage: { total: 32, used: 14.8 },
    battery: { level: 64, health: "good" },
    hardware: { root: false, devMode: false, securityWarnings: [] },
    network: { sim: { enabled: true, carrier: "Telus" },
               ethernet: { enabled: false },
               wifi: { enabled: true, ssid: "CascadeBistro-Guest" } },
    settings: { timezone: "America/Vancouver", language: "en-CA",
                autoTimezone: true, autoTime: true },
    apps: [
      { id: "pos",      name: "Acme POS Pro",  version: "4.3.2",  installedAt: "May 11, 2025", system: false },
      { id: "loyalty",  name: "Loyalty+",      version: "1.3.4",  installedAt: "Apr 22, 2025", system: false },
      { id: "toms-mdm", name: "TOMS MDM",      version: "5.1.0",  installedAt: "Nov 04, 2024", system: true  },
      { id: "toms-pay", name: "TOMS PayCore",  version: "3.8.2",  installedAt: "Nov 04, 2024", system: true  },
    ],
  },
  {
    sn: "S60-0488-0021", model: "S60",
    os: "Android 13", firmware: "TOMS 7.4.3-r88", buildNumber: "7.4.3.88.prod",
    activatedAt: "Sep 12, 2024", createdAt: "Aug 30, 2024", lastSeenAt: "3 days ago",
    state: "inactive", merchantId: "m-coffee", storeId: "s-coffee-pln",
    imei: "354782108821091", macAddress: "A0:B8:6E:04:88:21",
    storage: { total: 16, used: 5.2 },
    battery: { level: 12, health: "fair" },
    hardware: { root: false, devMode: true, securityWarnings: ["Developer options enabled"] },
    network: { sim: { enabled: false },
               ethernet: { enabled: false },
               wifi: { enabled: true, ssid: "Plateau-Back-2G" } },
    settings: { timezone: "America/Toronto", language: "fr-CA",
                autoTimezone: true, autoTime: false },
    apps: [
      { id: "pos",      name: "Acme POS Pro",  version: "4.2.5",  installedAt: "Mar 12, 2025", system: false },
      { id: "toms-mdm", name: "TOMS MDM",      version: "5.0.4",  installedAt: "Sep 12, 2024", system: true  },
      { id: "toms-pay", name: "TOMS PayCore",  version: "3.7.1",  installedAt: "Sep 12, 2024", system: true  },
    ],
  },
  {
    sn: "X800-0099-1422", model: "X800",
    os: "Android 14", firmware: "TOMS 8.2.0-r119", buildNumber: "8.2.0.119.prod",
    activatedAt: "Jan 20, 2025", createdAt: "Jan 15, 2025", lastSeenAt: "2 min ago",
    state: "active", merchantId: "m-glacier", storeId: "s-glacier-bby",
    imei: null, macAddress: "0C:8B:FD:99:14:22",
    storage: { total: 64, used: 24.0 },
    battery: null, // kiosk — line-powered
    hardware: { root: false, devMode: false, securityWarnings: [] },
    network: { sim: { enabled: false },
               ethernet: { enabled: true },
               wifi: { enabled: false } },
    settings: { timezone: "America/Vancouver", language: "en-CA",
                autoTimezone: true, autoTime: true },
    apps: [
      { id: "catalog",  name: "Catalog Sync", version: "1.0.9",  installedAt: "Apr 30, 2025", system: false },
      { id: "pos",      name: "Acme POS Pro", version: "4.3.2",  installedAt: "May 10, 2025", system: false },
      { id: "toms-mdm", name: "TOMS MDM",     version: "5.1.0",  installedAt: "Jan 20, 2025", system: true  },
      { id: "android",  name: "Android System", version: "14",   installedAt: "Jan 20, 2025", system: true  },
    ],
  },
  {
    sn: "N750-0099-0040", model: "N750",
    os: "Android 13", firmware: "TOMS 7.4.0-r71", buildNumber: "7.4.0.71.prod",
    activatedAt: "Jul 02, 2024", createdAt: "Jun 28, 2024", lastSeenAt: "11 hours ago",
    state: "active", merchantId: "m-coffee", storeId: "s-coffee-old",
    imei: "354782107770040", macAddress: "B4:CE:F6:09:00:40",
    storage: { total: 16, used: 7.1 },
    battery: { level: 45, health: "good" },
    hardware: { root: true, devMode: false,
                securityWarnings: ["Device appears to be rooted", "Bootloader unlock detected"] },
    network: { sim: { enabled: true, carrier: "Rogers" },
               ethernet: { enabled: false },
               wifi: { enabled: false } },
    settings: { timezone: "America/Toronto", language: "en-CA",
                autoTimezone: false, autoTime: false },
    apps: [
      { id: "pos",      name: "Acme POS Pro",  version: "4.3.1",  installedAt: "Apr 25, 2025", system: false },
      { id: "toms-mdm", name: "TOMS MDM",      version: "5.0.4",  installedAt: "Jul 02, 2024", system: true  },
    ],
  },
  {
    sn: "S90-0822-2007", model: "S90",
    os: "Android 14", firmware: "TOMS 8.2.1-r127", buildNumber: "8.2.1.127.prod",
    activatedAt: null, createdAt: "May 10, 2026", lastSeenAt: "never",
    state: "pending", merchantId: "m-bistro", storeId: "s-bistro-hq",
    imei: "354782108220007", macAddress: "C8:E0:EB:82:20:07",
    storage: { total: 32, used: 1.2 },
    battery: { level: 100, health: "new" },
    hardware: { root: false, devMode: false, securityWarnings: [] },
    network: { sim: { enabled: false },
               ethernet: { enabled: false },
               wifi: { enabled: false } },
    settings: { timezone: "America/Vancouver", language: "en-CA",
                autoTimezone: true, autoTime: true },
    apps: [
      { id: "toms-mdm", name: "TOMS MDM",      version: "5.1.0",  installedAt: "May 10, 2026", system: true },
    ],
  },
];

// ─── Northwind Logistics fleet (20 terminals) ────────────────
// Generated so the New Ticket picker has a realistic "large merchant"
// case to exercise the merchant / store scope filters. The entries
// mirror MERCHANTS_SEED in merchants.jsx (same SN, merchantId, storeId)
// so the device-detail pages render properly.
const NORTHWIND_DEVICES = (() => {
  const STORES = [
    { storeId: "s-nw-hq",  count: 5, prefix: "70" },
    { storeId: "s-nw-yyz", count: 6, prefix: "71" },
    { storeId: "s-nw-yul", count: 5, prefix: "72" },
    { storeId: "s-nw-yyc", count: 4, prefix: "73" },
  ];
  const MODELS = ["N950", "N950", "N950", "S90", "S60", "X800"];
  const carriers = ["Bell", "Telus", "Rogers"];
  const cities = {
    "s-nw-hq":  { tz: "America/Vancouver", lang: "en-CA", ssid: "Northwind-Burnaby-Ops" },
    "s-nw-yyz": { tz: "America/Toronto",   lang: "en-CA", ssid: "YYZ-Cargo-WLAN" },
    "s-nw-yul": { tz: "America/Montreal",  lang: "fr-CA", ssid: "YUL-Cargo-WLAN" },
    "s-nw-yyc": { tz: "America/Edmonton",  lang: "en-CA", ssid: "YYC-Dock-WLAN" },
  };
  const out = [];
  STORES.forEach((s, si) => {
    for (let i = 1; i <= s.count; i++) {
      const model = MODELS[i % MODELS.length];
      const snBase = String(i).padStart(2, "0");
      const sn = `${model}-0210-${s.prefix}${snBase}`;
      const isXpad = model === "X800";
      const c = cities[s.storeId];
      out.push({
        sn, model,
        os: "Android 14", firmware: "TOMS 8.2.1-r127", buildNumber: "8.2.1.127.prod",
        activatedAt: "Mar 04, 2024", createdAt: "Feb 28, 2024",
        lastSeenAt: `${i} min ago`,
        state: "active", merchantId: "m-northwind", storeId: s.storeId,
        imei: isXpad ? null : `35478211000${s.prefix}${snBase}0`,
        macAddress: `C8:E0:EB:${s.prefix}:${snBase}:${(si * 11 % 99).toString(16).padStart(2, "0").toUpperCase()}`,
        storage: { total: isXpad ? 64 : 32, used: 6 + (i % 9) },
        battery: isXpad ? null : { level: 60 + (i * 7) % 35, health: "good" },
        hardware: { root: false, devMode: false, securityWarnings: [] },
        network: {
          sim: isXpad ? { enabled: false } : { enabled: true, carrier: carriers[i % carriers.length] },
          ethernet: { enabled: isXpad },
          wifi: { enabled: !isXpad, ssid: c.ssid },
        },
        settings: { timezone: c.tz, language: c.lang, autoTimezone: true, autoTime: true },
        apps: [
          { id: "pos",      name: "Acme POS Pro",   version: "4.3.2",  installedAt: "May 10, 2025", system: false },
          { id: "toms-mdm", name: "TOMS MDM",       version: "5.1.0",  installedAt: "Mar 04, 2024", system: true  },
          { id: "toms-pay", name: "TOMS PayCore",   version: "3.8.2",  installedAt: "Mar 04, 2024", system: true  },
          { id: "android",  name: "Android System", version: "14",     installedAt: "Mar 04, 2024", system: true  },
        ],
      });
    }
  });
  return out;
})();
DEVICES_SEED.push(...NORTHWIND_DEVICES);

window.PROD_DEVICES = window.PROD_DEVICES || DEVICES_SEED.map(d => ({ ...d }));

function findDeviceBySn(sn) {
  return (window.PROD_DEVICES || []).find(d => d.sn === sn) || null;
}

// ─── Last-seen formatting ──────────────────────────────────
// The seed data carries lastSeenAt as a relative string ("5 min ago",
// "just now", "3 days ago") for human readability. For the devices
// table we display the actual timestamp of the terminal's last
// check-in with the platform — relative is recomputed against a fixed
// "now" anchor so the prototype renders stable timestamps across
// reloads.
const LAST_SEEN_NOW_REF = new Date("2026-05-12T14:30:00");
function lastSeenTimestamp(rel) {
  if (!rel || rel === "never") return null;
  let agoMs = 0;
  if (rel === "just now") {
    agoMs = 0;
  } else {
    const m = /^(\d+)\s+(sec|min|minute|hour|day|week|month|year)s?\s+ago$/i.exec(rel);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    const mult = u.startsWith("sec")   ? 1e3
               : u.startsWith("min")   ? 6e4
               : u.startsWith("hour")  ? 36e5
               : u.startsWith("day")   ? 864e5
               : u.startsWith("week")  ? 6048e5
               : u.startsWith("month") ? 2592e6
               :                          31536e6;
    agoMs = n * mult;
  }
  const d = new Date(LAST_SEEN_NOW_REF.getTime() - agoMs);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
       + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ─── State pill tone map ───────────────────────────────────
const DEVICE_STATE = {
  active:   { label: "Active",   tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  pending:  { label: "Pending",  tone: "info"    },
};

// ─── Latest firmware per model (target the fleet should be on) ──
// In a real system this is what the OEM publishes; here we hard-code so
// the Apps & Firmware tab can show an update-available state for some
// devices and "up-to-date" for others.
const TARGET_FIRMWARE = {
  N950: { version: "TOMS 8.2.2-r131", releasedAt: "May 08, 2026", notes: "Wi-Fi 6E driver fix, EMV kernel 1.4.7" },
  N750: { version: "TOMS 7.5.0-r92",  releasedAt: "Apr 22, 2026", notes: "Battery calibration, security patch level 2026-04" },
  S60:  { version: "TOMS 7.4.3-r88",  releasedAt: "Mar 11, 2026", notes: "Printer driver, security patch level 2026-03" },
  S90:  { version: "TOMS 8.2.2-r131", releasedAt: "May 08, 2026", notes: "Wi-Fi 6E driver fix, EMV kernel 1.4.7" },
  X800: { version: "TOMS 8.2.0-r119", releasedAt: "Jan 14, 2026", notes: "Kiosk auto-lock improvements" },
};

// ─── Required apps (what every device should have) ────────
// In a real system this is configured per fleet/template. Hardcoded here so
// we can compare against `device.apps` and produce missing/outdated lists.
const REQUIRED_APPS_DEFAULT = [
  { id: "toms-mdm", name: "TOMS MDM",     version: "5.1.0", category: "system" },
  { id: "toms-pay", name: "TOMS PayCore", version: "3.8.2", category: "system" },
  { id: "pos",      name: "Acme POS Pro", version: "4.3.2", category: "business" },
];
function requiredAppsFor(device) {
  const merchant = window.findMerchantById?.(device.merchantId);
  const out = [...REQUIRED_APPS_DEFAULT];
  // F&B merchants need Loyalty+ on every terminal.
  if ((merchant?.tags || []).includes("F&B")) {
    out.push({ id: "loyalty", name: "Loyalty+", version: "1.3.4", category: "business" });
  }
  return out;
}
function compareVer(a, b) {
  const pa = String(a).split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.-]/).map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
function appDeltaFor(device) {
  const required = requiredAppsFor(device);
  const installed = device.apps || [];
  const missing = required.filter(r => !installed.some(i => i.id === r.id));
  const outdated = required
    .filter(r => {
      const inst = installed.find(i => i.id === r.id);
      return inst && compareVer(inst.version, r.version) < 0;
    })
    .map(r => ({ ...r, installedVersion: installed.find(i => i.id === r.id).version }));
  return { required, missing, outdated };
}
function firmwareDeltaFor(device) {
  const target = TARGET_FIRMWARE[device.model];
  if (!target || !device.firmware) return null;
  if (device.firmware === target.version) return { current: device.firmware, target, behind: false };
  const buildOf = (s) => parseInt((s.match(/r(\d+)/i) || [])[1] || "0", 10);
  return {
    current: device.firmware,
    target,
    behind: true,
    behindBy: Math.max(0, buildOf(target.version) - buildOf(device.firmware)),
  };
}

// ─── Push history (operations sent to the device) ─────────
// Each entry: { kind, target, queuedAt, status, completedAt, by, error? }
function pushHistoryFor(device) {
  const base = [
    { kind: "app-install", target: "Acme POS Pro 4.3.2",  queuedAt: "May 10, 2026 14:02", status: "completed", completedAt: "May 10, 2026 14:11", by: "M. Hassan" },
    { kind: "firmware",    target: TARGET_FIRMWARE[device.model]?.version || "—", queuedAt: "Apr 29, 2026 09:30", status: "completed", completedAt: "Apr 29, 2026 09:47", by: "Auto-scheduler" },
    { kind: "app-update",  target: "Loyalty+ 1.3.4",      queuedAt: "Apr 22, 2026 11:14", status: "completed", completedAt: "Apr 22, 2026 11:23", by: "M. Hassan" },
  ];
  if (device.state === "active") {
    base.unshift({ kind: "app-install", target: "Catalog Sync 1.0.9", queuedAt: "May 11, 2026 16:40", status: "pending", completedAt: null, by: "M. Hassan" });
  }
  if (device.state !== "active") {
    base.unshift({ kind: "app-install", target: "Acme POS Pro 4.3.2", queuedAt: "May 12, 2026 10:00", status: "failed", completedAt: "May 12, 2026 10:15", by: "M. Hassan", error: "Device offline — will retry on next check-in" });
  }
  return base;
}

// ─── Runtime snapshot (what the device last reported) ─────
function runtimeFor(device) {
  const seed = device.sn.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  const cpu = 15 + (seed % 50);
  const memTotal = device.model === "X800" ? 6 : 4;
  const memUsed = parseFloat((memTotal * (0.4 + ((seed % 40) / 100))).toFixed(1));
  const diskTotal = device.storage?.total || 32;
  const diskUsed = device.storage?.used ?? diskTotal * 0.35;
  const sampledAt = device.state === "active"  ? (device.lastSeenAt || "5 min ago")
                  : device.state === "pending" ? "—"
                                              : "3 days ago";
  return {
    cpu, memUsed, memTotal,
    diskUsed: parseFloat(diskUsed.toFixed ? diskUsed.toFixed(1) : diskUsed),
    diskTotal,
    networkMode: device.network.ethernet.enabled ? "Ethernet"
              : device.network.wifi.enabled ? "Wi-Fi"
              : device.network.sim.enabled ? "Cellular"
              : "Offline",
    root: device.hardware.root,
    devMode: device.hardware.devMode,
    sampledAt,
    isOnline: device.state === "active",
  };
}

// ─── Device events (boot / install / network) ─────────────
function eventsFor(device) {
  return [
    { kind: "boot",          at: "May 12, 2026 08:02", detail: "Device powered on" },
    { kind: "net-change",    at: "May 12, 2026 08:03",
      detail: device.network.wifi.enabled ? `Joined Wi-Fi · ${device.network.wifi.ssid}`
            : device.network.ethernet.enabled ? "Ethernet link up"
            : device.network.sim.enabled ? `Cellular attached · ${device.network.sim.carrier}`
            : "Offline" },
    { kind: "app-install",   at: "May 11, 2026 16:44", detail: "Catalog Sync 1.0.9 installed" },
    { kind: "app-update",    at: "May 10, 2026 14:11", detail: "Acme POS Pro 4.3.1 → 4.3.2" },
    { kind: "boot",          at: "May 09, 2026 06:30", detail: "Device powered on" },
    { kind: "net-change",    at: "May 08, 2026 22:10", detail: "Wi-Fi disconnected" },
    { kind: "app-uninstall", at: "May 04, 2026 11:00", detail: "Trial Counter 0.9.1 removed" },
    { kind: "boot",          at: "May 02, 2026 07:45", detail: "Device powered on after firmware update" },
  ];
}

// ─── Live memory snapshot (returned by the "Fetch" probe) ──
// Just static data — the wow factor is the loading state.
function liveMemoryFor(device) {
  return [
    { name: "Acme POS Pro",       pid: 1248, memMB: 142 },
    { name: "TOMS PayCore",       pid:  892, memMB:  88 },
    { name: "TOMS MDM",           pid:  712, memMB:  64 },
    { name: "Loyalty+",           pid: 1502, memMB:  51 },
    { name: "System UI",          pid:  220, memMB:  98 },
    { name: "android.system",     pid:   42, memMB: 312 },
    { name: "webview",            pid: 1830, memMB:  72 },
  ];
}

// ─── Memory summary (used in the Health strip) ─────────────
// Synthesizes a believable RAM total per device tier (matches the
// hardware we'd realistically ship for that storage class) and
// derives "used" from the same process list the Memory probe shows
// so the two read consistently.
function memSummaryFor(device) {
  const procs = liveMemoryFor(device);
  const usedMB = procs.reduce((s, p) => s + p.memMB, 0); // ~827 MB
  const totalMB = device.storage?.total >= 64 ? 4096
                : device.storage?.total >= 32 ? 3072
                                              : 2048;
  return {
    usedMB, totalMB,
    pct: Math.round((usedMB / totalMB) * 100),
    usedGB:  (usedMB  / 1024).toFixed(1),
    totalGB: (totalMB / 1024).toFixed(1),
  };
}

// ─── Derived per-device metadata ──────────────────────────
// Stable codes/timestamps the UI shows but that we don't store in the
// seed data — derived deterministically from the SN/model so the same
// device always shows the same values.
function deviceMetaFor(device) {
  const seed = device.sn.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  // Manufacturer (factory) lookup by model — every Carbon model is built
  // by a specific OEM. Cosmetic.
  const MFR = {
    N950: "Wingtech Shenzhen",
    N750: "Wingtech Shenzhen",
    S60:  "Foxconn Chengdu",
    S90:  "Foxconn Chengdu",
    X800: "Pegatron Suzhou",
  };
  // Carbon part-number convention: PN-<model>-<rev>-<sku>
  const rev = ["A1", "A2", "B1"][seed % 3];
  const sku = String(1000 + (seed % 8999)).slice(-4);
  const pn = `PN-${device.model}-${rev}-${sku}`;
  // Hardware identification code (HWID) — 16-hex string, stable per SN.
  // (Distinct from IMEI / MAC. Used by TOMS to fingerprint the SoC.)
  const hex = (n) => n.toString(16).toUpperCase().padStart(4, "0").slice(-4);
  const hwid = `${hex(seed)}-${hex(seed >> 8)}-${hex(seed >> 4)}-${hex(seed * 31)}`;
  // Hardware configuration code — 6-digit, encodes the RAM/storage tier.
  const ramTier = device.model === "X800" ? "6" : "4";
  const diskTier = device.storage?.total >= 64 ? "C"
                : device.storage?.total >= 32 ? "B"
                                              : "A";
  const cfg = `${device.model.slice(0, 2)}${ramTier}${diskTier}${String(100 + (seed % 900))}`;
  // Last boot time — peg to the most recent "boot" event if we have one,
  // otherwise derive a plausible recent timestamp.
  const lastBoot = device.state === "active"  ? "May 12, 2026 08:02"
                 : device.state === "pending" ? null
                                              : "May 09, 2026 06:30";
  // Geo coordinates per store id. Real lat/lng would come from a
  // geocode service; this is a hand-curated map so the placeholder map
  // looks correct (right city, right neighbourhood).
  const STORE_COORDS = {
    "s-coffee-hq":  { lat: 45.5088, lng: -73.5544, city: "Montréal, QC" },
    "s-coffee-pln": { lat: 45.5230, lng: -73.5990, city: "Montréal, QC" },
    "s-coffee-old": { lat: 45.5060, lng: -73.5532, city: "Montréal, QC" },
    "s-bistro-hq":  { lat: 49.2900, lng: -123.1320, city: "Vancouver, BC" },
    "s-bistro-pmt": { lat: 49.2818, lng: -122.8460, city: "Port Moody, BC" },
    "s-glacier-bby":{ lat: 49.2780, lng: -122.9970, city: "Burnaby, BC" },
    "s-pharma-hq":  { lat: 53.5193, lng: -113.5300, city: "Edmonton, AB" },
    "s-books-hq":   { lat: 43.6680, lng: -79.3920,  city: "Toronto, ON" },
  };
  const coords = STORE_COORDS[device.storeId] || { lat: 49.2800, lng: -123.1200, city: "Unknown" };
  return { manufacturer: MFR[device.model] || "—",
           pn, hwid, cfg, lastBoot, coords };
}

// ─── SIM traffic (monthly cellular usage for the SIM card) ─
// Generated deterministically per device. Returns null when the device
// has no SIM enabled — the Monitoring tab simply hides the card then.
function simTrafficFor(device) {
  if (!device.network.sim?.enabled) return null;
  const seed = device.sn.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  const capMb = [2048, 5120, 1024][seed % 3];      // 2 GB / 5 GB / 1 GB plan
  const usedMb = Math.round(capMb * (0.30 + ((seed % 60) / 100)));
  const downloadMb = Math.round(usedMb * 0.78);
  const uploadMb = usedMb - downloadMb;
  // 30-day usage curve, in MB, cumulative.
  const days = 30;
  const curve = [];
  const rng = (n) => { let x = seed ^ (n * 2654435761); x = (x ^ (x >> 16)) >>> 0; return (x % 1000) / 1000; };
  let cum = 0;
  const dailyAvg = usedMb / days;
  for (let i = 0; i < days; i++) {
    const v = Math.max(0, dailyAvg * (0.4 + rng(i) * 1.4));
    cum += v;
    curve.push(Math.round(cum));
  }
  // Normalise so the last point equals usedMb.
  const scale = usedMb / cum;
  for (let i = 0; i < curve.length; i++) curve[i] = Math.round(curve[i] * scale);
  // Estimated days remaining at current rate, until the cap is hit.
  const dailyRate = usedMb / Math.min(days, 12);
  const remaining = capMb - usedMb;
  const daysToCap = dailyRate > 0 ? Math.max(0, Math.floor(remaining / dailyRate)) : 99;
  return { capMb, usedMb, downloadMb, uploadMb, curve, daysToCap,
           carrier: device.network.sim.carrier, billingResetsOn: "Jun 01, 2026" };
}

// ─── Device telemetry (system / network / location / settings) ──
// One-stop helper that produces all the categorized telemetry shown
// on the Monitoring tab. Derived from the seed data so it's stable
// per device but varied enough to demo every state.
function deviceTelemetryFor(device) {
  const seed = device.sn.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  const rng = (n) => { let x = seed ^ (n * 2654435761); x = (x ^ (x >> 16)) >>> 0; return (x % 1000) / 1000; };
  const pick = (arr, n) => arr[Math.abs(seed + n) % arr.length];
  const isOnline = device.state === "active";
  const isPending = device.state === "pending";
  const isFlagged = device.hardware?.root || device.hardware?.devMode
                 || (device.hardware?.securityWarnings || []).length > 0;

  // ── Security triggers ─────────────────────────────────
  // Flagged devices report a SAFE trigger with one or more reasons.
  const reasons = [];
  if (device.hardware?.root) reasons.push("HARDWARE");
  if (device.hardware?.devMode) reasons.push("SOFTWARE");
  if ((device.hardware?.securityWarnings || []).length >= 2) reasons.push("BATTERY_LOST_POWER");
  const security = {
    status: isFlagged ? 1 : 0,
    reasons,
    hwAttackCount: isFlagged ? 12 + (seed % 30) : seed % 4,
    swAttackCount: isFlagged ? 1 + (seed % 6) : 0,
    rooted: device.hardware.root,
  };

  // ── Uptime statistics ─────────────────────────────────
  // Boot timestamps + various accumulated runtime windows.
  const bootEpoch = isPending ? null : 1767844296 + (seed % 86400);
  const bootDate  = isPending ? null
                  : isOnline  ? "May 12, 2026 08:02:24"
                              : "May 09, 2026 06:30:11";
  const sessionSec   = isPending ? 0
                     : isOnline  ? 35157 + (seed % 7200)    // ~9h45m + jitter
                                 : 12345;
  const todaySec     = isPending ? 0 : 60000 + (seed % 30000);
  const cumulativeSec= 29916101 + (seed % 200000);          // ~346 days
  const uptime = { bootEpoch, bootDate, sessionSec, todaySec, cumulativeSec };

  // ── Network & connectivity ────────────────────────────
  // Switch states + APN + IP. Every active interface has its own IP and
  // (for wireless) a signal-strength reading in dBm.
  const wifiOn = device.network.wifi.enabled;
  const cellOn = device.network.sim.enabled;
  const ethOn  = device.network.ethernet.enabled;
  const network = {
    type: ethOn  ? "Ethernet"
        : wifiOn ? "WIFI"
        : cellOn ? "Cellular"
                 : "Offline",
    wifi: {
      on: wifiOn,
      ssid: wifiOn ? device.network.wifi.ssid : null,
      ip:   wifiOn && isOnline ? `192.168.${(seed >> 4) % 32}.${(seed % 254) + 1}` : null,
      signalDbm: wifiOn ? -42 - ((seed >> 2) % 38) : null,    // -42 … -80 dBm
      linkMbps:  wifiOn ? 144 + ((seed >> 3) % 290) : null,    // 144 … 433 Mbps
      security:  wifiOn ? "WPA2-PSK" : null,
    },
    cellular: {
      on: cellOn,
      carrier:   cellOn ? device.network.sim.carrier : null,
      ip:        cellOn && isOnline ? `100.${(seed >> 8) % 256}.${seed % 256}.${((seed * 7) % 254) + 1}` : null,
      signalDbm: cellOn ? -68 - ((seed >> 5) % 32) : null,    // -68 … -100 dBm
      network:   cellOn ? pick(["LTE Cat-4", "LTE Cat-6", "5G NR (n78)"], 4) : null,
    },
    ethernet: {
      on: ethOn,
      ip:        ethOn && isOnline ? `10.20.${(seed >> 6) % 256}.${seed % 256}` : null,
      linkMbps:  ethOn ? 1000 : null,
      duplex:    ethOn ? "Full" : null,
    },
    bluetooth: { on: true },
    defaultApn: cellOn ? "3gnet" : null,
    apnConfig: cellOn ? {
      name:     "Default Data",
      apn:      "3gnet",
      mcc:      "302",
      mnc:      device.network.sim.carrier === "Bell"   ? "610"
              : device.network.sim.carrier === "Telus"  ? "220"
              : device.network.sim.carrier === "Rogers" ? "720"
                                                        : "001",
      type:     "default,supl",
      proxy:    "",
      port:     "",
      username: "",
      password: "",
      server:   "",
      mmsc:     "",
      authType: "0 (None)",
      protocol: "IPv4/IPv6",
      roamingProtocol: "IPv4",
      bearer:   "Unspecified",
      mvnoType: "None",
      mvnoMatchData: "",
    } : null,
  };

  // ── Location telemetry ────────────────────────────────
  const meta = deviceMetaFor(device);
  const provider = pick(["QUALCOMM", "BAIDU"], 1);
  const todayLoc = {
    date: "20260512",
    sdk: provider,
    successCount: 18 + (seed % 18),
    failCount: 1 + (seed % 5),
  };
  const yesterdayLoc = {
    date: "20260511",
    sdk: provider,
    successCount: 22 + ((seed >> 4) % 12),
    failCount: 2 + ((seed >> 6) % 6),
  };
  const cellTowers = [
    { cid: 2909450 + (seed % 99999), lac: 11290, mcc: 420, mnc: 3 },
    { cid: 98886405 + ((seed >> 4) % 99999), lac: 24074, mcc: 460, mnc: 11 },
  ];
  const nearbyWifi = [
    { mac: "60:3a:7c:a3:16:5f", level: -31 - (seed % 8) },
    { mac: "a0:63:91:22:8f:ae", level: -50 - (seed % 12) },
    { mac: "f4:f5:24:88:01:32", level: -64 - (seed % 10) },
    { mac: "00:1b:11:32:9a:dc", level: -72 - (seed % 8) },
  ];
  const savedWifi = [
    { id: "ca1bd535ce8a", level: -42, ssid: device.network.wifi.ssid || "—" },
    { id: "9f7c20188031", level: -55, ssid: "guest-network" },
  ];
  const location = {
    gpsOn: isOnline && !isPending,
    provider,
    coords: meta.coords,
    today: todayLoc,
    yesterday: yesterdayLoc,
    cellTowers,
    nearbyWifi,
    savedWifi,
  };

  // ── System settings ───────────────────────────────────
  const settings = {
    language:   device.settings.language,
    timezone:   device.settings.timezone,
    inputMethod: pick(["com.google.android.inputmethod.latin", "com.toms.kbd"], 2),
    brightness: 65 + (seed % 30),         // 0-100
    subBrightness: 50 + ((seed >> 3) % 25),
    mediaVolume: 4 + (seed % 8),          // 0-15
    mediaVolumeMax: 15,
    ringVolume:  6 + ((seed >> 4) % 6),
    ringVolumeMax: 15,
    screenTimeoutMs: 60000,
  };

  // ── Security module switches ──────────────────────────
  // Card-reader / printer enable/disable. Most units leave all on; some
  // disable specific paths (e.g., kiosk has no magstripe / printer).
  const isKiosk = device.model === "X800";
  const modules = {
    magstripe:    !isKiosk,
    insertCard:   true,
    contactless:  true,
    printer:      !isKiosk && device.model !== "S60",
  };

  // ── System state (non-standard flags) ────────────────
  const state = {
    terminalLocked:  !isOnline && !isPending,
    statusBarPulldown: !isKiosk,
    unattendedMode:  isKiosk,
    devUnit:         device.hardware.devMode ? 1 : 0,
    sysParams: {
      "ro.epay.adb":             device.hardware.devMode ? "1" : "0",
      "persist.sys.HasSecModule": isKiosk ? "no" : "yes",
      "ro.toms.fleet":            "production",
      "persist.sys.tamper_ack":   security.status ? "pending" : "clean",
    },
  };

  return { security, uptime, network, location, settings, modules, state,
    collectedAt: {
      pretty:  isOnline  ? "May 12, 2026 14:32:08"
             : isPending ? "—"
                         : "May 09, 2026 06:33:21",
      relative: isOnline  ? "3 min ago"
              : isPending ? "Awaiting first check-in"
                          : "3 days ago",
      stale:    !isOnline && !isPending,
    },
  };
}

function fmtDuration(totalSec) {
  if (!totalSec) return "—";
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ─── Pre-warning policies (configured elsewhere; chosen here) ──
const PREWARNING_POLICIES = {
  traffic: [
    { id: "t-strict",  name: "Strict cellular cap (500 MB)",   thresholdMb: 500,  alertAt: "80%" },
    { id: "t-default", name: "Standard 2 GB cap",              thresholdMb: 2048, alertAt: "90%" },
    { id: "t-loose",   name: "Loose 5 GB cap",                 thresholdMb: 5120, alertAt: "95%" },
  ],
  geofence: [
    { id: "g-store-radius",   name: "Within 500 m of store",  detail: "Alert when device exits radius for > 5 min" },
    { id: "g-store-flexible", name: "Within 2 km of store",   detail: "Alert when device exits radius for > 10 min" },
    { id: "g-region-only",    name: "Province / state only",  detail: "Alert when device leaves the registered province" },
  ],
  disk: [
    { id: "d-tight",   name: "Tight — alert below 10 % free", thresholdPct: 10 },
    { id: "d-default", name: "Standard — alert below 20 % free", thresholdPct: 20 },
  ],
};
function prewarningFor(device) {
  return {
    traffic:  { enabled: device.network.sim.enabled, policyId: "t-default" },
    geofence: { enabled: device.state === "active",  policyId: "g-store-radius" },
    disk:     { enabled: true,                       policyId: "d-default" },
  };
}
function prewarningEventsFor(device) {
  if (device.state === "pending") return [];
  return [
    { policy: "Standard 2 GB cap",   kind: "traffic",  at: "May 11, 2026 22:14", level: "warning",
      detail: "Hit 90% of monthly cellular data quota (1.82 GB / 2 GB)" },
    { policy: "Within 500 m of store", kind: "geofence", at: "Apr 27, 2026 18:42", level: "info",
      detail: "Device left geofence — returned 18:51 (9 min)" },
    { policy: "Standard 2 GB cap",   kind: "traffic",  at: "Apr 18, 2026 12:01", level: "info",
      detail: "Hit 75% of monthly cellular data quota (1.50 GB / 2 GB)" },
    ...(device.state === "inactive" ? [{
      policy: "Standard 2 GB cap",   kind: "traffic",  at: "Apr 16, 2026 09:20", level: "critical",
      detail: "Exceeded data quota (2.10 GB / 2 GB) — SIM throttled by carrier",
    }] : []),
  ];
}

// ─── List ───────────────────────────────────────────────────
function DevicesListScreen({ navigate }) {
  const all = window.PROD_DEVICES || [];
  const [q, setQ] = useStateD("");
  const [modelFilter, setModelFilter] = useStateD("any");
  const [stateFilter, setStateFilter] = useStateD("any");

  const filtered = useMemoD(() => all.filter(d => {
    if (modelFilter !== "any" && d.model !== modelFilter) return false;
    if (stateFilter !== "any" && d.state !== stateFilter) return false;
    if (q) {
      const n = q.toLowerCase();
      if (!`${d.sn} ${d.model} ${d.merchantId} ${d.imei || ""}`.toLowerCase().includes(n)) return false;
    }
    return true;
  }), [all, q, modelFilter, stateFilter]);

  const totals = useMemoD(() => ({
    total: all.length,
    active: all.filter(d => d.state === "active").length,
    flagged: all.filter(d => d.hardware?.root || d.hardware?.devMode
                            || (d.hardware?.securityWarnings || []).length > 0).length,
    pending: all.filter(d => d.state === "pending").length,
  }), [all]);

  const models = useMemoD(() => [...new Set(all.map(d => d.model))], [all]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <window.PageHeader
        title="Devices"
        subtitle="Production fleet — every Carbon terminal you've activated, with its hardware posture, network, and installed apps." />

      <div style={{ flex: 1, overflow: "auto", background: "var(--color-bg-1)" }}>
        <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Total devices",   value: totals.total,   sub: "in your fleet" },
              { label: "Active",          value: totals.active,  sub: "checked in recently", tone: "success" },
              { label: "Pending activation", value: totals.pending, sub: "awaiting first contact", tone: totals.pending > 0 ? "info" : undefined },
              { label: "Security flagged", value: totals.flagged, sub: "root / dev-mode / warnings", tone: totals.flagged > 0 ? "warning" : undefined },
            ].map(k => (
              <div key={k.label} style={{
                padding: "12px 16px", borderRadius: "var(--radius-lg)",
                background: "var(--bg2)",
                border: "1px solid var(--border-1)",
                boxShadow: "var(--shadow-1)",
              }}>
                <div className="overline" style={{ fontSize: 10.5 }}>{k.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span className="mono num" style={{
                    fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em",
                    color: k.tone === "success" ? "var(--success)"
                        : k.tone === "warning" ? "var(--warning)"
                        : k.tone === "info"    ? "var(--info)"
                        : "var(--fg1)",
                  }}>{k.value}</span>
                  <span style={{ fontSize: 11, color: "var(--fg3)" }}>{k.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--space-3) var(--space-6)", flexWrap: "wrap" }}>
          <window.Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search SN, model, IMEI, merchant…"
            prefix={<window.Ico name="search" size={12} />}
            style={{ flex: 1, minWidth: 240, maxWidth: 380 }} />
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} style={selectStyle}>
            <option value="any">All models</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
            <option value="any">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {filtered.length} of {all.length} devices
          </div>
        </div>

        <div style={{ padding: "var(--space-3) var(--space-6) var(--space-6)" }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-1)" }}>
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg3)", textAlign: "left" }}>
                    {["Serial number", "Model", "OS / Firmware", "Bound merchant", "Last seen", "Posture", "Status", ""].map((h, i) => (
                      <th key={i} className="overline" style={{
                        padding: "10px 14px", fontSize: 10.5,
                        borderBottom: "1px solid var(--border-1)",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)" }}>
                      No devices match those filters.
                    </td></tr>
                  )}
                  {filtered.map(d => {
                    const merchant = window.findMerchantById?.(d.merchantId);
                    const st = DEVICE_STATE[d.state] || DEVICE_STATE.inactive;
                    const flagged = d.hardware?.root || d.hardware?.devMode
                                  || (d.hardware?.securityWarnings || []).length > 0;
                    return (
                      <tr key={d.sn}
                        onClick={() => navigate({ screen: "deviceDetail", deviceSn: d.sn })}
                        style={{ cursor: "pointer", borderBottom: "1px solid var(--border-1)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{d.sn}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono" style={{ fontSize: 12, color: "var(--fg2)" }}>{d.model}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 12.5 }}>{d.os}</div>
                          <div className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{d.firmware}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--fg2)" }}>
                          {merchant?.name || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 11.5, color: "var(--fg2)" }}>
                          <span className="mono">{lastSeenTimestamp(d.lastSeenAt) || d.lastSeenAt}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {flagged ? (
                            <window.Pill tone="warning" dot size="sm">
                              {d.hardware?.root ? "Rooted"
                              : d.hardware?.devMode ? "Dev mode"
                              : `${d.hardware.securityWarnings.length} warning${d.hardware.securityWarnings.length === 1 ? "" : "s"}`}
                            </window.Pill>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--fg3)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <window.Pill tone={st.tone} dot size="sm">{st.label}</window.Pill>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <window.Ico name="chevr" size={14} style={{ color: "var(--fg3)" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail (tabbed) ───────────────────────────────────────
function DeviceDetailScreen({ device, route, navigate }) {
  const tab = route.tab || "basic";
  const st = DEVICE_STATE[device.state] || DEVICE_STATE.inactive;
  const merchant = window.findMerchantById?.(device.merchantId);
  const store = merchant?.stores?.find(s => s.id === device.storeId);
  const flagged = device.hardware?.root || device.hardware?.devMode
                || (device.hardware?.securityWarnings || []).length > 0;

  const delta = useMemoD(() => appDeltaFor(device), [device]);
  const firmware = useMemoD(() => firmwareDeltaFor(device), [device]);
  const driftCount = delta.missing.length + delta.outdated.length + (firmware?.behind ? 1 : 0);
  const criticalAlerts = useMemoD(
    () => prewarningEventsFor(device).filter(e => e.level === "critical").length,
    [device]);

  // Tab list. Show a numeric badge on Apps & Firmware when there's drift,
  // and on Pre-warning when there are critical alerts — that's how the
  // operator decides where to look first.
  const tabs = [
    { id: "basic",      label: "Basic information" },
    { id: "apps",       label: "Apps & Firmware", count: driftCount || null,
      countTone: driftCount > 0 ? "warning" : null },
    { id: "monitoring", label: "Monitoring" },
    { id: "prewarning", label: "Pre-warning",     count: criticalAlerts || null,
      countTone: criticalAlerts > 0 ? "danger" : null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--color-bg-2)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button onClick={() => navigate({ screen: "devices" })}
            style={{ color: "var(--fg3)", padding: 4 }} title="Back">
            <window.Ico name="chevl" size={16} />
          </button>
          <DeviceModelTile model={device.model} size={70} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 className="mono" style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                {device.sn}
              </h1>
              <window.Pill tone={st.tone} dot size="lg">{st.label}</window.Pill>
              {flagged && (
                <window.Pill tone="warning" dot size="lg">Security attention</window.Pill>
              )}
              {(() => {
                const openTickets = window.openTicketsForDevice?.(device.sn) || [];
                const hasOpen = openTickets.length > 0;
                // Composite ticket chip: left segment = open-count (warning-tinted
                // when > 0, ghost when 0); right segment = `+` to new-ticket form.
                // Joining them keeps the head row in the same visual language
                // (rounded chips/pills) instead of stamping a solid primary button
                // in the middle of an info-only row.
                const segBorder = hasOpen
                  ? "color-mix(in oklab, var(--color-warning-500) 30%, transparent)"
                  : "var(--border-1)";
                const leftBg = hasOpen ? "var(--warning-bg)" : "var(--bg2)";
                const leftFg = hasOpen ? "var(--color-warning-700)" : "var(--fg2)";
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "stretch",
                    borderRadius: 999, overflow: "hidden",
                    border: `1px solid ${segBorder}`,
                    whiteSpace: "nowrap",
                  }}>
                    <button onClick={() => navigate({ screen: "tickets" })}
                      title={hasOpen
                        ? `${openTickets.length} open ticket${openTickets.length === 1 ? "" : "s"} — click to view`
                        : "No open tickets — click to view all"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 10px 3px 10px",
                        background: leftBg, color: leftFg,
                        border: 0, cursor: "pointer",
                        fontSize: 11.5, fontWeight: hasOpen ? 500 : 400,
                        fontFamily: "inherit",
                      }}>
                      {hasOpen
                        ? <><window.Ico name="alert" size={11} stroke={2} />{openTickets.length} open</>
                        : <><window.Ico name="alert" size={11} stroke={1.6} style={{ opacity: 0.6 }} />No open tickets</>}
                    </button>
                    <button onClick={() => navigate({ screen: "newTicket", deviceSn: device.sn })}
                      title="New ticket for this device"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: "3px 9px",
                        background: "var(--bg2)", color: "var(--fg2)",
                        border: 0,
                        borderLeft: `1px solid ${segBorder}`,
                        cursor: "pointer",
                        transition: "background .12s ease, color .12s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "color-mix(in oklab, var(--color-primary-500) 10%, transparent)";
                        e.currentTarget.style.color = "var(--color-primary-700)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--bg2)";
                        e.currentTarget.style.color = "var(--fg2)";
                      }}>
                      <window.Ico name="plus" size={11} stroke={2.2} />
                    </button>
                  </span>
                );
              })()}
              <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>·</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--fg2)" }}>{device.model}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg3)" }}>
              {merchant ? (
                <>Bound to{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate({ screen: "merchantDetail", merchantId: merchant.id, tab: "terminals" }); }}
                    style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {merchant.name}
                  </a>
                  {store && <> · {store.name}{store.isHQ ? " (HQ)" : ""}</>}
                </>
              ) : "Unbound"}
            </div>
          </div>
          <HeaderStats device={device} />
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", gap: 2, padding: "16px 16px 0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => navigate({ ...route, tab: t.id })} style={{
              padding: "7px 12px",
              fontSize: 12.5, fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              borderBottom: "2px solid",
              borderColor: tab === t.id ? "var(--color-text-primary)" : "transparent",
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <span>{t.label}</span>
              {t.count != null && (
                <span className="mono num" style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 600,
                  background: t.countTone === "danger" ? "var(--color-error-50, var(--error-bg))"
                            : t.countTone === "warning" ? "var(--warning-bg)"
                            : "var(--bg3)",
                  color: t.countTone === "danger" ? "var(--color-error-700)"
                       : t.countTone === "warning" ? "var(--color-warning-700)"
                       : "var(--fg3)",
                  border: "1px solid",
                  borderColor: t.countTone === "danger" ? "color-mix(in oklab, var(--color-error-500) 25%, transparent)"
                             : t.countTone === "warning" ? "color-mix(in oklab, var(--color-warning-500) 25%, transparent)"
                             : "var(--border-1)",
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", background: "var(--color-bg-1)" }}>
        {tab === "basic"      && <DeviceBasicTab device={device} flagged={flagged} />}
        {tab === "apps"       && <DeviceAppsTab  device={device} delta={delta} firmware={firmware} />}
        {tab === "monitoring" && <DeviceMonitoringTab device={device} />}
        {tab === "prewarning" && <DevicePrewarningTab device={device} />}
      </div>
    </div>
  );
}

// ─── Tab 1: Basic information ─────────────────────────────
// Layout:
//   - 100% width, responsive. Three rows in a top-down cascade:
//       row 1 (3 cards): Device · Deployment · Network
//       row 2 (2 cards): System · Hardware posture
//       row 3 (full): Location
//     Each row uses `repeat(auto-fit, minmax(…))` so cards reflow into
//     fewer columns as the viewport narrows.
//   - State and runtime-y signals (storage / battery / online) live in
//     the header now, so this tab focuses on identity / deployment /
//     system / hardware-posture / location facts.
function DeviceBasicTab({ device, flagged }) {
  const merchant = window.findMerchantById?.(device.merchantId);
  const store = merchant?.stores?.find(s => s.id === device.storeId);
  const warnings = device.hardware?.securityWarnings || [];
  const meta = deviceMetaFor(device);

  return (
    <div className="device-basic">

      {flagged && <SecurityBanner hardware={device.hardware} />}

      {/* Row 1 — Device · Deployment · Network */}
      <div className="device-basic__row-3">
        <window.Card title="Device">
          <KvTable rows={[
            ["Manufacturer",   <span style={{ fontSize: 13 }}>{meta.manufacturer}</span>],
            ["Part number",    <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{meta.pn}</span>],
            ["IMEI",           device.imei ? <span className="mono" style={{ fontSize: 13 }}>{device.imei}</span> : <Dash />],
            ["Record created", <span className="mono" style={{ fontSize: 13 }}>{device.createdAt}</span>],
            ["Activated",      device.activatedAt
                ? <span className="mono" style={{ fontSize: 13 }}>{device.activatedAt}</span>
                : <span style={{ fontSize: 12.5, color: "var(--color-warning-700)" }}>Pending</span>],
          ]} />
        </window.Card>

        <window.Card title="Deployment">
          <KvTable rows={[
            ["Merchant",  merchant
                ? <a href="#" onClick={(e) => { e.preventDefault();
                    window.__navigate?.({ screen: "merchantDetail", merchantId: merchant.id, tab: "terminals" }); }}
                    style={{ fontSize: 13, color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {merchant.name}
                  </a>
                : <Dash />],
            ["Store",     store
                ? <span style={{ fontSize: 13 }}>
                    {store.name}
                    {store.isHQ && <span style={{
                      marginLeft: 6, fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                      background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                      fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.04em",
                    }}>HQ</span>}
                  </span>
                : <Dash />],
            ["Address",   store?.address
                ? <span style={{ fontSize: 12.5, color: "var(--fg2)", lineHeight: 1.45 }}>{store.address}</span>
                : <Dash />],
            ["Last seen", <span className="mono" style={{ fontSize: 13 }}>{lastSeenTimestamp(device.lastSeenAt) || device.lastSeenAt}</span>],
          ]} />
        </window.Card>

        <window.Card title="Network">
          <NetRow label="Wi-Fi" enabled={device.network.wifi.enabled}
            detail={device.network.wifi.enabled
              ? <><span style={{ color: "var(--fg3)" }}>SSID</span>{" "}<span className="mono" style={{ fontWeight: 500 }}>{device.network.wifi.ssid}</span></>
              : "Disabled"} />
          <NetRow label="Ethernet" enabled={device.network.ethernet.enabled}
            detail={device.network.ethernet.enabled ? "Connected" : "Not in use"} />
          <NetRow label="SIM" enabled={device.network.sim.enabled}
            detail={device.network.sim.enabled
              ? <>Carrier <span className="mono">{device.network.sim.carrier}</span></>
              : "Not in use"} />
        </window.Card>
      </div>

      {/* Row 2 — System · Hardware posture */}
      <div className="device-basic__row-2">
        <window.Card title="System">
          <KvTable rows={[
            ["OS version",     <span className="mono" style={{ fontSize: 13 }}>{device.os}</span>],
            ["Firmware",       <span className="mono" style={{ fontSize: 13 }}>{device.firmware}</span>],
            ["Last boot",      meta.lastBoot
                ? <span className="mono" style={{ fontSize: 13 }}>{meta.lastBoot}</span>
                : <span style={{ fontSize: 12.5, color: "var(--fg3)" }}>Never booted</span>],
            ["Timezone",       <span className="mono" style={{ fontSize: 13 }}>{device.settings.timezone}</span>],
            ["Language",       <span className="mono" style={{ fontSize: 13 }}>{device.settings.language}</span>],
            ["Auto timezone",  <YesNo on={device.settings.autoTimezone} />],
            ["Auto time",      <YesNo on={device.settings.autoTime}
                                  warnWhenOff="Manual clocks drift — PCI logs may reject" />],
          ]} />
        </window.Card>

        <window.Card title="Hardware posture"
          hint={warnings.length > 0
            ? `${warnings.length} active warning${warnings.length === 1 ? "" : "s"}`
            : "Integrity flags reported by the agent"}>
          <KvTable rows={[
            ["MAC address",    device.macAddress ? <span className="mono" style={{ fontSize: 13 }}>{device.macAddress}</span> : <Dash />],
            ["Config code",    <span className="mono" style={{ fontSize: 13 }}>{meta.cfg}</span>],
            ["Hardware ID",    <span className="mono" style={{ fontSize: 12.5, color: "var(--fg2)" }}>{meta.hwid}</span>],
            ["Root status",
              <Flag positive={!device.hardware.root}
                positiveLabel="Not rooted"
                negativeLabel="Rooted — device integrity compromised" />],
            ["Developer mode",
              <Flag positive={!device.hardware.devMode}
                positiveLabel="Disabled"
                negativeLabel="Enabled — production devices should keep this off"
                tone="warning" />],
          ]} />
          {warnings.length > 0 && (
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: "var(--warning-bg)",
              border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
              borderRadius: "var(--radius-md)",
            }}>
              <div className="overline" style={{
                fontSize: 9.5, color: "var(--color-warning-700)", marginBottom: 6,
              }}>Warnings</div>
              <SecurityList warnings={warnings} />
            </div>
          )}
        </window.Card>
      </div>

      {/* Row 3 — Location (full width) */}
      <window.Card title="Location"
        hint="Last known position reported by the device agent."
        action={
          <window.Button size="sm" ghost icon="refresh"
            onClick={() => window.showToast?.("Position refresh queued — will update on next check-in", "info")}>
            Refresh
          </window.Button>
        }>
        <LocationMap coords={meta.coords} address={store?.address}
          state={device.state} lastSeen={device.lastSeenAt} />
      </window.Card>
    </div>
  );
}

// ─── Device model tile (header thumbnail) ──────────────────
// A square tile that stands in for an OEM product photo. Renders a
// stylised silhouette of the model — phone-style for handheld POS units,
// tablet/kiosk form for the X800 line. Sizes are 140 / 70 / 55 / 35 px;
// the header uses 70 by default.
function DeviceModelTile({ model, size = 70 }) {
  const isKiosk = model === "X800";
  const screenInset = Math.round(size * 0.085);
  const radius = Math.round(size * 0.13);
  const screenRadius = Math.round(size * 0.075);
  // Tinted gradient per model so the tile reads as a distinct product.
  const HUES = { N950: 232, N750: 200, S60: 162, S90: 268, X800: 26 };
  const hue = HUES[model] ?? 232;
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: radius,
      background: `linear-gradient(155deg,
        oklch(28% 0.05 ${hue}) 0%,
        oklch(38% 0.07 ${hue}) 100%)`,
      boxShadow: "0 4px 14px rgba(15,18,28,.12), inset 0 0 0 1px oklch(20% 0.04 " + hue + ")",
      padding: screenInset,
      display: "flex", flexDirection: "column",
      position: "relative",
    }}>
      {/* Top "speaker" notch — phone form factor only */}
      {!isKiosk && (
        <div style={{
          width: Math.round(size * 0.22), height: Math.round(size * 0.04),
          background: "rgba(0,0,0,.55)", borderRadius: 999,
          margin: "0 auto",
          marginBottom: Math.round(size * 0.02),
        }} />
      )}
      {/* Screen */}
      <div style={{
        flex: 1,
        background: "linear-gradient(165deg, #0b0f18 0%, #161c2a 100%)",
        borderRadius: screenRadius,
        padding: Math.round(size * 0.07),
        display: "flex", flexDirection: "column",
        gap: Math.round(size * 0.04),
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
      }}>
        {size >= 55 && (
          <>
            <div style={{
              color: "#dde2f0",
              fontSize: Math.max(7, Math.round(size * 0.11)),
              fontWeight: 600, lineHeight: 1.1,
              letterSpacing: "-0.01em",
            }}>TOMS</div>
            <div style={{
              color: "#6b7388",
              fontSize: Math.max(6, Math.round(size * 0.075)),
              fontFamily: "var(--font-mono)", lineHeight: 1.1,
            }}>{model}</div>
            <div style={{
              marginTop: "auto",
              display: "flex", flexDirection: "column",
              gap: Math.max(1.5, Math.round(size * 0.025)),
            }}>
              {[88, 64, 78].slice(0, size >= 70 ? 3 : 2).map((w, i) => (
                <div key={i} style={{
                  height: Math.max(2, Math.round(size * 0.035)),
                  background: "#2a3245", borderRadius: 1.5,
                  width: `${w}%`, opacity: 0.85 - i * 0.18,
                }} />
              ))}
            </div>
          </>
        )}
        {size < 55 && (
          <div style={{
            margin: "auto",
            color: "#dde2f0", fontWeight: 700,
            fontSize: Math.round(size * 0.32),
            letterSpacing: "-0.04em",
          }}>{model.slice(0, 1)}</div>
        )}
      </div>
      {/* Bottom "home" pill — phone form factor only */}
      {!isKiosk && size >= 55 && (
        <div style={{
          width: Math.round(size * 0.32), height: Math.round(size * 0.025),
          background: "rgba(255,255,255,.18)", borderRadius: 999,
          margin: `${Math.round(size * 0.02)}px auto 0`,
        }} />
      )}
    </div>
  );
}

// ─── Header stats (storage + battery + online) ────────────
// Compact info strip beside the title. Mirrors header KPI patterns from
// MerchantDetailScreen so the three header artefacts (model tile, title
// block, stats) read as a single banner.
function HeaderStats({ device }) {
  const isOnline = device.state === "active";
  const storagePct = device.storage
    ? Math.round((device.storage.used / device.storage.total) * 100)
    : null;
  const cell = {
    padding: "8px 12px",
    minWidth: 96,
    background: "var(--bg2)",
    border: "1px solid var(--border-1)",
    borderRadius: "var(--radius-md)",
    display: "flex", flexDirection: "column", gap: 2,
  };
  const labelStyle = { fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
    color: "var(--fg3)", fontWeight: 500 };
  const valueStyle = { fontSize: 14, fontWeight: 600, color: "var(--fg1)",
    letterSpacing: "-0.01em", whiteSpace: "nowrap",
    fontFamily: "var(--font-mono)" };
  const subStyle = { fontSize: 10.5, color: "var(--fg3)", whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0, flexWrap: "wrap" }}>
      <div style={cell}>
        <span style={labelStyle}>Storage</span>
        <span style={{ ...valueStyle,
          color: storagePct >= 90 ? "var(--color-error-700)"
              : storagePct >= 75 ? "var(--color-warning-700)"
              : "var(--fg1)" }}>
          {device.storage
            ? <>{device.storage.used.toFixed(1)}<span style={{ color: "var(--fg3)", fontWeight: 400 }}>/{device.storage.total}</span></>
            : "—"}
          {storagePct != null && <span style={{ fontSize: 10.5, color: "var(--fg3)", fontWeight: 400, marginLeft: 4 }}>GB</span>}
        </span>
        {storagePct != null && <span style={subStyle}>{storagePct}% used</span>}
      </div>
      <div style={cell}>
        <span style={labelStyle}>Battery</span>
        <span style={{ ...valueStyle,
          color: device.battery && device.battery.level < 20 ? "var(--color-warning-700)" : "var(--fg1)" }}>
          {device.battery ? `${device.battery.level}%` : "Line"}
        </span>
        <span style={subStyle}>{device.battery ? device.battery.health : "Line-powered"}</span>
      </div>
      <div style={cell}>
        <span style={labelStyle}>Status</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13.5, fontWeight: 600,
          color: isOnline ? "var(--color-success-700)" : "var(--fg2)" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isOnline ? "var(--success)" : "var(--border-2)",
            boxShadow: isOnline ? "0 0 0 3px oklch(70% 0.16 152 / 0.18)" : "none",
          }} />
          {isOnline ? "Online" : device.state === "pending" ? "Pending" : "Offline"}
        </span>
        <span style={subStyle}>{device.lastSeenAt}</span>
      </div>
    </div>
  );
}

// ─── Location map (placeholder map screenshot) ──────────────
// Static SVG that fakes a map tile with road lines and a pin. We don't
// have a real map provider in this prototype, so this is a deliberately
// stylised placeholder — clearly readable as "device location preview"
// without pretending to be a real Google/Mapbox screenshot.
function LocationMap({ coords, address, state, lastSeen }) {
  const isPending = state === "pending";
  // Deterministic road layout so the map looks the same across renders.
  const seed = (coords.lat * 1000 + coords.lng * 1000) | 0;
  const rng = (n) => { let x = seed ^ (n * 2654435761); x = (x ^ (x >> 16)) >>> 0; return (x % 1000) / 1000; };
  const roads = [];
  for (let i = 0; i < 8; i++) {
    const horiz = rng(i) > 0.5;
    const offset = 30 + rng(i + 20) * 240;
    const width = 2 + rng(i + 40) * 2.5;
    roads.push({ horiz, offset, width });
  }
  // Compact info tile — matches HeaderStats so the location card reads
  // as the same vocabulary of "small blocks" used elsewhere on the page.
  const Tile = ({ label, value, sub, mono = true }) => (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
    }}>
      <span style={{
        fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--fg3)", fontWeight: 500,
      }}>{label}</span>
      <span style={{
        fontSize: 13.5, fontWeight: 500, color: "var(--fg1)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        letterSpacing: "-0.005em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--fg3)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
    </div>
  );
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.6fr) minmax(220px, 1fr)",
      gap: 14,
    }}>
      {/* Map */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 10",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: "1px solid var(--border-1)",
        background: "linear-gradient(135deg, oklch(96% 0.02 230) 0%, oklch(93% 0.025 145) 100%)",
      }}>
        <svg viewBox="0 0 400 225" preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {/* Park / green patch */}
          <ellipse cx="80" cy="180" rx="55" ry="32" fill="oklch(88% 0.06 145)" />
          <ellipse cx="330" cy="50" rx="48" ry="26" fill="oklch(88% 0.06 145)" opacity="0.7" />
          {/* Water */}
          <path d="M 0 180 Q 80 220, 200 200 T 400 215 L 400 225 L 0 225 Z"
            fill="oklch(85% 0.06 230)" opacity="0.85" />
          {/* Road grid */}
          {roads.map((r, i) => r.horiz
            ? <line key={i} x1="-10" x2="410" y1={r.offset * 0.6} y2={r.offset * 0.6}
                stroke="oklch(98% 0 0)" strokeWidth={r.width} />
            : <line key={i} x1={r.offset * 1.3} x2={r.offset * 1.3} y1="-10" y2="235"
                stroke="oklch(98% 0 0)" strokeWidth={r.width} />)}
          {/* Road outlines */}
          {roads.map((r, i) => r.horiz
            ? <line key={`o${i}`} x1="-10" x2="410" y1={r.offset * 0.6} y2={r.offset * 0.6}
                stroke="oklch(86% 0.02 230)" strokeWidth={r.width + 1} opacity="0.4" />
            : <line key={`o${i}`} x1={r.offset * 1.3} x2={r.offset * 1.3} y1="-10" y2="235"
                stroke="oklch(86% 0.02 230)" strokeWidth={r.width + 1} opacity="0.4" />).reverse()}
          {/* Building blocks */}
          {[
            [40, 30, 30, 20], [110, 25, 28, 22], [180, 38, 32, 18],
            [250, 28, 26, 24], [310, 45, 30, 20], [60, 95, 32, 22],
            [220, 100, 28, 26], [285, 110, 24, 22], [150, 130, 26, 20],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h}
              fill="oklch(94% 0.005 230)"
              stroke="oklch(82% 0.01 230)" strokeWidth="0.5"
              rx="1.5" opacity="0.85" />
          ))}
          {/* Map pin */}
          <g transform="translate(200, 102)">
            <ellipse cx="0" cy="14" rx="9" ry="3" fill="rgba(0,0,0,.18)" />
            <path d="M 0 -18 C -10 -18, -14 -10, -14 -4 C -14 6, 0 14, 0 14 C 0 14, 14 6, 14 -4 C 14 -10, 10 -18, 0 -18 Z"
              fill={isPending ? "oklch(58% 0.15 240)" : "oklch(55% 0.18 24)"}
              stroke="white" strokeWidth="1.5" />
            <circle cx="0" cy="-6" r="4" fill="white" />
          </g>
        </svg>
        {/* Pending overlay */}
        {isPending && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,.55)",
            display: "grid", placeItems: "center",
            fontSize: 12, color: "var(--fg2)",
          }}>
            <span style={{
              padding: "5px 10px", background: "var(--bg2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-sm)",
            }}>No fix — device not yet activated</span>
          </div>
        )}
      </div>

      {/* Info tiles — small blocks to the right of the map */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <Tile label="City" value={coords.city} mono={false}
          sub="Reported by GPS" />
        <Tile label="Coordinates"
          value={<>{coords.lat.toFixed(4)},&nbsp;{coords.lng.toFixed(4)}</>} />
        <Tile label="Last reported" value={lastSeen || "—"} mono={false}
          sub={isPending ? "Awaiting first fix" : "From device agent"} />
        <Tile label="Address" value={address || "—"} mono={false} />
      </div>
    </div>
  );
}

// ─── SIM traffic card (Monitoring tab) ─────────────────────
// Shows a 30-day cumulative usage curve against the monthly cap,
// with breakdown by upload / download and an estimate of when the
// device will hit its cap at the current rate.
function SimTrafficCard({ data }) {
  const { capMb, usedMb, downloadMb, uploadMb, curve, daysToCap, carrier, billingResetsOn } = data;
  const [open, setOpen] = React.useState(false);
  const pct = Math.round((usedMb / capMb) * 100);
  const tone = pct >= 95 ? "danger" : pct >= 80 ? "warning" : "default";
  const fmtMb = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb} MB`;
  const barColor = tone === "danger" ? "var(--color-error-500)"
                 : tone === "warning" ? "var(--color-warning-500)"
                 : "var(--color-primary-500)";
  // Sparkline geometry
  const W = 100, H = 40;
  const max = Math.max(capMb, ...curve);
  const points = curve.map((v, i) => {
    const x = (i / (curve.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  // Cap line position
  const capY = H - (capMb / max) * H;

  return (
    <window.Card title="SIM data usage"
      hint={`Cellular usage on ${carrier} this billing cycle. Resets ${billingResetsOn}.`}
      action={
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <window.Pill tone={tone === "default" ? "info" : tone} dot size="sm">
            {pct}% of cap
          </window.Pill>
          <button type="button" onClick={() => setOpen(!open)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border-1)",
              borderRadius: 6, cursor: "pointer",
              fontSize: 12, color: "var(--fg2)", fontWeight: 500,
            }}>
            <window.Ico name={open ? "chevd" : "chevr"} size={12} />
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      }>
      {!open && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
        }}>
          <span>
            <span style={{ color: "var(--fg2)" }}>Used</span> ·{" "}
            <span className="mono" style={{
              color: tone === "danger" ? "var(--color-error-700)"
                  : tone === "warning" ? "var(--color-warning-700)"
                  : "var(--fg1)",
              fontWeight: 500,
            }}>{fmtMb(usedMb)}</span>
            <span style={{ color: "var(--fg3)" }}> / {fmtMb(capMb)}</span>
          </span>
          <span style={{ color: "var(--color-border-default)" }}>·</span>
          <span><span style={{ color: "var(--fg2)" }}>Download</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{fmtMb(downloadMb)}</span></span>
          <span style={{ color: "var(--color-border-default)" }}>·</span>
          <span><span style={{ color: "var(--fg2)" }}>Upload</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{fmtMb(uploadMb)}</span></span>
          <span style={{ color: "var(--color-border-default)" }}>·</span>
          <span>
            <span style={{ color: "var(--fg2)" }}>At current rate</span> ·{" "}
            {daysToCap >= 30
              ? <span style={{ color: "var(--color-success-700)" }}>won't reach cap</span>
              : daysToCap <= 0
                ? <span style={{ color: "var(--color-error-700)", fontWeight: 500 }}>cap reached</span>
                : <><span className="mono" style={{ color: "var(--fg1)", fontWeight: 500 }}>{daysToCap}d</span> <span>to cap</span></>}
          </span>
        </div>
      )}
      {open && (<>
      {/* Top row: 4 stats */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <div>
          <div className="overline" style={{ fontSize: 10 }}>Used</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 500,
              color: tone === "danger" ? "var(--color-error-700)"
                  : tone === "warning" ? "var(--color-warning-700)"
                  : "var(--fg1)" }}>{fmtMb(usedMb)}</span>
            <span style={{ fontSize: 11, color: "var(--fg3)" }}>of {fmtMb(capMb)}</span>
          </div>
        </div>
        <div>
          <div className="overline" style={{ fontSize: 10 }}>Download</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
            <window.Ico name="download" size={11} stroke={1.8} style={{ color: "var(--fg3)" }} />
            <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmtMb(downloadMb)}</span>
          </div>
        </div>
        <div>
          <div className="overline" style={{ fontSize: 10 }}>Upload</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
            <window.Ico name="upload" size={11} stroke={1.8} style={{ color: "var(--fg3)" }} />
            <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmtMb(uploadMb)}</span>
          </div>
        </div>
        <div>
          <div className="overline" style={{ fontSize: 10 }}>At current rate</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--fg1)" }}>
            {daysToCap >= 30
              ? <>Won't reach cap</>
              : daysToCap <= 0
                ? <span style={{ color: "var(--color-error-700)", fontWeight: 500 }}>Cap reached</span>
                : <><span className="mono" style={{ fontWeight: 500 }}>{daysToCap}d</span> to cap</>}
          </div>
        </div>
      </div>

      {/* Bar — overall progress to cap */}
      <div style={{ marginTop: 14 }}>
        <div style={{ height: 8, borderRadius: 999, background: "var(--color-bg-3)",
          overflow: "hidden", position: "relative" }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%",
            background: barColor, transition: "width .2s ease" }} />
        </div>
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between",
          fontSize: 10.5, color: "var(--fg3)" }}>
          <span>0</span>
          <span>50%</span>
          <span className="mono">{fmtMb(capMb)}</span>
        </div>
      </div>

      {/* Sparkline — 30-day cumulative curve */}
      <div style={{ marginTop: 16, paddingTop: 14,
        borderTop: "1px dashed var(--color-border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 6 }}>
          <span className="overline" style={{ fontSize: 10 }}>Last 30 days · cumulative</span>
          <span style={{ fontSize: 11, color: "var(--fg3)" }}>
            avg <span className="mono" style={{ color: "var(--fg2)" }}>{fmtMb(Math.round(usedMb / 30))}/day</span>
          </span>
        </div>
        <div style={{ position: "relative", height: 80,
          padding: "8px 0", background: "var(--bg2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block" }}>
            {/* Cap line (dashed red/orange) */}
            <line x1="0" x2={W} y1={capY} y2={capY}
              stroke={barColor} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
            {/* Area under curve */}
            <polygon points={`0,${H} ${points} ${W},${H}`}
              fill={barColor} opacity="0.15" />
            {/* Curve */}
            <polyline points={points} fill="none"
              stroke={barColor} strokeWidth="0.8"
              strokeLinejoin="round" strokeLinecap="round" />
            {/* End dot */}
            <circle cx={W} cy={H - (curve[curve.length - 1] / max) * H} r="1.5"
              fill={barColor} />
          </svg>
          {/* Cap label */}
          <div style={{ position: "absolute", right: 6, top: 2,
            fontSize: 9.5, fontFamily: "var(--font-mono)",
            color: barColor, fontWeight: 500 }}>
            Cap · {fmtMb(capMb)}
          </div>
        </div>
      </div>
      </>)}
    </window.Card>
  );
}

// ─── Telemetry primitives (used by the Monitoring tab) ─────
// StatTile: square-ish tile with overline label + big mono value + sub.
function StatTile({ label, value, sub, tone, mono = true, valueFont }) {
  const color = tone === "danger"  ? "var(--color-error-700)"
              : tone === "warning" ? "var(--color-warning-700)"
              : tone === "success" ? "var(--color-success-700)"
                                   : "var(--fg1)";
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      minWidth: 0,
    }}>
      <div className="overline" style={{ fontSize: 10 }}>{label}</div>
      <div style={{
        marginTop: 4,
        fontSize: valueFont != null ? valueFont : 16, fontWeight: 600,
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        letterSpacing: "-0.01em",
        color,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
      {sub && <div style={{
        marginTop: 2, fontSize: 11, color: "var(--fg3)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{sub}</div>}
    </div>
  );
}

// InterfaceRow: one row per network interface — icon + label + ON/OFF
// switch, with optional IP, signal strength and per-interface badges
// (SSID, link speed, carrier, security, etc).
function InterfaceRow({ label, icon, on, primary, ip, signalDbm, badges = [], onEdit }) {
  const sigLabel = signalDbm == null ? null
    : signalDbm > -55 ? "Excellent"
    : signalDbm > -65 ? "Good"
    : signalDbm > -75 ? "Fair"
                      : "Weak";
  const sigColor = signalDbm == null ? "var(--fg3)"
    : signalDbm > -65 ? "var(--color-success-700)"
    : signalDbm > -75 ? "var(--fg2)"
                      : "var(--color-warning-700)";
  return (
    <div style={{
      padding: "10px 12px",
      background: on
        ? (primary ? "var(--color-primary-50)" : "var(--bg2)")
        : "var(--bg2)",
      border: "1px solid",
      borderColor: primary && on
        ? "color-mix(in oklab, var(--color-primary-500) 25%, transparent)"
        : "var(--border-1)",
      borderRadius: "var(--radius-md)",
      display: "grid",
      gridTemplateColumns: onEdit
        ? "32px minmax(120px, 1fr) auto 32px"
        : "32px minmax(120px, 1fr) auto",
      gap: 12, alignItems: "center",
      opacity: on ? 1 : 0.7,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: "var(--radius-sm)",
        background: on ? (primary ? "var(--color-primary-100)" : "var(--bg3)") : "var(--bg3)",
        color: on ? (primary ? "var(--color-primary-700)" : "var(--fg2)") : "var(--fg3)",
        display: "grid", placeItems: "center",
        border: "1px solid", borderColor: "var(--border-1)",
      }}>
        <window.Ico name={icon} size={14} stroke={1.8} />
      </span>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)" }}>{label}</span>
          {primary && on && (
            <span style={{
              fontSize: 9.5, padding: "1px 6px", borderRadius: 3,
              background: "var(--color-primary-100)", color: "var(--color-primary-700)",
              fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.06em",
            }}>PRIMARY</span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            color: on ? "var(--color-success-700)" : "var(--fg3)",
          }}>{on ? "ON" : "OFF"}</span>
        </div>
        {on && badges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10,
            fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.4 }}>
            {badges.map((b, i) => (
              <span key={i}>
                <span style={{ color: "var(--fg3)" }}>{b.label} </span>
                <span className={b.mono ? "mono" : undefined}
                  style={{ fontWeight: 500, color: "var(--fg1)" }}>{b.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        {ip && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px",
            background: "var(--bg1)", border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-sm)",
          }}>
            <span className="overline" style={{ fontSize: 9, letterSpacing: "0.06em" }}>IP</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg1)" }}>{ip}</span>
          </span>
        )}
        {signalDbm != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11.5 }}>
            <SignalBars dbm={signalDbm} />
            <span className="mono" style={{ fontWeight: 500, color: sigColor }}>{signalDbm} dBm</span>
            <span style={{ color: "var(--fg3)" }}>· {sigLabel}</span>
          </span>
        )}
        {on && !ip && signalDbm == null && (
          <span style={{ fontSize: 11, color: "var(--fg3)" }}>—</span>
        )}
      </div>

      {onEdit && (
        <button type="button" onClick={onEdit}
          title={`Change · ${label}`}
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: "transparent", border: "1px solid var(--border-1)",
            cursor: "pointer", display: "grid", placeItems: "center",
            color: "var(--fg2)", flexShrink: 0,
          }}>
          <window.Ico name="edit" size={12} stroke={1.8} />
        </button>
      )}
    </div>
  );
}

// SwitchRow: overline label + value (or ON/OFF chip). Shape matches
// the StatTile so they sit next to each other cleanly.
function SwitchRow({ label, on, value, detail, mono, tone }) {
  const showSwitch = typeof on === "boolean";
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      minWidth: 0,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div className="overline" style={{ fontSize: 10 }}>{label}</div>
      {showSwitch ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: on ? "var(--success)" : "var(--border-2)",
            boxShadow: on ? "0 0 0 3px oklch(70% 0.16 152 / 0.16)" : "none",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600,
            color: on ? "var(--color-success-700)" : "var(--fg3)" }}>
            {on ? "ON" : "OFF"}
          </span>
          {detail && <span style={{ marginLeft: 4, fontSize: 12, color: "var(--fg2)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>}
        </div>
      ) : (
        <div style={{
          fontSize: 13, fontWeight: 500,
          color: tone === "warning" ? "var(--color-warning-700)" : "var(--fg1)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{value}</div>
      )}
    </div>
  );
}

// ModuleRow: icon + label on the left, ON/OFF pill on the right.
function ModuleRow({ label, icon, on }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: on ? "oklch(96% 0.025 152)" : "var(--bg2)",
      border: "1px solid",
      borderColor: on ? "color-mix(in oklab, var(--color-success-500) 18%, transparent)"
                      : "var(--border-1)",
      borderRadius: "var(--radius-md)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: "var(--radius-sm)",
        background: on ? "var(--color-success-50)" : "var(--bg3)",
        color: on ? "var(--color-success-700)" : "var(--fg3)",
        display: "grid", placeItems: "center",
        border: "1px solid",
        borderColor: on ? "color-mix(in oklab, var(--color-success-500) 25%, transparent)"
                        : "var(--border-1)",
        flexShrink: 0,
      }}>
        <window.Ico name={icon} size={14} stroke={1.8} />
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--fg1)" }}>{label}</span>
      <span style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em",
        padding: "3px 8px", borderRadius: 999,
        background: on ? "var(--color-success-50)" : "var(--bg3)",
        color: on ? "var(--color-success-700)" : "var(--fg3)",
        border: "1px solid",
        borderColor: on ? "color-mix(in oklab, var(--color-success-500) 25%, transparent)"
                        : "var(--border-2)",
      }}>{on ? "ENABLED" : "DISABLED"}</span>
    </div>
  );
}

// SignalBars: 4-bar Wi-Fi/cell signal indicator based on dBm.
function SignalBars({ dbm }) {
  const strength = dbm > -50 ? 4 : dbm > -60 ? 3 : dbm > -70 ? 2 : dbm > -80 ? 1 : 0;
  const color = strength >= 3 ? "var(--color-success-500)"
              : strength === 2 ? "var(--fg2)"
                               : "var(--color-warning-500)";
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 12 }}>
      {[3, 6, 9, 12].map((h, i) => (
        <span key={i} style={{
          width: 2.5, height: h, borderRadius: 1,
          background: i < strength ? color : "var(--border-2)",
        }} />
      ))}
    </span>
  );
}

// Slider: read-only mini progress bar with label + value.
function Slider({ label, value, max, unit }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--fg2)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--fg1)" }}>
          {value}{unit ? unit : <span style={{ color: "var(--fg3)", fontWeight: 400 }}>/{max}</span>}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%",
          background: "var(--color-primary-500)", transition: "width .2s ease" }} />
      </div>
    </div>
  );
}

// Compact KPI tile — matches MerchantDetailScreen's KpiTile style so the
// device detail blends with the rest of the app's KPI strips.
function KpiTile({ label, value, sub, tone, mono }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: "var(--radius-md)",
      background: "var(--bg2)", border: "1px solid var(--border-1)",
      minWidth: 0,
    }}>
      <div className="overline" style={{ fontSize: 10 }}>{label}</div>
      <div style={{
        marginTop: 4,
        fontSize: 17, fontWeight: 500,
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        letterSpacing: "-0.01em",
        color: tone === "success" ? "var(--color-success-700)"
            : tone === "danger"  ? "var(--color-error-700)"
            : tone === "warning" ? "var(--color-warning-700)"
            : "var(--fg1)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        display: "flex", alignItems: "baseline", gap: 4,
      }}>{value}</div>
      {sub && <div style={{
        marginTop: 2, fontSize: 11, color: "var(--fg3)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{sub}</div>}
    </div>
  );
}

// Tight key-value table — same shape used in MerchantDetailScreen's
// VarSheet panels (100px label · minmax(0,1fr) value, rowGap 6).
function KvTable({ rows }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "118px minmax(0, 1fr)",
      rowGap: 7, columnGap: 12,
      alignItems: "baseline",
    }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span className="overline" style={{
            fontSize: 9.5, paddingTop: 2, letterSpacing: "0.06em",
          }}>{k}</span>
          <span style={{
            fontSize: 13, color: "var(--color-text-primary)", minWidth: 0,
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
          }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Push-an-app picker (modal) ────────────────────────────
// Lists every app in the publisher's pool, filtered by search, with the
// device-model compatibility flag shown per-row. The operator picks an
// app + version + the install mode (normal / silent), and the dispatch
// is queued on the device. We don't actually mutate device.apps here —
// just simulate the workflow + post a toast.
function PushAppPicker({ open, device, onClose, onConfirm }) {
  const allApps = window.APPS || [];
  const installed = new Set((device.apps || []).map(a => a.id));
  const [q, setQ] = useStateD("");
  const [selectedId, setSelectedId] = useStateD(null);
  const [selectedVersionId, setSelectedVersionId] = useStateD(null);
  const [installMode, setInstallMode] = useStateD("normal"); // normal | silent

  // Reset state when reopening / closing.
  useEffectD(() => {
    if (!open) {
      setQ(""); setSelectedId(null); setSelectedVersionId(null); setInstallMode("normal");
    }
  }, [open]);

  const filtered = useMemoD(() => {
    const n = q.trim().toLowerCase();
    return allApps.filter(a => {
      if (!n) return true;
      return `${a.name} ${a.package || ""} ${a.category || ""}`.toLowerCase().includes(n);
    });
  }, [q, allApps]);

  const selectedApp = allApps.find(a => a.id === selectedId);
  const publishedVersions = useMemoD(() => {
    if (!selectedApp) return [];
    return (selectedApp.versions || []).filter(v => v.status === "published");
  }, [selectedApp]);
  const selectedVersion = publishedVersions.find(v => v.id === selectedVersionId)
                       || publishedVersions[0];
  const isCompatible = selectedApp && (selectedApp.devices || []).includes(device.model);
  const isAlreadyInstalled = selectedApp && installed.has(selectedApp.id);
  const canConfirm = !!(selectedApp && selectedVersion && isCompatible);

  return (
    <window.Modal open={open} onClose={onClose} width={680}
      padding={0}
      title={<>Push an app to <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{device.sn}</span></>}
      subtitle="Pick an app from your pool. The install will be queued on this device only — not the whole fleet."
      footer={
        <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {selectedApp ? (
              isCompatible
                ? <>Will queue <b style={{ color: "var(--fg1)" }}>{selectedApp.name}</b> <span className="mono">{selectedVersion?.name}</span></>
                : <span style={{ color: "var(--color-error-700)" }}>Selected app is not compatible with <span className="mono">{device.model}</span></span>
            ) : "Pick an app to continue"}
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="download" disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm({ app: selectedApp, version: selectedVersion, mode: installMode });
            }}>
            Push to device
          </window.Button>
        </>
      }>
      {/* Search */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-1)",
        background: "var(--bg3)",
      }}>
        <window.Input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, package, or category…"
          prefix={<window.Ico name="search" size={13} />}
          suffix={q && (
            <button type="button" onClick={() => setQ("")}
              style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer",
                color: "var(--fg3)", display: "inline-flex", alignItems: "center" }}>
              <window.Ico name="x" size={12} />
            </button>
          )} />
      </div>
      {/* List */}
      <div style={{ maxHeight: 320, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center",
            fontSize: 12.5, color: "var(--fg3)" }}>
            No apps match "{q}".
          </div>
        ) : filtered.map(app => {
          const compat = (app.devices || []).includes(device.model);
          const latest = (app.versions || []).find(v => v.status === "published");
          const selected = selectedId === app.id;
          const already = installed.has(app.id);
          return (
            <button type="button" key={app.id}
              onClick={() => { setSelectedId(app.id); setSelectedVersionId(latest?.id || null); }}
              style={{
                width: "100%", textAlign: "left",
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto",
                gap: 12, alignItems: "center",
                padding: "10px 16px",
                background: selected ? "var(--color-primary-50)" : "transparent",
                border: "none",
                borderBottom: "1px solid var(--border-1)",
                cursor: "pointer", minWidth: 0,
              }}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--bg3)"; }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}>
              <window.AppIcon app={app} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {app.name}
                  </span>
                  {already && (
                    <span style={{
                      fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                      background: "var(--bg3)", color: "var(--fg3)",
                      fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}>INSTALLED</span>
                  )}
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: "var(--fg3)",
                  display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>{app.category}</span>
                  {latest && <>
                    <span>·</span>
                    <span className="mono">{latest.name}</span>
                  </>}
                </div>
              </div>
              {compat
                ? <window.Pill tone="success" dot size="sm">Compatible</window.Pill>
                : <window.Pill tone="warning" dot size="sm">Not for {device.model}</window.Pill>}
            </button>
          );
        })}
      </div>
      {/* Footer: version + mode (only when an app is selected) */}
      {selectedApp && (
        <div style={{
          padding: "14px 16px",
          borderTop: "1px solid var(--border-1)",
          background: "var(--bg2)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
        }}>
          <div>
            <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Version to push</div>
            <select value={selectedVersion?.id || ""}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              disabled={!isCompatible || publishedVersions.length === 0}
              style={{
                width: "100%", padding: "7px 10px",
                fontSize: 12.5, fontFamily: "var(--font-mono)",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg1)", color: "var(--fg1)",
                cursor: isCompatible ? "pointer" : "not-allowed",
              }}>
              {publishedVersions.length === 0
                ? <option>No published versions</option>
                : publishedVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.size || "—"} · {v.publishedAt || "—"}
                    </option>))}
            </select>
            {selectedVersion?.notes && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg3)", lineHeight: 1.5,
                display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                overflow: "hidden" }}>{selectedVersion.notes}</div>
            )}
          </div>
          <div>
            <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Install mode</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "normal", label: "Normal", hint: "Cashier confirms" },
                { id: "silent", label: "Silent", hint: "Install when idle" },
              ].map(opt => {
                const on = installMode === opt.id;
                return (
                  <button type="button" key={opt.id}
                    onClick={() => setInstallMode(opt.id)}
                    style={{
                      flex: 1, padding: "7px 9px", textAlign: "left",
                      background: on ? "var(--color-primary-50)" : "var(--bg1)",
                      border: "1px solid",
                      borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer", color: on ? "var(--color-primary-700)" : "var(--fg1)",
                      display: "flex", flexDirection: "column", gap: 1,
                    }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{opt.label}</span>
                    <span style={{ fontSize: 10.5, color: on ? "var(--color-primary-700)" : "var(--fg3)" }}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {isAlreadyInstalled && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-warning-700)",
                display: "inline-flex", alignItems: "center", gap: 4 }}>
                <window.Ico name="info" size={11} />
                Already installed — push will overwrite.
              </div>
            )}
          </div>
        </div>
      )}
    </window.Modal>
  );
}

// ─── Tab 2: Apps & Firmware ───────────────────────────────
function DeviceAppsTab({ device, delta, firmware }) {
  const pushHistory = useMemoD(() => pushHistoryFor(device), [device]);
  // Confirmation modal — opens when the operator clicks any Push button.
  // The shape is { kind: 'firmware'|'install'|'update', title, body, toast }.
  const [pushConfirm, setPushConfirm] = useStateD(null);
  // Ad-hoc app picker — pushes a single app from the pool to this device.
  const [pushPickerOpen, setPushPickerOpen] = useStateD(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Firmware status card */}
      <window.Card title="Firmware"
        action={firmware?.behind && (
          <window.Button primary size="sm" icon="upload"
            onClick={() => setPushConfirm({
              kind: "firmware",
              title: <>Push firmware update?</>,
              body: <>
                The device will download <b className="mono">{firmware.target.version}</b> on next check-in and reboot
                to install. Active transactions will be drained first.
                {firmware.target.notes && (
                  <div style={{
                    marginTop: 10, padding: "8px 10px",
                    background: "var(--bg2)", border: "1px solid var(--border-1)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12, color: "var(--fg2)", lineHeight: 1.5,
                  }}><b style={{ color: "var(--fg1)" }}>Release notes:</b> {firmware.target.notes}</div>
                )}
              </>,
              confirmLabel: "Queue firmware push",
              toast: `Firmware push queued · ${firmware.target.version}`,
            })}>
            Push update
          </window.Button>
        )}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 32px 1fr", alignItems: "center", gap: 8,
        }}>
          {/* Current */}
          <div style={{
            padding: "12px 14px",
            background: firmware?.behind ? "var(--bg2)" : "oklch(96% 0.03 152)",
            border: "1px solid",
            borderColor: firmware?.behind ? "var(--border-2)"
                                          : "color-mix(in oklab, var(--color-success-500) 28%, transparent)",
            borderRadius: "var(--radius-md)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 4 }}>Current</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600,
              color: firmware?.behind ? "var(--fg1)" : "var(--color-success-700)" }}>
              {device.firmware}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--fg3)", marginTop: 4 }}>
              Build {device.buildNumber}
            </div>
          </div>
          <div style={{ display: "grid", placeItems: "center" }}>
            <window.Ico name="arrowR" size={18} style={{ color: firmware?.behind ? "var(--warning)" : "var(--fg3)" }} />
          </div>
          {/* Target */}
          <div style={{
            padding: "12px 14px",
            background: firmware?.behind ? "var(--warning-bg)" : "var(--bg2)",
            border: "1px solid",
            borderColor: firmware?.behind ? "color-mix(in oklab, var(--color-warning-500) 28%, transparent)"
                                          : "var(--border-2)",
            borderRadius: "var(--radius-md)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 4,
              color: firmware?.behind ? "var(--color-warning-700)" : undefined }}>
              {firmware?.behind ? "Update available" : "Latest"}
            </div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600,
              color: firmware?.behind ? "var(--color-warning-700)" : "var(--fg2)" }}>
              {firmware?.target.version || "—"}
            </div>
            <div style={{ fontSize: 11, color: firmware?.behind ? "var(--color-warning-700)" : "var(--fg3)", marginTop: 4 }}>
              Released <span className="mono">{firmware?.target.releasedAt}</span>
              {firmware?.behind && firmware.behindBy > 0 && (
                <> · <b>{firmware.behindBy}</b> build{firmware.behindBy === 1 ? "" : "s"} behind</>
              )}
            </div>
          </div>
        </div>
        {firmware?.target.notes && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--fg3)", lineHeight: 1.55 }}>
            <b style={{ color: "var(--fg2)" }}>Release notes:</b> {firmware.target.notes}
          </div>
        )}
      </window.Card>

      {/* Apps coverage KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Required",  value: delta.required.length, sub: "in fleet template" },
          { label: "Installed", value: device.apps.length,    sub: "currently on device", tone: "success" },
          { label: "Missing",   value: delta.missing.length,  sub: "to be pushed",       tone: delta.missing.length > 0 ? "warning" : null },
          { label: "Outdated",  value: delta.outdated.length, sub: "below required version", tone: delta.outdated.length > 0 ? "warning" : null },
        ].map(k => (
          <div key={k.label} style={{
            padding: "12px 14px", borderRadius: "var(--radius-md)",
            background: "var(--bg2)", border: "1px solid var(--border-1)",
          }}>
            <div className="overline" style={{ fontSize: 10.5 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span className="mono num" style={{
                fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em",
                color: k.tone === "success" ? "var(--success)"
                    : k.tone === "warning" ? "var(--warning)"
                    : "var(--fg1)",
              }}>{k.value}</span>
              <span style={{ fontSize: 11, color: "var(--fg3)" }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Missing apps */}
      {delta.missing.length > 0 && (
        <window.Card title={`Missing apps · ${delta.missing.length}`}
          hint="These apps are required by the fleet template but haven't been installed on this device yet."
          action={
            <window.Button primary size="sm" icon="download"
              onClick={() => setPushConfirm({
                kind: "install",
                title: <>Install <span className="mono">{delta.missing.length}</span> missing app{delta.missing.length === 1 ? "" : "s"}?</>,
                body: <>
                  The following app{delta.missing.length === 1 ? "" : "s"} will be queued for install on this device:
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--fg2)", lineHeight: 1.6 }}>
                    {delta.missing.map(a => <li key={a.id}><b style={{ color: "var(--fg1)" }}>{a.name}</b> <span className="mono" style={{ color: "var(--fg3)" }}>{a.version}</span></li>)}
                  </ul>
                </>,
                confirmLabel: `Queue ${delta.missing.length} install${delta.missing.length === 1 ? "" : "s"}`,
                toast: `Push install queued · ${delta.missing.length} app${delta.missing.length === 1 ? "" : "s"}`,
              })}>
              Push install
            </window.Button>
          }>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {delta.missing.map(a => (
              <li key={a.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: "var(--warning-bg)",
                border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
                borderLeft: "3px solid var(--color-warning-500)",
                borderRadius: "var(--radius-md)",
              }}>
                <AppLogo seed={a.id} name={a.name} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--color-warning-700)" }}>{a.version}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-warning-700)" }}>Not installed</span>
              </li>
            ))}
          </ul>
        </window.Card>
      )}

      {/* Outdated apps */}
      {delta.outdated.length > 0 && (
        <window.Card title={`Outdated apps · ${delta.outdated.length}`}
          hint="These apps are installed but on an older version than the fleet template requires."
          action={
            <window.Button primary size="sm" icon="upload"
              onClick={() => setPushConfirm({
                kind: "update",
                title: <>Update <span className="mono">{delta.outdated.length}</span> outdated app{delta.outdated.length === 1 ? "" : "s"}?</>,
                body: <>
                  These apps will be updated on next check-in. Cashiers will see a one-tap update prompt unless silent-update is enabled for the fleet.
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--fg2)", lineHeight: 1.6 }}>
                    {delta.outdated.map(a => (
                      <li key={a.id}>
                        <b style={{ color: "var(--fg1)" }}>{a.name}</b>{" "}
                        <span className="mono" style={{ color: "var(--fg3)" }}>{a.installedVersion}</span>
                        {" → "}
                        <span className="mono" style={{ color: "var(--color-warning-700)", fontWeight: 500 }}>{a.version}</span>
                      </li>
                    ))}
                  </ul>
                </>,
                confirmLabel: `Queue ${delta.outdated.length} update${delta.outdated.length === 1 ? "" : "s"}`,
                toast: `Push update queued · ${delta.outdated.length} app${delta.outdated.length === 1 ? "" : "s"}`,
              })}>
              Push update
            </window.Button>
          }>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {delta.outdated.map(a => (
              <li key={a.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--radius-md)",
              }}>
                <AppLogo seed={a.id} name={a.name} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>installed</span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{a.installedVersion}</span>
                <window.Ico name="arrowR" size={11} style={{ color: "var(--fg3)" }} />
                <span className="mono" style={{ fontSize: 11.5, color: "var(--color-warning-700)", fontWeight: 500 }}>{a.version}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-warning-700)" }}>Needs update</span>
              </li>
            ))}
          </ul>
        </window.Card>
      )}

      {/* All installed apps */}
      <window.Card title={`Installed apps · ${device.apps.length}`}
        hint="Apps currently provisioned on this device. System apps come bundled in the TOMS firmware."
        action={
          <window.Button size="sm" ghost icon="download"
            onClick={() => setPushPickerOpen(true)}>
            Push an app…
          </window.Button>
        }>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["App", "Version", "Installed", "Source"].map((h, i) => (
                  <th key={i} style={{
                    padding: "8px 12px", fontSize: 11, fontWeight: 500,
                    color: "var(--fg3)", textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background: "var(--bg3)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {device.apps.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: i < device.apps.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <AppLogo seed={a.id} name={a.name} system={a.system} />
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className="mono" style={{ fontSize: 12 }}>{a.version}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--fg2)" }}>
                    <span className="mono">{a.installedAt}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.system
                      ? <span style={{
                          fontSize: 9.5, padding: "1px 6px", borderRadius: 3,
                          background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                          fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.04em",
                        }}>SYSTEM</span>
                      : <span style={{ fontSize: 11, color: "var(--fg3)" }}>App pool</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </window.Card>

      {/* Push history */}
      <window.Card title={`Push history · ${pushHistory.length}`}
        hint="Every install / update / firmware command issued to this device, with the outcome.">
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Kind", "Target", "Queued", "Status", "Completed", "By"].map((h, i) => (
                  <th key={i} style={{
                    padding: "8px 12px", fontSize: 11, fontWeight: 500,
                    color: "var(--fg3)", textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background: "var(--bg3)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pushHistory.map((h, i) => {
                const statusMeta = h.status === "completed" ? { tone: "success", label: "Completed" }
                                : h.status === "pending"   ? { tone: "info",    label: "Pending" }
                                : h.status === "failed"    ? { tone: "danger",  label: "Failed"  }
                                : { tone: "neutral", label: h.status };
                const kindIcon = h.kind === "firmware"       ? "package"
                              : h.kind === "app-install"     ? "download"
                              : h.kind === "app-update"      ? "upload"
                              : h.kind === "app-uninstall"   ? "trash"
                                                             : "doc";
                return (
                  <tr key={i} style={{ borderBottom: i < pushHistory.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 11.5, color: "var(--fg2)", textTransform: "capitalize" }}>
                        <window.Ico name={kindIcon} size={11} stroke={1.8} />
                        {h.kind.replace("-", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="mono" style={{ fontSize: 12 }}>{h.target}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--fg2)" }}>
                      <span className="mono">{h.queuedAt}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <window.Pill tone={statusMeta.tone} dot size="sm">{statusMeta.label}</window.Pill>
                      {h.error && (
                        <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--color-error-700)" }}>{h.error}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--fg2)" }}>
                      <span className="mono">{h.completedAt || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--fg2)" }}>{h.by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </window.Card>

      {/* Push confirmation dialog — opens when any Push button is clicked.
          Uses the project-wide ConfirmDialog so the action feels real:
          modal overlay + scoped body + primary confirm button. */}
      <window.ConfirmDialog
        open={!!pushConfirm}
        onClose={() => setPushConfirm(null)}
        title={pushConfirm?.title}
        body={pushConfirm?.body}
        icon={pushConfirm?.kind === "firmware" ? "package"
            : pushConfirm?.kind === "install" ? "download"
            : "upload"}
        confirmLabel={pushConfirm?.confirmLabel || "Confirm"}
        tone="primary"
        onConfirm={() => {
          if (pushConfirm?.toast) window.showToast?.(pushConfirm.toast, "success");
          setPushConfirm(null);
        }} />

      {/* Push an app picker — full-blown selector with search + version + mode */}
      <PushAppPicker
        open={pushPickerOpen}
        device={device}
        onClose={() => setPushPickerOpen(false)}
        onConfirm={({ app, version, mode }) => {
          setPushPickerOpen(false);
          window.showToast?.(
            `Push queued · ${app.name} ${version.name} · ${mode === "silent" ? "silent install" : "normal install"}`,
            "success");
        }} />
    </div>
  );
}

// ─── Tab 3: Monitoring ─────────────────────────────────────
// Two layouts available; switch via Tweaks → Monitoring tab → Layout.
//   • "current"  — original ordering (kept for comparison)
//   • "proposed" — re-ordered for ticket-handler workflow:
//       Health strip → Security modules + System state → SIM →
//       Security & uptime detail → Network → System settings →
//       Location → Event log → Memory probe.
//     Also: inline "Change…" affordance on Security modules and
//     System state rows, batched into a Pending changes pill.
function DeviceMonitoringTab(props) {
  const [layout, setLayout] = useStateD(() => window.__monitoringLayout || "proposed");
  useEffectD(() => {
    const h = (e) => setLayout(e.detail || "proposed");
    window.addEventListener("monitoring-layout:change", h);
    return () => window.removeEventListener("monitoring-layout:change", h);
  }, []);
  return layout === "current"
    ? <DeviceMonitoringTabCurrent {...props} />
    : <DeviceMonitoringTabProposed {...props} />;
}

// ─── Original ordering (kept for side-by-side comparison) ──
function DeviceMonitoringTabCurrent({ device }) {
  const runtime = useMemoD(() => runtimeFor(device), [device]);
  const events  = useMemoD(() => eventsFor(device),  [device]);
  const simTraffic = useMemoD(() => simTrafficFor(device), [device]);
  const t       = useMemoD(() => deviceTelemetryFor(device), [device]);

  // Memory probe: requires the device to be online. The "Fetch" button
  // simulates a request with a brief loading state, then reveals the
  // process list. Cached in memory so flipping tabs doesn't lose it.
  const [memState, setMemState] = useStateD("idle"); // idle | loading | done | error
  const [memData, setMemData] = useStateD(null);
  const fetchMemory = () => {
    if (!runtime.isOnline) {
      setMemState("error");
      return;
    }
    setMemState("loading");
    setTimeout(() => {
      setMemData(liveMemoryFor(device));
      setMemState("done");
    }, 900);
  };

  // Expand-once switch for the long APN config block — most operators
  // don't need it, so it's collapsed by default.
  const [apnOpen, setApnOpen] = useStateD(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Unified collection banner — every card below reflects this
          single sample timestamp from the device agent. */}
      <div style={{
        padding: "10px 14px",
        background: t.collectedAt.stale ? "var(--warning-bg)" : "var(--bg2)",
        border: "1px solid",
        borderColor: t.collectedAt.stale
          ? "color-mix(in oklab, var(--color-warning-500) 25%, transparent)"
          : "var(--border-1)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%",
          background: t.collectedAt.stale ? "color-mix(in oklab, var(--color-warning-500) 18%, transparent)"
                                          : "var(--color-primary-50)",
          color:      t.collectedAt.stale ? "var(--color-warning-700)"
                                          : "var(--color-primary-700)",
          display: "grid", placeItems: "center",
          flexShrink: 0,
        }}>
          <window.Ico name="clock" size={13} stroke={2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: "var(--fg2)", display: "flex",
            alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500, color: "var(--fg1)" }}>Last collected</span>
            <span className="mono" style={{ color: t.collectedAt.stale ? "var(--color-warning-700)" : "var(--fg1)", fontWeight: 500 }}>
              {t.collectedAt.pretty}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>· {t.collectedAt.relative}</span>
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: "var(--fg3)", lineHeight: 1.5 }}>
            All telemetry below — security, network, location, system settings — was sampled in this snapshot.
            {t.collectedAt.stale && <span style={{ color: "var(--color-warning-700)", marginLeft: 4 }}>Data is stale; device hasn't checked in recently.</span>}
          </div>
        </div>
        {!window.__DEVICES_READONLY && (
          <window.Button size="sm" ghost icon="refresh"
            onClick={() => window.showToast?.("Telemetry refresh queued — will arrive on next check-in", "info")}>
            Re-collect
          </window.Button>
        )}
      </div>

      {/* Security triggers & uptime — top of fold. The security trigger
          status is the most operationally important line on the page. */}
      <window.Card title="Security & uptime"
        hint={t.security.status === 1
          ? "Tamper detection has fired — review reasons below."
          : "Tamper detection clear · uptime statistics reported by the agent."}>
        {/* Trigger banner */}
        <div style={{
          padding: "10px 14px",
          background: t.security.status === 1 ? "var(--warning-bg)" : "oklch(96% 0.03 152)",
          border: "1px solid",
          borderColor: t.security.status === 1
            ? "color-mix(in oklab, var(--color-warning-500) 28%, transparent)"
            : "color-mix(in oklab, var(--color-success-500) 22%, transparent)",
          borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <window.Ico name={t.security.status === 1 ? "alert" : "check"} size={16}
            stroke={2} style={{ flexShrink: 0, marginTop: 1,
              color: t.security.status === 1 ? "var(--color-warning-700)" : "var(--color-success-700)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600,
              color: t.security.status === 1 ? "var(--color-warning-700)" : "var(--color-success-700)",
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {t.security.status === 1 ? <>Safe trigger fired</> : <>No active triggers</>}
              <span className="mono" style={{ fontSize: 11, fontWeight: 400,
                color: "var(--fg3)" }}>status={t.security.status}</span>
            </div>
            {t.security.status === 1 && t.security.reasons.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {t.security.reasons.map(r => (
                  <span key={r} className="mono" style={{
                    fontSize: 11, padding: "2px 7px", borderRadius: 4,
                    background: "var(--bg2)", color: "var(--color-warning-700)",
                    border: "1px solid color-mix(in oklab, var(--color-warning-500) 30%, transparent)",
                    fontWeight: 500, letterSpacing: "0.02em",
                  }}>{r}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Attack counters + root */}
        <div style={{ marginTop: 14, display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <StatTile label="Hardware attacks"
            value={t.security.hwAttackCount}
            sub="cumulative"
            tone={t.security.hwAttackCount > 10 ? "warning" : null} />
          <StatTile label="Software attacks"
            value={t.security.swAttackCount}
            sub="cumulative"
            tone={t.security.swAttackCount > 5 ? "warning" : null} />
          <StatTile label="Root state"
            value={t.security.rooted ? "Rooted" : "Not rooted"}
            sub={t.security.rooted ? "Device compromised" : "Integrity intact"}
            tone={t.security.rooted ? "danger" : "success"}
            mono={false} />
        </div>

        {/* Uptime tiles */}
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px dashed var(--color-border-subtle)",
          display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12,
        }}>
          <StatTile label="Session uptime"
            value={fmtDuration(t.uptime.sessionSec)}
            sub="since last boot" />
          <StatTile label="Today"
            value={fmtDuration(t.uptime.todaySec)}
            sub="00:00 → now" />
          <StatTile label="Cumulative"
            value={fmtDuration(t.uptime.cumulativeSec)}
            sub="lifetime runtime" />
          <StatTile label="Last boot"
            value={t.uptime.bootDate || "—"}
            sub={t.uptime.bootEpoch ? `epoch ${t.uptime.bootEpoch}` : "Pending activation"}
            mono={false}
            valueFont={11.5} />
        </div>
      </window.Card>

      {/* Network & connectivity — one row per interface with its own IP
          + signal strength (for wireless). The "Type" pill at the top
          identifies which interface is currently primary. */}
      <window.Card title="Network & connectivity"
        hint="Active interfaces, IPs & signal strength as reported by the OS."
        action={
          <window.Pill tone={t.network.type === "Offline" ? "warning" : "info"} dot size="sm">
            Primary · {t.network.type}
          </window.Pill>
        }>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <InterfaceRow
            label="Wi-Fi"
            icon="link"
            on={t.network.wifi.on}
            primary={t.network.type === "WIFI"}
            ip={t.network.wifi.ip}
            signalDbm={t.network.wifi.signalDbm}
            badges={t.network.wifi.on ? [
              t.network.wifi.ssid && { label: "SSID", value: t.network.wifi.ssid, mono: true },
              t.network.wifi.linkMbps && { label: "Link", value: `${t.network.wifi.linkMbps} Mbps` },
              t.network.wifi.security && { label: "Security", value: t.network.wifi.security },
            ].filter(Boolean) : []} />
          <InterfaceRow
            label="Mobile data"
            icon="bolt"
            on={t.network.cellular.on}
            primary={t.network.type === "Cellular"}
            ip={t.network.cellular.ip}
            signalDbm={t.network.cellular.signalDbm}
            badges={t.network.cellular.on ? [
              t.network.cellular.carrier && { label: "Carrier", value: t.network.cellular.carrier },
              t.network.cellular.network && { label: "Network", value: t.network.cellular.network },
              t.network.defaultApn && { label: "APN", value: t.network.defaultApn, mono: true },
            ].filter(Boolean) : []} />
          <InterfaceRow
            label="Ethernet"
            icon="box"
            on={t.network.ethernet.on}
            primary={t.network.type === "Ethernet"}
            ip={t.network.ethernet.ip}
            badges={t.network.ethernet.on ? [
              t.network.ethernet.linkMbps && { label: "Link", value: `${t.network.ethernet.linkMbps} Mbps ${t.network.ethernet.duplex}-duplex` },
            ].filter(Boolean) : []} />
          <InterfaceRow
            label="Bluetooth"
            icon="link"
            on={t.network.bluetooth.on}
            badges={[]} />
        </div>

        {/* Collapsible APN config */}
        {t.network.apnConfig && (
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <button type="button" onClick={() => setApnOpen(!apnOpen)}
              style={{
                background: "transparent", border: 0, padding: 0, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "var(--fg2)", fontWeight: 500,
              }}>
              <window.Ico name={apnOpen ? "chevd" : "chevr"} size={12} />
              Full APN configuration
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--fg3)", fontWeight: 400 }}>
                · {Object.keys(t.network.apnConfig).filter(k => t.network.apnConfig[k] !== "").length} fields set
              </span>
            </button>
            {apnOpen && (
              <div style={{
                marginTop: 10, padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--radius-md)",
                display: "grid",
                gridTemplateColumns: "120px minmax(0, 1fr)",
                rowGap: 6, columnGap: 12,
              }}>
                {Object.entries(t.network.apnConfig).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="overline" style={{ fontSize: 9.5, paddingTop: 1 }}>{k}</span>
                    <span className="mono" style={{ fontSize: 12, color: v ? "var(--fg1)" : "var(--fg3)" }}>
                      {v || "—"}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </window.Card>

      {/* Location telemetry */}
      <window.Card title="Location telemetry"
        hint="GPS fix status, nearby cell towers & Wi-Fi access points.">
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <SwitchRow label="Location (GPS)" on={t.location.gpsOn} />
          <SwitchRow label="Assist provider" value={t.location.provider} />
          <SwitchRow label="Coordinates"
            value={`${t.location.coords.lat.toFixed(4)}, ${t.location.coords.lng.toFixed(4)}`}
            mono />
        </div>

        {/* Daily location stats */}
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px dashed var(--color-border-subtle)",
        }}>
          <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>Fix success — last 2 days</div>
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Date", "SDK", "Success", "Failed", "Rate"].map((h, i) => (
                    <th key={i} style={{
                      padding: "6px 12px", fontSize: 10.5, fontWeight: 500,
                      color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--color-border-subtle)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[t.location.today, t.location.yesterday].map((d, i) => {
                  const total = d.successCount + d.failCount;
                  const rate = total > 0 ? Math.round((d.successCount / total) * 100) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: i === 0 ? "1px solid var(--color-border-subtle)" : "none" }}>
                      <td style={{ padding: "8px 12px" }}><span className="mono">{d.date}</span></td>
                      <td style={{ padding: "8px 12px" }}>{d.sdk}</td>
                      <td style={{ padding: "8px 12px" }}><span className="mono" style={{ color: "var(--color-success-700)" }}>{d.successCount}</span></td>
                      <td style={{ padding: "8px 12px" }}><span className="mono" style={{ color: "var(--color-error-700)" }}>{d.failCount}</span></td>
                      <td style={{ padding: "8px 12px" }}>
                        <span className="mono" style={{ color: rate >= 80 ? "var(--color-success-700)" : "var(--color-warning-700)" }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nearby Wi-Fi & cell towers — two columns */}
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px dashed var(--color-border-subtle)",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14,
        }}>
          <div>
            <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
              Cell towers · <span className="mono num">{t.location.cellTowers.length}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none",
              display: "flex", flexDirection: "column", gap: 4 }}>
              {t.location.cellTowers.map((c, i) => (
                <li key={i} style={{ display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: "5px 8px",
                  background: "var(--bg2)", border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11.5, color: "var(--fg2)",
                }}>
                  <span><span style={{ color: "var(--fg3)" }}>cid </span><span className="mono">{c.cid}</span></span>
                  <span><span style={{ color: "var(--fg3)" }}>lac </span><span className="mono">{c.lac}</span></span>
                  <span><span style={{ color: "var(--fg3)" }}>mcc </span><span className="mono">{c.mcc}</span></span>
                  <span><span style={{ color: "var(--fg3)" }}>mnc </span><span className="mono">{c.mnc}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
              Nearby Wi-Fi · <span className="mono num">{t.location.nearbyWifi.length}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none",
              display: "flex", flexDirection: "column", gap: 4 }}>
              {t.location.nearbyWifi.map((w, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "5px 8px",
                  background: "var(--bg2)", border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11.5, color: "var(--fg2)",
                }}>
                  <span className="mono" style={{ flex: 1, color: "var(--fg1)" }}>{w.mac}</span>
                  <SignalBars dbm={w.level} />
                  <span className="mono" style={{ width: 48, textAlign: "right",
                    color: w.level > -50 ? "var(--color-success-700)"
                         : w.level > -70 ? "var(--fg2)"
                                         : "var(--color-warning-700)" }}>
                    {w.level} dBm
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Saved networks */}
        {t.location.savedWifi.length > 0 && (
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
              Previously connected · <span className="mono num">{t.location.savedWifi.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {t.location.savedWifi.map((w, i) => (
                <span key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 999,
                  background: "var(--bg3)", border: "1px solid var(--border-1)",
                  fontSize: 11.5, color: "var(--fg1)",
                }}>
                  <window.Ico name="link" size={10} stroke={1.8} style={{ color: "var(--fg3)" }} />
                  {w.ssid}
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{w.level} dBm</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </window.Card>

      {/* SIM traffic — only meaningful for devices with a cellular plan */}
      {simTraffic && <SimTrafficCard data={simTraffic} />}

      {/* System settings */}
      <window.Card title="System settings"
        hint="Locale, display & audio preferences reported by the OS.">
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <KvTable rows={[
            ["Language",     <span className="mono" style={{ fontSize: 13 }}>{t.settings.language}</span>],
            ["Timezone",     <span className="mono" style={{ fontSize: 13 }}>{t.settings.timezone}</span>],
            ["Input method", <span className="mono" style={{ fontSize: 12 }}>{t.settings.inputMethod}</span>],
            ["Screen timeout",
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
                <span className="mono">{(t.settings.screenTimeoutMs / 1000).toFixed(0)}</span>
                <span style={{ fontSize: 11, color: "var(--fg3)" }}>seconds ({t.settings.screenTimeoutMs}ms)</span>
              </span>],
          ]} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Slider label="Screen brightness" value={t.settings.brightness} max={100} unit="%" />
            <Slider label="Sub-screen brightness" value={t.settings.subBrightness} max={100} unit="%" />
            <Slider label="Media volume" value={t.settings.mediaVolume} max={t.settings.mediaVolumeMax} />
            <Slider label="Ring volume"  value={t.settings.ringVolume}  max={t.settings.ringVolumeMax} />
          </div>
        </div>
      </window.Card>

      {/* Security module switches + system state */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <window.Card title="Security module switches"
          hint="Card-acceptance paths enabled on this terminal.">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ModuleRow label="Magstripe" icon="link" on={t.modules.magstripe} />
            <ModuleRow label="Insert (chip)" icon="box" on={t.modules.insertCard} />
            <ModuleRow label="Contactless" icon="bolt" on={t.modules.contactless} />
            <ModuleRow label="Printer" icon="package" on={t.modules.printer} />
          </div>
        </window.Card>

        <window.Card title="System state"
          hint="Non-standard flags surfaced by the TOMS agent.">
          <KvTable rows={[
            ["Terminal lock",     <Flag positive={!t.state.terminalLocked}
                                    positiveLabel="Unlocked"
                                    negativeLabel="Locked (admin only)"
                                    tone="warning" />],
            ["Status bar pull",   <Flag positive={t.state.statusBarPulldown}
                                    positiveLabel="Enabled"
                                    negativeLabel="Disabled — locked-down" />],
            ["Unattended mode",   <Flag positive={!t.state.unattendedMode}
                                    positiveLabel="Off (attended)"
                                    negativeLabel="On — kiosk-style" />],
            ["Dev unit",          <Flag positive={t.state.devUnit === 0}
                                    positiveLabel="User unit (0)"
                                    negativeLabel="Dev unit (1)"
                                    tone="warning" />],
          ]} />
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
              System parameters
            </div>
            <div style={{
              padding: "8px 10px",
              background: "var(--bg2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
              rowGap: 5, columnGap: 12,
            }}>
              {Object.entries(t.state.sysParams).map(([k, v]) => (
                <React.Fragment key={k}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--fg1)", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </window.Card>
      </div>

      {/* Memory probe — removed per teammate feedback (was here)
      <window.Card title="Live memory probe"
        hint="Requests the device's current per-process memory. The device must be online; the data is fetched on demand."
        action={
          <window.Button size="sm" primary icon="refresh"
            disabled={memState === "loading"}
            onClick={fetchMemory}>
            {memState === "done" ? "Re-fetch" : memState === "loading" ? "Fetching…" : "Fetch live memory"}
          </window.Button>
        }>
        {memState === "idle" && (
          <div style={{
            padding: "20px 14px", textAlign: "center",
            background: "var(--bg2)",
            border: "1px dashed var(--color-border-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--fg3)",
          }}>
            Press <b>Fetch live memory</b> to request a snapshot from this device.
          </div>
        )}
        {memState === "loading" && (
          <div style={{
            padding: "20px 14px", textAlign: "center",
            background: "var(--bg2)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--fg2)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Spinner size={14} /> Asking the device…
          </div>
        )}
        {memState === "error" && (
          <div style={{
            padding: "12px 14px",
            background: "var(--error-bg)",
            border: "1px solid color-mix(in oklab, var(--color-error-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--color-error-700)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <window.Ico name="alert" size={14} />
            Device is offline — live memory can't be probed right now. Try again after the device checks in.
          </div>
        )}
        {memState === "done" && memData && (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Process", "PID", "Memory"].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 12px", fontSize: 11, fontWeight: 500,
                      color: "var(--fg3)", textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background: "var(--bg3)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...memData].sort((a, b) => b.memMB - a.memMB).map((p, i) => (
                  <tr key={p.pid} style={{ borderBottom: i < memData.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                    <td style={{ padding: "9px 12px", fontSize: 12.5 }}>{p.name}</td>
                    <td style={{ padding: "9px 12px" }}><span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{p.pid}</span></td>
                    <td style={{ padding: "9px 12px" }}><span className="mono" style={{ fontWeight: 500 }}>{p.memMB}</span> <span style={{ color: "var(--fg3)" }}>MB</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </window.Card>
      */}

      {/* Event log */}
      <window.Card title={`Event log · ${events.length}`}
        hint="Device-side events the agent has uploaded. Boots, app installs, network changes — newest first.">
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((e, i) => {
            const meta = EVENT_KIND[e.kind] || EVENT_KIND["app-install"];
            return (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                paddingBottom: i < events.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: meta.bg, color: meta.color,
                    display: "grid", placeItems: "center",
                    border: `1px solid ${meta.border}`,
                  }}><window.Ico name={meta.icon} size={11} stroke={1.8} /></span>
                  {i < events.length - 1 && (
                    <span style={{ width: 1, flex: 1, marginTop: 2,
                      background: "var(--color-border-subtle)", minHeight: 16 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>{meta.label}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{e.at}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--fg3)", lineHeight: 1.55 }}>
                    {e.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </window.Card>
    </div>
  );
}

// ─── V2 helpers (only used by DeviceMonitoringTabProposed) ──

// Health strip: a single horizontal row of small status tiles that
// summarizes the most operationally-important signals. Replaces the
// "Last collected" banner's role as the top-of-page status moment.
function MonHealthStrip({ device, runtime, t }) {
  const tiles = [];
  const mem = memSummaryFor(device);

  // Online state
  tiles.push({
    key: "online",
    label: "Status",
    value: runtime.isOnline ? "Online" : "Offline",
    tone: runtime.isOnline ? "ok" : "danger",
    dot: runtime.isOnline ? "var(--color-success-500)" : "var(--color-error-500)",
  });

  // Primary network
  const primary = t.network.type;
  const sigDbm = primary === "WIFI" ? t.network.wifi.signalDbm
              : primary === "Cellular" ? t.network.cellular.signalDbm
              : null;
  const sigLabel = sigDbm == null ? null
    : sigDbm > -55 ? "Excellent"
    : sigDbm > -65 ? "Good"
    : sigDbm > -75 ? "Fair"
    : "Weak";
  tiles.push({
    key: "net",
    label: "Primary network",
    value: primary === "Offline" ? "Offline" : primary,
    sub: sigLabel ? `${sigLabel} · ${sigDbm} dBm` : null,
    tone: primary === "Offline" ? "warning"
         : (sigDbm != null && sigDbm < -75) ? "warning" : "neutral",
  });

  // Root state — promoted in front of storage/memory because a rooted
  // device is the single most important security signal.
  tiles.push({
    key: "root",
    label: "Root",
    value: t.security.rooted ? "Rooted" : "Intact",
    sub: t.security.rooted ? "Device compromised" : "Integrity OK",
    tone: t.security.rooted ? "danger" : "ok",
  });

  // Storage (replaces Security tile — security still surfaces in
  // the dedicated "Security & uptime detail" card lower down).
  if (device.storage) {
    const used = device.storage.used;
    const total = device.storage.total;
    const pct = Math.round((used / total) * 100);
    tiles.push({
      key: "storage",
      label: "Storage",
      value: `${used.toFixed(1)} / ${total} GB`,
      sub: `${pct}% used`,
      tone: pct > 90 ? "danger" : pct > 75 ? "warning" : "ok",
    });
  }

  // Memory (RAM) — used / total. Sourced from memSummaryFor so it
  // stays consistent with the Memory probe table further down.
  tiles.push({
    key: "ram",
    label: "Memory",
    value: `${mem.usedGB} / ${mem.totalGB} GB`,
    sub: `${mem.pct}% used`,
    tone: mem.pct > 90 ? "danger" : mem.pct > 75 ? "warning" : "ok",
  });

  // Battery
  if (device.battery) {
    tiles.push({
      key: "bat",
      label: "Battery",
      value: `${device.battery.level}%`,
      sub: device.battery.health,
      tone: device.battery.level < 20 ? "warning"
           : device.battery.level < 50 ? "neutral" : "ok",
    });
  } else {
    tiles.push({ key: "bat", label: "Battery", value: "87%", sub: "Good", tone: "ok" });
  }

  // (Last check-in tile removed — already shown in the slim
  // "Snapshot collected" banner below the strip.)

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 0,
      background: "var(--color-bg-1)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-1)",
      overflow: "hidden",
    }}>
      {tiles.map((tile, i) => {
        const color = tile.tone === "danger"  ? "var(--color-error-700)"
                    : tile.tone === "warning" ? "var(--color-warning-700)"
                    : tile.tone === "ok"      ? "var(--color-success-700)"
                                              : "var(--fg1)";
        return (
          <div key={tile.key} style={{
            padding: "11px 14px",
            borderLeft: "1px solid var(--color-border-subtle)",
            display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
          }}>
            <div className="overline" style={{ fontSize: 9.5, color: "var(--fg3)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tile.label}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 14.5, fontWeight: 600, color, lineHeight: 1.2,
              fontVariantNumeric: "tabular-nums", minWidth: 0,
            }}>
              {tile.dot && (
                <span style={{ width: 7, height: 7, borderRadius: "50%",
                  background: tile.dot, flexShrink: 0,
                  boxShadow: `0 0 0 3px color-mix(in oklab, ${tile.dot} 18%, transparent)` }} />
              )}
              <span className={tile.mono ? "mono" : ""} style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0,
              }}>{tile.value}</span>
            </div>
            {tile.sub && (
              <div style={{ fontSize: 11, color: "var(--fg3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tile.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// (MonPendingBar removed — earlier iteration batched edits into a
// pending list; user feedback moved Monitoring to direct push. Each
// pencil → ConfirmDialog → push, no queue.)

// ─── Per-card pending-changes footer ───────────────────────
// Drops into the bottom of a card whose rows can be staged for batched
// push (Security modules, System state, System settings). When the
// count is 0 it renders nothing — the card stays unchanged. When at
// least one change is staged we show a warning-toned strip with chips
// for each change, a Discard-all link, and a primary Push button.
function PendingFooter({ items, pushing, onDiscardOne, onDiscardAll, onPush }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      marginTop: 12, paddingTop: 12,
      borderTop: "1px solid color-mix(in oklab, var(--color-warning-500) 28%, transparent)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "var(--color-warning-500)",
            color: "#fff",
            display: "grid", placeItems: "center",
            fontSize: 10, fontWeight: 700,
            fontFamily: "var(--font-mono)",
          }}>{items.length}</span>
          <span style={{ fontSize: 12, fontWeight: 600,
            color: "var(--color-warning-700)" }}>
            Pending change{items.length > 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 11, color: "var(--fg3)" }}>· not pushed yet</span>
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onDiscardAll} disabled={pushing}
          style={{
            padding: "5px 10px", borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 30%, transparent)",
            color: "var(--color-warning-700)",
            fontSize: 11.5, fontWeight: 500,
            cursor: pushing ? "not-allowed" : "pointer",
            opacity: pushing ? 0.5 : 1,
            fontFamily: "inherit",
          }}>
          Discard
        </button>
        <window.Button size="sm" primary
          icon={pushing ? null : "upload"}
          disabled={pushing}
          onClick={onPush}>
          {pushing ? "Pushing…" : `Push ${items.length} to terminal`}
        </window.Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((ch) => {
          const toLabel = ch.kind === "wifi"
            ? (ch.to?.enabled ? `Wi-Fi · ${ch.to.ssid || "—"}` : "Wi-Fi off")
            : `${ch.to}${ch.unit && ch.kind === "slider" ? ch.unit : ""}`;
          return (
            <span key={ch.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 4px 3px 10px", borderRadius: 999,
              background: "var(--bg2)",
              border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
              fontSize: 11.5, color: "var(--fg1)", maxWidth: "100%",
            }}>
              <span style={{ color: "var(--fg2)" }}>{ch.label}</span>
              <span className="mono" style={{ color: "var(--fg3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 90 }}>{String(ch.from).slice(0, 16)}</span>
              <window.Ico name="arrowR" size={9} stroke={2.2}
                style={{ color: "var(--color-warning-700)", flexShrink: 0 }} />
              <span className="mono" style={{ color: "var(--color-warning-700)",
                fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 130 }}>{toLabel}</span>
              <button type="button"
                onClick={() => onDiscardOne(ch.id)}
                disabled={pushing}
                title={`Discard · ${ch.label}`}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "transparent", border: 0,
                  cursor: pushing ? "not-allowed" : "pointer",
                  display: "grid", placeItems: "center",
                  color: "var(--fg3)", flexShrink: 0, marginLeft: 2,
                }}>
                <window.Ico name="x" size={10} stroke={2.2} />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EditableModuleRow({ label, icon, on, onEdit, pending }) {
  const stagedOn = pending ? pending.to === "Enabled" : null;
  const isStaged = pending != null && stagedOn !== on;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px",
      background: isStaged
        ? "color-mix(in oklab, var(--color-warning-500) 8%, var(--bg2))"
        : "var(--bg2)",
      border: "1px solid",
      borderColor: isStaged
        ? "color-mix(in oklab, var(--color-warning-500) 35%, transparent)"
        : "var(--border-1)",
      borderRadius: "var(--radius-md)",
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 6,
        background: on ? "color-mix(in oklab, var(--color-success-500) 14%, transparent)"
                       : "var(--bg3)",
        color: on ? "var(--color-success-700)" : "var(--fg3)",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <window.Ico name={icon} size={13} stroke={1.8} />
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--fg1)", fontWeight: 500 }}>
        {label}
      </span>
      <span style={{
        padding: "2px 8px", borderRadius: 999,
        background: on ? "color-mix(in oklab, var(--color-success-500) 16%, transparent)"
                       : "var(--bg3)",
        color:    on ? "var(--color-success-700)" : "var(--fg3)",
        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        textDecoration: isStaged ? "line-through" : "none",
        opacity: isStaged ? 0.6 : 1,
      }}>{on ? "ON" : "OFF"}</span>
      {isStaged && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 999,
          background: "var(--color-warning-50, var(--warning-bg))",
          color: "var(--color-warning-700)",
          border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
          fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        }}>
          <window.Ico name="arrowR" size={9} stroke={2.2} />
          {stagedOn ? "ON" : "OFF"}
        </span>
      )}
      <button type="button" onClick={onEdit}
        title={isStaged ? `Edit staged · ${label}` : `Change · ${label}`}
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: isStaged ? "var(--color-warning-50, var(--warning-bg))" : "transparent",
          border: "1px solid",
          borderColor: isStaged
            ? "color-mix(in oklab, var(--color-warning-500) 40%, transparent)"
            : "var(--border-1)",
          cursor: "pointer", display: "grid", placeItems: "center",
          color: isStaged ? "var(--color-warning-700)" : "var(--fg2)",
          flexShrink: 0,
        }}>
        <window.Ico name="edit" size={12} stroke={1.8} />
      </button>
    </div>
  );
}

// Same visual as the V1 Flag in a KvTable row, plus pencil affordance.
function EditableFlagRow({ label, positive, positiveLabel, negativeLabel, tone, onEdit, readOnly, pending }) {
  const isAlert = !positive;
  const color = isAlert
    ? (tone === "warning" ? "var(--color-warning-700)" : "var(--color-error-700)")
    : "var(--color-success-700)";
  const bg = isAlert
    ? (tone === "warning" ? "var(--warning-bg)" : "var(--error-bg)")
    : "oklch(96% 0.03 152)";
  // A staged value differs from the live one. Show the target as a chip.
  const isStaged = !!pending;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto",
      alignItems: "center", gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid var(--color-border-subtle)",
    }}>
      <span className="overline" style={{ fontSize: 10 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
        flexWrap: "wrap", minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 999,
          background: bg, color,
          fontSize: 12, fontWeight: 500,
          textDecoration: isStaged ? "line-through" : "none",
          opacity: isStaged ? 0.55 : 1,
        }}>
          <window.Ico name={positive ? "check" : "alert"} size={11} stroke={2} />
          {positive ? positiveLabel : negativeLabel}
        </span>
        {isStaged && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 999,
            background: "var(--warning-bg)",
            color: "var(--color-warning-700)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
            fontSize: 12, fontWeight: 600,
          }}>
            <window.Ico name="arrowR" size={10} stroke={2.2} />
            {pending.to}
          </span>
        )}
      </span>
      {readOnly ? (
        <span style={{ fontSize: 10.5, color: "var(--fg3)", letterSpacing: "0.04em" }}>READ-ONLY</span>
      ) : (
        <button type="button" onClick={onEdit}
          title={isStaged ? `Edit staged · ${label}` : `Change · ${label}`}
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: isStaged ? "var(--warning-bg)" : "transparent",
            border: "1px solid",
            borderColor: isStaged
              ? "color-mix(in oklab, var(--color-warning-500) 40%, transparent)"
              : "var(--border-1)",
            cursor: "pointer", display: "grid", placeItems: "center",
            color: isStaged ? "var(--color-warning-700)" : "var(--fg2)",
          }}>
          <window.Ico name="edit" size={12} stroke={1.8} />
        </button>
      )}
    </div>
  );
}

// Simple binary toggle row used for "Auto time", "Auto timezone" —
// neutral framing (no warning colors when off).
function EditableToggleRow({ label, on, onLabel, offLabel, onEdit, locked, pending }) {
  const color = on ? "var(--color-success-700)" : "var(--fg2)";
  const bg    = on ? "oklch(96% 0.03 152)"        : "var(--bg3)";
  const isStaged = !!pending;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto",
      alignItems: "center", gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid var(--color-border-subtle)",
    }}>
      <span className="overline" style={{ fontSize: 10 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
        flexWrap: "wrap", minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 999,
          background: bg, color,
          fontSize: 12, fontWeight: 500,
          textDecoration: isStaged ? "line-through" : "none",
          opacity: isStaged ? 0.55 : 1,
        }}>
          <window.Ico name={on ? "check" : "x"} size={11} stroke={2} />
          {on ? (onLabel || "Enabled") : (offLabel || "Disabled")}
        </span>
        {isStaged && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 999,
            background: "var(--warning-bg)",
            color: "var(--color-warning-700)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
            fontSize: 12, fontWeight: 600,
          }}>
            <window.Ico name="arrowR" size={10} stroke={2.2} />
            {pending.to}
          </span>
        )}
      </span>
      {locked ? (
        <span style={{ fontSize: 10.5, color: "var(--fg3)", letterSpacing: "0.04em" }}>LOCKED</span>
      ) : (
        <button type="button" onClick={onEdit}
          title={isStaged ? `Edit staged · ${label}` : `Change · ${label}`}
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: isStaged ? "var(--warning-bg)" : "transparent",
            border: "1px solid",
            borderColor: isStaged
              ? "color-mix(in oklab, var(--color-warning-500) 40%, transparent)"
              : "var(--border-1)",
            cursor: "pointer", display: "grid", placeItems: "center",
            color: isStaged ? "var(--color-warning-700)" : "var(--fg2)",
          }}>
          <window.Ico name="edit" size={12} stroke={1.8} />
        </button>
      )}
    </div>
  );
}

// Setting row variants — used in the System settings card. Same
// grid as EditableFlagRow so they line up.
function SettingRow({ label, value, mono, onEdit, locked, pending }) {
  const isStaged = !!pending;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto",
      alignItems: "center", gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid var(--color-border-subtle)",
      opacity: locked ? 0.55 : 1,
    }}>
      <span className="overline" style={{ fontSize: 10 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8,
        flexWrap: "wrap", minWidth: 0 }}>
        <span className={mono ? "mono" : ""} style={{ fontSize: 13,
          color: "var(--fg1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: isStaged ? "line-through" : "none",
          opacity: isStaged ? 0.55 : 1,
        }}>{value}</span>
        {isStaged && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 999,
            background: "var(--warning-bg)",
            color: "var(--color-warning-700)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
            fontSize: 12, fontWeight: 600,
            fontFamily: mono ? "var(--font-family-mono)" : "inherit",
            maxWidth: "100%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <window.Ico name="arrowR" size={10} stroke={2.2} />
            {String(pending.to)}{pending.unit || ""}
          </span>
        )}
      </span>
      {locked ? (
        <span style={{ fontSize: 10.5, color: "var(--fg3)", letterSpacing: "0.04em" }}>AUTO</span>
      ) : (
        <button type="button" onClick={onEdit}
          title={isStaged ? `Edit staged · ${label}` : `Change · ${label}`}
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: isStaged ? "var(--warning-bg)" : "transparent",
            border: "1px solid",
            borderColor: isStaged
              ? "color-mix(in oklab, var(--color-warning-500) 40%, transparent)"
              : "var(--border-1)",
            cursor: "pointer", display: "grid", placeItems: "center",
            color: isStaged ? "var(--color-warning-700)" : "var(--fg2)",
          }}>
          <window.Ico name="edit" size={12} stroke={1.8} />
        </button>
      )}
    </div>
  );
}
function SettingSliderRow({ label, value, max, unit, onEdit, pending }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isStaged = !!pending;
  const stagedVal = isStaged ? Number(pending.to) : null;
  const stagedPct = isStaged && max > 0
    ? Math.min(100, Math.round((stagedVal / max) * 100))
    : null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto",
      alignItems: "center", gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid var(--color-border-subtle)",
    }}>
      <span className="overline" style={{ fontSize: 10 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ flex: 1, height: 4, background: "var(--bg3)",
          borderRadius: 2, overflow: "hidden", minWidth: 60, position: "relative" }}>
          {/* Current value bar (faded when a staged value overrides it) */}
          <div style={{ width: `${pct}%`, height: "100%",
            background: "var(--color-primary-500)",
            opacity: isStaged ? 0.35 : 1 }} />
          {/* Staged value bar — drawn on top in warning tone */}
          {isStaged && (
            <div style={{
              position: "absolute", inset: 0,
              width: `${stagedPct}%`, height: "100%",
              background: "var(--color-warning-500)",
            }} />
          )}
        </div>
        <span className="mono" style={{ fontSize: 11.5,
          color: isStaged ? "var(--fg3)" : "var(--fg2)",
          minWidth: 42, textAlign: "right", flexShrink: 0,
          textDecoration: isStaged ? "line-through" : "none",
        }}>
          {value}{unit ? unit : ""}
        </span>
        {isStaged && (
          <span className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            background: "var(--warning-bg)",
            color: "var(--color-warning-700)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 35%, transparent)",
            fontSize: 11.5, fontWeight: 600, flexShrink: 0,
          }}>
            <window.Ico name="arrowR" size={9} stroke={2.2} />
            {stagedVal}{unit || pending.unit || ""}
          </span>
        )}
      </div>
      <button type="button" onClick={onEdit}
        title={isStaged ? `Edit staged · ${label}` : `Change · ${label}`}
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: isStaged ? "var(--warning-bg)" : "transparent",
          border: "1px solid",
          borderColor: isStaged
            ? "color-mix(in oklab, var(--color-warning-500) 40%, transparent)"
            : "var(--border-1)",
          cursor: "pointer", display: "grid", placeItems: "center",
          color: isStaged ? "var(--color-warning-700)" : "var(--fg2)",
        }}>
        <window.Ico name="edit" size={12} stroke={1.8} />
      </button>
    </div>
  );
}

// Curated value options for each system setting — keeps the change
// dialog deterministic instead of free-form. Edit here to extend.
const TIMEZONE_OPTIONS = [
  "Anchorage (GMT-09:00)",
  "Los Angeles (GMT-08:00)",
  "Vancouver (GMT-08:00)",
  "Denver (GMT-07:00)",
  "Chicago (GMT-06:00)",
  "Toronto (GMT-05:00)",
  "New York (GMT-05:00)",
  "UTC (GMT+00:00)",
  "London (GMT+00:00)",
  "Berlin (GMT+01:00)",
  "Shanghai (GMT+08:00)",
  "Tokyo (GMT+09:00)",
  "Sydney (GMT+10:00)",
];
// Maps a raw IANA id from telemetry to one of the display strings above.
const TZ_DISPLAY_MAP = {
  "America/Toronto":     "Toronto (GMT-05:00)",
  "America/New_York":    "New York (GMT-05:00)",
  "America/Chicago":     "Chicago (GMT-06:00)",
  "America/Los_Angeles": "Los Angeles (GMT-08:00)",
  "America/Vancouver":   "Vancouver (GMT-08:00)",
  "America/Anchorage":   "Anchorage (GMT-09:00)",
  "America/Denver":      "Denver (GMT-07:00)",
  "Europe/London":       "London (GMT+00:00)",
  "Europe/Berlin":       "Berlin (GMT+01:00)",
  "Asia/Shanghai":       "Shanghai (GMT+08:00)",
  "Asia/Tokyo":          "Tokyo (GMT+09:00)",
  "Australia/Sydney":    "Sydney (GMT+10:00)",
  "UTC":                 "UTC (GMT+00:00)",
};
function tzDisplay(tz) { return TZ_DISPLAY_MAP[tz] || tz; }

const SETTING_OPTIONS = {
  language:     ["en-US", "fr-CA", "es-MX", "en-GB", "en-CA", "pt-BR"],
  timezone:     TIMEZONE_OPTIONS,
  inputMethod:  ["com.google.android.inputmethod.latin/.LatinIME",
                 "com.android.inputmethod.pinyin/.PinyinIME",
                 "com.toms.kiosk-ime/.NumericIME"],
  screenTimeout:[15000, 30000, 60000, 120000, 300000, 600000],
};

// System settings card — extracted so the proposed monitoring tab can
// place it right after the Security module switches grid (Tier B)
// instead of buried in Tier D.
function MonSystemSettingsCard({ t, autoTime, autoTz, openEdit, pending,
  pushingScope, discardPending, discardScope, pushScope }) {
  const mediaPct = Math.round((t.settings.mediaVolume / t.settings.mediaVolumeMax) * 100);
  const ringPct  = Math.round((t.settings.ringVolume  / t.settings.ringVolumeMax)  * 100);
  return (
    <window.Card title="System settings"
      hint="Locale, display & audio preferences — change → Stage → Push to terminal in one batch.">
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div>
          <EditableToggleRow label="Auto time" on={autoTime}
            onLabel="Enabled — synced from network"
            offLabel="Disabled — manual"
            pending={pending["set.autoTime"]}
            onEdit={() => openEdit({
              id: "set.autoTime", label: "Auto time",
              from: autoTime ? "Enabled" : "Disabled",
              to:   autoTime ? "Disabled" : "Enabled",
            })} />
          <EditableToggleRow label="Auto timezone" on={autoTz}
            onLabel="Enabled — synced from network"
            offLabel="Disabled — manual"
            pending={pending["set.autoTz"]}
            onEdit={() => openEdit({
              id: "set.autoTz", label: "Auto timezone",
              from: autoTz ? "Enabled" : "Disabled",
              to:   autoTz ? "Disabled" : "Enabled",
            })} />
          <SettingRow label="Timezone"
            value={tzDisplay(t.settings.timezone)}
            locked={autoTz}
            pending={pending["set.timezone"]}
            onEdit={() => openEdit({
              id: "set.timezone", label: "Timezone",
              kind: "select", options: SETTING_OPTIONS.timezone,
              from: tzDisplay(t.settings.timezone),
              to:   tzDisplay(t.settings.timezone),
            })} />
          <SettingRow label="Language" mono value={t.settings.language}
            pending={pending["set.language"]}
            onEdit={() => openEdit({
              id: "set.language", label: "Language",
              kind: "select", options: SETTING_OPTIONS.language,
              from: t.settings.language, to: t.settings.language,
            })} />
          <SettingRow label="Screen timeout"
            value={`${(t.settings.screenTimeoutMs / 1000).toFixed(0)} seconds`}
            pending={pending["set.timeout"]}
            onEdit={() => openEdit({
              id: "set.timeout", label: "Screen timeout",
              kind: "select",
              options: SETTING_OPTIONS.screenTimeout.map(ms => `${ms / 1000}s`),
              from: `${(t.settings.screenTimeoutMs / 1000).toFixed(0)}s`,
              to:   `${(t.settings.screenTimeoutMs / 1000).toFixed(0)}s`,
            })} />
        </div>
        <div>
          <SettingSliderRow label="Screen brightness"
            value={t.settings.brightness} max={100} unit="%"
            pending={pending["set.bright"]}
            onEdit={() => openEdit({
              id: "set.bright", label: "Screen brightness",
              kind: "slider", max: 100, unit: "%",
              from: `${t.settings.brightness}%`, to: t.settings.brightness,
            })} />
          <SettingSliderRow label="Sub-screen"
            value={t.settings.subBrightness} max={100} unit="%"
            pending={pending["set.subBright"]}
            onEdit={() => openEdit({
              id: "set.subBright", label: "Sub-screen brightness",
              kind: "slider", max: 100, unit: "%",
              from: `${t.settings.subBrightness}%`, to: t.settings.subBrightness,
            })} />
          <SettingSliderRow label="Media volume"
            value={mediaPct} max={100} unit="%"
            pending={pending["set.mediaVol"]}
            onEdit={() => openEdit({
              id: "set.mediaVol", label: "Media volume",
              kind: "slider", max: 100, unit: "%",
              from: `${mediaPct}%`, to: mediaPct,
            })} />
          <SettingSliderRow label="Ring volume"
            value={ringPct} max={100} unit="%"
            pending={pending["set.ringVol"]}
            onEdit={() => openEdit({
              id: "set.ringVol", label: "Ring volume",
              kind: "slider", max: 100, unit: "%",
              from: `${ringPct}%`, to: ringPct,
            })} />
        </div>
      </div>
      <PendingFooter
        items={Object.values(pending).filter((c) => c.id.startsWith("set."))}
        pushing={pushingScope === "set."}
        onDiscardOne={discardPending}
        onDiscardAll={() => discardScope("set.")}
        onPush={() => pushScope("set.")} />
    </window.Card>
  );
}

// Apps & Firmware in the Monitoring tab — compact variant of the
// Apps tab card. Lets the ticket-handler push a firmware update or
// install/update individual apps inline.
function MonAppsFirmwareCard({ device }) {
  const firmware = useMemoD(() => firmwareDeltaFor(device), [device]);
  const delta    = useMemoD(() => appDeltaFor(device), [device]);
  const [pushConfirm, setPushConfirm] = useStateD(null);

  // Build the unified app list — required apps first (with state),
  // then any extra installed apps the device has but template doesn't.
  const appList = useMemoD(() => {
    const installed = device.apps || [];
    const requiredIds = new Set(delta.required.map(r => r.id));
    const rows = delta.required.map(r => {
      const inst = installed.find(i => i.id === r.id);
      const cmp = inst ? compareVer(inst.version, r.version) : null;
      const state = !inst        ? "missing"
                  : cmp < 0      ? "outdated"
                                 : "ok";
      return {
        id: r.id, name: r.name, category: r.category,
        installedVersion: inst?.version || null,
        targetVersion: r.version,
        state,
      };
    });
    const extras = installed
      .filter(i => !requiredIds.has(i.id))
      .map(i => ({
        id: i.id, name: i.name, category: "other",
        installedVersion: i.version, targetVersion: null,
        state: "extra",
      }));
    return [...rows, ...extras];
  }, [device, delta]);

  const STATE_META = {
    missing:  { label: "Not installed", color: "var(--color-warning-700)",
                bg: "var(--warning-bg)",
                border: "color-mix(in oklab, var(--color-warning-500) 28%, transparent)" },
    outdated: { label: "Update available", color: "var(--color-warning-700)",
                bg: "var(--warning-bg)",
                border: "color-mix(in oklab, var(--color-warning-500) 28%, transparent)" },
    ok:       { label: "Up-to-date", color: "var(--color-success-700)",
                bg: "oklch(96% 0.03 152)",
                border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)" },
    extra:    { label: "Optional", color: "var(--fg2)",
                bg: "var(--bg3)", border: "var(--border-1)" },
  };

  const queueFirmware = () => setPushConfirm({
    kind: "firmware",
    title: <>Push firmware update?</>,
    summary: `${firmware.current} → ${firmware.target.version}`,
    body: <>The device will download <b className="mono">{firmware.target.version}</b> on
      next check-in and reboot to install. Active transactions are drained first.</>,
    confirmLabel: "Queue firmware push",
    toast: `Firmware push queued · ${firmware.target.version}`,
  });

  const queueApp = (row) => () => {
    const kind = row.state === "missing" ? "install" : "update";
    setPushConfirm({
      kind,
      title: <>{kind === "install" ? "Install" : "Update"} · <span className="mono">{row.name}</span>?</>,
      summary: kind === "install"
        ? `Not installed → ${row.targetVersion}`
        : `${row.installedVersion} → ${row.targetVersion}`,
      body: <>This will push <b className="mono">{row.name} {row.targetVersion}</b> to <span className="mono">{device.sn}</span>.
        The cashier will see no interruption; the app activates on next launch.</>,
      confirmLabel: kind === "install" ? "Queue install" : "Queue update",
      toast: `${kind === "install" ? "Install" : "Update"} queued · ${row.name} ${row.targetVersion}`,
    });
  };

  const confirmAndDispatch = () => {
    if (!pushConfirm) return;
    window.showToast?.(pushConfirm.toast, "success");
    setPushConfirm(null);
  };

  return (
    <>
      <window.Card title="Apps & Firmware"
        hint="Push firmware updates and install/update individual apps."
        action={firmware?.behind && (
          <window.Pill tone="warning" dot size="sm">Firmware behind</window.Pill>
        )}>
        {/* Firmware row */}
        <div style={{
          padding: "12px 14px",
          background: firmware?.behind ? "var(--warning-bg)" : "oklch(96% 0.03 152)",
          border: "1px solid",
          borderColor: firmware?.behind
            ? "color-mix(in oklab, var(--color-warning-500) 28%, transparent)"
            : "color-mix(in oklab, var(--color-success-500) 22%, transparent)",
          borderRadius: "var(--radius-md)",
          display: "grid",
          gridTemplateColumns: "32px minmax(0, 1fr) auto",
          gap: 12, alignItems: "center",
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 6,
            background: firmware?.behind ? "color-mix(in oklab, var(--color-warning-500) 18%, transparent)"
                                         : "color-mix(in oklab, var(--color-success-500) 16%, transparent)",
            color: firmware?.behind ? "var(--color-warning-700)" : "var(--color-success-700)",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <window.Ico name="shield" size={14} stroke={1.8} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg1)" }}>Firmware</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3,
              fontSize: 11.5, color: "var(--fg2)", flexWrap: "wrap" }}>
              <span className="mono">{device.firmware}</span>
              <window.Ico name="chevr" size={10} style={{ color: "var(--fg3)" }} />
              <span className="mono" style={{ fontWeight: 600,
                color: firmware?.behind ? "var(--color-warning-700)" : "var(--color-success-700)" }}>
                {firmware?.target?.version || "—"}
              </span>
              {firmware?.behind && firmware.behindBy > 0 && (
                <span style={{ color: "var(--fg3)" }}>· {firmware.behindBy} build{firmware.behindBy === 1 ? "" : "s"} behind</span>
              )}
              {!firmware?.behind && <span style={{ color: "var(--color-success-700)" }}>· Latest</span>}
            </div>
            {firmware?.target?.notes && (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg3)", lineHeight: 1.45 }}>
                <span style={{ color: "var(--fg2)" }}>Notes:</span> {firmware.target.notes}
              </div>
            )}
          </div>
          {firmware?.behind ? (
            <window.Button primary size="sm" icon="upload" onClick={queueFirmware}>
              Update firmware
            </window.Button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--fg3)", fontWeight: 500,
              letterSpacing: "0.04em" }}>UP-TO-DATE</span>
          )}
        </div>

        {/* App list — installed only (missing apps live in the row below). */}
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px dashed var(--color-border-subtle)",
        }}>
          {(() => {
            const installedRows = appList.filter(r => r.state !== "missing");
            const missing = appList.filter(r => r.state === "missing");
            return (
              <>
                {/* Missing apps row — quick-install pills */}
                {missing.length > 0 && (
                  <div style={{
                    marginBottom: 12, padding: "8px 10px",
                    background: "var(--warning-bg)",
                    border: "1px solid color-mix(in oklab, var(--color-warning-500) 28%, transparent)",
                    borderRadius: "var(--radius-md)",
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: "var(--color-warning-700)", letterSpacing: "0.04em" }}>
                      MISSING · {missing.length}
                    </span>
                    {missing.map(row => (
                      <span key={row.id} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 4px 3px 10px", borderRadius: 999,
                        background: "var(--color-bg-1)",
                        border: "1px solid var(--border-1)",
                        fontSize: 11.5, color: "var(--fg1)",
                      }}>
                        <span style={{ fontWeight: 500 }}>{row.name}</span>
                        <span className="mono" style={{ color: "var(--fg3)" }}>
                          {row.targetVersion}
                        </span>
                        <button type="button" onClick={queueApp(row)}
                          title={`Install ${row.name}`}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "2px 8px", borderRadius: 999,
                            background: "var(--color-primary-50)",
                            color: "var(--color-primary-700)",
                            border: "1px solid color-mix(in oklab, var(--color-primary-500) 35%, transparent)",
                            cursor: "pointer", fontSize: 11, fontWeight: 600,
                          }}>
                          <window.Ico name="download" size={10} stroke={2} />
                          Install
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  marginBottom: 8 }}>
                  <span className="overline" style={{ fontSize: 10 }}>
                    Installed apps · <span className="mono num">{installedRows.length}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg3)" }}>
                    {delta.outdated.length > 0
                      ? `${delta.outdated.length} outdated`
                      : "All up-to-date"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {installedRows.map(row => {
                    const meta = STATE_META[row.state];
                    const needsAction = row.state === "outdated";
                    return (
                      <div key={row.id} style={{
                        padding: "8px 12px",
                        background: "var(--bg2)",
                        border: "1px solid var(--border-1)",
                        borderRadius: "var(--radius-md)",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                        gap: 12, alignItems: "center",
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.name}
                            {row.category === "system" && (
                              <span style={{
                                marginLeft: 6, fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                                background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                                fontFamily: "var(--font-family-mono)", fontWeight: 500, letterSpacing: "0.05em",
                              }}>SYSTEM</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 2,
                            display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span>
                              <span style={{ color: "var(--fg3)" }}>Installed </span>
                              <span className="mono" style={{ color: "var(--fg1)" }}>
                                {row.installedVersion}
                              </span>
                            </span>
                            {row.targetVersion && row.targetVersion !== row.installedVersion && (
                              <>
                                <span style={{ color: "var(--fg3)" }}>·</span>
                                <span>
                                  <span style={{ color: "var(--fg3)" }}>Target </span>
                                  <span className="mono" style={{ color: "var(--fg1)", fontWeight: 500 }}>
                                    {row.targetVersion}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span style={{
                          padding: "3px 8px", borderRadius: 999,
                          background: meta.bg, color: meta.color,
                          border: `1px solid ${meta.border}`,
                          fontSize: 11, fontWeight: 500,
                        }}>{meta.label}</span>
                        {needsAction ? (
                          <window.Button size="sm" primary icon="upload" onClick={queueApp(row)}>
                            Update
                          </window.Button>
                        ) : (
                          <span style={{ width: 78 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </window.Card>

      <window.ConfirmDialog
        open={!!pushConfirm}
        onClose={() => setPushConfirm(null)}
        title={pushConfirm?.title}
        body={pushConfirm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "start",
              padding: "8px 12px",
              background: "var(--bg2)", border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
            }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 500,
                color: "var(--color-primary-700)" }}>{pushConfirm.summary}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg3)", lineHeight: 1.5 }}>
              {pushConfirm.body}
            </div>
          </div>
        ) : ""}
        confirmLabel={pushConfirm?.confirmLabel || "Queue push"}
        onConfirm={confirmAndDispatch} />
    </>
  );
}

// ─── Proposed ordering for ticket-handler workflow ─────────
function DeviceMonitoringTabProposed({ device, ticket }) {
  const runtime    = useMemoD(() => runtimeFor(device), [device]);
  const events     = useMemoD(() => eventsFor(device),  [device]);
  const simTraffic = useMemoD(() => simTrafficFor(device), [device]);
  const t          = useMemoD(() => deviceTelemetryFor(device), [device]);

  // Memory probe state (identical to V1).
  const [memState, setMemState] = useStateD("idle");
  const [memData, setMemData] = useStateD(null);
  const fetchMemory = () => {
    if (!runtime.isOnline) { setMemState("error"); return; }
    setMemState("loading");
    setTimeout(() => { setMemData(liveMemoryFor(device)); setMemState("done"); }, 900);
  };

  const [apnOpen, setApnOpen]   = useStateD(false);
  // Location telemetry is now a low-priority section, collapsed by default.
  const [locOpen, setLocOpen]   = useStateD(false);
  // Detail / secondary cards — collapsed by default to keep the
  // monitoring tab scannable. Tier A health strip + Tier B switches
  // already surface the headline values; expand for raw detail.
  const [secOpen, setSecOpen]   = useStateD(false);
  const [netOpen, setNetOpen]   = useStateD(false);
  const [memOpen, setMemOpen]   = useStateD(false);
  const [evtOpen, setEvtOpen]   = useStateD(false);

  // Auto time / auto timezone — typically agent-reported, simulated here.
  // When auto is on, the corresponding manual row is locked.
  const [autoTime, setAutoTime] = useStateD(true);
  const [autoTz,   setAutoTz]   = useStateD(false);

  // Inline edit affordance: each pencil opens a ConfirmDialog. For
  // Security modules, System state and System settings the dialog
  // *stages* the change into a `pending` batch; the operator then
  // reviews the whole batch in the sticky Pending-changes bar and
  // pushes everything to the device in one go. Network / APN edits
  // remain a direct push (one tap → one toast) because they're
  // diagnostic toggles not configuration tuning.
  const [confirm, setConfirm] = useStateD(null);
  const [pending, setPending] = useStateD({});
  const isBatchableId = (id) => /^(mod|state|set)\./.test(id || "");

  // Open the change editor. If a change is already staged for this id,
  // pre-load the dialog with the staged target so the operator picks
  // up where they left off.
  const openEdit = (payload) => {
    if (window.__DEVICES_READONLY) return;
    const staged = pending[payload.id];
    setConfirm(staged ? { ...payload, to: staged.to } : payload);
  };

  // Apply a single non-batchable change (e.g. net.*) directly to
  // the device — preserves the old "one tap → one toast" semantics.
  const pushOne = (ch) => {
    if (window.__DEVICES_READONLY) return;
    let summary;
    if (ch.kind === "wifi") {
      const v = ch.to || {};
      summary = v.enabled ? `Enabled · ${v.ssid || "—"}` : "Disabled";
    } else {
      summary = String(ch.to);
    }
    window.showToast?.(`Pushed · ${ch.label} → ${summary}`, "success");
  };

  // Dialog Confirm: either stage into the batch (for batchable ids)
  // or push immediately (everything else).
  const stageOrPush = () => {
    if (!confirm) return;
    if (!isBatchableId(confirm.id)) {
      pushOne(confirm);
      setConfirm(null);
      return;
    }
    // Stage. If the user "changed" to the same value, drop the entry
    // — it's a no-op.
    const isNoop = confirm.kind !== "wifi"
      && String(confirm.to) === String(confirm.from);
    setPending((p) => {
      const next = { ...p };
      if (isNoop) delete next[confirm.id];
      else next[confirm.id] = { ...confirm, stagedAt: Date.now() };
      return next;
    });
    setConfirm(null);
  };

  // Apply every staged change at once. Simulates a network round-trip
  // so the "Pushing…" state is visible. Scoped — each card pushes only
  // the changes that belong to it (mod.* / state.* / set.*).
  const [pushingScope, setPushingScope] = useStateD(null);
  const pushScope = (scope) => {
    const items = Object.values(pending).filter((ch) => ch.id.startsWith(scope));
    if (items.length === 0) return;
    setPushingScope(scope);
    setTimeout(() => {
      items.forEach((ch) => {
        if (ch.id === "set.autoTime") setAutoTime(ch.to === "Enabled");
        else if (ch.id === "set.autoTz") setAutoTz(ch.to === "Enabled");
      });
      const scopeLabel = scope === "mod." ? "module"
                       : scope === "state." ? "state"
                       : "settings";
      window.showToast?.(
        `Pushed ${items.length} ${scopeLabel} change${items.length > 1 ? "s" : ""} to ${device.sn}`,
        "success");
      setPending((p) => {
        const next = {};
        Object.entries(p).forEach(([k, v]) => {
          if (!k.startsWith(scope)) next[k] = v;
        });
        return next;
      });
      setPushingScope(null);
    }, 700);
  };

  const discardPending = (id) => setPending((p) => {
    const next = { ...p }; delete next[id]; return next;
  });
  const discardScope = (scope) => setPending((p) => {
    const next = {};
    Object.entries(p).forEach(([k, v]) => {
      if (!k.startsWith(scope)) next[k] = v;
    });
    return next;
  });

  const toggleConfirm = (id, label, currentOn) => () => {
    const staged = pending[id];
    setConfirm({
      id, label,
      from: currentOn ? "Enabled" : "Disabled",
      to: staged ? staged.to : (currentOn ? "Disabled" : "Enabled"),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Tier A — at-a-glance health ───────────────────── */}
      <MonHealthStrip device={device} runtime={runtime} t={t} />

      {/* Last-collected (slim variant — strip already shows freshness) */}
      <div style={{
        padding: "8px 14px",
        background: t.collectedAt.stale ? "var(--warning-bg)" : "var(--bg2)",
        border: "1px solid",
        borderColor: t.collectedAt.stale
          ? "color-mix(in oklab, var(--color-warning-500) 25%, transparent)"
          : "var(--border-1)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontSize: 12,
      }}>
        <window.Ico name="clock" size={12} stroke={2} style={{ color: "var(--fg3)" }} />
        <span style={{ color: "var(--fg2)" }}>Snapshot collected</span>
        <span className="mono" style={{ color: "var(--fg1)", fontWeight: 500 }}>
          {t.collectedAt.pretty}
        </span>
        <span style={{ color: "var(--fg3)" }}>· {t.collectedAt.relative}</span>
        <div style={{ flex: 1 }} />
        {!window.__DEVICES_READONLY && (
          <window.Button size="sm" ghost icon="refresh"
            onClick={() => window.showToast?.("Telemetry refresh queued", "info")}>
            Re-collect
          </window.Button>
        )}
      </div>

      {/* ── Tier B — KB-referenced switches & state ───────── */}
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <window.Card title="Security module switches"
          hint="Card-acceptance paths. KB recommended steps refer to these directly — change here, then Apply.">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <EditableModuleRow label="Magstripe"     icon="link"    on={t.modules.magstripe}
              pending={pending["mod.magstripe"]}
              onEdit={toggleConfirm("mod.magstripe",   "Magstripe",     t.modules.magstripe)} />
            <EditableModuleRow label="Insert (chip)" icon="box"     on={t.modules.insertCard}
              pending={pending["mod.insertCard"]}
              onEdit={toggleConfirm("mod.insertCard",  "Insert (chip)", t.modules.insertCard)} />
            <EditableModuleRow label="Contactless"   icon="bolt"    on={t.modules.contactless}
              pending={pending["mod.contactless"]}
              onEdit={toggleConfirm("mod.contactless", "Contactless",   t.modules.contactless)} />
            <EditableModuleRow label="Printer"       icon="package" on={t.modules.printer}
              pending={pending["mod.printer"]}
              onEdit={toggleConfirm("mod.printer",     "Printer",       t.modules.printer)} />
          </div>
          <PendingFooter
            items={Object.values(pending).filter((c) => c.id.startsWith("mod."))}
            pushing={pushingScope === "mod."}
            onDiscardOne={discardPending}
            onDiscardAll={() => discardScope("mod.")}
            onPush={() => pushScope("mod.")} />
        </window.Card>

        <window.Card title="System state"
          hint="Non-standard flags surfaced by the TOMS agent.">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <EditableFlagRow label="Terminal lock"
              positive={!t.state.terminalLocked}
              positiveLabel="Unlocked"
              negativeLabel="Locked (admin only)"
              tone="warning"
              pending={pending["state.lock"]}
              onEdit={() => openEdit({ id: "state.lock", label: "Terminal lock",
                from: t.state.terminalLocked ? "Locked" : "Unlocked",
                to:   t.state.terminalLocked ? "Unlocked" : "Locked" })} />
            <EditableFlagRow label="Status bar pull"
              positive={t.state.statusBarPulldown}
              positiveLabel="Enabled"
              negativeLabel="Disabled — locked-down"
              pending={pending["state.statusBar"]}
              onEdit={() => openEdit({ id: "state.statusBar", label: "Status bar pull",
                from: t.state.statusBarPulldown ? "Enabled" : "Disabled",
                to:   t.state.statusBarPulldown ? "Disabled" : "Enabled" })} />
            <EditableFlagRow label="Unattended mode"
              positive={!t.state.unattendedMode}
              positiveLabel="Off (attended)"
              negativeLabel="On — kiosk-style"
              pending={pending["state.unattended"]}
              onEdit={() => openEdit({ id: "state.unattended", label: "Unattended mode",
                from: t.state.unattendedMode ? "On" : "Off",
                to:   t.state.unattendedMode ? "Off" : "On" })} />
            <EditableFlagRow label="Dev unit"
              positive={t.state.devUnit === 0}
              positiveLabel="User unit (0)"
              negativeLabel="Dev unit (1)"
              tone="warning"
              readOnly />
          </div>
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
              System parameters
            </div>
            <div style={{
              padding: "8px 10px",
              background: "var(--bg2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
              rowGap: 5, columnGap: 12,
            }}>
              {Object.entries(t.state.sysParams).map(([k, v]) => (
                <React.Fragment key={k}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--fg1)", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <PendingFooter
            items={Object.values(pending).filter((c) => c.id.startsWith("state."))}
            pushing={pushingScope === "state."}
            onDiscardOne={discardPending}
            onDiscardAll={() => discardScope("state.")}
            onPush={() => pushScope("state.")} />
        </window.Card>
      </div>

      <MonSystemSettingsCard t={t} autoTime={autoTime} autoTz={autoTz}
        openEdit={openEdit} pending={pending}
        pushingScope={pushingScope}
        discardPending={discardPending}
        discardScope={discardScope}
        pushScope={pushScope} />

      {/* Apps & Firmware is only relevant inside a ticket workbench, where
          the operator is actively triaging an issue. Hidden on the
          standalone Devices → Detail → Monitoring view because there's a
          dedicated "Apps & Firmware" tab right next to it. */}
      {ticket && <MonAppsFirmwareCard device={device} />}

      <window.Card title="Security & uptime detail"
        hint="Attack counters and runtime history. Headline status is in the strip above."
        action={
          <button type="button" onClick={() => setSecOpen(!secOpen)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border-1)",
              borderRadius: 6, cursor: "pointer",
              fontSize: 12, color: "var(--fg2)", fontWeight: 500,
            }}>
            <window.Ico name={secOpen ? "chevd" : "chevr"} size={12} />
            {secOpen ? "Collapse" : "Expand"}
          </button>
        }>
        {!secOpen && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
          }}>
            <span>
              <span style={{ color: "var(--fg2)" }}>Triggers</span> · {t.security.status === 1
                ? <span className="mono" style={{ color: "var(--color-warning-700)", fontWeight: 500 }}>
                    Fired{t.security.reasons.length > 0 ? ` · ${t.security.reasons.length}` : ""}
                  </span>
                : <span className="mono" style={{ color: "var(--color-success-700)" }}>OK</span>}
            </span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>HW attacks</span> · <span className="mono num" style={{ color: t.security.hwAttackCount > 10 ? "var(--color-warning-700)" : "var(--fg1)" }}>{t.security.hwAttackCount}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>SW attacks</span> · <span className="mono num" style={{ color: t.security.swAttackCount > 5 ? "var(--color-warning-700)" : "var(--fg1)" }}>{t.security.swAttackCount}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>Root</span> · <span className="mono" style={{ color: t.security.rooted ? "var(--color-error-700)" : "var(--color-success-700)", fontWeight: 500 }}>{t.security.rooted ? "Rooted" : "OK"}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>Session</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{fmtDuration(t.uptime.sessionSec)}</span></span>
          </div>
        )}
        {secOpen && (<>
        {t.security.status === 1 && t.security.reasons.length > 0 && (
          <div style={{
            padding: "8px 12px", marginBottom: 12,
            background: "var(--warning-bg)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 28%, transparent)",
            borderRadius: "var(--radius-md)",
            display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "var(--color-warning-700)", fontWeight: 500, marginRight: 4 }}>
              Trigger reasons:
            </span>
            {t.security.reasons.map(r => (
              <span key={r} className="mono" style={{
                fontSize: 11, padding: "2px 7px", borderRadius: 4,
                background: "var(--color-bg-1)", color: "var(--color-warning-700)",
                border: "1px solid color-mix(in oklab, var(--color-warning-500) 30%, transparent)",
                fontWeight: 500, letterSpacing: "0.02em",
              }}>{r}</span>
            ))}
          </div>
        )}
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <StatTile label="Hardware attacks"
            value={t.security.hwAttackCount}
            sub="cumulative"
            tone={t.security.hwAttackCount > 10 ? "warning" : null} />
          <StatTile label="Software attacks"
            value={t.security.swAttackCount}
            sub="cumulative"
            tone={t.security.swAttackCount > 5 ? "warning" : null} />
          <StatTile label="Root state"
            value={t.security.rooted ? "Rooted" : "Not rooted"}
            sub={t.security.rooted ? "Device compromised" : "Integrity intact"}
            tone={t.security.rooted ? "danger" : "success"}
            mono={false} />
        </div>
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px dashed var(--color-border-subtle)",
          display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12,
        }}>
          <StatTile label="Session uptime"
            value={fmtDuration(t.uptime.sessionSec)} sub="since last boot" />
          <StatTile label="Today"
            value={fmtDuration(t.uptime.todaySec)} sub="00:00 → now" />
          <StatTile label="Cumulative"
            value={fmtDuration(t.uptime.cumulativeSec)} sub="lifetime runtime" />
          <StatTile label="Last boot"
            value={t.uptime.bootDate || "—"}
            sub={t.uptime.bootEpoch ? `epoch ${t.uptime.bootEpoch}` : "Pending activation"}
            mono={false}
            valueFont={11.5} />
        </div>
        </>)}
      </window.Card>

      {/* ── Tier D — detail telemetry & config ────────────── */}
      {/* Available SSIDs for the Wi-Fi edit dialog. Saved networks are
          guaranteed real; we tack on a couple of likely retail-floor
          discovered SSIDs so the picker has variety. */}
      {(() => null)()}
      <window.Card title="Network & connectivity"
        hint="Per-interface IPs and signal strength. Primary already in the strip."
        action={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <window.Pill tone={t.network.type === "Offline" ? "warning" : "info"} dot size="sm">
              Primary · {t.network.type}
            </window.Pill>
            <button type="button" onClick={() => setNetOpen(!netOpen)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--border-1)",
                borderRadius: 6, cursor: "pointer",
                fontSize: 12, color: "var(--fg2)", fontWeight: 500,
              }}>
              <window.Ico name={netOpen ? "chevd" : "chevr"} size={12} />
              {netOpen ? "Collapse" : "Expand"}
            </button>
          </div>
        }>
        {!netOpen && (() => {
          const rows = [
            t.network.wifi.on && { label: "Wi-Fi",
              tag: t.network.wifi.ssid || null, ip: t.network.wifi.ip,
              primary: t.network.type === "WIFI" },
            t.network.cellular.on && { label: "Cellular",
              tag: t.network.cellular.carrier || null, ip: t.network.cellular.ip,
              primary: t.network.type === "Cellular" },
            t.network.ethernet.on && { label: "Ethernet",
              tag: null, ip: t.network.ethernet.ip,
              primary: t.network.type === "Ethernet" },
            t.network.bluetooth.on && { label: "Bluetooth", tag: null, ip: null, primary: false },
          ].filter(Boolean);
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
            }}>
              {rows.length === 0 && (
                <span style={{ color: "var(--color-warning-700)", fontWeight: 500 }}>
                  No active interfaces — device offline
                </span>
              )}
              {rows.map((r, i) => (
                <React.Fragment key={r.label}>
                  {i > 0 && <span style={{ color: "var(--color-border-default)" }}>·</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: r.primary ? "var(--color-primary-500)" : "var(--color-success-500)",
                    }} />
                    <span style={{ color: "var(--fg1)", fontWeight: r.primary ? 500 : 400 }}>{r.label}</span>
                    {r.tag && <span className="mono" style={{ color: "var(--fg2)" }}>{r.tag}</span>}
                    {r.ip && <span className="mono" style={{ color: "var(--fg3)" }}>{r.ip}</span>}
                  </span>
                </React.Fragment>
              ))}
            </div>
          );
        })()}
        {netOpen && (<>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <InterfaceRow
            label="Wi-Fi" icon="link"
            on={t.network.wifi.on} primary={t.network.type === "WIFI"}
            ip={t.network.wifi.ip} signalDbm={t.network.wifi.signalDbm}
            badges={t.network.wifi.on ? [
              t.network.wifi.ssid && { label: "SSID", value: t.network.wifi.ssid, mono: true },
              t.network.wifi.linkMbps && { label: "Link", value: `${t.network.wifi.linkMbps} Mbps` },
              t.network.wifi.security && { label: "Security", value: t.network.wifi.security },
            ].filter(Boolean) : []}
            onEdit={() => {
              // Build SSID picker from saved networks + a couple of common
              // retail-floor discovered names.
              const saved = (t.location.savedWifi || [])
                .map(w => w.ssid).filter(s => s && s !== "—");
              const discovered = ["TOMS-Public", "Guest"];
              const options = Array.from(new Set(
                [t.network.wifi.ssid, ...saved, ...discovered].filter(Boolean)
              ));
              setConfirm({
                id: "net.wifi", label: "Wi-Fi", kind: "wifi",
                options,
                from: t.network.wifi.on
                  ? `Enabled · ${t.network.wifi.ssid || "—"}`
                  : "Disabled",
                to: {
                  enabled: t.network.wifi.on,
                  ssid: t.network.wifi.ssid || options[0] || "",
                  password: "",
                },
              });
            }} />
          <InterfaceRow
            label="Mobile data" icon="bolt"
            on={t.network.cellular.on} primary={t.network.type === "Cellular"}
            ip={t.network.cellular.ip} signalDbm={t.network.cellular.signalDbm}
            badges={t.network.cellular.on ? [
              t.network.cellular.carrier && { label: "Carrier", value: t.network.cellular.carrier },
              t.network.cellular.network && { label: "Network", value: t.network.cellular.network },
              t.network.defaultApn && { label: "APN", value: t.network.defaultApn, mono: true },
            ].filter(Boolean) : []}
            onEdit={() => setConfirm({
              id: "net.cellular", label: "Mobile data", kind: "toggle",
              from: t.network.cellular.on ? "Enabled" : "Disabled",
              to:   t.network.cellular.on ? "Disabled" : "Enabled",
            })} />
          <InterfaceRow
            label="Ethernet" icon="box"
            on={t.network.ethernet.on} primary={t.network.type === "Ethernet"}
            ip={t.network.ethernet.ip}
            badges={t.network.ethernet.on ? [
              t.network.ethernet.linkMbps && { label: "Link",
                value: `${t.network.ethernet.linkMbps} Mbps ${t.network.ethernet.duplex}-duplex` },
            ].filter(Boolean) : []}
            onEdit={() => setConfirm({
              id: "net.ethernet", label: "Ethernet", kind: "toggle",
              from: t.network.ethernet.on ? "Enabled" : "Disabled",
              to:   t.network.ethernet.on ? "Disabled" : "Enabled",
            })} />
          <InterfaceRow label="Bluetooth" icon="link"
            on={t.network.bluetooth.on} badges={[]}
            onEdit={() => setConfirm({
              id: "net.bluetooth", label: "Bluetooth", kind: "toggle",
              from: t.network.bluetooth.on ? "Enabled" : "Disabled",
              to:   t.network.bluetooth.on ? "Disabled" : "Enabled",
            })} />
        </div>
        {t.network.apnConfig && (
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <button type="button" onClick={() => setApnOpen(!apnOpen)}
              style={{
                background: "transparent", border: 0, padding: 0, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "var(--fg2)", fontWeight: 500,
              }}>
              <window.Ico name={apnOpen ? "chevd" : "chevr"} size={12} />
              Full APN configuration
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--fg3)", fontWeight: 400 }}>
                · {Object.keys(t.network.apnConfig).filter(k => t.network.apnConfig[k] !== "").length} fields set
              </span>
            </button>
            {apnOpen && (
              <div style={{
                marginTop: 10, padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--radius-md)",
                display: "grid",
                gridTemplateColumns: "120px minmax(0, 1fr)",
                rowGap: 6, columnGap: 12,
              }}>
                {Object.entries(t.network.apnConfig).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="overline" style={{ fontSize: 9.5, paddingTop: 1 }}>{k}</span>
                    <span className="mono" style={{ fontSize: 12, color: v ? "var(--fg1)" : "var(--fg3)" }}>
                      {v || "—"}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
        </>)}
      </window.Card>

      {/* ── Tier E — minor / on-demand ────────────────────── */}
      <window.Card title={`Event log · ${events.length}`}
        hint="Device-side events the agent has uploaded — newest first."
        action={
          <button type="button" onClick={() => setEvtOpen(!evtOpen)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border-1)",
              borderRadius: 6, cursor: "pointer",
              fontSize: 12, color: "var(--fg2)", fontWeight: 500,
            }}>
            <window.Ico name={evtOpen ? "chevd" : "chevr"} size={12} />
            {evtOpen ? "Collapse" : "Expand"}
          </button>
        }>
        {!evtOpen && (() => {
          const latest = events[0];
          const latestMeta = latest ? (EVENT_KIND[latest.kind] || EVENT_KIND["app-install"]) : null;
          // Bucketed counts so the summary is genuinely informative.
          const counts = events.reduce((acc, e) => {
            acc[e.kind] = (acc[e.kind] || 0) + 1; return acc;
          }, {});
          const buckets = Object.entries(counts)
            .map(([k, n]) => ({ kind: k, n, meta: EVENT_KIND[k] || EVENT_KIND["app-install"] }))
            .sort((a, b) => b.n - a.n)
            .slice(0, 4);
          if (events.length === 0) {
            return (
              <div style={{ padding: "2px 0", fontSize: 12.5, color: "var(--fg3)" }}>
                No events recorded yet.
              </div>
            );
          }
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
            }}>
              {latest && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: latestMeta.bg, color: latestMeta.color,
                    border: `1px solid ${latestMeta.border}`,
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
                    <window.Ico name={latestMeta.icon} size={9} stroke={1.8} />
                  </span>
                  <span>
                    <span style={{ color: "var(--fg2)" }}>Latest</span> ·{" "}
                    <span style={{ color: "var(--fg1)", fontWeight: 500 }}>{latestMeta.label}</span>
                    {" "}<span className="mono" style={{ color: "var(--fg3)" }}>{latest.at}</span>
                  </span>
                </span>
              )}
              {buckets.length > 0 && <>
                <span style={{ color: "var(--color-border-default)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {buckets.map((b, i) => (
                    <span key={b.kind} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 999,
                      background: b.meta.bg, color: b.meta.color,
                      border: `1px solid ${b.meta.border}`,
                      fontSize: 11, fontWeight: 500,
                    }}>
                      <window.Ico name={b.meta.icon} size={9} stroke={1.8} />
                      {b.meta.label}
                      <span className="mono num" style={{ marginLeft: 2 }}>{b.n}</span>
                    </span>
                  ))}
                </span>
              </>}
            </div>
          );
        })()}
        {evtOpen && (
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((e, i) => {
            const meta = EVENT_KIND[e.kind] || EVENT_KIND["app-install"];
            return (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                paddingBottom: i < events.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: meta.bg, color: meta.color,
                    display: "grid", placeItems: "center",
                    border: `1px solid ${meta.border}`,
                  }}><window.Ico name={meta.icon} size={11} stroke={1.8} /></span>
                  {i < events.length - 1 && (
                    <span style={{ width: 1, flex: 1, marginTop: 2,
                      background: "var(--color-border-subtle)", minHeight: 16 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>{meta.label}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{e.at}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--fg3)", lineHeight: 1.55 }}>
                    {e.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        )}
      </window.Card>

      {/* SIM data usage — only meaningful for cellular devices */}
      {simTraffic && <SimTrafficCard data={simTraffic} />}

      {/* Live memory probe removed per teammate feedback (was here)
      <window.Card title="Live memory probe"
        hint="On-demand process snapshot. The device must be online."
        action={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {memOpen && (
              <window.Button size="sm" primary icon="refresh"
                disabled={memState === "loading"}
                onClick={fetchMemory}>
                {memState === "done" ? "Re-fetch" : memState === "loading" ? "Fetching…" : "Fetch live memory"}
              </window.Button>
            )}
            <button type="button" onClick={() => setMemOpen(!memOpen)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--border-1)",
                borderRadius: 6, cursor: "pointer",
                fontSize: 12, color: "var(--fg2)", fontWeight: 500,
              }}>
              <window.Ico name={memOpen ? "chevd" : "chevr"} size={12} />
              {memOpen ? "Collapse" : "Expand"}
            </button>
          </div>
        }>
        {!memOpen && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
          }}>
            {memState === "idle" && (
              <span>
                <span style={{ color: "var(--fg2)" }}>Snapshot</span> · <span style={{ color: "var(--fg1)" }}>not fetched</span>
              </span>
            )}
            {memState === "loading" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Spinner size={12} />
                <span style={{ color: "var(--fg2)" }}>Asking the device…</span>
              </span>
            )}
            {memState === "error" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-error-700)", fontWeight: 500 }}>
                <window.Ico name="alert" size={12} />
                Device offline — can't probe live memory
              </span>
            )}
            {memState === "done" && memData && (() => {
              const top = [...memData].sort((a, b) => b.memMB - a.memMB)[0];
              const total = memData.reduce((s, p) => s + p.memMB, 0);
              return (<>
                <span><span style={{ color: "var(--fg2)" }}>Processes</span> · <span className="mono num" style={{ color: "var(--fg1)" }}>{memData.length}</span></span>
                <span style={{ color: "var(--color-border-default)" }}>·</span>
                <span><span style={{ color: "var(--fg2)" }}>Total</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{total}</span> <span style={{ color: "var(--fg3)" }}>MB</span></span>
                {top && <>
                  <span style={{ color: "var(--color-border-default)" }}>·</span>
                  <span><span style={{ color: "var(--fg2)" }}>Top</span> · <span style={{ color: "var(--fg1)" }}>{top.name}</span> <span className="mono" style={{ color: "var(--fg2)" }}>{top.memMB} MB</span></span>
                </>}
              </>);
            })()}
            <div style={{ flex: 1 }} />
            {memState !== "loading" && (
              <window.Button size="sm" ghost icon="refresh"
                onClick={() => { setMemOpen(true); fetchMemory(); }}>
                {memState === "done" ? "Re-fetch" : "Fetch"}
              </window.Button>
            )}
          </div>
        )}
        {memOpen && (<>
        {memState === "idle" && (
          <div style={{
            padding: "20px 14px", textAlign: "center",
            background: "var(--bg2)",
            border: "1px dashed var(--color-border-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--fg3)",
          }}>
            Press <b>Fetch live memory</b> to request a snapshot from this device.
          </div>
        )}
        {memState === "loading" && (
          <div style={{
            padding: "20px 14px", textAlign: "center",
            background: "var(--bg2)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--fg2)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Spinner size={14} /> Asking the device…
          </div>
        )}
        {memState === "error" && (
          <div style={{
            padding: "12px 14px",
            background: "var(--error-bg)",
            border: "1px solid color-mix(in oklab, var(--color-error-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--color-error-700)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <window.Ico name="alert" size={14} />
            Device is offline — live memory can't be probed right now.
          </div>
        )}
        {memState === "done" && memData && (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Process", "PID", "Memory"].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 12px", fontSize: 11, fontWeight: 500,
                      color: "var(--fg3)", textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background: "var(--bg3)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...memData].sort((a, b) => b.memMB - a.memMB).map((p, i) => (
                  <tr key={p.pid} style={{ borderBottom: i < memData.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                    <td style={{ padding: "9px 12px", fontSize: 12.5 }}>{p.name}</td>
                    <td style={{ padding: "9px 12px" }}><span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{p.pid}</span></td>
                    <td style={{ padding: "9px 12px" }}><span className="mono" style={{ fontWeight: 500 }}>{p.memMB}</span> <span style={{ color: "var(--fg3)" }}>MB</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </window.Card>
      */}

      {/* ── Location telemetry (collapsed by default — minor) ─── */}
      <window.Card title="Location telemetry"
        hint="Nearby cell towers, Wi-Fi access points & fix-success history."
        action={
          <button type="button" onClick={() => setLocOpen(!locOpen)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border-1)",
              borderRadius: 6, cursor: "pointer",
              fontSize: 12, color: "var(--fg2)", fontWeight: 500,
            }}>
            <window.Ico name={locOpen ? "chevd" : "chevr"} size={12} />
            {locOpen ? "Collapse" : "Expand"}
          </button>
        }>
        {!locOpen && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "2px 0", fontSize: 12.5, color: "var(--fg3)",
          }}>
            <span><span style={{ color: "var(--fg2)" }}>Provider</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{t.location.provider}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>Coords</span> · <span className="mono" style={{ color: "var(--fg1)" }}>{t.location.coords.lat.toFixed(4)}, {t.location.coords.lng.toFixed(4)}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>Cell towers</span> · <span className="mono num" style={{ color: "var(--fg1)" }}>{t.location.cellTowers.length}</span></span>
            <span style={{ color: "var(--color-border-default)" }}>·</span>
            <span><span style={{ color: "var(--fg2)" }}>Wi-Fi APs</span> · <span className="mono num" style={{ color: "var(--fg1)" }}>{t.location.nearbyWifi.length}</span></span>
          </div>
        )}
        {locOpen && (<>
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <SwitchRow label="Assist provider" value={t.location.provider} />
            <SwitchRow label="Coordinates"
              value={`${t.location.coords.lat.toFixed(4)}, ${t.location.coords.lng.toFixed(4)}`}
              mono />
          </div>
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>Fix success — last 2 days</div>
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Date", "SDK", "Success", "Failed", "Rate"].map((h, i) => (
                      <th key={i} style={{
                        padding: "6px 12px", fontSize: 10.5, fontWeight: 500,
                        color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.05em",
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[t.location.today, t.location.yesterday].map((d, i) => {
                    const total = d.successCount + d.failCount;
                    const rate = total > 0 ? Math.round((d.successCount / total) * 100) : 0;
                    return (
                      <tr key={i} style={{ borderBottom: i === 0 ? "1px solid var(--color-border-subtle)" : "none" }}>
                        <td style={{ padding: "8px 12px" }}><span className="mono">{d.date}</span></td>
                        <td style={{ padding: "8px 12px" }}>{d.sdk}</td>
                        <td style={{ padding: "8px 12px" }}><span className="mono" style={{ color: "var(--color-success-700)" }}>{d.successCount}</span></td>
                        <td style={{ padding: "8px 12px" }}><span className="mono" style={{ color: "var(--color-error-700)" }}>{d.failCount}</span></td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className="mono" style={{ color: rate >= 80 ? "var(--color-success-700)" : "var(--color-warning-700)" }}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14,
          }}>
            <div>
              <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
                Cell towers · <span className="mono num">{t.location.cellTowers.length}</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 4 }}>
                {t.location.cellTowers.map((c, i) => (
                  <li key={i} style={{ display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: "5px 8px",
                    background: "var(--bg2)", border: "1px solid var(--border-1)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 11.5, color: "var(--fg2)",
                  }}>
                    <span><span style={{ color: "var(--fg3)" }}>cid </span><span className="mono">{c.cid}</span></span>
                    <span><span style={{ color: "var(--fg3)" }}>lac </span><span className="mono">{c.lac}</span></span>
                    <span><span style={{ color: "var(--fg3)" }}>mcc </span><span className="mono">{c.mcc}</span></span>
                    <span><span style={{ color: "var(--fg3)" }}>mnc </span><span className="mono">{c.mnc}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
                Nearby Wi-Fi · <span className="mono num">{t.location.nearbyWifi.length}</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 4 }}>
                {t.location.nearbyWifi.map((w, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "5px 8px",
                    background: "var(--bg2)", border: "1px solid var(--border-1)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 11.5, color: "var(--fg2)",
                  }}>
                    <span className="mono" style={{ flex: 1, color: "var(--fg1)" }}>{w.mac}</span>
                    <SignalBars dbm={w.level} />
                    <span className="mono" style={{ width: 48, textAlign: "right",
                      color: w.level > -50 ? "var(--color-success-700)"
                           : w.level > -70 ? "var(--fg2)"
                                           : "var(--color-warning-700)" }}>
                      {w.level} dBm
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {t.location.savedWifi.length > 0 && (
            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: "1px dashed var(--color-border-subtle)",
            }}>
              <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>
                Previously connected · <span className="mono num">{t.location.savedWifi.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {t.location.savedWifi.map((w, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 999,
                    background: "var(--bg3)", border: "1px solid var(--border-1)",
                    fontSize: 11.5, color: "var(--fg1)",
                  }}>
                    <window.Ico name="link" size={10} stroke={1.8} style={{ color: "var(--fg3)" }} />
                    {w.ssid}
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{w.level} dBm</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>)}
      </window.Card>

      <window.ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? <>Change · <span className="mono">{confirm.label}</span>?</> : ""}
        body={confirm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* From → To preview (skipped for Wi-Fi multi-field changes) */}
            {confirm.kind !== "wifi" && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10, alignSelf: "start",
                padding: "10px 14px",
                background: "var(--bg2)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--radius-md)",
                maxWidth: "100%",
              }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--fg3)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {confirm.from}
                </span>
                <window.Ico name="chevr" size={12} style={{ color: "var(--fg3)", flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: 13, fontWeight: 600,
                  color: "var(--color-primary-700)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {String(confirm.to)}{confirm.kind === "slider" && confirm.unit ? confirm.unit : ""}
                </span>
              </div>
            )}

            {/* Toggle kind — Enable / Disable pill pair */}
            {confirm.kind === "toggle" && (
              <div style={{ display: "flex", gap: 8 }}>
                {["Enabled", "Disabled"].map(v => {
                  const on = v === confirm.to;
                  return (
                    <button key={v} type="button"
                      onClick={() => setConfirm(c => c ? { ...c, to: v } : c)}
                      style={{
                        padding: "8px 16px", borderRadius: 999,
                        background: on ? "var(--color-primary-50)" : "var(--bg2)",
                        border: "1px solid",
                        borderColor: on ? "var(--color-primary-500)" : "var(--border-1)",
                        color: on ? "var(--color-primary-700)" : "var(--fg1)",
                        fontSize: 13, fontWeight: on ? 600 : 500,
                        cursor: "pointer",
                      }}>
                      {v}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Wi-Fi kind — toggle + SSID picker + password */}
            {confirm.kind === "wifi" && (() => {
              const v = confirm.to || {};
              const setTo = (patch) => setConfirm(c =>
                c ? { ...c, to: { ...(c.to || {}), ...patch } } : c);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Enable Wi-Fi */}
                  <div>
                    <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
                      Wi-Fi
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ k: true, l: "On" }, { k: false, l: "Off" }].map(o => {
                        const on = v.enabled === o.k;
                        return (
                          <button key={String(o.k)} type="button"
                            onClick={() => setTo({ enabled: o.k })}
                            style={{
                              padding: "6px 14px", borderRadius: 999,
                              background: on ? "var(--color-primary-50)" : "var(--bg2)",
                              border: "1px solid",
                              borderColor: on ? "var(--color-primary-500)" : "var(--border-1)",
                              color: on ? "var(--color-primary-700)" : "var(--fg1)",
                              fontSize: 12, fontWeight: on ? 600 : 500,
                              cursor: "pointer",
                            }}>
                            {o.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Network picker — only when enabling */}
                  {v.enabled && (
                    <div>
                      <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
                        Network · pick from discovered
                      </div>
                      <div style={{
                        maxHeight: 180, overflowY: "auto",
                        border: "1px solid var(--border-1)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg2)",
                      }}>
                        {(confirm.options || []).map((s, i) => {
                          const on = s === v.ssid;
                          return (
                            <button key={s} type="button"
                              onClick={() => setTo({ ssid: s })}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                width: "100%", padding: "8px 12px",
                                background: on ? "var(--color-primary-50)" : "transparent",
                                border: 0,
                                borderTop: i === 0 ? "none" : "1px solid var(--color-border-subtle)",
                                cursor: "pointer", textAlign: "left",
                              }}>
                              <span style={{
                                width: 14, height: 14, borderRadius: "50%",
                                border: "2px solid",
                                borderColor: on ? "var(--color-primary-500)" : "var(--border-default)",
                                background: on ? "var(--color-primary-500)" : "transparent",
                                flexShrink: 0,
                                boxShadow: on
                                  ? "inset 0 0 0 3px var(--color-bg-1)" : "none",
                              }} />
                              <span className="mono" style={{ flex: 1, fontSize: 12.5,
                                color: on ? "var(--color-primary-700)" : "var(--fg1)",
                                fontWeight: on ? 600 : 500 }}>
                                {s}
                              </span>
                              <window.Ico name="link" size={10} stroke={1.8}
                                style={{ color: "var(--fg3)" }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Password — only when enabling and a network is selected */}
                  {v.enabled && v.ssid && (
                    <div>
                      <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>
                        Password <span style={{ color: "var(--fg3)",
                          textTransform: "none", letterSpacing: 0, fontSize: 10.5 }}>
                          · leave blank for open networks
                        </span>
                      </div>
                      <input type="password" autoComplete="off"
                        value={v.password || ""}
                        onChange={(e) => setTo({ password: e.target.value })}
                        placeholder="••••••••"
                        style={{
                          width: "100%", padding: "8px 12px", fontSize: 13,
                          background: "var(--color-bg-1)",
                          border: "1px solid var(--border-1)",
                          borderRadius: "var(--radius-md)",
                          color: "var(--fg1)",
                          fontFamily: "var(--font-family-mono)",
                          letterSpacing: "0.1em",
                        }} />
                    </div>
                  )}

                  {/* Summary chip — visual confirmation of the queued change */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", alignSelf: "start",
                    background: "var(--color-primary-50)",
                    border: "1px solid color-mix(in oklab, var(--color-primary-500) 35%, transparent)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12,
                  }}>
                    <span style={{ color: "var(--fg2)" }}>Will push:</span>
                    <span className="mono" style={{ color: "var(--color-primary-700)", fontWeight: 600 }}>
                      {v.enabled
                        ? `Wi-Fi on · ${v.ssid || "—"}${v.password ? " · password set" : ""}`
                        : "Wi-Fi off"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Input control — varies by kind */}
            {confirm.kind === "select" && confirm.options && (
              confirm.options.some(o => String(o).length > 18) ? (
                <select
                  value={confirm.to}
                  onChange={(e) => setConfirm(c => c ? { ...c, to: e.target.value } : c)}
                  style={{
                    padding: "8px 12px", fontSize: 13,
                    background: "var(--color-bg-1)",
                    border: "1px solid var(--border-1)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--fg1)",
                    fontFamily: "var(--font-family-mono)",
                  }}>
                  {confirm.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {confirm.options.map(o => {
                    const on = o === confirm.to;
                    return (
                      <button key={o} type="button"
                        onClick={() => setConfirm(c => c ? { ...c, to: o } : c)}
                        style={{
                          padding: "6px 12px", borderRadius: 999,
                          background: on ? "var(--color-primary-50)" : "var(--bg2)",
                          border: "1px solid",
                          borderColor: on ? "var(--color-primary-500)" : "var(--border-1)",
                          color: on ? "var(--color-primary-700)" : "var(--fg1)",
                          fontSize: 12, fontWeight: on ? 600 : 400,
                          fontFamily: "var(--font-family-mono)",
                          cursor: "pointer",
                        }}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {confirm.kind === "slider" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={0} max={confirm.max || 100}
                  value={confirm.to}
                  onChange={(e) => setConfirm(c => c ? { ...c, to: Number(e.target.value) } : c)}
                  style={{ flex: 1, accentColor: "var(--color-primary-500)" }} />
                <span className="mono" style={{ fontSize: 13, fontWeight: 500,
                  minWidth: 50, textAlign: "right" }}>
                  {confirm.to}{confirm.unit || ""}
                </span>
              </div>
            )}

            <div style={{ fontSize: 12.5, color: "var(--fg3)", lineHeight: 1.5 }}>
              {isBatchableId(confirm.id) ? (
                <>Stages this change into the pending batch. Review and push
                  all changes to <span className="mono">{device.sn}</span> in
                  one tap.</>
              ) : (
                <>The change is sent to <span className="mono">{device.sn}</span> immediately
                  and recorded on the ticket timeline. Effective on the device within
                  a few seconds.</>
              )}
            </div>
          </div>
        ) : ""}
        confirmLabel={confirm && isBatchableId(confirm.id) ? "Stage change" : "Push"}
        onConfirm={stageOrPush} />
    </div>
  );
}

const EVENT_KIND = {
  boot:            { label: "Boot",            icon: "refresh",  color: "var(--color-info-700)",    bg: "var(--color-info-50)",    border: "color-mix(in oklab, var(--color-info-500) 22%, transparent)" },
  "app-install":   { label: "App installed",   icon: "download", color: "var(--color-success-700)", bg: "oklch(96% 0.03 152)",     border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)" },
  "app-update":    { label: "App updated",     icon: "upload",   color: "var(--color-success-700)", bg: "oklch(96% 0.03 152)",     border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)" },
  "app-uninstall": { label: "App uninstalled", icon: "trash",    color: "var(--color-warning-700)", bg: "var(--warning-bg)",        border: "color-mix(in oklab, var(--color-warning-500) 22%, transparent)" },
  "net-change":    { label: "Network change",  icon: "link",     color: "var(--fg2)",                bg: "var(--color-bg-3)",        border: "var(--color-border-subtle)" },
};

// ─── Tab 4: Pre-warning ───────────────────────────────────
function DevicePrewarningTab({ device }) {
  const initial = useMemoD(() => prewarningFor(device), [device]);
  const [policies, setPolicies] = useStateD(initial);
  useEffectD(() => { setPolicies(initial); }, [device.sn]); // reset when navigating
  const events = useMemoD(() => prewarningEventsFor(device), [device]);

  const updatePolicy = (kind, patch) => {
    setPolicies(prev => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
    window.showToast?.(`Pre-warning · ${PREWARNING_KIND_LABEL[kind]} updated`, "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Policy cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <PolicyCard kind="traffic"
          label="Cellular data"
          icon="bolt"
          description="Alert when monthly cellular usage crosses a threshold. Helps catch runaway costs."
          assignment={policies.traffic}
          options={PREWARNING_POLICIES.traffic}
          onChange={(p) => updatePolicy("traffic", p)} />
        <PolicyCard kind="geofence"
          label="Geofence"
          icon="shield"
          description="Alert when the device moves outside an allowed area. Useful for catching theft or unauthorized relocation."
          assignment={policies.geofence}
          options={PREWARNING_POLICIES.geofence}
          onChange={(p) => updatePolicy("geofence", p)} />
        <PolicyCard kind="disk"
          label="Disk space"
          icon="box"
          description="Alert when free disk space drops below a threshold. Prevents app installs failing on full devices."
          assignment={policies.disk}
          options={PREWARNING_POLICIES.disk}
          onChange={(p) => updatePolicy("disk", p)} />
      </div>

      {/* Triggered events */}
      <window.Card title={`Triggered alerts · ${events.length}`}
        hint="Pre-warning policies that fired for this device. New alerts also surface in the global Alerts feed.">
        {events.length === 0 ? (
          <div style={{
            padding: "20px 14px", textAlign: "center",
            fontSize: 12.5, color: "var(--fg3)",
            background: "var(--bg2)",
            border: "1px dashed var(--color-border-subtle)",
            borderRadius: "var(--radius-md)",
          }}>
            No alerts triggered for this device.
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Kind", "Policy", "Triggered", "Severity", "Detail"].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 12px", fontSize: 11, fontWeight: 500,
                      color: "var(--fg3)", textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background: "var(--bg3)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => {
                  const levelMeta = e.level === "critical" ? { tone: "danger",  label: "Critical" }
                                  : e.level === "warning"  ? { tone: "warning", label: "Warning"  }
                                                            : { tone: "info",    label: "Info"     };
                  const kindIcon = e.kind === "traffic"  ? "bolt"
                                 : e.kind === "geofence" ? "shield"
                                 : e.kind === "disk"     ? "box" : "bell";
                  return (
                    <tr key={i} style={{ borderBottom: i < events.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                      <td style={{ padding: "10px 12px", textTransform: "capitalize", color: "var(--fg2)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <window.Ico name={kindIcon} size={11} stroke={1.8} />{e.kind}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 500 }}>{e.policy}</td>
                      <td style={{ padding: "10px 12px", color: "var(--fg2)" }}>
                        <span className="mono" style={{ fontSize: 11.5 }}>{e.at}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <window.Pill tone={levelMeta.tone} dot size="sm">{levelMeta.label}</window.Pill>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg2)" }}>{e.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </window.Card>
    </div>
  );
}

const PREWARNING_KIND_LABEL = {
  traffic: "Cellular data", geofence: "Geofence", disk: "Disk space",
};

function PolicyCard({ kind, label, icon, description, assignment, options, onChange }) {
  const current = options.find(o => o.id === assignment.policyId) || options[0];
  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-1)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: assignment.enabled ? "var(--color-primary-50)" : "var(--bg3)",
          color: assignment.enabled ? "var(--color-primary-700)" : "var(--fg3)",
          display: "grid", placeItems: "center", flexShrink: 0,
          border: "1px solid",
          borderColor: assignment.enabled ? "color-mix(in oklab, var(--color-primary-500) 25%, transparent)" : "var(--border-1)",
        }}>
          <window.Ico name={icon} size={14} stroke={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        </div>
        {/* Enabled toggle */}
        <button onClick={() => onChange({ enabled: !assignment.enabled })} style={{
          width: 34, height: 18, borderRadius: 999, padding: 0,
          background: assignment.enabled ? "var(--color-primary-600)" : "var(--color-bg-3)",
          border: "1px solid",
          borderColor: assignment.enabled ? "var(--color-primary-600)" : "var(--color-border-default)",
          position: "relative", cursor: "pointer",
          flexShrink: 0,
        }} aria-label={assignment.enabled ? "Disable" : "Enable"}>
          <span style={{
            position: "absolute", top: 1, left: assignment.enabled ? 17 : 1,
            width: 14, height: 14, borderRadius: "50%",
            background: "white",
            transition: "left .15s ease",
          }} />
        </button>
      </div>

      {/* Description */}
      <div style={{ fontSize: 11.5, color: "var(--fg3)", lineHeight: 1.55 }}>{description}</div>

      {/* Policy select */}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="overline" style={{ fontSize: 9.5 }}>Active policy</span>
        <select value={assignment.policyId}
          onChange={(e) => onChange({ policyId: e.target.value })}
          disabled={!assignment.enabled}
          style={{
            ...selectStyle, opacity: assignment.enabled ? 1 : 0.5,
            cursor: assignment.enabled ? "pointer" : "not-allowed",
          }}>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>

      {/* Active policy detail */}
      {assignment.enabled && current && (
        <div style={{
          marginTop: 2, padding: "8px 10px",
          background: "var(--color-bg-3)",
          border: "1px dashed var(--color-border-subtle)",
          borderRadius: "var(--radius-sm)",
          fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.55,
        }}>
          {current.thresholdMb ? <>Cap <span className="mono">{(current.thresholdMb / 1024).toFixed(1)} GB</span> · alert at <span className="mono">{current.alertAt}</span></>
          : current.thresholdPct ? <>Alert when free disk drops below <span className="mono">{current.thresholdPct} %</span></>
          : current.detail ? current.detail
          : null}
        </div>
      )}

      {/* Manage policies link */}
      <button onClick={() => window.showToast?.("Manage policies — coming in Phase 3.6", "info")}
        style={{
          marginTop: 2, fontSize: 11, color: "var(--color-text-tertiary)",
          textDecoration: "underline", textUnderlineOffset: 2,
          textDecorationStyle: "dotted", alignSelf: "flex-start",
        }}>
        Manage {PREWARNING_KIND_LABEL[kind].toLowerCase()} policies →
      </button>
    </div>
  );
}

// ─── Reusable bits ─────────────────────────────────────────
function Meter({ label, value, max, unit, subValue, tone = "default" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = tone === "danger"  ? "var(--color-error-500)"
                 : tone === "warning" ? "var(--color-warning-500)"
                 :                       "var(--color-primary-500)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span className="overline" style={{ fontSize: 10.5 }}>{label}</span>
        <span className="mono num" style={{ fontSize: 11.5, color: "var(--fg3)" }}>{pct}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span className="mono num" style={{ fontSize: 20, fontWeight: 500,
          color: tone === "danger" ? "var(--color-error-700)"
              : tone === "warning" ? "var(--color-warning-700)"
              : "var(--fg1)" }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--fg3)" }}>{unit}{subValue ? ` · ${subValue}` : ""}</span>
      </div>
      <div style={{ marginTop: 6, height: 5, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .2s ease" }} />
      </div>
    </div>
  );
}

function KvCompact({ label, value }) {
  return (
    <div>
      <div className="overline" style={{ fontSize: 10.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--fg1)", display: "inline-flex", alignItems: "center", gap: 6 }}>{value}</div>
    </div>
  );
}

function Spinner({ size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `${Math.max(1.5, Math.round(size / 9))}px solid var(--color-bg-3)`,
      borderTopColor: "var(--color-primary-600)",
      animation: "spin .8s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ─── Sub-bits ──────────────────────────────────────────────
const selectStyle = {
  padding: "7px 10px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border-default)", fontSize: 12,
  fontFamily: "inherit",
  background: "var(--bg2)", color: "var(--fg1)",
};

function KvGrid({ rows, compact }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: compact ? "1fr 1fr" : "160px minmax(0, 1fr)",
      rowGap: compact ? 8 : 10, columnGap: 16,
    }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span className="overline" style={{ fontSize: 10, paddingTop: 2 }}>{k}</span>
          <span style={{ fontSize: 13, color: "var(--color-text-primary)", minWidth: 0,
            display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function Dash() { return <span style={{ color: "var(--fg3)" }}>—</span>; }

function Flag({ positive, positiveLabel, negativeLabel, tone }) {
  if (positive) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--color-success-700)" }}>
        <window.Ico name="check" size={12} stroke={2.5} />{positiveLabel}
      </span>
    );
  }
  const color = tone === "warning" ? "var(--color-warning-700)" : "var(--color-error-700)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color, fontWeight: 500 }}>
      <window.Ico name="alert" size={12} />{negativeLabel}
    </span>
  );
}

function SecurityList({ warnings }) {
  if (!warnings || warnings.length === 0) {
    return <Flag positive positiveLabel="None reported" />;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
      {warnings.map((w, i) => (
        <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12.5, color: "var(--color-warning-700)" }}>
          <window.Ico name="alert" size={12} stroke={2} />{w}
        </li>
      ))}
    </ul>
  );
}

function SecurityBanner({ hardware }) {
  const warnings = [
    ...(hardware.root ? ["Device appears to be rooted"] : []),
    ...(hardware.devMode ? ["Developer options are enabled"] : []),
    ...(hardware.securityWarnings || []),
  ];
  // Dedupe — root warning may also be in the securityWarnings list.
  const unique = [...new Set(warnings)];
  if (unique.length === 0) return null;
  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--warning-bg)",
      border: "1px solid color-mix(in oklab, var(--color-warning-500) 30%, transparent)",
      borderRadius: "var(--radius-lg)",
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <window.Ico name="alert" size={16} style={{ color: "var(--color-warning-700)", marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-warning-700)" }}>
          Hardware integrity flagged
        </div>
        <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--color-warning-700)", lineHeight: 1.55 }}>
          {unique.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>
    </div>
  );
}

function NetRow({ label, enabled, detail }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0",
      borderBottom: "1px dashed var(--color-border-subtle)",
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: enabled ? "var(--success)" : "var(--color-border-strong)",
      }} />
      <span style={{ fontSize: 12.5, fontWeight: 500, minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 12, color: enabled ? "var(--fg2)" : "var(--fg3)", flex: 1, textAlign: "right" }}>
        {detail}
      </span>
    </div>
  );
}

function YesNo({ on, warnWhenOff }) {
  if (on) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--color-success-700)" }}>
        <window.Ico name="check" size={11} stroke={2.5} /> Auto
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5,
      color: warnWhenOff ? "var(--color-warning-700)" : "var(--fg2)" }}>
      Manual
      {warnWhenOff && (
        <span title={warnWhenOff} style={{ color: "var(--color-warning-700)" }}>
          <window.Ico name="alert" size={11} />
        </span>
      )}
    </span>
  );
}

function AppLogo({ seed, name, system }) {
  // Deterministic gradient like the AppIcon shared helper, but smaller.
  let h = 0; for (const c of (seed || name)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const hue = h % 360;
  const initials = (name || "").split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 5, flexShrink: 0,
      background: system
        ? "var(--color-bg-3)"
        : `linear-gradient(135deg, oklch(58% 0.18 ${hue}), oklch(48% 0.20 ${(hue + 28) % 360}))`,
      color: system ? "var(--color-text-secondary)" : "#fff",
      border: system ? "1px solid var(--color-border-subtle)" : "none",
      display: "grid", placeItems: "center",
      fontSize: 9.5, fontWeight: 600,
      fontFamily: "Geist, system-ui, sans-serif",
      letterSpacing: "-0.02em",
    }}>{initials || "?"}</div>
  );
}

Object.assign(window, {
  DevicesListScreen, DeviceDetailScreen, DeviceMonitoringTab, findDeviceBySn,
});
