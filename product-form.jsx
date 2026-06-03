/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, useToast,
   DEVICE_MODELS, ModelTile, DEVICE_MODEL_IDS_ALLOWED,
   INTEGRATION_MODE_OPTIONS, DEVICE_NATURE_OPTIONS, DEVICE_SPEC_AXES,
   NETWORK_AXIS, STORAGE_AXIS, isInfiniteStock,
   effectiveStatus, PRODUCT_STATUS_TONE, PRODUCT_STATUS_LABEL,
   formatPriceRange, blankProduct, buildGridVariants,
   newAxisId, newValueId, newVariantId, productIntegrationModes */
const { useState, useRef, useEffect, useMemo } = React;

// ─── Image picker ───────────────────────────────────────────────
// For a Device product without an upload, we show the linked model artwork
// as a fallback preview (matches "use device default image" requirement).
const ImagePicker = ({ value, fallback, onChange, onClear, disabled }) => {
  const ref = useRef(null);
  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };
  if (value) {
    return (
      <div className="prod-img-picker">
        <div className="prod-img-picker__has">
          <img src={value} alt=""/>
          {!disabled && (
            <div className="prod-img-picker__actions">
              <Btn size="sm" variant="ghost" icon="upload" onClick={() => ref.current?.click()}>Replace</Btn>
              <Btn size="sm" variant="ghost" icon="trash" onClick={onClear}>Remove</Btn>
            </div>
          )}
          <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])}/>
        </div>
      </div>
    );
  }
  if (fallback) {
    return (
      <div className="prod-img-picker">
        <div className="prod-img-picker__has">
          <div className="prod-img-picker__fallback">{fallback}</div>
          {!disabled && (
            <div className="prod-img-picker__actions">
              <div className="prod-img-picker__fallback-lbl">
                Using device default image.<br/>
                Upload to override.
              </div>
              <Btn size="sm" variant="ghost" icon="upload" onClick={() => ref.current?.click()}>Upload image</Btn>
            </div>
          )}
          <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])}/>
        </div>
      </div>
    );
  }
  return (
    <div className="prod-img-picker">
      <div className={`prod-img-picker__empty ${disabled ? 'is-disabled' : ''}`} onClick={() => !disabled && ref.current?.click()}>
        <Icon name="upload" size={22}/>
        <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6 }}>Click to upload image</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>PNG / JPG / WebP · White background recommended · 1:1</div>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])}/>
    </div>
  );
};

