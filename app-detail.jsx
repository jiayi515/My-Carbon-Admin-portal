/* global React, Btn, Input, Icon, Badge, CompanyLogo, AppIcon, AppStatusPill, AppModePill, fmtDate, fmtDateTime, relTime */
// ─────────────────────────────────────────────────────────────
// App Detail — admin view of one ISV-published app.
//
// READ-ONLY across the board: admin doesn't author or edit apps.
// 4 tabs: Overview · Versions · Subscribers · Activity
// ─────────────────────────────────────────────────────────────
const { useState: useStateAD, useMemo: useMemoAD } = React;

const ANDROID_API_LABEL = {
  21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1',
  28: '9',   29: '10',  30: '11',  31: '12',  32: '12L', 33: '13',  34: '14',
  35: '15',
};
const androidLabel = (api) => ANDROID_API_LABEL[api] ? `Android ${ANDROID_API_LABEL[api]}` : `API ${api}`;

const SCAN_META = {
  clean:    { tone: 'success', label: 'Clean',        sub: 'No findings' },
  cleanish: { tone: 'info',    label: 'Mostly clean', sub: 'Low-severity only' },
  dirty:    { tone: 'warning', label: 'Findings',     sub: 'Review before deploying' },
};

// ─── Overview tab ─────────────────────────────────────────
// Mirrors the ISV portal's AppOverview shape:
//   Left:  About (description + Published-by + metadata) · Screenshots
//   Right: Latest version (vertical KV + release notes + scan)
const OverviewKV = ({ label, value, sub }) => (
  <div className="ov-kv">
    <div className="ov-kv__label">{label}</div>
    <div className="ov-kv__value">
      <div>{value}</div>
      {sub && <div className="ov-kv__sub">{sub}</div>}
    </div>
  </div>
);

const ScreenshotPlaceholder = ({ label, idx }) => (
  <div className="ov-shot">
    <div className="ov-shot__chrome">
      <span/><span/><span/>
    </div>
    <div className="ov-shot__body">
      <Icon name="image" size={22}/>
      <div className="ov-shot__label">{label} · {idx}</div>
    </div>
  </div>
);

