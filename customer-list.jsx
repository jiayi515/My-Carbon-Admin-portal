/* global React, Btn, Input, Icon, Badge, ContractBadge, CompanyLogo, fmtDate, useToast */
const { useState: useStateCL, useMemo: useMemoCL, useRef: useRefCL, useEffect: useEffectCL } = React;

// Normalize contract status casing — seed data uses UPPERCASE, the wizard
// emits Pascal-case. We compare on uppercase throughout this file.
const _CS = (s) => String(s || '').toUpperCase();

// Customer-level status filter. Status dropdown operates on the underlying
// contract states (Active / Suspended / Terminated, plus derived Expired)
// and the entity status (ONBOARDING = no operators yet). Entity has no
// LOCKED state in the corrected domain model — admins manage access via
// per-contract suspension.
const STATUS_FILTERS = [
  { value: 'All',            label: 'All statuses' },
  { value: 'HAS_ACTIVE',     label: 'With active contract' },
  { value: 'HAS_PILOT',      label: 'In pilot' },
  { value: 'HAS_EXPIRED',    label: 'With expired contract' },
  { value: 'HAS_SUSPENDED',  label: 'With suspended contract' },
  { value: 'ONBOARDING',     label: 'Onboarding' },
  { value: 'ALL_TERMINATED', label: 'All terminated' },
];

const _statusLabel = (v) => STATUS_FILTERS.find(f => f.value === v)?.label || v;

// Fallback FilterChip if merchants-screen hasn't loaded yet.
const _CLFilterChip = ({ label, onRemove }) =>
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '2px 4px 2px 8px', fontSize: 11, borderRadius: 999,
    background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
    border: '1px solid var(--color-primary-200, oklch(85% 0.05 265))'
  }}>
    {label}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        title="Remove this filter"
        style={{
          display: 'grid', placeItems: 'center',
          width: 16, height: 16, padding: 0, borderRadius: 999,
          background: 'transparent', border: 0, cursor: 'pointer',
          color: 'var(--color-primary-700)', opacity: 0.7
        }}>
        <Icon name="x" size={9} />
      </button>
    )}
  </span>;

// Single-select with inline "clear" affordance when value !== 'All'.
const CLFilterSelect = ({ value, onChange, options, width, minWidth }) => {
  const isCleared = value === 'All';
  const style = width ? { width } : { minWidth };
  return (
    <div className="tds-select tds-select--md" style={{ ...style, position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!isCleared ? (
        <button
          type="button"
          title="Clear"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange('All'); }}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 18, height: 18, padding: 0,
            background: 'var(--color-bg-3)', border: 0, borderRadius: 4,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            color: 'var(--color-text-tertiary)', zIndex: 1
          }}>
          <Icon name="x" size={10} />
        </button>
      ) : (
        <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
      )}
    </div>
  );
};

