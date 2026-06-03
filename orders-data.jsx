/* global React */
// ─── Device model catalog ─────────────────────────────────
// Generic sample POS / payment device lineup.
const DEVICE_MODELS = [
  {
    id: 'm-n950',
    name: 'N950',
    family: 'Smart Android',
    desc: 'Smart Android terminal, 5.5" touch, NFC + magstripe.',
    unitPrice: 459,
    types: ['Semi-integration', 'Stand-alone'],
    image: null,
  },
  {
    id: 'm-s30',
    name: 'S30',
    family: 'Countertop',
    desc: 'Compact countertop terminal, Ethernet + dial-up.',
    unitPrice: 269,
    types: ['Semi-integration', 'Stand-alone'],
    image: null,
  },
  {
    id: 'm-s60',
    name: 'S60',
    family: 'Smart POS',
    desc: 'Dual-screen smart POS, built-in thermal printer.',
    unitPrice: 689,
    types: ['Semi-integration', 'Stand-alone'],
    image: null,
  },
  {
    id: 'm-s90',
    name: 'S90',
    family: 'Portable',
    desc: 'Portable wireless terminal, 4G + Wi-Fi + Bluetooth.',
    unitPrice: 389,
    types: ['Semi-integration', 'Stand-alone'],
    image: null,
  },
  {
    id: 'm-n750',
    name: 'N750',
    family: 'Mobile',
    desc: 'Slim mobile Android handheld, 4G + NFC.',
    unitPrice: 319,
    types: ['Semi-integration', 'Stand-alone'],
    image: null,
  },
  {
    id: 'm-x800',
    name: 'X800',
    family: 'Kiosk',
    desc: 'Unattended kiosk module, QR + NFC, IP54 sealed.',
    unitPrice: 1180,
    types: ['Semi-integration'],
    image: null,
  },
];

const ORDER_STATUSES = ['Awaiting payment', 'Awaiting shipment', 'Shipped', 'Partially complete', 'Complete'];

const ORDER_STATUS_TONE = {
  'Awaiting payment':  'warning',
  'Awaiting shipment': 'info',
  'Shipped':           'accent',
  'Partially complete': 'info',
  'Complete':          'success',
  'Cancelled':         'neutral',
};

// Helper — pad SN and generate a single 6-digit activation code
const fakeSN = (prefix, n) => `${prefix}-${String(n).padStart(8, '0')}`;
const fakeAC = () => String(Math.floor(100000 + Math.random() * 900000));

// Each device shows ONE 6-digit activation code on boot, recorded against its SN.
const makeDevice = (sn = '', code = '', type = '') => ({ sn, code, type });

// Build empty devices for a given quantity
const emptyDevices = (_qty) => [];

// Demo populated devices (all entered)
const populatedDevices = (qty, prefix, start = 1) =>
  Array.from({ length: qty }, (_, i) => makeDevice(
    fakeSN(prefix, start + i),
    fakeAC()
  ));

