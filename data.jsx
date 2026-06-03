/* global */
// =====================================================================
// data.jsx — Roles, menus, permission catalog, and the backward-compat
// derivation layer that produces the legacy `SEED_CUSTOMERS` shape from
// the 9-table model defined in data-tables.jsx.
//
//   Reads (from window globals, set up by data-tables.jsx):
//     SEED_ENTITIES, SEED_ENTITY_CONTRACTS, SEED_ENTITY_CONTRACT_DELEGATIONS,
//     SEED_USERS, SEED_ENTITY_USER_RELATIONSHIPS, SEED_OPERATOR_INVITES,
//     SEED_MFA_INFO, SEED_ROLE_BLOCKLIST, COUNTRIES, COUNTRY_BY_CODE,
//     PASSWORD_POLICY.
//
//   Defines + exports:
//     MENU_TREE, PERMISSION_CATALOG, SEED_ROLES, ALL_CONTRACT_KINDS,
//     CUSTOMER_CONTRACT_KINDS, CUSTOMER_FACING_CONTRACTS,
//     getEntityView(entityId), SEED_CUSTOMERS (derived), SEED_USERS_COMPAT,
//     CARBON_ENTITY_ID, PLATFORM_ENTITY (legacy aliases — derived).
// =====================================================================

const SEED_ENTITIES                     = window.SEED_ENTITIES;
const SEED_ENTITY_CONTRACTS             = window.SEED_ENTITY_CONTRACTS;
const SEED_ENTITY_CONTRACT_DELEGATIONS  = window.SEED_ENTITY_CONTRACT_DELEGATIONS;
const SEED_USERS_RAW                    = window.SEED_USERS;
const SEED_ENTITY_USER_RELATIONSHIPS    = window.SEED_ENTITY_USER_RELATIONSHIPS;
const SEED_OPERATOR_INVITES             = window.SEED_OPERATOR_INVITES;
const SEED_MFA_INFO                     = window.SEED_MFA_INFO;
const PASSWORD_POLICY                   = window.PASSWORD_POLICY;

// =====================================================================
// Contract-kind compatibility surface
//
// The new model uses uppercase contract type codes ('ISO','ISV','MERCHANT','ADMIN').
// The existing UI mixes 'ISV', 'ISO', 'Merchant', 'Admin' (Pascal-case for Merchant).
// To minimise UI churn we present the legacy mixed-case kinds in compat fields
// (customer.contracts[].kind, customer-list filters, ContractBadge labels, etc.).
//
// The new model defines NO Acquirer / PayFac contracts — those have been
// removed in this revision.
// =====================================================================
const CONTRACT_KIND_TO_LEGACY = {
  ADMIN:       'Admin',
  ISO:         'ISO',
  ISV:         'ISV',
  MERCHANT:    'Merchant',
  DISTRIBUTOR: 'Distributor',
};
const CUSTOMER_CONTRACT_KINDS    = ['ISV', 'ISO', 'Merchant', 'Distributor'];     // 4 customer kinds (ADMIN excluded — unique platform contract)
const ALL_CONTRACT_KINDS         = [...CUSTOMER_CONTRACT_KINDS, 'Admin'];
const CUSTOMER_FACING_CONTRACTS  = CUSTOMER_CONTRACT_KINDS;        // legacy alias

// =====================================================================
// Legacy aliases (CARBON_ENTITY_ID + PLATFORM_ENTITY) derived from the
// new model so existing UI imports keep working without re-plumbing.
//
// In the new model NPT is simply an entity row in SEED_ENTITIES, and
// "platform-ness" is whatever entity holds the single ADMIN contract.
// =====================================================================
const _adminContract     = SEED_ENTITY_CONTRACTS.find(c => c.authorizedContractType === 'ADMIN' && c.status === 'ACTIVE');
const _platformEntity    = SEED_ENTITIES.find(e => e.id === (_adminContract?.authorizedEntityId || 'e-npt'));
const CARBON_ENTITY_ID   = _platformEntity?.id || 'e-npt';
const PLATFORM_ENTITY = {
  id: CARBON_ENTITY_ID,
  name: _platformEntity?.name || 'NPT',
  fullName: 'Newland Payment Technology',
  initials: (_platformEntity?.name || 'NPT').slice(0, 3).toUpperCase(),
  description: _platformEntity?.remark || 'The company authorized to operate the Carbon admin platform.',
  contracts: ['Admin'],
};

