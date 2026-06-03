/* global React, Btn, Input, Field, Icon, Badge, CompanyLogo, useToast */
// ─────────────────────────────────────────────────────────────
// New Factory Image — single-page form.
//
// Sections:
//   Identity        — name (required)
//   ISO customer    — single (optional)
//   Model bundle    — single model, then pick N firmware device flags
//                     (multi-select; one version per flag) + N sys apps + N ISV apps.
//
// Constraints enforced:
//   • ≤ 1 ISO customer per factory image
//   • ≤ 1 model per factory image
//   • ≤ 1 firmware version per (model + device flag)
// ─────────────────────────────────────────────────────────────
const { useState: useStateFW, useMemo: useMemoFW } = React;

const FactoryImageWizard = ({ existingImages, onCancel, onComplete }) => {
  const toast = useToast();
  const allModels  = window.getFactoryImageKnownModels?.() || [];
  const firmwares  = window.SEED_FIRMWARE || [];
  const systemApps = window.SYSTEM_APPS || [];
  const isvApps    = (window.SEED_APPS || []).filter(a => a.status === 'published');
  const isos       = window.getFactoryImageEligibleIsos();
  const [form, setForm] = useStateFW({
    name: '',
    isoCustomerIds: [],
    byModel: {},   // { 'N950': { firmwareRefs, systemAppRefs, isvAppRefs } }
  });

  const [isoQ, setIsoQ] = useStateFW('');

  const selectedIsoId = form.isoCustomerIds[0] || '';
  const pickIso = (id) => {
    setForm(f => ({ ...f, isoCustomerIds: id ? [id] : [] }));
  };
  const filteredIsos = isos.filter(c => !isoQ.trim() || c.name.toLowerCase().includes(isoQ.toLowerCase()));

  const addedModels = Object.keys(form.byModel);
  const selectedModel = addedModels[0] || '';

  const pickModel = (modelCode) => {
    if (!modelCode) {
      setForm(f => ({ ...f, byModel: {} }));
      return;
    }
    if (form.byModel[modelCode]) return;
    // Replace whatever was there — single-model only.
    setForm(f => ({
      ...f,
      byModel: { [modelCode]: { firmwareRefs: [], systemAppRefs: [], isvAppRefs: [] } },
    }));
  };

  const removeModel = () => {
    setForm(f => ({ ...f, byModel: {} }));
  };

  // Single-select: at most one firmware (one device flag) per model.
  const toggleFirmwareSku = (modelCode, firmwareId, defaultVersionId) => {
    setForm(f => {
      const b = f.byModel[modelCode] || { firmwareRefs: [], systemAppRefs: [], isvAppRefs: [] };
      const current = (b.firmwareRefs || [])[0];
      const isSame = current && current.firmwareId === firmwareId;
      const next = isSame ? [] : [{ firmwareId, versionId: defaultVersionId }];
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...b, firmwareRefs: next } } };
    });
  };
  const changeFirmwareVersion = (modelCode, firmwareId, newVersionId) => {
    setForm(f => {
      const b = f.byModel[modelCode];
      const next = (b.firmwareRefs || []).map(r => r.firmwareId === firmwareId ? { ...r, versionId: newVersionId } : r);
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...b, firmwareRefs: next } } };
    });
  };

  const toggleSysApp = (modelCode, appId, versionId) => {
    setForm(f => {
      const bundle = f.byModel[modelCode] || { firmwareRefs: [], systemAppRefs: [], isvAppRefs: [] };
      const has = bundle.systemAppRefs.some(r => r.appId === appId);
      const next = has
        ? bundle.systemAppRefs.filter(r => r.appId !== appId)
        : [...bundle.systemAppRefs, { appId, versionId }];
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...bundle, systemAppRefs: next } } };
    });
  };
  const changeSysAppVersion = (modelCode, appId, newVersionId) => {
    setForm(f => {
      const bundle = f.byModel[modelCode];
      if (!bundle) return f;
      const next = bundle.systemAppRefs.map(r => r.appId === appId ? { ...r, versionId: newVersionId } : r);
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...bundle, systemAppRefs: next } } };
    });
  };
  const toggleIsvApp = (modelCode, appId, versionId) => {
    setForm(f => {
      const bundle = f.byModel[modelCode] || { firmwareRefs: [], systemAppRefs: [], isvAppRefs: [] };
      const has = bundle.isvAppRefs.some(r => r.appId === appId);
      const next = has
        ? bundle.isvAppRefs.filter(r => r.appId !== appId)
        : [...bundle.isvAppRefs, { appId, versionId }];
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...bundle, isvAppRefs: next } } };
    });
  };
  const changeIsvAppVersion = (modelCode, appId, newVersionId) => {
    setForm(f => {
      const bundle = f.byModel[modelCode];
      if (!bundle) return f;
      const next = bundle.isvAppRefs.map(r => r.appId === appId ? { ...r, versionId: newVersionId } : r);
      return { ...f, byModel: { ...f.byModel, [modelCode]: { ...bundle, isvAppRefs: next } } };
    });
  };

  const totalPackages = useMemoFW(() => {
    let n = 0;
    for (const b of Object.values(form.byModel)) {
      n += (b.firmwareRefs || []).length;
      n += b.systemAppRefs.length;
      n += b.isvAppRefs.length;
    }
    return n;
  }, [form.byModel]);

  const canCreate = form.name.trim().length > 0;

  const submit = () => {
    const now = new Date().toISOString();
    const nextNum = String(((window.SEED_FACTORY_IMAGES || []).length + (existingImages?.length || 0) + 10)).padStart(4, '0');
    const id = `FI-2026-${nextNum}`;
    const token = `qr_${id.toLowerCase().replace(/-/g, '')}_${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();

    const fi = {
      id,
      name: form.name.trim(),
      isoCustomerIds: form.isoCustomerIds,
      payload: { byModel: { ...form.byModel } },
      qr: { token, expiresAt },
      ownerEmail: 'jordan.diaz@carbon',
      createdAt: now, createdBy: 'jordan.diaz@carbon',
      updatedAt: now, updatedBy: 'jordan.diaz@carbon',
      events: [{ at: now, kind: 'created', actor: 'jordan.diaz@carbon', text: 'Created' }],
    };

    onComplete(fi);
    toast({
      kind: 'success',
      title: `${id} created`,
      msg: !selectedModel
        ? 'Empty image — add a model and packages later.'
        : `Image for ${selectedModel} ready.`,
    });
  };

  return (
    <div className="page fw-page">
      <div className="page__head">
        <div>
          <h1 className="page__title">New factory image</h1>
          <p className="page__sub">
            Declare what the factory should pre-install on this batch of devices. The same image can span multiple models — each model gets its own firmware + app bundle.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 16, paddingBottom: 88 }}>

        {/* ── Identity ──────────────────────────────────── */}
        <div className="info-card">
          <div className="info-card__head"><div className="info-card__title">Identity</div></div>
          <div className="info-card__body">
            <Field label="Image name" required>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. NA Universal Baseline · Q3"
                size="md"
                autoFocus/>
            </Field>
          </div>
        </div>

        {/* ── ISO customer ──────────────────────────────── */}
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">ISO customer <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>Optional</span></div>
            {selectedIsoId
              ? <button type="button" className="fw-clear-link" onClick={() => pickIso('')}>Clear</button>
              : <span className="muted" style={{ fontSize: 12 }}>None selected</span>}
          </div>
          <div className="info-card__body">
            <div className="fw-iso-help">
              <Icon name="info" size={13}/>
              <span>An ISO can be bound to multiple factory images (different procurement batches). Selecting an ISO here means devices provisioned with this image will be associated to it from Day 0.</span>
            </div>
            <Input prefix={<Icon name="search" size={14}/>} placeholder="Search ISOs…" value={isoQ} onChange={e => setIsoQ(e.target.value)} size="md"/>
            <div className="fw-iso-list">
              {filteredIsos.length === 0 ? (
                <div className="empty" style={{ padding: 18 }}>No ISOs match.</div>
              ) : filteredIsos.map(c => {
                const on = selectedIsoId === c.id;
                return (
                  <label key={c.id} className={`fw-row fw-row--card ${on ? 'is-on' : ''}`}>
                    <input type="radio" name="fw-iso-pick" checked={on}
                      onChange={() => pickIso(c.id)}
                      onClick={() => { if (on) pickIso(''); }}/>
                    <CompanyLogo name={c.name} size={28}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{c.country}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Model bundle ──────────────────────────────── */}
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Model bundle <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>Optional</span></div>
            <span className="muted" style={{ fontSize: 12 }}>
              {selectedModel
                ? <><strong style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontFamily: 'var(--font-family-mono)' }}>{selectedModel}</strong> · {totalPackages} package{totalPackages === 1 ? '' : 's'}</>
                : 'No model selected'}
            </span>
          </div>
          <div className="info-card__body">
            <div className="fw-iso-help">
              <Icon name="info" size={13}/>
              <span>One model per factory image. You can bundle multiple firmware variants for that model — one per device flag (e.g. A10 and A12 Android lines) — plus system and ISV apps.</span>
            </div>

            {/* Model picker */}
            <Field label="Model">
              <div className="tds-select tds-select--md" style={{ maxWidth: 320 }}>
                <select value={selectedModel} onChange={e => pickModel(e.target.value)}>
                  <option value="">Select a model…</option>
                  {allModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="tds-select__chevron"><Icon name="chevD" size={14}/></span>
              </div>
            </Field>

            {selectedModel && (
              <div className="fw-model-stack" style={{ marginTop: 12 }}>
                <ModelBundleCard
                  modelCode={selectedModel}
                  bundle={form.byModel[selectedModel]}
                  firmwares={firmwares}
                  systemApps={systemApps}
                  isvApps={isvApps}
                  expanded={true}
                  singleMode={true}
                  onToggle={() => {}}
                  onRemove={removeModel}
                  onToggleFirmware={(fwId, vId) => toggleFirmwareSku(selectedModel, fwId, vId)}
                  onChangeFirmwareVersion={(fwId, vId) => changeFirmwareVersion(selectedModel, fwId, vId)}
                  onToggleSysApp={(appId, vId) => toggleSysApp(selectedModel, appId, vId)}
                  onChangeSysAppVersion={(appId, vId) => changeSysAppVersion(selectedModel, appId, vId)}
                  onToggleIsvApp={(appId, vId) => toggleIsvApp(selectedModel, appId, vId)}
                  onChangeIsvAppVersion={(appId, vId) => changeIsvAppVersion(selectedModel, appId, vId)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fw-sticky">
        <div className="fw-sticky__inner">
          <div className="fw-sticky__summary">
            <span className="fw-sticky__label">Will create:</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{form.name.trim() || <span className="muted">Untitled</span>}</strong>
            <span className="fw-sticky__sep">·</span>
            <span className="fw-sticky__stats">
              {selectedModel
                ? <>{selectedModel} · {totalPackages} pkg{totalPackages === 1 ? '' : 's'}</>
                : <span className="muted">no model</span>}
              <span className="fw-sticky__sep">·</span>
              {selectedIsoId
                ? <>1 ISO</>
                : <span className="muted">no ISO</span>}
            </span>
          </div>
          <div className="fw-sticky__actions">
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
            <Btn variant="primary" icon="check" disabled={!canCreate} onClick={submit}>Create factory image</Btn>
          </div>
        </div>
      </div>

      <style>{`
        .fw-page { padding-bottom: 100px; }

        .fw-iso-help {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; border-radius: 8px;
          background: oklch(96% 0.02 252 / 0.5); border: 1px solid oklch(58% 0.10 252 / 0.20);
          color: oklch(40% 0.14 252); font-size: 12px; line-height: 1.5;
          margin-bottom: 12px;
        }
        [data-theme="dark"] .fw-iso-help { background: oklch(28% 0.04 252 / 0.4); color: oklch(78% 0.10 252); }

        .fw-iso-list {
          margin-top: 10px; max-height: 280px; overflow: auto;
          border: 1px solid var(--color-border-subtle); border-radius: 8px;
        }
        .fw-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; border-bottom: 1px solid var(--color-border-subtle);
          cursor: pointer; transition: background 0.1s;
        }
        .fw-row:last-child { border-bottom: 0; }
        .fw-row:hover { background: var(--color-bg-3); }
        .fw-row.is-on { background: var(--color-primary-50, oklch(96% 0.02 262)); }
        .fw-row input { accent-color: var(--color-primary-700); cursor: pointer; }
        .fw-row--card { padding: 10px 14px; }

        .fw-add-model {
          display: flex; gap: 8px; margin-bottom: 14px;
        }

        .fw-clear-link {
          border: 0; background: transparent; cursor: pointer;
          font-size: 12px; color: var(--color-text-tertiary);
          padding: 2px 6px; border-radius: 4px;
        }
        .fw-clear-link:hover { background: var(--color-bg-3); color: var(--color-text-secondary); }

        .fw-model-stack { display: flex; flex-direction: column; gap: 10px; }

        .fw-sticky {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: var(--color-bg-1);
          border-top: 1px solid var(--color-border-default);
          z-index: 10; padding: 12px 32px;
          box-shadow: 0 -4px 12px -4px oklch(0% 0 0 / 0.08);
        }
        [data-theme="dark"] .fw-sticky { box-shadow: 0 -4px 12px -4px oklch(0% 0 0 / 0.4); }
        .fw-sticky__inner {
          max-width: 1200px; margin: 0 auto;
          display: flex; align-items: center; gap: 24px;
        }
        .fw-sticky__summary {
          flex: 1; min-width: 0;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          font-size: 12.5px; color: var(--color-text-secondary);
          overflow: hidden;
        }
        .fw-sticky__label {
          font-size: 11px; color: var(--color-text-tertiary);
          text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
        }
        .fw-sticky__sep { color: var(--color-text-tertiary); }
        .fw-sticky__actions { display: flex; gap: 8px; flex: none; }
        @media (min-width: 980px) {
          .fw-sticky { left: var(--sidebar-width, 240px); }
        }
      `}</style>
    </div>
  );
};

// ─── ISV app picker (dense, searchable, with publisher info) ─────
// Used inside ModelBundleCard. Hoisted to its own component so it can
// own its search/filter state without bloating the parent.
const IsvAppPicker = ({ apps, selectedRefs, onToggle, onChangeVersion }) => {
  const [q, setQ] = React.useState('');
  const [pubFilter, setPubFilter] = React.useState('All');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);

  const selectedIds = React.useMemo(() => new Set(selectedRefs.map(r => r.appId)), [selectedRefs]);

  const publisherOpts = React.useMemo(() => {
    const map = new Map();
    apps.forEach(a => {
      const pub = window.getAppPublisher?.(a);
      if (pub) map.set(pub.id, pub.name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [apps]);

  const filtered = React.useMemo(() => {
    return apps.filter(a => {
      if (showSelectedOnly && !selectedIds.has(a.id)) return false;
      if (pubFilter !== 'All' && a.publisherCustomerId !== pubFilter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const pub = window.getAppPublisher?.(a);
        return (
          a.name.toLowerCase().includes(s) ||
          (a.package || '').toLowerCase().includes(s) ||
          (pub?.name || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [apps, q, pubFilter, showSelectedOnly, selectedIds]);

  return (
    <div className="fw-isv">
      <div className="fw-isv__toolbar">
        <Input prefix={<Icon name="search" size={13}/>} placeholder="Search apps, package, publisher…"
          value={q} onChange={e => setQ(e.target.value)} size="sm"/>
        <div className="tds-select tds-select--sm" style={{ minWidth: 160 }}>
          <select value={pubFilter} onChange={e => setPubFilter(e.target.value)}>
            <option value="All">All publishers</option>
            {publisherOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
        </div>
        <label className={`fw-isv__chip ${showSelectedOnly ? 'is-on' : ''}`}>
          <input type="checkbox" checked={showSelectedOnly} onChange={e => setShowSelectedOnly(e.target.checked)}/>
          Selected only
          <span className="fw-isv__count">{selectedIds.size}</span>
        </label>
      </div>

      <div className="fw-isv__list">
        {filtered.length === 0 ? (
          <div className="empty" style={{ padding: 18, fontSize: 12.5 }}>
            {showSelectedOnly && selectedIds.size === 0 ? 'No apps selected yet.' : 'No apps match your filters.'}
          </div>
        ) : filtered.map(app => {
          const pubVers = (app.versions || []).filter(v => v.status === 'published');
          if (pubVers.length === 0) return null;
          const currentRef = selectedRefs.find(r => r.appId === app.id);
          const isOn = !!currentRef;
          const pub = window.getAppPublisher?.(app);
          return (
            <label key={app.id} className={`fw-isv__row ${isOn ? 'is-on' : ''}`}>
              <input type="checkbox" checked={isOn} onChange={() => {
                if (isOn) onToggle(app.id, currentRef.versionId);
                else onToggle(app.id, pubVers[0].id);
              }}/>
              <window.AppIcon app={app} size={32}/>
              <div className="fw-isv__meta">
                <div className="fw-isv__name">{app.name}</div>
                <div className="fw-isv__sub">
                  <span className="fw-isv__pkg">{app.package}</span>
                  {app.category && <span className="fw-isv__dot">·</span>}
                  {app.category && <span className="fw-isv__cat">{app.category}</span>}
                </div>
              </div>
              {pub && (
                <div className="fw-isv__pub" title={`Publisher: ${pub.name}`}>
                  <CompanyLogo name={pub.name} size={18}/>
                  <span className="fw-isv__pub-name">{pub.name}</span>
                </div>
              )}
              <div className="fw-isv__ver" onClick={e => e.preventDefault()}>
                {isOn ? (
                  <div className="tds-select tds-select--sm" style={{ width: 140 }}>
                    <select value={currentRef.versionId}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); onChangeVersion(app.id, e.target.value); }}>
                      {pubVers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {pubVers.length} version{pubVers.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <style>{`
        .fw-isv__toolbar {
          display: flex; gap: 8px; align-items: center; margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .fw-isv__toolbar > :first-child { flex: 1; min-width: 200px; }

        .fw-isv__chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 999px;
          border: 1px solid var(--color-border-subtle);
          background: var(--color-bg-1);
          font-size: 12px; color: var(--color-text-secondary);
          cursor: pointer; user-select: none;
        }
        .fw-isv__chip input { margin: 0; accent-color: var(--color-primary-700); cursor: pointer; }
        .fw-isv__chip.is-on {
          border-color: var(--color-text-primary);
          background: var(--color-primary-50, oklch(96% 0.02 262));
          color: var(--color-text-primary);
        }
        .fw-isv__count {
          display: inline-block; min-width: 18px; padding: 0 5px;
          background: var(--color-bg-3); border-radius: 999px;
          font-size: 10.5px; font-weight: 600; text-align: center; line-height: 16px;
          color: var(--color-text-secondary);
        }
        .fw-isv__chip.is-on .fw-isv__count {
          background: var(--color-text-primary); color: var(--color-bg-1);
        }

        .fw-isv__list {
          border: 1px solid var(--color-border-subtle); border-radius: 8px;
          background: var(--color-bg-1);
          max-height: 380px; overflow: auto;
        }
        .fw-isv__row {
          display: grid;
          grid-template-columns: auto 32px minmax(0, 1fr) auto auto;
          align-items: center; gap: 12px;
          padding: 9px 14px;
          border-bottom: 1px solid var(--color-border-subtle);
          cursor: pointer;
          transition: background 0.1s;
        }
        .fw-isv__row:last-child { border-bottom: 0; }
        .fw-isv__row:hover { background: var(--color-bg-3); }
        .fw-isv__row.is-on {
          background: var(--color-primary-50, oklch(96% 0.02 262));
        }
        .fw-isv__row input[type="checkbox"] {
          accent-color: var(--color-primary-700); cursor: pointer;
        }
        .fw-isv__meta { min-width: 0; }
        .fw-isv__name {
          font-size: 13px; font-weight: 500; color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fw-isv__sub {
          display: flex; align-items: center; gap: 5px; margin-top: 1px;
          font-size: 11px; color: var(--color-text-tertiary);
          white-space: nowrap; overflow: hidden;
        }
        .fw-isv__pkg { font-family: var(--font-family-mono); }
        .fw-isv__dot { opacity: 0.5; }
        .fw-isv__cat { text-transform: uppercase; letter-spacing: 0.03em; font-weight: 500; }

        .fw-isv__pub {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 8px; border-radius: 999px;
          background: var(--color-bg-2); border: 1px solid var(--color-border-subtle);
          font-size: 11px; color: var(--color-text-secondary);
          max-width: 160px;
        }
        .fw-isv__pub-name {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fw-isv__row.is-on .fw-isv__pub {
          background: var(--color-bg-1);
        }

        .fw-isv__ver { display: inline-flex; align-items: center; min-width: 70px; justify-content: flex-end; }

        @media (max-width: 720px) {
          .fw-isv__row { grid-template-columns: auto 32px minmax(0, 1fr) auto; }
          .fw-isv__pub { display: none; }
        }
      `}</style>
    </div>
  );
};

// ─── Per-model bundle card ──────────────────────────────
const ModelBundleCard = ({
  modelCode, bundle,
  firmwares, systemApps, isvApps,
  expanded, onToggle, onRemove,
  singleMode = false,
  onToggleFirmware, onChangeFirmwareVersion,
  onToggleSysApp, onChangeSysAppVersion,
  onToggleIsvApp, onChangeIsvAppVersion,
}) => {
  const fwForModel = firmwares.filter(f => f.modelCode === modelCode);
  const fwRefs = (bundle.firmwareRefs || []).slice(0, 1);  // single-select cap
  const currentFwId = fwRefs[0]?.firmwareId;

  const fwCount  = fwRefs.length;
  const sysCount = bundle.systemAppRefs.length;
  const isvCount = bundle.isvAppRefs.length;
  const pkgCount = fwCount + sysCount + isvCount;

  return (
    <div className="fw-mbc">
      <div className={`fw-mbc__head ${singleMode ? 'fw-mbc__head--static' : ''}`}
           onClick={singleMode ? undefined : onToggle}>
        {!singleMode && (
          <span className="fw-mbc__chev"><Icon name={expanded ? 'chevD' : 'chevR'} size={14}/></span>
        )}
        <span className="fw-mbc__model">{modelCode}</span>
        <span className="fw-mbc__count">
          {pkgCount} package{pkgCount === 1 ? '' : 's'}
          {fwCount > 0 && <span className="muted"> · 1 fw flag</span>}
        </span>
        <span style={{ flex: 1 }}/>
        {!singleMode && (
          <button type="button" className="fw-mbc__remove" onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove model">
            <Icon name="x" size={14}/>
          </button>
        )}
      </div>

      {expanded && (
        <div className="fw-mbc__body">
          {/* Firmware — single-select by device flag */}
          <div className="fw-mbc__section">
            <div className="fw-mbc__section-head">
              <span>Firmware</span>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 400 }}>
                {fwForModel.length === 0
                  ? 'No firmware available'
                  : currentFwId
                    ? `1 of ${fwForModel.length} device flag${fwForModel.length === 1 ? '' : 's'} selected`
                    : `Pick one of ${fwForModel.length} device flag${fwForModel.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {fwForModel.length === 0 ? (
              <div className="muted" style={{ padding: '8px 0', fontSize: 12.5 }}>No firmware available for {modelCode}.</div>
            ) : (
              <div className="fw-app-grid">
                {fwForModel.map(fw => {
                  const releasedVers = (fw.versions || []).filter(v => v.status === 'published' || v.current);
                  if (releasedVers.length === 0) return null;
                  const defaultV = releasedVers.find(v => v.current) || releasedVers[0];
                  const isSelected = currentFwId === fw.id;
                  const selectedVersionId = isSelected ? fwRefs[0].versionId : defaultV.id;
                  return (
                    <div key={fw.id} className={`fw-app-card ${isSelected ? 'is-on' : ''}`}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                        <input type="radio" name={`fw-pick-${modelCode}`} checked={isSelected}
                          onChange={() => { if (!isSelected) onToggleFirmware(fw.id, defaultV.id); }}
                          onClick={() => { if (isSelected) onToggleFirmware(fw.id, defaultV.id); }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500 }}>
                            <span style={{ fontFamily: 'var(--font-family-mono)' }}>{fw.deviceFlag}</span>
                          </div>
                          <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)', marginTop: 1 }}>
                            {fw.os || 'firmware'} · {releasedVers.length} version{releasedVers.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </label>
                      {isSelected && (
                        <div className="fw-app-card__ver">
                          <div className="tds-select tds-select--sm" style={{ width: '100%' }}>
                            <select value={selectedVersionId} onChange={e => onChangeFirmwareVersion(fw.id, e.target.value)}>
                              {releasedVers.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.versionName}{v.current ? ' · Current' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* System apps */}
          <div className="fw-mbc__section">
            <div className="fw-mbc__section-head">
              <span>System apps</span>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 400 }}>{sysCount} selected</span>
            </div>
            <div className="fw-app-grid">
              {systemApps.map(app => {
                const pubVers = (app.versions || []).filter(v => v.status === 'published');
                if (pubVers.length === 0) return null;
                // Restrict to apps that apply to this model
                const applies = (app.models || ['ALL']).includes('ALL') || (app.models || []).includes(modelCode);
                if (!applies) return null;
                // Pick the latest published version selector (single dropdown per app)
                const currentRef = bundle.systemAppRefs.find(r => r.appId === app.id);
                return (
                  <div key={app.id} className={`fw-app-card ${currentRef ? 'is-on' : ''}`}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      <input type="checkbox" checked={!!currentRef} onChange={() => {
                        if (currentRef) onToggleSysApp(app.id, currentRef.versionId);
                        else onToggleSysApp(app.id, pubVers[0].id);
                      }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 12.5 }}>{app.name}</div>
                        <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>{app.pkg}</div>
                      </div>
                    </label>
                    {currentRef && pubVers.length > 1 && (
                      <div className="fw-app-card__ver">
                        <div className="tds-select tds-select--sm" style={{ width: '100%' }}>
                          <select value={currentRef.versionId}
                            onChange={e => onChangeSysAppVersion(app.id, e.target.value)}>
                            {pubVers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ISV apps */}
          <div className="fw-mbc__section">
            <div className="fw-mbc__section-head">
              <span>ISV apps</span>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 400 }}>
                {isvCount} of {isvApps.length} selected
              </span>
            </div>
            {isvApps.length === 0 ? (
              <div className="muted" style={{ padding: '8px 0', fontSize: 12.5 }}>No published ISV apps.</div>
            ) : (
              <IsvAppPicker
                apps={isvApps}
                selectedRefs={bundle.isvAppRefs}
                onToggle={(appId, vId) => onToggleIsvApp(appId, vId)}
                onChangeVersion={(appId, vId) => onChangeIsvAppVersion(appId, vId)}
              />
            )}
          </div>
        </div>
      )}

      <style>{`
        .fw-mbc {
          border: 1px solid var(--color-border-default);
          border-radius: 10px;
          background: var(--color-bg-2);
          overflow: hidden;
        }
        .fw-mbc__head {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          background: var(--color-bg-3);
          cursor: pointer;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .fw-mbc__head--static { cursor: default; }
        .fw-mbc__chev { color: var(--color-text-tertiary); display: inline-flex; }
        .fw-mbc__model {
          font-family: var(--font-family-mono); font-weight: 600; font-size: 13.5px;
          color: var(--color-text-primary);
          padding: 2px 8px; background: var(--color-bg-1); border-radius: 4px;
          border: 1px solid var(--color-border-subtle);
        }
        .fw-mbc__count { font-size: 12px; color: var(--color-text-secondary); }
        .fw-mbc__remove {
          border: 0; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); padding: 4px; border-radius: 4px;
          display: inline-flex;
        }
        .fw-mbc__remove:hover { background: var(--color-bg-1); color: oklch(45% 0.16 25); }
        .fw-mbc__body { padding: 16px; display: flex; flex-direction: column; gap: 18px; }

        .fw-mbc__section {}
        .fw-mbc__section-head {
          display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;
          font: 600 11.5px var(--font-family-sans);
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--color-text-secondary);
        }

        .fw-fw-pick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .fw-fw-pick__opt {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px;
          background: var(--color-bg-1); border: 1px solid var(--color-border-subtle);
          border-radius: 6px; cursor: pointer; min-width: 220px;
          transition: background 0.1s, border-color 0.1s;
        }
        .fw-fw-pick__opt:hover { background: var(--color-bg-3); }
        .fw-fw-pick__opt.is-on {
          border-color: var(--color-text-primary);
          background: var(--color-primary-50, oklch(96% 0.02 262));
        }
        .fw-fw-pick__opt input { accent-color: var(--color-primary-700); cursor: pointer; }
        .fw-fw-pick__clear {
          border: 0; background: transparent; cursor: pointer;
          color: var(--color-text-tertiary); font-size: 11px;
          display: inline-flex; align-items: center; gap: 3px;
          padding: 4px 8px; border-radius: 4px;
        }
        .fw-fw-pick__clear:hover { background: var(--color-bg-3); color: var(--color-text-secondary); }

        .fw-app-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 8px;
        }
        .fw-app-card {
          background: var(--color-bg-1); border: 1px solid var(--color-border-subtle);
          border-radius: 6px; overflow: hidden;
        }
        .fw-app-card.is-on {
          border-color: var(--color-text-primary);
          background: var(--color-primary-50, oklch(96% 0.02 262));
        }
        .fw-app-card label { cursor: pointer; }
        .fw-app-card input { accent-color: var(--color-primary-700); cursor: pointer; }
        .fw-app-card__ver {
          padding: 0 10px 8px 32px;
        }
      `}</style>
    </div>
  );
};

window.FactoryImageWizard = FactoryImageWizard;
window.ModelBundleCard    = ModelBundleCard;
window.IsvAppPicker       = IsvAppPicker;
