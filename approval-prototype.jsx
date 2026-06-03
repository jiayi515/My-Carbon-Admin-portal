/* global React, ReactDOM, Icon, Btn, Badge, CompanyLogo, Input, Field, Textarea, Modal, ToastProvider, useToast, maskEmail, maskName, relTime, fmtDateTime */
const { useState, useEffect, useMemo, useRef } = React;

// ─── Constants / personas ────────────────────────────────────────
const PERSONAS = {
  'sam@carbon':   { id: 'sam@carbon',   name: 'Sam Park (you)',  initials: 'SP', short: 'Sam' },
  'priya@carbon': { id: 'priya@carbon', name: 'Priya Chen',      initials: 'PC', short: 'Priya' },
  'wei@carbon':   { id: 'wei@carbon',   name: 'Wei Liu',         initials: 'WL', short: 'Wei' },
};
const personaName = (id) => PERSONAS[id]?.name || id;

const HUES = [
  ['#5B7CFA', '#3D5BC9'], ['#7A5BFA', '#5A3DC9'], ['#FA5B8B', '#C93D6E'],
  ['#FA9D5B', '#C9763D'], ['#3DC97A', '#2F9A60'], ['#3DB8C9', '#2F8E9A'],
  ['#C24E8B', '#962F66'],
];
const hueFor = (s) => {
  let h = 0;
  for (let i = 0; i < (s || '?').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
};

// ─── Time helpers ────────────────────────────────────────────────
const isoNow = () => new Date().toISOString();
const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
const fmtRel = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const fmtFull = (iso) => new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Status / type meta ──────────────────────────────────────────
const STATUS_META = {
  pending:   { label: 'Pending review', tone: 'warning' },
  approved:  { label: 'Approved',       tone: 'success' },
  rejected:  { label: 'Rejected',       tone: 'neutral' },
  withdrawn: { label: 'Withdrawn',      tone: 'neutral' },
};
const TYPE_META = {
  'change-email':  { label: 'Change Email',     icon: 'mail',   acardIconCls: 'acard__icon--info' },
  'promote-admin': { label: 'Promote to Admin', icon: 'shield', acardIconCls: 'acard__icon--warn' },
};

// ─── Seed: customer + operators ─────────────────────────────────
const seedCustomer = () => ({
  id: 'cust-1',
  name: 'Bluebird Logistics',
  domain: 'bluebird.co',
  status: 'Active',
  contracts: ['ISV', 'Acquirer'],
  operators: [
    { id: 'op-1', name: 'Maya Tan',     email: 'maya@bluebird.co',  role: 'Admin',    lastLogin: ago(60 * 3) },
    { id: 'op-2', name: 'Diego Rivas',  email: 'diego@bluebird.co', role: 'Operator', lastLogin: ago(60 * 30) },
    { id: 'op-3', name: 'Ren Kovac',    email: 'ren@bluebird.co',   role: 'Operator', lastLogin: ago(60 * 24 * 3) },
    { id: 'op-4', name: 'Lia Wu',       email: 'lia@bluebird.co',   role: 'Operator', lastLogin: ago(60 * 24 * 9) },
  ],
});

// ─── Seed: approval requests in various states ──────────────────
const seedRequests = () => ([
  {
    id: 'req-2003',
    type: 'promote-admin',
    customerId: 'cust-1', customerName: 'Bluebird Logistics',
    operatorId: 'op-2', operatorName: 'Diego Rivas', operatorEmail: 'diego@bluebird.co',
    reason: 'Diego is the new operations lead for Bluebird and needs Admin to manage devices and operators.',
    submittedBy: 'sam@carbon', submittedAt: ago(20),
    status: 'pending',
    events: [{ at: ago(20), kind: 'submit', by: 'sam@carbon', text: 'Request submitted · Promote to Admin' }],
  },
  {
    id: 'req-2002',
    type: 'change-email',
    customerId: 'cust-1', customerName: 'Bluebird Logistics',
    operatorId: 'op-3', operatorName: 'Ren Kovac', operatorEmail: 'ren@bluebird.co',
    payload: { newEmail: 'ren.kovac@bluebird.co' },
    reason: 'Operator changed legal name and prefers full name on the corporate mailbox.',
    submittedBy: 'priya@carbon', submittedAt: ago(60 * 36),
    reviewedAt: ago(60 * 35), reviewedBy: 'wei@carbon',
    appliedAt: ago(60 * 35),
    status: 'approved',
    events: [
      { at: ago(60 * 36), kind: 'submit',  by: 'priya@carbon', text: 'Request submitted · Change email' },
      { at: ago(60 * 35), kind: 'approve', by: 'wei@carbon',   text: 'Approved · sign-in email changed to ren.kovac@bluebird.co' },
    ],
  },
  {
    id: 'req-2001',
    type: 'change-email',
    customerId: 'cust-99', customerName: 'Foundry Robotics',
    operatorId: 'op-ext-1', operatorName: 'Jamie Park', operatorEmail: 'jamie.p@foundry.io',
    payload: { newEmail: 'jamie@foundry.io' },
    reason: 'Foundry consolidated their email aliases; the short form is now the canonical mailbox.',
    submittedBy: 'wei@carbon', submittedAt: ago(45),
    status: 'pending',
    events: [{ at: ago(45), kind: 'submit', by: 'wei@carbon', text: 'Request submitted · Change email' }],
  },
  {
    id: 'req-1998',
    type: 'promote-admin',
    customerId: 'cust-77', customerName: 'Acme Health',
    operatorId: 'op-ext-3', operatorName: 'Carla Reyes', operatorEmail: 'carla@acmehealth.com',
    reason: 'Coverage for parental leave of current Admin (ticket #4521).',
    submittedBy: 'sam@carbon', submittedAt: ago(60 * 48),
    reviewedAt: ago(60 * 47), reviewedBy: 'priya@carbon', appliedAt: ago(60 * 47),
    status: 'approved',
    events: [
      { at: ago(60 * 48), kind: 'submit',  by: 'sam@carbon',   text: 'Request submitted · Promote to Admin' },
      { at: ago(60 * 47), kind: 'approve', by: 'priya@carbon', text: 'Approved · Carla Reyes promoted to Admin' },
    ],
  },
  {
    id: 'req-1997',
    type: 'change-email',
    customerId: 'cust-66', customerName: 'Northstar Cabs',
    operatorId: 'op-ext-4', operatorName: 'Lia Wu', operatorEmail: 'lia@northstar.co',
    payload: { newEmail: 'lwu.personal@gmail.com' },
    reason: 'Personal forwarding address request.',
    submittedBy: 'wei@carbon', submittedAt: ago(60 * 72),
    reviewedAt: ago(60 * 70), reviewedBy: 'priya@carbon',
    rejectReason: 'New address is a personal domain. Per policy operators must use a company-controlled mailbox. Please re-submit with a company email.',
    status: 'rejected',
    events: [
      { at: ago(60 * 72), kind: 'submit', by: 'wei@carbon',    text: 'Request submitted · Change email' },
      { at: ago(60 * 70), kind: 'reject', by: 'priya@carbon',  text: 'Rejected · personal domain' },
    ],
  },
]);

// ─── Seed: notifications ─────────────────────────────────────────
const seedNotifications = () => ([
  {
    id: 'n0', channel: 'email', to: 'ren.kovac@bluebird.co',
    at: ago(60 * 35), kind: 'verify', requestId: 'req-2002',
    subject: 'Verify your new sign-in email for Bluebird Logistics',
    preview: 'A Carbon admin approved a change to your sign-in email. Click the link below to confirm ownership. The link is valid for 7 days.',
  },
  {
    id: 'n1', channel: 'inapp', to: 'priya@carbon',
    at: ago(60 * 35), kind: 'status', requestId: 'req-2002',
    subject: 'Your request was approved',
    preview: 'Wei Liu approved your Change email request for Ren Kovac. Awaiting verification by the new email address.',
  },
  {
    id: 'n2', channel: 'inapp', to: 'sam@carbon',
    at: ago(45), kind: 'new-request', requestId: 'req-2001',
    subject: 'New approval request · Change email',
    preview: 'Wei Liu requested a Change email for Jamie Park on Foundry Robotics.',
  },
  {
    id: 'n3', channel: 'inapp', to: 'priya@carbon',
    at: ago(20), kind: 'new-request', requestId: 'req-2003',
    subject: 'New approval request · Promote to Admin',
    preview: 'Sam Park requested to promote Diego Rivas to Admin on Bluebird Logistics.',
  },
]);

// ─── OperatorMenu (replicates customer-detail.jsx) ──────────────
const OP_ACTIONS = {
  lock:    { label: 'Lock account',         icon: 'shield' },
  unlock:  { label: 'Unlock account',       icon: 'check' },
  reset:   { label: 'Reset password',       icon: 'edit' },
  remove:  { label: 'Remove operator',      icon: 'trash', danger: true },
  promote: { label: 'Promote to Admin\u2026',     icon: 'shield' },
  'edit-email': { label: 'Change email\u2026',    icon: 'mail' },
};
const OperatorMenu = ({ op, pendingEmailReq, pendingPromoteReq, me, onAction, onWithdraw }) => {
  const isAdmin = (op.role || 'Operator') === 'Admin';
  const emailIsMine   = pendingEmailReq   && pendingEmailReq.submittedBy   === me;
  const promoteIsMine = pendingPromoteReq && pendingPromoteReq.submittedBy === me;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const pick = (a) => { setOpen(false); onAction(a); };

  return (
    <div className="opmenu-wrap">
      <button ref={btnRef} className="iconbtn" onClick={() => setOpen((o) => !o)} aria-label="Operator actions">
        <Icon name="more" />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div ref={menuRef} className="opmenu" role="menu" style={{ position: 'fixed', top: pos.top, right: pos.right }}>
          <button className="opmenu__item" onClick={() => pick('reset')}>
            <Icon name="edit" size={14} />{OP_ACTIONS.reset.label}
          </button>
          {pendingEmailReq ? (
            emailIsMine ? (
              <button className="opmenu__item opmenu__item--danger"
                onClick={() => { setOpen(false); onWithdraw(pendingEmailReq); }}>
                <Icon name="x" size={14} />Cancel email change request
                <span className="opmenu__pendmark">Pending</span>
              </button>
            ) : (
              <button className="opmenu__item" disabled
                title={`Submitted by ${personaName(pendingEmailReq.submittedBy)} — only the submitter can cancel`}>
                <Icon name="mail" size={14} />{OP_ACTIONS['edit-email'].label}
                <span className="opmenu__pendmark">Pending</span>
              </button>
            )
          ) : (
            <button className="opmenu__item" onClick={() => pick('edit-email')}>
              <Icon name="mail" size={14} />{OP_ACTIONS['edit-email'].label}
            </button>
          )}
          <button className="opmenu__item" onClick={() => pick('lock')}>
            <Icon name="shield" size={14} />{OP_ACTIONS.lock.label}
          </button>
          {!isAdmin && <>
            <div className="opmenu__sep" />
            {pendingPromoteReq ? (
              promoteIsMine ? (
                <button className="opmenu__item opmenu__item--danger"
                  onClick={() => { setOpen(false); onWithdraw(pendingPromoteReq); }}>
                  <Icon name="x" size={14} />Cancel admin promotion request
                  <span className="opmenu__pendmark">Pending</span>
                </button>
              ) : (
                <button className="opmenu__item" disabled
                  title={`Submitted by ${personaName(pendingPromoteReq.submittedBy)} — only the submitter can cancel`}>
                  <Icon name="shield" size={14} />{OP_ACTIONS.promote.label}
                  <span className="opmenu__pendmark">Pending</span>
                </button>
              )
            ) : (
              <button className="opmenu__item" onClick={() => pick('promote')}>
                <Icon name="shield" size={14} />{OP_ACTIONS.promote.label}
              </button>
            )}
          </>}
          <div className="opmenu__sep" />
          <button className="opmenu__item opmenu__item--danger" onClick={() => pick('remove')}>
            <Icon name="trash" size={14} />{OP_ACTIONS.remove.label}
          </button>
        </div>,
        document.body)}
    </div>);
};

