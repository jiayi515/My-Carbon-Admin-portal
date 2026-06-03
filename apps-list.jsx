/* global React, Btn, Input, Icon, Badge, CompanyLogo, fmtDate */
// ─────────────────────────────────────────────────────────────
// Apps list — admin's cross-tenant view of every ISV-published app.
//
// Filter area + table treatment mirrors the top-level Merchants screen:
//   · Sticky condition area pinned to the viewport while scrolling
//   · Draft → Applied filter state, committed by an explicit Search button
//     (Enter in the search input also commits)
//   · Active-filter chip row appears after a search has been committed
//   · Table card uses overflow:visible so a sticky card-head + sticky thead
//     can layer below the toolbar without being clipped
//   · Rows-per-page selector + windowed pager + Go-to input
// ─────────────────────────────────────────────────────────────
const { useState: useStateAL, useMemo: useMemoAL, useRef: useRefAL, useEffect: useEffectAL } = React;

// ── App icon (square, hue-tinted) ─────────────────────────
const AppIcon = ({ app, size = 36 }) => {
  const hue = app.iconHue || '#5B7CFA';
  const letter = app.name.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.max(6, Math.round(size / 5)),
      background: `linear-gradient(135deg, ${hue}, ${hue}cc)`,
      color: '#fff', flex: 'none',
      display: 'grid', placeItems: 'center',
      fontWeight: 600, fontSize: Math.round(size * 0.4),
      letterSpacing: '-0.02em',
      boxShadow: '0 1px 2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)',
    }}>{letter}</div>
  );
};

// ── Status pill (label + dot) ─────────────────────────────
const AppStatusPill = ({ app }) => {
  const s = window.APP_STATUS_TONE[app.status] || { label: app.status, tone: 'neutral' };
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
};

const AppModePill = ({ app }) => {
  const m = window.APP_MODE_TONE[app.publishMode || 'public'] || { label: '—', tone: 'neutral' };
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
};

// Fallback FilterChip in case merchants-screen hasn't loaded yet.
const _FilterChipFallback = ({ label, onRemove }) =>
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

