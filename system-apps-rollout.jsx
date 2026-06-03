/* global React, Btn, Modal, Icon, Badge */
// ─────────────────────────────────────────────────────────────
// System Apps — Rollout modal + strategy/target-version cells.
//
// Mirrors the ISV view's RolloutModal (2-step: Review → Pick strategy)
// and the helper cells used inside the per-ISO rollouts table. Visual
// language is 1:1 with the Customer Portal — same chip styling, same
// preset cards, same scheduled-windows editor.
// ─────────────────────────────────────────────────────────────

const { useState: useStateSRM, useMemo: useMemoSRM, useEffect: useEffectSRM } = React;

const SYS_STRAT_STEPS = [
  { id: "review",   label: "Review changes", hint: "Everything in this batch" },
  { id: "strategy", label: "Pick strategy",  hint: "Applies to all changes" },
];

// ─── 2-step Rollout modal ──────────────────────────────────
const SysRolloutModal = ({ open, changes, initialStrategy, onClose, onConfirm,
                          title = "Save rollout · Release strategy",
                          confirmLabel, initialStep = 0 }) => {
  const [step, setStep] = useStateSRM(initialStep);
  const [strategy, setStrategy] = useStateSRM(initialStrategy || {
    strategy: "casual", timing: "reboot", network: "any", cellCapMb: 100,
    slots: [{ start: "02:00", end: "04:00" }],
  });

  useEffectSRM(() => {
    if (open) {
      setStep(initialStep);
      const all = (changes || []).map(c => c.currentStrategy?.strategy).filter(Boolean);
      const consistent = all.length === (changes || []).length && all.every(s => s === all[0]);
      if (consistent && all[0]) {
        const rec = (changes || []).find(c => c.currentStrategy)?.currentStrategy;
        setStrategy({
          strategy:  rec.strategy  || "casual",
          timing:    rec.timing    || "reboot",
          network:   rec.network   || "any",
          cellCapMb: rec.cellCapMb || 100,
          slots: Array.isArray(rec.slots) && rec.slots.length ? rec.slots : [{ start: "02:00", end: "04:00" }],
        });
      } else {
        setStrategy(initialStrategy || { strategy: "casual", timing: "reboot", network: "any", cellCapMb: 100,
          slots: [{ start: "02:00", end: "04:00" }] });
      }
    }
  }, [open]);

  const setPreset = (id) => {
    const p = window.SYS_UPGRADE_STRATEGY_PRESETS.find(x => x.id === id);
    if (!p) return;
    if (id === "custom") setStrategy(s => ({ ...s, strategy: "custom" }));
    else setStrategy(s => ({ ...s, strategy: id, timing: p.timing, network: p.network }));
  };

  if (!open) return null;
  const count = (changes || []).length;
  const isReview = step === 0;
  const isStrategy = step === 1;
  const slotsErr = strategy.timing === "scheduled" ? sysValidateSlots(strategy.slots) : null;

  return (
    <Modal open={open} onClose={onClose} width={760} title={title}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <SrmStepper step={step} steps={SYS_STRAT_STEPS}/>
          <div style={{ flex: 1 }}/>
          {isStrategy && <Btn variant="ghost" onClick={() => setStep(0)}>← Back to changes</Btn>}
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {isReview && (
            <Btn variant="primary" iconRight="chevR" onClick={() => setStep(1)} disabled={count === 0}>
              Next · Pick strategy
            </Btn>
          )}
          {isStrategy && (
            <Btn variant="primary" icon="check"
              onClick={() => onConfirm && onConfirm(strategy)} disabled={!!slotsErr}>
              {confirmLabel || `Apply & save (${count})`}
            </Btn>
          )}
        </div>
      }>
      <div style={{ padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.55 }}>
          {count} change{count === 1 ? "" : "s"} — pick one strategy to apply across the batch. Persists per (app, ISO, version).
        </div>
        {isReview   && <SrmStepReview changes={changes || []}/>}
        {isStrategy && <SrmStepStrategy strategy={strategy} setStrategy={setStrategy} setPreset={setPreset} changes={changes || []}/>}
      </div>
    </Modal>
  );
};

