/* global React, Btn, Badge, Input, Icon, Modal, CompanyLogo, fmtDate */
// ─────────────────────────────────────────────────────────────
// Customer Detail → "Merchants" tab.
//
// Shown only for customers with an ISO contract. Replicates the ISO
// portal's Merchants module from the Carbon Customer Portal — VIEW-ONLY:
// the admin can browse this ISO's downstream merchants, drill into a
// merchant's stores/terminals/apps/contracts, but cannot edit anything.
//
//   List view:    table of merchants under this ISO (MID, country,
//                 stores, terminals, tags, status).
//   Detail view:  three sub-tabs — Stores & Terminals · Apps · Contracts.
// ─────────────────────────────────────────────────────────────
const { useState: useStateCM, useMemo: useMemoCM } = React;

// ─── Tag chip — same look the customer detail uses for chip rows ──
const CMTagChip = ({ t }) =>
<span style={{
  fontSize: 11, padding: "2px 8px", borderRadius: 999,
  background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)",
  color: "var(--color-text-secondary)", whiteSpace: "nowrap"
}}>{t}</span>;


// ─── Merchant avatar — square monogram, ISV-style ──
const MerchantMonogram = ({ name, size = 36 }) => {
  const letters = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  // Stable per-name hue.
  let h = 0;for (const c of String(name)) h = h * 31 + c.charCodeAt(0) & 0x7fffffff;
  const hue = h % 360;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.max(6, Math.round(size / 5)),
      background: `linear-gradient(135deg, oklch(0.72 0.13 ${hue}), oklch(0.62 0.13 ${hue}))`,
      color: "#fff", flex: "none",
      display: "grid", placeItems: "center",
      fontWeight: 600, fontSize: Math.round(size * 0.36), letterSpacing: "-0.02em",
      boxShadow: "0 1px 2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)"
    }}>{letters}</div>);

};

// ─── Terminal state pill ─────────────────────────────────
const TerminalStatePill = ({ state }) => {
  if (state === "pending") return <Badge tone="warning" dot>Pending VarSheet</Badge>;
  return <Badge tone="success" dot>Active</Badge>;
};

// ─── Merchants list (top-level for the tab) ───────────────
const MerchantsList = ({ merchants, onOpen }) => {
  const [q, setQ] = useStateCM("");
  const [tagFilter, setTagFilter] = useStateCM("All");

  const tags = useMemoCM(() => {
    const s = new Set();
    merchants.forEach((m) => (m.tags || []).forEach((t) => s.add(t)));
    return ["All", ...[...s].sort()];
  }, [merchants]);

  const filtered = useMemoCM(() => merchants.filter((m) => {
    if (tagFilter !== "All" && !(m.tags || []).includes(tagFilter)) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return m.name.toLowerCase().includes(needle) ||
    (m.mid || "").toLowerCase().includes(needle) ||
    (m.stores || []).some((s) => s.name.toLowerCase().includes(needle));
  }), [merchants, q, tagFilter]);

  const totals = useMemoCM(() => ({
    merchants: merchants.length,
    stores: merchants.reduce((n, m) => n + (m.stores?.length || 0), 0),
    terminals: merchants.reduce((n, m) => n + (m.terminalsCount || 0), 0),
    active: merchants.reduce((n, m) => n + (m.activeTerminalsCount || 0), 0)
  }), [merchants]);

  if (merchants.length === 0) {
    return (
      <div className="empty" style={{ padding: "60px 24px", textAlign: "center" }}>
        <Icon name="building" size={28} />
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
          No merchants onboarded yet
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-tertiary)", marginTop: 4 }}>
          This ISO hasn't onboarded any merchants. Downstream merchants will appear here once they're created in the ISO portal.
        </div>
      </div>);

  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* KPI strip — 3 quick stats for this ISO's downstream */}
      <div className="tkt-kpi" style={{ padding: 0, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="tkt-kpi__tile" style={{ cursor: "default" }}>
          <div className="tkt-kpi__label">Merchants</div>
          <div className="tkt-kpi__val">{totals.merchants}</div>
          <div className="tkt-kpi__sub">Under this ISO</div>
        </div>
        <div className="tkt-kpi__tile" style={{ cursor: "default" }}>
          <div className="tkt-kpi__label">Stores</div>
          <div className="tkt-kpi__val">{totals.stores}</div>
          <div className="tkt-kpi__sub">Across all merchants</div>
        </div>
        <div className="tkt-kpi__tile" style={{ cursor: "default" }}>
          <div className="tkt-kpi__label">Active terminals</div>
          <div className="tkt-kpi__val">{totals.active}</div>
          <div className="tkt-kpi__sub">Currently transacting</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14} />} placeholder="Search merchants, stores, MID…" value={q} onChange={(e) => setQ(e.target.value)} size="md" />
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ minWidth: 150 }}>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              {tags.map((t) => <option key={t} value={t}>{t === "All" ? "All tags" : t}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
          </div>
          <span className="muted" style={{ fontSize: 12, marginLeft: 4 }}>
            Read-only view of this ISO's downstream merchants
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Merchant</th>
              <th style={{ width: "14%" }}>Country</th>
              <th style={{ width: "10%" }}>Stores</th>
              <th style={{ width: "34%" }}>Active Terminals</th>
              <th style={{ width: "8%" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ?
            <tr><td colSpan="5"><div className="empty">No merchants match your search.</div></td></tr> :
            filtered.map((m) =>
            <tr key={m.id} onClick={() => onOpen(m)}>
                <td>
                  <div className="al-app">
                    <MerchantMonogram name={m.name} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div className="al-app__name">{m.name}</div>
                      <div className="al-app__pkg" style={{ fontFamily: "var(--font-family-mono)" }}>{m.mid}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 13 }}>{m.country}</span></td>
                <td>
                  {(m.stores?.length || 0) <= 1 ?
                <span className="muted" style={{ fontSize: 11.5 }}>HQ only</span> :
                <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{m.stores.length}</span>}
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500, fontSize: 12.5 }}>{m.activeTerminalsCount || 0}</span>
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="iconbtn" onClick={(e) => {e.stopPropagation();onOpen(m);}}>
                    <Icon name="chevR" size={14} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>);

};