// =====================================================================
// MENU TREE (system-defined; not a DB table)
//
// `contractDefineCode` is the contract type the menu is scoped to:
//   • null      — universal (shown to any role)
//   • 'ADMIN'   — only platform staff (NPT entity-user relationships)
//   • 'ISV'/'ISO'/'Merchant' — only operators whose customer holds that contract
//
// Note: the menu values stay in legacy mixed-case ('Merchant') for now,
// to avoid breaking admin-roles.jsx / customer-detail.jsx which both read
// `role.contractDefineCode` and compare to legacy strings. A later pass
// will normalize these to uppercase across the UI.
// =====================================================================
const MENU_TREE = [
  // ─── Customer-side menus (visible to non-ADMIN roles) ───
  { id: 'm-customers', parentId: null, title: 'Customer management', icon: 'building', path: '/customers',  contractDefineCode: null, sort: 10, isVisible: true },
  { id: 'm-contracts', parentId: null, title: 'Contracts',            icon: 'file',     path: '/contracts',  contractDefineCode: null, sort: 20, isVisible: true },
  { id: 'm-operators', parentId: null, title: 'Operators',            icon: 'users',    path: '/operators',  contractDefineCode: null, sort: 30, isVisible: true },
  { id: 'm-audit',     parentId: null, title: 'Sensitive data & audit', icon: 'audit',  path: '/audit',      contractDefineCode: null, sort: 40, isVisible: true },

  // ─── ISV-specific menus (developer tooling) ─────────────
  { id: 'm-isv-tools',       parentId: null, title: 'Developer tools',     icon: 'key',     path: '/isv/tools',       contractDefineCode: 'ISV', sort: 50, isVisible: true },
  { id: 'm-isv-marketplace', parentId: null, title: 'App marketplace',     icon: 'package', path: '/isv/marketplace', contractDefineCode: 'ISV', sort: 55, isVisible: true },

  // ─── ISO-specific menus (sales-org operations) ──────────
  { id: 'm-iso-merchants', parentId: null, title: 'Merchant pipeline',   icon: 'building', path: '/iso/merchants', contractDefineCode: 'ISO', sort: 60, isVisible: true },
  { id: 'm-iso-residuals', parentId: null, title: 'Residuals & payouts', icon: 'file',     path: '/iso/residuals', contractDefineCode: 'ISO', sort: 65, isVisible: true },

  // ─── Merchant-specific menus (payment operations) ───────
  { id: 'm-mer-txns',   parentId: null, title: 'Transactions',           icon: 'audit',   path: '/merchant/txns',   contractDefineCode: 'Merchant', sort: 70, isVisible: true },
  { id: 'm-mer-settle', parentId: null, title: 'Settlements & disputes', icon: 'file',    path: '/merchant/settle', contractDefineCode: 'Merchant', sort: 75, isVisible: true },

  // ─── Platform-only menus (only visible to ADMIN roles) ──
  { id: 'm-platform-users',  parentId: null, title: 'Platform users',   icon: 'users',  path: '/system/users',  contractDefineCode: 'ADMIN', sort: 110, isVisible: true },
  { id: 'm-platform-roles',  parentId: null, title: 'Platform roles',   icon: 'shield', path: '/system/roles',  contractDefineCode: 'ADMIN', sort: 120, isVisible: true },
  { id: 'm-platform-notify', parentId: null, title: 'Notifications',    icon: 'mail',   path: '/system/notify', contractDefineCode: 'ADMIN', sort: 130, isVisible: true },
  { id: 'm-platform-keys',   parentId: null, title: 'API keys',         icon: 'key',    path: '/system/keys',   contractDefineCode: 'ADMIN', sort: 140, isVisible: true },
];

