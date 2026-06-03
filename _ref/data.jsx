/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Seed data for the ISV console
// ─────────────────────────────────────────────────────────────

const DEVICE_MODELS = [
  { id: "N950",  family: "N950",  label: "TOMS N950",  blurb: "Flagship Android POS · 6.5\" · 5G" },
  { id: "S30",   family: "S",     label: "TOMS S30",   blurb: "Smart MPOS · 5.5\" · 4G/WiFi" },
  { id: "S60",   family: "S",     label: "TOMS S60",   blurb: "Compact countertop · 5.7\"" },
  { id: "S90",   family: "S",     label: "TOMS S90",   blurb: "Premium SmartPOS · 6.0\" · printer" },
  { id: "X800",  family: "X",     label: "TOMS X800",  blurb: "Self-service kiosk · 10\" tablet" },
  { id: "N750",  family: "N750",  label: "TOMS N750",  blurb: "Handheld Android · 5.5\" · 4G" },
  { id: "N750K", family: "N750",  label: "TOMS N750K", blurb: "N750 + physical keypad · PCI v6" },
  { id: "N750P", family: "N750",  label: "TOMS N750P", blurb: "N750 + integrated printer · 58mm" },
];

// ─ App publish model — TWO independent fields ─────────
// Apps have two orthogonal attributes. Neither requires Admin review.
//
//   status      — lifecycle. Is the app open for new subscriptions?
//                 "published"   — live; ISOs can subscribe, version pushes
//                                 propagate to subscribers
//                 "unpublished" — withdrawn; existing snapshots keep
//                                 running on terminals, but no new
//                                 subscriptions and no version pushes.
//                                 Re-publish is one click.
//
//   publishMode — who can subscribe?
//                 "public"   — All ISOs. Listed in the public pool;
//                              any ISO tenant can browse and subscribe.
//                 "private"  — Specified ISOs. Hidden from the public
//                              pool; only ISOs the publisher names can
//                              subscribe. For ISV+ISO tenants the
//                              publishing org's own tenant is included
//                              by default; pure-ISV publishers hand out
//                              30-day invite links to grant access.
//
// The two fields combine into 4 states: published+public, published+private,
// unpublished+public, unpublished+private. There is no "private" lifecycle
// status — that concept has been replaced by publishMode.
const APP_STATUS = {
  "published":   { label: "Published",   tone: "success", description: "Live. ISO subscribers receive new version notifications; new subscriptions are open." },
  "unpublished": { label: "Unpublished", tone: "warning", description: "Withdrawn. Existing subscribers keep their snapshot but no new subscriptions or version pushes are accepted. Re-publish anytime — no review needed." },
};

// Publish-mode dictionary (UI labels for the "All ISOs / Specified ISOs"
// choice). Independent of status.
const APP_PUBLISH_MODE = {
  "public":  { label: "All ISOs",       tone: "info",    description: "Listed in the public pool. Any ISO tenant can browse and subscribe." },
  "private": { label: "Specified ISOs", tone: "neutral", description: "Hidden from the public pool. Only the ISOs you specify can subscribe — for ISV+ISO tenants, your own tenant is included by default." },
};

// ─ Version-level state ────────────────────────────────
// Version uploads do NOT require any review — they go straight to the
// version list. Three terminal states:
//   published   — active build, available for pull/install
//   unpublished — soft remove. Existing installs keep running; new
//                 subscribers don't see this version as a pull option.
//                 Subscribers who pulled this version do NOT get notified
//                 of newer versions.
//   rollback    — EMERGENCY. Force-uninstalls from every terminal on next
//                 check-in. Subscribers are notified urgently so they can
//                 prepare. Use only for critical defects.
const VERSION_STATUS = {
  // Publisher-facing labels (own apps)
  "published":         { label: "Available",         tone: "success" },
  "available":         { label: "Available",         tone: "success" },  // alias used by App Store side
  "unpublished":       { label: "Unpublished",       tone: "neutral" },
  "rollback":          { label: "Rollback",          tone: "danger"  },
  // Subscriber-facing only — set when ISO has received a publish
  // notification but hasn't yet completed the Approval review.
  "waiting-approval":  { label: "Waiting Approval",  tone: "warning" },
  "draft":             { label: "Draft",             tone: "neutral" },
};

// ─── Upgrade-strategy data dictionaries ────────────────────
// Bound per (merchant, app, version) in MERCHANT_APP_UPGRADE_STRATEGY below.
//
// `body` is the short one-line description surfaced in pickers / summaries.
// `detail` is the full PRD-spec description, surfaced in the Strategy Help
// modal (one-place reference).
const UPGRADE_TIMING_OPTIONS = [
  { id: "immediate", label: "Immediate",
    body:   "Install starts right after the device receives the rollout.",
    detail: "The terminal will start downloading immediately upon receiving the upgrade notification. Installation begins as soon as the download succeeds — if the app is in use, the cashier session may be interrupted." },
  { id: "reboot",    label: "On next reboot",
    body:   "Download first, install on the next reboot. Zero disruption.",
    detail: "After the upgrade notification, the terminal downloads in the background. Installation is held until the next successful reboot, so business hours are not disrupted." },
  { id: "rebootOrIdle10", label: "On reboot or after 10 min idle",
    body:   "Install on next reboot, or after 10 minutes of inactivity.",
    detail: "After the upgrade notification, the terminal downloads in the background. Installation runs at whichever event happens first — the next reboot or after 10 minutes of continuous device idleness." },
  { id: "scheduled", label: "Scheduled windows",
    body:   "Install only inside one or more reserved time windows per day.",
    detail: "The terminal installs only inside the operator-reserved windows. You can reserve multiple windows in a day (e.g. 02:00–04:00 and 13:00–14:00). Windows cannot overlap; outside the windows the device defers the install to the next window.",
    needsSlots: true },
];

const UPGRADE_NETWORK_OPTIONS = [
  { id: "any",      label: "No restriction",
    body:   "Download over any available network.",
    detail: "Any network — WiFi, Ethernet, or cellular — may be used to download the upgrade. The fastest available connection wins." },
  { id: "wired",    label: "WiFi or Ethernet only",
    body:   "Cellular blocked. Saves merchant data.",
    detail: "Downloads are restricted to WiFi or Ethernet only. The terminal will not download over cellular data, ensuring the merchant's cellular plan is preserved." },
  { id: "cellCap",  label: "WiFi/Ethernet or cellular under cap",
    body:   "WiFi/Ethernet first; cellular only if this month's usage is below the cap.",
    detail: "Prefer WiFi or Ethernet. Cellular is only allowed when this month's cellular usage on the terminal is below the configured cap. Once the cap is hit, downloads pause until WiFi/Ethernet is available or the next billing cycle begins.",
    needsCap: true },
];

const UPGRADE_STRATEGY_PRESETS = [
  { id: "casual",    label: "Casual",
    body: "No rush — install on next reboot, no network restriction.",
    timing: "reboot",  network: "any" },
  { id: "immediate", label: "Immediate",
    body: "Urgent — install right away. Use for security patches.",
    timing: "immediate", network: "any" },
  { id: "custom",    label: "Custom",
    body: "Choose timing and network independently.",
    timing: null, network: null },
];

// ─── MERCHANT_APP_UPGRADE_STRATEGY ─────────────────────────
// Persistent store: (mrchId, pkg, versionId) → strategy record.
// Replaces the old per-rollout in-memory form state. Strategy now belongs
// to the merchant, not the rollout.
//
//   strategy:    "casual" | "immediate" | "custom"
//   timing:      "immediate" | "reboot" | "rebootOrIdle10"
//   network:     "any" | "wired" | "cellCap"
//   cellCapMb:   number — only when network === "cellCap"
//
// Keyed by `${mrchId}:${pkg}:${versionId}` to match the PRD's data model.
const MERCHANT_APP_UPGRADE_STRATEGY = {};

function _stratKey(mrchId, pkg, versionId) {
  return `${mrchId}:${pkg}:${versionId}`;
}

function getMerchantStrategy(mrchId, pkg, versionId) {
  return MERCHANT_APP_UPGRADE_STRATEGY[_stratKey(mrchId, pkg, versionId)] || null;
}

function setMerchantStrategy(mrchId, pkg, versionId, partial) {
  const key = _stratKey(mrchId, pkg, versionId);
  const preset = UPGRADE_STRATEGY_PRESETS.find(p => p.id === (partial?.strategy || "casual"));
  const next = {
    mrchId, appPackage: pkg, appVersion: versionId,
    strategy:    partial?.strategy || "casual",
    timing:      partial?.timing  || preset?.timing  || "reboot",
    network:     partial?.network || preset?.network || "any",
    cellCapMb:   partial?.cellCapMb != null ? partial.cellCapMb : 100,
    // Reserved windows for timing === "scheduled". Each slot: { start: "HH:MM", end: "HH:MM" }.
    // Windows are operator-local time, must not overlap, and may not cross midnight.
    slots:       Array.isArray(partial?.slots) && partial.slots.length
                   ? partial.slots
                   : [{ start: "02:00", end: "04:00" }],
  };
  MERCHANT_APP_UPGRADE_STRATEGY[key] = next;
  return next;
}

function deleteMerchantStrategy(mrchId, pkg, versionId) {
  delete MERCHANT_APP_UPGRADE_STRATEGY[_stratKey(mrchId, pkg, versionId)];
}

// Resolve preset id from a strategy record. We respect an explicit
// strategy field — if the user picked "custom", it stays custom regardless
// of whether timing/network coincidentally match Casual or Immediate's
// defaults. Only when the record has no strategy field (legacy) do we
// reverse-engineer it from the timing/network combination.
function resolveStrategyPreset(record) {
  if (!record) return null;
  if (record.strategy) return record.strategy;
  // Legacy fallback: no strategy field at all — guess from params.
  const match = UPGRADE_STRATEGY_PRESETS.find(p =>
    p.id !== "custom" && p.timing === record.timing && p.network === record.network);
  return match ? match.id : "custom";
}

function strategyLabel(idOrRecord) {
  const id = typeof idOrRecord === "string" ? idOrRecord : resolveStrategyPreset(idOrRecord);
  const p = UPGRADE_STRATEGY_PRESETS.find(x => x.id === id);
  return p ? p.label : "Not set";
}

function timingLabel(id) {
  return (UPGRADE_TIMING_OPTIONS.find(o => o.id === id) || {}).label || id || "—";
}
function networkLabel(id) {
  return (UPGRADE_NETWORK_OPTIONS.find(o => o.id === id) || {}).label || id || "—";
}