const SrmStepper = ({ step, steps }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    {steps.map((s, i) => {
      const on = i === step;
      const done = i < step;
      return (
        <React.Fragment key={s.id}>
          {i > 0 && (
            <span style={{ width: 18, height: 1,
              background: done ? "var(--color-primary-500)" : "var(--color-border-default)" }}/>
          )}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 8px", borderRadius: 6,
            background: on ? "var(--color-primary-50)" : "transparent",
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: on ? "var(--color-primary-500)" : done ? "oklch(58% 0.14 152)" : "var(--color-bg-3)",
              color: on || done ? "#fff" : "var(--color-text-tertiary)",
              display: "grid", placeItems: "center",
              fontSize: 10, fontWeight: 600,
              border: "1px solid",
              borderColor: on ? "var(--color-primary-500)" : done ? "oklch(58% 0.14 152)" : "var(--color-border-default)",
            }}>{done ? "✓" : i + 1}</span>
            <span style={{ fontSize: 11.5, fontWeight: on ? 600 : 500,
              color: on ? "var(--color-primary-700)" : done ? "var(--color-text-secondary)" : "var(--color-text-tertiary)" }}>
              {s.label}
            </span>
          </span>
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Step 1: Review changes ────────────────────────────────
const SrmStepReview = ({ changes }) => {
  if (changes.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>Nothing to confirm.</div>;
  }

  const stats = useMemoSRM(() => {
    const byKind = { add: 0, "version-change": 0, "strategy-change": 0, remove: 0 };
    let withStrategy = 0;
    changes.forEach(c => {
      byKind[c.kind] = (byKind[c.kind] || 0) + 1;
      if (c.currentStrategy) withStrategy++;
    });
    return { byKind, withStrategy };
  }, [changes]);

  const KIND_LABEL = { add: "Add", "version-change": "Version change", "strategy-change": "Strategy change", remove: "Remove" };
  const kindChips = ["add", "version-change", "strategy-change", "remove"].filter(k => stats.byKind[k] > 0);

  const [q, setQ] = useStateSRM("");
  const [page, setPage] = useStateSRM(0);
  const PAGE_SIZE = 12;
  const filtered = useMemoSRM(() => changes.filter(c => {
    if (!q) return true;
    const n = q.toLowerCase();
    return (c.iso?.name || "").toLowerCase().includes(n)
        || (c.toVersion?.name || "").toLowerCase().includes(n);
  }), [changes, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "12px 14px",
        background: "var(--color-bg-2)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-family-mono)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            {changes.length.toLocaleString()}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            change{changes.length === 1 ? "" : "s"} in this batch
            {stats.withStrategy > 0 && (<> · {stats.withStrategy} already have a strategy (will be overwritten)</>)}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {kindChips.map(k => (
            <span key={k} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 500,
              background: "var(--color-bg-3)", color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-subtle)",
            }}>
              <span>{KIND_LABEL[k]}</span>
              <span style={{ fontFamily: "var(--font-family-mono)", opacity: 0.85 }}>{stats.byKind[k]}</span>
            </span>
          ))}
        </div>
      </div>

      {changes.length > 8 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Search ISO or version…"
              style={{
                width: "100%", padding: "7px 10px 7px 30px", fontSize: 12.5,
                borderRadius: 6, border: "1px solid var(--color-border-default)",
                background: "var(--color-bg-2)", color: "var(--color-text-primary)",
              }}/>
            <Icon name="search" size={12} style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "var(--color-text-tertiary)",
            }}/>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
            {filtered.length.toLocaleString()} of {changes.length.toLocaleString()}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
          No changes match the current filter.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 110 }}/>
            <col/>
            <col/>
            <col style={{ width: 160 }}/>
          </colgroup>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--color-bg-3)" }}>
              <th style={srmTh}>Type</th>
              <th style={srmTh}>ISO</th>
              <th style={srmTh}>Target version</th>
              <th style={srmTh}>Current strategy</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c, i) => (
              <tr key={safePage * PAGE_SIZE + i} style={{ borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none" }}>
                <td style={srmTd}><SrmKindPill kind={c.kind}/></td>
                <td style={srmTd}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 5,
                      background: "var(--color-primary-50)", color: "var(--color-primary-700)",
                      display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600, flexShrink: 0,
                    }}>{(c.iso?.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("")}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{c.iso?.name || "—"}</div>
                      <div style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}>{c.iso?.country || ""}</div>
                    </div>
                  </div>
                </td>
                <td style={srmTd}>
                  <div style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}>
                    {c.kind === "add" && (
                      <><span>—</span> → <span style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500, color: "var(--color-primary-700)" }}>{c.toVersion?.name || "?"}</span></>
                    )}
                    {c.kind === "version-change" && (
                      <><span style={{ fontFamily: "var(--font-family-mono)" }}>{c.fromVersion?.name || "?"}</span> → <span style={{ fontFamily: "var(--font-family-mono)", fontWeight: 500, color: "var(--color-primary-700)" }}>{c.toVersion?.name || "?"}</span></>
                    )}
                    {c.kind === "strategy-change" && (
                      <span style={{ fontFamily: "var(--font-family-mono)" }}>{c.toVersion?.name || "—"}</span>
                    )}
                    {c.kind === "remove" && (
                      <span style={{ fontFamily: "var(--font-family-mono)", textDecoration: "line-through" }}>{c.fromVersion?.name || "—"}</span>
                    )}
                  </div>
                </td>
                <td style={srmTd}>
                  {c.currentStrategy
                    ? <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{window.sysStrategyLabel(c.currentStrategy)}</span>
                    : <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Not set</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered.length > PAGE_SIZE && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 4px 2px", fontSize: 12, color: "var(--color-text-secondary)",
        }}>
          <span>
            Showing <span style={{ fontFamily: "var(--font-family-mono)", color: "var(--color-text-primary)", fontWeight: 500 }}>
              {(safePage * PAGE_SIZE) + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}
            </span> of <span style={{ fontFamily: "var(--font-family-mono)" }}>{filtered.length.toLocaleString()}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
              style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--color-text-secondary)", opacity: safePage === 0 ? 0.5 : 1, cursor: "pointer", background: "transparent", border: 0 }}>← Prev</button>
            <span style={{ fontFamily: "var(--font-family-mono)", fontSize: 11.5, color: "var(--color-text-tertiary)" }}>{safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
              style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--color-text-secondary)", opacity: safePage >= totalPages - 1 ? 0.5 : 1, cursor: "pointer", background: "transparent", border: 0 }}>Next →</button>
          </div>
        </div>
      )}

      <div style={{
        marginTop: 2, padding: "10px 12px", borderRadius: 6,
        background: "var(--color-info-50, oklch(96% 0.04 230))",
        color: "var(--color-info-700, oklch(40% 0.12 230))",
        fontSize: 12, lineHeight: 1.5,
      }}>
        The selected strategy will be <strong>applied uniformly</strong> to all {changes.length.toLocaleString()} change{changes.length === 1 ? "" : "s"} above. Submit separate batches if different ISOs need different rollout strategies.
      </div>
    </div>
  );
};

