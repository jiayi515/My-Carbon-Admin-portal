/* global React, Btn, Badge, Input, Icon, Modal, Field, Textarea, SAAppIcon */
// ─────────────────────────────────────────────────────────────
// System Apps — Upload-new-version wizard (full-page takeover).
//
// Replaces the old single-screen modal with the same flow used in the
// Carbon ISV console:
//   Step 1 — Upload APK (manifest parsed, package verified, security
//            scan kicked off in the background)
//   Step 2 — Version info (release notes)
//   Modal  — Review & publish (gated by scan completion)
//
// On publish, the new version lands as `published` immediately. There is
// no longer a separate "Publish from Versions tab" step — uploads and
// publishes are one action, gated by the security scan.
// ─────────────────────────────────────────────────────────────

const { useState: useStateUW, useEffect: useEffectUW } = React;

// ── Vulnerability scan fixtures ──────────────────────────────
const UW_SEVERITY = {
  critical: { label: 'Critical', tone: 'danger',  color: 'oklch(50% 0.20 25)'  },
  high:     { label: 'High',     tone: 'danger',  color: 'oklch(58% 0.20 25)'  },
  medium:   { label: 'Medium',   tone: 'warning', color: 'oklch(70% 0.18 70)'  },
  low:      { label: 'Low',      tone: 'info',    color: 'oklch(62% 0.14 235)' },
  info:     { label: 'Info',     tone: 'neutral', color: 'var(--color-text-tertiary)' },
};

// Curated scan results — mirrors the ISV wizard's "cleanish" template.
const UW_FINDINGS = [
  { sev: 'medium', title: 'Outdated OkHttp library',    cve: 'CVE-2023-3635', pkg: 'com.squareup.okhttp3:okhttp',  ver: '4.9.3', fix: '4.12.0', desc: 'Improper certificate validation can cause MitM susceptibility on TLS 1.0 handshakes.' },
  { sev: 'low',    title: 'Cleartext traffic permitted', cve: null,           pkg: 'AndroidManifest.xml',          ver: '—',     fix: 'Set usesCleartextTraffic="false"', desc: 'App allows clear-text HTTP traffic in network security config.' },
  { sev: 'low',    title: 'Permission rationale missing', cve: null,          pkg: 'android.permission.CAMERA',    ver: '—',     fix: 'Add shouldShowRequestPermissionRationale() check', desc: 'Camera permission is requested without a contextual rationale shown to the operator.' },
  { sev: 'info',   title: 'Embedded debug symbols',     cve: null,            pkg: 'lib/arm64-v8a/libsyscore.so',  ver: '—',     fix: 'Strip with R8 / ProGuard', desc: 'Native library ships with debug symbols, increasing APK size.' },
];

const summariseFindings = (findings) => {
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (findings || []).forEach((f) => { out[f.sev] = (out[f.sev] || 0) + 1; });
  return out;
};

// ── Local layout atoms ───────────────────────────────────────
const UWSection = ({ title, body }) => (
  <div>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
    {body && <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--color-text-tertiary)', maxWidth: 640, lineHeight: 1.55 }}>{body}</p>}
  </div>
);

const UWSpinner = ({ size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    border: `${Math.max(2, Math.round(size / 12))}px solid var(--color-bg-3)`,
    borderTopColor: 'var(--color-primary-600)',
    animation: 'spin .8s linear infinite',
    flexShrink: 0,
  }} />
);

const UWCard = ({ title, hint, children }) => (
  <section style={{
    background: 'var(--color-bg-2)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 10, padding: '14px 16px',
  }}>
    {title && (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{hint}</div>}
      </div>
    )}
    {children}
  </section>
);

const UWKV = ({ label, value, copy }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '120px 1fr auto', alignItems: 'baseline',
    columnGap: 12, padding: '6px 0',
    borderBottom: '1px dashed var(--color-border-subtle)',
  }}>
    <div className="overline" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</div>
    <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)', minWidth: 0, wordBreak: 'break-all' }}>{value}</div>
    {copy && (
      <button title="Copy" style={{
        padding: 3, borderRadius: 4, color: 'var(--color-text-tertiary)',
      }}>
        <Icon name="copy" size={12} />
      </button>
    )}
  </div>
);

