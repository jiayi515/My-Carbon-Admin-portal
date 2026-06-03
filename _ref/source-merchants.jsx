/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Merchants module
// Hierarchy:  Merchant → Store → Terminal
//   · Every merchant has at least one "headquarter" store that's auto-
//     created with the merchant. When that's the only store, we don't
//     render it as its own row — the terminals it owns appear directly
//     under the merchant. Adding a second store immediately surfaces the
//     headquarter row too, so the user can see exactly where things live.
//   · Terminals always belong to a store (never the merchant directly);
//     the headquarter just keeps that invariant true when the user hasn't
//     bothered to model stores yet.
// ─────────────────────────────────────────────────────────────

const { useState: useStateM, useEffect: useEffectM, useMemo: useMemoM, useRef: useRefM } = React;

// ─── Mock data ───────────────────────────────────────────────
// Country list — keep small enough that a simple select works.
const COUNTRIES = [
  "Canada", "United States", "Mexico", "United Kingdom", "Germany",
  "France", "Australia", "Japan", "Singapore", "Brazil",
];

// Seed merchants. Each carries one or more stores; the first store is
// always the headquarter (isHQ = true) and is auto-created on merchant
// creation. Terminals reference their owning store via storeId.
const MERCHANTS_SEED = [
  {
    id: "m-coffee", name: "Riverside Coffee Co.", country: "Canada",
    tags: ["F&B", "Multi-location", "VIP"],
    notes: "12-location coffee chain. Pilot for the new offline-tip flow. Primary contact: Sandra Vu.",
    createdAt: "Jan 14, 2024",
    stores: [
      { id: "s-coffee-hq",  name: "Riverside Coffee Co.", isHQ: true,
        address: "402 St-Laurent Blvd, Montréal, QC H2W 1S5", country: "Canada",
        notes: "Corporate office + flagship store." },
      { id: "s-coffee-pln", name: "Plateau Roastery", isHQ: false,
        address: "5640 Av du Parc, Montréal, QC H2V 4H1", country: "Canada",
        notes: "Higher tip volume on weekends." },
      { id: "s-coffee-old", name: "Old Port Kiosk", isHQ: false,
        address: "10 Rue de la Commune E, Montréal, QC H2Y 4B1", country: "Canada",
        notes: "Seasonal — closed Dec–Feb." },
    ],
    terminals: [
      { sn: "N950-0014-9281", model: "N950", storeId: "s-coffee-hq",  state: "active",   lastSeen: "5 min ago" },
      { sn: "N950-0014-9282", model: "N950", storeId: "s-coffee-hq",  state: "active",   lastSeen: "2 min ago" },
      { sn: "S90-0822-0014",  model: "S90",  storeId: "s-coffee-hq",  state: "active",   lastSeen: "12 min ago" },
      { sn: "N950-0014-9311", model: "N950", storeId: "s-coffee-pln", state: "active",   lastSeen: "1 min ago" },
      { sn: "N950-0014-9312", model: "N950", storeId: "s-coffee-pln", state: "active",   lastSeen: "8 min ago" },
      { sn: "S60-0488-0021",  model: "S60",  storeId: "s-coffee-pln", state: "active",   lastSeen: "3 days ago" },
      { sn: "N750-0099-0040", model: "N750", storeId: "s-coffee-old", state: "active",   lastSeen: "4 hours ago" },
      // Pending VarSheets — TIDs imported from the acquirer, awaiting on-site
      // bind with the 6-digit device code.
      { sn: null, model: null, storeId: "s-coffee-hq",  state: "pending", lastSeen: "—", tid: "T0099101" },
      { sn: null, model: null, storeId: "s-coffee-pln", state: "pending", lastSeen: "—", tid: "T0099102" },
      { sn: null, model: null, storeId: "s-coffee-pln", state: "pending", lastSeen: "—", tid: "T0099103" },
      { sn: null, model: null, storeId: "s-coffee-old", state: "pending", lastSeen: "—", tid: "T0099104" },
    ],
  },
  {
    id: "m-pharma", name: "Cedar Park Pharmacy", country: "Canada",
    tags: ["Healthcare", "Single-location"],
    notes: "",
    createdAt: "Mar 02, 2024",
    stores: [
      { id: "s-pharma-hq", name: "Cedar Park Pharmacy", isHQ: true,
        address: "1284 Whyte Ave NW, Edmonton, AB T6E 1Z2", country: "Canada",
        notes: "Open 7 days." },
    ],
    terminals: [
      { sn: "S90-0822-1102", model: "S90", storeId: "s-pharma-hq", state: "active", lastSeen: "1 min ago" },
      { sn: "S60-0488-0177", model: "S60", storeId: "s-pharma-hq", state: "active", lastSeen: "9 min ago" },
    ],
  },
  {
    id: "m-bistro", name: "Cascade Bistro Group", country: "Canada",
    tags: ["F&B", "Multi-location"],
    notes: "Three locations across BC. Tip-out reports needed monthly.",
    createdAt: "Sep 21, 2023",
    stores: [
      { id: "s-bistro-hq",  name: "Cascade Bistro Group", isHQ: true,
        address: "1490 Robson St, Vancouver, BC V6G 1B7", country: "Canada",
        notes: "Head office + Robson dining room." },
      { id: "s-bistro-pmt", name: "Port Moody Bistro", isHQ: false,
        address: "3107 St Johns St, Port Moody, BC V3H 2C5", country: "Canada", notes: "" },
    ],
    terminals: [
      { sn: "N950-0014-3322", model: "N950", storeId: "s-bistro-hq",  state: "active",  lastSeen: "just now" },
      { sn: "N950-0014-3323", model: "N950", storeId: "s-bistro-hq",  state: "active",  lastSeen: "7 min ago" },
      { sn: null,             model: null,  storeId: "s-bistro-hq",  state: "pending", lastSeen: "—", tid: "T0102201" },
      { sn: "N950-0014-3401", model: "N950", storeId: "s-bistro-pmt", state: "active",  lastSeen: "31 min ago" },
    ],
  },
  {
    id: "m-books", name: "Trillium Books", country: "Canada",
    tags: ["Retail"],
    notes: "Independent bookstore. Single till.",
    createdAt: "Apr 18, 2024",
    stores: [
      { id: "s-books-hq", name: "Trillium Books", isHQ: true,
        address: "92 Bloor St W, Toronto, ON M5S 1M2", country: "Canada", notes: "" },
    ],
    terminals: [
      { sn: "S60-0488-2299", model: "S60", storeId: "s-books-hq", state: "active", lastSeen: "22 min ago" },
    ],
  },
  {
    id: "m-glacier", name: "Glacier Grocers", country: "Canada",
    tags: ["Retail", "Multi-location", "Enterprise"],
    notes: "Large grocery chain across BC and Alberta. SLA 24h support.",
    createdAt: "Aug 04, 2023",
    stores: [
      { id: "s-glacier-hq",  name: "Glacier Grocers", isHQ: true,
        address: "100 W Pender St, Vancouver, BC V6B 1R8", country: "Canada", notes: "Head office." },
      { id: "s-glacier-bby", name: "Burnaby Mega",   isHQ: false, address: "4400 Hastings St, Burnaby, BC V5C 2K1",  country: "Canada", notes: "" },
      { id: "s-glacier-ric", name: "Richmond Pavilion", isHQ: false, address: "5300 No 3 Rd, Richmond, BC V6X 2X9", country: "Canada", notes: "" },
      { id: "s-glacier-cal", name: "Calgary Beltline", isHQ: false, address: "1234 17 Ave SW, Calgary, AB T2T 0C8",  country: "Canada", notes: "" },
      // Chain expansion — extra stores so the strip's filter + scroll
      // arrows have something to work against.
      { id: "s-glacier-van-com", name: "Vancouver Commercial Drive", isHQ: false, address: "1850 Commercial Dr, Vancouver, BC V5N 4A6", country: "Canada", notes: "" },
      { id: "s-glacier-van-kit", name: "Vancouver Kitsilano",        isHQ: false, address: "2150 W 4th Ave, Vancouver, BC V6K 1N6",   country: "Canada", notes: "" },
      { id: "s-glacier-van-dt",  name: "Vancouver Downtown",         isHQ: false, address: "555 Robson St, Vancouver, BC V6B 2B7",    country: "Canada", notes: "" },
      { id: "s-glacier-sur",     name: "Surrey Central",             isHQ: false, address: "10153 King George Blvd, Surrey, BC V3T 2W1", country: "Canada", notes: "" },
      { id: "s-glacier-coq",     name: "Coquitlam Centre",           isHQ: false, address: "2929 Barnet Hwy, Coquitlam, BC V3B 5R5",  country: "Canada", notes: "" },
      { id: "s-glacier-vic",     name: "Victoria Inner Harbour",     isHQ: false, address: "950 Government St, Victoria, BC V8W 1X1", country: "Canada", notes: "" },
      { id: "s-glacier-nan",     name: "Nanaimo Country Club",       isHQ: false, address: "3200 N Island Hwy, Nanaimo, BC V9T 1W1",  country: "Canada", notes: "" },
      { id: "s-glacier-kel",     name: "Kelowna Orchard Park",       isHQ: false, address: "2271 Harvey Ave, Kelowna, BC V1Y 6H2",    country: "Canada", notes: "" },
      { id: "s-glacier-cal-dt",  name: "Calgary Downtown",           isHQ: false, address: "317 7 Ave SW, Calgary, AB T2P 2Y9",       country: "Canada", notes: "" },
      { id: "s-glacier-cal-mr",  name: "Calgary Market Mall",        isHQ: false, address: "3625 Shaganappi Trail NW, Calgary, AB T3A 0E2", country: "Canada", notes: "" },
      { id: "s-glacier-cal-cf",  name: "Calgary Chinook",            isHQ: false, address: "6455 Macleod Trail SW, Calgary, AB T2H 0K8", country: "Canada", notes: "" },
      { id: "s-glacier-edm-dt",  name: "Edmonton Downtown",          isHQ: false, address: "10180 101 St NW, Edmonton, AB T5J 3S4",    country: "Canada", notes: "" },
      { id: "s-glacier-edm-wm",  name: "Edmonton West Mall",         isHQ: false, address: "8882 170 St NW, Edmonton, AB T5T 4M2",    country: "Canada", notes: "Open 24h." },
      { id: "s-glacier-edm-sg",  name: "Edmonton Southgate",         isHQ: false, address: "5015 111 St NW, Edmonton, AB T6H 4M6",    country: "Canada", notes: "" },
      { id: "s-glacier-leth",    name: "Lethbridge Park Place",      isHQ: false, address: "501 1 Ave S, Lethbridge, AB T1J 4L9",     country: "Canada", notes: "" },
      { id: "s-glacier-rd",      name: "Red Deer Bower Place",       isHQ: false, address: "4900 Molly Banister Dr, Red Deer, AB T4R 1N9", country: "Canada", notes: "" },
    ],
    terminals: [
      { sn: "N950-0014-5501", model: "N950", storeId: "s-glacier-hq",  state: "active", lastSeen: "1 min ago" },
      { sn: "N950-0014-5502", model: "N950", storeId: "s-glacier-hq",  state: "active", lastSeen: "1 min ago" },
      { sn: "N950-0014-5510", model: "N950", storeId: "s-glacier-bby", state: "active", lastSeen: "3 min ago" },
      { sn: "N950-0014-5511", model: "N950", storeId: "s-glacier-bby", state: "active", lastSeen: "2 min ago" },
      { sn: "S90-0822-5512",  model: "S90",  storeId: "s-glacier-bby", state: "active", lastSeen: "11 min ago" },
      { sn: "N950-0014-5520", model: "N950", storeId: "s-glacier-ric", state: "active", lastSeen: "5 min ago" },
      { sn: "N950-0014-5530", model: "N950", storeId: "s-glacier-cal", state: "active", lastSeen: "1 min ago" },
      { sn: "N950-0014-5531", model: "N950", storeId: "s-glacier-cal", state: "active", lastSeen: "1 min ago" },
    ],
  },
  {
    // Large-fleet merchant — added so the New Ticket picker has a
    // realistic "long candidate list" case to test the merchant /
    // store scope filters against.
    id: "m-northwind", name: "Northwind Logistics", country: "Canada",
    tags: ["Logistics", "Multi-location", "Enterprise"],
    notes: "Cross-border parcel-and-pallet operator. 20 terminals across 4 hubs.",
    createdAt: "Feb 02, 2024",
    stores: [
      { id: "s-nw-hq",   name: "Northwind Logistics HQ",     isHQ: true,
        address: "8830 Boundary Rd, Burnaby, BC V3N 4T7", country: "Canada",
        notes: "National operations center." },
      { id: "s-nw-yyz",  name: "Toronto Pearson Hub",        isHQ: false,
        address: "6300 Silver Dart Dr, Mississauga, ON L5P 1B2", country: "Canada", notes: "Air-side dispatch — 24/7." },
      { id: "s-nw-yul",  name: "Montréal-Trudeau Hub",       isHQ: false,
        address: "975 Roméo-Vachon N, Dorval, QC H4Y 1H1", country: "Canada", notes: "Bilingual ops." },
      { id: "s-nw-yyc",  name: "Calgary Cross-Dock",         isHQ: false,
        address: "300 Aero Crescent NE, Calgary, AB T2E 7T7", country: "Canada", notes: "" },
    ],
    terminals: [
      // HQ — 5 terminals (mix of models, one with a security flag for variety)
      { sn: "N950-0210-7001", model: "N950", storeId: "s-nw-hq",  state: "active", lastSeen: "2 min ago" },
      { sn: "N950-0210-7002", model: "N950", storeId: "s-nw-hq",  state: "active", lastSeen: "just now" },
      { sn: "S90-0822-7003",  model: "S90",  storeId: "s-nw-hq",  state: "active", lastSeen: "6 min ago" },
      { sn: "S90-0822-7004",  model: "S90",  storeId: "s-nw-hq",  state: "active", lastSeen: "18 min ago" },
      { sn: "X800-0210-7005", model: "X800", storeId: "s-nw-hq",  state: "active", lastSeen: "1 min ago" },
      // Pearson — 6 terminals
      { sn: "N950-0210-7101", model: "N950", storeId: "s-nw-yyz", state: "active", lastSeen: "1 min ago" },
      { sn: "N950-0210-7102", model: "N950", storeId: "s-nw-yyz", state: "active", lastSeen: "3 min ago" },
      { sn: "N950-0210-7103", model: "N950", storeId: "s-nw-yyz", state: "active", lastSeen: "14 min ago" },
      { sn: "S90-0822-7104",  model: "S90",  storeId: "s-nw-yyz", state: "active", lastSeen: "27 min ago" },
      { sn: "S60-0488-7105",  model: "S60",  storeId: "s-nw-yyz", state: "active", lastSeen: "2 hours ago" },
      { sn: "S60-0488-7106",  model: "S60",  storeId: "s-nw-yyz", state: "active", lastSeen: "5 min ago" },
      // Trudeau — 5 terminals
      { sn: "N950-0210-7201", model: "N950", storeId: "s-nw-yul", state: "active", lastSeen: "4 min ago" },
      { sn: "N950-0210-7202", model: "N950", storeId: "s-nw-yul", state: "active", lastSeen: "9 min ago" },
      { sn: "S90-0822-7203",  model: "S90",  storeId: "s-nw-yul", state: "active", lastSeen: "23 min ago" },
      { sn: "S60-0488-7204",  model: "S60",  storeId: "s-nw-yul", state: "active", lastSeen: "1 min ago" },
      { sn: "X800-0210-7205", model: "X800", storeId: "s-nw-yul", state: "active", lastSeen: "12 min ago" },
      // Calgary — 4 terminals
      { sn: "N950-0210-7301", model: "N950", storeId: "s-nw-yyc", state: "active", lastSeen: "just now" },
      { sn: "N950-0210-7302", model: "N950", storeId: "s-nw-yyc", state: "active", lastSeen: "7 min ago" },
      { sn: "S90-0822-7303",  model: "S90",  storeId: "s-nw-yyc", state: "active", lastSeen: "33 min ago" },
      { sn: "S60-0488-7304",  model: "S60",  storeId: "s-nw-yyc", state: "active", lastSeen: "4 hours ago" },
    ],
  },
];