// ─── CSV export helpers (mirror merchants-screen) ───────────
const _csvCell = (v) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const _csvRow = (cells) => cells.map(_csvCell).join(',');
const _today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
function exportCustomersCsv(rows, filename) {
  const header = ['Customer', 'Entity status', 'Registered', 'Address', 'License', 'Live contracts'];
  const lines = [_csvRow(header)];
  rows.forEach((c) => {
    const live = (c.contracts || []).filter(k => _CS(k.status) !== 'TERMINATED');
    const liveDesc = live.map(k => `${k.kind}:${window.effectiveStatus ? window.effectiveStatus(k) : k.status}`);
    const es = window.entityStatus ? window.entityStatus(c) : '';
    lines.push(_csvRow([c.name, es, c.registeredAt, c.address || '', c.license || '', liveDesc]));
  });
  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Export menu — same shape as merchants-screen's ExportMenu ──
const CLExportMenu = ({ pageRows, filtered }) => {
  const [open, setOpen] = useStateCL(false);
  const ref = useRefCL(null);
  const toast = useToast();
  const disabled = filtered.length === 0;
  const sameScope = pageRows.length === filtered.length;

  useEffectCL(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const run = (scope) => {
    const rows = scope === 'page' ? pageRows : filtered;
    if (rows.length === 0) { setOpen(false); return; }
    const fname = scope === 'page'
      ? `customers_view_${_today()}.csv`
      : `customers_results_${_today()}.csv`;
    exportCustomersCsv(rows, fname);
    toast({
      kind: 'success',
      title: 'Export downloaded',
      desc: `${rows.length.toLocaleString()} customer${rows.length === 1 ? '' : 's'} · ${fname}`
    });
    setOpen(false);
  };

  if (disabled) {
    return <Btn variant="ghost" icon="download" size="sm" disabled title="No customers in the current view">Export</Btn>;
  }
  if (sameScope) {
    return (
      <Btn variant="ghost" icon="download" size="sm"
        title={`Export ${filtered.length} customer${filtered.length === 1 ? '' : 's'} as CSV`}
        onClick={() => run('results')}>
        Export
      </Btn>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Btn variant="ghost" icon="download" size="sm" onClick={() => setOpen(o => !o)}>
        Export
        <Icon name="chevD" size={10} style={{ marginLeft: 4, opacity: 0.7 }} />
      </Btn>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
          minWidth: 260,
          background: 'var(--color-bg-2)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-3, 0 8px 24px rgba(0,0,0,0.10))',
          padding: 6
        }}>
          <CLExportMenuItem
            primary="Export current view"
            secondary={`${pageRows.length} customer${pageRows.length === 1 ? '' : 's'} on this page · CSV`}
            onClick={() => run('page')} />
          <CLExportMenuItem
            primary="Export search results"
            secondary={`${filtered.length} customer${filtered.length === 1 ? '' : 's'} across all pages · CSV`}
            onClick={() => run('results')} />
          <div style={{
            padding: '8px 10px 4px', marginTop: 4,
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: 10.5, color: 'var(--color-text-tertiary)'
          }}>
            UTF-8 CSV · opens in Excel / Sheets
          </div>
        </div>
      )}
    </div>
  );
};

const CLExportMenuItem = ({ primary, secondary, onClick }) =>
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%', textAlign: 'left',
      padding: '8px 10px', borderRadius: 6, border: 0,
      background: 'transparent', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 2
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{primary}</span>
    <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{secondary}</span>
  </button>;