// Severity bar — stacked, normalized to total
const UWSeverityBar = ({ counts, height = 6 }) => {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const total = order.reduce((s, k) => s + (counts[k] || 0), 0);
  if (total === 0) {
    return <div style={{ height, borderRadius: 999, background: 'var(--color-success-50)' }} />;
  }
  return (
    <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: 'var(--color-bg-3)' }}>
      {order.map((k) => {
        const v = counts[k] || 0;
        if (!v) return null;
        return <div key={k} style={{ flex: v, background: UW_SEVERITY[k].color }} />;
      })}
    </div>
  );
};

// Tone-tinted pill (local — shared.jsx Badge is tds-class-based)
const UW_PILL_TONES = {
  success: { fg: 'var(--color-success-700)', bg: 'var(--color-success-50)',  dot: 'var(--color-success-500)' },
  warning: { fg: 'var(--color-warning-700)', bg: 'var(--color-warning-50)',  dot: 'var(--color-warning-500)' },
  danger:  { fg: 'var(--color-error-700)',   bg: 'var(--color-error-50)',    dot: 'var(--color-error-500)'   },
  info:    { fg: 'var(--color-info-700)',    bg: 'var(--color-info-50)',     dot: 'var(--color-info-500)'    },
  neutral: { fg: 'var(--color-text-secondary)', bg: 'var(--color-bg-3)',     dot: 'var(--color-text-tertiary)' },
};
const UWPill = ({ tone = 'neutral', dot, size = 'sm', children }) => {
  const c = UW_PILL_TONES[tone] || UW_PILL_TONES.neutral;
  const pad = size === 'lg' ? '4px 10px' : size === 'md' ? '3px 9px' : '2px 8px';
  const fs = size === 'lg' ? 12 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999, fontSize: fs, fontWeight: 500,
      color: c.fg, background: c.bg,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />}
      {children}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main wizard
