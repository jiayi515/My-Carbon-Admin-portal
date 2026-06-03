/* global React, DEVICE_MODELS, moneyUSD, Icon, Btn, QtyStepper, ModelTile, TypeBadge, ArtboardChrome, Eyebrow */
// ─── Prototype A — Popup-on-add (你的原方案) ─────────────────────────
// Flow:
//  1. Click a model card in the picker
//  2. Modal opens asking for Type (Semi/Stand-alone) + qty
//  3. Confirm → add to list
//     · Same (model, type) merges qty into existing line
//     · Different type → new line
const { useState } = React;

// Pre-seed a couple of lines so the merging behavior is visible
const SEED_A = [
  { id: 'l1', modelId: 'm-n950', type: 'Semi-integration', qty: 6 },
  { id: 'l2', modelId: 'm-n950', type: 'Stand-alone',     qty: 3 },
  { id: 'l3', modelId: 'm-s30',  type: 'Stand-alone',     qty: 8 },
];

const PrototypeA = () => {
  const [items, setItems] = useState(SEED_A);
  const [picker, setPicker] = useState(null);      // model being added (drives modal)
  const [toast,  setToast]  = useState(null);      // ephemeral feedback

  // Add or merge a line
  const commit = (modelId, type, qty) => {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.modelId === modelId && it.type === type);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = { ...next[i], qty: next[i].qty + qty };
        setToast({ kind: 'merge', text: `Merged into existing ${DEVICE_MODELS.find(m=>m.id===modelId).name} · ${type} line (+${qty})` });
        return next;
      }
      setToast({ kind: 'new', text: `New line added: ${DEVICE_MODELS.find(m=>m.id===modelId).name} · ${type} × ${qty}` });
      return [...prev, { id: 'l' + Math.random().toString(36).slice(2, 6), modelId, type, qty }];
    });
    setPicker(null);
    clearTimeout(commit._t);
    commit._t = setTimeout(() => setToast(null), 2200);
  };

  const remove = (id) => setItems((p) => p.filter((it) => it.id !== id));

  const subtotal = items.reduce((n, it) => {
    const m = DEVICE_MODELS.find(x => x.id === it.modelId);
    return n + (m?.unitPrice ?? 0) * it.qty;
  }, 0);
  const totalUnits = items.reduce((n, it) => n + it.qty, 0);

  return (
    <ArtboardChrome
      tag="Option A"
      title="Pick model → popup → add"
      sub="弹窗确认 Type 后入清单。同型号同 Type 合并，不同 Type 分行。"
      accent={{ bg: 'oklch(96% 0.04 265 / 0.65)', fg: 'var(--color-accent-700)', bd: 'oklch(70% 0.12 265 / 0.3)' }}
    >
      {/* Model picker */}
      <Eyebrow right="Click a model to add">Add a model</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {DEVICE_MODELS.map((m) => (
          <button key={m.id} onClick={() => setPicker({ modelId: m.id, type: m.types[0], qty: 1 })}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-1)', textAlign: 'left', cursor: 'pointer', minWidth: 0,
              transition: 'border-color .12s, transform .08s',
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

      {/* Order line items */}
      <div style={{ marginTop: 22 }}>
        <Eyebrow right={`${items.length} line${items.length === 1 ? '' : 's'} · ${totalUnits} units`}>Order lines</Eyebrow>
        <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg-2)' }}>
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              No models yet. Pick one above.
            </div>
          )}
          {items.map((it, idx) => {
            const m = DEVICE_MODELS.find(x => x.id === it.modelId);
            const justMerged = toast?.kind === 'merge' && toast.text.includes(m.name) && toast.text.includes(it.type);
            return (
              <div key={it.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr auto auto auto 24px',
                alignItems: 'center', gap: 14, padding: '12px 14px',
                borderTop: idx === 0 ? 0 : '1px solid var(--color-border-subtle)',
                background: justMerged ? 'oklch(96% 0.05 155 / 0.5)' : 'transparent',
                transition: 'background 1s',
              }}>
                <ModelTile model={m} px={40}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                    <TypeBadge type={it.type} size="sm"/>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                    {m.family} · Unit {moneyUSD(m.unitPrice)}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>× {it.qty}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
                  {moneyUSD(m.unitPrice * it.qty)}
                </div>
                <div/>
                <button onClick={() => remove(it.id)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-error-700)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                  title="Remove">
                  <Icon name="trash" size={14}/>
                </button>
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
            Pros: 清晰、改动小；同型号双 Type 完全支持。<br/>
            Cons: 同型号两 Type 需开两次弹窗，对熟手有打断感。
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Subtotal</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{moneyUSD(subtotal)}</div>
          </div>
        </div>
      </div>

      {/* ─── Type-picker modal ─── */}
      {picker && <TypePickerModal picker={picker} setPicker={setPicker} commit={commit} existing={items}/>}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 14px', borderRadius: 10,
          background: toast.kind === 'merge' ? 'oklch(96% 0.05 155 / 0.95)' : 'oklch(20% 0.01 270 / 0.96)',
          color: toast.kind === 'merge' ? 'var(--color-success-700)' : '#fff',
          border: toast.kind === 'merge' ? '1px solid oklch(70% 0.12 155 / 0.3)' : '1px solid oklch(30% 0.01 270)',
          fontSize: 12.5, fontWeight: 500,
          boxShadow: 'var(--shadow-4)', display: 'flex', alignItems: 'center', gap: 8,
          zIndex: 50,
        }}>
          <Icon name={toast.kind === 'merge' ? 'check' : 'plus'} size={14}/>
          {toast.text}
        </div>
      )}
    </ArtboardChrome>
  );
};

