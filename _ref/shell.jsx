/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon ISV Console — Shell v2
// Aligned with the Sample-Activation project's patterns:
//   · Sidebar with named sections + Pinned
//   · PageHeader = breadcrumb row + title row (h2 + subtitle + actions)
//   · Button/Card/Badge/Input are thin wrappers over the .tds-* classes
// ─────────────────────────────────────────────────────────────

const { useState, useEffect, useRef, useMemo } = React;

// ─── Icon set ───────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 1.6, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const I = {
  home:    <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></>,
  app:     <><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></>,
  package: <><path d="M3 8 12 3l9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/></>,
  device:  <><rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="17.5" r="0.7" fill="currentColor"/></>,
  store:   <><path d="M3 9l1.5-5h15L21 9"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/></>,
  email:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  bell:    <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  more:    <><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></>,
  chevd:   <><path d="m8 9 4-4 4 4"/><path d="m8 15 4 4 4-4"/></>,
  chevdown:<><path d="m6 9 6 6 6-6"/></>,
  chevr:   <><path d="m9 6 6 6-6 6"/></>,
  chevl:   <><path d="m15 6-6 6 6 6"/></>,
  chevu:   <><path d="m6 15 6-6 6 6"/></>,
  plus:    <><path d="M12 5v14M5 12h14"/></>,
  check:   <><path d="m4.5 12.5 5 5 10-11"/></>,
  x:       <><path d="M6 6l12 12M18 6 6 18"/></>,
  external:<><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>,
  download:<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
  upload:  <><path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M5 4h14"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 20v-4h4"/></>,
  filter:  <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
  copy:    <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
  edit:    <><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m14 6 4 4"/></>,
  trash:   <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
  alert:   <><path d="M12 9v4M12 17h0"/><path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></>,
  info:    <><circle cx="12" cy="12" r="9"/><path d="M12 8h0M11 12h1v5h1"/></>,
  shield:  <><path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z"/></>,
  shieldCheck: <><path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></>,
  arrowR:  <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  arrowL:  <><path d="M19 12H5M11 6l-6 6 6 6"/></>,
  arrowU2: <><path d="M12 19V5M6 11l6-6 6 6"/></>,
  arrowD2: <><path d="M12 5v14M6 13l6 6 6-6"/></>,
  comment: <><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></>,
  creditcard: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6" opacity="0.6"/><path d="m6 6 3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" opacity="0.6"/></>,
  doc:     <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
  bolt:    <><path d="m13 3-9 12h7l-1 6 9-12h-7z"/></>,
  users:   <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></>,
  image:   <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 17 5-5 5 5 4-4 4 4"/></>,
  scan:    <><path d="M4 7V5a1 1 0 0 1 1-1h2M20 7V5a1 1 0 0 0-1-1h-2M4 17v2a1 1 0 0 0 1 1h2M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 12h10"/></>,
  flash:   <><path d="m13 3-9 12h7l-1 6 9-12h-7z"/></>,
  link:    <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>,
  box:     <><path d="M3 8 12 4l9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/></>,
  key:     <><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2"/><path d="m17 4 3 3"/><path d="m14 7 3 3"/></>,
  lock:    <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  ticket:  <><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12"/></>,
  send:    <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>,
  bookmark:<><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/></>,
  clock:   <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  // sidebar / panel toggle — rectangle with a vertical divider near the left
  panelLeft:  <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  panelRight: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
};

const Ico = ({ name, size = 16, stroke = 1.6, style }) => (
  <Icon d={I[name]} size={size} stroke={stroke} style={style} />
);
window.Ico = Ico;

// ─── Tenant switcher ─────────────────────────────────────────
// Domain model: a Company is the unit of business, and it may hold one or
// more contracts (ISV, ISO) which gate what it can do. An operator can be
// onboarded into multiple companies and switch between them here.
const TENANTS = [
  { id: "acme-sw",  name: "Acme Software",    contracts: ["ISV"],         last: "Active now"   },
  { id: "northbay", name: "Northbay Devices", contracts: ["ISO"],         last: "Yesterday"    },
  { id: "summit",   name: "Summit Retail Co.", contracts: ["ISV", "ISO"], last: "Last week"    },
];

const CONTRACT_TONE = {
  ISV: { bg: "var(--color-primary-50)", fg: "var(--color-primary-700)", label: "ISV" },
  ISO: { bg: "oklch(94% 0.03 152)",     fg: "var(--color-success-700)", label: "ISO" },
};