// In-memory store. Mutated by handlers below; the screens consult it on
// every render via window.MERCHANTS. We intentionally use mutation +
// `setTick` re-render hook rather than a global setState — this keeps the
// data shape ergonomic for prototype code.
//
// On first load we also backfill timestamps onto every merchant / store /
// terminal so callers can always read createdAt + updatedAt without
// caring whether the record came from seed data or runtime creation.
function normaliseTimestamps(merchants) {
  // Stable per-id hash → readable 8-digit MID/TID for the VarSheet display
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff; return h; };
  const mid = (id) => "M" + String(8210_0000 + (hash(id) % 89999)).padStart(8, "0");
  const tid = (key) => "T" + String(101_0000   + (hash(key) % 8999_99)).padStart(8, "0");
  return merchants.map(m => {
    const mCreated = m.createdAt || "—";
    return {
      ...m,
      createdAt: mCreated,
      updatedAt: m.updatedAt || mCreated,
      mid: m.mid || mid(m.id),
      stores: (m.stores || []).map(s => ({
        ...s,
        createdAt: s.createdAt || mCreated,
        updatedAt: s.updatedAt || s.createdAt || mCreated,
      })),
      terminals: (m.terminals || []).map((t, i) => ({
        ...t,
        createdAt: t.createdAt || mCreated,
        updatedAt: t.updatedAt || t.createdAt || mCreated,
        tid: t.tid || tid(t.sn || `${m.id}:${i}`),
      })),
    };
  });
}

window.MERCHANTS = window.MERCHANTS || normaliseTimestamps(MERCHANTS_SEED);

// Trigger a re-render of merchant screens after a mutation.
let _mTick = 0;
const mListeners = new Set();
function bumpMerchants() {
  _mTick++;
  mListeners.forEach(fn => fn(_mTick));
}
function useMerchantTick() {
  const [, set] = useStateM(0);
  useEffectM(() => {
    mListeners.add(set);
    return () => mListeners.delete(set);
  }, []);
  return _mTick;
}

// Helpers
function effectiveStores(merchant) {
  // Hide the headquarter row when it's the ONLY store. Terminals owned by
  // a hidden HQ surface directly under the merchant in the terminals table.
  if ((merchant.stores || []).length <= 1) return [];
  return merchant.stores;
}
function storeOf(merchant, storeId) {
  return (merchant.stores || []).find(s => s.id === storeId) || null;
}
function findMerchantById(id) {
  return (window.MERCHANTS || []).find(m => m.id === id) || null;
}

