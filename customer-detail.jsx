/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, ContractBadge, Modal, CompanyLogo, CONTRACT_INFO, COUNTRIES, COUNTRY_BY_CODE, useToast, maskEmail, maskPhone, maskName, fmtDate, fmtDateTime, relTime, SEED_ROLES, ALL_CONTRACT_KINDS, CUSTOMER_CONTRACT_KINDS, PERMISSION_GROUPS, permAppliesToContract, permissionGroupsForContract, ALL_PERMISSION_IDS, ORDER_STATUSES, ORDER_STATUS_TONE, orderTotal, orderQty, deviceProgress, moneyUSD */
const { useState, useMemo } = React;

// Helpers for the contract-status-aware UI changes. The underlying
// ENTITY_CONTRACT.status enum is UPPERCASE (ACTIVE/PENDING/SUSPENDED/
// TERMINATED) but some legacy call sites emit Pascal-case ('Active') —
// _CS normalizes for comparison.
const _CS = (s) => String(s || '').toUpperCase();

// Returns counts grouped by lifecycle bucket for the Overview stat.
// Uses effectiveStatus() so an ACTIVE contract whose effectiveTo has
// passed is correctly counted as `expired` (not `active`). All four
// buckets are always present so consumers don't get NaN when adding.
const _contractBuckets = (contracts) => {
  const out = { active: 0, suspended: 0, expired: 0, terminated: 0 };
  contracts.forEach((c) => {
    const s = String((window.effectiveStatus && window.effectiveStatus(c)) || c.status || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'SIGNED') out.active++;
    else if (s === 'SUSPENDED') out.suspended++;
    else if (s === 'EXPIRED') out.expired++;
    else if (s === 'TERMINATED') out.terminated++;
    else out.active++;
  });
  return out;
};

// Status-aware subtitle lines for a contract row. Returns an array of
// React fragments rendered as separate <div> lines — keeps each piece of
// info on its own line for scannability.
//   Line 1 (always)  : Authorized by … · Configured by …
//   Line 2 (per state):
//     ACTIVE     → Effective {from} → {to|No end date}
//     PENDING    → Activates when customer's Admin operator signs in
//     SUSPENDED  → Suspended · access blocked, contract on file
//     TERMINATED → Terminated {date} by {who}
const _contractRowSubtitle = (c, customer) => {
  const s = window.effectiveStatus(c);
  const effFrom = c.effectiveFrom || c.signedAt || customer.registeredAt;
  const effTo   = c.effectiveTo;
  const issuer  = c.authorizingEntityName || (c.authorizingEntityId === 'e-npt' ? 'NPT' : c.authorizingEntityId) || 'NPT';
  const who     = maskEmail(c.signedBy || 'admin@carbon');

  const line1 = <>Authorized by <strong>{issuer}</strong> · Configured by {who}</>;

  let line2;
  if (s === 'SUSPENDED') {
    line2 = <span style={{ color: 'var(--color-error-700)' }}>Suspended — access blocked, contract still on file</span>;
  } else if (s === 'TERMINATED') {
    const tAt  = c.terminatedAt || c.effectiveTo;
    const tBy  = c.terminatedByEntityId === 'e-npt' ? 'NPT admin' : (c.terminatedByEntityId || 'admin@carbon');
    line2 = <>Terminated {tAt ? fmtDate(tAt) : '—'} by {maskEmail(tBy)} · originally effective {fmtDate(effFrom)}</>;
  } else if (s === 'EXPIRED') {
    const days = effTo ? Math.floor((new Date() - new Date(effTo)) / 86400000) : null;
    line2 = <span style={{ color: 'var(--color-warning-700)' }}>Expired{days != null ? ` ${days} day${days === 1 ? '' : 's'} ago` : ''} — effective-to {effTo ? fmtDate(effTo) : '—'} has passed. Extend the term or terminate.</span>;
  } else {
    // ACTIVE / SIGNED — in force
    line2 = <>Effective {fmtDate(effFrom)} → {effTo ? fmtDate(effTo) : <strong style={{ color: 'var(--color-text-secondary)' }}>No end date</strong>}</>;
  }

  return (
    <>
      <div>{line1}</div>
      <div style={{ marginTop: 2 }}>{line2}</div>
    </>
  );
};

// Per-kind entitlements schema. Per the corrected domain model only ISO
// contracts carry entitlements; ISV / MERCHANT / DISTRIBUTOR / ADMIN are
// `{}`. Each clause is one of:
//   'models'   — string[] of device-model ids (multi-select)
//   'currency' — single currency code (USD/EUR/CNY/…); contract-level
//   'price'    — { price: number } — denominated in settlementCurrency
//   'feature'  — { enable: boolean, price: number | null } — price uses
//                 settlementCurrency; if enable=true, price required
//                 (0 = free)
//
// Field order is intentional: device coverage first, then the contract
// currency that drives all subsequent prices, then the base device fee,
// then the value-added features.
const CONTRACT_ENTITLEMENT_SCHEMA = {
  ISO: [
    { key: 'deviceModels',       label: 'Allowed device models', type: 'models',   required: true, help: 'Device SKUs this ISO can resell. Pick from the catalog — at least one model.' },
    { key: 'settlementCurrency', label: 'Settlement currency',   type: 'currency', required: true, help: 'All prices below are denominated in this currency.' },
    { key: 'deviceBasicService', label: 'Device basic service',  type: 'price',    required: true, unit: 'per device per month', help: 'Base monthly fee charged per active device' },
    { key: 'FlyDesk',            label: 'FlyDesk',               type: 'feature',  unit: 'per device per month', help: 'Remote desktop access. Price required when enabled (0 = free).' },
    { key: 'GeoLocation',        label: 'GeoLocation',           type: 'feature',  unit: 'per device per month', help: 'Real-time device location. Price required when enabled (0 = free).' },
    { key: 'GeoFencing',         label: 'GeoFencing',            type: 'feature',  unit: 'per device per month', help: 'Zone-based alerts. Price required when enabled (0 = free).' },
    { key: 'Pre-warning',        label: 'Pre-warning',           type: 'feature',  unit: 'per device per month', help: 'Battery / storage / health alerts. Price required when enabled (0 = free).' },
  ],
  // All other contract types intentionally have no entitlements in the
  // current model. The detail view shows an empty state with no edit CTA.
  ISV:         [],
  MERCHANT:    [],
  DISTRIBUTOR: [],
  ADMIN:       [],
};
// Expose so the customer wizard (and other call sites) can render the
// same clause form without duplicating the schema. Lookup callers must
// normalize the kind to upper-case (e.g. 'Distributor' → 'DISTRIBUTOR').
window.CONTRACT_ENTITLEMENT_SCHEMA = CONTRACT_ENTITLEMENT_SCHEMA;

// Returns expiry state for an ACTIVE / PILOT contract — drives the warning chip
// on rows and the banner in the detail modal.
//   { kind: 'expiring',       days: 12 } → ACTIVE within 30 days of effectiveTo
//   { kind: 'expired',        days:  3 } → past effectiveTo but raw status ACTIVE
//   { kind: 'pilot-active',   days: 47 } → PILOT in progress, any days left
//   { kind: 'pilot-expiring', days:  7 } → PILOT ≤30 days from expiry (amber tone)
//   { kind: 'pilot-expired',  days:  2 } → PILOT past effectiveTo
//   null                                 → no concern (ACTIVE >30d out, etc.)
const _expiryState = (c) => {
  if (!c.effectiveTo) return null;
  const eff = window.effectiveStatus(c);
  const rawIsPilot = String(c.status || '').toUpperCase() === 'PILOT';
  const daysLeft = Math.ceil((new Date(c.effectiveTo) - new Date()) / 86400000);
  if (rawIsPilot) {
    // PILOT contracts always surface their countdown — admins need
    // continuous visibility into how much trial time is left.
    if (eff === 'EXPIRED') return { kind: 'pilot-expired',  days: Math.abs(daysLeft) };
    if (daysLeft <= 30)    return { kind: 'pilot-expiring', days: daysLeft };
    return { kind: 'pilot-active', days: daysLeft };
  }
  // ACTIVE/SIGNED: only the pre-expiry warning lives here (EXPIRED
  // upstream is handled by StatusChip's amber+dashed treatment).
  if (eff !== 'ACTIVE' && eff !== 'SIGNED') return null;
  if (daysLeft <= 30) return { kind: 'expiring', days: daysLeft };
  return null;
};
// ContractBadge shows the kind in text; on the detail page the icon +
// row title already carry the kind, so the chip just shows the status
// word with the matching tone.
// Constants for the contract state machine:
//   ACTIVE      — in force, entitlements granted
//   PILOT       — trial period, all fees forced to $0, +180d auto end
//   SUSPENDED   — access blocked, contract on file (reversible)
//   TERMINATED  — ended, historical (soft delete)
//   EXPIRED     — derived state: ACTIVE/PILOT past effectiveTo
// (PENDING was a vestige of an older client-side-signing flow and is
//  no longer used. Any leftover PENDING in legacy data is rendered as
//  Active so the UI never shows a dangling raw enum.)
const _STATUS_TONES = {
  ACTIVE: 'success', SIGNED: 'success', PENDING: 'success',
  PILOT: 'pilot',
  EXPIRED: 'warning',
  SUSPENDED: 'error',
  TERMINATED: 'neutral',
};
const _STATUS_WORDS = {
  ACTIVE: 'Active', SIGNED: 'Active', PENDING: 'Active',
  PILOT: 'Pilot',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
};
const StatusChip = ({ status, effectiveTo }) => {
  // Use effectiveStatus so an ACTIVE contract past its effectiveTo
  // renders as Expired (amber + dashed) rather than Active (solid green).
  // PILOT contracts get the same EXPIRED derivation.
  const s = window.effectiveStatus({ status, effectiveTo });
  const tone = _STATUS_TONES[s] || 'neutral';
  const word = _STATUS_WORDS[s] || status;
  const isExpired = s === 'EXPIRED';
  const isTerminated = s === 'TERMINATED';
  // PILOT can have a days-left tail when there's an effectiveTo and the
  // chip is rendered in a context that doesn't have its own countdown.
  // We keep this chip terse — "Pilot" — and let the contract row /
  // detail-modal banner carry the day count.
  return (
    <span className={`tds-badge tds-badge--${tone} ${isTerminated ? 'tds-badge--ghost' : ''} ${isExpired ? 'tds-badge--lapsed' : ''}`}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>
      {word}
    </span>
  );
};

// ─── Shared company-info bits (used by Overview / Info / Edit modal) ──
const formatPhone = (c) => {
  if (!c?.phone) return null;
  return [c.phoneCountryCode, c.phone].filter(Boolean).join(' ');
};
const countryName = (code) => code && COUNTRY_BY_CODE?.[code]?.name || code || '';

const CompanyInfoView = ({ customer, maskOn, revealed, onToggleReveal }) => {
  const phone = formatPhone(customer);
  const displayPhone = !phone ? null : maskOn && !revealed?.phone ? maskPhone(phone) : phone;
  const displayEmail = !customer.email ? null : maskOn && !revealed?.email ? maskEmail(customer.email) : customer.email;
  const notProvided = <span className="muted">Not provided</span>;
  return (
    <dl className="kvgrid">
      <dt>Name</dt>          <dd>{customer.name}</dd>
      <dt>License</dt>       <dd>{customer.license || notProvided}</dd>
      <dt>Country</dt>       <dd>{customer.country ? countryName(customer.country) : notProvided}</dd>
      <dt>Timezone</dt>      <dd>{customer.timezone ? <code style={{ fontSize: 12.5, fontFamily: 'var(--font-family-mono)' }}>{customer.timezone}</code> : notProvided}</dd>
      <dt>Address</dt>       <dd style={{ whiteSpace: 'pre-line' }}>{customer.address || notProvided}</dd>
      <dt>Contact name</dt>  <dd>{customer.contactName || notProvided}</dd>
      <dt>Phone</dt>         <dd>
        {phone ?
        <>
            <span className="op-mask">{displayPhone}</span>
            {maskOn && onToggleReveal && <button className="reveal-btn" onClick={() => onToggleReveal('phone')}>{revealed?.phone ? 'Hide' : 'Reveal'}</button>}
          </> :
        notProvided}
      </dd>
      <dt>Email</dt>         <dd>
        {customer.email ?
        <>
            <span className="op-mask">{displayEmail}</span>
            {maskOn && onToggleReveal && <button className="reveal-btn" onClick={() => onToggleReveal('email')}>{revealed?.email ? 'Hide' : 'Reveal'}</button>}
          </> :
        notProvided}
      </dd>
      <dt>Remark</dt>        <dd style={{ whiteSpace: 'pre-line', color: 'var(--color-text-secondary)' }}>{customer.remark || notProvided}</dd>
      <dt>Registered</dt>    <dd>{fmtDateTime(customer.registeredAt)}</dd>
    </dl>);
};

const EMAIL_RE_DETAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE_DETAIL = /^[\d\s\-().]{4,}$/;
// Customer info validation: only Company Name + Country are mandatory.
// Address / License are optional with no format rules. Email + Phone are
// optional but must still pass format checks when filled in.
const companyFormValid = (f) =>
!!(f?.name?.trim() && f?.country) &&
(!f?.email?.trim() || EMAIL_RE_DETAIL.test(f.email)) &&
(!f?.phone?.trim() || (PHONE_RE_DETAIL.test(f.phone) && f?.phoneCountryCode?.trim()));

const CompanyInfoEdit = ({ form, onChange }) => {
  const handleCountryChange = (code) => {
    const prev = COUNTRY_BY_CODE?.[form.country];
    const next = COUNTRY_BY_CODE?.[code];
    const shouldSyncDial = !form.phoneCountryCode || prev && form.phoneCountryCode === prev.dial;
    onChange({ ...form, country: code, ...(shouldSyncDial && next ? { phoneCountryCode: next.dial } : {}) });
  };
  const phoneInvalid = !!(form.phone && !PHONE_RE_DETAIL.test(form.phone));
  const emailInvalid = !!(form.email && !EMAIL_RE_DETAIL.test(form.email));
  const tzList = window.TIMEZONES || [];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Company name" required>
        <Input value={form.name || ''} onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </Field>
      <Field label="License">
        <Input value={form.license || ''} onChange={(e) => onChange({ ...form, license: e.target.value })} placeholder="e.g. NW-2024-08831-CA" />
      </Field>
      <div className="form-grid form-grid--2" style={{ gap: 16 }}>
        <Field label="Country" required>
          <Select value={form.country || ''} onChange={(e) => handleCountryChange(e.target.value)}>
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Timezone">
          <Select value={form.timezone || ''} onChange={(e) => onChange({ ...form, timezone: e.target.value })}>
            <option value="">Select timezone…</option>
            {tzList.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Address">
        <Textarea rows={2} value={form.address || ''} onChange={(e) => onChange({ ...form, address: e.target.value })} placeholder="Street, city, region, postal code" />
      </Field>
      <div className="form-grid form-grid--2" style={{ gap: 16 }}>
        <Field label="Contact name">
          <Input value={form.contactName || ''} onChange={(e) => onChange({ ...form, contactName: e.target.value })} placeholder="e.g. Sarah Chen" />
        </Field>
        <Field label="Email" error={emailInvalid ? 'Invalid email address' : null}>
          <Input type="email" value={form.email || ''} onChange={(e) => onChange({ ...form, email: e.target.value })} placeholder="contact@company.com" prefix={<Icon name="mail" size={14} />} invalid={emailInvalid} />
        </Field>
      </div>
      <Field label="Phone" error={phoneInvalid ? 'Invalid phone number' : null}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
          <Select value={form.phoneCountryCode || ''} onChange={(e) => onChange({ ...form, phoneCountryCode: e.target.value })}>
            <option value="">Code…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.dial}>{c.dial} · {c.code}</option>)}
          </Select>
          <Input value={form.phone || ''} onChange={(e) => onChange({ ...form, phone: e.target.value })} placeholder="e.g. 415 226 4800" invalid={phoneInvalid} />
        </div>
      </Field>
      <Field label="Remark" hint="Internal note — not visible to the customer.">
        <Textarea rows={2} value={form.remark || ''} onChange={(e) => onChange({ ...form, remark: e.target.value })} placeholder="Internal note" />
      </Field>
    </div>);
};

// ─── Overview tab ────────────────────────────────────────
const TabOverview = ({ customer, onSave, maskOn }) => {
  const buckets = _contractBuckets(customer.contracts);
  const liveCount = buckets.active + buckets.expired + buckets.suspended;
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(customer);
  const [revealed, setRevealed] = useState({});
  const toast = useToast();
  React.useEffect(() => {setForm(customer);}, [customer]);
  const toggleReveal = (field) => {
    setRevealed((r) => ({ ...r, [field]: !r[field] }));
    if (!revealed[field]) toast({ kind: 'info', title: 'Sensitive field revealed', msg: 'This action is recorded in the audit log.' });
  };
  const handleSave = () => {
    onSave(form);
    setEdit(false);
    toast({ kind: 'success', title: 'Customer info updated' });
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Company</div>
            {edit &&
            <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="ghost" size="sm" onClick={() => {setForm(customer);setEdit(false);}}>Cancel</Btn>
                <Btn variant="primary" size="sm" icon="check" disabled={!companyFormValid(form)} onClick={handleSave}>Save changes</Btn>
              </div>
            }
          </div>
          <div className="info-card__body">
            {!edit ?
            <CompanyInfoView customer={customer} maskOn={maskOn} revealed={revealed} onToggleReveal={toggleReveal} /> :
            <CompanyInfoEdit form={form} onChange={setForm} />}
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Contracts</div>
          <div className="stat__val">
            {liveCount}
            {buckets.terminated > 0 && (
              <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)', fontWeight: 500 }}> / {customer.contracts.length}</span>
            )}
          </div>
          <div className="stat__delta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
            {buckets.active > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success-500, oklch(58% 0.14 152))' }}/>
                {buckets.active} Active
              </span>
            )}
            {buckets.suspended > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-error-700)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error-500, oklch(58% 0.20 25))' }}/>
                {buckets.suspended} Suspended
              </span>
            )}
            {buckets.expired > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-warning-700)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning-500, oklch(70% 0.16 70))' }}/>
                {buckets.expired} Expired
              </span>
            )}
            {buckets.terminated > 0 && (
              <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {buckets.terminated} historical
              </span>
            )}
            {liveCount === 0 && buckets.terminated === 0 && (
              <span className="muted">No contracts yet</span>
            )}
          </div>
        </div>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Operators</div>
          <div className="stat__val">{customer.operators.length}</div>
          <div className="stat__delta">{customer.operators.filter((o) => !o.pending).length} active</div>
        </div>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Last activity</div>
          <div className="stat__val" style={{ fontSize: 18 }}>
            {(() => {
              // Aggregate every audit timestamp the customer carries:
              // entity-level events (customer.events) + every contract's
              // own per-contract events array. Pick the most recent one.
              const ts = [];
              (customer.events || []).forEach((e) => { if (e?.at) ts.push(e.at); });
              (customer.contracts || []).forEach((c) => {
                (c.events || []).forEach((e) => { if (e?.at) ts.push(e.at); });
                if (c.signedAt)       ts.push(c.signedAt);
                if (c.terminatedAt)   ts.push(c.terminatedAt);
                if (c.effectiveFrom)  ts.push(c.effectiveFrom);
              });
              if (ts.length === 0) return '—';
              const latest = ts.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
              return relTime(latest);
            })()}
          </div>
        </div>
      </div>
    </div>);

};