// ─── Seed orders ──────────────────────────────────────────
const SEED_ORDERS = [
  // 1) Awaiting payment — has discount but still non-zero
  {
    id: 'o-2026-0184',
    number: 'SO-2026-0184',
    customerId: 'c-001',
    customerName: 'Northwind Commerce',
    createdAt: '2026-05-09T14:22:00Z',
    createdBy: 'jordan.d@carbon',
    status: 'Awaiting payment',
    items: [
      { id: 'li-1', modelId: 'm-n950', modelName: 'N950', unitPrice: 459, qty: 12, type: 'Semi-integration', devices: emptyDevices(12) },
      { id: 'li-2', modelId: 'm-s30',  modelName: 'S30',  unitPrice: 269, qty: 8, type: 'Stand-alone', devices: emptyDevices(8) },
    ],
    discountPct: 5,
    notes: 'Quarterly refresh batch. Net-30 invoicing.',
    shipping: { name: 'Sarah Chen', address: '1455 Market St, Suite 600, San Francisco, CA 94103', method: 'Standard ground' },
    events: [
      { at: '2026-05-09T14:22:00Z', kind: 'created',  by: 'jordan.d@carbon', text: 'Order created' },
      { at: '2026-05-09T14:25:00Z', kind: 'invoice',  by: 'system',          text: 'Invoice INV-26-1842 issued' },
    ],
  },

  // 2) Awaiting shipment — no payment needed (fully discounted)
  {
    id: 'o-2026-0181',
    number: 'SO-2026-0181',
    customerId: 'c-002',
    customerName: 'Helios Payments',
    createdAt: '2026-05-07T11:08:00Z',
    createdBy: 'jordan.d@carbon',
    status: 'Awaiting shipment',
    items: [
      { id: 'li-1', modelId: 'm-n750', modelName: 'N750', unitPrice: 319, qty: 4, type: 'Stand-alone',     devices: emptyDevices(4) },
      { id: 'li-2', modelId: 'm-s60',  modelName: 'S60',  unitPrice: 689, qty: 2, type: 'Semi-integration', devices: emptyDevices(2) },
    ],
    discountPct: 100,
    notes: 'Sample units for evaluation — no charge.',
    shipping: { name: 'Elena Rossi', address: '200 W Madison St, Floor 24, Chicago, IL 60606', method: 'Express overnight' },
    events: [
      { at: '2026-05-07T11:08:00Z', kind: 'created', by: 'jordan.d@carbon', text: 'Order created' },
      { at: '2026-05-07T11:09:00Z', kind: 'free',    by: 'jordan.d@carbon', text: 'Marked as complimentary · 100% discount' },
    ],
  },

  // 3) Awaiting shipment — paid + activation codes partially entered
  {
    id: 'o-2026-0177',
    number: 'SO-2026-0177',
    customerId: 'c-003',
    customerName: 'Brightleaf Retail',
    createdAt: '2026-05-04T16:40:00Z',
    createdBy: 'admin@carbon',
    status: 'Awaiting shipment',
    items: [
      {
        id: 'li-1', modelId: 'm-s30', modelName: 'S30', unitPrice: 269, qty: 6, type: 'Stand-alone',
        devices: [
          ...populatedDevices(4, 'C5A', 41201),
          ...emptyDevices(2),
        ],
      },
    ],
    discountPct: 10,
    notes: '',
    shipping: { name: 'Henry Tremblay', address: '88 King St E, Toronto, ON M5C 1G3, Canada', method: 'Standard ground' },
    events: [
      { at: '2026-05-04T16:40:00Z', kind: 'created', by: 'admin@carbon', text: 'Order created' },
      { at: '2026-05-05T09:00:00Z', kind: 'paid',    by: 'system',       text: 'Payment received · advanced to Awaiting shipment' },
      { at: '2026-05-06T10:14:00Z', kind: 'activate',by: 'warehouse@carbon', text: '4 of 6 C5 devices activated and recorded' },
    ],
  },

  // 4) Shipped — all activation done
  {
    id: 'o-2026-0152',
    number: 'SO-2026-0152',
    customerId: 'c-004',
    customerName: 'Vanta Software',
    createdAt: '2026-04-21T09:15:00Z',
    createdBy: 'admin@carbon',
    status: 'Shipped',
    items: [
      { id: 'li-1', modelId: 'm-s60', modelName: 'S60', unitPrice: 689, qty: 3, type: 'Semi-integration', devices: populatedDevices(3, 'S60', 22018) },
    ],
    discountPct: 0,
    notes: 'Pilot program, Zürich office.',
    shipping: { name: 'Lukas Meier', address: 'Bahnhofstrasse 12, 8001 Zürich, Switzerland', method: 'International express', tracking: 'DHL 4129-8821-7733' },
    events: [
      { at: '2026-04-21T09:15:00Z', kind: 'created',  by: 'admin@carbon', text: 'Order created' },
      { at: '2026-04-22T11:30:00Z', kind: 'paid',     by: 'system',       text: 'Payment received' },
      { at: '2026-04-23T15:08:00Z', kind: 'activate', by: 'warehouse@carbon', text: 'All 3 devices activated and recorded' },
      { at: '2026-04-24T08:45:00Z', kind: 'ship',     by: 'warehouse@carbon', text: 'Shipped via DHL · 4129-8821-7733' },
    ],
  },

  // 5) Partially complete — multi-model, some shipped, some pending
  {
    id: 'o-2026-0140',
    number: 'SO-2026-0140',
    customerId: 'c-001',
    customerName: 'Northwind Commerce',
    createdAt: '2026-04-10T13:00:00Z',
    createdBy: 'jordan.d@carbon',
    status: 'Partially complete',
    items: [
      { id: 'li-1', modelId: 'm-n750', modelName: 'N750', unitPrice: 319, qty: 5, type: 'Stand-alone',     devices: populatedDevices(5, 'N75', 90112), shipped: true },
      { id: 'li-2', modelId: 'm-x800', modelName: 'X800', unitPrice: 1180, qty: 2, type: 'Semi-integration', devices: emptyDevices(2), shipped: false },
    ],
    discountPct: 0,
    notes: 'Q8 units delayed pending firmware revision.',
    shipping: { name: 'Sarah Chen', address: '1455 Market St, Suite 600, San Francisco, CA 94103', method: 'Standard ground' },
    events: [
      { at: '2026-04-10T13:00:00Z', kind: 'created',  by: 'jordan.d@carbon', text: 'Order created' },
      { at: '2026-04-11T10:00:00Z', kind: 'paid',     by: 'system',          text: 'Payment received' },
      { at: '2026-04-15T09:20:00Z', kind: 'ship',     by: 'warehouse@carbon', text: 'Partial shipment · 5× T1 Mini dispatched' },
    ],
  },

  // 6) Complete
  {
    id: 'o-2026-0098',
    number: 'SO-2026-0098',
    customerId: 'c-003',
    customerName: 'Brightleaf Retail',
    createdAt: '2026-03-18T10:30:00Z',
    createdBy: 'admin@carbon',
    status: 'Complete',
    items: [
      { id: 'li-1', modelId: 'm-s30', modelName: 'S30', unitPrice: 269, qty: 24, type: 'Stand-alone', devices: populatedDevices(24, 'S30', 38001) },
    ],
    discountPct: 8,
    notes: 'Multi-store rollout, batch 2.',
    shipping: { name: 'Henry Tremblay', address: '88 King St E, Toronto, ON M5C 1G3, Canada', method: 'Freight', tracking: 'FX-991-2207' },
    events: [
      { at: '2026-03-18T10:30:00Z', kind: 'created',  by: 'admin@carbon', text: 'Order created' },
      { at: '2026-03-19T11:00:00Z', kind: 'paid',     by: 'system',       text: 'Payment received' },
      { at: '2026-03-22T08:30:00Z', kind: 'activate', by: 'warehouse@carbon', text: 'All 24 devices activated and recorded' },
      { at: '2026-03-23T14:00:00Z', kind: 'ship',     by: 'warehouse@carbon', text: 'Shipped · FX-991-2207' },
      { at: '2026-03-27T09:15:00Z', kind: 'deliver',  by: 'system',       text: 'Delivery confirmed' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────
const orderSubtotal = (o) => o.items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
const orderTotal = (o) => Math.round(orderSubtotal(o) * (1 - (o.discountPct || 0) / 100) * 100) / 100;
const orderQty = (o) => o.items.reduce((n, i) => n + i.qty, 0);
const deviceProgress = (o) => {
  let done = 0, total = 0;
  o.items.forEach(i => {
    total += i.qty;
    done += i.devices.filter(d => d.sn && d.code && d.code.length === 6).length;
  });
  return { done, total };
};

const moneyUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

Object.assign(window, {
  DEVICE_MODELS, SEED_ORDERS, ORDER_STATUSES, ORDER_STATUS_TONE,
  orderSubtotal, orderTotal, orderQty, deviceProgress, moneyUSD,
  fakeSN, fakeAC, emptyDevices, populatedDevices,
});