// ─── Stores strip — horizontally scrollable store cards ─────
const StoresStrip = ({ stores, selectedId, onSelect }) =>
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span className="overline" style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}>
        Stores · {stores.length}
      </span>
      <span className="muted" style={{ fontSize: 11.5 }}>Click a card to view its terminals.</span>
    </div>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
      {stores.map((s) => {
      const active = s.id === selectedId;
      const count = s.terminals?.length || 0;
      return (
        <button key={s.id} onClick={() => onSelect(s.id)} style={{
          flex: "0 0 220px",
          textAlign: "left", padding: "12px 14px",
          background: active ? "var(--color-primary-50)" : "var(--color-bg-2)",
          border: `1px solid ${active ? "var(--color-primary-300)" : "var(--color-border-default)"}`,
          borderRadius: 10, cursor: "pointer",
          transition: "border-color 0.12s, background 0.12s"
        }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.25 }}>
                {s.name}
              </div>
              {s.isHQ && <Badge tone="neutral">HQ</Badge>}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: active ? "var(--color-primary-700)" : "var(--color-text-secondary)" }}>
              <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{count}</span> terminal{count === 1 ? "" : "s"}
            </div>
          </button>);

    })}
    </div>
  </div>;


// ─── Terminals table for a single store ─────────────────────
// SN link helper — opens the device detail screen for the bound device.
// Falls back to a toast if the route isn't wired (older admin builds).
const openDeviceDetail = (sn) => {
  if (!sn) return;
  if (window.__navigate) window.__navigate({ screen: "deviceDetail", deviceSn: sn });
};

// ─── VarSheet detail modal ────────────────────────────────
// The admin portal doesn't have a dedicated VarSheet page yet. Until it
// does, clicking a TID opens this modal with the acquirer-supplied
// parameters synthesized from the merchant + terminal record. Mirrors the
// ISO portal's VarSheet form sections (Identity, Acquirer, Schemes,
// Limits) in read-only form.
const _SCHEME_OPTS = ["Visa", "Mastercard", "Interac", "Amex", "Discover", "JCB", "UnionPay"];
function deriveVarSheet(merchant, t) {
  const h = _stratHash(`${merchant.id}:${t.tid}`);
  const schemes = _SCHEME_OPTS.filter((_, i) => ((h >> i) & 1) === 1).slice(0, 5);
  return {
    tid: t.tid,
    midAcq: merchant.mid,
    merchantName: merchant.name,
    address: (merchant.stores || []).find(s => (s.terminals || []).some(x => x.tid === t.tid))?.address || merchant.stores?.[0]?.address || "—",
    mcc: 5499 + (h % 99),
    currency: { "Canada": "CAD", "United States": "USD" }[merchant.country] || "USD",
    schemes: schemes.length > 0 ? schemes : ["Visa", "Mastercard"],
    contactlessCap: 250,
    pinBypassCap: 100,
    timezone: "America/Toronto",
    acquirerHost: "acq-pin1.northwind-payments.com:9443",
    boundSn: t.sn,
    model: t.model,
    state: t.state,
  };
}

