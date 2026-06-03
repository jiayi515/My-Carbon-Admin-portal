/* global React, ReactDOM, Icon, Btn, Input, Field, Select, Modal, ToastProvider, useToast, iconForKind, fmtDate, fmtDateTime */
// ─────────────────────────────────────────────────────────────
// manage-contracts-prototype.jsx — Manage Contracts modal with
// PILOT support. Demonstrates the 4 right-pane variants:
//   1. NEW contract (segmented [Pilot|Active])
//   2. Existing PILOT (action bar with Extend/Convert)
//   3. Existing ACTIVE (action bar with Suspend/Terminate)
//   4. Existing SUSPENDED (read-only + Resume)
// ─────────────────────────────────────────────────────────────

const { useState, useEffect } = React;

const NOW = new Date('2026-05-26T10:00:00');
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const isoStr = (d) => d.toISOString();
const daysUntil = (iso) => Math.ceil((new Date(iso) - NOW) / 86400000);
const fmtMonthDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const nextMonthFirst = (d) => {
  const x = new Date(d);
  return x.getDate() === 1 ? new Date(x.getFullYear(), x.getMonth(), 1) : new Date(x.getFullYear(), x.getMonth() + 1, 1);
};
const pilotEffectiveStatus = (c) => {
  if (!c) return null;
  const s = String(c.status || '').toUpperCase();
  if (s !== 'ACTIVE' && s !== 'PILOT') return s;
  if (c.effectiveTo && new Date(c.effectiveTo) < NOW) return 'EXPIRED';
  return s;
};

// ── Seed: Acme Robotics. Holds a PILOT ISO + an ACTIVE ISV (was pilot).
// MERCHANT + DISTRIBUTOR are toggleable to add. ADMIN is excluded.
const HELD_CONTRACTS = [
  {
    id: 'ec-iso-pilot', kind: 'ISO', status: 'PILOT',
    authorizingEntityName: 'NPT',
    effectiveFrom: isoStr(addDays(NOW, -47)),
    effectiveTo:   isoStr(addDays(NOW, 133)),
    entitlements: {
      settlementCurrency: 'USD',
      deviceBasicService: { price: 0 },
      deviceModels: ['N950', 'POS-Lite'],
      FlyDesk:       { enable: true,  price: 0 },
      GeoLocation:   { enable: false, price: 0 },
      GeoFencing:    { enable: false, price: 0 },
      'Pre-warning': { enable: true,  price: 0 },
    },
    events: [{ eventType: 'BIND_PILOT', at: addDays(NOW, -47), by: 'lin.wei@npt' }],
  },
  {
    id: 'ec-isv-active', kind: 'ISV', status: 'ACTIVE',
    authorizingEntityName: 'NPT',
    effectiveFrom: isoStr(addDays(NOW, -60)),
    effectiveTo: null,
    entitlements: {},                                   // ISV has no fees
    events: [
      { eventType: 'BIND_PILOT', at: addDays(NOW, -240), by: 'lin.wei@npt' },
      { eventType: 'PILOT_CONVERT', at: addDays(NOW, -60), by: 'alex.kim@npt' },
    ],
  },
];
const ADDABLE_KINDS = [
  { kind: 'MERCHANT',    requiresIsoAuthorizer: true,  defaultMode: 'ACTIVE' },
  { kind: 'DISTRIBUTOR', requiresIsoAuthorizer: false, defaultMode: 'ACTIVE' },
];

