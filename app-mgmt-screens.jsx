/* global React, Btn, Badge, Icon, Input, CompanyLogo */
/*
 * App Management — design exploration screens.
 * Static mock screens used inside the design canvas to evaluate
 * Published Apps + System Apps for the new "APP" sidebar group.
 *
 * No state, no routing — purely composed JSX wrapped inside the
 * project's existing CSS tokens & component styles so the proposals
 * read as native to the Customers / Orders pages.
 */
const { Fragment, useState } = React;

// ─── Mock data ────────────────────────────────────────────────
const PUB_APPS = [
  { id: 'pos',       pkg: 'com.acme.pos.pro',         name: 'Acme POS Pro',      cat: 'Payments',    pub: 'Acme Software',     type: 'android', payment: true,  orientations: ['portrait','landscape'], devices: ['N950','S90','S60','N750P','S30','X800','N750K'],  mode: 'public',  status: 'published',   ver: '4.3.2',  uploaded: 'May 09, 2026', subs: 42, terminals: 1820, scan: 'cleanish' },
  { id: 'tipout',    pkg: 'com.acme.tipout',          name: 'Tipout',            cat: 'Payments',    pub: 'Acme Software',     type: 'android', payment: true,  orientations: ['portrait'],             devices: ['S60','S90','N950'],          mode: 'private', status: 'published',   ver: '2.3.0',  uploaded: 'May 07, 2026', subs: 3,  terminals: 184,  scan: 'clean' },
  { id: 'reporting', pkg: 'com.acme.reporting',       name: 'Reporting Hub',     cat: 'Reporting',   pub: 'Acme Software',     type: 'android', payment: false, orientations: ['portrait','landscape'], devices: ['N950','N750','N750K'],       mode: 'public',  status: 'published',   ver: '1.4.7',  uploaded: 'May 02, 2026', subs: 18, terminals: 612,  scan: 'clean' },
  { id: 'fnb',       pkg: 'com.summit.fnb',           name: 'Summit F&B',        cat: 'F&B',         pub: 'Summit Retail Co.', type: 'android', payment: true,  orientations: ['landscape'],            devices: ['S30','S60','S90'],           mode: 'public',  status: 'published',   ver: '3.0.1',  uploaded: 'Apr 28, 2026', subs: 24, terminals: 940,  scan: 'cleanish' },
  { id: 'loyalty',   pkg: 'com.summit.loyalty',       name: 'Summit Loyalty',    cat: 'Loyalty',     pub: 'Summit Retail Co.', type: 'android', payment: false, orientations: ['portrait','landscape'], devices: ['S60','S90'],                 mode: 'private', status: 'published',   ver: '2.0.0',  uploaded: 'Apr 22, 2026', subs: 2,  terminals: 84,   scan: 'clean' },
  { id: 'selfsv',    pkg: 'com.boltworks.selfserve',  name: 'BoltServe Kiosk',   cat: 'Self-Service',pub: 'Boltworks Lab',     type: 'android', payment: true,  orientations: ['landscape'],            devices: ['X800','N950'],               mode: 'public',  status: 'unpublished', ver: '1.9.2',  uploaded: 'Apr 14, 2026', subs: 7,  terminals: 211,  scan: 'dirty' },
  { id: 'inv',       pkg: 'com.lumen.inventory',      name: 'Lumen Inventory',   cat: 'Inventory',   pub: 'Lumen POS Co.',     type: 'android', payment: false, orientations: ['portrait','landscape'], devices: ['ALL'],                       mode: 'public',  status: 'archived',    ver: '0.9.4',  uploaded: 'Apr 09, 2026', subs: 11, terminals: 318,  scan: 'cleanish' },
  { id: 'sec',       pkg: 'com.boltworks.secagent',   name: 'Secure Agent',      cat: 'Security',    pub: 'Boltworks Lab',     type: 'linux',   payment: false, orientations: [],                       devices: ['N950','N750P'],              mode: 'private', status: 'published',   ver: '0.6.1',  uploaded: 'Apr 02, 2026', subs: 1,  terminals: 47,   scan: 'clean' },
];

const SYS_APPS = [
  { id: 'launcher', pkg: 'com.npt.launcher',     name: 'TOMS Launcher',       cat: 'Pre-installed', signer: 'system',  required: true,  models: ['ALL'],               ver: '12.4.1', uploaded: 'May 12, 2026', terminals: 8420, scan: 'clean' },
  { id: 'mdm',      pkg: 'com.npt.mdm.agent',    name: 'MDM Agent',           cat: 'System',        signer: 'system',  required: true,  models: ['ALL'],               ver: '7.2.0',  uploaded: 'May 09, 2026', terminals: 8420, scan: 'clean' },
  { id: 'updater',  pkg: 'com.npt.ota.updater',  name: 'OTA Updater',         cat: 'System',        signer: 'system',  required: true,  models: ['ALL'],               ver: '5.9.3',  uploaded: 'May 06, 2026', terminals: 8420, scan: 'clean' },
  { id: 'keymgr',   pkg: 'com.npt.keymgr',       name: 'Key Manager',         cat: 'System',        signer: 'system',  required: true,  models: ['N950','N750P','S90'],ver: '3.1.0',   uploaded: 'May 04, 2026', terminals: 3120, scan: 'clean' },
  { id: 'diag',     pkg: 'com.npt.diagnostics',  name: 'Diagnostics',         cat: 'Utility',       signer: 'npt',     required: false, models: ['ALL'],               ver: '2.0.4',  uploaded: 'May 01, 2026', terminals: 4280, scan: 'clean' },
  { id: 'kiosk',    pkg: 'com.npt.kiosk.lock',   name: 'Kiosk Lockdown',      cat: 'Utility',       signer: 'npt',     required: false, models: ['X800','N950'],       ver: '1.4.2',  uploaded: 'Apr 22, 2026', terminals: 612,  scan: 'cleanish' },
];

const VERSIONS_POS = [
  { id: 'v32', code: 1432, name: '4.3.2', size: '28.4 MB', uploaded: 'May 09, 2026', published: 'May 10, 2026', status: 'published',   scan: 'cleanish', sdk: '24 → 34', perms: 18, reach: 1820, current: true,  notes: 'Tip flow polish, new receipt template.' },
  { id: 'v31', code: 1431, name: '4.3.1', size: '28.1 MB', uploaded: 'Apr 21, 2026', published: 'Apr 22, 2026', status: 'published',   scan: 'clean',    sdk: '24 → 34', perms: 18, reach: 412,  current: false, notes: 'Bug fixes for split-tender flow.' },
  { id: 'v30', code: 1430, name: '4.3.0', size: '27.9 MB', uploaded: 'Apr 04, 2026', published: 'Apr 05, 2026', status: 'rollback',    scan: 'dirty',    sdk: '24 → 34', perms: 21, reach: 0,    current: false, notes: 'Pulled after PAN exposure scan flag (cleared in 4.3.1).' },
  { id: 'v29', code: 1429, name: '4.2.9', size: '27.4 MB', uploaded: 'Mar 14, 2026', published: 'Mar 15, 2026', status: 'unpublished', scan: 'clean',    sdk: '24 → 33', perms: 18, reach: 0,    current: false, notes: 'Superseded by 4.3.x.' },
];

const SUBSCRIBERS_POS = [
  { id: 'c01', name: 'Northbay Devices',  region: 'Quebec, CA',  on: 'v32', deployed: 86,  pending: false },
  { id: 'c02', name: 'Summit Retail Co.', region: 'BC, CA',      on: 'v32', deployed: 142, pending: false },
  { id: 'c03', name: 'Mercato Group',     region: 'Lombardia, IT', on: 'v31', deployed: 64, pending: true  },
  { id: 'c04', name: 'Harbor Restaurants',region: 'NSW, AU',     on: 'v32', deployed: 28,  pending: false },
  { id: 'c05', name: 'Tradewind POS',     region: 'TX, US',      on: 'v32', deployed: 311, pending: false },
];

// ─── Shared visuals ─────────────────────────────────────────
// Scan-result dot — clean/cleanish/dirty/none — with optional label.
const ScanDot = ({ v, label }) => {
  const tone = { clean: 'oklch(58% 0.14 152)', cleanish: 'oklch(70% 0.15 75)', dirty: 'oklch(58% 0.18 25)' }[v] || 'oklch(70% 0 0)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: tone, boxShadow: `0 0 0 2px color-mix(in oklch, ${tone}, transparent 80%)` }}/>
      {label && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{v}</span>}
    </span>
  );
};

const APP_HUES = [[265, 230], [152, 200], [25, 50], [200, 265], [75, 100], [320, 280], [220, 180], [180, 220], [50, 25]];
const hueFor = (s) => APP_HUES[Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % APP_HUES.length];

