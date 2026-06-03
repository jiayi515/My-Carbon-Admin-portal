/* global React, DEVICE_MODELS */
// ─── Commerce · Products data layer ─────────────────────────────
// Single-axis variant model: a Product may have 0 OR 1 spec axis. When the
// axis is present, the product carries N variants (one per axis value),
// each with its own price, SKU, image override and ACTIVE/UNAVAILABLE status.
// 0-axis products carry a single BASE variant priced at `basePrice`.

const SPEC_PRESETS = [
  { name: 'Integration mode', values: ['Semi-integration', 'Stand-alone'] },
  { name: 'Color',            values: ['Black', 'White', 'Silver'] },
  { name: 'Pack size',        values: ['10 rolls', '50 rolls', '200 rolls'] },
  { name: 'Service duration', values: ['Half day', 'Full day', '2 days'] },
  { name: 'Connectivity',     values: ['WiFi', 'WiFi + 4G'] },
  { name: 'Storage',          values: ['32GB', '64GB', '128GB'] },
];

// ─── Device product constants (new product form) ────────────────
// Allowed device model ids for the New product form selector.
const DEVICE_MODEL_IDS_ALLOWED = ['m-n950', 'm-s90', 'm-s30', 'm-x800', 'm-n750'];

// Integration modes that a Device product can advertise. Sales pick one
// at View options time; it is NOT a variant axis (it doesn't multiply price).
const INTEGRATION_MODE_OPTIONS = ['Semi-integration', 'Stand-alone'];

// Device variant nature (sample vs production deployment).
const DEVICE_NATURE_OPTIONS = [
  { id: 'SAMPLE',     label: 'Sample',     hint: '6-digit activation code · 5-min validity' },
  { id: 'PRODUCTION', label: 'Production', hint: 'SN/IMEI · Enrolled into Devices Fleet' },
];

// Spec axes the New product form offers as opt-in checkboxes.
const NETWORK_AXIS = { key: 'network', name: 'Network',  values: ['WIFI', '4G'] };
const STORAGE_AXIS = { key: 'storage', name: 'Storage',  values: ['8G', '16G', '32G'] };
const DEVICE_SPEC_AXES = [NETWORK_AXIS, STORAGE_AXIS];

// Stock helpers — stock can be a non-negative integer OR null (always available).
const isInfiniteStock = (s) => s == null;
const formatStock = (s) => isInfiniteStock(s) ? '∞' : String(s);

// ─── ID helpers ─────────────────────────────────────────────────
const newAxisId    = () => 'sa-' + Math.random().toString(36).slice(2, 7);
const newValueId   = () => 'sv-' + Math.random().toString(36).slice(2, 7);
const newVariantId = () => 'v-'  + Math.random().toString(36).slice(2, 7);
const newProductId = () => 'p-'  + Math.random().toString(36).slice(2, 7);

// ─── Builders ───────────────────────────────────────────────────
const buildAxis = (name, valueLabels) => ({
  id: newAxisId(),
  name,
  values: valueLabels.map((label) => ({ id: newValueId(), label })),
});

const buildVariants = (productId, axis, basePrice, overridesByLabel = {}) => {
  if (!axis) {
    return [{
      id: newVariantId(), productId,
      sku: 'BASE', combination: {},
      label: '',
      price: basePrice, image: null,
      status: 'ACTIVE', stockNote: '', stock: null,
    }];
  }
  return axis.values.map((val) => {
    const ovr = overridesByLabel[val.label] || {};
    return {
      id: newVariantId(), productId,
      sku: ovr.sku || 'AUTO',
      combination: { [axis.id]: val.id },
      label: ovr.label || val.label,
      price: ovr.price != null ? ovr.price : basePrice,
      image: ovr.image || null,
      status: ovr.status || 'ACTIVE',
      stockNote: ovr.stockNote || '',
      stock: ovr.stock !== undefined ? ovr.stock : null,
    };
  });
};

