/* global React */
// ─────────────────────────────────────────────────────────────
// System Apps — data dictionaries, store, and helpers.
//
// System apps are platform-signed apps shipped as factory preinstalls on
// TOMS devices. Two flavors:
//
//   • Mandatory (必装应用) — required on every targeted terminal. Cannot
//     be uninstalled by the merchant. The TOMS admin controls the version
//     rollout: per-ISO target version + release strategy (timing/network),
//     authored from the System App detail page on this platform.
//
//   • Optional (选装应用) — pre-bundled but uninstallable; ISOs decide
//     whether to push them and choose the release strategy themselves
//     from their own portal. The admin only registers/publishes them
//     here — there is no rollout surface on this platform.
//
// The data shapes mirror the ISV view (Carbon Customer Portal) so the
// release-strategy machinery is identical:
//
//   SYS_UPGRADE_TIMING_OPTIONS   — timing dictionary
//   SYS_UPGRADE_NETWORK_OPTIONS  — network dictionary
//   SYS_UPGRADE_STRATEGY_PRESETS — Casual / Immediate / Custom
//   SYS_ROLLOUT_STRATEGY         — (appId, isoId, versionId) → strategy
//
// ─────────────────────────────────────────────────────────────

// ─── Upgrade-strategy data dictionaries ───────────────────
const SYS_UPGRADE_TIMING_OPTIONS = [
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

const SYS_UPGRADE_NETWORK_OPTIONS = [
  { id: "any",      label: "No restriction",
    body:   "Download over any available network.",
    detail: "Any network — WiFi, Ethernet, or cellular — may be used to download the upgrade. The fastest available connection wins." },
  { id: "wired",    label: "WiFi or Ethernet only",
    body:   "Cellular blocked. Saves cellular data.",
    detail: "Downloads are restricted to WiFi or Ethernet only. The terminal will not download over cellular data, ensuring the cellular plan is preserved." },
  { id: "cellCap",  label: "WiFi/Ethernet or cellular under cap",
    body:   "WiFi/Ethernet first; cellular only if this month's usage is below the cap.",
    detail: "Prefer WiFi or Ethernet. Cellular is only allowed when this month's cellular usage on the terminal is below the configured cap. Once the cap is hit, downloads pause until WiFi/Ethernet is available or the next billing cycle begins.",
    needsCap: true },
];

const SYS_UPGRADE_STRATEGY_PRESETS = [
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

// ─── Strategy store ────────────────────────────────────────
// Keyed by `${appId}:${isoId}:${versionId}`. Mutable.
const SYS_ROLLOUT_STRATEGY = {};

function _sysStratKey(appId, isoId, versionId) {
  return `${appId}:${isoId}:${versionId}`;
}
function getSysStrategy(appId, isoId, versionId) {
  return SYS_ROLLOUT_STRATEGY[_sysStratKey(appId, isoId, versionId)] || null;
}
function setSysStrategy(appId, isoId, versionId, partial) {
  const key = _sysStratKey(appId, isoId, versionId);
  const preset = SYS_UPGRADE_STRATEGY_PRESETS.find(p => p.id === (partial?.strategy || "casual"));
  const next = {
    appId, isoId, versionId,
    strategy:  partial?.strategy || "casual",
    timing:    partial?.timing  || preset?.timing  || "reboot",
    network:   partial?.network || preset?.network || "any",
    cellCapMb: partial?.cellCapMb != null ? partial.cellCapMb : 100,
    slots:     Array.isArray(partial?.slots) && partial.slots.length
                 ? partial.slots
                 : [{ start: "02:00", end: "04:00" }],
  };
  SYS_ROLLOUT_STRATEGY[key] = next;
  return next;
}
function deleteSysStrategy(appId, isoId, versionId) {
  delete SYS_ROLLOUT_STRATEGY[_sysStratKey(appId, isoId, versionId)];
}

function resolveSysStrategyPreset(record) {
  if (!record) return null;
  if (record.strategy) return record.strategy;
  const match = SYS_UPGRADE_STRATEGY_PRESETS.find(p =>
    p.id !== "custom" && p.timing === record.timing && p.network === record.network);
  return match ? match.id : "custom";
}
function sysStrategyLabel(idOrRecord) {
  const id = typeof idOrRecord === "string" ? idOrRecord : resolveSysStrategyPreset(idOrRecord);
  const p = SYS_UPGRADE_STRATEGY_PRESETS.find(x => x.id === id);
  return p ? p.label : "Not set";
}
function sysTimingLabel(id) {
  return (SYS_UPGRADE_TIMING_OPTIONS.find(o => o.id === id) || {}).label || id || "—";
}
function sysNetworkLabel(id) {
  return (SYS_UPGRADE_NETWORK_OPTIONS.find(o => o.id === id) || {}).label || id || "—";
}
function formatSysStrategySummary(record) {
  if (!record) return "Not set";
  let t = sysTimingLabel(record.timing);
  if (record.timing === "scheduled") {
    const slots = Array.isArray(record.slots) ? record.slots : [];
    t = slots.length
      ? `Scheduled ${slots.map(s => `${s.start}–${s.end}`).join(", ")}`
      : "Scheduled (no windows)";
  }
  let n = sysNetworkLabel(record.network);
  if (record.network === "cellCap") n = `Cellular < ${record.cellCapMb} MB / mo`;
  return `${t} · ${n}`;
}

// ─── App icon helper (reused from the existing system-apps file) ──
const SAAppIcon = ({ name, pkg, size = 32, radius = 7 }) => {
  let h = 0;
  for (const c of String(pkg || name || '?')) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const h1 = h % 360;
  const h2 = (h1 + 40) % 360;
  const letter = (name || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flex: 'none',
      background: `linear-gradient(135deg, oklch(62% 0.16 ${h1}), oklch(48% 0.16 ${h2}))`,
      color: '#fff', display: 'grid', placeItems: 'center',
      fontWeight: 700, fontSize: Math.round(size * 0.42),
      letterSpacing: '-0.02em',
      boxShadow: '0 1px 2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)',
    }}>{letter}</div>
  );
};

