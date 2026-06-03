/* global React, ReactDOM */
// ─────────────────────────────────────────────────────────────
// Carbon — Device Console
// Focused build: the Devices menu (list + detail + 4 tabs).
// Merchant + Overview routes are kept around because device-detail
// links to the merchant page; everything else is a placeholder.
//
// Workbench instances run as in-app tabs (browser-style) alongside the
// main "Console" tab. Each workbench tab keeps its own ticket id;
// closing the tab returns to whichever tab was active before it.
// ─────────────────────────────────────────────────────────────

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

// Tweakable defaults — host can rewrite these via __edit_mode_set_keys
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "accent": "indigo",
  "tenantId": "northbay",
  "monitoringLayout": "proposed"
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  indigo: { p50: "oklch(97% 0.012 262)", p200: "oklch(86% 0.06 262)", p500: "oklch(40% 0.14 262)",
            p600: "oklch(32% 0.10 262)", p700: "oklch(24% 0.06 262)" },
  cyan:   { p50: "oklch(97% 0.02 220)",  p200: "oklch(86% 0.08 220)", p500: "oklch(56% 0.14 220)",
            p600: "oklch(42% 0.12 220)", p700: "oklch(30% 0.10 220)" },
  emerald:{ p50: "oklch(96% 0.03 160)",  p200: "oklch(86% 0.08 160)", p500: "oklch(54% 0.14 158)",
            p600: "oklch(42% 0.13 158)", p700: "oklch(30% 0.10 158)" },
  graphite:{p50: "oklch(96% 0.005 270)", p200: "oklch(82% 0.008 270)", p500: "oklch(36% 0.01 270)",
            p600: "oklch(28% 0.01 270)", p700: "oklch(22% 0.01 270)" },
};

const MAIN_TAB_ID = "main";