const srmTh = {
  padding: "8px 12px", fontSize: 10.5,
  textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--color-text-tertiary)", fontWeight: 600,
};
const srmTd = { padding: "10px 12px", verticalAlign: "middle", fontSize: 12.5 };

const SrmKindPill = ({ kind }) => {
  const config = {
    "add":             { label: "Add",      bg: "oklch(96% 0.05 152)", fg: "oklch(40% 0.12 152)", border: "oklch(58% 0.14 152 / 0.4)" },
    "version-change":  { label: "Version",  bg: "oklch(96% 0.04 262)", fg: "var(--color-primary-700)", border: "oklch(60% 0.14 262 / 0.4)" },
    "strategy-change": { label: "Strategy", bg: "oklch(96% 0.04 262)", fg: "var(--color-primary-700)", border: "oklch(60% 0.14 262 / 0.4)" },
    "remove":          { label: "Remove",   bg: "oklch(96% 0.04 25)",  fg: "oklch(40% 0.14 25)", border: "oklch(58% 0.20 25 / 0.4)" },
  }[kind] || { label: kind, bg: "var(--color-bg-3)", fg: "var(--color-text-tertiary)", border: "var(--color-border-default)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      background: config.bg, color: config.fg, border: `1px solid ${config.border}`,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
    }}>{config.label}</span>
  );
};