// =====================================================================
// PERMISSION CATALOG (system-defined; not a DB table)
// Each permission attaches to exactly one menu — scope is inherited from
// the menu's `contractDefineCode`.
// =====================================================================
const PERMISSION_CATALOG = [
  // Customer management (m-customers, universal)
  { code: 'cust.view',     menuId: 'm-customers', label: 'View customers',         desc: 'Read entity profiles and metadata' },
  { code: 'cust.edit',     menuId: 'm-customers', label: 'Edit customer details',  desc: 'Update name, address, contact, license, remark' },
  { code: 'cust.create',   menuId: 'm-customers', label: 'Register new customer',  desc: 'Run the onboarding wizard' },
  { code: 'cust.lock',     menuId: 'm-customers', label: 'Suspend / resume contract', desc: 'Toggle individual contract statuses to SUSPENDED/ACTIVE' },
  { code: 'cust.delete',   menuId: 'm-customers', label: 'Delete customer',        desc: 'Permanently remove (audit retained)' },

  // Contracts (m-contracts, universal — verbs scoped by role.contractDefineCode)
  { code: 'ctr.view',      menuId: 'm-contracts', label: 'View contracts',         desc: 'See contracts in role scope (including delegations)' },
  { code: 'ctr.add',       menuId: 'm-contracts', label: 'Add / extend contract',  desc: 'Authorize a new contract (PILOT or ACTIVE) or extend an existing pilot' },
  { code: 'ctr.sign',      menuId: 'm-contracts', label: 'Sign on behalf',         desc: 'Counter-sign / mark contract ACTIVE' },
  { code: 'ctr.convert',   menuId: 'm-contracts', label: 'Convert pilot to active', desc: 'Promote a PILOT contract to ACTIVE — irreversible, starts billing' },
  { code: 'ctr.terminate', menuId: 'm-contracts', label: 'Terminate contract',     desc: 'End an ACTIVE / SUSPENDED / PILOT contract — irreversible' },
  { code: 'ctr.delegate',  menuId: 'm-contracts', label: 'Delegate operations',    desc: 'Delegate MERCHANT ops to a partner ISO (VIEW_ONLY / OPERATE)' },

  // Operators (m-operators, universal)
  { code: 'op.view',       menuId: 'm-operators', label: 'View operators',         desc: 'See operator list & masked contacts' },
  { code: 'op.invite',     menuId: 'm-operators', label: 'Invite operator',        desc: 'Send invitation link / QR code' },
  { code: 'op.role',       menuId: 'm-operators', label: 'Change operator role',   desc: 'Assign roles defined here' },
  { code: 'op.lock',       menuId: 'm-operators', label: 'Lock / unlock account',  desc: 'Force-revoke session' },
  { code: 'op.mfa',        menuId: 'm-operators', label: 'Reset MFA',              desc: 'Trigger MFA reset flow' },
  { code: 'op.remove',     menuId: 'm-operators', label: 'Remove operator',        desc: 'Detach operator from entity' },

  // Sensitive data / audit (m-audit, universal)
  { code: 'data.reveal',   menuId: 'm-audit', label: 'Reveal masked PII',       desc: 'Unmask emails / phones (logged)' },
  { code: 'data.export',   menuId: 'm-audit', label: 'Export to CSV',           desc: 'Bulk download operator / contract lists' },
  { code: 'audit.view',    menuId: 'm-audit', label: 'View audit log',          desc: 'Read system event history' },

  // ─── ADMIN-only (platform self-administration) ─────────
  { code: 'sys.users.view',   menuId: 'm-platform-users', label: 'View platform users',   desc: 'See Carbon staff user list' },
  { code: 'sys.users.create', menuId: 'm-platform-users', label: 'Create platform user',  desc: 'Provision a new Carbon staff login' },
  { code: 'sys.users.edit',   menuId: 'm-platform-users', label: 'Edit platform user',    desc: 'Update display name, email, role, status' },
  { code: 'sys.users.lock',   menuId: 'm-platform-users', label: 'Lock / unlock user',    desc: 'Force-revoke session, set lock expiry' },
  { code: 'sys.users.resetpw',menuId: 'm-platform-users', label: 'Reset user password',   desc: 'Force-reset password (logs to history)' },

  { code: 'sys.roles.view',   menuId: 'm-platform-roles', label: 'View platform roles',   desc: 'See ADMIN-contract roles' },
  { code: 'sys.roles.edit',   menuId: 'm-platform-roles', label: 'Edit platform roles',   desc: 'Create / edit / delete Carbon-internal roles' },

  { code: 'sys.notify',       menuId: 'm-platform-notify', label: 'Manage notifications', desc: 'Edit email / webhook routing' },
  { code: 'sys.keys',         menuId: 'm-platform-keys',   label: 'Manage API keys',      desc: 'Rotate organization-level credentials' },

  // ─── ISV-specific (developer tooling) ─────────────────
  { code: 'isv.apikey.view',    menuId: 'm-isv-tools',       label: 'View API keys',        desc: 'See list of ISV partner API keys (masked)' },
  { code: 'isv.apikey.rotate',  menuId: 'm-isv-tools',       label: 'Rotate API keys',      desc: 'Issue new key / invalidate old (immediate effect)' },
  { code: 'isv.webhook.config', menuId: 'm-isv-tools',       label: 'Configure webhooks',   desc: 'Set endpoint, retry policy and signing secret' },
  { code: 'isv.sandbox.access', menuId: 'm-isv-tools',       label: 'Access sandbox',       desc: 'Use the sandbox environment for testing' },
  { code: 'isv.app.publish',    menuId: 'm-isv-marketplace', label: 'Publish app',          desc: 'Submit a new app version to the marketplace' },
  { code: 'isv.app.metrics',    menuId: 'm-isv-marketplace', label: 'View install metrics', desc: 'See active installs, retention, version mix' },

  // ─── ISO-specific (sales-org operations) ──────────────
  { code: 'iso.merchant.onboard',  menuId: 'm-iso-merchants', label: 'Onboard merchant',     desc: 'Run KYC + create new merchant under this ISO' },
  { code: 'iso.merchant.suspend',  menuId: 'm-iso-merchants', label: 'Suspend merchant',     desc: 'Pause processing for an underlying merchant' },
  { code: 'iso.merchant.fee.edit', menuId: 'm-iso-merchants', label: 'Edit merchant pricing',desc: 'Adjust rates, monthly fees, transaction caps' },
  { code: 'iso.residual.view',     menuId: 'm-iso-residuals', label: 'View residual report', desc: 'See current-period residual statement' },
  { code: 'iso.residual.export',   menuId: 'm-iso-residuals', label: 'Export residual data', desc: 'CSV / API export for accounting' },

  // ─── Merchant-specific (payment operations) ───────────
  { code: 'merchant.txn.view',    menuId: 'm-mer-txns',   label: 'View transactions',     desc: 'Read transaction ledger (PAN masked)' },
  { code: 'merchant.txn.refund',  menuId: 'm-mer-txns',   label: 'Issue refunds',         desc: 'Refund full or partial amount on a txn' },
  { code: 'merchant.txn.void',    menuId: 'm-mer-txns',   label: 'Void transactions',     desc: 'Cancel an unsettled auth' },
  { code: 'merchant.settle.view', menuId: 'm-mer-settle', label: 'View settlements',      desc: 'Daily batch totals + payout schedule' },
  { code: 'merchant.dispute.respond', menuId: 'm-mer-settle', label: 'Respond to disputes', desc: 'Upload evidence for chargebacks' },
];

