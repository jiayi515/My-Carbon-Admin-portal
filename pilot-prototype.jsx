/* global React, ReactDOM, Icon, Btn, Input, Field, Select, Modal, ToastProvider, useToast, iconForKind, CONTRACT_INFO, fmtDate, fmtDateTime */
// ─────────────────────────────────────────────────────────────
// pilot-prototype.jsx — Standalone prototype for the PILOT
// contract status. Shows:
//   1. PILOT contract row in 4 states (active / expiring / expired / converted-history)
//   2. Extend pilot modal (+90d from today)
//   3. Convert-to-Active 3-step wizard
//   4. Tweaks panel to jump between contract states
// ─────────────────────────────────────────────────────────────

const { useState, useEffect, useMemo } = React;

// ── Mock helpers ─────────────────────────────────────────────
const NOW = new Date('2026-05-26T10:00:00');                 // pinned "today" so screenshots are reproducible
const addDays = (date, d) => new Date(date.getTime() + d * 86400000);
const isoStr = (d) => d.toISOString();
const daysUntil = (iso) => Math.ceil((new Date(iso) - NOW) / 86400000);
const fmtMonthDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// First day of next month — used to derive billingStartsAt from effectiveFrom.
// Rule: if the date IS the 1st, billing starts that same day; else the 1st of next month.
const nextMonthFirst = (d) => {
  const x = new Date(d);
  if (x.getDate() === 1) return new Date(x.getFullYear(), x.getMonth(), 1);
  return new Date(x.getFullYear(), x.getMonth() + 1, 1);
};

// ── Pilot derived helpers (would live in shared.jsx after integration) ──
// Replaces window.effectiveStatus for the prototype — the live version
// only handles ACTIVE/SUSPENDED/TERMINATED, so we extend it locally.
const pilotEffectiveStatus = (c) => {
  if (!c) return null;
  const s = String(c.status || '').toUpperCase();
  if (s !== 'ACTIVE' && s !== 'PILOT') return s;
  if (c.effectiveTo && new Date(c.effectiveTo) < NOW) return 'EXPIRED';
  return s;
};
window.pilotEffectiveStatus = pilotEffectiveStatus;

// ── Mock contracts: 4 archetypes admins should see ───────────
// Each contract carries its full EntityContractEvent stream so the
// "Originated as pilot" trace + timeline are derivable.
const mkPilotEvents = (kind, startedAt, extensions = []) => {
  const out = [{
    id: `ece-${kind}-1`, eventType: 'BIND_PILOT', eventTimestamp: startedAt,
    operatorUserId: 'lin.wei@npt',
    eventInfo: { initialEffectiveTo: isoStr(addDays(new Date(startedAt), 180)), entitlementsSnapshot: { _pilot: true } },
  }];
  extensions.forEach((ext, i) => out.push({
    id: `ece-${kind}-ext${i + 1}`, eventType: 'PILOT_EXTEND',
    eventTimestamp: ext.at, operatorUserId: ext.by,
    eventInfo: { fromEffectiveTo: ext.from, toEffectiveTo: ext.to, reason: ext.reason },
  }));
  return out;
};

const PILOT_NEW = {
  id: 'ec-pilot-new',
  kind: 'ISO',
  authorizedEntityId: 'e-acme',
  authorizingEntityId: 'e-npt',
  authorizingEntityName: 'NPT',
  status: 'PILOT',
  effectiveFrom: isoStr(addDays(NOW, -47)),          // pilot started 47 days ago
  effectiveTo:   isoStr(addDays(NOW, 133)),          // 47 + 133 = 180 days
  entitlements: {
    settlementCurrency: 'USD',
    deviceBasicService: { price: 0 },
    deviceModels: ['m-n950', 'm-pos-lite'],
    FlyDesk:       { enable: true,  priceStrategy: { price: 0 } },
    GeoLocation:   { enable: false, priceStrategy: { price: 0 } },
    GeoFencing:    { enable: false, priceStrategy: { price: 0 } },
    'Pre-warning': { enable: true,  priceStrategy: { price: 0 } },
  },
  authorizedAt: isoStr(addDays(NOW, -47)),
  events: mkPilotEvents('p1', isoStr(addDays(NOW, -47))),
};

