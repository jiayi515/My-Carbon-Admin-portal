/* global React, Icon */
const { useState, useMemo, useEffect, useRef } = React;

const ROUTE_ITEMS = [
  { id: 'list',           title: 'Customers',                 sub: 'View all customers',          icon: 'users' },
  { id: 'orders',         title: 'Orders',                    sub: 'View all orders',             icon: 'package' },
  { id: 'new',            title: 'New customer',              sub: 'Start onboarding flow',       icon: 'plus' },
  { id: 'order-new',      title: 'New order',                 sub: 'Create a hardware order',     icon: 'plus' },
  { id: 'customer-roles', title: 'Customer Role Definitions', sub: 'Tenant-side roles by contract', icon: 'shield' },
  { id: 'admin-roles',    title: 'Roles',                     sub: 'Carbon platform roles',       icon: 'shield' },
  { id: 'admin-users',    title: 'Users',                     sub: 'Carbon platform staff',       icon: 'users' },
];

const CommandPalette = ({ customers, orders, onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = (txt) => !s || (txt || '').toLowerCase().includes(s);

    const custMatches = customers
      .filter((c) => match(c.name) || match(c.legalName) || match(c.id))
      .slice(0, 6)
      .map((c) => ({ kind: 'customer', id: c.id, title: c.name, sub: `${c.contracts.length} contract${c.contracts.length === 1 ? '' : 's'} · ${c.operators.length} operator${c.operators.length === 1 ? '' : 's'}`, icon: 'users' }));

    const orderMatches = orders
      .filter((o) => match(o.number) || match(o.customerName) || match(o.status))
      .slice(0, 6)
      .map((o) => ({ kind: 'order', id: o.id, title: o.number, sub: `${o.customerName} · ${o.status}`, icon: 'package' }));

    const opMatches = [];
    if (s) {
      customers.forEach((c) => {
        c.operators.forEach((op) => {
          if (match(op.name) || match(op.email)) {
            opMatches.push({ kind: 'customer', id: c.id, title: op.name || op.email, sub: `Operator · ${c.name}`, icon: 'operator' });
          }
        });
      });
    }

    const routes = ROUTE_ITEMS
      .filter((r) => match(r.title) || match(r.sub))
      .map((r) => ({ kind: 'route', id: r.id, title: r.title, sub: r.sub, icon: r.icon }));

    const g = [];
    if (custMatches.length) g.push({ label: 'Customers', items: custMatches });
    if (orderMatches.length) g.push({ label: 'Orders', items: orderMatches });
    if (opMatches.length) g.push({ label: 'Operators', items: opMatches.slice(0, 6) });
    if (routes.length) g.push({ label: 'Navigate', items: routes });
    return g;
  }, [q, customers, orders]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => { setActive(0); }, [q]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = flat[active]; if (it) onPick(it.kind, it.id); }
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk__head">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            className="cmdk__input"
            placeholder="Search customers, orders, operators…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd style={{ font: '500 10px/1 var(--font-family-mono)', background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 3, padding: '2px 5px', color: 'var(--color-text-tertiary)' }}>esc</kbd>
        </div>
        <div className="cmdk__body">
          {flat.length === 0 ? (
            <div className="cmdk__empty">No results for "{q}"</div>
          ) : (
            groups.map((g, gi) => {
              let offset = 0;
              for (let i = 0; i < gi; i++) offset += groups[i].items.length;
              return (
                <div key={g.label} className="cmdk__group">
                  <div className="cmdk__grouplabel">{g.label}</div>
                  {g.items.map((it, ii) => {
                    const idx = offset + ii;
                    return (
                      <div
                        key={`${it.kind}-${it.id}-${ii}`}
                        className={`cmdk__item ${idx === active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => onPick(it.kind, it.id)}
                      >
                        <div className="cmdk__item-icon"><Icon name={it.icon} size={14}/></div>
                        <div className="cmdk__item-text">
                          <div className="cmdk__item-title">{it.title}</div>
                          <div className="cmdk__item-sub">{it.sub}</div>
                        </div>
                        <Icon name="chevR" size={12} style={{ color: 'var(--color-text-tertiary)' }}/>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

window.CommandPalette = CommandPalette;
