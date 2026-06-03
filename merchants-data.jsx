/* global React */
// ─────────────────────────────────────────────────────────────
// Merchants seed data — feeds the merchant + store typeahead in
// the New Ticket form (tickets.jsx → DPCustomerScope) and any
// other surface that reads window.MERCHANTS.
//
// The admin portal's "customers" are ISO companies (data.jsx).
// Merchants are the downstream businesses those ISOs onboard;
// each merchant has 1..N stores, the first of which is the HQ
// (auto-created with the merchant). We don't need terminals on
// this side — they're sourced separately from the device fleet.
// ─────────────────────────────────────────────────────────────

(function seedMerchants() {
  if (typeof window === "undefined") return;
  if (window.MERCHANTS && window.MERCHANTS.length) return; // already seeded

  const MERCHANTS = [
    {
      id: "m-coffee", name: "Riverside Coffee Co.", country: "Canada",
      tags: ["F&B", "Multi-location", "VIP"],
      isoId: "c-001", // optional back-link to the owning ISO
      stores: [
        { id: "s-coffee-hq",  name: "Riverside Coffee Co.", isHQ: true,
          address: "402 St-Laurent Blvd, Montréal, QC" },
        { id: "s-coffee-pln", name: "Plateau Roastery",
          address: "5640 Av du Parc, Montréal, QC" },
        { id: "s-coffee-old", name: "Old Port Kiosk",
          address: "10 Rue de la Commune E, Montréal, QC" },
        { id: "s-coffee-mtr", name: "Mile End Counter",
          address: "5119 Boul Saint-Laurent, Montréal, QC" },
      ],
    },
    {
      id: "m-pharma", name: "Cedar Park Pharmacy", country: "Canada",
      tags: ["Healthcare", "Single-location"],
      stores: [
        { id: "s-pharma-hq", name: "Cedar Park Pharmacy", isHQ: true,
          address: "1284 Whyte Ave NW, Edmonton, AB" },
      ],
    },
    {
      id: "m-bistro", name: "Cascade Bistro Group", country: "Canada",
      tags: ["F&B", "Multi-location"],
      stores: [
        { id: "s-bistro-hq",  name: "Cascade Bistro Group", isHQ: true,
          address: "1490 Robson St, Vancouver, BC" },
        { id: "s-bistro-pmt", name: "Port Moody Bistro",
          address: "3107 St Johns St, Port Moody, BC" },
        { id: "s-bistro-kit", name: "Kitsilano Wine Bar",
          address: "2245 W 4th Ave, Vancouver, BC" },
      ],
    },
    {
      id: "m-books", name: "Trillium Books", country: "Canada",
      tags: ["Retail"],
      stores: [
        { id: "s-books-hq", name: "Trillium Books", isHQ: true,
          address: "92 Bloor St W, Toronto, ON" },
      ],
    },
    {
      id: "m-glacier", name: "Glacier Grocers", country: "Canada",
      tags: ["Retail", "Multi-location", "Enterprise"],
      stores: [
        { id: "s-glacier-hq",      name: "Glacier Grocers",          isHQ: true,
          address: "100 W Pender St, Vancouver, BC" },
        { id: "s-glacier-bby",     name: "Burnaby Mega",
          address: "4400 Hastings St, Burnaby, BC" },
        { id: "s-glacier-ric",     name: "Richmond Pavilion",
          address: "5300 No 3 Rd, Richmond, BC" },
        { id: "s-glacier-cal",     name: "Calgary Beltline",
          address: "1234 17 Ave SW, Calgary, AB" },
        { id: "s-glacier-van-com", name: "Vancouver Commercial Drive",
          address: "1850 Commercial Dr, Vancouver, BC" },
        { id: "s-glacier-van-kit", name: "Vancouver Kitsilano",
          address: "2150 W 4th Ave, Vancouver, BC" },
        { id: "s-glacier-van-dt",  name: "Vancouver Downtown",
          address: "555 Robson St, Vancouver, BC" },
        { id: "s-glacier-sur",     name: "Surrey Central",
          address: "10153 King George Blvd, Surrey, BC" },
        { id: "s-glacier-coq",     name: "Coquitlam Centre",
          address: "2929 Barnet Hwy, Coquitlam, BC" },
        { id: "s-glacier-vic",     name: "Victoria Inner Harbour",
          address: "950 Government St, Victoria, BC" },
        { id: "s-glacier-kel",     name: "Kelowna Orchard Park",
          address: "2271 Harvey Ave, Kelowna, BC" },
        { id: "s-glacier-cal-mr",  name: "Calgary Market Mall",
          address: "3625 Shaganappi Trail NW, Calgary, AB" },
        { id: "s-glacier-edm-dt",  name: "Edmonton Downtown",
          address: "10180 101 St NW, Edmonton, AB" },
        { id: "s-glacier-edm-wm",  name: "Edmonton West Mall",
          address: "8882 170 St NW, Edmonton, AB" },
      ],
    },
    {
      id: "m-northwind", name: "Northwind Logistics", country: "Canada",
      tags: ["Logistics", "Multi-location", "Enterprise"],
      stores: [
        { id: "s-nw-hq",  name: "Northwind Logistics HQ",  isHQ: true,
          address: "8830 Boundary Rd, Burnaby, BC" },
        { id: "s-nw-yyz", name: "Toronto Pearson Hub",
          address: "6300 Silver Dart Dr, Mississauga, ON" },
        { id: "s-nw-yul", name: "Montréal-Trudeau Hub",
          address: "975 Roméo-Vachon N, Dorval, QC" },
        { id: "s-nw-yyc", name: "Calgary Cross-Dock",
          address: "300 Aero Crescent NE, Calgary, AB" },
      ],
    },
    {
      id: "m-aurora", name: "Aurora Dental Group", country: "Canada",
      tags: ["Healthcare", "Multi-location"],
      stores: [
        { id: "s-aurora-hq",  name: "Aurora Dental Group", isHQ: true,
          address: "200 Wellington St W, Toronto, ON" },
        { id: "s-aurora-msg", name: "Mississauga Clinic",
          address: "100 City Centre Dr, Mississauga, ON" },
        { id: "s-aurora-msm", name: "Markham Family Dental",
          address: "8333 Kennedy Rd, Markham, ON" },
      ],
    },
    {
      id: "m-summit", name: "Summit Outdoor Outfitters", country: "Canada",
      tags: ["Retail", "Multi-location"],
      stores: [
        { id: "s-summit-hq",  name: "Summit Outdoor Outfitters", isHQ: true,
          address: "130 King St W, Toronto, ON" },
        { id: "s-summit-ban", name: "Banff Trailhead",
          address: "215 Banff Ave, Banff, AB" },
        { id: "s-summit-whi", name: "Whistler Village",
          address: "4154 Village Stroll, Whistler, BC" },
      ],
    },
    {
      id: "m-meridian", name: "Meridian Hotels & Resorts", country: "Canada",
      tags: ["Hospitality", "Enterprise"],
      stores: [
        { id: "s-mer-hq",  name: "Meridian Hotels HQ",       isHQ: true,
          address: "1 Front St W, Toronto, ON" },
        { id: "s-mer-yvr", name: "Meridian Vancouver Harbour",
          address: "1133 W Hastings St, Vancouver, BC" },
        { id: "s-mer-yyc", name: "Meridian Calgary Centre",
          address: "320 4 Ave SW, Calgary, AB" },
        { id: "s-mer-yul", name: "Meridian Montréal Vieux-Port",
          address: "350 Rue Saint-Paul E, Montréal, QC" },
        { id: "s-mer-yhz", name: "Meridian Halifax Waterfront",
          address: "1919 Upper Water St, Halifax, NS" },
      ],
    },
    {
      id: "m-hearth", name: "Hearth & Hops Brewing", country: "Canada",
      tags: ["F&B"],
      stores: [
        { id: "s-hearth-hq", name: "Hearth & Hops Brewing", isHQ: true,
          address: "55 Mill St, Toronto, ON" },
        { id: "s-hearth-tap", name: "Tap Room East",
          address: "1183 Queen St E, Toronto, ON" },
      ],
    },
    {
      id: "m-petal", name: "Petal & Pine Florist", country: "Canada",
      tags: ["Retail", "Single-location"],
      stores: [
        { id: "s-petal-hq", name: "Petal & Pine Florist", isHQ: true,
          address: "640 Queen St W, Toronto, ON" },
      ],
    },
    {
      id: "m-blueline", name: "Blue Line Taxi Co-op", country: "Canada",
      tags: ["Transport", "Single-location"],
      stores: [
        { id: "s-blueline-hq", name: "Blue Line Dispatch", isHQ: true,
          address: "1340 Ellesmere Rd, Scarborough, ON" },
      ],
    },
  ];

  // ─── Enrichment pass: assign ISO ownership + admin-portal fields ─
  // The admin portal's CustomerDetail "Merchants" tab needs each merchant
  // bound to an owning ISO (`isoId`) and decorated with the contact info
  // / MID / terminals counts / contracts / app assignments shown in the
  // read-only view. We layer it here so the typeahead-only consumers
  // (tickets.jsx) keep working — they just see extra fields they ignore.
  //
  // ISO assignments (ISO customers from data.jsx):
  //   c-001 Northwind Commerce  → m-coffee, m-glacier, m-bistro, m-books
  //   c-002 Helios Payments     → m-pharma, m-northwind, m-aurora
  //   c-004 Vanta Software      → m-summit, m-meridian, m-hearth, m-petal
  //   c-005 Coastline Retail    → m-blueline
  const ISO_BY_MERCHANT = {
    "m-coffee":    "c-001",
    "m-glacier":   "c-001",
    "m-bistro":    "c-001",
    "m-books":     "c-001",
    "m-pharma":    "c-002",
    "m-northwind": "c-002",
    "m-aurora":    "c-002",
    "m-summit":    "c-004",
    "m-meridian":  "c-004",
    "m-hearth":    "c-004",
    "m-petal":     "c-004",
    "m-blueline":  "c-005",
  };

  // Deterministic-ish hash → 8-digit MID. Same input → same output, so the
  // demo is stable across reloads.
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff; return h; };
  const mid  = (id) => "M" + String(82100000 + (hash(id) % 89999999)).padStart(8, "0");
  const tid  = (key) => "T" + String(1010000 + (hash(key) % 8999999)).padStart(8, "0");

  // Phone codes for the country list we have on file. Pragmatic, not authoritative.
  const PHONE_CC = { "Canada": "+1", "United States": "+1" };

  // Lightweight per-merchant enrichment overrides — name-tuned so the
  // contact + tag fields read like real records, but the rest is procedural.
  const EXTRAS = {
    "m-coffee":    { phone: "514-555-0142", email: "ops@riversidecoffee.ca",     createdAt: "Jan 14, 2024", notes: "12-location coffee chain. Pilot for the new offline-tip flow. Primary contact: Sandra Vu.", hasPortal: true,  portalExpires: null },
    "m-pharma":    { phone: "780-555-0188", email: "manager@cedarparkrx.ca",     createdAt: "Mar 02, 2024", notes: "", hasPortal: false },
    "m-bistro":    { phone: "604-555-2210", email: "gm@cascadebistro.ca",        createdAt: "Sep 21, 2023", notes: "Three locations across BC. Tip-out reports needed monthly.", hasPortal: false },
    "m-books":     { phone: "416-555-3380", email: "hello@trilliumbooks.ca",     createdAt: "Apr 18, 2024", notes: "Independent bookstore. Single till.", hasPortal: false },
    "m-glacier":   { phone: "604-555-1100", email: "it@glaciergrocers.ca",       createdAt: "Aug 04, 2023", notes: "Large grocery chain across BC and Alberta. SLA 24h support.", hasPortal: true,  portalExpires: "Sep 30, 2026" },
    "m-northwind": { phone: "604-555-9100", email: "ops@northwindlogistics.ca",  createdAt: "Jun 09, 2024", notes: "Logistics hubs nationwide; terminals on receiving docks.", hasPortal: true,  portalExpires: null },
    "m-aurora":    { phone: "416-555-7700", email: "billing@auroradental.ca",    createdAt: "Feb 11, 2025", notes: "", hasPortal: false },
    "m-summit":    { phone: "416-555-2244", email: "retail@summitoutdoor.ca",    createdAt: "Nov 03, 2023", notes: "Seasonal stores in Banff and Whistler.", hasPortal: true, portalExpires: null },
    "m-meridian":  { phone: "416-555-6900", email: "pos@meridianhotels.com",     createdAt: "Jul 22, 2023", notes: "F&B + front-desk terminals. Multi-currency.", hasPortal: true, portalExpires: "Dec 31, 2026" },
    "m-hearth":    { phone: "416-555-3322", email: "taproom@hearthandhops.ca",   createdAt: "May 05, 2024", notes: "", hasPortal: false },
    "m-petal":     { phone: "416-555-9988", email: "shop@petalandpine.ca",       createdAt: "Aug 17, 2024", notes: "", hasPortal: false },
    "m-blueline":  { phone: "416-555-4040", email: "dispatch@bluelinecoop.ca",   createdAt: "Oct 30, 2024", notes: "Single dispatch hub; mobile terminals in cabs.", hasPortal: false },
  };

  // App pool by ISO (matches publishers in apps-data.jsx). Each tuple is
  // {appId, version, status: 'active'|'paused'|'pending'}. The drill-in
  // read-only Apps tab walks this list.
  const APPS_BY_ISO = {
    "c-001": [
      { appId: "app-pos-pro",       versionId: "v-4-3-2",    versionLabel: "4.3.2",     status: "active",  strategy: "Custom",    assignedAt: "May 10, 2026" },
      { appId: "app-stockroom",     versionId: "v-2-1-2",    versionLabel: "2.1.2",     status: "active",  strategy: "Casual",    assignedAt: "May 05, 2026" },
      { appId: "app-smart-receipt", versionId: "v-1-1-8",    versionLabel: "1.1.8",     status: "paused",  strategy: "Not set",   assignedAt: "Mar 14, 2026" },
    ],
    "c-002": [
      { appId: "app-loyalty-plus",  versionId: "v-1-3-4",    versionLabel: "1.3.4",     status: "active",  strategy: "Immediate", assignedAt: "Apr 20, 2026" },
      { appId: "app-curbside",      versionId: "v-0-9-0",    versionLabel: "0.9.0-beta",status: "active",  strategy: "Custom",    assignedAt: "May 12, 2026" },
    ],
    "c-004": [
      { appId: "app-insights",      versionId: "v-1-2-0",    versionLabel: "1.2.0",     status: "active",  strategy: "Casual",    assignedAt: "Apr 12, 2026" },
      { appId: "app-catalog-sync",  versionId: "v-1-0-9",    versionLabel: "1.0.9",     status: "active",  strategy: "Casual",    assignedAt: "Apr 30, 2026" },
      { appId: "app-timeclock",     versionId: "v-2-0-5",    versionLabel: "2.0.5",     status: "active",  strategy: "Custom",    assignedAt: "Apr 21, 2026" },
    ],
    "c-005": [],
  };

  // Procedural terminals: hand out 0-3 per store based on its position in
  // the store list and merchant size. Larger merchants (m-glacier) get more.
  const TERMINAL_DENSITY = { "m-glacier": 3, "m-coffee": 2, "m-bistro": 2, "m-meridian": 2, "m-summit": 2, "m-northwind": 2 };
  const MODELS = ["N950", "N750", "S90", "S60"];
  const STATES = ["active", "active", "active", "active", "active", "pending"]; // 5:1

  MERCHANTS.forEach(m => {
    const iso = ISO_BY_MERCHANT[m.id] || m.isoId || null;
    const extras = EXTRAS[m.id] || { phone: null, email: null, createdAt: "—", notes: "", hasPortal: false };
    const density = TERMINAL_DENSITY[m.id] ?? 1;

    m.isoId = iso;
    m.mid = m.mid || mid(m.id);
    m.phoneCountryCode = m.phoneCountryCode || PHONE_CC[m.country] || "+1";
    m.phone = extras.phone;
    m.email = extras.email;
    m.createdAt = extras.createdAt;
    m.notes = extras.notes;

    // Enrich stores with terminals.
    m.stores = (m.stores || []).map((s, i) => {
      const count = i === 0 ? Math.max(1, density + 1) : (i % 3 === 0 ? 0 : density);
      const terminals = Array.from({ length: count }, (_, j) => {
        const isPending = STATES[(hash(s.id) + j) % STATES.length] === "pending";
        const model = MODELS[(hash(s.id) + j) % MODELS.length];
        return {
          sn: isPending ? null : `${model}-${String(hash(s.id) % 10000).padStart(4, "0")}-${String(j + 1).padStart(4, "0")}`,
          model: isPending ? null : model,
          tid: tid(`${s.id}:${j}`),
          state: isPending ? "pending" : "active",
          lastSeen: isPending ? "—" : ["just now", "2 min ago", "12 min ago", "1 hour ago", "yesterday"][(hash(s.id) + j) % 5],
        };
      });
      return { ...s, country: s.country || m.country, terminals };
    });

    // Aggregate terminals count for table column.
    m.terminalsCount = m.stores.reduce((n, s) => n + s.terminals.length, 0);
    m.activeTerminalsCount = m.stores.reduce((n, s) => n + s.terminals.filter(t => t.state === "active").length, 0);

    // Contracts — MERCHANT always; MERCHANT_PORTAL if enrichment opts in.
    m.contracts = [
      { type: "MERCHANT", grantedAt: extras.createdAt, expiresAt: null, status: "active", operator: "—",
        description: "Base contract — required for store, terminal, payment and app maintenance." },
    ];
    if (extras.hasPortal) {
      m.contracts.push({
        type: "MERCHANT_PORTAL",
        grantedAt: extras.createdAt,
        expiresAt: extras.portalExpires || null,
        status: "active",
        operator: "M. Hassan",
        description: "Enables the self-service portal — operators can sign in to manage their own configuration.",
      });
    }
    m.disabled = false;

    // Apps — copy from the ISO's pool (admin-side data); only present if
    // the ISO has an app pool seeded.
    m.apps = (APPS_BY_ISO[iso] || []).slice(0, 3);
  });

  window.MERCHANTS = MERCHANTS;
  // Convenience lookup used by the admin portal Merchants tab.
  window.getMerchantsByIso = (isoId) =>
    (window.MERCHANTS || []).filter(m => m.isoId === isoId);

  // ─── Sync synthesized terminal SNs into window.PROD_DEVICES ────
  // Each merchant terminal we generated above carries a deterministic SN.
  // The device-detail screen looks up devices via window.findDeviceBySn,
  // which reads from PROD_DEVICES (seeded by devices-fleet.jsx). If we
  // don't register our synthesized SNs there, every SN click from the
  // merchant detail lands on "Device not found".
  //
  // PROD_DEVICES is seeded by devices-fleet.jsx, which loads AFTER this
  // file. setTimeout(0) defers the sync until that script has executed.
  setTimeout(() => {
    window.PROD_DEVICES = window.PROD_DEVICES || [];
    const existing = new Set(window.PROD_DEVICES.map(d => d.sn));
    MERCHANTS.forEach(m => {
      (m.stores || []).forEach(s => {
        (s.terminals || []).forEach(t => {
          if (!t.sn || existing.has(t.sn)) return;
          existing.add(t.sn);
          // Stub device record — enough fields that DeviceDetailScreen
          // doesn't blow up. Real fleet records carry far more; this is
          // synthesised on-demand so the navigation just works.
          window.PROD_DEVICES.push({
            sn: t.sn, model: t.model || "N950",
            os: "Android 14",
            firmware: "TOMS 8.2.1-r127",
            buildNumber: "8.2.1.127.prod",
            activatedAt: m.createdAt || "—",
            createdAt:   m.createdAt || "—",
            lastSeenAt:  t.lastSeen  || "just now",
            state: t.state === "pending" ? "pending" : "active",
            merchantId: m.id, storeId: s.id,
            imei: null, macAddress: null,
            storage:  { total: 32, used: 12 },
            battery:  { level: 80, health: "good" },
            hardware: { root: false, devMode: false, securityWarnings: [] },
            network:  { sim: { enabled: false },
                        ethernet: { enabled: false },
                        wifi: { enabled: true, ssid: `${s.name}-POS` } },
            settings: { timezone: m.country === "United States" ? "America/New_York" : "America/Toronto",
                        language: "en-CA",
                        autoTimezone: true, autoTime: true },
            apps: [],
          });
        });
      });
    });
  }, 0);

  // Provide a real lookup — without this, every candidate row in the
  // New Ticket picker shows "Unbound" even when the device has a
  // perfectly valid merchantId, which reads as a broken row.
  // (workbench-shims.jsx installs a null-returning stub if nothing has
  // claimed the slot yet — `|| ((id) => …)` lets that stub remain a
  // backstop while we override with the actual implementation.)
  const merchantById = new Map(MERCHANTS.map((m) => [m.id, m]));
  window.findMerchantById = (id) => merchantById.get(id) || null;
  window.findStoreById = (merchantId, storeId) => {
    const m = merchantById.get(merchantId);
    return m ? (m.stores || []).find((s) => s.id === storeId) || null : null;
  };
})();