// ─── Seed apps ─────────────────────────────────────────────
// Mirrors the prior system-apps mock, split into mandatory vs. optional.
// Mandatory apps additionally carry a `rollouts` mock that the ISO-rollouts
// tab seeds from. Versions follow the same shape as ISV apps.
function _mkSysVer(name, code, status, uploaded, published, notes, scan = 'clean', size) {
  return {
    id: `v-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${code}`,
    name, code,
    size: size || `${(10 + (code % 30)).toFixed(1)} MB`,
    uploaded, published, status, scan, notes,
    perms: 8 + (code % 10), minSdk: 24, targetSdk: 34,
  };
}

const SYSTEM_APPS_V2_SEED = [
  // ─── Mandatory ────────────────────────────────────────
  { id: 'sys-launcher', pkg: 'com.npt.launcher', name: 'TOMS Launcher',
    cat: 'Pre-installed', signer: 'system', kind: 'mandatory',
    models: ['ALL'], ver: '12.4.1', uploaded: 'May 12, 2026',
    terminals: 8420, scan: 'clean', status: 'published',
    notes: 'Home shell on every TOMS device. Required.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('12.4.1', 12041, 'published',   'May 11, 2026', 'May 12, 2026', 'Improved boot animation, fixed status-bar overlap on N950.'),
      _mkSysVer('12.4.0', 12040, 'published',   'May 02, 2026', 'May 03, 2026', 'New widget grid; deprecated legacy app drawer.'),
      _mkSysVer('12.3.5', 12035, 'unpublished', 'Apr 14, 2026', 'Apr 15, 2026', 'Hotfix superseded by 12.4.0.', 'cleanish'),
    ],
  },
  { id: 'sys-mdm', pkg: 'com.npt.mdm.agent', name: 'MDM Agent',
    cat: 'System', signer: 'system', kind: 'mandatory',
    models: ['ALL'], ver: '7.2.0', uploaded: 'May 09, 2026',
    terminals: 8420, scan: 'clean', status: 'published',
    notes: 'Device management & policy enforcement. Required.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('7.2.0', 720, 'published', 'May 08, 2026', 'May 09, 2026', 'New compliance reporting endpoints; faster policy fetch.'),
      _mkSysVer('7.1.4', 714, 'published', 'Apr 20, 2026', 'Apr 21, 2026', 'Battery-aware sync windows.'),
      _mkSysVer('7.1.3', 713, 'unpublished', 'Mar 28, 2026', 'Mar 29, 2026', 'Retired after policy-cache regression. Hotfixed in 7.1.4.', 'cleanish'),
    ],
  },
  { id: 'sys-updater', pkg: 'com.npt.ota.updater', name: 'OTA Updater',
    cat: 'System', signer: 'system', kind: 'mandatory',
    models: ['ALL'], ver: '5.9.3', uploaded: 'May 06, 2026',
    terminals: 8420, scan: 'clean', status: 'published',
    notes: 'Delivers firmware and system app updates over-the-air.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('5.9.3', 593, 'published', 'May 05, 2026', 'May 06, 2026', 'Resumeable downloads; safer fallback partition handling.'),
      _mkSysVer('5.9.2', 592, 'published', 'Apr 11, 2026', 'Apr 12, 2026', 'Bandwidth throttling per ISO policy.'),
    ],
  },
  { id: 'sys-keymgr', pkg: 'com.npt.keymgr', name: 'Key Manager',
    cat: 'System', signer: 'system', kind: 'mandatory',
    models: ['N950', 'N750P', 'S90'], ver: '3.1.0', uploaded: 'May 04, 2026',
    terminals: 3120, scan: 'clean', status: 'published',
    notes: 'EMV key injection & rotation. Required on payment models.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('3.1.0', 310, 'published', 'May 03, 2026', 'May 04, 2026', 'Adds RKMS protocol support.'),
      _mkSysVer('3.0.7', 307, 'published', 'Mar 18, 2026', 'Mar 20, 2026', 'Key-rotation reliability fixes.'),
    ],
  },

  // ─── Optional ─────────────────────────────────────────
  { id: 'sys-diag', pkg: 'com.npt.diagnostics', name: 'Diagnostics',
    cat: 'Utility', signer: 'npt', kind: 'optional',
    models: ['ALL'], ver: '2.0.4', uploaded: 'May 01, 2026',
    terminals: 4280, scan: 'clean', status: 'published',
    notes: 'On-device hardware checks; surfaced in the ticket workbench.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('2.0.4', 204, 'published', 'Apr 30, 2026', 'May 01, 2026', 'New self-test suite for cellular radio.'),
      _mkSysVer('2.0.3', 203, 'published', 'Mar 22, 2026', 'Mar 23, 2026', 'Battery health probe accuracy improved.'),
    ],
  },
  { id: 'sys-kiosk', pkg: 'com.npt.kiosk.lock', name: 'Kiosk Lockdown',
    cat: 'Utility', signer: 'npt', kind: 'optional',
    models: ['X800', 'N950'], ver: '1.4.2', uploaded: 'Apr 22, 2026',
    terminals: 612, scan: 'cleanish', status: 'unpublished',
    notes: 'Enforces single-app mode on dedicated kiosk units. Currently withdrawn pending re-cert.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('1.4.2', 142, 'unpublished', 'Apr 22, 2026', 'Apr 22, 2026', 'Pulled for compliance re-cert. Re-publish on approval.', 'cleanish'),
      _mkSysVer('1.4.1', 141, 'unpublished', 'Mar 30, 2026', 'Apr 01, 2026', 'Superseded; awaiting re-cert.'),
    ],
  },
  { id: 'sys-printtest', pkg: 'com.npt.printtest', name: 'Printer Test',
    cat: 'Utility', signer: 'npt', kind: 'optional',
    models: ['N950', 'N750P', 'N750', 'S90'], ver: '1.2.0', uploaded: 'Apr 18, 2026',
    terminals: 2110, scan: 'clean', status: 'published',
    notes: 'Generates calibration receipts for the on-device thermal printer.', publishedBy: 'admin@toms',
    versions: [
      _mkSysVer('1.2.0', 120, 'published', 'Apr 17, 2026', 'Apr 18, 2026', 'Adds barcode density test card.'),
      _mkSysVer('1.1.0', 110, 'published', 'Feb 28, 2026', 'Mar 01, 2026', 'Initial release for the S90 print head.'),
    ],
  },
];