// ─── List screen ────────────────────────────────────────────
function MerchantsListScreen({ navigate, openNewMerchant }) {
  useMerchantTick();
  const all = window.MERCHANTS || [];
  const [q, setQ] = useStateM("");
  const [country, setCountry] = useStateM("any");

  const filtered = useMemoM(() => {
    return all.filter(m => {
      if (country !== "any" && m.country !== country) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!(m.name.toLowerCase().includes(needle)
              || (m.tags || []).some(t => t.toLowerCase().includes(needle))
              || (m.stores || []).some(s => s.name.toLowerCase().includes(needle)))) return false;
      }
      return true;
    });
  }, [all, q, country]);

  const totals = useMemoM(() => ({
    merchants: all.length,
    stores: all.reduce((acc, m) => acc + (m.stores?.length || 0), 0),
    terminals: all.reduce((acc, m) => acc + (m.terminals?.length || 0), 0),
    installed: all.reduce((acc, m) => acc + (m.terminals || []).filter(t => t.state === "active").length, 0),
  }), [all]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <window.PageHeader
        title="Merchants"
        subtitle="Maintain merchant accounts, their stores, and the terminals attached to each store."
        actions={
          <window.Button primary icon="plus" onClick={openNewMerchant}>New merchant</window.Button>
        } />

      <div style={{ flex: 1, overflow: "auto", background: "var(--color-bg-1)" }}>
        {/* KPI strip */}
        <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Merchants",        value: totals.merchants,  sub: "registered" },
              { label: "Stores",           value: totals.stores,     sub: "across all merchants" },
              { label: "Terminals",        value: totals.terminals,  sub: "bound to a store" },
              { label: "Installed terminals", value: totals.installed, sub: "装机完成",          tone: "success" },
            ].map(k => (
              <div key={k.label} style={{
                padding: "12px 16px", borderRadius: "var(--radius-lg)",
                background: "var(--bg2)",
                border: "1px solid var(--border-1)",
                boxShadow: "var(--shadow-1)",
              }}>
                <div className="overline" style={{ fontSize: 10.5 }}>{k.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span className="mono num" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em",
                    color: k.tone === "success" ? "var(--success)" : "var(--fg1)" }}>{k.value}</span>
                  <span style={{ fontSize: 11, color: "var(--fg3)" }}>{k.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--space-3) var(--space-6)", flexWrap: "wrap" }}>
          <window.Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search merchants, stores, tags…"
            prefix={<window.Ico name="search" size={12} />}
            style={{ flex: 1, minWidth: 220, maxWidth: 360 }} />
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{
            padding: "7px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-default)", fontSize: 12,
            fontFamily: "inherit",
            background: "var(--bg2)", color: "var(--fg1)",
          }}>
            <option value="any">All countries</option>
            {[...new Set(all.map(m => m.country))].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg3)" }}>
            {filtered.length} of {all.length} merchants
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
                    {["Merchant", "Country", "Stores", "Terminals", "Tags", ""].map((h, i) => (
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
                    <tr><td colSpan={6} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)" }}>
                      {all.length === 0
                        ? "No merchants yet. Click \u201CNew merchant\u201D above to create one."
                        : "No merchants match those filters."}
                    </td></tr>
                  )}
                  {filtered.map(m => {
                    const storeCount = m.stores?.length || 0;
                    const storeLabel = storeCount <= 1
                      ? <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>Headquarter only</span>
                      : <span className="mono num" style={{ fontWeight: 500 }}>{storeCount}</span>;
                    return (
                      <tr key={m.id}
                        onClick={() => navigate({ screen: "merchantDetail", merchantId: m.id })}
                        style={{ cursor: "pointer", borderBottom: "1px solid var(--border-1)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <MerchantAvatar name={m.name} size={28} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                              <div className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{m.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "var(--fg2)" }}>{m.country}</td>
                        <td style={{ padding: "12px 14px" }}>{storeLabel}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="mono num" style={{ fontWeight: 500 }}>{m.terminals?.length || 0}</span>
                          {(m.terminals || []).filter(t => t.state === "active").length !== (m.terminals?.length || 0) && (
                            <span style={{ fontSize: 11, color: "var(--fg3)", marginLeft: 6 }}>
                              ({(m.terminals || []).filter(t => t.state === "active").length} installed)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(m.tags || []).slice(0, 3).map(t => <TagChip key={t} t={t} />)}
                            {(m.tags || []).length > 3 && (
                              <span style={{ fontSize: 11, color: "var(--fg3)", padding: "2px 4px" }}>
                                +{(m.tags || []).length - 3}
                              </span>
                            )}
                          </div>
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

// ─── Merchant detail ────────────────────────────────────────
// Tabs are gone. The page is a single Stores-and-Terminals view: stores
// across the top as a horizontal card row, the selected store's terminals
// (with VarSheet MID/TID + SN + Model) below. Merchant metadata moves into
// the Edit drawer — nobody opens "Overview" to read it.
function MerchantDetailScreen({ merchant, route, navigate }) {
  useMerchantTick();
  const [editMerchantOpen, setEditMerchantOpen] = useStateM(false);
  const [storeFormOpen, setStoreFormOpen] = useStateM(null);
  const [terminalFormOpen, setTerminalFormOpen] = useStateM(null);
  const [installOpen, setInstallOpen] = useStateM(null);   // terminal | null
  const [unbindOpen, setUnbindOpen] = useStateM(null);     // terminal | null
  const [deletePendingOpen, setDeletePendingOpen] = useStateM(null); // terminal | null
  const [confirmDeleteStore, setConfirmDeleteStore] = useStateM(null);

  const stores = merchant.stores || [];
  // Default selection: route hint → first store → HQ.
  const initialStoreId = route.storeId || stores[0]?.id;
  const [selectedStoreId, setSelectedStoreId] = useStateM(initialStoreId);
  useEffectM(() => { setSelectedStoreId(route.storeId || stores[0]?.id); }, [merchant.id]);

  const selectedStore = stores.find(s => s.id === selectedStoreId) || stores[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--color-bg-2)", borderBottom: "1px solid var(--color-border-subtle)",
        padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button onClick={() => navigate({ screen: "merchants" })} style={{ color: "var(--fg3)", padding: 4 }} title="Back">
            <window.Ico name="chevl" size={16} />
          </button>
          <MerchantAvatar name={merchant.name} size={44} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{merchant.name}</h1>
              <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>·</span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{merchant.mid}</span>
              <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>·</span>
              <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{merchant.country}</span>
            </div>
            {merchant.tags?.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {merchant.tags.map(t => <TagChip key={t} t={t} />)}
              </div>
            )}
          </div>
          <window.Button icon="edit" onClick={() => setEditMerchantOpen(true)}>Edit merchant</window.Button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", background: "var(--color-bg-1)" }}>
        <StoresWithTerminalsView
          merchant={merchant}
          stores={stores}
          selectedStore={selectedStore}
          onSelectStore={(id) => setSelectedStoreId(id)}
          onAddStore={() => setStoreFormOpen({ mode: "new" })}
          onEditStore={(s) => setStoreFormOpen({ mode: "edit", store: s })}
          onDeleteStore={(s) => setConfirmDeleteStore(s)}
          onBindTerminal={(storeId) => setTerminalFormOpen({ mode: "new", defaultStoreId: storeId })}
          onEditTerminal={(t) => setTerminalFormOpen({ mode: "edit", terminal: t })}
          onInstallTerminal={(t) => setInstallOpen(t)}
          onUnbindTerminal={(t) => setUnbindOpen(t)}
          onDeletePendingTerminal={(t) => setDeletePendingOpen(t)} />
      </div>

      {/* Edit merchant drawer */}
      {editMerchantOpen && (
        <MerchantFormModal
          mode="edit"
          merchant={merchant}
          onClose={() => setEditMerchantOpen(false)}
          onSave={(patch) => {
            Object.assign(merchant, patch, { updatedAt: "just now" });
            bumpMerchants();
            setEditMerchantOpen(false);
            window.showToast?.(`${merchant.name} updated`, "success");
          }} />
      )}

      {/* New / edit store modal */}
      {storeFormOpen && (
        <StoreFormModal
          mode={storeFormOpen.mode}
          merchant={merchant}
          store={storeFormOpen.store}
          onClose={() => setStoreFormOpen(null)}
          onDelete={(s) => { setStoreFormOpen(null); setConfirmDeleteStore(s); }}
          onSave={(payload) => {
            const now = "just now";
            if (storeFormOpen.mode === "new") {
              const newStore = {
                id: `s-${merchant.id.replace(/^m-/, "")}-${Date.now().toString(36)}`,
                isHQ: false,
                createdAt: now, updatedAt: now,
                ...payload,
              };
              merchant.stores = [...(merchant.stores || []), newStore];
              merchant.updatedAt = now;
              setSelectedStoreId(newStore.id);
              window.showToast?.(`Store "${newStore.name}" added`, "success");
            } else {
              Object.assign(storeFormOpen.store, payload, { updatedAt: now });
              merchant.updatedAt = now;
              window.showToast?.(`Store "${payload.name}" updated`, "success");
            }
            bumpMerchants();
            setStoreFormOpen(null);
          }} />
      )}

      {/* New / edit terminal (VarSheet) modal */}
      {terminalFormOpen && (
        <TerminalFormModal
          mode={terminalFormOpen.mode}
          merchant={merchant}
          stores={stores}
          terminal={terminalFormOpen.terminal}
          defaultStoreId={terminalFormOpen.defaultStoreId}
          onClose={() => setTerminalFormOpen(null)}
          onDelete={(t) => {
            setTerminalFormOpen(null);
            const isPending = t.state === "pending" && !t.sn;
            if (isPending) setDeletePendingOpen(t); else setUnbindOpen(t);
          }}
          onSave={(payload) => {
            const now = "just now";
            // Bulk import path — payload is { __bulk: [rows] }. Each valid
            // row becomes its own pending VarSheet.
            if (payload && payload.__bulk) {
              const hq = stores.find(s => s.isHQ);
              const created = payload.__bulk.map((r, i) => {
                const fallbackTid = "T" + String(1010000 + Math.floor(Math.random() * 8999999) + i).padStart(8, "0");
                return {
                  sn: null, model: null,
                  state: "pending", lastSeen: "—",
                  createdAt: now, updatedAt: now,
                  tid: fallbackTid,
                  storeId: r.storeId || hq?.id || stores[0]?.id,
                  address: r.address,
                  mcc: r.mcc,
                  currency: r.currency,
                  cardSchemes: (r.schemes || "").split(",").map(s => s.trim()).filter(Boolean),
                };
              });
              merchant.terminals = [...(merchant.terminals || []), ...created];
              merchant.updatedAt = now;
              bumpMerchants();
              window.showToast?.(`${created.length} VarSheet${created.length === 1 ? "" : "s"} imported · all pending installation`, "success");
              setTerminalFormOpen(null);
              return;
            }
            if (terminalFormOpen.mode === "new") {
              // Pending VarSheet — no SN/model yet. tid is auto-assigned by
              // normaliseTimestamps on read, but since we're mutating in
              // place we generate one here too so the UI shows it immediately.
              const fallbackTid = "T" + String(1010000 + Math.floor(Math.random() * 8999999)).padStart(8, "0");
              const newT = {
                sn: null, model: null,
                state: "pending", lastSeen: "—",
                createdAt: now, updatedAt: now,
                // Map the acquirer-supplied identifiers onto the terminal
                // record's tid + dedicated *Acq fields. The system-level
                // merchant.mid stays the system identifier; midAcq is the
                // acquirer's MID for this VarSheet.
                tid:              payload.tid?.trim() || fallbackTid,
                tidAcq:           payload.tid?.trim() || fallbackTid,
                midAcq:           payload.mid?.trim() || "",
                merchantNameAcq:  payload.merchantNameAcq?.trim() || "",
                ...payload,
              };
              // Avoid double-overwriting tid from the ...payload spread.
              newT.tid = newT.tid;
              merchant.terminals = [...(merchant.terminals || []), newT];
              merchant.updatedAt = now;
              window.showToast?.(`VarSheet ${newT.tid} created · pending installation`, "success");
            } else {
              Object.assign(terminalFormOpen.terminal, payload, { updatedAt: now });
              merchant.updatedAt = now;
              window.showToast?.(`VarSheet ${terminalFormOpen.terminal.tid} updated`, "success");
            }
            bumpMerchants();
            setTerminalFormOpen(null);
          }} />
      )}

      {/* Install device modal */}
      {installOpen && (
        <InstallTerminalModal
          merchant={merchant}
          terminal={installOpen}
          onClose={() => setInstallOpen(null)}
          onConfirm={(resolved) => {
            const now = "just now";
            Object.assign(installOpen, {
              sn: resolved.sn, model: resolved.model,
              state: "active", lastSeen: "just now",
              updatedAt: now,
            });
            merchant.updatedAt = now;
            window.showToast?.(`${resolved.sn} installed · VarSheet ${installOpen.tid} now installed`, "success");
            bumpMerchants();
            setInstallOpen(null);
          }} />
      )}

      {/* Unbind device modal (for bound terminals) */}
      {unbindOpen && (
        <UnbindTerminalModal
          merchant={merchant}
          terminal={unbindOpen}
          onClose={() => setUnbindOpen(null)}
          onConfirm={() => {
            const now = "just now";
            // Clear device binding but keep the VarSheet record.
            Object.assign(unbindOpen, {
              sn: null, model: null,
              state: "pending", lastSeen: "—",
              updatedAt: now,
            });
            merchant.updatedAt = now;
            window.showToast?.(`Device unbound from VarSheet ${unbindOpen.tid} · awaiting reinstall`, "warning");
            bumpMerchants();
            setUnbindOpen(null);
          }} />
      )}

      {/* Delete pending VarSheet confirmation */}
      <window.ConfirmDialog
        open={!!deletePendingOpen}
        onClose={() => setDeletePendingOpen(null)}
        title={deletePendingOpen ? `Delete VarSheet ${deletePendingOpen.tid}?` : "Delete VarSheet?"}
        body={<>
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 10 }}>
            This removes the pending registration permanently. The Terminal No. will not be reusable.
          </div>
          {deletePendingOpen && (
            <div style={{
              padding: "10px 12px",
              background: "var(--bg2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", rowGap: 5, columnGap: 12,
            }}>
              <KvLabel>Merchant No.</KvLabel>
              <KvValue><span className="mono" style={{ fontSize: 12 }}>{merchant.mid}</span></KvValue>
              <KvLabel>Terminal No.</KvLabel>
              <KvValue><span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{deletePendingOpen.tid}</span></KvValue>
            </div>
          )}
        </>}
        confirmLabel="Delete VarSheet"
        tone="danger"
        icon="trash"
        onConfirm={() => {
          merchant.terminals = (merchant.terminals || []).filter(t => t.tid !== deletePendingOpen.tid);
          window.showToast?.(`VarSheet ${deletePendingOpen.tid} deleted`, "warning");
          bumpMerchants();
          setDeletePendingOpen(null);
        }} />

      <window.ConfirmDialog
        open={!!confirmDeleteStore}
        onClose={() => setConfirmDeleteStore(null)}
        title={confirmDeleteStore ? `Remove "${confirmDeleteStore.name}"?` : "Remove store?"}
        body={confirmDeleteStore
          ? <>
              {(merchant.terminals || []).some(t => t.storeId === confirmDeleteStore.id) ? (
                <div style={{ padding: "10px 12px", background: "var(--error-bg)",
                  border: "1px solid color-mix(in oklab, var(--color-error-500) 25%, transparent)",
                  borderRadius: "var(--radius-md)", color: "var(--color-error-700)",
                  fontSize: 12.5, lineHeight: 1.55 }}>
                  This store still has <b>{(merchant.terminals || []).filter(t => t.storeId === confirmDeleteStore.id).length}</b> terminal(s) bound to it. Move or unbind them before removing the store.
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                  The store record will be deleted.
                </div>
              )}
            </>
          : null}
        confirmLabel="Remove store"
        tone="danger"
        icon="trash"
        onConfirm={() => {
          const blocked = (merchant.terminals || []).some(t => t.storeId === confirmDeleteStore.id);
          if (blocked) { setConfirmDeleteStore(null); return; }
          merchant.stores = (merchant.stores || []).filter(s => s.id !== confirmDeleteStore.id);
          if (selectedStoreId === confirmDeleteStore.id) {
            setSelectedStoreId(merchant.stores[0]?.id);
          }
          window.showToast?.(`Store "${confirmDeleteStore.name}" removed`, "warning");
          bumpMerchants();
          setConfirmDeleteStore(null);
        }} />
    </div>
  );
}

// ─── Stores row + selected-store terminals ────────────────
// The whole merchant-detail body is this one component. Horizontal store
// cards on top, selected store's detail + terminals below. "Add store"
// lives as the trailing card; "Bind terminal" lives on the selected-store
// header — there is no merchant-level bind, since terminals must always
// land in a specific store.
function StoresWithTerminalsView({ merchant, stores, selectedStore, onSelectStore,
                                   onAddStore, onEditStore, onDeleteStore,
                                   onBindTerminal, onEditTerminal, onInstallTerminal,
                                   onUnbindTerminal, onDeletePendingTerminal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Stores strip — always horizontal scroll, with search + arrows for big chains */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span className="overline" style={{ fontSize: 10.5 }}>Stores · <span className="mono num">{stores.length}</span></span>
          <span style={{ fontSize: 11, color: "var(--fg3)" }}>Click a card to view its terminals.</span>
        </div>
        <StoreCardStrip
          merchant={merchant}
          stores={stores}
          selectedStore={selectedStore}
          onSelectStore={onSelectStore}
          onAddStore={onAddStore} />
      </div>

      {selectedStore && (
        <SelectedStoreHeader
          merchant={merchant}
          store={selectedStore}
          onEdit={() => onEditStore(selectedStore)}
          onDelete={() => onDeleteStore(selectedStore)} />
      )}

      {selectedStore && (
        <SelectedStoreTerminals
          merchant={merchant}
          store={selectedStore}
          onBind={() => onBindTerminal(selectedStore.id)}
          onEdit={onEditTerminal}
          onInstall={onInstallTerminal}
          onUnbind={onUnbindTerminal}
          onDeletePending={onDeletePendingTerminal} />
      )}
    </div>
  );
}

// ─── Store card strip ─────────────────────────────────────
// Horizontally scrolling chip strip — always the same layout, regardless
// of count. For large chains (>6 stores) we show a filter input + a
// "scroll left / right" pair so 20+ stores are still navigable without
// dragging the scrollbar by hand.
function StoreCardStrip({ merchant, stores, selectedStore, onSelectStore, onAddStore }) {
  const [query, setQuery] = useStateM("");
  const scrollRef = useRefM(null);
  const [canL, setCanL] = useStateM(false);
  const [canR, setCanR] = useStateM(false);

  const filtered = useMemoM(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.address || "").toLowerCase().includes(q)
    );
  }, [stores, query]);

  const updateOverflow = () => {
    const el = scrollRef.current; if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffectM(() => {
    updateOverflow();
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => updateOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [filtered.length]);

  // Keep the selected card in view when the merchant switches.
  useEffectM(() => {
    const el = scrollRef.current; if (!el || !selectedStore) return;
    const node = el.querySelector(`[data-store-id="${selectedStore.id}"]`);
    if (node && typeof node.scrollIntoView === "function") {
      // Only nudge horizontally — never the whole page.
      const elRect = el.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      if (nodeRect.left < elRect.left || nodeRect.right > elRect.right) {
        el.scrollTo({
          left: node.offsetLeft - el.clientWidth / 2 + node.offsetWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [selectedStore?.id]);

  const showTools = stores.length > 6;
  const nudge = (dir) => {
    const el = scrollRef.current; if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 240), behavior: "smooth" });
  };

  const arrowStyle = (enabled) => ({
    width: 28, height: 28, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg2)", border: "1px solid var(--border-1)",
    borderRadius: "var(--radius-sm)",
    color: enabled ? "var(--fg1)" : "var(--fg3)",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.45,
    transition: "background var(--duration-fast) var(--easing-standard)",
  });

  return (
    <div>
      {showTools && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            flex: "0 1 320px", minWidth: 200,
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px",
            background: "var(--bg2)", border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
          }}>
            <window.Ico name="search" size={13} style={{ color: "var(--fg3)", flexShrink: 0 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or address…"
              style={{
                flex: 1, minWidth: 0,
                border: 0, outline: "none", background: "transparent",
                fontSize: 12.5, color: "var(--fg1)",
              }} />
            {query && (
              <button type="button" onClick={() => setQuery("")} title="Clear"
                style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer",
                  color: "var(--fg3)", display: "inline-flex", alignItems: "center" }}>
                <window.Ico name="x" size={12} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--fg3)", whiteSpace: "nowrap" }}>
            <span className="mono num" style={{ fontWeight: 500, color: "var(--fg2)" }}>{filtered.length}</span>
            <span style={{ margin: "0 4px" }}>of</span>
            <span className="mono num">{stores.length}</span>
          </span>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button type="button" onClick={() => nudge(-1)} disabled={!canL}
              title="Scroll left" style={arrowStyle(canL)}>
              <window.Ico name="chevl" size={14} />
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={!canR}
              title="Scroll right" style={arrowStyle(canR)}>
              <window.Ico name="chevr" size={14} />
            </button>
          </div>
          <window.Button size="sm" icon="plus" onClick={onAddStore}>Add store</window.Button>
        </div>
      )}

      <div ref={scrollRef} style={{
        display: "flex", gap: 10, overflowX: "auto",
        padding: "4px 2px 6px",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "14px 16px", fontSize: 12, color: "var(--fg3)",
            border: "1px dashed var(--border-1)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            No stores match "{query}".
            <button type="button" onClick={() => setQuery("")} style={{
              color: "var(--color-primary-700)", textDecoration: "underline",
              background: "transparent", border: 0, cursor: "pointer", padding: 0,
              fontSize: 12,
            }}>Clear filter</button>
          </div>
        ) : (
          filtered.map(s => {
            const tCount = (merchant.terminals || []).filter(t => t.storeId === s.id).length;
            const on = selectedStore?.id === s.id;
            return (
              <button key={s.id} data-store-id={s.id}
                onClick={() => onSelectStore(s.id)} style={{
                  flexShrink: 0,
                  minWidth: 180, maxWidth: 220,
                  padding: "12px 14px", textAlign: "left",
                  background: on ? "var(--color-primary-50)" : "var(--bg2)",
                  border: "1px solid",
                  borderColor: on ? "var(--color-primary-500)" : "var(--border-1)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: on ? "0 0 0 3px oklch(40% 0.14 262 / 0.10)" : "var(--shadow-1)",
                  cursor: "pointer",
                  transition: "background var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard)",
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span title={s.name} style={{
                    fontSize: 13, fontWeight: 500, lineHeight: 1.35,
                    color: on ? "var(--color-primary-700)" : "var(--fg1)",
                    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                    overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word",
                  }}>{s.name}</span>
                  {s.isHQ && (
                    <span style={{
                      fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                      background: on ? "var(--bg2)" : "var(--color-primary-50)",
                      color: "var(--color-primary-700)",
                      fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.04em",
                      flexShrink: 0, marginTop: 2,
                    }}>HQ</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: on ? "var(--color-primary-700)" : "var(--fg3)" }}>
                  <span className="mono num" style={{ fontWeight: 500 }}>{tCount}</span> terminal{tCount === 1 ? "" : "s"}
                </div>
              </button>
            );
          })
        )}
        {/* Trailing Add card — only when the toolbar isn't already offering it */}
        {!showTools && (
          <button onClick={onAddStore} style={{
          flexShrink: 0, minWidth: 140,
          padding: "12px 14px", textAlign: "center",
          background: "var(--bg2)",
          border: "1.5px dashed var(--color-border-default)",
          borderRadius: "var(--radius-lg)",
          color: "var(--fg2)",
          cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary-500)";
          e.currentTarget.style.background = "var(--color-primary-50)";
          e.currentTarget.style.color = "var(--color-primary-700)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-default)";
          e.currentTarget.style.background = "var(--bg2)";
          e.currentTarget.style.color = "var(--fg2)";
        }}>
          <window.Ico name="plus" size={16} stroke={1.8} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Add store</span>
        </button>
        )}
      </div>
    </div>
  );
}


// ─── Slim header for the selected store ───────────────────
// Just the name + a "View / Edit / Remove" menu. The full address / notes /
// created/updated are tucked behind a popover so they don't dominate the
// page — the page's purpose is the terminals table below.
function SelectedStoreHeader({ merchant, store, onEdit, onDelete }) {
  const [detailsOpen, setDetailsOpen] = useStateM(false);
  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px",
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
      }}>
        <window.Ico name="store" size={13} style={{ color: "var(--fg3)", flexShrink: 0 }} />
        <span title={store.address || undefined} style={{ fontSize: 12.5, color: "var(--fg2)", minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {store.address || <span style={{ color: "var(--fg3)" }}>No address on file</span>}
        </span>
        {store.address && (
          <button
            type="button"
            title="Copy address"
            aria-label="Copy address"
            onClick={() => {
              const text = `${store.address}${store.country ? `, ${store.country}` : ""}`;
              const done = () => window.showToast?.("Address copied to clipboard", "success");
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(() => {
                  window.showToast?.("Couldn't copy — check browser permissions", "warning");
                });
              } else {
                // Fallback for environments without the async clipboard API.
                const ta = document.createElement("textarea");
                ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
                document.body.appendChild(ta); ta.select();
                try { document.execCommand("copy"); done(); } catch (_) {}
                document.body.removeChild(ta);
              }
            }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, padding: 0, flexShrink: 0,
              background: "transparent", border: 0, borderRadius: "var(--radius-sm)",
              color: "var(--fg3)", cursor: "pointer",
              transition: "background var(--duration-fast) var(--easing-standard), color var(--duration-fast) var(--easing-standard)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--fg1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg3)"; }}>
            <window.Ico name="copy" size={12} />
          </button>
        )}
        <span style={{ fontSize: 11.5, color: "var(--fg3)", whiteSpace: "nowrap" }}>· {store.country}</span>
        <div style={{ flex: 1 }} />
        <window.Button size="sm" ghost icon="info" onClick={() => setDetailsOpen(true)}>Details</window.Button>
        <window.Button size="sm" ghost icon="edit" onClick={onEdit}>Edit</window.Button>
        {!store.isHQ && (
          <window.Button size="sm" ghost icon="trash" onClick={onDelete} />
        )}
      </div>

      <window.Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} width={480}
        title={store.name}
        subtitle={store.isHQ ? "Headquarter — auto-created with the merchant." : "Store details"}
        footer={<window.Button onClick={() => setDetailsOpen(false)}>Close</window.Button>}>
        <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", rowGap: 8, columnGap: 14 }}>
          <KvLabel>Address</KvLabel>
          <KvValue>{store.address || <span style={{ color: "var(--fg3)" }}>—</span>}</KvValue>
          <KvLabel>Country</KvLabel><KvValue>{store.country}</KvValue>
          {store.notes && <>
            <KvLabel>Notes</KvLabel><KvValue><span style={{ whiteSpace: "pre-wrap" }}>{store.notes}</span></KvValue>
          </>}
          <KvLabel>Created</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 11.5, color: "var(--fg3)" }}>{store.createdAt}</span></KvValue>
          {store.updatedAt && store.updatedAt !== store.createdAt && (
            <>
              <KvLabel>Updated</KvLabel>
              <KvValue><span className="mono" style={{ fontSize: 11.5, color: "var(--fg3)" }}>{store.updatedAt}</span></KvValue>
            </>
          )}
        </div>
      </window.Modal>
    </>
  );
}

