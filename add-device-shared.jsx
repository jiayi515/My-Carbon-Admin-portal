/* global React */
// ─── Shared mini-system for the Add-Device comparison ──────────────
// Pulled from the main Carbon Admin design system (tokens.css +
// components.css are loaded by the host HTML). Everything below is a
// thin re-implementation of just what the three prototypes need.

const DEVICE_MODELS = [
  { id: 'm-n950', name: 'N950', family: 'Smart Android', desc: '5.5″ touch · NFC · magstripe',     unitPrice: 459,  types: ['Semi-integration', 'Stand-alone'] },
  { id: 'm-s30',  name: 'S30',  family: 'Countertop',    desc: 'Compact countertop · Ethernet',    unitPrice: 269,  types: ['Semi-integration', 'Stand-alone'] },
  { id: 'm-s60',  name: 'S60',  family: 'Smart POS',     desc: 'Dual-screen smart POS · printer',  unitPrice: 689,  types: ['Semi-integration', 'Stand-alone'] },
  { id: 'm-s90',  name: 'S90',  family: 'Portable',      desc: 'Portable · 4G + Wi-Fi + BT',       unitPrice: 389,  types: ['Semi-integration', 'Stand-alone'] },
  { id: 'm-n750', name: 'N750', family: 'Mobile',        desc: 'Slim handheld · 4G + NFC',         unitPrice: 319,  types: ['Semi-integration', 'Stand-alone'] },
  { id: 'm-x800', name: 'X800', family: 'Kiosk',         desc: 'Unattended kiosk · IP54',          unitPrice: 1180, types: ['Semi-integration'] },
];

const moneyUSD = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── Icon (subset) ─────────────────────────────────────────────────
const Icon = ({ name, size = 16, ...rest }) => {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    plus:    <path d="M12 5v14M5 12h14"/>,
    minus:   <path d="M5 12h14"/>,
    check:   <path d="M5 12.5l4 4L19 7"/>,
    x:       <path d="M6 6l12 12M18 6L6 18"/>,
    trash:   <React.Fragment><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></React.Fragment>,
    search:  <React.Fragment><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></React.Fragment>,
    split:   <React.Fragment><path d="M6 3v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4"/><path d="M16 17l3 4 3-4" transform="translate(-3 0)"/><path d="M3 7l3-4 3 4"/></React.Fragment>,
    chevR:   <path d="M9 6l6 6-6 6"/>,
    chevD:   <path d="M6 9l6 6 6-6"/>,
    info:    <React.Fragment><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8.5h.01"/></React.Fragment>,
    edit:    <path d="M4 20h4l10-10-4-4L4 16v4z"/>,
    dup:     <React.Fragment><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></React.Fragment>,
    arrowR:  <React.Fragment><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></React.Fragment>,
    bolt:    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
    cart:    <React.Fragment><path d="M3 4h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="21" r="1.2"/><circle cx="18" cy="21" r="1.2"/></React.Fragment>,
    package: <React.Fragment><path d="M21 8L12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></React.Fragment>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...rest}>{paths[name] || null}</svg>;
};

// ─── Btn ────────────────────────────────────────────────────────────
const Btn = ({ variant = 'secondary', size = 'md', icon, iconRight, children, ...rest }) => (
  <button className={`tds-btn tds-btn--${variant} tds-btn--${size}`} {...rest}>
    {icon && <Icon name={icon} size={14}/>}
    {children && <span>{children}</span>}
    {iconRight && <Icon name={iconRight} size={14}/>}
  </button>
);

// ─── Input / Select ─────────────────────────────────────────────────
const Input = ({ size = 'md', prefix, suffix, ...rest }) => (
  <div className={`tds-input tds-input--${size}`}>
    {prefix && <span className="tds-input__addon tds-input__addon--prefix">{prefix}</span>}
    <input className="tds-input__el" {...rest}/>
    {suffix && <span className="tds-input__addon tds-input__addon--suffix">{suffix}</span>}
  </div>
);

