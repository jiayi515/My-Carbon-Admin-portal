/* global */
// =====================================================================
// data-tables.jsx — Normalized 9-table seed data for the Carbon admin.
//
// This file is the SINGLE source of truth for the new entity-centric data
// model. The legacy `customer.contracts[]` / `customer.operators[]` shapes
// the UI currently consumes are DERIVED in data.jsx from these tables.
//
//   Tables in this file
//   ───────────────────
//   • SEED_ENTITIES                     — every company (incl. NPT itself)
//   • SEED_ENTITY_CONTRACTS             — entity ⇄ contract (with AUTHORIZING)
//   • SEED_ENTITY_CONTRACT_DELEGATIONS  — A delegates ops to B
//   • SEED_ROLE_BLOCKLIST               — entity blocks specific global roles
//   • SEED_USERS                        — every person who can log in
//   • SEED_MFA_INFO                     — TOTP secret + counters per user
//   • SEED_ENTITY_USER_RELATIONSHIPS    — entity ⇄ user (auth + role binding)
//   • SEED_OPERATOR_INVITES             — outstanding invitations
//
//   Helpers also exported
//   ─────────────────────
//   • COUNTRIES, COUNTRY_BY_CODE
//   • CONTRACT_TYPES, CONTRACT_STATUSES, DELEGATION_SCOPES
// =====================================================================

// ─── Country reference list (ISO 3166-1 alpha-2 + dial code + IANA tz) ──
const COUNTRIES = [
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', tz: 'Asia/Dubai'        },
  { code: 'AR', name: 'Argentina',            dial: '+54',  tz: 'America/Argentina/Buenos_Aires' },
  { code: 'AU', name: 'Australia',            dial: '+61',  tz: 'Australia/Sydney'  },
  { code: 'BE', name: 'Belgium',              dial: '+32',  tz: 'Europe/Brussels'   },
  { code: 'BR', name: 'Brazil',               dial: '+55',  tz: 'America/Sao_Paulo' },
  { code: 'CA', name: 'Canada',               dial: '+1',   tz: 'America/Toronto'   },
  { code: 'CH', name: 'Switzerland',          dial: '+41',  tz: 'Europe/Zurich'     },
  { code: 'CN', name: 'China',                dial: '+86',  tz: 'Asia/Shanghai'     },
  { code: 'DE', name: 'Germany',              dial: '+49',  tz: 'Europe/Berlin'     },
  { code: 'DK', name: 'Denmark',              dial: '+45',  tz: 'Europe/Copenhagen' },
  { code: 'ES', name: 'Spain',                dial: '+34',  tz: 'Europe/Madrid'     },
  { code: 'FI', name: 'Finland',              dial: '+358', tz: 'Europe/Helsinki'   },
  { code: 'FR', name: 'France',               dial: '+33',  tz: 'Europe/Paris'      },
  { code: 'GB', name: 'United Kingdom',       dial: '+44',  tz: 'Europe/London'     },
  { code: 'HK', name: 'Hong Kong',            dial: '+852', tz: 'Asia/Hong_Kong'    },
  { code: 'IE', name: 'Ireland',              dial: '+353', tz: 'Europe/Dublin'     },
  { code: 'IN', name: 'India',                dial: '+91',  tz: 'Asia/Kolkata'      },
  { code: 'IT', name: 'Italy',                dial: '+39',  tz: 'Europe/Rome'       },
  { code: 'JP', name: 'Japan',                dial: '+81',  tz: 'Asia/Tokyo'        },
  { code: 'KR', name: 'South Korea',          dial: '+82',  tz: 'Asia/Seoul'        },
  { code: 'MX', name: 'Mexico',               dial: '+52',  tz: 'America/Mexico_City' },
  { code: 'NL', name: 'Netherlands',          dial: '+31',  tz: 'Europe/Amsterdam'  },
  { code: 'NO', name: 'Norway',               dial: '+47',  tz: 'Europe/Oslo'       },
  { code: 'NZ', name: 'New Zealand',          dial: '+64',  tz: 'Pacific/Auckland'  },
  { code: 'PL', name: 'Poland',               dial: '+48',  tz: 'Europe/Warsaw'     },
  { code: 'SE', name: 'Sweden',               dial: '+46',  tz: 'Europe/Stockholm'  },
  { code: 'SG', name: 'Singapore',            dial: '+65',  tz: 'Asia/Singapore'    },
  { code: 'US', name: 'United States',        dial: '+1',   tz: 'America/New_York'  },
  { code: 'ZA', name: 'South Africa',         dial: '+27',  tz: 'Africa/Johannesburg' },
];
const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

// ─── Contract enums ────────────────────────────────────
//
// CONTRACT_TYPES — the 4 contract kinds an entity can hold.
//   ADMIN     — only ONE entity may hold this (the platform operator, NPT).
//               It IS the Carbon admin platform.
//   ISO       — Independent Sales Organization. May be authorized by ADMIN
//               or by another ISO (sub-ISO; "mutual authorization" allowed).
//   ISV       — Independent Software Vendor. Same authorizer rules as ISO.
//   MERCHANT  — Direct merchant. Authorizer MUST hold an ACTIVE ISO contract
//               (NPT cannot directly issue MERCHANT contracts).
const CONTRACT_TYPES = ['ADMIN', 'ISO', 'ISV', 'MERCHANT'];

// CONTRACT_STATUSES — the lifecycle of a single entity_contract row.
const CONTRACT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'];

// DELEGATION_SCOPES — what the delegatee can do with the source contract.
const DELEGATION_SCOPES = ['VIEW_ONLY', 'OPERATE'];

// ─── Password policy (used by data.jsx as platform-wide rules) ──
const PASSWORD_POLICY = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
  maxErrorTimes: 5,                  // → triggers lock
  lockDurationMinutes: 30,           // lock auto-expires after N minutes
  historySize: 5,                    // last N hashes cannot be reused
  expiryDays: 90,                    // force change after N days
  inviteTokenDays: 7,                // OPERATOR_INVITE.EXPIRES_AT default offset
};