// ── Schema ────────────────────────────────────────────────────
// EXACT copy of window.CONTRACT_ENTITLEMENT_SCHEMA.ISO from
// customer-detail.jsx (lines 82-90). Keep these two in lockstep — when
// the real schema gains a field, update both. Easiest: when this
// prototype is merged in, delete the local copy and just read from
// window.CONTRACT_ENTITLEMENT_SCHEMA.
const ISO_SCHEMA = [
  { key: 'deviceModels',       label: 'Allowed device models', type: 'models',   required: true, help: 'Device SKUs this ISO can resell. Pick from the catalog — at least one model.' },
  { key: 'settlementCurrency', label: 'Settlement currency',   type: 'currency', required: true, help: 'All prices below are denominated in this currency.' },
  { key: 'deviceBasicService', label: 'Device basic service',  type: 'price',    required: true, unit: 'per device per month', help: 'Base monthly fee charged per active device' },
  { key: 'FlyDesk',            label: 'FlyDesk',               type: 'feature',  unit: 'per device per month', help: 'Remote desktop access. Price required when enabled (0 = free).' },
  { key: 'GeoLocation',        label: 'GeoLocation',           type: 'feature',  unit: 'per device per month', help: 'Real-time device location. Price required when enabled (0 = free).' },
  { key: 'GeoFencing',         label: 'GeoFencing',            type: 'feature',  unit: 'per device per month', help: 'Zone-based alerts. Price required when enabled (0 = free).' },
  { key: 'Pre-warning',        label: 'Pre-warning',           type: 'feature',  unit: 'per device per month', help: 'Battery / storage / health alerts. Price required when enabled (0 = free).' },
];

// Fee-bearing subset — used by ConvertModal which only re-prompts for
// money clauses, not currency/models.
const ISO_FEE_FIELDS = ISO_SCHEMA.filter((f) => f.type === 'price' || f.type === 'feature');

// Minimal DEVICE_MODELS catalog so ModelMultiSelect has rows to show.
// Real app reads this from data.jsx — we provide the fields that
// ModelMultiSelect actually touches (id, name, family).
if (!window.DEVICE_MODELS) {
  window.DEVICE_MODELS = [
    { id: 'N950',     name: 'N950',     family: 'Newland' },
    { id: 'POS-Lite', name: 'POS-Lite', family: 'Carbon'  },
    { id: 'PX5',      name: 'PX5',      family: 'Carbon'  },
    { id: 'Mini',     name: 'Mini',     family: 'Carbon'  },
  ];
}

// Pilot mode → force every fee value to 0 / disabled-look. The shared
// ClauseInput is `disabled`-driven; we feed in a zeroed-out form-shape
// so admin sees 0.00 (not blank) but can't type into it.
const zeroEntitlementsForPilot = (form) => {
  const out = { ...form };
  ISO_SCHEMA.forEach((f) => {
    if (f.type === 'price')   out[f.key] = { price: '0' };
    if (f.type === 'feature') out[f.key] = { enable: !!form[f.key]?.enable, price: '0' };
  });
  return out;
};

// ── Tiny PILOT chip (status + countdown rolled in) ───────────
const PilotChip = ({ contract }) => {
  const eff = pilotEffectiveStatus(contract);
  if (eff === 'PILOT') {
    const d = daysUntil(contract.effectiveTo);
    const tone = d <= 30 ? 'warning' : 'active';
    return (
      <span className={`tds-badge tds-badge--pilot`}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>
        Pilot · {d}d left
      </span>
    );
  }
  if (eff === 'ACTIVE') return <span className="tds-badge tds-badge--success"><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Active</span>;
  if (eff === 'SUSPENDED') return <span className="tds-badge tds-badge--error"><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Suspended</span>;
  if (eff === 'EXPIRED') return <span className="tds-badge tds-badge--pilot-expired"><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Expired</span>;
  return <span className="tds-badge tds-badge--neutral">{eff}</span>;
};

// ── Extend pilot modal (nested) ───────────────────────────────
const ExtendModal = ({ open, contract, onClose, onConfirm }) => {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) { setDays(30); setReason(''); } }, [open]);
  if (!contract) return null;
  const newTo = addDays(NOW, days);
  return (
    <Modal open={open} onClose={onClose} title={`Extend pilot +${days} days`} width={500}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={() => onConfirm({ days, reason })}>Confirm</Btn>
      </>}>
      <div className="stack">
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Extends pilot expiry to <b style={{ color: 'var(--color-text-primary)' }}>today + {days} days</b>. Writes a <code>PILOT_EXTEND</code> event.
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Duration</div>
          <div className="seg">
            {[30, 60, 90].map((n) => (
              <button key={n} type="button" className={`seg__btn ${days === n ? 'is-on' : ''}`} onClick={() => setDays(n)}>+{n}d</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 12, padding: 12, background: 'var(--color-bg-3)', borderRadius: 8, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Current</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{fmtMonthDay(contract.effectiveTo)}</div>
          </div>
          <Icon name="arrowR" size={14}/>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.08 }}>After</div>
            <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--color-success-700)' }}>{fmtMonthDay(newTo)}</div>
          </div>
        </div>
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer wants more time"/>
        </Field>
      </div>
    </Modal>
  );
};

