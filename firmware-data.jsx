/* global React */
// ─────────────────────────────────────────────────────────────
// Firmware seed data + helpers.
//
// A firmware is the (modelCode, deviceFlag) tuple. Each firmware has
// versions[] underneath. The list page collapses versions to "latest
// per tuple"; the detail page shows the full version list.
//
// Each version has a `status` of:
//   pending-publish — audience is empty. Either never released, or was
//                     released and then unpublished (history is in publishEvents).
//                     Not visible to any ISO.
//   published       — audience is non-empty. Visible to the ISOs listed
//                     in publishedToIsoIds. Each ISO independently decides
//                     whether/when to roll it out to their merchant terminals.
//
// Note: there is no separate `unpublished` status. Clearing the audience
// (via Unpublish or by removing all ISOs in the Publish dialog) drops the
// version back to `pending-publish`; the unpublish event is still recorded
// in publishEvents for the activity timeline.
//
// Publish audience
//   publishedToIsoIds: ['c-xxx', ...]   — the ISO customers this
//                       version is visible to. Empty when draft or
//                       unpublished. Edits append `publishEvents`
//                       (publish / audience-edit / unpublish).
//
// File-format conventions (validated client-side on upload):
//   ANDROID : {model}_{device flag}_OTA_{version}.zip
//   RTOS    : {model}_{device flag}_OTA_{version}.zip
//   LINUX   : [{Model}]MAN_Patch_{startVersion}-{endVersion}_{customer}_{date}.NLD
//
// Linux is intentionally special-cased: no sub-package list and version
// range semantics (startVersion → endVersion) instead of a single name.
// ─────────────────────────────────────────────────────────────

const FW_OS_OPTIONS = ['ANDROID', 'LINUX', 'RTOS'];

const FW_OS_TONE = {
  ANDROID: 'success',
  LINUX:   'info',
  RTOS:    'warning',
};

// Per-OS upload metadata: filename pattern, hint text, mime-style ext.
const FW_OS_META = {
  ANDROID: {
    label:   'Android',
    ext:     '.zip',
    pattern: '{model}_{device flag}_OTA_{version}.zip',
    hint:    'Example: N950_STD_OTA_V2.3.1.zip',
    // Regex: ^([A-Za-z0-9-]+)_([A-Za-z0-9-]+)_OTA_(V?[\d.]+)\.zip$
    regex:   /^([A-Za-z0-9-]+)_([A-Za-z0-9-]+)_OTA_(V?[A-Za-z0-9.]+)\.zip$/i,
    parse:   (m) => ({
      modelCode:   m[1].toUpperCase(),
      deviceFlag:  m[2].toUpperCase(),
      versionName: m[3].startsWith('V') ? m[3] : 'V' + m[3],
      isRange:     false,
    }),
    hasSubPackages: true,
  },
  LINUX: {
    label:   'Linux',
    ext:     '.NLD',
    pattern: '[{Model}]MAN_Patch_{start version}-{end version}_{customer name}_{date}.NLD',
    hint:    'Example: [N750]MAN_Patch_V1.2-V1.4_AcmeISO_20260524.NLD',
    // Regex: ^\[([A-Za-z0-9-]+)\]MAN_Patch_(V?[\d.]+)-(V?[\d.]+)_([A-Za-z0-9-]+)_(\d{6,8})\.NLD$
    regex:   /^\[([A-Za-z0-9-]+)\]MAN_Patch_(V?[A-Za-z0-9.]+)-(V?[A-Za-z0-9.]+)_([A-Za-z0-9-]+)_(\d{6,8})\.NLD$/i,
    parse:   (m) => ({
      modelCode:    m[1].toUpperCase(),
      deviceFlag:   'MAN',                         // Linux NLD = MAN patch; deviceFlag derived from filename literal.
      versionStart: m[2].startsWith('V') ? m[2] : 'V' + m[2],
      versionEnd:   m[3].startsWith('V') ? m[3] : 'V' + m[3],
      versionName:  (m[2].startsWith('V') ? m[2] : 'V' + m[2]) + '→' + (m[3].startsWith('V') ? m[3] : 'V' + m[3]),
      customer:     m[4],
      date:         m[5],
      isRange:      true,
    }),
    hasSubPackages: false,
  },
  RTOS: {
    label:   'RTOS',
    ext:     '.zip',
    pattern: '{model}_{device flag}_OTA_{version}.zip',
    hint:    'Example: X800_EMV_OTA_V1.0.7.zip',
    regex:   /^([A-Za-z0-9-]+)_([A-Za-z0-9-]+)_OTA_(V?[A-Za-z0-9.]+)\.zip$/i,
    parse:   (m) => ({
      modelCode:   m[1].toUpperCase(),
      deviceFlag:  m[2].toUpperCase(),
      versionName: m[3].startsWith('V') ? m[3] : 'V' + m[3],
      isRange:     false,
    }),
    hasSubPackages: true,
  },
};

