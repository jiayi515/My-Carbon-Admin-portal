/* global React, Btn, Icon, Badge, ModelTile, DEVICE_MODELS, useToast,
   CATEGORY_BADGE, effectiveStatus, resolveVariantLabel */
// ─── Shop Cart ───────────────────────────────────────────────
// useCart() — persistent shopping cart hook (mock cloud-sync via localStorage).
// CartDrawer — right slide-in drawer, grouped by fulfillment category.
// CartTrigger — top-bar "🛒 Cart (n)" button that opens the drawer.

const CART_STORE_KEY = '__commerce_cart_v1__';

// ─── Hook: cart state, persisted ─────────────────────────────
const useCart = () => {
  const [lines, setLines] = React.useState(() => {
    try {
      const raw = localStorage.getItem(CART_STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(CART_STORE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  // Each line: { productId, variantId, qty, addedAt }
  // Snapshot fields are filled at checkout time from the live product.

  const findLineIndex = (productId, variantId) =>
    lines.findIndex((l) => l.productId === productId && l.variantId === variantId);

  const add = (product, variant, qty = 1, meta = {}) => {
    if (!variant) return;
    const i = findLineIndex(product.id, variant.id);
    setLines((curr) => {
      if (i >= 0) {
        const next = [...curr];
        next[i] = {
          ...next[i], qty: next[i].qty + qty,
          // Update unit price + integration mode to the latest selection.
          unitPriceOverride: variant.price,
          integrationMode: meta.integrationMode || next[i].integrationMode || null,
        };
        return next;
      }
      return [
        ...curr,
        {
          productId: product.id, variantId: variant.id, qty,
          unitPriceOverride: variant.price,
          integrationMode: meta.integrationMode || null,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const setQty = (productId, variantId, qty) => {
    setLines((curr) => {
      if (qty <= 0) return curr.filter((l) => !(l.productId === productId && l.variantId === variantId));
      return curr.map((l) => (l.productId === productId && l.variantId === variantId) ? { ...l, qty } : l);
    });
  };

  const remove = (productId, variantId) => setQty(productId, variantId, 0);

  const clear = () => setLines([]);

  const totalQty = lines.reduce((n, l) => n + l.qty, 0);

  return { lines, add, setQty, remove, clear, totalQty };
};

// Resolve a cart line → { product, variant } from live data
const resolveLine = (line, products) => {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === line.variantId);
  if (!variant) return null;
  return { product, variant };
};

// Fulfillment category for grouping
const fulfillmentOf = (product) => {
  if (product.type === 'OTHER') return 'OTHER';
  if (product.deviceVariant === 'SAMPLE') return 'SAMPLE';
  if (product.deviceVariant === 'PRODUCTION') return 'PRODUCTION';
  return 'OTHER';
};

const FULFILL_LABEL = {
  SAMPLE:     'Sample devices · 6-digit activation code',
  PRODUCTION: 'Production devices · SN/IMEI · Fleet enrollment',
  OTHER:      'Other items · shipping only',
};
const FULFILL_TONE = {
  SAMPLE: 'accent', PRODUCTION: 'success', OTHER: 'neutral',
};

// ─── CartTrigger (top-bar button) ─────────────────────────────
const CartTrigger = ({ totalQty, subtotal, onOpen }) => (
  <button type="button" className="cart-trigger" onClick={onOpen}>
    <Icon name="package" size={15}/>
    <span className="cart-trigger__lbl">Cart</span>
    <span className="cart-trigger__count">{totalQty}</span>
    <span className="cart-trigger__sub num">${subtotal.toFixed(2)}</span>
  </button>
);

// ─── CartDrawer ───────────────────────────────────────────────
const CartDrawer = ({ open, onClose, lines, products, onSetQty, onRemove, onClear, onCheckout }) => {
  const items = lines
    .map((l) => ({ line: l, ...resolveLine(l, products) }))
    .filter((x) => x.product && x.variant);

  const grouped = {
    SAMPLE: items.filter((x) => fulfillmentOf(x.product) === 'SAMPLE'),
    PRODUCTION: items.filter((x) => fulfillmentOf(x.product) === 'PRODUCTION'),
    OTHER: items.filter((x) => fulfillmentOf(x.product) === 'OTHER'),
  };

  const subtotal = items.reduce((s, { variant, line }) => {
    const unit = line.unitPriceOverride != null ? line.unitPriceOverride : variant.price;
    return s + unit * line.qty;
  }, 0);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="cart-backdrop" onClick={onClose}/>
      <aside className="cart-drawer">
        <div className="cart-drawer__head">
          <div>
            <div className="cart-drawer__title">Cart</div>
            <div className="cart-drawer__sub">{items.length === 0 ? 'Empty' : `${items.reduce((n, x) => n + x.line.qty, 0)} items`}</div>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty__icon"><Icon name="package" size={28}/></div>
              <div className="cart-empty__title">Your cart is empty</div>
              <div className="cart-empty__sub">Browse Products to add items.</div>
            </div>
          ) : (
            ['SAMPLE', 'PRODUCTION', 'OTHER'].map((key) => {
              const rows = grouped[key];
              if (!rows.length) return null;
              return (
                <div key={key} className="cart-group">
                  <div className="cart-group__head">
                    <Badge tone={FULFILL_TONE[key]} dot>
                      {key === 'SAMPLE' ? 'Sample' : key === 'PRODUCTION' ? 'Production' : 'Other'}
                    </Badge>
                    <span className="cart-group__hint">{FULFILL_LABEL[key]}</span>
                  </div>
                  {rows.map(({ line, product, variant }) => {
                    const model = (window.DEVICE_MODELS || []).find((m) => m.id === product.deviceModelId);
                    const img = variant.image || product.baseImage;
                    const variantLabel = resolveVariantLabel(product, variant);
                    const unit = line.unitPriceOverride != null ? line.unitPriceOverride : variant.price;
                    const isOverridden = line.unitPriceOverride != null && line.unitPriceOverride !== variant.price;
                    return (
                      <div key={`${line.productId}-${line.variantId}`} className="cart-row">
                        <div className="cart-row__img">
                          {img
                            ? <img src={img} alt=""/>
                            : product.type === 'DEVICE' && model
                              ? <ModelTile model={model} px={56}/>
                              : <div className="cart-row__placeholder">📦</div>}
                        </div>
                        <div className="cart-row__main">
                          <div className="cart-row__name">{product.name}</div>
                          {(variantLabel || line.integrationMode) && (
                            <div className="cart-row__variant">
                              {[line.integrationMode, variantLabel].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          <div className="cart-row__qty">
                            <button className="cart-qty-btn" onClick={() => onSetQty(line.productId, line.variantId, line.qty - 1)} aria-label="Decrease">
                              <Icon name="minus" size={11}/>
                            </button>
                            <span className="cart-qty-val">{line.qty}</span>
                            <button className="cart-qty-btn" onClick={() => onSetQty(line.productId, line.variantId, line.qty + 1)} aria-label="Increase">
                              <Icon name="plus" size={11}/>
                            </button>
                          </div>
                        </div>
                        <div className="cart-row__price">
                          <div className="cart-row__line num">${(unit * line.qty).toFixed(2)}</div>
                          <div className="cart-row__unit num">
                            ${unit.toFixed(2)} ea
                            {isOverridden && <span className="cart-row__ovr" title={`List price $${variant.price.toFixed(2)}`}> · overridden</span>}
                          </div>
                          <button className="cart-row__remove" onClick={() => onRemove(line.productId, line.variantId)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer__foot">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <span className="num">${subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-fulfill-preview">
              <div className="cart-fulfill-preview__lbl">Fulfillment preview</div>
              {grouped.SAMPLE.length > 0 && (
                <div>· {grouped.SAMPLE.reduce((n, x) => n + x.line.qty, 0)}× Sample → activation code</div>
              )}
              {grouped.PRODUCTION.length > 0 && (
                <div>· {grouped.PRODUCTION.reduce((n, x) => n + x.line.qty, 0)}× Production → SN/IMEI + Fleet</div>
              )}
              {grouped.OTHER.length > 0 && (
                <div>· {grouped.OTHER.reduce((n, x) => n + x.line.qty, 0)}× Other → shipping only</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" size="md" onClick={onClear}>Clear</Btn>
              <Btn variant="primary" size="md" icon="check" onClick={onCheckout} style={{ flex: 1 }}>Proceed to checkout</Btn>
            </div>
            <div className="cart-cloud-hint">
              <Icon name="check" size={11}/> Synced to cloud
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const cartStyles = `
.cart-trigger { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; border-radius: 8px; background: var(--color-bg-3); border: 1px solid var(--color-border-default); cursor: pointer; font-family: inherit; color: var(--color-text-primary); transition: all var(--duration-fast); }
.cart-trigger:hover { background: var(--color-bg-2); border-color: var(--color-border-strong); }
.cart-trigger__lbl { font-size: 12.5px; font-weight: 500; }
.cart-trigger__count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-primary-700); color: #fff; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cart-trigger__sub { font-size: 11.5px; color: var(--color-text-tertiary); padding-left: 4px; border-left: 1px solid var(--color-border-subtle); margin-left: 2px; }

.cart-backdrop { position: fixed; inset: 0; background: oklch(0% 0 0 / 0.35); z-index: 9050; animation: cartFade 160ms ease; }
.cart-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 92vw); background: var(--color-bg-1); border-left: 1px solid var(--color-border-default); box-shadow: -16px 0 48px oklch(0% 0 0 / 0.2); display: flex; flex-direction: column; z-index: 9051; animation: cartSlide 200ms ease; }
@keyframes cartFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cartSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }

.cart-drawer__head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--color-border-default); flex: none; }
.cart-drawer__title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.cart-drawer__sub { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.cart-drawer__body { flex: 1; overflow: auto; padding: 8px 0; }
.cart-drawer__foot { padding: 16px 18px; border-top: 1px solid var(--color-border-default); background: var(--color-bg-2); flex: none; display: flex; flex-direction: column; gap: 12px; }

.cart-empty { text-align: center; padding: 60px 24px; }
.cart-empty__icon { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; background: var(--color-bg-3); color: var(--color-text-tertiary); margin-bottom: 12px; }
.cart-empty__title { font-size: 14.5px; font-weight: 500; color: var(--color-text-primary); }
.cart-empty__sub { font-size: 12.5px; color: var(--color-text-tertiary); margin-top: 4px; }

.cart-group { padding: 8px 18px 4px; }
.cart-group__head { display: flex; align-items: center; gap: 8px; padding: 10px 0 6px; }
.cart-group__hint { font-size: 11px; color: var(--color-text-tertiary); }

.cart-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border-subtle); }
.cart-row:last-child { border-bottom: 0; }
.cart-row__img { flex: none; width: 56px; height: 56px; border-radius: 8px; overflow: hidden; background: #fff; border: 1px solid var(--color-border-default); display: grid; place-items: center; }
.cart-row__img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.cart-row__placeholder { font-size: 24px; }
.cart-row__main { flex: 1; min-width: 0; }
.cart-row__name { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cart-row__variant { font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 2px; }
.cart-row__qty { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 6px; padding: 1px; }
.cart-qty-btn { width: 22px; height: 22px; display: grid; place-items: center; border: 0; background: transparent; cursor: pointer; border-radius: 4px; color: var(--color-text-secondary); }
.cart-qty-btn:hover { background: var(--color-bg-3); color: var(--color-text-primary); }
.cart-qty-val { min-width: 22px; text-align: center; font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
.cart-row__price { text-align: right; min-width: 80px; }
.cart-row__line { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); }
.cart-row__unit { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }
.cart-row__ovr { color: var(--color-warning-700); }
.cart-row__remove { background: transparent; border: 0; color: var(--color-text-tertiary); cursor: pointer; font-size: 11px; padding: 4px 0 0; text-decoration: underline; font-family: inherit; }
.cart-row__remove:hover { color: var(--color-error-700); }

.cart-subtotal { display: flex; justify-content: space-between; align-items: baseline; font-size: 14.5px; font-weight: 600; }
.cart-fulfill-preview { background: var(--color-bg-3); border-radius: 8px; padding: 10px 12px; font-size: 11.5px; color: var(--color-text-secondary); line-height: 1.6; }
.cart-fulfill-preview__lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 4px; }
.cart-cloud-hint { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--color-text-tertiary); align-self: flex-end; }
.cart-cloud-hint svg { color: var(--color-success-700); }
`;

if (typeof document !== 'undefined' && !document.getElementById('cart-styles')) {
  const s = document.createElement('style');
  s.id = 'cart-styles';
  s.textContent = cartStyles;
  document.head.appendChild(s);
}

Object.assign(window, { useCart, CartTrigger, CartDrawer, resolveLine, fulfillmentOf, FULFILL_LABEL });
