/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, DCPostIt */

// ─────────────────────────────────────────────────────────────
// ISO 合同条款 — 假设最多 10 条
// ─────────────────────────────────────────────────────────────
const CLAUSES = [
  { id: 'deviceBasicService', name: 'Device basic service',      type: 'price',   v: '8.50', cur: 'USD', unit: '/ device·mo', req: true,  help: 'Base monthly fee charged per active device' },
  { id: 'setupFee',           name: 'Setup / activation fee',    type: 'price',   v: '250.00', cur: 'USD', unit: 'one-time',    req: true,  help: 'Charged once when contract goes live' },
  { id: 'monthlyMin',         name: 'Monthly minimum',           type: 'price',   v: '1,500.00', cur: 'USD', unit: '/ month',     req: false, help: 'Minimum billed per month if usage is below' },
  { id: 'deviceModels',       name: 'Allowed device models',     type: 'tags',    v: ['m-001', 'm-005', 'm-012', 'm-014', 'm-021'], req: true, help: 'SKUs this ISO can resell' },
  { id: 'flyDesk',            name: 'FlyDesk',                   type: 'feature', on: true,  v: '1.20',  cur: 'USD', unit: '/ month',          req: false, help: 'Remote desktop access' },
  { id: 'geoLocation',        name: 'GeoLocation',               type: 'feature', on: true,  v: '0.30',  cur: 'USD', unit: '/ device·mo',      req: false, help: 'Real-time device tracking' },
  { id: 'geoFencing',         name: 'GeoFencing',                type: 'feature', on: false, v: '15.00', cur: 'USD', unit: '/ 1k devices·mo',  req: false, help: 'Zone-based alerts' },
  { id: 'preWarning',         name: 'Pre-warning alerts',        type: 'feature', on: true,  v: '0.80',  cur: 'USD', unit: '/ month',          req: false, help: 'Battery / storage / health' },
  { id: 'chargebackFee',      name: 'Chargeback fee',            type: 'price',   v: '25.00', cur: 'USD', unit: '/ case',       req: false, help: 'Charged per dispute opened' },
  { id: 'termPenalty',        name: 'Early termination fee',     type: 'price',   v: '',      cur: 'USD', unit: 'one-time',     req: false, help: 'Penalty if cancelled before term end' },
];
const TOTAL = CLAUSES.length;

