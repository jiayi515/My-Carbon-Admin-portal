/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — Ticket Workbench (rebuilt for the new tab spec)
//
// Opens in a separate tab. Layout:
//   ┌──── top context bar ──────────────────────────────────┐
//   ├──── tab bar (Terminal / Remote) + sidebar toggle ─────┤
//   ├─────────────────────────────────────┬─────────────────┤
//   │ tab body (default content)          │ ticket context  │
//   │   • action button row at top        │   + records     │
//   │   • tool slide-over drawer overlays │  (collapsible)  │
//   └─────────────────────────────────────┴─────────────────┘
//
// Tabs:
//   • Terminal  — Terminal info + tools: Log extraction · Live logs ·
//                 File extraction · Hardware diagnostic
//   • Remote    — Remote desktop + tools: Device restart · Factory reset
// ─────────────────────────────────────────────────────────────

const { useState: useStateW, useEffect: useEffectW, useMemo: useMemoW, useRef: useRefW } = React;
// ─── Tab + tool catalogue ──────────────────────────────────
// Two top-level tabs:
//   • Trouble    — log-centric. Trouble log (canned) + Live log sub-tabs.
//                  Search + level filter on the right.
//   • Monitoring — live device snapshot (runtime / network / security /
//                  system) + the action-tool row (Pull logs, File pull,
//                  Hardware diag, Reboot, Factory reset).
const WB_TABS = [
  { id: "info",    icon: "alert",  label: "Trouble" },
  { id: "monitor", icon: "shield", label: "Monitoring" },
];
// All tools live on Monitoring. Live logs moved to Trouble's sub-tab.
const MONITORING_TOOLS = [
  { id: "logpull",  icon: "download", label: "Pull logs",     blurb: "Fetch on-device logs to the cloud" },
  { id: "filepull", icon: "package",  label: "File pull",     blurb: "Pull a file or directory from device" },
  { id: "diag",     icon: "shield",   label: "Hardware diag", blurb: "Auto + assisted hardware self-test" },
  { id: "remote",   icon: "external", label: "Remote desk",   blurb: "View & control the terminal screen live", confirmClose: true },
  { id: "reboot",   icon: "refresh",  label: "Reboot device", blurb: "Reboot the terminal remotely" },
  { id: "factory",  icon: "trash",    label: "Factory reset", blurb: "Erase the device — destructive", danger: true },
];
function toolsForTab(tab) { return tab === "monitor" ? MONITORING_TOOLS : []; }
function findTool(id) { return MONITORING_TOOLS.find(t => t.id === id) || null; }

// Anchor "now" used in synthetic timestamps.
function nowStamp(offsetSec = 0) {
  const base = 14 * 3600 + 32 * 60 + 8 + offsetSec;
  const h = String(Math.floor(base / 3600) % 24).padStart(2, "0");
  const m = String(Math.floor((base / 60) % 60)).padStart(2, "0");
  const s = String(base % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Main screen ───────────────────────────────────────────
function WorkbenchScreen({ ticket, navigate, onCloseTab }) {
  const device = window.findDeviceBySn?.(ticket.deviceSn);
  const merchant = device ? window.findMerchantById?.(device.merchantId) : null;
  const role = window.currentRole?.() || "ISO";

  const [activeTab, setActiveTab] = useStateW("info");        // 'info' | 'remote'
  const [activeTool, setActiveTool] = useStateW(null);         // tool id when drawer open
  const [rebootConfirmOpen, setRebootConfirmOpen] = useStateW(false);

  // Ticket actions — mirror the same surface as the Ticket detail screen so
  // the operator never has to bounce back just to assign / escalate / close.
  const [escalateOpen, setEscalateOpen] = useStateW(false);
  const [replyOpen, setReplyOpen] = useStateW(false);
  const [replyCloseOpen, setReplyCloseOpen] = useStateW(false);
  const [assignOpen, setAssignOpen] = useStateW(false);
  const [commentOpen, setCommentOpen] = useStateW(false);
  const [commentTick, setCommentTick] = useStateW(0);
  const [confirmAction, setConfirmAction] = useStateW(null);
  const [, bumpActions] = useStateW(0);

  // Snapshot for the escalate dialog (it shows captured-at).
  const snapshot = useMemoW(
    () => window.buildSnapshotFor?.(device, ticket.snapshotOverride || {}),
    [ticket.id, device?.sn]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useStateW(() => {
    try { return localStorage.getItem("wb.sidebar.collapsed") === "1"; } catch { return false; }
  });

  useEffectW(() => {
    try { localStorage.setItem("wb.sidebar.collapsed", sidebarCollapsed ? "1" : "0"); } catch {}
  }, [sidebarCollapsed]);

  // Switching tabs closes any open tool drawer.
  useEffectW(() => { setActiveTool(null); }, [activeTab]);

  // Log a workbench action into the ticket timeline (right-side records).
  const logAction = (entry) => {
    const next = { at: nowStamp(0), ...entry };
    ticket.timeline = [...(ticket.timeline || []), {
      at: "May 16, 2026 " + next.at,
      actor: role === "NPT" ? "Hossein Naderi" : "Maya Hassan",
      kind: "workbench",
      note: next.label + (next.detail ? ` · ${next.detail}` : ""),
    }];
  };

  // Connection state — animated latency.
  const [connection, setConnection] = useStateW({ latencyMs: 23 });
  useEffectW(() => {
    const i = setInterval(() => {
      setConnection({ latencyMs: 18 + Math.floor(Math.random() * 18) });
    }, 2200);
    return () => clearInterval(i);
  }, []);

  const tools = toolsForTab(activeTab);
  const tool = findTool(activeTool);

  // "Back" closes the in-app workbench tab when the host hands us an
  // onCloseTab hook; falls back to in-place navigation otherwise.
  const handleClose = () => {
    if (typeof onCloseTab === "function") { onCloseTab(); return; }
    navigate({ screen: "ticketDetail", ticketId: ticket.id });
  };

  // ─── Ticket-level actions (Assign / Escalate / Reply & close) ───────────
  // The set of visible buttons depends on role + ticket.status, exactly
  // matching the rules used by the Ticket detail screen.
  const wbTransitions = useMemoW(() => {
    const out = [];
    if (role === "ISO") {
      if (ticket.status === "iso-working" || ticket.status === "npt-resolved") {
        out.push({ id: "escalate", label: "Escalate to NPT", icon: "upload",
          danger: true, customDialog: "escalate" });
        out.push({ id: "close-customer", label: "Reply & close", icon: "check",
          primary: true, customDialog: "replyClose" });
      }
    } else if (role === "NPT") {
      if (ticket.status === "npt-working" && ticket.nptHandler !== "TOMS NPT queue") {
        out.push({ id: "npt-reply", label: "Reply to ISO", icon: "upload",
          primary: true, customDialog: "reply" });
      }
    }
    return out;
  }, [role, ticket.status, ticket.nptHandler, ticket.id]);

  const wbCanAssign =
    (role === "ISO" && ["iso-working", "npt-resolved"].includes(ticket.status)) ||
    (role === "NPT" && ticket.status === "npt-working" && ticket.nptHandler !== "TOMS NPT queue");

  // Stamp the timeline as the workbench operator and bump local state so
  // the top-bar status chip + action button set refresh after a transition.
  const wbNow = () => "May 16, 2026 " + nowStamp(0);
  const wbActor = role === "NPT" ? "Hossein Naderi" : "Maya Hassan";

  const applyWbTransition = (tr) => {
    const now = wbNow();
    if (tr.to) ticket.status = tr.to;
    ticket.updatedAt = now;
    ticket.timeline = [
      ...(ticket.timeline || []),
      { at: now, actor: wbActor,
        kind: tr.id.includes("close") || tr.id.includes("reply") ? "resolution" : "status",
        note: tr.toast },
    ];
    if (tr.toast) window.showToast?.(tr.toast, "success");
    setConfirmAction(null);
    bumpActions((n) => n + 1);
  };

  const applyWbEscalation = ({ grants, reason }) => {
    const now = wbNow();
    ticket.status = "npt-working";
    ticket.updatedAt = now;
    ticket.nptHandler = "TOMS NPT queue";
    ticket.nptGrants = { ...grants, grantedAt: now, grantedBy: "Maya Hassan (ISO)" };
    const labels = window.GRANT_LABELS || {};
    const grantSummary = Object.entries(grants).filter(([, v]) => v).map(([k]) => labels[k]).join(" · ");
    ticket.timeline = [
      ...(ticket.timeline || []),
      { at: now, actor: "Maya Hassan", kind: "escalation",
        note: `Escalated to NPT · granted access: ${grantSummary || "none"}` },
      ...(reason ? [{ at: now, actor: "Maya Hassan", kind: "comment",
        note: `Reason: ${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}` }] : []),
    ];
    if (reason) {
      ticket.comments = [...(ticket.comments || []), {
        at: now, actor: "Maya Hassan",
        body: `Escalation note to NPT: ${reason}`,
      }];
    }
    window.showToast?.("Escalated to NPT — access grants recorded", "success");
    setEscalateOpen(false);
    bumpActions((n) => n + 1);
  };

  const applyWbAssign = ({ assignee, reason }) => {
    const now = wbNow();
    const field = role === "NPT" ? "nptHandler" : "assignedTo";
    const prev = ticket[field] || "Unassigned";
    const roster = window.TICKET_ROSTER?.[role] || [];
    const recipient = roster.find((r) => r.id === assignee);
    const targetLabel = recipient?.queue ? recipient.name.toLowerCase() : recipient?.name || assignee;
    ticket[field] = assignee;
    ticket.updatedAt = now;
    ticket.timeline = [
      ...(ticket.timeline || []),
      { at: now, actor: wbActor, kind: "status",
        note: `Reassigned · ${prev} → ${targetLabel}` },
      { at: now, actor: wbActor, kind: "comment",
        note: `Reason: ${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}` },
    ];
    ticket.comments = [...(ticket.comments || []), {
      at: now, actor: wbActor,
      body: `Handoff note for ${targetLabel}: ${reason}`,
    }];
    window.showToast?.(recipient?.queue
      ? "Returned to queue — anyone on the team can pick it up"
      : `Reassigned to ${recipient?.name || assignee}`, "success");
    setAssignOpen(false);
    bumpActions((n) => n + 1);
  };

  const applyWbReply = (payload) => {
    const now = wbNow();
    ticket.status = "npt-resolved";
    ticket.updatedAt = now;
    ticket.solution = {
      summary: payload.summary,
      steps: payload.steps,
      rootCause: payload.rootCause,
      sentAt: now,
      sentBy: "Hossein Naderi (NPT)",
    };
    ticket.timeline = [
      ...(ticket.timeline || []),
      { at: now, actor: "Hossein Naderi", kind: "resolution",
        note: `Replied to ISO with solution: ${payload.summary.slice(0, 80)}${payload.summary.length > 80 ? "…" : ""}` },
    ];
    ticket.comments = [...(ticket.comments || []), {
      at: now, actor: "Hossein Naderi",
      body: `Solution${payload.rootCause ? ` (root cause: ${payload.rootCause})` : ""}:\n${payload.summary}${payload.steps ? `\n\nSteps for ISO to apply:\n${payload.steps}` : ""}`,
    }];
    window.showToast?.("Reply sent to ISO with solution", "success");
    setReplyOpen(false);
    bumpActions((n) => n + 1);
  };

  // Reboot is gated by an inline confirm — no drawer. On confirm, queue
  // the reboot command and surface status via toasts.
  const handleRebootConfirm = () => {
    setRebootConfirmOpen(false);
    logAction({ tool: "REBOOT", label: "Reboot command queued", tone: "warn" });
    window.showToast?.(`Reboot command sent to ${ticket.deviceSn}…`, "info");
    setTimeout(() => {
      logAction({ tool: "REBOOT", label: "Device offline — rebooting", tone: "warn" });
    }, 700);
    setTimeout(() => {
      logAction({ tool: "REBOOT", label: "Device back online", tone: "ok", detail: "uptime · 4 s" });
      window.showToast?.(`${ticket.deviceSn} is back online.`, "success");
    }, 4800);
  };

  return (
    <div style={{
      display: "grid", height: "100%", width: "100%", minHeight: 0,
      gridTemplateRows: "56px 44px minmax(0, 1fr)",
      background: "var(--color-bg-1)",
    }}>
      <WBTopBar ticket={ticket} device={device} merchant={merchant}
        connection={connection} role={role} onClose={handleClose}
        transitions={wbTransitions}
        canAssign={wbCanAssign}
        onAssign={() => setAssignOpen(true)}
        onAction={(tr) => {
          if (tr.customDialog === "escalate") return setEscalateOpen(true);
          if (tr.customDialog === "reply") return setReplyOpen(true);
          if (tr.customDialog === "replyClose") return setReplyCloseOpen(true);
          if (tr.dialog) return setConfirmAction(tr);
          applyWbTransition(tr);
        }} />

      <WBTabBar activeTab={activeTab} onTabChange={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(c => !c)} />

      <div style={{
        display: "grid",
        gridTemplateColumns: sidebarCollapsed ? "minmax(0, 1fr) 0px" : "minmax(0, 1fr) 320px",
        transition: "grid-template-columns .22s ease",
        minHeight: 0, overflow: "hidden",
        borderTop: "1px solid var(--color-border-subtle)",
      }}>
        {/* Body — default content + slide-over drawer */}
        <div style={{ position: "relative", minWidth: 0, minHeight: 0,
          background: "var(--color-bg-1)", overflow: "hidden" }}>
          <div style={{ height: "100%",
            display: "flex", flexDirection: "column", minHeight: 0 }}>
            {tools.length > 0 && (
              <WBActionBar tools={tools} activeTool={activeTool}
                onSelect={(id) => {
                  if (id === "reboot") {
                    setRebootConfirmOpen(true);
                    return;
                  }
                  setActiveTool(id);
                  logAction({ tool: "WB",
                    label: `Opened · ${tools.find(t => t.id === id)?.label}`,
                    tone: "neutral" });
                }} />
            )}
            <div style={{ flex: 1, minHeight: 0,
              display: "flex", flexDirection: "column" }}>
              {activeTab === "info"    && <TroubleTab    ticket={ticket} device={device} logAction={logAction} />}
              {activeTab === "monitor" && <MonitoringTab ticket={ticket} device={device} logAction={logAction} />}
            </div>
          </div>

          {tool && (
            <WBToolDrawer tool={tool} onClose={() => setActiveTool(null)}>
              {tool.id === "logpull"  && <LogPullTool      ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "livelog"  && <LiveLogsTool     ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "filepull" && <FilePullTool     ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "diag"     && <HardwareDiagTool ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "remote"   && <RemoteDeskTool   ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "reboot"   && <DeviceRebootTool ticket={ticket} device={device} logAction={logAction} />}
              {tool.id === "factory"  && <FactoryResetTool ticket={ticket} device={device} logAction={logAction} />}
            </WBToolDrawer>
          )}
        </div>

        {!sidebarCollapsed && (
          <WBRightSidebar ticket={ticket} device={device} merchant={merchant}
            onOpenTicket={() => navigate({ screen: "ticketDetail", ticketId: ticket.id })}
            onOpenComment={() => setCommentOpen(true)}
            commentTrigger={commentTick} />
        )}
      </div>

      <window.ConfirmDialog
        open={rebootConfirmOpen}
        onClose={() => setRebootConfirmOpen(false)}
        title={<>Reboot <span className="mono">{ticket.deviceSn}</span>?</>}
        body={<>The terminal will be offline for about 30–60 seconds. The cashier will see a splash screen. No data loss — active transactions resume from local state. This action is recorded on the ticket timeline.</>}
        confirmLabel="Reboot"
        tone="danger"
        icon="refresh"
        onConfirm={handleRebootConfirm} />

      {/* Reuse the same dialogs the Ticket detail screen uses, so the action
          wording, layout, and side-effects stay identical between the two
          surfaces. */}
      <window.ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.dialog?.title}
        body={confirmAction?.dialog?.body}
        confirmLabel={confirmAction?.dialog?.confirmLabel}
        tone={confirmAction?.danger ? "danger" : "primary"}
        icon={confirmAction?.icon}
        onConfirm={() => applyWbTransition(confirmAction)} />

      {window.EscalateDialog && (
        <window.EscalateDialog
          open={escalateOpen}
          ticket={ticket}
          device={device}
          snapshot={snapshot}
          onClose={() => setEscalateOpen(false)}
          onConfirm={applyWbEscalation} />
      )}

      {window.AssignDialog && (
        <window.AssignDialog
          open={assignOpen}
          ticket={ticket}
          role={role}
          me={role === "NPT" ? "Hossein Naderi (NPT)" : "Maya Hassan (ISO)"}
          onClose={() => setAssignOpen(false)}
          onConfirm={applyWbAssign} />
      )}

      {window.ReplyDialog && (
        <window.ReplyDialog
          open={replyOpen}
          ticket={ticket}
          onClose={() => setReplyOpen(false)}
          onConfirm={applyWbReply} />
      )}

      {window.CommentDialog && (
        <window.CommentDialog
          open={commentOpen}
          ticket={ticket}
          role={role}
          onClose={() => setCommentOpen(false)}
          onSubmit={(text) => {
            const now = wbNow();
            ticket.comments = [...(ticket.comments || []), {
              at: now, actor: wbActor, body: text,
            }];
            ticket.timeline = [...(ticket.timeline || []), {
              at: now, actor: wbActor, kind: "comment",
              note: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
            }];
            ticket.updatedAt = now;
            window.showToast?.("Comment posted", "success");
            setCommentOpen(false);
            setCommentTick((n) => n + 1);
          }} />
      )}

      {window.ReplyCloseDialog && (
        <window.ReplyCloseDialog
          open={replyCloseOpen}
          ticket={ticket}
          onClose={() => setReplyCloseOpen(false)}
          onConfirm={({ note }) => {
            const now = wbNow();
            ticket.status = "closed";
            ticket.updatedAt = now;
            ticket.timeline = [
              ...(ticket.timeline || []),
              { at: now, actor: wbActor, kind: "resolution",
                note: "Ticket closed — customer notified" + (note ? " · with reply" : "") },
            ];
            // Always log a comment when closing so the comments thread
            // has a complete audit trail of close / reopen events.
            const closeBody = note
              ? `Reply to customer (sent on close):\n${note}`
              : "Closed the ticket — no customer reply attached.";
            ticket.comments = [...(ticket.comments || []), {
              at: now, actor: wbActor, body: closeBody,
            }];
            ticket.timeline.push({ at: now, actor: wbActor, kind: "comment",
              note: note
                ? `Reply: ${note.slice(0, 80)}${note.length > 80 ? "…" : ""}`
                : "Closed without customer reply" });
            window.showToast?.("Ticket closed — customer notified", "success");
            setReplyCloseOpen(false);
            bumpActions((n) => n + 1);
          }} />
      )}
    </div>
  );
}

// ─── Tab bar (Terminal / Remote + sidebar toggle) ──────────
function WBTabBar({ activeTab, onTabChange, sidebarCollapsed, onToggleSidebar }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch", justifyContent: "space-between",
      background: "var(--bg2)",
      borderBottom: "1px solid var(--border-1)",
      paddingLeft: 8, paddingRight: 12,
    }}>
      <div style={{ display: "flex", gap: 0 }}>
        {WB_TABS.map(t => {
          const on = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "0 16px", margin: 0,
                background: "transparent", border: 0,
                borderBottom: on ? "2px solid var(--color-primary-600)" : "2px solid transparent",
                color: on ? "var(--color-primary-700)" : "var(--fg2)",
                fontSize: 13, fontWeight: on ? 600 : 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--fg1)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--fg2)"; }}>
              <window.Ico name={t.icon} size={13} stroke={1.8} />
              {t.label}
            </button>
          );
        })}
      </div>
      <button onClick={onToggleSidebar} style={{
        alignSelf: "center",
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 9px",
        background: "transparent",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-sm)",
        color: "var(--fg2)", fontSize: 11.5, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
      }} title={sidebarCollapsed ? "Show ticket info" : "Hide ticket info"}>
        <window.Ico name={sidebarCollapsed ? "chevl" : "chevr"} size={11} stroke={2} />
        {sidebarCollapsed ? "Show info" : "Hide info"}
      </button>
    </div>
  );
}