// Human-readable two-part summary of a strategy's params: "On next reboot · No restriction"
// Used in compact cells where there's no room for full descriptions.
function formatStrategySummary(record) {
  if (!record) return "Not set";
  let t = timingLabel(record.timing);
  if (record.timing === "scheduled") {
    const slots = Array.isArray(record.slots) ? record.slots : [];
    t = slots.length
      ? `Scheduled ${slots.map(s => `${s.start}–${s.end}`).join(", ")}`
      : "Scheduled (no windows)";
  }
  let n = networkLabel(record.network);
  if (record.network === "cellCap") n = `Cellular < ${record.cellCapMb} MB / mo`;
  return `${t} · ${n}`;
}

// Back-compat aliases — older code paths still reference the pre-split
// "private" status (which meant "ISV+ISO created an app for internal use
// only"). The migration mapped those to status="published"+publishMode="private"
// in seed; the alias below keeps any lingering renderer that still reads
// APP_STATUS["private"] from blowing up.
APP_STATUS["private"]         = APP_STATUS.published;
APP_STATUS["not-published"]   = APP_STATUS.published;
APP_STATUS["awaiting-review"] = APP_STATUS.published;
APP_STATUS["rejected"]        = APP_STATUS.published;
APP_STATUS["archived"]        = APP_STATUS.unpublished;
const REVIEW_STATE = APP_STATUS; // kept as alias for any lingering refs

const SEVERITY = {
  critical: { label: "Critical", tone: "danger",  color: "var(--color-error-500)"  },
  high:     { label: "High",     tone: "danger",  color: "oklch(64% 0.18 30)" },
  medium:   { label: "Medium",   tone: "warning", color: "var(--color-warning-500)" },
  low:      { label: "Low",      tone: "info",    color: "var(--color-info-500)"    },
  info:     { label: "Info",     tone: "neutral", color: "var(--color-text-tertiary)" },
};

// ─── ISO companies (the audience for an ISV's app pool) ─────
// An ISV publishes a new version into its app pool. The pool is visible to
// ISO companies; each ISO can import the snapshot into its own pool, then
// push to its downstream merchants and terminals. From the ISV's perspective
// these are the entities that "subscribe" to (or import) an app.
//
// `terminals` and `merchants` are downstream counts (the ISO's footprint),
// included so an ISV can gauge potential reach when choosing visibility.
const ISO_COMPANIES = [
  { id: "c01", name: "Northbay Devices",         region: "Quebec, CA",   merchants:  84, terminals: 1240, tier: "Enterprise" },
  { id: "c02", name: "Summit Retail Co.",        region: "Ontario, CA",  merchants: 142, terminals: 2380, tier: "Enterprise" },
  { id: "c03", name: "Pacific Payments Group",   region: "BC, CA",       merchants:  46, terminals:  720, tier: "Standard"   },
  { id: "c04", name: "Atlantic Merchant Svcs",   region: "Nova Scotia",  merchants:  29, terminals:  410, tier: "Standard"   },
  { id: "c05", name: "Metro Reseller Network",   region: "Ontario, CA",  merchants: 168, terminals: 2960, tier: "Enterprise" },
  { id: "c06", name: "Cascade Payment Co.",      region: "Alberta, CA",  merchants:  62, terminals:  980, tier: "Enterprise" },
  { id: "c07", name: "Heartland Reseller",       region: "Manitoba, CA", merchants:  21, terminals:  340, tier: "Standard"   },
  { id: "c08", name: "Velocity Payments",        region: "Quebec, CA",   merchants:  53, terminals:  870, tier: "Enterprise" },
  { id: "c09", name: "Trillium ISO Corp",        region: "Ontario, CA",  merchants:  38, terminals:  610, tier: "Standard"   },
  { id: "c10", name: "Polaris Merchant Group",   region: "BC, CA",       merchants:  74, terminals: 1180, tier: "Enterprise" },
  { id: "c11", name: "Apex Payment Solutions",   region: "Alberta, CA",  merchants:  18, terminals:  290, tier: "Starter"    },
  { id: "c12", name: "Crestline Payments",       region: "Nova Scotia",  merchants:  12, terminals:  180, tier: "Starter"    },
  { id: "c13", name: "Westwind Reseller Svcs",   region: "BC, CA",       merchants:  44, terminals:  690, tier: "Standard"   },
  { id: "c14", name: "Granite Coast POS",        region: "New Brunswick",merchants:  15, terminals:  220, tier: "Starter"    },
  { id: "c15", name: "Bayshore Merchant Tech",   region: "Quebec, CA",   merchants:  31, terminals:  510, tier: "Standard"   },
  { id: "c16", name: "Eastlake ISO Partners",    region: "Ontario, CA",  merchants:  26, terminals:  430, tier: "Standard"   },
];
// Back-compat alias — older code paths still read window.CUSTOMERS.
const CUSTOMERS = ISO_COMPANIES;

// ─── App icon — every version has its own icon (extracted from the APK).
// The current app icon is the latest version's icon. For an app with no version
// yet (e.g. just created), we render initials over a placeholder colour derived
// from the package name.
//
//   <AppIcon app={…} />              → use latest version's icon
//   <AppIcon app={…} version={…} />  → use that specific version's icon
//   <AppIcon name="…" pkg="…" />     → placeholder for new apps without an APK
//
// In production, this would be an <img src={version.iconUrl} />. Here we render
// a deterministic gradient + initials so each (package, version) pair is visually
// distinct, and changing version.iconSeed mimics "icon was updated in this version".
function AppIcon({ app, version, name, pkg, seed, size = 36, radius }) {
  // Resolve display name + a stable colour seed
  const latestVersion = app && (app.versions || []).find(v => v.current) || (app && app.versions && app.versions[0]);
  const versionIconSeed = (version && version.iconSeed)
                       || (latestVersion && latestVersion.iconSeed)
                       || null;

  const displayName = name || (app && app.name) || "";
  const pkgValue    = pkg  || (app && app.package) || "";
  const colourSeed  = seed || versionIconSeed || pkgValue || displayName || "carbon";

  // Stable hash → hue
  let h = 0;
  for (let i = 0; i < colourSeed.length; i++) h = (h * 31 + colourSeed.charCodeAt(i)) & 0x7fffffff;
  const hue = h % 360;
  const c1 = `oklch(58% 0.18 ${hue})`;
  const c2 = `oklch(48% 0.20 ${(hue + 28) % 360})`;
  const gid = `g-${colourSeed.replace(/[^a-z0-9]/gi, "")}-${hue}-${size}`;

  // 1–2 letter initials from words in the display name
  const words = (displayName || "").split(/[\s.+_/-]+/).filter(Boolean);
  const initials = (words[0]?.[0] || "?") + (words[1] ? words[1][0] : "");

  // Scale glyph to size — keep ratios consistent
  const fontSize = size * (initials.length === 2 ? 0.42 : 0.5);
  const cy       = size * 0.65;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={radius != null ? radius : size * 0.22} fill={`url(#${gid})`} />
      <text x={size / 2} y={cy} textAnchor="middle"
            fontFamily="Geist, system-ui, sans-serif"
            fontWeight="600" fontSize={fontSize} fill="white" letterSpacing="-0.02em">
        {initials.toUpperCase()}
      </text>
    </svg>
  );
}

// ─── Vulnerability scan templates ───────────────────────────
const SCAN_FINDINGS_TEMPLATES = {
  cleanish: [
    { sev: "medium", title: "Outdated OkHttp library",     cve: "CVE-2023-3635",  pkg: "com.squareup.okhttp3:okhttp",       version: "4.9.3",  fix: "4.12.0",  desc: "Improper certificate validation can cause MitM susceptibility on TLS 1.0 handshakes." },
    { sev: "low",    title: "Cleartext network policy permitted", cve: null,      pkg: "AndroidManifest.xml",                version: "—",      fix: "Set usesCleartextTraffic=false", desc: "App allows clear-text HTTP traffic in network security config." },
    { sev: "info",   title: "Embedded debug symbols",      cve: null,             pkg: "lib/arm64-v8a/libpaycore.so",        version: "—",      fix: "Strip with R8 / ProGuard",       desc: "Native library ships with debug symbols, increasing APK size." },
    { sev: "info",   title: "Verbose logging in release",  cve: null,             pkg: "com.acme.pos.util.Logger",           version: "—",      fix: "Gate logs behind BuildConfig.DEBUG", desc: "Sensitive amounts may be written to logcat in release builds." },
  ],
  dirty: [
    { sev: "critical", title: "Hardcoded API secret in DEX", cve: null,            pkg: "com.acme.pos.net.ApiClient",         version: "—",      fix: "Move to keystore / runtime config", desc: "A production payment-gateway secret is embedded as a string literal in the compiled bytecode." },
    { sev: "high",     title: "Insecure deserialization",     cve: "CVE-2024-5188", pkg: "com.fasterxml.jackson.core:jackson-databind", version: "2.13.2", fix: "2.16.1", desc: "Polymorphic type handling permits arbitrary class loading from JSON payloads." },
    { sev: "high",     title: "Permissive WebView JS bridge", cve: null,            pkg: "com.acme.pos.web.PortalView",        version: "—",      fix: "Restrict @JavascriptInterface", desc: "WebView exposes Java methods to all origins; remote scripts can invoke pay() callbacks." },
    { sev: "medium",   title: "Outdated OkHttp library",      cve: "CVE-2023-3635", pkg: "com.squareup.okhttp3:okhttp",        version: "4.9.3",  fix: "4.12.0",  desc: "Improper certificate validation can cause MitM susceptibility on TLS 1.0 handshakes." },
    { sev: "medium",   title: "Exported activity without permission", cve: null,    pkg: "com.acme.pos.RefundActivity",        version: "—",      fix: "Add android:exported=false or permission",  desc: "Refund flow is launchable by third-party apps via implicit intent." },
    { sev: "low",      title: "Cleartext traffic permitted",  cve: null,            pkg: "AndroidManifest.xml",                version: "—",      fix: "Set usesCleartextTraffic=false", desc: "App allows clear-text HTTP traffic in network security config." },
    { sev: "info",     title: "Embedded debug symbols",       cve: null,            pkg: "lib/arm64-v8a/libpaycore.so",        version: "—",      fix: "Strip with R8 / ProGuard",       desc: "Native library ships with debug symbols, increasing APK size." },
  ],
  clean: [
    { sev: "info", title: "Embedded debug symbols", cve: null, pkg: "lib/arm64-v8a/libpaycore.so", version: "—", fix: "Strip with R8 / ProGuard", desc: "Native library ships with debug symbols, increasing APK size." },
  ],
};