// =====================================================================
// SEED_ENTITIES — every company in the platform's domain.
//   • One row for NPT itself (id = 'e-npt')
//   • One row per customer (id prefix 'c-')
//   • Differentiated only by which contracts they hold (see SEED_ENTITY_CONTRACTS)
//
// Fields (per spec model):
//   id            — PRIMARY
//   name          — REQUIRED
//   country       — REQUIRED (ISO 3166-1 alpha-2)
//   address       — optional
//   contactName   — optional
//   phoneCountryCode + phone — optional pair
//   timezone      — optional IANA tz string
//   license       — optional
//   remark        — optional internal note
//
// Compatibility fields (NOT in the formal model, kept for UI mockability):
//   registeredAt  — back-office creation time, used for sorting/list display
//   events        — embedded audit stream (spec keeps as-is for now)
// =====================================================================
const SEED_ENTITIES = [
  // ─── Platform self (the sole ADMIN-contract holder) ──────
  {
    id: 'e-npt',
    status: 'ACTIVE',
    name: 'NPT',
    country: 'CN',
    address: 'Newland Science Park, Pudong, Shanghai 201203, China',
    contactName: 'Carbon Operations',
    phoneCountryCode: '+86',
    phone: '21 6888 0000',
    timezone: 'Asia/Shanghai',
    license: '',
    remark: 'Newland Payment Technology — the company that operates the Carbon admin platform.',
    registeredAt: '2024-01-01T00:00:00Z',
  },

  // ─── ISO + ISV authorized by NPT (Northwind — strategic ISO) ──
  {
    id: 'c-001',
    status: 'ACTIVE',
    name: 'Northwind Commerce',
    country: 'US',
    address: '1455 Market Street, Suite 600, San Francisco, CA 94103, USA',
    contactName: 'Sarah Chen',
    phoneCountryCode: '+1',
    phone: '415 226 4800',
    timezone: 'America/Los_Angeles',
    license: 'NW-2024-08831-CA',
    remark: 'Mid-market e-commerce platform; expanding into card-present in Q3. Authorizes its own sub-ISO and direct merchants.',
    registeredAt: '2025-08-14T10:12:00Z',
  },

  // ─── ISV + ISO + MERCHANT (Helios — mixed portfolio) ──
  {
    id: 'c-002',
    status: 'ACTIVE',
    name: 'Helios Payments',
    country: 'US',
    address: '200 W Madison St, Floor 24, Chicago, IL 60606, USA',
    contactName: 'Elena Rossi',
    phoneCountryCode: '+1',
    phone: '312 445 1100',
    timezone: 'America/Chicago',
    license: '',
    remark: 'Vertically-integrated payments software vendor. Also acts as ISO and runs a small direct-merchant account.',
    registeredAt: '2026-04-22T13:48:00Z',
  },

  // ─── ISO authorized by NPT (Brightleaf — delegated to from Northwind) ──
  {
    id: 'c-003',
    status: 'ACTIVE',
    name: 'Brightleaf Retail',
    country: 'CA',
    address: '88 King St E, Toronto, ON M5C 1G3, Canada',
    contactName: 'Henry Tremblay',
    phoneCountryCode: '+1',
    phone: '416 991 2200',
    timezone: 'America/Toronto',
    license: 'BL-CAN-44217',
    remark: 'Multi-store specialty retailer (24 locations). Also acts as a partner-ISO that takes delegated ops from Northwind.',
    registeredAt: '2025-03-09T18:00:00Z',
  },

  // ─── ISV authorized by NPT + ISO authorized by NPT (Vanta — software-led) ──
  {
    id: 'c-004',
    status: 'ACTIVE',
    name: 'Vanta Software',
    country: 'CH',
    address: 'Bahnhofstrasse 12, 8001 Zürich, Switzerland',
    contactName: 'Lukas Meier',
    phoneCountryCode: '+41',
    phone: '44 555 8800',
    timezone: 'Europe/Zurich',
    license: '',
    remark: 'Banking-grade software vendor. Took on an ISO contract in Q2 2026 to cross-sell hardware.',
    registeredAt: '2025-11-19T08:21:00Z',
  },

  // ─── ISO authorized by NPT, currently SUSPENDED (Coastline — compliance review) ──
  {
    id: 'c-005',
    status: 'ACTIVE',
    name: 'Coastline Hospitality',
    country: 'US',
    address: '1700 Ocean Blvd, Miami Beach, FL 33139, USA',
    contactName: 'Maria Alvarez',
    phoneCountryCode: '+1',
    phone: '305 442 8800',
    timezone: 'America/New_York',
    license: 'FL-HSP-22019',
    remark: 'Boutique hotel group, 6 properties. ISO contract suspended pending chargeback-dispute review.',
    registeredAt: '2024-12-02T11:00:00Z',
  },

  // ─── ISV authorized by NPT (Loomis — onboarded recently) ──
  {
    id: 'c-006',
    status: 'ACTIVE',
    name: 'Loomis Industrial',
    country: 'US',
    address: '4500 Industrial Pkwy, Houston, TX 77032, USA',
    contactName: 'Eli Wagner',
    phoneCountryCode: '+1',
    phone: '832 220 6600',
    timezone: 'America/Chicago',
    license: '',
    remark: 'Industrial-parts ISV; provides terminal integrations to enterprise field-service customers.',
    registeredAt: '2026-05-09T09:32:00Z',
  },

  // ─── MERCHANT authorized by an ISO (Bluefin — under Northwind) ──
  {
    id: 'c-007',
    status: 'ACTIVE',
    name: 'Bluefin Market',
    country: 'US',
    address: '88 Pier 39, San Francisco, CA 94133, USA',
    contactName: 'Akiko Tanaka',
    phoneCountryCode: '+1',
    phone: '415 887 4400',
    timezone: 'America/Los_Angeles',
    license: 'CA-MERCH-7711',
    remark: 'Seafood market operated under Northwind ISO. Three-terminal storefront.',
    registeredAt: '2026-02-18T09:00:00Z',
  },

  // ─── MERCHANT pending (Pinegate — invite not generated yet) ──
  {
    id: 'c-008',
    status: 'ONBOARDING',
    name: 'Pinegate Apparel',
    country: 'GB',
    address: '12 Carnaby St, London W1F 9PE, United Kingdom',
    contactName: '',
    phoneCountryCode: '+44',
    phone: '20 7946 0817',
    timezone: 'Europe/London',
    license: '',
    remark: 'D2C apparel brand · just registered under Helios ISO, Admin not yet invited.',
    registeredAt: '2026-05-22T16:40:00Z',
  },

  // ─── ISO PENDING (Aurora — invite outstanding, not consumed) ──
  {
    id: 'c-009',
    status: 'ONBOARDING',
    name: 'Aurora Freight',
    country: 'DE',
    address: 'Friedrichstraße 200, 10117 Berlin, Germany',
    contactName: '',
    phoneCountryCode: '+49',
    phone: '30 2027 3300',
    timezone: 'Europe/Berlin',
    license: 'DE-LOG-22041',
    remark: 'Freight forwarder onboarding via NPT as ISO · activation link pending.',
    registeredAt: '2026-05-20T10:14:00Z',
  },

  // ─── MERCHANT PENDING + expired invite (Sandstone — under Brightleaf) ──
  {
    id: 'c-010',
    status: 'ONBOARDING',
    name: 'Sandstone Bistro Group',
    country: 'AU',
    address: '180 George St, Sydney NSW 2000, Australia',
    contactName: '',
    phoneCountryCode: '+61',
    phone: '2 9000 4422',
    timezone: 'Australia/Sydney',
    license: 'AU-HSP-90118',
    remark: 'Hospitality group under Brightleaf ISO · activation link expired before redemption.',
    registeredAt: '2026-05-01T07:20:00Z',
  },

  // ─── ISV ACTIVE (Westport — admin already activated) ──
  {
    id: 'c-011',
    status: 'ACTIVE',
    name: 'Westport Marine Supply',
    country: 'CA',
    address: '450 Quayside Dr, New Westminster, BC V3M 0A8, Canada',
    contactName: "Megan O'Connell",
    phoneCountryCode: '+1',
    phone: '604 525 7700',
    timezone: 'America/Vancouver',
    license: 'BC-WTR-33218',
    remark: 'Marine equipment supplier · Admin activated and signing in regularly.',
    registeredAt: '2026-04-14T19:00:00Z',
  },

  // ─── Sub-ISO authorized by Northwind (NEW — demonstrates ISO → ISO authorization) ──
  {
    id: 'c-012',
    status: 'ACTIVE',
    name: 'Cascade Channels',
    country: 'US',
    address: '700 Pike St, Suite 1800, Seattle, WA 98101, USA',
    contactName: 'Rosa Lin',
    phoneCountryCode: '+1',
    phone: '206 553 9200',
    timezone: 'America/Los_Angeles',
    license: 'WA-ISO-55408',
    remark: 'Sub-ISO operating in the Pacific Northwest under Northwind. Specialises in independent retailers under 10 staff.',
    registeredAt: '2026-01-20T10:00:00Z',
  },

  // ─── MERCHANT authorized by Northwind, delegated to Brightleaf (NEW) ──
  {
    id: 'c-013',
    status: 'ACTIVE',
    name: 'Sunbreak Cafe Group',
    country: 'US',
    address: '1428 NW Lovejoy St, Portland, OR 97209, USA',
    contactName: 'Theo Marsh',
    phoneCountryCode: '+1',
    phone: '503 224 7700',
    timezone: 'America/Los_Angeles',
    license: 'OR-FB-19884',
    remark: 'Coffee chain (6 locations). Northwind delegated day-to-day ops to Brightleaf so the latter can run support during PST off-hours.',
    registeredAt: '2026-02-05T08:30:00Z',
  },

  // ─── MERCHANT authorized by Brightleaf, delegated to Cascade Channels (NEW) ──
  {
    id: 'c-014',
    status: 'ACTIVE',
    name: 'Stonefield Auto Parts',
    country: 'CA',
    address: '210 Cambie St, Vancouver, BC V6B 2N4, Canada',
    contactName: 'Daxton Reyes',
    phoneCountryCode: '+1',
    phone: '604 332 1188',
    timezone: 'America/Vancouver',
    license: 'BC-AUTO-77013',
    remark: 'Auto-parts retailer under Brightleaf ISO. Brightleaf granted VIEW_ONLY delegation to Cascade Channels for cross-border reporting.',
    registeredAt: '2026-03-22T14:00:00Z',
  },
  // ── PILOT customers (added in v0.5) ────────────────────────
  // Two fresh customers onboarded as PILOT for the trial-to-active flow
  // demo. Both authorized by NPT (ADMIN). See SEED_ENTITY_CONTRACTS for
  // the PILOT contract details + their EntityContractEvent streams.
  {
    id: 'c-015',
    status: 'ACTIVE',
    name: 'Wildflower Goods',
    country: 'US',
    address: '88 Mission St, San Francisco, CA 94105, United States',
    contactName: 'Iris Nakamura',
    phoneCountryCode: '+1',
    phone: '415 555 0822',
    timezone: 'America/Los_Angeles',
    license: 'CA-RET-44219',
    remark: 'D2C specialty retailer · 6-month ISO pilot started Apr 9, 2026 to evaluate device fleet management before committing to a full ISO agreement.',
    registeredAt: '2026-04-09T09:30:00Z',
  },
  {
    id: 'c-016',
    status: 'ACTIVE',
    name: 'Trailhead Outfitters',
    country: 'US',
    address: '305 Park Ave, Boulder, CO 80302, United States',
    contactName: 'Drew Whitaker',
    phoneCountryCode: '+1',
    phone: '303 555 1417',
    timezone: 'America/Denver',
    license: 'CO-RET-31085',
    remark: 'Outdoor gear chain · ISO pilot near expiry (T-7), final integration review scheduled before convert-to-active decision.',
    registeredAt: '2025-11-28T11:00:00Z',
  },
];