// ─── Information tab (Scene 3) ────────────────────────────
const TabInfo = ({ customer, onSave }) => {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(customer);
  const toast = useToast();

  React.useEffect(() => {setForm(customer);}, [customer]);

  const handleSave = () => {
    onSave(form);
    setEdit(false);
    toast({ kind: 'success', title: 'Customer info updated' });
  };

  return (
    <div className="info-card" style={{ maxWidth: 760 }}>
      <div className="info-card__head">
        <div className="info-card__title">Basic information</div>
        {!edit ?
        <Btn variant="secondary" size="sm" icon="edit" onClick={() => setEdit(true)}>Edit</Btn> :

        <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" size="sm" onClick={() => {setForm(customer);setEdit(false);}}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="check" disabled={!companyFormValid(form)} onClick={handleSave}>Save changes</Btn>
          </div>
        }
      </div>
      <div className="info-card__body">
        {!edit ?
        <CompanyInfoView customer={customer} /> :
        <CompanyInfoEdit form={form} onChange={setForm} />}
      </div>
    </div>);

};

// ─── Contract detail view (modal body) ──────────────────────────
// Self-contained component so its edit-mode state resets when the user
// opens a different contract — drive that with `key={contract.id}` at
// the call site.
const ContractDetailView = ({
  contract: c,
  customer,
  onUpdateContract,
  // When true, the entitlements section starts in edit mode (no extra
  // "View → Edit" click). Used by the row-level Edit entry point.
  initialEdit = false,
  // Notifies the parent whenever the entitlements editor goes dirty /
  // clean — parent uses this to gate the close handler with a "discard
  // unsaved changes?" confirm.
  onDirtyChange,
}) => {
  const toast   = useToast();
  const s       = _CS(c.status);
  // Derived contract status — dominant everywhere except where we need to
  // know the raw enum (e.g. soft delete sets raw to TERMINATED). Use this
  // for UI decisions (banner, actions, read-only gate).
  const derived = window.effectiveStatus(c);
  const effFrom = c.effectiveFrom || c.signedAt;
  const effTo   = c.effectiveTo;
  const issuer  = c.authorizingEntityName || (c.authorizingEntityId === 'e-npt' ? 'NPT' : c.authorizingEntityId) || 'NPT';
  const expiry  = _expiryState(c);
  // Fully read-only only for TERMINATED. EXPIRED stays editable so admins
  // can extend the term to revive the contract.
  const isReadOnly = derived === 'TERMINATED';

  // ── Term editor (effectiveTo) ─────────────────────────────────
  const [termEdit, setTermEdit] = useState(false);
  const [termValue, setTermValue] = useState(effTo ? String(effTo).slice(0, 10) : '');

  // ── Entitlements editor ──────────────────────────────────────
  const schema = CONTRACT_ENTITLEMENT_SCHEMA[String(c.kind || '').toUpperCase()] || [];
  const [entEdit, setEntEdit] = useState(!!initialEdit && schema.length > 0 && !isReadOnly);
  // Snapshot of the form on entry so we can compute "dirty" by comparing
  // the current entForm against this baseline. Updated after a successful
  // save so subsequent edits are measured from the saved state.
  const initialFormJsonRef = React.useRef(null);
  // Initialize the form mirroring the JSON shape ClauseInput expects.
  //   'models'   → string[]
  //   'currency' → string (e.g. "USD") — drives display of all price rows
  //   'price'    → { price: string }                    (string while editing)
  //   'feature'  → { enable: boolean, price: string }   (string while editing)
  // saveEntitlements() coerces price strings back to numbers on commit.
  // Legacy data shapes ({ price, currency }, { enable, priceStrategy }) are
  // accepted and migrated to the flat shape on load.
  const initEntForm = () => {
    const out = {};
    schema.forEach((f) => {
      const v = c.entitlements?.[f.key];
      if (f.type === 'models') {
        out[f.key] = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
      } else if (f.type === 'currency') {
        out[f.key] = typeof v === 'string' && v ? v : (c.entitlements?.settlementCurrency || 'USD');
      } else if (f.type === 'price') {
        const price = v && typeof v === 'object'
          ? (v.price == null ? '' : String(v.price))
          : (v == null ? '' : String(v));
        out[f.key] = { price };
      } else if (f.type === 'feature') {
        const p = v && typeof v === 'object'
          ? (v.price != null ? v.price : v.priceStrategy?.price)
          : null;
        out[f.key] = {
          enable: !!v?.enable,
          price: p == null ? '' : String(p),
        };
      } else {
        out[f.key] = v ?? '';
      }
    });
    return out;
  };
  const [entForm, setEntForm] = useState(() => {
    const form = initEntForm();
    initialFormJsonRef.current = JSON.stringify(form);
    return form;
  });

  // Tell the parent whenever the form goes dirty / clean so it can guard
  // the modal close with a "discard?" confirm.
  React.useEffect(() => {
    if (!onDirtyChange) return;
    const isDirty = entEdit && JSON.stringify(entForm) !== initialFormJsonRef.current;
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entEdit, entForm]);

  // ── Status banner content ────────────────────────────────────
  const banner = (() => {
    if (derived === 'ACTIVE' || derived === 'SIGNED') {
      if (expiry?.kind === 'expiring') return {
        tone: 'warning', icon: 'clock',
        title: `Expires in ${expiry.days} day${expiry.days === 1 ? '' : 's'}`,
        msg: 'Consider extending the effective-to date before access lapses.',
      };
      return {
        tone: 'success', icon: 'check',
        title: 'Active',
        msg: 'Customer has full access to features granted by this contract.',
      };
    }
    if (derived === 'EXPIRED') {
      const days = effTo ? Math.floor((new Date() - new Date(effTo)) / 86400000) : null;
      return {
        tone: 'warning', icon: 'alert',
        title: days != null ? `Expired ${days} day${days === 1 ? '' : 's'} ago` : 'Expired',
        msg: `Effective-to date (${effTo ? fmtDate(effTo) : '—'}) has passed. The contract is no longer in force. Extend the term below to revive it, or terminate to close it out.`,
      };
    }
    if (derived === 'SUSPENDED') return {
      tone: 'error', icon: 'minus',
      title: 'Suspended',
      msg: 'Customer access is blocked. The contract record stays on file and can be resumed or terminated.',
    };
    if (derived === 'TERMINATED') return {
      tone: 'neutral', icon: 'x',
      title: 'Terminated',
      msg: `Ended ${c.terminatedAt ? fmtDate(c.terminatedAt) : '—'}. This is a read-only historical record.`,
    };
    return null;
  })();

  // ── Visual timeline strip dimensions ─────────────────────────
  // Maps Authorized → Effective from → Now → Effective to onto a 0–100% bar.
  const buildStrip = () => {
    const auth = c.authorizedAt ? new Date(c.authorizedAt).getTime() : (effFrom ? new Date(effFrom).getTime() : null);
    const from = effFrom ? new Date(effFrom).getTime() : null;
    const to   = effTo ? new Date(effTo).getTime() : null;
    const now  = Date.now();
    if (!from) return null;
    // Pick a span: from auth to (to || now+90d), whichever is later.
    const start = auth || from;
    const end   = to || (now + 90 * 86400000);
    const span  = Math.max(end - start, 86400000);
    const pct = (t) => Math.max(0, Math.min(100, ((t - start) / span) * 100));
    return { auth, from, to, now, span, pct, start, end };
  };
  const strip = buildStrip();

  // ── Audit timeline (events) ──────────────────────────────────
  // Contract events (audit timeline). Per the new domain model, events
  // live on the contract itself with schema { statusFrom, statusTo,
  // description }. statusFrom/To may be null for descriptive events.
  const timeline = Array.isArray(c.events) ? c.events : [];

  // ── Save handlers ────────────────────────────────────────────
  const saveTerm = () => {
    const nextIso = termValue ? new Date(termValue + 'T00:00:00').toISOString() : null;
    if (nextIso === effTo) { setTermEdit(false); return; }
    const oldLabel = effTo ? fmtDate(effTo) : 'No end date';
    const newLabel = nextIso ? fmtDate(nextIso) : 'No end date';
    onUpdateContract(c, { effectiveTo: nextIso }, `${c.kind} contract term changed: ${oldLabel} → ${newLabel}`);
    toast({ kind: 'success', title: 'Contract term updated', msg: `Effective to: ${newLabel}` });
    setTermEdit(false);
  };
  const saveEntitlements = () => {
    // Validate via clauseError before committing so we don't write a bad
    // shape (e.g. enabled feature with no price). UI already shows red
    // borders + Save button is disabled when entErrors is non-empty.
    const errs = {};
    schema.forEach((f) => {
      const e = window.clauseError ? window.clauseError(f, entForm[f.key]) : null;
      if (e) errs[f.key] = e;
    });
    if (Object.keys(errs).length > 0) {
      toast({ kind: 'error', title: 'Cannot save', msg: 'Fix the highlighted clauses first.' });
      return;
    }
    // Convert form values back to typed values per schema.
    const out = {};
    schema.forEach((f) => {
      const v = entForm[f.key];
      if (f.type === 'models') {
        out[f.key] = Array.isArray(v) ? v.slice() : [];
      } else if (f.type === 'currency') {
        out[f.key] = typeof v === 'string' && v ? v : 'USD';
      } else if (f.type === 'price') {
        const p = v?.price;
        out[f.key] = {
          price: p === '' || p == null ? 0 : Number(p),
        };
      } else if (f.type === 'feature') {
        const p = v?.price;
        out[f.key] = {
          enable: !!v?.enable,
          price: p === '' || p == null ? null : Number(p),
        };
      } else if (f.type === 'number') {
        if (v !== '' && v != null && !isNaN(Number(v))) out[f.key] = Number(v);
      } else {
        if (String(v ?? '').trim()) out[f.key] = String(v).trim();
      }
    });
    onUpdateContract(c, { entitlements: out }, `${c.kind} contract entitlements updated`);
    toast({ kind: 'success', title: 'Entitlements updated' });
    // Re-baseline the dirty snapshot so the next edit starts clean.
    initialFormJsonRef.current = JSON.stringify(entForm);
    if (onDirtyChange) onDirtyChange(false);
    setEntEdit(false);
  };

  // Live error map for the editor — drives red borders and the Save gate.
  const entErrors = (() => {
    if (!entEdit) return {};
    const out = {};
    schema.forEach((f) => {
      const e = window.clauseError ? window.clauseError(f, entForm[f.key]) : null;
      if (e) out[f.key] = e;
    });
    return out;
  })();

  const bannerStyle = {
    success:  { background: 'var(--color-success-50)', color: 'var(--color-success-700)', border: '1px solid oklch(58% 0.14 152 / 0.25)' },
    warning:  { background: 'var(--color-warning-50)', color: 'var(--color-warning-700)', border: '1px solid oklch(70% 0.16 70 / 0.25)' },
    error:    { background: 'var(--color-error-50)',   color: 'var(--color-error-700)',   border: '1px solid oklch(58% 0.20 25 / 0.25)' },
    info:     { background: 'var(--color-info-50)',    color: 'var(--color-info-700)',    border: '1px solid oklch(60% 0.14 230 / 0.25)' },
    neutral:  { background: 'var(--color-bg-3)',       color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' },
  }[banner?.tone || 'neutral'];

  const SectionHead = ({ title, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {action}
    </div>
  );

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className={`pick-card__icon pick-card__icon--${c.kind.toLowerCase()}`} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}>
          <Icon name={iconForKind(c.kind)} size={20}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {c.kind} Contract
            <StatusChip status={c.status} effectiveTo={c.effectiveTo}/>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{CONTRACT_INFO[c.kind]?.desc}</div>
          <code style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{c.id || `CT-${c.kind.toUpperCase()}-${String(customer.id || '0000').padStart(4, '0')}`}</code>
        </div>
      </div>

      {/* Status banner */}
      {banner && (
        <div style={{ ...bannerStyle, display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, alignItems: 'flex-start' }}>
          <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name={banner.icon} size={16}/></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{banner.title}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 2, color: 'inherit', opacity: 0.85 }}>{banner.msg}</div>
          </div>
        </div>
      )}

      {/* Identity */}
      <div>
        <SectionHead title="Identity"/>
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Authorized by</dt>
          <dd>
            <strong>{issuer}</strong>
            {c.authorizingEntityId === 'e-npt'
              ? <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6, fontSize: 12 }}>(Platform)</span>
              : <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6, fontSize: 12 }}>(ISO partner)</span>}
          </dd>
          <dt>Configured by</dt>
          <dd>{c.signedBy ? maskEmail(c.signedBy) : <span className="muted">—</span>}</dd>
          <dt>Authorized at</dt>
          <dd>{c.authorizedAt ? fmtDateTime(c.authorizedAt) : (c.signedAt ? fmtDateTime(c.signedAt) : <span className="muted">—</span>)}</dd>
        </dl>
      </div>

      {/* Effective window with edit + visual strip */}
      <div>
        <SectionHead
          title="Effective window"
          action={!isReadOnly && !termEdit && (
            <Btn variant="ghost" size="sm" icon="edit" onClick={() => setTermEdit(true)}>Edit term</Btn>
          )}
        />
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Effective from</dt>
          <dd>{effFrom ? fmtDate(effFrom) : <span className="muted">—</span>}</dd>
          <dt>Effective to</dt>
          <dd>
            {!termEdit ? (
              effTo
                ? fmtDate(effTo)
                : <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No end date</span>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Input type="date" value={termValue} onChange={(e) => setTermValue(e.target.value)} style={{ width: 180 }}/>
                <Btn variant="ghost" size="sm" onClick={() => setTermValue('')}>Clear</Btn>
                <Btn variant="primary" size="sm" icon="check" onClick={saveTerm}>Save</Btn>
                <Btn variant="ghost" size="sm" onClick={() => { setTermEdit(false); setTermValue(effTo ? String(effTo).slice(0, 10) : ''); }}>Cancel</Btn>
              </div>
            )}
          </dd>
          {(s === 'TERMINATED' || s === 'EXPIRED') && (
            <>
              <dt>Terminated at</dt>
              <dd>{c.terminatedAt ? fmtDateTime(c.terminatedAt) : <span className="muted">—</span>}</dd>
              <dt>Terminated by</dt>
              <dd>{c.terminatedByEntityId === 'e-npt' ? 'NPT admin' : (c.terminatedByEntityId || <span className="muted">—</span>)}</dd>
            </>
          )}
        </dl>

        {/* Visual strip — only when we have a start anchor */}
        {strip && (
          <div style={{ marginTop: 16, padding: '4px 6px 0' }}>
            <div style={{ position: 'relative', height: 38 }}>
              {/* Track (auth → end-of-span) */}
              <div style={{ position: 'absolute', top: 17, left: 0, right: 0, height: 4, background: 'var(--color-border-default)', borderRadius: 2 }}/>
              {/* Active range (effFrom → effTo|now), green if active */}
              {strip.from != null && (
                <div style={{
                  position: 'absolute',
                  top: 17,
                  left: `${strip.pct(strip.from)}%`,
                  width: `${Math.max(0, strip.pct(strip.to || strip.now) - strip.pct(strip.from))}%`,
                  height: 4,
                  background: s === 'SUSPENDED' ? 'var(--color-error-500)'
                            : (s === 'TERMINATED' || s === 'EXPIRED') ? 'var(--color-text-tertiary)'
                            : 'var(--color-success-500)',
                  borderRadius: 2,
                }}/>
              )}
              {/* Dashed continuation when effectiveTo is unset (open-ended) */}
              {strip.from != null && !strip.to && (
                <div style={{
                  position: 'absolute',
                  top: 17,
                  left: `${strip.pct(strip.now)}%`,
                  right: 0,
                  height: 4,
                  borderTop: '2px dashed var(--color-text-tertiary)',
                  opacity: 0.5,
                }}/>
              )}
              {/* Markers */}
              {strip.auth != null && (
                <TimelineMarker x={strip.pct(strip.auth)} color="var(--color-text-secondary)" label="Authorized" date={strip.auth}/>
              )}
              {strip.from != null && strip.from !== strip.auth && (
                <TimelineMarker x={strip.pct(strip.from)} color="var(--color-success-500)" label="Effective" date={strip.from}/>
              )}
              <TimelineMarker x={strip.pct(strip.now)} color="var(--color-text-primary)" label="Now" date={strip.now} solid/>
              {strip.to && (
                <TimelineMarker x={strip.pct(strip.to)} color={expiry?.kind === 'expiring' ? 'var(--color-warning-500)' : expiry?.kind === 'expired' ? 'var(--color-error-500)' : 'var(--color-text-secondary)'} label="Ends" date={strip.to}/>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Entitlements (schema-driven editor) */}
      <div>
        <SectionHead
          title="Entitlements"
          action={!isReadOnly && !entEdit && schema.length > 0 && (
            <Btn variant="ghost" size="sm" icon="edit" onClick={() => setEntEdit(true)}>
              {Object.keys(c.entitlements || {}).length === 0 ? 'Configure' : 'Edit'}
            </Btn>
          )}
        />
        {entEdit ? (
          <>
            <div className="stack" style={{ gap: 12 }}>
              {schema.map((f) => {
                const err = entErrors[f.key];
                // Contract-level currency drives display of all price /
                // feature rows. Read from the live form value of the
                // settlementCurrency clause (fallback: USD).
                const settlementCurrency = entForm.settlementCurrency || 'USD';
                return (
                  <Field
                    key={f.key}
                    label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
                    hint={`${f.help || ''}${f.unit ? ` · ${f.unit}` : ''}`}
                    error={err}
                  >
                    <window.ClauseInput
                      clause={f}
                      value={entForm[f.key]}
                      onChange={(v) => setEntForm({ ...entForm, [f.key]: v })}
                      error={err}
                      currency={settlementCurrency}
                    />
                  </Field>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn variant="ghost" size="sm" onClick={() => {
                const reset = initEntForm();
                setEntForm(reset);
                initialFormJsonRef.current = JSON.stringify(reset);
                if (onDirtyChange) onDirtyChange(false);
                setEntEdit(false);
              }}>Cancel</Btn>
              <Btn variant="primary" size="sm" icon="check" disabled={Object.keys(entErrors).length > 0} onClick={saveEntitlements}>Save entitlements</Btn>
            </div>
          </>
        ) : (
          (() => {
            // Empty state #1: contract type has no entitlement schema (ISV /
            // MERCHANT / DISTRIBUTOR / ADMIN). No CTA — this is by design.
            if (schema.length === 0) {
              return (
                <div style={{ padding: '20px 12px', textAlign: 'center', background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                  {c.kind} contracts have no configurable entitlements in the current model.
                </div>
              );
            }
            // Empty state #2: ISO contract with no values set yet.
            const ents = c.entitlements && typeof c.entitlements === 'object' ? Object.entries(c.entitlements) : [];
            if (ents.length === 0) {
              return (
                <div style={{ padding: '20px 12px', textAlign: 'center', background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                  No entitlements configured.
                  {!isReadOnly && <> Click <strong>Configure</strong> above to set the {c.kind}-specific scope.</>}
                </div>
              );
            }
            // Render each entitlement by schema type for nice formatting.
            return (
              <dl className="kv" style={{ margin: 0 }}>
                {schema.map((f) => {
                  const v = c.entitlements?.[f.key];
                  if (v == null) return null;
                  // Contract-level currency for price/feature display.
                  const settlementCurrency = c.entitlements?.settlementCurrency || 'USD';
                  let display;
                  if (f.type === 'currency') {
                    display = <strong>{String(v)}</strong>;
                  } else if (f.type === 'price') {
                    const price = v && typeof v === 'object' ? v.price : v;
                    display = price != null
                      ? <span><strong>{Number(price).toFixed(2)} {settlementCurrency}</strong> <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>· {f.unit}</span></span>
                      : '—';
                  } else if (f.type === 'feature') {
                    if (!v?.enable) {
                      display = <span className="muted">Disabled</span>;
                    } else {
                      // Tolerate legacy { priceStrategy: { price } } shape.
                      const p = v.price != null ? v.price : v.priceStrategy?.price;
                      display = <span>
                        <span className="tds-badge tds-badge--success" style={{ marginRight: 8 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Enabled
                        </span>
                        {p != null
                          ? <><strong>{Number(p).toFixed(2)} {settlementCurrency}</strong><span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}> · {f.unit}</span></>
                          : <span className="muted">Price not set</span>}
                      </span>;
                    }
                  } else if (f.type === 'models' || Array.isArray(v)) {
                    // Resolve model ids → display names so admins see
                    // human-friendly chips (e.g. "N950" instead of "m-n950").
                    const arr = Array.isArray(v) ? v : [];
                    const lookup = (window.DEVICE_MODELS || []);
                    display = arr.length === 0
                      ? <span className="muted">—</span>
                      : <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                          {arr.map((id, i) => {
                            const m = lookup.find((x) => x.id === id);
                            return <span key={i} className="tds-badge tds-badge--neutral" style={{ padding: '2px 7px', fontSize: 11.5 }} title={id}>{m ? (m.name || id) : id}</span>;
                          })}
                        </span>;
                  } else if (typeof v === 'object') {
                    display = <code style={{ fontSize: 12 }}>{JSON.stringify(v)}</code>;
                  } else {
                    display = String(v);
                  }
                  return (
                    <React.Fragment key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{display}</dd>
                    </React.Fragment>
                  );
                })}
              </dl>
            );
          })()
        )}
      </div>

      {/* Audit timeline */}
      {timeline.length > 0 && (
        <div>
          <SectionHead title={`Timeline (${timeline.length})`}/>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {timeline.slice().reverse().slice(0, 8).map((ev, idx) => {
              const hasTransition = ev.statusFrom != null || ev.statusTo != null;
              // Tone for the transition badge. PILOT gets its own
              // indigo tone; everything else falls back to info.
              const toTone = ({
                ACTIVE:     'success',
                PILOT:      'pilot',
                SUSPENDED:  'error',
                TERMINATED: 'neutral',
              }[String(ev.statusTo || '').toUpperCase()]) || 'info';
              // Derive a one-line label for new event-typed entries —
              // PILOT_EXTEND / PILOT_CONVERT / BIND_PILOT. Falls back
              // to ev.description for legacy/non-typed events.
              const eventTitle = (() => {
                const t = ev.eventType;
                if (!t) return null;
                const info = ev.eventInfo || {};
                if (t === 'BIND_PILOT')    return `Pilot started · expires ${info.initialEffectiveTo ? fmtDate(info.initialEffectiveTo) : '—'}`;
                if (t === 'PILOT_EXTEND')  return `Pilot extended +${info.days || '?'} days · new expiry ${info.toEffectiveTo ? fmtDate(info.toEffectiveTo) : '—'}${info.reason ? ' · ' + info.reason : ''}`;
                if (t === 'PILOT_CONVERT') return `Converted to active · effective from ${info.newEffectiveFrom ? fmtDate(info.newEffectiveFrom) : '—'}`;
                return null;
              })();
              return (
                <li key={idx} style={{ padding: '8px 0', borderBottom: idx === Math.min(timeline.length, 8) - 1 ? 'none' : '1px solid var(--color-border-subtle)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {hasTransition && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, flexShrink: 0, marginTop: 1 }}>
                      {ev.statusFrom
                        ? <span className="tds-badge tds-badge--neutral" style={{ padding: '1px 6px' }}>{ev.statusFrom}</span>
                        : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>—</span>}
                      <Icon name="arrowR" size={10}/>
                      <span className={`tds-badge tds-badge--${toTone}`} style={{ padding: '1px 6px' }}>{ev.statusTo}</span>
                    </span>
                  )}
                  <span style={{ flex: 1, lineHeight: 1.5 }}>
                    {eventTitle ? (
                      <>
                        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{eventTitle}</span>
                        {ev.description && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                            {ev.description}
                          </span>
                        )}
                      </>
                    ) : (
                      ev.description
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// Tiny marker primitive for the effective-window strip.
const TimelineMarker = ({ x, color, label, date, solid }) => (
  <div style={{ position: 'absolute', left: `${x}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
    <div style={{
      width: solid ? 10 : 8,
      height: solid ? 10 : 8,
      borderRadius: '50%',
      background: solid ? color : '#fff',
      border: `2px solid ${color}`,
      marginTop: solid ? 12 : 13,
      boxShadow: solid ? `0 0 0 3px ${color}22` : 'none',
    }}/>
    <div style={{ fontSize: 10, color, marginTop: 4, fontWeight: solid ? 600 : 500, whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>{fmtDate(date)}</div>
  </div>
);

// ─── PILOT action modals (used by TabContracts) ────────────
// Both modals are intentionally self-contained — they don't reach into
// shared.jsx prototype helpers. After integration we can lift them out
// of this file, but co-locating with TabContracts keeps the scope tight.

const _PILOT_EXTEND_OPTS = [30, 60, 90];

// Extend pilot modal — pick +N days, optional reason. The new
// effectiveTo is computed from "today" (NOT additive to current
// effectiveTo, per spec).
const ExtendPilotModal = ({ target, onClose, onConfirm }) => {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  useEffect(() => { if (target) { setDays(30); setReason(''); } }, [target]);
  if (!target) return null;

  const newTo = new Date(Date.now() + days * 86400000);
  const curTo = target.effectiveTo ? new Date(target.effectiveTo) : null;

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Extend pilot +${days} days`}
      width={520}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={() => onConfirm({ days, reason: reason.trim() })}>Confirm extension</Btn>
      </>}
    >
      <div className="stack">
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
          Pilot expiry becomes <b style={{ color: 'var(--color-text-primary)' }}>today + {days} days</b>. It doesn't stack on the current expiry. Each extension is recorded as a <code>PILOT_EXTEND</code> event.
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Duration</div>
          <div style={{ display: 'inline-flex', padding: 3, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, gap: 2 }}>
            {_PILOT_EXTEND_OPTS.map((opt) => (
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
              >+{opt} days</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 12, alignItems: 'center', padding: 12, background: 'var(--color-bg-3)', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Current</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{curTo ? fmtDate(curTo.toISOString()) : '—'}</div>
          </div>
          <Icon name="arrowR" size={14}/>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.08 }}>After</div>
            <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--color-success-700)' }}>{fmtDate(newTo.toISOString())}</div>
          </div>
        </div>

        <Field label="Reason (optional)" hint="Saved on the PILOT_EXTEND event.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer needs more time to evaluate"/>
        </Field>
      </div>
    </Modal>
  );
};

// Convert pilot to active modal — 2-step wizard. Step 0: warning + ack.
// Step 1: re-enter every fee (all blanked, must type explicitly).
// onConfirm receives { entitlements (form-shape), effectiveFrom (ISO),
// effectiveTo (ISO|null) }. Parent reshapes entitlements via
// window.formToEntitlements before persisting.
const ConvertPilotModal = ({ target, onClose, onConfirm }) => {
  const [step, setStep] = useState(0);
  const [ack, setAck] = useState(false);
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState({});
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');

  // Schema only ISO has entitlements. Other kinds have empty schema so
  // the fees step is empty and admin just clicks Confirm.
  const schema = target
    ? ((window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[String(target.kind).toUpperCase()]) || [])
    : [];
  const feeFields = schema.filter((f) => f.type === 'price' || f.type === 'feature');

  useEffect(() => {
    if (!target) return;
    setStep(0); setAck(false); setTouched({});
    setEffFrom(new Date().toISOString().slice(0, 10));
    setEffTo('');
    // Read existing entitlements into form-shape, then BLANK every fee
    // value so admin must explicitly retype (even to keep at 0).
    const f = window.entitlementsToForm
      ? window.entitlementsToForm(target.entitlements || {}, schema)
      : {};
    feeFields.forEach((fld) => {
      if (fld.type === 'price') f[fld.key] = { price: '' };
      else if (fld.type === 'feature') f[fld.key] = { enable: !!f[fld.key]?.enable, price: '' };
    });
    setForm(f);
  }, [target]);
  if (!target) return null;

  const cur = form.settlementCurrency || 'USD';
  const setField = (key, v) => {
    setForm((s) => ({ ...s, [key]: v }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  // Validation: every enabled fee must be touched AND non-empty AND >= 0.
  const errs = {};
  feeFields.forEach((f) => {
    const v = form[f.key];
    const enabled = f.type === 'price' ? true : !!v?.enable;
    if (!enabled) return;
    if (!touched[f.key]) { errs[f.key] = 'Confirm this fee'; return; }
    const e = window.clauseError ? window.clauseError(f, v) : null;
    if (e) errs[f.key] = e;
  });
  const valid = Object.keys(errs).length === 0;

  const submit = () => {
    const entitlements = window.formToEntitlements
      ? window.formToEntitlements(form, schema)
      : {};
    onConfirm({
      entitlements,
      effectiveFrom: effFrom ? new Date(effFrom + 'T00:00:00Z').toISOString() : new Date().toISOString(),
      effectiveTo: effTo ? new Date(effTo + 'T00:00:00Z').toISOString() : null,
    });
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Convert ${target.kind} pilot to active`}
      width={680}
      footer={step === 0 ? (
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!ack} onClick={() => setStep(1)}>
            {feeFields.length > 0 ? 'Next · Re-enter fees' : 'Next · Confirm dates'}
          </Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={() => setStep(0)}>Back</Btn>
          <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>
            Confirm conversion
          </Btn>
        </>
      )}>
      {step === 0 && (
        <div className="stack">
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--color-warning-50)', border: '1px solid oklch(75% 0.13 80 / 0.3)', borderRadius: 10, color: 'var(--color-warning-700)' }}>
            <Icon name="alert" size={18}/>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>This is irreversible</div>
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.5, color: 'oklch(36% 0.07 70)' }}>
                {feeFields.length > 0 && <li><b>Every fee must be re-entered</b> — pilot prices were $0, type each one explicitly.</li>}
                <li><b>You cannot return to PILOT</b> after conversion.</li>
              </ul>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13.5, background: ack ? 'var(--color-primary-50)' : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary-700)', flex: 'none' }}/>
            <span style={{ lineHeight: 1.5 }}>I understand: this will activate billing for this customer.</span>
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          {feeFields.length > 0 ? (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                Enabled clauses appear below. <b>All amounts cleared</b> — re-enter each one (including 0).
              </div>
              {schema.map((f) => (
                <Field
                  key={f.key}
                  label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
                  hint={f.help}
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
            </>
          ) : (
            <div style={{ padding: '14px 16px', background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              No fee-bearing clauses on {target.kind} contracts — just confirm the effective dates below.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Effective from" hint="Defaults to today.">
              <Input type="date" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}/>
            </Field>
            <Field label="Effective to (optional)" hint="Leave blank for no end date.">
              <Input type="date" value={effTo} onChange={(e) => setEffTo(e.target.value)}/>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─── Contracts tab (Scene 4) ──────────────────────────────
const TabContracts = ({ customer, onAdd, onRemove, onStatusChange, onUpdateContract }) => {
  const [removeTarget, setRemoveTarget] = useState(null);
  // viewTarget is now only used for the read-only history view of
  // TERMINATED contracts. All live contract editing + adding flows
  // through the unified Manage Contracts modal below.
  const [viewTarget, setViewTarget] = useState(null);
  // statusTarget = { contract, next }. Drives the Suspend/Resume confirm
  // modal — null when closed. `reason` is the per-open form state for the
  // optional/required reason field shown to admins.
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  // PILOT-specific action targets. extendTarget = a PILOT contract to
  // extend (modal pops with the +30/+60/+90 picker). convertTarget = a
  // PILOT contract to convert to ACTIVE (2-step wizard: ack → re-fee).
  const [extendTarget, setExtendTarget] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  // ── Unified "Manage contracts" modal state ──
  // mgmtOpen     — whether the modal is shown.
  // mgmtPicked   — kinds the admin has toggled on but the customer does
  //                NOT yet hold (new contracts to create on Save).
  // mgmtEnts     — { [kind]: clauseFormValues } seeded from existing
  //                contracts on open + new entries as admin picks new
  //                kinds. ClauseInput-shaped (price/feature as strings).
  // mgmtTerms    — { [kind]: { effectiveFrom, effectiveTo } } seeded
  //                from existing contracts on open. Drives the date
  //                editors at the top of the right pane.
  // mgmtFocused  — kind currently focused in the rail (drives right pane).
  // mgmtInitialRef — JSON snapshot at open-time for dirty detection.
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [mgmtPicked, setMgmtPicked] = useState([]);
  // Per-kind PILOT/ACTIVE mode for newly-picked kinds in this session.
  // Existing contracts ignore this — they stay in whatever status
  // they're persisted as. Default (no override) per kind comes from
  // contract-assign.jsx: ISO → PILOT, others → ACTIVE.
  const [mgmtModeByKind, setMgmtModeByKind] = useState({});
  const [mgmtEnts, setMgmtEnts] = useState({});
  const [mgmtTerms, setMgmtTerms] = useState({});
  const [mgmtFocused, setMgmtFocused] = useState(null);
  const mgmtInitialRef = React.useRef('{}');
  // Set to true when the user clicks close on a dirty form. Drives a
  // tiny "discard?" confirm modal that gates the actual close.
  const [pendingClose, setPendingClose] = useState(false);
  // Per-row kebab menu — { contract, anchor } when open. Suspend / Resume /
  // Terminate moved here so the row only shows one primary "Edit" button.
  const [rowMenu, setRowMenu] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const toast = useToast();

  const openStatusConfirm = (contract, next) => {
    setStatusReason('');
    setStatusTarget({ contract, next });
  };

  // Split contracts into live (anything not TERMINATED) and history.
  const liveContracts    = customer.contracts.filter((c) => _CS(c.status) !== 'TERMINATED');
  const historyContracts = customer.contracts.filter((c) => _CS(c.status) === 'TERMINATED');

  // Contract types this customer can hold via the platform-admin UI.
  //   ADMIN     — system-internal, single global record (excluded).
  //   MERCHANT  — per spec §1.2 must be authorized by an ISO, NOT by
  //               ADMIN directly. Admins manage merchants from the
  //               ISO customer's own Merchants tab, not here. (excluded)
  //   ISV / ISO / Distributor are all valid for ADMIN to authorize.
  const ALL_KINDS = ['ISV', 'ISO', 'Distributor'];
  const liveKinds = liveContracts.map((c) => c.kind);

  // Map of kind → existing live contract, for ContractAssignBoard so it
  // can render existing rows differently from addable kinds.
  const existingByKind = React.useMemo(() => {
    const out = {};
    liveContracts.forEach((c) => { out[c.kind] = c; });
    return out;
  }, [liveContracts]);

  // Seed manage state from customer.contracts on open. `focusKind`
  // optionally pre-selects a specific contract row (used by the per-row
  // Edit button); falls back to the first existing contract, or the
  // first addable kind when the customer has nothing yet.
  const openManage = (focusKind = null) => {
    const ents = {};
    const terms = {};
    liveContracts.forEach((c) => {
      const sch = (window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[String(c.kind).toUpperCase()]) || [];
      ents[c.kind] = window.entitlementsToForm ? window.entitlementsToForm(c.entitlements || {}, sch) : {};
      terms[c.kind] = {
        effectiveFrom: c.effectiveFrom || c.signedAt || new Date().toISOString(),
        effectiveTo: c.effectiveTo || null,
      };
    });
    setMgmtPicked([]);
    setMgmtModeByKind({});
    setMgmtEnts(ents);
    setMgmtTerms(terms);
    const fallback = liveKinds[0] || ALL_KINDS.find((k) => !liveKinds.includes(k));
    setMgmtFocused(focusKind || fallback || null);
    mgmtInitialRef.current = JSON.stringify({ picked: [], ents, terms });
    setMgmtOpen(true);
  };

  const closeManage = () => {
    setMgmtOpen(false);
    setMgmtPicked([]);
    setMgmtModeByKind({});
    setMgmtEnts({});
    setMgmtTerms({});
    setMgmtFocused(null);
    mgmtInitialRef.current = '{}';
  };

  // Dirty = any change in picked / ents / terms vs the open-time snapshot.
  const mgmtDirty = mgmtOpen && JSON.stringify({ picked: mgmtPicked, ents: mgmtEnts, terms: mgmtTerms }) !== mgmtInitialRef.current;

  // Error map for both new-pick kinds AND existing ones (we still want
  // to flag invalid entitlements on existing contracts). Walk every
  // kind that has form state present.
  const mgmtErrors = (() => {
    if (!mgmtOpen || !window.collectAssignErrors) return {};
    const kindsToCheck = Array.from(new Set([
      ...Object.keys(existingByKind),
      ...mgmtPicked,
    ]));
    return window.collectAssignErrors(kindsToCheck, mgmtEnts);
  })();
  const mgmtHasErrors = Object.keys(mgmtErrors).length > 0;

  const handleSaveManage = () => {
    // (1) Update each existing live contract whose form differs from
    //     what's stored. Use formToEntitlements to coerce back to the
    //     JSONB shape.
    liveContracts.forEach((c) => {
      const sch = (window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[String(c.kind).toUpperCase()]) || [];
      const newEnts = window.formToEntitlements ? window.formToEntitlements(mgmtEnts[c.kind] || {}, sch) : {};
      const newTerms = mgmtTerms[c.kind] || {};
      const entsChanged = JSON.stringify(c.entitlements || {}) !== JSON.stringify(newEnts);
      const fromChanged = (c.effectiveFrom || null) !== (newTerms.effectiveFrom || null);
      const toChanged = (c.effectiveTo || null) !== (newTerms.effectiveTo || null);
      if (entsChanged || fromChanged || toChanged) {
        const patch = { entitlements: newEnts };
        if (fromChanged) patch.effectiveFrom = newTerms.effectiveFrom || null;
        if (toChanged)   patch.effectiveTo   = newTerms.effectiveTo   || null;
        const parts = [];
        if (entsChanged) parts.push('clauses');
        if (fromChanged || toChanged) parts.push('term');
        onUpdateContract(c, patch, `${c.kind} contract updated (${parts.join(' + ')})`);
      }
    });
    // (2) Add newly-picked kinds with their entitlements + terms.
    if (mgmtPicked.length > 0) {
      const newEntsByKind = {};
      const newTermsByKind = {};
      mgmtPicked.forEach((k) => {
        const sch = (window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[String(k).toUpperCase()]) || [];
        newEntsByKind[k] = window.formToEntitlements ? window.formToEntitlements(mgmtEnts[k] || {}, sch) : {};
        newTermsByKind[k] = mgmtTerms[k] || {};
      });
      // Resolve PILOT/ACTIVE per kind from the segmented control. ISO
      // defaults PILOT, others ACTIVE — admins can override either way.
      const modeMap = {};
      mgmtPicked.forEach((k) => {
        modeMap[k] = mgmtModeByKind[k] || (String(k).toUpperCase() === 'ISO' ? 'PILOT' : 'ACTIVE');
      });
      onAdd(mgmtPicked, newEntsByKind, newTermsByKind, modeMap);
    }
    toast({ kind: 'success', title: 'Contracts updated' });
    closeManage();
  };

  // Toggling a kind in the rail. Only addable (non-existing) kinds can
  // be toggled; existing contracts ignore the toggle (terminate via the
  // row ⋮ menu instead). Newly toggled-on kinds seed default term + ents.
  const onToggleMgmtPick = (kind) => {
    if (existingByKind[kind]) return;  // existing — no-op
    setMgmtPicked((p) => {
      if (p.includes(kind)) {
        // Toggle off → remove from picked + entitlements + terms.
        setMgmtEnts((e) => { const x = { ...e }; delete x[kind]; return x; });
        setMgmtTerms((t) => { const x = { ...t }; delete x[kind]; return x; });
        return p.filter((x) => x !== kind);
      }
      // Toggle on → default empty entitlements + term starting today.
      // Pre-fill settlementCurrency from the customer's country so admins
      // don't have to think about it for the common case.
      const nowIso = new Date().toISOString();
      const defaultCurrency = window.currencyForCountry
        ? window.currencyForCountry(customer.country)
        : 'USD';
      setMgmtEnts((e) => ({
        ...e,
        [kind]: { ...(e[kind] || {}), settlementCurrency: (e[kind]?.settlementCurrency || defaultCurrency) },
      }));
      setMgmtTerms((t) => ({ ...t, [kind]: { effectiveFrom: nowIso, effectiveTo: null } }));
      return [...p, kind];
    });
    setMgmtFocused(kind);
  };

  return (
    <>
      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">Contracts</div>
          <Btn variant="primary" size="sm" icon="settings"
            onClick={() => openManage()}>
            Manage contracts
          </Btn>
        </div>
        <div>
          {customer.contracts.length === 0 ? <div className="empty">No contracts yet. Click <strong>Manage contracts</strong> to assign one.</div> :
          liveContracts.length === 0 ? <div className="empty">No active contracts. All {historyContracts.length} contract{historyContracts.length === 1 ? ' is' : 's are'} terminated — see history below.</div> :
          liveContracts.map((c, i) => {
            const eff = window.effectiveStatus(c);
            const canEdit = eff !== 'TERMINATED';
            return (
              <div
                key={i}
                className={`crow ${canEdit ? 'crow--clickable' : ''}`}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={canEdit ? () => openManage(c.kind) : undefined}
                onKeyDown={canEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openManage(c.kind); } } : undefined}
              >
                <div className={`pick-card__icon pick-card__icon--${c.kind.toLowerCase()}`} style={{ width: 40, height: 40, borderRadius: 10 }}>
                  <Icon name={iconForKind(c.kind)} size={18} />
                </div>
                <div className="crow__main">
                  <div className="crow__title">
                    {c.kind}
                    <StatusChip status={c.status} effectiveTo={c.effectiveTo}/>
                    {(() => {
                      const ex = _expiryState(c);
                      if (!ex) return null;
                      const isPilot = ex.kind === 'pilot-active' || ex.kind === 'pilot-expiring' || ex.kind === 'pilot-expired';
                      const isPast = ex.kind === 'expired' || ex.kind === 'pilot-expired';
                      const isWarn = ex.kind === 'expiring' || ex.kind === 'pilot-expiring';
                      const cls = isPast ? 'tds-badge tds-badge--error' : (isWarn ? 'tds-badge tds-badge--warning' : 'tds-badge tds-badge--pilot');
                      const text = ex.kind === 'expired' ? ('Expired ' + ex.days + 'd ago')
                                 : ex.kind === 'pilot-expired' ? ('Pilot expired ' + ex.days + 'd ago')
                                 : isPilot ? (ex.days + 'd left')
                                 : ('Expires in ' + ex.days + 'd');
                      return (
                        <span className={cls}>
                          <Icon name={isPast ? 'alert' : 'clock'} size={11}/>
                          {text}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="crow__sub">
                    {_contractRowSubtitle(c, customer)}
                  </div>
                </div>
                <div className="crow__actions">
                  {/* PILOT contracts get explicit Extend / Convert
                      buttons on the row — these are the primary admin
                      actions during the trial phase and shouldn't be
                      hidden in the ⋮ menu. EXPIRED PILOT also gets them
                      (admin can still revive via extend, or convert). */}
                  {(window.effectiveStatus(c) === 'PILOT'
                    || (window.effectiveStatus(c) === 'EXPIRED' && String(c.status).toUpperCase() === 'PILOT')) && (
                    <>
                      <Btn variant="ghost" size="sm" icon="refresh" onClick={(e) => { e.stopPropagation(); setExtendTarget(c); }}>Extend</Btn>
                      <Btn variant="primary" size="sm" icon="check" onClick={(e) => { e.stopPropagation(); setConvertTarget(c); }}>Convert to active</Btn>
                    </>
                  )}
                  {/* Edit is the whole row — no separate button. The
                      kebab menu holds state-machine actions (Suspend /
                      Resume / Terminate). stopPropagation on the menu
                      trigger so the row's click doesn't fire too. */}
                  <div className="opmenu-wrap" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="iconbtn"
                      title="More actions"
                      aria-label="More actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        setRowMenu((m) => m?.id === c.id ? null : {
                          id: c.id,
                          contract: c,
                          anchor: { right: window.innerWidth - r.right, top: r.bottom + 4 },
                        });
                      }}
                    >
                      <Icon name="more" size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {historyContracts.length > 0 && (
        <div className="info-card" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="info-card__head"
            onClick={() => setShowHistory((v) => !v)}
            style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
          >
            <div className="info-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={showHistory ? 'chevD' : 'chevR'} size={12}/>
              History
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({historyContracts.length} terminated)</span>
            </div>
          </button>
          {showHistory && (
            <div>
              {historyContracts.map((c, i) => (
                <div key={i} className="crow" style={{ opacity: 0.7 }}>
                  <div className={`pick-card__icon pick-card__icon--${c.kind.toLowerCase()}`} style={{ width: 40, height: 40, borderRadius: 10, filter: 'grayscale(0.6)' }}>
                    <Icon name={iconForKind(c.kind)} size={18} />
                  </div>
                  <div className="crow__main">
                    <div className="crow__title" style={{ textDecoration: 'line-through', textDecorationColor: 'var(--color-text-tertiary)' }}>
                      {c.kind}
                      <StatusChip status={c.status} effectiveTo={c.effectiveTo}/>
                    </div>
                    <div className="crow__sub">
                      {_contractRowSubtitle(c, customer)}
                    </div>
                  </div>
                  <div className="crow__actions">
                    <Btn variant="ghost" size="sm" icon="eye" onClick={() => setViewTarget(c)}>View</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Row kebab menu — rendered here (not inside .crow__actions) so it
          escapes the info-card's overflow:hidden. Positioned via fixed
          coords captured when the trigger was clicked. */}
      {rowMenu && (() => {
        const c = rowMenu.contract;
        const eff = window.effectiveStatus(c);
        // PILOT and SUSPENDED both go to TERMINATED via the separator;
        // ACTIVE/SIGNED also get a status action above the separator.
        const showStateAction =
          eff === 'ACTIVE' || eff === 'SIGNED' || eff === 'SUSPENDED' ||
          eff === 'PILOT' || (eff === 'EXPIRED' && String(c.status).toUpperCase() === 'PILOT');
        return (
          <>
            <div
              onClick={() => setRowMenu(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 7000 }}
            />
            <div
              className="opmenu"
              style={{
                position: 'fixed',
                top: rowMenu.anchor.top,
                right: rowMenu.anchor.right,
                zIndex: 7001,
              }}
            >
              {(eff === 'ACTIVE' || eff === 'SIGNED') && (
                <button className="opmenu__item" onClick={() => { setRowMenu(null); openStatusConfirm(c, 'SUSPENDED'); }}>
                  <Icon name="minus" size={14}/> Suspend
                </button>
              )}
              {eff === 'SUSPENDED' && (
                <button className="opmenu__item" onClick={() => { setRowMenu(null); openStatusConfirm(c, 'ACTIVE'); }}>
                  <Icon name="check" size={14}/> Resume
                </button>
              )}
              {(eff === 'PILOT' || (eff === 'EXPIRED' && String(c.status).toUpperCase() === 'PILOT')) && (
                <>
                  {/* Extend + Convert also live on the row directly for
                      visibility. The menu duplicates them for keyboard /
                      power-user access. */}
                  <button className="opmenu__item" onClick={() => { setRowMenu(null); setExtendTarget(c); }}>
                    <Icon name="refresh" size={14}/> Extend pilot
                  </button>
                  <button className="opmenu__item" onClick={() => { setRowMenu(null); setConvertTarget(c); }}>
                    <Icon name="check" size={14}/> Convert to active
                  </button>
                </>
              )}
              {showStateAction && <div className="opmenu__sep"/>}
              <button className="opmenu__item opmenu__item--danger" onClick={() => { setRowMenu(null); setRemoveTarget(c); }}>
                <Icon name="trash" size={14}/> Terminate
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Unified Manage Contracts modal (Add + Edit in one) ── */}
      <Modal
        open={mgmtOpen}
        onClose={() => {
          if (mgmtDirty) { setPendingClose(true); } else { closeManage(); }
        }}
        title="Manage contracts"
        width={820}
        footer={(() => {
          const newCount = mgmtPicked.length;
          const changedExisting = liveContracts.filter((c) => {
            const sch = (window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[String(c.kind).toUpperCase()]) || [];
            const ne = window.formToEntitlements ? window.formToEntitlements(mgmtEnts[c.kind] || {}, sch) : {};
            const nt = mgmtTerms[c.kind] || {};
            return JSON.stringify(c.entitlements || {}) !== JSON.stringify(ne)
              || (c.effectiveFrom || null) !== (nt.effectiveFrom || null)
              || (c.effectiveTo || null) !== (nt.effectiveTo || null);
          }).length;
          const summary = [];
          if (newCount > 0) summary.push(`${newCount} new`);
          if (changedExisting > 0) summary.push(`${changedExisting} updated`);
          return (
            <>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {mgmtDirty && summary.length > 0 ? `Pending: ${summary.join(' · ')}` : null}
              </div>
              <Btn variant="ghost" onClick={() => {
                if (mgmtDirty) { setPendingClose(true); } else { closeManage(); }
              }}>Cancel</Btn>
              <Btn variant="primary" icon="check" disabled={!mgmtDirty || mgmtHasErrors} onClick={handleSaveManage}>
                Save changes
              </Btn>
            </>
          );
        })()}
      >
        {window.ContractAssignBoard ? (
          <window.ContractAssignBoard
            mode="manage"
            availableKinds={ALL_KINDS}
            selectedKinds={mgmtPicked}
            onTogglePick={onToggleMgmtPick}
            entitlements={mgmtEnts}
            setEntitlements={setMgmtEnts}
            modeByKind={mgmtModeByKind}
            setModeByKind={setMgmtModeByKind}
            focusedKind={mgmtFocused}
            setFocusedKind={setMgmtFocused}
            errorsByKind={mgmtErrors}
            existingByKind={existingByKind}
            terms={mgmtTerms}
            setTerms={setMgmtTerms}
            compact
          />
        ) : (
          <div className="empty">Loading…</div>
        )}
      </Modal>

      {/* History view — read-only modal for TERMINATED contracts. */}
      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={viewTarget ? `${viewTarget.kind} contract · history` : 'Contract'}
        width={720}
        footer={<>
          <div style={{ flex: 1 }}/>
          <Btn variant="secondary" onClick={() => setViewTarget(null)}>Close</Btn>
        </>}
      >
        {viewTarget && (
          <ContractDetailView
            key={viewTarget.id || viewTarget.kind}
            contract={viewTarget}
            customer={customer}
            onUpdateContract={onUpdateContract}
          />
        )}
      </Modal>

      {/* Discard-changes confirm — fires from the Manage modal when the
          form is dirty and the admin tries to close. */}
      <Modal
        open={pendingClose}
        onClose={() => setPendingClose(false)}
        title="Discard unsaved changes?"
        width={420}
        footer={<>
          <Btn variant="ghost" onClick={() => setPendingClose(false)}>Keep editing</Btn>
          <Btn variant="danger" icon="trash" onClick={() => {
            setPendingClose(false);
            closeManage();
          }}>Discard changes</Btn>
        </>}
      >
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          You have unsaved contract changes. Closing now will discard them.
        </p>
      </Modal>

      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.next === 'SUSPENDED' ? 'Suspend contract' : 'Resume contract'}
        width={460}
        footer={<>
          <Btn variant="ghost" onClick={() => setStatusTarget(null)}>Cancel</Btn>
          <Btn
            variant={statusTarget?.next === 'SUSPENDED' ? 'danger' : 'primary'}
            icon={statusTarget?.next === 'SUSPENDED' ? 'minus' : 'check'}
            disabled={statusTarget?.next === 'SUSPENDED' && !statusReason.trim()}
            onClick={() => {
              const { contract, next } = statusTarget;
              onStatusChange(contract, next, statusReason.trim() || undefined);
              toast({
                kind: next === 'SUSPENDED' ? 'warning' : 'success',
                title: `${contract.kind} contract ${next === 'SUSPENDED' ? 'suspended' : 'resumed'}`,
                msg: statusReason.trim() ? `Reason: ${statusReason.trim()}` : undefined,
              });
              setStatusTarget(null);
            }}>
            {statusTarget?.next === 'SUSPENDED' ? 'Suspend contract' : 'Resume contract'}
          </Btn>
        </>}>
        {statusTarget && (() => {
          const isSuspend = statusTarget.next === 'SUSPENDED';
          return (
            <div className="stack">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                {isSuspend ? (
                  <>You're about to suspend the <strong>{statusTarget.contract.kind}</strong> contract.
                  The customer will immediately lose access to features granted by this contract.
                  The contract record stays on file and can be resumed later.</>
                ) : (
                  <>Resume the <strong>{statusTarget.contract.kind}</strong> contract?
                  The customer will regain access to features granted by this contract.</>
                )}
              </p>
              <Field label={isSuspend ? 'Reason (required, written to audit log)' : 'Note (optional)'}>
                <Textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={isSuspend
                    ? 'e.g. Payment overdue 60+ days · pending dispute resolution'
                    : 'e.g. Payment received · dispute resolved'}
                />
              </Field>
              {isSuspend && (
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginTop: -4 }}>
                  This appears in the customer's audit timeline and the contract detail view.
                  Suspended contracts can be resumed or terminated later.
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={(() => {
          if (!removeTarget) return '';
          const s = _CS(removeTarget.status);
          if (s === 'SUSPENDED') return 'Terminate suspended contract';
          return 'Terminate contract';
        })()}
        width={440}
        footer={<>
          <Btn variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Btn>
          <Btn variant="danger" icon="trash" onClick={() => {
            onRemove(removeTarget);
            toast({ kind: 'warning', title: `${removeTarget.kind} contract terminated` });
            setRemoveTarget(null);
          }}>
            Terminate contract
          </Btn>
        </>}>
        {removeTarget && (() => {
          const s = _CS(removeTarget.status);
          const needsReason = s === 'ACTIVE' || s === 'SIGNED' || s === 'SUSPENDED';
          return (
            <div className="stack">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                {s === 'SUSPENDED' && (
                  <>The <strong>{removeTarget.kind}</strong> contract is currently suspended. Terminating it makes the change permanent — the contract becomes a historical record and cannot be reactivated.</>
                )}
                {(s === 'ACTIVE' || s === 'SIGNED') && (
                  <>You're about to terminate <strong>{removeTarget.kind}</strong>. The customer will lose access to features granted by this contract.</>
                )}
              </p>
              {needsReason && (
                <Field label="Reason (audit log)">
                  <Textarea rows={2} placeholder="e.g. customer requested transition to PayFac model" defaultValue="" />
                </Field>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ── Extend pilot modal ───────────────────────────────────
          Single-step. Lets admin pick +30/+60/+90 days (relative to
          today, NOT additive to current effectiveTo). Writes a
          PILOT_EXTEND event + updates effectiveTo via onUpdateContract. */}
      <ExtendPilotModal
        target={extendTarget}
        onClose={() => setExtendTarget(null)}
        onConfirm={({ days, reason }) => {
          const today = new Date();
          const newTo = new Date(today.getTime() + days * 86400000).toISOString();
          const audit = reason
            ? `Pilot extended +${days} days — reason: ${reason}`
            : `Pilot extended +${days} days`;
          onUpdateContract(
            extendTarget,
            { effectiveTo: newTo },
            audit,
            {
              eventType: 'PILOT_EXTEND',
              eventInfo: { fromEffectiveTo: extendTarget.effectiveTo, toEffectiveTo: newTo, days, reason: reason || null },
            }
          );
          toast({ kind: 'success', title: `Pilot extended +${days} days`, msg: `New expiry: ${fmtDate(newTo)}` });
          setExtendTarget(null);
        }}
      />

      {/* ── Convert pilot to active modal ────────────────────────
          2-step wizard: ack → re-enter fees. On confirm:
            - status PILOT → ACTIVE
            - effectiveFrom = today, effectiveTo = (whatever user set or null)
            - entitlements get the new fee values
            - PILOT_CONVERT event appended */}
      <ConvertPilotModal
        target={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={({ entitlements, effectiveFrom, effectiveTo }) => {
          const audit = `${convertTarget.kind} contract converted from PILOT to ACTIVE`;
          onUpdateContract(
            convertTarget,
            {
              status: 'ACTIVE',
              effectiveFrom: effectiveFrom || new Date().toISOString(),
              effectiveTo: effectiveTo || null,
              entitlements,
            },
            audit,
            {
              eventType: 'PILOT_CONVERT',
              eventInfo: {
                pilotStartedAt: convertTarget.effectiveFrom,
                newEffectiveFrom: effectiveFrom || new Date().toISOString(),
              },
            }
          );
          toast({ kind: 'success', title: 'Converted to active', msg: `${convertTarget.kind} contract is now in force.` });
          setConvertTarget(null);
        }}
      />
    </>);

};

// ─── Invite link details modal — opens after FIRST mint or REGENERATE ────────
// In v3 this is the only "big" popup. It exists because right after a link is
// minted/regenerated, the user needs to see/copy/QR-scan/email the new link —
// there's no other time the card alone isn't enough. Once closed, the
// PendingInviteCard carries all the same info inline.
const InviteLinkDetailsModal = ({ open, onClose, onSendEmail, freshlyMinted, invite, customer }) => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [justSentTo, setJustSentTo] = useState(null);

  const inviteUrl = invite?.url || '';
  const expiresLabel = React.useMemo(() => {
    if (!invite?.expiresAt) return '';
    return new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [invite?.expiresAt]);
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  React.useEffect(() => {
    if (open) {
      setEmail(invite?.recipientEmail || customer?.email || '');
      setCopied(false);
      setJustSentTo(null);
    }
  }, [open, invite, customer?.email]);

  if (!invite) return null;

  return (
    <Modal open={open} onClose={onClose} title="Admin invite link" width={580}
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>

      {/* Fresh-mint banner */}
      {freshlyMinted &&
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', marginBottom: 14,
          background: 'var(--color-success-50, var(--color-bg-3))',
          border: '1px solid oklch(58% 0.14 152 / 0.25)',
          borderRadius: 8, fontSize: 12.5, color: 'var(--color-success-700)'
        }}>
          <Icon name="check" size={13} />
          <span>
            <strong style={{ fontWeight: 600 }}>New activation link generated</strong>
            {' · expires '}<strong style={{ fontWeight: 600 }}>{expiresLabel}</strong>.
          </span>
        </div>
      }

      {/* Link + QR */}
      <div className="stack" style={{ gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
            Invite link
          </div>
          <div className="link-box">
            <Icon name="link" size={14} />
            <span className="link-box__url">{inviteUrl}</span>
            <Btn variant="secondary" size="sm" icon={copied ? 'check' : 'copy'}
              onClick={() => {
                navigator.clipboard?.writeText(inviteUrl);
                setCopied(true);
                toast({ kind: 'success', title: 'Link copied to clipboard' });
                setTimeout(() => setCopied(false), 1800);
              }}>
              {copied ? 'Copied' : 'Copy'}
            </Btn>
          </div>
        </div>
        <div className="qr-block">
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
            <rect width="92" height="92" fill="#fff" />
            {Array.from({ length: 11 * 11 }).map((_, i) => {
              const x = i % 11, y = Math.floor(i / 11);
              const filled = (x * 7 + y * 13 + (inviteUrl.charCodeAt(i % inviteUrl.length) || 0)) % 3 === 0 || x < 3 && y < 3 || x > 7 && y < 3 || x < 3 && y > 7;
              return filled ? <rect key={i} x={6 + x * 7} y={6 + y * 7} width="6" height="6" fill="#18181B" /> : null;
            })}
            <rect x="6" y="6" width="20" height="20" fill="none" stroke="#18181B" strokeWidth="2" />
            <rect x="66" y="6" width="20" height="20" fill="none" stroke="#18181B" strokeWidth="2" />
            <rect x="6" y="66" width="20" height="20" fill="none" stroke="#18181B" strokeWidth="2" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Or scan the QR code</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              The recipient will set their password and enroll 2FA before first login.
            </div>
          </div>
        </div>
      </div>

      {/* Send by email — inline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '4px 0 14px',
        color: 'var(--color-text-tertiary)',
        fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em'
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
        <span>Send by email</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
      </div>

      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefix={<Icon name="mail" size={14} />} />
          </div>
          <Btn
            variant="primary"
            icon="mail"
            disabled={!validEmail}
            onClick={() => {
              if (onSendEmail) onSendEmail(email);
              setJustSentTo(email);
              toast({ kind: 'success', title: 'Activation email sent', msg: `Sent to ${email}` });
            }}>
            Send
          </Btn>
        </div>
        {justSentTo &&
          <div style={{
            marginTop: 8, fontSize: 12,
            color: 'var(--color-success-700)',
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <Icon name="check" size={13} /> Sent to {justSentTo}.
          </div>
        }
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
          {invite?.recipientEmail
            ? <>Pre-filled with the previous recipient — edit if it should go somewhere else.</>
            : <>Pre-filled with the customer's contact email — edit if needed.</>
          }
        </div>
      </div>
    </Modal>);

};

// ─── Send invite via email — small confirm dialog ────────
// Opened from PendingInviteCard's "Send via email" button. Single email field;
// editing the recipient happens here, not on the card. Same dialog serves
// first-time send (link-only state) and re-send (recipient already on file).
const SendInviteEmailDialog = ({ open, onClose, onSend, invite, customer }) => {
  const [email, setEmail] = useState('');
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  React.useEffect(() => {
    if (open) {
      setEmail(invite?.recipientEmail || customer?.email || '');
    }
  }, [open, invite, customer?.email]);

  return (
    <Modal open={open} onClose={onClose} title="Send activation email" width={480}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="mail" disabled={!validEmail}
          onClick={() => { onSend(email); onClose(); }}>Send</Btn>
      </>}>
      <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
        The invitation link will be emailed to the address below. The link itself <strong style={{ color: 'var(--color-text-primary)' }}>doesn't change</strong> — anyone who already received it can still use the same link.
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 6, fontWeight: 500 }}>
        Recipient email
      </div>
      <Input
        type="email"
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        prefix={<Icon name="mail" size={14} />}
        autoFocus />
    </Modal>);

};

// ─── Regenerate confirm — destructive warning before minting a new link ────────
// Step 1 of the 2-step regenerate flow. Lists the concrete damage (which
// emailed link goes dead, who's affected) so the user can't fire it blindly.
// On confirm, parent mints a new token and opens InviteLinkDetailsModal.
const RegenerateConfirmDialog = ({ open, onClose, onConfirm, invite }) => {
  return (
    <Modal open={open} onClose={onClose} title="Regenerate activation link?" width={480}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="refresh" onClick={onConfirm}>Regenerate &amp; invalidate old</Btn>
      </>}>
      <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
        A new single-use link will be created with a fresh 7-day expiry.
      </div>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '11px 13px',
        background: 'var(--color-error-50, var(--color-bg-3))',
        border: '1px solid oklch(60% 0.18 25 / 0.3)',
        borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55
      }}>
        <Icon name="alert" size={14} style={{ flex: 'none', marginTop: 1, color: 'var(--color-error-700)' }} />
        <div>
          <div style={{ color: 'var(--color-error-700)', fontWeight: 600, marginBottom: 4 }}>
            The current link will stop working immediately.
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {invite?.recipientEmail
              ? <li>The email previously sent to <strong style={{ color: 'var(--color-text-primary)' }}>{invite.recipientEmail}</strong> will become useless</li>
              : <li>Anyone with the previous link will see "link expired"</li>
            }
            <li>You'll need to share the new link separately</li>
          </ul>
        </div>
      </div>
    </Modal>);

};

// ─── Operator action menu ─────────────────────────────────
const OP_ACTIONS = {
  lock: { label: 'Lock account', icon: 'shield' },
  unlock: { label: 'Unlock account', icon: 'check' },
  reset: { label: 'Reset password', icon: 'edit' },
  resend: { label: 'Resend activation', icon: 'mail' },
  remove: { label: 'Remove operator', icon: 'trash', danger: true },
  promote: { label: 'Promote to Admin', icon: 'shield' },
  'edit-email': { label: 'Change email…', icon: 'mail' }
};

const OperatorMenu = ({ op, onAction }) => {
  const isAdmin = (op.role || 'Admin') === 'Admin';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = React.useRef(null);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
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

  const pick = (a) => {setOpen(false);onAction(a);};

  return (
    <div className="opmenu-wrap">
      <button ref={btnRef} className="iconbtn" onClick={() => setOpen((o) => !o)} aria-label="Operator actions"><Icon name="more" /></button>
      {open && pos && ReactDOM.createPortal(
        <div ref={menuRef} className="opmenu" role="menu" style={{ position: 'fixed', top: pos.top, right: pos.right }}>
          {op.pending && <button className="opmenu__item" onClick={() => pick('resend')}><Icon name="mail" size={14} />{OP_ACTIONS.resend.label}</button>}
          {!op.pending && op.locked &&
            <button className="opmenu__item" onClick={() => pick('unlock')}>
              <Icon name="check" size={14} />{OP_ACTIONS.unlock.label}
            </button>
          }
          {!op.pending && !op.locked && <>
            <button className="opmenu__item" onClick={() => pick('reset')}>
              <Icon name="edit" size={14} />{OP_ACTIONS.reset.label}
            </button>
            <button className="opmenu__item" onClick={() => pick('edit-email')}>
              <Icon name="mail" size={14} />{OP_ACTIONS['edit-email'].label}
            </button>
            <button className="opmenu__item" onClick={() => pick('lock')}>
              <Icon name="shield" size={14} />{OP_ACTIONS.lock.label}
            </button>
            {!isAdmin && <>
              <div className="opmenu__sep" />
              <button className="opmenu__item" onClick={() => pick('promote')}>
                <Icon name="shield" size={14} />{OP_ACTIONS.promote.label}
              </button>
            </>}
          </>}
        </div>,
        document.body
      )}
    </div>);

};

// ─── Devices tab (sample devices + sample orders for this customer) ──
const deviceRowStatus = (order, item, dev) => {
  const activated = !!(dev.sn && dev.code && dev.code.length === 6);
  const shipped = item.shipped === true || order.status === 'Shipped' || order.status === 'Complete';
  if (!activated) return { label: 'Pending activation', tone: 'warning' };
  if (shipped) return { label: 'Deployed', tone: 'success' };
  return { label: 'Activated', tone: 'info' };
};

const TabDevices = ({ customer, orders, onOpenOrder, onNewOrder }) => {
  const [view, setView] = useState('devices'); // 'devices' | 'orders'

  const customerOrders = useMemo(
    () => orders.filter((o) => o.customerId === customer.id),
    [orders, customer.id]
  );

  // Flatten every device line across all orders for this customer
  const allDevices = useMemo(() => {
    const rows = [];
    customerOrders.forEach((o) => {
      o.items.forEach((item) => {
        item.devices.forEach((dev, idx) => {
          rows.push({
            key: `${o.id}:${item.id}:${idx}`,
            order: o,
            item,
            dev,
            slot: idx + 1,
            status: deviceRowStatus(o, item, dev)
          });
        });
        // If an item's qty exceeds its devices array length, surface remaining slots as pending
        const missing = item.qty - item.devices.length;
        for (let i = 0; i < missing; i++) {
          rows.push({
            key: `${o.id}:${item.id}:empty:${i}`,
            order: o,
            item,
            dev: { sn: '', code: '', type: item.type || '' },
            slot: item.devices.length + i + 1,
            status: { label: 'Pending activation', tone: 'warning' }
          });
        }
      });
    });
    return rows;
  }, [customerOrders]);

  // Combined stats across both worlds
  const stats = useMemo(() => {
    const totalDevices = allDevices.length;
    const activated = allDevices.filter((r) => r.dev.sn && r.dev.code && r.dev.code.length === 6).length;
    const deployed = allDevices.filter((r) => r.status.label === 'Deployed').length;
    const pending = totalDevices - activated;
    return {
      totalDevices,
      activated,
      deployed,
      pending,
      ordersTotal: customerOrders.length,
      ordersActive: customerOrders.filter((o) => o.status === 'Shipped' || o.status === 'Partially complete' || o.status === 'Awaiting shipment').length
    };
  }, [allDevices, customerOrders]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* Shared summary across both sub-views */}
      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 0 }}>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Sample devices</div>
          <div className="stat__val">{stats.totalDevices}</div>
          <div className="stat__delta">across {stats.ordersTotal} order{stats.ordersTotal === 1 ? '' : 's'}</div>
        </div>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Deployed</div>
          <div className="stat__val" style={{ color: 'var(--color-success-700)' }}>{stats.deployed}</div>
          <div className="stat__delta">activated &amp; shipped</div>
        </div>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Pending activation</div>
          <div className="stat__val" style={{ color: 'var(--color-warning-700)' }}>{stats.pending}</div>
          <div className="stat__delta">awaiting SN + code</div>
        </div>
        <div className="stat" style={{ padding: '14px 16px' }}>
          <div className="stat__label">Orders in flight</div>
          <div className="stat__val" style={{ color: 'var(--color-info-700)' }}>{stats.ordersActive}</div>
          <div className="stat__delta">unpaid or unshipped</div>
        </div>
      </div>

      <div className="info-card">
        <div className="info-card__head" style={{ padding: 0, paddingRight: 16, alignItems: 'stretch' }}>
          <div className="tds-tabs" role="tablist" style={{ border: 0, boxShadow: 'none', marginBottom: -1 }}>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'devices'}
              className={`tds-tab ${view === 'devices' ? 'tds-tab--active' : ''}`}
              onClick={() => setView('devices')}>
              Sample devices
              <span className="tds-tab__count">{stats.totalDevices}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'orders'}
              className={`tds-tab ${view === 'orders' ? 'tds-tab--active' : ''}`}
              onClick={() => setView('orders')}>
              Sample orders
              <span className="tds-tab__count">{stats.ordersTotal}</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn variant="secondary" size="sm" icon="link" onClick={() => onOpenOrder && onOpenOrder('__all__')}>View in Orders</Btn>
            <Btn variant="primary" size="sm" icon="plus" onClick={() => onNewOrder && onNewOrder(customer)}>New order</Btn>
          </div>
        </div>

        {view === 'devices' ?
        <DevicesView rows={allDevices} customer={customer} onOpenOrder={onOpenOrder} onNewOrder={onNewOrder} /> :
        <OrdersView orders={customerOrders} customer={customer} onOpenOrder={onOpenOrder} onNewOrder={onNewOrder} />
        }
      </div>
    </div>);

};

// ─── Devices sub-view ─────────────────────────────────────
const DevicesView = ({ rows, customer, onOpenOrder, onNewOrder }) => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((row) =>
      (row.dev.sn || '').toLowerCase().includes(s) ||
      (row.dev.code || '').toLowerCase().includes(s) ||
      row.item.modelName.toLowerCase().includes(s) ||
      row.order.number.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'All') r = r.filter((row) => row.status.label === statusFilter);
    return r;
  }, [rows, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (rows.length === 0) {
    return (
      <div className="empty" style={{ padding: '48px 20px' }}>
        <div style={{ marginBottom: 10, color: 'var(--color-text-secondary)' }}>No sample devices for this customer yet.</div>
        <Btn variant="secondary" size="sm" icon="plus" onClick={() => onNewOrder && onNewOrder(customer)}>Create first order</Btn>
      </div>);

  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <Input prefix={<Icon name="search" size={14} />} placeholder="Search SN, code, model or order…" value={q} onChange={(e) => {setQ(e.target.value);setPage(1);}} size="sm" />
        </div>
        <div className="tds-select tds-select--sm" style={{ width: 180 }}>
          <select value={statusFilter} onChange={(e) => {setStatusFilter(e.target.value);setPage(1);}}>
            <option>All</option>
            <option>Pending activation</option>
            <option>Activated</option>
            <option>Deployed</option>
          </select>
          <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
        </div>
      </div>

      <table className="tds-table">
        <colgroup>
          <col style={{ width: '1%' }} />
          <col />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '40px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ whiteSpace: 'nowrap' }}>SN</th>
            <th>Model</th>
            <th style={{ whiteSpace: 'nowrap' }}>Activation code</th>
            <th style={{ whiteSpace: 'nowrap' }}>Status</th>
            <th style={{ whiteSpace: 'nowrap' }}>Source order</th>
            <th style={{ textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ?
          <tr><td colSpan="6"><div className="empty">No devices match your filters.</div></td></tr> :
          pageRows.map((row) =>
          <tr key={row.key} onClick={() => onOpenOrder(row.order.id)} style={{ cursor: 'pointer' }}>
              <td style={{ whiteSpace: 'nowrap' }}>
                {row.dev.sn ?
              <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{row.dev.sn}</div> :
              <div className="muted" style={{ fontSize: 12.5 }}>— not assigned —</div>}
              </td>
              <td>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{row.item.modelName}</div>
                <div className="cust-meta">{row.dev.type || row.item.type}</div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {row.dev.code ?
              <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, letterSpacing: 1 }}>{row.dev.code}</code> :
              <span className="muted" style={{ fontSize: 12.5 }}>—</span>}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <Badge tone={row.status.tone} dot>{row.status.label}</Badge>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, color: 'var(--color-primary-600)' }}>{row.order.number}</div>
                <div className="cust-meta">{fmtDate(row.order.createdAt)}</div>
              </td>
              <td style={{ textAlign: 'right' }}>
                <button className="iconbtn" onClick={(e) => {e.stopPropagation();onOpenOrder(row.order.id);}}>
                  <Icon name="chevR" size={14} />
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 &&
      <div className="table-foot">
          <div className="table-foot__meta">
            Showing <strong>{pageRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</strong>–<strong>{(page - 1) * pageSize + pageRows.length}</strong> of <strong>{filtered.length}</strong>
          </div>
          <div className="tds-pagination">
            <button className="tds-pagination__page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon name="chevL" size={12} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
          <button key={p} className={`tds-pagination__page ${p === page ? 'tds-pagination__page--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          )}
            <button className="tds-pagination__page" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><Icon name="chevR" size={12} /></button>
          </div>
        </div>
      }
    </>);

};

// ─── Orders sub-view ──────────────────────────────────────
const OrdersView = ({ orders, customer, onOpenOrder, onNewOrder }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    let rows = orders;
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((o) =>
      o.number.toLowerCase().includes(s) ||
      o.items.some((i) => i.modelName.toLowerCase().includes(s))
      );
    }
    if (status === 'In transit') rows = rows.filter((o) => o.status === 'Shipped' || o.status === 'Partially complete');else
    if (status !== 'All') rows = rows.filter((o) => o.status === status);
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy],bv = b[sortBy];
      const r = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
    return rows;
  }, [orders, q, status, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const sortCell = (key, label) =>
  <span className="tds-table__sort" onClick={() => {
    if (sortBy === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');else
    {setSortBy(key);setSortDir('asc');}
  }}>
      {label}
      <span style={{ opacity: sortBy === key ? 1 : 0.3, fontSize: 9 }}>{sortBy === key && sortDir === 'asc' ? '▲' : '▼'}</span>
    </span>;


  if (orders.length === 0) {
    return (
      <div className="empty" style={{ padding: '48px 20px' }}>
        <div style={{ marginBottom: 10, color: 'var(--color-text-secondary)' }}>No sample orders for this customer yet.</div>
        <Btn variant="secondary" size="sm" icon="plus" onClick={() => onNewOrder && onNewOrder(customer)}>Create first order</Btn>
      </div>);

  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <Input prefix={<Icon name="search" size={14} />} placeholder="Search order # or model…" value={q} onChange={(e) => {setQ(e.target.value);setPage(1);}} size="sm" />
        </div>
        <div className="tds-select tds-select--sm" style={{ width: 160 }}>
          <select value={status} onChange={(e) => {setStatus(e.target.value);setPage(1);}}>
            <option>All</option>
            {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
            <option>In transit</option>
          </select>
          <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
        </div>
      </div>

      <table className="tds-table">
        <colgroup>
          <col style={{ width: '1%' }} />
          <col />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '1%' }} />
          <col style={{ width: '40px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ whiteSpace: 'nowrap' }}>{sortCell('number', 'Order')}</th>
            <th>Models &amp; units</th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
            <th style={{ whiteSpace: 'nowrap' }}>{sortCell('status', 'Status')}</th>
            <th style={{ whiteSpace: 'nowrap' }}>{sortCell('createdAt', 'Created')}</th>
            <th style={{ textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ?
          <tr><td colSpan="6"><div className="empty">No orders match your filters.</div></td></tr> :
          pageRows.map((o) => {
            const prog = deviceProgress(o);
            const showProgress = o.status === 'Awaiting shipment';
            return (
              <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: 'pointer' }}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{o.number}</div>
                </td>
                <td>
                  {o.items.slice(0, 2).map((i, idx) =>
                  <div key={idx} style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{i.modelName}</span>
                      <span style={{ marginLeft: 6 }}>× {i.qty}</span>
                    </div>
                  )}
                  {o.items.length > 2 ?
                  <div className="cust-meta">+{o.items.length - 2} more · {orderQty(o)} units total</div> :
                  o.items.length > 1 ?
                  <div className="cust-meta">{orderQty(o)} units total</div> :
                  null}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="num">
                  <div>
                    {orderTotal(o) === 0 ?
                    <span style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>Free</span> :
                    moneyUSD(orderTotal(o))}
                  </div>
                  {o.discountPct > 0 &&
                  <div className="cust-meta" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                      <Icon name="gift" size={10} style={{ verticalAlign: '-1px' }} />
                      {o.discountPct === 100 ? 'Complimentary' : `${o.discountPct}% off`}
                    </div>
                  }
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <Badge tone={ORDER_STATUS_TONE[o.status] || 'neutral'} dot>{o.status}</Badge>
                    {showProgress && prog.total > 0 &&
                    <div className="cust-meta num" title="Devices activated / total">
                        {prog.done}/{prog.total} activated
                      </div>
                    }
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 13 }}>{fmtDate(o.createdAt)}</div>
                  <div className="cust-meta">{relTime(o.createdAt)}</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn" onClick={(e) => {e.stopPropagation();onOpenOrder(o.id);}}>
                    <Icon name="chevR" size={14} />
                  </button>
                </td>
              </tr>);

          })}
        </tbody>
      </table>

      {totalPages > 1 &&
      <div className="table-foot">
          <div className="table-foot__meta">
            Showing <strong>{pageRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</strong>–<strong>{(page - 1) * pageSize + pageRows.length}</strong> of <strong>{filtered.length}</strong>
          </div>
          <div className="tds-pagination">
            <button className="tds-pagination__page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon name="chevL" size={12} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
          <button key={p} className={`tds-pagination__page ${p === page ? 'tds-pagination__page--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          )}
            <button className="tds-pagination__page" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><Icon name="chevR" size={12} /></button>
          </div>
        </div>
      }
    </>);

};

// ─── Roles tab (system + custom) ─────────────────────────
// Returns the set of customer contracts a role effectively applies to,
// given this customer's currently active contract kinds.
const computeRoleAllowed = (role, activeKinds) => {
  // Legacy support (deny/allow lists) — kept as a safety net for any role
  // still using the old shape (e.g. customer-local custom roles created
  // before the schema change).
  if (role.contractsAllowed !== undefined) {
    const sel = role.contractsAllowed || [];
    const mode = role.contractMode || 'allow';
    const all = mode === 'allow' ? sel : ALL_CONTRACT_KINDS.filter((k) => !sel.includes(k));
    return all.filter((k) => !activeKinds || activeKinds.includes(k));
  }
  // New shape: single contractDefineCode (null = applies to all the customer's contracts)
  if (role.contractDefineCode === null || role.contractDefineCode === undefined) {
    return activeKinds ? [...activeKinds] : [];
  }
  // Specific contract — only effective if the customer holds it
  return activeKinds && activeKinds.includes(role.contractDefineCode) ?
  [role.contractDefineCode] :
  [];
};

const TabRoles = ({ customer, onUpdate, systemRoles }) => {
  // System roles come from the App-level shared state so edits in
  // Customer Role Definitions are reflected here immediately. Fall back to
  // window.SEED_ROLES if mounted standalone (e.g. in tests).
  const seedRoles = systemRoles || SEED_ROLES;
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // custom role being edited
  const [confirmDel, setConfirmDel] = useState(null);
  const [blockConfirm, setBlockConfirm] = useState(null);
  const [permsPreview, setPermsPreview] = useState(null);

  const activeKinds = customer.contracts.map((c) => c.kind);
  const activeSet = new Set(activeKinds);

  const denied = new Set(customer.deniedRoles || []);
  const customRoles = customer.customRoles || [];

  // System roles whose effective allowed-contracts intersect this customer's active contracts.
  // We also exclude ADMIN-contract roles entirely — those are platform-staff-only.
  const visibleSystem = seedRoles.
  filter((r) => r.contractDefineCode !== 'ADMIN' && (r.roleType || 'global') === 'global').
  map((r) => {
    const scope = computeRoleAllowed(r, activeKinds);
    return { ...r, _scope: scope };
  }).
  filter((r) => r._scope.length > 0);

  const toggleDeny = (rid, name) => {
    const next = new Set(denied);
    const wasDenied = next.has(rid);
    if (wasDenied) next.delete(rid);else next.add(rid);
    onUpdate({
      ...customer,
      deniedRoles: [...next],
      events: [...customer.events, {
        at: new Date().toISOString(), kind: 'role',
        by: 'admin@carbon',
        text: `${wasDenied ? 'Unblocked' : 'Blocked'} system role "${name}" for this customer`
      }]
    });
    toast(wasDenied ? `"${name}" re-enabled` : `"${name}" blocked for this customer`);
  };

  const saveCustomRole = (role) => {
    const exists = customRoles.find((r) => r.id === role.id);
    const next = exists ?
    customRoles.map((r) => r.id === role.id ? role : r) :
    [...customRoles, role];
    onUpdate({
      ...customer,
      customRoles: next,
      events: [...customer.events, {
        at: new Date().toISOString(), kind: 'role',
        by: 'admin@carbon',
        text: `${exists ? 'Updated' : 'Added'} custom role "${role.name}"`
      }]
    });
    toast(`Custom role "${role.name}" saved`);
    setEditing(null);
    setShowAdd(false);
  };

  const deleteCustomRole = (role) => {
    onUpdate({
      ...customer,
      customRoles: customRoles.filter((r) => r.id !== role.id),
      events: [...customer.events, {
        at: new Date().toISOString(), kind: 'role',
        by: 'admin@carbon',
        text: `Removed custom role "${role.name}"`
      }]
    });
    toast(`Custom role "${role.name}" removed`);
    setConfirmDel(null);
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* System roles */}
      <div className="info-card">
        <div className="info-card__head">
          <div>
            <div className="info-card__title">System roles</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              All system-defined roles whose contract scope overlaps this customer's contracts. Blacklist any role to prevent it from being assigned to operators here.
            </div>
          </div>
        </div>

        {activeKinds.length === 0 &&
        <div className="empty" style={{ padding: '40px 20px' }}>
            No active contracts yet. Roles will appear here once a contract is signed.
          </div>
        }

        {activeKinds.length > 0 && visibleSystem.length === 0 &&
        <div className="empty" style={{ padding: '40px 20px' }}>
            No system roles match this customer's contract types.
          </div>
        }

        <div>
          {visibleSystem.map((r) => {
            const isDenied = denied.has(r.id);
            return (
              <div key={r.id} className={`crow cust-role-row ${isDenied ? 'is-denied' : ''}`}>
                <div className="pick-card__icon" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-bg-3)', color: 'var(--color-text-secondary)' }}>
                  <Icon name="shield" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                    {isDenied && <Badge tone="error">Blocked</Badge>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 11.5 }}>Scope:</span>
                    {r._scope.map((k) =>
                    <span key={k} className={`perm-chip perm-chip--${k.toLowerCase()}`}>{k}</span>
                    )}
                  </div>
                </div>
                <Btn variant={isDenied ? 'primary' : 'ghost'} size="sm" icon={isDenied ? 'check' : 'x'} onClick={() => isDenied ? toggleDeny(r.id, r.name) : setBlockConfirm({ rid: r.id, name: r.name })}>
                  {isDenied ? 'Unblock' : 'Block'}
                </Btn>
              </div>);

          })}
        </div>
      </div>

      {/* Custom roles */}
      <div className="info-card">
        <div className="info-card__head">
          <div>
            <div className="info-card__title">Custom roles</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Customer-specific roles. Only visible to operators of <strong>{customer.name}</strong>.
            </div>
          </div>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => {setEditing(null);setShowAdd(true);}}>Add custom role</Btn>
        </div>
        <div>
          {customRoles.length === 0 ?
          <div className="empty" style={{ padding: '32px 20px' }}>
              No custom roles. Add one to extend permissions beyond the system roles.
            </div> :
          customRoles.map((r) =>
          <div key={r.id} className="crow">
              <div className="pick-card__icon" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}>
                <Icon name="star" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                  <Badge tone="info">Custom</Badge>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.description || 'No description'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {(() => {
                  const scope = computeRoleAllowed(r, activeKinds);
                  if (scope.length === 0) return null;
                  return <>
                      <span className="muted" style={{ fontSize: 11.5 }}>Scope:</span>
                      {r.contractDefineCode === null && scope.length > 1 ?
                    <span className="role-item__contract role-item__contract--generic">all contracts</span> :
                    scope.map((k) =>
                    <span key={k} className={`perm-chip perm-chip--${k.toLowerCase()}`}>{k}</span>
                    )}
                    </>;
                })()}
                </div>
              </div>
              <Btn variant="ghost" size="sm" icon="edit" onClick={() => {setEditing(r);setShowAdd(true);}}>Edit</Btn>
              <Btn variant="ghost" size="sm" icon="trash" onClick={() => setConfirmDel(r)}>Remove</Btn>
            </div>
          )}
        </div>
      </div>

      <CustomRoleModal
        open={showAdd}
        onClose={() => {setShowAdd(false);setEditing(null);}}
        onSave={saveCustomRole}
        role={editing}
        activeKinds={activeKinds}
        customerName={customer.name}
        customerId={customer.id}
        customRoles={customRoles}
        systemRoles={seedRoles} />
      

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Remove custom role?" width={420}
      footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>Cancel</Btn>
          <Btn variant="danger" size="sm" icon="trash" onClick={() => deleteCustomRole(confirmDel)}>Remove role</Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          <strong>{confirmDel?.name}</strong> will be removed from this customer. Operators using it will fall back to <strong>Viewer</strong>.
        </p>
      </Modal>

      <Modal open={!!blockConfirm} onClose={() => setBlockConfirm(null)} title="Block this role?" width={440}
      footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setBlockConfirm(null)}>Cancel</Btn>
          <Btn variant="danger" size="sm" icon="x" onClick={() => {toggleDeny(blockConfirm.rid, blockConfirm.name);setBlockConfirm(null);}}>Block role</Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Blocking <strong>{blockConfirm?.name}</strong> means it can no longer be assigned to any operator at <strong>{customer.name}</strong>. Operators currently holding this role will lose access immediately.
        </p>
        <div className="notice" style={{ marginTop: 14 }}>
          <Icon name="info" size={14} />
          <span>You can unblock the role at any time — no data is deleted.</span>
        </div>
      </Modal>

      <Modal open={!!permsPreview} onClose={() => setPermsPreview(null)} title={permsPreview ? `${permsPreview.name} — permissions` : ''} width={560}
      footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setPermsPreview(null)}>Close</Btn>
        </>}>
        {permsPreview && (() => {
          const ownedIds = new Set(permsPreview.permissions || []);
          const ownedScope = permsPreview._scope && permsPreview._scope.length ?
          permsPreview._scope :
          computeRoleAllowed(permsPreview, activeKinds);
          // Group all owned permissions under PERMISSION_GROUPS structure
          const grouped = PERMISSION_GROUPS.map((g) => ({
            ...g,
            items: g.items.filter((it) => ownedIds.has(it.id))
          })).filter((g) => g.items.length > 0);
          return (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                {permsPreview.description || 'System-defined role.'}
              </div>
              {ownedScope.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>Effective on this customer:</span>
                  {ownedScope.map((k) => <span key={k} className={`perm-chip perm-chip--${k.toLowerCase()}`}>{k}</span>)}
                </div>
              }
              {grouped.length === 0 && <div className="empty">No permissions granted.</div>}
              <div className="perm-preview">
                {grouped.map((g) =>
                <div key={g.id} className="perm-preview__group">
                    <div className="perm-preview__grouphead">
                      <span>{g.label}</span>
                      <span className="perm-preview__count">{g.items.length}</span>
                    </div>
                    <ul className="perm-preview__list">
                      {g.items.map((it) =>
                    <li key={it.id} className="perm-preview__item">
                          <div className="perm-preview__check"><Icon name="check" size={11} /></div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="perm-preview__lbl">
                              {it.label}
                              <code className="perm-preview__id">{it.id}</code>
                            </div>
                            <div className="perm-preview__desc">{it.desc}</div>
                          </div>
                        </li>
                    )}
                    </ul>
                  </div>
                )}
              </div>
            </div>);

        })()}
      </Modal>
    </div>);

};

const CustomRoleModal = ({ open, onClose, onSave, role, activeKinds, customerName, customRoles = [], customerId, systemRoles }) => {
  const seedRoles = systemRoles || SEED_ROLES;
  // Custom roles are PRIVATE to this customer and always bound to ONE of the
  // contract types the customer holds. They can never be "Generic" — that
  // semantics belongs to platform-level common roles in SEED_ROLES.
  const customerKinds = (activeKinds || []).filter((k) => k !== 'ADMIN');
  const defaultContract = customerKinds[0] || null;
  const blankDraft = () => ({
    id: 'cr-' + Math.random().toString(36).slice(2, 7),
    name: '',
    description: '',
    roleType: 'private',
    entityId: customerId || null,
    contractDefineCode: defaultContract,
    permissions: [],
    builtin: false,
    operatorCount: 0
  });
  const [draft, setDraft] = useState(role || blankDraft());
  const [copyFromId, setCopyFromId] = useState('');
  React.useEffect(() => {setDraft(role || blankDraft());setCopyFromId(''); /* eslint-disable-next-line */}, [open, role]);

  if (!open) return null;

  const copyFrom = (srcId) => {
    setCopyFromId(srcId);
    if (!srcId) return;
    const src = [...seedRoles, ...customRoles].find((r) => r.id === srcId);
    if (!src) return;
    // Keep the current draft's contract — the picker upstream already
    // restricts sources to this contract, so permissions copy cleanly.
    const validPerms = (src.permissions || []).filter((pid) =>
    permAppliesToContract(pid, draft.contractDefineCode)
    );
    setDraft((d) => ({
      ...d,
      description: d.description || src.description || '',
      permissions: validPerms
    }));
  };

  const togglePerm = (id) => {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(id) ?
      d.permissions.filter((p) => p !== id) :
      [...d.permissions, id]
    }));
  };

  const setContract = (code) => {
    setDraft((d) => {
      const nextPerms = d.permissions.filter((pid) => permAppliesToContract(pid, code));
      return { ...d, contractDefineCode: code, permissions: nextPerms };
    });
  };

  // Permission menus visible under the chosen contract (null = generic only)
  const groups = permissionGroupsForContract(draft.contractDefineCode).
  filter((g) => g.contractDefineCode !== 'ADMIN'); // never show platform-only menus here

  const valid = draft.name.trim().length > 0 && activeKinds.length > 0;

  return (
    <Modal open={open} onClose={onClose} title={role ? 'Edit custom role' : `Add custom role for ${customerName}`} width={660}
    footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" icon="check" onClick={() => onSave(draft)} disabled={!valid}>Save role</Btn>
      </>}>
      <div className="stack" style={{ gap: 14 }}>
        {!role && (() => {
          // Filter Copy-from sources by the current draft contract so the
          // operator never copies a role whose permissions get half-stripped.
          const compatibleSeed = seedRoles.filter((r) =>
          r.contractDefineCode !== 'ADMIN' &&
          r.contractDefineCode === draft.contractDefineCode);
          const compatibleCustom = customRoles.filter((r) =>
          r.contractDefineCode === draft.contractDefineCode);
          const hasAny = compatibleSeed.length + compatibleCustom.length > 0;
          return (
            <Field label="Copy from"
            hint={hasAny ?
            `Optional — seed permissions from an existing ${draft.contractDefineCode || 'compatible'} role.` :
            `No existing ${draft.contractDefineCode || ''} roles to copy from. Start blank.`}>
              <div className="tds-select tds-select--md">
                <select value={copyFromId} onChange={(e) => copyFrom(e.target.value)} disabled={!hasAny}>
                  <option value="">— Start blank —</option>
                  {compatibleSeed.length > 0 &&
                  <optgroup label="System roles">
                      {compatibleSeed.map((r) =>
                    <option key={r.id} value={r.id}>{r.name} · {r.permissions.length} perms</option>
                    )}
                    </optgroup>
                  }
                  {compatibleCustom.length > 0 &&
                  <optgroup label="This customer's custom roles">
                      {compatibleCustom.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.permissions.length} perms</option>)}
                    </optgroup>
                  }
                </select>
                <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
              </div>
            </Field>);

        })()}
        <Field label="Role name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Onboarding Specialist" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this role is for…" />
        </Field>

        <Field label="Contract type" required
        hint="This role applies to one contract only. Permissions below are filtered accordingly.">
          {customerKinds.length === 0 ?
          <span className="muted" style={{ fontSize: 12 }}>No active contracts yet.</span> :
          customerKinds.length === 1 ?
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`perm-fchip perm-fchip--${customerKinds[0].toLowerCase()} is-on`}>{customerKinds[0]}</span>
              <span className="muted" style={{ fontSize: 12 }}>· only contract on this customer</span>
            </div> :

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {customerKinds.map((k) => {
              const on = draft.contractDefineCode === k;
              return (
                <button key={k} type="button"
                className={`perm-fchip perm-fchip--${k.toLowerCase()} ${on ? 'is-on' : ''}`}
                onClick={() => setContract(k)}>{k}</button>);

            })}
            </div>
          }
        </Field>

        <Field label={`Permissions (${draft.permissions.length} selected)`}>
          <div className="cust-role-perms">
            {groups.length === 0 &&
            <div className="muted" style={{ fontSize: 12, padding: 12 }}>
                No permissions available for this contract type.
              </div>
            }
            {groups.map((g) =>
            <details key={g.id} className="cust-role-perms__group">
                <summary>
                  <Icon name="chevR" size={12} />
                  <span>{g.label}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {g.items.filter((i) => draft.permissions.includes(i.id)).length}/{g.items.length}
                  </span>
                </summary>
                <div>
                  {g.items.map((it) => {
                  const on = draft.permissions.includes(it.id);
                  return (
                    <label key={it.id} className={`cust-role-perms__row ${on ? 'is-on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => togglePerm(it.id)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{it.label}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>{it.desc}</div>
                        </div>
                      </label>);

                })}
                </div>
              </details>
            )}
          </div>
        </Field>
      </div>
    </Modal>);

};

// ─── Transfer Admin modal ─────────────────────────────────
const TransferAdminModal = ({ open, onClose, operators, onTransfer }) => {
  const [selected, setSelected] = useState(null);
  React.useEffect(() => { if (open) setSelected(null); }, [open]);
  const adminIdx = (operators || []).findIndex((o) => (o.role || 'Admin') === 'Admin');
  const admin = adminIdx >= 0 ? operators[adminIdx] : null;
  const candidates = (operators || [])
    .map((o, i) => ({ op: o, idx: i }))
    .filter((entry) => entry.idx !== adminIdx && !entry.op.pending);
  const target = selected != null ? operators[selected] : null;

  return (
    <Modal open={open} onClose={onClose} title="Transfer Admin role" width={560}
      footer={candidates.length === 0 ?
        <Btn variant="primary" icon="check" onClick={onClose}>Got it</Btn> :
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="refresh" disabled={selected == null} onClick={() => onTransfer(selected)}>
            Transfer Admin role
          </Btn>
        </>
      }>
      {admin &&
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', marginBottom: 14,
          background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 8
        }}>
          <CompanyLogo name={admin.name || admin.email} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Current Admin</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{admin.name || <span className="muted" style={{ fontStyle: 'italic', fontWeight: 400 }}>Not yet provided</span>}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{admin.email}</div>
          </div>
          <Icon name="arrowR" size={18} />
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-bg-1)', border: '1px dashed var(--color-border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)' }}>
            ?
          </div>
        </div>
      }

      {candidates.length === 0 ?
        <div style={{ padding: '16px 14px', background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Icon name="info" size={14} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>No eligible operators</div>
              <div>The Admin can only be transferred to an existing operator on this customer. Ask the current Admin ({admin?.email}) to invite an operator first, then come back to transfer the role.</div>
            </div>
          </div>
        </div> :
        <>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Choose a new Admin
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {candidates.map(({ op, idx }) => {
              const isSel = selected === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelected(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: isSel ? 'var(--color-info-50, var(--color-bg-3))' : 'var(--color-bg-1)',
                    border: `1px solid ${isSel ? 'var(--color-info-700, var(--color-border-subtle))' : 'var(--color-border-subtle)'}`,
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%'
                  }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: `2px solid ${isSel ? 'var(--color-info-700, var(--color-text-secondary))' : 'var(--color-border-subtle)'}`,
                    background: isSel ? 'var(--color-info-700, var(--color-text-secondary))' : 'transparent',
                    boxShadow: isSel ? 'inset 0 0 0 3px var(--color-bg-1)' : 'none',
                    flexShrink: 0
                  }} />
                  <CompanyLogo name={op.name || op.email} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{op.name || <span className="muted" style={{ fontStyle: 'italic', fontWeight: 400 }}>Not yet provided</span>}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{op.email}</div>
                  </div>
                  <Badge tone="neutral">{op.role || 'Operator'}</Badge>
                </button>
              );
            })}
          </div>
          {target &&
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--color-warning-50, var(--color-bg-3))', border: '1px solid var(--color-warning-200, var(--color-border-subtle))', borderRadius: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Icon name="info" size={13} />
                <div>
                  After transfer: <strong style={{ color: 'var(--color-text-primary)' }}>{target.name || target.email}</strong> becomes the Admin, and <strong style={{ color: 'var(--color-text-primary)' }}>{admin?.name || admin?.email}</strong> is demoted to Operator. The previous Admin keeps the account and can sign in, but loses Admin-only powers (inviting operators, transferring the role).
                </div>
              </div>
            </div>
          }
        </>
      }
    </Modal>
  );
};

// ─── Pending invite card (v3: fixed action set, expired disables Copy/Send) ──
// Fixed button order across all states: Copy link · Send via email · Regenerate · Revoke.
// View details is gone — the card already shows everything you need to know.
// Editing the recipient happens inside the Send via email dialog, not here.
const PendingInviteCard = ({ invite, status, onCopy, onSendEmail, onRegenerate, onRevoke }) => {
  const expiresLabel = invite?.expiresAt
    ? new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const generatedLabel = invite?.generatedAt ? relTime(invite.generatedAt) : '—';
  const isExpired = invite?.expiresAt ? new Date(invite.expiresAt).getTime() < Date.now() : false;
  const expiresWhen = invite?.expiresAt ? relTime(invite.expiresAt) : '';
  const hasRecipient = !!invite?.recipientEmail;
  return (
    <div style={{
      border: `1px solid ${isExpired ? 'var(--color-error-200, var(--color-border-subtle))' : 'var(--color-border-subtle)'}`,
      borderRadius: 12,
      background: isExpired ? 'var(--color-error-50, var(--color-bg-2, var(--color-bg-1)))' : 'var(--color-bg-2, var(--color-bg-1))',
      padding: 18,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start'
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: isExpired
          ? 'var(--color-error-100, var(--color-bg-3))'
          : hasRecipient ? 'var(--color-warning-50, var(--color-bg-3))' : 'var(--color-bg-3)',
        color: isExpired
          ? 'var(--color-error-700, var(--color-text-secondary))'
          : hasRecipient ? 'var(--color-warning-700, var(--color-text-secondary))' : 'var(--color-text-secondary)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        border: `1px solid ${
          isExpired ? 'var(--color-error-200, var(--color-border-subtle))'
            : hasRecipient ? 'var(--color-warning-200, var(--color-border-subtle))' : 'var(--color-border-subtle)'
        }`
      }}>
        <Icon name={isExpired ? 'alert' : 'link'} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {isExpired ? 'Admin activation link expired' : 'Admin activation link issued'}
          </div>
          {isExpired
            ? <Badge tone="error" dot>Expired</Badge>
            : <Badge tone="warning" dot>Awaiting activation</Badge>}
          {!isExpired && !hasRecipient && <Badge tone="neutral">Link-only</Badge>}
          {status === 'Onboarding' && <Badge tone="info" dot>Onboarding</Badge>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
          {hasRecipient
            ? <>Recipient: <strong style={{ color: 'var(--color-text-primary)' }}>{invite.recipientEmail}</strong></>
            : <>No recipient email recorded — link shared manually.</>}
          <br />
          Generated {generatedLabel} by <span style={{ color: 'var(--color-text-secondary)' }}>{maskEmail(invite?.generatedBy || 'admin@carbon')}</span> ·{' '}
          {isExpired
            ? <>expired <strong style={{ color: 'var(--color-error-700, var(--color-text-primary))' }}>{expiresWhen}</strong> ({expiresLabel}).</>
            : <>expires <strong style={{ color: 'var(--color-text-primary)' }}>{expiresLabel}</strong>.</>
          }
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', background: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-subtle)', borderRadius: 8,
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 12, color: 'var(--color-text-secondary)',
          marginBottom: 12, overflow: 'hidden',
          opacity: isExpired ? 0.55 : 1,
          textDecoration: isExpired ? 'line-through' : 'none'
        }}>
          <Icon name="link" size={13} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite?.url}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.55, marginBottom: 14 }}>
          {isExpired
            ? <>The link is no longer valid. Anyone who tries it will see <em style={{ color: 'var(--color-error-700)', fontStyle: 'normal' }}>"link expired"</em>. <strong style={{ color: 'var(--color-text-secondary)' }}>Regenerate</strong> to issue a fresh link, or <strong style={{ color: 'var(--color-text-secondary)' }}>Revoke</strong> to cancel the invitation entirely.</>
            : <>An operator will be created when the recipient sets a password and enrolls 2FA. The customer will move to <strong style={{ color: 'var(--color-text-secondary)' }}>Active</strong> at that moment.</>
          }
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn variant="secondary" size="sm" icon="copy" disabled={isExpired} onClick={onCopy}>Copy link</Btn>
          <Btn variant="secondary" size="sm" icon="mail" disabled={isExpired} onClick={onSendEmail}>Send via email</Btn>
          <div style={{ width: 1, height: 18, background: 'var(--color-border-subtle)', margin: '0 2px' }} />
          <Btn variant="ghost" size="sm" icon="refresh" onClick={onRegenerate}>Regenerate</Btn>
          <Btn variant="ghost" size="sm" icon="trash" onClick={onRevoke}>Revoke</Btn>
        </div>
      </div>
    </div>);

};

// ─── Operators tab ────────────────────────────────────────
const TabOperators = ({ customer, onUpdate, maskOn, setMaskOn }) => {
  const toast = useToast();
  const [revealed, setRevealed] = useState({});
  // v3 invite flow state:
  //   inviteDetailsOpen  — big modal (link + QR + inline email) shown ONLY after
  //                        first mint or after regenerate
  //   inviteFreshlyMinted — toggles the green "new link generated" banner in
  //                        the details modal; cleared when the modal closes
  //   sendEmailOpen      — small Send-via-email confirm dialog (from card)
  //   regenConfirmOpen   — destructive Regenerate warning (from card)
  const [inviteDetailsOpen, setInviteDetailsOpen] = useState(false);
  const [inviteFreshlyMinted, setInviteFreshlyMinted] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { op, action }
  const [emailEdit, setEmailEdit] = useState(null); // { op, idx, value, error }
  const toggle = (idx, field) => {
    setRevealed((r) => ({ ...r, [`${idx}.${field}`]: !r[`${idx}.${field}`] }));
    if (!revealed[`${idx}.${field}`]) toast({ kind: 'info', title: 'Sensitive field revealed', msg: 'This action is recorded in the audit log.' });
  };

  const mintInvite = () => {
    const token = Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 6);
    return {
      token,
      url: `https://app.carbon.toms/invite/${token}`,
      expiresAt: new Date(Date.now() + 7 * 86400e3).toISOString()
    };
  };

  // Start (or resume) an Admin invite. If no pendingInvite exists, mint and
  // persist one first; then open the InviteLinkDetailsModal with the fresh
  // banner. After the user closes the modal, the PendingInviteCard takes over
  // and all subsequent actions go through the small per-action dialogs.
  const startInvite = () => {
    if (!customer.pendingInvite) {
      const nowIso = new Date().toISOString();
      const minted = mintInvite();
      onUpdate({
        ...customer,
        pendingInvite: {
          token: minted.token,
          url: minted.url,
          role: 'Admin',
          method: 'link',
          recipientEmail: null,
          generatedAt: nowIso,
          expiresAt: minted.expiresAt,
          generatedBy: 'admin@carbon'
        },
        events: [
          ...customer.events,
          { at: nowIso, kind: 'operator+', by: 'admin@carbon', text: 'Admin activation link generated' }
        ]
      });
    }
    setInviteFreshlyMinted(true);
    setInviteDetailsOpen(true);
  };

  // Copy current invite link straight to clipboard — no modal, just a toast.
  // Called from PendingInviteCard's first action button.
  const handleCopyLink = () => {
    if (!customer.pendingInvite?.url) return;
    navigator.clipboard?.writeText(customer.pendingInvite.url);
    toast({ kind: 'success', title: 'Link copied to clipboard' });
  };

  // Email the existing invite link to a recipient. Records the audit event
  // and persists `method` + `recipientEmail` on the pending invite. Called
  // from SendInviteEmailDialog's onSend.
  const handleSendEmail = (email) => {
    if (!customer.pendingInvite || !email) return;
    const nowIso = new Date().toISOString();
    onUpdate({
      ...customer,
      pendingInvite: {
        ...customer.pendingInvite,
        method: 'email',
        recipientEmail: email
      },
      events: [
        ...customer.events,
        { at: nowIso, kind: 'operator+', by: 'admin@carbon', text: `Admin invite emailed to ${email}` }
      ]
    });
    toast({ kind: 'success', title: 'Activation email sent', msg: `Sent to ${email}` });
  };

  // Step 2 of the regenerate flow: actually mint the new token. Step 1 (the
  // destructive warning) lives in RegenerateConfirmDialog and just calls this
  // on confirm. After regeneration we open the details modal with the fresh
  // banner so the user can immediately copy/QR/email the new link.
  const handleRegenerateInvite = () => {
    const nowIso = new Date().toISOString();
    const minted = mintInvite();
    const oldToken = customer.pendingInvite?.token;
    const events = [...customer.events];
    if (oldToken) {
      events.push({ at: nowIso, kind: 'warn', by: 'admin@carbon', text: `Previous Admin invite revoked · token ${oldToken.slice(-4)}` });
    }
    events.push({ at: nowIso, kind: 'operator+', by: 'admin@carbon', text: 'Admin activation link regenerated' });
    onUpdate({
      ...customer,
      pendingInvite: {
        token: minted.token,
        url: minted.url,
        role: 'Admin',
        method: 'link',
        recipientEmail: null,
        generatedAt: nowIso,
        expiresAt: minted.expiresAt,
        generatedBy: 'admin@carbon'
      },
      events
    });
    setRegenConfirmOpen(false);
    setInviteFreshlyMinted(true);
    setInviteDetailsOpen(true);
  };

  const handleRevokeInvite = () => {
    const nowIso = new Date().toISOString();
    const oldToken = customer.pendingInvite?.token;
    const events = [...customer.events];
    if (oldToken) {
      events.push({ at: nowIso, kind: 'warn', by: 'admin@carbon', text: `Admin invite revoked · token ${oldToken.slice(-4)}` });
    }
    onUpdate({ ...customer, pendingInvite: null, events });
    toast({ kind: 'warning', title: 'Invite revoked', msg: 'The activation link is no longer valid.' });
    setConfirm(null);
  };

  const handleOpAction = (op, idx, action) => {
    if (action === 'remove' || action === 'lock' || action === 'unlock' || action === 'promote') {setConfirm({ op, idx, action });return;}
    if (action === 'edit-email') {setEmailEdit({ op, idx, value: op.email || '', error: null });return;}
    if (action === 'reset') toast({ kind: 'success', title: 'Password reset email sent', msg: `Sent to ${op.email}` });
    if (action === 'resend') toast({ kind: 'success', title: 'Activation link resent', msg: `Sent to ${op.email}` });
  };

  const handleTransferAdmin = (targetIdx) => {
    const adminIdx = customer.operators.findIndex((o) => (o.role || 'Admin') === 'Admin');
    if (adminIdx < 0 || targetIdx == null || targetIdx === adminIdx) return;
    const fromAdmin = customer.operators[adminIdx];
    const toAdmin = customer.operators[targetIdx];
    const nowIso = new Date().toISOString();
    const operators = customer.operators.map((o, i) => {
      if (i === adminIdx) return { ...o, role: 'Operator', roleChangedAt: nowIso };
      if (i === targetIdx) return { ...o, role: 'Admin', roleChangedAt: nowIso, becameAdminAt: nowIso };
      return o;
    });
    const events = [...customer.events, {
      at: nowIso, kind: 'operator+', by: 'admin@carbon',
      text: `Admin role transferred · ${fromAdmin.email} → ${toAdmin.email} (former Admin demoted to Operator)`
    }];
    onUpdate({ ...customer, operators, events });
    toast({ kind: 'success', title: 'Admin role transferred', msg: `${toAdmin.name || toAdmin.email} is now the Admin.` });
    setTransferOpen(false);
  };

  return (
    <>
    <div className="info-card">
      <div className="info-card__head">
        <div>
          <div className="info-card__title">Operators</div>
        </div>
      </div>
      <div>
        {customer.pendingInvite && customer.operators.length === 0 ?
          <div style={{ padding: 20 }}>
            <PendingInviteCard
              invite={customer.pendingInvite}
              status={customer.status}
              onCopy={handleCopyLink}
              onSendEmail={() => setSendEmailOpen(true)}
              onRegenerate={() => setRegenConfirmOpen(true)}
              onRevoke={() => setConfirm({ action: 'revoke-invite' })} />
          </div> :
        customer.operators.length === 0 ?
          <div className="empty" style={{ padding: '40px 24px', textAlign: 'center' }}>
            {customer.status === 'Onboarding' ?
            <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Badge tone="info" dot>Onboarding</Badge>
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500, marginBottom: 4 }}>
                  Invite the first Admin to finish onboarding.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', maxWidth: 420, marginInline: 'auto', lineHeight: 1.5 }}>
                  Once the Admin completes activation, this customer becomes <strong style={{ color: 'var(--color-text-secondary)' }}>Active</strong>. The admin can then sign in and add the rest of their team.
                </div>
                <div style={{ marginTop: 16 }}>
                  <Btn variant="primary" icon="plus" onClick={startInvite}>Invite Admin</Btn>
                </div>
              </> :

            <span>No operators yet.</span>
            }
          </div> :

          <table className="tds-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last login</th>
                <th style={{ paddingRight: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {customer.operators.map((op, i) => {
                const showEmail = !maskOn || revealed[`${i}.email`];
                const showName = !maskOn || revealed[`${i}.name`];
                const isAdmin = (op.role || 'Admin') === 'Admin';
                const isLocked = !!op.locked;
                return (
                  <tr key={i} style={{
                    cursor: 'default',
                    background: isLocked
                      ? 'color-mix(in oklab, var(--color-error-500) 8%, transparent)'
                      : isAdmin ? 'color-mix(in oklab, var(--color-info-500) 5%, transparent)' : undefined
                  }}>
                    <td style={{ paddingLeft: 20 }}>
                      <div className="cust-cell" style={isLocked ? { opacity: 0.78 } : undefined}>
                        <div style={{ position: 'relative' }}>
                          <CompanyLogo name={op.name || op.email} size={28} />
                          {isAdmin && !isLocked &&
                            <span title="Admin" style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 14, height: 14, borderRadius: '50%',
                              background: 'var(--color-info-700, #1F6FA8)',
                              color: '#fff',
                              display: 'grid', placeItems: 'center',
                              border: '2px solid var(--color-bg-1, #fff)'
                            }}>
                              <Icon name="shield" size={8} />
                            </span>
                          }
                          {isLocked &&
                            <span title="Locked" style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 14, height: 14, borderRadius: '50%',
                              background: 'var(--color-error-700, #B42318)',
                              color: '#fff',
                              display: 'grid', placeItems: 'center',
                              border: '2px solid var(--color-bg-1, #fff)'
                            }}>
                              <Icon name="shield" size={8} />
                            </span>
                          }
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {op.name ?
                            <div className="cust-name" style={isLocked ? { textDecoration: 'line-through', textDecorationThickness: 1 } : undefined}>{showName ? op.name : maskName(op.name)}</div> :
                            <div className="cust-name muted" style={{ fontStyle: 'italic', fontWeight: 400 }}>Not yet provided</div>}
                          </div>
                          <div className="cust-meta" style={{ display: 'flex', gap: 6 }}>
                            {op.pending && <Badge tone="warning" dot>Pending activation</Badge>}
                            {isLocked && <Badge tone="error" dot>Locked</Badge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={isLocked ? { opacity: 0.78 } : undefined}>
                      <span className="op-mask">{showEmail ? op.email : maskEmail(op.email)}</span>
                      {maskOn && <button className="reveal-btn" onClick={() => toggle(i, 'email')}>{revealed[`${i}.email`] ? 'Hide' : 'Reveal'}</button>}
                    </td>
                    <td style={isLocked ? { opacity: 0.78 } : undefined}>
                      {isAdmin ?
                        <Badge tone="info">
                          <Icon name="shield" size={11} /> Admin
                        </Badge> :
                        <Badge tone="neutral">{op.role || 'Operator'}</Badge>
                      }
                    </td>
                    <td style={isLocked ? { opacity: 0.78 } : undefined}>
                      <span className="num" style={{ fontSize: 13 }}>{op.lastLogin ? relTime(op.lastLogin) : <span className="muted">Never</span>}</span>
                    </td>
                    <td style={{ paddingRight: 20, textAlign: 'right' }}>
                      <OperatorMenu op={op} onAction={(a) => handleOpAction(op, i, a)} />
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
          }
      </div>
    </div>
    <InviteLinkDetailsModal
      open={inviteDetailsOpen}
      onClose={() => { setInviteDetailsOpen(false); setInviteFreshlyMinted(false); }}
      onSendEmail={handleSendEmail}
      freshlyMinted={inviteFreshlyMinted}
      invite={customer.pendingInvite}
      customer={customer} />

    <SendInviteEmailDialog
      open={sendEmailOpen}
      onClose={() => setSendEmailOpen(false)}
      onSend={handleSendEmail}
      invite={customer.pendingInvite}
      customer={customer} />

    <RegenerateConfirmDialog
      open={regenConfirmOpen}
      onClose={() => setRegenConfirmOpen(false)}
      onConfirm={handleRegenerateInvite}
      invite={customer.pendingInvite} />

    <Modal open={!!confirm} onClose={() => setConfirm(null)}
      title={
        confirm?.action === 'remove' ? 'Remove operator' :
        confirm?.action === 'lock' ? 'Lock account' :
        confirm?.action === 'unlock' ? 'Unlock account' :
        confirm?.action === 'promote' ? 'Promote to Admin' :
        confirm?.action === 'revoke-invite' ? 'Revoke activation link' :
        ''
      }
      width={420}
      footer={confirm?.action === 'revoke-invite' ?
        <>
          <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
          <Btn variant="danger" icon="trash" onClick={handleRevokeInvite}>Revoke link</Btn>
        </> :
        <>
        <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
        <Btn variant={confirm?.action === 'remove' ? 'danger' : 'primary'} icon={confirm?.action === 'remove' ? 'trash' : confirm?.action === 'promote' ? 'shield' : 'check'}
        onClick={() => {
          const action = confirm.action;
          const idx = confirm.idx;
          const op = confirm.op;
          const nowIso = new Date().toISOString();
          if (action === 'lock' || action === 'unlock') {
            const operators = customer.operators.map((o, i) =>
              i === idx ? {
                ...o,
                locked: action === 'lock',
                lockedAt: action === 'lock' ? nowIso : null,
                lockedBy: action === 'lock' ? 'admin@carbon' : null
              } : o
            );
            const events = [...customer.events, {
              at: nowIso, kind: action === 'lock' ? 'warn' : 'info', by: 'admin@carbon',
              text: action === 'lock'
                ? `Operator locked · ${op.email}`
                : `Operator unlocked · ${op.email}`
            }];
            onUpdate({ ...customer, operators, events });
          }
          if (action === 'promote') {
            const operators = customer.operators.map((o, i) =>
              i === idx ? { ...o, role: 'Admin' } : o
            );
            const events = [...customer.events, {
              at: nowIso, kind: 'operator+', by: 'admin@carbon',
              text: `Operator promoted to Admin · ${op.email}`
            }];
            onUpdate({ ...customer, operators, events });
            toast({ kind: 'success', title: 'Promoted to Admin', msg: `${op.name || op.email} is now an Admin.` });
            setConfirm(null);
            return;
          }
          const verb = action === 'remove' ? 'removed' : action === 'lock' ? 'locked' : 'unlocked';
          toast({ kind: action === 'remove' || action === 'lock' ? 'warning' : 'success', title: `Operator ${verb}`, msg: op.email });
          setConfirm(null);
        }}>
          {confirm?.action === 'remove' ? 'Remove operator' : confirm?.action === 'lock' ? 'Lock account' : confirm?.action === 'promote' ? 'Promote to Admin' : 'Unlock account'}
        </Btn>
        </>
      }>
      {confirm &&
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          {confirm.action === 'remove' && <>Remove <strong>{confirm.op.name}</strong> from this customer? They will lose access immediately. This action is audited.</>}
          {confirm.action === 'lock' && <>Lock <strong>{confirm.op.name}</strong>? They won't be able to sign in until you unlock the account.</>}
          {confirm.action === 'unlock' && <>Unlock <strong>{confirm.op.name}</strong>? They'll regain sign-in access immediately.</>}
          {confirm.action === 'promote' && <>Promote <strong>{confirm.op.name}</strong> to Admin? They will gain full Admin privileges on this customer. The current Admin will keep their role. This action is audited.</>}
          {confirm.action === 'revoke-invite' && <>Revoke the current activation link? Anyone who received it will see "link no longer valid" when they try to use it. This action is audited.</>}
        </p>
        }
    </Modal>

    <Modal open={!!emailEdit} onClose={() => setEmailEdit(null)} title="Change operator email" width={520}
      footer={<>
        <Btn variant="ghost" onClick={() => setEmailEdit(null)}>Cancel</Btn>
        <Btn variant="primary" icon="check"
          disabled={!emailEdit || !!emailEdit.error || !emailEdit.value.trim() || emailEdit.value.trim().toLowerCase() === (emailEdit.op.email || '').toLowerCase()}
          onClick={() => {
            const next = emailEdit.value.trim();
            const old = emailEdit.op.email;
            const operators = customer.operators.map((o, i) => i === emailEdit.idx ? { ...o, email: next } : o);
            const events = [...customer.events, {
              at: new Date().toISOString(), kind: 'info', by: 'admin@carbon',
              text: `Operator email changed · ${old} → ${next}`
            }];
            onUpdate({ ...customer, operators, events });
            toast({ kind: 'success', title: 'Email updated', msg: `${emailEdit.op.name || next} can now sign in with ${next}.` });
            setEmailEdit(null);
          }}>Save email</Btn>
      </>}>
      {emailEdit &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted)' }}>
            Update the sign-in email for <strong style={{ color: 'var(--text)' }}>{emailEdit.op.name}</strong>. They'll receive a confirmation at both the old and new addresses. This action is audited.
          </p>
          <Field label="Current email">
            <Input value={emailEdit.op.email} disabled prefix={<Icon name="mail" size={14} />} />
          </Field>
          <Field label="New email" required error={emailEdit.error}>
            <Input type="email" autoFocus value={emailEdit.value}
              onChange={(e) => {
                const v = e.target.value;
                const trimmed = v.trim();
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
                const dup = trimmed && customer.operators.some((o, i) => i !== emailEdit.idx && (o.email || '').toLowerCase() === trimmed.toLowerCase());
                const error = !trimmed ? null : !isEmail ? 'Enter a valid email address' : dup ? 'Another operator on this customer already uses this email' : null;
                setEmailEdit({ ...emailEdit, value: v, error });
              }}
              placeholder="new.address@company.com"
              prefix={<Icon name="mail" size={14} />}
              invalid={!!emailEdit.error} />
          </Field>
        </div>
      }
    </Modal>
    </>);

};

// ─── History tab ─────────────────────────────────────────
const KIND_META = {
  created: { tone: 'success', label: 'Created' },
  'contract+': { tone: 'info', label: 'Contract added' },
  'contract✓': { tone: 'success', label: 'Contract signed' },
  'contract-': { tone: 'warning', label: 'Contract removed' },
  'operator+': { tone: 'info', label: 'Operator invited' },
  info: { tone: 'neutral', label: 'Info updated' },
  reveal: { tone: 'warning', label: 'Sensitive data revealed' },
  warn: { tone: 'warning', label: 'Status changed' }
};

const TabHistory = ({ customer }) =>
<div className="info-card">
    <div className="info-card__head">
      <div className="info-card__title">History ({customer.events.length})</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>
        <Btn variant="ghost" size="sm" icon="download">Export</Btn>
      </div>
    </div>
    <div className="info-card__body">
      <div className="timeline">
        {[...customer.events].reverse().map((ev, i) => {
        const meta = KIND_META[ev.kind] || { tone: 'neutral', label: ev.kind };
        return (
          <div key={i} className="tl-row">
              <div className={`tl-row__dot tl-row__dot--${meta.tone}`} />
              <div className="tl-row__title">{ev.text}</div>
              <div className="tl-row__meta">
                <span>{fmtDateTime(ev.at)}</span>
                <span>·</span>
                <span>by {ev.by}</span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
            </div>);

      })}
      </div>
    </div>
  </div>;


// ─── Detail shell ────────────────────────────────────────
const CustomerDetail = ({ customer, orders = [], initialTab, onBack, onUpdate, onOpenOrder, onNewOrder, maskOn, setMaskOn, systemRoles }) => {
  const [tab, setTab] = useState(initialTab || 'overview');
  const [editOpen, setEditOpen] = useState(false);
  const [openMerchantId, setOpenMerchantId] = useState(null);
  const toast = useToast();
  const isISO = (customer.contracts || []).some((c) => c.kind === 'ISO');
  const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'operators', label: 'Operators & roles' }];


  const handleSaveInfo = (next) => onUpdate({ ...next, events: [...customer.events, { at: new Date().toISOString(), kind: 'info', by: 'admin@carbon', text: 'Basic information updated' }] });
  // Helper: build a contract event matching the new schema
  // { statusFrom, statusTo, description }. description must self-contain
  // operator and timestamp so it reads on its own in the timeline.
  const _mkContractEvent = (statusFrom, statusTo, what, reason) => {
    const when = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const desc = reason
      ? `${what} on ${when} by admin@carbon — ${reason}`
      : `${what} on ${when} by admin@carbon`;
    return { statusFrom, statusTo, description: desc };
  };

  const handleAddContracts = (kinds, perKindEntitlements = {}, perKindTerms = {}, modeByKind = {}) => onUpdate({
    ...customer,
    // New contracts go to either PILOT or ACTIVE depending on the
    // segmented [Pilot | Active] toggle the admin set in the Manage
    // Contracts modal. Default: ISO → PILOT, others → ACTIVE.
    contracts: [...customer.contracts, ...kinds.map((k) => {
      const t = perKindTerms[k] || {};
      const nowIso = new Date().toISOString();
      // Resolve final mode. modeByKind is the source of truth; fall back
      // to spec defaults for any kind the toggle didn't touch.
      const isPilot = (modeByKind[k] || (String(k).toUpperCase() === 'ISO' ? 'PILOT' : 'ACTIVE')) === 'PILOT';
      // PILOT contracts: dates auto-fixed (today → +180d), fees zeroed
      // defensively in case the admin somehow typed something into a
      // disabled input. ACTIVE contracts use the admin's term + ents.
      const effFrom = isPilot ? nowIso : (t.effectiveFrom || nowIso);
      const effTo = isPilot
        ? new Date(new Date(effFrom).getTime() + 180 * 86400000).toISOString()
        : (t.effectiveTo || null);
      const ents = (() => {
        const src = perKindEntitlements[k] || {};
        if (!isPilot) return src;
        const out = { ...src };
        Object.keys(out).forEach((key) => {
          const v = out[key];
          if (v && typeof v === 'object' && 'price' in v && !('enable' in v)) {
            out[key] = { ...v, price: 0 };
          } else if (v && typeof v === 'object' && 'enable' in v) {
            const inner = v.priceStrategy ? { priceStrategy: { ...v.priceStrategy, price: 0 } } : { price: 0 };
            out[key] = { ...v, ...inner };
          }
        });
        return out;
      })();
      return {
        kind: k,
        status: isPilot ? 'PILOT' : 'ACTIVE',
        signedAt: nowIso,
        effectiveFrom: effFrom,
        effectiveTo: effTo,
        signedBy: 'admin@carbon',
        authorizingEntityName: 'NPT',
        authorizingEntityId: 'e-npt',
        entitlements: ents,
        events: [
          isPilot
            ? {
                ..._mkContractEvent(null, 'PILOT', `${k} pilot started · 180-day trial · all fees locked at $0`),
                eventType: 'BIND_PILOT', at: nowIso, by: 'admin@carbon',
                eventInfo: { initialEffectiveTo: effTo },
              }
            : _mkContractEvent(null, 'ACTIVE', `${k} contract bound`),
        ],
      };
    })],
    events: [...customer.events, ...kinds.map((k) => {
      const isPilot = (modeByKind[k] || (String(k).toUpperCase() === 'ISO' ? 'PILOT' : 'ACTIVE')) === 'PILOT';
      return {
        at: new Date().toISOString(),
        kind: 'contract+',
        by: 'admin@carbon',
        text: isPilot
          ? `${k} pilot started · 180-day trial · all fees locked at $0`
          : `${k} contract added`,
      };
    })],
  });
  const handleRemoveContract = (c) => {
    const now = new Date().toISOString();
    // Soft delete → TERMINATED with terminatedAt/By set + a terminate
    // event appended to the contract's own events array.
    onUpdate({
      ...customer,
      contracts: customer.contracts.map((x) => x === c ? {
        ...x,
        status: 'TERMINATED',
        terminatedAt: now,
        terminatedByEntityId: 'e-npt',
        events: [...(x.events || []), _mkContractEvent(String(x.status).toUpperCase(), 'TERMINATED', `${x.kind} contract terminated`)],
      } : x),
      events: [...customer.events, { at: now, kind: 'contract-', by: 'admin@carbon', text: `${c.kind} contract terminated` }]
    });
  };
  const handleUpdateContract = (c, patch, auditText, eventExtra) => {
    const now = new Date().toISOString();
    // Non-status edits (effectiveTo, entitlements) still write to the
    // contract's events array, with null statusFrom/To since no
    // transition happened. Description carries the human summary.
    //
    // `eventExtra` lets PILOT actions (extend / convert) record their
    // structured payload: { eventType, eventInfo }. They're merged into
    // the same event object so legacy readers see the description and
    // new readers (activity feed) can branch on eventType.
    const baseEv = _mkContractEvent(
      eventExtra?.statusFrom ?? null,
      eventExtra?.statusTo ?? (patch.status ? String(patch.status).toUpperCase() : null),
      auditText || `${c.kind} contract updated`,
    );
    const ev = eventExtra
      ? { ...baseEv, at: now, by: 'admin@carbon', eventType: eventExtra.eventType, eventInfo: eventExtra.eventInfo }
      : baseEv;
    onUpdate({
      ...customer,
      contracts: customer.contracts.map((x) => x === c ? {
        ...x,
        ...patch,
        events: [...(x.events || []), ev],
      } : x),
      events: [...customer.events, { at: now, kind: 'info', by: 'admin@carbon', text: auditText || `${c.kind} contract updated` }]
    });
  };
  // State-machine transitions (corrected 3-state model):
  //   ACTIVE    → SUSPENDED       (Suspend)
  //   SUSPENDED → ACTIVE          (Resume)
  //   {anything} → TERMINATED     (Terminate — via handleRemoveContract)
  // `reason` is optional copy from the confirm modal; threaded into the
  // audit event text so admins can read 'why' on the timeline. Suspend
  // requires it (enforced by modal); Resume treats it as a free note.
  const handleContractStatusChange = (c, nextStatus, reason) => {
    const now = new Date().toISOString();
    const fromUpper = String(c.status || '').toUpperCase();
    const wasSuspended = fromUpper === 'SUSPENDED';
    const verb = nextStatus === 'ACTIVE' && wasSuspended
      ? 'resumed'
      : nextStatus === 'SUSPENDED' ? 'suspended'
      : 'changed';
    const baseText = `${c.kind} contract ${verb}`;
    const text = reason ? `${baseText} — reason: ${reason}` : baseText;
    onUpdate({
      ...customer,
      contracts: customer.contracts.map((x) => x === c ? {
        ...x,
        status: nextStatus,
        events: [...(x.events || []), _mkContractEvent(fromUpper, nextStatus, baseText, reason)],
      } : x),
      events: [...customer.events, { at: now, kind: nextStatus === 'SUSPENDED' ? 'warn' : 'info', by: 'admin@carbon', text }]
    });
  };

  // When a merchant is opened from the Merchants tab, take over the
  // entire right-side area — hide the customer header / tabs and render
  // only the merchant detail so the operator has the full canvas.
  const merchantOpen = tab === 'merchants' && openMerchantId && isISO;

  if (merchantOpen) {
    return (
      <div className="page">
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setOpenMerchantId(null)} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, marginLeft: -8 }}>
            <Icon name="chevL" size={14} /> Back to {customer.name} · Merchants
          </button>
        </div>
        {window.TabCustomerMerchants &&
          <window.TabCustomerMerchants
            customer={customer}
            openMerchantId={openMerchantId}
            setOpenMerchantId={setOpenMerchantId}
          />
        }
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, marginLeft: -8 }}>
          <Icon name="chevL" size={14} /> Back to customers
        </button>
      </div>

      <div className="det-header">
        <CompanyLogo name={customer.name} size={56} />
        <div className="det-header__main">
          <h1 className="det-header__title">
            {customer.name}
            {/* Entity-level status: Active (has operators) or Onboarding */}
            {/* (no operators yet \u2014 invite issued but not consumed). Per the */}
            {/* corrected model, entity has no LOCKED state \u2014 admins manage */}
            {/* access via per-contract suspension. */}
            <Badge tone={customer.status === 'Onboarding' ? 'info' : 'success'} dot>{customer.status}</Badge>
          </h1>
          <div className="det-header__meta">
            <span><Icon name="clock" size={13} /> Registered {fmtDate(customer.registeredAt)}</span>
            {customer.license && <span title="License"><Icon name="shield" size={13} /> License: {customer.license}</span>}
            {customer.contracts.length > 0 && (() => {
              // Header shows live contracts only (TERMINATED kept in the
              // Contracts tab history). Status is encoded into the chip
              // colour + hover tooltip — matches the list view.
              const liveHeaderContracts = customer.contracts.filter((c) => _CS(c.status) !== 'TERMINATED' && _CS(c.status) !== 'EXPIRED');
              if (liveHeaderContracts.length === 0) return null;
              return (
                <span className="badge-row" style={{ gap: 4, alignItems: 'center' }}>
                  {liveHeaderContracts.map((c, i) => (
                    <ContractBadge
                      key={i}
                      kind={c.kind}
                      status={c.status}
                      effectiveFrom={c.effectiveFrom || c.signedAt}
                      effectiveTo={c.effectiveTo}
                      terminatedAt={c.terminatedAt}
                    />
                  ))}
                </span>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>Edit info</Btn>
        </div>
      </div>

      <div className="det-tabs">
        {tabs.map((t) =>
        <button key={t.id} className={`tds-tab ${tab === t.id ? 'tds-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {typeof t.count === 'number' && <span className="tds-tab__count">{t.count}</span>}
          </button>
        )}
      </div>

      {tab === 'overview' && <TabOverview customer={customer} onSave={handleSaveInfo} maskOn={maskOn} />}
      {tab === 'contracts' && <TabContracts customer={customer} onAdd={handleAddContracts} onRemove={handleRemoveContract} onStatusChange={handleContractStatusChange} onUpdateContract={handleUpdateContract} />}
      {tab === 'merchants' && isISO && window.TabCustomerMerchants && <window.TabCustomerMerchants customer={customer} openMerchantId={openMerchantId} setOpenMerchantId={setOpenMerchantId} />}
      {tab === 'operators' &&
      <div className="stack" style={{ gap: 14 }}>
          <TabOperators customer={customer} onUpdate={onUpdate} maskOn={maskOn} setMaskOn={setMaskOn} />
          <TabRoles customer={customer} onUpdate={onUpdate} systemRoles={systemRoles} />
        </div>
      }
      {tab === 'history' && <TabHistory customer={customer} />}

      <EditInfoModal open={editOpen} customer={customer} onClose={() => setEditOpen(false)} onSave={(next) => {handleSaveInfo(next);setEditOpen(false);}} />

    </div>);

};

const EditInfoModal = ({ open, customer, onClose, onSave }) => {
  const [form, setForm] = useState(customer);
  const toast = useToast();
  React.useEffect(() => {if (open) setForm(customer);}, [open, customer]);
  const valid = companyFormValid(form);
  return (
    <Modal open={open} onClose={onClose} title="Edit customer info" width={620}
    footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={() => {onSave(form);toast({ kind: 'success', title: 'Customer info updated' });}}>Save changes</Btn>
      </>}>
      <CompanyInfoEdit form={form} onChange={setForm} />
    </Modal>);

};

window.CustomerDetail = CustomerDetail;