// ── List screen ───────────────────────────────────────────
const AppList = ({ apps, onOpen, onOpenPublisher }) => {
  // ── Applied (committed) filter state — only changes on Search ──
  const [applied, setApplied] = useStateAL({
    q: '', publisherId: 'All', status: 'All', mode: 'All', category: 'All'
  });
  // ── Draft state — what the toolbar inputs hold right now ──
  const [draft, setDraft] = useStateAL({
    q: '', publisherId: 'All', status: 'All', mode: 'All', category: 'All'
  });
  const [pageSize, setPageSize] = useStateAL(25);
  const [page, setPage] = useStateAL(1);

  // ── Sticky stack measurement (merchants pattern) ──
  const toolbarRef = useRefAL(null);
  const cardHeadRef = useRefAL(null);
  const [toolbarH, setToolbarH] = useStateAL(0);
  const [cardHeadH, setCardHeadH] = useStateAL(0);

  const FilterChip = window.MerchantsFilterChip || _FilterChipFallback;
  const PaginationBar = window.MerchantsPaginationBar;

  // ── Publisher options (only ISV-bearing customers) ────
  const publisherOptions = useMemoAL(() => {
    const ids = new Set(apps.map(a => a.publisherCustomerId));
    return (window.SEED_CUSTOMERS || [])
      .filter(c => ids.has(c.id))
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [apps]);

  // Derived row data (with helper fields for sort)
  const rows = useMemoAL(() => apps.map(a => {
    const latest = a.versions.find(v => v.current) || a.versions[0];
    const publisher = window.getAppPublisher(a);
    return {
      ...a,
      latest,
      publisherName: publisher?.name || '—',
      publisherCustomer: publisher,
      subscriberCount: (a.subscriberCustomerIds || []).length,
      updatedAt: latest?.publishedAt || latest?.uploadedAt || a.unpublishedAt || '1970-01-01T00:00:00Z',
    };
  }), [apps]);

  // Apply COMMITTED filters
  const filtered = useMemoAL(() => {
    let r = rows;
    if (applied.q.trim()) {
      const s = applied.q.toLowerCase();
      r = r.filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.package.toLowerCase().includes(s) ||
        a.publisherName.toLowerCase().includes(s)
      );
    }
    if (applied.status !== 'All')      r = r.filter(a => a.status === applied.status);
    if (applied.mode !== 'All')        r = r.filter(a => (a.publishMode || 'public') === applied.mode);
    if (applied.publisherId !== 'All') r = r.filter(a => a.publisherCustomerId === applied.publisherId);
    if (applied.category !== 'All')    r = r.filter(a => a.category === applied.category);
    return r;
  }, [rows, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffectAL(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const hasFilters =
    !!applied.q ||
    applied.publisherId !== 'All' ||
    applied.status !== 'All' ||
    applied.mode !== 'All' ||
    applied.category !== 'All';

  // Re-measure sticky band heights when chip row toggles or viewport resizes.
  useEffectAL(() => {
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
    const blank = { q: '', publisherId: 'All', status: 'All', mode: 'All', category: 'All' };
    setDraft(blank); setApplied(blank); setPage(1);
  };
  const onKey = (e) => { if (e.key === 'Enter') runSearch(); };

  // Resolved labels for the chip row.
  const pubLabel = (id) => publisherOptions.find(p => p.id === id)?.name || id;
  const statusLabel = (s) => (window.APP_STATUS_TONE?.[s]?.label || s);
  const modeLabel = (m) => (window.APP_MODE_TONE?.[m]?.label || m);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Apps</h1>
          <p className="page__sub">All applications published by ISV customers on the TOMS platform.</p>
        </div>
      </div>

      {/* Sticky condition area — toolbar + active-filter chips stay pinned
          to the scroll viewport so the user keeps context while scrolling. */}
      <div
        ref={toolbarRef}
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'var(--color-bg-1)',
          paddingTop: 4, paddingBottom: 14,
          borderBottom: '1px solid var(--color-border-subtle)',
          boxShadow: '0 4px 6px -6px oklch(0% 0 0 / 0.15)', borderWidth: '0px'
        }}>
        {/* Toolbar */}
        <div className="list-toolbar" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 0 }}>
          {/* Name search input — Enter commits */}
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
              placeholder="Search apps, package, publisher"
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

          {/* Filter group — selects with inline clear when set */}
          <div className="list-toolbar__filters" style={{ gap: 8 }}>
            <FilterSelect
              minWidth={180}
              value={draft.publisherId}
              onChange={(v) => setDraft(d => ({ ...d, publisherId: v }))}
              placeholder="All publishers"
              options={[
                { value: 'All', label: 'All publishers (ISVs)' },
                ...publisherOptions.map(p => ({ value: p.id, label: p.name }))
              ]} />
            <FilterSelect
              width={130}
              value={draft.status}
              onChange={(v) => setDraft(d => ({ ...d, status: v }))}
              options={[
                { value: 'All', label: 'All status' },
                { value: 'published', label: 'Published' },
                { value: 'unpublished', label: 'Unpublished' }
              ]} />
            <FilterSelect
              width={140}
              value={draft.mode}
              onChange={(v) => setDraft(d => ({ ...d, mode: v }))}
              options={[
                { value: 'All', label: 'All modes' },
                { value: 'public', label: 'All ISOs' },
                { value: 'private', label: 'Specified ISOs' }
              ]} />
            <FilterSelect
              width={150}
              value={draft.category}
              onChange={(v) => setDraft(d => ({ ...d, category: v }))}
              options={[
                { value: 'All', label: 'All categories' },
                ...(window.APP_CATEGORIES || []).map(c => ({ value: c, label: c }))
              ]} />
          </div>

          {/* Search button — placed at the END, primary, the single commit action */}
          <Btn variant="primary" icon="search" size="md" onClick={runSearch}>Search</Btn>
        </div>

        {/* Active filters chip row (only after a search has been committed) */}
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
            {applied.publisherId !== 'All' && <FilterChip label={`Publisher: ${pubLabel(applied.publisherId)}`} onRemove={() => { setApplied(a => ({ ...a, publisherId: 'All' })); setDraft(d => ({ ...d, publisherId: 'All' })); setPage(1); }} />}
            {applied.status !== 'All' && <FilterChip label={`Status: ${statusLabel(applied.status)}`} onRemove={() => { setApplied(a => ({ ...a, status: 'All' })); setDraft(d => ({ ...d, status: 'All' })); setPage(1); }} />}
            {applied.mode !== 'All' && <FilterChip label={`Mode: ${modeLabel(applied.mode)}`} onRemove={() => { setApplied(a => ({ ...a, mode: 'All' })); setDraft(d => ({ ...d, mode: 'All' })); setPage(1); }} />}
            {applied.category !== 'All' && <FilterChip label={`Category: ${applied.category}`} onRemove={() => { setApplied(a => ({ ...a, category: 'All' })); setDraft(d => ({ ...d, category: 'All' })); setPage(1); }} />}
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

      {/* Table card — overflow visible so the inner header strip + thead
          can stick BELOW the toolbar instead of being clipped. */}
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
            {' '}app{filtered.length === 1 ? '' : 's'}
            {hasFilters && <span style={{ marginLeft: 6 }}>matching filters</span>}
          </span>
          <div style={{ flex: 1 }} />
        </div>
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '30%', top: toolbarH + cardHeadH }}>App</th>
              <th style={{ width: '22%', top: toolbarH + cardHeadH }}>Publisher (ISV)</th>
              <th style={{ width: '14%', top: toolbarH + cardHeadH }}>Category</th>
              <th style={{ width: '16%', top: toolbarH + cardHeadH }}>Latest version</th>
              <th style={{ width: '11%', top: toolbarH + cardHeadH }}>Status</th>
              <th style={{ width: '10%', top: toolbarH + cardHeadH }}>Mode</th>
              <th style={{ width: 40, top: toolbarH + cardHeadH }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7">
                <div className="empty" style={{ padding: '40px 24px', textAlign: 'center' }}>
                  {hasFilters ? 'No apps match your search.' : 'No apps yet.'}
                </div>
              </td></tr>
            ) : pageRows.map(a => (
              <tr key={a.id} onClick={() => onOpen(a.id)}>
                <td>
                  <div className="al-app">
                    <AppIcon app={a}/>
                    <div style={{ minWidth: 0 }}>
                      <div className="al-app__name">{a.name}</div>
                      <div className="al-app__pkg">{a.package}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="al-pub">
                    <span className="al-pub__name">{a.publisherName}</span>
                    {a.publisherCustomer?.locked && (
                      <span className="cust-lockchip" title={a.publisherCustomer.lockReason || 'Access locked'}>
                        <Icon name="shield" size={10}/> LOCKED
                      </span>
                    )}
                  </div>
                </td>
                <td><span style={{ fontSize: 13 }}>{a.category}</span></td>
                <td>
                  {a.latest ? (
                    <div>
                      <div className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500 }}>{a.latest.name}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>
                        {fmtDate(a.latest.publishedAt || a.latest.uploadedAt)}
                      </div>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>No versions yet</span>
                  )}
                </td>
                <td><AppStatusPill app={a}/></td>
                <td><AppModePill app={a}/></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(a.id); }}>
                    <Icon name="chevR" size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination bar — merchants pattern */}
        {PaginationBar && (
          <PaginationBar
            total={filtered.length}
            totalUnfiltered={apps.length}
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

// Single-select with inline "clear" affordance when value !== 'All'.
const FilterSelect = ({ value, onChange, options, placeholder, width, minWidth }) => {
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

window.AppList = AppList;
window.AppIcon = AppIcon;
window.AppStatusPill = AppStatusPill;
window.AppModePill = AppModePill;
