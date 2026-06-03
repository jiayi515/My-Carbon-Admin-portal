/* global React, Btn, Input, Field, Icon, Badge, CompanyLogo, Modal, useToast,
   fmtDate, fmtDateTime, relTime,
   DEVICE_MODELS, ModelTile, ORDER_STATUS_TONE,
   orderSubtotal, orderTotal, orderQty, deviceProgress, moneyUSD,
   fakeSN, fakeAC */
const { useState, useMemo } = React;

// ─── Status pipeline ──────────────────────────────────────────────────────
const PIPELINE = [
  { key: 'Awaiting payment',  label: 'Awaiting payment',  icon: 'cash'  },
  { key: 'Awaiting shipment', label: 'Awaiting shipment', icon: 'package' },
  { key: 'Shipped',           label: 'Shipped',           icon: 'truck' },
  { key: 'Complete',          label: 'Complete',          icon: 'check' },
];

const StatusPipeline = ({ order }) => {
  // Determine the current pipeline index
  const idx = PIPELINE.findIndex(p =>
    p.key === order.status ||
    (p.key === 'Complete' && order.status === 'Partially complete') ||
    (p.key === 'Awaiting shipment' && order.status === 'Awaiting shipment')
  );
  const isPartial = order.status === 'Partially complete';
  // If order skipped payment, mark step 0 as done
  const paidSkipped = order.discountPct === 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '14px 0' }}>
      {PIPELINE.map((p, i) => {
        const done = i < idx || (i === 0 && paidSkipped && idx >= 0);
        const active = i === idx && !isPartial;
        const partial = i === idx && isPartial;
        return (
          <React.Fragment key={p.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 50, display: 'grid', placeItems: 'center', flex: 'none',
                background: done ? 'var(--color-success-50)' : active ? 'var(--color-primary-700)' : partial ? 'var(--color-info-50)' : 'var(--color-bg-3)',
                color: done ? 'var(--color-success-700)' : active ? '#fff' : partial ? 'var(--color-info-700)' : 'var(--color-text-tertiary)',
                border: `1px solid ${done ? 'oklch(58% 0.14 152 / 0.4)' : active ? 'var(--color-primary-700)' : partial ? 'oklch(60% 0.14 230 / 0.4)' : 'var(--color-border-default)'}`,
                boxShadow: active ? 'var(--shadow-cta)' : 'none',
              }}>
                {done ? <Icon name="check" size={16}/> : <Icon name={p.icon} size={16}/>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <small style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Step {i + 1}</small>
                <strong style={{ fontSize: 13.5, fontWeight: active || partial ? 600 : 500, color: active || done || partial ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {paidSkipped && i === 0 ? 'No payment required' : p.label}
                  {partial && ' (partial)'}
                </strong>
              </div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < idx ? 'oklch(58% 0.14 152 / 0.4)' : 'var(--color-border-default)', margin: '0 14px' }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Activation lookup ────────────────────────────────────────────────────
// Operator types a 6-digit code; the backend resolves it to the matching
// device's SN + model. We then append it as a new record under the order's
// line item that already lists that model.
const SAMPLE_TYPES = ['Stand-alone', 'Semi-integration', 'Full-integration'];

const lookupActivationCode = (code, orderItems, alreadyActivatedSet) => {
  if (!code || code.length !== 6) return null;
  if (code.startsWith('000')) return { error: 'No device found for this activation code.' };
  if (alreadyActivatedSet.has(code)) return { error: 'This activation code is already bound to a device in this order.' };
  // Pick one of the order's models deterministically from the code.
  const n = parseInt(code, 10);
  const item = orderItems[n % orderItems.length];
  if (!item) return { error: 'No matching model on this order.' };
  // Don't exceed the ordered quantity for that model.
  if (item.devices.length >= item.qty) {
    return { error: `${item.modelName} already has all ${item.qty} units activated. Try a different code.` };
  }
  const prefix = (item.modelName.match(/[A-Z]\d+/g)?.[0] || item.modelName.slice(0, 3).toUpperCase());
  return {
    sn: fakeSN(prefix, 90000 + (n % 99999)),
    itemId: item.id,
    modelName: item.modelName,
    type: item.type,
  };
};

// ─── Activation tab (unified input + bound records) ───────────────────────
const ActivationTab = ({ order, onUpdate, readonly }) => {
  const toast = useToast();
  const [code, setCode] = React.useState('');
  const [resolving, setResolving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [flash, setFlash] = React.useState(null); // { itemId, sn }
  // { itemId, deviceIdx, sn, modelName } when confirming an unbind
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const [factoryReset, setFactoryReset] = React.useState(true);
  const inputRef = React.useRef(null);

  const activatedCodes = React.useMemo(() => {
    const s = new Set();
    order.items.forEach(i => i.devices.forEach(d => d.code && s.add(d.code)));
    return s;
  }, [order]);

  React.useEffect(() => {
    if (code.length !== 6) { setError(''); return; }
    setResolving(true);
    setError('');
    const t = setTimeout(() => {
      const res = lookupActivationCode(code, order.items, activatedCodes);
      setResolving(false);
      if (!res) return;
      if (res.error) { setError(res.error); return; }
      // Append the new device record to its line item — this is the "bind to
      // backend" moment; from here on it persists even if the user navigates away.
      const nextItems = order.items.map(it => it.id !== res.itemId ? it : {
        ...it,
        devices: [...it.devices, { sn: res.sn, code, type: res.type }],
      });
      onUpdate({ ...order, items: nextItems });
      setFlash({ itemId: res.itemId, sn: res.sn });
      setCode('');
      setTimeout(() => setFlash(null), 1600);
      // Re-focus the input for fast batch entry.
      inputRef.current && inputRef.current.focus();
    }, 320);
    return () => { clearTimeout(t); setResolving(false); };
  }, [code]);

  const removeDevice = (itemId, deviceIdx, withReset) => {
    const target = order.items.find(it => it.id === itemId);
    const dev = target?.devices[deviceIdx];
    const nextItems = order.items.map(it => it.id !== itemId ? it : {
      ...it,
      devices: it.devices.filter((_, i) => i !== deviceIdx),
    });
    const ev = {
      at: new Date().toISOString(),
      kind: 'info',
      by: 'jordan.d@carbon',
      text: `Unbound ${target?.modelName} · SN ${dev?.sn}${withReset ? ' · factory reset triggered' : ''}`,
    };
    onUpdate({ ...order, items: nextItems, events: [...(order.events || []), ev] });
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    removeDevice(removeTarget.itemId, removeTarget.deviceIdx, factoryReset);
    toast({
      kind: 'success',
      title: 'Device unbound',
      msg: factoryReset
        ? `${removeTarget.sn} unbound · factory reset signal sent.`
        : `${removeTarget.sn} unbound from this order.`,
    });
    setRemoveTarget(null);
    setFactoryReset(true);
  };

  const updateDeviceType = (itemId, deviceIdx, type) => {
    const nextItems = order.items.map(it => it.id !== itemId ? it : {
      ...it,
      devices: it.devices.map((d, i) => i === deviceIdx ? { ...d, type } : d),
    });
    onUpdate({ ...order, items: nextItems });
  };

  // Simulate scanning the next device.
  const simulateScan = () => {
    // Find a model with remaining capacity and pick a code that maps to it.
    const open = order.items.filter(i => i.devices.length < i.qty);
    if (open.length === 0) return;
    const itemIdx = order.items.indexOf(open[0]);
    // Find a 6-digit code n where n % order.items.length === itemIdx and code unused.
    for (let attempt = 0; attempt < 200; attempt++) {
      const base = 100000 + Math.floor(Math.random() * 899999);
      const adjusted = base - (base % order.items.length) + itemIdx;
      const c = String(adjusted).padStart(6, '0').slice(-6);
      if (c.length === 6 && !c.startsWith('000') && !activatedCodes.has(c)) {
        setCode(c);
        return;
      }
    }
  };

  // Flatten activated devices. Show most-recently-bound first so the device
  // an operator just activated lands at the top of the list.
  const allDevices = [];
  order.items.forEach(it => {
    it.devices.forEach((d, i) => allDevices.push({ ...d, itemId: it.id, modelName: it.modelName, deviceIdx: i, expectedType: it.type }));
  });
  allDevices.reverse();

  const codeValid = code.length === 6;
  const inputBorder = error ? 'oklch(62% 0.18 22 / 0.5)' : codeValid ? 'oklch(58% 0.14 152 / 0.4)' : 'var(--color-border-default)';

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Devices & activation</h3>
        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>
          Enter each device's 6-digit activation code below. Once matched, the device is bound to this order — exiting this page doesn't affect already-bound records.
        </p>
      </div>

      {/* Single unified input */}
      {!readonly && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, padding: 14, background: 'var(--color-bg-2)', border: `1px solid ${inputBorder}`, borderRadius: 12, marginBottom: 14, transition: 'border-color 160ms' }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--color-bg-3)', display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', flex: 'none' }}>
            <Icon name="pos" size={18}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Activation code</label>
            <input
              ref={inputRef}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="Enter 6-digit code"
              style={{
                width: '100%', padding: '6px 0', border: 0, background: 'transparent', outline: 'none',
                fontFamily: 'var(--font-family-mono)', fontSize: 22, letterSpacing: '0.4em', fontWeight: 600,
                color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums',
              }}/>
            <div style={{ minHeight: 16, fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {resolving ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-info-700)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: 'currentColor', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }}/>
                  Matching with backend…
                </span>
              ) : error ? (
                <span style={{ color: 'oklch(58% 0.18 22)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="x" size={12}/> {error}</span>
              ) : code ? (
                <span>{code.length}/6 digits</span>
              ) : (
                <span>Type or scan the code shown on each device's boot screen.</span>
              )}
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon="sparkles" onClick={simulateScan} title="Simulate scanning a device">Scan</Btn>
        </div>
      )}

      {/* Per-model progress strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {order.items.map(it => {
          const done = it.devices.length;
          const pct = it.qty > 0 ? (done / it.qty) * 100 : 0;
          const complete = done >= it.qty;
          return (
            <div key={it.id} style={{
              padding: '8px 12px', background: 'var(--color-bg-2)', border: `1px solid ${complete ? 'oklch(58% 0.14 152 / 0.3)' : 'var(--color-border-subtle)'}`, borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10, minWidth: 160,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{it.modelName}</div>
                <div style={{ height: 4, marginTop: 4, background: 'var(--color-bg-3)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: complete ? 'var(--color-success-500)' : 'var(--color-primary-700)', transition: 'width 240ms' }}/>
                </div>
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 500, color: complete ? 'var(--color-success-700)' : 'var(--color-text-secondary)' }}>
                {done}/{it.qty}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activated records list */}
      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">Activated devices ({allDevices.length})</div>
          <div className="muted" style={{ fontSize: 12 }}>Each record is bound to the backend.</div>
        </div>
        {/* Unbind-device confirmation modal */}
        <Modal
          open={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          title="Unbind device"
          width={460}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Btn>
              <Btn variant="danger" icon="trash" onClick={confirmRemove}>
                {factoryReset ? 'Unbind & factory reset' : 'Unbind device'}
              </Btn>
            </>
          }>
          {removeTarget && (
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 14 }}>
                Remove <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{removeTarget.sn}</strong> ({removeTarget.modelName}) from this order? The device will return to inventory and a new activation code can be issued.
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--color-bg-2)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={factoryReset} onChange={e => setFactoryReset(e.target.checked)} style={{ marginTop: 2 }}/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Also factory-reset the device</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    Sends a reset signal so the device wipes its config the next time it comes online. Leave unchecked if the unit will be re-bound to another order.
                  </div>
                </div>
              </label>
            </div>
          )}
        </Modal>
        {allDevices.length === 0 ? (
          <div className="empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>No devices activated yet.</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Enter an activation code above to bind the first device.</div>
          </div>
        ) : (
          <div>
            {allDevices.map((d) => {
              const isFlash = flash && flash.itemId === d.itemId && flash.sn === d.sn;
              return (
                <div key={`${d.itemId}-${d.deviceIdx}`} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 140px 180px 40px', gap: 14, alignItems: 'center',
                  padding: '12px 16px', borderTop: '1px solid var(--color-border-subtle)',
                  background: isFlash ? 'oklch(96% 0.06 152)' : 'transparent',
                  transition: 'background 600ms',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-success-500)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                    <Icon name="check" size={14}/>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.sn}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1, fontFamily: 'var(--font-family-mono)' }}>code {d.code}</div>
                  </div>
                  <div>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.modelName}</span>
                  </div>
                  <div>
                    {readonly ? (
                      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{d.type || d.expectedType}</span>
                    ) : (
                      <div className="tds-select tds-select--sm" style={{ width: '100%' }}>
                        <select value={d.type || d.expectedType} onChange={e => updateDeviceType(d.itemId, d.deviceIdx, e.target.value)}>
                          {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {!readonly && (
                      <button className="iconbtn" onClick={() => { setFactoryReset(true); setRemoveTarget({ itemId: d.itemId, deviceIdx: d.deviceIdx, sn: d.sn, modelName: d.modelName }); }} title="Unbind this device">
                        <Icon name="trash" size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Legacy components kept for any other reference; not used in the new tab.
const ActivationRow = ({ idx, device, modelPrefix, onChange, onAutofill }) => {
  const [resolving, setResolving] = React.useState(false);
  const codeValid = device.code && device.code.length === 6;
  const matched = codeValid && device.sn && !device.lookupError;
  const notFound = codeValid && device.lookupError;
  const partial = device.code && !codeValid;

  // When code becomes 6 digits, simulate backend lookup.
  React.useEffect(() => {
    if (!codeValid) return;
    if (device.sn || device.lookupError) return; // already resolved
    setResolving(true);
    const t = setTimeout(() => {
      const result = lookupDeviceByCode(device.code, modelPrefix);
      if (!result) { setResolving(false); return; }
      if (result.error) onChange({ ...device, sn: '', lookupError: result.error });
      else onChange({ ...device, sn: result.sn, lookupError: '' });
      setResolving(false);
    }, 320);
    return () => { clearTimeout(t); setResolving(false); };
  }, [device.code, codeValid]);

  const bg = matched ? 'oklch(98% 0.02 152)' : notFound ? 'oklch(98% 0.02 22)' : 'var(--color-bg-2)';
  const bd = matched ? 'oklch(58% 0.14 152 / 0.3)' : notFound ? 'oklch(62% 0.18 22 / 0.35)' : partial ? 'oklch(60% 0.14 230 / 0.3)' : 'var(--color-border-subtle)';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 220px 1fr 36px', gap: 12, alignItems: 'center',
      padding: '12px 14px',
      background: bg,
      border: `1px solid ${bd}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums',
        background: matched ? 'var(--color-success-500)' : notFound ? 'var(--color-error-500, oklch(62% 0.18 22))' : 'var(--color-bg-3)',
        color: (matched || notFound) ? '#fff' : 'var(--color-text-tertiary)',
        border: '1px solid', borderColor: matched ? 'var(--color-success-500)' : notFound ? 'oklch(62% 0.18 22)' : 'var(--color-border-default)',
      }}>
        {matched ? <Icon name="check" size={14}/> : notFound ? <Icon name="x" size={14}/> : idx + 1}
      </div>

      <input
        value={device.code || ''}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          // Reset prior lookup when the operator edits the code.
          onChange({ ...device, code: v, sn: '', lookupError: '' });
        }}
        inputMode="numeric"
        maxLength={6}
        placeholder="6-digit code"
        style={{
          padding: '7px 12px', borderRadius: 7, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-2)',
          fontFamily: 'var(--font-family-mono)', fontSize: 15, letterSpacing: '0.3em', color: 'var(--color-text-primary)', outline: 'none', width: '100%',
          textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
        }}/>

      {/* Resolved SN chip / status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        {!codeValid && !device.code && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>Awaiting code…</span>
        )}
        {!codeValid && device.code && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>{device.code.length}/6 digits</span>
        )}
        {codeValid && resolving && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-info-700)' }}>
            <span className="dot-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-info-700)', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }}/>
            Looking up device…
          </span>
        )}
        {matched && (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 6, background: 'var(--color-bg-2)', border: '1px solid oklch(58% 0.14 152 / 0.3)', fontFamily: 'var(--font-family-mono)', fontSize: 12, color: 'var(--color-success-700)', fontWeight: 500 }}>
              <Icon name="package" size={12}/> SN <span style={{ color: 'var(--color-text-primary)' }}>{device.sn}</span>
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>matched</span>
          </>
        )}
        {notFound && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-error-500, oklch(58% 0.18 22))', fontWeight: 500 }}>
            <Icon name="x" size={12}/> {device.lookupError}
          </span>
        )}
      </div>

      <button className="iconbtn" onClick={onAutofill} title="Simulate scanning the device's code (demo)">
        <Icon name="sparkles" size={14}/>
      </button>
    </div>
  );
};

// ─── Line item activation card ────────────────────────────────────────────
const LineActivationCard = ({ item, onItemUpdate, expanded, onToggle, readonly }) => {
  const modelPrefix = (item.modelName.match(/[A-Z]\d+/g)?.[0] || item.modelName.slice(0, 3).toUpperCase());
  const filled = item.devices.filter(d => d.sn && d.code && d.code.length === 6).length;
  const total = item.devices.length;
  const allDone = filled === total;

  const updateDevice = (i, next) => {
    onItemUpdate({ ...item, devices: item.devices.map((d, di) => di === i ? next : d) });
  };
  const autofill = (i) => {
    // Simulate scanning: generate a random 6-digit code; the row's effect
    // will then "look it up" and resolve the SN.
    const code = String(100000 + Math.floor(Math.random() * 899999));
    updateDevice(i, { code, sn: '', lookupError: '' });
  };
  const autofillAll = () => {
    onItemUpdate({
      ...item,
      devices: item.devices.map((d) => d.sn && d.code && d.code.length === 6 ? d : {
        code: String(100000 + Math.floor(Math.random() * 899999)),
        sn: '',
        lookupError: '',
      }),
    });
  };
  const clearAll = () => {
    onItemUpdate({ ...item, devices: item.devices.map(() => ({ sn: '', code: '', lookupError: '' })) });
  };

  return (
    <div className="info-card" style={{ marginBottom: 14 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
          background: 'var(--color-bg-2)', border: 0, borderBottom: expanded ? '1px solid var(--color-border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left',
        }}>
        <ModelTile model={DEVICE_MODELS.find(x => x.id === item.modelId) || { name: item.modelName, image: null }} px={35}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.005em' }}>{item.modelName}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {item.qty} unit{item.qty === 1 ? '' : 's'} · {item.type} · {moneyUSD(item.unitPrice)} ea
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 6, borderRadius: 999, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
              <div style={{ width: `${(filled / total) * 100}%`, height: '100%', background: allDone ? 'var(--color-success-500)' : 'var(--color-primary-700)', transition: 'width 240ms' }}/>
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: allDone ? 'var(--color-success-700)' : 'var(--color-text-secondary)', fontWeight: 500, minWidth: 36 }}>
              {filled}/{total}
            </span>
          </div>
          <Icon name="chevD" size={14} style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 160ms' }}/>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '14px 20px 18px' }}>
          {!readonly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                Type in the 6-digit activation code shown on each device after first boot — the device's serial number and model info will be matched automatically.
              </div>
              <div style={{ flex: 1 }}/>
              <Btn variant="ghost" size="sm" icon="sparkles" onClick={autofillAll}>Auto-fill remaining</Btn>
              <Btn variant="ghost" size="sm" icon="x" onClick={clearAll}>Clear</Btn>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.devices.map((d, i) => (
              <ActivationRow key={i} idx={i} device={d} modelPrefix={modelPrefix}
                onChange={(next) => updateDevice(i, next)}
                onAutofill={() => autofill(i)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Order detail ─────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: 'wire',    label: 'Corporate wire transfer',   desc: 'Customer paid via their corporate bank account.', icon: 'building' },
  { id: 'cash',    label: 'Cash',                      desc: 'Cash received in person or at warehouse pickup.',  icon: 'cash' },
  { id: 'check',   label: 'Check',                     desc: 'Paper check, deposited into Carbon operating account.', icon: 'fileText' },
  { id: 'card',    label: 'Credit / debit card',       desc: 'Card-present or invoice payment portal.',          icon: 'creditCard' },
  { id: 'ach',     label: 'ACH / direct debit',        desc: 'US ACH or SEPA direct debit pull.',                icon: 'arrowDown' },
  { id: 'offset',  label: 'Internal offset / credit',  desc: 'Applied against an existing account credit or rebate.', icon: 'refresh' },
  { id: 'other',   label: 'Other',                     desc: 'Specify in the reference note below.',             icon: 'more' },
];

const OrderDetail = ({ order, onBack, onUpdate, initialTab }) => {
  const toast = useToast();
  // Default tab inferred from status — caller can override via initialTab.
  const defaultTab =
    order.status === 'Awaiting shipment' || order.status === 'Partially complete' ? 'activation' :
    order.status === 'Shipped' || order.status === 'Complete' ? 'history' :
    'overview';
  const [tab, setTab] = useState(initialTab || defaultTab);
  const [expandedLine, setExpandedLine] = useState(order.items[0]?.id || null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('wire');
  const [payRef, setPayRef] = useState('');
  const [payOther, setPayOther] = useState('');
  const [discOpen, setDiscOpen] = useState(false);
  const [discDraft, setDiscDraft] = useState(order.discountPct || 0);
  const [discReason, setDiscReason] = useState('');

  const subtotal = orderSubtotal(order);
  const total = orderTotal(order);
  const prog = deviceProgress(order);

  const updateItem = (li) => {
    onUpdate({ ...order, items: order.items.map(i => i.id === li.id ? li : i) });
  };

  const allActivated = prog.done === prog.total;

  const advanceStatus = (next, eventText) => {
    onUpdate({
      ...order,
      status: next,
      events: [
        ...order.events,
        { at: new Date().toISOString(), kind: 'status', by: 'jordan.d@carbon', text: eventText },
      ],
    });
    toast({ kind: 'success', title: `Status → ${next}`, msg: eventText });
  };

  const markPaid = () => setPayOpen(true);
  const confirmPaid = () => {
    const m = PAYMENT_METHODS.find(p => p.id === payMethod);
    const label = m?.label || 'Payment';
    const refTxt = payRef ? ` · ref ${payRef}` : '';
    const otherTxt = payMethod === 'other' && payOther ? ` (${payOther})` : '';
    onUpdate({
      ...order,
      status: 'Awaiting shipment',
      payment: { method: payMethod, methodLabel: label, reference: payRef, otherNote: payOther, recordedAt: new Date().toISOString(), recordedBy: 'jordan.d@carbon' },
      events: [
        ...order.events,
        { at: new Date().toISOString(), kind: 'status', by: 'jordan.d@carbon', text: `Payment received via ${label}${otherTxt}${refTxt} · advanced to Awaiting shipment` },
      ],
    });
    setPayOpen(false);
    toast({ kind: 'success', title: 'Marked paid', msg: `Recorded ${label}. Order is now Awaiting shipment.` });
  };
  const applyDiscount = () => {
    const pct = Math.max(0, Math.min(100, Number(discDraft) || 0));
    const oldPct = order.discountPct || 0;
    if (pct === oldPct) { setDiscOpen(false); return; }
    const reasonTxt = discReason ? ` · ${discReason}` : '';
    onUpdate({
      ...order,
      discountPct: pct,
      events: [
        ...order.events,
        { at: new Date().toISOString(), kind: 'info', by: 'jordan.d@carbon', text: `Discount changed ${oldPct}% → ${pct}%${reasonTxt}` },
      ],
    });
    setDiscOpen(false);
    setDiscReason('');
    toast({ kind: 'success', title: 'Discount updated', msg: `Now ${pct === 100 ? 'complimentary' : pct + '% off'}.` });
  };
  const markShipped = () => advanceStatus('Shipped', `Shipped · all ${prog.total} devices activated and recorded`);

  // Customer logo accent color from name
  return (
    <div className="page">
      {/* Header */}
      <div className="det-header">
        <CompanyLogo name={order.customerName} size={56}/>
        <div className="det-header__main">
          <h1 className="det-header__title">
            <span style={{ fontFamily: 'var(--font-family-mono)' }}>{order.number}</span>
            <Badge tone={ORDER_STATUS_TONE[order.status] || 'neutral'} dot>{order.status}</Badge>
            {order.discountPct === 100 && <Badge tone="success" dot>Complimentary</Badge>}
            {order.discountPct > 0 && order.discountPct < 100 && <Badge tone="info" dot>{order.discountPct}% off</Badge>}
          </h1>
          <div className="det-header__meta">
            <span><Icon name="users" size={13}/> {order.customerName}</span>
            <span><Icon name="cash" size={13}/> {total === 0 ? 'FREE' : moneyUSD(total)}</span>
            <span><Icon name="clock" size={13}/> Created {relTime(order.createdAt)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" icon="chevL" onClick={onBack}>Back</Btn>
          <Btn variant="secondary" icon="download">Invoice</Btn>
          {(order.status === 'Awaiting payment' || order.status === 'Awaiting shipment') && (
            <Btn variant="secondary" icon="gift" onClick={() => { setDiscDraft(order.discountPct || 0); setDiscOpen(true); }}>
              {order.discountPct > 0 ? 'Edit discount' : 'Apply discount'}
            </Btn>
          )}
          {order.status === 'Awaiting payment' && (
            <Btn variant="primary" icon="check" onClick={markPaid}>Mark paid</Btn>
          )}
          {order.status === 'Awaiting shipment' && (
            <Btn variant="primary" icon="truck" onClick={markShipped} disabled={!allActivated} title={!allActivated ? `${prog.total - prog.done} device(s) still need SN + activation codes` : ''}>
              {allActivated ? 'Ship order' : `Activate ${prog.total - prog.done} more`}
            </Btn>
          )}

        </div>
      </div>

      {/* Pipeline */}
      <div className="info-card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '6px 22px' }}>
          <StatusPipeline order={order}/>
        </div>
      </div>

      {/* Activation guard banner for Awaiting shipment */}
      {order.status === 'Awaiting shipment' && (
        <div className={`notice ${allActivated ? '' : ''}`} style={{
          marginBottom: 20,
          background: allActivated ? 'var(--color-success-50)' : 'var(--color-warning-50)',
          borderColor: allActivated ? 'oklch(58% 0.14 152 / 0.25)' : 'oklch(75% 0.13 80 / 0.3)',
          color: allActivated ? 'var(--color-success-700)' : 'var(--color-warning-700)',
        }}>
          <Icon name={allActivated ? 'check' : 'info'} size={15}/>
          <div>
            {allActivated ? (
              <><strong>All {prog.total} devices activated.</strong> This order is ready to ship.</>
            ) : (
              <><strong>{prog.done} of {prog.total} devices activated.</strong> Warehouse staff must enter the 6-digit activation code shown on each device before this order can be shipped — serial numbers are matched automatically.</>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="det-tabs">
        {[
          { k: 'overview',   label: 'Overview' },
          { k: 'activation', label: `Devices & activation`, badge: `${prog.done}/${prog.total}` },
          { k: 'history',    label: 'History' },
        ].map(x => (
          <button key={x.k}
            className={`settings-tab ${tab === x.k ? 'is-on' : ''}`}
            onClick={() => setTab(x.k)}>
            {x.label}
            {x.badge && <span className="settings-tab__count">{x.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>
          {/* Line items */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Line items</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{order.items.length} model{order.items.length === 1 ? '' : 's'}</div>
            </div>
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
                {order.items.map(i => {
                  const filled = i.devices.filter(d => d.sn && d.code && d.code.length === 6).length;
                  return (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.modelName}</div>
                        <div className="cust-meta">{filled}/{i.qty} activated{i.shipped ? ' · shipped' : ''}</div>
                      </td>
                      <td>{i.type}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{moneyUSD(i.unitPrice)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{i.qty}</td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 500 }}>{moneyUSD(i.unitPrice * i.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', color: 'var(--color-text-secondary)', padding: '10px 16px', borderTop: '1px solid var(--color-border-subtle)' }}>Subtotal</td>
                  <td className="num" style={{ textAlign: 'right', padding: '10px 16px', borderTop: '1px solid var(--color-border-subtle)' }}>{moneyUSD(subtotal)}</td>
                </tr>
                {order.discountPct > 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'right', color: 'var(--color-success-700)', padding: '8px 16px' }}>Discount ({order.discountPct}%)</td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--color-success-700)', padding: '8px 16px' }}>− {moneyUSD(subtotal * order.discountPct / 100)}</td>
                  </tr>
                )}
                <tr style={{ background: 'var(--color-bg-3)' }}>
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600, fontSize: 15, padding: '14px 16px', borderTop: '1px solid var(--color-border-default)' }}>Total</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700, fontSize: 17, padding: '14px 16px', borderTop: '1px solid var(--color-border-default)', color: total === 0 ? 'var(--color-success-700)' : 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                    {total === 0 ? 'FREE' : moneyUSD(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="info-card">
              <div className="info-card__head"><div className="info-card__title">Shipping</div></div>
              <div className="info-card__body">
                <dl className="kvgrid" style={{ gridTemplateColumns: '90px 1fr', rowGap: 10 }}>
                  <dt>Recipient</dt><dd>{order.shipping?.name || <span className="muted">—</span>}</dd>
                  <dt>Address</dt><dd>{order.shipping?.address}</dd>
                  <dt>Method</dt><dd>{order.shipping?.method}</dd>
                  {order.shipping?.tracking && <><dt>Tracking</dt><dd style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{order.shipping.tracking}</dd></>}
                </dl>
              </div>
            </div>

            <div className="info-card">
              <div className="info-card__head"><div className="info-card__title">Order metadata</div></div>
              <div className="info-card__body">
                <dl className="kvgrid" style={{ gridTemplateColumns: '90px 1fr', rowGap: 10 }}>
                  <dt>Created</dt><dd>{fmtDateTime(order.createdAt)}</dd>
                  <dt>By</dt><dd style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{order.createdBy}</dd>
                  {order.notes && <><dt>Notes</dt><dd style={{ color: 'var(--color-text-secondary)' }}>{order.notes}</dd></>}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'activation' && (
        <ActivationTab
          order={order}
          onUpdate={onUpdate}
          readonly={order.status === 'Shipped' || order.status === 'Complete'}
        />
      )}

      {tab === 'activation' && order.status === 'Awaiting shipment' && (
        <div style={{ marginTop: 18, padding: 16, background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Icon name={allActivated ? 'check' : 'info'} size={18} style={{ color: allActivated ? 'var(--color-success-700)' : 'var(--color-warning-700)' }}/>
          <div style={{ flex: 1, fontSize: 13 }}>
            {allActivated
              ? <>All devices activated. You can proceed to shipping.</>
              : <>{prog.total - prog.done} device(s) still need their activation code entered.</>}
          </div>
          <Btn variant="primary" icon="truck" onClick={markShipped} disabled={!allActivated}>Ship order</Btn>
        </div>
      )}

      {tab === 'history' && (
        <div className="info-card">
          <div className="info-card__head"><div className="info-card__title">Timeline</div></div>
          <div className="info-card__body">
            <div className="timeline">
              {[...order.events].reverse().map((e, i) => {
                const tone =
                  e.kind === 'created' ? 'neutral' :
                  e.kind === 'paid' || e.kind === 'free' || e.kind === 'deliver' ? 'success' :
                  e.kind === 'ship' || e.kind === 'activate' ? 'info' :
                  e.kind === 'status' ? 'success' :
                  'warning';
                return (
                  <div className="tl-row" key={i}>
                    <div className={`tl-row__dot tl-row__dot--${tone}`}/>
                    <div className="tl-row__title">{e.text}</div>
                    <div className="tl-row__meta">
                      <span>{fmtDateTime(e.at)}</span>
                      <span>· {e.by}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mark-paid modal: choose payment method */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        width={560}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={confirmPaid}>Confirm payment</Btn>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
          How did <strong style={{ color: 'var(--color-text-primary)' }}>{order.customerName}</strong> pay
          {' '}<span className="num">{moneyUSD(total)}</span> for this order?
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {PAYMENT_METHODS.map(m => {
            const active = payMethod === m.id;
            return (
              <label key={m.id} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '11px 13px', borderRadius: 10,
                border: `1.5px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-surface-subtle, var(--color-neutral-50))' : 'var(--color-surface)',
                cursor: 'pointer',
              }}>
                <input type="radio" name="payMethod" checked={active} onChange={() => setPayMethod(m.id)} style={{ marginTop: 3 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{m.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
        {payMethod === 'other' && (
          <div style={{ marginTop: 12 }}>
            <Field label="Specify method">
              <Input value={payOther} onChange={e => setPayOther(e.target.value)} placeholder="e.g. crypto, barter, escrow release…"/>
            </Field>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Field label={`Reference / receipt no. ${payMethod === 'cash' ? '(optional)' : ''}`}>
            <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={
              payMethod === 'wire' ? 'e.g. WT-2026-04-22-118832' :
              payMethod === 'check' ? 'e.g. Check #4421' :
              payMethod === 'card' ? 'Last 4 / auth code' :
              payMethod === 'ach' ? 'ACH trace number' :
              payMethod === 'offset' ? 'Credit memo ID' :
              'Internal reference (optional)'
            }/>
          </Field>
        </div>
      </Modal>

      {/* Edit-discount modal */}
      <Modal
        open={discOpen}
        onClose={() => setDiscOpen(false)}
        title={order.discountPct > 0 ? 'Edit discount' : 'Apply discount'}
        width={480}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDiscOpen(false)}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={applyDiscount}>Save discount</Btn>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
          Lower the price for this order — anywhere from 0% to fully complimentary.
          Subtotal is <span className="num">{moneyUSD(subtotal)}</span>.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <Input
            type="number" min="0" max="100" step="1"
            value={discDraft}
            onChange={e => setDiscDraft(e.target.value)}
            style={{ width: 110, textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}
          />
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>% off</div>
          <div style={{ flex: 1 }}/>
          <div className="num" style={{ fontSize: 15, fontWeight: 600, color: (Number(discDraft) || 0) === 100 ? 'var(--color-success-700)' : 'var(--color-text-primary)' }}>
            {(Number(discDraft) || 0) === 100 ? 'FREE' : moneyUSD(subtotal * (1 - (Number(discDraft) || 0) / 100))}
          </div>
        </div>
        <input type="range" min="0" max="100" step="1" value={Number(discDraft) || 0}
          onChange={e => setDiscDraft(e.target.value)} style={{ width: '100%' }}/>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {[0, 5, 10, 25, 50, 100].map(p => (
            <button key={p} type="button"
              onClick={() => setDiscDraft(p)}
              className={`perm-fchip ${Number(discDraft) === p ? 'is-on' : ''}`}>
              {p === 100 ? 'Free' : p + '%'}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Reason (recorded in history)">
            <Input value={discReason} onChange={e => setDiscReason(e.target.value)} placeholder="e.g. partner pilot, exec approval, demo unit…"/>
          </Field>
        </div>
        {(Number(discDraft) || 0) !== (order.discountPct || 0) && order.status === 'Awaiting payment' && (Number(discDraft) || 0) === 100 && (
          <div className="notice" style={{ marginTop: 12, background: 'var(--color-success-50)', borderColor: 'oklch(58% 0.14 152 / 0.25)', color: 'var(--color-success-700)' }}>
            <Icon name="info" size={14}/>
            <div>This order will no longer require payment — status will jump to <strong>Awaiting shipment</strong> on save.</div>
          </div>
        )}
      </Modal>
    </div>
  );
};

window.OrderDetail = OrderDetail;
