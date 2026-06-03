/* global React, Btn, Badge, Input, Icon, Modal,
            SysRolloutModal, SysStrategyCell, SysTargetVersionDropdown, SysPendingBadge */
// ─────────────────────────────────────────────────────────────
// System App — Rollouts tab (mandatory apps only).
//
// Per-ISO target version + release-strategy table. Mirrors the ISV view's
// "Subscribed Deployments" tab on the Customer Portal:
//
//   • Each row = one ISO target (an ISO-contract customer)
//   • Inline target-version dropdown (highlights when dirty)
//   • Strategy cell (Casual / Immediate / Custom) — click to edit
//   • Sticky bottom save bar opens the 2-step Rollout Modal:
//        Step 1 — Review batch
//        Step 2 — Pick strategy (preset cards + custom params)
//   • Assign ISO → stages a pending-add row
//   • Remove   → stages a pending-removal (row stays struck-through)
//
// Edits live in component-local draft state; nothing touches the store
// until the operator confirms via the rollout modal.
// ─────────────────────────────────────────────────────────────

const { useState: useStateRT, useMemo: useMemoRT } = React;

const SystemAppRolloutsTab = ({ app, onChange, toast }) => {
  // Force re-renders after committing the strategy store.
  const [, setTick] = useStateRT(0);
  const bump = () => setTick(n => n + 1);

  // Local draft buffer.
  // edits      pkgId → newTargetVersionId
  // removals   Set<isoId>
  // additions  [{ isoId, targetVersionId, assignedAt }]
  const [draft, setDraft] = useStateRT({ edits: {}, removals: new Set(), additions: [] });
  const [assignOpen, setAssignOpen] = useStateRT(false);
  const [rolloutCtx, setRolloutCtx] = useStateRT(null);
  const [unassignCtx, setUnassignCtx] = useStateRT(null);

  // Filter / search state — same UX as Subscribed Deployments.
  const [q, setQ] = useStateRT('');
  const [strategyFilter, setStrategyFilter] = useStateRT('any');

  const allIsos = window.getIsoTargets();
  const rollouts = window.getAppRollouts(app.id);

  // Available versions for this app = every published version + any
  // currently-pinned (incl. unpublished) version still referenced by a row.
  const versions = useMemoRT(() => {
    const pub = app.versions.filter(v => v.status === 'published');
    const referenced = new Set(Object.values(rollouts).map(r => r.targetVersionId));
    Object.values(draft.edits).forEach(v => referenced.add(v));
    const all = [...pub, ...app.versions.filter(v => referenced.has(v.id) && !pub.includes(v))];
    return all;
  }, [app.versions, rollouts, draft]);

  const latestId = versions[0]?.id;

  // Compose displayed rows: committed ISO rows (with edit/remove overlays) +
  // pending-add rows at the top.
  const rows = useMemoRT(() => {
    const committedRows = allIsos
      .filter(iso => rollouts[iso.id])
      .map(iso => {
        const rec = rollouts[iso.id];
        const editTarget = draft.edits[iso.id];
        const baseline = rec.targetVersionId;
        const kind = draft.removals.has(iso.id)
          ? 'pending-remove'
          : (editTarget && editTarget !== baseline ? 'pending-edit' : 'committed');
        return {
          kind, iso,
          currentVersionId: baseline,
          targetVersionId: editTarget || baseline,
          baselineVersionId: baseline,
          assignedAt: rec.assignedAt,
        };
      });

    const addRows = draft.additions.map(a => {
      const iso = allIsos.find(i => i.id === a.isoId);
      if (!iso) return null;
      return {
        kind: 'pending-add', iso,
        currentVersionId: a.targetVersionId,
        targetVersionId: a.targetVersionId,
        baselineVersionId: a.targetVersionId,
        assignedAt: a.assignedAt,
      };
    }).filter(Boolean);

    return [...addRows, ...committedRows];
  }, [allIsos, rollouts, draft]);

  const filtered = useMemoRT(() => rows.filter(r => {
    if (q && !r.iso.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (strategyFilter !== 'any') {
      const rec = window.getSysStrategy(app.id, r.iso.id, r.targetVersionId);
      const preset = rec ? window.resolveSysStrategyPreset(rec) : null;
      if (preset !== strategyFilter) return false;
    }
    return true;
  }), [rows, q, strategyFilter, app.id]);

  // Pending counts.
  const addCount    = draft.additions.length;
  const editCount   = Object.keys(draft.edits).length;
  const removeCount = draft.removals.size;
  const pendingCount = addCount + editCount + removeCount;

  // Available-ISOs list (for the Assign modal). Excludes already-assigned
  // + pending-add ISOs.
  const alreadyTakenIds = useMemoRT(() => {
    const s = new Set(Object.keys(rollouts));
    draft.additions.forEach(a => s.add(a.isoId));
    return s;
  }, [rollouts, draft]);

  // ── Mutators ──────────────────────────────────────────
  const editTarget = (isoId, versionId) => setDraft(d => ({ ...d, edits: { ...d.edits, [isoId]: versionId } }));
  const togglePendingRemove = (isoId) => setDraft(d => {
    const next = new Set(d.removals);
    if (next.has(isoId)) next.delete(isoId); else next.add(isoId);
    return { ...d, removals: next };
  });
  const cancelPendingAdd = (isoId) =>
    setDraft(d => ({ ...d, additions: d.additions.filter(a => a.isoId !== isoId) }));
  const discardAll = () => setDraft({ edits: {}, removals: new Set(), additions: [] });
  const addPendingAssign = ({ isoId, versionId }) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    setDraft(d => ({
      ...d,
      additions: [...d.additions, { isoId, targetVersionId: versionId, assignedAt: today }],
    }));
    setAssignOpen(false);
  };

  // Inline strategy edit — bypasses the batch flow. Writes straight to
  // the strategy store, just like the ISV view.
  const openInlineStrategyEdit = (row) => {
    const versionId = row.targetVersionId;
    const versionObj = app.versions.find(v => v.id === versionId) || { id: versionId, name: versionId };
    const current = window.getSysStrategy(app.id, row.iso.id, versionId) || null;
    setRolloutCtx({
      open: true,
      title: `Edit release strategy · ${app.name} → ${row.iso.name}`,
      confirmLabel: 'Save strategy',
      changes: [{
        kind: 'strategy-change',
        iso: row.iso, app,
        fromVersion: versionObj, toVersion: versionObj,
        currentStrategy: current,
      }],
      onCommit: (strategy) => {
        window.setSysStrategy(app.id, row.iso.id, versionId, strategy);
        setRolloutCtx(null);
        bump();
        toast?.({ kind: 'success',
          title: `Strategy updated · ${row.iso.name}`,
          msg: `${app.name} now rolls out as ${window.sysStrategyLabel(strategy.strategy)}.` });
      },
    });
  };

  // Save the entire draft — opens Rollout Modal in review mode.
  const openSaveModal = () => {
    const verOf = (vid) => app.versions.find(v => v.id === vid);
    const isoOf = (iid) => allIsos.find(i => i.id === iid);
    const changes = [
      ...draft.additions.map(a => ({
        kind: 'add', iso: isoOf(a.isoId), app,
        fromVersion: null, toVersion: verOf(a.targetVersionId),
        currentStrategy: window.getSysStrategy(app.id, a.isoId, a.targetVersionId) || null,
      })).filter(c => c.iso),
      ...Object.entries(draft.edits).map(([isoId, newVid]) => {
        const rec = rollouts[isoId];
        if (!rec || newVid === rec.targetVersionId) return null;
        return {
          kind: 'version-change', iso: isoOf(isoId), app,
          fromVersion: verOf(rec.targetVersionId), toVersion: verOf(newVid),
          currentStrategy: window.getSysStrategy(app.id, isoId, rec.targetVersionId) || null,
        };
      }).filter(c => c && c.iso),
      ...[...draft.removals].map(isoId => {
        const rec = rollouts[isoId];
        return {
          kind: 'remove', iso: isoOf(isoId), app,
          fromVersion: rec ? verOf(rec.targetVersionId) : null,
          toVersion: null,
          currentStrategy: rec
            ? (window.getSysStrategy(app.id, isoId, rec.targetVersionId) || null)
            : null,
        };
      }).filter(c => c.iso),
    ];
    setRolloutCtx({
      open: true,
      changes,
      title: `Save rollout · ${app.name}`,
      confirmLabel: `Apply & save (${pendingCount})`,
    });
  };

  // Apply the draft with one chosen strategy (per PRD — one strategy per
  // batch). Persists strategies for every non-remove change, drops them
  // for removals.
  const commitSave = (strategy) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    // Additions
    draft.additions.forEach(a => {
      window.setAppRollout(app.id, a.isoId, { targetVersionId: a.targetVersionId, assignedAt: today });
      window.setSysStrategy(app.id, a.isoId, a.targetVersionId, strategy);
    });
    // Edits
    Object.entries(draft.edits).forEach(([isoId, newVid]) => {
      const rec = rollouts[isoId];
      if (!rec || newVid === rec.targetVersionId) return;
      // Drop the old strategy entry for the prior version.
      window.deleteSysStrategy(app.id, isoId, rec.targetVersionId);
      window.setAppRollout(app.id, isoId, { targetVersionId: newVid, assignedAt: today });
      window.setSysStrategy(app.id, isoId, newVid, strategy);
    });
    // Removals
    [...draft.removals].forEach(isoId => {
      const rec = rollouts[isoId];
      if (rec) window.deleteSysStrategy(app.id, isoId, rec.targetVersionId);
      window.deleteAppRollout(app.id, isoId);
    });

    setDraft({ edits: {}, removals: new Set(), additions: [] });
    setRolloutCtx(null);
    onChange?.();
    bump();
    toast?.({ kind: 'success', title: `Rollout saved · ${app.name}`,
      msg: `${pendingCount} change${pendingCount === 1 ? '' : 's'} applied with ${window.sysStrategyLabel(strategy.strategy)} strategy.` });
  };

  return (
    <div style={{ paddingBottom: pendingCount > 0 ? 80 : 0 }}>
      {/* Tab heading + Assign button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>ISO rollouts</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--color-text-tertiary)', fontSize: 12, lineHeight: 1.5 }}>
            Each ISO gets a target version + release strategy for this mandatory app. Edits are staged in the table and applied on Save.
          </p>
        </div>
        <Btn variant={pendingCount === 0 ? 'primary' : 'secondary'} icon="plus"
          onClick={() => setAssignOpen(true)}>Assign ISO</Btn>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div style={{
          padding: '40px 24px', borderRadius: 10,
          background: 'var(--color-bg-2)', border: '1px dashed var(--color-border-default)',
          textAlign: 'center',
        }}>
          <Icon name="package" size={28} style={{ color: 'var(--color-text-tertiary)' }}/>
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 500 }}>No ISO rollouts yet</div>
          <p style={{ marginTop: 4, color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            Assign this mandatory app to an ISO to stage a rollout — pick a target version and a release strategy.
          </p>
          <div style={{ marginTop: 14, display: 'inline-flex' }}>
            <Btn variant="primary" icon="plus" onClick={() => setAssignOpen(true)}>Assign ISO</Btn>
          </div>
        </div>
      )}

      {/* Filter row */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ width: 240 }}>
            <Input size="sm" prefix={<Icon name="search" size={12}/>}
              placeholder="Search ISO…" value={q} onChange={(e) => setQ(e.target.value)}/>
          </div>
          <div className="tds-select tds-select--sm" style={{ width: 170 }}>
            <select value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}>
              <option value="any">All strategies</option>
              <option value="casual">Casual</option>
              <option value="immediate">Immediate</option>
              <option value="custom">Custom</option>
            </select>
            <span className="tds-select__chevron"><Icon name="chevD" size={12}/></span>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="table-card">
          <table className="tds-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>ISO</th>
                <th style={{ width: '17%' }}>Target version</th>
                <th style={{ width: '22%' }}>Release strategy</th>
                <th style={{ width: '11%', textAlign: 'right' }}>Terminals</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '60px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty">No ISOs match those filters.</div></td></tr>
              )}
              {filtered.map(r => (
                <RolloutRow key={`${r.kind}:${r.iso.id}`}
                  app={app} row={r}
                  versions={versions} latestId={latestId}
                  onEditTarget={(vid) => editTarget(r.iso.id, vid)}
                  onTogglePendingRemove={() => togglePendingRemove(r.iso.id)}
                  onCancelPendingAdd={() => cancelPendingAdd(r.iso.id)}
                  onEditStrategy={() => openInlineStrategyEdit(r)}
                  onUnassign={() => setUnassignCtx({ row: r })}/>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky save bar */}
      {pendingCount > 0 && (
        <div style={{
          position: 'fixed', left: 'calc(var(--side-w, 260px))', right: 0, bottom: 0,
          padding: '12px 28px',
          background: 'var(--color-bg-1)',
          borderTop: '1px solid var(--color-border-default)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'oklch(96% 0.05 80)', color: 'oklch(45% 0.13 80)',
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600,
            }}>{pendingCount}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Unsaved rollout changes</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
                {[
                  addCount    > 0 && `${addCount} addition${addCount === 1 ? '' : 's'}`,
                  editCount   > 0 && `${editCount} version change${editCount === 1 ? '' : 's'}`,
                  removeCount > 0 && `${removeCount} removal${removeCount === 1 ? '' : 's'}`,
                ].filter(Boolean).join(' · ')}
                {' — review and pick a strategy to apply.'}
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" onClick={discardAll}>Discard</Btn>
            <Btn size="sm" variant="primary" icon="check" onClick={openSaveModal}>
              Save changes ({pendingCount})
            </Btn>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignOpen && (
        <AssignIsoModal app={app} allIsos={allIsos}
          versions={versions} latestId={latestId}
          takenIds={alreadyTakenIds}
          onClose={() => setAssignOpen(false)}
          onAssign={addPendingAssign}/>
      )}

      {/* 2-step rollout modal */}
      {rolloutCtx?.open && (
        <SysRolloutModal
          open={rolloutCtx.open}
          changes={rolloutCtx.changes}
          title={rolloutCtx.title}
          confirmLabel={rolloutCtx.confirmLabel}
          initialStep={rolloutCtx.initialStep || 0}
          onClose={() => setRolloutCtx(null)}
          onConfirm={(strategy) => {
            if (rolloutCtx.onCommit) rolloutCtx.onCommit(strategy);
            else commitSave(strategy);
          }}/>
      )}

      {/* Unassign confirm */}
      {unassignCtx && (
        <Modal open onClose={() => setUnassignCtx(null)} width={460}
          title={`Unassign ${unassignCtx.row.iso.name}?`}
          footer={<>
            <Btn variant="ghost" onClick={() => setUnassignCtx(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => {
              const isoId = unassignCtx.row.iso.id;
              setUnassignCtx(null);
              togglePendingRemove(isoId);
            }}>Mark for removal</Btn>
          </>}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
            This stages a removal of <strong>{app.name}</strong>'s rollout to <strong>{unassignCtx.row.iso.name}</strong>. Already-installed copies on the ISO's terminals stay until the next OTA pass; no further pushes are sent. Confirm and Save to apply.
          </p>
        </Modal>
      )}
    </div>
  );
};

// ─── A single ISO rollout row ─────────────────────────────
const RolloutRow = ({ app, row, versions, latestId, onEditTarget, onTogglePendingRemove,
                      onCancelPendingAdd, onEditStrategy, onUnassign }) => {
  const isRemove = row.kind === 'pending-remove';
  const isAdd    = row.kind === 'pending-add';
  const isEdit   = row.kind === 'pending-edit';

  const gutter = isRemove ? 'oklch(58% 0.18 25)'
              : isAdd    ? 'oklch(58% 0.14 152)'
              : isEdit   ? 'var(--color-primary-500)'
              : 'transparent';
  const rowBg = isRemove ? 'oklch(98% 0.02 25)'
             : isAdd    ? 'oklch(98% 0.02 158)'
             : isEdit   ? 'oklch(98% 0.02 262)'
             : undefined;
  const strike = isRemove ? 'line-through' : 'none';

  const targetV = app.versions.find(v => v.id === row.targetVersionId);
  const baselineV = app.versions.find(v => v.id === row.baselineVersionId);
  const strategyRecord = !isRemove
    ? (window.getSysStrategy(app.id, row.iso.id, row.targetVersionId) || null)
    : null;

  // ISO initials avatar.
  const initials = row.iso.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <tr style={{ background: rowBg, borderLeft: `3px solid ${gutter}`, cursor: 'default' }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 7, flex: 'none',
            background: 'var(--color-primary-50)', color: 'var(--color-primary-700)',
            display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600,
            border: '1px solid oklch(60% 0.14 262 / 0.20)',
          }}>{initials}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, textDecoration: strike, letterSpacing: '-0.005em' }}>
              {row.iso.name}
              {row.iso.locked && <Badge tone="warning" style={{ marginLeft: 6 }}>Locked</Badge>}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>
              {row.iso.country || '—'} · {row.iso.merchants} merchants
            </div>
          </div>
        </div>
      </td>

      <td onClick={(e) => e.stopPropagation()}>
        {isRemove ? (
          <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, color: 'var(--color-text-tertiary)', textDecoration: strike }}>
            {targetV?.name || row.targetVersionId}
          </span>
        ) : (
          <SysTargetVersionDropdown
            value={row.targetVersionId}
            options={versions}
            latestId={latestId}
            isDirty={isEdit}
            disabled={isAdd}
            onChange={onEditTarget}/>
        )}
        {isEdit && baselineV && (
          <div style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            was <span style={{ fontFamily: 'var(--font-family-mono)' }}>{baselineV.name}</span>
          </div>
        )}
      </td>

      <td onClick={(e) => e.stopPropagation()}>
        {isRemove ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textDecoration: strike }}>—</span>
        ) : (
          <SysStrategyCell record={strategyRecord} disabled={isAdd}
            onClick={isAdd ? null : onEditStrategy}/>
        )}
      </td>

      <td style={{ textAlign: 'right' }}>
        <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12.5, fontWeight: 500, color: isRemove ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', textDecoration: strike }}>
          {row.iso.terminals.toLocaleString()}
        </span>
      </td>

      <td>
        {isAdd    && <SysPendingBadge tone="add">Pending add</SysPendingBadge>}
        {isEdit   && <SysPendingBadge tone="edit">Pending change</SysPendingBadge>}
        {isRemove && <SysPendingBadge tone="remove">Pending removal</SysPendingBadge>}
        {!isAdd && !isEdit && !isRemove && <Badge tone="success" dot>Synced</Badge>}
      </td>

      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
        {isAdd ? (
          <button onClick={onCancelPendingAdd} style={{
            background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer',
            fontSize: 12, color: 'var(--color-text-tertiary)',
          }}>Cancel</button>
        ) : isRemove ? (
          <button onClick={onTogglePendingRemove} style={{
            background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer',
            fontSize: 12, color: 'var(--color-primary-700)', fontWeight: 500,
          }}>Undo</button>
        ) : (
          <button onClick={onUnassign} style={{
            background: 'transparent', border: 0, padding: '4px 8px', cursor: 'pointer',
            fontSize: 12, color: 'oklch(50% 0.14 25)',
          }}>Remove</button>
        )}
      </td>
    </tr>
  );
};