const VarSheetModal = ({ open, onClose, vs }) => {
  if (!vs) return null;
  return (
    <Modal open={open} onClose={onClose} width={620}
      title={`VarSheet ${vs.tid}`}
      footer={<Btn variant="secondary" onClick={onClose}>Close</Btn>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <VSSection label="Identity" rows={[
          ["TID", <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{vs.tid}</span>],
          ["Acquirer MID", <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{vs.midAcq}</span>],
          ["Merchant name", vs.merchantName],
          ["Address", vs.address],
          ["Status", <Badge tone={vs.state === "pending" ? "warning" : "success"} dot>{vs.state === "pending" ? "Pending install" : "Installed"}</Badge>],
        ]}/>
        <VSSection label="Device binding" rows={[
          ["Serial number", vs.boundSn
            ? <a onClick={() => openDeviceDetail(vs.boundSn)}
                 style={{ color: "var(--color-primary-700)", fontFamily: "var(--font-family-mono)", fontWeight: 500, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                 {vs.boundSn}
               </a>
            : <span className="muted" style={{ fontStyle: "italic" }}>— not bound</span>],
          ["Model", vs.model || <span className="muted">—</span>],
        ]}/>
        <VSSection label="Acquirer parameters" rows={[
          ["MCC", <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{vs.mcc}</span>],
          ["Currency", vs.currency],
          ["Schemes", <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{vs.schemes.map(s => <CMTagChip key={s} t={s}/>)}</div>],
          ["Contactless cap", <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{vs.contactlessCap} {vs.currency}</span>],
          ["PIN bypass cap", <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{vs.pinBypassCap} {vs.currency}</span>],
          ["Timezone", vs.timezone],
          ["Acquirer host", <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontSize: 12 }}>{vs.acquirerHost}</span>],
        ]}/>
        <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, padding: "10px 12px", background: "var(--color-bg-3)", borderRadius: 8 }}>
          Read-only view. VarSheet parameters are maintained by the acquirer and edited by ISO operators — not by platform admins.
        </div>
      </div>
    </Modal>
  );
};

const VSSection = ({ label, rows }) => (
  <div>
    <div className="overline" style={{ fontSize: 10.5, color: "var(--color-text-tertiary)", marginBottom: 6 }}>{label}</div>
    <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", rowGap: 8, columnGap: 16 }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <div className="muted" style={{ fontSize: 12 }}>{k}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{v}</div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ─── Clickable SN and TID cells — shared between the stores tab and
//     the expanded app row's per-terminal lists. Both are styled like
//     subtle links so the operator knows they're interactive.
const TerminalSnLink = ({ sn }) => {
  if (!sn) return <span style={{ fontStyle: "italic", color: "var(--color-text-tertiary)" }}>— not bound</span>;
  return (
    <a onClick={(e) => { e.stopPropagation(); openDeviceDetail(sn); }}
       style={{ fontFamily: "var(--font-family-mono)", fontSize: 12.5, fontWeight: 500,
                color: "var(--color-primary-700)", cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 2, textDecorationStyle: "dotted" }}>
      {sn}
    </a>
  );
};
const TerminalTidLink = ({ tid, onOpen }) => (
  <a onClick={(e) => { e.stopPropagation(); onOpen && onOpen(); }}
     style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, fontWeight: 500,
              color: "var(--color-primary-700)", cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 2, textDecorationStyle: "dotted" }}>
    {tid}
  </a>
);

const TerminalsTable = ({ store, merchant }) => {
  const terminals = store.terminals || [];
  const active = terminals.filter((t) => t.state === "active");
  const pending = terminals.filter((t) => t.state === "pending");
  const [vsOpen, setVsOpen] = useStateCM(null); // {merchant, terminal} | null

  return (
    <div className="info-card">
      <div className="info-card__head">
        <div className="info-card__title">
          Payment terminals
          {pending.length > 0 && <span className="tds-tab__count" style={{ marginLeft: 8 }}>{pending.length}</span>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {active.length} active · {pending.length} pending VarSheet
        </div>
      </div>
      {terminals.length === 0 ?
      <div className="empty" style={{ padding: "28px 20px" }}>No terminals bound to this store yet.</div> :

      <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: "26%" }}>Serial (SN)</th>
              <th style={{ width: "22%" }}>VarSheet (TID)</th>
              <th style={{ width: "16%" }}>Model</th>
              <th style={{ width: "18%" }}>State</th>
              <th style={{ width: "18%" }}>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {terminals.map((t, i) =>
          <tr key={i} style={{ cursor: "default" }}>
                <td><TerminalSnLink sn={t.sn} /></td>
                <td><TerminalTidLink tid={t.tid} onOpen={() => setVsOpen(t)} /></td>
                <td><span style={{ fontSize: 12.5 }}>{t.model || <span className="muted">—</span>}</span></td>
                <td><TerminalStatePill state={t.state} /></td>
                <td><span className="muted" style={{ fontSize: 12 }}>{t.lastSeen}</span></td>
              </tr>
          )}
          </tbody>
        </table>
      }
      <VarSheetModal open={!!vsOpen} onClose={() => setVsOpen(null)} vs={vsOpen ? deriveVarSheet(merchant, vsOpen) : null} />
    </div>);

};

