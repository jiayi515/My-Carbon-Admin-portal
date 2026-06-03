/* global React, Btn, Input, Icon, ModelTile, DEVICE_MODELS,
   SEED_PRODUCTS, effectiveStatus,
   formatPriceRange, variantsSummary */
const { useState, useMemo } = React;

const ProductList = ({ products, onOpen, onNew }) => {
  const [q, setQ] = useState('');

  // Sales view — only Listed products are visible.
  const listedRows = useMemo(
    () => products
      .map((p) => ({ ...p, _eff: effectiveStatus(p) }))
      .filter((p) => p._eff === 'LISTED'),
    [products]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return listedRows;
    return listedRows.filter((p) =>
      p.name.toLowerCase().includes(s) ||
      (p.sku || '').toLowerCase().includes(s) ||
      (p.desc || '').toLowerCase().includes(s)
    );
  }, [listedRows, q]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Catalog</h1>
          <p className="page__sub">Browse the products available to sell.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download" size="md">Export</Btn>
          <Btn variant="primary" icon="plus" size="md" onClick={onNew}>New product</Btn>
        </div>
      </div>

      <div className="list-toolbar">
        <div className="list-toolbar__search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            prefix={<Icon name="search" size={14}/>}
            placeholder="Search by name or description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            size="md"/>
          {q && (
            <Btn variant="ghost" size="md" onClick={() => setQ('')}>Clear</Btn>
          )}
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <colgroup>
            <col style={{ width: '1%' }}/>
            <col/>
            <col style={{ width: '220px' }}/>
            <col style={{ width: '160px' }}/>
            <col style={{ width: '40px' }}/>
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Product</th>
              <th>Variants</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="5"><div className="empty">No products match your search.</div></td></tr>
            ) : filtered.map((p) => {
              const model = (window.DEVICE_MODELS || []).find((m) => m.id === p.deviceModelId);
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)}>
                  <td style={{ paddingTop: 10, paddingBottom: 10 }}>
                    {p.baseImage ? (
                      <span className="prod-list-img"><img src={p.baseImage} alt=""/></span>
                    ) : p.type === 'DEVICE' && model ? (
                      <ModelTile model={model} px={42}/>
                    ) : (
                      <div className="prod-tile-other">📦</div>
                    )}
                  </td>
                  <td>
                    <div className="cust-name">{p.name}</div>
                    <div className="cust-meta" style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.desc}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{variantsSummary(p)}</div>
                  </td>
                  <td style={{ textAlign: 'right' }} className="num">
                    <div style={{ fontWeight: 500 }}>{formatPriceRange(p)}</div>
                    {p.allowPriceOverride && (
                      <div className="cust-meta">override OK</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}>
                      <Icon name="chevR" size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────
const productListStyles = `
.prod-tile-other { width: 42px; height: 42px; border-radius: 10px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); display: grid; place-items: center; font-size: 22px; flex: none; }
.prod-list-img { width: 42px; height: 42px; border-radius: 10px; overflow: hidden; background: #fff; border: 1px solid var(--color-border-default); display: grid; place-items: center; flex: none; }
.prod-list-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
`;
if (typeof document !== 'undefined' && !document.getElementById('product-list-styles')) {
  const s = document.createElement('style');
  s.id = 'product-list-styles';
  s.textContent = productListStyles;
  document.head.appendChild(s);
}

window.ProductList = ProductList;
