/* global React, Btn, Input, Icon, Badge, ModelTile, DEVICE_MODELS,
   effectiveStatus, CATEGORY_BADGE, formatPriceRange, useToast */
const { useState, useMemo } = React;

// ─── Shop browse (Products page for sales) ──────────────────
// Top filter bar + responsive card grid.
// Filters are deferred — user edits pending values and clicks Search to apply.
// Only LISTED products show. 0-axis products get a Quick Add button.

const CATEGORY_OPTIONS = [
  { id: 'all',    label: 'All categories' },
  { id: 'sample', label: 'Sample devices' },
  { id: 'prod',   label: 'Production devices' },
  { id: 'other',  label: 'Other' },
];

const ProductsBrowse = ({ products, onOpen, onQuickAdd }) => {
  // Pending = currently in the form. Applied = what the grid filters on.
  // Filters only commit when the user clicks the Search button.
  const [pendingQ, setPendingQ] = useState('');
  const [pendingCategory, setPendingCategory] = useState('all');
  const [pendingModelId, setPendingModelId] = useState('all');
  const [applied, setApplied] = useState({ q: '', category: 'all', modelId: 'all' });
  const toast = useToast();

  // Only show LISTED products (storefront semantics)
  const listed = useMemo(
    () => products.filter((p) => effectiveStatus(p) === 'LISTED'),
    [products]
  );

  const filtered = useMemo(() => {
    let rows = listed;
    if (applied.q.trim()) {
      const s = applied.q.toLowerCase();
      // Match name + description only (SKU is intentionally NOT searched here)
      rows = rows.filter((p) =>
        p.name.toLowerCase().includes(s) ||
        (p.desc || '').toLowerCase().includes(s)
      );
    }
    if (applied.category === 'sample')      rows = rows.filter((p) => p.deviceVariant === 'SAMPLE');
    else if (applied.category === 'prod')   rows = rows.filter((p) => p.deviceVariant === 'PRODUCTION');
    else if (applied.category === 'other')  rows = rows.filter((p) => p.type === 'OTHER');
    if (applied.modelId !== 'all')          rows = rows.filter((p) => p.deviceModelId === applied.modelId);
    return rows;
  }, [listed, applied]);

  // Models that appear in current listing (for the model filter)
  const availableModels = useMemo(() => {
    const ids = new Set(listed.map((p) => p.deviceModelId).filter(Boolean));
    return (window.DEVICE_MODELS || []).filter((m) => ids.has(m.id));
  }, [listed]);

  const isDirty =
    pendingQ !== applied.q ||
    pendingCategory !== applied.category ||
    pendingModelId !== applied.modelId;

  const hasFilter =
    applied.q || applied.category !== 'all' || applied.modelId !== 'all';

  const runSearch = () => {
    setApplied({ q: pendingQ, category: pendingCategory, modelId: pendingModelId });
  };

  const clearAll = () => {
    setPendingQ('');
    setPendingCategory('all');
    setPendingModelId('all');
    setApplied({ q: '', category: 'all', modelId: 'all' });
  };

  const onSearchKey = (e) => {
    if (e.key === 'Enter') runSearch();
  };

  const handleQuickAdd = (product) => {
    if (product.specs.length > 0) {
      onOpen(product.id);  // multi-variant → open PDP
      return;
    }
    onQuickAdd(product, product.variants[0]);
    toast({ kind: 'success', title: 'Added to cart', msg: product.name });
  };

  return (
    <div className="page page--wide">
      <div className="shop-head">
        <div>
          <h1 className="page__title">Products</h1>
          <p className="page__sub">Browse the catalog and add items to your cart. {listed.length} active products.</p>
        </div>
      </div>

      <div className="shop-filters">
        <div className="shop-filters__row">
          <Input prefix={<Icon name="search" size={14}/>}
            placeholder="Search by name or description…"
            value={pendingQ}
            onChange={(e) => setPendingQ(e.target.value)}
            onKeyDown={onSearchKey}
            size="md"
            style={{ flex: 1, minWidth: 280 }}/>

          <div className="tds-select tds-select--md" style={{ width: 200 }}>
            <select value={pendingCategory} onChange={(e) => setPendingCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>

          {availableModels.length > 0 && (
            <div className="tds-select tds-select--md" style={{ width: 180 }}>
              <select value={pendingModelId} onChange={(e) => setPendingModelId(e.target.value)}>
                <option value="all">All models</option>
                {availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
            </div>
          )}

          <Btn variant="primary" size="md" icon="search" onClick={runSearch}>Search</Btn>
          {(hasFilter || isDirty) && (
            <Btn variant="ghost" size="md" onClick={clearAll}>Clear</Btn>
          )}
        </div>
        {isDirty && (
          <div className="shop-filters__dirty">
            <Icon name="info" size={11}/> Filter changed — click <strong>Search</strong> to apply.
          </div>
        )}
      </div>

      <div className="shop-result-bar">
        <div>
          Showing <strong>{filtered.length}</strong> of {listed.length} products
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty" style={{ padding: '60px 20px' }}>
          No products match your filters.
          <div style={{ marginTop: 10 }}>
            <Btn size="sm" variant="ghost" onClick={clearAll}>Clear filters</Btn>
          </div>
        </div>
      ) : (
        <div className="shop-grid">
          {filtered.map((p) => {
            const cat = CATEGORY_BADGE(p);
            const model = (window.DEVICE_MODELS || []).find((m) => m.id === p.deviceModelId);
            const hasVariants = p.specs.length > 0;
            const img = p.baseImage || null;
            return (
              <article key={p.id} className="shop-card" onClick={() => onOpen(p.id)}>
                <div className="shop-card__img">
                  {img ? (
                    <img src={img} alt={p.name}/>
                  ) : p.type === 'DEVICE' && model ? (
                    <ModelTile model={model} px={140}/>
                  ) : (
                    <div className="shop-card__placeholder">📦</div>
                  )}
                  <div className="shop-card__badge">
                    <Badge tone={cat.tone} dot>{cat.label}</Badge>
                  </div>
                </div>
                <div className="shop-card__body">
                  <div className="shop-card__name">{p.name}</div>
                  {p.sku && <div className="shop-card__sku">{p.sku}</div>}
                  <div className="shop-card__desc">{p.desc}</div>
                  <div className="shop-card__price-row">
                    <div className="shop-card__price num">{formatPriceRange(p)}</div>
                    {hasVariants && (
                      <div className="shop-card__opts">{p.variants.length} options</div>
                    )}
                  </div>
                  <div className="shop-card__cta">
                    {hasVariants ? (
                      <Btn variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}>
                        View options
                      </Btn>
                    ) : (
                      <Btn variant="primary" size="sm" icon="plus"
                        onClick={(e) => { e.stopPropagation(); handleQuickAdd(p); }}>
                        Add to cart
                      </Btn>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const shopBrowseStyles = `
.page--wide { max-width: 1280px; }
.shop-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }

.shop-filters { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-1); }
.shop-filters__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.shop-filters__dirty { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-warning-700); padding: 2px 4px; }
.shop-filters__dirty strong { font-weight: 600; }

.shop-result-bar { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 14px; color: var(--color-text-tertiary); font-size: 12.5px; }
.shop-result-bar strong { color: var(--color-text-primary); font-weight: 600; }

.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

.shop-card { display: flex; flex-direction: column; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all var(--duration-fast); box-shadow: var(--shadow-1); }
.shop-card:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-2); transform: translateY(-1px); }
.shop-card__img { position: relative; aspect-ratio: 1; background: #fff; display: grid; place-items: center; padding: 18px; border-bottom: 1px solid var(--color-border-subtle); }
.shop-card__img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.shop-card__placeholder { font-size: 64px; opacity: 0.55; }
.shop-card__badge { position: absolute; top: 10px; left: 10px; }

.shop-card__body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
.shop-card__name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); letter-spacing: -0.005em; line-height: 1.3; }
.shop-card__sku { font: 500 11px var(--font-family-mono); color: var(--color-text-tertiary); }
.shop-card__desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 35px; margin-top: 2px; }
.shop-card__price-row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; margin-top: 8px; }
.shop-card__price { font-size: 16px; font-weight: 600; color: var(--color-text-primary); letter-spacing: -0.01em; }
.shop-card__opts { font-size: 11px; color: var(--color-text-tertiary); }
.shop-card__cta { margin-top: 10px; display: flex; }
.shop-card__cta > * { flex: 1; justify-content: center; }
`;

if (typeof document !== 'undefined' && !document.getElementById('shop-browse-styles')) {
  const s = document.createElement('style');
  s.id = 'shop-browse-styles';
  s.textContent = shopBrowseStyles;
  document.head.appendChild(s);
}

window.ProductsBrowse = ProductsBrowse;
