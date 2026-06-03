/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, ContractBadge, CONTRACT_INFO, COUNTRIES, COUNTRY_BY_CODE, useToast, iconForKind */
const { useState } = React;

const CONTRACT_OPTIONS = [
  { kind: 'ISV',         title: 'ISV — Independent Software Vendor',    desc: 'Grants the customer the ability to integrate Carbon APIs into their own software and resell payment services.', iconClass: 'isv' },
  { kind: 'ISO',         title: 'ISO — Independent Sales Organization', desc: 'Authorizes the customer to onboard sub-merchants and earn residuals on processing volume.',                       iconClass: 'iso' },
  { kind: 'Distributor', title: 'Distributor',                          desc: 'Authorized distribution partner. Can only be authorized by the platform admin; cannot authorize further downstream.', iconClass: 'distributor' },
];


const Stepper = ({ step }) => {
  const items = [
  { n: 1, sub: 'Step 1', label: 'Company' },
  { n: 2, sub: 'Step 2', label: 'Contracts' },
  { n: 3, sub: 'Done', label: 'Confirmation' }];

  return (
    <div className="stepper">
      {items.map((it, i) =>
      <React.Fragment key={it.n}>
          <div className={`stepper__item ${step === it.n ? 'is-active' : ''} ${step > it.n ? 'is-done' : ''}`}>
            <div className="stepper__dot">{step > it.n ? <Icon name="check" size={14} /> : it.n}</div>
            <div className="stepper__lbl"><small>{it.sub}</small><strong>{it.label}</strong></div>
          </div>
          {i < items.length - 1 && <div className={`stepper__bar ${step > it.n ? 'is-done' : ''}`} />}
        </React.Fragment>
      )}
    </div>);

};

// ─── Step 1 — Company info ────────────────────────────────
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[\d\s\-().]{4,}$/;

const Step1 = ({ data, onChange }) => {
  const [touched, setTouched] = useState({});
  // Only Company Name + Country are mandatory. Everything else is optional —
  // but Email / Phone must still be format-valid IF the admin chose to fill
  // them in. Phone-country-code is only required when a phone number is
  // present (so "+1" without a number is rejected too).
  const errs = {
    name: !data.name?.trim() ? 'Company name is required' : null,
    country: !data.country ? 'Country is required' : null,
    address: null,
    phoneCountryCode: data.phone?.trim() && !data.phoneCountryCode?.trim() ? 'Required with phone' : null,
    phone: data.phone?.trim() && !PHONE_RE.test(data.phone) ? 'Invalid phone number' : null,
    email: data.email?.trim() && !EMAIL_RE.test(data.email) ? 'Invalid email address' : null,
  };
  const blur = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const handleCountryChange = (code) => {
    // Auto-fill phone country code when none has been set (or when it matches the prior country's dial).
    const prev = COUNTRY_BY_CODE?.[data.country];
    const next = COUNTRY_BY_CODE?.[code];
    const shouldSyncDial = !data.phoneCountryCode || (prev && data.phoneCountryCode === prev.dial);
    onChange({ country: code, ...(shouldSyncDial && next ? { phoneCountryCode: next.dial } : {}) });
  };
  const tzList = window.TIMEZONES || [];
  return (
    <div className="tds-card">
      <div className="tds-card__header"><div className="tds-card__title">Company information</div></div>
      <div className="tds-card__body">
        <div className="form-grid" style={{ gap: 18 }}>
          <Field label="Company name" required error={touched.name && errs.name}>
            <Input value={data.name} onChange={(e) => onChange({ name: e.target.value })} onBlur={() => blur('name')} placeholder="e.g. Northwind Commerce" invalid={!!(touched.name && errs.name)} />
          </Field>
          <Field label="License">
            <Input value={data.license} onChange={(e) => onChange({ license: e.target.value })} placeholder="e.g. NW-2024-08831-CA" />
          </Field>
          <div className="form-grid form-grid--2" style={{ gap: 18 }}>
            <Field label="Country" required error={touched.country && errs.country}>
              <Select value={data.country || ''} onChange={(e) => handleCountryChange(e.target.value)} onBlur={() => blur('country')}>
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Timezone">
              <Select value={data.timezone || ''} onChange={(e) => onChange({ timezone: e.target.value })}>
                <option value="">Select timezone…</option>
                {tzList.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Registered address" error={touched.address && errs.address}>
            <Textarea value={data.address} onChange={(e) => onChange({ address: e.target.value })} onBlur={() => blur('address')} placeholder="Street, city, region, postal code" rows={2} invalid={!!(touched.address && errs.address)} />
          </Field>
          <div className="form-grid form-grid--2" style={{ gap: 18 }}>
            <Field label="Contact name">
              <Input value={data.contactName || ''} onChange={(e) => onChange({ contactName: e.target.value })} placeholder="e.g. Sarah Chen" />
            </Field>
            <Field label="Email" error={touched.email && errs.email}>
              <Input type="email" value={data.email} onChange={(e) => onChange({ email: e.target.value })} onBlur={() => blur('email')} placeholder="contact@company.com" prefix={<Icon name="mail" size={14} />} invalid={!!(touched.email && errs.email)} />
            </Field>
          </div>
          <Field label="Phone" error={(touched.phoneCountryCode && errs.phoneCountryCode) || (touched.phone && errs.phone)}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
              <Select value={data.phoneCountryCode || ''} onChange={(e) => onChange({ phoneCountryCode: e.target.value })} onBlur={() => blur('phoneCountryCode')}>
                <option value="">Code…</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.dial}>{c.dial} · {c.code}</option>)}
              </Select>
              <Input value={data.phone} onChange={(e) => onChange({ phone: e.target.value })} onBlur={() => blur('phone')} placeholder="e.g. 415 226 4800" invalid={!!(touched.phone && errs.phone)} />
            </div>
          </Field>
          <Field label="Remark" hint="Internal note — not visible to the customer.">
            <Textarea value={data.remark || ''} onChange={(e) => onChange({ remark: e.target.value })} placeholder="Internal note" rows={2} />
          </Field>
        </div>
      </div>
    </div>);

};