// Tiny inline icon set
const Ico = ({ name, size = 14 }) => {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const p = {
    chevR: <path d="m9 6 6 6-6 6" {...s}/>,
    chevD: <path d="m6 9 6 6 6-6" {...s}/>,
    chevL: <path d="m15 6-6 6 6 6" {...s}/>,
    shield: <path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6z" {...s}/>,
    info:   <g {...s}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></g>,
    edit:   <g {...s}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></g>,
    check:  <path d="m5 12 4.5 4.5L19 7" {...s}/>,
    x:      <path d="m6 6 12 12M18 6 6 18" {...s}/>,
    plus:   <path d="M12 5v14M5 12h14" {...s}/>,
    eye:    <g {...s}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>,
    file:   <g {...s}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></g>,
    pos:    <g {...s}><rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M5 7h14M8 11h8M8 15h5"/></g>,
    truck:  <g {...s}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/></g>,
    save:   <path d="m5 12 4.5 4.5L19 7" {...s}/>,
    dot3:   <g {...s}><circle cx="6"  cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></g>,
    pen:    <g {...s}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>{p[name]}</svg>;
};

// ─────────────────────────────────────────────────────────────
// Display-mode row (view)
// ─────────────────────────────────────────────────────────────
// Value-only display fragment (no label). Reused by ViewRow and by
// the iprow in ModifyB so label isn't duplicated.
const ValueDisplay = ({ c }) => (
  c.type === 'feature' ? (
    c.on
      ? <><span className="chip chip--success"><span className="chip__dot"/>On</span><strong>${c.v}</strong> <span className="muted">{c.cur} {c.unit}</span></>
      : <span className="muted">Off</span>
  ) : c.type === 'tags' ? (
    <span className="tagrow">
      {c.v.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
      {c.v.length > 3 && <span className="tag tag--more">+{c.v.length - 3}</span>}
    </span>
  ) : c.v ? (
    <><strong>${c.v}</strong> <span className="muted">{c.cur} {c.unit}</span></>
  ) : (
    <span className="muted">Not set</span>
  )
);

const ViewRow = ({ c }) => (
  <div className="vrow">
    <div className="vrow__lbl">{c.name}{c.req && <span className="req">*</span>}</div>
    <div className="vrow__val"><ValueDisplay c={c}/></div>
  </div>
);

// Edit-mode row (compact)
const EditRow = ({ c, dense = false }) => (
  <div className={'erow' + (dense ? ' erow--dense' : '')}>
    <div className="erow__lbl">
      {c.name}{c.req && <span className="req">*</span>}
      {c.help && !dense && <div className="erow__help">{c.help}</div>}
    </div>
    <div className="erow__val">
      {c.type === 'feature' && (
        <>
          <span className={'tog' + (c.on ? ' is-on' : '')}/>
          <span className="ipt ipt--mono" style={{ width: 72, opacity: c.on ? 1 : 0.4 }}>{c.v}</span>
          <span className="sel" style={{ opacity: c.on ? 1 : 0.4 }}>{c.cur} <Ico name="chevD" size={10}/></span>
          <span className="muted" style={{ fontSize: 11.5 }}>{c.unit}</span>
        </>
      )}
      {c.type === 'price' && (
        <>
          <span className="ipt ipt--mono" style={{ width: 96 }}>{c.v || '0.00'}</span>
          <span className="sel">{c.cur} <Ico name="chevD" size={10}/></span>
          <span className="muted" style={{ fontSize: 11.5 }}>{c.unit}</span>
        </>
      )}
      {c.type === 'tags' && (
        <span className="tagrow">
          {c.v.map(t => <span key={t} className="tag tag--editable">{t}<Ico name="x" size={9}/></span>)}
          <span className="tag tag--add"><Ico name="plus" size={10}/>Add</span>
        </span>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// SCENE 1 — 修改场景 (Modify existing contract's clauses)
// ─────────────────────────────────────────────────────────────

// A1. Current pattern, polished — Modal 620, section-level edit toggle
const ModifyA = () => {
  const [editing, setEditing] = React.useState(false);
  return (
    <div className="scene scene--modal">
      <div className="bg-dim"/>
      <div className="modal" style={{ width: 620 }}>
        <div className="modal__head">
          <div className="row" style={{ gap: 10 }}>
            <div className="iconbox iso"><Ico name="shield" size={16}/></div>
            <div>
              <div className="modal__title">ISO Contract</div>
              <div className="modal__sub">Northwind Commerce · CT-ISO-1042</div>
            </div>
          </div>
          <button className="btn btn--ghost btn--icon"><Ico name="x"/></button>
        </div>
        <div className="modal__body" style={{ overflowY: 'auto' }}>
          <div className="section">
            <div className="section__head">
              <div className="section__title">Entitlements <span className="muted">· {TOTAL} clauses</span></div>
              {!editing
                ? <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Ico name="edit"/>Edit all</button>
                : <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="btn btn--primary btn--sm"><Ico name="check"/>Save</button>
                  </div>
              }
            </div>
            <div className="section__body">
              {CLAUSES.map(c => editing ? <EditRow key={c.id} c={c} dense/> : <ViewRow key={c.id} c={c}/>)}
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <span className="muted" style={{ fontSize: 11.5 }}>Last edited 2h ago by admin@carbon</span>
          {!editing && <button className="btn btn--secondary btn--sm">View history</button>}
        </div>
      </div>
    </div>
  );
};

// A2. Per-row hover-to-edit — no global toggle, click value to edit
const ModifyB = () => {
  const [editingId, setEditingId] = React.useState('monthlyMin');
  return (
    <div className="scene scene--modal">
      <div className="bg-dim"/>
      <div className="modal" style={{ width: 620 }}>
        <div className="modal__head">
          <div className="row" style={{ gap: 10 }}>
            <div className="iconbox iso"><Ico name="shield" size={16}/></div>
            <div>
              <div className="modal__title">ISO Contract</div>
              <div className="modal__sub">Northwind Commerce · CT-ISO-1042</div>
            </div>
          </div>
          <button className="btn btn--ghost btn--icon"><Ico name="x"/></button>
        </div>
        <div className="modal__body" style={{ overflowY: 'auto' }}>
          <div className="section">
            <div className="section__head">
              <div className="section__title">Entitlements <span className="muted">· {TOTAL} clauses</span></div>
              <span className="muted" style={{ fontSize: 11.5 }}>Click any value to edit</span>
            </div>
            <div className="section__body">
              {CLAUSES.map(c => (
                <div
                  key={c.id}
                  className={'iprow' + (editingId === c.id ? ' iprow--editing' : '')}
                  onClick={() => setEditingId(c.id)}
                >
                  <div className="iprow__lbl">{c.name}{c.req && <span className="req">*</span>}</div>
                  <div className="iprow__val">
                    {editingId === c.id ? (
                      <div className="row" style={{ gap: 6, width: '100%' }}>
                        {c.type === 'price' && <>
                          <span className="ipt ipt--mono" style={{ width: 96 }}>{c.v || '0.00'}</span>
                          <span className="sel">{c.cur} <Ico name="chevD" size={10}/></span>
                          <span className="muted" style={{ fontSize: 11.5 }}>{c.unit}</span>
                        </>}
                        {c.type === 'feature' && <>
                          <span className={'tog' + (c.on ? ' is-on' : '')}/>
                          <span className="ipt ipt--mono" style={{ width: 80 }}>{c.v}</span>
                          <span className="muted" style={{ fontSize: 11.5 }}>{c.unit}</span>
                        </>}
                        {c.type === 'tags' && <span className="tagrow">{c.v.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}<span className="tag tag--add"><Ico name="plus" size={10}/></span></span>}
                        <span style={{ marginLeft: 'auto' }} className="row">
                          <button className="btn btn--ghost btn--icon-sm" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><Ico name="x" size={12}/></button>
                          <button className="btn btn--primary btn--icon-sm"><Ico name="check" size={12}/></button>
                        </span>
                      </div>
                    ) : (
                      <>
                        <ValueDisplay c={c}/>
                        <Ico name="pen" size={11}/>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <span className="muted" style={{ fontSize: 11.5 }}><Ico name="info" size={11}/> Changes auto-save · audit trail recorded per field</span>
        </div>
      </div>
    </div>
  );
};

// A3. Right side drawer (480px) — doesn't block contract list behind
const ModifyC = () => (
  <div className="scene">
    {/* fake contract list behind */}
    <div className="behind">
      <div className="behind__h">
        <div className="behind__crumb">Customers · Northwind Commerce · Contracts</div>
      </div>
      <div className="crow-fake crow-fake--active">
        <div className="iconbox iso"><Ico name="shield" size={14}/></div>
        <div className="grow">
          <div className="crow-fake__t">ISO Contract <span className="chip chip--success" style={{ marginLeft: 6 }}><span className="chip__dot"/>Active</span></div>
          <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15 → 2027-01-14</div>
        </div>
      </div>
      <div className="crow-fake">
        <div className="iconbox isv"><Ico name="file" size={14}/></div>
        <div className="grow">
          <div className="crow-fake__t">ISV Contract</div>
          <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15</div>
        </div>
      </div>
      <div className="crow-fake">
        <div className="iconbox distributor"><Ico name="truck" size={14}/></div>
        <div className="grow">
          <div className="crow-fake__t">Distributor</div>
          <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15</div>
        </div>
      </div>
    </div>
    {/* drawer */}
    <div className="drawer">
      <div className="modal__head">
        <div className="row" style={{ gap: 10 }}>
          <div className="iconbox iso"><Ico name="shield" size={16}/></div>
          <div>
            <div className="modal__title">ISO Contract</div>
            <div className="modal__sub">CT-ISO-1042 · Edit clauses</div>
          </div>
        </div>
        <button className="btn btn--ghost btn--icon"><Ico name="x"/></button>
      </div>
      <div className="modal__body" style={{ overflowY: 'auto' }}>
        <div className="section">
          <div className="section__head">
            <div className="section__title">Entitlements</div>
            <span className="muted" style={{ fontSize: 11.5 }}>{TOTAL} clauses</span>
          </div>
          <div className="section__body">
            {CLAUSES.map(c => <EditRow key={c.id} c={c}/>)}
          </div>
        </div>
      </div>
      <div className="modal__foot">
        <button className="btn btn--ghost btn--sm">Discard</button>
        <button className="btn btn--primary btn--sm"><Ico name="save"/>Save changes</button>
      </div>
    </div>
  </div>
);

// A4. Inline row expansion — no modal at all
const ModifyD = () => (
  <div className="scene">
    <div className="behind behind--full">
      <div className="behind__h">
        <div className="behind__crumb">Customers · Northwind Commerce · Contracts</div>
      </div>

      {/* expanded row */}
      <div className="crow-fake crow-fake--expanded">
        <div className="row" style={{ width: '100%' }}>
          <div className="iconbox iso"><Ico name="shield" size={14}/></div>
          <div className="grow">
            <div className="crow-fake__t">ISO Contract <span className="chip chip--success" style={{ marginLeft: 6 }}><span className="chip__dot"/>Active</span></div>
            <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15 → 2027-01-14</div>
          </div>
          <button className="btn btn--ghost btn--sm"><Ico name="chevD"/>Collapse</button>
        </div>
        <div className="crow-fake__panel">
          <div className="section section--flush">
            <div className="section__head" style={{ paddingLeft: 0 }}>
              <div className="section__title" style={{ fontSize: 11.5 }}>Entitlements <span className="muted">· {TOTAL} clauses</span></div>
              <button className="btn btn--ghost btn--sm"><Ico name="edit"/>Edit</button>
            </div>
            <div className="section__body" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {CLAUSES.map(c => <ViewRow key={c.id} c={c}/>)}
            </div>
          </div>
        </div>
      </div>

      {/* collapsed sibling rows */}
      <div className="crow-fake">
        <div className="iconbox isv"><Ico name="file" size={14}/></div>
        <div className="grow">
          <div className="crow-fake__t">ISV Contract</div>
          <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15</div>
        </div>
        <Ico name="chevR" size={12}/>
      </div>
      <div className="crow-fake">
        <div className="iconbox distributor"><Ico name="truck" size={14}/></div>
        <div className="grow">
          <div className="crow-fake__t">Distributor</div>
          <div className="crow-fake__s">Authorized by NPT · Effective 2026-01-15</div>
        </div>
        <Ico name="chevR" size={12}/>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// SCENE 2 — 新增场景 (Wizard step 2, picker + clauses)
// ─────────────────────────────────────────────────────────────

// B1. Picker stays, clauses inline-expand under selected card
const WizardA = () => {
  const types = [
    { kind: 'ISV',  iconClass: 'isv',  icon: 'file',  title: 'ISV',  desc: 'Integrate Carbon APIs', on: false },
    { kind: 'ISO',  iconClass: 'iso',  icon: 'shield', title: 'ISO', desc: 'Onboard sub-merchants', on: true },
    { kind: 'Distributor', iconClass: 'distributor', icon: 'truck', title: 'Distributor', desc: 'Authorized partner', on: false },
  ];
  return (
    <div className="scene scene--wizard">
      <div className="wizard">
        <div className="wizard__stepper">
          <div className="step is-done"><div className="step__dot"><Ico name="check" size={11}/></div><div><small>Step 1</small><strong>Company</strong></div></div>
          <div className="step__bar is-done"/>
          <div className="step is-active"><div className="step__dot">2</div><div><small>Step 2</small><strong>Contracts</strong></div></div>
          <div className="step__bar"/>
          <div className="step"><div className="step__dot">3</div><div><small>Done</small><strong>Confirmation</strong></div></div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Assign contracts</div>
              <div className="card__sub">Pick types and configure clauses. Effective immediately.</div>
            </div>
          </div>
          <div className="card__body">
            {types.map(t => (
              <React.Fragment key={t.kind}>
                <div className={'pickrow' + (t.on ? ' pickrow--on' : '')}>
                  <div className={`iconbox ${t.iconClass}`}><Ico name={t.icon} size={16}/></div>
                  <div className="grow">
                    <div className="pickrow__t">{t.title}</div>
                    <div className="pickrow__s">{t.desc}</div>
                  </div>
                  <span className={'tog' + (t.on ? ' is-on' : '')}/>
                </div>
                {t.on && t.kind === 'ISO' && (
                  <div className="pickrow__panel">
                    <div className="section__head" style={{ paddingLeft: 0, paddingTop: 0 }}>
                      <div className="section__title" style={{ fontSize: 11.5 }}>ISO clauses <span className="muted">· {TOTAL} fields</span></div>
                      <span className="muted" style={{ fontSize: 11 }}>Fields marked <span className="req">*</span> are required</span>
                    </div>
                    {CLAUSES.map(c => <EditRow key={c.id} c={c} dense/>)}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="wizard__foot">
          <button className="btn btn--ghost btn--sm"><Ico name="chevL"/>Back</button>
          <button className="btn btn--primary btn--sm">Continue<Ico name="chevR"/></button>
        </div>
      </div>
    </div>
  );
};

// B2. Two-column: left picker (rail), right clauses for selected contract
const WizardB = () => {
  return (
    <div className="scene scene--wizard">
      <div className="wizard">
        <div className="wizard__stepper">
          <div className="step is-done"><div className="step__dot"><Ico name="check" size={11}/></div><div><small>Step 1</small><strong>Company</strong></div></div>
          <div className="step__bar is-done"/>
          <div className="step is-active"><div className="step__dot">2</div><div><small>Step 2</small><strong>Contracts</strong></div></div>
          <div className="step__bar"/>
          <div className="step"><div className="step__dot">3</div><div><small>Done</small><strong>Confirmation</strong></div></div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Assign contracts</div>
              <div className="card__sub">Toggle a type on the left, configure clauses on the right.</div>
            </div>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div className="splitbody">
              <aside className="splitbody__nav">
                <div className="navrow navrow--on">
                  <div className="iconbox iso"><Ico name="shield" size={13}/></div>
                  <div className="grow">
                    <div className="navrow__t">ISO</div>
                    <div className="navrow__s">10/10 fields</div>
                  </div>
                  <span className="tog is-on"/>
                </div>
                <div className="navrow">
                  <div className="iconbox isv"><Ico name="file" size={13}/></div>
                  <div className="grow">
                    <div className="navrow__t">ISV</div>
                    <div className="navrow__s muted">Off</div>
                  </div>
                  <span className="tog"/>
                </div>
                <div className="navrow">
                  <div className="iconbox distributor"><Ico name="truck" size={13}/></div>
                  <div className="grow">
                    <div className="navrow__t">Distributor</div>
                    <div className="navrow__s muted">Off</div>
                  </div>
                  <span className="tog"/>
                </div>
                <div style={{ marginTop: 10, padding: 10, background: 'var(--color-bg-3)', borderRadius: 8, fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <Ico name="info" size={11}/> Each picked contract gets its own clause form on the right.
                </div>
              </aside>
              <div className="splitbody__main">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="iconbox iso"><Ico name="shield" size={13}/></div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>ISO clauses</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{TOTAL} fields · 2 required</div>
                    </div>
                  </div>
                  <button className="btn btn--ghost btn--sm">Use defaults</button>
                </div>
                {CLAUSES.map(c => <EditRow key={c.id} c={c} dense/>)}
              </div>
            </div>
          </div>
        </div>

        <div className="wizard__foot">
          <button className="btn btn--ghost btn--sm"><Ico name="chevL"/>Back</button>
          <button className="btn btn--primary btn--sm">Continue<Ico name="chevR"/></button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────
const SummaryCard = () => (
  <div className="summary">
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>契约条款 UE · ≤10 条款 / 合同</div>
    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.55 }}>
      条款数量小,不需要 Tab/分组/锚点导航。重点是在<strong>真实的容器</strong>里把 ~10 个字段填得舒服。下面分两个场景:<strong>① 修改场景</strong>(已有合同)和 <strong>② 新增场景</strong>(向导第二步)。每个方案标注了真实尺寸(Modal 620px / Drawer 480px / Wizard 760px),供参考。
    </div>
    <div className="summary__grid">
      <div className="summary__col">
        <h5>A1 · Modal + 整段切换</h5>
        <p>现行 ContractDetailView 微调。点 <em>Edit all</em> 后整段变可编辑。最小改动。</p>
        <ul className="pros"><li>实现成本最低</li><li>视图/编辑界限清晰</li></ul>
        <ul className="cons"><li>改一条要进编辑态</li></ul>
      </div>
      <div className="summary__col">
        <h5>A2 · Modal + 点行就改</h5>
        <p>无全局编辑态,鼠标 hover 任意行有铅笔图标,点击该行直接变输入框。</p>
        <ul className="pros"><li>改单条最快</li><li>每条独立审计</li></ul>
        <ul className="cons"><li>需要 auto-save / 单条提交</li></ul>
      </div>
      <div className="summary__col">
        <h5>A3 · 右侧抽屉(480px)</h5>
        <p>从右滑出,左边合同列表保留可见。同时切换不同合同来改。</p>
        <ul className="pros"><li>不打断上下文</li><li>对比/批量场景友好</li></ul>
        <ul className="cons"><li>窄一些</li></ul>
      </div>
      <div className="summary__col">
        <h5>A4 · 行内展开</h5>
        <p>合同行点击展开,字段就在原位显示。完全不用 Modal。</p>
        <ul className="pros"><li>最轻量,无遮挡</li><li>展开/折叠即可对比</li></ul>
        <ul className="cons"><li>展开后页面变长</li></ul>
      </div>
    </div>
    <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--color-success-50)', color: 'var(--color-success-700)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, border: '1px solid oklch(58% 0.14 152 / 0.2)' }}>
      <strong>建议:</strong>修改场景用 <strong>A1(Modal + 整段切换)</strong> 是最稳妥的延续。如果运营场景需要频繁改单条,升级到 <strong>A2</strong>。新增场景用 <strong>B1(Picker 内联展开)</strong> ,一屏看完不分新 step。
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Inline shared styles (scoped via .scene)
// ─────────────────────────────────────────────────────────────
const CSS = `
.summary { padding: 18px 22px; background: var(--color-bg-2); border-radius: 12px; box-shadow: 0 10px 28px oklch(0% 0 0 / 0.04), 0 0 0 1px var(--color-border-default); height: 100%; box-sizing: border-box; }
.summary__grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; font-size: 12px; line-height: 1.5; }
.summary__col { padding: 10px 12px; background: var(--color-bg-1); border-radius: 8px; border: 1px solid var(--color-border-subtle); }
.summary__col h5 { font: 600 11px var(--font-family-mono); margin: 0 0 4px; color: var(--color-text-primary); text-transform: uppercase; letter-spacing: 0.04em; }
.summary__col p { margin: 0 0 6px; color: var(--color-text-secondary); }
.summary__col ul { margin: 0; padding: 0; list-style: none; }
.summary__col li { padding: 1px 0 1px 14px; position: relative; font-size: 11.5px; color: var(--color-text-secondary); }
.pros li::before { content: '+'; position: absolute; left: 3px; color: var(--color-success-700); font-weight: 600; }
.cons li::before { content: '−'; position: absolute; left: 3px; color: var(--color-warning-700); font-weight: 600; }

/* scene shells */
.scene { width: 100%; height: 100%; position: relative; background: var(--color-bg-1); border-radius: 12px; overflow: hidden; }
.scene--modal { background: oklch(50% 0 0 / 0.04); display: grid; place-items: center; padding: 24px; }
.bg-dim { position: absolute; inset: 0; background: oklch(0% 0 0 / 0.32); }
.scene--wizard { background: var(--color-bg-1); padding: 18px 24px; box-shadow: inset 0 0 0 1px var(--color-border-default); }

/* fake list behind */
.behind { position: absolute; inset: 0; padding: 18px 22px; background: var(--color-bg-1); }
.behind--full { background: var(--color-bg-1); }
.behind__h { margin-bottom: 12px; }
.behind__crumb { font-size: 12px; color: var(--color-text-tertiary); }
.crow-fake { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; margin-bottom: 8px; }
.crow-fake--active { border-color: var(--color-primary-700); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.08); }
.crow-fake--expanded { flex-direction: column; align-items: stretch; gap: 0; padding-bottom: 6px; }
.crow-fake__t { font-size: 13.5px; font-weight: 500; display: flex; align-items: center; }
.crow-fake__s { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.crow-fake__panel { border-top: 1px solid var(--color-border-subtle); margin-top: 10px; padding: 10px 6px 0; }

/* modal */
.modal { position: relative; background: var(--color-bg-2); border-radius: 12px; box-shadow: 0 30px 80px oklch(0% 0 0 / 0.18); display: flex; flex-direction: column; max-height: calc(100% - 20px); }
.modal__head { padding: 16px 18px; border-bottom: 1px solid var(--color-border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.modal__title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.modal__sub { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.modal__body { flex: 1; min-height: 0; overflow: hidden; }
.modal__foot { padding: 11px 18px; border-top: 1px solid var(--color-border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--color-bg-1); }

/* drawer */
.drawer { position: absolute; top: 0; right: 0; bottom: 0; width: 480px; background: var(--color-bg-2); box-shadow: -16px 0 48px oklch(0% 0 0 / 0.12); display: flex; flex-direction: column; border-left: 1px solid var(--color-border-default); }

/* section in modal/drawer */
.section { padding: 0; }
.section--flush { padding: 0; }
.section__head { padding: 14px 18px 8px; display: flex; align-items: center; justify-content: space-between; }
.section__title { font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.section__body { padding: 0 18px 14px; }

/* rows */
.iconbox { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; flex: none; }
.iconbox.iso { background: oklch(96% 0.03 230); color: var(--color-info-700); }
.iconbox.isv { background: oklch(93% 0.05 265); color: var(--color-accent-700); }
.iconbox.distributor { background: oklch(96.5% 0.04 80); color: var(--color-warning-700); }

.vrow { display: grid; grid-template-columns: 200px 1fr; gap: 14px; padding: 8px 0; border-bottom: 1px dashed var(--color-border-subtle); align-items: center; font-size: 13px; }
.vrow:last-child { border-bottom: none; }
.vrow__lbl { color: var(--color-text-tertiary); font-size: 12.5px; }
.vrow__val { display: flex; align-items: center; gap: 6px; min-width: 0; }
.vrow__val strong { font-weight: 600; font-variant-numeric: tabular-nums; }

.erow { display: grid; grid-template-columns: 200px 1fr; gap: 14px; padding: 10px 0; border-bottom: 1px dashed var(--color-border-subtle); align-items: center; }
.erow--dense { padding: 6px 0; }
.erow:last-child { border-bottom: none; }
.erow__lbl { font-size: 12.5px; color: var(--color-text-primary); }
.erow__help { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }
.erow__val { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }

.iprow { display: grid; grid-template-columns: 200px 1fr; gap: 14px; padding: 8px 6px; align-items: center; font-size: 13px; border-radius: 6px; cursor: pointer; margin: 0 -6px; border-bottom: 1px dashed var(--color-border-subtle); }
.iprow:hover { background: var(--color-bg-hover); }
.iprow--editing { background: var(--color-primary-50); border-radius: 6px; border-bottom-color: transparent; box-shadow: 0 0 0 1px var(--color-primary-500); }
.iprow__lbl { color: var(--color-text-tertiary); font-size: 12.5px; padding-left: 6px; }
.iprow__val { display: flex; align-items: center; gap: 6px; min-width: 0; padding-right: 6px; }
.iprow__val > svg { color: var(--color-text-tertiary); opacity: 0; }
.iprow:hover .iprow__val > svg { opacity: 1; }

.req { color: var(--color-error-700); margin-left: 2px; }
.muted { color: var(--color-text-tertiary); }

/* small inputs */
.ipt { display: inline-flex; align-items: center; padding: 4px 8px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 5px; font-size: 12.5px; }
.ipt--mono { font-family: var(--font-family-mono); font-size: 12px; }
.sel { display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 5px; font: 500 11.5px var(--font-family-mono); color: var(--color-text-secondary); }

.tog { width: 28px; height: 16px; border-radius: 999px; background: var(--color-border-strong); position: relative; flex: none; cursor: pointer; }
.tog::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px oklch(0% 0 0 / 0.2); transition: left 0.15s; }
.tog.is-on { background: var(--color-success-500); }
.tog.is-on::after { left: 14px; }

.tagrow { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; background: var(--color-bg-3); color: var(--color-text-secondary); border-radius: 4px; font-size: 11.5px; }
.tag--more { background: transparent; border: 1px dashed var(--color-border-strong); color: var(--color-text-tertiary); }
.tag--editable { background: var(--color-bg-3); padding-right: 4px; }
.tag--editable svg { color: var(--color-text-tertiary); cursor: pointer; }
.tag--add { background: transparent; border: 1px dashed var(--color-border-default); color: var(--color-text-tertiary); cursor: pointer; }

/* chip */
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 999px; font: 500 10.5px var(--font-family-sans); }
.chip--success { background: var(--color-success-50); color: var(--color-success-700); }
.chip__dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

/* buttons */
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; font: 500 12.5px var(--font-family-sans); border: 1px solid transparent; cursor: pointer; background: transparent; color: var(--color-text-secondary); }
.btn--ghost:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }
.btn--secondary { border-color: var(--color-border-default); background: var(--color-bg-2); color: var(--color-text-primary); }
.btn--primary { background: var(--color-primary-700); color: #fff; }
.btn--primary:hover { background: var(--color-primary-700); }
.btn--sm { padding: 4px 9px; font-size: 12px; }
.btn--icon { padding: 4px; width: 26px; height: 26px; justify-content: center; }
.btn--icon-sm { padding: 3px; width: 22px; height: 22px; justify-content: center; }

.row { display: inline-flex; align-items: center; gap: 6px; }
.grow { flex: 1; min-width: 0; }

/* wizard */
.wizard { display: flex; flex-direction: column; height: 100%; }
.wizard__stepper { display: flex; align-items: center; padding: 12px 16px; background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 10px; margin-bottom: 14px; gap: 12px; }
.step { display: flex; align-items: center; gap: 8px; }
.step__dot { width: 24px; height: 24px; border-radius: 50%; background: var(--color-bg-3); color: var(--color-text-tertiary); display: grid; place-items: center; font: 600 11.5px var(--font-family-sans); }
.step.is-active .step__dot { background: var(--color-primary-700); color: #fff; }
.step.is-done .step__dot { background: var(--color-success-50); color: var(--color-success-700); }
.step small { display: block; font: 500 9.5px var(--font-family-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-tertiary); }
.step strong { display: block; font: 500 12px var(--font-family-sans); color: var(--color-text-secondary); }
.step.is-active strong { color: var(--color-text-primary); font-weight: 600; }
.step__bar { flex: 1; height: 1px; background: var(--color-border-default); }
.step__bar.is-done { background: var(--color-success-500); opacity: 0.5; }

.card { background: var(--color-bg-2); border: 1px solid var(--color-border-default); border-radius: 12px; box-shadow: 0 1px 0 oklch(0% 0 0 / 0.02); flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.card__head { padding: 14px 18px; border-bottom: 1px solid var(--color-border-subtle); }
.card__title { font-size: 14px; font-weight: 600; }
.card__sub { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.card__body { padding: 14px 18px; overflow-y: auto; }

.wizard__foot { display: flex; justify-content: space-between; margin-top: 14px; }

.pickrow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-border-default); border-radius: 10px; background: var(--color-bg-1); margin-bottom: 8px; }
.pickrow--on { border-color: var(--color-primary-700); background: var(--color-primary-50); box-shadow: 0 0 0 3px oklch(40% 0.14 262 / 0.08); }
.pickrow__t { font-size: 13.5px; font-weight: 500; }
.pickrow__s { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.pickrow__panel { margin: -4px 0 12px; padding: 12px 14px 6px 14px; background: var(--color-bg-2); border: 1px solid var(--color-border-subtle); border-top: none; border-radius: 0 0 10px 10px; margin-top: -6px; position: relative; top: -4px; }

.splitbody { display: grid; grid-template-columns: 220px 1fr; min-height: 0; }
.splitbody__nav { padding: 14px; border-right: 1px solid var(--color-border-subtle); background: var(--color-bg-1); }
.splitbody__main { padding: 14px 18px; overflow-y: auto; }

.navrow { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.navrow:hover { background: var(--color-bg-hover); }
.navrow--on { background: var(--color-primary-50); border-color: oklch(60% 0.14 262 / 0.25); }
.navrow__t { font-size: 13px; font-weight: 500; }
.navrow__s { font-size: 11px; color: var(--color-text-secondary); margin-top: 1px; }
`;

// inject one-time
if (!document.getElementById('clauses-options-css')) {
  const el = document.createElement('style');
  el.id = 'clauses-options-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
const App = () => (
  <DesignCanvas>
    <DCSection id="summary" title="决策摘要" subtitle="≤10 条款 / 合同 · 关注真实容器尺寸里的 UE">
      <DCArtboard id="summary" label="对比" width={1100} height={360}>
        <SummaryCard/>
      </DCArtboard>
    </DCSection>

    <DCSection id="modify" title="场景 1 · 修改已有合同的条款" subtitle="ContractDetailView modal (620px) 是默认容器。下面是 4 种 UE 取舍。">
      <DCArtboard id="a1" label="A1 · Modal + 整段切换 (推荐)" width={780} height={640}>
        <ModifyA/>
      </DCArtboard>
      <DCArtboard id="a2" label="A2 · Modal + 点行就改" width={780} height={640}>
        <ModifyB/>
      </DCArtboard>
      <DCArtboard id="a3" label="A3 · 右侧抽屉 (480px)" width={900} height={640}>
        <ModifyC/>
      </DCArtboard>
      <DCArtboard id="a4" label="A4 · 行内展开 (无 Modal)" width={760} height={640}>
        <ModifyD/>
      </DCArtboard>
    </DCSection>

    <DCSection id="add" title="场景 2 · 新增合同时填条款" subtitle="客户向导第二步 · 760px 主区,picker + clause form 同步进行,不分新 step。">
      <DCArtboard id="b1" label="B1 · Picker 内联展开 (推荐)" width={780} height={640}>
        <WizardA/>
      </DCArtboard>
      <DCArtboard id="b2" label="B2 · 左 picker · 右 clauses" width={860} height={640}>
        <WizardB/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