// ─── Tool action bar (top of tab body) ─────────────────────
function WBActionBar({ tools, activeTool, onSelect }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "10px 20px",
      background: "var(--bg2)",
      borderBottom: "1px solid var(--border-1)",
    }}>
      <span className="overline" style={{ fontSize: 9.5, color: "var(--fg3)", marginRight: 4,
        letterSpacing: "0.06em", textTransform: "uppercase" }}>Tools</span>
      {tools.map(t => {
        const on = activeTool === t.id;
        const danger = t.danger;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
            title={t.blurb}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 11px",
              background: on
                ? (danger ? "var(--error-bg)" : "var(--color-primary-50)")
                : "var(--bg1)",
              border: "1px solid " + (on
                ? (danger
                    ? "color-mix(in oklab, var(--color-error-500) 30%, transparent)"
                    : "color-mix(in oklab, var(--color-primary-500) 30%, transparent)")
                : "var(--border-1)"),
              borderRadius: "var(--radius-sm)",
              color: on
                ? (danger ? "var(--color-error-700)" : "var(--color-primary-700)")
                : (danger ? "var(--color-error-700)" : "var(--fg1)"),
              fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
              transition: "background .12s ease",
            }}
            onMouseEnter={(e) => {
              if (!on) e.currentTarget.style.background = danger ? "var(--error-bg)" : "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!on) e.currentTarget.style.background = "var(--bg1)";
            }}>
            <window.Ico name={t.icon} size={12} stroke={1.8} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tool slide-over drawer ────────────────────────────────
// Children can inject controls into the title bar by consuming
// `WBDrawerHeaderContext` and portaling React nodes into the exposed
// DOM element. Lets tool-specific affordances (e.g. Remote desk's
// column-mode toggle) sit visually inside the drawer's title bar
// without WBToolDrawer needing to know about them.
const WBDrawerHeaderContext = React.createContext(null);

function WBToolDrawer({ tool, onClose, children }) {
  const [confirmOpen, setConfirmOpen] = useStateW(false);
  const [maximized, setMaximized] = useStateW(false);
  const [minimized, setMinimized] = useStateW(false);
  const [headerSlotEl, setHeaderSlotEl] = useStateW(null);
  const requestClose = () => {
    if (tool.confirmClose) setConfirmOpen(true);
    else onClose();
  };
  // ESC requests close (through confirm flow if applicable).
  useEffectW(() => {
    const onKey = (e) => { if (e.key === "Escape") {
      if (confirmOpen) { setConfirmOpen(false); return; }
      requestClose();
    } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmOpen, tool]);
  return (
    <>
      {/* Floating restore pill — visible only while minimized. The
          drawer DOM below stays mounted (display:none) so children
          keep all their state. */}
      {minimized && (
        <button type="button" onClick={() => setMinimized(false)}
          style={{
            position: "fixed", bottom: 20, right: 20,
            zIndex: 9999,
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: "var(--bg2)",
            border: "1px solid var(--border-1)",
            borderRadius: 999,
            boxShadow: "0 16px 40px -12px rgba(15,23,42,0.32)",
            cursor: "pointer", fontFamily: "inherit",
            color: "var(--fg1)",
          }}
          title={`Restore · ${tool.label}`}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            display: "grid", placeItems: "center",
            background: tool.danger ? "var(--error-bg)" : "var(--color-primary-50)",
            color: tool.danger ? "var(--color-error-700)" : "var(--color-primary-700)",
            border: "1px solid " + (tool.danger
              ? "color-mix(in oklab, var(--color-error-500) 22%, transparent)"
              : "color-mix(in oklab, var(--color-primary-500) 22%, transparent)"),
          }}>
            <window.Ico name={tool.icon} size={11} stroke={1.8} />
          </span>
          <span style={{ display: "flex", flexDirection: "column",
            alignItems: "flex-start", lineHeight: 1.15 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tool.label}</span>
            <span style={{ fontSize: 10.5, color: "var(--fg3)",
              letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Minimized · click to restore
            </span>
          </span>
          <window.Ico name="arrowU2" size={12} stroke={2}
            style={{ color: "var(--fg3)" }} />
        </button>
      )}
      <div style={maximized ? {
        position: "fixed", inset: 0,
        background: "var(--color-bg-1)",
        display: minimized ? "none" : "flex",
        flexDirection: "column",
        boxShadow: "0 24px 64px -20px oklch(0% 0 0 / 0.32)",
        zIndex: 9998,
      } : {
        position: "absolute", inset: 0,
        background: "var(--color-bg-1)",
        display: minimized ? "none" : "flex",
        flexDirection: "column",
        animation: "wbDrawerIn .18s ease-out",
        boxShadow: "-12px 0 32px -16px oklch(0% 0 0 / 0.18)",
        zIndex: 10,
      }}>
      <WBDrawerHeaderContext.Provider value={headerSlotEl}>
      <style>{`@keyframes wbDrawerIn { from { transform: translateX(48px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
      <div style={{
        padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border-1)",
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: "var(--radius-sm)",
          display: "grid", placeItems: "center",
          background: tool.danger ? "var(--error-bg)" : "var(--color-primary-50)",
          color: tool.danger ? "var(--color-error-700)" : "var(--color-primary-700)",
          border: "1px solid " + (tool.danger
            ? "color-mix(in oklab, var(--color-error-500) 22%, transparent)"
            : "color-mix(in oklab, var(--color-primary-500) 22%, transparent)"),
        }}>
          <window.Ico name={tool.icon} size={14} stroke={1.8} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em",
            color: tool.danger ? "var(--color-error-700)" : "var(--fg1)" }}>{tool.label}</h2>
          <div style={{ marginTop: 1, fontSize: 11.5, color: "var(--fg3)" }}>{tool.blurb}</div>
        </div>
        {/* Tool-injected header controls (Remote desk uses this for
            its column-mode toggle). Empty for tools that don't opt in. */}
        <div ref={setHeaderSlotEl} style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 0,
        }} />
        <button onClick={() => setMinimized(true)}
          title="Minimize"
          style={drawerChromeBtn}>
          <window.Ico name="chevdown" size={11} stroke={2} />
        </button>
        <button onClick={() => setMaximized(m => !m)}
          title={maximized ? "Restore size" : "Maximize"}
          style={drawerChromeBtn}>
          <window.Ico name={maximized ? "arrowD2" : "arrowU2"} size={11} stroke={2} />
        </button>
        <button onClick={requestClose} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: "var(--radius-sm)",
          background: "var(--bg1)", border: "1px solid var(--border-1)",
          color: "var(--fg2)", fontSize: 11.5, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <window.Ico name="x" size={11} stroke={2} />
          Close
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-4) var(--space-5) var(--space-6)" }}>
        {children}
      </div>
      {confirmOpen && (
        <WBCloseConfirm tool={tool}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { setConfirmOpen(false); onClose(); }} />
      )}
      </WBDrawerHeaderContext.Provider>
    </div>
    </>
  );
}

// Square chrome button used by the drawer header for minimize /
// maximize. The Close button is wider so it stays as bespoke markup.
const drawerChromeBtn = {
  width: 28, height: 28, borderRadius: "var(--radius-sm)",
  background: "var(--bg1)", border: "1px solid var(--border-1)",
  color: "var(--fg2)",
  display: "inline-grid", placeItems: "center",
  cursor: "pointer", fontFamily: "inherit",
};

// Modal shown when closing a tool that opted into confirmClose.
function WBCloseConfirm({ tool, onCancel, onConfirm }) {
  return (
    <div role="dialog" aria-modal="true"
      onClick={onCancel}
      style={{
        position: "absolute", inset: 0,
        background: "rgba(15, 23, 42, 0.42)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(2px)",
        zIndex: 20,
        animation: "wbDrawerIn .14s ease-out",
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, calc(100% - 32px))",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          boxShadow: "0 24px 60px -20px rgba(15,23,42,0.35)",
          padding: "18px 20px 16px",
          fontFamily: "var(--font-family-sans)",
          color: "#0f172a",
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            display: "grid", placeItems: "center",
            background: "#fef3c7", color: "#b45309", flexShrink: 0,
          }}>
            <window.Ico name="alert" size={16} stroke={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
              Close Remote desk?
            </div>
            <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45,
              color: "#475569" }}>
              Ending the session will disconnect from the terminal and stop
              any active mirroring. Annotations, screenshots, and log tail
              are saved to this ticket.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8,
          marginTop: 16 }}>
          <button type="button" onClick={onCancel}
            style={{
              padding: "7px 14px", borderRadius: 8,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#0f172a", fontWeight: 500, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}>Keep open</button>
          <button type="button" onClick={onConfirm}
            autoFocus
            style={{
              padding: "7px 14px", borderRadius: 8,
              background: "#dc2626", color: "#ffffff",
              border: "1px solid #b91c1c",
              fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}>End session</button>
        </div>
      </div>
    </div>
  );
}

// ─── Top bar ───────────────────────────────────────────────
function WBTopBar({ ticket, device, merchant, connection, role, onClose,
  transitions = [], canAssign = false, onAssign, onAction }) {
  const ty = window.TICKET_TYPE?.[ticket.type] || { label: ticket.type, bg: "var(--bg3)", fg: "var(--fg2)", icon: "doc" };
  const st = window.TICKET_STATUS?.[ticket.status] || { label: ticket.status, tone: "info" };
  const hasActions = canAssign || transitions.length > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 12px 0 12px",
      background: "linear-gradient(180deg, oklch(20% 0.02 250) 0%, oklch(15% 0.02 250) 100%)",
      color: "oklch(94% 0.005 240)",
      borderBottom: "1px solid oklch(28% 0.01 250)",
      fontSize: 12.5,
    }}>
      <button onClick={onClose} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: "var(--radius-sm)",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        color: "oklch(85% 0.005 240)",
        fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        <window.Ico name="chevl" size={12} />Back
      </button>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600,
        color: "oklch(75% 0.04 250)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{ticket.id}</span>
      <span style={{ width: 1, height: 22, background: "rgba(255,255,255,.1)" }} />
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px", borderRadius: 999,
        background: ty.bg, color: ty.fg,
        fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap",
      }}>
        <window.Ico name={ty.icon} size={10} stroke={1.8} />{ty.label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "oklch(96% 0.005 240)",
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ticket.title}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px", borderRadius: 999,
        background: "rgba(255,255,255,.06)", color: "oklch(90% 0.04 240)",
        fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap",
        border: "1px solid rgba(255,255,255,.08)",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%",
          background: st.tone === "success" ? "oklch(70% 0.16 152)"
                    : st.tone === "warning" ? "oklch(78% 0.17 75)"
                    : st.tone === "danger"  ? "oklch(70% 0.18 25)"
                    :                          "oklch(70% 0.12 240)" }} />
        {st.label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 8px", borderRadius: "var(--radius-sm)",
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.08)",
        fontFamily: "var(--font-family-mono)", fontSize: 11,
        color: "oklch(85% 0.005 240)", whiteSpace: "nowrap",
      }}>
        <window.Ico name="device" size={10} stroke={1.8} />
        {ticket.deviceSn}{device && <> · {device.model}</>}
      </span>
      {hasActions && (
        <>
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,.1)" }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
            flexShrink: 0 }}>
            {canAssign && (
              <WBTopBarAction icon="users" onClick={onAssign}>Assign</WBTopBarAction>
            )}
            {transitions.map((tr) => (
              <WBTopBarAction key={tr.id} icon={tr.icon}
                primary={tr.primary} danger={tr.danger}
                onClick={() => onAction?.(tr)}>
                {tr.label}
              </WBTopBarAction>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Translucent action chip styled for the dark workbench top bar. Three
// flavours — neutral (default), primary, danger — matching the same
// emphasis the Ticket detail header uses.
function WBTopBarAction({ icon, children, onClick, primary, danger }) {
  const bg = danger  ? "color-mix(in oklab, oklch(60% 0.20 25) 22%, transparent)"
          : primary ? "color-mix(in oklab, oklch(60% 0.18 250) 30%, transparent)"
                    : "rgba(255,255,255,.06)";
  const bgHover = danger  ? "color-mix(in oklab, oklch(60% 0.20 25) 32%, transparent)"
                : primary ? "color-mix(in oklab, oklch(60% 0.18 250) 42%, transparent)"
                          : "rgba(255,255,255,.12)";
  const border = danger  ? "color-mix(in oklab, oklch(60% 0.20 25) 50%, transparent)"
              : primary ? "color-mix(in oklab, oklch(70% 0.18 250) 55%, transparent)"
                        : "rgba(255,255,255,.12)";
  const color = danger  ? "oklch(92% 0.08 25)"
             : primary ? "oklch(96% 0.04 250)"
                       : "oklch(92% 0.005 240)";
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px", borderRadius: "var(--radius-sm)",
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11.5, fontWeight: primary || danger ? 600 : 500,
      cursor: "pointer", whiteSpace: "nowrap",
      transition: "background .12s ease",
      fontFamily: "inherit",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = bgHover; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = bg; }}>
      {icon && <window.Ico name={icon} size={11} stroke={1.8} />}
      {children}
    </button>
  );
}


// ─── Right sidebar — ticket info + action records ─────────
// `commentTrigger` is the version stamp from the parent — it's bumped
// whenever a new comment is posted (via the Comment dialog) so this
// component re-reads ticket.comments and rebuilds the history list.
function WBRightSidebar({ ticket, device, merchant, onOpenTicket, onOpenComment, commentTrigger }) {
  const sv = window.TICKET_SEVERITY?.[ticket.severity] || { label: ticket.severity };
  const ty = window.TICKET_TYPE?.[ticket.type] || { label: ticket.type, bg: "var(--bg3)", fg: "var(--fg2)", icon: "doc" };
  const role = window.currentRole?.() || "ISO";
  // Force re-render when comments mutate by reading length.
  const tlLen = ticket.timeline?.length || 0;
  // Comment posting now happens via the CommentDialog modal — the
  // parent owns the dialog state and pings us via `commentTrigger`
  // after each submit so the history list re-renders.
  // Comment history — read from the canonical ticket.comments store
  // (same as Ticket detail). Newest first.
  const comments = [...(ticket.comments || [])].reverse();

  // Comments thread now lives behind an icon button — collapsed by
  // default. A red dot pings the operator when new comments have
  // arrived since the last time they opened the panel. Read-state is
  // kept in localStorage so it survives a refresh.
  const readKey = `wb-comments-read-${ticket.id}`;
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [lastReadCount, setLastReadCount] = React.useState(() => {
    try { return Number(localStorage.getItem(readKey)) || 0; }
    catch (_) { return 0; }
  });
  const totalComments = comments.length;
  const unread = Math.max(0, totalComments - lastReadCount);
  // Auto-mark read whenever the panel is open and a new comment
  // shows up (e.g. user posts via the dialog → commentTrigger ticks).
  React.useEffect(() => {
    if (commentsOpen && totalComments !== lastReadCount) {
      setLastReadCount(totalComments);
      try { localStorage.setItem(readKey, String(totalComments)); } catch (_) {}
    }
  }, [commentsOpen, totalComments, commentTrigger]);
  const openComments = () => {
    if (!commentsOpen) {
      // Mark all read when expanding.
      setLastReadCount(totalComments);
      try { localStorage.setItem(readKey, String(totalComments)); } catch (_) {}
    }
    setCommentsOpen(!commentsOpen);
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "var(--bg2)",
      borderLeft: "1px solid var(--border-1)",
      minHeight: 0,
      // Whole sidebar scrolls as one — the previous design pinned
      // Action records to a flex:1 internal scroller, which felt
      // cramped once the ticket info + comments grew. One scroll
      // surface is calmer.
      overflow: "auto",
    }}>
      {/* Ticket basic info */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-1)" }}>
        <div className="overline" style={{ fontSize: 9.5, marginBottom: 8 }}>Issue</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg1)",
          lineHeight: 1.4, textWrap: "pretty" }}>{ticket.title}</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 7px", borderRadius: 999,
            background: ty.bg, color: ty.fg,
            fontSize: 10.5, fontWeight: 500,
          }}>
            <window.Ico name={ty.icon} size={9} stroke={1.8} />{ty.label}
          </span>
          <span style={{
            padding: "2px 7px", borderRadius: 999,
            background: "var(--bg3)", border: "1px solid var(--border-1)",
            fontSize: 10.5, fontWeight: 500, color: "var(--fg2)",
          }}>{sv.label}</span>
        </div>
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: "var(--bg1)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-sm)",
          fontSize: 11.5, color: "var(--fg2)",
          lineHeight: 1.55, textWrap: "pretty",
          maxHeight: 120, overflow: "auto",
        }}>{ticket.description}</div>
        <div style={{
          marginTop: 10, display: "grid",
          gridTemplateColumns: "70px minmax(0, 1fr)", rowGap: 4, fontSize: 11,
        }}>
          <span style={{ color: "var(--fg3)" }}>Device</span>
          <span className="mono" style={{ color: "var(--fg1)" }}>{ticket.deviceSn}</span>
          {device && <>
            <span style={{ color: "var(--fg3)" }}>Model</span>
            <span className="mono" style={{ color: "var(--fg2)" }}>{device.model}</span>
          </>}
          {merchant && <>
            <span style={{ color: "var(--fg3)" }}>Merchant</span>
            <span style={{ color: "var(--fg2)" }}>{merchant.name}</span>
          </>}
          <span style={{ color: "var(--fg3)" }}>Created</span>
          <span className="mono" style={{ color: "var(--fg2)" }}>{ticket.createdAt}</span>
          {ticket.faultWindow && <>
            <span style={{ color: "var(--fg3)", paddingTop: 1 }}>Fault window</span>
            <span className="mono" style={{ color: "var(--fg2)", lineHeight: 1.35,
              display: "flex", flexDirection: "column", gap: 1 }}>
              <span>{ticket.faultWindow.start}</span>
              <span style={{ color: "var(--fg3)" }}>
                <span style={{ marginRight: 4 }}>→</span>{ticket.faultWindow.end}
              </span>
            </span>
          </>}
        </div>
        <button onClick={onOpenTicket} style={{
          marginTop: 10, fontSize: 11, color: "var(--accent)",
          textDecoration: "underline", textUnderlineOffset: 2,
          background: "transparent", border: 0, padding: 0, cursor: "pointer",
        }}>← Back to ticket detail</button>
      </div>

      {/* Comments — collapsed to an icon button by default. The button
          shows the comment count and pings with a red dot when new
          comments have arrived since the user last opened the panel.
          Expanding reveals the past thread and the "Comment" affordance
          which opens the full CommentDialog modal. */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-1)" }}>
        <button type="button" onClick={openComments}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px",
            background: commentsOpen ? "var(--bg1)" : "transparent",
            border: "1px solid",
            borderColor: commentsOpen ? "var(--border-1)" : "transparent",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer", fontFamily: "inherit",
            textAlign: "left",
          }}
          onMouseEnter={(e) => { if (!commentsOpen) e.currentTarget.style.background = "var(--bg3)"; }}
          onMouseLeave={(e) => { if (!commentsOpen) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ position: "relative",
            width: 28, height: 28, borderRadius: "var(--radius-sm)",
            background: "var(--color-primary-50)",
            color: "var(--color-primary-700)",
            border: "1px solid color-mix(in oklab, var(--color-primary-500) 25%, transparent)",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <window.Ico name="comment" size={13} stroke={1.8} />
            {unread > 0 && (
              <span aria-label={`${unread} new`}
                style={{
                  position: "absolute", top: -3, right: -3,
                  minWidth: 14, height: 14, padding: "0 3px",
                  borderRadius: 999,
                  background: "var(--color-error-500)",
                  color: "var(--color-text-on-primary, #fff)",
                  fontSize: 9.5, fontWeight: 700, lineHeight: 1,
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  border: "1.5px solid var(--bg2)",
                  boxShadow: "0 0 0 0.5px color-mix(in oklab, var(--color-error-500) 50%, transparent)",
                }}>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>
              Comments
              {totalComments > 0 && (
                <span className="mono num" style={{
                  marginLeft: 6, fontSize: 11, color: "var(--fg3)", fontWeight: 400,
                }}>{totalComments}</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--fg3)" }}>
              {unread > 0
                ? <span style={{ color: "var(--color-error-700)", fontWeight: 500 }}>
                    {unread} new since you last looked
                  </span>
                : totalComments === 0
                  ? <>No comments yet — leave the first note</>
                  : <>Last from <span style={{ color: "var(--fg2)" }}>{comments[0]?.actor}</span> · <span className="mono">{comments[0]?.at}</span></>
              }
            </span>
          </span>
          <window.Ico name={commentsOpen ? "chevd" : "chevr"} size={12}
            style={{ color: "var(--fg3)", flexShrink: 0 }} />
        </button>

        {commentsOpen && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: totalComments > 0 ? 10 : 0 }}>
              <span style={{ fontSize: 10.5, color: "var(--fg3)" }}>
                as <span style={{ color: "var(--fg2)", fontWeight: 500 }}>
                  {role === "NPT" ? "Hossein Naderi" : "Maya Hassan"}
                </span>
              </span>
              <button type="button" onClick={onOpenComment} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: "var(--radius-sm)",
                background: "var(--color-primary-50)",
                color: "var(--color-primary-700)",
                border: "1px solid color-mix(in oklab, var(--color-primary-500) 35%, transparent)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit",
              }}>
                <window.Ico name="edit" size={11} stroke={1.8} />
                Comment
              </button>
            </div>
            {totalComments > 0 && (
              <ol style={{ margin: 0, padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 6,
                maxHeight: 260, overflow: "auto" }}>
                {comments.map((c, i) => {
                  const isMine = c.actor === (role === "NPT" ? "Hossein Naderi" : "Maya Hassan");
                  // Comments newer than the previously-known read count
                  // get a subtle "new" mark for a single visit.
                  const isNew = (totalComments - i) > lastReadCount;
                  const initials = (c.actor || "?")
                    .split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
                  return (
                    <li key={i} style={{ display: "flex", gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        background: isMine ? "var(--color-primary-50)" : "var(--bg3)",
                        color: isMine ? "var(--color-primary-700)" : "var(--fg2)",
                        border: "1px solid " + (isMine
                          ? "color-mix(in oklab, var(--color-primary-500) 28%, transparent)"
                          : "var(--border-1)"),
                        display: "grid", placeItems: "center",
                        fontSize: 9.5, fontWeight: 600, letterSpacing: "0.02em",
                      }}>{initials}</span>
                      <div style={{ flex: 1, minWidth: 0,
                        padding: "7px 10px",
                        background: "var(--color-bg-1)",
                        border: "1px solid",
                        borderColor: isNew && !isMine
                          ? "color-mix(in oklab, var(--color-error-500) 30%, transparent)"
                          : "var(--border-1)",
                        borderRadius: "var(--radius-sm)",
                        borderTopLeftRadius: 2,
                      }}>
                        <div style={{ display: "flex", alignItems: "baseline",
                          justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600,
                            color: isMine ? "var(--color-primary-700)" : "var(--fg1)" }}>
                            {c.actor}{isMine && <span style={{ marginLeft: 4,
                              fontSize: 9.5, color: "var(--fg3)", fontWeight: 400 }}>(you)</span>}
                            {isNew && !isMine && (
                              <span style={{ marginLeft: 6,
                                fontSize: 9, color: "var(--color-error-700)",
                                fontWeight: 700, letterSpacing: "0.05em",
                                textTransform: "uppercase",
                              }}>● new</span>
                            )}
                          </span>
                          <span className="mono" style={{ fontSize: 9.5, color: "var(--fg3)" }}>
                            {c.at}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--fg1)", lineHeight: 1.5,
                          textWrap: "pretty", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>
                          {c.body}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Action records — no longer an independent scroller; flows
          inline with the rest of the sidebar so the whole pane scrolls
          as one. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-1)",
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          position: "sticky", top: 0, zIndex: 1,
          background: "var(--bg2)",
        }}>
          <span className="overline" style={{ fontSize: 9.5 }}>
            Action records <span className="mono num">{tlLen}</span>
          </span>
          <span style={{ fontSize: 10, color: "var(--fg3)" }}>newest first</span>
        </div>
        <div style={{ padding: "10px 16px 16px" }}>
          <WBActionRecords timeline={ticket.timeline || []} />
        </div>
      </div>
    </div>
  );
}

function WBActionRecords({ timeline }) {
  const items = [...timeline].reverse();
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--fg3)" }}>No activity yet.</div>;
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none",
      display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((e, i) => {
        const isWB = e.kind === "workbench";
        const meta = isWB
          ? { color: "var(--color-primary-700)", bg: "var(--color-primary-50)",
              border: "color-mix(in oklab, var(--color-primary-500) 22%, transparent)",
              icon: "bolt" }
          : e.kind === "escalation"
          ? { color: "var(--color-warning-700)", bg: "var(--warning-bg)",
              border: "color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
              icon: "upload" }
          : e.kind === "resolution"
          ? { color: "var(--color-success-700)", bg: "oklch(96% 0.03 152)",
              border: "color-mix(in oklab, var(--color-success-500) 22%, transparent)",
              icon: "check" }
          : { color: "var(--fg2)", bg: "var(--bg3)",
              border: "var(--color-border-subtle)",
              icon: e.kind === "ai" ? "shield" : e.kind === "comment" ? "edit" : "plus" };
        return (
          <li key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              background: meta.bg, color: meta.color,
              display: "grid", placeItems: "center",
              border: `1px solid ${meta.border}`,
            }}><window.Ico name={meta.icon} size={9} stroke={1.8} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: "var(--fg1)", lineHeight: 1.4,
                textWrap: "pretty", overflowWrap: "break-word" }}>{e.note}</div>
              <div style={{ marginTop: 2, fontSize: 10, color: "var(--fg3)",
                display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="mono">{e.at}</span><span>· {e.actor}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}


// ─── Shared atoms ──────────────────────────────────────────
// Dark-on-dark chip-style button (used inside terminal-style consoles).
const wbStreamBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "3px 9px", borderRadius: "var(--radius-sm)",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.10)",
  color: "oklch(85% 0.005 240)",
  fontSize: 10.5, fontWeight: 500, cursor: "pointer",
  fontFamily: "var(--font-family-sans)",
};

function WBButton({ icon, children, onClick, danger, primary, disabled }) {
  const bg = disabled ? "var(--bg2)"
           : danger ? "var(--error-bg)"
           : primary ? "var(--color-primary-50)"
                     : "var(--bg2)";
  const fg = disabled ? "var(--fg3)"
           : danger ? "var(--color-error-700)"
           : primary ? "var(--color-primary-700)"
                     : "var(--fg1)";
  const border = disabled ? "var(--border-1)"
               : danger ? "color-mix(in oklab, var(--color-error-500) 22%, transparent)"
               : primary ? "color-mix(in oklab, var(--color-primary-500) 22%, transparent)"
                         : "var(--border-1)";
  return (
    <button onClick={disabled ? null : onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: "var(--radius-sm)",
        background: bg, color: fg,
        border: `1px solid ${border}`,
        fontSize: 12, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "inherit",
      }}>
      {icon && <window.Ico name={icon} size={12} stroke={1.8} />}
      {children}
    </button>
  );
}

function WBKvTable({ rows }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "130px minmax(0, 1fr)",
      rowGap: 6, columnGap: 14, fontSize: 12,
    }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span style={{
            color: "var(--fg3)", fontSize: 10.5,
            letterSpacing: "0.04em", textTransform: "uppercase",
            paddingTop: 1,
          }}>{k}</span>
          <span style={{
            color: "var(--fg1)", minWidth: 0,
            overflowWrap: "break-word",
          }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Tool: Hardware diagnostic ────────────────────────────
// Two flows: automatic (read-only telemetry the device collects on its
// own) and manual (interactive — operator at the device taps things to
// confirm working). Manual extends automatic with five tap-confirm
// rows so we can demo the assisted flow.
//
// Mode picker → "Start probe" → device "reports back" 1.4 s later
// (snake-streamed lines, ASCII feel) → final structured report
// rendered as labelled sections.

const DIAG_AUTO_REPORT = {
  basic: {
    label: "Basic",
    rows: [
      ["Model",            "N950S-C"],
      ["Serial number",    "NEC400084496"],
      ["Firmware",         "D1.0.04"],
      ["Test time (UTC)",  "2026-04-25 08:25:48"],
    ],
  },
  network: {
    label: "Network",
    rows: [
      ["Wi-Fi",       { ok: true,  text: "Enabled · connected" }],
      ["Mobile data", { ok: true,  text: "Enabled · China Telecom (SIM1) · baseband OK" }],
      ["Ethernet",    { ok: false, neutral: true, text: "Present but disabled" }],
      ["Bluetooth",   { ok: false, neutral: true, text: "Disabled" }],
    ],
  },
  hardware: {
    label: "Hardware modules",
    rows: [
      ["Printer",      { warn: true,  text: "Present · low paper · 465 mm printed" }],
      ["Magstripe",    { ok: true,  text: "Present" }],
      ["IC reader",    { ok: true,  text: "Present" }],
      ["NFC reader",   { ok: true,  text: "Present" }],
      ["Scanner",      { ok: true,  text: "Present" }],
      ["Camera",       { ok: true,  text: "Present · 1 module" }],
      ["LED",          { absent: true, text: "Not present" }],
      ["Battery",      { absent: true, text: "Not present · line-powered" }],
    ],
  },
  resources: {
    label: "System resources",
    rows: [
      ["Storage",  { meterPct: 39, text: "6.27 GB used of 16 GB · 39 %" }],
      ["Memory",   { meterPct: 51, text: "1.01 GB used of 2 GB · 51 %" }],
      ["Display",  "Brightness 27 % · 1 screen · never sleeps"],
    ],
  },
  security: {
    label: "Security & keys",
    rows: [
      ["Secure key area",  { fail: true, text: "Present · API call failed (NAPI_SecGetSymmKeyNum ret -1309)" }],
      ["Payment cert",     { ok: true,  text: "OK · NPTTestDeptAppCA chain valid" }],
      ["MTMS cert",        { ok: true,  text: "OK" }],
    ],
  },
  other: {
    label: "Other",
    rows: [
      ["Boot time",       "2026-04-25 07:22:17 · uptime ~27 min"],
      ["Tamper trigger",  { ok: true, text: "None" }],
      ["Production unit", { warn: true, text: "No — test / engineering unit" }],
    ],
  },
};

// Five tap-confirm rows for manual flow.
const DIAG_MANUAL_TASKS = [
  { id: "touch",   label: "Screen touch test",         seed: { ok: true, text: "Passed · 1 attempt" } },
  { id: "speaker", label: "Speaker audio playback",    seed: { ok: true, text: "Passed · 1 attempt" } },
  { id: "led",     label: "LED test",                  seed: { absent: true, text: "Module not present — skipped" } },
  { id: "printer", label: "Printer test",              seed: { absent: true, text: "Module not present — skipped" } },
  { id: "magstripe", label: "Magstripe test",          seed: { pending: true } },
  { id: "nfc",     label: "Contactless (RF) test",     seed: { pending: true } },
  { id: "ic",      label: "IC card test",              seed: { pending: true } },
  { id: "scanner", label: "Dock scanner test",         seed: { ok: true, text: "Passed · 1 attempt" } },
  { id: "camera",  label: "Camera test",               seed: { ok: true, text: "Passed · 2 attempts" } },
];

function HardwareDiagTool({ ticket, device, logAction }) {
  const [mode, setMode] = useStateW("auto"); // auto | manual
  const [state, setState] = useStateW("idle"); // idle | streaming | done
  const [streamLines, setStreamLines] = useStateW([]);
  const [manualRows, setManualRows] = useStateW(DIAG_MANUAL_TASKS.map(t => ({ ...t, status: t.seed })));
  const streamRef = useRefW(null);

  const start = () => {
    setState("streaming");
    setStreamLines([]);
    logAction({ tool: "DIAG", label: `${mode === "auto" ? "Automatic" : "Manual"} diagnostic started`, tone: "neutral" });
    const script = mode === "auto" ? AUTO_STREAM : MANUAL_STREAM;
    script.forEach((line, i) => {
      setTimeout(() => {
        setStreamLines(prev => [...prev, line]);
        if (i === script.length - 1) {
          setTimeout(() => {
            setState("done");
            logAction({ tool: "DIAG", label: `${mode === "auto" ? "Auto" : "Manual"} report received`, tone: "ok",
              detail: mode === "auto" ? "27 fields" : "+ 9 manual checks" });
          }, 250);
        }
      }, 120 * i);
    });
  };
  // Autoscroll the streaming console.
  useEffectW(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [streamLines]);

  const reset = () => {
    setState("idle"); setStreamLines([]);
    setManualRows(DIAG_MANUAL_TASKS.map(t => ({ ...t, status: t.seed })));
  };

  const markManual = (id, kind) => {
    setManualRows(prev => prev.map(r => r.id === id ? {
      ...r, status: kind === "pass" ? { ok: true, text: "Passed · operator confirmed" }
                   : kind === "fail" ? { fail: true, text: "Failed · operator reported issue" }
                                      : { absent: true, text: "Skipped" },
    } : r));
    logAction({ tool: "DIAG", label: `Manual · ${DIAG_MANUAL_TASKS.find(t => t.id === id).label} → ${kind}`,
      tone: kind === "pass" ? "ok" : kind === "fail" ? "err" : "neutral" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Mode picker */}
      <div style={{
        padding: "12px 14px",
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <span className="overline" style={{ fontSize: 10 }}>Diagnostic type</span>
        <div style={{ display: "inline-flex", padding: 3, gap: 2,
          background: "var(--bg3)", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-1)" }}>
          {[
            { id: "auto", label: "Automatic", blurb: "Read-only. Device collects the report itself — no operator needed." },
            { id: "manual", label: "Manual (with operator)", blurb: "Operator at device taps to confirm touch / printer / cards / camera." },
          ].map(opt => {
            const on = mode === opt.id;
            return (
              <button key={opt.id} onClick={() => mode !== opt.id && state === "idle" && setMode(opt.id)}
                disabled={state !== "idle"}
                style={{
                  padding: "5px 12px", borderRadius: "var(--radius-sm)",
                  background: on ? "var(--bg2)" : "transparent",
                  color: on ? "var(--fg1)" : "var(--fg2)",
                  border: on ? "1px solid var(--border-1)" : "1px solid transparent",
                  boxShadow: on ? "var(--shadow-1)" : "none",
                  fontSize: 12, fontWeight: on ? 500 : 400,
                  cursor: state === "idle" ? "pointer" : "default",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 260, fontSize: 11.5, color: "var(--fg3)", lineHeight: 1.55 }}>
          {mode === "auto"
            ? "Device runs the probe itself and returns a structured report. No on-site participation required."
            : "Adds 9 interactive checks. You need the cashier or technician at the terminal to tap & confirm each test."}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {state !== "idle" && (
            <WBButton icon="refresh" onClick={reset}>Reset</WBButton>
          )}
          <WBButton primary icon="bolt" disabled={state === "streaming"}
            onClick={start}>
            {state === "done" ? "Re-run" : state === "streaming" ? "Probing…" : "Start probe"}
          </WBButton>
        </div>
      </div>

      {/* Streaming console */}
      {state !== "idle" && (
        <div style={{
          background: "oklch(13% 0.01 250)",
          border: "1px solid oklch(22% 0.01 250)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "6px 12px",
            background: "oklch(17% 0.01 250)",
            borderBottom: "1px solid oklch(22% 0.01 250)",
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "var(--font-family-mono)", fontSize: 11,
            color: "oklch(75% 0.04 250)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: state === "streaming" ? "oklch(78% 0.16 75)" : "oklch(70% 0.20 152)",
              animation: state === "streaming" ? "wbPulse 1s ease-in-out infinite" : "none",
              boxShadow: state === "streaming" ? "none" : "0 0 0 3px oklch(70% 0.20 152 / 0.20)",
            }} />
            <span style={{ letterSpacing: "0.04em", textTransform: "uppercase", color: "oklch(96% 0.005 240)" }}>
              {state === "streaming" ? "Awaiting device response…" : "Report received"}
            </span>
            <span style={{ marginLeft: "auto", color: "oklch(55% 0.02 240)" }}>
              {ticket.deviceSn}
            </span>
          </div>
          <div ref={streamRef} style={{
            maxHeight: 240, overflow: "auto",
            fontFamily: "var(--font-family-mono)", fontSize: 11.5, lineHeight: 1.55,
            padding: "10px 14px",
            color: "oklch(88% 0.005 240)",
          }}>
            {streamLines.map((l, i) => (
              <div key={i} style={{
                display: "flex", gap: 8,
                color: l.startsWith("ERR") ? "oklch(85% 0.10 25)"
                     : l.startsWith("WARN") ? "oklch(85% 0.12 75)"
                     : l.startsWith(">>>") ? "oklch(85% 0.12 200)"
                                              : "oklch(82% 0.005 240)",
              }}>
                <span style={{ color: "oklch(55% 0.02 240)", minWidth: 80,
                  whiteSpace: "nowrap" }}>[{nowStamp(-30 + i * 0.5)}]</span>
                <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{l}</span>
              </div>
            ))}
            {state === "streaming" && (
              <span style={{ display: "inline-block",
                width: 7, height: 13, marginLeft: 4, background: "oklch(70% 0.20 152)",
                animation: "wbBlink 1s steps(2) infinite",
                verticalAlign: "middle",
              }} />
            )}
          </div>
          <style>{`@keyframes wbBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
        </div>
      )}

      {/* Structured report */}
      {state === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.entries(DIAG_AUTO_REPORT).map(([key, section]) => (
            <DiagSection key={key} title={section.label} rows={section.rows} />
          ))}
          {mode === "manual" && (
            <ManualSection rows={manualRows} onMark={markManual} />
          )}
        </div>
      )}

      {state === "idle" && (
        <div style={{
          padding: "20px 16px", textAlign: "center",
          background: "var(--bg2)",
          border: "1px dashed var(--color-border-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: 12.5, color: "var(--fg3)", lineHeight: 1.6,
        }}>
          Pick a diagnostic type above and press <b style={{ color: "var(--fg2)" }}>Start probe</b>.
          The device will run the checks and return a structured report.
        </div>
      )}
    </div>
  );
}