const MENU_BY_ID         = Object.fromEntries(MENU_TREE.map(m => [m.id, m]));
const PERM_BY_CODE       = Object.fromEntries(PERMISSION_CATALOG.map(p => [p.code, p]));
const ALL_PERMISSION_IDS = PERMISSION_CATALOG.map(p => p.code);

const permAppliesToContract = (permCode, contractDefineCode) => {
  const p = PERM_BY_CODE[permCode];
  if (!p) return false;
  const m = MENU_BY_ID[p.menuId];
  if (!m) return false;
  if (m.contractDefineCode === null) return true;
  return m.contractDefineCode === contractDefineCode;
};

const permissionGroupsForContract = (contractDefineCode) => {
  return MENU_TREE
    .filter(m => m.contractDefineCode === null || m.contractDefineCode === contractDefineCode)
    .map(m => ({
      id: m.id,
      label: m.title,
      icon: m.icon,
      contractDefineCode: m.contractDefineCode,
      items: PERMISSION_CATALOG.filter(p => p.menuId === m.id).map(p => ({
        id: p.code, label: p.label, desc: p.desc, menuId: p.menuId,
      })),
    }))
    .filter(g => g.items.length > 0);
};

// =====================================================================
// SEED_ROLES — system & private role definitions.
//
// Per the spec ROLE model:
//   id, name, roleType ('global'|'private'), contractDefineCode (CONTRACT TYPE),
//   entityId (null for global, required for private), permissions[],
//   remark (a.k.a. description for legacy UI).
//
// `builtin`, `operatorCount`, `updatedAt`, `updatedBy`, `description` are
// kept as derived/display fields used by the existing role editor.
// =====================================================================
const SEED_ROLES = [
  // ─── Generic (null-contract) global roles ──────────────
  {
    id: 'r-operator',
    name: 'Operator',
    description: 'Day-to-day onboarding and contract handling. No system-level admin.',
    remark: 'Day-to-day onboarding and contract handling. No system-level admin.',
    builtin: true,
    operatorCount: 8,
    roleType: 'global',
    entityId: null,
    contractDefineCode: null,
    permissions: [
      'cust.view','cust.edit','cust.create',
      'ctr.view','ctr.add','ctr.sign','ctr.convert',
      'op.view','op.invite','op.role',
      'data.export','audit.view',
    ],
    updatedAt: '2026-03-18T09:14:00Z',
    updatedBy: 'admin@carbon',
  },
  {
    id: 'r-viewer',
    name: 'Viewer',
    description: 'Read-only access. Cannot reveal PII or change anything.',
    remark: 'Read-only access. Cannot reveal PII or change anything.',
    builtin: true,
    operatorCount: 3,
    roleType: 'global',
    entityId: null,
    contractDefineCode: null,
    permissions: ['cust.view','ctr.view','op.view','audit.view'],
    updatedAt: '2026-02-04T12:00:00Z',
    updatedBy: 'admin@carbon',
  },

  // ─── Contract-specific global roles ────────────────────
  {
    id: 'r-isv-partner',
    name: 'ISV Partner Manager',
    description: 'Manages ISV relationships only.',
    remark: 'Manages ISV relationships only. Cannot touch contracts of other types.',
    builtin: false,
    operatorCount: 4,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ISV',
    permissions: [
      'cust.view','cust.edit',
      'ctr.view','ctr.add','ctr.sign','ctr.convert',
      'op.view','op.invite',
      'audit.view',
    ],
    updatedAt: '2026-05-06T10:21:00Z',
    updatedBy: 'jordan.d@carbon',
  },
  {
    id: 'r-iso-sales',
    name: 'ISO Sales Lead',
    description: 'Manages ISO partner onboarding and contract signing.',
    remark: 'Manages ISO partner onboarding and contract signing.',
    builtin: false,
    operatorCount: 2,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ISO',
    permissions: [
      'cust.view','cust.edit',
      'ctr.view','ctr.add','ctr.sign','ctr.convert','ctr.delegate',
      'op.view','op.invite',
      'audit.view',
    ],
    updatedAt: '2026-04-12T14:11:00Z',
    updatedBy: 'jordan.d@carbon',
  },
  {
    id: 'r-merchant-support',
    name: 'Merchant Support',
    description: 'Direct-merchant customer support.',
    remark: 'Direct-merchant customer support. Read + minor edit on Merchant entities.',
    builtin: false,
    operatorCount: 3,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'Merchant',
    permissions: [
      'cust.view','cust.edit',
      'ctr.view',
      'op.view','op.invite',
      'audit.view',
    ],
    updatedAt: '2026-03-02T11:00:00Z',
    updatedBy: 'admin@carbon',
  },

  // ─── ADMIN-contract global roles (Carbon platform self-admin) ───
  {
    id: 'r-admin-platform',
    name: 'Platform Administrator',
    description: 'Full control over the Carbon admin platform.',
    remark: 'Full control over the Carbon admin platform — manages Carbon staff, roles, keys, notifications.',
    builtin: true,
    operatorCount: 2,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ADMIN',
    permissions: [
      'sys.users.view','sys.users.create','sys.users.edit','sys.users.lock','sys.users.resetpw',
      'sys.roles.view','sys.roles.edit',
      'sys.notify','sys.keys',
      'audit.view',
    ],
    updatedAt: '2026-01-05T10:00:00Z',
    updatedBy: 'admin@carbon',
  },
  {
    id: 'r-admin-ops',
    name: 'Operations Admin',
    description: 'Manages staff users and audit but not API keys.',
    remark: 'Carbon ops staff — manages staff users and audit but not API keys.',
    builtin: false,
    operatorCount: 4,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ADMIN',
    permissions: [
      'sys.users.view','sys.users.create','sys.users.edit','sys.users.lock','sys.users.resetpw',
      'sys.roles.view',
      'audit.view',
    ],
    updatedAt: '2026-03-22T15:40:00Z',
    updatedBy: 'admin@carbon',
  },
  {
    id: 'r-admin-compliance',
    name: 'Compliance Officer',
    description: 'Audit & sensitive-data access across customers.',
    remark: 'Audit & sensitive-data access across all customers. Read-only on platform settings.',
    builtin: false,
    operatorCount: 2,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ADMIN',
    permissions: [
      'sys.users.view','sys.roles.view',
      'audit.view',
    ],
    updatedAt: '2026-04-29T17:42:00Z',
    updatedBy: 'jordan.d@carbon',
  },
  {
    id: 'r-admin-viewer',
    name: 'Platform Viewer',
    description: 'Read-only on platform users, roles and notifications.',
    remark: 'Read-only on platform users, roles and notifications. For new Carbon hires.',
    builtin: true,
    operatorCount: 1,
    roleType: 'global',
    entityId: null,
    contractDefineCode: 'ADMIN',
    permissions: ['sys.users.view','sys.roles.view','audit.view'],
    updatedAt: '2026-02-10T08:30:00Z',
    updatedBy: 'admin@carbon',
  },
];

