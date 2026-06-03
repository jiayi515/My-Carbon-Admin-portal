/* global React, DEVICE_MODELS, moneyUSD, Icon, Btn, Select, QtyStepper, ModelTile, TypeBadge, ArtboardChrome, Eyebrow */
// ─── Prototype B — Inline Type column + Split row ──────────────────
// Flow:
//  1. Click a model card → added to list with default Type (Semi)
//  2. Type column is an inline dropdown — change without re-adding
//  3. Each row has a "Split" action → opens an inline popover that
//     lets you split N units into Semi + Stand-alone halves.
//  4. Adding the same (model, type) merges quantity.
const { useState, useRef, useEffect } = React;

const SEED_B = [
  { id: 'l1', modelId: 'm-n950', type: 'Semi-integration', qty: 6 },
  { id: 'l2', modelId: 'm-n950', type: 'Stand-alone',     qty: 3 },
  { id: 'l3', modelId: 'm-s30',  type: 'Stand-alone',     qty: 8 },
];

const PrototypeB = () => {
  const [items, setItems] = useState(SEED_B);
  const [splitting, setSplitting] = useState(null); // { lineId, semi, stand }
  const [highlight, setHighlight] = useState(null);

  const flash = (id) => { setHighlight(id); setTimeout(() => setHighlight(null), 1100); };

  const addModel = (modelId) => {
    const m = DEVICE_MODELS.find(x => x.id === modelId);
    const type = m.types[0]; // default Semi
    setItems((prev) => {
      const i = prev.findIndex((it) => it.modelId === modelId && it.type === type);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        flash(next[i].id);
        return next;
      }
      const id = 'l' + Math.random().toString(36).slice(2, 6);
      flash(id);
      return [...prev, { id, modelId, type, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => setItems(p => p.map(it => it.id === id ? { ...it, qty: Math.max(1, qty) } : it));
  const remove    = (id)      => setItems(p => p.filter(it => it.id !== id));

  // Change the type on a row. If a line with (model, newType) already
  // exists, merge into it and drop the current row.
  const changeType = (id, newType) => {
    setItems((prev) => {
      const cur = prev.find(it => it.id === id);
      if (!cur || cur.type === newType) return prev;
      const dup = prev.find(it => it.id !== id && it.modelId === cur.modelId && it.type === newType);
      if (dup) {
        flash(dup.id);
        return prev
          .filter(it => it.id !== id)
          .map(it => it.id === dup.id ? { ...it, qty: it.qty + cur.qty } : it);
      }
      return prev.map(it => it.id === id ? { ...it, type: newType } : it);
    });
  };

  // Apply a split: line N → split into Semi (a) + Stand-alone (b), where a+b = N
  const applySplit = ({ lineId, semi, stand }) => {
    setItems((prev) => {
      const cur = prev.find(it => it.id === lineId);
      if (!cur) return prev;
      const total = semi + stand;
      if (total !== cur.qty || semi <= 0 || stand <= 0) return prev;

      // Build the two target rows, merging into any existing ones
      let next = prev.filter(it => it.id !== lineId);
      const apply = (type, q) => {
        const existing = next.find(it => it.modelId === cur.modelId && it.type === type);
        if (existing) next = next.map(it => it === existing ? { ...it, qty: it.qty + q } : it);
        else          next = [...next, { id: 'l' + Math.random().toString(36).slice(2, 6), modelId: cur.modelId, type, qty: q }];
      };
      apply('Semi-integration', semi);
      apply('Stand-alone',      stand);
      return next;
    });
    setSplitting(null);
  };

  const totalUnits = items.reduce((n, it) => n + it.qty, 0);
  const subtotal   = items.reduce((n, it) => {
    const m = DEVICE_MODELS.find(x => x.id === it.modelId); return n + (m?.unitPrice ?? 0) * it.qty;
  }, 0);

  return (
    <ArtboardChrome
      tag="Option B"
      title="Inline Type column + row split"
      sub="点击型号直接入清单，Type 在行内可切换；单行可一键拆分为 Semi + Stand-alone。"
      accent={{ bg: 'oklch(96% 0.05 155 / 0.65)', fg: 'var(--color-success-700)', bd: 'oklch(70% 0.12 155 / 0.3)' }}
    >
      {/* Model picker — same as A */}
      <Eyebrow right="One click adds it (default: Semi-integration)">Add a model</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {DEVICE_MODELS.map((m) => (
          <button key={m.id} onClick={() => addModel(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-1)', textAlign: 'left', cursor: 'pointer', minWidth: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
          >
            <ModelTile model={m} px={40}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.family} · {moneyUSD(m.unitPrice)}
              </div>
            </div>
            <Icon name="plus" size={14}/>
          </button>
        ))}
      </div>

      {/* Editable line items table */}
      <div style={{ marginTop: 22 }}>
        <Eyebrow right={`${items.length} line${items.length === 1 ? '' : 's'} · ${totalUnits} units`}>Order lines</Eyebrow>
        <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg-2)' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '40px minmax(0, 1.4fr) 168px 116px 90px 28px',
            alignItems: 'center', gap: 12, padding: '9px 14px',
            background: 'var(--color-bg-3)',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            <div/>
            <div>Model</div>
            <div>Type</div>
            <div>Qty</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div/>
          </div>
          {items.map((it) => {
            const m  = DEVICE_MODELS.find(x => x.id === it.modelId);
            const canSplit = it.qty >= 2 && m.types.length > 1;
            const lit = highlight === it.id;
            return (
              <div key={it.id}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '40px minmax(0, 1.4fr) 168px 116px 90px 28px',
                  alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderTop: '1px solid var(--color-border-subtle)',
                  background: lit ? 'oklch(96% 0.05 155 / 0.55)' : 'transparent',
                  transition: 'background 1.1s',
                }}>
                  <ModelTile model={m} px={36}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{m.family} · {moneyUSD(m.unitPrice)}</div>
                  </div>
                  {/* Inline type select (visual chip + native select overlay for full a11y) */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 8px 5px 10px', height: 32,
                      borderRadius: 8, border: '1px solid var(--color-border-default)',
                      background: 'var(--color-bg-2)', cursor: 'pointer',
                    }}>
                      <TypeBadge type={it.type} size="sm"/>
                      <Icon name="chevD" size={12} style={{ color: 'var(--color-text-tertiary)' }}/>
                    </div>
                    <select
                      value={it.type}
                      onChange={(e) => changeType(it.id, e.target.value)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', font: 'inherit' }}
                      title="Change device type"
                    >
                      {m.types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <QtyStepper value={it.qty} onChange={(q) => updateQty(it.id, q)} min={1}/>
                  <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {moneyUSD(m.unitPrice * it.qty)}
                  </div>
                  <RowMenu
                    onSplit={canSplit ? () => setSplitting({ lineId: it.id, semi: Math.floor(it.qty / 2), stand: Math.ceil(it.qty / 2) }) : null}
                    onRemove={() => remove(it.id)}
                    canSplit={canSplit}
                  />
                </div>

                {/* Inline split popover, appears under the row being split */}
                {splitting?.lineId === it.id && (
                  <SplitPopover
                    line={it}
                    model={m}
                    state={splitting}
                    setState={setSplitting}
                    onApply={applySplit}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div style={{
          marginTop: 14, padding: '14px 16px',
          background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Icon name="info" size={14} style={{ color: 'var(--color-info-700)', flex: 'none' }}/>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', flex: 1, lineHeight: 1.45 }}>
            Pros: 无弹窗、表格式录入最顺手；行内 Type 切换 + 拆分非常灵活。<br/>
            Cons: 表格列变多；新手需理解"拆分"语义。
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Subtotal</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{moneyUSD(subtotal)}</div>
          </div>
        </div>
      </div>
    </ArtboardChrome>
  );
};

// ─── Row action menu (split / remove) ───────────────────────────────
const RowMenu = ({ onSplit, onRemove, canSplit }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Row actions"
        style={{
          width: 28, height: 28, borderRadius: 6, border: 0,
          background: open ? 'var(--color-bg-hover)' : 'transparent',
          display: 'grid', placeItems: 'center',
          color: open ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          cursor: 'pointer',
        }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 30,
          background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
          borderRadius: 8, boxShadow: 'var(--shadow-3)',
          minWidth: 188, padding: 4,
        }}>
          <button
            disabled={!canSplit}
            onClick={() => { setOpen(false); onSplit?.(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 5, border: 0,
              background: 'transparent', textAlign: 'left',
              color: canSplit ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              cursor: canSplit ? 'pointer' : 'not-allowed', fontSize: 13,
            }}
            onMouseEnter={(e) => { if (canSplit) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <Icon name="dup" size={14} style={{ color: 'var(--color-accent-700)' }}/>
            <span style={{ flex: 1 }}>Split into Semi + Stand-alone</span>
          </button>
          <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 6px' }}/>
          <button onClick={() => { setOpen(false); onRemove(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 5, border: 0,
              background: 'transparent', textAlign: 'left',
              color: 'var(--color-error-700)', cursor: 'pointer', fontSize: 13,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(96% 0.04 25 / 0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <Icon name="trash" size={14}/>
            <span>Remove line</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Split popover ──────────────────────────────────────────────────
const SplitPopover = ({ line, model, state, setState, onApply }) => {
  const total = line.qty;
  const sum   = state.semi + state.stand;
  const ok    = sum === total && state.semi > 0 && state.stand > 0;

  const setSemi  = (v) => setState({ ...state, semi: v, stand: total - v });
  const setStand = (v) => setState({ ...state, stand: v, semi: total - v });

  return (
    <div style={{
      padding: '14px 16px 16px 60px',
      background: 'oklch(96% 0.04 265 / 0.4)',
      borderTop: '1px solid var(--color-border-subtle)',
      borderBottom: '1px solid var(--color-border-subtle)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', left: 24, top: 18,
        width: 22, height: 22, borderRadius: 6,
        background: 'var(--color-accent-700)', color: '#fff',
        display: 'grid', placeItems: 'center',
      }}>
        <Icon name="dup" size={12}/>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        Split <strong style={{ color: 'var(--color-text-primary)' }}>{model.name}</strong> · {total} units into two types
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          padding: '10px 12px', background: 'var(--color-bg-2)',
          border: '1px solid var(--color-border-default)', borderRadius: 8,
        }}>
          <TypeBadge type="Semi-integration" size="sm"/>
          <div style={{ marginTop: 8 }}>
            <QtyStepper value={state.semi} onChange={setSemi} min={0} max={total} w={132}/>
          </div>
        </div>
        <div style={{
          padding: '10px 12px', background: 'var(--color-bg-2)',
          border: '1px solid var(--color-border-default)', borderRadius: 8,
        }}>
          <TypeBadge type="Stand-alone" size="sm"/>
          <div style={{ marginTop: 8 }}>
            <QtyStepper value={state.stand} onChange={setStand} min={0} max={total} w={132}/>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 11.5, color: ok ? 'var(--color-success-700)' : 'var(--color-warning-700)', fontWeight: 500 }}>
          {ok ? <>✓ Sums to <strong>{total}</strong></> : <>Sums to <strong>{sum}</strong>, must equal {total}</>}
        </div>
        <div style={{ flex: 1 }}/>
        <Btn variant="ghost" size="sm" onClick={() => setState(null)}>Cancel</Btn>
        <Btn variant="primary" size="sm" disabled={!ok} onClick={() => onApply(state)}>Apply split</Btn>
      </div>
    </div>
  );
};

window.PrototypeB = PrototypeB;