const AUTO_STREAM = [
  ">>> diag.start mode=auto",
  "→ reading device identity",
  "→ probing radio chain · wifi · cellular · ethernet · bluetooth",
  "→ enumerating hardware modules",
  "→ reading storage & memory",
  "→ reading display state",
  "→ checking secure key area",
  "WARN secure key area · NAPI_SecGetSymmKeyNum ret -1309",
  "→ validating payment cert chain",
  "→ validating MTMS cert",
  "→ collecting uptime + tamper history",
  "→ packaging report (27 fields)",
  "<<< diag.done · uploading to cloud",
];

const MANUAL_STREAM = [
  ">>> diag.start mode=manual",
  "→ auto-collecting non-interactive fields",
  "→ secure key check · NAPI_SecGetSymmKeyNum ret -1309",
  "WARN secure key area inaccessible",
  "→ awaiting operator participation",
  "→ on-screen wizard pushed to device",
  "→ touch test passed",
  "→ speaker test passed",
  "→ scanner test passed",
  "→ camera test passed",
  "<<< diag.done · awaiting magstripe/IC/NFC confirmation",
];

function DiagSection({ title, rows }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 14px",
        background: "var(--bg3)",
        borderBottom: "1px solid var(--border-1)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span className="overline" style={{ fontSize: 10.5 }}>{title}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--fg3)",
          fontFamily: "var(--font-family-mono)" }}>{rows.length} fields</span>
      </div>
      <div style={{ padding: "12px 14px",
        maxHeight: 420, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {rows.map(([k, v], i) => (
              <tr key={i} style={{
                borderBottom: i < rows.length - 1 ? "1px dashed var(--color-border-subtle)" : "none",
              }}>
                <td style={{ padding: "7px 0", width: 160, color: "var(--fg3)",
                  fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase",
                  verticalAlign: "top" }}>{k}</td>
                <td style={{ padding: "7px 0", color: "var(--fg1)" }}>
                  <DiagValue value={v} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManualSection({ rows, onMark }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 14px",
        background: "var(--bg3)",
        borderBottom: "1px solid var(--border-1)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span className="overline" style={{ fontSize: 10.5 }}>Manual checks</span>
        <span style={{ fontSize: 10.5, color: "var(--fg3)" }}>
          operator at device confirms each step
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--fg3)",
          fontFamily: "var(--font-family-mono)" }}>{rows.length} checks</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {rows.map((r, i) => (
          <li key={r.id} style={{
            display: "grid",
            gridTemplateColumns: "180px minmax(0, 1fr) auto",
            gap: 12, alignItems: "center",
            padding: "9px 14px",
            borderBottom: i < rows.length - 1 ? "1px dashed var(--color-border-subtle)" : "none",
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>{r.label}</span>
            <DiagValue value={r.status} />
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => onMark(r.id, "pass")}  style={miniBtn("ok")} title="Pass">
                <window.Ico name="check" size={11} stroke={2.4} />
              </button>
              <button onClick={() => onMark(r.id, "fail")}  style={miniBtn("err")} title="Fail">
                <window.Ico name="x" size={11} stroke={2.4} />
              </button>
              <button onClick={() => onMark(r.id, "skip")}  style={miniBtn("neutral")} title="Skip">
                <window.Ico name="chevr" size={11} stroke={2} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function miniBtn(tone) {
  const color = tone === "ok"  ? "var(--color-success-700)"
              : tone === "err" ? "var(--color-error-700)"
                                 : "var(--fg3)";
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, borderRadius: "var(--radius-sm)",
    background: "var(--bg2)", border: "1px solid var(--border-1)",
    color, cursor: "pointer",
  };
}

function DiagValue({ value }) {
  if (typeof value === "string") {
    return <span style={{ fontSize: 12.5, color: "var(--fg1)" }}>{value}</span>;
  }
  if (!value) return <span style={{ color: "var(--fg3)" }}>—</span>;
  if (value.pending) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--fg3)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--border-2)" }} />
        Awaiting operator
      </span>
    );
  }
  if (value.absent) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--fg3)" }}>
        <window.Ico name="x" size={11} stroke={1.8} />
        {value.text}
      </span>
    );
  }
  if (value.fail) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--color-error-700)", fontWeight: 500 }}>
        <window.Ico name="alert" size={11} stroke={2} />
        {value.text}
      </span>
    );
  }
  if (value.warn) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--color-warning-700)", fontWeight: 500 }}>
        <window.Ico name="alert" size={11} stroke={2} />
        {value.text}
      </span>
    );
  }
  if (value.neutral) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--fg2)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--border-2)" }} />
        {value.text}
      </span>
    );
  }
  if (value.meterPct != null) {
    const tone = value.meterPct > 85 ? "var(--color-warning-500)"
              : value.meterPct > 70 ? "var(--color-warning-500)"
                                     : "var(--color-primary-500)";
    return (
      <div style={{ minWidth: 0, width: "100%" }}>
        <div style={{ fontSize: 12, color: "var(--fg1)" }}>{value.text}</div>
        <div style={{ marginTop: 4, height: 4, borderRadius: 999, background: "var(--color-bg-3)",
          overflow: "hidden", maxWidth: 260 }}>
          <div style={{ width: `${Math.min(100, value.meterPct)}%`, height: "100%", background: tone }} />
        </div>
      </div>
    );
  }
  if (value.ok) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, color: "var(--color-success-700)" }}>
        <window.Ico name="check" size={11} stroke={2.4} />
        {value.text}
      </span>
    );
  }
  return <span style={{ color: "var(--fg2)", fontSize: 12 }}>{JSON.stringify(value)}</span>;
}

// ─── Placeholder tools (will be replaced one by one) ───────
function HardwareDiagTool_OLD() { return null; }
// ─── Trouble tab (log-centric) ────────────────────────────
// Trouble log fills the surface; the bottom dock keeps terminal
// snapshot + screenshot evidence one click away. A DiagnosticCard
// rides on top showing fault-code KB lookup, payment metadata, or
// the operator's manual description — whichever the ticket carries.
function TroubleTab({ ticket, device, logAction }) {
  const logs = useMemoW(
    () => (ticket.attachments || []).filter(a => a.kind === "log"),
    [ticket.id]);
  const shots = useMemoW(
    () => (ticket.attachments || []).filter(a => a.kind === "screenshot"),
    [ticket.id]);
  const attachments = shots;
  const [openPreview, setOpenPreview] = useStateW(null);
  const origin = (window.ticketOrigin || (() => "manual"))(ticket);

  // Focus-log mode: hides DiagnosticCard + dock so the log viewer gets the
  // whole surface. Persisted per-ticket in sessionStorage so it survives
  // tab switches inside the same browser window without leaking across
  // tickets (each ticket re-enters with full context by default).
  const focusKey = "wb.trouble.focus." + ticket.id;
  const [focus, setFocus] = useStateW(() => {
    try { return sessionStorage.getItem(focusKey) === "1"; } catch { return false; }
  });
  useEffectW(() => {
    try { sessionStorage.setItem(focusKey, focus ? "1" : "0"); } catch {}
  }, [focus, focusKey]);

  // One scroll container for the whole Trouble surface — DiagnosticCard,
  // log viewer, and dock all flow inside it. The chip bar at the bottom of
  // the log viewer uses sticky positioning so it follows the operator as
  // they scroll deep into the logs.
  const scrollRef = useRefW(null);
  return (
    <div ref={scrollRef} style={{
      flex: 1, minHeight: 0,
      overflow: "auto", position: "relative",
      display: "flex", flexDirection: "column",
      background: "var(--color-bg-1)",
    }}>
      {!focus && <DiagnosticCard ticket={ticket} origin={origin} />}
      {!focus && (
        <TroubleContextDock ticket={ticket} device={device} origin={origin}
          attachments={attachments}
          onOpenAttachment={(a) => setOpenPreview(a)} />
      )}
      <div style={{ background: "oklch(12% 0.01 250)",
        flex: focus ? 1 : "0 0 auto",
        display: "flex", flexDirection: "column", minHeight: 0 }}>
        {logs.length > 0
          ? <TroubleLogViewer ticket={ticket} scrollRef={scrollRef}
              focus={focus} onToggleFocus={() => setFocus(v => !v)} />
          : <div style={{ padding: "60px 16px", textAlign: "center",
              color: "oklch(60% 0.02 240)", fontSize: 12.5 }}>
              No log attached to this ticket.
            </div>
        }
      </div>
      <WBAttachmentModal attachment={openPreview} ticket={ticket}
        onClose={() => setOpenPreview(null)} />
    </div>
  );
}