// ── Convert modal ───────────────────────────────────────────────
// Two-step: ack → re-enter fees. The fees step uses window.ClauseInput
// for every fee row so the visuals exactly match customer-detail.jsx.
// All prices are blanked on open — admin must type every value (even
// 0). Currency + models carry over from the pilot.
const ConvertModal = ({ open, contract, onClose, onConfirm }) => {
  const [step, setStep] = useState(0);
  const [ack, setAck] = useState(false);
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState({});  // {key: true} once user touches a row

  useEffect(() => {
    if (!open || !contract) return;
    setStep(0); setAck(false); setTouched({});
    // Read existing entitlements into form-shape, then BLANK every fee
    // value so admin must explicitly retype (per the design spec).
    const f = window.entitlementsToForm
      ? window.entitlementsToForm(contract.entitlements || {}, ISO_SCHEMA)
      : {};
    ISO_FEE_FIELDS.forEach((fld) => {
      if (fld.type === 'price') f[fld.key] = { price: '' };
      else if (fld.type === 'feature') f[fld.key] = { enable: !!f[fld.key]?.enable, price: '' };
    });
    setForm(f);
  }, [open, contract]);
  if (!contract) return null;

  const cur = form.settlementCurrency || 'USD';
  const setField = (key, v) => {
    setForm((s) => ({ ...s, [key]: v }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  // Validation: every enabled fee must be touched AND non-empty AND >= 0.
  // window.clauseError handles the actual rule; we add a "touched" gate
  // so untouched-but-blank rows still block confirm.
  const errs = {};
  ISO_FEE_FIELDS.forEach((f) => {
    const v = form[f.key];
    const enabled = f.type === 'price' ? true : !!v?.enable;
    if (!enabled) return;
    if (!touched[f.key]) { errs[f.key] = 'Confirm this fee'; return; }
    const e = window.clauseError ? window.clauseError(f, v) : null;
    if (e) errs[f.key] = e;
  });
  const valid = Object.keys(errs).length === 0;

  return (
    <Modal open={open} onClose={onClose} title="Convert pilot to active" width={680}
      footer={step === 0 ? (
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!ack} onClick={() => setStep(1)}>Next · Re-enter fees</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={() => setStep(0)}>Back</Btn>
          <Btn variant="primary" icon="check" disabled={!valid} onClick={() => onConfirm({ form })}>Confirm conversion</Btn>
        </>
      )}>
      {step === 0 && (
        <div className="stack">
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--color-warning-50)', border: '1px solid oklch(75% 0.13 80 / 0.3)', borderRadius: 10, color: 'var(--color-warning-700)' }}>
            <Icon name="alert" size={18}/>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>This is irreversible</div>
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.5, color: 'oklch(36% 0.07 70)' }}>
                <li><b>Every fee must be re-entered</b> — pilot prices were $0, type each one explicitly.</li>
                <li><b>You cannot return to PILOT</b> after conversion.</li>
              </ul>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13.5, background: ack ? 'var(--color-primary-50)' : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary-700)', flex: 'none' }}/>
            <span style={{ lineHeight: 1.5 }}>I understand: this starts billing for the customer.</span>
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            Enabled clauses appear below. <b>All amounts cleared</b> — re-enter each one (including 0).
          </div>
          {ISO_FEE_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
              error={errs[f.key]}
            >
              <window.ClauseInput
                clause={f}
                value={form[f.key]}
                onChange={(v) => setField(f.key, v)}
                error={errs[f.key]}
                currency={cur}
              />
            </Field>
          ))}
        </div>
      )}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// RIGHT PANE — 4 variants based on what's focused
// ─────────────────────────────────────────────────────────────

