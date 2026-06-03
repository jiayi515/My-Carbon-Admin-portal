/* global React */
// ─────────────────────────────────────────────────────────────
// Seed: ISV-published apps for the Apps menu.
//
// Each app has a publisherCustomerId pointing to a customer in
// SEED_CUSTOMERS whose contracts include 'ISV'. The admin view
// shows apps across ALL ISVs (the key difference vs. the per-ISV
// portal that this feature is modeled after).
// ─────────────────────────────────────────────────────────────

// ── App lifecycle ────────────────────────────────────────
//   published   — live; ISOs may subscribe and pull new versions
//   unpublished — withdrawn; existing snapshots keep running but
//                 no new subscriptions and no version pushes.
const APP_STATUS_TONE = {
  published:   { label: 'Published',   tone: 'success' },
  unpublished: { label: 'Unpublished', tone: 'warning' },
};

const APP_MODE_TONE = {
  public:  { label: 'All ISOs',       tone: 'info'    },
  private: { label: 'Specified ISOs', tone: 'neutral' },
};

const APP_VERSION_TONE = {
  published:   { label: 'Available',   tone: 'success' },
  unpublished: { label: 'Unpublished', tone: 'neutral' },
  rollback:    { label: 'Rollback',    tone: 'danger'  },
  draft:       { label: 'Draft',       tone: 'neutral' },
};

const APP_CATEGORIES = [
  'Payments', 'Inventory', 'Loyalty', 'Reporting',
  'Retail', 'Food & Beverage', 'Workforce', 'Hospitality',
];

// Helper — pick first N customer ids that have an ISO contract
// (so we can populate subscriber lists deterministically).
const __isoCustomerIds = () =>
  (window.SEED_CUSTOMERS || [])
    .filter(c => c.contracts.some(k => k.kind === 'ISO'))
    .map(c => c.id);