// =====================================================================
// SEED_ENTITY_CONTRACTS — every entity ⇄ contract row.
//
// Fields (per spec model):
//   id                       — PRIMARY (ec-NNN)
//   authorizedEntityId       — the entity this contract empowers
//   authorizedContractType   — ADMIN / ISO / ISV / MERCHANT
//   authorizingEntityId      — the entity issuing the authorization
//                              • For ADMIN: equal to authorizedEntityId (self-auth)
//                              • For MERCHANT: MUST be an entity with an ACTIVE ISO contract
//                              • For ISO/ISV: e-npt (ADMIN-authorized) OR an ISO
//   authorizedAt             — timestamp the authorization was issued
//   effectiveFrom            — when the contract begins to bind (often = authorizedAt)
//   effectiveTo              — null = no end date
//   terminatedByEntityId     — non-null only when status = TERMINATED
//   terminatedAt             — non-null only when status = TERMINATED
//   status                   — PENDING / ACTIVE / SUSPENDED / TERMINATED
//   entitlements             — JSONB; shape varies per contract type (see below)
//
// Entitlement shapes
//   ADMIN                    {} (platform owner has no entitlement config)
//   ISV                      {} (no entitlement set — software vendors are not
//                                provisioned with device fleets or feature toggles)
//   ISO        {
//     deviceModels:        Array<modelId>,
//     servicePrice:        number (USD/device/month),
//     FlyDesk:             { ENABLE, MONTH_PRICE },
//     GeoFencing:          { ENABLE, MONTH_PRICE },
//     "Pre-warning":       { ENABLE, MONTH_PRICE },
//   }
//   MERCHANT   { ...all ISO entitlements,
//     eInvoice:            { ENABLE, MONTH_PRICE },
//     portal:              { ENABLE, MONTH_PRICE },
//     transactionHistory:  { ENABLE, MONTH_PRICE, retentionDays },
//   }
// =====================================================================
const SEED_ENTITY_CONTRACTS = [
  {
    id: 'ec-admin-npt',
    authorizedEntityId: 'e-npt',
    authorizedContractType: 'ADMIN',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2024-01-01T00:00:00Z',
    effectiveFrom: '2024-01-01T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2024-01-01 by admin@carbon — e-npt authorized as ADMIN by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-001-isv',
    authorizedEntityId: 'c-001',
    authorizedContractType: 'ISV',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-08-14T10:18:00Z',
    effectiveFrom: '2025-08-16T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2025-08-14 by admin@carbon — c-001 authorized as ISV by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-001-iso',
    authorizedEntityId: 'c-001',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-09-01T14:11:00Z',
    effectiveFrom: '2025-09-02T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 4.50, currency: 'USD' },
      deviceModels: ['m-001', 'm-002', 'm-005', 'm-006'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2025-09-01 by admin@carbon — c-001 authorized as ISO by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-002-isv',
    authorizedEntityId: 'c-002',
    authorizedContractType: 'ISV',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-04-22T13:51:00Z',
    effectiveFrom: '2026-04-24T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-04-22 by admin@carbon — c-002 authorized as ISV by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-002-iso',
    authorizedEntityId: 'c-002',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-04-22T13:51:00Z',
    effectiveFrom: '2026-04-22T13:51:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 5.00, currency: 'USD' },
      deviceModels: ['m-001', 'm-005'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-04-22 by admin@carbon — c-002 authorized as ISO by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-003-iso',
    authorizedEntityId: 'c-003',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-03-12T20:30:00Z',
    effectiveFrom: '2025-03-13T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 4.25, currency: 'USD' },
      deviceModels: ['m-001', 'm-002', 'm-003', 'm-006'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2025-03-12 by admin@carbon — c-003 authorized as ISO by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-004-isv',
    authorizedEntityId: 'c-004',
    authorizedContractType: 'ISV',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-11-21T10:00:00Z',
    effectiveFrom: '2025-11-22T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2025-11-21 by admin@carbon — c-004 authorized as ISV by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-004-iso',
    authorizedEntityId: 'c-004',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-05-09T11:24:00Z',
    effectiveFrom: '2026-05-09T11:24:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 5.50, currency: 'USD' },
      deviceModels: ['m-002', 'm-005', 'm-006'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-05-09 by admin@carbon — c-004 authorized as ISO by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-005-iso',
    authorizedEntityId: 'c-005',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-01-04T09:00:00Z',
    effectiveFrom: '2025-01-05T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'SUSPENDED',
    entitlements: {
      deviceBasicService: { price: 4.00, currency: 'USD' },
      deviceModels: ['m-001', 'm-006'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2025-01-04 by admin@carbon — c-005 authorized as ISO by NPT (ADMIN)" },
      { statusFrom: 'ACTIVE', statusTo: 'SUSPENDED',
        description: "Suspended on 2026-03-04 by admin@carbon — compliance review pending review of merchant onboarding records" },
    ],
  },
  {
    id: 'ec-006-isv',
    authorizedEntityId: 'c-006',
    authorizedContractType: 'ISV',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-05-09T09:35:00Z',
    effectiveFrom: '2026-05-10T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-05-09 by admin@carbon — c-006 authorized as ISV by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-007-merch',
    authorizedEntityId: 'c-007',
    authorizedContractType: 'MERCHANT',
    authorizingEntityId: 'c-001',
    authorizedAt: '2026-02-18T09:08:00Z',
    effectiveFrom: '2026-02-19T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-02-18 by admin@carbon — c-007 authorized as MERCHANT by c-001" },
    ],
  },
  {
    id: 'ec-008-merch',
    authorizedEntityId: 'c-008',
    authorizedContractType: 'MERCHANT',
    authorizingEntityId: 'c-002',
    authorizedAt: '2026-05-22T16:42:00Z',
    effectiveFrom: '2026-05-22T16:42:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-05-22 by admin@carbon — c-008 authorized as MERCHANT by c-002" },
    ],
  },
  {
    id: 'ec-009-iso',
    authorizedEntityId: 'c-009',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-05-20T10:16:00Z',
    effectiveFrom: '2026-05-20T10:16:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 5.00, currency: 'USD' },
      deviceModels: ['m-002', 'm-005'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-05-20 by admin@carbon — c-009 authorized as ISO by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-010-merch',
    authorizedEntityId: 'c-010',
    authorizedContractType: 'MERCHANT',
    authorizingEntityId: 'c-003',
    authorizedAt: '2026-05-01T07:22:00Z',
    effectiveFrom: '2026-05-01T07:22:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-05-01 by admin@carbon — c-010 authorized as MERCHANT by c-003" },
    ],
  },
  {
    id: 'ec-011-isv',
    authorizedEntityId: 'c-011',
    authorizedContractType: 'ISV',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-04-14T19:02:00Z',
    effectiveFrom: '2026-04-15T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-04-14 by admin@carbon — c-011 authorized as ISV by NPT (ADMIN)" },
    ],
  },
  {
    id: 'ec-012-iso',
    authorizedEntityId: 'c-012',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'c-001',
    authorizedAt: '2026-01-20T10:08:00Z',
    effectiveFrom: '2026-01-23T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {
      deviceBasicService: { price: 5.75, currency: 'USD' },
      deviceModels: ['m-001', 'm-002'],
      FlyDesk:       { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-01-20 by admin@carbon — c-012 authorized as ISO by c-001" },
    ],
  },
  {
    id: 'ec-013-merch',
    authorizedEntityId: 'c-013',
    authorizedContractType: 'MERCHANT',
    authorizingEntityId: 'c-001',
    authorizedAt: '2026-02-05T08:34:00Z',
    effectiveFrom: '2026-02-08T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-02-05 by admin@carbon — c-013 authorized as MERCHANT by c-001" },
    ],
  },
  {
    id: 'ec-014-merch',
    authorizedEntityId: 'c-014',
    authorizedContractType: 'MERCHANT',
    authorizingEntityId: 'c-003',
    authorizedAt: '2026-03-22T14:04:00Z',
    effectiveFrom: '2026-03-25T00:00:00Z',
    effectiveTo: null,
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'ACTIVE',
    entitlements: {},
    events: [
      { statusFrom: null, statusTo: 'ACTIVE',
        description: "Bound on 2026-03-22 by admin@carbon — c-014 authorized as MERCHANT by c-003" },
    ],
  },

  // ── PILOT samples (v0.5) ───────────────────────────────────
  // PILOT contracts carry the same shape as ACTIVE ones — only the
  // `status` enum + the additional events convey "this is a trial".
  // The `events` array is what UI surfaces in the Activity feed; new
  // event-typed entries (eventType + eventInfo) coexist with the legacy
  // {statusFrom, statusTo, description} shape for backwards compat.

  // c-015 · Fresh PILOT ISO — Day 47 of 180. All fees $0.
  {
    id: 'ec-015-iso',
    authorizedEntityId: 'c-015',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2026-04-09T09:32:00Z',
    effectiveFrom: '2026-04-09T09:32:00Z',
    // 180-day pilot window. Anchored on the fixed demo "now" (May 26, 2026)
    // so the UI consistently shows "133 days left".
    effectiveTo: '2026-10-06T09:32:00Z',
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'PILOT',
    entitlements: {
      settlementCurrency: 'USD',
      deviceBasicService: { price: 0, currency: 'USD' },
      deviceModels: ['m-001', 'm-002'],
      FlyDesk:       { enable: true,  priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: true,  priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      // New event-typed entry (per EntityContractEvent schema)
      {
        eventType: 'BIND_PILOT',
        at: '2026-04-09T09:32:00Z',
        by: 'jordan.diaz@carbon',
        eventInfo: { initialEffectiveTo: '2026-10-06T09:32:00Z' },
        // Legacy fields for existing readers
        statusFrom: null, statusTo: 'PILOT',
        description: 'Pilot started · 180-day trial · all fees locked at $0',
      },
    ],
  },

  // c-016 · About-to-expire PILOT ISO — started 173 days ago, already
  // extended once (+90d → now T-7). Reminders fired at T-15 / T-7.
  {
    id: 'ec-016-iso',
    authorizedEntityId: 'c-016',
    authorizedContractType: 'ISO',
    authorizingEntityId: 'e-npt',
    authorizedAt: '2025-12-04T11:14:00Z',
    effectiveFrom: '2025-12-04T11:14:00Z',
    effectiveTo: '2026-06-02T11:14:00Z',           // 7 days from demo "now"
    terminatedByEntityId: null,
    terminatedAt: null,
    status: 'PILOT',
    entitlements: {
      settlementCurrency: 'USD',
      deviceBasicService: { price: 0, currency: 'USD' },
      deviceModels: ['m-001', 'm-005'],
      FlyDesk:       { enable: true,  priceStrategy: { price: 0, currency: 'USD' } },
      GeoLocation:   { enable: true,  priceStrategy: { price: 0, currency: 'USD' } },
      GeoFencing:    { enable: false, priceStrategy: { price: 0, currency: 'USD' } },
      'Pre-warning': { enable: true,  priceStrategy: { price: 0, currency: 'USD' } },
    },
    events: [
      {
        eventType: 'BIND_PILOT',
        at: '2025-12-04T11:14:00Z',
        by: 'jordan.diaz@carbon',
        eventInfo: { initialEffectiveTo: '2026-06-02T11:14:00Z' },
        statusFrom: null, statusTo: 'PILOT',
        description: 'Pilot started · 180-day trial · all fees locked at $0',
      },
      // Note: this pilot has NOT been extended yet in the seed (UI shows
      // it as "expiring soon" without a renewal history). Add a
      // PILOT_EXTEND event here if you want to demo the renewal trace.
    ],
  },
];

const SEED_ENTITY_CONTRACT_DELEGATIONS = [
  // Northwind delegates Sunbreak's ops to Brightleaf (OPERATE scope)
  {
    id: 'del-001',
    sourceContractId: 'ec-013-merch',
    delegatorEntityId: 'c-001',
    delegateeEntityId: 'c-003',
    delegationScope: 'OPERATE',
    effectiveFrom: '2026-03-01T00:00:00Z',
    effectiveTo: null,
    terminatedAt: null,
    status: 'ACTIVE',
    createdByUserId: 'u-c001-1', // Sarah Chen
  },
  // Brightleaf delegates Stonefield (VIEW_ONLY) to Cascade Channels for cross-border reporting
  {
    id: 'del-002',
    sourceContractId: 'ec-014-merch',
    delegatorEntityId: 'c-003',
    delegateeEntityId: 'c-012',
    delegationScope: 'VIEW_ONLY',
    effectiveFrom: '2026-04-12T00:00:00Z',
    effectiveTo: '2027-04-12T00:00:00Z',
    terminatedAt: null,
    status: 'ACTIVE',
    createdByUserId: 'u-c003-1', // Henry Tremblay
  },
];

// =====================================================================
// SEED_USERS — every person who can log in (platform staff + customer ops).
// One row per actual person; same person ⇄ multiple entities goes through
// SEED_ENTITY_USER_RELATIONSHIPS.
//
// Fields (per spec model):
//   id, username, passwordHash, passwordChangedTimestamp,
//   passwordErrorTimes, passwordErrorLockExpiredTimestamp,
//   nickname, email, country,
//   mfaEnable, status (ACTIVE/LOCKED),
//   lastLoginAt, passwordHistory (max 5), remark.
//
// `passwordHash` is stubbed (we don't store real hashes in the mock); the
// field is present so the shape matches production.
// =====================================================================
const SEED_USERS = [
  // ─── Platform staff (NPT entity-user relationships) ─────
  {
    id: 'u-1',
    username: 'admin',
    passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-03-01T10:00:00Z',
    passwordErrorTimes: 0,
    passwordErrorLockExpiredTimestamp: null,
    nickname: 'System Admin',
    email: 'admin@carbon',
    country: 'CN',
    mfaEnable: true,
    status: 'ACTIVE',
    lastLoginAt: '2026-05-12T08:14:00Z',
    passwordHistory: [
      { id: 'ph-1-1', changedTimestamp: '2026-03-01T10:00:00Z', cretimeTimestamp: '2025-12-01T10:00:00Z' },
      { id: 'ph-1-2', changedTimestamp: '2025-12-01T10:00:00Z', cretimeTimestamp: '2025-09-01T10:00:00Z' },
      { id: 'ph-1-3', changedTimestamp: '2025-09-01T10:00:00Z', cretimeTimestamp: '2025-06-01T10:00:00Z' },
    ],
    remark: 'Carbon root administrator account.',
  },
  {
    id: 'u-2',
    username: 'jordan.d',
    passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-04-18T09:22:00Z',
    passwordErrorTimes: 0,
    passwordErrorLockExpiredTimestamp: null,
    nickname: 'Jordan Diaz',
    email: 'jordan.d@carbon',
    country: 'US',
    mfaEnable: true,
    status: 'ACTIVE',
    lastLoginAt: '2026-05-12T13:42:00Z',
    passwordHistory: [
      { id: 'ph-2-1', changedTimestamp: '2026-04-18T09:22:00Z', cretimeTimestamp: '2026-01-18T09:22:00Z' },
      { id: 'ph-2-2', changedTimestamp: '2026-01-18T09:22:00Z', cretimeTimestamp: '2025-10-18T09:22:00Z' },
    ],
    remark: 'Operations lead — covers EMEA + APAC desks.',
  },
  {
    id: 'u-3',
    username: 'priya.k',
    passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-02-04T10:00:00Z',
    passwordErrorTimes: 2,
    passwordErrorLockExpiredTimestamp: null,
    nickname: 'Priya Krishnan',
    email: 'priya.k@carbon',
    country: 'IN',
    mfaEnable: true,
    status: 'ACTIVE',
    lastLoginAt: '2026-05-11T22:18:00Z',
    passwordHistory: [
      { id: 'ph-3-1', changedTimestamp: '2026-02-04T10:00:00Z', cretimeTimestamp: '2025-11-04T10:00:00Z' },
    ],
    remark: '',
  },
  {
    id: 'u-4',
    username: 'marcus.r',
    passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-11-12T10:00:00Z',
    passwordErrorTimes: 5,
    passwordErrorLockExpiredTimestamp: '2026-05-19T15:30:00Z',
    nickname: 'Marcus Reilly',
    email: 'marcus.r@carbon',
    country: 'IE',
    mfaEnable: false,
    status: 'LOCKED',
    lastLoginAt: '2026-04-30T14:22:00Z',
    passwordHistory: [
      { id: 'ph-4-1', changedTimestamp: '2025-11-12T10:00:00Z', cretimeTimestamp: '2025-08-08T09:00:00Z' },
    ],
    remark: 'Locked: 5 consecutive failed login attempts.',
  },
  {
    id: 'u-5',
    username: 'lena.h',
    passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-05-01T11:15:00Z',
    passwordErrorTimes: 0,
    passwordErrorLockExpiredTimestamp: null,
    nickname: 'Lena Hartmann',
    email: 'lena.h@carbon',
    country: 'DE',
    mfaEnable: true,
    status: 'ACTIVE',
    lastLoginAt: '2026-05-11T16:00:00Z',
    passwordHistory: [
      { id: 'ph-5-1', changedTimestamp: '2026-05-01T11:15:00Z', cretimeTimestamp: '2026-02-01T11:15:00Z' },
    ],
    remark: '',
  },

  // ─── Northwind (c-001) operators ──────────────────────
  {
    id: 'u-c001-1', username: 'sarah.chen', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-12-04T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Sarah Chen', email: 'sarah.chen@northwind.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-11T08:14:00Z',
    passwordHistory: [{ id: 'ph-c001-1', changedTimestamp: '2025-12-04T10:00:00Z', cretimeTimestamp: '2025-08-15T16:05:00Z' }],
    remark: 'Northwind founder & first Admin.',
  },
  {
    id: 'u-c001-2', username: 'marcus.webb', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-01-19T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Marcus Webb', email: 'marcus.webb@northwind.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-10T17:31:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c001-3', username: 'priya.anand', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-11-22T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Priya Anand', email: 'priya.anand@northwind.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-09T11:02:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c001-4', username: 'daniel.okafor', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-09-12T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Daniel Okafor', email: 'daniel.okafor@northwind.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-04-28T22:48:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Helios (c-002) operators ─────────────────────────
  {
    id: 'u-c002-1', username: 'elena.rossi', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-04-24T09:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Elena Rossi', email: 'elena.rossi@helios.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-12T07:02:00Z',
    passwordHistory: [],
    remark: 'Helios founding Admin.',
  },

  // ─── Brightleaf (c-003) operators ─────────────────────
  {
    id: 'u-c003-1', username: 'henry.tremblay', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-04-12T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Henry Tremblay', email: 'henry.tremblay@brightleaf.example', country: 'CA',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-11T19:50:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c003-2', username: 'jasmine.park', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-05-02T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Jasmine Park', email: 'jasmine.park@brightleaf.example', country: 'CA',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-10T13:18:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Vanta (c-004) operators ──────────────────────────
  {
    id: 'u-c004-1', username: 'lukas.meier', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-12-20T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Lukas Meier', email: 'lukas.meier@vanta.example', country: 'CH',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-11T15:00:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Coastline (c-005) operators ──────────────────────
  {
    id: 'u-c005-1', username: 'maria.alvarez', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-04-10T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Maria Alvarez', email: 'maria.alvarez@coastline.example', country: 'US',
    mfaEnable: false, status: 'LOCKED', lastLoginAt: '2026-02-10T14:22:00Z',
    passwordHistory: [],
    remark: 'Account locked alongside the Coastline ISO contract suspension.',
  },
  {
    id: 'u-c005-2', username: 'carlos.mendez', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2025-05-30T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Carlos Mendez', email: 'carlos.mendez@coastline.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-02-09T19:05:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Loomis (c-006) operators ─────────────────────────
  {
    id: 'u-c006-1', username: 'eli.wagner', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-05-12T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Eli Wagner', email: 'eli.wagner@loomis.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-22T13:18:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c006-2', username: 'rachel.yoon', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-05-13T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Rachel Yoon', email: 'rachel.yoon@loomis.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-11T16:48:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c006-3', username: 'tomas.herrera', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-05-13T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Tomás Herrera', email: 'tomas.herrera@loomis.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-10T08:14:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Bluefin (c-007) operators ────────────────────────
  {
    id: 'u-c007-1', username: 'akiko.tanaka', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-02-19T16:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Akiko Tanaka', email: 'akiko.tanaka@bluefin.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-12T10:32:00Z',
    passwordHistory: [],
    remark: '',
  },
  {
    id: 'u-c007-2', username: 'diego.ramos', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-03-05T10:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Diego Ramos', email: 'diego.ramos@bluefin.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-11T17:14:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Westport (c-011) operators ───────────────────────
  {
    id: 'u-c011-1', username: 'megan.oconnell', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-04-15T15:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: "Megan O'Connell", email: 'megan.oconnell@westport-marine.example', country: 'CA',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-22T08:14:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Cascade Channels (c-012) operators ───────────────
  {
    id: 'u-c012-1', username: 'rosa.lin', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-01-23T16:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Rosa Lin', email: 'rosa.lin@cascade-ch.example', country: 'US',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-11T10:20:00Z',
    passwordHistory: [],
    remark: 'Cascade Channels founding Admin · sub-ISO under Northwind.',
  },

  // ─── Sunbreak (c-013) operators ───────────────────────
  {
    id: 'u-c013-1', username: 'theo.marsh', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-02-08T18:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Theo Marsh', email: 'theo.marsh@sunbreak.example', country: 'US',
    mfaEnable: false, status: 'ACTIVE', lastLoginAt: '2026-05-12T07:55:00Z',
    passwordHistory: [],
    remark: '',
  },

  // ─── Stonefield (c-014) operators ─────────────────────
  {
    id: 'u-c014-1', username: 'daxton.reyes', passwordHash: '$mock$argon2id$…',
    passwordChangedTimestamp: '2026-03-25T12:00:00Z', passwordErrorTimes: 0, passwordErrorLockExpiredTimestamp: null,
    nickname: 'Daxton Reyes', email: 'daxton.reyes@stonefield.example', country: 'CA',
    mfaEnable: true, status: 'ACTIVE', lastLoginAt: '2026-05-11T19:00:00Z',
    passwordHistory: [],
    remark: '',
  },
];

// =====================================================================
// SEED_MFA_INFO — TOTP secrets + failure counters, per user.
// Only present for users with mfaEnable = true. One row per user.
// =====================================================================
const SEED_MFA_INFO = [
  { id: 'mfa-1',     userId: 'u-1',     mfaType: 'TOTP', secretEncrypted: 'enc:JBSWY3DPEHPK3PXP',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-2',     userId: 'u-2',     mfaType: 'TOTP', secretEncrypted: 'enc:KRSXG5BAOJSWG4TFOQ',   failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-3',     userId: 'u-3',     mfaType: 'TOTP', secretEncrypted: 'enc:MFRGG43BNFUHGZLOMQ',   failTimes: 1, lastFailTimestamp: '2026-05-08T09:14:00Z', status: 1 },
  { id: 'mfa-5',     userId: 'u-5',     mfaType: 'TOTP', secretEncrypted: 'enc:NBSWY3DPMRSXSI3F',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c001-1',userId: 'u-c001-1',mfaType: 'TOTP', secretEncrypted: 'enc:OBQXG43XN5ZGI2DJN5XQ', failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c001-3',userId: 'u-c001-3',mfaType: 'TOTP', secretEncrypted: 'enc:PBSXSI3VMVZWS3DJN5XS', failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c002-1',userId: 'u-c002-1',mfaType: 'TOTP', secretEncrypted: 'enc:QBQXG43XN5ZGSY3DMNUW', failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c003-1',userId: 'u-c003-1',mfaType: 'TOTP', secretEncrypted: 'enc:RBSWS43JN5XGSZTV',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c004-1',userId: 'u-c004-1',mfaType: 'TOTP', secretEncrypted: 'enc:SBSXG43BN5ZGOX3FNZ',   failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c006-1',userId: 'u-c006-1',mfaType: 'TOTP', secretEncrypted: 'enc:TBSXG3DTMRZWG4TF',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c007-1',userId: 'u-c007-1',mfaType: 'TOTP', secretEncrypted: 'enc:UBQWG33VMVZGS43F',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c011-1',userId: 'u-c011-1',mfaType: 'TOTP', secretEncrypted: 'enc:VBSWS43BN5XGOX3FN5XW', failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c012-1',userId: 'u-c012-1',mfaType: 'TOTP', secretEncrypted: 'enc:WBSWG4DBN5XGSZTV',     failTimes: 0, lastFailTimestamp: null,                  status: 1 },
  { id: 'mfa-c014-1',userId: 'u-c014-1',mfaType: 'TOTP', secretEncrypted: 'enc:XBSWG43VMVZGSY3DOJ',   failTimes: 0, lastFailTimestamp: null,                  status: 1 },
];

// =====================================================================
// SEED_ENTITY_USER_RELATIONSHIPS — entity ⇄ user N-to-N association.
//
// Fields (per spec model):
//   id, entityId, userId,
//   authorizingType        — 'ADMIN'  (gets all permissions on this entity) OR
//                          — 'NORMAL' (permissions resolved from role bindings)
//   roleIds                — only meaningful when authorizingType = 'NORMAL'
//   authorizingTimestamp   — when this relationship was created
//   authorizingUserId      — who created it (refers to a USER)
//   authorizingUserName    — denormalized for display
//   status                 — ACTIVE / EXPIRED / LOCKED
//                            (no PENDING — pending invites live in
//                             SEED_OPERATOR_INVITES until consumed)
//   authorizingFrom        — null = no start limit
//   authorizingTo          — null = no end limit
// =====================================================================
const SEED_ENTITY_USER_RELATIONSHIPS = [
  // ─── NPT platform staff ─────────────────────────────
  {
    id: 'eur-npt-1', entityId: 'e-npt', userId: 'u-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2024-01-01T00:00:00Z',
    authorizingUserId: 'system', authorizingUserName: 'System',
    status: 'ACTIVE', authorizingFrom: null, authorizingTo: null,
  },
  {
    id: 'eur-npt-2', entityId: 'e-npt', userId: 'u-2',
    authorizingType: 'NORMAL', roleIds: ['r-admin-ops'],
    authorizingTimestamp: '2024-06-12T09:00:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: null, authorizingTo: null,
  },
  {
    id: 'eur-npt-3', entityId: 'e-npt', userId: 'u-3',
    authorizingType: 'NORMAL', roleIds: ['r-admin-compliance'],
    authorizingTimestamp: '2025-01-22T09:00:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: null, authorizingTo: null,
  },
  {
    id: 'eur-npt-4', entityId: 'e-npt', userId: 'u-4',
    authorizingType: 'NORMAL', roleIds: ['r-admin-ops'],
    authorizingTimestamp: '2025-08-08T09:00:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'LOCKED', authorizingFrom: null, authorizingTo: null,
  },
  {
    id: 'eur-npt-5', entityId: 'e-npt', userId: 'u-5',
    authorizingType: 'NORMAL', roleIds: ['r-admin-viewer'],
    authorizingTimestamp: '2025-09-30T10:00:00Z',
    authorizingUserId: 'u-2', authorizingUserName: 'Jordan Diaz',
    status: 'ACTIVE', authorizingFrom: null, authorizingTo: null,
  },

  // ─── Northwind (c-001) ──────────────────────────────
  {
    id: 'eur-c001-1', entityId: 'c-001', userId: 'u-c001-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2025-08-15T16:05:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2025-08-15T16:05:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c001-2', entityId: 'c-001', userId: 'u-c001-2',
    authorizingType: 'NORMAL', roleIds: ['r-operator'],
    authorizingTimestamp: '2025-08-18T09:02:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2025-08-18T09:02:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c001-3', entityId: 'c-001', userId: 'u-c001-3',
    authorizingType: 'NORMAL', roleIds: ['r-operator'],
    authorizingTimestamp: '2025-08-21T11:30:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2025-08-21T11:30:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c001-4', entityId: 'c-001', userId: 'u-c001-4',
    authorizingType: 'NORMAL', roleIds: ['r-viewer'],
    authorizingTimestamp: '2025-08-25T14:18:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2025-08-25T14:18:00Z', authorizingTo: null,
  },

  // ─── Helios (c-002) ─────────────────────────────────
  {
    id: 'eur-c002-1', entityId: 'c-002', userId: 'u-c002-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-04-24T08:42:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2026-04-24T08:42:00Z', authorizingTo: null,
  },

  // ─── Brightleaf (c-003) ─────────────────────────────
  {
    id: 'eur-c003-1', entityId: 'c-003', userId: 'u-c003-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2025-03-11T15:42:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2025-03-11T15:42:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c003-2', entityId: 'c-003', userId: 'u-c003-2',
    authorizingType: 'NORMAL', roleIds: ['r-operator'],
    authorizingTimestamp: '2025-04-02T11:08:00Z',
    authorizingUserId: 'u-c003-1', authorizingUserName: 'Henry Tremblay',
    status: 'ACTIVE', authorizingFrom: '2025-04-02T11:08:00Z', authorizingTo: null,
  },

  // ─── Vanta (c-004) ──────────────────────────────────
  {
    id: 'eur-c004-1', entityId: 'c-004', userId: 'u-c004-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2025-11-20T13:42:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2025-11-20T13:42:00Z', authorizingTo: null,
  },

  // ─── Coastline (c-005) ──────────────────────────────
  // Note: status = LOCKED tracks the Coastline ISO contract suspension.
  {
    id: 'eur-c005-1', entityId: 'c-005', userId: 'u-c005-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2024-12-04T14:18:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'LOCKED', authorizingFrom: '2024-12-04T14:18:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c005-2', entityId: 'c-005', userId: 'u-c005-2',
    authorizingType: 'NORMAL', roleIds: ['r-operator'],
    authorizingTimestamp: '2025-01-22T12:30:00Z',
    authorizingUserId: 'u-c005-1', authorizingUserName: 'Maria Alvarez',
    status: 'LOCKED', authorizingFrom: '2025-01-22T12:30:00Z', authorizingTo: null,
  },

  // ─── Loomis (c-006) ─────────────────────────────────
  {
    id: 'eur-c006-1', entityId: 'c-006', userId: 'u-c006-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-05-10T11:22:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2026-05-10T11:22:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c006-2', entityId: 'c-006', userId: 'u-c006-2',
    authorizingType: 'NORMAL', roleIds: ['r-operator'],
    authorizingTimestamp: '2026-05-10T15:48:00Z',
    authorizingUserId: 'u-c006-1', authorizingUserName: 'Eli Wagner',
    status: 'ACTIVE', authorizingFrom: '2026-05-10T15:48:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c006-3', entityId: 'c-006', userId: 'u-c006-3',
    authorizingType: 'NORMAL', roleIds: ['r-viewer'],
    authorizingTimestamp: '2026-05-10T15:50:00Z',
    authorizingUserId: 'u-c006-1', authorizingUserName: 'Eli Wagner',
    status: 'ACTIVE', authorizingFrom: '2026-05-10T15:50:00Z', authorizingTo: null,
  },

  // ─── Bluefin (c-007) ────────────────────────────────
  {
    id: 'eur-c007-1', entityId: 'c-007', userId: 'u-c007-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-02-19T15:10:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2026-02-19T15:10:00Z', authorizingTo: null,
  },
  {
    id: 'eur-c007-2', entityId: 'c-007', userId: 'u-c007-2',
    authorizingType: 'NORMAL', roleIds: ['r-merchant-support'],
    authorizingTimestamp: '2026-03-04T11:08:00Z',
    authorizingUserId: 'u-c007-1', authorizingUserName: 'Akiko Tanaka',
    status: 'ACTIVE', authorizingFrom: '2026-03-04T11:08:00Z', authorizingTo: null,
  },

  // ─── Westport (c-011) ───────────────────────────────
  {
    id: 'eur-c011-1', entityId: 'c-011', userId: 'u-c011-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-04-15T14:08:00Z',
    authorizingUserId: 'u-1', authorizingUserName: 'System Admin',
    status: 'ACTIVE', authorizingFrom: '2026-04-15T14:08:00Z', authorizingTo: null,
  },

  // ─── Cascade Channels (c-012) ───────────────────────
  {
    id: 'eur-c012-1', entityId: 'c-012', userId: 'u-c012-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-01-23T15:30:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2026-01-23T15:30:00Z', authorizingTo: null,
  },

  // ─── Sunbreak (c-013) ───────────────────────────────
  {
    id: 'eur-c013-1', entityId: 'c-013', userId: 'u-c013-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-02-08T17:18:00Z',
    authorizingUserId: 'u-c001-1', authorizingUserName: 'Sarah Chen',
    status: 'ACTIVE', authorizingFrom: '2026-02-08T17:18:00Z', authorizingTo: null,
  },

  // ─── Stonefield (c-014) ─────────────────────────────
  {
    id: 'eur-c014-1', entityId: 'c-014', userId: 'u-c014-1',
    authorizingType: 'ADMIN', roleIds: [],
    authorizingTimestamp: '2026-03-25T11:00:00Z',
    authorizingUserId: 'u-c003-1', authorizingUserName: 'Henry Tremblay',
    status: 'ACTIVE', authorizingFrom: '2026-03-25T11:00:00Z', authorizingTo: null,
  },
];

// =====================================================================
// SEED_OPERATOR_INVITES — outstanding invitations (consumed or not).
//
// Fields (per spec model):
//   id, inviterUserId, inviteEmail, token,
//   expiresAt (createdAt + PASSWORD_POLICY.inviteTokenDays),
//   consumedAt, resendCount.
//
// Extension fields for the mock UI (NOT in the formal model):
//   entityId           — which entity this invite is for
//   inviterEntityId    — which entity issued it (for display)
//   inviterUserName    — denormalized for display
//   inviteRoleIds      — pre-assigned roles when consumed
//   inviteAuthType     — 'ADMIN' (first admin) | 'NORMAL'
//   inviteMethod       — 'email' | 'link'
//   createdAt          — when the token was minted
//
// A consumed invite is kept around for audit purposes (`consumedAt != null`).
// =====================================================================
const SEED_OPERATOR_INVITES = [
  // Aurora Freight (c-009) — invite alive, not consumed (Case 2)
  {
    id: 'inv-aurora-1',
    inviterUserId: 'u-2',
    inviterEntityId: 'e-npt',
    inviterUserName: 'Jordan Diaz',
    inviteEmail: 'ceo@aurora-freight.example',
    token: 'a3kf9p2x-7m4q',
    createdAt: '2026-05-21T11:30:00Z',
    expiresAt: '2026-05-28T11:30:00Z',
    consumedAt: null,
    resendCount: 0,
    entityId: 'c-009',
    inviteRoleIds: [],                   // first admin → authorizingType ADMIN
    inviteAuthType: 'ADMIN',
    inviteMethod: 'email',
  },

  // Sandstone (c-010) — invite expired without consumption (Case 3)
  {
    id: 'inv-sandstone-1',
    inviterUserId: 'u-c003-1',
    inviterEntityId: 'c-003',
    inviterUserName: 'Henry Tremblay',
    inviteEmail: null,                   // link-only (Copy link path)
    token: 'sb7q4nx9-pl3z',
    createdAt: '2026-05-08T15:00:00Z',
    expiresAt: '2026-05-15T15:00:00Z',
    consumedAt: null,
    resendCount: 0,
    entityId: 'c-010',
    inviteRoleIds: [],
    inviteAuthType: 'ADMIN',
    inviteMethod: 'link',
  },

  // Pinegate (c-008) — no invite yet (Case 1: just registered, no row)
  // → intentionally omitted; the empty state on the Operators tab is what
  //   that case looks like.

  // Outstanding platform-staff invite (formerly the half-formed `u-inv-7k2qp`
  // record on SEED_USERS — now lives ONLY here until consumed).
  {
    id: 'inv-npt-1',
    inviterUserId: 'u-2',
    inviterEntityId: 'e-npt',
    inviterUserName: 'Jordan Diaz',
    inviteEmail: 'kai.tanaka@example.com',
    token: 'inv-7k2qp',
    createdAt: '2026-05-16T14:22:00Z',
    expiresAt: '2026-05-23T14:22:00Z',
    consumedAt: null,
    resendCount: 0,
    entityId: 'e-npt',
    inviteRoleIds: ['r-admin-ops'],
    inviteAuthType: 'NORMAL',
    inviteMethod: 'email',
  },
];

// =====================================================================
// SEED_ROLE_BLOCKLIST — per (entity + contract type) hide certain GLOBAL roles.
//
// Used when a customer doesn't want one of the platform-provided global
// roles to be assignable to their operators. Example below: Helios's ISO
// arm doesn't want anyone using the generic "Viewer" role (they enforce
// stricter custom roles).
// =====================================================================
const SEED_ROLE_BLOCKLIST = [
  {
    id: 'rbl-1',
    entityId: 'c-002',
    contractType: 'ISO',
    roleId: 'r-viewer',
  },
];

// =====================================================================
// Window export
// =====================================================================
Object.assign(window, {
  COUNTRIES, COUNTRY_BY_CODE,
  CONTRACT_TYPES, CONTRACT_STATUSES, DELEGATION_SCOPES, PASSWORD_POLICY,
  SEED_ENTITIES,
  SEED_ENTITY_CONTRACTS,
  SEED_ENTITY_CONTRACT_DELEGATIONS,
  SEED_USERS,
  SEED_MFA_INFO,
  SEED_ENTITY_USER_RELATIONSHIPS,
  SEED_OPERATOR_INVITES,
  SEED_ROLE_BLOCKLIST,
});