function App() {
  const [t, setTweak] = window.useTweaks(DEFAULTS);
  const [route, setRoute] = useStateA({ screen: "devices" });
  const [toast, setToast] = useStateA(null);

  // In-app tab strip: a single "Console" tab plus 0+ workbench tabs.
  const [tabs, setTabs] = useStateA([
    { id: MAIN_TAB_ID, kind: "main", label: "Carbon Console" },
  ]);
  const [activeTabId, setActiveTabId] = useStateA(MAIN_TAB_ID);
  // Remember the tab that triggered each workbench so closing returns
  // the user to where they came from rather than always to main.
  const tabOriginRef = useRefA({}); // { [tabId]: originTabId }

  // Open (or focus) a workbench tab for a ticket id.
  const openWorkbenchTab = (ticketId) => {
    if (!ticketId) return;
    const id = "wb-" + ticketId;
    setTabs(prev => prev.find(x => x.id === id) ? prev
      : [...prev, { id, kind: "workbench", ticketId, label: ticketId }]);
    setActiveTabId(prevActive => {
      // Remember where we came from so close can return us there.
      tabOriginRef.current[id] = tabOriginRef.current[id] || prevActive || MAIN_TAB_ID;
      return id;
    });
  };

  const closeTab = (id) => {
    if (id === MAIN_TAB_ID) return; // Main tab cannot be closed.
    setTabs(prev => {
      const idx = prev.findIndex(x => x.id === id);
      if (idx < 0) return prev;
      const next = prev.filter(x => x.id !== id);
      setActiveTabId(curr => {
        if (curr !== id) return curr;
        const origin = tabOriginRef.current[id];
        if (origin && next.find(x => x.id === origin)) return origin;
        return (next[idx - 1] || next[0])?.id || MAIN_TAB_ID;
      });
      delete tabOriginRef.current[id];
      return next;
    });
  };

  // Expose the helpers for tickets.jsx + the Tweaks shortcuts. We keep the
  // old `openWorkbenchInNewWindow` name as an alias so existing callers
  // (tickets.jsx) keep working without a refactor.
  useEffectA(() => {
    window.openWorkbenchTab = openWorkbenchTab;
    window.openWorkbenchInNewWindow = openWorkbenchTab;
  });

  // Force the chosen tenant on first mount + whenever the tweak changes.
  useEffectA(() => {
    const tenant = (window.TENANTS || []).find(x => x.id === t.tenantId)
                || (window.TENANTS || []).find(x => x.contracts?.includes("ISO"))
                || (window.TENANTS || [])[0];
    if (tenant) {
      window.__activeTenant = tenant;
      window.dispatchEvent(new CustomEvent("tenant:change", { detail: tenant }));
    }
  }, [t.tenantId]);

  // Apply accent preset
  useEffectA(() => {
    const p = ACCENT_PRESETS[t.accent] || ACCENT_PRESETS.indigo;
    const root = document.documentElement;
    root.style.setProperty("--color-primary-50",  p.p50);
    root.style.setProperty("--color-primary-200", p.p200);
    root.style.setProperty("--color-primary-500", p.p500);
    root.style.setProperty("--color-primary-600", p.p600);
    root.style.setProperty("--color-primary-700", p.p700);
  }, [t.accent]);

  useEffectA(() => {
    document.documentElement.setAttribute("data-theme", t.theme === "dark" ? "dark" : "light");
  }, [t.theme]);

  // Propagate Monitoring-tab layout choice ("current" | "proposed") to a
  // window global + a custom event, so DeviceMonitoringTab (deep in
  // devices.jsx) can subscribe without prop-drilling.
  useEffectA(() => {
    window.__monitoringLayout = t.monitoringLayout || "proposed";
    window.dispatchEvent(new CustomEvent("monitoring-layout:change",
      { detail: window.__monitoringLayout }));
  }, [t.monitoringLayout]);

  // Toast plumbing — exposed globally for deep components.
  const showToast = (message, tone = "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };
  useEffectA(() => { window.showToast = showToast; });
  // devices.jsx's "Bound to {merchant}" link uses window.__navigate
  useEffectA(() => { window.__navigate = setRoute; });

  // Merchant module lookups — merchants are linked from device detail.
  const currentMerchant = route.merchantId
    ? window.findMerchantById?.(route.merchantId) : null;
  const goMerchants     = () => setRoute({ screen: "merchants" });
  const goMerchantDetail = (id, tab = "overview") => setRoute({ screen: "merchantDetail", merchantId: id, tab });
  const openNewMerchant = () => setRoute({ screen: "newMerchant" });

  // Device module lookups
  const currentDevice = route.deviceSn ? window.findDeviceBySn?.(route.deviceSn) : null;

  // Ticket module lookups
  const currentTicket = route.ticketId ? window.findTicketById?.(route.ticketId) : null;

  const densityFontSize = t.density === "compact" ? 12.5 : t.density === "spacious" ? 14 : 13;

  const activeTab = tabs.find(x => x.id === activeTabId) || tabs[0];

  // From a workbench tab, "Back to ticket detail" should close the
  // workbench and put the main tab on that ticket's detail screen.
  const navigateFromWorkbench = (id, target) => {
    setRoute(target);
    setActiveTabId(tabOriginRef.current[id] || MAIN_TAB_ID);
    closeTab(id);
  };

  return (
    <div className="carbon-root" style={{ fontSize: densityFontSize,
      height: "100vh", display: "flex", flexDirection: "column" }}>
      {tabs.length > 1 && (
        <TabStrip tabs={tabs} activeTabId={activeTabId}
          onSelect={setActiveTabId} onClose={closeTab} />
      )}

      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex" }}>
        {activeTab?.kind === "main" && (
          <MainApp
            route={route} setRoute={setRoute}
            t={t}
            currentDevice={currentDevice}
            currentMerchant={currentMerchant}
            currentTicket={currentTicket}
            goMerchants={goMerchants}
            goMerchantDetail={goMerchantDetail}
            openNewMerchant={openNewMerchant}
            showToast={showToast} />
        )}
        {activeTab?.kind === "workbench" && (
          <WorkbenchTabHost
            key={activeTab.id}
            tabId={activeTab.id}
            ticketId={activeTab.ticketId}
            onClose={() => closeTab(activeTab.id)}
            onNavigateMain={(target) => navigateFromWorkbench(activeTab.id, target)} />
        )}
      </div>

      <window.Toast toast={toast} onClose={() => setToast(null)} />

      <window.TweaksPanel>
        <window.TweakSection label="Appearance" />
        <window.TweakRadio  label="Theme"   value={t.theme}   options={["light", "dark"]}
                            onChange={(v) => setTweak("theme", v)} />
        <window.TweakSelect label="Density" value={t.density} options={["compact", "comfortable", "spacious"]}
                            onChange={(v) => setTweak("density", v)} />
        <window.TweakSelect label="Accent"  value={t.accent}  options={["indigo", "cyan", "emerald", "graphite"]}
                            onChange={(v) => setTweak("accent", v)} />
        <window.TweakSection label="Tenant" />
        <window.TweakSelect label="Active tenant"
                            value={t.tenantId}
                            options={(window.TENANTS || []).map(x => x.id)}
                            onChange={(v) => setTweak("tenantId", v)} />
        <window.TweakSection label="Monitoring tab" />
        <window.TweakRadio  label="Layout"
                            value={t.monitoringLayout}
                            options={["current", "proposed"]}
                            onChange={(v) => setTweak("monitoringLayout", v)} />
        <window.TweakSection label="Tickets" />
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "tickets" }); }}>Tickets list</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "newTicket" }); }}>New ticket form</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-001" }); }}>Auto-created · awaiting triage</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-008" }); }}>ISO working · running detect</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-003" }); }}>Critical · escalated to NPT</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-004" }); }}>NPT working · printer hardware</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-005" }); }}>NPT replied · POS Pro hotfix</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "ticketDetail", ticketId: "T-2026-006" }); }}>Closed · how-to question</window.TweakButton>
        <window.TweakSection label="Workbench" />
        <window.TweakButton onClick={() => openWorkbenchTab("T-2026-008")}>Workbench · ISO Working ticket</window.TweakButton>
        <window.TweakButton onClick={() => openWorkbenchTab("T-2026-003")}>Workbench · Escalated (Critical)</window.TweakButton>
        <window.TweakButton onClick={() => openWorkbenchTab("T-2026-004")}>Workbench · NPT working</window.TweakButton>
        <window.TweakSection label="Jump to device" />
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "devices" }); }}>Devices list</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N950-0014-9281" }); }}>Clean N950 (active)</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N750-0099-0040" }); }}>Rooted N750 (flagged)</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "S60-0488-0021" }); }}>Dev-mode S60 (inactive)</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "X800-0099-1422" }); }}>Ethernet kiosk X800</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "S90-0822-2007" }); }}>Pending S90</window.TweakButton>
        <window.TweakSection label="Device tabs" />
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N950-0014-9281", tab: "basic" }); }}>Basic info</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N950-0014-9281", tab: "apps" }); }}>Apps &amp; Firmware</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N950-0014-9281", tab: "monitoring" }); }}>Monitoring</window.TweakButton>
        <window.TweakButton onClick={() => { setActiveTabId(MAIN_TAB_ID); setRoute({ screen: "deviceDetail", deviceSn: "N950-0014-9281", tab: "prewarning" }); }}>Pre-warning</window.TweakButton>
      </window.TweaksPanel>
    </div>
  );
}

