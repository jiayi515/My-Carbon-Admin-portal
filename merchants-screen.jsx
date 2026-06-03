/* global React, Btn, Input, Icon, Badge, useToast */
// ─────────────────────────────────────────────────────────────
// Top-level Merchants module — promoted from "Customer → ISO →
// Merchants tab" to a standalone sidebar item, placed right after
// Customers.
//
// Differences from the in-customer tab (customer-merchants.jsx):
//   · Lists ALL merchants across every ISO (not scoped to one)
//   · Columns: Merchant · Country · ISO (owning customer) · Tags
//     (no stores / terminals counts)
//   · Filters: ISO single-select · Tags multi-select · name fuzzy
//     search via explicit Search button (no live filtering, no
//     autocomplete suggestions)
//   · No KPI / stats cards
// The drill-in detail view reuses MerchantViewReadonly so behavior
// is identical to the customer-side view.
// ─────────────────────────────────────────────────────────────
const { useState: useStateMS, useMemo: useMemoMS, useRef: useRefMS, useEffect: useEffectMS } = React;

// ─── ISO lookup ────────────────────────────────────────────
// Map c-XXX → ISO customer name. SEED_CUSTOMERS holds all customers;
// only those with an ISO contract are valid owners. We don't filter
// here — merchants only carry isoIds that already are ISOs by seed.
const useIsoIndex = () => useMemoMS(() => {
  const customers = window.SEED_CUSTOMERS || [];
  const index = new Map();
  customers.forEach((c) => index.set(c.id, c));
  return index;
}, []);


// ─── CSV export helpers ────────────────────────────────────
// RFC 4180-ish: wrap any cell with comma / quote / newline in quotes,
// double-up any embedded quotes. Cell may be string, number, array.
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
// Trigger a CSV download. `rows` is an array of merchant objects; we
// flatten the same columns the table shows plus a couple of useful
// extras (MID, ISO id) so the file is actually useful for follow-up.
function exportMerchantsCsv(rows, isoIndex, filename) {
  const header = ['Merchant', 'MID', 'Country', 'Owning ISO', 'ISO ID', 'Tags'];
  const lines = [_csvRow(header)];
  rows.forEach((m) => {
    const isoName = m.isoId ? isoIndex.get(m.isoId)?.name || m.isoId : '';
    lines.push(_csvRow([m.name, m.mid || '', m.country || '', isoName, m.isoId || '', m.tags || []]));
  });
  const csv = '\ufeff' + lines.join('\r\n'); // BOM so Excel reads UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;a.download = filename;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


// ─── Export menu ─ two scopes, both respecting the current filter:
//   · Current view  ─ only the rows the user can see on this page
//   · Search results ─ all rows matching the active filter (across pages)
// Disabled entirely when there are no matching rows.
const ExportMenu = ({ pageRows, filtered, isoIndex }) => {
  const [open, setOpen] = useStateMS(false);
  const ref = useRefMS(null);
  const toast = useToast();
  const disabled = filtered.length === 0;
  // When the page slice equals the full result set, the two options would
  // be identical — collapse to a single action in that case.
  const sameScope = pageRows.length === filtered.length;

  useEffectMS(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const run = (scope) => {
    const rows = scope === 'page' ? pageRows : filtered;
    if (rows.length === 0) {setOpen(false);return;}
    const fname = scope === 'page' ?
    `merchants_view_${_today()}.csv` :
    `merchants_results_${_today()}.csv`;
    exportMerchantsCsv(rows, isoIndex, fname);
    toast({
      kind: 'success',
      title: 'Export downloaded',
      desc: `${rows.length.toLocaleString()} merchant${rows.length === 1 ? '' : 's'} · ${fname}`
    });
    setOpen(false);
  };

  // No data → single inert button (no menu, no chevron).
  if (disabled) {
    return (
      <Btn
        variant="ghost"
        icon="download"
        size="sm"
        disabled
        title="No merchants in the current view">
        Export
      </Btn>);

  }

  // Single-action shortcut when page == full result.
  if (sameScope) {
    return (
      <Btn
        variant="ghost"
        icon="download"
        size="sm"
        title={`Export ${filtered.length} merchant${filtered.length === 1 ? '' : 's'} as CSV`}
        onClick={() => run('results')}>
        Export
      </Btn>);

  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Btn variant="ghost" icon="download" size="sm" onClick={() => setOpen((o) => !o)}>
        Export
        <Icon name="chevD" size={10} style={{ marginLeft: 4, opacity: 0.7 }} />
      </Btn>
      {open &&
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
        minWidth: 260,
        background: 'var(--color-bg-2)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-3, 0 8px 24px rgba(0,0,0,0.10))',
        padding: 6
      }}>
          <ExportMenuItem
          primary="Export current view"
          secondary={`${pageRows.length} merchant${pageRows.length === 1 ? '' : 's'} on this page · CSV`}
          onClick={() => run('page')} />
          <ExportMenuItem
          primary="Export search results"
          secondary={`${filtered.length} merchant${filtered.length === 1 ? '' : 's'} across all pages · CSV`}
          onClick={() => run('results')} />
          <div style={{
          padding: '8px 10px 4px', marginTop: 4,
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 10.5, color: 'var(--color-text-tertiary)'
        }}>
            UTF-8 CSV · opens in Excel / Sheets
          </div>
        </div>
      }
    </div>);

};

