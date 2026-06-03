/* global React */
// ─────────────────────────────────────────────────────────────
// Devices · Search redesign
//   方案A 快捷搜索栏 + 下拉 Advanced Sheet   (Spec §4)
//   列预设 Overview/Network/Security/Hardware/Apps (Spec §9.5)
//   方案一 标准数字翻页                         (Spec §10.1)
// Overrides window.DevicesListScreen defined in devices-fleet.jsx.
// ─────────────────────────────────────────────────────────────

(function () {
  const { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } = React;

  // ─── State pill tone (local) ─────────────────────────────
  const DEVICE_STATE = {
    active: { label: "Active", tone: "success" },
    inactive: { label: "Inactive", tone: "neutral" },
    pending: { label: "Pending", tone: "warning" }
  };

  // ─── Last-seen helpers ───────────────────────────────────
  const LAST_SEEN_REF = new Date("2026-05-12T14:30:00");
  function lastSeenMinutes(rel) {
    if (!rel || rel === "never") return Infinity;
    if (/just now/i.test(rel)) return 0;
    const m = rel.match(/(\d+)\s*(min|hour|day|hr|h|d|m)/i);
    if (!m) return Infinity;
    const v = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    if (u.startsWith("d")) return v * 1440;
    if (u.startsWith("h")) return v * 60;
    return v;
  }
  function fmtLastSeen(rel) {
    if (!rel || rel === "never") return "never";
    const mins = lastSeenMinutes(rel);
    if (!isFinite(mins)) return rel;
    const dt = new Date(LAST_SEEN_REF - mins * 60_000);
    const p = (x) => String(x).padStart(2, "0");
    return `${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
  }
  function relLastSeen(rel) {
    if (!rel) return "—";
    if (rel === "never") return "never";
    if (/just now/i.test(rel)) return "just now";
    const m = rel.match(/(\d+)\s*(min|minute|hour|day|hr|h|d|m)/i);
    if (!m) return rel;
    const v = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    if (u.startsWith("d")) return `${v} d ago`;
    if (u.startsWith("h") || u.startsWith("hr")) return `${v} h ago`;
    return `${v} min ago`;
  }

  // ─── Network derivations ─────────────────────────────────
  function primaryNetwork(d) {
    if (d.state === "pending") return "offline";
    if (d.network?.wifi?.enabled) return "wifi";
    if (d.network?.ethernet?.enabled) return "ethernet";
    if (d.network?.sim?.enabled) return "cellular";
    return "offline";
  }
  const NET_LABEL = { wifi: "Wi-Fi", ethernet: "Ethernet", cellular: "Cellular", offline: "Offline" };

  function snSeed(sn) {
    return (sn || "").split("").reduce((a, c) => a * 31 + c.charCodeAt(0) & 0x7fffffff, 0);
  }
  function ipFor(d) {
    const net = primaryNetwork(d);
    if (net === "offline") return null;
    const seed = snSeed(d.sn);
    if (net === "cellular") return `100.64.${(seed >> 4) % 100}.${seed % 254 + 1}`;
    return `192.168.${(seed >> 4) % 100}.${seed % 254 + 1}`;
  }
  function signalFor(d) {
    if (primaryNetwork(d) === "offline") return null;
    return -(45 + snSeed(d.sn) % 40);
  }

  // ─── Column preset table ─────────────────────────────────
  const COLUMN_PRESETS = {
    overview: {
      label: "Overview",
      cols: ["model", "osFirmware", "merchantStore", "lastSeen", "posture"],
      sort: "Last seen ↓",
      desc: "Model · OS/Firmware · Merchant·Store · Last seen · Posture · Status"
    },
    network: {
      label: "Network",
      cols: ["model", "networkType", "carrier", "ssid", "ip", "signal", "lastSeen"],
      sort: "Last seen ↓",
      desc: "Model · Network · Carrier · SSID · IP · Signal · Last seen · Status"
    },
    security: {
      label: "Security",
      cols: ["model", "osFirmware", "merchantStore", "posture", "warnings", "lastSeen"],
      sort: "Posture (at-risk first)",
      desc: "Model · OS/Firmware · Merchant·Store · Posture · Warnings · Last seen · Status"
    },
    hardware: {
      label: "Hardware",
      cols: ["model", "osFirmware", "battery", "batteryHealth", "storage", "imei", "lastSeen"],
      sort: "Storage used ↓",
      desc: "Model · OS/Firmware · Battery · Health · Storage · IMEI / MAC · Last seen · Status"
    },
    apps: {
      label: "Apps",
      cols: ["model", "merchantStore", "appsCount", "topApp", "lastSeen"],
      sort: "Last seen ↓",
      desc: "Model · Merchant·Store · Apps count · Top app · Last seen · Status"
    }
  };

  const COL_LABEL = {
    sn: "Serial number", status: "Status",
    model: "Model", osFirmware: "OS / Firmware",
    merchantStore: "Merchant · Store",
    lastSeen: "Last seen",
    posture: "Posture",
    networkType: "Network", carrier: "Carrier", ssid: "Wi-Fi SSID",
    ip: "IP address", signal: "Signal",
    warnings: "Warnings",
    battery: "Battery", batteryHealth: "Health", storage: "Storage",
    imei: "IMEI / MAC",
    appsCount: "Apps", topApp: "Top app"
  };

  // ─── Cell renderer ───────────────────────────────────────
  function renderCell(key, d) {
    const Pill = window.Pill,Ico = window.Ico;
    const flagged = d.hardware?.root || d.hardware?.devMode ||
    (d.hardware?.securityWarnings || []).length > 0;

    switch (key) {
      case "sn":
        return (
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>
            {d.sn}
          </span>);

      case "model":
        return <span className="mono" style={{ fontSize: 12, color: "var(--fg2)" }}>{d.model}</span>;
      case "osFirmware":
        return (
          <div>
            <div style={{ fontSize: 12.5 }}>{d.os || "—"}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{d.firmware || "—"}</div>
          </div>);

      case "merchantStore":{
          const m = window.findMerchantById?.(d.merchantId);
          const s = m?.stores?.find((x) => x.id === d.storeId);
          if (!m) return <span style={{ color: "var(--fg3)" }}>—</span>;
          return (
            <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--fg1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{m.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--fg3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{s?.name || "—"}</div>
          </div>);

        }
      case "lastSeen":
        return (
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>{fmtLastSeen(d.lastSeenAt)}</div>
            <div style={{ fontSize: 10.5, color: "var(--fg3)" }}>{relLastSeen(d.lastSeenAt)}</div>
          </div>);

      case "posture":
        if (!flagged) return <span style={{ fontSize: 11, color: "var(--fg3)" }}>—</span>;
        return (
          <Pill tone="warning" dot size="sm">
            {d.hardware?.root ? "Rooted" :
            d.hardware?.devMode ? "Dev mode" :
            `${d.hardware.securityWarnings.length} warning${d.hardware.securityWarnings.length === 1 ? "" : "s"}`}
          </Pill>);

      case "warnings":{
          const w = (d.hardware?.securityWarnings || []).length;
          if (w === 0) return <span style={{ fontSize: 11, color: "var(--fg3)" }}>—</span>;
          return <Pill tone="warning" dot size="sm">{w}</Pill>;
        }
      case "networkType":{
          const net = primaryNetwork(d);
          const tone = net === "offline" ? "neutral" : net === "cellular" ? "info" : "success";
          return <Pill tone={tone} dot size="sm">{NET_LABEL[net]}</Pill>;
        }
      case "carrier":
        return d.network?.sim?.enabled ?
        <span style={{ fontSize: 12 }}>{d.network.sim.carrier || "—"}</span> :
        <span style={{ color: "var(--fg3)" }}>—</span>;
      case "ssid":
        return d.network?.wifi?.enabled && d.network.wifi.ssid ?
        <span className="mono" style={{ fontSize: 11, color: "var(--fg2)" }}>{d.network.wifi.ssid}</span> :
        <span style={{ color: "var(--fg3)" }}>—</span>;
      case "ip":{
          const ip = ipFor(d);
          return ip ?
          <span className="mono" style={{ fontSize: 11, color: "var(--fg2)" }}>{ip}</span> :
          <span style={{ color: "var(--fg3)" }}>—</span>;
        }
      case "signal":{
          const s = signalFor(d);
          if (s == null) return <span style={{ color: "var(--fg3)" }}>—</span>;
          const tone = s > -60 ? "var(--color-success-700)" : s > -75 ? "var(--color-warning-700)" : "var(--color-error-700)";
          return <span className="mono" style={{ fontSize: 11, color: tone }}>{s} dBm</span>;
        }
      case "battery":{
          if (!d.battery) return <span style={{ color: "var(--fg3)" }}>—</span>;
          const lvl = d.battery.level;
          const tone = lvl <= 20 ? "var(--color-error-700)" : lvl <= 40 ? "var(--color-warning-700)" : "var(--color-success-700)";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 70 }}>
            <div style={{ width: 36, height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border-1)" }}>
              <div style={{ width: `${lvl}%`, height: "100%", background: tone }} />
            </div>
            <span className="mono" style={{ fontSize: 11, color: tone, fontWeight: 500 }}>{lvl}%</span>
          </div>);

        }
      case "batteryHealth":
        if (!d.battery) return <span style={{ color: "var(--fg3)" }}>—</span>;
        return <span style={{ fontSize: 11.5, color: "var(--fg2)", textTransform: "capitalize" }}>{d.battery.health}</span>;
      case "storage":{
          if (!d.storage) return <span style={{ color: "var(--fg3)" }}>—</span>;
          const pct = Math.round(d.storage.used / d.storage.total * 100);
          const tone = pct >= 90 ? "var(--color-error-700)" : pct >= 75 ? "var(--color-warning-700)" : "var(--fg2)";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
            <div style={{ width: 36, height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border-1)" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
            </div>
            <span className="mono" style={{ fontSize: 11, color: tone }}>{pct}%</span>
          </div>);

        }
      case "imei":
        return (
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--fg2)" }}>{d.imei || <span style={{ color: "var(--fg4)" }}>no IMEI</span>}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg3)" }}>{d.macAddress || "—"}</div>
          </div>);

      case "appsCount":{
          const c = (d.apps || []).length;
          const userApps = (d.apps || []).filter((a) => !a.system).length;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span className="mono num" style={{ fontSize: 13, color: "var(--fg1)", fontWeight: 500 }}>{c}</span>
            <span style={{ fontSize: 10, color: "var(--fg3)" }}>{userApps} user</span>
          </div>);

        }
      case "topApp":{
          const userApps = (d.apps || []).filter((a) => !a.system);
          if (userApps.length === 0) return <span style={{ color: "var(--fg3)" }}>—</span>;
          const top = userApps[0];
          return (
            <div>
            <div style={{ fontSize: 12, color: "var(--fg1)" }}>{top.name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg3)" }}>v{top.version}</div>
          </div>);

        }
      case "status":{
          const st = DEVICE_STATE[d.state] || DEVICE_STATE.inactive;
          return <Pill tone={st.tone} dot size="sm">{st.label}</Pill>;
        }
      default:
        return null;
    }
  }

  // ─── Page-number window (for numeric pager) ──────────────
  function pagerWindow(page, totalPages) {
    // Always show first, last, current ±2, with … between gaps
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("...");
      out.push(sorted[i]);
    }
    return out;
  }

  // ─── Merchant popover (searchable) ───────────────────────
  function MerchantPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const h = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [open]);
    const merchants = window.MERCHANTS || [];
    const filtered = useMemo(() => {
      const n = q.trim().toLowerCase();
      if (!n) return merchants.slice(0, 50);
      return merchants.filter((m) =>
      m.name.toLowerCase().includes(n) || (m.id || "").toLowerCase().includes(n)
      ).slice(0, 50);
    }, [merchants, q]);
    const selected = merchants.find((m) => m.id === value);
    return (
      <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 180 }}>
        <button onClick={() => setOpen((v) => !v)} style={triggerStyle}>
          <window.Ico name="building" size={13} style={{ color: selected ? "var(--color-primary-700)" : "var(--fg3)", flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "var(--fg1)" : "var(--fg3)" }}>
            {selected ? selected.name : "Select merchant"}
          </span>
          {selected &&
          <span onMouseDown={(e) => {e.preventDefault();e.stopPropagation();onChange(null);setQ("");}} title="Clear"
          style={{ display: "grid", placeItems: "center", width: 16, height: 16, borderRadius: 4, color: "var(--fg3)", cursor: "pointer" }}>
              <window.Ico name="x" size={11} />
            </span>
          }
          <window.Ico name="chevd" size={11} style={{ color: "var(--fg3)", flex: "none" }} />
        </button>
        {open &&
        <div style={popoverStyle}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg1)", border: "1px solid var(--border-1)", borderRadius: 6, padding: "5px 8px" }}>
                <window.Ico name="search" size={11} style={{ color: "var(--fg3)" }} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchants"
              style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 12.5 }} />
              </div>
            </div>
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {filtered.length === 0 &&
            <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "var(--fg3)" }}>
                  No matches
                </div>
            }
              {filtered.map((m) => {
              const isOn = value === m.id;
              const devCount = (window.PROD_DEVICES || []).filter((d) => d.merchantId === m.id).length;
              return (
                <div key={m.id} onClick={() => {onChange(m.id);setOpen(false);}}
                style={{
                  padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", background: isOn ? "var(--color-primary-50)" : "transparent",
                  borderLeft: isOn ? "2px solid var(--color-primary-500)" : "2px solid transparent"
                }}
                onMouseEnter={(e) => {if (!isOn) e.currentTarget.style.background = "var(--bg-hover)";}}
                onMouseLeave={(e) => {if (!isOn) e.currentTarget.style.background = "transparent";}}>
                    <window.Ico name="building" size={12} style={{ color: "var(--fg3)" }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg1)" }}>{m.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{devCount} dev</span>
                  </div>);

            })}
            </div>
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--fg3)", borderTop: "1px solid var(--border-1)", background: "var(--bg1)" }}>
              {filtered.length} of {merchants.length} merchants · single-select · clearing merchant clears store
            </div>
          </div>
        }
      </div>);

  }

  // ─── Store popover (cascaded on merchant) ─────────────────
  function StorePicker({ merchantId, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const h = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [open]);

    const merchant = merchantId ? window.findMerchantById?.(merchantId) : null;
    const stores = merchant?.stores || [];
    const filtered = useMemo(() => {
      const n = q.trim().toLowerCase();
      if (!n) return stores;
      return stores.filter((s) => (s.name || "").toLowerCase().includes(n));
    }, [stores, q]);
    const selected = stores.find((s) => s.id === value);
    const disabled = !merchantId;

    return (
      <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 180 }}>
        <button onClick={() => {if (!disabled) setOpen((v) => !v);}} disabled={disabled}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "var(--bg3)" : "var(--bg2)"
        }}>
          <window.Ico name="home" size={13} style={{ color: selected ? "var(--color-primary-700)" : "var(--fg3)", flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "var(--fg1)" : "var(--fg3)" }}>
            {disabled ? "Select a merchant first" : selected ? selected.name : "Select store"}
          </span>
          {selected && !disabled &&
          <span onMouseDown={(e) => {e.preventDefault();e.stopPropagation();onChange(null);}} title="Clear"
          style={{ display: "grid", placeItems: "center", width: 16, height: 16, borderRadius: 4, color: "var(--fg3)", cursor: "pointer" }}>
              <window.Ico name="x" size={11} />
            </span>
          }
          <window.Ico name="chevd" size={11} style={{ color: "var(--fg3)", flex: "none" }} />
        </button>
        {open && !disabled &&
        <div style={popoverStyle}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg1)", border: "1px solid var(--border-1)", borderRadius: 6, padding: "5px 8px" }}>
                <window.Ico name="search" size={11} style={{ color: "var(--fg3)" }} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stores"
              style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 12.5 }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--fg3)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Stores under {merchant.name}
              </div>
            </div>
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {filtered.length === 0 &&
            <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "var(--fg3)" }}>
                  No matching stores
                </div>
            }
              {filtered.map((s) => {
              const isOn = value === s.id;
              const devCount = (window.PROD_DEVICES || []).filter((d) => d.storeId === s.id).length;
              return (
                <div key={s.id} onClick={() => {onChange(s.id);setOpen(false);}}
                style={{
                  padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", background: isOn ? "var(--color-primary-50)" : "transparent",
                  borderLeft: isOn ? "2px solid var(--color-primary-500)" : "2px solid transparent"
                }}
                onMouseEnter={(e) => {if (!isOn) e.currentTarget.style.background = "var(--bg-hover)";}}
                onMouseLeave={(e) => {if (!isOn) e.currentTarget.style.background = "transparent";}}>
                    <window.Ico name="home" size={12} style={{ color: "var(--fg3)" }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg1)" }}>{s.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{devCount} dev</span>
                  </div>);

            })}
            </div>
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--fg3)", borderTop: "1px solid var(--border-1)", background: "var(--bg1)" }}>
              {filtered.length} of {stores.length} stores · picking a store doesn't query — click Search to apply
            </div>
          </div>
        }
      </div>);

  }

  // ─── Field / Section atoms ───────────────────────────────
  const Field = ({ label, children, span }) =>
  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fg3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>;


  const SectionHeader = ({ children }) =>
  <div style={{
    fontFamily: "var(--font-family-mono, ui-monospace)",
    fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
    color: "var(--color-primary-700)", textTransform: "uppercase",
    marginBottom: 10, marginTop: 4
  }}>{children}</div>;


  const Check = ({ on, onClick, children }) =>
  <button onClick={onClick} type="button" style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px 4px 6px", borderRadius: 6,
    border: `1px solid ${on ? "var(--color-primary-500)" : "var(--border-2)"}`,
    background: on ? "var(--color-primary-50)" : "var(--bg2)",
    color: on ? "var(--color-primary-700)" : "var(--fg2)",
    fontSize: 12, cursor: "pointer", lineHeight: 1.4
  }}>
      <span style={{
      width: 14, height: 14, borderRadius: 3,
      border: `1.5px solid ${on ? "var(--color-primary-500)" : "var(--border-2)"}`,
      background: on ? "var(--color-primary-500)" : "var(--bg2)",
      display: "grid", placeItems: "center", color: "#fff"
    }}>
        {on && <window.Ico name="check" size={9} stroke={3} />}
      </span>
      {children}
    </button>;


  const Segmented = ({ value, onChange, options }) =>
  <div style={{ display: "inline-flex", padding: 2, background: "var(--bg3)", borderRadius: 7, border: "1px solid var(--border-1)" }}>
      {options.map((o) => {
      const on = value === o.value;
      return (
        <button key={o.value} type="button" onClick={() => onChange(on ? null : o.value)} style={{
          padding: "4px 10px", borderRadius: 5, border: 0, background: on ? "var(--bg2)" : "transparent",
          boxShadow: on ? "var(--shadow-1)" : "none", fontSize: 12,
          color: on ? "var(--color-primary-700)" : "var(--fg2)", fontWeight: on ? 600 : 500, cursor: "pointer"
        }}>{o.label}</button>);

    })}
    </div>;


  const ChipMulti = ({ values, options, onChange, placeholder }) =>
  <div style={{
    display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
    padding: "5px 8px", background: "var(--bg2)", border: "1px solid var(--border-2)",
    borderRadius: 7, minHeight: 32
  }}>
      {values.length === 0 &&
    <span style={{ fontSize: 12, color: "var(--fg4)" }}>{placeholder}</span>
    }
      {options.map((o) => {
      const on = values.includes(o);
      if (!on) return null;
      return (
        <span key={o} style={chipOnStyle}>
            {o}
            <span onClick={() => onChange(values.filter((v) => v !== o))} style={{ cursor: "pointer", display: "inline-grid", placeItems: "center" }}>
              <window.Ico name="x" size={9} stroke={2} />
            </span>
          </span>);

    })}
      {options.filter((o) => !values.includes(o)).map((o) =>
    <span key={o} onClick={() => onChange([...values, o])} style={chipOffStyle}>+ {o}</span>
    )}
    </div>;


  // ─── Advanced Sheet ──────────────────────────────────────
  const ALL_MODELS = ["N950", "N750", "N750P", "N750K", "S90", "S60", "S30", "X800"];
  const NETWORKS = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "ethernet", label: "Ethernet" },
  { value: "cellular", label: "Cellular" },
  { value: "offline", label: "Offline" }];

  const LAST_SEEN_BUCKETS = [
  { value: "5m", label: "5 m" },
  { value: "1h", label: "1 h" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 d" },
  { value: "never", label: "Never" }];


  function AdvancedSheet({ open, draft, setDraft, onClose, onApply, estimatedCount }) {
    if (!open) return null;
    const upd = (k, v) => setDraft({ ...draft, [k]: v });
    return (
      <section style={{
        background: "var(--bg2)",
        borderTop: "1px solid var(--color-primary-500)",
        borderBottom: "1px solid var(--border-2)",
        boxShadow: "0 18px 32px -12px oklch(0% 0 0 / 0.18)"
      }}>
        <div style={{
          padding: "14px 24px 12px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid var(--border-1)",
          background: "linear-gradient(180deg, var(--color-primary-50) 0%, var(--bg2) 100%)"
        }}>
          <window.Ico name="filter" size={14} style={{ color: "var(--color-primary-700)" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg1)" }}>Advanced filters</div>
            <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 2 }}>
              Full-width drop-down · all filters AND · click Apply &amp; Search to apply · closing keeps the draft
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--bg2)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--fg2)" }}
          title="Close (Esc)">
            <window.Ico name="x" size={12} />
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Identity */}
          <SectionHeader>Identity</SectionHeader>
          <div style={advGrid}>
            <Field label="Model · multi-select" span={2}>
              <ChipMulti values={draft.models} options={ALL_MODELS}
              onChange={(v) => upd("models", v)} placeholder="Tap a chip below to add a model" />
            </Field>
            <Field label="OS">
              <select value={draft.os} onChange={(e) => upd("os", e.target.value)} style={inputStyle}>
                <option value="">Any OS</option>
                <option value="Android 14">Android 14</option>
                <option value="Android 13">Android 13</option>
                <option value="Android 12">Android 12</option>
              </select>
            </Field>
            <Field label="Firmware · operator">
              <div style={{ display: "flex", gap: 6 }}>
                <select value={draft.firmwareOp} onChange={(e) => upd("firmwareOp", e.target.value)} style={{ ...inputStyle, width: 60 }}>
                  <option value="le">≤</option>
                  <option value="eq">=</option>
                  <option value="ge">≥</option>
                </select>
                <input value={draft.firmware} onChange={(e) => upd("firmware", e.target.value)}
                placeholder="TOMS 8.2.0" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </Field>
            <Field label="IMEI / MAC · paste multiple" span={2}>
              <input value={draft.imei} onChange={(e) => upd("imei", e.target.value)}
              placeholder="Paste multiple values — comma- or newline-separated" style={inputStyle} />
            </Field>
          </div>

          <div style={dividerStyle} />

          {/* Status */}
          <SectionHeader>Status</SectionHeader>
          <div style={advGrid}>
            <Field label="Status">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["active", "inactive", "pending"].map((s) =>
                <Check key={s} on={draft.statuses.includes(s)} onClick={() =>
                upd("statuses", draft.statuses.includes(s) ? draft.statuses.filter((x) => x !== s) : [...draft.statuses, s])
                }>{DEVICE_STATE[s].label}</Check>
                )}
              </div>
            </Field>
            <Field label="Last seen">
              <Segmented value={draft.lastSeen} onChange={(v) => upd("lastSeen", v)} options={LAST_SEEN_BUCKETS} />
            </Field>
            <Field label="Activated">
              <select value={draft.activated} onChange={(e) => upd("activated", e.target.value)} style={inputStyle}>
                <option value="">Any time</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
              </select>
            </Field>
          </div>

          <div style={dividerStyle} />

          {/* Network */}
          <SectionHeader>Network</SectionHeader>
          <div style={advGrid}>
            <Field label="Primary network">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {NETWORKS.map((n) =>
                <Check key={n.value} on={draft.networks.includes(n.value)} onClick={() =>
                upd("networks", draft.networks.includes(n.value) ? draft.networks.filter((x) => x !== n.value) : [...draft.networks, n.value])
                }>{n.label}</Check>
                )}
              </div>
            </Field>
            <Field label="Carrier">
              <ChipMulti values={draft.carriers} options={["Bell", "Telus", "Rogers", "Freedom"]}
              onChange={(v) => upd("carriers", v)} placeholder="Any carrier" />
            </Field>
            <Field label="Wi-Fi SSID">
              <input value={draft.ssid} onChange={(e) => upd("ssid", e.target.value)}
              placeholder="e.g. TOMS-Public" style={inputStyle} />
            </Field>
            <Field label="IP / CIDR">
              <input value={draft.ipCidr} onChange={(e) => upd("ipCidr", e.target.value)}
              placeholder="192.168.1.0/24" className="mono" style={{ ...inputStyle, fontFamily: "var(--font-mono, ui-monospace)" }} />
            </Field>
          </div>

          <div style={dividerStyle} />

          {/* Posture */}
          <SectionHeader>Posture (hardware / security)</SectionHeader>
          <div style={advGrid}>
            <Field label="Security flags">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Check on={draft.rooted} onClick={() => upd("rooted", !draft.rooted)}>Rooted</Check>
                <Check on={draft.devMode} onClick={() => upd("devMode", !draft.devMode)}>Dev mode</Check>
                <Check on={draft.warnings} onClick={() => upd("warnings", !draft.warnings)}>Warnings</Check>
              </div>
            </Field>
            <Field label="Battery level (%)">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={draft.batteryMin} onChange={(e) => upd("batteryMin", e.target.value)}
                placeholder="0" className="mono" style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: "var(--fg3)" }}>–</span>
                <input value={draft.batteryMax} onChange={(e) => upd("batteryMax", e.target.value)}
                placeholder="100" className="mono" style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: "var(--fg3)", fontSize: 11.5 }}>%</span>
              </div>
            </Field>
            <Field label="Battery health">
              <select value={draft.batteryHealth} onChange={(e) => upd("batteryHealth", e.target.value)} style={inputStyle}>
                <option value="">Any</option>
                <option value="new">new</option>
                <option value="good">good</option>
                <option value="fair">fair</option>
                <option value="poor">poor</option>
              </select>
            </Field>
            <Field label="Storage used (%)">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={draft.storageMin} onChange={(e) => upd("storageMin", e.target.value)}
                placeholder="0" className="mono" style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: "var(--fg3)" }}>–</span>
                <input value={draft.storageMax} onChange={(e) => upd("storageMax", e.target.value)}
                placeholder="100" className="mono" style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: "var(--fg3)", fontSize: 11.5 }}>%</span>
              </div>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "1px solid var(--border-1)",
          display: "flex", gap: 10, alignItems: "center", background: "var(--bg2)"
        }}>
          <button onClick={() => setDraft(emptyAdvanced())}
          style={ghostBtnStyle}>↺ Reset</button>
          <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>
            Estimated match: <strong className="mono num" style={{ color: "var(--color-primary-700)" }}>~{estimatedCount}</strong> devices
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onApply} style={primaryBtnStyle}>
            <window.Ico name="search" size={12} />
            Apply &amp; Search
          </button>
        </div>
      </section>);

  }

  // ─── Empty advanced filter shape ─────────────────────────
  function emptyAdvanced() {
    return {
      models: [], os: "", firmwareOp: "le", firmware: "", imei: "",
      statuses: [], lastSeen: null, activated: "",
      networks: [], carriers: [], ssid: "", ipCidr: "",
      rooted: false, devMode: false, warnings: false,
      batteryMin: "", batteryMax: "", batteryHealth: "",
      storageMin: "", storageMax: ""
    };
  }
  function emptyQuick() {
    return { sn: "", merchantId: null, storeId: null };
  }

  // ─── Available column catalog (for Manage Columns drawer) ─
  // 22 columns grouped by intent. SN + Status are locked-on
  // anchors per L-01 / L-02; everything else is user-toggleable.
  const AVAILABLE_COLUMNS = [
  { group: "Identity", cols: [
    { key: "sn", label: "Serial number", locked: "left", minWidth: 180 },
    { key: "model", label: "Model", minWidth: 80 },
    { key: "osFirmware", label: "OS / Firmware", minWidth: 140 },
    { key: "imei", label: "IMEI / MAC", minWidth: 160 }]
  },
  { group: "Customer", cols: [
    { key: "merchantStore", label: "Merchant · Store", minWidth: 180 }]
  },
  { group: "Status", cols: [
    { key: "lastSeen", label: "Last seen", minWidth: 110 },
    { key: "posture", label: "Posture", minWidth: 110 },
    { key: "warnings", label: "Warnings", minWidth: 90 },
    { key: "status", label: "Status", locked: "right", minWidth: 100 }]
  },
  { group: "Network", cols: [
    { key: "networkType", label: "Network type", minWidth: 100 },
    { key: "carrier", label: "Carrier", minWidth: 90 },
    { key: "ssid", label: "Wi-Fi SSID", minWidth: 140 },
    { key: "ip", label: "IP address", minWidth: 130 },
    { key: "signal", label: "Signal", minWidth: 90 }]
  },
  { group: "Hardware", cols: [
    { key: "battery", label: "Battery", minWidth: 100 },
    { key: "batteryHealth", label: "Battery health", minWidth: 90 },
    { key: "storage", label: "Storage used", minWidth: 110 }]
  },
  { group: "Apps", cols: [
    { key: "appsCount", label: "Apps count", minWidth: 80 },
    { key: "topApp", label: "Top user app", minWidth: 140 }]
  }];

  const LOCKED_LEFT_COLS = AVAILABLE_COLUMNS.flatMap((g) => g.cols.filter((c) => c.locked === "left")).map((c) => c.key);
  const LOCKED_RIGHT_COLS = AVAILABLE_COLUMNS.flatMap((g) => g.cols.filter((c) => c.locked === "right")).map((c) => c.key);

  // ─── Saved Views (mock data) ─────────────────────────────
  // Each saved view bundles filters + preset (+ optional custom cols)
  // per R-06. In a real impl these would be persisted server-side and
  // optionally shared with the team. Here we hard-code four to show
  // the affordance.
  function buildSavedViews() {
    const base = emptyAdvanced();
    return [
    { id: "sv-mine", name: "My terminals", owner: "personal", isDefault: true,
      chips: ["Mine", "Last 24h"],
      quick: emptyQuick(), advanced: { ...base, lastSeen: "24h" },
      preset: "overview" },
    { id: "sv-offline", name: "Offline > 24h", owner: "personal",
      chips: ["lastSeen ≤ 7d", "Inactive"],
      quick: emptyQuick(), advanced: { ...base, statuses: ["inactive"], lastSeen: "7d" },
      preset: "network" },
    { id: "sv-pending", name: "Pending activation", owner: "personal",
      chips: ["Pending"],
      quick: emptyQuick(), advanced: { ...base, statuses: ["pending"] },
      preset: "overview" },
    { id: "sv-sec", name: "Security flagged", owner: "team", shared: true,
      chips: ["Warnings", "Rooted"],
      quick: emptyQuick(), advanced: { ...base, warnings: true, rooted: true },
      preset: "security" }];

  }

  // ─── Saved Views popover ─────────────────────────────────
  function SavedViewsPopover({ anchor, activeId, onApply, onClose, onSaveCurrent }) {
    const ref = useRef(null);
    const [hoverId, setHoverId] = useState(null);
    const views = useMemo(() => buildSavedViews(), []);
    useEffect(() => {
      const h = (e) => {
        if (ref.current && !ref.current.contains(e.target) && !anchor.current?.contains(e.target)) onClose();
      };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [onClose, anchor]);

    return (
      <div ref={ref} style={{
        position: "absolute", top: 44, right: 0, width: 340, zIndex: 50,
        background: "var(--bg2)", border: "1px solid var(--border-2)",
        borderRadius: 8, boxShadow: "0 14px 36px -8px oklch(0% 0 0 / 0.18)",
        overflow: "hidden"
      }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--border-1)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg1)" }}>Saved views</div>
          <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 2 }}>
            Quick recipes that bundle filters + columns + sort (R-06)
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {views.map((v) => {
            const isActive = v.id === activeId;
            const isHover = hoverId === v.id;
            return (
              <div key={v.id}
              onMouseEnter={() => setHoverId(v.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onApply(v)}
              style={{
                padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4,
                cursor: "pointer",
                background: isActive ? "var(--color-primary-50)" : isHover ? "var(--bg-hover)" : "transparent",
                borderLeft: isActive ? "2px solid var(--color-primary-500)" : "2px solid transparent",
                borderBottom: "1px solid var(--border-1)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {v.isDefault && <window.Ico name="check" size={11} style={{ color: "var(--color-primary-700)" }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>{v.name}</span>
                  {v.shared &&
                  <span style={{
                    fontSize: 9.5, padding: "1px 5px", borderRadius: 4,
                    background: "var(--bg3)", color: "var(--fg3)",
                    fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase"
                  }}>Team</span>
                  }
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: "var(--fg3)" }}>
                    {COLUMN_PRESETS[v.preset]?.label || "Custom"} cols
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {v.chips.map((c) =>
                  <span key={c} style={{
                    fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
                    background: "var(--bg3)", color: "var(--fg2)"
                  }}>{c}</span>
                  )}
                </div>
              </div>);

          })}
        </div>
        <div style={{
          padding: "8px 10px", borderTop: "1px solid var(--border-1)",
          display: "flex", alignItems: "center", gap: 6, background: "var(--bg1)"
        }}>
          <button onClick={onSaveCurrent} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 9px", border: 0, borderRadius: 6,
            background: "transparent", color: "var(--color-primary-700)",
            fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>
            <window.Ico name="plus" size={11} />
            Save current as view…
          </button>
          <div style={{ flex: 1 }} />
          <button style={{
            padding: "5px 9px", border: 0, borderRadius: 6,
            background: "transparent", color: "var(--fg3)", fontSize: 11.5, cursor: "pointer"
          }}>Manage views</button>
        </div>
      </div>);

  }

  // ─── Manage Columns drawer ───────────────────────────────
  // Right-side drawer listing the 22 selectable columns. SN/Status
  // are locked-on (★). Apply → cols become the active "Custom" preset.
  function ManageColumnsDrawer({ open, baseLabel, initialCols, onClose, onApply, mode }) {
    // mode: "custom" (create new) | "manage" (edit current cols)
    const [draft, setDraft] = useState(initialCols || []);
    const [customName, setCustomName] = useState(
      mode === "custom" ? "My custom view" : baseLabel + " (modified)"
    );
    // Re-init when reopening with different base
    useEffect(() => {
      if (open) {
        setDraft(initialCols || []);
        setCustomName(mode === "custom" ? "My custom view" : baseLabel + " (modified)");
      }
    }, [open, mode, baseLabel, initialCols && initialCols.join(",")]);

    if (!open) return null;

    const toggle = (key) => {
      if (LOCKED_LEFT_COLS.includes(key) || LOCKED_RIGHT_COLS.includes(key)) return;
      setDraft((d) => d.includes(key) ? d.filter((k) => k !== key) : [...d, key]);
    };
    const move = (key, dir) => {
      setDraft((d) => {
        const i = d.indexOf(key);
        if (i < 0) return d;
        const j = i + dir;
        if (j < 0 || j >= d.length) return d;
        const out = [...d];
        [out[i], out[j]] = [out[j], out[i]];
        return out;
      });
    };

    const selectedCount = draft.length + LOCKED_LEFT_COLS.length + LOCKED_RIGHT_COLS.length;

    return (
      <>
        {/* Backdrop */}
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "oklch(0% 0 0 / 0.32)", zIndex: 80
        }} />
        {/* Drawer */}
        <aside style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 440, zIndex: 81,
          background: "var(--bg2)", borderLeft: "1px solid var(--border-2)",
          boxShadow: "-18px 0 48px oklch(0% 0 0 / 0.16)",
          display: "flex", flexDirection: "column"
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <window.Ico name="settings" size={14} style={{ color: "var(--color-primary-700)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg1)" }}>
                  {mode === "custom" ? "Create custom view" : "Manage columns"}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 2 }}>
                  {selectedCount} of 22 columns selected · SN & Status fixed (★)
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-2)",
                background: "var(--bg2)", display: "grid", placeItems: "center",
                cursor: "pointer", color: "var(--fg2)"
              }} title="Close (Esc)">
                <window.Ico name="x" size={12} />
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{
                fontSize: 10.5, fontWeight: 600, color: "var(--fg3)",
                letterSpacing: "0.06em", textTransform: "uppercase"
              }}>View name</label>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)}
              style={{
                marginTop: 4, width: "100%", height: 32, padding: "0 10px",
                fontSize: 13, border: "1px solid var(--border-2)", borderRadius: 6,
                background: "var(--bg2)", outline: "none", color: "var(--fg1)"
              }} />
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
            {AVAILABLE_COLUMNS.map((g) =>
            <div key={g.group} style={{ marginBottom: 10 }}>
                <div style={{
                padding: "8px 12px 6px", fontSize: 10.5, fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--color-primary-700)", fontFamily: "var(--font-mono, ui-monospace)"
              }}>{g.group}</div>
                {g.cols.map((c) => {
                const isLocked = !!c.locked;
                const isOn = isLocked || draft.includes(c.key);
                const orderIdx = draft.indexOf(c.key);
                return (
                  <div key={c.key} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 12px", borderRadius: 6,
                    background: isOn ? "var(--color-primary-50)" : "transparent",
                    cursor: isLocked ? "not-allowed" : "pointer"
                  }}
                  onClick={() => !isLocked && toggle(c.key)}>
                      <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `1.5px solid ${isOn ? "var(--color-primary-500)" : "var(--border-2)"}`,
                      background: isOn ? "var(--color-primary-500)" : "var(--bg2)",
                      display: "grid", placeItems: "center", color: "#fff", flex: "none",
                      opacity: isLocked ? 0.85 : 1
                    }}>
                        {isOn && <window.Ico name="check" size={10} stroke={3} />}
                      </span>
                      <span style={{ flex: 1, fontSize: 12.5, color: isOn ? "var(--fg1)" : "var(--fg2)" }}>
                        {c.label}
                        {isLocked &&
                      <span style={{
                        marginLeft: 6, fontSize: 9.5, padding: "1px 5px", borderRadius: 4,
                        background: "var(--color-primary-100, var(--color-primary-50))",
                        color: "var(--color-primary-700)", fontWeight: 600,
                        letterSpacing: "0.04em", textTransform: "uppercase"
                      }}>{c.locked === "left" ? "Fixed ←" : "Fixed →"}</span>
                      }
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--fg4)" }}>
                        min {c.minWidth}px
                      </span>
                      {!isLocked && isOn &&
                    <div style={{ display: "flex", gap: 2 }}>
                          <button onClick={(e) => {e.stopPropagation();move(c.key, -1);}}
                      disabled={orderIdx <= 0}
                      style={{
                        width: 22, height: 22, borderRadius: 4, border: 0,
                        background: "var(--bg2)", cursor: orderIdx <= 0 ? "not-allowed" : "pointer",
                        opacity: orderIdx <= 0 ? 0.3 : 1, display: "grid", placeItems: "center",
                        color: "var(--fg3)"
                      }} title="Move up">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"><path d="m6 15 6-6 6 6" /></svg>
                          </button>
                          <button onClick={(e) => {e.stopPropagation();move(c.key, +1);}}
                      disabled={orderIdx === draft.length - 1 || orderIdx < 0}
                      style={{
                        width: 22, height: 22, borderRadius: 4, border: 0,
                        background: "var(--bg2)",
                        cursor: orderIdx === draft.length - 1 || orderIdx < 0 ? "not-allowed" : "pointer",
                        opacity: orderIdx === draft.length - 1 || orderIdx < 0 ? 0.3 : 1,
                        display: "grid", placeItems: "center", color: "var(--fg3)"
                      }} title="Move down">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                          </button>
                        </div>
                    }
                    </div>);

              })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "12px 16px", borderTop: "1px solid var(--border-1)",
            display: "flex", gap: 10, alignItems: "center", background: "var(--bg2)"
          }}>
            <button onClick={() => setDraft(initialCols || [])} style={ghostBtnStyle}>↺ Reset</button>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button onClick={() => onApply(draft, customName)} style={{
              ...primaryBtnStyle, height: 32, padding: "0 14px", fontSize: 12.5
            }}>
              Apply
            </button>
          </div>
        </aside>
      </>);

  }


  // ─── Filter logic ────────────────────────────────────────
  function matchesQuick(d, q) {
    if (q.sn) {
      const tokens = q.sn.split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase());
      if (tokens.length > 0 && !tokens.some((t) => d.sn.toLowerCase().includes(t))) return false;
    }
    if (q.merchantId && d.merchantId !== q.merchantId) return false;
    if (q.storeId && d.storeId !== q.storeId) return false;
    return true;
  }
  function matchesAdvanced(d, a) {
    if (a.models.length > 0 && !a.models.includes(d.model)) return false;
    if (a.os && d.os !== a.os) return false;
    if (a.statuses.length > 0 && !a.statuses.includes(d.state)) return false;
    if (a.lastSeen) {
      const m = lastSeenMinutes(d.lastSeenAt);
      const limit = a.lastSeen === "5m" ? 5 : a.lastSeen === "1h" ? 60 : a.lastSeen === "24h" ? 1440 : a.lastSeen === "7d" ? 10080 : null;
      if (a.lastSeen === "never") {if (isFinite(m)) return false;} else
      if (limit && m > limit) return false;
    }
    if (a.networks.length > 0 && !a.networks.includes(primaryNetwork(d))) return false;
    if (a.carriers.length > 0) {
      if (!d.network?.sim?.enabled || !a.carriers.includes(d.network.sim.carrier)) return false;
    }
    if (a.ssid && !(d.network?.wifi?.ssid || "").toLowerCase().includes(a.ssid.toLowerCase())) return false;
    if (a.rooted && !d.hardware?.root) return false;
    if (a.devMode && !d.hardware?.devMode) return false;
    if (a.warnings && (d.hardware?.securityWarnings || []).length === 0) return false;
    if (a.batteryHealth && d.battery?.health !== a.batteryHealth) return false;
    if (a.batteryMin !== "" && a.batteryMin != null && (d.battery?.level ?? 100) < +a.batteryMin) return false;
    if (a.batteryMax !== "" && a.batteryMax != null && (d.battery?.level ?? 0) > +a.batteryMax) return false;
    if (a.storageMin !== "" || a.storageMax !== "") {
      const pct = d.storage ? Math.round(d.storage.used / d.storage.total * 100) : null;
      if (pct == null) return false;
      if (a.storageMin !== "" && pct < +a.storageMin) return false;
      if (a.storageMax !== "" && pct > +a.storageMax) return false;
    }
    return true;
  }

  // Count active advanced filters (for the Advanced badge)
  function advancedActiveCount(a) {
    let n = 0;
    if (a.models.length > 0) n++;
    if (a.os) n++;
    if (a.firmware) n++;
    if (a.imei) n++;
    if (a.statuses.length > 0) n++;
    if (a.lastSeen) n++;
    if (a.activated) n++;
    if (a.networks.length > 0) n++;
    if (a.carriers.length > 0) n++;
    if (a.ssid) n++;
    if (a.ipCidr) n++;
    if (a.rooted) n++;
    if (a.devMode) n++;
    if (a.warnings) n++;
    if (a.batteryHealth) n++;
    if (a.batteryMin || a.batteryMax) n++;
    if (a.storageMin || a.storageMax) n++;
    return n;
  }

  // Render the active chips row (from APPLIED state)
  function ActiveChips({ quick, advanced, onRemove, onClearAll }) {
    const chips = [];
    if (quick.sn) chips.push({ k: "sn", label: `SN: ${quick.sn}` });
    if (quick.merchantId) {
      const m = window.findMerchantById?.(quick.merchantId);
      chips.push({ k: "merchantId", label: `Merchant: ${m?.name || quick.merchantId}` });
    }
    if (quick.storeId) {
      const m = window.findMerchantById?.(quick.merchantId);
      const s = m?.stores?.find((x) => x.id === quick.storeId);
      chips.push({ k: "storeId", label: `Store: ${s?.name || quick.storeId}` });
    }
    if (advanced.models.length) chips.push({ k: "adv:models", label: `Model: ${advanced.models.join(", ")}` });
    if (advanced.os) chips.push({ k: "adv:os", label: `OS: ${advanced.os}` });
    if (advanced.statuses.length) chips.push({ k: "adv:statuses", label: `Status: ${advanced.statuses.join(", ")}` });
    if (advanced.lastSeen) chips.push({ k: "adv:lastSeen", label: `Last seen ≤ ${advanced.lastSeen}` });
    if (advanced.networks.length) chips.push({ k: "adv:networks", label: `Network: ${advanced.networks.map((n) => NET_LABEL[n]).join(", ")}` });
    if (advanced.carriers.length) chips.push({ k: "adv:carriers", label: `Carrier: ${advanced.carriers.join(", ")}` });
    if (advanced.ssid) chips.push({ k: "adv:ssid", label: `SSID: ${advanced.ssid}` });
    if (advanced.rooted) chips.push({ k: "adv:rooted", label: "Rooted" });
    if (advanced.devMode) chips.push({ k: "adv:devMode", label: "Dev mode" });
    if (advanced.warnings) chips.push({ k: "adv:warnings", label: "Has warnings" });
    if (advanced.batteryHealth) chips.push({ k: "adv:batteryHealth", label: `Battery: ${advanced.batteryHealth}` });
    if (advanced.batteryMin || advanced.batteryMax) chips.push({ k: "adv:battery", label: `Battery ${advanced.batteryMin || 0}–${advanced.batteryMax || 100}%` });
    if (advanced.storageMin || advanced.storageMax) chips.push({ k: "adv:storage", label: `Storage ${advanced.storageMin || 0}–${advanced.storageMax || 100}%` });

    if (chips.length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "0 0 6px" }}>
        <span style={{ fontSize: 10.5, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          Active filters
        </span>
        {chips.map((c) =>
        <span key={c.k} style={chipOnStyle}>
            {c.label}
            <span onClick={() => onRemove(c.k)} style={{ cursor: "pointer", display: "inline-grid", placeItems: "center" }}>
              <window.Ico name="x" size={9} stroke={2.4} />
            </span>
          </span>
        )}
        <button onClick={onClearAll} style={{
          fontSize: 11.5, color: "var(--color-error-700)", background: "transparent",
          border: 0, cursor: "pointer", padding: "2px 6px", fontWeight: 500
        }}>Clear all</button>
      </div>);

  }

  // ─── Main screen ─────────────────────────────────────────
  function DevicesListScreen({ navigate }) {
    const all = window.PROD_DEVICES || [];

    // Pending (in-edit) vs Applied (queried). Search button promotes pending→applied.
    const [pendingQuick, setPendingQuick] = useState(emptyQuick());
    const [pendingAdvanced, setPendingAdvanced] = useState(emptyAdvanced());
    const [appliedQuick, setAppliedQuick] = useState(emptyQuick());
    const [appliedAdvanced, setAppliedAdvanced] = useState(emptyAdvanced());

    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [preset, setPreset] = useState("overview");
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // Saved views + column manager state (R-06, §9.5)
    const [savedViewsOpen, setSavedViewsOpen] = useState(false);
    const [activeSavedViewId, setActiveSavedViewId] = useState(null);
    const [manageColsOpen, setManageColsOpen] = useState(false);
    const [manageMode, setManageMode] = useState("manage"); // "manage" | "custom"
    const [customCols, setCustomCols] = useState(null); // null | string[]
    const [customLabel, setCustomLabel] = useState("Custom");
    const savedViewsBtnRef = useRef(null);

    // ── Sticky-stack measurement (toolbar / preset tabs / desc) ──
    // Four sticky bands stack at the top of the scroll viewport:
    //   ① toolbar (search + chips)        top: 0
    //   ② preset tabs                     top: toolbarH
    //   ③ description strip               top: toolbarH + tabsH
    //   ④ <thead>                         top: toolbarH + tabsH + descH
    // Heights vary (chips row toggles, tabs/desc wrap on narrow viewports),
    // so we measure each band live with ResizeObserver.
    const toolbarRef = useRef(null);
    const tabsRef = useRef(null);
    const descRef = useRef(null);
    const [offsets, setOffsets] = useState({ toolbar: 0, tabs: 0, desc: 0 });
    useLayoutEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const measure = () => {
        setOffsets({
          toolbar: toolbarRef.current?.offsetHeight || 0,
          tabs: tabsRef.current?.offsetHeight || 0,
          desc: descRef.current?.offsetHeight || 0
        });
      };
      const ro = new ResizeObserver(measure);
      if (toolbarRef.current) ro.observe(toolbarRef.current);
      if (tabsRef.current) ro.observe(tabsRef.current);
      if (descRef.current) ro.observe(descRef.current);
      measure();
      return () => ro.disconnect();
    }, []);
    const tabsTop = offsets.toolbar;
    const descTop = offsets.toolbar + offsets.tabs;
    const theadTop = offsets.toolbar + offsets.tabs + offsets.desc;

    // Auto-clear store when merchant changes
    useEffect(() => {
      if (pendingQuick.merchantId !== appliedQuick.merchantId) return;
    }, [pendingQuick.merchantId, appliedQuick.merchantId]);

    // Filter (applied)
    const filtered = useMemo(() =>
    all.filter((d) => matchesQuick(d, appliedQuick) && matchesAdvanced(d, appliedAdvanced)),
    [all, appliedQuick, appliedAdvanced]);

    // Live estimate (pending) — for the Advanced sheet footer
    const pendingEstimate = useMemo(() =>
    all.filter((d) => matchesQuick(d, pendingQuick) && matchesAdvanced(d, pendingAdvanced)).length,
    [all, pendingQuick, pendingAdvanced]);

    const advancedActive = useMemo(() => advancedActiveCount(appliedAdvanced), [appliedAdvanced]);
    const pendingAdvancedActive = useMemo(() => advancedActiveCount(pendingAdvanced), [pendingAdvanced]);

    const totals = useMemo(() => ({
      total: all.length,
      active: all.filter((d) => d.state === "active").length,
      flagged: all.filter((d) => d.hardware?.root || d.hardware?.devMode || (d.hardware?.securityWarnings || []).length > 0).length,
      pending: all.filter((d) => d.state === "pending").length
    }), [all]);

    // Sorting based on preset
    const sortedRows = useMemo(() => {
      const rows = [...filtered];
      if (preset === "security") {
        rows.sort((a, b) => {
          const ra = (a.hardware?.root ? 3 : 0) + (a.hardware?.devMode ? 2 : 0) + ((a.hardware?.securityWarnings || []).length > 0 ? 1 : 0);
          const rb = (b.hardware?.root ? 3 : 0) + (b.hardware?.devMode ? 2 : 0) + ((b.hardware?.securityWarnings || []).length > 0 ? 1 : 0);
          return rb - ra || lastSeenMinutes(a.lastSeenAt) - lastSeenMinutes(b.lastSeenAt);
        });
      } else if (preset === "hardware") {
        rows.sort((a, b) => {
          const pa = a.storage ? a.storage.used / a.storage.total : 0;
          const pb = b.storage ? b.storage.used / b.storage.total : 0;
          return pb - pa;
        });
      } else {
        rows.sort((a, b) => lastSeenMinutes(a.lastSeenAt) - lastSeenMinutes(b.lastSeenAt));
      }
      return rows;
    }, [filtered, preset]);

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const safePage = Math.min(page, totalPages);
    useEffect(() => {if (page > totalPages) setPage(totalPages);}, [totalPages, page]);

    const pageStart = (safePage - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, sortedRows.length);
    const pageRows = sortedRows.slice(pageStart, pageEnd);

    // Search!  promote pending → applied
    const doSearch = useCallback(() => {
      setAppliedQuick({ ...pendingQuick });
      setAppliedAdvanced({ ...pendingAdvanced });
      setAdvancedOpen(false);
      setPage(1);
    }, [pendingQuick, pendingAdvanced]);

    // Remove a single chip
    const removeChip = (k) => {
      if (k === "sn") {
        const q = { ...appliedQuick, sn: "" };
        setAppliedQuick(q);setPendingQuick(q);
      } else if (k === "merchantId") {
        const q = { ...appliedQuick, merchantId: null, storeId: null };
        setAppliedQuick(q);setPendingQuick(q);
      } else if (k === "storeId") {
        const q = { ...appliedQuick, storeId: null };
        setAppliedQuick(q);setPendingQuick(q);
      } else if (k.startsWith("adv:")) {
        const sub = k.slice(4);
        const a = { ...appliedAdvanced };
        if (sub === "models") a.models = [];else
        if (sub === "statuses") a.statuses = [];else
        if (sub === "networks") a.networks = [];else
        if (sub === "carriers") a.carriers = [];else
        if (sub === "battery") {a.batteryMin = "";a.batteryMax = "";} else
        if (sub === "storage") {a.storageMin = "";a.storageMax = "";} else
        a[sub] = typeof a[sub] === "boolean" ? false : "";
        setAppliedAdvanced(a);setPendingAdvanced(a);
      }
      setPage(1);
    };
    const clearAll = () => {
      setAppliedQuick(emptyQuick());setPendingQuick(emptyQuick());
      setAppliedAdvanced(emptyAdvanced());setPendingAdvanced(emptyAdvanced());
      setPage(1);
    };

    const presetCols = useMemo(() => {
      if (preset === "custom" && customCols) {
        return {
          label: customLabel || "Custom",
          cols: customCols,
          sort: "Last seen ↓",
          desc: customCols.map((k) => COL_LABEL[k] || k).join(" · ")
        };
      }
      return COLUMN_PRESETS[preset] || COLUMN_PRESETS.overview;
    }, [preset, customCols, customLabel]);
    const allCols = ["sn", ...presetCols.cols, "status"];

    // ── Saved-views / column-manager handlers ─────────────────
    const applySavedView = (v) => {
      setPendingQuick({ ...v.quick });setAppliedQuick({ ...v.quick });
      setPendingAdvanced({ ...v.advanced });setAppliedAdvanced({ ...v.advanced });
      setPreset(v.preset);
      setActiveSavedViewId(v.id);
      setSavedViewsOpen(false);
      setPage(1);
    };
    const openManageColumns = () => {
      setManageMode("manage");
      setManageColsOpen(true);
    };
    const openCustomPreset = () => {
      setManageMode("custom");
      setManageColsOpen(true);
    };
    const onApplyColumns = (cols, name) => {
      setCustomCols(cols);
      setCustomLabel(name || "Custom");
      setPreset("custom");
      setManageColsOpen(false);
      setPage(1);
    };
    // Initial cols passed into the drawer — current visible non-fixed cols
    const drawerInitialCols = presetCols.cols;

    return (
      <div>
        <window.PageHeader
          title="Devices"
          subtitle="Production fleet — every Carbon terminal you've activated, with its hardware posture, network, and installed apps." />

        <div style={{ background: "var(--color-bg-1)" }}>
          {/* Stats */}
          <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
              { label: "Total devices", value: totals.total, sub: "in your fleet" },
              { label: "Active", value: totals.active, sub: "checked in recently", tone: "success" },
              { label: "Pending activation", value: totals.pending, sub: "awaiting first contact", tone: totals.pending > 0 ? "info" : undefined },
              { label: "Security flagged", value: totals.flagged, sub: "root / dev-mode / warnings", tone: totals.flagged > 0 ? "warning" : undefined }].
              map((k) =>
              <div key={k.label} style={{
                padding: "12px 16px", borderRadius: "var(--radius-lg)",
                background: "var(--bg2)", border: "1px solid var(--border-1)", boxShadow: "var(--shadow-1)"
              }}>
                  <div className="overline" style={{ fontSize: 10.5 }}>{k.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span className="mono num" style={{
                    fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em",
                    color: k.tone === "success" ? "var(--color-success-700)" :
                    k.tone === "warning" ? "var(--color-warning-700)" :
                    k.tone === "info" ? "var(--color-primary-700)" :
                    "var(--fg1)"
                  }}>{k.value}</span>
                    <span style={{ fontSize: 11, color: "var(--fg3)" }}>{k.sub}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Sticky toolbar group (search + chips) ─── */}
          <div ref={toolbarRef} style={{
            position: "sticky", top: 0, zIndex: 30,
            background: "var(--color-bg-1)",
            paddingTop: "var(--space-3)",
            boxShadow: "0 1px 0 var(--border-1)"
          }}>
            {/* Quick search bar */}
            <div style={{ padding: "0 var(--space-6) 4px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* SN input */}
              <div style={{
                  display: "flex", alignItems: "center", gap: 8, flex: 1.5, minWidth: 260, maxWidth: 380,
                  padding: "0 10px", height: 36, borderRadius: 7, background: "var(--bg2)",
                  border: "1px solid var(--border-2)"
                }}>
                <window.Ico name="search" size={13} style={{ color: "var(--fg3)" }} />
                <input value={pendingQuick.sn}
                  onChange={(e) => setPendingQuick({ ...pendingQuick, sn: e.target.value })}
                  onKeyDown={(e) => {if (e.key === "Enter") doSearch();}}
                  placeholder="Search by SN · paste multiple values"
                  style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 13, color: "var(--fg1)" }} />
                <span style={kbdStyle}>Enter</span>
              </div>

              {/* Merchant */}
              <MerchantPicker
                  value={pendingQuick.merchantId}
                  onChange={(id) => setPendingQuick({ ...pendingQuick, merchantId: id, storeId: id === pendingQuick.merchantId ? pendingQuick.storeId : null })} />

              {/* Store */}
              <StorePicker
                  merchantId={pendingQuick.merchantId}
                  value={pendingQuick.storeId}
                  onChange={(id) => setPendingQuick({ ...pendingQuick, storeId: id })} />

              {/* Search */}
              <button onClick={doSearch} style={primaryBtnStyle}>
                <window.Ico name="search" size={13} />
                Search
              </button>

              {/* Advanced (toggle) */}
              <button onClick={() => setAdvancedOpen((v) => !v)} style={{
                  ...secondaryBtnStyle, position: "relative",
                  ...(advancedOpen ? {
                    background: "var(--color-primary-50)",
                    borderColor: "var(--color-primary-500)",
                    color: "var(--color-primary-700)"
                  } : {})
                }}>
                <window.Ico name="filter" size={12} />
                Advanced
                {(advancedActive > 0 || pendingAdvancedActive > 0) &&
                  <span style={{
                    position: "absolute", top: -6, right: -6,
                    minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 9, background: "var(--color-primary-700)", color: "#fff",
                    fontSize: 10.5, fontWeight: 600, display: "grid", placeItems: "center",
                    border: "1.5px solid var(--bg1)"
                  }}>{Math.max(advancedActive, pendingAdvancedActive)}</span>
                  }
                <window.Ico name="chevd" size={10} style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 120ms" }} />
              </button>

              {/* Saved views — removed */}
            </div>

            {/* Cascade hint */}
            <div style={{
                display: "flex", gap: 14, marginTop: 6, paddingLeft: 4,
                fontSize: 11, color: "var(--fg3)", flexWrap: "wrap"
              }}>
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={kbdStyle}>Enter</span> Search ·
              </span>
              <span>Pick a merchant to enable the store list</span>
              <span>·</span>
              <span>All filters require clicking Search to apply (R-01)</span>
            </div>
          </div>

          {/* Active filter chips (inside sticky toolbar group) */}
          <div style={{ padding: "8px var(--space-6) 10px" }}>
            <ActiveChips quick={appliedQuick} advanced={appliedAdvanced}
              onRemove={removeChip} onClearAll={clearAll} />
          </div>
          </div>

          {/* Advanced sheet (NOT sticky — only relevant while editing) */}
          {advancedOpen &&
          <div style={{ padding: "8px var(--space-6) 0" }}>
              <AdvancedSheet
              open={advancedOpen}
              draft={pendingAdvanced}
              setDraft={setPendingAdvanced}
              onClose={() => setAdvancedOpen(false)}
              onApply={doSearch}
              estimatedCount={pendingEstimate} />
            </div>
          }

          {/* Column preset tabs + description bar + table */}
          <div style={{ padding: "10px var(--space-6) var(--space-6)" }}>
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border-2)",
              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-1)"
            }}>
              {/* Preset tabs */}
              <div ref={tabsRef} style={{
                display: "flex", alignItems: "center", gap: 3, padding: "10px 12px",
                borderBottom: "1px solid var(--border-1)", background: "var(--bg2)",
                flexWrap: "wrap",
                position: "sticky", top: tabsTop, zIndex: 20,
                borderTopLeftRadius: "var(--radius-lg)", borderTopRightRadius: "var(--radius-lg)"
              }}>
                {Object.entries(COLUMN_PRESETS).map(([key, p]) => {
                  const on = preset === key;
                  return (
                    <button key={key} onClick={() => setPreset(key)} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 28, padding: "0 11px", borderRadius: 6,
                      border: 0, cursor: "pointer", fontSize: 12.5,
                      background: on ? "var(--color-primary-700)" : "transparent",
                      color: on ? "#fff" : "var(--fg2)",
                      fontWeight: on ? 600 : 500
                    }}>
                      {p.label}
                      <span style={{
                        padding: "0 5px", height: 16, borderRadius: 8, fontSize: 10,
                        fontWeight: 600, display: "inline-grid", placeItems: "center",
                        background: on ? "oklch(100% 0 0 / 0.22)" : "var(--bg3)",
                        color: on ? "#fff" : "var(--fg3)"
                      }}>{p.cols.length + 2}</span>
                    </button>);

                })}
                <span style={{ width: 1, height: 16, background: "var(--border-1)", margin: "0 6px" }} />
                {customCols &&
                <button onClick={() => setPreset("custom")} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 28, padding: "0 11px", borderRadius: 6,
                  border: 0, cursor: "pointer", fontSize: 12.5,
                  background: preset === "custom" ? "var(--color-primary-700)" : "transparent",
                  color: preset === "custom" ? "#fff" : "var(--fg2)",
                  fontWeight: preset === "custom" ? 600 : 500
                }}>
                    <window.Ico name="settings" size={11} />
                    {customLabel}
                    <span style={{
                    padding: "0 5px", height: 16, borderRadius: 8, fontSize: 10,
                    fontWeight: 600, display: "inline-grid", placeItems: "center",
                    background: preset === "custom" ? "oklch(100% 0 0 / 0.22)" : "var(--bg3)",
                    color: preset === "custom" ? "#fff" : "var(--fg3)"
                  }}>{customCols.length + 2}</span>
                    <span onClick={(e) => {
                    e.stopPropagation();
                    setCustomCols(null);
                    if (preset === "custom") setPreset("overview");
                  }} style={{ cursor: "pointer", display: "inline-grid", placeItems: "center", opacity: 0.7 }}
                  title="Remove custom view">
                      <window.Ico name="x" size={9} stroke={2.4} />
                    </span>
                  </button>
                }
                <button onClick={openCustomPreset} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 28, padding: "0 10px", borderRadius: 6,
                  border: 0, cursor: "pointer", fontSize: 12.5,
                  background: "transparent", color: "var(--fg3)", fontWeight: 500
                }}>
                  <window.Ico name="plus" size={11} />
                  Custom…
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={openManageColumns} style={ghostBtnStyle}>
                  <window.Ico name="settings" size={11} />
                  Manage columns
                </button>
              </div>

              {/* Description strip */}
              <div ref={descRef} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                background: "var(--color-primary-50)", borderBottom: "1px solid var(--border-1)",
                fontSize: 11.5, flexWrap: "wrap",
                position: "sticky", top: descTop, zIndex: 19
              }}>
                <strong style={{ color: "var(--color-primary-700)" }}>{presetCols.label} preset</strong>
                <span style={{ color: "var(--fg2)" }}>{presetCols.desc}</span>
                <span style={{ color: "var(--fg3)" }}>· sorted by {presetCols.sort}</span>
              </div>

              {/* Table — no overflow wrapper (breaks vertical sticky) */}
              <div>
                <style>{`
                  .devices-table tbody tr { transition: background 80ms; }
                  .devices-table tbody tr:hover > td { background: var(--bg-hover) !important; }
                `}</style>
                <table className="devices-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg3)", textAlign: "left" }}>
                      {allCols.map((k) => {
                        const isAnchor = k === "sn" || k === "status";
                        return (
                          <th key={k} className="overline" style={{
                            padding: "9px 14px", fontSize: 10.5,
                            borderBottom: "1px solid var(--border-1)",
                            whiteSpace: "nowrap", color: "var(--fg3)",
                            letterSpacing: "0.06em",
                            position: "sticky",
                            top: theadTop,
                            left: k === "sn" ? 0 : undefined,
                            right: k === "status" ? 0 : undefined,
                            background: "var(--bg3)",
                            zIndex: isAnchor ? 18 : 17
                          }}>
                            {COL_LABEL[k]}
                            {isAnchor && <span style={{ color: "var(--color-primary-500)", marginLeft: 4 }}>★</span>}
                          </th>);

                      })}
                      <th style={{
                        width: 36, padding: "9px 0", borderBottom: "1px solid var(--border-1)", background: "var(--bg3)",
                        position: "sticky", top: theadTop, zIndex: 17
                      }} />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 &&
                    <tr>
                        <td colSpan={allCols.length + 1} style={{
                        padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)"
                      }}>
                          {filtered.length === 0 ?
                        "No devices match those filters — try clearing some chips." :
                        "No rows on this page."}
                        </td>
                      </tr>
                    }
                    {pageRows.map((d) =>
                    <tr key={d.sn}
                    onClick={() => navigate({ screen: "deviceDetail", deviceSn: d.sn })}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border-1)" }}>
                        {allCols.map((k) =>
                      <td key={k} style={{
                        padding: "11px 14px",
                        verticalAlign: "middle",
                        position: k === "sn" || k === "status" ? "sticky" : undefined,
                        left: k === "sn" ? 0 : undefined,
                        right: k === "status" ? 0 : undefined,
                        background: k === "sn" || k === "status" ? "var(--bg2)" : undefined,
                        zIndex: k === "sn" || k === "status" ? 1 : 0
                      }}>
                            {renderCell(k, d)}
                          </td>
                      )}
                        <td style={{ padding: "11px 12px", textAlign: "right" }}>
                          <window.Ico name="chevr" size={13} style={{ color: "var(--fg3)" }} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <PaginationBar
                total={filtered.length}
                pageStart={pageStart} pageEnd={pageEnd}
                totalUnfiltered={all.length}
                page={safePage} totalPages={totalPages}
                pageSize={pageSize}
                setPage={setPage} setPageSize={setPageSize} />
            </div>
          </div>
        </div>

        <ManageColumnsDrawer
          open={manageColsOpen}
          mode={manageMode}
          baseLabel={COLUMN_PRESETS[preset]?.label || customLabel || "Custom"}
          initialCols={drawerInitialCols}
          onClose={() => setManageColsOpen(false)}
          onApply={onApplyColumns} />
      </div>);

  }

  // ─── Pagination bar ──────────────────────────────────────
  function PaginationBar({ total, pageStart, pageEnd, totalUnfiltered, page, totalPages, pageSize, setPage, setPageSize }) {
    const [goTo, setGoTo] = useState("");
    const filtered = total !== totalUnfiltered;
    const pages = pagerWindow(page, totalPages);

    const goToPage = () => {
      const n = parseInt(goTo, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) {
        setPage(n);
        setGoTo("");
      }
    };

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
        borderTop: "1px solid var(--border-1)", background: "var(--bg2)",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg2)" }}>
          <span>Rows per page</span>
          <select value={pageSize}
          onChange={(e) => {setPageSize(+e.target.value);setPage(1);}}
          style={{ ...inputStyle, height: 26, padding: "0 22px 0 8px", fontSize: 12 }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div style={{ fontSize: 12, color: "var(--fg2)" }}>
          Showing
          {" "}<span className="mono num">{total === 0 ? 0 : pageStart + 1}</span>
          –<span className="mono num">{pageEnd}</span>
          {" "}of <strong className="mono num">{total.toLocaleString()}</strong>
          {filtered &&
          <span style={{ color: "var(--fg4)" }}> · filtered from {totalUnfiltered.toLocaleString()} total</span>
          }
        </div>

        <div style={{ flex: 1 }} />

        {/* Pager */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <PagerBtn disabled={page === 1} onClick={() => setPage(1)} title="First">
            <DoubleChev dir="left" />
          </PagerBtn>
          <PagerBtn disabled={page === 1} onClick={() => setPage(page - 1)} title="Previous">
            <window.Ico name="chevl" size={11} />
          </PagerBtn>
          {pages.map((p, i) =>
          p === "..." ?
          <span key={`e${i}`} style={{ padding: "0 6px", color: "var(--fg4)", fontSize: 12 }}>…</span> :
          <PagerBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PagerBtn>
          )}
          <PagerBtn disabled={page === totalPages} onClick={() => setPage(page + 1)} title="Next">
            <window.Ico name="chevr" size={11} />
          </PagerBtn>
          <PagerBtn disabled={page === totalPages} onClick={() => setPage(totalPages)} title="Last">
            <DoubleChev dir="right" />
          </PagerBtn>
        </div>

        {/* Go to */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, paddingLeft: 12,
          borderLeft: "1px solid var(--border-1)", fontSize: 12, color: "var(--fg2)"
        }}>
          <span>Go to</span>
          <input value={goTo}
          onChange={(e) => setGoTo(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {if (e.key === "Enter") goToPage();}}
          placeholder={String(page)} className="mono"
          style={{ ...inputStyle, width: 56, height: 26, fontSize: 12, fontFamily: "var(--font-mono, ui-monospace)" }} />
          <button onClick={goToPage} style={{ ...secondaryBtnStyle, height: 26, padding: "0 10px", fontSize: 12 }}>Go</button>
        </div>
      </div>);

  }

  function DoubleChev({ dir }) {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ?
        <path d="M11 18l-6-6 6-6M18 18l-6-6 6-6" /> :
        <path d="M13 18l6-6-6-6M6 18l6-6-6-6" />}
      </svg>);

  }

  function PagerBtn({ active, disabled, onClick, title, children }) {
    return (
      <button onClick={onClick} disabled={disabled} title={title} style={{
        minWidth: 28, height: 28, padding: "0 8px", border: 0, borderRadius: 6,
        background: active ? "var(--color-primary-700)" : "transparent",
        color: active ? "#fff" : disabled ? "var(--fg4)" : "var(--fg2)",
        fontSize: 12, fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1
      }}
      onMouseEnter={(e) => {if (!active && !disabled) e.currentTarget.style.background = "var(--bg-hover)";}}
      onMouseLeave={(e) => {if (!active && !disabled) e.currentTarget.style.background = "transparent";}}>
        {children}
      </button>);

  }

  // ─── Shared styles ───────────────────────────────────────
  const triggerStyle = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", height: 36, padding: "0 10px",
    borderRadius: 7, background: "var(--bg2)",
    border: "1px solid var(--border-2)",
    fontSize: 13, cursor: "pointer", textAlign: "left"
  };
  const popoverStyle = {
    position: "absolute", top: 40, left: 0, width: 320, zIndex: 50,
    background: "var(--bg2)", border: "1px solid var(--border-2)",
    borderRadius: 8, boxShadow: "0 12px 32px -8px oklch(0% 0 0 / 0.16)",
    overflow: "hidden"
  };
  const inputStyle = {
    height: 32, padding: "0 10px", fontSize: 12.5,
    border: "1px solid var(--border-2)", borderRadius: 6,
    background: "var(--bg2)", color: "var(--fg1)",
    outline: "none"
  };
  const primaryBtnStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 36, padding: "0 14px", fontSize: 13, fontWeight: 600,
    border: 0, borderRadius: 7, cursor: "pointer",
    background: "var(--color-primary-700)", color: "#fff",
    boxShadow: "var(--shadow-cta, 0 1px 2px rgba(0,0,0,0.1))"
  };
  const secondaryBtnStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 36, padding: "0 12px", fontSize: 12.5, fontWeight: 500,
    border: "1px solid var(--border-2)", borderRadius: 7, cursor: "pointer",
    background: "var(--bg2)", color: "var(--fg2)"
  };
  const ghostBtnStyle = {
    display: "inline-flex", alignItems: "center", gap: 5,
    height: 28, padding: "0 10px", fontSize: 12,
    border: 0, borderRadius: 6, cursor: "pointer",
    background: "transparent", color: "var(--fg2)", fontWeight: 500
  };
  const ghostBtnSmStyle = {
    display: "inline-flex", alignItems: "center", gap: 4,
    height: 22, padding: "0 8px", fontSize: 11,
    border: 0, borderRadius: 5, cursor: "pointer",
    background: "transparent", color: "var(--fg2)", fontWeight: 500
  };
  const kbdStyle = {
    fontFamily: "var(--font-mono, ui-monospace)",
    fontSize: 10, fontWeight: 500,
    padding: "1px 5px", borderRadius: 4,
    background: "var(--bg3)", color: "var(--fg3)",
    border: "1px solid var(--border-1)",
    letterSpacing: "0.02em"
  };
  const chipOnStyle = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "2px 8px", borderRadius: 999,
    background: "var(--color-primary-50)",
    color: "var(--color-primary-700)",
    border: "1px solid color-mix(in oklab, var(--color-primary-500) 25%, transparent)",
    fontSize: 11.5, fontWeight: 500, lineHeight: 1.5,
    whiteSpace: "nowrap"
  };
  const chipOffStyle = {
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: 999,
    background: "transparent", color: "var(--fg3)",
    border: "1px dashed var(--border-2)",
    fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, cursor: "pointer",
    whiteSpace: "nowrap"
  };
  const advGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px 18px",
    marginBottom: 4
  };
  const dividerStyle = {
    height: 1, background: "var(--border-1)", margin: "18px 0 14px"
  };

  // ─── Override the export ─────────────────────────────────
  window.DevicesListScreen = DevicesListScreen;
})();