// Square colourful app icon — generated from package name so each row reads as
// a unique app even without real icon assets uploaded yet. Renders the first
// two glyphs of the display name in monospace.
const AppIcon = ({ name, pkg, size = 36, radius = 9 }) => {
  const [h1, h2] = hueFor(pkg || name);
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flex: 'none',
      background: `linear-gradient(135deg, oklch(60% 0.16 ${h1}), oklch(48% 0.16 ${h2}))`,
      color: '#fff', display: 'grid', placeItems: 'center',
      fontWeight: 700, fontSize: size * 0.36, fontFamily: 'var(--font-family-mono)', letterSpacing: '-0.02em',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
      {initials}
    </div>
  );
};

// status (published / unpublished / archived / rollback) → outlined chip
const StatusChip = ({ s }) => {
  if (s === 'published')   return <Badge tone="success" dot>Published</Badge>;
  if (s === 'unpublished') return <Badge tone="warning" dot>Unpublished</Badge>;
  if (s === 'archived')    return <Badge tone="neutral" dot>Archived</Badge>;
  if (s === 'rollback')    return <Badge tone="error"   dot>Rollback</Badge>;
  return <Badge tone="neutral">{s}</Badge>;
};

// App runtime / type — Android / Linux / RTOS
const APP_TYPE_LABELS = { android: 'Android', linux: 'Linux', rtos: 'RTOS' };
const APP_TYPE_HUES   = { android: 152,       linux: 25,      rtos: 280 };
const AppTypeChip = ({ t }) => {
  const hue = APP_TYPE_HUES[t] ?? 200;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-family-mono)', letterSpacing: 0.04,
      background: `oklch(96% 0.03 ${hue})`, color: `oklch(38% 0.13 ${hue})`,
      border: `1px solid oklch(60% 0.14 ${hue} / 0.30)`, textTransform: 'uppercase',
    }}>{APP_TYPE_LABELS[t] || t}</span>
  );
};

// Payment-capable flag chip — only renders when on
const PaymentChip = ({ on }) => on ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
    background: 'oklch(96% 0.04 80)', color: 'oklch(38% 0.13 80)',
    border: '1px solid oklch(70% 0.14 80 / 0.30)' }}>
    <Icon name="cash" size={10}/> Payment
  </span>
) : null;

const ModeChip = ({ m }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 500,
    background: m === 'private' ? 'oklch(96% 0.03 280)' : 'oklch(96% 0.03 200)',
    color: m === 'private' ? 'oklch(38% 0.10 280)' : 'oklch(38% 0.10 200)',
    border: `1px solid ${m === 'private' ? 'oklch(60% 0.10 280 / 0.25)' : 'oklch(60% 0.10 200 / 0.25)'}`,
  }}>
    <Icon name={m === 'private' ? 'key' : 'globe'} size={10} />
    {m === 'private' ? 'Specified ISOs' : 'All ISOs'}
  </span>
);

const SignerChip = ({ v }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px', borderRadius: 4,
    fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-family-mono)', letterSpacing: 0.02,
    background: v === 'system' ? 'oklch(94% 0.03 25)' : 'oklch(94% 0.04 265)',
    color: v === 'system' ? 'oklch(38% 0.13 25)' : 'oklch(38% 0.13 265)',
    border: `1px solid ${v === 'system' ? 'oklch(60% 0.14 25 / 0.3)' : 'oklch(60% 0.14 265 / 0.3)'}`,
    textTransform: 'uppercase',
  }}>
    {v === 'system' ? 'SYSTEM' : 'NPT'}
  </span>
);

// Device-model chips condensed into a row, with three states:
//  · few   — show every chip
//  · many  — show first `max` then a "+N" overflow with full list in tooltip
//  · all   — collapse to a single "All models" pill (auto-detected when list
//             contains 'ALL' sentinel or matches the full device catalog)
const ALL_DEVICE_MODELS = ['N950','S30','S60','S90','X800','N750','N750K','N750P'];
const DeviceModels = ({ list, max = 3 }) => {
  const isAll = list[0] === 'ALL' || list.length >= ALL_DEVICE_MODELS.length;
  if (isAll) {
    const full = list[0] === 'ALL' ? ALL_DEVICE_MODELS : list;
    return (
      <span title={full.join(', ')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4,
          background: 'oklch(96% 0.03 230)', border: '1px solid oklch(60% 0.10 230 / 0.30)',
          color: 'oklch(38% 0.10 230)', font: '600 11px var(--font-family-mono)', letterSpacing: 0.02 }}>
        <Icon name="package" size={10} />
        All models <span style={{ opacity: 0.6, fontWeight: 500 }}>({full.length})</span>
      </span>
    );
  }
  const shown = list.slice(0, max), extra = list.length - max;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }} title={list.join(', ')}>
      {shown.map((m) => (
        <span key={m} style={{ font: '500 11px var(--font-family-mono)', padding: '2px 6px', borderRadius: 4, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>{m}</span>
      ))}
      {extra > 0 && (
        <span title={list.slice(max).join(', ')}
          style={{ font: '600 11px var(--font-family-mono)', padding: '2px 7px', borderRadius: 4,
            background: 'var(--color-bg-2)', border: '1px dashed var(--color-border-default)', color: 'var(--color-text-secondary)', cursor: 'help' }}>
          +{extra}
        </span>
      )}
    </span>
  );
};

// ─── Action dropdown menu ────────────────────────────────────
const ActionMenu = ({ trigger, items, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', [align]: 0, zIndex: 50, minWidth: 240,
          background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 10,
          boxShadow: '0 12px 32px oklch(0% 0 0 / 0.18)', padding: 4 }}>
          {items.map((it, i) => it.divider
            ? <div key={`d${i}`} style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 6px' }}/>
            : it.header
              ? <div key={`h${i}`} style={{ padding: '6px 10px 4px', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{it.header}</div>
              : <button key={i} type="button" onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '8px 10px',
                    background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer',
                    color: it.tone === 'danger' ? 'var(--color-error-700)' : it.tone === 'warning' ? 'var(--color-warning-700)' : 'var(--color-text-primary)',
                    font: 'inherit', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {it.icon && <Icon name={it.icon} size={14} style={{ marginTop: 2, flex: 'none' }}/>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.label}</div>
                    {it.desc && <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{it.desc}</div>}
                  </div>
                </button>)}
        </div>
      )}
    </div>
  );
};
const AppShell = ({ active, crumbs, overlay, children }) => (
  <div className="app" data-density="comfortable" style={{ height: '100%', gridTemplateColumns: '248px 1fr', position: 'relative' }}>
    <aside className="side">
      <div className="side__brand">
        <div className="side__logo"><img src="assets/toms-logo.png" alt="TOMS" /></div>
        <div className="side__name">TOMS<small>Carbon · Admin</small></div>
      </div>
      <div className="side__sectionlabel">Manage</div>
      <nav className="side__nav">
        <SidebarItem icon="users"   label="Customers" />
        <SidebarItem icon="package" label="Devices" hasChild>
          <SidebarSub label="Sample Orders" />
          <SidebarSub label="Device Models" />
        </SidebarItem>
      </nav>
      <div className="side__sectionlabel">Apps</div>
      <nav className="side__nav">
        <SidebarItem icon="building" label="Apps" open hasChild>
          <SidebarSub label="Published Apps" active={active === 'pub'} />
          <SidebarSub label="System Apps"    active={active === 'sys'} />
        </SidebarItem>
      </nav>
      <div className="side__sectionlabel">System</div>
      <nav className="side__nav">
        <SidebarItem icon="shield" label="Roles" />
        <SidebarItem icon="users"  label="Users" />
        <SidebarItem icon="shield" label="Customer Role Definitions" />
        <SidebarItem icon="audit"  label="Audit Logs" />
      </nav>
      <div className="side__footer" style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="side__avatar">JD</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 12.5 }}>Jordan Diaz</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>admin@toms</div>
        </div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="crumbs">
          {crumbs.flatMap((c, i) => [
            i > 0 && <span key={`s${i}`} className="crumbs__sep">/</span>,
            i === crumbs.length - 1
              ? <span key={`c${i}`} className="crumbs__current">{c}</span>
              : <a key={`a${i}`}>{c}</a>,
          ])}
        </div>
        <div className="topbar__spacer" />
        <button type="button" className="topbar__search">
          <Icon name="search" size={13} />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
        <button className="iconbtn"><Icon name="bell" size={15} /></button>
      </header>
      <div className="content">{children}</div>
    </main>
    {overlay}
  </div>
);