const ExportMenuItem = ({ primary, secondary, onClick }) =>
<button
  type="button"
  onClick={onClick}
  style={{
    width: '100%', textAlign: 'left',
    padding: '8px 10px', borderRadius: 6, border: 0,
    background: 'transparent', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 2
  }}
  onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--color-bg-hover)';}}
  onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';}}>
    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{primary}</span>
    <span style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{secondary}</span>
  </button>;




// ─── Multi-select tags dropdown ────────────────────────────
const TagsMultiSelect = ({ allTags, value, onChange }) => {
  const [open, setOpen] = useStateMS(false);
  const ref = useRefMS(null);
  useEffectMS(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (t) => {
    if (value.includes(t)) onChange(value.filter((x) => x !== t));else
    onChange([...value, t]);
  };
  const summary = value.length === 0 ?
  'All tags' :
  value.length === 1 ?
  value[0] :
  `${value.length} tags`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tds-select tds-select--md"
        style={{
          width: 180, padding: '0 10px', height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-bg-2)', cursor: 'pointer',
          border: '1px solid var(--color-border-default)', borderRadius: 8,
          fontSize: 13, color: value.length > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        {value.length > 0 ?
        <span
          role="button"
          title="Clear tags"
          onMouseDown={(e) => {e.preventDefault();e.stopPropagation();onChange([]);}}
          style={{
            display: 'grid', placeItems: 'center', width: 16, height: 16,
            borderRadius: 4, color: 'var(--color-text-tertiary)', cursor: 'pointer',
            marginLeft: 6, flex: 'none'
          }}
          onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--color-bg-hover)';e.currentTarget.style.color = 'var(--color-text-primary)';}}
          onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';e.currentTarget.style.color = 'var(--color-text-tertiary)';}}>
            <Icon name="x" size={10} />
          </span> :

        <Icon name="chevD" size={14} />
        }
      </button>
      {open &&
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
        minWidth: 220, maxHeight: 320, overflowY: 'auto',
        background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
        borderRadius: 10, boxShadow: 'var(--shadow-3, 0 8px 24px rgba(0,0,0,0.10))',
        padding: 6
      }}>
          {value.length > 0 &&
        <button
          type="button"
          onClick={() => onChange([])}
          style={{
            width: '100%', textAlign: 'left',
            padding: '7px 10px', borderRadius: 6, border: 0,
            background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: 'var(--color-text-tertiary)'
          }}>
              Clear selection
            </button>
        }
          {allTags.map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 6, border: 0,
                background: on ? 'var(--color-primary-50)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {if (!on) e.currentTarget.style.background = 'var(--color-bg-hover)';}}
              onMouseLeave={(e) => {if (!on) e.currentTarget.style.background = 'transparent';}}>
                <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: '1px solid ' + (on ? 'var(--color-primary-500)' : 'var(--color-border-default)'),
                background: on ? 'var(--color-primary-500)' : 'var(--color-bg-2)',
                display: 'grid', placeItems: 'center', color: '#fff', flex: 'none'
              }}>
                  {on && <Icon name="check" size={10} />}
                </span>
                <span>{t}</span>
              </button>);

        })}
        </div>
      }
    </div>);

};