// ─── Browser-style tab strip ──────────────────────────────────
function TabStrip({ tabs, activeTabId, onSelect, onClose }) {
  return (
    <div role="tablist" style={{
      display: "flex", alignItems: "flex-end", gap: 0,
      height: 38, minHeight: 38,
      padding: "0 8px",
      background: "linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%)",
      borderBottom: "1px solid var(--border-1)",
      overflowX: "auto", overflowY: "hidden", flexShrink: 0,
    }}>
      {tabs.map((t) => {
        const on = t.id === activeTabId;
        const closable = t.id !== MAIN_TAB_ID;
        return (
          <div key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            onMouseDown={(e) => {
              // Middle-click closes — same as browsers.
              if (e.button === 1 && closable) { e.preventDefault(); onClose(t.id); }
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 32, marginBottom: -1,
              padding: closable ? "0 6px 0 12px" : "0 14px",
              maxWidth: 240, minWidth: 120,
              background: on ? "var(--color-bg-1)" : "transparent",
              border: "1px solid",
              borderColor: on ? "var(--border-1)" : "transparent",
              borderBottomColor: on ? "var(--color-bg-1)" : "transparent",
              borderTopLeftRadius: 7, borderTopRightRadius: 7,
              color: on ? "var(--fg1)" : "var(--fg3)",
              fontSize: 12, fontWeight: on ? 600 : 500,
              cursor: "pointer",
              transition: "background .12s ease, color .12s ease",
              userSelect: "none",
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "color-mix(in oklab, var(--color-bg-1) 55%, transparent)"; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
            <window.Ico name={t.kind === "main" ? "home" : "external"} size={12} stroke={1.8}
              style={{ color: on
                ? (t.kind === "main" ? "var(--fg2)" : "var(--color-primary-600)")
                : "var(--fg3)", flexShrink: 0 }} />
            <span style={{
              flex: 1, minWidth: 0, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: t.kind === "workbench" ? "var(--font-family-mono)" : "inherit",
              letterSpacing: t.kind === "workbench" ? "0.01em" : 0,
            }}>
              {t.kind === "workbench" ? "Workbench · " : ""}{t.label}
            </span>
            {closable && (
              <button onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                aria-label={`Close ${t.label}`}
                style={{
                  display: "inline-grid", placeItems: "center",
                  width: 18, height: 18, borderRadius: "50%",
                  background: "transparent", border: 0,
                  color: "var(--fg3)", cursor: "pointer", padding: 0,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg3)";
                  e.currentTarget.style.color = "var(--fg1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--fg3)";
                }}>
                <window.Ico name="x" size={10} stroke={2.2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main app (Console tab body) ──────────────────────────────
function MainApp({ route, setRoute, t, currentDevice, currentMerchant, currentTicket,
  goMerchants, goMerchantDetail, openNewMerchant, showToast }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "row" }}>
      <window.Sidebar route={route} navigate={setRoute} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <window.TopBar crumbs={makeCrumbs(route, setRoute)} actions={null} />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {route.screen === "devices" && (
            <window.DevicesListScreen navigate={setRoute} />
          )}
          {route.screen === "deviceDetail" && currentDevice && (
            <window.DeviceDetailScreen device={currentDevice} route={route} navigate={setRoute} />
          )}
          {route.screen === "tickets" && (
            <window.TicketsListScreen navigate={setRoute} />
          )}
          {route.screen === "newTicket" && (
            <window.NewTicketScreen navigate={setRoute} presetSn={route.deviceSn} />
          )}
          {route.screen === "ticketDetail" && currentTicket && (
            <window.TicketDetailScreen ticket={currentTicket} navigate={setRoute} />
          )}
          {route.screen === "merchants" && (
            <window.MerchantsListScreen navigate={setRoute} openNewMerchant={openNewMerchant} />
          )}
          {route.screen === "merchantDetail" && currentMerchant && (
            <window.MerchantDetailScreen merchant={currentMerchant} route={route} navigate={setRoute} />
          )}
          {route.screen === "newMerchant" && (
            <window.NewMerchantScreen
              onClose={goMerchants}
              onSave={({ name, country, tags, notes }) => {
                const id = `m-${Date.now().toString(36)}`;
                const now = "just now";
                const hq = {
                  id: `s-${id.replace(/^m-/, "")}-hq`,
                  isHQ: true, name, address: "", country, notes: "",
                  createdAt: now, updatedAt: now,
                };
                const newM = {
                  id, name, country, tags: tags || [], notes: notes || "",
                  createdAt: now, updatedAt: now,
                  stores: [hq],
                  terminals: [],
                };
                (window.MERCHANTS || []).unshift(newM);
                window.bumpMerchants?.();
                showToast(`${name} created`, "success");
                goMerchantDetail(id);
              }} />
          )}
          {(route.screen === "home" || route.screen === "appPublish"
         || route.screen === "appStore" || route.screen === "settings"
         || route.screen === "sample-activation" || route.screen === "sample-orders") && (
            <PlaceholderScreen route={route} />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Workbench tab body ───────────────────────────────────────
function WorkbenchTabHost({ tabId, ticketId, onClose, onNavigateMain }) {
  const ticket = window.findTicketById ? window.findTicketById(ticketId) : null;
  if (!ticket) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center",
        background: "var(--color-bg-1)", color: "var(--fg2)", padding: 40, textAlign: "center" }}>
        <window.Empty icon="alert" title="Ticket not found"
          body={<>The ticket id <code>{ticketId}</code> is not in this build.</>} />
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
      <window.WorkbenchScreen
        ticket={ticket}
        navigate={onNavigateMain}
        onCloseTab={onClose} />
    </div>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────────
function makeCrumbs(route, navigate) {
  if (route.screen === "devices") return [{ label: "Devices" }];
  if (route.screen === "deviceDetail") {
    const d = window.findDeviceBySn ? window.findDeviceBySn(route.deviceSn) : null;
    return [
      { label: "Devices", href: true, onClick: () => navigate({ screen: "devices" }) },
      { label: d?.sn || route.deviceSn, mono: true },
    ];
  }
  if (route.screen === "tickets") return [{ label: "Tickets" }];
  if (route.screen === "newTicket") {
    return [{ label: "Tickets", href: true, onClick: () => navigate({ screen: "tickets" }) },
            { label: "New ticket" }];
  }
  if (route.screen === "ticketDetail") {
    const tk = window.findTicketById ? window.findTicketById(route.ticketId) : null;
    return [
      { label: "Tickets", href: true, onClick: () => navigate({ screen: "tickets" }) },
      { label: tk?.id || route.ticketId, mono: true },
    ];
  }
  if (route.screen === "merchants") return [{ label: "Merchants" }];
  if (route.screen === "newMerchant") {
    return [{ label: "Merchants", href: true, onClick: () => navigate({ screen: "merchants" }) }, { label: "New merchant" }];
  }
  if (route.screen === "merchantDetail") {
    const m = window.findMerchantById ? window.findMerchantById(route.merchantId) : null;
    return [
      { label: "Merchants", href: true, onClick: () => navigate({ screen: "merchants" }) },
      { label: m?.name || route.merchantId },
    ];
  }
  if (route.screen === "home")     return [{ label: "Overview" }];
  if (route.screen === "settings") return [{ label: "Settings" }];
  if (route.screen === "appStore") return [{ label: "App Store" }];
  if (route.screen === "appPublish") return [{ label: "App Publish" }];
  if (route.screen === "sample-activation") return [{ label: "Sample Devices" }];
  if (route.screen === "sample-orders")     return [{ label: "Sample Orders" }];
  return [{ label: "Devices", href: true, onClick: () => navigate({ screen: "devices" }) }];
}

// ─── Placeholder for unfocused sidebar routes ─────────────
function PlaceholderScreen({ route }) {
  const labels = {
    home: "Overview",
    appPublish: "App Publish",
    appStore: "App Store",
    settings: "Settings",
    "sample-activation": "Sample Devices",
    "sample-orders": "Sample Orders",
  };
  return (
    <div style={{ padding: 40, height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-1)" }}>
      <window.Empty
        icon={route.screen === "settings" ? "settings" : "doc"}
        title={`${labels[route.screen] || route.screen} — not part of this build`}
        body={<>This focused console only ships the <b>Devices</b> module. Click <b>Devices</b> in the sidebar to return.</>} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
