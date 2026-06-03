/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Screens: AppsList · AppDetail · VersionDetail
// ─────────────────────────────────────────────────────────────

const { useState: useStateS, useMemo: useMemoS, useEffect: useEffectS } = React;

// Android API level → human version name (TOMS devices ship 24+ only)
function androidVersionName(api) {
  const map = { 21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1", 26: "8.0", 27: "8.1",
                28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15" };
  return map[api] ? `Android ${map[api]}` : `API ${api}`;
}

// ─── Reusable: device-model chip ──────────────────────────
function DeviceChip({ id, removable, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 7px 2px 8px", borderRadius: 4,
      background: "var(--color-bg-3)",
      border: "1px solid var(--color-border-subtle)",
      fontSize: 11, fontFamily: "var(--font-family-mono)",
      color: "var(--color-text-secondary)", letterSpacing: "0.01em",
    }}>
      {id}
      {removable && (
        <button onClick={onRemove} style={{ color: "var(--color-text-tertiary)", padding: 0, marginLeft: 1 }}>
          <window.Ico name="x" size={10} />
        </button>
      )}
    </span>
  );
}

// ─── App row icon + name ───────────────────────────────────
function AppMeta({ app, size = 36, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <window.AppIcon app={app} size={size} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }} className="truncate">{app.name}</div>
        <div className="mono truncate" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{sub || app.package}</div>
      </div>
    </div>
  );
}

// ─── Apps list screen ─────────────────────────────────────
// Split into two surfaces by `mode`:
//   mode="publish" — App Publish (ISV view). Lists apps the tenant authors.
//   mode="store"   — App Store    (ISO view). Lists apps the tenant has
//                    subscribed to from other ISVs in the public pool.
// Each mode is reached from its own sidebar entry; tenants holding both
// contracts (ISV + ISO) see both sidebar entries and use this same screen
// with different `mode` props.
function AppsListScreen({ mode = "publish", navigate, openNewApp, openPublishWizard }) {
  const tenant = window.useActiveTenant();
  return <PoolAppsList
    mode={mode}
    tenant={tenant}
    navigate={navigate}
    openNewApp={openNewApp}
    openPublishWizard={openPublishWizard} />;
}

// Build the unified pool: own apps + resolved subscriptions, each tagged
// with `kind` and the metadata the table needs.
function buildPoolItems(tenant) {
  const own = (window.APPS || [])
    .filter(a => a.publisherTenantId === tenant.id)
    .map(app => ({
      key: `own-${app.id}`,
      kind: "own",
      app,
      publisherId: app.publisherTenantId,
    }));

  const subs = ((window.SUBSCRIBED_APPS || {})[tenant.id] || [])
    .map(window.resolveSubscription)
    .filter(Boolean)
    .map(sub => ({
      key: `sub-${sub.appId}`,
      kind: "subscribed",
      app: sub.app,
      publisherId: sub.app.publisherTenantId,
      subscription: sub,
    }));

  return [...own, ...subs];
}