// ─── Assign-ISO modal ──────────────────────────────────────
// Two-column picker: ISO on the left, target version on the right.
const AssignIsoModal = ({ app, allIsos, versions, latestId, takenIds, onClose, onAssign }) => {
  const eligible = allIsos.filter(i => !takenIds.has(i.id));
  const [isoId, setIsoId] = useStateRT(null);
  const [versionId, setVersionId] = useStateRT(latestId || null);

  return (
    <Modal open onClose={onClose} width={720} title="Assign ISO"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check"
          disabled={!isoId || !versionId}
          onClick={() => onAssign({ isoId, versionId })}>
          Stage assignment
        </Btn>
      </>}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
        Pick an ISO and the target version for this mandatory app. The release strategy is selected on the next step when you save the batch.
      </p>
      {eligible.length === 0 ? (
        <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12.5 }}>
          Every ISO is already assigned (or staged) for this app.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          {/* ISOs column */}
          <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="overline" style={{
              padding: '8px 12px', fontSize: 10,
              background: 'var(--color-bg-3)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>ISO ({eligible.length})</div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {eligible.map(iso => {
                const active = iso.id === isoId;
                const initials = iso.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <button key={iso.id} onClick={() => setIsoId(iso.id)} style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                    background: active ? 'var(--color-primary-50)' : 'transparent',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: active ? 'var(--color-primary-500)' : 'var(--color-bg-3)',
                      color: active ? '#fff' : 'var(--color-text-secondary)',
                      display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600,
                    }}>{initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{iso.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{iso.country || '—'} · {iso.terminals.toLocaleString()} terminals</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Versions column */}
          <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="overline" style={{
              padding: '8px 12px', fontSize: 10,
              background: 'var(--color-bg-3)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>Target version ({versions.length})</div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {versions.length === 0 && (
                <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  No published versions yet. Publish a version from the Versions tab first.
                </div>
              )}
              {versions.map(v => {
                const active = v.id === versionId;
                const isLatest = v.id === latestId;
                return (
                  <button key={v.id} onClick={() => setVersionId(v.id)} style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px',
                    background: active ? 'var(--color-primary-50)' : 'transparent',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    cursor: 'pointer',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="num" style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13, fontWeight: 500 }}>{v.name}</span>
                      {isLatest && <Badge tone="info">Latest</Badge>}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{v.published || v.uploaded}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

Object.assign(window, { SystemAppRolloutsTab });