function SelectedStoreTerminals({ merchant, store, onBind, onEdit, onInstall, onUnbind, onDeletePending }) {
  const terminals = (merchant.terminals || []).filter(t => t.storeId === store.id);
  return (
    <window.Card title={
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Payment terminals</span>
        <span className="mono num" style={{
          fontSize: 10.5, padding: "1px 7px", borderRadius: 999,
          background: "var(--bg3)", color: "var(--fg3)", fontWeight: 500,
          border: "1px solid var(--border-1)",
        }}>{terminals.length}</span>
      </div>
    } hint={<>Pending rows aren't bound to a physical device yet — use <b>Bind</b> to enter the 6-digit code on the device screen.</>}
      action={
        <window.Button primary size="sm" icon="plus" onClick={onBind}>Add terminal</window.Button>
      }
      padding={0}>
      {terminals.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <window.Empty icon="device"
            title="No terminals bound here yet"
            body={<>Click <b>Add terminal</b> above to register a VarSheet for <b>{store.name}</b>.</>} />
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg3)", textAlign: "left" }}>
                {["Merchant No.", "Terminal No.", "Serial number", "Model", "Status", "Last seen", ""].map((h, i) => (
                  <th key={i} className="overline" style={{
                    padding: "10px 14px", fontSize: 10.5,
                    borderBottom: "1px solid var(--border-1)", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {terminals.map(t => {
                const isPending = t.state === "pending" && !t.sn;
                const tone = isPending ? "warning"
                          : t.state === "active" ? "success"
                                                  : "neutral";
                // Only two display states: Installed (has SN, ever installed)
                // and Not installed (pending VarSheet — no SN yet).
                const statusLabel = isPending ? "Not installed" : "Installed";
                return (
                  <tr key={t.tid} style={{ borderBottom: "1px solid var(--border-1)",
                    background: isPending ? "var(--warning-bg)" : "transparent" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{merchant.mid}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{t.tid}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {t.sn
                        ? <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{t.sn}</span>
                        : <span style={{ fontSize: 11.5, color: "var(--color-warning-700)", fontStyle: "italic" }}>not installed</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {t.model
                        ? <span className="mono" style={{ fontSize: 12, color: "var(--fg2)" }}>{t.model}</span>
                        : <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <window.Pill tone={tone} dot size="sm">{statusLabel}</window.Pill>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 11.5, color: "var(--fg2)" }}>
                      <span className="mono">{t.lastSeen || "—"}</span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {isPending ? (
                        <>
                          <window.Button size="sm" primary icon="link" onClick={() => onInstall(t)}>Bind</window.Button>
                          <window.Button size="sm" ghost icon="edit" onClick={() => onEdit(t)}>Edit</window.Button>
                          <window.Button size="sm" ghost icon="trash" onClick={() => onDeletePending(t)} />
                        </>
                      ) : (
                        <>
                          <window.Button size="sm" ghost icon="edit" onClick={() => onEdit(t)}>Edit</window.Button>
                          <window.Button size="sm" ghost icon="link" onClick={() => onUnbind(t)}>Unbind</window.Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </window.Card>
  );
}

// ─── Legacy tab components (no longer mounted) ─────────────
// The Overview / Stores / Terminals tabs were merged into the new
// StoresWithTerminalsView above. We deliberately leave the helpers for
// store and tag chips below; the dead tab functions used to live here.
// ─── Forms ─────────────────────────────────────────────────
function MerchantFormModal({ mode, merchant, onClose, onSave }) {
  const isEdit = mode === "edit" && !!merchant;
  const [name, setName] = useStateM(merchant?.name || "");
  const [country, setCountry] = useStateM(merchant?.country || COUNTRIES[0]);
  const [tags, setTags] = useStateM(merchant?.tags || []);
  const [tagInput, setTagInput] = useStateM("");
  const [notes, setNotes] = useStateM(merchant?.notes || "");

  const canSave = name.trim().length > 1 && tags.length <= 5;

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (tags.includes(v)) { setTagInput(""); return; }
    if (tags.length >= 5) return;
    setTags([...tags, v]);
    setTagInput("");
  };

  return (
    <window.Modal open onClose={onClose} width={560}
      title={isEdit ? `Edit ${merchant.name}` : "New merchant"}
      subtitle={isEdit
        ? "Update the merchant's account information. A default headquarter store was created on registration; manage stores under the Stores tab."
        : "Register a new merchant. A default headquarter store will be created automatically — you can break it out as its own row later by adding a second store."}
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary disabled={!canSave} icon={isEdit ? "check" : "plus"}
            onClick={() => onSave({ name: name.trim(), country, tags, notes })}>
            {isEdit ? "Save changes" : "Create merchant"}
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <window.Field label="Merchant name" required
          hint={<span><span className="mono">{name.length}</span> / 80 characters</span>}>
          <window.Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="e.g. Riverside Coffee Co." />
        </window.Field>
        <window.Field label="Country / region" required>
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{
            width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-default)", fontSize: 13,
            fontFamily: "inherit", background: "var(--bg2)", color: "var(--fg1)",
          }}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </window.Field>
        <window.Field label="Tags"
          hint={<span><span className="mono">{tags.length}</span> / 5 — optional. Press Enter to add.</span>}>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 4,
            padding: "6px 8px",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg2)",
            minHeight: 36, alignItems: "center",
          }}>
            {tags.map(t => (
              <span key={t} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 4px 2px 8px", borderRadius: 999,
                background: "var(--color-primary-50)",
                color: "var(--color-primary-700)",
                fontSize: 11.5, fontWeight: 500,
              }}>
                {t}
                <button onClick={() => setTags(tags.filter(x => x !== t))}
                  style={{ padding: 2, color: "var(--color-primary-700)" }} title="Remove">
                  <window.Ico name="x" size={10} stroke={2.5} />
                </button>
              </span>
            ))}
            {tags.length < 5 && (
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === "Backspace" && !tagInput && tags.length > 0) setTags(tags.slice(0, -1)); }}
                placeholder={tags.length === 0 ? "Add a tag and press Enter" : "Add another…"}
                style={{
                  flex: 1, minWidth: 120, border: 0, outline: "none",
                  background: "transparent", fontSize: 12.5,
                  color: "var(--fg1)",
                  fontFamily: "inherit",
                }} />
            )}
          </div>
        </window.Field>
        <window.Field label="Notes">
          <window.Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Optional — primary contact, SLA, special arrangements, etc." />
        </window.Field>
      </div>
    </window.Modal>
  );
}

function StoreFormModal({ mode, merchant, store, onClose, onSave, onDelete }) {
  const isEdit = mode === "edit" && !!store;
  const isHQ = store?.isHQ;
  // The HQ store's name defaults to (and stays in sync with) the merchant name
  // when it hasn't been customized.
  const [name, setName] = useStateM(store?.name || (isHQ ? merchant.name : ""));
  const [address, setAddress] = useStateM(store?.address || "");
  const [country, setCountry] = useStateM(store?.country || merchant.country);
  const [notes, setNotes] = useStateM(store?.notes || "");

  const canSave = name.trim().length > 1;

  return (
    <window.Modal open onClose={onClose} width={560}
      title={isEdit
        ? (isHQ ? `Edit headquarter` : `Edit ${store.name}`)
        : "Add store"}
      subtitle={isEdit
        ? (isHQ ? "The headquarter is the auto-created store every merchant has. You can rename it, but it can't be deleted."
                : "Update this store's details.")
        : <>Adding a second store makes the headquarter visible as its own row. Terminals stay with their currently-bound store.</>}
      footer={
        <>
          {isEdit && (
            <window.Button danger icon="trash" onClick={() => onDelete && onDelete(store)}>
              Delete store
            </window.Button>
          )}
          <div style={{ flex: 1 }} />
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary disabled={!canSave} icon={isEdit ? "check" : "plus"}
            onClick={() => onSave({ name: name.trim(), address: address.trim(), country, notes })}>
            {isEdit ? "Save changes" : "Add store"}
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <window.Field label="Store name" required
          hint={isHQ
            ? <>Defaults to the merchant name. Rename if the headquarter has its own street identity. <span className="mono">{name.length}</span> / 80 characters.</>
            : <span><span className="mono">{name.length}</span> / 80 characters</span>}>
          <window.Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder={isHQ ? merchant.name : "e.g. Plateau Roastery"} />
        </window.Field>
        <window.Field label="Store address">
          <window.Input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, postal code" />
        </window.Field>
        <window.Field label="Country / region" required>
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{
            width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-default)", fontSize: 13,
            fontFamily: "inherit", background: "var(--bg2)", color: "var(--fg1)",
          }}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </window.Field>
        <window.Field label="Notes">
          <window.Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Optional — operating hours, contact, etc." />
        </window.Field>
      </div>
    </window.Modal>
  );
}

function TerminalFormModal({ mode, merchant, stores, terminal, defaultStoreId, onClose, onSave, onDelete }) {
  const isEdit = mode === "edit" && !!terminal;
  const isPending = isEdit && terminal?.state === "pending" && !terminal?.sn;
  const hq = stores.find(s => s.isHQ);

  // Mode toggle — single VarSheet vs bulk import. Editing always goes through
  // the single form; the bulk import only makes sense for new records.
  const [entryMode, setEntryMode] = useStateM("single");
  // Active form section (single-mode tabs).
  const [section, setSection] = useStateM("identity");

  // The full VarSheet state. ~30 acquirer-provided parameters grouped by
  // function. Defaults are realistic seeds an acquirer would pre-fill for
  // a Canadian merchant — operators rarely touch most of these.
  const [vs, setVs] = useStateM(() => ({
    // Acquirer-provided identifiers — these are typed in by the operator,
    // not derived from the system's merchant record. The acquirer's name
    // for the merchant often differs from what we know them as.
    merchantNameAcq:  terminal?.merchantNameAcq || merchant.name || "",
    mid:              terminal?.midAcq || "",
    tid:              terminal?.tidAcq || "",
    // Identity
    storeId: terminal?.storeId || defaultStoreId || hq?.id || stores[0]?.id,
    address:           terminal?.address || "",
    subMerchantId:     terminal?.subMerchantId || "",
    // Acquirer
    acquirerId:        terminal?.acquirerId || "ACQ-NB-CA-01",
    acquirerName:     terminal?.acquirerName || "Northbay Acquiring (CA)",
    bankBin:           terminal?.bankBin || "424242",
    settlementAccount: terminal?.settlementAccount || "**** **** **** 4242",
    mcc:               terminal?.mcc || "5812",
    currency:          terminal?.currency || "CAD",
    country:           terminal?.country || "CA",
    timezone:          terminal?.timezone || "America/Toronto",
    // Operations
    cutoffTime:        terminal?.cutoffTime || "23:00",
    batchNumber:       terminal?.batchNumber || "001",
    reversalHours:     terminal?.reversalHours ?? 24,
    minTxAmount:       terminal?.minTxAmount ?? 1.00,
    maxTxAmount:       terminal?.maxTxAmount ?? 5000,
    dailyVolumeLimit:  terminal?.dailyVolumeLimit ?? 50000,
    networkMode:       terminal?.networkMode || "online",
    // Cards & Auth
    cardSchemes:       terminal?.cardSchemes || ["Visa", "Mastercard", "AMEX", "Interac"],
    cvv2:              terminal?.cvv2 ?? true,
    avs:               terminal?.avs ?? false,
    pinBypassAllowed:  terminal?.pinBypassAllowed ?? false,
    manualEntryAllowed:terminal?.manualEntryAllowed ?? true,
    contactlessLimit:  terminal?.contactlessLimit ?? 250,
    emvAids:           terminal?.emvAids || "A0000000031010, A0000000041010, A0000002771010",
    // Features
    tipAllowed:        terminal?.tipAllowed ?? true,
    cashbackAllowed:   terminal?.cashbackAllowed ?? false,
    refundAllowed:     terminal?.refundAllowed ?? true,
    voidAllowed:       terminal?.voidAllowed ?? true,
    preAuthAllowed:    terminal?.preAuthAllowed ?? false,
    surchargeRate:     terminal?.surchargeRate ?? 0,
    dccEnabled:        terminal?.dccEnabled ?? false,
    loyaltyIntegration:terminal?.loyaltyIntegration ?? false,
    // Security & receipts
    tokenizationProvider: terminal?.tokenizationProvider || "TOMS Vault",
    encryption:        terminal?.encryption || "DUKPT",
    keyIndex:          terminal?.keyIndex ?? 1,
    tlsVersion:        terminal?.tlsVersion || "1.3",
    receiptHeader:     terminal?.receiptHeader || "",
    receiptFooter:     terminal?.receiptFooter || "Thank you!",
  }));
  const setField = (k, v) => setVs(prev => ({ ...prev, [k]: v }));

  const canSave = !!vs.storeId
    && vs.merchantNameAcq.trim().length > 0
    && /^[A-Z0-9]{15}$/.test(vs.mid)
    && /^\d{8}$/.test(vs.tid);
  const selectedStore = stores.find(s => s.id === vs.storeId);

  return (
    <window.Modal open onClose={onClose} width={780}
      title={isEdit
        ? (isPending ? `Edit VarSheet ${terminal.tid}` : `Edit terminal ${terminal.sn}`)
        : "Add terminal"}
      subtitle={isEdit
        ? "Update the VarSheet's acquirer parameters. The Terminal No. (TID) is fixed once the record is created."
        : <>Register a VarSheet under <b>{merchant.name}</b>. The Merchant Name, Merchant No. and Terminal No. below are supplied by your <b>acquirer</b> — they may differ from what we know this merchant as.</>}
      footer={
        <>
          {isEdit && (
            <window.Button danger icon="trash" onClick={() => onDelete && onDelete(terminal)}>
              {isPending ? "Delete VarSheet" : "Unbind terminal"}
            </window.Button>
          )}
          <div style={{ flex: 1 }} />
          <window.Button onClick={onClose}>Cancel</window.Button>
          {entryMode === "single" && (
            <window.Button primary disabled={!canSave} icon={isEdit ? "check" : "plus"}
              onClick={() => onSave(vs)}>
              {isEdit ? "Save changes" : "Create Terminal"}
            </window.Button>
          )}
        </>
      }>
      {/* Entry-mode segmented control — only when creating new */}
      {!isEdit && (
        <div role="tablist" style={{
          display: "inline-flex", gap: 2, padding: 3,
          background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-md)", marginBottom: 14,
        }}>
          {[
            { id: "single", label: "Single terminal", icon: "device" },
            { id: "bulk",   label: "Bulk import (CSV / XLSX)", icon: "upload" },
          ].map(opt => {
            const on = entryMode === opt.id;
            return (
              <button key={opt.id} onClick={() => setEntryMode(opt.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: "var(--radius-sm)",
                fontSize: 12, fontWeight: on ? 500 : 400,
                background: on ? "var(--bg2)" : "transparent",
                color: on ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                boxShadow: on ? "var(--shadow-1)" : "none",
              }}>
                <window.Ico name={opt.icon} size={12} stroke={1.8} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {entryMode === "bulk" && !isEdit ? (
        <BulkImportPanel merchant={merchant} stores={stores} onCommit={(rows) => onSave({ __bulk: rows })} />
      ) : (
        <SingleVarSheetForm
          merchant={merchant} stores={stores}
          terminal={terminal} isEdit={isEdit} isPending={isPending}
          vs={vs} setField={setField}
          section={section} setSection={setSection}
          selectedStore={selectedStore} />
      )}
    </window.Modal>
  );
}

// ─── Single-VarSheet body — section tabs + grouped fields ─
// The ~30 acquirer parameters split into 6 logical sections. Operators
// touch maybe 4 fields on a typical setup (store, address, MCC, schemes);
// the rest are pre-populated by the acquirer's defaults so reviewing them
// is fast and accurate.
function SingleVarSheetForm({ merchant, stores, terminal, isEdit, isPending,
                              vs, setField, section, setSection, selectedStore }) {
  const sections = [
    { id: "identity",   label: "Identity" },
    { id: "acquirer",   label: "Acquirer" },
    { id: "ops",        label: "Operations" },
    { id: "cards",      label: "Cards & auth" },
    { id: "features",   label: "Features" },
    { id: "security",   label: "Security & receipts" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Section tabs */}
      <div style={{
        display: "flex", gap: 2,
        borderBottom: "1px solid var(--color-border-subtle)",
        marginBottom: 2,
        overflowX: "auto",
      }}>
        {sections.map(s => {
          const on = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: "8px 14px",
              fontSize: 12.5, fontWeight: on ? 500 : 400,
              color: on ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              borderBottom: "2px solid",
              borderColor: on ? "var(--color-text-primary)" : "transparent",
              marginBottom: -1, whiteSpace: "nowrap",
            }}>{s.label}</button>
          );
        })}
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto", padding: "2px 2px" }}>
        {section === "identity" && (
          <FormGrid>
            <window.Field label="Acquirer merchant name" required full
              hint="The name your acquirer uses for this merchant. Often differs from how you know them internally.">
              <window.Input value={vs.merchantNameAcq} onChange={(e) => setField("merchantNameAcq", e.target.value)}
                placeholder="e.g. RIVERSIDE COFFEE CO LTD" />
            </window.Field>
            <window.Field label="Merchant No. (MID)" required
              hint={<>15 characters — digits or uppercase letters. <span className="mono">{vs.mid.length}</span> / 15</>}
              error={vs.mid.length > 0 && !/^[A-Z0-9]{15}$/.test(vs.mid)
                ? "Must be exactly 15 characters, digits or uppercase letters only."
                : null}>
              <window.Input value={vs.mid}
                onChange={(e) => setField("mid", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                mono
                placeholder="e.g. 821048275AB12CD" />
            </window.Field>
            <window.Field label="Terminal No. (TID)" required
              hint={<>8 digits. <span className="mono">{vs.tid.length}</span> / 8</>}
              error={vs.tid.length > 0 && !/^\d{8}$/.test(vs.tid)
                ? "Must be exactly 8 digits."
                : null}>
              <window.Input value={vs.tid}
                onChange={(e) => setField("tid", e.target.value.replace(/\D/g, "").slice(0, 8))}
                mono
                placeholder="e.g. 01029281" />
            </window.Field>
            <window.Field label="Terminal address (override)" full
              hint={<>Leave blank to inherit from <b>{selectedStore?.name || "the store"}</b>. Sets the address printed on receipts and reported to the acquirer.</>}>
              <window.Input value={vs.address} onChange={(e) => setField("address", e.target.value)}
                placeholder={selectedStore?.address || "Street, city, postal code"} />
            </window.Field>
          </FormGrid>
        )}

        {section === "acquirer" && (
          <FormGrid>
            <window.Field label="Acquirer ID" required>
              <window.Input value={vs.acquirerId} onChange={(e) => setField("acquirerId", e.target.value)} mono />
            </window.Field>
            <window.Field label="Acquirer name">
              <window.Input value={vs.acquirerName} onChange={(e) => setField("acquirerName", e.target.value)} />
            </window.Field>
            <window.Field label="Bank BIN" required>
              <window.Input value={vs.bankBin} onChange={(e) => setField("bankBin", e.target.value)} mono
                placeholder="6-digit BIN" />
            </window.Field>
            <window.Field label="Settlement account">
              <window.Input value={vs.settlementAccount} onChange={(e) => setField("settlementAccount", e.target.value)} mono />
            </window.Field>
            <window.Field label="MCC" required hint="Merchant Category Code (ISO 18245)">
              <window.Input value={vs.mcc} onChange={(e) => setField("mcc", e.target.value.replace(/\D/g, "").slice(0, 4))} mono
                placeholder="e.g. 5812" />
            </window.Field>
            <window.Field label="Currency" required>
              <Select value={vs.currency} onChange={(v) => setField("currency", v)}
                options={["CAD","USD","EUR","GBP","AUD","JPY","SGD","MXN"].map(c => ({ value: c, label: c }))} />
            </window.Field>
            <window.Field label="Country" required>
              <Select value={vs.country} onChange={(v) => setField("country", v)}
                options={["CA","US","MX","GB","DE","FR","AU","JP","SG","BR"].map(c => ({ value: c, label: c }))} />
            </window.Field>
            <window.Field label="Time zone">
              <Select value={vs.timezone} onChange={(v) => setField("timezone", v)}
                options={["America/Toronto","America/Vancouver","America/Edmonton","America/Halifax","America/New_York","America/Los_Angeles","UTC"].map(t => ({ value: t, label: t }))} />
            </window.Field>
          </FormGrid>
        )}

        {section === "ops" && (
          <FormGrid>
            <window.Field label="Settlement cut-off time" hint="Local time. Batches close at this hour.">
              <window.Input type="time" value={vs.cutoffTime} onChange={(e) => setField("cutoffTime", e.target.value)} mono />
            </window.Field>
            <window.Field label="Starting batch number">
              <window.Input value={vs.batchNumber} onChange={(e) => setField("batchNumber", e.target.value.replace(/\D/g, "").slice(0, 4))} mono />
            </window.Field>
            <window.Field label="Reversal window (hours)" hint="How long after auth a void/reversal is allowed.">
              <window.Input type="number" value={vs.reversalHours} onChange={(e) => setField("reversalHours", Number(e.target.value))} min={0} max={168} mono />
            </window.Field>
            <window.Field label="Network mode">
              <Select value={vs.networkMode} onChange={(v) => setField("networkMode", v)}
                options={[
                  { value: "online",  label: "Online only" },
                  { value: "mixed",   label: "Mixed (online + store-and-forward)" },
                  { value: "offline", label: "Offline only" },
                ]} />
            </window.Field>
            <window.Field label="Min transaction amount" hint={`In ${vs.currency}`}>
              <window.Input type="number" step="0.01" value={vs.minTxAmount} onChange={(e) => setField("minTxAmount", Number(e.target.value))} mono />
            </window.Field>
            <window.Field label="Max transaction amount" hint={`In ${vs.currency}`}>
              <window.Input type="number" step="1" value={vs.maxTxAmount} onChange={(e) => setField("maxTxAmount", Number(e.target.value))} mono />
            </window.Field>
            <window.Field label="Daily volume limit" hint={`In ${vs.currency}`}>
              <window.Input type="number" step="100" value={vs.dailyVolumeLimit} onChange={(e) => setField("dailyVolumeLimit", Number(e.target.value))} mono />
            </window.Field>
          </FormGrid>
        )}

        {section === "cards" && (
          <FormGrid>
            <window.Field label="Card schemes enabled" required full>
              <ChipMulti
                options={["Visa","Mastercard","AMEX","Discover","JCB","UnionPay","Interac"]}
                value={vs.cardSchemes}
                onChange={(v) => setField("cardSchemes", v)} />
            </window.Field>
            <window.Field label="EMV AIDs" hint="Comma-separated. The Application Identifiers the kernel will negotiate." full>
              <window.Input value={vs.emvAids} onChange={(e) => setField("emvAids", e.target.value)} mono />
            </window.Field>
            <window.Field label="Contactless limit" hint={`In ${vs.currency}. PIN required above this amount.`}>
              <window.Input type="number" step="1" value={vs.contactlessLimit} onChange={(e) => setField("contactlessLimit", Number(e.target.value))} mono />
            </window.Field>
            <window.Field label="CVV2 verification">
              <Toggle on={vs.cvv2} onChange={(v) => setField("cvv2", v)} />
            </window.Field>
            <window.Field label="AVS check">
              <Toggle on={vs.avs} onChange={(v) => setField("avs", v)} />
            </window.Field>
            <window.Field label="PIN bypass allowed" hint="Allow signature fallback when PIN is unavailable.">
              <Toggle on={vs.pinBypassAllowed} onChange={(v) => setField("pinBypassAllowed", v)} />
            </window.Field>
            <window.Field label="Manual PAN entry">
              <Toggle on={vs.manualEntryAllowed} onChange={(v) => setField("manualEntryAllowed", v)} />
            </window.Field>
          </FormGrid>
        )}

        {section === "features" && (
          <FormGrid>
            <window.Field label="Tip allowed">
              <Toggle on={vs.tipAllowed} onChange={(v) => setField("tipAllowed", v)} />
            </window.Field>
            <window.Field label="Cashback allowed">
              <Toggle on={vs.cashbackAllowed} onChange={(v) => setField("cashbackAllowed", v)} />
            </window.Field>
            <window.Field label="Refund allowed">
              <Toggle on={vs.refundAllowed} onChange={(v) => setField("refundAllowed", v)} />
            </window.Field>
            <window.Field label="Void allowed">
              <Toggle on={vs.voidAllowed} onChange={(v) => setField("voidAllowed", v)} />
            </window.Field>
            <window.Field label="Pre-authorization">
              <Toggle on={vs.preAuthAllowed} onChange={(v) => setField("preAuthAllowed", v)} />
            </window.Field>
            <window.Field label="Surcharge rate (%)" hint="Pass-on cost added to each transaction. 0 = no surcharge.">
              <window.Input type="number" step="0.1" value={vs.surchargeRate} onChange={(e) => setField("surchargeRate", Number(e.target.value))} mono />
            </window.Field>
            <window.Field label="DCC enabled" hint="Dynamic currency conversion for foreign cards.">
              <Toggle on={vs.dccEnabled} onChange={(v) => setField("dccEnabled", v)} />
            </window.Field>
            <window.Field label="Loyalty integration">
              <Toggle on={vs.loyaltyIntegration} onChange={(v) => setField("loyaltyIntegration", v)} />
            </window.Field>
          </FormGrid>
        )}

        {section === "security" && (
          <FormGrid>
            <window.Field label="Tokenization provider">
              <Select value={vs.tokenizationProvider} onChange={(v) => setField("tokenizationProvider", v)}
                options={["TOMS Vault","Visa VTS","Mastercard MDES","None"].map(o => ({ value: o, label: o }))} />
            </window.Field>
            <window.Field label="Key encryption method">
              <Select value={vs.encryption} onChange={(v) => setField("encryption", v)}
                options={["DUKPT","Master/Session","Fixed"].map(o => ({ value: o, label: o }))} />
            </window.Field>
            <window.Field label="Key index">
              <window.Input type="number" value={vs.keyIndex} onChange={(e) => setField("keyIndex", Number(e.target.value))} mono />
            </window.Field>
            <window.Field label="TLS version (min)">
              <Select value={vs.tlsVersion} onChange={(v) => setField("tlsVersion", v)}
                options={["1.2","1.3"].map(o => ({ value: o, label: `TLS ${o}` }))} />
            </window.Field>
            <window.Field label="Receipt header" full>
              <window.Input value={vs.receiptHeader} onChange={(e) => setField("receiptHeader", e.target.value)}
                placeholder="Optional — printed at the top of every receipt" />
            </window.Field>
            <window.Field label="Receipt footer" full>
              <window.Input value={vs.receiptFooter} onChange={(e) => setField("receiptFooter", e.target.value)} />
            </window.Field>
          </FormGrid>
        )}
      </div>
    </div>
  );
}

// ─── Form bits ────────────────────────────────────────────
function FormGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {React.Children.map(children, c => {
        // Honour the `full` prop so checkbox / multi rows span both columns.
        const full = c?.props?.full;
        return <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>{c}</div>;
      })}
    </div>
  );
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
      border: "1px solid var(--color-border-default)", fontSize: 13,
      fontFamily: "inherit", background: "var(--bg2)", color: "var(--fg1)",
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 38, height: 20, borderRadius: 999, padding: 0,
      background: on ? "var(--color-primary-600)" : "var(--color-bg-3)",
      border: "1px solid",
      borderColor: on ? "var(--color-primary-600)" : "var(--color-border-default)",
      position: "relative", cursor: "pointer",
    }} aria-label={on ? "On" : "Off"}>
      <span style={{
        position: "absolute", top: 1, left: on ? 19 : 1,
        width: 16, height: 16, borderRadius: "50%",
        background: "white", transition: "left .15s ease",
      }} />
    </button>
  );
}
function ChipMulti({ options, value, onChange }) {
  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} onClick={() => toggle(o)} style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 12,
            background: on ? "var(--color-primary-50)" : "var(--bg2)",
            border: "1px solid",
            borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
            color: on ? "var(--color-primary-700)" : "var(--fg2)",
            fontWeight: on ? 500 : 400,
          }}>{o}</button>
        );
      })}
    </div>
  );
}
function KvMini({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span className="overline" style={{ fontSize: 9.5 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--fg1)", minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

// ─── Bulk import panel ─────────────────────────────────────
// File-driven path. Operator drops a CSV/XLSX, we mock-parse it, show a
// preview table with validation flags, and commit on confirm. Production
// would stream the rows through the same VarSheet validation pipeline as
// the single form before persisting.
function BulkImportPanel({ merchant, stores, onCommit }) {
  const [file, setFile] = useStateM(null);     // { name, size } | null
  const [phase, setPhase] = useStateM("idle"); // idle | parsing | parsed
  const [rows, setRows] = useStateM([]);

  const onPick = (f) => {
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    setPhase("parsing");
    // Mock parse — pretend to chew on the file for a moment, then return a
    // canned set of rows so the preview shows realistic content. In real
    // life this is a streaming XLSX/CSV parser running locally.
    setTimeout(() => {
      const hq = stores.find(s => s.isHQ);
      const sample = [
        { row: 1, address: "402 St-Laurent Blvd, Montréal",  storeId: hq?.id,     mcc: "5812", currency: "CAD", schemes: "Visa,MC,Interac", valid: true },
        { row: 2, address: "5640 Av du Parc, Montréal",      storeId: hq?.id,     mcc: "5812", currency: "CAD", schemes: "Visa,MC,AMEX",    valid: true },
        { row: 3, address: "10 Rue de la Commune, Montréal", storeId: hq?.id,     mcc: "5812", currency: "CAD", schemes: "Visa,MC",         valid: true },
        { row: 4, address: "missing required column",         storeId: null,       mcc: "",     currency: "CAD", schemes: "Visa",            valid: false, error: "Missing MCC" },
        { row: 5, address: "92 Bloor St W, Toronto",          storeId: hq?.id,     mcc: "5942", currency: "CAD", schemes: "Visa,MC",         valid: true },
      ];
      setRows(sample);
      setPhase("parsed");
    }, 900);
  };

  const valid = rows.filter(r => r.valid).length;
  const invalid = rows.length - valid;

  const downloadTemplate = () => {
    window.showToast?.("Template download — coming in Phase 4.2", "info");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Help banner */}
      <div style={{
        padding: "10px 12px",
        background: "var(--color-info-50)",
        border: "1px solid color-mix(in oklab, var(--color-info-500) 22%, transparent)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "flex-start", gap: 10,
        fontSize: 12, color: "var(--color-info-700)", lineHeight: 1.55,
      }}>
        <window.Ico name="info" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <b>Bulk upload</b> creates pending VarSheets in one go — TIDs are assigned automatically and each row joins as <b>pending installation</b>. Need the column layout?{" "}
          <button onClick={downloadTemplate} style={{
            color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2, fontWeight: 500,
          }}>Download template (.xlsx)</button>
        </div>
      </div>

      {/* File picker */}
      {phase === "idle" && (
        <button onClick={() => onPick({ name: "Northbay-Q2-onboarding.xlsx", size: 24400 })} style={{
          padding: "40px 24px",
          border: "1.5px dashed var(--color-border-default)",
          borderRadius: 10,
          background: "var(--color-bg-3)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          width: "100%", cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary-500)";
          e.currentTarget.style.background = "var(--color-primary-50)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-default)";
          e.currentTarget.style.background = "var(--color-bg-3)";
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: "var(--bg2)", color: "var(--fg2)",
            border: "1px solid var(--border-1)",
            display: "grid", placeItems: "center",
          }}>
            <window.Ico name="upload" size={18} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Drag a CSV / XLSX here, or click to browse</div>
          <div style={{ fontSize: 11.5, color: "var(--fg3)" }}>
            Up to 500 rows · column order matches the template
          </div>
        </button>
      )}

      {phase === "parsing" && file && (
        <div style={{
          padding: "16px",
          background: "var(--bg2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Spinner size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{file.name}</div>
            <div style={{ fontSize: 11, color: "var(--fg3)" }}>
              Parsing rows and validating against acquirer rules…
            </div>
          </div>
        </div>
      )}

      {phase === "parsed" && (
        <>
          {/* Summary */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10,
          }}>
            <KpiTile label="File" value={file.name} mono small />
            <KpiTile label="Rows"     value={rows.length} />
            <KpiTile label="Valid"    value={valid}   tone="success" />
            <KpiTile label="Errors"   value={invalid} tone={invalid > 0 ? "danger" : undefined} />
          </div>

          {/* Preview */}
          <div style={{ border: "1px solid var(--border-1)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg3)", textAlign: "left",
                    position: "sticky", top: 0, zIndex: 1 }}>
                    {["Row","Address","MCC","Currency","Schemes","Valid?"].map(h => (
                      <th key={h} className="overline" style={{
                        padding: "8px 12px", fontSize: 10.5,
                        borderBottom: "1px solid var(--border-1)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.row} style={{
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background: !r.valid ? "var(--error-bg)" : "transparent",
                    }}>
                      <td style={{ padding: "8px 12px" }}><span className="mono num">{r.row}</span></td>
                      <td style={{ padding: "8px 12px" }}>{r.address}</td>
                      <td style={{ padding: "8px 12px" }}><span className="mono">{r.mcc || "—"}</span></td>
                      <td style={{ padding: "8px 12px" }}><span className="mono">{r.currency}</span></td>
                      <td style={{ padding: "8px 12px", fontSize: 11 }}>{r.schemes}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {r.valid ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 11, color: "var(--color-success-700)", fontWeight: 500 }}>
                            <window.Ico name="check" size={11} stroke={2.4} /> Valid
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 11, color: "var(--color-error-700)", fontWeight: 500 }} title={r.error}>
                            <window.Ico name="alert" size={11} /> {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>
              {invalid > 0
                ? <>Fix the highlighted rows in the source file, then re-upload — or click <b>Import valid only</b> to skip them.</>
                : <>All rows look good. Click <b>Import</b> to create {valid} pending VarSheet{valid === 1 ? "" : "s"}.</>}
            </span>
            <div style={{ flex: 1 }} />
            <window.Button ghost onClick={() => { setFile(null); setPhase("idle"); setRows([]); }}>Replace file</window.Button>
            <window.Button primary icon="check" disabled={valid === 0}
              onClick={() => onCommit(rows.filter(r => r.valid))}>
              {invalid > 0 ? `Import valid only · ${valid}` : `Import · ${valid}`}
            </window.Button>
          </div>
        </>
      )}
    </div>
  );
}

function KpiTile({ label, value, sub, tone, mono, small }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: "var(--radius-md)",
      background: "var(--bg2)", border: "1px solid var(--border-1)",
    }}>
      <div className="overline" style={{ fontSize: 10 }}>{label}</div>
      <div style={{
        marginTop: 4,
        fontSize: small ? 12 : 18, fontWeight: 500,
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        color: tone === "success" ? "var(--success)"
            : tone === "danger"  ? "var(--color-error-700)"
            : "var(--fg1)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg3)" }}>{sub}</div>}
    </div>
  );
}