function PoolAppsList({ mode, tenant, navigate, openNewApp, openPublishWizard }) {
  const isPublishMode = mode === "publish";
  const isStoreMode   = mode === "store";

  const [q, setQ] = useStateS("");
  // Mode partitions the list, so no kind filter chips anymore.
  const [category, setCategory] = useStateS("all");
  const [statusFilter, setStatusFilter] = useStateS(new Set());
  const [modeFilter, setModeFilter]     = useStateS(new Set());  // publishMode: "public" | "private"
  const [deviceFilter, setDeviceFilter] = useStateS(new Set());
  const [advancedOpen, setAdvancedOpen] = useStateS(false);
  // Store-mode shortcut: filter by "updates available" subscriptions only.
  const [updatesOnly, setUpdatesOnly] = useStateS(false);
  // Store-mode kind filter — driven by the 4 KPI tiles at the top.
  // "all" | "own" | "subscribed" | "updates"
  const [kindFilter, setKindFilter] = useStateS("all");

  const allPoolItems = buildPoolItems(tenant);
  // Pre-filter by mode. Publish-mode shows only owned apps. Store-mode
  // shows both kinds: own apps the tenant published AND subscribed apps
  // from other publishers — the App Store is a unified library of every
  // app the operator can install on merchants.
  const poolItems = useMemoS(
    () => allPoolItems.filter(it => isPublishMode ? it.kind === "own" : true),
    [allPoolItems, mode]);
  const cats = useMemoS(() => ["all", ...new Set(poolItems.map(it => it.app.category))], [poolItems]);

  const totals = useMemoS(() => ({
    total:        poolItems.length,
    published:    poolItems.filter(it => it.kind === "own" && it.app.status === "published").length,
    unpublished:  poolItems.filter(it => it.kind === "own" && it.app.status === "unpublished").length,
    specified:    poolItems.filter(it => it.kind === "own" && it.app.publishMode === "private").length,
    subscribed:   poolItems.filter(it => it.kind === "subscribed").length,
    updates:      poolItems.filter(it => it.kind === "subscribed" && it.subscription.isOutdated).length,
  }), [poolItems]);

  const filtered = useMemoS(() => poolItems.filter(it => {
    if (updatesOnly && !(it.kind === "subscribed" && it.subscription.isOutdated)) return false;
    // Store-mode kind partition driven by the KPI tiles.
    if (!isPublishMode) {
      if (kindFilter === "own"        && it.kind !== "own") return false;
      if (kindFilter === "subscribed" && it.kind !== "subscribed") return false;
      if (kindFilter === "updates"    && !(it.kind === "subscribed" && it.subscription.isOutdated)) return false;
    }
    if (category !== "all" && it.app.category !== category) return false;
    if (statusFilter.size > 0 && (it.kind !== "own" || !statusFilter.has(it.app.status))) return false;
    if (modeFilter.size   > 0 && (it.kind !== "own" || !modeFilter.has(it.app.publishMode || "public"))) return false;
    if (deviceFilter.size > 0 && !it.app.devices.some(d => deviceFilter.has(d))) return false;
    if (q !== "") {
      const needle = q.toLowerCase();
      const publisher = (window.TENANT_NAMES || {})[it.publisherId] || "";
      if (!`${it.app.name} ${it.app.package} ${publisher}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  }), [poolItems, updatesOnly, kindFilter, isPublishMode, category, statusFilter, modeFilter, deviceFilter, q]);

  const pager = window.usePaginated(filtered, 10,
    `${mode}|${kindFilter}|${updatesOnly}|${category}|${q}|${[...statusFilter].sort().join(",")}|${[...modeFilter].sort().join(",")}|${[...deviceFilter].sort().join(",")}`);

  const activeFilterCount =
    (statusFilter.size > 0 ? 1 : 0)
    + (modeFilter.size > 0 ? 1 : 0)
    + (deviceFilter.size > 0 ? 1 : 0)
    + (category !== "all" ? 1 : 0);
  const toggle = (set, setter, key) => {
    const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); setter(next);
  };

  // "Approve" routes to the standalone Approval screen (Review release).
  // From there, on Approve, the operator is asked whether to roll out now.
  const openPullWizard = (item) => {
    navigate({
      screen: "approval",
      appId: item.app.id,
      versionId: item.subscription.latestVersion.id,
      from: "appStore",
    });
  };

  // ── Header ─────────────────────────────────────────────
  const openBrowsePool = () => navigate({ screen: "browsePool" });

  const titleText = isPublishMode ? "App Publish" : "App Store";
  const subtitle = isPublishMode
    ? "Publish your applications to the TOMS public pool. ISO companies can subscribe to anything you publish here and push it to their merchants."
    : "Browse and manage apps you've subscribed to from the TOMS public pool. Snapshots are fixed at the version you approved — new ISV releases require manual approval.";
  const addLabel = isPublishMode ? "New app" : "Browse pool";
  const addIcon  = isPublishMode ? "plus"    : "search";
  const handleAdd = () => isPublishMode ? openNewApp() : openBrowsePool();

  // KPI tiles split by mode. Publish-mode surfaces ISV lifecycle states;
  // App publish-mode tab shows 4 KPI tiles. Two reflect lifecycle (Published,
  // Unpublished); one reflects mode (Specified ISOs). Pure-ISV tenants and
  // ISV+ISO tenants get the same set — Specified ISOs is meaningful in
  // both contracts (just with different semantics: invite links vs. own
  // tenant default).
  const isPureISV = !tenant.contracts.includes("ISO");

  const tiles = isPublishMode ? [
    { key: "total",       label: "Total apps",     value: totals.total,
      sub: "in your catalog",       filterTarget: "all" },
    { key: "published",   label: "Published",      value: totals.published,
      sub: "live · open for subscribers", tone: "success", filterStatus: "published" },
    { key: "unpublished", label: "Unpublished",    value: totals.unpublished,
      sub: "withdrawn · re-publish anytime", tone: totals.unpublished > 0 ? "warning" : undefined, filterStatus: "unpublished" },
    { key: "specified",   label: "Specified ISOs", value: totals.specified,
      sub: "hidden from public pool", filterMode: "private" },
  ] : [
    // Store-mode tiles — each one filters the table below by clicking.
    { key: "all",        label: "All apps",       value: totals.total,
      sub: "everything in your store",       filterKind: "all"        },
    { key: "own",        label: "Self-uploaded",  value: poolItems.filter(it => it.kind === "own").length,
      sub: "apps published by you",          filterKind: "own"        },
    { key: "subscribed", label: "Subscribed",     value: totals.subscribed,
      sub: "from other publishers",          filterKind: "subscribed" },
    { key: "updates",    label: "Updates pending", value: totals.updates,
      sub: totals.updates > 0 ? "needs approval" : "all caught up",
      tone: totals.updates > 0 ? "warning" : undefined,
      filterKind: "updates"    },
  ];

  const handleTileClick = (tile) => {
    if (tile.filterStatus) {
      const sameStatus = statusFilter.size === 1 && statusFilter.has(tile.filterStatus);
      if (sameStatus) {
        setStatusFilter(new Set());
      } else {
        setStatusFilter(new Set([tile.filterStatus]));
        setModeFilter(new Set());      // only one axis at a time
      }
      return;
    }
    if (tile.filterMode) {
      const same = modeFilter.size === 1 && modeFilter.has(tile.filterMode);
      if (same) {
        setModeFilter(new Set());
      } else {
        setModeFilter(new Set([tile.filterMode]));
        setStatusFilter(new Set());
      }
      return;
    }
    if (tile.filterKind) {
      setKindFilter(tile.filterKind);
      setUpdatesOnly(false); // kindFilter supersedes updatesOnly
      return;
    }
    if (!tile.filterTarget) return;
    if (tile.filterTarget === "all") {
      setStatusFilter(new Set());
      setModeFilter(new Set());
      setUpdatesOnly(false);
      return;
    }
    if (tile.filterTarget === "updates") {
      setUpdatesOnly(v => !v);
      return;
    }
  };

  const isTileActive = (tile) => {
    if (tile.filterStatus) {
      return statusFilter.size === 1 && statusFilter.has(tile.filterStatus);
    }
    if (tile.filterMode) {
      return modeFilter.size === 1 && modeFilter.has(tile.filterMode);
    }
    if (tile.filterKind) return kindFilter === tile.filterKind && !updatesOnly;
    if (tile.filterTarget === "updates") return updatesOnly;
    if (tile.filterTarget === "all") return statusFilter.size === 0 && modeFilter.size === 0 && !updatesOnly;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <window.PageHeader
        title={titleText}
        subtitle={subtitle}
        actions={
          <window.Button primary icon={addIcon} onClick={handleAdd}>{addLabel}</window.Button>
        } />

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg1)" }}>
        {/* KPI strip */}
        <div style={{ padding: "var(--space-5) var(--space-6) var(--space-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {tiles.map(k => {
              const isActive = isTileActive(k);
              const isClickable = !!(k.filterTarget || k.filterStatus);
              return (
              <button key={k.key}
                onClick={() => handleTileClick(k)}
                style={{
                  padding: "12px 16px", borderRadius: "var(--radius-lg)",
                  background: isActive ? "var(--color-primary-50)" : "var(--bg2)",
                  border: "1px solid",
                  borderColor: isActive ? "var(--color-primary-500)" : "var(--border-1)",
                  boxShadow: isActive ? "0 0 0 3px oklch(40% 0.14 262 / 0.08)" : "var(--shadow-1)",
                  cursor: isClickable ? "pointer" : "default",
                  textAlign: "left",
                  transition: "background var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard)",
                }}
                onMouseEnter={(e) => { if (isClickable && !isActive) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { if (isClickable && !isActive) e.currentTarget.style.background = "var(--bg2)"; }}>
                <div className="overline" style={{ fontSize: 10.5,
                    color: isActive ? "var(--color-primary-700)" : undefined }}>
                  {k.label}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span className="mono num" style={{ fontSize: 24,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: "-0.02em",
                    color: isActive ? "var(--color-primary-700)"
                         : k.tone === "success" ? "var(--success)"
                         : k.tone === "warning" ? "var(--warning)"
                         : "var(--fg1)" }}>
                    {k.value}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg3)" }}>{k.sub}</span>
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--space-3) var(--space-6)", flexWrap: "wrap" }}>
          <window.Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps, packages, publishers…"
            style={{ flex: 1, minWidth: 220, maxWidth: 360 }} />
          {/* Kind filter chips removed — mode partitions the list already. */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <window.Button size="sm" icon="filter" ghost={!advancedOpen && activeFilterCount === 0}
              onClick={() => setAdvancedOpen(v => !v)}>
              Advanced
              {activeFilterCount > 0 && (
                <span className="mono" style={{
                  marginLeft: 4, padding: "0 6px", borderRadius: 999,
                  background: "var(--color-primary-700)", color: "var(--color-text-on-primary)",
                  fontSize: 10, fontWeight: 600, lineHeight: "16px", height: 16,
                }}>{activeFilterCount}</span>
              )}
            </window.Button>
            {advancedOpen && (
              <AdvancedFilters
                category={category} categories={cats} onCategoryChange={setCategory}
                statusFilter={statusFilter} modeFilter={modeFilter} deviceFilter={deviceFilter}
                onToggleStatus={(k) => toggle(statusFilter, setStatusFilter, k)}
                onToggleMode={(k)   => toggle(modeFilter,   setModeFilter,   k)}
                onToggleDevice={(k) => toggle(deviceFilter, setDeviceFilter, k)}
                onClear={() => { setStatusFilter(new Set()); setModeFilter(new Set()); setDeviceFilter(new Set()); setCategory("all"); }}
                onClose={() => setAdvancedOpen(false)}
                isPureISV={!tenant.contracts.includes("ISO")} />
            )}
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
                    {(isStoreMode
                      ? ["App", "Publisher", "Category", "Latest version", "Status", ""]
                      : ["App",              "Category", "Latest version", "Status", "Mode", ""]
                    ).map((h, i) => (
                      <th key={i} className="overline" style={{
                        padding: "10px 14px", fontSize: 10.5,
                        borderBottom: "1px solid var(--border-1)",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pager.slice.map(it => <PoolRow key={it.key} item={it} tenant={tenant} navigate={navigate} onPull={openPullWizard} showPublisher={isStoreMode} fromEntry={isPublishMode ? "appPublish" : "appStore"} />)}
                  {pager.slice.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)" }}>
                      {poolItems.length === 0
                        ? (isPublishMode
                            ? "You haven't created any apps yet. Click “New app” above to start."
                            : "You haven't subscribed to any apps yet. Click “Browse pool” above to find apps to subscribe to.")
                        : "No apps match those filters."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <window.Pagination
              page={pager.page} pageSize={pager.pageSize} total={pager.total}
              onChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
          </div>
        </div>
      </div>

      {/* AddAppDialog removed — the menu is now split by mode so we don't need
          the chooser. The action button directly opens the right flow. */}
    </div>
  );
}

// One row in the unified app pool. Renders different details based on whether
// the row is an owned app or a subscribed snapshot from another ISV.
function PoolRow({ item, tenant, navigate, onPull, showPublisher, fromEntry }) {
  const isOwn = item.kind === "own";
  const isOwnTenant = item.publisherId === tenant.id;
  const publisherName = (window.TENANT_NAMES || {})[item.publisherId] || "—";
  const onClick = () => navigate({ screen: "appDetail", appId: item.app.id, tab: "overview", from: fromEntry });

  // What goes in "Latest version" depends on whether this is your app or a
  // snapshot you pulled. For snapshots we show the version you're running and
  // hint that a newer one is available if applicable.
  let versionCell;
  if (isOwn) {
    const latest = item.app.versions[0];
    if (!latest) {
      versionCell = (
        <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
          No versions yet
        </span>
      );
    } else {
      versionCell = (
        <>
          <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{latest.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{latest.publishedAt || latest.uploadedAt}</div>
        </>
      );
    }
  } else {
    const { subscribedVersion, latestVersion, isOutdated } = item.subscription;
    versionCell = (
      <>
        <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{subscribedVersion.name}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {isOutdated
            ? <>v<span className="mono" style={{ color: "var(--color-warning-700)" }}>{latestVersion.name}</span> available</>
            : <>approved {item.subscription.subscribedAt}</>}
        </div>
      </>
    );
  }

  // Status pill
  // Per App Store spec: own apps always display "On latest" (their own
  // versions are by definition current); subscribed apps display
  // Update available / On latest based on snapshot freshness.
  // In App Publish mode we still show the canonical publish state
  // (Published / Unpublished) for own apps so publishers can see
  // lifecycle at a glance.
  let statusCell;
  let modeCell = null;
  const isStoreView = fromEntry === "appStore";
  if (isOwn) {
    if (isStoreView) {
      statusCell = <window.Pill tone="success" dot>On latest</window.Pill>;
    } else {
      const st = window.APP_STATUS[item.app.status];
      statusCell = <window.Pill tone={st.tone} dot>{st.label}</window.Pill>;
      const m = (window.APP_PUBLISH_MODE || {})[item.app.publishMode || "public"];
      modeCell = m ? <window.Pill tone={m.tone} dot>{m.label}</window.Pill> : null;
    }
  } else {
    statusCell = item.subscription.isOutdated
      ? <window.Pill tone="warning" dot>Update available</window.Pill>
      : <window.Pill tone="success" dot>On latest</window.Pill>;
  }

  return (
    <tr
      onClick={onClick}
      style={{ cursor: "pointer", borderBottom: "1px solid var(--border-1)" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <td style={{ padding: "12px 14px" }}><AppMeta app={item.app} /></td>
      {showPublisher && (
        <td style={{ padding: "12px 14px" }}>
          <span style={{ fontSize: 12.5, color: "var(--fg1)", fontWeight: 450 }}>{publisherName}</span>
        </td>
      )}
      <td style={{ padding: "12px 14px", color: "var(--fg2)" }}>{item.app.category}</td>
      <td style={{ padding: "12px" }}>{versionCell}</td>
      <td style={{ padding: "12px" }}>{statusCell}</td>
      {!isStoreView && (
        <td style={{ padding: "12px" }}>{modeCell || <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>—</span>}</td>
      )}
      <td style={{ padding: "12px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        {item.kind === "subscribed" && item.subscription.isOutdated
          ? <window.Button size="sm" variant="primary" icon="download" onClick={() => onPull(item)}>
              Approve <span className="mono" style={{ marginLeft: 2 }}>{item.subscription.latestVersion.name}</span>
            </window.Button>
          : <window.Ico name="chevr" size={14} style={{ color: "var(--color-text-tertiary)" }} />}
      </td>
    </tr>
  );
}

// Pull-update confirmation modal. Shown when an ISO clicks "Pull vN.N.N" in
// the unified pool table. Displays the version transition, release notes,
// scan status, and a permission diff before the user commits to the pull.
function PullVersionModal({ item, onClose, onConfirm }) {
  const open = !!item;
  if (!open) return null;
  const { app, subscription } = item;
  const cur = subscription.subscribedVersion;
  const next = subscription.latestVersion;
  const permDelta = (next.perms || 0) - (cur.perms || 0);
  const scan = next.scan || "—";
  const scanTone = scan === "clean"     ? "success"
                 : scan === "cleanish"  ? "info"
                 : scan === "dirty"     ? "warning"
                 : "neutral";
  const scanLabel = scan === "clean"     ? "Clean — no findings"
                  : scan === "cleanish"  ? "Mostly clean — low-severity findings only"
                  : scan === "dirty"     ? "Findings present — review before pulling"
                  : "No scan data";

  return (
    <window.Modal open onClose={onClose} width={620}
      title={<>Approve new version — <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{app.name}</span></>}
      subtitle="Once approved, this app's snapshot in your pool flips to the new version. Existing terminal deployments keep running the previous version until you push the update from your device fleet."
      padding={0}
      footer={
        <>
          <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--fg3)",
                         display: "inline-flex", alignItems: "center", gap: 6 }}>
            <window.Ico name="info" size={12} />
            <span>Approving does not auto-deploy to terminals — handle that from Devices.</span>
          </span>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="download" onClick={onConfirm}>
            Approve update
          </window.Button>
        </>
      }>
      {/* App + version transition */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border-1)",
      }}>
        <window.AppIcon app={app} size={44} radius={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg1)" }}>{app.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--fg3)" }}>{app.package}</div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 32px 1fr",
        alignItems: "center", gap: 8,
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border-1)",
        background: "var(--bg2)",
      }}>
        {/* Current */}
        <div style={{
          padding: "10px 12px",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg1)",
        }}>
          <div className="overline" style={{ fontSize: 10, marginBottom: 4 }}>Current snapshot</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg1)" }}>{cur.name}</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>code {cur.code}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 4 }}>
            Approved {subscription.subscribedAt}
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center" }}>
          <window.Ico name="arrowR" size={18} style={{ color: "var(--accent)" }} />
        </div>
        {/* New */}
        <div style={{
          padding: "10px 12px",
          border: "1px solid var(--color-primary-500)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-primary-50)",
        }}>
          <div className="overline" style={{ fontSize: 10, marginBottom: 4, color: "var(--color-primary-700)" }}>New version</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary-700)" }}>{next.name}</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--color-primary-700)", opacity: 0.7 }}>code {next.code}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-primary-700)", opacity: 0.85, marginTop: 4 }}>
            Published {next.publishedAt || next.uploadedAt}
          </div>
        </div>
      </div>

      {/* Body — release notes + details */}
      <div style={{ padding: "var(--space-4) var(--space-5)", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Release notes */}
        <section>
          <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Release notes</div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--fg2)" }}>
            {next.notes || "No release notes provided."}
          </p>
        </section>

        {/* Detail grid */}
        <section>
          <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Version details</div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "var(--space-3) var(--space-5)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg2)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
          }}>
            <KvCol label="Size"     value={<span className="mono">{next.size}</span>} sub={<span style={{ color: "var(--fg3)" }}>was {cur.size}</span>} />
            <KvCol label="Min Android"    value={<>{androidVersionName(next.minSdk)} <span className="mono" style={{ color: "var(--fg3)" }}>· API {next.minSdk}</span></>} />
            <KvCol label="Target Android" value={<>{androidVersionName(next.targetSdk)} <span className="mono" style={{ color: "var(--fg3)" }}>· API {next.targetSdk}</span></>} />
            <KvCol label="Permissions"
              value={<span className="mono num">{next.perms || 0}</span>}
              sub={permDelta === 0
                ? <span style={{ color: "var(--fg3)" }}>no change</span>
                : permDelta > 0
                  ? <span style={{ color: "var(--color-warning-700)" }}>+{permDelta} new — review</span>
                  : <span style={{ color: "var(--color-success-700)" }}>{permDelta} removed</span>} />
            <KvCol label="Security scan"
              value={<window.Pill tone={scanTone} dot size="sm">{scan === "—" ? "—" : scan.replace(/^\w/, c => c.toUpperCase())}</window.Pill>}
              sub={<span style={{ color: "var(--fg3)" }}>{scanLabel}</span>} />
            <KvCol label="Reach"
              value={<><span className="mono num">{next.reach || 0}</span> ISO {(next.reach || 0) === 1 ? "company" : "companies"}</>}
              sub={<span style={{ color: "var(--fg3)" }}>have approved this version</span>} />
          </div>
        </section>

        {/* Warnings */}
        {(scan === "dirty" || permDelta > 0) && (
          <section style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px",
            background: "var(--warning-bg)",
            border: "1px solid oklch(70% 0.16 70 / 0.25)",
            borderRadius: "var(--radius-md)",
          }}>
            <window.Ico name="alert" size={14} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: "var(--color-warning-700)", lineHeight: 1.5 }}>
              {scan === "dirty" && <div>The publisher's security scan flagged this build. Review findings on the version detail page before deploying to terminals.</div>}
              {permDelta > 0 && <div>This version requests <b>{permDelta}</b> new permission{permDelta === 1 ? "" : "s"}. Open the version detail to inspect what's being asked.</div>}
            </div>
          </section>
        )}
      </div>
    </window.Modal>
  );
}

function KvCol({ label, value, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span className="overline" style={{ fontSize: 9.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--fg1)", display: "inline-flex", alignItems: "center", gap: 6 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, lineHeight: 1.4 }}>{sub}</span>}
    </div>
  );
}

// Small chooser shown to dual-contract tenants when they click "Add to pool".
function AddAppDialog({ open, onClose, onRegister, onSubscribe }) {
  const cards = [
    { id: "register",  icon: "upload",  label: "Register a new app",        body: "Upload your own APK and publish it to the pool. Available because your tenant holds an ISV contract.", onClick: onRegister },
    { id: "subscribe", icon: "download",label: "Subscribe from app pool",   body: "Browse apps other ISVs have made visible to you and subscribe to a snapshot you can deploy to terminals.", onClick: onSubscribe },
  ];
  return (
    <window.Modal open={open} onClose={onClose} width={620}
      title="Add an app to your pool"
      subtitle="Your pool can hold apps you publish yourself plus snapshots you subscribe to from other ISV publishers."
      footer={<window.Button onClick={onClose}>Cancel</window.Button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {cards.map(c => (
          <button key={c.id} onClick={c.onClick} style={{
            padding: 16, textAlign: "left",
            background: "var(--bg2)",
            border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            transition: "all var(--duration-fast) var(--easing-standard)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-primary-50)";
            e.currentTarget.style.borderColor  = "var(--color-primary-500)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg2)";
            e.currentTarget.style.borderColor = "var(--border-2)";
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--radius-md)",
                background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                display: "grid", placeItems: "center",
              }}><window.Ico name={c.icon} size={14} stroke={1.7} /></div>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg1)" }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg3)", lineHeight: 1.5 }}>{c.body}</div>
          </button>
        ))}
      </div>
    </window.Modal>
  );
}

// ─── Advanced-filter modal for Apps List ────────────────
// Compact device-picker: search + grouped scrollable checklist,
// with currently-selected chips at the top. Scales to 20–40+ models.
function DeviceFilterList({ deviceFilter, onToggleDevice }) {
  const [q, setQ] = useStateS("");
  const models = window.DEVICE_MODELS;

  const filteredModels = useMemoS(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter(d =>
      d.id.toLowerCase().includes(needle) ||
      d.label.toLowerCase().includes(needle) ||
      d.family.toLowerCase().includes(needle));
  }, [q, models]);

  // Group by family for visual structure within the list
  const grouped = useMemoS(() => {
    const out = new Map();
    filteredModels.forEach(d => {
      if (!out.has(d.family)) out.set(d.family, []);
      out.get(d.family).push(d);
    });
    return [...out.entries()];
  }, [filteredModels]);

  const selectedItems = [...deviceFilter];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Selected chip strip — only shown when something is selected */}
      {selectedItems.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 4,
          padding: "8px 10px",
          background: "var(--color-primary-50)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-primary-200)",
        }}>
          {selectedItems.map(id => (
            <button key={id} onClick={() => onToggleDevice(id)} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 4px 2px 8px", borderRadius: 999,
              background: "var(--bg2)",
              border: "1px solid var(--color-primary-200)",
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--color-primary-700)", fontWeight: 500,
            }}>
              {id}
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                display: "grid", placeItems: "center",
                color: "var(--color-primary-700)",
              }} title="Remove"><window.Ico name="x" size={9} stroke={2.5} /></span>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <window.Input
        size="sm"
        prefix={<window.Ico name="search" size={12} />}
        placeholder={`Search ${models.length} models — name, family, ID…`}
        value={q}
        onChange={(e) => setQ(e.target.value)} />

      {/* Scrollable grouped checklist */}
      <div style={{
        maxHeight: 240, overflowY: "auto",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg2)",
      }}>
        {grouped.length === 0 ? (
          <div style={{
            padding: "20px 12px", textAlign: "center",
            fontSize: 12, color: "var(--fg3)",
          }}>No models match "{q}"</div>
        ) : grouped.map(([family, items]) => (
          <div key={family}>
            <div className="overline" style={{
              position: "sticky", top: 0,
              padding: "4px 10px",
              fontSize: 10,
              background: "var(--bg3)",
              borderBottom: "1px solid var(--border-1)",
            }}>{family} family</div>
            {items.map(d => {
              const on = deviceFilter.has(d.id);
              return (
                <label key={d.id} onClick={(e) => { e.preventDefault(); onToggleDevice(d.id); }} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--border-1)",
                  cursor: "pointer",
                  background: on ? "var(--color-primary-50)" : "transparent",
                  transition: "background var(--duration-fast) var(--easing-standard)",
                }}>
                  <span style={{
                    width: 15, height: 15, flexShrink: 0,
                    borderRadius: 3,
                    border: "1.5px solid",
                    borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                    background: on ? "var(--color-primary-500)" : "var(--bg1)",
                    display: "grid", placeItems: "center", color: "#fff",
                  }}>
                    {on && <window.Ico name="check" size={9} stroke={3} />}
                  </span>
                  <span className="mono" style={{
                    fontSize: 12, fontWeight: 500,
                    color: on ? "var(--color-primary-700)" : "var(--fg1)",
                    minWidth: 60,
                  }}>{d.id}</span>
                  <span className="truncate" style={{
                    flex: 1, fontSize: 11.5,
                    color: on ? "var(--color-primary-700)" : "var(--fg3)",
                  }}>{d.blurb}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggleDevice(d.id)}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  />
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedFilters({ category, categories, onCategoryChange, statusFilter, modeFilter, deviceFilter, onToggleStatus, onToggleMode, onToggleDevice, onClear, onClose, isPureISV }) {
  const activeCount =
      statusFilter.size
    + (modeFilter ? modeFilter.size : 0)
    + deviceFilter.size
    + (category !== "all" ? 1 : 0);

  const FilterSection = ({ label, hint, count, children }) => (
    <section style={{
      padding: "var(--space-4) var(--space-5)",
      borderBottom: "1px solid var(--border-1)",
    }}>
      <header style={{ marginBottom: "var(--space-3)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap",
        }}>
          <h4 className="h4" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{label}</h4>
          {count > 0 && (
            <span className="mono" style={{
              fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
              background: "var(--color-primary-50)", color: "var(--color-primary-700)",
              fontWeight: 500,
            }}>{count} selected</span>
          )}
        </div>
        {hint && (
          <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--fg3)" }}>{hint}</div>
        )}
      </header>
      {children}
    </section>
  );

  return (
    <window.Modal open onClose={onClose} width={560}
      title="Advanced filters"
      subtitle="Narrow the list by category, lifecycle status, or device compatibility."
      padding={0}
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--fg3)", whiteSpace: "nowrap" }}>
            {activeCount === 0 ? "No filters applied" :
             <><b className="num" style={{ color: "var(--fg2)" }}>{activeCount}</b> filter{activeCount > 1 ? "s" : ""} applied</>}
          </span>
          <div style={{ flex: 1 }} />
          <window.Button ghost onClick={onClear} disabled={activeCount === 0}>Clear all</window.Button>
          <window.Button primary onClick={onClose}>Apply</window.Button>
        </>
      }>
      {/* ── Category ───────────────────────────────────────── */}
      <FilterSection label="Category"
                     count={category !== "all" ? 1 : 0}
                     hint="Single choice">
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
        }}>
          {categories.map(c => {
            const on = c === category;
            return (
              <button key={c} onClick={() => onCategoryChange(c)} style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: on ? "var(--color-primary-50)" : "var(--bg2)",
                color: on ? "var(--color-primary-700)" : "var(--fg2)",
                border: "1px solid",
                borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                fontSize: 12, fontWeight: on ? 500 : 400,
                textTransform: "capitalize",
                transition: "all var(--duration-fast) var(--easing-standard)",
                boxShadow: on ? "var(--shadow-1)" : "none",
              }}>{c}</button>
            );
          })}
        </div>
      </FilterSection>

      {/* ── Lifecycle status ────────────────────────────── */}
      <FilterSection label="Lifecycle status" count={statusFilter.size}
                     hint="Select one or more">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 8,
        }}>
          {["published", "unpublished"]
            .map(k => [k, window.APP_STATUS[k]])
            .map(([k, v]) => {
              const on = statusFilter.has(k);
              return (
                <button key={k} onClick={() => onToggleStatus(k)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  background: on ? "var(--color-primary-50)" : "var(--bg2)",
                  color: on ? "var(--color-primary-700)" : "var(--fg2)",
                  border: "1px solid",
                  borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                  fontSize: 12.5, fontWeight: on ? 500 : 400,
                  textAlign: "left",
                  transition: "all var(--duration-fast) var(--easing-standard)",
                  boxShadow: on ? "var(--shadow-1)" : "none",
                }}>
                  <span style={{
                    width: 14, height: 14, flexShrink: 0,
                    borderRadius: 3,
                    border: "1.5px solid",
                    borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                    background: on ? "var(--color-primary-500)" : "var(--bg1)",
                    display: "grid", placeItems: "center",
                    color: "#fff",
                  }}>
                    {on && <window.Ico name="check" size={9} stroke={3} />}
                  </span>
                  <span>{v.label}</span>
                </button>
              );
            })}
        </div>
      </FilterSection>

      {/* ── Publish mode ───────────────────────────────── */}
      {modeFilter && onToggleMode && (
        <FilterSection label="Publish mode" count={modeFilter.size}
                       hint="Independent of lifecycle status">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 8,
          }}>
            {["public", "private"]
              .map(k => [k, (window.APP_PUBLISH_MODE || {})[k]])
              .map(([k, v]) => {
                const on = modeFilter.has(k);
                return (
                  <button key={k} onClick={() => onToggleMode(k)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    background: on ? "var(--color-primary-50)" : "var(--bg2)",
                    color: on ? "var(--color-primary-700)" : "var(--fg2)",
                    border: "1px solid",
                    borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                    fontSize: 12.5, fontWeight: on ? 500 : 400,
                    textAlign: "left",
                    transition: "all var(--duration-fast) var(--easing-standard)",
                    boxShadow: on ? "var(--shadow-1)" : "none",
                  }}>
                    <span style={{
                      width: 14, height: 14, flexShrink: 0,
                      borderRadius: 3,
                      border: "1.5px solid",
                      borderColor: on ? "var(--color-primary-500)" : "var(--border-2)",
                      background: on ? "var(--color-primary-500)" : "var(--bg1)",
                      display: "grid", placeItems: "center",
                      color: "#fff",
                    }}>
                      {on && <window.Ico name="check" size={9} stroke={3} />}
                    </span>
                    <span>{v ? v.label : k}</span>
                  </button>
                );
              })}
          </div>
        </FilterSection>
      )}

      {/* ── Device compatibility ──────────────────────────── */}
      <FilterSection label="Compatible with device" count={deviceFilter.size}
                     hint={`${window.DEVICE_MODELS.length} models`}>
        <DeviceFilterList
          deviceFilter={deviceFilter}
          onToggleDevice={onToggleDevice} />
      </FilterSection>
    </window.Modal>
  );
}

// ─── App detail screen (tabs) ─────────────────────────────
function AppDetailScreen({ app, route, navigate, openPublishWizard, openEditApp }) {
  const tab = route.tab || "overview";
  const tenant = window.useActiveTenant();
  const [unsubscribeOpen, setUnsubscribeOpen] = useStateS(false);
  const publisherName = (window.TENANT_NAMES || {})[app.publisherTenantId] || app.publisherTenantId || "Unknown";
  const isOwnApp = app.publisherTenantId === tenant.id;

  // ISO subscription lookup — if the active tenant has subscribed to this
  // app from another ISV, we render the page in subscriber mode.
  const subscriptionRaw = !isOwnApp
    ? ((window.SUBSCRIBED_APPS || {})[tenant.id] || []).find(s => s.appId === app.id)
    : null;
  // Resolve subscription each render — it's a cheap lookup and stays fresh
  // when the wizard returns and the data has been mutated in place.
  const liveSubscription = subscriptionRaw ? window.resolveSubscription(subscriptionRaw) : null;

  // "Effective version" for the header — own apps show their latest, subscribed
  // apps show the snapshot the ISO is running.
  const ownLatest = app.versions.find(v => v.current) || app.versions[0];
  const headerVersion = liveSubscription ? liveSubscription.subscribedVersion : ownLatest;
  const latest = ownLatest;

  const st = window.APP_STATUS[app.status];

  // "Approve" routes to the standalone Approval screen for Review release.
  const openPullWizard = (targetVersion) => {
    navigate({
      screen: "approval",
      appId: app.id,
      versionId: targetVersion.id,
      from: route.from || "appStore",
    });
  };

  // Tabs are driven by ENTRY POINT, not just ownership.
  //   From App Publish (publisher hat)  → Subscribers (who's pulled this app)
  //   From App Store   (operator hat)   → Deployments (where I've installed it)
  // The same own-app surfaces both views for ISV+ISO tenants — they just
  // need to walk in through the right list. Versions, Overview and Settings
  // adapt their inner content to ownership separately.
  const fromEntry = route.from || (isOwnApp ? "appPublish" : "appStore");
  const isFromPublish = fromEntry === "appPublish";
  const subscriberCount = (app.subscriberIds || []).length;
  const tabs = isFromPublish ? [
    { id: "overview",    label: "Overview" },
    { id: "versions",    label: "Versions",    count: app.versions.length },
    { id: "subscribers", label: "Subscribers", count: subscriberCount },
    { id: "settings",    label: "Settings" },
  ] : [
    { id: "overview",    label: "Overview" },
    { id: "versions",    label: "Versions", count: app.versions.length },
    { id: "deployments", label: "Deployments" },
    { id: "settings",    label: "Settings" },
  ];
  const validTabIds = new Set(tabs.map(t => t.id));
  const effectiveTab = validTabIds.has(tab) ? tab : "overview";

  // Header pills:
  //   own apps   → 2 pills: lifecycle status + publish mode
  //   subscriber → 1 pill:  snapshot freshness (On latest / Update available)
  const lifecyclePill = isOwnApp
    ? { tone: st.tone, label: st.label }
    : { tone: liveSubscription?.isOutdated ? "warning" : "success",
        label: liveSubscription?.isOutdated ? "Update available" : "On latest" };
  const modePillMeta = isOwnApp
    ? (window.APP_PUBLISH_MODE || {})[app.publishMode || "public"]
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--color-bg-2)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <window.AppIcon app={app} size={56} radius={12} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>{app.name}</h1>
              <window.Pill tone={lifecyclePill.tone} dot size="lg">{lifecyclePill.label}</window.Pill>
              {modePillMeta && (
                <window.Pill tone={modePillMeta.tone} dot size="lg">{modePillMeta.label}</window.Pill>
              )}
              <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>·</span>
              <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{app.category}</span>
            </div>
            <div className="mono" style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)",
              display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>
                {app.package}
                <button style={{ color: "var(--color-text-tertiary)", padding: "0 4px", marginLeft: 4 }} title="Copy package name">
                  <window.Ico name="copy" size={11} />
                </button>
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
              {isOwnApp ? (
                <span style={{ whiteSpace: "nowrap" }}>Latest <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{latest?.name || "—"}</span></span>
              ) : (
                <>
                  <span>Your snapshot <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{liveSubscription?.subscribedVersion.name}</span></span>
                  {liveSubscription?.isOutdated && (
                    <>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ color: "var(--color-warning-700)" }}>
                        v<span className="mono">{liveSubscription.latestVersion.name}</span> available
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, paddingTop: 4, flexShrink: 0 }}>
            {isOwnApp ? (
              <>
                <window.Button primary icon="upload" onClick={() => openPublishWizard(app)}>Upload new version</window.Button>
              </>
            ) : (
              <>
                {/* Unsubscribe lives in the Settings tab — no header
                    button to keep the chrome consistent with other
                    subscriber-side surfaces. */}
                {liveSubscription?.isOutdated && (
                  <window.Button primary icon="download"
                    onClick={() => openPullWizard(liveSubscription.latestVersion)}>
                    Approve <span className="mono" style={{ marginLeft: 2 }}>{liveSubscription.latestVersion.name}</span>
                  </window.Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "16px 16px 0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => navigate({ ...route, tab: t.id })} style={{
              padding: "7px 12px",
              fontSize: 12.5, fontWeight: effectiveTab === t.id ? 500 : 400,
              color: effectiveTab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              borderBottom: "2px solid",
              borderColor: effectiveTab === t.id ? "var(--color-text-primary)" : "transparent",
              marginBottom: -1, display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {t.label}
              {t.count != null && (
                <span className="mono num" style={{
                  fontSize: 10.5, padding: "0 5px", borderRadius: 999,
                  background: effectiveTab === t.id ? "var(--accent-soft)" : "var(--bg3)",
                  color:      effectiveTab === t.id ? "var(--accent)"      : "var(--fg3)",
                  border: "1px solid",
                  borderColor: effectiveTab === t.id ? "var(--accent-soft)" : "var(--border-1)",
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", background: "var(--color-bg-1)" }}>
        {effectiveTab === "overview" && (isOwnApp
          ? <AppOverview app={app} navigate={navigate} route={route} />
          : <SubscribedAppOverview app={app} subscription={liveSubscription}
              navigate={navigate}
              route={route}
              onPull={() => openPullWizard(liveSubscription.latestVersion)} />)}
        {effectiveTab === "versions"    && <AppVersions app={app} navigate={navigate} openPublishWizard={openPublishWizard}
                                                       currentSubscribedId={liveSubscription?.subscribedVersion.id}
                                                       isOwnApp={isOwnApp}
                                                       route={route}
                                                       onPullVersion={(v) => openPullWizard(v)} />}
        {effectiveTab === "subscribers" && <AppSubscribers app={app} />}
        {effectiveTab === "deployments" && <SubscribedDeployments app={app} subscription={liveSubscription} initialVersionFilter={route.filterVersionId} />}
        {effectiveTab === "settings"    && (isOwnApp
          ? <AppSettings app={app} />
          : <SubscriptionSettings app={app} subscription={liveSubscription}
              onUnsubscribe={() => setUnsubscribeOpen(true)} />)}
      </div>
      <UnsubscribeModal
        open={unsubscribeOpen}
        onClose={() => setUnsubscribeOpen(false)}
        app={app}
        tenant={tenant}
        onDone={() => { setUnsubscribeOpen(false); navigate({ screen: "appStore" }); }} />
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────
// Publisher row — surfaced inside the Overview's About card so it's part of
// the app's narrative rather than crowding the page header.
function PublisherRow({ publisherName, isOwnApp }) {
  return (
    <div style={{
      marginTop: 14, paddingTop: 12,
      borderTop: "1px dashed var(--color-border-subtle)",
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <window.Ico name="store" size={13} style={{ color: "var(--color-text-tertiary)" }} />
      <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Published by</span>
      <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{publisherName}</span>
      {isOwnApp && (
        <span style={{
          fontSize: 11, color: "var(--color-success-700)",
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "1px 8px", borderRadius: 999,
          background: "var(--success-bg)",
          border: "1px solid oklch(58% 0.14 152 / 0.25)",
        }}>
          <window.Ico name="check" size={10} stroke={2.5} />
          your organization
        </span>
      )}
    </div>
  );
}

// ─── Publish settings card (own apps only) ────────────────
// Single card that surfaces BOTH axes of an app's publish state:
//
//   · Mode      — All ISOs (public) ↔ Specified ISOs (private)
//                 who can subscribe? Independent of lifecycle.
//   · Status    — Published ↔ Unpublished
//                 is the app open for new subscriptions / version pushes?
//
// The two axes are orthogonal — switching mode never flips status, and
// vice versa. Activity log records each change with its own event kind.
function PublishSettingsCard({ app, navigate }) {
  const tenant = window.useActiveTenant();
  const isOwnApp = app.publisherTenantId === tenant.id;
  const [activityOpen, setActivityOpen] = useStateS(false);
  const [unpublishOpen, setUnpublishOpen] = useStateS(false);
  const [republishOpen, setRepublishOpen] = useStateS(false);
  const [modeOpen, setModeOpen]           = useStateS(false);
  if (!isOwnApp) return null;
  const rv = window.APP_STATUS[app.status] || window.APP_STATUS.published;
  const mode = app.publishMode || "public";
  const mm = (window.APP_PUBLISH_MODE || {})[mode] || (window.APP_PUBLISH_MODE || {}).public;

  const activity = (app.reviewActivity || []).slice().reverse(); // newest first
  const lastEvent = activity[0];

  // Lifecycle CTA
  const lifecycleCta = app.status === "unpublished"
    ? <window.Button size="sm" primary icon="upload" onClick={() => setRepublishOpen(true)}>Re-publish</window.Button>
    : <window.Button size="sm" ghost icon="alert" onClick={() => setUnpublishOpen(true)}>Unpublish</window.Button>;

  const lifecycleBody = app.status === "unpublished"
    ? "Withdrawn. Existing subscribers keep running their snapshot; no new subscriptions or version pushes are accepted."
    : "Live. Subscribers receive version notifications and new ISOs can subscribe.";

  const modeBody = mode === "private"
    ? "Hidden from the public pool. Only the ISOs you specify can subscribe."
    : "Listed in the public pool. Any ISO can browse and subscribe.";

  return (
    <>
    <window.Card title="Publish settings"
      action={activity.length > 0 && (
        <button onClick={() => setActivityOpen(true)} style={{
          fontSize: 11, color: "var(--color-text-tertiary)",
          textDecoration: "underline", textUnderlineOffset: 2,
          textDecorationColor: "var(--color-border-default)",
          textDecorationStyle: "dotted",
        }}>
          {activity.length} {activity.length === 1 ? "event" : "events"}
        </button>
      )}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Mode row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span className="overline" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Mode</span>
              <window.Pill tone={mm.tone} dot>{mm.label}</window.Pill>
            </div>
            <window.Button size="sm" ghost icon="edit" onClick={() => setModeOpen(true)}>Change</window.Button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
            {modeBody}
          </div>
        </div>

        <div style={{ height: 1, background: "var(--color-border-subtle)" }} />

        {/* Lifecycle row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span className="overline" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Status</span>
              <window.Pill tone={rv.tone} dot>{rv.label}</window.Pill>
            </div>
            {lifecycleCta}
          </div>
          <div style={{
            fontSize: 11.5,
            color: app.status === "unpublished" ? "var(--color-warning-700)" : "var(--color-text-tertiary)",
            lineHeight: 1.5,
          }}>
            {lifecycleBody}
          </div>
        </div>

        {lastEvent && (
          <div style={{
            paddingTop: 8,
            borderTop: "1px dashed var(--color-border-subtle)",
            fontSize: 10.5, color: "var(--color-text-tertiary)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <window.Ico name="clock" size={10} stroke={1.8} />
            <span style={{ whiteSpace: "nowrap" }}>Last: {(REVIEW_KIND[lastEvent.kind] || REVIEW_KIND.created).label.toLowerCase()}</span>
            <span className="mono" style={{ whiteSpace: "nowrap" }}>· {lastEvent.at}</span>
          </div>
        )}
      </div>
    </window.Card>

    <PublishActivityModal app={app} activity={activity} open={activityOpen} onClose={() => setActivityOpen(false)} />

    {/* Re-publish confirmation */}
    <PublishToPoolModal app={app} open={republishOpen}
      onClose={() => setRepublishOpen(false)}
      onConfirm={() => {
        setRepublishOpen(false);
        const target = (window.APPS || []).find(a => a.id === app.id);
        if (target) {
          target.status = "published";
          target.reviewActivity = [...(target.reviewActivity || []), {
            kind: "republished", at: "just now", actor: "You",
            note: "Re-published — open again for new subscriptions and version pushes.",
          }];
          window.showToast?.(`"${app.name}" re-published`, "success");
        }
      }} />

    {/* Unpublish confirmation */}
    <window.ConfirmDialog
      open={unpublishOpen}
      onClose={() => setUnpublishOpen(false)}
      title={`Unpublish "${app.name}"?`}
      body={
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            padding: "10px 12px",
            background: "var(--warning-bg)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-warning-700)",
            lineHeight: 1.55,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <window.Ico name="email" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Subscribed ISO companies will receive an <b>email notification</b> that this app has been withdrawn.</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
            <li>Devices already running the app are <b>not affected</b> — existing installs keep working.</li>
            <li>Subscribed ISO companies <b>can't push to any new device</b> from the moment you unpublish.</li>
            <li>Subscriptions stay on the ISO's records — they can manually unsubscribe or keep them for reference.</li>
            <li>You can re-publish anytime — one click, no review.</li>
          </ul>
        </div>
      }
      confirmLabel="Unpublish"
      tone="danger"
      icon="alert"
      onConfirm={() => {
        setUnpublishOpen(false);
        const target = (window.APPS || []).find(a => a.id === app.id);
        if (target) {
          target.status = "unpublished";
          target.reviewActivity = [...(target.reviewActivity || []), {
            kind: "unpublished", at: "just now", actor: "You",
            note: "Withdrawn — subscribers notified by email.",
          }];
        }
        window.showToast?.(`"${app.name}" unpublished · subscribers notified by email`, "warning");
      }} />

    {/* Mode change modal */}
    <PublishModeModal app={app} open={modeOpen} onClose={() => setModeOpen(false)} />
    </>
  );
}

// ─── Re-publish confirmation ──────────────────────────────
// Surfaces the consequences of restoring an unpublished app. There is no
// initial "publish" path anymore — apps are published the moment they are
// created. This modal is only used for re-publish after an unpublish.
// modal — copy adapts.
function PublishToPoolModal({ app, open, onClose, onConfirm }) {
  if (!open) return null;
  const latest = (app.versions || []).find(v => v.current) || (app.versions || [])[0];
  return (
    <window.Modal open onClose={onClose} width={560}
      title={`Re-publish "${app.name}"?`}
      subtitle="The app will be open again for new subscriptions and version pushes. Existing subscribers' snapshots are unaffected."
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="upload" onClick={onConfirm}>
            Re-publish
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          padding: "10px 12px",
          background: "var(--color-bg-3)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <window.AppIcon app={app} size={36} radius={8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{app.name}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {app.package}{latest ? <> · <span style={{ color: "var(--color-text-secondary)" }}>{latest.name}</span> latest</> : null}
            </div>
          </div>
        </div>
        <div>
          <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>What happens next</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
            <li>Subscribers receive a notification that the app is back online.</li>
            <li>New subscriptions are open again, subject to the current publish mode (All ISOs / Specified ISOs).</li>
            <li>You can unpublish again at any time — no review needed.</li>
          </ul>
        </div>
      </div>
    </window.Modal>
  );
}

// Full activity timeline — mounted from the compact card's "N events" link.
function PublishActivityModal({ app, activity, open, onClose }) {
  if (!open) return null;
  return (
    <window.Modal open onClose={onClose} width={580}
      title={<>Publish history — <span style={{ fontWeight: 500 }}>{app.name}</span></>}
      subtitle="Every create, upload, publish, unpublish, re-publish event for this app.">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>Timeline</div>
          {activity.length === 0 ? (
            <div style={{
              padding: "20px 14px", textAlign: "center",
              fontSize: 12, color: "var(--color-text-tertiary)",
              border: "1px dashed var(--color-border-subtle)",
              borderRadius: "var(--radius-md)",
            }}>No activity yet.</div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
              {activity.map((a, i) => {
                const meta = REVIEW_KIND[a.kind] || REVIEW_KIND.created;
                return (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start",
                    paddingBottom: i < activity.length - 1 ? 12 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: meta.bg, color: meta.color,
                        display: "grid", placeItems: "center",
                        border: `1px solid ${meta.border}`,
                      }}><window.Ico name={meta.icon} size={11} stroke={2.2} /></span>
                      {i < activity.length - 1 && (
                        <span style={{ width: 1, flex: 1, marginTop: 2,
                          background: "var(--color-border-subtle)", minHeight: 18 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>{meta.label}</span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{a.at}</span>
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>· {a.actor}</span>
                      </div>
                      {a.note && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>
                          {a.note}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </window.Modal>
  );
}

const REVIEW_KIND = {
  created:           { label: "App created",                  icon: "plus",    color: "var(--color-text-secondary)", bg: "var(--color-bg-3)",     border: "var(--color-border-subtle)" },
  "version-uploaded":{ label: "Version uploaded",             icon: "upload",  color: "var(--color-text-secondary)", bg: "var(--color-bg-3)",     border: "var(--color-border-subtle)" },
  published:         { label: "Published",                    icon: "bolt",    color: "var(--color-success-700)",    bg: "oklch(96% 0.03 152)",   border: "color-mix(in oklab, var(--color-success-500) 28%, transparent)" },
  unpublished:       { label: "Unpublished",                  icon: "alert",   color: "var(--color-warning-700)",    bg: "var(--warning-bg)",     border: "color-mix(in oklab, var(--color-warning-500) 28%, transparent)" },
  republished:       { label: "Re-published",                 icon: "refresh", color: "var(--color-success-700)",    bg: "oklch(96% 0.03 152)",   border: "color-mix(in oklab, var(--color-success-500) 28%, transparent)" },
  "mode-changed":    { label: "Publish mode changed",         icon: "edit",    color: "var(--color-info-700)",       bg: "var(--color-info-50)",  border: "color-mix(in oklab, var(--color-info-500) 22%, transparent)" },
  rollback:          { label: "Version rolled back",          icon: "alert",   color: "var(--color-error-700)",      bg: "var(--error-bg)",       border: "color-mix(in oklab, var(--color-error-500) 28%, transparent)" },
};

function Spinner({ size = 12 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `${Math.max(1.5, Math.round(size / 10))}px solid var(--color-bg-3)`,
      borderTopColor: "var(--color-primary-600)",
      animation: "spin .8s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ─── Publish-mode change modal ─────────────────────────────
// 2 options: All ISOs (public) vs Specified ISOs (private). The choice
// updates app.publishMode ONLY — never affects app.status. Activity log
// records the change as a "mode-changed" event.
function PublishModeModal({ app, open, onClose }) {
  const tenant = window.useActiveTenant();
  const hasISO = tenant.contracts.includes("ISO");
  const current = app.publishMode || "public";
  const [pick, setPick] = useStateS(current);
  useEffectS(() => { if (open) setPick(current); }, [open, current]);
  if (!open) return null;

  // Two options, same set regardless of contract. Defaults differ by
  // contract: pure ISV defaults to public, ISV+ISO to private.
  const options = hasISO
    ? [
        { id: "private", icon: "bookmark",
          label: "Specified ISOs",
          body: "Hidden from the public pool. Only ISOs you specify can subscribe — your own tenant is included by default.",
          badge: "Default" },
        { id: "public",  icon: "users",
          label: "All ISOs",
          body: "Listed in the public pool. Any ISO tenant can browse and subscribe directly.",
          badge: "Discoverable" },
      ]
    : [
        { id: "public",  icon: "users",
          label: "All ISOs",
          body: "Listed in the public pool. Any ISO tenant can browse and subscribe directly.",
          badge: "Default" },
        { id: "private", icon: "bookmark",
          label: "Specified ISOs",
          body: "Hidden from the public pool. Only the ISOs you specify can subscribe — they receive a 30-day single-use invite link.",
          badge: "Hand-picked" },
      ];

  const canSave = pick !== current;
  const commit = () => {
    const target = (window.APPS || []).find(a => a.id === app.id);
    if (!target) return;
    target.publishMode = pick;
    const pickLabel = (window.APP_PUBLISH_MODE || {})[pick]?.label || pick;
    target.reviewActivity = [...(target.reviewActivity || []), {
      kind: "mode-changed", at: "just now", actor: "You",
      note: `Publish mode switched to ${pickLabel}.`,
    }];
    window.showToast?.(`Publish mode updated to ${pickLabel}`, "success");
    onClose();
  };

  return (
    <window.Modal open onClose={onClose} width={560}
      title={<>Change publish mode — <span style={{ fontWeight: 500 }}>{app.name}</span></>}
      subtitle="Decide who can subscribe to this app. You can switch back at any time. Switching mode does not affect existing subscribers or terminal deployments."
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="check" disabled={!canSave} onClick={commit}>Save changes</window.Button>
        </>
      }>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map(opt => {
          const on = pick === opt.id;
          return (
            <button key={opt.id} onClick={() => setPick(opt.id)} style={{
              padding: 14, textAlign: "left",
              background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
              border: "1px solid",
              borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
              borderRadius: 8,
              boxShadow: on ? "0 0 0 3px oklch(40% 0.14 262 / 0.08)" : "none",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "1.5px solid",
                  borderColor: on ? "var(--color-primary-600)" : "var(--color-border-strong)",
                  display: "grid", placeItems: "center",
                }}>
                  {on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary-600)" }} />}
                </div>
                <window.Ico name={opt.icon} size={13}
                  style={{ color: on ? "var(--color-primary-700)" : "var(--color-text-tertiary)" }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                <span style={{ marginLeft: "auto",
                  fontSize: 9, padding: "1px 5px", borderRadius: 3,
                  background: on ? "var(--color-bg-2)" : "var(--color-bg-3)",
                  color: "var(--color-text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                }}>{opt.badge}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>
                {opt.body}
              </div>
            </button>
          );
        })}
        {pick !== current && (
          <div style={{
            padding: "10px 12px",
            background: "var(--color-info-50)",
            border: "1px solid color-mix(in oklab, var(--color-info-500) 22%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-info-700)", lineHeight: 1.55,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <window.Ico name="info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {pick === "public"
                ? <>Switching to <b>All ISOs</b> will list the app in the public pool. Any ISO can subscribe from now on.</>
                : <>Switching to <b>Specified ISOs</b> will hide the app from the public pool. Existing subscribers keep their snapshot; only the ISOs you specify can subscribe going forward.</>}
            </div>
          </div>
        )}
      </div>
    </window.Modal>
  );
}

function AppOverview({ app, navigate, route }) {
  const tenant = window.useActiveTenant();
  const publisherName = (window.TENANT_NAMES || {})[app.publisherTenantId] || "—";
  const isOwnApp = app.publisherTenantId === tenant.id;
  const latest = app.versions.find(v => v.current) || app.versions[0];
  const findings = latest && latest.scan ? window.SCAN_FINDINGS_TEMPLATES[latest.scan] : null;
  const counts = findings ? window.summariseFindings(findings) : null;
  const fromEntry = route?.from || "appPublish";

  return (
    <div className="app-overview">
      {/* LEFT — narrative content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {/* About — just the description; the metadata that mattered is already in the header */}
        <window.Card title="About">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--color-text-secondary)" }}>{app.description}</p>
          <PublisherRow publisherName={publisherName} isOwnApp={isOwnApp} />
        </window.Card>

        {/* Screenshots — store-page imagery, captured per version */}
        {latest && (
        <window.Card title="Screenshots"
          hint={<>from <span className="mono">{latest.name}</span> · captured at upload</>}>
          <window.Screenshots app={app} version={latest} count={4} size="md" />
        </window.Card>
        )}

        {/* Invite history & Invite Subscribe entry have moved to the
            Subscribers tab — they're a property of the subscriber
            relationship, not the app's narrative. */}

      </div>

      {/* RIGHT — Latest version snapshot */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {latest ? (
        <window.Card title="Latest version"
          hint={<span className="mono">{latest.name}</span>}
          action={
            <window.Button size="sm" ghost iconRight="arrowR"
              onClick={() => navigate({ screen: "versionDetail", appId: app.id, versionId: latest.id, from: fromEntry })}>
              Details
            </window.Button>
          }>
          {/* Vertical KV — easier to scan in a narrow column than a 4-up grid */}
          <div style={{
            display: "flex", flexDirection: "column",
            gap: 0,
            margin: "-4px 0 0",
          }}>
            <OverviewKV label="Version"
              value={<span className="mono" style={{ fontWeight: 500 }}>{latest.name}</span>}
              sub={`code ${latest.code}`} />
            <OverviewKV label="Size" value={latest.size} />
            <OverviewKV label="Reach"
              value={<span className="mono num" style={{ fontWeight: 500 }}>{latest.reach || 0}</span>}
              sub="ISO subscribers" />
            <OverviewKV label="Android"
              value={androidVersionName(latest.targetSdk)}
              sub={`min ${androidVersionName(latest.minSdk)} · API ${latest.minSdk}–${latest.targetSdk}`} />
          </div>

          {/* Release notes */}
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
          }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Release notes</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--color-text-secondary)" }}>
              {latest.notes}
            </p>
          </div>

          {/* Vulnerability scan */}
          {counts && (
            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: "1px dashed var(--color-border-subtle)",
            }}>
              <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Vulnerability scan</div>
              <window.SeverityBar counts={counts} height={6} />
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => (
                  <window.Pill key={k} tone={window.SEVERITY[k].tone} size="sm">
                    <span className="mono" style={{ marginRight: 3 }}>{v}</span> {window.SEVERITY[k].label}
                  </window.Pill>
                ))}
                {Object.values(counts).every(v => v === 0) && (
                  <window.Pill tone="success" dot size="sm">No findings</window.Pill>
                )}
              </div>
            </div>
          )}
        </window.Card>
        ) : (
          <window.Card title="No versions yet"
            hint="Upload an APK to create the first version">
            <div style={{ fontSize: 12.5, color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>
              Once you upload a signed APK, the parsed manifest, security scan results, and store screenshots will appear here.
            </div>
          </window.Card>
        )}
      </div>
    </div>
  );
}

function OverviewKV({ label, value, sub }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 12,
      padding: "7px 0",
      borderBottom: "1px dashed var(--color-border-subtle)",
    }}>
      <div style={{
        fontSize: 11, color: "var(--color-text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500,
        whiteSpace: "nowrap",
      }}>{label}</div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{value}</div>
        {sub && (
          <div className="mono" style={{ fontSize: 10.5, color: "var(--color-text-tertiary)", marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase",
        letterSpacing: "0.05em", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em",
        fontFamily: mono ? "var(--font-family-mono)" : "inherit" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Vulnerability banner (used in subscribed-app overview) ──
// Surfaces high-risk and incomplete scans at the top of the page so an ISO
// can't miss them when deciding whether to deploy the snapshot.
function classifyScan(version) {
  if (!version)                      return { tier: "incomplete" };
  if (!version.scan)                 return { tier: "incomplete" };
  const findings = window.SCAN_FINDINGS_TEMPLATES[version.scan] || [];
  const counts = window.summariseFindings(findings);
  if ((counts.critical || 0) + (counts.high || 0) > 0) return { tier: "high-risk", counts, findings };
  if ((counts.medium || 0) > 0) return { tier: "moderate", counts, findings };
  return { tier: "clean", counts, findings };
}

function VulnerabilityBanner({ version, navigate, app, fromEntry }) {
  const cls = classifyScan(version);
  if (cls.tier === "clean" || cls.tier === "moderate") return null;

  const config = cls.tier === "incomplete" ? {
    bg: "var(--warning-bg)", border: "oklch(70% 0.16 70 / 0.30)", color: "var(--color-warning-700)", icon: "alert",
    title: "Security review incomplete",
    body: "This snapshot does not have a completed vulnerability scan report. Approving and deploying without scan results is risky.",
  } : {
    bg: "var(--error-bg)", border: "oklch(58% 0.20 25 / 0.30)", color: "var(--color-error-700)", icon: "alert",
    title: "Unresolved security findings",
    body: `The publisher's scan flagged ${(cls.counts.critical || 0)} critical and ${(cls.counts.high || 0)} high-severity issue${((cls.counts.critical || 0) + (cls.counts.high || 0)) === 1 ? "" : "s"}. Review the findings before deploying to terminals.`,
  };

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 14px",
      borderRadius: "var(--radius-lg)",
      background: config.bg,
      border: `1px solid ${config.border}`,
      marginBottom: 16,
    }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: "50%", background: "oklch(100% 0 0 / 0.6)",
        display: "grid", placeItems: "center", color: config.color,
      }}><window.Ico name={config.icon} size={15} stroke={2} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: config.color }}>{config.title}</div>
        <div style={{ fontSize: 12, color: config.color, opacity: 0.9, marginTop: 3, lineHeight: 1.5 }}>{config.body}</div>
      </div>
      {version && cls.tier === "high-risk" && (
        <window.Button size="sm" variant="primary"
          onClick={() => navigate({ screen: "versionDetail", appId: app.id, versionId: version.id, from: fromEntry })}>
          Review findings
        </window.Button>
      )}
    </div>
  );
}