// 2.1 NEW contract pane (admin toggled an addable kind on)
const NewContractPane = ({ kind, mode, onChangeMode, draft, onChangeDraft }) => {
  const isPilot = mode === 'PILOT';
  const isIso = kind === 'ISO';
  const isMerchant = kind === 'MERCHANT';

  // PILOT mode forces dates + zero fees. Re-derive when admin switches mode.
  const today = new Date(NOW).toISOString().slice(0, 10);
  const pilotEnd = addDays(NOW, 180).toISOString().slice(0, 10);

  return (
    <>
      <div className="mc-pane__head">
        <div className={`pick-card__icon pick-card__icon--${kind.toLowerCase()}`}>
          <Icon name={iconForKind(kind)} size={18}/>
        </div>
        <div className="mc-pane__head-main">
          <div className="mc-pane__head-title">
            {kind} · New contract
            <span className="tds-badge tds-badge--neutral" style={{ fontSize: 10.5 }}>To be created</span>
          </div>
          <div className="mc-pane__head-sub">authorized by {isMerchant ? 'Summit Payments (ISO)' : 'NPT'}</div>
        </div>
        <div className="seg">
          <button className={`seg__btn seg__btn--pilot ${isPilot ? 'is-on' : ''}`} onClick={() => onChangeMode('PILOT')}>
            <Icon name="sparkles" size={11}/> Pilot
          </button>
          <button className={`seg__btn ${!isPilot ? 'is-on' : ''}`} onClick={() => onChangeMode('ACTIVE')}>
            <Icon name="check" size={11}/> Active
          </button>
        </div>
      </div>

      {isPilot && (
        <div className="mc-pilot-strip">
          <Icon name="info" size={14}/>
          6-month trial · all fees locked at $0 · {isIso ? 'ISO defaults to Pilot for new contracts.' : `${kind} normally defaults to Active — you've switched to Pilot.`}
        </div>
      )}

      <div className="mc-form">
        <Field label="Effective window">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input type="date" value={isPilot ? today : (draft.effFrom || today)} disabled={isPilot} onChange={(e) => onChangeDraft({ effFrom: e.target.value })} style={{ maxWidth: 170 }}/>
            <Icon name="arrowR" size={12}/>
            <Input type="date" value={isPilot ? pilotEnd : (draft.effTo || '')} disabled={isPilot} placeholder="(no end date)" onChange={(e) => onChangeDraft({ effTo: e.target.value })} style={{ maxWidth: 170 }}/>
          </div>
        </Field>

        {isIso && (() => {
          // Single render path — the same ClauseInput renders every
          // clause type (currency/models/price/feature). PILOT mode just
          // disables every fee field and zeroes the displayed value.
          const form = draft.form || {};
          const cur = form.settlementCurrency || 'USD';
          const view = isPilot ? zeroEntitlementsForPilot(form) : form;

          // Currency is never locked, even in pilot.
          const isClauseDisabled = (f) => {
            if (f.type === 'currency') return false;
            if (f.type === 'models')   return false; // models are admin-pickable in either mode
            return isPilot;
          };
          return (
            <>
              <div className="mc-form__sectionlbl">Clauses</div>
              {ISO_SCHEMA.map((f) => (
                <Field
                  key={f.key}
                  label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
                >
                  <window.ClauseInput
                    clause={f}
                    value={view[f.key]}
                    onChange={(v) => onChangeDraft({ form: { ...form, [f.key]: v } })}
                    disabled={isClauseDisabled(f)}
                    currency={cur}
                  />
                </Field>
              ))}
            </>
          );
        })()}
        {!isIso && (
          <div style={{ padding: '14px 16px', background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            {kind} contracts have no configurable clauses.
          </div>
        )}
      </div>
    </>
  );
};

// 2.2 Existing PILOT pane
const PilotPane = ({ contract, onExtend, onConvert }) => {
  const d = daysUntil(contract.effectiveTo);
  return (
    <>
      <div className="mc-pane__head">
        <div className={`pick-card__icon pick-card__icon--${contract.kind.toLowerCase()}`}>
          <Icon name={iconForKind(contract.kind)} size={18}/>
        </div>
        <div className="mc-pane__head-main">
          <div className="mc-pane__head-title">{contract.kind} <PilotChip contract={contract}/></div>
          <div className="mc-pane__head-sub">Authorized by {contract.authorizingEntityName}</div>
        </div>
        <div className="mc-pane__head-actions">
          <Btn variant="ghost" size="sm" icon="refresh" onClick={onExtend}>Extend</Btn>
          <Btn variant="primary" size="sm" onClick={onConvert}>Convert to active</Btn>
        </div>
      </div>

      <div className="mc-pilot-strip">
        <Icon name="sparkles" size={14}/>
        Pilot started {fmtMonthDay(contract.effectiveFrom)} · ends {fmtMonthDay(contract.effectiveTo)}
      </div>

      <div className="mc-form">
        <Field label="Effective window">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input type="date" value={contract.effectiveFrom.slice(0, 10)} disabled style={{ maxWidth: 170 }}/>
            <Icon name="arrowR" size={12}/>
            <Input type="date" value={contract.effectiveTo.slice(0, 10)} disabled style={{ maxWidth: 170 }}/>
          </div>
        </Field>

        {contract.kind === 'ISO' && (() => {
          // Read the saved entitlements into ClauseInput form-shape, then
          // zero out the fees so PILOT always renders $0.00 regardless
          // of what was on the row before. (PILOT contracts SHOULD all
          // be 0 already — this is just defensive.)
          const form = window.entitlementsToForm
            ? window.entitlementsToForm(contract.entitlements || {}, ISO_SCHEMA)
            : {};
          const view = zeroEntitlementsForPilot(form);
          const cur = view.settlementCurrency || 'USD';
          return (
            <>
              <div className="mc-form__sectionlbl">Clauses</div>
              {ISO_SCHEMA.map((f) => (
                <Field
                  key={f.key}
                  label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
                >
                  <window.ClauseInput
                    clause={f}
                    value={view[f.key]}
                    onChange={() => {}}
                    disabled={f.type !== 'currency' && f.type !== 'models'}
                    currency={cur}
                  />
                </Field>
              ))}
            </>
          );
        })()}
      </div>
    </>
  );
};

// 2.3 Existing ACTIVE pane
const ActivePane = ({ contract, onSuspend, onTerminate }) => {
  return (
    <>
      <div className="mc-pane__head">
        <div className={`pick-card__icon pick-card__icon--${contract.kind.toLowerCase()}`}>
          <Icon name={iconForKind(contract.kind)} size={18}/>
        </div>
        <div className="mc-pane__head-main">
          <div className="mc-pane__head-title">{contract.kind} <PilotChip contract={contract}/></div>
          <div className="mc-pane__head-sub">Authorized by {contract.authorizingEntityName}</div>
        </div>
        <div className="mc-pane__head-actions">
          <Btn variant="ghost" size="sm" icon="minus" onClick={onSuspend}>Suspend</Btn>
          <Btn variant="danger" size="sm" icon="trash" onClick={onTerminate}>Terminate</Btn>
        </div>
      </div>

      {/* Pilot history intentionally not surfaced here — it lives in the
          contract Activity feed (EntityContractEvent rows). Avoid restating
          "converted from pilot" on every active card. */}

      <div className="mc-form">
        <Field label="Effective window">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input type="date" defaultValue={contract.effectiveFrom.slice(0, 10)} style={{ maxWidth: 170 }}/>
            <Icon name="arrowR" size={12}/>
            <Input type="date" placeholder="(no end date)" style={{ maxWidth: 170 }}/>
          </div>
        </Field>
        {contract.kind === 'ISV' && (
          <div style={{ padding: '14px 16px', background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            ISV contracts have no configurable clauses.
          </div>
        )}
      </div>
    </>
  );
};

// ── Terminate confirmation modal ─────────────────────────────
// Per spec §3.1.3 / public constraints §2.2, terminate is irreversible
// and requires a reason that gets written to the contract record + audit
// event. Force admin to type ≥6 chars + tick an acknowledgement.
const TerminateModal = ({ open, contract, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  useEffect(() => { if (open) { setReason(''); setAck(false); } }, [open]);
  if (!contract) return null;
  const canConfirm = reason.trim().length >= 6 && ack;
  return (
    <Modal open={open} onClose={onClose} title={`Terminate ${contract.kind} contract`} width={520}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="trash" disabled={!canConfirm} onClick={() => onConfirm({ reason: reason.trim() })}>Terminate contract</Btn>
      </>}>
      <div className="stack">
        <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--color-error-50)', border: '1px solid oklch(58% 0.20 25 / 0.3)', borderRadius: 10, color: 'var(--color-error-700)' }}>
          <Icon name="alert" size={18}/>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Terminating is irreversible</div>
            <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.5, color: 'oklch(38% 0.13 25)' }}>
              <li>Contract is soft-deleted (status → TERMINATED). Stays on file for audit, cannot be revived.</li>
              <li>Operators authorized through this contract lose access immediately.</li>
              <li>To re-engage, create a new {contract.kind} contract (defaults to {contract.kind === 'ISO' ? 'PILOT' : 'ACTIVE'}).</li>
            </ul>
          </div>
        </div>

        <Field label="Reason" required hint="Recorded on the TERMINATE event · minimum 6 characters.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer churned to competitor"/>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--color-border-default)', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: ack ? 'var(--color-error-50)' : 'transparent' }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-error-500)', flex: 'none' }}/>
          <span style={{ lineHeight: 1.5 }}>
            I understand this permanently terminates the {contract.kind} contract with <b>{contract.authorizingEntityName}</b>.
          </span>
        </label>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────────