const PILOT_EXPIRING = {
  id: 'ec-pilot-expiring',
  kind: 'ISV',
  authorizedEntityId: 'e-acme',
  authorizingEntityId: 'e-npt',
  authorizingEntityName: 'NPT',
  status: 'PILOT',
  effectiveFrom: isoStr(addDays(NOW, -173)),         // started 173 days ago
  effectiveTo:   isoStr(addDays(NOW, 7)),            // 7 days left → fires T-7 reminder
  entitlements: {},
  authorizedAt: isoStr(addDays(NOW, -173)),
  events: mkPilotEvents('p2', isoStr(addDays(NOW, -173)), [
    { at: isoStr(addDays(NOW, -90)), from: isoStr(addDays(NOW, -83)), to: isoStr(addDays(NOW, 7)), by: 'lin.wei@npt', reason: 'Customer wants more time to compare two integration approaches' },
  ]),
};

const PILOT_EXPIRED = {
  id: 'ec-pilot-expired',
  kind: 'MERCHANT',
  authorizedEntityId: 'e-acme',
  authorizingEntityId: 'e-iso-summit',
  authorizingEntityName: 'Summit Payments',
  status: 'PILOT',
  effectiveFrom: isoStr(addDays(NOW, -200)),
  effectiveTo:   isoStr(addDays(NOW, -20)),         // expired 20 days ago
  entitlements: {},
  authorizedAt: isoStr(addDays(NOW, -200)),
  events: mkPilotEvents('p3', isoStr(addDays(NOW, -200))),
};

const ACTIVE_FROM_PILOT = {
  id: 'ec-converted',
  kind: 'ISO',
  authorizedEntityId: 'e-acme',
  authorizingEntityId: 'e-npt',
  authorizingEntityName: 'NPT',
  status: 'ACTIVE',
  effectiveFrom: isoStr(addDays(NOW, -60)),
  effectiveTo: null,
  entitlements: {
    settlementCurrency: 'USD',
    deviceBasicService: { price: 4.5 },
    deviceModels: ['m-n950', 'm-pos-lite', 'm-px5'],
    FlyDesk:       { enable: true,  priceStrategy: { price: 12 } },
    GeoLocation:   { enable: true,  priceStrategy: { price: 0.8 } },
    GeoFencing:    { enable: false, priceStrategy: { price: 0 } },
    'Pre-warning': { enable: true,  priceStrategy: { price: 8 } },
  },
  authorizedAt: isoStr(addDays(NOW, -240)),
  events: [
    ...mkPilotEvents('p4', isoStr(addDays(NOW, -240)), [
      { at: isoStr(addDays(NOW, -90)), from: isoStr(addDays(NOW, -60)), to: isoStr(addDays(NOW, 30)), by: 'lin.wei@npt' },
    ]),
    {
      id: 'ece-p4-convert', eventType: 'PILOT_CONVERT',
      eventTimestamp: isoStr(addDays(NOW, -60)),
      operatorUserId: 'alex.kim@npt',
      eventInfo: {
        pilotStartedAt: isoStr(addDays(NOW, -240)),
        newEffectiveFrom: isoStr(addDays(NOW, -60)),
        derivedBillingStartsAt: isoStr(nextMonthFirst(addDays(NOW, -60))),
        entitlementsDiff: { deviceBasicService: { from: 0, to: 4.5 } },
      },
    },
  ],
};

const SCENARIOS = {
  new:       { contract: PILOT_NEW,         label: 'Fresh pilot',          sub: 'Day 47 of 180 · in progress' },
  expiring:  { contract: PILOT_EXPIRING,    label: 'About to expire',      sub: '7 days left · T-7 reminder fired' },
  expired:   { contract: PILOT_EXPIRED,     label: 'Expired',              sub: 'Overdue 20 days · operators blocked' },
  converted: { contract: ACTIVE_FROM_PILOT, label: 'Converted to active',  sub: 'Pilot history retained' },
};

const MOCK_CUSTOMER = { id: 'e-acme', name: 'Acme Robotics Inc.', country: 'US' };