// ─── Subscribed-app overview (replaces AppOverview when viewing as an ISO) ──
function SubscribedAppOverview({ app, subscription, navigate, onPull, route }) {
  const cur = subscription?.subscribedVersion;
  const latest = subscription?.latestVersion;
  const cls = classifyScan(cur);
  const [findingsOpen, setFindingsOpen] = useStateS(false);
  const fromEntry = route?.from || "appStore";

  // Quick severity breakdown for the right-column scan card.
  const severityCounts = cls.counts;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <VulnerabilityBanner version={cur} navigate={navigate} app={app} fromEntry={fromEntry} />

      <div className="app-overview">
        {/* LEFT — narrative */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <window.Card title="About">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--color-text-secondary)" }}>{app.description}</p>
            <PublisherRow publisherName={(window.TENANT_NAMES || {})[app.publisherTenantId] || "—"} isOwnApp={false} />
          </window.Card>

          <window.Card title="Screenshots"
            hint={<>from <span className="mono">{cur?.name}</span> · your current snapshot</>}>
            <window.Screenshots app={app} version={cur} count={4} size="md" />
          </window.Card>
        </div>

        {/* RIGHT — subscription state + vuln spotlight + compatibility */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Subscription card. The "Approve <version>" CTA when an update is
              available lives in the page header. Rollouts are managed
              from the Deployments tab — no shortcut from this card. */}
          <window.Card title="Subscription">
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <OverviewKV label="Current snapshot"
                value={<span className="mono" style={{ fontWeight: 500 }}>{cur?.name}</span>}
                sub={`code ${cur?.code}`} />
              <OverviewKV label="Latest available"
                value={subscription?.isOutdated
                  ? <span className="mono" style={{ fontWeight: 500, color: "var(--color-warning-700)" }}>{latest.name}</span>
                  : <span className="mono" style={{ fontWeight: 500, color: "var(--color-success-700)" }}>{latest?.name}</span>}
                sub={subscription?.isOutdated ? "new — approve to update" : "you're up to date"} />
              <OverviewKV label="Approved" value={subscription?.subscribedAt || "—"} />
              <OverviewKV label="Deployed"
                value={<span className="mono num">{subscription?.deployedTerminals || 0}</span>}
                sub="terminals in your fleet" />
            </div>
          </window.Card>

          {/* Vulnerability scan card — emphasized for subscribers */}
          <window.Card title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <window.Ico name={cls.tier === "clean" ? "shieldCheck" : "shield"}
                size={14}
                style={{ color: cls.tier === "high-risk" ? "var(--error)"
                       : cls.tier === "incomplete" ? "var(--warning)"
                       : cls.tier === "moderate"   ? "var(--info)"
                       : "var(--success)" }} />
              Vulnerability scan
            </span>
          }
          action={cur && cls.findings && cls.findings.length > 0 ? (
            <window.Button size="sm" iconRight="arrowR"
              onClick={() => setFindingsOpen(true)}>
              View findings
            </window.Button>
          ) : null}>
            {cls.tier === "incomplete" ? (
              <div style={{
                padding: "10px 12px",
                background: "var(--warning-bg)",
                border: "1px solid oklch(70% 0.16 70 / 0.25)",
                borderRadius: "var(--radius-md)",
                fontSize: 12, color: "var(--color-warning-700)",
                lineHeight: 1.5,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <window.Ico name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  Scan has not run or has not finished. Treat this snapshot as unreviewed until a report is produced.
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <window.SeverityBar counts={severityCounts} height={8} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {["critical", "high", "medium", "low", "info"].map(k => {
                    const v = severityCounts[k] || 0;
                    if (v === 0) return null;
                    return (
                      <window.Pill key={k} tone={window.SEVERITY[k].tone}>
                        <span className="mono" style={{ marginRight: 3 }}>{v}</span>
                        {window.SEVERITY[k].label}
                      </window.Pill>
                    );
                  })}
                  {Object.values(severityCounts).every(v => v === 0) && (
                    <window.Pill tone="success" dot>No findings</window.Pill>
                  )}
                </div>
                {cls.tier === "high-risk" && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    background: "var(--error-bg)",
                    border: "1px solid oklch(58% 0.20 25 / 0.25)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 11.5, color: "var(--color-error-700)",
                    lineHeight: 1.5,
                  }}>
                    <b>Action required:</b> Critical/high findings present in this snapshot. Hold deployments until either the publisher releases a fixed version or your security team approves the risk.
                  </div>
                )}
              </>
            )}
          </window.Card>

          {/* Compatibility brief lived here until tabs were consolidated;
              device-model selection lives in Settings now. */}
        </div>
      </div>
      <FindingsModal
        open={findingsOpen}
        onClose={() => setFindingsOpen(false)}
        app={app}
        version={cur}
        findings={cls.findings || []}
        counts={cls.counts} />
    </div>
  );
}

// ─── Deployments tab (subscriber view) ─────────────────────
// Lists every merchant that has this app installed for the active tenant,
// what version each is on, and (per-terminal) the actual install state.
//
// Operators can stage a Target Version per merchant from this view — those
// edits sit in a local "pending" map and the user reviews them before
// submitting. There's also a fleet-wide "Upgrade all to latest" shortcut.
function SubscribedDeployments({ app, subscription, initialVersionFilter }) {
  const tenant = window.useActiveTenant();
  const rawState = window.getAppDeploymentState(tenant.id, app.id);

  // Target-version dropdown options: ONLY versions in this tenant's local
  // pool (i.e. ones the tenant has Approved). Upstream ISV versions that
  // haven't been approved are pull candidates — they don't appear here.
  // See getLocalPoolVersions() in data.jsx.
  const targetVersionOptions = useMemoS(
    () => window.getLocalPoolVersions(tenant.id, app),
    [tenant.id, app.id, app.versions]);
  // "Latest" for rollout purposes = newest version in the LOCAL pool, NOT
  // the newest upstream publish. A merchant on the latest LOCAL version is
  // up-to-date even if the ISV has shipped a newer build the operator
  // hasn't approved yet.
  const latest = targetVersionOptions[0] || null;
  const latestPublished = latest;

  // Saved overrides applied this session (after operator confirms a save).
  // Keyed by merchantId → versionId. Layered on top of the mock data so the
  // UI immediately reflects the new "current version" post-save without us
  // having to wire into the global ROLLOUT_HISTORY plumbing.
  const [saved, setSaved] = useStateS({});
  // Persisted removals (post-save) — rows simply disappear from the table.
  const [savedRemovals, setSavedRemovals] = useStateS(new Set());
  const state = useMemoS(() => rawState
    // Hide merchants the user has already removed-and-saved in this session.
    .filter(s => !savedRemovals.has(s.merchant.id))
    .map(s => {
      const overrideId = saved[s.merchant.id];
      if (!overrideId) return s;
      const v = (app.versions || []).find(vv => vv.id === overrideId);
      if (!v) return s;
      // When we move a merchant, regenerate the per-terminal mock state for
      // the new version (so terminals show pending/installed/failed against
      // the new target, not the old).
      return { ...s, version: v };
    }), [rawState, saved, app.versions, savedRemovals]);

  // Pending (unsubmitted) target-version edits: merchantId → versionId.
  // Cleared on submit or when the user discards.
  const [pending, setPending] = useStateS({});
  const pendingCount = Object.keys(pending).length;

  const [filter, setFilter]   = useStateS("all");     // all | onLatest | behind
  const [q, setQ]             = useStateS("");
  // Seed the version filter from the incoming route param so that arriving
  // from a Version Detail "View deployment details" link lands you with the
  // dropdown already narrowed to that version.
  const [versionFilter, setVf] = useStateS(initialVersionFilter || "any");
  // Target-version filter — separate from currentVersionFilter above.
  const [targetVf, setTargetVf] = useStateS("any");
  // Region filter — driven by the region set across the deployment state.
  const [regionFilter, setRegionFilter] = useStateS("any");
  // Tag filter — multi-select chips popover. OR semantics.
  const [tagFilter, setTagFilter] = useStateS([]);
  const [expanded, setExpanded] = useStateS(new Set());

  // Lazy-load: expanding a merchant simulates fetching its terminal list.
  // Per-merchant: "loading" (in flight) → "loaded" (cached).
  const [loadingDevices, setLoadingDevices] = useStateS(new Set());
  const [loadedDevices,  setLoadedDevices]  = useStateS(new Set());

  // Modals
  const [upgradeAllOpen, setUpgradeAllOpen] = useStateS(false);
  const [saveOpen, setSaveOpen]             = useStateS(false);
  // Terminal detail panel: { merchant, terminal, version } | null
  const [terminalOpen, setTerminalOpen]     = useStateS(null);
  // Force a re-render after a retry/relaunch updates terminal status.
  const [tick, setTick] = useStateS(0);

  // ─── Strategy state (new) ───────────────────────────────
  // savedStrategies: in-session writes layered over MERCHANT_APP_UPGRADE_STRATEGY
  //   key: `${merchantId}` → strategy record (current target version assumed)
  // strategyFilter: "any" | preset id | "unset"
  // rolloutCtx: open state for the 2-step RolloutModal
  const [savedStrategies, setSavedStrategies] = useStateS({});
  const [strategyFilter,  setStrategyFilter]  = useStateS("any");
  const [rolloutCtx,      setRolloutCtx]      = useStateS(null);
  // "Assign merchant" picker modal — opens from the filter row, drives a
  // bind-then-strategy flow that ends in RolloutModal at the strategy step.
  const [assignMerchOpen, setAssignMerchOpen] = useStateS(false);
  // "Unassign" confirm modal — { merchant } | null. Soft remove only;
  // terminals keep running the app. Inverse of the Assign flow.
  const [unassignCtx, setUnassignCtx] = useStateS(null);

  // Resolve strategy for a (merchant, app, version) tuple. Pulls from
  // in-session overrides first, else from the global strategy table.
  const strategyFor = (merchantId, versionId) => {
    const local = savedStrategies[merchantId];
    if (local && local.appVersion === versionId) return local;
    return window.getMerchantStrategy(merchantId, app.package, versionId);
  };

  // Resolve the rendered "target version" for a row:
  //   pending edit (if any) > current installed version
  // Defined before `totals` so its useMemo can reference it without TDZ.
  const targetFor = (s) => {
    const pendId = pending[s.merchant.id];
    if (pendId) return (app.versions || []).find(v => v.id === pendId) || s.version;
    return s.version;
  };

  const totals = useMemoS(() => {
    // Terminal-based metrics. The old "merchant on latest" tile didn't reflect
    // that within a merchant some terminals may lag. We count terminals here
    // and a merchant is "fully on target" only when every terminal is.
    let totalTerminals = 0;
    let terminalsOnTarget = 0;
    let fullyOnTargetMerchants = 0;
    state.forEach(s => {
      totalTerminals += s.terminals.length;
      const tgt = targetFor(s);
      const onTgt = s.terminals.filter(t => (t.currentVersionCode || 0) >= (tgt.code || 0));
      terminalsOnTarget += onTgt.length;
      if (onTgt.length === s.terminals.length && s.terminals.length > 0) fullyOnTargetMerchants += 1;
    });
    const terminalsBehind = totalTerminals - terminalsOnTarget;
    return { covered: state.length, totalTerminals, terminalsOnTarget, terminalsBehind, fullyOnTargetMerchants };
  }, [state, latest, tick, pending]);

  const versionOptions = useMemoS(() => {
    const seen = new Map();
    state.forEach(s => seen.set(s.version.id, s.version));
    return [...seen.values()].sort((a, b) => (b.code || 0) - (a.code || 0));
  }, [state]);

  const regionOptions = useMemoS(() => {
    const seen = new Set();
    state.forEach(s => s.merchant.region && seen.add(s.merchant.region));
    return [...seen].sort();
  }, [state]);

  const tagOptions = useMemoS(() => {
    const seen = new Set();
    state.forEach(s => (s.merchant.tags || []).forEach(t => seen.add(t)));
    return [...seen].sort();
  }, [state]);

  // Resolve the rendered "target version" for a row:
  //   pending edit (if any) > current installed version

  const filtered = state.filter(s => {
    if (versionFilter !== "any" && s.version.id !== versionFilter) return false;
    if (targetVf      !== "any" && targetFor(s).id !== targetVf)    return false;
    if (regionFilter  !== "any" && s.merchant.region !== regionFilter) return false;
    if (tagFilter.length > 0 && !(s.merchant.tags || []).some(t => tagFilter.includes(t))) return false;
    if (strategyFilter !== "any") {
      const rec = strategyFor(s.merchant.id, targetFor(s).id);
      const preset = rec ? window.resolveStrategyPreset(rec) : null;
      if (preset !== strategyFilter) return false;
    }
    if (q && !s.merchant.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  // Pagination — at the merchant level. Reset on any filter change.
  const dpager = window.usePaginated(filtered, 10,
    `dep|${app.id}|${q}|${versionFilter}|${targetVf}|${regionFilter}|${tagFilter.join(",")}|${strategyFilter}|${state.length}`);
  const setTargetFor = (merchantId, currentVersionId, nextVersionId) => {
    const next = { ...pending };
    if (nextVersionId === currentVersionId) {
      delete next[merchantId];
    } else {
      next[merchantId] = nextVersionId;
    }
    setPending(next);
  };

  // Build the list shown in the save-changes review modal.
  const pendingRows = useMemoS(() => {
    return state
      .filter(s => pending[s.merchant.id])
      .map(s => {
        const t = (app.versions || []).find(v => v.id === pending[s.merchant.id]);
        return { merchant: s.merchant, current: s.version, target: t };
      });
  }, [state, pending, app.versions]);

  // Commit the pending edits — fold them into `saved` and clear pending.
  const commitChanges = (overrides) => {
    overrides = overrides || {};
    const nextSaved = { ...saved, ...overrides };
    setSaved(nextSaved);
    setPending({});
    setSaveOpen(false);
    setUpgradeAllOpen(false);
    const nVer = Object.keys(overrides).length;
    if (nVer > 0) {
      window.showToast?.(`Applied ${nVer} target-version update${nVer === 1 ? "" : "s"} — rollout queued`, "success");
    }
  };

  // Drop a merchant from this view immediately. Used by unassign + uninstall
  // handlers once the underlying data overlay (MERCHANT_APP_REMOVALS) has
  // been written via window.unassignMerchantFromApp / uninstallMerchantApp.
  // We also clear any pending edit for that merchant so the save-bar count
  // is consistent.
  const dropMerchantLocally = (merchantId) => {
    setSavedRemovals(prev => {
      const next = new Set(prev);
      next.add(merchantId);
      return next;
    });
    setPending(prev => {
      if (!prev[merchantId]) return prev;
      const next = { ...prev };
      delete next[merchantId];
      return next;
    });
  };

  const tiles = [
    { key: "covered",  label: "Merchants",           value: totals.covered,            sub: "have this app" },
    { key: "terminals",label: "Terminals (total)",   value: totals.totalTerminals,     sub: "across covered merchants" },
    { key: "onTarget", label: "Terminals on target", value: totals.terminalsOnTarget,  sub: `≥ ${latest?.name || "—"}`,                                tone: "success" },
    { key: "behind",   label: "Terminals behind",    value: totals.terminalsBehind,    sub: "awaiting upgrade per strategy",                            tone: totals.terminalsBehind > 0 ? "warning" : undefined },
  ];

  const toggleExpand = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
      setExpanded(next);
      return;
    }
    next.add(id);
    setExpanded(next);
    // Kick off the lazy fetch the first time a merchant is expanded.
    if (!loadedDevices.has(id) && !loadingDevices.has(id)) {
      const ln = new Set(loadingDevices); ln.add(id); setLoadingDevices(ln);
      setTimeout(() => {
        setLoadingDevices(prev => { const n = new Set(prev); n.delete(id); return n; });
        setLoadedDevices(prev => { const n = new Set(prev); n.add(id); return n; });
      }, 700);
    }
  };

  // "Upgrade all to latest" — stage every behind-latest merchant onto the
  // latest published version. We compute the target overrides up front so
  // the confirm modal can show the count and version name.
  const upgradeAllTargets = useMemoS(() => {
    if (!latestPublished) return {};
    const out = {};
    state.forEach(s => {
      if (s.version.id !== latestPublished.id) out[s.merchant.id] = latestPublished.id;
    });
    return out;
  }, [state, latestPublished]);

  // Open the 2-step Rollout modal pre-populated with every merchant currently
  // behind the latest version. Used by the contextual banner above the table.
  const triggerUpgradeAll = () => {
    if (!latestPublished) return;
    const merchantIds = Object.keys(upgradeAllTargets);
    if (merchantIds.length === 0) return;
    const changes = state
      .filter(s => merchantIds.includes(s.merchant.id))
      .map(s => ({
        kind: "version-change",
        merchant: s.merchant, app,
        fromVersion: s.version,
        toVersion: latestPublished,
        currentStrategy: strategyFor(s.merchant.id, s.version.id),
      }));
    setRolloutCtx({
      open: true, changes,
      title: `Upgrade all to ${latestPublished.name}`,
      confirmLabel: `Upgrade ${changes.length} merchant${changes.length === 1 ? "" : "s"}`,
      onCommit: (strategy) => {
        commitChanges(upgradeAllTargets);
        const nextSavedStrategies = { ...savedStrategies };
        changes.forEach(c => {
          window.setMerchantStrategy(c.merchant.id, app.package, c.toVersion.id, strategy);
          nextSavedStrategies[c.merchant.id] = {
            ...strategy,
            mrchId: c.merchant.id, appPackage: app.package, appVersion: c.toVersion.id,
          };
        });
        setSavedStrategies(nextSavedStrategies);
        setRolloutCtx(null);
        window.showToast?.(`Upgraded ${changes.length} merchant${changes.length === 1 ? "" : "s"} to ${latestPublished.name}`, "success");
      },
    });
  };

  return (
    <div className="page-content" style={{
      display: "flex", flexDirection: "column", gap: 16,
      paddingBottom: pendingCount > 0 ? 80 : 0,
    }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {tiles.map(t => (
          <div key={t.key} style={{
            padding: "12px 16px", borderRadius: "var(--radius-lg)",
            background: "var(--bg2)",
            border: "1px solid var(--border-1)",
            boxShadow: "var(--shadow-1)",
            textAlign: "left",
          }}>
            <div className="overline" style={{ fontSize: 10.5 }}>{t.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span className="mono num" style={{ fontSize: 24, fontWeight: 500,
                letterSpacing: "-0.02em",
                color: t.tone === "success" ? "var(--success)"
                     : t.tone === "warning" ? "var(--warning)"
                     : "var(--fg1)" }}>{t.value}</span>
              <span style={{ fontSize: 11, color: "var(--fg3)" }}>{t.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Behind-version contextual banner — only shows when some merchant
          isn't on the latest local-pool version. Replaces the old toolbar
          "Upgrade all to latest" button: bind the destructive batch action
          to the condition that warrants it so it doesn't compete with the
          everyday "Assign merchant" button. */}
      {latestPublished && Object.keys(upgradeAllTargets).length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-warning-50, oklch(96.5% 0.04 80))",
          border: "1px solid oklch(70% 0.16 70 / 0.30)",
          color: "var(--color-warning-700, oklch(48% 0.14 60))",
        }}>
          <window.Ico name="alert" size={14} stroke={2} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
            <span className="mono num" style={{ fontWeight: 600 }}>
              {Object.keys(upgradeAllTargets).length}
            </span>{" "}
            merchant{Object.keys(upgradeAllTargets).length === 1 ? " is" : "s are"} behind{" "}
            <span className="mono" style={{ fontWeight: 500, color: "var(--fg1)" }}>
              v{latestPublished.name}
            </span>{" "}
            · push them onto the latest pool version in one batch.
          </div>
          <window.Button size="sm" variant="secondary" icon="upload"
            onClick={triggerUpgradeAll}>
            Upgrade all to latest
          </window.Button>
        </div>
      )}

      {/* Filters + fleet-wide actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ width: 240 }}>
          <window.Input size="sm" prefix={<window.Ico name="search" size={12} />}
            placeholder="Search merchant…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterSelect label="Target" value={targetVf} onChange={setTargetVf}
          options={[{ value: "any", label: "All target versions" },
                    ...targetVersionOptions.map(v => ({
                      value: v.id,
                      label: `${v.name}${latestPublished && v.id === latestPublished.id ? " · latest" : ""}`,
                    }))]} />
        <MoreFiltersDropdown
          regionOptions={regionOptions}
          regionFilter={regionFilter}
          setRegionFilter={setRegionFilter}
          tagOptions={tagOptions}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          strategyFilter={strategyFilter}
          setStrategyFilter={setStrategyFilter} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <window.Button size="sm" variant="secondary" icon="plus"
            disabled={!latestPublished}
            onClick={() => setAssignMerchOpen(true)}>
            Assign merchant
          </window.Button>
        </div>
      </div>

      {/* Table */}
      <window.Card padding={0}>
        <table className="tds-table num" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Merchant</th>
              <th>Target version</th>
              <th>Upgrade strategy</th>
              <th style={{ textAlign: "right" }}>On target / total</th>
              <th>Last rollout</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)" }}>
                {state.length === 0 ? "No merchants have this app yet. Roll out a version to seed deployments." : "No merchants match those filters."}
              </td></tr>
            )}
            {dpager.slice.map(s => {
              const isOpen = expanded.has(s.merchant.id);
              const isLoadingDevices = loadingDevices.has(s.merchant.id);
              const isLoadedDevices  = loadedDevices.has(s.merchant.id);
              const target = targetFor(s);
              const isDirty   = !!pending[s.merchant.id];
              // Terminal statuses are derived against the row's TARGET version
              // — operators see who has actually reached the version they're
              // pushing toward.
              const termStatuses = s.terminals.map(t => ({
                t, st: computeTerminalStatus(t, target),
              }));
              const installedCount = termStatuses.filter(x => x.st.status === "installed").length;
              const awaitingCount  = termStatuses.filter(x => x.st.status === "awaiting").length;
              const inflightCount  = termStatuses.filter(x => x.st.status === "downloading" || x.st.status === "downloaded").length;
              const failedCount    = termStatuses.filter(x => x.st.tone === "error").length;
              const rowBg = isDirty   ? "var(--color-warning-50)"
                                      : undefined;
              return (
                <React.Fragment key={s.merchant.id}>
                  <tr style={{ cursor: "pointer", background: rowBg }}
                      onClick={() => toggleExpand(s.merchant.id)}>
                    <td style={{ paddingLeft: 14 }}>
                      <window.Ico name={isOpen ? "chevu" : "chevdown"} size={12} style={{ color: "var(--fg3)" }} />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 500,
                          color: "var(--fg1)",
                        }}>{s.merchant.name}</span>
                        <span style={{ fontSize: 11, color: "var(--fg3)" }}>{s.merchant.region}</span>
                      </div>
                    </td>
                    <td>
                      <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-block" }}>
                        <TargetVersionDropdown
                          value={target.id}
                          options={(() => {
                            const opts = [...targetVersionOptions];
                            if (!opts.some(v => v.id === s.version.id)) opts.push(s.version);
                            return opts;
                          })()}
                          latestId={latestPublished?.id}
                          isDirty={isDirty}
                          onChange={(nextId) => setTargetFor(s.merchant.id, s.version.id, nextId)} />
                      </div>
                    </td>
                    <td>
                      <StrategyCell
                        record={strategyFor(s.merchant.id, target.id)}
                        onClick={() => {
                          // Open the 2-step Rollout modal for THIS row only.
                          // On commit we write straight to MERCHANT_APP_UPGRADE_STRATEGY
                          // (the shared global store), so the change is
                          // immediately visible to Merchants → Apps tab
                          // and any other view that reads from it.
                          setRolloutCtx({
                            open: true,
                            title: `Edit upgrade strategy · ${s.merchant.name}`,
                            confirmLabel: "Save strategy",
                            changes: [{
                              kind: "strategy-change",
                              merchant: s.merchant, app,
                              fromVersion: target, toVersion: target,
                              currentStrategy: strategyFor(s.merchant.id, target.id),
                            }],
                            onCommit: (strategy) => {
                              // Persist to the global store so Merchants tab,
                              // App Store and any other consumer immediately
                              // see the new strategy.
                              window.setMerchantStrategy(
                                s.merchant.id, app.package, target.id, strategy);
                              // Update local override so this view re-renders
                              // with the new pill without waiting on a hook.
                              setSavedStrategies({
                                ...savedStrategies,
                                [s.merchant.id]: {
                                  ...strategy,
                                  mrchId: s.merchant.id,
                                  appPackage: app.package,
                                  appVersion: target.id,
                                },
                              });
                              // Broadcast so Merchants → Apps tab and any
                              // other useMerchantTick consumer re-renders too.
                              window.bumpMerchants?.();
                              setRolloutCtx(null);
                              window.showToast?.(
                                `Strategy updated · ${s.merchant.name} → ${({ casual: "Casual", immediate: "Immediate", custom: "Custom" })[strategy.strategy] || strategy.strategy}`,
                                "success");
                            },
                          });
                        }} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                        <span className="mono num" style={{ fontSize: 12.5, fontWeight: 500 }}>
                          {installedCount}<span style={{ color: "var(--fg3)", fontWeight: 400 }}> / {s.terminals.length}</span>
                        </span>
                        {failedCount > 0 ? (
                          <span style={{ fontSize: 10.5, color: "var(--color-error-700)" }}>
                            <span className="mono num">{failedCount}</span> failed
                          </span>
                        ) : (awaitingCount + inflightCount) > 0 ? (
                          <span style={{ fontSize: 10.5, color: "var(--color-warning-700)" }}>
                            <span className="mono num">{awaitingCount + inflightCount}</span> pending
                          </span>
                        ) : installedCount === s.terminals.length && s.terminals.length > 0 ? (
                          <span style={{ fontSize: 10.5, color: "var(--color-success-700)" }}>on target</span>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "var(--fg3)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 11.5, color: "var(--fg2)" }}><span className="mono">{s.lastRolloutAt}</span></td>
                    <td style={{ textAlign: "right", paddingRight: 14 }}>
                      <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-block" }}>
                        <RowKebabMenu
                          merchantName={s.merchant.name}
                          terminalCount={s.terminals.length}
                          onUnassign={() => setUnassignCtx({ merchant: s.merchant, currentVersion: s.version })}
                          onUninstall={() => {
                            // Walk through the 2-step RolloutModal at the
                            // Review step so the operator confirms what's
                            // about to land on terminals before picking the
                            // uninstall strategy.
                            setRolloutCtx({
                              open: true,
                              title: `Uninstall ${app.name} · ${s.merchant.name}`,
                              confirmLabel: `Uninstall on ${s.terminals.length} terminal${s.terminals.length === 1 ? "" : "s"}`,
                              changes: [{
                                kind: "uninstall",
                                merchant: s.merchant, app,
                                fromVersion: s.version, toVersion: null,
                                currentStrategy: strategyFor(s.merchant.id, s.version.id),
                              }],
                              onCommit: (strategy) => {
                                window.uninstallMerchantApp(tenant.id, app.id, s.merchant.id);
                                dropMerchantLocally(s.merchant.id);
                                window.bumpMerchants?.();
                                setRolloutCtx(null);
                                window.showToast?.(
                                  `Uninstalling ${app.name} on ${s.merchant.name} · ${window.strategyLabel(strategy.strategy)} · ${window.timingLabel(strategy.timing)}`,
                                  "success");
                              },
                            });
                          }} />
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 14px 14px 44px", background: "var(--bg3)" }}>
                        {isLoadingDevices && (
                          <div style={{ padding: "16px 0", display: "flex", alignItems: "center",
                                        gap: 8, fontSize: 12, color: "var(--fg3)" }}>
                            <span className="a-spin" style={{
                              width: 12, height: 12, borderRadius: "50%",
                              border: "2px solid var(--color-primary-200)",
                              borderTopColor: "var(--color-primary-500)",
                              display: "inline-block",
                            }} />
                            Loading terminals for {s.merchant.name}…
                          </div>
                        )}
                        {isLoadedDevices && (
                          <ExpandedTerminals
                            merchant={s.merchant} app={app}
                            target={target}
                            termStatuses={termStatuses}
                            strategyRecord={strategyFor(s.merchant.id, target.id)}
                            onTerminalOpen={(t) => setTerminalOpen({ merchant: s.merchant, terminal: t, version: target })} />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <window.Pagination
            page={dpager.page} pageSize={dpager.pageSize} total={dpager.total}
            onChange={dpager.setPage} onPageSizeChange={dpager.setPageSize}
            pageSizes={[10, 20, 50]} />
        )}
      </window.Card>
      {pendingCount > 0 && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          padding: "12px 24px",
          background: "var(--bg-surface, #fff)",
          borderTop: "1px solid var(--border-2)",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 12,
          zIndex: "var(--z-sticky)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--color-warning-50)",
              color: "var(--color-warning-700)",
              display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600,
            }}>{pendingCount}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Unsaved changes
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg3)" }}>
                {pendingRows.length > 0 && <>{pendingRows.length} version change{pendingRows.length === 1 ? "" : "s"}</>}
                {" — review and submit to apply."}
              </div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <window.Button size="sm" variant="ghost" onClick={() => setPending({})}>
              Discard
            </window.Button>
            <window.Button size="sm" primary icon="check" onClick={() => {
              // Build the change set for the RolloutModal: only version
              // changes. Removals are handled inline (Unassign / Uninstall
              // from the row kebab menu) and never enter the save bar.
              const changes = pendingRows.map(r => ({
                kind: "version-change",
                merchant: r.merchant, app,
                fromVersion: r.current, toVersion: r.target,
                currentStrategy: strategyFor(r.merchant.id, r.current.id),
              }));
              setRolloutCtx({
                open: true, changes,
                title: `Save changes · ${changes.length} update${changes.length === 1 ? "" : "s"}`,
                confirmLabel: `Apply & save (${pendingRows.length})`,
                onCommit: (strategy) => {
                  commitChanges(pending);
                  // Persist the chosen strategy for every change row
                  const nextSavedStrategies = { ...savedStrategies };
                  pendingRows.forEach(r => {
                    window.setMerchantStrategy(r.merchant.id, app.package, r.target.id, strategy);
                    nextSavedStrategies[r.merchant.id] = {
                      ...strategy,
                      mrchId: r.merchant.id, appPackage: app.package, appVersion: r.target.id,
                    };
                  });
                  setSavedStrategies(nextSavedStrategies);
                  setRolloutCtx(null);
                  window.showToast?.(`Strategy saved · ${changes.length} update${changes.length === 1 ? "" : "s"}`, "success");
                },
              });
            }}>
              Save changes ({pendingCount})
            </window.Button>
          </div>
        </div>
      )}

      {/* Save-changes review modal */}
      <DeploymentSaveChangesModal
        open={saveOpen}
        rows={pendingRows}
        removals={[]}
        onClose={() => setSaveOpen(false)}
        onConfirm={() => commitChanges(pending)} />

      {/* Unassign confirm modal — soft remove. Terminals already running
          the app keep it; no future updates will land. */}
      {unassignCtx && (
        <UnassignConfirmModal
          merchant={unassignCtx.merchant}
          currentVersion={unassignCtx.currentVersion}
          app={app}
          onClose={() => setUnassignCtx(null)}
          onConfirm={() => {
            const m = unassignCtx.merchant;
            window.unassignMerchantFromApp(tenant.id, app.id, m.id);
            dropMerchantLocally(m.id);
            window.bumpMerchants?.();
            setUnassignCtx(null);
            window.showToast?.(`Unassigned ${m.name} from ${app.name}`, "success");
          }} />
      )}

      {/* Assign-merchant picker — step 1 of the bind flow. Step 2 (strategy)
          opens via setRolloutCtx with initialStep: 1 (skip the review since
          this picker is the review). Submit-immediate, no draft. */}
      {assignMerchOpen && (
        <AssignMerchantModal
          tenant={tenant}
          app={app}
          excludedMerchantIds={new Set(state.map(s => s.merchant.id))}
          defaultVersion={latestPublished}
          versionOptions={targetVersionOptions}
          onClose={() => setAssignMerchOpen(false)}
          onNext={({ merchants, version }) => {
            const changes = merchants.map(m => ({
              kind: "add",
              merchant: m, app,
              fromVersion: null,
              toVersion: version,
              currentStrategy: null,
            }));
            setAssignMerchOpen(false);
            setRolloutCtx({
              open: true,
              changes,
              initialStep: 1,
              title: `Assign ${merchants.length} merchant${merchants.length === 1 ? "" : "s"} · ${app.name}`,
              confirmLabel: `Assign ${merchants.length} merchant${merchants.length === 1 ? "" : "s"}`,
              onCommit: (strategy) => {
                // Bind every selected merchant to (app, version) and write
                // their strategy. recordRollout (inside assignMerchantToApp)
                // is what makes them appear in getAppDeploymentState.
                const nextSavedStrategies = { ...savedStrategies };
                merchants.forEach(m => {
                  window.assignMerchantToApp(tenant.id, app.id, m.id, version.id);
                  window.setMerchantStrategy(m.id, app.package, version.id, strategy);
                  nextSavedStrategies[m.id] = {
                    ...strategy,
                    mrchId: m.id, appPackage: app.package, appVersion: version.id,
                  };
                });
                setSavedStrategies(nextSavedStrategies);
                window.bumpMerchants?.();
                setRolloutCtx(null);
                window.showToast?.(
                  `Assigned ${merchants.length} merchant${merchants.length === 1 ? "" : "s"} to ${version.name}`,
                  "success");
              },
            });
          }} />
      )}

      {/* 2-step Rollout Modal — strategy picker for staged commits and
          single/batch strategy edits. Replaces the legacy 3-step wizard. */}
      {rolloutCtx?.open && (
        <window.RolloutModal
          open={rolloutCtx.open}
          changes={rolloutCtx.changes}
          title={rolloutCtx.title}
          confirmLabel={rolloutCtx.confirmLabel}
          initialStep={rolloutCtx.initialStep || 0}
          largeBatchHint
          onClose={() => setRolloutCtx(null)}
          onConfirm={(strategy) => {
            if (rolloutCtx.onCommit) {
              rolloutCtx.onCommit(strategy);
              return;
            }
            // Default commit: pure strategy-change — write strategy for each
            // change row at its current target version, and update local cache.
            const nextSavedStrategies = { ...savedStrategies };
            (rolloutCtx.changes || []).forEach(c => {
              if (!c.toVersion) return;
              window.setMerchantStrategy(c.merchant.id, app.package, c.toVersion.id, strategy);
              nextSavedStrategies[c.merchant.id] = {
                ...strategy,
                mrchId: c.merchant.id, appPackage: app.package, appVersion: c.toVersion.id,
              };
            });
            setSavedStrategies(nextSavedStrategies);
            setRolloutCtx(null);
            window.showToast?.(`Strategy saved · ${(rolloutCtx.changes || []).length} merchant${(rolloutCtx.changes || []).length === 1 ? "" : "s"}`, "success");
          }} />
      )}

      {/* Per-terminal upgrade-log panel */}
      <TerminalEventsModal
        info={terminalOpen}
        app={app}
        onClose={() => setTerminalOpen(null)}
        onRetry={(sn) => {
          // Model "Retry now" as immediately advancing the terminal to the
          // target version. The mock has no real backend, so we just bump
          // the terminal's currentVersionCode so the status recomputes to
          // "installed" on the next render.
          if (terminalOpen) {
            const tgtCode = terminalOpen.version?.code || 0;
            terminalOpen.terminal.currentVersionCode = tgtCode;
            window.showToast?.(`Update command sent — ${sn} → ${terminalOpen.version?.name || "target"}`, "info");
            setTick(t => t + 1);
            setTerminalOpen(null);
          }
        }} />
    </div>
  );
}