const ROLE_BY_ID = Object.fromEntries(SEED_ROLES.map(r => [r.id, r]));

// =====================================================================
// Index helpers — let the derivation pass run in O(1) per lookup.
// =====================================================================
const _USER_BY_ID                  = Object.fromEntries(SEED_USERS_RAW.map(u => [u.id, u]));
const _ENTITY_BY_ID                = Object.fromEntries(SEED_ENTITIES.map(e => [e.id, e]));
const _CONTRACTS_BY_ENTITY         = SEED_ENTITY_CONTRACTS.reduce((acc, c) => {
  (acc[c.authorizedEntityId] = acc[c.authorizedEntityId] || []).push(c);
  return acc;
}, {});
const _EUR_BY_ENTITY               = SEED_ENTITY_USER_RELATIONSHIPS.reduce((acc, r) => {
  (acc[r.entityId] = acc[r.entityId] || []).push(r);
  return acc;
}, {});
const _EUR_BY_USER                 = SEED_ENTITY_USER_RELATIONSHIPS.reduce((acc, r) => {
  (acc[r.userId] = acc[r.userId] || []).push(r);
  return acc;
}, {});
const _INVITES_BY_ENTITY           = SEED_OPERATOR_INVITES.reduce((acc, i) => {
  (acc[i.entityId] = acc[i.entityId] || []).push(i);
  return acc;
}, {});