// ─── Type picker modal ──────────────────────────────────────────────
const TypePickerModal = ({ picker, setPicker, commit, existing }) => {
  const m = DEVICE_MODELS.find(x => x.id === picker.modelId);
  const existingForSameType = existing.find(it => it.modelId === picker.modelId && it.type === picker.type);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'oklch(15% 0.01 270 / 0.45)',
      display: 'grid', placeItems: 'center', zIndex: 100,
      animation: 'A_fadeIn 0.12s ease-out',
    }} onClick={() => setPicker(null)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: 380, background: 'var(--color-bg-2)',
          borderRadius: 14, boxShadow: 'var(--shadow-5)',
          border: '1px solid var(--color-border-default)',
          overflow: 'hidden',
          animation: 'A_zoomIn 0.16s cubic-bezier(0.2, 0, 0, 1)',
        }}>
        {/* Header with model */}
        <div style={{
          padding: '18px 20px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg-3))',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <ModelTile model={m} px={48}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Add {m.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {m.family} · {moneyUSD(m.unitPrice)} per unit
            </div>
          </div>
          <button onClick={() => setPicker(null)}
            style={{ width: 28, height: 28, border: 0, background: 'transparent', borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
            <Icon name="x" size={14}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          {/* Type radio cards */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 9 }}>
            Device type
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {m.types.map((t) => {
              const on = picker.type === t;
              return (
                <button key={t} onClick={() => setPicker({ ...picker, type: t })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    background: on ? 'var(--color-primary-50)' : 'var(--color-bg-2)',
                    border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
                    boxShadow: on ? '0 0 0 3px oklch(40% 0.14 262 / 0.08)' : 'none',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all .12s',
                  }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: `1.5px solid ${on ? 'var(--color-primary-700)' : 'var(--color-border-strong)'}`,
                    display: 'grid', placeItems: 'center', flex: 'none',
                  }}>
                    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary-700)' }}/>}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TypeBadge type={t} size="sm"/>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                      {t === 'Semi-integration' ? 'Drives a host POS via API/SDK.' : 'Runs standalone payment flow on-device.'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quantity */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 9 }}>
              Quantity
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <QtyStepper value={picker.qty} onChange={(q) => setPicker({ ...picker, qty: q })} min={1} w={132}/>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                = <strong style={{ color: 'var(--color-text-primary)' }}>{moneyUSD(m.unitPrice * picker.qty)}</strong>
              </div>
            </div>
          </div>

          {/* Merge preview */}
          {existingForSameType && (
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'oklch(96% 0.05 155 / 0.5)', border: '1px solid oklch(70% 0.12 155 / 0.3)',
              borderRadius: 8,
              fontSize: 12, color: 'var(--color-success-700)', lineHeight: 1.45,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="info" size={13}/>
              <span>
                清单已有 <strong>{m.name} · {picker.type}</strong> (×{existingForSameType.qty})，
                确认后将合并为 <strong>×{existingForSameType.qty + picker.qty}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-3)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Btn variant="ghost" size="md" onClick={() => setPicker(null)}>Cancel</Btn>
          <Btn variant="primary" size="md" iconRight="arrowR" onClick={() => commit(picker.modelId, picker.type, picker.qty)}>
            Add to order
          </Btn>
        </div>
      </div>
    </div>
  );
};

window.PrototypeA = PrototypeA;