// ─── Variant pricing matrix (grid of all combinations) ──────────
// Auto-generates one row per spec combination. The checkbox marks whether
// the combination is OFFERED (status=ACTIVE) — unchecked rows are dimmed
// in the editor and hidden from View options.
const VariantsMatrix = ({ product, onUpdateVariant, readOnly }) => {
  const axes = product.specs || [];
  if (!product.variants.length) return null;

  const allActive = product.variants.every((v) => v.status === 'ACTIVE');
  const anyActive = product.variants.some((v) => v.status === 'ACTIVE');

  const toggleAll = () => {
    const target = allActive ? 'UNAVAILABLE' : 'ACTIVE';
    product.variants.forEach((v) => onUpdateVariant(v.id, { status: target }));
  };
  const toggleOne = (variant) => {
    onUpdateVariant(variant.id, {
      status: variant.status === 'ACTIVE' ? 'UNAVAILABLE' : 'ACTIVE',
    });
  };

  return (
    <div>
      <table className="prod-variant-table">
        <thead>
          <tr>
            {!readOnly && (
              <th style={{ width: 36, paddingRight: 0 }}>
                <input type="checkbox"
                  checked={allActive}
                  ref={(el) => { if (el) el.indeterminate = anyActive && !allActive; }}
                  onChange={toggleAll}
                  title="Toggle all"/>
              </th>
            )}
            {axes.length === 0 ? (
              <th>Variant</th>
            ) : (
              <>
                {axes.map((a) => <th key={a.id}>{a.name}</th>)}
                <th>Spec name <span className="prod-th-hint">(shown in View options)</span></th>
              </>
            )}
            <th style={{ textAlign: 'right', width: 130 }}>Price</th>
            <th style={{ width: 200 }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((variant) => {
            const cells = axes.map((axis) =>
              axis.values.find((v) => v.id === variant.combination[axis.id])?.label || '—'
            );
            const isOn = variant.status === 'ACTIVE';
            const rowDisabled = readOnly || !isOn;
            return (
              <tr key={variant.id} className={`prod-variant-row ${isOn ? 'is-on' : 'is-off'}`}>
                {!readOnly && (
                  <td style={{ paddingRight: 0 }}>
                    <input type="checkbox"
                      checked={isOn}
                      onChange={() => toggleOne(variant)}
                      title={isOn ? 'Offered — uncheck to hide from View options' : 'Not offered — check to include'}/>
                  </td>
                )}
                {axes.length === 0 ? (
                  <td style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Base</td>
                ) : (
                  <>
                    {cells.map((c, i) => <td key={i} style={{ fontWeight: 500 }}>{c}</td>)}
                    <td>
                      <input className="prod-cell-input"
                        value={variant.label || ''}
                        placeholder={cells.join(' + ')}
                        onChange={(e) => onUpdateVariant(variant.id, { label: e.target.value })}
                        disabled={rowDisabled}/>
                    </td>
                  </>
                )}
                <td style={{ textAlign: 'right' }}>
                  <div className="prod-cell-money">
                    <span>$</span>
                    <input className="prod-cell-input prod-cell-input--right" type="number" step="0.01" min="0"
                      value={variant.price}
                      onChange={(e) => onUpdateVariant(variant.id, { price: parseFloat(e.target.value) || 0 })}
                      disabled={rowDisabled}/>
                  </div>
                </td>
                <td>
                  <StockEditor
                    variant={variant}
                    onChange={(patch) => onUpdateVariant(variant.id, patch)}
                    disabled={rowDisabled}/>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Stock = positive integer | null (null = "Always in stock")
const StockEditor = ({ variant, onChange, disabled }) => {
  const infinite = isInfiniteStock(variant.stock);
  return (
    <div className="prod-stock-cell">
      <input
        type="number" min="0" step="1"
        className="prod-cell-input prod-cell-input--right"
        style={{ width: 80, opacity: infinite ? 0.4 : 1 }}
        value={infinite ? '' : variant.stock}
        placeholder="0"
        disabled={disabled || infinite}
        onChange={(e) => onChange({ stock: Math.max(0, parseInt(e.target.value || '0', 10)) })}/>
      <label className="prod-stock-toggle">
        <input type="checkbox" checked={infinite}
          disabled={disabled}
          onChange={(e) => onChange({ stock: e.target.checked ? null : 0 })}/>
        <span>Always in stock</span>
      </label>
    </div>
  );
};

// ─── Spec axis editor (a single category card) ──────────────────
// Editable category name + chip list of values. Each value chip is
// inline-editable; an "Add value" input at the end appends a new value.
const SpecAxisEditor = ({ axis, readOnly, onRenameAxis, onRemoveAxis, onAddValue, onRenameValue, onRemoveValue }) => {
  const [newVal, setNewVal] = useState('');
  const submitNew = () => {
    if (!newVal.trim()) return;
    onAddValue(newVal);
    setNewVal('');
  };
  return (
    <div className="prod-axis-editor">
      <div className="prod-axis-editor__head">
        <input
          className="prod-axis-editor__name"
          value={axis.name}
          placeholder="Category name (e.g. Network)"
          onChange={(e) => onRenameAxis(e.target.value)}
          disabled={readOnly}/>
        {!readOnly && (
          <button type="button" className="prod-axis-editor__remove" onClick={onRemoveAxis} title="Remove category">
            <Icon name="trash" size={12}/>
          </button>
        )}
      </div>
      <div className="prod-axis-editor__values">
        {axis.values.map((v) => (
          <div key={v.id} className="prod-axis-chip">
            <input
              value={v.label}
              onChange={(e) => onRenameValue(v.id, e.target.value)}
              disabled={readOnly}/>
            {!readOnly && (
              <button type="button" className="prod-axis-chip__x" onClick={() => onRemoveValue(v.id)} title="Remove value">
                <Icon name="x" size={10}/>
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="prod-axis-add">
            <input
              value={newVal}
              placeholder="+ Add value"
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNew(); } }}
              onBlur={submitNew}/>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main form ──────────────────────────────────────────────────
const ProductForm = ({ initial, onCancel, onSave }) => {
  const [p, setP] = useState(initial || blankProduct());
  const isNew = !initial;
  const eff = effectiveStatus(p);
  const toast = useToast();

  const isReadOnly = p.status === 'ARCHIVED';
  const isListed   = p.status === 'LISTED';

  // Selectable device models
  const allowedModels = useMemo(
    () => (window.DEVICE_MODELS || []).filter((m) => DEVICE_MODEL_IDS_ALLOWED.includes(m.id)),
    []
  );
  const linkedModel = allowedModels.find((m) => m.id === p.deviceModelId)
    || (window.DEVICE_MODELS || []).find((m) => m.id === p.deviceModelId);

  // ─── Generic field update
  const update = (k, v) =>
    setP((x) => ({ ...x, [k]: v, updatedAt: new Date().toISOString() }));

  // ─── Type switch (Device vs Other)
  const setType = (t) => {
    if (isListed) {
      toast({ kind: 'warning', title: 'Cannot change type on a Listed product', msg: 'Delist this product first.' });
      return;
    }
    setP((x) => {
      const next = { ...x, type: t, updatedAt: new Date().toISOString() };
      if (t === 'DEVICE') {
        next.deviceModelId = x.deviceModelId || allowedModels[0]?.id || null;
        next.deviceVariant = x.deviceVariant || 'PRODUCTION';
        next.integrationModes = (x.integrationModes && x.integrationModes.length)
          ? x.integrationModes : ['Semi-integration', 'Stand-alone'];
      } else {
        next.deviceModelId = null;
        next.deviceVariant = null;
        next.integrationModes = [];
        // Other type has no device-spec axes
        next.specs = [];
        next.variants = [{
          id: newVariantId(), productId: x.id, sku: 'BASE', combination: {},
          label: '', price: x.basePrice || 0, image: null,
          status: 'ACTIVE', stockNote: '', stock: null,
        }];
      }
      return next;
    });
  };

  // ─── Integration modes (multi-select)
  const toggleIntegration = (mode) => {
    setP((x) => {
      const set = new Set(x.integrationModes || []);
      if (set.has(mode)) set.delete(mode); else set.add(mode);
      // Keep declared order
      const next = INTEGRATION_MODE_OPTIONS.filter((m) => set.has(m));
      return { ...x, integrationModes: next, updatedAt: new Date().toISOString() };
    });
  };

  // ─── Spec axes — fully editable (add category / add values / rename / remove)
  const rebuildVariants = (specs, basePrice) => buildGridVariants(p.id, specs, basePrice);

  // Add a new axis. If preset is supplied, populate values; otherwise blank.
  const addAxis = (preset) => {
    setP((x) => {
      const newAxis = preset
        ? { id: newAxisId(), key: preset.key, name: preset.name,
            values: preset.values.map((label) => ({ id: newValueId(), label })) }
        : { id: newAxisId(), key: null, name: `Spec ${(x.specs?.length || 0) + 1}`,
            values: [{ id: newValueId(), label: 'Option 1' }] };
      const specs = [...(x.specs || []), newAxis];
      return { ...x, specs, variants: rebuildVariants(specs, x.basePrice || 0), updatedAt: new Date().toISOString() };
    });
  };
  const removeAxis = (axisId) => {
    setP((x) => {
      const specs = (x.specs || []).filter((a) => a.id !== axisId);
      return { ...x, specs, variants: rebuildVariants(specs, x.basePrice || 0), updatedAt: new Date().toISOString() };
    });
  };
  const renameAxis = (axisId, name) => {
    setP((x) => ({
      ...x,
      specs: (x.specs || []).map((a) => a.id === axisId ? { ...a, name } : a),
      updatedAt: new Date().toISOString(),
    }));
  };
  const addValue = (axisId, label) => {
    if (!label || !label.trim()) return;
    setP((x) => {
      const specs = (x.specs || []).map((a) =>
        a.id === axisId
          ? { ...a, values: [...a.values, { id: newValueId(), label: label.trim() }] }
          : a
      );
      return { ...x, specs, variants: rebuildVariants(specs, x.basePrice || 0), updatedAt: new Date().toISOString() };
    });
  };
  const renameValue = (axisId, valueId, label) => {
    setP((x) => ({
      ...x,
      specs: (x.specs || []).map((a) =>
        a.id === axisId
          ? { ...a, values: a.values.map((v) => v.id === valueId ? { ...v, label } : v) }
          : a
      ),
      updatedAt: new Date().toISOString(),
    }));
  };
  const removeValue = (axisId, valueId) => {
    setP((x) => {
      const specs = (x.specs || []).map((a) =>
        a.id === axisId
          ? { ...a, values: a.values.filter((v) => v.id !== valueId) }
          : a
      ).filter((a) => a.values.length > 0);
      return { ...x, specs, variants: rebuildVariants(specs, x.basePrice || 0), updatedAt: new Date().toISOString() };
    });
  };

  const updateVariant = (variantId, patch) => {
    setP((x) => ({
      ...x,
      variants: x.variants.map((v) => v.id === variantId ? { ...v, ...patch } : v),
      updatedAt: new Date().toISOString(),
    }));
  };

  const onBasePriceChange = (price) => {
    setP((x) => ({
      ...x,
      basePrice: price,
      variants: x.variants.map((v) =>
        (v.price === 0 || v.price === x.basePrice) ? { ...v, price } : v
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // ─── Save / lifecycle actions ─────────────────────────────
  const canPublish = p.name && p.variants.every((v) => v.price >= 0)
    && (p.basePrice > 0 || p.variants.some((v) => v.price > 0));

  const saveDraft = () => {
    onSave({ ...p, status: 'DRAFT' });
    toast({ kind: 'success', title: 'Draft saved', msg: p.name || 'Untitled product' });
  };
  const publishNow = () => {
    if (!canPublish) { toast({ kind: 'error', title: 'Fill in required fields', msg: 'Name + at least one price > 0' }); return; }
    onSave({ ...p, status: 'LISTED', listFrom: new Date().toISOString(), publishAt: null });
    toast({ kind: 'success', title: `${p.name} is now Listed` });
  };
  const schedulePublish = () => {
    if (!p.publishAt) return;
    if (!canPublish) { toast({ kind: 'error', title: 'Fill in required fields' }); return; }
    onSave({ ...p, status: 'DRAFT' });
    toast({ kind: 'success', title: 'Scheduled publish saved', msg: new Date(p.publishAt).toLocaleString() });
  };
  const saveChanges = () => { onSave({ ...p }); toast({ kind: 'success', title: 'Changes saved' }); };
  const delist = () => {
    const reason = window.prompt('Delist reason (required):', 'Out of stock');
    if (!reason || !reason.trim()) return;
    onSave({ ...p, status: 'DELISTED', delistReason: reason, delistedAt: new Date().toISOString() });
    toast({ kind: 'warning', title: `${p.name} delisted`, msg: reason });
  };
  const relist = () => {
    onSave({ ...p, status: 'LISTED', delistReason: null, delistedAt: null });
    toast({ kind: 'success', title: `${p.name} is back online` });
  };
  const archive = () => {
    if (!window.confirm(`Archive "${p.name}"?\n\nArchiving is irreversible.`)) return;
    onSave({ ...p, status: 'ARCHIVED', archivedAt: new Date().toISOString() });
    toast({ kind: 'success', title: `${p.name} archived` });
  };
  const cancelSchedule = () => {
    onSave({ ...p, publishAt: null });
    toast({ kind: 'success', title: 'Scheduled publish cancelled' });
  };

  // ─── Top actions per status ────────────────────────────────
  const renderTopActions = () => {
    if (isReadOnly) return <Btn variant="secondary" size="md" onClick={onCancel}>Back to list</Btn>;
    if (isNew || eff === 'DRAFT') {
      return (
        <>
          <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>
          <Btn variant="secondary" size="md" onClick={saveDraft}>Save draft</Btn>
          {p.publishAt
            ? <Btn variant="primary" size="md" icon="check" onClick={schedulePublish}>Schedule publish</Btn>
            : <Btn variant="primary" size="md" icon="check" onClick={publishNow} disabled={!canPublish}>Publish now</Btn>}
        </>
      );
    }
    if (eff === 'SCHEDULED') {
      return (
        <>
          <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>
          <Btn variant="ghost" size="md" onClick={cancelSchedule}>Cancel schedule</Btn>
          <Btn variant="secondary" size="md" onClick={saveDraft}>Save draft</Btn>
          <Btn variant="primary" size="md" icon="check" onClick={publishNow}>Publish now</Btn>
        </>
      );
    }
    if (isListed) {
      return (
        <>
          <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>
          <Btn variant="secondary" size="md" icon="check" onClick={saveChanges}>Save changes</Btn>
          <Btn variant="secondary" size="md" icon="package" onClick={delist}>Delist</Btn>
        </>
      );
    }
    if (p.status === 'DELISTED') {
      return (
        <>
          <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>
          <Btn variant="secondary" size="md" icon="check" onClick={saveChanges}>Save changes</Btn>
          <Btn variant="primary" size="md" icon="check" onClick={relist}>Re-list</Btn>
          <Btn variant="secondary" size="md" icon="trash" onClick={archive}>Archive</Btn>
        </>
      );
    }
    return <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>;
  };

  const statusBanner = () => {
    if (eff === 'SCHEDULED') {
      return (
        <div className="prod-banner prod-banner--info">
          <Icon name="clock" size={14}/>
          <span><strong>Scheduled publish</strong>: goes live at {new Date(p.publishAt).toLocaleString()}.</span>
        </div>
      );
    }
    if (p.status === 'DELISTED') {
      return (
        <div className="prod-banner prod-banner--warn">
          <Icon name="alert" size={14}/>
          <span><strong>Delisted</strong>: {p.delistReason}. Historical orders unaffected.</span>
        </div>
      );
    }
    if (p.status === 'ARCHIVED') {
      return (
        <div className="prod-banner prod-banner--muted">
          <Icon name="package" size={14}/>
          <span><strong>Archived · read-only</strong></span>
        </div>
      );
    }
    if (isListed) {
      return (
        <div className="prod-banner prod-banner--ok">
          <Icon name="check" size={14}/>
          <span><strong>Listed</strong>: sales can add this product to their cart.</span>
        </div>
      );
    }
    return null;
  };

  const isDevice = p.type === 'DEVICE';
  const fallbackArt = (!p.baseImage && isDevice && linkedModel)
    ? <ModelTile model={linkedModel} px={100}/> : null;
  const integrationModes = p.integrationModes || [];

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">
            {isNew ? 'New product' : p.name}
            <span style={{ marginLeft: 12, verticalAlign: 'middle', display: 'inline-block' }}>
              <Badge tone={PRODUCT_STATUS_TONE[eff]} dot>{PRODUCT_STATUS_LABEL[eff]}</Badge>
            </span>
          </h1>
          <p className="page__sub">
            {isNew
              ? 'Create a new product. Devices link to a hardware model and offer integration / nature options at order time.'
              : <>
                  Created {new Date(p.createdAt).toLocaleDateString()} · last updated {new Date(p.updatedAt).toLocaleDateString()} by {p.updatedBy}
                </>}
          </p>
        </div>
        <div className="page__actions">{renderTopActions()}</div>
      </div>

      {statusBanner()}

      <div className="wizard-grid">
        <div className="stack" style={{ gap: 16 }}>

          {/* 1 · Identity */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Basics</div></div>
            <div className="info-card__body">
              <Field label="Product name" required>
                <Input value={p.name} onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. N950 Sample" disabled={isReadOnly}/>
              </Field>
              <Field label="Description">
                <Textarea value={p.desc || ''} onChange={(e) => update('desc', e.target.value)} rows={2}
                  placeholder="One-line summary shown on cart cards and order rows."
                  disabled={isReadOnly}/>
              </Field>
              <Field label="Product image" hint={isDevice ? "If empty, the linked device's default image is used." : null}>
                <ImagePicker value={p.baseImage}
                  fallback={fallbackArt}
                  onChange={(v) => update('baseImage', v)}
                  onClear={() => update('baseImage', null)}
                  disabled={isReadOnly}/>
              </Field>
            </div>
          </div>

          {/* 2 · Type */}
          <div className="info-card">
            <div className="info-card__head">
              <div>
                <div className="info-card__title">Type</div>
                <div className="prod-section-hint">Decides what additional fields appear below.</div>
              </div>
            </div>
            <div className="info-card__body">
              <div className="prod-type-row">
                {[
                  { id: 'DEVICE', label: 'Device type',
                    hint: 'Hardware terminal · linked to a device model · with integration & spec options' },
                  { id: 'OTHER',  label: 'Other type',
                    hint: 'Accessory / consumable / service · base price + stock' },
                ].map((opt) => (
                  <button key={opt.id} type="button"
                    className={`prod-cat-card ${p.type === opt.id ? 'is-on' : ''}`}
                    disabled={isReadOnly || isListed}
                    onClick={() => setType(opt.id)}>
                    <div className="prod-cat-card__label">{opt.label}</div>
                    <div className="prod-cat-card__hint">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3 · Device details (DEVICE only) */}
          {isDevice && (
            <div className="info-card">
              <div className="info-card__head">
                <div>
                  <div className="info-card__title">Device details</div>
                  <div className="prod-section-hint">Pick a hardware model, supported integration modes, and the device's nature.</div>
                </div>
              </div>
              <div className="info-card__body">
                <div className="prod-section-sublabel">Device model</div>
                <div className="prod-model-tiles">
                  {allowedModels.map((m) => (
                    <button key={m.id} type="button"
                      className={`prod-model-tile ${p.deviceModelId === m.id ? 'is-on' : ''}`}
                      disabled={isReadOnly || isListed}
                      onClick={() => update('deviceModelId', m.id)}>
                      <div className="prod-model-tile__art">
                        <ModelTile model={m} px={64}/>
                      </div>
                      <div className="prod-model-tile__name">{m.name}</div>
                    </button>
                  ))}
                </div>

                <div className="prod-section-sublabel" style={{ marginTop: 18 }}>
                  Integration mode <span className="prod-section-sublabel__hint">multi-select · shown at View options</span>
                </div>
                <div className="prod-chk-row">
                  {INTEGRATION_MODE_OPTIONS.map((mode) => (
                    <label key={mode} className={`prod-chk ${integrationModes.includes(mode) ? 'is-on' : ''}`}>
                      <input type="checkbox"
                        checked={integrationModes.includes(mode)}
                        disabled={isReadOnly}
                        onChange={() => toggleIntegration(mode)}/>
                      <span>{mode}</span>
                    </label>
                  ))}
                </div>

                <div className="prod-section-sublabel" style={{ marginTop: 18 }}>Device nature</div>
                <div className="prod-variant-pick__row">
                  {DEVICE_NATURE_OPTIONS.map((opt) => (
                    <label key={opt.id} className={`prod-variant-pick__opt ${p.deviceVariant === opt.id ? 'is-on' : ''}`}>
                      <input type="radio" name="deviceVariant"
                        checked={p.deviceVariant === opt.id}
                        disabled={isReadOnly || isListed}
                        onChange={() => update('deviceVariant', opt.id)}/>
                      <div>
                        <div className="prod-variant-pick__lbl">{opt.label}</div>
                        <div className="prod-variant-pick__hint">{opt.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4 · Specifications (DEVICE only · optional) */}
          {isDevice && (
            <div className="info-card">
              <div className="info-card__head">
                <div>
                  <div className="info-card__title">Specifications</div>
                  <div className="prod-section-hint">
                    Optional. Add one or more spec categories (Network, Storage, or your own). Each combination generates a priceable variant below.
                  </div>
                </div>
                {!isReadOnly && (
                  <Btn size="sm" variant="ghost" icon="plus" onClick={() => addAxis(null)}>Add custom category</Btn>
                )}
              </div>
              <div className="info-card__body">
                {(p.specs || []).length === 0 && (
                  <div className="prod-empty">
                    No spec categories yet. Add one below — or start from a preset.
                  </div>
                )}

                {(p.specs || []).map((axis) => (
                  <SpecAxisEditor
                    key={axis.id}
                    axis={axis}
                    readOnly={isReadOnly}
                    onRenameAxis={(name) => renameAxis(axis.id, name)}
                    onRemoveAxis={() => removeAxis(axis.id)}
                    onAddValue={(label) => addValue(axis.id, label)}
                    onRenameValue={(vid, label) => renameValue(axis.id, vid, label)}
                    onRemoveValue={(vid) => removeValue(axis.id, vid)}
                  />
                ))}

                {!isReadOnly && (
                  <div className="prod-preset-row">
                    <div className="prod-preset-row__lbl">Quick add:</div>
                    {DEVICE_SPEC_AXES.map((preset) => {
                      const exists = (p.specs || []).some(
                        (a) => a.key === preset.key || a.name.toLowerCase() === preset.name.toLowerCase()
                      );
                      return (
                        <button key={preset.key} type="button"
                          className="prod-preset-btn"
                          disabled={exists}
                          onClick={() => addAxis(preset)}>
                          <Icon name="plus" size={11}/> {preset.name}
                          <span className="prod-preset-btn__hint">{preset.values.join(' · ')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5 · Pricing */}
          <div className="info-card">
            <div className="info-card__head">
              <div>
                <div className="info-card__title">Pricing &amp; stock</div>
                <div className="prod-section-hint">
                  {(p.specs && p.specs.length)
                    ? 'One row per spec combination. Name shown in View options is editable.'
                    : 'Single base price + stock.'}
                </div>
              </div>
              <div className="prod-base-price">
                <span className="prod-base-price__lbl">Base price</span>
                <div className="prod-cell-money" style={{ width: 130 }}>
                  <span>$</span>
                  <input className="prod-cell-input prod-cell-input--right" type="number" step="0.01" min="0"
                    value={p.basePrice}
                    onChange={(e) => onBasePriceChange(parseFloat(e.target.value) || 0)}
                    disabled={isReadOnly}/>
                </div>
              </div>
            </div>
            <div className="info-card__body">
              <VariantsMatrix
                product={p}
                onUpdateVariant={updateVariant}
                readOnly={isReadOnly}/>
            </div>
          </div>

          {/* 6 · Availability */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Availability</div></div>
            <div className="info-card__body">
              <Field label="Publish at">
                <div className="prod-radio-group">
                  <label className="prod-radio">
                    <input type="radio" checked={!p.publishAt}
                      onChange={() => update('publishAt', null)} disabled={isReadOnly}/>
                    <span>Immediately on Publish click</span>
                  </label>
                  <label className="prod-radio">
                    <input type="radio" checked={!!p.publishAt}
                      onChange={() => update('publishAt', new Date(Date.now() + 86400000).toISOString())}
                      disabled={isReadOnly}/>
                    <span>Scheduled</span>
                    {p.publishAt && (
                      <input type="datetime-local"
                        className="prod-dt"
                        value={new Date(p.publishAt).toISOString().slice(0, 16)}
                        onChange={(e) => update('publishAt', new Date(e.target.value).toISOString())}
                        disabled={isReadOnly}/>
                    )}
                  </label>
                </div>
              </Field>

              <label className="prod-toggle-line">
                <input type="checkbox" checked={p.allowPriceOverride}
                  onChange={(e) => update('allowPriceOverride', e.target.checked)}
                  disabled={isReadOnly}/>
                <span><strong>Allow sales override</strong> — sales can change the price at View options (Step 3).</span>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar preview */}
        <aside className="wizard-aside">
          <h4>Preview</h4>
          <div className="prod-preview">
            <div className="prod-preview__image">
              {p.baseImage ? (
                <img src={p.baseImage} alt=""/>
              ) : isDevice && linkedModel ? (
                <ModelTile model={linkedModel} px={140}/>
              ) : (
                <div className="prod-tile-other" style={{ width: 140, height: 140, fontSize: 48 }}>📦</div>
              )}
            </div>
            <div className="prod-preview__name">{p.name || 'Untitled product'}</div>
            {isDevice && linkedModel && (
              <div className="prod-preview__cat" style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>
                {linkedModel.name} · {p.deviceVariant === 'SAMPLE' ? 'Sample' : 'Production'}
              </div>
            )}
            <div className="prod-preview__price num">{formatPriceRange(p)}</div>
            {integrationModes.length > 0 && (
              <div className="prod-preview__chips">
                {integrationModes.map((m) => <span key={m} className="prod-preview__chip">{m}</span>)}
              </div>
            )}
            <div className="prod-preview__variants">
              {!p.specs || !p.specs.length
                ? <span className="muted">No variants</span>
                : `${p.variants.length} variants · ${p.specs.map((a) => a.name).join(' × ')}`}
            </div>
            <hr/>
            <dl>
              <dt>Status</dt>
              <dd><Badge tone={PRODUCT_STATUS_TONE[eff]} dot>{PRODUCT_STATUS_LABEL[eff]}</Badge></dd>
              {p.publishAt && <><dt>Publish at</dt><dd className="num">{new Date(p.publishAt).toLocaleString()}</dd></>}
              <dt>Override price</dt><dd>{p.allowPriceOverride ? 'Allowed' : 'No'}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────────
const productFormStyles = `
.prod-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 18px; }
.prod-banner svg { flex: none; }
.prod-banner strong { font-weight: 600; }
.prod-banner--ok { background: var(--color-success-50); color: var(--color-success-700); border: 1px solid oklch(58% 0.14 152 / 0.25); }
.prod-banner--info { background: var(--color-info-50); color: var(--color-info-700); border: 1px solid oklch(60% 0.14 230 / 0.25); }
.prod-banner--warn { background: var(--color-warning-50); color: var(--color-warning-700); border: 1px solid oklch(70% 0.14 80 / 0.3); }
.prod-banner--muted { background: var(--color-bg-3); color: var(--color-text-secondary); border: 1px solid var(--color-border-default); }

.prod-section-hint { font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px; line-height: 1.5; }
.prod-section-sublabel { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 8px; }
.prod-section-sublabel__hint { font-weight: 500; letter-spacing: 0; text-transform: none; margin-left: 6px; color: var(--color-text-tertiary); }

.prod-type-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.prod-cat-card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; cursor: pointer; text-align: left; font-family: inherit; transition: all var(--duration-fast); }
.prod-cat-card:hover:not(:disabled) { border-color: var(--color-border-strong); }
.prod-cat-card.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.08); }
.prod-cat-card:disabled { opacity: 0.55; cursor: not-allowed; }
.prod-cat-card__label { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); }
.prod-cat-card__hint { font-size: 11.5px; color: var(--color-text-tertiary); line-height: 1.4; }

.prod-model-tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
@media (max-width: 1100px) { .prod-model-tiles { grid-template-columns: repeat(3, 1fr); } }
.prod-model-tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; background: var(--color-bg-2); border: 1.5px solid var(--color-border-default); border-radius: 10px; cursor: pointer; font-family: inherit; transition: all var(--duration-fast); }
.prod-model-tile:hover:not(:disabled) { border-color: var(--color-border-strong); }
.prod-model-tile.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.10); }
.prod-model-tile:disabled { opacity: 0.55; cursor: not-allowed; }
.prod-model-tile__art { padding: 4px 0; }
.prod-model-tile__name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.prod-model-tile__family { font-size: 10.5px; color: var(--color-text-tertiary); }

.prod-chk-row { display: flex; flex-wrap: wrap; gap: 8px; }
.prod-chk { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 999px; cursor: pointer; font-size: 12.5px; transition: all var(--duration-fast); }
.prod-chk:hover { border-color: var(--color-border-strong); }
.prod-chk.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); color: var(--color-primary-700); font-weight: 500; }
.prod-chk input[type="checkbox"] { accent-color: var(--color-primary-700); }

.prod-variant-pick__row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.prod-variant-pick__opt { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; cursor: pointer; transition: all var(--duration-fast); }
.prod-variant-pick__opt:hover { border-color: var(--color-border-strong); }
.prod-variant-pick__opt.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); }
.prod-variant-pick__opt input[type="radio"] { accent-color: var(--color-primary-700); margin-top: 2px; flex: none; }
.prod-variant-pick__lbl { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.prod-variant-pick__hint { font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 2px; line-height: 1.4; }

.prod-spec-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--color-border-subtle); }
.prod-spec-row:last-child { border-bottom: 0; }
.prod-spec-row__lbl { font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); width: 110px; flex: none; }

.prod-empty { padding: 18px; text-align: center; color: var(--color-text-tertiary); border: 1.5px dashed var(--color-border-default); border-radius: 10px; font-size: 12.5px; background: var(--color-bg-3); margin-bottom: 10px; }

.prod-axis-editor { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
.prod-axis-editor__head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.prod-axis-editor__name { flex: 1; border: 1px solid transparent; background: transparent; padding: 6px 8px; border-radius: 6px; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); outline: 0; }
.prod-axis-editor__name:hover:not(:disabled) { background: var(--color-bg-2); }
.prod-axis-editor__name:focus { background: var(--color-bg-2); border-color: var(--color-primary-700); }
.prod-axis-editor__remove { width: 28px; height: 28px; border-radius: 6px; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; color: var(--color-text-tertiary); }
.prod-axis-editor__remove:hover { background: var(--color-error-50, oklch(96% 0.02 30)); color: var(--color-error-700); }
.prod-axis-editor__values { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

.prod-axis-chip { display: inline-flex; align-items: center; gap: 2px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 8px; padding: 3px 4px 3px 10px; }
.prod-axis-chip input { border: 0; background: transparent; outline: 0; font: inherit; font-size: 12.5px; color: var(--color-text-primary); padding: 3px 0; width: 110px; }
.prod-axis-chip input:disabled { color: var(--color-text-tertiary); }
.prod-axis-chip__x { width: 22px; height: 22px; border-radius: 6px; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; color: var(--color-text-tertiary); }
.prod-axis-chip__x:hover { background: var(--color-bg-3); color: var(--color-error-700); }
.prod-axis-add input { border: 1px dashed var(--color-border-default); background: transparent; border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 12.5px; color: var(--color-text-secondary); outline: 0; width: 140px; }
.prod-axis-add input:focus { border-style: solid; border-color: var(--color-primary-700); color: var(--color-text-primary); }

.prod-preset-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--color-border-subtle); }
.prod-preset-row__lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-right: 4px; }
.prod-preset-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 999px; padding: 6px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; color: var(--color-text-primary); transition: all var(--duration-fast); }
.prod-preset-btn:hover:not(:disabled) { border-color: var(--color-primary-700); background: var(--color-primary-50); color: var(--color-primary-700); }
.prod-preset-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.prod-preset-btn__hint { font-size: 11px; color: var(--color-text-tertiary); }
.prod-preset-btn:hover:not(:disabled) .prod-preset-btn__hint { color: var(--color-primary-700); opacity: 0.75; }

.prod-base-price { display: flex; align-items: center; gap: 10px; }
.prod-base-price__lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); }

.prod-variant-table { width: 100%; border-collapse: collapse; }
.prod-variant-table th { text-align: left; padding: 10px 12px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); background: var(--color-bg-3); border-bottom: 1px solid var(--color-border-default); }
.prod-variant-table th input[type="checkbox"], .prod-variant-table td input[type="checkbox"] { accent-color: var(--color-primary-700); cursor: pointer; }
.prod-variant-table td { padding: 8px 12px; border-bottom: 1px solid var(--color-border-subtle); vertical-align: middle; }
.prod-variant-row:hover td { background: var(--color-bg-3); }
.prod-variant-row.is-off td { background: var(--color-bg-3); color: var(--color-text-tertiary); }
.prod-variant-row.is-off:hover td { background: oklch(94% 0.005 250); }
.prod-variant-row.is-off .prod-cell-input,
.prod-variant-row.is-off .prod-cell-money { opacity: 0.55; }
.prod-th-hint { font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--color-text-tertiary); margin-left: 4px; }

.prod-cell-input { width: 100%; border: 1px solid var(--color-border-default); border-radius: 6px; background: var(--color-bg-2); padding: 5px 8px; font: inherit; font-size: 12.5px; color: var(--color-text-primary); outline: 0; }
.prod-cell-input:focus { border-color: var(--color-primary-700); }
.prod-cell-input--right { text-align: right; font-variant-numeric: tabular-nums; }
.prod-cell-input:disabled { background: var(--color-bg-3); color: var(--color-text-tertiary); cursor: not-allowed; }
.prod-cell-money { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--color-border-default); border-radius: 6px; background: var(--color-bg-2); padding: 0 6px 0 8px; }
.prod-cell-money > span { font-size: 12.5px; color: var(--color-text-tertiary); }
.prod-cell-money .prod-cell-input { border: 0; padding: 5px 0; background: transparent; }
.prod-cell-money:focus-within { border-color: var(--color-primary-700); }

.prod-stock-cell { display: flex; align-items: center; gap: 10px; }
.prod-stock-toggle { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--color-text-secondary); cursor: pointer; white-space: nowrap; }
.prod-stock-toggle input[type="checkbox"] { accent-color: var(--color-primary-700); }

.prod-img-picker__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 36px 12px; border: 1.5px dashed var(--color-border-default); border-radius: 10px; background: var(--color-bg-3); cursor: pointer; transition: all var(--duration-fast); color: var(--color-text-secondary); }
.prod-img-picker__empty:hover { border-color: var(--color-border-strong); background: var(--color-bg-2); }
.prod-img-picker__empty.is-disabled { cursor: not-allowed; opacity: 0.5; }
.prod-img-picker__has { display: flex; align-items: center; gap: 16px; }
.prod-img-picker__has img { width: 110px; height: 110px; object-fit: contain; background: #fff; border: 1px solid var(--color-border-default); border-radius: 10px; padding: 6px; }
.prod-img-picker__fallback { width: 110px; height: 110px; display: grid; place-items: center; background: #fff; border: 1px dashed var(--color-border-default); border-radius: 10px; padding: 6px; }
.prod-img-picker__fallback-lbl { font-size: 11.5px; color: var(--color-text-tertiary); line-height: 1.5; margin-right: 6px; }
.prod-img-picker__actions { display: flex; align-items: center; gap: 6px; }

.prod-radio-group { display: flex; flex-direction: column; gap: 8px; }
.prod-radio { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); cursor: pointer; }
.prod-radio input[type="radio"] { accent-color: var(--color-primary-700); }
.prod-dt { margin-left: 8px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--color-border-default); background: var(--color-bg-2); font: inherit; font-size: 12.5px; color: var(--color-text-primary); }
.prod-dt:focus { border-color: var(--color-primary-700); outline: 0; }

.prod-toggle-line { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; cursor: pointer; padding: 10px 12px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 8px; }
.prod-toggle-line input[type="checkbox"] { accent-color: var(--color-primary-700); margin-top: 1px; }
.prod-toggle-line strong { font-weight: 600; }

.prod-preview { padding: 4px 0 0; }
.prod-preview__image { display: flex; justify-content: center; padding: 8px 0 12px; }
.prod-preview__image img { max-width: 140px; max-height: 140px; object-fit: contain; background: #fff; border-radius: 10px; padding: 6px; border: 1px solid var(--color-border-subtle); }
.prod-preview__name { text-align: center; font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
.prod-preview__cat { text-align: center; margin-top: 6px; }
.prod-preview__price { text-align: center; margin-top: 6px; font-size: 14px; color: var(--color-text-secondary); }
.prod-preview__chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 8px; }
.prod-preview__chip { font-size: 11px; padding: 2px 8px; background: var(--color-bg-3); color: var(--color-text-secondary); border-radius: 999px; border: 1px solid var(--color-border-subtle); }
.prod-preview__variants { text-align: center; margin-top: 6px; font-size: 11.5px; color: var(--color-text-tertiary); }
.prod-preview hr { border: 0; border-top: 1px solid var(--color-border-subtle); margin: 14px 0; }
`;

if (typeof document !== 'undefined' && !document.getElementById('product-form-styles')) {
  const s = document.createElement('style');
  s.id = 'product-form-styles';
  s.textContent = productFormStyles;
  document.head.appendChild(s);
}

window.ProductForm = ProductForm;