// =====================================================================
// getEntityView(entityId) — produces a "customer-shaped" view (the legacy
// `customer` object the UI consumes) from the normalized tables.
//
// Output fields (compat with existing UI):
//   id, name, country, address, contactName,
//   phoneCountryCode, phone, timezone, license, remark,
//   notes (alias of remark), email (derived from primary admin operator),
//   registeredAt,
//   status               — 'Onboarding' | 'Active' (persisted; falls back to operator-presence derivation for legacy seed data)
//   contracts[]          — see below
//   operators[]          — see below
//   pendingInvite        — single most-recent ADMIN-typed open invite (legacy slot)
//   events[]             — kept as-is from SEED_ENTITIES[i].events
//
// contracts[] shape (per row):
//   id, kind ('ISV'|'ISO'|'Merchant'|'Admin'), status, authorizingEntityId,
//   authorizingEntityName, signedAt, signedBy, effectiveFrom, effectiveTo,
//   terminatedByEntityId, terminatedAt, entitlements
//
// operators[] shape (per row):
//   id, userId, eurId, name, email, phone, role ('Admin' or role.name),
//   roleIds[], authorizingType, lastLogin, pending (always false here),
//   locked, invitedAt, activatedAt, invitedBy, mfaEnabled
// =====================================================================
const _toLegacyKind = (k) => CONTRACT_KIND_TO_LEGACY[k] || k;

// Pre-compute the "admin email" for every entity — used as the legacy `signedBy`
// value on contracts (the existing UI passes signedBy through maskEmail, so it
// must be a valid email-shaped string). Picks the first ADMIN-type
// ENTITY_USER_RELATIONSHIP's user email; falls back to a synthetic
// `admin@<entity-slug>` if no admin operator exists yet.
const _adminEmailByEntity = (() => {
  const out = { 'e-npt': 'admin@carbon' };
  for (const e of SEED_ENTITIES) {
    if (e.id === 'e-npt') continue;
    const eur = (_EUR_BY_ENTITY[e.id] || []).find(r => r.authorizingType === 'ADMIN' && r.status !== 'TERMINATED');
    const user = eur ? _USER_BY_ID[eur.userId] : null;
    out[e.id] = user?.email || `admin@${(e.name || e.id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example`;
  }
  return out;
})();

function _findSuspendEvent() { return null; /* deprecated — entity-level lock removed */ }