// ── PILOT status chip ────────────────────────────────────────
// Uses tds-badge--pilot for ACTIVE PILOT, tds-badge--warning + dashed
// for EXPIRED PILOT (visually same as ACTIVE-EXPIRED — the hover tip is
// the only thing that differs).
const PilotChip = ({ contract }) => {
  const eff = pilotEffectiveStatus(contract);
  const isPilot = String(contract.status).toUpperCase() === 'PILOT';
  const [tip, setTip] = useState(null);
  const ref = React.useRef(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTip({ x: r.left + r.width / 2, y: r.top });
  };

  let label, cls, tipText;
  if (eff === 'EXPIRED' && isPilot) {
    label = 'Expired'; cls = 'tds-badge tds-badge--pilot-expired';
    tipText = 'Pilot expired · operators blocked from sign-in';
  } else if (eff === 'PILOT') {
    label = 'Pilot'; cls = 'tds-badge tds-badge--pilot';
    tipText = `Pilot · expires ${fmtMonthDay(contract.effectiveTo)}`;
  } else if (eff === 'EXPIRED') {
    label = 'Expired'; cls = 'tds-badge tds-badge--warning';
    tipText = 'Contract expired · extend effective-to to revive';
  } else if (eff === 'ACTIVE') {
    label = 'Active'; cls = 'tds-badge tds-badge--success';
    tipText = 'Contract is in force';
  } else if (eff === 'SUSPENDED') {
    label = 'Suspended'; cls = 'tds-badge tds-badge--error'; tipText = 'Suspended';
  } else {
    label = eff; cls = 'tds-badge tds-badge--neutral'; tipText = eff;
  }

  return (
    <>
      <span ref={ref} className={cls} onMouseEnter={show} onMouseLeave={() => setTip(null)} style={{ cursor: 'help' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>
        {label}
      </span>
      {tip && ReactDOM.createPortal(
        <div className="tds-floating-tip" style={{ left: tip.x, top: tip.y }}>{tipText}</div>,
        document.body
      )}
    </>
  );
};

// ── PILOT countdown pill (inline with the chip) ──────────────
// Tiny pill next to the status chip that carries the "how urgent" signal.
// Replaces the previous full-width banner — same info (days left + urgency
// color), 1/8 the visual weight. Color shifts: indigo → amber (≤30d) → red
// (expired). The banner used to also restate the chip status ("Pilot in
// progress") and the end date — both now live in chip + subtitle, never
// both at once.
const PilotCountdown = ({ contract }) => {
  if (String(contract.status).toUpperCase() !== 'PILOT') return null;
  const eff = pilotEffectiveStatus(contract);
  const daysLeft = daysUntil(contract.effectiveTo);
  const expired = eff === 'EXPIRED';

  const tone =
    expired              ? 'expired'
    : daysLeft <= 30     ? 'warning'
    : 'active';

  return (
    <span className={`pilot-countdown pilot-countdown--${tone}`}>
      <Icon name={expired ? 'alert' : 'clock'} size={11}/>
      {expired ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
    </span>
  );
};

// ── Operator-blocked warning strip ───────────────────────────
// Only renders for EXPIRED PILOT — it's the one piece of urgent info that
// can't be inferred from the chip alone (admins might not realize EXPIRED
// blocks login). Single-line, red.
const OperatorsBlockedStrip = ({ contract }) => {
  if (pilotEffectiveStatus(contract) !== 'EXPIRED') return null;
  return (
    <div className="crow-warn">
      <Icon name="alert" size={12}/>
      <span>Operators blocked from sign-in · extend +90d to restore access</span>
    </div>
  );
};

// ── Subtitle text for the contract row ───────────────────────
// One-glance identity context. The countdown chip already carries days
// left + end date urgency, so subtitle stays focused on identity:
//   start date + extension count + authorizer.
const rowSubtitle = (c) => {
  const isPilot = String(c.status).toUpperCase() === 'PILOT';
  const ext = (c.events || []).filter((e) => e.eventType === 'PILOT_EXTEND').length;
  const auth = c.authorizingEntityName;

  if (isPilot) {
    return (
      <>
        Pilot started {fmtMonthDay(c.effectiveFrom)}
        {ext > 0 && <> · <b style={{ color: 'var(--color-text-secondary)' }}>{ext} renewal{ext === 1 ? '' : 's'}</b></>}
        {' · Authorized by '}{auth}
      </>
    );
  }
  // ACTIVE-from-pilot
  return <>Effective {fmtMonthDay(c.effectiveFrom)} → no end date · Authorized by {auth}</>;
};

// ── Converted-from-pilot trace strip (shown under ACTIVE row when origin was PILOT) ──
const PilotTrace = ({ contract }) => {
  const evs = contract.events || [];
  const birth = evs.find((e) => e.eventType === 'BIND_PILOT');
  const convert = evs.find((e) => e.eventType === 'PILOT_CONVERT');
  const exts = evs.filter((e) => e.eventType === 'PILOT_EXTEND').length;
  if (!birth || !convert) return null;
  return (
    <div className="pilot-trace">
      <Icon name="sparkles" size={11}/>
      <span>
        <b>Converted from pilot</b> · started {fmtMonthDay(birth.eventTimestamp)} · converted {fmtMonthDay(convert.eventTimestamp)}
        {exts > 0 && <> · {exts} renewal{exts === 1 ? '' : 's'}</>}
        {convert.eventInfo?.derivedBillingStartsAt && <> · billing from {fmtMonthDay(convert.eventInfo.derivedBillingStartsAt)}</>}
      </span>
    </div>
  );
};

// ── Contract row (single PILOT or ACTIVE-from-pilot) ──────────
// Compact single-row layout. The big "PILOT banner" block from v1
// has been split into:
//   • countdown chip next to status chip (urgency at a glance)
//   • Extend / Convert as row-level CTAs on the right
//   • a thin red strip only for EXPIRED ("operators blocked")
// Net: ~3 visible lines vs the v1 ~6, with no duplicated info.
const ContractRow = ({ contract, onExtend, onConvert }) => {
  const isPilot = String(contract.status).toUpperCase() === 'PILOT';
  return (
    <div className="crow">
      <div className={`pick-card__icon pick-card__icon--${contract.kind.toLowerCase()}`}>
        <Icon name={iconForKind(contract.kind)} size={18}/>
      </div>
      <div className="crow__main">
        <div className="crow__title">
          {contract.kind}
          <PilotChip contract={contract}/>
          <PilotCountdown contract={contract}/>
        </div>
        <div className="crow__sub">{rowSubtitle(contract)}</div>
        {isPilot && <OperatorsBlockedStrip contract={contract}/>}
      </div>
      <div className="crow__actions">
        {isPilot && <Btn variant="ghost" size="sm" icon="refresh" onClick={onExtend}>Extend</Btn>}
        {isPilot && <Btn variant="primary" size="sm" onClick={onConvert}>Convert to active</Btn>}
        <button className="iconbtn" title="More actions"><Icon name="more" size={14}/></button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// EXTEND PILOT MODAL — single-step. Just confirms +90d from today.
// ─────────────────────────────────────────────────────────────
// Available extension durations. Default is 30d (least commitment) — the
// admin can step up to 60 or 90 if the customer needs more runway. Each
// option still writes the same PILOT_EXTEND event; only `toEffectiveTo`
// changes. The 90d default from earlier rounds was too generous as a
// default — most renewals are short tactical pushes.
const EXTEND_OPTIONS = [30, 60, 90];

const ExtendPilotModal = ({ open, contract, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(30);
  useEffect(() => { if (open) { setReason(''); setDays(30); } }, [open]);
  if (!contract) return null;

  const newTo = addDays(NOW, days);
  const oldTo = new Date(contract.effectiveTo);
  const isExpired = oldTo < NOW;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Extend pilot +${days} days`}
      width={520}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={() => onConfirm({ reason, days })}>Confirm extension</Btn>
      </>}
    >
      <div className="stack">
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          Extending sets the pilot expiry to <b style={{ color: 'var(--color-text-primary)' }}>today + {days} days</b> — it doesn't stack on the current expiry. No cap on renewals. Each extension writes a <code>PILOT_EXTEND</code> event.
        </div>

        {/* Duration picker — segmented control. 30d is the default. */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Duration</div>
          <div style={{ display: 'inline-flex', padding: 3, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, gap: 2 }}>
            {EXTEND_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDays(opt)}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 0, cursor: 'pointer',
                  font: '500 13px var(--font-family-sans)',
                  background: days === opt ? 'var(--color-bg-2)' : 'transparent',
                  color: days === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: days === opt ? 'var(--shadow-1)' : 'none',
                }}
              >
                +{opt} days
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 14, alignItems: 'center', padding: 14, background: 'var(--color-bg-3)', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', letterSpacing: 0.08, textTransform: 'uppercase' }}>Current expiry</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{fmtMonthDay(oldTo)}</div>
            {isExpired && <div style={{ fontSize: 11, color: 'var(--color-error-700)', marginTop: 2 }}>Overdue {Math.abs(daysUntil(contract.effectiveTo))} days</div>}
          </div>
          <Icon name="arrowR" size={16}/>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', letterSpacing: 0.08, textTransform: 'uppercase' }}>After extension</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--color-success-700)' }}>{fmtMonthDay(newTo)}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, fontFamily: 'var(--font-family-mono)' }}>= today + {days} days</div>
          </div>
        </div>

        <Field label="Reason (optional)" hint="Saved on the PILOT_EXTEND event for later review.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer wants more time to compare integrations"/>
        </Field>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// CONVERT PILOT WIZARD — 3 steps:
//   1. Warning + checkbox acknowledge
//   2. Re-enter fee clauses (all prices cleared, must type each)
//   3. Diff review + final confirm
// ─────────────────────────────────────────────────────────────

// ISO entitlement schema (mirrors window.CONTRACT_ENTITLEMENT_SCHEMA shape)
const ISO_FEE_FIELDS = [
  { key: 'deviceBasicService', label: 'Device basic service', unit: 'per device · monthly', kind: 'price' },
  { key: 'FlyDesk',       label: 'FlyDesk',            unit: 'monthly flat',         kind: 'feature' },
  { key: 'GeoLocation',   label: 'GeoLocation',        unit: 'per device · monthly', kind: 'feature' },
  { key: 'GeoFencing',    label: 'GeoFencing',         unit: 'per 1k devices · monthly', kind: 'feature' },
  { key: 'Pre-warning',   label: 'Pre-warning',        unit: 'monthly flat',         kind: 'feature' },
];

const ConvertWizard = ({ open, contract, onClose, onConfirm }) => {
  const [step, setStep] = useState(0);
  const [ack, setAck] = useState(false);
  const [fees, setFees] = useState({});                  // {key: {price: str, dirty: bool}}
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [pilotConfigCopied, setPilotConfigCopied] = useState(false);

  // On open: reset every step + clear prices. Toggles/enabled flags
  // carry forward; prices forced blank to make admins explicitly retype.
  useEffect(() => {
    if (!open || !contract) return;
    setStep(0);
    setAck(false);
    setPilotConfigCopied(false);
    setEffFrom(new Date(NOW).toISOString().slice(0, 10));
    setEffTo('');
    const next = {};
    ISO_FEE_FIELDS.forEach((f) => {
      const cur = contract.entitlements?.[f.key];
      if (f.kind === 'price') {
        next[f.key] = { enable: true, price: '', dirty: false };
      } else {
        const enable = !!cur?.enable;
        next[f.key] = { enable, price: '', dirty: false };
      }
    });
    setFees(next);
  }, [open, contract]);

  if (!contract) return null;

  const setFee = (key, patch) => setFees((p) => ({ ...p, [key]: { ...p[key], ...patch, dirty: true } }));

  // Validation: every enabled field must have a dirty entry (admin
  // typed something — even if it's "0").
  const validate = () => {
    const errs = {};
    ISO_FEE_FIELDS.forEach((f) => {
      const v = fees[f.key];
      if (!v?.enable) return;
      if (!v.dirty) { errs[f.key] = 'Confirm this fee'; return; }
      if (v.price === '' || v.price == null) { errs[f.key] = 'Enter an amount (0 for free)'; return; }
      const n = Number(v.price);
      if (!Number.isFinite(n) || n < 0) errs[f.key] = 'Must be ≥ 0';
    });
    return errs;
  };
  const errs = validate();
  const allValid = Object.keys(errs).length === 0;

  const copyPilotConfig = () => {
    // Pre-fill all enabled fees with 0 (and mark dirty so they pass validation).
    // Designed for the edge case where the admin really does want to keep
    // everything free — they still made the explicit choice.
    const next = { ...fees };
    ISO_FEE_FIELDS.forEach((f) => {
      if (next[f.key]?.enable) next[f.key] = { ...next[f.key], price: '0', dirty: true };
    });
    setFees(next);
    setPilotConfigCopied(true);
  };

  // Computed pieces for step 3 (diff view)
  const newFrom = effFrom ? new Date(effFrom + 'T00:00:00') : NOW;
  const billingStarts = nextMonthFirst(newFrom);

  const diffRows = ISO_FEE_FIELDS.map((f) => {
    const oldVal = contract.entitlements?.[f.key];
    const oldPrice =
      f.kind === 'price'   ? (oldVal?.price ?? 0)
                           : (oldVal?.enable ? (oldVal?.priceStrategy?.price ?? 0) : null);
    const newEnable = fees[f.key]?.enable;
    const newPrice  = newEnable ? Number(fees[f.key]?.price || 0) : null;
    return { key: f.key, label: f.label, unit: f.unit, oldPrice, newPrice, oldEnable: f.kind === 'price' ? true : !!oldVal?.enable, newEnable: !!newEnable };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert pilot to active"
      width={680}
      footer={
        step === 0 ? (
          <>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!ack} onClick={() => setStep(1)}>Next · Re-enter fees</Btn>
          </>
        ) : step === 1 ? (
          <>
            <Btn variant="ghost" onClick={() => setStep(0)}>Back</Btn>
            <Btn variant="primary" disabled={!allValid} onClick={() => setStep(2)}>Next · Review diff</Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" onClick={() => setStep(1)}>Back</Btn>
            <Btn variant="primary" icon="check" onClick={() => onConfirm({ fees, effFrom, effTo, billingStarts })}>
              Confirm conversion
            </Btn>
          </>
        )
      }
    >
      {/* Stepper */}
      <div className="convert-steps">
        {['Acknowledge', 'Re-enter fees', 'Review diff'].map((lbl, i) => (
          <React.Fragment key={lbl}>
            <div className={`convert-step ${step === i ? 'is-active' : ''} ${step > i ? 'is-done' : ''}`}>
              <div className="convert-step__dot">{step > i ? <Icon name="check" size={12}/> : (i + 1)}</div>
              <div className="convert-step__lbl">{lbl}</div>
            </div>
            {i < 2 && <div className={`convert-step__bar ${step > i ? 'is-done' : ''}`}/>}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="convert-warning">
            <div className="convert-warning__icon"><Icon name="alert" size={18}/></div>
            <div>
              <div className="convert-warning__title">This is irreversible</div>
              <div className="convert-warning__body">
                <ul>
                  <li><b>Every fee must be re-entered.</b> Pilot prices were $0 — type each one explicitly, even to keep it at 0.</li>
                  <li><b>You cannot return to PILOT</b> after conversion.</li>
                </ul>
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--color-border-default)', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, background: ack ? 'var(--color-primary-50)' : 'transparent' }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary-700)' }}/>
            <span>I understand: this will start billing for <b>{MOCK_CUSTOMER.name}</b>.</span>
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55, flex: 1, minWidth: 240 }}>
              Enabled clauses appear below. <b>All amounts have been cleared</b> — re-enter each one. Even keeping a clause at $0 requires explicit input.
            </div>
            <Btn variant="ghost" size="sm" icon="copy" onClick={copyPilotConfig} disabled={pilotConfigCopied}>
              {pilotConfigCopied ? 'Pilot config applied' : 'Copy pilot config ($0 all)'}
            </Btn>
          </div>

          <div style={{ background: 'var(--color-bg-3)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Fee clauses</div>
            {ISO_FEE_FIELDS.map((f) => {
              const v = fees[f.key] || {};
              const isEnabled = v.enable;
              const err = errs[f.key];
              return (
                <div key={f.key} className="convert-fee-row" data-dirty={v.dirty && !err} data-error={!!err}>
                  <div className="convert-fee-row__lbl">
                    {f.label}
                    <small>{f.unit}</small>
                  </div>
                  <div className="convert-fee-row__input">
                    {f.kind === 'feature' && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginRight: 8 }}>
                        <input type="checkbox" checked={!!v.enable} onChange={(e) => setFee(f.key, { enable: e.target.checked, price: '' })}/>
                        Enable
                      </label>
                    )}
                    {isEnabled ? (
                      <Input
                        size="sm"
                        type="text"
                        inputMode="decimal"
                        value={v.price || ''}
                        invalid={!!err}
                        onChange={(e) => setFee(f.key, { price: e.target.value })}
                        placeholder="0.00"
                        prefix={<span style={{ color: 'var(--color-text-tertiary)' }}>$</span>}
                        style={{ width: 130 }}
                      />
                    ) : (
                      <span className="muted" style={{ fontSize: 12.5 }}>Disabled · no fee</span>
                    )}
                  </div>
                  <div className="convert-fee-row__pilot">PILOT $0</div>
                  {err && <div className="convert-fee-row__hint">{err}</div>}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Effective from" hint="Defaults to today. Cannot be earlier than today.">
              <Input type="date" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}/>
            </Field>
            <Field label="Effective to (optional)" hint="Leave blank for no end date.">
              <Input type="date" value={effTo} onChange={(e) => setEffTo(e.target.value)}/>
            </Field>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--color-info-50)', border: '1px solid oklch(60% 0.14 230 / 0.25)', borderRadius: 8, fontSize: 12, color: 'var(--color-info-700)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon name="info" size={14}/>
            <span>Derived billing start: <b>{fmtMonthDay(billingStarts)}</b> — not stored, computed live from effectiveFrom on both UI and billing service sides.</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            Review the changes below. On confirm, the system writes a <code>PILOT_CONVERT</code> event + a global audit entry + notifications.
          </div>

          <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 10, background: 'var(--color-bg-2)' }}>
            <div className="diff-row" style={{ background: 'var(--color-bg-3)', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <div>Clause</div>
              <div>Pilot → Active</div>
            </div>
            {diffRows.map((d) => (
              <div key={d.key} className="diff-row">
                <div className="diff-row__lbl">{d.label}<div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400, marginTop: 2 }}>{d.unit}</div></div>
                <div className="diff-row__val">
                  <span className="diff-from">
                    {d.oldEnable ? `$${Number(d.oldPrice).toFixed(2)}` : 'disabled'}
                  </span>
                  <Icon name="arrowR" size={12} className="diff-arrow"/>
                  <span className="diff-to">
                    {d.newEnable ? `$${Number(d.newPrice).toFixed(2)}` : 'disabled'}
                  </span>
                </div>
              </div>
            ))}
            <div className="diff-row">
              <div className="diff-row__lbl">Effective window</div>
              <div className="diff-row__val">
                <span className="diff-from">
                  {fmtMonthDay(contract.effectiveFrom)} → {fmtMonthDay(contract.effectiveTo)}
                </span>
                <Icon name="arrowR" size={12} className="diff-arrow"/>
                <span className="diff-to">
                  {fmtMonthDay(newFrom)} → {effTo ? fmtMonthDay(effTo) : 'no end date'}
                </span>
              </div>
            </div>
            <div className="diff-row">
              <div className="diff-row__lbl">Billing starts</div>
              <div className="diff-row__val">
                <span className="diff-from">No invoice</span>
                <Icon name="arrowR" size={12} className="diff-arrow"/>
                <span className="diff-to">{fmtMonthDay(billingStarts)}</span>
              </div>
            </div>
            <div className="diff-row">
              <div className="diff-row__lbl">Status</div>
              <div className="diff-row__val">
                <span className="diff-from">PILOT</span>
                <Icon name="arrowR" size={12} className="diff-arrow"/>
                <span className="diff-to">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="convert-warning" style={{ background: 'var(--color-error-50)', border: '1px solid oklch(58% 0.20 25 / 0.25)', color: 'var(--color-error-700)' }}>
            <div className="convert-warning__icon"><Icon name="alert" size={16}/></div>
            <div style={{ fontSize: 12.5 }}>
              <b>Irreversible.</b> Once you click "Confirm conversion", the contract cannot return to PILOT.
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN APP — wraps everything in ToastProvider, mounts the
// scenario switcher + the contracts tab. Each scenario shows ONE
// contract row so the focus stays on the PILOT-specific UX bits.
// ─────────────────────────────────────────────────────────────
const App = () => {
  const [scenarioKey, setScenarioKey] = useState('new');
  const [extendOpen, setExtendOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  // Local store so the "extend" action visibly changes the date.
  const [contractOverrides, setContractOverrides] = useState({});

  const scenario = SCENARIOS[scenarioKey];
  const baseContract = scenario.contract;
  const contract = contractOverrides[baseContract.id] || baseContract;

  const toast = useToast();

  const handleExtend = ({ reason, days }) => {
    const newTo = isoStr(addDays(NOW, days));
    const evId = `ece-${baseContract.id}-ext-${Date.now()}`;
    const newEv = {
      id: evId, eventType: 'PILOT_EXTEND',
      eventTimestamp: isoStr(NOW),
      operatorUserId: 'demo.admin@npt',
      eventInfo: { fromEffectiveTo: contract.effectiveTo, toEffectiveTo: newTo, reason: reason || null, days },
    };
    setContractOverrides((p) => ({
      ...p,
      [baseContract.id]: { ...contract, effectiveTo: newTo, events: [...(contract.events || []), newEv] },
    }));
    setExtendOpen(false);
    toast({ kind: 'success', title: 'Pilot extended', msg: `New expiry: ${fmtMonthDay(newTo)}.` });
  };

  const handleConvert = (payload) => {
    setContractOverrides((p) => ({
      ...p,
      [baseContract.id]: {
        ...contract,
        status: 'ACTIVE',
        effectiveFrom: payload.effFrom ? isoStr(new Date(payload.effFrom + 'T00:00:00')) : isoStr(NOW),
        effectiveTo: payload.effTo ? isoStr(new Date(payload.effTo + 'T00:00:00')) : null,
        events: [
          ...(contract.events || []),
          {
            id: `ece-${baseContract.id}-cv-${Date.now()}`,
            eventType: 'PILOT_CONVERT',
            eventTimestamp: isoStr(NOW),
            operatorUserId: 'demo.admin@npt',
            eventInfo: {
              pilotStartedAt: contract.effectiveFrom,
              newEffectiveFrom: isoStr(new Date(payload.effFrom + 'T00:00:00')),
              derivedBillingStartsAt: isoStr(payload.billingStarts),
            },
          },
        ],
      },
    }));
    setConvertOpen(false);
    toast({ kind: 'success', title: 'Converted to active', msg: `${baseContract.kind} contract is now active.` });
  };

  return (
    <div className="stage">
      <p className="stage__crumb">Carbon · Admin / Customer / Acme Robotics</p>
      <div className="stage__hdr">
        <div>
          <h1 className="stage__title">Contracts</h1>
          <p className="stage__sub">Prototype · PILOT states + extend + convert wizard</p>
        </div>
      </div>

      {/* Customer card (placeholder header) */}
      <div className="stage__cust">
        <div className="stage__cust-logo">AR</div>
        <div className="stage__cust-main">
          <div className="stage__cust-name">
            {MOCK_CUSTOMER.name}
            <span className="tds-badge tds-badge--success"><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Active</span>
            <span className="tds-badge tds-badge--pilot"><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Pilot customer</span>
          </div>
          <div className="stage__cust-meta">e-acme · United States · 1 contract shown</div>
        </div>
      </div>

      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">Contracts</div>
          <Btn variant="primary" size="sm" icon="settings">Manage contracts</Btn>
        </div>
        <div>
          <ContractRow
            contract={contract}
            onExtend={() => setExtendOpen(true)}
            onConvert={() => setConvertOpen(true)}
          />
        </div>
      </div>

      {/* Event timeline reveal */}
      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">Contract Activity</div>
        </div>
        <div style={{ padding: '4px 0' }}>
          {(contract.events || []).slice().reverse().map((ev) => {
            // Title + description are derived in UI from eventType + eventInfo.
            // The data model only stores: eventType (enum) + eventInfo (JSONB).
            // i18n-ready: swap this switch for a label catalog when localizing.
            let title = ev.eventType, desc = '';
            if (ev.eventType === 'BIND_PILOT') {
              title = 'Pilot started';
              desc = `Initial expiry ${fmtMonthDay(ev.eventInfo.initialEffectiveTo)}`;
            } else if (ev.eventType === 'PILOT_EXTEND') {
              title = `Pilot extended +${ev.eventInfo.days || 90} days`;
              desc = `${fmtMonthDay(ev.eventInfo.fromEffectiveTo)} → ${fmtMonthDay(ev.eventInfo.toEffectiveTo)}${ev.eventInfo.reason ? ` · ${ev.eventInfo.reason}` : ''}`;
            } else if (ev.eventType === 'PILOT_CONVERT') {
              title = 'Converted to active';
              desc = `Effective from ${fmtMonthDay(ev.eventInfo.newEffectiveFrom)} · billing starts ${fmtMonthDay(ev.eventInfo.derivedBillingStartsAt)}`;
            } else if (ev.eventType === 'BIND_ACTIVE') {
              title = 'Contract activated';
              desc = `Effective from ${fmtMonthDay(ev.eventInfo.effectiveFrom)}`;
            }
            return (
              <div key={ev.id} className="evt-row">
                <div className={`pick-card__icon pick-card__icon--${contract.kind.toLowerCase()}`} style={{ width: 36, height: 36, borderRadius: 8, flex: 'none' }} title={`${contract.kind} · ${contract.id}`}>
                  <Icon name={iconForKind(contract.kind)} size={15}/>
                </div>
                <div className="evt-row__main">
                  <div className="evt-row__title">{title}</div>
                  {desc && <div className="evt-row__desc">{desc}</div>}
                  <div className="evt-row__meta">{fmtDateTime(ev.eventTimestamp)} · {ev.operatorUserId}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tweaks panel */}
      <div className="tweaks">
        <h4>Scenarios</h4>
        <div className="tweaks__group">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key}
              className={`tweaks__btn ${scenarioKey === key ? 'is-on' : ''}`}
              onClick={() => { setScenarioKey(key); setContractOverrides({}); }}
            >
              <div style={{ fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.sub}</div>
            </button>
          ))}
        </div>
        <div className="tweaks__group">
          <span className="tweaks__group-lbl">Actions</span>
          <button className="tweaks__btn" disabled={String(contract.status).toUpperCase() !== 'PILOT'} onClick={() => setExtendOpen(true)}>+ Extend pilot</button>
          <button className="tweaks__btn" disabled={String(contract.status).toUpperCase() !== 'PILOT'} onClick={() => setConvertOpen(true)}>→ Convert to active</button>
          <button className="tweaks__btn" onClick={() => setContractOverrides({})}>↺ Reset scenario</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
          Demo date pinned at 2026-05-26. Switching scenario or invoking an action writes a fresh EntityContractEvent.
        </div>
      </div>

      <ExtendPilotModal open={extendOpen} contract={contract} onClose={() => setExtendOpen(false)} onConfirm={handleExtend}/>
      <ConvertWizard   open={convertOpen} contract={contract} onClose={() => setConvertOpen(false)} onConfirm={handleConvert}/>
    </div>
  );
};

// ── Mount ────────────────────────────────────────────────────
const Root = () => (
  <ToastProvider>
    <App/>
  </ToastProvider>
);

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
