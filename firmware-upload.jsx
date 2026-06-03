/* global React, Btn, Input, Field, Icon, Badge, useToast, fmtDate */
// ─────────────────────────────────────────────────────────────
// Firmware upload wizard.
//
// Three steps:
//   1. OS picker — Android · Linux · RTOS. Selected card shows the
//      file-format pattern + hint for that OS.
//   2. File upload — drag/drop or browse. Filename is validated against
//      the per-OS regex; mismatch = inline error, can't advance.
//   3. Backfill form — fields parsed from filename are pre-populated;
//      operator can correct them before saving.
//
// Single-file only (per spec). Sub-package list is mock — backend will
// compute real MD5s on its side.
// ─────────────────────────────────────────────────────────────
const { useState: useStateFU, useRef: useRefFU, useMemo: useMemoFU } = React;

// ─── Step 1: OS picker ────────────────────────────────────
const OSPickerCard = ({ os, selected, onSelect }) => {
  const meta = window.FW_OS_META[os];
  const tone = window.FW_OS_TONE[os];
  return (
    <button
      type="button"
      onClick={() => onSelect(os)}
      className={`fu-os ${selected ? 'is-on' : ''}`}
    >
      <div className="fu-os__top">
        <div className="fu-os__name">{meta.label}</div>
        <Badge tone={tone} dot>{os}</Badge>
      </div>
      <div className="fu-os__pat">{meta.pattern}</div>
      <div className="fu-os__hint">{meta.hint}</div>
    </button>
  );
};

// ─── Step 2: drop zone + filename validation ──────────────
const DropZone = ({ os, file, onFile, error }) => {
  const inputRef = useRefFU(null);
  const meta     = window.FW_OS_META[os];
  const [hover, setHover] = useStateFU(false);

  const pick = () => inputRef.current?.click();
  const onChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`fu-drop ${hover ? 'is-hover' : ''} ${error ? 'has-error' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={meta.ext}
        style={{ display: 'none' }}
        onChange={onChange}
      />
      {file ? (
        <div className="fu-drop__file">
          <div className="fu-drop__fileicon">
            <Icon name="package" size={22}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fu-drop__filename">{file.name}</div>
            <div className="fu-drop__filemeta">
              <span style={{ fontFamily: 'var(--font-family-mono)' }}>{formatBytes(file.size)}</span>
              {!error && (
                <>
                  <span>·</span>
                  <span style={{ color: 'var(--color-success-700, oklch(50% 0.13 152))', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={11}/> Filename matches {meta.label} pattern
                  </span>
                </>
              )}
            </div>
            {error && <div className="fu-drop__err"><Icon name="info" size={11}/> {error}</div>}
          </div>
          <Btn variant="ghost" size="sm" onClick={pick}>Replace</Btn>
        </div>
      ) : (
        <button type="button" className="fu-drop__empty" onClick={pick}>
          <div className="fu-drop__icon"><Icon name="upload" size={22}/></div>
          <div className="fu-drop__title">Drop a {meta.label} firmware file here, or click to browse</div>
          <div className="fu-drop__sub">
            Accepts <code style={{ fontFamily: 'var(--font-family-mono)' }}>{meta.ext}</code> · single file only
          </div>
          <div className="fu-drop__pat">{meta.pattern}</div>
        </button>
      )}
    </div>
  );
};

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

// Try to parse a filename against the selected-OS regex. Returns the
// parsed-field bag plus an error string when invalid.
const parseFileName = (os, name) => {
  const meta = window.FW_OS_META[os];
  const m = name.match(meta.regex);
  if (!m) {
    return {
      ok: false,
      error: `Filename doesn't match the ${meta.label} pattern. Expected: ${meta.pattern}`,
    };
  }
  return { ok: true, parsed: meta.parse(m), error: null };
};