function getEntityView(entityId) {
  const entity = _ENTITY_BY_ID[entityId];
  if (!entity) return null;

  // Contracts (always include TERMINATED for history — UI can filter)
  const contractRows = (_CONTRACTS_BY_ENTITY[entityId] || []).map(c => {
    const authEntity = _ENTITY_BY_ID[c.authorizingEntityId];
    return {
      id: c.id,
      kind: _toLegacyKind(c.authorizedContractType),
      contractType: c.authorizedContractType,
      status: c.status,
      authorizingEntityId: c.authorizingEntityId,
      authorizingEntityName: authEntity?.name || c.authorizingEntityId,
      authorizedAt: c.authorizedAt,
      signedAt: c.authorizedAt,                 // legacy alias
      signedBy: _adminEmailByEntity[c.authorizingEntityId] || 'admin@carbon',
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
      terminatedByEntityId: c.terminatedByEntityId,
      terminatedAt: c.terminatedAt,
      entitlements: c.entitlements || {},
      events: c.events || [],   // per-contract audit stream (new model)
    };
  });

  // Operators (real activated rows from ENTITY_USER_RELATIONSHIPS).
  // Excludes TERMINATED relationships; LOCKED still appears (with .locked = true).
  const eurs = (_EUR_BY_ENTITY[entityId] || []).filter(eur => eur.status !== 'TERMINATED');
  const operators = eurs.map(eur => {
    const user = _USER_BY_ID[eur.userId];
    if (!user) return null;
    let roleName;
    if (eur.authorizingType === 'ADMIN') {
      roleName = 'Admin';
    } else {
      const first = (eur.roleIds || [])[0];
      const r = first ? ROLE_BY_ID[first] : null;
      roleName = r?.name || 'Operator';
    }
    const mfa = SEED_MFA_INFO.find(m => m.userId === user.id);
    return {
      id: user.id,
      userId: user.id,
      eurId: eur.id,
      name: user.nickname,
      email: user.email,
      phone: '',                                // phone is no longer on USER
      role: roleName,
      roleIds: eur.roleIds || [],
      authorizingType: eur.authorizingType,
      lastLogin: user.lastLoginAt,
      pending: false,
      locked: user.status === 'LOCKED' || eur.status === 'LOCKED',
      invitedAt: eur.authorizingFrom,
      activatedAt: eur.authorizingTimestamp,
      invitedBy: eur.authorizingUserName,
      mfaEnabled: !!user.mfaEnable && !!mfa && mfa.status === 1,
    };
  }).filter(Boolean);

  // Outstanding ADMIN invites: surface as legacy `pendingInvite` on the entity
  // when there are no operators yet (Cases 2 and 3 in the old data).
  const allInvites = _INVITES_BY_ENTITY[entityId] || [];
  const openInvites = allInvites.filter(i => !i.consumedAt);
  let pendingInvite = null;
  if (operators.length === 0 && openInvites.length > 0) {
    const adminInv = openInvites.find(i => i.inviteAuthType === 'ADMIN') || openInvites[0];
    pendingInvite = {
      token: adminInv.token,
      url: `https://app.carbon.toms/invite/${adminInv.token}`,
      role: adminInv.inviteAuthType === 'ADMIN' ? 'Admin' : 'Operator',
      method: adminInv.inviteMethod,
      recipientEmail: adminInv.inviteEmail,
      generatedAt: adminInv.createdAt,
      expiresAt: adminInv.expiresAt,
      generatedBy: adminInv.inviterUserName || adminInv.inviterUserId,
    };
  }

  // ── Entity status (corrected — persisted, not derived) ──────────────
  // Per the domain model: ENTITY.status is now a persisted enum field on
  // the entity row (ONBOARDING / ACTIVE). For mock seed data, we fall
  // back to deriving it from operator presence if the field is missing
  // so older fixtures still render correctly.
  //   - Persisted value (when set) wins.
  //   - Otherwise: has-operator → Active, none → Onboarding.
  // ENTITY has no LOCKED state in this model — admins manage access by
  // suspending individual contracts.
  const hasUsableOperator = operators.some(op => !op.locked);
  const status = entity.status
    ? (String(entity.status).toLowerCase() === 'active' ? 'Active' : 'Onboarding')
    : (hasUsableOperator ? 'Active' : 'Onboarding');

  // Derive a "primary email" for legacy UI: use the Admin operator's email when present,
  // otherwise fall back to the first pendingInvite recipient, then to '' (empty).
  const adminOp     = operators.find(op => op.role === 'Admin');
  const derivedEmail = adminOp?.email || pendingInvite?.recipientEmail || '';

  return {
    // Core entity fields
    id: entity.id,
    name: entity.name,
    country: entity.country,
    address: entity.address,
    contactName: entity.contactName || '',
    phoneCountryCode: entity.phoneCountryCode,
    phone: entity.phone,
    timezone: entity.timezone || null,
    license: entity.license || '',
        remark: entity.remark || '',
    notes: entity.remark || '',                // legacy alias
    email: derivedEmail,                       // derived for compat
    registeredAt: entity.registeredAt,

    // Derived state
    status,

    // Multi-contract aware
    contracts: contractRows,
    operators,
    pendingInvite,

    // Audit stream (kept embedded for now per the agreed plan)
    events: entity.events || [],
  };
}

// Build the legacy `SEED_CUSTOMERS` array — every entity EXCEPT the platform
// owner (NPT is not a customer; admin-users.jsx handles NPT staff differently).
const SEED_CUSTOMERS = SEED_ENTITIES
  .filter(e => e.id !== CARBON_ENTITY_ID)
  .map(e => getEntityView(e.id));

// =====================================================================
// SEED_USERS_COMPAT — admin-users.jsx still reads loginName/displayName,
// roleIds, authorizingType, pending, invitedAt, etc. We re-shape the new
// USER rows + e-npt ENTITY_USER_RELATIONSHIP into the legacy shape.
//
// We also synthesize pseudo-USER rows for OPERATOR_INVITES whose entity = NPT
// and consumedAt is null — these used to live inside SEED_USERS as
// `pending: true` records.
// =====================================================================
const _NPT_EURS_BY_USER = (_EUR_BY_ENTITY[CARBON_ENTITY_ID] || []).reduce((acc, eur) => {
  acc[eur.userId] = eur;
  return acc;
}, {});