// Status tones for version chips
const FW_VERSION_TONE = {
  'pending-publish': { tone: 'neutral', label: 'Pending publish' },
  published:         { tone: 'success', label: 'Published' },
};

// Helper: derive an integer-ish "version code" from a name like V2.3.1
// → 20301. Names without numeric structure get a fallback hash.
const __versionNameToCode = (name) => {
  const m = (name || '').replace(/^V/i, '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return 1;
  const a = parseInt(m[1] || '0', 10);
  const b = parseInt(m[2] || '0', 10);
  const c = parseInt(m[3] || '0', 10);
  return a * 10000 + b * 100 + c;
};

// Fake md5 for seed data; backend will compute real ones.
const __fakeMd5 = (s) => {
  let h = 0xdeadbeef;
  for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return (hex + hex + hex + hex).slice(0, 32);
};

// Build a deterministic sub-package list for an Android/RTOS firmware.
const __androidPkgs = (modelCode, version) => [
  { name: 'boot.img',     size: '24.6 MB',  md5: __fakeMd5(modelCode + version + 'boot') },
  { name: 'system.img',   size: '128.4 MB', md5: __fakeMd5(modelCode + version + 'system') },
  { name: 'vendor.img',   size: '18.2 MB',  md5: __fakeMd5(modelCode + version + 'vendor') },
  { name: 'recovery.img', size: '12.8 MB',  md5: __fakeMd5(modelCode + version + 'recovery') },
  { name: 'update.bin',   size: '4.1 MB',   md5: __fakeMd5(modelCode + version + 'update') },
];

const __rtosPkgs = (modelCode, version) => [
  { name: 'kernel.bin',  size: '2.4 MB',  md5: __fakeMd5(modelCode + version + 'kernel') },
  { name: 'rootfs.bin',  size: '8.6 MB',  md5: __fakeMd5(modelCode + version + 'rootfs') },
  { name: 'app.bin',     size: '1.8 MB',  md5: __fakeMd5(modelCode + version + 'app') },
];

// ─── Seed firmwares ──────────────────────────────────────
// Built around DEVICE_MODELS so the catalog stays consistent.
const __t = (daysAgo) => new Date(Date.UTC(2026, 4, 21) - daysAgo * 86400000).toISOString();

// Pick the first N ISO customers as seed release targets so the list looks
// believable without invoking randomness.
const __seedIsoIds = () =>
  (window.SEED_CUSTOMERS || [])
    .filter(c => (c.contracts || []).some(k => k.kind === 'ISO'))
    .map(c => c.id);

const __mkVersion = ({ os, modelCode, deviceFlag, name, daysAgo, current, published, sizeMb, fileNameOverride, changelog, audience }) => {
  const code = __versionNameToCode(name);
  const meta = FW_OS_META[os];
  const fileName = fileNameOverride || `${modelCode}_${deviceFlag}_OTA_${name}.zip`;
  const publishedAt = published ? __t(Math.max(0, daysAgo - 1)) : null;
  const audienceIds = published ? (audience || []) : [];
  return {
    id:           `fwv-${modelCode}-${deviceFlag}-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    versionName:  name,
    versionCode:  code,
    fileName,
    fileSize:     `${sizeMb.toFixed(1)} MB`,
    fileSizeBytes: Math.round(sizeMb * 1024 * 1024),
    md5:          __fakeMd5(fileName),
    uploadedAt:   __t(daysAgo),
    uploadedBy:   'fw-pipeline@carbon',
    publishedAt,
    publishedBy:  published ? 'ops@carbon' : null,
    status:       published ? 'published' : 'pending-publish',
    current:      !!current,
    changelog:    changelog || 'Routine maintenance · security patches · bug fixes.',
    publishedToIsoIds: audienceIds,
    publishEvents: published
      ? [{ at: publishedAt, by: 'ops@carbon', action: 'publish', isoIds: audienceIds }]
      : [],
    packages:     meta.hasSubPackages
      ? (os === 'RTOS' ? __rtosPkgs(modelCode, name) : __androidPkgs(modelCode, name))
      : [],
  };
};

const __mkFirmware = ({ os, modelCode, deviceFlag, versions, customerScope }) => ({
  id:          `fw-${modelCode}-${deviceFlag}`.toLowerCase(),
  modelCode,
  deviceFlag,
  os,
  customerScope: customerScope || null,  // Linux MAN patches are scoped to a customer
  versions,
});

// Materialise at script-load. Other modules (app.jsx) re-read window.SEED_FIRMWARE.
(function buildSeed() {
  const isoIds = __seedIsoIds();
  // Audience presets so the seed shows realistic variation between versions
  // (some go to all ISOs, some target a subset for beta / per-region rollout).
  const audAll      = isoIds;
  const audMost     = isoIds.slice(0, Math.max(1, isoIds.length - 2));
  const audFirst3   = isoIds.slice(0, 3);
  const audFirst1   = isoIds.slice(0, 1);
  const fw = [
    __mkFirmware({
      os: 'ANDROID', modelCode: 'N950', deviceFlag: 'A12',
      versions: [
        __mkVersion({ os:'ANDROID', modelCode:'N950', deviceFlag:'A12', name:'V2.3.1', daysAgo:3,   current:true,  published:true,  sizeMb:184.2, audience: audFirst3, changelog:'New EMV L2 kernel · NFC stability fixes · TLS 1.3 support.' }),
        __mkVersion({ os:'ANDROID', modelCode:'N950', deviceFlag:'A12', name:'V2.3.0', daysAgo:21,  current:false, published:true,  sizeMb:183.6, audience: audAll,    changelog:'Initial 2.3 line · OS upgrade to Android 13.' }),
        __mkVersion({ os:'ANDROID', modelCode:'N950', deviceFlag:'A12', name:'V2.2.4', daysAgo:62,  current:false, published:false, sizeMb:181.0, changelog:'Hotfix · printer queue race condition.' }),
      ],
    }),
    __mkFirmware({
      os: 'ANDROID', modelCode: 'N950', deviceFlag: 'A10',
      versions: [
        __mkVersion({ os:'ANDROID', modelCode:'N950', deviceFlag:'A10', name:'V2.3.1', daysAgo:5,   current:true,  published:true,  sizeMb:186.4, audience: audMost,   changelog:'EMV contactless kernel updated to L2 4.3a.' }),
        __mkVersion({ os:'ANDROID', modelCode:'N950', deviceFlag:'A10', name:'V2.3.0', daysAgo:32,  current:false, published:true,  sizeMb:185.1, audience: audAll }),
      ],
    }),
    __mkFirmware({
      os: 'ANDROID', modelCode: 'S60', deviceFlag: 'A12',
      versions: [
        __mkVersion({ os:'ANDROID', modelCode:'S60',  deviceFlag:'A12', name:'V1.7.2', daysAgo:9,   current:true,  published:true,  sizeMb:142.3, audience: audAll }),
        __mkVersion({ os:'ANDROID', modelCode:'S60',  deviceFlag:'A12', name:'V1.7.1', daysAgo:45,  current:false, published:true,  sizeMb:141.7, audience: audAll }),
        __mkVersion({ os:'ANDROID', modelCode:'S60',  deviceFlag:'A12', name:'V1.7.0', daysAgo:88,  current:false, published:false, sizeMb:140.9 }),
      ],
    }),
    __mkFirmware({
      os: 'ANDROID', modelCode: 'S30', deviceFlag: 'A10',
      versions: [
        __mkVersion({ os:'ANDROID', modelCode:'S30',  deviceFlag:'A10', name:'V1.4.0', daysAgo:14,  current:true,  published:true,  sizeMb:96.8, audience: audMost }),
        __mkVersion({ os:'ANDROID', modelCode:'S30',  deviceFlag:'A10', name:'V1.3.5', daysAgo:54,  current:false, published:true,  sizeMb:95.2, audience: audAll }),
      ],
    }),
    __mkFirmware({
      os: 'LINUX', modelCode: 'N750', deviceFlag: 'MAN',
      customerScope: isoIds[0] || null,
      versions: [
        {
          id: 'fwv-n750-man-v14',
          versionName:  'V1.2→V1.4',
          versionCode:  10400,
          versionStart: 'V1.2',
          versionEnd:   'V1.4',
          fileName:     '[N750]MAN_Patch_V1.2-V1.4_AcmeISO_20260518.NLD',
          fileSize:     '38.6 MB',
          fileSizeBytes: Math.round(38.6 * 1024 * 1024),
          md5:          __fakeMd5('n750-man-v14'),
          uploadedAt:   __t(7),
          uploadedBy:   'fw-pipeline@carbon',
          publishedAt:  __t(6),
          publishedBy:  'ops@carbon',
          status:       'published',
          current:      true,
          changelog:    'Incremental patch · receipt printer driver · kernel CVE-2024-0049.',
          publishedToIsoIds: isoIds[0] ? [isoIds[0]] : [],
          publishEvents: isoIds[0]
            ? [{ at: __t(6), by: 'ops@carbon', action: 'publish', isoIds: [isoIds[0]] }]
            : [],
          packages:     [],
        },
        {
          id: 'fwv-n750-man-v13',
          versionName:  'V1.1→V1.3',
          versionCode:  10300,
          versionStart: 'V1.1',
          versionEnd:   'V1.3',
          fileName:     '[N750]MAN_Patch_V1.1-V1.3_AcmeISO_20260411.NLD',
          fileSize:     '36.9 MB',
          fileSizeBytes: Math.round(36.9 * 1024 * 1024),
          md5:          __fakeMd5('n750-man-v13'),
          uploadedAt:   __t(43),
          uploadedBy:   'fw-pipeline@carbon',
          publishedAt:  __t(42),
          publishedBy:  'ops@carbon',
          status:       'published',
          current:      false,
          changelog:    'Cumulative patch · TLS update · NFC firmware.',
          publishedToIsoIds: isoIds[0] ? [isoIds[0]] : [],
          publishEvents: isoIds[0]
            ? [{ at: __t(42), by: 'ops@carbon', action: 'publish', isoIds: [isoIds[0]] }]
            : [],
          packages:     [],
        },
      ],
    }),
    __mkFirmware({
      os: 'RTOS', modelCode: 'X800', deviceFlag: 'STD',
      versions: [
        __mkVersion({ os:'RTOS',    modelCode:'X800', deviceFlag:'STD', name:'V1.0.7', daysAgo:11,  current:true,  published:true,  sizeMb:12.4, audience: audAll }),
        __mkVersion({ os:'RTOS',    modelCode:'X800', deviceFlag:'STD', name:'V1.0.6', daysAgo:73,  current:false, published:true,  sizeMb:12.3, audience: audAll }),
      ],
    }),
    __mkFirmware({
      os: 'RTOS', modelCode: 'X800', deviceFlag: 'EMV',
      versions: [
        __mkVersion({ os:'RTOS',    modelCode:'X800', deviceFlag:'EMV', name:'V1.0.7', daysAgo:13,  current:true,  published:false, sizeMb:12.8 }),
      ],
    }),
  ];

  window.SEED_FIRMWARE = fw;
})();

// ─── Helpers ─────────────────────────────────────────────
// Latest version of a firmware = the one tagged current, else the first
// (versions[] is authored newest-first).
const getFirmwareLatest = (fw) =>
  fw.versions.find(v => v.current) || fw.versions[0];

// Build an activity timeline by flattening every version's lifecycle events.
// Uses the publishEvents log when available (publish / audience-edit /
// unpublish each appear as a row); falls back to legacy publishedAt /
// unpublishedAt fields for any pre-migration data.
const buildFirmwareActivity = (fw) => {
  const events = [];
  for (const v of fw.versions) {
    events.push({ kind: 'uploaded', text: `Version ${v.versionName} uploaded`, at: v.uploadedAt, actor: v.uploadedBy });
    if (Array.isArray(v.publishEvents) && v.publishEvents.length) {
      for (const ev of v.publishEvents) {
        const isoCount = (ev.isoIds || []).length;
        if (ev.action === 'publish') {
          events.push({
            kind: 'published', actor: ev.by, at: ev.at,
            text: `Version ${v.versionName} published to ${isoCount} ISO${isoCount === 1 ? '' : 's'}`,
          });
        } else if (ev.action === 'audience-edit') {
          events.push({
            kind: 'audience-edit', actor: ev.by, at: ev.at,
            text: `Version ${v.versionName} audience updated · now ${isoCount} ISO${isoCount === 1 ? '' : 's'}`,
          });
        } else if (ev.action === 'unpublish') {
          events.push({
            kind: 'unpublished', actor: ev.by, at: ev.at,
            text: `Version ${v.versionName} unpublished`,
          });
        }
      }
    } else {
      // Legacy fallback
      if (v.publishedAt) events.push({ kind: 'published', text: `Version ${v.versionName} published`, at: v.publishedAt, actor: v.publishedBy });
      if (v.unpublishedAt) events.push({ kind: 'unpublished', text: `Version ${v.versionName} unpublished`, at: v.unpublishedAt, actor: v.unpublishedBy });
    }
  }
  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events;
};

// Resolve a version's audience to customer records (in seed order).
const getVersionAudience = (version) => {
  const ids = version?.publishedToIsoIds || [];
  if (ids.length === 0) return [];
  const customers = window.SEED_CUSTOMERS || [];
  return ids
    .map(id => customers.find(c => c.id === id))
    .filter(Boolean);
};
const versionAudienceCount = (version) => (version?.publishedToIsoIds || []).length;

const findFirmwareById = (id) => (window.SEED_FIRMWARE || []).find(f => f.id === id);
const findFirmwareVersion = (fw, vid) => (fw?.versions || []).find(v => v.id === vid);

Object.assign(window, {
  FW_OS_OPTIONS, FW_OS_TONE, FW_OS_META, FW_VERSION_TONE,
  getFirmwareLatest,
  buildFirmwareActivity, findFirmwareById, findFirmwareVersion,
  getVersionAudience, versionAudienceCount,
});