// ─────────────────────────────────────────────────────────────
const SystemAppUploadWizard = ({ app, onClose, onPublish }) => {
  const [step, setStep] = useStateUW(0);

  // Step 1 — APK upload (simulated)
  const [uploadState, setUploadState] = useStateUW('idle'); // idle | uploading | parsed
  const [uploadPct, setUploadPct] = useStateUW(0);
  const [parsed, setParsed] = useStateUW(null);
  const [mismatch, setMismatch] = useStateUW(null); // { detected }

  // Step 1.5 — Background scan (kicks off when upload parses)
  const [scanState, setScanState] = useStateUW('queued'); // queued | scanning | done
  const [scanPct, setScanPct] = useStateUW(0);

  // Step 2 — Version info
  const [versionNotes, setVersionNotes] = useStateUW('');

  // Modal state
  const [confirmOpen, setConfirmOpen] = useStateUW(false);
  const [cancelOpen, setCancelOpen] = useStateUW(false);

  // Reset on mount / app change
  useEffectUW(() => {
    setStep(0);
    setUploadState('idle');
    setUploadPct(0);
    setParsed(null);
    setMismatch(null);
    setScanState('queued');
    setScanPct(0);
    setVersionNotes('');
  }, [app?.id]);

  // Simulate upload
  useEffectUW(() => {
    if (uploadState !== 'uploading') return;
    const t = setInterval(() => {
      setUploadPct((p) => {
        if (p >= 100) {
          clearInterval(t);
          setTimeout(() => {
            // Auto-bump version number from latest
            const last = app.versions[0]?.name || '1.0.0';
            const parts = last.split('.').map((s) => parseInt(s, 10) || 0);
            parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
            const ver = parts.join('.');
            const lastCode = Math.max(0, ...app.versions.map((v) => v.code || 0));
            const certLabel = app.signer === 'system' ? 'TOMS SYSTEM' : app.signer === 'npt' ? 'NPT' : 'Unknown';
            const parsedInfo = {
              filename: `${app.pkg}_${ver}.apk`,
              size: '28.4 MB',
              version: ver,
              code: lastCode + 1,
              package: app.pkg,
              minSdk: 24, targetSdk: 34, perms: 14,
              signer: `${certLabel} certificate`,
              fingerprint: 'SHA-256 d4:e2:8a:91:c2:bb:7f:00:1a:…',
            };
            setParsed(parsedInfo);
            // For demo, the APK always matches the preselected app.
            setMismatch(null);
            setUploadState('parsed');
          }, 200);
          return 100;
        }
        return Math.min(100, p + 6 + Math.random() * 12);
      });
    }, 90);
    return () => clearInterval(t);
  }, [uploadState, app?.id]);

  // Kick the scan off once the upload parses
  useEffectUW(() => {
    if (uploadState !== 'parsed' || scanState !== 'queued') return;
    setScanState('scanning');
    setScanPct(0);
    const SCAN_MS = 3200;
    const t0 = performance.now();
    let raf;
    const tick = () => {
      const pct = Math.min(100, ((performance.now() - t0) / SCAN_MS) * 100);
      setScanPct(pct);
      if (pct >= 100) { setScanState('done'); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState]);

  const steps = [
    { id: 'upload', label: 'Upload APK' },
    { id: 'info',   label: 'Version info' },
  ];

  const canNext = (() => {
    if (step === 0) return uploadState === 'parsed' && !mismatch;
    if (step === 1) return versionNotes.trim().length > 5;
    return true;
  })();

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const attemptCancel = () => {
    if (uploadState === 'idle') { onClose(); return; }
    setCancelOpen(true);
  };

  const counts = summariseFindings(UW_FINDINGS);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100%',
      background: 'var(--color-bg-1)',
    }}>
      {/* Page header */}
      <div style={{
        background: 'var(--color-bg-2)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '14px 32px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1080, margin: '0 auto' }}>
          <button onClick={attemptCancel}
            style={{ color: 'var(--color-text-tertiary)', padding: 4 }}
            title="Back">
            <Icon name="chevL" size={18} />
          </button>
          <SAAppIcon name={app.name} pkg={app.pkg} size={40} radius={9} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Upload new version · {app.name}
            </h1>
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-mono)' }}>
              {app.pkg}
            </div>
          </div>
          <Btn variant="ghost" onClick={attemptCancel}>Cancel</Btn>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16, maxWidth: 1080, margin: '16px auto 0' }}>
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.id} style={{
                flex: 1, padding: '0 0 12px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    background: done ? 'var(--color-primary-700)' : active ? 'var(--color-bg-2)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'var(--color-primary-500)' : done ? 'transparent' : 'var(--color-border-default)',
                    color: done ? 'var(--color-text-on-primary)' : active ? 'var(--color-primary-600)' : 'var(--color-text-tertiary)',
                    fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-family-mono)',
                  }}>
                    {done ? <Icon name="check" size={10} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: active ? 500 : 400,
                    color: active ? 'var(--color-text-primary)' : done ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                    whiteSpace: 'nowrap',
                  }}>{s.label}</span>
                </div>
                <div style={{
                  height: 2, borderRadius: 1,
                  background: done ? 'var(--color-primary-700)' : active ? 'var(--color-primary-200)' : 'var(--color-border-subtle)',
                }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 32px 32px' }}>
          {step === 0 && (
            <UWStepUpload
              app={app}
              state={uploadState} pct={uploadPct} parsed={parsed} mismatch={mismatch}
              onStart={() => setUploadState('uploading')}
              onReupload={() => { setUploadState('idle'); setParsed(null); setScanState('queued'); setScanPct(0); }} />
          )}
          {step === 1 && (
            <UWStepInfo app={app} parsed={parsed} notes={versionNotes} setNotes={setVersionNotes} />
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <footer style={{
        padding: '12px 32px',
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-2)',
        display: 'flex', alignItems: 'center', gap: 8,
        position: 'sticky', bottom: 0,
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          {step > 0 && <Btn variant="ghost" icon="chevL" onClick={prev}>Back</Btn>}
          <div style={{ flex: 1, fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
            Step <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{step + 1}</span> of {steps.length}
            {' · '}<span>{steps[step].label}</span>
          </div>
          {step < steps.length - 1 ? (
            <Btn variant="primary" disabled={!canNext} onClick={next} iconRight="chevR">Continue</Btn>
          ) : (
            <Btn variant="primary" icon="check" disabled={!canNext}
              onClick={() => setConfirmOpen(true)}>
              Review & publish
            </Btn>
          )}
        </div>
      </footer>

      {/* Confirm — vulnerability scan report */}
      <UWConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onPublish && onPublish({ app, parsed, versionNotes, findings: UW_FINDINGS, counts });
        }}
        app={app} parsed={parsed}
        scanState={scanState} scanPct={scanPct}
        counts={counts} findings={UW_FINDINGS} />

      {/* Cancel confirmation */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} width={460}
        title="Discard this version upload?"
        footer={<>
          <Btn variant="ghost" onClick={() => setCancelOpen(false)}>Keep editing</Btn>
          <Btn variant="danger" icon="x" onClick={() => { setCancelOpen(false); onClose(); }}>Discard upload</Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          The APK you uploaded and release notes will be lost. The security scan in progress will be cancelled.
        </p>
      </Modal>
    </div>
  );
};

// ─── Step 1 — Upload APK ──────────────────────────────────
const UWStepUpload = ({ app, state, pct, parsed, mismatch, onStart, onReupload }) => {
  const certLabel = app.signer === 'system' ? 'TOMS SYSTEM' : app.signer === 'npt' ? 'NPT' : 'Unknown';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <UWSection title="Upload APK"
        body={<>Drag the signed APK file here, or click to browse. TOMS will parse the manifest and verify the signature matches the <strong>{certLabel}</strong> certificate registered for this app.</>} />

      {state === 'idle' && (
        <button onClick={onStart} style={{
          padding: '44px 24px',
          border: '1.5px dashed var(--color-border-default)',
          borderRadius: 12,
          background: 'var(--color-bg-3)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          width: '100%', cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-500)'; e.currentTarget.style.background = 'var(--color-primary-50)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-3)'; }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'var(--color-bg-2)', border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)', display: 'grid', placeItems: 'center',
          }}>
            <Icon name="upload" size={20} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>Drag your APK here, or click to browse</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
            Signed APK · up to 200&nbsp;MB · package: <span style={{ fontFamily: 'var(--font-family-mono)' }}>{app.pkg}</span>
          </div>
        </button>
      )}

      {state === 'uploading' && (
        <div style={{ padding: 24, background: 'var(--color-bg-2)',
          border: '1px solid var(--color-border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="upload" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500 }}>{app.pkg}.apk</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                Uploading… <span style={{ fontFamily: 'var(--font-family-mono)' }}>{Math.round(pct)}%</span>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>28.4&nbsp;MB</span>
          </div>
          <div style={{ marginTop: 14, height: 4, borderRadius: 999, background: 'var(--color-bg-3)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary-700)', transition: 'width .1s' }} />
          </div>
        </div>
      )}

      {state === 'parsed' && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload success */}
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-success-50)',
            borderRadius: 8,
            border: '1px solid color-mix(in oklab, var(--color-success-500) 25%, transparent)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Icon name="check" size={14} style={{ color: 'var(--color-success-700)' }} />
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--color-success-700)' }}>
              Upload complete · Signature verified ({certLabel}) · Manifest parsed
            </div>
            <Btn variant="ghost" size="sm" icon="rotate" onClick={onReupload}>Re-upload</Btn>
          </div>

          {/* Scan started */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--color-info-50)',
            borderRadius: 8,
            border: '1px solid color-mix(in oklab, var(--color-info-500) 22%, transparent)',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--color-info-700)',
          }}>
            <UWSpinner size={14} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500 }}>Security scan started in the background</span>
              <span style={{ color: 'var(--color-text-tertiary)' }}> · You can continue. The full report appears on the Review & publish step.</span>
            </div>
          </div>

          {/* Detected package */}
          <UWCard title="Detected package information">
            <UWKV label="File" value={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-family-mono)' }}>{parsed.filename}</span>
                <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-tertiary)' }}>{parsed.size}</span>
              </span>
            } copy />
            <UWKV label="Package" value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{parsed.package}</span>} copy />
            <UWKV label="Version" value={
              <span style={{ fontFamily: 'var(--font-family-mono)' }}>
                {parsed.version}{' '}
                <span style={{ color: 'var(--color-text-tertiary)' }}>· code {parsed.code}</span>
              </span>
            } />
            <UWKV label="Min / Target SDK" value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{parsed.minSdk} / {parsed.targetSdk}</span>} />
            <UWKV label="Permissions" value={<span style={{ fontFamily: 'var(--font-family-mono)' }}>{parsed.perms} declared</span>} />
            <UWKV label="Signer" value={parsed.signer} />
            <UWKV label="Fingerprint" value={<span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>{parsed.fingerprint}</span>} copy />
          </UWCard>

          {/* Package match confirmation */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--color-primary-50)',
            borderRadius: 8,
            border: '1px solid color-mix(in oklab, var(--color-primary-500) 22%, transparent)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <SAAppIcon name={app.name} pkg={app.pkg} size={36} radius={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Target app confirmed</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {app.name}{' '}
                <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>· {app.pkg}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                {app.versions[0] ? (
                  <>Previous version <span style={{ fontFamily: 'var(--font-family-mono)' }}>{app.versions[0].name}</span> → new version <span style={{ fontFamily: 'var(--font-family-mono)' }}>{parsed.version}</span>.</>
                ) : (
                  <>First version for this app.</>
                )}
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 500,
              padding: '3px 8px', borderRadius: 999,
              background: 'var(--color-bg-2)', color: 'var(--color-primary-700)',
              border: '1px solid color-mix(in oklab, var(--color-primary-500) 22%, transparent)',
            }}>
              <Icon name="check" size={11} /> verified
            </span>
          </div>

          {mismatch && (
            <div style={{
              padding: '12px 14px',
              background: 'var(--color-error-50)',
              borderRadius: 8,
              border: '1px solid color-mix(in oklab, var(--color-error-500) 30%, transparent)',
              display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--color-error-700)',
            }}>
              <Icon name="alert" size={15} style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Package mismatch</div>
                <div style={{ marginTop: 3, color: 'var(--color-text-secondary)' }}>
                  This APK declares <span style={{ fontFamily: 'var(--font-family-mono)' }}>{mismatch.detected}</span> but the app expects <span style={{ fontFamily: 'var(--font-family-mono)' }}>{app.pkg}</span>. Re-upload the correct APK.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Step 2 — Version info ────────────────────────────────
const UWStepInfo = ({ app, parsed, notes, setNotes }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <UWSection title="Version info"
      body="Document what changed in this version. Release notes appear on the version detail page and ship in the changelog distributed to ISOs alongside the APK." />

    <UWCard>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="overline" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Version number</div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-family-mono)', fontSize: 14, fontWeight: 500 }}>
            {parsed?.version}{' '}
            <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>· code {parsed?.code}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Parsed from <span style={{ fontFamily: 'var(--font-family-mono)' }}>versionName</span> / <span style={{ fontFamily: 'var(--font-family-mono)' }}>versionCode</span> in the manifest.
          </div>
        </div>
        <div>
          <div className="overline" style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Previous version</div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-family-mono)', fontSize: 14, fontWeight: 500 }}>
            {app.versions[0]?.name || '—'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {app.versions[0] ? `Uploaded ${app.versions[0].uploaded || '—'}` : 'This will be the first version for this app.'}
          </div>
        </div>
      </div>
    </UWCard>

    <Field label="Release notes" required hint={<><span style={{ fontFamily: 'var(--font-family-mono)' }}>{notes.length}</span> / 500 characters · Markdown supported · Minimum 5 characters</>}>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6}
        placeholder={'e.g.\n• Fixes EMV fallback on N750P\n• Adds tip-suggestion presets\n• Offline queue retry now uses exponential backoff'} />
    </Field>
  </div>
);