// Drop any leftover state from the old prototype, then re-seed fresh.
window.SYSTEM_APPS = SYSTEM_APPS_V2_SEED.map(a => ({ ...a, versions: [...a.versions] }));

// ─── ISO targets ──────────────────────────────────────────
// We treat every customer that holds an ISO contract as a rollout target
// for mandatory system apps. Each ISO row gets its own target version +
// release strategy on the System App detail page (mirrors ISV view's
// "Subscribed Deployments" tab).
function getIsoTargets() {
  const customers = window.SEED_CUSTOMERS || [];
  // Filter to those that carry an ISO contract.
  return customers
    .filter(c => (c.contracts || []).some(k => k.kind === 'ISO'))
    .map(c => {
      // Deterministic terminal count from the customer id so the same
      // mock value renders every render.
      let h = 0; for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
      const terminals = 80 + (h % 1600);
      const merchants = 8  + (h % 80);
      return { id: c.id, name: c.name, country: c.country, terminals, merchants, locked: !!c.locked };
    });
}

// ─── Per-app rollout assignments (mandatory only) ──────────
// SYS_ROLLOUTS[appId] = { [isoId]: { targetVersionId, assignedAt } }.
// Strategy lives in SYS_ROLLOUT_STRATEGY keyed by (app, iso, version).
const SYS_ROLLOUTS = {};

