/* global React, Btn, Input, Icon, Badge, AppIcon, AppStatusPill, fmtDate, fmtDateTime */
// ─────────────────────────────────────────────────────────────
// Version Detail — admin view of one APK version.
// Mirrors the ISV portal's VersionDetailScreen, read-only:
//   Left:  Build metadata · Vulnerability scan · Release notes · Screenshots
//   Right: Timeline
// Admin doesn't author, so the publish/rollback/unpublish actions in the
// ISV header are omitted — only a passive "Download APK" affordance remains.
// ─────────────────────────────────────────────────────────────
const { useState: useStateVD, useMemo: useMemoVD } = React;

const ANDROID_API_LABEL_VD = {
  21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1',
  28: '9',   29: '10',  30: '11',  31: '12',  32: '12L', 33: '13',  34: '14', 35: '15',
};
const androidLabelVD = (api) => ANDROID_API_LABEL_VD[api] ? `Android ${ANDROID_API_LABEL_VD[api]}` : `API ${api}`;

const SCAN_META_VD = {
  clean:    { tone: 'success', label: 'Clean',        sub: 'No findings' },
  cleanish: { tone: 'info',    label: 'Mostly clean', sub: 'Low-severity only' },
  dirty:    { tone: 'warning', label: 'Findings',     sub: 'Review before deploying' },
};

const KV = ({ label, value }) => (
  <div className="vd-kv">
    <div className="vd-kv__label">{label}</div>
    <div className="vd-kv__value">{value}</div>
  </div>
);

const ScreenshotShot = ({ idx, label }) => (
  <div className="ov-shot">
    <div className="ov-shot__chrome"><span/><span/><span/></div>
    <div className="ov-shot__body">
      <Icon name="image" size={22}/>
      <div className="ov-shot__label">{label} · {idx}</div>
    </div>
  </div>
);