// ─── Install flow — enter activation code, resolve to SN/model ──
// Mock resolver: deterministic hash of the 6-digit code → SN + model.
// Production would hit a sales-tools / device-fulfillment API.
function resolveActivationCode(code) {
  const samples = [
    { sn: "N950-0288-7541", model: "N950" },
    { sn: "N950-0014-7912", model: "N950" },
    { sn: "S90-0822-3104",  model: "S90"  },
    { sn: "S60-0488-2284",  model: "S60"  },
    { sn: "N750-0099-1052", model: "N750" },
    { sn: "X800-0099-2018", model: "X800" },
  ];
  let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return samples[h % samples.length];
}

function InstallTerminalModal({ merchant, terminal, onClose, onConfirm }) {
  const store = (merchant.stores || []).find(s => s.id === terminal.storeId);
  const [code, setCode] = useStateM("");
  const [phase, setPhase] = useStateM("entering"); // entering | resolving | resolved | error
  const [resolved, setResolved] = useStateM(null);

  const lookup = () => {
    if (code.length !== 6) return;
    setPhase("resolving");
    setTimeout(() => {
      // Simulate a "no such code" error 1-in-20 to demonstrate the error path.
      if (code === "000000") {
        setPhase("error");
        return;
      }
      setResolved(resolveActivationCode(code));
      setPhase("resolved");
    }, 600);
  };

  // Auto-trigger lookup when the user finishes typing 6 digits.
  useEffectM(() => {
    if (code.length === 6 && phase === "entering") lookup();
  }, [code]);

  const onCodeChange = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setPhase("entering");
    setResolved(null);
  };

  return (
    <window.Modal open onClose={onClose} width={560}
      title="Bind device"
      subtitle="Enter the 6-digit code shown on the terminal screen. The system will match it to a device and bind that SN to this VarSheet."
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="check"
            disabled={phase !== "resolved"}
            onClick={() => onConfirm(resolved)}>
            Confirm install
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* VarSheet info */}
        <div style={{
          padding: "10px 12px",
          background: "var(--bg2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", rowGap: 6, columnGap: 12,
        }}>
          <KvLabel>Merchant No.</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12 }}>{merchant.mid}</span></KvValue>
          <KvLabel>Terminal No.</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{terminal.tid}</span></KvValue>
          <KvLabel>Store</KvLabel>
          <KvValue>{store?.name || "—"}{store?.isHQ ? " (HQ)" : ""}</KvValue>
        </div>

        {/* Big code input */}
        <div>
          <label style={{ fontSize: 12, color: "var(--fg2)", fontWeight: 500, display: "block", marginBottom: 6 }}>
            Device code
          </label>
          <input
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="000000"
            autoFocus
            inputMode="numeric"
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 28,
              fontFamily: "var(--font-family-mono)",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textAlign: "center",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid",
              borderColor: phase === "error" ? "var(--color-error-500)"
                        : phase === "resolved" ? "var(--color-success-500)"
                                                : "var(--color-border-default)",
              background: "var(--bg2)",
              color: "var(--fg1)",
              outline: "none",
            }} />
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg3)" }}>
            The 6-digit code appears on the terminal screen after first power-on.
          </div>
        </div>

        {/* Resolution feedback */}
        {phase === "resolving" && (
          <div style={{
            padding: "12px 14px",
            background: "var(--color-info-50)",
            border: "1px solid color-mix(in oklab, var(--color-info-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--color-info-700)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Spinner size={12} /> Looking up the code…
          </div>
        )}
        {phase === "error" && (
          <div style={{
            padding: "10px 12px",
            background: "var(--error-bg)",
            border: "1px solid color-mix(in oklab, var(--color-error-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5, color: "var(--color-error-700)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <window.Ico name="alert" size={13} />
            No device matches that code. Re-check the screen and try again.
          </div>
        )}
        {phase === "resolved" && resolved && (
          <div style={{
            padding: "12px 14px",
            background: "oklch(96% 0.03 152)",
            border: "1px solid color-mix(in oklab, var(--color-success-500) 25%, transparent)",
            borderRadius: "var(--radius-md)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
              fontWeight: 600, color: "var(--color-success-700)" }}>
              <window.Ico name="check" size={13} stroke={2.5} /> Device matched
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", rowGap: 5, columnGap: 12 }}>
              <KvLabel>Serial number</KvLabel>
              <KvValue><span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{resolved.sn}</span></KvValue>
              <KvLabel>Model</KvLabel>
              <KvValue><span className="mono" style={{ fontSize: 12 }}>{resolved.model}</span></KvValue>
            </div>
          </div>
        )}
      </div>
    </window.Modal>
  );
}

// ─── Unbind flow — confirm + payment-app warning ──────────
function UnbindTerminalModal({ merchant, terminal, onClose, onConfirm }) {
  const store = (merchant.stores || []).find(s => s.id === terminal.storeId);
  return (
    <window.Modal open onClose={onClose} width={560}
      title={`Unbind terminal ${terminal.sn}?`}
      subtitle="Unbinding clears the device from this VarSheet. The TID stays — you can install a different device on it later."
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button danger icon="link" onClick={onConfirm}>
            Unbind device
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Warning */}
        <div style={{
          padding: "12px 14px",
          background: "var(--warning-bg)",
          border: "1px solid color-mix(in oklab, var(--color-warning-500) 30%, transparent)",
          borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <window.Ico name="alert" size={15} style={{ color: "var(--color-warning-700)", marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: "var(--color-warning-700)", lineHeight: 1.55 }}>
            <b>End the payment session first.</b> Ask the merchant to close any open transaction on the terminal before you confirm — in-flight settlements may fail otherwise.
          </div>
        </div>

        {/* VarSheet + device snapshot */}
        <div style={{
          padding: "10px 12px",
          background: "var(--bg2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", rowGap: 6, columnGap: 14,
        }}>
          <KvLabel>Merchant No.</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12 }}>{merchant.mid}</span></KvValue>
          <KvLabel>Terminal No.</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{terminal.tid}</span></KvValue>
          <KvLabel>Store</KvLabel>
          <KvValue>{store?.name || "—"}{store?.isHQ ? " (HQ)" : ""}</KvValue>
          <KvLabel>Serial number</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12 }}>{terminal.sn}</span></KvValue>
          <KvLabel>Model</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 12 }}>{terminal.model}</span></KvValue>
          <KvLabel>Last seen</KvLabel>
          <KvValue><span className="mono" style={{ fontSize: 11.5, color: "var(--fg3)" }}>{terminal.lastSeen || "—"}</span></KvValue>
        </div>
      </div>
    </window.Modal>
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