const SidebarItem = ({ icon, label, active, open, hasChild, children }) => (
  <>
    <div className={`side__item ${active ? 'is-active' : ''} ${hasChild ? 'is-parent' : ''} ${open ? 'is-open' : ''}`}>
      <Icon name={icon} size={15} />
      <span style={{ flex: 1 }}>{label}</span>
      {hasChild && (
        <span className={`side__chev ${open ? 'is-open' : ''}`}><Icon name="chevR" size={12} /></span>
      )}
    </div>
    {open && hasChild && <div className="side__sublist">{children}</div>}
  </>
);

const SidebarSub = ({ label, active }) => (
  <div className={`side__sub ${active ? 'is-active' : ''}`}>{label}</div>
);

// ─── Variation A — Published Apps list (wide table) ────────────
const PubAppsListA = () => (
  <AppShell active="pub" crumbs={['Apps', 'Published Apps']}>
    <div className="page" style={{ maxWidth: 'unset' }}>
      <div className="page__head">
        <div>
          <h1 className="page__title">Published Apps</h1>
          <p className="page__sub">All ISV-published apps visible to ISO tenants in the Customer Portal. Read-only browse, with global unpublish and emergency rollback.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download" size="md">Export CSV</Btn>
          <Btn variant="secondary" icon="search" size="md">Package lookup</Btn>
        </div>
      </div>

      <div className="stats">
        <button type="button" className="stat is-clickable is-active">
          <div className="stat__label">Total apps</div>
          <div className="stat__val">{PUB_APPS.length}</div>
          <div className="stat__delta stat__delta--up">↑ 2 this week</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Published</div>
          <div className="stat__val">{PUB_APPS.filter(a => a.status === 'published').length}</div>
          <div className="stat__delta">live to subscribers</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Pending review</div>
          <div className="stat__val">3</div>
          <div className="stat__delta">scan flagged for admin</div>
          <div className="stat__action">Review <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Rolled back</div>
          <div className="stat__val">1</div>
          <div className="stat__delta">in last 30 days</div>
          <div className="stat__action">View history <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search by name, package, publisher…" size="md" />
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select><option>All status</option><option>Published</option><option>Unpublished</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select><option>All categories</option><option>Payments</option><option>Retail</option><option>F&amp;B</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select><option>All visibility</option><option>Public</option><option>Private</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select><option>All scan</option><option>Clean</option><option>Cleanish</option><option>Dirty</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>App</th>
              <th>Publisher</th>
              <th>Category</th>
              <th>Latest</th>
              <th style={{ textAlign: 'right' }}>Subs</th>
              <th style={{ textAlign: 'right' }}>Terminals</th>
              <th>Visibility</th>
              <th>Scan</th>
              <th>Status</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {PUB_APPS.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="cust-cell">
                    <AppIcon name={a.name} pkg={a.pkg} />
                    <div style={{ minWidth: 0 }}>
                      <div className="cust-name">{a.name}</div>
                      <div className="cust-meta" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5 }}>{a.pkg}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 13 }}>{a.pub}</span></td>
                <td><span className="tds-badge tds-badge--neutral">{a.cat}</span></td>
                <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{a.ver}</span><div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{a.uploaded}</div></td>
                <td className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.subs}</td>
                <td className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.terminals.toLocaleString()}</td>
                <td><ModeChip m={a.mode} /></td>
                <td><ScanDot v={a.scan} label /></td>
                <td><StatusChip s={a.status} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn"><Icon name="more" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">
          <div className="table-foot__meta">Showing 1–8 of 142 apps</div>
          <div className="row" style={{ gap: 4 }}>
            <Btn variant="ghost" size="sm" icon="chevL">Prev</Btn>
            <Btn variant="ghost" size="sm" iconRight="chevR">Next</Btn>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
);

// ─── Variation B — Published Apps list (denser 2-line rows) ────
const PubAppsListB = () => (
  <AppShell active="pub" crumbs={['Apps', 'Published Apps']}>
    <div className="page" style={{ maxWidth: 'unset' }}>
      <div className="page__head">
        <div>
          <h1 className="page__title">Published Apps</h1>
          <p className="page__sub">ISV apps surfaced through the Customer Portal. Click any row for versions, subscribers and audit history.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download" size="md">Export</Btn>
          <Btn variant="secondary" icon="search"   size="md">Package lookup</Btn>
        </div>
      </div>

      <div className="stats">
        <button type="button" className="stat is-clickable is-active">
          <div className="stat__label">All apps</div>
          <div className="stat__val">142</div>
          <div className="stat__delta">across 34 ISV tenants</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Terminals reached</div>
          <div className="stat__val">8.4k</div>
          <div className="stat__delta stat__delta--up">↑ 612 this week</div>
          <div className="stat__action">Coverage <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Scan flagged</div>
          <div className="stat__val">3</div>
          <div className="stat__delta">awaiting admin decision</div>
          <div className="stat__action">Review <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Unpublished by admin</div>
          <div className="stat__val">2</div>
          <div className="stat__delta">forced takedowns · 30d</div>
          <div className="stat__action">History <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search by name, package, publisher…" size="md" />
        <div className="list-toolbar__filters">
          <div className="seg">
            <button className="seg__btn is-on">All</button>
            <button className="seg__btn">All ISOs</button>
            <button className="seg__btn">Specified</button>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 130 }}>
            <select><option>All runtimes</option><option>Android</option><option>Linux</option><option>RTOS</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 150 }}>
            <select><option>All status</option><option>Published</option><option>Unpublished</option><option>Archived</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 150 }}>
            <select><option>All categories</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 110 }}>
            <select><option>All scan</option><option>Clean</option><option>Dirty</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>App</th>
              <th>Publisher · Visibility</th>
              <th>Latest version</th>
              <th style={{ textAlign: 'right' }}>Subscribers</th>
              <th>State</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {PUB_APPS.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="cust-cell" style={{ alignItems: 'flex-start' }}>
                    <AppIcon name={a.name} pkg={a.pkg} size={40} radius={10} />
                    <div style={{ minWidth: 0 }}>
                      <div className="cust-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {a.name}
                        <AppTypeChip t={a.type} />
                        <span className="tds-badge tds-badge--neutral" style={{ height: 17, fontSize: 10.5 }}>{a.cat}</span>
                        {a.payment && <PaymentChip on />}
                      </div>
                      <div className="cust-meta" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, marginTop: 2 }}>{a.pkg}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{a.pub}</div>
                  <div style={{ marginTop: 4 }}><ModeChip m={a.mode} /></div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 600 }}>{a.ver}</span>
                    <ScanDot v={a.scan} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Uploaded {a.uploaded}</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                    <strong style={{ fontWeight: 600 }}>{a.subs}</strong> <span className="muted" style={{ fontSize: 12 }}>ISO</span>
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{a.terminals.toLocaleString()} terminals</div>
                </td>
                <td><StatusChip s={a.status} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn"><Icon name="more" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">
          <div className="table-foot__meta">Showing 1–8 of 142 apps</div>
          <div className="row" style={{ gap: 4 }}>
            <Btn variant="ghost" size="sm" icon="chevL">Prev</Btn>
            <Btn variant="ghost" size="sm" iconRight="chevR">Next</Btn>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
);

