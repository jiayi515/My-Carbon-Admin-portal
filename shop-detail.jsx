/* global React, Btn, Icon, Badge, ModelTile, DEVICE_MODELS, useToast,
   effectiveStatus, CATEGORY_BADGE, FULFILL_LABEL, fulfillmentOf,
   productIntegrationModes, resolveVariantLabel */
const { useState, useMemo, useEffect } = React;

// ─── Product Detail Page (PDP) ─────────────────────────────
// Two-column layout (simpler than Amazon's 3-col):
//   Left  (45%): image gallery
//   Right (55%): title, info, variant picker, qty, Add to cart, fulfillment
//   Below: tabs (Description / Specifications / Variants)
//
// Reuses live product data so any cart-side price snapshot is always current
// at click-add time.

const ProductDetail = ({ productId, products, onBack, onAddToCart }) => {
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [priceOverride, setPriceOverride] = useState(null);  // null = use variant price
  const [editingPrice, setEditingPrice] = useState(false);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('description');
  const [selectedImage, setSelectedImage] = useState(0);
  const toast = useToast();

  // Pick a default variant + integration mode when product loads
  const integrationModes = useMemo(
    () => product ? productIntegrationModes(product) : [],
    [product]
  );
  useEffect(() => {
    if (!product) return;
    const active = product.variants.find((v) => v.status === 'ACTIVE') || product.variants[0];
    setSelectedVariantId(active?.id || null);
    setSelectedIntegration(integrationModes[0] || null);
    setPriceOverride(null);
    setEditingPrice(false);
    setSelectedImage(0);
    setQty(1);
  }, [productId]);

  // Legacy compat: if specs[0] is "Integration mode", picking an integration
  // should also select the matching variant (since those variants ARE the
  // integration modes for old seed products).
  useEffect(() => {
    if (!product || !selectedIntegration) return;
    const specs = product.specs || [];
    if (specs[0] && /^integration\s*mode$/i.test(specs[0].name)) {
      const axis = specs[0];
      const match = axis.values.find((v) => v.label === selectedIntegration);
      if (match) {
        const v = product.variants.find((x) => x.combination[axis.id] === match.id);
        if (v && v.id !== selectedVariantId) {
          setSelectedVariantId(v.id);
          setPriceOverride(null);
        }
      }
    }
  }, [selectedIntegration, product]);

  if (!product) {
    return (
      <div className="page">
        <div className="empty">Product not found.
          <a onClick={onBack} style={{ color: 'var(--color-primary-500)', cursor: 'pointer', marginLeft: 6 }}>Back to Products</a>
        </div>
      </div>
    );
  }

  const eff = effectiveStatus(product);
  const isListed = eff === 'LISTED';
  const model = (window.DEVICE_MODELS || []).find((m) => m.id === product.deviceModelId);
  // The spec axis used as the displayed variant picker — skip a leading
  // legacy "Integration mode" axis since that's now picked separately.
  const axis = (() => {
    const specs = product.specs || [];
    if (specs[0] && /^integration\s*mode$/i.test(specs[0].name)) return specs[1] || null;
    return specs[0] || null;
  })();
  const variant = product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
  const variantLabel = resolveVariantLabel(product, variant);
  const cat = CATEGORY_BADGE(product);
  const fulfill = fulfillmentOf(product);
  const effectivePrice = priceOverride != null ? priceOverride : (variant?.price || 0);

  // Build image gallery — variant image first if present, then product baseImage,
  // then variant images for other variants (preview), then model artwork as fallback.
  const gallery = [];
  if (variant && variant.image) gallery.push({ src: variant.image, label: 'variant', kind: 'img' });
  if (product.baseImage) gallery.push({ src: product.baseImage, label: 'base', kind: 'img' });
  product.variants.forEach((v) => {
    if (v.image && v.image !== variant?.image) gallery.push({ src: v.image, label: 'alt', kind: 'img' });
  });
  if (gallery.length === 0) {
    if (product.type === 'DEVICE' && model) gallery.push({ kind: 'model', model });
    else gallery.push({ kind: 'placeholder' });
  }
  const mainImg = gallery[Math.min(selectedImage, gallery.length - 1)] || gallery[0];

  const integrationOk = integrationModes.length === 0 || !!selectedIntegration;
  const canAdd = isListed && variant && variant.status === 'ACTIVE' && qty > 0 && integrationOk;

  const handleAdd = () => {
    if (!canAdd) return;
    // Pass overridden price + integration mode forward through a patched variant.
    const patched = priceOverride != null ? { ...variant, price: priceOverride } : variant;
    onAddToCart(product, patched, qty, { integrationMode: selectedIntegration });
    const bits = [variantLabel, selectedIntegration].filter(Boolean).join(' · ');
    toast({ kind: 'success', title: 'Added to cart', msg: `${product.name}${bits ? ' · ' + bits : ''} × ${qty}` });
    setQty(1);
  };

  return (
    <div className="page page--wide">
      <div className="pdp-back">
        <button type="button" className="pdp-back__btn" onClick={onBack}>
          <Icon name="chevL" size={14}/> Back to Products
        </button>
      </div>

      {!isListed && (
        <div className="prod-banner prod-banner--warn" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14}/>
          <span>
            This product is currently <strong>{eff}</strong> — not orderable. Visit{' '}
            <em>Catalog</em> to manage its status.
          </span>
        </div>
      )}

      <div className="pdp-main">
        {/* LEFT · Gallery */}
        <div className="pdp-gallery">
          <div className="pdp-gallery__main">
            {mainImg.kind === 'img' && <img src={mainImg.src} alt={product.name}/>}
            {mainImg.kind === 'model' && <ModelTile model={mainImg.model} px={320}/>}
            {mainImg.kind === 'placeholder' && (
              <div className="pdp-placeholder">📦</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="pdp-gallery__thumbs">
              {gallery.map((g, i) => (
                <button key={i} type="button"
                  className={`pdp-thumb ${i === selectedImage ? 'is-on' : ''}`}
                  onClick={() => setSelectedImage(i)}>
                  {g.kind === 'img' && <img src={g.src} alt=""/>}
                  {g.kind === 'model' && <ModelTile model={g.model} px={60}/>}
                  {g.kind === 'placeholder' && <div style={{ fontSize: 22 }}>📦</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT · Info + Buy box */}
        <div className="pdp-info">
          <div style={{ marginBottom: 10 }}>
            <Badge tone={cat.tone} dot>{cat.label}</Badge>
          </div>
          <h1 className="pdp-title">{product.name}</h1>
          {product.desc && <p className="pdp-desc">{product.desc}</p>}

          {model && (
            <div className="pdp-model-link" onClick={() => toast({ kind: 'info', title: 'Device model linked', msg: `${model.name} — see Specifications tab below.` })}>
              <Icon name="info" size={12}/>
              Linked device model: <strong>{model.name}</strong> · {model.family}
            </div>
          )}

          <div className="pdp-buy-box">
            {integrationModes.length > 0 && (
              <div className="pdp-variant-section">
                <div className="pdp-variant-label">
                  Integration mode:
                  {selectedIntegration && <strong> {selectedIntegration}</strong>}
                </div>
                <div className="pdp-variant-options">
                  {integrationModes.map((mode) => (
                    <button key={mode} type="button"
                      className={`pdp-variant-opt ${selectedIntegration === mode ? 'is-on' : ''}`}
                      onClick={() => setSelectedIntegration(mode)}>
                      <span className="pdp-variant-opt__lbl">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}


            {axis && product.variants.filter((v) => v.status === 'ACTIVE').length > 0 && (
              <div className="pdp-variant-section">
                <div className="pdp-variant-label">
                  Spec:
                  {variantLabel && <strong> {variantLabel}</strong>}
                </div>
                <div className="pdp-variant-options">
                  {product.variants.filter((v) => v.status === 'ACTIVE').map((v) => {
                    const lbl = resolveVariantLabel(product, v);
                    const on = v.id === selectedVariantId;
                    return (
                      <button key={v.id} type="button"
                        className={`pdp-variant-opt ${on ? 'is-on' : ''}`}
                        onClick={() => { setSelectedVariantId(v.id); setPriceOverride(null); }}>
                        <span className="pdp-variant-opt__lbl">{lbl || '—'}</span>
                        <span className="pdp-variant-opt__price num">${v.price.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pdp-price">
              {editingPrice && product.allowPriceOverride ? (
                <div className="pdp-price__edit">
                  <span className="pdp-price__currency">$</span>
                  <input className="pdp-price__input num"
                    type="number" step="0.01" min="0"
                    autoFocus
                    value={effectivePrice}
                    onChange={(e) => setPriceOverride(parseFloat(e.target.value) || 0)}
                    onBlur={() => setEditingPrice(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingPrice(false); }}/>
                  {priceOverride != null && priceOverride !== variant?.price && (
                    <button className="pdp-price__reset" onClick={() => { setPriceOverride(null); setEditingPrice(false); }}>Reset</button>
                  )}
                </div>
              ) : (
                <span className="pdp-price__val num"
                  title={product.allowPriceOverride ? 'Click to edit price' : ''}
                  onClick={() => product.allowPriceOverride && setEditingPrice(true)}
                  style={{ cursor: product.allowPriceOverride ? 'text' : 'default' }}>
                  ${effectivePrice.toFixed(2)}
                  {product.allowPriceOverride && (
                    <Icon name="edit" size={14} style={{ marginLeft: 8, verticalAlign: '-2px', color: 'var(--color-text-tertiary)' }}/>
                  )}
                </span>
              )}
              {priceOverride != null && priceOverride !== variant?.price && (
                <span className="pdp-price__hint">
                  Overridden · list price ${variant?.price.toFixed(2)}
                </span>
              )}
              {priceOverride == null && product.allowPriceOverride && (
                <span className="pdp-price__hint">Click price to override</span>
              )}
            </div>

            <div className="pdp-qty-row">
              <div className="pdp-qty">
                <button className="pdp-qty__btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
                  <Icon name="minus" size={13}/>
                </button>
                <input className="pdp-qty__input num" type="number" min="1" value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}/>
                <button className="pdp-qty__btn" onClick={() => setQty((q) => q + 1)} aria-label="Increase">
                  <Icon name="plus" size={13}/>
                </button>
              </div>
              <div className="pdp-line-total num">
                Line total <strong>${(effectivePrice * qty).toFixed(2)}</strong>
              </div>
            </div>

            <Btn variant="primary" size="lg" icon="check" onClick={handleAdd} disabled={!canAdd}
              style={{ width: '100%', justifyContent: 'center' }}>
              Add to cart
            </Btn>

            <div className="pdp-fulfill">
              <div className="pdp-fulfill__lbl">
                <Icon name="truck" size={12}/> Fulfillment
              </div>
              <div className="pdp-fulfill__txt">{FULFILL_LABEL[fulfill]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs below */}
      <div className="pdp-tabs">
        <div className="pdp-tabs__nav">
          {[
            ['description', 'Description'],
            ['specs', 'Specifications'],
            ['variants', 'All variants'],
          ].map(([id, label]) => (
            <button key={id} type="button"
              className={`pdp-tab ${tab === id ? 'is-on' : ''}`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="pdp-tabs__body">
          {tab === 'description' && (
            <div className="pdp-prose">
              {product.desc ? <p>{product.desc}</p> : <p className="muted">No description.</p>}
            </div>
          )}

          {tab === 'specs' && (
            <div className="pdp-specs">
              {model ? (
                <dl className="pdp-spec-list">
                  <dt>Device model</dt><dd>{model.name}</dd>
                  <dt>Family</dt><dd>{model.family}</dd>
                  <dt>OS</dt><dd>{model.os}</dd>
                  <dt>Orientation</dt><dd>{model.orientation}</dd>
                  <dt>Primary screen</dt><dd>{model.primary.size} · {model.primary.resolution}</dd>
                  {model.secondary && (
                    <>
                      <dt>Secondary screen</dt>
                      <dd>{model.secondary.size} · {model.secondary.resolution}</dd>
                    </>
                  )}
                  <dt>Fulfillment</dt><dd>{FULFILL_LABEL[fulfill]}</dd>
                </dl>
              ) : (
                <div className="muted">No specifications available — this product is not linked to a device model.</div>
              )}
            </div>
          )}

          {tab === 'variants' && (
            <div className="pdp-variants-tab">
              {product.variants.filter((v) => v.status === 'ACTIVE').length > 1 ? (
                <table className="pdp-var-table">
                  <thead>
                    <tr>
                      <th>Spec</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.filter((v) => v.status === 'ACTIVE').map((v) => {
                      const lbl = resolveVariantLabel(product, v);
                      const on = v.id === selectedVariantId;
                      return (
                        <tr key={v.id} className={on ? 'is-on' : ''}>
                          <td><strong>{lbl || '—'}</strong></td>
                          <td style={{ textAlign: 'right' }} className="num">${v.price.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Btn size="sm" variant={on ? 'primary' : 'ghost'}
                              onClick={() => { setSelectedVariantId(v.id); setPriceOverride(null); }}>
                              {on ? 'Selected' : 'Select'}
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="muted">Single variant priced at ${product.basePrice.toFixed(2)}.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const pdpStyles = `
.pdp-back { margin-bottom: 14px; }
.pdp-back__btn { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 0; color: var(--color-text-secondary); font-family: inherit; font-size: 13px; cursor: pointer; padding: 4px 0; }
.pdp-back__btn:hover { color: var(--color-text-primary); }

.pdp-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 32px; align-items: start; margin-bottom: 32px; }
@media (max-width: 880px) { .pdp-main { grid-template-columns: 1fr; } }

.pdp-gallery { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
.pdp-gallery__main { background: #fff; border: 1px solid var(--color-border-default); border-radius: 14px; padding: 32px; display: grid; place-items: center; min-height: 360px; aspect-ratio: 1; box-shadow: var(--shadow-1); }
.pdp-gallery__main img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pdp-placeholder { font-size: 140px; opacity: 0.4; }
.pdp-gallery__thumbs { display: flex; gap: 8px; }
.pdp-thumb { width: 64px; height: 64px; border: 1.5px solid var(--color-border-default); background: #fff; border-radius: 8px; display: grid; place-items: center; padding: 4px; cursor: pointer; overflow: hidden; transition: all var(--duration-fast); }
.pdp-thumb:hover { border-color: var(--color-border-strong); }
.pdp-thumb.is-on { border-color: var(--color-primary-700); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.12); }
.pdp-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }

.pdp-info { display: flex; flex-direction: column; gap: 12px; }
.pdp-title { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 0; line-height: 1.2; }
.pdp-sku { font: 500 12px var(--font-family-mono); color: var(--color-text-tertiary); }
.pdp-desc { font-size: 14px; color: var(--color-text-secondary); line-height: 1.55; margin: 0; }

.pdp-model-link { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; background: var(--color-info-50); color: var(--color-info-700); border-radius: 8px; font-size: 12px; cursor: pointer; align-self: flex-start; }
.pdp-model-link strong { font-weight: 600; }

.pdp-buy-box { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 14px; padding: 20px; box-shadow: var(--shadow-1); display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }

.pdp-price { display: flex; flex-direction: column; gap: 2px; }
.pdp-price__val { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; display: inline-flex; align-items: center; }
.pdp-price__hint { font-size: 11.5px; color: var(--color-text-tertiary); }
.pdp-price__edit { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1.5px solid var(--color-primary-700); border-radius: 10px; background: var(--color-bg-1); width: fit-content; }
.pdp-price__currency { font-size: 20px; color: var(--color-text-tertiary); }
.pdp-price__input { border: 0; outline: 0; background: transparent; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; width: 140px; font-family: inherit; color: var(--color-text-primary); }
.pdp-price__input::-webkit-inner-spin-button, .pdp-price__input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pdp-price__reset { font-size: 11.5px; background: transparent; border: 0; color: var(--color-primary-700); cursor: pointer; padding: 4px 8px; font-family: inherit; }
.pdp-price__reset:hover { text-decoration: underline; }

.pdp-variant-section { display: flex; flex-direction: column; gap: 8px; }
.pdp-variant-label { font-size: 13px; color: var(--color-text-secondary); }
.pdp-variant-label strong { color: var(--color-text-primary); font-weight: 600; }
.pdp-variant-options { display: flex; flex-wrap: wrap; gap: 8px; }
.pdp-variant-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 14px; background: var(--color-bg-1); border: 1.5px solid var(--color-border-default); border-radius: 10px; cursor: pointer; font-family: inherit; transition: all var(--duration-fast); min-width: 120px; text-align: left; }
.pdp-variant-opt:hover:not(:disabled) { border-color: var(--color-border-strong); }
.pdp-variant-opt.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.12); }
.pdp-variant-opt.is-unav { opacity: 0.5; cursor: not-allowed; background: var(--color-bg-3); }
.pdp-variant-opt__lbl { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.pdp-variant-opt__price { font-size: 12.5px; color: var(--color-text-secondary); }
.pdp-variant-opt__tag { font-size: 10.5px; color: var(--color-warning-700); margin-top: 2px; }

.pdp-qty-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.pdp-qty { display: inline-flex; align-items: center; background: var(--color-bg-1); border: 1.5px solid var(--color-border-default); border-radius: 10px; padding: 2px; }
.pdp-qty__btn { width: 36px; height: 36px; display: grid; place-items: center; border: 0; background: transparent; cursor: pointer; border-radius: 8px; color: var(--color-text-secondary); }
.pdp-qty__btn:hover { background: var(--color-bg-3); color: var(--color-text-primary); }
.pdp-qty__input { width: 56px; height: 36px; text-align: center; border: 0; background: transparent; font-size: 15px; font-weight: 500; color: var(--color-text-primary); font-variant-numeric: tabular-nums; outline: 0; font-family: inherit; }
.pdp-qty__input::-webkit-inner-spin-button, .pdp-qty__input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pdp-line-total { font-size: 13px; color: var(--color-text-secondary); }
.pdp-line-total strong { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin-left: 6px; }

.pdp-fulfill { padding: 12px 14px; background: var(--color-bg-3); border-radius: 10px; border: 1px solid var(--color-border-subtle); }
.pdp-fulfill__lbl { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 4px; }
.pdp-fulfill__txt { font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.5; }

.pdp-tabs { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-1); }
.pdp-tabs__nav { display: flex; gap: 0; padding: 0 16px; border-bottom: 1px solid var(--color-border-subtle); background: var(--color-bg-3); }
.pdp-tab { background: transparent; border: 0; padding: 14px 18px; font: 500 13px/1 inherit; color: var(--color-text-secondary); cursor: pointer; position: relative; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.pdp-tab:hover { color: var(--color-text-primary); }
.pdp-tab.is-on { color: var(--color-primary-700); border-bottom-color: var(--color-primary-700); font-weight: 600; }
.pdp-tabs__body { padding: 22px 24px; }
.pdp-prose p { margin: 0; line-height: 1.65; font-size: 13.5px; color: var(--color-text-primary); }
.pdp-spec-list { display: grid; grid-template-columns: 160px 1fr; gap: 8px 24px; margin: 0; font-size: 13px; }
.pdp-spec-list dt { color: var(--color-text-tertiary); font-weight: 500; }
.pdp-spec-list dd { color: var(--color-text-primary); margin: 0; }

.pdp-var-table { width: 100%; border-collapse: collapse; }
.pdp-var-table th { text-align: left; padding: 10px 12px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); border-bottom: 1px solid var(--color-border-default); }
.pdp-var-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border-subtle); font-size: 13px; }
.pdp-var-table tr.is-on td { background: var(--color-primary-50); }
.pdp-var-table tr:last-child td { border-bottom: 0; }
`;

if (typeof document !== 'undefined' && !document.getElementById('pdp-styles')) {
  const s = document.createElement('style');
  s.id = 'pdp-styles';
  s.textContent = pdpStyles;
  document.head.appendChild(s);
}

window.ProductDetail = ProductDetail;
