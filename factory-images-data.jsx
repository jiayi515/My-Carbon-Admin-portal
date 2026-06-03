/* global React */
// ─────────────────────────────────────────────────────────────
// Factory Images — Day 0 pre-install spec.
//
// A Factory Image is the spec the factory follows when flashing a
// fresh-off-the-line device:
//   "For model X, install firmware F, system apps A/B, ISV apps C."
//
// Versus Releases (Day 2+): Releases are the desired state PUBLISHED to
// ISO so they decide upgrades. Factory Images are pinned at flash time
// and physically loaded by the factory (QR scan or KM bundle).
//
// Shape:
//   id               'FI-2026-NNNN'
//   name             human label
//   isoCustomerIds   ISO customers this template provisions for
//   payload.byModel  per-model bundle (see below)
//   qr               { token } — factory scan target
//   ownerEmail       NPT staff who maintains this template
//   createdAt/By, updatedAt/By, events[]
//
// payload.byModel[modelCode]:
//   firmwareRefs:   [{ firmwareId, versionId }, …]   (one per device flag)
//   systemAppRefs:  [{ appId, versionId }, …]
//   isvAppRefs:     [{ appId, versionId }, …]
//
// Constraints (enforced in UI):
//   • For each (model, device flag) tuple ≤ 1 firmware version.
//     A model may have multiple device flags (A7 / A10 / A12 …) and the
//     image may bundle one firmware per flag (different Android SKUs).
//   • System app & ISV app refs may be multi.
//   • Editing the image at any time is allowed. Devices already provisioned
//     keep their own version snapshot at flash time (see Device.preinstalled).
// ─────────────────────────────────────────────────────────────