// ─── Step 2 — Contracts (uses shared ContractAssignBoard) ───
// Picker rail + clause form layout (B2 pattern). Defined in
// contract-assign.jsx so customer-detail.jsx's Add-contract modal can
// use the same component and the UX stays in sync.
const Step2 = ({ contracts, toggle, entitlements, setEntitlements, focusedKind, setFocusedKind, errorsByKind, terms, setTerms }) => (
  <div className="tds-card">
    <div className="tds-card__header">
      <div>
        <div className="tds-card__title">Assign contracts</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          Toggle the types on the left, configure each contract's effective dates + clauses on the right. Effective immediately on customer creation.
        </div>
      </div>
    </div>
    <div className="tds-card__body" style={{ padding: 16 }}>
      <window.ContractAssignBoard
        availableKinds={CONTRACT_OPTIONS.map((o) => o.kind)}
        selectedKinds={contracts}
        onTogglePick={toggle}
        entitlements={entitlements}
        setEntitlements={setEntitlements}
        focusedKind={focusedKind}
        setFocusedKind={setFocusedKind}
        errorsByKind={errorsByKind}
        terms={terms}
        setTerms={setTerms}
      />
      {contracts.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-bg-3)', borderRadius: 10, border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 500 }}>
            Will be created as
          </div>
          <div className="badge-row" style={{ gap: 6 }}>
            {contracts.map((k) => <ContractBadge key={k} kind={k} status="Active" />)}
          </div>
        </div>
      )}
    </div>
  </div>
);


