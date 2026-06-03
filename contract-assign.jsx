/* global React, Icon, Field, Btn, ClauseInput, clauseError, iconForKind, CONTRACT_INFO */
// ─────────────────────────────────────────────────────────────
// contract-assign.jsx — Contract picker + clause configurator
//
// Shared B2-layout component used by:
//   • customer-wizard.jsx (Step 2 — new customer wizard)
//   • customer-detail.jsx (Add contract modal in the Contracts tab)
//
// Layout:
//   ┌───────────────┬─────────────────────────────────┐
//   │ Contract rail │ Clauses for the focused type    │
//   │ (toggle rows) │ (rendered via <ClauseInput>)    │
//   └───────────────┴─────────────────────────────────┘
//
// Props
//   availableKinds   — string[] of kinds the user is allowed to pick.
//                       Wizard passes ['ISV','ISO','Distributor'];
//                       Add-contract passes the kinds the customer
//                       doesn't already hold live.
//   selectedKinds    — currently picked kinds.
//   onTogglePick     — (kind) => void; toggles membership.
//   entitlements     — { [kind]: entitlementValues } shared state.
//   setEntitlements  — setter for above.
//   focusedKind      — which kind's clause form is shown in the right pane.
//   setFocusedKind   — setter for above.
//   errorsByKind     — optional { [kind]: { [clauseKey]: errorString } }
//   compact          — when true, the rail uses a shorter padding scheme
//                      (used inside the Add modal where vertical space is
//                      tighter than the wizard).
//
// Exposes:
//   window.ContractAssignBoard
//   window.collectAssignErrors(kinds, entitlements) → { [kind]: { [key]: err } }
//   window.kindToSchemaKey(k) — 'Distributor' → 'DISTRIBUTOR', etc.
// ─────────────────────────────────────────────────────────────

const kindToSchemaKey = (k) => String(k || '').toUpperCase();
const schemaFor = (kind) => {
  const k = kindToSchemaKey(kind);
  return (window.CONTRACT_ENTITLEMENT_SCHEMA && window.CONTRACT_ENTITLEMENT_SCHEMA[k]) || [];
};

// Walk every kind's schema and produce a per-clause error map. Used by
// callers to gate Save/Continue.
const collectAssignErrors = (selectedKinds, entitlements) => {
  const out = {};
  (selectedKinds || []).forEach((kind) => {
    const sch = schemaFor(kind);
    const e = entitlements?.[kind] || {};
    const map = {};
    sch.forEach((f) => {
      const err = clauseError(f, e[f.key]);
      if (err) map[f.key] = err;
    });
    if (Object.keys(map).length > 0) out[kind] = map;
  });
  return out;
};

// Counts per kind for rail subtitle: e.g. "3/6 clauses set"
const fillCount = (kind, entitlements) => {
  const sch = schemaFor(kind);
  if (sch.length === 0) return null;
  const e = entitlements?.[kind] || {};
  const set = sch.filter((f) => {
    const v = e[f.key];
    if (f.type === 'price')    return v && v.price !== '' && v.price != null;
    if (f.type === 'feature')  return v && (v.enable || (v.price !== '' && v.price != null));
    if (f.type === 'models')   return Array.isArray(v) && v.length > 0;
    if (f.type === 'currency') return typeof v === 'string' && v.length > 0;
    return v != null && v !== '';
  }).length;
  return { set, total: sch.length };
};

// Kind → meta lookup for icon + label color. Falls back to ISO styling
// if the kind isn't in CONTRACT_INFO (shouldn't happen in practice).
const kindMeta = (kind) => {
  const info = (CONTRACT_INFO || {})[kind] || (CONTRACT_INFO || {})[kindToSchemaKey(kind)] || {};
  return {
    iconClass: (info.hue || 'iso').toLowerCase(),
    iconName: iconForKind(kind),
    title: info.label || kind,
    desc: info.desc || '',
  };
};

