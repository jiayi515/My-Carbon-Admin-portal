/* global React, Btn, Input, Icon, Badge, useToast */
/* Audit log — cross-operator activity stream for compliance review */
const { useState: alUseState, useMemo: alUseMemo, useEffect: alUseEffect } = React;

// ─── Seed data ──────────────────────────────────────────────────────────────
const AL_OPERATORS = [
  { id: 'jd',  name: 'Jordan Diaz',     email: 'jordan.diaz@toms',     role: 'Admin',           hue: ['#5B7CFA', '#3D5BC9'] },
  { id: 'mh',  name: 'Maya Hernandez',  email: 'maya.h@toms',          role: 'Risk Manager',    hue: ['#FA8F5B', '#C95F3D'] },
  { id: 'rk',  name: 'Ravi Kapoor',     email: 'ravi.k@toms',          role: 'Onboarding Ops',  hue: ['#3DC97A', '#1F9A52'] },
  { id: 'sc',  name: 'Sofia Chen',      email: 'sofia.c@toms',         role: 'Contracts Lead',  hue: ['#7A5BFA', '#5A3DC9'] },
  { id: 'lt',  name: 'Liam Thompson',   email: 'liam.t@toms',          role: 'Tier 2 Support',  hue: ['#C24E8B', '#962F66'] },
  { id: 'aw',  name: 'Aisha Williams',  email: 'aisha.w@toms',         role: 'Finance',         hue: ['#5BC5FA', '#3D9AC9'] },
  { id: 'sys', name: 'System',          email: 'automation@toms',      role: 'Automation',      hue: ['#8A8F99', '#5E626B'] },
];

const AL_CATEGORIES = ['All', 'Authentication', 'Customer', 'Order', 'Contract', 'Operator', 'Settings', 'Security'];
const AL_RESULTS    = ['All', 'Success', 'Warning', 'Failed'];