const Select = ({ size = 'md', children, ...rest }) => (
  <div className={`tds-select tds-select--${size}`}>
    <select {...rest}>{children}</select>
    <svg className="tds-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

// ─── Stepped quantity control ───────────────────────────────────────
const QtyStepper = ({ value, onChange, min = 0, max = 9999, w = 116, allowZero = true }) => {
  const lo = allowZero ? min : Math.max(1, min);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border-default)', borderRadius: 8, background: 'var(--color-bg-2)', height: 32, width: w }}>
      <button type="button" onClick={() => onChange(Math.max(lo, value - 1))} disabled={value <= lo}
        style={{ flex: 'none', width: 30, height: 30, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, color: value <= lo ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)', cursor: value <= lo ? 'not-allowed' : 'pointer', borderRadius: '8px 0 0 8px' }}>
        <Icon name="minus" size={12}/>
      </button>
      <input value={value}
        onChange={(e) => { const n = parseInt(e.target.value || '0', 10); onChange(Math.max(lo, Math.min(max, Number.isFinite(n) ? n : lo))); }}
        onFocus={(e) => e.target.select()}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: value === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', outline: 'none', padding: 0 }}/>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={{ flex: 'none', width: 30, height: 30, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, color: 'var(--color-text-secondary)', cursor: 'pointer', borderRadius: '0 8px 8px 0' }}>
        <Icon name="plus" size={12}/>
      </button>
    </div>
  );
};

// ─── ModelTile — colored letter mark per model ──────────────────────
const HUES = { 'm-n950': 235, 'm-s30': 200, 'm-s60': 280, 'm-s90': 25, 'm-n750': 155, 'm-x800': 320 };
const ModelTile = ({ model, px = 44 }) => {
  const h = HUES[model.id] ?? 240;
  return (
    <div style={{
      width: px, height: px, borderRadius: 10, flex: 'none',
      background: `linear-gradient(135deg, oklch(95% 0.04 ${h}), oklch(88% 0.09 ${h}))`,
      color: `oklch(34% 0.12 ${h})`,
      display: 'grid', placeItems: 'center',
      fontWeight: 700, fontSize: Math.round(px * 0.34), letterSpacing: '-0.02em',
      border: `1px solid oklch(82% 0.06 ${h} / 0.5)`,
    }}>{model.name.slice(0, 3)}</div>
  );
};

// ─── TypeBadge — colored chip for Semi/Stand ────────────────────────
const TypeBadge = ({ type, size = 'md' }) => {
  const semi = type === 'Semi-integration';
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '1px 7px' : '2px 9px',
      borderRadius: 999,
      fontSize: small ? 10.5 : 11.5, fontWeight: 600,
      lineHeight: 1.4,
      background: semi ? 'oklch(96% 0.04 265 / 0.7)' : 'oklch(96% 0.05 155 / 0.7)',
      color:      semi ? 'var(--color-accent-700)'   : 'var(--color-success-700)',
      border: `1px solid ${semi ? 'oklch(70% 0.12 265 / 0.3)' : 'oklch(70% 0.12 155 / 0.3)'}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flex: 'none' }}/>
      {type}
    </span>
  );
};

// ─── Chrome — every artboard has a wizard-style top bar ─────────────
const ArtboardChrome = ({ tag, title, sub, accent, children }) => (
  <div style={{
    width: '100%', height: '100%',
    background: 'var(--color-bg-1)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-text-primary)',
  }}>
    {/* Tag stripe */}
    <div style={{
      padding: '14px 22px 12px',
      borderBottom: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-2)',
      display: 'flex', alignItems: 'center', gap: 14, flex: 'none',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 6,
        background: accent.bg, color: accent.fg,
        fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        border: `1px solid ${accent.bd}`,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 1, background: 'currentColor' }}/>
        {tag}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.005em' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
        Step <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>2</strong> of 4 · Models &amp; quantities
      </div>
    </div>
    {/* Body */}
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 22px 24px' }}>
      {children}
    </div>
  </div>
);

// ─── Section label (uppercase eyebrow) ──────────────────────────────
const Eyebrow = ({ children, right, style }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    fontSize: 11, color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
    marginBottom: 10, ...style,
  }}>
    <span>{children}</span>
    {right && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{right}</span>}
  </div>
);

Object.assign(window, {
  DEVICE_MODELS, moneyUSD,
  Icon, Btn, Input, Select, QtyStepper,
  ModelTile, TypeBadge, ArtboardChrome, Eyebrow,
});
