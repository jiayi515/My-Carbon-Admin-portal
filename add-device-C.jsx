/* global React, DEVICE_MODELS, moneyUSD, Icon, Btn, QtyStepper, ModelTile, TypeBadge, ArtboardChrome, Eyebrow */
// ─── Prototype C — Per-model quantity matrix (B2B wholesale style) ──
// Flow:
//  Every model is a row in a matrix. Each row has two quantity inputs:
//  Semi-integration and Stand-alone. Operator fills in whatever they
//  need, and the order line items are derived from the non-zero cells.
//  No "Add" step — the matrix IS the order.
const { useState, useMemo } = React;

// quantities[modelId] = { Semi: n, Stand: n }
const SEED_C = {
  'm-n950': { 'Semi-integration': 6, 'Stand-alone': 3 },
  'm-s30':  { 'Semi-integration': 0, 'Stand-alone': 8 },
  'm-s60':  { 'Semi-integration': 0, 'Stand-alone': 0 },
  'm-s90':  { 'Semi-integration': 0, 'Stand-alone': 0 },
  'm-n750': { 'Semi-integration': 0, 'Stand-alone': 0 },
  'm-x800': { 'Semi-integration': 0, 'Stand-alone': 0 }, // x800 only has Semi
};

const PrototypeC = () => {
  const [qty, setQty] = useState(SEED_C);
  const [filter, setFilter] = useState('');

  const setCell = (modelId, type, v) => setQty(p => ({ ...p, [modelId]: { ...p[modelId], [type]: Math.max(0, v) } }));

  // Derived "order lines" — one per non-zero (model, type) cell.
  const lines = useMemo(() => {
    const out = [];
    DEVICE_MODELS.forEach(m => {
      m.types.forEach(t => {
        const q = qty[m.id]?.[t] || 0;
        if (q > 0) out.push({ modelId: m.id, type: t, qty: q });
      });
    });
    return out;
  }, [qty]);

  const totalUnits = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal   = lines.reduce((n, l) => {
    const m = DEVICE_MODELS.find(x => x.id === l.modelId);
    return n + (m?.unitPrice ?? 0) * l.qty;
  }, 0);
  const filledModels = DEVICE_MODELS.filter(m => (qty[m.id]?.['Semi-integration'] || 0) + (qty[m.id]?.['Stand-alone'] || 0) > 0).length;

  const filtered = DEVICE_MODELS.filter(m =>
    !filter.trim() || m.name.toLowerCase().includes(filter.toLowerCase()) || m.family.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <ArtboardChrome
      tag="Option C"
      title="One-shot model × Type matrix"
      sub="所有型号一次性可见，每行两个数量输入；非零行自动成为订单清单条目。"
      accent={{ bg: 'oklch(96% 0.05 35 / 0.7)', fg: 'var(--color-warning-700)', bd: 'oklch(70% 0.13 50 / 0.3)' }}
    >
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="tds-input tds-input--md" style={{ width: '100%' }}>
            <span className="tds-input__addon tds-input__addon--prefix"><Icon name="search" size={14}/></span>
            <input className="tds-input__el" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search models by name or family…"/>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          <strong style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{filledModels}</strong> of {DEVICE_MODELS.length} models added
        </div>
      </div>

      {/* Matrix */}
      <div style={{
        border: '1px solid var(--color-border-default)', borderRadius: 12,
        overflow: 'hidden', background: 'var(--color-bg-2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 1fr 1fr 110px',
          alignItems: 'end', gap: 12, padding: '12px 16px 10px',
          background: 'var(--color-bg-3)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          <div>Model</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent-700)' }}/>
            Semi-integration
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-success-700)' }}/>
            Stand-alone
          </div>
          <div style={{ textAlign: 'right' }}>Line total</div>
        </div>

        {/* Rows */}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            No models match "{filter}".
          </div>
        )}
        {filtered.map((m, idx) => {
          const semiQ  = qty[m.id]?.['Semi-integration'] || 0;
          const standQ = m.types.includes('Stand-alone') ? (qty[m.id]?.['Stand-alone'] || 0) : null;
          const rowQ   = semiQ + (standQ || 0);
          const hasAny = rowQ > 0;
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 1fr 1fr 110px',
              alignItems: 'center', gap: 12, padding: '12px 16px',
              borderTop: idx === 0 ? 0 : '1px solid var(--color-border-subtle)',
              background: hasAny ? 'oklch(96% 0.05 35 / 0.18)' : 'transparent',
              transition: 'background .15s',
            }}>
              {/* Model identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <ModelTile model={m} px={36}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.family} · {moneyUSD(m.unitPrice)}
                  </div>
                </div>
              </div>

              {/* Semi qty */}
              <QtyStepper value={semiQ} onChange={(q) => setCell(m.id, 'Semi-integration', q)} min={0} w={120}/>

              {/* Stand-alone qty (or N/A) */}
              {standQ === null ? (
                <div style={{
                  height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px dashed var(--color-border-default)', borderRadius: 8, width: 120,
                  fontSize: 11.5, color: 'var(--color-text-disabled)', fontWeight: 500,
                }}>Not available</div>
              ) : (
                <QtyStepper value={standQ} onChange={(q) => setCell(m.id, 'Stand-alone', q)} min={0} w={120}/>
              )}

              {/* Row total */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: hasAny ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
                  {rowQ === 0 ? '—' : moneyUSD(m.unitPrice * rowQ)}
                </div>
                {hasAny && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                    {rowQ} unit{rowQ === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Derived line preview */}
      <div style={{ marginTop: 22 }}>
        <Eyebrow right={`Auto-generated from non-zero cells · ${lines.length} line${lines.length === 1 ? '' : 's'}`}>Order lines (preview)</Eyebrow>
        <div style={{
          border: '1px solid var(--color-border-default)', borderRadius: 12,
          overflow: 'hidden', background: 'var(--color-bg-2)',
        }}>
          {lines.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Enter quantities above to see line items here.
            </div>
          )}
          {lines.map((l, i) => {
            const m = DEVICE_MODELS.find(x => x.id === l.modelId);
            return (
              <div key={l.modelId + l.type} style={{
                display: 'grid', gridTemplateColumns: '30px 1fr auto 110px',
                alignItems: 'center', gap: 12, padding: '9px 14px',
                borderTop: i === 0 ? 0 : '1px solid var(--color-border-subtle)',
              }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)',
                  fontVariantNumeric: 'tabular-nums', textAlign: 'center',
                }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                  <TypeBadge type={l.type} size="sm"/>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                  {moneyUSD(m.unitPrice)} × {l.qty}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {moneyUSD(m.unitPrice * l.qty)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 14, padding: '14px 16px',
          background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Icon name="info" size={14} style={{ color: 'var(--color-info-700)', flex: 'none' }}/>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', flex: 1, lineHeight: 1.45 }}>
            Pros: 一次性可见所有型号 · 同型号双 Type 同行完成 · 录入最快。<br/>
            Cons: 矩阵更密集；型号较多时需搜索/分组；初见有学习成本。
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {totalUnits} units · Subtotal
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{moneyUSD(subtotal)}</div>
          </div>
        </div>
      </div>
    </ArtboardChrome>
  );
};

window.PrototypeC = PrototypeC;