// ─── Review & Publish modal ───────────────────────────────
const UWConfirmModal = ({ open, onClose, onConfirm, app, parsed, scanState, scanPct, counts, findings }) => {
  const [findingsOpen, setFindingsOpen] = useStateUW(false);
  if (!open) return null;
  const scanDone = scanState === 'done';
  const totalFindings = (findings || []).length;
  const blocking = (counts?.critical || 0) + (counts?.high || 0);
  const scanTone = !scanDone ? 'info' : totalFindings === 0 ? 'success' : blocking > 0 ? 'danger' : 'warning';
  const scanLabel = !scanDone ? 'Scanning…' : totalFindings === 0 ? 'Clean' : blocking > 0 ? 'High/Critical findings' : 'Findings present';

  return (
    <Modal open onClose={onClose} width={680}
      title="Vulnerability scan report"
      footer={<>
        <span style={{ marginRight: 'auto', fontSize: 11.5, color: 'var(--color-text-tertiary)',
          display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name={scanDone ? 'info' : 'clock'} size={12} />
          <span>{scanDone
            ? 'Publishing is immediate. Terminals download on next check-in.'
            : 'Scan typically completes in 2–4 min. You can leave this modal open.'}</span>
        </span>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!scanDone} onClick={onConfirm}>
          {scanDone ? 'Publish now' : 'Waiting for scan…'}
        </Btn>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Slim app summary */}
        <div style={{
          padding: '14px 16px', borderRadius: 8,
          background: 'var(--color-bg-3)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <SAAppIcon name={app.name} pkg={app.pkg} size={44} radius={10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {app?.name}{' '}
              <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                · {parsed?.version}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-family-mono)', marginTop: 3, fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
              {parsed?.package} · code {parsed?.code} · {parsed?.size}
            </div>
          </div>
        </div>

        {/* Scan body */}
        {!scanDone ? (
          <div style={{
            padding: '20px 18px',
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <UWSpinner size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Scanning dependencies & manifest…</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                  {scanPct < 30 ? 'Decompiling bytecode'
                    : scanPct < 60 ? 'Matching CVE database'
                      : scanPct < 90 ? 'Inspecting permissions'
                        : 'Finalising report'}
                  {' · '}<span style={{ fontFamily: 'var(--font-family-mono)' }}>{Math.round(scanPct || 0)}%</span>
                </div>
              </div>
              <UWPill tone="info" dot>In progress</UWPill>
            </div>
            <div style={{ marginTop: 14, height: 4, borderRadius: 999, background: 'var(--color-bg-3)', overflow: 'hidden' }}>
              <div style={{ width: `${scanPct || 0}%`, height: '100%', background: 'var(--color-primary-700)', transition: 'width .15s' }} />
            </div>
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 6,
              background: 'var(--color-warning-50)',
              border: '1px solid color-mix(in oklab, var(--color-warning-500) 28%, transparent)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, color: 'var(--color-warning-700)',
            }}>
              <Icon name="shield" size={13} />
              <span><b>Publish is locked</b> until the scan finishes. Every published version must pass a vulnerability check.</span>
            </div>
          </div>
        ) : (
          <div style={{
            padding: 14, background: 'var(--color-bg-2)',
            borderRadius: 10, border: '1px solid var(--color-border-default)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <UWPill tone={scanTone} dot size="lg">{scanLabel}</UWPill>
              <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {totalFindings} finding{totalFindings === 1 ? '' : 's'}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>Scanned in 2m 41s</span>
            </div>

            {totalFindings > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {Object.entries(counts).map(([k, v]) => (
                    <div key={k} style={{
                      padding: '8px 10px', borderRadius: 6,
                      background: v > 0 ? 'var(--color-bg-3)' : 'transparent',
                      borderLeft: `3px solid ${UW_SEVERITY[k].color}`,
                    }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
                        fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{UW_SEVERITY[k].label}</div>
                      <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 18, fontWeight: 500,
                        color: v > 0 ? UW_SEVERITY[k].color : 'var(--color-text-tertiary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <UWSeverityBar counts={counts} height={6} />
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    {blocking > 0 ? (
                      <><b style={{ color: 'var(--color-error-700)' }}>{blocking} high/critical finding{blocking === 1 ? '' : 's'}.</b>{' '}
                        Recommended fixes are not blocking, but should be addressed in a follow-up release.</>
                    ) : (
                      <>None of the findings are blocking — you can publish and address them in a future version.</>
                    )}
                  </span>
                  <Btn size="sm" iconRight="chevR" onClick={() => setFindingsOpen(true)}>
                    View {totalFindings} finding{totalFindings === 1 ? '' : 's'}
                  </Btn>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--color-success-700)',
                display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="check" size={12} />
                Clean scan — no findings reported.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Findings drilldown */}
      <Modal open={findingsOpen} onClose={() => setFindingsOpen(false)} width={620}
        title="Scan findings"
        footer={<Btn variant="ghost" onClick={() => setFindingsOpen(false)}>Close</Btn>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {findings.map((f, i) => {
            const sev = UW_SEVERITY[f.sev];
            return (
              <div key={i} style={{
                padding: '10px 12px',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: `3px solid ${sev.color}`,
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <UWPill tone={sev.tone} size="sm">{sev.label}</UWPill>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.title}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  {f.cve ? <span>{f.cve} · </span> : null}{f.pkg}{f.ver && f.ver !== '—' ? <span> · {f.ver}</span> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {f.desc}{' '}
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Fix: {f.fix}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </Modal>
  );
};

window.SystemAppUploadWizard = SystemAppUploadWizard;