// ─── Step 2: Pick strategy ─────────────────────────────────
const SrmStepStrategy = ({ strategy, setStrategy, setPreset, changes }) => {
  const isCustom = strategy.strategy === "custom";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Pick the strategy applied to this batch
          </div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
            The same strategy applies to every (ISO, version) change above.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {window.SYS_UPGRADE_STRATEGY_PRESETS.map(p => {
          const on = strategy.strategy === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              padding: 14, textAlign: "left",
              background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
              border: "1px solid", borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
              borderRadius: 8,
              boxShadow: on ? "0 0 0 3px oklch(40% 0.14 262 / 0.08)" : "none",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", border: "1.5px solid",
                  borderColor: on ? "var(--color-primary-600, var(--color-primary-500))" : "var(--color-border-default)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  {on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary-500)" }}/>}
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{p.label}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
                {p.body}
              </div>
              {p.id !== "custom" && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <SrmChip>{window.sysTimingLabel(p.timing)}</SrmChip>
                  <SrmChip>{window.sysNetworkLabel(p.network)}</SrmChip>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isCustom && (
        <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--color-border-default)", background: "var(--color-bg-2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "var(--color-text-secondary)" }}>Custom parameters</div>
          <SrmFieldRow label="Network requirement">
            <SrmRadioGroup value={strategy.network}
              onChange={(v) => setStrategy(s => ({ ...s, network: v }))}
              options={window.SYS_UPGRADE_NETWORK_OPTIONS}/>
            {strategy.network === "cellCap" && (
              <div style={{
                marginTop: 10, padding: "10px 12px",
                border: "1px solid var(--color-border-default)", borderRadius: 6,
                background: "var(--color-bg-1)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Monthly cellular cap</span>
                <input type="number" min={10} step={10}
                  value={strategy.cellCapMb}
                  onChange={(e) => setStrategy(s => ({ ...s, cellCapMb: Number(e.target.value) }))}
                  style={{
                    width: 100, padding: "6px 10px",
                    border: "1px solid var(--color-border-default)", borderRadius: 4,
                    background: "var(--color-bg-1)", color: "var(--color-text-primary)",
                    fontFamily: "var(--font-family-mono)", fontSize: 13,
                  }}/>
                <span style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>MB</span>
              </div>
            )}
          </SrmFieldRow>

          <SrmFieldRow label="Upgrade timing">
            <SrmRadioGroup value={strategy.timing}
              onChange={(v) => setStrategy(s => ({
                ...s, timing: v,
                slots: v === "scheduled" && (!s.slots || s.slots.length === 0) ? [{ start: "02:00", end: "04:00" }] : s.slots,
              }))}
              options={window.SYS_UPGRADE_TIMING_OPTIONS}/>
            {strategy.timing === "scheduled" && (
              <SysSlotsEditor slots={strategy.slots || []}
                onChange={(slots) => setStrategy(s => ({ ...s, slots }))}/>
            )}
          </SrmFieldRow>
        </div>
      )}

      <div style={{
        padding: "10px 12px",
        background: "oklch(96% 0.05 152)",
        border: "1px solid oklch(58% 0.14 152 / 0.30)",
        borderRadius: 6, fontSize: 12, lineHeight: 1.6,
        color: "oklch(35% 0.10 152)",
      }}>
        Strategy preview: <strong>{window.sysStrategyLabel(strategy.strategy)}</strong>
        {" · "}
        Network <strong>
          {strategy.network === "cellCap"
            ? `Cellular < ${strategy.cellCapMb} MB / mo`
            : window.sysNetworkLabel(strategy.network)}
        </strong>
        {" · "}
        Timing <strong>
          {strategy.timing === "scheduled"
            ? ((strategy.slots || []).length
                ? `Scheduled · ${(strategy.slots || []).map(sl => `${sl.start}–${sl.end}`).join(", ")}`
                : "Scheduled (no windows yet)")
            : window.sysTimingLabel(strategy.timing)}
        </strong>
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.85 }}>
          Applies to {changes.length} change{changes.length === 1 ? "" : "s"}.
        </div>
      </div>
    </div>
  );
};

const SrmChip = ({ children }) => (
  <span style={{
    fontSize: 10.5, padding: "2px 7px", borderRadius: 999,
    background: "var(--color-bg-3)", color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border-subtle)",
  }}>{children}</span>
);

const SrmFieldRow = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{
      fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)",
      textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6,
    }}>{label}</div>
    {children}
  </div>
);