// ─── Step 3 — Done ────────────────────────────────────────
const StepDone = ({ customer, onGoToDetail }) =>
<div className="tds-card" style={{ textAlign: 'center' }}>
    <div className="tds-card__body" style={{ padding: '40px 32px' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-info-50, var(--color-bg-3))', color: 'var(--color-info-700, var(--color-text-primary))', display: 'inline-grid', placeItems: 'center', margin: '0 auto 18px', border: '1px solid var(--color-border-subtle)' }}>
        <Icon name="check" size={36} />
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        <Badge tone="info" dot>Onboarding</Badge>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Customer created — awaiting first Admin</h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 24px', maxWidth: 500, marginInline: 'auto', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{customer.name}</strong> is registered with{' '}
        {customer.contracts.length} active contract{customer.contracts.length === 1 ? '' : 's'}.
        Next step: invite an Admin so the customer can sign in and start operating.
        The account will move to <strong style={{ color: 'var(--color-text-primary)' }}>Active</strong> automatically once the Admin is invited.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <Btn variant="primary" iconRight="chevR" onClick={onGoToDetail}>Invite Admin</Btn>
      </div>
    </div>
  </div>;


// ─── Wizard shell ────────────────────────────────────────
const CustomerWizard = ({ onCancel, onComplete }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ name: '', country: 'US', address: '', phoneCountryCode: '+1', phone: '', email: '', license: '', contactName: '', timezone: '', remark: '' });
  const [contracts, setContracts] = useState([]);
  // entitlements: { [kind]: { [clauseKey]: value } } — per-kind clause
  // forms. Populated by Step2's right pane; consumed by finalize() so the
  // created contracts already carry their clauses on creation.
  const [entitlements, setEntitlements] = useState({});
  // Per-kind term state: { [kind]: { effectiveFrom, effectiveTo } }
  // Captured in Step 2's date inputs and consumed by finalize().
  const [terms, setTerms] = useState({});
  // focusedKind drives Step2's right pane — which contract type's clauses
  // are currently being edited. Defaults to the first picked, or ISV if
  // nothing's picked yet (so the right pane isn't empty on first paint).
  const [focusedKind, setFocusedKind] = useState(null);
  const [created, setCreated] = useState(null);

  const canNext = (() => {
    if (step === 1) {
      // Only Company Name + Country are mandatory. Email / Phone must
      // still pass format validation when present (empty is fine).
      if (!data.name.trim() || !data.country) return false;
      if (data.phone?.trim()) {
        if (!PHONE_RE.test(data.phone)) return false;
        if (!data.phoneCountryCode?.trim()) return false;
      }
      if (data.email?.trim() && !EMAIL_RE.test(data.email)) return false;
      return true;
    }
    if (step === 2) {
      if (contracts.length === 0) return false;
      const errs = window.collectAssignErrors(contracts, entitlements);
      return Object.keys(errs).length === 0;
    }
    return true;
  })();

  // Live error map for Step 2. Only used to render error chips in the rail
  // / red borders on inputs — the canNext gate above is what really blocks
  // Continue.
  const step2Errors = step === 2 ? window.collectAssignErrors(contracts, entitlements) : {};

  const toggleContract = (k) => {
    setContracts((c) => {
      const wasOn = c.includes(k);
      if (wasOn) {
        // Toggling off — clean up entitlements + terms for this kind.
        setEntitlements((e) => { const x = { ...e }; delete x[k]; return x; });
        setTerms((t) => { const x = { ...t }; delete x[k]; return x; });
        return c.filter((x) => x !== k);
      }
      // Toggling on — seed defaults:
      //   • settlementCurrency derived from customer.country
      //   • effectiveFrom = today, effectiveTo = null
      const nowIso = new Date().toISOString();
      const defaultCurrency = window.currencyForCountry
        ? window.currencyForCountry(data.country)
        : 'USD';
      setEntitlements((e) => ({
        ...e,
        [k]: { ...(e[k] || {}), settlementCurrency: (e[k]?.settlementCurrency || defaultCurrency) },
      }));
      setTerms((t) => ({
        ...t,
        [k]: t[k] || { effectiveFrom: nowIso, effectiveTo: null },
      }));
      return [...c, k];
    });
    setFocusedKind(k);
  };

  const finalize = () => {
    const id = 'c-' + Date.now().toString().slice(-4);
    const nowIso = new Date().toISOString();
    const cust = {
      id,
      name: data.name.trim(),
      country: data.country,
      address: data.address.trim(),
      phoneCountryCode: data.phoneCountryCode.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      license: data.license.trim(),
      contactName: (data.contactName || '').trim(),
      timezone: data.timezone || '',
      remark: (data.remark || '').trim(),
      status: 'Onboarding',
      registeredAt: nowIso,
      contracts: contracts.map((kind) => {
        const t = terms[kind] || {};
        // Audit event with operator + timestamp baked into description
        // (matches the new {statusFrom, statusTo, description} schema and
        // mirrors what customer-detail.jsx's handleAddContracts produces).
        const when = new Date(nowIso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        // ISO defaults to PILOT (6-month trial) per spec §1.2: gives the
        // customer time to evaluate Carbon's device fleet management
        // before committing to billing. Other kinds (ISV / Distributor)
        // default to ACTIVE — they're either fee-less or pre-negotiated.
        const isPilot = String(kind).toUpperCase() === 'ISO';
        const effFrom = t.effectiveFrom || nowIso;
        // PILOT auto-fills +180 days from effectiveFrom. Admin sees the
        // date in the contract row banner and can extend (+30/60/90)
        // before expiry from the row menu.
        const pilotEnd = new Date(new Date(effFrom).getTime() + 180 * 86400000).toISOString();
        // PILOT contracts must have all fees = 0 per spec. Zero out
        // every price/feature in the user-supplied entitlements (admin
        // shouldn't have entered fees in PILOT mode but we defend
        // anyway). models / currency carry over unchanged.
        const ents = (() => {
          if (!isPilot) return entitlements[kind] || {};
          const src = entitlements[kind] || {};
          const out = { ...src };
          Object.keys(out).forEach((k) => {
            const v = out[k];
            if (v && typeof v === 'object' && 'price' in v && !('enable' in v)) {
              // price clause
              out[k] = { ...v, price: 0 };
            } else if (v && typeof v === 'object' && 'enable' in v) {
              // feature clause — preserve enable flag, zero the price
              const inner = v.priceStrategy ? { priceStrategy: { ...v.priceStrategy, price: 0 } } : { price: 0 };
              out[k] = { ...v, ...inner };
            }
          });
          return out;
        })();
        return {
          kind,
          // UPPERCASE per spec §1.2 — matches what the row UI / state
          // machine helpers (window.effectiveStatus) expect.
          status: isPilot ? 'PILOT' : 'ACTIVE',
          signedAt: nowIso,
          signedBy: 'admin@carbon',
          authorizingEntityName: 'NPT',
          authorizingEntityId: 'e-npt',
          effectiveFrom: effFrom,
          // PILOT auto-locks the end date; ACTIVE uses whatever admin set
          // (which can be null / "no end date").
          effectiveTo: isPilot ? pilotEnd : (t.effectiveTo || null),
          entitlements: ents,
          events: [
            isPilot
              ? {
                  statusFrom: null,
                  statusTo: 'PILOT',
                  description: `${kind} pilot started on ${when} by admin@carbon · 180-day trial · all fees locked at $0`,
                  eventType: 'BIND_PILOT',
                  at: nowIso,
                  by: 'admin@carbon',
                  eventInfo: { initialEffectiveTo: pilotEnd },
                }
              : {
                  statusFrom: null,
                  statusTo: 'ACTIVE',
                  description: `${kind} contract bound on ${when} by admin@carbon`,
                },
          ],
        };
      }),
      operators: [],
      events: [
      { at: nowIso, kind: 'created', by: 'admin@carbon', text: 'Company registered · awaiting first Admin' },
      ...contracts.map((kind) => {
        const isPilot = String(kind).toUpperCase() === 'ISO';
        return {
          at: nowIso,
          kind: 'contract+',
          by: 'admin@carbon',
          text: isPilot
            ? `${kind} pilot started · 180-day trial · all fees locked at $0`
            : `${kind} contract configured · active`,
        };
      })]

    };
    setCreated(cust);
    setStep(3);
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">New customer</h1>
          <p className="page__sub">Register a company and configure its contracts. Operators can be added later from the customer detail.</p>
        </div>
        <Btn variant="ghost" icon="x" onClick={onCancel}>Cancel</Btn>
      </div>

      <Stepper step={step} />

      <div className={`wizard-grid ${step === 2 ? 'wizard-grid--wide' : ''}`}>
        <div>
          {step === 1 && <Step1 data={data} onChange={(p) => setData((d) => ({ ...d, ...p }))} />}
          {step === 2 && <Step2
            contracts={contracts}
            toggle={toggleContract}
            entitlements={entitlements}
            setEntitlements={setEntitlements}
            focusedKind={focusedKind}
            setFocusedKind={setFocusedKind}
            errorsByKind={step2Errors}
            terms={terms}
            setTerms={setTerms}
          />}
          {step === 3 && created && <StepDone customer={created} onGoToDetail={() => onComplete(created)} />}

          {step < 3 &&
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <Btn variant="ghost" icon="chevL" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>Back</Btn>
              <div style={{ display: 'flex', gap: 8 }}>
                {step < 2 ?
              <Btn variant="primary" iconRight="chevR" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Btn> :

              <Btn variant="primary" icon="check" disabled={!canNext} onClick={finalize}>Create customer</Btn>
              }
              </div>
            </div>
          }
        </div>

        {/* Step 2 uses the full width for the picker rail + clause form,
            so the company-summary aside is suppressed there. The contract
            picks are still visible in Step 2's own "Will be created as"
            footer. */}
        {step !== 2 && (
        <aside className="wizard-aside">
          <h4>Summary</h4>
          <dl>
            <dt>Name</dt>      <dd>{data.name || <span className="muted">—</span>}</dd>
            <dt>Country</dt>   <dd>{data.country ? (COUNTRY_BY_CODE?.[data.country]?.name || data.country) : <span className="muted">—</span>}</dd>
            <dt>Address</dt>   <dd style={{ fontSize: 12.5 }}>{data.address || <span className="muted">—</span>}</dd>
            <dt>Phone</dt>     <dd>{data.phone ? <><span className="muted" style={{ marginRight: 4 }}>{data.phoneCountryCode}</span>{data.phone}</> : <span className="muted">—</span>}</dd>
            <dt>Email</dt>     <dd style={{ fontSize: 12.5 }}>{data.email || <span className="muted">—</span>}</dd>
            <dt>License</dt>   <dd>{data.license || <span className="muted">—</span>}</dd>
            <dt>Contracts</dt> <dd>
              {contracts.length === 0 ? <span className="muted">None selected</span> :
              <div className="badge-row">{contracts.map((k) => <ContractBadge key={k} kind={k} status="Active" />)}</div>
              }
            </dd>
          </dl>
        </aside>
        )}
      </div>
    </div>);

};

window.CustomerWizard = CustomerWizard;