/* global React, Btn, Badge, Input, Icon, Modal, useToast,
            SysRolloutModal, SysStrategyCell, SysTargetVersionDropdown, SysPendingBadge,
            SAAppIcon */
// ─────────────────────────────────────────────────────────────
// System Apps — list + detail.
//
// Two flavors:
//   · Mandatory (必装应用) — version rollout authored on THIS platform.
//     Detail has a dedicated "Rollouts" tab where each ISO row gets its
//     own target version + release strategy (timing/network). Same UX
//     and visual language as the ISV view's "Subscribed Deployments".
//   · Optional (选装应用) — registered + version-managed here, but ISOs
//     decide if/when to push them. No Rollouts tab on this platform.
//
// All non-rollout screens (Overview, Versions, Activity, Register, Upload)
// stay identical between the two flavors so registration is uniform.
// ─────────────────────────────────────────────────────────────

const { useState: useStateSA, useMemo: useMemoSA, useEffect: useEffectSA } = React;

// ─── Visual atoms ─────────────────────────────────────────
const SAScanDot = ({ v, label }) => {
  const tone = { clean: 'oklch(58% 0.14 152)', cleanish: 'oklch(70% 0.15 75)', dirty: 'oklch(58% 0.18 25)' }[v] || 'oklch(70% 0 0)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: tone, boxShadow: `0 0 0 2px color-mix(in oklch, ${tone}, transparent 80%)` }} />
      {label && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{v}</span>}
    </span>);

};

const SASignerChip = ({ v }) => {
  if (v === 'system') return <Badge tone="info" dot>SYSTEM cert</Badge>;
  if (v === 'npt') return <Badge tone="warning" dot>NPT cert</Badge>;
  return <Badge tone="neutral">Unsigned</Badge>;
};

const SAKindBadge = ({ kind }) => kind === 'mandatory' ?
<Badge tone="error" dot>Mandatory</Badge> :
<Badge tone="neutral">Optional</Badge>;

const SAModelsChips = ({ list, max = 4 }) => {
  if (!list || list.length === 0) return <span className="muted">—</span>;
  if (list[0] === 'ALL') return <Badge tone="info">All models</Badge>;
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {shown.map((m) =>
      <span key={m} style={{
        fontFamily: 'var(--font-family-mono)', fontSize: 11,
        padding: '2px 7px', borderRadius: 4,
        background: 'var(--color-bg-3)',
        border: '1px solid var(--color-border-subtle)',
        color: 'var(--color-text-secondary)'
      }}>{m}</span>
      )}
      {more > 0 && <span className="muted" style={{ fontSize: 11 }}>+{more}</span>}
    </div>);

};

