/* global React, Btn, Input, Field, Textarea, Select, Icon, Badge, useToast, DEVICE_MODELS, moneyUSD */
const { useState, useMemo, useRef, useEffect } = React;

// ─── Seed data ──────────────────────────────────────────────
// Enrich the existing DEVICE_MODELS catalog with hardware metadata that
// Device Models pages care about: OS, orientation, primary/secondary screens.
const OS_TONE = { ANDROID: 'success', LINUX: 'info', RTOS: 'warning' };
const OS_OPTIONS = ['ANDROID', 'LINUX', 'RTOS'];
const ORIENTATION_OPTIONS = ['Landscape', 'Portrait'];

const SEED_MODEL_META = {
  'm-n950': { os: 'ANDROID', orientation: 'Portrait',  primary: { size: '5.5"',  resolution: '720 × 1280' },  secondary: null },
  'm-s30':  { os: 'LINUX',   orientation: 'Portrait',  primary: { size: '2.8"',  resolution: '320 × 240' },   secondary: null },
  'm-s60':  { os: 'ANDROID', orientation: 'Landscape', primary: { size: '8.0"',  resolution: '1280 × 800' },  secondary: { size: '4.3"', resolution: '800 × 480' } },
  'm-s90':  { os: 'ANDROID', orientation: 'Portrait',  primary: { size: '5.5"',  resolution: '720 × 1440' },  secondary: null },
  'm-n750': { os: 'ANDROID', orientation: 'Portrait',  primary: { size: '4.0"',  resolution: '480 × 800' },   secondary: null },
  'm-x800': { os: 'RTOS',    orientation: 'Landscape', primary: { size: '10.1"', resolution: '1920 × 1200' }, secondary: null },
};

// Each "image" is a simulated upload: stores the dataURL of a 140×140 PNG.
// In a real build the backend resizes into 4 stops; here we use the same dataURL
// for all sizes (and draw it scaled down). For seed data, image is null — show
// a tinted placeholder bearing the model code.
const SEED_DEVICE_MODELS = ((typeof DEVICE_MODELS !== 'undefined' ? DEVICE_MODELS : window.DEVICE_MODELS) || []).map((m) => ({
  id: m.id,
  name: m.name,
  family: m.family,
  desc: m.desc,
  unitPrice: m.unitPrice,
  types: m.types,
  image: null,
  ...(SEED_MODEL_META[m.id] || { os: 'ANDROID', orientation: 'Portrait', primary: { size: '5.5"', resolution: '720 × 1280' }, secondary: null }),
}));