// Cartesian product of multiple axes — used by the New product form when the
// user opts into both Network + Storage (or just one of them).
const buildGridVariants = (productId, axes, basePrice) => {
  if (!axes || !axes.length) {
    return [{
      id: newVariantId(), productId, sku: 'BASE', combination: {},
      label: '', price: basePrice, image: null,
      status: 'ACTIVE', stockNote: '', stock: null,
    }];
  }
  // Cartesian product
  const combos = axes.reduce((acc, axis) => {
    const next = [];
    acc.forEach((partial) => {
      axis.values.forEach((val) => {
        next.push([...partial, { axis, val }]);
      });
    });
    return next;
  }, [[]]);
  return combos.map((cells) => ({
    id: newVariantId(), productId, sku: 'AUTO',
    combination: cells.reduce((c, { axis, val }) => ({ ...c, [axis.id]: val.id }), {}),
    label: cells.map((c) => c.val.label).join(' + '),
    price: basePrice, image: null,
    status: 'ACTIVE', stockNote: '', stock: null,
  }));
};

// ─── Seed (12 products covering all 3 categories × all lifecycle states) ──
const _seedProducts = () => {
  const out = [];
  const ts = (d) => new Date(d).toISOString();
  const push = (p) => { out.push(p); return p; };

  // 1. N950 Sample · LISTED · Integration axis
  {
    const id = 'p-001';
    const axis = buildAxis('Integration mode', ['Semi-integration', 'Stand-alone']);
    push({
      id, name: 'N950 Sample',
      type: 'DEVICE', deviceModelId: 'm-n950', deviceVariant: 'SAMPLE',
      sku: 'PRD-N950-S',
      desc: 'Smart Android terminal (sample). 5.5" touch, NFC + magstripe. Each unit ships with a 6-digit activation code.',
      baseImage: null, basePrice: 459, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 459, {
        'Semi-integration': { price: 459 },
        'Stand-alone':      { price: 439 },
      }),
      status: 'LISTED',  listFrom: ts('2026-04-01'),
      createdAt: ts('2026-03-28'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-01'), updatedBy: 'sarah@npt',
    });
  }

  // 2. N950 Production · LISTED · Connectivity axis
  {
    const id = 'p-002';
    const axis = buildAxis('Connectivity', ['WiFi', 'WiFi + 4G']);
    push({
      id, name: 'N950 Production',
      type: 'DEVICE', deviceModelId: 'm-n950', deviceVariant: 'PRODUCTION',
      sku: 'PRD-N950-P',
      desc: 'Smart Android terminal for production deployment. Full SN + IMEI tracking, auto-enrolled into Devices Fleet on activation.',
      baseImage: null, basePrice: 379, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 379, {
        'WiFi':       { price: 379 },
        'WiFi + 4G':  { price: 419 },
      }),
      status: 'LISTED', listFrom: ts('2026-04-01'),
      createdAt: ts('2026-03-28'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-01'), updatedBy: 'sarah@npt',
    });
  }

  // 3. S90 Sample · LISTED · Integration
  {
    const id = 'p-003';
    const axis = buildAxis('Integration mode', ['Semi-integration', 'Stand-alone']);
    push({
      id, name: 'S90 Sample',
      type: 'DEVICE', deviceModelId: 'm-s90', deviceVariant: 'SAMPLE',
      sku: 'PRD-S90-S',
      desc: 'Portable wireless terminal (sample). 4G + Wi-Fi + Bluetooth.',
      baseImage: null, basePrice: 389, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 389),
      status: 'LISTED', listFrom: ts('2026-04-05'),
      createdAt: ts('2026-04-05'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-05'), updatedBy: 'sarah@npt',
    });
  }

  // 4. S90 Production · LISTED
  {
    const id = 'p-004';
    const axis = buildAxis('Integration mode', ['Semi-integration', 'Stand-alone']);
    push({
      id, name: 'S90 Production',
      type: 'DEVICE', deviceModelId: 'm-s90', deviceVariant: 'PRODUCTION',
      sku: 'PRD-S90-P',
      desc: 'Portable wireless terminal for production deployment.',
      baseImage: null, basePrice: 329, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 329, {
        'Semi-integration': { price: 329 },
        'Stand-alone':      { price: 339, stockNote: 'Limited stock' },
      }),
      status: 'LISTED', listFrom: ts('2026-04-05'),
      createdAt: ts('2026-04-05'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-05'), updatedBy: 'sarah@npt',
    });
  }

  // 5. X800 Kiosk · LISTED · no axis
  {
    const id = 'p-005';
    push({
      id, name: 'X800 Kiosk Module',
      type: 'DEVICE', deviceModelId: 'm-x800', deviceVariant: 'PRODUCTION',
      sku: 'PRD-X800',
      desc: 'Unattended kiosk module, QR + NFC, IP54 sealed. Single configuration.',
      baseImage: null, basePrice: 1180, allowPriceOverride: true,
      specs: [],
      variants: buildVariants(id, null, 1180),
      status: 'LISTED', listFrom: ts('2026-04-10'),
      createdAt: ts('2026-04-10'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-10'), updatedBy: 'sarah@npt',
    });
  }

  // 6. Thermal receipt paper · LISTED · Pack size axis (OTHER)
  {
    const id = 'p-006';
    const axis = buildAxis('Pack size', ['10 rolls', '50 rolls', '200 rolls']);
    push({
      id, name: 'Thermal receipt paper',
      type: 'OTHER',
      sku: 'PRD-PAPER',
      desc: 'Thermal receipt paper rolls, 80mm × 80m. Bulk discount on larger packs.',
      baseImage: null, basePrice: 12, allowPriceOverride: false,
      specs: [axis],
      variants: buildVariants(id, axis, 12, {
        '10 rolls':  { price: 12 },
        '50 rolls':  { price: 55 },
        '200 rolls': { price: 200 },
      }),
      status: 'LISTED', listFrom: ts('2026-04-12'),
      createdAt: ts('2026-04-12'), createdBy: 'ops@npt',
      updatedAt: ts('2026-04-12'), updatedBy: 'ops@npt',
    });
  }

  // 7. USB-C cable · LISTED · no axis (OTHER)
  {
    const id = 'p-007';
    push({
      id, name: 'USB-C cable 1m',
      type: 'OTHER',
      sku: 'PRD-USBC1M',
      desc: 'Replacement USB-C charging cable, 1 meter, braided.',
      baseImage: null, basePrice: 9, allowPriceOverride: false,
      specs: [],
      variants: buildVariants(id, null, 9),
      status: 'LISTED', listFrom: ts('2026-04-12'),
      createdAt: ts('2026-04-12'), createdBy: 'ops@npt',
      updatedAt: ts('2026-04-12'), updatedBy: 'ops@npt',
    });
  }

  // 8. On-site setup · LISTED · Service duration axis (OTHER)
  {
    const id = 'p-008';
    const axis = buildAxis('Service duration', ['Half day', 'Full day', '2 days']);
    push({
      id, name: 'On-site setup service',
      type: 'OTHER',
      sku: 'PRD-SVC-SETUP',
      desc: 'Engineer on-site visit for device deployment and operator training.',
      baseImage: null, basePrice: 300, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 300, {
        'Half day': { price: 300 },
        'Full day': { price: 550 },
        '2 days':   { price: 1000 },
      }),
      status: 'LISTED', listFrom: ts('2026-04-15'),
      createdAt: ts('2026-04-15'), createdBy: 'ops@npt',
      updatedAt: ts('2026-04-15'), updatedBy: 'ops@npt',
    });
  }

  // 9. N1000 Sample · SCHEDULED — DRAFT + future publishAt
  {
    const id = 'p-009';
    const axis = buildAxis('Integration mode', ['Semi-integration', 'Stand-alone']);
    push({
      id, name: 'N1000 Sample',
      type: 'DEVICE', deviceModelId: 'm-n950', deviceVariant: 'SAMPLE',
      sku: 'PRD-N1000-S',
      desc: 'Next-gen Smart Android terminal (sample). Launches with the May product release.',
      baseImage: null, basePrice: 599, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 599),
      status: 'DRAFT',
      publishAt: ts(new Date(Date.now() + 5 * 86400000)),  // 5 days from now
      createdAt: ts('2026-05-20'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-05-22'), updatedBy: 'sarah@npt',
    });
  }

  // 10. S60 Production · DELISTED (out of stock)
  {
    const id = 'p-010';
    const axis = buildAxis('Integration mode', ['Semi-integration', 'Stand-alone']);
    push({
      id, name: 'S60 Production',
      type: 'DEVICE', deviceModelId: 'm-s60', deviceVariant: 'PRODUCTION',
      sku: 'PRD-S60-P',
      desc: 'Dual-screen smart POS, built-in thermal printer.',
      baseImage: null, basePrice: 689, allowPriceOverride: true,
      specs: [axis],
      variants: buildVariants(id, axis, 689),
      status: 'DELISTED',
      delistReason: 'Out of stock, expected back late June',
      delistedAt: ts('2026-05-10'),
      listFrom:  ts('2026-03-01'),
      createdAt: ts('2026-02-28'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-05-10'), updatedBy: 'ops@npt',
    });
  }

  // 11. S30 Production · ARCHIVED (discontinued)
  {
    const id = 'p-011';
    push({
      id, name: 'S30 Production',
      type: 'DEVICE', deviceModelId: 'm-s30', deviceVariant: 'PRODUCTION',
      sku: 'PRD-S30-P',
      desc: 'Compact countertop terminal. End-of-life model — kept for historical orders only.',
      baseImage: null, basePrice: 269, allowPriceOverride: true,
      specs: [],
      variants: buildVariants(id, null, 269),
      status: 'ARCHIVED',
      archivedAt: ts('2026-04-30'),
      listFrom:  ts('2025-01-01'),
      createdAt: ts('2025-01-01'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-04-30'), updatedBy: 'sarah@npt',
    });
  }

  // 12. Card reader sleeve · DRAFT (no schedule yet)
  {
    const id = 'p-012';
    push({
      id, name: 'Card reader sleeve',
      type: 'OTHER',
      sku: '',
      desc: '(Draft) Protective sleeve for handheld card readers — pending vendor sample approval.',
      baseImage: null, basePrice: 25, allowPriceOverride: false,
      specs: [],
      variants: buildVariants(id, null, 25),
      status: 'DRAFT',
      createdAt: ts('2026-05-25'), createdBy: 'sarah@npt',
      updatedAt: ts('2026-05-25'), updatedBy: 'sarah@npt',
    });
  }

  return out;
};

const SEED_PRODUCTS = _seedProducts();

// ─── Derived status (派生态) ─────────────────────────────────────
const effectiveStatus = (p, now = new Date()) => {
  if (!p) return null;
  if (p.status === 'ARCHIVED') return 'ARCHIVED';
  if (p.status === 'DELISTED') return 'DELISTED';
  if (p.status === 'DRAFT' && p.publishAt && new Date(p.publishAt) > now) return 'SCHEDULED';
  if (p.status === 'DRAFT') return 'DRAFT';
  if (p.status === 'LISTED' && p.listTo && new Date(p.listTo) < now) return 'EXPIRED';
  return 'LISTED';
};

const PRODUCT_STATUS_TONE = {
  DRAFT: 'neutral', SCHEDULED: 'info', LISTED: 'success',
  EXPIRED: 'warning', DELISTED: 'warning', ARCHIVED: 'neutral',
};
const PRODUCT_STATUS_LABEL = {
  DRAFT: 'Draft', SCHEDULED: 'Scheduled', LISTED: 'Listed',
  EXPIRED: 'Expired', DELISTED: 'Delisted', ARCHIVED: 'Archived',
};

const CATEGORY_BADGE = (p) => {
  if (!p) return { label: 'Unknown', tone: 'neutral' };
  if (p.type === 'OTHER') return { label: 'Other', tone: 'neutral' };
  if (p.deviceVariant === 'SAMPLE')     return { label: 'Device · Sample', tone: 'accent' };
  if (p.deviceVariant === 'PRODUCTION') return { label: 'Device · Prod',   tone: 'success' };
  return { label: 'Device', tone: 'info' };
};

// price range / variants summary
const productPriceRange = (p) => {
  if (!p.variants || !p.variants.length) {
    return { min: p.basePrice || 0, max: p.basePrice || 0 };
  }
  const prices = p.variants.filter((v) => v.status === 'ACTIVE').map((v) => v.price);
  if (!prices.length) return { min: p.basePrice, max: p.basePrice };
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

const formatPriceRange = (p) => {
  const { min, max } = productPriceRange(p);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
};

const variantsSummary = (p) => {
  if (!p.specs || !p.specs.length) return '—';
  const active = p.variants.filter((v) => v.status === 'ACTIVE').length;
  const total = p.variants.length;
  return active === total
    ? `${total} variants · ${p.specs[0].name}`
    : `${active}/${total} active · ${p.specs[0].name}`;
};

// ─── Integration mode resolution ────────────────────────────────
// A product can advertise integration modes either via the new
// `integrationModes` array OR a legacy `specs[0]` whose name reads
// "Integration mode". The View-options page reads through this helper.
const productIntegrationModes = (p) => {
  if (!p) return [];
  if (Array.isArray(p.integrationModes) && p.integrationModes.length) return p.integrationModes;
  const axis = p.specs && p.specs[0];
  if (axis && /^integration\s*mode$/i.test(axis.name)) {
    return axis.values.map((v) => v.label);
  }
  return [];
};

// Friendly variant label for cart / checkout / PDP. Falls back to assembling
// from spec-axis combination if no custom label is stored.
const resolveVariantLabel = (product, variant) => {
  if (!product || !variant) return '';
  if (variant.label) return variant.label;
  if (!product.specs || !product.specs.length) return '';
  return product.specs
    .map((axis) => axis.values.find((v) => v.id === variant.combination?.[axis.id])?.label)
    .filter(Boolean)
    .join(' + ');
};

// blank template for "New product"
const blankProduct = () => {
  const id = newProductId();
  return {
    id, name: '',
    type: 'DEVICE',
    deviceModelId: (window.DEVICE_MODELS || []).find((m) => DEVICE_MODEL_IDS_ALLOWED.includes(m.id))?.id || null,
    deviceVariant: 'PRODUCTION',
    integrationModes: ['Semi-integration', 'Stand-alone'],
    sku: '',
    desc: '',
    baseImage: null, basePrice: 0, allowPriceOverride: true,
    specs: [],
    variants: buildVariants(id, null, 0),
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    createdBy: 'sarah@npt',
    updatedAt: new Date().toISOString(),
    updatedBy: 'sarah@npt',
  };
};

Object.assign(window, {
  SEED_PRODUCTS, SPEC_PRESETS,
  DEVICE_MODEL_IDS_ALLOWED, INTEGRATION_MODE_OPTIONS, DEVICE_NATURE_OPTIONS,
  NETWORK_AXIS, STORAGE_AXIS, DEVICE_SPEC_AXES,
  isInfiniteStock, formatStock,
  effectiveStatus, PRODUCT_STATUS_TONE, PRODUCT_STATUS_LABEL,
  CATEGORY_BADGE, productPriceRange, formatPriceRange, variantsSummary,
  productIntegrationModes, resolveVariantLabel,
  newAxisId, newValueId, newVariantId, newProductId,
  buildAxis, buildVariants, buildGridVariants, blankProduct,
});