// Bottom dock for the Trouble tab. Two switchable panes:
//   • Snapshot — terminal state frozen when the ticket fired.
//   • Evidence — the screenshots + log files attached on the ticket.
function TroubleContextDock({ ticket, device, origin, attachments, onOpenAttachment }) {
  // Terminal snapshot is the default landing for every ticket — operator's
  // most reliable starting point regardless of origin. Screenshots tab is
  // hidden entirely when nothing is attached.
  const [dockTab, setDockTab] = useStateW("snapshot"); // snapshot | evidence
  const snap = useMemoW(() => {
    if (!device || typeof window.buildSnapshotFor !== "function") return null;
    return window.buildSnapshotFor(device, ticket.snapshotOverride || {});
  }, [ticket.id, device?.sn]);
  return (
    <div style={{
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "var(--bg2)",
      borderBottom: "1px solid var(--border-1)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "0 12px",
        background: "var(--bg3)",
        borderBottom: "1px solid var(--border-1)",
      }}>
        {[
          { id: "snapshot", label: "Terminal snapshot",
            count: snap ? "frozen · " + (snap.capturedAt || ticket.createdAt) : "—",
            icon: "device" },
          ...(attachments.length > 0 ? [{
            id: "evidence", label: "Screenshots",
            count: attachments.length, icon: "image",
          }] : []),
        ].map(opt => {
          const on = dockTab === opt.id;
          return (
            <button key={opt.id} onClick={() => setDockTab(opt.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 12px",
                background: "transparent", border: 0,
                borderBottom: on ? "2px solid var(--color-primary-600)" : "2px solid transparent",
                marginBottom: -1,
                color: on ? "var(--color-primary-700)" : "var(--fg2)",
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              <window.Ico name={opt.icon} size={11} stroke={1.8} />
              {opt.label}
              <span className="mono" style={{
                fontSize: 9.5, fontWeight: 500,
                padding: "1px 6px", borderRadius: 999,
                background: on ? "var(--color-primary-50)" : "var(--bg2)",
                color: on ? "var(--color-primary-700)" : "var(--fg3)",
                border: "1px solid " + (on
                  ? "color-mix(in oklab, var(--color-primary-500) 22%, transparent)"
                  : "var(--border-1)"),
              }}>{opt.count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: "12px 14px" }}>
        {dockTab === "snapshot" && (
          snap
            ? <UploadedSnapshotTables snap={snap} device={device} />
            : <Empty>No snapshot — source device no longer in fleet.</Empty>
        )}
        {dockTab === "evidence" && (
          attachments.length === 0
            ? <Empty>No screenshots attached to this ticket.</Empty>
            : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {attachments.map((a, i) => (
                  <AttachmentTile key={a.name + i} attachment={a}
                    onClick={() => onOpenAttachment(a)} />
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}

// ─── Diagnostic card (top of Trouble tab) ─────────────────
// Three forms keyed off ticket.origin:
//   payment-exception → fault code (KB lookup) + Tx ref + context strip
//                       + merchant note
//   device-exception  → fault code (KB lookup) + component context
//                       + (optional) merchant note
//   manual            → reporter + description + fault window chip
// KB unmatched → card renders without the KB block (still shows
// identity / description); we don't degrade the card to nothing
// because the metadata is still useful.
function DiagnosticCard({ ticket, origin }) {
  const payment = ticket.paymentReport;
  const device  = ticket.deviceReport;
  const code    = payment?.errorCode || device?.faultCode || null;
  const kb      = window.faultCodeLookup ? window.faultCodeLookup(code) : null;
  if (origin === "manual") {
    return <ManualDiagnostic ticket={ticket} />;
  }
  if (origin === "payment-exception" && payment) {
    return <PaymentDiagnostic ticket={ticket} payment={payment} kb={kb} />;
  }
  if (origin === "device-exception" && device) {
    return <DeviceDiagnostic ticket={ticket} device={device} kb={kb} />;
  }
  // Fallback — auto ticket without structured report.
  return <ManualDiagnostic ticket={ticket} />;
}

// Shared chrome: tinted bar at the top of Trouble Tab, max ~ 200px.
function DiagnosticShell({ tone, originBadge, severity, title, subtitle,
  children, footer }) {
  const accent = tone === "danger" ? "var(--color-error-500)"
              : tone === "warning" ? "var(--color-warning-500)"
              : tone === "info"    ? "var(--color-info-500)"
                                    : "var(--color-primary-500)";
  return (
    <div style={{
      flexShrink: 0,
      borderBottom: "1px solid var(--border-1)",
      background: "var(--bg2)",
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "4px minmax(0, 1fr)",
      }}>
        <div style={{ background: accent }} />
        <div style={{ padding: "12px 18px",
          display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            flexWrap: "wrap" }}>
            <span style={{
              padding: "1px 8px", borderRadius: 999,
              background: `color-mix(in oklab, ${accent} 14%, transparent)`,
              color: `color-mix(in oklab, ${accent} 80%, var(--fg1))`,
              fontSize: 9.5, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "var(--font-family-mono)",
            }}>{originBadge}</span>
            {severity && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 10.5, color: "var(--fg3)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%",
                  background: accent }} />
                {severity}
              </span>
            )}
            <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600,
              letterSpacing: "-0.01em", color: "var(--fg1)", textWrap: "balance" }}>
              {title}
            </h2>
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--fg2)", lineHeight: 1.5,
              textWrap: "pretty" }}>{subtitle}</div>
          )}
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

// Copyable chip — used for MID/TID/Tx Ref/Error Code etc.
function CopyChip({ label, value, mono = true, tone = "default" }) {
  if (value === undefined || value === null || value === "") return null;
  const tinted = tone === "error"
    ? { bg: "var(--error-bg)", fg: "var(--color-error-700)",
        border: "color-mix(in oklab, var(--color-error-500) 22%, transparent)" }
    : { bg: "var(--bg3)", fg: "var(--fg1)", border: "var(--border-1)" };
  const onCopy = (e) => {
    e.stopPropagation();
    try { navigator.clipboard?.writeText(String(value)); } catch {}
    window.showToast?.(`Copied ${label}`, "info");
  };
  return (
    <button type="button" onClick={onCopy} title={`Copy ${label}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "2px 8px", borderRadius: 999,
        background: tinted.bg,
        color: tinted.fg,
        border: `1px solid ${tinted.border}`,
        fontSize: 11, fontFamily: "inherit",
        cursor: "pointer",
      }}>
      <span style={{ fontSize: 9.5, color: "var(--fg3)",
        letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        fontWeight: 500,
        fontSize: 11.5,
      }}>{value}</span>
      <window.Ico name="copy" size={10} stroke={1.8}
        style={{ color: "var(--fg3)" }} />
    </button>
  );
}

// Window range chip — read-only.
function WindowChip({ start, end }) {
  if (!start && !end) return null;
  const fmt = (s) => {
    if (!s) return "—";
    // human format "May 15, 2026 14:32:08" → "14:32" or full
    const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return m ? `${m[1]}:${m[2]}` : s;
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999,
      background: "var(--bg3)", border: "1px solid var(--border-1)",
      fontSize: 10.5, color: "var(--fg2)",
      fontFamily: "var(--font-family-mono)",
    }}>
      <window.Ico name="history" size={10} stroke={1.8}
        style={{ color: "var(--fg3)" }} />
      Window: {fmt(start)}–{fmt(end)}
    </span>
  );
}

// Fault-code KB block — shared by Payment + Device.
function KBLookupBlock({ kb, code }) {
  if (!kb) return null;
  const accent = kb.severity === "critical" ? "var(--color-error-500)"
              : kb.severity === "warning"  ? "var(--color-warning-500)"
                                            : "var(--color-info-500)";
  return (
    <div style={{
      borderRadius: "var(--radius-md)",
      background: "var(--bg1)",
      border: "1px solid var(--border-1)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px",
        background: `color-mix(in oklab, ${accent} 8%, transparent)`,
        borderBottom: `1px solid color-mix(in oklab, ${accent} 22%, transparent)`,
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <window.Ico name="alert" size={12} stroke={1.8}
          style={{ color: accent }} />
        <span style={{ fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: `color-mix(in oklab, ${accent} 70%, var(--fg1))` }}>
          Diagnosis
        </span>
        <span style={{ fontSize: 11.5, color: "var(--fg2)",
          textWrap: "pretty" }}>{kb.shortMessage}</span>
      </div>
      <div style={{ padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--fg1)", lineHeight: 1.55,
          textWrap: "pretty" }}>
          <b style={{ color: "var(--fg2)", marginRight: 4 }}>Likely cause —</b>
          {kb.likelyCause}
        </div>
        {Array.isArray(kb.recommendedSteps) && kb.recommendedSteps.length > 0 && (
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 5 }}>
            {kb.recommendedSteps.map((s, i) => (
              <li key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                fontSize: 11.5, color: "var(--fg1)", lineHeight: 1.5,
                textWrap: "pretty",
              }}>
                <span style={{
                  flexShrink: 0,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "var(--bg3)", color: "var(--fg2)",
                  display: "grid", placeItems: "center",
                  fontSize: 9.5, fontWeight: 600,
                  fontFamily: "var(--font-family-mono)",
                  border: "1px solid var(--border-1)",
                }}>{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// Payment exception — full identity context + error block + merchant note.
function PaymentDiagnostic({ ticket, payment, kb }) {
  const merchant = window.findMerchantById?.(
    window.findDeviceBySn?.(ticket.deviceSn)?.merchantId);
  const appOutdated = payment.latestAppVersion
    && payment.appVersion !== payment.latestAppVersion;
  const kernelOutdated = payment.latestKernelVersion
    && payment.emvKernelVersion !== payment.latestKernelVersion;
  return (
    <DiagnosticShell
      tone={kb?.severity === "critical" ? "danger"
          : kb?.severity === "warning"  ? "warning"
                                         : "info"}
      originBadge={(ticket.type || "Payment").toUpperCase()}
      severity={kb?.severity ? kb.severity.toUpperCase() : null}
      title={payment.errorCode
        ? `Error ${payment.errorCode} · ${payment.errorMessage || ""}`
        : "Payment exception"}
      subtitle={merchant && (
        <span>
          {merchant.name} · operator-side report at <span className="mono">{ticket.createdAt}</span>
        </span>
      )}>
      {/* Identity / Tx ref */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <CopyChip label="Tx Ref" value={payment.transactionRefNo} tone="error" />
        <CopyChip label="MID"    value={payment.mid} />
        <CopyChip label="TID"    value={payment.tid} />
        <WindowChip start={ticket.faultWindow?.start} end={ticket.faultWindow?.end} />
      </div>
      {/* KB lookup */}
      <KBLookupBlock kb={kb} code={payment.errorCode} />
      {/* Context strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6,
        fontSize: 10.5, color: "var(--fg2)" }}>
        <ContextChip label="App"   value={payment.appVersion}
          warn={appOutdated} warnHint={`latest ${payment.latestAppVersion}`} />
        <ContextChip label="Android" value={payment.androidVersion} />
        <ContextChip label="EMV Kernel" value={payment.emvKernelVersion}
          warn={kernelOutdated} warnHint={`latest ${payment.latestKernelVersion}`} />
        <ContextChip label="Processor" value={payment.processor} />
        <ContextChip label="Net" value={payment.networkState} />
      </div>
      {/* Merchant note */}
      {payment.merchantNote && <MerchantNoteRow note={payment.merchantNote} />}
    </DiagnosticShell>
  );
}

// Device exception — fault-code KB + component context.
function DeviceDiagnostic({ ticket, device, kb }) {
  const merchant = window.findMerchantById?.(
    window.findDeviceBySn?.(ticket.deviceSn)?.merchantId);
  return (
    <DiagnosticShell
      tone={kb?.severity === "critical" ? "danger"
          : kb?.severity === "warning"  ? "warning"
                                         : "info"}
      originBadge={`${(ticket.type || "Device").toUpperCase()}${device.component ? ` · ${device.component}` : ""}`}
      severity={kb?.severity ? kb.severity.toUpperCase() : null}
      title={device.faultMessage || ticket.title}
      subtitle={merchant && (
        <span>
          {merchant.name} · pushed from device at <span className="mono">{ticket.createdAt}</span>
        </span>
      )}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {device.faultCode && (
          <CopyChip label="Fault Code" value={device.faultCode} tone="error" />
        )}
        <CopyChip label="MID" value={device.mid} />
        <CopyChip label="TID" value={device.tid} />
        <WindowChip start={ticket.faultWindow?.start} end={ticket.faultWindow?.end} />
      </div>
      <KBLookupBlock kb={kb} code={device.faultCode} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <ContextChip label="Component" value={device.component} />
        <ContextChip label="App"     value={device.appVersion} />
        <ContextChip label="Android" value={device.androidVersion} />
        <ContextChip label="Net"     value={device.networkState} />
      </div>
    </DiagnosticShell>
  );
}

// Manual ticket — operator description + reporter + window chip.
function ManualDiagnostic({ ticket }) {
  const merchant = window.findMerchantById?.(
    window.findDeviceBySn?.(ticket.deviceSn)?.merchantId);
  return (
    <DiagnosticShell tone="info" originBadge="MANUAL TICKET"
      severity={null}
      title={ticket.title}
      subtitle={
        <span>
          Logged by <b style={{ color: "var(--fg1)" }}>{ticket.createdBy}</b>
          {merchant && <> · {merchant.name}</>}
          {" · "}<span className="mono">{ticket.createdAt}</span>
        </span>
      }>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <WindowChip start={ticket.faultWindow?.start} end={ticket.faultWindow?.end} />
        <span style={{
          padding: "2px 8px", borderRadius: 999,
          background: "var(--bg3)", border: "1px solid var(--border-1)",
          fontSize: 10.5, color: "var(--fg2)",
        }}>
          Log auto-pulled · see viewer below
        </span>
      </div>
      {ticket.description && (
        <div style={{
          padding: "8px 12px",
          background: "var(--bg1)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-sm)",
          fontSize: 12, color: "var(--fg1)",
          lineHeight: 1.55, textWrap: "pretty",
          maxHeight: 80, overflow: "auto",
        }}>{ticket.description}</div>
      )}
    </DiagnosticShell>
  );
}

// Small read-only chip used by both Payment + Device context strips.
function ContextChip({ label, value, warn, warnHint }) {
  if (!value) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 8px", borderRadius: 999,
      background: warn ? "var(--warning-bg)" : "var(--bg3)",
      color: warn ? "var(--color-warning-700)" : "var(--fg2)",
      border: "1px solid " + (warn
        ? "color-mix(in oklab, var(--color-warning-500) 25%, transparent)"
        : "var(--border-1)"),
      fontSize: 10.5,
    }}>
      <span style={{ fontSize: 9.5, color: warn ? "var(--color-warning-700)" : "var(--fg3)",
        letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <span className="mono" style={{ fontWeight: 500 }}>{value}</span>
      {warn && warnHint && (
        <span style={{ fontSize: 9.5, opacity: 0.85 }} title={warnHint}>· {warnHint}</span>
      )}
    </span>
  );
}

function MerchantNoteRow({ note }) {
  return (
    <div style={{
      padding: "8px 12px",
      background: "color-mix(in oklab, var(--color-primary-500) 5%, var(--bg1))",
      borderLeft: "3px solid var(--color-primary-500)",
      borderRadius: "var(--radius-sm)",
      fontSize: 12, color: "var(--fg1)",
      lineHeight: 1.55, textWrap: "pretty",
      fontStyle: "italic",
    }}>
      <span style={{ fontStyle: "normal", color: "var(--color-primary-700)",
        fontWeight: 600, marginRight: 6, fontSize: 10.5,
        letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Merchant note
      </span>
      "{note}"
    </div>
  );
}

// ─── Monitoring tab (live device snapshot) ────────────────
// Reuses DeviceMonitoringTab from devices.jsx — same content as
// Devices → Detail → Monitoring (security/uptime, network, system,
// SIM traffic, etc). The tool row above (WBActionBar) is owned by
// WorkbenchScreen and stays in place.
function MonitoringTab({ ticket, device, logAction }) {
  if (!device) {
    return (
      <div style={{ flex: 1, overflow: "auto",
        padding: "var(--space-4) var(--space-5) var(--space-6)" }}>
        <WBSectionCard title="Device snapshot">
          <Empty>No snapshot — source device no longer in fleet.</Empty>
        </WBSectionCard>
      </div>
    );
  }
  const Body = window.DeviceMonitoringTab;
  return (
    <div style={{ flex: 1, overflow: "auto",
      padding: "var(--space-4) var(--space-5) var(--space-6)" }}>
      {Body ? <Body device={device} ticket={ticket} />
            : <WBSectionCard title="Device snapshot"><Empty>Monitoring component not available.</Empty></WBSectionCard>}
    </div>
  );
}

function UploadedSnapshotTables({ snap, device }) {
  if (!snap || !device) {
    return <WBSectionCard title="Device snapshot"><Empty>No snapshot — source device no longer in fleet.</Empty></WBSectionCard>;
  }
  const r = snap.runtime;
  return (
    <div style={{ display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      <WBSectionCard title="Runtime">
        <WBKvTable rows={[
          ["CPU",     <Bar value={r.cpu} max={100} unit="%" />],
          ["Memory",  <Bar value={r.memUsed} max={r.memTotal} unit="GB" />],
          ["Storage", <Bar value={r.diskUsed} max={r.diskTotal} unit="GB" />],
          ["Status",
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%",
                background: r.isOnline ? "var(--success)" : "var(--border-2)" }} />
              <span style={{ color: r.isOnline ? "var(--color-success-700)" : "var(--fg2)",
                fontWeight: 500 }}>{r.isOnline ? "Online" : "Offline"}</span>
            </span>],
        ]} />
      </WBSectionCard>
      <WBSectionCard title="Network">
        <WBKvTable rows={[
          ["Primary", <span className="mono" style={{ fontWeight: 500 }}>{snap.network.primary}</span>],
          ...(snap.network.wifi ? [
            ["Wi-Fi SSID",   <span className="mono">{snap.network.wifi.ssid}</span>],
            ["Wi-Fi signal", <span className="mono">{snap.network.wifi.signalDbm} dBm</span>],
            ...(snap.network.wifi.ip ? [["Wi-Fi IP", <span className="mono">{snap.network.wifi.ip}</span>]] : []),
          ] : []),
          ...(snap.network.cellular ? [
            ["Carrier", snap.network.cellular.carrier],
            ["Cell signal", <span className="mono">{snap.network.cellular.signalDbm} dBm</span>],
          ] : []),
          ...(snap.network.ethernet ? [
            ["Ethernet", <span className="mono">{snap.network.ethernet.linkMbps} Mbps</span>],
          ] : []),
        ]} />
      </WBSectionCard>
      <WBSectionCard title="Security">
        <WBKvTable rows={[
          ["Root",       <span style={{ color: snap.security.rooted ? "var(--color-error-700)" : "var(--color-success-700)",
                                        fontWeight: 500 }}>{snap.security.rooted ? "Rooted" : "Clean"}</span>],
          ["Dev mode",   <span style={{ color: snap.security.devMode ? "var(--color-warning-700)" : "var(--color-success-700)" }}>
                          {snap.security.devMode ? "Enabled" : "Disabled"}</span>],
          ["HW attacks", <span className="mono num">{snap.security.hwAttackCount}</span>],
          ["SW attacks", <span className="mono num">{snap.security.swAttackCount}</span>],
        ]} />
      </WBSectionCard>
      <WBSectionCard title="System">
        <WBKvTable rows={[
          ...(snap.battery ? [["Battery", `${snap.battery.level}% · ${snap.battery.health}`]] : [["Power", "Line-powered"]]),
          ["OS",       <span className="mono">{snap.os}</span>],
          ["Firmware", <span className="mono" style={{ fontSize: 11 }}>{snap.firmware}</span>],
        ]} />
      </WBSectionCard>
    </div>
  );
}

function Bar({ value, max, unit }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const tone = pct >= 85 ? "var(--color-warning-500)" : "var(--color-primary-500)";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
          {Number.isFinite(value) ? value : "—"}<span style={{ color: "var(--fg3)", fontWeight: 400 }}>/{max}</span> <span style={{ color: "var(--fg3)" }}>{unit}</span>
        </span>
        <span className="mono num" style={{ fontSize: 11, color: "var(--fg3)" }}>{pct}%</span>
      </div>
      <div style={{ marginTop: 3, height: 4, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone, transition: "width .2s ease" }} />
      </div>
    </div>
  );
}


// Reusable atoms used by tools
function WBSectionCard({ title, hint, action, children }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border-1)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px",
        background: "var(--bg3)",
        borderBottom: "1px solid var(--border-1)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span className="overline" style={{ fontSize: 10.5 }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: "var(--fg3)" }}>· {hint}</span>}
        <div style={{ flex: 1 }} />
        {action}
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return (
    <div style={{
      padding: "14px 12px", textAlign: "center",
      fontSize: 12, color: "var(--fg3)",
      background: "var(--bg1)",
      border: "1px dashed var(--color-border-subtle)",
      borderRadius: "var(--radius-sm)",
    }}>{children}</div>
  );
}
function AttachmentTile({ attachment, onClick }) {
  // 75×75 square tile. Screenshots: scaled mock fills the tile.
  // Logs: doc icon on a neutral background. Filename + size sit below.
  const isLog = attachment.kind === "log";
  const Mock = window.ScreenshotMock;
  return (
    <button type="button" onClick={onClick} title={`Open ${attachment.name}`}
      style={{
        padding: 0, border: 0, background: "transparent", cursor: "pointer",
        textAlign: "left", borderRadius: "var(--radius-md)",
        display: "flex", flexDirection: "column", gap: 6,
        width: 75,
      }}>
      <div style={{
        position: "relative",
        width: 75, height: 75, flexShrink: 0,
        background: isLog ? "var(--bg2)" : "var(--color-bg-3)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "color-mix(in oklab, var(--color-primary-500) 40%, transparent)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-1)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "none";
        }}>
        {isLog ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
            color: "var(--fg2)",
          }}>
            <window.Ico name="doc" size={28} stroke={1.5}
              style={{ color: "var(--color-primary-600)" }} />
            <span style={{
              fontFamily: "var(--font-family-mono)", fontSize: 8.5,
              fontWeight: 600, letterSpacing: "0.06em",
              color: "var(--fg3)", textTransform: "uppercase",
            }}>LOG</span>
          </div>
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 3, pointerEvents: "none",
          }}>
            {Mock ? <Mock name={attachment.name} /> : (
              <window.Ico name="image" size={26} stroke={1.4}
                style={{ color: "var(--fg3)" }} />
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1,
        minWidth: 0, width: 75 }}>
        <span style={{
          minWidth: 0, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "var(--font-family-mono)",
          fontSize: 10.5, color: "var(--fg1)", fontWeight: 500,
        }}>{attachment.name}</span>
        <span style={{ fontSize: 9.5, color: "var(--fg3)",
          fontFamily: "var(--font-family-mono)" }}>{attachment.size}</span>
      </div>
    </button>
  );
}
function WBAttachmentModal({ attachment, ticket, onClose }) {
  if (!attachment) return null;
  const isLog = attachment.kind === "log";
  return (
    <window.Modal open onClose={onClose} width={920}
      title={attachment.name}
      subtitle={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
            background: isLog ? "var(--bg3)" : "oklch(94% 0.03 230)",
            color: isLog ? "var(--fg2)" : "oklch(40% 0.16 230)",
            letterSpacing: "0.05em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
          }}>{attachment.kind}</span>
          <span className="mono" style={{ color: "var(--fg3)" }}>{attachment.size}</span>
        </span>
      }
      footer={<window.Button primary onClick={onClose}>Close</window.Button>}
      padding={isLog ? 0 : "var(--space-6)"}>
      {isLog && <LogStreamViewer name={attachment.name} ticket={ticket} />}
      {!isLog && <SimpleScreenshotPreview name={attachment.name} />}
    </window.Modal>
  );
}

// ─── Trouble log viewer ───────────────────────────────────────
// Renders the canned ticket logs straight away (no fake tailing) and
// lets the operator expand the window with synthetic ±1 hour context
// segments when the captured slice isn't enough. The toolbar carries
// the search box, level filters, and ±1h auto-loading on scroll.
//
// Logs are presented as one seamless stream — no per-file boundaries.
// When the user scrolls to the top or the bottom of the stream the
// viewer queues another hour of context (5 s simulated round-trip,
// then a clean prepend / append).
function TroubleLogViewer({ ticket, scrollRef, focus, onToggleFocus }) {
  // Flat lines array — all attached log files concatenated. The
  // operator no longer thinks about files, just one window of lines.
  const [lines, setLines] = useStateW(() => {
    const files = (ticket.attachments || []).filter(a => a.kind === "log");
    const out = [];
    files.forEach((file, fIdx) => {
      const raw = window.logLinesFor ? window.logLinesFor(file.name) : [];
      raw.forEach(([t, lvl, msg], i) => {
        out.push({ id: `init-${fIdx}-${i}`, t, lvl, msg });
      });
    });
    return out;
  });
  const [query, setQuery] = useStateW("");
  const [levels, setLevels] = useStateW({ I: true, W: true, E: true });
  // null | 'earlier' | 'later' — one direction at a time so we don't
  // double-fire on rapid scroll.
  const [loadingDir, setLoadingDir] = useStateW(null);

  const earlierCountRef = useRefW(0);
  const laterCountRef = useRefW(0);
  const logBodyRef = useRefW(null);
  // Scroll-anchor: scrollHeight captured just before a prepend so we
  // can keep the user's viewport pinned to the same line afterwards.
  const prevScrollHeightRef = useRefW(null);
  // Mirrors `loadingDir` synchronously so a click during the 5 s wait
  // doesn't double-fire.
  const loadingDirRef = useRefW(null);

  // Jump helpers — scroll the shared page container so the first or last
  // log line lands just under the sticky toolbar (top) or above the chip
  // bar (bottom). Used by the ⤒ / ⤓ toolbar buttons.
  const scrollToLogTop = () => {
    const sc = scrollRef?.current, body = logBodyRef.current;
    if (!sc || !body) return;
    const bodyRect = body.getBoundingClientRect();
    const scRect = sc.getBoundingClientRect();
    sc.scrollTo({
      top: sc.scrollTop + (bodyRect.top - scRect.top) - 50,
      behavior: "smooth",
    });
  };
  const scrollToLogBottom = () => {
    const sc = scrollRef?.current, body = logBodyRef.current;
    if (!sc || !body) return;
    const bodyRect = body.getBoundingClientRect();
    const scRect = sc.getBoundingClientRect();
    sc.scrollTo({
      top: sc.scrollTop + (bodyRect.bottom - scRect.top) - sc.clientHeight + 60,
      behavior: "smooth",
    });
  };

  // Scroll a segment header to the top of the shared scroll container.
  // (Retained for future "jump to time" affordances; no longer wired
  // up to a file-chip bar.)

  const loadEarlier = () => {
    if (loadingDirRef.current) return;
    loadingDirRef.current = "earlier";
    setLoadingDir("earlier");
    // Capture scroll anchor so the prepend doesn't visually jump the
    // user. We re-apply the height delta in a layout effect below.
    const sc = scrollRef?.current;
    prevScrollHeightRef.current = sc ? sc.scrollHeight : null;
    setTimeout(() => {
      const idx = ++earlierCountRef.current;
      const seg = makeContextSegment("earlier", idx);
      const newLines = seg.lines.map((l, i) => ({
        id: `earlier-${idx}-${i}`, t: l.t, lvl: l.lvl, msg: l.msg,
      }));
      setLines(prev => [...newLines, ...prev]);
      loadingDirRef.current = null;
      setLoadingDir(null);
    }, 5000);
  };
  const loadLater = () => {
    if (loadingDirRef.current) return;
    loadingDirRef.current = "later";
    setLoadingDir("later");
    setTimeout(() => {
      const idx = ++laterCountRef.current;
      const seg = makeContextSegment("later", idx);
      const newLines = seg.lines.map((l, i) => ({
        id: `later-${idx}-${i}`, t: l.t, lvl: l.lvl, msg: l.msg,
      }));
      setLines(prev => [...prev, ...newLines]);
      loadingDirRef.current = null;
      setLoadingDir(null);
    }, 5000);
  };

  // Restore scroll position after a prepend so the visible line stays
  // visible (no perceived jump).
  useEffectW(() => {
    if (prevScrollHeightRef.current == null) return;
    const sc = scrollRef?.current;
    if (sc) {
      const delta = sc.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) sc.scrollTop += delta;
    }
    prevScrollHeightRef.current = null;
  }, [lines.length]);

  // Auto-load on scroll was removed — operators now load explicitly
  // via the "Load 1h earlier / later" buttons. The previous
  // IntersectionObserver lived here.

  const toggleLevel = (l) => setLevels(s => ({ ...s, [l]: !s[l] }));
  const q = query.trim().toLowerCase();
  const lineMatches = (line) => {
    if (!levels[line.lvl]) return false;
    if (!q) return true;
    return (line.t + " " + line.lvl + " " + line.msg).toLowerCase().includes(q);
  };
  const visibleLines = lines.filter(lineMatches);
  const totals = { total: lines.length, visible: visibleLines.length };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      background: "oklch(12% 0.01 250)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar — sticks to top of the shared scroll container while
            scrolling through long logs. */}
        <div style={{
          position: "sticky", top: 0, zIndex: 6,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 14px",
          background: "oklch(17% 0.01 250)",
          borderBottom: "1px solid oklch(22% 0.01 250)",
          color: "oklch(82% 0.005 240)",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: "var(--radius-sm)",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
            flex: 1, minWidth: 200, maxWidth: 320,
          }}>
            <window.Ico name="search" size={11} stroke={1.8}
              style={{ color: "oklch(60% 0.02 240)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lines…"
              style={{
                flex: 1, background: "transparent", border: 0, outline: "none",
                color: "oklch(94% 0.005 240)",
                fontFamily: "var(--font-family-mono)", fontSize: 11.5,
              }} />
            {query && (
              <button onClick={() => setQuery("")} title="Clear"
                style={{ background: "transparent", border: 0, padding: 0,
                  color: "oklch(60% 0.02 240)", cursor: "pointer",
                  display: "inline-grid", placeItems: "center" }}>
                <window.Ico name="x" size={10} stroke={2.2} />
              </button>
            )}
          </div>
          <div style={{ display: "inline-flex", gap: 4 }}>
            {["I", "W", "E"].map(l => {
              const on = levels[l];
              const c = l === "E" ? "oklch(70% 0.18 25)"
                      : l === "W" ? "oklch(80% 0.16 75)"
                                  : "oklch(70% 0.04 240)";
              return (
                <button key={l} onClick={() => toggleLevel(l)}
                  title={l === "I" ? "Info" : l === "W" ? "Warn" : "Error"}
                  style={{
                    padding: "2px 8px", fontSize: 10,
                    fontFamily: "var(--font-family-mono)", letterSpacing: "0.04em",
                    background: on ? `color-mix(in oklab, ${c} 16%, transparent)` : "transparent",
                    color: on ? c : "oklch(48% 0.02 240)",
                    border: `1px solid ${on ? `color-mix(in oklab, ${c} 35%, transparent)` : "oklch(26% 0.01 250)"}`,
                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                    textDecoration: on ? "none" : "line-through",
                  }}>{l}</button>
              );
            })}
          </div>
          {/* Quick-nav cluster: top-of-logs · context (only when focus
              off) · bottom-of-logs · focus toggle. Sits at the right end
              of the sticky toolbar so it's always one click away. */}
          <div style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}>
            <button onClick={scrollToLogTop} title="Jump to first log line"
              style={navBtnStyle}>
              <window.Ico name="arrowU2" size={11} stroke={2} />
            </button>
            {!focus && (
              <button onClick={() => {
                const sc = scrollRef?.current;
                if (sc) sc.scrollTo({ top: 0, behavior: "smooth" });
              }} title="Back to context (Snapshot / Screenshots)"
              style={{ ...navBtnStyle, paddingLeft: 8, paddingRight: 8,
                borderLeft: "1px solid rgba(255,255,255,.08)",
                borderRight: "1px solid rgba(255,255,255,.08)" }}>
                <window.Ico name="chevu" size={10} stroke={2} />
                <span style={{ marginLeft: 4 }}>Context</span>
              </button>
            )}
            <button onClick={scrollToLogBottom} title="Jump to last log line"
              style={navBtnStyle}>
              <window.Ico name="arrowD2" size={11} stroke={2} />
            </button>
          </div>
          <button onClick={onToggleFocus}
            title={focus ? "Exit focus — show context + dock" : "Focus log — hide context + dock"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: "var(--radius-sm)",
              background: focus
                ? "color-mix(in oklab, oklch(70% 0.16 240) 22%, transparent)"
                : "rgba(255,255,255,.04)",
              border: focus
                ? "1px solid color-mix(in oklab, oklch(70% 0.16 240) 45%, transparent)"
                : "1px solid rgba(255,255,255,.10)",
              color: focus ? "oklch(94% 0.06 240)" : "oklch(85% 0.005 240)",
              fontSize: 10.5, fontWeight: focus ? 600 : 500, cursor: "pointer",
              fontFamily: "var(--font-family-sans)",
            }}>
            <window.Ico name={focus ? "lock" : "lockOpen"} size={10} stroke={2} />
            {focus ? "Focused" : "Focus log"}
          </button>
          <span style={{ fontSize: 10,
            fontFamily: "var(--font-family-mono)", color: "oklch(55% 0.02 240)" }}>
            {totals.visible}/{totals.total}
          </span>
        </div>

        {/* Log body — natural height, scrolls with the page. */}
        <div ref={logBodyRef} style={{
          fontFamily: "var(--font-family-mono)", fontSize: 11.5, lineHeight: 1.55,
          color: "oklch(85% 0.005 240)",
        }}>
          {/* Load-earlier button row. The button stays in DOM while
              loading (showing a spinner) so layout doesn't jump. */}
          <LogLoadButton direction="earlier"
            loading={loadingDir === "earlier"}
            disabled={loadingDir !== null}
            hoursLoaded={earlierCountRef.current}
            onClick={loadEarlier} />
          {visibleLines.map(line => (
            <LogLineRow key={line.id} line={line} q={q} />
          ))}
          {visibleLines.length === 0 && lines.length > 0 && (
            <div style={{ padding: "12px 18px", color: "oklch(50% 0.02 240)",
              fontSize: 11 }}>
              All {lines.length} lines are filtered out by the current
              search / level filters.
            </div>
          )}
          {/* Load-later button row, mirror of the above. */}
          <LogLoadButton direction="later"
            loading={loadingDir === "later"}
            disabled={loadingDir !== null}
            hoursLoaded={laterCountRef.current}
            onClick={loadLater} />
        </div>
      </div>

    </div>
  );
}

// Explicit "Load 1h earlier / later" button. Renders inline at the top
// and bottom of the log stream; the operator decides when to extend
// the window. While `loading` is true it shows a spinner and is
// disabled; while another direction is loading it stays disabled too
// to avoid two concurrent fetches.
function LogLoadButton({ direction, loading, disabled, hoursLoaded, onClick }) {
  const earlier = direction === "earlier";
  const accent = "oklch(72% 0.10 200)";
  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      padding: "10px 14px",
      background: "oklch(15% 0.01 250)",
      borderTop:    !earlier ? "1px solid oklch(22% 0.01 250)" : "none",
      borderBottom:  earlier ? "1px solid oklch(22% 0.01 250)" : "none",
    }}>
      <button type="button" onClick={onClick} disabled={disabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px",
          background: loading
            ? `color-mix(in oklab, ${accent} 18%, oklch(22% 0.03 240))`
            : "oklch(22% 0.03 240)",
          border: "1px solid " + (loading
            ? `color-mix(in oklab, ${accent} 55%, transparent)`
            : "oklch(34% 0.06 240)"),
          borderRadius: 999,
          color: loading ? accent : "oklch(86% 0.06 240)",
          fontSize: 12, fontWeight: 500,
          fontFamily: "var(--font-family-sans)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled && !loading ? 0.45 : 1,
          transition: "background .12s ease, border-color .12s ease",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.background = "oklch(28% 0.04 240)";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          e.currentTarget.style.background = "oklch(22% 0.03 240)";
        }}>
        {loading ? (
          <>
            <span style={{
              width: 11, height: 11, borderRadius: "50%",
              border: `1.6px solid color-mix(in oklab, ${accent} 40%, transparent)`,
              borderTopColor: accent,
              animation: "wbSpin 0.8s linear infinite",
            }} />
            <span>Loading 1h {earlier ? "earlier" : "later"}…</span>
            <style>{`@keyframes wbSpin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <window.Ico name={earlier ? "chevu" : "chevdown"}
              size={12} stroke={2} />
            <span>Load 1h {earlier ? "earlier" : "later"}</span>
            {hoursLoaded > 0 && (
              <span style={{ opacity: 0.7, fontSize: 11 }}>
                · +{hoursLoaded}h loaded
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}

function FileChipBar({ segments, activeSegId, onJump, chipsRef }) {
  const scrollChips = (dir) => {
    chipsRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 6,
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 8px",
      background: "oklch(15% 0.01 250)",
      borderTop: "1px solid oklch(24% 0.01 250)",
      boxShadow: "0 -6px 18px -10px oklch(0% 0 0 / 0.45)",
    }}>
      <span style={{
        flexShrink: 0, padding: "0 8px",
        fontSize: 9.5, fontFamily: "var(--font-family-mono)",
        color: "oklch(55% 0.02 240)", letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>Files</span>
      <button onClick={() => scrollChips(-1)} title="Previous files"
        style={chipArrowStyle}>
        <window.Ico name="chevl" size={10} stroke={2} />
      </button>
      <div ref={chipsRef} style={{
        flex: 1, minWidth: 0, overflowX: "auto",
        display: "flex", gap: 5, alignItems: "center",
        scrollbarWidth: "none",
      }}>
        <style>{`.wb-chip-strip::-webkit-scrollbar { display: none }`}</style>
        {segments.map(seg => {
          const isActive = seg.id === activeSegId;
          const c = seg.anchor === "trouble" ? "oklch(75% 0.16 240)"
                  : seg.anchor === "earlier" ? "oklch(72% 0.10 200)"
                                              : "oklch(72% 0.10 280)";
          return (
            <button key={seg.id} data-chip-id={seg.id}
              onClick={() => onJump(seg.id)}
              title={`Jump to ${seg.file}`}
              style={{
                flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 9px", borderRadius: "var(--radius-sm)",
                background: isActive
                  ? `color-mix(in oklab, ${c} 28%, transparent)`
                  : "transparent",
                color: isActive ? "oklch(96% 0.02 240)" : c,
                border: `1px solid ${isActive
                  ? `color-mix(in oklab, ${c} 65%, transparent)`
                  : `color-mix(in oklab, ${c} 28%, transparent)`}`,
                fontFamily: "var(--font-family-mono)", fontSize: 10.5,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                boxShadow: isActive
                  ? `0 0 0 1px color-mix(in oklab, ${c} 50%, transparent)`
                  : "none",
                transition: "background .12s ease, color .12s ease, border-color .12s ease",
              }}>
              <window.Ico name={seg.anchor === "trouble" ? "alert" : "history"}
                size={9} stroke={1.8} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", maxWidth: 180 }}>{seg.file}</span>
              <span style={{ opacity: 0.75, fontSize: 9.5 }}>
                {seg.lines.length}
              </span>
              {isActive && (
                <span style={{
                  marginLeft: 2, width: 5, height: 5, borderRadius: "50%",
                  background: c, boxShadow: `0 0 0 3px color-mix(in oklab, ${c} 35%, transparent)`,
                }} />
              )}
            </button>
          );
        })}
      </div>
      <button onClick={() => scrollChips(1)} title="More files"
        style={chipArrowStyle}>
        <window.Ico name="chevr" size={10} stroke={2} />
      </button>
    </div>
  );
}
const chipArrowStyle = {
  flexShrink: 0,
  display: "inline-grid", placeItems: "center",
  width: 22, height: 22, borderRadius: 999,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.10)",
  color: "oklch(86% 0.005 240)",
  cursor: "pointer",
  padding: 0,
};
const navBtnStyle = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "3px 8px",
  background: "transparent", border: 0,
  color: "oklch(85% 0.005 240)",
  fontSize: 10.5, fontWeight: 500, cursor: "pointer",
  fontFamily: "var(--font-family-sans)",
};

function SegmentHeader({ seg }) {
  // Per-segment label that pins to the top of the scroll container while
  // any of its lines are still in view — gives the operator a constant
  // "where am I" reading even after they've scrolled past the actual file
  // boundary. `top: 41px` sits this header directly below the (also
  // sticky) toolbar so the two stack cleanly.
  const tone = seg.anchor === "trouble" ? "oklch(75% 0.16 240)"
             : seg.anchor === "earlier" ? "oklch(72% 0.10 200)"
                                        : "oklch(72% 0.10 280)";
  const label = seg.anchor === "trouble" ? "TROUBLE WINDOW"
              : seg.anchor === "earlier" ? "+1H EARLIER"
                                         : "+1H LATER";
  return (
    <div style={{
      position: "sticky", top: 41,
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 14px",
      background: `color-mix(in oklab, ${tone} 14%, oklch(16% 0.02 250))`,
      borderBottom: `1px solid color-mix(in oklab, ${tone} 32%, transparent)`,
      borderTop: "1px solid oklch(24% 0.01 250)",
      backdropFilter: "blur(6px)",
      fontFamily: "var(--font-family-mono)", fontSize: 10.5,
      zIndex: 5,
      boxShadow: "0 6px 14px -10px oklch(0% 0 0 / 0.45)",
    }}>
      <span style={{
        padding: "1px 6px", borderRadius: 3,
        background: `color-mix(in oklab, ${tone} 30%, oklch(15% 0.01 250))`,
        color: tone, fontSize: 9.5, fontWeight: 700,
        letterSpacing: "0.06em",
      }}>{label}</span>
      <span style={{ color: "oklch(96% 0.005 240)", fontWeight: 600 }}>
        {seg.file}
      </span>
      <span style={{ color: "oklch(70% 0.02 240)", marginLeft: "auto" }}>
        {seg.lines.length} lines{seg.size ? " · " + seg.size : ""}
      </span>
    </div>
  );
}

function LogLineRow({ line, q }) {
  const c = line.lvl === "E" ? "oklch(70% 0.18 25)"
          : line.lvl === "W" ? "oklch(80% 0.16 75)"
                              : "oklch(70% 0.04 240)";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "104px 32px minmax(0, 1fr)",
      gap: 8, padding: "1px 14px",
      background: line.lvl === "E" ? "color-mix(in oklab, oklch(70% 0.18 25) 6%, transparent)"
                : line.lvl === "W" ? "color-mix(in oklab, oklch(80% 0.16 75) 5%, transparent)"
                                    : "transparent",
    }}>
      <span style={{ color: "oklch(50% 0.02 240)" }}>{line.t}</span>
      <span style={{ color: c, fontWeight: 600, textAlign: "center" }}>{line.lvl}</span>
      <span style={{
        color: line.lvl === "E" ? "oklch(86% 0.10 25)"
              : line.lvl === "W" ? "oklch(86% 0.10 75)"
                                  : "oklch(86% 0.005 240)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>{q ? <Hilite text={line.msg} q={q} /> : line.msg}</span>
    </div>
  );
}

function LoadMoreRow({ direction, onClick, count }) {
  const label = direction === "earlier"
    ? (count > 0 ? `Load another 1h earlier (+${count}h loaded)` : "Load 1h earlier")
    : (count > 0 ? `Load another 1h later (+${count}h loaded)` : "Load 1h later");
  return (
    <div style={{
      display: "flex", justifyContent: "center",
      padding: "8px 14px",
      background: "oklch(15% 0.01 250)",
      borderTop: direction === "later" ? "1px solid oklch(22% 0.01 250)" : "none",
      borderBottom: direction === "earlier" ? "1px solid oklch(22% 0.01 250)" : "none",
    }}>
      <button onClick={onClick} style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "5px 14px",
        background: "oklch(22% 0.03 240)",
        border: "1px solid oklch(34% 0.06 240)",
        borderRadius: 999,
        color: "oklch(86% 0.06 240)",
        fontSize: 11.5, fontWeight: 500,
        fontFamily: "var(--font-family-sans)",
        cursor: "pointer",
        transition: "background .12s ease",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(28% 0.04 240)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(22% 0.03 240)"; }}>
        <window.Ico name={direction === "earlier" ? "chevu" : "chevdown"}
          size={11} stroke={2} />
        {label}
      </button>
    </div>
  );
}

function makeContextSegment(direction, idx) {
  const id = `seg-${direction}-${idx}`;
  const baseHour = direction === "earlier" ? 14 - idx : 14 + idx;
  const hh = String(((baseHour % 24) + 24) % 24).padStart(2, "0");
  const file = direction === "earlier"
    ? `context-${hh}xx-earlier.log`
    : `context-${hh}xx-later.log`;
  const COUNT = 22;
  const lines = [];
  for (let i = 0; i < COUNT; i++) {
    const pick = LIVE_LOG_LINES[(i * 3 + idx * 5) % LIVE_LOG_LINES.length];
    const mm = String((i * 2 + idx * 3) % 60).padStart(2, "0");
    const ss = String((i * 13 + idx * 7) % 60).padStart(2, "0");
    const ms = String((i * 137) % 1000).padStart(3, "0");
    lines.push({
      id: `${id}-${i}`,
      t: `${hh}:${mm}:${ss}.${ms}`,
      lvl: pick[0],
      msg: pick[1] + " " + pick[2],
    });
  }
  return { id, file, anchor: direction, lines };
}

// ─── Streaming log viewer ─────────────────────────────────────
// Replays the file's canned lines with a tail-like cadence, supports a
// case-insensitive search box + level toggles. Pause halts
// further line ingestion; Resume catches up to the file end. After all
// lines have been emitted the viewer keeps tailing with a slow stream
// of synthetic heartbeat lines so the surface feels live.
function LogStreamViewer({ name, ticket, embedded = false }) {
  // Loaded files render the whole canned line set in one shot —
  // these are static, already-extracted artifacts, not a live tail.
  const lines = useMemoW(() => {
    const src = window.logLinesFor ? window.logLinesFor(name) : [];
    return src.map(([t, lvl, msg], i) => ({ id: i, t, lvl, msg }));
  }, [name]);

  const [query, setQuery] = useStateW("");
  const [levels, setLevels] = useStateW({ I: true, W: true, E: true });
  const bodyRef = useRefW(null);

  // (Live-tail interval removed — file is fully loaded on mount.)

  const toggleLevel = (l) => setLevels(s => ({ ...s, [l]: !s[l] }));

  const q = query.trim().toLowerCase();
  const visible = lines.filter(({ lvl, t, msg }) => {
    if (!levels[lvl]) return false;
    if (!q) return true;
    return (t + " " + lvl + " " + msg).toLowerCase().includes(q);
  });

  const counts = lines.reduce((acc, l) => { acc[l.lvl] = (acc[l.lvl] || 0) + 1; return acc; },
    { I: 0, W: 0, E: 0 });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      height: embedded ? "100%" : 520,
      minHeight: embedded ? 0 : 520,
      flex: embedded ? 1 : "0 0 auto",
      background: "oklch(12% 0.01 250)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 14px",
          background: "oklch(17% 0.01 250)",
          borderBottom: "1px solid oklch(22% 0.01 250)",
          color: "oklch(82% 0.005 240)",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10.5, fontFamily: "var(--font-family-mono)",
            letterSpacing: "0.04em", textTransform: "uppercase",
            color: "oklch(70% 0.04 240)",
          }}>
            <window.Ico name="doc" size={11} stroke={1.8} />
            Loaded
            <span className="num" style={{ color: "oklch(85% 0.005 240)" }}>
              {lines.length}
            </span>
            <span style={{ opacity: 0.7 }}>lines</span>
          </span>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: "var(--radius-sm)",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
            flex: 1, minWidth: 180, maxWidth: 320,
          }}>
            <window.Ico name="search" size={11} stroke={1.8}
              style={{ color: "oklch(60% 0.02 240)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lines…"
              style={{
                flex: 1, background: "transparent", border: 0, outline: "none",
                color: "oklch(94% 0.005 240)",
                fontFamily: "var(--font-family-mono)", fontSize: 11.5,
              }} />
            {query && (
              <button onClick={() => setQuery("")} title="Clear"
                style={{ background: "transparent", border: 0, padding: 0,
                  color: "oklch(60% 0.02 240)", cursor: "pointer",
                  display: "inline-grid", placeItems: "center" }}>
                <window.Ico name="x" size={10} stroke={2.2} />
              </button>
            )}
          </div>

          <div style={{ display: "inline-flex", gap: 4 }}>
            {["I", "W", "E"].map(l => {
              const on = levels[l];
              const c = l === "E" ? "oklch(70% 0.18 25)"
                      : l === "W" ? "oklch(80% 0.16 75)"
                                  : "oklch(70% 0.04 240)";
              return (
                <button key={l} onClick={() => toggleLevel(l)}
                  title={l === "I" ? "Info" : l === "W" ? "Warn" : "Error"}
                  style={{
                    padding: "2px 8px", fontSize: 10,
                    fontFamily: "var(--font-family-mono)", letterSpacing: "0.04em",
                    background: on ? `color-mix(in oklab, ${c} 16%, transparent)` : "transparent",
                    color: on ? c : "oklch(48% 0.02 240)",
                    border: `1px solid ${on ? `color-mix(in oklab, ${c} 35%, transparent)` : "oklch(26% 0.01 250)"}`,
                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                    textDecoration: on ? "none" : "line-through",
                  }}>
                  {l}<span style={{ marginLeft: 4, opacity: 0.7,
                    fontWeight: 400 }}>{counts[l] || 0}</span>
                </button>
              );
            })}
          </div>

          <span style={{ fontSize: 10, fontFamily: "var(--font-family-mono)",
            color: "oklch(55% 0.02 240)", marginLeft: "auto" }}>
            {visible.length}/{lines.length}
          </span>
        </div>

        <div ref={bodyRef}
          style={{
            flex: 1, overflow: "auto",
            fontFamily: "var(--font-family-mono)", fontSize: 11.5, lineHeight: 1.55,
            padding: "6px 0",
            color: "oklch(85% 0.005 240)",
            scrollbarWidth: "thin",
          }}>
          {visible.length === 0 && (
            <div style={{ padding: "14px", textAlign: "center",
              fontSize: 11.5, color: "oklch(55% 0.02 240)" }}>
              {emitted.length === 0 ? "Waiting for the first line…" : "No lines match the current filter."}
            </div>
          )}
          {visible.map(line => {
            const c = line.lvl === "E" ? "oklch(70% 0.18 25)"
                    : line.lvl === "W" ? "oklch(80% 0.16 75)"
                                        : "oklch(70% 0.04 240)";
            return (
              <div key={line.id} style={{
                display: "grid",
                gridTemplateColumns: "96px 32px minmax(0, 1fr)",
                gap: 8, padding: "1px 14px",
                background: line.lvl === "E" ? "color-mix(in oklab, oklch(70% 0.18 25) 6%, transparent)"
                          : line.lvl === "W" ? "color-mix(in oklab, oklch(80% 0.16 75) 5%, transparent)"
                                              : "transparent",
              }}>
                <span style={{ color: "oklch(50% 0.02 240)" }}>{line.t}</span>
                <span style={{ color: c, fontWeight: 600, textAlign: "center" }}>{line.lvl}</span>
                <span style={{
                  color: line.lvl === "E" ? "oklch(86% 0.10 25)"
                        : line.lvl === "W" ? "oklch(86% 0.10 75)"
                                            : "oklch(86% 0.005 240)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{q ? <Hilite text={line.msg} q={q} /> : line.msg}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function Hilite({ text, q }) {
  if (!q) return text;
  const parts = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) { parts.push(text.slice(i)); break; }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={idx} style={{
        background: "oklch(75% 0.20 75 / 0.45)",
        color: "oklch(98% 0.04 75)",
        padding: "0 1px", borderRadius: 2,
      }}>{text.slice(idx, idx + q.length)}</mark>
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}

const TAIL_HEARTBEATS = [
  ["I", "TelemetryAg uploaded metrics batch · 18 KB"],
  ["I", "WifiState   RSSI -58 dBm · stable"],
  ["I", "POS-Pro     idle · awaiting input"],
  ["I", "PayCore     reader armed · awaiting tap"],
  ["W", "EMV-Kernel  GPO response 410 ms (drift)"],
  ["I", "RIL         LTE Cat-4 · RSRP -84 dBm"],
];
function SimpleScreenshotPreview({ name }) {
  const Mock = window.ScreenshotMock;
  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      background: "var(--color-bg-3)",
      borderRadius: "var(--radius-md)", padding: 24,
      minHeight: 460,
    }}>
      {Mock ? <Mock name={name} /> : (
        <div style={{ color: "var(--fg3)", fontSize: 12 }}>{name}</div>
      )}
    </div>
  );
}

// ─── Tool: Remote desktop ─────────────────────────────────
function RemoteDesktopTool({ ticket, device, connection, logAction }) {
  const [sessionState, setSessionState] = useStateW("connected"); // connecting | connected | ended
  const [duration, setDuration] = useStateW(124);
  useEffectW(() => {
    if (sessionState !== "connected") return;
    const i = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(i);
  }, [sessionState]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const screenshot = () => {
    logAction({ tool: "REMOTE", label: "Captured remote screen", tone: "ok", detail: "720×1280" });
    window.showToast?.("Screenshot captured & attached to ticket", "success");
  };
  const restartApp = () => {
    logAction({ tool: "REMOTE", label: "Restarted POS Pro app", tone: "ok", detail: "ACK 410 ms" });
    window.showToast?.("POS Pro app restarted", "success");
  };
  const endSession = () => {
    setSessionState("ended");
    logAction({ tool: "REMOTE", label: `Ended session · ${fmt(duration)}`, tone: "warn" });
  };
  const reconnect = () => {
    setSessionState("connecting");
    setDuration(0);
    setTimeout(() => {
      setSessionState("connected");
      logAction({ tool: "REMOTE", label: "Reconnected", tone: "ok" });
    }, 700);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 14 }}>
      <div style={{
        background: "var(--bg2)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-2)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: "var(--bg3)",
          borderBottom: "1px solid var(--border-1)",
          fontSize: 11.5,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: 999,
            background: sessionState === "connected" ? "var(--success-bg)"
                      : sessionState === "ended"     ? "var(--bg2)"
                                                      : "var(--warning-bg)",
            color:      sessionState === "connected" ? "var(--color-success-700)"
                      : sessionState === "ended"     ? "var(--fg3)"
                                                      : "var(--color-warning-700)",
            fontSize: 10.5, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: sessionState === "connected" ? "var(--success)"
                        : sessionState === "ended"     ? "var(--border-2)"
                                                        : "var(--warning)",
              animation: sessionState === "connected" ? "wbPulse 2s ease-in-out infinite" : "none",
            }} />
            {sessionState === "connected" ? "CONNECTED" : sessionState === "ended" ? "ENDED" : "CONNECTING"}
          </span>
          <span style={{ fontFamily: "var(--font-family-mono)", color: "var(--fg2)" }}>
            {ticket.deviceSn}{device && <> · 720 × 1280</>}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12,
            fontFamily: "var(--font-family-mono)", color: "var(--fg3)", fontSize: 11 }}>
            <span><span style={{ color: "var(--fg3)" }}>latency </span><span style={{ color: "var(--fg1)" }}>{connection.latencyMs}ms</span></span>
            <span><span style={{ color: "var(--fg3)" }}>session </span><span style={{ color: "var(--fg1)" }}>{fmt(duration)}</span></span>
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 360, padding: 24,
          background: "repeating-linear-gradient(45deg, oklch(96% 0.005 230), oklch(96% 0.005 230) 12px, oklch(94% 0.005 230) 12px, oklch(94% 0.005 230) 24px)",
        }}>
          {sessionState === "ended"
            ? <div style={{ textAlign: "center", color: "var(--fg3)" }}>
                <window.Ico name="x" size={28} stroke={1.8} style={{ color: "var(--fg3)" }} />
                <div style={{ marginTop: 8, fontSize: 13 }}>Session ended</div>
                <div style={{ marginTop: 10 }}>
                  <WBButton primary icon="refresh" onClick={reconnect}>Reconnect</WBButton>
                </div>
              </div>
            : <WBDevicePosMock />}
        </div>
        <div style={{
          display: "flex", gap: 6, padding: "8px 12px",
          background: "var(--bg3)", borderTop: "1px solid var(--border-1)",
          flexWrap: "wrap",
        }}>
          <WBButton icon="external" disabled={sessionState !== "connected"} onClick={screenshot}>Take screenshot</WBButton>
          <WBButton icon="refresh" disabled={sessionState !== "connected"} onClick={restartApp}>Restart POS app</WBButton>
          <span style={{ flex: 1 }} />
          <WBButton danger icon="x" disabled={sessionState !== "connected"} onClick={endSession}>End session</WBButton>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <WBSectionCard title="Session">
          <WBKvTable rows={[
            ["Status", sessionState === "connected" ? "Connected" : sessionState === "ended" ? "Ended" : "Connecting"],
            ["Duration", <span className="mono">{fmt(duration)}</span>],
            ["Operator", "at device · approved"],
            ["Protocol", <span className="mono">WebRTC P2P</span>],
            ["Bitrate", <span className="mono">1.2 Mbps</span>],
            ["Frames", <span className="mono">30 / s</span>],
          ]} />
        </WBSectionCard>
        <WBSectionCard title="Input flow">
          <ul style={{ margin: 0, padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 5,
            fontSize: 11.5, color: "var(--fg2)" }}>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tap on "Retry"</span><span className="mono" style={{ color: "var(--fg3)" }}>40s ago</span>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Inserted chip card</span><span className="mono" style={{ color: "var(--fg3)" }}>32s ago</span>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Pressed Confirm $14.20</span><span className="mono" style={{ color: "var(--fg3)" }}>28s ago</span>
            </li>
          </ul>
          <div style={{
            marginTop: 8, padding: "6px 8px",
            background: "var(--warning-bg)",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 22%, transparent)",
            borderRadius: "var(--radius-sm)",
            fontSize: 10.5, color: "var(--color-warning-700)",
          }}>
            Read-only by default. Request control from cashier to interact.
          </div>
        </WBSectionCard>
      </div>
    </div>
  );
}