// ─── Stores & Terminals tab ────────────────────────────────
const MerchantStoresTab = ({ merchant }) => {
  const stores = merchant.stores || [];
  const [selectedId, setSelectedId] = useStateCM(stores[0]?.id);
  const selected = stores.find((s) => s.id === selectedId) || stores[0];

  if (stores.length === 0) {
    return <div className="empty" style={{ padding: "40px 24px" }}>No stores yet.</div>;
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {stores.length > 1 &&
      <div className="info-card" style={{ padding: 16 }}>
          <StoresStrip stores={stores} selectedId={selected.id} onSelect={setSelectedId} />
        </div>
      }

      {/* Store address row */}
      <div className="info-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Icon name="globe" size={14} />
          <span style={{ fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected?.address || <span className="muted">No address on file</span>}
          </span>
          {selected?.country && <span className="muted" style={{ fontSize: 12 }}>· {selected.country}</span>}
          {selected?.isHQ && <Badge tone="neutral">HQ</Badge>}
        </div>
        <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-family-mono)" }}>{selected?.id}</span>
      </div>

      <TerminalsTable store={selected} merchant={merchant} />
    </div>);

};

// ─── Apps tab — read-only app assignments ──────────────────
// ─── Strategy detail helpers ─────────────────────────────────
// Synthesize a deterministic, plausible per-row strategy payload so the
// detail popover has real-looking content. Two adjacent rows for the same
// merchant should always show the same payload (no flicker between
// re-renders), so we key the hash off appId + versionId.
const _stratHash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff; return h; };
const _TIMING_LABELS = {
  immediate:      { label: "Immediate",                          desc: "Push as soon as the terminal is online." },
  reboot:         { label: "On next reboot",                     desc: "Stage now; apply when the terminal reboots." },
  rebootOrIdle10: { label: "On reboot OR 10 min idle",           desc: "Apply at next reboot, or after 10 minutes of inactivity — whichever happens first." },
};
const _NETWORK_LABELS = {
  any:     { label: "Any network",          desc: "Download over Wi-Fi, Ethernet, or cellular." },
  wired:   { label: "Wired / Wi-Fi only",   desc: "Skip cellular — wait for Wi-Fi or Ethernet." },
  cellCap: { label: "Cellular OK (capped)", desc: "Use cellular if needed, up to the per-terminal cap below." },
};
const _CELL_CAPS = [50, 100, 200, 500, 1000];
function deriveStrategyDetail(row) {
  const h = _stratHash(`${row.appId}:${row.versionId}`);
  if (row.strategy === "Immediate") {
    return { timing: "immediate", network: "any", cellCapMb: null };
  }
  if (row.strategy === "Casual") {
    return { timing: "reboot", network: "any", cellCapMb: null };
  }
  if (row.strategy === "Not set") {
    return null;
  }
  // Custom — deterministic mix
  const timings  = ["immediate", "reboot", "rebootOrIdle10"];
  const networks = ["any", "wired", "cellCap"];
  const timing  = timings[(h >> 3) % timings.length];
  const network = networks[(h >> 5) % networks.length];
  const cellCapMb = network === "cellCap" ? _CELL_CAPS[(h >> 7) % _CELL_CAPS.length] : null;
  return { timing, network, cellCapMb };
}
const _strategyTone = (s) => s === "Not set" ? "neutral" : s === "Immediate" ? "warning" : "info";

// ─── Per-terminal status synthesizer ─────────────────────────
// The admin portal doesn't track per-terminal install state; we synthesize
// a plausible distribution per (terminal.sn, targetVersionLabel) tuple so
// the expanded row tells a coherent story. Buckets:
//   · 78% installed   — on the target version
//   · 12% awaiting    — sitting at one version behind, no command sent yet
//   · 6% downloading  — command sent, mid-download
//   · 4% failed       — error during install
const _TERM_STATES = {
  installed:   { tone: "success", label: "On target" },
  awaiting:    { tone: "neutral", label: "Awaiting upgrade" },
  downloading: { tone: "info",    label: "Downloading" },
  failed:      { tone: "error",   label: "Install failed" },
};
function deriveTerminalStatus(sn, versionLabel) {
  const h = _stratHash(`${sn}:${versionLabel}`);
  const r = h % 100;
  if (r < 78) return "installed";
  if (r < 90) return "awaiting";
  if (r < 96) return "downloading";
  return "failed";
}