function ContractChip({ contract, size = "sm" }) {
  const tone = CONTRACT_TONE[contract] || CONTRACT_TONE.ISV;
  return (
    <span style={{
      padding: size === "sm" ? "0 5px" : "1px 6px",
      borderRadius: 3,
      background: tone.bg, color: tone.fg,
      fontFamily: "var(--font-mono)",
      fontSize: size === "sm" ? 9.5 : 10.5,
      fontWeight: 500, letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>{tone.label}</span>
  );
}

function TenantSwitcher({ collapsed = false }) {
  const [activeId, setActiveId] = useState(TENANTS[0].id);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const active = TENANTS.find(t => t.id === activeId) || TENANTS[0];

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Expose the active tenant globally so the rest of the app can adapt later.
  useEffect(() => {
    window.__activeTenant = active;
    window.dispatchEvent(new CustomEvent("tenant:change", { detail: active }));
  }, [active]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {collapsed ? (
        <button onClick={() => setOpen(v => !v)}
                aria-haspopup="menu" aria-expanded={open}
                title={`${active.name} — switch organization`}
                style={{
          width: 36, height: 36, margin: "2px auto 8px",
          display: "grid", placeItems: "center",
          cursor: "pointer", background: "transparent",
          border: "1px solid transparent",
          borderRadius: "var(--radius-sm)",
        }}>
          <img src="assets/toms-logo.png" alt="TOMS" width="22" height="22"
               style={{ display: "block" }} />
        </button>
      ) : (
        <button onClick={() => setOpen(v => !v)}
                aria-haspopup="menu" aria-expanded={open}
                style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 9,
          padding: "6px 6px 12px",
          textAlign: "left", cursor: "pointer",
          background: "transparent", border: 0,
        }}>
          <img src="assets/toms-logo.png" alt="TOMS" width="22" height="22"
               style={{ display: "block", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: "var(--fg1)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>TOMS</div>
            <div style={{
              marginTop: 2,
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 10.5, color: "var(--fg3)",
              minWidth: 0,
            }}>
              <span style={{
                minWidth: 0, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>{active.name}</span>
              <span style={{ display: "inline-flex", gap: 3, flexShrink: 0 }}>
                {active.contracts.map(c => <ContractChip key={c} contract={c} />)}
              </span>
            </div>
          </div>
          <Ico name={open ? "chevu" : "chevd"} size={12} style={{ color: "var(--fg3)", flexShrink: 0 }} />
        </button>
      )}

      {open && (
        <div role="menu" style={{
          position: "absolute",
          ...(collapsed
            ? { top: 0, left: "calc(100% + 8px)", width: 264 }
            : { top: "calc(100% - 4px)", left: 0, right: 0 }),
          background: "var(--bg2)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-4)",
          padding: 4,
          zIndex: "var(--z-dropdown)",
        }}>
          <div className="overline" style={{
            fontSize: 9.5, padding: "6px 8px 4px", letterSpacing: "0.06em",
          }}>Switch organization</div>
          {TENANTS.map(t => {
            const isActive = t.id === activeId;
            return (
              <button key={t.id} role="menuitemradio" aria-checked={isActive}
                onClick={() => { setActiveId(t.id); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--bg-active)" : "transparent",
                  textAlign: "left", cursor: "pointer", border: 0,
                  fontSize: 12,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "var(--radius-sm)",
                  background: "var(--bg3)", color: "var(--fg2)",
                  border: "1px solid var(--border-1)",
                  display: "grid", placeItems: "center",
                  fontSize: 10, fontWeight: 600, flexShrink: 0,
                }}>{t.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--fg1)" : "var(--fg2)",
                    minWidth: 0,
                  }}>
                    <span style={{
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      minWidth: 0,
                    }}>{t.name}</span>
                    <span style={{ display: "inline-flex", gap: 3, flexShrink: 0 }}>
                      {t.contracts.map(c => <ContractChip key={c} contract={c} />)}
                    </span>
                  </span>
                  <span style={{
                    display: "block", marginTop: 1,
                    fontSize: 10.5, color: "var(--fg3)",
                  }}>{t.last}</span>
                </span>
                {isActive && (
                  <Ico name="check" size={12} stroke={2.4}
                       style={{ color: "var(--accent)", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar (block-sidebar pattern) ────────────────────────
function Sidebar({ route, navigate, collapsed = false }) {
  // Sidebar entries depend on what contracts the active tenant holds.
  // Pure ISV  → "App Publish"
  // Pure ISO  → "App Store"
  // Both      → both items, App Publish first (workflow order)
  const tenant = window.useActiveTenant ? window.useActiveTenant() : null;
  const contracts = tenant?.contracts || ["ISV"];
  const hasISV = contracts.includes("ISV");
  const hasISO = contracts.includes("ISO");

  const appItems = [];
  if (hasISV) appItems.push({ id: "appPublish", icon: "upload",   label: "App Publish" });
  if (hasISO) appItems.push({ id: "appStore",   icon: "download", label: "App Store" });

  const sections = [
    {
      title: "Manage", items: [
        { id: "home",      icon: "home",    label: "Overview" },
        ...appItems,
      ],
    },
    // Merchants live under the ISO contract — only show this section when the
    // active tenant actually has one. Pure-ISV tenants don't manage merchants.
    // Devices is the production-fleet view on the same data ISO scope — it
    // joins this section so the customer-facing surfaces (merchants who own
    // terminals, devices that get pushed apps) sit together.
    ...(hasISO ? [{
      title: "Customers", items: [
        { id: "merchants", icon: "store",  label: "Merchants" },
        { id: "tickets",   icon: "alert",  label: "Tickets" },
        { id: "devices",   icon: "device", label: "Devices"   },
      ],
    }] : []),
    {
      title: "System", items: [
        { id: "settings",  icon: "settings", label: "Settings" },
      ],
    },
  ];

  // Which sidebar item is highlighted for which routes? App detail / version
  // detail / wizards all stay highlighted under whichever entry-point they
  // were reached from. Routes carry a `from` property to disambiguate; if
  // missing, we fall back to whichever entry the tenant actually has.
  const defaultAppEntry = hasISV ? "appPublish" : "appStore";
  const fromEntry = route.from || defaultAppEntry;
  const isAppRoute = ["appPublish", "appStore", "appDetail", "versionDetail",
                      "publishWizard", "newApp", "editApp",
                      "approval", "browsePool"].includes(route.screen);
  const isMerchantRoute = ["merchants", "merchantDetail", "newMerchant"].includes(route.screen);
  const isDeviceRoute   = ["devices", "deviceDetail"].includes(route.screen);
  const isTicketRoute   = ["tickets", "ticketDetail", "newTicket"].includes(route.screen);
  const isActive = (id) => {
    if (id === "appPublish" || id === "appStore") {
      if (!isAppRoute) return false;
      // On the top-level list pages themselves, only the exact one
      // matches. fromEntry is for deep routes (app detail, version
      // detail, wizards) where we want to highlight which list the
      // user came from.
      if (route.screen === "appPublish" || route.screen === "appStore") {
        return route.screen === id;
      }
      return fromEntry === id;
    }
    if (id === "merchants") return isMerchantRoute;
    if (id === "devices")   return isDeviceRoute;
    if (id === "tickets")   return isTicketRoute;
    return route.screen === id;
  };

  return (
    <aside style={{
      width: collapsed ? 56 : 232, flexShrink: 0, background: "var(--bg3)",
      borderRight: "1px solid var(--border-1)",
      display: "flex", flexDirection: "column",
      padding: collapsed ? "var(--space-2)" : "var(--space-3)",
      gap: 1,
      transition: "width 180ms cubic-bezier(.2,.7,.2,1), padding 180ms cubic-bezier(.2,.7,.2,1)",
    }}>
      {/* Tenant switcher — user may belong to multiple orgs; this row swaps the active one */}
      <TenantSwitcher collapsed={collapsed} />

      {/* Search */}
      {/* (search moved to the top-right of every page header) */}

      {/* Sections */}
      {sections.map((s, sIdx) => (
        <React.Fragment key={s.title}>
          {collapsed ? (
            // In collapsed mode, render a thin divider between sections
            // instead of the section label — saves vertical space and
            // keeps the visual rhythm.
            sIdx > 0 && (
              <div style={{
                height: 1, background: "var(--border-1)",
                margin: "8px 6px",
              }} />
            )
          ) : (
            <div className="overline" style={{
              fontSize: 9.5,
              padding: "10px 8px 4px",
            }}>{s.title}</div>
          )}
          {s.items.map((it) => {
            const active = isActive(it.id);
            if (collapsed) {
              const hasIndicator = it.badge === "new" || it.count != null;
              return (
                <a key={it.id} href="#"
                  title={it.label + (it.count != null ? ` (${it.count})` : "")}
                  onClick={(e) => { e.preventDefault(); navigate({ screen: it.id }); }}
                  style={{
                    position: "relative",
                    width: 40, height: 36, margin: "1px auto",
                    display: "grid", placeItems: "center",
                    borderRadius: "var(--radius-sm)",
                    color: active ? "var(--fg1)" : "var(--fg2)",
                    background: active ? "var(--bg-active)" : "transparent",
                    boxShadow: active ? "var(--shadow-1)" : "none",
                    textDecoration: "none",
                  }}>
                  <Ico name={it.icon} size={15}
                    style={{ color: active ? "var(--accent)" : "var(--fg3)" }} />
                  {hasIndicator && (
                    <span style={{
                      position: "absolute", top: 5, right: 5,
                      width: it.badge === "new" ? 6 : 14, height: it.badge === "new" ? 6 : 14,
                      borderRadius: 999,
                      background: it.badge === "new" ? "var(--accent)" : "var(--error)",
                      color: "white", fontSize: 8.5, fontWeight: 700,
                      display: "grid", placeItems: "center",
                      border: "1.5px solid var(--bg3)",
                      lineHeight: 1, fontFamily: "var(--font-mono)",
                    }}>{it.count != null && it.count <= 99 ? it.count : it.badge === "new" ? "" : "!"}</span>
                  )}
                </a>
              );
            }
            return (
              <a key={it.id} href="#"
                onClick={(e) => { e.preventDefault(); navigate({ screen: it.id }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  fontSize: 12, color: active ? "var(--fg1)" : "var(--fg2)",
                  fontWeight: active ? 500 : 400,
                  background: active ? "var(--bg-active)" : "transparent",
                  boxShadow: active ? "var(--shadow-1)" : "none",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}>
                <Ico name={it.icon} size={14}
                  style={{ color: active ? "var(--accent)" : "var(--fg3)", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.badge === "new" && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 600, padding: "1px 4px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--accent)", color: "var(--accent-on)",
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>NEW</span>
                )}
                {it.count != null && (
                  <span className="mono" style={{
                    fontSize: 9.5,
                    color: active ? "var(--fg2)" : "var(--fg3)",
                    background: "var(--bg1)",
                    border: "1px solid var(--border-1)",
                    borderRadius: 999, padding: "1px 6px",
                  }}>{it.count}</span>
                )}
              </a>
            );
          })}
        </React.Fragment>
      ))}

      {/* Pinned */}
      <div style={{ flex: 1 }} />

      {/* Account row */}
      {collapsed ? (
        <div style={{
          display: "flex", justifyContent: "center",
          padding: "8px 0", marginTop: 8,
          borderTop: "1px solid var(--border-1)",
        }}>
          <button title="Maya Hassan · maya@acmesoftware.com" style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, oklch(70% 0.13 268), oklch(50% 0.18 282))",
            color: "#fff",
            display: "grid", placeItems: "center",
            fontSize: 10, fontWeight: 600,
            cursor: "pointer",
          }}>MH</button>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "8px 6px", marginTop: 8,
          borderTop: "1px solid var(--border-1)",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "linear-gradient(135deg, oklch(70% 0.13 268), oklch(50% 0.18 282))",
            color: "#fff",
            display: "grid", placeItems: "center",
            fontSize: 10, fontWeight: 600,
            flexShrink: 0,
          }}>MH</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--fg1)", lineHeight: 1.2 }}>Maya Hassan</div>
            <div className="mono truncate" style={{ fontSize: 9.5, color: "var(--fg3)" }}>maya@acmesoftware.com</div>
          </div>
          <Ico name="chevd" size={12} style={{ color: "var(--fg3)" }} />
        </div>
      )}
    </aside>
  );
}

// ─── PageHeader: title row only (breadcrumb + global controls live in TopBar) ──
function PageHeader({ title, subtitle, actions, status, tabs, onBack }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border-1)", background: "var(--bg2)" }}>
      {/* Title row */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 16,
        padding: "var(--space-4) var(--space-6)",
        flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: "1 1 360px", display: "flex", alignItems: "flex-start", gap: 14 }}>
          {onBack && (
            <button onClick={onBack} title="Back" style={{
              marginTop: 6, color: "var(--fg3)", padding: 4, borderRadius: "var(--radius-sm)",
            }}><Ico name="chevl" size={18} /></button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 className="h2" style={{ margin: 0 }}>{title}</h1>
              {status}
            </div>
            {subtitle && (
              <p className="body-sm" style={{ marginTop: 6, marginBottom: 0, color: "var(--fg3)", maxWidth: 720 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>
        )}
      </div>

      {/* Tabs (optional) */}
      {tabs && (
        <div style={{ display: "flex", gap: 2, padding: "0 var(--space-6)" }}>{tabs}</div>
      )}
    </div>
  );
}

// ─── TopBar — shell-level chrome: breadcrumb + Search + Bell ──
function TopBar({ crumbs = [], actions, sidebarCollapsed, onToggleSidebar }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 var(--space-4) 0 var(--space-3)",
      height: 48, flexShrink: 0,
      background: "var(--bg2)",
      borderBottom: "1px solid var(--border-1)",
      fontSize: 12, color: "var(--fg3)",
    }}>
      {/* Sidebar collapse toggle — sits at the leftmost slot of the
          chrome so it stays accessible in both expanded and collapsed
          states. Keyboard shortcut: [ */}
      {onToggleSidebar && (
        <button onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar  [" : "Collapse sidebar  ["}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={!!sidebarCollapsed}
          style={{
            display: "inline-grid", placeItems: "center",
            width: 28, height: 28,
            borderRadius: "var(--radius-sm)",
            color: "var(--fg3)", flexShrink: 0,
            transition: "background .12s ease, color .12s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--fg1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--fg3)";
          }}>
          <Ico name={sidebarCollapsed ? "panelRight" : "panelLeft"} size={15} stroke={1.6} />
        </button>
      )}
      <div style={{
        width: 1, height: 18, background: "var(--border-1)",
        flexShrink: 0, marginRight: 2,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, overflow: "hidden" }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Ico name="chevr" size={11} style={{ opacity: 0.5, flexShrink: 0 }} />}
            {c.href ? (
              <a href="#" onClick={(e) => { e.preventDefault(); c.onClick && c.onClick(); }}
                 style={{ color: i === crumbs.length - 1 ? "var(--fg1)" : "inherit",
                          fontFamily: c.mono ? "var(--font-mono)" : undefined,
                          fontWeight: i === crumbs.length - 1 ? 500 : 400, whiteSpace: "nowrap" }}>{c.label}</a>
            ) : (
              <span style={{ color: i === crumbs.length - 1 ? "var(--fg1)" : "inherit",
                             whiteSpace: "nowrap",
                             fontFamily: c.mono ? "var(--font-mono)" : undefined,
                             fontWeight: i === crumbs.length - 1 ? 500 : 400 }}>{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button className="tds-input tds-input--sm" style={{
          width: 240, color: "var(--fg3)", textAlign: "left", cursor: "pointer",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <Ico name="search" size={13} />
            <span className="truncate">Search…</span>
          </span>
          <kbd style={{ marginLeft: "auto" }}>⌘K</kbd>
        </button>
        <button style={{
          padding: 6, color: "var(--fg3)", borderRadius: "var(--radius-md)", position: "relative",
        }} title="Notifications">
          <Ico name="bell" size={15} />
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--error)",
          }} />
        </button>
        {actions}
      </div>
    </div>
  );
}

// ─── Button (.tds-btn wrapper) ─────────────────────────────
function Button({ children, primary, danger, ghost, variant, icon, iconRight, onClick, disabled, size = "md", type, style, block }) {
  const resolvedVariant = variant
    || (primary ? "primary" : danger ? "danger" : ghost ? "ghost" : "secondary");
  const cls = ["tds-btn", `tds-btn--${size}`, `tds-btn--${resolvedVariant}`, block ? "tds-btn--block" : ""].filter(Boolean).join(" ");
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type} style={style}>
      {icon && <Ico name={icon} size={iconSize} stroke={1.7} />}
      {children}
      {iconRight && <Ico name={iconRight} size={iconSize} stroke={1.7} />}
    </button>
  );
}

// ─── Badge / Pill (.tds-badge wrapper) ─────────────────────
function Pill({ tone = "neutral", children, dot, size = "md" }) {
  // Map my legacy tone names → tds-badge tones
  const toneMap = { danger: "error", accent: "accent", success: "success", warning: "warning", info: "info", neutral: "neutral" };
  const t = toneMap[tone] || "neutral";
  return (
    <span className={`tds-badge tds-badge--${t}`} style={{
      whiteSpace: "nowrap",
      ...(size === "sm" ? { fontSize: 10, padding: "1px 6px" }
        : size === "lg" ? { fontSize: 11.5, padding: "3px 9px" }
        : {}),
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />}
      {children}
    </span>
  );
}
const Badge = Pill;

// ─── Card (.tds-card wrapper) ──────────────────────────────
function Card({ title, hint, action, children, padding, style }) {
  return (
    <section className="tds-card" style={{ boxShadow: "var(--shadow-1)", borderRadius: "var(--radius-lg)", ...style }}>
      {(title || action) && (
        <div className="tds-card__header" style={{ padding: "var(--space-3) var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <h3 className="tds-card__title" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{title}</h3>
            {hint && <span style={{ fontSize: 11, color: "var(--fg3)", overflow: "hidden", textOverflow: "ellipsis" }}>{hint}</span>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: padding != null ? padding : "var(--space-5)" }}>{children}</div>
    </section>
  );
}

// ─── Input (.tds-input wrapper) ────────────────────────────
function Input({ value, onChange, placeholder, mono, prefix, suffix, error, style, size = "md", type = "text", disabled, ...rest }) {
  return (
    <label className={`tds-input tds-input--${size} ${error ? "tds-input--invalid" : ""} ${disabled ? "tds-input--disabled" : ""}`} style={style}>
      {prefix && <span className="tds-input__addon tds-input__addon--prefix">{prefix}</span>}
      <input
        className="tds-input__el"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        style={{ fontFamily: mono ? "var(--font-mono)" : undefined, letterSpacing: mono ? "0.02em" : undefined }}
        {...rest}
      />
      {suffix && <span className="tds-input__addon tds-input__addon--suffix">{suffix}</span>}
    </label>
  );
}

// ─── Textarea ──────────────────────────────────────────────
function Textarea({ value, onChange, placeholder, rows = 4, style }) {
  return (
    <textarea
      value={value || ""} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{
        width: "100%", padding: "var(--space-3) var(--space-3)",
        fontSize: "var(--font-size-md)", lineHeight: "var(--line-height-normal)",
        border: "1px solid var(--border-2)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg2)", color: "var(--fg1)",
        outline: 0, resize: "vertical", fontFamily: "inherit",
        ...style,
      }} />
  );
}

// ─── Field (label + control + hint/error) ──────────────────
function Field({ label, hint, error, required, children }) {
  return (
    <div className="tds-field">
      <div className={`tds-field__label ${required ? "tds-field__label--required" : ""}`}>{label}</div>
      {children}
      {hint && !error && <div className="tds-field__hint">{hint}</div>}
      {error && <div className="tds-field__error">{error}</div>}
    </div>
  );
}

// ─── KV row ────────────────────────────────────────────────
function KV({ label, value, mono, copy }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12, padding: "var(--space-2) 0",
      borderBottom: "1px dashed var(--border-1)",
    }}>
      <div style={{ width: 150, fontSize: 12, color: "var(--fg3)", flexShrink: 0 }}>{label}</div>
      <div style={{
        flex: 1, fontSize: 13, fontWeight: 450, color: "var(--fg1)",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        wordBreak: "break-word",
      }}>{value}</div>
      {copy && (
        <button style={{ color: "var(--fg3)", padding: 2, opacity: 0.6 }} title="Copy">
          <Ico name="copy" size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────
function Empty({ title, body, icon = "doc", action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 8, padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-md)",
        background: "var(--bg3)", color: "var(--fg3)",
        display: "grid", placeItems: "center",
        border: "1px solid var(--border-1)",
      }}>
        <Ico name={icon} size={18} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      {body && <div style={{ fontSize: 12, color: "var(--fg3)", maxWidth: 360 }}>{body}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ─── Modal — unified popup: translucent backdrop + centered card ──
function Modal({ open, onClose, width = 480, title, subtitle, footer, children, padding }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "oklch(0% 0 0 / 0.42)",
        backdropFilter: "blur(2px)",
        animation: "modalFade .15s ease-out",
      }} />
      <div style={{
        position: "relative",
        width, maxWidth: "calc(100vw - 48px)", maxHeight: "calc(100vh - 48px)",
        display: "flex", flexDirection: "column",
        background: "var(--bg2)",
        border: "1px solid var(--border-2)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-4)",
        animation: "modalPop .18s cubic-bezier(.2,.7,.2,1)",
        overflow: "hidden",
      }}>
        {(title || subtitle) && (
          <header style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-1)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg1)" }}>{title}</div>}
              {subtitle && <div style={{ marginTop: 3, fontSize: 12, color: "var(--fg3)" }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{
              padding: 6, color: "var(--fg3)", borderRadius: "var(--radius-sm)", flexShrink: 0,
            }} title="Close" aria-label="Close">
              <Ico name="x" size={15} />
            </button>
          </header>
        )}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto",
                      padding: padding != null ? padding : "var(--space-5)" }}>
          {children}
        </div>
        {footer && (
          <footer style={{
            padding: "var(--space-3) var(--space-5)",
            borderTop: "1px solid var(--border-1)",
            background: "var(--bg3)",
            display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end",
          }}>{footer}</footer>
        )}
      </div>
      <style>{`
        @keyframes modalFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalPop  { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

window.Modal = Modal;

// ─── ConfirmDialog — replaces native confirm()/prompt() ────
// Standard project-wide confirmation modal. Pass tone="danger" for
// destructive actions; the primary button picks up the right color.
// Optional requireText forces the user to type a phrase before the
// confirm button enables — use this for "Roll back" or other
// irreversible actions where a misclick would be very costly.
//
// Usage:
//   const [open, setOpen] = useState(false);
//   <ConfirmDialog open={open} onClose={() => setOpen(false)}
//     title="Discard upload?"
//     body="Your APK and visibility choices will be lost."
//     confirmLabel="Discard" tone="danger"
//     onConfirm={() => { setOpen(false); onClose(); }} />
function ConfirmDialog({ open, onClose, title, body, confirmLabel = "Confirm",
                        cancelLabel = "Cancel", tone = "primary", icon,
                        requireText, hint, onConfirm }) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => { if (!open) setTyped(""); }, [open]);
  if (!open) return null;
  const canConfirm = !requireText || typed.trim() === requireText;
  const isDanger = tone === "danger";
  return (
    <Modal open onClose={onClose} width={520} title={title} subtitle={typeof body === "string" ? body : undefined}
      footer={
        <>
          {hint && (
            <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{hint}</span>
          )}
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button primary={!isDanger} danger={isDanger} icon={icon} disabled={!canConfirm} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }>
      {typeof body !== "string" && body && (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          {body}
        </div>
      )}
      {requireText && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            Type <span className="mono" style={{ padding: "1px 6px", borderRadius: 4,
              background: "var(--color-bg-3)", color: "var(--color-text-primary)",
              fontWeight: 500 }}>{requireText}</span> to confirm:
          </div>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText}
            mono
            autoFocus />
        </div>
      )}
    </Modal>
  );
}
window.ConfirmDialog = ConfirmDialog;
function Drawer({ open, onClose, width = 720, title, subtitle, footer, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "oklch(0% 0 0 / 0.35)" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width, maxWidth: "92vw", background: "var(--bg2)",
        boxShadow: "var(--shadow-4)", display: "flex", flexDirection: "column",
      }}>
        {(title || subtitle) && (
          <header style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-1)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              {title && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>}
              {subtitle && <div style={{ marginTop: 3, fontSize: 12, color: "var(--fg3)" }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ padding: 6, color: "var(--fg3)", borderRadius: 6 }} title="Close">
              <Ico name="x" size={15} />
            </button>
          </header>
        )}
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
        {footer && (
          <footer style={{
            padding: "var(--space-3) var(--space-5)",
            borderTop: "1px solid var(--border-1)",
            background: "var(--bg3)",
            display: "flex", alignItems: "center", gap: 8,
          }}>{footer}</footer>
        )}
      </aside>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const tone = toast.tone || "success";
  const toneColor = tone === "success" ? "var(--success)" : tone === "danger" ? "var(--error)" : "var(--accent)";
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 200,
      background: "var(--bg2)", border: "1px solid var(--border-2)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-4)",
      padding: "10px 12px 10px 10px",
      display: "flex", alignItems: "center", gap: 10,
      minWidth: 260, maxWidth: 360,
      animation: "carbonToast .25s ease-out",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "var(--radius-sm)",
        background: tone === "success" ? "var(--success-bg)" : tone === "danger" ? "var(--error-bg)" : "var(--accent-soft)",
        color: toneColor, display: "grid", placeItems: "center",
      }}>
        <Ico name={tone === "success" ? "check" : tone === "danger" ? "alert" : "info"} size={14} stroke={2} />
      </div>
      <div style={{ flex: 1, fontSize: 12.5 }}>{toast.message}</div>
      <button onClick={onClose} style={{ color: "var(--fg3)", padding: 4 }}>
        <Ico name="x" size={13} />
      </button>
      <style>{`@keyframes carbonToast { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}

// ─── Severity bar (stacked, 100%) ──────────────────────────
function SeverityBar({ counts, height = 6 }) {
  const order = ["critical", "high", "medium", "low", "info"];
  const total = order.reduce((s, k) => s + (counts[k] || 0), 0);
  if (!total) {
    return <div style={{ height, borderRadius: 999, background: "var(--success-bg)" }} />;
  }
  return (
    <div style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", background: "var(--bg3)" }}>
      {order.map(k => {
        const v = counts[k] || 0;
        if (!v) return null;
        return <div key={k} style={{
          width: `${(v / total) * 100}%`,
          background: window.SEVERITY[k].color,
        }} title={`${window.SEVERITY[k].label}: ${v}`} />;
      })}
    </div>
  );
}

// ─── PortalDropdown — anchored, viewport-positioned popover ──
// Render dropdown / popover content into document.body so it isn't clipped
// by ancestor `overflow: auto/hidden` scroll containers. Re-anchors to a
// trigger element on every render while open; closes when the page scrolls
// or the viewport resizes (the alternative — repositioning continuously —
// looks janky and isn't worth the complexity for a UI dropdown).
//
//   <PortalDropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)}
//                   placement="bottom-start" offset={4}>
//     <Menu />
//   </PortalDropdown>
//
//   placement: "bottom-start" (default) | "bottom-end" | "top-start" | "top-end"
//   offset:    px gap between trigger and dropdown (default 4)
//   minWidth:  px floor for dropdown width (default = trigger width)
function PortalDropdown({ anchorRef, open, onClose, placement = "bottom-start", offset = 4, minWidth, children }) {
  const [coords, setCoords] = React.useState(null);
  const popRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (!open || !anchorRef?.current) { setCoords(null); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    const next = {};
    if (placement.startsWith("bottom")) {
      next.top = rect.bottom + offset;
    } else {
      next.bottom = window.innerHeight - rect.top + offset;
    }
    if (placement.endsWith("end")) {
      next.right = window.innerWidth - rect.right;
    } else {
      next.left = rect.left;
    }
    next.minWidth = minWidth != null ? minWidth : rect.width;
    setCoords(next);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose && onClose();
    };
    const onScroll = () => onClose && onClose();
    const onResize = () => onClose && onClose();
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !coords) return null;
  return ReactDOM.createPortal(
    <div ref={popRef} style={{
      position: "fixed",
      top: coords.top, bottom: coords.bottom, left: coords.left, right: coords.right,
      minWidth: coords.minWidth,
      zIndex: 300,
    }}>{children}</div>,
    document.body
  );
}

Object.assign(window, {
  Sidebar, PageHeader, TopBar, Button, Pill, Badge, Card, Field, Input, Textarea, KV, Empty, Drawer, Toast, SeverityBar,
  PortalDropdown,
});

// ─── useActiveTenant — subscribes to the tenant switcher ─────
// Any component can call this to get the currently-active tenant and
// re-render when the user picks a different organization.
function useActiveTenant() {
  const [tenant, setTenant] = useState(window.__activeTenant || TENANTS[0]);
  useEffect(() => {
    const onChange = (e) => setTenant(e.detail);
    window.addEventListener("tenant:change", onChange);
    if (window.__activeTenant) setTenant(window.__activeTenant);
    return () => window.removeEventListener("tenant:change", onChange);
  }, []);
  return tenant;
}
window.useActiveTenant = useActiveTenant;
window.ContractChip    = ContractChip;

// ─── Pagination (.tds-pagination wrapper) ──────────────────
function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach(p => pages.add(p));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach(p => pages.add(p));
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

function Pagination({ page, pageSize, total, onChange, onPageSizeChange, pageSizes = [10, 20, 50] }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage  = Math.min(Math.max(1, page), pageCount);
  const from      = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to        = Math.min(total, safePage * pageSize);
  const pages     = buildPageList(safePage, pageCount);
  const showControls = pageCount > 1;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      padding: "var(--space-3) var(--space-4)",
      borderTop: "1px solid var(--border-1)",
      background: "var(--bg2)",
      fontSize: 12, color: "var(--fg3)",
    }}>
      <span>
        Showing{" "}
        <b className="num" style={{ color: "var(--fg2)" }}>{from}{from !== to ? `–${to}` : ""}</b>{" "}
        of <b className="num" style={{ color: "var(--fg2)" }}>{total}</b>
      </span>

      {onPageSizeChange && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              fontFamily: "inherit", fontSize: 12,
              padding: "2px 6px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-2)",
              background: "var(--bg2)", color: "var(--fg1)",
              cursor: "pointer",
            }}>
            {pageSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}

      {showControls && (
        <div className="tds-pagination" style={{ marginLeft: "auto" }}>
          <button
            className="tds-pagination__page"
            disabled={safePage <= 1}
            onClick={() => onChange(safePage - 1)}
            style={{ opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? "not-allowed" : "pointer" }}
            aria-label="Previous page">
            <Ico name="chevl" size={12} />
          </button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="tds-pagination__page"
                    style={{ pointerEvents: "none", cursor: "default", border: "1px solid transparent" }}>…</span>
            ) : (
              <button
                key={p}
                className={"tds-pagination__page" + (p === safePage ? " tds-pagination__page--active" : "")}
                onClick={() => onChange(p)}>{p}</button>
            )
          )}
          <button
            className="tds-pagination__page"
            disabled={safePage >= pageCount}
            onClick={() => onChange(safePage + 1)}
            style={{ opacity: safePage >= pageCount ? 0.4 : 1, cursor: safePage >= pageCount ? "not-allowed" : "pointer" }}
            aria-label="Next page">
            <Ico name="chevr" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// Helper hook: returns slice + handlers, resets to page 1 when `resetKey` changes.
function usePaginated(items, defaultSize = 10, resetKey = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const slice = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { slice, page: safePage, pageSize, setPage, setPageSize, total };
}

// ─── MoreFilters popover ──────────────────────────────────
// Trigger button that opens a popover of secondary filters. The parent
// supplies the body (one or more <MoreFiltersSection> blocks), plus an
// `activeCount` so the trigger shows a badge, and `onClear` for the footer
// reset action. Designed to pair with 1–3 outside filters so high-fan-out
// surfaces (devices, merchants…) don't have to widen their filter bar.
//
// Usage:
//   <MoreFilters activeCount={n} onClear={() => …}>
//     <MoreFiltersSection label="Status">
//       <FilterChipGroup options={[…]} value={…} onChange={…} multi />
//     </MoreFiltersSection>
//   </MoreFilters>
function MoreFilters({ activeCount = 0, onClear, label = "More filters", width = 320, children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const hasActive = activeCount > 0;
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: "var(--radius-sm)",
          border: "1px solid " + (hasActive ? "var(--color-primary-500)" : "var(--color-border-default)"),
          background: hasActive ? "var(--color-primary-50)" : "var(--bg2)",
          color: hasActive ? "var(--color-primary-700)" : "var(--fg2)",
          fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          height: 30,
        }}>
        <Ico name="filter" size={12} />
        <span>{label}</span>
        {hasActive && (
          <span className="num" style={{
            background: "var(--color-primary-500)", color: "white",
            fontSize: 10, fontWeight: 600, padding: "0 5px",
            borderRadius: 999, minWidth: 16, height: 16,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}>{activeCount}</span>
        )}
        <Ico name="chevdown" size={10} />
      </button>
      <PortalDropdown anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}
        placement="bottom-end" offset={6} minWidth={width}>
        <div style={{
          minWidth: width, maxWidth: 460,
          background: "var(--bg2)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-3)",
          maxHeight: "70vh", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: "1px solid var(--border-1)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg2)" }}>{label}</span>
            <button onClick={() => setOpen(false)}
              style={{ display: "inline-flex", padding: 2, color: "var(--fg3)", cursor: "pointer" }}
              aria-label="Close filters">
              <Ico name="x" size={12} />
            </button>
          </div>
          <div style={{
            padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 14,
            overflow: "auto",
          }}>
            {children}
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderTop: "1px solid var(--border-1)",
            background: "var(--bg3)",
          }}>
            <button
              onClick={() => { onClear?.(); }}
              disabled={!hasActive}
              style={{
                fontSize: 12, fontFamily: "inherit",
                color: hasActive ? "var(--color-primary-700)" : "var(--fg4)",
                cursor: hasActive ? "pointer" : "not-allowed",
                padding: "4px 6px",
              }}>
              Reset
            </button>
            <button onClick={() => setOpen(false)}
              style={{
                fontSize: 12, fontFamily: "inherit",
                background: "var(--color-primary-600)", color: "white",
                padding: "5px 12px", borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}>
              Done
            </button>
          </div>
        </div>
      </PortalDropdown>
    </>
  );
}

function MoreFiltersSection({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--fg3)", fontWeight: 500,
        textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--fg4)" }}>{hint}</div>}
      {children}
    </div>
  );
}

// Pill-style chip selector — single (radio) or multi (checkbox) flavored.
// `options` = [{ value, label, count? }]. value matches a primitive (string/number/null)
// or, in multi mode, is a member of the value Set.
function FilterChipGroup({ options, value, onChange, multi = false }) {
  const isSelected = (v) => multi ? (value && value.has?.(v)) : value === v;
  const toggle = (v) => {
    if (multi) {
      const next = new Set(value || []);
      if (next.has(v)) next.delete(v); else next.add(v);
      onChange(next);
    } else {
      onChange(value === v ? null : v);
    }
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const sel = isSelected(opt.value);
        return (
          <button key={String(opt.value)} onClick={() => toggle(opt.value)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", fontSize: 12,
              borderRadius: 999, fontFamily: "inherit",
              border: "1px solid " + (sel ? "var(--color-primary-500)" : "var(--border-2)"),
              background: sel ? "var(--color-primary-50)" : "var(--bg2)",
              color:      sel ? "var(--color-primary-700)" : "var(--fg2)",
              cursor: "pointer",
            }}>
            <span>{opt.label}</span>
            {opt.count != null && (
              <span className="num" style={{
                fontSize: 10, color: sel ? "var(--color-primary-700)" : "var(--fg4)",
                padding: "0 4px", borderRadius: 999,
                background: sel ? "white" : "var(--bg3)",
                border: "1px solid " + (sel ? "var(--color-primary-200)" : "var(--border-1)"),
              }}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

window.Pagination        = Pagination;
window.usePaginated      = usePaginated;
window.MoreFilters       = MoreFilters;
window.MoreFiltersSection= MoreFiltersSection;
window.FilterChipGroup   = FilterChipGroup;