// ─── Detail header (shared between A and B) ────────────────────
const DetailHeader = ({ app }) => (
  <div className="det-header">
    <AppIcon name={app.name} pkg={app.pkg} size={56} radius={12} />
    <div className="det-header__main">
      <h2 className="det-header__title">
        {app.name}
        <AppTypeChip t={app.type} />
        <StatusChip s={app.status} />
        <ModeChip m={app.mode} />
        <PaymentChip on={app.payment} />
      </h2>
      <div className="det-header__meta">
        <span style={{ fontFamily: 'var(--font-family-mono)' }}>{app.pkg}</span>
        <span>·</span>
        <span>Published by <strong style={{ color: 'var(--color-text-primary)' }}>{app.pub}</strong></span>
        <span>·</span>
        <span>{app.cat}</span>
        <span>·</span>
        <span>Latest <strong style={{ fontFamily: 'var(--font-family-mono)' }}>{app.ver}</strong></span>
      </div>
    </div>
    <ActionMenu
      trigger={
        <button className="iconbtn" title="App actions" style={{ width: 32, height: 32, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-2)' }}>
          <Icon name="more" size={15}/>
        </button>
      }
      items={[
        { header: 'View' },
        { icon: 'link', label: 'Open in Customer Portal', desc: 'Switch to the ISO-facing surface for this app.' },
        { divider: true },
        { header: 'Sensitive actions' },
        { icon: 'info',   label: 'Force global unpublish…', tone: 'warning',
          desc: 'Pull this app from the public pool. Existing subscribers keep running; no new subscriptions or version pushes accepted. Written to audit.' },
        { icon: 'rotate', label: 'Roll back current version…', tone: 'danger',
          desc: 'Force-uninstalls the current version from every terminal on next contact. Notifies all subscribed ISOs urgently.' },
        { icon: 'check',  label: 'Mark scan reviewed',
          desc: 'Clear the current scan flag once a reviewer has assessed it. Written to audit.' },
      ]}
    />
  </div>
);

const DetailTabs = ({ active = 'overview' }) => {
  const tabs = ['Overview', 'Versions', 'Subscribers', 'Compliance', 'Activity', 'Devices'];
  return (
    <div className="det-tabs">
      {tabs.map((t) => (
        <button key={t} className={`tds-tab ${t.toLowerCase() === active ? 'is-active' : ''}`}>{t}</button>
      ))}
    </div>
  );
};

// Reusable two-column info card
const InfoCard = ({ title, action, children }) => (
  <div className="info-card">
    <div className="info-card__head">
      <h4>{title}</h4>
      {action}
    </div>
    <div className="info-card__body">{children}</div>
  </div>
);
const InfoRow = ({ k, v, mono }) => (
  <div className="info-row">
    <span className="info-row__k">{k}</span>
    <span className="info-row__v" style={mono ? { fontFamily: 'var(--font-family-mono)', fontSize: 12.5 } : undefined}>{v}</span>
  </div>
);

// ─── Variation A — Detail / Overview (info-card grid) ──────────
const PubAppDetailA = () => {
  const app = PUB_APPS[0];
  const [breakdownTab, setBreakdownTab] = useState(null);
  const open = (tab) => setBreakdownTab(tab);
  const close = () => setBreakdownTab(null);
  return (
    <AppShell
      active="pub"
      crumbs={['Apps', 'Published Apps', app.name]}
      overlay={breakdownTab && <TerminalBreakdownModal app={app} initialTab={breakdownTab} onClose={close} />}>
      <div className="page" style={{ maxWidth: 'unset' }}>
        <DetailHeader app={app} />
        <DetailTabs active="overview" />

        <div className="stats">
          <div className="stat">
            <div className="stat__label">Versions</div>
            <div className="stat__val">12</div>
            <div className="stat__delta">2 in last 30 days</div>
          </div>
          <button type="button" className="stat is-clickable" onClick={() => open('iso')}>
            <div className="stat__label">Subscribed ISOs</div>
            <div className="stat__val">{app.subs}</div>
            <div className="stat__delta">+3 this month</div>
            <div className="stat__action">Breakdown <Icon name="chevR" size={9}/></div>
          </button>
          <button type="button" className="stat is-clickable" onClick={() => open('device')}>
            <div className="stat__label">Deployed terminals</div>
            <div className="stat__val">{app.terminals.toLocaleString()}</div>
            <div className="stat__delta">across {app.devices[0] === 'ALL' ? '8' : app.devices.length} device models</div>
            <div className="stat__action">Breakdown <Icon name="chevR" size={9}/></div>
          </button>
          <div className="stat">
            <div className="stat__label">Latest scan</div>
            <div className="stat__val" style={{ fontSize: 18, paddingTop: 4 }}>
              <ScanDot v={app.scan} label />
            </div>
            <div className="stat__delta">v4.3.2 · May 09</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
          <InfoCard title="App profile" action={<button className="iconbtn"><Icon name="info" size={14}/></button>}>
            <InfoRow k="Package" v={app.pkg} mono />
            <InfoRow k="Display name" v={app.name} />
            <InfoRow k="Category" v={app.cat} />
            <InfoRow k="Description" v="Counter-top POS for tipped service, with split-tender, gift cards and KDS integration." />
            <InfoRow k="Orientations" v={<><Badge tone="neutral">Portrait</Badge> <Badge tone="neutral">Landscape</Badge></>} />
            <InfoRow k="Supported devices" v={<DeviceModels list={app.devices} max={6} />} />
          </InfoCard>

          <InfoCard title="Publisher & contract">
            <InfoRow k="Publisher tenant" v={<><strong>{app.pub}</strong> <span className="muted" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>· acme-sw</span></>} />
            <InfoRow k="ISV contract" v={<Badge tone="success">Active · since Jan 14, 2025</Badge>} />
            <InfoRow k="Region" v="US · Bay Area" />
            <InfoRow k="Primary contact" v="Mira Chen · mira@acme.example" />
            <InfoRow k="Visibility" v={<ModeChip m={app.mode} />} />
            <InfoRow k="First published" v="Jul 02, 2025" />
          </InfoCard>

          <InfoCard title="Signing & permissions">
            <InfoRow k="Signer CN" v="Acme Software Inc." mono />
            <InfoRow k="SHA-256" v="d4:e2:8a:7c:91:f0:54:b3:…" mono />
            <InfoRow k="minSdk → targetSdk" v="24 → 34" mono />
            <InfoRow k="Permissions" v={<><strong>18 declared</strong> · <a style={{ color: 'var(--color-primary-700)', cursor: 'pointer' }}>view diff vs 4.3.1</a></>} />
            <InfoRow k="Latest scan" v={<><ScanDot v={app.scan} label /> · 1 advisory</>} />
          </InfoCard>

          <InfoCard title="Admin actions" action={<Badge tone="neutral">Read-only by default</Badge>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ActionRow icon="info" tone="warn" title="Force global unpublish" desc="Removes the app from the public pool. Subscribed ISOs receive a takedown notice; existing installs stay until next sync." cta="Unpublish…" />
              <ActionRow icon="rotate" tone="danger" title="Roll back current version" desc="Pulls v4.3.2 from all terminals on next contact. Use only when a critical issue is confirmed." cta="Roll back…" />
              <ActionRow icon="check" tone="ok" title="Clear scan flag" desc="Marks the current scan result as reviewed. Logged to audit." cta="Mark reviewed" />
            </div>
          </InfoCard>
        </div>
      </div>
    </AppShell>
  );
};

const ActionRow = ({ icon, tone, title, desc, cta }) => {
  const palette = {
    ok:     { bg: 'var(--color-success-50)', fg: 'var(--color-success-700)', border: 'oklch(58% 0.14 152 / 0.22)' },
    warn:   { bg: 'var(--color-warning-50)', fg: 'var(--color-warning-700)', border: 'oklch(70% 0.16 70 / 0.25)'  },
    danger: { bg: 'var(--color-error-50)',   fg: 'var(--color-error-700)',   border: 'oklch(58% 0.20 25 / 0.22)' },
  }[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: `1px solid ${palette.border}`, background: palette.bg, borderRadius: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', border: `1px solid ${palette.border}`, color: palette.fg, display: 'grid', placeItems: 'center', flex: 'none' }}>
        <Icon name={icon} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: palette.fg }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <Btn variant="secondary" size="sm">{cta}</Btn>
    </div>
  );
};

// ─── Distribution view ────────────────────────────────────────────────
// Reusable stacked-bar + tile-grid for any categorical breakdown.
// `dist` is an array of { m, n, pct } sorted descending by n.
const STACK_COLORS = [
  'oklch(48% 0.18 262)', // primary
  'oklch(58% 0.16 200)', // info
  'oklch(58% 0.14 152)', // success
  'oklch(65% 0.16 75)',  // warning
  'oklch(58% 0.14 320)', // accent
  'oklch(50% 0.10 25)',  // muted-warm
  'oklch(62% 0.12 180)', // teal
];

const DistributionView = ({ dist, unit = 'terminals', tileCap = 8 }) => {
  const total = dist.reduce((a, d) => a + d.n, 0);
  const head = dist.slice(0, tileCap);
  const tail = dist.slice(tileCap);
  const other = tail.length
    ? { m: `+${tail.length} other`, n: tail.reduce((a, d) => a + d.n, 0), pct: tail.reduce((a, d) => a + d.pct, 0), models: tail.map((t) => t.m).join(', ') }
    : null;
  const tiles = other ? [...head, other] : head;
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--color-bg-3)', marginBottom: 8 }}>
        {dist.map((d, i) => (
          <div key={d.m} title={`${d.m} · ${d.n.toLocaleString()} ${unit} (${d.pct}%)`}
            style={{ flexBasis: `${d.pct}%`, background: STACK_COLORS[i % STACK_COLORS.length], borderRight: i < dist.length - 1 ? '1px solid var(--color-bg-2)' : 'none' }}/>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 18 }}>
        {dist.slice(0, 10).map((d, i) => (
          <span key={d.m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: STACK_COLORS[i % STACK_COLORS.length] }}/>
            <span style={{ fontFamily: d.m.length > 14 ? 'var(--font-family-sans)' : 'var(--font-family-mono)' }}>{d.m}</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {tiles.map((d, i) => {
          const isOther = !!d.models;
          return (
            <div key={d.m} title={isOther ? d.models : undefined}
              style={{
                background: isOther ? 'var(--color-bg-2)' : 'var(--color-bg-3)',
                border: isOther ? '1px dashed var(--color-border-default)' : '1px solid var(--color-border-subtle)',
                borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontFamily: d.m.length > 14 ? 'var(--font-family-sans)' : 'var(--font-family-mono)', fontSize: 11.5, color: isOther ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.m}</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{d.n.toLocaleString()}</div>
              <div style={{ marginTop: 8, height: 4, background: 'var(--color-bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${d.pct}%`, height: '100%', background: STACK_COLORS[i % STACK_COLORS.length] }}/>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                {d.pct}% {isOther ? 'combined' : `of ${total.toLocaleString()}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Terminal breakdown modal ─────────────────────────────────────
// Triggered by clicking the hero “deployed terminals” number on Overview.
// Heavy multi-dimensional aggregations live here only — Overview itself
// stays cheap (just denormalised counters).
const TerminalBreakdownModal = ({ app, initialTab = 'device', onClose }) => {
  const [tab, setTab] = useState(initialTab);
  const total = app.terminals;

  // Each dataset is the same { m, n, pct } shape so DistributionView works
  // unchanged. Counts are mocked from the app's terminal total — in prod
  // they come from per-axis aggregations.
  const tabs = {
    device: {
      label: 'Device model',
      sub:   'Group-by terminals.device_model_id',
      dist:  buildDistribution(app.devices, total),
    },
    version: {
      label: 'App version',
      sub:   'Currently installed APK on each terminal',
      dist:  applyWeights([
        { m: 'v4.3.2', w: 0.86 },
        { m: 'v4.3.1', w: 0.11 },
        { m: '< v4.3', w: 0.03 },
      ], total),
    },
    iso: {
      label: 'ISO subscriber',
      sub:   'Terminals deployed per ISO tenant',
      dist:  applyWeights([
        { m: 'Tradewind POS',      w: 0.20 },
        { m: 'Summit Retail Co.',  w: 0.18 },
        { m: 'Northbay Devices',   w: 0.16 },
        { m: 'Harbor Restaurants', w: 0.12 },
        { m: 'Mercato Group',      w: 0.10 },
        { m: 'Boltworks Lab',      w: 0.08 },
        { m: 'Lumen POS Co.',      w: 0.06 },
        { m: '+ 36 more ISOs',     w: 0.10 },
      ], total),
    },
    region: {
      label: 'Region',
      sub:   'Merchant billing country, rolled up',
      dist:  applyWeights([
        { m: 'US',     w: 0.42 },
        { m: 'CA',     w: 0.18 },
        { m: 'EU',     w: 0.16 },
        { m: 'UK',     w: 0.10 },
        { m: 'APAC',   w: 0.08 },
        { m: 'LATAM',  w: 0.06 },
      ], total),
    },
    industry: {
      label: 'Merchant industry',
      sub:   'Merchant tags assigned by the ISO',
      dist:  applyWeights([
        { m: 'Retail',       w: 0.36 },
        { m: 'F&B',          w: 0.28 },
        { m: 'Hospitality',  w: 0.14 },
        { m: 'Self-service', w: 0.10 },
        { m: 'Healthcare',   w: 0.07 },
        { m: 'Other',        w: 0.05 },
      ], total),
    },
    health: {
      label: 'Health',
      sub:   'Last contact timestamp bucket',
      dist:  applyWeights([
        { m: 'Online (< 1h)',    w: 0.78 },
        { m: 'Idle (1–24h)',     w: 0.15 },
        { m: 'Stale (1–7d)',     w: 0.05 },
        { m: 'Offline (> 7d)',   w: 0.02 },
      ], total),
    },
  };

  const current = tabs[tab];

  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'oklch(20% 0.02 60 / 0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px', overflowY: 'auto' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', background: 'var(--color-bg-1)', borderRadius: 14,
          boxShadow: '0 24px 64px oklch(0% 0 0 / 0.25), 0 0 0 1px var(--color-border-default)',
          display: 'flex', flexDirection: 'column', maxHeight: 'calc(100% - 24px)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Terminal breakdown</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 4 }}>{app.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text-primary)' }}>{total.toLocaleString()}</span> terminals
                <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                <span>{app.subs} ISOs</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{app.pkg}</span>
              </div>
            </div>
            <button className="iconbtn" onClick={onClose} title="Close (Esc)"><Icon name="x" size={14}/></button>
          </div>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginTop: 14, marginBottom: -14, paddingBottom: 0, flexWrap: 'wrap' }}>
            {Object.entries(tabs).map(([k, ds]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{
                  padding: '8px 12px', background: 'transparent', border: 0, borderBottom: '2px solid transparent',
                  font: '500 12.5px/1 var(--font-family-sans)', color: 'var(--color-text-secondary)', cursor: 'pointer',
                  ...(tab === k ? { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-primary-700)' } : {}),
                }}>{ds.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflow: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={12}/>
            <span>{current.sub}</span>
          </div>
          <DistributionView dist={current.dist} unit="terminals" />
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          <span><Icon name="clock" size={11} style={{ verticalAlign: '-1px', marginRight: 4 }}/>Cached 5 min · fetched 12:34 PM</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" size="sm" icon="download">Export CSV</Btn>
            <Btn variant="secondary" size="sm" icon="rotate">Refresh</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// Normalise weight pairs into a { m, n, pct } distribution that sums to total.
function applyWeights(rows, total) {
  const sum = rows.reduce((a, r) => a + r.w, 0);
  let remaining = total;
  const out = rows.map((r, i) => {
    const n = i === rows.length - 1 ? remaining : Math.round((r.w / sum) * total);
    remaining -= n;
    return { m: r.m, n };
  });
  return out.map((d) => ({ ...d, pct: Math.round((d.n / total) * 100) }));
}

// Build a plausible terminal-count distribution across an app's supported
// device models. Front-loaded — first chip gets the lion's share — so the
// numbers look believable in the preview without real data.
function buildDistribution(devices, total) {
  const full = devices[0] === 'ALL' ? ALL_DEVICE_MODELS : devices;
  const weights = full.map((_, i) => Math.pow(0.6, i) + 0.02);
  return applyWeights(full.map((m, i) => ({ m, w: weights[i] })), total);
}

const PubAppDetailB = () => {
  const app = PUB_APPS[0];
  const [breakdownTab, setBreakdownTab] = useState(null); // null = closed; string = open at that tab
  const open = (tab) => setBreakdownTab(tab);
  const close = () => setBreakdownTab(null);
  return (
    <AppShell
      active="pub"
      crumbs={['Apps', 'Published Apps', app.name]}
      overlay={breakdownTab && <TerminalBreakdownModal app={app} initialTab={breakdownTab} onClose={close} />}>
      <div className="page" style={{ maxWidth: 'unset' }}>
        <DetailHeader app={app} />
        <DetailTabs active="overview" />

        {/* Hero metrics — 2-column main + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Reach panel — lightweight, just denormalised counters.
               Hero number + version mini-metrics are buttons that open the
               TerminalBreakdownModal at the matching tab. The expensive
               aggregations live inside the modal only. */}
            <div className="info-card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
                <button
                  type="button"
                  onClick={() => open('device')}
                  className="reach-hero"
                  style={{ background: 'transparent', border: 0, padding: 0, margin: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Deployed terminals</div>
                  <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 6, lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span className="reach-hero__num" style={{ borderBottom: '2px dashed transparent', transition: 'border-color 0.15s, color 0.15s' }}>{app.terminals.toLocaleString()}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>terminals · {app.subs} ISOs</span>
                  </div>
                  <div className="reach-hero__cta" style={{ fontSize: 11.5, color: 'var(--color-primary-700)', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.7, transition: 'opacity 0.15s' }}>
                    View breakdown <Icon name="chevR" size={9}/>
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 4, fontSize: 12.5 }}>
                  <MiniMetricButton k="v4.3.2" v="86 %" sub="of installs" onClick={() => open('version')} />
                  <MiniMetricButton k="v4.3.1" v="11 %" sub="of installs" onClick={() => open('version')} />
                  <MiniMetricButton k="Older"  v="3 %"  sub="pre-4.3"     onClick={() => open('version')} />
                </div>
              </div>
              <SparkBar terminals={app.terminals} />
              <style>{`
                .reach-hero:hover .reach-hero__num { color: var(--color-primary-700); border-bottom-color: var(--color-primary-700); }
                .reach-hero:hover .reach-hero__cta { opacity: 1; }
                .reach-hero:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 4px; }
              `}</style>
            </div>

            {/* App information — marketing copy + structural metadata.
               App-level, not version-level. Cheap (denormalised). */}
            <InfoCard title="About this app">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-primary)', textWrap: 'pretty' }}>
                  Counter-top point of sale for tipped service — split-tender, gift cards, partial refunds, offline queueing and a built-in receipt-printer driver. Includes the Acme Pay SDK for ISO integrations and a KDS bridge for kitchen displays.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 4, borderTop: '1px solid var(--color-border-subtle)' }}>
                  <InfoRow k="App type" v={<AppTypeChip t={app.type} />} />
                  <InfoRow k="Category" v={<span className="tds-badge tds-badge--neutral">{app.cat}</span>} />
                  <InfoRow k="Payment capability" v={app.payment ? <PaymentChip on /> : <span className="muted">Non-payment</span>} />
                  <InfoRow k="Orientations" v={app.orientations.length ? app.orientations.map((o) => <Badge key={o} tone="neutral">{o[0].toUpperCase() + o.slice(1)}</Badge>) : <span className="muted">Headless</span>} />
                  <InfoRow k="Supported devices" v={<DeviceModels list={app.devices} max={6} />} />
                  <InfoRow k="Locales" v="en-US, en-CA, fr-CA, es-MX" />
                  <InfoRow k="First published" v="Jul 02, 2025" />
                  <InfoRow k="Last updated" v={<><strong>{app.uploaded}</strong> <span className="muted" style={{ fontSize: 12 }}>(v{app.ver})</span></>} />
                </div>
              </div>
            </InfoCard>
          </div>

          {/* Right rail */}
          <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 16 }}>
            <InfoCard title="Publisher">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 10px' }}>
                <CompanyLogo name={app.pub} size={36} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{app.pub}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>acme-sw</div>
                </div>
              </div>
              <InfoRow k="Contract" v={<Badge tone="success">ISV · Active</Badge>} />
              <InfoRow k="Since" v="Jan 14, 2025" />
              <InfoRow k="Contact" v="mira@acme.example" />
              <InfoRow k="Region" v="US · Bay Area" />
            </InfoCard>

            <InfoCard title="Recent activity" action={<a style={{ color: 'var(--color-primary-700)', cursor: 'pointer', fontSize: 12.5 }}>All activity →</a>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                <ActRow when="2 days ago" who="admin@toms" what={<>Marked scan flag <strong>reviewed</strong> for v4.3.2</>} />
                <ActRow when="May 10" who="acme-sw / maya@" what={<>Published <strong>v4.3.2</strong> to all subscribers</>} />
                <ActRow when="Apr 23" who="acme-sw / maya@" what={<>Published <strong>v4.3.1</strong> patch release</>} />
                <ActRow when="Apr 18" who="acme-sw / david@" what={<>Added 2 ISOs to visibility list</>} />
              </div>
            </InfoCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

const MiniMetric = ({ k, v, sub }) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{k}</div>
    <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{v}</div>
    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{sub}</div>
  </div>
);

const ActRow = ({ when, who, what }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-primary-500)', marginTop: 6, flex: 'none' }}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: 'var(--color-text-primary)' }}>{what}</div>
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5, marginTop: 2 }}>{when} · <span style={{ fontFamily: 'var(--font-family-mono)' }}>{who}</span></div>
    </div>
  </div>
);

// Clickable version of MiniMetric — used in the Reach panel hero row.
const MiniMetricButton = ({ k, v, sub, onClick }) => (
  <button type="button" onClick={onClick} className="mini-metric-btn"
    style={{ textAlign: 'right', border: 0, background: 'transparent', cursor: 'pointer',
      padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit', color: 'inherit',
      transition: 'background 0.15s' }}>
    <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{k}</div>
    <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{v}</div>
    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{sub}</div>
    <style>{`.mini-metric-btn:hover { background: var(--color-bg-3); }`}</style>
  </button>
);

// Compact entry tile for the Reach breakdown grid — cheap to render,
// loads the actual aggregation only on click.
const BreakdownShortcut = ({ icon, title, onClick }) => (
  <button type="button" onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)',
      borderRadius: 10, cursor: 'pointer', font: 'inherit', textAlign: 'left',
      transition: 'border-color 0.15s, background 0.15s' }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-500)'; e.currentTarget.style.background = 'var(--color-primary-50, #f5f3ff)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; e.currentTarget.style.background = 'var(--color-bg-3)'; }}>
    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--color-primary-700)' }}>
      <Icon name={icon} size={15}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>Click to load</div>
    </div>
    <Icon name="chevR" size={12} style={{ color: 'var(--color-text-tertiary)' }}/>
  </button>
);

const SparkBar = () => (
  <div style={{ marginTop: 14, display: 'flex', gap: 2, alignItems: 'flex-end', height: 38 }}>
    {[18, 22, 19, 24, 27, 31, 28, 33, 38, 41, 39, 44, 46, 49, 52, 57, 61, 64, 68, 71, 74, 78, 82, 86].map((h, i) => (
      <div key={i} style={{ flex: 1, height: `${h}%`, background: i > 18 ? 'var(--color-primary-700)' : 'oklch(85% 0.05 262)', borderRadius: '2px 2px 0 0' }}/>
    ))}
  </div>
);

// ─── Versions tab (shared between A/B) ─────────────────────────
const PubAppVersionsTab = () => {
  const app = PUB_APPS[0];
  return (
    <AppShell active="pub" crumbs={['Apps', 'Published Apps', app.name]}>
      <div className="page" style={{ maxWidth: 'unset' }}>
        <DetailHeader app={app} />
        <DetailTabs active="versions" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <Input prefix={<Icon name="search" size={14}/>} placeholder="Filter versions…" size="md" />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="seg">
              <button className="seg__btn is-on">All</button>
              <button className="seg__btn">Published</button>
              <button className="seg__btn">Rolled back</button>
            </div>
            <Btn variant="secondary" size="md" icon="download">Export</Btn>
          </div>
        </div>

        <div className="table-card">
          <table className="tds-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Build</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>State</th>
                <th style={{ width: '60px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {VERSIONS_POS.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13.5, fontWeight: 600 }}>{v.name}</span>
                      {v.current && <Badge tone="info">Current</Badge>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 3, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{v.code}</td>
                  <td style={{ fontSize: 12.5 }}>{v.size}</td>
                  <td style={{ fontSize: 12.5 }}>{v.uploaded}</td>
                  <td><StatusChip s={v.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <ActionMenu
                      trigger={<button className="iconbtn"><Icon name="more" size={14}/></button>}
                      items={[
                        { icon: 'download', label: 'Download APK', desc: `${v.size} · build ${v.code}` },
                        { icon: 'info',     label: 'View scan report', desc: <ScanDot v={v.scan} label /> },
                        { icon: 'audit',    label: 'View version audit' },
                        { divider: true },
                        { header: 'Sensitive actions' },
                        ...(v.current
                          ? [{ icon: 'rotate', label: 'Roll back this version…', tone: 'danger',
                              desc: 'Force-uninstall from every terminal on next contact. Notifies all subscribed ISOs urgently.' }]
                          : []),
                        ...(v.status === 'published'
                          ? [{ icon: 'x',     label: 'Unpublish this version', tone: 'warning',
                              desc: 'Stop offering this version for new pulls. Existing installs keep running.' }]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick subscribers preview underneath */}
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Subscribers on this app</h3>
          <div className="table-card">
            <table className="tds-table">
              <thead>
                <tr>
                  <th>ISO tenant</th>
                  <th>Region</th>
                  <th>Approved version</th>
                  <th style={{ textAlign: 'right' }}>Deployed terminals</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {SUBSCRIBERS_POS.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="cust-cell">
                        <CompanyLogo name={s.name} size={28} />
                        <div><div className="cust-name">{s.name}</div><div className="cust-meta">{s.id}</div></div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{s.region}</td>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{s.on}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.deployed}</td>
                    <td>{s.pending ? <Badge tone="warning">Pending approval</Badge> : <Badge tone="success">In sync</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

// ─── System Apps list ──────────────────────────────────────────
const SysAppsList = () => (
  <AppShell active="sys" crumbs={['Apps', 'System Apps']}>
    <div className="page" style={{ maxWidth: 'unset' }}>
      <div className="page__head">
        <div>
          <h1 className="page__title">System Apps</h1>
          <p className="page__sub">Vendor-bundled apps signed with the TOMS system certificate or NPT proprietary key. Pushed to device models as factory preinstall.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="search" size="md">Package lookup</Btn>
          <Btn variant="primary"   icon="plus"   size="md">Register system app</Btn>
        </div>
      </div>

      <div className="stats">
        <button type="button" className="stat is-clickable is-active">
          <div className="stat__label">System apps</div>
          <div className="stat__val">{SYS_APPS.length}</div>
          <div className="stat__delta">{SYS_APPS.filter(a => a.required).length} mandatory</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">SYSTEM-signed</div>
          <div className="stat__val">{SYS_APPS.filter(a => a.signer === 'system').length}</div>
          <div className="stat__delta">platform certificate</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">NPT-signed</div>
          <div className="stat__val">{SYS_APPS.filter(a => a.signer === 'npt').length}</div>
          <div className="stat__delta">NPT proprietary key</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className="stat is-clickable">
          <div className="stat__label">Preinstalled to</div>
          <div className="stat__val">8.4k</div>
          <div className="stat__delta">unique terminals</div>
          <div className="stat__action">Devices <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search by name, package…" size="md" />
        <div className="list-toolbar__filters">
          <div className="seg">
            <button className="seg__btn is-on">All</button>
            <button className="seg__btn">System cert</button>
            <button className="seg__btn">NPT cert</button>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 150 }}>
            <select><option>All device models</option><option>N950</option><option>S90</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select><option>All categories</option><option>System</option><option>Utility</option></select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>App</th>
              <th>Signing</th>
              <th>Target device models</th>
              <th>Preinstall</th>
              <th>Latest</th>
              <th style={{ textAlign: 'right' }}>Terminals</th>
              <th>Scan</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {SYS_APPS.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="cust-cell">
                    <AppIcon name={a.name} pkg={a.pkg} />
                    <div style={{ minWidth: 0 }}>
                      <div className="cust-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.name}
                        <span className="tds-badge tds-badge--neutral" style={{ height: 17, fontSize: 10.5 }}>{a.cat}</span>
                      </div>
                      <div className="cust-meta" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, marginTop: 2 }}>{a.pkg}</div>
                    </div>
                  </div>
                </td>
                <td><SignerChip v={a.signer} /></td>
                <td>{a.models[0] === 'ALL'
                  ? <Badge tone="info">All models</Badge>
                  : <DeviceModels list={a.models} max={4} />}</td>
                <td>
                  {a.required
                    ? <Badge tone="error" dot>Mandatory</Badge>
                    : <Badge tone="neutral">Optional</Badge>}
                </td>
                <td>
                  <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 600 }}>{a.ver}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{a.uploaded}</div>
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.terminals.toLocaleString()}</td>
                <td><ScanDot v={a.scan} label /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn"><Icon name="more" size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--color-info-50)', border: '1px solid oklch(60% 0.14 230 / 0.25)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--color-info-700)' }}>
        <Icon name="info" size={14}/>
        <div>
          <strong>System apps share the global package namespace with ISV apps.</strong> The register form validates against both pools so a system app can't claim a package already owned by an ISV (and vice-versa via Customer Portal).
        </div>
      </div>
    </div>
  </AppShell>
);

// ─── System App register form ──────────────────────────────────
const SysAppRegisterForm = () => (
  <AppShell active="sys" crumbs={['Apps', 'System Apps', 'Register']}>
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="page__head">
        <div>
          <h1 className="page__title">Register system app</h1>
          <p className="page__sub">Create a new system app entry and upload its first APK. Package name uniqueness is validated against the global pool (ISV + system).</p>
        </div>
        <div className="page__actions">
          <Btn variant="ghost" size="md">Cancel</Btn>
          <Btn variant="primary" size="md" icon="check">Register & upload</Btn>
        </div>
      </div>

      <div className="stepper">
        {[
          { n: 1, lbl: 'IDENTITY',     ttl: 'Package & metadata', cur: true,  done: false },
          { n: 2, lbl: 'SIGNING',      ttl: 'Certificate',        cur: false, done: false },
          { n: 3, lbl: 'DISTRIBUTION', ttl: 'Devices & rollout',  cur: false, done: false },
          { n: 4, lbl: 'VERSION',      ttl: 'Upload APK',         cur: false, done: false },
        ].flatMap((s, i, arr) => [
          <div key={`s${s.n}`} className={`stepper__item ${s.cur ? 'is-active' : ''} ${s.done ? 'is-done' : ''}`}>
            <div className="stepper__dot">{s.n}</div>
            <div className="stepper__lbl"><small>{s.lbl}</small><strong>{s.ttl}</strong></div>
          </div>,
          i < arr.length - 1 && <div key={`b${s.n}`} className="stepper__bar" />,
        ])}
      </div>

      <div className="wizard-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Package — live uniqueness */}
          <FormBlock label="Package name" required hint="Reverse-DNS, lower-case. Must be globally unique across ISV + system apps.">
            <div className="tds-input tds-input--md" style={{ borderColor: 'oklch(58% 0.20 25)' }}>
              <span className="tds-input__addon tds-input__addon--prefix" style={{ color: 'var(--color-text-tertiary)' }}>
                <Icon name="package" size={14}/>
              </span>
              <input value="com.acme.pos.pro" readOnly style={{ fontFamily: 'var(--font-family-mono)' }} />
              <span className="tds-input__addon tds-input__addon--suffix" style={{ color: 'var(--color-error-700)' }}>
                <Icon name="x" size={14}/>
              </span>
            </div>
            <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--color-error-50)', border: '1px solid oklch(58% 0.20 25 / 0.22)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5 }}>
              <Icon name="info" size={14} style={{ color: 'var(--color-error-700)', marginTop: 1 }}/>
              <div style={{ color: 'var(--color-error-700)' }}>
                <strong>Package already in use</strong> by ISV app <a style={{ textDecoration: 'underline', cursor: 'pointer' }}>Acme POS Pro</a> (publisher: Acme Software · acme-sw). Pick a different package or coordinate a transfer with the publisher.
              </div>
            </div>
          </FormBlock>

          <FormBlock label="Display name" required>
            <Input size="md" defaultValue="TOMS Maintenance" />
          </FormBlock>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormBlock label="Category" required>
              <div className="tds-select tds-select--md">
                <select defaultValue="System"><option>System</option><option>Utility</option><option>Pre-installed</option></select>
                <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
              </div>
            </FormBlock>
            <FormBlock label="Internal owner" hint="Team responsible inside NPT.">
              <Input size="md" defaultValue="Platform · Device Services" />
            </FormBlock>
          </div>

          <FormBlock label="Description" hint="Shown to internal admins only. Not surfaced in the Customer Portal.">
            <textarea className="textarea" defaultValue="Periodic device maintenance — log rotation, cache cleanup and battery health probes. Mandatory across all production TOMS POS devices."/>
          </FormBlock>

          <FormBlock label="Icon">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <AppIcon name="TOMS Maintenance" pkg="com.npt.maintenance" size={56} radius={12} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" size="sm" icon="upload">Upload PNG…</Btn>
                <Btn variant="ghost" size="sm">Use generated</Btn>
              </div>
            </div>
          </FormBlock>
        </div>

        <aside className="wizard-aside">
          <h4>Step preview</h4>
          <dl>
            <dt>Package</dt>
            <dd style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-error-700)' }}>com.acme.pos.pro</dd>
            <dt>Display</dt><dd>TOMS Maintenance</dd>
            <dt>Category</dt><dd>System</dd>
            <dt>Signer</dt><dd>—</dd>
            <dt>Targets</dt><dd>—</dd>
            <dt>First version</dt><dd>—</dd>
          </dl>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: 4 }}>Why a separate System Apps pool?</strong>
            System apps use the platform certificate or NPT key, are tied to device models as factory preinstall, and bypass the ISO subscription flow — but the package namespace stays global so an ISV can't shadow a system app (and vice-versa).
          </div>
        </aside>
      </div>
    </div>
  </AppShell>
);