// Resolve which store a terminal belongs to (for the "On X · Store Y" cell).
function findStoreOf(merchant, sn) {
  for (const s of (merchant.stores || [])) {
    if ((s.terminals || []).some(t => t.sn === sn)) return s;
  }
  return null;
}

const MerchantAppsTabRO = ({ merchant }) => {
  const apps = merchant.apps || [];
  const allApps = window.APPS || [];
  const rows = apps.map((a) => {
    const app = allApps.find((x) => x.id === a.appId);
    return { ...a, app };
  });
  // The strategy currently being inspected, or null when no popover open.
  const [stratOpen, setStratOpen] = useStateCM(null);
  // Set of appIds currently expanded.
  const [expanded, setExpanded] = useStateCM(new Set());
  const toggleExpand = (appId) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(appId)) next.delete(appId); else next.add(appId);
    return next;
  });
  return (
    <div className="info-card">
      <div className="info-card__head">
        <div>
          <div className="info-card__title">App assignments</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Apps and versions this merchant has been configured to run. Maintained by the ISO operators. Click a row to view per-terminal upgrade status, or a strategy badge for its rollout rules.
          </div>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{rows.length} of {rows.length} apps</span>
      </div>
      {rows.length === 0 ?
      <div className="empty" style={{ padding: "40px 24px" }}>
          No apps assigned to this merchant yet.
        </div> :

      <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: "30px" }}></th>
              <th style={{ width: "32%" }}>App</th>
              <th style={{ width: "16%" }}>Target version</th>
              <th style={{ width: "18%" }}>Upgrade strategy</th>
              <th style={{ width: "14%" }}>Terminals</th>
              <th style={{ width: "18%" }}>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
            const hue = r.app?.iconHue || "#5B7CFA";
            const letter = (r.app?.name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase();
            const isOpen = expanded.has(r.appId);
            return (
              <React.Fragment key={r.appId}>
              <tr style={{ cursor: "pointer" }} onClick={() => toggleExpand(r.appId)}>
                  <td style={{ paddingLeft: 14, color: "var(--color-text-tertiary)" }}>
                    <Icon name={isOpen ? "chevD" : "chevR"} size={12} />
                  </td>
                  <td>
                    <div className="al-app">
                      <div style={{
                      width: 32, height: 32, borderRadius: 7,
                      background: `linear-gradient(135deg, ${hue}, ${hue}cc)`,
                      color: "#fff", display: "grid", placeItems: "center",
                      fontWeight: 600, fontSize: 13
                    }}>{letter}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="al-app__name">{r.app?.name || r.appId}</div>
                        <div className="al-app__pkg">{r.app?.package || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontSize: 12.5, fontWeight: 500 }}>{r.versionLabel}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setStratOpen(r)}
                      title="View strategy details"
                      style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
                      <Badge tone={_strategyTone(r.strategy)} dot>
                        {r.strategy}
                        <Icon name="info" size={11} style={{ marginLeft: 4, opacity: 0.7 }} />
                      </Badge>
                    </button>
                  </td>
                  <td>
                    <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{merchant.terminalsCount || 0}</span>
                  </td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.assignedAt}</span></td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan="6" style={{ padding: 0, background: "var(--color-bg-3)" }}>
                      <ExpandedAppRow row={r} merchant={merchant} />
                    </td>
                  </tr>
                )}
              </React.Fragment>);

          })}
          </tbody>
        </table>
      }

      {/* Strategy detail modal */}
      <Modal
        open={!!stratOpen}
        onClose={() => setStratOpen(null)}
        title={stratOpen ? `Upgrade strategy — ${stratOpen.app?.name || stratOpen.appId}` : ''}
        width={520}
        footer={<Btn variant="secondary" onClick={() => setStratOpen(null)}>Close</Btn>}>
        {stratOpen && <StrategyDetail row={stratOpen} merchant={merchant} />}
      </Modal>
    </div>);

};