const SEED_APPS = [
  // ── Northwind Commerce (c-001) — ISV+ISO ─────────────
  {
    id: 'app-pos-pro',
    name: 'Northwind POS Pro',
    package: 'com.northwind.pos.pro',
    iconHue: '#5B7CFA',
    category: 'Payments',
    description: 'Full-featured point of sale with split tender, refunds, and offline queueing. Includes the Northwind Pay SDK and built-in receipt printer support.',
    devices: ['N950', 'S90', 'S60', 'N750P'],
    orientations: ['portrait', 'landscape'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-001',
    signer: 'Northwind Commerce Inc. · SHA-256 d4:e2:8a:7c:…',
    versions: [
      { id: 'v-4-3-2', name: '4.3.2', code: 1432, size: '28.4 MB', uploadedAt: '2026-05-09T10:00:00Z', publishedAt: '2026-05-10T15:00:00Z', status: 'published', scan: 'cleanish', perms: 18, minSdk: 24, targetSdk: 34, current: true, reach: 11,
        notes: 'Fixes EMV fallback bug on N750P. Adds tip suggestion presets configurable per merchant. Improves offline queue retry backoff (now exponential, max 30 min).' },
      { id: 'v-4-3-1', name: '4.3.1', code: 1431, size: '28.1 MB', uploadedAt: '2026-04-22T09:00:00Z', publishedAt: '2026-04-23T10:00:00Z', status: 'published', scan: 'cleanish', perms: 18, minSdk: 24, targetSdk: 34, reach: 11,
        notes: 'Patch release: timeout handling on Bluetooth pinpad pairing.' },
      { id: 'v-4-3-0', name: '4.3.0', code: 1430, size: '27.9 MB', uploadedAt: '2026-04-04T08:00:00Z', publishedAt: '2026-04-07T09:00:00Z', status: 'published', scan: 'cleanish', perms: 18, minSdk: 24, targetSdk: 34, reach: 11,
        notes: 'Adds split-tender and partial refund flows. New analytics export endpoint.' },
      { id: 'v-4-2-5', name: '4.2.5', code: 1429, size: '27.6 MB', uploadedAt: '2026-03-11T08:00:00Z', publishedAt: '2026-03-12T09:00:00Z', status: 'published', scan: 'clean', perms: 17, minSdk: 24, targetSdk: 33, reach: 11,
        notes: 'Localization fixes for fr-CA. PCI re-cert paperwork.' },
      { id: 'v-4-2-4', name: '4.2.4', code: 1428, size: '27.6 MB', uploadedAt: '2026-02-18T08:00:00Z', publishedAt: '2026-02-19T09:00:00Z', unpublishedAt: '2026-02-20T11:00:00Z', status: 'unpublished', scan: 'cleanish', perms: 17, minSdk: 24, targetSdk: 33, reach: 6,
        notes: 'Unpublished after a crash report on the tip prompt for S60. Superseded by 4.2.5.' },
    ],
  },
  {
    id: 'app-stockroom',
    name: 'Stockroom',
    package: 'com.northwind.stockroom',
    iconHue: '#16B981',
    category: 'Inventory',
    description: 'Inventory counts, receiving, and barcode-based stock transfers. Pairs with the POS for real-time on-hand updates.',
    devices: ['N950', 'S90', 'X800', 'N750', 'N750K'],
    orientations: ['portrait'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-001',
    signer: 'Northwind Commerce Inc. · SHA-256 d4:e2:8a:7c:…',
    versions: [
      { id: 'v-2-1-2', name: '2.1.2', code: 212, size: '14.2 MB', uploadedAt: '2026-05-02T10:00:00Z', publishedAt: '2026-05-05T10:00:00Z', status: 'published', scan: 'cleanish', perms: 11, minSdk: 24, targetSdk: 34, current: true, reach: 7,
        notes: 'Adds bulk transfer mode. Cycle-count tasks now sync incrementally.' },
      { id: 'v-2-1-1', name: '2.1.1', code: 211, size: '14.0 MB', uploadedAt: '2026-04-03T10:00:00Z', publishedAt: '2026-04-05T10:00:00Z', status: 'published', scan: 'clean', perms: 11, minSdk: 24, targetSdk: 34, reach: 7,
        notes: 'Bug fixes for receiving workflow.' },
      { id: 'v-2-1-0', name: '2.1.0', code: 210, size: '13.9 MB', uploadedAt: '2026-03-02T10:00:00Z', publishedAt: '2026-03-04T10:00:00Z', status: 'published', scan: 'clean', perms: 10, minSdk: 24, targetSdk: 33, reach: 6,
        notes: 'Initial 2.1 — cycle counts.' },
    ],
  },
  {
    id: 'app-smart-receipt',
    name: 'Smart Receipt',
    package: 'com.northwind.smartreceipt',
    iconHue: '#F59E0B',
    category: 'Retail',
    description: 'Digital receipts with QR-driven product passports and rebate hooks. Email and SMS delivery, branded templates per merchant.',
    devices: ['N950', 'S90', 'S60', 'N750P'],
    orientations: ['portrait', 'landscape'],
    status: 'unpublished',
    publishMode: 'public',
    publisherCustomerId: 'c-001',
    unpublishedAt: '2026-04-28T14:00:00Z',
    versions: [
      { id: 'v-1-1-8', name: '1.1.8', code: 118, size: '10.2 MB', uploadedAt: '2026-03-12T08:00:00Z', publishedAt: '2026-03-14T09:00:00Z', unpublishedAt: '2026-04-28T14:00:00Z', status: 'published', scan: 'cleanish', perms: 11, minSdk: 24, targetSdk: 34, current: true, reach: 1,
        notes: 'Latest before withdrawal. Adds QR rebate template editor.' },
      { id: 'v-1-1-7', name: '1.1.7', code: 117, size: '10.0 MB', uploadedAt: '2026-02-11T08:00:00Z', publishedAt: '2026-02-12T09:00:00Z', status: 'published', scan: 'clean', perms: 11, minSdk: 24, targetSdk: 33, reach: 1,
        notes: 'i18n fixes for fr-CA receipts.' },
    ],
  },

  // ── Helios Payments (c-002) — ISV+ISO, Onboarding ────
  {
    id: 'app-loyalty-plus',
    name: 'Loyalty+',
    package: 'com.helios.loyalty',
    iconHue: '#EC4899',
    category: 'Loyalty',
    description: 'Punch-card and points-based loyalty programs. Customers enroll by phone number; rewards redeem at the POS.',
    devices: ['N950', 'S90', 'S60', 'S30'],
    orientations: ['portrait'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-002',
    signer: 'Helios Payments LLC · SHA-256 b2:9f:31:0a:…',
    versions: [
      { id: 'v-1-4-0-rc1', name: '1.4.0-rc1', code: 140, size: '9.8 MB', uploadedAt: '2026-05-12T16:00:00Z', status: 'unpublished', scan: 'dirty', perms: 14, minSdk: 24, targetSdk: 34, reach: 9,
        notes: 'RC for 1.4.0 — adds tiered rewards and SMS push. Held by publisher for additional internal review before publishing.' },
      { id: 'v-1-3-4', name: '1.3.4', code: 134, size: '9.5 MB', uploadedAt: '2026-04-18T10:00:00Z', publishedAt: '2026-04-20T10:00:00Z', status: 'published', scan: 'cleanish', perms: 12, minSdk: 24, targetSdk: 34, current: true, reach: 9,
        notes: 'Hotfix: enrollment screen race condition.' },
      { id: 'v-1-3-3', name: '1.3.3', code: 133, size: '9.4 MB', uploadedAt: '2026-03-27T10:00:00Z', publishedAt: '2026-03-29T10:00:00Z', status: 'published', scan: 'cleanish', perms: 12, minSdk: 24, targetSdk: 34, reach: 8,
        notes: 'Performance improvements.' },
    ],
  },
  {
    id: 'app-curbside',
    name: 'Curbside',
    package: 'com.helios.curbside',
    iconHue: '#06B6D4',
    category: 'Food & Beverage',
    description: 'Order ahead and curbside pickup workflow, with arrival notifications by SMS.',
    devices: ['N950', 'S90'],
    orientations: ['portrait'],
    status: 'published',
    publishMode: 'private',
    publisherCustomerId: 'c-002',
    versions: [
      { id: 'v-0-9-0', name: '0.9.0-beta', code: 90, size: '6.6 MB', uploadedAt: '2026-05-11T11:00:00Z', publishedAt: '2026-05-11T11:30:00Z', status: 'published', scan: null, perms: 7, minSdk: 24, targetSdk: 34, current: true, reach: 3,
        notes: 'Initial beta. Specified ISOs only.' },
    ],
  },

  // ── Vanta Software (c-004) — ISV+ISO, Active ─────────
  {
    id: 'app-insights',
    name: 'Vanta Insights',
    package: 'com.vanta.insights',
    iconHue: '#8B5CF6',
    category: 'Reporting',
    description: 'Daily sales summaries, hourly heatmaps, and tip-out reporting. Works alongside the POS.',
    devices: ['N950', 'X800', 'S90'],
    orientations: ['portrait', 'landscape'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-004',
    signer: 'Vanta Software AG · SHA-256 9c:1d:e0:44:…',
    versions: [
      { id: 'v-1-2-0', name: '1.2.0', code: 120, size: '11.1 MB', uploadedAt: '2026-04-11T10:00:00Z', publishedAt: '2026-04-12T10:00:00Z', status: 'published', scan: 'cleanish', perms: 8, minSdk: 24, targetSdk: 34, current: true, reach: 6,
        notes: 'Hourly heatmap, exportable as CSV.' },
      { id: 'v-1-1-2', name: '1.1.2', code: 112, size: '10.8 MB', uploadedAt: '2026-03-14T10:00:00Z', publishedAt: '2026-03-15T10:00:00Z', status: 'published', scan: 'clean', perms: 8, minSdk: 24, targetSdk: 33, reach: 6,
        notes: 'Reliability fixes.' },
    ],
  },
  {
    id: 'app-catalog-sync',
    name: 'Catalog Sync',
    package: 'com.vanta.catalog',
    iconHue: '#0EA5E9',
    category: 'Retail',
    description: 'Two-way item & price sync between merchant ERP and terminal. Drag-and-drop CSV import, schedulable jobs.',
    devices: ['N950', 'X800', 'S90', 'N750P'],
    orientations: ['portrait', 'landscape'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-004',
    versions: [
      { id: 'v-1-0-9', name: '1.0.9', code: 109, size: '7.4 MB', uploadedAt: '2026-04-28T10:00:00Z', publishedAt: '2026-04-30T10:00:00Z', status: 'published', scan: 'cleanish', perms: 9, minSdk: 24, targetSdk: 34, current: true, reach: 8,
        notes: 'Adds price-rule conflict detection.' },
      { id: 'v-1-0-8', name: '1.0.8', code: 108, size: '7.2 MB', uploadedAt: '2026-04-02T10:00:00Z', publishedAt: '2026-04-03T10:00:00Z', status: 'published', scan: 'clean', perms: 9, minSdk: 24, targetSdk: 34, reach: 8,
        notes: 'Minor improvements.' },
    ],
  },
  {
    id: 'app-timeclock',
    name: 'Timeclock',
    package: 'com.vanta.timeclock',
    iconHue: '#10B981',
    category: 'Workforce',
    description: 'Employee clock-in / clock-out with PIN or NFC badge. Exports approved hours to payroll.',
    devices: ['N950', 'S90', 'S60', 'S30', 'N750'],
    orientations: ['portrait'],
    status: 'published',
    publishMode: 'public',
    publisherCustomerId: 'c-004',
    versions: [
      { id: 'v-2-0-5', name: '2.0.5', code: 205, size: '5.9 MB', uploadedAt: '2026-04-19T10:00:00Z', publishedAt: '2026-04-21T10:00:00Z', status: 'published', scan: 'cleanish', perms: 6, minSdk: 24, targetSdk: 34, current: true, reach: 10,
        notes: 'Adds NFC badge support on N950.' },
      { id: 'v-2-0-4', name: '2.0.4', code: 204, size: '5.8 MB', uploadedAt: '2026-03-24T10:00:00Z', publishedAt: '2026-03-25T10:00:00Z', status: 'published', scan: 'clean', perms: 6, minSdk: 24, targetSdk: 33, reach: 10,
        notes: 'i18n: zh-CN.' },
    ],
  },
  {
    id: 'app-tipout',
    name: 'Vanta Tipout',
    package: 'com.vanta.tipout',
    iconHue: '#F472B6',
    category: 'Workforce',
    description: 'Shift-end tip pooling and distribution for service teams. Imports POS sales data, computes shares by hours worked, and stamps approvals to payroll.',
    devices: ['N950', 'S90', 'S60'],
    orientations: ['portrait'],
    status: 'published',
    publishMode: 'private',
    publisherCustomerId: 'c-004',
    versions: [
      { id: 'v-1-2-3', name: '1.2.3', code: 123, size: '8.6 MB', uploadedAt: '2026-05-06T10:00:00Z', publishedAt: '2026-05-07T10:00:00Z', status: 'published', scan: 'cleanish', perms: 9, minSdk: 24, targetSdk: 34, current: true, reach: 3,
        notes: 'Adds tip-out by section and lock-after-approval workflow.' },
      { id: 'v-1-2-2', name: '1.2.2', code: 122, size: '8.4 MB', uploadedAt: '2026-04-09T10:00:00Z', publishedAt: '2026-04-10T10:00:00Z', status: 'published', scan: 'clean', perms: 9, minSdk: 24, targetSdk: 34, reach: 3,
        notes: 'Rounding edge cases on uneven splits.' },
    ],
  },

  // ── Loomis Industrial (c-006) — ISV only, Onboarding ─
  // Newly-created app with no version uploaded yet — demonstrates
  // the "empty versions" state.
  {
    id: 'app-loomis-fleet',
    name: 'Loomis Fleet',
    package: 'com.loomis.fleet',
    iconHue: '#94A3B8',
    category: 'Hospitality',
    description: 'Industrial fleet routing and dispatch with proof-of-delivery capture. (No version uploaded yet.)',
    devices: ['N950', 'X800'],
    orientations: ['portrait', 'landscape'],
    status: 'published',
    publishMode: 'private',
    publisherCustomerId: 'c-006',
    versions: [],
  },
];

// ── Stamp subscribers (deterministic) ─────────────────────
// Pick N ISO-bearing customers for each app's subscriberCustomerIds,
// starting from a hash of the app id so different apps get different
// subscribers.
(() => {
  const isos = __isoCustomerIds();
  if (isos.length === 0) return;
  for (const app of SEED_APPS) {
    if (app.subscriberCustomerIds) continue;
    if (app.versions.length === 0) { app.subscriberCustomerIds = []; continue; }
    const latest = app.versions.find(v => v.current) || app.versions[0];
    const want = Math.min(latest?.reach || 0, isos.length);
    let h = 0; for (const c of app.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const start = h % isos.length;
    const picks = [];
    for (let i = 0; i < want; i++) picks.push(isos[(start + i) % isos.length]);
    app.subscriberCustomerIds = picks;
  }
})();

// ── Subscription detail (per app) ─────────────────────────
// For the Subscribers tab — derive a deterministic subscribedVersion,
// subscribedAt, terminal count, merchant count, and lifecycle status for
// each (app, subscriberCustomerId). Mirrors the bucketing the ISV portal's
// Subscribers tab uses so admins see the same shape they're used to.
const __SUB_STATUS = {
  upToDate:        { tone: 'success', label: 'Up to date' },
  pendingApproval: { tone: 'warning', label: 'Pending approval' },
  behind:          { tone: 'warning', label: 'Behind' },
  unsubscribed:    { tone: 'neutral', label: 'Unsubscribed' },
};

const __subForKey = (app, customerId, i) => {
  const published = app.versions.filter(v => v.status === 'published');
  if (published.length === 0) return null;
  // Stable seed from (app, customer)
  let seed = 0;
  for (const ch of (app.id + ':' + customerId)) seed = (seed * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  const r = seed % 10;

  // Subscribed-at (1–270 days before 2026-05-21)
  const daysAgo = 5 + (seed % 265);
  const subscribedAt = new Date(Date.UTC(2026, 4, 21) - daysAgo * 86400000).toISOString();

  // Fleet sizes — deterministic per (app, customer)
  const terminals = 40 + ((i * 73 + customerId.charCodeAt(0) * 11) % 280);
  const merchants = 4  + ((i * 13 + customerId.charCodeAt(1) *  7) %  24);

  // Reach (% of fleet actually rolled to this version)
  const reachPct = 60 + (seed % 41);
  const terminalsReached = Math.round(terminals * reachPct / 100);
  const merchantsReached = Math.max(1, Math.round(merchants * reachPct / 100));

  const latest = published[0];
  const olderPublished = published.slice(1);
  let statusKey, subscribedVersion;
  if (r >= 9 && published.length > 0) {
    statusKey = 'unsubscribed';
    subscribedVersion = null;
  } else if (r >= 7 && olderPublished.length > 0) {
    statusKey = 'pendingApproval';
    subscribedVersion = olderPublished[seed % olderPublished.length];
  } else if (r >= 5 && olderPublished.length > 0) {
    statusKey = 'behind';
    subscribedVersion = olderPublished[seed % olderPublished.length];
  } else {
    statusKey = 'upToDate';
    subscribedVersion = latest;
  }
  return {
    subscribedVersion, subscribedAt,
    terminals, merchants,
    terminalsReached: subscribedVersion ? terminalsReached : 0,
    merchantsReached: subscribedVersion ? merchantsReached : 0,
    status: __SUB_STATUS[statusKey],
    statusKey,
  };
};

const getAppSubscriptions = (app) => {
  const latest = app.versions.find(v => v.current) || app.versions[0];
  return (app.subscriberCustomerIds || []).map((cid, i) => {
    const cust = (window.SEED_CUSTOMERS || []).find(c => c.id === cid);
    if (!cust) return null;
    const sub = __subForKey(app, cid, i);
    if (!sub) return null;
    return {
      customer: cust,
      customerId: cid,
      ...sub,
      latestVersion: latest,
      isOutdated: latest && sub.subscribedVersion && sub.subscribedVersion.id !== latest.id,
    };
  }).filter(Boolean);
};

// ── Publish activity per app (admin audit trail) ─────────
// Synthesised from version + lifecycle metadata. Each entry:
//   { at, kind, actor, text }
// Kinds: created · version-uploaded · version-published · version-unpublished
//        · published · unpublished · mode-changed
const buildAppActivity = (app) => {
  const events = [];
  const publisher = (window.SEED_CUSTOMERS || []).find(c => c.id === app.publisherCustomerId);
  const actor = publisher?.operators?.[0]?.email || (publisher?.email || 'admin@carbon');
  // Sort versions ascending by uploadedAt for chronological order.
  const versions = [...app.versions].sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  if (versions.length > 0) {
    const earliest = versions[0].uploadedAt;
    events.push({
      at: new Date(new Date(earliest).getTime() - 86400000).toISOString(),
      kind: 'created', actor,
      text: `App ${app.name} registered`,
    });
  } else {
    // Empty app — created event from publisher registration.
    events.push({
      at: publisher?.registeredAt || '2026-01-01T10:00:00Z',
      kind: 'created', actor,
      text: `App ${app.name} registered (no version uploaded yet)`,
    });
  }
  for (const v of versions) {
    events.push({
      at: v.uploadedAt, kind: 'version-uploaded', actor,
      text: `Version ${v.name} uploaded`,
    });
    if (v.publishedAt) {
      events.push({
        at: v.publishedAt, kind: 'version-published', actor,
        text: `Version ${v.name} published to subscribers`,
      });
    }
    if (v.unpublishedAt) {
      events.push({
        at: v.unpublishedAt, kind: 'version-unpublished', actor,
        text: `Version ${v.name} unpublished (existing installs unaffected)`,
      });
    }
  }
  if (app.unpublishedAt) {
    events.push({
      at: app.unpublishedAt, kind: 'unpublished', actor,
      text: `App withdrawn from marketplace`,
    });
  }
  // Sort descending (newest first) for display.
  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
};

// ── Helpers exposed globally ─────────────────────────────
const getAppPublisher = (app) =>
  (window.SEED_CUSTOMERS || []).find(c => c.id === app.publisherCustomerId);

// ── Vulnerability scan helpers (shared by App detail + Version detail) ──
const SEVERITY = {
  critical: { label: 'Critical', tone: 'danger',  color: 'oklch(50% 0.20 25)'  },
  high:     { label: 'High',     tone: 'danger',  color: 'oklch(58% 0.20 25)'  },
  medium:   { label: 'Medium',   tone: 'warning', color: 'oklch(70% 0.18 70)'  },
  low:      { label: 'Low',      tone: 'info',    color: 'oklch(62% 0.14 235)' },
  info:     { label: 'Info',     tone: 'neutral', color: 'var(--color-text-tertiary)' },
};

const severityCounts = (version) => {
  if (!version?.scan) return null;
  const n = version.perms || 10;
  if (version.scan === 'clean')    return { critical: 0, high: 0, medium: 0, low: 0, info: Math.max(1, Math.floor(n * 0.1)) };
  if (version.scan === 'cleanish') return { critical: 0, high: 0, medium: Math.max(1, Math.floor(n * 0.15)), low: Math.max(1, Math.floor(n * 0.25)), info: Math.max(1, Math.floor(n * 0.2)) };
  return { critical: 1, high: Math.max(1, Math.floor(n * 0.15)), medium: Math.max(1, Math.floor(n * 0.25)), low: Math.max(1, Math.floor(n * 0.3)), info: Math.max(1, Math.floor(n * 0.2)) };
};

Object.assign(window, {
  SEED_APPS,
  APP_STATUS_TONE, APP_MODE_TONE, APP_VERSION_TONE, APP_CATEGORIES,
  getAppSubscriptions, buildAppActivity, getAppPublisher,
  SEVERITY, severityCounts,
});