const VersionDetail = ({ app, version, onBack, onOpenApp }) => {
  const publisher = window.getAppPublisher(app);
  const scanMeta = version?.scan ? SCAN_META_VD[version.scan] : null;
  const counts = useMemoVD(() => window.severityCounts(version), [version]);
  const totalFindings = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const highPlus = counts ? (counts.critical || 0) + (counts.high || 0) : 0;
  const vst = window.APP_VERSION_TONE[version?.status] || { label: version?.status || '—', tone: 'neutral' };
  const [shotsOpen, setShotsOpen] = useStateVD(false);

  const timeline = useMemoVD(() => [
    version?.uploadedAt    && { icon: 'upload', text: 'APK uploaded',                                                                       at: version.uploadedAt },
    counts && version?.uploadedAt && { icon: 'shield', text: `Scan completed · ${totalFindings} finding${totalFindings === 1 ? '' : 's'}`, at: version.uploadedAt },
    version?.publishedAt   && { icon: 'check',  text: 'Published to app pool',                                                              at: version.publishedAt },
    version?.publishedAt   && { icon: 'users',  text: `${version.reach || 0} ISO ${(version.reach || 0) === 1 ? 'company' : 'companies'} subscribed`, at: version.publishedAt },
    version?.unpublishedAt && { icon: 'info',   text: 'Unpublished — existing installs unaffected',                                         at: version.unpublishedAt },
  ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at)), [version, counts, totalFindings]);

  if (!version) {
    return (
      <div className="page">
        <div className="empty">Version not found. <a onClick={onBack} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to app</a></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12.5px var(--font-family-sans)' }}>
          <Icon name="chevL" size={14}/> Back to {app.name} · Versions
        </button>
      </div>

      <div className="det-header">
        <AppIcon app={app} size={56}/>
        <div className="det-header__main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <button type="button" className="ad-pub-link" onClick={() => onOpenApp(app.id)} style={{ fontSize: 13 }}>
              {app.name}
            </button>
            <Icon name="chevR" size={11} style={{ color: 'var(--color-text-tertiary)' }}/>
            <h1 className="det-header__title" style={{ margin: 0, fontFamily: 'var(--font-family-mono)' }}>
              {version.name}
            </h1>
            <span className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-family-mono)' }}>· code {version.code}</span>
            <Badge tone={vst.tone} dot>{vst.label}</Badge>
            {version.current && <Badge tone="info" dot>Current</Badge>}
          </div>
          <div className="det-header__meta">
            <span>
              <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, padding: '1px 6px', background: 'var(--color-bg-3)', borderRadius: 4, border: '1px solid var(--color-border-subtle)' }}>
                {app.package}
              </code>
            </span>
            {publisher && (<>
              <span>·</span>
              <span>by <strong style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{publisher.name}</strong></span>
            </>)}
          </div>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download">Download APK</Btn>
        </div>
      </div>

      <div className="vd-grid">
        {/* LEFT — narrative content */}
        <div className="stack" style={{ gap: 16 }}>
          {/* Build metadata */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Build metadata</div>
            </div>
            <div className="info-card__body">
              <div className="vd-kvgrid">
                <KV label="Version name"   value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.name}</span>}/>
                <KV label="Version code"   value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.code}</span>}/>
                <KV label="APK size"       value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.size}</span>}/>
                <KV label="Min Android"    value={<>{androidLabelVD(version.minSdk)} <span className="muted" style={{ fontSize: 11.5, fontFamily: 'var(--font-family-mono)' }}>· API {version.minSdk}</span></>}/>
                <KV label="Target Android" value={<>{androidLabelVD(version.targetSdk)} <span className="muted" style={{ fontSize: 11.5, fontFamily: 'var(--font-family-mono)' }}>· API {version.targetSdk}</span></>}/>
                <KV label="Permissions"    value={<><span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.perms || 0}</span> declared</>}/>
                <KV label="Uploaded"       value={fmtDate(version.uploadedAt)}/>
                <KV label="Published"      value={version.publishedAt ? fmtDate(version.publishedAt) : <span className="muted">—</span>}/>
                {app.signer && (
                  <KV label="Signing cert" value={<span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5 }}>{app.signer}</span>}/>
                )}
              </div>
            </div>
          </div>

          {/* Vulnerability scan */}
          {counts && (
            <div className="info-card">
              <div className="info-card__head">
                <div className="info-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Icon name="shield" size={14}/> Vulnerability scan
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {scanMeta && <Badge tone={scanMeta.tone} dot>{scanMeta.label}</Badge>}
                  <span className="muted" style={{ fontSize: 11.5 }}>Last run · {fmtDate(version.uploadedAt)}</span>
                </div>
              </div>
              <div className="info-card__body">
                <div className="vd-sevgrid">
                  {Object.entries(counts).map(([k, v]) => (
                    <div key={k} className="vd-sevcell" style={{ borderLeftColor: window.SEVERITY[k].color, opacity: v > 0 ? 1 : 0.55 }}>
                      <div className="vd-sevcell__label">{window.SEVERITY[k].label}</div>
                      <div className="vd-sevcell__val" style={{ color: v > 0 ? window.SEVERITY[k].color : 'var(--color-text-tertiary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', background: 'var(--color-bg-3)' }}>
                  {['critical', 'high', 'medium', 'low', 'info'].map(k => {
                    const v = counts[k] || 0;
                    if (!v) return null;
                    return <div key={k} title={`${v} ${window.SEVERITY[k].label}`} style={{ flex: v, background: window.SEVERITY[k].color }}/>;
                  })}
                </div>
                {totalFindings === 0 ? (
                  <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-success-700, oklch(45% 0.12 152))' }}>
                    <Icon name="check" size={12}/> Scan completed with no findings.
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    {highPlus > 0 && (
                      <><span style={{ color: 'var(--color-error-700)', fontWeight: 500 }}>{highPlus} high/critical</span> · </>
                    )}
                    <span style={{ fontFamily: 'var(--font-family-mono)' }}>{totalFindings}</span> total finding{totalFindings === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Release notes */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Release notes</div>
            </div>
            <div className="info-card__body">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                {version.notes || 'No release notes.'}
              </p>
            </div>
          </div>

          {/* Screenshots — deferred behind a click so the page loads quickly */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Screenshots</div>
              <span className="muted" style={{ fontSize: 11.5 }}>bundled with this APK</span>
            </div>
            <div className="info-card__body">
              {shotsOpen ? (
                <div className="ov-shots">
                  {[1, 2, 3, 4].map(i => <ScreenshotShot key={i} idx={i} label={app.name}/>)}
                </div>
              ) : (
                <button type="button" className="vd-shots-toggle" onClick={() => setShotsOpen(true)}>
                  <div className="vd-shots-toggle__icon"><Icon name="image" size={16}/></div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Show 4 screenshots</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Deferred to keep the page snappy — click to load.</div>
                  </div>
                  <Icon name="chevR" size={13}/>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Timeline only */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Timeline</div>
            </div>
            <div className="info-card__body" style={{ padding: 0 }}>
              {timeline.map((e, i) => (
                <div key={i} className="vd-tl-row">
                  <div className="vd-tl-row__icon"><Icon name={e.icon} size={11}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{e.text}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1, fontFamily: 'var(--font-family-mono)' }}>{fmtDateTime(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .vd-grid { display: grid; grid-template-columns: 1fr 320px; gap: 18px; align-items: start; }
        @media (max-width: 980px) { .vd-grid { grid-template-columns: 1fr; } }
        .vd-kvgrid { display: grid; grid-template-columns: 160px 1fr 160px 1fr; row-gap: 14px; column-gap: 24px; }
        @media (max-width: 720px) { .vd-kvgrid { grid-template-columns: 140px 1fr; } }
        .vd-kv { display: contents; }
        .vd-kv__label { font: 500 11px var(--font-family-sans); color: var(--color-text-tertiary); letter-spacing: 0.06em; text-transform: uppercase; align-self: center; }
        .vd-kv__value { font-size: 13px; color: var(--color-text-primary); align-self: center; }
        .vd-sevgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .vd-sevcell { padding: 10px 12px; border-radius: 7px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-left: 3px solid; }
        .vd-sevcell__label { font: 500 10.5px var(--font-family-sans); color: var(--color-text-tertiary); letter-spacing: 0.06em; text-transform: uppercase; }
        .vd-sevcell__val { font: 600 22px var(--font-family-mono); margin-top: 2px; letter-spacing: -0.02em; }
        .vd-tl-row { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--color-border-subtle); }
        .vd-tl-row:last-child { border-bottom: 0; }
        .vd-tl-row__icon { width: 22px; height: 22px; border-radius: 5px; background: var(--color-bg-3); color: var(--color-text-secondary); display: grid; place-items: center; flex: none; border: 1px solid var(--color-border-subtle); }
        .vd-shots-toggle { display: flex; align-items: center; gap: 12px; width: 100%; padding: 20px 14px; border: 1px dashed var(--color-border-default); border-radius: 10px; background: var(--color-bg-3); cursor: pointer; transition: background 0.12s, border-color 0.12s; color: var(--color-text-secondary); }
        .vd-shots-toggle:hover { background: var(--color-bg-2); border-color: var(--color-border-strong); }
        .vd-shots-toggle__icon { width: 36px; height: 36px; border-radius: 8px; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); display: grid; place-items: center; color: var(--color-text-tertiary); flex: none; }
      `}</style>
    </div>
  );
};

window.VersionDetail = VersionDetail;