// ─── Merchants list (top-level screen) ─────────────────────
// ─── Pager window helper (devices pattern) ─────────────────
// Returns an array like [1, '...', 4, 5, 6, '...', 12] given the current
// page and total page count. Always includes first/last and current±2.
function _pagerWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('...');
    out.push(sorted[i]);
  }
  return out;
}

const PagerBtn = ({ active, disabled, onClick, title, children }) =>
<button
  type="button"
  onClick={onClick}
  disabled={disabled}
  title={title}
  style={{
    minWidth: 28, height: 28, padding: '0 8px', border: 0, borderRadius: 6,
    background: active ? 'var(--color-primary-700)' : 'transparent',
    color: active ? '#fff' : disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
    fontSize: 12, fontWeight: active ? 600 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit'
  }}
  onMouseEnter={(e) => {if (!active && !disabled) e.currentTarget.style.background = 'var(--color-bg-hover)';}}
  onMouseLeave={(e) => {if (!active && !disabled) e.currentTarget.style.background = 'transparent';}}>
    {children}
  </button>;


const DoubleChev = ({ dir }) =>
<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'left' ?
  <path d="M11 18l-6-6 6-6M18 18l-6-6 6-6" /> :
  <path d="M13 18l6-6-6-6M6 18l6-6-6-6" />}
  </svg>;


const PaginationBar = ({ total, totalUnfiltered, pageStart, pageEnd, page, totalPages, pageSize, setPage, setPageSize }) => {
  const [goTo, setGoTo] = useStateMS('');
  const isFiltered = total !== totalUnfiltered;
  const pages = _pagerWindow(page, totalPages);

  const goToPage = () => {
    const n = parseInt(goTo, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      setPage(n);
      setGoTo('');
    }
  };

  const numStyle = { fontFamily: 'var(--font-family-mono)', fontWeight: 500 };
  const inputStyle = {
    height: 26, padding: '0 8px', fontSize: 12,
    border: '1px solid var(--color-border-default)', borderRadius: 6,
    background: 'var(--color-bg-2)', color: 'var(--color-text-primary)',
    outline: 'none'
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderTop: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-2)',
      flexWrap: 'wrap',
      borderBottomLeftRadius: 12, borderBottomRightRadius: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => {setPageSize(+e.target.value);setPage(1);}}
          style={{ ...inputStyle, height: 26, paddingRight: 22, fontFamily: 'inherit' }}>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Showing{' '}
        <span style={numStyle}>{total === 0 ? 0 : pageStart + 1}</span>
        –<span style={numStyle}>{pageEnd}</span>
        {' '}of <strong style={numStyle}>{total.toLocaleString()}</strong>
      </div>

      <div style={{ flex: 1 }} />

      {/* Pager */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <PagerBtn disabled={page === 1} onClick={() => setPage(1)} title="First"><DoubleChev dir="left" /></PagerBtn>
        <PagerBtn disabled={page === 1} onClick={() => setPage(page - 1)} title="Previous"><Icon name="chevL" size={11} /></PagerBtn>
        {pages.map((p, i) =>
        p === '...' ?
        <span key={`e${i}`} style={{ padding: '0 6px', color: 'var(--color-text-tertiary)', fontSize: 12 }}>…</span> :
        <PagerBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PagerBtn>
        )}
        <PagerBtn disabled={page === totalPages} onClick={() => setPage(page + 1)} title="Next"><Icon name="chevR" size={11} /></PagerBtn>
        <PagerBtn disabled={page === totalPages} onClick={() => setPage(totalPages)} title="Last"><DoubleChev dir="right" /></PagerBtn>
      </div>

      {/* Go to */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingLeft: 12, borderLeft: '1px solid var(--color-border-subtle)',
        fontSize: 12, color: 'var(--color-text-secondary)'
      }}>
        <span>Go to</span>
        <input
          value={goTo}
          onChange={(e) => setGoTo(e.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(e) => {if (e.key === 'Enter') goToPage();}}
          placeholder={String(page)}
          style={{ ...inputStyle, width: 56, fontFamily: 'var(--font-family-mono)' }} />
        <Btn variant="secondary" size="sm" onClick={goToPage}>Go</Btn>
      </div>
    </div>);

};