// ─── Pending-request chip with popover (clickable, with Withdraw if mine) ─
const PendingChip = ({ req, me, label, onWithdraw }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const isMine = req.submittedBy === me;

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current.getBoundingClientRect();
    const POP_W = 280;
    const POP_H_EST = popRef.current?.getBoundingClientRect().height || 240;
    const GAP = 6;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    // Flip above if there isn't room below and there's more room above.
    const flipUp = spaceBelow < POP_H_EST + GAP + 8 && spaceAbove > spaceBelow;
    const top = flipUp
      ? Math.max(8, r.top - POP_H_EST - GAP)
      : Math.min(window.innerHeight - POP_H_EST - 8, r.bottom + GAP);
    setPos({
      top,
      left: Math.max(8, Math.min(window.innerWidth - POP_W - 8, r.left)),
    });
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button ref={btnRef} className="pendchip pendchip--warn" onClick={() => setOpen((o) => !o)}
          title={isMine ? 'View details · you can cancel this request' : 'View request details'}>
          <Icon name="clock" size={11} />{label}
        </button>
        {isMine && (
          <button
            className="pendchip pendchip--cancel"
            onClick={(e) => { e.stopPropagation(); onWithdraw(req); }}
            title="Cancel this request"
            aria-label="Cancel this request">
            <Icon name="x" size={11} />Cancel
          </button>
        )}
      </span>
      {open && pos && ReactDOM.createPortal(
        <div ref={popRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: 280, zIndex: 200,
          background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
          borderRadius: 8, boxShadow: '0 8px 24px oklch(0% 0 0 / 0.15)',
          padding: 14,
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 6 }}>
            {TYPE_META[req.type].label} · {req.id}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
            {req.type === 'change-email' ?
              <>Change email to <code style={{ fontSize: 12, fontFamily: 'var(--font-family-mono)' }}>{req.payload.newEmail}</code></> :
              <>Promote to Admin</>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            <div>Submitted by <strong style={{ color: 'var(--color-text-primary)' }}>{personaName(req.submittedBy)}</strong></div>
            <div title={fmtFull(req.submittedAt)}>· {fmtRel(req.submittedAt)}</div>
            <div>Status · <span style={{ color: 'var(--color-warning-700)', fontWeight: 600 }}>Pending review by another Carbon admin</span></div>
          </div>
          {req.reason && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55, padding: '8px 10px', background: 'var(--color-bg-3)', borderRadius: 6, marginBottom: 10 }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>Reason: </span>{req.reason}
            </div>)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            {isMine ?
              <Btn variant="danger" size="sm" icon="x" onClick={() => { setOpen(false); onWithdraw(req); }}>
                Withdraw request
              </Btn> :
              <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                Only the submitter can withdraw
              </span>}
          </div>
        </div>,
        document.body)}
    </>);
};