// ─── New merchant screen (full page — same shell as new app) ──
function NewMerchantScreen({ onClose, onSave }) {
  return (
    <MerchantFormModal mode="new" merchant={null}
      onClose={onClose}
      onSave={onSave} />
  );
}

// ─── Bits ──────────────────────────────────────────────────
function MerchantAvatar({ name, size = 32 }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  // Deterministic hue from name.
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const hue = h % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22, flexShrink: 0,
      background: `linear-gradient(135deg, oklch(60% 0.13 ${hue}), oklch(46% 0.16 ${(hue + 28) % 360}))`,
      color: "#fff",
      display: "grid", placeItems: "center",
      fontSize: size * 0.38, fontWeight: 600,
      fontFamily: "Geist, system-ui, sans-serif",
      letterSpacing: "-0.02em",
    }}>{initials}</div>
  );
}

function TagChip({ t }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 999,
      background: "var(--color-bg-3)", color: "var(--fg2)",
      border: "1px solid var(--color-border-subtle)",
      fontSize: 11, fontWeight: 450,
    }}>{t}</span>
  );
}

function KvLabel({ children }) {
  return <span className="overline" style={{ fontSize: 9.5, paddingTop: 2 }}>{children}</span>;
}
function KvValue({ children }) {
  return <span style={{ fontSize: 13, color: "var(--color-text-primary)", minWidth: 0 }}>{children}</span>;
}

function SummaryRow({ label, value, hint, tone }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 12, padding: "7px 0",
      borderBottom: "1px dashed var(--color-border-subtle)",
    }}>
      <div className="overline" style={{ fontSize: 10.5 }}>{label}</div>
      <div style={{ textAlign: "right" }}>
        <div className="mono num" style={{ fontSize: 16, fontWeight: 500,
          color: tone === "success" ? "var(--success)"
              : tone === "warning" ? "var(--warning)"
              : "var(--fg1)" }}>{value}</div>
        {hint && <div style={{ fontSize: 10.5, color: "var(--fg3)" }}>{hint}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  MerchantsListScreen, MerchantDetailScreen, MerchantFormModal,
  NewMerchantScreen, findMerchantById, bumpMerchants,
});