// ─── Tile (renders 140×140, scaled down by CSS to whatever size you ask for)
const ModelTile = ({ model, px }) => {
  const fontSize = Math.max(8, Math.round(px * 0.22));
  if (model.image) {
    return (
      <span className="dm-tile" style={{ width: px, height: px }}>
        <img src={model.image} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
      </span>
    );
  }
  // Placeholder: tinted, with model name centered.
  let h = 0;
  for (const c of model.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return (
    <span className="dm-tile dm-tile--placeholder" style={{ width: px, height: px, background: `oklch(96% 0.03 ${hue})`, color: `oklch(38% 0.08 ${hue})`, fontSize }}>
      {model.name}
    </span>
  );
};

// ─── List page ──────────────────────────────────────────────
const DeviceModelList = ({ models, onNew, onEdit, onDelete }) => {
  const [q, setQ] = useState('');
  const [os, setOs] = useState('All');
  const toast = useToast();

  const filtered = useMemo(() => {
    let rows = models;
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((m) =>
        m.name.toLowerCase().includes(s) ||
        m.family.toLowerCase().includes(s) ||
        m.desc.toLowerCase().includes(s)
      );
    }
    if (os !== 'All') rows = rows.filter((m) => m.os === os);
    return rows;
  }, [models, q, os]);

  const stats = useMemo(() => ({
    total: models.length,
    android: models.filter((m) => m.os === 'ANDROID').length,
    linux: models.filter((m) => m.os === 'LINUX').length,
    rtos: models.filter((m) => m.os === 'RTOS').length,
  }), [models]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Device models</h1>
          <p className="page__sub">The product catalog used by sample orders. Each model defines OS, screen layout and the artwork that appears in the admin, customer portal and packing slips.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" icon="download" size="md">Export</Btn>
          <Btn variant="primary" icon="plus" size="md" onClick={onNew}>New model</Btn>
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <button type="button" className={`stat is-clickable ${os === 'All' ? 'is-active' : ''}`} onClick={() => setOs('All')}>
          <div className="stat__label">All models</div>
          <div className="stat__val">{stats.total}</div>
          <div className="stat__delta">in catalog</div>
          <div className="stat__action">Show all <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className={`stat is-clickable ${os === 'ANDROID' ? 'is-active' : ''}`} onClick={() => setOs('ANDROID')}>
          <div className="stat__label">Android</div>
          <div className="stat__val" style={{ color: 'var(--color-success-700)' }}>{stats.android}</div>
          <div className="stat__delta">smart terminals</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className={`stat is-clickable ${os === 'LINUX' ? 'is-active' : ''}`} onClick={() => setOs('LINUX')}>
          <div className="stat__label">Linux</div>
          <div className="stat__val" style={{ color: 'var(--color-info-700)' }}>{stats.linux}</div>
          <div className="stat__delta">embedded terminals</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
        <button type="button" className={`stat is-clickable ${os === 'RTOS' ? 'is-active' : ''}`} onClick={() => setOs('RTOS')}>
          <div className="stat__label">RTOS</div>
          <div className="stat__val" style={{ color: 'var(--color-warning-700)' }}>{stats.rtos}</div>
          <div className="stat__delta">unattended / kiosk</div>
          <div className="stat__action">Filter <Icon name="chevR" size={9}/></div>
        </button>
      </div>

      <div className="list-toolbar">
        <Input prefix={<Icon name="search" size={14}/>} placeholder="Search by model, family or description…" value={q} onChange={(e) => setQ(e.target.value)} size="md"/>
        <div className="list-toolbar__filters">
          <div className="tds-select tds-select--md" style={{ width: 160 }}>
            <select value={os} onChange={(e) => setOs(e.target.value)}>
              <option>All</option>
              {OS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
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
            <col/>
            <col/>
            <col style={{ width: '40px' }}/>
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Model</th>
              <th>OS</th>
              <th>Orientation</th>
              <th>Screens</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="6"><div className="empty">No device models match your filters.</div></td></tr>
            ) : filtered.map((m) => (
              <tr key={m.id} onClick={() => onEdit(m.id)}>
                <td style={{ paddingTop: 10, paddingBottom: 10 }}>
                  <ModelTile model={m} px={48}/>
                </td>
                <td>
                  <div className="cust-name">{m.name}</div>
                  <div className="cust-meta">{m.family} · {m.desc}</div>
                </td>
                <td><Badge tone={OS_TONE[m.os] || 'neutral'} dot>{m.os}</Badge></td>
                <td>
                  <span className="dm-orient">
                    <Icon name="monitor" size={13} style={{ transform: m.orientation === 'Portrait' ? 'rotate(90deg)' : 'none' }}/>
                    {m.orientation}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{m.primary.size}</span> · {m.primary.resolution}
                  </div>
                  {m.secondary ? (
                    <div className="cust-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="cpu" size={10}/>
                      <span>2nd · {m.secondary.size} · {m.secondary.resolution}</span>
                    </div>
                  ) : (
                    <div className="cust-meta">Single screen</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onDelete(m); }} title="Delete">
                    <Icon name="trash" size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Image upload + interactive crop ───────────────────────
// Contract:
//   1. Uploaded image MUST have a white background — we sample the corners and
//      reject anything else (transparency, photo, colored backdrop, etc.).
//   2. After acceptance the user adjusts zoom + position inside a square frame.
//   3. On confirm we render the final 140 × 140 master; the 4 stops (140 / 70
//      / 55 / 35) are derived from it for use across the admin & portal.

const FRAME = 280;   // on-screen cropping frame, 2× the 140 master for sharpness
const MASTER = 140;  // final master size

const validateWhiteBackground = (img) => {
  // Sample 8 outer-edge points; accept white OR transparent. Reject anything else.
  const w = img.width, h = img.height;
  const pts = [
    [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
    [Math.floor(w / 2), 2], [Math.floor(w / 2), h - 3],
    [2, Math.floor(h / 2)], [w - 3, Math.floor(h / 2)],
  ];
  const raw = document.createElement('canvas');
  raw.width = w; raw.height = h;
  const rctx = raw.getContext('2d');
  rctx.clearRect(0, 0, w, h);
  rctx.drawImage(img, 0, 0);
  let bad = 0;
  for (const [x, y] of pts) {
    const d = rctx.getImageData(x, y, 1, 1).data;
    const isTransparent = d[3] < 16;
    const isWhite = d[3] > 240 && d[0] > 240 && d[1] > 240 && d[2] > 240;
    if (!isTransparent && !isWhite) bad++;
  }
  if (bad > 0) {
    return { ok: false, reason: 'Background must be solid white or transparent. Detected a colored background — please re-export the image with a white or transparent backdrop.' };
  }
  return { ok: true };
};

const renderCrop = (img, zoom, offset) => {
  const s = Math.min(FRAME / img.width, FRAME / img.height);
  const dispW = img.width * s * zoom;
  const dispH = img.height * s * zoom;
  const cx = (FRAME - dispW) / 2 + offset.x;
  const cy = (FRAME - dispH) / 2 + offset.y;
  const srcX = -cx / (s * zoom);
  const srcY = -cy / (s * zoom);
  const srcW = FRAME / (s * zoom);
  const srcH = FRAME / (s * zoom);
  const out = document.createElement('canvas');
  out.width = MASTER; out.height = MASTER;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Leave canvas transparent — uploads with a white background will paint white
  // pixels themselves; uploads with a transparent background stay transparent.
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, MASTER, MASTER);
  return out.toDataURL('image/png');
};

const ImageUploader = ({ value, onChange, modelName }) => {
  // 'drop' | 'adjust' | 'done'
  const [stage, setStage] = useState(value ? 'done' : 'drop');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rawSrc, setRawSrc] = useState(null);
  const [imgEl, setImgEl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const fileRef = useRef(null);

  const handleFiles = (files) => {
    setError(null);
    const f = files && files[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      setError('Only PNG, JPEG, or WebP images are accepted.');
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      const img = new Image();
      img.onload = () => {
        const check = validateWhiteBackground(img);
        if (!check.ok) {
          setBusy(false);
          setError(check.reason);
          return;
        }
        setRawSrc(url);
        setImgEl(img);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setStage('adjust');
        setBusy(false);
      };
      img.onerror = () => { setBusy(false); setError('Could not decode image.'); };
      img.src = url;
    };
    reader.readAsDataURL(f);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Compute display style for the image inside the frame.
  const imgStyle = () => {
    if (!imgEl) return {};
    const s = Math.min(FRAME / imgEl.width, FRAME / imgEl.height);
    const w = imgEl.width * s;
    const h = imgEl.height * s;
    return {
      width: w + 'px',
      height: h + 'px',
      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
    };
  };

  const onMouseDown = (e) => {
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  };
  useEffect(() => {
    if (stage !== 'adjust') return;
    const onMove = (e) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const onUp = () => { dragStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [stage]);

  const confirm = () => {
    if (!imgEl) return;
    const dataUrl = renderCrop(imgEl, zoom, offset);
    onChange(dataUrl);
    setStage('done');
  };

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const restart = () => {
    setStage('drop');
    setRawSrc(null);
    setImgEl(null);
    setError(null);
    onChange(null);
  };

  // Preview tile renderer
  const tile = (px) => {
    if (value) {
      return (
        <span className="dm-tile" style={{ width: px, height: px }}>
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        </span>
      );
    }
    return <ModelTile model={{ name: modelName || '—', image: null }} px={px}/>;
  };

  return (
    <div className="dm-upl">
      {stage === 'drop' && (
        <div
          className={`dm-drop ${dragOver ? 'is-over' : ''} ${error ? 'is-err' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current && fileRef.current.click()}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)}/>
          <div className="dm-drop__empty">
            <div className="dm-drop__icon"><Icon name="upload" size={22}/></div>
            <div className="dm-drop__title">{busy ? 'Processing…' : 'Drop an image here, or click to browse'}</div>
            <div className="dm-drop__sub">PNG / WebP / JPEG · Background must be solid white or transparent</div>
          </div>
        </div>
      )}

      {stage === 'adjust' && imgEl && (
        <div className="dm-adjust">
          <div className="dm-adjust__head">
            <div>
              <div className="dm-adjust__title">Adjust the crop</div>
              <div className="dm-adjust__sub">Drag to reposition · use the slider (or scroll wheel) to zoom · the area inside the frame is what gets saved.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={reset}>Reset</Btn>
              <Btn size="sm" variant="ghost" icon="x" onClick={restart}>Cancel</Btn>
            </div>
          </div>

          <div className="dm-adjust__body">
            <div
              className="dm-frame"
              onMouseDown={onMouseDown}
              onWheel={(e) => {
                e.preventDefault();
                const next = Math.max(1, Math.min(3, zoom - e.deltaY * 0.002));
                setZoom(next);
              }}>
              <img src={rawSrc} alt="" draggable={false} className="dm-frame__img" style={imgStyle()}/>
              <div className="dm-frame__overlay"/>
              <div className="dm-frame__grid"/>
            </div>

            <div className="dm-adjust__controls">
              <label className="dm-zoom">
                <span className="dm-zoom__lbl">Zoom</span>
                <input
                  type="range" min="1" max="3" step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}/>
                <span className="dm-zoom__val">{zoom.toFixed(2)}×</span>
              </label>

              <div className="dm-livepreview">
                <div className="dm-livepreview__lbl">Live preview</div>
                <div className="dm-livepreview__tiles">
                  {[70, 55, 35].map((px) => (
                    <span key={px} className="dm-tile" style={{ width: px, height: px, background: '#fff' }}>
                      <img
                        src={rawSrc}
                        alt=""
                        draggable={false}
                        style={{
                          ...imgStyle(),
                          width: (imgEl.width * Math.min(FRAME / imgEl.width, FRAME / imgEl.height)) * (px / FRAME) + 'px',
                          height: (imgEl.height * Math.min(FRAME / imgEl.width, FRAME / imgEl.height)) * (px / FRAME) + 'px',
                          transform: `translate(calc(-50% + ${offset.x * (px / FRAME)}px), calc(-50% + ${offset.y * (px / FRAME)}px)) scale(${zoom})`,
                          position: 'absolute',
                          left: '50%', top: '50%',
                        }}/>
                    </span>
                  ))}
                </div>
                <div className="dm-livepreview__sub">70 · 55 · 35 px</div>
              </div>
            </div>
          </div>

          <div className="dm-adjust__foot">
            <div className="dm-notice">
              <Icon name="check" size={14}/>
              <span>Valid background detected. The system will crop to 140 × 140 and derive the other sizes from there.</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" size="md" onClick={restart}>Re-upload</Btn>
              <Btn variant="primary" size="md" icon="check" onClick={confirm}>Confirm crop</Btn>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && value && (
        <div className="dm-drop">
          <div className="dm-drop__has">
            <span className="dm-tile dm-tile--check" style={{ width: 140, height: 140, background: '#fff' }}>
              <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            </span>
            <div className="dm-drop__has-main">
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Image saved</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 3 }}>Cropped to 140 × 140 · 4 sizes derived below</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Btn size="sm" variant="secondary" icon="edit" onClick={() => {
                  // Re-enter adjust stage with the already-cropped master as the source
                  const img = new Image();
                  img.onload = () => {
                    setRawSrc(value);
                    setImgEl(img);
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                    setStage('adjust');
                  };
                  img.src = value;
                }}>Re-crop</Btn>
                <Btn size="sm" variant="ghost" icon="upload" onClick={restart}>Replace</Btn>
                <Btn size="sm" variant="ghost" icon="trash" onClick={() => { onChange(null); setStage('drop'); }}>Remove</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="dm-err">
          <Icon name="info" size={14}/>
          <span>{error}</span>
        </div>
      )}

      <div className="dm-rules">
        <div className="dm-rules__title">Upload rules</div>
        <ul>
          <li>Background must be <strong>solid white or transparent</strong> — any other color is rejected.</li>
          <li>After upload, <strong>adjust zoom &amp; position</strong> inside the square frame; the visible area is what gets saved.</li>
          <li>Confirmed crop is rendered at <strong>140 × 140</strong>, then the system derives 70 / 55 / 35 px for use across the admin and customer surfaces.</li>
        </ul>
      </div>

      <div className="dm-rules__title" style={{ marginTop: 16 }}>Saved sizes</div>
      <div className="dm-sizes">
        {[140, 70, 55, 35].map((px) => (
          <div key={px} className="dm-size">
            <div className="dm-size__tile">{tile(px)}</div>
            <div className="dm-size__lbl">{px} × {px}</div>
            <div className="dm-size__use">
              {px === 140 ? 'Detail page hero' :
               px === 70  ? 'Order line items' :
               px === 55  ? 'List rows · packing slip' :
                            'Inline chips · receipts'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Form (create / edit) ──────────────────────────────────
const blankModel = () => ({
  id: `m-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  family: '',
  desc: '',
  unitPrice: 0,
  types: ['Stand-alone'],
  os: 'ANDROID',
  orientation: 'Portrait',
  primary: { size: '5.5"', resolution: '720 × 1280' },
  secondary: null,
  image: null,
});

const DeviceModelForm = ({ initial, onCancel, onSave }) => {
  const [m, setM] = useState(initial || blankModel());
  const [hasSecondary, setHasSecondary] = useState(!!(initial && initial.secondary));
  const toast = useToast();

  useEffect(() => {
    if (hasSecondary && !m.secondary) {
      setM((x) => ({ ...x, secondary: { size: '4.3"', resolution: '800 × 480' } }));
    } else if (!hasSecondary && m.secondary) {
      setM((x) => ({ ...x, secondary: null }));
    }
  }, [hasSecondary]);

  const update = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const updatePrimary = (k, v) => setM((x) => ({ ...x, primary: { ...x.primary, [k]: v } }));
  const updateSecondary = (k, v) => setM((x) => ({ ...x, secondary: { ...(x.secondary || {}), [k]: v } }));

  const canSave = m.name.trim() && m.family.trim() && m.primary.size && m.primary.resolution &&
    (!hasSecondary || (m.secondary && m.secondary.size && m.secondary.resolution));

  const submit = () => {
    if (!canSave) {
      toast({ kind: 'error', title: 'Please complete required fields.' });
      return;
    }
    onSave({ ...m, secondary: hasSecondary ? m.secondary : null });
    toast({ kind: 'success', title: initial ? `${m.name} updated` : `${m.name} created`, msg: 'Device model catalog saved.' });
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">{initial ? `Edit · ${initial.name}` : 'New device model'}</h1>
          <p className="page__sub">Maintain the hardware specs and artwork shown anywhere this model appears.</p>
        </div>
        <div className="page__actions">
          <Btn variant="secondary" size="md" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" size="md" icon="check" onClick={submit} disabled={!canSave}>{initial ? 'Save changes' : 'Create model'}</Btn>
        </div>
      </div>

      <div className="wizard-grid">
        <div className="stack" style={{ gap: 16 }}>
          {/* Identity */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Identity</div></div>
            <div className="info-card__body">
              <div className="form-grid form-grid--2">
                <Field label="Model name" required>
                  <Input value={m.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. N950"/>
                </Field>
                <Field label="Family" required hint="Category that groups similar models in the catalog. e.g. Smart POS, Mobile, Kiosk.">
                  <Input
                    value={m.family}
                    onChange={(e) => update('family', e.target.value)}
                    placeholder="e.g. Smart POS"
                    list="dm-families"/>
                  <datalist id="dm-families">
                    {Array.from(new Set((window.SEED_DEVICE_MODELS || []).map((x) => x.family))).map((f) => (
                      <option key={f} value={f}/>
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Description" hint="One-line summary shown on order rows and the customer portal.">
                <Textarea value={m.desc} onChange={(e) => update('desc', e.target.value)} rows={2} placeholder="Smart Android terminal, 5.5″ touch, NFC + magstripe."/>
              </Field>
            </div>
          </div>

          {/* OS + orientation */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Operating system &amp; orientation</div></div>
            <div className="info-card__body">
              <Field label="OS" required>
                <div className="dm-seg">
                  {OS_OPTIONS.map((o) => (
                    <button key={o} type="button" className={`dm-seg__btn ${m.os === o ? 'is-on' : ''}`} onClick={() => update('os', o)}>
                      {o}
                      {o === 'ANDROID' && <span className="dm-seg__hint">default</span>}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Orientation" required>
                <div className="dm-orientpick">
                  {ORIENTATION_OPTIONS.map((opt) => {
                    const on = m.orientation === opt;
                    return (
                      <button key={opt} type="button" className={`dm-orientpick__btn ${on ? 'is-on' : ''}`} onClick={() => update('orientation', opt)}>
                        <span className={`dm-orientpick__glyph dm-orientpick__glyph--${opt.toLowerCase()}`}/>
                        <span className="dm-orientpick__lbl">{opt}</span>
                        <span className="dm-orientpick__sub">{opt === 'Landscape' ? 'Wider than tall' : 'Taller than wide'}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>

          {/* Screens */}
          <div className="info-card">
            <div className="info-card__head">
              <div>
                <div className="info-card__title">Screens</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 3 }}>Primary screen is required. Toggle the secondary screen if this model has a dual-display layout.</div>
              </div>
            </div>
            <div className="info-card__body">
              <div className="dm-screen">
                <div className="dm-screen__head">
                  <span className="dm-screen__tag">Primary</span>
                  <span className="dm-screen__hint">Customer-facing or operator-facing main display.</span>
                </div>
                <div className="form-grid form-grid--2">
                  <Field label="Size" required>
                    <Input value={m.primary.size} onChange={(e) => updatePrimary('size', e.target.value)} placeholder='e.g. 5.5"' suffix={<span style={{ fontSize: 11 }}>inch</span>}/>
                  </Field>
                  <Field label="Resolution" required>
                    <Input value={m.primary.resolution} onChange={(e) => updatePrimary('resolution', e.target.value)} placeholder="720 × 1280" suffix={<span style={{ fontSize: 11 }}>px</span>}/>
                  </Field>
                </div>
              </div>

              <div className="dm-toggle-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Has secondary screen</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>For dual-screen models — e.g. cashier sees one side, customer sees the other.</div>
                </div>
                <button type="button" className={`up-toggle ${hasSecondary ? 'is-on' : ''}`} onClick={() => setHasSecondary((v) => !v)}>
                  <span className="up-toggle__dot"/>
                </button>
              </div>

              {hasSecondary && m.secondary && (
                <div className="dm-screen dm-screen--alt">
                  <div className="dm-screen__head">
                    <span className="dm-screen__tag dm-screen__tag--alt">Secondary</span>
                    <span className="dm-screen__hint">Smaller customer-facing display, usually behind the printer.</span>
                  </div>
                  <div className="form-grid form-grid--2">
                    <Field label="Size" required>
                      <Input value={m.secondary.size} onChange={(e) => updateSecondary('size', e.target.value)} placeholder='e.g. 4.3"' suffix={<span style={{ fontSize: 11 }}>inch</span>}/>
                    </Field>
                    <Field label="Resolution" required>
                      <Input value={m.secondary.resolution} onChange={(e) => updateSecondary('resolution', e.target.value)} placeholder="800 × 480" suffix={<span style={{ fontSize: 11 }}>px</span>}/>
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image */}
          <div className="info-card">
            <div className="info-card__head"><div className="info-card__title">Model artwork</div></div>
            <div className="info-card__body">
              <ImageUploader value={m.image} onChange={(v) => update('image', v)} modelName={m.name}/>
            </div>
          </div>
        </div>

        {/* Sidebar preview */}
        <aside className="wizard-aside">
          <h4>Preview</h4>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
            <ModelTile model={m} px={120}/>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{m.name || 'Model name'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{m.family || 'Family'}</div>
          </div>
          <dl>
            <dt>OS</dt><dd><Badge tone={OS_TONE[m.os] || 'neutral'} dot>{m.os}</Badge></dd>
            <dt>Orientation</dt><dd>{m.orientation}</dd>
            <dt>Primary</dt><dd>{m.primary.size} · {m.primary.resolution}</dd>
            <dt>Secondary</dt><dd>{hasSecondary && m.secondary ? `${m.secondary.size} · ${m.secondary.resolution}` : <span className="muted">None</span>}</dd>
            <dt>Artwork</dt><dd>{m.image ? <span style={{ color: 'var(--color-success-700)' }}>Uploaded ✓</span> : <span className="muted">Placeholder</span>}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────
const dmStyles = `
.dm-tile { display: grid; place-items: center; border-radius: 10px; overflow: hidden; flex: none; font-weight: 700; letter-spacing: -0.02em; font-family: var(--font-family-sans); background-image:
  linear-gradient(45deg, oklch(94% 0 0 / 0.6) 25%, transparent 25%),
  linear-gradient(-45deg, oklch(94% 0 0 / 0.6) 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, oklch(94% 0 0 / 0.6) 75%),
  linear-gradient(-45deg, transparent 75%, oklch(94% 0 0 / 0.6) 75%);
  background-size: 12px 12px; background-position: 0 0, 0 6px, 6px -6px, -6px 0px; border: 1px solid var(--color-border-subtle); }
.dm-tile--placeholder { background-image: none; }
.dm-tile--check { border: 1px solid var(--color-border-default); }

.dm-orient { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-primary); }

.dm-upl { display: flex; flex-direction: column; gap: 14px; }

.dm-drop { border: 1.5px dashed var(--color-border-default); border-radius: 12px; padding: 18px; background: var(--color-bg-3); cursor: pointer; transition: all var(--duration-fast); }
.dm-drop:hover { border-color: var(--color-border-strong); background: var(--color-bg-2); }
.dm-drop.is-over { border-color: var(--color-primary-700); background: var(--color-primary-50); }
.dm-drop.is-err { border-color: var(--color-error-500); }
.dm-drop__empty { display: flex; flex-direction: column; align-items: center; padding: 26px 12px; text-align: center; gap: 6px; }
.dm-drop__icon { width: 44px; height: 44px; border-radius: 12px; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); display: grid; place-items: center; color: var(--color-text-secondary); margin-bottom: 6px; }
.dm-drop__title { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); }
.dm-drop__sub { font-size: 12px; color: var(--color-text-tertiary); }
.dm-drop__has { display: flex; gap: 16px; align-items: center; }
.dm-drop__has-main { flex: 1; min-width: 0; }

.dm-err { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; background: var(--color-error-50); border: 1px solid oklch(70% 0.16 25 / 0.3); border-radius: 8px; font-size: 12.5px; color: var(--color-error-700); }
.dm-err svg { flex: none; margin-top: 2px; }
.dm-notice { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; background: var(--color-success-50); border: 1px solid oklch(58% 0.14 152 / 0.25); border-radius: 8px; font-size: 12.5px; color: var(--color-success-700); }
.dm-notice svg { flex: none; margin-top: 2px; }

.dm-rules { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 8px; padding: 12px 14px; }
.dm-rules__title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-tertiary); margin-bottom: 8px; }
.dm-rules ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.6; }
.dm-rules strong { color: var(--color-text-primary); font-weight: 600; }

.dm-sizes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 8px; }
.dm-size { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 14px 12px; text-align: center; }
.dm-size__tile { display: flex; justify-content: center; align-items: center; height: 150px; }
.dm-size__lbl { font: 600 12px var(--font-family-mono); color: var(--color-text-primary); margin-top: 6px; font-variant-numeric: tabular-nums; }
.dm-size__use { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }

.dm-seg { display: inline-flex; padding: 3px; background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 8px; gap: 0; }
.dm-seg__btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: transparent; border: 0; cursor: pointer; transition: all var(--duration-fast); display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
.dm-seg__btn.is-on { background: var(--color-bg-2); color: var(--color-text-primary); box-shadow: var(--shadow-1); }
.dm-seg__hint { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-700); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }

.dm-orientpick { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dm-orientpick__btn { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; cursor: pointer; text-align: left; font-family: inherit; transition: all var(--duration-fast); align-items: flex-start; }
.dm-orientpick__btn:hover { border-color: var(--color-border-strong); }
.dm-orientpick__btn.is-on { border-color: var(--color-primary-700); background: var(--color-primary-50); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.08); }
.dm-orientpick__glyph { display: block; background: var(--color-bg-3); border: 2px solid var(--color-border-strong); border-radius: 4px; margin-bottom: 6px; }
.dm-orientpick__glyph--landscape { width: 36px; height: 24px; }
.dm-orientpick__glyph--portrait { width: 24px; height: 36px; }
.dm-orientpick__btn.is-on .dm-orientpick__glyph { background: var(--color-bg-2); border-color: var(--color-primary-700); }
.dm-orientpick__lbl { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); }
.dm-orientpick__sub { font-size: 11.5px; color: var(--color-text-tertiary); }

.dm-screen { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 14px 16px 8px; margin-bottom: 14px; }
.dm-screen--alt { background: var(--color-info-50); border-color: oklch(60% 0.14 230 / 0.22); }
.dm-screen__head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.dm-screen__tag { font: 600 10.5px/1 var(--font-family-sans); padding: 4px 8px; border-radius: 999px; background: var(--color-bg-2); color: var(--color-text-primary); border: 1px solid var(--color-border-default); letter-spacing: 0.06em; text-transform: uppercase; }
.dm-screen__tag--alt { background: oklch(60% 0.14 230 / 0.18); color: var(--color-info-700); border-color: oklch(60% 0.14 230 / 0.3); }
.dm-screen__hint { font-size: 11.5px; color: var(--color-text-tertiary); }

.dm-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; margin: 4px 0 14px; }

.dm-checks { display: flex; gap: 8px; flex-wrap: wrap; }
.dm-check { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: var(--color-bg-3); border: 1px solid var(--color-border-default); font-size: 12.5px; color: var(--color-text-secondary); cursor: pointer; transition: all var(--duration-fast); }
.dm-check:hover { border-color: var(--color-border-strong); color: var(--color-text-primary); }
.dm-check.is-on { background: var(--color-primary-50); color: var(--color-primary-700); border-color: oklch(60% 0.14 262 / 0.3); font-weight: 500; }
.dm-check input { display: none; }

/* Cropper */
.dm-adjust { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; overflow: hidden; }
.dm-adjust__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--color-border-subtle); background: var(--color-bg-3); }
.dm-adjust__title { font-size: 14px; font-weight: 600; }
.dm-adjust__sub { font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px; line-height: 1.5; }
.dm-adjust__body { display: grid; grid-template-columns: 280px 1fr; gap: 22px; padding: 22px 18px; align-items: start; }
.dm-adjust__controls { display: flex; flex-direction: column; gap: 22px; padding-top: 8px; }
.dm-adjust__foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; background: var(--color-bg-3); border-top: 1px solid var(--color-border-subtle); }
.dm-adjust__foot .dm-notice { padding: 8px 10px; flex: 1; min-width: 0; }

.dm-frame { width: 280px; height: 280px; position: relative; background: #fff;
  background-image:
    linear-gradient(45deg, oklch(94% 0 0) 25%, transparent 25%),
    linear-gradient(-45deg, oklch(94% 0 0) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(94% 0 0) 75%),
    linear-gradient(-45deg, transparent 75%, oklch(94% 0 0) 75%);
  background-size: 14px 14px;
  background-position: 0 0, 0 7px, 7px -7px, -7px 0px;
  border-radius: 10px; overflow: hidden; cursor: grab; user-select: none; touch-action: none; box-shadow: inset 0 0 0 1px var(--color-border-default); }
.dm-frame:active { cursor: grabbing; }
.dm-frame__img { position: absolute; left: 50%; top: 50%; transform-origin: center; max-width: none; pointer-events: none; }
.dm-frame__overlay { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 0 2px var(--color-primary-700); border-radius: 10px; }
.dm-frame__grid { position: absolute; inset: 0; pointer-events: none; background:
  linear-gradient(to right, transparent calc(33.33% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(33.33% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px)) no-repeat,
  linear-gradient(to right, transparent calc(66.66% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(66.66% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)) no-repeat,
  linear-gradient(to bottom, transparent calc(33.33% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(33.33% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px)) no-repeat,
  linear-gradient(to bottom, transparent calc(66.66% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(66.66% - 0.5px), oklch(40% 0.14 262 / 0.25) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)) no-repeat; }

.dm-zoom { display: flex; align-items: center; gap: 12px; }
.dm-zoom__lbl { font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-tertiary); width: 50px; flex: none; }
.dm-zoom input { flex: 1; accent-color: var(--color-primary-700); height: 6px; }
.dm-zoom__val { font: 500 12.5px var(--font-family-mono); color: var(--color-text-primary); min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; }

.dm-livepreview { background: var(--color-bg-3); border: 1px solid var(--color-border-subtle); border-radius: 10px; padding: 12px 14px; }
.dm-livepreview__lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-tertiary); margin-bottom: 10px; }
.dm-livepreview__tiles { display: flex; gap: 14px; align-items: flex-end; }
.dm-livepreview__tiles .dm-tile { background-image: none; position: relative; overflow: hidden; flex: none; }
.dm-livepreview__sub { font: 500 11px var(--font-family-mono); color: var(--color-text-tertiary); margin-top: 10px; font-variant-numeric: tabular-nums; }

/* Keep the preview pane visible at all viewport heights:
   sticky + capped height + internal scroll. */
.wizard-aside { position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; }
`;

// Inject styles once.
if (typeof document !== 'undefined' && !document.getElementById('dm-styles')) {
  const s = document.createElement('style');
  s.id = 'dm-styles';
  s.textContent = dmStyles;
  document.head.appendChild(s);
}

Object.assign(window, {
  DeviceModelList, DeviceModelForm, SEED_DEVICE_MODELS, OS_OPTIONS, OS_TONE,
  ModelTile,
});