// ─── Operators table (EXACT visual match) ───────────────────────
const OperatorsCard = ({ customer, requests, maskOn, setMaskOn, me, onAction, onWithdraw }) => {
  const [revealed, setRevealed] = useState({});
  const toast = useToast();
  const toggle = (i, field) => {
    setRevealed((r) => ({ ...r, [`${i}.${field}`]: !r[`${i}.${field}`] }));
    if (!revealed[`${i}.${field}`]) toast({ kind: 'info', title: 'Sensitive field revealed', msg: 'This action is recorded in the audit log.' });
  };

  const pendingFor = (opId, type) => requests.find(
    (r) => r.operatorId === opId && r.type === type && r.status === 'pending');

  return (
    <div className="info-card table-card">
      <div className="info-card__head">
        <div>
          <div className="info-card__title">Operators</div>
          <div className="info-card__sub">{customer.operators.length} active · changes to email or role go through a second-admin review</div>
        </div>
        <div className="row">
          <Btn variant="ghost" size="sm" icon={maskOn ? 'eyeOff' : 'eye'} onClick={() => setMaskOn(!maskOn)}>
            {maskOn ? 'Masked' : 'Unmasked'}
          </Btn>
          <Btn variant="secondary" size="sm" icon="plus">Add operator</Btn>
        </div>
      </div>
      <table className="tds-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Last login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {customer.operators.map((op, i) => {
            const showEmail = !maskOn || revealed[`${i}.email`];
            const showName = !maskOn || revealed[`${i}.name`];
            const isAdmin = (op.role || 'Admin') === 'Admin';
            const pendEmail = pendingFor(op.id, 'change-email');
            const pendPromote = pendingFor(op.id, 'promote-admin');

            return (
              <tr key={op.id} style={{
                cursor: 'default',
                background: isAdmin ? 'color-mix(in oklab, var(--color-info-500) 5%, transparent)' : undefined,
              }}>
                <td>
                  <div className="cust-cell">
                    <div style={{ position: 'relative' }}>
                      <CompanyLogo name={op.name || op.email} size={28} />
                      {isAdmin &&
                        <span title="Admin" style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 14, height: 14, borderRadius: '50%',
                          background: 'var(--color-info-700, #1F6FA8)', color: '#fff',
                          display: 'grid', placeItems: 'center',
                          border: '2px solid var(--color-bg-1, #fff)' }}>
                          <Icon name="shield" size={8} />
                        </span>}
                    </div>
                    <div>
                      <div className="cust-name">{showName ? op.name : maskName(op.name)}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="op-mask">{showEmail ? op.email : maskEmail(op.email)}</span>
                  {maskOn && <button className="reveal-btn" onClick={() => toggle(i, 'email')}>{revealed[`${i}.email`] ? 'Hide' : 'Reveal'}</button>}
                  {pendEmail && (
                    <div style={{ marginTop: 4 }}>
                      <PendingChip req={pendEmail} me={me} label="Email change pending review" onWithdraw={onWithdraw} />
                    </div>)}
                </td>
                <td>
                  {isAdmin ?
                    <Badge tone="info"><Icon name="shield" size={11} /> Admin</Badge> :
                    <Badge tone="neutral">{op.role || 'Operator'}</Badge>}
                  {pendPromote && (
                    <div style={{ marginTop: 4 }}>
                      <PendingChip req={pendPromote} me={me} label="Promote pending review" onWithdraw={onWithdraw} />
                    </div>)}
                </td>
                <td>
                  <span className="num" style={{ fontSize: 13 }}>
                    {op.lastLogin ? relTime(op.lastLogin) : <span className="muted">Never</span>}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <OperatorMenu
                    op={op}
                    pendingEmailReq={pendEmail}
                    pendingPromoteReq={pendPromote}
                    me={me}
                    onWithdraw={onWithdraw}
                    onAction={(a) => onAction(op, i, a)} />
                </td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>);
};

