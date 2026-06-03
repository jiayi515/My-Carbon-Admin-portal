/* global React, Btn, Input, Icon, Badge, fmtDate, relTime */
// ─────────────────────────────────────────────────────────────
// Firmware list — homepage for the Firmware sub-menu.
//
// One row per (modelCode, deviceFlag) tuple. Each row shows that tuple's
// LATEST version (current === true, else first) plus aggregate stats.
//
// Mirrors apps-list.jsx layout (KPI tiles → toolbar → table) so the
// information density and interactions feel consistent across modules.
// ─────────────────────────────────────────────────────────────
const { useState: useStateFL, useMemo: useMemoFL } = React;

const FirmwareList = ({ firmwares, onOpen, onUpload }) => {
  const [q, setQ]                   = useStateFL('');
  const [osFilter, setOsFilter]     = useStateFL('All');
  const [modelFilter, setModelFilter] = useStateFL('All');
  const [flagFilter, setFlagFilter] = useStateFL('All');
  const [page, setPage]             = useStateFL(1);
  const pageSize = 10;

  // ── Per-row derived shape: collapse to latest version ──
  const rows = useMemoFL(() => firmwares.map(fw => {
    const latest = window.getFirmwareLatest(fw);
    return {
      ...fw,
      latest,
      versionCount: fw.versions.length,
      // Sort key — most-recently uploaded firmwares bubble to the top.
      updatedAt: latest?.uploadedAt || '1970-01-01T00:00:00Z',
    };
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), [firmwares]);

  // ── KPI counts (by OS) ──────────────────────────────────
  const kpis = useMemoFL(() => ({
    total:   firmwares.length,
    android: firmwares.filter(f => f.os === 'ANDROID').length,
    linux:   firmwares.filter(f => f.os === 'LINUX').length,
    rtos:    firmwares.filter(f => f.os === 'RTOS').length,
  }), [firmwares]);

  // ── Distinct option lists for filters ───────────────────
  const modelOptions = useMemoFL(() => Array.from(new Set(firmwares.map(f => f.modelCode))).sort(), [firmwares]);
  // Device flags are scoped to the selected model — the dropdown only
  // becomes meaningful after a specific model is chosen.
  const flagOptions  = useMemoFL(() => {
    if (modelFilter === 'All') return [];
    return Array.from(new Set(firmwares.filter(f => f.modelCode === modelFilter).map(f => f.deviceFlag))).sort();
  }, [firmwares, modelFilter]);

  // Auto-reset the flag filter if the model changes and the previously
  // picked flag isn't valid for the new model.
  React.useEffect(() => {
    if (flagFilter !== 'All' && !flagOptions.includes(flagFilter)) {
      setFlagFilter('All');
    }
  }, [flagOptions, flagFilter]);

  const filtered = useMemoFL(() => {
    let r = rows;
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(f =>
        f.modelCode.toLowerCase().includes(s) ||
        f.deviceFlag.toLowerCase().includes(s) ||
        (f.latest?.versionName || '').toLowerCase().includes(s) ||
        (f.latest?.fileName    || '').toLowerCase().includes(s)
      );
    }
    if (osFilter    !== 'All') r = r.filter(f => f.os === osFilter);
    if (modelFilter !== 'All') r = r.filter(f => f.modelCode === modelFilter);
    if (flagFilter  !== 'All') r = r.filter(f => f.deviceFlag === flagFilter);
    return r;
  }, [rows, q, osFilter, modelFilter, flagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    (osFilter    !== 'All' ? 1 : 0) +
    (modelFilter !== 'All' ? 1 : 0) +
    (flagFilter  !== 'All' ? 1 : 0);

  const clearAll = () => {
    setOsFilter('All'); setModelFilter('All'); setFlagFilter('All');
    setQ(''); setPage(1);
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Firmware</h1>
          <p className="page__sub">OTA firmware bundles, grouped by model code and device flag. Each row shows the latest version uploaded for that tuple.</p>
        </div>
        <div className="page__actions">
          <Btn variant="primary" icon="plus" onClick={onUpload}>Upload firmware</Btn>
        </div>
      </div>

      {/* KPI tiles — clickable as OS filters */}
      <div className="tkt-kpi" style={{ padding: 0, marginBottom: 16 }}>
        <button
          className={`tkt-kpi__tile ${osFilter === 'All' && !q.trim() && modelFilter === 'All' && flagFilter === 'All' ? 'is-on' : ''}`}
          onClick={clearAll}
        >
          <div className="tkt-kpi__label">Total firmware</div>
          <div className="tkt-kpi__val">{kpis.total.toLocaleString()}</div>
          <div className="tkt-kpi__sub">Across all OS &amp; flags</div>
        </button>
        <button
          className={`tkt-kpi__tile ${osFilter === 'ANDROID' ? 'is-on' : ''}`}
          onClick={() => { setOsFilter(osFilter === 'ANDROID' ? 'All' : 'ANDROID'); setPage(1); }}
        >
          <div className="tkt-kpi__label">Android</div>
          <div className="tkt-kpi__val">{kpis.android.toLocaleString()}</div>
          <div className="tkt-kpi__sub">.zip OTA bundles</div>
        </button>
        <button
          className={`tkt-kpi__tile ${osFilter === 'LINUX' ? 'is-on' : ''}`}
          onClick={() => { setOsFilter(osFilter === 'LINUX' ? 'All' : 'LINUX'); setPage(1); }}
        >
          <div className="tkt-kpi__label">Linux</div>
          <div className="tkt-kpi__val">{kpis.linux.toLocaleString()}</div>
          <div className="tkt-kpi__sub">.NLD MAN patches</div>
        </button>
        <button
          className={`tkt-kpi__tile ${osFilter === 'RTOS' ? 'is-on' : ''}`}
          onClick={() => { setOsFilter(osFilter === 'RTOS' ? 'All' : 'RTOS'); setPage(1); }}
        >
          <div className="tkt-kpi__label">RTOS</div>
          <div className="tkt-kpi__val">{kpis.rtos.toLocaleString()}</div>
          <div className="tkt-kpi__sub">.zip OTA bundles</div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>}
          placeholder="Search model, flag, version, file…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          size="md"/>
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ width: 130 }}>
            <select value={osFilter} onChange={e => { setOsFilter(e.target.value); setPage(1); }}>
              <option value="All">All OS</option>
              <option value="ANDROID">Android</option>
              <option value="LINUX">Linux</option>
              <option value="RTOS">RTOS</option>
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 140 }}>
            <select value={modelFilter} onChange={e => { setModelFilter(e.target.value); setPage(1); }}>
              <option value="All">All models</option>
              {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
          <div className="tds-select tds-select--md" style={{ width: 160, opacity: modelFilter === 'All' ? 0.55 : 1 }}>
            <select
              value={flagFilter}
              disabled={modelFilter === 'All'}
              onChange={e => { setFlagFilter(e.target.value); setPage(1); }}
              title={modelFilter === 'All' ? 'Select a model first to filter by device flag' : undefined}>
              <option value="All">{modelFilter === 'All' ? 'Pick a model first' : 'All device flags'}</option>
              {flagOptions.map(f => <option key={f} value={f}>{f}</option>)}
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

      {/* Table */}
      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Model</th>
              <th style={{ width: '11%' }}>Device flag</th>
              <th style={{ width: '8%' }}>OS</th>
              <th style={{ width: '22%' }}>Latest version</th>
              <th style={{ width: '12%' }}>Size</th>
              <th style={{ width: '16%' }}>Uploaded</th>
              <th>Status</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan="8"><div className="empty">No firmware matches your filters.</div></td></tr>
            ) : pageRows.map(fw => {
              const latest = fw.latest;
              const st = latest ? window.FW_VERSION_TONE[latest.status] || { label: latest.status, tone: 'neutral' } : null;
              return (
                <tr key={fw.id} onClick={() => onOpen(fw.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="fw-modeltile">{fw.modelCode}</div>
                      <div>
                        <div className="cust-name" style={{ fontFamily: 'var(--font-family-mono)' }}>{fw.modelCode}</div>
                        <div className="cust-meta">{fw.versionCount} version{fw.versionCount === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, padding: '2px 7px', background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 4 }}>
                      {fw.deviceFlag}
                    </span>
                  </td>
                  <td><Badge tone={window.FW_OS_TONE[fw.os] || 'neutral'} dot>{fw.os}</Badge></td>
                  <td>
                    {latest ? (
                      <div className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>
                        {latest.versionName}
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{latest?.fileSize || '—'}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{latest ? relTime(latest.uploadedAt) : '—'}</span></td>
                  <td>{st && <Badge tone={st.tone} dot>{st.label}</Badge>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(fw.id); }}>
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
        .fw-modeltile {
          width: 38px; height: 38px; flex: none; display: grid; place-items: center;
          border-radius: 8px;
          background: linear-gradient(135deg, oklch(70% 0.06 250), oklch(60% 0.08 250));
          color: #fff; font: 600 11px var(--font-family-mono); letter-spacing: -0.01em;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.18);
        }
      `}</style>
    </div>
  );
};

window.FirmwareList = FirmwareList;