// ─── Step 3: file info / backfill form ────────────────────
const FileInfoForm = ({ os, file, parsed, fields, setField }) => {
  const meta = window.FW_OS_META[os];
  // Generate mock sub-packages for non-Linux platforms based on the model
  // code & version — backend will replace these with real entries.
  const mockPkgs = useMemoFU(() => {
    if (!meta.hasSubPackages) return [];
    if (os === 'RTOS') {
      return [
        { name: 'kernel.bin',  size: '2.4 MB', md5: '— pending —' },
        { name: 'rootfs.bin',  size: '8.6 MB', md5: '— pending —' },
        { name: 'app.bin',     size: '1.8 MB', md5: '— pending —' },
      ];
    }
    return [
      { name: 'boot.img',     size: '24.6 MB',  md5: '— pending —' },
      { name: 'system.img',   size: '128.4 MB', md5: '— pending —' },
      { name: 'vendor.img',   size: '18.2 MB',  md5: '— pending —' },
      { name: 'recovery.img', size: '12.8 MB',  md5: '— pending —' },
      { name: 'update.bin',   size: '4.1 MB',   md5: '— pending —' },
    ];
  }, [os, meta.hasSubPackages]);

  return (
    <div className="info-card">
      <div className="info-card__head">
        <div className="info-card__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={14}/> Upload complete · review &amp; save
        </div>
        <Badge tone="success" dot>Parsed from filename</Badge>
      </div>
      <div className="info-card__body">

        {/* Read-only file summary */}
        <div className="fu-summary">
          <div className="fu-summary__row">
            <div className="fu-summary__lbl">File</div>
            <div className="fu-summary__val" style={{ fontFamily: 'var(--font-family-mono)' }}>{file.name}</div>
          </div>
          <div className="fu-summary__row">
            <div className="fu-summary__lbl">Size</div>
            <div className="fu-summary__val" style={{ fontFamily: 'var(--font-family-mono)' }}>{formatBytes(file.size)}</div>
          </div>
          <div className="fu-summary__row">
            <div className="fu-summary__lbl">OS</div>
            <div className="fu-summary__val">
              <Badge tone={window.FW_OS_TONE[os]} dot>{os}</Badge>
            </div>
          </div>
          <div className="fu-summary__row">
            <div className="fu-summary__lbl">MD5</div>
            <div className="fu-summary__val" style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-tertiary)' }}>
              — backend will compute on save —
            </div>
          </div>
        </div>

        {/* Editable backfilled fields */}
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Version name" required hint="Parsed from filename — edit if needed.">
            <Input value={fields.versionName} onChange={e => setField('versionName', e.target.value)}/>
          </Field>
          <Field label="Model code" required>
            <Input value={fields.modelCode} onChange={e => setField('modelCode', e.target.value.toUpperCase())}/>
          </Field>
          <Field label="Device flag" required hint="The {device flag} segment from the filename.">
            <Input value={fields.deviceFlag} onChange={e => setField('deviceFlag', e.target.value.toUpperCase())}/>
          </Field>
          {os === 'LINUX' && (
            <>
              <Field label="Start version" required>
                <Input value={fields.versionStart || ''} onChange={e => setField('versionStart', e.target.value)}/>
              </Field>
              <Field label="End version" required>
                <Input value={fields.versionEnd || ''} onChange={e => setField('versionEnd', e.target.value)}/>
              </Field>
              <Field label="Customer name" hint="From the filename — the {customer name} segment.">
                <Input value={fields.customer || ''} onChange={e => setField('customer', e.target.value)}/>
              </Field>
              <Field label="Patch date" hint="From the filename — {date}.">
                <Input value={fields.date || ''} onChange={e => setField('date', e.target.value)}/>
              </Field>
            </>
          )}
        </div>

        {/* Changelog */}
        <div style={{ marginTop: 14 }}>
          <Field label="Changelog" hint="Short notes about this version — shown on the version detail page.">
            <textarea
              className="tds-input"
              rows={3}
              value={fields.changelog || ''}
              onChange={e => setField('changelog', e.target.value)}
              placeholder="What changed in this version? (e.g. EMV L2 kernel update, NFC stability fixes…)"
              style={{ resize: 'vertical', minHeight: 64, fontFamily: 'var(--font-family-sans)', fontSize: 13, lineHeight: 1.55, width: '100%', padding: '8px 10px', border: '1px solid var(--color-border-default)', borderRadius: 6, background: 'var(--color-bg-2)', color: 'var(--color-text-primary)' }}
            />
          </Field>
        </div>

        {/* Pending-publish notice — uploads start unpublished. Publishing
            happens from the version detail page, where the admin picks the ISO audience. */}
        <div className="ov-divider" style={{ margin: '20px 0 14px' }}/>
        <div className="fu-draft-info">
          <Icon name="info" size={14}/>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>Saved as Pending publish</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              The upload is held privately for review. After saving, open the version detail page and use <strong style={{ fontWeight: 600 }}>Publish</strong> to choose which ISO customers can see it in their OTA management menu.
            </div>
          </div>
        </div>

        {/* Sub-package list */}
        {meta.hasSubPackages ? (
          <>
            <div className="ov-divider" style={{ margin: '20px 0 14px' }}/>
            <div className="ov-section-label" style={{ marginBottom: 8 }}>
              Sub-packages · detected
              <span className="muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                MD5 sums are computed server-side on save.
              </span>
            </div>
            <div className="fu-pkglist">
              {mockPkgs.map((p, i) => (
                <div key={i} className="fu-pkglist__row">
                  <div className="fu-pkglist__name"><Icon name="file" size={12}/> <span style={{ fontFamily: 'var(--font-family-mono)' }}>{p.name}</span></div>
                  <div className="fu-pkglist__size" style={{ fontFamily: 'var(--font-family-mono)' }}>{p.size}</div>
                  <div className="fu-pkglist__md5">{p.md5}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="ov-divider" style={{ margin: '20px 0 14px' }}/>
            <div style={{ background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="info" size={14} style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}/>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                Linux MAN patches are delivered as a single monolithic <code style={{ fontFamily: 'var(--font-family-mono)' }}>.NLD</code> file — no sub-package breakdown is shown.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Wizard shell ─────────────────────────────────────────
const FirmwareUploadWizard = ({ onCancel, onSaved, onCommit }) => {
  const [step, setStep] = useStateFU(1);   // 1 = OS · 2 = upload · 3 = info
  const [os, setOs]     = useStateFU(null);
  const [file, setFile] = useStateFU(null);
  const [error, setError] = useStateFU(null);
  const [fields, setFields] = useStateFU({
    versionName: '', versionCode: '', modelCode: '', deviceFlag: '',
    versionStart: '', versionEnd: '', customer: '', date: '',
    changelog: '',
  });
  // Uploads always start as drafts. Publishing happens from the version
  // detail page, where the admin picks the ISO audience.
  const toast = useToast();

  const setField = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const handleFile = (f) => {
    setError(null);
    setFile(f);
    const r = parseFileName(os, f.name);
    if (!r.ok) {
      setError(r.error);
      // still keep the file (user can replace), but block advance
      return;
    }
    // Pre-fill the form from the parsed result
    const p = r.parsed;
    setFields({
      versionName:  p.versionName || '',
      versionCode:  String((window.FW_OS_META[os].parse ? (function() {
        const name = (p.versionName || '').replace(/^V/i, '');
        const m = name.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
        if (!m) return 1;
        return parseInt(m[1] || '0', 10) * 10000 + parseInt(m[2] || '0', 10) * 100 + parseInt(m[3] || '0', 10);
      })() : 1)),
      modelCode:    p.modelCode || '',
      deviceFlag:   p.deviceFlag || '',
      versionStart: p.versionStart || '',
      versionEnd:   p.versionEnd || '',
      customer:     p.customer || '',
      date:         p.date || '',
    });
  };

  const canAdvanceStep2 = !!file && !error;
  const canSave = fields.versionName.trim() &&
                  fields.modelCode.trim()   && fields.deviceFlag.trim();

  // Fake md5 so the row looks real in mock land. Backend computes for real.
  const __fakeMd5 = (s) => {
    let h = 0xdeadbeef;
    for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    const hex = h.toString(16).padStart(8, '0');
    return (hex + hex + hex + hex).slice(0, 32);
  };

  const save = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const sizeMb = file.size / 1024 / 1024;
    const meta = window.FW_OS_META[os];
    // Mock sub-packages — backend will replace with real entries.
    const mockPkgs = !meta.hasSubPackages ? [] :
      os === 'RTOS' ? [
        { name: 'kernel.bin',  size: '2.4 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'kernel') },
        { name: 'rootfs.bin',  size: '8.6 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'rootfs') },
        { name: 'app.bin',     size: '1.8 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'app') },
      ] : [
        { name: 'boot.img',     size: '24.6 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'boot') },
        { name: 'system.img',   size: '128.4 MB', md5: __fakeMd5(fields.modelCode + fields.versionName + 'system') },
        { name: 'vendor.img',   size: '18.2 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'vendor') },
        { name: 'recovery.img', size: '12.8 MB',  md5: __fakeMd5(fields.modelCode + fields.versionName + 'recovery') },
        { name: 'update.bin',   size: '4.1 MB',   md5: __fakeMd5(fields.modelCode + fields.versionName + 'update') },
      ];
    const version = {
      id: `fwv-${fields.modelCode}-${fields.deviceFlag}-${fields.versionName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      versionName:  fields.versionName.trim(),
      versionCode:  parseInt(fields.versionCode, 10) || 1,
      fileName:     file.name,
      fileSize:     `${sizeMb.toFixed(1)} MB`,
      fileSizeBytes: file.size,
      md5:          __fakeMd5(file.name + now),
      uploadedAt:   now,
      uploadedBy:   'fw-pipeline@carbon',
      publishedAt:  null,
      publishedBy:  null,
      status:       'pending-publish',
      current:      false,
      publishedToIsoIds: [],
      publishEvents: [],
      changelog:    fields.changelog?.trim() || 'No changelog provided.',
      packages:     mockPkgs,
      versionStart: fields.versionStart || null,
      versionEnd:   fields.versionEnd   || null,
    };
    let fwId = null;
    if (onCommit) {
      fwId = onCommit({
        os,
        modelCode:  fields.modelCode.trim(),
        deviceFlag: fields.deviceFlag.trim(),
        version,
      });
    }
    toast({
      kind: 'success',
      title: `Pending publish · ${fields.modelCode} · ${fields.deviceFlag} · ${fields.versionName}`,
      msg: 'Saved privately. Open the version detail page and use Publish to pick which ISOs can see it.',
    });
    onSaved && onSaved({ fwId, versionId: version.id });
  };

  const STEP_TITLES = ['Operating system', 'Upload file', 'Review & save'];

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: 'transparent', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12.5px var(--font-family-sans)' }}>
          <Icon name="chevL" size={14}/> Back to Firmware
        </button>
      </div>

      <div className="page__head">
        <div>
          <h1 className="page__title">Upload firmware</h1>
          <p className="page__sub">Upload a new OTA firmware bundle. The system parses the filename to backfill model code, device flag and version.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="fu-stepper">
        {[1, 2, 3].map(n => (
          <div key={n} className={`fu-stepper__step ${step === n ? 'is-active' : ''} ${step > n ? 'is-done' : ''}`}>
            <div className="fu-stepper__num">{step > n ? <Icon name="check" size={12}/> : n}</div>
            <div className="fu-stepper__lbl">{STEP_TITLES[n - 1]}</div>
            {n < 3 && <div className="fu-stepper__bar"/>}
          </div>
        ))}
      </div>

      {/* Step body */}
      {step === 1 && (
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Select the target operating system</div>
            <span className="muted" style={{ fontSize: 12 }}>Each OS has its own filename convention shown below.</span>
          </div>
          <div className="info-card__body">
            <div className="fu-os-grid">
              {window.FW_OS_OPTIONS.map(o => (
                <OSPickerCard key={o} os={o} selected={os === o} onSelect={setOs}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && os && (
        <div className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Upload the {window.FW_OS_META[os].label} firmware file</div>
            <Badge tone={window.FW_OS_TONE[os]} dot>{os}</Badge>
          </div>
          <div className="info-card__body">
            <div className="fu-pattern-banner">
              <Icon name="info" size={13}/>
              <span><strong style={{ fontWeight: 600 }}>File format:</strong> <code style={{ fontFamily: 'var(--font-family-mono)' }}>{window.FW_OS_META[os].pattern}</code></span>
            </div>
            <DropZone os={os} file={file} onFile={handleFile} error={error}/>
          </div>
        </div>
      )}

      {step === 3 && os && file && !error && (
        <FileInfoForm os={os} file={file} fields={fields} setField={setField}/>
      )}

      {/* Footer actions */}
      <div className="fu-footer">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <div style={{ flex: 1 }}/>
        {step > 1 && (
          <Btn variant="secondary" onClick={() => setStep(s => Math.max(1, s - 1))} icon="chevL">Back</Btn>
        )}
        {step === 1 && (
          <Btn variant="primary" disabled={!os} onClick={() => setStep(2)} iconRight="chevR">Continue</Btn>
        )}
        {step === 2 && (
          <Btn variant="primary" disabled={!canAdvanceStep2} onClick={() => setStep(3)} iconRight="chevR">Continue</Btn>
        )}
        {step === 3 && (
          <Btn variant="primary" disabled={!canSave} onClick={save} icon="check">Save as Pending publish</Btn>
        )}
      </div>

      <style>{`
        .fu-stepper { display: flex; align-items: center; gap: 0; margin-bottom: 18px; padding: 14px 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); border-radius: 10px; }
        .fu-stepper__step { display: inline-flex; align-items: center; gap: 8px; flex: 1; position: relative; }
        .fu-stepper__num { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--color-bg-3); border: 1px solid var(--color-border-default); color: var(--color-text-tertiary); font: 600 12px var(--font-family-sans); flex: none; }
        .fu-stepper__step.is-active .fu-stepper__num { background: var(--color-primary-700, oklch(45% 0.16 262)); border-color: var(--color-primary-700, oklch(45% 0.16 262)); color: #fff; }
        .fu-stepper__step.is-done .fu-stepper__num { background: var(--color-success-700, oklch(50% 0.13 152)); border-color: var(--color-success-700, oklch(50% 0.13 152)); color: #fff; }
        .fu-stepper__lbl { font: 500 13px var(--font-family-sans); color: var(--color-text-secondary); }
        .fu-stepper__step.is-active .fu-stepper__lbl { color: var(--color-text-primary); }
        .fu-stepper__bar { flex: 1; height: 1px; background: var(--color-border-default); margin: 0 12px; }

        .fu-os-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 760px) { .fu-os-grid { grid-template-columns: 1fr; } }
        .fu-os { text-align: left; padding: 16px; border: 1.5px solid var(--color-border-default); background: var(--color-bg-2); border-radius: 12px; cursor: pointer; transition: all 0.12s; display: flex; flex-direction: column; gap: 8px; min-height: 124px; }
        .fu-os:hover { border-color: var(--color-border-strong); }
        .fu-os.is-on { border-color: var(--color-primary-700, oklch(45% 0.16 262)); background: var(--color-primary-50, oklch(96% 0.02 262)); box-shadow: 0 0 0 3px oklch(45% 0.16 262 / 0.10); }
        .fu-os__top { display: flex; justify-content: space-between; align-items: center; }
        .fu-os__name { font: 600 15px var(--font-family-sans); }
        .fu-os__pat { font: 500 11.5px var(--font-family-mono); color: var(--color-text-secondary); padding: 6px 8px; background: var(--color-bg-3); border-radius: 6px; border: 1px solid var(--color-border-subtle); word-break: break-all; }
        .fu-os__hint { font-size: 11.5px; color: var(--color-text-tertiary); }

        .fu-pattern-banner { display: flex; gap: 8px; align-items: center; padding: 10px 14px; background: var(--color-primary-50, oklch(96% 0.02 262)); border: 1px solid oklch(45% 0.16 262 / 0.18); border-radius: 8px; color: var(--color-text-primary); font-size: 12.5px; margin-bottom: 14px; }
        .fu-pattern-banner code { font-size: 12px; padding: 1px 6px; background: var(--color-bg-2); border-radius: 4px; border: 1px solid var(--color-border-subtle); }

        .fu-drop { border: 2px dashed var(--color-border-default); border-radius: 12px; background: var(--color-bg-3); transition: all 0.12s; }
        .fu-drop.is-hover { border-color: var(--color-primary-700, oklch(45% 0.16 262)); background: var(--color-primary-50, oklch(96% 0.02 262)); }
        .fu-drop.has-error { border-color: var(--color-error-500, oklch(58% 0.22 25)); background: oklch(96% 0.02 25); }
        .fu-drop.has-file { border-style: solid; background: var(--color-bg-2); }
        .fu-drop__empty { width: 100%; padding: 36px 24px; background: transparent; border: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .fu-drop__icon { width: 48px; height: 48px; border-radius: 50%; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); display: grid; place-items: center; color: var(--color-text-secondary); margin-bottom: 6px; }
        .fu-drop__title { font: 500 14px var(--font-family-sans); color: var(--color-text-primary); }
        .fu-drop__sub { font-size: 12px; color: var(--color-text-tertiary); }
        .fu-drop__pat { margin-top: 6px; font: 500 11.5px var(--font-family-mono); color: var(--color-text-secondary); padding: 6px 12px; background: var(--color-bg-2); border-radius: 6px; border: 1px solid var(--color-border-subtle); }
        .fu-drop__file { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
        .fu-drop__fileicon { width: 44px; height: 44px; border-radius: 8px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); display: grid; place-items: center; color: var(--color-text-secondary); flex: none; }
        .fu-drop__filename { font: 500 13.5px var(--font-family-mono); color: var(--color-text-primary); word-break: break-all; }
        .fu-drop__filemeta { font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .fu-drop__err { font-size: 12px; color: var(--color-error-700, oklch(45% 0.22 25)); margin-top: 6px; display: inline-flex; align-items: center; gap: 5px; }

        .fu-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; padding: 14px 16px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 8px; }
        .fu-summary__row { display: flex; gap: 10px; align-items: center; min-width: 0; }
        .fu-summary__lbl { width: 50px; font: 500 11px var(--font-family-sans); color: var(--color-text-tertiary); letter-spacing: 0.06em; text-transform: uppercase; flex: none; }
        .fu-summary__val { font-size: 13px; color: var(--color-text-primary); min-width: 0; word-break: break-all; }

        .fu-pkglist { border: 1px solid var(--color-border-subtle); border-radius: 8px; overflow: hidden; }
        .fu-pkglist__row { display: grid; grid-template-columns: 1fr 100px 1fr; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--color-border-subtle); align-items: center; font-size: 12.5px; }
        .fu-pkglist__row:last-child { border-bottom: 0; }
        .fu-pkglist__row:nth-child(even) { background: var(--color-bg-3); }
        .fu-pkglist__name { display: inline-flex; gap: 6px; align-items: center; min-width: 0; }
        .fu-pkglist__size { color: var(--color-text-secondary); }
        .fu-pkglist__md5 { color: var(--color-text-tertiary); font: 400 11.5px var(--font-family-mono); }

        .fu-footer { display: flex; gap: 10px; align-items: center; margin-top: 18px; padding: 14px 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); border-radius: 10px; }

        .fu-publish { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 760px) { .fu-publish { grid-template-columns: 1fr; } }
        .fu-publish__opt { text-align: left; padding: 14px 16px; border: 1.5px solid var(--color-border-default); background: var(--color-bg-2); border-radius: 10px; cursor: pointer; transition: all 0.12s; display: flex; flex-direction: column; gap: 6px; }
        .fu-publish__opt:hover { border-color: var(--color-border-strong); }
        .fu-publish__opt.is-on { border-color: var(--color-primary-700, oklch(45% 0.16 262)); background: var(--color-primary-50, oklch(96% 0.02 262)); box-shadow: 0 0 0 3px oklch(45% 0.16 262 / 0.10); }
        .fu-publish__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .fu-publish__name { font: 600 13.5px var(--font-family-sans); display: inline-flex; align-items: center; gap: 6px; }
        .fu-publish__sub { font-size: 12px; line-height: 1.55; color: var(--color-text-secondary); }

        .fu-draft-info {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 8px;
          background: oklch(96% 0.02 252 / 0.5);
          border: 1px solid oklch(58% 0.10 252 / 0.20);
          color: oklch(40% 0.14 252);
        }
        [data-theme="dark"] .fu-draft-info {
          background: oklch(28% 0.04 252 / 0.4);
          color: oklch(78% 0.10 252);
        }
      `}</style>
    </div>
  );
};

window.FirmwareUploadWizard = FirmwareUploadWizard;