// ─── Approval request card ──────────────────────────────────────
const ApprovalCard = ({ req, me, onApprove, onReject, onWithdraw }) => {
  const sm = STATUS_META[req.status];
  const tm = TYPE_META[req.type];
  const canReview = req.status === 'pending' && req.submittedBy !== me;
  const isMine = req.submittedBy === me;
  const reviewer = req.reviewedBy ? personaName(req.reviewedBy) : null;

  return (
    <div className="acard" data-req-id={req.id}>
      <div className={`acard__icon ${tm.acardIconCls}`}>
        <Icon name={tm.icon} size={16}/>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="acard__head">
          <span>{tm.label} · {req.id}</span>
          <Badge tone={sm.tone}>{sm.label}</Badge>
          {isMine && <Badge tone="neutral">Submitted by you</Badge>}
        </div>
        <div className="acard__title">
          {req.type === 'change-email' ?
            <>Change email for <span>{req.operatorName}</span> on <span>{req.customerName}</span></> :
            <>Promote <span>{req.operatorName}</span> to Admin on <span>{req.customerName}</span></>}
        </div>
        {req.type === 'change-email' && (
          <div className="acard__diff">
            <span className="old">{req.operatorEmail}</span>
            <Icon name="arrowR" size={12}/>
            <span>{req.payload.newEmail}</span>
          </div>)}
        <div className="acard__meta">
          <span title={fmtFull(req.submittedAt)}>By {personaName(req.submittedBy)} · {fmtRel(req.submittedAt)}</span>
          {reviewer && <span>Reviewed by {reviewer}</span>}
        </div>
        {req.rejectReason &&
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-error-700)', background: 'var(--color-error-50)', border: '1px solid oklch(58% 0.20 25 / 0.2)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
            <strong>Reason:</strong> {req.rejectReason}
          </div>}
        {req.reason && req.status !== 'rejected' &&
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--color-text-tertiary)' }}>Reason: </span>{req.reason}
          </div>}
      </div>
      <div className="acard__actions" style={{ alignSelf: 'flex-start' }}>
        {canReview && <>
          <Btn variant="primary" size="sm" icon="check" onClick={onApprove}>Approve</Btn>
          <Btn variant="secondary" size="sm" icon="x" onClick={onReject}>Reject</Btn>
        </>}
        {req.status === 'pending' && isMine &&
          <Btn variant="ghost" size="sm" onClick={onWithdraw}>Withdraw</Btn>}
        {req.status === 'pending' && !canReview && !isMine &&
          <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', maxWidth: 130, textAlign: 'right' }}>Awaiting another Carbon admin</span>}
      </div>
    </div>);
};

// ─── Approvals card ─────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: 'pending',   label: 'Pending review' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'all',       label: 'All statuses' },
];

const ApprovalsCard = ({ requests, me, onApprove, onReject, onWithdraw }) => {
  const [scope, setScope]   = useState('toReview'); // 'toReview' | 'submitted'
  const [status, setStatus] = useState('pending');

  // Scope splits the universe of requests by my role.
  // - To review:  others submitted, I can act on it (or have already)
  // - Submitted:  I submitted, awaiting / done
  const scoped = useMemo(() => requests.filter((r) =>
    scope === 'toReview' ? r.submittedBy !== me : r.submittedBy === me
  ), [requests, me, scope]);

  const scopeCounts = useMemo(() => ({
    toReview:  requests.filter((r) => r.submittedBy !== me && r.status === 'pending').length,
    submitted: requests.filter((r) => r.submittedBy === me && r.status === 'pending').length,
  }), [requests, me]);

  const counts = useMemo(() => {
    const c = { all: scoped.length };
    for (const r of scoped) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [scoped]);

  const list = status === 'all' ? scoped : scoped.filter((r) => r.status === status);

  const emptyCopy = (() => {
    if (scope === 'toReview') {
      if (status === 'pending') return { title: 'All caught up', sub: 'No requests are waiting for your review.' };
      return { title: 'Nothing here', sub: 'No requests from other admins with this status.' };
    }
    if (status === 'pending') return { title: 'No pending requests', sub: 'You haven\u2019t submitted any requests that are still under review.' };
    if (status === 'all')     return { title: 'You haven\u2019t submitted any requests', sub: 'Operator changes you submit will appear here.' };
    return { title: 'Nothing here', sub: 'You don\u2019t have any submitted requests with this status.' };
  })();

  return (
    <div className="info-card">
      <div className="subtabs" style={{ display: 'flex', alignItems: 'center', paddingRight: 16 }}>
        <button className={`subtab ${scope === 'toReview' ? 'is-on' : ''}`}
          onClick={() => { setScope('toReview'); setStatus('pending'); }}>
          To review
          {scopeCounts.toReview > 0 && <span className="count">{scopeCounts.toReview}</span>}
        </button>
        <button className={`subtab ${scope === 'submitted' ? 'is-on' : ''}`}
          onClick={() => { setScope('submitted'); setStatus('pending'); }}>
          Submitted
          {scopeCounts.submitted > 0 && <span className="count">{scopeCounts.submitted}</span>}
        </button>
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8, paddingBottom: 6 }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>Status</span>
          <select className="tds-select tds-select--sm" value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-2)', font: 'inherit', fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer', minWidth: 180 }}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} {f.value === 'all' ? `(${counts.all})` : (counts[f.value] ? `(${counts[f.value]})` : '(0)')}
              </option>))}
          </select>
        </div>
      </div>
      <div className="alist">
        {list.length === 0 ?
          <div className="empty">
            <Icon name="audit" size={28}/>
            <div className="empty__title">{emptyCopy.title}</div>
            <div className="empty__sub">{emptyCopy.sub}</div>
          </div> :
          list.map((r) => (
            <ApprovalCard key={r.id} req={r} me={me}
              onApprove={() => onApprove(r)}
              onReject={() => onReject(r)}
              onWithdraw={() => onWithdraw(r)} />))}
      </div>
    </div>);
};

