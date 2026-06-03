/* global React */
// ─────────────────────────────────────────────────────────────
// Carbon — New / Edit App drawer
// ─────────────────────────────────────────────────────────────

const { useState: useStateN, useEffect: useEffectN, useMemo: useMemoN } = React;

function AppFormScreen({ mode, app, onClose, onSave }) {
  const isEdit = mode === "edit" && !!app;
  const tenant = window.useActiveTenant();
  const hasISO = tenant.contracts.includes("ISO");
  const [name, setName] = useStateN("");
  const [pkg, setPkg] = useStateN("");
  const [category, setCategory] = useStateN("Payments");
  const [description, setDescription] = useStateN("");
  const [devices, setDevices] = useStateN(new Set());
  const [orientations, setOrientations] = useStateN(new Set(["portrait"]));
  const [pkgState, setPkgState] = useStateN(""); // empty | checking | ok | taken | invalid
  // ISV+ISO only: at creation time the publisher chooses whether the app
  // is listed in the public pool (visible to other ISOs) or kept private
  // (their own merchants only). Pure-ISV tenants always publish externally
  // so the toggle isn't shown for them. Defaults to Local pool — most
  // ISV+ISO apps start internal and graduate to the public pool later.
  const [publishToPool, setPublishToPool] = useStateN(false);

  useEffectN(() => {
    if (isEdit && app) {
      setName(app.name);
      setPkg(app.package);
      setCategory(app.category);
      setDescription(app.description);
      setDevices(new Set(app.devices));
      setOrientations(new Set(app.orientations && app.orientations.length ? app.orientations : ["portrait"]));
      setPkgState("ok");
      setPublishToPool(app.status === "published");
    } else {
      setName("");
      setPkg("");
      setCategory("Payments");
      setDescription("");
      setDevices(new Set());
      setOrientations(new Set(["portrait"]));
      setPkgState("");
      setPublishToPool(false);
    }
  }, [isEdit, app?.id]);

  // Simulated async package-name validation
  useEffectN(() => {
    if (isEdit) return;
    if (!pkg) { setPkgState(""); return; }
    if (!/^([a-z][a-z0-9_]*)(\.[a-z][a-z0-9_]*){2,}$/i.test(pkg)) {
      setPkgState("invalid"); return;
    }
    setPkgState("checking");
    const t = setTimeout(() => {
      const taken = window.APPS.some(a => a.package === pkg);
      setPkgState(taken ? "taken" : "ok");
    }, 450);
    return () => clearTimeout(t);
  }, [pkg, isEdit]);

  const canSave = name.trim().length > 1 && pkgState === "ok" && devices.size > 0 && orientations.size > 0;

  const toggleDevice = (id) => {
    const next = new Set(devices);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDevices(next);
  };
  const toggleOrientation = (id) => {
    const next = new Set(orientations);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);   // can't remove the last one
    } else next.add(id);
    setOrientations(next);
  };

  // What happens to the app's publish state on save?
  //   - new app (pure ISV): always external. Lands "private"; first
  //     version upload auto-publishes to the public pool.
  //   - new app (ISV+ISO): the publisher's choice above sets initial
  //     status to either "published" (public pool) or "private" (local
  //     only). They can flip either way later from the App Overview.
  //   - edit: pure metadata save; no review, no state change.
  const savePreview = (() => {
    if (!isEdit) {
      if (hasISO) {
        return { kind: "new", label: publishToPool
          ? "Will be listed in the public pool and visible to other ISO tenants. You can unpublish anytime from the app's Overview."
          : "Lands in your local pool — only your tenant can install it on your own merchants. Publish to the public pool anytime from Overview." };
      }
      return { kind: "new", label:
        "Lands in your local pool. Uploading the first version automatically publishes it to the public pool." };
    }
    return { kind: "saved", label: "Saves immediately. No review needed." };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        background: "var(--color-bg-2)",
        borderBottom: "1px solid var(--color-border-subtle)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onClose} style={{ color: "var(--color-text-tertiary)", padding: 2 }} title="Back">
          <window.Ico name="chevl" size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {isEdit ? `Edit ${app?.name}` : "New app"}
          </h1>
          <div style={{ marginTop: 2, fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {isEdit ? "Update display metadata. The package name is fixed once published."
                    : "Create a new app entry. You'll be able to upload an APK once basic info is filled in."}
          </div>
        </div>
        <window.Button onClick={onClose}>Cancel</window.Button>
        <window.Button primary disabled={!canSave} icon={isEdit ? "check" : "plus"}
          onClick={() => {
            // onSave is responsible for navigation (new → app detail,
            // edit → back to app detail). Calling onClose after would
            // race the navigation and bounce the user back to the list.
            if (onSave) onSave({ name, pkg, category, description, devices, orientations, publishToPool });
            else onClose();
          }}>
          {isEdit ? "Save changes" : "Create app"}
        </window.Button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--color-bg-1)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 32px",
          display: "flex", flexDirection: "column", gap: 16 }}>

          <window.Card title="Identity">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Icon preview — initials placeholder until an APK provides one */}
              <window.Field label="Icon"
                hint="The icon will be extracted from your APK when you upload a version. Until then, a placeholder built from your app name is used.">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <window.AppIcon name={name || (isEdit ? app?.name : "")} pkg={pkg} size={64} radius={14} />
                  <div style={{ flex: 1, minWidth: 0,
                    padding: "10px 12px", borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-3)", border: "1px solid var(--color-border-subtle)",
                    fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-primary)", fontWeight: 500 }}>
                      <window.Ico name="image" size={13} />
                      <span>Auto-generated placeholder</span>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      {name
                        ? <>Initials <span className="mono" style={{ color: "var(--color-text-primary)" }}>
                            {name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                          </span> on a colour derived from the package name.</>
                        : <>Enter the app name and package below to preview.</>}
                    </div>
                  </div>
                </div>
              </window.Field>

              <window.Field label="App name" required>
                <window.Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme POS Pro" />
              </window.Field>

              <window.Field label="Package name" required
                hint={isEdit ? "Cannot be changed once an app has been published" : "Reverse-domain notation. Must be globally unique across the TOMS catalog."}
                error={pkgState === "invalid" ? "Invalid format — use reverse-domain notation, e.g. com.company.app"
                      : pkgState === "taken" ? "This package name is already taken by another publisher." : null}>
                <window.Input value={pkg} onChange={(e) => setPkg(e.target.value)}
                  placeholder="com.acme.curbside" mono disabled={isEdit}
                  suffix={
                    pkgState === "checking" ? <Spinner size={11} /> :
                    pkgState === "ok"       ? <window.Ico name="check" size={13} style={{ color: "var(--color-success-500)" }} stroke={2.5} /> :
                    pkgState === "taken"    ? <window.Ico name="x"     size={13} style={{ color: "var(--color-error-500)"  }} stroke={2.5} /> :
                    pkgState === "invalid"  ? <window.Ico name="alert" size={13} style={{ color: "var(--color-error-500)"  }} /> : null
                  } />
                {pkgState === "ok" && !isEdit && (
                  <div style={{ marginTop: 5, fontSize: 11, color: "var(--color-success-500)", display: "flex", alignItems: "center", gap: 5 }}>
                    <window.Ico name="check" size={11} stroke={2.5} /> Available
                  </div>
                )}
              </window.Field>

              <window.Field label="Category" required>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(window.CATEGORIES || ["Payments", "Retail", "Food & Beverage", "Self-Service", "Hospitality", "Loyalty", "Inventory", "Reporting", "Workforce", "Healthcare"]).map(c => (
                    <button key={c} onClick={() => setCategory(c)} style={{
                      padding: "5px 11px", borderRadius: 999, fontSize: 12,
                      background: category === c ? "var(--color-primary-50)" : "var(--color-bg-2)",
                      border: "1px solid",
                      borderColor: category === c ? "var(--color-primary-500)" : "var(--color-border-default)",
                      color: category === c ? "var(--color-primary-700)" : "var(--color-text-secondary)",
                      fontWeight: category === c ? 500 : 400,
                    }}>{c}</button>
                  ))}
                </div>
              </window.Field>

              <window.Field label="Description"
                hint="Up to 500 characters · Shown to merchants in the install prompt">
                <window.Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={4} placeholder="Describe what this app does and who it's for." />
              </window.Field>
            </div>
          </window.Card>

          {/* Publish destination — only shown for ISV+ISO tenants at
              creation time. Pure-ISV tenants always publish externally;
              the edit-app form doesn't expose this either (use the
              "Publish to public pool" / "Unpublish" buttons on the app's
              Overview page to change destination after creation). */}
          {!isEdit && hasISO && (
            <window.Card title="Publish destination"
              hint="Decide where this app lives. You can change this later from the app's Overview.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "private", on: publishToPool === false,
                    icon: "lock",
                    label: "Self-App Store",
                    body: "Internal to your tenant. You can still install versions on your own merchants from the App Store side, but no other ISO can see this app.",
                    badge: "Private" },
                  { id: "public",  on: publishToPool === true,
                    icon: "users",
                    label: "Public pool",
                    body: "Listed in the marketplace. Other ISO tenants can browse and subscribe — their merchants pull versions through your release pipeline.",
                    badge: "Discoverable" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setPublishToPool(opt.id === "public")} style={{
                    padding: 14, textAlign: "left",
                    background: opt.on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                    border: "1px solid",
                    borderColor: opt.on ? "var(--color-primary-500)" : "var(--color-border-default)",
                    borderRadius: 8,
                    boxShadow: opt.on ? "0 0 0 3px oklch(40% 0.14 262 / 0.08)" : "none",
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "1.5px solid",
                        borderColor: opt.on ? "var(--color-primary-600)" : "var(--color-border-strong)",
                        display: "grid", placeItems: "center",
                      }}>
                        {opt.on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary-600)" }} />}
                      </div>
                      <window.Ico name={opt.icon} size={13}
                        style={{ color: opt.on ? "var(--color-primary-700)" : "var(--color-text-tertiary)" }} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                      <span style={{ marginLeft: "auto",
                        fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: opt.on ? "var(--color-bg-2)" : "var(--color-bg-3)",
                        color: "var(--color-text-tertiary)",
                        textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                      }}>{opt.badge}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
                      {opt.body}
                    </div>
                  </button>
                ))}
              </div>
            </window.Card>
          )}

          <window.Card title="Supported orientations"
            hint="Declared at the app level — the APK must match. Screenshots are uploaded per orientation on each version.">
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { id: "portrait",  label: "Portrait",  w: 36, h: 60 },
                { id: "landscape", label: "Landscape", w: 60, h: 36 },
              ].map(o => {
                const on = orientations.has(o.id);
                return (
                  <button key={o.id} onClick={() => toggleOrientation(o.id)} style={{
                    flex: 1, padding: "14px 16px", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 14,
                    background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                    border: "1px solid",
                    borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
                    borderRadius: 8,
                    boxShadow: on ? "0 0 0 3px oklch(40% 0.14 262 / 0.08)" : "none",
                    cursor: "pointer",
                  }}>
                    <div style={{ width: 72, height: 72, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <div style={{
                        width: o.w, height: o.h, borderRadius: 4,
                        background: on ? "var(--color-primary-700)" : "var(--color-bg-3)",
                        border: "1px solid",
                        borderColor: on ? "transparent" : "var(--color-border-default)",
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{o.label}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
                        {on ? "✓ selected" : "tap to enable"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </window.Card>

          <window.Card title="Device compatibility"
            hint={`${devices.size} of ${window.DEVICE_MODELS.length} models selected · Subscribers can only install on supported models.`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {window.DEVICE_MODELS.map(d => {
                const on = devices.has(d.id);
                return (
                  <button key={d.id} onClick={() => toggleDevice(d.id)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 11px",
                    background: on ? "var(--color-primary-50)" : "var(--color-bg-2)",
                    border: "1px solid",
                    borderColor: on ? "var(--color-primary-500)" : "var(--color-border-default)",
                    borderRadius: 7, textAlign: "left",
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: on ? "var(--color-primary-600)" : "transparent",
                      border: "1px solid",
                      borderColor: on ? "var(--color-primary-600)" : "var(--color-border-default)",
                      display: "grid", placeItems: "center",
                      color: "white", flexShrink: 0,
                    }}>
                      {on && <window.Ico name="check" size={10} stroke={2.5} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{d.id}</div>
                      <div style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }} className="truncate">{d.blurb}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </window.Card>
        </div>
      </div>

      {/* Sticky footer */}
      <footer style={{
        padding: "12px 24px",
        borderTop: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg-2)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ flex: 1, fontSize: 11.5, color: "var(--color-text-tertiary)" }}>
          {savePreview.label}
        </div>
        <window.Button onClick={onClose}>Cancel</window.Button>
        <window.Button primary disabled={!canSave} icon={isEdit ? "check" : "plus"}
          onClick={() => {
            // onSave is responsible for navigation (new → app detail,
            // edit → back to app detail). Calling onClose after would
            // race the navigation and bounce the user back to the list.
            if (onSave) onSave({ name, pkg, category, description, devices, orientations, publishToPool });
            else onClose();
          }}>
          {isEdit ? "Save changes" : "Create app"}
        </window.Button>
      </footer>
    </div>
  );
}

function Spinner({ size = 12 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `${Math.max(1.5, Math.round(size / 10))}px solid var(--color-bg-3)`,
      borderTopColor: "var(--color-primary-600)",
      animation: "spin .8s linear infinite",
      flexShrink: 0,
    }} />
  );
}

window.AppFormScreen = AppFormScreen;