// ─── Expanded app row body — read-only per-terminal status ──
const ExpandedAppRow = ({ row, merchant }) => {
  const [vsOpenExp, setVsOpenExp] = useStateCM(null);
  const allTerminals = (merchant.stores || []).flatMap(s =>
    (s.terminals || []).map(t => ({ ...t, store: s }))
  ).filter(t => t.sn);

  // Synthesize per-terminal status against this app's target version.
  const enriched = allTerminals.map(t => ({
    ...t,
    status: deriveTerminalStatus(t.sn, row.versionLabel),
  }));
  const onTarget = enriched.filter(t => t.status === "installed");
  const offTarget = enriched.filter(t => t.status !== "installed");
  const awaiting    = offTarget.filter(t => t.status === "awaiting").length;
  const downloading = offTarget.filter(t => t.status === "downloading").length;
  const failed      = offTarget.filter(t => t.status === "failed").length;

  // Strategy text line: "Custom · On next reboot · Wired/Wi-Fi only" etc.
  const detail = deriveStrategyDetail(row);
  const strategyLine = row.strategy === "Not set"
    ? "No strategy set — terminals will not upgrade until one is applied."
    : [
        row.strategy,
        detail && _TIMING_LABELS[detail.timing]?.label,
        detail && _NETWORK_LABELS[detail.network]?.label + (detail.cellCapMb ? ` · cap ${detail.cellCapMb} MB` : ""),
      ].filter(Boolean).join(" · ");

  const [showOnTarget, setShowOnTarget] = useStateCM(false);

  return (
    <div style={{ padding: "14px 20px 16px 44px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Pending banner */}
      <div style={{
        border: `1px solid ${offTarget.length > 0 ? "oklch(80% 0.10 80)" : "var(--color-border-default)"}`,
        borderRadius: 10, overflow: "hidden",
        background: "var(--color-bg-2)",
      }}>
        <div style={{
          padding: "10px 14px",
          background: offTarget.length > 0 ? "oklch(97% 0.04 80)" : "var(--color-bg-3)",
          borderBottom: "1px solid var(--color-border-subtle)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <Icon name={offTarget.length > 0 ? "info" : "check"} size={14}
            style={{ color: offTarget.length > 0 ? "var(--color-warning-700)" : "var(--color-success-700)" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="num" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em",
              fontFamily: "var(--font-family-mono)",
              color: offTarget.length > 0 ? "var(--color-warning-700)" : "var(--color-text-primary)" }}>
              {offTarget.length}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>
              of {enriched.length} {enriched.length === 1 ? "terminal" : "terminals"} pending upgrade
            </span>
            <span className="muted" style={{ fontSize: 11.5 }}>
              · target <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{row.versionLabel}</span>
            </span>
          </div>
          {offTarget.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {awaiting > 0    && <CMChip n={awaiting}    label="awaiting" />}
              {downloading > 0 && <CMChip n={downloading} label="in flight" tone="info" />}
              {failed > 0      && <CMChip n={failed}      label="failed" tone="error" />}
            </div>
          )}
        </div>

        {offTarget.length === 0 ? (
          <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, color: "var(--color-text-tertiary)", fontSize: 12.5 }}>
            <Icon name="check" size={14}/> All {enriched.length} terminal{enriched.length === 1 ? "" : "s"} on target — nothing pending.
          </div>
        ) : (
          <>
            {/* Strategy summary */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div className="overline" style={{ fontSize: 10.5, color: "var(--color-text-tertiary)", marginBottom: 4 }}>
                How they'll upgrade
              </div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-primary)" }}>
                {strategyLine}
              </div>
            </div>

            {/* Pending terminals list */}
            <table className="tds-table" style={{ background: "transparent" }}>
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Serial (SN)</th>
                  <th style={{ width: "18%" }}>VarSheet (TID)</th>
                  <th style={{ width: "12%" }}>Model</th>
                  <th style={{ width: "22%" }}>Store</th>
                  <th style={{ width: "16%" }}>Status</th>
                  <th style={{ width: "12%" }}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {offTarget.map(t => (
                  <tr key={t.sn} style={{ cursor: "default" }}>
                    <td><TerminalSnLink sn={t.sn} /></td>
                    <td><TerminalTidLink tid={t.tid} onOpen={() => setVsOpenExp(t)} /></td>
                    <td><span style={{ fontSize: 12.5 }}>{t.model || <span className="muted">—</span>}</span></td>
                    <td><span style={{ fontSize: 12.5 }}>{t.store.name}</span></td>
                    <td><Badge tone={_TERM_STATES[t.status].tone} dot>{_TERM_STATES[t.status].label}</Badge></td>
                    <td><span className="muted" style={{ fontSize: 12 }}>{t.lastSeen}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* On-target — collapsed by default */}
      {onTarget.length > 0 && (
        <div style={{ border: "1px solid var(--color-border-default)", borderRadius: 10, overflow: "hidden", background: "var(--color-bg-2)" }}>
          <button onClick={() => setShowOnTarget(s => !s)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", background: "transparent", border: 0,
            cursor: "pointer", textAlign: "left",
          }}>
            <Icon name={showOnTarget ? "chevD" : "chevR"} size={12} />
            <Icon name="check" size={14} style={{ color: "var(--color-success-700)" }} />
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>
              <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{onTarget.length}</span> terminal{onTarget.length === 1 ? "" : "s"} on target
            </span>
            <span className="muted" style={{ fontSize: 11.5, marginLeft: 4 }}>
              Running <span className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{row.versionLabel}</span>
            </span>
          </button>
          {showOnTarget && (
            <table className="tds-table" style={{ background: "transparent" }}>
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Serial (SN)</th>
                  <th style={{ width: "18%" }}>VarSheet (TID)</th>
                  <th style={{ width: "12%" }}>Model</th>
                  <th style={{ width: "22%" }}>Store</th>
                  <th style={{ width: "16%" }}>Status</th>
                  <th style={{ width: "12%" }}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {onTarget.map(t => (
                  <tr key={t.sn} style={{ cursor: "default" }}>
                    <td><TerminalSnLink sn={t.sn} /></td>
                    <td><TerminalTidLink tid={t.tid} onOpen={() => setVsOpenExp(t)} /></td>
                    <td><span style={{ fontSize: 12.5 }}>{t.model || <span className="muted">—</span>}</span></td>
                    <td><span style={{ fontSize: 12.5 }}>{t.store.name}</span></td>
                    <td><Badge tone="success" dot>On target</Badge></td>
                    <td><span className="muted" style={{ fontSize: 12 }}>{t.lastSeen}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <VarSheetModal open={!!vsOpenExp} onClose={() => setVsOpenExp(null)} vs={vsOpenExp ? deriveVarSheet(merchant, vsOpenExp) : null} />
    </div>
  );
};

const CMChip = ({ n, label, tone = "neutral" }) => {
  const colors = {
    neutral: { bg: "var(--color-bg-2)",   fg: "var(--color-text-secondary)", border: "var(--color-border-default)" },
    info:    { bg: "var(--color-info-50, oklch(96% 0.04 230))", fg: "var(--color-info-700, oklch(40% 0.12 230))",  border: "oklch(60% 0.14 230 / 0.3)" },
    error:   { bg: "var(--color-error-50, oklch(96% 0.04 25))", fg: "var(--color-error-700, oklch(40% 0.14 25))",  border: "oklch(58% 0.20 25 / 0.3)" },
  };
  const c = colors[tone] || colors.neutral;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: 11,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
    }}>
      <b className="num" style={{ fontFamily: "var(--font-family-mono)" }}>{n}</b> {label}
    </span>
  );
};

// ─── Strategy detail body — read-only breakdown card ────────
const StrategyDetail = ({ row, merchant }) => {
  const detail = deriveStrategyDetail(row);
  const timing  = detail ? _TIMING_LABELS[detail.timing]   : null;
  const network = detail ? _NETWORK_LABELS[detail.network] : null;
  const isNotSet = row.strategy === "Not set";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header row — strategy name + target version */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px",
        background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)", borderRadius: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="overline" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Strategy</span>
          <Badge tone={_strategyTone(row.strategy)} dot>{row.strategy}</Badge>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="overline" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Target version</div>
          <div className="num" style={{ fontFamily: "var(--font-family-mono)", fontSize: 14, fontWeight: 500, marginTop: 2 }}>{row.versionLabel}</div>
        </div>
      </div>

      {isNotSet ? (
        <div style={{ padding: "14px 16px", border: "1px dashed var(--color-border-default)", borderRadius: 10, fontSize: 13, lineHeight: 1.55, color: "var(--color-text-secondary)" }}>
          No strategy chosen for this app yet. Until the ISO sets one, the default — <strong>Casual</strong> (apply on next reboot, any network) — will be used.
        </div>
      ) : (
        <>
          <CMField label="Timing" value={
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{timing.label}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{timing.desc}</div>
            </div>
          }/>
          <CMField label="Network" value={
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {network.label}
                {detail.cellCapMb != null && (
                  <span className="num" style={{ fontFamily: "var(--font-family-mono)", marginLeft: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>· cap {detail.cellCapMb} MB / terminal</span>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{network.desc}</div>
            </div>
          }/>
          <CMField label="Reach" value={
            <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
              Applies to <span className="num" style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500 }}>{merchant.terminalsCount || 0}</span> terminal{merchant.terminalsCount === 1 ? "" : "s"} across {merchant.stores?.length || 0} store{(merchant.stores?.length || 0) === 1 ? "" : "s"}.
            </div>
          }/>
        </>
      )}

      <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, padding: "10px 12px", background: "var(--color-bg-3)", borderRadius: 8 }}>
        Read-only view. Strategy changes are made by ISO operators in their portal — not by platform admins.
      </div>
    </div>
  );
};

// ─── Contracts tab — read-only contract cards ──────────────
const MerchantContractsTabRO = ({ merchant }) => {
  const contracts = merchant.contracts || [];
  return (
    <div className="info-card">
      <div className="info-card__head">
        <div>
          <div className="info-card__title">Contracts</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            MERCHANT is the base contract — required for any merchant to receive changes. MERCHANT_PORTAL unlocks the self-service operator portal.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {contracts.map((c, i) =>
        <div key={i} style={{ padding: "16px 20px", borderTop: i === 0 ? "0" : "1px solid var(--color-border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-family-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {c.type}
              </div>
              <Badge tone={c.status === "active" ? "success" : "warning"} dot>
                {c.status === "active" ? "Active" : "Disabled"}
              </Badge>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
              {c.description}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 12 }}>
              <CMField label="Granted" value={c.grantedAt} />
              <CMField label="Operator" value={c.operator} />
              <CMField label="Expires" value={c.expiresAt || "No expiry"} />
            </div>
          </div>
        )}
      </div>
    </div>);

};

const CMField = ({ label, value }) =>
<div>
    <div className="overline" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{label}</div>
    <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginTop: 2 }}>{value}</div>
  </div>;


// ─── Merchant detail (read-only drill-in) ──────────────────
const MerchantViewReadonly = ({ merchant, customerName, onBack }) => {
  const [tab, setTab] = useStateCM("stores");
  const tabs = [
  { id: "stores", label: "Stores & Terminals" },
  { id: "apps", label: "Apps" },
  { id: "contracts", label: "Contracts" }];


  return (
    <div>
      {/* Merchant header */}
      <div className="info-card" style={{ padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <MerchantMonogram name={merchant.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{merchant.name}</h2>
              <window.ContractBadge kind="Merchant" />
              <Badge tone={merchant.disabled ? "warning" : "success"} dot>{merchant.disabled ? "Disabled" : "Active"}</Badge>
              <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-family-mono)" }}>· {merchant.mid}</span>
              <span className="muted" style={{ fontSize: 12 }}>· {merchant.country}</span>
            </div>
            {(merchant.tags || []).length > 0 &&
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {merchant.tags.map((t) => <CMTagChip key={t} t={t} />)}
              </div>
            }
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", rowGap: 6, columnGap: 18, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {merchant.stores?.[0]?.address &&
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="globe" size={12} /> {merchant.stores[0].address}
                </span>
              }
              {merchant.phone &&
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 500 }}>TEL</span> {merchant.phoneCountryCode} {merchant.phone}
                </span>
              }
              {merchant.email &&
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="mail" size={12} /> {merchant.email}
                </span>
              }
              {merchant.createdAt && merchant.createdAt !== "—" &&
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="clock" size={12} /> Onboarded {merchant.createdAt}
                </span>
              }
            </div>
            {merchant.notes &&
            <div className="muted" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, maxWidth: 720 }}>
                {merchant.notes}
              </div>
            }
          </div>
          <div style={{ flex: "none" }}>
            <Badge tone="neutral">Read-only · ISO of {customerName}</Badge>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="det-tabs">
        {tabs.map((t) =>
        <button key={t.id} className={`tds-tab ${tab === t.id ? "tds-tab--active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <span className="tds-tab__count">{t.count}</span>}
          </button>
        )}
      </div>

      {tab === "stores" && <MerchantStoresTab merchant={merchant} />}
      {tab === "apps" && <MerchantAppsTabRO merchant={merchant} />}
      {tab === "contracts" && <MerchantContractsTabRO merchant={merchant} />}
    </div>);

};

// ─── Tab entry-point ───────────────────────────────────────
const TabCustomerMerchants = ({ customer, openMerchantId: openIdProp, setOpenMerchantId: setOpenIdProp }) => {
  const [openIdLocal, setOpenIdLocal] = useStateCM(null);
  const openMerchantId = openIdProp !== undefined ? openIdProp : openIdLocal;
  const setOpenMerchantId = setOpenIdProp || setOpenIdLocal;
  const merchants = useMemoCM(() => {
    const fn = window.getMerchantsByIso;
    return fn ? fn(customer.id) : [];
  }, [customer.id]);
  const openMerchant = merchants.find((m) => m.id === openMerchantId);

  if (openMerchant) {
    return (
      <MerchantViewReadonly
        merchant={openMerchant}
        customerName={customer.name}
        onBack={() => setOpenMerchantId(null)} />);


  }
  return <MerchantsList merchants={merchants} onOpen={(m) => setOpenMerchantId(m.id)} />;
};

window.TabCustomerMerchants = TabCustomerMerchants;

// Expose the read-only merchant detail view + supporting bits so the
// top-level Merchants screen (merchants-screen.jsx) can reuse them.
window.MerchantViewReadonly = MerchantViewReadonly;
window.MerchantMonogram     = MerchantMonogram;
window.CMTagChip            = CMTagChip;