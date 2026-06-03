/* global React, Btn, Input, Icon, Badge, SAAppIcon */
// ─────────────────────────────────────────────────────────────
// System Apps — New-app registration page.
//
// Full-page inline form (not a modal) for registering a new system app.
// Modeled on the ISV view's "Create app" form: stacked section cards
// for Identity / Install policy / Supported orientations / Device
// compatibility, with the same selectable-card visual language for
// radio-style options.
//
// The Mandatory / Optional selector lives in its own card so it carries
// the same weight as the orientation and device-compatibility choices —
// it changes the app's behaviour on every terminal.
// ─────────────────────────────────────────────────────────────

const { useState: useStateRSA, useMemo: useMemoRSA } = React;

const CATEGORIES = ['System', 'Pre-installed', 'Utility', 'Security'];

// Device-model catalog with short descriptions, mirroring the screenshot.
// Augmented from window.DEVICE_MODELS at runtime where available.
const MODEL_CATALOG = [
  { id: 'N950',  desc: 'Flagship Android POS · 6.5" · 5G' },
  { id: 'S30',   desc: 'Smart MPOS · 5.5" · 4G/WiFi' },
  { id: 'S60',   desc: 'Compact countertop · 5.7"' },
  { id: 'S90',   desc: 'Premium SmartPOS · 6.0" · printer' },
  { id: 'X800',  desc: 'Self-service kiosk · 10" tablet' },
  { id: 'N750',  desc: 'Handheld Android · 5.5" · 4G' },
  { id: 'N750K', desc: 'N750 + physical keypad · PCI v6' },
  { id: 'N750P', desc: 'N750 + integrated printer · 58mm' },
];

const getModelCatalog = () => {
  const stock = (window.DEVICE_MODELS || []).map(m => ({
    id: m.id || m.name,
    desc: m.summary || m.shortDesc || m.description || '',
  })).filter(m => m.id);
  if (stock.length) {
    // Backfill descriptions from the static catalog when missing.
    return stock.map(m => ({ ...m, desc: m.desc || MODEL_CATALOG.find(x => x.id === m.id)?.desc || '' }));
  }
  return MODEL_CATALOG;
};

// ─── Card scaffold ────────────────────────────────────────
const RSACard = ({ title, hint, children }) => (
  <section style={{
    background: 'var(--color-bg-1)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  }}>
    <div style={{
      padding: '16px 22px',
      borderBottom: '1px solid var(--color-border-subtle)',
      display: 'flex', alignItems: 'baseline', gap: 14,
    }}>
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.005em', flex: 'none' }}>{title}</h2>
      {hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.55 }}>{hint}</p>}
    </div>
    <div style={{ padding: '22px' }}>{children}</div>
  </section>
);