const CustomerList = ({ customers, onOpen, onNew }) => {
  // ── Applied (committed) vs Draft filter state ──
  const [applied, setApplied] = useStateCL({ q: '', status: 'All', contract: 'All' });
  const [draft, setDraft]     = useStateCL({ q: '', status: 'All', contract: 'All' });

  const [sortBy, setSortBy] = useStateCL('registeredAt');
  const [sortDir, setSortDir] = useStateCL('desc');

  // ── Pagination (merchants pattern) ──
  const [pageSize, setPageSize] = useStateCL(25);
  const [page, setPage] = useStateCL(1);

  // ── Sticky band measurement ──
  const toolbarRef = useRefCL(null);
  const cardHeadRef = useRefCL(null);
  const [toolbarH, setToolbarH] = useStateCL(0);
  const [cardHeadH, setCardHeadH] = useStateCL(0);

  const FilterChip = window.MerchantsFilterChip || _CLFilterChip;
  const PaginationBar = window.MerchantsPaginationBar;

  const filtered = useMemoCL(() => {
    let rows = customers;
    if (applied.q.trim()) {
      const s = applied.q.toLowerCase();
      rows = rows.filter(c => c.name.toLowerCase().includes(s) || (c.address || '').toLowerCase().includes(s) || (c.license || '').toLowerCase().includes(s));
    }
    if (applied.contract !== 'All') rows = rows.filter(c => c.contracts.some(k => k.kind === applied.contract && window.effectiveStatus(k) !== 'TERMINATED'));
    if (applied.status !== 'All') {
      rows = rows.filter(c => {
        const live = c.contracts.filter(k => {
          const eff = window.effectiveStatus(k);
          return eff !== 'TERMINATED' && eff !== 'EXPIRED';
        });
        switch (applied.status) {
          case 'HAS_ACTIVE':     return window.entityStatus(c) === 'ACTIVE';
          case 'HAS_PILOT':      return c.contracts.some(k => window.effectiveStatus(k) === 'PILOT');
          case 'HAS_EXPIRED':    return c.contracts.some(k => window.effectiveStatus(k) === 'EXPIRED');
          case 'HAS_SUSPENDED':  return live.some(k => _CS(k.status) === 'SUSPENDED');
          case 'ONBOARDING':     return window.entityStatus(c) === 'ONBOARDING';
          case 'ALL_TERMINATED': return c.contracts.length > 0 && c.contracts.every(k => _CS(k.status) === 'TERMINATED');
          default: return true;
        }
      });
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const r = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
    return rows;
  }, [customers, applied, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffectCL(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const hasFilters = !!applied.q || applied.status !== 'All' || applied.contract !== 'All';

  useEffectCL(() => {
    const measure = () => {
      setToolbarH(toolbarRef.current?.offsetHeight || 0);
      setCardHeadH(cardHeadRef.current?.offsetHeight || 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [hasFilters, filtered.length]);

  const runSearch = () => { setApplied({ ...draft }); setPage(1); };
  const clearAll = () => {
    const blank = { q: '', status: 'All', contract: 'All' };
    setDraft(blank); setApplied(blank); setPage(1);
  };
  const onKey = (e) => { if (e.key === 'Enter') runSearch(); };

  // Stat-tile click — sets BOTH draft & applied so the stat behaves as a
  // one-tap status filter without requiring the user to hit Search after.
  const setStatusImmediate = (next) => {
    setDraft(d => ({ ...d, status: next }));
    setApplied(a => ({ ...a, status: next }));
    setPage(1);
  };

  const sortCell = (key, label) => (
    <span className="tds-table__sort" onClick={() => {
      if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortBy(key); setSortDir('asc'); }
    }}>
      {label}
      <span style={{ opacity: sortBy === key ? 1 : 0.3, fontSize: 9 }}>{sortBy === key && sortDir === 'asc' ? '▲' : '▼'}</span>
    </span>
  );

  const activeCount     = customers.filter(c => window.entityStatus(c) === 'ACTIVE').length;
  const onboardingCount = customers.filter(c => window.entityStatus(c) === 'ONBOARDING').length;
  const allClear        = !hasFilters;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Customers</h1>
          <p className="page__sub">Maintain customer companies, their contracts and operators.</p>
        </div>
        <div className="page__actions">
          <Btn variant="primary" icon="plus" size="md" onClick={onNew}>New customer</Btn>
        </div>
      </div>

      {/* Stats — kept per request. Tiles act as one-tap status filters. */}
      <div className="stats">
        <button type="button"
          className={`stat is-clickable ${allClear ? 'is-active' : ''}`}
          onClick={clearAll}>
          <div className="stat__label">Total customers</div>
          <div className="stat__val">{customers.length}</div>
          <div className="stat__delta stat__delta--up">↑ 2 this week</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button"
          className={`stat is-clickable ${applied.status === 'HAS_ACTIVE' ? 'is-active' : ''}`}
          onClick={() => setStatusImmediate(applied.status === 'HAS_ACTIVE' ? 'All' : 'HAS_ACTIVE')}>
          <div className="stat__label">With active contract</div>
          <div className="stat__val">{activeCount}</div>
          <div className="stat__delta">{customers.length ? Math.round(activeCount / customers.length * 100) : 0}% of total</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button"
          className={`stat is-clickable ${applied.status === 'ONBOARDING' ? 'is-active' : ''}`}
          onClick={() => setStatusImmediate(applied.status === 'ONBOARDING' ? 'All' : 'ONBOARDING')}>
          <div className="stat__label">Onboarding</div>
          <div className="stat__val">{onboardingCount}</div>
          <div className="stat__delta">setup in progress</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      {/* Sticky condition area — toolbar + active-filter chips */}
      <div
        ref={toolbarRef}
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'var(--color-bg-1)',
          paddingTop: 4, paddingBottom: 14,
          borderBottom: '1px solid var(--color-border-subtle)',
          boxShadow: '0 4px 6px -6px oklch(0% 0 0 / 0.15)', borderWidth: '0px'
        }}>
        <div className="list-toolbar" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 0 }}>
          {/* Search input — Enter commits */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: 320, height: 36,
            padding: '0 10px', borderRadius: 7,
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-border-default)'
          }}>
            <Icon name="search" size={13} style={{ color: 'var(--color-text-tertiary)', flex: 'none' }} />
            <input
              value={draft.q}
              onChange={(e) => setDraft(d => ({ ...d, q: e.target.value }))}
              onKeyDown={onKey}
              placeholder="Search by name, address, license"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0,
                border: 0, background: 'transparent', outline: 'none',
                fontSize: 13, color: 'var(--color-text-primary)'
              }} />
            {draft.q && (
              <button
                type="button"
                title="Clear"
                onMouseDown={(e) => { e.preventDefault(); setDraft(d => ({ ...d, q: '' })); }}
                style={{
                  display: 'grid', placeItems: 'center',
                  width: 16, height: 16, padding: 0, borderRadius: 4,
                  background: 'transparent', border: 0, cursor: 'pointer',
                  color: 'var(--color-text-tertiary)', flex: 'none'
                }}>
                <Icon name="x" size={10} />
              </button>
            )}
            <span style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: 10, fontWeight: 500,
              padding: '1px 5px', borderRadius: 4,
              background: 'var(--color-bg-3)', color: 'var(--color-text-tertiary)',
              border: '1px solid var(--color-border-subtle)',
              letterSpacing: '0.02em', flex: 'none'
            }}>Enter</span>
          </div>

          {/* Filter group */}
          <div className="list-toolbar__filters" style={{ gap: 8 }}>
            <CLFilterSelect
              width={150}
              value={draft.contract}
              onChange={(v) => setDraft(d => ({ ...d, contract: v }))}
              options={[
                { value: 'All', label: 'All contracts' },
                { value: 'ISV', label: 'ISV' },
                { value: 'ISO', label: 'ISO' },
                { value: 'Merchant', label: 'Merchant' }
              ]} />
            <CLFilterSelect
              width={240}
              value={draft.status}
              onChange={(v) => setDraft(d => ({ ...d, status: v }))}
              options={STATUS_FILTERS.map(f => ({ value: f.value, label: f.label }))} />
          </div>

          <Btn variant="secondary" icon="search" size="md" onClick={runSearch}>Search</Btn>
        </div>

        {hasFilters && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            marginTop: 10, marginBottom: 0,
            fontSize: 12, color: 'var(--color-text-secondary)'
          }}>
            <span className="overline" style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--color-text-tertiary)'
            }}>Active filters:</span>
            {applied.q && <FilterChip label={`Search: ${applied.q}`} onRemove={() => { setApplied(a => ({ ...a, q: '' })); setDraft(d => ({ ...d, q: '' })); setPage(1); }} />}
            {applied.contract !== 'All' && <FilterChip label={`Contract: ${applied.contract}`} onRemove={() => { setApplied(a => ({ ...a, contract: 'All' })); setDraft(d => ({ ...d, contract: 'All' })); setPage(1); }} />}
            {applied.status !== 'All' && <FilterChip label={`Status: ${_statusLabel(applied.status)}`} onRemove={() => { setApplied(a => ({ ...a, status: 'All' })); setDraft(d => ({ ...d, status: 'All' })); setPage(1); }} />}
            <button
              type="button"
              onClick={clearAll}
              style={{
                background: 'transparent', border: 0, padding: '2px 4px',
                color: 'var(--color-text-tertiary)', fontSize: 12,
                cursor: 'pointer', textDecoration: 'underline',
                textUnderlineOffset: 2, textDecorationStyle: 'dotted'
              }}>
              Clear all
            </button>
          </div>
        )}
      </div>{/* /sticky condition area */}

      <div className="table-card" style={{ overflow: 'visible' }}>
        <div
          ref={cardHeadRef}
          style={{
            position: 'sticky',
            top: toolbarH,
            zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px 10px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-2)',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            fontSize: 12, color: 'var(--color-text-secondary)'
          }}>
          <span>
            <strong style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{filtered.length.toLocaleString()}</strong>
            {' '}customer{filtered.length === 1 ? '' : 's'}
            {hasFilters && <span style={{ marginLeft: 6 }}>matching filters</span>}
          </span>
          <div style={{ flex: 1 }} />
          <CLExportMenu pageRows={pageRows} filtered={filtered} />
        </div>
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '32%', top: toolbarH + cardHeadH }}>{sortCell('name', 'Customer')}</th>
              <th style={{ width: '13%', top: toolbarH + cardHeadH }}>Status</th>
              <th style={{ width: '16%', top: toolbarH + cardHeadH }}>{sortCell('registeredAt', 'Registered')}</th>
              <th style={{ top: toolbarH + cardHeadH }}>Contracts</th>
              <th style={{ width: 60, textAlign: 'right', top: toolbarH + cardHeadH }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="5">
                <div className="empty" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  {hasFilters ? 'No customers match your search.' : 'No customers yet.'}
                </div>
              </td></tr>
            ) : pageRows.map(c => {
              const liveContracts = c.contracts.filter(k => _CS(k.status) !== 'TERMINATED');
              return (
                <tr key={c.id} onClick={() => onOpen(c.id)}>
                  <td>
                    <div className="cust-cell">
                      <CompanyLogo name={c.name}/>
                      <div>
                        <div className="cust-name">{c.name}</div>
                        <div className="cust-meta">{c.address.split(',').slice(-2).join(',').trim()}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const es = window.entityStatus(c);
                      const meta = window.entityStatusMeta(es);
                      const live = c.contracts.filter(k => window.effectiveStatus(k) !== 'TERMINATED');
                      const allPilot = live.length > 0 && live.every(k => {
                        const eff = window.effectiveStatus(k);
                        return eff === 'PILOT' || (eff === 'EXPIRED' && String(k.status).toUpperCase() === 'PILOT');
                      });
                      return (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <Badge tone={meta.tone} dot>{meta.label}</Badge>
                          {allPilot && (
                            <span
                              className="tds-badge tds-badge--pilot"
                              style={{ fontSize: 10.5 }}
                              title="All live contracts are PILOT — trial-to-active candidate">
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>
                              Pilot
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div style={{ fontSize: 13.5 }}>{fmtDate(c.registeredAt)}</div>
                  </td>
                  <td>
                    <div className="badge-row">
                      {liveContracts.length === 0 ? (
                        <span className="muted" style={{ fontSize: 12.5 }} title="No live contracts">—</span>
                      ) : liveContracts.map((k, i) => (
                        <ContractBadge
                          key={i}
                          kind={k.kind}
                          status={k.status}
                          effectiveFrom={k.effectiveFrom}
                          effectiveTo={k.effectiveTo}
                          terminatedAt={k.terminatedAt}
                        />
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>
                      <Icon name="chevR" size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {PaginationBar && (
          <PaginationBar
            total={filtered.length}
            totalUnfiltered={customers.length}
            pageStart={pageStart}
            pageEnd={pageEnd}
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize} />
        )}
      </div>
    </div>
  );
};

window.CustomerList = CustomerList;
