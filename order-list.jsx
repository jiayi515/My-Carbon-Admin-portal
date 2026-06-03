/* global React, Btn, Input, Icon, Badge, CompanyLogo, ModelTile, fmtDate, fmtDateTime, relTime,
   SEED_ORDERS, ORDER_STATUSES, ORDER_STATUS_TONE,
   orderTotal, orderQty, orderSubtotal, deviceProgress, moneyUSD, DEVICE_MODELS */
const { useState, useMemo } = React;

const OrderList = ({ orders, onOpen, onNew }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let rows = orders;
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(o =>
        o.number.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.items.some(i => i.modelName.toLowerCase().includes(s))
      );
    }
    if (status !== 'All') rows = rows.filter(o => o.status === status);
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const r = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
    return rows;
  }, [orders, q, status, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const sortCell = (key, label) => (
    <span className="tds-table__sort" onClick={() => {
      if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortBy(key); setSortDir('asc'); }
    }}>
      {label}
      <span style={{ opacity: sortBy === key ? 1 : 0.3, fontSize: 9 }}>{sortBy === key && sortDir === 'asc' ? '▲' : '▼'}</span>
    </span>
  );

  // Stats
  const stats = useMemo(() => {
    const total = orders.length;
    const byStatus = (s) => orders.filter(o => o.status === s).length;
    return {
      total,
      awaitingPayment: byStatus('Awaiting payment'),
      awaitingShipment: byStatus('Awaiting shipment'),
    };
  }, [orders]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Sample orders</h1>
          <p className="page__sub">Create and track sample device orders for customer companies. Maintain device activation records before shipment.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download" size="md">Export</Btn>
          <Btn variant="primary" icon="plus" size="md" onClick={onNew}>New order</Btn>
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <button type="button" className={`stat is-clickable ${status === 'All' && !q ? 'is-active' : ''}`} onClick={() => { setStatus('All'); setQ(''); setPage(1); }}>
          <div className="stat__label">Total orders</div>
          <div className="stat__val">{stats.total}</div>
          <div className="stat__delta stat__delta--up">↑ 3 this week</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className={`stat is-clickable ${status === 'Awaiting payment' ? 'is-active' : ''}`} onClick={() => { setStatus('Awaiting payment'); setPage(1); }}>
          <div className="stat__label">Awaiting payment</div>
          <div className="stat__val" style={{ color: 'var(--color-warning-700)' }}>{stats.awaitingPayment}</div>
          <div className="stat__delta">invoice outstanding</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className={`stat is-clickable ${status === 'Awaiting shipment' ? 'is-active' : ''}`} onClick={() => { setStatus('Awaiting shipment'); setPage(1); }}>
          <div className="stat__label">Awaiting shipment</div>
          <div className="stat__val" style={{ color: 'var(--color-info-700)' }}>{stats.awaitingShipment}</div>
          <div className="stat__delta">ready to activate &amp; ship</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search by order #, customer or model…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} size="md"/>
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ width: 180 }}>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option>All</option>
              {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table className="tds-table">
          <colgroup>
            <col style={{ width: '1%' }}/>
            <col/>
            <col/>
            <col style={{ width: '1%' }}/>
            <col style={{ width: '1%' }}/>
            <col style={{ width: '1%' }}/>
            <col style={{ width: '40px' }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ whiteSpace: 'nowrap' }}>{sortCell('number', 'Order')}</th>
              <th>Customer</th>
              <th>Models &amp; units</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
              <th style={{ whiteSpace: 'nowrap' }}>{sortCell('status', 'Status')}</th>
              <th style={{ whiteSpace: 'nowrap' }}>{sortCell('createdAt', 'Created')}</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan="7"><div className="empty">No orders match your filters.</div></td></tr>
            ) : pageRows.map(o => {
              const prog = deviceProgress(o);
              const showProgress = o.status === 'Awaiting shipment';
              return (
                <tr key={o.id} onClick={() => onOpen(o.id)}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{o.number}</div>
                  </td>
                  <td>
                    <div className="cust-cell">
                      <CompanyLogo name={o.customerName} size={28}/>
                      <div>
                        <div className="cust-name">{o.customerName}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {o.items.slice(0, 2).map((i, idx) => {
                      const mm = DEVICE_MODELS.find(x => x.id === i.modelId) || { name: i.modelName, image: null };
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: idx === 0 && o.items.length > 1 ? 4 : 0 }}>
                          <ModelTile model={mm} px={35}/>
                          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{i.modelName}</span>
                          <span style={{ marginLeft: 2 }}>× {i.qty}</span>
                        </div>
                      );
                    })}
                    {o.items.length > 2 ? (
                      <div className="cust-meta" style={{ marginTop: 4 }}>+{o.items.length - 2} more · {orderQty(o)} units total</div>
                    ) : o.items.length > 1 ? (
                      <div className="cust-meta" style={{ marginTop: 4 }}>{orderQty(o)} units total</div>
                    ) : null}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="num">
                    <div>
                      {orderTotal(o) === 0
                        ? <span style={{ color: 'var(--color-success-700)', fontWeight: 600 }}>Free</span>
                        : moneyUSD(orderTotal(o))}
                    </div>
                    {o.discountPct > 0 && (
                      <div className="cust-meta" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                        <Icon name="gift" size={10} style={{ verticalAlign: '-1px' }}/>
                        {o.discountPct === 100 ? 'Complimentary' : `${o.discountPct}% off`}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <Badge tone={ORDER_STATUS_TONE[o.status] || 'neutral'} dot>{o.status}</Badge>
                      {showProgress && prog.total > 0 && (
                        <div className="cust-meta num" title="Devices activated / total">
                          {prog.done}/{prog.total} activated
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13 }}>{fmtDate(o.createdAt)}</div>
                    <div className="cust-meta">{relTime(o.createdAt)}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpen(o.id); }}>
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
    </div>
  );
};

window.OrderList = OrderList;