function getAppRollouts(appId) {
  return SYS_ROLLOUTS[appId] || {};
}
function setAppRollout(appId, isoId, patch) {
  if (!SYS_ROLLOUTS[appId]) SYS_ROLLOUTS[appId] = {};
  SYS_ROLLOUTS[appId][isoId] = { ...SYS_ROLLOUTS[appId][isoId], ...patch };
  return SYS_ROLLOUTS[appId][isoId];
}
function deleteAppRollout(appId, isoId) {
  if (SYS_ROLLOUTS[appId]) delete SYS_ROLLOUTS[appId][isoId];
}

// ─── Seed rollouts + strategies for mandatory apps ─────────
// Every ISO target is enrolled on every mandatory app at the latest
// published version. Strategies cycle through the three presets so the
// table shows visual variety from the start.
(function seedRollouts() {
  const isos = getIsoTargets();
  if (isos.length === 0) {
    // SEED_CUSTOMERS isn't loaded yet — fall back to a tiny inline list
    // so the demo still renders something. The shell will re-seed once
    // SEED_CUSTOMERS arrives (we listen for SEED_CUSTOMERS_READY below).
    return;
  }
  _doSeedRollouts(isos);
})();

function _doSeedRollouts(isos) {
  const presets = ['casual', 'immediate', 'custom'];
  const mandatoryApps = (window.SYSTEM_APPS || []).filter(a => a.kind === 'mandatory');
  let i = 0;
  mandatoryApps.forEach(app => {
    const latestPublished = app.versions.find(v => v.status === 'published');
    if (!latestPublished) return;
    isos.forEach(iso => {
      // 70%: on the latest version. 30%: pinned to a previous published
      // version so the table shows "behind" rows alongside "synced".
      const behind = (i % 10) >= 7 && app.versions.length > 1;
      const previousPublished = app.versions.find((v, idx) => idx > 0 && v.status === 'published');
      const targetV = behind && previousPublished ? previousPublished : latestPublished;
      setAppRollout(app.id, iso.id, {
        targetVersionId: targetV.id,
        assignedAt: 'May 02, 2026',
      });
      const presetId = presets[i % presets.length];
      if (presetId === 'custom') {
        setSysStrategy(app.id, iso.id, targetV.id, {
          strategy: 'custom',
          timing: ['reboot', 'rebootOrIdle10', 'scheduled'][i % 3],
          network: ['any', 'wired', 'cellCap'][i % 3],
          cellCapMb: 250,
        });
      } else {
        setSysStrategy(app.id, iso.id, targetV.id, { strategy: presetId });
      }
      i++;
    });
  });
}

// Re-seed once SEED_CUSTOMERS becomes available (data.jsx loads after this
// module's first execution might happen before SEED_CUSTOMERS exists when
// the load order shifts).
if (!(window.SEED_CUSTOMERS || []).length) {
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    if ((window.SEED_CUSTOMERS || []).length) {
      _doSeedRollouts(getIsoTargets());
      clearInterval(poll);
    } else if (attempts > 40) {
      clearInterval(poll);
    }
  }, 50);
}

Object.assign(window, {
  SYS_UPGRADE_TIMING_OPTIONS,
  SYS_UPGRADE_NETWORK_OPTIONS,
  SYS_UPGRADE_STRATEGY_PRESETS,
  SYS_ROLLOUT_STRATEGY,
  SYS_ROLLOUTS,
  getSysStrategy, setSysStrategy, deleteSysStrategy,
  resolveSysStrategyPreset, sysStrategyLabel, sysTimingLabel,
  sysNetworkLabel, formatSysStrategySummary,
  getIsoTargets, getAppRollouts, setAppRollout, deleteAppRollout,
  SAAppIcon, _mkSysVer,
});
