/* global React */
// ─────────────────────────────────────────────────────────────
// Workbench shims — bridges the workbench (ported from the
// customer portal) into this admin portal.
//
// The source tickets.jsx (also ported into this project)
// already exposes TICKET_STATUS / TICKET_TYPE / TICKET_SEVERITY
// / TICKET_ROSTER / currentRole / ticketOrigin / buildSnapshotFor
// / findTicketById / openTicketsForDevice on window. Everything
// below is a defensive fallback: it only fills a slot if the
// real implementation hasn't been loaded yet, so load order
// between tickets.jsx and workbench-shims.jsx doesn't matter.
// ─────────────────────────────────────────────────────────────

(function installWorkbenchShims() {
  if (typeof window === "undefined") return;

  // ─── Ticket dictionaries ──────────────────────────────────
  // The fully-populated versions live in tickets.jsx; these
  // only fire if tickets.jsx hasn't loaded yet (e.g. during
  // teardown). Either way the workbench reads from window.*
  window.TICKET_TYPE     = window.TICKET_TYPE     || {};
  window.TICKET_STATUS   = window.TICKET_STATUS   || {};
  window.TICKET_SEVERITY = window.TICKET_SEVERITY || {};
  window.TICKET_ROSTER   = window.TICKET_ROSTER   || { NPT: [], ISO: [] };

  // ─── Role — this admin portal is the NPT-side console. We
  // override the source's default ("ISO" unless tenant has NPT
  // contracts) because this whole app IS the NPT view.
  window.currentRole = () => "NPT";

  // ─── GRANT_LABELS — used in escalation summary ────────────
  window.GRANT_LABELS = window.GRANT_LABELS || {
    snapshot:     "Device snapshot",
    logs:         "Pull logs",
    liveProbe:    "Live diagnostics",
    remoteDesktop:"Remote desktop",
    fileAccess:   "File access",
  };

  // ─── Snapshot builder — populated by tickets.jsx ──────────
  window.buildSnapshotFor = window.buildSnapshotFor || (() => null);

  // ─── ticketOrigin — workbench branches on "auto" / "manual"
  window.ticketOrigin = window.ticketOrigin || ((ticket) => {
    if (!ticket) return "manual";
    if (ticket.source === "auto") return "auto";
    return "manual";
  });

  // ─── faultCodeLookup — no KB in this admin portal yet ─────
  window.faultCodeLookup = window.faultCodeLookup || (() => null);

  // ─── findMerchantById — admin portal indexes customers,
  // not merchants. Stub returns null so the merchant chips on
  // the diagnostic / snapshot cards just collapse.
  window.findMerchantById = window.findMerchantById || (() => null);
  window.MERCHANTS = window.MERCHANTS || [];

  // ─── Ticket lookups against window.TICKETS ────────────────
  // tickets.jsx wires the real implementations; these only run
  // when tickets.jsx hasn't loaded yet.
  window.findTicketById = window.findTicketById || ((id) =>
    (window.TICKETS || []).find((t) => t.id === id) || null);
  window.openTicketsForDevice = window.openTicketsForDevice || ((sn) =>
    (window.TICKETS || []).filter((t) => t.deviceSn === sn && t.status !== "closed"));
})();