// ─── Notifications card ────────────────────────────────────────
const NotificationsCard = ({ notifications, me, onOpenRequest }) => {
  const visible = notifications.filter((n) =>
    (n.channel === 'inapp' && n.to === me) || n.channel === 'email');
  const inapp = visible.filter((n) => n.channel === 'inapp');
  const email = visible.filter((n) => n.channel === 'email');

  return (
    <div className="info-card">
      <div className="info-card__head">
        <div>
          <div className="info-card__title">Notifications &amp; mail</div>
          <div className="info-card__sub">In-app for {PERSONAS[me].short} · all simulated emails (sandbox)</div>
        </div>
        <Badge tone="neutral">{visible.length}</Badge>
      </div>
      <div style={{ padding: '8px 20px 4px', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="bell" size={12}/>In-app · for {PERSONAS[me].short}
      </div>
      <div className="nlist">
        {inapp.length === 0 ?
          <div className="empty" style={{ padding: '14px 20px' }}>
            <div className="empty__sub">No in-app notifications for {PERSONAS[me].short}.</div>
          </div> :
          inapp.map((n) => <NotifRow key={n.id} n={n} cta="View request" onOpen={() => onOpenRequest(n.requestId)} />)}
      </div>
      <div style={{ padding: '8px 20px 4px', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
        <Icon name="mail" size={12}/>Email · all addresses (sandbox)
      </div>
      <div className="nlist">
        {email.length === 0 ?
          <div className="empty" style={{ padding: '14px 20px' }}>
            <div className="empty__sub">No emails sent yet.</div>
          </div> :
          email.map((n) => <NotifRow key={n.id} n={n}
            cta="View related request"
            onOpen={() => onOpenRequest(n.requestId)} />)}
      </div>
    </div>);
};

const NotifRow = ({ n, onOpen, cta, hl }) => (
  <div className="notif">
    <div className={`notif__icon ${n.channel === 'email' ? 'notif__icon--email' : 'notif__icon--inapp'}`}>
      <Icon name={n.channel === 'email' ? 'mail' : 'bell'} size={14}/>
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="notif__head">
        <span>{n.channel === 'email' ? 'Email' : 'In-app'}</span>
        <span>·</span>
        <span>to <code>{n.to}</code></span>
      </div>
      <div className="notif__title">{n.subject}</div>
      <div className="notif__body">{n.preview}</div>
      {onOpen &&
        <div className="notif__cta">
          <Btn variant={hl ? 'primary' : 'ghost'} size="sm" onClick={onOpen}>{cta}</Btn>
        </div>}
    </div>
    <div className="notif__time">{fmtRel(n.at)}</div>
  </div>);

// ─── Submit Change-Email modal (stand-alone, owns its state) ────
const SubmitEmailModal = ({ open, onClose, op, customer, onSubmit }) => {
  const [newEmail, setNewEmail] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) { setNewEmail(''); setReason(''); } }, [open, op?.id]);
  if (!open || !op) return null;

  const trimmed = newEmail.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const same = trimmed.toLowerCase() === (op.email || '').toLowerCase();
  const reasonOk = reason.trim().length >= 10;
  const error = !trimmed ? null : !isEmail ? 'Enter a valid email address' : same ? 'New email must differ from current one' : null;
  const canSubmit = isEmail && !same && reasonOk;

  return (
    <Modal open onClose={onClose} title="Submit · Change operator email" width={560}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!canSubmit} onClick={() => onSubmit(trimmed, reason.trim())}>Submit for review</Btn>
      </>}>
      <div className="stack">
        <div className="notice">
          <Icon name="info" size={14}/>
          <div>This change requires <strong>approval from another Carbon admin</strong> and <strong>ownership verification</strong> of the new mailbox before it takes effect. The verification link is valid for 7 days.</div>
        </div>
        <Field label="Operator">
          <Input value={`${op.name} · ${op.role || 'Operator'} on ${customer.name}`} disabled prefix={<Icon name="user" size={14}/>} />
        </Field>
        <Field label="Current email">
          <Input value={op.email} disabled prefix={<Icon name="mail" size={14}/>} />
        </Field>
        <Field label="New email" required error={error}>
          <Input type="email" autoFocus value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            prefix={<Icon name="mail" size={14}/>}
            placeholder={`new.address@${customer.domain}`}
            invalid={!!error} />
        </Field>
        <Field label="Reason for the change" required hint={`${reason.trim().length}/10 character minimum · visible to reviewer and audit log`}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this change is necessary." />
        </Field>
      </div>
    </Modal>);
};

// ─── Submit Promote modal ───────────────────────────────────────
const SubmitPromoteModal = ({ open, onClose, op, customer, onSubmit }) => {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open, op?.id]);
  if (!open || !op) return null;
  const reasonOk = reason.trim().length >= 10;

  return (
    <Modal open onClose={onClose} title="Submit · Promote operator to Admin" width={560}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!reasonOk} onClick={() => onSubmit(reason.trim())}>Submit for review</Btn>
      </>}>
      <div className="stack">
        <div className="notice">
          <Icon name="info" size={14}/>
          <div>This change requires <strong>approval from another Carbon admin</strong>. It takes effect immediately upon approval. The current Admin keeps their role.</div>
        </div>
        <Field label="Operator">
          <Input value={`${op.name} · ${op.email} · currently ${op.role || 'Operator'}`} disabled prefix={<Icon name="user" size={14}/>} />
        </Field>
        <div className="diff">
          <div className="diff__col diff__col--old"><h5>Current role</h5><div className="diff__val">{op.role || 'Operator'}</div></div>
          <div className="diff__arrow"><Icon name="arrowR" size={18}/></div>
          <div className="diff__col diff__col--new"><h5>After approval</h5><div className="diff__val">Admin</div></div>
        </div>
        <Field label="Reason for promotion" required hint={`${reason.trim().length}/10 character minimum · visible to reviewer and audit log`}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this operator needs Admin privileges." />
        </Field>
      </div>
    </Modal>);
};

// ─── Reject modal ───────────────────────────────────────────────
const RejectModal = ({ req, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  useEffect(() => { setReason(''); }, [req?.id]);
  if (!req) return null;
  const ok = reason.trim().length >= 10;
  return (
    <Modal open onClose={onClose} title={`Reject · ${TYPE_META[req.type].label}`} width={500}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="x" disabled={!ok} onClick={() => onSubmit(req, reason.trim())}>Reject request</Btn>
      </>}>
      <div className="stack">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Rejecting will close this request. The submitter will be notified with the reason below; they will need to submit a new request to retry.
        </p>
        <Field label="Reason (visible to submitter, recorded in audit log)" required hint={`${reason.trim().length}/10 character minimum`}>
          <Textarea rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., New address is on a personal domain; please re-submit with a company-controlled mailbox." />
        </Field>
      </div>
    </Modal>);
};