const ManageContractsModal = ({ open, customer, contracts, onClose }) => {
  const [focused, setFocused] = useState(contracts[0]?.id || null);
  const [picked, setPicked] = useState({});         // {kind: {mode, draft}} for newly toggled-on
  const [extendTarget, setExtendTarget] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [localContracts, setLocalContracts] = useState(contracts);
  const toast = useToast();

  const heldKinds = new Set(localContracts.map((c) => c.kind));
  const addable = ADDABLE_KINDS.filter((a) => !heldKinds.has(a.kind));

  const focusedItem =
    localContracts.find((c) => c.id === focused) ||
    (picked[focused] ? { isNew: true, kind: focused, ...picked[focused] } : null);
  // Addable kind that's focused but not yet enabled (toggle off).
  // Renders a "Not enabled — click Enable" placeholder in the right pane.
  const focusedAddableMeta = !focusedItem && focused
    ? addable.find((a) => a.kind === focused)
    : null;

  const togglePick = (kind, addableMeta) => {
    setPicked((p) => {
      const np = { ...p };
      if (np[kind]) {
        delete np[kind];
      } else {
        // Seed an empty ClauseInput-shaped form so the right pane has
        // something coherent to render before admin touches anything.
        // entitlementsToForm tolerates empty input — returns {} with all
        // fee shapes pre-blanked.
        const form = window.entitlementsToForm
          ? window.entitlementsToForm({}, kind === 'ISO' ? ISO_SCHEMA : [])
          : {};
        np[kind] = { mode: addableMeta.defaultMode, draft: { form } };
      }
      return np;
    });
  };
  const setMode = (kind, mode) => setPicked((p) => ({ ...p, [kind]: { ...p[kind], mode } }));
  const setDraft = (kind, patch) => setPicked((p) => ({ ...p, [kind]: { ...p[kind], draft: { ...p[kind].draft, ...patch } } }));

  const handleExtended = ({ days, reason }) => {
    setLocalContracts((cs) => cs.map((c) => c.id === extendTarget.id
      ? { ...c, effectiveTo: isoStr(addDays(NOW, days)), events: [...c.events, { eventType: 'PILOT_EXTEND', at: NOW, by: 'demo.admin@npt', days, reason }] }
      : c));
    setExtendTarget(null);
    toast({ kind: 'success', title: `Pilot extended +${days}d`, msg: 'PILOT_EXTEND event written.' });
  };
  const handleConverted = () => {
    setLocalContracts((cs) => cs.map((c) => c.id === convertTarget.id
      ? { ...c, status: 'ACTIVE', effectiveFrom: isoStr(NOW), effectiveTo: null, events: [...c.events, { eventType: 'PILOT_CONVERT', at: NOW, by: 'demo.admin@npt' }] }
      : c));
    setConvertTarget(null);
    toast({ kind: 'success', title: 'Converted to active', msg: 'PILOT_CONVERT event written. Billing scheduled.' });
  };
  const handleTerminated = ({ reason }) => {
    setLocalContracts((cs) => cs.map((c) => c.id === terminateTarget.id
      ? { ...c, status: 'TERMINATED', terminatedAt: isoStr(NOW), terminatedReason: reason, events: [...c.events, { eventType: 'TERMINATE', at: NOW, by: 'demo.admin@npt', reason }] }
      : c));
    if (focused === terminateTarget.id) setFocused(null);
    setTerminateTarget(null);
    toast({ kind: 'success', title: 'Contract terminated', msg: 'TERMINATE event written. Operators access revoked.' });
  };

  const dirtyNew = Object.keys(picked).length;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage contracts"
        width={920}
        footer={<>
          <div className="mc-foot-summary">
            {dirtyNew > 0 && <><strong>{dirtyNew}</strong> new contract{dirtyNew === 1 ? '' : 's'} to create on save</>}
            {dirtyNew === 0 && <span>No pending changes</span>}
          </div>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="check" disabled={dirtyNew === 0} onClick={onClose}>Save changes</Btn>
        </>}
      >
        <div className="mc-modal">
          <div className="mc-grid">
            {/* Rail */}
            <div className="mc-rail">
              <div className="mc-rail__group">In effect ({localContracts.length})</div>
              {localContracts.map((c) => (
                <div key={c.id}
                  className={`mc-rail__row ${focused === c.id ? 'is-focused' : ''}`}
                  onClick={() => setFocused(c.id)}>
                  <div className={`pick-card__icon pick-card__icon--${c.kind.toLowerCase()}`}>
                    <Icon name={iconForKind(c.kind)} size={14}/>
                  </div>
                  <div className="mc-rail__row-main">
                    <div className="mc-rail__row-title">{c.kind}</div>
                    <div className="mc-rail__row-sub">
                      <PilotChip contract={c}/>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mc-rail__group" style={{ marginTop: 8 }}>Available to add</div>
              {addable.map((a) => {
                const isDisabled = false; // could check authorizer constraints here
                const isPicked = !!picked[a.kind];
                return (
                  <div key={a.kind}
                    className={`mc-rail__row ${focused === a.kind ? 'is-focused' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                    onClick={() => !isDisabled && setFocused(a.kind)}>
                    <div className={`pick-card__icon pick-card__icon--${a.kind.toLowerCase()}`}>
                      <Icon name={iconForKind(a.kind)} size={14}/>
                    </div>
                    <div className="mc-rail__row-main">
                      <div className="mc-rail__row-title">{a.kind}</div>
                      <div className="mc-rail__row-sub">
                        {isPicked
                          ? <span style={{ color: 'var(--color-primary-700)', fontWeight: 500 }}>Will create as {picked[a.kind].mode}</span>
                          : <span>Default: {a.defaultMode}</span>}
                      </div>
                    </div>
                    {/* Toggle box is the ONLY thing that flips picked state.
                        Row click just focuses — admins can preview the
                        pane (and disabled state) before committing. */}
                    <div
                      className={`mc-rail__toggle ${isPicked ? 'is-on' : ''}`}
                      role="checkbox" aria-checked={isPicked}
                      title={isPicked ? 'Click to disable (remove this new contract)' : 'Click to enable for creation'}
                      onClick={(e) => { e.stopPropagation(); togglePick(a.kind, a); }}>
                      {isPicked && <Icon name="check" size={10}/>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right pane */}
            <div className="mc-pane">
              {!focusedItem && !focusedAddableMeta && <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Pick a contract on the left.</div>}
              {focusedAddableMeta && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, gap: 14, padding: '40px 20px', color: 'var(--color-text-tertiary)' }}>
                  <div className={`pick-card__icon pick-card__icon--${focusedAddableMeta.kind.toLowerCase()}`} style={{ width: 56, height: 56, borderRadius: 14, opacity: 0.6 }}>
                    <Icon name={iconForKind(focusedAddableMeta.kind)} size={26}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>{focusedAddableMeta.kind} not enabled</div>
                    <div style={{ fontSize: 12.5, marginTop: 4, maxWidth: 320 }}>
                      Adding this contract will default to <b style={{ color: 'var(--color-text-secondary)' }}>{focusedAddableMeta.defaultMode}</b>. You can switch to {focusedAddableMeta.defaultMode === 'PILOT' ? 'Active' : 'Pilot'} after enabling.
                    </div>
                  </div>
                  <Btn variant="primary" icon="plus" onClick={() => togglePick(focusedAddableMeta.kind, focusedAddableMeta)}>
                    Enable {focusedAddableMeta.kind}
                  </Btn>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-tertiary)', marginTop: -4 }}>
                    Or click the checkbox ▢ on the left row
                  </div>
                </div>
              )}
              {focusedItem?.isNew && (
                <NewContractPane
                  kind={focusedItem.kind}
                  mode={focusedItem.mode}
                  onChangeMode={(m) => setMode(focusedItem.kind, m)}
                  draft={focusedItem.draft}
                  onChangeDraft={(p) => setDraft(focusedItem.kind, p)}
                />
              )}
              {focusedItem && !focusedItem.isNew && pilotEffectiveStatus(focusedItem) === 'PILOT' && (
                <PilotPane
                  contract={focusedItem}
                  onExtend={() => setExtendTarget(focusedItem)}
                  onConvert={() => setConvertTarget(focusedItem)}
                />
              )}
              {focusedItem && !focusedItem.isNew && pilotEffectiveStatus(focusedItem) === 'ACTIVE' && (
                <ActivePane
                  contract={focusedItem}
                  onSuspend={() => toast({ kind: 'info', title: 'Suspend (not wired in this prototype)' })}
                  onTerminate={() => setTerminateTarget(focusedItem)}
                />
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ExtendModal open={!!extendTarget} contract={extendTarget} onClose={() => setExtendTarget(null)} onConfirm={handleExtended}/>
      <ConvertModal open={!!convertTarget} contract={convertTarget} onClose={() => setConvertTarget(null)} onConfirm={handleConverted}/>
      <TerminateModal open={!!terminateTarget} contract={terminateTarget} onClose={() => setTerminateTarget(null)} onConfirm={handleTerminated}/>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
const App = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="stage">
      <p className="stage__crumb">Carbon · Admin / Customer / Acme Robotics</p>
      <div className="stage__hdr">
        <div>
          <h1 className="stage__title">Manage Contracts — PILOT-aware</h1>
          <p className="stage__sub">Prototype · 4 right-pane variants based on focused contract</p>
        </div>
      </div>

      <div className="stage__cust">
        <div className="stage__cust-logo">AR</div>
        <div className="stage__cust-main">
          <div className="stage__cust-name">Acme Robotics Inc. <span className="tds-badge tds-badge--success"><span style={{width:5,height:5,borderRadius:'50%',background:'currentColor'}}/>Active</span></div>
          <div className="stage__cust-meta">e-acme · United States · 2 contracts in effect</div>
        </div>
        <Btn variant="primary" icon="settings" onClick={() => setOpen(true)}>Manage contracts</Btn>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 12, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--color-text-primary)' }}>Click each rail row to see the 4 right-pane variants:</b>
        <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
          <li><b>ISO (Pilot)</b> — action bar with Extend / Convert; dates locked; prices locked at $0.</li>
          <li><b>ISV (Active)</b> — action bar with Suspend / Terminate; "Converted from pilot" trace shown.</li>
          <li><b>MERCHANT (Available to add)</b> — toggle on → segmented [Pilot │ Active] with Active default.</li>
          <li><b>DISTRIBUTOR (Available to add)</b> — toggle on → segmented [Pilot │ Active] with Active default.</li>
        </ol>
      </div>

      <ManageContractsModal open={open} customer={{ id: 'e-acme', name: 'Acme Robotics Inc.' }} contracts={HELD_CONTRACTS} onClose={() => setOpen(false)}/>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider><App/></ToastProvider>
);