function WBDevicePosMock() {
  return (
    <div style={{
      width: 240, aspectRatio: "9 / 16",
      background: "linear-gradient(170deg, oklch(15% 0.04 250) 0%, oklch(10% 0.02 250) 100%)",
      borderRadius: 22, padding: 12, color: "#fff",
      display: "flex", flexDirection: "column",
      boxShadow: "0 20px 60px rgba(0,0,0,.35)",
      border: "3px solid oklch(20% 0.02 250)",
      position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: 9.5, fontFamily: "var(--font-family-mono)",
        color: "rgba(255,255,255,.7)", marginBottom: 14 }}>
        <span>14:32</span><span>● ● ● 4G  ▮▮▯</span>
      </div>
      <div style={{
        width: 72, height: 72, margin: "10px auto 0",
        borderRadius: "50%",
        background: "color-mix(in oklab, oklch(54% 0.20 25) 24%, transparent)",
        border: "2px solid oklch(54% 0.20 25)",
        display: "grid", placeItems: "center",
        boxShadow: "0 0 0 8px color-mix(in oklab, oklch(54% 0.20 25) 12%, transparent)",
      }}>
        <span style={{ fontSize: 36, color: "oklch(54% 0.20 25)", fontWeight: 600 }}>✕</span>
      </div>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Transaction declined</div>
        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
          EMV kernel timeout · please try again
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, padding: "8px 0", borderRadius: 6,
          background: "rgba(255,255,255,.08)", textAlign: "center",
          fontSize: 11, fontWeight: 500 }}>Cancel</div>
        <div style={{ flex: 1, padding: "8px 0", borderRadius: 6,
          background: "oklch(54% 0.20 25)", color: "#fff", textAlign: "center",
          fontSize: 11, fontWeight: 600 }}>Retry</div>
      </div>
      <div style={{ width: 60, height: 3, borderRadius: 2,
        background: "rgba(255,255,255,.4)", margin: "8px auto 0" }} />
      <span style={{ position: "absolute", bottom: "32%", left: "62%",
        width: 10, height: 10, borderRadius: "50%",
        background: "oklch(70% 0.20 152)",
        boxShadow: "0 0 0 5px oklch(70% 0.20 152 / 0.30)",
        animation: "wbPulse 1.5s ease-in-out infinite",
      }} />
    </div>
  );
}
function RemoteDesktopTool_OLD() { return null; }
// ─── Tool: Log extraction ─────────────────────────────────
// Two parts: already-extracted log files (history) and "Pull now" form
// that lets handler scope a new extraction (time window + modules).
function LogPullTool({ ticket, logAction }) {
  // Pre-seeded history so the list feels populated.
  const [history, setHistory] = useStateW(() => [
    { id: "lp-1", at: "May 16, 2026 09:14", scope: "All modules · last 24 h",
      size: "4.7 MB", lines: 18420, by: "Maya Hassan", status: "done",
      file: "device-log-2026-05-16-0914.tar" },
    { id: "lp-2", at: "May 15, 2026 14:32", scope: "EMV + payment · last 30 min",
      size: "1.2 MB", lines: 5410, by: "Cloud (auto)", status: "done",
      file: "device-log-2026-05-15-1432.tar" },
  ]);
  const [pulling, setPulling] = useStateW(null); // { progress: 0-100, scope, eta }
  const [openFile, setOpenFile] = useStateW(null);

  // Form state
  const [window24, setWindow24] = useStateW("60min"); // 30min / 60min / 6h / 24h
  const [modules, setModules] = useStateW({ emv: true, network: true, app: true, system: false });

  const startPull = () => {
    const scopeBits = Object.entries(modules).filter(([, v]) => v).map(([k]) => MODULE_LABEL[k]);
    if (scopeBits.length === 0) {
      window.showToast?.("Select at least one module", "info");
      return;
    }
    const scope = `${scopeBits.join(" + ")} · last ${WINDOW_LABEL[window24]}`;
    setPulling({ progress: 0, scope, eta: 9 });
    logAction({ tool: "PULLLOG", label: `Started · ${scope}`, tone: "neutral" });
    const start = Date.now();
    const i = setInterval(() => {
      const t = (Date.now() - start) / 9000;
      const pct = Math.min(100, Math.round(t * 100));
      setPulling(prev => prev ? { ...prev, progress: pct, eta: Math.max(0, Math.round(9 - t * 9)) } : null);
      if (pct >= 100) {
        clearInterval(i);
        const id = `lp-${Date.now().toString(36)}`;
        const file = `device-log-${now24()}.tar`;
        setHistory(h => [{
          id, at: "May 16, 2026 14:32", scope, size: "2.3 MB", lines: 9320,
          by: "Maya Hassan", status: "done", file,
        }, ...h]);
        setPulling(null);
        logAction({ tool: "PULLLOG", label: `Extraction complete · ${file}`, tone: "ok", detail: "9.2s · 2.3 MB" });
        window.showToast?.("Log pull complete · 2.3 MB", "success");
      }
    }, 200);
  };
  function now24() {
    return "2026-05-16-1432";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <WBSectionCard title="Pull new logs" hint="Scope a fresh extraction. The device packages logs server-side and uploads.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div>
            <div className="overline" style={{ fontSize: 9.5, marginBottom: 6 }}>Time window</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["30min", "60min", "6h", "24h"].map(w => (
                <button key={w} onClick={() => setWindow24(w)} style={pickerStyle(window24 === w)}>
                  {WINDOW_LABEL[w]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="overline" style={{ fontSize: 9.5, marginBottom: 6 }}>Modules</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.keys(MODULE_LABEL).map(k => (
                <button key={k} onClick={() => setModules(s => ({ ...s, [k]: !s[k] }))}
                  style={pickerStyle(modules[k])}>{MODULE_LABEL[k]}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <WBButton primary icon="download" disabled={!!pulling} onClick={startPull}>
            {pulling ? "Pulling…" : "Pull logs now"}
          </WBButton>
          <span style={{ fontSize: 11, color: "var(--fg3)" }}>
            Typical wait: 5–15 s. The device throttles concurrent extractions.
          </span>
        </div>
        {pulling && (
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "var(--bg1)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span><b style={{ color: "var(--fg1)" }}>{pulling.scope}</b></span>
              <span style={{ color: "var(--fg3)" }} className="mono">{pulling.progress}% · {pulling.eta}s left</span>
            </div>
            <div style={{ marginTop: 6, height: 5, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
              <div style={{ width: `${pulling.progress}%`, height: "100%",
                background: "var(--color-primary-500)", transition: "width .2s ease" }} />
            </div>
          </div>
        )}
      </WBSectionCard>

      <WBSectionCard title={`Extracted log files · ${history.length}`}
        hint="Click a row to read the content.">
        {history.length === 0 ? (
          <Empty>No logs have been pulled for this device yet.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map(h => (
              <button key={h.id} onClick={() => setOpenFile(h)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto",
                  gap: 12, alignItems: "center", width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg1)",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer", textAlign: "left",
                }}>
                <window.Ico name="doc" size={14} stroke={1.8} style={{ color: "var(--fg2)" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)",
                    fontFamily: "var(--font-family-mono)" }}>{h.file}</div>
                  <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--fg3)" }}>
                    {h.scope} · pulled by {h.by} · <span className="mono">{h.at}</span>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--fg2)" }}>{h.size}</span>
                <span className="mono num" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{h.lines.toLocaleString()} lines</span>
                <window.Ico name="external" size={11} stroke={1.8} style={{ color: "var(--fg3)" }} />
              </button>
            ))}
          </div>
        )}
      </WBSectionCard>

      <window.Modal open={!!openFile} onClose={() => setOpenFile(null)}
        width={820}
        title={openFile?.file}
        subtitle={openFile && <span style={{ fontFamily: "var(--font-family-mono)" }}>
          {openFile.size} · {openFile.lines.toLocaleString()} lines · {openFile.scope}
        </span>}
        footer={
          <>
            <window.Button icon="download"
              onClick={() => window.showToast?.(`Downloading ${openFile?.file}…`, "info")}>Download</window.Button>
            <window.Button primary onClick={() => setOpenFile(null)}>Close</window.Button>
          </>
        }
        padding={0}>
        <LogStreamViewer name={openFile?.file || ""} ticket={ticket} />
      </window.Modal>
    </div>
  );
}

const MODULE_LABEL = {
  emv:     "Payment / EMV",
  network: "Network / RIL",
  app:     "Apps",
  system:  "System",
};
const WINDOW_LABEL = {
  "30min": "30 min", "60min": "1 hour", "6h": "6 hours", "24h": "24 hours",
};

function pickerStyle(on) {
  return {
    padding: "5px 10px",
    background: on ? "var(--color-primary-50)" : "var(--bg2)",
    color: on ? "var(--color-primary-700)" : "var(--fg2)",
    border: "1px solid",
    borderColor: on ? "color-mix(in oklab, var(--color-primary-500) 25%, transparent)" : "var(--border-1)",
    borderRadius: "var(--radius-sm)",
    fontSize: 11.5, fontWeight: on ? 500 : 400,
    cursor: "pointer", fontFamily: "inherit",
  };
}
function LogPullTool_OLD() { return null; }
// ─── Tool: Live logs ──────────────────────────────────────
function LiveLogsTool({ logAction, embedded = false }) {
  const [lines, setLines] = useStateW(() => seedLiveLogs());
  const [paused, setPaused] = useStateW(false);
  const [query, setQuery] = useStateW("");
  const [levels, setLevels] = useStateW({ I: true, W: true, E: true });
  const ref = useRefW(null);

  useEffectW(() => {
    if (paused) return;
    const i = setInterval(() => {
      setLines(prev => {
        const pick = LIVE_LOG_LINES[Math.floor(Math.random() * LIVE_LOG_LINES.length)];
        const next = [...prev, { id: Math.random(), t: nowStamp(0), lvl: pick[0], src: pick[1], msg: pick[2] }];
        if (next.length > 200) next.splice(0, next.length - 200);
        return next;
      });
    }, 1200);
    return () => clearInterval(i);
  }, [paused]);
  useEffectW(() => {
    if (paused || !ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, paused]);

  const filtered = useMemoW(() => {
    const q = query.trim().toLowerCase();
    return lines.filter(l => {
      if (!levels[l.lvl]) return false;
      if (q && !`${l.src}${l.msg}${l.t}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, query, levels]);

  return (
    <div style={{
      background: "oklch(12% 0.01 250)",
      borderRadius: embedded ? 0 : "var(--radius-md)",
      border: embedded ? "none" : "1px solid oklch(22% 0.01 250)",
      overflow: "hidden",
      flex: embedded ? 1 : "0 0 auto",
      display: embedded ? "flex" : "block",
      flexDirection: embedded ? "column" : undefined,
      minHeight: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 12px",
        background: "oklch(16% 0.01 250)",
        borderBottom: "1px solid oklch(22% 0.01 250)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, color: paused ? "oklch(78% 0.16 75)" : "oklch(70% 0.20 152)",
          fontWeight: 600, letterSpacing: "0.04em" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%",
            background: paused ? "oklch(78% 0.16 75)" : "oklch(70% 0.20 152)",
            boxShadow: paused ? "none" : "0 0 0 3px oklch(70% 0.20 152 / 0.20)",
            animation: paused ? "none" : "wbPulse 1.5s ease-in-out infinite",
          }} />
          {paused ? "PAUSED" : "TAILING"}
        </span>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px",
          background: "oklch(18% 0.01 250)",
          border: "1px solid oklch(26% 0.01 250)",
          borderRadius: "var(--radius-sm)",
          flex: 1, minWidth: 180, maxWidth: 320,
        }}>
          <window.Ico name="search" size={11} stroke={1.8} style={{ color: "oklch(55% 0.02 240)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="grep…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              fontFamily: "var(--font-family-mono)", fontSize: 11,
              color: "oklch(92% 0.005 240)", padding: 0,
            }} />
        </div>
        <div style={{ display: "inline-flex", gap: 4 }}>
          {["I", "W", "E"].map(l => {
            const on = levels[l];
            const c = l === "E" ? "oklch(70% 0.18 25)" : l === "W" ? "oklch(80% 0.16 75)" : "oklch(70% 0.05 240)";
            return (
              <button key={l} onClick={() => setLevels(s => ({ ...s, [l]: !s[l] }))}
                style={{
                  padding: "3px 8px", fontSize: 10.5, fontWeight: 600,
                  fontFamily: "var(--font-family-mono)", letterSpacing: "0.04em",
                  background: on ? `color-mix(in oklab, ${c} 16%, transparent)` : "transparent",
                  color: on ? c : "oklch(48% 0.02 240)",
                  border: `1px solid ${on ? `color-mix(in oklab, ${c} 35%, transparent)` : "oklch(26% 0.01 250)"}`,
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  textDecoration: on ? "none" : "line-through",
                }}>{l}</button>
            );
          })}
        </div>
        <button onClick={() => {
          setPaused(p => !p);
          logAction({ tool: "LIVELOG", label: paused ? "Resumed log tail" : "Paused log tail", tone: "neutral" });
        }} style={wbStreamBtn}>
          <window.Ico name={paused ? "refresh" : "chevd"} size={11} stroke={1.8} />
          {paused ? "Resume" : "Pause"}
        </button>
        <span style={{ fontSize: 10, fontFamily: "var(--font-family-mono)", color: "oklch(55% 0.02 240)" }}>
          {filtered.length}/{lines.length}
        </span>
      </div>
      <div ref={ref} style={{
        height: embedded ? "auto" : 460,
        flex: embedded ? 1 : "0 0 auto",
        minHeight: 0,
        overflow: "auto",
        fontFamily: "var(--font-family-mono)", fontSize: 11, lineHeight: 1.55,
        padding: "6px 0",
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "oklch(50% 0.02 240)" }}>
            No lines match yet — new entries arrive every ~1 s.
          </div>
        ) : filtered.map(l => {
          const c = l.lvl === "E" ? "oklch(70% 0.18 25)" : l.lvl === "W" ? "oklch(80% 0.16 75)" : "oklch(70% 0.05 240)";
          const bg = l.lvl === "E" ? "oklch(20% 0.07 25 / 0.4)" : "transparent";
          return (
            <div key={l.id} style={{
              display: "grid",
              gridTemplateColumns: "80px 40px 110px minmax(0, 1fr)",
              gap: 10, padding: "1px 14px",
              background: bg,
            }}>
              <span style={{ color: "oklch(60% 0.02 240)" }}>{l.t}</span>
              <span style={{
                color: c, fontWeight: 600,
                background: `color-mix(in oklab, ${c} 14%, transparent)`,
                padding: "0 5px", borderRadius: 2, textAlign: "center", alignSelf: "center",
              }}>{l.lvl}</span>
              <span style={{ color: "oklch(72% 0.04 240)" }}>{l.src}</span>
              <span style={{ color: l.lvl === "E" ? "oklch(85% 0.10 25)" : "oklch(90% 0.005 240)",
                whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const LIVE_LOG_LINES = [
  ["I", "POS-Pro    ", "Heartbeat ok · idle"],
  ["I", "PayCore    ", "Awaiting tap · contactless reader armed"],
  ["I", "TelemetryAg", "Uploaded metrics batch · 21 KB"],
  ["W", "EMV-Kernel ", "GENERATE AC slow · 480 ms (expected < 400)"],
  ["I", "WifiState  ", "RSSI -56 dBm · stable"],
  ["I", "RIL        ", "LTE Cat-4 · band B7 · RSRP -86 dBm"],
  ["W", "SecureEl   ", "clock drift recompute · +18.4 s"],
  ["I", "POS-Pro    ", "User scrolled order list"],
  ["I", "PayCore    ", "Card detected · waiting AID"],
  ["I", "EMV-Kernel ", "SELECT 2PAY.SYS.DDF01 ok"],
  ["W", "EMV-Kernel ", "GPO response 412 ms"],
  ["E", "EMV-Kernel ", "GENERATE AC timeout after 600 ms"],
  ["E", "PayCore    ", "declined · code = EMV_KERNEL_TIMEOUT"],
  ["I", "POS-Pro    ", "Error dialog shown to cashier"],
  ["I", "TelemetryAg", "Uploading anomaly report"],
];
function seedLiveLogs() {
  return Array.from({ length: 14 }).map((_, i) => {
    const pick = LIVE_LOG_LINES[(i * 7) % LIVE_LOG_LINES.length];
    return { id: i + "-seed", t: nowStamp(-60 + i * 4), lvl: pick[0], src: pick[1], msg: pick[2] };
  });
}
function LiveLogsTool_OLD() { return null; }

// ─── Tool: Remote desk ─────────────────────────────────────
// Split layout: live screen mirror on the left (with hardware-key
// toolbar attached to its right edge) and a tailing log on the right
// using the same chrome as the Live logs tool. Lets the operator
// drive the terminal while watching what it emits in real time.
// ── Remote Desk icons (local) ──
const RD_ICON_PATHS = {
  volUp:     <><path d="M4 9.5v5h3l5 3.5v-12L7 9.5z"/><path d="M16.5 9v6M13.5 12h6"/></>,
  volDown:   <><path d="M4 9.5v5h3l5 3.5v-12L7 9.5z"/><path d="M13.5 12h6"/></>,
  volMute:   <><path d="M4 9.5v5h3l5 3.5v-12L7 9.5z"/><path d="m14.5 9.5 5 5m0-5-5 5"/></>,
  pen:       <><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m14 6 4 4"/></>,
  power:     <><path d="M12 3v9"/><path d="M7.5 7a7 7 0 1 0 9 0"/></>,
  scissors:  <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.12 7.88 20 20"/><path d="M8.12 16.12 20 4"/></>,
  rotateL:   <><path d="M4 9V4h5"/><path d="M4 9a8 8 0 1 1-1 5"/><rect x="9" y="9" width="11" height="11" rx="1.5"/></>,
  rotateR:   <><path d="M20 9V4h-5"/><path d="M20 9a8 8 0 1 0 1 5"/><rect x="4" y="9" width="11" height="11" rx="1.5"/></>,
  navBack:   <><path d="M15 4 6 12l9 8z" fill="currentColor"/></>,
  navHome:   <><circle cx="12" cy="12" r="7.5"/></>,
  navMenu:   <><rect x="4.5" y="4.5" width="15" height="15" rx="1"/></>,
  rectShape: <><rect x="4" y="6" width="16" height="12" rx="1"/></>,
  circShape: <><circle cx="12" cy="12" r="7"/></>,
  lineShape: <><line x1="5" y1="12" x2="19" y2="12"/></>,
  arrowShape:<><path d="M5 17 17 7"/><path d="M11 7h6v6"/></>,
  undo:      <><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></>,
  broom:     <><path d="m16 4-7 7"/><path d="M12 8h5a1 1 0 0 1 1 1v5"/><path d="M5 14h13l-1 6H6z"/></>,
  exit:      <><path d="M14 4h6v16h-6"/><path d="M14 12H4M8 8l-4 4 4 4"/></>,
  check:     <><path d="m4.5 12.5 5 5 10-11"/></>,
  lock:      <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
};
function RDIco({ name, size = 18, stroke = 1.7 }) {
  const paths = RD_ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
  );
}

const RD_RES_OPTIONS = [
  { id: "auto",   label: "Auto (360P)",       w: 640,  h: 360  },
  { id: "360p",   label: "360P",              w: 640,  h: 360  },
  { id: "720p",   label: "720P",              w: 1280, h: 720  },
  { id: "1080p",  label: "1080P",             w: 1920, h: 1080 },
];
const RD_COLORS = [
  { id: "red",    hex: "#EF4444" },
  { id: "orange", hex: "#F97316" },
  { id: "green",  hex: "#22C55E" },
  { id: "blue",   hex: "#3B82F6" },
  { id: "black",  hex: "#111827" },
  { id: "gray",   hex: "#9CA3AF" },
  { id: "white",  hex: "#FFFFFF" },
];
const RD_SIZES = [
  { id: "s", w: 2, dot: 6  },
  { id: "m", w: 4, dot: 10 },
  { id: "l", w: 7, dot: 14 },
];
const RD_SHAPES = [
  { id: "pen",    icon: "pen",        label: "Pen"        },
  { id: "rect",   icon: "rectShape",  label: "Rectangle"  },
  { id: "circle", icon: "circShape",  label: "Circle"     },
  { id: "line",   icon: "lineShape",  label: "Line"       },
  { id: "arrow",  icon: "arrowShape", label: "Arrow"      },
];

// ─── Tool: Remote desk ─────────────────────────────────────
// Light-theme remote screen viewer with side toolbar.
// Toolbar groups (top → bottom):
//   • Volume   — Vol+ · Vol− · Mute
//   • Tools    — Mark · Power · Screenshot · Rotate-L · Rotate-R
//   • Nav      — Back · Home · Menu (Android hardware keys)
// Mark opens a popover with size / color / shape pickers, undo
// and clear. Power toggles the device screen on/off (lock), not
// the session. Right column has tabs for Live logs (off by default,
// gated by a switch) and Screenshots (gallery of captures).
function RemoteDeskTool({ ticket, device, logAction }) {
  const [connState, setConnState] = useStateW("connecting");
  const [muted, setMuted] = useStateW(false);
  const [volume, setVolume] = useStateW(60);
  const [actionPulse, setActionPulse] = useStateW(null);
  const [resolution, setResolution] = useStateW("auto");
  const [resOpen, setResOpen] = useStateW(false);
  const [screenOn, setScreenOn] = useStateW(true);
  const [rotation, setRotation] = useStateW(0);
  const [shotFlash, setShotFlash] = useStateW(false);
  // Annotation
  const [annOn, setAnnOn] = useStateW(false);
  const [annShape, setAnnShape] = useStateW("pen");
  const [annColorId, setAnnColorId] = useStateW("red");
  const [annSizeIdx, setAnnSizeIdx] = useStateW(1);
  const [annShapes, setAnnShapes] = useStateW([]);
  const [drawing, setDrawing] = useStateW(null);
  // Right column
  const [rightTab, setRightTab] = useStateW("logs");
  const [logsOn, setLogsOn] = useStateW(false);
  const [shots, setShots] = useStateW([]);
  // Column-mode toggle — "split" (default), "left" (screen only),
  // "right" (logs / screenshots only). Lets the operator widen
  // whichever pane needs focus without leaving the tool.
  const [colMode, setColMode] = useStateW("split");

  const annSvgRef = useRefW(null);
  const resPopRef = useRefW(null);

  useEffectW(() => {
    const t = setTimeout(() => setConnState("connected"), 700);
    return () => clearTimeout(t);
  }, []);
  useEffectW(() => {
    if (!resOpen) return;
    const onDoc = (e) => {
      if (resPopRef.current && !resPopRef.current.contains(e.target)) setResOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [resOpen]);

  const resOpt   = RD_RES_OPTIONS.find(r => r.id === resolution) || RD_RES_OPTIONS[0];
  const annColor = RD_COLORS.find(c => c.id === annColorId)?.hex || "#EF4444";
  const annSize  = RD_SIZES[annSizeIdx].w;
  const isLandscape = rotation === 90 || rotation === 270;
  const canInteract = connState === "connected";

  const pulse = (id) => {
    setActionPulse(id);
    setTimeout(() => setActionPulse(null), 240);
  };
  const pressKey = (id, label, detail) => () => {
    if (!canInteract) return;
    pulse(id);
    if (id === "vol-up")   setVolume(v => Math.min(100, v + 10));
    if (id === "vol-down") setVolume(v => Math.max(0,   v - 10));
    if (id === "mute")     setMuted(m => !m);
    logAction({ tool: "REMOTE", label: `Key · ${label}`, tone: "neutral", detail });
    window.showToast?.(`${label} sent`, "info");
  };
  const togglePower = () => {
    if (!canInteract) return;
    pulse("power");
    setScreenOn(s => !s);
    const next = !screenOn;
    logAction({ tool: "REMOTE", label: next ? "Power · screen on" : "Power · screen off",
      tone: "neutral", detail: next ? "Display unlocked" : "Display locked" });
    window.showToast?.(next ? "Screen on" : "Screen off", "info");
  };
  const onScreenshot = () => {
    if (!canInteract) return;
    pulse("shot");
    setShotFlash(true);
    setTimeout(() => setShotFlash(false), 360);
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const id = `shot-${Date.now()}`;
    setShots(s => [{ id, ts: stamp, w: resOpt.w, h: resOpt.h,
      marks: annShapes.length, rotation, label: resOpt.label }, ...s]);
    setRightTab("shots");
    logAction({ tool: "REMOTE", label: "Screenshot captured",
      tone: "ok", detail: `${resOpt.w} × ${resOpt.h}` });
    window.showToast?.("Screenshot saved", "success");
  };
  const rotateBy = (delta) => () => {
    if (!canInteract) return;
    pulse(delta < 0 ? "rotL" : "rotR");
    setRotation(r => (((r + delta) % 360) + 360) % 360);
    logAction({ tool: "REMOTE", label: delta < 0 ? "Rotate · left 90°" : "Rotate · right 90°",
      tone: "neutral" });
  };
  const toggleAnnotate = () => {
    if (!canInteract) return;
    pulse("ann");
    setAnnOn(v => !v);
    if (!annOn) {
      logAction({ tool: "REMOTE", label: "Annotation · on", tone: "neutral" });
    } else {
      logAction({ tool: "REMOTE", label: "Annotation · off", tone: "neutral",
        detail: `${annShapes.length} shape${annShapes.length === 1 ? '' : 's'}` });
    }
  };
  const clearAnnotations = () => { setAnnShapes([]); setDrawing(null); };
  const undoAnnotation   = () => setAnnShapes(s => s.slice(0, -1));

  // SVG pointer handlers
  const svgPt = (e) => {
    const svg = annSvgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 720;
    const y = ((e.clientY - rect.top)  / rect.height) * 1280;
    return [Math.round(x), Math.round(y)];
  };
  const onDrawDown = (e) => {
    if (!annOn || !canInteract) return;
    e.preventDefault();
    const [x, y] = svgPt(e);
    const base = { kind: annShape, color: annColor, size: annSize };
    if (annShape === "pen") setDrawing({ ...base, points: [[x, y]] });
    else                     setDrawing({ ...base, x1: x, y1: y, x2: x, y2: y });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  };
  const onDrawMove = (e) => {
    if (!drawing) return;
    const [x, y] = svgPt(e);
    if (drawing.kind === "pen")
      setDrawing(d => ({ ...d, points: [...d.points, [x, y]] }));
    else
      setDrawing(d => ({ ...d, x2: x, y2: y }));
  };
  const onDrawUp = () => {
    if (!drawing) return;
    if (drawing.kind === "pen" && drawing.points.length < 2) { setDrawing(null); return; }
    if (drawing.kind !== "pen" && Math.hypot(drawing.x2 - drawing.x1,
        drawing.y2 - drawing.y1) < 6) { setDrawing(null); return; }
    setAnnShapes(s => [...s, drawing]);
    setDrawing(null);
  };

  const renderShape = (s, key) => {
    const stroke = s.color, w = s.size;
    if (s.kind === "pen") return <polyline key={key}
      points={s.points.map(p => p.join(",")).join(" ")}
      fill="none" stroke={stroke} strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" />;
    if (s.kind === "line") return <line key={key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
      stroke={stroke} strokeWidth={w} strokeLinecap="round" />;
    if (s.kind === "arrow") {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const head = Math.max(18, w * 4);
      const ax = s.x2 - ux * head, ay = s.y2 - uy * head;
      const px = -uy, py = ux, h = head * 0.55;
      return <g key={key}>
        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        <polygon points={`${s.x2},${s.y2} ${ax + px * h},${ay + py * h} ${ax - px * h},${ay - py * h}`}
          fill={stroke} />
      </g>;
    }
    if (s.kind === "rect") {
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2);
      const ww = Math.abs(s.x2 - s.x1), hh = Math.abs(s.y2 - s.y1);
      return <rect key={key} x={x} y={y} width={ww} height={hh} rx={6}
        fill="none" stroke={stroke} strokeWidth={w} />;
    }
    if (s.kind === "circle") {
      const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2;
      const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
      return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke={stroke} strokeWidth={w} />;
    }
    return null;
  };

  // ─── Render ───
  // Inject the column-mode toggle into the drawer's title bar via
  // portal so its visual home matches its functional role (drawer
  // chrome, not body content). Falls back to inline if no slot is
  // available (e.g. RemoteDeskTool ever used outside a WBToolDrawer).
  const headerSlotEl = React.useContext(WBDrawerHeaderContext);
  const colBar = <ColModeBar mode={colMode} onChange={setColMode} />;
  return (
    <div style={{
      // When only the screen is visible the layout collapses to a
      // centering flex container so the (height-driven, 9:16) screen
      // sits in the middle of the available area instead of being
      // pinned to the left edge of a fr-column.
      display: colMode === "split" ? "grid" : "flex",
      gridTemplateColumns: colMode === "split"
        ? "auto minmax(320px, 1fr)" : undefined,
      justifyContent: colMode === "left" ? "center" : "stretch",
      gap: 14, alignItems: "stretch",
      height: "100%", minHeight: 480,
    }}>
      {headerSlotEl
        ? ReactDOM.createPortal(colBar, headerSlotEl)
        : <div style={{ gridColumn: "1 / -1" }}>{colBar}</div>}
      {/* ── LEFT — device screen with side toolbar ───────── */}
      {colMode !== "right" && (
      <div style={{
        background: "var(--color-bg-1, #ffffff)",
        border: "1px solid var(--color-border-default, #e5e7eb)",
        borderRadius: "var(--radius-md, 10px)",
        display: "flex", flexDirection: "column",
        overflow: "hidden", minHeight: 0,
        // In split mode width is anchored to the 9:16 portrait screen
        // (~9/16 of the available height + 88 px for the toolbar /
        // padding). In screen-only mode we let the screen's intrinsic
        // height-driven width determine the card width (auto), so the
        // card centers cleanly inside the parent flex container and
        // grows with the drawer height — including maximized mode.
        width: colMode === "left"
          ? "auto"
          : "clamp(340px, calc(46vh + 88px), 520px)",
        maxWidth: "100%",
        maxHeight: "100%",
        flexShrink: 0,
      }}>
        {/* Session header */}
        <div style={{
          padding: "10px 14px",
          background: "var(--color-bg-1, #fff)",
          borderBottom: "1px solid var(--color-border-subtle, #eef2f6)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          fontFamily: "var(--font-family-sans)", fontSize: 12,
          color: "var(--color-text-secondary, #475569)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            color: connState === "connected" ? "#15803d"
                 : connState === "ended"     ? "#64748b" : "#b45309" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%",
              background: connState === "connected" ? "#22c55e"
                       : connState === "ended"     ? "#94a3b8" : "#f59e0b",
              boxShadow: connState === "connected"
                ? "0 0 0 3px rgba(34,197,94,0.18)" : "none",
              animation: connState === "connected" ? "wbPulse 2s ease-in-out infinite" : "none",
            }} />
            {connState === "connected" ? "CONNECTED"
              : connState === "ended" ? "ENDED" : "CONNECTING…"}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontWeight: 600, color: "var(--color-text-primary, #0f172a)",
          }}>
            <window.Ico name="device" size={14} />
            <span style={{ fontFamily: "var(--font-family-mono)" }}>{ticket.deviceSn}</span>
          </span>
          <span style={{ color: "var(--color-border-default, #cbd5e1)" }}>·</span>
          <span style={{ color: "var(--color-text-tertiary, #64748b)" }}>{device?.model || "—"}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "var(--color-text-tertiary, #94a3b8)", fontSize: 11.5 }}>
              {muted ? "muted" : `vol ${volume}%`}
            </span>
            {/* Resolution selector */}
            <span ref={resPopRef} style={{ position: "relative" }}>
              <button type="button" onClick={() => setResOpen(o => !o)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 8,
                  background: resOpen ? "var(--color-bg-hover, #f1f5f9)" : "#fff",
                  border: "1px solid var(--color-border-default, #e2e8f0)",
                  color: "var(--color-text-primary, #0f172a)",
                  fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  fontWeight: 500,
                }}>
                <span>{resOpt.label}</span>
                <window.Ico name="chevdown" size={12} stroke={2} />
              </button>
              {resOpen && (
                <div role="listbox" style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  minWidth: 180, padding: 4,
                  background: "#fff",
                  border: "1px solid var(--color-border-default, #e2e8f0)",
                  borderRadius: 10, boxShadow: "0 16px 32px -12px rgba(15,23,42,0.18)",
                  zIndex: 8,
                }}>
                  {RD_RES_OPTIONS.map(opt => {
                    const active = opt.id === resolution;
                    return (
                      <button key={opt.id} type="button"
                        onClick={() => {
                          setResolution(opt.id); setResOpen(false);
                          logAction({ tool: "REMOTE",
                            label: `Resolution · ${opt.label}`,
                            tone: "neutral", detail: `${opt.w} × ${opt.h}` });
                        }}
                        style={{
                          display: "flex", width: "100%", alignItems: "center",
                          justifyContent: "space-between",
                          padding: "7px 9px", borderRadius: 6,
                          background: active ? "#eff6ff" : "transparent",
                          color: active ? "#1d4ed8" : "var(--color-text-primary, #0f172a)",
                          border: 0, cursor: "pointer",
                          fontFamily: "inherit", fontSize: 12, fontWeight: active ? 600 : 500,
                        }}>
                        <span>{opt.label}</span>
                        {active && <window.Ico name="check" size={12} stroke={2.4} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </span>
          </span>
        </div>

        {/* Screen + side toolbar */}
        <div style={{
          flex: 1, minHeight: 0,
          display: "flex", gap: 10, padding: 12,
          background: "var(--color-bg-2, #f8fafc)",
          justifyContent: "center",
        }}>
          {/* Screen mock — light, no phone frame, just the screen. Sized
              by its 720×1280 aspect ratio and the available height; the
              outer card (grid column = auto) shrinks to fit so there's no
              wasted gray space on either side of the screen. */}
          <div style={{
            aspectRatio: "720 / 1280",
            height: "100%", width: "auto",
            maxWidth: "100%", maxHeight: "100%",
            background: "#ffffff",
            border: "1px solid var(--color-border-default, #e2e8f0)",
            borderRadius: 14,
            boxShadow: "0 14px 30px -16px rgba(15,23,42,0.18)",
            position: "relative",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            {/* Rotating viewport */}
            <div style={{
              flex: 1, minHeight: 0, position: "relative",
              display: "flex", flexDirection: "column",
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform .35s cubic-bezier(.3,.7,.2,1)",
            }}>
              {/* Status bar */}
              <div style={{
                padding: "10px 14px 6px",
                display: "flex", justifyContent: "space-between",
                fontFamily: "var(--font-family-mono)", fontSize: 10.5,
                color: "#0f172a",
              }}>
                <span>14:32</span>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span>4G</span>
                  <span>▮▮▯</span>
                </span>
              </div>

              {/* App content — Acme POS Pro mock */}
              <div style={{
                flex: 1, minHeight: 0,
                display: "flex", flexDirection: "column",
                background: "#f8fafc",
                color: "#0f172a",
                padding: 16, gap: 14, position: "relative",
                borderRadius: 12, margin: "0 10px 10px",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700,
                    letterSpacing: "-0.01em", color: "#1d4ed8" }}>Acme POS Pro</span>
                  <span style={{
                    padding: "3px 8px", borderRadius: 999,
                    background: "#dcfce7", color: "#166534",
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                  }}>READY</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["Espresso", "$4.25"],
                    ["Croissant", "$3.50"],
                    ["Bag of beans 250g", "$18.00"],
                  ].map(([n, p]) => (
                    <div key={n} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "8px 10px", borderRadius: 6,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      fontSize: 11, color: "#0f172a",
                    }}>
                      <span>{n}</span>
                      <span style={{ fontFamily: "var(--font-family-mono)",
                        fontWeight: 600 }}>{p}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: "auto",
                  padding: "10px 12px", borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}>
                  <div style={{ fontSize: 10, color: "#1d4ed8",
                    fontWeight: 500, letterSpacing: "0.04em",
                    textTransform: "uppercase" }}>Total</div>
                  <div style={{ fontFamily: "var(--font-family-mono)",
                    fontSize: 22, fontWeight: 700, color: "#1e3a8a",
                    marginTop: 2 }}>$25.75</div>
                </div>
                <button style={{
                  padding: "12px 14px", borderRadius: 8,
                  background: "#2563eb", color: "white",
                  border: 0, fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer",
                }}>Charge · Tap card</button>
              </div>
            </div>

            {/* SVG annotation overlay */}
            <svg ref={annSvgRef}
              viewBox="0 0 720 1280" preserveAspectRatio="none"
              onPointerDown={onDrawDown}
              onPointerMove={onDrawMove}
              onPointerUp={onDrawUp}
              onPointerCancel={onDrawUp}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                pointerEvents: annOn && canInteract && screenOn ? "auto" : "none",
                cursor: annOn ? "crosshair" : "default",
                touchAction: "none",
              }}>
              {annShapes.map((s, i) => renderShape(s, i))}
              {drawing && renderShape(drawing, "drawing")}
            </svg>

            {/* Screen-off overlay (power lock) */}
            {!screenOn && connState === "connected" && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(15,23,42,0.94)",
                display: "grid", placeItems: "center",
                color: "#cbd5e1",
                fontFamily: "var(--font-family-mono)", fontSize: 11,
                letterSpacing: "0.06em",
                zIndex: 4,
              }}>
                <span style={{ display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 6, textTransform: "uppercase" }}>
                  <RDIco name="lock" size={20} />
                  <span>Screen off</span>
                </span>
              </div>
            )}

            {/* Screenshot flash */}
            {shotFlash && (
              <div style={{
                position: "absolute", inset: 0, background: "white",
                animation: "fade-in 80ms ease-out, fadeOutShot 300ms ease-out 60ms forwards",
                zIndex: 5, pointerEvents: "none",
              }} />
            )}

            {/* Connecting / ended overlay */}
            {connState !== "connected" && (
              <div style={{
                position: "absolute", inset: 0,
                background: connState === "ended"
                  ? "rgba(248,250,252,0.92)" : "rgba(248,250,252,0.7)",
                display: "grid", placeItems: "center",
                color: "#475569",
                fontFamily: "var(--font-family-mono)", fontSize: 12,
                letterSpacing: "0.04em",
                backdropFilter: "blur(2px)",
                zIndex: 6,
              }}>
                {connState === "ended"
                  ? <span style={{ display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 6 }}>
                      <window.Ico name="alert" size={18} style={{ color: "#b45309" }} />
                      <span>Session ended</span>
                    </span>
                  : <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: "50%",
                        border: "2px solid #cbd5e1",
                        borderTopColor: "#2563eb",
                        animation: "spin 0.8s linear infinite",
                      }} />
                      Establishing remote session…
                    </span>}
              </div>
            )}

            {/* Rotation badge */}
            {rotation !== 0 && connState === "connected" && (
              <div style={{
                position: "absolute", bottom: 8, left: 8,
                padding: "3px 8px", borderRadius: 99,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid #e2e8f0",
                color: "#1d4ed8",
                fontFamily: "var(--font-family-mono)", fontSize: 10,
                letterSpacing: "0.04em", zIndex: 2,
                fontWeight: 600,
              }}>{isLandscape ? "LANDSCAPE" : "INVERTED"} · {rotation}°</div>
            )}
          </div>

          {/* Side toolbar (right-attached) */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            padding: 6,
            background: "#ffffff",
            border: "1px solid var(--color-border-default, #e2e8f0)",
            borderRadius: 12,
            width: 52,
            flexShrink: 0,
            boxShadow: "0 4px 10px -6px rgba(15,23,42,0.08)",
          }}>
            {/* Group A — Volume */}
            <HwKey id="vol-up" icon="volUp" label="Vol +"
              pulsing={actionPulse === "vol-up"}
              disabled={!canInteract}
              onClick={pressKey("vol-up", "Volume up", `Now ${Math.min(100, volume + 10)}%`)} />
            <HwKey id="vol-down" icon="volDown" label="Vol −"
              pulsing={actionPulse === "vol-down"}
              disabled={!canInteract}
              onClick={pressKey("vol-down", "Volume down", `Now ${Math.max(0, volume - 10)}%`)} />
            <HwKey id="mute" icon="volMute" label="Mute"
              tone={muted ? "active" : "default"}
              pulsing={actionPulse === "mute"}
              disabled={!canInteract}
              onClick={pressKey("mute", muted ? "Unmute" : "Mute",
                muted ? "Audio restored" : "Audio muted")} />

            <RdDivider />

            {/* Group B — Tools */}
            <div style={{ position: "relative" }}>
              <HwKey id="annotate" icon="pen" label="Mark"
                tone={annOn ? "active" : "default"}
                pulsing={actionPulse === "ann"}
                disabled={!canInteract}
                onClick={toggleAnnotate} />
              {annOn && (
                <MarkPanel
                  shape={annShape}    onShape={setAnnShape}
                  colorId={annColorId} onColor={setAnnColorId}
                  sizeIdx={annSizeIdx} onSize={setAnnSizeIdx}
                  onUndo={undoAnnotation}
                  onClear={clearAnnotations}
                  onClose={() => setAnnOn(false)}
                  hasShapes={annShapes.length > 0}
                />
              )}
            </div>
            <HwKey id="power" icon="power" label={screenOn ? "Lock screen" : "Wake screen"}
              tone={!screenOn ? "active" : "default"}
              pulsing={actionPulse === "power"}
              disabled={!canInteract}
              onClick={togglePower} />
            <HwKey id="screenshot" icon="scissors" label="Screenshot"
              pulsing={actionPulse === "shot"}
              disabled={!canInteract}
              onClick={onScreenshot} />
            <HwKey id="rotL" icon="rotateL" label="Rotate left"
              pulsing={actionPulse === "rotL"}
              disabled={!canInteract}
              onClick={rotateBy(-90)} />
            <HwKey id="rotR" icon="rotateR" label="Rotate right"
              pulsing={actionPulse === "rotR"}
              disabled={!canInteract}
              onClick={rotateBy(90)} />

            {/* Group C — Android nav (pushed to bottom) */}
            <div style={{ marginTop: "auto", display: "flex",
              flexDirection: "column", gap: 4, paddingTop: 4 }}>
              <RdDivider />
              <HwKey id="back" icon="navBack" label="Back" variant="nav"
                pulsing={actionPulse === "back"}
                disabled={!canInteract}
                onClick={pressKey("back", "Back key", "Navigated back")} />
              <HwKey id="home" icon="navHome" label="Home" variant="nav"
                pulsing={actionPulse === "home"}
                disabled={!canInteract}
                onClick={pressKey("home", "Home key", "Returned to launcher")} />
              <HwKey id="menu" icon="navMenu" label="Menu" variant="nav"
                pulsing={actionPulse === "menu"}
                disabled={!canInteract}
                onClick={pressKey("menu", "Menu / Recents", "Opened recent apps")} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── RIGHT — logs + screenshots ──────────────────────── */}
      {colMode !== "left" && (
      <div style={{
        display: "flex", flexDirection: "column", minHeight: 0,
        background: "var(--color-bg-1, #ffffff)",
        border: "1px solid var(--color-border-default, #e5e7eb)",
        borderRadius: "var(--radius-md, 10px)",
        overflow: "hidden",
        // In split mode the grid's "1fr" track sizes us. In logs-only
        // mode the parent is a centering flex, so we need to claim the
        // full width ourselves — otherwise we shrink-to-fit and sit
        // narrow in the middle of the drawer.
        flex: colMode === "right" ? "1 1 auto" : undefined,
        width: colMode === "right" ? "100%" : undefined,
      }}>
        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2, padding: "8px 8px 0",
          borderBottom: "1px solid var(--color-border-subtle, #eef2f6)",
          background: "#fff",
        }}>
          <RDTab active={rightTab === "logs"}
            onClick={() => setRightTab("logs")}>
            Live logs
            <span style={{
              marginLeft: 6, padding: "1px 6px", borderRadius: 99,
              background: logsOn ? "#dcfce7" : "#f1f5f9",
              color:      logsOn ? "#15803d" : "#64748b",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
            }}>{logsOn ? "ON" : "OFF"}</span>
          </RDTab>
          <RDTab active={rightTab === "shots"}
            onClick={() => setRightTab("shots")}>
            Screenshots
            {shots.length > 0 && (
              <span style={{
                marginLeft: 6, padding: "1px 6px", borderRadius: 99,
                background: rightTab === "shots" ? "#eff6ff" : "#f1f5f9",
                color:      rightTab === "shots" ? "#1d4ed8" : "#64748b",
                fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>{shots.length}</span>
            )}
          </RDTab>
        </div>

        {/* Content */}
        {rightTab === "logs" ? (
          <LogsTabContent logsOn={logsOn} setLogsOn={setLogsOn}
            logAction={logAction} canInteract={canInteract} />
        ) : (
          <ShotsTabContent shots={shots}
            onClearAll={() => {
              setShots([]);
              logAction({ tool: "REMOTE", label: "Cleared screenshots",
                tone: "neutral" });
            }} />
        )}
      </div>
      )}

      {/* Local keyframes */}
      <style>{"@keyframes fadeOutShot { to { opacity: 0; } }"}</style>
    </div>
  );
}

function RdDivider() {
  return <span style={{ height: 1, background: "var(--color-border-subtle, #eef2f6)",
    margin: "4px 6px" }} />;
}

// ─── Column-mode toggle ──────────────────────────────────
// Floating segmented control that lets the operator collapse one of
// the two columns away. Lives in the top-right of the Remote-desk
// viewport so it doesn't clash with the side toolbar.
function ColModeBar({ mode, onChange }) {
  const opts = [
    { id: "left",  icon: "navBack",  label: "Screen only", title: "Screen only — hide logs / screenshots" },
    { id: "split", icon: "app",      label: "Split",       title: "Show both columns" },
    { id: "right", icon: "doc",      label: "Logs only",   title: "Logs only — hide screen mirror" },
  ];
  return (
    <div role="group" aria-label="Column layout"
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        padding: 3,
        background: "var(--color-bg-1, #fff)",
        border: "1px solid var(--color-border-default, #e2e8f0)",
        borderRadius: 999,
      }}>
        {opts.map(o => {
          const on = mode === o.id;
          return (
            <button key={o.id} type="button"
              onClick={() => onChange(o.id)}
              title={o.title}
              aria-pressed={on}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 999,
                background: on ? "#0f172a" : "transparent",
                color: on ? "#ffffff" : "#475569",
                border: 0, cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                transition: "background .12s ease, color .12s ease",
              }}
              onMouseEnter={(e) => { if (!on)
                e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { if (!on)
                e.currentTarget.style.background = "transparent"; }}>
              <ColModeGlyph mode={o.id} on={on} />
              <span>{o.label}</span>
            </button>
          );
        })}
    </div>
  );
}

// Two-pane icon — fills/empties the panes based on which mode this
// option represents. Tiny but reads clearly at the segmented-control
// scale.
function ColModeGlyph({ mode, on }) {
  const stroke = on ? "#ffffff" : "#94a3b8";
  const fill   = on ? "#ffffff" : "#cbd5e1";
  const left   = mode === "left"  || mode === "split";
  const right  = mode === "right" || mode === "split";
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden="true">
      <rect x="0.7" y="0.7" width="5.6" height="9.6" rx="1.2"
        fill={left ? fill : "transparent"} stroke={stroke} strokeWidth="0.9" />
      <rect x="7.7" y="0.7" width="5.6" height="9.6" rx="1.2"
        fill={right ? fill : "transparent"} stroke={stroke} strokeWidth="0.9" />
    </svg>
  );
}

// ─── Side-toolbar button ─────────────────────────────────
// White-style icon button. Tone "active" = filled blue (toggle on).
function HwKey({ icon, label, tone = "default", variant = "default",
                 pulsing, disabled, onClick }) {
  const isActive = tone === "active";
  const isNav    = variant === "nav";
  const bg = disabled  ? "transparent"
           : isActive  ? "#2563eb"
           : pulsing   ? "#dbeafe"
                       : "transparent";
  const fg = disabled  ? "#cbd5e1"
           : isActive  ? "#ffffff"
                       : "#334155";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      title={label} aria-label={label}
      onMouseEnter={(e) => { if (!disabled && !isActive)
        e.currentTarget.style.background = "#f1f5f9"; }}
      onMouseLeave={(e) => { if (!disabled && !isActive)
        e.currentTarget.style.background = pulsing ? "#dbeafe" : "transparent"; }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 38, width: "100%",
        padding: 0,
        background: bg, color: fg,
        border: "1px solid " + (isActive ? "#1d4ed8" : "transparent"),
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .12s ease, color .12s ease",
        opacity: disabled ? 0.5 : 1,
      }}>
      <RDIco name={icon} size={isNav ? 18 : 18} stroke={isNav ? 1.8 : 1.7} />
    </button>
  );
}

// ─── Mark popover ────────────────────────────────────────
// Pops out to the LEFT of the Mark button.
function MarkPanel({ shape, onShape, colorId, onColor, sizeIdx, onSize,
                     onUndo, onClear, onClose, hasShapes }) {
  const activeColor = RD_COLORS.find(c => c.id === colorId)?.hex || "#EF4444";
  return (
    <div style={{
      position: "absolute", top: 0, right: "calc(100% + 10px)",
      width: 268, padding: 0,
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      boxShadow: "0 18px 38px -16px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.02)",
      zIndex: 12,
      fontFamily: "var(--font-family-sans)",
    }}>
      {/* Connector arrow pointing to the Mark button */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 14, right: -6,
        width: 12, height: 12,
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        borderTop: "1px solid #e2e8f0",
        transform: "rotate(45deg)",
      }} />

      {/* Row 1 — sizes + close */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 12px 10px",
        borderBottom: "1px solid #eef2f6",
      }}>
        {RD_SIZES.map((s, i) => {
          const active = sizeIdx === i;
          return (
            <button key={s.id} type="button"
              onClick={() => onSize(i)}
              title={"Size " + s.id.toUpperCase()}
              style={{
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: active ? "1.5px solid " + activeColor : "1.5px solid transparent",
                cursor: "pointer", padding: 0,
                transition: "border-color .12s ease",
              }}>
              <span style={{
                width: s.dot, height: s.dot, borderRadius: "50%",
                background: activeColor, display: "block",
              }} />
            </button>
          );
        })}
        <button type="button" onClick={onClose}
          title="Close"
          style={{
            marginLeft: "auto",
            width: 30, height: 30, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", color: "#334155",
            border: "1px solid #e2e8f0", cursor: "pointer", padding: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <RDIco name="exit" size={16} stroke={1.7} />
        </button>
      </div>

      {/* Row 2 — colors */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px",
        borderBottom: "1px solid #eef2f6",
      }}>
        {RD_COLORS.map(c => {
          const active = c.id === colorId;
          const isWhite = c.id === "white";
          return (
            <button key={c.id} type="button"
              onClick={() => onColor(c.id)}
              title={c.id}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: c.hex,
                border: isWhite ? "1px solid #cbd5e1" : "1px solid rgba(15,23,42,0.06)",
                cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isWhite ? "#0f172a" : "#ffffff",
                boxShadow: active ? "0 0 0 2px #fff, 0 0 0 3.5px " + c.hex : "none",
                transition: "box-shadow .12s ease",
              }}>
              {active && <RDIco name="check" size={16} stroke={2.4} />}
            </button>
          );
        })}
      </div>

      {/* Row 3 — shapes */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "12px",
      }}>
        {RD_SHAPES.map(s => {
          const active = s.id === shape;
          return (
            <button key={s.id} type="button"
              onClick={() => onShape(s.id)}
              title={s.label}
              style={{
                width: 38, height: 38, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "#2563eb" : "#ffffff",
                color: active ? "#ffffff" : "#334155",
                border: "1px solid " + (active ? "#1d4ed8" : "#e2e8f0"),
                cursor: "pointer", padding: 0,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "#ffffff"; }}>
              <RDIco name={s.icon} size={18} stroke={1.9} />
            </button>
          );
        })}
      </div>

      {/* Row 4 — undo / clear */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 12px 12px",
        borderTop: "1px solid #eef2f6",
        justifyContent: "flex-end",
      }}>
        <button type="button" onClick={onUndo}
          disabled={!hasShapes}
          title="Undo"
          style={{
            width: 36, height: 36, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", color: hasShapes ? "#334155" : "#cbd5e1",
            border: "1px solid #e2e8f0",
            cursor: hasShapes ? "pointer" : "not-allowed", padding: 0,
          }}>
          <RDIco name="undo" size={16} stroke={1.9} />
        </button>
        <button type="button" onClick={onClear}
          disabled={!hasShapes}
          title="Clear all"
          style={{
            width: 36, height: 36, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", color: hasShapes ? "#334155" : "#cbd5e1",
            border: "1px solid #e2e8f0",
            cursor: hasShapes ? "pointer" : "not-allowed", padding: 0,
          }}>
          <RDIco name="broom" size={16} stroke={1.9} />
        </button>
      </div>
    </div>
  );
}

// ─── Right column: tab button ────────────────────────────
function RDTab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "8px 14px 9px",
        background: "transparent",
        color: active ? "#0f172a" : "#64748b",
        fontFamily: "inherit", fontSize: 13,
        fontWeight: active ? 600 : 500,
        border: 0, cursor: "pointer",
        borderBottom: "2px solid " + (active ? "#2563eb" : "transparent"),
        marginBottom: -1,
      }}>
      {children}
    </button>
  );
}

// ─── Right column: Live logs tab ─────────────────────────
function LogsTabContent({ logsOn, setLogsOn, logAction, canInteract }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--color-border-subtle, #eef2f6)",
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--color-bg-1, #fff)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600,
            color: "var(--color-text-primary, #0f172a)" }}>
            Stream device log tail
          </div>
          <div style={{ fontSize: 11.5,
            color: "var(--color-text-tertiary, #64748b)", marginTop: 2 }}>
            {logsOn
              ? "Tailing — every emitted line appears below."
              : "Off — toggle on to start streaming."}
          </div>
        </div>
        <RdSwitch on={logsOn}
          disabled={!canInteract}
          onChange={(v) => {
            setLogsOn(v);
            logAction({ tool: "REMOTE",
              label: v ? "Live logs · on" : "Live logs · off",
              tone: "neutral" });
          }} />
      </div>
      {logsOn ? (
        <LiveLogsTool logAction={logAction} embedded />
      ) : (
        <div style={{
          flex: 1, display: "grid", placeItems: "center",
          color: "var(--color-text-tertiary, #94a3b8)",
          fontSize: 12, padding: 24, textAlign: "center",
        }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <window.Ico name="bolt" size={22} style={{
                color: "var(--color-text-tertiary, #cbd5e1)",
              }} />
            </div>
            <div>Live log stream is paused.</div>
            <div style={{ fontSize: 11, marginTop: 4,
              color: "var(--color-text-tertiary, #94a3b8)" }}>
              Enable the switch above to start tailing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RdSwitch({ on, disabled, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: on ? "#2563eb" : "#cbd5e1",
        border: 0, cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", padding: 0, flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s ease",
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
        transition: "left .18s cubic-bezier(.4,.2,.2,1)",
      }} />
    </button>
  );
}

// ─── Right column: Screenshots tab ───────────────────────
function ShotsTabContent({ shots, onClearAll }) {
  if (shots.length === 0) {
    return (
      <div style={{
        flex: 1, display: "grid", placeItems: "center",
        color: "var(--color-text-tertiary, #94a3b8)",
        fontSize: 12, padding: 24, textAlign: "center",
      }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <RDIco name="scissors" size={22} stroke={1.6} />
          </div>
          <div>No screenshots yet.</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Use the Screenshot tool to capture the remote screen.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column",
      minHeight: 0, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--color-border-subtle, #eef2f6)",
        background: "#fff",
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 600,
          color: "var(--color-text-primary, #0f172a)" }}>
          {shots.length} capture{shots.length === 1 ? "" : "s"}
        </div>
        <button type="button" onClick={onClearAll}
          style={{
            padding: "4px 10px", borderRadius: 6,
            background: "transparent", border: "1px solid #e2e8f0",
            color: "#475569", cursor: "pointer", fontSize: 11.5,
          }}>Clear</button>
      </div>
      <div style={{
        flex: 1, overflowY: "auto",
        display: "flex", flexDirection: "column",
        gap: 6, padding: 10,
      }}>
        {shots.map(shot => <ShotCard key={shot.id} shot={shot} />)}
      </div>
    </div>
  );
}

// Compact list row — small portrait thumbnail on the left, metadata on
// the right. A row keeps the card height bounded (no 9:16 columns that
// turn into towers) and matches the dense info-list style elsewhere in
// the workbench.
function ShotCard({ shot }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: 8,
      padding: 8, transition: "border-color .12s ease, background .12s ease",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#cbd5e1";
                            e.currentTarget.style.background = "#f8fafc"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.background = "#fff"; }}>
      {/* Thumbnail */}
      <div style={{
        position: "relative", flexShrink: 0,
        width: 40, height: 64,
        borderRadius: 4, overflow: "hidden",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex", flexDirection: "column",
        padding: 3, gap: 2,
      }}>
        <div style={{ height: 3, background: "#cbd5e1", borderRadius: 1,
          width: "55%" }} />
        <div style={{ height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ height: 2, background: "#e2e8f0", borderRadius: 1 }} />
        <div style={{ marginTop: "auto", height: 5, background: "#2563eb",
          borderRadius: 1 }} />
      </div>

      {/* Metadata */}
      <div style={{ flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontFamily: "var(--font-family-mono)", fontSize: 12,
          fontWeight: 600, color: "#0f172a",
        }}>{shot.ts}</span>
        <span style={{
          fontSize: 11, color: "#64748b",
          fontFamily: "var(--font-family-mono)",
        }}>{shot.w} × {shot.h}</span>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexDirection: "column",
        alignItems: "flex-end", gap: 3 }}>
        {shot.marks > 0 && (
          <span style={{
            padding: "1px 6px", borderRadius: 99,
            background: "#fee2e2", color: "#b91c1c",
            fontSize: 10, fontWeight: 600,
            fontFamily: "var(--font-family-mono)",
          }}>{shot.marks} mark{shot.marks === 1 ? "" : "s"}</span>
        )}
        {shot.rotation !== 0 && (
          <span style={{
            padding: "1px 6px", borderRadius: 99,
            background: "#f1f5f9", color: "#475569",
            fontSize: 10, fontWeight: 600,
            fontFamily: "var(--font-family-mono)",
          }}>{shot.rotation}°</span>
        )}
      </div>
    </div>
  );
}

// ─── Tool: File extraction ─────────────────────────────────
function FilePullTool({ logAction }) {
  const [path, setPath] = useStateW("/data/local/tmp/");
  const [pulling, setPulling] = useStateW(null); // { name, pct }
  const [files, setFiles] = useStateW(() => [
    { name: "crash-dump-2026-05-15.tar", path: "/data/anr/", size: "212 KB", pulledAt: "May 15, 2026 14:35" },
    { name: "settings.db",               path: "/data/data/com.toms.mdm/", size: "84 KB",  pulledAt: "May 15, 2026 13:18" },
  ]);
  const presets = [
    { label: "ANR crashes",     path: "/data/anr/" },
    { label: "POS Pro config",  path: "/data/data/com.acme.pos/files/" },
    { label: "TOMS MDM cache",  path: "/data/data/com.toms.mdm/cache/" },
    { label: "Log directory",   path: "/data/log/" },
  ];
  const start = () => {
    const fname = path.split("/").filter(Boolean).pop() || "directory.tar";
    setPulling({ name: fname, pct: 0 });
    logAction({ tool: "FILE", label: `Requested · ${path}`, tone: "neutral" });
    const begin = Date.now();
    const i = setInterval(() => {
      const pct = Math.min(100, Math.round((Date.now() - begin) / 80));
      setPulling(p => p ? { ...p, pct } : null);
      if (pct >= 100) {
        clearInterval(i);
        setFiles(f => [{
          name: fname.endsWith(".tar") ? fname : `${fname}.tar`,
          path, size: "1.4 MB", pulledAt: "May 16, 2026 14:32",
        }, ...f]);
        setPulling(null);
        logAction({ tool: "FILE", label: `Pulled · ${fname}`, tone: "ok", detail: "1.4 MB" });
        window.showToast?.("File extracted · 1.4 MB", "success");
      }
    }, 100);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <WBSectionCard title="Pull a file or directory"
        hint="Specify an absolute path on the device. Directories are tarred + uploaded.">
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{
            flex: 1, minWidth: 240,
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px",
            background: "var(--bg1)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-sm)",
          }}>
            <window.Ico name="package" size={12} stroke={1.8} style={{ color: "var(--fg3)" }} />
            <input value={path} onChange={(e) => setPath(e.target.value)}
              placeholder="/path/on/device"
              style={{
                flex: 1, background: "transparent", border: 0, outline: "none",
                fontFamily: "var(--font-family-mono)", fontSize: 12,
                color: "var(--fg1)",
              }} />
          </div>
          <WBButton primary icon="download" disabled={!!pulling || !path.trim()}
            onClick={start}>{pulling ? "Pulling…" : "Pull file"}</WBButton>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 10.5, color: "var(--fg3)", alignSelf: "center" }}>Quick presets:</span>
          {presets.map((p, i) => (
            <button key={i} onClick={() => setPath(p.path)} style={pickerStyle(path === p.path)}>
              {p.label}
            </button>
          ))}
        </div>
        {pulling && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "var(--bg1)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span><b style={{ color: "var(--fg1)" }}>{pulling.name}</b></span>
              <span className="mono" style={{ color: "var(--fg3)" }}>{pulling.pct}%</span>
            </div>
            <div style={{ marginTop: 6, height: 5, borderRadius: 999, background: "var(--color-bg-3)", overflow: "hidden" }}>
              <div style={{ width: `${pulling.pct}%`, height: "100%", background: "var(--color-primary-500)" }} />
            </div>
          </div>
        )}
      </WBSectionCard>
      <WBSectionCard title={`Extracted files · ${files.length}`}>
        {files.length === 0 ? <Empty>No files pulled yet.</Empty> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto",
                gap: 12, alignItems: "center",
                padding: "9px 12px",
                background: "var(--bg1)",
                border: "1px solid var(--border-1)",
                borderRadius: "var(--radius-sm)",
              }}>
                <window.Ico name="package" size={14} stroke={1.8} style={{ color: "var(--fg2)" }} />
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg1)" }}>{f.name}</div>
                  <div className="mono" style={{ marginTop: 2, fontSize: 10.5, color: "var(--fg3)" }}>{f.path}</div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--fg2)" }}>{f.size}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--fg3)" }}>{f.pulledAt}</span>
                <WBButton icon="download" onClick={() => window.showToast?.(`Downloading ${f.name}…`, "info")}>Download</WBButton>
              </div>
            ))}
          </div>
        )}
      </WBSectionCard>
    </div>
  );
}
function FilePullTool_OLD() { return null; }
// ─── Tool: Device restart ─────────────────────────────────
function DeviceRebootTool({ ticket, device, logAction }) {
  const [open, setOpen] = useStateW(false);
  const [stage, setStage] = useStateW("idle"); // idle | confirming | sending | rebooting | up
  const [seconds, setSeconds] = useStateW(45);
  const start = () => {
    setStage("sending");
    logAction({ tool: "REBOOT", label: "Reboot command queued", tone: "warn" });
    setTimeout(() => {
      setStage("rebooting"); setSeconds(45);
      logAction({ tool: "REBOOT", label: "Device offline — rebooting", tone: "warn" });
      const i = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(i);
            setStage("up");
            logAction({ tool: "REBOOT", label: "Device back online", tone: "ok", detail: "uptime · 4 s" });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, 700);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <WBSectionCard title="Device restart"
        hint="Hard-reboots the terminal. Cashier sees splash screen for 30–60 s. No data loss.">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "var(--warning-bg)", color: "var(--color-warning-700)",
            display: "grid", placeItems: "center",
            border: "1px solid color-mix(in oklab, var(--color-warning-500) 25%, transparent)",
          }}>
            <window.Ico name="refresh" size={18} stroke={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: "var(--fg2)", lineHeight: 1.55 }}>
            <p style={{ margin: 0 }}>
              <b style={{ color: "var(--fg1)" }}>{ticket.deviceSn}</b>
              {device && <> · {device.model}</>} will reboot. Active transactions are
              automatically resumed from local state on next boot.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--fg3)" }}>
              Tip · prefer restarting the POS app first (use Remote desktop → Restart POS) if you only need to clear app state.
            </p>
          </div>
          <WBButton danger icon="refresh"
            disabled={stage === "sending" || stage === "rebooting"}
            onClick={() => setOpen(true)}>
            {stage === "rebooting" ? `Rebooting · ${seconds}s` : "Reboot device…"}
          </WBButton>
        </div>
        {stage !== "idle" && stage !== "confirming" && (
          <div style={{
            marginTop: 14, padding: "12px 14px",
            background: stage === "up" ? "oklch(96% 0.03 152)" : "var(--warning-bg)",
            border: "1px solid",
            borderColor: stage === "up"
              ? "color-mix(in oklab, var(--color-success-500) 22%, transparent)"
              : "color-mix(in oklab, var(--color-warning-500) 25%, transparent)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 12.5,
          }}>
            {stage === "up"
              ? <window.Ico name="check" size={14} stroke={2.4} style={{ color: "var(--color-success-700)" }} />
              : <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2.5px solid color-mix(in oklab, var(--color-warning-500) 40%, transparent)",
                  borderTopColor: "var(--color-warning-700)",
                  animation: "spin .8s linear infinite",
                }} />}
            <span style={{ flex: 1, color: stage === "up" ? "var(--color-success-700)" : "var(--color-warning-700)",
              fontWeight: 500 }}>
              {stage === "sending" ? "Sending reboot command to device…"
               : stage === "rebooting" ? `Device offline — back in ${seconds}s (est.)`
               : "Device is back online and reachable."}
            </span>
          </div>
        )}
      </WBSectionCard>

      <window.ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={<>Reboot <span className="mono">{ticket.deviceSn}</span>?</>}
        body={<>The terminal will be offline for about 30–60 seconds. The cashier will see a splash screen. This action is recorded on the ticket timeline.</>}
        confirmLabel="Reboot"
        tone="danger"
        icon="refresh"
        onConfirm={() => { setOpen(false); start(); }} />
    </div>
  );
}
function DeviceRebootTool_OLD() { return null; }
// ─── Tool: Factory reset ──────────────────────────────────
// Highest-friction action. Requires:
//   1. acknowledging the merchant impact
//   2. typing the device SN to confirm
//   3. typing FACTORY-RESET literal
//   4. a final confirm dialog
function FactoryResetTool({ ticket, device, logAction }) {
  const [sn, setSn] = useStateW("");
  const [phrase, setPhrase] = useStateW("");
  const [acks, setAcks] = useStateW({ unbind: false, txns: false, audit: false });
  const [confirmOpen, setConfirmOpen] = useStateW(false);
  const [stage, setStage] = useStateW("idle"); // idle | wiping | done

  const allAcked = acks.unbind && acks.txns && acks.audit;
  const snOk = sn.trim() === ticket.deviceSn;
  const phraseOk = phrase.trim() === "FACTORY-RESET";
  const canStart = allAcked && snOk && phraseOk && stage === "idle";

  const start = () => {
    setStage("wiping");
    logAction({ tool: "FACTORY", label: "Factory reset INITIATED", tone: "err",
      detail: `by ISO · ${ticket.deviceSn}` });
    setTimeout(() => {
      setStage("done");
      logAction({ tool: "FACTORY", label: "Device wiped · awaiting re-activation", tone: "warn" });
      window.showToast?.("Factory reset complete. Device unbound — needs re-activation.", "info");
    }, 2400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Big danger banner */}
      <div style={{
        padding: "14px 16px",
        background: "var(--error-bg)",
        border: "1px solid color-mix(in oklab, var(--color-error-500) 30%, transparent)",
        borderLeft: "4px solid var(--color-error-500)",
        borderRadius: "var(--radius-md)",
        display: "flex", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: "color-mix(in oklab, var(--color-error-500) 22%, transparent)",
          color: "var(--color-error-700)",
          display: "grid", placeItems: "center",
        }}>
          <window.Ico name="alert" size={18} stroke={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-error-700)", lineHeight: 1.55 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Destructive — factory reset</div>
          Wipes all user data, installed apps, configuration, and certificates. The device is unbound
          from <b>{ticket.deviceSn}</b> in the fleet and must go through activation again. Pending
          transactions or unsynced receipts will be lost.
        </div>
      </div>

      {stage !== "idle" ? (
        <WBSectionCard title="Reset in progress">
          {stage === "wiping" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px" }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "2.5px solid var(--color-bg-3)",
                borderTopColor: "var(--color-error-500)",
                animation: "spin .8s linear infinite",
              }} />
              <span style={{ fontSize: 13, color: "var(--color-error-700)", fontWeight: 500 }}>
                Wiping device · please do not power off the terminal…
              </span>
            </div>
          ) : (
            <div style={{
              padding: "14px 16px",
              background: "var(--warning-bg)",
              border: "1px solid color-mix(in oklab, var(--color-warning-500) 25%, transparent)",
              borderRadius: "var(--radius-md)",
              fontSize: 12.5, color: "var(--color-warning-700)",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <window.Ico name="check" size={14} stroke={2.4} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Device wiped — needs re-activation</div>
                <div style={{ fontSize: 11.5 }}>
                  The next person at the terminal will see the TOMS activation wizard. The merchant
                  should re-bind the device from their store dashboard.
                </div>
              </div>
            </div>
          )}
        </WBSectionCard>
      ) : (
        <WBSectionCard title="Confirm what you understand"
          hint="Tick every box to enable the reset button.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FactoryCheckbox checked={acks.unbind} onChange={() => setAcks(a => ({ ...a, unbind: !a.unbind }))}
              label="The device will be unbound from the fleet. Merchant must re-bind." />
            <FactoryCheckbox checked={acks.txns} onChange={() => setAcks(a => ({ ...a, txns: !a.txns }))}
              label="Pending transactions or unsynced receipts on the device will be permanently lost." />
            <FactoryCheckbox checked={acks.audit} onChange={() => setAcks(a => ({ ...a, audit: !a.audit }))}
              label="This action is irreversible and is logged against my account for audit." />
          </div>
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: "1px dashed var(--color-border-subtle)",
            display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 14,
          }}>
            <div>
              <div className="overline" style={{ fontSize: 9.5, marginBottom: 6 }}>
                Type the device SN
              </div>
              <input value={sn} onChange={(e) => setSn(e.target.value)}
                placeholder={ticket.deviceSn}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  border: `1px solid ${sn && !snOk ? "var(--color-error-500)" : "var(--border-1)"}`,
                  fontFamily: "var(--font-family-mono)", fontSize: 12,
                  background: "var(--bg2)", color: "var(--fg1)", outline: "none",
                }} />
              <div style={{ marginTop: 4, fontSize: 10.5,
                color: sn && !snOk ? "var(--color-error-700)" : "var(--fg3)" }}>
                Must match exactly · {ticket.deviceSn}
              </div>
            </div>
            <div>
              <div className="overline" style={{ fontSize: 9.5, marginBottom: 6 }}>
                Type "FACTORY-RESET"
              </div>
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)}
                placeholder="FACTORY-RESET"
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  border: `1px solid ${phrase && !phraseOk ? "var(--color-error-500)" : "var(--border-1)"}`,
                  fontFamily: "var(--font-family-mono)", fontSize: 12,
                  background: "var(--bg2)", color: "var(--fg1)", outline: "none",
                }} />
              <div style={{ marginTop: 4, fontSize: 10.5,
                color: phrase && !phraseOk ? "var(--color-error-700)" : "var(--fg3)" }}>
                Uppercase, with the dash.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <WBButton danger icon="trash" disabled={!canStart}
              onClick={() => setConfirmOpen(true)}>
              Factory reset device
            </WBButton>
          </div>
        </WBSectionCard>
      )}

      <window.ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<>Final check · factory reset?</>}
        body={<>This will wipe <b className="mono">{ticket.deviceSn}</b> immediately. Last chance to back out.</>}
        confirmLabel="Wipe device"
        tone="danger"
        icon="trash"
        onConfirm={() => { setConfirmOpen(false); start(); }} />
    </div>
  );
}

function FactoryCheckbox({ checked, onChange, label }) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px",
      background: checked ? "var(--color-primary-50)" : "var(--bg2)",
      border: "1px solid",
      borderColor: checked ? "color-mix(in oklab, var(--color-primary-500) 25%, transparent)" : "var(--border-1)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
    }}>
      <span style={{ position: "relative", flexShrink: 0, marginTop: 1 }}>
        <input type="checkbox" checked={checked} onChange={onChange}
          style={{
            appearance: "none", WebkitAppearance: "none",
            width: 16, height: 16, borderRadius: 4,
            border: "1.5px solid",
            borderColor: checked ? "var(--color-primary-600)" : "var(--color-border-strong)",
            background: checked ? "var(--color-primary-600)" : "var(--bg2)",
            cursor: "pointer", margin: 0, display: "block",
          }} />
        {checked && (
          <window.Ico name="check" size={11} stroke={3}
            style={{ position: "absolute", top: 2.5, left: 2.5, color: "#fff", pointerEvents: "none" }} />
        )}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--fg1)", lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}
function FactoryResetTool_OLD() { return null; }

// ─── Exports — components are appended in subsequent files / edits ──
Object.assign(window, { WorkbenchScreen });