const SAField = ({ label, required, hint, children }) =>
<div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</label>
      {required && <span style={{ color: 'oklch(50% 0.14 25)', fontSize: 12 }}>*</span>}
    </div>
    {children}
    {hint && <div className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>;


// Known device models — pulled from window.DEVICE_MODELS when available.
const KNOWN_MODELS = () => {
  const fromOrders = (window.DEVICE_MODELS || []).map((m) => m.id || m.name).filter(Boolean);
  if (fromOrders.length) return fromOrders;
  return ['N950', 'N750P', 'N750', 'S90', 'S60', 'X800'];
};

// ─── Register-new-system-app modal ────────────────────────
const RegisterSystemAppModal = ({ open, onClose, onCreate, defaultKind = 'mandatory' }) => {
  const [name, setName] = useStateSA('');
  const [pkg, setPkg] = useStateSA('');
  const [signer, setSigner] = useStateSA('system');
  const [cat, setCat] = useStateSA('System');
  const [kind, setKind] = useStateSA(defaultKind);
  const [allModels, setAllModels] = useStateSA(true);
  const [modelSet, setModelSet] = useStateSA(new Set());
  const [ver, setVer] = useStateSA('1.0.0');
  const [notes, setNotes] = useStateSA('');

  useEffectSA(() => {
    if (open) {
      setName('');setPkg('');setSigner('system');setCat('System');
      setKind(defaultKind);setAllModels(true);setModelSet(new Set());
      setVer('1.0.0');setNotes('');
    }
  }, [open, defaultKind]);

  const conflict = useMemoSA(() => {
    if (!pkg.trim()) return null;
    const sys = (window.SYSTEM_APPS || []).some((a) => a.pkg === pkg.trim());
    if (sys) return { kind: 'system', label: 'Another system app already owns this package.' };
    const isv = (window.APPS || []).some((a) => a.package === pkg.trim());
    if (isv) return { kind: 'isv', label: 'An ISV app already publishes this package — pick a different name.' };
    return null;
  }, [pkg]);

  const valid = name.trim() && pkg.trim() &&
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(pkg.trim()) &&
  !conflict && (allModels || modelSet.size > 0);

  const toggleModel = (m) => setModelSet((prev) => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m);else next.add(m);
    return next;
  });

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(), pkg: pkg.trim(), signer, cat, kind,
      models: allModels ? ['ALL'] : [...modelSet],
      ver, notes: notes.trim()
    });
  };

  return (
    <Modal open={open} onClose={onClose} width={620}
    title={`Register ${kind === 'mandatory' ? 'mandatory' : 'optional'} system app`}
    footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="plus" disabled={!valid} onClick={submit}>Register & upload</Btn>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SAField label="Install policy">
          <div style={{ display: 'inline-flex', background: 'var(--color-bg-3)', padding: 2, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
            {['mandatory', 'optional'].map((k) =>
            <button key={k} onClick={() => setKind(k)} style={{
              padding: '6px 14px', fontSize: 12.5, fontWeight: 500, borderRadius: 6,
              background: kind === k ? 'var(--color-bg-1)' : 'transparent',
              color: kind === k ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: kind === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer'
            }}>{k === 'mandatory' ? 'Mandatory · 必装' : 'Optional · 选装'}</button>
            )}
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.45 }}>
            {kind === 'mandatory' ?
            'Required on every targeted terminal. Version rollout is authored here, per ISO, with release strategy.' :
            'Pre-bundled but uninstallable. ISOs decide whether to push and choose strategy from their own portal.'}
          </div>
        </SAField>

        <SAField label="Display name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Telemetry Daemon" />
        </SAField>

        <SAField label="Package" required hint="Reverse-DNS, lower-case. Must be globally unique across ISV + system apps.">
          <Input value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="com.npt.telemetry" invalid={!!conflict} />
          {conflict &&
          <div style={{ marginTop: 6, fontSize: 12, color: 'oklch(48% 0.14 25)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="info" size={12} /> {conflict.label}
            </div>
          }
        </SAField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <SAField label="Signing certificate" required>
            <div className="tds-select tds-select--md">
              <select value={signer} onChange={(e) => setSigner(e.target.value)}>
                <option value="system">SYSTEM (platform certificate)</option>
                <option value="npt">NPT (proprietary key)</option>
              </select>
              <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
            </div>
          </SAField>
          <SAField label="Category">
            <div className="tds-select tds-select--md">
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option>System</option>
                <option>Pre-installed</option>
                <option>Utility</option>
                <option>Security</option>
              </select>
              <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
            </div>
          </SAField>
          <SAField label="Initial version">
            <Input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="1.0.0" />
          </SAField>
        </div>

        <SAField label="Target device models" required>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={allModels} onChange={(e) => setAllModels(e.target.checked)} />
            All device models
          </label>
          {!allModels &&
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {KNOWN_MODELS().map((m) => {
              const on = modelSet.has(m);
              return (
                <button key={m} onClick={() => toggleModel(m)} style={{
                  fontFamily: 'var(--font-family-mono)', fontSize: 11.5,
                  padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                  background: on ? 'var(--color-primary-50)' : 'var(--color-bg-2)',
                  border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
                  color: on ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
                  fontWeight: on ? 600 : 500
                }}>{m}</button>);

            })}
            </div>
          }
        </SAField>

        <SAField label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="What does this app do, and why does it need a system / NPT signature?"
          style={{ width: '100%', minHeight: 70, resize: 'vertical', padding: '8px 10px',
            border: '1px solid var(--color-border-default)', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text-primary)',
            background: 'var(--color-bg-2)' }} />
        </SAField>

        <div style={{ padding: '10px 14px', background: 'var(--color-info-50, oklch(96% 0.04 230))',
          border: '1px solid oklch(60% 0.14 230 / 0.25)', borderRadius: 8, fontSize: 12,
          color: 'var(--color-info-700, oklch(40% 0.12 230))', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="info" size={13} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            Registering a system app reserves the package name globally. The APK upload step happens after registration — until a signed binary is attached, the app stays in a <strong>draft</strong> state and isn't pushed to terminals.
          </div>
        </div>
      </div>
    </Modal>);

};

// ─── Upload-version modal (reused from old screen) ────────
const UploadVersionModal = ({ open, onClose, app, onSubmit }) => {
  const [name, setName] = useStateSA('');
  const [notes, setNotes] = useStateSA('');
  const [file, setFile] = useStateSA(null);

  useEffectSA(() => {
    if (open) {
      const last = app.versions[0]?.name || '1.0.0';
      const parts = last.split('.').map((s) => parseInt(s, 10) || 0);
      parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
      setName(parts.join('.'));
      setNotes('');
      setFile(null);
    }
  }, [open]);

  const valid = name.trim() && /^\d+(\.\d+)*([-.][a-z0-9]+)*$/i.test(name.trim()) && file;

  return (
    <Modal open={open} onClose={onClose} width={560} title={`Upload new version of ${app.name}`}
    footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={() => onSubmit({ name: name.trim(), notes: notes.trim() })}>Upload draft</Btn>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SAField label="Version number" required hint={`Use semantic versioning. Previous: ${app.versions[0]?.name || '—'}`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="1.2.0" />
        </SAField>
        <SAField label="Signed APK" required hint={`Must be signed with the ${app.signer === 'system' ? 'TOMS SYSTEM' : 'NPT'} certificate. Mismatched signatures are rejected.`}>
          <div style={{
            padding: '14px 16px', borderRadius: 8,
            border: `2px dashed var(--color-border-default)`,
            background: 'var(--color-bg-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
          }}>
            {file ?
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Icon name="check" size={16} style={{ color: 'oklch(50% 0.14 152)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{file.size}</div>
                  </div>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Btn>
              </> :

            <>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                  Drop a signed <code>.apk</code> here, or click to browse.
                </div>
                <Btn variant="secondary" size="sm" icon="download"
              onClick={() => setFile({ name: `${app.pkg}-${(name || 'new').trim()}-signed.apk`, size: '24.2 MB' })}>
                  Select APK
                </Btn>
              </>
            }
          </div>
        </SAField>
        <SAField label="Release notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="What changed in this version?"
          style={{ width: '100%', minHeight: 70, resize: 'vertical', padding: '8px 10px',
            border: '1px solid var(--color-border-default)', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text-primary)',
            background: 'var(--color-bg-2)' }} />
        </SAField>
        <div style={{ padding: '10px 14px', background: 'var(--color-bg-3)', borderRadius: 8,
          fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="info" size={13} style={{ flex: 'none', marginTop: 2 }} />
          <div>
            The version uploads as a <strong>draft</strong>. It won't push to terminals until you publish it from the Versions tab.
            {app.kind === 'mandatory' && <> Mandatory apps roll out per-ISO from the Deployments tab once a version is published.</>}
          </div>
        </div>
      </div>
    </Modal>);

};

// ─── Main list screen ─────────────────────────────────────
const SystemAppsScreen = () => {
  const toast = useToast();
  const [, setTick] = useStateSA(0);
  const [openAppId, setOpenAppId] = useStateSA(null);
  const apps = window.SYSTEM_APPS || [];

  const [kindFilter, setKindFilter] = useStateSA('any'); // any | mandatory | optional
  const [q, setQ] = useStateSA('');
  const [statusFilter, setStatusFilter] = useStateSA('any');
  const [registerOpen, setRegisterOpen] = useStateSA(false);

  const mandatoryApps = apps.filter((a) => a.kind === 'mandatory');
  const optionalApps = apps.filter((a) => a.kind === 'optional');

  const totals = useMemoSA(() => ({
    total: apps.length,
    mandatory: mandatoryApps.length,
    optional: optionalApps.length,
    published: apps.filter((a) => a.status === 'published').length,
    unpublished: apps.filter((a) => a.status === 'unpublished').length
  }), [apps]);

  const filtered = useMemoSA(() => apps.filter((a) => {
    if (kindFilter !== 'any' && a.kind !== kindFilter) return false;
    if (statusFilter !== 'any' && a.status !== statusFilter) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      if (!a.name.toLowerCase().includes(s) && !a.pkg.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [apps, q, kindFilter, statusFilter]);

  const handleCreate = (payload) => {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const newApp = {
      id: `sys-${Date.now().toString(36)}`,
      pkg: payload.pkg, name: payload.name, cat: payload.cat,
      signer: payload.signer, kind: payload.kind,
      models: payload.models, ver: payload.ver,
      uploaded: now, terminals: 0, scan: 'clean',
      status: 'unpublished', notes: payload.notes,
      publishedBy: 'admin@toms',
      versions: [window._mkSysVer(payload.ver, 1, 'unpublished', now, null, 'Initial draft. Upload a signed APK and publish to push to terminals.')]
    };
    window.SYSTEM_APPS = [newApp, ...(window.SYSTEM_APPS || [])];
    setTick((t) => t + 1);
    setRegisterOpen(false);
    setKindFilter(payload.kind);
    toast({ kind: 'success', title: `System app registered`, msg: `${newApp.name} added in draft state under ${payload.kind === 'mandatory' ? 'Mandatory' : 'Optional'}.` });
  };

  // Drill-in to detail
  if (openAppId) {
    const app = (window.SYSTEM_APPS || []).find((a) => a.id === openAppId);
    if (app) {
      return <SystemAppDetailScreen app={app} onBack={() => setOpenAppId(null)}
      onChange={() => setTick((t) => t + 1)} toast={toast} />;
    }
    setOpenAppId(null);
  }

  // Inline registration page
  if (registerOpen) {
    return <window.RegisterSystemAppPage
      defaultKind={kindFilter === 'optional' ? 'optional' : 'mandatory'}
      onCancel={() => setRegisterOpen(false)}
      onCreate={handleCreate} />;
  }

  const clearAllFilters = () => {setQ('');setStatusFilter('any');setKindFilter('any');};

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">System Apps</h1>
          <p className="page__sub">
            Platform-signed apps that ship as factory preinstalls on TOMS devices. <strong>Mandatory</strong> apps are required on every targeted terminal and roll out from this platform with a release strategy per ISO. <strong>Optional</strong> apps are bundled but uninstallable — ISOs choose if and when to push them from their own portal.
          </p>
        </div>
        <div className="page__actions">
          <Btn variant="primary" icon="plus" onClick={() => setRegisterOpen(true)}>New system app</Btn>
        </div>
      </div>

      {/* KPI strip — filter chips for Mandatory / Optional / status */}
      <div className="tkt-kpi" style={{ padding: 0, marginBottom: 16 }}>
        <button
          className={`tkt-kpi__tile ${kindFilter === 'any' && statusFilter === 'any' && !q.trim() ? 'is-on' : ''}`}
          onClick={clearAllFilters}>
          <div className="tkt-kpi__label">Total apps</div>
          <div className="tkt-kpi__val">{totals.total}</div>
          <div className="tkt-kpi__sub">All system-app preinstalls</div>
        </button>
        <button className={`tkt-kpi__tile ${kindFilter === 'mandatory' ? 'is-on' : ''}`}
        onClick={() => setKindFilter(kindFilter === 'mandatory' ? 'any' : 'mandatory')}>
          <div className="tkt-kpi__label">Mandatory</div>
          <div className="tkt-kpi__val">{totals.mandatory}</div>
          <div className="tkt-kpi__sub">Rollout authored on this platform</div>
        </button>
        <button className={`tkt-kpi__tile ${kindFilter === 'optional' ? 'is-on' : ''}`}
        onClick={() => setKindFilter(kindFilter === 'optional' ? 'any' : 'optional')}>
          <div className="tkt-kpi__label">Optional</div>
          <div className="tkt-kpi__val">{totals.optional}</div>
          <div className="tkt-kpi__sub">ISO-managed rollout</div>
        </button>
        <button className={`tkt-kpi__tile ${statusFilter === 'published' ? 'is-on' : ''}`}
        onClick={() => setStatusFilter(statusFilter === 'published' ? 'any' : 'published')}>
          <div className="tkt-kpi__label">Published</div>
          <div className="tkt-kpi__val">{totals.published}</div>
          <div className="tkt-kpi__sub">Live · pushing to terminals</div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14} />} placeholder="Search by name or package…"
        value={q} onChange={(e) => setQ(e.target.value)} size="md" />
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ width: 160 }}>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="any">All policies</option>
              <option value="mandatory">Mandatory only</option>
              <option value="optional">Optional only</option>
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={14} /></span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="tds-table">
          <thead>
            <tr>
              <th style={{ width: '52%' }}>App</th>
              <th style={{ width: '24%' }}>Target models</th>
              <th style={{ width: '14%' }}>Latest version</th>
              <th style={{ width: '11%' }}>Status</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ?
            <tr><td colSpan="7"><div className="empty">No system apps match your filters.</div></td></tr> :
            filtered.map((a) => {
              const rolloutCount = a.kind === 'mandatory' ?
              Object.keys(window.getAppRollouts(a.id) || {}).length :
              0;
              return (
                <tr key={a.id} onClick={() => setOpenAppId(a.id)}>
                  <td>
                    <div className="al-app">
                      <SAAppIcon name={a.name} pkg={a.pkg} />
                      <div style={{ minWidth: 0 }}>
                        <div className="al-app__name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.name}
                          <SAKindBadge kind={a.kind} />
                        </div>
                        <div className="al-app__pkg">{a.pkg}</div>
                      </div>
                    </div>
                  </td>
                  <td><SAModelsChips list={a.models} /></td>
                  <td>
                    <div className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500 }}>{a.ver}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{a.uploaded}</div>
                  </td>
                  <td>
                    <Badge tone={a.status === 'published' ? 'success' : 'warning'} dot>
                      {a.status === 'published' ? 'Published' : 'Unpublished'}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" onClick={(e) => {e.stopPropagation();setOpenAppId(a.id);}}>
                      <Icon name="chevR" size={14} />
                    </button>
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div>

    </div>);

};

// ─── App detail screen ─────────────────────────────────────
const SystemAppDetailScreen = ({ app, onBack, onChange, toast }) => {
  const [tab, setTab] = useStateSA('overview');
  const [uploadOpen, setUploadOpen] = useStateSA(false);
  const [confirm, setConfirm] = useStateSA(null);

  const latest = app.versions[0];

  const togglePublishVersion = (v, publishing) => {
    v.status = publishing ? 'published' : 'unpublished';
    if (publishing) v.published = v.published || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    app.status = app.versions.some((x) => x.status === 'published') ? 'published' : 'unpublished';
    onChange?.();
  };

  const toggleAppStatus = () => {
    if (app.status === 'published') {
      app.versions.forEach((v) => {if (v.status === 'published') v.status = 'unpublished';});
      app.status = 'unpublished';
    } else {
      if (latest) {
        latest.status = 'published';
        latest.published = latest.published || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      app.status = 'published';
    }
    onChange?.();
  };

  const addVersion = ({ parsed, versionNotes, findings, counts }) => {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const name = parsed.version;
    const code = parsed.code;
    // Wizard publishes immediately — no draft state.
    const newV = window._mkSysVer(name, code, 'published', now, now, versionNotes);
    // Attach manifest + scan metadata so the version detail can show them.
    newV.size = parsed.size;
    newV.minSdk = parsed.minSdk;
    newV.targetSdk = parsed.targetSdk;
    newV.perms = parsed.perms;
    newV.fingerprint = parsed.fingerprint;
    newV.signer = parsed.signer;
    newV.scan = 'cleanish';
    newV.scanCounts = counts;
    newV.scanFindings = findings;
    app.versions = [newV, ...app.versions];
    app.ver = name;
    app.uploaded = now;
    app.status = 'published';
    onChange?.();
    setUploadOpen(false);
    toast({ kind: 'success', title: `${app.name} ${name} published`, msg: 'Available to terminals on next check-in.' });
  };

  // Tab definitions vary by kind.
  const tabs = app.kind === 'mandatory' ?
  [
  { id: 'overview', label: 'Overview' },
  { id: 'versions', label: 'Versions', count: app.versions.length },
  { id: 'rollouts', label: 'Deployments', count: Object.keys(window.getAppRollouts(app.id) || {}).length }] :

  [
  { id: 'overview', label: 'Overview' },
  { id: 'versions', label: 'Versions', count: app.versions.length }];


  // Upload-new-version wizard takes over the entire detail screen.
  if (uploadOpen && window.SystemAppUploadWizard) {
    return (
      <window.SystemAppUploadWizard
        app={app}
        onClose={() => setUploadOpen(false)}
        onPublish={addVersion} />);

  }

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, marginLeft: -8 }}>
          <Icon name="chevL" size={14} /> Back to System Apps
        </button>
      </div>

      <div className="det-header">
        <SAAppIcon name={app.name} pkg={app.pkg} size={56} radius={12} />
        <div className="det-header__main">
          <h1 className="det-header__title">
            {app.name}
            <Badge tone={app.status === 'published' ? 'success' : 'warning'} dot>
              {app.status === 'published' ? 'Published' : 'Unpublished'}
            </Badge>
            <SAKindBadge kind={app.kind} />
          </h1>
          <div className="det-header__meta">
            <span style={{ fontFamily: 'var(--font-family-mono)' }}>{app.pkg}</span>
            <SASignerChip v={app.signer} />
            <Badge tone="neutral">{app.cat}</Badge>
            <span><Icon name="clock" size={13} /> Updated {app.uploaded}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="primary" icon="plus" onClick={() => setUploadOpen(true)}>Upload new version</Btn>
        </div>
      </div>

      <div className="det-tabs">
        {tabs.map((t) =>
        <button key={t.id} className={`tds-tab ${tab === t.id ? 'tds-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && <span style={{
            marginLeft: 6, fontFamily: 'var(--font-family-mono)', fontSize: 11,
            color: tab === t.id ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)',
            background: tab === t.id ? 'var(--color-primary-50)' : 'var(--color-bg-3)',
            padding: '1px 7px', borderRadius: 999, fontWeight: 500
          }}>{t.count}</span>}
          </button>
        )}
      </div>

      {tab === 'overview' && <SystemAppOverview app={app} />}
      {tab === 'versions' &&
      <SystemAppVersionsTab app={app}
      onPublish={(v) => setConfirm({ kind: 'publish', v })}
      onUnpublish={(v) => setConfirm({ kind: 'unpublish', v })}
      onUploadNew={() => setUploadOpen(true)} />
      }
      {tab === 'rollouts' && app.kind === 'mandatory' &&
      <SystemAppRolloutsTab app={app} onChange={() => onChange?.()} toast={toast} />
      }

      <Modal open={!!confirm} onClose={() => setConfirm(null)}
      title={
      confirm?.kind === 'publishApp' ? `Publish ${app.name}?` :
      confirm?.kind === 'unpublishApp' ? `Unpublish ${app.name}?` :
      confirm?.kind === 'publish' ? `Publish version ${confirm?.v?.name}?` :
      confirm?.kind === 'unpublish' ? `Unpublish version ${confirm?.v?.name}?` : ''
      }
      footer={<>
          <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
          <Btn variant={confirm?.kind === 'unpublishApp' || confirm?.kind === 'unpublish' ? 'danger' : 'primary'}
        onClick={() => {
          if (!confirm) return;
          if (confirm.kind === 'publishApp' || confirm.kind === 'unpublishApp') {
            toggleAppStatus();
            toast({ kind: app.status === 'published' ? 'success' : 'warning',
              title: app.status === 'published' ? `${app.name} published` : `${app.name} unpublished` });
          } else {
            togglePublishVersion(confirm.v, confirm.kind === 'publish');
            toast({ kind: confirm.kind === 'publish' ? 'success' : 'warning',
              title: `Version ${confirm.v.name} ${confirm.kind === 'publish' ? 'published' : 'unpublished'}` });
          }
          setConfirm(null);
        }}>
            {confirm?.kind === 'publishApp' ? 'Publish app' :
          confirm?.kind === 'unpublishApp' ? 'Unpublish app' :
          confirm?.kind === 'publish' ? 'Publish version' :
          confirm?.kind === 'unpublish' ? 'Unpublish version' : 'Confirm'}
          </Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          {confirm?.kind === 'publishApp' && <>This will make <strong>{app.name}</strong> available for rollout. {app.kind === 'mandatory' ? <>Open the <strong>Deployments</strong> tab to assign target versions and release strategies per ISO.</> : <>ISOs can subscribe to and push this version from their portals.</>}</>}
          {confirm?.kind === 'unpublishApp' && <>This withdraws <strong>{app.name}</strong> from the catalog. Already-installed copies stay on terminals; no new pushes will be sent. You can re-publish anytime.</>}
          {confirm?.kind === 'publish' && <>Version <span style={{ fontFamily: 'var(--font-family-mono)' }}>{confirm.v.name}</span> becomes available for rollout on <strong>{app.name}</strong>.</>}
          {confirm?.kind === 'unpublish' && <>Version <span style={{ fontFamily: 'var(--font-family-mono)' }}>{confirm?.v?.name}</span> stops being pushable. ISOs already pinned to it will need to pick a different version.</>}
        </p>
      </Modal>
    </div>);

};

// ─── Overview tab ──────────────────────────────────────────
const SystemAppOverview = ({ app }) => {
  const latest = app.versions[0];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">About</div>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 13.5, color: 'var(--color-text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
            {app.notes || <span className="muted">No description provided.</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <SAOverviewField label="Package" value={<span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5 }}>{app.pkg}</span>} />
            <SAOverviewField label="Category" value="System" />
            <SAOverviewField label="Install policy" value={<SAKindBadge kind={app.kind} />} />
            <SAOverviewField label="Target models" value={<SAModelsChips list={app.models} />} />
            <SAOverviewField label="Published by" value={app.publishedBy || '—'} />
          </div>
        </div>
      </div>

      <div className="info-card">
        <div className="info-card__head">
          <div className="info-card__title">Latest version</div>
          <span className="muted" style={{ fontSize: 12 }}>{app.versions.length} version{app.versions.length === 1 ? '' : 's'} total</span>
        </div>
        {latest ?
        <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{latest.name}</span>
              <Badge tone={latest.status === 'published' ? 'success' : 'warning'} dot>
                {latest.status === 'published' ? 'Published' : 'Unpublished'}
              </Badge>
              <span className="muted" style={{ fontSize: 12 }}>· {latest.size}</span>
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: 720 }}>
              {latest.notes || 'No release notes.'}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Uploaded {latest.uploaded}</span>
              {latest.published && <span>Published {latest.published}</span>}
              <span>Scan: <SAScanDot v={latest.scan} label /></span>
              <span className="num" style={{ fontFamily: 'var(--font-family-mono)' }}>min SDK {latest.minSdk} → target {latest.targetSdk}</span>
            </div>
          </div> :

        <div className="empty" style={{ padding: '28px 20px' }}>No versions uploaded yet.</div>
        }
      </div>
    </div>);

};

const SAOverviewField = ({ label, value }) =>
<div>
    <div className="overline" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{value}</div>
  </div>;


// ─── Versions tab ──────────────────────────────────────────
const SystemAppVersionsTab = ({ app, onPublish, onUnpublish, onUploadNew }) =>
<div className="info-card">
    <div className="info-card__head">
      <div>
        <div className="info-card__title">Versions</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Upload a new APK signed with the {app.signer === 'system' ? 'TOMS SYSTEM' : 'NPT'} certificate, then publish to make it pushable.
          {app.kind === 'mandatory' && <> The <strong>Deployments</strong> tab controls which ISOs get which version on what schedule.</>}
        </div>
      </div>
      <Btn variant="primary" icon="plus" size="sm" onClick={onUploadNew}>Upload new version</Btn>
    </div>
    <table className="tds-table">
      <thead>
        <tr>
          <th style={{ width: '14%' }}>Version</th>
          <th style={{ width: '10%' }}>Code</th>
          <th style={{ width: '10%' }}>Size</th>
          <th style={{ width: '12%' }}>Uploaded</th>
          <th style={{ width: '12%' }}>Published</th>
          <th style={{ width: '12%' }}>Status</th>
          <th style={{ width: '10%' }}>Scan</th>
          <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {app.versions.length === 0 ?
      <tr><td colSpan="8"><div className="empty">No versions yet. Click <strong>Upload new version</strong> above.</div></td></tr> :
      app.versions.map((v) =>
      <tr key={v.id} style={{ cursor: 'default' }}>
            <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 600 }}>{v.name}</span></td>
            <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{v.code}</span></td>
            <td><span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{v.size}</span></td>
            <td><span style={{ fontSize: 12 }}>{v.uploaded}</span></td>
            <td><span style={{ fontSize: 12 }}>{v.published || <span className="muted">—</span>}</span></td>
            <td>
              <Badge tone={v.status === 'published' ? 'success' : 'warning'} dot>
                {v.status === 'published' ? 'Published' : 'Unpublished'}
              </Badge>
            </td>
            <td><SAScanDot v={v.scan} label /></td>
            <td style={{ textAlign: 'right' }}>
              {v.status === 'published' ?
          <button onClick={() => onUnpublish(v)} style={{ background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'oklch(45% 0.13 80)', fontWeight: 500 }}>Unpublish</button> :
          <button onClick={() => onPublish(v)} style={{ background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--color-primary-700)', fontWeight: 600 }}>Publish</button>
          }
            </td>
          </tr>
      )}
      </tbody>
    </table>
  </div>;


window.SystemAppsScreen = SystemAppsScreen;