const SrmRadioGroup = ({ value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {options.map(opt => {
      const on = value === opt.id;
      return (
        <button key={opt.id} onClick={() => onChange(opt.id)} style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
          background: on ? "var(--color-primary-50)" : "var(--color-bg-1)",
          border: "1px solid", borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
          borderRadius: 6, textAlign: "left", cursor: "pointer",
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%", border: "1.5px solid",
            borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
            display: "grid", placeItems: "center", marginTop: 2, flexShrink: 0,
          }}>
            {on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary-500)" }}/>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{opt.label}</div>
            {opt.body && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2, lineHeight: 1.5 }}>{opt.body}</div>}
          </div>
        </button>
      );
    })}
  </div>
);

// ─── Slots editor (scheduled timing) ───────────────────────
function sysToMin(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function sysValidateSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return "Add at least one time window.";
  const ranges = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const a = sysToMin(s.start), b = sysToMin(s.end);
    if (a == null || b == null) return `Window ${i + 1}: invalid time.`;
    if (b <= a) return `Window ${i + 1}: end must be after start (windows can't cross midnight).`;
    ranges.push([a, b, i]);
  }
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (cur[0] < prev[1]) return `Windows ${prev[2] + 1} and ${cur[2] + 1} overlap.`;
  }
  return null;
}