// ─── Save-changes review modal ─────────────────────────────
// Lists the merchants whose target version was edited locally OR who were
// flagged for removal-from-app. Operator confirms before we apply.
// NB: distinct name from merchant-apps.jsx's `SaveChangesModal` — both
// files load via <script type="text/babel"> which share the global scope,
// so a non-unique name silently clobbers the other.
function DeploymentSaveChangesModal({ open, rows, removals, onClose, onConfirm }) {
  if (!open) return null;
  const nVer = rows.length;
  const nRem = (removals || []).length;
  return (
    <window.Modal open={open} onClose={onClose} width={720}
      title="Review changes"
      subtitle={
        <>
          {nVer > 0 && <>{nVer} merchant{nVer === 1 ? "" : "s"} will be re-deployed</>}
          {nVer > 0 && nRem > 0 && " · "}
          {nRem > 0 && <>{nRem} merchant{nRem === 1 ? "" : "s"} will be removed from this app</>}
          . Confirm to submit.
        </>
      }
      padding={0}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <window.Button variant="ghost" onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="check" onClick={onConfirm}>
            Confirm & update
          </window.Button>
        </div>
      }>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {nVer > 0 && (
          <>
            <DeploymentSectionHead label="Target-version updates" count={nVer} />
            <table className="tds-table num" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Current version</th>
                  <th style={{ width: 24 }}></th>
                  <th>Target version</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.merchant.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.merchant.name}</span>
                        <span style={{ fontSize: 11, color: "var(--fg3)" }}>{r.merchant.region}</span>
                      </div>
                    </td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{r.current.name}</span></td>
                    <td style={{ color: "var(--fg3)", textAlign: "center" }}>→</td>
                    <td>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 500,
                        color: (r.target.code || 0) >= (r.current.code || 0)
                          ? "var(--color-success-700)" : "var(--color-warning-700)" }}>
                        {r.target.name}
                      </span>
                      {(r.target.code || 0) < (r.current.code || 0) && (
                        <span style={{ marginLeft: 8, fontSize: 10.5, color: "var(--color-warning-700)" }}>
                          downgrade
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {nRem > 0 && (
          <>
            <DeploymentSectionHead label="Removals — app will be uninstalled" count={nRem} tone="error" />
            <table className="tds-table num" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Region</th>
                  <th>Current version</th>
                </tr>
              </thead>
              <tbody>
                {removals.map(r => (
                  <tr key={r.merchant.id}>
                    <td>
                      <span style={{ fontSize: 12.5, fontWeight: 500,
                                     textDecoration: "line-through", color: "var(--fg3)" }}>
                        {r.merchant.name}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--fg3)" }}>{r.merchant.region}</td>
                    <td>
                      <span className="mono" style={{ fontSize: 12, color: "var(--fg3)",
                                                       textDecoration: "line-through" }}>
                        {r.current.name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </window.Modal>
  );
}

// Renamed from `SectionHead` to avoid global-scope clash with the
// wizard.jsx component of the same name (different prop shape).
function DeploymentSectionHead({ label, count, tone }) {
  return (
    <div style={{
      padding: "10px 16px 6px",
      display: "flex", alignItems: "center", gap: 8,
      background: "var(--bg3)",
      borderBottom: "1px solid var(--border-1)",
    }}>
      <span className="overline" style={{
        fontSize: 10.5,
        color: tone === "error" ? "var(--color-error-700)" : "var(--fg2)",
      }}>{label}</span>
      <span className="mono num" style={{ fontSize: 11, color: "var(--fg3)" }}>· {count}</span>
    </div>
  );
}

// ─── Assign-merchant picker (step 1 of the bind flow) ────
// Lists every merchant in the tenant's fleet that does NOT already have
// this app. Multi-select with "Select all". Version defaults to the
// tenant's latest local-pool version with a "Change" link to override.
// "Next · Pick strategy" hands the selection off to RolloutModal at its
// strategy step — see AssignMerchOpen wiring in SubscribedDeployments.
function AssignMerchantModal({ tenant, app, excludedMerchantIds, defaultVersion,
                               versionOptions, onClose, onNext }) {
  const fleet = (window.MERCHANT_FLEETS?.[tenant?.id] || []);
  const available = fleet.filter(m => !excludedMerchantIds.has(m.id));

  const [picked, setPicked] = useStateS(new Set());
  const [q, setQ]           = useStateS("");
  const [regionFilter, setRegionFilter] = useStateS("any");
  const [version, setVersion] = useStateS(defaultVersion || versionOptions[0] || null);
  const [versionPickerOpen, setVersionPickerOpen] = useStateS(false);
  const versionAnchorRef = React.useRef(null);

  const regionOpts = useMemoS(() => {
    const seen = new Set();
    available.forEach(m => m.region && seen.add(m.region));
    return [...seen].sort();
  }, [available]);

  const filtered = available.filter(m => {
    if (regionFilter !== "any" && m.region !== regionFilter) return false;
    if (q && !m.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const allFilteredPicked = filtered.length > 0 && filtered.every(m => picked.has(m.id));
  const someFilteredPicked = filtered.some(m => picked.has(m.id));

  const togglePick = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };
  const toggleAll = () => {
    const next = new Set(picked);
    if (allFilteredPicked) filtered.forEach(m => next.delete(m.id));
    else                   filtered.forEach(m => next.add(m.id));
    setPicked(next);
  };

  const pickedCount = picked.size;
  const isLatest = version && versionOptions[0] && version.id === versionOptions[0].id;

  return (
    <window.Modal open onClose={onClose} width={720} padding={0}
      title={<>Assign merchant — <span style={{ fontWeight: 500 }}>{app.name}</span></>}
      subtitle="Pick which merchants get this app. Already-assigned merchants are managed from the Deployments table."
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--fg3)" }}>
            <span className="mono num" style={{ color: "var(--fg1)", fontWeight: 500 }}>{pickedCount}</span> selected
          </span>
          <div style={{ flex: 1 }} />
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary iconRight="chevr"
            disabled={pickedCount === 0 || !version}
            onClick={() => onNext({
              merchants: available.filter(m => picked.has(m.id)),
              version,
            })}>
            Next · Pick strategy
          </window.Button>
        </>
      }>
      {/* Version pill — defaults to latest in local pool. "Change" toggles
          a dropdown so operators can pin to a specific approved version
          (canary, hold-back). */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-1)",
        background: "var(--bg3)",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span className="overline" style={{ fontSize: 10.5, color: "var(--fg3)" }}>Version</span>
        <div ref={versionAnchorRef} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono num" style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)" }}>
            {version?.name || "—"}
          </span>
          {isLatest && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: "var(--radius-sm)",
              background: "var(--color-success-50)", color: "var(--color-success-700)",
              border: "1px solid oklch(78% 0.12 152 / 0.4)",
            }}>latest</span>
          )}
          {versionOptions.length > 1 && (
            <a href="#" onClick={(e) => { e.preventDefault(); setVersionPickerOpen(o => !o); }}
              style={{ fontSize: 11.5, marginLeft: 4, color: "var(--color-primary-600)", textDecoration: "none" }}>
              {versionPickerOpen ? "Hide" : "Change"}
            </a>
          )}
        </div>
        {versionPickerOpen && (
          <div style={{
            flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4,
          }}>
            {versionOptions.map(v => {
              const active = v.id === version?.id;
              return (
                <button key={v.id}
                  onClick={() => { setVersion(v); setVersionPickerOpen(false); }}
                  style={{
                    padding: "4px 10px", borderRadius: "var(--radius-sm)",
                    border: `1px solid ${active ? "var(--color-primary-500)" : "var(--border-1)"}`,
                    background: active ? "var(--color-primary-50)" : "var(--bg2)",
                    color: active ? "var(--color-primary-700)" : "var(--fg1)",
                    cursor: "pointer", fontSize: 12,
                  }}>
                  <span className="mono num">{v.name}</span>
                  {versionOptions[0]?.id === v.id && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-success-700)" }}>· latest</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      {available.length > 0 && (
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-1)",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <div style={{ width: 240 }}>
            <window.Input size="sm" prefix={<window.Ico name="search" size={12} />}
              placeholder="Search merchant…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {regionOpts.length > 1 && (
            <FilterSelect label="Region" value={regionFilter} onChange={setRegionFilter}
              options={[{ value: "any", label: "All regions" },
                        ...regionOpts.map(r => ({ value: r, label: r }))]} />
          )}
        </div>
      )}

      {/* List */}
      {available.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--fg3)", fontSize: 12.5 }}>
          {fleet.length === 0
            ? "No merchants in your fleet yet."
            : "All your merchants already have this app. Manage assignments from the Deployments table."}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fg3)", fontSize: 12.5 }}>
          No merchants match those filters.
        </div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {/* Select-all header */}
          <button onClick={toggleAll}
            style={{
              width: "100%", padding: "8px 16px",
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg3)",
              borderBottom: "1px solid var(--border-1)",
              cursor: "pointer", textAlign: "left",
            }}>
            <SelectCheckbox checked={allFilteredPicked} indeterminate={!allFilteredPicked && someFilteredPicked} />
            <span className="overline" style={{ fontSize: 10.5, color: "var(--fg2)" }}>
              {allFilteredPicked ? "Deselect all" : "Select all"}
            </span>
            <span className="mono num" style={{ fontSize: 11, color: "var(--fg3)" }}>· {filtered.length}</span>
          </button>
          {filtered.map(m => {
            const on = picked.has(m.id);
            return (
              <button key={m.id} onClick={() => togglePick(m.id)}
                style={{
                  width: "100%", padding: "10px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                  background: on ? "var(--color-primary-50)" : "transparent",
                  borderBottom: "1px solid var(--border-1)",
                  cursor: "pointer", textAlign: "left",
                }}>
                <SelectCheckbox checked={on} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg3)" }}>
                    {m.region}
                    {m.terminals != null && <> · <span className="mono num">{m.terminals}</span> terminals</>}
                  </div>
                </div>
                {(m.tags || []).slice(0, 2).map(t => (
                  <span key={t} style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: "var(--radius-sm)",
                    background: "var(--bg3)", color: "var(--fg2)",
                    border: "1px solid var(--border-1)",
                  }}>{t}</span>
                ))}
              </button>
            );
          })}
        </div>
      )}
    </window.Modal>
  );
}

// Tiny checkbox visual — matches existing chrome (no real input; the parent
// <button> handles click + a11y via its role/tabindex defaults).
function SelectCheckbox({ checked, indeterminate }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: 3,
      border: `1px solid ${checked || indeterminate ? "var(--color-primary-500)" : "var(--border-2)"}`,
      background: checked || indeterminate ? "var(--color-primary-500)" : "var(--bg1)",
      flex: "0 0 auto",
    }}>
      {checked && <window.Ico name="check" size={11} style={{ color: "white" }} />}
      {!checked && indeterminate && (
        <span style={{ width: 8, height: 2, background: "white", borderRadius: 1 }} />
      )}
    </span>
  );
}

// ─── Custom Target-version dropdown — link-style trigger ──
// Replaces the native <select> in the table. Renders a compact <a> that
// toggles a popover of version options on click. The popover is rendered
// via PortalDropdown so it isn't clipped by scrolling ancestors.
function TargetVersionDropdown({ value, options, latestId, isDirty, disabled, onChange }) {
  const [open, setOpen] = useStateS(false);
  const anchorRef = React.useRef(null);
  const current = options.find(v => v.id === value) || options[0];
  return (
    <>
      <a href="#" role="button" ref={anchorRef}
        aria-haspopup="listbox" aria-expanded={open}
        onClick={(e) => { e.preventDefault(); if (!disabled) setOpen(o => !o); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          color: disabled
                  ? "var(--fg3)"
                  : isDirty
                    ? "var(--color-warning-700)"
                    : "var(--color-primary-700)",
          fontFamily: "var(--font-family-mono)",
          fontSize: 12.5,
          fontWeight: 500,
          textDecoration: disabled ? "line-through"
                        : isDirty  ? "underline dotted"
                                   : "none",
          textUnderlineOffset: 3,
          cursor: disabled ? "not-allowed" : "pointer",
          pointerEvents: disabled ? "none" : undefined,
        }}>
        <span>{current?.name || "—"}</span>
        {!disabled && latestId && current?.id === latestId && (
          <span style={{ fontSize: 9.5, color: "var(--color-success-700)",
                         textDecoration: "none", fontFamily: "var(--font-family-sans)" }}>latest</span>
        )}
        {!disabled && <window.Ico name="chevdown" size={10} />}
      </a>
      <window.PortalDropdown anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}
        placement="bottom-start" minWidth={160}>
        <div role="listbox" style={{
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-3)",
          padding: 4,
        }}>
          {options.map(v => {
            const active = v.id === value;
            return (
              <button key={v.id}
                onClick={() => { onChange(v.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  width: "100%", textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-family-mono)",
                  fontSize: 12.5,
                  background: active ? "var(--color-primary-50)" : "transparent",
                  color: active ? "var(--color-primary-700)" : "var(--fg1)",
                  fontWeight: active ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg3)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                {active && <window.Ico name="check" size={11} />}
                <span style={{ flex: 1, paddingLeft: active ? 0 : 17 }}>{v.name}</span>
                {latestId && v.id === latestId && (
                  <span style={{ fontSize: 10, color: "var(--color-success-700)",
                                 fontFamily: "var(--font-family-sans)" }}>latest</span>
                )}
              </button>
            );
          })}
        </div>
      </window.PortalDropdown>
    </>
  );
}

// ─── Compact filter dropdown (label + value) ───────────────
function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useStateS(false);
  const anchorRef = React.useRef(null);
  const current = options.find(o => o.value === value) || options[0];
  const active = value !== "any";
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid",
        borderColor: active ? "var(--color-primary-500)" : "var(--border-2)",
        background: active ? "var(--color-primary-50)" : "var(--bg2)",
        color: active ? "var(--color-primary-700)" : "var(--fg1)",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 11, color: active ? "var(--color-primary-700)" : "var(--fg3)" }}>
          {label}:
        </span>
        <span style={{ fontWeight: active ? 500 : 400 }}>{current.label}</span>
        <window.Ico name="chevdown" size={10} />
      </button>
      <window.PortalDropdown anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}
        placement="bottom-start" minWidth={200}>
        <div role="listbox" style={{
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-3)",
          padding: 4,
          maxHeight: 280, overflowY: "auto",
        }}>
          {options.map(o => {
            const isActive = o.value === value;
            return (
              <button key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  width: "100%", textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12.5,
                  background: isActive ? "var(--color-primary-50)" : "transparent",
                  color: isActive ? "var(--color-primary-700)" : "var(--fg1)",
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg3)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                {isActive
                  ? <window.Ico name="check" size={11} />
                  : <span style={{ width: 11, display: "inline-block" }} />}
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      </window.PortalDropdown>
    </>
  );
}

// ─── MoreFiltersDropdown · overflow panel for secondary filters ───
// Region / Tags / Strategy live behind a single trigger so the deployments
// toolbar doesn't drown in inline filter pills. Trigger shows an active
// badge when any of the three are set; "Clear all" inside the panel wipes
// just this trio.
function MoreFiltersDropdown({ regionOptions, regionFilter, setRegionFilter,
                               tagOptions, tagFilter, setTagFilter,
                               strategyFilter, setStrategyFilter }) {
  const [open, setOpen] = useStateS(false);
  const anchorRef = React.useRef(null);
  const activeCount =
    (regionFilter !== "any" ? 1 : 0) +
    ((tagFilter && tagFilter.length > 0) ? 1 : 0) +
    (strategyFilter !== "any" ? 1 : 0);
  const active = activeCount > 0;

  const clearAll = (e) => {
    e.stopPropagation();
    setRegionFilter("any");
    setTagFilter([]);
    setStrategyFilter("any");
  };

  const toggleTag = (tag) => {
    if (tagFilter.includes(tag)) {
      setTagFilter(tagFilter.filter(t => t !== tag));
    } else {
      setTagFilter([...tagFilter, tag]);
    }
  };

  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid",
        borderColor: active ? "var(--color-primary-500)" : "var(--border-2)",
        background: active ? "var(--color-primary-50)" : "var(--bg2)",
        color: active ? "var(--color-primary-700)" : "var(--fg1)",
        fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        <window.Ico name="filter" size={12} />
        <span style={{ fontWeight: active ? 500 : 400 }}>More filters</span>
        {active && (
          <span className="mono num" style={{
            display: "inline-grid", placeItems: "center",
            minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 999, fontSize: 10, fontWeight: 600,
            background: "var(--color-primary-600)", color: "#fff",
          }}>{activeCount}</span>
        )}
        <window.Ico name="chevdown" size={10} />
      </button>
      <window.PortalDropdown anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}
        placement="bottom-end" minWidth={300}>
        <div style={{
          width: 320,
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-3)",
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "var(--bg2)",
          }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg2)",
              textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Filters
            </span>
            {active && (
              <button onClick={clearAll} style={{
                fontSize: 11.5, color: "var(--color-primary-700)",
                padding: "2px 6px", borderRadius: 4, cursor: "pointer",
              }}>Clear all</button>
            )}
          </div>

          {/* Region */}
          <MFSection label="Region">
            <MFOptionList
              options={[{ value: "any", label: "All regions" },
                        ...regionOptions.map(r => ({ value: r, label: r }))]}
              value={regionFilter}
              onChange={setRegionFilter} />
          </MFSection>

          {/* Tags */}
          {tagOptions.length > 0 && (
            <MFSection label="Tags" subtitle={tagFilter.length > 0
              ? `${tagFilter.length} selected`
              : "Match any of the picked tags"}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tagOptions.map(t => {
                  const on = tagFilter.includes(t);
                  return (
                    <button key={t} onClick={() => toggleTag(t)} style={{
                      padding: "3px 9px", borderRadius: 999,
                      fontSize: 11.5, fontWeight: on ? 500 : 400,
                      background: on ? "var(--color-primary-50)" : "var(--bg2)",
                      color: on ? "var(--color-primary-700)" : "var(--fg2)",
                      border: "1px solid",
                      borderColor: on ? "var(--color-primary-500)" : "var(--border-1)",
                      cursor: "pointer",
                    }}>{t}</button>
                  );
                })}
              </div>
            </MFSection>
          )}

          {/* Strategy */}
          <MFSection label="Strategy">
            <MFOptionList
              options={[{ value: "any",       label: "All strategies" },
                        { value: "casual",    label: "Casual" },
                        { value: "immediate", label: "Immediate" },
                        { value: "custom",    label: "Custom" }]}
              value={strategyFilter}
              onChange={setStrategyFilter} />
          </MFSection>
        </div>
      </window.PortalDropdown>
    </>
  );
}