// action → category + tone mapping
const AL_EVENTS = [
  // Today
  { id: 'ev-1041', ts: '2026-05-13T14:48:22', op: 'jd',  cat: 'Customer',       action: 'customer.update',      target: 'Greenline Tech',          targetType: 'Customer',  result: 'Success', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Updated billing email to ops@greenline.tech' },
  { id: 'ev-1040', ts: '2026-05-13T14:31:05', op: 'mh',  cat: 'Security',       action: 'risk.flag.cleared',    target: 'Northpoint Industries',   targetType: 'Customer',  result: 'Success', ip: '52.18.114.6',  ua: 'Firefox 128 · Win',  detail: 'Cleared sanctions screening hit after manual review' },
  { id: 'ev-1039', ts: '2026-05-13T14:12:41', op: 'sc',  cat: 'Contract',       action: 'contract.sign',        target: 'ISV MSA — Bayfront Studios', targetType: 'Contract', result: 'Success', ip: '99.32.7.221',  ua: 'Safari 17 · macOS',  detail: 'Counter-signed via DocuSign envelope 8F3-A91' },
  { id: 'ev-1038', ts: '2026-05-13T13:55:18', op: 'rk',  cat: 'Customer',       action: 'customer.create',      target: 'Cypress Roastery',        targetType: 'Customer',  result: 'Success', ip: '24.96.8.119',  ua: 'Chrome 126 · Win',   detail: 'New ISO customer · 4 docs uploaded' },
  { id: 'ev-1037', ts: '2026-05-13T13:21:09', op: 'jd',  cat: 'Operator',       action: 'operator.role.change', target: 'liam.t@toms',             targetType: 'Operator',  result: 'Success', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Elevated from Tier 1 → Tier 2 Support' },
  { id: 'ev-1036', ts: '2026-05-13T12:58:44', op: 'lt',  cat: 'Order',          action: 'order.refund',         target: 'ORD-2451 · Acme Foods',   targetType: 'Order',     result: 'Warning', ip: '173.5.21.88',  ua: 'Chrome 125 · Win',   detail: 'Partial refund $238.40 — flagged for daily review' },
  { id: 'ev-1035', ts: '2026-05-13T11:43:02', op: 'sys', cat: 'Authentication', action: 'session.expire',       target: 'aisha.w@toms',            targetType: 'Operator',  result: 'Success', ip: '—',            ua: 'Scheduled task',     detail: 'Idle timeout after 30 min · 1 session ended' },
  { id: 'ev-1034', ts: '2026-05-13T10:29:17', op: 'aw',  cat: 'Order',          action: 'order.invoice.send',   target: 'ORD-2438 · Lumen POS',    targetType: 'Order',     result: 'Success', ip: '88.213.7.55',  ua: 'Chrome 126 · macOS', detail: 'Sent invoice to ar@lumenpos.com · $12,840' },
  { id: 'ev-1033', ts: '2026-05-13T09:14:36', op: 'jd',  cat: 'Authentication', action: 'auth.signin',          target: 'jordan.diaz@toms',        targetType: 'Operator',  result: 'Success', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Signed in with SSO · device trusted' },
  { id: 'ev-1032', ts: '2026-05-13T08:51:12', op: 'mh',  cat: 'Authentication', action: 'auth.signin.failed',   target: 'maya.h@toms',             targetType: 'Operator',  result: 'Failed',  ip: '198.51.100.4', ua: 'Firefox 128 · Win',  detail: 'Wrong password · 1st of 5 allowed attempts' },

  // Yesterday
  { id: 'ev-1031', ts: '2026-05-12T17:42:55', op: 'sc',  cat: 'Contract',       action: 'contract.archive',     target: 'ISO Schedule A — Pier 41', targetType: 'Contract', result: 'Success', ip: '99.32.7.221',  ua: 'Safari 17 · macOS',  detail: 'Archived expired schedule · retention: 7 years' },
  { id: 'ev-1030', ts: '2026-05-12T16:11:08', op: 'jd',  cat: 'Settings',       action: 'settings.role.update', target: 'Role: ISO Operator T2',   targetType: 'Role',      result: 'Success', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Added permission contract.view · 4 operators affected' },
  { id: 'ev-1029', ts: '2026-05-12T15:34:47', op: 'rk',  cat: 'Customer',       action: 'customer.kyc.approve', target: 'Bayfront Studios',        targetType: 'Customer',  result: 'Success', ip: '24.96.8.119',  ua: 'Chrome 126 · Win',   detail: 'KYC approved · risk score 28/100' },
  { id: 'ev-1028', ts: '2026-05-12T14:02:22', op: 'jd',  cat: 'Operator',       action: 'operator.revoke',      target: 'j.chen@partner.io',       targetType: 'Operator',  result: 'Warning', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Reason: terminated employment · sessions invalidated' },
  { id: 'ev-1027', ts: '2026-05-12T11:47:01', op: 'lt',  cat: 'Order',          action: 'order.status.update',  target: 'ORD-2447 · Harbor Eats',  targetType: 'Order',     result: 'Success', ip: '173.5.21.88',  ua: 'Chrome 125 · Win',   detail: 'In transit → Delivered · 12 terminals' },
  { id: 'ev-1026', ts: '2026-05-12T10:18:39', op: 'sys', cat: 'Security',       action: 'security.scan.daily',  target: 'Workspace: Production',   targetType: 'Workspace', result: 'Success', ip: '—',            ua: 'Scheduled task',     detail: '0 high · 2 medium · 14 low findings' },
  { id: 'ev-1025', ts: '2026-05-12T09:32:14', op: 'aw',  cat: 'Settings',       action: 'settings.export',      target: 'Audit log · April',       targetType: 'Report',    result: 'Success', ip: '88.213.7.55',  ua: 'Chrome 126 · macOS', detail: 'Exported 2,418 rows as CSV · 412 KB' },

  // Earlier
  { id: 'ev-1024', ts: '2026-05-11T18:09:53', op: 'mh',  cat: 'Security',       action: 'risk.flag.raised',     target: 'Coastline Ventures',      targetType: 'Customer',  result: 'Warning', ip: '52.18.114.6',  ua: 'Firefox 128 · Win',  detail: 'PEP screening hit · manual review queued' },
  { id: 'ev-1023', ts: '2026-05-11T15:21:08', op: 'sc',  cat: 'Contract',       action: 'contract.send',        target: 'Acquirer MSA — Lumen POS', targetType: 'Contract', result: 'Success', ip: '99.32.7.221',  ua: 'Safari 17 · macOS',  detail: 'Sent for signature to 3 recipients' },
  { id: 'ev-1022', ts: '2026-05-11T13:44:31', op: 'jd',  cat: 'Settings',       action: 'settings.theme.update', target: 'Workspace: Production',  targetType: 'Workspace', result: 'Success', ip: '73.241.0.18',  ua: 'Chrome 126 · macOS', detail: 'Updated primary brand color · logo replaced' },
  { id: 'ev-1021', ts: '2026-05-11T10:02:17', op: 'rk',  cat: 'Customer',       action: 'customer.delete',      target: 'Test Customer XYZ',       targetType: 'Customer',  result: 'Failed',  ip: '24.96.8.119',  ua: 'Chrome 126 · Win',   detail: 'Blocked: customer has 2 active contracts' },
  { id: 'ev-1020', ts: '2026-05-11T09:48:00', op: 'sys', cat: 'Authentication', action: 'auth.session.purge',   target: 'All operators',           targetType: 'Workspace', result: 'Success', ip: '—',            ua: 'Scheduled task',     detail: 'Weekly purge: 142 expired sessions removed' },
];

// ─── Action → tone for the small icon chip ─────────────────────────────────
const AL_ACTION_TONE = {
  Authentication: 'info',
  Customer:       'success',
  Order:          'info',
  Contract:       'warning',
  Operator:       'success',
  Settings:       'neutral',
  Security:       'warning',
};
const AL_ACTION_ICON = {
  Authentication: 'shield',
  Customer:       'users',
  Order:          'package',
  Contract:       'file',
  Operator:       'operator',
  Settings:       'settings',
  Security:       'shield',
};
const AL_RESULT_TONE = { Success: 'success', Warning: 'warning', Failed: 'error' };

// ─── Generate filler events so pagination is meaningful ────────────────────
const AL_FILLER_TEMPLATES = [
  { cat: 'Authentication', action: 'auth.signin',           targetType: 'Operator',  result: 'Success', detail: 'Signed in with SSO · device trusted' },
  { cat: 'Authentication', action: 'auth.signin.failed',    targetType: 'Operator',  result: 'Failed',  detail: 'Wrong password · attempt logged' },
  { cat: 'Authentication', action: 'auth.mfa.challenge',    targetType: 'Operator',  result: 'Success', detail: 'MFA challenge passed · TOTP' },
  { cat: 'Authentication', action: 'session.expire',        targetType: 'Operator',  result: 'Success', detail: 'Idle timeout · session ended' },
  { cat: 'Customer',       action: 'customer.update',       targetType: 'Customer',  result: 'Success', detail: 'Updated billing address' },
  { cat: 'Customer',       action: 'customer.view.sensitive', targetType: 'Customer', result: 'Warning', detail: 'Revealed sensitive contact info · written to audit' },
  { cat: 'Customer',       action: 'customer.kyc.approve',  targetType: 'Customer',  result: 'Success', detail: 'KYC approved after document review' },
  { cat: 'Customer',       action: 'customer.note.add',     targetType: 'Customer',  result: 'Success', detail: 'Added internal note · risk team' },
  { cat: 'Order',          action: 'order.status.update',   targetType: 'Order',     result: 'Success', detail: 'In transit → Delivered' },
  { cat: 'Order',          action: 'order.invoice.send',    targetType: 'Order',     result: 'Success', detail: 'Sent invoice via email' },
  { cat: 'Order',          action: 'order.refund',          targetType: 'Order',     result: 'Warning', detail: 'Partial refund · daily review queue' },
  { cat: 'Order',          action: 'order.cancel',          targetType: 'Order',     result: 'Success', detail: 'Cancelled prior to fulfillment' },
  { cat: 'Contract',       action: 'contract.send',         targetType: 'Contract',  result: 'Success', detail: 'Sent for signature · DocuSign envelope' },
  { cat: 'Contract',       action: 'contract.sign',         targetType: 'Contract',  result: 'Success', detail: 'Counter-signed by operator' },
  { cat: 'Contract',       action: 'contract.archive',      targetType: 'Contract',  result: 'Success', detail: 'Archived expired schedule · 7y retention' },
  { cat: 'Operator',       action: 'operator.role.change',  targetType: 'Operator',  result: 'Success', detail: 'Role elevated after manager approval' },
  { cat: 'Operator',       action: 'operator.invite',       targetType: 'Operator',  result: 'Success', detail: 'Invite sent · expires in 7 days' },
  { cat: 'Operator',       action: 'operator.revoke',       targetType: 'Operator',  result: 'Warning', detail: 'Sessions invalidated · ticket linked' },
  { cat: 'Settings',       action: 'settings.role.update',  targetType: 'Role',      result: 'Success', detail: 'Updated permission set' },
  { cat: 'Settings',       action: 'settings.export',       targetType: 'Report',    result: 'Success', detail: 'Exported report as CSV' },
  { cat: 'Security',       action: 'risk.flag.raised',      targetType: 'Customer',  result: 'Warning', detail: 'PEP screening hit · manual review queued' },
  { cat: 'Security',       action: 'risk.flag.cleared',     targetType: 'Customer',  result: 'Success', detail: 'Cleared after manual review' },
  { cat: 'Security',       action: 'security.scan.daily',   targetType: 'Workspace', result: 'Success', detail: 'Daily scan completed · 0 high findings' },
];
const AL_FILLER_TARGETS = {
  Customer:  ['Northpoint Industries', 'Bayfront Studios', 'Cypress Roastery', 'Acme Foods', 'Pier 41', 'Harbor Eats', 'Coastline Ventures', 'Greenline Tech', 'Lumen POS', 'Anvil Hardware', 'Sterling Capital', 'Marigold Bakery', 'Riverstone Holdings'],
  Order:     ['ORD-2401 · Acme Foods', 'ORD-2417 · Pier 41', 'ORD-2429 · Anvil Hardware', 'ORD-2444 · Marigold Bakery', 'ORD-2452 · Sterling Capital', 'ORD-2466 · Riverstone Holdings'],
  Contract:  ['ISV MSA — Bayfront Studios', 'ISO Schedule A — Pier 41', 'Acquirer MSA — Lumen POS', 'PayFac Addendum — Sterling', 'ISV MSA — Cypress Roastery'],
  Operator:  ['liam.t@toms', 'aisha.w@toms', 'sofia.c@toms', 'ravi.k@toms', 'maya.h@toms', 'jordan.diaz@toms', 'j.chen@partner.io'],
  Role:      ['Role: ISO Operator T2', 'Role: Compliance Reviewer', 'Role: Read-only Finance', 'Role: Onboarding Ops'],
  Workspace: ['Workspace: Production', 'Workspace: Staging'],
  Report:    ['Audit log · April', 'Customer roster · Q1', 'Operator activity · Week 18'],
};
const AL_IPS = ['73.241.0.18', '52.18.114.6', '99.32.7.221', '24.96.8.119', '88.213.7.55', '173.5.21.88', '198.51.100.4', '203.0.113.42', '76.14.91.203', '64.225.18.7'];
const AL_UAS = ['Chrome 126 · macOS', 'Firefox 128 · Win', 'Safari 17 · macOS', 'Chrome 125 · Win', 'Edge 126 · Win', 'Safari 17 · iPadOS'];

// Deterministic PRNG so the seed is stable.
const alRand = (() => {
  let s = 0x12345678;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
})();
const alPick = (arr) => arr[Math.floor(alRand() * arr.length)];

const generateFiller = (startIso, count) => {
  const rows = [];
  let cursor = new Date(startIso).getTime();
  for (let i = 0; i < count; i++) {
    // Step back 5–55 minutes per row.
    cursor -= (300 + Math.floor(alRand() * 3000)) * 1000;
    const tpl = AL_FILLER_TEMPLATES[Math.floor(alRand() * AL_FILLER_TEMPLATES.length)];
    const operator = tpl.action.startsWith('session.') || tpl.action.startsWith('security.scan') ? 'sys' :
      alPick(AL_OPERATORS.filter((o) => o.id !== 'sys')).id;
    rows.push({
      id: `ev-${900 + i}`,
      ts: new Date(cursor).toISOString().slice(0, 19),
      op: operator,
      cat: tpl.cat,
      action: tpl.action,
      target: alPick(AL_FILLER_TARGETS[tpl.targetType] || ['Workspace: Production']),
      targetType: tpl.targetType,
      result: tpl.result,
      ip: operator === 'sys' ? '—' : alPick(AL_IPS),
      ua: operator === 'sys' ? 'Scheduled task' : alPick(AL_UAS),
      detail: tpl.detail,
    });
  }
  return rows;
};

const AL_EVENTS_ALL = [...AL_EVENTS, ...generateFiller('2026-05-11T09:00:00', 140)];

const alFmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const alFmtDay = (iso) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  const diffDays = Math.round((today - target) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const AuditLogPage = () => {
  const toast = useToast();
  const [q, setQ]               = alUseState('');
  const [opFilter, setOpFilter] = alUseState('all');
  const [cat, setCat]           = alUseState('All');
  const [result, setResult]     = alUseState('All');
  const [range, setRange]       = alUseState('7d');
  const [selected, setSelected] = alUseState(null);
  const [page, setPage]         = alUseState(1);
  const [pageSize, setPageSize] = alUseState(25);

  const opById = AL_OPERATORS.reduce((m, o) => (m[o.id] = o, m), {});

  const filtered = alUseMemo(() => {
    const s = q.trim().toLowerCase();
    return AL_EVENTS_ALL.filter((e) => {
      if (opFilter !== 'all' && e.op !== opFilter) return false;
      if (cat !== 'All' && e.cat !== cat) return false;
      if (result !== 'All' && e.result !== result) return false;
      if (s) {
        const op = opById[e.op];
        const hay = `${e.action} ${e.target} ${op?.name || ''} ${op?.email || ''} ${e.detail}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [q, opFilter, cat, result]);

  // Reset page if filters change
  alUseEffect(() => { setPage(1); }, [q, opFilter, cat, result, range, pageSize]);

  // Stats (always computed against unfiltered last-24h slice for stable values)
  const stats = alUseMemo(() => {
    const day = new Date(); day.setHours(0,0,0,0);
    const last24 = AL_EVENTS_ALL.filter((e) => new Date(e.ts) >= day);
    const operators = new Set(last24.map((e) => e.op)).size;
    const failed = AL_EVENTS_ALL.filter((e) => e.result === 'Failed').length;
    const warnings = AL_EVENTS_ALL.filter((e) => e.result === 'Warning').length;
    return { events: last24.length, operators, failed, warnings };
  }, []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Audit log</h1>
          <p className="page__sub">Every action taken by an operator in this workspace. Retained 7 years for compliance.</p>
        </div>
        <div className="page__actions">
          <Btn variant="ghost" icon="filter" onClick={() => toast({ kind: 'info', title: 'Saved views coming soon' })}>Saved views</Btn>
          <Btn variant="secondary" icon="download" onClick={() => toast({ kind: 'success', title: 'Export queued', desc: `${filtered.length.toLocaleString()} rows · CSV` })}>Export</Btn>
        </div>
      </div>

      {/* Stats strip */}
      <div className="stats">
        <div className="stat">
          <div className="stat__label">Events · Today</div>
          <div className="stat__val">{stats.events}</div>
          <div className="stat__delta">across {stats.operators} operators</div>
        </div>
        <div className="stat">
          <div className="stat__label">Failed actions</div>
          <div className="stat__val" style={{ color: stats.failed > 0 ? 'var(--color-error-700)' : 'inherit' }}>{stats.failed}</div>
          <div className="stat__delta">last 7 days</div>
        </div>
        <div className="stat">
          <div className="stat__label">Warnings</div>
          <div className="stat__val" style={{ color: stats.warnings > 0 ? 'var(--color-warning-700)' : 'inherit' }}>{stats.warnings}</div>
          <div className="stat__delta">requires review</div>
        </div>
        <div className="stat">
          <div className="stat__label">Retention</div>
          <div className="stat__val">7y</div>
          <div className="stat__delta">SOC 2 · PCI-DSS</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="al-filters">
        <Input
          size="md"
          prefix={<Icon name="search" size={14} />}
          placeholder="Search action, target, operator…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 280 }}
        />
        <select className="al-select" value={opFilter} onChange={(e) => setOpFilter(e.target.value)}>
          <option value="all">All operators ({AL_OPERATORS.length})</option>
          {AL_OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="al-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          {AL_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
        </select>
        <select className="al-select" value={result} onChange={(e) => setResult(e.target.value)}>
          {AL_RESULTS.map((r) => <option key={r} value={r}>{r === 'All' ? 'All results' : r}</option>)}
        </select>
        <div className="al-range">
          {['24h', '7d', '30d', '90d'].map((r) =>
            <button key={r} type="button" className={`al-range__btn ${range === r ? 'is-on' : ''}`} onClick={() => setRange(r)}>{r}</button>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length.toLocaleString()} of {AL_EVENTS_ALL.length.toLocaleString()} events
        </span>
      </div>

      {/* Two-pane: log table + side detail */}
      <div className="al-layout">
        <div className="al-tablewrap">
          <table className="al-table">
            <colgroup>
              <col style={{ width: 96 }}/>
              <col style={{ width: 200 }}/>
              <col style={{ width: 28 }}/>
              <col/>
              <col style={{ width: 96 }}/>
              <col style={{ width: 120 }}/>
            </colgroup>
            <thead>
              <tr>
                <th>Time</th>
                <th>Operator</th>
                <th></th>
                <th>Action &amp; target</th>
                <th>Result</th>
                <th style={{ textAlign: 'right' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan="6"><div className="empty">No events match these filters.</div></td></tr>
              )}
              {pageRows.map((e) => {
                const op = opById[e.op];
                const tone = AL_ACTION_TONE[e.cat] || 'neutral';
                const icon = AL_ACTION_ICON[e.cat] || 'audit';
                const active = selected === e.id;
                return (
                  <tr key={e.id} className={`al-trow ${active ? 'is-active' : ''}`} onClick={() => setSelected(active ? null : e.id)}>
                    <td className="al-trow__time">
                      <div>{alFmtTime(e.ts)}</div>
                      <div className="al-trow__date">{new Date(e.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </td>
                    <td>
                      <div className="al-trow__op">
                        <div className="al-row__avatar" style={{ background: `linear-gradient(135deg, ${op.hue[0]}, ${op.hue[1]})` }}>
                          {op.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                        </div>
                        <div className="al-trow__opmeta">
                          <div className="al-trow__opname">{op.name}</div>
                          <div className="al-trow__oprole">{op.role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`al-row__chip al-row__chip--${tone}`}><Icon name={icon} size={12} /></span>
                    </td>
                    <td className="al-trow__main">
                      <div className="al-trow__action-line"><code className="al-trow__action">{e.action}</code></div>
                      <div className="al-trow__target">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>on </span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{e.target}</span>
                        <span className="muted"> · {e.targetType}</span>
                      </div>
                    </td>
                    <td><Badge tone={AL_RESULT_TONE[e.result]} dot>{e.result}</Badge></td>
                    <td className="al-trow__ip">{e.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="al-pag">
            <div className="al-pag__left">
              <label className="al-pag__pgsize">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className="al-pag__meta">
                {filtered.length === 0 ? '0' : `${((safePage - 1) * pageSize + 1).toLocaleString()}–${Math.min(safePage * pageSize, filtered.length).toLocaleString()}`}
                {' '}of {filtered.length.toLocaleString()}
              </span>
            </div>
            <div className="al-pag__right">
              <button type="button" className="al-pag__btn" disabled={safePage <= 1} onClick={() => setPage(1)} title="First page">«</button>
              <button type="button" className="al-pag__btn" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><Icon name="chevL" size={13}/></button>
              <span className="al-pag__pages">Page <strong>{safePage}</strong> of <strong>{totalPages}</strong></span>
              <button type="button" className="al-pag__btn" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><Icon name="chevR" size={13}/></button>
              <button type="button" className="al-pag__btn" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} title="Last page">»</button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <aside className="al-detail">
          {!selected &&
            <div className="al-detail__empty">
              <div className="al-detail__emptyicon"><Icon name="audit" size={22} /></div>
              <div className="al-detail__emptytitle">Select an event</div>
              <div className="al-detail__emptysub">Click any row to see operator, payload, request metadata, and replay options.</div>
            </div>
          }
          {selected && (() => {
            const e = AL_EVENTS_ALL.find((x) => x.id === selected);
            if (!e) return null;
            const op = opById[e.op];
            return (
              <>
                <header className="al-detail__head">
                  <div className="al-detail__title">{e.action}</div>
                  <Badge tone={AL_RESULT_TONE[e.result]}>{e.result}</Badge>
                </header>
                <div className="al-detail__sub">{e.detail}</div>

                <dl className="al-kv">
                  <dt>Event ID</dt><dd><code>{e.id}</code></dd>
                  <dt>Timestamp</dt><dd>{new Date(e.ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'long' })}</dd>
                  <dt>Category</dt><dd>{e.cat}</dd>
                  <dt>Target</dt><dd>{e.target} <span className="muted">({e.targetType})</span></dd>
                </dl>

                <div className="al-detail__sectionlbl">Operator</div>
                <div className="al-detail__op">
                  <div className="al-row__avatar" style={{ background: `linear-gradient(135deg, ${op.hue[0]}, ${op.hue[1]})`, width: 36, height: 36, fontSize: 13 }}>
                    {op.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{op.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{op.email} · {op.role}</div>
                  </div>
                </div>

                <div className="al-detail__sectionlbl">Request</div>
                <dl className="al-kv">
                  <dt>IP address</dt><dd><code>{e.ip}</code></dd>
                  <dt>Client</dt><dd>{e.ua}</dd>
                  <dt>Session</dt><dd><code>sess_{e.id.slice(-6)}</code></dd>
                </dl>

                <div className="al-detail__actions">
                  <Btn variant="ghost" size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(e.id); toast({ kind: 'success', title: 'Event ID copied' }); }}>Copy ID</Btn>
                  <Btn variant="ghost" size="sm" icon="download" onClick={() => toast({ kind: 'info', title: 'Downloading event…' })}>Raw JSON</Btn>
                </div>
              </>
            );
          })()}
        </aside>
      </div>

      <style>{`
        .al-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .al-select { height: 32px; padding: 0 28px 0 10px; background: var(--color-bg-2) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7e87' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>") no-repeat right 8px center; border: 1px solid var(--color-border-default); border-radius: 6px; font: 13px var(--font-family-sans); color: var(--color-text-primary); cursor: pointer; appearance: none; -webkit-appearance: none; }
        .al-select:hover { border-color: var(--color-border-strong); }
        .al-select:focus { outline: none; border-color: var(--color-border-focus); box-shadow: var(--shadow-focus); }
        .al-range { display: inline-flex; padding: 2px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 7px; }
        .al-range__btn { padding: 4px 10px; border-radius: 5px; font: 500 12px var(--font-family-mono); color: var(--color-text-secondary); background: transparent; border: 0; cursor: pointer; transition: all var(--duration-fast); }
        .al-range__btn.is-on { background: var(--color-bg-2); color: var(--color-text-primary); box-shadow: var(--shadow-1); }

        .al-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
        @media (max-width: 1100px) { .al-layout { grid-template-columns: 1fr; } }

        /* Compact table */
        .al-tablewrap { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; box-shadow: var(--shadow-2); overflow: hidden; }
        .al-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 12.5px; }
        .al-table thead th { position: sticky; top: 0; z-index: 1; background: var(--color-bg-3); border-bottom: 1px solid var(--color-border-default); padding: 9px 14px; font: 600 11px/1 var(--font-family-sans); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); text-align: left; white-space: nowrap; }
        .al-table thead th:first-child { padding-left: 20px; }
        .al-table thead th:last-child { padding-right: 20px; }
        .al-table tbody td { padding: 8px 14px; border-bottom: 1px solid var(--color-border-subtle); vertical-align: middle; }
        .al-table tbody td:first-child { padding-left: 20px; }
        .al-table tbody td:last-child { padding-right: 20px; }

        .al-trow { cursor: pointer; transition: background var(--duration-fast); }
        .al-trow:hover { background: var(--color-bg-hover); }
        .al-trow.is-active { background: var(--color-primary-50); }
        .al-trow.is-active td:first-child { box-shadow: inset 3px 0 0 var(--color-primary-500); }

        .al-trow__time { font: 500 12px var(--font-family-mono); color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1.25; }
        .al-trow__date { font-size: 11px; color: var(--color-text-tertiary); opacity: 0.7; margin-top: 1px; }
        .al-trow__op { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .al-row__avatar { width: 24px; height: 24px; border-radius: 50%; color: #fff; display: grid; place-items: center; font: 600 9.5px var(--font-family-sans); flex: none; letter-spacing: -0.01em; }
        .al-trow__opmeta { min-width: 0; }
        .al-trow__opname { font-size: 12.5px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25; }
        .al-trow__oprole { font-size: 11px; color: var(--color-text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25; }

        .al-row__chip { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; flex: none; }
        .al-row__chip--info    { background: var(--color-info-50);    color: var(--color-info-700);    border: 1px solid oklch(60% 0.14 230 / 0.25); }
        .al-row__chip--success { background: var(--color-success-50); color: var(--color-success-700); border: 1px solid oklch(58% 0.14 152 / 0.25); }
        .al-row__chip--warning { background: var(--color-warning-50); color: var(--color-warning-700); border: 1px solid oklch(70% 0.16 70 / 0.25); }
        .al-row__chip--neutral { background: var(--color-bg-3);       color: var(--color-text-secondary); border: 1px solid var(--color-border-default); }

        .al-trow__main { min-width: 0; max-width: 1px; /* let table flex it */ }
        .al-trow__action-line { line-height: 1.2; margin-bottom: 3px; }
        .al-trow__action { font: 500 12px var(--font-family-mono); background: var(--color-bg-3); color: var(--color-text-primary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--color-border-subtle); white-space: nowrap; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .al-trow__target { font-size: 12px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .al-trow__ip { font: 500 11px var(--font-family-mono); color: var(--color-text-tertiary); text-align: right; font-variant-numeric: tabular-nums; }

        /* Pagination */
        .al-pag { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-2); flex-wrap: wrap; }
        .al-pag__left { display: flex; align-items: center; gap: 14px; }
        .al-pag__pgsize { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-tertiary); }
        .al-pag__pgsize select { height: 28px; padding: 0 24px 0 8px; background: var(--color-bg-2) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7e87' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>") no-repeat right 6px center; border: 1px solid var(--color-border-default); border-radius: 5px; font: 12px var(--font-family-mono); color: var(--color-text-primary); cursor: pointer; appearance: none; -webkit-appearance: none; font-variant-numeric: tabular-nums; }
        .al-pag__meta { font: 500 12px var(--font-family-mono); color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
        .al-pag__right { display: flex; align-items: center; gap: 4px; }
        .al-pag__pages { font-size: 12px; color: var(--color-text-secondary); margin: 0 8px; font-variant-numeric: tabular-nums; }
        .al-pag__pages strong { color: var(--color-text-primary); font-weight: 600; }
        .al-pag__btn { width: 28px; height: 28px; border-radius: 5px; display: grid; place-items: center; border: 1px solid var(--color-border-default); background: var(--color-bg-2); color: var(--color-text-secondary); cursor: pointer; transition: all var(--duration-fast); font: 600 13px var(--font-family-sans); }
        .al-pag__btn:hover:not(:disabled) { background: var(--color-bg-hover); border-color: var(--color-border-strong); color: var(--color-text-primary); }
        .al-pag__btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .al-detail { position: sticky; top: 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; box-shadow: var(--shadow-2); padding: 18px 18px 16px; }
        .al-detail__empty { text-align: center; padding: 24px 8px; }
        .al-detail__emptyicon { width: 44px; height: 44px; border-radius: 11px; background: var(--color-bg-3); color: var(--color-text-tertiary); display: grid; place-items: center; margin: 0 auto 12px; border: 1px solid var(--color-border-subtle); }
        .al-detail__emptytitle { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
        .al-detail__emptysub { font-size: 12.5px; color: var(--color-text-tertiary); margin-top: 6px; line-height: 1.5; }

        .al-detail__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .al-detail__title { font: 600 14px/1.3 var(--font-family-mono); color: var(--color-text-primary); word-break: break-all; }
        .al-detail__sub { font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.55; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--color-border-subtle); }
        .al-detail__sectionlbl { font: 600 10.5px/1 var(--font-family-sans); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-tertiary); margin: 14px 0 8px; }
        .al-detail__op { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 8px; }

        .al-kv { display: grid; grid-template-columns: 88px 1fr; row-gap: 8px; column-gap: 12px; font-size: 12.5px; margin: 0; }
        .al-kv dt { color: var(--color-text-tertiary); }
        .al-kv dd { margin: 0; color: var(--color-text-primary); word-break: break-word; }
        .al-kv code { font: 500 12px var(--font-family-mono); }

        .al-detail__actions { display: flex; gap: 6px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--color-border-subtle); }
      `}</style>
    </div>
  );
};

Object.assign(window, { AuditLogPage });