const ContractAssignBoard = ({
  availableKinds,
  selectedKinds,
  onTogglePick,
  entitlements,
  setEntitlements,
  // Optional: explicit per-kind mode override map { ISO: 'PILOT'|'ACTIVE', ... }.
  // If unset, defaults apply (ISO → PILOT, others → ACTIVE). The wizard / Manage
  // Contracts modal passes through state + setter to let admins flip the
  // segmented [Pilot | Active] control on new contracts.
  modeByKind,
  setModeByKind,
  focusedKind,
  setFocusedKind,
  errorsByKind,
  compact = false,
  // 'pick' (default) — multi-pick + toggle, used by the legacy Add
  // Contract modal + Wizard.
  // 'edit'           — single contract focus, no toggle, rail shows the
  //                    contract's status + effective range.
  // 'manage'         — unified Add + Edit: rail splits into "Active"
  //                    (existing contracts, no toggle, focus to edit) and
  //                    "Available to add" (toggleable kinds). Right pane
  //                    shows effective dates + clauses for the focused
  //                    contract / kind.
  mode = 'pick',
  // For mode='edit' — the live EntityContract being edited (rail meta).
  contract = null,
  // For mode='manage' — map of kind → live contract object the customer
  // already holds. These rows are non-toggleable in the rail and show a
  // status chip. Keyed by kind (e.g. {'ISO': contract, ...}).
  existingByKind = null,
  // Optional per-kind terms state: { [kind]: { effectiveFrom, effectiveTo } }
  // Drives the date inputs in the right pane. When omitted, dates are
  // hidden (legacy callers).
  terms = null,
  setTerms = null,
}) => {
  const isEditMode = mode === 'edit';
  const isManageMode = mode === 'manage';

  // Auto-focus the first available kind if nothing is focused yet. In
  // manage mode, prefer focusing an existing contract first so admins
  // land on something familiar (not a blank "available to add" row).
  React.useEffect(() => {
    if (!focusedKind && availableKinds && availableKinds.length > 0) {
      if (isManageMode && existingByKind) {
        const firstExisting = availableKinds.find((k) => existingByKind[k]);
        setFocusedKind(firstExisting || availableKinds[0]);
      } else {
        setFocusedKind(availableKinds[0]);
      }
    }
  }, [focusedKind, availableKinds, setFocusedKind, isManageMode, existingByKind]);

  const focused = focusedKind || (availableKinds || [])[0];
  const focusedSchema = focused ? schemaFor(focused) : [];
  // Which "kinds" are selected (i.e. the customer either has them or has
  // toggled them on in this session).
  //   edit   — always true (single contract)
  //   manage — existing OR newly toggled on
  //   pick   — checked toggle
  const isKindSelected = (kind) => {
    if (isEditMode) return true;
    if (isManageMode && existingByKind && existingByKind[kind]) return true;
    return (selectedKinds || []).includes(kind);
  };
  const focusedSelected = focused ? isKindSelected(focused) : false;
  const focusedEnts = focused ? (entitlements[focused] || {}) : {};
  const focusedTerms = (terms && focused) ? (terms[focused] || {}) : {};
  const focusedErrors = focused ? (errorsByKind?.[focused] || {}) : {};
  const focusedMeta = focused ? kindMeta(focused) : null;
  const focusedExistingContract = (isManageMode && focused && existingByKind) ? existingByKind[focused] : null;

  // PILOT determination — drives lockdown of fees + auto-fill of dates.
  // Resolution order:
  //   1. Existing contract → follow its persisted status
  //   2. Explicit modeByKind override → use that
  //   3. Default → ISO is PILOT, all others ACTIVE
  // The segmented [Pilot | Active] control renders for new contracts only;
  // existing PILOT contracts must use Convert via the row action button.
  const focusedIsPilot = (() => {
    if (focusedExistingContract) return String(focusedExistingContract.status).toUpperCase() === 'PILOT';
    if (!focused) return false;
    if (modeByKind && modeByKind[focused]) return modeByKind[focused] === 'PILOT';
    return String(focused).toUpperCase() === 'ISO';
  })();

  // Auto-fill PILOT dates when a focused kind enters PILOT mode for
  // the first time (idempotent — only writes if effectiveFrom is
  // blank). MUST live at the top level of the component (not inside
  // the conditional term-editor JSX) so React's hook-call order stays
  // stable across focus changes. Otherwise toggling between
  // selected/unselected kinds drops the hook count and React refuses
  // to render → blank pane / crash.
  React.useEffect(() => {
    if (!terms || !setTerms) return;
    if (!focused || !focusedIsPilot || focusedExistingContract) return;
    const cur = (terms && terms[focused]) || {};
    if (!cur.effectiveFrom) {
      const today = new Date().toISOString();
      setTermField('effectiveFrom', today);
      setTermField('effectiveTo', new Date(Date.now() + 180 * 86400000).toISOString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, focusedIsPilot]);

  const setField = (key, next) => {
    setEntitlements((prev) => ({
      ...prev,
      [focused]: { ...(prev[focused] || {}), [key]: next },
    }));
  };
  const setTermField = (key, next) => {
    if (!setTerms || !focused) return;
    setTerms((prev) => ({
      ...prev,
      [focused]: { ...(prev[focused] || {}), [key]: next },
    }));
  };

  // ─── Rail row factories ─────────────────────────────────────
  // Render a single rail row. Variants:
  //   • picker (existing pick mode): icon + name + sub + toggle
  //   • existing-ro (manage / edit mode for held contracts): status chip, no toggle
  //   • addable (manage mode for unheld kinds): icon + name + sub + toggle
  const renderPickRow = (kind) => {
    const meta = kindMeta(kind);
    const on = (selectedKinds || []).includes(kind);
    const isFocused = focused === kind;
    const fc = fillCount(kind, entitlements);
    const kindErrs = errorsByKind?.[kind];
    const hasErr = on && kindErrs && Object.keys(kindErrs).length > 0;
    return (
      <div
        key={kind}
        className={`cab-railrow ${on ? 'is-on' : ''} ${isFocused ? 'is-focused' : ''} ${hasErr ? 'has-error' : ''}`}
        onClick={() => setFocusedKind(kind)}
        role="button" tabIndex={0}
      >
        <div className={`pick-card__icon pick-card__icon--${meta.iconClass}`} style={{ width: 32, height: 32, borderRadius: 7 }}>
          <Icon name={meta.iconName} size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cab-railrow__title">{kind}</div>
          <div className="cab-railrow__sub">
            {!on
              ? <span className="muted">Not selected</span>
              : hasErr
                ? <span style={{ color: 'var(--color-error-700)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    <Icon name="alert" size={10}/> {Object.keys(kindErrs).length} error{Object.keys(kindErrs).length === 1 ? '' : 's'}
                  </span>
                : fc
                  ? <>{fc.set}/{fc.total} clauses set</>
                  : <span className="muted">No clauses</span>}
          </div>
        </div>
        <button
          type="button"
          className={`cab-tog ${on ? 'is-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onTogglePick(kind); setFocusedKind(kind); }}
          aria-label={on ? 'Disable' : 'Enable'}
        >
          <span className="cab-tog__dot"/>
        </button>
      </div>
    );
  };

  // Render an existing-contract rail row (no toggle, status chip).
  const renderExistingRow = (kind, contractObj) => {
    const meta = kindMeta(kind);
    const isFocused = focused === kind;
    const eff = (window.effectiveStatus && contractObj) ? window.effectiveStatus(contractObj) : 'ACTIVE';
    const statusTone = { ACTIVE: 'success', SIGNED: 'success', SUSPENDED: 'error', EXPIRED: 'warning' }[String(eff).toUpperCase()] || 'neutral';
    const statusWord = { ACTIVE: 'Active', SIGNED: 'Active', SUSPENDED: 'Suspended', EXPIRED: 'Expired' }[String(eff).toUpperCase()] || eff;
    const kindErrs = errorsByKind?.[kind];
    const hasErr = kindErrs && Object.keys(kindErrs).length > 0;
    return (
      <div
        key={kind}
        className={`cab-railrow is-on ${isFocused ? 'is-focused' : ''} ${hasErr ? 'has-error' : ''}`}
        onClick={() => setFocusedKind(kind)}
        role="button" tabIndex={0}
      >
        <div className={`pick-card__icon pick-card__icon--${meta.iconClass}`} style={{ width: 32, height: 32, borderRadius: 7 }}>
          <Icon name={meta.iconName} size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cab-railrow__title">{kind}</div>
          <div className="cab-railrow__sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`tds-badge tds-badge--${statusTone}`} style={{ padding: '1px 6px', fontSize: 10.5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>{statusWord}
            </span>
            {hasErr && (
              <span style={{ color: 'var(--color-error-700)', fontSize: 11, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Icon name="alert" size={10}/>{Object.keys(kindErrs).length} error{Object.keys(kindErrs).length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`cab ${compact ? 'cab--compact' : ''}`}>
      {/* ── Left rail ──────────────────────────────────────── */}
      <aside className="cab__rail">
        {isManageMode && existingByKind ? (() => {
          // Existing contracts come from the customer's actual contract
          // list — INCLUDING kinds that may no longer be addable (e.g.
          // legacy MERCHANT contracts when ADMIN can no longer issue
          // MERCHANT directly). Those still render in the Active section
          // so admins can edit clauses / terminate them.
          // Addable kinds are filtered by availableKinds AND must NOT be
          // already held by the customer.
          const existingKinds = Object.keys(existingByKind);
          const addableKinds  = (availableKinds || []).filter((k) => !existingByKind[k]);
          return (
            <>
              {existingKinds.length > 0 && (
                <>
                  <div className="cab__group">Active <span className="cab__group-count">{existingKinds.length}</span></div>
                  {existingKinds.map((k) => renderExistingRow(k, existingByKind[k]))}
                </>
              )}
              {addableKinds.length > 0 && (
                <>
                  <div className="cab__group" style={{ marginTop: existingKinds.length > 0 ? 12 : 0 }}>
                    Available to add <span className="cab__group-count">{addableKinds.length}</span>
                  </div>
                  {addableKinds.map((k) => renderPickRow(k))}
                </>
              )}
            </>
          );
        })() : isEditMode ? (
          <>
            {focused && contract && renderExistingRow(focused, contract)}
          </>
        ) : (
          (availableKinds || []).map((kind) => renderPickRow(kind))
        )}
        <div className="cab__hint">
          <Icon name="info" size={12}/>
          <span>
            {isManageMode
              ? 'Click any row to edit · toggle a row to add a new contract.'
              : isEditMode
                ? 'Modify the clauses on the right · click Save to apply.'
                : 'Click a row to view its clauses · use the switch to enable/disable.'}
          </span>
        </div>
      </aside>

      {/* ── Right pane: term + clauses for focused kind ─────── */}
      <div className="cab__main">
        {!focused ? (
          <div className="empty" style={{ padding: '32px 20px', fontSize: 12.5 }}>
            No contract types available.
          </div>
        ) : (
          <>
            <div className="cab__mainhead">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div className={`pick-card__icon pick-card__icon--${focusedMeta.iconClass}`} style={{ width: 30, height: 30, borderRadius: 7, flex: 'none' }}>
                  <Icon name={focusedMeta.iconName} size={14}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {focused} <span className="muted" style={{ fontWeight: 400 }}>
                      · {focusedExistingContract ? 'edit clauses' : (isManageMode ? 'configure new' : 'clauses')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {focusedSchema.length === 0
                      ? 'No configurable clauses for this contract type.'
                      : `${focusedSchema.length} field${focusedSchema.length === 1 ? '' : 's'}`}
                  </div>
                </div>
              </div>
              {!isEditMode && !isManageMode && !focusedSelected && (
                <span style={{ fontSize: 11.5, color: 'var(--color-warning-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="alert" size={11}/>Type is disabled — toggle on to include it
                </span>
              )}
              {isManageMode && !focusedSelected && (
                <span style={{ fontSize: 11.5, color: 'var(--color-warning-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="alert" size={11}/>Toggle on in the rail to add this contract
                </span>
              )}
            </div>

            <div className="cab__form">
              {/* PILOT mode banner — surfaces above term editor so admins
                  know upfront why the dates / fees are locked. Renders
                  for any focused PILOT contract (new ISO default, ACTIVE
                  switched to PILOT manually, or existing PILOT being edited).

                  When this is a NEW contract (not existing), show the
                  [Pilot | Active] segmented control so admin can flip
                  the mode. Existing PILOT contracts must use Convert
                  via the row action button — not this segmented control. */}
              {focusedSelected && !focusedExistingContract && setModeByKind && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: 'var(--color-bg-3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                    <b>Contract mode</b>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {focusedIsPilot
                        ? 'Trial · 6-month window · fees locked at $0 · no billing'
                        : 'In force · fees apply · billing starts on effective date'}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', padding: 3, background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 8, gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => setModeByKind((m) => ({ ...(m || {}), [focused]: 'PILOT' }))}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 0, cursor: 'pointer',
                        font: '500 12px var(--font-family-sans)',
                        background: focusedIsPilot ? 'oklch(95% 0.04 280)' : 'transparent',
                        color: focusedIsPilot ? 'oklch(40% 0.16 280)' : 'var(--color-text-secondary)',
                        fontWeight: focusedIsPilot ? 600 : 500,
                      }}
                    >Pilot</button>
                    <button
                      type="button"
                      onClick={() => setModeByKind((m) => ({ ...(m || {}), [focused]: 'ACTIVE' }))}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 0, cursor: 'pointer',
                        font: '500 12px var(--font-family-sans)',
                        background: !focusedIsPilot ? 'var(--color-success-50)' : 'transparent',
                        color: !focusedIsPilot ? 'var(--color-success-700)' : 'var(--color-text-secondary)',
                        fontWeight: !focusedIsPilot ? 600 : 500,
                      }}
                    >Active</button>
                  </div>
                </div>
              )}

              {focusedSelected && focusedIsPilot && (
                <div style={{
                  display: 'flex', gap: 10, padding: '10px 12px',
                  background: 'oklch(95% 0.04 280)',
                  border: '1px solid oklch(80% 0.10 280 / 0.4)',
                  color: 'oklch(38% 0.15 280)',
                  borderRadius: 8, fontSize: 12.5, lineHeight: 1.5,
                }}>
                  <Icon name="sparkles" size={14} style={{ flex: 'none', marginTop: 2 }}/>
                  <div>
                    <b>PILOT contract</b> — 180-day trial · all fees locked at $0.
                    {' '}{focusedExistingContract
                      ? 'Use "Convert to active" from the contract row menu when ready to start billing.'
                      : 'Convert to active later when ready to start billing. Devices and feature toggles can still be configured below.'}
                  </div>
                </div>
              )}

              {/* Term editor — every contract has an effective date range,
                  independent of whether it has clauses. So we render it
                  for ANY selected kind, even ISV / Distributor whose
                  schema is empty. Only hidden in legacy callers that
                  don't pass `terms`/`setTerms`.
                  PILOT contracts auto-lock both dates (effectiveFrom =
                  today, effectiveTo = +180d). Admins extend via the
                  contract row menu later. */}
              {terms && setTerms && focusedSelected && (() => {
                const pilotLockEffFrom = focusedIsPilot;
                const pilotLockEffTo   = focusedIsPilot;
                return (
                  <div className="cab-termrow">
                    <Field label="Effective from" hint={pilotLockEffFrom ? 'Pilot starts today.' : 'Date the contract takes effect.'}>
                      <Input
                        type="date"
                        disabled={pilotLockEffFrom}
                        value={focusedTerms.effectiveFrom ? String(focusedTerms.effectiveFrom).slice(0, 10) : ''}
                        onChange={(e) => setTermField('effectiveFrom', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : '')}
                        style={!focusedTerms.effectiveFrom ? { color: 'var(--color-text-tertiary)' } : undefined}
                      />
                    </Field>
                    <Field label="Effective to" hint={pilotLockEffTo ? 'Auto-set to +180 days. Use Extend / Convert to change.' : 'Leave blank for no end date.'}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Input
                          type="date"
                          disabled={pilotLockEffTo}
                          value={focusedTerms.effectiveTo ? String(focusedTerms.effectiveTo).slice(0, 10) : ''}
                          onChange={(e) => setTermField('effectiveTo', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : null)}
                          style={!focusedTerms.effectiveTo ? { flex: 1, color: 'var(--color-text-tertiary)' } : { flex: 1 }}
                        />
                        {focusedTerms.effectiveTo && !pilotLockEffTo && (
                          <Btn variant="ghost" size="sm" onClick={() => setTermField('effectiveTo', null)}>Clear</Btn>
                        )}
                      </div>
                    </Field>
                  </div>
                );
              })()}

              {focusedSchema.length === 0 ? (
                <div className="empty" style={{ padding: '20px 14px', fontSize: 12.5 }}>
                  {focused} contracts have no configurable clauses in the current model.
                  {!isEditMode && !isManageMode && !focusedSelected && ' Toggle the type on to create it with default settings.'}
                  {focusedSelected && ' Set the effective dates above — that\'s all that\'s required.'}
                </div>
              ) : (
                focusedSchema.map((f) => {
                  const err = focusedSelected ? focusedErrors[f.key] : null;
                  // Contract-level currency drives price/feature row labels.
                  // Defaults to USD until the admin picks one.
                  const settlementCurrency = focusedEnts.settlementCurrency || 'USD';
                  // PILOT mode disables price + feature fields (forces $0
                  // per spec §1.2). currency + models stay editable.
                  const pilotLocked = focusedIsPilot && (f.type === 'price' || f.type === 'feature');
                  return (
                    <Field
                      key={f.key}
                      label={<>{f.label}{f.required && <span style={{ color: 'var(--color-error-700)' }}> *</span>}</>}
                      hint={pilotLocked ? 'Pilot · locked at $0 (configure during convert-to-active)' : `${f.help || ''}${f.unit ? ` · ${f.unit}` : ''}`}
                      error={err}
                    >
                      <ClauseInput
                        clause={f}
                        value={focusedEnts[f.key]}
                        onChange={(v) => setField(f.key, v)}
                        disabled={!focusedSelected || pilotLocked}
                        error={err}
                        currency={settlementCurrency}
                      />
                    </Field>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────
const CSS = `
.cab { display: grid; grid-template-columns: 240px 1fr; min-height: 380px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); overflow: hidden; background: var(--color-bg-2); }
.cab--compact { min-height: 340px; }
.cab__rail {
  border-right: 1px solid var(--color-border-subtle);
  padding: var(--space-3) var(--space-3) var(--space-2);
  display: flex; flex-direction: column; gap: 4px;
  background: var(--color-bg-1);
}
.cab__hint {
  margin-top: auto;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-3);
  border-radius: var(--radius-md);
  font-size: 11px;
  color: var(--color-text-tertiary);
  display: flex; gap: 6px; align-items: flex-start;
  line-height: 1.45;
}
.cab__hint svg { margin-top: 1px; flex: none; }

.cab-railrow {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 9px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--duration-fast), border-color var(--duration-fast);
}
.cab-railrow:hover { background: var(--color-bg-hover); }
.cab-railrow.is-focused { background: var(--color-bg-2); border-color: var(--color-border-default); box-shadow: var(--shadow-1); }
.cab-railrow.is-on { background: var(--color-primary-50); border-color: oklch(60% 0.14 262 / 0.25); }
.cab-railrow.is-on.is-focused { background: var(--color-primary-50); border-color: var(--color-primary-700); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.08); }
.cab-railrow.has-error { border-color: var(--color-error-500); }
.cab-railrow__title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); line-height: 1.2; }
.cab-railrow__sub   { font-size: 11.5px; color: var(--color-text-secondary); margin-top: 2px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cab-tog {
  width: 28px; height: 16px; border-radius: 999px;
  border: 0; background: var(--color-border-strong);
  position: relative; cursor: pointer; padding: 0; flex: none;
  transition: background var(--duration-fast);
}
.cab-tog__dot {
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.2);
  transition: left var(--duration-fast);
}
.cab-tog.is-on { background: var(--color-success-500); }
.cab-tog.is-on .cab-tog__dot { left: 14px; }

.cab__main {
  padding: var(--space-4) var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-3);
  min-width: 0;
  overflow-y: auto;
  max-height: 70vh;
}
.cab__mainhead {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}
.cab__form {
  display: flex; flex-direction: column;
  gap: var(--space-3);
}

/* Edit-mode meta strip: lives in the rail below the single contract row,
   shows authorizing entity / effective range / id without crowding the
   row itself. */
.cab-editmeta {
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-3);
  background: var(--color-bg-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  display: flex; flex-direction: column; gap: 6px;
}
.cab-editmeta__row {
  display: flex; flex-direction: column; gap: 1px;
  font-size: 11.5px;
}
.cab-editmeta__lbl {
  font: 500 10px var(--font-family-mono);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cab-editmeta__val {
  color: var(--color-text-primary);
  font-weight: 500;
  line-height: 1.3;
  word-break: break-word;
}

/* Manage-mode rail group headers (Active / Available to add). Compact
   mono caps separator between the two row groups. */
.cab__group {
  font: 600 10px var(--font-family-mono);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 6px 8px 4px;
  display: flex; align-items: center; gap: 6px;
}
.cab__group-count {
  font-weight: 500;
  color: var(--color-text-tertiary);
  background: var(--color-bg-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  padding: 0 6px;
  font-size: 10px;
}

/* Term editor row — Effective from / Effective to side-by-side above
   the clauses form. Compact two-column grid that collapses on narrow. */
.cab-termrow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-1);
  border-bottom: 1px dashed var(--color-border-subtle);
}
`;
if (typeof document !== 'undefined' && !document.getElementById('cab-styles')) {
  const el = document.createElement('style');
  el.id = 'cab-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

Object.assign(window, { ContractAssignBoard, collectAssignErrors, kindToSchemaKey });
