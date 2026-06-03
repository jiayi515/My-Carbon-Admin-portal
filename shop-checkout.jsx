/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, useToast,
   CompanyLogo, resolveLine, fulfillmentOf, emptyDevices, resolveVariantLabel */
const { useState, useMemo, useEffect } = React;

// ─── Checkout dialog ──────────────────────────────────────────
// Cart drawer's "Proceed to checkout" → opens this modal.
// Two steps in one panel:
//   1. Pick customer (search + list)
//   2. Confirm shipping address (auto-filled from customer's primary admin)
// Submit → builds an Order from cart lines + customer + shipping,
//          calls onCreateOrder, clears cart, navigates to OrderDetail.

const CheckoutModal = ({ open, onClose, lines, products, customers, onCreateOrder, onClearCart }) => {
  const [step, setStep] = useState('customer');   // 'customer' | 'shipping'
  const [customerId, setCustomerId] = useState(null);
  const [q, setQ] = useState('');
  const [shipping, setShipping] = useState({ name: '', address: '', method: 'Standard ground' });
  const [notes, setNotes] = useState('');
  const toast = useToast();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('customer');
      setCustomerId(null);
      setQ('');
      setShipping({ name: '', address: '', method: 'Standard ground' });
      setNotes('');
    }
  }, [open]);

  const customer = customers.find((c) => c.id === customerId);

  // Auto-fill shipping when customer changes
  useEffect(() => {
    if (!customer) return;
    const admin = (customer.operators || []).find((o) => o.role === 'Admin') || (customer.operators || [])[0];
    setShipping({
      name: admin?.name || '',
      address: customer.address || '',
      method: 'Standard ground',
    });
  }, [customerId]);

  // Resolved cart contents
  const items = useMemo(
    () => lines.map((l) => ({ line: l, ...resolveLine(l, products) })).filter((x) => x.product && x.variant),
    [lines, products]
  );
  const subtotal = items.reduce((s, { variant, line }) => {
    const unit = line.unitPriceOverride != null ? line.unitPriceOverride : variant.price;
    return s + unit * line.qty;
  }, 0);
  const fulfillCounts = items.reduce((acc, x) => {
    const k = fulfillmentOf(x.product);
    acc[k] = (acc[k] || 0) + x.line.qty;
    return acc;
  }, {});

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!q.trim()) return customers.slice(0, 30);
    const s = q.toLowerCase();
    return customers.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      (c.address || '').toLowerCase().includes(s)
    ).slice(0, 30);
  }, [customers, q]);

  if (!open) return null;

  const canContinue = !!customer;
  const canCreate = !!customer && shipping.name.trim() && shipping.address.trim();

  const handleCreate = () => {
    if (!canCreate) return;

    // Build OrderItems from cart
    const orderItems = items.map(({ line, product, variant }, idx) => {
      const variantLabel = resolveVariantLabel(product, variant) || null;
      const integrationMode = line.integrationMode || null;
      const unitPrice = line.unitPriceOverride != null ? line.unitPriceOverride : variant.price;
      const typeLabel = [integrationMode, variantLabel].filter(Boolean).join(' · ') || 'Stand-alone';
      return {
        id: 'li-' + (idx + 1),
        // Snapshot product & variant info
        productId: product.id,
        productNameSnapshot: product.name,
        variantId: variant.id,
        variantLabelSnapshot: variantLabel,
        integrationModeSnapshot: integrationMode,
        productType: product.type,
        deviceVariant: product.deviceVariant,
        // OrderItem (legacy) fields (so existing OrderDetail still renders)
        modelId: product.deviceModelId || `non-device-${product.id}`,
        modelName: product.name + (variantLabel ? ` · ${variantLabel}` : '') + (integrationMode ? ` · ${integrationMode}` : ''),
        unitPrice,
        qty: line.qty,
        type: typeLabel,
        devices: product.type === 'DEVICE' ? (window.emptyDevices ? window.emptyDevices(line.qty) : []) : [],
      };
    });

    const now = new Date();
    const num = `SO-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const order = {
      id: 'o-' + Math.random().toString(36).slice(2, 9),
      number: num,
      customerId: customer.id,
      customerName: customer.name,
      createdAt: now.toISOString(),
      createdBy: 'sarah@npt',
      status: 'Awaiting payment',
      items: orderItems,
      discountPct: 0,
      notes,
      shipping: { ...shipping },
      events: [
        { at: now.toISOString(), kind: 'created', by: 'sarah@npt', text: `Order created from cart · ${items.length} line items` },
      ],
    };

    onCreateOrder(order);
    onClearCart();
    toast({ kind: 'success', title: 'Order created', msg: num });
    onClose();
  };

  return (
    <>
      <div className="ck-backdrop" onClick={onClose}/>
      <div className="ck-modal">
        <div className="ck-modal__head">
          <div>
            <div className="ck-modal__title">Checkout</div>
            <div className="ck-modal__sub">
              {items.length} {items.length === 1 ? 'item' : 'items'} · Subtotal ${subtotal.toFixed(2)}
            </div>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <div className="ck-stepper">
          <div className={`ck-step ${step === 'customer' ? 'is-on' : ''} ${customer ? 'is-done' : ''}`}>
            <span className="ck-step__dot">{customer ? <Icon name="check" size={12}/> : '1'}</span>
            <span>Customer</span>
          </div>
          <div className="ck-step__bar"/>
          <div className={`ck-step ${step === 'shipping' ? 'is-on' : ''}`}>
            <span className="ck-step__dot">2</span>
            <span>Shipping & review</span>
          </div>
        </div>

        <div className="ck-modal__body">
          {step === 'customer' ? (
            <>
              <Field label="Customer" required>
                <Input prefix={<Icon name="search" size={14}/>}
                  placeholder="Search customers…" value={q}
                  onChange={(e) => setQ(e.target.value)} size="md"/>
              </Field>
              <div className="ck-cust-list">
                {filteredCustomers.length === 0 && (
                  <div className="empty" style={{ padding: 24 }}>No customers match.</div>
                )}
                {filteredCustomers.map((c) => (
                  <button key={c.id} type="button"
                    className={`ck-cust-row ${customerId === c.id ? 'is-on' : ''}`}
                    onClick={() => setCustomerId(c.id)}>
                    {window.CompanyLogo
                      ? <CompanyLogo name={c.name} size={32}/>
                      : <div className="ck-cust-row__logo">{c.name.charAt(0)}</div>}
                    <div className="ck-cust-row__main">
                      <div className="ck-cust-row__name">{c.name}</div>
                      <div className="ck-cust-row__addr">{c.address || '—'}</div>
                    </div>
                    {customerId === c.id && (
                      <Icon name="check" size={16} style={{ color: 'var(--color-primary-700)' }}/>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ck-customer-confirm">
                {window.CompanyLogo
                  ? <CompanyLogo name={customer.name} size={32}/>
                  : <div className="ck-cust-row__logo">{customer.name.charAt(0)}</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{customer.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{customer.address}</div>
                </div>
                <button type="button" className="ck-edit-btn" onClick={() => setStep('customer')}>Change</button>
              </div>

              <div className="form-grid form-grid--2" style={{ marginTop: 14 }}>
                <Field label="Recipient" required>
                  <Input value={shipping.name} onChange={(e) => setShipping((s) => ({ ...s, name: e.target.value }))}/>
                </Field>
                <Field label="Shipping method">
                  <Select value={shipping.method} onChange={(e) => setShipping((s) => ({ ...s, method: e.target.value }))}>
                    <option>Standard ground</option>
                    <option>Express overnight</option>
                    <option>International express</option>
                    <option>Freight</option>
                    <option>Customer pickup</option>
                  </Select>
                </Field>
              </div>
              <Field label="Shipping address" required>
                <Textarea rows={2} value={shipping.address}
                  onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}/>
              </Field>
              <Field label="Order notes" hint="Optional. Visible on the order detail.">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes for this order…"/>
              </Field>

              <div className="ck-summary">
                <div className="ck-summary__head">
                  <span>Order summary</span>
                  <span className="num">${subtotal.toFixed(2)}</span>
                </div>
                <ul className="ck-summary__list">
                  {items.map(({ line, product, variant }) => {
                    const vlabel = resolveVariantLabel(product, variant);
                    const im = line.integrationMode;
                    const unit = line.unitPriceOverride != null ? line.unitPriceOverride : variant.price;
                    const bits = [vlabel, im].filter(Boolean).join(' · ');
                    return (
                      <li key={line.productId + '-' + line.variantId}>
                        <span>{product.name}{bits ? ` · ${bits}` : ''} × {line.qty}</span>
                        <span className="num">${(unit * line.qty).toFixed(2)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="ck-fulfill-preview">
                  <div className="ck-fulfill-preview__lbl">Fulfillment routes</div>
                  {fulfillCounts.SAMPLE && <div>· {fulfillCounts.SAMPLE}× Sample → 6-digit activation code</div>}
                  {fulfillCounts.PRODUCTION && <div>· {fulfillCounts.PRODUCTION}× Production → SN/IMEI + Fleet enrollment</div>}
                  {fulfillCounts.OTHER && <div>· {fulfillCounts.OTHER}× Other → shipping only</div>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="ck-modal__foot">
          <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
          {step === 'customer' ? (
            <Btn variant="primary" size="md" disabled={!canContinue}
              onClick={() => setStep('shipping')}>Continue →</Btn>
          ) : (
            <>
              <Btn variant="secondary" size="md" onClick={() => setStep('customer')}>← Back</Btn>
              <Btn variant="primary" size="md" icon="check" disabled={!canCreate}
                onClick={handleCreate}>Create order</Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const checkoutStyles = `
.ck-backdrop { position: fixed; inset: 0; background: oklch(0% 0 0 / 0.4); z-index: 9100; animation: cartFade 160ms ease; }
.ck-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(640px, 94vw); max-height: 90vh; background: var(--color-bg-1); border: 1px solid var(--color-border-default); border-radius: 14px; box-shadow: 0 24px 80px oklch(0% 0 0 / 0.3); z-index: 9101; display: flex; flex-direction: column; overflow: hidden; animation: ckPop 200ms ease; }
@keyframes ckPop { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }

.ck-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--color-border-default); flex: none; }
.ck-modal__title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.ck-modal__sub { font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px; }

.ck-stepper { display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: var(--color-bg-3); border-bottom: 1px solid var(--color-border-subtle); }
.ck-step { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--color-text-tertiary); font-weight: 500; }
.ck-step.is-on { color: var(--color-text-primary); font-weight: 600; }
.ck-step.is-done { color: var(--color-success-700); }
.ck-step__dot { width: 22px; height: 22px; border-radius: 50%; background: var(--color-bg-2); border: 1px solid var(--color-border-default); display: grid; place-items: center; font-size: 11px; font-weight: 600; }
.ck-step.is-on .ck-step__dot { background: var(--color-primary-700); color: #fff; border-color: var(--color-primary-700); }
.ck-step.is-done .ck-step__dot { background: var(--color-success-50); color: var(--color-success-700); border-color: oklch(58% 0.14 152 / 0.3); }
.ck-step__bar { flex: 1; height: 1px; background: var(--color-border-default); }

.ck-modal__body { flex: 1; overflow: auto; padding: 18px 20px; }

.ck-cust-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow: auto; margin-top: 6px; border: 1px solid var(--color-border-default); border-radius: 10px; padding: 4px; }
.ck-cust-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: transparent; border: 0; border-radius: 7px; cursor: pointer; text-align: left; font-family: inherit; transition: background var(--duration-fast); }
.ck-cust-row:hover { background: var(--color-bg-hover); }
.ck-cust-row.is-on { background: var(--color-primary-50); }
.ck-cust-row__logo { width: 32px; height: 32px; border-radius: 8px; background: var(--color-primary-700); color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 13px; flex: none; }
.ck-cust-row__main { flex: 1; min-width: 0; }
.ck-cust-row__name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ck-cust-row__addr { font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ck-customer-confirm { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--color-bg-3); border-radius: 10px; }
.ck-edit-btn { background: transparent; border: 0; color: var(--color-primary-700); font-family: inherit; font-size: 12px; cursor: pointer; padding: 4px 8px; }
.ck-edit-btn:hover { text-decoration: underline; }

.ck-summary { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 12px 14px; margin-top: 18px; }
.ck-summary__head { display: flex; align-items: baseline; justify-content: space-between; font-size: 12.5px; font-weight: 600; color: var(--color-text-primary); }
.ck-summary__list { margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px; color: var(--color-text-secondary); }
.ck-summary__list li { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 3px 0; }
.ck-fulfill-preview { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--color-border-subtle); font-size: 11.5px; color: var(--color-text-secondary); line-height: 1.6; }
.ck-fulfill-preview__lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 4px; }

.ck-modal__foot { padding: 14px 20px; border-top: 1px solid var(--color-border-default); display: flex; justify-content: flex-end; gap: 8px; flex: none; background: var(--color-bg-2); }
`;

if (typeof document !== 'undefined' && !document.getElementById('checkout-styles')) {
  const s = document.createElement('style');
  s.id = 'checkout-styles';
  s.textContent = checkoutStyles;
  document.head.appendChild(s);
}

window.CheckoutModal = CheckoutModal;