const RSAField = ({ label, required, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</label>
      {required && <span style={{ color: 'oklch(50% 0.14 25)', fontSize: 12 }}>*</span>}
    </div>
    {children}
    {hint && <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', lineHeight: 1.45 }}>{hint}</div>}
  </div>
);

// ─── Selectable card (the "All ISOs / Specified ISOs" pattern) ──
const RSAOptionCard = ({ active, icon, title, tag, description, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '16px 18px', textAlign: 'left', width: '100%',
      borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? 'var(--color-primary-50)' : 'var(--color-bg-1)',
      border: '1.5px solid',
      borderColor: active ? 'var(--color-primary-500)' : 'var(--color-border-default)',
      opacity: disabled ? 0.55 : 1,
      transition: 'background 120ms, border-color 120ms',
    }}>
    <span style={{
      width: 18, height: 18, borderRadius: '50%',
      border: `1.5px solid ${active ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
      flex: 'none', marginTop: 2,
      display: 'grid', placeItems: 'center',
    }}>
      {active && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary-500)' }}/>}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {icon && <Icon name={icon} size={15} style={{ color: 'var(--color-text-secondary)' }}/>}
          {title}
        </div>
        {tag && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
            color: active ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)',
            background: active ? 'var(--color-bg-1)' : 'var(--color-bg-3)',
            padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
            border: `1px solid ${active ? 'oklch(60% 0.14 262 / 0.30)' : 'var(--color-border-subtle)'}`,
            flex: 'none',
          }}>{tag}</span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
        {description}
      </div>
    </div>
  </button>
);

// ─── Main page ────────────────────────────────────────────
const RegisterSystemAppPage = ({ defaultKind = 'mandatory', onCancel, onCreate }) => {
  const [name, setName] = useStateRSA('');
  const [pkg, setPkg] = useStateRSA('');
  const [cat, setCat] = useStateRSA('System');
  const [description, setDescription] = useStateRSA('');
  const [kind, setKind] = useStateRSA(defaultKind);
  const [signer, setSigner] = useStateRSA('system');
  const [orientations, setOrientations] = useStateRSA(new Set(['portrait']));
  const [modelSet, setModelSet] = useStateRSA(new Set());

  // Package conflict — same rule as the old modal.
  const conflict = useMemoRSA(() => {
    if (!pkg.trim()) return null;
    const sys = (window.SYSTEM_APPS || []).some(a => a.pkg === pkg.trim());
    if (sys) return { kind: 'system', label: 'Another system app already owns this package.' };
    const isv = (window.APPS || []).some(a => a.package === pkg.trim());
    if (isv) return { kind: 'isv', label: 'An ISV app already publishes this package — pick a different name.' };
    return null;
  }, [pkg]);

  const pkgValid = pkg.trim() && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(pkg.trim());
  const valid = name.trim() && pkgValid && !conflict
    && orientations.size > 0 && modelSet.size > 0;

  const toggleOrientation = (o) => setOrientations(prev => {
    const next = new Set(prev);
    if (next.has(o)) { if (next.size > 1) next.delete(o); } // can't remove last one
    else next.add(o);
    return next;
  });

  const toggleModel = (m) => setModelSet(prev => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });

  const toggleAllModels = () => {
    const catalog = getModelCatalog();
    if (modelSet.size === catalog.length) setModelSet(new Set());
    else setModelSet(new Set(catalog.map(m => m.id)));
  };

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(), pkg: pkg.trim(), cat, signer, kind,
      models: [...modelSet],
      orientations: [...orientations],
      notes: description.trim(),
      ver: '1.0.0',
    });
  };

  const catalog = getModelCatalog();

  return (
    <div className="page">
      {/* Back nav */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6,
          cursor: 'pointer', color: 'var(--color-text-secondary)',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, marginLeft: -8,
        }}>
          <Icon name="chevL" size={14}/> Back to System Apps
        </button>
      </div>

      <div className="page__head">
        <div>
          <h1 className="page__title">New system app</h1>
          <p className="page__sub">
            Register a new platform-signed app. After registration you can upload signed APK versions and, for mandatory apps, author per-ISO rollouts on the detail page.
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 18,
        maxWidth: 1080, margin: '0 auto', width: '100%',
      }}>

        {/* ─── Identity ─────────────────────────────────── */}
        <RSACard title="Identity">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <RSAField label="Icon" hint="The icon will be extracted from your APK when you upload a version. Until then, a placeholder built from your app name is used.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 'none' }}>
                  <SAAppIcon name={name || '?'} pkg={pkg || 'placeholder'} size={64} radius={14}/>
                </div>
                <div style={{
                  flex: 1, padding: '14px 16px', borderRadius: 8,
                  background: 'var(--color-bg-3)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="image" size={16} style={{ color: 'var(--color-text-secondary)' }}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-generated placeholder</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                      Enter the app name and package below to preview.
                    </div>
                  </div>
                </div>
              </div>
            </RSAField>

            <RSAField label="App name" required>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. TOMS MDM Agent"/>
            </RSAField>

            <RSAField label="Package name" required hint="Reverse-domain notation. Must be globally unique across the TOMS catalog.">
              <Input value={pkg} onChange={e => setPkg(e.target.value)} placeholder="com.npt.mdm.agent"
                invalid={!!conflict} style={{ fontFamily: 'var(--font-family-mono)' }}/>
              {conflict && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'oklch(48% 0.14 25)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="info" size={12}/> {conflict.label}
                </div>
              )}
            </RSAField>

            <RSAField label="Description" hint="Up to 500 characters · Shown to operators in the rollout flow">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                maxLength={500} rows={5}
                placeholder="Describe what this app does and why it ships preinstalled."
                style={{
                  width: '100%', padding: '10px 12px', resize: 'vertical',
                  border: '1px solid var(--color-border-default)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text-primary)',
                  background: 'var(--color-bg-2)', minHeight: 100, lineHeight: 1.5,
                }}/>
            </RSAField>
          </div>
        </RSACard>

        {/* ─── Install policy (NEW) ──────────────────────── */}
        <RSACard title="Install policy"
          hint="Mandatory apps are required on every targeted terminal and roll out from this platform with a per-ISO release strategy. Optional apps are bundled but uninstallable — ISOs decide whether to push them from their own portal.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <RSAOptionCard
              active={kind === 'mandatory'}
              icon="shield"
              title="Mandatory"
              tag="ROLLED OUT HERE"
              description="Required on every targeted terminal. After registration, assign target versions and release strategies (timing + network) per ISO from the app's Rollouts tab."
              onClick={() => setKind('mandatory')}/>
            <RSAOptionCard
              active={kind === 'optional'}
              icon="package"
              title="Optional"
              tag="ISO-MANAGED"
              description="Pre-bundled but uninstallable. Each ISO chooses whether to push this app and picks its own release strategy from their portal — no rollout surface on this platform."
              onClick={() => setKind('optional')}/>
          </div>
        </RSACard>

        {/* ─── Supported orientations ──────────────────── */}
        <RSACard title="Supported orientations"
          hint="Declared at the app level — the APK must match. Screenshots are uploaded per orientation on each version.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <OrientationCard
              shape="portrait"
              active={orientations.has('portrait')}
              onClick={() => toggleOrientation('portrait')}/>
            <OrientationCard
              shape="landscape"
              active={orientations.has('landscape')}
              onClick={() => toggleOrientation('landscape')}/>
          </div>
        </RSACard>

        {/* ─── Device compatibility ──────────────────── */}
        <RSACard
          title="Device compatibility"
          hint={`${modelSet.size} of ${catalog.length} models selected · Terminals on unsupported models won't receive this app.`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={modelSet.size === catalog.length}
                onChange={toggleAllModels}/>
              Select all device models
            </label>
            {modelSet.size > 0 && (
              <button type="button" onClick={() => setModelSet(new Set())}
                style={{
                  background: 'transparent', border: 0, fontSize: 12,
                  color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '4px 6px',
                }}>Clear selection</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {catalog.map(m => {
              const on = modelSet.has(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggleModel(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: on ? 'var(--color-primary-50)' : 'var(--color-bg-1)',
                    border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
                  }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flex: 'none',
                    background: on ? 'var(--color-primary-500)' : 'var(--color-bg-1)',
                    border: `1.5px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
                    display: 'grid', placeItems: 'center',
                  }}>
                    {on && <Icon name="check" size={10} style={{ color: '#fff' }}/>}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>{m.id}</div>
                    {m.desc && <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{m.desc}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </RSACard>

        {/* ─── Footer actions ────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 8, paddingTop: 4, paddingBottom: 20,
        }}>
          <span style={{ flex: 1, fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
            {!valid && (
              <>
                {!name.trim() && 'Add an app name. '}
                {!pkgValid && pkg.trim() && 'Package name must be reverse-DNS. '}
                {!pkg.trim() && 'Add a package name. '}
                {conflict && 'Resolve the package conflict. '}
                {orientations.size === 0 && 'Pick at least one orientation. '}
                {modelSet.size === 0 && 'Select at least one device model. '}
              </>
            )}
          </span>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>
            Create app
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Orientation card — tiny phone/tablet illustration ────
const OrientationCard = ({ shape, active, onClick }) => {
  const w = shape === 'portrait' ? 36 : 56;
  const h = shape === 'portrait' ? 56 : 36;
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 18,
      padding: '18px 20px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      background: active ? 'var(--color-primary-50)' : 'var(--color-bg-1)',
      border: `1.5px solid ${active ? 'var(--color-primary-500)' : 'var(--color-border-default)'}`,
    }}>
      <div style={{
        width: w, height: h, borderRadius: 7, flex: 'none',
        background: active ? 'oklch(22% 0.05 262)' : 'var(--color-bg-3)',
        border: `1px solid ${active ? 'oklch(22% 0.05 262)' : 'var(--color-border-default)'}`,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
          {shape}
        </div>
        <div style={{ fontSize: 12, color: active ? 'oklch(40% 0.10 152)' : 'var(--color-text-tertiary)', marginTop: 2 }}>
          {active ? '✓ selected' : 'tap to enable'}
        </div>
      </div>
    </button>
  );
};

window.RegisterSystemAppPage = RegisterSystemAppPage;