const MerchantsListScreen = ({ onOpen }) => {
  const merchants = window.MERCHANTS || [];
  const isoIndex = useIsoIndex();

  // ─── Applied (committed) filter state — only updated on Search ───
  const [applied, setApplied] = useStateMS({ q: '', isoId: 'All', tags: [] });

  // ─── Pagination state (devices pattern) ────────────────────
  const [pageSize, setPageSize] = useStateMS(25);
  const [page, setPage] = useStateMS(1);

  // ─── Sticky stack measurement (devices pattern) ──────────────
  // Toolbar (search + filters + chip row) and table-card header strip
  // (Showing N + Export) both stay pinned to the scroll viewport when
  // the user scrolls. thead pins just below them. We measure each band's
  // height so the next layer's `top` lines up exactly.
  const toolbarRef = useRefMS(null);
  const cardHeadRef = useRefMS(null);
  const [toolbarH, setToolbarH] = useStateMS(0);
  const [cardHeadH, setCardHeadH] = useStateMS(0);

  // ─── Draft state — what the toolbar inputs hold right now ──
  const [draft, setDraft] = useStateMS({ q: '', isoId: 'All', tags: [] });

  // All ISOs that actually own at least one merchant. We derive from the
  // merchant list rather than SEED_CUSTOMERS so the dropdown only ever
  // offers options that will return results.
  const isoOptions = useMemoMS(() => {
    const ids = new Set();
    merchants.forEach((m) => {if (m.isoId) ids.add(m.isoId);});
    return [...ids].
    map((id) => ({ id, name: isoIndex.get(id)?.name || id })).
    sort((a, b) => a.name.localeCompare(b.name));
  }, [merchants, isoIndex]);

  // All distinct tags across all merchants.
  const allTags = useMemoMS(() => {
    const s = new Set();
    merchants.forEach((m) => (m.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [merchants]);

  // Filter rows using the APPLIED (committed) state.
  const filtered = useMemoMS(() => {
    return merchants.filter((m) => {
      // Name fuzzy search — only against merchant name (per spec).
      if (applied.q.trim()) {
        if (!m.name.toLowerCase().includes(applied.q.trim().toLowerCase())) return false;
      }
      if (applied.isoId !== 'All' && m.isoId !== applied.isoId) return false;
      if (applied.tags.length > 0) {
        // AND across selected tags: merchant must carry ALL selected tags.
        if (!applied.tags.every((t) => (m.tags || []).includes(t))) return false;
      }
      return true;
    });
  }, [merchants, applied]);

  // ─── Pagination slice (devices pattern) ────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  React.useEffect(() => {if (page > totalPages) setPage(totalPages);}, [totalPages, page]);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  // Re-measure sticky band heights whenever their content can change:
  // chip row appearing/disappearing changes the toolbar band height; the
  // card-head strip can grow on small viewports if Export breaks.
  React.useEffect(() => {
    const measure = () => {
      setToolbarH(toolbarRef.current?.offsetHeight || 0);
      setCardHeadH(cardHeadRef.current?.offsetHeight || 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [applied, filtered.length]);

  // Trigger search on click / Enter.
  const runSearch = () => {setApplied({ ...draft, q: draft.q });setPage(1);};
  const clearAll = () => {
    const blank = { q: '', isoId: 'All', tags: [] };
    setDraft(blank);
    setApplied(blank);
    setPage(1);
  };

  const onKey = (e) => {if (e.key === 'Enter') runSearch();};

  const hasFilters = applied.q || applied.isoId !== 'All' || applied.tags.length > 0;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Merchants</h1>
          <p className="page__sub">All merchants onboarded by ISO customers. Read-only — edit from each ISO's portal.</p>
        </div>
      </div>

      {/* Sticky condition area — toolbar + active-filter chips stay
             pinned to the scroll viewport so the user keeps context while
             scrolling through long merchant lists. */}
      <div
        ref={toolbarRef}
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'var(--color-bg-1)',
          paddingTop: 4, paddingBottom: 14,
          borderBottom: '1px solid var(--color-border-subtle)',
          boxShadow: '0 4px 6px -6px oklch(0% 0 0 / 0.15)', borderWidth: "0px"
        }}>
      {/* Toolbar: [search input] · [ISO] [Tags] · [Search btn at the end] */}
      <div className="list-toolbar" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 0 }}>
        {/* Name search input — Enter commits. Hand-rolled to match the
                     devices toolbar (inline search icon + Enter kbd hint). */}
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
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              onKeyDown={onKey}
              placeholder="Search by merchant name"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0,
                border: 0, background: 'transparent', outline: 'none',
                fontSize: 13, color: 'var(--color-text-primary)'
              }} />
          {draft.q &&
            <button
              type="button"
              title="Clear"
              onMouseDown={(e) => {e.preventDefault();setDraft((d) => ({ ...d, q: '' }));}}
              style={{
                display: 'grid', placeItems: 'center',
                width: 16, height: 16, padding: 0, borderRadius: 4,
                background: 'transparent', border: 0, cursor: 'pointer',
                color: 'var(--color-text-tertiary)', flex: 'none'
              }}>
              <Icon name="x" size={10} />
            </button>
            }
          <span style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: 10, fontWeight: 500,
              padding: '1px 5px', borderRadius: 4,
              background: 'var(--color-bg-3)', color: 'var(--color-text-tertiary)',
              border: '1px solid var(--color-border-subtle)',
              letterSpacing: '0.02em', flex: 'none'
            }}>Enter</span>
        </div>

        {/* Filter group — ISO single-select w/ inline clear · Tags multi w/ inline clear */}
        <div className="list-toolbar__filters" style={{ gap: 8 }}>
          <div className="tds-select tds-select--md" style={{ minWidth: 180, position: 'relative' }}>
            <select
                value={draft.isoId}
                onChange={(e) => setDraft((d) => ({ ...d, isoId: e.target.value }))}>
              <option value="All">All ISOs</option>
              {isoOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {draft.isoId !== 'All' ?
              <button
                type="button"
                title="Clear ISO"
                onMouseDown={(e) => {e.preventDefault();e.stopPropagation();setDraft((d) => ({ ...d, isoId: 'All' }));}}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 18, height: 18, padding: 0,
                  background: 'var(--color-bg-3)', border: 0, borderRadius: 4,
                  display: 'grid', placeItems: 'center', cursor: 'pointer',
                  color: 'var(--color-text-tertiary)', zIndex: 1
                }}>
                <Icon name="x" size={10} />
              </button> :

              <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
              }
          </div>
          <TagsMultiSelect
              allTags={allTags}
              value={draft.tags}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
        </div>

        {/* Search button — placed at the END, primary, the single commit action */}
        <Btn variant="primary" icon="search" size="md" onClick={runSearch}>Search</Btn>
      </div>

      {/* Active filters chip row (only after a search has been committed) */}
      {hasFilters &&
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginTop: 10, marginBottom: 0,
          fontSize: 12, color: 'var(--color-text-secondary)'
        }}>
          <span className="overline" style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--color-text-tertiary)'
          }}>Active filters:</span>
          {applied.q && <FilterChip label={`Name: ${applied.q}`} onRemove={() => {setApplied((a) => ({ ...a, q: '' }));setDraft((d) => ({ ...d, q: '' }));setPage(1);}} />}
          {applied.isoId !== 'All' &&
          <FilterChip
            label={`ISO: ${isoIndex.get(applied.isoId)?.name || applied.isoId}`}
            onRemove={() => {setApplied((a) => ({ ...a, isoId: 'All' }));setDraft((d) => ({ ...d, isoId: 'All' }));setPage(1);}} />
          }
          {applied.tags.map((t) =>
          <FilterChip
            key={t}
            label={`Tag: ${t}`}
            onRemove={() => {
              const next = applied.tags.filter((x) => x !== t);
              setApplied((a) => ({ ...a, tags: next }));
              setDraft((d) => ({ ...d, tags: next }));
              setPage(1);
            }} />
          )}
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
        }
      </div>{/* /sticky condition area */}

      {/* Table card — overflow visible so the inner header strip + thead
             can stick BELOW the toolbar instead of being clipped by the card. */}
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
            borderTopRightRadius: 12
          }}>
          <div style={{ flex: 1 }} />
          <ExportMenu
            pageRows={pageRows}
            filtered={filtered}
            isoIndex={isoIndex} />
        </div>
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '30%', top: toolbarH + cardHeadH }}>Merchant</th>
              <th style={{ width: '14%', top: toolbarH + cardHeadH }}>Country</th>
              <th style={{ width: '22%', top: toolbarH + cardHeadH }}>Owning ISO</th>
              <th style={{ top: toolbarH + cardHeadH }}>Tags</th>
              <th style={{ width: 56, top: toolbarH + cardHeadH }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ?
            <tr><td colSpan="5">
                <div className="empty" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  {hasFilters ?
                  'No merchants match your search.' :
                  'No merchants yet. They will appear here once ISOs onboard them.'}
                </div>
              </td></tr> :
            pageRows.map((m) => {
              const iso = m.isoId ? isoIndex.get(m.isoId) : null;
              return (
                <tr key={m.id} onClick={() => onOpen(m)}>
                  <td>
                    <div className="al-app">
                      {window.MerchantMonogram ?
                      <window.MerchantMonogram name={m.name} size={32} /> :
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--color-bg-3)' }} />
                      }
                      <div style={{ minWidth: 0 }}>
                        <div className="al-app__name">{m.name}</div>
                        <div className="al-app__pkg" style={{ fontFamily: 'var(--font-family-mono)' }}>{m.mid}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 13 }}>{m.country}</span></td>
                  <td>
                    {iso ?
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <Icon name="building" size={12} />
                        {iso.name}
                      </span> :

                    <span className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>Unassigned</span>
                    }
                  </td>
                  <td>
                    {(m.tags || []).length === 0 ?
                    <span className="muted" style={{ fontSize: 12 }}>—</span> :

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(m.tags || []).map((t) =>
                      window.CMTagChip ?
                      <window.CMTagChip key={t} t={t} /> :
                      <span key={t} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 999,
                        background: 'var(--color-bg-3)', color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border-subtle)'
                      }}>{t}</span>
                      )}
                      </div>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => {e.stopPropagation();onOpen(m);}}>
                      <Icon name="chevR" size={14} />
                    </button>
                  </td>
                </tr>);

            })}
          </tbody>
        </table>

        {/* Pagination bar — devices pattern */}
        <PaginationBar
          total={filtered.length}
          totalUnfiltered={merchants.length}
          pageStart={pageStart}
          pageEnd={pageEnd}
          page={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize} />
      </div>
    </div>);

};