function summariseFindings(findings) {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (findings || []).forEach(f => { out[f.sev] = (out[f.sev] || 0) + 1; });
  return out;
}

// ─── Apps & version histories ───────────────────────────────
function pickCustomerIds(count) {
  return CUSTOMERS.slice(0, count).map(c => c.id);
}

// ─── App categories (industry / function verticals) ────────
const CATEGORIES = [
  "Payments",
  "Retail",
  "Food & Beverage",
  "Self-Service",
  "Hospitality",
  "Loyalty",
  "Inventory",
  "Reporting",
  "Workforce",
  "Healthcare",
];

const APPS = [
  {
    id: "pos",
    name: "Acme POS Pro",
    package: "com.acme.pos.pro",
    iconId: "pos",
    category: "Payments",
    description: "Full-featured point of sale with split tender, refunds, and offline queueing. Includes the Acme Pay SDK and built-in receipt printer support.",
    devices: ["N950", "S90", "S60", "N750P"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait", "landscape"],
    subscriberIds: pickCustomerIds(11),
    versions: [
      { id: "v32", code: 1432, name: "4.3.2", iconSeed: "com.acme.pos.pro#redesign-v4", size: "28.4 MB", uploadedAt: "May 09, 2026", publishedAt: "May 10, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Fixes EMV fallback bug on N750P. Adds tip suggestion presets configurable per merchant. Improves offline queue retry backoff (now exponential, max 30 min).",
        signer: "Acme Software Inc. · SHA-256 d4:e2:8a:…",
        minSdk: 24, targetSdk: 34, perms: 18,
        rolloutPct: 100, reach: 11, },
      { id: "v31", code: 1431, name: "4.3.1", size: "28.1 MB", uploadedAt: "Apr 22, 2026", publishedAt: "Apr 23, 2026", status: "published", scan: "cleanish",
        notes: "Patch release: timeout handling on Bluetooth pinpad pairing.", rolloutPct: 100, reach: 11, perms: 18, minSdk: 24, targetSdk: 34 },
      { id: "v30", code: 1430, name: "4.3.0", iconSeed: "com.acme.pos.pro#redesign-v4", size: "27.9 MB", uploadedAt: "Apr 04, 2026", publishedAt: "Apr 07, 2026", status: "published", scan: "cleanish",
        notes: "Adds split-tender and partial refund flows. New analytics export endpoint.", rolloutPct: 100, reach: 11, perms: 18, minSdk: 24, targetSdk: 34 },
      { id: "v29", code: 1429, name: "4.2.5", size: "27.6 MB", uploadedAt: "Mar 11, 2026", publishedAt: "Mar 12, 2026", status: "published", scan: "cleanish",
        notes: "Localization fixes for fr-CA. PCI re-cert paperwork.", rolloutPct: 100, reach: 11, perms: 17, minSdk: 24, targetSdk: 33 },
      { id: "v28", code: 1428, name: "4.2.4", size: "27.6 MB", uploadedAt: "Feb 18, 2026", publishedAt: "Feb 19, 2026", unpublishedAt: "Feb 20, 2026", status: "unpublished",
        notes: "Unpublished after a crash report on the tip prompt for S60. Superseded by 4.2.5.", rolloutPct: 100, reach: 6, perms: 17, minSdk: 24, targetSdk: 33, scan: "cleanish" },
    ],
  },
  {
    id: "inventory",
    name: "Stockroom",
    package: "com.acme.stockroom",
    iconId: "inventory",
    category: "Inventory",
    description: "Inventory counts, receiving, and barcode-based stock transfers. Pairs with the POS for real-time on-hand updates.",
    devices: ["N950", "S90", "X800", "N750", "N750K"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait"],
    subscriberIds: pickCustomerIds(7),
    versions: [
      { id: "v12", code: 212, name: "2.1.2", size: "14.2 MB", uploadedAt: "May 02, 2026", publishedAt: "May 05, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Adds bulk transfer mode. Cycle-count tasks now sync incrementally.", rolloutPct: 100, reach: 7, perms: 11, minSdk: 24, targetSdk: 34, signer: "Acme Software Inc. · SHA-256 d4:e2:8a:…" },
      { id: "v11", code: 211, name: "2.1.1", size: "14.0 MB", uploadedAt: "Apr 03, 2026", publishedAt: "Apr 05, 2026", status: "published", scan: "clean",
        notes: "Bug fixes for receiving workflow.", rolloutPct: 100, reach: 7, perms: 11, minSdk: 24, targetSdk: 34 },
      { id: "v10", code: 210, name: "2.1.0", size: "13.9 MB", uploadedAt: "Mar 02, 2026", publishedAt: "Mar 04, 2026", status: "published", scan: "clean",
        notes: "Initial 2.1 — cycle counts.", rolloutPct: 100, reach: 6, perms: 10, minSdk: 24, targetSdk: 33 },
    ],
  },
  {
    id: "loyalty",
    name: "Loyalty+",
    package: "com.acme.loyalty",
    iconId: "loyalty",
    category: "Loyalty",
    description: "Punch-card and points-based loyalty programs. Customers enroll by phone number; rewards redeem at the POS.",
    devices: ["N950", "S90", "S60", "S30"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait"],
    subscriberIds: pickCustomerIds(9),
    versions: [
      { id: "v07", code: 107, name: "1.4.0-rc1", iconSeed: "com.acme.loyalty#rc1-rebrand", size: "9.8 MB", uploadedAt: "May 12, 2026", status: "unpublished", scan: "dirty",
        notes: "RC for 1.4.0 — adds tiered rewards and SMS push. Held by publisher for additional internal review before publishing.",
        signer: "Acme Software Inc. · SHA-256 d4:e2:8a:…",
        rolloutPct: 0, reach: 9, perms: 14, minSdk: 24, targetSdk: 34 },
      { id: "v06", code: 106, name: "1.3.4", size: "9.5 MB", uploadedAt: "Apr 18, 2026", publishedAt: "Apr 20, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Hotfix: enrollment screen race condition.", rolloutPct: 100, reach: 9, perms: 12, minSdk: 24, targetSdk: 34 },
      { id: "v05", code: 105, name: "1.3.3", size: "9.4 MB", uploadedAt: "Mar 27, 2026", publishedAt: "Mar 29, 2026", status: "published", scan: "cleanish",
        notes: "Performance improvements.", rolloutPct: 100, reach: 8, perms: 12, minSdk: 24, targetSdk: 34 },
    ],
  },
  {
    id: "reporting",
    name: "Insights",
    package: "com.acme.insights",
    iconId: "reporting",
    category: "Reporting",
    description: "Daily sales summaries, hourly heatmaps, and tip-out reporting. Works alongside the POS.",
    devices: ["N950", "X800", "S90"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait", "landscape"],
    subscriberIds: pickCustomerIds(6),
    versions: [
      { id: "v04", code: 4, name: "1.2.0", size: "11.1 MB", uploadedAt: "Apr 11, 2026", publishedAt: "Apr 12, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Hourly heatmap, exportable as CSV.", rolloutPct: 100, reach: 6, perms: 8, minSdk: 24, targetSdk: 34 },
      { id: "v03", code: 3, name: "1.1.2", size: "10.8 MB", uploadedAt: "Mar 14, 2026", publishedAt: "Mar 15, 2026", status: "published", scan: "clean",
        notes: "Reliability fixes.", rolloutPct: 100, reach: 6, perms: 8, minSdk: 24, targetSdk: 33 },
    ],
  },
  {
    id: "catalog",
    name: "Catalog Sync",
    package: "com.acme.catalog",
    iconId: "catalog",
    category: "Retail",
    description: "Two-way item & price sync between merchant ERP and terminal. Drag-and-drop CSV import, schedulable jobs.",
    devices: ["N950", "X800", "S90", "N750P"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait", "landscape"],
    subscriberIds: pickCustomerIds(8),
    versions: [
      { id: "v09", code: 109, name: "1.0.9", size: "7.4 MB", uploadedAt: "Apr 28, 2026", publishedAt: "Apr 30, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Adds price-rule conflict detection.", rolloutPct: 100, reach: 8, perms: 9, minSdk: 24, targetSdk: 34 },
      { id: "v08", code: 108, name: "1.0.8", size: "7.2 MB", uploadedAt: "Apr 02, 2026", publishedAt: "Apr 03, 2026", status: "published", scan: "clean",
        notes: "Minor improvements.", rolloutPct: 100, reach: 8, perms: 9, minSdk: 24, targetSdk: 34 },
    ],
  },
  {
    id: "delivery",
    name: "Curbside",
    package: "com.summit.curbside",
    iconId: "delivery",
    category: "Food & Beverage",
    description: "Order ahead and curbside pickup workflow, with arrival notifications by SMS.",
    devices: ["N950", "S90"],
    // Summit-owned (ISV+ISO) — published but in Specified ISOs mode so
    // only the 3 listed ISOs (including Summit itself) can subscribe.
    status: "published",
    publishMode: "private",
    submittedAt: null,
    orientations: ["portrait"],
    subscriberIds: pickCustomerIds(3),
    versions: [
      { id: "v02", code: 2, name: "0.9.0-beta", size: "6.6 MB", uploadedAt: "May 11, 2026", status: "published", scan: null, current: true,
        notes: "Initial beta. Open invite — not yet published.", rolloutPct: 0, reach: 3, perms: 7, minSdk: 24, targetSdk: 34 },
    ],
  },
  {
    id: "timeclock",
    name: "Timeclock",
    package: "com.summit.timeclock",
    iconId: "timeclock",
    category: "Workforce",
    description: "Employee clock-in / clock-out with PIN or NFC badge. Exports approved hours to payroll.",
    devices: ["N950", "S90", "S60", "S30", "N750"],
    status: "published",
    publishMode: "public",
    orientations: ["portrait"],
    subscriberIds: pickCustomerIds(10),
    versions: [
      { id: "v15", code: 215, name: "2.0.5", size: "5.9 MB", uploadedAt: "Apr 19, 2026", publishedAt: "Apr 21, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Adds NFC badge support on N950.", rolloutPct: 100, reach: 10, perms: 6, minSdk: 24, targetSdk: 34 },
      { id: "v14", code: 214, name: "2.0.4", size: "5.8 MB", uploadedAt: "Mar 24, 2026", publishedAt: "Mar 25, 2026", status: "published", scan: "clean",
        notes: "i18n: zh-CN.", rolloutPct: 100, reach: 10, perms: 6, minSdk: 24, targetSdk: 33 },
    ],
  },
  {
    id: "giftcard",
    name: "Giftcards",
    package: "com.summit.giftcard",
    iconId: "giftcard",
    category: "Loyalty",
    description: "Issue, redeem, and reload prepaid giftcards. Includes plastic-card BIN provisioning.",
    devices: ["N950", "S90", "N750P"],
    // Summit-owned (ISV+ISO) — published, Specified ISOs mode.
    status: "published",
    publishMode: "private",
    orientations: ["portrait"],
    subscriberIds: pickCustomerIds(5),
    versions: [
      { id: "v06", code: 16, name: "1.6.0", size: "4.3 MB", uploadedAt: "May 04, 2026", publishedAt: "May 06, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Reload via QR.", rolloutPct: 100, reach: 5, perms: 5, minSdk: 24, targetSdk: 34 },
    ],
  },
  // Newly-created app — no APK uploaded yet. Demonstrates the "empty"
  // state in the Apps list (no version cell, can't be submitted for review
  // until at least one version exists).
  {
    id: "tablemanager",
    name: "Table Manager",
    package: "com.summit.tablemanager",
    iconId: "tablemanager",
    category: "Food & Beverage",
    description: "Floor plans, table assignments and wait-list tracking for full-service restaurants. Course-firing integration with the POS.",
    devices: ["N950", "X800", "S90"],
    // Summit-owned — Specified ISOs mode, no version uploaded yet.
    // Demonstrates the "empty" state.
    status: "published",
    publishMode: "private",
    orientations: ["portrait", "landscape"],
    subscriberIds: [],
    versions: [],
  },

  // ─ Pure-ISV "Specified ISOs" demo ──────────────────────
  // Acme-owned but hidden from the public pool. Subscribers are added via
  // 30-day invite links (see invite.jsx). Covers the pure-ISV + private
  // path and the browse-pool invite filter (browse-pool.jsx).
  {
    id: "tipout",
    name: "Acme Tipout",
    package: "com.acme.tipout",
    iconId: "tipout",
    category: "Workforce",
    description: "Shift-end tip pooling and distribution for service teams. Imports POS sales data, computes shares by hours worked, and stamps approvals to payroll.",
    devices: ["N950", "S90", "S60"],
    status: "published",
    publishMode: "private",
    orientations: ["portrait"],
    subscriberIds: ["c01", "c03", "c10"],  // 3 specified ISOs — invited
    versions: [
      { id: "v23", code: 123, name: "1.2.3", size: "8.6 MB", uploadedAt: "May 06, 2026", publishedAt: "May 07, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Adds tip-out by section and lock-after-approval workflow.", rolloutPct: 100, reach: 3, perms: 9, minSdk: 24, targetSdk: 34,
        signer: "Acme Software Inc. · SHA-256 d4:e2:8a:…" },
      { id: "v22", code: 122, name: "1.2.2", size: "8.4 MB", uploadedAt: "Apr 09, 2026", publishedAt: "Apr 10, 2026", status: "published", scan: "clean",
        notes: "Rounding edge cases on uneven splits.", rolloutPct: 100, reach: 3, perms: 9, minSdk: 24, targetSdk: 34 },
    ],
  },

  // ─ Unpublished lifecycle demo ──────────────────────────
  // Acme-owned, was previously public, has since been withdrawn. Existing
  // Northbay snapshot keeps running; no new subscribers, no new pushes.
  // Covers the Unpublished KPI tile and the Re-publish flow.
  {
    id: "smartreceipt",
    name: "Acme Smart Receipt",
    package: "com.acme.smartreceipt",
    iconId: "smartreceipt",
    category: "Retail",
    description: "Digital receipts with QR-driven product passports and rebate hooks. Email and SMS delivery, branded templates per merchant.",
    devices: ["N950", "S90", "S60", "N750P"],
    status: "unpublished",
    publishMode: "public",
    orientations: ["portrait", "landscape"],
    subscriberIds: ["c01"],  // Northbay still holds a pre-unpublish snapshot
    versions: [
      { id: "v18", code: 118, name: "1.1.8", size: "10.2 MB", uploadedAt: "Mar 12, 2026", publishedAt: "Mar 14, 2026", unpublishedAt: "Apr 28, 2026", status: "published", scan: "cleanish", current: true,
        notes: "Latest before withdrawal. Adds QR rebate template editor.",
        rolloutPct: 100, reach: 1, perms: 11, minSdk: 24, targetSdk: 34,
        signer: "Acme Software Inc. · SHA-256 d4:e2:8a:…" },
      { id: "v17", code: 117, name: "1.1.7", size: "10.0 MB", uploadedAt: "Feb 11, 2026", publishedAt: "Feb 12, 2026", status: "published", scan: "clean",
        notes: "i18n fixes for fr-CA receipts.", rolloutPct: 100, reach: 1, perms: 11, minSdk: 24, targetSdk: 33 },
    ],
  },
];

// Stamp each app with its publishing tenant. The two examples below are
// owned by Summit Retail Co. (which holds both ISV and ISO contracts);
// the `delivery` and `giftcard` apps are also owned by Summit and stay in
// Specified ISOs mode to demonstrate the ISV+ISO private-publish path.
// The rest are owned by Acme Software, our default pure-ISV tenant.
const APP_PUBLISHERS = {
  "delivery":     "summit",
  "timeclock":    "summit",
  "giftcard":     "summit",
  "tablemanager": "summit",  // ISV+ISO tenant — Specified ISOs, no version yet
};
APPS.forEach(a => { a.publisherTenantId = APP_PUBLISHERS[a.id] || "acme-sw"; });

// ─── App publish activity (audit trail) ──────────
// No Admin review in the new model — the lifecycle is entirely owned by
// the ISV. Each entry: { kind, at, actor, note? }. Kinds:
//   created            — app was registered (metadata-only, no APK yet)
//   version-uploaded   — a new version finished uploading
//   published          — app status flipped to "published"
//                        (auto-fires after first version upload)
//   unpublished        — app status flipped to "unpublished"
//   republished        — unpublished app brought back live
//   mode-changed       — publishMode flipped (All ISOs ↔ Specified ISOs)
//   rollback           — version rolled back (version-level event)
const APP_REVIEW_ACTIVITY = {
  "pos": [
    { kind: "created",   at: "Sep 14, 2023", actor: "M. Hassan",
      note: "Initial app registration." },
    { kind: "published", at: "Sep 16, 2023", actor: "M. Hassan",
      note: "First version uploaded — auto-published to All ISOs." },
  ],
  "inventory": [
    { kind: "created",   at: "Jan 08, 2024", actor: "M. Hassan" },
    { kind: "published", at: "Jan 09, 2024", actor: "M. Hassan",
      note: "First version uploaded — auto-published to All ISOs." },
  ],
  "loyalty": [
    { kind: "created",   at: "Nov 02, 2023", actor: "M. Hassan" },
    { kind: "published", at: "Nov 06, 2023", actor: "M. Hassan" },
  ],
  "reporting": [
    { kind: "created",   at: "Feb 20, 2024", actor: "M. Hassan" },
    { kind: "published", at: "Feb 22, 2024", actor: "M. Hassan" },
  ],
  "catalog": [
    { kind: "created",   at: "Mar 11, 2024", actor: "M. Hassan" },
    { kind: "published", at: "Mar 12, 2024", actor: "M. Hassan" },
  ],
  "delivery": [
    // Summit (ISV+ISO) — published in Specified ISOs mode for internal
    // pilot with the 3 listed ISO subscribers.
    { kind: "created",         at: "May 11, 2026", actor: "L. Tremblay",
      note: "Registered for internal pilot with Summit-owned merchants." },
    { kind: "version-uploaded", at: "May 12, 2026", actor: "L. Tremblay",
      note: "0.9.0-beta uploaded." },
    { kind: "published",       at: "May 12, 2026", actor: "L. Tremblay",
      note: "Published with Specified ISOs visibility — only the 3 listed ISOs can subscribe." },
  ],
  "timeclock": [
    { kind: "created",   at: "Aug 05, 2023", actor: "L. Tremblay" },
    { kind: "published", at: "Aug 10, 2023", actor: "L. Tremblay",
      note: "Published with All ISOs visibility." },
  ],
  "giftcard": [
    // Summit (ISV+ISO) — published in Specified ISOs mode for the 5 listed ISOs.
    { kind: "created",   at: "Apr 28, 2026", actor: "L. Tremblay",
      note: "Registered for internal rollout." },
    { kind: "version-uploaded", at: "May 04, 2026", actor: "L. Tremblay",
      note: "1.6.0 uploaded." },
    { kind: "published", at: "May 06, 2026", actor: "L. Tremblay",
      note: "Published with Specified ISOs visibility — 5 ISOs." },
  ],
  "tablemanager": [
    { kind: "created", at: "May 13, 2026", actor: "L. Tremblay",
      note: "Registered in Specified ISOs mode. Upload an APK to publish." },
  ],
  "tipout": [
    { kind: "created",         at: "Apr 02, 2026", actor: "M. Hassan",
      note: "Registered in Specified ISOs mode — pure-ISV publisher uses invite links." },
    { kind: "version-uploaded", at: "Apr 09, 2026", actor: "M. Hassan",
      note: "1.2.2 uploaded." },
    { kind: "published",       at: "Apr 10, 2026", actor: "M. Hassan",
      note: "Published with Specified ISOs visibility — 3 invited ISOs." },
    { kind: "version-uploaded", at: "May 06, 2026", actor: "M. Hassan",
      note: "1.2.3 uploaded." },
  ],
  "smartreceipt": [
    { kind: "created",          at: "Sep 18, 2025", actor: "M. Hassan" },
    { kind: "version-uploaded", at: "Feb 11, 2026", actor: "M. Hassan",
      note: "1.1.7 uploaded." },
    { kind: "published",        at: "Feb 12, 2026", actor: "M. Hassan",
      note: "Published to All ISOs." },
    { kind: "version-uploaded", at: "Mar 12, 2026", actor: "M. Hassan",
      note: "1.1.8 uploaded." },
    { kind: "unpublished",      at: "Apr 28, 2026", actor: "M. Hassan",
      note: "Withdrawn from public pool — feature moved into Acme POS Pro 4.4. Subscribers notified by email." },
  ],
};
APPS.forEach(a => { a.reviewActivity = APP_REVIEW_ACTIVITY[a.id] || []; });

// ─── ISO-side subscriptions ───────────────────────────────────
// Keyed by the subscribing tenant's id. Each entry references an app from
// the global APPS catalog plus the snapshot the ISO is currently running.
// When the source app publishes a newer version, the entry surfaces an
// "Update available" hint and the ISO can pull the new snapshot.
const SUBSCRIBED_APPS = {
  "acme-sw": [],          // pure ISV — nothing to subscribe to
  "northbay": [
    // Each subscribedVersionId is the NEWEST version Northbay has approved
    // into their local pool. ROLLOUT_HISTORY below shows which versions
    // (current + historical) each merchant has been pushed to — every
    // version that appears there was approved at some point, so the
    // local-pool set is exactly { v : v ∈ ROLLOUT_HISTORY for this app },
    // with subscribedVersionId pointing at the highest one.
    { appId: "pos",       subscribedVersionId: "v32", subscribedAt: "May 10, 2026", deployedTerminals:  86 },
    { appId: "inventory", subscribedVersionId: "v12", subscribedAt: "May 04, 2026", deployedTerminals:  42 },
    { appId: "loyalty",   subscribedVersionId: "v06", subscribedAt: "Apr 22, 2026", deployedTerminals:  31 },
    { appId: "timeclock", subscribedVersionId: "v15", subscribedAt: "May 02, 2026", deployedTerminals: 124 },
    { appId: "catalog",   subscribedVersionId: "v09", subscribedAt: "May 01, 2026", deployedTerminals:  18 },
    // Outdated — Northbay still on Insights v03 (1.1.2). Upstream v04 (1.2.0)
    // is published and waiting to be approved into the local pool.
    { appId: "reporting", subscribedVersionId: "v03", subscribedAt: "Mar 15, 2026", deployedTerminals:  27 },
    // Smart Receipt — Northbay subscribed back when it was published; the
    // app has since been unpublished by Acme. Northbay's snapshot keeps
    // running on existing terminals; no new version pushes arrive.
    { appId: "smartreceipt", subscribedVersionId: "v18", subscribedAt: "Mar 16, 2026", deployedTerminals: 18 },
    // Acme Tipout — pure-ISV Specified ISOs app. Northbay subscribed via
    // a 30-day invite link (see invite.jsx).
    { appId: "tipout", subscribedVersionId: "v22", subscribedAt: "Apr 10, 2026", deployedTerminals:  22 },
  ],
  "summit": [
    { appId: "pos",       subscribedVersionId: "v32", subscribedAt: "May 10, 2026", deployedTerminals: 312 },
    { appId: "loyalty",   subscribedVersionId: "v06", subscribedAt: "Apr 20, 2026", deployedTerminals: 188 },
    { appId: "reporting", subscribedVersionId: "v04", subscribedAt: "Apr 12, 2026", deployedTerminals: 102 },
    // Outdated subscriptions — Summit hasn't yet approved the newest upstream
    // releases of these apps into their local pool.
    { appId: "inventory", subscribedVersionId: "v11", subscribedAt: "Apr 06, 2026", deployedTerminals:  73 },
    { appId: "catalog",   subscribedVersionId: "v08", subscribedAt: "Apr 04, 2026", deployedTerminals:  41 },
  ],
};

// Map tenant.id → "Acme Software" / "Northbay Devices" / "Summit Retail Co." for cross-references.
const TENANT_NAMES = {
  "acme-sw":  "Acme Software",
  "northbay": "Northbay Devices",
  "summit":   "Summit Retail Co.",
};

// ─── Per-tenant employee directory (mock) ────────────────
// Used by subscription-settings → notify recipients. Operators pick from
// the directory; they don't type free-form emails.
const TENANT_EMPLOYEES = {
  "acme-sw": [
    { id: "u-as-1", name: "Maya Hassan",      email: "maya@acmesoftware.com",     role: "Release engineer" },
    { id: "u-as-2", name: "David Chen",       email: "david.chen@acmesoftware.com", role: "Security lead" },
    { id: "u-as-3", name: "Priya Krishnan",   email: "priya@acmesoftware.com",    role: "QA" },
    { id: "u-as-4", name: "Marcus Webb",      email: "marcus@acmesoftware.com",   role: "Platform admin" },
  ],
  "northbay": [
    { id: "u-nb-1", name: "Kris Bowman",      email: "kris.bowman@northbay.example", role: "Operator" },
    { id: "u-nb-2", name: "Sofia Reyes",      email: "sofia@northbay.example",       role: "Operator" },
    { id: "u-nb-3", name: "Andrew Park",      email: "andrew.park@northbay.example", role: "Manager" },
    { id: "u-nb-4", name: "Nina Patel",       email: "nina@northbay.example",        role: "Compliance" },
    { id: "u-nb-5", name: "Owen Daniels",     email: "owen.d@northbay.example",      role: "Field tech" },
  ],
  "summit": [
    { id: "u-sm-1", name: "Lucie Tremblay",   email: "lucie@summit-retail.example",  role: "Release manager" },
    { id: "u-sm-2", name: "Rosa Martinez",    email: "rosa@summit-retail.example",   role: "Operator" },
    { id: "u-sm-3", name: "Henry Liu",        email: "henry@summit-retail.example",  role: "Security lead" },
    { id: "u-sm-4", name: "Aisha Nakamura",   email: "aisha@summit-retail.example",  role: "Operator" },
    { id: "u-sm-5", name: "Tomás Bianchi",    email: "tomas@summit-retail.example",  role: "Platform admin" },
  ],
};

// ─── Per-tenant operator permissions ──────────────────────
// In production these come from the tenant's RBAC roles. We mock a single
// flag here that governs the "do you want to roll out now?" prompts —
// operators without merchant-rollout permission fall straight back to the
// version detail page instead.
const TENANT_PERMISSIONS = {
  "acme-sw":  { canRolloutMerchants: false },  // pure ISV — no merchant fleet
  "northbay": { canRolloutMerchants: true  },
  "summit":   { canRolloutMerchants: true  },
};

// ─── Pending-approval notifications (subscriber inbox) ─────
// When an ISV publishes a new version, the platform fires a notification to
// every subscribed ISO. Until the ISO operator opens the notification and
// runs the Approval review, the new version sits in "Waiting Approval" on
// their App Store side. Keyed by tenant.id → array of notifications.
//
// Each notification points at (appId, versionId); the App Store list and
// the version table read this to surface the Approval gate.
const PENDING_APPROVALS = {
  "northbay": [
    // POS Pro v32 — ISO already pulled v29; new v32 is the latest from ISV.
    { id: "n-nb-1", appId: "pos",       versionId: "v32", notifiedAt: "May 10, 2026", channel: "email+inbox" },
    // Stockroom v12 — ISO on v11; v12 awaits review.
    { id: "n-nb-2", appId: "inventory", versionId: "v12", notifiedAt: "May 02, 2026", channel: "email+inbox" },
    // Acme Tipout v23 — Northbay on v22; new v23 awaits review.
    { id: "n-nb-3", appId: "tipout",    versionId: "v23", notifiedAt: "May 07, 2026", channel: "email+inbox" },
  ],
  "summit": [
    // Loyalty+ v06 was already approved by Summit; nothing to surface.
    // Catalog Sync — Summit not subscribed, no notification.
  ],
  "acme-sw": [],
};

function getPendingApproval(tenantId, appId, versionId) {
  const list = PENDING_APPROVALS[tenantId] || [];
  return list.find(n => n.appId === appId && n.versionId === versionId) || null;
}

function clearPendingApproval(tenantId, appId, versionId) {
  const list = PENDING_APPROVALS[tenantId];
  if (!list) return;
  const i = list.findIndex(n => n.appId === appId && n.versionId === versionId);
  if (i >= 0) list.splice(i, 1);
}

// ─── ISO merchant fleets ───────────────────────────────────
// Each ISO tenant manages many downstream merchants. We use this in the Pull
// wizard to let the operator scope an update to specific merchants and to
// surface estimated terminal counts.
const MERCHANT_FLEETS = {
  "northbay": [
    // ─── Whale merchant · stress-test row ─────────────────
    // 1000 terminals across one merchant — exercises ExpandedTerminals
    // pagination + the per-row terminal counter under extreme load.
    { id: "m-nb-whale", name: "Maple Leaf Megamart Holdings", region: "Ontario, CA", terminals: 1000, tags: ["Retail", "Enterprise", "Multi-location"] },
    { id: "m-nb-001", name: "Riverside Coffee Co.",     region: "Quebec, CA",  terminals: 14, tags: ["F&B", "Multi-location", "VIP"] },
    { id: "m-nb-002", name: "Maplewood Grocery",        region: "Quebec, CA",  terminals:  8, tags: ["Retail", "Single-location"] },
    { id: "m-nb-003", name: "Pinecone Pharmacy",        region: "Ontario, CA", terminals: 22, tags: ["Healthcare", "Multi-location"] },
    { id: "m-nb-004", name: "Aspen Diner Group",        region: "Quebec, CA",  terminals: 11, tags: ["F&B", "Multi-location"] },
    { id: "m-nb-005", name: "Lakeshore Hardware",       region: "Ontario, CA", terminals:  6, tags: ["Retail", "Single-location"] },
    { id: "m-nb-006", name: "Harbor Liquor Mart",       region: "Nova Scotia", terminals:  9, tags: ["Retail", "Single-location"] },
    { id: "m-nb-007", name: "Trillium Books",           region: "Ontario, CA", terminals:  4, tags: ["Retail", "Single-location"] },
    { id: "m-nb-008", name: "Birchwood Cafe Chain",     region: "Quebec, CA",  terminals: 17, tags: ["F&B", "Multi-location"] },
    { id: "m-nb-009", name: "Northern Lights Outdoors", region: "Manitoba",    terminals: 12, tags: ["Retail", "Multi-location"] },
    { id: "m-nb-010", name: "Cobblestone Bakery",       region: "Quebec, CA",  terminals:  5, tags: ["F&B", "Single-location"] },
    { id: "m-nb-011", name: "Frost Bay Convenience",    region: "Nova Scotia", terminals: 18, tags: ["Retail", "Multi-location"] },
    { id: "m-nb-012", name: "Granite Cliff Apparel",    region: "Ontario, CA", terminals:  7, tags: ["Retail", "Single-location"] },
  ],
  "summit": [
    { id: "m-sm-001", name: "Summit Coffee House",      region: "BC, CA",      terminals: 28, tags: ["F&B", "Multi-location", "VIP"] },
    { id: "m-sm-002", name: "Cascade Bistro",           region: "BC, CA",      terminals: 19, tags: ["F&B", "Multi-location"] },
    { id: "m-sm-003", name: "Cedar Park Pharmacy",      region: "Alberta, CA", terminals: 36, tags: ["Healthcare", "Multi-location"] },
    { id: "m-sm-004", name: "Glacier Grocers",          region: "BC, CA",      terminals: 47, tags: ["Retail", "Multi-location", "Enterprise"] },
    { id: "m-sm-005", name: "Mountain View Retail",     region: "BC, CA",      terminals: 12, tags: ["Retail", "Single-location"] },
    { id: "m-sm-006", name: "Sapphire Lake Resorts",    region: "Alberta, CA", terminals: 24, tags: ["Hospitality", "Multi-location", "VIP"] },
    { id: "m-sm-007", name: "Whitepine Supermarket",    region: "Yukon",       terminals: 15, tags: ["Retail", "Single-location"] },
    { id: "m-sm-008", name: "Birch & Stone Cafe",       region: "BC, CA",      terminals:  9, tags: ["F&B", "Single-location"] },
    { id: "m-sm-009", name: "Driftwood Diner Co.",      region: "BC, CA",      terminals: 21, tags: ["F&B", "Multi-location"] },
    { id: "m-sm-010", name: "Iron Range Outfitters",    region: "Alberta, CA", terminals: 14, tags: ["Retail", "Multi-location"] },
  ],
  "acme-sw": [],
};

// Session-level overlay for merchantsConfiguredForApp. Populated by the
// "Assign merchant" flow on the Deployments page — when the operator binds
// an extra merchant to an app, we add their id here so subsequent
// merchantsConfiguredForApp() calls include them. Cleared on page reload.
//   Key shape: `${tenantId}:${appId}` → Set<merchantId>
const MERCHANT_APP_ADDITIONS = {};

// Session-level overlay for the reverse — merchants that have been
// unassigned (with or without uninstall). Subtracted from the merchantsConfiguredForApp
// output so the row disappears from the Deployments table immediately.
//   Key shape: `${tenantId}:${appId}` → Set<merchantId>
const MERCHANT_APP_REMOVALS = {};

// Deterministically pick which merchants in a tenant's fleet have a given app
// configured, merged with any session-level additions (see above) and minus
// any session-level removals. The same (tenant, app) pair always returns the
// same base set.
function merchantsConfiguredForApp(tenantId, appId) {
  const fleet = MERCHANT_FLEETS[tenantId] || [];
  if (fleet.length === 0) return [];
  // Hash app id → choose ~70% of the fleet
  let h = 0;
  for (const c of appId) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const additions = MERCHANT_APP_ADDITIONS[`${tenantId}:${appId}`] || new Set();
  const removals  = MERCHANT_APP_REMOVALS [`${tenantId}:${appId}`] || new Set();
  return fleet.filter((m, i) => {
    if (removals.has(m.id)) return false;
    return additions.has(m.id) || ((h + i * 7) % 10) < 7;
  });
}

// Bind a merchant to an app at a given version. Used by the "Assign merchant"
// flow on the Deployments page — writes both the configuration overlay
// (so the merchant shows up in merchantsConfiguredForApp) and the rollout
// history (so getMerchantCurrentVersion can resolve the version).
function assignMerchantToApp(tenantId, appId, merchantId, versionId) {
  const k = `${tenantId}:${appId}`;
  if (!MERCHANT_APP_ADDITIONS[k]) MERCHANT_APP_ADDITIONS[k] = new Set();
  MERCHANT_APP_ADDITIONS[k].add(merchantId);
  // A re-assigned merchant who was previously unassigned must clear their
  // removal entry, else they'd still be filtered out.
  MERCHANT_APP_REMOVALS[k]?.delete(merchantId);
  recordRollout(tenantId, appId, versionId, [merchantId]);
}

// Unassign a merchant from an app — soft remove. The (merchant, app)
// relationship disappears from Deployments / Merchants→Apps, but
// ROLLOUT_HISTORY is left alone so terminals already running the app keep
// it. No future updates land. Inverse of assignMerchantToApp.
function unassignMerchantFromApp(tenantId, appId, merchantId) {
  const k = `${tenantId}:${appId}`;
  if (!MERCHANT_APP_REMOVALS[k]) MERCHANT_APP_REMOVALS[k] = new Set();
  MERCHANT_APP_REMOVALS[k].add(merchantId);
  // Drop the additions entry if present, else the row would still resolve.
  MERCHANT_APP_ADDITIONS[k]?.delete(merchantId);
  // Also drop the (packageId) entry from MERCHANTS[merchantId].apps so the
  // Merchants → Apps tab refreshes. The two stores (MERCHANT_FLEETS for the
  // Deployments side, MERCHANTS.apps for the per-merchant side) are
  // intentionally independent in this mock, so we touch both.
  const mer = (window.MERCHANTS || []).find(m => m.id === merchantId);
  if (mer?.apps) {
    mer.apps = mer.apps.filter(a => a.packageId !== appId);
    mer.updatedAt = "just now";
  }
  // Clear any strategy override(s) so re-assigning later doesn't pick up a
  // stale strategy from a prior life. There may be multiple version-keyed
  // entries per (merchant, app); wipe them all.
  const pkg = (window.APPS || []).find(a => a.id === appId)?.package;
  if (pkg) {
    const prefix = `${merchantId}:${pkg}:`;
    Object.keys(MERCHANT_APP_UPGRADE_STRATEGY).forEach(key => {
      if (key.startsWith(prefix)) delete MERCHANT_APP_UPGRADE_STRATEGY[key];
    });
  }
}

// Uninstall an app from every terminal a merchant runs. Strictly more
// destructive than unassignMerchantFromApp: same relationship-removal AND
// clears every (tenant, app, *) entry in ROLLOUT_HISTORY for this merchant
// so getMerchantCurrentVersion returns null (terminals show no install).
// In a real system this would also dispatch an uninstall command to each
// terminal under the chosen strategy — we simulate by clearing state.
function uninstallMerchantApp(tenantId, appId, merchantId) {
  unassignMerchantFromApp(tenantId, appId, merchantId);
  const prefix = `${tenantId}:${appId}:`;
  Object.keys(ROLLOUT_HISTORY).forEach(key => {
    if (key.startsWith(prefix)) ROLLOUT_HISTORY[key].delete(merchantId);
  });
}

// Standard 7-day staged rollout curve. Each row = day index (1-based) → percent.
const ROLLOUT_DEFAULT_CURVE = [
  { day: 1, pct:   1 },
  { day: 2, pct:   2 },
  { day: 3, pct:   5 },
  { day: 4, pct:  10 },
  { day: 5, pct:  20 },
  { day: 6, pct:  50 },
  { day: 7, pct: 100 },
];

// ─── Rollout history ──────────────────────────────────────
// Tracks which merchants are already running a given (tenant, app, version)
// snapshot. Successive rollouts of the same version add merchants to this
// set — they're never revoked at the rollout level (per product spec,
// removing an app from a merchant is a separate App-level action).
//
// Key shape: `${tenantId}:${appId}:${versionId}` → Set<merchantId>
const ROLLOUT_HISTORY = {
  // ─── Northbay Devices (ISO) ───
  // POS Pro — long-running app, staggered upgrade across the fleet:
  // most merchants on v30/v31, three early adopters on the v32 latest,
  // and one laggard (Granite Cliff) still on the original v29.
  "northbay:pos:v29":       new Set(["m-nb-001","m-nb-002","m-nb-003","m-nb-005","m-nb-006","m-nb-007","m-nb-009","m-nb-010","m-nb-011","m-nb-012"]),
  "northbay:pos:v30":       new Set(["m-nb-001","m-nb-002","m-nb-003","m-nb-005","m-nb-006","m-nb-007","m-nb-009","m-nb-011"]),
  "northbay:pos:v31":       new Set(["m-nb-002","m-nb-003","m-nb-006","m-nb-009","m-nb-011"]),
  "northbay:pos:v32":       new Set(["m-nb-002","m-nb-003","m-nb-006"]),
  // Stockroom — recently rolled v12 to half the fleet.
  "northbay:inventory:v10": new Set(["m-nb-001","m-nb-002","m-nb-004","m-nb-006","m-nb-009","m-nb-011"]),
  "northbay:inventory:v11": new Set(["m-nb-001","m-nb-002","m-nb-004","m-nb-006","m-nb-011"]),
  "northbay:inventory:v12": new Set(["m-nb-001","m-nb-004","m-nb-011"]),
  // Loyalty+ — small adoption, all on latest non-rejected build (v06).
  "northbay:loyalty:v05":   new Set(["m-nb-001","m-nb-003","m-nb-008","m-nb-010"]),
  "northbay:loyalty:v06":   new Set(["m-nb-003","m-nb-008","m-nb-010"]),
  // Timeclock — broad rollout; v15 is latest, two merchants still on v14.
  "northbay:timeclock:v14": new Set(["m-nb-001","m-nb-002","m-nb-003","m-nb-005","m-nb-008","m-nb-010","m-nb-012"]),
  "northbay:timeclock:v15": new Set(["m-nb-001","m-nb-002","m-nb-005","m-nb-008","m-nb-010"]),
  // Catalog Sync — fresh subscription; not yet pushed to all merchants.
  "northbay:catalog:v08":   new Set(["m-nb-001","m-nb-002","m-nb-004","m-nb-008"]),
  "northbay:catalog:v09":   new Set(["m-nb-001","m-nb-002","m-nb-008"]),
  // Insights — Northbay still on v03 (1.1.2). Upstream v04 (1.2.0) is
  // published but NOT yet approved into the local pool — surfaces as
  // "Update available" until the operator runs the Approve flow.
  "northbay:reporting:v03": new Set(["m-nb-001","m-nb-002","m-nb-004","m-nb-008","m-nb-011"]),
  // Acme Tipout — Specified-ISO app. Northbay rolled v22 to a handful of
  // hospitality merchants; v23 is the latest upstream, pending approval.
  "northbay:tipout:v22":    new Set(["m-nb-001","m-nb-004","m-nb-008","m-nb-010"]),
  // Acme Smart Receipt — was published, since unpublished. Northbay still
  // has v18 running on the merchants it rolled to; no further pushes
  // possible (app status === "unpublished").
  "northbay:smartreceipt:v18": new Set(["m-nb-001","m-nb-003","m-nb-006","m-nb-008"]),

  // ─── Summit Retail Co. (ISV + ISO) ───
  // POS Pro — larger fleet, similar staggered pattern.
  "summit:pos:v29":         new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-004","m-sm-005","m-sm-006","m-sm-007","m-sm-008","m-sm-009","m-sm-010"]),
  "summit:pos:v30":         new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-005","m-sm-006","m-sm-007","m-sm-009","m-sm-010"]),
  "summit:pos:v31":         new Set(["m-sm-002","m-sm-003","m-sm-005","m-sm-006","m-sm-007"]),
  "summit:pos:v32":         new Set(["m-sm-002","m-sm-003","m-sm-005"]),
  // Loyalty+
  "summit:loyalty:v05":     new Set(["m-sm-001","m-sm-002","m-sm-004","m-sm-006","m-sm-008"]),
  "summit:loyalty:v06":     new Set(["m-sm-001","m-sm-002","m-sm-006"]),
  // Insights / Reporting
  "summit:reporting:v03":   new Set(["m-sm-001","m-sm-003","m-sm-006","m-sm-009"]),
  "summit:reporting:v04":   new Set(["m-sm-001","m-sm-003"]),
  // Stockroom — Summit subscribed at v11 and rolled it out to most of the
  // fleet; upstream v12 is now published and waiting to be approved.
  "summit:inventory:v10":   new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-006","m-sm-008","m-sm-010"]),
  "summit:inventory:v11":   new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-006"]),
  // Catalog Sync — Summit on v08; upstream v09 not yet approved.
  "summit:catalog:v08":     new Set(["m-sm-001","m-sm-003","m-sm-006","m-sm-009"]),

  // ─── Summit's OWN-published apps deployed to Summit's merchants ───
  // Summit publishes timeclock + delivery + giftcard themselves; the ISV+ISO
  // contract means they also push these apps to their own merchants. These
  // rollouts use Summit-published versions directly — no "subscription"
  // intermediate (you don't subscribe to your own app). The local-pool
  // helper treats any version of a publisher's own app as in-pool, so
  // Target Version dropdowns offer every Summit-published version here.
  "summit:timeclock:v14":   new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-004","m-sm-005","m-sm-006","m-sm-009","m-sm-010"]),
  "summit:timeclock:v15":   new Set(["m-sm-001","m-sm-002","m-sm-005","m-sm-006","m-sm-009"]),
  "summit:delivery:v02":    new Set(["m-sm-001","m-sm-002","m-sm-006"]),
  "summit:giftcard:v06":    new Set(["m-sm-001","m-sm-002","m-sm-003","m-sm-006","m-sm-008"]),
};

function merchantsAlreadyOnVersion(tenantId, appId, versionId) {
  const key = `${tenantId}:${appId}:${versionId}`;
  return ROLLOUT_HISTORY[key] || new Set();
}

function recordRollout(tenantId, appId, versionId, merchantIds) {
  const key = `${tenantId}:${appId}:${versionId}`;
  if (!ROLLOUT_HISTORY[key]) ROLLOUT_HISTORY[key] = new Set();
  merchantIds.forEach(id => ROLLOUT_HISTORY[key].add(id));
}

// ─── Deployment state helpers ─────────────────────────────
// Reverse-lookup over ROLLOUT_HISTORY: for a given (tenant, app, merchant)
// return the *highest-version* the merchant has been rolled to. Version
// ordering is by numeric version.code (per product spec).
function getMerchantCurrentVersion(tenantId, appId, merchantId) {
  const app = (window.APPS || []).find(a => a.id === appId);
  if (!app) return null;
  let best = null;
  for (const v of app.versions) {
    const key = `${tenantId}:${appId}:${v.id}`;
    const set = ROLLOUT_HISTORY[key];
    if (set && set.has(merchantId)) {
      if (!best || (v.code || 0) > (best.code || 0)) best = v;
    }
  }
  return best;
}

// Returns rollup state for an app: [{ merchant, version, terminals,
// lastRolloutAt }]. `terminals` is an array of mock terminal records.
function getAppDeploymentState(tenantId, appId) {
  const fleet = (MERCHANT_FLEETS[tenantId] || []);
  return fleet
    .filter(m => merchantsConfiguredForApp(tenantId, appId).some(x => x.id === m.id))
    .map(m => {
      const version = getMerchantCurrentVersion(tenantId, appId, m.id);
      if (!version) return null;
      return {
        merchant: m,
        version,
        terminals: mockTerminalsForMerchant(m, version),
        lastRolloutAt: pseudoDate(`${tenantId}-${appId}-${m.id}-${version.id}`),
      };
    })
    .filter(Boolean);
}

// ─── Local-pool version helpers ───────────────────────────
// An app's "local pool" for a given tenant is the set of versions the tenant
// has approved (either via initial subscription or by Approving a subsequent
// release). Versions the upstream ISV has published but this tenant has NOT
// approved are NOT in the local pool — they are pull candidates.
//
// For tenants that publish the app themselves (own apps), every version is
// in the local pool by definition.
//
// Source of truth (mock model):
//   • current `subscribedVersionId` (the active snapshot pointer)
//   • any version that appears in ROLLOUT_HISTORY for (tenant, app, v) —
//     a past rollout proves the version was once approved into the pool.
function getLocalPoolVersions(tenantId, app) {
  if (!app) return [];
  const versions = app.versions || [];
  // Own app: publisher's local pool is the full version history of their app.
  if (app.publisherTenantId === tenantId) {
    return [...versions].sort((a, b) => (b.code || 0) - (a.code || 0));
  }
  const subs = (SUBSCRIBED_APPS[tenantId] || []);
  const sub = subs.find(s => s.appId === app.id);
  const localIds = new Set();
  if (sub?.subscribedVersionId) localIds.add(sub.subscribedVersionId);
  for (const v of versions) {
    const key = `${tenantId}:${app.id}:${v.id}`;
    if (ROLLOUT_HISTORY[key]) localIds.add(v.id);
  }
  return versions
    .filter(v => localIds.has(v.id))
    .sort((a, b) => (b.code || 0) - (a.code || 0));
}

// Highest-code version in the tenant's local pool — i.e., the newest version
// the tenant has approved. This is the correct "latest" for rollout/upgrade
// purposes on the subscriber side (NOT the upstream ISV's newest publish).
function getLatestLocalVersion(tenantId, app) {
  return getLocalPoolVersions(tenantId, app)[0] || null;
}

function isVersionInLocalPool(tenantId, app, versionId) {
  return getLocalPoolVersions(tenantId, app).some(v => v.id === versionId);
}

// Mock per-terminal state. Deterministic by merchant.id so it stays stable
// across re-renders. Each terminal carries its OWN installed version code
// (which may lag the merchant's deployment level). The terminal's status
// against any given target version is derived at read time by
// `computeTerminalStatus` — see screens.jsx.
function mockTerminalsForMerchant(merchant, version) {
  const count = merchant.terminals;
  // seed hash from merchant id only — terminals are stable across version
  // changes (their *status against a target* is what varies).
  let h = 0;
  for (const c of merchant.id) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const baseCode = version?.code || 0;
  const terminals = [];
  for (let i = 0; i < count; i++) {
    const r = (h + i * 17) % 100;
    // 75% are caught up to the merchant's current deployed version,
    // 20% are one minor behind, 5% are two minor behind. We model "behind"
    // by subtracting from the baseCode — the actual published version
    // with that code is looked up by the caller.
    const behindBy = r < 75 ? 0 : r < 95 ? 1 : 2;
    const currentVersionCode = Math.max(0, baseCode - behindBy);
    const sn = `T${(h + i * 7).toString(36).toUpperCase().slice(0, 6)}${String(i).padStart(3, "0")}`;
    terminals.push({ sn, currentVersionCode });
  }
  return terminals;
}

function pseudoDate(seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const months = ["Jan","Feb","Mar","Apr","May"];
  const m = months[h % months.length];
  const d = (h >> 4) % 28 + 1;
  return `${m} ${String(d).padStart(2, "0")}, 2026`;
}

// Version-comparison helper (by version.code).
function compareVersions(a, b) {
  return (a?.code || 0) - (b?.code || 0);
}

// ─── Per-version rejection state ──────────────────────────
// An ISO can mark a specific version as "skipped" (one-off — the next ISV
// release still notifies them) or "blocked" (permanent — the version stays
// hidden from pull candidates until the ISO explicitly unblocks). Both
// states are scoped to the (tenant, app) pair.
const VERSION_REJECTIONS = {
  "northbay:loyalty": new Map([["v07", "blocked"]]),
};

function getRejectionState(tenantId, appId, versionId) {
  const key = `${tenantId}:${appId}`;
  return (VERSION_REJECTIONS[key] && VERSION_REJECTIONS[key].get(versionId)) || null;
}

function setRejectionState(tenantId, appId, versionId, state) {
  const key = `${tenantId}:${appId}`;
  if (!VERSION_REJECTIONS[key]) VERSION_REJECTIONS[key] = new Map();
  if (state == null) VERSION_REJECTIONS[key].delete(versionId);
  else               VERSION_REJECTIONS[key].set(versionId, state);
}

// Latest pullable version for a (tenant, app) — the newest published version
// that hasn't been blocked or skipped by this tenant.
function latestPullableVersion(tenantId, app) {
  const versions = (app && app.versions) || [];
  for (const v of versions) {
    if (v.status !== "published") continue;
    if (getRejectionState(tenantId, app.id, v.id)) continue;
    return v;
  }
  return versions[0];
}

// ─── Phone screenshot mock — procedural, deterministic per (app, version, index)
// In production this would be <img src={screenshot.url} />. Each version stores
// its own screenshots, captured at upload time.
function PhoneScreenshot({ app, version, index = 0, size = "md", onClick }) {
  // Scale presets: width × height
  const sizes = {
    sm: { w: 96,  h: 170 },
    md: { w: 144, h: 256 },
    lg: { w: 220, h: 390 },
  };
  const { w, h } = sizes[size] || sizes.md;

  // Deterministic palette
  const seed = `${app?.package || "x"}|${version?.id || "x"}|${index}`;
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  const hue = (s % 360);
  const tint  = `oklch(94% 0.03 ${hue})`;
  const accent= `oklch(58% 0.18 ${hue})`;
  const acc2  = `oklch(48% 0.18 ${(hue + 28) % 360})`;
  const variant = s % 4;

  const words = (app?.name || "App").split(/[\s.+_/-]+/).filter(Boolean);
  const initials = ((words[0]?.[0] || "?") + (words[1] ? words[1][0] : "")).toUpperCase();

  const radius = Math.round(w * 0.09);
  const padX   = w * 0.06;
  const padY   = h * 0.04;

  const rowsCount = (n) => Array.from({ length: n }).map((_, i) => i);

  return (
    <button onClick={onClick} title={`${app?.name || ""} · screenshot ${index + 1}`}
      style={{
        width: w, height: h, flexShrink: 0,
        background: tint, borderRadius: radius,
        border: "1px solid var(--color-border-default)",
        overflow: "hidden", position: "relative",
        boxShadow: "var(--shadow-1)",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
      }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: h * 0.045, display: "flex", alignItems: "center",
        padding: `0 ${padX}px`,
        fontSize: Math.max(7, w * 0.055), fontFamily: "var(--font-family-mono)",
        color: "oklch(40% 0.02 270 / 0.8)", letterSpacing: "0.04em",
      }}>
        <span>9:41</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 3 }}>
          <span>5G</span><span>·</span><span>100%</span>
        </span>
      </div>
      <div style={{
        position: "absolute", top: h * 0.055, left: padX, right: padX,
        display: "flex", alignItems: "center", gap: w * 0.04,
      }}>
        <div style={{
          width: w * 0.10, height: w * 0.10,
          borderRadius: w * 0.025,
          background: `linear-gradient(135deg, ${accent}, ${acc2})`,
          color: "white", display: "grid", placeItems: "center",
          fontSize: w * 0.055, fontWeight: 700,
        }}>{initials}</div>
        <div style={{ flex: 1, height: w * 0.07, background: "oklch(82% 0.005 270)", borderRadius: w * 0.02 }} />
      </div>
      <div style={{ position: "absolute", top: h * 0.18, left: padX, right: padX, bottom: h * 0.08,
        display: "flex", flexDirection: "column", gap: padY * 0.7 }}>
        {variant === 0 && (
          <>
            <div style={{ height: h * 0.22, background: `linear-gradient(135deg, ${accent}, ${acc2})`,
              borderRadius: w * 0.04, padding: w * 0.05, color: "white" }}>
              <div style={{ fontSize: Math.max(7, w * 0.055), opacity: 0.85, fontWeight: 500 }}>Today</div>
              <div style={{ fontSize: w * 0.17, fontWeight: 600, marginTop: 1, fontFamily: "var(--font-family-mono)", letterSpacing: "-0.04em" }}>
                ${(s % 9000 + 1000).toString()}
              </div>
            </div>
            <SkeletonRows w={w} count={3} accent={accent} />
          </>
        )}
        {variant === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: padY * 0.5 }}>
            {rowsCount(4).map(i => (
              <div key={i} style={{
                height: h * 0.16, borderRadius: w * 0.035,
                background: i % 2 === 0 ? `linear-gradient(135deg, ${accent}, ${acc2})` : "oklch(96% 0.005 270)",
                border: i % 2 === 0 ? "none" : "1px solid oklch(86% 0.005 270)",
              }} />
            ))}
          </div>
        )}
        {variant === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: padY * 0.4 }}>
            {rowsCount(5).map(i => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: w * 0.04,
                padding: w * 0.025, background: "oklch(98% 0.003 270)",
                borderRadius: w * 0.025,
                border: "1px solid oklch(92% 0.005 270)",
              }}>
                <div style={{ width: w * 0.08, height: w * 0.08, borderRadius: "50%",
                  background: i === 0 ? accent : `oklch(90% 0.01 ${(hue + i * 30) % 360})` }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ height: w * 0.04, width: "70%", background: "oklch(70% 0.005 270)", borderRadius: 2 }} />
                  <div style={{ height: w * 0.03, width: "40%", background: "oklch(82% 0.005 270)", borderRadius: 2 }} />
                </div>
                <div style={{ width: w * 0.18, height: w * 0.04, background: "oklch(82% 0.005 270)", borderRadius: 2 }} />
              </div>
            ))}
          </div>
        )}
        {variant === 3 && (
          <>
            <div style={{ height: h * 0.06, background: accent, borderRadius: w * 0.025,
              display: "flex", alignItems: "center", paddingLeft: w * 0.04, color: "white",
              fontSize: w * 0.055, fontWeight: 600 }}>$24.50</div>
            <SkeletonRows w={w} count={5} accent={accent} dense />
          </>
        )}
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: h * 0.07, display: "flex",
        alignItems: "center", justifyContent: "space-around",
        background: "var(--color-bg-2)",
        borderTop: "1px solid oklch(92% 0.005 270)",
      }}>
        {rowsCount(4).map(i => (
          <span key={i} style={{
            width: w * 0.06, height: w * 0.06, borderRadius: "50%",
            background: i === 0 ? accent : "oklch(82% 0.005 270)",
          }} />
        ))}
      </div>
    </button>
  );
}