const FormBlock = ({ label, required, hint, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--color-error-500)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {hint && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 6 }}>{hint}</div>}
  </div>
);

Object.assign(window, {
  PubAppsListA, PubAppsListB,
  PubAppDetailA, PubAppDetailB,
  PubAppVersionsTab,
  SysAppsList, SysAppRegisterForm,
  DeviceChipPatterns,
  DataModelResponses,
});

// ─── Data-model responses (artboard content) ─────────────────────
function DataModelResponses() {
  return (
    <div style={{ padding: '40px 48px 60px', height: '100%', overflow: 'auto', background: 'var(--color-bg-1)', fontFamily: 'var(--font-family-sans)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Data model</div>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Responses to your data-model questions</h1>
      <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        For each open question you raised on the schema attachment, my recommendation + how it lands in the UI above. “System Apps” in this model is just an app row whose <code>ENTITY_ID</code> belongs to the Admin-contract tenant — same publishing flow as ISV.
      </p>

      <DMSection label="APPLICATIONS">
        <DMRow q="1. 缺失应用介绍信息"
          a={<><strong>Add</strong> <code>description</code> (multi-lang Markdown) and <code>short_tagline</code>. Rendered as the long block at the top of the &lsquo;About this app&rsquo; card.</>} />
        <DMRow q="2. 缺少应用类型元素"
          a={<><strong>Surfaced.</strong> <code>APP TYPE</code> chip (ANDROID / LINUX / RTOS) lives in the detail header + every list row. Filterable in the toolbar.</>} />
        <DMRow q="3. 缺少应用类别信息"
          a={<><strong>New table</strong> <code>APP_CATEGORY (id, name, parent_id, sort)</code> with FK from APPLICATIONS. <code>category_id</code> drives the chip and the &lsquo;Categories’ filter.</>} />
        <DMRow q="4. 是否需要设置应用发布地区"
          a={<><strong>Soft yes.</strong> <code>regions: string[]</code> (ISO 3166 alpha-2). Default <code>["*"]</code>. Drives ISO-side visibility filtering (a US-only app is hidden from EU ISOs). Not required v1 — default to all.</>} />
        <DMRow q="5. 是否显示应用支持参数"
          a={<><strong>Yes.</strong> The header now shows <em>type</em> + <em>payment</em> + <em>visibility</em> + <em>status</em> chips inline. <code>landscape/portrait_support</code> + <code>payment_flag</code> are first-class booleans in the schema.</>} />
        <DMRow q="➕ STATUS = PUBLISHED | UNPUBLISHED | ARCHIVED"
          a={<><strong>Adopted.</strong> StatusChip now renders all three tones. ARCHIVED reads as &lsquo;developer stopped maintaining’; ISO subscribers see a warning but installed terminals keep running.</>} />
      </DMSection>

      <DMSection label="APPLICATION VERSIONS">
        <DMRow q="1. PCI 版本记录"
          a={<><strong>Derive.</strong> Each device model already carries its PCI version; show <code>pci_compliance</code> as a <em>read-only derived</em> column from the version’s supported models. No new manual field.</>} />
        <DMRow q="2. Linux 应用的 GCC 版本"
          a={<><strong>Add</strong> <code>runtime_requirement: JSON</code> — polymorphic per app type. Android: <code>{`{minSdk, targetSdk}`}</code>. Linux: <code>{`{gccVersion, glibcVersion, kernel}`}</code>. RTOS: <code>{`{rtosVersion}`}</code>.</>} />
        <DMRow q="3. 灰度发布"
          a={<><strong>Phase 2.</strong> Don’t add to APPLICATION_VERSIONS — a version is &lsquo;published’ or not. Build canary as a rollout-side concept: <code>ROLLOUT (app_version_id, merchant_whitelist, percentage)</code>.</>} />
        <DMRow q="4. 同步存储 zip 文件"
          a={<><strong>Yes for non-AAB.</strong> Add a second row to APPLICATION_VERSION_FILES with <code>file_type: APK | ZIP | DELTA</code>. Edge CDNs save merchant cellular cost on the zip variant.</>} />
        <DMRow q="5. Release notes 多语言 + 截图"
          a={<><strong>Yes.</strong> Change <code>release_log: TEXT</code> → <code>release_log: JSONB</code> keyed by BCP-47 (<code>en-US</code>, <code>zh-CN</code>…). SCREENSHOTS table: add <code>locale</code> column. Fallback chain en-US → first available.</>} />
        <DMRow q="6. 安卓版本范围"
          a={<><strong>Covered</strong> by <code>runtime_requirement.minSdk / targetSdk</code> for android type. Shown in the version detail drawer (not the list — too noisy).</>} />
      </DMSection>

      <DMSection label="APPLICATION VERSION FILES">
        <DMRow q="1. 文件大小字段"
          a={<><strong>Yes.</strong> <code>size_bytes: BIGINT</code> + denormalised <code>size_display</code> on APPLICATION_VERSIONS for list rendering. Saves a join on the versions table.</>} />
      </DMSection>

      <DMSection label="APPLICATION VERSION SCREENSHOTS">
        <DMRow q="1. 排序字段"
          a={<><strong>Yes.</strong> <code>sort_order: INT NOT NULL</code> — used to render the gallery in the order the publisher arranged. Composite unique on <code>(app_version_id, sort_order)</code>.</>} />
      </DMSection>

      <DMSection label="ENTITY_APP_POOL_APPLICATION_VERSION">
        <DMRow q="1. 增加状态字段"
          a={<><strong>Yes — critical.</strong> Add <code>approval_status: PENDING | APPROVED | REJECTED</code> + <code>approver_id</code> + <code>approved_at</code>. ISO operators see &lsquo;Update available…awaiting approval’ until they review. Matches the App Store flow in the Customer Portal.</>} />
      </DMSection>

      <DMSection label="新增表">
        <DMRow q="APP_CATEGORY"
          a={<>Confirmed — see above.</>} />
        <DMRow q="APP_VERSION_PERMISSION"
          a={<><strong>Yes.</strong> <code>(id, app_version_id, permission, dangerous: bool, explain_md)</code>. Surfaced in the version detail &gt; Permissions tab. Diff-able against previous version.</>} />
        <DMRow q="NOTIFICATION_POLICY"
          a={<><strong>Yes.</strong> Keyed by <code>(entity_id, app_id)</code>. Fields: <code>event_types[]</code> (publish, unpublish, rollback), <code>channels[]</code> (email, in-app, webhook), <code>recipients</code> (operator_ids or role_ids). Drives the publish-notification fan-out to subscribed ISOs.</>} />
      </DMSection>

      <DMSection label="System Apps shared model">
        <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
          System Apps are <strong>structurally identical</strong> to ISV apps in this schema — they live in the same APPLICATIONS / VERSIONS / FILES tables. The only difference is the publisher entity:
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>ISV apps: <code>entity_id</code> → entity with an ISV contract</li>
            <li>System apps: <code>entity_id</code> → entity with the <strong>Admin</strong> contract</li>
          </ul>
          The signing-cert binding (SYSTEM vs NPT) and the device-model-bound &lsquo;factory preinstall’ flag are <em>orthogonal</em> attributes on the version, not a separate table. The System Apps screen reuses the Published Apps register / upload / version flow — only filtering differs.
        </div>
      </DMSection>

      <DMSection label="Next: what I need from you">
        <DMRow q="Region (q4 above)"
          a={<>Confirm v1 default behaviour: ship without region filtering (<code>regions=["*"]</code> always), or wire region selector into the publish step day-1?</>} />
        <DMRow q="Canary rollout (q3 above)"
          a={<>Should &lsquo;Canary’ be a v1 capability or punt to phase 2? It affects the rollout-history table shape.</>} />
        <DMRow q="Notification policy default"
          a={<>If a publisher never configures a NOTIFICATION_POLICY, the platform should still notify subscribers — confirm we hard-default to <code>email + in-app</code> to <code>all-admins</code>.</>} />
      </DMSection>
    </div>
  );
}

function DMSection({ label, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border-default)' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function DMRow({ q, a }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{q}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>{a}</div>
    </div>
  );
}

// ─── Device-chip overflow reference card ────────────────────────
function DeviceChipPatterns() {
  const examples = [
    { title: 'Few · all visible',     sub: '3 – 4 models — every chip rendered.',         devices: ['N950', 'S90', 'S60', 'N750P'] },
    { title: 'Many · first 3 + “+N”', sub: 'Hover the +N pill to see the rest in tooltip.', devices: ['N950', 'S90', 'S60', 'N750P', 'S30', 'X800'] },
    { title: 'All models',            sub: 'list = ["ALL"] OR list.length ≥ catalog.',       devices: ['ALL'] },
  ];
  return (
    <div style={{ padding: '36px 40px', height: '100%', overflow: 'auto', background: 'var(--color-bg-1)', fontFamily: 'var(--font-family-sans)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Pattern</div>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: '4px 0 6px' }}>Device-model chips · overflow</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--color-text-secondary)', maxWidth: 560 }}>
        One component, three states. The cell collapses cleanly even on dense table rows so row height stays consistent. Same component used in list, detail and form previews.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        {examples.map((ex) => (
          <div key={ex.title} style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{ex.sub}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{ex.devices.join(', ')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--color-bg-3)', borderRadius: 8, border: '1px dashed var(--color-border-subtle)' }}>
              <DeviceModels list={ex.devices} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, padding: '14px 16px', background: 'oklch(96% 0.03 230)', border: '1px solid oklch(60% 0.14 230 / 0.25)', borderRadius: 10, fontSize: 12.5, color: 'oklch(35% 0.08 230)', lineHeight: 1.5 }}>
        <strong>Why auto-collapse?</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Table rows stay one line tall → list scans cleanly even at low zoom.</li>
          <li>“All models (N)” carries more information than 8 individual chips squashed together — it tells you the app is portable across the whole catalog at a glance.</li>
          <li>Hovering <code>+3</code> reveals the exact tail. Click anywhere on the row to drill into Detail for the full list as proper chips.</li>
        </ul>
      </div>
    </div>
  );
}
