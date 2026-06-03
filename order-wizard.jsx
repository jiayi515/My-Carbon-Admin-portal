/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, CompanyLogo, useToast, Modal,
   DEVICE_MODELS, ModelTile, moneyUSD, orderSubtotal, orderTotal, emptyDevices */
const { useState, useMemo } = React;

// ─── Stepper (re-uses .stepper classes from main stylesheet) ────────────────
const OrderStepper = ({ step }) => {
  const items = [
    { n: 1, sub: 'Step 1', label: 'Customer' },
    { n: 2, sub: 'Step 2', label: 'Models & quantities' },
    { n: 3, sub: 'Step 3', label: 'Pricing & discount' },
    { n: 4, sub: 'Done',   label: 'Review & create' },
  ];
  return (
    <div className="stepper">
      {items.map((it, i) => (
        <React.Fragment key={it.n}>
          <div className={`stepper__item ${step === it.n ? 'is-active' : ''} ${step > it.n ? 'is-done' : ''}`}>
            <div className="stepper__dot">{step > it.n ? <Icon name="check" size={14}/> : it.n}</div>
            <div className="stepper__lbl"><small>{it.sub}</small><strong>{it.label}</strong></div>
          </div>
          {i < items.length - 1 && <div className={`stepper__bar ${step > it.n ? 'is-done' : ''}`}/>}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Step 1 — Customer picker ──────────────────────────────────────────────
const StepCustomer = ({ customers, customerId, setCustomerId, shipping, setShipping }) => {
  const [q, setQ] = useState('');
  const filtered = customers.filter(c =>
    !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.address.toLowerCase().includes(q.toLowerCase())
  );
  const selected = customers.find(c => c.id === customerId);

  // Auto-populate shipping address when a customer is picked (if blank)
  React.useEffect(() => {
    if (selected && !shipping.address) {
      const admin = selected.operators.find(o => o.role === 'Admin') || selected.operators[0];
      setShipping({
        name: admin?.name || '',
        address: selected.address,
        method: 'Standard ground',
      });
    }
  }, [selected]);

  return (
    <div className="tds-card">
      <div className="tds-card__header">
        <div>
          <div className="tds-card__title">Choose customer</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Orders are billed and shipped to the selected customer company.</div>
        </div>
      </div>
      <div className="tds-card__body">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} size="md"/>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflow: 'auto', border: '1px solid var(--color-border-default)', borderRadius: 10, padding: 6 }}>
          {filtered.length === 0 && <div className="empty" style={{ padding: 24 }}>No customers found.</div>}
          {filtered.map(c => {
            const on = c.id === customerId;
            return (
              <button key={c.id}
                onClick={() => setCustomerId(c.id)}
                className={`role-item ${on ? 'is-on' : ''}`}
                style={{ borderBottom: 'none', borderRadius: 8 }}>
                <CompanyLogo name={c.name} size={32}/>
                <div className="role-item__main">
                  <div className="role-item__name">{c.name}</div>
                  <div className="role-item__meta">{c.address.split(',').slice(-2).join(',').trim()} · {c.operators.length} operators</div>
                </div>
                <Badge tone={c.status === 'Active' ? 'success' : c.status === 'Onboarding' ? 'info' : 'error'} dot>{c.status}</Badge>
              </button>
            );
          })}
        </div>

        {selected && (
          <div style={{ marginTop: 18, padding: 14, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="truck" size={13}/> Shipping address
            </div>
            <div className="form-grid form-grid--2" style={{ gap: 14 }}>
              <Field label="Recipient">
                <Input value={shipping.name} onChange={e => setShipping({ ...shipping, name: e.target.value })} placeholder="Name"/>
              </Field>
              <Field label="Method">
                <Select value={shipping.method} onChange={e => setShipping({ ...shipping, method: e.target.value })}>
                  <option>Standard ground</option>
                  <option>Express overnight</option>
                  <option>International express</option>
                  <option>Freight</option>
                  <option>Customer pickup</option>
                </Select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Address">
                <Textarea value={shipping.address} onChange={e => setShipping({ ...shipping, address: e.target.value })} rows={2}/>
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Step 2 — Models & quantities ──────────────────────────────────────────
// One CARD per model. Inside the card: shared model identity + shared
// unit price (one value applies to every Type variant of this model),
// then one ROW per Type variant with its own quantity and line total.
// SKU = (modelId, type); we still store one item per SKU in `items`,
// but render them grouped so the operator sees the model as one entity.
const ModelGroup = ({ group, onChangeType, onRemoveType, onRemoveGroup, onPriceChange, onAddType }) => {
  const model = DEVICE_MODELS.find(m => m.id === group.modelId);
  if (!model) return null;
  // Shared unit price for this model — taken from the first sub-row.
  // (When the user edits the price, every sub-row in the group is
  // updated together so they always agree.)
  const unitPrice = Number.isFinite(group.items[0]?.unitPrice) ? group.items[0].unitPrice : model.unitPrice;
  const isOverride = Math.abs(unitPrice - model.unitPrice) > 0.005;
  const groupQty   = group.items.reduce((n, i) => n + i.qty, 0);
  const groupTotal = unitPrice * groupQty;
  const usedTypes  = new Set(group.items.map(i => i.type));
  const remainingTypes = model.types.filter(t => !usedTypes.has(t));

  const handlePriceChange = (raw) => {
    const cleaned = String(raw).replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const safe = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2) : cleaned;
    const n = safe === '' || safe === '.' ? 0 : parseFloat(safe);
    onPriceChange(Math.max(0, Number.isFinite(n) ? n : 0));
  };

  const labelStyle = { fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 5 };

  return (
    <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Card header — identity + shared unit price + group total + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <ModelTile model={model} px={48}/>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.name}</div>
          <div className="cust-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {model.family} · List {moneyUSD(model.unitPrice)}
          </div>
        </div>

        {/* Shared unit price — editable, applies to all types in this group */}
        <div style={{ minWidth: 188 }}>
          <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span>Unit price{isOverride && <span style={{ color: 'var(--color-warning-700)', marginLeft: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· override</span>}</span>
            {isOverride && (
              <button
                type="button"
                onClick={() => onPriceChange(model.unitPrice)}
                title={`Reset to list price ${moneyUSD(model.unitPrice)}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 4, border: 0, background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 10.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                <Icon name="rotate" size={10}/> Reset
              </button>
            )}
          </div>
          <div title="Shared unit price — applies to all types of this model" style={{ display: 'flex', alignItems: 'center', border: `1px solid ${isOverride ? 'var(--color-warning-500)' : 'var(--color-border-default)'}`, borderRadius: 8, background: 'var(--color-bg-2)', padding: '0 10px', height: 34 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginRight: 4 }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={unitPrice.toFixed(2)}
              onChange={e => handlePriceChange(e.target.value)}
              onFocus={e => e.target.select()}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--color-text-primary)', outline: 'none', padding: '4px 0' }}
              aria-label="Unit price"/>
          </div>
        </div>

        {/* Group total */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2, minWidth: 96 }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}>Group total</div>
          <div className="num" style={{ fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{moneyUSD(groupTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {groupQty} unit{groupQty === 1 ? '' : 's'}
          </div>
        </div>

        <button className="iconbtn" onClick={onRemoveGroup} title="Remove this model from the order" style={{ alignSelf: 'flex-start' }}>
          <Icon name="trash" size={14}/>
        </button>
      </div>

      {/* Type sub-rows — one row per (modelId, type) SKU */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {group.items.map((it, i) => (
          <div key={it.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 144px 110px 28px',
            alignItems: 'center', gap: 14, padding: '10px 16px',
            borderTop: i === 0 ? 0 : '1px solid var(--color-border-subtle)',
          }}>
            {/* Type — inline select with badge preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '6px 10px 6px 11px', height: 32,
                  borderRadius: 8, border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-2)', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 500,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: it.type === 'Semi-integration' ? 'var(--color-accent-700)' : 'var(--color-success-700)',
                  }}/>
                  <span style={{ color: 'var(--color-text-primary)' }}>{it.type}</span>
                  <Icon name="chevD" size={12} style={{ color: 'var(--color-text-tertiary)', marginLeft: 2 }}/>
                </div>
                <select value={it.type}
                  onChange={e => onChangeType(it.id, e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', font: 'inherit' }}
                  title="Change device type">
                  {model.types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Quantity stepper */}
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border-default)', borderRadius: 8, background: 'var(--color-bg-2)', height: 32, width: 144 }}>
              <button className="iconbtn" style={{ borderRadius: '8px 0 0 8px', height: 30 }} onClick={() => onChangeType(it.id, it.type, Math.max(1, it.qty - 1))}><Icon name="minus" size={12}/></button>
              <input value={it.qty}
                onChange={e => onChangeType(it.id, it.type, Math.max(1, parseInt(e.target.value || '1', 10)))}
                style={{ flex: 1, width: 0, border: 0, background: 'transparent', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none' }}/>
              <button className="iconbtn" style={{ borderRadius: '0 8px 8px 0', height: 30 }} onClick={() => onChangeType(it.id, it.type, it.qty + 1)}><Icon name="plus" size={12}/></button>
            </div>

            {/* Sub-row line total */}
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{moneyUSD(unitPrice * it.qty)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                {moneyUSD(unitPrice)} × {it.qty}
              </div>
            </div>

            {/* Remove sub-row (only when 2+ types exist in this group) */}
            <button
              className="iconbtn"
              onClick={() => onRemoveType(it.id)}
              disabled={group.items.length === 1}
              title={group.items.length === 1 ? 'Remove the model instead' : `Remove ${it.type} from this model`}
              style={{ opacity: group.items.length === 1 ? 0.3 : 1 }}>
              <Icon name="trash" size={13}/>
            </button>
          </div>
        ))}

        {/* Add-another-type pill — only if model supports more types */}
        {remainingTypes.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start',
            padding: '8px 16px 14px',
            borderTop: '1px dashed var(--color-border-subtle)',
            background: 'var(--color-bg-3)',
            gap: 8, flexWrap: 'wrap',
          }}>
            {remainingTypes.map(t => (
              <button key={t} type="button" onClick={() => onAddType(t)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 8px', borderRadius: 999,
                  background: 'var(--color-bg-2)', border: '1px dashed var(--color-border-strong)',
                  color: 'var(--color-text-secondary)', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, font: 'inherit',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderStyle = 'solid'; e.currentTarget.style.background = 'var(--color-primary-50)'; e.currentTarget.style.color = 'var(--color-primary-700)'; e.currentTarget.style.borderColor = 'var(--color-primary-500)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderStyle = 'dashed'; e.currentTarget.style.background = 'var(--color-bg-2)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}>
                <Icon name="plus" size={11}/>
                Add <strong style={{ color: 'inherit', fontWeight: 600 }}>{t}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StepModels = ({ items, setItems }) => {
  // Type-picker modal state: when set, we're asking the user to pick a
  // Type before the model is added to the order. null = closed.
  const [typePicker, setTypePicker] = useState(null); // { modelId, type, qty }

  // Helper: open the type-picker for a model. Defaults Type to the first
  // available and pre-fills the qty to whatever is already in the order
  // for that (model, type) — so editing an existing SKU shows its real
  // total and the operator just dials to the target. New SKU starts at 1.
  const openPicker = (modelId) => {
    const m = DEVICE_MODELS.find(x => x.id === modelId);
    if (!m) return;
    const t = m.types[0];
    const existing = items.find(i => i.modelId === modelId && i.type === t);
    setTypePicker({ modelId, type: t, qty: existing ? existing.qty : 1 });
  };

  // When the user switches Type inside the modal, re-sync the qty to that
  // type's existing total (or 1 if new). Keeps the picker honest.
  const pickerSetType = (newType) => {
    if (!typePicker) return;
    const existing = items.find(i => i.modelId === typePicker.modelId && i.type === newType);
    setTypePicker({ ...typePicker, type: newType, qty: existing ? existing.qty : 1 });
  };

  // Commit the picker. SET semantics: for an existing SKU the line's
  // qty is REPLACED with the picker value (since we pre-filled with
  // the current total, the user has been editing the actual total);
  // for a new SKU a fresh line is appended.
  const commitPickedModel = () => {
    if (!typePicker) return;
    const m = DEVICE_MODELS.find(x => x.id === typePicker.modelId);
    if (!m) return;
    const targetQty = Math.max(1, typePicker.qty || 1);
    const existing = items.findIndex(i => i.modelId === m.id && i.type === typePicker.type);
    if (existing >= 0) {
      const next = items.slice();
      const cur = next[existing];
      // Only rebuild the device slots if qty actually changed; preserve
      // existing activation work otherwise.
      const devices = targetQty !== cur.qty ? emptyDevices(targetQty) : (cur.devices || emptyDevices(targetQty));
      next[existing] = { ...cur, qty: targetQty, devices };
      setItems(next);
    } else {
      setItems([
        ...items,
        { id: `li-${Date.now()}`, modelId: m.id, modelName: m.name, unitPrice: m.unitPrice, qty: targetQty, type: typePicker.type, devices: emptyDevices(targetQty) },
      ]);
    }
    setTypePicker(null);
  };

  const updateItem = (id, patch) => {
    // Change qty or type for an item by id. If the user changes Type to
    // one another sub-row already has, merge into the duplicate and drop
    // this row — preserving SKU uniqueness.
    const idx = items.findIndex(it => it.id === id);
    if (idx < 0) return;
    const cur  = items[idx];
    const next = { ...cur, ...patch };
    if (patch.type && patch.type !== cur.type) {
      const dupIdx = items.findIndex((it, i) => i !== idx && it.modelId === cur.modelId && it.type === next.type);
      if (dupIdx >= 0) {
        const mergedQty = items[dupIdx].qty + next.qty;
        const merged = { ...items[dupIdx], qty: mergedQty, devices: emptyDevices(mergedQty) };
        setItems(items.map((it, i) => i === dupIdx ? merged : it).filter((_, i) => i !== idx));
        return;
      }
    }
    setItems(items.map((it, i) => {
      if (i !== idx) return it;
      const devices = next.qty !== it.qty ? emptyDevices(next.qty) : (next.devices || it.devices);
      return { ...next, devices };
    }));
  };

  // Per-type qty / type change on a sub-row.
  const handleChangeType = (itemId, newType, newQty) => {
    const patch = {};
    if (newType !== undefined) patch.type = newType;
    if (newQty  !== undefined) patch.qty  = Math.max(1, newQty);
    updateItem(itemId, patch);
  };
  // Remove one sub-row (one Type) from a model card.
  const handleRemoveType = (itemId) => setItems(items.filter(it => it.id !== itemId));
  // Remove the entire model card (all its types).
  const handleRemoveGroup = (modelId) => setItems(items.filter(it => it.modelId !== modelId));
  // Shared unit price — propagate the new value to every sub-row of
  // this model so all types of the same model share one price.
  const handlePriceChange = (modelId, newPrice) => {
    setItems(items.map(it => it.modelId === modelId ? { ...it, unitPrice: newPrice } : it));
  };
  // "Add another Type" pill inside a model card — opens the picker
  // pre-filled with the requested type so the user can confirm qty.
  const handleAddType = (modelId, type) => {
    setTypePicker({ modelId, type, qty: 1 });
  };

  return (
    <div className="tds-card">
      <div className="tds-card__header">
        <div>
          <div className="tds-card__title">Models & quantities</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Add one or more models. An order can contain any number of model lines.</div>
        </div>
      </div>
      <div className="tds-card__body">

        {/* Existing lines — grouped per model */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, border: '1px dashed var(--color-border-default)', borderRadius: 10 }}>
              No models yet. Add your first model below.
            </div>
          )}
          {(() => {
            // Build groups preserving the insertion order of model first-seen.
            const byModel = new Map();
            items.forEach(it => {
              if (!byModel.has(it.modelId)) byModel.set(it.modelId, { modelId: it.modelId, items: [] });
              byModel.get(it.modelId).items.push(it);
            });
            return Array.from(byModel.values()).map(group => (
              <ModelGroup key={group.modelId}
                group={group}
                onChangeType={handleChangeType}
                onRemoveType={handleRemoveType}
                onRemoveGroup={() => handleRemoveGroup(group.modelId)}
                onPriceChange={(p) => handlePriceChange(group.modelId, p)}
                onAddType={(t) => handleAddType(group.modelId, t)}/>
            ));
          })()}
        </div>

        {/* Adder — always visible so models can be added without an extra click. */}
        <div style={{ marginTop: items.length > 0 ? 16 : 12, padding: 12, background: 'var(--color-bg-3)', border: '1px dashed var(--color-border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Add a model</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
              Pick a model → choose type → add to order
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEVICE_MODELS.map(m => {
              const inOrderQty = items.filter(i => i.modelId === m.id).reduce((n, i) => n + i.qty, 0);
              return (
                <button key={m.id} onClick={() => openPicker(m.id)}
                  className="role-item" style={{ borderRadius: 8, borderBottom: 'none', background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)' }}>
                  <ModelTile model={m} px={35}/>
                  <div className="role-item__main">
                    <div className="role-item__name">{m.name}</div>
                    <div className="role-item__meta">
                      {m.family} · {moneyUSD(m.unitPrice)} ea
                      {inOrderQty > 0 && <> · <span style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>{inOrderQty} in order</span></>}
                    </div>
                  </div>
                  <Icon name="plus" size={14}/>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Type-picker modal (opens after a model is clicked, before it's added) */}
      <TypePickerModal
        picker={typePicker}
        setPicker={setTypePicker}
        onType={pickerSetType}
        items={items}
        onConfirm={commitPickedModel}/>
    </div>
  );
};

// ─── Type-picker modal — opens after a model is selected ─────────────────
// Lets the operator pick Semi-integration / Stand-alone (and qty) before
// the line lands in the order. Same SKU stacks; different Type adds a new
// line. Stays as a self-contained component so the parent only has to
// hand it `picker` (the in-progress selection) and `onConfirm`.
const TypePickerModal = ({ picker, setPicker, onType, items, onConfirm }) => {
  if (!picker) return null;
  const m = DEVICE_MODELS.find(x => x.id === picker.modelId);
  if (!m) return null;
  const targetQty = Math.max(1, picker.qty || 1);
  // Existing line for the SKU currently selected in the modal. When
  // present we're editing its total; when absent we're creating a new
  // line. The qty was pre-filled by the parent so `targetQty` is the
  // operator's intended final total.
  const sameSku = items.find(i => i.modelId === m.id && i.type === picker.type);
  const total = m.unitPrice * targetQty;
  const delta = sameSku ? targetQty - sameSku.qty : null; // +/- vs existing

  // Per-type existing qty lookup — surfaced next to each radio so the
  // operator sees what they already have for both types at a glance.
  const existingByType = Object.fromEntries(
    m.types.map(t => [t, items.find(i => i.modelId === m.id && i.type === t)?.qty || 0])
  );

  // Type descriptions help non-expert operators choose correctly.
  const typeDesc = {
    'Semi-integration': 'Drives a host POS or cash register via the device SDK / API.',
    'Stand-alone':      'Runs the full payment flow on the device itself, no host required.',
  };

  return (
    <Modal open onClose={() => setPicker(null)}
      title={sameSku ? `Update ${m.name} in order` : `Add ${m.name} to order`}
      width={520}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setPicker(null)}>Cancel</Btn>
          <Btn variant="primary" icon={sameSku ? 'check' : 'plus'} onClick={onConfirm} disabled={sameSku && delta === 0}>
            {sameSku ? `Update to ${targetQty}` : `Add ${targetQty} to order`}
          </Btn>
        </div>
      )}>

      {/* Model identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0 16px' }}>
        <ModelTile model={m} px={56}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.005em' }}>{m.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {m.family} · {moneyUSD(m.unitPrice)} per unit
          </div>
        </div>
      </div>

      {/* Type radio cards — each shows current qty in the order so the
          operator immediately knows what's already booked per type. */}
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
        Device type
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.types.map(t => {
          const on = picker.type === t;
          const existQty = existingByType[t];
          return (
            <button key={t} type="button" onClick={() => onType(t)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: on ? 'var(--color-primary-50)' : 'var(--color-bg-2)',
                border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
                boxShadow: on ? '0 0 0 3px oklch(40% 0.14 262 / 0.08)' : 'none',
                textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
                transition: 'all 0.12s',
              }}>
              <span style={{
                marginTop: 2, width: 16, height: 16, borderRadius: '50%', flex: 'none',
                border: `1.5px solid ${on ? 'var(--color-primary-700)' : 'var(--color-border-strong)'}`,
                display: 'grid', placeItems: 'center',
              }}>
                {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary-700)' }}/>}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{t}</span>
                  {existQty > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '1px 7px', borderRadius: 999,
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
                      background: 'var(--color-bg-3)', color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-default)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      In order: {existQty}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>
                  {typeDesc[t] || ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quantity — "Quantity in order" so it's clear we're editing the
          TOTAL for this SKU, not adding an increment. */}
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', flex: 'none' }}>
          {sameSku ? 'Quantity (total)' : 'Quantity'}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border-default)', borderRadius: 8, background: 'var(--color-bg-2)', height: 34 }}>
          <button type="button" className="iconbtn" style={{ borderRadius: '8px 0 0 8px', height: 32 }}
            onClick={() => setPicker({ ...picker, qty: Math.max(1, (picker.qty || 1) - 1) })}>
            <Icon name="minus" size={12}/>
          </button>
          <input value={picker.qty}
            onChange={(e) => setPicker({ ...picker, qty: Math.max(1, parseInt(e.target.value || '1', 10)) })}
            onFocus={(e) => e.target.select()}
            style={{ width: 56, border: 0, background: 'transparent', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none' }}/>
          <button type="button" className="iconbtn" style={{ borderRadius: '0 8px 8px 0', height: 32 }}
            onClick={() => setPicker({ ...picker, qty: (picker.qty || 1) + 1 })}>
            <Icon name="plus" size={12}/>
          </button>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          = <strong style={{ color: 'var(--color-text-primary)', fontSize: 15 }}>{moneyUSD(total)}</strong>
        </div>
      </div>

      {/* Delta hint when editing an existing SKU — makes the change
          explicit (+N / −N / unchanged). */}
      {sameSku && (
        <div style={{
          marginTop: 14, padding: '10px 12px',
          background: delta === 0 ? 'var(--color-bg-3)' : delta > 0 ? 'oklch(96% 0.05 155 / 0.5)' : 'oklch(96.5% 0.04 80 / 0.5)',
          border: `1px solid ${delta === 0 ? 'var(--color-border-subtle)' : delta > 0 ? 'oklch(70% 0.12 155 / 0.3)' : 'oklch(70% 0.16 70 / 0.3)'}`,
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12,
          color: delta === 0 ? 'var(--color-text-secondary)' : delta > 0 ? 'var(--color-success-700)' : 'var(--color-warning-700)',
          lineHeight: 1.45,
        }}>
          <Icon name={delta === 0 ? 'info' : delta > 0 ? 'plus' : 'minus'} size={13}/>
          <span>
            {delta === 0
              ? <>No change — <strong>{m.name} · {picker.type}</strong> is already at <strong>×{sameSku.qty}</strong>.</>
              : delta > 0
                ? <>Will add <strong>{delta}</strong> more, bringing <strong>{m.name} · {picker.type}</strong> from ×{sameSku.qty} to <strong>×{targetQty}</strong>.</>
                : <>Will remove <strong>{-delta}</strong>, bringing <strong>{m.name} · {picker.type}</strong> from ×{sameSku.qty} to <strong>×{targetQty}</strong>.</>}
          </span>
        </div>
      )}
    </Modal>
  );
};

// ─── Step 3 — Pricing & discount ───────────────────────────────────────────
const StepPricing = ({ subtotal, discountPct, setDiscountPct }) => {
  const discountAmount = subtotal * (discountPct / 100);
  const total = subtotal - discountAmount;
  const free = total <= 0;
  return (
    <div className="tds-card">
      <div className="tds-card__header">
        <div>
          <div className="tds-card__title">Pricing & discount</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>You may apply any discount from 0% up to 100% (complimentary).</div>
        </div>
      </div>
      <div className="tds-card__body">

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Slider + presets */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 500 }}>Discount</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input type="number" min="0" max="100"
                value={discountPct}
                onChange={e => setDiscountPct(Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10))))}
                style={{ width: 80, fontSize: 28, fontWeight: 600, padding: '4px 8px', border: '1px solid var(--color-border-default)', borderRadius: 8, fontFamily: 'inherit', color: 'var(--color-text-primary)', background: 'var(--color-bg-2)', fontVariantNumeric: 'tabular-nums' }}/>
              <span style={{ fontSize: 24, color: 'var(--color-text-secondary)', fontWeight: 500 }}>%</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>off subtotal</span>
            </div>
            <input type="range" min="0" max="100" value={discountPct}
              onChange={e => setDiscountPct(parseInt(e.target.value, 10))}
              style={{ width: '100%', marginTop: 14, accentColor: 'var(--color-primary-700)' }}/>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {[0, 5, 10, 25, 50, 100].map(p => (
                <button key={p}
                  onClick={() => setDiscountPct(p)}
                  className={`perm-fchip ${discountPct === p ? 'is-on' : ''}`}>
                  {p === 100 ? 'Free' : `${p}%`}
                </button>
              ))}
            </div>
            {free && (
              <div className="notice" style={{ marginTop: 16, background: 'var(--color-success-50)', borderColor: 'oklch(58% 0.14 152 / 0.25)', color: 'var(--color-success-700)' }}>
                <Icon name="sparkles" size={14}/>
                <div>
                  <strong>Complimentary order.</strong> No payment required — the order will skip <em>Awaiting payment</em> and go straight to <em>Awaiting shipment</em>.
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 10 }}>Order total</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                <span className="num">{moneyUSD(subtotal)}</span>
              </div>
              {discountPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--color-success-700)' }}>
                  <span>Discount ({discountPct}%)</span>
                  <span className="num">− {moneyUSD(discountAmount)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--color-border-default)', margin: '6px 0' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 600, alignItems: 'baseline' }}>
                <span>Total</span>
                <span className="num" style={{ color: free ? 'var(--color-success-700)' : 'var(--color-text-primary)' }}>{free ? 'FREE' : moneyUSD(total)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                Next status: <strong style={{ color: free ? 'var(--color-info-700)' : 'var(--color-warning-700)' }}>{free ? 'Awaiting shipment' : 'Awaiting payment'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Step 4 — Review ───────────────────────────────────────────────────────
const StepReview = ({ customer, items, discountPct, shipping, notes, setNotes }) => {
  const subtotal = items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
  const total = subtotal * (1 - discountPct / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="tds-card">
        <div className="tds-card__header"><div className="tds-card__title">Review order</div></div>
        <div className="tds-card__body">
          <dl className="kvgrid" style={{ gridTemplateColumns: '120px 1fr' }}>
            <dt>Customer</dt><dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CompanyLogo name={customer.name} size={24}/> <strong>{customer.name}</strong>
            </dd>
            <dt>Ship to</dt><dd>{shipping.name} · {shipping.method}<br/><span style={{ color: 'var(--color-text-tertiary)' }}>{shipping.address}</span></dd>
          </dl>
        </div>
      </div>

      <div className="tds-card">
        <div className="tds-card__header"><div className="tds-card__title">Line items</div></div>
        <div style={{ padding: 0 }}>
          <table className="tds-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Unit</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td><strong>{i.modelName}</strong></td>
                  <td>{i.type}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{moneyUSD(i.unitPrice)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{i.qty}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{moneyUSD(i.unitPrice * i.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>Subtotal</td>
                <td className="num" style={{ textAlign: 'right' }}>{moneyUSD(subtotal)}</td>
              </tr>
              {discountPct > 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', color: 'var(--color-success-700)' }}>Discount ({discountPct}%)</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--color-success-700)' }}>− {moneyUSD(subtotal * discountPct / 100)}</td>
                </tr>
              )}
              <tr>
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600, fontSize: 15 }}>Total</td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 600, fontSize: 15, color: total === 0 ? 'var(--color-success-700)' : 'var(--color-text-primary)' }}>
                  {total === 0 ? 'FREE' : moneyUSD(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="tds-card">
        <div className="tds-card__body">
          <Field label="Internal notes" hint="Visible only to Carbon staff.">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional — e.g. quarterly refresh batch, evaluation units…"/>
          </Field>
        </div>
      </div>
    </div>
  );
};

// ─── Wizard shell ──────────────────────────────────────────────────────────
const OrderWizard = ({ customers, onCancel, onComplete }) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [shipping, setShipping] = useState({ name: '', address: '', method: 'Standard ground' });
  const [items, setItems] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [notes, setNotes] = useState('');

  const customer = customers.find(c => c.id === customerId);
  const subtotal = items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
  const total = subtotal * (1 - discountPct / 100);

  const canNext = useMemo(() => {
    if (step === 1) return !!customerId && !!shipping.address.trim();
    if (step === 2) return items.length > 0 && items.every(i => i.qty > 0);
    if (step === 3) return true;
    return true;
  }, [step, customerId, shipping, items]);

  const submit = () => {
    if (!customer) return;
    const num = `SO-2026-${String(200 + Math.floor(Math.random() * 99)).padStart(4, '0')}`;
    const status = total === 0 ? 'Awaiting shipment' : 'Awaiting payment';
    const order = {
      id: 'o-' + Math.random().toString(36).slice(2, 8),
      number: num,
      customerId: customer.id,
      customerName: customer.name,
      createdAt: new Date().toISOString(),
      createdBy: 'jordan.d@carbon',
      status,
      items: items.map(i => ({ ...i, devices: emptyDevices(i.qty) })),
      discountPct,
      notes,
      shipping,
      events: [
        { at: new Date().toISOString(), kind: 'created', by: 'jordan.d@carbon', text: 'Order created' },
        ...(total === 0 ? [{ at: new Date().toISOString(), kind: 'free', by: 'jordan.d@carbon', text: 'Marked as complimentary · 100% discount' }] : [{ at: new Date().toISOString(), kind: 'invoice', by: 'system', text: 'Invoice issued' }]),
      ],
    };
    toast({ kind: 'success', title: `Order ${num} created`, msg: status === 'Awaiting payment' ? 'Invoice issued · awaiting payment' : 'No payment required · ready to ship' });
    onComplete(order);
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">New sample order</h1>
          <p className="page__sub">Create a sample device order for a customer company.</p>
        </div>
        <div className="page__actions">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </div>

      <OrderStepper step={step}/>

      <div className="wizard-grid">
        <div>
          {step === 1 && <StepCustomer customers={customers} customerId={customerId} setCustomerId={setCustomerId} shipping={shipping} setShipping={setShipping}/>}
          {step === 2 && <StepModels items={items} setItems={setItems}/>}
          {step === 3 && <StepPricing subtotal={subtotal} discountPct={discountPct} setDiscountPct={setDiscountPct}/>}
          {step === 4 && customer && <StepReview customer={customer} items={items} discountPct={discountPct} shipping={shipping} notes={notes} setNotes={setNotes}/>}

          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between' }}>
            <Btn variant="ghost" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))} icon="chevL">Back</Btn>
            {step < 4 ? (
              <Btn variant="primary" disabled={!canNext} onClick={() => setStep(s => s + 1)} iconRight="chevR">Continue</Btn>
            ) : (
              <Btn variant="primary" icon="check" onClick={submit}>Create order</Btn>
            )}
          </div>
        </div>

        {/* Summary aside */}
        <aside className="wizard-aside">
          <h4>Order summary</h4>
          <dl>
            <dt>Customer</dt><dd>{customer ? customer.name : <span className="muted">—</span>}</dd>
            <dt>Models</dt><dd>{(() => {
              const distinct = new Set(items.map(i => i.modelId)).size;
              return distinct === 0 ? <span className="muted">—</span> : `${distinct} model${distinct === 1 ? '' : 's'}`;
            })()}</dd>
            <dt>Units</dt><dd className="num">{items.reduce((n, i) => n + i.qty, 0)}</dd>
            <dt>Subtotal</dt><dd className="num">{moneyUSD(subtotal)}</dd>
            {discountPct > 0 && <><dt>Discount</dt><dd className="num" style={{ color: 'var(--color-success-700)' }}>− {moneyUSD(subtotal * discountPct / 100)}</dd></>}
            <dt style={{ paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>Total</dt>
            <dd style={{ paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)', fontWeight: 600, color: total === 0 ? 'var(--color-success-700)' : 'var(--color-text-primary)' }} className="num">
              {total === 0 ? 'FREE' : moneyUSD(total)}
            </dd>
          </dl>
          <div style={{ marginTop: 14, padding: 10, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Next:</strong> once created, the warehouse team will activate each device and enter its serial number plus six activation codes before shipping.
          </div>
        </aside>
      </div>
    </div>
  );
};

window.OrderWizard = OrderWizard;