function SkeletonRows({ w, count = 3, accent, dense }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: dense ? w * 0.025 : w * 0.035, marginTop: dense ? 0 : w * 0.02 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: dense ? w * 0.08 : w * 0.1,
          borderRadius: w * 0.025,
          background: "oklch(96% 0.005 270)",
          border: "1px solid oklch(92% 0.005 270)",
          display: "flex", alignItems: "center", gap: w * 0.04,
          paddingLeft: w * 0.04,
        }}>
          <span style={{ width: w * 0.06, height: w * 0.06, borderRadius: "50%",
                         background: i === 0 ? accent : "oklch(86% 0.01 270)" }} />
          <span style={{ flex: 1, height: w * 0.03, background: "oklch(86% 0.005 270)", borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Screenshots strip — horizontal row, optional fullscreen lightbox
function Screenshots({ app, version, count = 4, size = "md" }) {
  const [active, setActive] = React.useState(null);
  const indices = Array.from({ length: count }).map((_, i) => i);
  return (
    <>
      <div style={{
        display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4,
      }}>
        {indices.map(i => (
          <PhoneScreenshot key={i} app={app} version={version} index={i} size={size}
            onClick={() => setActive(i)} />
        ))}
      </div>
      {active != null && (
        <div onClick={() => setActive(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "oklch(0% 0 0 / 0.55)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
        }}>
          <button onClick={(e) => { e.stopPropagation(); setActive(a => (a + count - 1) % count); }}
            style={{ color: "white", padding: 12, borderRadius: 999, background: "oklch(100% 0 0 / 0.1)" }}>
            <window.Ico name="chevl" size={20} />
          </button>
          <PhoneScreenshot app={app} version={version} index={active} size="lg" />
          <button onClick={(e) => { e.stopPropagation(); setActive(a => (a + 1) % count); }}
            style={{ color: "white", padding: 12, borderRadius: 999, background: "oklch(100% 0 0 / 0.1)" }}>
            <window.Ico name="chevr" size={20} />
          </button>
          <button onClick={() => setActive(null)} style={{
            position: "absolute", top: 18, right: 18,
            color: "white", padding: 10, borderRadius: 999, background: "oklch(100% 0 0 / 0.1)",
          }}>
            <window.Ico name="x" size={16} />
          </button>
        </div>
      )}
    </>
  );
}

Object.assign(window, {
  DEVICE_MODELS, APP_STATUS, APP_PUBLISH_MODE, VERSION_STATUS, REVIEW_STATE, SEVERITY, CATEGORIES, CUSTOMERS, ISO_COMPANIES, APPS, SUBSCRIBED_APPS, TENANT_NAMES,
  TENANT_PERMISSIONS, TENANT_EMPLOYEES, PENDING_APPROVALS, getPendingApproval, clearPendingApproval,
  UPGRADE_TIMING_OPTIONS, UPGRADE_NETWORK_OPTIONS, UPGRADE_STRATEGY_PRESETS,
  MERCHANT_APP_UPGRADE_STRATEGY, getMerchantStrategy, setMerchantStrategy, deleteMerchantStrategy,
  resolveStrategyPreset, strategyLabel, timingLabel, networkLabel, formatStrategySummary,
  MERCHANT_FLEETS, merchantsConfiguredForApp, ROLLOUT_DEFAULT_CURVE,
  ROLLOUT_HISTORY, merchantsAlreadyOnVersion, recordRollout, assignMerchantToApp,
  unassignMerchantFromApp, uninstallMerchantApp,
  VERSION_REJECTIONS, getRejectionState, setRejectionState, latestPullableVersion,
  getMerchantCurrentVersion, getAppDeploymentState, compareVersions,
  getLocalPoolVersions, getLatestLocalVersion, isVersionInLocalPool,
  mockTerminalsForMerchant,
  AppIcon, PhoneScreenshot, Screenshots, SCAN_FINDINGS_TEMPLATES, summariseFindings,
});

// ─── Seed strategy records for existing rollouts ─────────────────
// Deterministic per (mrchId, pkg, version) so the prototype always shows the
// same mix of strategies. We cycle through the three presets so every page
// has visual variety. Real implementations would persist this in a DB table.
(function seedMerchantStrategies() {
  const presetCycle = ["casual", "casual", "immediate", "casual", "custom", "casual", "immediate"];
  let i = 0;
  Object.entries(ROLLOUT_HISTORY).forEach(([key, set]) => {
    // key shape: `${tenantId}:${appId}:${versionId}`
    const [tenantId, appId, versionId] = key.split(":");
    const app = APPS.find(a => a.id === appId);
    if (!app) return;
    set.forEach(mrchId => {
      const k = _stratKey(mrchId, app.package, versionId);
      if (MERCHANT_APP_UPGRADE_STRATEGY[k]) return; // skip if already seeded (multiple versions on same merchant)
      const presetId = presetCycle[i++ % presetCycle.length];
      const preset = UPGRADE_STRATEGY_PRESETS.find(p => p.id === presetId);
      if (presetId === "custom") {
        // Mix it up for custom
        const timings  = ["immediate", "reboot", "rebootOrIdle10"];
        const networks = ["any", "wired", "cellCap"];
        setMerchantStrategy(mrchId, app.package, versionId, {
          strategy: "custom",
          timing: timings[i % 3],
          network: networks[i % 3],
          cellCapMb: [100, 200, 500][i % 3],
        });
      } else {
        setMerchantStrategy(mrchId, app.package, versionId, {
          strategy: presetId,
          timing: preset.timing,
          network: preset.network,
        });
      }
    });
  });
})();