// ─── App ────────────────────────────────────────────────────────
const App = () => {
  const [persona, setPersona] = useState('sam@carbon');
  const [view, setView] = useState('customer'); // 'customer' | 'approvals' | 'audit'
  const [customer, setCustomer] = useState(seedCustomer);
  const [requests, setRequests] = useState(seedRequests);
  const [notifications, setNotifications] = useState(seedNotifications);
  const [maskOn, setMaskOn] = useState(false);

  const [emailForm, setEmailForm]       = useState(null);
  const [promoteForm, setPromoteForm]   = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);

  const toast = useToast();
  const me = persona;

  const reset = () => {
    setCustomer(seedCustomer());
    setRequests(seedRequests());
    setNotifications(seedNotifications());
    toast({ kind: 'success', title: 'Demo reset' });
  };

  const notifyAll = (items) => setNotifications((ns) =>
    [...items.map((n) => ({ id: 'n-' + Math.random().toString(36).slice(2, 8), at: isoNow(), ...n })), ...ns]);

  // ── Submit ─────────────────────────────────────────────────
  const submitChangeEmail = (op, newEmail, reason) => {
    const id = 'req-' + Math.random().toString(36).slice(2, 6);
    const req = {
      id, type: 'change-email',
      customerId: customer.id, customerName: customer.name,
      operatorId: op.id, operatorName: op.name, operatorEmail: op.email,
      payload: { newEmail },
      reason,
      submittedBy: me, submittedAt: isoNow(),
      status: 'pending',
      events: [{ at: isoNow(), kind: 'submit', by: me, text: 'Request submitted · Change email' }],
    };
    setRequests((rs) => [req, ...rs]);
    notifyAll([
      { channel: 'inapp', to: op.email, kind: 'status', requestId: id,
        subject: 'A change to your sign-in email was requested',
        preview: `${personaName(me)} submitted a request to change your sign-in email from ${op.email} to ${newEmail}. The change will only apply after a second Carbon admin approves it.` },
      { channel: 'email', to: op.email, kind: 'status', requestId: id,
        subject: 'Pending change to your sign-in email',
        preview: `${personaName(me)} requested a change of your sign-in email from ${op.email} to ${newEmail}. The change requires approval from a second Carbon admin before it takes effect.` },
      ...Object.keys(PERSONAS).filter((p) => p !== me).map((p) => ({
        channel: 'inapp', to: p, kind: 'new-request', requestId: id,
        subject: 'New approval request · Change email',
        preview: `${personaName(me)} requested a change of email for ${op.name} on ${customer.name}.`,
      })),
    ]);
    toast({ kind: 'success', title: 'Request submitted for review' });
    setEmailForm(null);
  };

  const submitPromote = (op, reason) => {
    const id = 'req-' + Math.random().toString(36).slice(2, 6);
    const req = {
      id, type: 'promote-admin',
      customerId: customer.id, customerName: customer.name,
      operatorId: op.id, operatorName: op.name, operatorEmail: op.email,
      reason,
      submittedBy: me, submittedAt: isoNow(),
      status: 'pending',
      events: [{ at: isoNow(), kind: 'submit', by: me, text: 'Request submitted · Promote to Admin' }],
    };
    setRequests((rs) => [req, ...rs]);
    notifyAll(Object.keys(PERSONAS).filter((p) => p !== me).map((p) => ({
      channel: 'inapp', to: p, kind: 'new-request', requestId: id,
      subject: 'New approval request · Promote to Admin',
      preview: `${personaName(me)} requested to promote ${op.name} to Admin on ${customer.name}.`,
    })));
    toast({ kind: 'success', title: 'Request submitted for review' });
    setPromoteForm(null);
  };

  // ── Approve ───────────────────────────────────────────────
  const approveRequest = (req) => {
    const ts = isoNow();
    if (req.type === 'promote-admin') {
      if (req.customerId === customer.id) {
        setCustomer((c) => ({ ...c, operators: c.operators.map((o) => o.id === req.operatorId ? { ...o, role: 'Admin' } : o) }));
      }
      setRequests((rs) => rs.map((r) => r.id === req.id ? {
        ...r, status: 'approved', reviewedAt: ts, reviewedBy: me, appliedAt: ts,
        events: [...r.events, { at: ts, kind: 'approve', by: me, text: `Approved · ${req.operatorName} promoted to Admin` }],
      } : r));
      notifyAll([
        { channel: 'inapp', to: req.submittedBy, kind: 'status', requestId: req.id,
          subject: 'Your request was approved',
          preview: `${personaName(me)} approved your Promote to Admin request for ${req.operatorName}. The change is now live.` },
        { channel: 'email', to: req.submittedBy, kind: 'status', requestId: req.id,
          subject: 'Approval applied · Promote to Admin',
          preview: `${personaName(me)} approved your request to promote ${req.operatorName} to Admin on ${req.customerName}. The change is live.` },
        { channel: 'inapp', to: req.operatorEmail, kind: 'status', requestId: req.id,
          subject: 'You were promoted to Admin',
          preview: `Your role on ${req.customerName} has been changed to Admin by Carbon support.` },
        { channel: 'email', to: req.operatorEmail, kind: 'status', requestId: req.id,
          subject: `You are now an Admin on ${req.customerName}`,
          preview: `Your role has been changed to Admin. Sign in to manage devices, operators, and billing.` },
      ]);
      toast({ kind: 'success', title: 'Approved · change applied' });
    } else if (req.type === 'change-email') {
      // Apply the email change immediately. Notify both old and new addresses,
      // plus the submitter. The notification to the OLD address is the safety
      // net — gives the operator a chance to spot an unauthorized change.
      if (req.customerId === customer.id) {
        setCustomer((c) => ({
          ...c,
          operators: c.operators.map((o) => o.id === req.operatorId ? { ...o, email: req.payload.newEmail } : o),
        }));
      }
      setRequests((rs) => rs.map((r) => r.id === req.id ? {
        ...r, status: 'approved', reviewedAt: ts, reviewedBy: me, appliedAt: ts,
        events: [...r.events, { at: ts, kind: 'approve', by: me, text: `Approved · sign-in email changed to ${req.payload.newEmail}` }],
      } : r));
      notifyAll([
        { channel: 'inapp', to: req.submittedBy, kind: 'status', requestId: req.id,
          subject: 'Your request was approved',
          preview: `${personaName(me)} approved your Change email request. ${req.operatorName}'s sign-in email is now ${req.payload.newEmail}.` },
        { channel: 'email', to: req.submittedBy, kind: 'status', requestId: req.id,
          subject: 'Approval applied · Change email',
          preview: `${personaName(me)} approved your request to change ${req.operatorName}'s sign-in email on ${req.customerName} to ${req.payload.newEmail}.` },
        // Safety notice to the OLD address — operator can react if this wasn't authorized.
        { channel: 'email', to: req.operatorEmail, kind: 'status', requestId: req.id,
          subject: 'Your sign-in email has been changed',
          preview: `Your sign-in email on ${req.customerName} has been changed to ${req.payload.newEmail}. If you did not authorize this change, contact Carbon support immediately to roll it back.` },
        // Confirmation to the NEW address — so they know where to sign in next.
        { channel: 'email', to: req.payload.newEmail, kind: 'status', requestId: req.id,
          subject: `Welcome — this is now your sign-in email on ${req.customerName}`,
          preview: `Your account on ${req.customerName} now uses this address for sign-in. Previous address: ${req.operatorEmail}.` },
      ]);
      toast({ kind: 'success', title: 'Approved · email changed' });
    }
    setApproveTarget(null);
  };

  // ── Reject ────────────────────────────────────────────────
  const rejectRequest = (req, reason) => {
    const ts = isoNow();
    setRequests((rs) => rs.map((r) => r.id === req.id ? {
      ...r, status: 'rejected', reviewedAt: ts, reviewedBy: me, rejectReason: reason,
      events: [...r.events, { at: ts, kind: 'reject', by: me, text: `Rejected · ${reason.slice(0, 80)}` }],
    } : r));
    notifyAll([
      { channel: 'inapp', to: req.submittedBy, kind: 'status', requestId: req.id,
        subject: 'Your request was rejected',
        preview: `${personaName(me)} rejected your ${TYPE_META[req.type].label} request for ${req.operatorName}. Reason: ${reason}` },
      { channel: 'email', to: req.submittedBy, kind: 'status', requestId: req.id,
        subject: 'Approval request rejected',
        preview: `${personaName(me)} rejected your ${TYPE_META[req.type].label} request for ${req.operatorName} on ${req.customerName}. Reason: ${reason}` },
    ]);
    toast({ kind: 'warning', title: 'Request rejected' });
    setRejectTarget(null);
  };

  const withdrawRequest = (req) => {
    const ts = isoNow();
    setRequests((rs) => rs.map((r) => r.id === req.id ? {
      ...r, status: 'withdrawn',
      events: [...r.events, { at: ts, kind: 'withdraw', by: me, text: 'Withdrawn by submitter' }],
    } : r));
    toast({ kind: 'info', title: 'Request withdrawn' });
    setWithdrawTarget(null);
  };

  // ── Operator-row menu actions ─────────────────────────────
  const onOperatorAction = (op, idx, action, payload) => {
    if (action === 'edit-email')  { setEmailForm({ op }); return; }
    if (action === 'promote')     { setPromoteForm({ op }); return; }
    if (action === 'reset')       { toast({ kind: 'success', title: 'Password reset email sent', msg: `Sent to ${op.email}` }); return; }
    if (action === 'lock')        { toast({ kind: 'warning', title: 'Lock not in scope of this prototype' }); return; }
    if (action === 'remove')      { toast({ kind: 'warning', title: 'Remove not in scope of this prototype' }); return; }
    if (action === 'jump-to-request') {
      setView('approvals');
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-req-id="${payload}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  // ── Render ───────────────────────────────────────────────
  const toReviewCount = requests.filter((r) => r.status === 'pending' && r.submittedBy !== me).length;
  const myPendingOnThisCustomer = requests.filter((r) =>
    r.customerId === customer.id && r.status === 'pending');

  // Audit log: flatten every request's events with requestId attached, newest first.
  const auditEvents = useMemo(() => requests
    .flatMap((r) => r.events.map((ev) => ({ ...ev, requestId: r.id })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [requests]);

  const [, gradB] = hueFor(PERSONAS[me].name);
  const [gradA2, gradB2] = hueFor(PERSONAS[me].name);

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="side__brand">
          <div className="side__logo">C</div>
          <div className="side__name">Carbon Admin<small>TOMS</small></div>
        </div>
        <div className="side__sectionlabel">Customers</div>
        <div className="side__nav">
          <button className={`side__item ${view === 'customer' ? 'is-active' : ''}`} onClick={() => setView('customer')}><Icon name="users" size={16}/>Customers</button>
          <button className="side__item"><Icon name="building" size={16}/>Merchants</button>
          <button className="side__item"><Icon name="cpu" size={16}/>Devices</button>
        </div>
        <div className="side__sectionlabel">Operations</div>
        <div className="side__nav">
          <button className={`side__item ${view === 'approvals' ? 'is-active' : ''}`} onClick={() => setView('approvals')}><Icon name="check" size={16}/>Approvals
            {toReviewCount > 0 && <span className="side__count">{toReviewCount}</span>}
          </button>
          <button className={`side__item ${view === 'audit' ? 'is-active' : ''}`} onClick={() => setView('audit')}><Icon name="audit" size={16}/>Audit log</button>
          <button className="side__item"><Icon name="settings" size={16}/>Settings</button>
        </div>

        <div className="side__footer">
          <div className="side__avatar" style={{ background: `linear-gradient(135deg, ${gradA2}, ${gradB2})` }}>{PERSONAS[me].initials}</div>
          <div className="side__user-main">
            <div className="side__user-name">{PERSONAS[me].short}</div>
            <div className="side__user-sub">Carbon admin</div>
          </div>
          <div className="side__user-switch">
            <select value={me} onChange={(e) => setPersona(e.target.value)} title="Switch acting persona (demo only)">
              {Object.values(PERSONAS).map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
            </select>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            {view === 'customer' && <>
              <a onClick={() => setView('customer')}>Customers</a>
              <span className="crumbs__sep">/</span>
              <span className="crumbs__current">{customer.name}</span>
            </>}
            {view === 'approvals' && <>
              <a>Operations</a>
              <span className="crumbs__sep">/</span>
              <span className="crumbs__current">Approvals</span>
            </>}
            {view === 'audit' && <>
              <a>Operations</a>
              <span className="crumbs__sep">/</span>
              <span className="crumbs__current">Audit log</span>
            </>}
          </div>
          <div className="topbar__spacer"/>
          <button className="topbar__pill" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setView('approvals')}>
            <Icon name="check" size={12}/>{toReviewCount} pending approvals
          </button>
          <Btn variant="ghost" size="sm" icon="refresh" onClick={reset}>Reset demo</Btn>
        </div>
        <div className="content">
          {view === 'customer' && (
            <div className="page">
              <div className="det-header">
                <div className="det-header__logo">{customer.name[0]}</div>
                <div className="det-header__main">
                  <div className="det-header__title">
                    {customer.name}
                    <Badge tone="success" dot>{customer.status}</Badge>
                  </div>
                  <div className="det-header__meta">
                    <span><Icon name="globe" size={12}/>{customer.domain}</span>
                    <span><Icon name="users" size={12}/>{customer.operators.length} operators</span>
                    <span><Icon name="file" size={12}/>{customer.contracts.join(', ')}</span>
                  </div>
                </div>
              </div>

              <div className="det-tabs">
                <button className="det-tab">Overview</button>
                <button className="det-tab is-on">Operators &amp; roles <span className="det-tab__count">{customer.operators.length}</span></button>
                <button className="det-tab">Devices</button>
                <button className="det-tab">Contracts</button>
                <button className="det-tab">History</button>
              </div>

              {myPendingOnThisCustomer.length > 0 &&
                <div className="notice">
                  <Icon name="info" size={14}/>
                  <div>
                    <strong>{myPendingOnThisCustomer.length} pending {myPendingOnThisCustomer.length === 1 ? 'change' : 'changes'}</strong> on this customer · <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setView('approvals')}>review in the Approvals Center</a>. Operator rows show a marker until the change is applied.
                  </div>
                </div>}

              <OperatorsCard
                customer={customer}
                requests={requests}
                maskOn={maskOn}
                setMaskOn={setMaskOn}
                me={me}
                onAction={onOperatorAction}
                onWithdraw={(r) => setWithdrawTarget(r)} />
            </div>
          )}

          {view === 'approvals' && (
            <div className="page">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Approvals</h1>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Two-person review for sensitive operator changes · {Object.keys(PERSONAS).length} Carbon admins can review.
                </p>
              </div>

              <ApprovalsCard
                requests={requests}
                me={me}
                onApprove={(r) => setApproveTarget(r)}
                onReject={(r) => setRejectTarget(r)}
                onWithdraw={(r) => setWithdrawTarget(r)} />
            </div>
          )}

          {view === 'audit' && (
            <div className="page">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Audit log</h1>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Every submit / approve / reject / verify / resend / delete event from the approval workflow.
                </p>
              </div>
              <div className="info-card">
                <div className="info-card__head">
                  <div>
                    <div className="info-card__title">{auditEvents.length} events</div>
                    <div className="info-card__sub">Newest first</div>
                  </div>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  {auditEvents.length === 0 ?
                    <div className="empty"><div className="empty__sub">No audit events yet.</div></div> :
                    <ul className="tl" style={{ paddingLeft: 4 }}>
                      {auditEvents.map((ev, i) => {
                        const dot = ev.kind === 'approve' || ev.kind === 'verify' ? 'ok' :
                                     ev.kind === 'reject' ? 'err' :
                                     ev.kind === 'submit' || ev.kind === 'resend' ? 'info' :
                                     ev.kind === 'cancel' || ev.kind === 'withdraw' ? 'warn' : 'info';
                        return (
                          <li key={i} className="tl__row">
                            <div className={`tl__dot tl__dot--${dot}`}/>
                            <div>
                              <div className="tl__text">{ev.text} · <code style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ev.requestId}</code></div>
                              <div className="tl__meta">{fmtFull(ev.at)} · {personaName(ev.by) || ev.by}</div>
                            </div>
                          </li>);
                      })}
                    </ul>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      <SubmitEmailModal
        open={!!emailForm}
        onClose={() => setEmailForm(null)}
        op={emailForm?.op}
        customer={customer}
        onSubmit={(newEmail, reason) => submitChangeEmail(emailForm.op, newEmail, reason)} />

      <SubmitPromoteModal
        open={!!promoteForm}
        onClose={() => setPromoteForm(null)}
        op={promoteForm?.op}
        customer={customer}
        onSubmit={(reason) => submitPromote(promoteForm.op, reason)} />

      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)}
        title={approveTarget ? `Approve · ${TYPE_META[approveTarget.type].label}` : ''}
        width={500}
        footer={approveTarget && <>
          <Btn variant="ghost" onClick={() => setApproveTarget(null)}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={() => approveRequest(approveTarget)}>Approve request</Btn>
        </>}>
        {approveTarget && (
          <div className="stack">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
              {approveTarget.type === 'promote-admin' ?
                <>Approving will <strong>immediately promote {approveTarget.operatorName} to Admin</strong> on {approveTarget.customerName}. Both the submitter and {approveTarget.operatorName} will be notified by in-app and email.</> :
                <>Approving will <strong>immediately change the sign-in email</strong> for {approveTarget.operatorName} on {approveTarget.customerName} to <code>{approveTarget.payload?.newEmail}</code>. A notice goes to <strong>both the old and new addresses</strong> so the operator can react if this wasn't authorized.</>}
            </p>
            <div className="notice"><Icon name="info" size={14}/><div>This decision is audited and cannot be undone — to reverse, submit a new request.</div></div>
          </div>)}
      </Modal>

      <RejectModal req={rejectTarget} onClose={() => setRejectTarget(null)} onSubmit={rejectRequest} />

      <Modal open={!!withdrawTarget} onClose={() => setWithdrawTarget(null)}
        title="Withdraw request" width={440}
        footer={withdrawTarget && <>
          <Btn variant="ghost" onClick={() => setWithdrawTarget(null)}>Keep request</Btn>
          <Btn variant="danger" onClick={() => withdrawRequest(withdrawTarget)}>Withdraw</Btn>
        </>}>
        {withdrawTarget && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Withdraw your {TYPE_META[withdrawTarget.type].label} request for <strong>{withdrawTarget.operatorName}</strong>? Other Carbon admins will be notified. You can re-submit later.
        </p>}
      </Modal>
    </div>);
};

const Root = () => <ToastProvider><App/></ToastProvider>;
ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