const FilterChip = ({ label, onRemove }) =>
<span style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '2px 4px 2px 8px', fontSize: 11, borderRadius: 999,
  background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
  border: '1px solid var(--color-primary-200, oklch(85% 0.05 265))'
}}>
    {label}
    {onRemove &&
  <button
    type="button"
    onClick={onRemove}
    title="Remove this filter"
    style={{
      display: 'grid', placeItems: 'center',
      width: 16, height: 16, padding: 0, borderRadius: 999,
      background: 'transparent', border: 0, cursor: 'pointer',
      color: 'var(--color-primary-700)', opacity: 0.7
    }}
    onMouseEnter={(e) => {e.currentTarget.style.opacity = 1;e.currentTarget.style.background = 'oklch(85% 0.05 265 / 0.5)';}}
    onMouseLeave={(e) => {e.currentTarget.style.opacity = 0.7;e.currentTarget.style.background = 'transparent';}}>
        <Icon name="x" size={9} />
      </button>
  }
  </span>;



// ─── Detail wrapper — reuse the customer-side read-only view ─
const MerchantsDetailScreen = ({ merchant, onBack, maskOn = false }) => {
  const isoIndex = useIsoIndex();
  const customerName = merchant.isoId ?
  isoIndex.get(merchant.isoId)?.name || merchant.isoId :
  '—';
  if (!window.MerchantViewReadonly) {
    return <div className="page"><div className="empty">Merchant view component not loaded.</div></div>;
  }
  return (
    <div className="page">
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent', border: 0,
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13
          }}>
          <Icon name="chevL" size={14} /> Back to Merchants
        </button>
      </div>
      <window.MerchantViewReadonly
        merchant={merchant}
        customerName={customerName}
        maskOn={maskOn}
        onBack={onBack} />
    </div>);

};

window.MerchantsListScreen = MerchantsListScreen;
window.MerchantsDetailScreen = MerchantsDetailScreen;
// Shared list-screen primitives so other screens (Apps, etc.) can mirror
// the Merchants toolbar / pagination treatment.
window.MerchantsPaginationBar = PaginationBar;
window.MerchantsFilterChip    = FilterChip;