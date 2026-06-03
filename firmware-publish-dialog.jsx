/* global React, Modal, Btn, Input, Field, Icon, Badge, CompanyLogo */
// ─────────────────────────────────────────────────────────────
// Firmware Publish Audience dialog (shared)
//
// Opens from:
//   • Versions tab row → "Publish" (status=draft|unpublished)
//   • Versions tab row → "Edit audience" (status=published)
//   • Version detail page → same two actions
//
// User picks one or more ISO customers from the platform-wide ISO list
// (multi-select with search + select-all). On confirm the parent merges
// the new isoIds into the version and appends a publishEvents entry.
//
// Pure presentational — owns its own form state, defers persistence to
// `onConfirm({ isoIds, note })`.
// ─────────────────────────────────────────────────────────────
const { useState: useStateFPD, useMemo: useMemoFPD, useEffect: useEffectFPD } = React;

const FirmwarePublishDialog = ({
  open,
  mode,             // 'publish' | 'edit'
  firmware,
  version,
  initialIsoIds,    // current audience (for edit) or [] (for publish)
  onClose,
  onConfirm,        // ({ isoIds, note }) => void
}) => {
  const allIsos = useMemoFPD(() =>
    (window.SEED_CUSTOMERS || [])
      .filter(c => (c.contracts || []).some(k => k.kind === 'ISO'))
      .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const [selected, setSelected] = useStateFPD(() => new Set(initialIsoIds || []));
  const [q, setQ] = useStateFPD('');
  const [note, setNote] = useStateFPD('');

  // Reset on open (so reopening with a different version starts fresh)
  useEffectFPD(() => {
    if (open) {
      setSelected(new Set(initialIsoIds || []));
      setQ('');
      setNote('');
    }
  }, [open, initialIsoIds]);

  if (!open) return null;

  const filtered = allIsos.filter(c =>
    !q.trim() || c.name.toLowerCase().includes(q.toLowerCase())
  );
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someFilteredSelected = filtered.some(c => selected.has(c.id));

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAllFiltered = () => {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach(c => next.delete(c.id));
    } else {
      filtered.forEach(c => next.add(c.id));
    }
    setSelected(next);
  };
  const clearAll = () => setSelected(new Set());

  const submit = () => {
    onConfirm({
      isoIds: [...selected],
      note: note.trim(),
    });
  };

  const isEdit = mode === 'edit';
  const initialCount = (initialIsoIds || []).length;
  const nowCount = selected.size;
  const added = [...selected].filter(id => !(initialIsoIds || []).includes(id)).length;
  const removed = (initialIsoIds || []).filter(id => !selected.has(id)).length;

  // In edit mode, allow saving with 0 ISOs — the parent treats it as an
  // unpublish. In publish mode (first-time release) we still require ≥1 ISO.
  const willUnpublish = isEdit && nowCount === 0;
  const canConfirm = willUnpublish
    ? initialCount > 0   // there was something to unpublish
    : (nowCount > 0 && (!isEdit || added > 0 || removed > 0 || note.trim().length > 0));

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{isEdit ? 'Update publish audience' : 'Publish version'}</span>
          <span className="fpd-vchip">
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{firmware?.modelCode} · {firmware?.deviceFlag}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, fontWeight: 600 }}>{version?.versionName}</span>
          </span>
        </div>
      }
      footer={
        <>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {isEdit ? (
              <>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{nowCount}</strong> selected
                {added > 0 && <span> · <span style={{ color: 'oklch(50% 0.16 152)' }}>+{added}</span></span>}
                {removed > 0 && <span> · <span style={{ color: 'oklch(50% 0.18 25)' }}>−{removed}</span></span>}
                {initialCount > 0 && <span className="muted"> (was {initialCount})</span>}
              </>
            ) : (
              <><strong style={{ color: 'var(--color-text-secondary)' }}>{nowCount}</strong> of {allIsos.length} ISO{allIsos.length === 1 ? '' : 's'} selected</>
            )}
          </div>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant={willUnpublish ? 'danger' : 'primary'}
               icon={willUnpublish ? 'x' : 'bolt'}
               disabled={!canConfirm} onClick={submit}>
            {willUnpublish
              ? 'Unpublish version'
              : isEdit
                ? (added + removed === 0
                  ? 'Save'
                  : `Update audience (${added > 0 ? `+${added}` : ''}${added > 0 && removed > 0 ? ' ' : ''}${removed > 0 ? `−${removed}` : ''})`)
                : 'Publish to ' + (nowCount === 0 ? 'ISOs' : `${nowCount} ISO${nowCount === 1 ? '' : 's'}`)}
          </Btn>
        </>
      }>
      <div className="stack" style={{ gap: 12 }}>
        <div className="fpd-help">
          <Icon name="info" size={13}/>
          <span>
            {isEdit
              ? 'This version is already published. Add or remove ISOs to change who can see it. Removing every ISO unpublishes the version. Terminals already running it are unaffected.'
              : 'Pick which ISO customers can see this version in their OTA management menu. Each ISO independently decides whether and when to roll it out to their merchant terminals.'}
          </span>
        </div>

        <div className="fpd-toolbar">
          <Input
            prefix={<Icon name="search" size={14}/>}
            placeholder="Search ISOs…"
            value={q}
            onChange={e => setQ(e.target.value)}
            size="md"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="fpd-link" onClick={toggleAllFiltered}>
              {allFilteredSelected ? 'Deselect' : 'Select'} {q.trim() ? `(${filtered.length})` : 'all'}
            </button>
            {selected.size > 0 && (
              <button type="button" className="fpd-link" onClick={clearAll}>Clear</button>
            )}
          </div>
        </div>

        <div className="fpd-list">
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: 22 }}>No ISOs match.</div>
          ) : filtered.map(c => {
            const on = selected.has(c.id);
            const wasOn = (initialIsoIds || []).includes(c.id);
            const diff = isEdit
              ? (on && !wasOn ? 'added' : !on && wasOn ? 'removed' : '')
              : '';
            return (
              <label key={c.id} className={`fpd-row ${on ? 'is-on' : ''} ${diff}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)}/>
                <CompanyLogo name={c.name} size={28}/>
                <div className="fpd-row__meta">
                  <div className="fpd-row__name">{c.name}</div>
                  <div className="fpd-row__sub">{c.country || '—'}</div>
                </div>
                {diff === 'added'   && <span className="fpd-tag fpd-tag--add">+ Added</span>}
                {diff === 'removed' && <span className="fpd-tag fpd-tag--rm">− Removing</span>}
                {diff === '' && wasOn && <span className="fpd-tag fpd-tag--keep">Current</span>}
              </label>
            );
          })}
        </div>

        <Field label="Internal note" hint="Optional. Shown in the activity timeline.">
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Q3 beta rollout to North America ISOs"
            size="md"
          />
        </Field>
      </div>

      <style>{`
        .fpd-vchip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 9px; border-radius: 999px;
          background: var(--color-bg-3); border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
        }
        .fpd-help {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; border-radius: 8px;
          background: oklch(96% 0.02 252 / 0.5);
          border: 1px solid oklch(58% 0.10 252 / 0.20);
          color: oklch(40% 0.14 252);
          font-size: 12.5px; line-height: 1.55;
        }
        [data-theme="dark"] .fpd-help {
          background: oklch(28% 0.04 252 / 0.4);
          color: oklch(78% 0.10 252);
        }
        .fpd-toolbar {
          display: flex; gap: 10px; align-items: center;
        }
        .fpd-toolbar > :first-child { flex: 1; }
        .fpd-link {
          border: 0; background: transparent; cursor: pointer;
          font-size: 12px; color: var(--color-text-secondary);
          padding: 6px 10px; border-radius: 6px;
          font-weight: 500;
        }
        .fpd-link:hover {
          background: var(--color-bg-3);
          color: var(--color-text-primary);
        }
        .fpd-list {
          max-height: 340px; overflow: auto;
          border: 1px solid var(--color-border-subtle);
          border-radius: 8px;
          background: var(--color-bg-1);
        }
        .fpd-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px;
          border-bottom: 1px solid var(--color-border-subtle);
          cursor: pointer;
          transition: background 0.1s;
        }
        .fpd-row:last-child { border-bottom: 0; }
        .fpd-row:hover { background: var(--color-bg-3); }
        .fpd-row.is-on { background: var(--color-primary-50, oklch(96% 0.02 262)); }
        .fpd-row input { accent-color: var(--color-primary-700); cursor: pointer; }
        .fpd-row__meta { flex: 1; min-width: 0; }
        .fpd-row__name { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); }
        .fpd-row__sub  { font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 1px; }

        .fpd-tag {
          font-size: 10.5px; font-weight: 600;
          padding: 2px 7px; border-radius: 999px;
          letter-spacing: 0.02em;
        }
        .fpd-tag--add  { background: oklch(94% 0.06 152); color: oklch(38% 0.14 152); }
        .fpd-tag--rm   { background: oklch(94% 0.06 25);  color: oklch(40% 0.18 25); }
        .fpd-tag--keep { background: var(--color-bg-3);    color: var(--color-text-tertiary); }
        [data-theme="dark"] .fpd-tag--add  { background: oklch(30% 0.10 152); color: oklch(85% 0.10 152); }
        [data-theme="dark"] .fpd-tag--rm   { background: oklch(30% 0.10 25);  color: oklch(85% 0.10 25); }

        .fpd-row.added   { background: oklch(96% 0.04 152 / 0.6); }
        .fpd-row.removed {
          background: oklch(96% 0.04 25 / 0.5);
          text-decoration: line-through;
          text-decoration-color: oklch(60% 0.12 25);
          text-decoration-thickness: 1px;
        }
        [data-theme="dark"] .fpd-row.added   { background: oklch(28% 0.08 152 / 0.4); }
        [data-theme="dark"] .fpd-row.removed { background: oklch(28% 0.08 25 / 0.4); }
      `}</style>
    </Modal>
  );
};

window.FirmwarePublishDialog = FirmwarePublishDialog;
