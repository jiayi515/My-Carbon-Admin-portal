/* global React, Btn, Input, Icon, Badge, CompanyLogo, fmtDate, relTime */
// ─────────────────────────────────────────────────────────────
// Factory Images — list view.
//
// Each row is one factory pre-install spec. Columns: name · Models ·
// ISOs · Packages · Updated.
// ─────────────────────────────────────────────────────────────
const { useState: useStateFL, useMemo: useMemoFL } = React;

const FactoryImageList = ({ images, onOpen, onNew }) => {
  const [q, setQ]                       = useStateFL('');
  const [modelFilter, setModelFilter]   = useStateFL('All');
  const [isoFilter, setIsoFilter]       = useStateFL('All');
  const [page, setPage]                 = useStateFL(1);
  const pageSize = 10;

  const knownModels = window.getFactoryImageKnownModels?.() || [];
  const knownIsos = useMemoFL(
    () => (window.getFactoryImageEligibleIsos?.() || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const kpis = useMemoFL(() => {
    const total    = images.length;
    const totalIsos = new Set(images.flatMap(fi => fi.isoCustomerIds || [])).size;
    return { total, totalIsos };
  }, [images]);

  const filtered = useMemoFL(() => {
    let r = images.slice();
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(fi => fi.name.toLowerCase().includes(s));
    }
    if (modelFilter !== 'All') r = r.filter(fi => Object.keys(fi.payload?.byModel || {}).includes(modelFilter));
    if (isoFilter !== 'All') r = r.filter(fi => (fi.isoCustomerIds || []).includes(isoFilter));
    r.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return r;
  }, [images, q, modelFilter, isoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount = (q.trim() ? 1 : 0) + (modelFilter !== 'All' ? 1 : 0) + (isoFilter !== 'All' ? 1 : 0);
  const clearAll = () => { setQ(''); setModelFilter('All'); setIsoFilter('All'); setPage(1); };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Factory Images</h1>
          <p className="page__sub">
            A factory image is the pre-install spec the factory follows when flashing a fresh device: which firmware, system apps, and ISV apps to load, signed with the correct certificate. Each ISO is provisioned from one or more factory images depending on the batch.
          </p>
        </div>
        <div className="page__actions">
          <Btn variant="primary" icon="plus" onClick={onNew}>New factory image</Btn>
        </div>
      </div>

      <div className="tkt-kpi" style={{ padding: 0, marginBottom: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="tkt-kpi__tile" style={{ cursor: 'default' }}>
          <div className="tkt-kpi__label">Factory images</div>
          <div className="tkt-kpi__val">{kpis.total.toLocaleString()}</div>
          <div className="tkt-kpi__sub">Published pre-install specs</div>
        </div>
        <div className="tkt-kpi__tile" style={{ cursor: 'default' }}>
          <div className="tkt-kpi__label">Bound ISOs</div>
          <div className="tkt-kpi__val">{kpis.totalIsos.toLocaleString()}</div>
          <div className="tkt-kpi__sub">Unique ISO customers</div>
        </div>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>}
          placeholder="Search by name…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          size="md"/>
        <div className="list-toolbar__filters">
<div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select value={modelFilter} onChange={e => { setModelFilter(e.target.value); setPage(1); }}>
              <option value="All">All models</option>
              {knownModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 200 }}>
            <select value={isoFilter} onChange={e => { setIsoFilter(e.target.value); setPage(1); }}>
              <option value="All">All ISOs</option>
              {knownIsos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          {activeFilterCount > 0 && (
            <button className="al-clear" onClick={clearAll}>
              Clear <span className="al-clear__count">{activeFilterCount}</span>
            </button>
          )}
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Factory image</th>
              <th style={{ width: '20%' }}>Models</th>
              <th style={{ width: '14%' }}>ISOs</th>
              <th style={{ width: '16%' }}>Packages</th>
              <th style={{ width: '14%' }}>Updated</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan="6"><div className="empty">No factory images match your filters.</div></td></tr>
            ) : pageRows.map(fi => {
              const models = Object.keys(fi.payload?.byModel || {});
              const isoCount = fi.isoCustomerIds?.length || 0;
              const pkgCount = window.factoryImageTotalPackageCount(fi);
              return (
                <tr key={fi.id} onClick={() => onOpen(fi.id)}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                      {fi.name}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {models.length === 0
                        ? <span className="muted" style={{ fontSize: 12 }}>None</span>
                        : models.map(m => (
                          <span key={m} className="fi-model-chip">{m}</span>
                        ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{isoCount}</span>
                    <span className="muted" style={{ fontSize: 11.5, marginLeft: 4 }}>{isoCount === 1 ? 'ISO' : 'ISOs'}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{pkgCount}</span>
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>{window.fmtBytes(window.factoryImageTotalSize(fi))}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{relTime(fi.updatedAt || fi.createdAt)}</div>
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>{fi.updatedBy || fi.createdBy}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(fi.id); }}>
                      <Icon name="chevR" size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-foot">
          <div className="table-foot__meta">
            Showing <strong>{pageRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</strong>–<strong>{(page - 1) * pageSize + pageRows.length}</strong> of <strong>{filtered.length}</strong>
          </div>
          <div className="tds-pagination">
            <button className="tds-pagination__page" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><Icon name="chevL" size={12}/></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`tds-pagination__page ${p === page ? 'tds-pagination__page--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="tds-pagination__page" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><Icon name="chevR" size={12}/></button>
          </div>
        </div>
      </div>

      <style>{`
        .fi-model-chip {
          display: inline-flex; align-items: center;
          padding: 2px 7px; border-radius: 4px;
          font: 500 11px var(--font-family-mono); letter-spacing: 0.02em;
          background: var(--color-bg-3); color: var(--color-text-secondary);
          border: 1px solid var(--color-border-subtle);
        }
      `}</style>
    </div>
  );
};

window.FactoryImageList = FactoryImageList;