function MFSection({ label, subtitle, children }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderBottom: "1px solid var(--color-border-subtle)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div className="overline" style={{ fontSize: 10, fontWeight: 600, color: "var(--fg3)" }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10.5, color: "var(--fg3)" }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function MFOptionList({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", textAlign: "left",
              padding: "5px 8px",
              borderRadius: 4,
              fontSize: 12.5,
              background: on ? "var(--color-primary-50)" : "transparent",
              color: on ? "var(--color-primary-700)" : "var(--fg1)",
              fontWeight: on ? 500 : 400,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg3)"; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
            <span style={{
              width: 12, height: 12, borderRadius: "50%",
              border: "1.5px solid",
              borderColor: on ? "var(--color-primary-600)" : "var(--border-2)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-primary-600)" }} />}
            </span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Per-row kebab menu — Unassign / Uninstall ─────────────
// Replaces the old X-icon + pending-removal flow. Both actions are
// immediate: Unassign hard-removes the (merchant, app) relationship
// (terminals keep running the app), Uninstall additionally clears
// ROLLOUT_HISTORY and dispatches the uninstall command to terminals.
function RowKebabMenu({ merchantName, terminalCount, onUnassign, onUninstall }) {
  const [open, setOpen] = useStateS(false);
  const anchorRef = React.useRef(null);
  return (
    <>
      <button ref={anchorRef}
        onClick={() => setOpen(o => !o)}
        title={`Actions for ${merchantName}`}
        aria-label={`Actions for ${merchantName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 24, height: 24,
          display: "inline-grid", placeItems: "center",
          borderRadius: "var(--radius-sm)",
          color: open ? "var(--fg1)" : "var(--fg3)",
          background: open ? "var(--bg-active)" : "transparent",
          cursor: "pointer",
          transition: "background 120ms, color 120ms",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}>
        <window.Ico name="more" size={14} />
      </button>
      {window.PortalDropdown && (
        <window.PortalDropdown anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}
          placement="bottom-end" minWidth={240}>
          <div role="menu" style={{
            padding: 4,
            background: "var(--bg2)",
            border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-3)",
          }}>
            <KebabMenuItem
              icon="x"
              label="Unassign"
              detail="Stop managing this app on this merchant. Terminals keep running it."
              onClick={() => { setOpen(false); onUnassign(); }} />
            <div style={{ height: 1, background: "var(--border-1)", margin: "4px 0" }} />
            <KebabMenuItem
              icon="trash"
              label="Uninstall on terminals…"
              detail={`Remove the app from ${terminalCount} terminal${terminalCount === 1 ? "" : "s"}.`}
              danger
              onClick={() => { setOpen(false); onUninstall(); }} />
          </div>
        </window.PortalDropdown>
      )}
    </>
  );
}

function KebabMenuItem({ icon, label, detail, danger, onClick }) {
  const [hover, setHover] = useStateS(false);
  const fg = danger ? "var(--color-error-700)" : "var(--fg1)";
  return (
    <button role="menuitem" onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", textAlign: "left",
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "8px 10px",
        background: hover ? (danger ? "var(--color-error-50)" : "var(--bg-hover)") : "transparent",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        color: fg,
      }}>
      <window.Ico name={icon} size={13} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 11, color: danger ? "var(--color-error-700)" : "var(--fg3)", opacity: 0.85, marginTop: 2, lineHeight: 1.45 }}>
            {detail}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Unassign confirm modal — soft remove ──────────────────
// Stops managing the (merchant, app) relationship. Terminals already
// running the app keep it. For destructive uninstall, see the Uninstall
// flow which routes through RolloutModal for a strategy pick.
function UnassignConfirmModal({ merchant, currentVersion, app, onClose, onConfirm }) {
  return (
    <window.Modal open onClose={onClose} width={520}
      title={<>Unassign · <span style={{ fontWeight: 500 }}>{merchant.name}</span></>}
      subtitle={`Stop managing ${app.name} on this merchant. The app stays installed on terminals — no command is sent.`}
      footer={
        <>
          <window.Button onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="x" onClick={onConfirm}>
            Unassign
          </window.Button>
        </>
      }>
      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: "12px 14px",
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        fontSize: 12.5, lineHeight: 1.6, color: "var(--fg2)",
      }}>
        <BulletLine tone="neutral">
          <strong>Terminals keep running {currentVersion?.name || "the current version"}.</strong> No uninstall command is sent.
        </BulletLine>
        <BulletLine tone="neutral">
          <strong>No future updates</strong> will be delivered for this app on this merchant.
        </BulletLine>
        <BulletLine tone="neutral">
          The merchant disappears from this Deployments table and from <span style={{ fontWeight: 500 }}>{merchant.name}</span>'s Apps tab.
        </BulletLine>
        <BulletLine tone="info">
          You can <strong>re-assign at any time</strong> from this page's "Assign merchant" button.
        </BulletLine>
      </div>
    </window.Modal>
  );
}

function BulletLine({ tone, children }) {
  const dotColor = tone === "info" ? "var(--color-primary-500)" : "var(--fg3)";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: dotColor, marginTop: 7, flexShrink: 0,
      }} />
      <div>{children}</div>
    </div>
  );
}

// ─── Upgrade-all confirmation ──────────────────────────────
function UpgradeAllModal({ open, latest, count, totalCount, onClose, onConfirm }) {
  if (!open || !latest) return null;
  return (
    <window.Modal open={open} onClose={onClose} width={520}
      title="Upgrade all merchants to latest"
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <window.Button variant="ghost" onClick={onClose}>Cancel</window.Button>
          <window.Button primary icon="upload" onClick={onConfirm} disabled={count === 0}>
            Confirm & roll out
          </window.Button>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--fg2)", lineHeight: 1.55 }}>
          This will set every merchant currently behind the latest version to upgrade to{" "}
          <span className="mono" style={{ fontWeight: 600, color: "var(--color-primary-700)" }}>{latest.name}</span>.
          The rollout is queued immediately — terminals pick it up on their next check-in.
        </div>
        <div style={{
          padding: "12px 14px",
          background: "var(--bg3)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-md)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        }}>
          <div>
            <div className="overline" style={{ fontSize: 10 }}>Target version</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary-700)", marginTop: 2 }}>
              {latest.name}
            </div>
          </div>
          <div>
            <div className="overline" style={{ fontSize: 10 }}>Will upgrade</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              <span className="mono num">{count}</span>
              <span style={{ fontSize: 11, color: "var(--fg3)", fontWeight: 400 }}> / {totalCount} merchants</span>
            </div>
          </div>
        </div>
        {count === 0 && (
          <div style={{ fontSize: 12, color: "var(--fg3)" }}>
            Every merchant is already on the latest version — nothing to do.
          </div>
        )}
      </div>
    </window.Modal>
  );
}

// ─── Per-terminal status derivation ────────────────────────
// A terminal's status is computed against the merchant's TARGET version:
//   • if the terminal is already at or beyond the target → "installed"
//   • else, look up the latest event for (sn, targetVersion.id):
//       - awaiting        — no record yet, hasn't picked up the rollout
//       - downloading     — download in flight
//       - downloaded      — download done, install pending
//       - download-failed
//       - install-failed
// Status is bucketed deterministically from a hash of (sn, targetId),
// then surfaced both in the row chip and in the upgrade-log timeline.
const TERMINAL_STATUS_MAP = {
  "installed":        { label: "Installed",       tone: "success", short: "INSTALLED" },
  "awaiting":         { label: "Awaiting update", tone: "neutral", short: "AWAITING"  },
  "downloading":      { label: "Downloading",     tone: "info",    short: "DOWNLOADING" },
  "downloaded":       { label: "Installing",      tone: "info",    short: "INSTALLING" },
  "download-failed":  { label: "Download failed", tone: "error",   short: "DL-FAILED" },
  "install-failed":   { label: "Install failed",  tone: "error",   short: "INST-FAILED" },
};

function _hash(s) {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

function computeTerminalStatus(terminal, targetVersion) {
  if (!targetVersion) return { status: "installed", ...TERMINAL_STATUS_MAP["installed"] };
  if ((terminal.currentVersionCode || 0) >= (targetVersion.code || 0)) {
    return { status: "installed", ...TERMINAL_STATUS_MAP["installed"] };
  }
  const h = _hash(`${terminal.sn}:${targetVersion.id}`);
  const r = h % 100;
  // Bucketing: 35% haven't picked up the rollout yet (awaiting),
  // 18% downloading, 17% downloaded-waiting-install, 15% install-failed, 15% download-failed.
  const bucket =
    r < 35 ? "awaiting" :
    r < 53 ? "downloading" :
    r < 70 ? "downloaded" :
    r < 85 ? "install-failed" :
             "download-failed";
  return { status: bucket, ...TERMINAL_STATUS_MAP[bucket] };
}

// ─── Terminal upgrade-event log ────────────────────────────
// Click a terminal in the expanded merchant row → see its update timeline.
// Events are derived from the terminal's status against the TARGET version
// (not the merchant's currently-deployed version) so the operator sees the
// state of the rollout they're actually managing.
function buildUpgradeEvents(terminal, targetVersion) {
  const { status } = computeTerminalStatus(terminal, targetVersion);
  const h = _hash(`${terminal.sn}:${targetVersion?.id || ""}`);
  const base = new Date(2026, 4, 14, 9, 30, 0).getTime();
  const tick = (i) => new Date(base + i * (30000 + (h % 90000))).toISOString();
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit",
                                       month: "short", day: "2-digit", hour12: false });
  };
  const vname = targetVersion?.name || "—";
  const downloadFailReasons = [
    "Network timeout after 3 retries (last error: ETIMEDOUT)",
    "Insufficient storage (need 28.4 MB, free 11.2 MB)",
    "APK signature mismatch — server certificate did not match local trust store",
    "Connection reset by peer during chunk 412/640",
  ];
  const installFailReasons = [
    "INSTALL_FAILED_VERSION_DOWNGRADE — installed version code is higher than candidate",
    "App in use — pinpad transaction in progress, install deferred and then aborted by user",
    "INSTALL_FAILED_INSUFFICIENT_STORAGE during dex optimization",
    "Permission grant timed out — operator did not approve runtime permission prompts within 5 minutes",
  ];

  if (status === "awaiting") {
    return []; // no events on file
  }
  if (status === "installed") {
    return [
      { at: fmt(tick(0)), label: "Download started",   detail: `${vname} · 28.4 MB scheduled`,        ok: true },
      { at: fmt(tick(1)), label: "Download succeeded", detail: "Checksum verified · SHA-256 OK",      ok: true },
      { at: fmt(tick(2)), label: "Install succeeded",  detail: `Running ${vname}`,                    ok: true },
    ];
  }
  if (status === "downloading") {
    return [
      { at: fmt(tick(0)), label: "Download started", detail: `${vname} · queued at next check-in`, ok: true },
      { at: "—",          label: "Downloading…",     detail: "In progress — terminal will report on next heartbeat", pending: true },
    ];
  }
  if (status === "downloaded") {
    return [
      { at: fmt(tick(0)), label: "Download started",   detail: `${vname} · 28.4 MB scheduled`,                  ok: true },
      { at: fmt(tick(1)), label: "Download succeeded", detail: "Checksum verified · waiting for install window", ok: true },
      { at: "—",          label: "Installing…",        detail: "In progress — terminal will report on next heartbeat", pending: true },
    ];
  }
  if (status === "install-failed") {
    const reason = installFailReasons[(h >> 2) % installFailReasons.length];
    return [
      { at: fmt(tick(0)), label: "Download started",   detail: `${vname} · 28.4 MB scheduled`,   ok: true },
      { at: fmt(tick(1)), label: "Download succeeded", detail: "Checksum verified · SHA-256 OK", ok: true },
      { at: fmt(tick(2)), label: "Install failed",     detail: reason, fail: true },
    ];
  }
  // download-failed
  const reason = downloadFailReasons[(h >> 2) % downloadFailReasons.length];
  return [
    { at: fmt(tick(0)), label: "Download started", detail: `${vname} · 28.4 MB scheduled`, ok: true },
    { at: fmt(tick(1)), label: "Download failed",  detail: reason, fail: true },
  ];
}

function TerminalEventsModal({ info, app, onClose, onRetry }) {
  if (!info) return null;
  const { merchant, terminal, version } = info;
  // `version` here is the TARGET version (the row's target). Derive the
  // terminal's status against it, then build the matching event timeline.
  const st = computeTerminalStatus(terminal, version);
  const events = buildUpgradeEvents(terminal, version);
  const notOnTarget = st.status !== "installed";
  const isFailed = st.status === "install-failed" || st.status === "download-failed";
  const isAwaiting = st.status === "awaiting";
  const failedEvent = events.find(e => e.fail);
  // Display newest-first — operators care about the latest state, so the
  // failure / current step shows at the top, the trail flows downward.
  const displayEvents = [...events].reverse();
  return (
    <window.Modal open={!!info} onClose={onClose} width={620}
      title={<>Upgrade log · <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{terminal.sn}</span></>}
      subtitle={<>{merchant.name} · target <span className="mono">{version?.name}</span> · {app.name}</>}
      padding={0}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <window.Button variant="ghost" onClick={onClose}>Close</window.Button>
          {notOnTarget && (
            <window.Button primary icon="refresh" onClick={() => onRetry(terminal.sn)}>
              Retry now
            </window.Button>
          )}
        </div>
      }>
      <div style={{ padding: "16px 20px" }}>
        {isFailed && failedEvent && (
          <div style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: "var(--color-error-50)",
            border: "1px solid var(--color-error-500)",
            borderLeft: "3px solid var(--color-error-500)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-error-700)",
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              Failure reason · {failedEvent.label}
            </div>
            <div style={{ color: "var(--fg2)" }}>{failedEvent.detail}</div>
            <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--fg3)" }}>
              Click <b>Retry now</b> to send an immediate update command to this terminal.
            </div>
          </div>
        )}
        {isAwaiting && (
          <div style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: "var(--bg3)",
            border: "1px solid var(--border-2)",
            borderLeft: "3px solid var(--fg3)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--fg2)",
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3, color: "var(--fg1)" }}>
              Awaiting update
            </div>
            <div>
              No upgrade attempt on file for target <span className="mono">{version?.name}</span>.
              The terminal is on <span className="mono">v{terminal.currentVersionCode}</span> and
              hasn't picked up the rollout yet.
            </div>
            <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--fg3)" }}>
              Click <b>Retry now</b> to push the update command immediately instead of waiting for the next check-in.
            </div>
          </div>
        )}
        {!isFailed && !isAwaiting && notOnTarget && (
          <div style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: "var(--color-info-50)",
            border: "1px solid var(--color-info-500)",
            borderLeft: "3px solid var(--color-info-500)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-info-700)",
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              {st.label}
            </div>
            <div style={{ color: "var(--fg2)" }}>
              This terminal hasn't yet reached target <span className="mono">{version?.name}</span>.
              Updates normally land on the next heartbeat.
            </div>
            <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--fg3)" }}>
              Click <b>Retry now</b> to force the terminal to attempt the update immediately.
            </div>
          </div>
        )}
        {displayEvents.length === 0 && (
          <div style={{ padding: "12px 4px", fontSize: 12, color: "var(--fg3)", textAlign: "center" }}>
            No events on file for this target version.
          </div>
        )}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
          <span aria-hidden="true" style={{
            position: "absolute", left: 7, top: 6, bottom: 6,
            width: 2, background: "var(--border-1)", borderRadius: 1,
          }} />
          {displayEvents.map((ev, i) => {
            const tone = ev.fail ? "error" : ev.pending ? "info" : "success";
            const bullet = ev.fail ? "var(--error)" : ev.pending ? "var(--info)" : "var(--success)";
            return (
              <li key={i} style={{ position: "relative", paddingLeft: 28, paddingBottom: 16 }}>
                <span style={{
                  position: "absolute", left: 0, top: 2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff",
                  border: `3px solid ${bullet}`,
                  display: "grid", placeItems: "center",
                }}>
                  {ev.pending && (
                    <span className="a-spin" style={{
                      width: 6, height: 6, borderRadius: "50%",
                      border: "2px solid var(--info)",
                      borderTopColor: "transparent",
                    }} />
                  )}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500,
                    color: tone === "error" ? "var(--color-error-700)"
                         : tone === "info"  ? "var(--color-info-700)"
                                            : "var(--color-success-700)" }}>
                    {ev.label}
                  </span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)", marginLeft: "auto" }}>
                    {ev.at}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 2, lineHeight: 1.5 }}>
                  {ev.detail}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </window.Modal>
  );
}

// ─── Versions tab ────────────────────────────────────────
function AppVersions({ app, navigate, openPublishWizard, currentSubscribedId, isOwnApp, onPullVersion, route }) {
  const tenant = window.useActiveTenant();
  const fromEntry = route?.from || (isOwnApp ? "appPublish" : "appStore");

  // ─── Filters ──
  // Outside: search (version name/code), status.
  // Status options vary by viewer kind:
  //   own apps  → any / published / unpublished / rollback
  //   external  → adds waiting-approval (computed from pending notif).
  const [q,              setQ]              = useStateS("");
  const [statusFilter,   setStatusFilter]   = useStateS("any");
  // More: release date bucket, scan severity, min Android.
  const [releaseFilter,  setReleaseFilter]  = useStateS("any");   // any | 30d | 90d | year
  const [scanFilter,     setScanFilter]     = useStateS("any");   // any | clean | issues | high | none
  const [androidFilter,  setAndroidFilter]  = useStateS(new Set()); // multi: "24" | "26" | "29"…

  // Distinct minSdk values across this app's versions — keeps the chip set tight.
  const sdkOptions = useMemoS(() => {
    return [...new Set(app.versions.map(v => v.minSdk).filter(Boolean))].sort((a, b) => a - b);
  }, [app.versions]);

  const _DEMO_NOW_V = new Date("2026-05-17");
  const daysSinceV = (s) => {
    if (!s) return Number.POSITIVE_INFINITY;
    const d = new Date(s);
    if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
    return Math.floor((_DEMO_NOW_V - d) / 86400000);
  };

  const effectiveStatusKey = (v) => {
    const pending = !isOwnApp && window.getPendingApproval
      ? window.getPendingApproval(tenant.id, app.id, v.id)
      : null;
    if (pending) return "waiting-approval";
    if (v.status === "published") return "available";
    return v.status;
  };

  const filteredVersions = useMemoS(() => {
    return app.versions.filter(v => {
      if (q) {
        const n = q.toLowerCase();
        if (!`${v.name} ${v.code}`.toLowerCase().includes(n)) return false;
      }
      if (statusFilter !== "any" && effectiveStatusKey(v) !== statusFilter) return false;
      if (releaseFilter !== "any") {
        const days = daysSinceV(v.publishedAt || v.uploadedAt);
        if (releaseFilter === "30d"  && !(days <= 30))  return false;
        if (releaseFilter === "90d"  && !(days <= 90))  return false;
        if (releaseFilter === "year" && !(days <= 365)) return false;
      }
      if (scanFilter !== "any") {
        const findings = v.scan ? window.SCAN_FINDINGS_TEMPLATES[v.scan] : null;
        const counts = findings ? window.summariseFindings(findings) : null;
        if (scanFilter === "none"  && counts != null) return false;
        if (scanFilter === "clean" && !(counts && (counts.critical + counts.high) === 0 && Object.values(counts).reduce((a,b) => a+b, 0) <= 2)) return false;
        if (scanFilter === "issues" && !(counts && Object.values(counts).reduce((a,b) => a+b, 0) > 0)) return false;
        if (scanFilter === "high"  && !(counts && (counts.critical + counts.high) > 0)) return false;
      }
      if (androidFilter.size > 0 && !androidFilter.has(String(v.minSdk))) return false;
      return true;
    });
  }, [app.versions, q, statusFilter, releaseFilter, scanFilter, androidFilter, tenant.id]);

  const versionsPager = window.usePaginated(filteredVersions, 5,
    `${app.id}|${q}|${statusFilter}|${releaseFilter}|${scanFilter}|${[...androidFilter].sort().join(",")}`);

  const moreActiveCountV =
    (releaseFilter !== "any" ? 1 : 0) +
    (scanFilter    !== "any" ? 1 : 0) +
    (androidFilter.size > 0   ? 1 : 0);
  const resetMoreV = () => {
    setReleaseFilter("any"); setScanFilter("any"); setAndroidFilter(new Set());
  };

  // Resolve the set of versions this tenant has in their local pool. For
  // ISO subscribers, a row's "Local pool" badge tells operators which
  // versions are immediately deployable vs. upstream pull candidates.
  const localPoolIds = useMemoS(
    () => new Set(window.getLocalPoolVersions(tenant.id, app).map(v => v.id)),
    [tenant.id, app.id, app.versions]);
  // Bump to force re-render after a rejection state change.
  const [rejTick, setRejTick] = useStateS(0);
  const [blockTarget, setBlockTarget] = useStateS(null);

  const rejectVersion = (v, state) => {
    if (state === "blocked") {
      setBlockTarget(v);
      return;
    }
    window.setRejectionState(tenant.id, app.id, v.id, state);
    setRejTick(t => t + 1);
  };
  const confirmBlock = () => {
    if (!blockTarget) return;
    window.setRejectionState(tenant.id, app.id, blockTarget.id, "blocked");
    setRejTick(t => t + 1);
    setBlockTarget(null);
  };
  return (
    <div>
      {app.versions.length === 0 ? (
        <window.Card title="Version history" hint="0 versions">
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            padding: "32px 24px", textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "var(--color-bg-3)", color: "var(--color-text-tertiary)",
              display: "grid", placeItems: "center",
              border: "1px solid var(--color-border-subtle)",
            }}>
              <window.Ico name="upload" size={20} stroke={1.5} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>No versions uploaded yet</div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", maxWidth: 360 }}>
                Upload a signed APK to create the first version of <b>{app.name}</b>. Your APK gets a security scan, and then it becomes available in your app pool.
              </div>
            </div>
            {isOwnApp && (
              <window.Button primary icon="upload" onClick={() => openPublishWizard(app)}>
                Upload first version
              </window.Button>
            )}
          </div>
        </window.Card>
      ) : (
      <window.Card title="Version list" hint={`${app.versions.length} versions`}
        padding={0}>
        {/* Filter bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "10px 14px", borderBottom: "1px solid var(--border-1)",
          background: "var(--bg2)",
        }}>
          <window.Input size="sm" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search version / build code…"
            prefix={<window.Ico name="search" size={12} />}
            style={{ width: 220 }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{
            padding: "6px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-default)", fontSize: 12,
            fontFamily: "inherit", height: 30,
            background: "var(--bg2)", color: "var(--fg1)",
          }}>
            <option value="any">All statuses</option>
            <option value="available">Available</option>
            <option value="unpublished">Unpublished</option>
            <option value="rollback">Rollback</option>
            <option value="draft">Draft</option>
            {!isOwnApp && <option value="waiting-approval">Waiting Approval</option>}
          </select>
          <div style={{ marginLeft: "auto" }}>
          <window.MoreFilters activeCount={moreActiveCountV} onClear={resetMoreV} width={300}>
            <window.MoreFiltersSection label="Released">
              <window.FilterChipGroup
                value={releaseFilter} onChange={(v) => setReleaseFilter(v || "any")}
                options={[
                  { value: "any",  label: "Any time" },
                  { value: "30d",  label: "Last 30 days" },
                  { value: "90d",  label: "Last 90 days" },
                  { value: "year", label: "Last year" },
                ]} />
            </window.MoreFiltersSection>
            <window.MoreFiltersSection label="Scan result">
              <window.FilterChipGroup
                value={scanFilter} onChange={(v) => setScanFilter(v || "any")}
                options={[
                  { value: "any",    label: "Any" },
                  { value: "clean",  label: "Clean" },
                  { value: "issues", label: "Any issues" },
                  { value: "high",   label: "High / Critical" },
                  { value: "none",   label: "Not scanned" },
                ]} />
            </window.MoreFiltersSection>
            {sdkOptions.length > 0 && (
              <window.MoreFiltersSection label="Min Android">
                <window.FilterChipGroup multi
                  value={androidFilter} onChange={setAndroidFilter}
                  options={sdkOptions.map(s => ({
                    value: String(s),
                    label: `API ${s}${androidVersionName(s) ? " · " + androidVersionName(s) : ""}`,
                  }))} />
              </window.MoreFiltersSection>
            )}
          </window.MoreFilters>
          </div>
        </div>
        <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Version", "Code", "Size", "Uploaded", "Published", "Scan", "Status", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "8px 12px", fontSize: 11, fontWeight: 500,
                  color: "var(--color-text-tertiary)", textTransform: "uppercase",
                  letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)",
                  whiteSpace: "nowrap", background: "var(--color-bg-3)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredVersions.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--fg3)", fontSize: 12 }}>
                No versions match those filters.
              </td></tr>
            )}
            {versionsPager.slice.map(v => {
              // Resolve effective status label per spec:
              //   own apps   → Available / Unpublished / Rollback
              //   external   → Available / Waiting Approval / Unpublished / Rollback
              // Waiting Approval surfaces when there's a pending notification
              // for the (tenant, app, version) but the operator hasn't run
              // the Approval review yet.
              const pending = !isOwnApp && window.getPendingApproval
                ? window.getPendingApproval(tenant.id, app.id, v.id)
                : null;
              const effectiveStatusKey = pending ? "waiting-approval"
                : v.status === "published" ? "available"
                : v.status;
              const vst = window.VERSION_STATUS[effectiveStatusKey] || window.VERSION_STATUS[v.status] || window.APP_STATUS[v.status];
              const findings = v.scan ? window.SCAN_FINDINGS_TEMPLATES[v.scan] : null;
              const counts = findings ? window.summariseFindings(findings) : null;
              const rejection = !isOwnApp ? window.getRejectionState(tenant.id, app.id, v.id) : null;
              const isBlocked = rejection === "blocked";
              const isSkipped = rejection === "skipped";
              const isWaitingApproval = !!pending;
              // ISO view: a version is a pull-candidate only if it's
              // published upstream AND has NOT already been approved into
              // the local pool. Versions already in the local pool show
              // their normal action affordances (no "Approve" button).
              const canPullThis = !isOwnApp && v.status === "published"
                                  && !isBlocked && !isSkipped
                                  && !localPoolIds.has(v.id);
              return (
                <tr key={v.id}
                  onClick={() => navigate({ screen: "versionDetail", appId: app.id, versionId: v.id, from: fromEntry })}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background: isBlocked ? "var(--bg3)" : undefined,
                    opacity: isBlocked ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => { if (!isBlocked) e.currentTarget.style.background = "var(--color-bg-hover)"; }}
                  onMouseLeave={(e) => { if (!isBlocked) e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{v.name}</span>
                      {isOwnApp && v.current && <window.Pill tone="accent" size="sm">Current</window.Pill>}
                      {/* ISO view: mark the row that matches subscribedVersionId
                          as the active snapshot. */}
                      {!isOwnApp && currentSubscribedId === v.id && (
                        <window.Pill tone="accent" size="sm">Current snapshot</window.Pill>
                      )}
                      {isBlocked && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
                          background: "var(--bg3)", color: "var(--fg2)",
                          border: "1px solid var(--border-2)", fontWeight: 500,
                        }}>
                          <window.Ico name="lock" size={9} stroke={2.4} /> Blocked
                        </span>
                      )}
                      {isSkipped && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
                          background: "var(--bg3)", color: "var(--fg3)",
                          border: "1px solid var(--border-1)", fontWeight: 500,
                        }}>Skipped</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px", fontFamily: "var(--font-family-mono)", color: "var(--color-text-tertiary)" }}>{v.code}</td>
                  <td style={{ padding: "12px", color: "var(--color-text-secondary)" }}>{v.size}</td>
                  <td style={{ padding: "12px", color: "var(--color-text-secondary)" }}>{v.uploadedAt}</td>
                  <td style={{ padding: "12px", color: "var(--color-text-secondary)" }}>{v.publishedAt || <span style={{ color: "var(--color-text-tertiary)" }}>—</span>}</td>
                  <td style={{ padding: "12px", minWidth: 140 }}>
                    {counts ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60 }}><window.SeverityBar counts={counts} height={5} /></div>
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                          {counts.critical + counts.high > 0 && (
                            <span style={{ color: "var(--color-error-500)", fontWeight: 500 }}>{counts.critical + counts.high} high+ </span>
                          )}
                          <span className="mono">{Object.values(counts).reduce((a, b) => a + b, 0)}</span> total
                        </span>
                      </div>
                    ) : <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {isBlocked      ? <window.Pill tone="neutral" dot>Blocked</window.Pill>
                    : isSkipped      ? <window.Pill tone="neutral" dot>Skipped</window.Pill>
                    : <window.Pill tone={vst.tone} dot>{vst.label}</window.Pill>}
                  </td>
                  <td style={{ padding: "12px", color: "var(--color-text-tertiary)", textAlign: "right" }}
                      onClick={(e) => { if (!isOwnApp) e.stopPropagation(); }}>
                    {isOwnApp ? (
                      <window.Ico name="chevr" size={14} />
                    ) : isBlocked ? (
                      <window.Button size="sm"
                        onClick={() => rejectVersion(v, null)}>
                        Unblock
                      </window.Button>
                    ) : isSkipped ? (
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <window.Button size="sm"
                          onClick={() => rejectVersion(v, null)}>
                          Re-consider
                        </window.Button>
                        <window.Button size="sm" ghost icon="lock"
                          onClick={() => rejectVersion(v, "blocked")} title="Block" />
                      </div>
                    ) : isWaitingApproval ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <window.Button size="sm" variant="primary" icon="shieldCheck"
                          onClick={() => navigate({ screen: "approval", appId: app.id, versionId: v.id, from: fromEntry })}>
                          Review &amp; approve
                        </window.Button>
                      </div>
                    ) : canPullThis ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <window.Button size="sm" variant="primary" icon="download"
                          onClick={() => onPullVersion && onPullVersion(v)}>
                          Approve <span className="mono" style={{ marginLeft: 2 }}>{v.name}</span>
                        </window.Button>
                        <button title="Skip this version"
                          onClick={() => rejectVersion(v, "skipped")}
                          style={{ padding: 6, color: "var(--fg3)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                          <window.Ico name="arrowR" size={13} />
                        </button>
                        <button title="Block this version"
                          onClick={() => rejectVersion(v, "blocked")}
                          style={{ padding: 6, color: "var(--fg3)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                          <window.Ico name="lock" size={13} />
                        </button>
                      </div>
                    ) : (
                      <window.Ico name="chevr" size={14} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <window.Pagination
          page={versionsPager.page}
          pageSize={versionsPager.pageSize}
          total={versionsPager.total}
          onChange={versionsPager.setPage}
          onPageSizeChange={versionsPager.setPageSize}
          pageSizes={[5, 10, 20]}
        />
      </window.Card>
      )}
      <window.ConfirmDialog
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        title={blockTarget ? `Block ${blockTarget.name}?` : "Block version?"}
        body="This version will be hidden from update candidates until you explicitly unblock it."
        confirmLabel="Block version"
        tone="danger"
        icon="lock"
        onConfirm={confirmBlock} />
    </div>
  );
}

// ─── Subscribers tab — ISO companies that subscribed to this app.
// Subscribing = the ISO imports a snapshot of the app into its own pool.
function AppSubscribers({ app }) {
  const tenant = window.useActiveTenant();
  const isOwnApp = app.publisherTenantId === tenant.id;
  const hasISO = tenant.contracts.includes("ISO");
  // Subscriber chips: each entry in subscriberIds is either an
  // ISO_COMPANIES id (decorative chips from the seed) OR a real tenant id
  // (live subscriber writeback from the browse-pool flow). Look up both
  // and merge into a uniform { id, name, region?, merchants?, terminals? }.
  const isos = (app.subscriberIds || [])
    .map(id => {
      const co = (window.ISO_COMPANIES || []).find(c => c.id === id);
      if (co) return co;
      const tenantName = (window.TENANT_NAMES || {})[id];
      if (tenantName) {
        // Synthesize a row from live tenant info — counts approximated
        // from MERCHANT_FLEETS so the chip shows realistic numbers.
        const fleet = (window.MERCHANT_FLEETS || {})[id] || [];
        const terminals = fleet.reduce((sum, m) => sum + (m.terminals || 0), 0);
        return { id, name: tenantName, region: "—", merchants: fleet.length, terminals, tier: "Standard" };
      }
      return null;
    })
    .filter(Boolean);

  // Invite-Subscribe affordance only makes sense when the app is in
  // Specified ISOs mode — if it's All ISOs (public pool), any ISO can
  // self-subscribe and an invite would be redundant.
  const effectivePublishMode = isOwnApp ? (app.publishMode || "public") : null;
  const canInvite = isOwnApp
    && (app.versions || []).length > 0
    && effectivePublishMode === "private";
  const [inviteOpen, setInviteOpen] = useStateS(false);

  // Filter state — name search + specific-version filter.
  const [q, setQ] = useStateS("");
  const [versionFilter, setVersionFilter] = useStateS("any");

  // Deterministic per-(iso, app) state: which version each ISO is on, and
  // their lifecycle status with this app. Same seed every render, so the
  // demo data is stable. In production this would join SUBSCRIBED_APPS.
  const publishedVersions = useMemoS(
    () => (app.versions || []).filter(v => v.status === "published"),
    [app.versions]);
  const latestPublished = publishedVersions[0] || null;

  const subscriberRow = (iso) => {
    const seed = (iso.id + ":" + app.id).split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) & 0x7fffffff, 0);
    const r = seed % 10;
    // Seeded subscribed-since date — deterministic so the demo doesn't shift
    // on every render. Range: 1–270 days ago.
    const daysAgo = 5 + (seed % 265);
    const subscribedAgo = daysAgo < 14 ? `${daysAgo}d ago`
                      : daysAgo < 60 ? `${Math.round(daysAgo / 7)}w ago`
                      :                `${Math.round(daysAgo / 30)}mo ago`;
    // Approximate reach on this app = ISO's footprint, biased down by the
    // seed so not every ISO is at full reach.
    const reachPct  = 60 + (seed % 41);
    const terminalsReached = Math.round((iso.terminals || 0) * reachPct / 100);
    const merchantsReached = Math.round((iso.merchants  || 0) * reachPct / 100);

    if (r >= 9) {
      // Unsubscribed — no current version.
      return { status: { tone: "neutral", label: "Unsubscribed" }, version: null,
               subscribedAgo: "—", terminalsReached: 0, merchantsReached: 0, sortKey: 4 };
    }
    if (r >= 7) {
      // Pending approval — they're behind, on an older version (if exists)
      const olderVersions = publishedVersions.slice(1);
      const fallback = olderVersions[seed % Math.max(1, olderVersions.length)] || latestPublished;
      return { status: { tone: "warning", label: "Pending approval" }, version: fallback,
               subscribedAgo, terminalsReached, merchantsReached, sortKey: 0 };
    }
    if (r >= 5 && publishedVersions.length > 1) {
      // Behind — they've subscribed to an older version but haven't seen
      // the latest publish yet (no notification was fired).
      const older = publishedVersions[1] || latestPublished;
      return { status: { tone: "warning", label: "Unsubscribed" }, version: older,
               subscribedAgo, terminalsReached, merchantsReached, sortKey: 1 };
    }
    // Up to date — on the latest published version.
    return { status: { tone: "success", label: "Up to date" }, version: latestPublished,
             subscribedAgo, terminalsReached, merchantsReached, sortKey: 3 };
  };

  // Sort by priority: pending approval → unsubscribed (older) → up to date → unsubscribed (none).
  const rows = useMemoS(() => isos
    .map(iso => ({ iso, ...subscriberRow(iso) }))
    .sort((a, b) => a.sortKey - b.sortKey || a.iso.name.localeCompare(b.iso.name)),
    [isos, publishedVersions]);

  // Totals for KPI strip
  const totals = useMemoS(() => {
    const counts = { total: rows.length, onLatest: 0, pending: 0, behind: 0, unsubscribed: 0,
                     terminals: 0, merchants: 0 };
    rows.forEach(r => {
      counts.terminals += r.terminalsReached;
      counts.merchants += r.merchantsReached;
      if (r.status.label === "Up to date")        counts.onLatest++;
      else if (r.status.label === "Pending approval") counts.pending++;
      else if (r.status.label === "Behind")           counts.behind++;
      else if (r.status.label === "Unsubscribed")     counts.unsubscribed++;
    });
    return counts;
  }, [rows]);

  // Status filter — wired to KPI tiles. "any" | "onLatest" | "pending" | "behind" | "unsubscribed"
  const [statusKindFilter, setStatusKindFilter] = useStateS("any");

  const filtered = useMemoS(() => rows.filter(r => {
    if (versionFilter === "any") { /* keep */ }
    else if (versionFilter === "none") { if (r.version !== null) return false; }
    else { if (!r.version || r.version.id !== versionFilter) return false; }
    if (statusKindFilter !== "any") {
      const want = ({ onLatest: "Up to date", pending: "Pending approval",
                      behind: "Behind", unsubscribed: "Unsubscribed" })[statusKindFilter];
      if (r.status.label !== want) return false;
    }
    if (q && !`${r.iso.name} ${r.iso.region}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, versionFilter, statusKindFilter]);

  const subsPager = window.usePaginated(filtered, 10,
    `${app.id}|${q}|${versionFilter}|${statusKindFilter}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Invite-Subscribe entry — only shown when the app isn't already
          publicly browsable. Invite history lives in a card below the
          table so it's easy to find but doesn't crowd this view. */}
      {canInvite && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          background: "var(--color-bg-2)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-md)",
        }}>
          <window.Ico name="send" size={14} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5 }}>
            <b style={{ color: "var(--color-text-primary)" }}>Specified ISOs</b>
            <span style={{ color: "var(--color-text-tertiary)" }}>
              {" — "}other ISOs can subscribe only through a single-use 30-day invite link.
            </span>
          </div>
          <window.Button size="sm" primary icon="send" onClick={() => setInviteOpen(true)}>
            Invite Subscribe
          </window.Button>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <window.Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ISO name or region…"
          prefix={<window.Ico name="search" size={12} />}
          style={{ flex: 1, minWidth: 220, maxWidth: 360 }} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="overline" style={{ fontSize: 10 }}>Version</span>
          <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)} style={{
            padding: "6px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-default)", fontSize: 12,
            fontFamily: "inherit",
            background: "var(--color-bg-2)", color: "var(--color-text-primary)",
          }}>
            <option value="any">All versions</option>
            {publishedVersions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
            <option value="none">Unsubscribed</option>
          </select>
        </label>
      </div>

      <window.Card title="Subscribers" hint={`${isos.length} ISO companies`} padding={0}>
        <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              {[
                { label: "ISO company", align: "left" },
                { label: "Country / region", align: "left" },
                { label: "Current version", align: "left" },
                { label: "Reach", align: "right" },
                { label: "Subscribed", align: "left" },
                { label: "Status", align: "left" },
              ].map((h, i) => (
                <th key={i} style={{
                  padding: "8px 12px", fontSize: 11, fontWeight: 500,
                  color: "var(--color-text-tertiary)", textTransform: "uppercase",
                  letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)",
                  background: "var(--color-bg-3)", textAlign: h.align,
                  whiteSpace: "nowrap",
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subsPager.slice.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-tertiary)" }}>
                {rows.length === 0
                  ? "No ISOs have subscribed to this app yet."
                  : "No ISOs match the current filters."}
              </td></tr>
            )}
            {subsPager.slice.map((row, i) => {
              const { iso: c, status, version, subscribedAgo, terminalsReached, merchantsReached } = row;
              const isBehind = version && latestPublished && version.id !== latestPublished.id;
              return (
              <tr key={c.id} style={{ borderBottom: i < subsPager.slice.length - 1 ? "1px solid var(--color-border-subtle)" : "none" }}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5,
                      background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                      display: "grid", placeItems: "center",
                      fontSize: 10.5, fontWeight: 600 }}>
                      {c.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)" }}>{c.region}</td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  {version ? (
                    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 500,
                        color: isBehind ? "var(--color-warning-700)" : "var(--color-text-primary)" }}>
                        {version.name}
                      </span>
                      {isBehind && latestPublished && (
                        <span style={{ fontSize: 10.5, color: "var(--color-warning-700)" }}>
                          ↑ <span className="mono">{latestPublished.name}</span> available
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {version ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span className="mono num" style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {terminalsReached.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}>
                        {merchantsReached} merchant{merchantsReached === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {subscribedAgo}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <window.Pill tone={status.tone} dot size="sm">{status.label}</window.Pill>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <window.Pagination
          page={subsPager.page}
          pageSize={subsPager.pageSize}
          total={subsPager.total}
          onChange={subsPager.setPage}
          onPageSizeChange={subsPager.setPageSize}
        />
      </window.Card>

      {/* Invite history — own-app only, only shown when invites apply
          (i.e., the app isn't fully public). All invite URLs the
          publisher has generated for this app, with current status. */}
      {canInvite && (
        <window.InviteHistoryButton app={app} />
      )}

      {canInvite && (
        <window.InviteIsoModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          app={app}
          onCreated={(rec) => window.showToast?.(`Invite link created for ${rec.email}`, "success")} />
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────
// Consolidated tab — Basic info, Audience (public vs internal), Supported
// orientations, Compatibility (device models), and a Danger zone.
// Compatibility used to be a separate top-level tab; folded in here to keep
// navigation tight.
function AppSettings({ app }) {
  const tenant = window.useActiveTenant();
  const isPublished = app.status === "published";

  // Controlled form state. Mirrors `app` on mount and on app change, then
  // diverges as the user edits. The footer compares against `app` to detect
  // unsaved changes.
  const [name, setName]               = useStateS(app.name);
  const [category, setCategory]       = useStateS(app.category);
  const [description, setDescription] = useStateS(app.description);
  const [orientations, setOrientations] = useStateS(new Set(app.orientations || ["portrait"]));
  const [devices, setDevices]         = useStateS(new Set(app.devices));

  // Reset when navigating between apps without remounting the component.
  useEffectS(() => {
    setName(app.name);
    setCategory(app.category);
    setDescription(app.description);
    setOrientations(new Set(app.orientations || ["portrait"]));
    setDevices(new Set(app.devices));
  }, [app.id]);

  const toggleOrientation = (id) => {
    const next = new Set(orientations);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else next.add(id);
    setOrientations(next);
  };

  const toggleDevice = (id) => {
    const next = new Set(devices);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDevices(next);
  };

  // What changed since we mounted? Drives the sticky save bar.
  const setsEqual = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
  const metaChanged   = name !== app.name || category !== app.category || description !== app.description;
  const oriChanged    = !setsEqual(orientations, new Set(app.orientations || ["portrait"]));
  const devChanged    = !setsEqual(devices, new Set(app.devices));
  const dirty = metaChanged || oriChanged || devChanged;

  // Editing metadata no longer triggers Admin review — saves apply directly.
  // We still warn that public-pool listings update visible copy in the
  // marketplace, so subscribers see the new copy next render.
  const willReview = false;

  const onDiscard = () => {
    setName(app.name);
    setCategory(app.category);
    setDescription(app.description);
    setOrientations(new Set(app.orientations || ["portrait"]));
    setDevices(new Set(app.devices));
  };

  const onSave = () => {
    // In production this would persist. Demo: mutate window.APPS so the
    // header / overview reflect changes on next render, then toast.
    const target = (window.APPS || []).find(a => a.id === app.id);
    if (target) {
      target.name = name;
      target.category = category;
      target.description = description;
      target.orientations = [...orientations];
      target.devices = [...devices];
    }
    window.showToast?.(`"${name}" saved`, "success");
  };

  return (
    <div className="page-content page-content--narrow" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: dirty ? 76 : 0 }}>

      {/* Publish settings — mode (All ISOs / Specified ISOs) + lifecycle
          (Published / Unpublished) + activity timeline. Lives at the top
          of Settings so the publisher can manage both axes in one place. */}
      <PublishSettingsCard app={app} />

      {/* Public-pool visibility note — only relevant when the app is live. */}
      {isPublished && (
        <div style={{
          padding: "10px 14px",
          background: "var(--color-info-50)",
          border: "1px solid color-mix(in oklab, var(--color-info-500) 22%, transparent)",
          borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "flex-start", gap: 10,
          fontSize: 12, color: "var(--color-info-700)",
        }}>
          <window.Ico name="info" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            <b>Heads up.</b> This app is live in the public pool. Changes to <b>name</b>, <b>category</b>, <b>description</b> or screenshots become visible to ISO subscribers as soon as you save.
          </span>
        </div>
      )}

      <window.Card title="Basic information">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <window.Field label="App name" required>
            <window.Input value={name} onChange={(e) => setName(e.target.value)} />
          </window.Field>
          <window.Field label="Package name"
            hint={<span>Globally unique. Cannot be changed once an app has been published.</span>}>
            <window.Input value={app.package} mono disabled />
          </window.Field>
          <window.Field label="Category">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(window.CATEGORIES || []).map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: "5px 11px", borderRadius: 999, fontSize: 12,
                  background: category === c ? "var(--color-primary-50)" : "var(--color-bg-2)",
                  border: "1px solid",
                  borderColor: category === c ? "var(--color-primary-500)" : "var(--color-border-default)",
                  color: category === c ? "var(--color-primary-700)" : "var(--color-text-secondary)",
                  fontWeight: category === c ? 500 : 400,
                }}>{c}</button>
              ))}
            </div>
          </window.Field>
          <window.Field label="Description">
            <window.Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </window.Field>
        </div>
      </window.Card>

      <window.Card title="Supported orientations"
        hint="Declared at the app level. Screenshots are uploaded per orientation when you upload a version.">
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { id: "portrait",  label: "Portrait",  w: 30, h: 50 },
            { id: "landscape", label: "Landscape", w: 50, h: 30 },
          ].map(o => {
            const on = orientations.has(o.id);
            return (
              <button key={o.id} onClick={() => toggleOrientation(o.id)} style={{
                flex: 1, padding: "12px 14px", textAlign: "left",
                display: "flex", alignItems: "center", gap: 12,
                background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                border: "1px solid",
                borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
                borderRadius: 8,
                cursor: "pointer",
              }}>
                <div style={{ width: 60, height: 60, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: o.w, height: o.h, borderRadius: 3,
                    background: on ? "var(--color-primary-700)" : "var(--color-bg-3)",
                    border: "1px solid",
                    borderColor: on ? "transparent" : "var(--color-border-default)",
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {on ? "selected" : "tap to enable"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </window.Card>

      <window.Card title="Compatibility · device models"
        hint={`${devices.size} of ${window.DEVICE_MODELS.length} TOMS device models selected — ISOs can only deploy this app to terminals running one of these models.`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {window.DEVICE_MODELS.map(d => {
            const on = devices.has(d.id);
            return (
              <button key={d.id} onClick={() => toggleDevice(d.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px",
                background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                border: "1px solid",
                borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
                borderRadius: 7, textAlign: "left",
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: on ? "var(--color-primary-600)" : "transparent",
                  border: "1px solid",
                  borderColor: on ? "var(--color-primary-600)" : "var(--color-border-default)",
                  display: "grid", placeItems: "center",
                  color: "white", flexShrink: 0,
                }}>
                  {on && <window.Ico name="check" size={10} stroke={2.5} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{d.id}</div>
                  <div style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }} className="truncate">{d.blurb}</div>
                </div>
              </button>
            );
          })}
        </div>
      </window.Card>

      <window.Card title="Danger zone">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Archive this app</div>
            <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
              Existing installations keep working. New subscriptions are disabled.
            </div>
          </div>
          <window.Button danger>Archive</window.Button>
        </div>
      </window.Card>

      {/* Sticky save bar — only visible when there are unsaved changes. */}
      {dirty && (
        <div style={{
          position: "sticky", bottom: 0, zIndex: 5,
          margin: "0 -24px -28px",
          padding: "12px 24px",
          background: "var(--color-bg-2)",
          borderTop: "1px solid var(--color-border-subtle)",
          boxShadow: "0 -4px 12px oklch(0% 0 0 / 0.04)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, fontSize: 12, color: "var(--color-text-secondary)",
            display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-warning-500)" }} />
            <b style={{ color: "var(--color-text-primary)" }}>Unsaved changes</b>
          </div>
          <window.Button onClick={onDiscard}>Discard</window.Button>
          <window.Button primary icon="check" onClick={onSave}>Save changes</window.Button>
        </div>
      )}
    </div>
  );
}

// ─── Subscription settings (subscriber view) ───────────────
// Editable subscriber preferences for an ISO that has subscribed to an
// external publisher's app:
//   · Notify on new version (toggle)
//   · Notify recipients (named operators)
//   · Notify methods (in-app, email, slack)
// All edits are local-state-only in this prototype but write through to
// the underlying SUBSCRIBED_APPS record on Save so reloads in the same
// session reflect the change.
function SubscriptionSettings({ app, subscription, onUnsubscribe }) {
  const tenant = window.useActiveTenant();
  // Pull (or seed) notification preferences off the subscription record.
  const subRec = useMemoS(() => {
    const subs = (window.SUBSCRIBED_APPS || {})[tenant.id] || [];
    return subs.find(s => s.appId === app.id) || null;
  }, [tenant.id, app.id]);
  const stored = subRec?.notifyPrefs || subRec?.notify || {};
  const directory = (window.TENANT_EMPLOYEES || {})[tenant.id] || [];
  // Resolve stored.targets — could be legacy email-shaped records or
  // new id-shaped records. Map either form back to a directory entry.
  const resolveStoredTarget = (t) => {
    if (!t) return null;
    if (t.id) return directory.find(e => e.id === t.id) || null;
    if (t.email) return directory.find(e => e.email === t.email) || null;
    return null;
  };
  const seededTargets = Array.isArray(stored.targets) && stored.targets.length
    ? stored.targets.map(resolveStoredTarget).filter(Boolean)
    : directory.slice(0, 1); // default: first employee (current operator)
  const defaults = {
    notify: stored.notify !== false,
    methods: new Set(stored.methods instanceof Set ? stored.methods
              : (Array.isArray(stored.methods) ? stored.methods : ["inapp", "email"])),
    targets: seededTargets,
  };
  const [notify, setNotify] = useStateS(defaults.notify);
  const [methods, setMethods] = useStateS(defaults.methods);
  const [targets, setTargets] = useStateS(defaults.targets);
  const [pickerOpen, setPickerOpen] = useStateS(false);
  const [dirty, setDirty] = useStateS(false);

  const markDirty = () => setDirty(true);

  const toggleMethod = (k) => {
    const next = new Set(methods);
    next.has(k) ? next.delete(k) : next.add(k);
    setMethods(next);
    markDirty();
  };

  const addTarget = (employee) => {
    if (targets.some(t => t.id === employee.id)) return;
    setTargets([...targets, employee]);
    markDirty();
  };
  const removeTarget = (id) => {
    setTargets(targets.filter(t => t.id !== id));
    markDirty();
  };

  const handleSave = () => {
    if (subRec) {
      subRec.notifyPrefs = {
        notify,
        methods: [...methods],
        targets: targets.map(t => ({ id: t.id, name: t.name, email: t.email, role: t.role })),
      };
    }
    setDirty(false);
    window.showToast?.("Subscription settings saved", "success");
  };

  const handleReset = () => {
    setNotify(defaults.notify);
    setMethods(defaults.methods);
    setTargets(defaults.targets);
    setDirty(false);
  };

  return (
    <div className="page-content page-content--narrow" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: dirty ? 76 : 0 }}>
      <window.Card title="Update reminders"
        hint="Get notified when the publisher releases a new version of this app.">
        <ToggleRow
          label="Receive new-version notifications"
          desc="If off, no one in your organization is notified when a new version is published. Recipients and methods below are inactive until you turn this on."
          on={notify}
          onChange={(v) => { setNotify(v); markDirty(); }} />
      </window.Card>

      <div style={{
        display: "flex", flexDirection: "column", gap: 16,
        opacity: notify ? 1 : 0.5,
        pointerEvents: notify ? "auto" : "none",
        filter: notify ? "none" : "saturate(0.5)",
        transition: "opacity var(--duration-fast) var(--easing-standard), filter var(--duration-fast) var(--easing-standard)",
      }} aria-disabled={!notify}>

      <window.Card title="Notify recipients"
        hint="Pick employees from your organization. They receive update notifications via the methods below.">
        {targets.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--color-text-tertiary)", padding: "8px 0" }}>
            No recipients yet. Add at least one to enable notifications.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {targets.map(t => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-sm)",
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "var(--color-bg-2)", color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-subtle)",
                  display: "grid", placeItems: "center",
                  fontSize: 10.5, fontWeight: 600, flexShrink: 0,
                }}>{(t.name || t.email).slice(0, 1).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {t.name}
                    {t.role && (
                      <span style={{
                        marginLeft: 8, fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
                        background: "var(--color-bg-2)", color: "var(--color-text-tertiary)",
                        border: "1px solid var(--color-border-subtle)", fontWeight: 400,
                      }}>{t.role}</span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{t.email}</div>
                </div>
                <button onClick={() => removeTarget(t.id)} style={{
                  color: "var(--color-text-tertiary)", padding: 6, borderRadius: "var(--radius-sm)",
                }} title="Remove">
                  <window.Ico name="x" size={12} stroke={2.2} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <window.Button icon="plus" onClick={() => setPickerOpen(true)}
            disabled={targets.length >= directory.length}>
            Add recipient
          </window.Button>
          {targets.length >= directory.length && directory.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
              All employees in your organization are already on the list.
            </span>
          )}
        </div>
      </window.Card>

      <window.Card title="Notification methods"
        hint="Pick one or more channels. Notifications are sent to every recipient above.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { id: "inapp", icon: "bell",  label: "In-app",  body: "Bell icon in the top bar of TOMS." },
            { id: "email", icon: "email", label: "Email",   body: "Send to each recipient's email address." },
            { id: "slack", icon: "link",  label: "Slack",   body: "Post to your organization's connected workspace.", note: "Workspace not yet connected — configure in Settings." },
          ].map(m => {
            const on = methods.has(m.id);
            return (
              <button key={m.id} onClick={() => toggleMethod(m.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                border: "1px solid",
                borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
                borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: on ? "var(--color-primary-600)" : "transparent",
                  border: "1px solid", borderColor: on ? "var(--color-primary-600)" : "var(--color-border-default)",
                  display: "grid", placeItems: "center", color: "white", flexShrink: 0,
                }}>
                  {on && <window.Ico name="check" size={10} stroke={2.5} />}
                </div>
                <window.Ico name={m.icon} size={13}
                  style={{ color: on ? "var(--color-primary-700)" : "var(--color-text-tertiary)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{m.body}</div>
                </div>
                {m.note && (
                  <span style={{
                    fontSize: 10.5, padding: "2px 7px", borderRadius: 999,
                    background: "var(--color-warning-50)", color: "var(--color-warning-700)",
                    border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
                    whiteSpace: "nowrap",
                  }}>Not connected</span>
                )}
              </button>
            );
          })}
        </div>
      </window.Card>

      </div>
      {/* end of notify-conditional cluster */}

      <window.Card title="Subscription">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Unsubscribe to stop receiving updates from this publisher. You'll be asked whether to also uninstall the app from your merchants.
          </div>
          <window.Button danger icon="x" onClick={onUnsubscribe}>Unsubscribe</window.Button>
        </div>
      </window.Card>

      {dirty && (
        <div style={{
          position: "sticky", bottom: 0,
          margin: "0 -24px -24px",
          padding: "12px 24px",
          background: "var(--color-bg-2)",
          borderTop: "1px solid var(--color-border-subtle)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--color-text-secondary)" }}>
            You have unsaved changes.
          </span>
          <window.Button onClick={handleReset}>Discard</window.Button>
          <window.Button primary icon="check" onClick={handleSave}>Save changes</window.Button>
        </div>
      )}

      <EmployeePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        directory={directory}
        alreadyAdded={new Set(targets.map(t => t.id))}
        onPick={addTarget} />
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
        width: 34, height: 20, borderRadius: 999, padding: 2,
        background: on ? "var(--accent)" : "var(--color-bg-3)",
        border: "1px solid", borderColor: on ? "var(--accent)" : "var(--color-border-default)",
        display: "inline-flex", alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        transition: "all var(--duration-fast) var(--easing-standard)",
        cursor: "pointer", flexShrink: 0,
      }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff" }} />
      </button>
    </div>
  );
}

// ─── Employee picker modal ─────────────────────────────────
// Subscriber recipients are chosen from the active tenant's employee
// directory (TENANT_EMPLOYEES). Operators don't type free-form emails —
// internal directory only.
function EmployeePickerModal({ open, onClose, directory, alreadyAdded, onPick }) {
  const [q, setQ] = useStateS("");
  useEffectS(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;
  const available = directory.filter(e => !alreadyAdded.has(e.id));
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? available.filter(e => `${e.name} ${e.email} ${e.role}`.toLowerCase().includes(needle))
    : available;

  return (
    <window.Modal open onClose={onClose} width={520}
      title="Add notification recipient"
      subtitle="Pick an employee from your organization's directory."
      footer={<window.Button onClick={onClose}>Done</window.Button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <window.Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or role…"
          prefix={<window.Ico name="search" size={13} />} />
        {available.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12.5 }}>
            All employees in your organization are already on the list.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12.5 }}>
            No employees match "{q}".
          </div>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            maxHeight: 320, overflowY: "auto",
          }}>
            {filtered.map(e => (
              <button key={e.id} onClick={() => { onPick(e); onClose(); }} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: "var(--color-bg-2)", border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-sm)", textAlign: "left", cursor: "pointer",
              }}
              onMouseEnter={(el) => el.currentTarget.style.background = "var(--color-bg-hover)"}
              onMouseLeave={(el) => el.currentTarget.style.background = "var(--color-bg-2)"}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--color-bg-3)", color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-subtle)",
                  display: "grid", placeItems: "center",
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>{e.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {e.name}
                    <span style={{
                      marginLeft: 8, fontSize: 10.5, padding: "1px 6px", borderRadius: 999,
                      background: "var(--color-bg-3)", color: "var(--color-text-tertiary)",
                      border: "1px solid var(--color-border-subtle)", fontWeight: 400,
                    }}>{e.role}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{e.email}</div>
                </div>
                <window.Ico name="plus" size={13} style={{ color: "var(--color-text-tertiary)" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </window.Modal>
  );
}

// ─── Unsubscribe modal ─────────────────────────────────────
// Two-step destructive flow:
//   1. Pick a mode — "Keep merchant configs" (default) or "Uninstall now".
//   2. If "Uninstall now" is chosen, require a typed phrase before confirm.
// "Keep" removes the subscription record but leaves ROLLOUT_HISTORY alone
// so terminals already running the app keep doing so. "Uninstall" also
// clears every (tenant, app, *) entry in ROLLOUT_HISTORY so the
// Deployments tab reflects the wipe.
function UnsubscribeModal({ open, onClose, app, tenant, onDone }) {
  const [mode, setMode] = useStateS("keep"); // keep | uninstall
  const [typed, setTyped] = useStateS("");
  const [step, setStep] = useStateS("choose"); // choose | confirm
  useEffectS(() => {
    if (!open) { setMode("keep"); setTyped(""); setStep("choose"); }
  }, [open]);
  if (!open) return null;

  const merchants = window.merchantsConfiguredForApp
    ? window.merchantsConfiguredForApp(tenant.id, app.id) : [];

  const removeSubscription = () => {
    const subs = (window.SUBSCRIBED_APPS || {})[tenant.id] || [];
    const i = subs.findIndex(s => s.appId === app.id);
    if (i >= 0) subs.splice(i, 1);
  };

  const clearRollouts = () => {
    if (!window.ROLLOUT_HISTORY) return;
    Object.keys(window.ROLLOUT_HISTORY).forEach(k => {
      if (k.startsWith(`${tenant.id}:${app.id}:`)) {
        delete window.ROLLOUT_HISTORY[k];
      }
    });
  };

  const doKeep = () => {
    removeSubscription();
    window.showToast?.(`Unsubscribed from ${app.name} · existing merchant installs kept`, "warning");
    onDone && onDone();
  };

  const doUninstall = () => {
    removeSubscription();
    clearRollouts();
    window.showToast?.(`Unsubscribed from ${app.name} · app uninstalled from all merchants`, "danger");
    onDone && onDone();
  };

  if (step === "choose") {
    return (
      <window.Modal open onClose={onClose} width={620}
        title={<>Unsubscribe from <span style={{ fontWeight: 500 }}>{app.name}</span>?</>}
        subtitle="Your organization will stop receiving update notifications. Decide what happens to the app on your merchants."
        footer={
          <>
            <window.Button onClick={onClose}>Cancel</window.Button>
            {mode === "keep" ? (
              <window.Button danger icon="x" onClick={doKeep}>Unsubscribe</window.Button>
            ) : (
              <window.Button danger icon="trash" onClick={() => setStep("confirm")}>
                Continue → final confirmation
              </window.Button>
            )}
          </>
        }>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { id: "keep",
              icon: "shield",
              label: "Leave the app on my merchants (default)",
              body: <>Stop tracking new versions. Merchants currently running the app <b>keep their current version</b>; no further updates will be pulled.</>,
              tone: "neutral" },
            { id: "uninstall",
              icon: "trash",
              label: "Uninstall the app from all my merchants",
              body: <>Schedule an uninstall on every terminal running this app. <span style={{ color: "var(--color-error-700)", fontWeight: 500 }}>Destructive — requires a typed confirmation.</span></>,
              tone: "danger" },
          ].map(opt => {
            const on = mode === opt.id;
            return (
              <button key={opt.id} onClick={() => setMode(opt.id)} style={{
                padding: 14, textAlign: "left",
                background: on
                  ? (opt.tone === "danger" ? "var(--error-bg)" : "var(--color-primary-50)")
                  : "var(--color-bg-2)",
                border: "1px solid",
                borderColor: on
                  ? (opt.tone === "danger" ? "var(--color-error-500)" : "var(--color-primary-500)")
                  : "var(--color-border-default)",
                borderRadius: 8, cursor: "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "1.5px solid",
                    borderColor: on
                      ? (opt.tone === "danger" ? "var(--color-error-500)" : "var(--color-primary-600)")
                      : "var(--color-border-strong)",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
                    {on && <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: opt.tone === "danger" ? "var(--color-error-500)" : "var(--color-primary-600)",
                    }} />}
                  </div>
                  <window.Ico name={opt.icon} size={13}
                    style={{ color: opt.tone === "danger" ? "var(--color-error-700)" : "var(--color-text-tertiary)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  {opt.body}
                </div>
              </button>
            );
          })}
          {merchants.length > 0 && (
            <div style={{
              padding: "10px 12px",
              background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-md)",
              fontSize: 11.5, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 8,
            }}>
              <window.Ico name="info" size={12} />
              <span>
                <span className="mono num">{merchants.length}</span> merchant{merchants.length === 1 ? "" : "s"} currently have this app configured.
              </span>
            </div>
          )}
        </div>
      </window.Modal>
    );
  }

  // step === "confirm" — final destructive confirmation
  const canConfirm = typed.trim() === "UNINSTALL";
  return (
    <window.Modal open onClose={onClose} width={520}
      title={<>⚠️ Confirm uninstall</>}
      subtitle={<>This will remove <b>{app.name}</b> from every terminal running it across your fleet. Cannot be undone.</>}
      footer={
        <>
          <window.Button onClick={() => setStep("choose")}>← Back</window.Button>
          <window.Button danger icon="trash" disabled={!canConfirm} onClick={doUninstall}>
            Unsubscribe &amp; uninstall
          </window.Button>
        </>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          padding: "12px 14px",
          background: "var(--error-bg)",
          border: "1px solid color-mix(in oklab, var(--color-error-500) 25%, transparent)",
          borderRadius: "var(--radius-md)",
          fontSize: 12.5, color: "var(--color-error-700)", lineHeight: 1.55,
        }}>
          <b>Destructive action.</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>Every merchant configuration for this app will be deleted.</li>
            <li>Every terminal running this app will receive an uninstall command on next check-in.</li>
            <li>You'll need to resubscribe and re-rollout from scratch to use this app again.</li>
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
            Type <span className="mono" style={{ padding: "1px 6px", borderRadius: 4,
              background: "var(--color-bg-3)", color: "var(--color-text-primary)",
              fontWeight: 500 }}>UNINSTALL</span> to enable the button:
          </div>
          <window.Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="UNINSTALL"
            mono
            autoFocus />
        </div>
      </div>
    </window.Modal>
  );
}

// ─── Version detail screen ────────────────────────────────
// Catalog of Android permissions, ordered roughly by exposure.
// We deterministically slice this per-version using version.perms so the
// "View list" modal always shows a realistic, stable set.
const PERMISSIONS_CATALOG = [
  // Dangerous / runtime-prompted — highest scrutiny
  { id: "android.permission.READ_PHONE_STATE",    risk: "dangerous", purpose: "Read device identifiers (IMEI) for fraud detection" },
  { id: "android.permission.ACCESS_FINE_LOCATION",risk: "dangerous", purpose: "Tag transactions with terminal location" },
  { id: "android.permission.CAMERA",              risk: "dangerous", purpose: "Scan barcodes and QR codes at checkout" },
  { id: "android.permission.READ_EXTERNAL_STORAGE", risk: "dangerous", purpose: "Import logo / receipt template files" },
  { id: "android.permission.WRITE_EXTERNAL_STORAGE",risk: "dangerous", purpose: "Export receipts and EOD reports" },
  { id: "android.permission.READ_CONTACTS",       risk: "dangerous", purpose: "Look up customer records by phone" },
  { id: "android.permission.RECORD_AUDIO",        risk: "dangerous", purpose: "Capture customer-service call notes" },
  // Normal — granted at install, lower risk
  { id: "android.permission.INTERNET",            risk: "normal", purpose: "Communicate with the payment processor" },
  { id: "android.permission.ACCESS_NETWORK_STATE",risk: "normal", purpose: "Detect online / offline mode" },
  { id: "android.permission.ACCESS_WIFI_STATE",   risk: "normal", purpose: "Diagnose connectivity for support" },
  { id: "android.permission.WAKE_LOCK",           risk: "normal", purpose: "Keep the screen on during a transaction" },
  { id: "android.permission.VIBRATE",             risk: "normal", purpose: "Haptic feedback on tap-to-pay" },
  { id: "android.permission.FOREGROUND_SERVICE",  risk: "normal", purpose: "Run reconciliation jobs in foreground" },
  { id: "android.permission.POST_NOTIFICATIONS",  risk: "normal", purpose: "Surface payment confirmations" },
  { id: "android.permission.RECEIVE_BOOT_COMPLETED", risk: "normal", purpose: "Restart the POS service after reboot" },
  { id: "android.permission.BLUETOOTH",           risk: "normal", purpose: "Pair with PIN pads and printers" },
  { id: "android.permission.BLUETOOTH_CONNECT",   risk: "normal", purpose: "Bond with new BT peripherals (Android 12+)" },
  { id: "android.permission.NFC",                 risk: "normal", purpose: "Read contactless cards and tag-to-pay" },
  { id: "android.permission.USE_BIOMETRIC",       risk: "normal", purpose: "Manager unlock for refunds and voids" },
  { id: "com.android.vending.BILLING",            risk: "normal", purpose: "Validate Google Play subscriptions" },
  // TOMS-platform — only granted to signed system apps
  { id: "com.toms.permission.PRINT_RECEIPT",      risk: "signature", purpose: "Use the built-in thermal printer" },
  { id: "com.toms.permission.EMV_KERNEL",         risk: "signature", purpose: "Initiate EMV/chip-card transactions" },
  { id: "com.toms.permission.DEVICE_PROVISION",   risk: "signature", purpose: "Provision merchant credentials at first boot" },
];

function permissionsForVersion(version) {
  const n = Math.min(version.perms || 0, PERMISSIONS_CATALOG.length);
  if (n === 0) return [];
  // Stable hash from version.id so each version has a stable subset
  let seed = 0;
  for (const c of (version.id || version.code || "")) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff;
  const idxs = Array.from({ length: PERMISSIONS_CATALOG.length }, (_, i) => i);
  // Lightweight Fisher-Yates with seeded RNG
  let state = (seed >>> 0) || 1;
  const rnd = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) % 100000) / 100000; };
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  // Always pull in INTERNET as the first one; it's universal.
  const picked = new Set([PERMISSIONS_CATALOG.findIndex(p => p.id === "android.permission.INTERNET")]);
  for (const i of idxs) {
    if (picked.size >= n) break;
    picked.add(i);
  }
  return [...picked].slice(0, n).map(i => PERMISSIONS_CATALOG[i]);
}

const RISK_META = {
  dangerous: { label: "Dangerous", tone: "warning", desc: "Runtime-prompted — user must approve" },
  signature: { label: "Signature", tone: "info",    desc: "TOMS platform-signed only" },
  normal:    { label: "Normal",    tone: "neutral", desc: "Granted automatically at install" },
};

function PermissionsModal({ open, onClose, version, app }) {
  const [q, setQ] = useStateS("");
  const all = useMemoS(() => permissionsForVersion(version), [version]);
  const filtered = useMemoS(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(p =>
      p.id.toLowerCase().includes(needle) || p.purpose.toLowerCase().includes(needle));
  }, [q, all]);

  // Group by risk so reviewers can scan high-impact ones first
  const grouped = useMemoS(() => {
    const out = { dangerous: [], signature: [], normal: [] };
    filtered.forEach(p => out[p.risk].push(p));
    return out;
  }, [filtered]);

  const totals = useMemoS(() => {
    const out = { dangerous: 0, signature: 0, normal: 0 };
    all.forEach(p => out[p.risk]++);
    return out;
  }, [all]);

  if (!open) return null;
  return (
    <window.Modal open onClose={onClose} width={680}
      title={<>Permissions — <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{app.name} {version.name}</span></>}
      subtitle={`${all.length} permission${all.length !== 1 ? "s" : ""} declared in the APK manifest. Reviewers should focus on Dangerous and Signature scopes.`}
      padding={0}
      footer={
        <>
          <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>
            Pulled from <span className="mono">AndroidManifest.xml</span> at upload time
          </span>
          <div style={{ flex: 1 }} />
          <window.Button onClick={onClose}>Close</window.Button>
        </>
      }>
      {/* Risk summary strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        padding: "var(--space-4) var(--space-5) var(--space-3)",
        borderBottom: "1px solid var(--border-1)",
      }}>
        {["dangerous", "signature", "normal"].map(r => {
          const m = RISK_META[r];
          return (
            <div key={r} style={{
              padding: "10px 12px",
              background: "var(--bg2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <window.Pill tone={m.tone} dot size="sm">{m.label}</window.Pill>
                <span className="mono num" style={{
                  marginLeft: "auto", fontSize: 14, fontWeight: 600, color: "var(--fg1)",
                }}>{totals[r]}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--fg3)", lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: "var(--space-3) var(--space-5)", borderBottom: "1px solid var(--border-1)" }}>
        <window.Input
          size="sm"
          prefix={<window.Ico name="search" size={12} />}
          placeholder="Search permission name or purpose…"
          value={q}
          onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Grouped list */}
      <div style={{ maxHeight: 440, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 12.5, color: "var(--fg3)" }}>
            No permissions match "{q}".
          </div>
        ) : (
          ["dangerous", "signature", "normal"].map(r => {
            const items = grouped[r];
            if (items.length === 0) return null;
            const m = RISK_META[r];
            return (
              <section key={r}>
                <header style={{
                  position: "sticky", top: 0, zIndex: 1,
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px var(--space-5)",
                  background: "var(--bg3)",
                  borderBottom: "1px solid var(--border-1)",
                  fontSize: 11,
                }}>
                  <window.Pill tone={m.tone} dot size="sm">{m.label}</window.Pill>
                  <span style={{ color: "var(--fg3)" }}>{items.length}</span>
                </header>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {items.map(p => (
                    <li key={p.id} style={{
                      padding: "10px var(--space-5)",
                      borderBottom: "1px solid var(--border-1)",
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: "2px 12px",
                    }}>
                      <span className="mono" style={{
                        fontSize: 12, color: "var(--fg1)", fontWeight: 500,
                        gridColumn: 1, wordBreak: "break-all",
                      }}>{p.id}</span>
                      <button title="Copy"
                        style={{ color: "var(--fg3)", padding: 2, gridColumn: 2, alignSelf: "start" }}>
                        <window.Ico name="copy" size={12} />
                      </button>
                      <span style={{
                        fontSize: 12, color: "var(--fg3)", lineHeight: 1.4,
                        gridColumn: "1 / -1",
                      }}>{p.purpose}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </window.Modal>
  );
}

// Dropdown menu item used inside the VersionDetailScreen "More" menu.
// `tone="danger"` recolors the icon + label; `emphasized` adds a faint
// red wash so destructive actions still stand out inside the menu.
function MenuItem({ icon, label, hint, tone, emphasized, onClick }) {
  const danger = tone === "danger";
  const [hover, setHover] = React.useState(false);
  const fg = danger ? "var(--color-error-700)" : "var(--color-text-primary)";
  return (
    <button role="menuitem" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "8px 10px", borderRadius: "var(--radius-sm)",
        background: hover
          ? (emphasized ? "var(--color-error-50)" : "var(--color-bg-3)")
          : (emphasized ? "color-mix(in oklab, var(--color-error-500) 5%, transparent)" : "transparent"),
        textAlign: "left", cursor: "pointer", width: "100%",
        border: "none",
      }}>
      <window.Ico name={icon} size={14}
        style={{ color: fg, flexShrink: 0, marginTop: 2 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: fg }}>{label}</span>
        {hint && <span style={{ display: "block", marginTop: 2, fontSize: 11,
          color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{hint}</span>}
      </span>
    </button>
  );
}

function VersionDetailScreen({ app, version, navigate, route }) {
  const tenant = window.useActiveTenant();
  const isOwnApp = app.publisherTenantId === tenant.id;
  const [unpublishOpen, setUnpublishOpen] = useStateS(false);
  const [rollbackOpen, setRollbackOpen] = useStateS(false);
  const [moreOpen, setMoreOpen] = useStateS(false);
  const subscriptionRaw = ((window.SUBSCRIBED_APPS || {})[tenant.id] || []).find(s => s.appId === app.id);
  // Only the version the active tenant has currently pulled is eligible for
  // a Roll out shortcut from this page — older snapshots can't be rolled out
  // directly (you'd have to re-pull or use the Versions tab).
  const isCurrentSnapshot = !!subscriptionRaw && subscriptionRaw.subscribedVersionId === version.id;

  // Subscriber-only: merchants that have already been rolled this exact
  // version. We cross-reference ROLLOUT_HISTORY against the tenant's fleet to
  // recover full merchant records (name / region / terminal count).
  const fleet = !isOwnApp ? (window.MERCHANT_FLEETS[tenant.id] || []) : [];
  const onThisVersionIds = !isOwnApp ? window.merchantsAlreadyOnVersion(tenant.id, app.id, version.id) : new Set();
  const merchantsOnVersion = fleet.filter(m => onThisVersionIds.has(m.id));
  const totalConfigured = !isOwnApp ? window.merchantsConfiguredForApp(tenant.id, app.id).length : 0;
  const showRolloutShortcut = !isOwnApp && isCurrentSnapshot && version.status === "published";

  const findings = version.scan ? window.SCAN_FINDINGS_TEMPLATES[version.scan] : null;
  const counts = findings ? window.summariseFindings(findings) : null;
  const [permsOpen, setPermsOpen] = useStateS(false);
  const [findingsOpen, setFindingsOpen] = useStateS(false);
  const [shotsOpen, setShotsOpen] = useStateS(false);  // lazy-render Screenshots card
  const totalFindings = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const vst = window.VERSION_STATUS[version.status] || window.APP_STATUS[version.status];
  // Resolve effective visibility. Versions uploaded through the new wizard
  // carry an explicit `visibility` field. Legacy seed versions don't —
  // Versions inherit publish mode from the parent app — no version-level
  // visibility pill in the header (publish mode is shown on App Detail).

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--color-bg-2)", borderBottom: "1px solid var(--color-border-subtle)",
        padding: "14px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate({ screen: "appDetail", appId: app.id, tab: "versions", from: route?.from || (isOwnApp ? "appPublish" : "appStore") })}
            style={{ color: "var(--color-text-tertiary)" }}>
            <window.Ico name="chevl" size={16} />
          </button>
          <window.AppIcon app={app} version={version} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{app.name}</span>
              <window.Ico name="chevr" size={11} style={{ color: "var(--color-text-tertiary)" }} />
              <h1 className="mono" style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{version.name}</h1>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>· code {version.code}</span>
              <window.Pill tone={vst.tone} dot size="lg">{vst.label}</window.Pill>
              {version.current && <window.Pill tone="accent" size="lg">Current</window.Pill>}
            </div>
            <div className="mono" style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{app.package}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Push-to-ISO shortcut moved to the App detail page (Invite
                Subscribe button + Invite history card). Version-level
                invites are no longer a thing. Rollouts are managed from
                the App detail's Deployments tab — no shortcut here. */}
            {version.status === "unpublished" && (
              <window.Button icon="refresh"
                onClick={() => {
                  // Mutate version status back to published.
                  const tApp = (window.APPS || []).find(a => a.id === app.id);
                  const tVer = tApp?.versions.find(v => v.id === version.id);
                  if (tVer) {
                    tVer.status = "published";
                    tVer.publishedAt = "just now";
                    delete tVer.unpublishedAt;
                  }
                  if (tApp) {
                    tApp.reviewActivity = [...(tApp.reviewActivity || []), {
                      kind: "republished", at: "just now", actor: "You",
                      note: `${version.name} re-published.`,
                    }];
                  }
                  window.showToast?.(`${version.name} re-published`, "success");
                }}>
                Re-publish
              </window.Button>
            )}
            {version.status === "draft" && (
              <window.Button primary icon="bolt"
                onClick={() => {
                  const tApp = (window.APPS || []).find(a => a.id === app.id);
                  const tVer = tApp?.versions.find(v => v.id === version.id);
                  if (tVer) {
                    tVer.status = "published";
                    tVer.publishedAt = "just now";
                  }
                  if (tApp) {
                    tApp.reviewActivity = [...(tApp.reviewActivity || []), {
                      kind: "version-uploaded", at: "just now", actor: "You",
                      note: `${version.name} published.`,
                    }];
                  }
                  window.showToast?.(`${version.name} published`, "success");
                }}>
                Publish now
              </window.Button>
            )}
            <div style={{ position: "relative" }}>
              <window.Button icon="more" onClick={() => setMoreOpen(o => !o)}
                aria-expanded={moreOpen} aria-haspopup="menu">
                More
              </window.Button>
              {moreOpen && (
                <>
                  {/* Click-away backdrop */}
                  <div onClick={() => setMoreOpen(false)} style={{
                    position: "fixed", inset: 0, zIndex: 40,
                  }} />
                  <div role="menu" style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    minWidth: 240, zIndex: 41,
                    background: "var(--color-bg-2)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-2, 0 8px 24px oklch(0% 0 0 / 0.10))",
                    padding: 4,
                    display: "flex", flexDirection: "column",
                  }}>
                    <MenuItem icon="download"
                      label="Download APK"
                      hint={`${version.size || "—"} · signed build`}
                      onClick={() => {
                        setMoreOpen(false);
                        window.showToast?.(`Downloading ${app.name} ${version.name}…`, "success");
                      }} />
                    {version.status === "published" && (
                      <>
                        <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "4px 0" }} />
                        <MenuItem icon="alert" tone="danger"
                          label={window.__takedownTerm === "remove" ? "Remove from pool" : "Unpublish"}
                          hint="Take off the public pool · existing devices keep running"
                          onClick={() => { setMoreOpen(false); setUnpublishOpen(true); }} />
                        <MenuItem icon="alert" tone="danger" emphasized
                          label="Roll back…"
                          hint="Force devices off this version · destructive"
                          onClick={() => { setMoreOpen(false); setRollbackOpen(true); }} />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 28px", background: "var(--color-bg-1)" }}>
        <div className="page-content" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Metadata */}
            <window.Card title="Build metadata">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 14, columnGap: 36 }}>
                <window.KV label="Version name"  value={<span className="mono">{version.name}</span>} />
                <window.KV label="Version code"  value={<span className="mono">{version.code}</span>} />
                <window.KV label="APK size"      value={version.size} />
                <window.KV label="Min Android"
                  value={<>{androidVersionName(version.minSdk)}{" "}
                    <span className="mono" style={{ color: "var(--color-text-tertiary)" }}>· API {version.minSdk}</span>
                  </>} />
                <window.KV label="Target Android"
                  value={<>{androidVersionName(version.targetSdk)}{" "}
                    <span className="mono" style={{ color: "var(--color-text-tertiary)" }}>· API {version.targetSdk}</span>
                  </>} />
                <window.KV label="Permissions"
                  value={
                    <button onClick={() => setPermsOpen(true)} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 13, color: "var(--accent)", fontWeight: 500,
                      textDecoration: "underline", textUnderlineOffset: 2,
                      textDecorationStyle: "dotted",
                      textDecorationColor: "var(--border-2)",
                    }}>
                      <span className="mono num">{version.perms}</span> declared
                      <window.Ico name="external" size={11} stroke={1.7} />
                    </button>
                  } />
                <window.KV label="Uploaded"      value={`${version.uploadedAt} · by M. Hassan`} />
                <window.KV label="Published"     value={version.publishedAt || <span style={{ color: "var(--color-text-tertiary)" }}>—</span>} />
                <window.KV label="Signing cert"  value={<span className="mono" style={{ fontSize: 11 }}>{version.signer || "Acme Software Inc. · SHA-256 d4:e2:8a:…"}</span>} mono copy />
              </div>
            </window.Card>

            {/* Vulnerability scan — only shown once the asynchronous scan has completed.
                Defaults to a compact summary (counts grid + severity bar); the full
                findings list is one button away via FindingsModal to keep this card
                glanceable. */}
            {counts && (
              <window.Card title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <window.Ico name="shieldCheck" size={14} /> Vulnerability scan
                </span>
              }
                hint={`Last run · ${version.uploadedAt}`}
                action={totalFindings > 0 && (
                  <window.Button size="sm" iconRight="arrowR" onClick={() => setFindingsOpen(true)}>
                    View {totalFindings} finding{totalFindings === 1 ? "" : "s"}
                  </window.Button>
                )}>
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
                    {Object.entries(counts).map(([k, v]) => (
                      <div key={k} style={{
                        padding: "10px 12px", borderRadius: 7,
                        background: v > 0 ? "var(--color-bg-2)" : "var(--color-bg-3)",
                        border: "1px solid",
                        borderColor: v > 0 && (k === "critical" || k === "high") ? "var(--color-error-500)" : "var(--color-border-subtle)",
                        borderLeftWidth: 3,
                        borderLeftColor: window.SEVERITY[k].color,
                      }}>
                        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em",
                          fontWeight: 500, color: "var(--color-text-tertiary)" }}>{window.SEVERITY[k].label}</div>
                        <div className="mono" style={{ fontSize: 22, fontWeight: 500, marginTop: 2,
                          color: v > 0 ? window.SEVERITY[k].color : "var(--color-text-tertiary)" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <window.SeverityBar counts={counts} height={6} />
                  {totalFindings === 0 && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-success-700)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <window.Ico name="check" size={12} /> Scan completed with no findings.
                    </div>
                  )}
                </>
              </window.Card>
            )}

            {/* Release notes */}
            <window.Card title="Release notes">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--color-text-secondary)" }}>{version.notes}</p>
            </window.Card>

            {/* Screenshots — captured from this version's APK. Deferred
                behind a click so the version detail loads without
                rendering 4 procedural phone screenshots up-front. */}
            <window.Card title="Screenshots" hint="bundled with this APK"
              action={shotsOpen && (
                <window.Button size="sm" ghost icon="x" onClick={() => setShotsOpen(false)}>Hide</window.Button>
              )}>
              {shotsOpen ? (
                <window.Screenshots app={app} version={version} count={4} size="md" />
              ) : (
                <button onClick={() => setShotsOpen(true)} style={{
                  width: "100%",
                  padding: "20px 14px",
                  border: "1px dashed var(--color-border-default)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-3)",
                  display: "flex", alignItems: "center", gap: 12,
                  textAlign: "left", cursor: "pointer",
                  transition: "background var(--duration-fast) var(--easing-standard)",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-bg-2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-bg-3)"}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "var(--color-bg-2)",
                    border: "1px solid var(--color-border-subtle)",
                    display: "grid", placeItems: "center",
                    color: "var(--color-text-tertiary)", flexShrink: 0,
                  }}>
                    <window.Ico name="image" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      Show 4 screenshots
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                      Deferred to keep the page snappy — click to load.
                    </div>
                  </div>
                  <window.Ico name="chevr" size={13} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
                </button>
              )}
            </window.Card>

            {/* Per-version subscriber list has been removed — subscription
                is an app-level relationship, not a version-level one. */}

            {/* Invite-mode shortcuts now live on the App detail page. */}
            {false && (
              <window.InviteHistoryCard
                app={app}
                navigate={navigate} />
            )}
            {false && (
            <window.Card title={`Subscribers · ${isos.length}`}
              hint={`${isos.length} of ${version.reach || isos.length} in scope`}
              padding={0}>
              {null}
            </window.Card>
            )}
          </div>

          {/* Right rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Subscriber-only: thin pointer card that surfaces *how many*
                merchants are on this version and deep-links to the
                Deployments tab pre-filtered to it. The full merchant list
                with status / search / pagination lives in Deployments — the
                unified drill-down for "app → version → merchants → state".
                We deliberately keep this card minimal (single count + link)
                so it scales to fleets of thousands without breaking the
                right-rail layout. */}
            {!isOwnApp && (
              <button
                onClick={() => navigate({ screen: "appDetail", appId: app.id, tab: "deployments", filterVersionId: version.id, from: route?.from || "appStore" })}
                className="tds-card"
                style={{
                  boxShadow: "var(--shadow-1)",
                  borderRadius: "var(--radius-lg)",
                  textAlign: "left",
                  padding: 0,
                  width: "100%",
                  cursor: "pointer",
                  transition: "background 120ms ease, border-color 120ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
                <div className="tds-card__header" style={{ padding: "var(--space-3) var(--space-5)" }}>
                  <h3 className="tds-card__title" style={{ fontSize: 13 }}>Fleet deployment</h3>
                </div>
                <div style={{ padding: "var(--space-4) var(--space-5) var(--space-5)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="mono num" style={{
                      fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em",
                      color: "var(--color-text-primary)",
                    }}>{merchantsOnVersion.length}</span>
                    <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                      / {totalConfigured} merchants
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-tertiary)" }}>
                    on this version
                  </div>
                  <div style={{
                    marginTop: 14,
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12, color: "var(--accent)", fontWeight: 500,
                  }}>
                    View deployment details
                    <window.Ico name="chevr" size={12} />
                  </div>
                </div>
              </button>
            )}

            <window.Card title="Timeline" padding={0}>
              {[
                { icon: "upload",      t: "APK uploaded",        time: version.uploadedAt, user: "M. Hassan" },
                counts && { icon: "shieldCheck", t: `Scan completed · ${totalFindings} findings`, time: version.uploadedAt },
                version.publishedAt && { icon: "bolt",     t: "Published to app pool", time: version.publishedAt },
                version.publishedAt && { icon: "check",    t: `${version.reach || 0} ISO ${(version.reach || 0) === 1 ? "company" : "companies"} subscribed to this version`, time: "today" },
              ].filter(Boolean).map((a, i, arr) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5,
                    background: "var(--color-bg-3)", color: "var(--color-text-secondary)",
                    display: "grid", placeItems: "center", flexShrink: 0,
                    border: "1px solid var(--color-border-subtle)" }}>
                    <window.Ico name={a.icon} size={11} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 450 }}>{a.t}</div>
                    <div style={{ fontSize: 10.5, color: "var(--color-text-tertiary)", marginTop: 1 }}>
                      <span className="mono">{a.time}</span>{a.user && <span> · {a.user}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </window.Card>
          </div>
        </div>
      </div>
      <PermissionsModal
        open={permsOpen}
        onClose={() => setPermsOpen(false)}
        app={app}
        version={version} />
      <FindingsModal
        open={findingsOpen}
        onClose={() => setFindingsOpen(false)}
        app={app}
        version={version}
        findings={findings}
        counts={counts} />
      <window.ConfirmDialog
        open={unpublishOpen}
        onClose={() => setUnpublishOpen(false)}
        title={`Unpublish ${version.name}?`}
        body={
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              padding: "10px 12px",
              background: "var(--warning-bg)",
              border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
              borderRadius: "var(--radius-md)",
              fontSize: 12, color: "var(--color-warning-700)",
              lineHeight: 1.55,
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <window.Ico name="email" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Subscribed ISO companies will receive an <b>email notification</b> that this version has been delisted and can no longer be pushed to new devices.</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
              <li>The version is taken off the public app pool.</li>
              <li>Subscribed ISO companies <b>can't push this version to any new device</b> from the moment you unpublish.</li>
              <li>Devices already running this version are <b>not affected</b> — for that, use <b>Roll back</b>.</li>
              <li>Other versions of this app remain available for subscribers.</li>
            </ul>
          </div>
        }
        confirmLabel={window.__takedownTerm === "remove" ? "Remove from pool" : "Unpublish version"}
        tone="danger"
        icon="alert"
        onConfirm={() => {
          setUnpublishOpen(false);
          // Mutate in-memory state so the UI reflects the new version status.
          const targetApp = (window.APPS || []).find(a => a.id === app.id);
          const targetVersion = targetApp?.versions.find(v => v.id === version.id);
          if (targetVersion) {
            targetVersion.status = "unpublished";
            targetVersion.unpublishedAt = "just now";
          }
          if (targetApp) {
            targetApp.reviewActivity = [...(targetApp.reviewActivity || []), {
              kind: "unpublished", at: "just now", actor: "You",
              note: `Version ${version.name} unpublished — subscribers notified by email.`,
            }];
          }
          window.showToast?.(`${version.name} unpublished · subscribers notified by email`, "warning");
        }} />
      <window.ConfirmDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        title={`⚠️ Roll back ${version.name}?`}
        body={
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              padding: "10px 12px",
              background: "var(--error-bg)",
              border: "1px solid color-mix(in oklab, var(--color-error-500) 25%, transparent)",
              borderRadius: "var(--radius-md)",
              fontSize: 12.5, lineHeight: 1.55, color: "var(--color-error-700)",
            }}>
              <b>Destructive action.</b> Rolling back will:
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>Send an <b>urgent email</b> to every subscribed ISO flagging the version as risky and recommending immediate uninstall on all terminals.</li>
                <li>Each ISO decides for themselves: uninstall now, or accept the risk and keep the version running. ISVs can't force-uninstall.</li>
                <li>Mark {version.name} as <b>rolled back</b> — it can never be pushed to new devices again, even for ISOs that haven't subscribed yet.</li>
                <li>Cannot be undone.</li>
              </ul>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
              Use this only when a critical defect makes the version unsafe to keep running. For routine take-downs (no emergency alert, no permanent block), use <b>Unpublish</b> instead.
            </div>
          </div>
        }
        confirmLabel="Roll back version"
        tone="danger"
        icon="alert"
        requireText="ROLLBACK"
        hint="Type the phrase to enable confirmation."
        onConfirm={() => {
          setRollbackOpen(false);
          // Mutate the version status. Pull wizard reads this flag to
          // exclude rolled-back versions from the candidate list.
          const target = (window.APPS || []).find(a => a.id === app.id);
          const targetVersion = target?.versions.find(v => v.id === version.id);
          if (targetVersion) {
            targetVersion.status = "rollback";
            targetVersion.rolledBackAt = "just now";
          }
          if (target) {
            target.reviewActivity = [...(target.reviewActivity || []), {
              kind: "rollback", at: "just now", actor: "You",
              note: `${version.name} rolled back — emergency email sent to subscribers.`,
            }];
          }

          // ─── Cache-side cleanup ──────────────────────────
          // Pick a fallback version: the highest non-rolled-back published
          // version below the rolled-back one. Everything on the rolled-back
          // version is migrated to that fallback so the front-end caches
          // (merchant.apps, MERCHANT_APP_UPGRADE_STRATEGY, ROLLOUT_HISTORY)
          // stay coherent.
          const fallback = (target?.versions || [])
            .filter(v => v.id !== version.id
                      && v.status !== "rollback"
                      && (v.code || 0) < (version.code || 0))
            .sort((a, b) => (b.code || 0) - (a.code || 0))[0];

          let mrchAffected = 0;
          if (fallback) {
            const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

            // (a) Revert merchant.apps entries that pointed at the bad version
            (window.MERCHANTS || []).forEach(m => {
              (m.apps || []).forEach(a => {
                if (a.packageId !== app.id) return;
                const tv = a.targetVersionId || a.versionId;
                if (tv !== version.id) return;
                a.versionId       = fallback.id;
                a.targetVersionId = fallback.id;
                a.assignedAt      = today;
                a.flag = null;
                mrchAffected++;
              });
            });

            // (b) Migrate every strategy record from the rolled-back version
            // to the fallback. Strategies are keyed `${mrchId}:${pkg}:${vid}`,
            // so we touch every merchant that had one for this version.
            const store = window.MERCHANT_APP_UPGRADE_STRATEGY || {};
            const suffix = `:${app.package}:${version.id}`;
            Object.keys(store).forEach(k => {
              if (!k.endsWith(suffix)) return;
              const rec = store[k];
              const mrchId = rec.mrchId;
              window.setMerchantStrategy?.(mrchId, app.package, fallback.id, rec);
              window.deleteMerchantStrategy?.(mrchId, app.package, version.id);
            });

            // (c) Migrate ROLLOUT_HISTORY entries: move every merchant in
            // each `<tenant>:<app>:<rolled-back>` set into the corresponding
            // `<tenant>:<app>:<fallback>` set.
            const history = window.ROLLOUT_HISTORY || {};
            Object.keys(history).forEach(k => {
              if (!k.endsWith(`:${app.id}:${version.id}`)) return;
              const [tenantId] = k.split(":");
              const fbKey = `${tenantId}:${app.id}:${fallback.id}`;
              if (!history[fbKey]) history[fbKey] = new Set();
              history[k].forEach(mid => history[fbKey].add(mid));
              delete history[k];
            });

            window.bumpMerchants?.();
          }

          if (fallback && mrchAffected > 0) {
            window.showToast?.(
              `⚠️ ${version.name} rolled back · ${mrchAffected} merchant${mrchAffected === 1 ? "" : "s"} reverted to ${fallback.name}`,
              "warning"
            );
          } else {
            window.showToast?.(
              `⚠️ ${version.name} rolled back · emergency email sent to subscribers`,
              "warning"
            );
          }
        }} />
    </div>
  );
}

function FindingRow({ f }) {
  const [open, setOpen] = useStateS(false);
  const sev = window.SEVERITY[f.sev];
  return (
    <div style={{
      border: "1px solid var(--color-border-subtle)",
      borderRadius: 7,
      borderLeft: "3px solid", borderLeftColor: sev.color,
      background: "var(--color-bg-2)",
      overflow: "hidden",
    }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", width: "100%", textAlign: "left",
      }}>
        <window.Pill tone={sev.tone} size="sm">{sev.label}</window.Pill>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.title}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}>
            {f.cve ? <span>{f.cve} · </span> : null}{f.pkg}
          </div>
        </div>
        <window.Ico name={open ? "chevu" : "chevd"} size={13} style={{ color: "var(--color-text-tertiary)" }} />
      </button>
      {open && (
        <div style={{
          padding: "10px 14px 12px 14px",
          background: "var(--color-bg-3)",
          borderTop: "1px solid var(--color-border-subtle)",
          fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55,
        }}>
          <div style={{ marginBottom: 8 }}>{f.desc}</div>
          <div style={{ display: "flex", gap: 18, fontSize: 11.5 }}>
            <div><span style={{ color: "var(--color-text-tertiary)" }}>Detected in:</span> <span className="mono">{f.version}</span></div>
            <div><span style={{ color: "var(--color-text-tertiary)" }}>Recommendation:</span> <span className="mono">{f.fix}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Vulnerability findings modal ──────────────────
// Mounted by any surface that wants to defer the full findings list behind
// a button. Keeps the host page minimal (counts + severity bar) and lets the
// operator drill in only when they actually want to investigate.
function FindingsModal({ open, onClose, app, version, findings, counts }) {
  if (!open) return null;
  const list = findings || [];
  const total = list.length;
  return (
    <window.Modal open onClose={onClose} width={680}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <window.Ico name="shieldCheck" size={14} />
          Vulnerability findings
          {app && version && (
            <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>
              — <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>{app.name} {version.name}</span>
            </span>
          )}
        </span>
      }
      subtitle={total === 0
        ? "Scan completed with no findings."
        : `${total} finding${total === 1 ? "" : "s"} from the latest scan run.`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {counts && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {Object.entries(counts).map(([k, v]) => (
                <div key={k} style={{
                  padding: "8px 10px", borderRadius: 6,
                  background: v > 0 ? "var(--color-bg-2)" : "var(--color-bg-3)",
                  border: "1px solid",
                  borderColor: v > 0 && (k === "critical" || k === "high") ? "var(--color-error-500)" : "var(--color-border-subtle)",
                  borderLeftWidth: 3,
                  borderLeftColor: window.SEVERITY[k].color,
                }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                    fontWeight: 500, color: "var(--color-text-tertiary)" }}>{window.SEVERITY[k].label}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 500, marginTop: 1,
                    color: v > 0 ? window.SEVERITY[k].color : "var(--color-text-tertiary)" }}>{v}</div>
                </div>
              ))}
            </div>
            <window.SeverityBar counts={counts} height={6} />
          </>
        )}
        {total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {list.map((f, i) => (
              <FindingRow key={i} f={f} />
            ))}
          </div>
        )}
      </div>
    </window.Modal>
  );
}

// ─── StrategyCell · in-row display of (merchant, app, version) strategy ──
// Display-only — per PRD only Target Version is editable in the table.
// Rendered as a coloured pill so different urgency levels are scannable:
//   Casual    — neutral green (no urgency)
//   Immediate — red (urgent, install ASAP)
//   Custom    — blue (operator-tuned, neither)
//   Not set   — muted gray (no record yet)
function StrategyCell({ record, disabled, onClick, title }) {
  const STRAT_LABEL = { casual: "Casual", immediate: "Immediate", custom: "Custom" };
  const preset = record ? window.resolveStrategyPreset(record) : null;
  const label  = preset ? (STRAT_LABEL[preset] || preset) : "Not set";

  // Tone matrix — bg / fg / border for each variant.
  const tones = {
    casual: {
      bg:     "oklch(96% 0.06 152)",
      fg:     "oklch(35% 0.12 152)",
      border: "oklch(58% 0.14 152 / 0.35)",
      dot:    "oklch(58% 0.14 152)",
    },
    immediate: {
      bg:     "oklch(96% 0.06 25)",
      fg:     "oklch(42% 0.18 25)",
      border: "oklch(58% 0.20 25 / 0.35)",
      dot:    "oklch(58% 0.20 25)",
    },
    custom: {
      bg:     "oklch(96% 0.05 262)",
      fg:     "oklch(40% 0.14 262)",
      border: "oklch(60% 0.14 262 / 0.35)",
      dot:    "oklch(56% 0.16 262)",
    },
    unset: {
      bg:     "transparent",
      fg:     "var(--fg3)",
      border: "var(--border-2)",
      dot:    "var(--fg3)",
    },
  };
  const t = tones[preset || "unset"];

  const interactive = !!onClick && !disabled;
  const pill = (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 9px",
      background: t.bg,
      color: t.fg,
      border: "1px solid",
      borderColor: t.border,
      borderRadius: 999,
      fontSize: 11.5, fontWeight: 600,
      letterSpacing: "0.02em",
      lineHeight: 1.4,
      whiteSpace: "nowrap",
      opacity: disabled ? 0.55 : 1,
      textDecoration: disabled ? "line-through" : "none",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: t.dot, flexShrink: 0,
      }} />
      {label}
      {interactive && (
        <window.Ico name="chevdown" size={10} style={{ marginRight: -2, opacity: 0.7 }} />
      )}
    </span>
  );

  if (!interactive) return pill;

  return (
    <button
      type="button"
      title={title || "Edit upgrade strategy"}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{
        padding: 0, border: 0, background: "transparent",
        cursor: "pointer", borderRadius: 999,
        transition: "transform 80ms",
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}>
      {pill}
    </button>
  );
}

// ─── ExpandedTerminals · pending-first view for the deployment row ──
// Per PRD revision: the operator's primary question is "how many terminals
// HAVEN'T upgraded yet, and HOW will they get there?". Show that prominently
// with the inherited strategy and a per-terminal drill-in to the upgrade-event
// log. The already-upgraded set is collapsed by default — just a count + the
// option to expand the list.
//
// Strategy is read-only here. To change it, edit the row's target version and
// apply a new strategy via the 2-step Rollout modal on save.
function ExpandedTerminals({ merchant, app, target, termStatuses, strategyRecord, onTerminalOpen }) {
  // Split terminals by target-version status
  const onTarget   = termStatuses.filter(x => x.st.status === "installed");
  const offTarget  = termStatuses.filter(x => x.st.status !== "installed");
  const total      = termStatuses.length;

  // Behind-group sub-breakdown
  const awaitingCount = offTarget.filter(x => x.st.status === "awaiting").length;
  const inflightCount = offTarget.filter(x => x.st.status === "downloading" || x.st.status === "downloaded").length;
  const failedCount   = offTarget.filter(x => x.st.tone === "error").length;

  // Order pending terminals failed → in-flight → awaiting so the operator
  // sees the rows that need their attention first.
  const orderKey = (status) =>
    status === "install-failed" || status === "download-failed" ? 0 :
    status === "downloading" || status === "downloaded"          ? 1 :
                                                                   2;
  const pendingSorted = [...offTarget].sort((a, b) => orderKey(a.st.status) - orderKey(b.st.status));

  // Pending terminals are paginated. 6-row preview by default; "Show all"
  // expands but still pages by PENDING_PAGE_SIZE so 800+ pending rows on
  // a whale merchant don't mount thousands of DOM nodes at once.
  const [showAllPending, setShowAllPending] = useStateS(false);
  const [pendingPage, setPendingPage] = useStateS(0);
  const PENDING_PREVIEW = 6;
  const PENDING_PAGE_SIZE = 50;
  const pendingTotalPages = Math.max(1, Math.ceil(pendingSorted.length / PENDING_PAGE_SIZE));
  const safePendingPage = Math.min(pendingPage, pendingTotalPages - 1);
  const pendingShown = showAllPending
    ? pendingSorted.slice(safePendingPage * PENDING_PAGE_SIZE,
                          (safePendingPage + 1) * PENDING_PAGE_SIZE)
    : pendingSorted.slice(0, PENDING_PREVIEW);

  // On-target group is collapsed by default — count is what matters here.
  // The list itself is lazy-loaded: when the user expands the header we
  // simulate a fetch (loading → loaded). Pending-upgrade list above stays
  // eager-loaded because that's what the operator came here to see.
  const [showOnTarget, setShowOnTarget] = useStateS(false);
  const [onTargetLoading, setOnTargetLoading] = useStateS(false);
  const [onTargetLoaded,  setOnTargetLoaded]  = useStateS(false);
  const toggleOnTarget = () => {
    if (onTarget.length === 0) return;
    if (showOnTarget) { setShowOnTarget(false); return; }
    setShowOnTarget(true);
    if (!onTargetLoaded && !onTargetLoading) {
      setOnTargetLoading(true);
      setTimeout(() => {
        setOnTargetLoading(false);
        setOnTargetLoaded(true);
      }, 500);
    }
  };

  // Map a terminal's currently-installed code → a human version name.
  const versionNameFor = (code) => {
    const v = (app.versions || []).find(vv => vv.code === code);
    return v ? v.name : (code != null ? `code ${code}` : "—");
  };

  // Mock per-terminal store assignment. The data layer doesn't model stores
  // yet, so we derive a deterministic store from the SN hash and bucket
  // terminals into 2–5 stores per merchant (scales with terminal count).
  // Stable across renders because it only depends on the SN.
  const STORE_NAMES = ["Downtown", "Westside", "Airport", "Plaza", "Mall", "Riverside", "Eastgate", "Uptown"];
  const storeBuckets = Math.min(STORE_NAMES.length, Math.max(2, Math.ceil(total / 4)));
  const storeOf = (t) => {
    const h = _hash(t.sn);
    return `${merchant.name} – ${STORE_NAMES[h % storeBuckets]}`;
  };

  // Per-status visual treatment for pending rows
  const statusStyle = (status) => {
    if (status === "install-failed" || status === "download-failed")
      return { fg: "var(--color-error-700, oklch(40% 0.14 25))", bg: "var(--color-error-50, oklch(96% 0.04 25))", border: "oklch(58% 0.20 25 / 0.3)", dot: "var(--color-error-500, oklch(58% 0.20 25))", icon: "alert" };
    if (status === "downloading" || status === "downloaded")
      return { fg: "var(--color-info-700, oklch(40% 0.12 230))", bg: "var(--color-info-50, oklch(96% 0.04 230))", border: "oklch(60% 0.14 230 / 0.3)", dot: "var(--color-info-500, oklch(60% 0.14 230))", icon: "download" };
    // awaiting
    return { fg: "var(--fg2)", bg: "var(--bg3)", border: "var(--border-1)", dot: "var(--fg3)", icon: "clock" };
  };

  return (
    <div style={{ padding: "10px 0 4px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ─── PRIMARY · Pending upgrade ───────────────────────────────── */}
      <div style={{
        borderRadius: 10, overflow: "hidden",
        border: `1px solid ${offTarget.length > 0 ? "oklch(70% 0.16 80 / 0.45)" : "var(--border-1)"}`,
        background: "var(--bg-surface, #fff)",
        boxShadow: offTarget.length > 0 ? "0 1px 0 oklch(70% 0.16 80 / 0.18)" : "none",
      }}>
        {/* Header row */}
        <div style={{
          padding: "10px 14px",
          background: offTarget.length > 0
            ? "var(--warning-bg, oklch(97% 0.04 80))"
            : "var(--bg2)",
          borderBottom: "1px solid var(--border-1)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <window.Ico name={offTarget.length > 0 ? "alert" : "check"} size={14} stroke={2.2} style={{
            color: offTarget.length > 0
              ? "var(--warning, oklch(54% 0.14 80))"
              : "var(--success, oklch(58% 0.14 152))",
          }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono num" style={{
              fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em",
              color: offTarget.length > 0
                ? "var(--color-warning-700, oklch(45% 0.13 80))"
                : "var(--fg1)",
            }}>{offTarget.length}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>
              of {total} {total === 1 ? "terminal" : "terminals"} pending upgrade
            </span>
            <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>
              · target <span className="mono" style={{ color: "var(--fg2)", fontWeight: 500 }}>{target?.name || "—"}</span>
            </span>
          </div>

          {/* Status breakdown chips — right-aligned */}
          {offTarget.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 11 }}>
              {awaitingCount > 0 && (
                <span style={{
                  padding: "2px 8px", borderRadius: 999,
                  background: "#fff", color: "var(--fg2)",
                  border: "1px solid var(--border-1)",
                }}><b className="mono num">{awaitingCount}</b> awaiting</span>
              )}
              {inflightCount > 0 && (
                <span style={{
                  padding: "2px 8px", borderRadius: 999,
                  background: "var(--color-info-50, oklch(96% 0.04 230))",
                  color: "var(--color-info-700, oklch(40% 0.12 230))",
                  border: "1px solid oklch(60% 0.14 230 / 0.3)",
                }}><b className="mono num">{inflightCount}</b> in flight</span>
              )}
              {failedCount > 0 && (
                <span style={{
                  padding: "2px 8px", borderRadius: 999,
                  background: "var(--color-error-50, oklch(96% 0.04 25))",
                  color: "var(--color-error-700, oklch(40% 0.14 25))",
                  border: "1px solid oklch(58% 0.20 25 / 0.3)",
                }}><b className="mono num">{failedCount}</b> failed</span>
              )}
            </div>
          )}
        </div>

        {offTarget.length === 0 ? (
          <div style={{
            padding: "20px 14px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, color: "var(--fg3)", fontSize: 12.5,
          }}>
            <window.Ico name="check" size={14} stroke={2.4}
              style={{ color: "var(--success, oklch(58% 0.14 152))" }} />
            All {total} terminal{total === 1 ? "" : "s"} on target — nothing pending.
          </div>
        ) : (
          <>
            {/* "How they'll upgrade" — the strategy, prominent */}
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-1)",
              background: "var(--bg-surface, #fff)",
              display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
            }}>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
                  textTransform: "uppercase", color: "var(--fg3)", marginBottom: 4,
                }}>
                  How they'll upgrade
                </div>
                {window.StrategyTextLine
                  ? <window.StrategyTextLine record={strategyRecord} />
                  : <div style={{ fontSize: 12.5, color: "var(--fg3)" }}>No strategy set — terminals will not upgrade until one is applied.</div>}
                <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--fg3)" }}>
                  Inherited from <span style={{ color: "var(--fg2)" }}>{merchant.name}</span>.
                  To change, edit the row's target version above and apply a new strategy on save.
                </div>
              </div>
            </div>

            {/* Pending terminal list — compact rows with drill-in to events */}
            <div role="table" aria-label="Terminals pending upgrade" style={{
              fontSize: 12,
            }}>
              {/* Column headers — Merchant column dropped: the context
                  (either a single Deployments row or the Merchant page itself)
                  already pins which merchant we're inside, so only the
                  store name is informative per terminal. */}
              <div role="row" style={{
                display: "grid",
                gridTemplateColumns: "minmax(110px, 0.9fr) minmax(130px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) auto",
                gap: 12,
                padding: "6px 14px",
                background: "var(--bg2)",
                borderBottom: "1px solid var(--border-1)",
                fontSize: 10.5, fontWeight: 500,
                color: "var(--fg3)", letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                <div>Terminal</div>
                <div>Store</div>
                <div>Current</div>
                <div>Status</div>
                <div style={{ textAlign: "right" }}>Events</div>
              </div>

              {pendingShown.map(({ t, st }) => {
                const sStyle = statusStyle(st.status);
                return (
                  <div role="row" key={t.sn}
                    onClick={() => onTerminalOpen && onTerminalOpen(t)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(110px, 0.9fr) minmax(130px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) auto",
                      gap: 12, alignItems: "center",
                      padding: "8px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-1)",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-primary-50, var(--bg2))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {/* Terminal SN with status dot */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: sStyle.dot,
                      }} />
                      <span className="mono" style={{
                        fontSize: 12, fontWeight: 500, color: "var(--fg1)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{t.sn}</span>
                    </div>
                    {/* Store only — merchant is the row's enclosing context */}
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                      <window.Ico name="bookmark" size={10}
                        style={{ color: "var(--fg3)", flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, color: "var(--fg2)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{storeOf(t).split(" – ")[1]}</span>
                    </div>
                    {/* Current version */}
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--fg2)" }}>
                      {versionNameFor(t.currentVersionCode)}
                      <span style={{ color: "var(--fg3)", margin: "0 4px" }}>→</span>
                      <span style={{ color: "var(--fg3)" }}>{target?.name || "—"}</span>
                    </div>
                    {/* Status pill */}
                    <div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "2px 8px", borderRadius: 999,
                        fontSize: 11, fontWeight: 500,
                        color: sStyle.fg, background: sStyle.bg,
                        border: `1px solid ${sStyle.border}`,
                      }}>
                        <window.Ico name={sStyle.icon} size={10} style={{ color: sStyle.fg }} />
                        {st.label}
                      </span>
                    </div>
                    {/* Events affordance */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: "var(--color-primary-600, var(--fg2))",
                      justifyContent: "flex-end",
                    }}>
                      <span>View events</span>
                      <window.Ico name="chevr" size={10} />
                    </div>
                  </div>
                );
              })}

              {/* Show-all toggle */}
              {pendingSorted.length > PENDING_PREVIEW && (
                <button onClick={() => { setShowAllPending(v => !v); setPendingPage(0); }}
                  style={{
                    width: "100%", padding: "8px 14px",
                    background: "var(--bg2)", border: "none", borderTop: "1px solid var(--border-1)",
                    color: "var(--fg2)", fontSize: 11.5, fontWeight: 500,
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                  }}>
                  <window.Ico name={showAllPending ? "chevu" : "chevdown"} size={10} />
                  {showAllPending
                    ? `Show top ${PENDING_PREVIEW}`
                    : `Show all ${pendingSorted.length.toLocaleString()} pending terminals`}
                </button>
              )}

              {/* Pagination — only when fully expanded AND >1 page worth */}
              {showAllPending && pendingSorted.length > PENDING_PAGE_SIZE && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 14px", background: "var(--bg2)",
                  borderTop: "1px solid var(--border-1)",
                  fontSize: 11.5, color: "var(--fg2)",
                }}>
                  <span>
                    Showing{" "}
                    <span className="mono num" style={{ color: "var(--fg1)", fontWeight: 500 }}>
                      {(safePendingPage * PENDING_PAGE_SIZE) + 1}–
                      {Math.min((safePendingPage + 1) * PENDING_PAGE_SIZE, pendingSorted.length).toLocaleString()}
                    </span>
                    {" "}of{" "}
                    <span className="mono num">{pendingSorted.length.toLocaleString()}</span>
                    {" "}pending
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => setPendingPage(Math.max(0, safePendingPage - 1))}
                      disabled={safePendingPage === 0}
                      style={{ padding: "3px 8px", fontSize: 11, color: "var(--fg2)",
                               opacity: safePendingPage === 0 ? 0.4 : 1,
                               cursor: safePendingPage === 0 ? "default" : "pointer" }}>
                      ← Prev
                    </button>
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg3)", padding: "0 4px" }}>
                      {safePendingPage + 1} / {pendingTotalPages}
                    </span>
                    <button
                      onClick={() => setPendingPage(Math.min(pendingTotalPages - 1, safePendingPage + 1))}
                      disabled={safePendingPage >= pendingTotalPages - 1}
                      style={{ padding: "3px 8px", fontSize: 11, color: "var(--fg2)",
                               opacity: safePendingPage >= pendingTotalPages - 1 ? 0.4 : 1,
                               cursor: safePendingPage >= pendingTotalPages - 1 ? "default" : "pointer" }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── SECONDARY · On target (collapsed by default) ─────────────── */}
      <div style={{
        borderRadius: 8, overflow: "hidden",
        border: "1px solid var(--border-1)",
        background: "var(--bg-surface, #fff)",
      }}>
        <button onClick={toggleOnTarget}
          disabled={onTarget.length === 0}
          style={{
            width: "100%", padding: "8px 14px",
            background: "transparent", border: "none",
            display: "flex", alignItems: "center", gap: 10,
            cursor: onTarget.length > 0 ? "pointer" : "default",
            textAlign: "left",
          }}>
          <window.Ico name="check" size={12} stroke={2.4}
            style={{ color: "var(--success, oklch(58% 0.14 152))" }} />
          <span className="mono num" style={{
            fontSize: 13, fontWeight: 600, color: "var(--color-success-700, oklch(35% 0.10 152))",
          }}>{onTarget.length}</span>
          <span style={{ fontSize: 12, color: "var(--fg2)" }}>
            {onTarget.length === 1 ? "terminal" : "terminals"} already on
            <span className="mono" style={{ color: "var(--fg1)", fontWeight: 500, marginLeft: 4 }}>
              {target?.name || "—"}
            </span>
          </span>
          {onTarget.length > 0 && (
            <span style={{
              marginLeft: "auto", fontSize: 11, color: "var(--fg3)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {showOnTarget ? "Hide list" : "Show list"}
              <window.Ico name={showOnTarget ? "chevu" : "chevdown"} size={10} />
            </span>
          )}
        </button>

        {showOnTarget && onTarget.length > 0 && (
          onTargetLoading ? (
            <div style={{
              padding: "14px 14px", borderTop: "1px solid var(--border-1)",
              background: "var(--bg2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontSize: 12, color: "var(--fg3)",
            }}>
              <span className="a-spin" style={{
                width: 12, height: 12, borderRadius: "50%",
                border: "2px solid var(--color-primary-200)",
                borderTopColor: "var(--color-primary-500)",
                display: "inline-block",
              }} />
              Loading {onTarget.length} terminal{onTarget.length === 1 ? "" : "s"} on target…
            </div>
          ) : onTargetLoaded ? (
            <div style={{
              padding: 12, borderTop: "1px solid var(--border-1)",
              background: "var(--bg2)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 6,
            }}>
            {onTarget.map(({ t }) => (
              <button key={t.sn}
                onClick={() => onTerminalOpen && onTerminalOpen(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px",
                  background: "#fff",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 120ms, background 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary-500)";
                  e.currentTarget.style.background = "var(--color-primary-50)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-1)";
                  e.currentTarget.style.background = "#fff";
                }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: "var(--success, oklch(58% 0.14 152))",
                }} />
                <span className="mono" style={{ fontSize: 11, fontWeight: 500, flex: 1 }}>{t.sn}</span>
                <span className="mono" style={{
                  fontSize: 10, color: "var(--color-success-700, oklch(35% 0.10 152))",
                }}>{target?.name || ""}</span>
              </button>
            ))}
            </div>
          ) : null
        )}
      </div>

    </div>
  );
}

Object.assign(window, {
  AppsListScreen, AppDetailScreen, VersionDetailScreen, AppMeta, DeviceChip,
  FindingsModal, FindingRow,
  // Reused by merchant-apps.jsx Target column.
  TargetVersionDropdown,
  // Reused by merchant-apps.jsx filter row (same UX as Deployments).
  FilterSelect,
  // New strategy-related row + expanded components.
  StrategyCell, ExpandedTerminals,
  // Reused by merchant-apps.jsx expanded terminal grid.
  computeTerminalStatus,
  // Per-row kebab menu + unassign confirm (shared with Merchants → Apps tab).
  RowKebabMenu, UnassignConfirmModal,
});