const TabAppOverview = ({ app, publisher, onOpenPublisher, onOpenVersion }) => {
  const latest = app.versions.find(v => v.current) || app.versions[0];
  const reach = latest?.reach || 0;
  const scanMeta = latest?.scan ? SCAN_META[latest.scan] : null;
  const counts = window.severityCounts(latest);
  const totalFindings = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="ad-grid">
      {/* LEFT — narrative */}
      <div className="stack" style={{ gap: 16 }}>
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">About</div>
          </div>
          <div className="info-card__body">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
              {app.description}
            </p>
            {publisher && (
              <div className="ad-pubrow">
                <span className="muted" style={{ fontSize: 12.5 }}>Published by</span>
                <button type="button" className="ad-pub-link" onClick={() => onOpenPublisher(publisher.id)}>
                  {publisher.name}
                  <Icon name="link" size={11}/>
                </button>
              </div>
            )}
            <dl className="kvgrid" style={{ marginTop: 18, gridTemplateColumns: '140px 1fr' }}>
              <dt>Category</dt><dd>{app.category}</dd>
              <dt>Package</dt>
              <dd>
                <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, padding: '2px 6px', background: 'var(--color-bg-3)', borderRadius: 4, border: '1px solid var(--color-border-subtle)' }}>
                  {app.package}
                </code>
              </dd>
              <dt>Supported devices</dt>
              <dd>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {app.devices.map(d => (
                    <span key={d} className="ad-chip">{d}</span>
                  ))}
                </div>
              </dd>
              <dt>Orientations</dt>
              <dd style={{ textTransform: 'capitalize' }}>{(app.orientations || ['portrait']).join(' · ')}</dd>
              {app.signer && (<>
                <dt>Signer</dt>
                <dd style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{app.signer}</dd>
              </>)}
            </dl>
          </div>
        </div>

        {/* Screenshots placeholder — bundled with the latest APK */}
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Screenshots</div>
            {latest && (
              <span className="muted" style={{ fontSize: 11.5 }}>
                from <span style={{ fontFamily: 'var(--font-family-mono)' }}>{latest.name}</span> · captured at upload
              </span>
            )}
          </div>
          <div className="info-card__body">
            {latest ? (
              <div className="ov-shots">
                {[1, 2, 3, 4].map(i => <ScreenshotPlaceholder key={i} idx={i} label={app.name}/>)}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>No version uploaded — screenshots will appear once an APK is published.</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — Latest version snapshot */}
      <div className="stack" style={{ gap: 16 }}>
        {latest ? (
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Latest version</div>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500 }}>{latest.name}</span>
            </div>
            <div className="info-card__body">
              <div className="ov-kvstack">
                <OverviewKV label="Version"
                  value={<span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 500 }}>{latest.name}</span>}
                  sub={<span style={{ fontFamily: 'var(--font-family-mono)' }}>code {latest.code}</span>}/>
                <OverviewKV label="Size"
                  value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{latest.size}</span>}/>
                <OverviewKV label="Reach"
                  value={<span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 500 }}>{reach}</span>}
                  sub={`ISO subscriber${reach === 1 ? '' : 's'}`}/>
                <OverviewKV label="Android"
                  value={androidLabel(latest.targetSdk).replace('Android ', '')}
                  sub={`min ${androidLabel(latest.minSdk)} · API ${latest.minSdk}\u2013${latest.targetSdk}`}/>
                <OverviewKV label="Uploaded" value={fmtDate(latest.uploadedAt)}/>
                <OverviewKV label="Published"
                  value={latest.publishedAt ? fmtDate(latest.publishedAt) : <span className="muted">—</span>}/>
              </div>

              <div className="ov-divider"/>
              <div className="ov-section-label">Release notes</div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                {latest.notes || 'No release notes.'}
              </p>

              {counts && (
                <>
                  <div className="ov-divider"/>
                  <div className="ov-section-label">Vulnerability scan</div>
                  <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--color-bg-3)' }}>
                    {['critical', 'high', 'medium', 'low', 'info'].map(k => {
                      const v = counts[k] || 0;
                      if (!v) return null;
                      return <div key={k} title={`${v} ${window.SEVERITY[k].label}`} style={{ flex: v, background: window.SEVERITY[k].color }}/>;
                    })}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {totalFindings === 0
                      ? <Badge tone="success" dot>No findings</Badge>
                      : ['critical', 'high', 'medium', 'low', 'info'].map(k => {
                          const v = counts[k] || 0;
                          if (!v) return null;
                          return (
                            <Badge key={k} tone={window.SEVERITY[k].tone}>
                              <span style={{ fontFamily: 'var(--font-family-mono)', marginRight: 3 }}>{v}</span>
                              {window.SEVERITY[k].label}
                            </Badge>
                          );
                        })}
                    {scanMeta && <Badge tone={scanMeta.tone} dot>{scanMeta.label}</Badge>}
                  </div>
                </>
              )}

              {onOpenVersion && (
                <button type="button" className="ad-link-btn" onClick={() => onOpenVersion(latest.id)}>
                  Open version details <Icon name="chevR" size={12}/>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">No versions yet</div>
            </div>
            <div className="info-card__body">
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                Once the publisher uploads a signed APK, the parsed manifest, security scan, and store screenshots will appear here.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Versions tab ─────────────────────────────────────────
// Columns mirror the ISV portal: Version · Code · Size · Uploaded ·
// Published · Scan · Status.
const ScanCell = ({ version }) => {
  const counts = window.severityCounts(version);
  if (!counts) return <span className="muted" style={{ fontSize: 11 }}>—</span>;
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const total = order.reduce((a, k) => a + (counts[k] || 0), 0);
  const highPlus = (counts.critical || 0) + (counts.high || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', width: 64, height: 5, borderRadius: 999, overflow: 'hidden', background: 'var(--color-bg-3)' }}>
        {order.map(k => {
          const v = counts[k] || 0;
          if (!v) return null;
          return <div key={k} title={`${v} ${window.SEVERITY[k].label}`} style={{ flex: v, background: window.SEVERITY[k].color }}/>;
        })}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
        {highPlus > 0 && (
          <span style={{ color: 'var(--color-error-700)', fontWeight: 500, marginRight: 4 }}>{highPlus} high+</span>
        )}
        <span style={{ fontFamily: 'var(--font-family-mono)' }}>{total}</span> total
      </span>
    </div>
  );
};

const TabAppVersions = ({ app, onOpenVersion }) => {
  const versions = app.versions || [];
  if (versions.length === 0) {
    return <div className="empty">No versions uploaded yet for this app.</div>;
  }
  return (
    <div className="table-card">
      <table className="tds-table">
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Version</th>
            <th style={{ width: '9%' }}>Code</th>
            <th style={{ width: '10%' }}>Size</th>
            <th style={{ width: '13%' }}>Uploaded</th>
            <th style={{ width: '13%' }}>Published</th>
            <th style={{ width: '22%' }}>Scan</th>
            <th>Status</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {versions.map(v => {
            const status = window.APP_VERSION_TONE[v.status] || { label: v.status, tone: 'neutral' };
            return (
              <tr key={v.id} onClick={() => onOpenVersion && onOpenVersion(v.id)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{v.name}</span>
                    {v.current && <Badge tone="info" dot>Current</Badge>}
                  </div>
                </td>
                <td><span className="num muted" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{v.code}</span></td>
                <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{v.size}</span></td>
                <td><span style={{ fontSize: 12.5 }}>{fmtDate(v.uploadedAt)}</span></td>
                <td>{v.publishedAt ? <span style={{ fontSize: 12.5 }}>{fmtDate(v.publishedAt)}</span> : <span className="muted">—</span>}</td>
                <td><ScanCell version={v}/></td>
                <td><Badge tone={status.tone} dot>{status.label}</Badge></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onOpenVersion && onOpenVersion(v.id); }}>
                    <Icon name="chevR" size={14}/>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Subscribers tab ──────────────────────────────────────
// Mirrors the ISV portal's Subscribers list:
// ISO company · Country/region · Current version · Subscribed · Status
const TabAppSubscribers = ({ app, onOpenSubscriber }) => {
  const subscriptions = useMemoAD(() => window.getAppSubscriptions(app), [app]);
  const latest = app.versions.find(v => v.current) || app.versions[0];
  if (subscriptions.length === 0) {
    return <div className="empty">No ISOs have subscribed to this app yet.</div>;
  }
  return (
    <div className="table-card">
      <table className="tds-table">
        <thead>
          <tr>
            <th style={{ width: '34%' }}>ISO company</th>
            <th style={{ width: '18%' }}>Country / region</th>
            <th style={{ width: '20%' }}>Current version</th>
            <th style={{ width: '14%' }}>Subscribed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map(s => {
            const behind = !!(s.subscribedVersion && latest && s.subscribedVersion.id !== latest.id);
            return (
              <tr key={s.customerId} onClick={() => onOpenSubscriber(s.customerId)}>
                <td>
                  <div className="al-app">
                    <CompanyLogo name={s.customer.name}/>
                    <div style={{ minWidth: 0 }}>
                      <div className="al-app__name">{s.customer.name}</div>
                      <div className="al-app__pkg" style={{ fontFamily: 'inherit' }}>
                        {s.customer.contracts.map(k => k.kind).join(' · ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 13 }}>{s.customer.country}</span></td>
                <td>
                  {s.subscribedVersion ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500, color: behind ? 'var(--color-warning-700)' : 'var(--color-text-primary)' }}>
                        {s.subscribedVersion.name}
                      </span>
                      {behind && latest ? (
                        <span style={{ fontSize: 11, color: 'var(--color-warning-700)' }}>
                          ↑ <span style={{ fontFamily: 'var(--font-family-mono)' }}>{latest.name}</span> available
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>—</span>
                  )}
                </td>
                <td><span style={{ fontSize: 12.5 }}>{relTime(s.subscribedAt)}</span></td>
                <td><Badge tone={s.status.tone} dot>{s.status.label}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Activity tab ─────────────────────────────────────────
const ACTIVITY_TONE = {
  'created':              { tone: 'success', label: 'Created' },
  'version-uploaded':     { tone: 'info',    label: 'Version uploaded' },
  'version-published':    { tone: 'success', label: 'Version published' },
  'version-unpublished':  { tone: 'warning', label: 'Version unpublished' },
  'published':            { tone: 'success', label: 'App published' },
  'unpublished':          { tone: 'warning', label: 'App unpublished' },
  'mode-changed':         { tone: 'info',    label: 'Mode changed' },
};

const TabAppActivity = ({ app }) => {
  const events = useMemoAD(() => window.buildAppActivity(app), [app]);
  return (
    <div className="info-card">
      <div className="info-card__head">
        <div className="info-card__title">Activity timeline</div>
        <span className="muted" style={{ fontSize: 12 }}>{events.length} event{events.length === 1 ? '' : 's'}</span>
      </div>
      <div className="info-card__body">
        <div className="timeline">
          {events.map((e, i) => {
            const meta = ACTIVITY_TONE[e.kind] || { tone: 'neutral', label: e.kind };
            return (
              <div key={i} className="tl-row">
                <div className={`tl-row__dot tl-row__dot--${meta.tone}`}></div>
                <div className="tl-row__title">
                  <Badge tone={meta.tone} dot>{meta.label}</Badge>
                  <span style={{ marginLeft: 8 }}>{e.text}</span>
                </div>
                <div className="tl-row__meta">
                  <span>{fmtDateTime(e.at)}</span>
                  <span>·</span>
                  <span>by <strong style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>{e.actor}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Detail shell ─────────────────────────────────────────
const AppDetail = ({ app, initialTab, onBack, onOpenPublisher, onOpenSubscriber, onOpenVersion }) => {
  const [tab, setTab] = useStateAD(initialTab || 'overview');
  const publisher = window.getAppPublisher(app);
  const latest = app.versions.find(v => v.current) || app.versions[0];
  const subscriberCount = (app.subscriberCustomerIds || []).length;

  const tabs = [
    { id: 'overview',     label: 'Overview' },
    { id: 'versions',     label: 'Versions',    count: app.versions.length },
    { id: 'subscribers',  label: 'Subscribers', count: subscriberCount },
    { id: 'activity',     label: 'Activity' },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12.5px var(--font-family-sans)' }}>
          <Icon name="chevL" size={14}/> Back to Apps
        </button>
      </div>

      <div className="det-header">
        <AppIcon app={app} size={56}/>
        <div className="det-header__main">
          <h1 className="det-header__title">
            {app.name}
            <AppStatusPill app={app}/>
            <AppModePill app={app}/>
          </h1>
          <div className="det-header__meta">
            <span>
              <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, padding: '1px 6px', background: 'var(--color-bg-3)', borderRadius: 4, border: '1px solid var(--color-border-subtle)' }}>
                {app.package}
              </code>
            </span>
            <span>·</span>
            <span>{app.category}</span>
            {latest && (<>
              <span>·</span>
              <span>Latest <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{latest.name}</strong></span>
            </>)}
            {publisher && (<>
              <span>·</span>
              <span>
                Published by{' '}
                <button type="button" className="ad-pub-link" onClick={() => onOpenPublisher(publisher.id)}>
                  {publisher.name}
                  <Icon name="link" size={11}/>
                </button>
              </span>
            </>)}
          </div>
        </div>
      </div>

      <div className="det-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tds-tab ${tab === t.id ? 'tds-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <TabAppOverview    app={app} publisher={publisher} onOpenPublisher={onOpenPublisher} onOpenVersion={onOpenVersion}/>}
      {tab === 'versions'    && <TabAppVersions    app={app} onOpenVersion={onOpenVersion}/>}
      {tab === 'subscribers' && <TabAppSubscribers app={app} onOpenSubscriber={onOpenSubscriber}/>}
      {tab === 'activity'    && <TabAppActivity    app={app}/>}
    </div>
  );
};

window.AppDetail = AppDetail;