const SysSlotsEditor = ({ slots, onChange }) => {
  const list = Array.isArray(slots) && slots.length ? slots : [{ start: "02:00", end: "04:00" }];
  const err = sysValidateSlots(list);
  const update = (i, patch) => onChange(list.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const add = () => {
    const ends = list.map(s => sysToMin(s.end) || 0);
    const latest = ends.length ? Math.max(...ends) : 0;
    let startMin = Math.min(Math.max(latest + 30, 0), 22 * 60);
    let endMin   = Math.min(startMin + 120, 23 * 60 + 59);
    if (endMin <= startMin) { startMin = 22 * 60; endMin = 23 * 60; }
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    onChange([...list, { start: fmt(startMin), end: fmt(endMin) }]);
  };
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [{ start: "02:00", end: "04:00" }]);
  };

  const input = {
    width: 96, padding: "6px 8px",
    border: "1px solid var(--color-border-default)", borderRadius: 4,
    background: "var(--color-bg-1)", color: "var(--color-text-primary)",
    fontFamily: "var(--font-family-mono)", fontSize: 13,
  };

  return (
    <div style={{
      marginTop: 10, padding: "12px 14px",
      border: "1px solid var(--color-border-default)", borderRadius: 6,
      background: "var(--color-bg-1)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Reserved install windows</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2, lineHeight: 1.5 }}>
            Install only inside these windows. Multiple windows per day are allowed; they must not overlap and can't cross midnight.
          </div>
        </div>
        <span style={{ fontFamily: "var(--font-family-mono)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {list.length} window{list.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((s, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "22px 1fr auto",
            alignItems: "center", gap: 10, padding: "6px 8px",
            background: "var(--color-bg-2)",
            border: "1px solid var(--color-border-subtle)", borderRadius: 4,
          }}>
            <span style={{ fontFamily: "var(--font-family-mono)", fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>#{i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="time" value={s.start} onChange={(e) => update(i, { start: e.target.value })} style={input}/>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>→</span>
              <input type="time" value={s.end} onChange={(e) => update(i, { end: e.target.value })} style={input}/>
            </div>
            {list.length > 1
              ? <button onClick={() => remove(i)} title="Remove window" style={{
                  width: 26, height: 26, borderRadius: 4, background: "transparent",
                  border: 0, cursor: "pointer", color: "var(--color-text-tertiary)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}><Icon name="x" size={13}/></button>
              : <span style={{ width: 26 }}/>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <button onClick={add} disabled={list.length >= 6} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", fontSize: 11.5, fontWeight: 500,
          color: list.length >= 6 ? "var(--color-text-tertiary)" : "var(--color-primary-700)",
          background: list.length >= 6 ? "var(--color-bg-2)" : "var(--color-primary-50)",
          border: "1px dashed",
          borderColor: list.length >= 6 ? "var(--color-border-subtle)" : "oklch(60% 0.14 262 / 0.40)",
          borderRadius: 4, cursor: list.length >= 6 ? "not-allowed" : "pointer",
        }}>+ Add window{list.length >= 6 ? " (max 6)" : ""}</button>
        {err
          ? <div style={{ fontSize: 11.5, color: "oklch(45% 0.14 25)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="info" size={11}/> {err}
            </div>
          : <div style={{ fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
              <span style={{ fontFamily: "var(--font-family-mono)" }}>{list.map(sl => `${sl.start}–${sl.end}`).join(" · ")}</span>
            </div>}
      </div>
    </div>
  );
};

// ─── Strategy cell (in-table chip) ─────────────────────────
const SysStrategyCell = ({ record, disabled, onClick }) => {
  const STRAT = { casual: "Casual", immediate: "Immediate", custom: "Custom" };
  const preset = record ? window.resolveSysStrategyPreset(record) : null;
  const summary = record ? window.formatSysStrategySummary(record) : null;
  const palette = {
    casual:    { bg: "oklch(96% 0.05 152)", fg: "oklch(35% 0.10 152)", border: "oklch(58% 0.14 152 / 0.4)" },
    immediate: { bg: "oklch(96% 0.04 25)",  fg: "oklch(42% 0.16 25)",  border: "oklch(58% 0.20 25 / 0.4)"  },
    custom:    { bg: "oklch(96% 0.04 262)", fg: "var(--color-primary-700)", border: "oklch(60% 0.14 262 / 0.4)" },
  }[preset] || { bg: "var(--color-bg-3)", fg: "var(--color-text-tertiary)", border: "var(--color-border-subtle)" };
  const click = disabled || !onClick ? undefined : onClick;
  return (
    <button onClick={click} disabled={disabled || !onClick} title={summary || "No strategy yet"}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
        padding: "4px 10px", borderRadius: 6,
        background: palette.bg, border: `1px solid ${palette.border}`,
        color: palette.fg, cursor: click ? "pointer" : "default",
        opacity: disabled ? 0.6 : 1, maxWidth: 240,
      }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em" }}>
        {preset ? STRAT[preset] : "Not set"}
      </span>
      {summary && (
        <span style={{ fontSize: 10.5, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
          {summary}
        </span>
      )}
    </button>
  );
};

// ─── Target version dropdown (in-table editor) ────────────
const SysTargetVersionDropdown = ({ value, options, latestId, isDirty, disabled, onChange }) => (
  <div style={{ position: "relative" }}>
    <select value={value} disabled={disabled || (options || []).length === 0}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "5px 26px 5px 8px", borderRadius: 6,
        border: `1px solid ${isDirty ? "var(--color-primary-500)" : "var(--color-border-default)"}`,
        fontSize: 12.5, fontFamily: "var(--font-family-mono)",
        fontVariantNumeric: "tabular-nums",
        background: "var(--color-bg-2)", color: "var(--color-text-primary)",
        fontWeight: isDirty ? 600 : 500,
        minWidth: 110, cursor: disabled ? "not-allowed" : "pointer",
        appearance: "none",
      }}>
      {(options || []).map(v => (
        <option key={v.id} value={v.id}>{v.name}{v.id === latestId ? " · latest" : ""}</option>
      ))}
    </select>
    <Icon name="chevD" size={11} style={{
      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
      color: "var(--color-text-tertiary)", pointerEvents: "none",
    }}/>
  </div>
);

// ─── Pending badge ─────────────────────────────────────────
const SysPendingBadge = ({ tone, children }) => {
  const palette = {
    add:    { bg: "oklch(96% 0.05 152)", fg: "oklch(40% 0.12 152)" },
    edit:   { bg: "oklch(96% 0.04 262)", fg: "var(--color-primary-700)" },
    remove: { bg: "oklch(96% 0.04 25)",  fg: "oklch(42% 0.16 25)" },
  }[tone] || { bg: "var(--color-bg-3)", fg: "var(--color-text-tertiary)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 8px", borderRadius: 999,
      background: palette.bg, color: palette.fg,
      border: "1px solid var(--color-border-subtle)",
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.02em",
      textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}/>
      {children}
    </span>
  );
};

Object.assign(window, {
  SysRolloutModal,
  SysStrategyCell,
  SysTargetVersionDropdown,
  SysPendingBadge,
  sysValidateSlots,
});