const SEED_USERS_COMPAT = [
  // 1) Real users that have an ENTITY_USER_RELATIONSHIP with NPT
  ...SEED_USERS_RAW
    .filter(u => !!_NPT_EURS_BY_USER[u.id])
    .map(u => {
      const eur = _NPT_EURS_BY_USER[u.id];
      return {
        // Identity
        id: u.id,
        username: u.username,
        loginName: u.username,                      // legacy alias
        nickname: u.nickname,
        displayName: u.nickname,                    // legacy alias
        email: u.email,
        country: u.country,
        status: u.status === 'LOCKED' ? 'LOCKED' : (eur.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE'),
        lastLoginAt: u.lastLoginAt,
        // Password fields
        passwordHash: u.passwordHash,
        passwordChangedTimestamp: u.passwordChangedTimestamp,
        passwordUpdatedAt: u.passwordChangedTimestamp,
        passwordErrorTimes: u.passwordErrorTimes,
        passwordErrorLockExpiredTimestamp: u.passwordErrorLockExpiredTimestamp,
        passwordChangeTimes: (u.passwordHistory?.length || 0) + 1,
        passwordHistory: u.passwordHistory || [],
        // MFA
        mfaEnable: !!u.mfaEnable,
        // Entity-user binding (denormalized for legacy UI)
        authorizingType: eur.authorizingType,
        roleIds: eur.roleIds || [],
        // Misc
        remark: u.remark || '',
        createdAt: eur.authorizingTimestamp,
        updatedAt: u.passwordChangedTimestamp || eur.authorizingTimestamp,
      };
    }),

  // 2) Pending invites for NPT — synthesized into a "PENDING USER" row.
  ...SEED_OPERATOR_INVITES
    .filter(i => i.entityId === CARBON_ENTITY_ID && !i.consumedAt)
    .map(inv => ({
      id: 'u-' + inv.id,                          // synthetic id like u-inv-7k2qp
      username: '',
      loginName: '',
      nickname: '',
      displayName: '',
      email: inv.inviteEmail || '',
      country: '',
      status: 'PENDING',
      pending: true,
      invitedAt: inv.createdAt,
      invitedBy: inv.inviterUserName || inv.inviterUserId,
      inviteExpiresAt: inv.expiresAt,
      inviteToken: inv.token,
      lastLoginAt: null,
      passwordChangedTimestamp: null,
      passwordUpdatedAt: null,
      passwordErrorTimes: 0,
      passwordChangeTimes: 0,
      passwordErrorLockExpiredTimestamp: null,
      remark: '',
      createdAt: inv.createdAt,
      updatedAt: inv.createdAt,
      mfaEnable: false,
      authorizingType: inv.inviteAuthType || 'NORMAL',
      roleIds: inv.inviteRoleIds || [],
      passwordHistory: [],
    })),
];

// =====================================================================
// Legacy PERMISSION_GROUPS shim (used by customer-detail.jsx; will be
// refactored). Built from universal-contract menus + their permissions.
// =====================================================================
const _COMPAT_PERMISSION_GROUPS = MENU_TREE
  .filter(m => m.contractDefineCode === null)
  .map(m => ({
    id: m.id,
    label: m.title,
    items: PERMISSION_CATALOG.filter(p => p.menuId === m.id).map(p => ({
      id: p.code, label: p.label, desc: p.desc,
    })),
  }))
  .filter(g => g.items.length > 0);

// =====================================================================
// Window exports
// =====================================================================
Object.assign(window, {
  // Reference data
  CUSTOMER_CONTRACT_KINDS, ALL_CONTRACT_KINDS, CUSTOMER_FACING_CONTRACTS,
  CARBON_ENTITY_ID, PLATFORM_ENTITY,
  MENU_TREE, MENU_BY_ID,
  PERMISSION_CATALOG, PERM_BY_CODE, ALL_PERMISSION_IDS,
  permAppliesToContract, permissionGroupsForContract,
  SEED_ROLES,
  ROLE_BY_ID,
  CONTRACT_KIND_TO_LEGACY,
  // Derivation helpers (callable from UI)
  getEntityView,
  // Backward-compat shapes
  SEED_CUSTOMERS,
  // Legacy SEED_USERS gets OVERWRITTEN with the compat shape so admin-users.jsx
  // continues to work. The raw model rows remain available as SEED_USERS_RAW.
  SEED_USERS: SEED_USERS_COMPAT,
  SEED_USERS_RAW,
  PERMISSION_GROUPS: _COMPAT_PERMISSION_GROUPS,
});
