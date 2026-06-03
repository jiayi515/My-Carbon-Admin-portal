/* global React, Btn, Input, Field, Icon, Badge, Modal, CompanyLogo, useToast, fmtDate, fmtDateTime, relTime */
// ─────────────────────────────────────────────────────────────
// Firmware Detail — admin view of one (modelCode, deviceFlag) firmware.
//
// 3 tabs:
//   Overview · Versions · Activity
//
// This screen is asset-management only: see what firmware bundles we
// have and what versions exist per tuple. Once a version is uploaded
// it automatically appears in the ISV/ISO platform's App Store + OTA
// management menu — each ISO decides whether and how to adopt it.
// ─────────────────────────────────────────────────────────────
const { useState: useStateFD, useMemo: useMemoFD } = React;

// ─── Overview tab ─────────────────────────────────────────
const TabFwOverview = ({ firmware, onOpenVersion }) => {
  const latest = window.getFirmwareLatest(firmware);
  const meta = window.FW_OS_META[firmware.os];

  return (
    <div className="ad-grid">
      {/* LEFT */}
      <div className="stack" style={{ gap: 16 }}>
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Firmware identity</div>
          </div>
          <div className="info-card__body">
            <dl className="kvgrid" style={{ gridTemplateColumns: '160px 1fr' }}>
              <dt>Model code</dt>
              <dd><code className="fw-code">{firmware.modelCode}</code></dd>
              <dt>Device flag</dt>
              <dd><code className="fw-code">{firmware.deviceFlag}</code></dd>
              <dt>Operating system</dt>
              <dd><Badge tone={window.FW_OS_TONE[firmware.os]} dot>{firmware.os}</Badge></dd>
              <dt>File format</dt>
              <dd>
                <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, padding: '2px 6px', background: 'var(--color-bg-3)', borderRadius: 4, border: '1px solid var(--color-border-subtle)' }}>
                  {meta.pattern}
                </code>
              </dd>
              <dt>Total versions</dt>
              <dd><span style={{ fontFamily: 'var(--font-family-mono)' }}>{firmware.versions.length}</span></dd>
              {firmware.customerScope && (
                <>
                  <dt>Customer scope</dt>
                  <dd style={{ fontSize: 12 }}>{firmware.customerScope}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* RIGHT — Latest version snapshot */}
      <div className="stack" style={{ gap: 16 }}>
        {latest ? (
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Latest version</div>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500 }}>{latest.versionName}</span>
            </div>
            <div className="info-card__body">
              <div className="ov-kvstack">
                <div className="ov-kv">
                  <div className="ov-kv__label">Version</div>
                  <div className="ov-kv__value">
                    <div><span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 500 }}>{latest.versionName}</span></div>
                  </div>
                </div>
                <div className="ov-kv">
                  <div className="ov-kv__label">File size</div>
                  <div className="ov-kv__value"><span style={{ fontFamily: 'var(--font-family-mono)' }}>{latest.fileSize}</span></div>
                </div>
                <div className="ov-kv">
                  <div className="ov-kv__label">Uploaded</div>
                  <div className="ov-kv__value">{fmtDate(latest.uploadedAt)}</div>
                </div>
              </div>

              <div className="ov-divider"/>
              <div className="ov-section-label">Changelog</div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                {latest.changelog || 'No changelog provided.'}
              </p>

              <button type="button" className="ad-link-btn" onClick={() => onOpenVersion(latest.id)}>
                Open version details <Icon name="chevR" size={12}/>
              </button>
            </div>
          </div>
        ) : (
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">No versions yet</div></div>
            <div className="info-card__body">
              <div className="muted" style={{ fontSize: 12.5 }}>Once a firmware bundle is uploaded, the parsed manifest will appear here.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Audience summary (used in Versions tab + Version detail) ────
// Renders a compact label like "Northwind +2" with a tooltip listing all
// ISO names. Click expands inline. Used wherever a list of audience ISOs
// needs to be shown in a small space.
const FwAudienceSummary = ({ audience, max = 1 }) => {
  if (!audience || audience.length === 0) {
    return <span className="muted" style={{ fontSize: 12 }}>—</span>;
  }
  const head = audience.slice(0, max);
  const rest = audience.length - head.length;
  const titleAll = audience.map(c => c.name).join('\n');
  return (
    <span className="fwv-aud" title={titleAll}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {head.map(c => <CompanyLogo key={c.id} name={c.name} size={18}/>)}
      </span>
      <span className="fwv-aud__name">
        {head.map(c => c.name).join(', ')}
        {rest > 0 && <span className="fwv-aud__plus"> +{rest}</span>}
      </span>
    </span>
  );
};

// ─── Versions tab ─────────────────────────────────────────
const CURRENT_USER_FW = 'ops@carbon';

const TabFwVersions = ({ firmware, onOpenVersion, onMutateFirmware }) => {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useStateFD(null);   // {versionId, name}
  const [confirmUnpub, setConfirmUnpub]   = useStateFD(null);   // version
  const [pubDialog, setPubDialog]         = useStateFD(null);   // {mode, version}
  const vs = firmware.versions || [];
  if (vs.length === 0) return <div className="empty">No versions uploaded yet for this firmware.</div>;

  // ── Publish / Edit audience — writes publishedToIsoIds + appends publishEvents.
  // Edit-mode with 0 ISOs left = unpublish (treats it as a takedown).
  const applyAudience = (v, mode, isoIds, note) => {
    const now = new Date().toISOString();
    const wasIds = v.publishedToIsoIds || [];
    const sameSet = wasIds.length === isoIds.length && wasIds.every(id => isoIds.includes(id));
    if (mode === 'edit' && sameSet && !note) {
      toast({ kind: 'info', title: 'No changes', msg: 'Audience is unchanged.' });
      return;
    }
    // Auto-unpublish when an edit clears the audience entirely.
    if (mode === 'edit' && isoIds.length === 0) {
      const ev = { at: now, by: CURRENT_USER_FW, action: 'unpublish', isoIds: [], ...(note ? { note } : {}) };
      onMutateFirmware && onMutateFirmware((fw) => ({
        ...fw,
        versions: fw.versions.map((s) => s.id === v.id
          ? {
              ...s,
              status: 'pending-publish',
              current: false,
              publishedToIsoIds: [],
              publishEvents: [...(s.publishEvents || []), ev],
            }
          : s),
      }));
      setPubDialog(null);
      toast({ kind: 'warning', title: `Unpublished · ${v.versionName}`, msg: 'Audience cleared — version is no longer visible to any ISO.' });
      return;
    }
    const action = mode === 'publish' ? 'publish' : 'audience-edit';
    const ev = { at: now, by: CURRENT_USER_FW, action, isoIds, ...(note ? { note } : {}) };
    onMutateFirmware && onMutateFirmware((fw) => ({
      ...fw,
      versions: fw.versions.map((s) => {
        if (s.id !== v.id) return mode === 'publish' && s.current ? { ...s, current: false } : s;
        return {
          ...s,
          status: 'published',
          publishedAt: s.publishedAt || now,
          publishedBy: s.publishedBy || CURRENT_USER_FW,
          current: mode === 'publish' ? true : s.current,
          publishedToIsoIds: isoIds,
          publishEvents: [...(s.publishEvents || []), ev],
        };
      }),
    }));
    setPubDialog(null);
    toast({
      kind: 'success',
      title: mode === 'publish' ? `Published · ${v.versionName}` : `Audience updated · ${v.versionName}`,
      msg: `Now visible to ${isoIds.length} ISO${isoIds.length === 1 ? '' : 's'}.`,
    });
  };

  // Unpublish: clear audience, drop back to pending-publish. The publishEvents
  // log keeps the full release history so the activity timeline stays intact.
  const doUnpublish = (v) => {
    const now = new Date().toISOString();
    const ev = { at: now, by: CURRENT_USER_FW, action: 'unpublish', isoIds: [] };
    onMutateFirmware && onMutateFirmware((fw) => ({
      ...fw,
      versions: fw.versions.map((s) => s.id === v.id
        ? {
            ...s,
            status: 'pending-publish',
            current: false,
            publishedToIsoIds: [],
            publishEvents: [...(s.publishEvents || []), ev],
          }
        : s),
    }));
    toast({ kind: 'warning', title: `Unpublished · ${v.versionName}`, msg: 'ISOs will no longer see this version. Already-rolled-out terminals are unaffected.' });
  };

  const doDelete = (v) => {
    onMutateFirmware && onMutateFirmware((fw) => ({
      ...fw,
      versions: fw.versions.filter((s) => s.id !== v.id),
    }));
    setConfirmDelete(null);
    toast({ kind: 'success', title: `Deleted · ${v.versionName}`, msg: 'Version removed from this firmware.' });
  };

  return (
    <>
      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Version</th>
              <th style={{ width: '12%' }}>Size</th>
              <th style={{ width: '18%' }}>Uploaded</th>
              <th style={{ width: '12%' }}>Status</th>
              <th style={{ width: '20%' }}>Published to</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vs.map(v => {
              const st = window.FW_VERSION_TONE[v.status] || { label: v.status, tone: 'neutral' };
              const isPending = v.status === 'pending-publish';
              const isPublished = v.status === 'published';
              const audience = window.getVersionAudience(v);
              const audCount = audience.length;
              return (
                <tr key={v.id} onClick={() => onOpenVersion(v.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{v.versionName}</span>
                      {v.current && <Badge tone="info" dot>Current</Badge>}
                    </div>
                  </td>
                  <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{v.fileSize}</span></td>
                  <td><span style={{ fontSize: 12.5 }}>{fmtDate(v.uploadedAt)}</span></td>
                  <td><Badge tone={st.tone} dot>{st.label}</Badge></td>
                  <td>
                    {audCount === 0 ? (
                      <span className="muted" style={{ fontSize: 12 }}>—</span>
                    ) : (
                      <FwAudienceSummary audience={audience}/>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      {isPending && (
                        <button type="button" className="fwv-act fwv-act--primary" onClick={() => setPubDialog({ mode: 'publish', version: v })}>
                          <Icon name="bolt" size={11}/> Publish
                        </button>
                      )}
                      {isPublished && (
                        <>
                          <button type="button" className="fwv-act fwv-act--primary" onClick={() => setPubDialog({ mode: 'edit', version: v })}>
                            <Icon name="bolt" size={11}/> Publish
                          </button>
                          <button type="button" className="fwv-act" onClick={() => setConfirmUnpub(v)}>
                            <Icon name="x" size={11}/> Unpublish
                          </button>
                        </>
                      )}
                      <button type="button" className="fwv-act fwv-act--danger" onClick={() => setConfirmDelete({ versionId: v.id, name: v.versionName })}>
                        <Icon name="trash" size={11}/> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmUnpub && (
        <Modal open={true} onClose={() => setConfirmUnpub(null)} width={480}
          title="Unpublish version?"
          footer={
            <>
              <Btn variant="ghost" onClick={() => setConfirmUnpub(null)}>Cancel</Btn>
              <Btn variant="danger" icon="x" onClick={() => { doUnpublish(confirmUnpub); setConfirmUnpub(null); }}>Unpublish</Btn>
            </>
          }>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            About to unpublish <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{confirmUnpub.versionName}</strong> from <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{(confirmUnpub.publishedToIsoIds || []).length} ISO{(confirmUnpub.publishedToIsoIds || []).length === 1 ? '' : 's'}</strong>.<br/><br/>
            The version drops back to <strong>Pending publish</strong> and will no longer be visible in any ISO's OTA management menu. Already-rolled-out terminals keep running this version. Release history is preserved — you can re-publish later.
          </div>
        </Modal>
      )}

      {pubDialog && window.FirmwarePublishDialog && (
        <window.FirmwarePublishDialog
          open={true}
          mode={pubDialog.mode}
          firmware={firmware}
          version={pubDialog.version}
          initialIsoIds={pubDialog.version.publishedToIsoIds || []}
          onClose={() => setPubDialog(null)}
          onConfirm={({ isoIds, note }) => applyAudience(pubDialog.version, pubDialog.mode, isoIds, note)}
        />
      )}

      {confirmDelete && (
        <Modal open={true} onClose={() => setConfirmDelete(null)} width={460}
          title="Delete firmware version?"
          footer={
            <>
              <Btn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
              <Btn variant="danger" icon="trash" onClick={() => {
                const v = vs.find(x => x.id === confirmDelete.versionId);
                if (v) doDelete(v);
              }}>Delete version</Btn>
            </>
          }>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            About to delete <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{confirmDelete.name}</strong>. This removes the firmware bundle and its history. ISOs that have already rolled out this version to terminals are unaffected, but the version will disappear from their App Store / OTA management menu.
          </div>
        </Modal>
      )}

      <style>{`
        .fwv-act { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--color-border-default); background: var(--color-bg-2); color: var(--color-text-secondary); font: 500 11.5px var(--font-family-sans); cursor: pointer; transition: all 0.12s; }
        .fwv-act:hover { border-color: var(--color-border-strong); color: var(--color-text-primary); }
        .fwv-act--primary { background: var(--color-primary-700, oklch(45% 0.16 262)); border-color: var(--color-primary-700, oklch(45% 0.16 262)); color: #fff; }
        .fwv-act--primary:hover { background: oklch(40% 0.18 262); color: #fff; }
        .fwv-act--danger:hover { border-color: var(--color-error-500, oklch(58% 0.22 25)); color: var(--color-error-700, oklch(45% 0.22 25)); }

        .fwv-aud { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
        .fwv-aud__name {
          font-size: 12.5px; color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          min-width: 0;
        }
        .fwv-aud__plus {
          margin-left: 4px; color: var(--color-text-tertiary);
          font-family: var(--font-family-mono); font-size: 11.5px;
        }
      `}</style>
    </>
  );
};

// ─── Activity tab ─────────────────────────────────────────
const FW_ACTIVITY_TONE = {
  uploaded:        { tone: 'info',    label: 'Uploaded' },
  published:       { tone: 'success', label: 'Published' },
  'audience-edit': { tone: 'info',    label: 'Audience edited' },
  unpublished:     { tone: 'warning', label: 'Unpublished' },  // event in publishEvents, not a status
};

const TabFwActivity = ({ firmware }) => {
  const events = useMemoFD(() => window.buildFirmwareActivity(firmware), [firmware]);
  return (
    <div className="info-card">
      <div className="info-card__head">
        <div className="info-card__title">Activity timeline</div>
        <span className="muted" style={{ fontSize: 12 }}>{events.length} event{events.length === 1 ? '' : 's'}</span>
      </div>
      <div className="info-card__body">
        <div className="timeline">
          {events.map((e, i) => {
            const meta = FW_ACTIVITY_TONE[e.kind] || { tone: 'neutral', label: e.kind };
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
const FirmwareDetail = ({ firmware, initialTab, onBack, onOpenVersion, onMutateVersion, onMutateFirmware }) => {
  const [tab, setTab] = useStateFD(initialTab || 'overview');
  const latest = window.getFirmwareLatest(firmware);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'versions', label: 'Versions', count: firmware.versions.length },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12.5px var(--font-family-sans)' }}>
          <Icon name="chevL" size={14}/> Back to Firmware
        </button>
      </div>

      <div className="det-header">
        <div className="fw-bigtile">{firmware.modelCode}</div>
        <div className="det-header__main">
          <h1 className="det-header__title">
            {firmware.modelCode} · {firmware.deviceFlag}
            <Badge tone={window.FW_OS_TONE[firmware.os]} dot>{firmware.os}</Badge>
          </h1>
          <div className="det-header__meta">
            <span>
              <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, padding: '1px 6px', background: 'var(--color-bg-3)', borderRadius: 4, border: '1px solid var(--color-border-subtle)' }}>
                {window.FW_OS_META[firmware.os].pattern}
              </code>
            </span>
            {latest && (<>
              <span>·</span>
              <span>Latest <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{latest.versionName}</strong></span>
            </>)}
            <span>·</span>
            <span><strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{firmware.versions.length}</strong> version{firmware.versions.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div className="det-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tds-tab ${tab === t.id ? 'tds-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.count !== undefined && <span style={{ marginLeft: 6, fontFamily: 'var(--font-family-mono)', fontWeight: 400, opacity: 0.7 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <TabFwOverview  firmware={firmware} onOpenVersion={onOpenVersion}/>}
      {tab === 'versions' && <TabFwVersions  firmware={firmware} onOpenVersion={onOpenVersion} onMutateFirmware={onMutateFirmware}/>}
      {tab === 'activity' && <TabFwActivity  firmware={firmware}/>}

      <style>{`
        .fw-bigtile { width: 56px; height: 56px; border-radius: 12px; display: grid; place-items: center;
          background: linear-gradient(135deg, oklch(70% 0.06 250), oklch(58% 0.10 250));
          color: #fff; font: 700 14px var(--font-family-mono); letter-spacing: -0.01em;
          box-shadow: 0 1px 3px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18);
          flex: none; }
        .fw-code { font-family: var(--font-family-mono); font-size: 12.5px; padding: 2px 7px;
          background: var(--color-bg-3); border-radius: 4px; border: 1px solid var(--color-border-subtle); }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Version Detail — distinct page (firmware-version route).
// Mirrors version-detail.jsx (the App-version page) but specialised for
// firmware semantics: shows the sub-package list explicitly (the user-
// requested "子包列表 (文件名称, 文件大小, md5)"), or hides it for Linux.
// ─────────────────────────────────────────────────────────────
const FirmwareVersionDetail = ({ firmware, version, onBack, onOpenFirmware, onMutateFirmware }) => {
  const toast = useToast();
  const [pubDialog, setPubDialog] = useStateFD(null);  // { mode }
  const [confirmUnpub, setConfirmUnpub] = useStateFD(false);
  if (!version) {
    return (
      <div className="page">
        <div className="empty">Version not found. <a onClick={onBack} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to firmware</a></div>
      </div>
    );
  }
  const meta = window.FW_OS_META[firmware.os];
  const st = window.FW_VERSION_TONE[version.status] || { label: version.status, tone: 'neutral' };
  const audience = window.getVersionAudience(version);
  const audCount = audience.length;
  const isPublished = version.status === 'published';
  const isPending = version.status === 'pending-publish';
  // "Was previously published" — derived from history, not state.
  const wasPreviouslyPublished = isPending && (version.publishEvents || []).some(e => e.action === 'publish');

  // Publish / Edit audience persist via onMutateFirmware (same logic as the
  // Versions tab — kept here to keep the version-detail page self-sufficient).
  const applyAudience = ({ isoIds, note }) => {
    if (!pubDialog) return;
    const mode = pubDialog.mode;
    const now = new Date().toISOString();
    // Auto-unpublish when editing clears all ISOs.
    if (mode === 'edit' && isoIds.length === 0) {
      const ev = { at: now, by: CURRENT_USER_FW, action: 'unpublish', isoIds: [], ...(note ? { note } : {}) };
      onMutateFirmware && onMutateFirmware((fw) => ({
        ...fw,
        versions: fw.versions.map((s) => s.id === version.id
          ? {
              ...s,
              status: 'pending-publish',
              current: false,
              publishedToIsoIds: [],
              publishEvents: [...(s.publishEvents || []), ev],
            }
          : s),
      }));
      setPubDialog(null);
      toast({ kind: 'warning', title: `Unpublished · ${version.versionName}`, msg: 'Audience cleared — version is no longer visible to any ISO.' });
      return;
    }
    const action = mode === 'publish' ? 'publish' : 'audience-edit';
    const ev = { at: now, by: CURRENT_USER_FW, action, isoIds, ...(note ? { note } : {}) };
    onMutateFirmware && onMutateFirmware((fw) => ({
      ...fw,
      versions: fw.versions.map((s) => {
        if (s.id !== version.id) {
          return mode === 'publish' && s.current ? { ...s, current: false } : s;
        }
        return {
          ...s,
          status: 'published',
          publishedAt: s.publishedAt || now,
          publishedBy: s.publishedBy || CURRENT_USER_FW,
          current: mode === 'publish' ? true : s.current,
          publishedToIsoIds: isoIds,
          publishEvents: [...(s.publishEvents || []), ev],
        };
      }),
    }));
    setPubDialog(null);
    toast({
      kind: 'success',
      title: mode === 'publish' ? `Published · ${version.versionName}` : `Audience updated · ${version.versionName}`,
      msg: `Now visible to ${isoIds.length} ISO${isoIds.length === 1 ? '' : 's'}.`,
    });
  };

  const doUnpublish = () => {
    const now = new Date().toISOString();
    const ev = { at: now, by: CURRENT_USER_FW, action: 'unpublish', isoIds: [] };
    onMutateFirmware && onMutateFirmware((fw) => ({
      ...fw,
      versions: fw.versions.map((s) => s.id === version.id
        ? {
            ...s,
            status: 'pending-publish',
            current: false,
            publishedToIsoIds: [],
            publishEvents: [...(s.publishEvents || []), ev],
          }
        : s),
    }));
    toast({ kind: 'warning', title: `Unpublished · ${version.versionName}`, msg: 'ISOs will no longer see this version.' });
  };

  // Publish/audience events from the version's history — surfaced in the
  // Timeline panel alongside upload/manifest rows.
  const publishHistoryRows = (version.publishEvents || []).map(ev => {
    if (ev.action === 'publish') {
      return { icon: 'bolt', at: ev.at, who: ev.by, text: `Published to ${ev.isoIds.length} ISO${ev.isoIds.length === 1 ? '' : 's'}`, note: ev.note };
    }
    if (ev.action === 'audience-edit') {
      return { icon: 'settings', at: ev.at, who: ev.by, text: `Audience updated · ${ev.isoIds.length} ISO${ev.isoIds.length === 1 ? '' : 's'}`, note: ev.note };
    }
    return { icon: 'x', at: ev.at, who: ev.by, text: 'Unpublished', note: ev.note };
  });

  const timeline = [
    version.uploadedAt && { icon: 'upload',  text: 'Firmware bundle uploaded',                                                                                          at: version.uploadedAt, who: version.uploadedBy },
    version.uploadedAt && { icon: 'shield',  text: `Manifest parsed · ${version.packages.length} sub-package${version.packages.length === 1 ? '' : 's'}, MD5 verified`, at: version.uploadedAt, who: 'system' },
    ...publishHistoryRows,
  ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12.5px var(--font-family-sans)' }}>
          <Icon name="chevL" size={14}/> Back to {firmware.modelCode} · {firmware.deviceFlag}
        </button>
      </div>

      <div className="det-header">
        <div className="fw-bigtile">{firmware.modelCode}</div>
        <div className="det-header__main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <button type="button" className="ad-pub-link" onClick={() => onOpenFirmware(firmware.id)} style={{ fontSize: 13 }}>
              {firmware.modelCode} · {firmware.deviceFlag}
            </button>
            <Icon name="chevR" size={11} style={{ color: 'var(--color-text-tertiary)' }}/>
            <h1 className="det-header__title" style={{ margin: 0, fontFamily: 'var(--font-family-mono)' }}>
              {version.versionName}
            </h1>
            <Badge tone={st.tone} dot>{st.label}</Badge>
            {version.current && <Badge tone="info" dot>Current</Badge>}
            <Badge tone={window.FW_OS_TONE[firmware.os]} dot>{firmware.os}</Badge>
          </div>
          <div className="det-header__meta">
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{version.fileName}</span>
          </div>
        </div>
        <div className="page__actions" style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" icon="download">Download</Btn>
          {isPending && (
            <Btn variant="primary" icon="bolt" onClick={() => setPubDialog({ mode: 'publish' })}>Publish</Btn>
          )}
          {isPublished && (
            <>
              <Btn variant="primary" icon="bolt" onClick={() => setPubDialog({ mode: 'edit' })}>Publish</Btn>
              <Btn variant="ghost" icon="x" onClick={() => setConfirmUnpub(true)}>Unpublish</Btn>
            </>
          )}
        </div>
      </div>

      <div className="vd-grid">
        {/* LEFT — narrative */}
        <div className="stack" style={{ gap: 16 }}>

          {/* Publish audience */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Icon name="bolt" size={14}/> Publish audience
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {isPublished
                  ? <><strong style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontFamily: 'var(--font-family-mono)' }}>{audCount}</strong> ISO{audCount === 1 ? '' : 's'}</>
                  : wasPreviouslyPublished ? 'Previously released'
                  : 'Not yet released'}
              </span>
            </div>
            <div className="info-card__body">
              {isPending && !wasPreviouslyPublished && (
                <div className="fwvd-pub-empty">
                  <Icon name="info" size={14}/>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>Pending publish — not visible to any ISO yet</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Use <strong>Publish</strong> (top right) to pick which ISO customers can see this version in their OTA management menu.</div>
                  </div>
                </div>
              )}
              {isPending && wasPreviouslyPublished && (
                <div className="fwvd-pub-empty fwvd-pub-empty--warn">
                  <Icon name="info" size={14}/>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>Previously released — currently hidden from all ISOs</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Already-rolled-out terminals keep running this version. Use <strong>Publish</strong> to re-release it. Activity tab shows the full release history.</div>
                  </div>
                </div>
              )}
              {isPublished && audCount === 0 && (
                <div className="fwvd-pub-empty fwvd-pub-empty--warn">
                  <Icon name="info" size={14}/>
                  <div>Published with no audience. Use <strong>Edit audience</strong> to assign ISOs.</div>
                </div>
              )}
              {isPublished && audCount > 0 && (
                <div className="fwvd-aud-grid">
                  {audience.map(c => (
                    <div key={c.id} className="fwvd-aud-card">
                      <CompanyLogo name={c.name} size={32}/>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{c.country || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Build metadata — ALL of the user-requested fields */}
          <div className="info-card">
            <div className="info-card__head">
              <div className="info-card__title">Build metadata</div>
            </div>
            <div className="info-card__body">
              <div className="fwvd-kvgrid">
                <KVCell label="Version name" value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.versionName}</span>}/>
                <KVCell label="Model code"   value={<code className="fw-code">{firmware.modelCode}</code>}/>
                <KVCell label="Device flag"  value={<code className="fw-code">{firmware.deviceFlag}</code>}/>
                <KVCell label="File size"    value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.fileSize}</span>}/>
                <KVCell label="File name"    value={<span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, wordBreak: 'break-all' }}>{version.fileName}</span>} wide/>
                <KVCell label="MD5"          value={<span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{version.md5}</span>} wide/>
                <KVCell label="Uploaded"     value={fmtDateTime(version.uploadedAt)}/>
                {firmware.os === 'LINUX' && version.versionStart && (
                  <>
                    <KVCell label="Start version" value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.versionStart}</span>}/>
                    <KVCell label="End version"   value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{version.versionEnd}</span>}/>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sub-package list (Android / RTOS only — Linux has none) */}
          {meta.hasSubPackages ? (
            <div className="info-card">
              <div className="info-card__head">
                <div className="info-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Icon name="package" size={14}/> Sub-packages
                </div>
                <span className="muted" style={{ fontSize: 11.5, fontFamily: 'var(--font-family-mono)' }}>{version.packages.length} files</span>
              </div>
              <div className="info-card__body" style={{ padding: 0 }}>
                <table className="tds-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>File name</th>
                      <th style={{ width: '18%' }}>Size</th>
                      <th>MD5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.packages.map((p, i) => (
                      <tr key={i}>
                        <td><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="file" size={11}/> {p.name}</span></td>
                        <td><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{p.size}</span></td>
                        <td><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{p.md5}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="info-card">
              <div className="info-card__head">
                <div className="info-card__title">Sub-packages</div>
              </div>
              <div className="info-card__body">
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
                  <Icon name="info" size={14} style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}/>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    Linux MAN patches ship as a single monolithic <code style={{ fontFamily: 'var(--font-family-mono)' }}>.NLD</code> bundle. There is no sub-package breakdown — the file's overall MD5 above is the integrity check.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Changelog */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Changelog</div></div>
            <div className="info-card__body">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                {version.changelog || 'No changelog.'}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — timeline */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Timeline</div></div>
            <div className="info-card__body" style={{ padding: 0 }}>
              {timeline.map((e, i) => (
                <div key={i} className="vd-tl-row">
                  <div className="vd-tl-row__icon"><Icon name={e.icon} size={11}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{e.text}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>
                      <span style={{ fontFamily: 'var(--font-family-mono)' }}>{fmtDateTime(e.at)}</span> · by <strong style={{ fontWeight: 500 }}>{e.who}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .fwvd-kvgrid { display: grid; grid-template-columns: 160px 1fr 160px 1fr; row-gap: 14px; column-gap: 24px; }
        @media (max-width: 720px) { .fwvd-kvgrid { grid-template-columns: 140px 1fr; } }

        .fwvd-pub-empty {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 8px;
          background: oklch(96% 0.02 252 / 0.5);
          border: 1px solid oklch(58% 0.10 252 / 0.20);
          color: oklch(40% 0.14 252);
          font-size: 12.5px; line-height: 1.55;
        }
        .fwvd-pub-empty--warn {
          background: oklch(96% 0.04 80 / 0.5);
          border-color: oklch(60% 0.14 80 / 0.30);
          color: oklch(42% 0.16 80);
        }
        [data-theme="dark"] .fwvd-pub-empty { background: oklch(28% 0.04 252 / 0.4); color: oklch(78% 0.10 252); }
        [data-theme="dark"] .fwvd-pub-empty--warn { background: oklch(28% 0.06 80 / 0.4); color: oklch(82% 0.12 80); }

        .fwvd-aud-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 8px;
        }
        .fwvd-aud-card {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          background: var(--color-bg-1); border: 1px solid var(--color-border-subtle);
        }
      `}</style>

      {pubDialog && window.FirmwarePublishDialog && (
        <window.FirmwarePublishDialog
          open={true}
          mode={pubDialog.mode}
          firmware={firmware}
          version={version}
          initialIsoIds={version.publishedToIsoIds || []}
          onClose={() => setPubDialog(null)}
          onConfirm={applyAudience}
        />
      )}

      {confirmUnpub && (
        <Modal open={true} onClose={() => setConfirmUnpub(false)} width={480}
          title="Unpublish version?"
          footer={
            <>
              <Btn variant="ghost" onClick={() => setConfirmUnpub(false)}>Cancel</Btn>
              <Btn variant="danger" icon="x" onClick={() => { doUnpublish(); setConfirmUnpub(false); }}>Unpublish</Btn>
            </>
          }>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            About to unpublish <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{version.versionName}</strong> from <strong style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{audCount} ISO{audCount === 1 ? '' : 's'}</strong>.<br/><br/>
            The version drops back to <strong>Pending publish</strong> and will no longer be visible in any ISO's OTA management menu. Already-rolled-out terminals keep running this version. Release history is preserved — you can re-publish later.
          </div>
        </Modal>
      )}
    </div>
  );
};

const KVCell = ({ label, value, wide }) => (
  <>
    <div style={{ font: '500 11px var(--font-family-sans)', color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center' }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', alignSelf: 'center', gridColumn: wide ? 'span 3' : 'auto' }}>{value}</div>
  </>
);

Object.assign(window, { FirmwareDetail, FirmwareVersionDetail });