// ── Seed helpers ────────────────────────────────────────
const __fiT = (daysAgo, hoursAgo = 0) =>
  new Date(Date.UTC(2026, 4, 25, 12) - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();

const __fiIsoIds = (n = 8) =>
  (window.SEED_CUSTOMERS || [])
    .filter(c => (c.contracts || []).some(k => k.kind === 'ISO'))
    .slice(0, n)
    .map(c => c.id);

// Pick a firmware version ref for (modelCode, deviceFlag, versionName).
const __fiPickFw = (modelCode, deviceFlag, versionName) => {
  const fw = (window.SEED_FIRMWARE || []).find(f => f.modelCode === modelCode && f.deviceFlag === deviceFlag);
  if (!fw) return null;
  const v = (fw.versions || []).find(v => v.versionName === versionName) || fw.versions?.[0];
  if (!v) return null;
  return { firmwareId: fw.id, versionId: v.id };
};

const __fiPickSysApp = (pkg, verName) => {
  const a = (window.SYSTEM_APPS || []).find(x => x.pkg === pkg);
  if (!a) return null;
  const v = (a.versions || []).find(v => v.name === verName) || a.versions?.[0];
  if (!v) return null;
  return { appId: a.id, versionId: v.id };
};

const __fiPickIsvApp = (pkg, verName) => {
  const a = (window.SEED_APPS || []).find(x => x.package === pkg);
  if (!a) return null;
  const v = (a.versions || []).find(v => v.name === verName) || a.versions?.[0];
  if (!v) return null;
  return { appId: a.id, versionId: v.id };
};

const __fiQR = (id) => ({
  token: `qr_${id.toLowerCase().replace(/-/g, '')}_${Math.random().toString(36).slice(2, 10)}`,
});

// ── Seed factory images ──────────────────────────────────
(function buildFactoryImageSeed() {
  const isos = __fiIsoIds(8);

  const seeds = [
    // ── 1 — Active baseline, mixed models, mostly system apps ──
    {
      id: 'FI-2026-0001',
      name: 'NA Universal Baseline · Q2',
      isoCustomerIds: isos.slice(0, 3),
      payload: {
        byModel: {
          'N950': {
            firmwareRefs:  [__fiPickFw('N950', 'A12', 'V2.3.1'), __fiPickFw('N950', 'A10', 'V2.3.1')].filter(Boolean),
            systemAppRefs: [__fiPickSysApp('com.npt.launcher', '12.4.1'), __fiPickSysApp('com.npt.mdm.agent', '7.2.0'), __fiPickSysApp('com.npt.keymgr', '3.1.0'), __fiPickSysApp('com.npt.ota.updater', '5.9.3')].filter(Boolean),
            isvAppRefs:    [__fiPickIsvApp('com.northwind.pos.pro', '4.3.2')].filter(Boolean),
          },
          'S60': {
            firmwareRefs:  [__fiPickFw('S60', 'A12', 'V1.7.2')].filter(Boolean),
            systemAppRefs: [__fiPickSysApp('com.npt.launcher', '12.4.1'), __fiPickSysApp('com.npt.mdm.agent', '7.2.0'), __fiPickSysApp('com.npt.ota.updater', '5.9.3'), __fiPickSysApp('com.npt.diagnostics', '2.0.4')].filter(Boolean),
            isvAppRefs:    [],
          },
        },
      },
      qr: __fiQR('FI-2026-0001'),
      ownerEmail: 'amelia.singh@carbon',
      createdAt: __fiT(58), createdBy: 'amelia.singh@carbon',
      updatedAt: __fiT(3, 4), updatedBy: 'amelia.singh@carbon',
      events: [
        { at: __fiT(58),    kind: 'created',  actor: 'amelia.singh@carbon', text: 'Created' },
        { at: __fiT(28, 6), kind: 'edited',   actor: 'amelia.singh@carbon', text: 'Bumped N950 STD firmware V2.3.0 → V2.3.1' },
        { at: __fiT(15, 2), kind: 'edited',   actor: 'amelia.singh@carbon', text: 'Added Northwind POS Pro 4.3.2 to N950 payload' },
        { at: __fiT(3, 4),  kind: 'promoted', actor: 'amelia.singh@carbon', text: 'Promoted to Release REL-2026-0001' },
      ],
    },

    // ── 2 — Active, single model, large fleet ──
    {
      id: 'FI-2026-0002',
      name: 'S30 Retail Baseline',
      isoCustomerIds: isos.slice(2, 6),
      payload: {
        byModel: {
          'S30': {
            firmwareRefs:  [__fiPickFw('S30', 'A10', 'V1.4.0')].filter(Boolean),
            systemAppRefs: [__fiPickSysApp('com.npt.launcher', '12.4.1'), __fiPickSysApp('com.npt.mdm.agent', '7.2.0'), __fiPickSysApp('com.npt.ota.updater', '5.9.3')].filter(Boolean),
            isvAppRefs:    [],
          },
        },
      },
      qr: __fiQR('FI-2026-0002'),
      ownerEmail: 'taylor.kim@carbon',
      createdAt: __fiT(42), createdBy: 'taylor.kim@carbon',
      updatedAt: __fiT(11), updatedBy: 'taylor.kim@carbon',
      events: [
        { at: __fiT(42), kind: 'created',  actor: 'taylor.kim@carbon', text: 'Created' },
        { at: __fiT(11), kind: 'edited',   actor: 'taylor.kim@carbon', text: 'Bumped OTA Updater 5.9.2 → 5.9.3' },
      ],
    },

    // ── 3 — Active, X800 RTOS kiosk ──
    {
      id: 'FI-2026-0003',
      name: 'X800 Kiosk Image',
      isoCustomerIds: [isos[6]].filter(Boolean),
      payload: {
        byModel: {
          'X800': {
            firmwareRefs:  [__fiPickFw('X800', 'STD', 'V1.0.7')].filter(Boolean),
            systemAppRefs: [],
            isvAppRefs:    [],
          },
        },
      },
      qr: __fiQR('FI-2026-0003'),
      ownerEmail: 'amelia.singh@carbon',
      createdAt: __fiT(33), createdBy: 'amelia.singh@carbon',
      updatedAt: __fiT(33), updatedBy: 'amelia.singh@carbon',
      events: [
        { at: __fiT(33), kind: 'created',  actor: 'amelia.singh@carbon', text: 'Created' },
      ],
    },

    // ── 4 — Multi-model image ──
    {
      id: 'FI-2026-0004',
      name: 'N950 EMV Hardened',
      isoCustomerIds: isos.slice(0, 2),
      payload: {
        byModel: {
          'N950': {
            firmwareRefs:  [__fiPickFw('N950', 'A10', 'V2.3.1')].filter(Boolean),
            systemAppRefs: [__fiPickSysApp('com.npt.keymgr', '3.1.0'), __fiPickSysApp('com.npt.mdm.agent', '7.2.0')].filter(Boolean),
            isvAppRefs:    [],
          },
        },
      },
      qr: __fiQR('FI-2026-0004'),
      ownerEmail: 'jordan.diaz@carbon',
      createdAt: __fiT(2, 4), createdBy: 'jordan.diaz@carbon',
      updatedAt: __fiT(0, 8), updatedBy: 'jordan.diaz@carbon',
      events: [
        { at: __fiT(2, 4), kind: 'created', actor: 'jordan.diaz@carbon', text: 'Created' },
        { at: __fiT(0, 8), kind: 'edited',  actor: 'jordan.diaz@carbon', text: 'Added Key Manager 3.1.0 to payload' },
      ],
    },

    // ── 5 — Archived ──
    {
      id: 'FI-2026-0005',
      name: 'S60 Spring Baseline (legacy)',
      isoCustomerIds: isos.slice(4, 6),
      payload: {
        byModel: {
          'S60': {
            firmwareRefs:  [__fiPickFw('S60', 'A12', 'V1.7.1')].filter(Boolean),
            systemAppRefs: [__fiPickSysApp('com.npt.launcher', '12.4.1'), __fiPickSysApp('com.npt.mdm.agent', '7.2.0')].filter(Boolean),
            isvAppRefs:    [],
          },
        },
      },
      qr: __fiQR('FI-2026-0005'),
      ownerEmail: 'taylor.kim@carbon',
      createdAt: __fiT(98), createdBy: 'taylor.kim@carbon',
      updatedAt: __fiT(40), updatedBy: 'taylor.kim@carbon',
      events: [
        { at: __fiT(98), kind: 'created',   actor: 'taylor.kim@carbon', text: 'Created' },
      ],
    },
  ];

  window.SEED_FACTORY_IMAGES = seeds;
})();

// ── Helpers ─────────────────────────────────────────────

const findFactoryImageById = (id) =>
  (window.SEED_FACTORY_IMAGES || []).find(fi => fi.id === id);

const factoryImagesForIso = (isoCustomerId) =>
  (window.SEED_FACTORY_IMAGES || []).filter(fi =>
    (fi.isoCustomerIds || []).includes(isoCustomerId)
  );

const factoryImageModels = (fi) =>
  Object.keys(fi?.payload?.byModel || {});

const factoryImageTotalPackageCount = (fi) => {
  if (!fi?.payload?.byModel) return 0;
  let n = 0;
  for (const bundle of Object.values(fi.payload.byModel)) {
    n += (bundle.firmwareRefs || []).length;
    n += (bundle.systemAppRefs || []).length;
    n += (bundle.isvAppRefs    || []).length;
  }
  return n;
};

// Resolve a {firmwareId, versionId} ref against window.SEED_FIRMWARE.
// Returns { firmware, version } or null if not found.
const resolveFirmwareRef = (ref) => {
  if (!ref) return null;
  const fw = (window.SEED_FIRMWARE || []).find(f => f.id === ref.firmwareId);
  if (!fw) return null;
  const version = (fw.versions || []).find(v => v.id === ref.versionId);
  if (!version) return null;
  return { firmware: fw, version };
};

// Resolve a {appId, versionId} ref against window.SYSTEM_APPS.
const resolveSystemAppRef = (ref) => {
  if (!ref) return null;
  const app = (window.SYSTEM_APPS || []).find(a => a.id === ref.appId);
  if (!app) return null;
  const version = (app.versions || []).find(v => v.id === ref.versionId);
  if (!version) return null;
  return { app, version };
};

// Resolve a {appId, versionId} ref against window.SEED_APPS (ISV apps).
const resolveIsvAppRef = (ref) => {
  if (!ref) return null;
  const app = (window.SEED_APPS || []).find(a => a.id === ref.appId);
  if (!app) return null;
  const version = (app.versions || []).find(v => v.id === ref.versionId);
  if (!version) return null;
  return { app, version };
};

// Resolve refs to display-ready records via the helpers above.
const resolveFactoryImagePayload = (fi) => {
  const out = [];
  for (const [modelCode, bundle] of Object.entries(fi?.payload?.byModel || {})) {
    const firmwares = (bundle.firmwareRefs || []).map(r => window.resolveFirmwareRef?.(r)).filter(Boolean);
    const sysApps   = (bundle.systemAppRefs || []).map(r => window.resolveSystemAppRef?.(r)).filter(Boolean);
    const isvApps   = (bundle.isvAppRefs    || []).map(r => window.resolveIsvAppRef?.(r)).filter(Boolean);
    out.push({ modelCode, firmwares, systemApps: sysApps, isvApps });
  }
  return out;
};

// Compute total size across all model bundles. Reuses byte helpers from
// releases-data.jsx — falls back to 0 if those aren't loaded yet.
const factoryImageTotalSize = (fi) => {
  if (!fi?.payload?.byModel) return 0;
  let bytes = 0;
  for (const bundle of Object.values(fi.payload.byModel)) {
    for (const ref of (bundle.firmwareRefs || [])) {
      const r = window.resolveFirmwareRef?.(ref);
      if (r?.version?.fileSizeBytes) bytes += r.version.fileSizeBytes;
    }
    for (const ref of (bundle.systemAppRefs || [])) {
      const r = window.resolveSystemAppRef?.(ref);
      if (r?.version?.size) bytes += __parseSize(r.version.size);
    }
    for (const ref of (bundle.isvAppRefs || [])) {
      const r = window.resolveIsvAppRef?.(ref);
      if (r?.version?.size) bytes += __parseSize(r.version.size);
    }
  }
  return bytes;
};

function __parseSize(s) {
  const m = String(s).match(/([\d.]+)\s*(KB|MB|GB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  return n * (u === 'KB' ? 1024 : u === 'MB' ? 1024*1024 : 1024*1024*1024);
}

const getFactoryImageEligibleIsos = () =>
  (window.SEED_CUSTOMERS || []).filter(c => (c.contracts || []).some(k => k.kind === 'ISO'));

// All known model codes — pulled from firmware seed (since firmware is the
// model-binding source of truth). Used to populate the per-model picker.
const getFactoryImageKnownModels = () => {
  const set = new Set();
  for (const fw of (window.SEED_FIRMWARE || [])) {
    if (fw.modelCode) set.add(fw.modelCode);
  }
  return [...set].sort();
};

// Compact byte formatter shared by the factory-images screens.
const fmtBytes = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

Object.assign(window, {
  findFactoryImageById, factoryImagesForIso,
  factoryImageModels, factoryImageTotalPackageCount, factoryImageTotalSize,
  resolveFactoryImagePayload, getFactoryImageEligibleIsos, getFactoryImageKnownModels,
  resolveFirmwareRef, resolveSystemAppRef, resolveIsvAppRef,
  fmtBytes,
});
